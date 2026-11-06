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
    <div className="space-y-5 animate-in fade-in duration-150 pb-10 pt-3">
      {/* SECCIÓN 1: REVISIÓN DE EQUIPAMIENTO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-xs relative overflow-hidden">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider leading-none">
                Equipamiento del Vehículo
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                Verifica los ítems y accesorios presentes en la unidad (según config)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {checkedCount} de {equipmentList.length} presentes
            </span>
          </div>
        </div>

        {/* Botones de acción rápida */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={markAll}
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60 transition-colors flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Marcar todos
          </button>
          <button
            type="button"
            onClick={unmarkAll}
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Desmarcar todos
          </button>
        </div>

        {/* Casillas de verificación del equipamiento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {equipmentList.map((item) => {
            const isChecked = Boolean(currentEquipment[item]);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleItem(item)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors select-none ${
                  isChecked
                    ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-600 dark:border-sky-500'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-sm flex items-center justify-center shrink-0 transition-colors ${
                    isChecked
                      ? 'bg-sky-600 text-white'
                      : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span
                  className={`text-xs font-semibold truncate ${
                    isChecked
                      ? 'text-sky-950 dark:text-sky-100'
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
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-slate-500" /> Detalle de herramientas o equipamiento adicional (Opcional)
          </label>
          <input
            type="text"
            value={formData.equipmentDetails || ''}
            onChange={(e) => setF('equipmentDetails', e.target.value)}
            placeholder="Ej: Llave de tuercas especial en guantera, cables de batería, 2 conos..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-sky-600 outline-none transition-colors placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* SECCIÓN 2: CUADRO DE TEXTO PARA ANOTAR DETALLES / OBSERVACIONES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-xs relative overflow-hidden">

        <div className="flex items-center gap-2 mb-1.5">
          <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Detalles y Observaciones de la Revisión
          </h3>
        </div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3.5">
          Anota aquí cualquier detalle, desperfecto o novedad relevante detectada durante la inspección del vehículo.
        </p>

        <textarea
          rows={5}
          value={formData.observations || ''}
          onChange={(e) => setF('observations', e.target.value)}
          placeholder="Ej: Rayón superficial en costado derecho, tapiz con manchas leves, rueda de repuesto con poco aire..."
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-sky-600 outline-none transition-colors placeholder:text-slate-400 resize-none min-h-[120px]"
        />
      </div>
    </div>
  );
};
