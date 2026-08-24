import React, { useState } from 'react';
import { ArrowLeft, Mic, Loader2, Save } from 'lucide-react';
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
  const { syncFilesToStorage } = useChecklistSync({
    job, isQuick, formData, setFormData, step, setStep, setIsDraftLoaded, 
    defaultData, matchedVehicle, drivers, currentUserEmail, uploadImageToStorage, pushSyncTask, showAlert
  });

  const { isListening, isInterpreting, toggleVoiceAssistant } = useVoiceAssistant(formData, (f, v) => setFormData(p => ({ ...p, [f]: v })), showAlert);

  const handlePreSubmit = () => {
    if (job?.tripType === 'revision' && formData.rtStatus === 'pendiente') {
      return showAlert("⚠️ Debes registrar un resultado final para la Revisión Técnica antes de cerrar.");
    }

    setShowFinalModal(true);
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
    setProcessingAction('Guardando e iniciando sincronización...');

    try {
      if (isQuick) {
        // Ejecución Rápida
        const finalData = await syncFilesToStorage(formData, setUploadProgress);
        setProcessingAction('Enviando datos al servidor...');
        
        const driverObj = drivers?.find(d => d.email === currentUserEmail) || { name: currentUserEmail };
        
        await setDoc(doc(db, 'transport_jobs', `quick_${Date.now()}`), {
          status: 'completed',
          client: finalData.client === 'OTRO' ? finalData.manualClient : finalData.client,
          brand: finalData.brand || 'S/N',
          model: finalData.model || 'S/N',
          plate: finalData.plateOrVin || 'S/N',
          origin: finalData.origin || 'Origen Desconocido',
          destination: finalData.destination || 'Destino Desconocido',
          driverEmail: currentUserEmail,
          driverName: driverObj.name,
          createdAt: Date.now(),
          completedAt: Date.now(),
          checklist: finalData,
          tripType: 'simple'
        });

        showAlert("✅ Checklist Quick Guardado y Completado.");
        onComplete();
        return;
      }

      // Proceso Normal / Segundo Plano
      const updates = { phase: 'returning', 'draft.step': step };
      
      if (job.tripType === 'revision') {
        updates.prt_result = formData.rtStatus;
        updates.prt_reason = formData.rtRejectReason || '';
      }

      const draftData = JSON.parse(JSON.stringify(formData));
      updates['draft.formData'] = draftData;
      
      await updateDoc(doc(db, 'transport_jobs', job.id), updates);
      
      // Función para procesar y descontar gastos automáticamente
      const processChecklistExpenses = async (finalData) => {
        const driverObj = drivers?.find(d => d.email === currentUserEmail);
        if (!driverObj || !driverObj.id) return;
        
        let newBalance = driverObj.balance || 0;
        
        // Gasto de Combustible
        if (finalData.hasFuelCharge && finalData.fuelChargeAmount > 0) {
          await addDoc(collection(db, 'expenses'), {
            driverId: driverObj.id,
            driverEmail: driverObj.email,
            driverName: driverObj.name,
            type: 'expense',
            amount: Number(finalData.fuelChargeAmount),
            detail: 'Carga de combustible (Auto-generado desde Checklist)',
            jobId: job.id,
            deductedAmount: Number(finalData.fuelChargeAmount),
            receiptImage: finalData.fuelReceipt || null,
            createdAt: Date.now()
          });
          newBalance -= Number(finalData.fuelChargeAmount);
        }

        // Gastos PRT
        if (job.tripType === 'revision') {
          const prtTotal = (Number(finalData.prtCostRevision)||0) + (Number(finalData.prtCostInspeccion)||0) + (Number(finalData.prtCostFrenos)||0) + (Number(finalData.prtCostGases)||0);
          if (prtTotal > 0) {
            await addDoc(collection(db, 'expenses'), {
              driverId: driverObj.id,
              driverEmail: driverObj.email,
              driverName: driverObj.name,
              type: 'expense',
              amount: prtTotal,
              detail: 'Trámite PRT (Auto-generado desde Checklist)',
              jobId: job.id,
              deductedAmount: prtTotal,
              receiptImage: null, // PRT no requiere boleta según cliente
              createdAt: Date.now()
            });
            newBalance -= prtTotal;
          }
        }

        // Si el balance cambió, actualizar al conductor
        if (newBalance !== (driverObj.balance || 0)) {
          await updateDoc(doc(db, 'drivers', driverObj.id), { balance: newBalance });
        }
      };

      // Lanzar Sync en Background
      if (pushSyncTask) {
        const syncTask = pushSyncTask(`Sync ${job.plate || job.vin || 'Vehículo'}`);
        showAlert("✅ Subida iniciada en segundo plano. Puedes continuar usando la app.");
        onComplete();
        
        // Ejecutar en segundo plano sin await
        (async () => {
          try {
            const finalData = await syncFilesToStorage(draftData, () => {});
            await updateDoc(doc(db, 'transport_jobs', job.id), {
              checklist: finalData,
              status: 'completed',
              completedAt: Date.now(),
              draft: null // Borrar draft
            });
            await processChecklistExpenses(finalData);
            syncTask.finish();
          } catch (e) {
            console.error("Error en background sync:", e);
            syncTask.error(e);
          }
        })();
      } else {
        // Fallback sincrónico si no existe el hook de background
        const finalData = await syncFilesToStorage(draftData, setUploadProgress);
        await updateDoc(doc(db, 'transport_jobs', job.id), {
          checklist: finalData,
          status: 'completed',
          completedAt: Date.now(),
          draft: null // Borrar draft
        });
        await processChecklistExpenses(finalData);
        showAlert("✅ Checklist Guardado Correctamente.");
        onComplete();
      }
    } catch (err) {
      console.error(err);
      showAlert("❌ Error al guardar: " + err.message);
    } finally {
      setIsSubmitting(false);
      setProcessingAction(null);
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
            className={`p-2 sm:p-2.5 rounded-xl flex items-center justify-center transition-all shadow-sm border ${
              isListening 
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
            {step === 2 && <StepDocs />}
            {step === 3 && <StepNotes />}
            {step === 4 && <StepPhotos openCamera={openCamera} />}
            {step === 5 && <StepFuel openCamera={openCamera} />}
            {step === 6 && <StepSignature />}
          </div>
        )}
      </div>

      {/* BARRA INFERIOR (NAVEGACIÓN Y GUARDAR) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/50 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-50 flex flex-col gap-3">
        
        {/* BOTONES DE NAVEGACIÓN */}
        <div className="flex gap-3">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || isSubmitting}
            className={`flex-1 font-black py-3 rounded-2xl border-2 flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 ${
              step === 1 || isSubmitting
                ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <button
            onClick={() => setStep(Math.min(isSimple ? 3 : 6, step + 1))}
            disabled={step === (isSimple ? 3 : 6) || isSubmitting}
            className={`flex-1 font-black py-3 rounded-2xl border-2 flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 ${
              step === (isSimple ? 3 : 6) || isSubmitting
                ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
            }`}
          >
            Siguiente <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>

        <button 
          onClick={handleSubmitFinal} 
          disabled={isSubmitting} 
          className={`w-full font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 ${
            isSubmitting 
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
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col gap-5 relative overflow-hidden">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-center border-b border-slate-100 dark:border-slate-800 pb-3">Datos Finales</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Kilometraje / Odómetro</label>
                <input 
                  type="number" 
                  placeholder="Ej: 154000" 
                  value={formData.mileage || ''} 
                  onChange={e => setFormData(p => ({ ...p, mileage: e.target.value }))}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Foto Odómetro (Opcional)</label>
                <button 
                  type="button" 
                  onClick={() => openCamera('Odómetro', f => {
                    const reader = new FileReader();
                    reader.onload = () => setFormData(p => ({ ...p, photos: { ...p.photos, mileage: reader.result } }));
                    reader.readAsDataURL(f);
                  })}
                  className={`w-full h-14 rounded-2xl border-2 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden transition-all ${formData.photos?.mileage ? 'border-green-400 ring-2 ring-green-100 bg-white dark:bg-slate-900' : 'border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 bg-transparent'}`}
                >
                  {formData.photos?.mileage ? (
                    <>
                      <img src={formData.photos.mileage} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                      <span className="text-[10px] font-black text-green-800 dark:text-green-300 relative z-10">Foto OK</span>
                    </>
                  ) : (
                    <span className="text-[10px] font-black text-slate-500 uppercase">Tomar Foto</span>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Ubicación de Llaves</label>
                <select 
                  value={formData.keyLocation || ''} 
                  onChange={e => setFormData(p => ({ ...p, keyLocation: e.target.value }))}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                  <option value="">Seleccione...</option>
                  <option value="puestas">Puestas en vehículo</option>
                  <option value="puerta">En la puerta/guantera</option>
                  <option value="mano">Entregadas en mano</option>
                  <option value="buzon">Dejadas en buzón</option>
                </select>
              </div>

              {formData.keyLocation === 'mano' && (
                <div className="space-y-2 animate-in slide-in-from-top-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">¿A quién?</label>
                  <input 
                    type="text" 
                    placeholder="Nombre de la persona" 
                    value={formData.keyHandedTo || ''} 
                    onChange={e => setFormData(p => ({ ...p, keyHandedTo: e.target.value }))}
                    className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowFinalModal(false)} className="flex-1 py-3.5 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Volver</button>
              <button onClick={handleSubmitFinal} className="flex-[2] py-3.5 rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">Confirmar <Save className="w-4 h-4" /></button>
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
