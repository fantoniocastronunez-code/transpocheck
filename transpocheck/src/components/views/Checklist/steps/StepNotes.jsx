import React, { useState, useEffect } from 'react';
import { FileText, CheckSquare, Wrench, Check, CheckCircle2, RotateCcw } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useChecklist } from '../ChecklistContext';

const DEFAULT_EQUIPMENT = [
  "Gata", "Llave de ruedas", "Barrotes", "Botiquín", "Manuales", 
  "Piso de goma", "Colchoneta", "Cortinas", "Triángulos reflectantes", 
  "Extintor", "Chaleco reflectante"
];

export const StepNotes = () => {
  const { formData, setF } = useChecklist();
  const [equipmentList, setEquipmentList] = useState(DEFAULT_EQUIPMENT);

  useEffect(() => {
    let unsub = null;
    try {
      unsub = onSnapshot(doc(db, 'system_config', 'equipment'), (snap) => {
        if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
          setEquipmentList(snap.data().items);
        }
      }, (err) => {
        console.warn("[ERR-EQ-LOAD-01] Error cargando equipamiento en checklist:", err);
      });
    } catch (e) {
      console.warn("[ERR-EQ-LOAD-02] Error al conectar con config de equipamiento:", e);
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const currentEquipment = formData.equipment || {};

  const toggleItem = (item) => {
    const updated = { ...currentEquipment };
    updated[item] = !updated[item];
    setF('equipment', updated);
    setF('hasEquipment', true);
  };

  const markAll = () => {
    const updated = { ...currentEquipment };
    equipmentList.forEach((item) => {
      updated[item] = true;
    });
    setF('equipment', updated);
    setF('hasEquipment', true);
  };

  const unmarkAll = () => {
    const updated = { ...currentEquipment };
    equipmentList.forEach((item) => {
      updated[item] = false;
    });
    setF('equipment', updated);
    setF('hasEquipment', true);
  };

  const checkedCount = equipmentList.filter((item) => Boolean(currentEquipment[item])).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* SECCIÓN 1: REVISIÓN DE EQUIPAMIENTO */}
      <div className="bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 p-5 sm:p-6 rounded-3xl shadow-lg relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest leading-none">
                Equipamiento del Vehículo
              </h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                Verifica los ítems y accesorios presentes en la unidad (según config)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
              {checkedCount} de {equipmentList.length} presentes
            </span>
          </div>
        </div>

        {/* Botones de acción rápida */}
        <div className="flex items-center gap-2 mb-4 relative z-10">
          <button
            type="button"
            onClick={markAll}
            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 transition-all flex items-center gap-1 active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Marcar todos
          </button>
          <button
            type="button"
            onClick={unmarkAll}
            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Desmarcar todos
          </button>
        </div>

        {/* Casillas de verificación del equipamiento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 relative z-10">
          {equipmentList.map((item) => {
            const isChecked = Boolean(currentEquipment[item]);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleItem(item)}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all active:scale-[0.98] select-none ${
                  isChecked
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isChecked
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span
                  className={`text-xs font-black truncate ${
                    isChecked
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item}
                </span>
              </button>
            );
          })}
        </div>

        {/* Detalle o notas adicionales de equipamiento */}
        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 relative z-10">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-amber-500" /> Detalle de herramientas o equipamiento adicional (Opcional)
          </label>
          <input
            type="text"
            value={formData.equipmentDetails || ''}
            onChange={(e) => setF('equipmentDetails', e.target.value)}
            placeholder="Ej: Llave de tuercas especial en guantera, cables de batería, 2 conos..."
            className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-amber-500 dark:focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 shadow-inner"
          />
        </div>
      </div>

      {/* SECCIÓN 2: CUADRO DE TEXTO PARA ANOTAR DETALLES / OBSERVACIONES */}
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
          rows={5}
          value={formData.observations || ''}
          onChange={(e) => setF('observations', e.target.value)}
          placeholder="Ej: Rayón superficial en costado derecho, tapiz con manchas leves, rueda de repuesto con poco aire..."
          className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 resize-none shadow-inner relative z-10 min-h-[120px]"
        />
      </div>
    </div>
  );
};
