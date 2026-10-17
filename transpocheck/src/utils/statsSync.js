import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';

/**
 * Parsea distancias en formatos variados: "25 km", "25,5 km", "25.5 km", "1.200 km", o número.
 */
export const parseDist = (str) => {
  if (typeof str === 'number') return isNaN(str) ? 0 : str;
  if (!str) return 0;
  let s = String(str).toLowerCase().replace(/[^\d.,]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes('.') && s.split('.').pop().length === 3) s = s.replace(/\./g, '');
  const val = parseFloat(s);
  return isNaN(val) ? 0 : val;
};

/**
 * Devuelve la clave del mes en formato estándar YYYY-MM (ej: "2026-10").
 */
export const getMonthKey = (dateOrTimestamp) => {
  try {
    const d = dateOrTimestamp ? new Date(dateOrTimestamp) : new Date();
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  } catch (e) {
    console.error('[ERR-STATS-KEY-01] Error calculando clave de mes:', e);
    return null;
  }
};

/**
 * Extrae EXCLUSIVAMENTE los datos numéricos y textuales esenciales para estadísticas.
 * No guarda fotos, checklists pesados, firmas ni datos innecesarios para mantener
 * el almacenamiento de Firestore mínimo y eficiente.
 */
export const extractLightweightJob = (job, drivers = []) => {
  if (!job) return null;
  const km = parseDist(job.drivenDistance || job.km || job.distance || 0);
  
  let driverName = 'Desconocido';
  if (Array.isArray(drivers) && job.acceptedByEmail) {
    const found = drivers.find(d => d.email?.toLowerCase() === job.acceptedByEmail?.toLowerCase());
    if (found?.name) driverName = found.name;
  }
  if (driverName === 'Desconocido' && job.driverName) {
    driverName = job.driverName;
  }

  const plate = (job.plate && job.plate !== 'S/N') 
    ? job.plate 
    : ((job.vin && job.vin !== 'S/N') ? job.vin : (job.associatedPlate || 'S/N'));

  let vehicleType = (job.checklist?.vehicleType || job.vehicleType || 'auto').toLowerCase();
  if (job.tripType === 'simple' || job.operationMode === 'servicio') {
    vehicleType = 'servicio';
  }

  let prtResult = job.prt_result || job.checklist?.rtStatus || '';
  if (!prtResult && job.tripType === 'revision') {
    if (job.status === 'failed') prtResult = 'rechazado';
    else prtResult = 'aprobado';
  }

  return {
    id: String(job.id),
    createdAt: job.createdAt || Date.now(),
    completedAt: job.completedAt || job.createdAt || Date.now(),
    status: job.status || 'completed',
    client: job.client || 'Sin Cliente',
    companyPrice: Number(job.companyPrice) || 0,
    drivenDistance: job.drivenDistance || (km > 0 ? `${km} km` : ''),
    km: Math.round(km * 10) / 10,
    driverEmail: job.acceptedByEmail || '',
    driverName,
    plate: String(plate).toUpperCase().trim(),
    brand: String(job.brand || '').toUpperCase().trim(),
    model: String(job.model || '').toUpperCase().trim(),
    origin: job.origin || '',
    destination: job.destination || job.destName || '',
    vehicleType,
    tripType: job.tripType || 'normal',
    prt_result: prtResult,
    operationMode: job.operationMode || '',
    description: job.description || '',
    associatedVehicle: job.associatedVehicle || '',
    associatedPlate: job.associatedPlate || ''
  };
};

/**
 * Compara si los datos ligeros de un traslado han cambiado sustancialmente.
 */
export const isLightweightJobEqual = (a, b) => {
  if (!a || !b) return false;
  return a.status === b.status &&
    Number(a.companyPrice) === Number(b.companyPrice) &&
    Number(a.km) === Number(b.km) &&
    a.drivenDistance === b.drivenDistance &&
    a.prt_result === b.prt_result &&
    a.driverEmail === b.driverEmail &&
    a.driverName === b.driverName &&
    a.client === b.client &&
    a.vehicleType === b.vehicleType &&
    a.plate === b.plate &&
    a.brand === b.brand &&
    a.model === b.model &&
    a.origin === b.origin &&
    a.destination === b.destination &&
    a.operationMode === b.operationMode &&
    a.description === b.description;
};

/**
 * Calcula todas las métricas agregadas del mes a partir de una lista de trabajos ligeros.
 */
