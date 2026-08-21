import React, { useState, useEffect, useRef } from 'react';
import { updateDoc, doc, setDoc, addDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import {
  FileText, MapPin, CheckCircle, CloudOff, AlertCircle, Eye,
  Trash2, Camera, Search, X, Fuel, Clock, Wallet, Receipt,
  Share2, QrCode, Save, Zap, Mic, Loader2
} from 'lucide-react';
import SignaturePad from '../ui/SignaturePad';
import InAppCamera from '../ui/InAppCamera'; // <-- NUEVO COMPONENTE CENTRALIZADO
import { resizeImage, formatMoney, getVehicleIdentifierLabel } from '../../utils/helpers';
import { processVoiceCommand } from '../../utils/aiInterpreter';
const FormattedMonthInput = ({ value, onChange, isExp }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Initialize selected year when opening
  useEffect(() => {
    if (isOpen) {
      const initialY = value ? parseInt(value.split('-')[0], 10) : new Date().getFullYear();
      setSelectedYear(initialY);
    }
  }, [isOpen, value]);

  const formatMonthToShort = (yyyyMm) => {
    if (!yyyyMm) return '';
    const [y, m] = yyyyMm.split('-');
    if (!y || !m) return yyyyMm;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${months[parseInt(m, 10) - 1]}-${y}`;
  };

  const handleSelect = (y, m) => {
    const formatted = `${y}-${m.toString().padStart(2, '0')}`;
    // Simulate event object to match existing onChange expectations
    onChange({ target: { value: formatted } });
    setIsOpen(false);
  };

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`w-full bg-white dark:bg-slate-900 border p-1.5 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 outline-none text-center transition-colors uppercase cursor-pointer flex items-center justify-center min-h-[34px] ${isExp ? 'border-red-300 dark:border-red-700/50' : 'border-green-200 dark:border-green-800/50'} ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}
      >
        {value ? formatMonthToShort(value) : 'MM-AAAA'}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-white">Seleccionar Fecha</h3>
              <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-full">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4">
              <div className="flex justify-between items-center mb-4 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                <button 
                  type="button"
                  onClick={() => setSelectedYear(y => y - 1)}
                  className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm transition-colors"
                >
                  -
                </button>
                <span className="text-lg font-black text-slate-800 dark:text-white">{selectedYear}</span>
                <button 
                  type="button"
                  onClick={() => setSelectedYear(y => y + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm transition-colors"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {months.map((m, i) => {
                  const monthNum = i + 1;
                  const isSelected = value && parseInt(value.split('-')[1], 10) === monthNum && parseInt(value.split('-')[0], 10) === selectedYear;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelect(selectedYear, monthNum)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-900' 
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/50'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
               <button 
                 type="button"
                 onClick={() => {
                   onChange({ target: { value: '' } });
                   setIsOpen(false);
                 }}
                 className="w-full py-2.5 rounded-xl font-bold text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
               >
                 Borrar Fecha
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


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
    photos: job.checklist?.photos || { front: false, left: false, right: false, back: false, tire: false, dashboard: false, mileage: false, vin: false, ...Array.from({ length: 30 }).reduce((acc, _, i) => { acc[`det${i + 1}`] = false; return acc; }, {}) },
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
  const [isListening, setIsListening] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const recognitionRef = useRef(null);
  const [liveTranscript, setLiveTranscript] = useState('');

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
  const [cameraConfig, setCameraConfig] = useState({ isOpen: false, title: '', onCapture: null, enableAnnotation: false });

  const openCamera = (title, callback, enableAnnotation = false) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Tu navegador o dispositivo no soporta la cámara interna. Por favor, verifica los permisos o usa Chrome/Safari.");
      return;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => { });
    }

    // EL FIX: Ahora sí le pasamos el "enableAnnotation" al estado para que la cámara sepa que debe usar el croquis
    setCameraConfig({ isOpen: true, title, onCapture: callback, enableAnnotation });
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

  // --- INICIO: LÓGICA DE ASISTENTE DE VOZ ---
  const toggleVoiceAssistant = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAlert("Tu navegador no soporta el reconocimiento de voz nativo. Usa Chrome o Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CL';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript('');
    };

    recognition.onresult = async (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      setLiveTranscript(transcript);

      if (!isFinal) return;
      
      recognition.stop();
      setIsListening(false);
      setIsInterpreting(true);
      
      try {
        const result = await processVoiceCommand(transcript);
        
        if (result.docsExpiry) {
          setF('docsExpiry', { ...formData.docsExpiry, ...result.docsExpiry });
        }
        if (typeof result.hasEquipment === 'boolean') {
          setF('hasEquipment', result.hasEquipment);
        }
        if (result.equipment) {
          setF('equipment', { ...formData.equipment, ...result.equipment });
        }
        if (result.equipmentDetails) {
          setF('equipmentDetails', result.equipmentDetails);
        }
        if (typeof result.fuelLevel === 'number') {
          setF('fuelLevel', result.fuelLevel);
        }
        if (typeof result.hasFuelCharge === 'boolean') {
          setF('hasFuelCharge', result.hasFuelCharge);
        }
        if (typeof result.fuelChargeAmount === 'number') {
          setF('fuelChargeAmount', result.fuelChargeAmount);
        }
        
        showAlert("✅ Checklist actualizado por IA según tu dictado.");
      } catch (error) {
        console.error(error);
        showAlert("❌ No se pudo interpretar el comando de voz: " + error.message);
      } finally {
        setIsInterpreting(false);
        setTimeout(() => setLiveTranscript(''), 4000);
      }
    };

    recognition.onerror = (event) => {
      console.error("Error de reconocimiento de voz:", event.error);
      setIsListening(false);
      if (event.error !== 'aborted') {
         showAlert("❌ Error al escuchar el micrófono. Revisa los permisos.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };
  // --- FIN: LÓGICA DE ASISTENTE DE VOZ ---

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
    const parts = dateStr.split('-');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parts.length === 2) {
      const exp = new Date(parts[0], parts[1], 0);
      return exp < today;
    } else {
      const [y, m, day] = parts;
      if (!y || !m || !day) return false;
      const exp = new Date(y, m - 1, day);
      return exp < today;
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");


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

    // Validación VIN Kovacs
    const isKovacs = formData.client && formData.client.toLowerCase().includes('kovacs');
    if (isKovacs && !formData.photos?.vin) {
      return showAlert("⚠️ Evidencia Incompleta: Es obligatorio adjuntar la foto del NÚMERO VIN para todos los vehículos de Kovacs.");
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

    const getIdentifier = getVehicleIdentifierLabel;

    if (d.hasFuelCharge && d.fuelChargeAmount) {
      processExpense(d.fuelChargeAmount, `Carga Combustible (${getIdentifier(d.plateOrVin)})`);
    }

    if (job.tripType === 'revision') {
      if (job.rtData?.revision && d.prtCostRevision) processExpense(d.prtCostRevision, `Valor Revisión Técnica (${getIdentifier(d.plateOrVin)})`);
      if (job.rtData?.inspeccion && d.prtCostInspeccion) processExpense(d.prtCostInspeccion, `Valor Inspección Visual (${getIdentifier(d.plateOrVin)})`);
      if (job.rtData?.frenos && d.prtCostFrenos) processExpense(d.prtCostFrenos, `Valor Cert. Frenos (${getIdentifier(d.plateOrVin)})`);
      if (job.rtData?.gases && d.prtCostGases) processExpense(d.prtCostGases, `Valor Cert. Gases (${getIdentifier(d.plateOrVin)})`);
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
    const identifierLabel = getVehicleIdentifierLabel(d.plateOrVin).replace(': ', ' ');
    const syncTask = pushSyncTask ? pushSyncTask(`Acta ${identifierLabel}`) : { finish: () => { }, error: () => { } };

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

  return (
    <div className="bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/20 pb-10 relative">
      {isDraftLoaded && (
        <div className="absolute -top-12 left-0 right-0 flex justify-center items-center">
          <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-sm border border-amber-200 dark:border-amber-800/50">
            <Save className="w-3.5 h-3.5" /> Borrador recuperado
            <button onClick={clearDraft} className="ml-2 text-amber-600 dark:text-amber-400 underline">Limpiar</button>
          </div>
        </div>
      )}


      <div className="bg-blue-600 text-white p-5 flex justify-between items-center rounded-t-3xl"><h2 className="font-bold text-base"><FileText className="inline w-5 h-5 mr-1" /> Formulario Checklist</h2><button type="button" onClick={() => showConfirm("¿Deseas salir? (Tu progreso quedará guardado localmente)", onCancel)} className="bg-blue-800 px-3 py-1 rounded-xl text-xs font-bold">Salir</button></div>

      <div className="sticky top-[64px] sm:top-[80px] z-15 bg-white/20 dark:bg-black/50 backdrop-blur-lg border-b border-white/20 px-5 py-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Progreso del Acta</span>
          <span className="text-xs font-black text-blue-600 dark:text-blue-400">
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
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
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
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-5 border-b border-slate-100 dark:border-slate-800 scrollbar-none">
          {(job.tripType === 'simple'
            ? [{ id: 1, label: '📋 Detalles' }, { id: 2, label: '📸 Evidencia' }, { id: 3, label: '✍️ Cierre' }]
            : [{ id: 1, label: '📋 Datos' }, { id: 2, label: '📄 Docs' }, { id: 3, label: '💬 Notas' }, { id: 4, label: '📸 Fotos' }, { id: 5, label: '⛽ Comb. & Espera' }, { id: 6, label: '✍️ Entrega' }]
          ).map(t => (
            <button key={t.id} type="button" onClick={() => setStep(t.id)} className={`px-3 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all shrink-0 ${step === t.id ? (job.tripType === 'simple' ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-md shadow-purple-100 dark:shadow-none' : 'bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-100 dark:shadow-none') : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5 text-sm">

          {/* VISTA: TRABAJO SIMPLE (FAST TRACK) */}
          {job.tripType === 'simple' && step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-100 dark:border-purple-800/50 p-4 rounded-2xl shadow-sm mb-4">
                <p className="text-[10px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest mb-1">Descripción de la Tarea</p>
                <p className="text-sm font-bold text-purple-900 dark:text-purple-100 leading-snug">{job.description || 'Sin descripción detallada'}</p>
                {job.client && <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mt-2 border-t border-purple-200 dark:border-purple-800/50 pt-2">Cliente / Autoriza: {job.client}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl">
                  <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Lugar</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{job.origin || 'N/A'}</p>
                </div>
                {job.destination && (
                  <div className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-3 rounded-xl">
                    <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Hasta</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{job.destination}</p>
                  </div>
                )}
              </div>

              <h3 className="text-sm font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2 mt-6 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Notas del Operario</h3>
              <textarea className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 dark:focus:border-purple-400 min-h-[100px]" placeholder="Ej: Las plantillas de vinilo no dejaron residuos. Trabajo ejecutado sin novedades..." autoComplete="off" autoCorrect="off" spellCheck="false" value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />
            </div>
          )}

          {job.tripType === 'simple' && step === 2 && (() => {
            const isSpecialJob = job.isPintura || job.isGrabado;
            const reqPhotos = isSpecialJob ? ((job.qtyPintura || 0) + (job.qtyGrabado || 0)) : 4;
            const photoKeys = Array.from({ length: reqPhotos > 0 ? reqPhotos : 4 }, (_, i) => `det${i + 1}`);

            return (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-sm font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Evidencia Fotográfica</h3>

                {isSpecialJob ? (
                  <div className="bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-800/50 p-4 rounded-2xl mb-4 shadow-sm">
                    <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">Requisito Obligatorio</p>
                    <p className="text-sm font-bold text-purple-900 dark:text-purple-300 leading-tight">Se requieren <span className="font-black bg-purple-200 px-1.5 py-0.5 rounded">{reqPhotos} fotografías</span> individuales (Una por cada patente o vidrio trabajado).</p>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">Añade al menos 1 fotografía que respalde el trabajo terminado.</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {photoKeys.map((photoId, idx) => {
                    let label = `Foto ${idx + 1}`;
                    if (isSpecialJob) {
                      if (idx < (job.qtyPintura || 0)) {
                        label = `Patente ${idx + 1}`;
                      } else {
                        label = `Vidrio ${(idx + 1) - (job.qtyPintura || 0)}`;
                      }
                    }

                    return (
                      <button type="button" key={photoId} onClick={() => handlePhotoClick(photoId, label)} className={`w-full h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all ${formData.photos[photoId] ? 'border-purple-400 ring-2 ring-purple-100' : 'border-dashed border-purple-300 dark:border-purple-700/50 hover:bg-purple-50 dark:bg-purple-900/30'}`}>
                        {formData.photos[photoId] ? <><img src={formData.photos[photoId]} className="absolute inset-0 w-full h-full object-cover opacity-60" /><CheckCircle className="w-6 h-6 text-purple-600 dark:text-purple-400 relative z-10 bg-white dark:bg-slate-900 rounded-full" /><span className="text-[10px] font-black text-purple-900 dark:text-purple-300 relative z-10 bg-white dark:bg-slate-900 px-2 rounded-md">{label}</span></> : <><Camera className="w-6 h-6 text-purple-400" /><span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wide text-center leading-tight">{label}</span></>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* VISTA: TRASLADO NORMAL */}
          {job.tripType !== 'simple' && step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">              {isQuick ? (
              <div className="space-y-2">
                <select value={formData.client} onChange={(e) => setF('client', e.target.value)} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 outline-none focus:border-blue-500">
                  <option value="">Selecciona el Cliente...</option>
                  {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="OTRO">Otro (Ingreso Manual)</option>
                </select>
                {formData.client === 'OTRO' && <input value={formData.manualClient} onChange={e => setF('manualClient', e.target.value)} placeholder="Escribe el nombre del cliente" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 mt-2" />}
              </div>
            ) : (
              <input value={formData.client} onChange={e => setF('client', e.target.value)} placeholder="Cliente" autoComplete="off" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900" readOnly />
            )}

              <div className="grid grid-cols-2 gap-4">
                <input value={formData.brand} onChange={e => setF('brand', e.target.value)} placeholder="Marca" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 rounded-xl font-bold text-slate-800 dark:text-slate-200" />
                <input value={formData.model} onChange={e => setF('model', e.target.value)} placeholder="Modelo" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 rounded-xl font-bold text-slate-800 dark:text-slate-200" />
              </div>
              <input value={formData.plateOrVin} onChange={e => setF('plateOrVin', e.target.value)} placeholder="Patente o VIN" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl font-black uppercase text-slate-800 dark:text-slate-200 shadow-inner mt-2" />

              {/* ALERTA DÉJÀ VU PERICIAL */}
              {dejaVuData && (
                <div className="bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-800/50 p-4 rounded-2xl shadow-sm animate-in zoom-in-95 flex items-start gap-3 mt-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                  <div className="bg-purple-200 p-2 rounded-full text-purple-700 dark:text-purple-400 animate-pulse shrink-0">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-purple-800 dark:text-purple-300 uppercase tracking-widest mb-1">Déjà Vu Pericial</h4>
                    <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 leading-tight mb-3">
                      Hay registros de daños previos en este vehículo (Traslado del {new Date(dejaVuData.completedAt).toLocaleDateString()}).
                    </p>
                    <button type="button" onClick={() => setShowDejaVuModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase transition-colors shadow-sm w-full">
                      Ver Daños Anteriores
                    </button>
                  </div>
                </div>
              )}


              {job.tripType === 'revision' && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3 mt-4">
                  <h3 className="text-sm font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2"><Clock className="w-5 h-5" /> Tiempo en Planta</h3>

                  {(!formData.prtArrivalTime && formData.rtStatus === 'pendiente') && (
                    <button type="button" onClick={() => setF('prtArrivalTime', Date.now())} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-md shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95">
                      <MapPin className="w-5 h-5" /> LLEGUÉ A LA PRT (Iniciar Tiempo)
                    </button>
                  )}

                  {formData.prtArrivalTime && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800/50 p-3.5 rounded-xl flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${formData.rtStatus === 'pendiente' ? 'bg-blue-200 text-blue-700 dark:text-blue-400 animate-spin' : 'bg-green-200 text-green-700 dark:text-green-400'}`}>
                          {formData.rtStatus === 'pendiente' ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest">Cronómetro Trámite</p>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {formData.rtStatus === 'pendiente'
                              ? `${Math.floor((nowTick - formData.prtArrivalTime) / 60000)} minutos corriendo...`
                              : `${Math.floor(((formData.prtFinishTime || Date.now()) - formData.prtArrivalTime) / 60000)} min en total (Finalizado)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(formData.prtArrivalTime || formData.rtStatus !== 'pendiente') && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mt-5 mb-2">Resultado de la Revisión</h3>
                      <select value={formData.rtStatus} onChange={e => {
                        setF('rtStatus', e.target.value);
                        if (e.target.value !== 'pendiente' && !formData.prtFinishTime && formData.prtArrivalTime) {
                          setF('prtFinishTime', Date.now()); // Detiene el cronómetro para siempre
                        }
                      }} className={`w-full border-2 p-3.5 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'pendiente' ? 'border-blue-300 dark:border-blue-700/50 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400' : formData.rtStatus === 'aprobado' ? 'border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : formData.rtStatus === 'aprobado_ayuda' ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                        <option value="pendiente" disabled>⏳ TRÁMITE EN CURSO...</option>
                        <option value="aprobado">✅ APROBADO</option>
                        <option value="aprobado_ayuda">🤝 APROBADO CON AYUDA</option>
                        <option value="rechazado">❌ RECHAZADO</option>
                      </select>
                    </div>
                  )}

                  {formData.rtStatus === 'rechazado' && (
                    <input value={formData.rtRejectReason} onChange={e => setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required={formData.rtStatus === 'rechazado'} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-red-300 dark:border-red-700/50 p-3 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 dark:text-red-300 bg-white dark:bg-slate-900 mt-2 animate-in fade-in" />
                  )}
                  {(formData.rtStatus === 'aprobado' || formData.rtStatus === 'aprobado_ayuda') && (
                    <div className="mt-2 p-3 border border-green-200 dark:border-green-800/50 bg-white dark:bg-slate-900 rounded-xl space-y-2 animate-in fade-in">
                      <p className="text-xs font-bold text-green-800 dark:text-green-300">¿Hacia dónde se dirige el vehículo tras aprobar?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700 dark:text-green-400">
                          <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e => setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600" />
                          Volver al Origen
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700 dark:text-green-400">
                          <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e => setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600" />
                          Otro Destino
                        </label>
                      </div>
                      {formData.rtReturnOption === 'other' && (
                        <input value={formData.rtReturnDestination} onChange={e => setF('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required={formData.rtReturnOption === 'other'} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-green-300 dark:border-green-700/50 p-2.5 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 dark:text-green-300 bg-white dark:bg-slate-900" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {job.tripType !== 'simple' && step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Documentos del Vehículo</h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[{ id: 'soap', label: 'SOAP', icon: <FileText className="w-5 h-5" /> }, { id: 'permiso', label: 'Permiso Circ.', icon: <MapPin className="w-5 h-5" /> }, { id: 'revTecnica', label: 'Rev. Técnica', icon: <CheckCircle className="w-5 h-5" /> }, { id: 'gases', label: 'Gases', icon: <CloudOff className="w-5 h-5" /> }].map(doc => {
                  const isExp = checkIsExpired(formData.docsExpiry?.[doc.id]);
                  const isChecked = !!formData.docs[doc.id];

                  return (
                    <div key={doc.id} className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setF('docs', { ...formData.docs, [doc.id]: !isChecked })}
                        className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all duration-200 select-none shadow-sm ${!isChecked ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100 dark:bg-slate-800 hover:border-slate-300 dark:border-slate-600' : isExp ? 'border-red-500 bg-red-500 text-white shadow-red-200' : 'border-green-500 bg-green-500 text-white shadow-green-200'}`}
                      >
                        {isChecked ? (isExp ? <AlertCircle className="w-6 h-6 animate-in zoom-in" /> : <CheckCircle className="w-6 h-6 animate-in zoom-in" />) : doc.icon}
                        <span className="font-black text-xs uppercase tracking-wider">{doc.label}</span>
                      </button>
                      {isChecked && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className={`${isExp ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50' : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800/50'} border p-2 rounded-xl flex flex-col gap-1 shadow-inner transition-colors`}>
                            <p className={`text-[9px] font-extrabold uppercase tracking-widest text-center ${isExp ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>Vencimiento {isExp && '(VENCIDO)'}</p>
                            <FormattedMonthInput value={(formData.docsExpiry?.[doc.id] || '').substring(0, 7)} onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} isExp={isExp} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* SECCIÓN DOCUMENTOS EXTERNOS Y BANDEJA */}
              <div className="mt-8 border-t-2 border-slate-100 dark:border-slate-800 pt-5">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500" /> Documentos Adicionales</h3>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-4 leading-tight">Si escaneaste con CamScanner o Adobe Scan, pega el link aquí o adjunta el PDF directamente.</p>

                <div className="space-y-4">

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest ml-1">Enlace / Link del Documento</label>
                    <div className="flex gap-2">
                      <input type="url" placeholder="Ej: https://acrobat.adobe.com/..." value={formData.scannerLink || ''} onChange={(e) => setF('scannerLink', e.target.value)} className="w-full border-2 border-indigo-100 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-sm outline-none focus:border-indigo-500 transition-colors" />
                      <button type="button" onClick={async () => {
                        if (!formData.scannerLink) return showAlert("⚠️ Pega un link primero.");
                        if (job.id === 'NEW_QUICK_JOB') return showAlert("⚠️ Debes 'Finalizar y Guardar' el acta abajo para poder notificar este link.");

                        showAlert("⏳ Guardando link y notificando al cliente...");
                        try {
                          const { updateDoc, doc, query, collection, where, getDocs } = await import('firebase/firestore');
                          const newChecklist = { ...(job.checklist || {}), scannerLink: formData.scannerLink };
                          await updateDoc(doc(db, 'transport_jobs', job.id), { checklist: newChecklist });

                          // Buscamos al cliente directo en la colección segura para sacar el correo real
                          const qClient = query(collection(db, 'clients'), where('name', '==', job.client || ''));
                          const snapClient = await getDocs(qClient);

                          if (!snapClient.empty) {
                            const clientRecord = snapClient.docs[0].data();
                            const targetEmail = clientRecord.email?.split(',')[0]?.trim();

                            if (targetEmail) {
                              fetch('/api/notify-client', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  email: targetEmail,
                                  clientName: clientRecord.name,
                                  type: 'revision_tecnica',
                                  jobDetails: {
                                    id: job.id,
                                    driverName: drivers?.find(x => x.email === currentUserEmail)?.name || currentUserEmail,
                                    vehicle: job.tripType === 'simple' ? (job.description || 'Servicio en Terreno') : (`${job.brand || ''} ${job.model || ''}`.trim() || 'Vehículo'),
                                    plate: job.plate || job.vin || job.associatedPlate || 'S/N',
                                    origin: job.origin || 'Origen',
                                    destination: job.destination || 'Destino',
                                    checklist: newChecklist
                                  }
                                })
                              }).catch((err) => console.error("Error enviando correo:", err));
                            }
                          }
                          showAlert("✅ Link guardado y cliente notificado exitosamente.");
                        } catch (err) {
                          showAlert("❌ Error al guardar el link.");
                        }
                      }} className="bg-indigo-600 text-white px-4 rounded-xl font-black text-[10px] shadow-sm hover:bg-indigo-700 active:scale-95 transition-all flex flex-col items-center justify-center leading-tight">
                        <span>ENVIAR</span><span>AVISO</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 opacity-60"><div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div><span className="text-[10px] font-black uppercase text-slate-400">O Subir Archivo Físico</span><div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div></div>

                  <label className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-300 dark:border-indigo-700/50 hover:bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-4 rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm">
                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files[0];
                      if (!f) return;

                      // Prevención: Si es un trabajo nuevo, se sube normal al final
                      if (job.id === 'NEW_QUICK_JOB') {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setF('scandocPdf', reader.result);
                          showAlert("✅ Archivo adjuntado temporalmente. Se subirá y notificará al finalizar el acta.");
                        };
                        reader.readAsDataURL(f);
                        return;
                      }

                      showAlert("⏳ Subiendo documento y notificando al cliente...");
                      try {
                        const reader = new FileReader();
                        reader.onload = async () => {
                          try {
                            const base64 = reader.result;
                            const ext = f.type.includes('pdf') ? 'pdf' : 'jpg';

                            const { getStorage, ref, uploadString, getDownloadURL } = await import('firebase/storage');
                            const storage = getStorage();
                            const fileRef = ref(storage, `checklists/${job.id}/documento_PRT_directo_${Date.now()}.${ext}`);

                            const metadata = { contentType: f.type };
                            await uploadString(fileRef, base64, 'data_url', metadata);
                            const url = await getDownloadURL(fileRef);

                            const { updateDoc, doc, query, collection, where, getDocs } = await import('firebase/firestore');
                            const newChecklist = { ...(job.checklist || {}), scandocPdf: url };
                            await updateDoc(doc(db, 'transport_jobs', job.id), { checklist: newChecklist });

                            setF('scandocPdf', url);

                            // Buscamos al cliente directo en la colección segura para sacar el correo real
                            const qClient = query(collection(db, 'clients'), where('name', '==', job.client || ''));
                            const snapClient = await getDocs(qClient);

                            if (!snapClient.empty) {
                              const clientRecord = snapClient.docs[0].data();
                              const targetEmail = clientRecord.email?.split(',')[0]?.trim();

                              if (targetEmail) {
                                fetch('/api/notify-client', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    email: targetEmail,
                                    clientName: clientRecord.name,
                                    type: 'revision_tecnica',
                                    jobDetails: {
                                      id: job.id === 'NEW_QUICK_JOB' ? 'N/A' : job.id,
                                      driverName: drivers?.find(x => x.email === currentUserEmail)?.name || currentUserEmail,
                                      vehicle: job.tripType === 'simple' ? (job.description || 'Servicio en Terreno') : (`${job.brand || ''} ${job.model || ''}`.trim() || 'Vehículo'),
                                      plate: job.plate || job.vin || job.associatedPlate || 'S/N',
                                      origin: job.origin || 'Origen',
                                      destination: job.destination || 'Destino',
                                      checklist: newChecklist
                                    }
                                  })
                                }).catch((err) => console.error("Error enviando correo:", err));
                              }
                            }

                            showAlert("✅ Documento guardado y cliente notificado exitosamente.");
                          } catch (uploadError) {
                            console.error(uploadError);
                            showAlert("❌ Error al subir y notificar.");
                          }
                        };
                        reader.readAsDataURL(f);
                      } catch (err) {
                        showAlert("❌ Error al leer el documento.");
                      }
                    }} />
                    <FileText className="w-6 h-6" />
                    <span className="text-center">{formData.scandocPdf ? '✅ ARCHIVO CARGADO (Toca para cambiar)' : 'ADJUNTAR PDF O FOTO Y NOTIFICAR AL CLIENTE'}</span>
                  </label>
                </div>

                {job.checklist?.scandocPdfInbox && (
                  <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <p className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-tight">Doc. Asignado (Bandeja)</p>
                    </div>
                    <a href={job.checklist.scandocPdfInbox} target="_blank" rel="noreferrer" className="text-[10px] bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg font-bold shadow-sm hover:bg-emerald-500">VER PDF</a>
                  </div>
                )}
              </div>
            </div>
          )}


          {job.tripType !== 'simple' && step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Observaciones Generales</h3>
                <textarea className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 min-h-[90px]" placeholder="Escribe aquí si hay algún daño, rayón o comentario del estado visual del vehículo..." autoComplete="off" autoCorrect="off" spellCheck="false" value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />
              </div>

              {/* NUEVO: NOTAS DURANTE EL TRASLADO */}
              <div className="space-y-4 bg-orange-50 dark:bg-orange-900/30 p-4 rounded-3xl border border-orange-200 dark:border-orange-800/50 shadow-sm">
                <h3 className="text-sm font-extrabold pb-2 text-orange-800 dark:text-orange-300 uppercase tracking-wider flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Notas durante el traslado</h3>
                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 leading-tight">Usa este espacio para reportar eventos como: ruidos extraños, pinchazos, piquetes en parabrisas, u otras novedades ocurridas netamente en la ruta.</p>
                <textarea className="w-full border-2 border-orange-200 dark:border-orange-800/50 p-3 rounded-xl text-sm font-bold text-orange-800 dark:text-orange-300 outline-none focus:border-orange-500 min-h-[90px] bg-white dark:bg-slate-900 placeholder-orange-300" placeholder="Ej: Piquete en parabrisas en carretera, neumático con baja presión..." autoComplete="off" autoCorrect="off" spellCheck="false" value={formData.transitNotes || ''} onChange={(e) => setF('transitNotes', e.target.value)} />
              </div>

              {/* NUEVO: VERIFICACIÓN DE EQUIPAMIENTO */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 relative overflow-hidden">
                <label className="flex items-center gap-3 cursor-pointer relative z-10">
                  <input type="checkbox" checked={formData.hasEquipment || false} onChange={e => setF('hasEquipment', e.target.checked)} className="w-6 h-6 rounded cursor-pointer accent-blue-600" />
                  <span className="font-black text-slate-800 dark:text-slate-200 text-sm tracking-wide">VERIFICAR EQUIPAMIENTO</span>
                </label>

                {formData.hasEquipment && (
                  <div className="animate-in fade-in slide-in-from-top-2 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-4 relative z-10">
                    <div className="grid grid-cols-2 gap-3">
                      {equipmentList.map(item => {
                        const isChecked = formData.equipment?.[item] || false;
                        return (
                          <label key={item} className={`flex items-start gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer select-none ${isChecked ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-300 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:border-blue-700/50'}`}>
                            <input type="checkbox" checked={isChecked} onChange={e => setF('equipment', { ...formData.equipment, [item]: e.target.checked })} className="w-4 h-4 accent-blue-600 rounded shrink-0 mt-0.5" />
                            <span className="text-[11px] font-extrabold leading-tight">{item}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="space-y-1.5 pt-2">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Herramientas u otros detalles</label>
                      <input type="text" placeholder="Ej: Destornillador, chaleco extra..." value={formData.equipmentDetails || ''} onChange={e => setF('equipmentDetails', e.target.value)} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl font-bold text-xs outline-none focus:border-blue-500 shadow-inner bg-white dark:bg-slate-900" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          {job.tripType !== 'simple' && step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Croquis Pericial de Daños</h3>
                <select value={formData.vehicleType || 'auto'} onChange={e => setF('vehicleType', e.target.value)} className="bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-[10px] font-bold p-1.5 rounded-lg outline-none text-slate-700 dark:text-slate-300 cursor-pointer max-w-[140px]">
                  <option value="auto">🚙 Auto/SUV</option>
                  <option value="camioneta">🛻 Camioneta</option>
                  <option value="furgon_pequeno">🚐 Furgón Peq.</option>
                  <option value="furgon_grande">🚐 Furgón Grande</option>
                  <option value="camion">🚚 Camión Simple</option>
                  <option value="camion_doble">🚚 Camión Doble Cab.</option>
                  <option value="camion_2ejes">🚛 Camión (2 Ejes)</option>
                  <option value="camion_3ejes">🚛 Camión (3 Ejes)</option>
                  <option value="camion_8x4">🚚 Camión Rigid (8x4)</option>
                  <option value="carro_arrastre">🛒 Carro Arrastre</option>
                </select>
              </div>


              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl border-2 border-slate-100 dark:border-slate-800 mb-4 select-none relative">
                <div className="flex justify-between items-center mb-4 min-h-[40px]">
                  {!formData.zoomZone ? (
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed w-full text-center">
                      Toca los recuadros para fotos generales.<br />
                      <span className="text-blue-500 text-xs">Toca un cuadrante del auto para acercar y marcar.</span>
                    </p>
                  ) : (
                    <div className="w-full flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 p-2 rounded-xl border border-blue-200 dark:border-blue-800/50 animate-in fade-in">
                      <p className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase animate-pulse flex items-center gap-1"><Search className="w-4 h-4" /> Toca el daño exacto</p>
                      <button type="button" onClick={() => setF('zoomZone', null)} className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-1 hover:bg-slate-100 dark:bg-slate-800 transition-colors"><X className="w-3 h-3" /> Volver</button>
                    </div>
                  )}
                </div>

                <div className="relative w-full max-w-[280px] h-[400px] mx-auto my-6">
                  <div
                    className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 cursor-crosshair transition-all duration-300 ease-out drop-shadow-lg ${!formData.zoomZone ? 'scale-100 z-10 hover:opacity-90' :
                      formData.zoomZone === 'tl' ? 'scale-[1.8] origin-top-left z-50' :
                        formData.zoomZone === 'tr' ? 'scale-[1.8] origin-top-right z-50' :
                          formData.zoomZone === 'ml' ? 'scale-[1.8] origin-left z-50' :
                            formData.zoomZone === 'mr' ? 'scale-[1.8] origin-right z-50' :
                              formData.zoomZone === 'bl' ? 'scale-[1.8] origin-bottom-left z-50' :
                                'scale-[1.8] origin-bottom-right z-50'
                      }`}
                    style={{ height: formData.vehicleType?.includes('camion') || formData.vehicleType === 'furgon_grande' || formData.vehicleType === 'carro_arrastre' ? '260px' : '220px' }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;


                      if (!formData.zoomZone) {
                        let zone = y < 33 ? 't' : y < 66 ? 'm' : 'b';
                        zone += x < 50 ? 'l' : 'r';
                        setF('zoomZone', zone);
                        return;
                      }


                      const availableDet = ['det1', 'det2', 'det3', 'det4', 'det5', 'det6', 'det7', 'det8'].find(d => !formData.photos[d]);
                      if (!availableDet) return showAlert("Máximo de 8 fotos de detalles/daños alcanzado.");

                      setF('pendingPin', { id: availableDet, x, y });
                      setF('zoomZone', null);
                      // Activamos el lápiz (enableAnnotation = true) SÓLO para las fotos de daños
                      openCamera('Detalle del Daño', f => handlePic(f, availableDet), true);
                    }}
                  >
                    {!formData.zoomZone && (
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 pointer-events-none z-40 opacity-40 mix-blend-multiply">
                        <div className="border-r-2 border-b-2 border-dashed border-blue-500 rounded-tl-[40px]"></div>
                        <div className="border-b-2 border-dashed border-blue-500 rounded-tr-[40px]"></div>
                        <div className="border-r-2 border-b-2 border-dashed border-blue-500"></div>
                        <div className="border-b-2 border-dashed border-blue-500"></div>
                        <div className="border-r-2 border-dashed border-blue-500 rounded-bl-[40px]"></div>
                        <div className="border-dashed border-blue-500 rounded-br-[40px]"></div>
                      </div>
                    )}


                    {(!formData.vehicleType || formData.vehicleType === 'auto') && (
                      <div className="w-full h-full relative flex justify-center">
                        {/* Ruedas Delanteras (Neumáticos oscuros) */}
                        <div className="absolute top-[15%] left-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>
                        <div className="absolute top-[15%] right-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>


                        {/* Ruedas Traseras (Neumáticos oscuros) */}
                        <div className="absolute bottom-[12%] left-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>
                        <div className="absolute bottom-[12%] right-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>


                        {/* Espejos Retrovisores Reales (Pequeños y claros) */}
                        <div className="absolute top-[34%] left-[4%] w-2 h-4 bg-slate-400 rounded-l-md shadow-sm z-20"></div>
                        <div className="absolute top-[34%] right-[4%] w-2 h-4 bg-slate-400 rounded-r-md shadow-sm z-20"></div>


                        {/* Chasis principal */}
                        <div className="w-[88%] h-full bg-slate-300 dark:bg-slate-600 rounded-t-[45px] rounded-b-[35px] border-4 border-slate-400 relative flex flex-col p-1 shadow-inner z-10 overflow-hidden">

                          {/* Líneas aerodinámicas del Capó */}
                          <div className="absolute top-[-2%] left-[15%] w-[70%] h-[20%] border-x-2 border-slate-400/40 rounded-t-[30px] pointer-events-none"></div>


                          {/* Habitáculo */}
                          <div className="flex flex-col h-full justify-between pt-[18%] pb-[12%] z-10">
                            {/* Parabrisas Delantero curvo */}
                            <div className="w-[85%] h-[16%] bg-slate-800/40 mx-auto rounded-t-[25px] rounded-b-[4px] shadow-sm border-t-2 border-white dark:border-slate-800/20"></div>


                            {/* Techo y Ventanas Laterales (vidrios oscuros a los lados) */}
                            <div className="flex-1 w-[80%] mx-auto bg-slate-200 dark:bg-slate-700 border-x-4 border-slate-800/40 relative flex flex-col my-1 shadow-sm rounded-sm">
                              {/* Línea divisoria de puertas (Pilar B) */}
                              <div className="w-full h-1/2 border-b-2 border-slate-400/30"></div>
                            </div>


                            {/* Parabrisas Trasero curvo */}
                            <div className="w-[80%] h-[11%] bg-slate-800/40 mx-auto rounded-b-[20px] rounded-t-[4px] shadow-sm border-b-2 border-white dark:border-slate-800/20"></div>
                          </div>


                          {/* Línea del Maletero */}
                          <div className="absolute bottom-1.5 left-[20%] w-[60%] h-4 border-t-2 border-slate-400/60 rounded-t-lg pointer-events-none"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_pequeno' && (
                      <div className="w-full h-full relative flex flex-col items-center z-10">
                        <div className="w-[80%] h-[18%] bg-slate-300 dark:bg-slate-600 rounded-t-[35px] border-x-4 border-t-4 border-slate-400 shadow-inner z-0"></div>
                        <div className="w-[100%] h-[82%] bg-slate-200 dark:bg-slate-700 rounded-t-[15px] rounded-b-[20px] border-4 border-slate-400 shadow-inner flex flex-col p-1.5 z-10 -mt-2">
                          <div className="w-[90%] h-[20%] bg-slate-800/40 mx-auto rounded-t-[15px] rounded-b-sm mb-1.5 shadow-sm"></div>
                          <div className="flex-1 w-[95%] mx-auto bg-slate-300 dark:bg-slate-600 border-2 border-slate-400/30 rounded-md relative flex justify-center overflow-hidden">
                            {/* Eliminamos la línea vertical molesta de acá */}
                            <div className="absolute top-1/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-2/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-3/4 w-full border-t-2 border-slate-400/20"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_grande' && (
                      <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-t-[35px] rounded-b-[10px] border-4 border-slate-400 relative flex flex-col justify-start p-2 shadow-inner z-10">
                        <div className="w-[85%] h-[15%] bg-slate-800/40 mx-auto rounded-t-[20px] rounded-b-sm mt-1"></div>
                        <div className="flex-1 w-[90%] mx-auto bg-slate-300 dark:bg-slate-600 border-2 border-slate-400/30 rounded-sm mt-3 mb-1 flex items-center justify-center relative overflow-hidden shadow-sm">
                          {/* Eliminamos la línea vertical molesta de acá */}
                          <div className="absolute top-1/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-2/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-3/4 w-full border-t border-slate-400/20"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camioneta' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-full h-[55%] bg-slate-300 dark:bg-slate-600 rounded-t-[35px] rounded-b-md border-4 border-slate-400 p-2 flex flex-col justify-between shadow-inner relative overflow-hidden">
                          <div className="w-5/6 h-8 bg-slate-800/30 mx-auto rounded-t-xl rounded-b-sm mt-1 z-10"></div>
                          <div className="flex-1 w-full mx-auto relative flex flex-col justify-center my-1">
                            <div className="w-full border-t-2 border-slate-400/40"></div>
                          </div>
                          <div className="w-5/6 h-4 bg-slate-800/30 mx-auto rounded-b-xl rounded-t-sm mb-0.5 z-10"></div>
                        </div>
                        <div className="w-[90%] h-[43%] mx-auto bg-slate-200 dark:bg-slate-700 border-x-4 border-b-4 border-slate-400 rounded-b-xl mt-1 relative shadow-inner">
                          <div className="absolute inset-1.5 border-2 border-slate-300 dark:border-slate-600/80 rounded-sm"></div>
                          <div className="absolute inset-y-2 left-1/3 border-l-2 border-slate-300 dark:border-slate-600/50"></div>
                          <div className="absolute inset-y-2 right-1/3 border-r-2 border-slate-300 dark:border-slate-600/50"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 dark:border-blue-700/50 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                          <div className="w-full h-1/2 bg-slate-800/40 rounded-t-md rounded-b-sm mb-1"></div>
                        </div>
                        <div className="w-full h-[78%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion_doble' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[32%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 dark:border-blue-700/50 p-1 flex flex-col justify-end gap-1 shadow-inner z-10 relative">
                          <div className="w-full h-[40%] bg-slate-800/40 rounded-t-md"></div>
                          <div className="w-full h-[35%] bg-slate-800/40 rounded-sm mb-0.5"></div>
                        </div>
                        <div className="w-full h-[66%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                        </div>
                      </div>
                    )}
                    {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes' || formData.vehicleType === 'camion_8x4' || formData.vehicleType === 'carro_arrastre') && (
                      <div className="w-full h-full relative flex flex-col items-center">

                        {formData.vehicleType === 'camion_8x4' && (
                          <>
                            <div className="absolute top-[10%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[10%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[22%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[22%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[20%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[20%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[7%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[7%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>

                            <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                              <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                            </div>
                            <div className="w-full h-[78%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}

                        {formData.vehicleType === 'carro_arrastre' && (
                          <div className="w-full h-full relative overflow-hidden flex justify-center items-center">
                            <div className="w-[90%] h-[80%] bg-slate-300 dark:bg-slate-600 rounded-md border-4 border-slate-400 relative overflow-hidden shadow-inner flex justify-center items-center z-10 mt-6">
                              <div className="w-[90%] h-[90%] border-2 border-slate-300 dark:border-slate-600/50 rounded-sm"></div>
                            </div>


                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-10 border-x-4 border-t-4 border-slate-500 rounded-t-full bg-slate-400 z-0"></div>


                            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                              <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                              <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                            </div>


                            <div className="absolute top-[56%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                              <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                              <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                            </div>
                          </div>
                        )}

                        {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes') && (
                          <>
                            <div className="absolute top-[8%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[8%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            {formData.vehicleType === 'camion_2ejes' && (
                              <>
                                <div className="absolute bottom-[17%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[17%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                              </>
                            )}
                            {formData.vehicleType === 'camion_3ejes' && (
                              <>
                                <div className="absolute bottom-[27%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[27%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[16%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[16%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                              </>
                            )}
                            <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                              <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                            </div>
                            <div className="w-full h-[78%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}
                      </div>
                    )}


                    {(formData.detailPins || []).map(pin => (
                      <div key={pin.id} onClick={() => handlePhotoClick(pin.id, 'Detalle del Daño')} className="absolute w-8 h-8 -ml-4 -mt-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 shadow-xl flex items-center justify-center z-50 animate-in zoom-in cursor-pointer" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                        <img src={formData.photos[pin.id]} className="w-full h-full object-cover rounded-full opacity-90" alt="Detalle" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setF('photos', { ...formData.photos, [pin.id]: false }); setF('detailPins', formData.detailPins.filter(p => p.id !== pin.id)); }} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-700 shadow-md"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>


                  <button type="button" onClick={() => handlePhotoClick('front', 'FRENTE')} className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-10 bg-white dark:bg-slate-900 transition-all ${formData.photos.front ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:bg-blue-900/30'}`}>
                    {formData.photos.front ? <><img src={formData.photos.front} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50" /><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white dark:bg-slate-900 rounded-full" /></> : <><Camera className="w-5 h-5 text-blue-500 mb-1" /><span className="text-[9px] font-black text-slate-500 dark:text-slate-400 tracking-wide">FRENTE</span></>}
                  </button>


                  <button type="button" onClick={() => handlePhotoClick('back', 'ATRÁS')} className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-10 bg-white dark:bg-slate-900 transition-all ${formData.photos.back ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:bg-blue-900/30'}`}>
                    {formData.photos.back ? <><img src={formData.photos.back} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50" /><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white dark:bg-slate-900 rounded-full" /></> : <><Camera className="w-5 h-5 text-blue-500 mb-1" /><span className="text-[9px] font-black text-slate-500 dark:text-slate-400 tracking-wide">ATRÁS</span></>}
                  </button>


                  <button type="button" onClick={() => handlePhotoClick('left', 'LATERAL PILOTO')} className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-10 bg-white dark:bg-slate-900 transition-all ${formData.photos.left ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:bg-blue-900/30'}`}>
                    {formData.photos.left ? <><img src={formData.photos.left} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50" /><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white dark:bg-slate-900 rounded-full" /></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5" /><span className="text-[8px] font-black text-slate-500 dark:text-slate-400 text-center leading-tight">LATERAL<br />PILOTO</span></>}
                  </button>


                  <button type="button" onClick={() => handlePhotoClick('right', 'LATERAL COPILOTO')} className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-10 bg-white dark:bg-slate-900 transition-all ${formData.photos.right ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:bg-blue-900/30'}`}>
                    {formData.photos.right ? <><img src={formData.photos.right} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50" /><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white dark:bg-slate-900 rounded-full" /></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5" /><span className="text-[8px] font-black text-slate-500 dark:text-slate-400 text-center leading-tight">LATERAL<br />COPILOTO</span></>}
                  </button>
                </div>


                <div className="grid grid-cols-2 gap-3 mt-6 border-t-2 border-slate-100 dark:border-slate-800 pt-4">
                  {(() => {
                    const extraPhotos = [{ id: 'dashboard', l: 'Tablero' }, { id: 'tire', l: 'Repuesto' }, { id: 'interior_front', l: 'Int. Adelante' }, { id: 'interior_back', l: 'Int. Atrás' }];
                    if (formData.client && formData.client.toLowerCase().includes('kovacs')) {
                       extraPhotos.unshift({ id: 'vin', l: 'Número VIN (Oblig.)' });
                    }
                    return extraPhotos.map(p => (
                      <button type="button" key={p.id} onClick={() => handlePhotoClick(p.id, p.l)} className={`w-full h-12 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all ${formData.photos[p.id] ? 'border-green-400 ring-2 ring-green-100' : (p.id === 'vin' ? 'border-dashed border-red-300 dark:border-red-700/50 hover:bg-red-50 dark:hover:bg-red-900/30' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:bg-slate-900')}`}>
                        {formData.photos[p.id] ? <><img src={formData.photos[p.id]} className="absolute inset-0 w-full h-full object-cover opacity-30" /><CheckCircle className="w-5 h-5 text-green-500 relative z-10 bg-white dark:bg-slate-900 rounded-full" /><span className="text-[10px] font-black text-green-800 dark:text-green-300 relative z-10">{p.l}</span></> : <><Camera className={`w-4 h-4 ${p.id === 'vin' ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} /><span className={`text-[10px] font-black uppercase ${p.id === 'vin' ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{p.l}</span></>}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}


          {job.tripType !== 'simple' && step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Combustible a Bordo</h3>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-sm relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${formData.fuelLevel < 30 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-slate-50 dark:bg-slate-900'}`}>
                      <Fuel className={`w-6 h-6 ${formData.fuelLevel < 30 ? 'text-red-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estanque</p>
                      <p className={`text-2xl font-black leading-none transition-colors ${formData.fuelLevel < 30 ? 'text-red-600 dark:text-red-400' : formData.fuelLevel <= 50 ? 'text-amber-500' : 'text-green-600 dark:text-green-400'}`}>
                        {formData.fuelLevel}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors ${formData.fuelLevel == 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : formData.fuelLevel <= 25 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : formData.fuelLevel <= 50 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : formData.fuelLevel <= 75 ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'}`}>
                      {formData.fuelLevel == 0 ? 'Vacío' : formData.fuelLevel <= 25 ? 'Reserva' : formData.fuelLevel <= 50 ? 'Medio' : formData.fuelLevel <= 75 ? '3/4' : 'Lleno'}
                    </span>
                  </div>
                </div>


                <div className="relative pt-2 pb-2">
                  <div className="flex justify-between text-[11px] font-black px-1 mb-2">
                    <span className="text-red-500">E</span>
                    <span className="text-slate-300">1/4</span>
                    <span className="text-slate-300">1/2</span>
                    <span className="text-slate-300">3/4</span>
                    <span className="text-green-500">F</span>
                  </div>

                  <div className="relative h-10 w-full group">
                    <input
                      type="range"
                      min="0" max="100" step="5"
                      value={formData.fuelLevel}
                      onChange={(e) => setF('fuelLevel', Number(e.target.value))}
                      className="absolute z-20 w-full h-full opacity-0 cursor-pointer inset-0 m-0"
                    />

                    <div className="absolute inset-y-2 inset-x-0 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700 pointer-events-none">
                      <div className="absolute inset-0 flex justify-between px-[25%] z-10">
                        <div className="w-0.5 h-full bg-white dark:bg-slate-900"></div>
                        <div className="w-0.5 h-full bg-white dark:bg-slate-900"></div>
                        <div className="w-0.5 h-full bg-white dark:bg-slate-900"></div>
                      </div>

                      <div
                        className={`h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 relative ${formData.fuelLevel < 30
                          ? 'bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_10px,#dc2626_10px,#dc2626_20px)]'
                          : formData.fuelLevel <= 50
                            ? 'bg-amber-400'
                            : 'bg-green-500'
                          }`}
                        style={{ width: `${formData.fuelLevel}%` }}
                      >
                        <div className="w-1.5 h-3 bg-white dark:bg-slate-900 rounded-full relative z-20"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              <h3 className="text-sm font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2 mt-6 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Viáticos y Esperas</h3>

              <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg text-blue-600 dark:text-blue-400"><Wallet className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase leading-none">Fondo Asignado</p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">{getVehicleIdentifierLabel(job.plate || job.vin)}</p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-blue-700 dark:text-blue-400">
                  {formatMoney((expenses || []).filter(g => g.jobId === job.id && g.type === 'assignment').reduce((acc, curr) => acc + Number(curr.amount || 0), 0))}
                </p>
              </div>



              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 select-none shadow-sm ${(job.tripType === 'revision' && formData.prtArrivalTime) || job.waitTimeMinutes >= 1 ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400'}`}>
                  <Clock className="w-5 h-5" />
                  {job.tripType === 'revision' && formData.prtArrivalTime ? (
                    <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">
                      Trámite PRT:<br />{Math.floor(((formData.prtFinishTime || Date.now()) - formData.prtArrivalTime) / 60000)} min
                    </span>
                  ) : (
                    <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Espera: {job.waitTimeMinutes || 0} min</span>
                  )}
                </div>


                <button type="button" onClick={() => setF('hasFuelCharge', !formData.hasFuelCharge)} className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all select-none shadow-sm ${formData.hasFuelCharge ? 'border-blue-500 bg-blue-500 text-white shadow-blue-100' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400'}`}>
                  {formData.hasFuelCharge ? <CheckCircle className="w-5 h-5 animate-in zoom-in" /> : <Fuel className="w-5 h-5" />}
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Carga Combust.</span>
                </button>
              </div>


              {formData.hasFuelCharge && (
                <div className="animate-in fade-in slide-in-from-top-2 border rounded-xl p-3 bg-slate-50 dark:bg-slate-900 shadow-inner max-w-sm mx-auto">
                  <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider text-center mb-1">Monto Rendición Gasolinera ($)</p>
                  <input type="number" placeholder="Ej: 15000" value={formData.fuelChargeAmount || ''} onChange={(e) => setF('fuelChargeAmount', e.target.value)} className="w-full bg-white dark:bg-slate-900 border p-2 rounded-xl text-center text-sm font-bold outline-none" />
                </div>
              )}

              {job.tripType === 'revision' && (job.rtData?.revision || job.rtData?.inspeccion || job.rtData?.frenos || job.rtData?.gases) && (
                <div className="animate-in fade-in slide-in-from-top-2 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm space-y-3 mt-4">
                  <h3 className="text-xs font-extrabold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-4 h-4" /> Valores pagados en Planta (PRT)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.rtData?.revision && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Revisión Técnica ($)</label>
                        <input type="number" placeholder="Ej: 20000" className="w-full border-2 border-indigo-100 dark:border-indigo-800/50 p-2 rounded-xl font-bold text-sm bg-white dark:bg-slate-900 outline-none" value={formData.prtCostRevision || ''} onChange={e => setF('prtCostRevision', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.inspeccion && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Inspección Ocular / Visual ($)</label>
                        <input type="number" placeholder="Ej: 5000" className="w-full border-2 border-indigo-100 dark:border-indigo-800/50 p-2 rounded-xl font-bold text-sm bg-white dark:bg-slate-900 outline-none" value={formData.prtCostInspeccion || ''} onChange={e => setF('prtCostInspeccion', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.frenos && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Certificado Frenos ($)</label>
                        <input type="number" placeholder="Ej: 8000" className="w-full border-2 border-indigo-100 dark:border-indigo-800/50 p-2 rounded-xl font-bold text-sm bg-white dark:bg-slate-900 outline-none" value={formData.prtCostFrenos || ''} onChange={e => setF('prtCostFrenos', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.gases && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Certificado Gases ($)</label>
                        <input type="number" placeholder="Ej: 6000" className="w-full border-2 border-indigo-100 dark:border-indigo-800/50 p-2 rounded-xl font-bold text-sm bg-white dark:bg-slate-900 outline-none" value={formData.prtCostGases || ''} onChange={e => setF('prtCostGases', e.target.value)} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


          {((job.tripType !== 'simple' && step === 6) || (job.tripType === 'simple' && step === 3)) && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-slate-200 uppercase tracking-wider">Cierre y Conformidad</h3>

              <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-2xl border-slate-900 border-2 cursor-pointer shadow-md transition-colors hover:bg-slate-700">
                <input type="checkbox" checked={formData.noReception} onChange={e => setF('noReception', e.target.checked)} className="w-6 h-6 cursor-pointer accent-blue-500 rounded" />
                <span className="font-extrabold text-sm text-white">Dejar sin firma (Local cerrado / PRT)</span>
              </label>

              {!formData.noReception && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800/50 rounded-2xl p-4">
                  <h3 className="font-extrabold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2"><Zap className="w-5 h-5" /> Firma Remota o QR</h3>
                  <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-3">Envía el link al cliente o muéstrale el QR para que firme desde su celular.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleRemoteSignRequest} disabled={processingAction === 'wapp'} className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                      {processingAction === 'wapp' ? <Clock className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} {processingAction === 'wapp' ? 'Cargando...' : 'Compartir Link'}
                    </button>
                    <button type="button" onClick={handleOpenQR} disabled={processingAction === 'qr'} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                      {processingAction === 'qr' ? <Clock className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} {processingAction === 'qr' ? 'QR' : 'Mostrar QR'}
                    </button>
                  </div>
                </div>
              )}


              {!formData.noReception && (
                <div className="space-y-3">

                  <div className="flex items-center gap-2 my-2"><div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div><span className="text-[10px] font-bold text-slate-400 uppercase">Firma en pantalla</span><div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div></div>

                  <input required={!formData.noReception} value={formData.receiverName} onChange={e => setF('receiverName', e.target.value)} placeholder="Nombre del receptor" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-sm" />
                  <input value={formData.receiverRut} onChange={(e) => { let val = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase(); if (val.length > 1) { const dv = val.slice(-1); const body = val.slice(0, -1); val = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv; } setF('receiverRut', val); }} placeholder="RUT Receptor (Opcional)" maxLength="12" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-sm" />

                  {formData.clientComments && (
                    <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border">
                      <p className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Comentarios del Receptor:</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 italic">"{formData.clientComments}"</p>
                    </div>
                  )}


                  <div className="relative mt-1">
                    {formData.signatureData && <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 z-10"><CheckCircle className="w-3 h-3" /> CAPTURADA</div>}
                    <SignaturePad initialData={formData.signatureData} onSave={d => setF('signatureData', d)} onClear={() => setF('signatureData', null)} />
                  </div>
                </div>
              )}
            </div>
          )}


          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold px-4 py-3 rounded-xl text-sm w-1/3 active:scale-[0.97] transition-all duration-200">
                Atrás
              </button>
            )}

            {step < (job.tripType === 'simple' ? 3 : 6) ? (
              <button type="button" onClick={() => setStep(step + 1)} className={`group flex-1 text-white font-extrabold py-3 rounded-xl text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-200 flex justify-center items-center gap-2 relative overflow-hidden ${job.tripType === 'simple' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <span className="relative z-10">Siguiente Paso</span>
                <span className="relative z-10 transform group-hover:translate-x-1.5 transition-transform duration-300">➔</span>
                <div className="absolute inset-0 h-full w-full translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-in-out"></div>
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="group flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 transition-all duration-200 flex justify-center items-center gap-2">
                {isSubmitting ? <><Clock className="w-4 h-4 animate-spin" /> Guardando GPS y Acta...</> : <><span className="group-hover:animate-bounce">🏁</span> Finalizar y Guardar</>}
              </button>
            )}
          </div>


        </form>
      </div>
      {/* BOTÓN FLOTANTE DEL ASISTENTE DE VOZ */}
      <button
        type="button"
        onClick={toggleVoiceAssistant}
        disabled={isInterpreting}
        className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border-2 border-white/20 ${
          isListening 
            ? 'bg-red-500 animate-pulse scale-110 shadow-red-500/50' 
            : isInterpreting 
              ? 'bg-amber-500 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95'
        }`}
      >
        {isListening ? (
          <Mic className="w-6 h-6 text-white animate-bounce" />
        ) : isInterpreting ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
      </button>

      {/* MODAL DE TRANSCRIPCIÓN EN VIVO */}
      {(isListening || isInterpreting || liveTranscript) && (
        <div className="fixed bottom-40 right-4 z-50 bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border-2 border-indigo-500 shadow-2xl max-w-xs animate-in slide-in-from-bottom-2">
          <p className="text-white font-bold text-sm italic">
            {liveTranscript ? `"${liveTranscript}"` : 'Escuchando...'}
          </p>
          {isInterpreting && (
            <p className="text-xs text-indigo-300 mt-2 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin"/> Procesando con IA...
            </p>
          )}
        </div>
      )}

      {uploadProgress.active && (
        <div className="fixed bottom-[88px] left-1/2 transform -translate-x-1/2 z-[60] w-[92%] max-w-sm animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-3xl shadow-2xl border-2 border-slate-700 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <div className="relative">
                  <CloudOff className="w-5 h-5 text-blue-400 animate-pulse" />
                </div>
                Sincronizando
              </span>
              <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                {uploadProgress.current} / {uploadProgress.total}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner border border-slate-900">
              <div className="bg-blue-500 h-full transition-all duration-300 relative" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}>
                <div className="absolute inset-0 bg-white dark:bg-slate-900 w-full h-full animate-[pulse_1s_ease-in-out_infinite]"></div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold truncate leading-none">{uploadProgress.text}</p>
          </div>
        </div>
      )}
      {/* --- CÁMARA INTERNA CENTRALIZADA --- */}
      <InAppCamera
        isOpen={cameraConfig.isOpen}
        title={cameraConfig.title}
        enableAnnotation={cameraConfig.enableAnnotation}
        onClose={() => setCameraConfig(prev => ({ ...prev, isOpen: false }))}
        onCapture={cameraConfig.onCapture}
      />


      {/* MODAL DEL DÉJÀ VU PERICIAL */}


      {/* MODAL DEL DÉJÀ VU PERICIAL */}
      {showDejaVuModal && dejaVuData && (
        <div className="fixed inset-0 bg-slate-900/80 z-[9998] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDejaVuModal(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="bg-purple-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-black flex items-center gap-2"><Search className="w-5 h-5" /> Memoria Histórica</h3>
              <button onClick={() => setShowDejaVuModal(false)} className="bg-white dark:bg-slate-900 p-1.5 rounded-full text-white hover:bg-white dark:bg-slate-900 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Último Conductor:</p>
                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{dejaVuData.assignedDriverName || dejaVuData.acceptedByEmail}</p>
              </div>


              {dejaVuData.checklist.observations && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 p-3 rounded-xl">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase mb-1">Observaciones Anteriores:</p>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-300 italic">"{dejaVuData.checklist.observations}"</p>
                </div>
              )}

              {dejaVuData.checklist.detailPins && dejaVuData.checklist.detailPins.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Fotos de Daños Registrados:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {dejaVuData.checklist.detailPins.map(pin => (
                      dejaVuData.checklist.photos[pin.id] && (
                        <img
                          key={pin.id}
                          src={dejaVuData.checklist.photos[pin.id]}
                          className="w-full h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                          alt="Daño anterior"
                          onClick={() => { setShowDejaVuModal(false); setFullScreenImage({ url: dejaVuData.checklist.photos[pin.id] }); }}
                        />
                      )
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={() => setShowDejaVuModal(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl transition-colors text-xs uppercase tracking-widest mt-2">
                Entendido, Volver al Checklist
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL DEL CÓDIGO QR */}
      {qrOpen && (
        <div className="fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setQrOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6 flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#ffffff' }} onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4 shadow-sm border border-indigo-200 dark:border-indigo-800/50">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black mb-1" style={{ color: '#1e293b' }}>Firma Remota</h3>
            <p className="text-xs font-bold mb-6" style={{ color: '#64748b' }}>Pide al cliente que escanee este código con la cámara de su celular para firmar el acta.</p>

            <div className="p-3 rounded-2xl shadow-inner border-2 border-slate-100 dark:border-slate-800 mb-6" style={{ backgroundColor: '#ffffff' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&bgcolor=ffffff&data=${encodeURIComponent(`${window.location.origin}/?sign=${job.id}`)}`}
                alt="Código QR"
                className="w-48 h-48 object-contain"
                style={{ backgroundColor: '#ffffff' }}
              />
            </div>

            <button type="button" onClick={() => setQrOpen(false)} className="w-full py-3.5 hover:bg-slate-200 dark:bg-slate-700 font-black rounded-xl transition-colors text-xs uppercase tracking-widest shadow-sm border border-slate-200 dark:border-slate-700" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
              Cerrar QR
            </button>
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 bg-white dark:bg-slate-900 hover:bg-white dark:bg-slate-900 p-2 rounded-full text-white transition-colors shadow-lg z-10">
            <X className="w-6 h-6" />
          </button>
          <img src={fullScreenImage.url || fullScreenImage} alt="Evidencia Ampliada" className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl mb-6" onClick={(e) => e.stopPropagation()} />

          {fullScreenImage.id && fullScreenImage.label && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFullScreenImage(null);
                // Si la foto que están retomando es un daño, reactivamos el lápiz
                openCamera(fullScreenImage.label, f => handlePic(f, fullScreenImage.id), fullScreenImage.label === 'Detalle del Daño');
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-2 active:scale-95 transition-all"
            >
              <Camera className="w-5 h-5" /> Tomar Nuevamente
            </button>
          )}
        </div>
      )}


    </div>
  );
}





















