// Finanzas: gestor personal paralelo a los Hogares, en la misma app pero
// completamente separado. A diferencia de un Hogar, acá no hay "mes en
// curso" que se cierre: es un registro continuo, siempre editable, y los
// meses del selector son solo para verlo ordenado (surgen solos de las
// fechas cargadas, nunca hay que "crearlos").
//
// Reutiliza a propósito varias funciones de datos que ya usan los Hogares
// (agregarMovimiento, movimientosConSaldo, agregarGastoPrevisto, etc.):
// solo tocan .movimientos/.gastosPrevistos, así que sirven igual pasándoles
// state.finanzas en vez de un mesObj de Hogar.

let finMesSeleccionado = null;
let finEditandoMovId = null;
let finFormMovimientoAbierto = false;
let finFormPrevistoAbierto = false;
let finPrevistosPanelAbierto = false; // panel de Gastos previstos (plegado por default)
let finConfirmandoPrevistoId = null;
let finConceptosExpandidos = new Set();
let finFormInversionAbierto = false;
let finEditandoInversionId = null;
let finInversionesAbierto = false; // panel de Inversiones: independiente, plegado por default
let finAlertasPanelAbierto = false;
let finFormAlertaAbierto = false;
let finColorAlertaElegido = 'amarillo';
let finSwipeEstado = null;

function initFinanzas() {
  document.getElementById('finanzas-selector-meses').addEventListener('click', onFinSelectorMesesClick);
  document.getElementById('finanzas-cuenta').addEventListener('click', onFinCuentaClick);
  document.getElementById('finanzas-cuenta').addEventListener('submit', onFinCuentaSubmit);
  document.getElementById('finanzas-cuenta').addEventListener('pointerdown', onFinAvisoPointerDown);
  // Inversiones vive en su propia sección, separada de la tarjeta de saldo
  // (mismo espíritu que Exportar/Importar en #respaldo), pero reutiliza los
  // mismos handlers de click/submit: solo miran el data-action/form.id, no
  // les importa desde qué contenedor los dispara el evento.
  document.getElementById('finanzas-inversiones').addEventListener('click', onFinCuentaClick);
  document.getElementById('finanzas-inversiones').addEventListener('submit', onFinCuentaSubmit);
}

function resetEstadosDeInteraccionFinanzas() {
  finEditandoMovId = null;
  finConfirmandoPrevistoId = null;
  finConceptosExpandidos.clear();
  finFormMovimientoAbierto = false;
  finFormPrevistoAbierto = false;
  finPrevistosPanelAbierto = false;
  finFormInversionAbierto = false;
  finEditandoInversionId = null;
  finInversionesAbierto = false;
  finAlertasPanelAbierto = false;
  finFormAlertaAbierto = false;
}

function persistirYRenderizarFinanzas() {
  saveState(state);
  renderFinanzas();
}

function renderFinanzas() {
  const fin = state.finanzas;
  if (asegurarPrevistosRecurrentesFinanzas(fin)) saveState(state);
  const meses = getMesesFinanzasOrdenados(fin);
  if (!finMesSeleccionado || !meses.includes(finMesSeleccionado)) {
    finMesSeleccionado = meses[meses.length - 1];
  }
  renderFinSelectorMeses(meses);
  renderFinCuenta(fin);
  renderFinInversionesSeccion(fin);
}

// Chips de mes, mismo lenguaje visual que los Hogares pero sin candado ni
// "+": todos los meses de Finanzas quedan siempre editables.
function renderFinSelectorMeses(meses) {
  const cont = document.getElementById('finanzas-selector-meses');
  let html = '';
  meses.forEach((mesKey) => {
    const seleccionado = mesKey === finMesSeleccionado;
    const contenido = seleccionado ? mesLabel(mesKey).toUpperCase() : mesAbrev(mesKey);
    html += `<button type="button" class="chip-mes chip-mes--activo${seleccionado ? ' chip-mes--seleccionado' : ''}" data-action="fin-seleccionar-mes" data-mes="${mesKey}">${contenido}</button>`;
  });
  cont.innerHTML = html;
}