export const calculateStatsFromLightweightJobs = (jobsList = []) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const clientCounts = {};
  const clientRevenues = {};
  let totalRevenue = 0;
  let totalKm = 0;
  let todayKm = 0;
  let prtApproved = 0, prtApprovedHelp = 0, prtRejected = 0, prtTotal = 0;
  const driverKms = {};
  const categoryCounts = {
    'auto': {}, 'camioneta': {}, 'furgon_pequeno': {}, 'furgon_grande': {},
    'camion_simple': {}, 'camion_doble': {}, 'camion_2ejes': {},
    'camion_3ejes': {}, 'camion_8x4': {}, 'carro_arrastre': {}, 'servicio': {}
  };
  const plateCounts = {};

  const sortedJobs = [...jobsList].sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));

  sortedJobs.forEach(j => {
    // 1. Clientes e Ingresos
    const cName = j.client || 'Sin Cliente';
    clientCounts[cName] = (clientCounts[cName] || 0) + 1;
    const price = Number(j.companyPrice) || 0;
    clientRevenues[cName] = (clientRevenues[cName] || 0) + price;
    totalRevenue += price;

    // 2. PRT
    if (j.tripType === 'revision') {
      prtTotal++;
      if (j.status === 'failed' || j.prt_result === 'rechazado') prtRejected++;
      else if (j.prt_result === 'aprobado_ayuda') prtApprovedHelp++;
      else prtApproved++;
    }

    // 3. Kilómetros
    const km = Number(j.km) || parseDist(j.drivenDistance);
    if (km > 0) {
      totalKm += km;
      if (j.completedAt) {
        try {
          const jDate = new Date(j.completedAt).toISOString().split('T')[0];
          if (jDate === todayStr) todayKm += km;
        } catch(e) {}
      }

      const drvName = j.driverName || 'Desconocido';
      if (drvName && drvName !== 'Desconocido') {
        driverKms[drvName] = (driverKms[drvName] || 0) + km;
      }
    }

    // 4. Conductor por categoría
    if (j.driverName && j.driverName !== 'Desconocido') {
      const vType = (j.vehicleType || 'auto').toLowerCase();
      if (categoryCounts[vType] !== undefined) {
        categoryCounts[vType][j.driverName] = (categoryCounts[vType][j.driverName] || 0) + 1;
      }
    }

    // 5. Patentes frecuentes
    if (j.plate && j.plate !== 'S/N') {
      const cleanPlate = j.plate.toUpperCase().trim();
      plateCounts[cleanPlate] = (plateCounts[cleanPlate] || 0) + 1;
    }
  });

  const topClients = Object.entries(clientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topClientsByRevenue = Object.entries(clientRevenues)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const topDriversKm = Object.entries(driverKms)
    .sort((a, b) => b[1] - a[1])
    .map(([name, km]) => ({ name, km: Math.round(km * 10) / 10 }));

  const topDriversByCategory = {};
  for (const [cat, counts] of Object.entries(categoryCounts)) {
    let topDriver = null, maxCount = 0;
    for (const [drv, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; topDriver = drv; }
    }
    if (topDriver) topDriversByCategory[cat] = { name: topDriver, count: maxCount };
  }

  const topPlates = Object.entries(plateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([plate, count]) => ({ plate, count }));

  return {
    monthlyJobs: sortedJobs,
    totalJobs: sortedJobs.length,
    topClients,
    topClientsByRevenue,
    totalRevenue,
    prtStats: { total: prtTotal, approved: prtApproved, help: prtApprovedHelp, rejected: prtRejected },
    totalKm: Math.round(totalKm),
    todayKm: Math.round(todayKm),
    topDriversKm,
    topDriversByCategory,
    topPlates
  };
};

/**
 * Sincroniza y fusiona los traslados activos con los almacenados independientemente en el mes.
 * Si un traslado fue eliminado de `transport_jobs`, se MANTIENE en `monthly_stats`.
 */
