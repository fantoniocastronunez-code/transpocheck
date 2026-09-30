import React, { useState } from 'react';
import { Camera, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';

// Simple SVG Car shape for interaction
const CarDiagram = ({ damages, onZoneClick }) => {
  const zones = [
    { id: 'frontal', label: 'Frente', classes: 'top-0 left-1/2 -translate-x-1/2 w-32 h-16 rounded-t-3xl border-b-0' },
    { id: 'trasero', label: 'Atrás', classes: 'bottom-0 left-1/2 -translate-x-1/2 w-32 h-16 rounded-b-3xl border-t-0' },
    { id: 'lateral_izq', label: 'Lat. Izq', classes: 'top-16 bottom-16 left-0 w-12 border-r-0 rounded-l-xl flex items-center justify-center' },
    { id: 'lateral_der', label: 'Lat. Der', classes: 'top-16 bottom-16 right-0 w-12 border-l-0 rounded-r-xl flex items-center justify-center' },
    { id: 'techo', label: 'Techo', classes: 'top-16 bottom-16 left-12 right-12 flex items-center justify-center' },
    { id: 'parabrisas', label: 'Parabrisas', classes: 'top-12 left-12 right-12 h-6 border-b-0 border-t-0 bg-blue-500/10' },
  ];

  return (
    <div className="relative w-[220px] h-[360px] mx-auto my-8">
      {/* Base Car Shape */}
      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800/50 rounded-[40px] shadow-inner border border-slate-200 dark:border-slate-700"></div>
      
      {zones.map(z => {
        const zoneData = damages?.[z.id];
        const hasDamage = zoneData?.status && zoneData.status !== 'ok';
        const isOk = zoneData?.status === 'ok';

        let bgClass = 'bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800';
        if (hasDamage) bgClass = 'bg-red-500/20 border-red-500 text-red-600 dark:text-red-400';
        else if (isOk) bgClass = 'bg-green-500/20 border-green-500 text-green-600 dark:text-green-400';

        return (
          <div 
            key={z.id}
            onClick={() => onZoneClick(z.id, z.label)}
            className={`absolute border-2 border-slate-300 dark:border-slate-600 transition-all cursor-pointer flex flex-col items-center justify-center z-10 ${z.classes} ${bgClass}`}
          >
             <span className="text-[10px] font-black uppercase tracking-widest text-center">
                {z.label}
             </span>
             {zoneData?.photo && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 z-20">
                   <Camera className="w-3 h-3 text-white" />
                </div>
             )}
          </div>
        );
      })}
    </div>
  );
};

export const StepNotes = ({ openCamera }) => {
  const { formData, setF, showAlert } = useChecklist();
  
  // Guardamos daños en formData.carDamages = { frontal: { status: 'rayado', photo: 'data:image...', notes: '' } }
  const damages = formData.carDamages || {};
  const updateDamage = (zoneId, data) => {
     setF('carDamages', { ...damages, [zoneId]: data });
  };

  const [activeZone, setActiveZone] = useState(null); // { id: 'frontal', label: 'Frente' }

  const handleCapturePhoto = async (zoneId) => {
    openCamera(`Daño: ${activeZone.label}`, async (file) => {
      try {
        const { resizeImage } = await import('../../../../utils/helpers');
        const compressed = await resizeImage(file, 1200, 0.6);
        const reader = new FileReader();
        reader.onload = () => {
          updateDamage(zoneId, { ...damages[zoneId], photo: reader.result });
        };
        reader.readAsDataURL(compressed);
      } catch (e) {
        showAlert("Error al procesar la foto del daño.");
      }
    }, true); // true for enableAnnotation if we support it
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      
      <div className="text-center space-y-1">
         <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
           Inspección de Daños
         </h3>
         <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
           Toca las zonas del vehículo para reportar el estado y adjuntar fotos de daños.
         </p>
      </div>

      <CarDiagram damages={damages} onZoneClick={(id, label) => setActiveZone({id, label})} />

      {activeZone && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative">
              <button onClick={() => setActiveZone(null)} className="absolute top-4 right-4 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl transition-colors">
                 <X className="w-5 h-5" />
              </button>
              
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-6">
                Zona: <span className="text-blue-500">{activeZone.label}</span>
              </h4>

              <div className="space-y-4">
                 <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => updateDamage(activeZone.id, { ...damages[activeZone.id], status: 'ok' })}
                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${damages[activeZone.id]?.status === 'ok' ? 'bg-green-500 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-green-400'}`}
                    >
                      ✓ OK
                    </button>
                    <button 
                      onClick={() => updateDamage(activeZone.id, { ...damages[activeZone.id], status: 'rayado' })}
                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${damages[activeZone.id]?.status === 'rayado' ? 'bg-orange-500 border-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-orange-400'}`}
                    >
                      ! Rayado
                    </button>
                    <button 
                      onClick={() => updateDamage(activeZone.id, { ...damages[activeZone.id], status: 'abollado' })}
                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${damages[activeZone.id]?.status === 'abollado' ? 'bg-red-500 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-red-400'}`}
                    >
                      ✕ Abollado
                    </button>
                 </div>

                 {damages[activeZone.id]?.status && damages[activeZone.id]?.status !== 'ok' && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                       <button 
                          onClick={() => handleCapturePhoto(activeZone.id)}
                          className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 flex items-center justify-center gap-2 transition-all ${damages[activeZone.id]?.photo ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-blue-400 hover:text-blue-500'}`}
                       >
                         <Camera className="w-4 h-4" />
                         {damages[activeZone.id]?.photo ? 'Reemplazar Foto del Daño' : 'Tomar Foto del Daño (Obligatorio)'}
                       </button>

                       {damages[activeZone.id]?.photo && (
                         <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                            <img src={damages[activeZone.id].photo} className="absolute inset-0 w-full h-full object-cover" />
                         </div>
                       )}

                       <textarea 
                         placeholder="Notas adicionales (opcional)..."
                         value={damages[activeZone.id]?.notes || ''}
                         onChange={(e) => updateDamage(activeZone.id, { ...damages[activeZone.id], notes: e.target.value })}
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 text-xs font-bold transition-colors resize-none h-20"
                       />
                    </div>
                 )}
                 
                 <button onClick={() => setActiveZone(null)} className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase tracking-widest text-[10px] transition-colors mt-2">
                    Cerrar Zona
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Otras Observaciones */}
      <div className="bg-slate-50/50 dark:bg-[#0f172a]/50 p-5 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-3">
         <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest pl-1">
           Otras Observaciones Visuales
         </h3>
         <textarea 
           className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 shadow-sm transition-all min-h-[100px] resize-none" 
           placeholder="Ej: Faltan gomas en los pedales, olor a humo, mancha en tapiz..." 
           value={formData.observations || ''} 
           onChange={(e) => setF('observations', e.target.value)} 
         />
      </div>

    </div>
  );
};
