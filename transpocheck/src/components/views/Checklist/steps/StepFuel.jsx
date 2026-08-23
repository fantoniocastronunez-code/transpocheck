import React from 'react';
import { useChecklist } from '../ChecklistContext';
import { formatMoney } from '../../../../utils/helpers';

export const StepFuel = () => {
  const { formData, setF, expenses } = useChecklist();

  // Opciones de Combustible
  const fuelLevels = [
    { label: 'E', value: 0 },
    { label: '1/4', value: 25 },
    { label: '1/2', value: 50 },
    { label: '3/4', value: 75 },
    { label: 'F', value: 100 }
  ];

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
            min="0" max="100" step="25" 
            value={formData.fuelLevel} 
            onChange={(e) => setF('fuelLevel', parseInt(e.target.value, 10))} 
            className="w-full accent-blue-600 cursor-pointer relative z-10 opacity-0 h-8"
          />
          
          <div className="flex justify-between w-full absolute top-1/2 -translate-y-1/2 pointer-events-none">
            {fuelLevels.map(lvl => (
              <div 
                key={lvl.value} 
                className={`w-4 h-4 rounded-full border-2 transition-colors ${formData.fuelLevel >= lvl.value ? 'bg-white border-blue-600' : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600'}`} 
              />
            ))}
          </div>

          <div className="flex justify-between text-[10px] font-black text-slate-400 mt-3 px-1">
            {fuelLevels.map(lvl => <span key={lvl.value} className={formData.fuelLevel === lvl.value ? 'text-blue-600 dark:text-blue-400 scale-110 transition-transform' : ''}>{lvl.label}</span>)}
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

      {/* Tiempos de Espera (Gastos extra) */}
      <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-3xl border border-amber-200/50 dark:border-amber-800/30 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest flex items-center justify-between">
          Tiempos de Espera
          <span className="text-[10px] bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-md">OPCIONAL</span>
        </h3>
        <p className="text-[11px] font-bold text-amber-700/80 dark:text-amber-400/80 leading-tight">
          Calcula el monto extra si hubo retrasos (1 UF x hora).
        </p>

        <div className="grid grid-cols-2 gap-3">
           <div className="space-y-1">
             <label className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest ml-1">Llegada Cliente</label>
             <input type="time" value={formData.clientArrivalTime || ''} onChange={e => setF('clientArrivalTime', e.target.value)} className="w-full border-2 border-amber-200 dark:border-amber-800/50 p-3 rounded-2xl outline-none focus:border-amber-500 font-bold text-amber-900 dark:text-amber-300 bg-white dark:bg-slate-900" />
           </div>
           <div className="space-y-1">
             <label className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest ml-1">Salida Cliente</label>
             <input type="time" value={formData.clientDepartureTime || ''} onChange={e => setF('clientDepartureTime', e.target.value)} className="w-full border-2 border-amber-200 dark:border-amber-800/50 p-3 rounded-2xl outline-none focus:border-amber-500 font-bold text-amber-900 dark:text-amber-300 bg-white dark:bg-slate-900" />
           </div>
        </div>

        {formData.clientArrivalTime && formData.clientDepartureTime && (
          <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-xl border border-amber-300 dark:border-amber-700 flex justify-between items-center animate-in zoom-in-95">
             <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Total Calculado</span>
             <span className="font-black text-amber-900 dark:text-amber-200">
               {formatMoney(
                 Math.max(0, 
                   (new Date(`1970/01/01 ${formData.clientDepartureTime}`).getTime() - new Date(`1970/01/01 ${formData.clientArrivalTime}`).getTime()) / 3600000 - 1
                 ) * 38000 // Aprox 1 UF
               )}
             </span>
          </div>
        )}
      </div>

    </div>
  );
};
