import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Truck, Edit2, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import LicensePlateBadge from '../../ui/LicensePlateBadge';

export default function ConfigVehicles({ allClientsList, vehicles, db, showAlert, showConfirm }) {
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [expandedClients, setExpandedClients] = useState({});

  const toggleClient = (c) => setExpandedClients(p => ({...p, [c]: !p[c]}));

  // Group vehicles by client
  const groupedVehicles = {};
  vehicles.forEach(v => {
      const c = v.client || 'Sin Cliente';
      if (!groupedVehicles[c]) groupedVehicles[c] = [];
      groupedVehicles[c].push(v);
  });

  const handleBulkClean = async () => {
     const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
     const toDelete = vehicles.filter(v => {
         const trips = v.tripsCount || 0;
         if (trips > 1) return false;
         const refDate = v.lastTripDate || v.createdAt || 0;
         return refDate < thirtyDaysAgo;
     });

     if (toDelete.length === 0) return showAlert("No hay vehículos inactivos que cumplan las condiciones (máximo 1 traslado y más de 30 días de inactividad).");

     showConfirm(`¿Estás seguro de borrar masivamente ${toDelete.length} vehículos inactivos?`, async () => {
         showAlert(`⏳ Borrando ${toDelete.length} vehículos...`);
         try {
             const deletePromises = toDelete.map(v => deleteDoc(doc(db, 'vehicles', v.id)));
             await Promise.all(deletePromises);
             showAlert(`✅ ${toDelete.length} vehículos eliminados exitosamente.`);
         } catch(e) {
             console.error(e);
             showAlert("❌ Error al borrar vehículos.");
         }
     });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0">
      <form key={editingVehicle ? editingVehicle.id : 'new'} onSubmit={async (e) => { 
        e.preventDefault(); 
        const fd = new FormData(e.target); 
        const client = fd.get('client') === 'OTRO' ? fd.get('manualClient') : fd.get('client'); 
        const vehicleType = fd.get('vehicleType'); 
        try { 
            if(editingVehicle){ 
                await updateDoc(doc(db, 'vehicles', editingVehicle.id), { client, vehicleType, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase() }); 
                setEditingVehicle(null); 
                showAlert("Vehículo actualizado."); 
            } else { 
                await addDoc(collection(db, 'vehicles'), { client, vehicleType, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase(), createdAt: Date.now() }); 
                showAlert("Vehículo guardado."); 
            } 
            e.target.reset(); 
        } catch (error) { 
            console.error("Error guardando vehículo:", error); 
            showAlert("❌ Error al guardar el vehículo."); 
        } 
      }} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 w-full min-w-0">
        <h3 className="font-extrabold flex items-center gap-2"><Truck className="text-blue-600 dark:text-blue-400"/> {editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
        <select name="client" defaultValue={editingVehicle?.client || ''} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
          <option value="">Cliente...</option>
          {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="OTRO">Otro (Se debe escribir manualmente)</option>
        </select>
        <input name="manualClient" placeholder="Si es OTRO, escribe el cliente aquí" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold bg-transparent"/>
        <input name="brand" defaultValue={editingVehicle?.brand} placeholder="Marca (Ej. Chevrolet)" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold bg-transparent"/>
        <input name="model" defaultValue={editingVehicle?.model} placeholder="Modelo (Ej. NPR 816)" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold bg-transparent" onChange={(e) => {
          const b = e.target.form.brand.value.trim().toLowerCase();
          const m = e.target.value.trim().toLowerCase();
          const match = vehicles.find(v => v.brand?.toLowerCase() === b && v.model?.toLowerCase() === m && v.vehicleType);
          if (match && e.target.form.vehicleType) e.target.form.vehicleType.value = match.vehicleType;
        }}/>
        <input name="plate" defaultValue={editingVehicle?.plate} placeholder="Patente" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm uppercase outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-200 bg-transparent"/>
        <select name="vehicleType" defaultValue={editingVehicle?.vehicleType || 'auto'} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
           <option value="auto">🚙 Auto / SUV</option>
           <option value="camioneta">🛻 Camioneta</option>
           <option value="furgon_pequeno">🚐 Furgón Pequeño</option>
           <option value="furgon_grande">🚐 Furgón Grande</option>
           <option value="camion">🚚 Camión Simple</option>
           <option value="camion_doble">🚚 Camión Doble Cabina</option>
           <option value="camion_2ejes">🚛 Camión (2 Ejes traseros)</option>
           <option value="camion_3ejes">🚛 Camión (3 Ejes traseros)</option>
           <option value="camion_8x4">🚚 Camión Rigid (8x4)</option>
           <option value="carro_arrastre">🛒 Carro Arrastre</option>
        </select>
        <div className="flex gap-2">
          {editingVehicle && <button type="button" onClick={()=>setEditingVehicle(null)} className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl font-bold text-sm w-1/3 hover:bg-slate-200 dark:bg-slate-700 transition-colors">Cancelar</button>}
          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">Guardar Vehículo</button>
        </div>
      </form>

      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 w-full min-w-0 flex flex-col">
        <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-200 whitespace-nowrap">Base Flota Agrupada</h3>
          <button onClick={handleBulkClean} className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors">
            <AlertTriangle className="w-4 h-4"/> Limpiar Inactivos
          </button>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 sm:pr-2">
          {Object.keys(groupedVehicles).sort().map(clientName => {
             const isExpanded = expandedClients[clientName];
             const clientVehicles = groupedVehicles[clientName];
             
             return (
               <div key={clientName} className="border-2 border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                  <button onClick={() => toggleClient(clientName)} className="w-full flex justify-between items-center p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors outline-none focus:ring-2 ring-inset ring-blue-500">
                     <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm">
                           {clientVehicles.length}
                        </div>
                        <span className="font-extrabold text-slate-700 dark:text-slate-200 uppercase">{clientName}</span>
                     </div>
                     {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
                  </button>

                  {isExpanded && (
                     <div className="p-3 space-y-2 bg-slate-50 dark:bg-slate-800/30">
                       {clientVehicles.map(v => {
                          const tripsCount = v.tripsCount || 0;
                          return (
                            <div key={v.id} className="flex flex-wrap sm:flex-nowrap justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 gap-3">
                               <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <LicensePlateBadge text={v.plate} />
                                    {v.vehicleType && <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md uppercase text-slate-600 dark:text-slate-300">{v.vehicleType.replace('_', ' ')}</span>}
                                  </div>
                                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase truncate max-w-[150px] sm:max-w-xs">{v.brand} {v.model}</p>
                                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 mt-1 uppercase">Trasladado: {tripsCount} ve{tripsCount === 1 ? 'z' : 'ces'}</p>
                               </div>
                               <div className="flex gap-2">
                                  <button onClick={() => {setEditingVehicle(v); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"><Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
                                  <button onClick={()=>showConfirm("¿Eliminar vehículo?", async () => {try { await deleteDoc(doc(db, 'vehicles', v.id)); } catch (e) {}})} className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                               </div>
                            </div>
                          );
                       })}
                     </div>
                  )}
               </div>
             );
          })}
          {vehicles.length === 0 && <p className="text-sm font-semibold text-slate-400 text-center py-4">No hay vehículos registrados</p>}
        </div>
      </div>
    </div>
  );
}
