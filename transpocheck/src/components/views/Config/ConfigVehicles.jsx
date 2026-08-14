import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Truck, Edit2, Trash2 } from 'lucide-react';
import LicensePlateBadge from '../../ui/LicensePlateBadge';

export default function ConfigVehicles({ allClientsList, vehicles, db, showAlert, showConfirm }) {
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [fleetFilter, setFleetFilter] = useState('');

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
        <div className="flex justify-between items-center mb-4 gap-2">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-200 whitespace-nowrap">Base Flota</h3>
          <select onChange={(e) => setFleetFilter(e.target.value)} className="border-2 border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 outline-none focus:border-blue-500 flex-1 max-w-[150px] sm:max-w-full truncate bg-transparent">
            <option value="">Todos los Clientes</option>
            {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="OTRO">Otros</option>
          </select>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 sm:pr-2">
          {vehicles.filter(v => {
            if (!fleetFilter) return true;
            if (fleetFilter === 'OTRO') return !allClientsList.includes(v.client);
            return v.client === fleetFilter;
          }).map(v=>{
            const clientUpper = v.client?.toUpperCase() || '';
            const grad = clientUpper.includes('KOVACS') ? 'from-red-600 to-red-800' : clientUpper.includes('SALFA') ? 'from-emerald-600 to-emerald-800' : clientUpper.includes('GRANDLEASING') ? 'from-slate-700 to-slate-900' : 'from-blue-600 to-blue-800';
            
            const logoUrl = clientUpper.includes('KOVACS') ? '/logos/kovacs.png' : 
                            clientUpper.includes('SALFA') ? '/logos/salfa.png' : 
                            clientUpper.includes('GRANDLEASING') ? '/logos/grandleasing.png' : 
                            clientUpper.includes('ENEX') ? '/logos/enex.png' : 
                            `/logos/${v.client?.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

            let emoji = '🚙';
            if (v.vehicleType === 'camioneta') emoji = '🛻';
            else if (v.vehicleType?.includes('furgon')) emoji = '🚐';
            else if (v.vehicleType?.includes('2ejes') || v.vehicleType?.includes('3ejes') || v.vehicleType?.includes('8x4')) emoji = '🚛';
            else if (v.vehicleType?.includes('camion')) emoji = '🚚';
            else if (v.vehicleType === 'carro_arrastre') emoji = '🛒';

            return (
            <div key={v.id} className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl shadow-md bg-gradient-to-br ${grad} text-white group transition-all w-full`}>
              
              <div className="absolute -left-2 -bottom-2 w-32 h-32 opacity-30 pointer-events-none mix-blend-overlay rotate-[-15deg] grayscale">
                <img src={logoUrl} alt="" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'}/>
              </div>

              <div className="absolute -right-2 -bottom-4 opacity-40 pointer-events-none text-[120px] leading-none select-none mix-blend-overlay grayscale">
                {emoji}
              </div>

              <div className="flex justify-between items-start gap-2 relative z-10 w-full">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest truncate">{v.client || 'Sin cliente'}</p>
                  <p className="text-base sm:text-lg font-black leading-tight mt-0.5 truncate">{v.brand} {v.model}</p>
                  {v.vehicleType && <span className="inline-block mt-1.5 text-[9px] font-black bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md uppercase backdrop-blur-md border border-white dark:border-slate-800/10 truncate max-w-full">{v.vehicleType.replace('_', ' ')}</span>}
                </div>
                <div className="shrink-0 relative z-20">
                  <LicensePlateBadge text={v.plate} />
                </div>
              </div>

              <div className="flex gap-2 mt-4 relative z-20 justify-end border-t border-white dark:border-slate-800/10 pt-3">
                <button onClick={() => {setEditingVehicle(v); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-white dark:bg-slate-900 hover:bg-white dark:bg-slate-900 rounded-lg transition-colors backdrop-blur-sm shadow-sm"><Edit2 className="w-4 h-4 text-white"/></button>
                <button onClick={()=>showConfirm("¿Eliminar vehículo?", async () => {try { await deleteDoc(doc(db, 'vehicles', v.id)); } catch (e) {}})} className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors backdrop-blur-sm shadow-sm"><Trash2 className="w-4 h-4 text-white"/></button>
              </div>
            </div>
          )})}
          {vehicles.length === 0 && <p className="text-sm font-semibold text-slate-400 text-center py-4">No hay vehículos registrados</p>}
        </div>
      </div>
    </div>
  );
}
