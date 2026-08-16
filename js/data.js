// Capa de datos: esquema, semilla histórica y acceso a localStorage.
// Todo el estado de la app vive en una única clave de localStorage como JSON.
// Esto también es lo que se exporta/importa como respaldo (mismo formato).

const STORAGE_KEY = 'gh_estudiantiles_v1';

// Datos históricos reales de Colonia, tal como fueron provistos. No se inventa
// ningún importe, concepto ni fecha. Junio y julio están cerrados y solo se
// conoce el resumen (presupuesto + saldo final), no el detalle de movimientos.
const SEED_STATE = {
  version: 1,
  hogares: {
    colonia: {
      id: 'colonia',
      nombre: 'Colonia',
      habilitado: true,
      gastosFijos: [
        {
          id: 'gf-colonia-bombas',
          concepto: 'Abono servicio bombas/sanitaria',
          importe: 4819,
          activo: true,
        },
      ],
      meses: {
        '2026-06': {
          mes: '2026-06',
          estado: 'cerrado',
          presupuesto: 20000,
          presupuestoEfectivo: 20000,
          ajustes: [],
          detalleDisponible: false,
          movimientos: [],
          saldoFinalRegistrado: 3,
          gastosPrevistos: [],
        },
        '2026-07': {
          mes: '2026-07',
          estado: 'cerrado',
          presupuesto: 20000,
          presupuestoEfectivo: 20000,
          ajustes: [],
          detalleDisponible: false,
          movimientos: [],
          saldoFinalRegistrado: 8,
          gastosPrevistos: [],
        },
        '2026-08': {
          mes: '2026-08',
          estado: 'activo',
          presupuesto: 20000,
          presupuestoEfectivo: 18010,
          ajustes: [
            { concepto: 'Reducción por refacturación de Ropero', importe: -1990 },
          ],
          detalleDisponible: true,
          movimientos: [
            { id: 'mov-1', fecha: '2026-08-01', concepto: 'PRESUPUESTO EFECTIVO', tipo: 'ingreso', importe: 18010 },
            { id: 'mov-2', fecha: '2026-08-04', concepto: 'ROPERO – ML', tipo: 'gasto_real', importe: 1990 },
            { id: 'mov-3', fecha: '2026-08-04', concepto: 'ABONO SERVICIO BOMBAS / SANITARIA', tipo: 'gasto_real', importe: 4819 },
            { id: 'mov-4', fecha: '2026-08-13', concepto: 'PRODUCTO DESTAPA CAÑOS', tipo: 'gasto_real', importe: 175 },
          ],
          gastosPrevistos: [
            { id: 'prev-1', concepto: '2 recargas Río Gas', importeEstimado: 2682, confirmado: false, nota: '' },
            { id: 'prev-2', concepto: 'Antel', importeEstimado: 3400, confirmado: false, nota: 'Importe pendiente de confirmar, NO confirmado' },
          ],
        },
      },
    },
    // Deshabilitado por ahora a pedido: nos concentramos solo en Colonia.
    // Queda en el modelo para no perder la estructura de "lista abierta de
    // Hogares" y poder habilitarlo (con sus datos reales) más adelante.
    miguelete: {
      id: 'miguelete',
      nombre: 'Miguelete',
      habilitado: false,
      gastosFijos: [],
      meses: {},
    },
  },
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = clone(SEED_STATE);
    saveState(seeded);
    return seeded;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Estado guardado corrupto, se reinicia con la semilla histórica.', e);
    const seeded = clone(SEED_STATE);
    saveState(seeded);
    return seeded;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getHogaresOrdenados(state) {
  return Object.values(state.hogares).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function getHogaresHabilitados(state) {
  return getHogaresOrdenados(state).filter((h) => h.habilitado !== false);
}

function getMesesOrdenados(hogar) {
  return Object.values(hogar.meses).sort((a, b) => a.mes.localeCompare(b.mes));
}

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// Cada estado de cuenta cubre del día 1 al último día de su mes. Esta función
// valida que una fecha (YYYY-MM-DD) caiga dentro del mes (YYYY-MM) del
// estado de cuenta en el que se está cargando el movimiento.
function fechaPerteneceAlMes(fecha, mesKey) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  if (!fecha.startsWith(mesKey + '-')) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaObj = new Date(anio, mes - 1, dia);
  return fechaObj.getFullYear() === anio && fechaObj.getMonth() === mes - 1 && fechaObj.getDate() === dia;
}

function primerDiaMes(mesKey) {
  return `${mesKey}-01`;
}

function ultimoDiaMes(mesKey) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `${mesKey}-${String(ultimoDia).padStart(2, '0')}`;
}

