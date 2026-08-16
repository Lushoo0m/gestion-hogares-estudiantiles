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
let accionesMesExpandido = false;
let confirmandoAccionMes = null; // 'cerrar' | 'reabrir' | null
let indicadorExpandido = false;
let indicadorTimer = null;
let respaldoAbierto = null; // 'exportar' | 'importar' | null
let archivoImportarTexto = null;
let archivoImportarNombre = null;
let avisoAbiertoId = null; // id del aviso/recordatorio con el mensaje desplegado (uno solo a la vez)
let avisosDescartados = new Set(); // ids de avisos deslizados hacia la derecha en esta vista
let swipeEstado = null; // seguimiento del gesto de deslizar en curso

function init() {
  const meses = getMesesOrdenados(state.hogares[hogarSeleccionado]);
  const activo = meses.find((m) => m.estado === 'activo');
  mesSeleccionado = activo ? activo.mes : meses.length ? meses[meses.length - 1].mes : null;

  renderSelectorHogares();
  renderSelectorMeses();
  renderEstadoDeCuenta();
  renderRespaldo();

  document.getElementById('estado-cuenta').addEventListener('click', onEstadoCuentaClick);
  document.getElementById('estado-cuenta').addEventListener('submit', onEstadoCuentaSubmit);
  document.getElementById('estado-cuenta').addEventListener('pointerdown', onAvisoPointerDown);
  document.getElementById('respaldo').addEventListener('click', onRespaldoClick);
}

function resetEstadosDeInteraccion() {
  editandoMovId = null;
  confirmandoPrevistoId = null;
  conceptosExpandidos.clear();
  formMovimientoAbierto = false;
  formPrevistoAbierto = false;
  accionesMesExpandido = false;
  confirmandoAccionMes = null;
  indicadorExpandido = false;
  avisoAbiertoId = null;
  avisosDescartados.clear();
  if (indicadorTimer) {
    clearTimeout(indicadorTimer);
    indicadorTimer = null;
  }
}

function renderSelectorHogares() {
  const cont = document.getElementById('selector-hogares');
  cont.innerHTML = '';
  getHogaresHabilitados(state).forEach((hogar) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (hogar.id === hogarSeleccionado ? ' tab--activo' : '');
    btn.textContent = hogar.nombre;
    btn.addEventListener('click', () => {
      hogarSeleccionado = hogar.id;
      const meses = getMesesOrdenados(state.hogares[hogarSeleccionado]);
      const activo = meses.find((m) => m.estado === 'activo');
      mesSeleccionado = activo ? activo.mes : meses.length ? meses[meses.length - 1].mes : null;
      resetEstadosDeInteraccion();
      renderSelectorHogares();
      renderSelectorMeses();
      renderEstadoDeCuenta();
    });
    cont.appendChild(btn);
  });
}

