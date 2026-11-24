/**
 * Exportador real a Excel (.xlsx) para Rendiciones de Viaje.
 * Genera libros multi-hoja con sumas automáticas (=SUM / =SUMIF),
 * formato de moneda CLP ($#,##0) e hipervínculos clicables a boletas y fotos.
 */
import { getPlatformConfig } from './platformConfig';

export const TRIP_EXPENSE_CATEGORIES = [
  {
    id: 'combustible',
    label: 'Combustibles',
    shortLabel: 'Combustible',
    description: 'Cargas de bencina / diésel con boleta y foto de estanque',
    presets: ['Copec', 'Shell', 'Petrobras', 'Aramco', 'Estación Local']
  },
  {
    id: 'peaje',
    label: 'Peajes',
    shortLabel: 'Peajes',
    description: 'Plazas de peaje troncales, laterales o pórticos TAG',
    presets: ['Peaje Troncal', 'Peaje Lateral', 'Pórtico TAG', 'Autopista Concesionada']
  },
  {
    id: 'viatico',
    label: 'Viáticos',
    shortLabel: 'Viáticos',
    description: 'Desayunos, almuerzos, cenas e hidratación en ruta',
    presets: ['Desayuno', 'Almuerzo', 'Cena', 'Colación / Hidratación', 'Viático Día Completo']
  },
  {
    id: 'alojamiento',
    label: 'Alojamientos',
    shortLabel: 'Alojamientos',
    description: 'Hotel, hostal o cabaña por estadía en viaje',
    presets: ['Hotel', 'Hostal / Residencial', 'Cabaña', 'Motel de Ruta']
  },
  {
    id: 'extra',
    label: 'Gastos Extra',
    shortLabel: 'Gastos Extra',
    description: 'Estacionamientos, pinchazos, insumos u otros imprevistos',
    presets: ['Estacionamiento', 'Vulcanización / Pinchazo', 'Lavado', 'Taxi / Traslado', 'Insumos de Ruta']
  }
];

