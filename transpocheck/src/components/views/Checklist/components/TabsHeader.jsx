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
    <div className="sticky top-[64px] sm:top-[80px] z-50 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 py-5 transition-all w-full overflow-hidden">
       <div className="max-w-md mx-auto w-full px-4 sm:px-6 relative pb-6 sm:pb-4">
          
          {/* Progress Line Background */}
          <div className="absolute top-4 left-8 right-8 h-1 bg-slate-200 dark:bg-slate-800 rounded-full z-0"></div>
          
          {/* Active Progress Line */}
          <div 
             className="absolute top-4 left-8 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full z-0 transition-all duration-500 ease-in-out" 
             style={{ width: `calc(${((step - 1) / (totalSteps - 1)) * 100}% - 2.5rem)` }}
          ></div>

          <div className="relative z-10 flex justify-between items-center w-full">
            {tabs.map((t, idx) => {
              const isActive = step === t.id;
              const isPast = step > t.id;

              return (
                <div key={t.id} className="flex flex-col items-center gap-2 cursor-pointer relative" onClick={() => setStep(t.id)}>
                   <div 
                     className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 shadow-sm relative z-10
                     ${isActive 
                        ? 'border-blue-500 bg-[#0f172a] shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-110' 
                        : isPast 
                          ? 'border-purple-500 bg-purple-500 text-white' 
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                     }`}
                   >
                     {isPast ? (
                        <Check className="w-4 h-4" />
                     ) : (
                        <t.icon className={`w-3.5 h-3.5 transition-all ${isActive ? 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'text-slate-400 dark:text-slate-500'}`} />
                     )}
                   </div>
                   
                   {/* Label */}
                   <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all absolute top-10 whitespace-nowrap text-center leading-none
                     ${isActive 
                        ? 'text-blue-600 dark:text-blue-400 opacity-100' 
                        : isPast
                          ? 'text-purple-600 dark:text-purple-400 opacity-100'
                          : 'text-slate-500 dark:text-slate-400 opacity-100'
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