function renderFinCuenta(fin) {
  const cont = document.getElementById('finanzas-cuenta');
  const todos = movimientosConSaldo(fin);
  const saldoTotal = todos.length ? todos[todos.length - 1].saldo : 0;
  const movsDelMes = todos.filter((m) => m.fecha.slice(0, 7) === finMesSeleccionado);
  const pendienteMama = (fin.movimientos || [])
    .filter((m) => m.categoria === 'mama' && m.tipo !== 'ingreso')
    .reduce((total, m) => total + m.importe, 0);

  let html = `
    <div class="tarjeta-presupuesto">
      <div class="tarjeta-presupuesto__label">SALDO TOTAL</div>
      <div class="tarjeta-presupuesto__valor">${formatMoney(saldoTotal)}</div>
    </div>`;

  if (pendienteMama > 0) {
    html += `<p class="aviso-mama">👩 Pendiente con MAMÁ: <strong>${formatMoney(pendienteMama)}</strong></p>`;
  }

  html += renderFinAlertas(fin);

  if (movsDelMes.length) {
    html += `
      <table class="tabla-movimientos">
        <colgroup>
          <col class="col-fecha">
          <col class="col-concepto">
          <col class="col-gasto">
          <col class="col-saldo">
          <col class="col-acciones">
        </colgroup>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Saldo</th><th></th></tr></thead>
        <tbody>
          ${movsDelMes.map((m) => {
            const expandido = finConceptosExpandidos.has(m.id);
            return `
            <tr class="${m.tipo === 'ingreso' ? 'fila-ingreso' : ''}${m.pendienteAclaracion ? ' fila-pendiente' : ''}">
              <td>${fechaCorta(m.fecha)}</td>
              <td class="celda-concepto${expandido ? ' celda-concepto--expandida' : ''}" data-action="fin-toggle-concepto" data-id="${m.id}">${m.concepto}${m.categoria === 'mama' ? ' <span class="marca-mama" title="Gasto a nombre de MAMÁ, pendiente de que ella lo arregle">👩</span>' : ''}${m.pendienteAclaracion ? ' <span class="marca-pendiente" title="Falta aclarar el concepto real">⚠️</span>' : ''}</td>
              <td>${m.tipo === 'ingreso' ? '+' + formatMoney(m.importe) : '-' + formatMoney(m.importe)}</td>
              <td>${formatMoney(m.saldo)}</td>
              <td class="celda-acciones">
                <button type="button" class="btn-icono" data-action="fin-editar-mov" data-id="${m.id}" title="Editar">✏️</button>
                <button type="button" class="btn-icono" data-action="fin-eliminar-mov" data-id="${m.id}" title="Eliminar">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="ayuda-tabla">Tocá un concepto para ver el texto completo.</p>`;
  } else {
    html += `<p class="aviso-previstos">Sin movimientos en ${mesLabel(finMesSeleccionado)}.</p>`;
  }

  const editando = finEditandoMovId ? fin.movimientos.find((m) => m.id === finEditandoMovId) : null;
  const abiertoMov = finFormMovimientoAbierto || !!editando;
  if (abiertoMov) {
    html += `
      <form id="fin-form-movimiento" class="form-burbuja" data-editing-id="${editando ? editando.id : ''}">
        <label>Tipo
          <select name="tipo">
            <option value="gasto" ${!editando || editando.tipo !== 'ingreso' ? 'selected' : ''}>Gasto</option>
            <option value="ingreso" ${editando && editando.tipo === 'ingreso' ? 'selected' : ''}>Ingreso</option>
          </select>
        </label>
        <label>Fecha
          <input type="date" name="fecha" required value="${editando ? editando.fecha : ''}">
        </label>
        <label>Concepto
          <input type="text" name="concepto" placeholder="Si no lo sabés, dejalo vacío: se guarda como CONCEPTO PENDIENTE"
            value="${editando ? (editando.pendienteAclaracion ? '' : editando.concepto) : ''}">
        </label>
        <label>Importe ($)
          <input type="number" name="importe" min="1" step="1" required value="${editando ? editando.importe : ''}">
        </label>
        <label class="label-checkbox">
          <input type="checkbox" name="categoriaMama" ${editando && editando.categoria === 'mama' ? 'checked' : ''}>
          👩 Es un gasto a nombre de MAMÁ (lo arregla después)
        </label>
        <div class="acciones-form">
          <button type="submit">${editando ? 'Guardar cambios' : 'Agregar'}</button>
          <button type="button" data-action="fin-cerrar-form-movimiento">Cancelar</button>
        </div>
      </form>`;
  } else {
    html += `<button type="button" class="burbuja-agregar" data-action="fin-abrir-form-movimiento">+ Agregar ingreso o gasto</button>`;
  }

  html += renderFinPrevistos(fin);

  cont.innerHTML = html;
}

// Plegado por default (icono + texto + "+"), sin caja ni borde propios:
// no ocupa espacio si no se lo toca. Al desplegarlo, los previstos
// aparecen como hijos anidados debajo del botón grande.
function renderFinPrevistos(fin) {
  let html = `
    <div class="previstos-encabezado burbuja-agregar burbuja-agregar--previsto">
      <button type="button" class="btn-previstos" data-action="fin-toggle-previstos-panel">⚠️ Gastos previstos o pendientes</button>
      <button type="button" class="btn-previsto-agregar" data-action="fin-previsto-agregar-rapido" title="Agregar previsto">+</button>
    </div>`;

  if (!finPrevistosPanelAbierto) return html;

  if (fin.gastosPrevistos && fin.gastosPrevistos.length) {
    html += '<ul class="previstos previstos-anidado">';
    fin.gastosPrevistos.forEach((p) => {
      html += `<li>
        <div class="previsto-mensaje">${p.concepto} — ${p.importeEstimado ? formatMoney(p.importeEstimado) : 'importe a confirmar'}${p.nota ? ` <span class="nota">(${p.nota})</span>` : ''}</div>
        <div class="previsto-acciones">
          <button type="button" class="btn-confirmar-previsto" data-action="fin-confirmar-previsto" data-id="${p.id}">✔ Confirmar gasto real</button>
          <button type="button" class="btn-icono" data-action="fin-eliminar-previsto" data-id="${p.id}" title="Eliminar">🗑️</button>
        </div>`;
      if (finConfirmandoPrevistoId === p.id) {
        html += `
          <form id="fin-form-confirmar-previsto" data-previsto-id="${p.id}" class="form-inline">
            <label>Fecha
              <input type="date" name="fecha" required value="${new Date().toISOString().slice(0, 10)}">
            </label>
            <label>Importe real ($)
              <input type="number" name="importe" min="1" step="1" required value="${p.importeEstimado || ''}">
            </label>
            <div class="acciones-form">
              <button type="submit">Confirmar</button>
              <button type="button" data-action="fin-cancelar-confirmar-previsto">Cancelar</button>
            </div>
          </form>`;
      }
      html += '</li>';
    });
    html += '</ul>';
  } else {
    html += '<p class="aviso-previstos previstos-anidado">No hay gastos previstos cargados.</p>';
  }

  if (finFormPrevistoAbierto) {
    html += `
      <form id="fin-form-previsto" class="form-burbuja previstos-anidado">
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
          <button type="button" data-action="fin-cerrar-form-previsto">Cancelar</button>
        </div>
      </form>`;
  }

  return html;
}

// Inversiones (Itaú, crypto, bienes raíces...): lista simple con el valor
// que la persona cargó a mano. La app nunca calcula variaciones ni cotiza
// nada sola — el recordatorio de revisarlas es una alerta manual más.
// Paleta cíclica para las porciones de la torta: si hay más inversiones
// que colores, se repiten (no debería pasar en la práctica).
const COLORES_TORTA = ['#5aa9e6', '#4cbd8c', '#d9a441', '#e2685c', '#9b7ede', '#4dd0e1', '#f28fb1', '#8bc34a'];

// Torta armada con conic-gradient puro (sin librerías): una porción por
// inversión, proporcional a su valor actual sobre el total. Si no hay
// ninguna inversión con valor cargado, no se dibuja nada.
function renderTortaInversiones(inversiones) {
  const total = inversiones.reduce((suma, inv) => suma + (inv.valorActual || 0), 0);
  if (!total) return '';

  let acumulado = 0;
  const segmentos = inversiones.map((inv, i) => {
    const color = COLORES_TORTA[i % COLORES_TORTA.length];
    const inicio = (acumulado / total) * 360;
    acumulado += inv.valorActual || 0;
    const fin = (acumulado / total) * 360;
    return { color, inicio, fin };
  });
  const gradiente = segmentos.map((s) => `${s.color} ${s.inicio}deg ${s.fin}deg`).join(', ');

  const leyenda = inversiones
    .map((inv, i) => {
      const pct = Math.round(((inv.valorActual || 0) / total) * 100);
      return `<li><span class="torta-leyenda__punto" style="background:${COLORES_TORTA[i % COLORES_TORTA.length]}"></span>${inv.nombre} — ${pct}%</li>`;
    })
    .join('');

  return `
    <div class="torta-inversiones-caja">
      <div class="torta-inversiones" style="background: conic-gradient(${gradiente})"></div>
      <div class="torta-leyenda">
        <div class="torta-leyenda__total">Dinero actual: <strong>${formatMoney(total)}</strong></div>
        <ul>${leyenda}</ul>
      </div>
    </div>`;
}

function renderFinInversiones(fin) {
  let html = '<div class="caja-inversiones">';
  html += '<div class="caja-inversiones__titulo">📊 Inversiones</div>';

  const inversiones = fin.inversiones || [];
  html += renderTortaInversiones(inversiones);

  if (inversiones.length) {
    html += '<ul class="previstos">';
    inversiones.forEach((inv) => {
      if (finEditandoInversionId === inv.id) {
        html += `<li>
          <form id="fin-form-editar-inversion" data-inversion-id="${inv.id}" class="form-inline">
            <label>Nombre
              <input type="text" name="nombre" required value="${inv.nombre}">
            </label>
            <label>Tipo
              <select name="tipo">
                ${TIPOS_INVERSION.map((t) => `<option value="${t.id}" ${inv.tipo === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </label>
            <label>Valor actual ($)
              <input type="number" name="valorActual" min="0" step="1" required value="${inv.valorActual}">
            </label>
            <label>Nota (opcional)
              <input type="text" name="nota" value="${inv.nota || ''}">
            </label>
            <div class="acciones-form">
              <button type="submit">Guardar</button>
              <button type="button" data-action="fin-cancelar-editar-inversion">Cancelar</button>
            </div>
          </form>
        </li>`;
      } else {
        html += `<li>
          <div class="previsto-mensaje">${inv.nombre} <span class="etiqueta-secundaria">(${tipoInversionLabel(inv.tipo)})</span> — ${formatMoney(inv.valorActual)}${inv.nota ? `<br><span class="etiqueta-secundaria">${inv.nota}</span>` : ''}</div>
          <div class="previsto-acciones">
            <button type="button" class="btn-icono" data-action="fin-editar-inversion" data-id="${inv.id}" title="Editar">✏️</button>
            <button type="button" class="btn-icono" data-action="fin-eliminar-inversion" data-id="${inv.id}" title="Eliminar">🗑️</button>
          </div>
        </li>`;
      }
    });
    html += '</ul>';
  } else {
    html += '<p class="aviso-inversiones">No hay inversiones cargadas.</p>';
  }

  if (finFormInversionAbierto) {
    html += `
      <form id="fin-form-inversion" class="form-burbuja">
        <label>Nombre
          <input type="text" name="nombre" required placeholder="Ej: Itaú Asset Management">
        </label>
        <label>Tipo
          <select name="tipo">
            ${TIPOS_INVERSION.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}
          </select>
        </label>
        <label>Valor actual ($)
          <input type="number" name="valorActual" min="0" step="1" required>
        </label>
        <label>Nota (opcional)
          <input type="text" name="nota" placeholder="Ej: revisar cotización cada trimestre">
        </label>
        <div class="acciones-form">
          <button type="submit">Agregar inversión</button>
          <button type="button" data-action="fin-cerrar-form-inversion">Cancelar</button>
        </div>
      </form>`;
  } else {
    html += `<button type="button" class="burbuja-agregar" data-action="fin-abrir-form-inversion">+ Agregar inversión</button>`;
  }

  html += '</div>';
  return html;
}