export const TRIP_REPORT_STATUS_META = {
  draft: { label: 'Borrador', badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
  submitted: { label: 'Enviada', badgeClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  approved: { label: 'Aprobada', badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  observed: { label: 'Observada', badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' }
};

export const calculateTripReportTotals = (items = [], advanceAmount = 0) => {
  const byCategory = {
    combustible: 0,
    peaje: 0,
    viatico: 0,
    alojamiento: 0,
    extra: 0
  };
  const countsByCategory = {
    combustible: 0,
    peaje: 0,
    viatico: 0,
    alojamiento: 0,
    extra: 0
  };

  let totalAmount = 0;
  let itemsWithPhoto = 0;

  (Array.isArray(items) ? items : []).forEach(item => {
    const amt = Number(item?.amount) || 0;
    const cat = byCategory[item?.category] !== undefined ? item.category : 'extra';
    byCategory[cat] += amt;
    countsByCategory[cat] += 1;
    totalAmount += amt;
    if (item?.photoUrl || item?.receiptPhoto || item?.secondaryPhotoUrl) {
      itemsWithPhoto += 1;
    }
  });

  const advance = Number(advanceAmount) || 0;
  const balanceDifference = advance - totalAmount;

  return {
    byCategory,
    countsByCategory,
    totalAmount,
    advanceAmount: advance,
    balanceDifference,
    itemCount: Array.isArray(items) ? items.length : 0,
    itemsWithPhoto
  };
};

const sanitizeSheetFileName = (text) =>
  String(text || 'Rendicion_Viaje')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'Rendicion_Viaje';

const formatShortDate = (value) => {
  if (!value) return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('es-CL');
};

const getCategoryLabel = (catId) =>
  TRIP_EXPENSE_CATEGORIES.find(c => c.id === catId)?.label || 'Gastos Extra';

const getStatusLabel = (status) =>
  TRIP_REPORT_STATUS_META[status]?.label || 'Borrador';

const formatExtraMeta = (item) => {
  const parts = [];
  if (item.category === 'combustible') {
    if (Number(item.liters) > 0) parts.push(`${item.liters} L`);
    if (Number(item.odometerKm) > 0) parts.push(`${Number(item.odometerKm).toLocaleString('es-CL')} km`);
  } else if (item.category === 'alojamiento') {
    if (item.location) parts.push(item.location);
    if (Number(item.nights) > 0) parts.push(`${item.nights} noche${Number(item.nights) > 1 ? 's' : ''}`);
  } else if (item.location) {
    parts.push(item.location);
  }
  return parts.join(' | ') || '-';
};

const getPhotoLinkCell = (url, label) => {
  if (url && /^https?:\/\//i.test(url)) {
    const safeUrl = url.replace(/"/g, '""');
    return { t: 's', v: label, f: `HYPERLINK("${safeUrl}","${label}")` };
  }
  if (url && String(url).startsWith('data:image')) {
    return { t: 's', v: 'Foto local (sin subir)' };
  }
  return { t: 's', v: 'Sin foto' };
};

const downloadOrShareWorkbook = async (XLSX, workbook, fileName) => {
  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const platformConfig = getPlatformConfig();

  if (platformConfig.isIOS && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: fileName, files: [file] });
        return 'shared';
      }
    } catch (shareErr) {
      if (shareErr?.name === 'AbortError') return 'cancelled';
      console.warn('[ERR-TRIP-XLSX-SHARE] Fallback a descarga directa en iOS:', shareErr);
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
};

/**
 * Exporta una rendición de viaje completa a un libro Excel (.xlsx) con sumas automáticas y links a fotos.
 */
export const exportTripReportToExcel = async (report) => {
  if (!report) throw new Error('[ERR-TRIP-XLSX-01] Rendición inválida para exportar.');

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const items = Array.isArray(report.items) ? report.items : [];
  const totals = calculateTripReportTotals(items, report.advanceAmount);
  const currencyFmt = '$#,##0';

  // -----------------------------
  // HOJA 2 PRIMERO (para referenciar filas en Resumen si se desea)
  // -----------------------------
  const detailHeader = [
    'N°',
    'Categoría',
    'Fecha',
    'Detalle / Concepto',
    'Info Extra (Lugar/Noches/Litros)',
    'N° Boleta / Doc.',
    'Monto ($ CLP)',
    'Estado Foto',
    'Link Foto Boleta',
    'Link Foto Adicional'
  ];

  const detailRows = [detailHeader];

  items.forEach((item, idx) => {
    const primaryPhoto = item.photoUrl || item.receiptPhoto || '';
    const secondaryPhoto = item.secondaryPhotoUrl || item.secondaryPhoto || '';
    const hasPhoto = (primaryPhoto || secondaryPhoto) ? 'CON RESPALDO' : 'SIN FOTO';

    detailRows.push([
      idx + 1,
      getCategoryLabel(item.category),
      formatShortDate(item.date || item.createdAt),
      item.description || 'Sin descripción',
      formatExtraMeta(item),
      item.receiptNumber || '-',
      { t: 'n', v: Number(item.amount) || 0, z: currencyFmt },
      hasPhoto,
      getPhotoLinkCell(primaryPhoto, 'Ver Foto Boleta'),
      getPhotoLinkCell(secondaryPhoto, 'Ver Foto Extra')
    ]);
  });

  const lastDetailRow = Math.max(2, items.length + 1);
  const totalDetailRowIdx = items.length + 2;
  detailRows.push([
    '',
    'TOTAL GENERAL',
    '',
    `${items.length} ítem(s) rendidos`,
    '',
    '',
    items.length > 0
      ? { t: 'n', v: totals.totalAmount, f: `SUM(G2:G${lastDetailRow})`, z: currencyFmt }
      : { t: 'n', v: 0, z: currencyFmt },
    `${totals.itemsWithPhoto}/${items.length} con foto`,
    '',
    ''
  ]);

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 13 },
    { wch: 32 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 }
  ];

  // -----------------------------
  // HOJA 1: RESUMEN EJECUTIVO DE RENDICIÓN (con =SUMIF y =SUM)
  // -----------------------------
  const summaryRows = [
    ['RENDICIÓN DE VIAJE — LOGÍSTICA TS / TRANSPOCHECK', '', '', ''],
    ['Título del Viaje', report.tripTitle || 'Rendición de Viaje', 'Estado', getStatusLabel(report.status)],
    ['Conductor', report.driverName || '-', 'Correo', report.driverEmail || '-'],
    ['Cliente', report.client || '-', 'Patente / VIN', report.plate || '-'],
    ['Vehículo', report.vehicleInfo || '-', 'Ruta', `${report.origin || '-'} -> ${report.destination || '-'}`],
    ['Fecha Inicio', formatShortDate(report.startDate || report.createdAt), 'Fecha Término', formatShortDate(report.endDate)],
    ['Observaciones', report.notes || '-', '', ''],
    [],
    ['RESUMEN AUTOMÁTICO POR CATEGORÍA', 'Ítems', 'Subtotal ($ CLP)', '% del Total'],
  ];

  const catStartRow = 10; // Fila 10..14 en Excel
  TRIP_EXPENSE_CATEGORIES.forEach((cat, idx) => {
    const excelRow = catStartRow + idx;
    const catAmt = totals.byCategory[cat.id] || 0;
    const catCnt = totals.countsByCategory[cat.id] || 0;
    const pct = totals.totalAmount > 0 ? catAmt / totals.totalAmount : 0;

    summaryRows.push([
      cat.label,
      items.length > 0
        ? { t: 'n', v: catCnt, f: `COUNTIF('Detalle Rendición'!B2:B${lastDetailRow}, "${cat.label}")` }
        : { t: 'n', v: 0 },
      items.length > 0
        ? { t: 'n', v: catAmt, f: `SUMIF('Detalle Rendición'!B2:B${lastDetailRow}, "${cat.label}", 'Detalle Rendición'!G2:G${lastDetailRow})`, z: currencyFmt }
        : { t: 'n', v: 0, z: currencyFmt },
      { t: 'n', v: pct, f: `IF(C15>0, C${excelRow}/C15, 0)`, z: '0.0%' }
    ]);
  });

  // Fila 15: TOTAL RENDIDO
  summaryRows.push([
    'TOTAL GENERAL RENDIDO',
    { t: 'n', v: totals.itemCount, f: `SUM(B10:B14)` },
    { t: 'n', v: totals.totalAmount, f: `SUM(C10:C14)`, z: currencyFmt },
    { t: 'n', v: totals.totalAmount > 0 ? 1 : 0, z: '0.0%' }
  ]);
  // Fila 16: MONTO ENTREGADO PARA VIAJE
  summaryRows.push([
    'MONTO ENTREGADO PARA VIAJE',
    '',
    { t: 'n', v: totals.advanceAmount, z: currencyFmt },
    ''
  ]);
  // Fila 17: DIFERENCIA (Saldo)
  summaryRows.push([
    totals.balanceDifference >= 0 ? 'SALDO A DEVOLVER (A FAVOR EMPRESA)' : 'REEMBOLSO A CONDUCTOR (EXCEDENTE)',
    '',
    { t: 'n', v: totals.balanceDifference, f: `C16-C15`, z: currencyFmt },
    ''
  ]);
  summaryRows.push([
    'Respaldos Fotográficos',
    `${totals.itemsWithPhoto} de ${totals.itemCount} gastos con foto`,
    `Ver hoja "Detalle Rendición" fila ${totalDetailRowIdx}`,
    ''
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 36 },
    { wch: 24 },
    { wch: 20 },
    { wch: 26 }
  ];

  // -----------------------------
  // HOJA 3: DESGLOSE AGRUPADO POR CATEGORÍA
  // -----------------------------
  const groupedRows = [['DESGLOSE AGRUPADO POR CATEGORÍA DE GASTO', '', '', '', '', '']];
  let currentExcelRow = 2;

  TRIP_EXPENSE_CATEGORIES.forEach(cat => {
    const catItems = items.filter(i => (i.category || 'extra') === cat.id);
    groupedRows.push([]);
    currentExcelRow += 1;
    groupedRows.push([`>>> ${cat.label.toUpperCase()} (${catItems.length})`, 'Fecha', 'Detalle', 'Info Extra', 'Boleta N°', 'Monto ($ CLP)', 'Link Foto']);
    currentExcelRow += 1;

    if (catItems.length === 0) {
      groupedRows.push(['Sin gastos registrados en esta categoría', '-', '-', '-', '-', { t: 'n', v: 0, z: currencyFmt }, '-']);
      currentExcelRow += 1;
    } else {
      const firstRow = currentExcelRow;
      catItems.forEach((item, idx) => {
        const primaryPhoto = item.photoUrl || item.receiptPhoto || '';
        groupedRows.push([
          idx + 1,
          formatShortDate(item.date || item.createdAt),
          item.description || '-',
          formatExtraMeta(item),
          item.receiptNumber || '-',
          { t: 'n', v: Number(item.amount) || 0, z: currencyFmt },
          getPhotoLinkCell(primaryPhoto, 'Ver Foto')
        ]);
        currentExcelRow += 1;
      });
      const lastRow = currentExcelRow - 1;
      const catSum = catItems.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      groupedRows.push([
        `Subtotal ${cat.label}`,
        '',
        '',
        '',
        '',
        { t: 'n', v: catSum, f: `SUM(F${firstRow}:F${lastRow})`, z: currencyFmt },
        ''
      ]);
      currentExcelRow += 1;
    }
  });

  const wsGrouped = XLSX.utils.aoa_to_sheet(groupedRows);
  wsGrouped['!cols'] = [
    { wch: 34 },
    { wch: 13 },
    { wch: 30 },
    { wch: 22 },
    { wch: 15 },
    { wch: 16 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Viaje');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle Rendición');
  XLSX.utils.book_append_sheet(wb, wsGrouped, 'Por Categoría');

  const safeTitle = sanitizeSheetFileName(`${report.driverName || 'Conductor'}_${report.plate || report.tripTitle || 'Viaje'}`);
  const fileName = `Rendicion_Viaje_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return await downloadOrShareWorkbook(XLSX, wb, fileName);
};

/**
 * Exporta múltiples rendiciones de viaje a un libro Excel (.xlsx) consolidado con gran total.
 */
export const exportMultipleTripReportsToExcel = async (reports = []) => {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error('[ERR-TRIP-XLSX-02] No hay rendiciones para exportar.');
  }

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const currencyFmt = '$#,##0';

  const consolidatedHeader = [
    'Fecha Inicio',
    'Viaje / Título',
    'Conductor',
    'Patente / VIN',
    'Cliente',
    'Ruta',
    'Estado',
    'Combustibles ($)',
    'Peajes ($)',
    'Viáticos ($)',
    'Alojamientos ($)',
    'Gastos Extra ($)',
    'Total Rendido ($)',
    'Monto Entregado Viaje ($)',
    'Saldo / Diferencia ($)',
    'Fotos Adjuntas'
  ];

  const consolidatedRows = [consolidatedHeader];
  const allDetailRows = [[
    'Viaje / Título',
    'Conductor',
    'Patente',
    'Categoría',
    'Fecha Gasto',
    'Detalle',
    'Info Extra',
    'N° Boleta',
    'Monto ($ CLP)',
    'Link Foto Boleta',
    'Link Foto Adicional'
  ]];

  let grandTotalAll = 0;

  reports.forEach((rep, idx) => {
    const excelRow = idx + 2;
    const items = Array.isArray(rep.items) ? rep.items : [];
    const totals = calculateTripReportTotals(items, rep.advanceAmount);
    grandTotalAll += totals.totalAmount;

    consolidatedRows.push([
      formatShortDate(rep.startDate || rep.createdAt),
      rep.tripTitle || 'Rendición de Viaje',
      rep.driverName || rep.driverEmail || '-',
      rep.plate || '-',
      rep.client || '-',
      `${rep.origin || '-'} -> ${rep.destination || '-'}`,
      getStatusLabel(rep.status),
      { t: 'n', v: totals.byCategory.combustible, z: currencyFmt },
      { t: 'n', v: totals.byCategory.peaje, z: currencyFmt },
      { t: 'n', v: totals.byCategory.viatico, z: currencyFmt },
      { t: 'n', v: totals.byCategory.alojamiento, z: currencyFmt },
      { t: 'n', v: totals.byCategory.extra, z: currencyFmt },
      { t: 'n', v: totals.totalAmount, f: `SUM(H${excelRow}:L${excelRow})`, z: currencyFmt },
      { t: 'n', v: totals.advanceAmount, z: currencyFmt },
      { t: 'n', v: totals.balanceDifference, f: `N${excelRow}-M${excelRow}`, z: currencyFmt },
      `${totals.itemsWithPhoto}/${totals.itemCount}`
    ]);

    items.forEach(item => {
      const primaryPhoto = item.photoUrl || item.receiptPhoto || '';
      const secondaryPhoto = item.secondaryPhotoUrl || item.secondaryPhoto || '';
      allDetailRows.push([
        rep.tripTitle || 'Rendición de Viaje',
        rep.driverName || '-',
        rep.plate || '-',
        getCategoryLabel(item.category),
        formatShortDate(item.date || item.createdAt),
        item.description || '-',
        formatExtraMeta(item),
        item.receiptNumber || '-',
        { t: 'n', v: Number(item.amount) || 0, z: currencyFmt },
        getPhotoLinkCell(primaryPhoto, 'Ver Boleta'),
        getPhotoLinkCell(secondaryPhoto, 'Ver Foto Extra')
      ]);
    });
  });

  const lastRepRow = reports.length + 1;
  consolidatedRows.push([
    'TOTAL CONSOLIDADO',
    `${reports.length} rendición(es)`,
    '', '', '', '', '',
    { t: 'n', v: reports.reduce((s, r) => s + calculateTripReportTotals(r.items, r.advanceAmount).byCategory.combustible, 0), f: `SUM(H2:H${lastRepRow})`, z: currencyFmt },
    { t: 'n', v: reports.reduce((s, r) => s + calculateTripReportTotals(r.items, r.advanceAmount).byCategory.peaje, 0), f: `SUM(I2:I${lastRepRow})`, z: currencyFmt },
    { t: 'n', v: reports.reduce((s, r) => s + calculateTripReportTotals(r.items, r.advanceAmount).byCategory.viatico, 0), f: `SUM(J2:J${lastRepRow})`, z: currencyFmt },
    { t: 'n', v: reports.reduce((s, r) => s + calculateTripReportTotals(r.items, r.advanceAmount).byCategory.alojamiento, 0), f: `SUM(K2:K${lastRepRow})`, z: currencyFmt },
    { t: 'n', v: reports.reduce((s, r) => s + calculateTripReportTotals(r.items, r.advanceAmount).byCategory.extra, 0), f: `SUM(L2:L${lastRepRow})`, z: currencyFmt },
    { t: 'n', v: grandTotalAll, f: `SUM(M2:M${lastRepRow})`, z: currencyFmt },
    { t: 'n', v: reports.reduce((s, r) => s + (Number(r.advanceAmount) || 0), 0), f: `SUM(N2:N${lastRepRow})`, z: currencyFmt },
    { t: 'n', v: reports.reduce((s, r) => s + calculateTripReportTotals(r.items, r.advanceAmount).balanceDifference, 0), f: `SUM(O2:O${lastRepRow})`, z: currencyFmt },
    ''
  ]);

  if (allDetailRows.length > 1) {
    const lastAllDetailRow = allDetailRows.length;
    allDetailRows.push([
      'TOTAL DETALLE',
      '', '', '', '', '', '', '',
      { t: 'n', v: grandTotalAll, f: `SUM(I2:I${lastAllDetailRow})`, z: currencyFmt },
      '', ''
    ]);
  }

  const wsConsolidated = XLSX.utils.aoa_to_sheet(consolidatedRows);
  wsConsolidated['!cols'] = [
    { wch: 13 }, { wch: 26 }, { wch: 20 }, { wch: 13 }, { wch: 20 }, { wch: 28 }, { wch: 12 },
    { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 15 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }
  ];

  const wsAllDetails = XLSX.utils.aoa_to_sheet(allDetailRows);
  wsAllDetails['!cols'] = [
    { wch: 26 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 28 }, { wch: 20 },
    { wch: 14 }, { wch: 15 }, { wch: 18 }, { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, wsConsolidated, 'Consolidado Viajes');
  XLSX.utils.book_append_sheet(wb, wsAllDetails, 'Detalle Ítems');

  const fileName = `Rendiciones_Viajes_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return await downloadOrShareWorkbook(XLSX, wb, fileName);
};
