import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { Ticket, Edit2, Trash2 } from 'lucide-react';

export default function ConfigTolls({ db, showAlert, showConfirm }) {
  const [editingToll, setEditingToll] = useState(null);
  const [tollsList, setTollsList] = useState([]);

  useEffect(() => {
    const fetchTolls = async () => {
      try {
        const snapTolls = await getDocs(collection(db, 'tolls'));
        setTollsList(snapTolls.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.error("Error cargando peajes:", e); }
    };
    fetchTolls();
  }, [db]);

  return (
    <div className="grid md:grid-cols-2 gap-6 w-full min-w-0 animate-in fade-in">
      <form key={editingToll ? editingToll.id : 'new-toll'} onSubmit={async (e) => {
         e.preventDefault();
         const fd = new FormData(e.target);
         const data = {
            name: fd.get('name')?.trim() || '',
            route: fd.get('route')?.trim() || '',
            prices: {
               'Auto / SUV': Number(fd.get('priceAuto')) || 0,
               'Camioneta': Number(fd.get('priceCamioneta')) || 0,
               'Furgón Pequeño': Number(fd.get('priceFurgonPequeno')) || 0,
               'Furgón Grande': Number(fd.get('priceFurgonGrande')) || 0,
               'Camión Simple': Number(fd.get('priceCamionSimple')) || 0,
               'Camión Doble Cabina': Number(fd.get('priceCamionDoble')) || 0,
               'Camión (2 Ejes traseros)': Number(fd.get('priceCamion2Ejes')) || 0,
               'Camión (3 Ejes traseros)': Number(fd.get('priceCamion3Ejes')) || 0,
               'Camión Rigid (8x4)': Number(fd.get('priceCamion8x4')) || 0,
               'Carro Arrastre': Number(fd.get('priceCarro')) || 0
            }
         };

         try {
            if (editingToll) {
               await updateDoc(doc(db, 'tolls', editingToll.id), data);
               setEditingToll(null);
               showAlert("✅ Peaje actualizado.");
            } else {
               await addDoc(collection(db, 'tolls'), data);
               showAlert("✅ Nuevo peaje creado.");
            }
            const snap = await getDocs(collection(db, 'tolls'));
            setTollsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            e.target.reset();
         } catch (err) { showAlert("❌ Error al guardar peaje."); }
      }} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
         <div className="flex justify-between items-center">
            <h3 className="font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200"><Ticket className="text-emerald-600 dark:text-emerald-400 w-5 h-5"/> {editingToll ? 'Editar Peaje' : 'Nuevo Peaje'}</h3>
            {editingToll && <button type="button" onClick={()=>setEditingToll(null)} className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg uppercase transition-colors hover:bg-slate-200 dark:bg-slate-700">Cancelar</button>}
         </div>
         <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 leading-tight">Configura el nombre, la ruta y el costo por tipo de vehículo para calcular rápidamente en las rendiciones.</p>
         
         <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Peaje <span className="text-red-500">*</span></label>
            <input name="name" defaultValue={editingToll?.name} placeholder="Ej: Peaje Lampa" required autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold bg-transparent"/>
         </div>
         
         <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ruta / Autopista (Opcional)</label>
            <input name="route" defaultValue={editingToll?.route} placeholder="Ej: Ruta 5 Norte" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold bg-transparent"/>
         </div>

         <div className="grid grid-cols-2 gap-3 bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
            <div className="col-span-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border-b border-emerald-200 dark:border-emerald-800/50/50 pb-1 mb-1">Valores por Categoría de Vehículo</div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Auto / SUV ($)</label>
               <input name="priceAuto" type="number" defaultValue={editingToll?.prices?.['Auto / SUV']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camioneta ($)</label>
               <input name="priceCamioneta" type="number" defaultValue={editingToll?.prices?.['Camioneta']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Furgón Pequeño ($)</label>
               <input name="priceFurgonPequeno" type="number" defaultValue={editingToll?.prices?.['Furgón Pequeño']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Furgón Grande ($)</label>
               <input name="priceFurgonGrande" type="number" defaultValue={editingToll?.prices?.['Furgón Grande']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión Simple ($)</label>
               <input name="priceCamionSimple" type="number" defaultValue={editingToll?.prices?.['Camión Simple']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión Doble ($)</label>
               <input name="priceCamionDoble" type="number" defaultValue={editingToll?.prices?.['Camión Doble Cabina']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión (2 Ejes) ($)</label>
               <input name="priceCamion2Ejes" type="number" defaultValue={editingToll?.prices?.['Camión (2 Ejes traseros)']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión (3 Ejes) ($)</label>
               <input name="priceCamion3Ejes" type="number" defaultValue={editingToll?.prices?.['Camión (3 Ejes traseros)']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión (8x4) ($)</label>
               <input name="priceCamion8x4" type="number" defaultValue={editingToll?.prices?.['Camión Rigid (8x4)']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Carro Arrastre ($)</label>
               <input name="priceCarro" type="number" defaultValue={editingToll?.prices?.['Carro Arrastre']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
            </div>
         </div>

         <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-sm transition-colors shadow-md shadow-emerald-200 mt-2">
            {editingToll ? 'Guardar Cambios' : 'Agregar Peaje'}
         </button>
      </form>

      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-h-[85vh] flex flex-col">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-4">
           <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Base de Peajes</h3>
           <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">Total: {tollsList.length}</span>
         </div>
         <div className="space-y-2 overflow-y-auto pr-1 flex-1">
           {tollsList.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-4">No hay peajes configurados.</p> : tollsList.map(t=>(
             <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-emerald-200 dark:border-emerald-800/50 transition-all group">
               <div className="flex-1 min-w-0 pr-2">
                 <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 truncate">{t.name}</p>
                 {t.route && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{t.route}</p>}
                 <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚙 Auto: ${t.prices?.['Auto / SUV'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🛻 Camioneta: ${t.prices?.['Camioneta'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚐 Furgón P: ${t.prices?.['Furgón Pequeño'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚐 Furgón G: ${t.prices?.['Furgón Grande'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚚 Camión S: ${t.prices?.['Camión Simple'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚚 Camión DC: ${t.prices?.['Camión Doble Cabina'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚛 Camión 2E: ${t.prices?.['Camión (2 Ejes traseros)'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚛 Camión 3E: ${t.prices?.['Camión (3 Ejes traseros)'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚚 Camión 8x4: ${t.prices?.['Camión Rigid (8x4)'] || 0}</span>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🛒 Carro: ${t.prices?.['Carro Arrastre'] || 0}</span>
                 </div>
               </div>
               <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                  <button onClick={() => {setEditingToll(t); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors shadow-sm" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                  <button onClick={() => showConfirm(`¿Eliminar peaje ${t.name}?`, async () => { 
                      await deleteDoc(doc(db,'tolls',t.id));
                      setTollsList(tollsList.filter(item => item.id !== t.id));
                  })} className="p-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
               </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
}