// Ante la duda de un concepto vacío, nunca se inventa: se registra como
// "CONCEPTO PENDIENTE" y queda marcado para pedir la aclaración.
function normalizarConceptoIngresado(concepto) {
  const limpio = (concepto || '').trim();
  return limpio || 'CONCEPTO PENDIENTE';
}

function agregarMovimiento(mesObj, { fecha, concepto, tipo, importe }) {
  const conceptoFinal = normalizarConceptoIngresado(concepto);
  const movimiento = {
    id: generarId('mov'),
    fecha,
    concepto: conceptoFinal,
    tipo,
    importe: Math.round(Number(importe)),
    pendienteAclaracion: conceptoFinal === 'CONCEPTO PENDIENTE',
  };
  mesObj.movimientos.push(movimiento);
  return movimiento;
}

function actualizarMovimiento(mesObj, id, cambios) {
  const mov = mesObj.movimientos.find((m) => m.id === id);
  if (!mov) return;
  if (cambios.fecha !== undefined) mov.fecha = cambios.fecha;
  if (cambios.tipo !== undefined) mov.tipo = cambios.tipo;
  if (cambios.importe !== undefined) mov.importe = Math.round(Number(cambios.importe));
  if (cambios.concepto !== undefined) {
    const conceptoFinal = normalizarConceptoIngresado(cambios.concepto);
    mov.concepto = conceptoFinal;
    mov.pendienteAclaracion = conceptoFinal === 'CONCEPTO PENDIENTE';
  }
}

function eliminarMovimiento(mesObj, id) {
  mesObj.movimientos = mesObj.movimientos.filter((m) => m.id !== id);
}

function agregarGastoPrevisto(mesObj, { concepto, importeEstimado, nota }) {
  const previsto = {
    id: generarId('prev'),
    concepto: normalizarConceptoIngresado(concepto),
    importeEstimado: Math.round(Number(importeEstimado)),
    confirmado: false,
    nota: (nota || '').trim(),
  };
  mesObj.gastosPrevistos.push(previsto);
  return previsto;
}

function eliminarGastoPrevisto(mesObj, id) {
  mesObj.gastosPrevistos = mesObj.gastosPrevistos.filter((p) => p.id !== id);
}

// Confirmar un gasto previsto lo convierte en gasto real (movimiento) con la
// fecha e importe que confirme el usuario, y lo saca de la lista de
// previstos. Nunca se hace solo: siempre requiere esta confirmación explícita.
function confirmarGastoPrevisto(mesObj, id, { fecha, importe }) {
  const idx = mesObj.gastosPrevistos.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const previsto = mesObj.gastosPrevistos[idx];
  const movimiento = agregarMovimiento(mesObj, {
    fecha,
    concepto: previsto.concepto,
    tipo: 'gasto_real',
    importe: importe !== undefined && importe !== null && importe !== '' ? importe : previsto.importeEstimado,
  });
  mesObj.gastosPrevistos.splice(idx, 1);
  return movimiento;
}

// Un estado de cuenta solo se puede editar mientras está "activo". Cerrarlo
// (bloquearlo) lo deja de solo lectura hasta que se reabra explícitamente.
// Cada cambio de estado queda registrado con fecha/hora para trazabilidad.
function cerrarMes(mesObj) {
  mesObj.estado = 'cerrado';
  mesObj.historialEstado = mesObj.historialEstado || [];
  mesObj.historialEstado.push({ accion: 'cierre', fecha: new Date().toISOString() });
}

function reabrirMes(mesObj) {
  mesObj.estado = 'activo';
  mesObj.historialEstado = mesObj.historialEstado || [];
  mesObj.historialEstado.push({ accion: 'reapertura', fecha: new Date().toISOString() });
}

// Calcula el saldo corriente de cada movimiento, en orden cronológico.
// Los gastos previstos NO participan del saldo. Los ingresos suman, los
// gastos reales restan. El orden es por fecha y, a igualdad de fecha, por el
// orden en que fueron cargados (para no reordenar arbitrariamente).
function movimientosConSaldo(mesObj) {
  const ordenados = [...mesObj.movimientos].sort((a, b) => {
    if (a.fecha === b.fecha) return 0;
    return a.fecha < b.fecha ? -1 : 1;
  });
  let saldo = 0;
  return ordenados.map((mov) => {
    if (mov.tipo === 'ingreso') saldo += mov.importe;
    else saldo -= mov.importe;
    return { ...mov, saldo };
  });
}

function formatMoney(n) {
  const signo = n < 0 ? '-' : '';
  return `${signo}$${Math.abs(Math.round(n)).toLocaleString('es-UY')}`;
}

function mesLabel(mesKey) {
  const [anio, mes] = mesKey.split('-');
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[parseInt(mes, 10) - 1]} ${anio}`;
}
