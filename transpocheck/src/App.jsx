import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, onSnapshot, updateDoc, setDoc, doc, deleteDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
// Eliminamos la importación global de jsPDF para que la app cargue más rápido (Lazy Loading)
import { 
  Car, MapPin, Camera, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, Edit2, Bell, Share2, X, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Save, Search,
  CloudOff, Wifi, QrCode, Sun, Moon, Settings 
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyDlX1VY0n5dDEvD_Tyivb0u_DLdfsargfI",
  authDomain: "logisticapp-45452.firebaseapp.com",
  projectId: "logisticapp-45452",
  storageBucket: "logisticapp-45452.firebasestorage.app",
  messagingSenderId: "522404772814",
  appId: "1:522404772814:web:6ae1154eb945d36475099f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// NUEVO: Activamos la Persistencia Offline. La app funcionará sin internet leyendo el caché local.
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Modo offline limitado:", err.code);
});

const googleProvider = new GoogleAuthProvider();

const DEFAULT_CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];
const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;
const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

const SignaturePad = ({ onSave, onClear, initialData }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialData;
    }
  }, [initialData]);

  const drawEvent = (e, type) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    if (type === 'start') { ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); }
    if (type === 'draw' && isDrawing) { ctx.lineTo(x, y); ctx.stroke(); }
    if (type === 'stop') {
      setIsDrawing(false);
      if (onSave) onSave(canvas.toDataURL());
    }
  };

  return (
    <div className="border-2 border-dashed border-blue-200 rounded-2xl p-2 bg-white">
      <canvas ref={canvasRef} width={300} height={150} className="w-full h-[150px] touch-none cursor-crosshair bg-white rounded-xl"
        onPointerDown={(e) => drawEvent(e, 'start')} onPointerMove={(e) => drawEvent(e, 'draw')}
        onPointerUp={(e) => drawEvent(e, 'stop')} onPointerOut={(e) => drawEvent(e, 'stop')}
        onTouchStart={(e) => drawEvent(e, 'start')} onTouchMove={(e) => drawEvent(e, 'draw')}
        onTouchEnd={(e) => drawEvent(e, 'stop')}
      />
      <button type="button" onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,300,150); if(onClear) onClear(); }} className="mt-2 text-sm text-red-500 hover:text-red-600 font-bold px-3 py-1.5 bg-red-50 rounded-lg transition-colors">Limpiar firma</button>
    </div>
  );
};

// Se reduce la resolución máxima y la calidad para evitar el bloqueo por peso en Firestore
const resizeImage = (file, maxWidth = 500, quality = 0.4) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

