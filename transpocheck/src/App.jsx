import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence, collection, addDoc, onSnapshot, updateDoc, setDoc, doc, deleteDoc, getDocs, query, where, orderBy, limit, deleteField } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage'; // <-- IMPORTADO CORRECTAMENTE
import { BrowserRouter as Router, useSearchParams, useNavigate } from 'react-router-dom';

// Eliminamos la importación global de jsPDF para que la app cargue más rápido (Lazy Loading)
import { 
  Car, MapPin, Camera, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, Edit2, Bell, Share2, X, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Save, Search,
  CloudOff, Wifi, QrCode, Sun, Moon, Settings, ChevronUp, ChevronDown, ChevronRight, Fuel, Megaphone, Star
} from 'lucide-react';
import SignaturePad from './components/ui/SignaturePad';
import CustomClientSelector from './components/ui/CustomClientSelector';
import LicensePlateBadge from './components/ui/LicensePlateBadge';
import VehicleShapeIcon from './components/ui/VehicleShapeIcon';
import SwipeButton from './components/ui/SwipeButton';
import WaitTimerBadge from './components/ui/WaitTimerBadge';
import { DEFAULT_CLIENTES, LICENCIAS, formatMoney, formatDateDisplay, resizeImage } from './utils/helpers';
import LeaderboardView from './components/views/LeaderboardView';
import RelayAcceptView from './components/views/RelayAcceptView';
import DriverOnboarding from './components/views/DriverOnboarding';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 1. PRIMERO SE INICIALIZA 'APP'
const app = initializeApp(firebaseConfig);

// 2. DESPUÉS SE USAN LOS SERVICIOS BASADOS EN 'APP'
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // <-- AHORA SÍ FUNCIONA PORQUE 'APP' YA EXISTE

// --- FUNCIÓN MAESTRA SUBIDORA DE IMÁGENES A STORAGE ---
const uploadImageToStorage = async (base64String, folderPath, fileName) => {
  if (!base64String || !base64String.startsWith('data:image')) return base64String;
  const storageRef = ref(storage, `${folderPath}/${fileName}`);
  await uploadString(storageRef, base64String, 'data_url');
  return await getDownloadURL(storageRef);
};

// Inicializamos FCM sólo si el navegador lo soporta (ej: para que no crashee en modo incógnito)
let messaging = null;
isSupported().then((supported) => {
  if (supported) messaging = getMessaging(app);
});

// NUEVO: Activamos la Persistencia Offline Multi-Pestaña.
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  console.warn("Modo offline limitado (Multi-tab):", err.code);
});

const googleProvider = new GoogleAuthProvider();


function NewJobForm({ jobToEdit, onCancelEdit, allClientsList, vehicles, drivers, db, showAlert, onSuccess }) {
  const [selectedClient, setSelectedClient] = useState(jobToEdit?.client && allClientsList.includes(jobToEdit.client) ? jobToEdit.client : (jobToEdit?.client ? 'OTRO' : ''));
  const [manualClient, setManualClient] = useState(jobToEdit?.client && !allClientsList.includes(jobToEdit.client) ? jobToEdit.client : '');
  const [brand, setBrand] = useState(jobToEdit?.brand || '');
  const [model, setModel] = useState(jobToEdit?.model || '');
  
  // Lógica inteligente para traslados antiguos: si la Patente y el VIN eran el mismo texto, los separa visualmente
  const initPlate = jobToEdit?.plate === jobToEdit?.vin && jobToEdit?.plate?.length !== 6 ? '' : (jobToEdit?.plate || '');
  const initVin = jobToEdit?.plate === jobToEdit?.vin && jobToEdit?.vin?.length === 6 ? '' : (jobToEdit?.vin || '');
  
  const [plate, setPlate] = useState(initPlate);
  const [vin, setVin] = useState(initVin);
  const [tripType, setTripType] = useState(jobToEdit?.tripType || 'traslado');
  const [vehicleType, setVehicleType] = useState(jobToEdit?.vehicleType || 'auto');
  
  const [revType, setRevType] = useState(jobToEdit?.rtData?.type || 'A');
  const [revA_gases, setRevA_gases] = useState(jobToEdit?.rtData?.gases || false);
  const [revA_revision, setRevA_revision] = useState(jobToEdit?.rtData?.revision || false);
  const [revA_inspeccion, setRevA_inspeccion] = useState(jobToEdit?.rtData?.inspeccion || false);
  const [revA_frenos, setRevA_frenos] = useState(jobToEdit?.rtData?.frenos || false);
  const [revB_tipo, setRevB_tipo] = useState(jobToEdit?.rtData?.tipoB || 'completa');
  const [selectedDriversUI, setSelectedDriversUI] = useState(() => jobToEdit?.assignedEmails ? drivers.filter(d => jobToEdit.assignedEmails.includes(d.email)).map(d => d.id) : []);
  
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (brand && model && vehicles.length > 0) {
      const match = vehicles.find(v => v.brand?.toLowerCase() === brand.toLowerCase() && v.model?.toLowerCase() === model.toLowerCase() && v.vehicleType);
      if (match) setVehicleType(match.vehicleType);
    }
  }, [brand, model, vehicles]);

  // CEREBRO GEMELO: Autocompleta ya sea buscando por Patente o por VIN
  const handleVehicleSearch = (searchValue, type) => {
    const val = searchValue.toUpperCase(); 
    if (type === 'plate') setPlate(val);
    if (type === 'vin') setVin(val);
    
    const v = vehicles.find(x => (val && x.plate === val) || (val && x.vin === val));
    if (v) {
      setBrand(v.brand || ''); setModel(v.model || '');
      if (v.plate && type === 'vin') setPlate(v.plate);
      if (v.vin && type === 'plate') setVin(v.vin);
      if (v.vehicleType) setVehicleType(v.vehicleType); 
      if (allClientsList.includes(v.client)) setSelectedClient(v.client); else { setSelectedClient('OTRO'); setManualClient(v.client); }
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateOrUpdateJob = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
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
      vin: vin.toUpperCase(), plate: plate.toUpperCase(), origin: formData.get('origin'), destination: formData.get('destination'),
      tripType, vehicleType, rtData: rtData || null, // Protección anti-crash
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
      
      if ((plate || vin) && !vehicles.find(v => (plate && v.plate === plate) || (vin && v.vin === vin))) await addDoc(collection(db, 'vehicles'), { plate: plate.toUpperCase(), vin: vin.toUpperCase(), vehicleType, brand, model, client: finalClient, createdAt: Date.now() });
      
      // --- NUEVO: LLAMADA A VERCEL PARA ENVIAR NOTIFICACIÓN PUSH REAL EN SEGUNDO PLANO ---
      const driverTokens = assignedDriversList.map(d => d.fcmToken).filter(token => token);
      if (driverTokens.length > 0) {
        try {
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokens: driverTokens,
              title: jobToEdit ? "🔄 Traslado Actualizado" : "📍 ¡Nuevo Traslado Asignado!",
              body: `Vehículo: ${brand} ${model} (${plate || 'S/N'})\nDesde: ${jobData.origin}`
            })
          });
        } catch (pushErr) { console.warn("Fallo el envío Push:", pushErr); }
      }
      // ----------------------------------------------------------------------------------

      onSuccess();
    } catch (error) { console.error(error); showAlert("Ocurrió un error guardando el trabajo."); }
    finally { setIsSubmitting(false); }
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
           <h3 className="text-base font-bold text-slate-700">2. Vehículo <span className="text-xs text-blue-500 font-bold">(Escribe para autocompletar)</span></h3>
           <div className="grid grid-cols-2 gap-4">
             <input value={plate} onChange={e=>handleVehicleSearch(e.target.value, 'plate')} type="text" placeholder="Patente (Ej. ABCD12)" className="w-full border-2 border-slate-300 p-3 text-sm rounded-xl uppercase outline-none focus:border-blue-500 font-black bg-white text-slate-800 shadow-sm" />
             <input value={vin} onChange={e=>handleVehicleSearch(e.target.value, 'vin')} type="text" placeholder="VIN / Chasis" className="w-full border-2 border-slate-300 p-3 text-sm rounded-xl uppercase outline-none focus:border-blue-500 font-black bg-white text-slate-800 shadow-sm" />
             <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-800" />
             <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-800" />
             <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl col-span-2 outline-none focus:border-blue-500 font-bold text-slate-700 bg-white">
               <option value="auto">🚙 Auto / SUV</option>
               <option value="camioneta">🛻 Camioneta</option>
               <option value="furgon_pequeno">🚐 Furgón Pequeño</option>
               <option value="furgon_grande">🚐 Furgón Grande</option>
               <option value="camion">🚚 Camión Simple</option>
               <option value="camion_doble">🚚 Camión Doble Cabina</option>
               <option value="camion_2ejes">🚛 Camión (2 Ejes traseros)</option>
               <option value="camion_3ejes">🚛 Camión (3 Ejes traseros)</option>
             </select>
           </div>
        </div>
        
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-slate-700">3. Programación y Ruta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
               <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Fecha de Traslado</label>
               <input name="scheduledDate" type="date" defaultValue={jobToEdit?.scheduledDate || todayStr} required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-700" />
            </div>
            <div className="space-y-1 relative z-50">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Cliente</label>
              <CustomClientSelector 
                value={selectedClient} 
                onChange={(val) => setSelectedClient(val)} 
                clients={allClientsList} 
                placeholder="Seleccione Cliente (Opcional)" 
              />
              {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white mt-2 animate-in fade-in slide-in-from-top-2" />}
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
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-extrabold text-sm sm:text-lg transition-colors shadow-lg shadow-blue-200 disabled:opacity-50">{isSubmitting ? 'Procesando...' : (jobToEdit ? 'Actualizar Trabajo' : 'Guardar y Asignar')}</button>
        </div>
      </form>
    </div>
  );

function ConfigView({ allClientsList, customClients, vehicles, drivers, db, showAlert, showConfirm }) {
  const [configSubTab, setConfigSubTab] = useState('clients');
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [fleetFilter, setFleetFilter] = useState('');
  
  // --- NUEVO: ESTADO CONSOLIDADO PARA DOCUMENTOS DEL PERFIL ---
  const [driverDocs, setDriverDocs] = useState({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null });
  const [fullScreenDoc, setFullScreenDoc] = useState(null); // Para ver el carnet/licencia en grande

  // Función unificada para cargar cualquier tipo de documento en el panel Admin
  const handleDocUpload = async (e, field, size) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, size, 0.4);
      setDriverDocs(prev => ({ ...prev, [field]: dataUrl }));
    } catch (err) { showAlert("Error procesando foto."); }
  };

  // Mini-Componente para los recuadros de documentos
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
                
                // Enrutador inteligente para las marcas de agua de los vehículos
                const logoUrl = clientUpper.includes('KOVACS') ? '/logos/kovacs.png' : 
                                clientUpper.includes('SALFA') ? '/logos/salfa.png' : 
                                clientUpper.includes('GRANDLEASING') ? '/logos/grandleasing.png' : 
                                clientUpper.includes('ENEX') ? '/logos/enex.png' : 
                                `/logos/${v.client?.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

                // Selección dinámica del Emoji según el tipo de vehículo
                let emoji = '🚙';
                if (v.vehicleType === 'camioneta') emoji = '🛻';
                else if (v.vehicleType?.includes('furgon')) emoji = '🚐';
                else if (v.vehicleType?.includes('2ejes') || v.vehicleType?.includes('3ejes') || v.vehicleType?.includes('8x4')) emoji = '🚛';
                else if (v.vehicleType?.includes('camion')) emoji = '🚚';
                else if (v.vehicleType === 'carro_arrastre') emoji = '🛒';

                return (
                <div key={v.id} className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl shadow-md bg-gradient-to-br ${grad} text-white group transition-all w-full`}>
                  
                  {/* MARCA DE AGUA 1: LOGO CLIENTE (Izquierda) */}
                  <div className="absolute -left-2 -bottom-2 w-32 h-32 opacity-30 pointer-events-none mix-blend-overlay rotate-[-15deg] grayscale">
                    <img src={logoUrl} alt="" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'}/>
                  </div>

                  {/* MARCA DE AGUA 2: EMOJI GIGANTE (Derecha) */}
                  <div className="absolute -right-2 -bottom-4 opacity-40 pointer-events-none text-[120px] leading-none select-none mix-blend-overlay grayscale">
                    {emoji}
                  </div>

                  {/* CONTENIDO PRINCIPAL BLINDADO CONTRA DESBORDAMIENTOS */}
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
            
            {/* PANEL DE DOCUMENTACIÓN INTEGRADO AL PERFIL */}
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

      {/* MODAL FLOTANTE PARA VER CARNET/LICENCIA EN GRANDE AL TOCAR EL "OJO" */}
      {fullScreenDoc && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-zoom-out animate-in fade-in" onClick={() => setFullScreenDoc(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors shadow-lg"><X className="w-6 h-6"/></button>
          <img src={fullScreenDoc} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}

