import React from 'react';
import { Camera, CheckCircle } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { VehicleCroquis } from '../components/VehicleCroquis';
import { resizeImage } from '../../../../utils/helpers';

export const StepPhotos = ({ openCamera }) => {
  const { job, formData, setF, setFormData, uploadImageToStorage, showAlert } = useChecklist();

  const handlePic = async (eOrFile, id) => {
    const f = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (!f) return;
    try {
      const dataUrl = await resizeImage(f, 1920, 0.85);

      setFormData(prev => {
        const newData = { ...prev, photos: { ...prev.photos, [id]: dataUrl } };
        if (prev.pendingPin && prev.pendingPin.id === id) {
          newData.detailPins = [...(prev.detailPins || []), prev.pendingPin];
          newData.pendingPin = null;
        }
        return newData;
      });

      if (job?.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
        const storageUrl = await uploadImageToStorage(
          dataUrl,
          `checklists/${job.id}`,
          `photo_${id}_${Date.now()}.jpg`
        );
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

  const handlePhotoClick = (id, label, enableAnnotation = false) => {
    if (formData.photos[id]) {
      // In production, dispatch global event or context to open fullscreen view
      // For now we'll just alert or if we implement a FullScreenImage viewer later
      const evt = new CustomEvent('openFullScreenImage', { detail: { url: formData.photos[id], id, label }});
      window.dispatchEvent(evt);
    } else {
      if(openCamera) {
        openCamera(label, f => handlePic(f, id), enableAnnotation);
      } else {
        // Fallback for testing/desktop without openCamera prop properly passed
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
      setFormData(prev => ({
        ...prev,
        photos: { ...prev.photos, [id]: false },
        detailPins: (prev.detailPins || []).filter(p => p.id !== id)
      }));
    };

    const handleRetake = (e) => {
      const { id, label } = e.detail;
      handleDelete(e);
      setTimeout(() => {
        handlePhotoClick(id, label, true); // Assume retakes might need annotation, or pass from event
      }, 300); // Wait for modal to close
    };

    window.addEventListener('deleteImage', handleDelete);
    window.addEventListener('retakeImage', handleRetake);

    return () => {
      window.removeEventListener('deleteImage', handleDelete);
      window.removeEventListener('retakeImage', handleRetake);
    };
  }, [setFormData, formData.photos]);


  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header y Selector de Vehículo */}
      <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Croquis Pericial de Daños
        </h3>
        <select 
          value={formData.vehicleType || 'auto'} 
          onChange={e => setF('vehicleType', e.target.value)} 
          className="bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-[10px] font-bold p-2 rounded-xl outline-none text-slate-700 dark:text-slate-300 cursor-pointer max-w-[140px] focus:border-blue-500 transition-colors shadow-sm"
        >
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

      {/* Contenedor Interactivo Principal */}
      <div className="relative w-full max-w-[360px] mx-auto mt-8 mb-12 flex justify-center items-center">
        
        {/* El Croquis Extraído */}
        <VehicleCroquis handlePhotoClick={handlePhotoClick} />

      </div>

      {/* Otras Fotos (Extras) */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        {(() => {
          const extraPhotos = [
            { id: 'dashboard', l: 'Tablero' }, 
            { id: 'tire', l: 'Repuesto' }, 
            { id: 'interior_front', l: 'Int. Adelante' }, 
            { id: 'interior_back', l: 'Int. Atrás' }
          ];
          
          if (formData.client && formData.client.toLowerCase().includes('kovacs')) {
            extraPhotos.unshift({ id: 'vin', l: 'Número VIN (Oblig.)' });
          }
          
          return extraPhotos.map(p => (
            <button 
              type="button" 
              key={p.id} 
              onClick={() => handlePhotoClick(p.id, p.l)} 
              className={`w-full h-14 rounded-2xl border-2 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all 
              ${formData.photos[p.id] 
                ? 'border-green-400 ring-2 ring-green-100' 
                : (p.id === 'vin' 
                  ? 'border-dashed border-red-300 dark:border-red-700/50 hover:bg-red-50 dark:hover:bg-red-900/30' 
                  : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800')
              }`}
            >
              {formData.photos[p.id] ? (
                <>
                  <img src={formData.photos[p.id]} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  <CheckCircle className="w-5 h-5 text-green-500 relative z-10 bg-white dark:bg-slate-900 rounded-full" />
                  <span className="text-[10px] font-black text-green-800 dark:text-green-300 relative z-10">{p.l}</span>
                </>
              ) : (
                <>
                  <Camera className={`w-4 h-4 ${p.id === 'vin' ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-black uppercase ${p.id === 'vin' ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{p.l}</span>
                </>
              )}
            </button>
          ));
        })()}
      </div>

    </div>
  );
};
