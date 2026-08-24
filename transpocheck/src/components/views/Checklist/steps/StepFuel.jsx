import React, { useState, useEffect } from 'react';
import { useChecklist } from '../ChecklistContext';
import { formatMoney } from '../../../../utils/helpers';
import { Clock, DollarSign } from 'lucide-react';
import { db } from '../../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const CurrencyInput = ({ value, onChange, placeholder, label }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">{label}</label>}
    <div className="relative">
      <input 
        type="text" 
        inputMode="numeric"
        placeholder={placeholder} 
        value={value ? `$ ${Number(value).toLocaleString('es-CL')}` : ''} 
        onChange={e => {
          const raw = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(isNaN(raw) ? 0 : raw);
        }} 
        className="w-full border-2 border-slate-200 dark:border-slate-700 pl-4 pr-4 p-3 rounded-2xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 transition-colors shadow-inner" 
      />
    </div>
  </div>
);

export const StepFuel = ({ openCamera }) => {
  const { formData, setF, job } = useChecklist();

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

  const handlePic = async (eOrFile, id) => {
    const f = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
    if (!f) return;
    try {
      const { resizeImage } = await import('../../../../utils/helpers');
      const dataUrl = await resizeImage(f, 1920, 0.85);
      setF(id, dataUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhotoClick = (id, label) => {
    if (formData[id]) {
      const evt = new CustomEvent('openFullScreenImage', { detail: { url: formData[id], id, label }});
      window.dispatchEvent(evt);
    } else {
      if(openCamera) {
        openCamera(label, f => handlePic(f, id));
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
      if (id === 'fuelReceipt') setF(id, null);
    };
    window.addEventListener('deleteImage', handleDelete);
    return () => window.removeEventListener('deleteImage', handleDelete);
  }, [setF]);

  }, [setF]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
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

      {/* Gastos PRT / Trámites */}
      {job?.tripType === 'revision' && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
          <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
            Costos del Trámite / PRT
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput label="Revisión Técnica" placeholder="$0" value={formData.prtCostRevision} onChange={v => setF('prtCostRevision', v)} />
            <CurrencyInput label="Inspección Visual" placeholder="$0" value={formData.prtCostInspeccion} onChange={v => setF('prtCostInspeccion', v)} />
            <CurrencyInput label="Frenos" placeholder="$0" value={formData.prtCostFrenos} onChange={v => setF('prtCostFrenos', v)} />
            <CurrencyInput label="Gases" placeholder="$0" value={formData.prtCostGases} onChange={v => setF('prtCostGases', v)} />
          </div>
          <div className="pt-2">
             <p className="text-xs font-bold text-slate-500">Total Trámite: <span className="text-slate-800 dark:text-slate-200">${((formData.prtCostRevision||0)+(formData.prtCostInspeccion||0)+(formData.prtCostFrenos||0)+(formData.prtCostGases||0)).toLocaleString('es-CL')}</span></p>
          </div>
        </div>
      )}

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
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 space-y-4">
              <CurrencyInput placeholder="Monto cargado de combustible" value={formData.fuelChargeAmount} onChange={v => setF('fuelChargeAmount', v)} />
              
              <div className="mt-2">
                <button 
                  type="button" 
                  onClick={() => handlePhotoClick('fuelReceipt', 'Boleta Combustible')} 
                  className={`w-full h-14 rounded-2xl border-2 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all 
                  ${formData.fuelReceipt 
                    ? 'border-green-400 ring-2 ring-green-100' 
                    : 'border-dashed border-red-300 dark:border-red-700/50 hover:bg-red-50 dark:hover:bg-red-900/30'
                  }`}
                >
                  {formData.fuelReceipt ? (
                    <>
                      <img src={formData.fuelReceipt} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                      <div className="w-5 h-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center relative z-10"><svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                      <span className="text-[10px] font-black text-green-800 dark:text-green-300 relative z-10">Boleta OK</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-red-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="text-[10px] font-black uppercase text-red-500 dark:text-red-400">Tomar Foto a Boleta (Obligatorio)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Medidor posterior a la carga */}
              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm mt-4">
                <h3 className="text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest flex items-center justify-between mb-4">
                  Nivel después de carga
                  <span className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-md text-[10px]">
                    {formData.fuelLevelAfter ?? formData.fuelLevel}%
                  </span>
                </h3>
                
                <div className="relative pt-4 pb-2">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 rounded-full pointer-events-none" />
                  <div 
                    className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-green-500 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-300" 
                    style={{ width: `${formData.fuelLevelAfter ?? formData.fuelLevel}%` }}
                  />

                  <input 
                    type="range" 
                    min="0" max="100" step="12.5" 
                    value={formData.fuelLevelAfter ?? formData.fuelLevel} 
                    onChange={(e) => setF('fuelLevelAfter', parseFloat(e.target.value))} 
                    className="w-full accent-blue-600 cursor-pointer relative z-10 opacity-0 h-8"
                  />
                  
                  <div className="flex justify-between w-full absolute top-1/2 -translate-y-1/2 pointer-events-none">
                    {fuelLevels.map((lvl, idx) => {
                      const currentVal = formData.fuelLevelAfter ?? formData.fuelLevel;
                      return (
                        <div 
                          key={idx} 
                          className={`w-3 h-3 rounded-full border-2 transition-colors ${currentVal >= lvl.value ? 'bg-white border-blue-600 shadow-sm' : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600'} ${lvl.label === '' ? 'scale-75' : 'scale-100'}`} 
                        />
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-[10px] font-black text-slate-400 mt-3 px-1">
                    {fuelLevels.map((lvl, idx) => (
                      <span key={idx} className={`w-8 text-center ${(formData.fuelLevelAfter ?? formData.fuelLevel) === lvl.value ? 'text-blue-600 dark:text-blue-400 scale-110 transition-transform' : ''}`}>
                        {lvl.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
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
