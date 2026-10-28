/**
 * SalesIA Enterprise — Generador de Comprobantes de Pago en PDF (SUNAT).
 *
 * Dos formatos de impresión:
 *  - 'A4'       → Documento completo estilo carta (archivo / dossier fiscal).
 *  - 'TICKET80' → Ticket de 80mm para impresoras térmicas (tickeras de caja).
 *
 * El flujo NO descarga directo: abre la VISTA PREVIA del PDF en otra pestaña
 * (blob URL); el visor del navegador ofrece el botón de descarga / impresión.
 *
 * NOTA DE RENDER (corrige el bug visual de desbordes a la derecha):
 *  - jsPDF no incrusta la Helvetica estándar: el visor la sustituye por una
 *    ligeramente más ancha, por lo que se reservan MÁRGENES DE SEGURIDAD.
 *  - Todos los montos se dibujan con align:'right' anclados a columnas fijas
 *    reales (jamás con coordenadas calculadas a mano).
 *  - Se evitan glifos de sustitución problemática (—, •) cerca de los bordes.
 */
import { jsPDF } from 'jspdf';
import { Sale, Customer, Local, Payment } from '../../../types';

export type ComprobanteFormato = 'A4' | 'TICKET80';

const EMPRESA = {
  razon_social: 'SalesIA Tech Solutions S.A.C.',
  ruc: 'RUC: 20608912345',
  direccion: 'Av. República de Panamá 3505, San Isidro, Lima - Perú',
  telefono: '+51 (01) 555-1200  *  ventas@salesia.com',
};

