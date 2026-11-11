import React, { useState } from 'react';
import { ArrowLeft, Loader2, Save, CheckCircle, Camera } from 'lucide-react';
import { ChecklistProvider, useChecklist } from './ChecklistContext';
import InAppCamera from '../../ui/InAppCamera';

import { TabsHeader } from './components/TabsHeader';
import { FastTrackView } from './components/FastTrackView';

import { StepData } from './steps/StepData';
import { StepDocs } from './steps/StepDocs';
import { StepNotes } from './steps/StepNotes';
import { StepPhotos } from './steps/StepPhotos';
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
    showAlert, showConfirm, onCancel, onComplete, syncFilesToStorage, clearLocalDraft, flushDraft,
    saveDraftToIndexedDB
  } = useChecklist();

  const handleExitChecklist = () => {
    try {
      if (saveDraftToIndexedDB) saveDraftToIndexedDB();
      if (flushDraft) {
        flushDraft().catch(e => console.warn('[ERR-CANCEL-FLUSH-01]', e));
      }
    } catch (e) {
      console.warn('[ERR-CANCEL-FLUSH-02]', e);
    }
    if (typeof onCancel === 'function') {
      onCancel();
    } else {
      window.location.href = '/';
    }
  };

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

  // Hooks instanciados centralmente en ChecklistContext

  const calculateProgress = () => {
    if (isSimple) {
      let simpleEarned = 0;
      const simpleTotal = 4;
      if (Object.values(formData.photos || {}).some(Boolean)) simpleEarned += 1;
      if ((formData.receiverName && String(formData.receiverName).trim() !== '') || formData.noReception) simpleEarned += 1;
      if ((formData.receiverRut && String(formData.receiverRut).trim() !== '') || formData.noReception) simpleEarned += 1;
      if (formData.signatureData || formData.clientSigned || formData.noReception) simpleEarned += 1;
      return Math.min(100, Math.round((simpleEarned / simpleTotal) * 100));
    }

    let earned = 0;
    let total = 0;

    // 1. Documentos (4 docs * 2 puntos = 8 puntos, si no es vehículo nuevo)
    if (!formData.isNewVehicle) {
      const checkDoc = (id) => {
        total += 2;
        if (formData.docs?.[id]) earned += 1;
        const hasExpiryOrPhoto = Boolean(
          (formData.docsExpiry?.[id] && String(formData.docsExpiry[id]).trim() !== '') ||
          formData.docsPhotos?.[id]
        );
        if (hasExpiryOrPhoto) earned += 1;
      };
      checkDoc('permiso');
      checkDoc('soap');
      checkDoc('revTecnica');
      checkDoc('gases');
    }

    // 2. Revisión (Kilometraje y Combustible) (2 puntos)
    const isTrailer = String(job?.vehicleType || formData.vehicleType || '').toLowerCase().includes('arrastre');
    if (!isTrailer) {
      total += 2;
      if (formData.mileage && String(formData.mileage).trim() !== '') earned += 1;
      if (formData.fuelLevel !== undefined && formData.fuelLevel !== null && formData.fuelLevel !== '') earned += 1;
    }

    // 3. Fotos del Vehículo
    const isCamion = Boolean(formData.vehicleType && formData.vehicleType.includes('camion'));
    const lateralPoints = isCamion ? 4 : 2;
    total += 2 + lateralPoints + 1 + 1; // Frente(1) + Atrás(1) + Laterales(2 o 4) + Interior(1) + Extra(1)

    // Frente y Atrás
    if (formData.photos?.front) earned += 1;
    if (formData.photos?.back) earned += 1;

    // Laterales (Soporta cabina+carrocería para camiones o laterales estándar)
    if (isCamion) {
      if (formData.photos?.left_cab || formData.photos?.left) earned += 1;
      if (formData.photos?.left_body || formData.photos?.left) earned += 1;
      if (formData.photos?.right_cab || formData.photos?.right) earned += 1;
      if (formData.photos?.right_body || formData.photos?.right) earned += 1;
    } else {
      if (formData.photos?.left || formData.photos?.left_cab) earned += 1;
      if (formData.photos?.right || formData.photos?.right_cab) earned += 1;
    }

    // Interior
    if (formData.photos?.interior_front || formData.photos?.interior_back) earned += 1;

    // Foto extra flexible (Repuesto, Interior atrás, VIN, pin de daño o vehículo sucio)
    const hasExtra = Boolean(
      formData.photos?.tire ||
      formData.photos?.interior_back ||
      formData.photos?.vin ||
      formData.isDirtyVehicle ||
      Object.keys(formData.photos || {}).some(k => k.startsWith('det') && formData.photos[k])
    );
    if (hasExtra) earned += 1;

    // 4. Firma / Recepción (3 puntos)
    total += 3;
    if (formData.noReception) {
      earned += 3;
    } else {
      if (formData.receiverName && String(formData.receiverName).trim() !== '') earned += 1;
      if (formData.receiverRut && String(formData.receiverRut).trim() !== '') earned += 1;
      if (formData.signatureData || formData.clientSigned || formData.signatureLocked) earned += 1;
    }

    if (total <= 0) return 100;
    return Math.min(100, Math.round((earned / total) * 100));
  };

  const handlePreSubmit = () => {
    if (job?.tripType === 'revision' && formData.rtStatus === 'pendiente') {
      return showAlert("⚠️ Debes registrar un resultado final para la Revisión Técnica antes de cerrar.");
    }

    const isGrandleasing = job?.client?.toLowerCase() === 'grandleasing' || formData.client?.toLowerCase() === 'grandleasing';
    const isTrailer = String(job?.vehicleType || formData.vehicleType || '').toLowerCase().includes('arrastre');

    if (isGrandleasing && !isTrailer) {
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

        const isTrailer = String(job?.vehicleType || formData.vehicleType || '').toLowerCase().includes('arrastre');
        const cleanedFormData = { ...formData };
        if (isTrailer) {
          cleanedFormData.mileage = '';
          cleanedFormData.fuelLevel = null;
        }

        const formDataWithLocation = { ...cleanedFormData, location: finalLocation || cleanedFormData.location };
        
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

        const saveVehicleDocs = async (finalData) => {
          try {
            let targetVehicle = matchedVehicle;
            const cleanIdent = String(finalData.plateOrVin || job?.plate || job?.vin || '').trim().toUpperCase();
            if (!targetVehicle && cleanIdent && cleanIdent !== 'S/N' && vehicles) {
              targetVehicle = vehicles.find(v => (v.plate && v.plate.toUpperCase() === cleanIdent) || (v.vin && v.vin.toUpperCase() === cleanIdent));
            }

            if (targetVehicle && targetVehicle.id) {
              await updateDoc(doc(db, 'vehicles', targetVehicle.id), {
                docs: finalData.docs || {},
                docsExpiry: finalData.docsExpiry || {},
                docsPhotos: finalData.docsPhotos || {}
              });
            } else if (cleanIdent && cleanIdent !== 'S/N') {
              await addDoc(collection(db, 'vehicles'), {
                plate: cleanIdent,
                brand: finalData.brand || job?.brand || '',
                model: finalData.model || job?.model || '',
                client: finalData.client || job?.client || '',
                vehicleType: finalData.vehicleType || 'auto',
                docs: finalData.docs || {},
                docsExpiry: finalData.docsExpiry || {},
                docsPhotos: finalData.docsPhotos || {},
                createdAt: Date.now(),
                tripsCount: 1,
                lastTripDate: Date.now()
              });
            }
          } catch (err) {
            console.error("[ERR-VEHICLE-DOCS-SAVE-01] Error guardando documentos en ficha del vehículo:", err);
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
          
          await saveVehicleDocs(finalData);
        } else {
          // Normal Job
          const updates = { phase: 'returning', 'draft.step': step };
          if (job.tripType === 'revision') {
            updates.prt_result = formDataWithLocation.rtStatus;
            updates.prt_reason = formDataWithLocation.rtRejectReason || '';
            if (formDataWithLocation.rtReturnOption) {
              const effectiveFinal = (formDataWithLocation.rtReturnOption === 'other' || formDataWithLocation.rtReturnOption === 'destination') ? (formDataWithLocation.rtReturnDestination || '') : job.origin;
              const prtPart = (job.destination || '').includes('->') ? job.destination.split('->')[0].trim() : (job.destination?.trim() || 'PRT');
              if (effectiveFinal) {
                updates.destination = `${prtPart} -> ${effectiveFinal}`;
              }
            }
          }
          
          // Guardar draft rápido
          const draftDataForFirestore = JSON.parse(JSON.stringify(formDataWithLocation));
          for (const key in draftDataForFirestore.photos) {
            if (typeof draftDataForFirestore.photos[key] === 'string' && !draftDataForFirestore.photos[key].startsWith('http')) draftDataForFirestore.photos[key] = false;
          }
          if (draftDataForFirestore.docsPhotos) {
            for (const key in draftDataForFirestore.docsPhotos) {
              if (typeof draftDataForFirestore.docsPhotos[key] === 'string' && !draftDataForFirestore.docsPhotos[key].startsWith('http')) {
                delete draftDataForFirestore.docsPhotos[key];
              }
            }
          }
          const base64Fields = ['signatureData', 'fuelReceipt', 'scandocPdf', 'guiaDespachoPdf'];
          base64Fields.forEach(field => {
            if (typeof draftDataForFirestore[field] === 'string' && !draftDataForFirestore[field].startsWith('http')) draftDataForFirestore[field] = false;
          });
          if (draftDataForFirestore.carDamages) {
            for (const zoneId in draftDataForFirestore.carDamages) {
              if (typeof draftDataForFirestore.carDamages[zoneId]?.photo === 'string' && !draftDataForFirestore.carDamages[zoneId].photo.startsWith('http')) {
                draftDataForFirestore.carDamages[zoneId] = { ...draftDataForFirestore.carDamages[zoneId], photo: false };
              }
            }
          }
          updates['draft.formData'] = draftDataForFirestore;
          try { await updateDoc(doc(db, 'transport_jobs', job.id), updates); } catch(e){}

          // Subir fotos
          const finalData = await syncFilesToStorage(formDataWithLocation, setProgress);
          
          const finalJobUpdates = {
            checklist: finalData, status: 'completed', completedAt: Date.now(), draft: null
          };
          if (job.tripType === 'revision' && finalData.rtReturnOption) {
            const effectiveFinal = (finalData.rtReturnOption === 'other' || finalData.rtReturnOption === 'destination') ? (finalData.rtReturnDestination || '') : job.origin;
            const prtPart = (job.destination || '').includes('->') ? job.destination.split('->')[0].trim() : (job.destination?.trim() || 'PRT');
            if (effectiveFinal) {
              finalJobUpdates.destination = `${prtPart} -> ${effectiveFinal}`;
            }
          }

          await updateDoc(doc(db, 'transport_jobs', job.id), finalJobUpdates);
          await processChecklistExpenses(finalData);

          await saveVehicleDocs(finalData);
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
      const syncTask = pushSyncTask(`Sync ${job?.plate || job?.vin || 'Vehículo'}`, { jobId: job?.id });
      showAlert(`✅ ¡Completaste el ${calculateProgress()}% del Checklist! Subida en 2do plano iniciada.`);
      onComplete();
      
      const setBgProgress = (prog) => {
        if (!prog) return;
        const msg = typeof prog === 'string' ? prog : (prog.text || (prog.total ? `Subiendo fotos (${prog.current}/${prog.total})` : 'Subiendo...'));
        if (syncTask?.updateProgress) syncTask.updateProgress(msg);
      };

      // Iniciar proceso sin await
      runBackgroundProcess(syncTask, setBgProgress);
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
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 flex flex-col h-[100dvh] overflow-hidden animate-in slide-in-from-bottom-full duration-200">

      {/* HEADER PRINCIPAL */}
      <div className="safe-top-header flex justify-between items-center bg-white dark:bg-slate-900 px-4 pb-3 sm:pb-4 shadow-xs relative z-50 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={handleExitChecklist}
          className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 p-2 sm:p-2.5 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
          title="Volver a los traslados"
        >
          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div className="text-center flex-1 mx-2 overflow-hidden">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {isQuick ? 'Checklist Rápido' : 'Checklist Digital'}
          </h2>
          {!isQuick && (
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate font-mono">
              {job?.plate || job?.vin || 'Vehículo'} • {job?.client || 'Cliente'}
            </p>
          )}
        </div>

      </div>

      {/* BARRA DE PROGRESO */}
      {!isSimple && (
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Progreso del Checklist</span>
            <span className="text-[10px] font-bold font-mono text-sky-600 dark:text-sky-400">{calculateProgress()}% Completado</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-sky-600 h-1.5 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${calculateProgress()}%` }}
            ></div>
          </div>
        </div>
      )}

      <TabsHeader />

      {/* CONTENIDO DESLIZABLE */}
      <div className="flex-1 overflow-y-auto pb-[calc(11rem+env(safe-area-inset-bottom,0px))] scroll-smooth">
        {isSimple ? (
          <FastTrackView openCamera={openCamera} />
        ) : (
          <div className="px-4 animate-in fade-in duration-150">
            {step === 1 && <StepData />}
            {step === 2 && <StepDocs openCamera={openCamera} />}
            {step === 3 && <StepNotes />}
            {step === 4 && <StepPhotos openCamera={openCamera} />}
            {step === 5 && <StepSignature />}
          </div>
        )}
      </div>

      {/* BARRA INFERIOR (NAVEGACIÓN Y GUARDAR) */}
      <div className="safe-bottom-bar absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 flex flex-col gap-2.5">

        <div className="flex gap-2.5">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || isSubmitting}
            className={`flex-1 font-bold py-2.5 rounded-lg border flex items-center justify-center gap-2 uppercase tracking-wider text-xs sm:text-sm transition-colors ${step === 1 || isSubmitting
                ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <button
            onClick={() => setStep(Math.min(isSimple ? 3 : 5, step + 1))}
            disabled={step === (isSimple ? 3 : 5) || isSubmitting}
            className={`flex-1 font-bold py-2.5 rounded-lg border flex items-center justify-center gap-2 uppercase tracking-wider text-xs sm:text-sm transition-colors ${step === (isSimple ? 3 : 5) || isSubmitting
                ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40'
              }`}
          >
            Siguiente <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>

        <button
          onClick={handlePreSubmit}
          disabled={isSubmitting}
          className={`w-full font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 uppercase tracking-wider text-xs sm:text-sm transition-colors ${isSubmitting
              ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
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
        <div className="absolute inset-0 bg-slate-950/85 z-[90] flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-full max-w-sm flex flex-col relative overflow-hidden border border-slate-800 pb-6">

            <h3 className="text-base font-bold text-white mb-5 mt-1 tracking-tight text-center">
              Combustible y Kilometraje
            </h3>

            <div className="space-y-5 relative z-10 flex-1">
              {/* Odómetro */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1 px-2">
                   <label className="text-xs text-slate-300 font-medium">Odómetro Actual</label>
                   <span className="text-xs text-slate-500 font-mono">Km</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.mileage || ''}
                    onChange={e => setFormData(p => ({ ...p, mileage: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-lg text-center text-2xl font-bold font-mono text-white outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-1.5 font-medium uppercase tracking-wider">Ingresa el Kilometraje</p>
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
                    onPointerCancel={() => { setIsDraggingFuel(false); }}
                 >
                    {/* Fondo del arco */}
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                    
                    {/* Arco sólido */}
                    <path 
                      d="M 20 100 A 80 80 0 0 1 180 100" 
                      fill="none" 
                      stroke="#0284c7" 
                      strokeWidth="12" 
                      strokeLinecap="round" 
                      strokeDasharray={`${Math.PI * 80 * fuelDec} ${Math.PI * 80}`}
                      style={{ transition: isDraggingFuel ? 'none' : 'stroke-dasharray 0.2s ease-out' }}
                    />

                    {/* Aguja */}
                    <g transform={`translate(100, 100) rotate(${-90 + (fuelDec * 180)})`} style={{ transition: isDraggingFuel ? 'none' : 'transform 0.2s ease-out' }}>
                      <circle cx="0" cy="0" r="8" fill="#0284c7" />
                      <circle cx="0" cy="0" r="4" fill="#0f172a" />
                      <path d="M -3 -8 L 0 -65 L 3 -8 Z" fill="#0284c7" />
                    </g>

                    {/* Textos centrales */}
                    <text x="100" y="65" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
                      {fuelDec === 0 ? 'Vacío' : fuelDec === 1 ? 'Full' : `${Math.round(fuelDec * 100)}%`}
                    </text>
                    <text x="100" y="80" textAnchor="middle" fill="#64748b" fontSize="10">nivel</text>
                    
                    <text x="15" y="115" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">E</text>
                    <text x="185" y="115" textAnchor="middle" fill="#10b981" fontSize="12" fontWeight="bold">F</text>
                 </svg>
                 );})()}
              </div>

              {/* Botones de fotos */}
              <div className="flex flex-col gap-2.5 mt-4">
                <button
                   type="button"
                   onClick={() => openCamera('Kilometraje', async f => {
                      setProcessingAction('Procesando Foto...');
                      setIsSubmitting(true);
                      try {
                        const { resizeImage } = await import('../../../utils/helpers');
                        const compressed = await resizeImage(f, 1200, 0.6);
                        setFormData(p => ({ ...p, photos: { ...p.photos, odometer: compressed } }));
                        setIsSubmitting(false);
                        setProcessingAction(null);
                      } catch (e) {
                        console.error("[ERR-FINAL-ODO-01] Error foto odómetro:", e);
                        setIsSubmitting(false);
                        setProcessingAction(null);
                        showAlert("Error al procesar la foto [ERR-FINAL-ODO-01].");
                      }
                   })}
                   className={`relative overflow-hidden w-full py-3 rounded-lg flex items-center justify-center gap-2 border transition-colors ${formData.photos?.odometer ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                >
                   <Camera className="w-4 h-4" />
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
                        setFormData(p => ({ ...p, photos: { ...p.photos, fuelGauge: compressed } }));
                        setIsSubmitting(false);
                        setProcessingAction(null);
                      } catch (e) {
                        console.error("[ERR-FINAL-FUEL-01] Error foto combustible:", e);
                        setIsSubmitting(false);
                        setProcessingAction(null);
                        showAlert("Error al procesar la foto [ERR-FINAL-FUEL-01].");
                      }
                   })}
                   className={`relative overflow-hidden w-full py-3 rounded-lg flex items-center justify-center gap-2 border transition-colors ${formData.photos?.fuelGauge ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                >
                   <Camera className="w-4 h-4" />
                   <span className="text-xs font-bold tracking-wider uppercase">
                      {formData.photos?.fuelGauge ? 'Foto Recibo/Tablero (OK)' : 'Subir Foto Recibo'}
                   </span>
                </button>
              </div>

            </div>

            {/* Navegación inferior */}
            <div className="flex justify-between items-center mt-6 relative z-10 px-2">
              <button
                onClick={() => setShowFinalModal(false)}
                className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                 <div className="w-2 h-2 rounded-full bg-sky-500"></div>
              </div>

              <button
                onClick={() => {
                  const isTrailer = String(job?.vehicleType || formData.vehicleType || '').toLowerCase().includes('arrastre');
                  if (!isTrailer) {
                    if (!formData.mileage) return showAlert("⚠️ Ingresa el kilometraje final.");
                    if (!formData.photos?.odometer) return showAlert("⚠️ Toma la foto del kilometraje.");
                    if (formData.fuelLevel === undefined) return showAlert("⚠️ Selecciona el nivel de combustible.");
                    if (!formData.photos?.fuelGauge) return showAlert("⚠️ Toma la foto del medidor de combustible.");
                  }
                  handleSubmitFinal();
                }}
                className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Overlay de Carga Principal */}
      {uploadProgress.active && (
        <div className="absolute inset-0 bg-slate-950/80 z-[100] flex flex-col items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col items-center max-w-xs w-full">
            <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-4" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1">Sincronizando</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium text-center mb-4">{uploadProgress.text}</p>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-sky-600 transition-all duration-200" style={{ width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%` }} />
            </div>
            <p className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400 mt-2">{uploadProgress.current} de {uploadProgress.total}</p>
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
    </ChecklistProvider>
  );
};

export default ChecklistForm;
