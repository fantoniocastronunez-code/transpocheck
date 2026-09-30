import React, { useState } from 'react';
import { Camera, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';

export const StepNotes = ({ openCamera }) => {
  const { formData, setF, showAlert } = useChecklist();
  
  const damages = formData.carDamages || {};
  const updateDamage = (zoneId, data) => {
     setF('carDamages', { ...damages, [zoneId]: data });
  };

  const [activeZone, setActiveZone] = useState(null);

  const zones = [
    { id: 'luces', label: 'Luces', icon: '💡' },
    { id: 'neumaticos', label: 'Neumáticos', icon: '🚗' },
    { id: 'carroceria', label: 'Carrocería', icon: '🚙' },
    { id: 'parabrisas', label: 'Parabrisas', icon: '💧' },
  ];

  const handleCapturePhoto = async (zoneId) => {
    const label = zones.find(z => z.id === zoneId)?.label || zoneId;
    openCamera(`Foto: ${label}`, async (file) => {
      try {
        const { resizeImage } = await import('../../../../utils/helpers');
        const compressed = await resizeImage(file, 1200, 0.6);
        const reader = new FileReader();
        reader.onload = () => {
          updateDamage(zoneId, { ...damages[zoneId], photo: reader.result });
        };
        reader.readAsDataURL(compressed);
      } catch (e) {
        showAlert("Error al procesar la foto.");
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      
      <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-lg relative overflow-hidden">
        {/* Glassmorphism Background Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-2 relative z-10">
          Inspección de Daños
        </h3>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 relative z-10">
          Por favor, evalúe el estado de cada parte del vehículo
        </p>
        
        <div className="grid grid-cols-2 gap-3 relative z-10">
          {zones.map(z => {
            const status = damages[z.id]?.status;
            const isExpanded = activeZone === z.id;
            
            let btnClass = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-purple-400';
            if (status === 'ok') btnClass = 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]';
            else if (status === 'rayado') btnClass = 'bg-yellow-500/10 border-yellow-500 text-yellow-600 dark:text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]';
            else if (status === 'abollado') btnClass = 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
            
            if (isExpanded) btnClass = 'bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-2 ring-purple-500/20';

            return (
              <div key={z.id} className="flex flex-col">
                <button
                  onClick={() => setActiveZone(isExpanded ? null : z.id)}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${btnClass}`}
                >
                   <div className="flex items-center gap-2">
                     <span>{z.icon}</span>
                     <span className="text-xs font-black uppercase tracking-wider">{z.label}</span>
                   </div>
                   {status && !isExpanded && (
                     <CheckCircle className="w-4 h-4 opacity-50" />
                   )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Expanded Zone Selector */}
        {activeZone && (
           <div className="mt-6 p-5 bg-white/50 dark:bg-slate-800/50 border-2 border-purple-500/50 rounded-3xl animate-in fade-in slide-in-from-top-2 relative z-20">
              <div className="flex justify-between items-center mb-4">
                 <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                   Estado: <span className="text-purple-500">{zones.find(z => z.id === activeZone)?.label}</span>
                 </h4>
                 <button onClick={() => setActiveZone(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5"/></button>
              </div>

              <div className="flex flex-col gap-2">
                 <button 
                   onClick={() => { updateDamage(activeZone, { ...damages[activeZone], status: 'ok' }); setActiveZone(null); }}
                   className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 hover:border-green-500 rounded-2xl transition-all"
                 >
                   <div className="bg-green-500 text-white rounded-full p-1"><CheckCircle className="w-4 h-4" /></div>
                   <div className="text-left">
                     <span className="block text-sm font-black text-green-700 dark:text-green-400 uppercase tracking-wider">OK</span>
                     <span className="block text-[10px] text-green-600/70 dark:text-green-400/70">Buen Estado</span>
                   </div>
                 </button>

                 <button 
                   onClick={() => updateDamage(activeZone, { ...damages[activeZone], status: 'rayado' })}
                   className={`flex items-center gap-3 p-4 ${damages[activeZone]?.status === 'rayado' ? 'bg-yellow-500/20 border-yellow-500 ring-2 ring-yellow-500/20' : 'bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500'} border rounded-2xl transition-all`}
                 >
                   <div className="bg-yellow-500 text-white rounded-full p-1"><AlertTriangle className="w-4 h-4" /></div>
                   <div className="text-left flex-1">
                     <span className="block text-sm font-black text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Rayado</span>
                     <span className="block text-[10px] text-yellow-600/70 dark:text-yellow-400/70">Daño Leve</span>
                   </div>
                 </button>

                 <button 
                   onClick={() => updateDamage(activeZone, { ...damages[activeZone], status: 'abollado' })}
                   className={`flex items-center gap-3 p-4 ${damages[activeZone]?.status === 'abollado' ? 'bg-red-500/20 border-red-500 ring-2 ring-red-500/20' : 'bg-red-500/5 border-red-500/30 hover:border-red-500'} border rounded-2xl transition-all`}
                 >
                   <div className="bg-red-500 text-white rounded-full p-1"><X className="w-4 h-4" /></div>
                   <div className="text-left flex-1">
                     <span className="block text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-wider">Abollado</span>
                     <span className="block text-[10px] text-red-600/70 dark:text-red-400/70">Daño Grave</span>
                   </div>
                 </button>
              </div>

              {/* Photo Upload for Damage */}
              {damages[activeZone]?.status && damages[activeZone]?.status !== 'ok' && (
                 <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <button 
                       onClick={() => handleCapturePhoto(activeZone)}
                       className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 flex items-center justify-center gap-2 transition-all ${damages[activeZone]?.photo ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-blue-400 hover:text-blue-500'}`}
                    >
                      <Camera className="w-4 h-4" />
                      {damages[activeZone]?.photo ? 'Reemplazar Foto del Daño' : 'Tomar Foto del Daño (Obligatorio)'}
                    </button>
                    {damages[activeZone]?.photo && (
                      <div className="mt-2 w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                         <img src={damages[activeZone].photo} className="w-full h-full object-cover" />
                      </div>
                    )}
                 </div>
              )}
           </div>
        )}
      </div>

    </div>
  );
};