// Inversiones vive en su propia sección, separada de la tarjeta de saldo
// total — mismo lenguaje visual que Exportar/Importar en #respaldo: un
// ícono solo por default, que al tocarlo despliega el contenido completo
// (torta, lista, formulario) debajo.
function renderFinInversionesSeccion(fin) {
  const cont = document.getElementById('finanzas-inversiones');
  if (!cont) return;
  let html = `
    <div class="respaldo-caja">
      <button type="button" class="btn-respaldo-icono btn-respaldo-icono--azul" data-action="fin-toggle-inversiones" title="Inversiones">📊</button>
    </div>`;
  if (finInversionesAbierto) {
    html += renderFinInversiones(fin);
  }
  cont.innerHTML = html;
}

// Alertas de Finanzas: siempre manuales (facturas pendientes, revisar una
// inversión, lo que haga falta), nunca calculadas. El color (gravedad) lo
// elige la persona al crearlas. Mismo lenguaje visual que las alertas de
// los Hogares: campana con contador, "+" al lado, panel desplegable, se
// borran deslizando hacia la derecha.
function renderFinAlertas(fin) {
  const alertas = fin.alertas || [];
  let html = `
    <div class="alertas-encabezado">
      <button type="button" class="btn-alertas" data-action="fin-toggle-alertas-panel" title="Alertas">
        🚨${alertas.length ? `<span class="btn-alertas__contador">${alertas.length}</span>` : ''}
      </button>
      <button type="button" class="btn-alerta-agregar" data-action="fin-crear-alerta-rapida" title="Crear alerta">+</button>
    </div>`;

  if (finAlertasPanelAbierto) {
    if (alertas.length) {
      html += '<div class="alertas-panel">';
      alertas.forEach((a) => {
        html += `
          <div class="aviso-swipe aviso-swipe--fino" data-aviso-id="${a.id}">
            <div class="aviso-swipe__fondo">🗑️ <span class="aviso-swipe__fondo-texto">Eliminando alerta</span></div>
            <div class="aviso-swipe__frente aviso-swipe__frente--fino${a.color === 'rojo' ? ' aviso-swipe__frente--fino-rojo' : ''}">${a.texto}</div>
          </div>`;
      });
      html += '</div>';
    } else {
      html += '<p class="alertas-panel__vacio">No hay alertas activas.</p>';
    }

    if (finFormAlertaAbierto) {
      html += `
        <form id="fin-form-alerta" class="form-burbuja">
          <label>Texto de la alerta
            <input type="text" name="texto" required maxlength="140" placeholder="Ej: factura de UTE vence el 28">
          </label>
          <div class="selector-color-alerta">
            <button type="button" class="btn-color-alerta btn-color-alerta--amarillo${finColorAlertaElegido === 'amarillo' ? ' btn-color-alerta--elegido' : ''}" data-action="fin-elegir-color-alerta" data-color="amarillo">🟡 Aviso</button>
            <button type="button" class="btn-color-alerta btn-color-alerta--rojo${finColorAlertaElegido === 'rojo' ? ' btn-color-alerta--elegido' : ''}" data-action="fin-elegir-color-alerta" data-color="rojo">🔴 Urgente</button>
          </div>
          <div class="acciones-form">
            <button type="submit">Agregar alerta</button>
            <button type="button" data-action="fin-cerrar-form-alerta">Cancelar</button>
          </div>
        </form>`;
    }
  }

  return html;
}

function onFinSelectorMesesClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'fin-seleccionar-mes') {
    finMesSeleccionado = btn.dataset.mes;
    resetEstadosDeInteraccionFinanzas();
    renderFinanzas();
  }
}

function onFinCuentaClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const fin = state.finanzas;

  switch (btn.dataset.action) {
    case 'fin-toggle-concepto':
      if (finConceptosExpandidos.has(btn.dataset.id)) finConceptosExpandidos.delete(btn.dataset.id);
      else finConceptosExpandidos.add(btn.dataset.id);
      renderFinanzas();
      break;

    case 'fin-abrir-form-movimiento':
      finFormMovimientoAbierto = true;
      renderFinanzas();
      break;

    case 'fin-cerrar-form-movimiento':
      finFormMovimientoAbierto = false;
      finEditandoMovId = null;
      renderFinanzas();
      break;

    case 'fin-editar-mov':
      finEditandoMovId = btn.dataset.id;
      finFormMovimientoAbierto = true;
      finConfirmandoPrevistoId = null;
      renderFinanzas();
      break;

    case 'fin-eliminar-mov': {
      const mov = fin.movimientos.find((m) => m.id === btn.dataset.id);
      if (mov && confirm(`¿Eliminar el movimiento "${mov.concepto}" (${formatMoney(mov.importe)})? El saldo se recalcula solo.`)) {
        eliminarMovimiento(fin, btn.dataset.id);
        if (finEditandoMovId === btn.dataset.id) {
          finEditandoMovId = null;
          finFormMovimientoAbierto = false;
        }
        persistirYRenderizarFinanzas();
      }
      break;
    }

    case 'fin-toggle-previstos-panel':
      finPrevistosPanelAbierto = !finPrevistosPanelAbierto;
      finFormPrevistoAbierto = false;
      renderFinanzas();
      break;

    case 'fin-previsto-agregar-rapido':
      finPrevistosPanelAbierto = true;
      finFormPrevistoAbierto = true;
      renderFinanzas();
      break;

    case 'fin-cerrar-form-previsto':
      finFormPrevistoAbierto = false;
      renderFinanzas();
      break;

    case 'fin-confirmar-previsto':
      finConfirmandoPrevistoId = btn.dataset.id;
      finEditandoMovId = null;
      renderFinanzas();
      break;

    case 'fin-cancelar-confirmar-previsto':
      finConfirmandoPrevistoId = null;
      renderFinanzas();
      break;

    case 'fin-eliminar-previsto': {
      const previsto = fin.gastosPrevistos.find((p) => p.id === btn.dataset.id);
      if (previsto && confirm(`¿Eliminar el gasto previsto "${previsto.concepto}"?`)) {
        eliminarGastoPrevisto(fin, btn.dataset.id);
        persistirYRenderizarFinanzas();
      }
      break;
    }

    case 'fin-toggle-inversiones':
      finInversionesAbierto = !finInversionesAbierto;
      finFormInversionAbierto = false;
      finEditandoInversionId = null;
      renderFinanzas();
      break;

    case 'fin-abrir-form-inversion':
      finFormInversionAbierto = true;
      finEditandoInversionId = null;
      renderFinanzas();
      break;

    case 'fin-cerrar-form-inversion':
      finFormInversionAbierto = false;
      renderFinanzas();
      break;

    case 'fin-editar-inversion':
      finEditandoInversionId = btn.dataset.id;
      finFormInversionAbierto = false;
      renderFinanzas();
      break;

    case 'fin-cancelar-editar-inversion':
      finEditandoInversionId = null;
      renderFinanzas();
      break;

    case 'fin-eliminar-inversion': {
      const inv = fin.inversiones.find((i) => i.id === btn.dataset.id);
      if (inv && confirm(`¿Eliminar la inversión "${inv.nombre}"?`)) {
        eliminarInversion(fin, btn.dataset.id);
        persistirYRenderizarFinanzas();
      }
      break;
    }

    case 'fin-toggle-alertas-panel':
      finAlertasPanelAbierto = !finAlertasPanelAbierto;
      finFormAlertaAbierto = false;
      renderFinanzas();
      break;

    case 'fin-crear-alerta-rapida':
      finAlertasPanelAbierto = true;
      finFormAlertaAbierto = true;
      finColorAlertaElegido = 'amarillo';
      renderFinanzas();
      break;

    case 'fin-cerrar-form-alerta':
      finFormAlertaAbierto = false;
      renderFinanzas();
      break;

    case 'fin-elegir-color-alerta':
      finColorAlertaElegido = btn.dataset.color;
      renderFinanzas();
      break;
  }
}

