// Registrar, editar y eliminar gastos del mes activo, con recálculo
// automático de saldo (el saldo siempre se calcula a partir de los
// movimientos, nunca se guarda "congelado"). Por ahora solo Colonia está
// habilitada; Miguelete queda fuera del selector hasta que se den de alta
// sus datos reales.
//
// Diseño minimalista: los controles secundarios (agregar gasto, agregar
// previsto, cerrar/reabrir el mes) se muestran como "burbujas" que se
// despliegan al tocarlas, en vez de secciones siempre visibles.

let state = loadState();
let hogarSeleccionado = 'colonia';
let mesSeleccionado = null;
let editandoMovId = null;
let confirmandoPrevistoId = null;
let conceptosExpandidos = new Set();
let formMovimientoAbierto = false;
let formPrevistoAbierto = false;
let previstosPanelAbierto = false; // panel de Gastos previstos (plegado por default)
let accionesMesExpandido = false;
let confirmandoAccionMes = null; // 'cerrar' | 'reabrir' | 'eliminar-preparado' | null
let indicadorExpandido = false;
let indicadorTimer = null;
let respaldoAbierto = null; // 'exportar' | 'importar' | null
let archivoImportarTexto = null;
let archivoImportarNombre = null;
let avisosDescartados = new Set(); // ids de alertas de sistema deslizadas en esta vista
let swipeEstado = null; // seguimiento del gesto de deslizar en curso
let alertasPanelAbierto = false; // panel de Alertas (campana con contador)
let formAlertaAbierto = false; // formulario de alerta nueva (se abre con el "+" de al lado de la campana)
let editandoPresupuesto = false; // tarjeta de Presupuesto en modo edición
let formNuevoMesAbierto = false; // burbuja "+" para crear el mes siguiente
let vistaActual = 'colonia'; // 'colonia' | 'finanzas' — qué botón está activo arriba
let hogaresMenuAbierto = false; // desplegable "Hogares" (plegado por default, tap para ver Colonia/Miguelete)

// Finanzas es un gestor paralelo (plata personal, sin ciclo mensual que se
// cierre): alterna qué contenedores se ven sin tocar el estado de ninguno
// de los dos, así cada uno sigue donde estaba al volver a él.
function mostrarVista(vista) {
  vistaActual = vista;
  const esColonia = vista === 'colonia';
  document.getElementById('selector-meses').hidden = !esColonia;
  document.getElementById('estado-cuenta').hidden = !esColonia;
  document.getElementById('finanzas-selector-meses').hidden = esColonia;
  document.getElementById('finanzas-cuenta').hidden = esColonia;
  document.getElementById('finanzas-inversiones').hidden = esColonia;
  const subtitulo = document.getElementById('subtitulo');
  if (subtitulo) {
    subtitulo.textContent = esColonia
      ? `Registro de gastos — Hogar ${state.hogares[hogarSeleccionado].nombre}`
      : 'Finanzas personales';
  }
}

function prepararMesActivo() {
  const hogar = state.hogares[hogarSeleccionado];
  const mesObj = mesSeleccionado ? hogar.meses[mesSeleccionado] : null;
  if (mesObj && asegurarPrevistosRecurrentes(hogar, mesObj)) saveState(state);
}

function init() {
  const meses = getMesesOrdenados(state.hogares[hogarSeleccionado]);
  const activo = meses.find((m) => m.estado === 'activo');
  mesSeleccionado = activo ? activo.mes : meses.length ? meses[meses.length - 1].mes : null;
  prepararMesActivo();

  mostrarVista('colonia');
  renderSelectorHogares();
  renderSelectorMeses();
  renderEstadoDeCuenta();
  renderRespaldo();
  initFinanzas();

  document.getElementById('estado-cuenta').addEventListener('click', onEstadoCuentaClick);
  document.getElementById('estado-cuenta').addEventListener('submit', onEstadoCuentaSubmit);
  document.getElementById('estado-cuenta').addEventListener('pointerdown', onAvisoPointerDown);
  document.getElementById('respaldo').addEventListener('click', onRespaldoClick);
  document.getElementById('selector-hogares').addEventListener('click', onSelectorHogaresClick);
  document.getElementById('selector-meses').addEventListener('click', onSelectorMesesClick);
  document.getElementById('selector-meses').addEventListener('submit', onSelectorMesesSubmit);
}

function resetEstadosDeInteraccion() {
  editandoMovId = null;
  confirmandoPrevistoId = null;
  conceptosExpandidos.clear();
  formMovimientoAbierto = false;
  formPrevistoAbierto = false;
  previstosPanelAbierto = false;
  accionesMesExpandido = false;
  confirmandoAccionMes = null;
  indicadorExpandido = false;
  avisosDescartados.clear();
  alertasPanelAbierto = false;
  formAlertaAbierto = false;
  editandoPresupuesto = false;
  formNuevoMesAbierto = false;
  hogaresMenuAbierto = false;
  if (indicadorTimer) {
    clearTimeout(indicadorTimer);
    indicadorTimer = null;
  }
}

// Navegación superior: dos controles independientes. "Hogares" es un
// desplegable plegado por default (mismo patrón que Alertas, Gastos
// previstos, etc.) que al tocarlo revela los Hogares habilitados (Colonia,
// Miguelete); "Finanzas" es un botón aparte, sin relación con ese
// desplegable, que lleva directo al gestor personal. El botón "Hogares" se
// pone violeta mientras está desplegado (color distinto del celeste de
// activo y del oscuro de plegado) para que se note de un vistazo, sin
// depender de ver el panel de abajo. Dentro, cada Hogar es una burbuja con
// su inicial que se expande al nombre completo al elegirla.
function renderSelectorHogares() {
  const cont = document.getElementById('selector-hogares');
  const enHogares = vistaActual === 'colonia';

  let html = '<div class="selector-hogares__fila">';
  html += `<button type="button" class="tab${enHogares ? ' tab--activo' : ''}${hogaresMenuAbierto ? ' tab--abierto' : ''}" data-action="toggle-menu-hogares">🏠 Hogares</button>`;
  html += `<button type="button" class="tab${vistaActual === 'finanzas' ? ' tab--activo' : ''}" data-action="ir-finanzas">Finanzas</button>`;
  html += '</div>';

  if (hogaresMenuAbierto) {
    html += '<div class="menu-hogares-panel">';
    getHogaresHabilitados(state).forEach((hogar) => {
      const activa = enHogares && hogar.id === hogarSeleccionado;
      const contenido = activa
        ? `<span class="burbuja-hogar__nombre">${hogar.nombre.toUpperCase()}</span>`
        : hogar.nombre.charAt(0).toUpperCase();
      html += `<button type="button" class="burbuja-hogar${activa ? ' burbuja-hogar--seleccionada' : ''}" data-action="elegir-hogar" data-hogar="${hogar.id}">${contenido}</button>`;
    });
    html += '</div>';
  }

  cont.innerHTML = html;
}

function onSelectorHogaresClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  switch (btn.dataset.action) {
    case 'toggle-menu-hogares':
      hogaresMenuAbierto = !hogaresMenuAbierto;
      renderSelectorHogares();
      break;

    case 'elegir-hogar': {
      hogarSeleccionado = btn.dataset.hogar;
      const meses = getMesesOrdenados(state.hogares[hogarSeleccionado]);
      const activo = meses.find((m) => m.estado === 'activo');
      mesSeleccionado = activo ? activo.mes : meses.length ? meses[meses.length - 1].mes : null;
      prepararMesActivo();
      resetEstadosDeInteraccion();
      hogaresMenuAbierto = true; // se queda desplegado para mostrar la burbuja expandida con el nombre elegido
      mostrarVista('colonia');
      renderSelectorHogares();
      renderSelectorMeses();
      renderEstadoDeCuenta();
      break;
    }

    case 'ir-finanzas':
      hogaresMenuAbierto = false;
      mostrarVista('finanzas');
      renderSelectorHogares();
      renderFinanzas();
      break;
  }
}

// Solo se muestran los meses que ya existen, más un "+" (mismo lenguaje
// visual que el de Alertas) para crear el siguiente — nunca una tira fija
// con casilleros deshabilitados. Al seleccionar un mes existente, su chip
// se expande con el nombre completo y se colorea según esté activo
// (editable) o cerrado (solo lectura). El "+" solo permite crear UN mes
// por delante del último que ya existe, para ir preparando el terreno
// para cuando se cierre el mes en curso.
function renderSelectorMeses() {
  const cont = document.getElementById('selector-meses');
  const hogar = state.hogares[hogarSeleccionado];
  const meses = getMesesOrdenados(hogar);

  let html = '';
  if (!meses.length) {
    html += '<p class="aviso">Este Hogar todavía no tiene meses cargados.</p>';
  }
  meses.forEach((mesObj) => {
    const mesKey = mesObj.mes;
    const seleccionado = mesKey === mesSeleccionado;
    const bloqueado = mesObj.estado === 'cerrado';
    const preparado = mesObj.estado === 'preparado';
    // El candado solo se muestra en los meses cerrados; el reloj de arena en
    // el mes preparado (esperando su turno); el mes activo se ve "libre".
    const icono = bloqueado ? '<span class="chip-mes__candado">🔒</span>' : preparado ? '<span class="chip-mes__candado">⏳</span>' : '';
    const modificador = bloqueado ? ' chip-mes--bloqueado' : preparado ? ' chip-mes--preparado' : ' chip-mes--activo';
    const clase = 'chip-mes' + (seleccionado ? ' chip-mes--seleccionado' : '') + modificador;
    const contenido = seleccionado
      ? `${icono}<span class="chip-mes__nombre">${mesLabel(mesKey).toUpperCase()}</span>`
      : `<span class="chip-mes__codigo">${mesAbrev(mesKey)}</span>${icono}`;
    html += `<button type="button" class="${clase}" data-action="seleccionar-mes" data-mes="${mesKey}">${contenido}</button>`;
  });

  const proximo = puedeCrearMesSiguiente(hogar) ? proximoMesCreable(hogar) : null;
  if (proximo) {
    if (formNuevoMesAbierto) {
      html += `
        <form id="form-nuevo-mes" class="form-nuevo-mes">
          <span class="form-nuevo-mes__titulo">${mesLabel(proximo).toUpperCase()}</span>
          <input type="number" name="presupuesto" min="1" step="1" placeholder="Presupuesto" required autofocus>
          <div class="acciones-form">
            <button type="submit">Crear</button>
            <button type="button" data-action="cancelar-nuevo-mes">Cancelar</button>
          </div>
        </form>`;
    } else {
      html += `<button type="button" class="btn-mes-agregar" data-action="abrir-nuevo-mes" title="Crear ${mesLabel(proximo)}">+</button>`;
    }
  }

  cont.innerHTML = html;
}

function onSelectorMesesClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  switch (btn.dataset.action) {
    case 'seleccionar-mes':
      mesSeleccionado = btn.dataset.mes;
      prepararMesActivo();
      resetEstadosDeInteraccion();
      renderSelectorMeses();
      renderEstadoDeCuenta();
      break;

    case 'abrir-nuevo-mes':
      formNuevoMesAbierto = true;
      renderSelectorMeses();
      break;

    case 'cancelar-nuevo-mes':
      formNuevoMesAbierto = false;
      renderSelectorMeses();
      break;
  }
}

function onSelectorMesesSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (form.id !== 'form-nuevo-mes') return;

  const hogar = state.hogares[hogarSeleccionado];
  const mesKey = proximoMesCreable(hogar);
  const presupuesto = Number(form.presupuesto.value);
  if (!mesKey || !presupuesto || presupuesto <= 0) {
    alert('El presupuesto tiene que ser mayor a $0.');
    return;
  }

  crearMesNuevo(hogar, mesKey, presupuesto);
  saveState(state);
  formNuevoMesAbierto = false;
  mesSeleccionado = mesKey;
  prepararMesActivo();
  resetEstadosDeInteraccion();
  renderSelectorMeses();
  renderEstadoDeCuenta();
}

