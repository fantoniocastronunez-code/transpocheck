import React from 'react';
import { FileText } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';

export const StepNotes = () => {
  const { formData, setF } = useChecklist();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* CUADRO DE TEXTO PARA ANOTAR DETALLES / OBSERVACIONES */}
      <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-lg relative overflow-hidden">
        {/* Glassmorphism Background Glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-2 mb-2 relative z-10">
          <FileText className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
            Detalles y Observaciones de la Revisión
          </h3>
        </div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 relative z-10">
          Anota aquí cualquier detalle, desperfecto o novedad relevante detectada durante la inspección del vehículo.
        </p>

        <textarea
          rows={6}
          value={formData.observations || ''}
          onChange={(e) => setF('observations', e.target.value)}
          placeholder="Ej: Rayón superficial en costado derecho, tapiz con manchas leves, rueda de repuesto con poco aire..."
          className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 resize-none shadow-inner relative z-10 min-h-[140px]"
        />
      </div>
    </div>
  );
};