export const syncMonthJobs = async (db, monthKey, activeJobs = [], drivers = []) => {
  if (!db || !monthKey) return null;

  try {
    const docRef = doc(db, 'monthly_stats', monthKey);
    const docSnap = await getDoc(docRef);

    let jobsSummary = {};
    let existingStats = null;

    if (docSnap.exists()) {
      const data = docSnap.data();
      jobsSummary = data.jobsSummary || {};
      existingStats = data.stats || null;
    } else {
      // Buscar respaldo en historical_stats si existe
      try {
        const histRef = doc(db, 'historical_stats', monthKey);
        const histSnap = await getDoc(histRef);
        if (histSnap.exists()) {
          const hData = histSnap.data();
          existingStats = {
            monthlyJobs: [],
            totalJobs: hData.totalJobs || 0,
            topClients: Object.entries(hData.clientCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
            topClientsByRevenue: Object.entries(hData.clientRevenues || {}).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
            totalRevenue: hData.totalRevenue || 0,
            prtStats: hData.prtStats || { total: 0, approved: 0, help: 0, rejected: 0 },
            totalKm: Math.round(hData.totalKm || 0),
            todayKm: 0,
            topDriversKm: Object.entries(hData.driverKms || {}).sort((a, b) => b[1] - a[1]).map(([name, km]) => ({ name, km })),
            topDriversByCategory: {},
            topPlates: Object.entries(hData.plateCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([plate, count]) => ({ plate, count }))
          };
        }
      } catch (errHist) {
        console.warn('[ERR-STATS-HIST-01] Error leyendo historical_stats:', errHist);
      }
    }

    // Filtrar los traslados activos que pertenezcan a este mes y estén completados o fallidos
    let hasChanges = false;
    const updatedSummary = { ...jobsSummary };

    (activeJobs || []).forEach(j => {
      if (j.status !== 'completed' && j.status !== 'failed') return;
      const jKey = getMonthKey(j.completedAt || j.createdAt);
      if (jKey !== monthKey) return;

      const lw = extractLightweightJob(j, drivers);
      if (!lw || !lw.id) return;

      const existing = updatedSummary[lw.id];
      if (!existing || !isLightweightJobEqual(existing, lw)) {
        updatedSummary[lw.id] = lw;
        hasChanges = true;
      }
    });

    const summaryCount = Object.keys(updatedSummary).length;

    // Si tenemos trabajos en el resumen, recalculamos las métricas
    if (summaryCount > 0) {
      const calculatedStats = calculateStatsFromLightweightJobs(Object.values(updatedSummary));
      
      // Guardar en Firestore si hay cambios o si no estaba guardado
      if (hasChanges || !docSnap.exists()) {
        await setDoc(docRef, {
          monthKey,
          updatedAt: Date.now(),
          stats: calculatedStats,
          jobsSummary: updatedSummary
        }, { merge: true });
      }

      return {
        stats: calculatedStats,
        jobsSummary: updatedSummary
      };
    } else if (existingStats) {
      return {
        stats: existingStats,
        jobsSummary: {}
      };
    } else {
      const emptyStats = calculateStatsFromLightweightJobs([]);
      return {
        stats: emptyStats,
        jobsSummary: {}
      };
    }
  } catch (error) {
    console.error('[ERR-STATS-SYNC-01] Error sincronizando estadísticas del mes:', error);
    return null;
  }
};

/**
 * Resguarda un traslado en `monthly_stats` de forma independiente antes de que sea eliminado
 * de la colección principal `transport_jobs`.
 */
export const saveJobToMonthlyStatsBeforeDelete = async (db, job, drivers = []) => {
  if (!db || !job) return;
  if (job.status !== 'completed' && job.status !== 'failed') return;

  try {
    const monthKey = getMonthKey(job.completedAt || job.createdAt);
    if (!monthKey) return;

    const lw = extractLightweightJob(job, drivers);
    if (!lw || !lw.id) return;

    const docRef = doc(db, 'monthly_stats', monthKey);
    const docSnap = await getDoc(docRef);

    let jobsSummary = {};
    if (docSnap.exists()) {
      jobsSummary = docSnap.data().jobsSummary || {};
    }

    jobsSummary[lw.id] = lw;
    const stats = calculateStatsFromLightweightJobs(Object.values(jobsSummary));

    await setDoc(docRef, {
      monthKey,
      updatedAt: Date.now(),
      stats,
      jobsSummary
    }, { merge: true });

    console.log(`[INFO-STATS-BACKUP] Traslado ${lw.id} resguardado en estadísticas (${monthKey}).`);
  } catch (error) {
    console.error('[ERR-STATS-BACKUP-DEL] Error resguardando traslado antes de eliminar:', error);
  }
};

/**
 * Permite eliminar un registro específico de las estadísticas independientes
 * (ejemplo: un traslado de prueba creado por error).
 */
export const removeJobFromMonthlyStats = async (db, monthKey, jobId) => {
  if (!db || !monthKey || !jobId) return false;

  try {
    const docRef = doc(db, 'monthly_stats', monthKey);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return false;

    const data = docSnap.data();
    const jobsSummary = { ...(data.jobsSummary || {}) };
    if (!jobsSummary[jobId]) return false;

    delete jobsSummary[jobId];
    const stats = calculateStatsFromLightweightJobs(Object.values(jobsSummary));

    await setDoc(docRef, {
      monthKey,
      updatedAt: Date.now(),
      stats,
      jobsSummary
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('[ERR-STATS-REMOVE-01] Error eliminando registro de estadísticas:', error);
    return false;
  }
};