// Tira fija de los 12 meses del ciclo (jun-jul-ago-...-may). Los meses sin
// estado de cuenta creado todavía se muestran deshabilitados, sin inventar
// datos. Al seleccionar un mes existente, su chip se expande con el nombre
// completo y se colorea según esté activo (editable) o cerrado (solo lectura).
function renderSelectorMeses() {
  const cont = document.getElementById('selector-meses');
  cont.innerHTML = '';
  const hogar = state.hogares[hogarSeleccionado];
  const ciclo = cicloMesesHogar(hogar);

  if (!ciclo.length) {
    cont.innerHTML = '<p class="aviso">Este Hogar todavía no tiene meses cargados.</p>';
    return;
  }

  ciclo.forEach((mesKey) => {
    const mesObj = hogar.meses[mesKey];
    const btn = document.createElement('button');

    if (!mesObj) {
      btn.className = 'chip-mes chip-mes--vacio';
      btn.disabled = true;
      btn.innerHTML = `<span class="chip-mes__codigo">${mesAbrev(mesKey)}</span>`;
      cont.appendChild(btn);
      return;
    }

    const seleccionado = mesKey === mesSeleccionado;
    const bloqueado = mesObj.estado === 'cerrado';
    // El candado solo se muestra en los meses cerrados (bloqueados): un mes
    // activo se ve "libre", sin candado, solo con su nombre.
    const candado = bloqueado ? '<span class="chip-mes__candado">🔒</span>' : '';
    btn.className = 'chip-mes' + (seleccionado ? ' chip-mes--seleccionado' : '') + (bloqueado ? ' chip-mes--bloqueado' : ' chip-mes--activo');
    btn.innerHTML = seleccionado
      ? `${candado}<span class="chip-mes__nombre">${mesLabel(mesKey).toUpperCase()}</span>`
      : `<span class="chip-mes__codigo">${mesAbrev(mesKey)}</span>${candado}`;

    btn.addEventListener('click', () => {
      mesSeleccionado = mesKey;
      resetEstadosDeInteraccion();
      renderSelectorMeses();
      renderEstadoDeCuenta();
    });
    cont.appendChild(btn);
  });
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
// tocar de nuevo, y ahí aparecen el PDF y el lápiz para reabrir.
function renderEncabezadoMes(mesObj) {
  let html = '<div class="estado-mes-header">';

  if (confirmandoAccionMes) {
    const esCerrar = confirmandoAccionMes === 'cerrar';
    const pregunta = esCerrar
      ? '¿Cerrar este estado de cuenta? Va a quedar de solo lectura.'
      : '¿Reabrir para corregir un error?';
    html += `
      <div class="confirmar-accion-mes">
        <span>${pregunta}</span>
        <button type="button" class="btn-confirmar" data-action="confirmar-accion-mes">Confirmar</button>
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

// Ajustes de presupuesto y recordatorios de gastos fijos, minimalistas:
// solo íconos por defecto. Tocar un ícono despliega su mensaje debajo (y
// cierra cualquier otro que estuviera abierto — uno solo a la vez).
// Deslizar el mensaje hacia la derecha lo descarta de esta vista (no borra
// ningún dato: un ajuste sigue siendo parte del mes, un gasto fijo sigue
// pendiente; solo se oculta la notificación hasta cambiar de mes).
function renderAvisosYRecordatorios(mesObj, gastosFijosPendientes) {
  const items = [];

  (mesObj.ajustes || []).forEach((aj, i) => {
    const id = `ajuste-${i}`;
    if (avisosDescartados.has(id)) return;
    items.push({ id, icono: '⚠️', tipo: 'aviso', mensaje: `${aj.concepto}: ${formatMoney(aj.importe)}` });
  });

  if (mesObj.estado === 'activo') {
    gastosFijosPendientes.forEach((gf) => {
      const id = `recordatorio-${gf.id}`;
      if (avisosDescartados.has(id)) return;
      items.push({
        id,
        icono: '🔔',
        tipo: 'recordatorio',
        gfId: gf.id,
        mensaje: `Gasto fijo mensual sin confirmar todavía — ${gf.concepto} (${formatMoney(gf.importe)}).${gf.nota ? ` ${gf.nota}` : ''}`,
      });
    });
  }

  if (!items.length) return '';

  let html = '<div class="avisos-iconos">';
  items.forEach((it) => {
    html += `<button type="button" class="btn-aviso-icono${it.id === avisoAbiertoId ? ' btn-aviso-icono--activo' : ''}" data-action="toggle-aviso" data-aviso-id="${it.id}" title="${it.tipo === 'recordatorio' ? 'Recordatorio' : 'Aviso'}">${it.icono}</button>`;
  });
  html += '</div>';

  const abierto = items.find((it) => it.id === avisoAbiertoId);
  if (abierto) {
    html += `
      <div class="aviso-swipe" data-aviso-id="${abierto.id}">
        <div class="aviso-swipe__fondo">🗑️ Deslizar para descartar</div>
        <div class="aviso-swipe__frente">
          <span>${abierto.icono} ${abierto.mensaje}</span>
          ${abierto.tipo === 'recordatorio' ? `<button type="button" class="btn-link" data-action="registrar-fijo" data-gf-id="${abierto.gfId}">Registrar ahora</button>` : ''}
        </div>
      </div>`;
  }

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

  const normalizarConcepto = (s) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').trim();
  const gastosFijosPendientes = (hogar.gastosFijos || []).filter(
    (gf) => gf.activo && !mesObj.movimientos.some((m) => normalizarConcepto(m.concepto) === normalizarConcepto(gf.concepto))
  );

  let html = renderEncabezadoMes(mesObj);

  html += `<div class="resumen">
    <div><span class="etiqueta">Presupuesto habitual</span><span class="valor">${formatMoney(mesObj.presupuesto)}</span></div>`;
  if (mesObj.presupuestoEfectivo !== mesObj.presupuesto) {
    html += `<div><span class="etiqueta">Presupuesto efectivo</span><span class="valor">${formatMoney(mesObj.presupuestoEfectivo)}</span></div>`;
  }
  html += `</div>`;

  html += renderAvisosYRecordatorios(mesObj, gastosFijosPendientes);

  if (!mesObj.detalleDisponible) {
    html += `
      <div class="aviso">
        <p>Mes cerrado sin detalle de movimientos disponible. Solo se conoce el resumen:</p>
        <p><strong>Saldo final registrado: ${formatMoney(mesObj.saldoFinalRegistrado)}</strong></p>
      </div>`;
    cont.innerHTML = html;
    return;
  }

  const movs = movimientosConSaldo(mesObj);
  const editable = mesObj.estado === 'activo';
  const saldoCalculado = movs.length ? movs[movs.length - 1].saldo : 0;

  if (mesObj.saldoFinalRegistrado !== undefined && !editable && saldoCalculado !== mesObj.saldoFinalRegistrado) {
    html += `
      <div class="aviso aviso--alerta">
        <p>⚠️ El saldo calculado a partir de los movimientos (${formatMoney(saldoCalculado)}) no coincide con el saldo de cierre del documento original (${formatMoney(mesObj.saldoFinalRegistrado)}). Revisar antes de dar por bueno este mes.</p>
      </div>`;
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
            ${editable ? `<td class="celda-acciones">
              <button type="button" class="btn-icono" data-action="editar-mov" data-id="${m.id}" title="Editar">✏️</button>
              <button type="button" class="btn-icono" data-action="eliminar-mov" data-id="${m.id}" title="Eliminar">🗑️</button>
            </td>` : ''}
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
          <label>Tipo
            <select name="tipo">
              <option value="gasto_real" ${editando && editando.tipo === 'gasto_real' ? 'selected' : ''}>Gasto real</option>
              <option value="ingreso" ${editando && editando.tipo === 'ingreso' ? 'selected' : ''}>Ingreso</option>
            </select>
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
  // transcurriendo: un mes cerrado no muestra esta sección.
  if (mesObj.estado === 'activo') {
    html += '<div class="caja-previstos">';
    html += '<div class="caja-previstos__titulo">⚠️ Gastos previstos</div>';

    if (mesObj.gastosPrevistos && mesObj.gastosPrevistos.length) {
      html += '<ul class="previstos">';
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
      html += '<p class="aviso-previstos">No hay gastos previstos cargados para este mes.</p>';
    }

    if (formPrevistoAbierto) {
      html += `
        <form id="form-previsto" class="form-burbuja">
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
    } else {
      html += `<button type="button" class="burbuja-agregar burbuja-agregar--previsto" data-action="abrir-form-previsto">+ Agregar previsto</button>`;
    }

    html += '</div>';
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

    case 'cancelar-accion-mes':
      confirmandoAccionMes = null;
      renderEstadoDeCuenta();
      break;

    case 'confirmar-accion-mes':
      if (confirmandoAccionMes === 'cerrar') {
        cerrarMes(mesObj);
      } else if (confirmandoAccionMes === 'reabrir') {
        reabrirMes(mesObj);
      }
      confirmandoAccionMes = null;
      accionesMesExpandido = false;
      editandoMovId = null;
      formMovimientoAbierto = false;
      confirmandoPrevistoId = null;
      persistirYRenderizar();
      break;

    case 'toggle-concepto':
      if (conceptosExpandidos.has(btn.dataset.id)) {
        conceptosExpandidos.delete(btn.dataset.id);
      } else {
        conceptosExpandidos.add(btn.dataset.id);
      }
      renderEstadoDeCuenta();
      break;

    case 'toggle-aviso':
      avisoAbiertoId = avisoAbiertoId === btn.dataset.avisoId ? null : btn.dataset.avisoId;
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

    case 'registrar-fijo': {
      const gf = hogar.gastosFijos.find((g) => g.id === btn.dataset.gfId);
      if (!gf) break;
      editandoMovId = null;
      formMovimientoAbierto = true;
      avisoAbiertoId = null;
      renderEstadoDeCuenta();
      const form = document.getElementById('form-movimiento');
      if (form) {
        form.tipo.value = 'gasto_real';
        form.concepto.value = gf.concepto;
        form.importe.value = gf.importe;
        form.fecha.focus();
      }
      break;
    }

    case 'abrir-form-previsto':
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

  if (form.id === 'form-movimiento') {
    const fecha = form.fecha.value;
    const tipo = form.tipo.value;
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

    const editingId = form.dataset.editingId;
    if (editingId) {
      actualizarMovimiento(mesObj, editingId, { fecha, tipo, concepto, importe });
      editandoMovId = null;
    } else {
      agregarMovimiento(mesObj, { fecha, tipo, concepto, importe });
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
        <span>📤 ¿Descargar un respaldo completo (todos los Hogares y meses guardados en este dispositivo)?</span>
        <button type="button" class="btn-confirmar" data-action="confirmar-exportar">Confirmar</button>
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

// Gesto de deslizar hacia la derecha para descartar un aviso/recordatorio
// desplegado. No se arma el "modo arrastre" hasta que el movimiento sea
// claramente horizontal, así un toque simple (por ejemplo, en el botón
// "Registrar ahora") sigue funcionando como un click normal.
const UMBRAL_SWIPE_DESCARTAR = 70;

function onAvisoPointerDown(e) {
  const frente = e.target.closest('.aviso-swipe__frente');
  if (!frente) return;
  const contenedor = frente.closest('.aviso-swipe');
  swipeEstado = {
    pointerId: e.pointerId,
    id: contenedor.dataset.avisoId,
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
  const { elFrente, arrastrando, dx, id } = swipeEstado;
  elFrente.removeEventListener('pointermove', onAvisoPointerMove);
  elFrente.removeEventListener('pointerup', onAvisoPointerUp);
  elFrente.removeEventListener('pointercancel', onAvisoPointerUp);

  if (arrastrando) {
    elFrente.style.transition = 'transform 0.2s ease';
    if (dx > UMBRAL_SWIPE_DESCARTAR) {
      avisosDescartados.add(id);
      if (avisoAbiertoId === id) avisoAbiertoId = null;
      renderEstadoDeCuenta();
    } else {
      elFrente.style.transform = 'translateX(0)';
    }
  }
  swipeEstado = null;
}

document.addEventListener('DOMContentLoaded', init);
