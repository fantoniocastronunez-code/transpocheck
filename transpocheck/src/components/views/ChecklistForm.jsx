import React, { useState, useEffect, useRef } from 'react';
import { updateDoc, doc, setDoc, addDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import {
  FileText, MapPin, CheckCircle, CloudOff, AlertCircle, Eye,
  Trash2, Camera, Search, X, Fuel, Clock, Wallet, Receipt,
  Share2, QrCode, Save, Zap
} from 'lucide-react';
import SignaturePad from '../ui/SignaturePad';
import InAppCamera from '../ui/InAppCamera'; // <-- NUEVO COMPONENTE CENTRALIZADO
import { resizeImage, formatMoney } from '../../utils/helpers';

import Step1Origin from './ChecklistForm/Step1Origin';
import Step2Vehicle from './ChecklistForm/Step2Vehicle';
import Step3Damage from './ChecklistForm/Step3Damage';
import Step4Destination from './ChecklistForm/Step4Destination';
import Step5Extras from './ChecklistForm/Step5Extras';
import Step6Signature from './ChecklistForm/Step6Signature';
import DejaVuModal from './ChecklistForm/DejaVuModal';

export default function ChecklistForm({ job: rawJob, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm, allClientsList: rawClients, drivers, expenses, vehicles, uploadImageToStorage, pushSyncTask }) {
  // --- MAGIA: RED DE SEGURIDAD ANTI-PANTALLA BLANCA ---
  // Si el conductor recarga la página en la ruta /checklist y la memoria de React se borra,
  // lo devolvemos al inicio silenciosamente en lugar de colapsar la app en blanco.
  const isInvalidJob = !rawJob || Object.keys(rawJob).length === 0;

  useEffect(() => {
    if (isInvalidJob) {
      window.location.replace('/');
    }
  }, [isInvalidJob]);

  // SEGURO DE VIDA: Si Firebase demora en enviar los datos, usamos valores por defecto para evitar la Pantalla Blanca
  const job = rawJob || {};
  const allClientsList = rawClients || [];

  const isQuick = job.id === 'NEW_QUICK_JOB';
  const localStorageKey = `checklist_draft_${job.id}`;
  const matchedVehicle = vehicles?.find(v => v.plate === String(job.plate || job.vin || '').toUpperCase());
  const initialDocs = matchedVehicle?.docs || { soap: false, permiso: false, revTecnica: false, gases: false };
  const initialDocsExpiry = matchedVehicle?.docsExpiry || {};
  const initialReminders = matchedVehicle?.internalReminders || [];

  // --- MAGIA: AUTO-DETECTAR DESTINO FINAL DE REVISIÓN TÉCNICA ---
  // Evita que un destino personalizado ("Av. San José") se sobreescriba con "Eratec" (Origen) por defecto
  let autoReturnOpt = 'origin';
  let autoReturnDest = '';
  if (job.tripType === 'revision' && job.destination) {
    const parts = job.destination.split('->');
    const finalLeg = (parts.length > 1 ? parts[1] : job.destination).trim();
    if (finalLeg && job.origin && finalLeg.toLowerCase() !== job.origin.toLowerCase()) {
      autoReturnOpt = 'other';
      autoReturnDest = finalLeg;
    }
  }

  const defaultData = {
    client: job.client || '', manualClient: '', brand: job.brand || '', model: job.model || '', plateOrVin: job.plate || job.vin || '', origin: job.origin || '', destination: job.destination || '',
    vehicleType: job.checklist?.vehicleType || job.vehicleType || matchedVehicle?.vehicleType || matchedVehicle?.type || 'auto',
    fuelLevel: 50, mileage: job.checklist?.mileage || '',
    photos: job.checklist?.photos || { front: false, left: false, right: false, back: false, tire: false, dashboard: false, mileage: false, ...Array.from({ length: 30 }).reduce((acc, _, i) => { acc[`det${i + 1}`] = false; return acc; }, {}) },
    detailPins: job.checklist?.detailPins || [],
    pendingPin: null,
    docs: job.checklist?.docs || initialDocs,
    docsExpiry: job.checklist?.docsExpiry || initialDocsExpiry,
    internalReminders: job.checklist?.internalReminders || initialReminders,
    observations: '', transitNotes: job.checklist?.transitNotes || '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null,
    hasEquipment: job.checklist?.hasEquipment || false,
    equipment: job.checklist?.equipment || {},
    equipmentDetails: job.checklist?.equipmentDetails || '',
    rtStatus: job.prt_result ? job.prt_result : 'pendiente',
    rtRejectReason: job.prt_reason ? job.prt_reason : '',
    rtReturnOption: job.checklist?.rtReturnOption || autoReturnOpt,
    rtReturnDestination: job.checklist?.rtReturnDestination || autoReturnDest,
    prtArrivalTime: job.checklist?.prtArrivalTime || null,
    prtFinishTime: job.checklist?.prtFinishTime || null,
    scandocPdfInbox: job.checklist?.scandocPdfInbox || null,
    scandocPdf: job.checklist?.scandocPdf || null,
    scannerLink: job.checklist?.scannerLink || '',
    guiaDespachoLink: job.checklist?.guiaDespachoLink || '',
    guiaDespachoPdf: job.checklist?.guiaDespachoPdf || null
  };
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(defaultData);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ active: false, current: 0, total: 0, text: '' });
  const [nowTick, setNowTick] = useState(Date.now());

  // Lista dinámica de equipamiento
  const [equipmentList, setEquipmentList] = useState([
    "Gata", "Llave de ruedas", "Barrotes", "Botiquín", "Manuales",
    "Piso de goma", "Colchoneta", "Cortinas", "Triángulos reflectantes",
    "Extintor", "Chaleco reflectante"
  ]);

  useEffect(() => {
    import('firebase/firestore').then(({ doc, getDoc }) => {
      getDoc(doc(db, 'system_config', 'equipment')).then(snap => {
        if (snap.exists() && snap.data().items) setEquipmentList(snap.data().items);
      }).catch(() => { });
    });
  }, [db]);

  useEffect(() => {
    if (formData.prtArrivalTime && formData.rtStatus === 'pendiente') {
      const interval = setInterval(() => setNowTick(Date.now()), 60000); // Actualiza el UI del reloj cada 1 minuto
      return () => clearInterval(interval);
    }
  }, [formData.prtArrivalTime, formData.rtStatus]);

  // MAGIA UX: Auto-scroll hacia arriba al cambiar de pestaña en el checklist
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [step]);


  // --- MOTOR DE CÁMARA INTERNA (CENTRALIZADO) ---
  const [cameraConfig, setCameraConfig] = useState({ isOpen: false, title: '', onCapture: null });

  const openCamera = (title, callback) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Tu navegador o dispositivo no soporta la cámara interna. Por favor, verifica los permisos o usa Chrome/Safari.");
      return;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => { });
    }

    setCameraConfig({ isOpen: true, title, onCapture: callback });
  };
  // ----------------------------------------
  // Estados para el Déjà Vu Pericial
  const [dejaVuData, setDejaVuData] = useState(null);
  const [showDejaVuModal, setShowDejaVuModal] = useState(false);


  // Motor de búsqueda silenciosa del Déjà Vu
  useEffect(() => {
    const fetchHistory = async () => {
      const plate = formData.plateOrVin?.trim().toUpperCase();
      if (!plate || plate.length < 5) {
        setDejaVuData(null);
        return;
      }
      try {
        const q = query(collection(db, 'transport_jobs'), where('plate', '==', plate));
        const snap = await getDocs(q);
        if (!snap.empty) {
          let pastJobs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(j => j.status === 'completed' && j.id !== job.id);

          pastJobs.sort((a, b) => b.completedAt - a.completedAt);

          // Busca el trabajo más reciente que tenga fotos de daños u observaciones largas
          const jobWithDamage = pastJobs.find(j =>
            j.checklist &&
            ((j.checklist.detailPins && j.checklist.detailPins.length > 0) ||
              (j.checklist.observations && j.checklist.observations.trim().length > 5))
          );
          setDejaVuData(jobWithDamage || null);
        } else {
          setDejaVuData(null);
        }
      } catch (e) {
        console.error("Error Déjà Vu:", e);
      }
    };

    const timeoutId = setTimeout(fetchHistory, 800); // Espera 800ms después de teclear para no saturar la red
    return () => clearTimeout(timeoutId);
  }, [formData.plateOrVin, db, job.id]);


  useEffect(() => {
    if (isQuick || !job.id) return;
    let isFirstLoad = true;
    const unsub = onSnapshot(doc(db, 'transport_jobs', job.id), (docSnap) => {
      const data = docSnap.data();

      if (isFirstLoad) {
        if (data?.draft) {
          // MAGIA: Cargamos el borrador, pero forzamos que el resultado PRT real de la base de datos mande
          const draftData = { ...defaultData, ...data.draft.formData };
          if (data.prt_result) {
            draftData.rtStatus = data.prt_result;
          }
          if (data.prt_reason) {
            draftData.rtRejectReason = data.prt_reason;
          }
          if (data.checklist?.rtReturnOption) {
            draftData.rtReturnOption = data.checklist.rtReturnOption;
            draftData.rtReturnDestination = data.checklist.rtReturnDestination || '';
          }

          // MAGIA CATEGORÍAS: Destruimos el "Auto/SUV" del borrador si el vehículo real es un camión o furgón
          draftData.vehicleType = data.checklist?.vehicleType || data.vehicleType || matchedVehicle?.vehicleType || matchedVehicle?.type || draftData.vehicleType || 'auto';

          // RESCATE DE FOTOS: Si el borrador tenía las fotos en false pero el checklist principal ya las subió
          if (data.checklist?.photos) {
            for (const key in data.checklist.photos) {
              if (data.checklist.photos[key] && !draftData.photos[key]) {
                draftData.photos[key] = data.checklist.photos[key];
              }
            }
          }

          setFormData(draftData);
          setStep(data.draft.step || 1);
          setIsDraftLoaded(true);
        } else if (data?.checklist) {
          // Si no hay borrador pero el trabajo ya tiene checklist (ej. al abrirlo el admin), precargamos todo
          setFormData(prev => ({
            ...prev,
            ...data.checklist,
            rtStatus: data.prt_result || data.checklist.rtStatus || prev.rtStatus,
            rtRejectReason: data.prt_reason || data.checklist.rtRejectReason || prev.rtRejectReason
          }));
        } else if (data?.prt_result) {
          // Si no hay borrador ni checklist, aseguramos que la data en vivo actualice el estado
          setFormData(prev => ({
            ...prev,
            rtStatus: data.prt_result,
            rtRejectReason: data.prt_reason || prev.rtRejectReason
          }));
        }
        isFirstLoad = false;
      } else {
        // MAGIA: Si el resultado cambia en la tarjeta mientras el checklist está abierto
        if (data?.prt_result) {
          setFormData(prev => ({
            ...prev,
            rtStatus: data.prt_result,
            rtRejectReason: data.prt_reason || prev.rtRejectReason
          }));
        }
      }

      if (data?.checklist?.clientSigned) {
        setFormData(prev => ({
          ...prev,
          signatureData: data.checklist.signatureData,
          receiverName: data.checklist.receiverName,
          receiverRut: data.checklist.receiverRut,
          clientComments: data.checklist.clientComments || ''
        }));
      }
    });
    return () => unsub();
  }, [job.id, isQuick, db]);


  useEffect(() => {
    if (isQuick || !job.id) return;
    const timer = setTimeout(() => {
      const draftData = JSON.parse(JSON.stringify(formData));

      // Mantenemos la limpieza de fotos en Base64 para evitar exceder el límite de 1MB de Firestore.
      for (const key in draftData.photos) {
        if (draftData.photos[key] && !draftData.photos[key].startsWith('http')) {
          draftData.photos[key] = false;
        }
      }

      const updates = { draft: { step, formData: draftData } };

      // MAGIA: Sincronizar el resultado PRT hacia JobsList en tiempo real mientras el conductor usa el formulario
      if (job.tripType === 'revision') {
        updates.prt_result = draftData.rtStatus;
        updates.prt_reason = draftData.rtRejectReason || '';

        // Si marcaron el resultado, asegura que la fase de la tarjeta cambie y no se quede pegada
        if (draftData.rtStatus !== 'pendiente' && job.phase === 'arrived_prt') {
          updates.phase = 'prt_done';
        }
      }

      updateDoc(doc(db, 'transport_jobs', job.id), updates).catch(() => { });
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, formData, job.id, isQuick, db, job.tripType, job.phase]);


  const [processingAction, setProcessingAction] = useState(null);


  const syncFilesToStorage = async (currentData) => {
    const d = { ...currentData };
    const uploadedPhotos = {};
    const jobIdFolder = job.id === 'NEW_QUICK_JOB' ? `quick_${Date.now()}` : job.id;

    let totalFiles = 0;
    for (const val of Object.values(d.photos)) { if (val && val.startsWith('data:image')) totalFiles++; }
    if (d.signatureData && d.signatureData.startsWith('data:image')) totalFiles++;
    if (d.scandocPdf && d.scandocPdf.startsWith('data:')) totalFiles++;
    if (d.guiaDespachoPdf && d.guiaDespachoPdf.startsWith('data:')) totalFiles++;

    if (totalFiles > 0) {
      setUploadProgress({ active: true, current: 0, total: totalFiles, text: 'Conectando con el servidor...' });
    }

    let completed = 0;
    const updateProgress = (fileName) => {
      completed++;
      setUploadProgress(prev => ({ ...prev, current: completed, text: `Sincronizando ${fileName}...` }));
    };

    // SUBIDA SECUENCIAL (Una por una, salva la memoria RAM de los iPhone)
    for (const [key, val] of Object.entries(d.photos)) {
      if (val && val.startsWith('data:image')) {
        try {
          const url = await uploadImageToStorage(val, `checklists/${jobIdFolder}`, `photo_${key}_${Date.now()}.jpg`);
          uploadedPhotos[key] = url;
          updateProgress(`foto ${key.toUpperCase()}`);
        } catch (err) {
          console.error(`Error subiendo foto ${key}:`, err);
        }
      } else {
        uploadedPhotos[key] = val;
      }
    }

    if (d.signatureData && d.signatureData.startsWith('data:image')) {
      try {
        const url = await uploadImageToStorage(d.signatureData, `checklists/${jobIdFolder}`, `signature_${Date.now()}.jpg`);
        d.signatureData = url;
        updateProgress('Firma de conformidad');
      } catch (err) {
        console.error("Error subiendo firma:", err);
      }
    }

    if (d.scandocPdf && d.scandocPdf.startsWith('data:')) {
      try {
        const ext = d.scandocPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.scandocPdf, `checklists/${jobIdFolder}`, `documento_adjunto_${Date.now()}.${ext}`);
        d.scandocPdf = url;
        updateProgress('Documento Escaneado');
      } catch (err) { console.error("Error subiendo el PDF:", err); }
    }

    if (d.guiaDespachoPdf && d.guiaDespachoPdf.startsWith('data:')) {
      try {
        const ext = d.guiaDespachoPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.guiaDespachoPdf, `checklists/${jobIdFolder}`, `guia_despacho_kovacs_${Date.now()}.${ext}`);
        d.guiaDespachoPdf = url;
        updateProgress('Guía de Despacho KOVACS');
      } catch (err) { console.error("Error subiendo Guía de Despacho:", err); }
    }

    d.photos = uploadedPhotos;

    if (totalFiles > 0) {
      setUploadProgress({ active: true, current: totalFiles, total: totalFiles, text: '¡Sincronización exitosa!' });
      setTimeout(() => setUploadProgress({ active: false, current: 0, total: 0, text: '' }), 1000);
    }

    return d;
  };
  const handleRemoteSignRequest = async () => {
    if (isQuick) return showAlert("⚠️ Para usar la Firma Remota en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    setProcessingAction('wapp');
    try {
      const syncedData = await syncFilesToStorage(formData);
      setFormData(syncedData);


      const url = `${window.location.origin}/?sign=${job.id}`;
      const textToShare = `¡Hola! Por favor firma el acta de recepción y revisa las fotografías del vehículo aquí:\n${url}`;


      try {
        await navigator.clipboard.writeText(textToShare);
      } catch (clipErr) {
        // Fallback para navegadores que no soportan Clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = textToShare;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) { }
        document.body.removeChild(textArea);
      }


      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: syncedData }, { merge: true });


      if (navigator.share) {
        try { await navigator.share({ title: 'Firma de Recepción', text: textToShare }); } catch (err) { showAlert("✅ Link copiado al portapapeles automáticamente."); }
      } else {
        showAlert("✅ Link copiado al portapapeles. ¡Pégalo en WhatsApp!");
      }
    } catch (e) {
      console.error(e);
      showAlert("Error al preparar la firma remota. Verifica tu conexión.");
    }
    finally { setProcessingAction(null); }
  };


  const handleOpenQR = async () => {
    if (isQuick) return showAlert("⚠️ Para usar el Código QR en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    if (!navigator.onLine) return showAlert("⚠️ Tu celular no tiene señal en este momento. Usa 'Compartir Link' y envíalo cuando recuperes la conexión.");

    setProcessingAction('qr');
    try {
      const syncedData = await syncFilesToStorage(formData);
      setFormData(syncedData);
      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: syncedData }, { merge: true });
      setQrOpen(true);
    } catch (e) {
      console.error(e);
      showAlert("Error al generar el QR. Revisa tu conexión.");
    } finally { setProcessingAction(null); }
  };


  const setF = (f, v) => setFormData(p => ({ ...p, [f]: v }));

  const clearDraft = () => {
    showConfirm("¿Eliminar borrador y empezar de nuevo?", async () => {
      if (!isQuick) await updateDoc(doc(db, 'transport_jobs', job.id), { draft: null });
      setFormData(defaultData);
      setStep(1);
      setIsDraftLoaded(false);
    });
  };


  const handlePic = async (eOrFile, id) => {
    const f = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (!f) return;
    try {
      // 🔥 MAGIA: Aumentamos a Full HD (1920px) y Calidad 85% para un PDF ultra nítido
      const dataUrl = await resizeImage(f, 1920, 0.85);

      // PASO 1: Mostrar preview inmediato con Base64 y guardar el Pin
      setFormData(prev => {
        const newData = { ...prev, photos: { ...prev.photos, [id]: dataUrl } };
        // MAGIA: Si había un Pin de daño esperando esta foto, lo fijamos en el croquis
        if (prev.pendingPin && prev.pendingPin.id === id) {
          newData.detailPins = [...(prev.detailPins || []), prev.pendingPin];
          newData.pendingPin = null;
        }
        return newData;
      });

      // PASO 2: Subir a Storage en segundo plano (solo si no es trabajo rápido)
      if (job.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        const storageUrl = await uploadImageToStorage(
          dataUrl,
          `checklists/${job.id}`,
          `photo_${id}_${Date.now()}.jpg`
        );
        // PASO 3: Reemplazar Base64 con la URL permanente de Storage
        setFormData(prev => ({
          ...prev,
          photos: { ...prev.photos, [id]: storageUrl }
        }));
      }


    } catch (err) {
      console.error("Error al procesar la foto:", err);
      showAlert("Error al procesar la foto. Intenta con una imagen más pequeña.");
    }
  };


  // MAGIA UX: Interceptor de fotos. Si ya hay foto, la amplía. Si no, abre la cámara.
  const handlePhotoClick = (id, label) => {
    if (formData.photos[id]) {
      setFullScreenImage({ url: formData.photos[id], id, label });
    } else {
      openCamera(label, f => handlePic(f, id));
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkIsExpired = (dateStr) => {
    if (!dateStr) return false;
    const [y, m, day] = dateStr.split('-');
    if (!y || !m || !day) return false;
    const exp = new Date(y, m - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return exp < today;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    
    // Validación Kilometraje de Entrega
    if (!formData.mileage) return showAlert("⚠️ Debes ingresar el kilometraje de entrega.");
    if (!formData.photos?.mileage) return showAlert("⚠️ Debes adjuntar la fotografía del odómetro (kilometraje).");

    // MAGIA: Solo exigimos marcar el tiempo si el resultado sigue pendiente. 
    // Si un Admin forzó el resultado desde afuera, permitimos cerrar el acta sin tiempo.
    if (job.tripType === 'revision' && !formData.prtArrivalTime && formData.rtStatus === 'pendiente') return showAlert("⚠️ Debes presionar 'Llegué a la PRT' e iniciar el tiempo en planta antes de finalizar.");
    if (job.tripType === 'revision' && formData.rtStatus === 'pendiente') return showAlert("⚠️ Debes indicar el resultado de la Revisión Técnica (Aprobado o Rechazado) antes de finalizar el acta.");

    // Validación de Fotografías Obligatorias
    if (job.tripType === 'simple' && (job.isPintura || job.isGrabado)) {
      const reqPhotos = (job.qtyPintura || 0) + (job.qtyGrabado || 0);
      const currentPhotos = Object.values(formData.photos || {}).filter(v => v).length;
      if (currentPhotos < reqPhotos) {
        return showAlert(`⚠️ Evidencia Incompleta: Debes adjuntar las ${reqPhotos} fotografías requeridas para poder cerrar y rendir esta acta.`);
      }
    }

    setIsSubmitting(true);

    let d = { ...formData };
    d.client = d.client === 'OTRO' ? d.manualClient : d.client;

    if (d.noReception) {
      d.receiverName = "ENTREGA SIN RECEPCIÓN";
      d.receiverRut = "N/A";
    }

    // MAGIA: Formatear documentos vencidos para que el PDF los lea como "Vencido" en lugar de "Al día"
    if (d.docs) {
      for (const key of Object.keys(d.docs)) {
        if (d.docs[key] && d.docsExpiry?.[key]) {
          if (checkIsExpired(d.docsExpiry[key])) {
            d.docs[key] = "Vencido";
          } else {
            d.docs[key] = true; // Restaurar a true si cambió la fecha y ya no está vencido
          }
        }
      }
    }

    // --- 1. VALIDACIÓN SINCRÓNICA (Dinero y Rendición) ANTES DE CERRAR ---
    let totalToDeduct = 0;
    const expensesToRegister = [];

    const processExpense = (amountStr, detailStr) => {
      const num = Number(String(amountStr).replace(/[^0-9]/g, ''));
      if (num > 0) {
        totalToDeduct += num;
        expensesToRegister.push({ amount: num, detail: detailStr });
      }
    };

    if (d.hasFuelCharge && d.fuelChargeAmount) {
      processExpense(d.fuelChargeAmount, `Carga Combustible (Patente: ${d.plateOrVin || 'S/N'})`);
    }

    if (job.tripType === 'revision') {
      if (job.rtData?.revision && d.prtCostRevision) processExpense(d.prtCostRevision, `Valor Revisión Técnica (Patente: ${d.plateOrVin || 'S/N'})`);
      if (job.rtData?.inspeccion && d.prtCostInspeccion) processExpense(d.prtCostInspeccion, `Valor Inspección Visual (Patente: ${d.plateOrVin || 'S/N'})`);
      if (job.rtData?.frenos && d.prtCostFrenos) processExpense(d.prtCostFrenos, `Valor Cert. Frenos (Patente: ${d.plateOrVin || 'S/N'})`);
    }

    // Comprobar saldo ANTES de dejar ir al conductor
    if (totalToDeduct > 0) {
      const currentDriver = drivers?.find(drv => drv.email === currentUserEmail);
      const isAdminUser = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(currentUserEmail);

      if (currentDriver) {
        const currentBalance = currentDriver.balance || 0;
        if (!isAdminUser && totalToDeduct > currentBalance) {
          setIsSubmitting(false);
          return showAlert(`No puedes enviar el checklist. Intentas rendir ${formatMoney(totalToDeduct)} en gastos, pero tu fondo actual es de solo ${formatMoney(currentBalance)}. Pide a la central que te asigne más dinero.`);
        }
      }
    }

    // --- 2. MAGIA UX: CERRAR DE INMEDIATO ---
    showAlert("⏳ Guardando y subiendo fotos en segundo plano... Revisa el Ojo para ver el progreso.");
    onComplete(); // ESTO CIERRA LA PANTALLA INSTANTÁNEAMENTE

    // Registra la tarea en la cola global
    const syncTask = pushSyncTask ? pushSyncTask(`Acta Patente ${d.plateOrVin || 'S/N'}`) : { finish: () => { }, error: () => { } };

    // --- 3. SUBIDA SILENCIOSA (SEGUNDO PLANO) ---
    const ejecutarSegundoPlano = async () => {
      try {
        d = await syncFilesToStorage(d);

        const getGPS = () => new Promise((resolve) => {
          if (!("geolocation" in navigator)) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => resolve(null), { timeout: 6000, enableHighAccuracy: true }
          );
        });

        if (!d.location) {
          const coords = await getGPS();
          if (coords) d.location = coords;
        }

        // 🚨 FIX CRÍTICO: Firebase colapsa si detecta campos "undefined" (ej: campos no tocados por el conductor).
        // JSON.stringify purga mágicamente cualquier valor undefined del objeto para que Firebase guarde la data sin fallar.
        const cleanD = JSON.parse(JSON.stringify(d));
        const isKovacs = (cleanD.client || '').toUpperCase().includes('KOVACS');

        // MAGIA: Sincronizar el destino global del traslado con la elección real de la PRT
        let globalDestination = cleanD.destination || '';
        if (job.tripType === 'revision' && (cleanD.rtStatus === 'aprobado' || cleanD.rtStatus === 'aprobado_ayuda')) {
          const basePrt = globalDestination.split('->')[0].trim(); // Extrae "PRT Nombre"
          if (cleanD.rtReturnOption === 'other' && cleanD.rtReturnDestination) {
            globalDestination = `${basePrt} -> ${cleanD.rtReturnDestination}`;
          } else {
            globalDestination = `${basePrt} -> ${cleanD.origin}`;
          }
          cleanD.destination = globalDestination; // Aseguramos que el checklist interno también tenga la info actualizada
        }

        const fd = {
          scheduledDate: job.scheduledDate || new Date().toISOString().split('T')[0],
          client: cleanD.client || '',
          brand: cleanD.brand || '',
          model: cleanD.model || '',
          vin: cleanD.plateOrVin || '',
          plate: cleanD.plateOrVin || '',
          origin: cleanD.origin || '',
          destination: globalDestination,
          status: isKovacs ? 'pending_guide' : 'completed',
          completedAt: Date.now(),
          checklist: cleanD,
          tripType: job.tripType || 'traslado',
          draft: null // 🧹 Limpiamos el borrador para evitar el "robo" de fotos por la función de auto-guardado
        };

        if (job.tripType === 'revision') {
          fd.prt_result = cleanD.rtStatus;
          fd.prt_reason = cleanD.rtRejectReason || '';
        }

        if (totalToDeduct > 0) {
          const currentDriver = drivers?.find(drv => drv.email === currentUserEmail);
          if (currentDriver) {
            const newBalance = (currentDriver.balance || 0) - totalToDeduct;
            await updateDoc(doc(db, 'drivers', currentDriver.id), { balance: newBalance });

            for (const exp of expensesToRegister) {
              await addDoc(collection(db, 'expenses'), {
                driverId: currentDriver.id, driverEmail: currentDriver.email, driverName: currentDriver.name,
                type: 'expense', amount: exp.amount, detail: exp.detail,
                jobId: job.id === 'NEW_QUICK_JOB' ? '' : job.id, deductedAmount: exp.amount, createdAt: Date.now()
              });
            }
          }
        }
        if (d.plateOrVin) {
          const plateUpper = d.plateOrVin.toUpperCase();
          const vehRef = collection(db, 'vehicles');
          const q = query(vehRef, where('plate', '==', plateUpper));
          const querySnapshot = await getDocs(q);
          const activeReminders = (d.internalReminders || []).filter(r => !r.resolved);

          if (!querySnapshot.empty) {
            await updateDoc(doc(db, 'vehicles', querySnapshot.docs[0].id), { docs: d.docs, docsExpiry: d.docsExpiry || {}, internalReminders: activeReminders });
          } else {
            await addDoc(vehRef, { plate: plateUpper, brand: d.brand, model: d.model, client: d.client, docs: d.docs, docsExpiry: d.docsExpiry || {}, internalReminders: activeReminders, createdAt: Date.now() });
          }
        }

        if (isQuick) {
          fd.assignedDriverName = "Auto-creado"; fd.acceptedByEmail = currentUserEmail;
          await addDoc(collection(db, 'transport_jobs'), fd);
        } else {
          if (job.tripType === 'revision' && d.rtStatus === 'rechazado') {
            fd.status = 'failed'; fd.failedReason = d.rtRejectReason || 'Revisión Técnica Rechazada';
            const cloneJob = { scheduledDate: d.scheduledDate || null, client: d.client || '', brand: d.brand || '', model: d.model || '', vin: d.plateOrVin || '', plate: d.plateOrVin || '', origin: d.origin || '', destination: d.destination || '', tripType: job.tripType || 'traslado', rtData: job.rtData || null, assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [], status: 'pending', createdAt: Date.now(), checklist: null };
            await addDoc(collection(db, 'transport_jobs'), cloneJob);
          }
          await updateDoc(doc(db, 'transport_jobs', job.id), fd);
        }

        try {
          if (fd.client && fd.client !== 'Sin Cliente') {
            const qClient = query(collection(db, 'clients'), where('name', '==', fd.client));
            const snapClient = await getDocs(qClient);
            if (!snapClient.empty) {
              const clientRecord = snapClient.docs[0].data();
              const notifs = clientRecord.notifications || { finalizado: !!clientRecord.enableNotifications };
              // Solo notificamos si el trabajo está 100% completado (No en "A espera de guía")
              if (notifs.finalizado && clientRecord.email && fd.status === 'completed') {
                let driverName = d.assignedDriverName || currentUserEmail;
                if (drivers) { const drv = drivers.find(x => x.email === currentUserEmail); if (drv) driverName = drv.name; }

                const emailType = job.tripType === 'revision' ? 'revision_tecnica' : 'finalizado';

                fetch('/api/notify-client', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: clientRecord.email,
                    clientName: clientRecord.name,
                    type: emailType,
                    jobDetails: {
                      id: job.id === 'NEW_QUICK_JOB' ? 'N/A' : job.id,
                      driverName: driverName,
                      vehicle: job.tripType === 'simple' ? (job.description || 'Servicio en Terreno') : (`${fd.brand || ''} ${fd.model || ''}`.trim() || 'Vehículo'),
                      plate: fd.plate || fd.vin || job.associatedPlate || 'S/N',
                      origin: fd.origin || 'Origen',
                      destination: fd.destination || 'Destino',
                      checklist: cleanD // <-- ¡CRÍTICO! Esto le pasa el documento PDF al Backend
                    }
                  })
                });
              }
            }
          }
        } catch (e) { console.error("Error correo cliente:", e); }

        syncTask.finish(); // Pone el ticket en Verde en la cola del Ojo
      } catch (error) {
        console.error("Firebase Error 2do Plano:", error);
        syncTask.error("Error al subir"); // Pone el ticket en Rojo en la cola del Ojo
      }
    };

    ejecutarSegundoPlano();
  };

  if (isInvalidJob) return null;

  const formProps = {
    job, formData, setF, handleImageUpload, removeImage, getRouteStr, drivers,
    handleQuickSetLocation, step, setStep, showAlert, allClientsList,
    addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex,
    setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex,
    setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData,
    setTempDamageData, fileInputRef, processingId, currentUserEmail,
    showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu,
    uploadProgress, cameraConfig, setCameraConfig, processingAction,
    handleRemoteSignRequest, handleOpenQR, handlePhotoClick, isSubmitting, clearDraft, isDraftLoaded
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border pb-10 relative">
      {isDraftLoaded && (
        <div className="absolute -top-12 left-0 right-0 flex justify-center items-center">
          <div className="bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-sm border border-amber-200">
            <Save className="w-3.5 h-3.5" /> Borrador recuperado
            <button onClick={clearDraft} className="ml-2 text-amber-600 underline">Limpiar</button>
          </div>
        </div>
      )}


      <div className="bg-blue-600 text-white p-5 flex justify-between items-center rounded-t-3xl"><h2 className="font-bold text-base"><FileText className="inline w-5 h-5 mr-1" /> Formulario Checklist</h2><button type="button" onClick={() => showConfirm("¿Deseas salir? (Tu progreso quedará guardado localmente)", onCancel)} className="bg-blue-800 px-3 py-1 rounded-xl text-xs font-bold">Salir</button></div>

      <div className="sticky top-[64px] sm:top-[80px] z-15 bg-white/90 backdrop-blur-md border-b border-slate-200 px-5 py-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso del Acta</span>
          <span className="text-xs font-black text-blue-600">
            {(() => {
              let p = 0;
              if (job.tripType === 'simple') {
                const req = (job.isPintura || job.isGrabado) ? ((job.qtyPintura || 0) + (job.qtyGrabado || 0)) : 1;
                const cur = Object.values(formData.photos || {}).filter(v => v).length;
                if (formData.observations) p += 33;
                if (cur >= req) p += 33;
                if (formData.signatureData || formData.noReception) p += 34;
              } else {
                if (formData.brand && formData.model && formData.plateOrVin) p += 25;
                if (formData.fuelLevel !== undefined) p += 25;
                if (Object.values(formData.photos || {}).filter(v => v).length >= 2) p += 25;
                if (formData.signatureData || formData.noReception) p += 25;
              }
              return Math.min(100, p);
            })()}%
          </span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-500 ease-out ${job.tripType === 'simple' ? 'bg-purple-500' : 'bg-blue-500'}`} style={{
            width: `${(() => {
                let p = 0;
                if (job.tripType === 'simple') {
                  const req = (job.isPintura || job.isGrabado) ? ((job.qtyPintura || 0) + (job.qtyGrabado || 0)) : 1;
                  const cur = Object.values(formData.photos || {}).filter(v => v).length;
                  if (formData.observations) p += 33;
                  if (cur >= req) p += 33;
                  if (formData.signatureData || formData.noReception) p += 34;
                } else {
                  if (formData.brand && formData.model && formData.plateOrVin) p += 25;
                  if (formData.fuelLevel !== undefined) p += 25;
                  if (Object.values(formData.photos || {}).filter(v => v).length >= 2) p += 25;
                  if (formData.signatureData || formData.noReception) p += 25;
                }
                return Math.min(100, p);
              })()
              }%`
          }}></div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-5 border-b border-slate-100 scrollbar-none">
          {(job.tripType === 'simple'
            ? [{ id: 1, label: '📋 Detalles' }, { id: 2, label: '📸 Evidencia' }, { id: 3, label: '✍️ Cierre' }]
            : [{ id: 1, label: '📋 Datos' }, { id: 2, label: '📄 Docs' }, { id: 3, label: '💬 Notas' }, { id: 4, label: '📸 Fotos' }, { id: 5, label: '⛽ Comb. & Espera' }, { id: 6, label: '✍️ Entrega' }]
          ).map(t => (
            <button key={t.id} type="button" onClick={() => setStep(t.id)} className={`px-3 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all shrink-0 ${step === t.id ? (job.tripType === 'simple' ? 'bg-purple-600 text-white shadow-md shadow-purple-100' : 'bg-blue-600 text-white shadow-md shadow-blue-100') : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5 text-sm">

          {/* VISTA: TRABAJO SIMPLE (FAST TRACK) */}
          <Step1Origin {...formProps} />
          <Step2Vehicle {...formProps} />
          <Step3Damage {...formProps} />
          <Step4Destination {...formProps} />
          <Step5Extras {...formProps} />
          <Step6Signature {...formProps} />

        </form>
      </div>
      <DejaVuModal {...formProps} />
    </div>
  );
}
