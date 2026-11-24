import { useState, useEffect, useMemo } from 'react';
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit
} from 'firebase/firestore';
import {
  Fuel, Receipt, Utensils, BedDouble, Package, Camera, Upload, Plus, Trash2, Edit2,
  FileSpreadsheet, CheckCircle, AlertCircle, Clock, X, Eye, Calendar, MapPin, Car,
  Loader2, Send, Save, Filter, Wallet, ChevronDown, ChevronUp
} from 'lucide-react';
import InAppCamera from '../ui/InAppCamera';
import { uploadImageToStorage } from '../../hooks/useFirebase';
import {
  resizeImage,
  formatMoney,
  getAssignableDrivers,
  safeStorageSetJson,
  safeStorageRemove
} from '../../utils/helpers';
import {
  TRIP_EXPENSE_CATEGORIES,
  TRIP_REPORT_STATUS_META,
  calculateTripReportTotals,
  exportTripReportToExcel,
  exportMultipleTripReportsToExcel
} from '../../utils/tripExpenseExport';

const CATEGORY_UI_MAP = {
  combustible: {
    icon: Fuel,
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    iconColor: 'text-amber-600 dark:text-amber-400'
  },
  peaje: {
    icon: MapPin,
    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    badgeClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  viatico: {
    icon: Utensils,
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400'
  },
  alojamiento: {
    icon: BedDouble,
    activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-sm',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400'
  },
  extra: {
    icon: Package,
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    iconColor: 'text-rose-600 dark:text-rose-400'
  }
};

const VEHICLE_TOLL_TYPES = [
  'Auto / SUV',
  'Camioneta',
  'Furgón Pequeño',
  'Furgón Grande',
  'Camión Simple',
  'Camión Doble Cabina',
  'Camión (2 Ejes traseros)',
  'Camión (3 Ejes traseros)',
  'Camión Rigid (8x4)',
  'Carro Arrastre',
  'Maquinaria'
];

const getTodayInputDate = () => new Date().toISOString().slice(0, 10);

const createEmptyTripHeader = (driverObj = null, fallbackEmail = '') => ({
  jobId: '',
  tripTitle: '',
  driverEmail: (driverObj?.email || fallbackEmail || '').toLowerCase().trim(),
  driverName: driverObj?.name || fallbackEmail || '',
  driverId: driverObj?.id || '',
  client: '',
  plate: '',
  vehicleInfo: '',
  origin: '',
  destination: '',
  startDate: getTodayInputDate(),
  endDate: getTodayInputDate(),
  advanceAmount: '',
  notes: ''
});

const createEmptyItemForm = (category = 'combustible') => ({
  id: '',
  category,
  description: '',
  amount: '',
  date: getTodayInputDate(),
  receiptNumber: '',
  location: '',
  liters: '',
  odometerKm: '',
  nights: '1',
  photoUrl: null,
  secondaryPhotoUrl: null
});

const cleanNumeric = (val) => Number(String(val ?? '').replace(/[^0-9]/g, '')) || 0;

export default function TripExpensesView({
  isAdminView = false,
  drivers = [],
  jobs = [],
  tollsList = [],
  db,
  currentUserEmail,
  actualUserEmail,
  myDriver,
  showAlert,
  showConfirm
}) {
  const normalizedUserEmail = (currentUserEmail || '').toLowerCase().trim();
  const normalizedActorEmail = (actualUserEmail || currentUserEmail || '').toLowerCase().trim();
  const assignableDrivers = useMemo(() => getAssignableDrivers(drivers), [drivers]);
  const draftStorageKey = `trip_expense_draft_${normalizedUserEmail || 'default'}`;

  const [reports, setReports] = useState([]);
  const [subView, setSubView] = useState('editor'); // 'editor' | 'list'
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingReportStatus, setEditingReportStatus] = useState('draft');

  // Encabezado del viaje (con carga automática de borrador local si existe)
  const [header, setHeader] = useState(() => {
    try {
      const saved = window.localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.header) return { ...createEmptyTripHeader(myDriver, normalizedUserEmail), ...parsed.header };
      }
    } catch { /* ignore invalid cache */ }
    return createEmptyTripHeader(myDriver, normalizedUserEmail);
  });

  // Ítems cargados a la rendición actual
  const [items, setItems] = useState(() => {
    try {
      const saved = window.localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.items)) return parsed.items;
      }
    } catch { /* ignore invalid cache */ }
    return [];
  });

  const [activeCategory, setActiveCategory] = useState('combustible');
  const [itemForm, setItemForm] = useState(() => createEmptyItemForm('combustible'));
  const [editingItemId, setEditingItemId] = useState(null);
  const [tollVehicleType, setTollVehicleType] = useState('Auto / SUV');
  const [selectedTollName, setSelectedTollName] = useState('');

  // Estados UI auxiliares
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [cameraConfig, setCameraConfig] = useState({ isOpen: false, title: '', target: null });
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [observeModal, setObserveModal] = useState(null); // { report, note }
  const [filterDriverEmail, setFilterDriverEmail] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [listItemCategoryFilter, setListItemCategoryFilter] = useState('all');

  const [loadedQueryKey, setLoadedQueryKey] = useState(null);
  const activeQueryKey = !db ? null : (isAdminView ? 'admin' : (normalizedUserEmail ? `driver:${normalizedUserEmail}` : null));
  const loadingReports = Boolean(activeQueryKey && loadedQueryKey !== activeQueryKey);

  const effectiveDriverEmail = (header.driverEmail || myDriver?.email || normalizedUserEmail || '').toLowerCase().trim();
  const effectiveDriverName = header.driverName || myDriver?.name || effectiveDriverEmail;
  const effectiveDriverId = header.driverId || myDriver?.id || '';

  // Persistir borrador local mientras se arma una nueva rendición
  useEffect(() => {
    if (editingReportId) return;
    safeStorageSetJson(
      draftStorageKey,
      { header, items },
      (val) => ({
        header: val.header,
        items: (val.items || []).map(it => ({
          ...it,
          photoUrl: it.photoUrl && String(it.photoUrl).startsWith('data:image') ? null : it.photoUrl,
          secondaryPhotoUrl: it.secondaryPhotoUrl && String(it.secondaryPhotoUrl).startsWith('data:image') ? null : it.secondaryPhotoUrl
        }))
      })
    );
  }, [header, items, editingReportId, draftStorageKey]);

  // Escucha en tiempo real de rendiciones de viaje guardadas en Firestore
  useEffect(() => {
    if (!db || !activeQueryKey) return;

    const qRef = isAdminView
      ? query(collection(db, 'trip_expense_reports'), orderBy('createdAt', 'desc'), limit(150))
      : query(collection(db, 'trip_expense_reports'), where('driverEmail', '==', normalizedUserEmail));

    const unsub = onSnapshot(qRef, (snap) => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setReports(docs);
      setLoadedQueryKey(activeQueryKey);
    }, (err) => {
      console.error('[ERR-TRIP-FB-01] Error escuchando trip_expense_reports:', err);
      setLoadedQueryKey(activeQueryKey);
    });

    return () => unsub();
  }, [db, isAdminView, normalizedUserEmail, activeQueryKey]);

  // Totales calculados en tiempo real
  const totals = useMemo(
    () => calculateTripReportTotals(items, cleanNumeric(header.advanceAmount)),
    [items, header.advanceAmount]
  );

  const isJobAssignedToDriverEmail = (job, targetEmail) => {
    if (!job || !targetEmail) return false;
    const cleanTarget = targetEmail.toLowerCase().trim();
    const acceptedEmail = (job.acceptedByEmail || '').toLowerCase().trim();
    if (acceptedEmail) {
      return acceptedEmail === cleanTarget;
    }
    const driverEmail = (job.driverEmail || '').toLowerCase().trim();
    if (driverEmail && driverEmail === cleanTarget) return true;
    if (Array.isArray(job.assignedEmails) && job.assignedEmails.some(e => (e || '').toLowerCase().trim() === cleanTarget)) {
      return true;
    }
    if (Array.isArray(job.assignedDrivers) && job.assignedDrivers.some(d => (d?.email || '').toLowerCase().trim() === cleanTarget)) {
      return true;
    }
    return false;
  };

  // Viajes disponibles para vincular: en modo conductor solo muestra viajes (tripType === 'viaje') asignados a su correo
  const selectableJobs = useMemo(() => {
    const list = (Array.isArray(jobs) ? jobs : []).filter(j => {
      if (j.tripType !== 'viaje') return false;
      if (isAdminView) return true;
      return isJobAssignedToDriverEmail(j, normalizedUserEmail);
    });
    return list
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 40);
  }, [jobs, isAdminView, normalizedUserEmail]);

  // Reportes filtrados en pestaña historial
  const filteredReports = useMemo(() => {
    return reports.filter(rep => {
      if (isAdminView && filterDriverEmail !== 'all') {
        if ((rep.driverEmail || '').toLowerCase().trim() !== filterDriverEmail) return false;
      }
      if (filterStatus !== 'all' && (rep.status || 'draft') !== filterStatus) return false;
      return true;
    });
  }, [reports, isAdminView, filterDriverEmail, filterStatus]);

  const handleCategorySwitch = (catId) => {
    setActiveCategory(catId);
    setSelectedTollName('');
    setEditingItemId(null);
    setItemForm(createEmptyItemForm(catId));
  };

  const handleSelectJob = (jobId) => {
    if (!jobId) {
      setHeader(prev => ({ ...prev, jobId: '' }));
      return;
    }
    const found = jobs.find(j => j.id === jobId);
    if (!found) return;

    const ident = (found.plate && found.plate !== 'S/N') ? found.plate : (found.vin || '');
    const route = [found.origin, found.destination].filter(Boolean).join(' → ');
    const vehicleDesc = [found.brand, found.model].filter(Boolean).join(' ').trim();
    const jobDriverEmail = (
      found.acceptedByEmail ||
      (Array.isArray(found.assignedEmails) && found.assignedEmails.length === 1 ? found.assignedEmails[0] : '')
    ).toLowerCase().trim();
    const matchedDrv = isAdminView && jobDriverEmail
      ? assignableDrivers.find(d => (d.email || '').toLowerCase().trim() === jobDriverEmail)
      : null;

    setHeader(prev => ({
      ...prev,
      jobId: found.id,
      tripTitle: prev.tripTitle || route || found.client || `Viaje ${ident}`,
      client: found.client || prev.client,
      plate: ident || prev.plate,
      vehicleInfo: vehicleDesc || found.description || prev.vehicleInfo,
      origin: found.origin || prev.origin,
      destination: found.destination || prev.destination,
      driverEmail: (isAdminView && matchedDrv?.email ? matchedDrv.email : prev.driverEmail || '').toLowerCase().trim(),
      driverName: (isAdminView && matchedDrv?.name) ? matchedDrv.name : prev.driverName,
      driverId: (isAdminView && matchedDrv?.id) ? matchedDrv.id : prev.driverId
    }));
  };

  const handleSelectDriver = (email) => {
    const cleanEmail = (email || '').toLowerCase().trim();
    const drv = assignableDrivers.find(d => (d.email || '').toLowerCase().trim() === cleanEmail);
    setHeader(prev => ({
      ...prev,
      driverEmail: cleanEmail,
      driverName: drv?.name || cleanEmail,
      driverId: drv?.id || ''
    }));
  };

  const handleTollSelection = (tollName, vType = tollVehicleType) => {
    setSelectedTollName(tollName);
    if (!tollName) return;
    const toll = tollsList.find(t => t.name === tollName);
    const price = toll?.prices?.[vType];
    setItemForm(prev => ({
      ...prev,
      description: prev.description || `Peaje ${tollName}`,
      location: toll?.route || prev.location,
      amount: price ? String(price) : prev.amount
    }));
  };

  const handleProcessPhotoFile = async (file, target) => {
    if (!file) return;
    try {
      const compressed = await resizeImage(file, 1200, 0.7);
      setItemForm(prev => ({ ...prev, [target]: compressed }));
    } catch (err) {
      console.error('[ERR-TRIP-PHOTO-02] Error procesando imagen:', err);
      showAlert('❌ [ERR-TRIP-PHOTO-02] No se pudo procesar la fotografía seleccionada.');
    }
  };

  const handleAddOrUpdateItem = () => {
    const amt = cleanNumeric(itemForm.amount);
    const desc = (itemForm.description || '').trim();

    if (!desc) {
      return showAlert('❌ [ERR-TRIP-ITEM-01] Ingresa el detalle o concepto del gasto.');
    }
    if (amt <= 0) {
      return showAlert('❌ [ERR-TRIP-ITEM-02] Ingresa un monto válido mayor a $0.');
    }
    if (!itemForm.photoUrl) {
      return showAlert('❌ [ERR-TRIP-ITEM-03] Adjunta la foto de la boleta o comprobante de este gasto.');
    }

    const nextItem = {
      id: editingItemId || `ti_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: activeCategory,
      description: desc,
      amount: amt,
      date: itemForm.date || getTodayInputDate(),
      receiptNumber: (itemForm.receiptNumber || '').trim(),
      location: (itemForm.location || '').trim(),
      liters: activeCategory === 'combustible' ? (itemForm.liters || '') : '',
      odometerKm: activeCategory === 'combustible' ? (itemForm.odometerKm || '') : '',
      nights: activeCategory === 'alojamiento' ? (itemForm.nights || '1') : '',
      photoUrl: itemForm.photoUrl,
      secondaryPhotoUrl: activeCategory === 'combustible' ? (itemForm.secondaryPhotoUrl || null) : null,
      createdAt: Date.now()
    };

    if (editingItemId) {
      setItems(prev => prev.map(it => (it.id === editingItemId ? { ...it, ...nextItem } : it)));
      setEditingItemId(null);
    } else {
      setItems(prev => [...prev, nextItem]);
    }

    setSelectedTollName('');
    setItemForm(createEmptyItemForm(activeCategory));
  };

  const handleEditItem = (item) => {
    setActiveCategory(item.category || 'extra');
    setEditingItemId(item.id);
    setItemForm({
      ...createEmptyItemForm(item.category || 'extra'),
      ...item,
      amount: String(item.amount || '')
    });
  };

  const handleRemoveItem = (itemId) => {
    setItems(prev => prev.filter(it => it.id !== itemId));
    if (editingItemId === itemId) {
      setEditingItemId(null);
      setItemForm(createEmptyItemForm(activeCategory));
    }
  };

  const resetEditor = () => {
    setEditingReportId(null);
    setEditingReportStatus('draft');
    setHeader(createEmptyTripHeader(myDriver, normalizedUserEmail));
    setItems([]);
    setEditingItemId(null);
    setItemForm(createEmptyItemForm(activeCategory));
    safeStorageRemove(draftStorageKey);
  };

  const handleLoadReportIntoEditor = (rep) => {
    setEditingReportId(rep.id);
    setEditingReportStatus(rep.status || 'draft');
    setHeader({
      ...createEmptyTripHeader(myDriver, normalizedUserEmail),
      jobId: rep.jobId || '',
      tripTitle: rep.tripTitle || '',
      driverEmail: (rep.driverEmail || normalizedUserEmail).toLowerCase().trim(),
      driverName: rep.driverName || '',
      driverId: rep.driverId || '',
      client: rep.client || '',
      plate: rep.plate || '',
      vehicleInfo: rep.vehicleInfo || '',
      origin: rep.origin || '',
      destination: rep.destination || '',
      startDate: rep.startDate || getTodayInputDate(),
      endDate: rep.endDate || getTodayInputDate(),
      advanceAmount: rep.advanceAmount ? String(rep.advanceAmount) : '',
      notes: rep.notes || ''
    });
    setItems(Array.isArray(rep.items) ? rep.items : []);
    setEditingItemId(null);
    setItemForm(createEmptyItemForm(activeCategory));
    setSubView('editor');
  };

  const buildReportPayload = async (reportId, targetStatus, uploadedItems) => {
    const computedTotals = calculateTripReportTotals(uploadedItems, cleanNumeric(header.advanceAmount));
    const finalTitle = (header.tripTitle || '').trim() ||
      ([header.origin, header.destination].filter(Boolean).join(' → ') ||
      (header.plate ? `Viaje ${header.plate}` : 'Rendición de Viaje'));
    const now = Date.now();
    const existing = editingReportId ? reports.find(r => r.id === editingReportId) : null;

    return {
      id: reportId,
      jobId: header.jobId || '',
      tripTitle: finalTitle,
      driverEmail: effectiveDriverEmail,
      driverName: effectiveDriverName || 'Conductor',
      driverId: effectiveDriverId,
      createdByEmail: existing?.createdByEmail || normalizedActorEmail,
      client: (header.client || '').trim(),
      plate: (header.plate || '').trim().toUpperCase(),
      vehicleInfo: (header.vehicleInfo || '').trim(),
      origin: (header.origin || '').trim(),
      destination: (header.destination || '').trim(),
      startDate: header.startDate || getTodayInputDate(),
      endDate: header.endDate || header.startDate || getTodayInputDate(),
      advanceAmount: cleanNumeric(header.advanceAmount),
      notes: (header.notes || '').trim(),
      status: targetStatus,
      items: uploadedItems,
      totals: computedTotals.byCategory,
      totalAmount: computedTotals.totalAmount,
      balanceDifference: computedTotals.balanceDifference,
      itemCount: computedTotals.itemCount,
      itemsWithPhoto: computedTotals.itemsWithPhoto,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
  };

  const handleSaveReport = async (targetStatus = 'submitted') => {
    if (isSaving) return;
    if (!db) return showAlert('❌ [ERR-TRIP-DB-01] Base de datos no disponible.');
    if (!effectiveDriverEmail) return showAlert('❌ [ERR-TRIP-VAL-01] Selecciona el conductor responsable de la rendición.');
    if (items.length === 0) return showAlert('❌ [ERR-TRIP-VAL-02] Agrega al menos un gasto a la rendición antes de guardar.');

    setIsSaving(true);
    const reportId = editingReportId || `trip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      const uploadedItems = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        let photoUrl = it.photoUrl || null;
        let secondaryPhotoUrl = it.secondaryPhotoUrl || null;

        try {
          if (photoUrl && String(photoUrl).startsWith('data:image')) {
            photoUrl = await uploadImageToStorage(photoUrl, `trip_reports/${reportId}`, `${it.id}_receipt_${i}.jpg`);
          }
          if (secondaryPhotoUrl && String(secondaryPhotoUrl).startsWith('data:image')) {
            secondaryPhotoUrl = await uploadImageToStorage(secondaryPhotoUrl, `trip_reports/${reportId}`, `${it.id}_extra_${i}.jpg`);
          }
        } catch (photoErr) {
          console.error('[ERR-TRIP-PHOTO-01] Error subiendo foto a Storage:', photoErr);
          throw new Error(`[ERR-TRIP-PHOTO-01] Error al subir fotografía del ítem "${it.description}": ${photoErr.message || 'Sin conexión'}`, { cause: photoErr });
        }

        uploadedItems.push({ ...it, photoUrl, secondaryPhotoUrl });
      }

      const payload = await buildReportPayload(reportId, targetStatus, uploadedItems);
      await setDoc(doc(db, 'trip_expense_reports', reportId), payload, { merge: true });

      if (!editingReportId) {
        safeStorageRemove(draftStorageKey);
      }

      setItems(uploadedItems);
      setEditingReportId(reportId);
      setEditingReportStatus(targetStatus);

      showAlert(
        targetStatus === 'draft'
          ? '✅ [OK-TRIP-DRAFT-01] Borrador guardado en la nube. Puedes seguir agregando gastos o exportar a Excel.'
          : '✅ [OK-TRIP-SAVE-01] Rendición de viaje enviada con fotos y totales actualizados.'
      );
    } catch (err) {
      console.error('[ERR-TRIP-SAVE-01] Error guardando rendición:', err);
      const msg = String(err?.message || '').includes('[ERR-TRIP-')
        ? err.message
        : `❌ [ERR-TRIP-SAVE-01] Error al guardar rendición: ${err.message || 'Error de conexión'}`;
      showAlert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCurrentToExcel = async () => {
    if (isExporting) return;
    if (items.length === 0) {
      return showAlert('❌ [ERR-TRIP-XLSX-03] Agrega al menos un gasto para exportar la rendición a Excel.');
    }
    setIsExporting(true);
    try {
      const draftReport = await buildReportPayload(editingReportId || 'preview', editingReportStatus, items);
      const res = await exportTripReportToExcel(draftReport);
      if (res !== 'cancelled') {
        showAlert('✅ Excel (.xlsx) generado con sumas automáticas y enlaces a fotos.');
      }
    } catch (err) {
      console.error('[ERR-TRIP-XLSX-04]', err);
      showAlert(`❌ [ERR-TRIP-XLSX-04] No se pudo generar el Excel: ${err.message || 'Error inesperado'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSavedReport = async (rep) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await exportTripReportToExcel(rep);
      if (res !== 'cancelled') {
        showAlert('✅ Rendición exportada a Excel (.xlsx).');
      }
    } catch (err) {
      console.error('[ERR-TRIP-XLSX-05]', err);
      showAlert(`❌ [ERR-TRIP-XLSX-05] Error exportando rendición: ${err.message || 'Error inesperado'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllFiltered = async () => {
    if (isExporting || filteredReports.length === 0) return;
    setIsExporting(true);
    try {
      const res = await exportMultipleTripReportsToExcel(filteredReports);
      if (res !== 'cancelled') {
        showAlert(`✅ Consolidado Excel (.xlsx) exportado (${filteredReports.length} rendiciones).`);
      }
    } catch (err) {
      console.error('[ERR-TRIP-XLSX-06]', err);
      showAlert(`❌ [ERR-TRIP-XLSX-06] Error exportando consolidado: ${err.message || 'Error inesperado'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAdminStatusUpdate = async (report, nextStatus, note = '') => {
    try {
      await updateDoc(doc(db, 'trip_expense_reports', report.id), {
        status: nextStatus,
        adminNote: note,
        reviewedByEmail: normalizedActorEmail,
        reviewedAt: Date.now(),
        updatedAt: Date.now()
      });
      showAlert(nextStatus === 'approved' ? '✅ Rendición aprobada.' : '⚠️ Rendición marcada con observación.');
    } catch (err) {
      console.error('[ERR-TRIP-STATUS-01]', err);
      showAlert(`❌ [ERR-TRIP-STATUS-01] No se pudo actualizar el estado: ${err.message || 'Sin conexión'}`);
    }
  };

  const handleDeleteReport = (rep) => {
    showConfirm(`¿Eliminar la rendición "${rep.tripTitle || 'Sin título'}"? Esta acción no afecta tu billetera diaria.`, async () => {
      try {
        await deleteDoc(doc(db, 'trip_expense_reports', rep.id));
        if (editingReportId === rep.id) resetEditor();
        showAlert('✅ Rendición eliminada.');
      } catch (err) {
        console.error('[ERR-TRIP-DEL-01]', err);
        showAlert(`❌ [ERR-TRIP-DEL-01] No se pudo eliminar la rendición: ${err.message || 'Sin permisos o conexión'}`);
      }
    });
  };

  const activeCategoryMeta = TRIP_EXPENSE_CATEGORIES.find(c => c.id === activeCategory) || TRIP_EXPENSE_CATEGORIES[0];
  const visibleDraftItems = useMemo(() => {
    if (listItemCategoryFilter === 'all') return items;
    return items.filter(it => it.category === listItemCategoryFilter);
  }, [items, listItemCategoryFilter]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Lightbox Foto Completa */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-slate-950/85 z-[250] flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 w-full max-w-lg relative shadow-xl border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setViewingPhoto(null)}
              className="absolute top-3 right-3 p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
            >
              <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </button>
            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-3">Comprobante Fotográfico</h4>
            <img src={viewingPhoto} alt="Comprobante" className="w-full max-h-[72vh] object-contain rounded-lg bg-slate-100 dark:bg-slate-950" />
          </div>
        </div>
      )}

      {/* Modal de Observación Admin (Native UI, sin window.prompt) */}
      {observeModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-[240] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Observar Rendición
              </h4>
              <button type="button" onClick={() => setObserveModal(null)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Indica el motivo o corrección solicitada para <strong>{observeModal.report.tripTitle}</strong>:
            </p>
            <textarea
              rows={3}
              value={observeModal.note}
              onChange={(e) => setObserveModal(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Ej: Falta foto legible de la boleta de alojamiento..."
              className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 text-sm font-medium outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setObserveModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-600 dark:text-slate-300">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = observeModal;
                  setObserveModal(null);
                  await handleAdminStatusUpdate(target.report, 'observed', target.note.trim());
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                Guardar Observación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabecera Rendición de Viaje y Sub-navegación */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-black flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Rendición de Viaje Completa
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Combustibles, peajes, viáticos, alojamientos y gastos extra con fotos, suma automática y exportación Excel (.xlsx).
            </p>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setSubView('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${subView === 'editor' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              {editingReportId ? 'Editando Viaje' : '+ Nueva Rendición'}
            </button>
            <button
              type="button"
              onClick={() => setSubView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${subView === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              Historial ({reports.length})
            </button>
          </div>
        </div>
      </div>

      {subView === 'editor' ? (
        <div className="space-y-5">
          {/* RESUMEN AUTOMÁTICO EN VIVO */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Suma Automática del Viaje</p>
                <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                  {formatMoney(totals.totalAmount)}
                </p>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {totals.itemCount} comprobante{totals.itemCount === 1 ? '' : 's'} · {totals.itemsWithPhoto}/{totals.itemCount} con foto
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {cleanNumeric(header.advanceAmount) > 0 && (
                  <div className={`px-3 py-2 rounded-xl border text-right ${totals.balanceDifference >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'}`}>
                    <p className="text-[9px] font-black uppercase tracking-wider">
                      {totals.balanceDifference >= 0 ? 'Saldo a Rendir' : 'A Reembolsar'}
                    </p>
                    <p className="text-sm font-black font-mono">
                      {formatMoney(Math.abs(totals.balanceDifference))}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleExportCurrentToExcel}
                  disabled={isExporting || items.length === 0}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Exportar Excel
                </button>
              </div>
            </div>

            {/* Tarjetas por categoría (clicables para saltar directo a esa categoría) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TRIP_EXPENSE_CATEGORIES.map(cat => {
                const ui = CATEGORY_UI_MAP[cat.id];
                const Icon = ui.icon;
                const catTotal = totals.byCategory[cat.id] || 0;
                const catCount = totals.countsByCategory[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySwitch(cat.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${activeCategory === cat.id ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon className={`w-4 h-4 ${ui.iconColor}`} />
                      <span className="text-[10px] font-mono font-bold text-slate-400">{catCount}</span>
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">{cat.label}</p>
                    <p className="text-xs font-black font-mono text-slate-900 dark:text-slate-100">{formatMoney(catTotal)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DATOS GENERALES DEL VIAJE */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-blue-500" /> Datos del Viaje
              </h4>
              {(editingReportId || items.length > 0 || header.tripTitle) && (
                <button
                  type="button"
                  onClick={() => showConfirm('¿Limpiar el formulario actual para iniciar una nueva rendición desde cero?', resetEditor)}
                  className="text-[11px] font-bold text-slate-500 hover:text-red-500 underline cursor-pointer"
                >
                  Nueva / Limpiar
                </button>
              )}
            </div>

            {selectableJobs.length > 0 ? (
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  {isAdminView
                    ? 'Vincular a Viaje Registrado (Opcional — autocompleta ruta y patente)'
                    : 'Vincular a tu Viaje Asignado (Opcional — autocompleta ruta y patente)'}
                </label>
                <select
                  value={header.jobId}
                  onChange={(e) => handleSelectJob(e.target.value)}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">Ingreso manual / viaje libre...</option>
                  {selectableJobs.map(j => (
                    <option key={j.id} value={j.id}>
                      [VIAJE] {j.client || 'Sin cliente'} · {j.plate || j.vin || 'S/N'} · {j.origin || '?'} → {j.destination || '?'}
                    </option>
                  ))}
                </select>
              </div>
            ) : !isAdminView && (
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                No tienes viajes asignados actualmente a <span className="font-mono text-slate-700 dark:text-slate-200">{normalizedUserEmail}</span>. Puedes ingresar los datos manualmente.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isAdminView && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Conductor *</label>
                  <select
                    value={effectiveDriverEmail}
                    onChange={(e) => handleSelectDriver(e.target.value)}
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar conductor...</option>
                    {assignableDrivers.map(d => (
                      <option key={d.email} value={(d.email || '').toLowerCase().trim()}>
                        {d.name} ({d.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Nombre / Referencia del Viaje</label>
                <input
                  type="text"
                  value={header.tripTitle}
                  onChange={(e) => setHeader(prev => ({ ...prev, tripTitle: e.target.value }))}
                  placeholder="Ej: Santiago → Puerto Montt (Viaje Sur)"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Cliente</label>
                <input
                  type="text"
                  value={header.client}
                  onChange={(e) => setHeader(prev => ({ ...prev, client: e.target.value }))}
                  placeholder="Ej: Grandleasing / Kovacs"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Patente / VIN</label>
                <input
                  type="text"
                  value={header.plate}
                  onChange={(e) => setHeader(prev => ({ ...prev, plate: e.target.value.toUpperCase() }))}
                  placeholder="Ej: ABCD12"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-mono font-bold uppercase outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Vehículo</label>
                <input
                  type="text"
                  value={header.vehicleInfo}
                  onChange={(e) => setHeader(prev => ({ ...prev, vehicleInfo: e.target.value }))}
                  placeholder="Ej: Ford Transit / Toyota Hilux"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Origen</label>
                  <input
                    type="text"
                    value={header.origin}
                    onChange={(e) => setHeader(prev => ({ ...prev, origin: e.target.value }))}
                    placeholder="Origen"
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Destino</label>
                  <input
                    type="text"
                    value={header.destination}
                    onChange={(e) => setHeader(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="Destino"
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={header.startDate}
                    onChange={(e) => setHeader(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Fecha Término</label>
                  <input
                    type="date"
                    value={header.endDate}
                    onChange={(e) => setHeader(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Anticipo / Viático Entregado ($ Opcional)</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={header.advanceAmount}
                    onChange={(e) => setHeader(prev => ({ ...prev, advanceAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 pl-7 text-xs font-mono font-black outline-none focus:border-blue-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">$</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Observaciones Generales del Viaje (Opcional)</label>
              <input
                type="text"
                value={header.notes}
                onChange={(e) => setHeader(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ej: Viaje de ida y vuelta con peajes TAG incluidos..."
                className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-medium outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* FORMULARIO DE CARGA POR CATEGORÍA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              {TRIP_EXPENSE_CATEGORIES.map(cat => {
                const ui = CATEGORY_UI_MAP[cat.id];
                const Icon = ui.icon;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySwitch(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${active ? ui.activeClass : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {editingItemId ? `Editando ítem en ${activeCategoryMeta.label}` : `Agregar a ${activeCategoryMeta.label}`}
              </p>
              <p className="text-[11px] text-slate-400">{activeCategoryMeta.description}</p>
            </div>

            {/* Sugerencias rápidas por categoría */}
            <div className="flex flex-wrap gap-1.5">
              {activeCategoryMeta.presets.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setItemForm(prev => ({ ...prev, description: preset }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${itemForm.description === preset ? 'bg-slate-800 text-white border-slate-800 dark:bg-blue-600 dark:border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'}`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Selector automático de Peajes registrados si la categoría es peaje */}
            {activeCategory === 'peaje' && tollsList.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/50">
                <div>
                  <label className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 block mb-1">Tipo Vehículo (Autocompleta)</label>
                  <select
                    value={tollVehicleType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setTollVehicleType(nextType);
                      if (selectedTollName) handleTollSelection(selectedTollName, nextType);
                    }}
                    className="w-full border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 rounded-lg p-2 text-xs font-bold"
                  >
                    {VEHICLE_TOLL_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 block mb-1">Plaza de Peaje</label>
                  <select
                    value={selectedTollName}
                    onChange={(e) => handleTollSelection(e.target.value)}
                    className="w-full border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 rounded-lg p-2 text-xs font-bold"
                  >
                    <option value="">Ingresar manualmente...</option>
                    {tollsList.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.route || 'Ruta'})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Detalle / Concepto *</label>
                <input
                  type="text"
                  value={itemForm.description}
                  onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={`Ej: ${activeCategoryMeta.presets[0] || 'Detalle del gasto'}`}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Monto ($ CLP) *</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={itemForm.amount}
                    onChange={(e) => setItemForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Ej: 25000"
                    className="w-full border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl p-2.5 pl-7 text-sm font-mono font-black outline-none focus:border-emerald-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-emerald-600">$</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Fecha</label>
                <input
                  type="date"
                  value={itemForm.date}
                  onChange={(e) => setItemForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">N° Boleta / Factura (Opcional)</label>
                <input
                  type="text"
                  value={itemForm.receiptNumber}
                  onChange={(e) => setItemForm(prev => ({ ...prev, receiptNumber: e.target.value }))}
                  placeholder="Ej: 458912"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>

              {activeCategory === 'combustible' && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Litros Cargados (Opcional)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={itemForm.liters}
                      onChange={(e) => setItemForm(prev => ({ ...prev, liters: e.target.value }))}
                      placeholder="Ej: 45.5"
                      className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Kilometraje (Opcional)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={itemForm.odometerKm}
                      onChange={(e) => setItemForm(prev => ({ ...prev, odometerKm: e.target.value }))}
                      placeholder="Ej: 124500"
                      className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {activeCategory === 'alojamiento' && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Ciudad / Hotel</label>
                    <input
                      type="text"
                      value={itemForm.location}
                      onChange={(e) => setItemForm(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Ej: Temuco"
                      className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Cantidad de Noches</label>
                    <input
                      type="number"
                      min="1"
                      value={itemForm.nights}
                      onChange={(e) => setItemForm(prev => ({ ...prev, nights: e.target.value }))}
                      className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {activeCategory !== 'combustible' && activeCategory !== 'alojamiento' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Ciudad / Tramo / Lugar (Opcional)</label>
                  <input
                    type="text"
                    value={itemForm.location}
                    onChange={(e) => setItemForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Ej: Ruta 5 Sur / Chillán"
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* BLOQUE DE FOTOS (Boleta obligatoria + Estanque opcional para combustible) */}
            <div className={`grid grid-cols-1 ${activeCategory === 'combustible' ? 'sm:grid-cols-2' : ''} gap-3`}>
              <div className={`border-2 border-dashed rounded-xl p-3 ${itemForm.photoUrl ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-300 dark:border-slate-700'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Foto Boleta / Comprobante *
                </p>
                {itemForm.photoUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={itemForm.photoUrl}
                      alt="Boleta"
                      onClick={() => setViewingPhoto(itemForm.photoUrl)}
                      className="w-16 h-16 object-cover rounded-lg border border-emerald-300 cursor-pointer shrink-0"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => setViewingPhoto(itemForm.photoUrl)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer">
                        <Eye className="w-3.5 h-3.5" /> Ver foto
                      </button>
                      <button type="button" onClick={() => setItemForm(prev => ({ ...prev, photoUrl: null }))} className="text-xs font-bold text-red-500 flex items-center gap-1 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" /> Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraConfig({ isOpen: true, title: `Boleta - ${activeCategoryMeta.label}`, target: 'photoUrl' })}
                      className="flex-1 py-2.5 px-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" /> Cámara
                    </button>
                    <label className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <Upload className="w-4 h-4" /> Galería
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleProcessPhotoFile(e.target.files?.[0], 'photoUrl')} />
                    </label>
                  </div>
                )}
              </div>

              {activeCategory === 'combustible' && (
                <div className={`border-2 border-dashed rounded-xl p-3 ${itemForm.secondaryPhotoUrl ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-300 dark:border-slate-700'}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Foto Estanque / Surtidor (Opcional)
                  </p>
                  {itemForm.secondaryPhotoUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={itemForm.secondaryPhotoUrl}
                        alt="Estanque"
                        onClick={() => setViewingPhoto(itemForm.secondaryPhotoUrl)}
                        className="w-16 h-16 object-cover rounded-lg border border-emerald-300 cursor-pointer shrink-0"
                      />
                      <div className="flex flex-col gap-1.5">
                        <button type="button" onClick={() => setViewingPhoto(itemForm.secondaryPhotoUrl)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer">
                          <Eye className="w-3.5 h-3.5" /> Ver foto
                        </button>
                        <button type="button" onClick={() => setItemForm(prev => ({ ...prev, secondaryPhotoUrl: null }))} className="text-xs font-bold text-red-500 flex items-center gap-1 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" /> Quitar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraConfig({ isOpen: true, title: 'Foto Estanque / Surtidor', target: 'secondaryPhotoUrl' })}
                        className="flex-1 py-2.5 px-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" /> Cámara
                      </button>
                      <label className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                        <Upload className="w-4 h-4" /> Galería
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleProcessPhotoFile(e.target.files?.[0], 'secondaryPhotoUrl')} />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {editingItemId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingItemId(null);
                    setItemForm(createEmptyItemForm(activeCategory));
                  }}
                  className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar Edición
                </button>
              )}
              <button
                type="button"
                onClick={handleAddOrUpdateItem}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {editingItemId ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingItemId ? 'Actualizar Gasto en Lista' : `Agregar a ${activeCategoryMeta.label}`}
              </button>
            </div>
          </div>

          {/* LISTA DE ÍTEMS CARGADOS + TOTAL FINAL + ACCIONES DE GUARDADO */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                Gastos de esta Rendición ({items.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setListItemCategoryFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${listItemCategoryFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                >
                  Todos ({items.length})
                </button>
                {TRIP_EXPENSE_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setListItemCategoryFilter(cat.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${listItemCategoryFilter === cat.id ? 'bg-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                  >
                    {cat.shortLabel} ({totals.countsByCategory[cat.id] || 0})
                  </button>
                ))}
              </div>
            </div>

            {visibleDraftItems.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-xs font-bold text-slate-400">
                Aún no hay gastos en esta vista. Usa los botones de categoría arriba para ir sumando comprobantes.
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleDraftItems.map(item => {
                  const catInfo = TRIP_EXPENSE_CATEGORIES.find(c => c.id === item.category) || TRIP_EXPENSE_CATEGORIES[4];
                  const ui = CATEGORY_UI_MAP[item.category] || CATEGORY_UI_MAP.extra;
                  const CatIcon = ui.icon;
                  return (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {item.photoUrl && (
                          <img
                            src={item.photoUrl}
                            alt="Boleta"
                            onClick={() => setViewingPhoto(item.photoUrl)}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase border ${ui.badgeClass}`}>
                              <CatIcon className="w-3 h-3" /> {catInfo.label}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{item.date}</span>
                            {item.receiptNumber && <span className="text-[10px] font-mono text-slate-500">Bol. #{item.receiptNumber}</span>}
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 break-words">{item.description}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-semibold text-slate-500">
                            {item.location && <span>{item.location}</span>}
                            {item.liters && <span>{item.liters} L</span>}
                            {item.odometerKm && <span>{Number(item.odometerKm).toLocaleString('es-CL')} km</span>}
                            {item.category === 'alojamiento' && item.nights && <span>{item.nights} noche(s)</span>}
                            {item.secondaryPhotoUrl && (
                              <button type="button" onClick={() => setViewingPhoto(item.secondaryPhotoUrl)} className="text-blue-600 dark:text-blue-400 underline cursor-pointer">
                                Ver estanque
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-black font-mono text-slate-900 dark:text-white">{formatMoney(item.amount)}</span>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => handleEditItem(item)} className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded cursor-pointer" title="Quitar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Barra de guardado en Firestore */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={isSaving || items.length === 0}
                onClick={() => handleSaveReport('draft')}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Borrador
              </button>
              <button
                type="button"
                disabled={isSaving || items.length === 0}
                onClick={() => handleSaveReport('submitted')}
                className="flex-[2] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSaving ? 'Subiendo fotos y guardando...' : `Enviar Rendición (${formatMoney(totals.totalAmount)})`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* HISTORIAL DE RENDICIONES DE VIAJE */
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 flex-1">
              {isAdminView && (
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={filterDriverEmail}
                    onChange={(e) => setFilterDriverEmail(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="all">Todos los conductores</option>
                    {assignableDrivers.map(d => (
                      <option key={d.email} value={(d.email || '').toLowerCase().trim()}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg px-2.5 py-1.5 text-xs font-bold"
              >
                <option value="all">Todos los estados</option>
                {Object.entries(TRIP_REPORT_STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleExportAllFiltered}
              disabled={isExporting || filteredReports.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Exportar Consolidado (.xlsx)
            </button>
          </div>

          {loadingReports ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center text-xs font-bold text-slate-400">
              Cargando rendiciones de viaje...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2">
              <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-500">No hay rendiciones de viaje registradas.</p>
              <button
                type="button"
                onClick={() => setSubView('editor')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Crear Primera Rendición
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map(rep => {
                const repTotals = calculateTripReportTotals(rep.items, rep.advanceAmount);
                const statusMeta = TRIP_REPORT_STATUS_META[rep.status] || TRIP_REPORT_STATUS_META.draft;
                const isExpanded = expandedReportId === rep.id;
                const canDelete = isAdminView || (rep.status || 'draft') === 'draft';

                return (
                  <div key={rep.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                          {rep.plate && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {rep.plate}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {rep.startDate || '-'}
                          </span>
                        </div>
                        <h5 className="text-sm font-black text-slate-900 dark:text-white truncate">{rep.tripTitle || 'Rendición de Viaje'}</h5>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                          {rep.driverName} · {rep.client || 'Sin cliente'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {formatMoney(repTotals.totalAmount)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {repTotals.itemCount} ítems · {repTotals.itemsWithPhoto} fotos
                        </p>
                      </div>
                    </div>

                    {rep.adminNote && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                        Observación Admin: {rep.adminNote}
                      </div>
                    )}

                    {/* Mini totales por categoría */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[10px]">
                      {TRIP_EXPENSE_CATEGORIES.map(cat => (
                        <div key={cat.id} className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1">
                          <span className="text-slate-400 font-bold block truncate">{cat.shortLabel}</span>
                          <span className="font-mono font-black text-slate-700 dark:text-slate-200">
                            {formatMoney(repTotals.byCategory[cat.id] || 0)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Acciones rápidas */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setExpandedReportId(isExpanded ? null : rep.id)}
                        className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {isExpanded ? 'Ocultar detalle' : 'Ver detalle y fotos'}
                      </button>

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleExportSavedReport(rep)}
                          disabled={isExporting}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                        </button>
                        {(isAdminView || rep.status !== 'approved') && (
                          <button
                            type="button"
                            onClick={() => handleLoadReportIntoEditor(rep)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                          </button>
                        )}
                        {isAdminView && rep.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleAdminStatusUpdate(rep, 'approved', '')}
                            className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                          </button>
                        )}
                        {isAdminView && rep.status !== 'observed' && (
                          <button
                            type="button"
                            onClick={() => setObserveModal({ report: rep, note: rep.adminNote || '' })}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" /> Observar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteReport(rep)}
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800 cursor-pointer"
                            title="Eliminar rendición"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                        {(rep.items || []).map((it, idx) => (
                          <div key={it.id || idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              {it.photoUrl && (
                                <img
                                  src={it.photoUrl}
                                  alt="Comprobante"
                                  onClick={() => setViewingPhoto(it.photoUrl)}
                                  className="w-9 h-9 rounded object-cover border border-slate-200 cursor-pointer shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{it.description}</p>
                                <p className="text-[10px] text-slate-400">
                                  {(TRIP_EXPENSE_CATEGORIES.find(c => c.id === it.category)?.label || 'Extra')} · {it.date || '-'}
                                  {it.receiptNumber ? ` · Bol #${it.receiptNumber}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {it.secondaryPhotoUrl && (
                                <button type="button" onClick={() => setViewingPhoto(it.secondaryPhotoUrl)} className="text-[10px] font-bold text-blue-600 underline cursor-pointer">
                                  Estanque
                                </button>
                              )}
                              <span className="font-mono font-black text-slate-900 dark:text-white">{formatMoney(it.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cámara InApp nativa */}
      <InAppCamera
        isOpen={cameraConfig.isOpen}
        title={cameraConfig.title}
        onClose={() => setCameraConfig({ isOpen: false, title: '', target: null })}
        onCapture={(file) => handleProcessPhotoFile(file, cameraConfig.target)}
      />
    </div>
  );
}