function NewJobForm({ jobToEdit, onCancelEdit, allClientsList, vehicles, drivers, db, showAlert, onSuccess }) {
  const [selectedClient, setSelectedClient] = useState(jobToEdit?.client && allClientsList.includes(jobToEdit.client) ? jobToEdit.client : (jobToEdit?.client ? 'OTRO' : ''));
  const [manualClient, setManualClient] = useState(jobToEdit?.client && !allClientsList.includes(jobToEdit.client) ? jobToEdit.client : '');
  const [brand, setBrand] = useState(jobToEdit?.brand || '');
  const [model, setModel] = useState(jobToEdit?.model || '');
  const [plate, setPlate] = useState(jobToEdit?.plate || jobToEdit?.vin || '');
  const [tripType, setTripType] = useState(jobToEdit?.tripType || 'traslado');
  
  const [revType, setRevType] = useState(jobToEdit?.rtData?.type || 'A');
  const [revA_gases, setRevA_gases] = useState(jobToEdit?.rtData?.gases || false);
  const [revA_revision, setRevA_revision] = useState(jobToEdit?.rtData?.revision || false);
  const [revA_inspeccion, setRevA_inspeccion] = useState(jobToEdit?.rtData?.inspeccion || false);
  const [revA_frenos, setRevA_frenos] = useState(jobToEdit?.rtData?.frenos || false);
  const [revB_tipo, setRevB_tipo] = useState(jobToEdit?.rtData?.tipoB || 'completa');
  // NUEVO: Estado Reactivo para las tarjetas de conductores
  const [selectedDriversUI, setSelectedDriversUI] = useState(() => jobToEdit?.assignedEmails ? drivers.filter(d => jobToEdit.assignedEmails.includes(d.email)).map(d => d.id) : []);
  
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePlateChange = (e) => {
    const val = e.target.value.toUpperCase(); setPlate(val);
    const v = vehicles.find(x => x.plate === val);
    if (v) {
      setBrand(v.brand); setModel(v.model);
      if (allClientsList.includes(v.client)) setSelectedClient(v.client); else { setSelectedClient('OTRO'); setManualClient(v.client); }
    }
  };

  const handleCreateOrUpdateJob = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedDriverIds = formData.getAll('assignedDriverId');
    if (selectedDriverIds.length === 0) return showAlert("Debes seleccionar al menos un conductor.");

    const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
    const finalClient = selectedClient === 'OTRO' ? manualClient : selectedClient;
    
    const rtData = tripType === 'revision' ? {
      type: revType, gases: revType === 'A' ? revA_gases : (revB_tipo === 'gases'),
      revision: revType === 'A' ? revA_revision : (revB_tipo === 'completa'),
      inspeccion: revType === 'A' ? revA_inspeccion : false,
      frenos: revType === 'A' ? revA_frenos : false,
      tipoB: revType === 'B' ? revB_tipo : null
    } : null;

    const jobData = {
      scheduledDate: formData.get('scheduledDate'), client: finalClient, brand, model,
      vin: plate, plate, origin: formData.get('origin'), destination: formData.get('destination'),
      tripType, rtData: rtData || null, // Protección anti-crash
      assignedDrivers: assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email})), assignedEmails: assignedDriversList.map(d => d.email)
    };

    try {
      if (jobToEdit) {
         await updateDoc(doc(db, 'transport_jobs', jobToEdit.id), jobData);
         showAlert(`Trabajo actualizado exitosamente.`);
         if (onCancelEdit) onCancelEdit();
      } else {
         jobData.status = 'pending';
         jobData.createdAt = Date.now();
         jobData.checklist = null;
         await addDoc(collection(db, 'transport_jobs'), jobData);
         showAlert(`Trabajo asignado exitosamente.`);
      }
      
      if (plate && !vehicles.find(v => v.plate === plate)) await addDoc(collection(db, 'vehicles'), { plate, brand, model, client: finalClient, createdAt: Date.now() });
      onSuccess();
    } catch (error) { console.error(error); showAlert("Ocurrió un error guardando el trabajo."); }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">{jobToEdit ? 'Editar Trabajo' : 'Crear Nuevo Trabajo'}</h2>
        {jobToEdit && <button type="button" onClick={onCancelEdit} className="text-slate-500 hover:bg-slate-100 p-2 rounded-xl transition"><X className="w-6 h-6"/></button>}
      </div>
      <form onSubmit={handleCreateOrUpdateJob} className="space-y-6">
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-slate-700">1. Tipo de Servicio</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={()=>setTripType('traslado')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'traslado' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>Traslado Local</button>
            <button type="button" onClick={()=>setTripType('viaje')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'viaje' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>A Regiones</button>
            <button type="button" onClick={()=>setTripType('revision')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'revision' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>Revisión Técnica</button>
          </div>
          {tripType === 'revision' && (
            <div className="p-4 bg-white border-2 border-blue-100 rounded-xl space-y-4 mt-4 animate-in fade-in">
               <h4 className="text-xs font-extrabold text-blue-600 uppercase">Detalle Revisión Técnica</h4>
               <select value={revType} onChange={e=>setRevType(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700">
                 <option value="A">Revisión Tipo A</option>
                 <option value="B">Revisión Tipo B</option>
               </select>
               {revType === 'A' && (
                 <div className="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600">
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_gases} onChange={e=>setRevA_gases(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Gases</label>
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_revision} onChange={e=>setRevA_revision(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Revisión</label>
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_inspeccion} onChange={e=>setRevA_inspeccion(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Insp. Visual</label>
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_frenos} onChange={e=>setRevA_frenos(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Cert. Frenos</label>
                 </div>
               )}
               {revType === 'B' && (
                 <select value={revB_tipo} onChange={e=>setRevB_tipo(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700">
                   <option value="completa">Revisión Completa</option>
                   <option value="gases">Sólo Gases</option>
                 </select>
               )}
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
           <h3 className="text-base font-bold text-slate-700">2. Vehículo <span className="text-xs text-blue-500 font-bold">(Escribe la patente para autocompletar)</span></h3>
           <div className="grid grid-cols-2 gap-4">
             <input value={plate} onChange={handlePlateChange} type="text" placeholder="Patente o VIN" className="w-full border-2 border-slate-300 p-3 text-sm rounded-xl col-span-2 uppercase outline-none focus:border-blue-500 font-black bg-slate-100 text-slate-800 shadow-inner" />
             <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-800" />
             <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-800" />
           </div>
        </div>
        
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-slate-700">3. Programación y Ruta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
               <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Fecha de Traslado</label>
               <input name="scheduledDate" type="date" defaultValue={jobToEdit?.scheduledDate || todayStr} required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-700" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Cliente</label>
              <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white">
                <option value="">Seleccione Cliente (Opcional)</option>
                {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTRO">Otro (Ingreso manual)</option>
              </select>
              {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white mt-2" />}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <input name="origin" defaultValue={jobToEdit?.origin || ''} type="text" placeholder="Desde (Origen)" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
            <input name="destination" defaultValue={jobToEdit?.destination || ''} type="text" placeholder={tripType === 'revision' ? 'Planta de Revisión (Destino)' : 'Hasta (Destino)'} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
           <h3 className="text-base font-bold text-slate-700">4. Conductores <span className="text-xs text-red-500 font-normal">(Obligatorio seleccionar al menos 1)</span></h3>
           <div className="max-h-64 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drivers.length === 0 ? <p className="text-sm text-slate-400 p-4 font-semibold col-span-full text-center">No hay conductores registrados.</p> : drivers.map(d => {
                const isSelected = selectedDriversUI.includes(d.id);
                return (
                <label key={d.id} className="relative flex cursor-pointer group">
                  {/* El input oculto envía los datos, pero el evento onChange actualiza la UI visual instantáneamente */}
                  <input type="checkbox" name="assignedDriverId" value={d.id} checked={isSelected} onChange={() => setSelectedDriversUI(prev => prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id])} className="sr-only" />
                  
                  {/* Tarjeta interactiva conectada a React */}
                  <div className={`w-full flex items-center p-3 bg-white border-2 rounded-2xl transition-all ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 group-hover:border-blue-300'}`}>
                    <div className={`p-2.5 rounded-xl transition-colors shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <User className="w-5 h-5" />
                    </div>
                    <div className="ml-3 flex-1 overflow-hidden">
                      <span className={`block text-sm font-extrabold truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>{d.name}</span>
                      <span className={`block text-[10px] font-bold truncate mt-0.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{d.email}</span>
                    </div>
                    <CheckCircle className={`w-6 h-6 transition-transform duration-200 shrink-0 ml-2 ${isSelected ? 'scale-100 text-blue-600' : 'scale-0 text-slate-300'}`} />
                  </div>
                </label>
              )})}
           </div>
        </div>
        <div className="flex gap-3 pt-2">
          {jobToEdit && <button type="button" onClick={onCancelEdit} className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 px-8 py-3 rounded-2xl font-extrabold text-sm sm:text-lg transition-colors">Cancelar</button>}
          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-extrabold text-sm sm:text-lg transition-colors shadow-lg shadow-blue-200">{jobToEdit ? 'Actualizar Trabajo' : 'Guardar y Asignar'}</button>
        </div>
      </form>
    </div>
  );
}

function ConfigView({ allClientsList, customClients, vehicles, drivers, db, showAlert, showConfirm }) {
  const [configSubTab, setConfigSubTab] = useState('clients');
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [fleetFilter, setFleetFilter] = useState('');
  
  return (
    <div className="space-y-6">
      <div className="flex gap-2 pb-2">
         <button onClick={()=>setConfigSubTab('clients')} className={`px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='clients'?'bg-blue-600 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Clientes</button>
         <button onClick={()=>setConfigSubTab('vehicles')} className={`px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='vehicles'?'bg-blue-600 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Vehículos</button>
         <button onClick={()=>setConfigSubTab('drivers')} className={`px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='drivers'?'bg-blue-600 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Conductores</button>
      </div>

      {configSubTab === 'clients' && (
        <div className="grid md:grid-cols-2 gap-6">
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const name = fd.get('name'); try { if(editingClient){ await updateDoc(doc(db, 'clients', editingClient.id), { name }); setEditingClient(null); showAlert("Cliente actualizado"); } else { await addDoc(collection(db, 'clients'), { name, createdAt: Date.now() }); showAlert("Cliente agregado"); } e.target.reset(); } catch(err){} }} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-lg">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <input name="name" defaultValue={editingClient?.name} placeholder="Nombre del cliente" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-semibold"/>
            <div className="flex gap-2">
              {editingClient && <button type="button" onClick={()=>setEditingClient(null)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>}
              <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-extrabold">{editingClient ? 'Actualizar' : 'Agregar'}</button>
            </div>
          </form>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 max-h-[60vh] overflow-y-auto">
             <h3 className="font-extrabold text-lg mb-4">Base de Clientes</h3>
             <div className="space-y-2">
                {allClientsList.map((c, i) => {
                   const isCustom = customClients.find(cc => cc.name === c);
                   return (
                      <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <span className="font-bold text-slate-700">{c} {!isCustom && <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 rounded ml-2">Por defecto</span>}</span>
                        {isCustom && (
                           <div className="flex gap-1">
                             <button onClick={()=>setEditingClient(isCustom)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                             <button onClick={()=>showConfirm("¿Eliminar cliente?", async()=>await deleteDoc(doc(db,'clients',isCustom.id)))} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                           </div>
                        )}
                      </div>
                   )
                })}
             </div>
          </div>
        </div>
      )}

      {configSubTab === 'vehicles' && (
        <div className="grid md:grid-cols-2 gap-6">
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const client = fd.get('client') === 'OTRO' ? fd.get('manualClient') : fd.get('client'); try { if(editingVehicle){ await updateDoc(doc(db, 'vehicles', editingVehicle.id), { client, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase() }); setEditingVehicle(null); showAlert("Vehículo actualizado."); } else { await addDoc(collection(db, 'vehicles'), { client, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase(), createdAt: Date.now() }); showAlert("Vehículo guardado."); } e.target.reset(); } catch (error) { console.error(error); } }} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-extrabold flex items-center gap-2"><Truck className="text-blue-600"/> {editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
            <select name="client" defaultValue={editingVehicle?.client || ''} className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 bg-white">
              <option value="">Cliente...</option>
              {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="OTRO">Otro (Se debe escribir manualmente)</option>
            </select>
            <input name="manualClient" placeholder="Si es OTRO, escribe el cliente aquí" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="brand" defaultValue={editingVehicle?.brand} placeholder="Marca (Ej. Chevrolet)" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="model" defaultValue={editingVehicle?.model} placeholder="Modelo (Ej. NPR 816)" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="plate" defaultValue={editingVehicle?.plate} placeholder="Patente" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm uppercase outline-none focus:border-blue-500 font-bold text-slate-800"/>
            <div className="flex gap-2">
              {editingVehicle && <button type="button" onClick={()=>setEditingVehicle(null)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm w-1/3 hover:bg-slate-200 transition-colors">Cancelar</button>}
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">Guardar Vehículo</button>
            </div>
          </form>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-slate-800">Base Flota</h3>
              <select onChange={(e) => setFleetFilter(e.target.value)} className="border-2 border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-blue-500">
                <option value="">Todos los Clientes</option>
                {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTRO">Otros</option>
              </select>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {vehicles.filter(v => {
                if (!fleetFilter) return true;
                if (fleetFilter === 'OTRO') return !allClientsList.includes(v.client);
                return v.client === fleetFilter;
              }).map(v=>(
                <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl group transition-all">
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">{v.brand} {v.model}</p>
                    <p className="text-xs font-bold text-blue-600">{v.plate}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{v.client || 'Sin cliente'}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingVehicle(v)} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors shadow-sm"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={()=>showConfirm("¿Eliminar este vehículo de la base de datos?", async () => {try { await deleteDoc(doc(db, 'vehicles', v.id)); } catch (e) { console.error(e); }})} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
              {vehicles.length === 0 && <p className="text-sm font-semibold text-slate-400">No hay vehículos registrados</p>}
            </div>
          </div>
        </div>
      )}

      {configSubTab === 'drivers' && (
        <div className="grid md:grid-cols-2 gap-6">
          <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const data = { name: fd.get('driverName'), email: fd.get('driverEmail').toLowerCase(), licenses: fd.getAll('licenses'), licenseExpiry: fd.get('licenseExpiry') }; try { if (editingDriver) { await updateDoc(doc(db, 'drivers', editingDriver.id), data); setEditingDriver(null); showAlert("Conductor actualizado exitosamente."); } else { data.balance = 0; data.createdAt = Date.now(); await addDoc(collection(db, 'drivers'), data); showAlert("Conductor creado exitosamente."); } e.target.reset(); } catch (err) { console.error(err); } }} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2"><User className="text-blue-600"/> {editingDriver ? 'Editar Conductor' : 'Nuevo Conductor'}</h3>
            <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre completo" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail del conductor" required type="email" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            
            <div className="space-y-1.5 border-t pt-2">
               <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Clase de Licencia</label>
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
               <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Fecha de Vencimiento Licencia</label>
               <input name="licenseExpiry" type="date" defaultValue={editingDriver?.licenseExpiry || ''} className="w-full border-2 p-2 rounded-xl text-sm font-semibold outline-none text-slate-700 bg-white" />
            </div>

            <div className="flex gap-3 pt-2 border-t">
              {editingDriver && <button type="button" onClick={() => setEditingDriver(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-extrabold text-sm transition-colors">Cancelar</button>}
              <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-sm transition-colors shadow-lg shadow-blue-200">{editingDriver ? 'Guardar Cambios' : 'Crear Conductor'}</button>
            </div>
          </form>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 max-h-[75vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-800 mb-4">Directorio</h3>
            <div className="space-y-2">
              {drivers.length === 0 ? <p className="text-sm font-semibold text-slate-400">Directorio vacío</p> : drivers.map(d=>(
                <div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl group transition-all">
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">{d.name}</p>
                    <p className="text-xs font-bold text-slate-400">{d.email}</p>
                    {d.licenses && d.licenses.length > 0 && <p className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md mt-1 w-fit">Licencias: {d.licenses.join(', ')}</p>}
                  </div>
                  <div className="flex gap-1">
                     <button onClick={() => setEditingDriver(d)} className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors shadow-sm" title="Editar Conductor"><Edit2 className="w-4 h-4"/></button>
                     <button onClick={() => showConfirm("¿Eliminar conductor?", async()=>await deleteDoc(doc(db,'drivers',d.id)))} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function TrackingView({ clientName, db, onBack, darkMode, setDarkMode }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null); // <-- NUEVO ESTADO PARA EL SPINNER

  useEffect(() => {
    const q = query(collection(db, 'transport_jobs'), where('client', '==', clientName));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setJobs(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Error al leer traslados", err);
      setLoading(false);
    });
    return () => unsub();
  }, [clientName, db]);

  // --- MOTOR GENERADOR DE PDF PARA EL CLIENTE ---
  const handleDownloadPDF = async (job) => {
    if (!job.checklist && job.status !== 'failed') return alert("Este traslado no tiene un checklist registrado.");
    
    try {
      setDownloadingId(job.id); // Enciende el relojito de carga
      
      // CORRECCIÓN: Carga ultra-segura de jsPDF compatible con Vite
      const jsPDFModule = await import('jspdf');
    const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
    const docPDF = new JsPDFClass();
    const cleanStr = (str) => {
      if (!str) return '';
      return String(str).replace(/➔/g, '->').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    };

    const getImageDims = (src) => new Promise(resolve => { 
      const img = new Image(); 
      img.onload = () => resolve({ w: img.width, h: img.height }); 
      img.onerror = () => resolve({ w: 85, h: 60 }); 
      img.src = src; 
    });

    const primaryColor = [30, 41, 59]; const secondaryColor = [100, 116, 139]; const accentColor = [37, 99, 235];
    const lightBg = [248, 250, 252]; const borderColor = [226, 232, 240];

    const loadSimpleLogo = async (src) => {
      return new Promise((resolve) => {
        const img = new Image(); img.src = src; img.crossOrigin = "Anonymous";
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width; tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d'); ctx.drawImage(img, 0, 0, img.width, img.height);
          resolve({ data: tempCanvas.toDataURL('image/png'), w: img.width, h: img.height });
        };
        img.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 1500); 
      });
    };

    const [logoApp, logoLogistica] = await Promise.all([loadSimpleLogo('/logo.png'), loadSimpleLogo('/LogoLogistica.png')]);

    const drawHeader = (titleText) => {
      docPDF.setFillColor(...primaryColor); docPDF.rect(0, 0, 210, 40, 'F');
      docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(18); docPDF.setFont("helvetica", "bold");
      docPDF.text(cleanStr(titleText), 105, 18, null, null, "center");
      
      // Intentamos usar tu función global si está disponible, si no, fallback
      const dateTxt = typeof formatDateDisplay === 'function' && job.scheduledDate ? formatDateDisplay(job.scheduledDate) : (job.scheduledDate || '-');
      docPDF.setFontSize(9); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(148, 163, 184);
      docPDF.text(`FECHA TRASLADO: ${dateTxt}`, 105, 26, null, null, "center");

      docPDF.setFontSize(11); docPDF.setFont("times", "bolditalic"); docPDF.setTextColor(255, 255, 255);
      if (logoLogistica) {
        const ratio = logoLogistica.h / logoLogistica.w; let imgW = 35; let imgH = imgW * ratio;
        if (imgH > 24) { imgH = 24; imgW = imgH / ratio; }
        docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH);
        docPDF.text("Logística TS SpA", 27, 34, null, null, "center");
      }
      if (logoApp) {
        const ratio = logoApp.h / logoApp.w; let imgW = 20; let imgH = imgW * ratio;
        if (imgH > 24) { imgH = 24; imgW = imgH / ratio; }
        docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH);
        docPDF.text("LogisticAPP", 183, 34, null, null, "center");
      }
    };

    let pdfTitle = job.tripType === 'revision' ? "CERTIFICADO DE REVISION TECNICA" : (job.tripType === 'viaje' ? "TRASLADO A REGIONES" : "CHECKLIST DE TRASLADO");
    drawHeader(pdfTitle);

    let currentY = 50;
    if (job.tripType === 'revision' && job.checklist?.rtStatus) {
        const isApproved = job.checklist.rtStatus === 'aprobado';
        const statusText = isApproved ? "APROBADO" : "RECHAZADO";
        docPDF.setFillColor(isApproved ? 220 : 254, isApproved ? 252 : 226, isApproved ? 231 : 226);
        docPDF.rect(0, 40, 210, 12, 'F');
        docPDF.setFontSize(16); docPDF.setFont("helvetica", "bold");
        docPDF.setTextColor(isApproved ? 22 : 220, isApproved ? 163 : 38, isApproved ? 74 : 38); 
        docPDF.text(statusText, 195, 48, null, null, "right");
        currentY = 60; 
    }

    const startY = currentY; const leftColWidth = 90;
    const drawSectionTitle = (title, y) => {
      docPDF.setFillColor(...lightBg); docPDF.rect(15, y - 6, leftColWidth, 10, 'F');
      docPDF.setDrawColor(...accentColor); docPDF.setLineWidth(1); docPDF.line(15, y - 6, 15, y + 4);
      docPDF.setTextColor(...primaryColor); docPDF.setFontSize(10); docPDF.setFont("helvetica", "bold");
      docPDF.text(cleanStr(title).toUpperCase(), 20, y+1);
      return y + 10;
    };

    const drawKV = (label, value, x, y, maxW = 40) => {
      docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
      docPDF.text(cleanStr(label).toUpperCase(), x, y);
      docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor);
      const splitValue = docPDF.splitTextToSize(cleanStr(value), maxW); docPDF.text(splitValue, x, y + 4);
      return splitValue.length * 4;
    };

    // Rescatar nombre de conductor (El cliente no tiene la base de datos de drivers, así que la armamos de lo que esté guardado en el Job)
    let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "Conductor";
    if (job.assignedDrivers && job.assignedDrivers.length > 0) {
       const found = job.assignedDrivers.find(d => d.email === job.acceptedByEmail);
       if (found) driverNameStr = found.name;
    }

    currentY = drawSectionTitle("1. Detalles del Vehiculo", currentY);
    let hC = drawKV("Cliente", `${job.client || 'Sin Cliente'}`, 15, currentY, 45);
    let hM = drawKV("Marca y Modelo", `${job.brand || '-'} ${job.model || '-'}`, 65, currentY, 45);
    currentY += Math.max(hC, hM) + 6;

    let hP = drawKV("Patente / VIN", `${job.plate || job.vin || '-'}`, 15, currentY, 45);
    let hD = drawKV("Conductor", driverNameStr, 65, currentY, 45);
    currentY += Math.max(hP, hD) + 6;
    
    let routeText = `${job.origin || '-'}  ->  ${job.destination || '-'}`;
    if (job.tripType === 'revision') {
      if (job.checklist?.rtStatus === 'aprobado') {
         const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin;
         routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`;
      } else if (job.checklist?.rtStatus === 'rechazado') {
         routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`;
      } else {
         routeText = `${job.origin || '-'}  ->  PRT`;
      }
    }
    let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
    currentY += routeH + 8;

    currentY = drawSectionTitle("2. Recepcion y Estado", currentY);
    
    const getDocStatus = (docKey) => {
        const isOk = job.checklist?.docs?.[docKey];
        const expDate = job.checklist?.docsExpiry?.[docKey];
        if (!isOk) return 'FALTA';
        if (expDate) {
            const [y, m, d] = expDate.split('-');
            return `AL DIA (Vence: ${d}/${m}/${y})`;
        }
        return 'AL DIA';
    };

    let hFuel = drawKV("Combustible", `${job.checklist?.fuelLevel || '0'}%`, 15, currentY, 45);
    let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
    currentY += Math.max(hFuel, hSoap) + 6;

    let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
    let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
    currentY += Math.max(hPerm, hRev) + 6;

    let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
    currentY += hGas + 8;

    docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
    docPDF.text("OBSERVACIONES:", 15, currentY);
    docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor);
    const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth);
    docPDF.text(obsSplit, 15, currentY + 4);
    currentY += (obsSplit.length * 4) + 6;

    if (job.checklist?.hasWaitTime) {
      docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);
      const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);
      docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;
    }
    if (job.checklist?.hasFuelCharge) {
      docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235);
      const fcStr = docPDF.splitTextToSize(`CARGA DE COMBUSTIBLE: ${cleanStr(job.checklist.fuelChargeAmount || 'Sí')}`, leftColWidth);
      docPDF.text(fcStr, 15, currentY); currentY += (fcStr.length * 4) + 2;
    }
    currentY += 8; 

    let sectionNum = 3;

    if (job.tripType === 'revision') {
       currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY);
       if (job.checklist?.rtStatus === 'aprobado') {
         docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); 
         docPDF.text("APROBADO", 15, currentY + 6);
         currentY += 18; 
       } else {
         docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); 
         docPDF.text("RECHAZADO", 15, currentY + 6);
         docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27);
         const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth);
         docPDF.text(rejSplit, 15, currentY + 12);
         currentY += 20 + (rejSplit.length * 4); 
       }
       sectionNum++;
    }

    currentY = drawSectionTitle(`${sectionNum}. Conformidad Entrega`, currentY);
    if (job.checklist?.noReception) {
      docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(9);
      const nrSplit = docPDF.splitTextToSize("ENTREGA SIN RECEPCION (Confirmada por conductor en terreno)", leftColWidth);
      docPDF.text(nrSplit, 15, currentY + 4); currentY += (nrSplit.length * 4) + 6;
    } else {
      drawKV("Receptor", `${job.checklist?.receiverName || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12;
      drawKV("RUT", `${job.checklist?.receiverRut || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12;
      
      if (job.checklist?.clientComments) {
          docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
          docPDF.text("COMENTARIOS:", 15, currentY);
          docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor);
          const commSplit = docPDF.splitTextToSize(cleanStr(job.checklist.clientComments), leftColWidth);
          docPDF.text(commSplit, 15, currentY + 4);
          currentY += (commSplit.length * 4) + 6;
      }

      if(job.checklist?.signatureData) {
          docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
          docPDF.text("FIRMA DE CONFORMIDAD:", 15, currentY);
          docPDF.addImage(job.checklist.signatureData, 'PNG', 15, currentY + 2, 45, 25);
          currentY += 30;
      }
    }

    const frontPhotoStr = job.checklist?.photos?.front;
    if (frontPhotoStr && typeof frontPhotoStr === 'string' && frontPhotoStr.startsWith('data:image')) {
      try {
        const dims = await getImageDims(frontPhotoStr); const ratio = dims.h / dims.w;
        let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; }
        const rightX = 115; const rightY = startY + 6;
        docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S');
        docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F');
        docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor);
        docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" });
        docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH);
      } catch (err) { console.error(err); }
    }

    const addFooter = () => {
       const pageCount = docPDF.internal.getNumberOfPages();
       for(let i = 1; i <= pageCount; i++) {
           docPDF.setPage(i); docPDF.setFontSize(8); docPDF.setTextColor(148, 163, 184);
           docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center");
       }
    }

    if (job.checklist?.photos) {
      const photos = job.checklist.photos;
      const labels = { front: 'Frente', left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4' };
      let photoY = 46; let currentCol = 1; let addedPage = false;

      for (const key in photos) {
        if (key === 'front') continue; 
        if (photos[key] && typeof photos[key] === 'string' && photos[key].startsWith('data:image')) {
          if (!addedPage) { docPDF.addPage(); drawHeader("ANEXO FOTOGRAFICO"); addedPage = true; }
          try {
            const dims = await getImageDims(photos[key]); const ratio = dims.h / dims.w;
            let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; }
            const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2);
            if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); }
            
            docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S');
            docPDF.setFillColor(...lightBg); docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F');
            docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor);
            docPDF.text((labels[key] || key).toUpperCase(), slotCenter, photoY - 3, { align: "center" });
            docPDF.addImage(photos[key], 'JPEG', finalX, photoY + 2, imgW, imgH);
            if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; }
          } catch (err) {}
        }
      }
    }
    addFooter();

    // Guardado del archivo
    const cleanPlate = job.plate || job.vin || 'SN';
    const dateStrForFile = (job.scheduledDate || new Date().toISOString().split('T')[0]).replace(/\//g, '-');
    const fileName = `Certificado.${dateStrForFile}.${(job.client || 'Cliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; 
    docPDF.save(fileName); 
    setDownloadingId(null); // Apaga el relojito
    
    } catch (error) {
      console.error("Error crítico generando PDF en Portal:", error);
      alert("Hubo un error al descargar el PDF. Verifica tu conexión a internet e intenta de nuevo.");
      setDownloadingId(null); // Apaga el relojito en caso de error
    }
  };
  // ----------------------------------------------

  const [searchTerm, setSearchTerm] = useState('');
  
  // NUEVO: Estados para la Firma Masiva
  const [batchSignOpen, setBatchSignOpen] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ name: '', rut: '', comments: '', signature: null, selectedIds: [] });

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="font-bold text-slate-400 animate-pulse flex items-center gap-2"><Clock className="w-5 h-5"/> Cargando portal...</p></div>;

  // NUEVO: Lógica de Filtro
  const filteredJobs = jobs.filter(j => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (j.plate || '').toLowerCase().includes(term) || 
           (j.brand || '').toLowerCase().includes(term) || 
           (j.model || '').toLowerCase().includes(term);
  });

  const activeJobs = filteredJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
  const historyJobs = filteredJobs.filter(j => j.status === 'completed' || j.status === 'failed').slice(0, 30);
  
  // NUEVO: Vehículos que tienen checklist guardado pero faltan por firmar
  const pendingSignatureJobs = activeJobs.filter(j => j.checklist && !j.checklist.clientSigned);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10 transition-colors duration-300">
      {/* SE ANCLA CON LA CLASE fixed-nav-bar PARA EVITAR DESPLAZAMIENTOS */}
      <header className="fixed-nav-bar bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20 transition-colors duration-300">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Logo de la app */}
          <div className="bg-white/20 p-1 sm:p-1.5 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo App" className="w-7 h-7 sm:w-12 sm:h-12 object-contain" />
          </div>
          
          {/* Nombre de la aplicación */}
          <h1 className="font-alfa text-lg sm:text-3xl tracking-wide shrink-0 text-white" style={{ paddingTop: '2px' }}>
            LogisticAPP
          </h1>
          
          {/* Logo Logística TS SpA */}
          <div className="bg-white/20 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0 ml-0.5 sm:ml-1 overflow-hidden">
            <img src="/LogoLogistica.png" alt="Logística TS SpA" className="h-8 sm:h-15 object-contain" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* BOTÓN MODO OSCURO PARA CLIENTE */}
          {setDarkMode && (
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors shadow-sm border border-white/10">
              {darkMode ? <Sun className="w-5 h-5 text-yellow-300"/> : <Moon className="w-5 h-5 text-white"/>}
            </button>
          )}

          {onBack && (
            <button onClick={onBack} className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl text-sm font-bold text-white transition-colors border border-red-400 shadow-sm flex items-center gap-1.5 z-10 shrink-0 ml-2">
              <LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Volver</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 space-y-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden max-w-2xl mx-auto">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"></div>
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-1">Portal de Seguimiento</h2>
          <p className="text-2xl font-black text-slate-800">{clientName}</p>
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="relative max-w-2xl mx-auto">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search className="w-5 h-5 text-slate-400" />
           </div>
           <input type="text" placeholder="Buscar por patente, marca o modelo..." className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* NUEVO: BANNER DE FIRMA MASIVA */}
        {pendingSignatureJobs.length > 0 && (
          <div className="bg-blue-600 rounded-3xl p-5 shadow-xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in duration-300 border-4 border-blue-400 max-w-2xl mx-auto">
             <div>
               <h3 className="font-black text-xl flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-300"/> ¡Acción Requerida!</h3>
               <p className="font-bold text-blue-100 text-sm mt-1">Tienes {pendingSignatureJobs.length} vehículo(s) esperando tu firma de recepción.</p>
             </div>
             <button onClick={() => {
                setBatchFormData({ name: '', rut: '', comments: '', signature: null, selectedIds: pendingSignatureJobs.map(j => j.id) });
                setBatchSignOpen(true);
             }} className="w-full sm:w-auto bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-xl font-black shadow-md transition-colors whitespace-nowrap">
               Firmar Lote Completo
             </button>
          </div>
        )}

        {/* Sección 1: En Curso */}
        <div>
          <h3 className="font-extrabold text-slate-700 mb-4 flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-600"/> Vehículos en Tránsito ({activeJobs.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeJobs.length === 0 ? (
               <p className="text-sm font-bold text-slate-400 bg-white p-4 rounded-2xl border text-center col-span-full">No se encontraron traslados activos.</p>
            ) : activeJobs.map(job => {
              const isPending = job.status === 'pending';
              const isAccepted = job.status === 'accepted';
              const phase = job.phase || 'claimed'; 
              
              const step2Done = isAccepted && ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
              const step3Done = isAccepted && ['arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
              const step4Done = isAccepted && phase === 'prt_done';

              return (
              <div key={job.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isPending ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
                <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">En Traslado</h2>
                    <p className="text-xl font-black text-slate-800 leading-none">{job.brand} {job.model}</p>
                  </div>
                  <div className="bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-sm shrink-0">
                    <p className="text-sm font-black uppercase tracking-widest">{job.plate || job.vin || 'S/N'}</p>
                  </div>
                </div>
                
                <div className="relative pl-8 space-y-6 before:absolute before:inset-y-2 before:left-[11px] before:w-0.5 before:bg-slate-100 flex-1">
                  {/* PASO 1: Nombre del Conductor si está aceptado */}
                  <div className="relative"><div className="absolute -left-8 bg-blue-500 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center"><CheckCircle className="w-3 h-3 text-white"/></div><p className="font-extrabold text-slate-800 text-sm">{isAccepted ? (job.assignedDrivers?.find(d => d.email === job.acceptedByEmail)?.name || "Conductor en camino") : "Buscando conductor..."}</p><p className="text-xs font-bold text-slate-500 mt-0.5">{isAccepted ? `Responsable del retiro en ${job.origin}` : `Esperando asignación para ${job.origin}`}</p></div>
                  
                  {/* PASO 2: Vehículo en poder */}
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step2Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step2Done && <CheckCircle className="w-3 h-3 text-white"/>}</div><p className={`font-extrabold text-sm ${step2Done ? 'text-slate-800' : 'text-slate-400'}`}>Vehículo en Tránsito</p><p className={`text-xs font-bold mt-0.5 ${step2Done ? 'text-blue-600' : 'text-slate-400'}`}>{step2Done ? 'El conductor tiene el vehículo en su poder' : 'Esperando retiro'}</p></div>
                  
                  {/* PASO 3: Llegada */}
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step3Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step3Done && <CheckCircle className="w-3 h-3 text-white"/>}</div><p className={`font-extrabold text-sm ${step3Done ? 'text-slate-800' : 'text-slate-400'}`}>{job.tripType === 'revision' ? 'En Planta de Revisión' : 'Llegada a Destino'}</p><p className={`text-xs font-bold mt-0.5 ${step3Done ? 'text-blue-600' : 'text-slate-400'}`}>{step3Done ? (job.tripType === 'revision' ? 'Realizando inspección técnica' : 'En proceso de entrega y checklist') : `Hacia ${job.tripType === 'revision' ? 'PRT' : job.destination}`}</p></div>
                  
                  {/* PASO 4: Resultado PRT */}
                  {job.tripType === 'revision' && (
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step4Done ? (job.prt_result === 'rechazado' ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-200'}`}>{step4Done && <CheckCircle className="w-3 h-3 text-white"/>}</div><p className={`font-extrabold text-sm ${step4Done ? (job.prt_result === 'rechazado' ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>Resultado de Revisión</p>{step4Done ? (<p className={`text-xs font-bold mt-0.5 ${job.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-600'}`}>{job.prt_result === 'rechazado' ? `Rechazado: ${job.prt_reason}` : 'Aprobado Exitosamente'}</p>) : (<p className="text-xs font-bold text-slate-400 mt-0.5">Esperando documento de la planta</p>)}</div>
                  )}

                  {/* NUEVO PASO 5: Camino a Destino (Solo si la PRT ya se resolvió) */}
                  {job.tripType === 'revision' && step4Done && (
                  <div className="relative"><div className="absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center bg-blue-500"><div className="w-2 h-2 bg-white rounded-full animate-ping"></div></div><p className="font-extrabold text-sm text-slate-800">Camino a destino</p><p className="text-xs font-bold text-blue-600 mt-0.5">El vehículo va en ruta a su destino final</p></div>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* NUEVO DISEÑO COMPACTO DE HISTORIAL (Tarjeta Estilo Ticket) */}
        <div>
          <h3 className="font-extrabold text-slate-700 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600"/> Últimos Finalizados</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyJobs.length === 0 ? (
               <p className="text-sm font-bold text-slate-400 bg-white p-4 rounded-2xl border text-center col-span-full">No se encontraron resultados.</p>
            ) : historyJobs.map(job => {
              const isFailed = job.status === 'failed';
              return (
              <div key={job.id} className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative pl-4 overflow-hidden hover:shadow-md transition-shadow h-[120px]">
                {/* Borde lateral grueso y coloreado */}
                <div className={`absolute top-0 left-0 bottom-0 w-2 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
                
                {/* Fila 1: Auto y Patente Grande */}
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-black text-slate-800 leading-tight truncate pr-2">{job.brand} {job.model}</p>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-widest shrink-0">{job.plate || 'S/N'}</span>
                </div>
                
                {/* Fila 2: Ruta */}
                <p className="text-slate-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-1 truncate opacity-90"><MapPin className="w-3.5 h-3.5 shrink-0"/> {job.origin} ➔ {job.tripType === 'revision' ? 'PRT' : job.destination}</p>
                
                {/* Fila 3: Resultado y Botón PDF */}
                <div className="flex justify-between items-end mt-auto pt-2 border-t border-slate-50">
                  <div>
                    <p className={`text-[11px] font-black uppercase ${isFailed ? 'text-red-500' : 'text-green-600'}`}>
                      {isFailed ? 'RECHAZADO' : 'ENTREGADO'}
                    </p>
                    <p className="text-slate-400 text-[9px] font-bold mt-0.5">{new Date(job.completedAt || job.createdAt).toLocaleDateString('es-CL')}</p>
                  </div>
                  <button onClick={() => handleDownloadPDF(job)} disabled={downloadingId === job.id} className="flex items-center justify-center p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100 disabled:opacity-50" title="Descargar PDF">
                    {downloadingId === job.id ? <Clock className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>
      </main>

      {/* NUEVO: MODAL DE FIRMA MASIVA */}
      {batchSignOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-black text-slate-800">Firma de Recepción</h2>
                <p className="text-xs font-bold text-slate-500">Selecciona los vehículos a recepcionar</p>
              </div>
              <button onClick={() => setBatchSignOpen(false)} className="bg-white hover:bg-slate-200 p-2 rounded-full transition-colors shadow-sm border border-slate-200"><X className="w-5 h-5 text-slate-700"/></button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-2 border-b border-slate-100 pb-4">
                 {pendingSignatureJobs.map(j => (
                   <label key={j.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${batchFormData.selectedIds.includes(j.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <input type="checkbox" checked={batchFormData.selectedIds.includes(j.id)} onChange={(e) => {
                         const ids = e.target.checked ? [...batchFormData.selectedIds, j.id] : batchFormData.selectedIds.filter(id => id !== j.id);
                         setBatchFormData({...batchFormData, selectedIds: ids});
                      }} className="w-6 h-6 accent-blue-600 rounded cursor-pointer shrink-0"/>
                      <div className="flex-1">
                         <p className="font-extrabold text-sm text-slate-800 leading-tight">{j.brand} {j.model}</p>
                         <p className="font-bold text-xs text-blue-600 uppercase mt-0.5">{j.plate || j.vin}</p>
                      </div>
                   </label>
                 ))}
              </div>

              <form id="batch-sign-form" onSubmit={async (e) => {
                 e.preventDefault();
                 if (batchFormData.selectedIds.length === 0) return alert("Debes seleccionar al menos un vehículo.");
                 if (!batchFormData.signature) return alert("Por favor, dibuja tu firma en el recuadro blanco.");
                 
                 try {
                    await Promise.all(batchFormData.selectedIds.map(async (id) => {
                       const jobToUpdate = jobs.find(x => x.id === id);
                       if (!jobToUpdate) return;
                       const updatedChecklist = {
                          ...jobToUpdate.checklist,
                          clientSigned: true,
                          receiverName: batchFormData.name,
                          receiverRut: batchFormData.rut,
                          clientComments: batchFormData.comments,
                          signatureData: batchFormData.signature
                       };
                       await updateDoc(doc(db, 'transport_jobs', id), { checklist: updatedChecklist });
                    }));
                    setBatchSignOpen(false);
                    alert("¡Recepción masiva exitosa! Los conductores ya han sido notificados para cerrar el traslado.");
                 } catch (error) {
                    console.error(error);
                    alert("Error guardando la firma.");
                 }
              }} className="space-y-3">
                 <input required type="text" placeholder="Nombre de quien recibe" value={batchFormData.name} onChange={e=>setBatchFormData({...batchFormData, name: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 text-sm" />
                 <input required type="text" placeholder="RUT" value={batchFormData.rut} onChange={e=>setBatchFormData({...batchFormData, rut: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 text-sm" />
                 <textarea placeholder="Comentarios generales para el lote (Opcional)" value={batchFormData.comments} onChange={e=>setBatchFormData({...batchFormData, comments: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 h-16 text-sm" />
                 
                 <div className="pt-2">
                    <h3 className="text-xs font-extrabold text-slate-500 uppercase mb-2">Firma Digital (Aplica para todos)</h3>
                    <SignaturePad initialData={batchFormData.signature} onSave={d=>setBatchFormData({...batchFormData, signature: d})} onClear={()=>setBatchFormData({...batchFormData, signature: null})} />
                 </div>
              </form>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button type="submit" form="batch-sign-form" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-colors text-lg">Confirmar Lote ({batchFormData.selectedIds.length})</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
function ClientSignView({ jobId, db }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', rut: '', comments: '', signature: null });
  const [fullScreenImage, setFullScreenImage] = useState(null); 
  const [alertMessage, setAlertMessage] = useState(null); // <-- NUEVO: ESTADO PARA ALERTA PERSONALIZADA

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'transport_jobs', jobId), (docSnap) => {
      if (docSnap.exists()) {
        setJob({ id: docSnap.id, ...docSnap.data() });
      } else {
        setJob(null);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setAlertMessage("Error de conexión: " + error.message);
      setLoading(false);
    });
    return () => unsub();
  }, [jobId, db]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400"><Clock className="w-5 h-5 mr-2 animate-spin"/> Cargando acta...</div>;
  
  if (!job) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-bold text-red-500"><XCircle className="w-12 h-12 mb-4 text-red-400"/>Acta no encontrada.<br/><span className="text-sm text-slate-400 mt-2">Verifica el link o escanea nuevamente.</span></div>;
  
  // NUEVO: PANTALLA DE SINCRONIZACIÓN. Si el conductor aún está subiendo las fotos, el cliente espera aquí.
  if (!job.checklist) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-bold text-slate-600"><Clock className="w-12 h-12 mb-4 text-blue-500 animate-spin mx-auto"/>Sincronizando datos...<br/><span className="text-sm text-slate-400 mt-2">Esperando a que el celular del conductor termine de enviar las fotografías. No cierres esta pantalla, la firma aparecerá automáticamente.</span></div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.signature) return setAlertMessage("Por favor, firme en el recuadro blanco."); // <-- USA LA NUEVA ALERTA
    
    try {
      // Unimos el checklist existente con los datos nuevos
      const updatedChecklist = {
        ...job.checklist,
        clientSigned: true,
        receiverName: formData.name || '',
        receiverRut: formData.rut || '',
        clientComments: formData.comments || '',
        signatureData: formData.signature
      };

      // Subimos el objeto completo a Firebase
      await updateDoc(doc(db, 'transport_jobs', jobId), {
        checklist: updatedChecklist
      });
      
      setSubmitted(true);
    } catch (error) { 
      console.error("Firebase Error:", error); 
      setAlertMessage("Error al guardar la firma: " + error.message); // <-- USA LA NUEVA ALERTA
    }
  };

  if (submitted || job.checklist.clientSigned) {
    // Escuchamos en tiempo real si el conductor ya cerró el traslado desde su app
    const isFinished = job.status === 'completed' || job.status === 'failed';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className={`bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border-t-8 transition-colors duration-500 ${isFinished ? 'border-green-500' : 'border-blue-500'}`}>
          {isFinished ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-in zoom-in"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">¡Traslado Finalizado!</h2>
              <p className="text-slate-500 font-bold text-sm mb-6">El conductor ha cerrado el acta. Ya puedes descargar tu copia del checklist.</p>
              
              {/* Redirigimos al portal del cliente donde YA existe el motor para descargar PDF */}
              <button onClick={() => window.location.href = `/?client=${encodeURIComponent(job.client)}`} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">
                <Download className="w-5 h-5"/> Descargar PDF
              </button>
            </>
          ) : (
            <>
              <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Firma Recibida</h2>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4 mb-4">
                <p className="text-blue-700 font-bold text-sm flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin"></span>
                  A LA ESPERA DE TERMINAR EL CHECKLIST
                </p>
              </div>
              <p className="text-xs text-slate-400">Esta pantalla se actualizará automáticamente con el botón de descarga cuando el conductor finalice en su sistema.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const photos = job.checklist.photos || {};
  const hasPhotos = Object.values(photos).some(val => typeof val === 'string');

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      <header className="bg-blue-600 text-white p-4 shadow-md text-center">
        <h1 className="font-black text-xl tracking-wide">Acta de Recepción</h1>
      </header>

      <main className="max-w-md mx-auto p-4 pt-6 space-y-6">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
           <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-1">Vehículo a recibir</p>
           <h2 className="text-2xl font-black text-slate-800">{job.brand} {job.model}</h2>
           <p className="text-sm font-bold text-slate-500 uppercase mt-1">Patente: <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded">{job.plate || job.vin}</span></p>
        </div>

        {hasPhotos && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-800 mb-1 flex items-center gap-2"><Camera className="w-4 h-4 text-blue-500"/> Registro Fotográfico</h3>
            <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wide">Toca una foto para ampliarla</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(photos).map(([key, val]) => val && typeof val === 'string' && (
                 <img key={key} src={val} alt="Evidencia" onClick={() => setFullScreenImage(val)} className="w-full h-20 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all" />
              ))}
            </div>
          </div>
        )}

        {/* MODAL DE FOTO EN PANTALLA COMPLETA */}
        {fullScreenImage && (
          <div className="fixed inset-0 bg-slate-900/95 z-[200] flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
            <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors shadow-lg">
              <X className="w-6 h-6" />
            </button>
            <img src={fullScreenImage} alt="Evidencia Ampliada" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
           <h3 className="text-sm font-extrabold text-slate-800 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-blue-500"/> Tus Datos de Recepción</h3>
           <input required type="text" placeholder="Nombre Completo" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500" />
           <input required type="text" placeholder="RUT" value={formData.rut} onChange={e=>setFormData({...formData, rut: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500" />
           
           <h3 className="text-sm font-extrabold text-slate-800 pt-2 border-t border-slate-100">Comentarios (Opcional)</h3>
           <textarea placeholder="¿Alguna observación sobre el estado del vehículo al recibirlo?" value={formData.comments} onChange={e=>setFormData({...formData, comments: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[80px]" />

           <h3 className="text-sm font-extrabold text-slate-800 pt-2 border-t border-slate-100">Firma Digital</h3>
           <SignaturePad initialData={formData.signature} onSave={d=>setFormData({...formData, signature: d})} onClear={()=>setFormData({...formData, signature: null})} />

           <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-200 transition-colors mt-4 text-lg">Confirmar y Enviar Acta</button>
        </form>
      </main>

      {/* NUEVO: MODAL DE ALERTA PERSONALIZADO CON TU MARCA */}
      {alertMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-full"><AlertCircle className="w-6 h-6 text-blue-600"/></div>
              <h3 className="text-xl font-extrabold text-slate-800">LOGISTICAPP / LOGÍSTICA TS</h3>
            </div>
            <p className="text-slate-600 font-bold mb-6 text-sm">{alertMessage}</p>
            <button onClick={() => setAlertMessage(null)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md transition-colors hover:bg-blue-700">Aceptar</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const clientTrack = params.get('client');
  const liveTrackId = params.get('track'); 
  
  // NUEVO: Limpiamos la URL por si el escáner QR le agrega barras invertidas ("/") o espacios al final
  const rawSign = params.get('sign');
  const signTrackId = rawSign ? rawSign.replace(/[^a-zA-Z0-9_-]/g, '') : null;

  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customClients, setCustomClients] = useState([]);
  
  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [mainTab, setMainTab] = useState('jobs');
  const [activeRole, setActiveRole] = useState('driver');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [simulatedClient, setSimulatedClient] = useState('');
  
  // NUEVO: Estados para Modo Oscuro, Conexión Offline y Tuerca
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  
  const isFirstLoad = useRef(true);
  const driversRef = useRef([]);

  const [dialogConfig, setDialogConfig] = useState(null);

  // NUEVO: Escuchador de conexión a Internet (Idea 7)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  // NUEVO: Aplicador del Modo Oscuro Global (Idea 9)
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);
  const showAlert = (message) => setDialogConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setDialogConfig({ type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialogConfig(null);

  const requestNotificationPermission = () => {
    if (!("Notification" in window)) { showAlert("Tu navegador no soporta notificaciones."); return; }
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        setNotificationsEnabled(true);
        triggerNotification("¡Notificaciones Activadas!", "Recibirás alertas de nuevos trabajos aquí.");
      }
    });
  };

  const triggerNotification = (title, body) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, { body: body, icon: '/logo.png', vibrate: [200, 100, 200] });
        }).catch(() => new Notification(title, { body }));
      } else { new Notification(title, { body }); }
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if ("Notification" in window && Notification.permission === "granted") setNotificationsEnabled(true);
    });
    return () => unsub();
  }, []);

  const currentUserEmail = user?.email?.toLowerCase();
  const isRealAdmin = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(currentUserEmail);

  useEffect(() => {
    if (isRealAdmin) setActiveRole('admin');
  }, [isRealAdmin]);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  useEffect(() => {
    if (!user) return;
    
    // OPTIMIZACIÓN 1: Traer solo los últimos 200 trabajos (evita descargar historial antiguo)
    const qJobs = query(collection(db, 'transport_jobs'), orderBy('createdAt', 'desc'), limit(200));
    
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const d = change.doc.data();
          if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail)) {
             triggerNotification('📍 ¡Nuevo Traslado!', `CLIENTE: ${d.client || 'Sin Cliente'}\nMARCA: ${d.brand || '-'}\nMODELO: ${d.model || '-'}\nPATENTE: ${d.plate || d.vin || 'S/N'}\nDESDE: ${d.origin || '-'}\nHASTA: ${d.destination || '-'}`);
          }
          if (change.type === 'modified' && d.status === 'accepted' && isRealAdmin && activeRole === 'admin') {
             const driverName = driversRef.current.find(drv => drv.email === d.acceptedByEmail)?.name || d.acceptedByEmail;
             triggerNotification('✅ Trabajo Aceptado', `Conductor: ${driverName}\nCLIENTE: ${d.client || 'Sin Cliente'}\nMARCA: ${d.brand || '-'}\nMODELO: ${d.model || '-'}\nPATENTE: ${d.plate || d.vin || 'S/N'}\nDESDE: ${d.origin || '-'}\nHASTA: ${d.destination || '-'}`);
          }
        });
      }
      // Ya vienen ordenados de Firebase, solo mapeamos
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      isFirstLoad.current = false;
    });

    // OPTIMIZACIÓN 2: Traer solo los últimos 300 gastos
    const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(300));

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubExpenses = onSnapshot(qExpenses, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, 'clients'), snap => setCustomClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubDrivers(); unsubExpenses(); unsubVehicles(); unsubClients(); };
  }, [user, activeRole, currentUserEmail, isRealAdmin]);

  const allClientsList = Array.from(new Set([...DEFAULT_CLIENTES, ...customClients.map(c => c.name)])).sort();

  const globalStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Alfa+Slab+One&display=swap');
      
      body { 
        font-family: 'Nunito', sans-serif; 
        background-color: #f8fafc; 
        transition: background-color 0.3s; 
        
        /* MAGIA APP NATIVA */
        overscroll-behavior-y: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      
      .font-alfa { font-family: 'Alfa Slab One', serif; font-weight: 400; }
      
      /* REGLAS MAESTRAS MODO OSCURO (Anula Tailwind) */
      .dark body { background-color: #020617 !important; color: #f8fafc !important; }
      .dark header.fixed-nav-bar { background-color: #0f172a !important; border-bottom: 1px solid #1e293b !important; }
      .dark .bg-white:not(canvas) { background-color: #0f172a !important; border-color: #1e293b !important; }
      .dark canvas { background-color: #ffffff !important; border-radius: 0.5rem; color: #000 !important; }
      .dark .bg-slate-50 { background-color: #020617 !important; border-color: #0f172a !important; }
      .dark .bg-slate-100 { background-color: #1e293b !important; }
      .dark .bg-slate-200 { background-color: #334155 !important; }
      
      .dark .text-slate-800, .dark .text-slate-900 { color: #f8fafc !important; }
      .dark .text-slate-700 { color: #e2e8f0 !important; }
      .dark .text-slate-600 { color: #cbd5e1 !important; }
      .dark .text-slate-500, .dark .text-slate-400 { color: #94a3b8 !important; }
      .dark .border-slate-100, .dark .border-slate-200, .dark .border-slate-300 { border-color: #1e293b !important; }
      
      .dark .bg-blue-50 { background-color: rgba(30, 58, 138, 0.3) !important; border-color: #1e3a8a !important; }
      .dark .text-blue-800 { color: #93c5fd !important; }
      .dark .text-blue-600 { color: #60a5fa !important; }

      /* CORRECCIÓN: FORZAR FONDO OSCURO EN LAS LISTAS DESPLEGABLES */
      .dark select, .dark option {
        background-color: #0f172a !important;
        color: #e2e8f0 !important;
      }

      /* CLASE CUSTOM PARA CONGELAR LA BARRA DE NAVEGACIÓN SIN REBOTE */
      .fixed-nav-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 50 !important;
      }
    `}</style>
  );

  // --- NUEVO: SI HAY UN CLIENTE EN LA URL, MOSTRAR PORTAL DE CLIENTE ---
  if (clientTrack) {
    return (
      <>
        {globalStyles}
        <TrackingView clientName={clientTrack} db={db} darkMode={darkMode} setDarkMode={setDarkMode} />
      </>
    );
  }
  // --------------------------------------------------------------------------------

  // --- NUEVO: SI EL ADMIN ELIGE VISTA CLIENTE ---
  if (user && activeRole === 'client' && simulatedClient) {
    return (
      <>
        {globalStyles}
        <TrackingView clientName={simulatedClient} db={db} onBack={() => { setActiveRole('admin'); setRoleMenuOpen(false); }} darkMode={darkMode} setDarkMode={setDarkMode} />
      </>
    );
  }
  // --------------------------------------------------------------------------------
  
  // --- NUEVO: VISTA DE FIRMA REMOTA DEL CLIENTE ---
  if (signTrackId) {
    return (
      <>
        {globalStyles}
        <ClientSignView jobId={signTrackId} db={db} />
      </>
    );
  }
  // --------------------------------------------------------------------------------
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-blue-50">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 transform rotate-3 hover:rotate-0 transition-transform"><Car className="w-10 h-10 text-white" /></div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">LogisticAPP</h1>
          <p className="text-slate-500 mb-10 text-lg">Gestión de traslados inteligente</p>
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e))} className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 px-4 rounded-2xl shadow-sm hover:bg-slate-50 flex items-center justify-center gap-3 transition-all text-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" /> Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  const exportToExcel = () => {
    const headers = ['ID', 'Fecha Prog.', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Desde', 'Hasta', 'Conductores Asignados', 'Conductor Realizó', 'Estado', 'Fecha Creación'];
    const rows = jobs.map(j => {
      let realizedBy = '';
      if (['completed', 'accepted', 'failed'].includes(j.status)) {
        realizedBy = j.acceptedByEmail ? (drivers.find(d => d.email === j.acceptedByEmail)?.name || j.acceptedByEmail) : (j.assignedDriverName || '');
      }
      let st = j.status === 'pending' ? 'Pendiente' : j.status === 'accepted' ? 'En Curso' : j.status === 'completed' ? 'Completado' : `Fallido - ${j.failedReason || ''}`;
      return [
        j.id, `"${formatDateDisplay(j.scheduledDate) || ''}"`, `"${j.client || ''}"`, `"${j.brand || ''}"`, `"${j.model || ''}"`, `"${j.plate || j.vin || ''}"`, 
        `"${j.origin || ''}"`, `"${j.destination || ''}"`, `"${j.assignedDrivers?.map(d=>d.name).join(' - ') || ''}"`, `"${realizedBy}"`, `"${st}"`, `"${new Date(j.createdAt).toLocaleString()}"`
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", "Reporte_Trabajos.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleQuickChecklist = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedJob({ id: 'NEW_QUICK_JOB', client: '', brand: '', model: '', plate: '', vin: '', origin: '', destination: '', tripType: 'traslado', scheduledDate: today });
    setCurrentView('checklist');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-32 transition-colors duration-300">
      {globalStyles}
      <header className="fixed-nav-bar bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20 transition-colors duration-300">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
      {/* Logo de la app más pequeño en móvil */}
      <div className="bg-white/20 p-1 sm:p-1.5 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0">
        <img src="/logo.png" alt="Logo App" className="w-7 h-7 sm:w-12 sm:h-12 object-contain" />
      </div>
      
      {/* Nombre de la aplicación adaptado para no chocar */}
      <h1 className="font-alfa text-lg sm:text-3xl tracking-wide shrink-0 text-white" style={{ paddingTop: '2px' }}>
        LogisticAPP
      </h1>
      
      {/* Logo Logística TS SpA ajustado al nuevo tamaño */}
      <div className="bg-white/20 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0 ml-0.5 sm:ml-1 overflow-hidden">
        <img src="/LogoLogistica.png" alt="Logística TS SpA" className="h-8 sm:h-15 object-contain" />
      </div>
    </div>
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* NUEVO: BOTÓN TUERCA (AJUSTES) */}
          <div className="relative">
            <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors shadow-sm border border-white/10">
              <Settings className="w-5 h-5 text-white" />
            </button>
            
            {settingsOpen && (
              <div className="absolute right-0 top-12 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Ajustes de App</p>
                </div>
                <div className="p-4 space-y-5">
                  {/* Estado de Red */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Señal de Red</span>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm border ${isOnline ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200 animate-pulse'}`}>
                      {isOnline ? <><Wifi className="w-3.5 h-3.5"/> Online</> : <><CloudOff className="w-3.5 h-3.5"/> Offline</>}
                    </div>
                  </div>
                  {/* Switch Modo Oscuro */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      {darkMode ? <Moon className="w-4 h-4 text-blue-600"/> : <Sun className="w-4 h-4 text-amber-500"/>} Modo Oscuro
                    </span>
                    <button onClick={() => setDarkMode(!darkMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner ${darkMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!notificationsEnabled && <button onClick={requestNotificationPermission} className="p-2 bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-sm" title="Activar Notificaciones"><Bell className="w-5 h-5 text-white animate-pulse" /></button>}
          {isRealAdmin && (
            <div className="relative">
              <button onClick={() => setRoleMenuOpen(!roleMenuOpen)} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl text-sm font-bold transition-all border border-white/10 backdrop-blur-sm">
                <Eye className="w-5 h-5 text-white"/>
                <span className="hidden md:inline">Vista: {activeRole === 'admin' ? 'Admin' : activeRole === 'driver' ? 'Conductor' : 'Cliente'}</span>
              </button>
              {roleMenuOpen && (
                <div className="absolute right-0 top-12 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 text-slate-800">
                  <div className="p-2 border-b border-slate-100 bg-slate-50"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Cambiar Perfil</p></div>
                  <button onClick={() => { setActiveRole('admin'); setMainTab('jobs'); setRoleMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors ${activeRole==='admin'?'text-blue-600 bg-blue-50':'text-slate-600'}`}>
                     <Users className="w-4 h-4"/> Administrador
                  </button>
                  <button onClick={() => { setActiveRole('driver'); setMainTab('jobs'); setRoleMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors ${activeRole==='driver'?'text-blue-600 bg-blue-50':'text-slate-600'}`}>
                     <Car className="w-4 h-4"/> Conductor
                  </button>
                  <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2">
                     <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5"/> Simular Portal de Cliente</p>
                     <select value={simulatedClient} onChange={(e) => setSimulatedClient(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 bg-white">
                        <option value="">Seleccionar Cliente...</option>
                        {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <button onClick={() => { if(simulatedClient) { setActiveRole('client'); setRoleMenuOpen(false); } else { showAlert("Selecciona un cliente de la lista primero"); } }} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-sm">Entrar como Cliente</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="hidden md:block text-right mr-2"><p className="text-xs text-blue-200 font-bold uppercase tracking-wider">Sesión iniciada</p><p className="text-sm font-extrabold">{currentUserEmail}</p></div>
          <button onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors" title="Cerrar sesión"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24">
          {activeRole === 'admin' ? (
            <>
              <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={() => {setAdminTab('dashboard'); setEditingJob(null);}} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-extrabold transition-colors ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><ClipboardList className="w-5 h-5"/> Monitor</button>
                <button onClick={() => {setAdminTab('newJob'); setEditingJob(null);}} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-extrabold transition-colors ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-5 h-5"/> Crear</button>
                <button onClick={() => setAdminTab('config')} className={`flex-1 flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-extrabold transition-colors ${adminTab==='config'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Truck className="w-5 h-5"/> Config</button>
              </div>
              
              {adminTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h2 className="text-2xl font-extrabold text-slate-800">Monitor de Trabajos</h2>
                    <button onClick={exportToExcel} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-lg shadow-green-200 transition-colors"><Download className="w-5 h-5"/> Exportar Excel</button>
                  </div>
                  <JobsList 
                    jobs={jobs} drivers={drivers} role="admin" 
                    onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} 
                    onEditJob={(j) => { setEditingJob(j); setAdminTab('newJob'); }} 
                    db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
                  />
                </div>
              )}
              
              {adminTab === 'newJob' && <NewJobForm key={editingJob ? editingJob.id : 'new'} jobToEdit={editingJob} onCancelEdit={() => {setEditingJob(null); setAdminTab('dashboard');}} allClientsList={allClientsList} vehicles={vehicles} drivers={drivers} db={db} showAlert={showAlert} onSuccess={() => setAdminTab('dashboard')} />}
              {adminTab === 'config' && <ConfigView allClientsList={allClientsList} customClients={customClients} vehicles={vehicles} drivers={drivers} db={db} showAlert={showAlert} showConfirm={showConfirm} />}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Mis Trabajos Asignados</h2>
              <JobsList 
                 jobs={jobs} drivers={drivers} role="driver" 
                 onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} 
                 db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
              />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      
      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
          <ChecklistForm 
             job={selectedJob} db={db} currentUserEmail={currentUserEmail} 
             allClientsList={allClientsList}
             drivers={drivers} expenses={expenses} 
             onCancel={() => { 
                localStorage.removeItem('checklist_draft_' + selectedJob.id);
                setCurrentView('main');
             }} 
             onComplete={() => { 
                localStorage.removeItem('checklist_draft_' + selectedJob.id);
                setSelectedJob(null); setCurrentView('main'); 
             }} 
             showAlert={showAlert} showConfirm={showConfirm} 
          />
        </main>
      )}

      {currentView === 'main' && (
        <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <button onClick={handleQuickChecklist} className="flex flex-col items-center text-slate-400 hover:text-blue-600 transition-colors w-20 sm:w-24">
             <div className="bg-slate-100 p-2 rounded-xl mb-1"><Zap className="w-5 h-5"/></div>
             <span className="text-[10px] font-extrabold tracking-wide">Desde 0</span>
          </button>
          <button onClick={() => setMainTab('jobs')} className={`flex flex-col items-center transition-colors w-20 sm:w-24 ${mainTab==='jobs' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}>
             <div className={`${mainTab==='jobs' ? 'bg-blue-100' : 'bg-transparent'} p-2 rounded-xl mb-1`}><ClipboardList className="w-5 h-5"/></div>
             <span className="text-[10px] font-extrabold tracking-wide">Trabajos</span>
          </button>
          <button onClick={() => setMainTab('ranking')} className={`flex flex-col items-center transition-colors w-20 sm:w-24 ${mainTab==='ranking' ? 'text-yellow-600' : 'text-slate-400 hover:text-yellow-600'}`}>
             <div className={`${mainTab==='ranking' ? 'bg-yellow-100' : 'bg-transparent'} p-2 rounded-xl mb-1`}><Trophy className="w-5 h-5"/></div>
             <span className="text-[10px] font-extrabold tracking-wide">Ranking</span>
          </button>
          <button onClick={() => setMainTab('expenses')} className={`flex flex-col items-center transition-colors w-20 sm:w-24 ${mainTab==='expenses' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}>
             <div className={`${mainTab==='expenses' ? 'bg-blue-100' : 'bg-transparent'} p-2 rounded-xl mb-1`}><Wallet className="w-5 h-5"/></div>
             <span className="text-[10px] font-extrabold tracking-wide">Gastos</span>
          </button>
        </nav>
      )}

      {dialogConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4"><div className="bg-blue-100 p-2 rounded-full">{dialogConfig.type === 'confirm' ? <AlertCircle className="w-6 h-6 text-blue-600"/> : <Bell className="w-6 h-6 text-blue-600"/>}</div><h3 className="text-xl font-extrabold">LogisticAPP</h3></div>
            <p className="text-slate-600 font-bold mb-6 text-sm">{dialogConfig.message}</p>
            <div className="flex gap-3">
              {dialogConfig.type === 'confirm' && <button onClick={closeDialog} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm">Cancelar</button>}
              <button onClick={() => { if (dialogConfig.onConfirm) dialogConfig.onConfirm(); closeDialog(); }} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardView({ jobs, drivers, isAdminView }) {
  const [selectedDriverJobs, setSelectedDriverJobs] = useState(null);
  const now = new Date(); const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  
  // Modificado: Ahora cuenta los completados Y las revisiones técnicas fallidas del mes
  const monthlyCompleted = jobs.filter(j => {
    if (!j.completedAt || j.completedAt < firstOfCurrentMonth) return false;
    return j.status === 'completed' || (j.status === 'failed' && j.tripType === 'revision');
  });
  
  const ranking = drivers.map(d => { const dj = monthlyCompleted.filter(j => j.acceptedByEmail === d.email); return { ...d, score: dj.length, jobs: dj }; }).sort((a, b) => b.score - a.score);

  return (
    <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
      <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Ranking Mensual</h2>
      <div className="bg-white rounded-3xl border p-2 sm:p-4 shadow-sm">
        {ranking.length === 0 ? <p className="text-center py-6 text-sm font-bold text-slate-400">Sin datos de traslados este mes.</p> : ranking.map((dr, i) => (
          <div key={dr.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-slate-50 rounded-xl text-sm transition-colors">
             <div className="flex items-center gap-4"><span className={`text-xl font-black ${i===0?'text-yellow-500':i===1?'text-slate-400':i===2?'text-amber-700':'text-slate-300'}`}>#{i+1}</span><div><p className="font-extrabold text-slate-800">{dr.name}</p><p className="text-xs text-slate-500 font-bold">{dr.score} Traslados</p></div></div>
             {isAdminView && <button onClick={() => setSelectedDriverJobs(dr)} className="flex gap-1 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl font-bold text-xs items-center transition-colors"><Eye className="w-3.5 h-3.5"/> Historial</button>}
          </div>
        ))}
      </div>
      {selectedDriverJobs && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col p-4">
            <div className="p-2 border-b flex justify-between items-center"><h2 className="text-lg font-extrabold text-slate-800">{selectedDriverJobs.name}</h2><button onClick={()=>setSelectedDriverJobs(null)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X className="w-4 h-4"/></button></div>
            <div className="p-2 overflow-y-auto space-y-3 flex-1 mt-2">
              {selectedDriverJobs.jobs.length === 0 ? <p className="text-center text-sm font-bold text-slate-400">Sin traslados.</p> : selectedDriverJobs.jobs.map(j => (
                <div key={j.id} className="bg-slate-50 p-3 rounded-xl border text-xs relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${j.status==='failed'?'bg-red-500':'bg-green-500'}`}></div>
                  <div className="flex justify-between mb-1 pl-2">
                     <p className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                       {j.brand} {j.model} 
                       {j.status === 'failed' && <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded uppercase">Rechazada</span>}
                     </p>
                     <span className="border px-1.5 rounded bg-white font-bold text-slate-600 uppercase">{j.plate||j.vin}</span>
                  </div>
                  <p className="font-semibold text-slate-500 pl-2"><MapPin className="inline w-3 h-3 mr-0.5"/> {j.origin} ➔ <Navigation className="inline w-3 h-3 mr-0.5"/> {j.destination}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ExpensesView({ role, drivers, jobs, expenses, db, currentUserEmail, showAlert, showConfirm }) {
  const isAdminView = role === 'admin';
  const myDriver = drivers.find(d => d.email === currentUserEmail);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState(null);
  const [returnMethod, setReturnMethod] = useState('transferencia');
  const [editingExpense, setEditingExpense] = useState(null);
  const [adminTxType, setAdminTxType] = useState('assignment'); 

  const activeOrPendingJobs = jobs?.filter(j => j.status === 'pending' || j.status === 'accepted') || [];

  const addExp = async (e, type, amount, detail, driverId, dName, dEmail) => {
    e.preventDefault();
    const currentBalance = drivers.find(d => d.id === driverId)?.balance || 0;
    
    // Si es conductor, bloquea si no hay saldo
    if (!isAdminView && type === 'expense' && amount > currentBalance) return showAlert("Saldo insuficiente.");
    
    const assocJobId = e.target.jobId?.value || '';
    let detailString = detail || (type === 'assignment' ? 'Asignación de fondos' : 'Gasto registrado por Admin');

    if (assocJobId) {
      const jb = activeOrPendingJobs.find(x => x.id === assocJobId);
      if (jb) detailString += ` (Asoc. a patente ${jb.plate || jb.vin || 'S/N'})`;
    }

    // Lógica para saldos y negativos
    let newBalance = currentBalance;
    let deductedAmount = amount; // <-- NUEVO: Memoria de cuánto se descontó realmente
    
    if (type === 'assignment') {
       newBalance = currentBalance + amount;
    } else if (type === 'expense') {
       if (isAdminView) {
          if (assocJobId) {
             // Si el admin asocia el gasto a un trabajo, el saldo puede quedar en negativo
             newBalance = currentBalance - amount;
          } else {
             // Si es un gasto libre (sólo anotar), el saldo no baja de 0
             newBalance = Math.max(0, currentBalance - amount);
             deductedAmount = currentBalance - newBalance; // Calcula cuánto se restó de verdad
          }
       } else {
          newBalance = currentBalance - amount;
       }
    }

    try {
      await updateDoc(doc(db, 'drivers', driverId), { balance: newBalance });
      // Guardamos también el "deductedAmount" en la base de datos
      await addDoc(collection(db, 'expenses'), { driverId, driverEmail: dEmail, driverName: dName, type, amount, detail: detailString, jobId: assocJobId, deductedAmount, createdAt: Date.now() });
      e.target.reset(); 
      showAlert(type === 'assignment' ? "Fondo asignado correctamente." : "Gasto registrado exitosamente.");
    } catch (err) { console.error(err); }
  };

  const submitReturn = async () => {
    if (returnMethod === 'transferencia' && !returnReceipt) return showAlert("Sube la foto de la transferencia.");
    if (!myDriver?.balance) return;
    
    let det = returnMethod === 'efectivo' ? 'Rendición en Efectivo (En revisión)' : 'Rendición de Vuelto (En revisión)';
    
    try {
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: det, receiptImage: returnReceipt, createdAt: Date.now() });
      setIsReturnOpen(false); setReturnReceipt(null); showAlert("Rendición enviada. Esperando validación de Admin.");
    } catch(e) {}
  };

  const approveReturn = async (exp) => {
    try {
      const d = drivers.find(x => x.id === exp.driverId);
      if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: Math.max(0, (d.balance||0) - exp.amount) });
      await updateDoc(doc(db, 'expenses', exp.id), { type: 'return', detail: 'Rendición Aprobada' });
      showAlert("Rendición aprobada. El balance del conductor volvió a 0.");
    } catch(e){}
  };

  const delExp = (exp) => {
    if (!isAdminView && exp.type === 'assignment') return showAlert("No posees permisos.");
    showConfirm("¿Eliminar registro financiero? El saldo se recalculará.", async () => {
      try {
        const d = drivers.find(x => x.id === exp.driverId);
        if (d) {
           // Al eliminar, solo devuelve el dinero que REALMENTE se le descontó al conductor
           let amountToRestore = exp.type === 'assignment' ? -exp.amount : (exp.deductedAmount !== undefined ? exp.deductedAmount : exp.amount);
           await updateDoc(doc(db, 'drivers', d.id), { balance: (d.balance||0) + amountToRestore });
        }
        await deleteDoc(doc(db, 'expenses', exp.id));
      } catch(e){}
    });
  };

  const TransactionIcon = ({ type }) => {
    if (type === 'assignment') return <ArrowUpCircle className="w-5 h-5 text-green-500 shrink-0"/>;
    if (type === 'pending_return') return <Clock className="w-5 h-5 text-amber-500 shrink-0"/>;
    if (type === 'expense') return <ArrowDownCircle className="w-5 h-5 text-red-500 shrink-0"/>;
    return <CheckCircle className="w-5 h-5 text-blue-500 shrink-0"/>;
  };

  const EditExpenseModal = ({ expense, onClose }) => {
    const handleUpdateSubmit = async (e) => {
      e.preventDefault();
      if (!isAdminView && expense.type === 'assignment') { showAlert("No puedes modificar una asignación."); return onClose(); }
      const newAmount = Number(e.target.amount.value);
      const newDetail = e.target.detail.value;

      try {
        let newlyDeducted = newAmount;
        const driverSnapshot = drivers.find(d => d.id === expense.driverId);
        
        if (driverSnapshot) {
          let currentDriverBalance = driverSnapshot.balance || 0;
          
          if (expense.type === 'assignment') {
             const amountDiff = newAmount - expense.amount;
             currentDriverBalance += amountDiff;
          } else if (expense.type === 'expense' || expense.type === 'return') {
             let oldDeducted = expense.deductedAmount !== undefined ? expense.deductedAmount : expense.amount;
             
             // 1. Devolvemos el dinero que se había descontado originalmente
             currentDriverBalance += oldDeducted;
             
             // 2. Aplicamos el nuevo descuento
             if (isAdminView && !expense.jobId && expense.type === 'expense') {
                 // Si es gasto libre, vuelve a respetar el límite de 0
                 let balanceAfter = Math.max(0, currentDriverBalance - newAmount);
                 newlyDeducted = currentDriverBalance - balanceAfter;
                 currentDriverBalance = balanceAfter;
             } else {
                 // Si es con trabajo, descuenta directo
                 currentDriverBalance -= newAmount;
                 newlyDeducted = newAmount;
             }
          }
          await updateDoc(doc(db, 'drivers', expense.driverId), { balance: currentDriverBalance });
        }
        await updateDoc(doc(db, 'expenses', expense.id), { amount: newAmount, detail: newDetail, deductedAmount: newlyDeducted });
        showAlert("Registro actualizado."); onClose();
      } catch (error) { console.error(error); showAlert("Error actualizando."); }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <form onSubmit={handleUpdateSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Editar Registro</h3><button type="button" onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
          <div className="space-y-4">
            <div><label className="text-xs font-bold text-slate-500 uppercase">Detalle</label><input name="detail" defaultValue={expense.detail} required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" /></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Monto ($)</label><input name="amount" type="number" defaultValue={expense.amount} required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" /></div>
          </div>
          <div className="flex gap-4 mt-6"><button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button type="submit" className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Guardar</button></div>
        </form>
      </div>
    );
  };

  const safeDateRender = (timestamp) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return 'Fecha inválida';
      return d.toLocaleDateString();
    } catch(e) { return 'Fecha inválida'; }
  };

  if (isAdminView) {
    return (
      <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
        {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}
        {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

       <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Wallet className="text-blue-600"/> Control Viáticos</h2>
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            {drivers.map(d => (
              <div key={d.id} className={`bg-white p-4 rounded-3xl border cursor-pointer ${selectedDriverId === d.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100 hover:border-blue-300'}`} onClick={() => {setSelectedDriverId(d.id === selectedDriverId ? null : d.id); setAdminTxType('assignment');}}>
                <div className="flex justify-between items-center"><div><p className="font-extrabold text-base text-slate-800">{d.name}</p><p className="text-xs text-slate-400 font-bold">{d.email}</p></div><div className="text-right"><p className="text-[10px] uppercase font-bold text-slate-400">Saldo</p><p className={`font-black text-lg ${d.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(d.balance||0)}</p></div></div>
                {selectedDriverId === d.id && (
                  <form onSubmit={(e) => addExp(e, adminTxType, Number(e.target.amount.value), adminTxType === 'expense' ? e.target.detail?.value : '', d.id, d.name, d.email)} className="mt-4 border-t pt-3 space-y-2.5" onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-2 mb-2">
                       <button type="button" onClick={() => setAdminTxType('assignment')} className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${adminTxType === 'assignment' ? 'bg-green-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>+ Entregar Fondo</button>
                       <button type="button" onClick={() => setAdminTxType('expense')} className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${adminTxType === 'expense' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>- Anotar Gasto</button>
                    </div>
                    
                    {adminTxType === 'expense' && (
                       <input name="detail" type="text" required placeholder="Detalle del gasto (ej. Peaje, Bencina)" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-blue-500"/>
                    )}
                    
                    <input name="amount" type="number" required placeholder={adminTxType === 'assignment' ? "Monto a asignar $" : "Monto del gasto $"} className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-blue-500"/>
                    
                    <select name="jobId" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none focus:border-blue-500">
                       <option value="">{adminTxType === 'assignment' ? "Asociar a un Trabajo (Opcional)" : "Trabajo activo (Opcional, permite saldo negativo)"}</option>
                       {activeOrPendingJobs.map(j => <option key={j.id} value={j.id}>{j.client} - {j.brand} ({j.plate || j.vin || 'S/N'})</option>)}
                    </select>
                    <button className={`w-full py-2 rounded-xl font-bold text-sm transition-colors text-white ${adminTxType === 'assignment' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>Confirmar {adminTxType === 'assignment' ? 'Fondo' : 'Gasto'}</button>
                  </form>
                )}
              </div>
            ))}
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden w-full">
            <h3 className="font-bold text-slate-700 mb-4 text-sm">{selectedDriverId ? 'Movimientos del Conductor' : 'Historial de Rendiciones'}</h3>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1" style={{ maxHeight: '60vh' }}>
              {expenses.filter(e => selectedDriverId ? e.driverId === selectedDriverId : true).map(exp => (
                <div key={exp.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex gap-3 items-start text-xs font-bold w-full overflow-hidden">
                  <div className="mt-1"><TransactionIcon type={exp.type}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 break-words">{exp.detail}</p>
                    <p className="text-[10px] text-slate-400 truncate">{!selectedDriverId && <span className="text-blue-600">{exp.driverName} • </span>}{safeDateRender(exp.createdAt)}</p>
                    {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver comprobante</button>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                    {exp.type === 'pending_return' && <button onClick={() => approveReturn(exp)} className="ml-1 text-xs font-bold bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors">Aprobar</button>}
                    {exp.type !== 'pending_return' && (
                      <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                        <button onClick={() => setEditingExpense(exp)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={() => delExp(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {expenses.length === 0 && <p className="text-slate-400 font-bold text-sm text-center py-4">No hay movimientos registrados.</p>}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!myDriver) return <main className="p-8 text-center text-slate-500 font-bold pb-24">No estás registrado como conductor. Pide al admin que te agregue.</main>;
  const myBalance = myDriver.balance || 0;
  const hasPendingReturn = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  return (
    <main className="max-w-md mx-auto p-4 pt-20 sm:pt-24 space-y-6 pb-24">
      {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

      {isReturnOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Rendir Vuelto</h3><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
            <p className="text-sm font-bold text-slate-500 mb-4 border-b border-slate-100 pb-4">Monto total a transferir/rendir: <span className="text-blue-600 text-xl font-extrabold block mt-1">{formatMoney(myBalance)}</span></p>
            
            <div className="flex gap-2 mb-4">
               <button onClick={()=>setReturnMethod('transferencia')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${returnMethod==='transferencia'?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>Transferencia</button>
               <button onClick={()=>setReturnMethod('efectivo')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${returnMethod==='efectivo'?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>Efectivo</button>
            </div>

            {returnMethod === 'transferencia' ? (
              <label className={`block w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors relative overflow-hidden ${returnReceipt ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const dataUrl = await resizeImage(f, 800, 0.7); setReturnReceipt(dataUrl);}catch(e){showAlert("Error procesando foto");}}} />
                {returnReceipt ? (
                   <div className="relative z-10"><CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2 bg-white rounded-full"/><p className="text-sm font-extrabold text-green-700 mb-2">Comprobante Cargado</p><img src={returnReceipt} className="h-28 object-contain mx-auto rounded-lg shadow-sm border border-green-200" alt="preview"/><p className="text-xs font-bold text-slate-500 mt-3 underline">Cambiar foto</p></div>
                ) : (
                   <div className="py-4"><Camera className="w-10 h-10 text-slate-400 mx-auto mb-3"/><p className="text-sm font-extrabold text-slate-600">Sube aquí el comprobante</p></div>
                )}
              </label>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center"><p className="text-sm font-bold text-slate-600">Se registrará que entregaste el dinero en mano.</p></div>
            )}

            <div className="flex gap-4 mt-6"><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={submitReturn} className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-extrabold transition-all shadow-lg shadow-green-200">Confirmar</button></div>
          </div>
        </div>
      )}

      {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}

      <div className={`bg-gradient-to-br ${myBalance < 0 ? 'from-red-600 to-red-800' : 'from-blue-600 to-indigo-700'} p-6 rounded-3xl shadow-md text-center text-white relative overflow-hidden`}>
        <Wallet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
        <p className={`font-bold uppercase tracking-wider text-xs mb-1 ${myBalance < 0 ? 'text-red-200' : 'text-blue-100'}`}>Fondo Asignado Actual</p>
        <p className="text-4xl font-extrabold tracking-tight">{formatMoney(myBalance)}</p>
      </div>

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2 mb-4"><Receipt className="w-5 h-5 text-red-500"/> Registrar Gasto</h3>
        <form onSubmit={e=>addExp(e,'expense',Number(e.target.amount.value), e.target.detail.value, myDriver.id, myDriver.name, myDriver.email)} className="space-y-4">
          <input type="text" name="detail" placeholder="¿En qué gastaste? (Ej. Peaje)" required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-700" />
          <input type="number" name="amount" placeholder="Monto ($)" required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-700" />
          <button type="submit" disabled={myBalance <= 0 || hasPendingReturn} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-all ${myBalance > 0 && !hasPendingReturn ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Guardar Gasto</button>
        </form>
      </div>
      
      {hasPendingReturn ? (
        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-3xl text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2"/>
            <p className="font-extrabold text-sm text-amber-700">Rendición en Revisión</p>
            <p className="text-xs font-bold text-amber-600 mt-1">El administrador debe aprobar tu comprobante para actualizar el saldo a $0.</p>
        </div>
      ) : (
        myBalance > 0 && (
          <button onClick={() => setIsReturnOpen(true)} className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-2 border-green-200 py-4 rounded-3xl font-extrabold text-sm flex justify-center items-center gap-2 transition-all">
            <CheckCircle className="w-5 h-5"/> Rendir Vuelto ($0)
          </button>
        )
      )}

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-base font-extrabold text-slate-800 mb-4">Mis Movimientos</h3>
        <div className="space-y-3">
          {expenses.filter(e => e.driverId === myDriver.id).map(exp => (
            <div key={exp.id} className="flex items-start gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="mt-1"><TransactionIcon type={exp.type}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-slate-800 break-words">{exp.detail}</p>
                <p className="text-[10px] font-bold text-slate-400">{safeDateRender(exp.createdAt)}</p>
                {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver foto</button>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                {exp.type !== 'assignment' && exp.type !== 'pending_return' ? (
                  <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                    <button onClick={() => setEditingExpense(exp)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => delExp(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                ) : <div className="pl-2 ml-1"><span className="text-[10px] font-bold text-slate-400 uppercase">{exp.type === 'assignment' ? 'Fondo' : 'Espera'}</span></div>}
              </div>
            </div>
          ))}
          {expenses.filter(e => e.driverId === myDriver.id).length === 0 && <p className="text-slate-400 font-bold text-sm text-center py-4">No has registrado movimientos.</p>}
        </div>
      </div>
    </main>
  );
}

function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail, showAlert, showConfirm, allClientsList }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [jobToFail, setJobToFail] = useState(null);
  const [prtPromptJob, setPrtPromptJob] = useState(null); 
  const [historyClientFilter, setHistoryClientFilter] = useState(''); 
  const [searchTerm, setSearchTerm] = useState(''); // <-- ESTADO BÚSQUEDA

  // Función para actualizar la fase del traslado en vivo (SE DECLARA SOLO UNA VEZ)
  const updatePhase = async (job, phase, extra = {}) => {
    try { await updateDoc(doc(db, 'transport_jobs', job.id), { phase, ...extra }); } 
    catch (e) { console.error(e); showAlert("Error de conexión al actualizar fase."); }
  }; 
  
  const now = new Date();
  const isAdminView = role === 'admin';
  
  // LÓGICA DE FILTRADO Y BÚSQUEDA (SE DECLARA SOLO UNA VEZ)
  const filteredJobs = jobs.filter(job => {
    if (!isAdminView) {
      if (job.status === 'pending') {
        if (!job.assignedEmails?.includes(currentUserEmail)) return false;
      } else {
        if (job.acceptedByEmail !== currentUserEmail) return false;
      }
      if (job.status === 'failed' && job.tripType !== 'revision') return false; 
    }
    
    if (!job.createdAt) return true;
    if (!isAdminView) {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if ((now.getTime() - job.createdAt) > sevenDays) return false;
    } else {
      const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      if (job.createdAt < firstOfCurrentMonth) return false;
    }

    // Filtro de Búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchPlate = (job.plate || '').toLowerCase().includes(term);
      const matchBrand = (job.brand || '').toLowerCase().includes(term);
      const matchModel = (job.model || '').toLowerCase().includes(term);
      const matchClient = (job.client || '').toLowerCase().includes(term);
      if (!matchPlate && !matchBrand && !matchModel && !matchClient) return false;
    }

    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const adminOrder = { pending: 1, accepted: 2, completed: 3, failed: 3 };
    const driverOrder = { accepted: 1, pending: 2, completed: 3, failed: 3 };
    const order = isAdminView ? adminOrder : driverOrder;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    
    if (a.status === 'completed' || a.status === 'failed') return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
    
    const getValidTime = (dateStr, fallback) => {
       if (!dateStr) return fallback || 0;
       const time = new Date(dateStr).getTime();
       return isNaN(time) ? fallback || 0 : time;
    };
    return getValidTime(a.scheduledDate, a.createdAt) - getValidTime(b.scheduledDate, b.createdAt);
  });

  const activeJobs = sortedJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
  const historyJobsRaw = sortedJobs.filter(j => j.status === 'completed' || j.status === 'failed');
  
  const historyJobs = historyJobsRaw.filter(j => {
     if (!historyClientFilter) return true;
     if (historyClientFilter === 'OTRO') return !allClientsList.includes(j.client);
     return j.client === historyClientFilter;
  });

  const handleAcceptJob = async (job) => {
    try { await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'accepted', acceptedByEmail: currentUserEmail }); } 
    catch (e) { console.error(e); }
  };

  const handleDeleteJob = async (jobId) => {
    showConfirm("¿Estás seguro de eliminar este trabajo definitivamente?", async () => {
      try { await deleteDoc(doc(db, 'transport_jobs', jobId)); } catch (e) { console.error(e); }
    });
  };

  const handleFailJob = async (job, reason) => {
    try {
      if (job.tripType === 'revision' && reason === 'RECHAZO_RT_AUTOMATICO') {
          const cloneJob = {
              scheduledDate: job.scheduledDate, client: job.client, brand: job.brand, model: job.model, vin: job.vin, plate: job.plate,
              origin: job.origin, destination: job.destination, tripType: job.tripType, rtData: job.rtData,
              assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [],
              status: 'pending', createdAt: Date.now(), checklist: null
          };
          await addDoc(collection(db, 'transport_jobs'), cloneJob);
      }
      await updateDoc(doc(db, 'transport_jobs', job.id), { 
        status: 'failed', failedReason: reason === 'RECHAZO_RT_AUTOMATICO' ? job.checklist?.rtRejectReason || 'Revisión Técnica Rechazada' : reason, 
        completedAt: Date.now(), acceptedByEmail: job.acceptedByEmail || currentUserEmail
      });
      setJobToFail(null); showAlert(reason === 'RECHAZO_RT_AUTOMATICO' ? "Revisión guardada como rechazada y se ha creado un nuevo traslado pendiente." : "Trabajo marcado como fallido.");
    } catch (e) { console.error(e); }
  };

  const getRouteStr = (j) => {
    if (j.tripType === 'revision') {
       if (j.checklist?.rtStatus === 'aprobado') {
           const ret = j.checklist.rtReturnOption === 'other' ? j.checklist.rtReturnDestination : j.origin;
           return `${j.origin} ➔ PRT ➔ ${ret || '-'}`;
       }
       if (j.checklist?.rtStatus === 'rechazado') {
           return `${j.origin} ➔ PRT (Rechazada)`;
       }
       return `${j.origin} ➔ Planta de Revisión (PRT)`;
    }
    return `${j.origin} ➔ ${j.destination}`;
  };

  const buildPDFDoc = async (job) => {
    // CORRECCIÓN: Carga ultra-segura de jsPDF compatible con Vite
    const jsPDFModule = await import('jspdf');
    const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
    const docPDF = new JsPDFClass();

    const cleanStr = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/➔/g, '->')
        .replace(/•/g, '-')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    };

    const getImageDims = (src) => new Promise(resolve => { 
      const img = new Image(); 
      img.onload = () => resolve({ w: img.width, h: img.height }); 
      img.onerror = () => resolve({ w: 85, h: 60 }); 
      img.src = src; 
    });

    const primaryColor = [30, 41, 59];
    const secondaryColor = [100, 116, 139];
    const accentColor = [37, 99, 235];
    const lightBg = [248, 250, 252];
    const borderColor = [226, 232, 240];

    const loadSimpleLogo = async (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0, img.width, img.height);
          resolve({ data: tempCanvas.toDataURL('image/png'), w: img.width, h: img.height });
        };
        img.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 1500); 
      });
    };

    const [logoApp, logoLogistica] = await Promise.all([
      loadSimpleLogo('/logo.png'),
      loadSimpleLogo('/LogoLogistica.png')
    ]);

    const drawHeader = (titleText) => {
      docPDF.setFillColor(...primaryColor);
      docPDF.rect(0, 0, 210, 40, 'F');

      docPDF.setTextColor(255, 255, 255);
      docPDF.setFontSize(18);
      docPDF.setFont("helvetica", "bold");
      docPDF.text(cleanStr(titleText), 105, 18, null, null, "center");

      docPDF.setFontSize(9);
      docPDF.setFont("helvetica", "normal");
      docPDF.setTextColor(148, 163, 184);
      docPDF.text(`FECHA TRASLADO: ${formatDateDisplay(job.scheduledDate) || '-'}`, 105, 26, null, null, "center");

      docPDF.setFontSize(11);
      docPDF.setFont("times", "bolditalic");
      docPDF.setTextColor(255, 255, 255);
      
      if (logoLogistica) {
        const ratio = logoLogistica.h / logoLogistica.w;
        let imgW = 35;
        let imgH = imgW * ratio;
        if (imgH > 24) { imgH = 24; imgW = imgH / ratio; }
        
        docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH);
        docPDF.text("Logística TS SpA", 27, 34, null, null, "center");
      }
      
      if (logoApp) {
        const ratio = logoApp.h / logoApp.w;
        let imgW = 20; 
        let imgH = imgW * ratio;
        if (imgH > 24) { imgH = 24; imgW = imgH / ratio; }

        docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH);
        docPDF.text("LogisticAPP", 183, 34, null, null, "center");
      }

      docPDF.setFont("helvetica", "normal");
    };

    let pdfTitle = "CHECKLIST DE TRASLADO";
    if (job.tripType === 'revision') pdfTitle = "CERTIFICADO DE REVISION TECNICA";
    if (job.tripType === 'viaje') pdfTitle = "TRASLADO A REGIONES";

    drawHeader(pdfTitle);

    let currentY = 50;

    if (job.tripType === 'revision' && job.checklist?.rtStatus) {
        const isApproved = job.checklist.rtStatus === 'aprobado';
        const statusText = isApproved ? "APROBADO" : "RECHAZADO";
        
        docPDF.setFillColor(isApproved ? 220 : 254, isApproved ? 252 : 226, isApproved ? 231 : 226);
        docPDF.rect(0, 40, 210, 12, 'F');
        
        docPDF.setFontSize(16);
        docPDF.setFont("helvetica", "bold");
        docPDF.setTextColor(isApproved ? 22 : 220, isApproved ? 163 : 38, isApproved ? 74 : 38); 
        docPDF.text(statusText, 195, 48, null, null, "right");
        
        currentY = 60; 
    }

    const startY = currentY;
    const leftColWidth = 90;

    const drawSectionTitle = (title, y) => {
      docPDF.setFillColor(...lightBg);
      docPDF.rect(15, y - 6, leftColWidth, 10, 'F');
      docPDF.setDrawColor(...accentColor);
      docPDF.setLineWidth(1);
      docPDF.line(15, y - 6, 15, y + 4);
      docPDF.setTextColor(...primaryColor);
      docPDF.setFontSize(10);
      docPDF.setFont("helvetica", "bold");
      docPDF.text(cleanStr(title).toUpperCase(), 20, y+1);
      return y + 10;
    };

    const drawKV = (label, value, x, y, maxW = 40) => {
      docPDF.setFontSize(8);
      docPDF.setFont("helvetica", "normal");
      docPDF.setTextColor(...secondaryColor);
      docPDF.text(cleanStr(label).toUpperCase(), x, y);
      docPDF.setFontSize(9);
      docPDF.setFont("helvetica", "bold");
      docPDF.setTextColor(...primaryColor);
      const splitValue = docPDF.splitTextToSize(cleanStr(value), maxW);
      docPDF.text(splitValue, x, y + 4);
      return splitValue.length * 4;
    };

    let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "No registrado";
    if (job.acceptedByEmail) { const foundDriver = drivers?.find(d => d.email === job.acceptedByEmail); if (foundDriver) driverNameStr = foundDriver.name; }

// === COLUMNA IZQUIERDA ===
    currentY = drawSectionTitle("1. Detalles del Vehiculo", currentY);
    let hC = drawKV("Cliente", `${job.client || 'Sin Cliente'}`, 15, currentY, 45);
    let hM = drawKV("Marca y Modelo", `${job.brand || '-'} ${job.model || '-'}`, 65, currentY, 45);
    currentY += Math.max(hC, hM) + 6;

    let hP = drawKV("Patente / VIN", `${job.plate || job.vin || '-'}`, 15, currentY, 45);
    let hD = drawKV("Conductor", driverNameStr, 65, currentY, 45);
    currentY += Math.max(hP, hD) + 6;
    
    let routeText = `${job.origin || '-'}  ->  ${job.destination || '-'}`;
    if (job.tripType === 'revision') {
      if (job.checklist?.rtStatus === 'aprobado') {
         const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin;
         routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`;
      } else if (job.checklist?.rtStatus === 'rechazado') {
         routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`;
      } else {
         routeText = `${job.origin || '-'}  ->  PRT`;
      }
    }
    let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
    currentY += routeH + 8;

    currentY = drawSectionTitle("2. Recepcion y Estado", currentY);
    
    const getDocStatus = (docKey) => {
        const isOk = job.checklist?.docs?.[docKey];
        const expDate = job.checklist?.docsExpiry?.[docKey];
        if (!isOk) return 'FALTA';
        if (expDate) {
            const [y, m, d] = expDate.split('-');
            return `AL DIA (Vence: ${d}/${m}/${y})`;
        }
        return 'AL DIA';
    };

    let hFuel = drawKV("Combustible", `${job.checklist?.fuelLevel || '0'}%`, 15, currentY, 45);
    let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
    currentY += Math.max(hFuel, hSoap) + 6;

    let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
    let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
    currentY += Math.max(hPerm, hRev) + 6;

    let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
    currentY += hGas + 8;

    docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
    docPDF.text("OBSERVACIONES:", 15, currentY);
    docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor);
    const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth);
    docPDF.text(obsSplit, 15, currentY + 4);
    currentY += (obsSplit.length * 4) + 8;

    if (job.checklist?.hasWaitTime) {
      docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);
      const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);
      docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;
    }
    
    if (job.checklist?.hasFuelCharge) {
      docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235);
      const fcStr = docPDF.splitTextToSize(`CARGA DE COMBUSTIBLE: ${cleanStr(job.checklist.fuelChargeAmount || 'Sí')}`, leftColWidth);
      docPDF.text(fcStr, 15, currentY); currentY += (fcStr.length * 4) + 2;
    }
    currentY += 8;

    let sectionNum = 3;

    if (job.tripType === 'revision') {
       currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY);
       if (job.checklist?.rtStatus === 'aprobado') {
         docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); 
         docPDF.text("APROBADO", 15, currentY + 6);
         currentY += 18; 
       } else {
         docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); 
         docPDF.text("RECHAZADO", 15, currentY + 6);
         docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27);
         const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth);
         docPDF.text(rejSplit, 15, currentY + 12);
         currentY += 20 + (rejSplit.length * 4); 
       }
       sectionNum++;
    }

    currentY = drawSectionTitle(`${sectionNum}. Conformidad Entrega`, currentY);
    if (job.checklist?.noReception) {
      docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(9);
      const nrSplit = docPDF.splitTextToSize("ENTREGA SIN RECEPCION (Confirmada por conductor en terreno)", leftColWidth);
      docPDF.text(nrSplit, 15, currentY + 4);
      currentY += (nrSplit.length * 4) + 6;
    } else {
      drawKV("Receptor", `${job.checklist?.receiverName || 'N/A'}`, 15, currentY, leftColWidth);
      currentY += 12;
      drawKV("RUT", `${job.checklist?.receiverRut || 'N/A'}`, 15, currentY, leftColWidth);
      currentY += 12;
      
      if (job.checklist?.clientComments) {
          docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
          docPDF.text("COMENTARIOS:", 15, currentY);
          docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor);
          const commSplit = docPDF.splitTextToSize(cleanStr(job.checklist.clientComments), leftColWidth);
          docPDF.text(commSplit, 15, currentY + 4);
          currentY += (commSplit.length * 4) + 6;
      }

      if(job.checklist?.signatureData) {
          docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
          docPDF.text("FIRMA DE CONFORMIDAD:", 15, currentY);
          docPDF.addImage(job.checklist.signatureData, 'PNG', 15, currentY + 2, 45, 25);
          currentY += 30;
      }
    }
    
    if (job.checklist?.location) {
      currentY += 2;
      const { lat, lng } = job.checklist.location;
      docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
      docPDF.text(`UBICACION GPS:`, 15, currentY);
      docPDF.setFontSize(9); docPDF.setTextColor(...accentColor);
      docPDF.textWithLink('Clic aqui para ver mapa en Google', 15, currentY + 4, { url: `https://maps.google.com/?q=${lat},${lng}` });
    }

    const frontPhotoStr = job.checklist?.photos?.front;
    if (frontPhotoStr && typeof frontPhotoStr === 'string' && frontPhotoStr.startsWith('data:image')) {
      try {
        const dims = await getImageDims(frontPhotoStr);
        const ratio = dims.h / dims.w;
        let imgW = 80; 
        let imgH = imgW * ratio;
        if (imgH > 130) { imgH = 130; imgW = imgH / ratio; }

        const rightX = 115;
        const rightY = startY + 6;

        docPDF.setDrawColor(...borderColor);
        docPDF.setLineWidth(0.5);
        docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S');

        docPDF.setFillColor(...lightBg);
        docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F');
        docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor);
        docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" });

        docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH);
      } catch (err) { console.error("Error al incrustar foto frontal:", err); }
    }

    const addFooter = () => {
       const pageCount = docPDF.internal.getNumberOfPages();
       for(let i = 1; i <= pageCount; i++) {
           docPDF.setPage(i);
           docPDF.setFontSize(8);
           docPDF.setTextColor(148, 163, 184);
           docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center");
       }
    }

    if (job.checklist?.photos) {
      const photos = job.checklist.photos;
      const labels = { front: 'Frente', left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4' };
      let photoY = 46; let currentCol = 1; let addedPage = false;

      for (const key in photos) {
        if (key === 'front') continue; 

        if (photos[key] && typeof photos[key] === 'string' && photos[key].startsWith('data:image')) {
          if (!addedPage) {
            docPDF.addPage();
            drawHeader("ANEXO FOTOGRAFICO");
            addedPage = true;
          }
          
          try {
            const dims = await getImageDims(photos[key]);
            const ratio = dims.h / dims.w;
            let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; }
            const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2);

            if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); }

            docPDF.setDrawColor(...borderColor);
            docPDF.setLineWidth(0.5);
            docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S');
            
            docPDF.setFillColor(...lightBg);
            docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F');
            docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor);
            docPDF.text((labels[key] || key).toUpperCase(), slotCenter, photoY - 3, { align: "center" });

            docPDF.addImage(photos[key], 'JPEG', finalX, photoY + 2, imgW, imgH);

            if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; }
          } catch (err) { console.error("Error al incrustar la foto:", key, err); }
        }
      }
    }

    addFooter();
    return docPDF;
  };

  const getDStr = j => j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0]);
  
  const getExtraWappTxt = (j) => {
    let t = '';
    if (j.checklist?.hasWaitTime) t += `\nTIEMPO DE ESPERA: ${j.checklist.waitTime || 'Sí'}`;
    if (j.checklist?.hasFuelCharge) t += `\nCARGA DE COMBUSTIBLE: ${j.checklist.fuelChargeAmount || 'Sí'}`;
    return t;
  };

  const handleCopyWhatsApp = (job) => { 
    const dateStr = getDStr(job);
    const dateShort = dateStr.substring(0, 5); 
    const text = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}${getExtraWappTxt(job)}`; 
    navigator.clipboard.writeText(text).then(() => { 
      showAlert("✅ Formato copiado al portapapeles. Listo para pegar en WhatsApp."); 
      setMenuOpenId(null); 
    }).catch(() => showAlert("Tu navegador bloqueó el copiado automático.")); 
  };
  const cpyWapp = handleCopyWhatsApp; 

  const generatePDF = async (job) => {
    try { 
      const docPDF = await buildPDFDoc(job); 
      const cleanPlate = job.plate || job.vin || 'SN';
      const fileName = `Check.${getDStr(job).replace(/\//g, '-')}.${(job.client || 'SinCliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; 
      docPDF.save(fileName); 
    } catch(e) { console.error(e); showAlert("Hubo un error al generar PDF."); }
  };

  const handleShareWhatsAppPDF = async (job) => {
    try {
      const dateStrForFile = getDStr(job).replace(/\//g, '-');
      const dateShort = getDStr(job).substring(0, 5);
      const cleanPlate = job.plate || job.vin || 'SN';
      const fileName = `Check.${dateStrForFile}.${(job.client || 'SinCliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`;
      
      const text = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}${getExtraWappTxt(job)}`;
      
      const docPDF = await buildPDFDoc(job); 
      const pdfBlob = docPDF.output('blob'); 
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) { 
        await navigator.share({ title: fileName, text: text, files: [file] }); 
      } else { 
        showAlert("Tu dispositivo no soporta compartir el archivo directamente. Descárgalo primero."); 
        handleCopyWhatsApp(job); 
      }
    } catch (e) { console.error(e); }  
  };
  
  return (
    <div className="pb-16">
      {/* BARRA DE BÚSQUEDA GENERAL */}
      <div className="relative mb-6">
         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
           <Search className="w-5 h-5 text-slate-400" />
         </div>
         <input type="text" placeholder="Buscar por patente, marca, modelo o cliente..." className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {activeJobs.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {activeJobs.map(j => (
            <div key={j.id} className="bg-white rounded-3xl border p-5 flex flex-col shadow-sm relative">
              <div className="flex justify-between items-center mb-3 border-b pb-3">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${j.status==='pending'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{j.status==='pending'?'Pendiente':'En Curso'}</span>
                <div className="flex gap-1.5 items-center relative">
                  {isAdminView && <button onClick={()=>onEditJob(j)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>}
                  <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"><MoreVertical className="w-4 h-4"/></button>
                  {menuOpenId===j.id && (
                    <div className="absolute right-0 top-8 bg-white border shadow-2xl rounded-xl w-48 z-50 overflow-hidden text-xs">
                      {/* NUEVO BOTÓN: COPIAR LINK DE PORTAL DE CLIENTE */}
                      <button onClick={() => {
                        const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                        navigator.clipboard.writeText(`📍 Sigue en tiempo real todos los traslados de ${j.client || 'tu empresa'} aquí:\n${url}`);
                        showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!");
                        setMenuOpenId(null);
                      }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-blue-50 text-blue-600"><Navigation className="w-4 h-4"/> Portal Cliente</button>
                      
                      <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-slate-50 border-t"><Copy className="w-4 h-4"/> Copiar Resumen</button>
                      <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t"><XCircle className="w-4 h-4"/> Cancelar / Falló</button>
                    </div>
                  )}
                </div>
              </div>
              <h3 className="font-extrabold text-lg text-slate-800 leading-tight">{j.brand} {j.model}</h3>
              <p className="text-xs font-bold text-slate-400 mb-3">{j.client}</p>
              
              {j.tripType === 'revision' && (
                <div className="mb-3 bg-amber-50 border border-amber-200 p-2 rounded-xl text-center">
                  <span className="text-[10px] font-black text-amber-700 uppercase">REVISIÓN TÉCNICA (TIPO {j.rtData?.type})</span>
                </div>
              )}
              {j.tripType === 'viaje' && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-2 mb-3 text-center text-xs font-bold text-indigo-700 uppercase">A Regiones</div>}
              
              <div className="space-y-1 text-xs font-bold text-slate-600 mb-4">
                <p className="flex items-start gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/> <span className="flex-1">{j.origin}</span></p>
                <p className="flex items-start gap-1"><Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/> 
                  <span className="flex-1">
                    {j.tripType === 'revision' ? (
                        j.checklist?.rtStatus === 'aprobado' ? `PRT ➔ ${j.checklist.rtReturnOption === 'other' ? j.checklist.rtReturnDestination : j.origin}` :
                        j.checklist?.rtStatus === 'rechazado' ? 'PRT (Rechazada)' : 'Planta de Revisión (PRT)'
                    ) : j.destination}
                  </span>
                </p>
                <p className="text-slate-400 mt-2">Patente/VIN: <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded ml-1 uppercase">{j.plate || j.vin || 'N/A'}</span></p>
              </div>
              <div className="mt-auto pt-4 border-t flex flex-col gap-2">
                {j.status === 'pending' && (!isAdminView || j.assignedEmails?.includes(currentUserEmail)) && (
                  <button onClick={()=>handleAcceptJob(j)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors">Reclamar Traslado</button>
                )}

                {j.status === 'accepted' && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                  <>
                    {(!j.phase || j.phase === 'claimed') && (
                      <button onClick={()=>updatePhase(j, 'picked_up')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors">🚘 Vehículo en mi poder</button>
                    )}

                    {j.phase === 'picked_up' && j.tripType !== 'revision' && (
                      <button onClick={()=>updatePhase(j, 'arrived_destination')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors">📍 Llegué a Destino</button>
                    )}

                    {j.phase === 'picked_up' && j.tripType === 'revision' && (
                      <button onClick={()=>updatePhase(j, 'arrived_prt')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors">📍 Llegué a la PRT</button>
                    )}

                    {j.phase === 'arrived_prt' && (
                      <div className="flex gap-2">
                         <button onClick={()=>updatePhase(j, 'prt_done', { prt_result: 'aprobado' })} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors">✅ Aprobado</button>
                         <button onClick={()=>setPrtPromptJob(j)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors">❌ Rechazado</button>
                      </div>
                    )}

                    {/* NUEVO: El botón de Checklist siempre está visible para pre-llenar, cambiando de color y texto al final del viaje */}
                    <button onClick={()=>onStartChecklist(j)} className={`font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors ${(j.phase === 'arrived_destination' || j.phase === 'prt_done') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200'}`}>
                      📸 {(j.phase === 'arrived_destination' || j.phase === 'prt_done') ? 'Entregar / Cerrar Checklist' : 'Avanzar / Pre-llenar Checklist'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {historyJobs.length > 0 && (
        <div className="mt-8">
          <h3 className="font-extrabold text-lg text-slate-700 mb-4 border-b-2 border-slate-100 pb-2">Historial Simplificado</h3>
          {/* AQUÍ ESTÁ LA MAGIA: Grilla de múltiples columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {historyJobs.map(j => {
              const drv = drivers?.find(d => d.email === j.acceptedByEmail);
              const driverName = drv ? drv.name : (j.checklist?.assignedDriverName || j.acceptedByEmail || 'No registrado');
              const isFailed = j.status === 'failed';
              
              return (
              <div key={j.id} className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative pl-4 overflow-hidden hover:shadow-md transition-shadow">
                <div className={`absolute top-0 left-0 bottom-0 w-2 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
                
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-sm font-black text-slate-800 leading-tight truncate pr-2">{j.brand} {j.model}</p>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-widest shrink-0">{j.plate || 'S/N'}</span>
                </div>
                
                <p className="text-slate-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-1 truncate opacity-90"><MapPin className="w-3.5 h-3.5 shrink-0"/> {j.origin} ➔ {j.tripType === 'revision' ? 'PRT' : j.destination}</p>
                
                <div className="mb-3 flex justify-between items-center">
                   <div>
                     <p className="text-blue-600 font-extrabold text-[10px] uppercase tracking-wide truncate">Conductor: <span className="text-slate-700">{driverName}</span></p>
                     {isFailed && <p className="text-red-600 text-[10px] mt-0.5 font-bold line-clamp-1">Razón: {j.failedReason}</p>}
                   </div>
                   <p className="text-slate-400 font-bold text-[9px] text-right shrink-0 ml-2">{getDStr(j)}</p>
                </div>
                
                <div className="flex gap-1.5 mt-auto pt-2 border-t border-slate-50">
                  <button onClick={()=>cpyWapp(j)} className="flex-1 py-1.5 flex justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Copiar Texto"><Copy className="w-4 h-4"/></button>
                  <button onClick={() => generatePDF(j)} className="flex-1 py-1.5 flex justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors" title="Descargar PDF"><FileDown className="w-4 h-4"/></button>
                  <button onClick={() => handleShareWhatsAppPDF(j)} className="flex-1 py-1.5 flex justify-center bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors" title="Compartir PDF"><Share2 className="w-4 h-4"/></button>
                  {isAdminView && <button onClick={()=>handleDeleteJob(j.id)} className="flex-1 py-1.5 flex justify-center bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar Historial"><Trash2 className="w-4 h-4"/></button>}
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {jobToFail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleFailJob(jobToFail, e.target.reason.value); }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5"><XCircle className="text-red-500"/> ¿Por qué falló el traslado?</h3>
            <textarea name="reason" required placeholder="Escribe el motivo del fallo o cancelación aquí..." className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none focus:border-red-500" rows="3"></textarea>
            <div className="flex gap-3"><button type="button" onClick={()=>setJobToFail(null)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold text-sm text-slate-600">Volver</button><button type="submit" className="flex-[2] py-2 bg-red-600 text-white rounded-xl font-bold text-sm shadow-md">Confirmar Fallo</button></div>
          </form>
        </div>
      )}

      {/* NUEVO: MODAL DE RECHAZO PRT RÁPIDO */}
      {prtPromptJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => { e.preventDefault(); updatePhase(prtPromptJob, 'prt_done', { prt_result: 'rechazado', prt_reason: e.target.reason.value }); setPrtPromptJob(null); }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl border-t-8 border-red-500">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5"><XCircle className="text-red-500"/> Motivo del Rechazo PRT</h3>
            <textarea name="reason" required placeholder="Escribe por qué rechazaron el vehículo en la planta..." className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none focus:border-red-500" rows="3"></textarea>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setPrtPromptJob(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-sm text-slate-600 transition-colors">Cancelar</button>
              <button type="submit" className="flex-[2] py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors">Guardar Rechazo</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm, allClientsList, drivers, expenses }) {
  const isQuick = job.id === 'NEW_QUICK_JOB'; 
  const localStorageKey = `checklist_draft_${job.id}`;

  const defaultData = {
    client: job.client||'', manualClient: '', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false, tire:false, dashboard:false, det1:false, det2:false, det3:false, det4:false }, docs: { soap:false, permiso:false, revTecnica:false, gases:false }, observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null,
    rtStatus: job.prt_result || 'aprobado', rtRejectReason: job.prt_reason || '', rtReturnOption: 'origin', rtReturnDestination: '' 
  };
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(defaultData);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false); // <-- NUEVO ESTADO PARA QR (Idea 8)

  // NUEVO: Escucha en tiempo real si el cliente firma desde su celular
  useEffect(() => {
    if (isQuick || !job.id) return;
    const unsub = onSnapshot(doc(db, 'transport_jobs', job.id), (docSnap) => {
      const data = docSnap.data();
      if (data?.checklist?.clientSigned) {
        setFormData(prev => ({
          ...prev,
          signatureData: data.checklist.signatureData,
          receiverName: data.checklist.receiverName,
          receiverRut: data.checklist.receiverRut,
          clientComments: data.checklist.clientComments || ''
        }));
      }
    });
    return () => unsub();
  }, [job.id, isQuick, db]);

  // NUEVO: Función para generar y mandar el link de firma (Optimizado para Apple/Android)
  const handleRemoteSignRequest = async () => {
    if (isQuick) return showAlert("⚠️ Para usar la Firma Remota en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    
    const url = `${window.location.href.split('?')[0]}?sign=${job.id}`;
    const textToShare = `¡Hola! Por favor firma el acta de recepción y revisa las fotografías del vehículo aquí:\n${url}`;

    // 1. Intentar menú de compartir nativo (Abre WhatsApp directo en iOS/Android)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Firma de Recepción', text: textToShare });
        // Si comparte con éxito, guardamos en Firebase en segundo plano sin bloquear UI
        setDoc(doc(db, 'transport_jobs', job.id), { checklist: formData }, { merge: true });
        return;
      } catch (err) { console.log("Menú de compartir cancelado o no soportado"); }
    }

    // 2. Fallback de Portapapeles (Ejecutado ANTES del await de Firebase para engañar a Safari)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToShare);
      } else {
        // 3. Fallback fuerza bruta para iPhones viejos
        const textArea = document.createElement("textarea");
        textArea.value = textToShare;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      showAlert("✅ Link copiado al portapapeles. ¡Pégalo en WhatsApp!");
    } catch (e) {
      showAlert("Tu navegador bloquea el portapapeles automáticamente.");
    }

    // 4. Finalmente guardamos los datos en la base de datos
    try {
      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: formData }, { merge: true });
    } catch (e) { console.error("Error guardando progreso", e); }
  };

  // NUEVO: Función para guardar datos antes de mostrar el QR
  const handleOpenQR = async () => {
    if (isQuick) return showAlert("⚠️ Para usar el Código QR en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    if (!navigator.onLine) return showAlert("⚠️ Tu celular no tiene señal en este momento. El cliente no podrá descargar las fotos con el QR. Usa 'Compartir Link' y envíalo cuando recuperes la conexión.");
    
    try {
      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: formData }, { merge: true });
      setQrOpen(true);
    } catch (e) {
      console.error(e);
      showAlert("Error al generar el QR. Revisa tu conexión.");
    }
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem(localStorageKey);
    if (savedDraft) {
      try {
        const parsedData = JSON.parse(savedDraft);
        setFormData(parsedData.formData);
        setStep(parsedData.step || 1);
        setIsDraftLoaded(true);
      } catch (e) { console.error("Error al leer borrador", e); }
    }
  }, [localStorageKey]);

  useEffect(() => {
    localStorage.setItem(localStorageKey, JSON.stringify({ step, formData }));
  }, [step, formData, localStorageKey]);

  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  const clearDraft = () => {
    showConfirm("¿Eliminar borrador y empezar de nuevo?", () => {
      localStorage.removeItem(localStorageKey);
      setFormData(defaultData);
      setStep(1);
      setIsDraftLoaded(false);
    });
  };

  const handlePic = async (e, id) => {
    const f=e.target.files[0]; if(!f)return;
    try {
      const dataUrl = await resizeImage(f, 500, 0.4); 
      setF('photos', {...formData.photos, [id]: dataUrl}); 
    } catch(err){ 
      console.error("Error al procesar la foto:", err);
      showAlert("Error al procesar la foto. Intenta con una imagen más pequeña."); 
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    
    let d = {...formData}; 
    d.client = d.client === 'OTRO' ? d.manualClient : d.client; 

    if(d.noReception) { 
      d.receiverName="ENTREGA SIN RECEPCIÓN"; 
      d.receiverRut="N/A"; 
    }
    
    const fd = { scheduledDate: new Date().toISOString().split('T')[0], client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType || 'traslado' };
    
    try {
      // --- PARTE 2: AUTOMATIZAR MÚLTIPLES GASTOS (COMBUSTIBLE + PRT) ---
      let totalToDeduct = 0;
      const expensesToRegister = [];

      // Función interna para limpiar números y añadir a la lista
      const processExpense = (amountStr, detailStr) => {
        const num = Number(String(amountStr).replace(/[^0-9]/g, ''));
        if (num > 0) {
          totalToDeduct += num;
          expensesToRegister.push({ amount: num, detail: detailStr });
        }
      };

      // 1. Leer Gasto de Combustible
      if (d.hasFuelCharge && d.fuelChargeAmount) {
        processExpense(d.fuelChargeAmount, `Carga Combustible (Patente: ${d.plateOrVin || 'S/N'})`);
      }
      
      // 2. Leer Gastos PRT (Solo si es Revisión Técnica)
      if (job.tripType === 'revision') {
        if (job.rtData?.revision && d.prtCostRevision) processExpense(d.prtCostRevision, `Valor Revisión Técnica (Patente: ${d.plateOrVin || 'S/N'})`);
        if (job.rtData?.inspeccion && d.prtCostInspeccion) processExpense(d.prtCostInspeccion, `Valor Inspección Visual (Patente: ${d.plateOrVin || 'S/N'})`);
        if (job.rtData?.frenos && d.prtCostFrenos) processExpense(d.prtCostFrenos, `Valor Cert. Frenos (Patente: ${d.plateOrVin || 'S/N'})`);
      }

      // Si hubo algún gasto, lo procesamos
      if (totalToDeduct > 0) {
        const currentDriver = drivers?.find(drv => drv.email === currentUserEmail);
        if (currentDriver) {
          const currentBalance = currentDriver.balance || 0;
          const newBalance = currentBalance - totalToDeduct;

          // A. Descontar del saldo del conductor TODO sumado
          await updateDoc(doc(db, 'drivers', currentDriver.id), { balance: newBalance });

          // B. Registrar CADA gasto individualmente en la pestaña Finanzas
          for (const exp of expensesToRegister) {
            await addDoc(collection(db, 'expenses'), {
              driverId: currentDriver.id,
              driverEmail: currentDriver.email,
              driverName: currentDriver.name,
              type: 'expense',
              amount: exp.amount,
              detail: exp.detail,
              jobId: job.id === 'NEW_QUICK_JOB' ? '' : job.id,
              deductedAmount: exp.amount,
              createdAt: Date.now()
            });
          }
        }
      }
      // ----------------------------------------------------

      if(isQuick) { 
          fd.assignedDriverName="Auto-creado"; fd.acceptedByEmail=currentUserEmail; 
          if (d.plateOrVin) {
              const vehRef = collection(db, 'vehicles');
              const q = query(vehRef, where('plate', '==', d.plateOrVin.toUpperCase()));
              const querySnapshot = await getDocs(q);
              if (querySnapshot.empty) {
                await addDoc(vehRef, { plate: d.plateOrVin.toUpperCase(), brand: d.brand, model: d.model, client: d.client, createdAt: Date.now() });
              }
          }
          await addDoc(collection(db,'transport_jobs'), fd); 
      }
      else { 
          if (job.tripType === 'revision' && d.rtStatus === 'rechazado') {
             fd.status = 'failed';
             fd.failedReason = d.rtRejectReason || 'Revisión Técnica Rechazada';
             
             const cloneJob = {
                scheduledDate: d.scheduledDate || null, client: d.client || '', brand: d.brand || '', model: d.model || '', vin: d.plateOrVin || '', plate: d.plateOrVin || '', origin: d.origin || '', destination: d.destination || '',
                tripType: job.tripType || 'traslado', rtData: job.rtData || null,
                assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [],
                status: 'pending', createdAt: Date.now(), checklist: null
             };
             await addDoc(collection(db, 'transport_jobs'), cloneJob);
          }
          await updateDoc(doc(db,'transport_jobs',job.id), fd); 
      }
      
      if (job.tripType === 'revision' && d.rtStatus === 'rechazado') {
          showAlert("Revisión guardada como RECHAZADA. Se ha creado un nuevo traslado pendiente.");
      } else {
          showAlert("✅ Checklist guardado correctamente."); 
      }
      onComplete();
    } catch(error) { 
      console.error("Firebase Error:", error);
      showAlert("Hubo un error al guardar. Verifica tu conexión a internet."); 
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border pb-10 relative">
      {isDraftLoaded && (
         <div className="absolute -top-12 left-0 right-0 flex justify-center items-center">
            <div className="bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-sm border border-amber-200">
               <Save className="w-3.5 h-3.5"/> Borrador recuperado
               <button onClick={clearDraft} className="ml-2 text-amber-600 underline">Limpiar</button>
            </div>
         </div>
      )}

      <div className="bg-blue-600 text-white p-5 flex justify-between items-center rounded-t-3xl"><h2 className="font-bold text-base"><FileText className="inline w-5 h-5 mr-1"/> Formulario Checklist</h2><button type="button" onClick={()=>showConfirm("¿Deseas salir? (Tu progreso quedará guardado localmente)", onCancel)} className="bg-blue-800 px-3 py-1 rounded-xl text-xs font-bold">Salir</button></div>
      <div className="flex bg-slate-100 h-1"><div className={`bg-green-500 transition-all duration-300 ${step===1?'w-1/2':'w-full'}`}></div></div>
      <div className="p-5">
        {step === 1 ? (
          <div className="space-y-4 text-sm">
            
            {isQuick ? (
              <div className="space-y-2">
                 <select value={formData.client} onChange={(e) => setF('client', e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 bg-white outline-none focus:border-blue-500">
                    <option value="">Selecciona el Cliente...</option>
                    {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="OTRO">Otro (Ingreso Manual)</option>
                 </select>
                 {formData.client === 'OTRO' && <input value={formData.manualClient} onChange={e=>setF('manualClient',e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 mt-2"/>}
              </div>
            ) : (
              <input value={formData.client} onChange={e=>setF('client',e.target.value)} placeholder="Cliente" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700" readOnly/>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
              <input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
            </div>
            <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente o VIN" className="w-full border-2 border-slate-300 bg-slate-100 p-3 rounded-xl font-black uppercase text-slate-800 shadow-inner mt-2"/>
            
            {job.tripType === 'revision' && (
              <>
                <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-blue-600">Resultado de la Revisión</h3>
                <select value={formData.rtStatus} onChange={e=>setF('rtStatus', e.target.value)} className={`w-full border-2 p-4 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <option value="aprobado">✅ APROBADO</option>
                  <option value="rechazado">❌ RECHAZADO</option>
                </select>
                {formData.rtStatus === 'rechazado' && (
                  <input value={formData.rtRejectReason} onChange={e=>setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required className="w-full border-2 border-red-300 p-4 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2" />
                )}
                {formData.rtStatus === 'aprobado' && (
                  <div className="mt-4 p-4 border-2 border-green-200 bg-green-50 rounded-xl space-y-3">
                    <p className="text-sm font-bold text-green-800">¿Hacia dónde se dirige el vehículo tras aprobar?</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700">
                        <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                        Volver al Origen
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700">
                        <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                        Otro Destino
                      </label>
                    </div>
                    {formData.rtReturnOption === 'other' && (
                      <input value={formData.rtReturnDestination} onChange={e=>setF('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required className="w-full border-2 border-green-300 p-3 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />
                    )}
                  </div>
                )}
              </>
            )}

            <div className="space-y-1 pt-2">
              <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-slate-800 mb-4">Combustible: <span className="text-blue-600">{formData.fuelLevel}%</span></h3>
              <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={(e) => setF('fuelLevel', e.target.value)} className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer" style={{background: `linear-gradient(to right, ${formData.fuelLevel < 30 ? '#ef4444' : formData.fuelLevel < 80 ? '#eab308' : '#22c55e'} ${formData.fuelLevel}%, #e2e8f0 ${formData.fuelLevel}%)`}} />
            </div>
            {/* --- BANNER DE FONDO ASIGNADO (Corregido) --- */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase">Fondo Asignado al Traslado</p>
                  <p className="text-[10px] font-bold text-slate-500">Patente: {job.plate || job.vin || 'N/A'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-blue-700">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(
                    expenses?.filter(g => g.jobId === job.id && g.type === 'assignment')
                            .reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0
                  )}
                </p>
              </div>
            </div>
            
            {/* --- NUEVO: GASTOS DE REVISIÓN TÉCNICA CONDICIONALES --- */}
            {job.tripType === 'revision' && (job.rtData?.revision || job.rtData?.inspeccion || job.rtData?.frenos) && (
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 mt-4 shadow-sm">
                <h3 className="text-sm font-extrabold text-indigo-800 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Valores pagados en PRT
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {job.rtData?.revision && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-indigo-600 uppercase">Revisión Técnica ($)</label>
                      <input type="text" placeholder="Ej: 20000" className="w-full border-2 border-indigo-100 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-400 bg-white" value={formData.prtCostRevision || ''} onChange={e => setF('prtCostRevision', e.target.value)} />
                    </div>
                  )}
                  {job.rtData?.inspeccion && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-indigo-600 uppercase">Inspección Visual ($)</label>
                      <input type="text" placeholder="Ej: 5000" className="w-full border-2 border-indigo-100 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-400 bg-white" value={formData.prtCostInspeccion || ''} onChange={e => setF('prtCostInspeccion', e.target.value)} />
                    </div>
                  )}
                  {job.rtData?.frenos && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-indigo-600 uppercase">Certificado Frenos ($)</label>
                      <input type="text" placeholder="Ej: 8000" className="w-full border-2 border-indigo-100 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-400 bg-white" value={formData.prtCostFrenos || ''} onChange={e => setF('prtCostFrenos', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* ----------------------------------------------------------------- */}

            <h3 className="text-sm font-extrabold border-b-2 border-slate-100 pb-2 mt-6 text-slate-800">Documentos a bordo</h3>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[{ id: 'soap', label: 'SOAP' }, { id: 'permiso', label: 'Permiso' }, { id: 'revTecnica', label: 'Rev. Técnica' }, { id: 'gases', label: 'Gases' }].map(doc => (
                <div key={doc.id} className="flex flex-col gap-1">
                  <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.docs[doc.id] ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <input type="checkbox" className="w-4 h-4 text-green-600 rounded cursor-pointer" checked={formData.docs[doc.id]} onChange={(e) => setF('docs', { ...formData.docs, [doc.id]: e.target.checked })} />
                    <span className="font-extrabold text-xs">{doc.label}</span>
                  </label>
                  
                  {/* Desplegable de fecha de vencimiento (Opcional) */}
                  {formData.docs[doc.id] && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Vencimiento (Opcional):</p>
                      <input 
                        type="date" 
                        value={formData.docsExpiry?.[doc.id] || ''} 
                        onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })}
                        className="w-full border-2 border-green-200 bg-white p-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-green-500 transition-colors shadow-sm" 
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <h3 className="text-sm font-extrabold border-b-2 border-slate-100 pb-2 mt-6 text-slate-800">Observaciones</h3>
            <textarea className="w-full border-2 border-slate-200 p-3 rounded-xl mt-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[80px]" placeholder="Escribe aquí si hay algún daño, rayón o comentario relevante..." value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />
            
            {/* SECCIÓN NUEVA: ADICIONALES (Espera y Combustible) */}
            <div className="flex flex-col gap-3 mt-4 p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
              {/* Tiempo de Espera */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-slate-300" checked={formData.hasWaitTime || false} onChange={(e) => setF('hasWaitTime', e.target.checked)} />
                  <span className="font-extrabold text-sm text-slate-700">Tiempo de espera</span>
                </label>
                {formData.hasWaitTime && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 pl-7">
                    <input type="text" placeholder="Ej: 45 min, 2 hrs..." className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors shadow-sm" value={formData.waitTime || ''} onChange={(e) => setF('waitTime', e.target.value)} />
                  </div>
                )}
              </div>

              <div className="w-full h-px bg-slate-200 my-1"></div>

              {/* Carga de Combustible */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-slate-300" checked={formData.hasFuelCharge || false} onChange={(e) => setF('hasFuelCharge', e.target.checked)} />
                  <span className="font-extrabold text-sm text-slate-700">Carga de combustible</span>
                </label>
                {formData.hasFuelCharge && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 pl-7">
                    <input type="text" placeholder="Monto cargado (Ej: $15.000)" className="w-full border-2 border-slate-200 bg-white p-2.5 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors shadow-sm" value={formData.fuelChargeAmount || ''} onChange={(e) => setF('fuelChargeAmount', e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-sm font-extrabold border-b-2 border-slate-100 pb-2 mt-6 text-slate-800">Registro Fotográfico</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
              {[{id:'front', l:'Frente'}, {id:'left', l:'Lat. Piloto'}, {id:'right', l:'Lat. Copiloto'}, {id:'back', l:'Atrás'}, {id:'tire', l:'Repuesto'}, {id:'dashboard', l:'Tablero'}, {id:'det1', l:'Detalle 1'}, {id:'det2', l:'Detalle 2'}, {id:'det3', l:'Detalle 3'}, {id:'det4', l:'Detalle 4'}].map(p => (
                <label key={p.id} className={`p-1 border-2 rounded-2xl text-center cursor-pointer relative overflow-hidden h-20 flex flex-col justify-center items-center ${formData.photos[p.id]?'bg-green-50 border-green-400':'border-dashed'}`}>
                  <input type="file" className="hidden" accept="image/*" onChange={e=>handlePic(e,p.id)}/>
                  {formData.photos[p.id] ? (
                     <div className="absolute inset-0 w-full h-full"><img src={formData.photos[p.id]} alt="foto" className="w-full h-full object-cover opacity-60"/><div className="absolute inset-0 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-600 bg-white rounded-full"/></div></div>
                  ) : (
                    <><Camera className="w-5 h-5 text-slate-400 mb-0.5"/> <span className="text-[10px] font-bold text-slate-500 uppercase">{p.l}</span></>
                  )}
                </label>
              ))}
            </div>
            
            <button type="button" onClick={()=>setStep(2)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-6 text-sm">Siguiente Paso</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
             <>
               <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-2xl border-slate-900 border-2 cursor-pointer mb-4 shadow-md transition-colors hover:bg-slate-700">
                  <input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-6 h-6 cursor-pointer accent-blue-500 rounded"/> 
                  <span className="font-extrabold text-sm text-white">Dejar sin firma (Local cerrado / PRT)</span>
               </label>
               
               {!formData.noReception && (
                 <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 mb-4">
                    <h3 className="font-extrabold text-blue-800 mb-2 flex items-center gap-2"><Zap className="w-5 h-5"/> Firma Remota o QR (Recomendado)</h3>
                    <p className="text-xs font-bold text-blue-600 mb-4">Envía el link al cliente o muéstrale el QR para que firme desde su propio celular.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button type="button" onClick={handleRemoteSignRequest} className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition-colors flex justify-center items-center gap-2">
                         <Share2 className="w-4 h-4"/> Compartir Link
                      </button>
                      <button type="button" onClick={handleOpenQR} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition-colors flex justify-center items-center gap-2">
                         <QrCode className="w-4 h-4"/> Mostrar QR
                      </button>
                    </div>
                 </div>
               )}

               {/* NUEVO: MODAL PARA CÓDIGO QR MEJORADO */}
               {qrOpen && (
                  <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 border border-slate-100">
                      <button type="button" onClick={() => setQrOpen(false)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-700"/></button>
                      <h3 className="text-xl font-black text-slate-800 mb-1">Escanea para Firmar</h3>
                      <p className="text-xs font-bold text-slate-500 mb-5">El cliente debe apuntar con su cámara a este código.</p>
                      
                      <div className="bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-inner inline-block">
                        {/* Usamos QuickChart que es más confiable y no guarda caché erróneo */}
                        <img src={`https://quickchart.io/qr?size=250&margin=1&text=${encodeURIComponent(`${window.location.href.split('?')[0]}?sign=${job.id}`)}`} alt="QR Signature" className="w-48 h-48 mx-auto" />
                      </div>
                      
                      {/* Mostramos el código por si el escáner falla */}
                      <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">O ingresa manualmente a:</p>
                        <p className="text-[11px] font-extrabold text-blue-600 break-all select-all">{`${window.location.href.split('?')[0]}?sign=${job.id}`}</p>
                      </div>
                    </div>
                  </div>
               )}

               {!formData.noReception && (
                 <>
                   <div className="flex items-center gap-2 mb-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-xs font-bold text-slate-400 uppercase">O llenar manualmente</span><div className="h-px bg-slate-200 flex-1"></div></div>
                   
                   <input required={!formData.noReception} value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre del receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   <input required={!formData.noReception} value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT Receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   
                   {/* NUEVO: Muestra los comentarios si el cliente dejó alguno por el link remoto */}
                   {formData.clientComments && (
                     <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-extrabold text-slate-500 uppercase">Comentarios del Cliente:</p>
                       <p className="text-sm font-bold text-slate-800 italic">"{formData.clientComments}"</p>
                     </div>
                   )}

                   <div className="relative mt-2">
                     {formData.signatureData && <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full font-black flex items-center gap-1 z-10"><CheckCircle className="w-3 h-3"/> FIRMA CAPTURADA</div>}
                     <SignaturePad initialData={formData.signatureData} onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/>
                   </div>
                 </>
               )}
             </>
            
            <button type="button" onClick={() => { if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => setF('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }), () => showAlert("Error GPS.")); } }} className={`px-4 py-4 rounded-2xl text-sm w-full font-extrabold shadow-sm mt-4 ${formData.location ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-slate-100 text-slate-700 border-2'}`}>
              {formData.location ? "📍 GPS Capturado Exitosamente" : "📍 Tocar para Capturar GPS Actual"}
            </button>

            <div className="flex gap-2 pt-4 border-t"><button type="button" onClick={()=>setStep(1)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm flex-1">Atrás</button><button type="submit" className="bg-green-600 text-white p-3 rounded-xl font-bold text-sm flex-[2]">Finalizar y Guardar</button></div>
          </form>
        )}
      </div>
    </div>
  );
}