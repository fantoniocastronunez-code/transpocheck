import React, { useEffect } from 'react';
import { useChecklist } from '../ChecklistContext';
import { formatMoney } from '../../../../utils/helpers';
import { Clock } from 'lucide-react';

export const StepFuel = () => {
  const { formData, setF, job } = useChecklist();

  // Opciones de Combustible (ahora en octavos para más precisión)
  const fuelLevels = [
    { label: 'E', value: 0 },
    { label: '', value: 12.5 },
    { label: '1/4', value: 25 },
    { label: '', value: 37.5 },
    { label: '1/2', value: 50 },
    { label: '', value: 62.5 },
    { label: '3/4', value: 75 },
    { label: '', value: 87.5 },
    { label: 'F', value: 100 }
  ];

  // Formatear timestamp a hora HH:MM local
  const formatTime = (ts) => {
    if (!ts) return '--:--';
    return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };

  // Sincronizar automáticamente con los tiempos del trabajo
  useEffect(() => {
    if (job?.timestamps?.arrivedPickupAt && !formData.clientArrivalTime) {
      setF('clientArrivalTime', formatTime(job.timestamps.arrivedPickupAt));
    }
    if (job?.timestamps?.pickedUpAt && !formData.clientDepartureTime) {
      setF('clientDepartureTime', formatTime(job.timestamps.pickedUpAt));
    }
  }, [job, formData.clientArrivalTime, formData.clientDepartureTime, setF]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Carga de Combustible */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center justify-between">
          Nivel de Combustible
          <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md text-[10px]">
            {formData.fuelLevel}%
          </span>
        </h3>
        
        <div className="relative pt-6 pb-2">
          {/* Barra de progreso visual (decorativa) */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 rounded-full pointer-events-none" />
          <div 
            className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-green-500 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-300" 
            style={{ width: `${formData.fuelLevel}%` }}
          />

          <input 
            type="range" 
            min="0" max="100" step="12.5" 
            value={formData.fuelLevel} 
            onChange={(e) => setF('fuelLevel', parseFloat(e.target.value))} 
            className="w-full accent-blue-600 cursor-pointer relative z-10 opacity-0 h-8"
          />
          
          <div className="flex justify-between w-full absolute top-1/2 -translate-y-1/2 pointer-events-none">
            {fuelLevels.map((lvl, idx) => (
              <div 
                key={idx} 
                className={`w-3 h-3 rounded-full border-2 transition-colors ${formData.fuelLevel >= lvl.value ? 'bg-white border-blue-600 shadow-sm' : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600'} ${lvl.label === '' ? 'scale-75' : 'scale-100'}`} 
              />
            ))}
          </div>

          <div className="flex justify-between text-[10px] font-black text-slate-400 mt-3 px-1">
            {fuelLevels.map((lvl, idx) => (
              <span key={idx} className={`w-8 text-center ${formData.fuelLevel === lvl.value ? 'text-blue-600 dark:text-blue-400 scale-110 transition-transform' : ''}`}>
                {lvl.label}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors border-2 ${formData.hasFuelCharge ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
               <input 
                 type="checkbox" 
                 checked={formData.hasFuelCharge || false} 
                 onChange={e => setF('hasFuelCharge', e.target.checked)} 
                 className="hidden" 
               />
               {formData.hasFuelCharge && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="font-black text-slate-800 dark:text-slate-200 text-xs tracking-widest uppercase">
              ¿Cargó Combustible?
            </span>
          </label>
          
          {formData.hasFuelCharge && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                <input 
                  type="number" 
                  placeholder="Monto cargado" 
                  value={formData.fuelChargeAmount || ''} 
                  onChange={e => setF('fuelChargeAmount', parseInt(e.target.value, 10))} 
                  className="w-full border-2 border-slate-200 dark:border-slate-700 pl-8 p-3 rounded-2xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 transition-colors shadow-inner" 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Kilometraje Actual */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-2">
         <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
           Kilometraje Actual
         </h3>
         <div className="relative">
           <input 
             type="number" 
             placeholder="Ej: 45000" 
             value={formData.mileage || ''} 
             onChange={e => setF('mileage', e.target.value)} 
             className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 transition-colors shadow-inner tracking-widest text-lg" 
           />
           <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-[10px] text-slate-400 uppercase tracking-widest">KM</span>
         </div>
      </div>

      {/* Tiempos de Espera (Automático) */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest flex items-center justify-between">
          Tiempos de Espera
          <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Clock className="w-3 h-3" /> Automático
          </span>
        </h3>

        <div className="grid grid-cols-2 gap-3">
           <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Llegué a retirar</label>
             <p className="font-bold text-slate-800 dark:text-slate-200 text-center text-lg">{formatTime(job?.timestamps?.arrivedPickupAt)}</p>
           </div>
           <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Vehículo en poder</label>
             <p className="font-bold text-slate-800 dark:text-slate-200 text-center text-lg">{formatTime(job?.timestamps?.pickedUpAt)}</p>
           </div>
        </div>

        {job?.timestamps?.arrivedPickupAt && job?.timestamps?.pickedUpAt && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/50 flex justify-between items-center mt-2 animate-in zoom-in-95">
             <span className="text-[11px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest">Tiempo Total</span>
             <span className="font-black text-blue-900 dark:text-blue-300 text-lg">
               {Math.max(0, Math.floor((job.timestamps.pickedUpAt - job.timestamps.arrivedPickupAt) / 60000))} min
             </span>
          </div>
        )}
      </div>

    </div>
  );
};