function onFinCuentaSubmit(e) {
  e.preventDefault();
  const fin = state.finanzas;
  const form = e.target;

  if (form.id === 'fin-form-movimiento') {
    const tipo = form.tipo.value === 'ingreso' ? 'ingreso' : 'gasto';
    const fecha = form.fecha.value;
    const concepto = form.concepto.value;
    const importe = Number(form.importe.value);
    // El tag "MAMÁ" solo tiene sentido en un gasto (nunca en un ingreso).
    const categoria = tipo === 'gasto' && form.categoriaMama.checked ? 'mama' : null;

    if (!fecha) {
      alert('Elegí una fecha.');
      return;
    }
    if (!importe || importe <= 0) {
      alert('El importe tiene que ser mayor a $0.');
      return;
    }

    const editingId = form.dataset.editingId;
    if (editingId) {
      actualizarMovimiento(fin, editingId, { fecha, tipo, concepto, importe, categoria });
      finEditandoMovId = null;
    } else {
      agregarMovimiento(fin, { fecha, tipo, concepto, importe, categoria });
    }
    finFormMovimientoAbierto = false;
    finMesSeleccionado = fecha.slice(0, 7);
    persistirYRenderizarFinanzas();
    return;
  }

  if (form.id === 'fin-form-previsto') {
    const concepto = form.concepto.value;
    const importeEstimado = Number(form.importeEstimado.value);
    const nota = form.nota.value;

    if (!importeEstimado || importeEstimado <= 0) {
      alert('El importe estimado tiene que ser mayor a $0.');
      return;
    }

    agregarGastoPrevisto(fin, { concepto, importeEstimado, nota });
    finFormPrevistoAbierto = false;
    persistirYRenderizarFinanzas();
    return;
  }

  if (form.id === 'fin-form-confirmar-previsto') {
    const fecha = form.fecha.value;
    const importe = Number(form.importe.value);

    if (!fecha) {
      alert('Elegí una fecha.');
      return;
    }
    if (!importe || importe <= 0) {
      alert('El importe tiene que ser mayor a $0.');
      return;
    }

    confirmarGastoPrevisto(fin, form.dataset.previstoId, { fecha, importe });
    finConfirmandoPrevistoId = null;
    finMesSeleccionado = fecha.slice(0, 7);
    persistirYRenderizarFinanzas();
    return;
  }

  if (form.id === 'fin-form-inversion') {
    const nombre = form.nombre.value;
    const tipo = form.tipo.value;
    const valorActual = Number(form.valorActual.value);
    const nota = form.nota.value;

    if (!nombre.trim()) {
      alert('Ingresá un nombre para la inversión.');
      return;
    }
    if (Number.isNaN(valorActual) || valorActual < 0) {
      alert('El valor actual no puede ser negativo.');
      return;
    }

    agregarInversion(fin, { nombre, tipo, valorActual, nota });
    finFormInversionAbierto = false;
    persistirYRenderizarFinanzas();
    return;
  }

  if (form.id === 'fin-form-editar-inversion') {
    const nombre = form.nombre.value;
    const tipo = form.tipo.value;
    const valorActual = Number(form.valorActual.value);
    const nota = form.nota.value;

    if (!nombre.trim()) {
      alert('Ingresá un nombre para la inversión.');
      return;
    }
    if (Number.isNaN(valorActual) || valorActual < 0) {
      alert('El valor actual no puede ser negativo.');
      return;
    }

    actualizarInversion(fin, form.dataset.inversionId, { nombre, tipo, valorActual, nota });
    finEditandoInversionId = null;
    persistirYRenderizarFinanzas();
    return;
  }

  if (form.id === 'fin-form-alerta') {
    const resultado = agregarAlertaFinanzas(fin, form.texto.value, finColorAlertaElegido);
    if (resultado === 'limite') {
      alert(`Ya hay ${MAX_ALERTAS_FINANZAS} alertas cargadas (el máximo). Borrá alguna antes de agregar una nueva.`);
      return;
    }
    finFormAlertaAbierto = false;
    persistirYRenderizarFinanzas();
  }
}

