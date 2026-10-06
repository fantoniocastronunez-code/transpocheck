import React, { useState } from 'react';
import { ArrowLeft, Loader2, Save, CheckCircle } from 'lucide-react';
import { ChecklistProvider, useChecklist } from './ChecklistContext';
import { useChecklistSync } from './hooks/useChecklistSync';
import InAppCamera from '../../ui/InAppCamera';

import { TabsHeader } from './components/TabsHeader';
import { FastTrackView } from './components/FastTrackView';

import { StepData } from './steps/StepData';
import { StepDocs } from './steps/StepDocs';
import { StepNotes } from './steps/StepNotes';
import { StepPhotos } from './steps/StepPhotos';
import { ImageViewer } from '../../ui/ImageViewer';
import { StepFuel } from './steps/StepFuel';
import { StepSignature } from './steps/StepSignature';

import { doc, updateDoc, setDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../../firebase'; // Ajustar si es necesario

// Este es el componente que realmente usa el contexto
const ChecklistInner = ({ openCamera }) => {
  const {
    job, isQuick, formData, setFormData, step, setStep, isDraftLoaded, setIsDraftLoaded,
    isSubmitting, setIsSubmitting, processingAction, setProcessingAction,
    defaultData, matchedVehicle, drivers, currentUserEmail, uploadImageToStorage, pushSyncTask,
    showAlert, showConfirm, onCancel, onComplete
  } = useChecklist();

  const [uploadProgress, setUploadProgress] = useState({ active: false, current: 0, total: 0, text: '' });
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [isDraggingFuel, setIsDraggingFuel] = useState(false);
  const svgFuelRef = React.useRef(null);

  const updateFuelFromEvent = (e) => {
    if (!svgFuelRef.current) return;
    const rect = svgFuelRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (clientX == null || clientY == null) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * (100 / 110);
    const dx = clientX - centerX;
    const dy = centerY - clientY;
    let angle = Math.atan2(dx, dy) * (180 / Math.PI);
    if (angle < -90) angle = -90;
    if (angle > 90) angle = 90;
    
    let fuel = (angle + 90) / 180;
    setFormData(prev => ({ ...prev, fuelLevel: fuel }));
  };

  // Instanciar Hooks
  const { syncFilesToStorage, clearLocalDraft } = useChecklistSync({
    job, isQuick, formData, setFormData, step, setStep, setIsDraftLoaded,
    defaultData, matchedVehicle, drivers, currentUserEmail, uploadImageToStorage, pushSyncTask, showAlert
  });

  const calculateProgress = () => {
    let earned = 0;

    const isAuto = !formData.vehicleType || formData.vehicleType === 'auto';
    let total = isAuto ? 27 : 29;

    // 1. Documents (4 docs * 3 points = 12 points)
    const checkDoc = (id) => {
       if (formData.docs?.[id]) earned += 1;
       if (formData.docsExpiry?.[id] && String(formData.docsExpiry[id]).trim() !== '') earned += 1;
       if (formData.docsPhotos?.[id]) earned += 1;
    };
    
    if (formData.isNewVehicle) {
      total -= 12; // 4 documents * 3 points
    } else {
      checkDoc('permiso');
      checkDoc('soap');
      checkDoc('revTecnica');
      checkDoc('gases');
    }

    // 2. Revisión (4 points)
    const checkRevision = (id) => {
       if (formData.carDamages?.[id]?.status) earned += 1;
    };
    checkRevision('luces');
    checkRevision('neumaticos');
    checkRevision('carroceria');
    checkRevision('parabrisas');

    // 3. Photos (8 or 10 points)
    const checkPhoto = (id) => {
       if (formData.photos?.[id]) earned += 1;
    };
    checkPhoto('dashboard');
    checkPhoto('tire');
    checkPhoto('interior_front');
    checkPhoto('interior_back');
    checkPhoto('front');
    checkPhoto('back');

    if (isAuto) {
      checkPhoto('left');
      checkPhoto('right');
    } else {
      checkPhoto('left_cab');
      checkPhoto('left_body');
      checkPhoto('right_cab');
      checkPhoto('right_body');
    }

    // 4. Signature (3 points)
    if (formData.receiverName && String(formData.receiverName).trim() !== '') earned += 1;
    if (formData.receiverRut && String(formData.receiverRut).trim() !== '') earned += 1;
    if (formData.signatureData) earned += 1;

    return Math.min(100, Math.round((earned / total) * 100));
  };

  const handlePreSubmit = () => {
    if (job?.tripType === 'revision' && formData.rtStatus === 'pendiente') {
      return showAlert("⚠️ Debes registrar un resultado final para la Revisión Técnica antes de cerrar.");
    }

    const isGrandleasing = job?.client?.toLowerCase() === 'grandleasing' || formData.client?.toLowerCase() === 'grandleasing';

    if (isGrandleasing) {
      setShowFinalModal(true);
    } else {
      handleSubmitFinal();
    }
  };

  const handleSubmitFinal = async () => {
    setShowFinalModal(false);

    // Si no está firmado, preguntar.
    if (!formData.signatureData && !formData.noReception && job?.tripType !== 'simple') {
      const resp = await new Promise(resolve => {
        showConfirm("No has firmado el acta. ¿Quieres cerrarla de todas formas y dejarla 'Sin Recepción'?", (ok) => resolve(ok));
      });
      if (!resp) return;
      setFormData(prev => ({ ...prev, noReception: true }));
    }

    setIsSubmitting(true);
    setProcessingAction('Iniciando subida...');

    const runBackgroundProcess = async (syncTask = null, setProgress = () => {}) => {
      try {
        let finalLocation = null;
        try {
          if (navigator.geolocation) {
            finalLocation = await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
              );
            });
          }
        } catch (e) {
          console.warn("GPS Falló al finalizar:", e);
        }

        const formDataWithLocation = { ...formData, location: finalLocation || formData.location };
        
        // Función para procesar y descontar gastos automáticamente
        const processChecklistExpenses = async (finalData) => {
          const driverObj = drivers?.find(d => d.email === currentUserEmail);
          if (!driverObj || !driverObj.id) return;
          let newBalance = driverObj.balance || 0;
          if (finalData.hasFuelCharge && finalData.fuelChargeAmount > 0) {
            await addDoc(collection(db, 'expenses'), {
              driverId: driverObj.id, driverEmail: driverObj.email, driverName: driverObj.name,
              type: 'expense', amount: Number(finalData.fuelChargeAmount), detail: 'Carga de combustible (Auto-generado desde Checklist)',
              jobId: job.id, deductedAmount: Number(finalData.fuelChargeAmount), receiptImage: finalData.fuelReceipt || null,
              createdAt: Date.now()
            });
            newBalance -= Number(finalData.fuelChargeAmount);
          }
          if (job.tripType === 'revision') {
            const prtTotal = (Number(finalData.prtCostRevision) || 0) + (Number(finalData.prtCostInspeccion) || 0) + (Number(finalData.prtCostFrenos) || 0) + (Number(finalData.prtCostGases) || 0);
            if (prtTotal > 0) {
              await addDoc(collection(db, 'expenses'), {
                driverId: driverObj.id, driverEmail: driverObj.email, driverName: driverObj.name,
                type: 'expense', amount: prtTotal, detail: 'Trámite PRT (Auto-generado desde Checklist)',
                jobId: job.id, deductedAmount: prtTotal, receiptImage: null, createdAt: Date.now()
              });
              newBalance -= prtTotal;
            }
          }
          if (newBalance !== (driverObj.balance || 0)) {
            await updateDoc(doc(db, 'drivers', driverObj.id), { balance: newBalance });
          }
        };

        if (isQuick) {
          const finalData = await syncFilesToStorage(formDataWithLocation, setProgress);
          const driverObj = drivers?.find(d => d.email === currentUserEmail) || { name: currentUserEmail };
          await setDoc(doc(db, 'transport_jobs', `quick_${Date.now()}`), {
            status: 'completed', client: finalData.client === 'OTRO' ? finalData.manualClient : finalData.client,
            brand: finalData.brand || 'S/N', model: finalData.model || 'S/N', plate: finalData.plateOrVin || 'S/N',
            origin: finalData.origin || 'Origen Desconocido', destination: finalData.destination || 'Destino Desconocido',
            driverEmail: currentUserEmail, driverName: driverObj.name, createdAt: Date.now(), completedAt: Date.now(),
            checklist: finalData, tripType: 'simple'
          });
          
          if (matchedVehicle && matchedVehicle.id) {
            try { await updateDoc(doc(db, 'vehicles', matchedVehicle.id), { docs: finalData.docs || {}, docsExpiry: finalData.docsExpiry || {}, docsPhotos: finalData.docsPhotos || {} }); } catch (e) {}
          }
        } else {
          // Normal Job
          const updates = { phase: 'returning', 'draft.step': step };
          if (job.tripType === 'revision') {
            updates.prt_result = formDataWithLocation.rtStatus;
            updates.prt_reason = formDataWithLocation.rtRejectReason || '';
          }
          
          // Guardar draft rápido
          const draftDataForFirestore = JSON.parse(JSON.stringify(formDataWithLocation));
          for (const key in draftDataForFirestore.photos) {
            if (typeof draftDataForFirestore.photos[key] === 'string' && !draftDataForFirestore.photos[key].startsWith('http')) draftDataForFirestore.photos[key] = false;
          }
          const base64Fields = ['signatureData', 'fuelReceipt', 'scandocPdf', 'guiaDespachoPdf'];
          base64Fields.forEach(field => {
            if (typeof draftDataForFirestore[field] === 'string' && !draftDataForFirestore[field].startsWith('http')) draftDataForFirestore[field] = false;
          });
          updates['draft.formData'] = draftDataForFirestore;
          try { await updateDoc(doc(db, 'transport_jobs', job.id), updates); } catch(e){}

          // Subir fotos
          const finalData = await syncFilesToStorage(formDataWithLocation, setProgress);
          
          await updateDoc(doc(db, 'transport_jobs', job.id), {
            checklist: finalData, status: 'completed', completedAt: Date.now(), draft: null
          });
          await processChecklistExpenses(finalData);

          if (matchedVehicle && matchedVehicle.id) {
            try { await updateDoc(doc(db, 'vehicles', matchedVehicle.id), { docs: finalData.docs || {}, docsExpiry: finalData.docsExpiry || {}, docsPhotos: finalData.docsPhotos || {} }); } catch (e) {}
          }
        }

        if (clearLocalDraft) await clearLocalDraft();
        if (syncTask) syncTask.finish();
      } catch(err) {
        console.error("[ERR-BG-SYNC-01] Error en background sync:", err);
        if (syncTask) syncTask.error(err);
        else throw err;
      }
    };

    if (pushSyncTask) {
      const syncTask = pushSyncTask(`Sync ${job?.plate || job?.vin || 'Vehículo'}`);
      showAlert(`✅ ¡Completaste el ${calculateProgress()}% del Checklist! Subida en 2do plano iniciada.`);
      onComplete();
      
      // Iniciar proceso sin await
      runBackgroundProcess(syncTask);
    } else {
      try {
        await runBackgroundProcess(null, setUploadProgress);
        showAlert(`✅ ¡Completaste el ${calculateProgress()}% del Checklist! Guardado Correctamente.`);
        onComplete();
      } catch(err) {
        console.error("[ERR-SAVE-02] Error global al guardar checklist:", err);
        showAlert(`❌ Error al guardar [ERR-SAVE-02]: ${err.message}`);
      } finally {
        setIsSubmitting(false);
        setProcessingAction(null);
      }
    }
  };

  const isSimple = job?.tripType === 'simple' || isQuick;

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 flex flex-col h-[100dvh] overflow-hidden animate-in slide-in-from-bottom-full duration-300">

      {/* HEADER PRINCIPAL */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-4 py-3 sm:py-4 shadow-sm relative z-50 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 sm:p-2.5 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
        >
          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div className="text-center flex-1 mx-2 overflow-hidden">
          <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 truncate">
            {isQuick ? 'Checklist Rápido' : 'Checklist Digital'}
          </h2>
          {!isQuick && (
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
              {job?.plate || job?.vin || 'Vehículo'} • {job?.client || 'Cliente'}
            </p>
          )}
        </div>

      </div>

      {/* BARRA DE PROGRESO */}
      {!isSimple && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Progreso del Checklist</span>
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{calculateProgress()}% Completado</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden shadow-inner">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
              style={{ width: `${calculateProgress()}%` }}
            ></div>
          </div>
        </div>
      )}

      <TabsHeader />

      {/* CONTENIDO DESLIZABLE */}
      <div className="flex-1 overflow-y-auto pb-40 scroll-smooth">
        {isSimple ? (
          <FastTrackView openCamera={openCamera} />
        ) : (
          <div className="px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {step === 1 && <StepData />}
            {step === 2 && <StepDocs openCamera={openCamera} />}
            {step === 3 && <StepNotes openCamera={openCamera} />}
            {step === 4 && <StepPhotos openCamera={openCamera} />}
            {step === 5 && <StepSignature />}
          </div>
        )}
      </div>

      {/* BARRA INFERIOR (NAVEGACIÓN Y GUARDAR) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/50 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-50 flex flex-col gap-3">

        <div className="flex gap-3">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || isSubmitting}
            className={`flex-1 font-black py-3 rounded-2xl border-2 flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 ${step === 1 || isSubmitting
                ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <button
            onClick={() => setStep(Math.min(isSimple ? 3 : 5, step + 1))}
            disabled={step === (isSimple ? 3 : 5) || isSubmitting}
            className={`flex-1 font-black py-3 rounded-2xl border-2 flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 ${step === (isSimple ? 3 : 5) || isSubmitting
                ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
              }`}
          >
            Siguiente <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>

        <button
          onClick={handlePreSubmit}
          disabled={isSubmitting}
          className={`w-full font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 ${isSubmitting
              ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-500/30'
            }`}
        >
          {isSubmitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> {processingAction || 'Guardando...'}</>
          ) : (
            <><Save className="w-5 h-5" /> Finalizar y Guardar Acta</>
          )}
        </button>
      </div>

      {/* Overlay de Carga Principal */}
      {showFinalModal && !uploadProgress.active && (
        <div className="absolute inset-0 bg-[#060b19]/90 backdrop-blur-xl z-[90] flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in">
          <div className="bg-slate-900/60 p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(59,130,246,0.15)] w-full max-w-sm flex flex-col relative overflow-hidden border border-slate-700/50 backdrop-blur-3xl pb-8">
            {/* Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-blue-500/50 rounded-full blur-[40px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-12 bg-blue-500/30 rounded-full blur-[40px] pointer-events-none" />

            <h3 className="text-lg font-bold text-white mb-6 mt-2 tracking-wide text-center">
              Combustible y Kilometraje
            </h3>

            <div className="space-y-6 relative z-10 flex-1">
              {/* Odómetro */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1 px-4">
                   <label className="text-xs text-slate-300 font-medium tracking-wide">Odómetro Actual</label>
                   <span className="text-xs text-slate-500 font-medium">Km</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.mileage || ''}
                    onChange={e => setFormData(p => ({ ...p, mileage: e.target.value }))}
                    className="w-full bg-[#131b2e] border border-slate-700/50 p-4 rounded-[1.5rem] text-center text-3xl font-black text-white outline-none focus:border-blue-500/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all shadow-inner"
                  />
                </div>
                <p className="text-center text-[10px] text-slate-500 mt-2 font-medium tracking-wide uppercase">Ingresa el Kilometraje</p>
              </div>

              {/* Medidor Combustible Visual */}
              <div className="relative w-full aspect-[2/1] mt-4 flex items-end justify-center">
                {(() => {
                   const fLevel = formData.fuelLevel ?? 0;
                   const fuelDec = fLevel <= 1 && fLevel !== 0 ? fLevel : fLevel / 100;
                   return (
                 <svg 
                    ref={svgFuelRef}
                    viewBox="0 0 200 110" 
                    className="w-[90%] overflow-visible touch-none cursor-pointer"
                    onPointerDown={(e) => { setIsDraggingFuel(true); updateFuelFromEvent(e); e.currentTarget.setPointerCapture(e.pointerId); }}
                    onPointerMove={(e) => { if(isDraggingFuel) updateFuelFromEvent(e); }}
                    onPointerUp={(e) => { setIsDraggingFuel(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
                    onPointerCancel={(e) => { setIsDraggingFuel(false); }}
                 >
                    {/* Fondo del arco */}
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                    
                    {/* Arco con gradiente */}
                    <path 
                      d="M 20 100 A 80 80 0 0 1 180 100" 
                      fill="none" 
                      stroke="url(#fuelGradient)" 
                      strokeWidth="12" 
                      strokeLinecap="round" 
                      strokeDasharray={`${Math.PI * 80 * fuelDec} ${Math.PI * 80}`}
                      style={{ transition: isDraggingFuel ? 'none' : 'stroke-dasharray 0.3s ease-out' }}
                    />
                    <defs>
                      <linearGradient id="fuelGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>

                    {/* Aguja */}
                    <g transform={`translate(100, 100) rotate(${-90 + (fuelDec * 180)})`} style={{ transition: isDraggingFuel ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      <circle cx="0" cy="0" r="8" fill="#3b82f6" className="shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                      <circle cx="0" cy="0" r="4" fill="#0f172a" />
                      <path d="M -3 -8 L 0 -65 L 3 -8 Z" fill="#3b82f6" />
                    </g>

                    {/* Textos centrales */}
                    <text x="100" y="65" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
                      {fuelDec === 0 ? 'Vacío' : fuelDec === 1 ? 'Full' : `${Math.round(fuelDec * 100)}%`}
                    </text>
                    <text x="100" y="80" textAnchor="middle" fill="#64748b" fontSize="10">remaining</text>
                    
                    <text x="15" y="115" textAnchor="middle" fill="#ec4899" fontSize="12" fontWeight="bold">E</text>
                    <text x="185" y="115" textAnchor="middle" fill="#06b6d4" fontSize="12" fontWeight="bold">F</text>
                 </svg>
                 );})()}
              </div>

              {/* Botones de fotos */}
              <div className="flex flex-col gap-3 mt-4">
                <button
                   type="button"
                   onClick={() => openCamera('Kilometraje', async f => {
                      setProcessingAction('Procesando Foto...');
                      setIsSubmitting(true);
                      try {
                        const { resizeImage } = await import('../../../utils/helpers');
                        const compressed = await resizeImage(f, 1200, 0.6);
                        const reader = new FileReader();
                        reader.onload = () => {
                          setFormData(p => ({ ...p, photos: { ...p.photos, odometer: reader.result } }));
                          setIsSubmitting(false);
                          setProcessingAction(null);
                        };
                        reader.readAsDataURL(compressed);
                      } catch (e) {
                        setIsSubmitting(false);
                        setProcessingAction(null);
                      }
                   })}
                   className={`relative overflow-hidden w-full py-3.5 rounded-[1.25rem] flex items-center justify-center gap-2 border transition-all ${formData.photos?.odometer ? 'border-green-500/50 bg-green-900/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-blue-500/30 bg-gradient-to-b from-blue-600/20 to-blue-900/40 text-blue-300 hover:from-blue-500/30 hover:to-blue-800/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                >
                   <Camera className="w-5 h-5" />
                   <span className="text-xs font-bold tracking-wider uppercase">
                      {formData.photos?.odometer ? 'Foto Odómetro (OK)' : 'Subir Foto Odómetro'}
                   </span>
                </button>

                <button
                   type="button"
                   onClick={() => openCamera('Combustible', async f => {
                      setProcessingAction('Procesando Foto Combustible...');
                      setIsSubmitting(true);
                      try {
                        const { resizeImage } = await import('../../../utils/helpers');
                        const compressed = await resizeImage(f, 1200, 0.6);
                        const reader = new FileReader();
                        reader.onload = () => {
                          setFormData(p => ({ ...p, photos: { ...p.photos, fuelGauge: reader.result } }));
                          setIsSubmitting(false);
                          setProcessingAction(null);
                        };
                        reader.readAsDataURL(compressed);
                      } catch (e) {
                        setIsSubmitting(false);
                        setProcessingAction(null);
                      }
                   })}
                   className={`relative overflow-hidden w-full py-3.5 rounded-[1.25rem] flex items-center justify-center gap-2 border transition-all ${formData.photos?.fuelGauge ? 'border-green-500/50 bg-green-900/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-blue-500/30 bg-gradient-to-b from-blue-600/20 to-blue-900/40 text-blue-300 hover:from-blue-500/30 hover:to-blue-800/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                >
                   <Camera className="w-5 h-5" />
                   <span className="text-xs font-bold tracking-wider uppercase">
                      {formData.photos?.fuelGauge ? 'Foto Recibo/Tablero (OK)' : 'Subir Foto Recibo'}
                   </span>
                </button>
              </div>

            </div>

            {/* Navegación inferior tipo mockup */}
            <div className="flex justify-between items-center mt-8 relative z-10 px-2">
              <button
                onClick={() => setShowFinalModal(false)}
                className="w-12 h-12 rounded-full bg-[#131b2e] border border-slate-700/50 text-slate-400 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                 <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              </div>

              <button
                onClick={() => {
                  if (!formData.mileage) return showAlert("⚠️ Ingresa el kilometraje final.");
                  if (!formData.photos?.odometer) return showAlert("⚠️ Toma la foto del kilometraje.");
                  if (formData.fuelLevel === undefined) return showAlert("⚠️ Selecciona el nivel de combustible.");
                  if (!formData.photos?.fuelGauge) return showAlert("⚠️ Toma la foto del medidor de combustible.");
                  handleSubmitFinal();
                }}
                className="w-12 h-12 rounded-full bg-[#131b2e] border border-blue-500/30 text-blue-400 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              >
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Overlay de Carga Principal */}
      {uploadProgress.active && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-xs w-full">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg mb-2">Sincronizando</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold text-center mb-4">{uploadProgress.text}</p>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%` }} />
            </div>
            <p className="text-xs font-black text-blue-500 mt-2">{uploadProgress.current} de {uploadProgress.total}</p>
          </div>
        </div>
      )}

    </div>
  );
};

// Componente Wrapper Exportado
export const ChecklistForm = (props) => {
  const [cameraConfig, setCameraConfig] = useState({ isOpen: false, title: '', onCapture: null, enableAnnotation: false });

  const openCamera = (title, onCapture, enableAnnotation = false) => {
    setCameraConfig({ isOpen: true, title, onCapture, enableAnnotation });
  };

  return (
    <ChecklistProvider {...props}>
      <ChecklistInner openCamera={openCamera} />

      <InAppCamera
        isOpen={cameraConfig.isOpen}
        title={cameraConfig.title}
        enableAnnotation={cameraConfig.enableAnnotation}
        onClose={() => setCameraConfig({ isOpen: false, title: '', onCapture: null, enableAnnotation: false })}
        onCapture={(file) => {
          if (cameraConfig.onCapture) {
            cameraConfig.onCapture(file);
          }
          setCameraConfig({ isOpen: false, title: '', onCapture: null, enableAnnotation: false });
        }}
      />

      <ImageViewer />
    </ChecklistProvider>
  );
};

export default ChecklistForm;