function getMesActual() {
  const hogar = state.hogares[hogarSeleccionado];
  return mesSeleccionado ? hogar.meses[mesSeleccionado] : null;
}

function persistirYRenderizar() {
  saveState(state);
  renderEstadoDeCuenta();
}

// Encabezado minimalista del mes: un indicador (punto verde = activo,
// candado = cerrado) que se despliega al tocarlo. En el mes activo el
// despliegue es momentáneo (muestra "En curso" un par de segundos y
// vuelve solo al punto); en el mes cerrado el despliegue queda fijo hasta
// tocar de nuevo, y ahí aparecen el PDF y el lápiz para reabrir. El mes
// "preparado" nunca muestra nada de eso (ni "en curso", ni PDF, ni cerrar):
// solo la etiqueta de estado y un cesto para eliminarlo si hace falta.
function renderEncabezadoMes(mesObj, hogar) {
  let html = '<div class="estado-mes-header">';

  if (confirmandoAccionMes) {
    const esCerrar = confirmandoAccionMes === 'cerrar';
    const esEliminarPreparado = confirmandoAccionMes === 'eliminar-preparado';
    const preparado = esCerrar ? mesSiguientePreparado(hogar) : null;
    let pregunta;
    if (esCerrar) {
      pregunta = `¿Cerrar este estado de cuenta? Va a quedar de solo lectura y se descartan las alertas del mes (no forman parte del historial).${preparado ? ` ${mesLabel(preparado.mes)} pasa a ser el mes en curso.` : ''}`;
    } else if (esEliminarPreparado) {
      pregunta = `¿Eliminar ${mesLabel(mesObj.mes)}? Todavía no está en curso, no tiene ningún gasto cargado que perder. Se puede volver a preparar un mes cuando haga falta.`;
    } else {
      pregunta = '¿Reabrir para corregir un error?';
    }
    html += `
      <div class="confirmar-accion-mes">
        <span>${pregunta}</span>
        <button type="button" class="btn-confirmar${!esCerrar && !esEliminarPreparado ? ' btn-confirmar--azul' : ''}" data-action="confirmar-accion-mes">Confirmar</button>
        <button type="button" class="btn-cancelar" data-action="cancelar-accion-mes">Cancelar</button>
      </div>`;
    html += '</div>';
    return html;
  }

  if (mesObj.estado === 'activo') {
    html += `
      <button type="button" class="indicador-activo" data-action="toggle-indicador" title="Estado del mes">
        <span class="punto-verde"></span>
        ${indicadorExpandido ? '<span class="indicador-texto">En curso</span>' : ''}
      </button>
      <div class="acciones-mes-mini">
        <button type="button" class="btn-pdf-mini" data-action="descargar-pdf">📄 PDF</button>
        <button type="button" class="btn-icono-mes" data-action="pedir-cerrar-mes" title="Cerrar estado de cuenta">🔒</button>
      </div>`;
  } else if (mesObj.estado === 'preparado') {
    html += `
      <span class="indicador-preparado" title="Preparación: todavía no es el mes en curso">⏳ Preparación</span>
      <div class="acciones-mes-mini">
        <button type="button" class="btn-icono-mes btn-icono-mes--eliminar" data-action="pedir-eliminar-mes-preparado" title="Eliminar mes preparado">🗑️</button>
      </div>`;
  } else {
    html += `<button type="button" class="indicador-cerrado" data-action="toggle-acciones-mes" title="Mes cerrado, solo lectura">🔒</button>`;
    if (accionesMesExpandido) {
      html += `
        <div class="acciones-mes-mini">
          <button type="button" class="btn-pdf-mini" data-action="descargar-pdf">📄 PDF</button>
          ${mesObj.detalleDisponible ? '<button type="button" class="btn-icono-mes" data-action="pedir-reabrir-mes" title="Reabrir para corregir">✏️</button>' : ''}
        </div>`;
    }
  }

  html += '</div>';
  return html;
}

// Genera la lista de alertas activas del mes: reducciones de presupuesto,
// cuenta regresiva para cerrar el mes, saldo que no cuadra contra el
// cierre registrado, conceptos pendientes de aclarar, y las que el usuario
// haya creado a mano. Son solo informativas (sin botones de acción).
function calcularAlertas(mesObj, saldoCalculado) {
  const alertas = [];

  (mesObj.ajustes || []).forEach((aj, i) => {
    if (aj.importe < 0) {
      alertas.push({ id: `reduccion-${i}`, tipo: 'sistema', texto: `Reducción de presupuesto: ${aj.concepto} (${formatMoney(aj.importe)}).` });
    }
  });

  if (mesObj.estado === 'activo') {
    const dias = diasRestantesParaCerrar(mesObj.mes);
    if (dias >= 0 && dias <= 5) {
      const faltan = dias === 0 ? 'Hoy es el último día' : dias === 1 ? 'Queda 1 día' : `Quedan ${dias} días`;
      alertas.push({ id: 'cuenta-regresiva-5', tipo: 'sistema', texto: `${faltan} para que termine ${mesLabel(mesObj.mes)} y cerrar el estado de cuenta.` });
      if (dias <= 2) {
        alertas.push({ id: 'cuenta-regresiva-2', tipo: 'sistema', texto: '¡Últimos días! No te olvides de registrar los gastos pendientes antes de cerrar el mes.' });
      }
    }
  }

  if (mesObj.detalleDisponible && mesObj.estado === 'cerrado' && mesObj.saldoFinalRegistrado !== undefined && saldoCalculado !== mesObj.saldoFinalRegistrado) {
    alertas.push({ id: 'saldo-mismatch', tipo: 'sistema', texto: `El saldo calculado (${formatMoney(saldoCalculado)}) no coincide con el saldo de cierre registrado (${formatMoney(mesObj.saldoFinalRegistrado)}). Revisar.` });
  }

  if (mesObj.detalleDisponible) {
    const pendientes = (mesObj.movimientos || []).filter((m) => m.pendienteAclaracion);
    if (pendientes.length) {
      const plural = pendientes.length === 1 ? 'gasto tiene' : 'gastos tienen';
      alertas.push({ id: 'conceptos-pendientes', tipo: 'sistema', texto: `${pendientes.length} ${plural} el concepto pendiente de aclarar.` });
    }
  }

  (mesObj.alertasPersonalizadas || []).forEach((a) => {
    alertas.push({ id: a.id, tipo: 'personalizada', texto: a.texto });
  });

  return alertas.filter((a) => !avisosDescartados.has(a.id));
}

