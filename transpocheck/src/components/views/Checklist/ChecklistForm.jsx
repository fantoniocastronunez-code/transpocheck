import React, { useState } from 'react';
import { ArrowLeft, Mic, Loader2, Save, CheckCircle } from 'lucide-react';
import { ChecklistProvider, useChecklist } from './ChecklistContext';
import { useChecklistSync } from './hooks/useChecklistSync';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
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

  // Instanciar Hooks
  const { syncFilesToStorage, clearLocalDraft } = useChecklistSync({
    job, isQuick, formData, setFormData, step, setStep, setIsDraftLoaded,
    defaultData, matchedVehicle, drivers, currentUserEmail, uploadImageToStorage, pushSyncTask, showAlert
  });

  const { isListening, isInterpreting, toggleVoiceAssistant } = useVoiceAssistant(formData, (f, v) => setFormData(p => ({ ...p, [f]: v })), showAlert);

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
            try { await updateDoc(doc(db, 'vehicles', matchedVehicle.id), { docs: finalData.docs || {}, docsExpiry: finalData.docsExpiry || {} }); } catch (e) {}
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
            try { await updateDoc(doc(db, 'vehicles', matchedVehicle.id), { docs: finalData.docs || {}, docsExpiry: finalData.docsExpiry || {} }); } catch (e) {}
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
      showAlert("✅ Subida iniciada en segundo plano. Puedes continuar usando la app.");
      onComplete();
      
      // Iniciar proceso sin await
      runBackgroundProcess(syncTask);
    } else {
      try {
        await runBackgroundProcess(null, setUploadProgress);
        showAlert("✅ Checklist Guardado Correctamente.");
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

        {/* BOTÓN ASISTENTE DE VOZ */}
        {!isSimple && (
          <button
            type="button"
            onClick={toggleVoiceAssistant}
            className={`p-2 sm:p-2.5 rounded-xl flex items-center justify-center transition-all shadow-sm border ${isListening
                ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-red-500/30 animate-pulse'
                : isInterpreting
                  ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                  : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-200 dark:hover:bg-indigo-800/50'
              }`}
          >
            {isInterpreting ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        )}
      </div>

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
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-[90] flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col gap-5 relative overflow-hidden border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-center">
              Datos Finales de Entrega
            </h3>

            <div className="space-y-5">
              {/* Kilometraje */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                   Kilometraje (Obligatorio)
                 </label>
                 <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Ej: 154000"
                      value={formData.mileage || ''}
                      onChange={e => setFormData(p => ({ ...p, mileage: e.target.value }))}
                      className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-center text-lg font-black text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 transition-colors"
                    />
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
                      className={`w-14 shrink-0 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${formData.photos?.odometer ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 hover:border-blue-400'}`}
                    >
                       <Camera className="w-5 h-5" />
                    </button>
                 </div>
                 {formData.photos?.odometer && (
                   <p className="text-[9px] font-black text-blue-500 uppercase mt-2 text-center">✅ Foto Odométro OK</p>
                 )}
              </div>

              {/* Combustible */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 text-center">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">
                   Nivel de Combustible
                 </label>
                 
                 <div className="flex justify-center gap-2 mb-4">
                    {['E', '1/4', '1/2', '3/4', 'F'].map(level => {
                       const fractionMap = { 'E': 0, '1/4': 0.25, '1/2': 0.5, '3/4': 0.75, 'F': 1 };
                       const val = fractionMap[level];
                       const isActive = formData.fuelLevel === val;
                       return (
                          <button 
                             key={level}
                             onClick={() => setFormData(p => ({ ...p, fuelLevel: val }))}
                             className={`w-10 h-10 rounded-full font-black text-xs border-2 transition-all ${isActive ? 'bg-purple-500 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-purple-300'}`}
                          >
                             {level}
                          </button>
                       )
                    })}
                 </div>

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
                    className={`w-full py-3 rounded-xl border-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${formData.photos?.fuelGauge
                        ? 'border-green-400 bg-green-500/10 text-green-500'
                        : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`}
                  >
                    <Camera className="w-4 h-4" />
                    {formData.photos?.fuelGauge ? '✅ Foto Tablero/Combustible OK (Cambiar)' : 'Tomar Foto Tablero/Combustible'}
                  </button>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowFinalModal(false)}
                className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wider"
              >
                Volver
              </button>
              <button
                onClick={() => {
                  if (!formData.mileage) return showAlert("⚠️ Ingresa el kilometraje final.");
                  if (!formData.photos?.odometer) return showAlert("⚠️ Toma la foto del kilometraje.");
                  if (formData.fuelLevel === undefined) return showAlert("⚠️ Selecciona el nivel de combustible.");
                  if (!formData.photos?.fuelGauge) return showAlert("⚠️ Toma la foto del medidor de combustible.");
                  handleSubmitFinal();
                }}
                className="flex-[2] py-3.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                Finalizar
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
