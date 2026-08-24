import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, FileText, DollarSign } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { StepSignature } from '../steps/StepSignature';
import { resizeImage } from '../../../../utils/helpers';
import { db } from '../../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const FastTrackView = ({ openCamera }) => {
  const { job, formData, setF, setFormData, uploadImageToStorage, showAlert, step } = useChecklist();
  
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
      setF('photos', { ...formData.photos, [id]: dataUrl });

      if (job?.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        const storageUrl = await uploadImageToStorage(
          dataUrl,
          `checklists/${job.id}`,
          `quick_photo_${id}_${Date.now()}.jpg`
        );
        setF('photos', { ...formData.photos, [id]: storageUrl });
      }
    } catch (err) {
      console.error(err);
      showAlert("Error al procesar la foto.");
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
      // In fast track, detailPins are not used much, but we clear the photo
      setFormData?.(prev => ({
        ...prev,
        photos: { ...prev.photos, [id]: false }
      }));
      // fallback if setFormData isn't extracted
      if (!setFormData) {
        setF('photos', { ...formData.photos, [id]: false });
      }
    };

    const handleRetake = (e) => {
      const { id } = e.detail;
      handleDelete(e);
      setTimeout(() => {
        handlePhotoClick(id);
      }, 300);
    };

    window.addEventListener('deleteImage', handleDelete);
    window.addEventListener('retakeImage', handleRetake);

    return () => {
      window.removeEventListener('deleteImage', handleDelete);
      window.removeEventListener('retakeImage', handleRetake);
    };
  }, [setF, setFormData, formData.photos]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-24">
      {step === 1 && (
        <div className="space-y-4 px-4">
          <div className="bg-purple-50/50 dark:bg-purple-900/10 p-5 rounded-3xl border border-purple-200/50 dark:border-purple-800/30 shadow-sm space-y-3">
             <h3 className="text-[11px] font-black text-purple-800 dark:text-purple-300 uppercase tracking-widest flex items-center gap-2">
               <FileText className="w-4 h-4" /> Detalles del Servicio
             </h3>
             <textarea 
               className="w-full border-2 border-purple-200 dark:border-purple-800/50 p-4 rounded-2xl text-sm font-bold text-purple-900 dark:text-purple-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900 shadow-inner min-h-[120px] resize-none transition-colors" 
               placeholder="Anota cualquier detalle relevante, estado de la carga, personas que reciben, etc." 
               value={formData.observations || ''} 
               onChange={(e) => setF('observations', e.target.value)} 
             />
          </div>
          
          {/* Monto Asignado */}
          {assignedAmount > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-3xl border border-emerald-200/60 dark:border-emerald-800/60 shadow-sm flex items-center justify-between animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-widest leading-none mb-1">
                    Fondo para este vehículo
                  </p>
                  <p className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 leading-none">
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
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
             <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-center">
               Registro Fotográfico
             </h3>
             <p className="text-[11px] font-bold text-slate-500 text-center mb-4">
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
                     className={`w-full h-32 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 transition-all active:scale-95
                     ${hasPic ? 'border-purple-400 ring-2 ring-purple-100' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                   >
                     {hasPic ? (
                       <>
                         <img src={formData.photos[id]} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                         <CheckCircle className="w-8 h-8 text-purple-500 relative z-10 bg-white dark:bg-slate-900 rounded-full" />
                       </>
                     ) : (
                       <>
                         <Camera className="w-6 h-6 text-slate-400 mb-1" />
                         <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wider">FOTO {i+1}</span>
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
