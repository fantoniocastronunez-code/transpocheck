import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CheckCircle, Plus, Trash2 } from 'lucide-react';

export default function ConfigEquipment({ db, showAlert, showConfirm }) {
  const [equipmentList, setEquipmentList] = useState([
    "Gata", "Llave de ruedas", "Barrotes", "Botiquín", "Manuales", 
    "Piso de goma", "Colchoneta", "Cortinas", "Triángulos reflectantes", 
    "Extintor", "Chaleco reflectante"
  ]);
  const [newEquipmentItem, setNewEquipmentItem] = useState('');

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const snap = await getDoc(doc(db, 'system_config', 'equipment'));
        if (snap.exists() && snap.data().items) {
          setEquipmentList(snap.data().items);
        }
      } catch (err) {
        console.error("Error loading equipment config:", err);
      }
    };
    fetchEquipment();
  }, [db]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 w-full min-w-0 animate-in fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200"><CheckCircle className="text-amber-500 w-5 h-5"/> Lista de Equipamiento</h3>
      </div>
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-6 leading-tight">Agrega o elimina los ítems que los conductores deben verificar en el checklist. Se actualizará en los celulares al instante.</p>
      
      <form onSubmit={async (e) => {
        e.preventDefault();
        const item = newEquipmentItem.trim();
        if (!item) return;
        if (equipmentList.map(i=>i.toLowerCase()).includes(item.toLowerCase())) {
          return showAlert("Ese ítem ya está en la lista.");
        }
        const newList = [...equipmentList, item];
        try {
          await setDoc(doc(db, 'system_config', 'equipment'), { items: newList }, { merge: true });
          setEquipmentList(newList);
          setNewEquipmentItem('');
          showAlert("✅ Ítem agregado a la lista de equipamiento.");
        } catch (err) { showAlert("❌ Error al guardar."); }
      }} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input type="text" value={newEquipmentItem} onChange={(e) => setNewEquipmentItem(e.target.value)} placeholder="Ej: Gata, Chaleco, Botiquín..." autoComplete="off" autoCorrect="off" spellCheck="false" className="flex-1 min-w-0 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500 bg-transparent" />
        <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-black shadow-sm transition-colors flex items-center justify-center gap-2 shrink-0">
          <Plus className="w-5 h-5"/> Agregar
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {equipmentList.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-sm gap-2">
            <span className="flex-1 min-w-0 text-sm font-extrabold text-slate-700 dark:text-slate-300 break-words">{item}</span>
            <button type="button" onClick={() => showConfirm(`¿Eliminar "${item}" de la lista?`, async () => {
              const newList = equipmentList.filter(i => i !== item);
              try {
                await setDoc(doc(db, 'system_config', 'equipment'), { items: newList }, { merge: true });
                setEquipmentList(newList);
              } catch(err) { showAlert("❌ Error al eliminar."); }
            })} className="p-2 bg-white dark:bg-slate-900 text-red-500 hover:bg-red-50 dark:bg-red-900/30 hover:text-red-600 dark:text-red-400 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
              <Trash2 className="w-4 h-4"/>
            </button>
          </div>
        ))}
        {equipmentList.length === 0 && <p className="text-slate-400 text-center col-span-full py-4 text-sm font-bold">No hay ítems en la lista.</p>}
      </div>
    </div>
  );
}
