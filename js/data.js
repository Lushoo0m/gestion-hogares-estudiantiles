// Capa de datos: esquema, semilla histórica y acceso a localStorage.
// Todo el estado de la app vive en una única clave de localStorage como JSON.
// Esto también es lo que se exporta/importa como respaldo (mismo formato).

const STORAGE_KEY = 'gh_estudiantiles_v1';

// Datos históricos reales de Colonia, transcriptos tal cual figuran en los
// PDF de cierre oficiales ("Estado de Cuenta Junio 2026 Definitivo" y
// "...Julio 2026 Cierre"). No se inventa ningún importe, concepto ni fecha;
// los saldos corrientes fueron verificados contra el saldo final de cada PDF.
const SEED_STATE = {
  version: 1,
  hogares: {
    colonia: {
      id: 'colonia',
      nombre: 'Colonia',
      habilitado: true,
      gastosFijos: [],
      // Gastos recurrentes de cada mes: se sugieren como gasto PREVISTO del
      // mes activo (no como recordatorio aparte), y el importe se confirma
      // a mano contra el comprobante real antes de pasar a ser un gasto.
      previstosRecurrentes: [
        {
          id: 'pr-colonia-envio-sobre',
          concepto: 'Envío de sobre (Rutas del Plata / Núñez)',
          importeEstimado: 100,
          nota: 'El importe varía (aprox. $100 a $130): confirmar con el comprobante real.',
        },
        {
          id: 'pr-colonia-bombas',
          concepto: 'Abono servicio bombas / sanitaria',
          importeEstimado: 4819,
          nota: '',
        },
      ],
      meses: {
        '2026-06': {
          mes: '2026-06',
          estado: 'cerrado',
          presupuesto: 20000,
          presupuestoEfectivo: 20000,
          ajustes: [],
          detalleDisponible: true,
          movimientos: [
            { id: 'mov-jun-1', fecha: '2026-06-01', concepto: 'DEPÓSITO GESTIÓN', tipo: 'ingreso', importe: 20000 },
            { id: 'mov-jun-2', fecha: '2026-06-01', concepto: 'BARRACA', tipo: 'gasto_real', importe: 990 },
            { id: 'mov-jun-3', fecha: '2026-06-02', concepto: 'SANITARIA', tipo: 'gasto_real', importe: 305 },
            { id: 'mov-jun-4', fecha: '2026-06-07', concepto: 'FERRETERÍA', tipo: 'gasto_real', importe: 390 },
            { id: 'mov-jun-5', fecha: '2026-06-08', concepto: '2 RECARGAS DE GAS', tipo: 'gasto_real', importe: 2882 },
            { id: 'mov-jun-6', fecha: '2026-06-08', concepto: 'REPUESTO LUZ', tipo: 'gasto_real', importe: 450 },
            { id: 'mov-jun-7', fecha: '2026-06-08', concepto: 'BOLSAS RESIDUOS Y ESPONJAS', tipo: 'gasto_real', importe: 466 },
            { id: 'mov-jun-8', fecha: '2026-06-08', concepto: 'ABONO SERVICIO BOMBAS', tipo: 'gasto_real', importe: 4819 },
            { id: 'mov-jun-9', fecha: '2026-06-08', concepto: 'MESADA COCINA CHICA', tipo: 'gasto_real', importe: 2225 },
            { id: 'mov-jun-10', fecha: '2026-06-10', concepto: 'ARREGLO LAVADORA', tipo: 'gasto_real', importe: 2196 },
            { id: 'mov-jun-11', fecha: '2026-06-13', concepto: 'COMPRAS FERRETERÍA', tipo: 'gasto_real', importe: 465 },
            { id: 'mov-jun-12', fecha: '2026-06-13', concepto: 'BOLSAS Y ESPONJAS', tipo: 'gasto_real', importe: 183 },
            { id: 'mov-jun-13', fecha: '2026-06-18', concepto: 'ANTEL ADSL FIJO', tipo: 'gasto_real', importe: 1925 },
            { id: 'mov-jun-14', fecha: '2026-06-18', concepto: 'PRODUCTOS DE LIMPIEZA - EL CLON', tipo: 'gasto_real', importe: 1924 },
            { id: 'mov-jun-15', fecha: '2026-06-18', concepto: 'PRODUCTOS DE LIMPIEZA Y BOLSAS - EL CLON', tipo: 'gasto_real', importe: 777 },
          ],
          saldoFinalRegistrado: 3,
          gastosPrevistos: [],
          alertasPersonalizadas: [],
        },
        '2026-07': {
          mes: '2026-07',
          estado: 'cerrado',
          presupuesto: 20000,
          presupuestoEfectivo: 20000,
          ajustes: [],
          detalleDisponible: true,
          movimientos: [
            { id: 'mov-jul-1', fecha: '2026-07-01', concepto: 'PRESUPUESTO MENSUAL', tipo: 'ingreso', importe: 20000 },
            { id: 'mov-jul-2', fecha: '2026-07-01', concepto: 'Sello para encomiendas de estudiantes', tipo: 'gasto_real', importe: 390 },
            { id: 'mov-jul-3', fecha: '2026-07-03', concepto: 'Envío de sobre - Rutas del Plata', tipo: 'gasto_real', importe: 100 },
            { id: 'mov-jul-4', fecha: '2026-07-14', concepto: 'Sanitaria', tipo: 'gasto_real', importe: 790 },
            { id: 'mov-jul-5', fecha: '2026-07-14', concepto: 'Abono sanitaria (gasto fijo mensual)', tipo: 'gasto_real', importe: 4819 },
            { id: 'mov-jul-6', fecha: '2026-07-20', concepto: 'Antel ADSL', tipo: 'gasto_real', importe: 1925 },
            { id: 'mov-jul-7', fecha: '2026-07-23', concepto: 'El Clon - Productos limpieza e higiene', tipo: 'gasto_real', importe: 1516 },
            { id: 'mov-jul-8', fecha: '2026-07-27', concepto: 'Pintura antihongos para baños', tipo: 'gasto_real', importe: 1745 },
            { id: 'mov-jul-9', fecha: '2026-07-28', concepto: 'Río Gas - Compra de envase', tipo: 'gasto_real', importe: 6362 },
            { id: 'mov-jul-10', fecha: '2026-07-29', concepto: 'Envío de factura - Rutas del Plata', tipo: 'gasto_real', importe: 100 },
            { id: 'mov-jul-11', fecha: '2026-07-29', concepto: 'Ropero - ML', tipo: 'gasto_real', importe: 1990 },
            { id: 'mov-jul-12', fecha: '2026-07-30', concepto: 'Droguería Burgués - Productos de limpieza', tipo: 'gasto_real', importe: 255 },
          ],
          saldoFinalRegistrado: 8,
          gastosPrevistos: [],
          alertasPersonalizadas: [],
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
          alertasPersonalizadas: [],
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
  let state;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    console.error('Estado guardado corrupto, se reinicia con la semilla histórica.', e);
    state = clone(SEED_STATE);
    saveState(state);
    return state;
  }
  let huboCambios = completarHistoricoDesdeSemilla(state);
  if (quitarGastosFijosObsoletos(state)) huboCambios = true;
  if (completarPrevistosRecurrentesDesdeSemilla(state)) huboCambios = true;
  if (corregirMesesActivosDuplicados(state)) huboCambios = true;
  if (huboCambios) saveState(state);
  return state;
}

// Ids de gastos fijos que existieron en versiones anteriores de la app y
// se dieron de baja (ej. "envío de sobre" y "bombas/sanitaria" pasaron a
// sugerirse como gasto previsto en vez de aparecer como recordatorio fijo
// con campana). Se quitan de los dispositivos que ya los tenían guardados;
// no afecta ningún movimiento ni previsto real, solo esta configuración de
// recordatorios.
const GASTOS_FIJOS_OBSOLETOS = ['gf-colonia-envio-sobre', 'gf-colonia-bombas'];

function quitarGastosFijosObsoletos(state) {
  let cambio = false;
  Object.values(state.hogares || {}).forEach((hogar) => {
    if (!hogar.gastosFijos) return;
    const cantidadAntes = hogar.gastosFijos.length;
    hogar.gastosFijos = hogar.gastosFijos.filter((gf) => !GASTOS_FIJOS_OBSOLETOS.includes(gf.id));
    if (hogar.gastosFijos.length !== cantidadAntes) cambio = true;
  });
  return cambio;
}

// El dispositivo guarda su propia copia del estado en localStorage, así que
// una actualización de la app (por ejemplo, cargar el detalle real de un mes
// que antes solo tenía el resumen) no llega sola a un dispositivo que ya
// tenía datos guardados. Esta función completa esos meses automáticamente al
// cargar, pero SOLO si el mes guardado todavía no tiene detalle propio
// (detalleDisponible: false) — nunca pisa un mes que ya tiene movimientos,
// así que jamás se pierde un gasto cargado a mano.
function completarHistoricoDesdeSemilla(state) {
  let cambio = false;
  Object.keys(SEED_STATE.hogares).forEach((hogarId) => {
    const hogarSemilla = SEED_STATE.hogares[hogarId];
    const hogarGuardado = state.hogares && state.hogares[hogarId];
    if (!hogarGuardado || !hogarGuardado.meses) return;
    Object.keys(hogarSemilla.meses).forEach((mesKey) => {
      const mesSemilla = hogarSemilla.meses[mesKey];
      const mesGuardado = hogarGuardado.meses[mesKey];
      if (mesGuardado && !mesGuardado.detalleDisponible && mesSemilla.detalleDisponible) {
        hogarGuardado.meses[mesKey] = clone(mesSemilla);
        cambio = true;
      }
    });
  });
  return cambio;
}

// Igual que completarHistoricoDesdeSemilla, pero para previstos recurrentes
// nuevos que se agreguen al código (ej. el abono de bombas/sanitaria, que
// pasó de recordatorio fijo con campana a sugerirse como gasto previsto):
// si el dispositivo ya tenía datos guardados y no conoce ese previsto
// recurrente por id, lo agrega. Nunca toca ni elimina previstos
// recurrentes que ya existan.
function completarPrevistosRecurrentesDesdeSemilla(state) {
  let cambio = false;
  Object.keys(SEED_STATE.hogares).forEach((hogarId) => {
    const hogarSemilla = SEED_STATE.hogares[hogarId];
    const hogarGuardado = state.hogares && state.hogares[hogarId];
    if (!hogarGuardado) return;
    hogarGuardado.previstosRecurrentes = hogarGuardado.previstosRecurrentes || [];
    (hogarSemilla.previstosRecurrentes || []).forEach((prSemilla) => {
      const yaExiste = hogarGuardado.previstosRecurrentes.some((pr) => pr.id === prSemilla.id);
      if (!yaExiste) {
        hogarGuardado.previstosRecurrentes.push(clone(prSemilla));
        cambio = true;
      }
    });
  });
  return cambio;
}

// Antes de que existiera el estado "preparado", un error dejaba crear más
// de un mes "activo" a la vez para el mismo Hogar. Este ajuste corrige, una
// sola vez, los dispositivos que ya tenían quedado ese error: se conserva
// como activo el más antiguo (el que realmente estaba en curso) y se
// elimina cualquier mes "activo" posterior que todavía no tenga ningún
// gasto cargado (solo el presupuesto inicial) — nunca se toca un mes que
// ya tenga movimientos o previstos propios, para no perder nada real.
function corregirMesesActivosDuplicados(state) {
  let cambio = false;
  Object.values(state.hogares || {}).forEach((hogar) => {
    if (!hogar.meses) return;
    const activos = Object.values(hogar.meses)
      .filter((m) => m.estado === 'activo')
      .sort((a, b) => a.mes.localeCompare(b.mes));
    if (activos.length <= 1) return;
    activos.slice(1).forEach((mesExtra) => {
      const sinGastosCargados =
        mesExtra.movimientos.length <= 1 && (mesExtra.gastosPrevistos || []).length === 0;
      if (sinGastosCargados) {
        delete hogar.meses[mesExtra.mes];
        cambio = true;
      }
    });
  });
  return cambio;
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
// Las alertas personalizadas son operativas del mes en curso, no forman
// parte del historial: al cerrar el mes se descartan (el resto de los
// datos —movimientos, saldo, previstos ya confirmados— sí quedan).
//
// Si había un mes "preparado" (creado de antemano con el próximo
// presupuesto, esperando su turno), al cerrar el mes en curso ese mes
// preparado pasa a ser el nuevo mes activo — solo puede haber uno en
// curso por vez.
function cerrarMes(mesObj, hogar) {
  mesObj.estado = 'cerrado';
  mesObj.alertasPersonalizadas = [];
  mesObj.historialEstado = mesObj.historialEstado || [];
  mesObj.historialEstado.push({ accion: 'cierre', fecha: new Date().toISOString() });

  if (hogar) {
    const preparado = mesSiguientePreparado(hogar);
    if (preparado) {
      preparado.estado = 'activo';
      preparado.historialEstado = preparado.historialEstado || [];
      preparado.historialEstado.push({ accion: 'inicio', fecha: new Date().toISOString() });
    }
  }
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

// Fecha corta para la tabla en el celular: "01/08/26". La fecha completa
// (con el año en 4 dígitos) es la que se usa en el PDF descargable.
function fechaCorta(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
}

function mesLabel(mesKey) {
  const [anio, mes] = mesKey.split('-');
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[parseInt(mes, 10) - 1]} ${anio}`;
}

const MES_ABREV = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Etiqueta corta para el selector: "JUN26", "ENE27", etc.
function mesAbrev(mesKey) {
  const [anio, mes] = mesKey.split('-');
  return `${MES_ABREV[parseInt(mes, 10) - 1]}${anio.slice(2)}`;
}

// El selector de meses solo muestra los meses que realmente existen, más
// un "+" para crear el siguiente — nunca una tira fija con casilleros
// deshabilitados. Esta función calcula cuál es ese único mes creable: el
// que sigue cronológicamente al último mes que ya existe para el Hogar.
// Así se puede ir "preparando el terreno" un mes por vez, nunca más de uno
// por delante de lo que ya está cargado.
function proximoMesCreable(hogar) {
  const claves = Object.keys(hogar.meses).sort();
  if (!claves.length) return null;
  const ultima = claves[claves.length - 1];
  const [anio, mes] = ultima.split('-').map(Number);
  const siguienteMes = mes === 12 ? 1 : mes + 1;
  const siguienteAnio = mes === 12 ? anio + 1 : anio;
  return `${siguienteAnio}-${String(siguienteMes).padStart(2, '0')}`;
}

// Solo puede haber un mes "preparado" por vez (el que espera su turno para
// convertirse en el mes en curso cuando se cierre el actual).
function mesSiguientePreparado(hogar) {
  return Object.values(hogar.meses).find((m) => m.estado === 'preparado') || null;
}

function hayMesActivo(hogar) {
  return Object.values(hogar.meses).some((m) => m.estado === 'activo');
}

// El "+" para crear el mes siguiente solo se ofrece si hay un casillero
// libre Y todavía no hay un mes preparado esperando turno — así nunca se
// puede tener más de un mes por delante del que está en curso.
function puedeCrearMesSiguiente(hogar) {
  return !!proximoMesCreable(hogar) && !mesSiguientePreparado(hogar);
}

// Crea el estado de cuenta de un mes nuevo, con el presupuesto que cargue
// el usuario como único movimiento inicial (ingreso, fechado el día 1).
// Nunca se inventa un importe: lo pone la persona en el momento de crearlo.
//
// Si ya hay un mes en curso, este nuevo mes queda "preparado": solo tiene
// el presupuesto cargado, sin ninguna otra acción disponible (nada de
// agregar gastos, previstos ni alertas) hasta que el mes en curso se
// cierre y este pase a ser el nuevo activo. Si no hay ningún mes en curso
// (por ejemplo, se cerró el anterior sin preparar este), arranca activo
// directamente.
function crearMesNuevo(hogar, mesKey, presupuestoInicial) {
  const importe = Math.round(Number(presupuestoInicial));
  const movimientoInicial = {
    id: generarId('mov'),
    fecha: primerDiaMes(mesKey),
    concepto: 'PRESUPUESTO',
    tipo: 'ingreso',
    importe,
  };
  const mesNuevo = {
    mes: mesKey,
    estado: hayMesActivo(hogar) ? 'preparado' : 'activo',
    presupuesto: importe,
    presupuestoEfectivo: importe,
    ajustes: [],
    detalleDisponible: true,
    movimientos: [movimientoInicial],
    gastosPrevistos: [],
    alertasPersonalizadas: [],
  };
  hogar.meses[mesKey] = mesNuevo;
  return mesNuevo;
}

// Un mes "preparado" todavía no es un estado de cuenta real: solo tiene el
// presupuesto inicial cargado y ninguna otra acción estuvo disponible para
// tocarlo, así que se puede borrar sin dejar rastro ni perder nada. Solo
// actúa sobre un mes que efectivamente esté en ese estado.
function eliminarMesPreparado(hogar, mesKey) {
  const mesObj = hogar.meses[mesKey];
  if (!mesObj || mesObj.estado !== 'preparado') return false;
  delete hogar.meses[mesKey];
  return true;
}

// Respaldo completo (exportar/importar): un único archivo JSON con todo el
// estado (todos los Hogares y meses), tal cual vive en localStorage. Es el
// mecanismo de sincronización manual entre el celular y la PC.
function nombreArchivoRespaldo() {
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return `Respaldo_Gestion_Hogares_${iso}.json`;
}

function descargarArchivo(nombreArchivo, contenido, tipoMime) {
  const blob = new Blob([contenido], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Chequeo mínimo de que el archivo elegido para importar tiene la forma de
// un respaldo de esta app, antes de reemplazar los datos del dispositivo.
function esRespaldoValido(obj) {
  return !!obj && typeof obj === 'object' && obj.hogares && typeof obj.hogares === 'object';
}

// Gastos recurrentes de importe variable (ej. envío de sobre): a diferencia
// de un gasto fijo, se sugieren como gasto PREVISTO del mes activo en vez
// de aparecer como recordatorio. Solo se agregan si el mes está activo y
// todavía no hay ni un previsto ni un movimiento real con ese concepto —
// así nunca se duplican ni se pisa algo que el usuario ya cargó a mano.
function asegurarPrevistosRecurrentes(hogar, mesObj) {
  if (mesObj.estado !== 'activo') return false;
  const normalizar = (s) => s.toLowerCase().trim();
  let cambio = false;
  mesObj.gastosPrevistos = mesObj.gastosPrevistos || [];
  (hogar.previstosRecurrentes || []).forEach((pr) => {
    const yaComoPrevisto = mesObj.gastosPrevistos.some((p) => normalizar(p.concepto) === normalizar(pr.concepto));
    const yaComoMovimiento = (mesObj.movimientos || []).some((m) => normalizar(m.concepto).includes(normalizar(pr.concepto).split(' (')[0]));
    if (!yaComoPrevisto && !yaComoMovimiento) {
      mesObj.gastosPrevistos.push({
        id: generarId('prev'),
        concepto: pr.concepto,
        importeEstimado: pr.importeEstimado,
        confirmado: false,
        nota: pr.nota || '',
      });
      cambio = true;
    }
  });
  return cambio;
}

// Días que faltan para el último día del mes (para las alertas de cierre).
// Puede dar negativo si ya pasó; se usa solo si el mes sigue activo.
function diasRestantesParaCerrar(mesKey) {
  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const fin = ultimoDiaMes(mesKey);
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((new Date(`${fin}T00:00:00`) - new Date(`${hoyISO}T00:00:00`)) / msPorDia);
}

const MAX_ALERTAS_PERSONALIZADAS = 10;

// Devuelve la alerta creada, o 'limite' si ya se llegó al máximo (para
// evitar saturar la app de notas), o null si el texto vino vacío.
function agregarAlertaPersonalizada(mesObj, texto) {
  const limpio = (texto || '').trim();
  if (!limpio) return null;
  mesObj.alertasPersonalizadas = mesObj.alertasPersonalizadas || [];
  if (mesObj.alertasPersonalizadas.length >= MAX_ALERTAS_PERSONALIZADAS) return 'limite';
  const alerta = { id: generarId('alerta'), texto: limpio };
  mesObj.alertasPersonalizadas.push(alerta);
  return alerta;
}

function eliminarAlertaPersonalizada(mesObj, id) {
  mesObj.alertasPersonalizadas = (mesObj.alertasPersonalizadas || []).filter((a) => a.id !== id);
}
