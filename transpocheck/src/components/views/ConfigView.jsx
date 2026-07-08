import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { Camera, Eye, EyeOff, User, Edit2, Trash2, Truck, Clock, X, Plus, BookOpen, Phone, CheckCircle } from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';
import { LICENCIAS, resizeImage } from '../../utils/helpers';

export default function ConfiView({ allClientsList, customClients, vehicles, drivers, db, showAlert, showConfirm }) {
  const [configSubTab, setConfigSubTab] = useState('clients');
  const [editingDir, setEditingDir] = useState(null); 
  const [directoryList, setDirectoryList] = useState([]); 
  
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const snap = await getDocs(collection(db, 'directory'));
        setDirectoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.error("Error cargando directorio:", e); }
    };
    fetchDirectory();
  }, [db, configSubTab]);

  const [editingDriver, setEditingDriver] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [fleetFilter, setFleetFilter] = useState('');
  const [driverDocs, setDriverDocs] = useState({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null });
  const [fullScreenDoc, setFullScreenDoc] = useState(null); 
  
  const [clientContacts, setClientContacts] = useState([{ name: '', email: '' }]);
  
  const defaultNotifs = { creado: false, asignado: true, llegada_origen: false, en_ruta: true, llegada_destino: false, finalizado: true };
  const [clientNotifs, setClientNotifs] = useState(defaultNotifs);

  React.useEffect(() => {
    if (editingClient) {
       const emails = editingClient.email ? editingClient.email.split(',').map(e => e.trim()).filter(Boolean) : [];
       const names = editingClient.contactName ? editingClient.contactName.split(',').map(n => n.trim()) : [];
       const mapped = emails.map((e, i) => ({ email: e, name: names[i] || '' }));
       setClientContacts(mapped.length > 0 ? mapped : [{ name: '', email: '' }]);
       
       setClientNotifs(editingClient.notifications || {
          creado: false,
          asignado: !!editingClient.enableNotifications,
          llegada_origen: false,
          en_ruta: !!editingClient.enableNotifications,
          llegada_destino: false,
          finalizado: !!editingClient.enableNotifications
       });
    } else {
       setClientContacts([{ name: '', email: '' }]);
       setClientNotifs(defaultNotifs);
    }
  }, [editingClient]);

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
         <button onClick={()=>setConfigSubTab('directory')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='directory'?'bg-blue-600 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Directorio</button>
      </div>

      {configSubTab === 'clients' && (
        <div className="grid md:grid-cols-2 gap-6 w-full min-w-0">
          <form onSubmit={async (e) => { 
             e.preventDefault(); 
             const fd = new FormData(e.target); 
             const name = fd.get('name'); 
             
             const validContacts = clientContacts.filter(c => c.email.trim() !== '');
             if (validContacts.length === 0) return showAlert("Debes agregar al menos un correo de acceso.");
             
             const email = validContacts.map(c => c.email.trim().toLowerCase()).join(','); 
             const contactName = validContacts.map(c => c.name.trim() || 'Usuario').join(','); 
             const enableNotifications = Object.values(clientNotifs).some(v => v); 
             
             try { 
                 if(editingClient){ 
                     await updateDoc(doc(db, 'clients', editingClient.id), { name, contactName, email, enableNotifications, notifications: clientNotifs }); 
                     setEditingClient(null); 
                     showAlert("Cliente y accesos actualizados."); 
                 } else { 
                     await addDoc(collection(db, 'clients'), { name, contactName, email, enableNotifications, notifications: clientNotifs, createdAt: Date.now() }); 
                     showAlert("Cliente agregado."); 
                 } 
                 e.target.reset(); 
                 setClientContacts([{ name: '', email: '' }]);
                 setClientNotifs(defaultNotifs);
             } catch(err){} 
          }} className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5 w-full min-w-0">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
               <h3 className="font-extrabold text-lg flex items-center gap-2 text-slate-800">
                  <User className="text-blue-600"/> {editingClient ? 'Añadir/Editar Accesos' : 'Nuevo Cliente'}
               </h3>
               {editingClient && (
                  <button type="button" onClick={() => setEditingClient(null)} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-slate-200 transition-colors">
                     Cancelar
                  </button>
               )}
            </div>

            <div className="space-y-4">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Seleccionar Empresa</label>
                 <select 
                    value={editingClient ? editingClient.id : 'NEW'} 
                    onChange={(e) => {
                       if (e.target.value === 'NEW') {
                          setEditingClient(null);
                       } else {
                          const found = customClients.find(c => c.id === e.target.value);
                          if (found) setEditingClient(found);
                       }
                    }}
                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 bg-white shadow-sm"
                 >
                    <option value="NEW">✨ NUEVO CLIENTE (Crear desde cero)</option>
                    {customClients.map(c => (
                       <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                 </select>
               </div>

               <div className="animate-in fade-in slide-in-from-top-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    {editingClient ? 'Nombre de la Empresa (Editable)' : 'Nombre de la Nueva Empresa'}
                 </label>
                 <input 
                    name="name" 
                    key={editingClient ? editingClient.id : 'new-input'}
                    defaultValue={editingClient?.name || ''} 
                    placeholder="Ej. Automotora Kovacs" 
                    required 
                    className={`w-full border-2 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-colors shadow-sm ${editingClient ? 'border-slate-200 text-slate-800 bg-white' : 'border-blue-200 bg-blue-50 text-blue-900'}`} 
                 />
               </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-inner">
               <div className="flex justify-between items-center mb-4">
                  <div>
                     <label className="text-xs font-black text-slate-700 uppercase tracking-wide block">Cuentas de Acceso</label>
                     <p className="text-[9px] font-bold text-slate-500 leading-tight mt-0.5">Asocia a los usuarios que podrán ver a este cliente.</p>
                  </div>
                  <button type="button" onClick={() => setClientContacts([...clientContacts, { name: '', email: '' }])} className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-2 rounded-lg uppercase tracking-wider hover:bg-blue-200 transition-colors flex items-center gap-1 shadow-sm shrink-0">
                     <Plus className="w-3.5 h-3.5"/> Añadir Otro
                  </button>
               </div>
               
               <div className="space-y-3">
                   {clientContacts.map((contact, index) => (
                       <div key={index} className="flex flex-col sm:flex-row gap-0 sm:gap-2 bg-white p-1 sm:p-2 rounded-xl border border-slate-200 shadow-sm relative group">
                           <div className="flex-1 relative pt-3 px-2 sm:pt-0 sm:px-0">
                               <span className="absolute top-1 left-2 sm:-top-2 sm:left-2 sm:bg-white sm:px-1 text-[8px] font-black text-slate-400 uppercase">Nombre del Responsable</span>
                               <input type="text" placeholder="Ej. Juan Pérez" value={contact.name} onChange={(e) => { const newContacts = [...clientContacts]; newContacts[index].name = e.target.value; setClientContacts(newContacts); }} className="w-full bg-transparent p-2 pt-3 sm:pt-2.5 text-xs font-bold text-slate-700 outline-none focus:text-blue-600 border-b sm:border-b-0 border-slate-100" />
                           </div>
                           <div className="hidden sm:block w-px bg-slate-100 my-1"></div>
                           <div className="flex-1 relative pt-3 px-2 pb-2 sm:p-0">
                               <span className="absolute top-1 left-2 sm:-top-2 sm:left-2 sm:bg-white sm:px-1 text-[8px] font-black text-slate-400 uppercase">Correo Gmail</span>
                               <input type="email" placeholder="usuario@gmail.com" value={contact.email} onChange={(e) => { const newContacts = [...clientContacts]; newContacts[index].email = e.target.value; setClientContacts(newContacts); }} className="w-full bg-transparent p-2 pt-3 sm:pt-2.5 text-xs font-bold text-slate-700 outline-none focus:text-blue-600" />
                           </div>
                           {clientContacts.length > 1 && (
                               <button type="button" onClick={() => { const newContacts = [...clientContacts]; newContacts.splice(index, 1); setClientContacts(newContacts); }} className="sm:self-center p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors absolute right-1 top-1 sm:relative sm:top-0 sm:right-0">
                                   <Trash2 className="w-4 h-4"/>
                               </button>
                           )}
                       </div>
                   ))}
               </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-sm space-y-3">
               <div className="border-b border-blue-200/50 pb-2">
                  <p className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5"><Eye className="w-4 h-4"/> Panel de Notificaciones (Correos)</p>
                  <p className="text-[10px] font-bold text-blue-600 mt-0.5 leading-tight">Selecciona exactamente qué actualizaciones recibirá el cliente en su correo.</p>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {[
                    { id: 'creado', label: 'Creado' },
                    { id: 'asignado', label: 'Asignado' },
                    { id: 'llegada_origen', label: 'En Origen' },
                    { id: 'en_ruta', label: 'En Ruta' },
                    { id: 'llegada_destino', label: 'En Destino' },
                    { id: 'finalizado', label: 'Acta PDF' }
                  ].map(notif => {
                     const isActive = clientNotifs[notif.id];
                     return (
                       <button
                         key={notif.id}
                         type="button"
                         onClick={() => setClientNotifs({...clientNotifs, [notif.id]: !isActive})}
                         className={`py-3 px-1.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1.5 select-none ${
                           isActive
                             ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-100'
                             : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 scale-[0.98]'
                         }`}
                       >
                         {isActive ? <CheckCircle className="w-5 h-5 mb-0.5 animate-in zoom-in duration-200" /> : <div className="w-5 h-5 mb-0.5 rounded-full border-2 border-slate-300 bg-white"></div>}
                         <span className="text-center leading-tight">{notif.label}</span>
                       </button>
                     );
                  })}
               </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-sm shadow-md shadow-blue-200 transition-all active:scale-[0.98]">
               {editingClient ? 'Guardar Cambios del Cliente' : 'Crear Cliente y Accesos'}
            </button>
          </form>
          <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 max-h-[60vh] overflow-y-auto w-full min-w-0">
             <h3 className="font-extrabold text-lg mb-4">Base de Clientes y Accesos</h3>
             <div className="space-y-3">
                {customClients.map((clientRecord) => (
                   <div key={clientRecord.id} className="flex justify-between items-center p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
                     <div className="flex-1 min-w-0 pr-2">
                        <p className="font-extrabold text-slate-800 text-sm truncate">{clientRecord.name}</p>
                        {clientRecord.contactName && <p className="text-xs font-bold text-slate-500 mt-1 truncate"><span className="text-slate-400 font-medium">Responsable(s):</span> {clientRecord.contactName}</p>}
                        <div className="mt-1 flex flex-wrap gap-1">
                           {clientRecord.notifications ? (
                             Object.entries(clientRecord.notifications).filter(([k,v]) => v).map(([k, v]) => (
                               <span key={k} className="text-[8px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded uppercase tracking-widest border border-blue-200 shrink-0">
                                 {k.replace('_', ' ')}
                               </span>
                             ))
                           ) : clientRecord.enableNotifications ? (
                             <span className="text-[8px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded uppercase tracking-widest border border-blue-200 shrink-0">🔔 Avisos On</span>
                           ) : (
                             <span className="text-[8px] font-black text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded uppercase tracking-widest border border-slate-300 shrink-0">🔕 Avisos Off</span>
                           )}
                        </div>

                        {clientRecord.email && (
                           <div className="flex flex-col gap-1.5 mt-3 border-t border-slate-200/60 pt-3">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Cuentas Autorizadas:</p>
                             <div className="flex flex-wrap gap-2">
                                 {clientRecord.email.split(',').map((e, idx) => {
                                     const namesArray = clientRecord.contactName ? clientRecord.contactName.split(',') : [];
                                     const associatedName = namesArray[idx] ? namesArray[idx].trim() : 'Usuario';
                                     return (
                                       <span key={idx} className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm max-w-full">
                                         <User className="w-3 h-3 text-blue-500 shrink-0"/>
                                         <span className="font-black text-slate-800 truncate">{associatedName}</span> 
                                         <span className="text-slate-400 truncate hidden sm:inline">({e.trim()})</span>
                                       </span>
                                     );
                                 })}
                             </div>
                           </div>
                        )}
                     </div>
                     <div className="flex flex-col gap-1.5 shrink-0 ml-2 border-l border-slate-200 pl-3">
                       <button onClick={()=>{setEditingClient(clientRecord); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors shadow-sm"><Edit2 className="w-4 h-4"/></button>
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
               <option value="camion_8x4">🚚 Camión Rigid (8x4)</option>
               <option value="carro_arrastre">🛒 Carro Arrastre</option>
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
                    <button onClick={() => {setEditingVehicle(v); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm shadow-sm"><Edit2 className="w-4 h-4 text-white"/></button>
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
                <div key={d.id} className={`flex justify-between items-center p-3 border rounded-xl group transition-all ${d.isHidden ? 'bg-slate-100 border-slate-200 opacity-75' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center shadow-sm relative">
                      {d.photo ? (
                        <img src={d.photo} alt={d.name} className={`w-full h-full object-cover ${d.isHidden ? 'grayscale' : ''}`} />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                      {d.isHidden && <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center"><EyeOff className="w-4 h-4 text-white"/></div>}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                         <p className={`text-sm font-extrabold truncate ${d.isHidden ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-800'}`}>{d.name}</p>
                         {d.isHidden && <span className="bg-slate-200 text-slate-500 border border-slate-300 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">Oculto</span>}
                      </div>
                      <p className="text-xs font-bold text-slate-400 truncate leading-tight">{d.email}</p>
                      {d.createdAt && <p className="text-[9px] font-bold text-slate-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3"/> Ingreso: {new Date(d.createdAt).toLocaleDateString('es-CL')}</p>}
                      {d.licenses && d.licenses.length > 0 && <p className={`text-[9px] font-black px-2 py-0.5 rounded-md mt-1.5 w-fit border ${d.isHidden ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>Licencias: {d.licenses.join(', ')}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                     <button onClick={async () => {
                         try { await updateDoc(doc(db, 'drivers', d.id), { isHidden: !d.isHidden }); }
                         catch (e) { showAlert("Error al cambiar estado."); }
                     }} className={`p-2 rounded-lg transition-colors shadow-sm ${d.isHidden ? 'bg-green-100 text-green-600 hover:bg-green-200 border border-green-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`} title={d.isHidden ? "Restaurar Conductor" : "Ocultar Conductor"}>
                         {d.isHidden ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                     </button>
                     <button onClick={() => { 
                       setEditingDriver(d); 
                       setDriverDocs({ photo: d.photo || null, idFront: d.idFront || null, idBack: d.idBack || null, licenseFront: d.licenseFront || null, licenseBack: d.licenseBack || null }); 
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                     }} className={`px-3 py-2 rounded-lg transition-colors shadow-sm text-xs font-bold flex items-center gap-1.5 ${d.isHidden ? 'bg-slate-200 text-slate-500 hover:bg-slate-300' : 'bg-blue-100 hover:bg-blue-200 text-blue-600'}`} title="Ver Perfil y Documentos"><User className="w-4 h-4"/> Perfil</button>
                     <button onClick={() => showConfirm("¿Eliminar conductor?", async()=>await deleteDoc(doc(db,'drivers',d.id)))} className="p-2 bg-red-100 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {configSubTab === 'directory' && (
        <div className="grid md:grid-cols-2 gap-6 w-full min-w-0">
          <form key={editingDir ? editingDir.id : 'new-dir'} onSubmit={async (e) => { 
             e.preventDefault(); 
             const fd = new FormData(e.target); 
             const data = { 
                placeName: fd.get('placeName').trim(), 
                contactName: fd.get('contactName').trim(), 
                contactPhone: fd.get('contactPhone').trim(),
                address: fd.get('address')?.trim() || '',
                commune: fd.get('commune')?.trim() || ''
             }; 
             try { 
                if (editingDir) { 
                   await updateDoc(doc(db, 'directory', editingDir.id), data); 
                   setEditingDir(null); 
                   showAlert("Destino actualizado."); 
                } else { 
                   await addDoc(collection(db, 'directory'), data); 
                   showAlert("Destino guardado en el directorio."); 
                } 
                const snap = await getDocs(collection(db, 'directory'));
                setDirectoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                e.target.reset(); 
             } catch (err) { showAlert("Error al guardar."); } 
          }} className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
               <h3 className="font-extrabold flex items-center gap-2 text-slate-800"><BookOpen className="text-blue-600 w-5 h-5"/> {editingDir ? 'Editar Destino' : 'Nuevo Destino'}</h3>
               {editingDir && <button type="button" onClick={()=>setEditingDir(null)} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg uppercase">Cancelar</button>}
            </div>
            <p className="text-[10px] font-bold text-slate-500 mb-2 leading-tight">Agrega los destinos frecuentes. Cuando crees un trabajo y escribas exactamente el mismo lugar, el sistema adjuntará a este encargado automáticamente.</p>
            
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lugar / Destino exacto</label>
               <input name="placeName" defaultValue={editingDir?.placeName} placeholder="Ej: Samex Quilicura" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Encargado</label>
               <input name="contactName" defaultValue={editingDir?.contactName} placeholder="Ej: Luis Ahumada" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono (Llamada o WhatsApp)</label>
               <input name="contactPhone" defaultValue={editingDir?.contactPhone} placeholder="Ej: +56912345678" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección Exacta</label>
                  <input name="address" defaultValue={editingDir?.address} placeholder="Ej: Av. Américo Vespucio 1501" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comuna / Ciudad</label>
                  <input name="commune" defaultValue={editingDir?.commune} placeholder="Ej: Quilicura" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
               </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-sm transition-colors shadow-md shadow-blue-200 mt-2">
               {editingDir ? 'Guardar Cambios' : 'Agregar al Directorio'}
            </button>
          </form>

          <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 max-h-[85vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-800 mb-4">Destinos Guardados</h3>
            <div className="space-y-2">
              {directoryList.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-4">Directorio vacío</p> : directoryList.map(d=>(
                <div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 transition-all">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-extrabold text-slate-800 truncate">{d.placeName}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-500"/> {d.address}, {d.commune}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate flex items-center gap-1"><User className="w-3 h-3 text-emerald-600"/> {d.contactName} • <Phone className="w-3 h-3 ml-1 text-emerald-600"/> {d.contactPhone}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                     <button onClick={() => {setEditingDir(d); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors shadow-sm" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                     <button onClick={() => showConfirm("¿Eliminar destino del directorio?", async () => { 
                         await deleteDoc(doc(db,'directory',d.id));
                         setDirectoryList(directoryList.filter(item => item.id !== d.id));
                     })} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
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

