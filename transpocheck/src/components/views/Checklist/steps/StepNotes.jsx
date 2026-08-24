import React, { useState, useEffect } from 'react';
import { AlertCircle, FileText, CheckCircle } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { db } from '../../../../firebase';

export const StepNotes = () => {
  const { formData, setF } = useChecklist();
  const [equipmentList, setEquipmentList] = useState([
    "Gata", "Llave de ruedas", "Barrotes", "Botiquín", "Manuales",
    "Piso de goma", "Colchoneta", "Cortinas", "Triángulos reflectantes",
    "Extintor", "Chaleco reflectante"
  ]);

  // Cargar lista dinámica de equipos desde Firebase (opcional)
  useEffect(() => {
    import('firebase/firestore').then(({ doc, getDoc }) => {
      getDoc(doc(db, 'system_config', 'equipment')).then(snap => {
        if (snap.exists() && snap.data().items) setEquipmentList(snap.data().items);
      }).catch(() => { });
    });
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Observaciones Generales */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest pl-1">
          Observaciones Generales
        </h3>
        <textarea 
          className="w-full border-2 border-slate-200 dark:border-slate-700 p-4 rounded-3xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 bg-white dark:bg-slate-900 shadow-sm transition-all min-h-[120px] resize-none" 
          placeholder="Escribe aquí si hay algún daño, rayón o comentario del estado visual del vehículo..." 
          autoComplete="off" autoCorrect="off" spellCheck="false" 
          value={formData.observations || ''} 
          onChange={(e) => setF('observations', e.target.value)} 
        />
      </div>

      {/* Notas durante el traslado */}
      <div className="bg-orange-50/50 dark:bg-orange-900/10 p-5 rounded-3xl border border-orange-200/50 dark:border-orange-800/30 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-orange-800 dark:text-orange-300 uppercase tracking-widest flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Notas en Ruta
        </h3>
        <p className="text-[11px] font-bold text-orange-600/80 dark:text-orange-400/80 leading-tight">
          Reporta eventos como ruidos, pinchazos, o novedades ocurridas en la ruta.
        </p>
        <textarea 
          className="w-full border-2 border-orange-200 dark:border-orange-800/50 p-4 rounded-2xl text-sm font-bold text-orange-800 dark:text-orange-300 outline-none focus:border-orange-500 bg-white dark:bg-slate-900 placeholder-orange-300/50 min-h-[100px] resize-none shadow-inner transition-colors" 
          placeholder="Ej: Piquete en parabrisas en carretera..." 
          autoComplete="off" autoCorrect="off" spellCheck="false" 
          value={formData.transitNotes || ''} 
          onChange={(e) => setF('transitNotes', e.target.value)} 
        />
      </div>

      {/* Verificación de Equipamiento */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors border-2 ${formData.hasEquipment ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
             <input 
               type="checkbox" 
               checked={formData.hasEquipment || false} 
               onChange={e => setF('hasEquipment', e.target.checked)} 
               className="hidden" 
             />
             {formData.hasEquipment && <CheckCircle className="w-4 h-4 text-white" />}
          </div>
          <span className="font-black text-slate-800 dark:text-slate-200 text-xs tracking-widest uppercase">
            VERIFICAR EQUIPAMIENTO
          </span>
        </label>

        {formData.hasEquipment && (
          <div className="animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {equipmentList.map(item => {
                const isChecked = formData.equipment?.[item] || false;
                return (
                  <label 
                    key={item} 
                    className={`flex items-start gap-2.5 p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none 
                    ${isChecked 
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 shadow-sm' 
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700/50'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={e => setF('equipment', { ...formData.equipment, [item]: e.target.checked })} 
                      className="w-4 h-4 accent-blue-600 rounded shrink-0 mt-0.5" 
                    />
                    <span className="text-[11px] font-extrabold leading-tight">{item}</span>
                  </label>
                );
              })}
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Detalles extra
              </label>
              <input 
                type="text" 
                placeholder="Ej: Destornillador, chaleco extra..." 
                value={formData.equipmentDetails || ''} 
                onChange={e => setF('equipmentDetails', e.target.value)} 
                autoComplete="off" autoCorrect="off" spellCheck="false" 
                className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 shadow-inner bg-slate-50/50 dark:bg-slate-800/50 transition-colors" 
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