// Panel de Alertas: solo existe en el mes en curso (no es historial, es
// operativo del momento). Campana con el número de alertas activas y, al
// lado, un "+" discreto para crear una directamente. Al tocar la campana
// se despliega la lista completa (hasta 2 filas visibles, con scroll si
// hay más), cada una en un recuadro fino con solo texto. Se descartan
// deslizando hacia la derecha: las de sistema se ocultan por esta vista,
// las personalizadas se borran de verdad (son datos que creó el usuario).
function renderAlertas(mesObj, saldoCalculado) {
  if (mesObj.estado !== 'activo') return '';
  const alertas = calcularAlertas(mesObj, saldoCalculado);

  let html = `
    <div class="alertas-encabezado">
      <button type="button" class="btn-alertas" data-action="toggle-alertas-panel" title="Alertas">
        🚨${alertas.length ? `<span class="btn-alertas__contador">${alertas.length}</span>` : ''}
      </button>
      <button type="button" class="btn-alerta-agregar" data-action="crear-alerta-rapida" title="Crear alerta">+</button>
    </div>`;

  if (alertasPanelAbierto) {
    if (alertas.length) {
      html += '<div class="alertas-panel">';
      alertas.forEach((a) => {
        html += `
          <div class="aviso-swipe aviso-swipe--fino" data-aviso-id="${a.id}" data-tipo="${a.tipo}">
            <div class="aviso-swipe__fondo">🗑️ <span class="aviso-swipe__fondo-texto">Eliminando alerta</span></div>
            <div class="aviso-swipe__frente aviso-swipe__frente--fino">${a.texto}</div>
          </div>`;
      });
      html += '</div>';
    } else {
      html += '<p class="alertas-panel__vacio">No hay alertas activas.</p>';
    }

    if (formAlertaAbierto) {
      html += `
        <form id="form-alerta" class="form-burbuja">
          <label>Texto de la alerta
            <input type="text" name="texto" required maxlength="140" placeholder="Ej: confirmar recibo de sanitaria">
          </label>
          <div class="acciones-form">
            <button type="submit">Agregar alerta</button>
            <button type="button" data-action="cerrar-form-alerta">Cancelar</button>
          </div>
        </form>`;
    }
  }

  return html;
}

// Tarjeta de Presupuesto: una tarjeta redondeada y centrada, sin distinguir
// "habitual" de "efectivo" — un solo número, que es directamente el
// importe del movimiento de ingreso del mes. En el mes activo (o un mes
// reabierto para corregir) se puede tocar para editarlo, y eso actualiza
// ese movimiento (recalculando el saldo solo); en un mes cerrado se ve
// igual pero no es tocable.
function renderTarjetaPresupuesto(movIngreso, editable) {
  let html = '<div class="tarjeta-presupuesto">';
  html += '<div class="tarjeta-presupuesto__label">PRESUPUESTO</div>';

  if (editable && editandoPresupuesto) {
    html += `
      <form id="form-presupuesto" class="form-presupuesto-inline">
        <input type="number" name="importe" min="1" step="1" value="${movIngreso ? movIngreso.importe : ''}" inputmode="numeric" autofocus>
        <div class="acciones-form">
          <button type="submit">Guardar</button>
          <button type="button" data-action="cancelar-editar-presupuesto">Cancelar</button>
        </div>
      </form>`;
  } else if (movIngreso) {
    html += `<div class="tarjeta-presupuesto__valor${editable ? ' tarjeta-presupuesto__valor--editable' : ''}"${editable ? ' data-action="editar-presupuesto"' : ''}>${formatMoney(movIngreso.importe)}</div>`;
  } else {
    html += `<div class="tarjeta-presupuesto__valor tarjeta-presupuesto__valor--vacio${editable ? ' tarjeta-presupuesto__valor--editable' : ''}"${editable ? ' data-action="editar-presupuesto"' : ''}>Sin cargar</div>`;
  }

  html += '</div>';
  return html;
}

