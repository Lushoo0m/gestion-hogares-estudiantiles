// Generación de PDF del estado de cuenta, 100% en el navegador (sin
// servidor), para poder descargar un respaldo de cualquier mes —viejo o
// activo— desde el celular, incluso sin conexión. El concepto SIEMPRE
// aparece completo acá, aunque en la tabla de la app se vea truncado.

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

function generarPdfEstadoCuenta(hogar, mesObj) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const margenIzq = 15;
  const margenDer = 195;
  const anchoPagina = margenDer - margenIzq;
  const altoPagina = 282;
  let y = 20;

  const nuevaPaginaSiHaceFalta = (espacioNecesario) => {
    if (y + espacioNecesario > altoPagina) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Hogar Estudiantil - Estado de Cuenta', margenIzq, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(`${hogar.nombre} - ${mesLabel(mesObj.mes).replace(/^\w/, (c) => c.toUpperCase())}`, margenIzq, y);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Presupuesto habitual: ${formatMoney(mesObj.presupuesto)}`, margenIzq, y);
  y += 5.5;
  if (mesObj.presupuestoEfectivo !== mesObj.presupuesto) {
    doc.text(`Presupuesto efectivo: ${formatMoney(mesObj.presupuestoEfectivo)}`, margenIzq, y);
    y += 5.5;
  }
  if (mesObj.ajustes && mesObj.ajustes.length) {
    mesObj.ajustes.forEach((aj) => {
      doc.text(`Ajuste - ${aj.concepto}: ${formatMoney(aj.importe)}`, margenIzq, y);
      y += 5.5;
    });
  }
  y += 2;

  if (mesObj.estado === 'cerrado') {
    doc.setTextColor(120);
    doc.text('Estado de cuenta cerrado (solo lectura).', margenIzq, y);
    doc.setTextColor(0);
    y += 6;
  }

  if (!mesObj.detalleDisponible) {
    y += 2;
    doc.setFont('helvetica', 'normal');
    doc.text('No hay detalle de movimientos disponible para este mes, solo el resumen del cierre.', margenIzq, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Saldo disponible final: ${formatMoney(mesObj.saldoFinalRegistrado)}`, margenIzq, y);
  } else {
    const movs = movimientosConSaldo(mesObj);
    const saldoCalculado = movs.length ? movs[movs.length - 1].saldo : 0;

    const colFecha = margenIzq;
    const colConcepto = margenIzq + 22;
    const colGasto = margenDer - 45;
    const colSaldo = margenDer - 20;
    const anchoConcepto = colGasto - colConcepto - 3;

    const dibujarEncabezadoTabla = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('FECHA', colFecha, y);
      doc.text('CONCEPTO', colConcepto, y);
      doc.text('GASTO', colGasto, y, { align: 'right' });
      doc.text('SALDO', colSaldo, y, { align: 'right' });
      y += 2;
      doc.setLineWidth(0.2);
      doc.line(margenIzq, y, margenDer, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
    };

    dibujarEncabezadoTabla();

    movs.forEach((m) => {
      const lineasConcepto = doc.splitTextToSize(m.concepto, anchoConcepto);
      const alturaFila = Math.max(5, lineasConcepto.length * 4.2);

      nuevaPaginaSiHaceFalta(alturaFila + 5);
      if (y === 20) dibujarEncabezadoTabla();

      doc.setFontSize(8.5);
      doc.text(m.fecha.split('-').reverse().join('/'), colFecha, y);
      doc.text(lineasConcepto, colConcepto, y);
      doc.text(m.tipo === 'ingreso' ? '+' + formatMoney(m.importe) : formatMoney(m.importe), colGasto, y, { align: 'right' });
      doc.text(formatMoney(m.saldo), colSaldo, y, { align: 'right' });

      y += alturaFila;
      doc.setDrawColor(210);
      doc.setLineWidth(0.1);
      doc.line(margenIzq, y - 1.5, margenDer, y - 1.5);
      y += 1.5;
    });

    y += 4;
    nuevaPaginaSiHaceFalta(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Saldo disponible: ${formatMoney(saldoCalculado)}`, margenIzq, y);
    y += 8;

    if (mesObj.saldoFinalRegistrado !== undefined && mesObj.estado === 'cerrado' && saldoCalculado !== mesObj.saldoFinalRegistrado) {
      nuevaPaginaSiHaceFalta(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(180, 40, 30);
      doc.text(`Nota: el saldo calculado no coincide con el saldo de cierre registrado (${formatMoney(mesObj.saldoFinalRegistrado)}). Revisar.`, margenIzq, y);
      doc.setTextColor(0);
      y += 7;
    }

    // Los previstos solo son relevantes en el mes que está transcurriendo:
    // un mes cerrado no los muestra, igual que en la app.
    if (mesObj.estado === 'activo' && mesObj.gastosPrevistos && mesObj.gastosPrevistos.length) {
      nuevaPaginaSiHaceFalta(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Gastos previstos (no descuentan del saldo)', margenIzq, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      mesObj.gastosPrevistos.forEach((p) => {
        const texto = `- ${p.concepto}: ${formatMoney(p.importeEstimado)}${p.nota ? ` (${p.nota})` : ''}`;
        const lineas = doc.splitTextToSize(texto, anchoPagina);
        nuevaPaginaSiHaceFalta(lineas.length * 4.5);
        doc.text(lineas, margenIzq, y);
        y += lineas.length * 4.5;
      });
    }
  }

  const fechaGeneracion = new Date();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.text(`Generado el ${fechaGeneracion.toLocaleDateString('es-UY')} ${fechaGeneracion.toLocaleTimeString('es-UY')}`, margenIzq, 290);
  doc.setTextColor(0);

  doc.save(nombreArchivoPdf(hogar, mesObj));
}
