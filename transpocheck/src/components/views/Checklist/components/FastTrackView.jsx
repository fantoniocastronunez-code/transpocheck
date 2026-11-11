import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, FileText, DollarSign } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { StepSignature } from '../steps/StepSignature';
import { resizeImage } from '../../../../utils/helpers';
import { db } from '../../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const FastTrackView = ({ openCamera }) => {
  const { job, formData, setF, setFormData, uploadImageToStorage, showAlert, step, saveDraftToIndexedDB, persistStoragePhoto } = useChecklist();
  
  const [assignedAmount, setAssignedAmount] = useState(0);

  useEffect(() => {
    if (!job?.id || job.id === 'NEW_QUICK_JOB') return;
    const q = query(collection(db, 'expenses'), where('jobId', '==', job.id), where('type', '==', 'assignment'));
    getDocs(q).then(snap => {
      let total = 0;
      snap.forEach(doc => { total += Number(doc.data().amount) || 0; });
      setAssignedAmount(total);
    }).catch(console.error);
  }, [job?.id]);

  const isPintura = job?.isPintura || job?.isGrabado;
  const requeridas = isPintura ? ((job.qtyPintura || 0) + (job.qtyGrabado || 0)) : 1;

  const handlePic = async (eOrFile, id) => {
    const f = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (!f) return;
    try {
      const dataUrl = await resizeImage(f, 1920, 0.85);
      setFormData(prev => {
        const updated = { ...prev, photos: { ...(prev.photos || {}), [id]: dataUrl } };
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
        return updated;
      });

      if (job?.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        const storageUrl = await uploadImageToStorage(
          dataUrl,
          `checklists/${job.id}`,
          `quick_photo_${id}_${Date.now()}.jpg`
        );
        if (storageUrl) {
          setFormData(prev => {
            const updated = { ...prev, photos: { ...(prev.photos || {}), [id]: storageUrl } };
            if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
            return updated;
          });
          if (persistStoragePhoto) {
            persistStoragePhoto('photos', id, storageUrl);
          }
        }
      }
    } catch (err) {
      console.error("[ERR-FAST-TRACK-PHOTO-01]", err);
      showAlert("Error al procesar la foto [ERR-FAST-TRACK-PHOTO-01].");
    }
  };

  const handlePhotoClick = (id) => {
    if (formData.photos[id]) {
      const evt = new CustomEvent('openFullScreenImage', { detail: { url: formData.photos[id], id, label: `Foto ${id}` }});
      window.dispatchEvent(evt);
    } else {
      if(openCamera) {
        openCamera(`Evidencia ${id}`, f => handlePic(f, id), false);
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e) => handlePic(e, id);
        input.click();
      }
    }
  };

  React.useEffect(() => {
    const handleDelete = (e) => {
      const { id } = e.detail;
      setFormData(prev => {
        const updated = {
          ...prev,
          photos: { ...(prev.photos || {}), [id]: false }
        };
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
        return updated;
      });
      if (persistStoragePhoto) persistStoragePhoto('photos', id, false);
    };

    const handleRetake = (e) => {
      const { id, label } = e.detail;
      handleDelete(e);
      setTimeout(() => {
        if (openCamera) {
          openCamera(label || `Evidencia ${id}`, f => handlePic(f, id), false);
        } else {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.capture = 'environment';
          input.onchange = (ev) => handlePic(ev, id);
          input.click();
        }
      }, 150);
    };

    const handleRotate = (e) => {
      const { id, url: newUrl } = e.detail;
      if (!id || !newUrl) return;
      setFormData(prev => {
        const updated = {
          ...prev,
          photos: { ...(prev.photos || {}), [id]: newUrl }
        };
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
        return updated;
      });
      if (job?.id && job.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        uploadImageToStorage(
          newUrl,
          `checklists/${job.id}`,
          `quick_photo_${id}_${Date.now()}.jpg`
        ).then(storageUrl => {
          if (storageUrl) {
            setFormData(prev => {
              const updated = {
                ...prev,
                photos: { ...(prev.photos || {}), [id]: storageUrl }
              };
              if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
              return updated;
            });
            if (persistStoragePhoto) {
              persistStoragePhoto('photos', id, storageUrl);
            }
          }
        }).catch(err => {
          console.warn("[ERR-FAST-TRACK-ROTATE-UPLOAD]", err);
        });
      }
    };

    window.addEventListener('deleteImage', handleDelete);
    window.addEventListener('retakeImage', handleRetake);
    window.addEventListener('rotateImage', handleRotate);

    return () => {
      window.removeEventListener('deleteImage', handleDelete);
      window.removeEventListener('retakeImage', handleRetake);
      window.removeEventListener('rotateImage', handleRotate);
    };
  }, [setF, setFormData, formData.photos]);

  return (
    <div className="animate-in fade-in duration-150 pb-40">
      {step === 1 && (
        <div className="space-y-4 px-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
             <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
               <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Detalles del Servicio
             </h3>
             <textarea 
               className="w-full border border-slate-300 dark:border-slate-700 p-3.5 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-sky-600 bg-slate-50 dark:bg-slate-950 min-h-[120px] resize-none transition-colors" 
               placeholder="Anota cualquier detalle relevante, estado de la carga, personas que reciben, etc." 
               value={formData.observations || ''} 
               onChange={(e) => setF('observations', e.target.value)} 
             />
          </div>
          
          {/* Monto Asignado */}
          {assignedAmount > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider leading-none mb-1">
                    Fondo para este vehículo
                  </p>
                  <p className="text-lg font-bold font-mono text-emerald-900 dark:text-emerald-200 leading-none">
                    ${assignedAmount.toLocaleString('es-CL')}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 px-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
             <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-center">
               Registro Fotográfico
             </h3>
             <p className="text-xs font-medium text-slate-500 text-center mb-4">
               {isPintura 
                 ? `Debes subir al menos ${requeridas} fotos para los servicios solicitados.` 
                 : 'Sube una foto de respaldo (guía, vehículo, carga, etc).'}
             </p>

             <div className="grid grid-cols-2 gap-3">
               {Array.from({ length: Math.max(requeridas, Object.values(formData.photos || {}).filter(v => v).length + 1) }).map((_, i) => {
                 const id = `quick_${i+1}`;
                 const hasPic = !!formData.photos[id];
                 return (
                   <button 
                     key={id} 
                     type="button" 
                     onClick={() => handlePhotoClick(id)} 
                     className={`w-full h-32 rounded-lg border flex flex-col items-center justify-center cursor-pointer relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors
                     ${hasPic ? 'border-emerald-500' : 'border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                   >
                     {hasPic ? (
                       <>
                         <img src={formData.photos[id]} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                         <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400 relative z-10 bg-white dark:bg-slate-900 rounded-full" />
                       </>
                     ) : (
                       <>
                         <Camera className="w-5 h-5 text-slate-400 mb-1" />
                         <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">FOTO {i+1}</span>
                       </>
                     )}
                   </button>
                 );
               })}
             </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="px-4">
          <StepSignature />
        </div>
      )}
    </div>
  );
};