function renderEstadoDeCuenta() {
  const cont = document.getElementById('estado-cuenta');
  const hogar = state.hogares[hogarSeleccionado];
  const mesObj = getMesActual();

  if (!mesObj) {
    cont.innerHTML = `
      <div class="aviso-vacio">
        <p><strong>${hogar.nombre}</strong> no tiene datos históricos cargados todavía.</p>
        <p>Antes de asumir un presupuesto inicial hace falta confirmarlo: no se va a inventar ni un presupuesto en $0 ni ningún gasto para este Hogar.</p>
      </div>`;
    return;
  }

  const editable = mesObj.estado === 'activo';
  const movs = mesObj.detalleDisponible ? movimientosConSaldo(mesObj) : [];
  const saldoCalculado = mesObj.detalleDisponible ? (movs.length ? movs[movs.length - 1].saldo : 0) : undefined;

  let html = renderEncabezadoMes(mesObj, hogar);

  const movIngreso = mesObj.detalleDisponible ? mesObj.movimientos.find((m) => m.tipo === 'ingreso') : null;
  html += renderTarjetaPresupuesto(movIngreso, editable);

  html += renderAlertas(mesObj, saldoCalculado);

  if (!mesObj.detalleDisponible) {
    html += `
      <div class="aviso">
        <p>Mes cerrado sin detalle de movimientos disponible. Solo se conoce el resumen:</p>
        <p><strong>Saldo final registrado: ${formatMoney(mesObj.saldoFinalRegistrado)}</strong></p>
      </div>`;
    cont.innerHTML = html;
    return;
  }

  html += `
    <table class="tabla-movimientos">
      <colgroup>
        <col class="col-fecha">
        <col class="col-concepto">
        <col class="col-gasto">
        <col class="col-saldo">
        ${editable ? '<col class="col-acciones">' : ''}
      </colgroup>
      <thead><tr><th>Fecha</th><th>Concepto</th><th>Gasto</th><th>Saldo</th>${editable ? '<th></th>' : ''}</tr></thead>
      <tbody>
        ${movs.map((m) => {
          const expandido = conceptosExpandidos.has(m.id);
          return `
          <tr class="${m.tipo === 'ingreso' ? 'fila-ingreso' : ''}${m.pendienteAclaracion ? ' fila-pendiente' : ''}">
            <td>${fechaCorta(m.fecha)}</td>
            <td class="celda-concepto${expandido ? ' celda-concepto--expandida' : ''}" data-action="toggle-concepto" data-id="${m.id}">${m.concepto}${m.pendienteAclaracion ? ' <span class="marca-pendiente" title="Falta aclarar el concepto real">⚠️</span>' : ''}</td>
            <td>${m.tipo === 'ingreso' ? '+' + formatMoney(m.importe) : formatMoney(m.importe)}</td>
            <td>${formatMoney(m.saldo)}</td>
            ${editable ? (m.tipo === 'ingreso'
              ? '<td class="celda-acciones"></td>'
              : `<td class="celda-acciones">
              <button type="button" class="btn-icono" data-action="editar-mov" data-id="${m.id}" title="Editar">✏️</button>
              <button type="button" class="btn-icono" data-action="eliminar-mov" data-id="${m.id}" title="Eliminar">🗑️</button>
            </td>`) : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="ayuda-tabla">Tocá un concepto para ver el texto completo.</p>
    <p class="saldo-actual">Saldo actual: <strong>${formatMoney(saldoCalculado)}</strong></p>`;

  if (editable) {
    const editando = editandoMovId ? mesObj.movimientos.find((m) => m.id === editandoMovId) : null;
    const abierto = formMovimientoAbierto || !!editando;
    if (abierto) {
      html += `
        <form id="form-movimiento" class="form-burbuja" data-editing-id="${editando ? editando.id : ''}">
          <label>Fecha
            <input type="date" name="fecha" required min="${primerDiaMes(mesObj.mes)}" max="${ultimoDiaMes(mesObj.mes)}"
              value="${editando ? editando.fecha : ''}">
          </label>
          <label>Concepto
            <input type="text" name="concepto" placeholder="Si no lo sabés, dejalo vacío: se guarda como CONCEPTO PENDIENTE"
              value="${editando ? (editando.pendienteAclaracion ? '' : editando.concepto) : ''}">
          </label>
          <label>Importe ($)
            <input type="number" name="importe" min="1" step="1" required value="${editando ? editando.importe : ''}">
          </label>
          <div class="acciones-form">
            <button type="submit">${editando ? 'Guardar cambios' : 'Agregar'}</button>
            <button type="button" data-action="cerrar-form-movimiento">Cancelar</button>
          </div>
        </form>`;
    } else {
      html += `<button type="button" class="burbuja-agregar" data-action="abrir-form-movimiento">+ Agregar gasto</button>`;
    }
  }

  // Los gastos previstos solo tienen sentido en el mes que está
  // transcurriendo: un mes cerrado no muestra esta sección. Plegado por
  // default (icono + texto + "+"), sin ocupar espacio de más; al tocarlo,
  // los previstos aparecen anidados debajo del botón grande.
  if (mesObj.estado === 'activo') {
    html += `
      <div class="previstos-encabezado burbuja-agregar burbuja-agregar--previsto">
        <button type="button" class="btn-previstos" data-action="toggle-previstos-panel">⚠️ Gastos previstos o pendientes</button>
        <button type="button" class="btn-previsto-agregar" data-action="previsto-agregar-rapido" title="Agregar previsto">+</button>
      </div>`;

    if (previstosPanelAbierto) {
      if (mesObj.gastosPrevistos && mesObj.gastosPrevistos.length) {
        html += '<ul class="previstos previstos-anidado">';
        mesObj.gastosPrevistos.forEach((p) => {
          html += `<li>
            <div class="previsto-mensaje">${p.concepto} — ${formatMoney(p.importeEstimado)}${p.nota ? ` <span class="nota">(${p.nota})</span>` : ''}</div>
            <div class="previsto-acciones">
              <button type="button" class="btn-confirmar-previsto" data-action="confirmar-previsto" data-id="${p.id}">✔ Confirmar gasto real</button>
              <button type="button" class="btn-icono" data-action="eliminar-previsto" data-id="${p.id}" title="Eliminar">🗑️</button>
            </div>`;
          if (confirmandoPrevistoId === p.id) {
            html += `
              <form id="form-confirmar-previsto" data-previsto-id="${p.id}" class="form-inline">
                <label>Fecha
                  <input type="date" name="fecha" required min="${primerDiaMes(mesObj.mes)}" max="${ultimoDiaMes(mesObj.mes)}">
                </label>
                <label>Importe real ($)
                  <input type="number" name="importe" min="1" step="1" required value="${p.importeEstimado}">
                </label>
                <div class="acciones-form">
                  <button type="submit">Confirmar</button>
                  <button type="button" data-action="cancelar-confirmar-previsto">Cancelar</button>
                </div>
              </form>`;
          }
          html += '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p class="aviso-previstos previstos-anidado">No hay gastos previstos cargados para este mes.</p>';
      }

      if (formPrevistoAbierto) {
        html += `
          <form id="form-previsto" class="form-burbuja previstos-anidado">
            <label>Concepto
              <input type="text" name="concepto" placeholder="Si no lo sabés, dejalo vacío: se guarda como CONCEPTO PENDIENTE">
            </label>
            <label>Importe estimado ($)
              <input type="number" name="importeEstimado" min="1" step="1" required>
            </label>
            <label>Nota (opcional)
              <input type="text" name="nota" placeholder="Ej: importe pendiente de confirmar">
            </label>
            <div class="acciones-form">
              <button type="submit">Agregar previsto</button>
              <button type="button" data-action="cerrar-form-previsto">Cancelar</button>
            </div>
          </form>`;
      }
    }
  }

  cont.innerHTML = html;
}

function onEstadoCuentaClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const mesObj = getMesActual();
  const hogar = state.hogares[hogarSeleccionado];

  switch (btn.dataset.action) {
    case 'descargar-pdf':
      try {
        generarPdfEstadoCuenta(hogar, mesObj);
      } catch (err) {
        console.error('Error al generar el PDF:', err);
        alert('No se pudo generar el PDF. Probá de nuevo; si persiste, avisá.');
      }
      break;

    case 'toggle-indicador':
      indicadorExpandido = !indicadorExpandido;
      if (indicadorTimer) clearTimeout(indicadorTimer);
      if (indicadorExpandido) {
        indicadorTimer = setTimeout(() => {
          indicadorExpandido = false;
          indicadorTimer = null;
          renderEstadoDeCuenta();
        }, 2200);
      }
      renderEstadoDeCuenta();
      break;

    case 'toggle-acciones-mes':
      accionesMesExpandido = !accionesMesExpandido;
      renderEstadoDeCuenta();
      break;

    case 'pedir-cerrar-mes':
      confirmandoAccionMes = 'cerrar';
      renderEstadoDeCuenta();
      break;

    case 'pedir-reabrir-mes':
      confirmandoAccionMes = 'reabrir';
      renderEstadoDeCuenta();
      break;

    case 'pedir-eliminar-mes-preparado':
      confirmandoAccionMes = 'eliminar-preparado';
      renderEstadoDeCuenta();
      break;

    case 'cancelar-accion-mes':
      confirmandoAccionMes = null;
      renderEstadoDeCuenta();
      break;

    case 'confirmar-accion-mes': {
      let mesPromovido = null;
      let mesEliminado = false;
      if (confirmandoAccionMes === 'cerrar') {
        mesPromovido = mesSiguientePreparado(hogar);
        cerrarMes(mesObj, hogar);
      } else if (confirmandoAccionMes === 'reabrir') {
        reabrirMes(mesObj);
      } else if (confirmandoAccionMes === 'eliminar-preparado') {
        mesEliminado = eliminarMesPreparado(hogar, mesObj.mes);
      }
      confirmandoAccionMes = null;
      accionesMesExpandido = false;
      editandoMovId = null;
      formMovimientoAbierto = false;
      confirmandoPrevistoId = null;
      if (mesPromovido) {
        // El mes preparado pasa a ser el mes en curso: saltamos a verlo.
        mesSeleccionado = mesPromovido.mes;
        prepararMesActivo();
      } else if (mesEliminado) {
        // El mes preparado que se estaba viendo ya no existe: volvemos al
        // mes activo (el "+" para preparar otro reaparece solo).
        const activo = Object.values(hogar.meses).find((m) => m.estado === 'activo');
        mesSeleccionado = activo ? activo.mes : null;
      }
      persistirYRenderizar();
      renderSelectorMeses();
      break;
    }

    case 'toggle-concepto':
      if (conceptosExpandidos.has(btn.dataset.id)) {
        conceptosExpandidos.delete(btn.dataset.id);
      } else {
        conceptosExpandidos.add(btn.dataset.id);
      }
      renderEstadoDeCuenta();
      break;

    case 'toggle-alertas-panel':
      alertasPanelAbierto = !alertasPanelAbierto;
      formAlertaAbierto = false;
      renderEstadoDeCuenta();
      break;

    case 'cerrar-form-alerta':
      formAlertaAbierto = false;
      renderEstadoDeCuenta();
      break;

    case 'crear-alerta-rapida':
      alertasPanelAbierto = true;
      formAlertaAbierto = true;
      renderEstadoDeCuenta();
      break;

    case 'editar-presupuesto':
      editandoPresupuesto = true;
      renderEstadoDeCuenta();
      break;

    case 'cancelar-editar-presupuesto':
      editandoPresupuesto = false;
      renderEstadoDeCuenta();
      break;

    case 'abrir-form-movimiento':
      formMovimientoAbierto = true;
      renderEstadoDeCuenta();
      break;

    case 'cerrar-form-movimiento':
      formMovimientoAbierto = false;
      editandoMovId = null;
      renderEstadoDeCuenta();
      break;

    case 'editar-mov':
      editandoMovId = btn.dataset.id;
      formMovimientoAbierto = true;
      confirmandoPrevistoId = null;
      renderEstadoDeCuenta();
      break;

    case 'eliminar-mov': {
      const mov = mesObj.movimientos.find((m) => m.id === btn.dataset.id);
      if (mov && confirm(`¿Eliminar el movimiento "${mov.concepto}" (${formatMoney(mov.importe)})? El saldo de los movimientos posteriores se recalcula solo.`)) {
        eliminarMovimiento(mesObj, btn.dataset.id);
        if (editandoMovId === btn.dataset.id) {
          editandoMovId = null;
          formMovimientoAbierto = false;
        }
        persistirYRenderizar();
      }
      break;
    }

    case 'toggle-previstos-panel':
      previstosPanelAbierto = !previstosPanelAbierto;
      formPrevistoAbierto = false;
      renderEstadoDeCuenta();
      break;

    case 'previsto-agregar-rapido':
      previstosPanelAbierto = true;
      formPrevistoAbierto = true;
      renderEstadoDeCuenta();
      break;

    case 'cerrar-form-previsto':
      formPrevistoAbierto = false;
      renderEstadoDeCuenta();
      break;

    case 'confirmar-previsto':
      confirmandoPrevistoId = btn.dataset.id;
      editandoMovId = null;
      renderEstadoDeCuenta();
      break;

    case 'cancelar-confirmar-previsto':
      confirmandoPrevistoId = null;
      renderEstadoDeCuenta();
      break;

    case 'eliminar-previsto': {
      const previsto = mesObj.gastosPrevistos.find((p) => p.id === btn.dataset.id);
      if (previsto && confirm(`¿Eliminar el gasto previsto "${previsto.concepto}"?`)) {
        eliminarGastoPrevisto(mesObj, btn.dataset.id);
        persistirYRenderizar();
      }
      break;
    }
  }
}

function onEstadoCuentaSubmit(e) {
  e.preventDefault();
  const mesObj = getMesActual();
  const form = e.target;

  if (form.id === 'form-presupuesto') {
    const importe = Number(form.importe.value);
    if (!importe || importe <= 0) {
      alert('El importe tiene que ser mayor a $0.');
      return;
    }
    const movIngreso = mesObj.movimientos.find((m) => m.tipo === 'ingreso');
    if (movIngreso) {
      actualizarMovimiento(mesObj, movIngreso.id, { importe });
    } else {
      agregarMovimiento(mesObj, { fecha: primerDiaMes(mesObj.mes), concepto: 'PRESUPUESTO', tipo: 'ingreso', importe });
    }
    editandoPresupuesto = false;
    persistirYRenderizar();
    return;
  }

  if (form.id === 'form-movimiento') {
    const fecha = form.fecha.value;
    const concepto = form.concepto.value;
    const importe = Number(form.importe.value);

    if (!fechaPerteneceAlMes(fecha, mesObj.mes)) {
      alert(`La fecha tiene que estar dentro de ${mesLabel(mesObj.mes)} (del 1 al último día del mes).`);
      return;
    }
    if (!importe || importe <= 0) {
      alert('El importe tiene que ser mayor a $0.');
      return;
    }

    // Todo lo que se carga desde este formulario es gasto real: el
    // ingreso (Presupuesto) se edita aparte, tocando su propia tarjeta.
    const editingId = form.dataset.editingId;
    if (editingId) {
      actualizarMovimiento(mesObj, editingId, { fecha, tipo: 'gasto_real', concepto, importe });
      editandoMovId = null;
    } else {
      agregarMovimiento(mesObj, { fecha, tipo: 'gasto_real', concepto, importe });
    }
    formMovimientoAbierto = false;
    persistirYRenderizar();
  }

  if (form.id === 'form-previsto') {
    const concepto = form.concepto.value;
    const importeEstimado = Number(form.importeEstimado.value);
    const nota = form.nota.value;

    if (!importeEstimado || importeEstimado <= 0) {
      alert('El importe estimado tiene que ser mayor a $0.');
      return;
    }

    agregarGastoPrevisto(mesObj, { concepto, importeEstimado, nota });
    formPrevistoAbierto = false;
    persistirYRenderizar();
  }

  if (form.id === 'form-alerta') {
    const resultado = agregarAlertaPersonalizada(mesObj, form.texto.value);
    if (resultado === 'limite') {
      alert('Ya hay 10 alertas cargadas (el máximo). Descartá o borrá alguna antes de agregar una nueva.');
      return;
    }
    formAlertaAbierto = false;
    persistirYRenderizar();
  }

  if (form.id === 'form-confirmar-previsto') {
    const fecha = form.fecha.value;
    const importe = Number(form.importe.value);

    if (!fechaPerteneceAlMes(fecha, mesObj.mes)) {
      alert(`La fecha tiene que estar dentro de ${mesLabel(mesObj.mes)} (del 1 al último día del mes).`);
      return;
    }
    if (!importe || importe <= 0) {
      alert('El importe tiene que ser mayor a $0.');
      return;
    }

    confirmarGastoPrevisto(mesObj, form.dataset.previstoId, { fecha, importe });
    confirmandoPrevistoId = null;
    persistirYRenderizar();
  }
}

// Exportar/Importar: red de seguridad manual entre dispositivos (el
// celular es la fuente de la verdad del día a día; la PC recibe
// importaciones cada tanto). Mismo lenguaje visual que el candado de
// cerrar estado de cuenta: ícono simple que se despliega al tocarlo, y un
// mensaje de confirmar/cancelar antes de ejecutar la acción, para evitar
// que un toque accidental borre datos.
function renderRespaldo() {
  const cont = document.getElementById('respaldo');
  if (!cont) return;
  let html = '<div class="respaldo-caja">';

  if (respaldoAbierto === 'exportar') {
    html += `
      <div class="confirmar-accion-mes">
        <span>📤 ¿Descargar un respaldo completo (todos los Hogares, Finanzas y meses guardados en este dispositivo)?</span>
        <button type="button" class="btn-confirmar btn-confirmar--azul" data-action="confirmar-exportar">Confirmar</button>
        <button type="button" class="btn-cancelar" data-action="cancelar-respaldo">Cancelar</button>
      </div>`;
  } else if (respaldoAbierto === 'importar') {
    if (archivoImportarNombre) {
      html += `
        <div class="confirmar-accion-mes">
          <span>📥 ¿Reemplazar TODOS los datos guardados en este dispositivo por el contenido de "${archivoImportarNombre}"? Esta acción no se puede deshacer.</span>
          <button type="button" class="btn-confirmar" data-action="confirmar-importar">Confirmar</button>
          <button type="button" class="btn-cancelar" data-action="cancelar-respaldo">Cancelar</button>
        </div>`;
    } else {
      html += `
        <div class="respaldo-panel">
          <span class="respaldo-panel__label">📥 Importar</span>
          <label class="btn-pdf-mini respaldo-elegir-archivo">
            Elegir archivo
            <input type="file" id="input-importar-archivo" accept="application/json,.json" hidden>
          </label>
          <button type="button" class="btn-icono-mes" data-action="cancelar-respaldo" title="Cancelar">✕</button>
        </div>`;
    }
  } else {
    html += `
      <button type="button" class="btn-respaldo-icono" data-action="abrir-exportar" title="Exportar respaldo">📤</button>
      <button type="button" class="btn-respaldo-icono" data-action="abrir-importar" title="Importar respaldo">📥</button>`;
  }

  html += '</div>';
  cont.innerHTML = html;

  const inputArchivo = document.getElementById('input-importar-archivo');
  if (inputArchivo) inputArchivo.addEventListener('change', onArchivoImportarSeleccionado);
}

function onArchivoImportarSeleccionado(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    archivoImportarTexto = lector.result;
    archivoImportarNombre = archivo.name;
    renderRespaldo();
  };
  lector.onerror = () => {
    alert('No se pudo leer el archivo elegido. Probá de nuevo.');
  };
  lector.readAsText(archivo);
}

function onRespaldoClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  switch (btn.dataset.action) {
    case 'abrir-exportar':
      respaldoAbierto = 'exportar';
      renderRespaldo();
      break;

    case 'abrir-importar':
      respaldoAbierto = 'importar';
      archivoImportarTexto = null;
      archivoImportarNombre = null;
      renderRespaldo();
      break;

    case 'cancelar-respaldo':
      respaldoAbierto = null;
      archivoImportarTexto = null;
      archivoImportarNombre = null;
      renderRespaldo();
      break;

    case 'confirmar-exportar':
      try {
        descargarArchivo(nombreArchivoRespaldo(), JSON.stringify(state, null, 2), 'application/json');
      } catch (err) {
        console.error('Error al exportar el respaldo:', err);
        alert('No se pudo generar el respaldo. Probá de nuevo.');
      }
      respaldoAbierto = null;
      renderRespaldo();
      break;

    case 'confirmar-importar': {
      let nuevoEstado;
      try {
        nuevoEstado = JSON.parse(archivoImportarTexto);
      } catch (err) {
        alert('El archivo elegido no es un JSON válido. No se importó nada.');
        break;
      }
      if (!esRespaldoValido(nuevoEstado)) {
        alert('El archivo elegido no tiene el formato de un respaldo de esta app. No se importó nada.');
        break;
      }

      state = nuevoEstado;
      saveState(state);
      archivoImportarTexto = null;
      archivoImportarNombre = null;
      respaldoAbierto = null;

      const hogaresDisponibles = getHogaresHabilitados(state);
      hogarSeleccionado = hogaresDisponibles.length ? hogaresDisponibles[0].id : Object.keys(state.hogares)[0];
      const meses = getMesesOrdenados(state.hogares[hogarSeleccionado]);
      const activo = meses.find((m) => m.estado === 'activo');
      mesSeleccionado = activo ? activo.mes : meses.length ? meses[meses.length - 1].mes : null;
      prepararMesActivo();
      resetEstadosDeInteraccion();

      renderSelectorHogares();
      renderSelectorMeses();
      renderEstadoDeCuenta();
      renderRespaldo();
      alert('Importación completa: los datos de este dispositivo fueron reemplazados por el archivo elegido.');
      break;
    }
  }
}

// Gesto de deslizar hacia la derecha para descartar una alerta. No se arma
// el "modo arrastre" hasta que el movimiento sea claramente horizontal, así
// un toque simple sobre la alerta sigue funcionando como un click normal.
const UMBRAL_SWIPE_DESCARTAR = 70;

function onAvisoPointerDown(e) {
  const frente = e.target.closest('.aviso-swipe__frente');
  if (!frente) return;
  const contenedor = frente.closest('.aviso-swipe');
  swipeEstado = {
    pointerId: e.pointerId,
    id: contenedor.dataset.avisoId,
    tipo: contenedor.dataset.tipo || 'sistema',
    startX: e.clientX,
    startY: e.clientY,
    dx: 0,
    elFrente: frente,
    arrastrando: false,
  };
  frente.addEventListener('pointermove', onAvisoPointerMove);
  frente.addEventListener('pointerup', onAvisoPointerUp);
  frente.addEventListener('pointercancel', onAvisoPointerUp);
}

function onAvisoPointerMove(e) {
  if (!swipeEstado || e.pointerId !== swipeEstado.pointerId) return;
  const dx = e.clientX - swipeEstado.startX;
  const dy = e.clientY - swipeEstado.startY;

  if (!swipeEstado.arrastrando) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) {
      // Fue un scroll vertical, no un swipe: se cancela el seguimiento.
      swipeEstado = null;
      return;
    }
    swipeEstado.arrastrando = true;
    swipeEstado.elFrente.setPointerCapture(e.pointerId);
    swipeEstado.elFrente.style.transition = 'none';
  }

  const dxClamped = Math.max(0, dx);
  swipeEstado.dx = dxClamped;
  swipeEstado.elFrente.style.transform = `translateX(${dxClamped}px)`;
}

function onAvisoPointerUp(e) {
  if (!swipeEstado || e.pointerId !== swipeEstado.pointerId) return;
  const { elFrente, arrastrando, dx, id, tipo } = swipeEstado;
  elFrente.removeEventListener('pointermove', onAvisoPointerMove);
  elFrente.removeEventListener('pointerup', onAvisoPointerUp);
  elFrente.removeEventListener('pointercancel', onAvisoPointerUp);

  if (arrastrando) {
    elFrente.style.transition = 'transform 0.2s ease';
    if (dx > UMBRAL_SWIPE_DESCARTAR) {
      if (tipo === 'personalizada') {
        // Es una alerta creada por el usuario: deslizar la borra de verdad.
        const mesObj = getMesActual();
        if (mesObj) {
          eliminarAlertaPersonalizada(mesObj, id);
          saveState(state);
        }
      } else {
        // Es una alerta del sistema (calculada): deslizar solo la oculta
        // de esta vista, no borra ningún dato.
        avisosDescartados.add(id);
      }
      renderEstadoDeCuenta();
    } else {
      elFrente.style.transform = 'translateX(0)';
    }
  }
  swipeEstado = null;
}

document.addEventListener('DOMContentLoaded', init);