function TrackingView({ clientName, db, onBack, onLogout, darkMode, setDarkMode }) {
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
      setDownloadingId(job.id); 
      const jsPDFModule = await import('jspdf');
      const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
      const docPDF = new JsPDFClass();

      const cleanStr = (str) => { if (!str) return ''; return String(str).replace(/➔/g, '->').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); };
      const fetchImageAsBase64 = async (url) => {
        if (!url) return null;
        if (url.startsWith('data:image')) return url;
        try {
          const res = await fetch(url, { mode: 'cors' });
          const blob = await res.blob();
          const fileBlob = new Blob([blob], { type: blob.type.includes('image') ? blob.type : 'image/jpeg' });
          return await new Promise(resolve => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(fileBlob); });
        } catch (e) { return null; }
      };
      const getImageDims = (src) => new Promise(resolve => { const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => resolve({ w: img.width, h: img.height }); img.onerror = () => resolve({ w: 85, h: 60 }); img.src = src; });
      const loadSimpleLogo = async (src) => { return new Promise((resolve) => { const img = new Image(); img.src = src; img.crossOrigin = "Anonymous"; img.onload = () => { const tempCanvas = document.createElement('canvas'); tempCanvas.width = img.width; tempCanvas.height = img.height; const ctx = tempCanvas.getContext('2d'); ctx.drawImage(img, 0, 0, img.width, img.height); resolve({ data: tempCanvas.toDataURL('image/png'), w: img.width, h: img.height }); }; img.onerror = () => resolve(null); setTimeout(() => resolve(null), 1500); }); };

      const photos = job.checklist?.photos || {};
      const otherPhotoKeys = Object.keys(photos).filter(k => k !== 'front' && typeof photos[k] === 'string' && photos[k]);

      // CARGA ULTRA RÁPIDA: Descargamos Logos, Fotos y FIRMA al mismo tiempo
      const [logoApp, logoLogistica, frontPhotoStr, signatureStr, ...preloadedOtherPhotos] = await Promise.all([
        loadSimpleLogo('/logo.png'),
        loadSimpleLogo('/LogoLogistica.png'),
        fetchImageAsBase64(photos.front),
        fetchImageAsBase64(job.checklist?.signatureData),
        ...otherPhotoKeys.map(async (key) => {
           const base64Img = await fetchImageAsBase64(photos[key]);
           if (!base64Img) return null;
           const dims = await getImageDims(base64Img);
           return { key, base64Img, dims };
        })
      ]);

      const primaryColor = [30, 41, 59]; const secondaryColor = [100, 116, 139]; const accentColor = [37, 99, 235]; const lightBg = [248, 250, 252]; const borderColor = [226, 232, 240];

      const drawHeader = (titleText) => {
        docPDF.setFillColor(...primaryColor); docPDF.rect(0, 0, 210, 40, 'F');
        docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(18); docPDF.setFont("helvetica", "bold");
        docPDF.text(cleanStr(titleText), 105, 18, null, null, "center");
        const dateTxt = typeof formatDateDisplay === 'function' && job.scheduledDate ? formatDateDisplay(job.scheduledDate) : (job.scheduledDate || '-');
        docPDF.setFontSize(9); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(148, 163, 184);
        docPDF.text(`FECHA TRASLADO: ${dateTxt}`, 105, 26, null, null, "center");
        docPDF.setFontSize(11); docPDF.setFont("times", "bolditalic"); docPDF.setTextColor(255, 255, 255);
        if (logoLogistica) { const ratio = logoLogistica.h / logoLogistica.w; let imgW = 35; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("Logística TS SpA", 27, 34, null, null, "center"); }
        if (logoApp) { const ratio = logoApp.h / logoApp.w; let imgW = 20; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("LogisticAPP", 183, 34, null, null, "center"); }
        docPDF.setFont("helvetica", "normal");
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
      const drawSectionTitle = (title, y) => { docPDF.setFillColor(...lightBg); docPDF.rect(15, y - 6, leftColWidth, 10, 'F'); docPDF.setDrawColor(...accentColor); docPDF.setLineWidth(1); docPDF.line(15, y - 6, 15, y + 4); docPDF.setTextColor(...primaryColor); docPDF.setFontSize(10); docPDF.setFont("helvetica", "bold"); docPDF.text(cleanStr(title).toUpperCase(), 20, y+1); return y + 10; };
      const drawKV = (label, value, x, y, maxW = 40) => { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(cleanStr(label).toUpperCase(), x, y); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const splitValue = docPDF.splitTextToSize(cleanStr(value), maxW); docPDF.text(splitValue, x, y + 4); return splitValue.length * 4; };

      let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "Conductor";
      if (job.assignedDrivers && job.assignedDrivers.length > 0) { const found = job.assignedDrivers.find(d => d.email === job.acceptedByEmail); if (found) driverNameStr = found.name; }

      currentY = drawSectionTitle("1. Detalles del Vehiculo", currentY);
      let hC = drawKV("Cliente", `${job.client || 'Sin Cliente'}`, 15, currentY, 45);
      let hM = drawKV("Marca y Modelo", `${job.brand || '-'} ${job.model || '-'}`, 65, currentY, 45);
      currentY += Math.max(hC, hM) + 6;

      let plateText = job.plate || '-'; if (job.vin && job.vin !== job.plate) { plateText += ` / VIN: ${job.vin}`; }
      let hP = drawKV("Patente / VIN", plateText, 15, currentY, 45);
      let hD = drawKV("Conductor", driverNameStr, 65, currentY, 45);
      currentY += Math.max(hP, hD) + 6;
      
      let routeText = `${job.origin || '-'}  ->  ${job.destination || '-'}`;
      if (job.tripType === 'revision') { if (job.checklist?.rtStatus === 'aprobado') { const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin; routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`; } else if (job.checklist?.rtStatus === 'rechazado') { routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`; } else { routeText = `${job.origin || '-'}  ->  PRT`; } }
      let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
      currentY += routeH + 8;

      currentY = drawSectionTitle("2. Recepcion y Estado", currentY);
      const getDocStatus = (docKey) => { const isOk = job.checklist?.docs?.[docKey]; const expDate = job.checklist?.docsExpiry?.[docKey]; if (!isOk) return 'FALTA'; if (expDate) { const [y, m, d] = expDate.split('-'); return `AL DIA (Vence: ${d}/${m}/${y})`; } return 'AL DIA'; };
      let hFuel = drawKV("Combustible", `${job.checklist?.fuelLevel || '0'}%`, 15, currentY, 45);
      let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
      currentY += Math.max(hFuel, hSoap) + 6;
      let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
      let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
      currentY += Math.max(hPerm, hRev) + 6;
      let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
      currentY += hGas + 8;

      docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("OBSERVACIONES:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth); docPDF.text(obsSplit, 15, currentY + 4); currentY += (obsSplit.length * 4) + 6;
      if (job.waitTimeMinutes && job.waitTimeMinutes > 20) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38); const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA EN ORIGEN: ${job.waitTimeMinutes} minutos`, leftColWidth); docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2; } else if (job.checklist?.hasWaitTime) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);  const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);  docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;  }
      if (job.checklist?.hasFuelCharge) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235); const fcStr = docPDF.splitTextToSize(`CARGA DE COMBUSTIBLE: ${cleanStr(job.checklist.fuelChargeAmount || 'Sí')}`, leftColWidth); docPDF.text(fcStr, 15, currentY); currentY += (fcStr.length * 4) + 2; }
      currentY += 8; 

      let sectionNum = 3;
      if (job.tripType === 'revision') { currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY); if (job.checklist?.rtStatus === 'aprobado') { docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); docPDF.text("APROBADO", 15, currentY + 6); currentY += 18; } else { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); docPDF.text("RECHAZADO", 15, currentY + 6); docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27); const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth); docPDF.text(rejSplit, 15, currentY + 12); currentY += 20 + (rejSplit.length * 4); } sectionNum++; }

      currentY = drawSectionTitle(`${sectionNum}. Conformidad Entrega`, currentY);
      if (job.checklist?.noReception) { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(9); const nrSplit = docPDF.splitTextToSize("ENTREGA SIN RECEPCION (Confirmada por conductor en terreno)", leftColWidth); docPDF.text(nrSplit, 15, currentY + 4); currentY += (nrSplit.length * 4) + 6; } else { drawKV("Receptor", `${job.checklist?.receiverName || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; drawKV("RUT", `${job.checklist?.receiverRut || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; if (job.checklist?.clientComments) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("COMENTARIOS:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const commSplit = docPDF.splitTextToSize(cleanStr(job.checklist.clientComments), leftColWidth); docPDF.text(commSplit, 15, currentY + 4); currentY += (commSplit.length * 4) + 6; } 
        if(signatureStr) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("FIRMA DE CONFORMIDAD:", 15, currentY); try { docPDF.addImage(signatureStr, 'JPEG', 15, currentY + 2, 45, 25); } catch(e){ try{docPDF.addImage(signatureStr, 'PNG', 15, currentY + 2, 45, 25);}catch(err){} } currentY += 30; } 
      }
      
      if (job.checklist?.location) { currentY += 2; const { lat, lng } = job.checklist.location; docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(`UBICACION GPS:`, 15, currentY); docPDF.setFontSize(9); docPDF.setTextColor(...accentColor); docPDF.textWithLink('Clic aqui para ver mapa en Google', 15, currentY + 4, { url: `https://maps.google.com/?q=${lat},${lng}` }); }

      if (frontPhotoStr) { 
        try { const dims = await getImageDims(frontPhotoStr); const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; } const rightX = 115; const rightY = startY + 6; docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" }); try { docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH); } catch(e){docPDF.addImage(frontPhotoStr, 'PNG', rightX, rightY + 2, imgW, imgH);} } catch (err) {} 
      }

      const addFooter = () => { const pageCount = docPDF.internal.getNumberOfPages(); for(let i = 1; i <= pageCount; i++) { docPDF.setPage(i); docPDF.setFontSize(8); docPDF.setTextColor(148, 163, 184); docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center"); } }

      if (preloadedOtherPhotos.length > 0) {
        const labels = { left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', interior_front: 'Int. Adelante', interior_back: 'Int. Atras', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4', det5: 'Detalle 5', det6: 'Detalle 6', det7: 'Detalle 7', det8: 'Detalle 8' };
        let photoY = 46; let currentCol = 1; let addedPage = false;
        for (const item of preloadedOtherPhotos) { 
          if (!item) continue;
          const { key, base64Img, dims } = item;
          if (!addedPage) { docPDF.addPage(); drawHeader("ANEXO FOTOGRAFICO"); addedPage = true; } 
          try { 
            const ratio = dims.h / dims.w; let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; } const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2); if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); } docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text((labels[key] || key).toUpperCase(), slotCenter, photoY - 3, { align: "center" }); 
            try { docPDF.addImage(base64Img, 'JPEG', finalX, photoY + 2, imgW, imgH); } catch(e) { docPDF.addImage(base64Img, 'PNG', finalX, photoY + 2, imgW, imgH); }
            if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; } 
          } catch (err) {} 
        }
      }

      addFooter();
      const cleanPlate = job.plate || job.vin || 'SN';
      const dateStrForFile = (job.scheduledDate || new Date().toISOString().split('T')[0]).replace(/\//g, '-');
      const fileName = `Certificado.${dateStrForFile}.${(job.client || 'Cliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; 
      docPDF.save(fileName); 
      setDownloadingId(null);
    } catch (error) {
      console.error("Error crítico generando PDF en Portal:", error);
      alert("Hubo un error al descargar el PDF. Verifica tu conexión a internet e intenta de nuevo.");
      setDownloadingId(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  
  // NUEVO: Estados para la Firma Masiva
  const [batchSignOpen, setBatchSignOpen] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ name: '', rut: '', comments: '', signature: null, selectedIds: [] });

  // REPARACIÓN ERROR 310: El Hook se mueve arriba del Return
  const branding = React.useMemo(() => {
    const name = (clientName || '').toUpperCase();
    if (name.includes('KOVACS')) return { primary: 'bg-red-600', text: 'text-red-600', fill: 'bg-red-500', light: 'bg-red-50' };
    if (name.includes('SALFA')) return { primary: 'bg-emerald-600', text: 'text-emerald-600', fill: 'bg-emerald-500', light: 'bg-emerald-50' };
    if (name.includes('GRANDLEASING')) return { primary: 'bg-slate-900', text: 'text-slate-800', fill: 'bg-slate-800', light: 'bg-slate-100' };
    if (name.includes('ENEX')) return { primary: 'bg-sky-600', text: 'text-sky-600', fill: 'bg-sky-500', light: 'bg-sky-50' };
    // Predeterminado
    return { primary: 'bg-blue-600', text: 'text-blue-600', fill: 'bg-blue-500', light: 'bg-blue-50' };
  }, [clientName]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 p-4 pt-24 space-y-6 max-w-5xl mx-auto">
      {/* Esqueleto de Encabezado */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 max-w-2xl mx-auto h-32 flex flex-col items-center justify-center animate-pulse shadow-sm">
         <div className="w-14 h-14 bg-slate-200 rounded-2xl mb-3"></div>
         <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
         <div className="h-6 bg-slate-200 rounded w-1/2"></div>
      </div>
      {/* Esqueletos de Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 h-48 animate-pulse shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start"><div className="h-5 bg-slate-200 rounded w-1/2"></div><div className="h-6 w-20 bg-slate-200 rounded-lg"></div></div>
            <div className="space-y-3"><div className="h-3 bg-slate-200 rounded w-3/4"></div><div className="h-3 bg-slate-200 rounded w-1/2"></div></div>
          </div>
        ))}
      </div>
    </div>
  );

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
  
  const initials = clientName ? clientName.substring(0, 2).toUpperCase() : 'CL';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10 transition-colors duration-300">
      {/* SE ANCLA CON LA CLASE fixed-nav-bar PARA EVITAR DESPLAZAMIENTOS */}
      <header className={`fixed-nav-bar ${branding.primary} text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20 transition-colors duration-300`}>
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
          {onLogout && (
            <button onClick={onLogout} className="bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-xl text-sm font-bold text-white transition-colors border border-slate-700 shadow-sm flex items-center gap-1.5 z-10 shrink-0 ml-2">
              <LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 space-y-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden max-w-2xl mx-auto">
          <div className={`absolute top-0 left-0 w-full h-1.5 ${branding.fill}`}></div>
          
          {/* Tarjeta de Contenedor de Logo Premium Ampliada (Fondo Blanco Forzado) */}
          <div className="mx-auto w-36 h-36 rounded-[28px] flex items-center justify-center mb-4 shadow-md border overflow-hidden transition-all duration-300 p-3" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
             <img
               src={
                 (clientName || '').toUpperCase().includes('KOVACS') ? '/logos/kovacs.png' :
                 (clientName || '').toUpperCase().includes('SALFA') ? '/logos/salfa.png' :
                 (clientName || '').toUpperCase().includes('GRANDLEASING') ? '/logos/grandleasing.png' :
                 (clientName || '').toUpperCase().includes('ENEX') ? '/logos/enex.png' :
                 `/logos/${clientName ? clientName.toLowerCase().replace(/[^a-z0-9]/g, '') : ''}.png`
               }
               alt={clientName}
               className="w-full h-full object-contain"
               onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
             />
             {/* Fallback Seguro: Iniciales de respaldo escaladas a tamaño gigante */}
             <div className={`w-full h-full flex items-center justify-center text-5xl font-black ${branding.text} ${branding.light} rounded-2xl`} style={{ display: 'none' }}>
               {initials}
             </div>
          </div>

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
                  <LicensePlateBadge text={job.plate || job.vin} />
                </div>
                
                <div className="relative pl-8 space-y-6 flex-1 mt-2">
                  {/* LÍNEAS DE TIEMPO ANIMADAS (Fondo gris y Relleno azul) */}
                  <div className="absolute top-2 bottom-4 left-[11px] w-0.5 bg-slate-100 rounded-full"></div>
                  <div className="absolute top-2 left-[11px] w-0.5 bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                       style={{ height: step4Done ? '100%' : step3Done ? '66%' : step2Done ? '33%' : isAccepted ? '10%' : '0%' }}></div>

                  {/* PASO 1: Nombre del Conductor */}
                  <div className="relative"><div className="absolute -left-8 bg-blue-500 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-transform duration-300 hover:scale-110"><CheckCircle className="w-3 h-3 text-white"/></div><p className="font-extrabold text-slate-800 text-sm">{isAccepted ? (job.assignedDrivers?.find(d => d.email === job.acceptedByEmail)?.name || "Conductor en camino") : "Buscando conductor..."}</p><p className="text-xs font-bold text-slate-500 mt-0.5">{isAccepted ? `Responsable del retiro en ${job.origin}` : `Esperando asignación para ${job.origin}`}</p></div>
                  
                  {/* PASO 2: Vehículo en poder (Con estado "Esperando retiro") */}
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step2Done ? 'bg-blue-500 scale-110' : (phase === 'arrived_pickup' ? 'bg-amber-400 scale-110' : 'bg-slate-200')}`}>{step2Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step2Done ? 'text-slate-800' : (phase === 'arrived_pickup' ? 'text-amber-600' : 'text-slate-400')}`}>{phase === 'arrived_pickup' ? 'Esperando entrega en origen...' : 'Vehículo en Tránsito'}</p><p className={`text-xs font-bold mt-0.5 transition-colors duration-500 ${step2Done ? 'text-blue-600' : (phase === 'arrived_pickup' ? 'text-amber-500' : 'text-slate-400')}`}>{step2Done ? 'El conductor tiene el vehículo en su poder' : (phase === 'arrived_pickup' ? 'El conductor ya está en el punto de retiro' : 'Esperando llegada del conductor')}</p></div>
                  
                  {/* PASO 3: Llegada */}
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step3Done ? 'bg-blue-500 scale-110' : 'bg-slate-200'}`}>{step3Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step3Done ? 'text-slate-800' : 'text-slate-400'}`}>{job.tripType === 'revision' ? 'En Planta de Revisión' : 'Llegada a Destino'}</p><p className={`text-xs font-bold mt-0.5 transition-colors duration-500 ${step3Done ? 'text-blue-600' : 'text-slate-400'}`}>{step3Done ? (job.tripType === 'revision' ? 'Realizando inspección técnica' : 'En proceso de entrega y checklist') : `Hacia ${job.tripType === 'revision' ? 'PRT' : job.destination}`}</p></div>
                  
                  {/* PASO 4: Resultado PRT */}
                  {job.tripType === 'revision' && (
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step4Done ? (job.prt_result === 'rechazado' ? 'bg-red-500 scale-110' : 'bg-green-500 scale-110') : 'bg-slate-200'}`}>{step4Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step4Done ? (job.prt_result === 'rechazado' ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>Resultado de Revisión</p>{step4Done ? (<p className={`text-xs font-bold mt-0.5 ${job.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-600'}`}>{job.prt_result === 'rechazado' ? `Rechazado: ${job.prt_reason}` : 'Aprobado Exitosamente'}</p>) : (<p className="text-xs font-bold text-slate-400 mt-0.5">Esperando documento de la planta</p>)}</div>
                  )}

                  {/* NUEVO PASO 5: Camino a Destino (Solo si la PRT ya se resolvió) */}
                  {job.tripType === 'revision' && step4Done && (
                  <div className="relative"><div className="absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 bg-blue-500 scale-110"><div className="w-2 h-2 bg-white rounded-full animate-ping"></div></div><p className="font-extrabold text-sm text-slate-800">Camino a destino</p><p className="text-xs font-bold text-blue-600 mt-0.5">El vehículo va en ruta a su destino final</p></div>
                  )}
                </div>

                {/* ALERTA DE TIEMPO DE ESPERA EN VIVO PARA EL CLIENTE */}
                {job.phase === 'arrived_pickup' && job.arrivedPickupAt && <WaitTimerBadge arrivedAt={job.arrivedPickupAt} role="client" />}

                {/* --- NUEVO: MAPA DE SEGUIMIENTO EN VIVO (LIVE TRACKING) --- */}
                {job.liveLocation && job.phase === 'picked_up' && (
                  <div className="mt-6 border-t border-slate-100 pt-5 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-blue-600 uppercase flex items-center gap-1.5"><Navigation className="w-4 h-4 animate-bounce"/> GPS en vivo</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Conectado</p>
                    </div>
                    <div className="w-full h-48 bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner relative pointer-events-none">
                      {/* El pointer-events-none evita que el usuario se quede atrapado haciendo zoom en el mapa al hacer scroll */}
                      <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        src={`https://maps.google.com/maps?q=${job.liveLocation.lat},${job.liveLocation.lng}&z=15&output=embed`}
                      ></iframe>
                    </div>
                  </div>
                )}
                {/* ---------------------------------------------------------- */}

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
                  <LicensePlateBadge text={job.plate || job.vin} />
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
  const [isDownloading, setIsDownloading] = useState(false); // <-- NUEVO: ESTADO PARA DESCARGA DE PDF

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
    const isFinished = job.status === 'completed' || job.status === 'failed';

    // MOTOR GENERADOR DE PDF INTEGRADO EXCLUSIVO PARA FIRMA REMOTA
    const handleDirectDownloadPDF = async () => {
      if (isDownloading) return;
      setIsDownloading(true);
      try {
        const jsPDFModule = await import('jspdf');
        const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
        const docPDF = new JsPDFClass();

        const cleanStr = (str) => { if (!str) return ''; return String(str).replace(/➔/g, '->').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); };
        const fetchImageAsBase64 = async (url) => {
          if (!url) return null;
          if (url.startsWith('data:image')) return url;
          try {
            const response = await fetch(url, { mode: 'cors' });
            const blob = await response.blob();
            const fileBlob = new Blob([blob], { type: blob.type.includes('image') ? blob.type : 'image/jpeg' });
            return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(fileBlob); });
          } catch (e) { return null; }
        };
        const getImageDims = (src) => new Promise(resolve => { const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => resolve({ w: img.width, h: img.height }); img.onerror = () => resolve({ w: 85, h: 60 }); img.src = src; });
        const loadSimpleLogo = async (src) => { return new Promise((resolve) => { const img = new Image(); img.src = src; img.crossOrigin = "Anonymous"; img.onload = () => { const tempCanvas = document.createElement('canvas'); tempCanvas.width = img.width; tempCanvas.height = img.height; const ctx = tempCanvas.getContext('2d'); ctx.drawImage(img, 0, 0, img.width, img.height); resolve({ data: tempCanvas.toDataURL('image/png'), w: img.width, h: img.height }); }; img.onerror = () => resolve(null); setTimeout(() => resolve(null), 1500); }); };
        
        const photos = job.checklist?.photos || {};
        const otherPhotoKeys = Object.keys(photos).filter(k => k !== 'front' && typeof photos[k] === 'string' && photos[k]);

        // CARGA ULTRA RÁPIDA DE TODO (INCLUIDA LA FIRMA)
        const [logoApp, logoLogistica, frontPhotoStr, signatureStr, ...preloadedOtherPhotos] = await Promise.all([
          loadSimpleLogo('/logo.png'),
          loadSimpleLogo('/LogoLogistica.png'),
          fetchImageAsBase64(photos.front),
          fetchImageAsBase64(job.checklist?.signatureData),
          ...otherPhotoKeys.map(async (key) => {
             const base64Img = await fetchImageAsBase64(photos[key]);
             if (!base64Img) return null;
             const dims = await getImageDims(base64Img);
             return { key, base64Img, dims };
          })
        ]);

        const primaryColor = [30, 41, 59]; const secondaryColor = [100, 116, 139]; const accentColor = [37, 99, 235]; const lightBg = [248, 250, 252]; const borderColor = [226, 232, 240];

        const drawHeader = (titleText) => {
          docPDF.setFillColor(...primaryColor); docPDF.rect(0, 0, 210, 40, 'F');
          docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(18); docPDF.setFont("helvetica", "bold");
          docPDF.text(cleanStr(titleText), 105, 18, null, null, "center");
          const dateTxt = job.scheduledDate ? job.scheduledDate.split('-').reverse().join('/') : '-';
          docPDF.setFontSize(9); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(148, 163, 184);
          docPDF.text(`FECHA TRASLADO: ${dateTxt}`, 105, 26, null, null, "center");
          docPDF.setFontSize(11); docPDF.setFont("times", "bolditalic"); docPDF.setTextColor(255, 255, 255);
          if (logoLogistica) { const ratio = logoLogistica.h / logoLogistica.w; let imgW = 35; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("Logística TS SpA", 27, 34, null, null, "center"); }
          if (logoApp) { const ratio = logoApp.h / logoApp.w; let imgW = 20; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("LogisticAPP", 183, 34, null, null, "center"); }
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
        const drawSectionTitle = (title, y) => { docPDF.setFillColor(...lightBg); docPDF.rect(15, y - 6, leftColWidth, 10, 'F'); docPDF.setDrawColor(...accentColor); docPDF.setLineWidth(1); docPDF.line(15, y - 6, 15, y + 4); docPDF.setTextColor(...primaryColor); docPDF.setFontSize(10); docPDF.setFont("helvetica", "bold"); docPDF.text(cleanStr(title).toUpperCase(), 20, y+1); return y + 10; };
        const drawKV = (label, value, x, y, maxW = 40) => { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(cleanStr(label).toUpperCase(), x, y); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const splitValue = docPDF.splitTextToSize(cleanStr(value), maxW); docPDF.text(splitValue, x, y + 4); return splitValue.length * 4; };
        
        let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "Conductor";
        currentY = drawSectionTitle("1. Detalles del Vehiculo", currentY);
        let hC = drawKV("Cliente", `${job.client || 'Sin Cliente'}`, 15, currentY, 45);
        let hM = drawKV("Marca y Modelo", `${job.brand || '-'} ${job.model || '-'}`, 65, currentY, 45);
        currentY += Math.max(hC, hM) + 6;
        let plateText = job.plate || '-'; if (job.vin && job.vin !== job.plate) { plateText += ` / VIN: ${job.vin}`; }
        let hP = drawKV("Patente / VIN", plateText, 15, currentY, 45);
        let hD = drawKV("Conductor", driverNameStr, 65, currentY, 45);
        currentY += Math.max(hP, hD) + 6;
        
        let routeText = `${job.origin || '-'}  ->  ${job.destination || '-'}`;
        if (job.tripType === 'revision') { if (job.checklist?.rtStatus === 'aprobado') { const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin; routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`; } else if (job.checklist?.rtStatus === 'rechazado') { routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`; } else { routeText = `${job.origin || '-'}  ->  PRT`; } }
        let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
        currentY += routeH + 8;

        currentY = drawSectionTitle("2. Recepcion y Estado", currentY);
        const getDocStatus = (docKey) => { const isOk = job.checklist?.docs?.[docKey]; const expDate = job.checklist?.docsExpiry?.[docKey]; if (!isOk) return 'FALTA'; if (expDate) { const [y, m, d] = expDate.split('-'); return `AL DIA (Vence: ${d}/${m}/${y})`; } return 'AL DIA'; };
        let hFuel = drawKV("Combustible", `${job.checklist?.fuelLevel || '0'}%`, 15, currentY, 45);
        let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
        currentY += Math.max(hFuel, hSoap) + 6;
        let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
        let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
        currentY += Math.max(hPerm, hRev) + 6;
        let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
        currentY += hGas + 8;

        docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("OBSERVACIONES:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth); docPDF.text(obsSplit, 15, currentY + 4); currentY += (obsSplit.length * 4) + 6;
        if (job.waitTimeMinutes && job.waitTimeMinutes > 20) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38); const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA EN ORIGEN: ${job.waitTimeMinutes} minutos`, leftColWidth); docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2; } else if (job.checklist?.hasWaitTime) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);  const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);  docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;  }
        if (job.checklist?.hasFuelCharge) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235); const fcStr = docPDF.splitTextToSize(`CARGA DE COMBUSTIBLE: ${cleanStr(job.checklist.fuelChargeAmount || 'Sí')}`, leftColWidth); docPDF.text(fcStr, 15, currentY); currentY += (fcStr.length * 4) + 2; }
        currentY += 8; 

        let sectionNum = 3;
        if (job.tripType === 'revision') { currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY); if (job.checklist?.rtStatus === 'aprobado') { docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); docPDF.text("APROBADO", 15, currentY + 6); currentY += 18; } else { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); docPDF.text("RECHAZADO", 15, currentY + 6); docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27); const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth); docPDF.text(rejSplit, 15, currentY + 12); currentY += 20 + (rejSplit.length * 4); } sectionNum++; }

        currentY = drawSectionTitle(`${sectionNum}. Conformidad Entrega`, currentY);
        if (job.checklist?.noReception) { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(9); const nrSplit = docPDF.splitTextToSize("ENTREGA SIN RECEPCION (Confirmada por conductor en terreno)", leftColWidth); docPDF.text(nrSplit, 15, currentY + 4); currentY += (nrSplit.length * 4) + 6; } else { drawKV("Receptor", `${job.checklist?.receiverName || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; drawKV("RUT", `${job.checklist?.receiverRut || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; if (job.checklist?.clientComments) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("COMENTARIOS:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const commSplit = docPDF.splitTextToSize(cleanStr(job.checklist.clientComments), leftColWidth); docPDF.text(commSplit, 15, currentY + 4); currentY += (commSplit.length * 4) + 6; } 
          if(signatureStr) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("FIRMA DE CONFORMIDAD:", 15, currentY); try { docPDF.addImage(signatureStr, 'JPEG', 15, currentY + 2, 45, 25); } catch(e){ try{docPDF.addImage(signatureStr, 'PNG', 15, currentY + 2, 45, 25);}catch(err){} } currentY += 30; } 
        }

        if (frontPhotoStr) { try { const dims = await getImageDims(frontPhotoStr); const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; } const rightX = 115; const rightY = startY + 6; docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" }); try { docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH); } catch(e){docPDF.addImage(frontPhotoStr, 'PNG', rightX, rightY + 2, imgW, imgH);} } catch (err) {} }

        const addFooter = () => { const pageCount = docPDF.internal.getNumberOfPages(); for(let i = 1; i <= pageCount; i++) { docPDF.setPage(i); docPDF.setFontSize(8); docPDF.setTextColor(148, 163, 184); docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center"); } }

        if (preloadedOtherPhotos.length > 0) {
          const labels = { left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', interior_front: 'Int. Adelante', interior_back: 'Int. Atras', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4', det5: 'Detalle 5', det6: 'Detalle 6', det7: 'Detalle 7', det8: 'Detalle 8' };
          let photoY = 46; let currentCol = 1; let addedPage = false;
          for (const item of preloadedOtherPhotos) { 
            if (!item) continue;
            const { key, base64Img, dims } = item;
            if (!addedPage) { docPDF.addPage(); drawHeader("ANEXO FOTOGRAFICO"); addedPage = true; } 
            try { 
              const ratio = dims.h / dims.w; let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; } const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2); if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); } docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text((labels[key] || key).toUpperCase(), slotCenter, photoY - 3, { align: "center" }); 
              try { docPDF.addImage(base64Img, 'JPEG', finalX, photoY + 2, imgW, imgH); } catch(e) { docPDF.addImage(base64Img, 'PNG', finalX, photoY + 2, imgW, imgH); }
              if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; } 
            } catch (err) {} 
          }
        }

        addFooter();
        const cleanPlate = job.plate || job.vin || 'SN';
        const dateStrForFile = (job.scheduledDate || new Date().toISOString().split('T')[0]).replace(/\//g, '-');
        const fileName = `Certificado.${dateStrForFile}.${(job.client || 'Cliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; 
        docPDF.save(fileName); 
        setIsDownloading(false);
      } catch (error) {
        console.error("Error crítico generando PDF en Portal:", error);
        alert("Hubo un error al descargar el PDF. Verifica tu conexión a internet e intenta de nuevo.");
        setIsDownloading(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className={`bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border-t-8 transition-colors duration-500 ${isFinished ? 'border-green-500' : 'border-blue-500'}`}>
          {isFinished ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-in zoom-in"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">¡Traslado Finalizado!</h2>
              <p className="text-slate-500 font-bold text-sm mb-6">El conductor ha cerrado el acta. Ya puedes descargar tu copia del checklist.</p>
              
              {/* Botón con el motor PDF inyectado directamente */}
              <button onClick={handleDirectDownloadPDF} disabled={isDownloading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isDownloading ? <Clock className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5"/>} 
                {isDownloading ? "Generando PDF..." : "Descargar PDF"}
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
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
             <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-1">Vehículo a recibir</p>
             <h2 className="text-xl sm:text-2xl font-black text-slate-800">{job.brand} {job.model}</h2>
          </div>
          <LicensePlateBadge text={job.plate || job.vin} />
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

function LogisticApp() {
  // Inicializamos el motor de navegación ultra-rápido de React Router
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const clientTrack = searchParams.get('client');
  const liveTrackId = searchParams.get('track'); 
  
  // Limpiamos la URL por si el escáner QR le agrega barras invertidas ("/") o espacios al final
  const rawSign = searchParams.get('sign');
  const signTrackId = rawSign ? rawSign.replace(/[^a-zA-Z0-9_-]/g, '') : null;

  // Detector del código de Relevo (Traspaso en Ruta)
  const rawRelay = searchParams.get('relay');
  const relayJobId = rawRelay ? rawRelay.replace(/[^a-zA-Z0-9_-]/g, '') : null;

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
  const [simulatedDriverEmail, setSimulatedDriverEmail] = useState(''); // <-- NUEVO: Guarda a quién estamos simulando
  const [favDriverEmail, setFavDriverEmail] = useState(() => localStorage.getItem('favDriverEmail') || ''); // <-- NUEVO: Guarda al conductor favorito (Felipe)
  
  // Estados para Modo Oscuro, Conexión Offline y Tuerca
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // <-- NUEVO: Candado de base de datos
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [jobLimit, setJobLimit] = useState(300); // <-- AMPLIADO a 300 para que el Ranking y el Excel contabilicen todo el mes sin perder datos
  
  // NUEVO: Lectura Inteligente del Tema del Sistema Operativo
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const isFirstLoad = useRef(true);
  const driversRef = useRef([]);
  const [dialogConfig, setDialogConfig] = useState(null);

  // NUEVO: Estados y variables para el Anuncio Global (Pop-Up)
  const [broadcast, setBroadcast] = useState(null);
  const [showBroadcastAdmin, setShowBroadcastAdmin] = useState(false);
  const [localDismissed, setLocalDismissed] = useState(() => localStorage.getItem('dismissedBroadcast'));

  // Escuchador en tiempo real del Anuncio Global
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system_config', 'broadcast'), (docSnap) => {
      if (docSnap.exists()) setBroadcast(docSnap.data());
      else setBroadcast(null);
    });
    return () => unsub();
  }, [db]);

  // Escuchador de conexión a Internet y Cambios de Tema OS
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e) => {
      if (localStorage.getItem('darkMode') === null) setDarkMode(e.matches);
    };
    mediaQuery.addEventListener('change', handleThemeChange);

    return () => { 
      window.removeEventListener('online', handleOnline); 
      window.removeEventListener('offline', handleOffline); 
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  // Aplicador del Modo Oscuro Global
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

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) { 
      // Detectamos que estamos dentro del APK (WebView) y no en Chrome web
      showAlert("Estás usando la versión App (APK). Las notificaciones son gestionadas directamente por el sistema Android."); 
      setNotificationsEnabled(true); // Ponemos el botón en verde "Activas" para no confundir al chofer
      return; 
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        showAlert("⏳ Permiso concedido. Generando token seguro...");
        
        if (messaging && user) {
          const token = await getToken(messaging, { vapidKey: 'BK8z3mxtN3JApx1nw-9cVLzsjp78ufh0qimwqsxJOTnRuMIbQ4HQgYWGkKJ8h9MWPpZYFC3WxbX9Y-jskpIaOHY' });
          if (token) {
            const driverSnap = driversRef.current.find(d => d.email === user.email);
            if (driverSnap) {
              await updateDoc(doc(db, 'drivers', driverSnap.id), { fcmToken: token });
              setNotificationsEnabled(true);
              showAlert("✅ ¡Éxito! Token guardado correctamente en la base de datos.");
            } else {
              showAlert(`❌ Error: Tu correo (${user.email}) no coincide con ningún conductor registrado.`);
            }
          } else {
            showAlert("❌ Error: Firebase no pudo generar el token.");
          }
        } else {
          showAlert("❌ Error: El servicio de mensajería (FCM) fue bloqueado por tu navegador o modo incógnito.");
        }
      } else {
        showAlert("⚠️ Rechazaste el permiso de notificaciones.");
      }
    } catch (error) {
      showAlert("❌ Error de sistema: " + error.message);
    }
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
      if ("Notification" in window && Notification.permission === "granted") {
        setNotificationsEnabled(true);
        // Escuchamos los mensajes silenciosos cuando la app está abierta en la pantalla
        if (messaging) {
          onMessage(messaging, (payload) => {
            triggerNotification(payload.notification.title, payload.notification.body);
          });
        }
      }
    });
    return () => unsub();
  }, []);

  // 1. Guardamos quién eres tú realmente de forma inalterable
  const actualUserEmail = user?.email?.toLowerCase();
  const isRealAdmin = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(actualUserEmail);

  // 2. MAGIA: Si eliges ayudar a un conductor, toda la App pensará que eres él. Si no, usa tu correo normal.
  const currentUserEmail = (activeRole === 'driver' && simulatedDriverEmail) ? simulatedDriverEmail : actualUserEmail;

  useEffect(() => {
    if (isRealAdmin) setActiveRole('admin');
  }, [isRealAdmin]);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  // --- HOOKS DE AUTO-REGISTRO Y DETECCIÓN DE CLIENTES MULTI-CUENTA ---
  // Prioridad: Si por error el sistema duplicó cuentas, rescata automáticamente la que ya tiene sus fotos subidas
  const myDriver = user ? (drivers.find(d => d.email === currentUserEmail && d.photo) || drivers.find(d => d.email === currentUserEmail)) : null;
  
  // Detección inteligente: separa los correos por coma y revisa si el usuario está en la lista de permitidos de algún cliente
  const loggedClientRecord = user ? customClients.find(c => c.email && c.email.toLowerCase().split(',').map(e => e.trim()).includes(currentUserEmail)) : null;
  const registeringRef = useRef(false);

  useEffect(() => {
    // CANDADO MAESTRO: Solo evalúa si falta un conductor cuando dataLoaded sea TRUE
    if (user && activeRole === 'driver' && dataLoaded && !myDriver && isOnline && !registeringRef.current) {
        const isClientAccount = customClients.some(c => c.email && c.email.toLowerCase().split(',').map(e => e.trim()).includes(currentUserEmail));
        
        // Solo auto-registra al conductor si NO ES ADMINISTRADOR y NO ES UNA CUENTA DE CLIENTE
        if (!isClientAccount && !isRealAdmin) {
          registeringRef.current = true;
          // Ejecutamos una función asíncrona directamente para hacer la verificación de seguridad
          (async () => {
            try {
              // VERIFICACIÓN BLINDADA: Consultamos directo al servidor de Firebase antes de crear nada
              const q = query(collection(db, 'drivers'), where('email', '==', currentUserEmail));
              const snap = await getDocs(q);
              
              if (snap.empty) {
                await addDoc(collection(db, 'drivers'), {
                  name: user.displayName || 'Conductor Nuevo',
                  email: currentUserEmail,
                  balance: 0,
                  licenses: [],
                  licenseExpiry: '',
                  createdAt: Date.now()
                });
              }
            } catch(e) {
              console.error("Error al auto-registrar:", e);
            } finally {
              registeringRef.current = false;
            }
          })();
        }
    }
  }, [user, activeRole, myDriver, dataLoaded, isOnline, currentUserEmail, db, customClients, isRealAdmin]);
  // --------------------------------------------------------------

  // --- NUEVO: RECOLECTOR DE BASURA (TRASH COLLECTOR) EN SEGUNDO PLANO ---
  // Elimina fotos Base64 de la memoria local de aquellos traslados que ya se completaron
  useEffect(() => {
    const cleanupDrafts = async () => {
      const finishedWithDrafts = jobs.filter(j => (j.status === 'completed' || j.status === 'failed') && j.draft);
      for (const j of finishedWithDrafts) {
         try { await updateDoc(doc(db, 'transport_jobs', j.id), { draft: deleteField() }); } 
         catch (e) { /* Ignorar si falla, lo intentará luego */ }
      }
    };
    if (jobs.length > 0) cleanupDrafts();
  }, [jobs, db]);

  useEffect(() => {
    if (!user) return;
    
    // APLICADA MEJORA: Paginación dinámica con límite variable (jobLimit)
    const qJobs = query(collection(db, 'transport_jobs'), orderBy('createdAt', 'desc'), limit(jobLimit));

    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const d = change.doc.data();
          // Solo notifica si es realmente nuevo (creado hace menos de 2 minutos)
          const isReallyNew = (Date.now() - (d.createdAt || 0)) < 120000;
          if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail) && isReallyNew) {
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
    }, (error) => {
      console.error("Error en conexión en tiempo real Firebase:", error);
    });

    // OPTIMIZACIÓN 2: Traer solo los últimos 300 gastos
    const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(300));

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), snap => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoaded(true); // <-- Candado maestro abierto: Firebase terminó de cargar
    });
    const unsubExpenses = onSnapshot(qExpenses, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, 'clients'), snap => setCustomClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubDrivers(); unsubExpenses(); unsubVehicles(); unsubClients(); };
  }, [user, activeRole, currentUserEmail, isRealAdmin, jobLimit]);

  // --- MOTOR DE TRACKING GPS EN TIEMPO REAL (OPTIMIZADO BATERÍA/iOS) ---
  // 1. Aislamos el ID del trabajo para no re-renderizar todo cuando el GPS se mueve
  const activeTrackingJobId = React.useMemo(() => {
    if (!user || activeRole !== 'driver') return null;
    const activeJob = jobs.find(j => j.acceptedByEmail === currentUserEmail && j.status === 'accepted' && j.phase === 'picked_up');
    return activeJob ? activeJob.id : null;
  }, [jobs, user, activeRole, currentUserEmail]);

  // 2. Encendemos el GPS SOLAMENTE cuando el ID cambia (inicia o termina el viaje)
  useEffect(() => {
    if (!activeTrackingJobId || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateDoc(doc(db, 'transport_jobs', activeTrackingJobId), {
          liveLocation: { lat: latitude, lng: longitude, timestamp: Date.now() }
        }).catch(e => console.warn("Error enviando GPS", e));
      },
      (error) => console.warn("Error GPS en vivo:", error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeTrackingJobId, db]);
  // ---------------------------------------------------

  // Ahora TODOS los clientes provienen exclusivamente de tu base de datos (100% editables)
  const allClientsList = customClients.map(c => c.name).sort((a, b) => a.localeCompare(b));

  const globalStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Alfa+Slab+One&display=swap');
      
      @font-face {
        font-family: 'FE-Font';
        src: url('https://cdn.jsdelivr.net/gh/kreativekorp/open-din-schriften@master/FE-Font/FE-Font.woff2') format('woff2'),
             url('https://cdn.jsdelivr.net/gh/kreativekorp/open-din-schriften@master/FE-Font/FE-Font.woff') format('woff');
        font-weight: normal;
        font-style: normal;
      }
      
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

      /* PREVENIR AUTO-ZOOM EN iPHONE (IOS SAFARI) AL ESCRIBIR EN INPUTS */
      @media screen and (max-width: 768px) {
        input, select, textarea { 
          font-size: 16px !important; 
        }
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
  // --- NUEVO: SI EL USUARIO LOGUEADO ES UN CLIENTE REAL (Y NO ES ADMIN) ---
  if (user && loggedClientRecord && !isRealAdmin) {
    return (
      <>
        {globalStyles}
        <TrackingView 
           clientName={loggedClientRecord.name} 
           db={db} 
           onLogout={() => signOut(auth)} 
           darkMode={darkMode} 
           setDarkMode={setDarkMode} 
        />
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

  // --- NUEVO: VISTA DE TRASPASO EN RUTA (RELEVO) ---
  if (relayJobId && user) {
    return (
      <>
        {globalStyles}
        <RelayAcceptView jobId={relayJobId} db={db} currentUserEmail={user.email} drivers={drivers} />
      </>
    );
  }
  // Si no está logueado, seguirá hacia abajo para pedir Google, y conservará la URL para entrar a esta vista después
  // --------------------------------------------------------------------------------
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-blue-50">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 transform rotate-3 hover:rotate-0 transition-transform"><Car className="w-10 h-10 text-white" /></div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">LogisticAPP</h1>
          <p className="text-slate-500 mb-10 text-lg">Gestión de traslados inteligente</p>
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e => alert("Error de Acceso: " + e.message))} className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 px-4 rounded-2xl shadow-sm hover:bg-slate-50 flex items-center justify-center gap-3 transition-all text-lg">
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

  // --- CONTROL DE ONBOARDING ESTRICTO ---
  const needsOnboarding = myDriver && (
    !myDriver.photo || myDriver.photo === "" || 
    !myDriver.idFront || myDriver.idFront === "" || 
    !myDriver.idBack || myDriver.idBack === "" || 
    !myDriver.licenseFront || myDriver.licenseFront === "" || 
    !myDriver.licenseBack || myDriver.licenseBack === ""
  );

  // BLOQUEO ABSOLUTO: Nadie en modo "Conductor" pasa a la app sin sus 5 fotos (sin excepciones)
  if (activeRole === 'driver' && (needsOnboarding || !myDriver)) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10 transition-colors duration-300 dark:bg-slate-950">
        {globalStyles}
        <header className="fixed-nav-bar bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20">
           <div className="flex items-center gap-3">
             <div className="bg-white/20 p-1.5 rounded-xl"><img src="/logo.png" className="w-8 h-8 object-contain"/></div>
             <h1 className="font-alfa text-xl text-white">Verificación Obligatoria</h1>
           </div>
           {isRealAdmin ? (
             <button onClick={() => { setActiveRole('admin'); setRoleMenuOpen(false); }} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors flex items-center gap-2 text-xs font-bold">
               <LogOut className="w-4 h-4" /> Salir a Admin
             </button>
           ) : (
             <button onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors flex items-center gap-2 text-xs font-bold">
               <LogOut className="w-4 h-4" /> Salir
             </button>
           )}
        </header>
        <main className="max-w-md mx-auto p-4 pt-24 sm:pt-28 pb-10">
           {myDriver ? (
             <DriverOnboarding driver={myDriver} db={db} />
           ) : (
             <div className="bg-white p-8 rounded-3xl border text-center space-y-5 shadow-lg border-slate-100">
               <div className="relative w-20 h-20 mx-auto">
                 <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                 <User className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
               </div>
               <p className="font-black text-slate-800 text-xl">Creando credenciales...</p>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider leading-relaxed">Estableciendo conexión segura con la central logística</p>
             </div>
           )}
        </main>
      </div>
    );
  }
  // -----------------------------------------------------------------

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
                  {/* Permisos de Notificaciones */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Bell className={`w-4 h-4 ${notificationsEnabled ? 'text-green-500' : 'text-amber-500 animate-pulse'}`}/> Notificaciones
                    </span>
                    {!notificationsEnabled ? (
                      <button onClick={requestNotificationPermission} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors">Activar</button>
                    ) : (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Activas</span>
                    )}
                  </div>

                  {/* --- SÚPER BOTÓN MATA-CACHÉ (SOLUCIÓN DEFINITIVA XIAOMI/PWA) --- */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-600"/> Recargar App
                    </span>
                    <button onClick={() => {
                        // 1. Matar la caché visual y de archivos
                        if ('caches' in window) {
                          caches.keys().then((names) => {
                            names.forEach(name => caches.delete(name));
                          });
                        }
                        // 2. Destruir Service Workers trabados por el navegador
                        if ('serviceWorker' in navigator) {
                          navigator.serviceWorker.getRegistrations().then(regs => {
                            regs.forEach(r => r.unregister());
                          });
                        }
                        // 3. BOMBA NUCLEAR: Destruir la base de datos congelada de Firebase (sin cerrar la sesión)
                        if (window.indexedDB && window.indexedDB.databases) {
                          window.indexedDB.databases().then(dbs => {
                            dbs.forEach(dbFile => {
                              // 'firestore' es donde Firebase guarda los trabajos offline
                              if (dbFile.name.startsWith('firestore')) {
                                window.indexedDB.deleteDatabase(dbFile.name);
                              }
                            });
                          });
                        }
                        // 4. Forzar recarga completa después de limpiar todo
                        setTimeout(() => window.location.reload(true), 300);
                    }} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors active:bg-blue-300">
                      FORZAR
                    </button>
                  </div>

                </div>
                {/* VERSIÓN DE LA APP */}
                <div className="bg-slate-50 p-2.5 text-center border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">LogisticAPP v.2.5 22</p>
                </div>
              </div>
            )}
          </div>
          {isRealAdmin && (
            <div className="relative">
              {/* Botón dinámico inteligente: se vuelve morado y parpadea si estás asistiendo a un conductor */}
              <button 
                onClick={() => setRoleMenuOpen(!roleMenuOpen)} 
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all border shadow-sm ${
                  (activeRole === 'driver' && simulatedDriverEmail) 
                    ? 'bg-purple-600 border-purple-400 text-white animate-pulse font-black' 
                    : 'bg-white/20 hover:bg-white/30 border-white/10 text-white font-bold backdrop-blur-sm'
                }`}
              >
                <Eye className="w-5 h-5 text-white"/>
                <span className="hidden md:inline">
                  {activeRole === 'admin' ? 'Modo: Admin' : activeRole === 'driver' ? (
                    simulatedDriverEmail 
                      ? `Asistiendo a: ${drivers.find(dr => dr.email === simulatedDriverEmail)?.name?.split(' ')[0]}` 
                      : 'Modo: Conductor'
                  ) : 'Modo: Cliente'}
                </span>
              </button>
              {roleMenuOpen && (
                <div className="absolute right-0 top-12 mt-1 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 text-slate-800">
                  <div className="p-2 border-b border-slate-100 bg-slate-50"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Panel de Control General</p></div>
                  
                  <button onClick={() => { setActiveRole('admin'); setMainTab('jobs'); setSimulatedDriverEmail(''); setRoleMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors ${activeRole==='admin'?'text-blue-600 bg-blue-50':'text-slate-600'}`}>
                     <Users className="w-4 h-4"/> Volver a Administrador
                  </button>

                  {/* NUEVA SECCIÓN: ASISTIR/SIMULAR CONDUCTOR (DISEÑO MEJORADO Y RÁPIDO) */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                     <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-2"><Car className="w-3.5 h-3.5 text-blue-600"/> Entrar como Conductor</p>
                     
                     {/* BOTÓN RÁPIDO DE FAVORITO */}
                     {favDriverEmail && drivers.find(d => d.email === favDriverEmail) && (
                       <button onClick={() => { setSimulatedDriverEmail(favDriverEmail); setActiveRole('driver'); setMainTab('jobs'); setRoleMenuOpen(false); }} className="w-full bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-200 hover:from-amber-200 text-amber-800 p-2.5 rounded-xl text-xs font-black flex justify-between items-center transition-colors shadow-sm mb-3">
                         <div className="flex items-center gap-2"><Star className="w-4 h-4 fill-amber-500 text-amber-500"/> Entrar como {drivers.find(d => d.email === favDriverEmail).name.split(' ')[0]}</div>
                         <ChevronRight className="w-4 h-4 text-amber-500"/>
                       </button>
                     )}

                     {/* LISTA SCROLLEABLE INTERNA DE CONDUCTORES */}
                     <div className="bg-white border border-slate-200 rounded-xl max-h-40 overflow-y-auto shadow-inner divide-y divide-slate-50">
                       {drivers.sort((a, b) => a.name.localeCompare(b.name)).map(d => {
                         const isCurrentActive = activeRole === 'driver' && simulatedDriverEmail === d.email;
                         return (
                         <div key={d.id} className={`flex items-center justify-between p-1 transition-colors group ${isCurrentActive ? 'bg-purple-50 border-l-4 border-purple-500' : 'hover:bg-blue-50'}`}>
                            {/* Al tocar el nombre, entras directo */}
                            <button onClick={() => { setSimulatedDriverEmail(d.email); setActiveRole('driver'); setMainTab('jobs'); setRoleMenuOpen(false); }} className={`flex-1 text-left px-2 py-2 text-xs truncate ${isCurrentActive ? 'text-purple-700 font-black' : 'text-slate-700 font-bold group-hover:text-blue-700'}`}>
                               {d.name} {isCurrentActive && <span className="text-[9px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded ml-1 animate-pulse">ACTIVO</span>}
                            </button>
                            {/* Estrella para fijarlo como favorito arriba */}
                            <button onClick={(e) => { e.stopPropagation(); setFavDriverEmail(d.email); localStorage.setItem('favDriverEmail', d.email); }} className="p-2 rounded-lg hover:bg-amber-50 transition-colors" title="Fijar como Favorito">
                               <Star className={`w-4 h-4 transition-colors ${favDriverEmail === d.email ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-300'}`} />
                            </button>
                         </div>
                         );
                       })}
                     </div>
                  </div>

                  {/* SECCIÓN EXISTENTE: SIMULAR CLIENTE */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2">
                     <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-slate-800"/> Ver Portal de Cliente</p>
                     <select value={simulatedClient} onChange={(e) => setSimulatedClient(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:border-slate-800 bg-white">
                        <option value="">Seleccionar Cliente...</option>
                        {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <button onClick={() => { if(simulatedClient) { setActiveRole('client'); setRoleMenuOpen(false); } else { showAlert("Selecciona un cliente de la lista primero"); } }} className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-sm">Entrar a la vista Cliente</button>
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
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={() => {setAdminTab('dashboard'); setEditingJob(null);}} className={`flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><ClipboardList className="w-4 h-4 sm:w-5 sm:h-5"/> Monitor</button>
                <button onClick={() => {setAdminTab('newJob'); setEditingJob(null);}} className={`flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-4 h-4 sm:w-5 sm:h-5"/> Crear</button>
                <button onClick={() => setAdminTab('config')} className={`flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors ${adminTab==='config'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Truck className="w-4 h-4 sm:w-5 sm:h-5"/> Config</button>
                <button onClick={() => setShowBroadcastAdmin(true)} className="flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors text-purple-600 bg-purple-50 hover:bg-purple-100"><Megaphone className="w-4 h-4 sm:w-5 sm:h-5"/> Aviso</button>
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
                    onLoadMore={() => setJobLimit(prev => prev + 20)}
                  />
                </div>
              )}
              
              {adminTab === 'newJob' && <div className="animate-in zoom-in-[0.98] slide-in-from-bottom-8 duration-500 ease-out"><NewJobForm key={editingJob ? editingJob.id : 'new'} jobToEdit={editingJob} onCancelEdit={() => {setEditingJob(null); setAdminTab('dashboard');}} allClientsList={allClientsList} vehicles={vehicles} drivers={drivers} db={db} showAlert={showAlert} onSuccess={() => setAdminTab('dashboard')} /></div>}
              {adminTab === 'config' && <div className="animate-in zoom-in-[0.98] duration-300"><ConfigView allClientsList={allClientsList} customClients={customClients} vehicles={vehicles} drivers={drivers} db={db} showAlert={showAlert} showConfirm={showConfirm} /></div>}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Mis Trabajos Asignados</h2>
              <JobsList 
                 jobs={jobs} drivers={drivers} role="driver" 
                 onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} 
                 db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
                 onLoadMore={() => setJobLimit(prev => prev + 20)}
              />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      
      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4 pt-20 sm:pt-24 pb-24 animate-in zoom-in-[0.98] slide-in-from-bottom-8 duration-500 ease-out">
          <ChecklistForm 
             job={selectedJob} db={db} currentUserEmail={currentUserEmail} 
             allClientsList={allClientsList}
             vehicles={vehicles}
             drivers={drivers} expenses={expenses} 
             onCancel={() => { 
                // Ya no eliminamos el borrador al presionar Salir, para que se mantenga en Firebase
                setCurrentView('main');
             }} 
             onComplete={async () => { 
                // Limpiamos la base de datos de basura solo cuando el trabajo se finalizó con éxito
                if (selectedJob.id !== 'NEW_QUICK_JOB') await updateDoc(doc(db, 'transport_jobs', selectedJob.id), { draft: null });
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

      {/* NUEVO: Bandeja Flotante de Trabajo Offline (Idea 3) */}
      {!isOnline && user && (
        <div className="fixed bottom-[88px] sm:bottom-[92px] left-1/2 transform -translate-x-1/2 z-[100] w-[92%] max-w-sm animate-in slide-in-from-bottom-5 duration-500">
          <div className="bg-slate-800 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3">
            <div className="bg-slate-700 p-2.5 rounded-full relative shrink-0">
              <CloudOff className="w-5 h-5 text-amber-400" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-0.5">Modo Sin Conexión</p>
              <p className="text-[10px] font-bold text-slate-300 leading-tight">Trabajando con memoria caché local. Se sincronizará automáticamente al volver la red.</p>
            </div>
          </div>
        </div>
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

      {/* --- MODAL ADMIN: CREAR ANUNCIO --- */}
      {showBroadcastAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={async (e) => {
              e.preventDefault();
              const msg = e.target.message.value.trim();
              if (!msg) return;
              try {
                await setDoc(doc(db, 'system_config', 'broadcast'), { message: msg, timestamp: Date.now(), active: true });
                setShowBroadcastAdmin(false);
                showAlert("✅ Anuncio enviado exitosamente a toda la flota.");
              } catch(err) { console.error(err); showAlert("Error enviando anuncio."); }
          }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
              <button type="button" onClick={()=>setShowBroadcastAdmin(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-700"/></button>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-purple-100 p-2.5 rounded-full"><Megaphone className="w-6 h-6 text-purple-600"/></div>
                <h3 className="text-xl font-black text-slate-800">Pop-up Global</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-5 leading-relaxed">Envía una alerta urgente que aparecerá obligatoriamente en medio de la pantalla de todos los conductores al abrir la app.</p>

              {broadcast?.active && (
                <div className="mb-5 bg-purple-50 p-4 rounded-2xl border border-purple-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                    <p className="text-[10px] font-black text-purple-600 uppercase mb-1.5 tracking-widest">Anuncio Activo Actual:</p>
                    <p className="text-sm font-bold text-slate-700 italic leading-snug">"{broadcast.message}"</p>
                    <button type="button" onClick={async () => {
                      await setDoc(doc(db, 'system_config', 'broadcast'), { active: false }, { merge: true });
                      showAlert("Anuncio apagado. Ya no le saldrá a nadie.");
                    }} className="mt-3 text-[10px] font-black uppercase text-red-500 hover:text-red-600 bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-200">Apagar Anuncio</button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escribir Nuevo Mensaje</label>
                <textarea name="message" rows="4" required placeholder="Ej: Muchachos, recuerden tomar fotografías claras a los comprobantes de peaje..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500 resize-none"></textarea>
              </div>
              <button type="submit" className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-purple-200 transition-colors text-sm">Emitir a toda la flota</button>
          </form>
        </div>
      )}

      {/* --- POP-UP CONDUCTORES: MOSTRAR ANUNCIO --- */}
      {user && broadcast?.active && broadcast.timestamp.toString() !== localDismissed && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border-4 border-purple-500 flex flex-col">
              <div className="bg-purple-600 p-6 text-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 opacity-10"><Megaphone className="w-40 h-40 text-white"/></div>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl relative z-10">
                    <Megaphone className="w-8 h-8 text-purple-600 animate-pulse"/>
                </div>
                <h3 className="text-2xl font-black text-white relative z-10 tracking-wide">¡Aviso Importante!</h3>
              </div>
              <div className="p-6 text-center flex-1 flex flex-col justify-center bg-slate-50">
                <p className="text-base font-extrabold text-slate-700 mb-8 leading-relaxed whitespace-pre-wrap">{broadcast.message}</p>
                <button onClick={() => {
                    localStorage.setItem('dismissedBroadcast', broadcast.timestamp.toString());
                    setLocalDismissed(broadcast.timestamp.toString());
                }} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black shadow-lg shadow-purple-200 transition-all text-lg active:scale-95">
                  ¡Entendido!
                </button>
              </div>
          </div>
        </div>
      )}

    </div>
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addExp = async (e, type, amount, detail, driverId, dName, dEmail) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const currentBalance = drivers.find(d => d.id === driverId)?.balance || 0;
    
    // REGLA: Si es conductor, bloquea la rendición si supera su saldo asignado
    if (!isAdminView && type === 'expense' && amount > currentBalance) {
        return showAlert(`Saldo insuficiente. Tienes ${formatMoney(currentBalance)}. Solicita asignación de dinero al administrador para rendir este monto.`);
    }
    
    const assocJobId = e.target.jobId?.value || '';
    let detailString = detail || (type === 'assignment' ? 'Asignación de fondos' : 'Gasto registrado por Admin');

    if (assocJobId) {
      const jb = activeOrPendingJobs.find(x => x.id === assocJobId);
      if (jb) detailString += ` (Asoc. a patente ${jb.plate || jb.vin || 'S/N'})`;
    }

    // Lógica para saldos y negativos
    let newBalance = currentBalance;
    let deductedAmount = amount; 
    
    if (type === 'assignment') {
       newBalance = currentBalance + amount;
    } else if (type === 'expense') {
       // REGLA: Los Admins siempre pueden dejar el saldo en negativo. Los conductores no (ya fueron bloqueados arriba).
       newBalance = currentBalance - amount;
    }

    try {
      await updateDoc(doc(db, 'drivers', driverId), { balance: newBalance });
      // Guardamos también el "deductedAmount" en la base de datos
      await addDoc(collection(db, 'expenses'), { driverId, driverEmail: dEmail, driverName: dName, type, amount, detail: detailString, jobId: assocJobId, deductedAmount, createdAt: Date.now() });
      e.target.reset(); 
      showAlert(type === 'assignment' ? "Fondo asignado correctamente." : "Gasto registrado exitosamente.");
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const submitReturn = async () => {
    if (returnMethod === 'transferencia' && !returnReceipt) return showAlert("Sube la foto de la transferencia.");
    if (!myDriver?.balance) return;
    if (isSubmittingReturn) return;
    setIsSubmittingReturn(true);
    
    let det = returnMethod === 'efectivo' ? 'Rendición en Efectivo (En revisión)' : 'Rendición de Vuelto (En revisión)';
    
    try {
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: det, receiptImage: returnReceipt, createdAt: Date.now() });
      setIsReturnOpen(false); setReturnReceipt(null); showAlert("Rendición enviada. Esperando validación de Admin.");
    } catch(e) {}
    finally { setIsSubmittingReturn(false); }
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
             
             // 2. Aplicamos el nuevo descuento. Como es Admin editando, puede quedar negativo.
             currentDriverBalance -= newAmount;
             newlyDeducted = newAmount;
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
      <main className="max-w-3xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
        {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}
        {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

       <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Wallet className="text-blue-600"/> Control Viáticos</h2>
        
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest ml-2 mb-4">Directorio de Conductores</h3>
          {drivers.map(d => (
            <div key={d.id} className={`bg-white p-4 sm:p-5 rounded-3xl border transition-all ${selectedDriverId === d.id ? 'border-blue-500 shadow-md ring-4 ring-blue-50' : 'border-slate-200 shadow-sm hover:border-blue-300'}`}>
              
              {/* ENCABEZADO CLICKABLE */}
              <div className="flex justify-between items-center cursor-pointer" onClick={() => {setSelectedDriverId(d.id === selectedDriverId ? null : d.id); setAdminTxType('assignment');}}>
                <div>
                  <p className="font-extrabold text-lg text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400 font-bold">{d.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Saldo</p>
                  <p className={`font-black text-xl ${d.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(d.balance||0)}</p>
                </div>
              </div>
              
              {/* ACORDEÓN DESPLEGABLE */}
              {selectedDriverId === d.id && (
                <div className="mt-5 border-t border-slate-100 pt-5 animate-in slide-in-from-top-2 duration-300">
                  
                  <form onSubmit={(e) => addExp(e, adminTxType, Number(e.target.amount.value), adminTxType === 'expense' ? e.target.detail?.value : '', d.id, d.name, d.email)} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 mb-6 relative">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black uppercase text-blue-600 tracking-widest border border-slate-200 rounded-full">Nuevo Registro</div>
                    
                    <div className="flex gap-2 mb-2 pt-1">
                       <button type="button" onClick={() => setAdminTxType('assignment')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${adminTxType === 'assignment' ? 'bg-green-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>+ Entregar Fondo</button>
                       <button type="button" onClick={() => setAdminTxType('expense')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${adminTxType === 'expense' ? 'bg-red-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>- Anotar Gasto</button>
                    </div>
                    
                    {adminTxType === 'expense' && (
                       <input name="detail" type="text" required placeholder="Detalle del gasto (ej. Peaje, Bencina)" className="w-full border-2 border-white bg-white p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-400 shadow-sm"/>
                    )}
                    
                    <input name="amount" type="number" required placeholder={adminTxType === 'assignment' ? "Monto a asignar $" : "Monto del gasto $"} className="w-full border-2 border-white bg-white p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-400 shadow-sm"/>
                    
                    <select name="jobId" className="w-full border-2 border-white bg-white p-3 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-400 shadow-sm">
                       <option value="">{adminTxType === 'assignment' ? "Asociar a un Trabajo (Opcional)" : "Trabajo activo (Opcional, permite saldo negativo)"}</option>
                       {activeOrPendingJobs.map(j => <option key={j.id} value={j.id}>{j.client} - {j.brand} ({j.plate || j.vin || 'S/N'})</option>)}
                    </select>
                    
                    <button disabled={isSubmitting} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-colors text-white disabled:opacity-50 shadow-md mt-2 ${adminTxType === 'assignment' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>{isSubmitting ? 'Procesando...' : `Confirmar ${adminTxType === 'assignment' ? 'Fondo' : 'Gasto'}`}</button>
                  </form>

                  <h4 className="font-extrabold text-slate-700 mb-3 flex items-center gap-2 text-sm"><ClipboardList className="w-4 h-4 text-slate-400"/> Historial de Movimientos</h4>
                  
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {expenses.filter(e => e.driverId === d.id).length === 0 ? (
                       <p className="text-slate-400 font-bold text-xs text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">Sin movimientos registrados.</p>
                    ) : expenses.filter(e => e.driverId === d.id).map(exp => (
                      <div key={exp.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex gap-3 items-start text-xs font-bold w-full overflow-hidden">
                        <div className="mt-1"><TransactionIcon type={exp.type}/></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 break-words">{exp.detail}</p>
                          <p className="text-[10px] text-slate-400 truncate">{safeDateRender(exp.createdAt)}</p>
                          {exp.receiptImage && <button type="button" onClick={(e) => { e.stopPropagation(); setViewingReceipt(exp.receiptImage); }} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver comprobante</button>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className={`font-extrabold text-sm ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                          {exp.type === 'pending_return' && <button type="button" onClick={(e) => { e.stopPropagation(); approveReturn(exp); }} className="ml-1 text-xs font-bold bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors">Aprobar</button>}
                          {exp.type !== 'pending_return' && (
                            <div className="flex gap-1 border-l border-slate-300 pl-2 ml-1">
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); }} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); delExp(exp); }} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                </div>
              )}
            </div>
          ))}
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
                <input type="file" accept="image/*" className="hidden" onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const dataUrl = await resizeImage(f, 500, 0.4); setReturnReceipt(dataUrl);}catch(e){showAlert("Error procesando foto");}}} />
                {returnReceipt ? (
                   <div className="relative z-10"><CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2 bg-white rounded-full"/><p className="text-sm font-extrabold text-green-700 mb-2">Comprobante Cargado</p><img src={returnReceipt} className="h-28 object-contain mx-auto rounded-lg shadow-sm border border-green-200" alt="preview"/><p className="text-xs font-bold text-slate-500 mt-3 underline">Cambiar foto</p></div>
                ) : (
                   <div className="py-4"><Camera className="w-10 h-10 text-slate-400 mx-auto mb-3"/><p className="text-sm font-extrabold text-slate-600">Sube aquí el comprobante</p></div>
                )}
              </label>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center"><p className="text-sm font-bold text-slate-600">Se registrará que entregaste el dinero en mano.</p></div>
            )}

            <div className="flex gap-4 mt-6"><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={submitReturn} disabled={isSubmittingReturn} className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-extrabold transition-all shadow-lg shadow-green-200 disabled:opacity-50">{isSubmittingReturn ? 'Enviando...' : 'Confirmar'}</button></div>
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
          <button type="submit" disabled={myBalance <= 0 || hasPendingReturn || isSubmitting} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-all ${myBalance > 0 && !hasPendingReturn && !isSubmitting ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{isSubmitting ? 'Procesando...' : 'Guardar Gasto'}</button>
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


function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail, showAlert, showConfirm, allClientsList, onLoadMore }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [jobToFail, setJobToFail] = useState(null);
  const [prtPromptJob, setPrtPromptJob] = useState(null); 
  const [relayPromptJob, setRelayPromptJob] = useState(null); 
  const [forceCloseJob, setForceCloseJob] = useState(null); 
  const [historyClientFilter, setHistoryClientFilter] = useState(''); 
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isInProgressOpen, setIsInProgressOpen] = useState(true);
  const [processingId, setProcessingId] = useState(null); 

  const updatePhase = async (job, phase, extra = {}) => {
    if (processingId) return;
    setProcessingId(`${job.id}-${phase}`);
    try { await updateDoc(doc(db, 'transport_jobs', job.id), { phase, ...extra }); } 
    catch (e) { console.error(e); showAlert("Error de conexión al actualizar fase."); }
    finally { setProcessingId(null); }
  }; 
  
  const now = new Date();
  const isAdminView = role === 'admin';
  
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

  const isToday = (timestamp) => {
      if (!timestamp) return false;
      const d = new Date(timestamp);
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const todayHistoryJobs = historyJobs.filter(j => isToday(j.completedAt || j.createdAt));
  const olderHistoryJobs = historyJobs.filter(j => !isToday(j.completedAt || j.createdAt));

  const pendingJobsList = activeJobs.filter(j => j.status === 'pending');
  const inProgressJobsList = activeJobs.filter(j => j.status === 'accepted');

  const handleAcceptJob = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-accept`);
    try { await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'accepted', acceptedByEmail: currentUserEmail }); } 
    catch (e) { console.error(e); }
    finally { setProcessingId(null); }
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
    const jsPDFModule = await import('jspdf');
    const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
    const docPDF = new JsPDFClass();

    const cleanStr = (str) => { if (!str) return ''; return String(str).replace(/➔/g, '->').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); };
    
    const fetchImageAsBase64 = async (url) => {
      if (!url) return null;
      if (url.startsWith('data:image')) return url;
      try {
        const res = await fetch(url, { mode: 'cors' });
        const blob = await res.blob();
        const fileBlob = new Blob([blob], { type: blob.type.includes('image') ? blob.type : 'image/jpeg' });
        return await new Promise(resolve => { 
          const reader = new FileReader(); 
          reader.onloadend = () => resolve(reader.result); 
          reader.readAsDataURL(fileBlob); 
        });
      } catch (e) { return null; }
    };

    const getImageDims = (src) => new Promise(resolve => { const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => resolve({ w: img.width, h: img.height }); img.onerror = () => resolve({ w: 85, h: 60 }); img.src = src; });
    const loadSimpleLogo = async (src) => { return new Promise((resolve) => { const img = new Image(); img.src = src; img.crossOrigin = "Anonymous"; img.onload = () => { const tempCanvas = document.createElement('canvas'); tempCanvas.width = img.width; tempCanvas.height = img.height; const ctx = tempCanvas.getContext('2d'); ctx.drawImage(img, 0, 0, img.width, img.height); resolve({ data: tempCanvas.toDataURL('image/png'), w: img.width, h: img.height }); }; img.onerror = () => resolve(null); setTimeout(() => resolve(null), 1500); }); };

    const photos = job.checklist?.photos || {};
    const otherPhotoKeys = Object.keys(photos).filter(k => k !== 'front' && typeof photos[k] === 'string' && photos[k]);

    const [logoApp, logoLogistica, frontPhotoStr, signatureStr, ...preloadedOtherPhotos] = await Promise.all([
      loadSimpleLogo('/logo.png'),
      loadSimpleLogo('/LogoLogistica.png'),
      fetchImageAsBase64(photos.front),
      fetchImageAsBase64(job.checklist?.signatureData),
      ...otherPhotoKeys.map(async (key) => {
         const base64Img = await fetchImageAsBase64(photos[key]);
         if (!base64Img) return null;
         const dims = await getImageDims(base64Img);
         return { key, base64Img, dims };
      })
    ]);

    const primaryColor = [30, 41, 59]; const secondaryColor = [100, 116, 139]; const accentColor = [37, 99, 235]; const lightBg = [248, 250, 252]; const borderColor = [226, 232, 240];

    const drawHeader = (titleText) => {
      docPDF.setFillColor(...primaryColor); docPDF.rect(0, 0, 210, 40, 'F');
      docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(18); docPDF.setFont("helvetica", "bold");
      docPDF.text(cleanStr(titleText), 105, 18, null, null, "center");
      docPDF.setFontSize(9); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(148, 163, 184);
      docPDF.text(`FECHA TRASLADO: ${formatDateDisplay(job.scheduledDate) || '-'}`, 105, 26, null, null, "center");
      docPDF.setFontSize(11); docPDF.setFont("times", "bolditalic"); docPDF.setTextColor(255, 255, 255);
      if (logoLogistica) { const ratio = logoLogistica.h / logoLogistica.w; let imgW = 35; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("Logística TS SpA", 27, 34, null, null, "center"); }
      if (logoApp) { const ratio = logoApp.h / logoApp.w; let imgW = 20; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("LogisticAPP", 183, 34, null, null, "center"); }
      docPDF.setFont("helvetica", "normal");
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
    const drawSectionTitle = (title, y) => { docPDF.setFillColor(...lightBg); docPDF.rect(15, y - 6, leftColWidth, 10, 'F'); docPDF.setDrawColor(...accentColor); docPDF.setLineWidth(1); docPDF.line(15, y - 6, 15, y + 4); docPDF.setTextColor(...primaryColor); docPDF.setFontSize(10); docPDF.setFont("helvetica", "bold"); docPDF.text(cleanStr(title).toUpperCase(), 20, y+1); return y + 10; };
    const drawKV = (label, value, x, y, maxW = 40) => { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(cleanStr(label).toUpperCase(), x, y); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const splitValue = docPDF.splitTextToSize(cleanStr(value), maxW); docPDF.text(splitValue, x, y + 4); return splitValue.length * 4; };

    let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "No registrado";
    if (job.acceptedByEmail) { const foundDriver = drivers?.find(d => d.email === job.acceptedByEmail); if (foundDriver) driverNameStr = foundDriver.name; }

    currentY = drawSectionTitle("1. Detalles del Vehiculo", currentY);
    let hC = drawKV("Cliente", `${job.client || 'Sin Cliente'}`, 15, currentY, 45);
    let hM = drawKV("Marca y Modelo", `${job.brand || '-'} ${job.model || '-'}`, 65, currentY, 45);
    currentY += Math.max(hC, hM) + 6;
    
    let plateText = job.plate || '-'; if (job.vin && job.vin !== job.plate) { plateText += ` / VIN: ${job.vin}`; }
    let hP = drawKV("Patente / VIN", plateText, 15, currentY, 45);
    let hD = drawKV("Conductor", driverNameStr, 65, currentY, 45);
    currentY += Math.max(hP, hD) + 6;
    
    let routeText = `${job.origin || '-'}  ->  ${job.destination || '-'}`;
    if (job.tripType === 'revision') { if (job.checklist?.rtStatus === 'aprobado') { const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin; routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`; } else if (job.checklist?.rtStatus === 'rechazado') { routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`; } else { routeText = `${job.origin || '-'}  ->  PRT`; } }
    let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
    currentY += routeH + 8;

    currentY = drawSectionTitle("2. Recepcion y Estado", currentY);
    const getDocStatus = (docKey) => { const isOk = job.checklist?.docs?.[docKey]; const expDate = job.checklist?.docsExpiry?.[docKey]; if (!isOk) return 'FALTA'; if (expDate) { const [y, m, d] = expDate.split('-'); return `AL DIA (Vence: ${d}/${m}/${y})`; } return 'AL DIA'; };
    let hFuel = drawKV("Combustible", `${job.checklist?.fuelLevel || '0'}%`, 15, currentY, 45);
    let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
    currentY += Math.max(hFuel, hSoap) + 6;
    let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
    let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
    currentY += Math.max(hPerm, hRev) + 6;
    let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
    currentY += hGas + 8;

    docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("OBSERVACIONES:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth); docPDF.text(obsSplit, 15, currentY + 4); currentY += (obsSplit.length * 4) + 8;
    if (job.waitTimeMinutes && job.waitTimeMinutes > 20) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38); const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA EN ORIGEN: ${job.waitTimeMinutes} minutos`, leftColWidth); docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2; } else if (job.checklist?.hasWaitTime) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);  const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);  docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;  }
    if (job.checklist?.hasFuelCharge) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235); const fcStr = docPDF.splitTextToSize(`CARGA DE COMBUSTIBLE: ${cleanStr(job.checklist.fuelChargeAmount || 'Sí')}`, leftColWidth); docPDF.text(fcStr, 15, currentY); currentY += (fcStr.length * 4) + 2; }

    let sectionNum = 3;
    if (job.tripType === 'revision') { currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY); if (job.checklist?.rtStatus === 'aprobado') { docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); docPDF.text("APROBADO", 15, currentY + 6); currentY += 18; } else { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); docPDF.text("RECHAZADO", 15, currentY + 6); docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27); const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth); docPDF.text(rejSplit, 15, currentY + 12); currentY += 20 + (rejSplit.length * 4); } sectionNum++; }

    currentY = drawSectionTitle(`${sectionNum}. Conformidad Entrega`, currentY);
    if (job.checklist?.noReception) { 
      docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(9); const nrSplit = docPDF.splitTextToSize("ENTREGA SIN RECEPCION (Confirmada por conductor en terreno)", leftColWidth); docPDF.text(nrSplit, 15, currentY + 4); currentY += (nrSplit.length * 4) + 6; 
    } else { 
      drawKV("Receptor", `${job.checklist?.receiverName || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; 
      drawKV("RUT", `${job.checklist?.receiverRut || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; 
      if (job.checklist?.clientComments) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("COMENTARIOS:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const commSplit = docPDF.splitTextToSize(cleanStr(job.checklist.clientComments), leftColWidth); docPDF.text(commSplit, 15, currentY + 4); currentY += (commSplit.length * 4) + 6; } 
      if(signatureStr) { 
        docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("FIRMA DE CONFORMIDAD:", 15, currentY); 
        try { docPDF.addImage(signatureStr, 'JPEG', 15, currentY + 2, 45, 25); } catch(e) { try { docPDF.addImage(signatureStr, 'PNG', 15, currentY + 2, 45, 25); } catch(err){} }
        currentY += 30; 
      } 
    }
    
    if (job.checklist?.location) { currentY += 2; const { lat, lng } = job.checklist.location; docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(`UBICACION GPS:`, 15, currentY); docPDF.setFontSize(9); docPDF.setTextColor(...accentColor); docPDF.textWithLink('Clic aqui para ver mapa en Google', 15, currentY + 4, { url: `https://maps.google.com/?q=${lat},${lng}` }); }

    if (frontPhotoStr) { 
      try { 
        const dims = await getImageDims(frontPhotoStr); const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; } const rightX = 115; const rightY = startY + 6; docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" }); 
        try { docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH); } catch(e) { docPDF.addImage(frontPhotoStr, 'PNG', rightX, rightY + 2, imgW, imgH); }
      } catch (err) { console.error("Error al incrustar foto frontal:", err); } 
    }

    const addFooter = () => { const pageCount = docPDF.internal.getNumberOfPages(); for(let i = 1; i <= pageCount; i++) { docPDF.setPage(i); docPDF.setFontSize(8); docPDF.setTextColor(148, 163, 184); docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center"); } }

    if (preloadedOtherPhotos.length > 0) {
      const labels = { left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', interior_front: 'Int. Adelante', interior_back: 'Int. Atras', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4', det5: 'Detalle 5', det6: 'Detalle 6', det7: 'Detalle 7', det8: 'Detalle 8' };
      let photoY = 46; let currentCol = 1; let addedPage = false;
      const detailPins = job.checklist?.detailPins || [];
      if (detailPins.length > 0) { docPDF.addPage(); drawHeader("ESQUEMA DE DAÑOS Y DETALLES"); addedPage = true; const mapX = 75; const mapY = 50; const mapW = 60; const mapH = 100; docPDF.setFillColor(248, 250, 252); docPDF.roundedRect(mapX, mapY, mapW, mapH, 3, 3, 'F'); docPDF.setDrawColor(203, 213, 225); docPDF.roundedRect(mapX, mapY, mapW, mapH, 3, 3, 'S'); const vType = job.checklist.vehicleType || 'auto'; const vx = mapX + 10; const vw = mapW - 20; const vy = mapY + 10; const vh = mapH - 20; docPDF.setFillColor(203, 213, 225); docPDF.setDrawColor(148, 163, 184); docPDF.setLineWidth(1); if (vType === 'camioneta') { docPDF.roundedRect(vx, vy, vw, vh*0.35, 3, 3, 'FD'); docPDF.setFillColor(71, 85, 105); docPDF.rect(vx+4, vy+4, vw-8, 6, 'F'); docPDF.setFillColor(226, 232, 240); docPDF.roundedRect(vx+2, vy+vh*0.38, vw-4, vh*0.62, 2, 2, 'FD'); } else if (vType === 'camion') { docPDF.setFillColor(191, 219, 254); docPDF.roundedRect(vx-2, vy, vw+4, vh*0.2, 2, 2, 'FD'); docPDF.setFillColor(226, 232, 240); docPDF.roundedRect(vx, vy+vh*0.22, vw, vh*0.78, 1, 1, 'FD'); } else { docPDF.roundedRect(vx, vy, vw, vh, 6, 6, 'FD'); docPDF.setFillColor(71, 85, 105); docPDF.rect(vx+4, vy+8, vw-8, 8, 'F'); docPDF.rect(vx+4, vy+vh-12, vw-8, 6, 'F'); } detailPins.forEach(pin => { const px = vx + (vw * (pin.x / 100)); const py = vy + (vh * (pin.y / 100)); docPDF.setFillColor(239, 68, 68); docPDF.circle(px, py, 3.5, 'F'); docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(8); docPDF.text(pin.id.replace('det', ''), px, py + 1.2, {align: 'center', baseline: 'middle'}); }); docPDF.setFontSize(9); docPDF.setTextColor(100, 116, 139); docPDF.text("Los numeros en rojo corresponden a las fotos de detalle del anexo:", 105, 165, null, null, "center"); photoY = 180; }
      
      // DIBUJAR OTRAS FOTOS PRE-CARGADAS
      for (const item of preloadedOtherPhotos) { 
        if (!item) continue;
        const { key, base64Img, dims } = item;
        if (!addedPage) { docPDF.addPage(); drawHeader("ANEXO FOTOGRAFICO"); addedPage = true; } 
        try { 
          const ratio = dims.h / dims.w; let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; } const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2); if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); } docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text((labels[key] || key).toUpperCase(), slotCenter, photoY - 3, { align: "center" }); 
          try { docPDF.addImage(base64Img, 'JPEG', finalX, photoY + 2, imgW, imgH); } catch(e) { docPDF.addImage(base64Img, 'PNG', finalX, photoY + 2, imgW, imgH); }
          if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; } 
        } catch (err) { console.error("Error al incrustar la foto:", key, err); } 
      }
    }

    addFooter();
    return docPDF;
  };

  const getDStr = j => j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0]);
  
  const getExtraWappTxt = (j) => {
    let t = '';
    if (j.checklist?.hasWaitTime) t += `\nTIEMPO DE ESPERA: ${j.checklist.waitTime || 'Sí'}`;
    if (j.checklist?.hasFuelCharge) {
       const fuelCost = Number(j.checklist.fuelChargeAmount);
       t += `\nCARGA DE COMBUSTIBLE: ${fuelCost ? formatMoney(fuelCost) : 'Sí'}`;
    }
    
    // --- NUEVO: SUMAR Y MOSTRAR VALOR DE REVISIÓN TÉCNICA ---
    if (j.tripType === 'revision') {
      const prtTotal = Number(j.checklist?.prtCostRevision || 0) + Number(j.checklist?.prtCostInspeccion || 0) + Number(j.checklist?.prtCostFrenos || 0);
      if (prtTotal > 0) {
        t += `\nVALOR PRT: ${formatMoney(prtTotal)}`;
      }
    }
    
    return t;
  };

  const handleCopyWhatsApp = (job) => { 
    const dateStr = getDStr(job);
    const dateShort = dateStr.substring(0, 5); 
    const text = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}${getExtraWappTxt(job)}`; 
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); showAlert("✅ Formato copiado al portapapeles. Listo para pegar en WhatsApp."); } catch (err) { showAlert("Tu navegador bloqueó el copiado automático."); }
    document.body.removeChild(textArea);
    setMenuOpenId(null); 
  };
  const cpyWapp = handleCopyWhatsApp; 

  const generatePDF = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-pdf`);
    try { const docPDF = await buildPDFDoc(job); const cleanPlate = job.plate || job.vin || 'SN'; const fileName = `Check.${getDStr(job).replace(/\//g, '-')}.${(job.client || 'SinCliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; docPDF.save(fileName); } catch(e) { console.error(e); showAlert("Hubo un error al generar PDF."); }
    finally { setProcessingId(null); }
  };

  const handleShareWhatsAppPDF = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-wapp`);
    try {
      const dateStrForFile = getDStr(job).replace(/\//g, '-');
      const dateShort = getDStr(job).substring(0, 5);
      const cleanPlate = job.plate || job.vin || 'SN';
      const fileName = `Check.${dateStrForFile}.${(job.client || 'SinCliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`;
      
      const textToShare = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}${getExtraWappTxt(job)}`;
      
      const docPDF = await buildPDFDoc(job); 
      const pdfBlob = docPDF.output('blob'); 
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Copiamos el texto de forma 100% SILENCIOSA para no interrumpir el hilo
      const textArea = document.createElement("textarea");
      textArea.value = textToShare;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);

      // COMPARTIR NATIVO: DIRECTO Y SIN ALERTAS PREVIAS
      if (navigator.canShare && navigator.canShare({ files: [file] })) { 
         await navigator.share({ 
           title: fileName, 
           text: textToShare, // Enviamos el texto también como metadata
           files: [file] 
         }); 
      } else { 
         showAlert("Tu dispositivo no soporta compartir el archivo directamente. Descárgalo primero."); 
         handleCopyWhatsApp(job); 
      }
    } catch (e) { 
      console.error("Compartir cancelado o fallido:", e); 
    } finally { 
      setProcessingId(null); 
    }
  };

  // --- TARJETAS MODULARES PARA KANBAN ---
  const renderActiveJobCard = (j) => {
    const isPending = j.status === 'pending';
    const isAccepted = j.status === 'accepted';
    const phase = j.phase || 'claimed'; 
    const step2Done = isAccepted && ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
    const step3Done = isAccepted && ['arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
    const step4Done = isAccepted && phase === 'prt_done';

    return (
      <div key={j.id} className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 flex flex-col shadow-sm relative hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 overflow-hidden cursor-default">
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isPending ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
        
        {/* --- NUEVO ENCABEZADO: PATENTE/VIN COMPLETO --- */}
        <div className="flex justify-between items-start mb-5 border-b border-slate-100 pb-4 pl-2">
          <div className="flex flex-col gap-3 w-full">
            <div className="flex justify-between items-start w-full gap-2">
              
              {/* Bloque de Patente y VIN combinado (Inteligente) */}
              <div className="shrink-0 relative z-20 flex flex-col items-end gap-1">
                <LicensePlateBadge text={j.plate || j.vin} />
                {j.vin && j.plate && j.vin !== j.plate && (
                  <span className="text-[9px] font-black bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm mr-1">VIN: {j.vin}</span>
                )}
              </div>
              
              {/* Botones de Acción (Editar y Menú) alineados a la derecha */}
              <div className="flex items-center gap-1 relative shrink-0">
                {isAdminView && <button onClick={()=>onEditJob(j)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-5 h-5"/></button>}
                <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"><MoreVertical className="w-5 h-5"/></button>
                {menuOpenId===j.id && (
                  <div className="absolute right-0 top-10 bg-white border shadow-2xl rounded-xl w-48 z-50 overflow-hidden text-xs">
                    <button onClick={() => {
                      const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                      const textToShare = `📍 Sigue en tiempo real todos los traslados de ${j.client || 'tu empresa'} aquí:\n${url}`;
                      const textArea = document.createElement("textarea");
                      textArea.value = textToShare; textArea.style.position = "fixed"; document.body.appendChild(textArea);
                      textArea.focus(); textArea.select();
                      try { document.execCommand('copy'); showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!"); } catch(e) {}
                      document.body.removeChild(textArea); setMenuOpenId(null);
                    }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-blue-50 text-blue-600"><Navigation className="w-4 h-4"/> Portal Cliente</button>
                    
                    {/* IDEA 10: Botón Notificar Receptor WhatsApp */}
                    {isAccepted && (
                      <button onClick={() => {
                        const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                        const textToShare = `📍 Hola! El vehículo patente ${j.plate || j.vin || 'S/N'} va en camino a ${j.destination || 'su destino'}. Puedes seguir el traslado en tiempo real aquí:\n${url}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank');
                        setMenuOpenId(null);
                      }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-green-50 text-green-600 border-t border-slate-50"><Share2 className="w-4 h-4"/> Notificar Receptor</button>
                    )}

                    {/* NUEVO: Botón de Traspaso en Ruta (Modo Posta) */}
                    {isAccepted && (j.phase === 'picked_up' || !j.phase) && (
                      <button onClick={() => {
                        setRelayPromptJob(j); 
                        setMenuOpenId(null);
                      }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-purple-50 text-purple-600 border-t border-slate-50"><Users className="w-4 h-4"/> Traspaso a Compañero</button>
                    )}
                    
                    {/* NUEVO: Botón de Cierre Forzado para el Admin */}
                    {isAdminView && (
                      <button onClick={() => { setForceCloseJob(j); setMenuOpenId(null); }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-emerald-50 text-emerald-600 border-t border-slate-50">
                        <CheckCircle className="w-4 h-4"/> Forzar Cierre
                      </button>
                    )}

                    <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-slate-50 border-t border-slate-50"><Copy className="w-4 h-4"/> Copiar Resumen</button>
                    
                    {/* NUEVA OPCIÓN: CANCELAR ACEPTACIÓN (SOLTAR TRASLADO) */}
                    {isAccepted && (!j.phase || j.phase === 'claimed' || j.phase === 'arrived_pickup') && (
                      <button 
                        onClick={() => {
                          showConfirm("¿Deseas cancelar la aceptación de este traslado? Volverá a estar disponible para que lo tome otro conductor.", async () => {
                            try {
                              // Devolvemos el estado a pendiente y borramos los campos del chofer actual usando deleteField()
                              await updateDoc(doc(db, 'transport_jobs', j.id), {
                                status: 'pending',
                                acceptedByEmail: deleteField(),
                                phase: deleteField(),
                                liveLocation: deleteField(),
                                arrivedPickupAt: deleteField(),
                                waitTimeMinutes: deleteField()
                              });
                              setMenuOpenId(null);
                              showAlert("✅ Traslado liberado con éxito. Volvió a la lista de espera.");
                            } catch (err) {
                              console.error(err);
                              showAlert("Error al intentar liberar el traslado.");
                            }
                          });
                        }} 
                        className="w-full text-left p-3 font-bold flex gap-2 text-amber-600 hover:bg-amber-50 border-t border-slate-50"
                      >
                        <X className="w-4 h-4"/> Cancelar Aceptación (Soltar)
                      </button>
                    )}

                    <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t border-slate-50"><XCircle className="w-4 h-4"/> Cancelar / Falló</button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Información de Marca, Modelo y Cliente restaurada */}
            <div>
                <p className="text-xl font-black text-slate-800 leading-tight mt-1">{j.brand} {j.model}</p>
                <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wide">{j.client}</p>
              </div>
            </div>
          </div>

          {/* NUEVO: BLOQUE DE RUTA LOGÍSTICA DESTACADO */}
          <div className="bg-slate-100 p-3 rounded-2xl border-2 border-slate-200 mb-4 mt-1 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Desde</span>
                <p className="text-sm font-extrabold text-slate-800 truncate">{j.origin || 'Por definir'}</p>
              </div>
              <div className="text-slate-400 font-black text-sm px-2">➔</div>
              <div className="flex-1 min-w-0 text-right">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Hasta</span>
                <p className="text-sm font-extrabold text-blue-600 truncate">
                  {j.tripType === 'revision' ? 'Planta PRT' : (j.destination || 'Por definir')}
                </p>
              </div>
            </div>
          </div>

          {j.tripType === 'revision' && <div className="mb-3 bg-amber-50 border border-amber-200 p-2 rounded-xl text-center"><span className="text-[10px] font-black text-amber-700 uppercase">REVISIÓN TÉCNICA (TIPO {j.rtData?.type})</span></div>}
        {j.tripType === 'viaje' && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-2 mb-3 text-center text-xs font-bold text-indigo-700 uppercase">A Regiones</div>}

        <div className="relative pl-7 space-y-5 before:absolute before:inset-y-2 before:left-[10px] before:w-0.5 before:bg-slate-100 flex-1 mb-5">
          <div className="relative"><div className="absolute -left-7 bg-blue-500 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center"><CheckCircle className="w-2.5 h-2.5 text-white"/></div><p className="font-extrabold text-slate-800 text-[11px] leading-tight">{isAccepted ? (j.assignedDrivers?.find(d => d.email === j.acceptedByEmail)?.name || "Conductor") : "Buscando conductor"}</p><p className="text-[9px] font-bold text-slate-500">{isAccepted ? `Retira en ${j.origin}` : `Para ${j.origin}`}</p></div>
          <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step2Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step2Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-[11px] leading-tight ${step2Done ? 'text-slate-800' : 'text-slate-400'}`}>Vehículo en Tránsito</p></div>
          <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step3Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step3Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-[11px] leading-tight ${step3Done ? 'text-slate-800' : 'text-slate-400'}`}>{j.tripType === 'revision' ? 'En PRT' : 'Llegada a Destino'}</p><p className={`text-[9px] font-bold ${step3Done ? 'text-blue-600' : 'text-slate-400'}`}>{j.tripType === 'revision' ? 'Planta' : j.destination}</p></div>
          
          {j.tripType === 'revision' && (
            <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step4Done ? (j.prt_result === 'rechazado' ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-200'}`}>{step4Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-[11px] leading-tight ${step4Done ? (j.prt_result === 'rechazado' ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>Resultado Revisión</p>{step4Done && <p className={`text-[9px] font-bold ${j.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-600'}`}>{j.prt_result === 'rechazado' ? `Rechazado` : 'Aprobado'}</p>}</div>
          )}
          {j.tripType === 'revision' && step4Done && (
            <div className="relative"><div className="absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center bg-blue-500"><div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div></div><p className="font-extrabold text-[11px] text-slate-800 leading-tight">Camino a destino</p></div>
          )}
        </div>

        {/* ALERTA DE TIEMPO DE ESPERA EN VIVO PARA EL CONDUCTOR/ADMIN */}
        {j.phase === 'arrived_pickup' && j.arrivedPickupAt && <WaitTimerBadge arrivedAt={j.arrivedPickupAt} role={role} />}

        {j.liveLocation && j.phase === 'picked_up' && (
          <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 h-28 pointer-events-none relative shadow-inner">
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md z-10 flex items-center gap-1.5 shadow-sm"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span><span className="text-[8px] font-black text-slate-700 uppercase tracking-wider">En vivo</span></div>
            <iframe width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${j.liveLocation.lat},${j.liveLocation.lng}&z=15&output=embed`}></iframe>
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
          {/* Botón directo deslizable para reclamar el traslado */}
          {isPending && (!isAdminView || j.assignedEmails?.includes(currentUserEmail)) && (
            <SwipeButton key={`btn-accept-${j.id}`} onConfirm={() => handleAcceptJob(j)} text="Desliza para Aceptar" colorClass="bg-blue-600" isProcessing={processingId === `${j.id}-accept`} />
          )}

          {isAccepted && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
            <>
              {(!j.phase || j.phase === 'claimed') && <SwipeButton key={`btn-pickup-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_pickup', { arrivedPickupAt: Date.now() })} text="Desliza: Llegué a retirar" icon={<MapPin className="w-4 h-4"/>} colorClass="bg-amber-500" isProcessing={processingId === `${j.id}-arrived_pickup`} />}
              {j.phase === 'arrived_pickup' && <SwipeButton key={`btn-power-${j.id}`} onConfirm={()=>{
                const waitMins = j.arrivedPickupAt ? Math.floor((Date.now() - j.arrivedPickupAt) / 60000) : 0;
                updatePhase(j, 'picked_up', { pickedUpAt: Date.now(), waitTimeMinutes: waitMins });
              }} text="Desliza: Vehículo en mi poder" icon={<Car className="w-4 h-4"/>} colorClass="bg-indigo-600" isProcessing={processingId === `${j.id}-picked_up`} />}
              {j.phase === 'picked_up' && j.tripType !== 'revision' && <SwipeButton key={`btn-dest-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_destination')} text="Desliza: Llegué a Destino" icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${j.id}-arrived_destination`} />}
              {j.phase === 'picked_up' && j.tripType === 'revision' && <SwipeButton key={`btn-prt-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_prt')} text="Desliza: Llegué a PRT" icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${j.id}-arrived_prt`} />}
              
              {j.phase === 'arrived_prt' && (
                <div className="flex gap-2">
                  <button onClick={()=>updatePhase(j, 'prt_done', { prt_result: 'aprobado' })} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-1 disabled:opacity-50">
                     {processingId === `${j.id}-prt_done` ? <Clock className="w-3 h-3 animate-spin"/> : '✅'} {processingId === `${j.id}-prt_done` ? 'Guardando...' : 'Aprobado'}
                  </button>
                  <button onClick={()=>setPrtPromptJob(j)} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50">❌ Rechazado</button>
                </div>
              )}

              <button onClick={()=>onStartChecklist(j)} className={`w-full font-bold py-2 rounded-xl text-xs shadow-sm transition-colors ${(j.phase === 'arrived_destination' || j.phase === 'prt_done') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}>
                📸 {(j.phase === 'arrived_destination' || j.phase === 'prt_done') ? 'Cerrar Checklist' : 'Pre-llenar Checklist'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderHistoryJobCard = (j) => {
    const drv = drivers?.find(d => d.email === j.acceptedByEmail);
    const driverName = drv ? drv.name : (j.checklist?.assignedDriverName || j.acceptedByEmail || 'No registrado');
    const isFailed = j.status === 'failed';
    
    return (
      <div key={j.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative pl-5 overflow-hidden hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-default">
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
        <div className="flex justify-between items-start mb-2 gap-2">
          <p className="text-sm font-black text-slate-800 leading-tight truncate mt-1">{j.brand} {j.model}</p>
          <div className="flex flex-col items-end shrink-0 gap-1">
            <LicensePlateBadge text={j.plate || j.vin} />
            {j.vin && j.plate && j.vin !== j.plate && (
              <span className="text-[8px] font-black bg-slate-100 border border-slate-200 text-slate-500 px-1 py-[1px] rounded uppercase tracking-widest mr-1">VIN: {j.vin}</span>
            )}
          </div>
        </div>
        {/* NUEVO: DISEÑO COMPACTO DE HISTORIAL MEJORADO */}
        <div className="my-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs font-black flex items-center justify-between gap-1">
          <span className="truncate text-slate-700 dark:text-slate-300 max-w-[45%]"><MapPin className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-slate-400 shrink-0"/>{j.origin}</span>
          <span className="text-slate-400 font-bold shrink-0">➔</span>
          <span className="truncate text-blue-600 dark:text-blue-400 max-w-[45%] text-right">{j.tripType === 'revision' ? 'PRT' : j.destination}</span>
        </div>
        <div className="mb-3">
           <p className="text-blue-600 font-extrabold text-[10px] uppercase tracking-wide truncate">Conductor: <span className="text-slate-700">{driverName}</span></p>
           {isFailed && <p className="text-red-600 text-[10px] mt-0.5 font-bold line-clamp-1">Razón: {j.failedReason}</p>}
        </div>
        <div className="flex justify-between items-end border-t border-slate-50 pt-2 mb-2">
          <p className={`text-[10px] font-black uppercase ${isFailed ? 'text-red-500' : 'text-green-600'}`}>{isFailed ? 'RECHAZADO' : 'ENTREGADO'}</p>
          <p className="text-slate-400 font-bold text-[9px]">{getDStr(j)}</p>
        </div>
        <div className="flex gap-1.5 mt-auto">
          {isAdminView && <button onClick={()=>onEditJob(j)} className="flex-1 py-1.5 flex justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors" title="Editar Traslado"><Edit2 className="w-3.5 h-3.5"/></button>}
          <button onClick={()=>cpyWapp(j)} className="flex-1 py-1.5 flex justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Copiar Resumen"><Copy className="w-3.5 h-3.5"/></button>
          <button onClick={() => generatePDF(j)} disabled={processingId === `${j.id}-pdf`} className="flex-1 py-1.5 flex justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50" title="Descargar PDF">{processingId === `${j.id}-pdf` ? <Clock className="w-3.5 h-3.5 animate-spin"/> : <FileDown className="w-3.5 h-3.5"/>}</button>
          {/* BOTÓN WHATSAPP OFICIAL CON SPINNER */}
          <button onClick={() => handleShareWhatsAppPDF(j)} disabled={processingId === `${j.id}-wapp`} className="flex-1 py-1.5 flex justify-center items-center bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50" title="Compartir PDF por WhatsApp">
            {processingId === `${j.id}-wapp` ? <Clock className="w-3.5 h-3.5 animate-spin"/> : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.005-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
              </svg>
            )}
          </button>
          {isAdminView && <button onClick={()=>handleDeleteJob(j.id)} className="flex-1 py-1.5 flex justify-center bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar Traslado"><Trash2 className="w-3.5 h-3.5"/></button>}
        </div>
      </div>
    );
  };

  // MOTOR DE DESCARGA MASIVA EN ZIP (OPCIÓN B)
  const handleDownloadAllZIP = async () => {
    const jobsWithChecklist = historyJobs.filter(j => j.checklist);
    if (jobsWithChecklist.length === 0) return showAlert("No hay actas finalizadas con checklist en este filtro para empaquetar.");
    
    showAlert("⏳ Iniciando compresión del lote de actas... Por favor espera un momento.");
    
    try {
      // Carga ultra-segura de JSZip vía CDN para evitar bloqueos en Vercel
      const JSZip = await new Promise((resolve) => {
        if (window.JSZip) return resolve(window.JSZip);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        document.body.appendChild(script);
      });
      
      const zip = new JSZip();
      
      // Procesamos secuencialmente cada PDF y lo inyectamos al contenedor virtual
      for (const job of jobsWithChecklist) {
        const docPDF = await buildPDFDoc(job);
        const pdfBlob = docPDF.output('blob');
        const cleanPlate = job.plate || job.vin || 'SN';
        const dateStrForFile = getDStr(job).replace(/\//g, '-');
        const fileName = `Check.${dateStrForFile}.${(job.client || 'SinCliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`;
        zip.file(fileName, pdfBlob);
      }
      
      // Generamos el binario final descargable
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Actas_LogisticAPP_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showAlert("✅ ¡Archivo ZIP generado y descargado con éxito!");
    } catch (err) {
      console.error("Error comprimiendo actas:", err);
      showAlert("Ocurrió un error inesperado al procesar el archivo comprimido.");
    }
  };

  return (
    <div className="pb-16">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search className="w-5 h-5 text-slate-400" />
           </div>
           <input type="text" placeholder="Buscar por patente, marca, modelo o cliente..." className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        {isAdminView && (
          <button type="button" onClick={handleDownloadAllZIP} className="group bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-200 shrink-0">
            <FileDown className="w-5 h-5"/> Descargar Lote ZIP
          </button>
        )}
      </div>

      {/* VISTA KANBAN CON COLUMNAS DESPLEGABLES */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* COLUMNA 1: EN CURSO */}
        <div className="w-full md:w-1/2 flex flex-col bg-blue-50/50 md:bg-transparent rounded-3xl md:border md:border-blue-100/60 overflow-hidden">
          <button onClick={() => setIsInProgressOpen(!isInProgressOpen)} className="w-full flex justify-between items-center p-4 bg-blue-50 md:bg-transparent hover:bg-blue-100/50 transition-colors">
            <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600"/> 
                <h3 className="font-extrabold text-slate-800">En Curso</h3>
                <span className="bg-blue-100 text-blue-700 text-xs font-black px-2 py-0.5 rounded-full">{inProgressJobsList.length}</span>
            </div>
            {isInProgressOpen ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
          </button>
          
          <div className={`transition-all duration-300 ${isInProgressOpen ? 'opacity-100 max-h-[5000px] p-4 pt-0 md:pt-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>
            <div className="flex flex-col gap-4">
              {inProgressJobsList.map(j => renderActiveJobCard(j))}
              {inProgressJobsList.length === 0 && <p className="text-center text-sm font-bold text-blue-400 py-8 border-2 border-dashed border-blue-200 rounded-2xl">Ningún vehículo en ruta</p>}
            </div>
          </div>
        </div>

        {/* COLUMNA 2: PENDIENTES */}
        <div className="w-full md:w-1/2 flex flex-col bg-slate-100/50 md:bg-transparent rounded-3xl md:border md:border-slate-200/60 overflow-hidden mt-2 md:mt-0">
          <button onClick={() => setIsPendingOpen(!isPendingOpen)} className="w-full flex justify-between items-center p-4 bg-slate-100 md:bg-transparent hover:bg-slate-200/50 transition-colors">
            <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500"/> 
                <h3 className="font-extrabold text-slate-700">Pendientes</h3>
                <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">{pendingJobsList.length}</span>
            </div>
            {isPendingOpen ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
          </button>
          
          <div className={`transition-all duration-300 ${isPendingOpen ? 'opacity-100 max-h-[5000px] p-4 pt-0 md:pt-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>
            <div className="flex flex-col gap-4">
              {pendingJobsList.map(j => renderActiveJobCard(j))}
              {pendingJobsList.length === 0 && <p className="text-center text-sm font-bold text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-2xl">Sin pendientes</p>}
            </div>
          </div>
        </div>

      </div>

      {/* COLUMNA 3: FINALIZADOS (AHORA ABAJO) */}
      <div className="mt-10">
          <h3 className="font-extrabold text-slate-700 flex items-center gap-2 mb-4 border-b-2 border-slate-100 pb-2">
              <CheckCircle className="w-5 h-5 text-green-600"/> Finalizados de Hoy
              <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-0.5 rounded-full">{todayHistoryJobs.length}</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {todayHistoryJobs.map(j => renderHistoryJobCard(j))}
              {todayHistoryJobs.length === 0 && <p className="text-sm font-bold text-slate-400 col-span-full">Aún no hay traslados completados hoy.</p>}
          </div>

          {olderHistoryJobs.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Historial Anterior</h4>
                      <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">{olderHistoryJobs.length} registros</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                      {olderHistoryJobs.map(j => {
                          const isFailed = j.status === 'failed';
                          return (
                              <div key={j.id} className="p-2 sm:p-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between transition-colors gap-2 sm:gap-0">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                      <div className="flex flex-col min-w-0">
                                          <div className="flex items-center gap-2">
                                              <p className="text-xs font-black text-slate-800 truncate">{j.brand} {j.model}</p>
                                              <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase">{j.plate || j.vin || 'S/N'}</span>
                                          </div>
                                          <p className="text-[10px] font-bold text-slate-500 truncate">{j.origin} ➔ {j.destination}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                      <span className="text-[9px] font-bold text-slate-400 mr-2">{new Date(j.completedAt || j.createdAt).toLocaleDateString('es-CL')}</span>
                                      {isAdminView && <button onClick={()=>onEditJob(j)} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md transition-colors" title="Editar Traslado"><Edit2 className="w-3.5 h-3.5"/></button>}
                                      <button onClick={()=>cpyWapp(j)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"><Copy className="w-3.5 h-3.5"/></button>
                                      <button onClick={() => generatePDF(j)} className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors"><FileDown className="w-3.5 h-3.5"/></button>
                                      {/* BOTÓN WHATSAPP OFICIAL CON SPINNER COMPACTO */}
                                      <button onClick={() => handleShareWhatsAppPDF(j)} disabled={processingId === `${j.id}-wapp`} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50">
                                        {processingId === `${j.id}-wapp` ? <Clock className="w-3.5 h-3.5 animate-spin"/> : (
                                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.005-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                                          </svg>
                                        )}
                                      </button>
                                      {isAdminView && <button onClick={()=>handleDeleteJob(j.id)} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  {/* NUEVO BOTÓN: CARGAR MÁS TRASLADOS */}
                  <button onClick={onLoadMore} className="w-full bg-slate-50 hover:bg-slate-100 text-blue-600 font-bold text-sm py-4 transition-colors border-t border-slate-200 shadow-inner">
                      Cargar más traslados antiguos...
                  </button>
              </div>
          )}
      </div>


      {jobToFail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleFailJob(jobToFail, e.target.reason.value); }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5"><XCircle className="text-red-500"/> ¿Por qué falló el traslado?</h3>
            <textarea name="reason" required placeholder="Escribe el motivo del fallo o cancelación aquí..." className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none focus:border-red-500" rows="3"></textarea>
            <div className="flex gap-3"><button type="button" onClick={()=>setJobToFail(null)} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold text-sm text-slate-600">Volver</button><button type="submit" className="flex-[2] py-2 bg-red-600 text-white rounded-xl font-bold text-sm shadow-md">Confirmar Fallo</button></div>
          </form>
        </div>
      )}

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

      {/* NUEVO: MODAL QR PARA TRASPASO EN RUTA */}
      {relayPromptJob && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 border border-slate-100">
            <button type="button" onClick={() => setRelayPromptJob(null)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-700"/></button>
            <h3 className="text-xl font-black text-slate-800 mb-1">Traspaso a Compañero</h3>
            <p className="text-xs font-bold text-slate-500 mb-5">Pide al otro conductor que escanee este código con la cámara de su celular para entregarle el auto.</p>
            
            <div className="bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-inner inline-block">
              {/* Generamos QR único que apunta al link de relay */}
              <img src={`https://quickchart.io/qr?size=250&margin=1&text=${encodeURIComponent(`${window.location.origin}/?relay=${relayPromptJob.id}`)}`} alt="QR Relevo" className="w-48 h-48 mx-auto" />
            </div>
            
            <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">O envíale el link por WhatsApp:</p>
              <button onClick={() => {
                 const link = `${window.location.origin}/?relay=${relayPromptJob.id}`;
                 const text = `🔑 Toma mi relevo del vehículo ${relayPromptJob.plate || relayPromptJob.vin} abriendo este link: ${link}`;
                 window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }} className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-sm shadow-md transition-colors flex justify-center items-center gap-2"><Share2 className="w-4 h-4"/> Enviar Link a Compañero</button>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO: MODAL DE CIERRE FORZADO PARA EL ADMIN */}
      {forceCloseJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col max-h-[80vh] animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-500"/> Asignar y Finalizar</h3>
                 <button onClick={()=>setForceCloseJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4"/></button>
              </div>
              <p className="text-sm font-bold text-slate-500 mb-4 pb-4 border-b border-slate-100">Selecciona al conductor que realizó este traslado. El acta se cerrará automáticamente a su nombre (como entrega sin recepción).</p>
              
              <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                 {drivers.map(d => (
                    <button key={d.id} onClick={async () => {
                       showConfirm(`¿Guardar el traslado de la patente ${forceCloseJob.plate || forceCloseJob.vin} a nombre de ${d.name}?`, async () => {
                          try {
                             // Creamos el checklist exactamente igual a como lo haría el chofer marcando "Dejar sin firma"
                             const mockChecklist = {
                                client: forceCloseJob.client || '', brand: forceCloseJob.brand || '', model: forceCloseJob.model || '', 
                                plateOrVin: forceCloseJob.plate || forceCloseJob.vin || '', origin: forceCloseJob.origin || '', 
                                destination: forceCloseJob.destination || '', fuelLevel: 50, photos: {}, docs: {}, 
                                observations: 'Sin observaciones registradas.', 
                                receiverName: 'ENTREGA SIN RECEPCIÓN', receiverRut: 'N/A', noReception: true, signatureData: null, 
                                assignedDriverName: d.name
                             };
                             await updateDoc(doc(db, 'transport_jobs', forceCloseJob.id), {
                                status: 'completed',
                                completedAt: Date.now(),
                                acceptedByEmail: d.email,
                                assignedDrivers: [{id: d.id, name: d.name, email: d.email}],
                                assignedEmails: [d.email],
                                checklist: mockChecklist,
                                phase: forceCloseJob.tripType === 'revision' ? 'prt_done' : 'arrived_destination',
                                prt_result: forceCloseJob.tripType === 'revision' ? (forceCloseJob.prt_result || 'aprobado') : null
                             });
                             setForceCloseJob(null);
                             showAlert(`✅ Traslado cerrado exitosamente a nombre de ${d.name}.`);
                          } catch (e) { console.error(e); showAlert("Error al forzar el cierre."); }
                       });
                    }} className="w-full text-left p-3 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-100 rounded-xl transition-colors">
                       <p className="font-extrabold text-slate-800">{d.name}</p>
                       <p className="text-[10px] font-bold text-slate-400">{d.email}</p>
                    </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      </div>
  );
}
function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm, allClientsList, drivers, expenses, vehicles }) {
  const isQuick = job.id === 'NEW_QUICK_JOB'; 
  const localStorageKey = `checklist_draft_${job.id}`;

  // BUSCAMOS SI LA PATENTE YA TIENE DATOS DE DOCUMENTOS GUARDADOS EN LA FLOTA
  const matchedVehicle = vehicles?.find(v => v.plate === (job.plate || job.vin)?.toUpperCase());
  const initialDocs = matchedVehicle?.docs || { soap:false, permiso:false, revTecnica:false, gases:false };
  const initialDocsExpiry = matchedVehicle?.docsExpiry || {};
  const initialReminders = matchedVehicle?.internalReminders || []; 

  // Sincroniza automáticamente lo seleccionado en la tarjeta de traslado del flujo principal
  const defaultData = {
    client: job.client||'', manualClient: '', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', vehicleType: job.vehicleType||'auto', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false, tire:false, dashboard:false, det1:false, det2:false, det3:false, det4:false }, 
    docs: job.checklist?.docs || initialDocs, 
    docsExpiry: job.checklist?.docsExpiry || initialDocsExpiry, 
    internalReminders: job.checklist?.internalReminders || initialReminders, 
    observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null,
    rtStatus: job.prt_result ? job.prt_result : 'aprobado', 
    rtRejectReason: job.prt_reason ? job.prt_reason : '', 
    rtReturnOption: 'origin', rtReturnDestination: '' 
  };
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(defaultData);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false); // <-- NUEVO ESTADO PARA QR (Idea 8)
  const [fullScreenImage, setFullScreenImage] = useState(null); // <-- NUEVO: ESTADO PARA VER FOTOS EN GRANDE

  // LÓGICA DE BORRADORES Y FIRMA EN FIRESTORE (Reemplaza a localStorage)
  useEffect(() => {
    if (isQuick || !job.id) return;
    let isFirstLoad = true;
    const unsub = onSnapshot(doc(db, 'transport_jobs', job.id), (docSnap) => {
      const data = docSnap.data();
      
      // 1. Cargar borrador si existe en Firebase (solo la primera vez al entrar al componente)
      if (isFirstLoad) {
        if (data?.draft) {
          setFormData(data.draft.formData);
          setStep(data.draft.step || 1);
          setIsDraftLoaded(true);
        }
        isFirstLoad = false;
      }

      // 2. Escuchar siempre en tiempo real si el cliente firma desde su celular
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

  // Guardado Automático de Borrador en Firestore (en vez de local)
  useEffect(() => {
    if (isQuick || !job.id) return;
    const timer = setTimeout(() => {
      // FILTRO DE SEGURIDAD: Limpiamos los Base64 gigantes del borrador para evitar el límite de 1MB de Firestore
      const draftData = JSON.parse(JSON.stringify(formData));
      for (const key in draftData.photos) {
         // Si la foto no es un link de Storage (http), la quitamos del borrador
         if (draftData.photos[key] && !draftData.photos[key].startsWith('http')) {
             draftData.photos[key] = false; 
         }
      }
      // La firma es muy ligera (10KB), pero por seguridad extrema también la filtramos
      if (draftData.signatureData && !draftData.signatureData.startsWith('http')) {
         draftData.signatureData = null;
      }

      updateDoc(doc(db, 'transport_jobs', job.id), { draft: { step, formData: draftData } }).catch(() => {});
    }, 2000); // 2 segundos de retraso para no saturar la base de datos
    return () => clearTimeout(timer);
  }, [step, formData, job.id, isQuick, db]);

  const [processingAction, setProcessingAction] = useState(null);

  // --- MOTOR MAESTRO DE SINCRONIZACIÓN DE FOTOS A STORAGE ---
  const syncFilesToStorage = async (currentData) => {
    const d = { ...currentData };
    const uploadPromises = [];
    const uploadedPhotos = {};
    const jobIdFolder = job.id === 'NEW_QUICK_JOB' ? `quick_${Date.now()}` : job.id;

    for (const [key, val] of Object.entries(d.photos)) {
      if (val && val.startsWith('data:image')) {
        const p = uploadImageToStorage(val, `checklists/${jobIdFolder}`, `photo_${key}_${Date.now()}.jpg`)
          .then(url => uploadedPhotos[key] = url);
        uploadPromises.push(p);
      } else {
        uploadedPhotos[key] = val;
      }
    }
    await Promise.all(uploadPromises);
    d.photos = uploadedPhotos;

    if (d.signatureData && d.signatureData.startsWith('data:image')) {
       d.signatureData = await uploadImageToStorage(d.signatureData, `checklists/${jobIdFolder}`, `signature_${Date.now()}.jpg`);
    }
    return d;
  };

  // Función para generar y mandar el link de firma
  const handleRemoteSignRequest = async () => {
    if (isQuick) return showAlert("⚠️ Para usar la Firma Remota en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    setProcessingAction('wapp');
    try {
      // 1. Sincronizamos fotos pesadas a Storage antes de guardar el documento
      const syncedData = await syncFilesToStorage(formData);
      setFormData(syncedData); // Actualizamos el estado para que el botón Finalizar no vuelva a subirlas

      const url = `${window.location.href.split('?')[0]}?sign=${job.id}`;
      const textToShare = `¡Hola! Por favor firma el acta de recepción y revisa las fotografías del vehículo aquí:\n${url}`;

      const textArea = document.createElement("textarea");
      textArea.value = textToShare;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);

      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: syncedData }, { merge: true });

      if (navigator.share) {
        try { await navigator.share({ title: 'Firma de Recepción', text: textToShare }); } catch (err) { showAlert("✅ Link copiado al portapapeles automáticamente."); }
      } else {
        showAlert("✅ Link copiado al portapapeles. ¡Pégalo en WhatsApp!");
      }
    } catch (e) { 
      console.error(e); 
      showAlert("Error al preparar la firma remota. Verifica tu conexión.");
    }
    finally { setProcessingAction(null); }
  };

  // Función para guardar datos antes de mostrar el QR
  const handleOpenQR = async () => {
    if (isQuick) return showAlert("⚠️ Para usar el Código QR en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    if (!navigator.onLine) return showAlert("⚠️ Tu celular no tiene señal en este momento. Usa 'Compartir Link' y envíalo cuando recuperes la conexión.");
    
    setProcessingAction('qr');
    try {
      const syncedData = await syncFilesToStorage(formData);
      setFormData(syncedData);
      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: syncedData }, { merge: true });
      setQrOpen(true);
    } catch (e) {
      console.error(e);
      showAlert("Error al generar el QR. Revisa tu conexión.");
    } finally { setProcessingAction(null); }
  };

  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  // FUNCIONES PARA LOS AVISOS INTERNOS
  const handleReminderChange = (index, field, value) => {
    const newRems = [...(formData.internalReminders || [])];
    newRems[index][field] = value;
    setF('internalReminders', newRems);
  };
  const addReminder = () => setF('internalReminders', [...(formData.internalReminders || []), { id: Date.now().toString(), text: '', photo: null, resolved: false }]);
  const removeReminder = (index) => {
    const newRems = [...(formData.internalReminders || [])];
    newRems.splice(index, 1);
    setF('internalReminders', newRems);
  };

  const clearDraft = () => {
    showConfirm("¿Eliminar borrador y empezar de nuevo?", async () => {
      if (!isQuick) await updateDoc(doc(db, 'transport_jobs', job.id), { draft: null });
      setFormData(defaultData);
      setStep(1);
      setIsDraftLoaded(false);
    });
  };

  const handlePic = async (e, id) => {
    const f=e.target.files[0]; if(!f)return;
    try {
      // EQUILIBRIO PERFECTO: Subimos a 720px de ancho y 60% de calidad.
      // Las fotos se verán completamente nítidas en el PDF,
      // pero manteniendo un peso seguro para Firebase.
      const dataUrl = await resizeImage(f, 720, 0.6); 
      setFormData(prev => {
        const newData = { ...prev, photos: { ...prev.photos, [id]: dataUrl } };
        // Si la foto era un detalle tocado en el auto, guardamos el pin y su coordenada
        if (prev.pendingPin && prev.pendingPin.id === id) {
          newData.detailPins = [...(prev.detailPins || []), prev.pendingPin];
          newData.pendingPin = null;
        }
        return newData;
      });
    } catch(err){ 
      console.error("Error al procesar la foto:", err);
      showAlert("Error al procesar la foto. Intenta con una imagen más pequeña."); 
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    setIsSubmitting(true);
    
    let d = {...formData}; 
    d.client = d.client === 'OTRO' ? d.manualClient : d.client; 

    if(d.noReception) { 
      d.receiverName="ENTREGA SIN RECEPCIÓN"; 
      d.receiverRut="N/A"; 
    }

    // --- MAGIA STORAGE: SUBIR FOTOS Y FIRMA A LA NUBE PRIMERO ---
    try {
      // Utilizamos el motor central de sincronización
      d = await syncFilesToStorage(d);
    } catch (uploadError) {
      console.error("Error subiendo imágenes:", uploadError);
      showAlert("Hubo un error subiendo las imágenes a la nube. Verifica tu internet.");
      setIsSubmitting(false);
      return;
    }
    // -----------------------------------------------------------

    // --- MAGIA GPS: CAPTURAMOS LA UBICACIÓN INVISIBLEMENTE ANTES DE GUARDAR ---
    const getGPS = () => new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => resolve(null), // Si rechaza permisos o falla, devolvemos null para no bloquear el guardado de la app
        { timeout: 6000, enableHighAccuracy: true } // Máximo 6 segundos de espera
      );
    });

    if (!d.location) {
      const coords = await getGPS();
      if (coords) d.location = coords;
    }
    // -------------------------------------------------------------------------
    
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
        const isAdminUser = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(currentUserEmail);

        if (currentDriver) {
          const currentBalance = currentDriver.balance || 0;
          
          // REGLA: Si es conductor y el gasto supera su fondo, BLOQUEAR envío del checklist
          if (!isAdminUser && totalToDeduct > currentBalance) {
              return showAlert(`No puedes enviar el checklist. Intentas rendir ${formatMoney(totalToDeduct)} en gastos, pero tu fondo actual es de solo ${formatMoney(currentBalance)}. Pide a la central que te asigne más dinero e intenta de nuevo.`);
          }

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

      // --- NUEVO: GUARDAR FECHAS Y ALERTAS EN EL PERFIL DEL VEHÍCULO ---
      if (d.plateOrVin) {
          const plateUpper = d.plateOrVin.toUpperCase();
          const vehRef = collection(db, 'vehicles');
          const q = query(vehRef, where('plate', '==', plateUpper));
          const querySnapshot = await getDocs(q);
          
          // Filtramos los avisos "Solucionados" para que desaparezcan en el próximo viaje
          const activeReminders = (d.internalReminders || []).filter(r => !r.resolved);

          if (!querySnapshot.empty) {
              // Actualizar vehículo existente
              const vehDocId = querySnapshot.docs[0].id;
              await updateDoc(doc(db, 'vehicles', vehDocId), {
                  docs: d.docs,
                  docsExpiry: d.docsExpiry || {},
                  internalReminders: activeReminders
              });
          } else {
              // Crear vehículo nuevo
              await addDoc(vehRef, { 
                  plate: plateUpper, brand: d.brand, model: d.model, client: d.client, 
                  docs: d.docs, docsExpiry: d.docsExpiry || {}, 
                  internalReminders: activeReminders,
                  createdAt: Date.now() 
              });
          }
      }
      // ----------------------------------------------------------------------------

      if(isQuick) { 
          fd.assignedDriverName="Auto-creado"; fd.acceptedByEmail=currentUserEmail; 
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
      // AHORA MOSTRARÁ EL ERROR REAL DE FIREBASE EN LA PANTALLA
      showAlert(`Error de base de datos: ${error.message}`); 
    } finally { setIsSubmitting(false); }
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
      
      {/* Barra Pegajosa Flotante Dinámica */}
      <div className="sticky top-[64px] sm:top-[80px] z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-5 py-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]">
         <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso del Acta</span>
            {/* Cálculo de progreso al vuelo */}
            <span className="text-xs font-black text-blue-600">
               {(() => {
                 let p = 0;
                 if (formData.brand && formData.model && formData.plateOrVin) p += 25;
                 if (formData.fuelLevel !== undefined) p += 25;
                 if (Object.values(formData.photos).filter(v => v).length >= 2) p += 25;
                 if (formData.signatureData || formData.noReception) p += 25;
                 return p;
               })()}%
            </span>
         </div>
         <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full transition-all duration-500 ease-out" style={{width: `${
                 (formData.brand ? 25 : 0) + (formData.fuelLevel !== undefined ? 25 : 0) + (Object.values(formData.photos).filter(v => v).length >= 2 ? 25 : 0) + (formData.signatureData || formData.noReception ? 25 : 0)
            }%`}}></div>
         </div>
      </div>

      <div className="p-5">
        {/* Barra superior de pestañas táctiles e interactivas */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-5 border-b border-slate-100 scrollbar-none">
          {[
            { id: 1, label: '📋 Datos' },
            { id: 2, label: '📄 Docs' },
            { id: 3, label: '💬 Notas' },
            { id: 4, label: '📸 Fotos' },
            { id: 5, label: '⛽ Comb. & Espera' },
            { id: 6, label: '✍️ Entrega' }
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setStep(t.id)} className={`px-3 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all shrink-0 ${step === t.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5 text-sm">
          
          {/* PESTAÑA 1: DATOS */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {isQuick ? (
                <div className="space-y-2">
                   <select value={formData.client} onChange={(e) => setF('client', e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 bg-white outline-none focus:border-blue-500">
                      <option value="">Selecciona el Cliente...</option>
                      {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="OTRO">Otro (Ingreso Manual)</option>
                   </select>
                   {formData.client === 'OTRO' && <input value={formData.manualClient} onChange={e=>setF('manualClient',e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 mt-2"/>}
                </div>
              ) : (
                <input value={formData.client} onChange={e=>setF('client',e.target.value)} placeholder="Cliente" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 bg-slate-50" readOnly/>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
                <input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
              </div>
              <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente o VIN" className="w-full border-2 border-slate-300 bg-slate-100 p-3 rounded-xl font-black uppercase text-slate-800 shadow-inner mt-2"/>
              
              {job.tripType === 'revision' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 mt-4">
                  <h3 className="text-sm font-extrabold text-blue-600 uppercase tracking-wider">Resultado de la Revisión</h3>
                  <select value={formData.rtStatus} onChange={e=>setF('rtStatus', e.target.value)} className={`w-full border-2 p-3.5 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <option value="aprobado">✅ APROBADO</option>
                    <option value="rechazado">❌ RECHAZADO</option>
                  </select>
                  {formData.rtStatus === 'rechazado' && (
                    <input value={formData.rtRejectReason} onChange={e=>setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required={formData.rtStatus === 'rechazado'} className="w-full border-2 border-red-300 p-3 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2" />
                  )}
                  {formData.rtStatus === 'aprobado' && (
                    <div className="mt-2 p-3 border border-green-200 bg-white rounded-xl space-y-2">
                      <p className="text-xs font-bold text-green-800">¿Hacia dónde se dirige el vehículo tras aprobar?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                          Volver al Origen
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                          Otro Destino
                        </label>
                      </div>
                      {formData.rtReturnOption === 'other' && (
                        <input value={formData.rtReturnDestination} onChange={e=>setF('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required={formData.rtReturnOption === 'other'} className="w-full border-2 border-green-300 p-2.5 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 2: DOCUMENTOS */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Documentos del Vehículo</h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[{ id: 'soap', label: 'SOAP', icon: <FileText className="w-5 h-5"/> }, { id: 'permiso', label: 'Permiso Circ.', icon: <MapPin className="w-5 h-5"/> }, { id: 'revTecnica', label: 'Rev. Técnica', icon: <CheckCircle className="w-5 h-5"/> }, { id: 'gases', label: 'Gases', icon: <CloudOff className="w-5 h-5"/> }].map(doc => (
                  <div key={doc.id} className="flex flex-col gap-2">
                    <button 
                      type="button" 
                      onClick={() => setF('docs', { ...formData.docs, [doc.id]: !formData.docs[doc.id] })} 
                      className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all duration-200 select-none shadow-sm ${formData.docs[doc.id] ? 'border-green-500 bg-green-500 text-white shadow-green-200' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:border-slate-300'}`}
                    >
                      {formData.docs[doc.id] ? <CheckCircle className="w-6 h-6 animate-in zoom-in"/> : doc.icon}
                      <span className="font-black text-xs uppercase tracking-wider">{doc.label}</span>
                    </button>
                    {formData.docs[doc.id] && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-green-50 border border-green-200 p-2 rounded-xl flex flex-col gap-1 shadow-inner">
                          <p className="text-[9px] font-extrabold text-green-700 uppercase tracking-widest text-center">Vencimiento</p>
                          <input type="date" value={formData.docsExpiry?.[doc.id] || ''} onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} className="w-full bg-white border border-green-200 p-1.5 rounded-lg text-xs font-black text-slate-700 outline-none focus:border-green-500 text-center" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PESTAÑA 3: OBSERVACIONES Y ALERTAS INTERNAS */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Observaciones Generales</h3>
              <textarea className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[90px]" placeholder="Escribe aquí si hay algún daño, rayón o comentario del estado visual del vehículo..." value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />

              <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 mt-4 shadow-sm">
                  <h3 className="text-sm font-extrabold text-amber-800 mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Alertas Internas de Patente</h3>
                  <p className="text-[10px] font-bold text-amber-700 mb-4 leading-tight">Avisos privados que no salen en el PDF. Sirven como historial para el próximo traslado.</p>
                  
                  {(formData.internalReminders || []).map((rem, idx) => (
                      <div key={rem.id} className={`p-3 rounded-xl border-2 mb-3 bg-white transition-all ${rem.resolved ? 'border-green-300 opacity-60 grayscale-[50%]' : 'border-amber-300 shadow-sm'}`}>
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aviso #{idx + 1}</span>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200 transition-colors">
                                  <input type="checkbox" className="w-4 h-4 accent-green-600 rounded cursor-pointer" checked={rem.resolved} onChange={e => handleReminderChange(idx, 'resolved', e.target.checked)}/>
                                  Solucionado
                              </label>
                          </div>
                          <textarea disabled={rem.resolved} value={rem.text} onChange={e => handleReminderChange(idx, 'text', e.target.value)} placeholder="Ej: Triángulo roto, falta gata, rueda repuesto baja..." className="w-full border-2 border-slate-100 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-amber-500 mb-2 disabled:bg-slate-50 text-slate-700 resize-none min-h-[60px]"/>
                          
                          <div className="flex items-center gap-2">
                              <label className={`flex-1 py-2 text-center rounded-lg border-2 border-dashed cursor-pointer text-[10px] font-extrabold transition-colors uppercase tracking-wide ${rem.photo ? 'bg-green-50 border-green-400 text-green-700' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-500'}`}>
                                  <input type="file" accept="image/*" className="hidden" disabled={rem.resolved} onChange={async e => { const f=e.target.files[0]; if(!f)return; try{ const dUrl = await resizeImage(f, 400, 0.4); handleReminderChange(idx, 'photo', dUrl); }catch(err){}}}/>
                                  {rem.photo ? '📸 Foto Guardada' : '📸 Adjuntar Foto'}
                              </label>
                              {rem.photo && <button type="button" onClick={() => {
                                  const w = window.open(""); 
                                  w.document.write(`<img src="${rem.photo}" style="width:100%;max-width:800px;margin:auto;display:block;padding-top:20px;"/>`);
                              }} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors border border-blue-200"><Eye className="w-4 h-4"/></button>}
                              <button type="button" onClick={()=>removeReminder(idx)} className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors border border-red-200"><Trash2 className="w-4 h-4"/></button>
                          </div>
                      </div>
                  ))}
                  <button type="button" onClick={addReminder} className="w-full py-3 bg-amber-200 hover:bg-amber-300 text-amber-800 font-black text-xs uppercase tracking-widest rounded-xl transition-colors border border-amber-300 shadow-sm">+ Agregar Nuevo Aviso</button>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: FOTOS (MAPA FOTOGRÁFICO INTERACTIVO) */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Croquis Pericial de Daños</h3>
                <select value={formData.vehicleType || 'auto'} onChange={e => setF('vehicleType', e.target.value)} className="bg-slate-100 border-2 border-slate-200 text-[10px] font-bold p-1.5 rounded-lg outline-none text-slate-700 cursor-pointer max-w-[140px]">
                  <option value="auto">🚙 Auto/SUV</option>
                  <option value="camioneta">🛻 Camioneta</option>
                  <option value="furgon_pequeno">🚐 Furgón Peq.</option>
                  <option value="furgon_grande">🚐 Furgón Grande</option>
                  <option value="camion">🚚 Camión Simple</option>
                  <option value="camion_doble">🚚 Camión Doble Cab.</option>
                  <option value="camion_2ejes">🚛 Camión (2 Ejes)</option>
                  <option value="camion_3ejes">🚛 Camión (3 Ejes)</option>
                  <option value="camion_8x4">🚚 Camión Rigid (8x4)</option>
                  <option value="carro_arrastre">🛒 Carro Arrastre</option>
                </select>
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl border-2 border-slate-100 mb-4 select-none relative">
                <div className="flex justify-between items-center mb-4 min-h-[40px]">
                  {!formData.zoomZone ? (
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed w-full text-center">
                      Toca los recuadros para fotos generales.<br/>
                      <span className="text-blue-500 text-xs">Toca un cuadrante del auto para acercar y marcar.</span>
                    </p>
                  ) : (
                    <div className="w-full flex items-center justify-between bg-blue-50 p-2 rounded-xl border border-blue-200 animate-in fade-in">
                      <p className="text-[11px] font-black text-blue-700 uppercase animate-pulse flex items-center gap-1"><Search className="w-4 h-4"/> Toca el daño exacto</p>
                      <button type="button" onClick={() => setF('zoomZone', null)} className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm border border-slate-200 flex items-center gap-1 hover:bg-slate-100 transition-colors"><X className="w-3 h-3"/> Volver</button>
                    </div>
                  )}
                </div>
                
                <div className="relative w-full max-w-[280px] h-[400px] mx-auto my-6">
                  {/* VEHÍCULO INTERACTIVO CENTRAL CON ZOOM */}
                  <div 
                     className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 cursor-crosshair transition-all duration-300 ease-out drop-shadow-lg ${
                       !formData.zoomZone ? 'scale-100 z-10 hover:opacity-90' : 
                       formData.zoomZone === 'tl' ? 'scale-[1.8] origin-top-left z-50' :
                       formData.zoomZone === 'tr' ? 'scale-[1.8] origin-top-right z-50' :
                       formData.zoomZone === 'ml' ? 'scale-[1.8] origin-left z-50' :
                       formData.zoomZone === 'mr' ? 'scale-[1.8] origin-right z-50' :
                       formData.zoomZone === 'bl' ? 'scale-[1.8] origin-bottom-left z-50' :
                       'scale-[1.8] origin-bottom-right z-50'
                     }`}
                     style={{ height: formData.vehicleType?.includes('camion') || formData.vehicleType === 'furgon_grande' || formData.vehicleType === 'carro_arrastre' ? '260px' : '220px' }}
                     onClick={(e) => {
                       const rect = e.currentTarget.getBoundingClientRect();
                       const x = ((e.clientX - rect.left) / rect.width) * 100;
                       const y = ((e.clientY - rect.top) / rect.height) * 100;

                       if (!formData.zoomZone) {
                         let zone = y < 33 ? 't' : y < 66 ? 'm' : 'b';
                         zone += x < 50 ? 'l' : 'r';
                         setF('zoomZone', zone);
                         return;
                       }

                       const availableDet = ['det1', 'det2', 'det3', 'det4', 'det5', 'det6', 'det7', 'det8'].find(d => !formData.photos[d]);
                       if (!availableDet) return showAlert("Máximo de 8 fotos de detalles/daños alcanzado.");
                       
                       setF('pendingPin', { id: availableDet, x, y });
                       document.getElementById(`pic-${availableDet}`).click();
                       setF('zoomZone', null);
                     }}
                  >
                    {!formData.zoomZone && (
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 pointer-events-none z-40 opacity-40 mix-blend-multiply">
                        <div className="border-r-2 border-b-2 border-dashed border-blue-500 rounded-tl-[40px]"></div>
                        <div className="border-b-2 border-dashed border-blue-500 rounded-tr-[40px]"></div>
                        <div className="border-r-2 border-b-2 border-dashed border-blue-500"></div>
                        <div className="border-b-2 border-dashed border-blue-500"></div>
                        <div className="border-r-2 border-dashed border-blue-500 rounded-bl-[40px]"></div>
                        <div className="border-dashed border-blue-500 rounded-br-[40px]"></div>
                      </div>
                    )}

                    {(!formData.vehicleType || formData.vehicleType === 'auto') && (
                      <div className="w-full h-full bg-slate-300 rounded-[40px] border-4 border-slate-400 relative overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                        <div className="w-4/5 h-1/5 bg-slate-800/30 mx-auto rounded-t-2xl rounded-b-sm mt-5"></div>
                        <div className="w-4/5 h-12 bg-slate-800/30 mx-auto rounded-b-xl rounded-t-sm mb-3"></div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_pequeno' && (
                      <div className="w-full h-full relative flex flex-col items-center z-10">
                        <div className="w-[80%] h-[18%] bg-slate-300 rounded-t-[35px] border-x-4 border-t-4 border-slate-400 shadow-inner z-0"></div>
                        <div className="w-[100%] h-[82%] bg-slate-200 rounded-t-[15px] rounded-b-[20px] border-4 border-slate-400 shadow-inner flex flex-col p-1.5 z-10 -mt-2">
                          <div className="w-[90%] h-[20%] bg-slate-800/40 mx-auto rounded-t-[15px] rounded-b-sm mb-1.5 shadow-sm"></div>
                          <div className="flex-1 w-[95%] mx-auto bg-slate-300 border-2 border-slate-400/30 rounded-md relative flex justify-center overflow-hidden">
                            <div className="w-1/2 h-full border-r-2 border-slate-400/50"></div>
                            <div className="absolute top-1/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-2/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-3/4 w-full border-t-2 border-slate-400/20"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_grande' && (
                      <div className="w-full h-full bg-slate-200 rounded-t-[35px] rounded-b-[10px] border-4 border-slate-400 relative flex flex-col justify-start p-2 shadow-inner z-10">
                        <div className="w-[85%] h-[15%] bg-slate-800/40 mx-auto rounded-t-[20px] rounded-b-sm mt-1"></div>
                        <div className="flex-1 w-[90%] mx-auto bg-slate-300 border-2 border-slate-400/30 rounded-sm mt-3 mb-1 flex items-center justify-center relative overflow-hidden shadow-sm">
                          <div className="w-1/2 h-full border-r-2 border-slate-400/40"></div>
                          <div className="absolute top-1/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-2/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-3/4 w-full border-t border-slate-400/20"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camioneta' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-full h-[40%] bg-slate-300 rounded-t-[35px] rounded-b-md border-4 border-slate-400 p-2 flex flex-col justify-between shadow-inner">
                          <div className="w-5/6 h-8 bg-slate-800/30 mx-auto rounded-t-xl rounded-b-sm mt-2"></div>
                          <div className="w-5/6 h-4 bg-slate-800/30 mx-auto rounded-b-xl rounded-t-sm mb-1"></div>
                        </div>
                        <div className="w-[90%] h-[60%] mx-auto bg-slate-200 border-x-4 border-b-4 border-slate-400 rounded-b-xl mt-1 relative">
                          <div className="absolute inset-2 border-2 border-slate-300 rounded-sm"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                          <div className="w-full h-1/2 bg-slate-800/40 rounded-t-md rounded-b-sm mb-1"></div>
                        </div>
                        <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion_doble' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[32%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 p-1 flex flex-col justify-end gap-1 shadow-inner z-10 relative">
                          <div className="w-full h-[40%] bg-slate-800/40 rounded-t-md"></div>
                          <div className="w-full h-[35%] bg-slate-800/40 rounded-sm mb-0.5"></div>
                        </div>
                        <div className="w-full h-[66%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                        </div>
                      </div>
                    )}
                    {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes' || formData.vehicleType === 'camion_8x4' || formData.vehicleType === 'carro_arrastre') && (
                      <div className="w-full h-full relative flex flex-col items-center">
                        
                        {/* RENDERIZADO DEL CAMIÓN 8x4 */}
                        {formData.vehicleType === 'camion_8x4' && (
                          <>
                            {/* Dirección Doble Frontal */}
                            <div className="absolute top-[10%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[10%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[22%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[22%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            {/* Tracción Doble Trasera */}
                            <div className="absolute bottom-[20%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[20%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[7%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[7%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            
                            <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                              <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                            </div>
                            <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}
                        
                        {/* RENDERIZADO DEL CARRO DE ARRASTRE */}
                        {formData.vehicleType === 'carro_arrastre' && (
                          <div className="w-full h-full relative overflow-hidden flex justify-center items-center">
                            {/* Cuerpo del carro */}
                            <div className="w-[90%] h-[80%] bg-slate-300 rounded-md border-4 border-slate-400 relative overflow-hidden shadow-inner flex justify-center items-center z-10 mt-6">
                                {/* Contorno interior táctil */}
                                <div className="w-[90%] h-[90%] border-2 border-slate-300/50 rounded-sm"></div>
                            </div>

                            {/* Tiro del carro (Triángulo frontal) */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-10 border-x-4 border-t-4 border-slate-500 rounded-t-full bg-slate-400 z-0"></div>

                            {/* Eje 1 (Delantero) */}
                            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                            </div>

                            {/* Eje 2 (Trasero) */}
                            <div className="absolute top-[56%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Camiones de 2 y 3 ejes (Mantener los originales) */}
                        {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes') && (
                          <>
                             <div className="absolute top-[8%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                             <div className="absolute top-[8%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                             {formData.vehicleType === 'camion_2ejes' && (
                              <>
                                <div className="absolute bottom-[17%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[17%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                              </>
                            )}
                            {formData.vehicleType === 'camion_3ejes' && (
                              <>
                                <div className="absolute bottom-[27%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[27%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[16%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[16%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                              </>
                            )}
                            <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                              <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                            </div>
                            <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(formData.detailPins || []).map(pin => (
                      <div key={pin.id} className="absolute w-8 h-8 -ml-4 -mt-4 bg-red-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center z-50 animate-in zoom-in" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                        <img src={formData.photos[pin.id]} className="w-full h-full object-cover rounded-full opacity-90" alt="Detalle" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setF('photos', {...formData.photos, [pin.id]: false}); setF('detailPins', formData.detailPins.filter(p => p.id !== pin.id)); }} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-700 shadow-md"><X className="w-3 h-3"/></button>
                      </div>
                    ))}
                  </div>

                  {/* FOTOS GENERALES */}
                  <label className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.front ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-front" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'front')}/>
                    {formData.photos.front ? <><img src={formData.photos.front} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-1"/><span className="text-[9px] font-black text-slate-500 tracking-wide">FRENTE</span></>}
                  </label>

                  <label className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.back ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-back" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'back')}/>
                    {formData.photos.back ? <><img src={formData.photos.back} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-1"/><span className="text-[9px] font-black text-slate-500 tracking-wide">ATRÁS</span></>}
                  </label>

                  <label className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.left ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-left" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'left')}/>
                    {formData.photos.left ? <><img src={formData.photos.left} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5"/><span className="text-[8px] font-black text-slate-500 text-center leading-tight">LATERAL<br/>PILOTO</span></>}
                  </label>

                  <label className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.right ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-right" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'right')}/>
                    {formData.photos.right ? <><img src={formData.photos.right} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5"/><span className="text-[8px] font-black text-slate-500 text-center leading-tight">LATERAL<br/>COPILOTO</span></>}
                  </label>

                  {['det1','det2','det3','det4','det5','det6','det7','det8'].map(d => <input key={d} type="file" id={`pic-${d}`} className="sr-only" accept="image/*" onChange={e=>handlePic(e,d)}/>)}
                </div>

                {/* Botones Flotantes Inferiores */}
                <div className="grid grid-cols-2 gap-3 mt-6 border-t-2 border-slate-100 pt-4">
                  {[{id:'dashboard', l:'Tablero'}, {id:'tire', l:'Repuesto'}, {id:'interior_front', l:'Int. Adelante'}, {id:'interior_back', l:'Int. Atrás'}].map(p => (
                     <label key={p.id} className={`w-full h-12 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white shadow-sm transition-all ${formData.photos[p.id] ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-slate-50'}`}>
                       <input type="file" className="sr-only" accept="image/*" onChange={e=>handlePic(e,p.id)}/>
                       {formData.photos[p.id] ? <><img src={formData.photos[p.id]} className="absolute inset-0 w-full h-full object-cover opacity-30"/><CheckCircle className="w-5 h-5 text-green-500 relative z-10 bg-white rounded-full"/><span className="text-[10px] font-black text-green-800 relative z-10">{p.l}</span></> : <><Camera className="w-4 h-4 text-slate-400"/><span className="text-[10px] font-black text-slate-500 uppercase">{p.l}</span></>}
                     </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 5: EVENTOS EN RUTA Y COMBUSTIBLE */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* COMBUSTIBLE AHORA ESTÁ AQUÍ */}
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Combustible a Bordo</h3>
              
              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${formData.fuelLevel < 30 ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <Fuel className={`w-6 h-6 ${formData.fuelLevel < 30 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estanque</p>
                       <p className={`text-2xl font-black leading-none transition-colors ${formData.fuelLevel < 30 ? 'text-red-600' : formData.fuelLevel <= 50 ? 'text-amber-500' : 'text-green-600'}`}>
                         {formData.fuelLevel}%
                       </p>
                    </div>
                  </div>
                  <div className="text-right">
                     <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors ${formData.fuelLevel == 0 ? 'bg-red-100 text-red-700' : formData.fuelLevel <= 25 ? 'bg-red-50 text-red-600' : formData.fuelLevel <= 50 ? 'bg-amber-50 text-amber-600' : formData.fuelLevel <= 75 ? 'bg-green-50 text-green-600' : 'bg-green-100 text-green-700'}`}>
                       {formData.fuelLevel == 0 ? 'Vacío' : formData.fuelLevel <= 25 ? 'Reserva' : formData.fuelLevel <= 50 ? 'Medio' : formData.fuelLevel <= 75 ? '3/4' : 'Lleno'}
                     </span>
                  </div>
                </div>

                <div className="relative pt-2 pb-2">
                  {/* Letras E y F flotantes */}
                  <div className="flex justify-between text-[11px] font-black px-1 mb-2">
                    <span className="text-red-500">E</span>
                    <span className="text-slate-300">1/4</span>
                    <span className="text-slate-300">1/2</span>
                    <span className="text-slate-300">3/4</span>
                    <span className="text-green-500">F</span>
                  </div>
                  
                  <div className="relative h-10 w-full group">
                      {/* Slider Nativo Invisible para mantener la función táctil/arrastre intacta */}
                      <input 
                        type="range" 
                        min="0" max="100" step="5" 
                        value={formData.fuelLevel} 
                        onChange={(e) => setF('fuelLevel', e.target.value)} 
                        className="absolute z-20 w-full h-full opacity-0 cursor-pointer inset-0 m-0" 
                      />
                      
                      {/* Pista Gráfica (Fondo) */}
                      <div className="absolute inset-y-2 inset-x-0 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200 pointer-events-none">
                        {/* Marcas de cuartos (rayitas divisorias blancas) */}
                        <div className="absolute inset-0 flex justify-between px-[25%] z-10">
                           <div className="w-0.5 h-full bg-white/80"></div>
                           <div className="w-0.5 h-full bg-white/80"></div>
                           <div className="w-0.5 h-full bg-white/80"></div>
                        </div>
                        
                        {/* Relleno animado con color dinámico y franjas de peligro si está bajo */}
                        <div 
                          className={`h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 relative ${
                             formData.fuelLevel < 30 
                               ? 'bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_10px,#dc2626_10px,#dc2626_20px)]' 
                               : formData.fuelLevel <= 50 
                               ? 'bg-amber-400' 
                               : 'bg-green-500'
                          }`}
                          style={{ width: `${formData.fuelLevel}%` }}
                        >
                           {/* Pequeño destello (brillo) en la punta para simular efecto 3D/Luz */}
                           <div className="w-1.5 h-3 bg-white/50 rounded-full relative z-20"></div>
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 mt-6 text-slate-800 uppercase tracking-wider">Viáticos y Esperas</h3>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Wallet className="w-5 h-5"/></div>
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase leading-none">Fondo Asignado</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Patente: {job.plate || job.vin || 'N/A'}</p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-blue-700">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(
                    expenses?.filter(g => g.jobId === job.id && g.type === 'assignment').reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0
                  )}
                </p>
              </div>

              {job.tripType === 'revision' && (job.rtData?.revision || job.rtData?.inspeccion || job.rtData?.frenos) && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-4 h-4"/> Valores pagados en Planta (PRT)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.rtData?.revision && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Revisión Técnica ($)</label>
                        <input type="number" placeholder="Ej: 20000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostRevision || ''} onChange={e => setF('prtCostRevision', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.inspeccion && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Inspección Visual ($)</label>
                        <input type="number" placeholder="Ej: 5000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostInspeccion || ''} onChange={e => setF('prtCostInspeccion', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.frenos && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Certificado Frenos ($)</label>
                        <input type="number" placeholder="Ej: 8000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostFrenos || ''} onChange={e => setF('prtCostFrenos', e.target.value)} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 select-none shadow-sm ${job.waitTimeMinutes >= 1 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  <Clock className="w-5 h-5"/>
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Espera: {job.waitTimeMinutes || 0} min</span>
                </div>

                <button type="button" onClick={() => setF('hasFuelCharge', !formData.hasFuelCharge)} className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all select-none shadow-sm ${formData.hasFuelCharge ? 'border-blue-500 bg-blue-500 text-white shadow-blue-100' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {formData.hasFuelCharge ? <CheckCircle className="w-5 h-5 animate-in zoom-in"/> : <Fuel className="w-5 h-5"/>}
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Carga Combust.</span>
                </button>
              </div>

              {formData.hasFuelCharge && (
                <div className="animate-in fade-in slide-in-from-top-2 border rounded-xl p-3 bg-slate-50 shadow-inner max-w-sm mx-auto">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider text-center mb-1">Monto Rendición Gasolinera ($)</p>
                  <input type="number" placeholder="Ej: 15000" value={formData.fuelChargeAmount || ''} onChange={(e) => setF('fuelChargeAmount', e.target.value)} className="w-full bg-white border p-2 rounded-xl text-center text-sm font-bold outline-none" />
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 6: ENTREGA Y FIRMAS */}
          {step === 6 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Cierre y Conformidad</h3>
              
              <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-2xl border-slate-900 border-2 cursor-pointer shadow-md transition-colors hover:bg-slate-700">
                 <input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-6 h-6 cursor-pointer accent-blue-500 rounded"/> 
                 <span className="font-extrabold text-sm text-white">Dejar sin firma (Local cerrado / PRT)</span>
              </label>
               
               {!formData.noReception && (
                 <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                    <h3 className="font-extrabold text-blue-800 mb-1 flex items-center gap-2"><Zap className="w-5 h-5"/> Firma Remota o QR</h3>
                    <p className="text-[11px] font-bold text-blue-600 mb-3">Envía el link al cliente o muéstrale el QR para que firme desde su celular.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleRemoteSignRequest} disabled={processingAction === 'wapp'} className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                         {processingAction === 'wapp' ? <Clock className="w-4 h-4 animate-spin"/> : <Share2 className="w-4 h-4"/>} {processingAction === 'wapp' ? 'Cargando...' : 'Compartir Link'}
                      </button>
                      <button type="button" onClick={handleOpenQR} disabled={processingAction === 'qr'} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                         {processingAction === 'qr' ? <Clock className="w-4 h-4 animate-spin"/> : <QrCode className="w-4 h-4"/>} {processingAction === 'qr' ? 'QR' : 'Mostrar QR'}
                      </button>
                    </div>
                 </div>
               )}

               {!formData.noReception && (
                 <div className="space-y-3">
                   <div className="flex items-center gap-2 my-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-bold text-slate-400 uppercase">O llenar manualmente</span><div className="h-px bg-slate-200 flex-1"></div></div>
                   
                   <input required={!formData.noReception} value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre del receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   <input required={!formData.noReception} value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT Receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   
                   {formData.clientComments && (
                     <div className="bg-slate-100 p-2.5 rounded-xl border">
                       <p className="text-[9px] font-extrabold text-slate-500 uppercase">Comentarios del Receptor:</p>
                       <p className="text-xs font-bold text-slate-800 italic">"{formData.clientComments}"</p>
                     </div>
                   )}

                   <div className="relative mt-1">
                     {formData.signatureData && <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 z-10"><CheckCircle className="w-3 h-3"/> CAPTURADA</div>}
                     <SignaturePad initialData={formData.signatureData} onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/>
                   </div>
                 </div>
               )}
              
              {/* El botón GPS manual fue eliminado. Se captura automáticamente al presionar Finalizar. */}
            </div>
          )}

          {/* BOTONERA NAVEGACIÓN INFERIOR DINÁMICA */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-3 rounded-xl text-sm w-1/3 active:scale-[0.97] transition-all duration-200">
                Atrás
              </button>
            )}
            
            {step < 6 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="group flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-200 flex justify-center items-center gap-2 relative overflow-hidden">
                <span className="relative z-10">Siguiente Paso</span>
                <span className="relative z-10 transform group-hover:translate-x-1.5 transition-transform duration-300">➔</span>
                {/* Efecto de destello de luz (Shine) */}
                <div className="absolute inset-0 h-full w-full translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-in-out"></div>
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="group flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 transition-all duration-200 flex justify-center items-center gap-2">
                {isSubmitting ? <><Clock className="w-4 h-4 animate-spin"/> Guardando GPS y Acta...</> : <><span className="group-hover:animate-bounce">🏁</span> Finalizar y Guardar</>}
              </button>
            )}
          </div>

        </form>
      </div>

      {/* NUEVO: MODAL DE FOTO EN PANTALLA COMPLETA PARA EL CONDUCTOR */}
      {fullScreenImage && (
        <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors shadow-lg">
            <X className="w-6 h-6" />
          </button>
          <img src={fullScreenImage} alt="Evidencia Ampliada" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}
// --- ENVOLTORIO MAESTRO DE NAVEGACIÓN ---
// Esto convierte tu aplicación entera en una Single Page Application (SPA) ultra veloz
export default function App() {
  return (
    <Router>
      <LogisticApp />
    </Router>
  );
}