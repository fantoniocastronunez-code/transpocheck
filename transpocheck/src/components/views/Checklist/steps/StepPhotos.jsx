import React from 'react';
import { Camera, CheckCircle, RotateCw } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { VehicleCroquis } from '../components/VehicleCroquis';
import { resizeImage, rotateImage90Degrees } from '../../../../utils/helpers';

export const StepPhotos = ({ openCamera }) => {
  const { job, formData, setF, setFormData, uploadImageToStorage, showAlert, saveDraftToIndexedDB, persistStoragePhoto } = useChecklist();

  const handlePic = async (eOrFile, id) => {
    const f = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (!f) return;
    try {
      const dataUrl = await resizeImage(f, 1024, 0.6);

      setFormData(prev => {
        const newData = { ...prev, photos: { ...prev.photos, [id]: dataUrl } };
        if (prev.pendingPin && prev.pendingPin.id === id) {
          newData.detailPins = [...(prev.detailPins || []), prev.pendingPin];
          newData.pendingPin = null;
        }
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(newData);
        return newData;
      });

      if (job?.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        const storageUrl = await uploadImageToStorage(
          dataUrl,
          `checklists/${job.id}`,
          `photo_${id}_${Date.now()}.jpg`
        );
        if (storageUrl) {
          setFormData(prev => {
            const updated = {
              ...prev,
              photos: { ...prev.photos, [id]: storageUrl }
            };
            if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
            return updated;
          });
          if (persistStoragePhoto) {
            persistStoragePhoto('photos', id, storageUrl);
          }
        }
      }
    } catch (err) {
      console.error("[ERR-PHOTO-PROCESS-01] Error al procesar la foto:", err);
      showAlert("Error al procesar la foto. Intenta con una imagen más pequeña. [ERR-PHOTO-PROCESS-01]");
    }
  };

  const triggerCamera = (id, label, enableAnnotation = false) => {
    if (openCamera) {
      openCamera(label, f => handlePic(f, id), enableAnnotation);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => handlePic(e, id);
      input.click();
    }
  };

  const handlePhotoClick = (id, label, enableAnnotation = false) => {
    if (formData.photos[id]) {
      const evt = new CustomEvent('openFullScreenImage', { detail: { url: formData.photos[id], id, label }});
      window.dispatchEvent(evt);
    } else {
      triggerCamera(id, label, enableAnnotation);
    }
  };

  const handleRotateInline = async (id) => {
    const currentUrl = formData.photos[id];
    if (!currentUrl) return;
    try {
      const rotated = await rotateImage90Degrees(currentUrl);
      const evt = new CustomEvent('rotateImage', { detail: { id, url: rotated } });
      window.dispatchEvent(evt);
    } catch (err) {
      console.error("[ERR-PHOTO-ROTATE-INLINE] Error al rotar imagen:", err);
    }
  };

  React.useEffect(() => {
    const handleDelete = (e) => {
      const { id } = e.detail;
      setFormData(prev => {
        const updated = {
          ...prev,
          photos: { ...prev.photos, [id]: false },
          detailPins: (prev.detailPins || []).filter(p => p.id !== id)
        };
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
        return updated;
      });
      if (persistStoragePhoto) persistStoragePhoto('photos', id, false);
    };

    const handleRetake = (e) => {
      const { id, label } = e.detail;
      const isDetail = typeof id === 'string' && id.startsWith('det');

      // 1. Limpiar foto previa
      setFormData(prev => ({
        ...prev,
        photos: { ...prev.photos, [id]: false }
      }));

      // 2. Abrir inmediatamente la cámara sin verificar si ya existía
      setTimeout(() => {
        triggerCamera(id, label || 'Fotografiar', isDetail);
      }, 150);
    };

    const handleRotate = async (e) => {
      const { id, url: newUrl } = e.detail;
      if (!id || !newUrl) return;

      setFormData(prev => {
        const updated = {
          ...prev,
          photos: { ...prev.photos, [id]: newUrl }
        };
        if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
        return updated;
      });

      if (job?.id && job.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        try {
          const storageUrl = await uploadImageToStorage(
            newUrl,
            `checklists/${job.id}`,
            `photo_${id}_${Date.now()}.jpg`
          );
          if (storageUrl) {
            setFormData(prev => {
              const updated = {
                ...prev,
                photos: { ...prev.photos, [id]: storageUrl }
              };
              if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
              return updated;
            });
            if (persistStoragePhoto) {
              persistStoragePhoto('photos', id, storageUrl);
            }
          }
        } catch (upErr) {
          console.warn("[ERR-PHOTO-ROTATE-UPLOAD] Falló subir foto rotada a Storage:", upErr);
        }
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
  }, [setFormData, openCamera, job, uploadImageToStorage]);


  return (
    <div className="space-y-4 animate-in fade-in duration-150 pt-3">
      
      {/* Vehiculo Sucio Checkbox */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-2">
        <label className="flex items-start gap-3 cursor-pointer group bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors">
          <div className="relative flex items-center justify-center mt-0.5">
            <input 
              type="checkbox" 
              checked={formData.isDirtyVehicle || false}
              onChange={e => setF('isDirtyVehicle', e.target.checked)}
              className="appearance-none w-5 h-5 border border-amber-400 dark:border-amber-700 rounded-md checked:bg-amber-600 checked:border-amber-600 transition-colors cursor-pointer"
            />
            {formData.isDirtyVehicle && <CheckCircle className="w-3.5 h-3.5 text-white absolute pointer-events-none" />}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300">Vehículo sucio</span>
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400/90 mt-0.5 leading-tight">Al marcar esto aceptas que puede incluir rayas, piquetes o daños que no se muestren en las fotos.</span>
          </div>
        </label>
      </div>

      {/* Header y Selector de Vehículo */}
      <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-2">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Croquis Pericial de Daños
        </h3>
        <select 
          value={formData.vehicleType || 'auto'} 
          onChange={e => setF('vehicleType', e.target.value)} 
          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold p-2.5 rounded-lg outline-none text-slate-800 dark:text-slate-200 cursor-pointer w-full focus:border-sky-600 transition-colors"
        >
          <option value="auto">Auto / SUV</option>
          <option value="camioneta">Camioneta</option>
          <option value="furgon_pequeno">Furgón Peq.</option>
          <option value="furgon_grande">Furgón Grande</option>
          <option value="camion">Camión Simple</option>
          <option value="camion_doble">Camión Doble Cab.</option>
          <option value="camion_2ejes">Camión (2 Ejes)</option>
          <option value="camion_3ejes">Camión (3 Ejes)</option>
          <option value="camion_8x4">Camión Rígido (8x4)</option>
          <option value="carro_arrastre">Carro Arrastre</option>
          <option value="maquinaria">Maquinaria</option>
        </select>
      </div>

      {/* Contenedor Interactivo Principal */}
      <div className="relative w-full max-w-[360px] mx-auto mt-4 mb-0 flex justify-center items-center">
        
        {/* El Croquis Extraído */}
        <VehicleCroquis handlePhotoClick={handlePhotoClick} />

      </div>

      {/* Otras Fotos (Extras) */}
      <div className="grid grid-cols-2 gap-3 mt-0 pt-4 border-t border-slate-200 dark:border-slate-800">
        {(() => {
          const extraPhotos = [
            { id: 'tire', l: 'Repuesto' }, 
            { id: 'interior_front', l: 'Int. Adelante' }, 
            { id: 'interior_back', l: 'Int. Atrás' }
          ];
          
          if (formData.client && formData.client.toLowerCase().includes('kovacs')) {
            extraPhotos.unshift({ id: 'vin', l: 'Número VIN (Oblig.)' });
          }
          
          return extraPhotos.map(p => (
            <div 
              key={p.id} 
              className={`w-full h-14 rounded-lg border flex items-center justify-between px-3 cursor-pointer relative overflow-hidden bg-white dark:bg-slate-900 transition-colors 
              ${formData.photos[p.id] 
                ? 'border-emerald-500' 
                : (p.id === 'vin' 
                  ? 'border-dashed border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/30' 
                  : 'border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')
              }`}
            >
              {formData.photos[p.id] ? (
                <>
                  <img 
                    src={formData.photos[p.id]} 
                    className="absolute inset-0 w-full h-full object-cover opacity-25 cursor-pointer" 
                    onClick={() => handlePhotoClick(p.id, p.l)}
                    alt=""
                  />
                  <div 
                    className="flex items-center gap-1.5 flex-1 truncate z-10 mr-1 cursor-pointer"
                    onClick={() => handlePhotoClick(p.id, p.l)}
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 bg-white dark:bg-slate-900 rounded-full" />
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 truncate">{p.l}</span>
                  </div>
                  <button
                    type="button"
                    title="Girar imagen 90°"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotateInline(p.id);
                    }}
                    className="relative z-20 w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div 
                  onClick={() => handlePhotoClick(p.id, p.l)}
                  className="w-full h-full flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className={`w-4 h-4 ${p.id === 'vin' ? 'text-red-500' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-bold uppercase ${p.id === 'vin' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{p.l}</span>
                </div>
              )}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};
