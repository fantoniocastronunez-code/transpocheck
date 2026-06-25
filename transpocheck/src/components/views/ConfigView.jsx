import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Camera, Eye, User, Edit2, Trash2, Truck, Clock, X } from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';
import { LICENCIAS, resizeImage } from '../../utils/helpers';

export default function ConfigView({ allClientsList, customClients, vehicles, drivers, db, showAlert, showConfirm }) {
  const [configSubTab, setConfigSubTab] = useState('clients');
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [fleetFilter, setFleetFilter] = useState('');
  const [driverDocs, setDriverDocs] = useState({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null });
  const [fullScreenDoc, setFullScreenDoc] = useState(null); 
  const handleDocUpload = async (e, field, size) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, size, 0.4);
      setDriverDocs(prev => ({ ...prev, [field]: dataUrl }));
    } catch (err) { showAlert("Error procesando foto."); }
  };

  const DocUploader = ({ field, label }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[9px] font-extrabold text-slate-500 uppercase">{label}</span>
        <div className="relative h-20 w-full border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 group hover:border-blue-400 transition-colors flex items-center justify-center">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => handleDocUpload(e, field, 800)} />
            {driverDocs[field] ? (
                <>
                    <img src={driverDocs[field]} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <span className="text-white text-xs font-bold flex flex-col items-center"><Camera className="w-4 h-4 mb-1"/> Cambiar</span>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); setFullScreenDoc(driverDocs[field]); }} className="absolute top-1 right-1 bg-white p-1.5 rounded-lg shadow-md z-30 hover:bg-slate-100"><Eye className="w-3.5 h-3.5 text-blue-600"/></button>
                </>
            ) : (
                <div className="text-center text-slate-400 group-hover:text-blue-500 flex flex-col items-center">
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-[9px] font-black uppercase">Subir</span>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="space-y-6 relative w-full">
      <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-none w-full">
         <button onClick={()=>setConfigSubTab('clients')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='clients'?'bg-blue-600 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Clientes</button>
         <button onClick={()=>setConfigSubTab('vehicles')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='vehicles'?'bg-blue-600 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Vehículos</button>
         <button onClick={()=>setConfigSubTab('drivers')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='drivers'?'bg-blue-600 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Conductores</button>
      </div>

      {configSubTab === 'clients' && (
        <div className="grid md:grid-cols-2 gap-6 w-full min-w-0">
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const name = fd.get('name'); const contactName = fd.get('contactName'); const email = fd.get('email').toLowerCase().trim(); try { if(editingClient){ await updateDoc(doc(db, 'clients', editingClient.id), { name, contactName, email }); setEditingClient(null); showAlert("Cliente actualizado"); } else { await addDoc(collection(db, 'clients'), { name, contactName, email, createdAt: Date.now() }); showAlert("Cliente agregado"); } e.target.reset(); } catch(err){} }} className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 w-full min-w-0">
            <h3 className="font-extrabold text-lg flex items-center gap-2"><User className="text-blue-600"/> {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <input name="name" defaultValue={editingClient?.name} placeholder="Nombre Empresa (Ej. Kovacs)" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-semibold"/>
            <div className="grid grid-cols-1 gap-3">
               <input name="contactName" defaultValue={editingClient?.contactName} placeholder="Nombre(s) Responsable(s) (Ej. Juan Pérez, Ana Silva)" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-semibold"/>
               <input name="email" type="text" defaultValue={editingClient?.email} placeholder="Correos Gmail (separados por coma. Ej: jefe@gmail.com, sec@gmail.com)" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-semibold"/>
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-1 leading-tight">Puedes agregar varios correos separados por coma. Cualquiera de ellos podrá iniciar sesión con Google y ver el portal.</p>
            <div className="flex gap-2 pt-2">
              {editingClient && <button type="button" onClick={()=>setEditingClient(null)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>}
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold shadow-sm transition-colors">{editingClient ? 'Actualizar Cliente' : 'Crear Acceso'}</button>
            </div>
          </form>
          <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 max-h-[60vh] overflow-y-auto w-full min-w-0">
             <h3 className="font-extrabold text-lg mb-4">Base de Clientes y Accesos</h3>
             <div className="space-y-3">
                {customClients.map((clientRecord) => (
                   <div key={clientRecord.id} className="flex justify-between items-center p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
                     <div className="flex-1 min-w-0 pr-2">
                        <p className="font-extrabold text-slate-800 text-sm truncate">{clientRecord.name}</p>
                        {clientRecord.contactName && <p className="text-xs font-bold text-slate-500 mt-1 truncate"><span className="text-slate-400 font-medium">Responsable(s):</span> {clientRecord.contactName}</p>}
                        {clientRecord.email && (
                           <div className="flex flex-wrap gap-1.5 mt-2">
                             {clientRecord.email.split(',').map((e, idx) => (
                               <span key={idx} className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-widest border border-emerald-100 truncate max-w-full"><User className="inline w-3 h-3 -mt-0.5 mr-1"/>{e.trim()}</span>
                             ))}
                           </div>
                        )}
                     </div>
                     <div className="flex gap-1.5 shrink-0 ml-1 border-l border-slate-200 pl-3">
                       <button onClick={()=>setEditingClient(clientRecord)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors shadow-sm"><Edit2 className="w-4 h-4"/></button>
                       <button onClick={()=>showConfirm("¿Eliminar cliente y sus accesos?", async()=>await deleteDoc(doc(db,'clients',clientRecord.id)))} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                     </div>
                   </div>
                ))}
                {customClients.length === 0 && (
                   <p className="text-sm font-bold text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl">Aún no hay clientes en la base de datos.</p>
                )}
             </div>
          </div>
        </div>
      )}

      {configSubTab === 'vehicles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0">
          <form key={editingVehicle ? editingVehicle.id : 'new'} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const client = fd.get('client') === 'OTRO' ? fd.get('manualClient') : fd.get('client'); const vehicleType = fd.get('vehicleType'); try { if(editingVehicle){ await updateDoc(doc(db, 'vehicles', editingVehicle.id), { client, vehicleType, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase() }); setEditingVehicle(null); showAlert("Vehículo actualizado."); } else { await addDoc(collection(db, 'vehicles'), { client, vehicleType, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase(), createdAt: Date.now() }); showAlert("Vehículo guardado."); } e.target.reset(); } catch (error) { error; } }} className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 w-full min-w-0">
            <h3 className="font-extrabold flex items-center gap-2"><Truck className="text-blue-600"/> {editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
            <select name="client" defaultValue={editingVehicle?.client || ''} className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 bg-white">
              <option value="">Cliente...</option>
              {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="OTRO">Otro (Se debe escribir manualmente)</option>
            </select>
            <input name="manualClient" placeholder="Si es OTRO, escribe el cliente aquí" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="brand" defaultValue={editingVehicle?.brand} placeholder="Marca (Ej. Chevrolet)" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="model" defaultValue={editingVehicle?.model} placeholder="Modelo (Ej. NPR 816)" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold" onChange={(e) => {
              const b = e.target.form.brand.value.trim().toLowerCase();
              const m = e.target.value.trim().toLowerCase();
              const match = vehicles.find(v => v.brand?.toLowerCase() === b && v.model?.toLowerCase() === m && v.vehicleType);
              if (match && e.target.form.vehicleType) e.target.form.vehicleType.value = match.vehicleType;
            }}/>
            <input name="plate" defaultValue={editingVehicle?.plate} placeholder="Patente" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm uppercase outline-none focus:border-blue-500 font-bold text-slate-800"/>
            <select name="vehicleType" defaultValue={editingVehicle?.vehicleType || 'auto'} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 bg-white">
               <option value="auto">🚙 Auto / SUV</option>
               <option value="camioneta">🛻 Camioneta</option>
               <option value="furgon_pequeno">🚐 Furgón Pequeño</option>
               <option value="furgon_grande">🚐 Furgón Grande</option>
               <option value="camion">🚚 Camión Simple</option>
               <option value="camion_doble">🚚 Camión Doble Cabina</option>
               <option value="camion_2ejes">🚛 Camión (2 Ejes traseros)</option>
               <option value="camion_3ejes">🚛 Camión (3 Ejes traseros)</option>
            </select>
            <div className="flex gap-2">
              {editingVehicle && <button type="button" onClick={()=>setEditingVehicle(null)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm w-1/3 hover:bg-slate-200 transition-colors">Cancelar</button>}
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">Guardar Vehículo</button>
            </div>
          </form>

          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 w-full min-w-0 flex flex-col">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h3 className="font-extrabold text-slate-800 whitespace-nowrap">Base Flota</h3>
              <select onChange={(e) => setFleetFilter(e.target.value)} className="border-2 border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-blue-500 flex-1 max-w-[150px] sm:max-w-full truncate">
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
                      {v.vehicleType && <span className="inline-block mt-1.5 text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-md uppercase backdrop-blur-md border border-white/10 truncate max-w-full">{v.vehicleType.replace('_', ' ')}</span>}
                    </div>
                    <div className="shrink-0 relative z-20">
                      <LicensePlateBadge text={v.plate} />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 relative z-20 justify-end border-t border-white/10 pt-3">
                    <button onClick={() => setEditingVehicle(v)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm shadow-sm"><Edit2 className="w-4 h-4 text-white"/></button>
                    <button onClick={()=>showConfirm("¿Eliminar vehículo?", async () => {try { await deleteDoc(doc(db, 'vehicles', v.id)); } catch (e) {}})} className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors backdrop-blur-sm shadow-sm"><Trash2 className="w-4 h-4 text-white"/></button>
                  </div>
                </div>
              )})}
              {vehicles.length === 0 && <p className="text-sm font-semibold text-slate-400 text-center py-4">No hay vehículos registrados</p>}
            </div>
          </div>
        </div>
      )}

      {configSubTab === 'drivers' && (
        <div className="grid md:grid-cols-2 gap-6">
          <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const data = { name: fd.get('driverName'), email: fd.get('driverEmail').toLowerCase(), licenses: fd.getAll('licenses'), licenseExpiry: fd.get('licenseExpiry'), ...driverDocs }; try { if (editingDriver) { await updateDoc(doc(db, 'drivers', editingDriver.id), data); setEditingDriver(null); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); showAlert("Perfil actualizado exitosamente."); } else { data.balance = 0; data.createdAt = Date.now(); await addDoc(collection(db, 'drivers'), data); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); showAlert("Conductor creado exitosamente."); } e.target.reset(); } catch (err) { console.error(err); } }} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 relative">
            <div className="flex justify-between items-start">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2"><User className="text-blue-600"/> {editingDriver ? 'Perfil del Conductor' : 'Nuevo Conductor'}</h3>
              {editingDriver?.createdAt && (
                <div className="text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Registro en App</span>
                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-blue-100 shadow-sm">
                    {new Date(editingDriver.createdAt).toLocaleDateString('es-CL')}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-center justify-center gap-2 pb-2">
              <label className="relative w-20 h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-900 group hover:border-blue-500 transition-colors shadow-inner">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDocUpload(e, 'photo', 160)} />
                {driverDocs.photo ? (
                  <img src={driverDocs.photo} alt="Previsualización" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center flex flex-col items-center justify-center">
                    <Camera className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Selfie</span>
                  </div>
                )}
              </label>
              {driverDocs.photo && <button type="button" onClick={() => setDriverDocs(prev => ({...prev, photo: null}))} className="text-[10px] font-bold text-red-500 hover:underline">Quitar foto</button>}
            </div>

            <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre completo" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail del conductor" required type="email" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            
            <div className="pt-2 border-t border-slate-100">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Documentación de Respaldo</h4>
               <div className="grid grid-cols-2 gap-3">
                  <DocUploader field="idFront" label="Carnet (Frente)" />
                  <DocUploader field="idBack" label="Carnet (Reverso)" />
                  <DocUploader field="licenseFront" label="Licencia (Frente)" />
                  <DocUploader field="licenseBack" label="Licencia (Reverso)" />
               </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-3 mt-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clase de Licencia</label>
               <div className="grid grid-cols-3 gap-1.5">
                  {LICENCIAS.map(l => (
                    <label key={l} className="flex items-center gap-1 p-1 bg-slate-50 border rounded-lg text-[11px] font-bold cursor-pointer hover:bg-slate-100">
                      <input type="checkbox" name="licenses" value={l} defaultChecked={editingDriver?.licenses?.includes(l)} className="w-3.5 h-3.5 cursor-pointer" />
                      {l}
                    </label>
                  ))}
               </div>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimiento Licencia</label>
               <input name="licenseExpiry" type="date" defaultValue={editingDriver?.licenseExpiry || ''} className="w-full border-2 p-2 rounded-xl text-sm font-semibold outline-none text-slate-700 bg-white" />
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              {editingDriver && <button type="button" onClick={() => { setEditingDriver(null); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-extrabold text-sm transition-colors">Cancelar</button>}
              <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-sm transition-colors shadow-lg shadow-blue-200">{editingDriver ? 'Guardar Perfil' : 'Crear Conductor'}</button>
            </div>
          </form>
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 max-h-[85vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-800 mb-4">Directorio Logístico</h3>
            <div className="space-y-2">
              {drivers.length === 0 ? <p className="text-sm font-semibold text-slate-400">Directorio vacío</p> : drivers.map(d=>(
                <div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl group transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center shadow-sm">
                      {d.photo ? (
                        <img src={d.photo} alt={d.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div className="truncate">
                      <p className="text-sm font-extrabold text-slate-800 truncate">{d.name}</p>
                      <p className="text-xs font-bold text-slate-400 truncate leading-tight">{d.email}</p>
                      {d.createdAt && <p className="text-[9px] font-bold text-slate-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3"/> Ingreso: {new Date(d.createdAt).toLocaleDateString('es-CL')}</p>}
                      {d.licenses && d.licenses.length > 0 && <p className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md mt-1.5 w-fit border border-blue-100">Licencias: {d.licenses.join(', ')}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                     <button onClick={() => { 
                       setEditingDriver(d); 
                       setDriverDocs({ photo: d.photo || null, idFront: d.idFront || null, idBack: d.idBack || null, licenseFront: d.licenseFront || null, licenseBack: d.licenseBack || null }); 
                     }} className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors shadow-sm text-xs font-bold flex items-center gap-1.5" title="Ver Perfil y Documentos"><User className="w-4 h-4"/> Perfil</button>
                     <button onClick={() => showConfirm("¿Eliminar conductor?", async()=>await deleteDoc(doc(db,'drivers',d.id)))} className="p-2 bg-red-100 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {fullScreenDoc && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-zoom-out animate-in fade-in" onClick={() => setFullScreenDoc(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors shadow-lg"><X className="w-6 h-6"/></button>
          <img src={fullScreenDoc} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}