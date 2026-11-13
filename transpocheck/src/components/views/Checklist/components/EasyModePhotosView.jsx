import { useEffect, useCallback, useRef } from 'react';
import { Camera, CheckCircle, Plus, Trash2, Car } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { resizeImage } from '../../../../utils/helpers';

const CORE_SLOTS = [
  { id: 'front', label: 'Frente del Vehículo' },
  { id: 'back', label: 'Parte Trasera' },
  { id: 'left', label: 'Lateral Izquierdo' },
  { id: 'right', label: 'Lateral Derecho' }
];

export const EasyModePhotosView = ({ openCamera }) => {
  const {
    job,
    formData,
    setFormData,
    uploadImageToStorage,
    showAlert,
    saveDraftToIndexedDB,
    persistStoragePhoto
  } = useChecklist();
  const jobId = job?.id;

  const clearPhoto = useCallback((id) => {
    if (!id) return;
    setFormData(prev => {
      const updated = {
        ...prev,
        photos: { ...(prev.photos || {}), [id]: false }
      };
      if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
      return updated;
    });
    if (persistStoragePhoto) {
      persistStoragePhoto('photos', id, false);
    }
  }, [setFormData, saveDraftToIndexedDB, persistStoragePhoto]);

  const handlePic = useCallback(async (eOrFile, id) => {
    const f = eOrFile?.target ? eOrFile.target.files?.[0] : eOrFile;
    if (!f) return;

    try {
      const dataUrl = await resizeImage(f, 1920, 0.85);
      setFormData(prev => {
        const updated = {
          ...prev,
          photos: { ...(prev.photos || {}), [id]: dataUrl }
        };
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
        return updated;
      });

      if (jobId && jobId !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        try {
          const storageUrl = await uploadImageToStorage(
            dataUrl,
            `checklists/${jobId}`,
            `easy_photo_${id}_${Date.now()}.jpg`
          );
          if (storageUrl) {
            setFormData(prev => {
              // Evitar restaurar si el usuario borró o reemplazó la foto mientras subía
              if (prev.photos?.[id] !== dataUrl) return prev;
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
        } catch (uploadErr) {
          console.warn('[ERR-EASY-UPLOAD-01] Subida diferida de foto en borrador local:', uploadErr);
        }
      }
    } catch (err) {
      console.error('[ERR-EASY-PHOTO-01] Error al procesar foto:', err);
      showAlert('❌ Error al procesar la foto [ERR-EASY-PHOTO-01].');
    }
  }, [jobId, setFormData, saveDraftToIndexedDB, uploadImageToStorage, persistStoragePhoto, showAlert]);

  const handlePicRef = useRef(handlePic);
  useEffect(() => {
    handlePicRef.current = handlePic;
  }, [handlePic]);

  const openCameraForSlot = useCallback((id, label) => {
    if (openCamera) {
      openCamera(label, (file) => handlePicRef.current(file, id), false);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => handlePicRef.current(e, id);
      input.click();
    }
  }, [openCamera]);

  const handlePhotoClick = (id, label) => {
    const existing = formData.photos?.[id];
    if (existing && typeof existing === 'string') {
      const evt = new CustomEvent('openFullScreenImage', {
        detail: { url: existing, id, label }
      });
      window.dispatchEvent(evt);
    } else {
      openCameraForSlot(id, label);
    }
  };

  useEffect(() => {
    const onDelete = (e) => {
      const { id } = e.detail || {};
      if (!id) return;
      clearPhoto(id);
    };

    const onRetake = (e) => {
      const { id, label } = e.detail || {};
      if (!id) return;
      clearPhoto(id);
      setTimeout(() => {
        openCameraForSlot(id, label || `Foto ${id}`);
      }, 150);
    };

    const onRotate = (e) => {
      const { id, url: newUrl } = e.detail || {};
      if (!id || !newUrl) return;
      setFormData(prev => {
        const updated = {
          ...prev,
          photos: { ...(prev.photos || {}), [id]: newUrl }
        };
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
        return updated;
      });
      if (jobId && jobId !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        uploadImageToStorage(
          newUrl,
          `checklists/${jobId}`,
          `easy_photo_${id}_${Date.now()}.jpg`
        )
          .then(storageUrl => {
            if (!storageUrl) return;
            setFormData(prev => {
              if (prev.photos?.[id] !== newUrl) return prev;
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
          })
          .catch(err => {
            console.error('[ERR-EASY-ROTATE-01] Error al subir foto rotada:', err);
          });
      }
    };

    window.addEventListener('deleteImage', onDelete);
    window.addEventListener('retakeImage', onRetake);
    window.addEventListener('rotateImage', onRotate);
    return () => {
      window.removeEventListener('deleteImage', onDelete);
      window.removeEventListener('retakeImage', onRetake);
      window.removeEventListener('rotateImage', onRotate);
    };
  }, [clearPhoto, openCameraForSlot, jobId, setFormData, saveDraftToIndexedDB, uploadImageToStorage, persistStoragePhoto]);

  const photosObj = formData.photos || {};
  const extraKeys = Object.keys(photosObj)
    .filter(k => k.startsWith('det') && typeof photosObj[k] === 'string' && photosObj[k].trim() !== '')
    .sort((a, b) => (parseInt(a.replace('det', ''), 10) || 0) - (parseInt(b.replace('det', ''), 10) || 0));

  const totalUploaded = [...CORE_SLOTS.map(s => s.id), ...extraKeys]
    .filter(k => typeof photosObj[k] === 'string' && photosObj[k].trim() !== '').length;

  const handleAddExtraPhoto = () => {
    let nextNum = 1;
    while (nextNum <= 30 && typeof photosObj[`det${nextNum}`] === 'string' && photosObj[`det${nextNum}`].trim() !== '') {
      nextNum += 1;
    }
    if (nextNum > 30) {
      showAlert('⚠️ Límite máximo de fotos adicionales alcanzado (30) [ERR-EASY-PHOTO-03].');
      return;
    }
    const nextKey = `det${nextNum}`;
    openCameraForSlot(nextKey, `Foto Adicional ${nextNum}`);
  };

  const vehicleTitle = job?.tripType === 'simple'
    ? (job?.description || 'Servicio en Terreno')
    : (`${job?.brand || ''} ${job?.model || ''}`.trim() || 'Vehículo');

  const ident = (job?.plate && job.plate !== 'S/N') ? job.plate : (job?.vin || 'Sin patente');

  return (
    <div className="px-4 pt-4 pb-8 max-w-2xl mx-auto space-y-5 animate-in fade-in duration-150">
      {/* Tarjeta resumen simple del vehículo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {vehicleTitle}
            </p>
            <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 truncate uppercase">
              {ident}{job?.client ? ` • ${job.client}` : ''}
            </p>
          </div>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
          totalUploaded > 0
            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        }`}>
          {totalUploaded} {totalUploaded === 1 ? 'foto' : 'fotos'}
        </span>
      </div>

      {/* Grilla principal de fotos del vehículo */}
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 px-0.5">
          Toca cada recuadro para tomar o subir la foto
        </h3>
        <div className="grid grid-cols-2 gap-3.5">
          {CORE_SLOTS.map(slot => {
            const imgSrc = typeof photosObj[slot.id] === 'string' && photosObj[slot.id].trim() !== '' ? photosObj[slot.id] : null;
            return (
              <div
                key={slot.id}
                className={`relative rounded-xl border-2 overflow-hidden transition-all min-h-[145px] flex flex-col ${
                  imgSrc
                    ? 'border-emerald-500 bg-slate-900 shadow-xs'
                    : 'border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-400'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handlePhotoClick(slot.id, slot.label)}
                  className="w-full h-full flex-1 flex flex-col items-center justify-center p-3 text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {imgSrc ? (
                    <>
                      <img
                        src={imgSrc}
                        alt={slot.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-2.5 py-2 flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{slot.label}</span>
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center mb-2">
                        <Camera className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                        {slot.label}
                      </span>
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                        Subir foto
                      </span>
                    </>
                  )}
                </button>
                {imgSrc && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearPhoto(slot.id);
                    }}
                    aria-label={`Eliminar foto ${slot.label}`}
                    title="Eliminar foto"
                    className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Fotos adicionales subidas */}
          {extraKeys.map((key, idx) => {
            const label = `Adicional ${idx + 1}`;
            const imgSrc = photosObj[key];
            return (
              <div
                key={key}
                className="relative rounded-xl border-2 border-emerald-500 bg-slate-900 overflow-hidden min-h-[145px] flex flex-col shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => handlePhotoClick(key, label)}
                  className="w-full h-full flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <img src={imgSrc} alt={label} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-2.5 py-2 flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{label}</span>
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearPhoto(key);
                  }}
                  aria-label={`Eliminar ${label}`}
                  title="Eliminar foto"
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botón para agregar fotos extra si se necesitan */}
      <button
        type="button"
        onClick={handleAddExtraPhoto}
        className="w-full min-h-[48px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        Agregar otra foto del vehículo
      </button>
    </div>
  );
};

export default EasyModePhotosView;
