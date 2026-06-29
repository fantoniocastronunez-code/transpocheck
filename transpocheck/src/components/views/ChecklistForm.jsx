import React, { useState, useEffect } from 'react';
import { updateDoc, doc, setDoc, addDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { 
  FileText, MapPin, CheckCircle, CloudOff, AlertCircle, Eye, 
  Trash2, Camera, Search, X, Fuel, Clock, Wallet, Receipt, 
  Zap, Share2, QrCode, Save 
} from 'lucide-react';
import SignaturePad from '../ui/SignaturePad';
import { resizeImage, formatMoney } from '../../utils/helpers';

export default function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm, allClientsList, drivers, expenses, vehicles, uploadImageToStorage }) {
  const isQuick = job.id === 'NEW_QUICK_JOB'; 
  const localStorageKey = `checklist_draft_${job.id}`;
  const matchedVehicle = vehicles?.find(v => v.plate === (job.plate || job.vin)?.toUpperCase());
  const initialDocs = matchedVehicle?.docs || { soap:false, permiso:false, revTecnica:false, gases:false };
  const initialDocsExpiry = matchedVehicle?.docsExpiry || {};
  const initialReminders = matchedVehicle?.internalReminders || []; 


  const defaultData = {
    client: job.client||'', manualClient: '', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', vehicleType: job.vehicleType||'auto', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false, tire:false, dashboard:false, det1:false, det2:false, det3:false, det4:false }, 
    docs: job.checklist?.docs || initialDocs, 
    docsExpiry: job.checklist?.docsExpiry || initialDocsExpiry, 
    internalReminders: job.checklist?.internalReminders || initialReminders, 
    observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null,
    rtStatus: job.prt_result ? job.prt_result : 'aprobado', 
    rtRejectReason: job.prt_reason ? job.prt_reason : '', 
    rtReturnOption: 'origin', rtReturnDestination: '' 
  };
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(defaultData);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false); 
  const [fullScreenImage, setFullScreenImage] = useState(null); 
  const [uploadProgress, setUploadProgress] = useState({ active: false, current: 0, total: 0, text: '' }); 
  
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
            .map(d => ({id: d.id, ...d.data()}))
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
      } catch(e) {
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
          setFormData(data.draft.formData);
          setStep(data.draft.step || 1);
          setIsDraftLoaded(true);
        }
        isFirstLoad = false;
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
      for (const key in draftData.photos) {
         if (draftData.photos[key] && !draftData.photos[key].startsWith('http')) {
             draftData.photos[key] = false; 
         }
      }
      if (draftData.signatureData && !draftData.signatureData.startsWith('http')) {
         draftData.signatureData = null;
      }

      updateDoc(doc(db, 'transport_jobs', job.id), { draft: { step, formData: draftData } }).catch(() => {});
    }, 2000); 
    return () => clearTimeout(timer);
  }, [step, formData, job.id, isQuick, db]);

  const [processingAction, setProcessingAction] = useState(null);

  const syncFilesToStorage = async (currentData) => {
    const d = { ...currentData };
    const uploadPromises = [];
    const uploadedPhotos = {};
    const jobIdFolder = job.id === 'NEW_QUICK_JOB' ? `quick_${Date.now()}` : job.id;

    let totalFiles = 0;
    for (const val of Object.values(d.photos)) { if (val && val.startsWith('data:image')) totalFiles++; }
    if (d.signatureData && d.signatureData.startsWith('data:image')) totalFiles++;

    if (totalFiles > 0) {
       setUploadProgress({ active: true, current: 0, total: totalFiles, text: 'Conectando con el servidor...' });
    }

    let completed = 0;
    const updateProgress = (fileName) => {
       completed++;
       setUploadProgress(prev => ({ ...prev, current: completed, text: `Sincronizando ${fileName}...` }));
    };

    for (const [key, val] of Object.entries(d.photos)) {
      if (val && val.startsWith('data:image')) {
        const p = uploadImageToStorage(val, `checklists/${jobIdFolder}`, `photo_${key}_${Date.now()}.jpg`)
          .then(url => { uploadedPhotos[key] = url; updateProgress(`foto ${key.toUpperCase()}`); return url; });
        uploadPromises.push(p);
      } else {
        uploadedPhotos[key] = val;
      }
    }

    if (d.signatureData && d.signatureData.startsWith('data:image')) {
       const p = uploadImageToStorage(d.signatureData, `checklists/${jobIdFolder}`, `signature_${Date.now()}.jpg`)
         .then(url => { d.signatureData = url; updateProgress('Firma de conformidad'); return url; });
       uploadPromises.push(p);
    }

    await Promise.all(uploadPromises);
    d.photos = uploadedPhotos;
    
    if (totalFiles > 0) {
      setUploadProgress({ active: true, current: totalFiles, total: totalFiles, text: '¡Sincronización exitosa!' });
      setTimeout(() => setUploadProgress({ active: false, current: 0, total: 0, text: '' }), 1500);
    }
    
    return d;
  };
  const handleRemoteSignRequest = async () => {
    if (isQuick) return showAlert("⚠️ Para usar la Firma Remota en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    setProcessingAction('wapp');
    try {
      const syncedData = await syncFilesToStorage(formData);
      setFormData(syncedData); 

      const url = `${window.location.href.split('?')[0]}?sign=${job.id}`;
      const textToShare = `¡Hola! Por favor firma el acta de recepción y revisa las fotografías del vehículo aquí:\n${url}`;

      const textArea = document.createElement("textarea");
      textArea.value = textToShare;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);

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

  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  const handleReminderChange = (index, field, value) => {
    const newRems = [...(formData.internalReminders || [])];
    newRems[index][field] = value;
    setF('internalReminders', newRems);
  };
  const addReminder = () => setF('internalReminders', [...(formData.internalReminders || []), { id: Date.now().toString(), text: '', photo: null, resolved: false }]);
  const removeReminder = (index) => {
    const newRems = [...(formData.internalReminders || [])];
    newRems.splice(index, 1);
    setF('internalReminders', newRems);
  };

  const clearDraft = () => {
    showConfirm("¿Eliminar borrador y empezar de nuevo?", async () => {
      if (!isQuick) await updateDoc(doc(db, 'transport_jobs', job.id), { draft: null });
      setFormData(defaultData);
      setStep(1);
      setIsDraftLoaded(false);
    });
  };

  const handlePic = async (e, id) => {
  const f = e.target.files[0]; 
  if (!f) return;
  try {
    const dataUrl = await resizeImage(f, 720, 0.6); 
    
    // PASO 1: Mostrar preview inmediato con Base64
    setFormData(prev => {
      const newData = { ...prev, photos: { ...prev.photos, [id]: dataUrl } };
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

  } catch(err) { 
    console.error("Error al procesar la foto:", err);
    showAlert("Error al procesar la foto. Intenta con una imagen más pequeña."); 
  }
};

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    setIsSubmitting(true);
    
    let d = {...formData}; 
    d.client = d.client === 'OTRO' ? d.manualClient : d.client; 

    if(d.noReception) { 
      d.receiverName="ENTREGA SIN RECEPCIÓN"; 
      d.receiverRut="N/A"; 
    }

    try {
      d = await syncFilesToStorage(d);
    } catch (uploadError) {
      console.error("Error subiendo imágenes:", uploadError);
      showAlert("Hubo un error subiendo las imágenes a la nube. Verifica tu internet.");
      setIsSubmitting(false);
      return;
    }

    const getGPS = () => new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => resolve(null), 
        { timeout: 6000, enableHighAccuracy: true } 
      );
    });

    if (!d.location) {
      const coords = await getGPS();
      if (coords) d.location = coords;
    }
    
    const fd = { scheduledDate: new Date().toISOString().split('T')[0], client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType || 'traslado' };
    
    try {
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

      if (totalToDeduct > 0) {
        const currentDriver = drivers?.find(drv => drv.email === currentUserEmail);
        const isAdminUser = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(currentUserEmail);

        if (currentDriver) {
          const currentBalance = currentDriver.balance || 0;
          
          if (!isAdminUser && totalToDeduct > currentBalance) {
              return showAlert(`No puedes enviar el checklist. Intentas rendir ${formatMoney(totalToDeduct)} en gastos, pero tu fondo actual es de solo ${formatMoney(currentBalance)}. Pide a la central que te asigne más dinero e intenta de nuevo.`);
          }

          const newBalance = currentBalance - totalToDeduct;

          await updateDoc(doc(db, 'drivers', currentDriver.id), { balance: newBalance });

          for (const exp of expensesToRegister) {
            await addDoc(collection(db, 'expenses'), {
              driverId: currentDriver.id,
              driverEmail: currentDriver.email,
              driverName: currentDriver.name,
              type: 'expense',
              amount: exp.amount,
              detail: exp.detail,
              jobId: job.id === 'NEW_QUICK_JOB' ? '' : job.id,
              deductedAmount: exp.amount,
              createdAt: Date.now()
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
              const vehDocId = querySnapshot.docs[0].id;
              await updateDoc(doc(db, 'vehicles', vehDocId), {
                  docs: d.docs,
                  docsExpiry: d.docsExpiry || {},
                  internalReminders: activeReminders
              });
          } else {
              await addDoc(vehRef, { 
                  plate: plateUpper, brand: d.brand, model: d.model, client: d.client, 
                  docs: d.docs, docsExpiry: d.docsExpiry || {}, 
                  internalReminders: activeReminders,
                  createdAt: Date.now() 
              });
          }
      }

      if(isQuick) { 
          fd.assignedDriverName="Auto-creado"; fd.acceptedByEmail=currentUserEmail; 
          await addDoc(collection(db,'transport_jobs'), fd); 
      }
      else { 
          if (job.tripType === 'revision' && d.rtStatus === 'rechazado') {
             fd.status = 'failed';
             fd.failedReason = d.rtRejectReason || 'Revisión Técnica Rechazada';
             
             const cloneJob = {
                scheduledDate: d.scheduledDate || null, client: d.client || '', brand: d.brand || '', model: d.model || '', vin: d.plateOrVin || '', plate: d.plateOrVin || '', origin: d.origin || '', destination: d.destination || '',
                tripType: job.tripType || 'traslado', rtData: job.rtData || null,
                assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [],
                status: 'pending', createdAt: Date.now(), checklist: null
             };
             await addDoc(collection(db, 'transport_jobs'), cloneJob);
          }
          await updateDoc(doc(db,'transport_jobs',job.id), fd); 
      }
      
      if (job.tripType === 'revision' && d.rtStatus === 'rechazado') {
          showAlert("Revisión guardada como RECHAZADA. Se ha creado un nuevo traslado pendiente.");
      } else {
          showAlert("✅ Checklist guardado correctamente."); 
      }
      onComplete();
    } catch(error) { 
      console.error("Firebase Error:", error);
      showAlert(`Error de base de datos: ${error.message}`); 
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border pb-10 relative">
      {isDraftLoaded && (
         <div className="absolute -top-12 left-0 right-0 flex justify-center items-center">
            <div className="bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-sm border border-amber-200">
               <Save className="w-3.5 h-3.5"/> Borrador recuperado
               <button onClick={clearDraft} className="ml-2 text-amber-600 underline">Limpiar</button>
            </div>
         </div>
      )}

      <div className="bg-blue-600 text-white p-5 flex justify-between items-center rounded-t-3xl"><h2 className="font-bold text-base"><FileText className="inline w-5 h-5 mr-1"/> Formulario Checklist</h2><button type="button" onClick={()=>showConfirm("¿Deseas salir? (Tu progreso quedará guardado localmente)", onCancel)} className="bg-blue-800 px-3 py-1 rounded-xl text-xs font-bold">Salir</button></div>
      
      <div className="sticky top-[64px] sm:top-[80px] z-10 bg-white/90 backdrop-blur-md border-b border-slate-200 px-5 py-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]">
         <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso del Acta</span>
            <span className="text-xs font-black text-blue-600">
               {(() => {
                 let p = 0;
                 if (formData.brand && formData.model && formData.plateOrVin) p += 25;
                 if (formData.fuelLevel !== undefined) p += 25;
                 if (Object.values(formData.photos).filter(v => v).length >= 2) p += 25;
                 if (formData.signatureData || formData.noReception) p += 25;
                 return p;
               })()}%
            </span>
         </div>
         <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full transition-all duration-500 ease-out" style={{width: `${
                 (formData.brand ? 25 : 0) + (formData.fuelLevel !== undefined ? 25 : 0) + (Object.values(formData.photos).filter(v => v).length >= 2 ? 25 : 0) + (formData.signatureData || formData.noReception ? 25 : 0)
            }%`}}></div>
         </div>
      </div>

      <div className="p-5">
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-5 border-b border-slate-100 scrollbar-none">
          {[
            { id: 1, label: '📋 Datos' },
            { id: 2, label: '📄 Docs' },
            { id: 3, label: '💬 Notas' },
            { id: 4, label: '📸 Fotos' },
            { id: 5, label: '⛽ Comb. & Espera' },
            { id: 6, label: '✍️ Entrega' }
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setStep(t.id)} className={`px-3 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all shrink-0 ${step === t.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5 text-sm">
          
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {isQuick ? (
                <div className="space-y-2">
                   <select value={formData.client} onChange={(e) => setF('client', e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 bg-white outline-none focus:border-blue-500">
                      <option value="">Selecciona el Cliente...</option>
                      {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="OTRO">Otro (Ingreso Manual)</option>
                   </select>
                   {formData.client === 'OTRO' && <input value={formData.manualClient} onChange={e=>setF('manualClient',e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 mt-2"/>}
                </div>
              ) : (
                <input value={formData.client} onChange={e=>setF('client',e.target.value)} placeholder="Cliente" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 bg-slate-50" readOnly/>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
                <input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
              </div>
              <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente o VIN" className="w-full border-2 border-slate-300 bg-slate-100 p-3 rounded-xl font-black uppercase text-slate-800 shadow-inner mt-2"/>
              
              {/* ALERTA DÉJÀ VU PERICIAL */}
              {dejaVuData && (
                <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-2xl shadow-sm animate-in zoom-in-95 flex items-start gap-3 mt-4 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                   <div className="bg-purple-200 p-2 rounded-full text-purple-700 animate-pulse shrink-0">
                      <Search className="w-5 h-5"/>
                   </div>
                   <div className="flex-1">
                      <h4 className="text-xs font-black text-purple-800 uppercase tracking-widest mb-1">Déjà Vu Pericial</h4>
                      <p className="text-[11px] font-bold text-purple-600 leading-tight mb-3">
                        Hay registros de daños previos en este vehículo (Traslado del {new Date(dejaVuData.completedAt).toLocaleDateString()}).
                      </p>
                      <button type="button" onClick={() => setShowDejaVuModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase transition-colors shadow-sm w-full">
                         Ver Daños Anteriores
                      </button>
                   </div>
                </div>
              )}

              {job.tripType === 'revision' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 mt-4">
                  <h3 className="text-sm font-extrabold text-blue-600 uppercase tracking-wider">Resultado de la Revisión</h3>
                  <select value={formData.rtStatus} onChange={e=>setF('rtStatus', e.target.value)} className={`w-full border-2 p-3.5 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <option value="aprobado">✅ APROBADO</option>
                    <option value="rechazado">❌ RECHAZADO</option>
                  </select>
                  {formData.rtStatus === 'rechazado' && (
                    <input value={formData.rtRejectReason} onChange={e=>setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required={formData.rtStatus === 'rechazado'} className="w-full border-2 border-red-300 p-3 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2" />
                  )}
                  {formData.rtStatus === 'aprobado' && (
                    <div className="mt-2 p-3 border border-green-200 bg-white rounded-xl space-y-2">
                      <p className="text-xs font-bold text-green-800">¿Hacia dónde se dirige el vehículo tras aprobar?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                          Volver al Origen
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                          Otro Destino
                        </label>
                      </div>
                      {formData.rtReturnOption === 'other' && (
                        <input value={formData.rtReturnDestination} onChange={e=>setF('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required={formData.rtReturnOption === 'other'} className="w-full border-2 border-green-300 p-2.5 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Documentos del Vehículo</h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[{ id: 'soap', label: 'SOAP', icon: <FileText className="w-5 h-5"/> }, { id: 'permiso', label: 'Permiso Circ.', icon: <MapPin className="w-5 h-5"/> }, { id: 'revTecnica', label: 'Rev. Técnica', icon: <CheckCircle className="w-5 h-5"/> }, { id: 'gases', label: 'Gases', icon: <CloudOff className="w-5 h-5"/> }].map(doc => (
                  <div key={doc.id} className="flex flex-col gap-2">
                    <button 
                      type="button" 
                      onClick={() => setF('docs', { ...formData.docs, [doc.id]: !formData.docs[doc.id] })} 
                      className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all duration-200 select-none shadow-sm ${formData.docs[doc.id] ? 'border-green-500 bg-green-500 text-white shadow-green-200' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:border-slate-300'}`}
                    >
                      {formData.docs[doc.id] ? <CheckCircle className="w-6 h-6 animate-in zoom-in"/> : doc.icon}
                      <span className="font-black text-xs uppercase tracking-wider">{doc.label}</span>
                    </button>
                    {formData.docs[doc.id] && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-green-50 border border-green-200 p-2 rounded-xl flex flex-col gap-1 shadow-inner">
                          <p className="text-[9px] font-extrabold text-green-700 uppercase tracking-widest text-center">Vencimiento</p>
                          <input type="date" value={formData.docsExpiry?.[doc.id] || ''} onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} className="w-full bg-white border border-green-200 p-1.5 rounded-lg text-xs font-black text-slate-700 outline-none focus:border-green-500 text-center" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Observaciones Generales</h3>
              <textarea className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[90px]" placeholder="Escribe aquí si hay algún daño, rayón o comentario del estado visual del vehículo..." value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />

              <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 mt-4 shadow-sm">
                  <h3 className="text-sm font-extrabold text-amber-800 mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Alertas Internas de Patente</h3>
                  <p className="text-[10px] font-bold text-amber-700 mb-4 leading-tight">Avisos privados que no salen en el PDF. Sirven como historial para el próximo traslado.</p>
                  
                  {(formData.internalReminders || []).map((rem, idx) => (
                      <div key={rem.id} className={`p-3 rounded-xl border-2 mb-3 bg-white transition-all ${rem.resolved ? 'border-green-300 opacity-60 grayscale-[50%]' : 'border-amber-300 shadow-sm'}`}>
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aviso #{idx + 1}</span>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200 transition-colors">
                                  <input type="checkbox" className="w-4 h-4 accent-green-600 rounded cursor-pointer" checked={rem.resolved} onChange={e => handleReminderChange(idx, 'resolved', e.target.checked)}/>
                                  Solucionado
                              </label>
                          </div>
                          <textarea disabled={rem.resolved} value={rem.text} onChange={e => handleReminderChange(idx, 'text', e.target.value)} placeholder="Ej: Triángulo roto, falta gata, rueda repuesto baja..." className="w-full border-2 border-slate-100 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-amber-500 mb-2 disabled:bg-slate-50 text-slate-700 resize-none min-h-[60px]"/>
                          
                          <div className="flex items-center gap-2">
                              <label className={`flex-1 py-2 text-center rounded-lg border-2 border-dashed cursor-pointer text-[10px] font-extrabold transition-colors uppercase tracking-wide ${rem.photo ? 'bg-green-50 border-green-400 text-green-700' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-500'}`}>
                                  <input type="file" accept="image/*" className="hidden" disabled={rem.resolved} onChange={async e => { const f=e.target.files[0]; if(!f)return; try{ const dUrl = await resizeImage(f, 400, 0.4); handleReminderChange(idx, 'photo', dUrl); }catch(err){}}}/>
                                  {rem.photo ? '📸 Foto Guardada' : '📸 Adjuntar Foto'}
                              </label>
                              {rem.photo && <button type="button" onClick={() => {
                                  const w = window.open(""); 
                                  w.document.write(`<img src="${rem.photo}" style="width:100%;max-width:800px;margin:auto;display:block;padding-top:20px;"/>`);
                              }} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors border border-blue-200"><Eye className="w-4 h-4"/></button>}
                              <button type="button" onClick={()=>removeReminder(idx)} className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors border border-red-200"><Trash2 className="w-4 h-4"/></button>
                          </div>
                      </div>
                  ))}
                  <button type="button" onClick={addReminder} className="w-full py-3 bg-amber-200 hover:bg-amber-300 text-amber-800 font-black text-xs uppercase tracking-widest rounded-xl transition-colors border border-amber-300 shadow-sm">+ Agregar Nuevo Aviso</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Croquis Pericial de Daños</h3>
                <select value={formData.vehicleType || 'auto'} onChange={e => setF('vehicleType', e.target.value)} className="bg-slate-100 border-2 border-slate-200 text-[10px] font-bold p-1.5 rounded-lg outline-none text-slate-700 cursor-pointer max-w-[140px]">
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

              <div className="bg-slate-50 p-4 rounded-3xl border-2 border-slate-100 mb-4 select-none relative">
                <div className="flex justify-between items-center mb-4 min-h-[40px]">
                  {!formData.zoomZone ? (
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed w-full text-center">
                      Toca los recuadros para fotos generales.<br/>
                      <span className="text-blue-500 text-xs">Toca un cuadrante del auto para acercar y marcar.</span>
                    </p>
                  ) : (
                    <div className="w-full flex items-center justify-between bg-blue-50 p-2 rounded-xl border border-blue-200 animate-in fade-in">
                      <p className="text-[11px] font-black text-blue-700 uppercase animate-pulse flex items-center gap-1"><Search className="w-4 h-4"/> Toca el daño exacto</p>
                      <button type="button" onClick={() => setF('zoomZone', null)} className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm border border-slate-200 flex items-center gap-1 hover:bg-slate-100 transition-colors"><X className="w-3 h-3"/> Volver</button>
                    </div>
                  )}
                </div>
                
                <div className="relative w-full max-w-[280px] h-[400px] mx-auto my-6">
                  <div 
                     className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 cursor-crosshair transition-all duration-300 ease-out drop-shadow-lg ${
                       !formData.zoomZone ? 'scale-100 z-10 hover:opacity-90' : 
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
                       document.getElementById(`pic-${availableDet}`).click();
                       setF('zoomZone', null);
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
                        <div className="w-[88%] h-full bg-slate-300 rounded-t-[45px] rounded-b-[35px] border-4 border-slate-400 relative flex flex-col p-1 shadow-inner z-10 overflow-hidden">
                          
                          {/* Líneas aerodinámicas del Capó */}
                          <div className="absolute top-[-2%] left-[15%] w-[70%] h-[20%] border-x-2 border-slate-400/40 rounded-t-[30px] pointer-events-none"></div>

                          {/* Habitáculo */}
                          <div className="flex flex-col h-full justify-between pt-[18%] pb-[12%] z-10">
                            {/* Parabrisas Delantero curvo */}
                            <div className="w-[85%] h-[16%] bg-slate-800/40 mx-auto rounded-t-[25px] rounded-b-[4px] shadow-sm border-t-2 border-white/20"></div>

                            {/* Techo y Ventanas Laterales (vidrios oscuros a los lados) */}
                            <div className="flex-1 w-[80%] mx-auto bg-slate-200 border-x-4 border-slate-800/40 relative flex flex-col my-1 shadow-sm rounded-sm">
                               {/* Línea divisoria de puertas (Pilar B) */}
                               <div className="w-full h-1/2 border-b-2 border-slate-400/30"></div>
                            </div>

                            {/* Parabrisas Trasero curvo */}
                            <div className="w-[80%] h-[11%] bg-slate-800/40 mx-auto rounded-b-[20px] rounded-t-[4px] shadow-sm border-b-2 border-white/20"></div>
                          </div>

                          {/* Línea del Maletero */}
                          <div className="absolute bottom-1.5 left-[20%] w-[60%] h-4 border-t-2 border-slate-400/60 rounded-t-lg pointer-events-none"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_pequeno' && (
                      <div className="w-full h-full relative flex flex-col items-center z-10">
                        <div className="w-[80%] h-[18%] bg-slate-300 rounded-t-[35px] border-x-4 border-t-4 border-slate-400 shadow-inner z-0"></div>
                        <div className="w-[100%] h-[82%] bg-slate-200 rounded-t-[15px] rounded-b-[20px] border-4 border-slate-400 shadow-inner flex flex-col p-1.5 z-10 -mt-2">
                          <div className="w-[90%] h-[20%] bg-slate-800/40 mx-auto rounded-t-[15px] rounded-b-sm mb-1.5 shadow-sm"></div>
                          <div className="flex-1 w-[95%] mx-auto bg-slate-300 border-2 border-slate-400/30 rounded-md relative flex justify-center overflow-hidden">
                            {/* Eliminamos la línea vertical molesta de acá */}
                            <div className="absolute top-1/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-2/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-3/4 w-full border-t-2 border-slate-400/20"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_grande' && (
                      <div className="w-full h-full bg-slate-200 rounded-t-[35px] rounded-b-[10px] border-4 border-slate-400 relative flex flex-col justify-start p-2 shadow-inner z-10">
                        <div className="w-[85%] h-[15%] bg-slate-800/40 mx-auto rounded-t-[20px] rounded-b-sm mt-1"></div>
                        <div className="flex-1 w-[90%] mx-auto bg-slate-300 border-2 border-slate-400/30 rounded-sm mt-3 mb-1 flex items-center justify-center relative overflow-hidden shadow-sm">
                          {/* Eliminamos la línea vertical molesta de acá */}
                          <div className="absolute top-1/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-2/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-3/4 w-full border-t border-slate-400/20"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camioneta' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-full h-[55%] bg-slate-300 rounded-t-[35px] rounded-b-md border-4 border-slate-400 p-2 flex flex-col justify-between shadow-inner relative overflow-hidden">
                          <div className="w-5/6 h-8 bg-slate-800/30 mx-auto rounded-t-xl rounded-b-sm mt-1 z-10"></div>
                          <div className="flex-1 w-full mx-auto relative flex flex-col justify-center my-1">
                             <div className="w-full border-t-2 border-slate-400/40"></div>
                          </div>
                          <div className="w-5/6 h-4 bg-slate-800/30 mx-auto rounded-b-xl rounded-t-sm mb-0.5 z-10"></div>
                        </div>
                        <div className="w-[90%] h-[43%] mx-auto bg-slate-200 border-x-4 border-b-4 border-slate-400 rounded-b-xl mt-1 relative shadow-inner">
                          <div className="absolute inset-1.5 border-2 border-slate-300/80 rounded-sm"></div>
                          <div className="absolute inset-y-2 left-1/3 border-l-2 border-slate-300/50"></div>
                          <div className="absolute inset-y-2 right-1/3 border-r-2 border-slate-300/50"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                          <div className="w-full h-1/2 bg-slate-800/40 rounded-t-md rounded-b-sm mb-1"></div>
                        </div>
                        <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion_doble' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[32%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 p-1 flex flex-col justify-end gap-1 shadow-inner z-10 relative">
                          <div className="w-full h-[40%] bg-slate-800/40 rounded-t-md"></div>
                          <div className="w-full h-[35%] bg-slate-800/40 rounded-sm mb-0.5"></div>
                        </div>
                        <div className="w-full h-[66%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
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
                            <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}
                        
                        {formData.vehicleType === 'carro_arrastre' && (
                          <div className="w-full h-full relative overflow-hidden flex justify-center items-center">
                            <div className="w-[90%] h-[80%] bg-slate-300 rounded-md border-4 border-slate-400 relative overflow-hidden shadow-inner flex justify-center items-center z-10 mt-6">
                                <div className="w-[90%] h-[90%] border-2 border-slate-300/50 rounded-sm"></div>
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
                            <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(formData.detailPins || []).map(pin => (
                      <div key={pin.id} className="absolute w-8 h-8 -ml-4 -mt-4 bg-red-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center z-50 animate-in zoom-in" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                        <img src={formData.photos[pin.id]} className="w-full h-full object-cover rounded-full opacity-90" alt="Detalle" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setF('photos', {...formData.photos, [pin.id]: false}); setF('detailPins', formData.detailPins.filter(p => p.id !== pin.id)); }} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-700 shadow-md"><X className="w-3 h-3"/></button>
                      </div>
                    ))}
                  </div>

                  <label className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.front ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-front" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'front')}/>
                    {formData.photos.front ? <><img src={formData.photos.front} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-1"/><span className="text-[9px] font-black text-slate-500 tracking-wide">FRENTE</span></>}
                  </label>

                  <label className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.back ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-back" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'back')}/>
                    {formData.photos.back ? <><img src={formData.photos.back} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-1"/><span className="text-[9px] font-black text-slate-500 tracking-wide">ATRÁS</span></>}
                  </label>

                  <label className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.left ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-left" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'left')}/>
                    {formData.photos.left ? <><img src={formData.photos.left} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5"/><span className="text-[8px] font-black text-slate-500 text-center leading-tight">LATERAL<br/>PILOTO</span></>}
                  </label>

                  <label className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.right ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-right" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'right')}/>
                    {formData.photos.right ? <><img src={formData.photos.right} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5"/><span className="text-[8px] font-black text-slate-500 text-center leading-tight">LATERAL<br/>COPILOTO</span></>}
                  </label>

                  {['det1','det2','det3','det4','det5','det6','det7','det8'].map(d => <input key={d} type="file" id={`pic-${d}`} className="sr-only" accept="image/*" onChange={e=>handlePic(e,d)}/>)}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6 border-t-2 border-slate-100 pt-4">
                  {[{id:'dashboard', l:'Tablero'}, {id:'tire', l:'Repuesto'}, {id:'interior_front', l:'Int. Adelante'}, {id:'interior_back', l:'Int. Atrás'}].map(p => (
                     <label key={p.id} className={`w-full h-12 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white shadow-sm transition-all ${formData.photos[p.id] ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-slate-50'}`}>
                       <input type="file" className="sr-only" accept="image/*" onChange={e=>handlePic(e,p.id)}/>
                       {formData.photos[p.id] ? <><img src={formData.photos[p.id]} className="absolute inset-0 w-full h-full object-cover opacity-30"/><CheckCircle className="w-5 h-5 text-green-500 relative z-10 bg-white rounded-full"/><span className="text-[10px] font-black text-green-800 relative z-10">{p.l}</span></> : <><Camera className="w-4 h-4 text-slate-400"/><span className="text-[10px] font-black text-slate-500 uppercase">{p.l}</span></>}
                     </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Combustible a Bordo</h3>
              
              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${formData.fuelLevel < 30 ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <Fuel className={`w-6 h-6 ${formData.fuelLevel < 30 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estanque</p>
                       <p className={`text-2xl font-black leading-none transition-colors ${formData.fuelLevel < 30 ? 'text-red-600' : formData.fuelLevel <= 50 ? 'text-amber-500' : 'text-green-600'}`}>
                         {formData.fuelLevel}%
                       </p>
                    </div>
                  </div>
                  <div className="text-right">
                     <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors ${formData.fuelLevel == 0 ? 'bg-red-100 text-red-700' : formData.fuelLevel <= 25 ? 'bg-red-50 text-red-600' : formData.fuelLevel <= 50 ? 'bg-amber-50 text-amber-600' : formData.fuelLevel <= 75 ? 'bg-green-50 text-green-600' : 'bg-green-100 text-green-700'}`}>
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
                        onChange={(e) => setF('fuelLevel', e.target.value)} 
                        className="absolute z-20 w-full h-full opacity-0 cursor-pointer inset-0 m-0" 
                      />
                      
                      <div className="absolute inset-y-2 inset-x-0 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200 pointer-events-none">
                        <div className="absolute inset-0 flex justify-between px-[25%] z-10">
                           <div className="w-0.5 h-full bg-white/80"></div>
                           <div className="w-0.5 h-full bg-white/80"></div>
                           <div className="w-0.5 h-full bg-white/80"></div>
                        </div>
                        
                        <div 
                          className={`h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 relative ${
                             formData.fuelLevel < 30 
                               ? 'bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_10px,#dc2626_10px,#dc2626_20px)]' 
                               : formData.fuelLevel <= 50 
                               ? 'bg-amber-400' 
                               : 'bg-green-500'
                          }`}
                          style={{ width: `${formData.fuelLevel}%` }}
                        >
                           <div className="w-1.5 h-3 bg-white/50 rounded-full relative z-20"></div>
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 mt-6 text-slate-800 uppercase tracking-wider">Viáticos y Esperas</h3>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Wallet className="w-5 h-5"/></div>
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase leading-none">Fondo Asignado</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Patente: {job.plate || job.vin || 'N/A'}</p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-blue-700">
                  {formatMoney(expenses?.filter(g => g.jobId === job.id && g.type === 'assignment').reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0)}
                </p>
              </div>

              {job.tripType === 'revision' && (job.rtData?.revision || job.rtData?.inspeccion || job.rtData?.frenos) && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-4 h-4"/> Valores pagados en Planta (PRT)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.rtData?.revision && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Revisión Técnica ($)</label>
                        <input type="number" placeholder="Ej: 20000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostRevision || ''} onChange={e => setF('prtCostRevision', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.inspeccion && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Inspección Visual ($)</label>
                        <input type="number" placeholder="Ej: 5000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostInspeccion || ''} onChange={e => setF('prtCostInspeccion', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.frenos && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Certificado Frenos ($)</label>
                        <input type="number" placeholder="Ej: 8000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostFrenos || ''} onChange={e => setF('prtCostFrenos', e.target.value)} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 select-none shadow-sm ${job.waitTimeMinutes >= 1 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  <Clock className="w-5 h-5"/>
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Espera: {job.waitTimeMinutes || 0} min</span>
                </div>

                <button type="button" onClick={() => setF('hasFuelCharge', !formData.hasFuelCharge)} className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all select-none shadow-sm ${formData.hasFuelCharge ? 'border-blue-500 bg-blue-500 text-white shadow-blue-100' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {formData.hasFuelCharge ? <CheckCircle className="w-5 h-5 animate-in zoom-in"/> : <Fuel className="w-5 h-5"/>}
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Carga Combust.</span>
                </button>
              </div>

              {formData.hasFuelCharge && (
                <div className="animate-in fade-in slide-in-from-top-2 border rounded-xl p-3 bg-slate-50 shadow-inner max-w-sm mx-auto">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider text-center mb-1">Monto Rendición Gasolinera ($)</p>
                  <input type="number" placeholder="Ej: 15000" value={formData.fuelChargeAmount || ''} onChange={(e) => setF('fuelChargeAmount', e.target.value)} className="w-full bg-white border p-2 rounded-xl text-center text-sm font-bold outline-none" />
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Cierre y Conformidad</h3>
              
              <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-2xl border-slate-900 border-2 cursor-pointer shadow-md transition-colors hover:bg-slate-700">
                 <input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-6 h-6 cursor-pointer accent-blue-500 rounded"/> 
                 <span className="font-extrabold text-sm text-white">Dejar sin firma (Local cerrado / PRT)</span>
              </label>
               
               {!formData.noReception && (
                 <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                    <h3 className="font-extrabold text-blue-800 mb-1 flex items-center gap-2"><Zap className="w-5 h-5"/> Firma Remota o QR</h3>
                    <p className="text-[11px] font-bold text-blue-600 mb-3">Envía el link al cliente o muéstrale el QR para que firme desde su celular.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleRemoteSignRequest} disabled={processingAction === 'wapp'} className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                         {processingAction === 'wapp' ? <Clock className="w-4 h-4 animate-spin"/> : <Share2 className="w-4 h-4"/>} {processingAction === 'wapp' ? 'Cargando...' : 'Compartir Link'}
                      </button>
                      <button type="button" onClick={handleOpenQR} disabled={processingAction === 'qr'} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                         {processingAction === 'qr' ? <Clock className="w-4 h-4 animate-spin"/> : <QrCode className="w-4 h-4"/>} {processingAction === 'qr' ? 'QR' : 'Mostrar QR'}
                      </button>
                    </div>
                 </div>
               )}

               {!formData.noReception && (
                 <div className="space-y-3">
                   <div className="flex items-center gap-2 my-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-bold text-slate-400 uppercase">O llenar manualmente</span><div className="h-px bg-slate-200 flex-1"></div></div>
                   
                   <input required={!formData.noReception} value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre del receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   <input required={!formData.noReception} value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT Receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   
                   {formData.clientComments && (
                     <div className="bg-slate-100 p-2.5 rounded-xl border">
                       <p className="text-[9px] font-extrabold text-slate-500 uppercase">Comentarios del Receptor:</p>
                       <p className="text-xs font-bold text-slate-800 italic">"{formData.clientComments}"</p>
                     </div>
                   )}

                   <div className="relative mt-1">
                     {formData.signatureData && <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 z-10"><CheckCircle className="w-3 h-3"/> CAPTURADA</div>}
                     <SignaturePad initialData={formData.signatureData} onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/>
                   </div>
                 </div>
               )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-3 rounded-xl text-sm w-1/3 active:scale-[0.97] transition-all duration-200">
                Atrás
              </button>
            )}
            
            {step < 6 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="group flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-200 flex justify-center items-center gap-2 relative overflow-hidden">
                <span className="relative z-10">Siguiente Paso</span>
                <span className="relative z-10 transform group-hover:translate-x-1.5 transition-transform duration-300">➔</span>
                <div className="absolute inset-0 h-full w-full translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-in-out"></div>
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="group flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 transition-all duration-200 flex justify-center items-center gap-2">
                {isSubmitting ? <><Clock className="w-4 h-4 animate-spin"/> Guardando GPS y Acta...</> : <><span className="group-hover:animate-bounce">🏁</span> Finalizar y Guardar</>}
              </button>
            )}
          </div>

        </form>
      </div>

      {uploadProgress.active && (
        <div className="fixed bottom-[88px] left-1/2 transform -translate-x-1/2 z-[60] w-[92%] max-w-sm animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-3xl shadow-2xl border-2 border-slate-700 flex flex-col gap-3">
            <div className="flex justify-between items-center">
               <span className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                 <div className="relative">
                   <CloudOff className="w-5 h-5 text-blue-400 animate-pulse"/>
                 </div>
                 Sincronizando
               </span>
               <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                 {uploadProgress.current} / {uploadProgress.total}
               </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner border border-slate-900">
               <div className="bg-blue-500 h-full transition-all duration-300 relative" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}>
                 <div className="absolute inset-0 bg-white/20 w-full h-full animate-[pulse_1s_ease-in-out_infinite]"></div>
               </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold truncate leading-none">{uploadProgress.text}</p>
          </div>
        </div>
      )}

      {/* MODAL DEL DÉJÀ VU PERICIAL */}
      {showDejaVuModal && dejaVuData && (
        <div className="fixed inset-0 bg-slate-900/80 z-[9998] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDejaVuModal(false)}>
           <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-purple-600 p-4 flex justify-between items-center">
                 <h3 className="text-white font-black flex items-center gap-2"><Search className="w-5 h-5"/> Memoria Histórica</h3>
                 <button onClick={() => setShowDejaVuModal(false)} className="bg-white/20 p-1.5 rounded-full text-white hover:bg-white/30 transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                 
                 <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Último Conductor:</p>
                    <p className="text-xs font-extrabold text-slate-700">{dejaVuData.assignedDriverName || dejaVuData.acceptedByEmail}</p>
                 </div>

                 {dejaVuData.checklist.observations && (
                   <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                      <p className="text-[10px] font-black text-amber-700 uppercase mb-1">Observaciones Anteriores:</p>
                      <p className="text-xs font-bold text-amber-900 italic">"{dejaVuData.checklist.observations}"</p>
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
                                className="w-full h-24 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
                                alt="Daño anterior" 
                                onClick={() => { setShowDejaVuModal(false); setFullScreenImage(dejaVuData.checklist.photos[pin.id]); }}
                              />
                            )
                         ))}
                      </div>
                   </div>
                 )}
                 <button type="button" onClick={() => setShowDejaVuModal(false)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition-colors text-xs uppercase tracking-widest mt-2">
                    Entendido, Volver al Checklist
                 </button>
              </div>
           </div>
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors shadow-lg">
            <X className="w-6 h-6" />
          </button>
          <img src={fullScreenImage} alt="Evidencia Ampliada" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}