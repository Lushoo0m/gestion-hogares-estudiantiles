// Paso 2: registrar, editar y eliminar gastos del mes activo, con
// recálculo automático de saldo (el saldo siempre se calcula a partir de los
// movimientos, nunca se guarda "congelado"). Por ahora solo Colonia está
// habilitada; Miguelete queda fuera del selector hasta que se den de alta
// sus datos reales.

let state = loadState();
let hogarSeleccionado = 'colonia';
let mesSeleccionado = null;
let editandoMovId = null;
let confirmandoPrevistoId = null;

function init() {
  const meses = getMesesOrdenados(state.hogares[hogarSeleccionado]);
  const activo = meses.find((m) => m.estado === 'activo');
  mesSeleccionado = activo ? activo.mes : meses.length ? meses[meses.length - 1].mes : null;

  renderSelectorHogares();
  renderSelectorMeses();
  renderEstadoDeCuenta();

  document.getElementById('estado-cuenta').addEventListener('click', onEstadoCuentaClick);
  document.getElementById('estado-cuenta').addEventListener('submit', onEstadoCuentaSubmit);
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
      editandoMovId = null;
      confirmandoPrevistoId = null;
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
    btn.className = 'chip-mes' + (seleccionado ? ' chip-mes--seleccionado' : '') + (bloqueado ? ' chip-mes--bloqueado' : ' chip-mes--activo');
    btn.innerHTML = seleccionado
      ? `<span class="chip-mes__candado">${bloqueado ? '🔒' : '🔓'}</span><span class="chip-mes__nombre">${mesLabel(mesKey).toUpperCase()}</span>`
      : `<span class="chip-mes__codigo">${mesAbrev(mesKey)}</span><span class="chip-mes__candado">${bloqueado ? '🔒' : '🔓'}</span>`;

    btn.addEventListener('click', () => {
      mesSeleccionado = mesKey;
      editandoMovId = null;
      confirmandoPrevistoId = null;
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

  let html = '';

  html += `<div class="estado-mes-header">
    <span class="badge-estado ${mesObj.estado === 'cerrado' ? 'badge-cerrado' : 'badge-activo'}">
      ${mesObj.estado === 'cerrado' ? '🔒 Cerrado — solo lectura' : '🟢 En curso'}
    </span>`;
  if (mesObj.estado === 'activo') {
    html += `<button type="button" class="btn-cerrar" data-action="cerrar-mes">🔒 Cerrar estado de cuenta</button>`;
  } else if (mesObj.detalleDisponible) {
    html += `<button type="button" class="btn-reabrir" data-action="reabrir-mes">Reabrir (corregir un error)</button>`;
  }
  html += `</div>`;

  html += `<div class="resumen">
    <div><span class="etiqueta">Presupuesto habitual</span><span class="valor">${formatMoney(mesObj.presupuesto)}</span></div>`;
  if (mesObj.presupuestoEfectivo !== mesObj.presupuesto) {
    html += `<div><span class="etiqueta">Presupuesto efectivo</span><span class="valor">${formatMoney(mesObj.presupuestoEfectivo)}</span></div>`;
  }
  html += `</div>`;

  if (mesObj.ajustes && mesObj.ajustes.length) {
    html += '<div class="ajustes">';
    mesObj.ajustes.forEach((aj) => {
      html += `<p class="ajuste">⚠️ ${aj.concepto}: ${formatMoney(aj.importe)}</p>`;
    });
    html += '</div>';
  }

  if (mesObj.estado === 'activo' && gastosFijosPendientes.length) {
    html += '<div class="recordatorio">';
    gastosFijosPendientes.forEach((gf) => {
      html += `
        <p>🔔 Recordatorio: gasto fijo mensual sin confirmar todavía — <strong>${gf.concepto}</strong> (${formatMoney(gf.importe)}).
          <button type="button" class="btn-link" data-action="registrar-fijo" data-gf-id="${gf.id}">Registrar ahora</button>
        </p>`;
    });
    html += '</div>';
  }

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
      <thead><tr><th>Fecha</th><th>Concepto</th><th>Gasto</th><th>Saldo</th>${editable ? '<th></th>' : ''}</tr></thead>
      <tbody>
        ${movs.map((m) => `
          <tr class="${m.tipo === 'ingreso' ? 'fila-ingreso' : ''}${m.pendienteAclaracion ? ' fila-pendiente' : ''}">
            <td>${m.fecha.split('-').reverse().join('/')}</td>
            <td>${m.concepto}${m.pendienteAclaracion ? ' <span class="marca-pendiente" title="Falta aclarar el concepto real">⚠️ aclarar</span>' : ''}</td>
            <td>${m.tipo === 'ingreso' ? '+' + formatMoney(m.importe) : formatMoney(m.importe)}</td>
            <td>${formatMoney(m.saldo)}</td>
            ${editable ? `<td class="col-acciones">
              <button type="button" class="btn-icono" data-action="editar-mov" data-id="${m.id}" title="Editar">✏️</button>
              <button type="button" class="btn-icono" data-action="eliminar-mov" data-id="${m.id}" title="Eliminar">🗑️</button>
            </td>` : ''}
          </tr>`).join('')}
      </tbody>
    </table>
    <p class="saldo-actual">Saldo actual: <strong>${formatMoney(saldoCalculado)}</strong></p>`;

  if (editable) {
    const editando = editandoMovId ? mesObj.movimientos.find((m) => m.id === editandoMovId) : null;
    html += `
      <h3>${editando ? 'Editar movimiento' : 'Agregar movimiento'}</h3>
      <form id="form-movimiento" data-editing-id="${editando ? editando.id : ''}">
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
          ${editando ? '<button type="button" data-action="cancelar-edicion">Cancelar</button>' : ''}
        </div>
      </form>`;
  }

  html += '<h3>Gastos previstos (no descuentan del saldo)</h3>';
  if (mesObj.gastosPrevistos && mesObj.gastosPrevistos.length) {
    html += '<ul class="previstos">';
    mesObj.gastosPrevistos.forEach((p) => {
      html += `<li>
        <div class="previsto-linea">
          <span>${p.concepto} — ${formatMoney(p.importeEstimado)}${p.nota ? ` <span class="nota">(${p.nota})</span>` : ''}</span>
          ${editable ? `<span class="previsto-acciones">
            <button type="button" class="btn-link" data-action="confirmar-previsto" data-id="${p.id}">Confirmar como gasto real</button>
            <button type="button" class="btn-link btn-link--rojo" data-action="eliminar-previsto" data-id="${p.id}">Eliminar</button>
          </span>` : ''}
        </div>`;
      if (editable && confirmandoPrevistoId === p.id) {
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
    html += '<p class="aviso">No hay gastos previstos cargados para este mes.</p>';
  }

  if (editable) {
    html += `
      <h4>Agregar gasto previsto</h4>
      <form id="form-previsto">
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
        </div>
      </form>`;
  }

  cont.innerHTML = html;
}

function onEstadoCuentaClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const mesObj = getMesActual();
  const hogar = state.hogares[hogarSeleccionado];

  switch (btn.dataset.action) {
    case 'cerrar-mes':
      if (confirm(`¿Cerrar el estado de cuenta de ${mesLabel(mesObj.mes)}? Después de cerrarlo va a quedar de solo lectura: no se van a poder agregar, editar ni eliminar gastos hasta reabrirlo.`)) {
        cerrarMes(mesObj);
        editandoMovId = null;
        confirmandoPrevistoId = null;
        persistirYRenderizar();
      }
      break;

    case 'reabrir-mes':
      if (confirm(`¿Reabrir el estado de cuenta de ${mesLabel(mesObj.mes)} para corregir un error? Va a volver a permitir agregar, editar y eliminar gastos.`)) {
        reabrirMes(mesObj);
        persistirYRenderizar();
      }
      break;

    case 'editar-mov':
      editandoMovId = btn.dataset.id;
      confirmandoPrevistoId = null;
      renderEstadoDeCuenta();
      break;

    case 'cancelar-edicion':
      editandoMovId = null;
      renderEstadoDeCuenta();
      break;

    case 'eliminar-mov': {
      const mov = mesObj.movimientos.find((m) => m.id === btn.dataset.id);
      if (mov && confirm(`¿Eliminar el movimiento "${mov.concepto}" (${formatMoney(mov.importe)})? El saldo de los movimientos posteriores se recalcula solo.`)) {
        eliminarMovimiento(mesObj, btn.dataset.id);
        if (editandoMovId === btn.dataset.id) editandoMovId = null;
        persistirYRenderizar();
      }
      break;
    }

    case 'registrar-fijo': {
      const gf = hogar.gastosFijos.find((g) => g.id === btn.dataset.gfId);
      if (!gf) break;
      editandoMovId = null;
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

document.addEventListener('DOMContentLoaded', init);