// Gesto de deslizar para borrar una alerta de Finanzas: siempre se borra de
// verdad (no hay alertas "de sistema" que solo se descarten de la vista,
// todas las de Finanzas las creó la persona a mano).
function onFinAvisoPointerDown(e) {
  const frente = e.target.closest('.aviso-swipe__frente');
  if (!frente) return;
  const contenedor = frente.closest('.aviso-swipe');
  finSwipeEstado = {
    pointerId: e.pointerId,
    id: contenedor.dataset.avisoId,
    startX: e.clientX,
    startY: e.clientY,
    dx: 0,
    elFrente: frente,
    arrastrando: false,
  };
  frente.addEventListener('pointermove', onFinAvisoPointerMove);
  frente.addEventListener('pointerup', onFinAvisoPointerUp);
  frente.addEventListener('pointercancel', onFinAvisoPointerUp);
}

function onFinAvisoPointerMove(e) {
  if (!finSwipeEstado || e.pointerId !== finSwipeEstado.pointerId) return;
  const dx = e.clientX - finSwipeEstado.startX;
  const dy = e.clientY - finSwipeEstado.startY;

  if (!finSwipeEstado.arrastrando) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) {
      finSwipeEstado = null;
      return;
    }
    finSwipeEstado.arrastrando = true;
    finSwipeEstado.elFrente.setPointerCapture(e.pointerId);
    finSwipeEstado.elFrente.style.transition = 'none';
  }

  const dxClamped = Math.max(0, dx);
  finSwipeEstado.dx = dxClamped;
  finSwipeEstado.elFrente.style.transform = `translateX(${dxClamped}px)`;
}

function onFinAvisoPointerUp(e) {
  if (!finSwipeEstado || e.pointerId !== finSwipeEstado.pointerId) return;
  const { elFrente, arrastrando, dx, id } = finSwipeEstado;
  elFrente.removeEventListener('pointermove', onFinAvisoPointerMove);
  elFrente.removeEventListener('pointerup', onFinAvisoPointerUp);
  elFrente.removeEventListener('pointercancel', onFinAvisoPointerUp);

  if (arrastrando) {
    elFrente.style.transition = 'transform 0.2s ease';
    if (dx > UMBRAL_SWIPE_DESCARTAR) {
      eliminarAlertaFinanzas(state.finanzas, id);
      saveState(state);
      renderFinanzas();
    } else {
      elFrente.style.transform = 'translateX(0)';
    }
  }
  finSwipeEstado = null;
}
