import React from 'react';
import { useChecklist } from '../ChecklistContext';

export const TabsHeader = () => {
  const { job, formData, step, setStep } = useChecklist();

  // Cálculo de progreso
  let progress = 0;
  if (job?.tripType === 'simple') {
    const req = (job.isPintura || job.isGrabado) ? ((job.qtyPintura || 0) + (job.qtyGrabado || 0)) : 1;
    const cur = Object.values(formData.photos || {}).filter(v => v).length;
    if (formData.observations) progress += 33;
    if (cur >= req) progress += 33;
    if (formData.signatureData || formData.noReception) progress += 34;
  } else {
    if (formData.brand && formData.model && formData.plateOrVin) progress += 25;
    if (formData.fuelLevel !== undefined) progress += 25;
    if (Object.values(formData.photos || {}).filter(v => v).length >= 2) progress += 25;
    if (formData.signatureData || formData.noReception) progress += 25;
  }
  progress = Math.min(100, progress);

  const tabs = job?.tripType === 'simple'
    ? [{ id: 1, label: '📋 Detalles' }, { id: 2, label: '📸 Evidencia' }, { id: 3, label: '✍️ Cierre' }]
    : [{ id: 1, label: '📋 Datos' }, { id: 2, label: '📄 Docs' }, { id: 3, label: '💬 Notas' }, { id: 4, label: '📸 Fotos' }, { id: 5, label: '⛽ Comb. & Espera' }, { id: 6, label: '✍️ Entrega' }];

  const isSimple = job?.tripType === 'simple';

  return (
    <>
      {/* Barra de progreso */}
      <div className="sticky top-[64px] sm:top-[80px] z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-5 py-4 shadow-sm transition-all">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Progreso del Acta
          </span>
          <span className={`text-xs font-black ${isSimple ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {progress}%
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${isSimple ? 'bg-gradient-to-r from-purple-400 to-purple-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Pestañas (Tabs) */}
      <div className="px-5 pt-5 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
          {tabs.map(t => {
            const isActive = step === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setStep(t.id)}
                className={`snap-center px-4 py-2.5 rounded-2xl text-[11px] font-black tracking-wide whitespace-nowrap transition-all shrink-0 border 
                ${isActive 
                  ? (isSimple 
                      ? 'bg-purple-600 text-white border-purple-500 shadow-[0_8px_16px_-6px_rgba(147,51,234,0.5)]' 
                      : 'bg-blue-600 text-white border-blue-500 shadow-[0_8px_16px_-6px_rgba(37,99,235,0.5)]') 
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