const fmt = (v: string | number | undefined) =>
  `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

/** Código de verificación pseudocode estable a partir del código de venta */
function codigoVerificacion(sale_code: string): string {
  let h = 7;
  for (let i = 0; i < sale_code.length; i++) h = (h * 31 + sale_code.charCodeAt(i)) % 100000000;
  return String(h).padStart(8, '0').replace(/(.{4})(.{4})/, '$1-$2');
}

export function serieNumeroDe(sale: Sale): string {
  return `${sale.document_series || 'VTA'}-${String(sale.document_number || 0).padStart(8, '0')}`;
}

/**
 * Datos de emisión: si la venta proviene de un local/sucursal conocido, el
 * comprobante imprime el NOMBRE y DIRECCIÓN de ese local (normativa SUNAT);
 * la matriz se usa como respaldo.
 */
function datosEmisor(local?: Local | null): { nombre: string; ruc: string; direccion: string; telefono: string } {
  return {
    nombre: local?.nombre || EMPRESA.razon_social,
    ruc: EMPRESA.ruc,
    direccion: local?.direccion || EMPRESA.direccion,
    telefono: local
      ? `${local.telefono}  *  ventas@salesia.com`
      : EMPRESA.telefono,
  };
}

/* ===========================================================================
 * FORMATO A4 — Documento fiscal completo
 * ===========================================================================
 */
export function construirA4(sale: Sale, customer?: Customer, local?: Local, pagos?: Payment[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;               // margen lateral ampliado (seguridad de render)
  const DERECHA = W - M;      // ancla derecha para TODOS los valores
  const COL_PRECIO = DERECHA - 128;   // borde derecho de la columna P. UNIT.
  const COL_IMPORTE = DERECHA - 6;    // borde derecho de la columna IMPORTE (inset sutil)

  const EMISOR = datosEmisor(local);

  const esFactura = sale.document_type === 'FACTURA';
  const tipoTitulo = esFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA';
  const serieNumero = serieNumeroDe(sale);
  const docCliente = customer ? `${customer.doc_type}: ${customer.doc_number}` : '—';
  const nombreCliente = sale.customer_name || customer?.full_name || 'Cliente';
  const condPago = sale.payment_condition || 'CONTADO';

  // ---------------------------------------------------------------- Banda superior
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 92, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(EMISOR.nombre, M, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(EMISOR.ruc, M, 50);
  doc.text(EMISOR.direccion, M, 63);
  doc.text(EMISOR.telefono, M, 76);

  // Bloque derecho: título + condición (anclados al margen con align right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(tipoTitulo, DERECHA, 34, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Condición: ${condPago}`, DERECHA, 50, { align: 'right' });

  // Número de comprobante destacado (caja centrada sobre su propio ancho)
  const boxW = 150; const boxH = 26; const boxX = DERECHA - boxW; const boxY = 58;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1);
  doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(serieNumero, boxX + boxW / 2, boxY + 17, { align: 'center' });

  // ---------------------------------------------------------------- Datos del cliente
  let y = 132;
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CLIENTE', M, y);
  doc.text(esFactura ? 'DESTINATARIO / EMPRESA' : 'CONSUMIDOR FINAL', W - M - 130, y);

  y += 16;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.text(nombreCliente, M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(docCliente, W - M - 130, y);

  y += 14;
  doc.setFontSize(9.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Dirección: ${customer?.address || 'No registrada'}`, M, y);
  doc.text(`Fecha de emisión: ${new Date(sale.created_at).toLocaleDateString('es-PE')}`, W - M - 130, y);

  y += 13;
  doc.text(`Correo: ${customer?.email || '-'}   *   Teléfono: ${customer?.phone || '-'}`, M, y);
  doc.text(`Vendedor: ${sale.salesperson_name || '-'}`, W - M - 130, y);

  // ---------------------------------------------------------------- Tabla de items
  y += 26;
  const cols = { cant: M, desc: M + 34 };
  doc.setFillColor(241, 245, 249);
  doc.rect(M, y, DERECHA - M, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('CANT.', cols.cant, y + 15);
  doc.text('DESCRIPCIÓN', cols.desc, y + 15);
  doc.text('P. UNIT.', COL_PRECIO, y + 15, { align: 'right' });
  doc.text('IMPORTE', COL_IMPORTE, y + 15, { align: 'right' });

  y += 34;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9.5);

  // Presupuesto de caracteres de la descripción hasta la columna de P. UNIT.
  const anchoDisponibleNombre = COL_PRECIO - cols.desc - 14;
  const charsEstimados = Math.floor(anchoDisponibleNombre / 4.9);

  (sale.items || []).forEach((it) => {
    if (y > 700) { doc.addPage(); y = 56; }
    doc.setFont('helvetica', 'bold');
    doc.text(String(it.quantity), cols.cant, y);
    doc.setFont('helvetica', 'normal');
    const nombre = `${it.product_name} (${it.product_sku})`;
    doc.text(nombre.length > charsEstimados ? `${nombre.slice(0, Math.max(10, charsEstimados - 1))}...` : nombre, cols.desc, y);
    doc.text(fmt(it.unit_price), COL_PRECIO, y, { align: 'right' });
    doc.text(fmt(it.line_total), COL_IMPORTE, y, { align: 'right' });
    y += 18;
  });

  // ---------------------------------------------------------------- Totales / tesorería
  const totalBoxW = 232;
  const totalBoxX = DERECHA - totalBoxW;
  if (y > 620) { doc.addPage(); y = 56; }
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(totalBoxX, y, totalBoxW, 118, 6, 6, 'S');

  let ty = y + 24;
  doc.setFontSize(10);
  const fila = (etiqueta: string, valor: string, bold = false, color?: [number, number, number]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    if (color) doc.setTextColor(color[0], color[1], color[2]); else doc.setTextColor(50, 50, 50);
    doc.text(etiqueta, totalBoxX + 12, ty);
    doc.text(valor, totalBoxX + totalBoxW - 10, ty, { align: 'right' });
    ty += 20;
  };
  fila('Subtotal Neto:', fmt(sale.subtotal));
  fila('IGV (18%):', fmt(sale.tax_amount));
  fila(`TOTAL (${condPago}):`, fmt(sale.total_amount), true, [15, 23, 42]);
  fila('Importe cobrado:', fmt(sale.paid_amount), false, [16, 130, 82]);
  const saldoNum = Math.max(0, Number(sale.pending_balance || 0));
  if (saldoNum <= 0.005) {
    fila('ESTADO DE COBRO:', 'PAGO COMPLETADO', true, [16, 130, 82]);
  } else {
    fila('Saldo pendiente:', fmt(sale.pending_balance), false, [190, 40, 62]);
  }

  // ---------------------------------------------------------------- Pie legal
  let py = Math.max(y + 140, 690);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.text(`Estado de venta: ${sale.status}   *   Estado de cobro: ${sale.payment_status}`, M, py);
  py += 14;
  // Nota de condición de operación según el estado real de cobranza
  const notaCondicion = (() => {
    if (condPago === 'CONTADO') return 'Contado - cobro al contado en caja';
    if (saldoNum <= 0.005) return 'Crédito - saldo amortizado por completo (cancelado)';
    if (Number(sale.paid_amount || 0) > 0) return 'Crédito - parcialmente amortizado en módulo de Pagos';
    return 'Crédito - documento en vigencia SIN cobros registrados (amortizable en módulo de Pagos)';
  })();
  doc.text(`Condición de Operación: ${notaCondicion}`, M, py);
  py += 14;
  // Historial de amortizaciones (si los cobros fueron pasados a la vista)
  if (pagos && pagos.length > 0) {
    const ordenados = [...pagos].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
    const ultimo = ordenados[ordenados.length - 1];
    const fechaUltimo = new Date(ultimo.payment_date).toLocaleDateString('es-PE');
    doc.text(`Amortizaciones registradas: ${ordenados.length} - último cobro: ${fechaUltimo} por ${fmt(ultimo.amount)}`, M, py);
    py += 14;
  }
  doc.text('Representación impresa del comprobante de pago válido para registro interno (OSE / SUNAT).', M, py);
  py += 14;
  doc.text('Auditoría y trazabilidad garantizada por el Sistema SalesIA Enterprise.', M, py);
  py += 24;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 70, 70);
  doc.text(`Código de Verificación: ${codigoVerificacion(sale.sale_code)}`, M, py);

  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Generado electrónicamente por SalesIA Enterprise. Todos los derechos reservados.', M, doc.internal.pageSize.getHeight() - 28);

  return doc;
}

/* ===========================================================================
 * FORMATO TICKET 80MM — Impresoras térmicas (tickeras de caja)
 * ===========================================================================
 */
export function construirTicket80(sale: Sale, customer?: Customer, local?: Local): jsPDF {
  const ANCHO = 80;                 // mm
  const MARGEN = 5;                 // margen lateral con holgura térmica
  const DERECHA = ANCHO - MARGEN;   // 75 mm: ancla derecha de TODOS los importes
  const UTIL = ANCHO - MARGEN * 2;  // 70 mm útiles
  const EMISOR = datosEmisor(local);
  const nombreCliente = sale.customer_name || customer?.full_name || 'Cliente';
  const condPago = sale.payment_condition || 'CONTADO';
  const serieNumero = serieNumeroDe(sale);

  // --- Primera pasada: medir líneas para altura exacta del ticket ---
  const probe = new jsPDF({ unit: 'mm', format: [ANCHO, 600] });
  const mmPorLinea = (pt: number) => (pt * 0.3528) * 1.25;
  const contarLineas = (texto: string, ancho: number, pt: number, bold: boolean) => {
    probe.setFont('helvetica', bold ? 'bold' : 'normal');
    probe.setFontSize(pt);
    return probe.splitTextToSize(String(texto || ''), ancho).length;
  };
  // Ancho de un importe ya formateado, en la fuente del ticket
  const anchoImporte = (importe: string) => {
    probe.setFont('helvetica', 'bold');
    probe.setFontSize(7);
    return probe.getTextWidth(importe);
  };
  const sepada = '---------------------------------------';

  // Líneas de cada ítem mesuradas con su importe real (reserva la columna monetaria)
  const lineasPorItem = (sale.items || []).map((it) => {
    const importe = fmt(it.line_total);
    const zonaNombre = Math.max(30, UTIL - anchoImporte(importe) - 4);
    probe.setFont('helvetica', 'normal');
    probe.setFontSize(7);
    const lineas = probe.splitTextToSize(`${it.quantity} x ${it.product_name}`, zonaNombre) as string[];
    return { importe, lineas, nLineas: Math.max(1, lineas.length) };
  });

  let h = 3; // margen superior
  h += contarLineas(EMISOR.nombre, UTIL, 8, true) * mmPorLinea(8);
  h += contarLineas(EMISOR.ruc, UTIL, 6.5, false) * mmPorLinea(6.5);
  h += contarLineas(EMISOR.direccion, UTIL, 6.5, false) * mmPorLinea(6.5);
  h += contarLineas(EMISOR.telefono, UTIL, 6.5, false) * mmPorLinea(6.5);
  h += mmPorLinea(8); // separador
  h += mmPorLinea(8); // tipo
  h += mmPorLinea(9); // serie-número
  h += mmPorLinea(7); // documento cliente
  h += contarLineas(nombreCliente, UTIL, 7, false) * mmPorLinea(7);
  h += mmPorLinea(6.5); // fecha + condición
  h += mmPorLinea(8);   // separador
  lineasPorItem.forEach(li => { h += li.nLineas * mmPorLinea(7); });
  h += mmPorLinea(8);   // separador
  h += mmPorLinea(7);   // subtotal
  h += mmPorLinea(7);   // IGV
  h += mmPorLinea(8.5); // TOTAL
  h += mmPorLinea(7);   // cobrado
  if (Number(sale.pending_balance || 0) > 0) h += mmPorLinea(7); // saldo
  else h += mmPorLinea(6.5); // sello PAGO COMPLETADO
  h += mmPorLinea(8);     // separador
  h += mmPorLinea(6.5);   // estado venta / cobro
  h += contarLineas('Auditoría y trazabilidad garantizada por el', UTIL, 5.5, false) * mmPorLinea(5.5);
  h += mmPorLinea(5.5);   // Sistema SalesIA Enterprise
  h += mmPorLinea(6.5);   // código verificación
  h += 3; // margen inferior

  // --- Segunda pasada: dibujar sobre el ticket con altura medida ---
  const doc = new jsPDF({ unit: 'mm', format: [ANCHO, Math.max(60, Math.ceil(h * 4) / 4)] });
  const centro = (texto: string, y: number, pt: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(pt);
    doc.text(texto, ANCHO / 2, y, { align: 'center' });
  };
  const izq = (texto: string, y: number, pt: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(pt);
    doc.text(texto, MARGEN, y);
  };
  const der = (texto: string, y: number, pt: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(pt);
    doc.text(texto, DERECHA, y, { align: 'right' });
  };
  const sep = (y: number) => centro(sepada, y, 8);

  let y = 3 + mmPorLinea(8) - 1.2; // primera línea base
  centro(EMISOR.nombre, y, 8, true); y += mmPorLinea(8);
  centro(EMISOR.ruc, y, 6.5); y += mmPorLinea(6.5);
  probe.setFontSize(6.5);
  (probe.splitTextToSize(EMISOR.direccion, UTIL) as string[]).forEach((l: string) => { centro(l, y, 6.5); y += mmPorLinea(6.5); });
  (probe.splitTextToSize(EMISOR.telefono, UTIL) as string[]).forEach((l: string) => { centro(l, y, 6.5); y += mmPorLinea(6.5); });
  sep(y - 1); y += mmPorLinea(8);

  // Tipo y serie
  const esFactura = sale.document_type === 'FACTURA';
  centro(esFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA', y, 8, true); y += mmPorLinea(8);
  centro(serieNumero, y, 9, true); y += mmPorLinea(9);

  // Cliente
  izq(`${customer?.doc_type || 'DOC'}: ${customer?.doc_number || '-'}`, y, 7); y += mmPorLinea(7);
  probe.setFont('helvetica', 'normal');
  probe.setFontSize(7);
  (probe.splitTextToSize(nombreCliente, UTIL) as string[]).slice(0, 2).forEach((l: string) => { izq(l, y, 7); y += mmPorLinea(7); });
  izq(new Date(sale.created_at).toLocaleDateString('es-PE') + `  *  ${condPago}`, y, 6.5); y += mmPorLinea(6.5);
  sep(y - 1); y += mmPorLinea(8);

  // Ítems: "CANT x Nombre ....... IMPORTE" (importe anclado a la derecha)
  lineasPorItem.forEach((li) => {
    der(li.importe, y, 7, true);
    li.lineas.forEach((l: string) => { izq(l, y, 7); y += mmPorLinea(7); });
  });
  sep(y - 1); y += mmPorLinea(8);

  // Totales: etiquetas a la izquierda, montos SIEMPRE anclados a DERECHA
  const totalFila = (etiqueta: string, valor: string, pt: number, bold = false) => {
    izq(etiqueta, y, pt, bold);
    der(valor, y, pt, bold);
    y += mmPorLinea(pt);
  };
  totalFila('Subtotal:', fmt(sale.subtotal), 7);
  totalFila('IGV (18%):', fmt(sale.tax_amount), 7);
  totalFila('TOTAL:', fmt(sale.total_amount), 8.5, true);
  totalFila('Cobrado:', fmt(sale.paid_amount), 7);
  if (Number(sale.pending_balance || 0) > 0) {
    totalFila('SALDO PENDIENTE:', fmt(sale.pending_balance), 7, true);
  } else {
    centro('* PAGO COMPLETADO *', y, 6.5, true); y += mmPorLinea(6.5);
  }
  sep(y - 1); y += mmPorLinea(8);

  // Pie
  izq(`Venta: ${sale.status}  *  Cobro: ${sale.payment_status}`, y, 6.5); y += mmPorLinea(6.5);
  centro('Auditoría y trazabilidad garantizada por', y, 5.5); y += mmPorLinea(5.5);
  centro('el Sistema SalesIA Enterprise', y, 5.5); y += mmPorLinea(5.5);
  izq(`Cod. Verif.: ${codigoVerificacion(sale.sale_code)}`, y, 6.5, true); y += mmPorLinea(6.5);

  return doc;
}

/* ===========================================================================
 * VISTA PREVIA — Abre el PDF en una pestaña nueva (no descarga directo)
 * ===========================================================================
 */
export function generarComprobantePdf(
  sale: Sale,
  customer?: Customer,
  formato: ComprobanteFormato = 'A4',
  local?: Local,
  pagos?: Payment[]
): void {
  const doc =
    formato === 'TICKET80'
      ? construirTicket80(sale, customer, local)
      : construirA4(sale, customer, local, pagos);

  const url = doc.output('bloburl') as unknown as string;
  const ventana = window.open(url, '_blank');
  // Si el navegador bloquea el popup, se cae a descarga directa para no perder el documento
  if (!ventana) {
    const nombreCliente = sale.customer_name || customer?.full_name || 'Cliente';
    doc.save(`${serieNumeroDe(sale)}_${nombreCliente.replace(/[^\w]+/g, '_')}_${formato}.pdf`);
  }
}

export default generarComprobantePdf;
