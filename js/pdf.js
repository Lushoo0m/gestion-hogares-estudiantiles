// Generación de PDF del estado de cuenta, 100% en el navegador (sin
// servidor), para poder descargar un respaldo de cualquier mes —viejo o
// activo— desde el celular, incluso sin conexión. El concepto SIEMPRE
// aparece completo acá, aunque en la tabla de la app se vea truncado.
//
// Formato estandarizado para enviar al municipio: solo el encabezado del
// Hogar, el mes y la tabla Fecha/Concepto/Gasto/Saldo + el saldo actual.
// Presupuesto, ajustes y previstos son información interna de gestión que
// no forma parte de esta rendición, así que no se imprimen acá (siguen
// visibles en la app).

const PDF_COLOR_ENCABEZADO = [31, 58, 92]; // azul oscuro de la barra de título de la tabla
const PDF_COLOR_ZEBRA = [234, 240, 246]; // banda clara alternada, estilo resumen de tarjeta
const PDF_COLOR_GASTO = [176, 48, 40]; // rojo, para que el gasto se lea rápido
const PDF_COLOR_INGRESO = [30, 130, 90]; // verde, para ingresos/depósitos
const PDF_COLOR_SALDO = [20, 30, 45]; // casi negro, en negrita

function quitarAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function nombreArchivoPdf(hogar, mesObj) {
  const [anio, mes] = mesObj.mes.split('-');
  const nombresMes = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const mesNombre = nombresMes[parseInt(mes, 10) - 1];
  const hogarSlug = quitarAcentos(hogar.nombre).replace(/\s+/g, '_');
  return `Estado_de_Cuenta_${hogarSlug}_${mesNombre}_${anio}.pdf`;
}

function mesYAnioMayusculas(mesKey) {
  return mesLabel(mesKey).toUpperCase();
}

function generarPdfEstadoCuenta(hogar, mesObj) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const margenIzq = 15;
  const margenDer = 195;
  const altoPagina = 282;
  let y = 20;

  const nuevaPaginaSiHaceFalta = (espacioNecesario) => {
    if (y + espacioNecesario > altoPagina) {
      doc.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  // Encabezado fijo: nombre de la institución, Hogar y mes/año.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('HOGAR ESTUDIANTIL RIO BRANCO (Estado de Cuenta)', margenIzq, y);
  y += 8;

  doc.setFontSize(12);
  doc.text(hogar.nombre, margenIzq, y);
  y += 7;
  doc.text(mesYAnioMayusculas(mesObj.mes), margenIzq, y);
  y += 10;

  if (!mesObj.detalleDisponible) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No hay detalle de movimientos disponible para este mes.', margenIzq, y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Saldo Actual: ${formatMoney(mesObj.saldoFinalRegistrado)}`, margenIzq, y);
  } else {
    const movs = movimientosConSaldo(mesObj);
    const saldoCalculado = movs.length ? movs[movs.length - 1].saldo : 0;

    const colFecha = margenIzq + 2;
    const colConcepto = margenIzq + 24;
    const colGasto = margenDer - 45;
    const colSaldo = margenDer - 2;
    const anchoConcepto = colGasto - colConcepto - 3;
    const alturaEncabezado = 7;

    const dibujarEncabezadoTabla = () => {
      doc.setFillColor(...PDF_COLOR_ENCABEZADO);
      doc.rect(margenIzq, y, margenDer - margenIzq, alturaEncabezado, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('FECHA', colFecha, y + alturaEncabezado - 2.3);
      doc.text('CONCEPTO', colConcepto, y + alturaEncabezado - 2.3);
      doc.text('GASTO', colGasto, y + alturaEncabezado - 2.3, { align: 'right' });
      doc.text('SALDO', colSaldo, y + alturaEncabezado - 2.3, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += alturaEncabezado;
      doc.setFont('helvetica', 'normal');
    };

    dibujarEncabezadoTabla();

    movs.forEach((m, idx) => {
      doc.setFontSize(8.5);
      const lineasConcepto = doc.splitTextToSize(m.concepto, anchoConcepto);
      const alturaFila = Math.max(6, lineasConcepto.length * 4 + 1.5);

      const saltoDePagina = nuevaPaginaSiHaceFalta(alturaFila);
      if (saltoDePagina) dibujarEncabezadoTabla();

      // Renglones alternados de color, como un resumen de tarjeta de crédito,
      // para que cada línea se distinga fácil de la siguiente.
      if (idx % 2 === 1) {
        doc.setFillColor(...PDF_COLOR_ZEBRA);
        doc.rect(margenIzq, y, margenDer - margenIzq, alturaFila, 'F');
      }

      const yTexto = y + alturaFila / 2 - (lineasConcepto.length - 1) * 2 + 1.2;

      doc.setTextColor(30, 30, 30);
      doc.text(m.fecha.split('-').reverse().join('/'), colFecha, yTexto);
      doc.text(lineasConcepto, colConcepto, yTexto);

      if (m.tipo === 'ingreso') {
        doc.setTextColor(...PDF_COLOR_INGRESO);
        doc.setFont('helvetica', 'bold');
        doc.text('+' + formatMoney(m.importe), colGasto, yTexto, { align: 'right' });
      } else {
        doc.setTextColor(...PDF_COLOR_GASTO);
        doc.setFont('helvetica', 'normal');
        doc.text(formatMoney(m.importe), colGasto, yTexto, { align: 'right' });
      }

      doc.setTextColor(...PDF_COLOR_SALDO);
      doc.setFont('helvetica', 'bold');
      doc.text(formatMoney(m.saldo), colSaldo, yTexto, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      y += alturaFila;
    });

    y += 6;
    nuevaPaginaSiHaceFalta(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Saldo Actual: ${formatMoney(saldoCalculado)}`, margenIzq, y);
  }

  const fechaGeneracion = new Date();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generado el ${fechaGeneracion.toLocaleDateString('es-UY')} ${fechaGeneracion.toLocaleTimeString('es-UY')}`, margenIzq, 290);
  doc.setTextColor(0);

  doc.save(nombreArchivoPdf(hogar, mesObj));
}
