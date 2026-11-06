import React from 'react';
import { useChecklist } from '../ChecklistContext';
import { Check, ClipboardList, Camera, PenTool, FileText, Eye } from 'lucide-react';

export const TabsHeader = () => {
  const { job, step, setStep } = useChecklist();

  const isSimple = job?.tripType === 'simple';
  
  const tabs = isSimple
    ? [
        { id: 1, label: 'Detalles', icon: ClipboardList }, 
        { id: 2, label: 'Evidencia', icon: Camera }, 
        { id: 3, label: 'Cierre', icon: PenTool }
      ]
    : [
        { id: 1, label: 'Datos', icon: ClipboardList }, 
        { id: 2, label: 'Docs', icon: FileText }, 
        { id: 3, label: 'Revisión', icon: Eye }, 
        { id: 4, label: 'Fotos', icon: Camera }, 
        { id: 5, label: 'Firma', icon: PenTool }
      ];

  const totalSteps = tabs.length;

  return (
    <div className="shrink-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-3.5 transition-colors w-full overflow-hidden">
       <div className="max-w-md mx-auto w-full px-4 sm:px-6 relative pb-5 sm:pb-4">
          
          {/* Progress Track Container */}
          <div className="absolute top-4 left-8 sm:left-10 right-8 sm:right-10 h-0.5 z-0">
             <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
             <div 
               className="absolute top-0 left-0 bottom-0 bg-sky-600 rounded-full transition-all duration-300 ease-out" 
               style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
             ></div>
          </div>

          <div className="relative z-10 flex justify-between items-center w-full">
            {tabs.map((t) => {
              const isActive = step === t.id;
              const isPast = step > t.id;

              return (
                <div key={t.id} className="flex flex-col items-center gap-1.5 cursor-pointer relative" onClick={() => setStep(t.id)}>
                   <div 
                     className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border relative z-10
                     ${isActive 
                        ? 'border-sky-600 bg-sky-600 text-white' 
                        : isPast 
                          ? 'border-emerald-600 bg-emerald-600 text-white' 
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                     }`}
                   >
                     {isPast ? (
                        <Check className="w-4 h-4" />
                     ) : (
                        <t.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                     )}
                   </div>
                   
                   {/* Label */}
                   <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors absolute top-9 whitespace-nowrap text-center leading-none
                     ${isActive 
                        ? 'text-sky-600 dark:text-sky-400' 
                        : isPast
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                     }`}
                   >
                     {isActive ? `${t.id}/${totalSteps} ${t.label}` : t.label}
                   </span>
                </div>
              );
            })}
          </div>
       </div>
    </div>
  );
};
