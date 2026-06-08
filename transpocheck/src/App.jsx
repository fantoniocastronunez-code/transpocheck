import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, Edit2, Bell, Share2, X, Calendar, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Map, Ticket, Settings
} from 'lucide-react';

// ==========================================
// 1. CONFIGURACIÓN EXACTA DE FIREBASE
// ==========================================
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
const googleProvider = new GoogleAuthProvider();

const CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];
const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

// ==========================================
// 2. COMPONENTE: FIRMA DIGITAL Y HELPERS
// ==========================================
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

const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;
const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

// Escudo de Fechas para iOS Safari
const formatSafeDate = (timestamp) => {
  if (!timestamp) return 'Fecha no registrada';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Fecha no válida';
    return d.toLocaleDateString('es-CL');
  } catch (e) {
    return 'Error de fecha';
  }
};

// ==========================================
// 3. APLICACIÓN PRINCIPAL
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [tolls, setTolls] = useState([]);
  const [destinations, setDestinations] = useState([]);
  
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingToll, setEditingToll] = useState(null);
  const [editingDestination, setEditingDestination] = useState(null);
  
  const [fleetFilter, setFleetFilter] = useState('');
  const [destDirectionFilter, setDestDirectionFilter] = useState('Todos'); 
  
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [mainTab, setMainTab] = useState('jobs'); 
  const [jobsSubTab, setJobsSubTab] = useState('list'); 
  const [configSubTab, setConfigSubTab] = useState('vehicles'); 
  const [activeRole, setActiveRole] = useState('driver');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const isFirstLoad = useRef(true);

  // Modales Personalizados
  const [dialogConfig, setDialogConfig] = useState(null);
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

  const currentUserEmail = user?.email;
  const isRealAdmin = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(currentUserEmail);

  useEffect(() => {
    setActiveRole(isRealAdmin ? 'admin' : 'driver');
  }, [isRealAdmin]);

  useEffect(() => {
    if (!user) return;
    
    const unsubJobs = onSnapshot(collection(db, 'transport_jobs'), (snapshot) => {
      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const d = change.doc.data();
          if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail)) {
            triggerNotification('📍 ¡Nuevo Traslado!', `Vehículo: ${d.brand || 'Vehículo'} para el ${formatDateDisplay(d.scheduledDate) || 'Hoy'}`);
          }
          if (change.type === 'modified' && d.status === 'accepted' && isRealAdmin && activeRole === 'admin') {
            triggerNotification('✅ Trabajo Aceptado', `Conductor: ${d.acceptedByEmail} aceptó el traslado.`);
          }
        });
      }
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.createdAt - a.createdAt));
      isFirstLoad.current = false;
    });

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt)));
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTolls = onSnapshot(collection(db, 'tolls'), snap => setTolls(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubDestinations = onSnapshot(collection(db, 'destinations'), snap => setDestinations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubDrivers(); unsubExpenses(); unsubVehicles(); unsubTolls(); unsubDestinations(); };
  }, [user, activeRole, currentUserEmail, isRealAdmin]);

  const globalStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
      body { font-family: 'Nunito', sans-serif; }
    `}</style>
  );

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
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = "Reporte_Trabajos.csv"; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleQuickChecklist = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedJob({ id: 'NEW_QUICK_JOB', client: '', brand: '', model: '', plate: '', vin: '', origin: '', destination: '', tripType: 'traslado', expectedTollCost: 0, scheduledDate: today });
    setCurrentView('checklist');
  };

  const NewJobForm = () => {
    const [selectedClient, setSelectedClient] = useState('');
    const [manualClient, setManualClient] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [plate, setPlate] = useState('');
    const [tripType, setTripType] = useState('traslado');
    const [selectedDestId, setSelectedDestId] = useState('');
    const [tollCat, setTollCat] = useState('priceAuto');
    
    const [revType, setRevType] = useState('A');
    const [revA_gases, setRevA_gases] = useState(false);
    const [revA_revision, setRevA_revision] = useState(false);
    const [revA_inspeccion, setRevA_inspeccion] = useState(false);
    const [revA_frenos, setRevA_frenos] = useState(false);
    const [revB_tipo, setRevB_tipo] = useState('completa');
    
    const todayStr = new Date().toISOString().split('T')[0];

    const selDest = destinations.find(d => d.id === selectedDestId);
    const totalTolls = selDest ? selDest.tolls.reduce((acc, tid) => acc + (tolls.find(x => x.id === tid) ? Number(tolls.find(x => x.id === tid)[tollCat]) : 0), 0) : 0;

    const handlePlateChange = (e) => {
      const val = e.target.value.toUpperCase(); setPlate(val);
      const v = vehicles.find(x => x.plate === val);
      if (v) {
        setBrand(v.brand); setModel(v.model);
        if (CLIENTES.includes(v.client)) setSelectedClient(v.client); else { setSelectedClient('OTRO'); setManualClient(v.client); }
      }
    };

    const handleCreateJobSubmit = async (e) => {
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

      const newJob = {
        scheduledDate: formData.get('scheduledDate'), client: finalClient, brand, model,
        vin: plate, plate, origin: formData.get('origin'), destination: tripType === 'viaje' ? (selDest?.name || '') : formData.get('destination'),
        tripType, rtData, expectedTollCost: tripType === 'viaje' ? totalTolls : 0, tollCategory: tripType === 'viaje' ? tollCat : null,
        assignedDrivers: assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email})), assignedEmails: assignedDriversList.map(d => d.email),
        status: 'pending', createdAt: Date.now(), checklist: null
      };

      try {
        await addDoc(collection(db, 'transport_jobs'), newJob);
        if (plate && !vehicles.find(v => v.plate === plate)) await addDoc(collection(db, 'vehicles'), { plate, brand, model, client: finalClient, createdAt: Date.now() });
        setJobsSubTab('list'); showAlert(`Trabajo asignado exitosamente.`);
      } catch (error) { console.error(error); }
    };

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-extrabold mb-6 border-b pb-4 text-slate-800">Crear Nuevo Trabajo</h2>
        <form onSubmit={handleCreateJobSubmit} className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-700">1. Tipo de Servicio</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={()=>setTripType('traslado')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'traslado' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>Traslado Local</button>
              <button type="button" onClick={()=>setTripType('viaje')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'viaje' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>Viaje Interurbano</button>
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

          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">2. Vehículo <span className="text-xs text-blue-500 font-bold">(Autocompletado)</span></h3>
             <div className="grid grid-cols-2 gap-4">
               <input value={plate} onChange={handlePlateChange} type="text" placeholder="Patente o VIN" className="w-full border-2 border-blue-200 p-3 text-sm rounded-xl col-span-2 uppercase outline-none focus:border-blue-500 font-bold bg-white text-blue-900 shadow-sm" />
               <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
               <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
             </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-700">3. Programación y Ruta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Fecha</label>
                 <input name="scheduledDate" type="date" defaultValue={todayStr} required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-700" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Cliente</label>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white">
                  <option value="">Seleccione Cliente...</option>
                  {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="OTRO">Otro (Ingreso manual)</option>
                </select>
                {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white mt-2" />}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <input name="origin" type="text" placeholder="Desde (Origen)" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
              {tripType !== 'viaje' ? (
                <input name="destination" type="text" placeholder={tripType === 'revision' ? 'Planta de Revisión (Destino)' : 'Hasta (Destino)'} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
              ) : (
                <div className="col-span-1 md:col-span-2 space-y-4 border-t border-slate-200 pt-4 mt-2">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Destino Interurbano y Peajes</label>
                  <select value={selectedDestId} onChange={e => setSelectedDestId(e.target.value)} required className="w-full border-2 border-blue-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-800 bg-white">
                    <option value="">Seleccione Ciudad Destino...</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {selectedDestId && (
                    <div className="p-4 bg-white border-2 border-blue-100 rounded-xl space-y-3">
                      <select value={tollCat} onChange={e => setTollCat(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-semibold outline-none focus:border-blue-500">
                        <option value="priceAuto">Auto / Camioneta</option>
                        <option value="priceTruck2">Camión 2 Ejes</option>
                        <option value="priceTruckMore">Camión más de 2 Ejes</option>
                      </select>
                      <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl"><span className="font-bold text-blue-800 text-sm">Gastos de Peajes Est.:</span><span className="font-black text-blue-600 text-lg">{formatMoney(totalTolls)}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">4. Conductores</h3>
             <div className="max-h-48 overflow-y-auto border-2 border-slate-200 bg-white rounded-xl">
                {drivers.map(d => (
                  <label key={d.id} className="flex items-center p-4 border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                    <input type="checkbox" name="assignedDriverId" value={d.id} className="w-5 h-5 cursor-pointer rounded text-blue-600 focus:ring-blue-500" />
                    <div className="ml-4"><span className="block text-base font-bold text-slate-800">{d.name}</span><span className="block text-sm font-semibold text-slate-400">{d.email}</span></div>
                  </label>
                ))}
             </div>
          </div>
          <div className="flex justify-end pt-2"><button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">Guardar y Asignar</button></div>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      {globalStyles}
      <header className="bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Car className="w-6 h-6 text-white" /></div>
          <h1 className="font-extrabold text-2xl tracking-tight hidden sm:block">LogisticAPP</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {!notificationsEnabled && <button onClick={requestNotificationPermission} className="p-2 bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-sm" title="Activar Notificaciones"><Bell className="w-5 h-5 text-white animate-pulse" /></button>}
          {isRealAdmin && (
            <button onClick={() => { setActiveRole(activeRole === 'admin' ? 'driver' : 'admin'); setMainTab('jobs'); }} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl text-sm font-bold transition-all border border-white/10 backdrop-blur-sm">
              {activeRole === 'admin' ? <ToggleRight className="w-6 h-6 text-green-300"/> : <ToggleLeft className="w-6 h-6 text-slate-300"/>}
              <span className="hidden md:inline">{activeRole === 'admin' ? 'Modo Admin' : 'Modo Conductor'}</span>
            </button>
          )}
          <div className="hidden md:block text-right mr-2"><p className="text-xs text-blue-200 font-bold uppercase tracking-wider">Sesión iniciada</p><p className="text-sm font-extrabold">{currentUserEmail}</p></div>
          <button onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors" title="Cerrar sesión"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          {activeRole === 'admin' ? (
            <>
              <div className="flex flex-wrap gap-1 mb-6 bg-white p-1.5 rounded-2xl border shadow-sm text-xs sm:text-sm">
                <button onClick={() => setJobsSubTab('list')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${jobsSubTab==='list'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><ClipboardList className="w-4 h-4"/> Trabajos</button>
                <button onClick={() => setJobsSubTab('create')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${jobsSubTab==='create'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-4 h-4"/> Crear</button>
              </div>
              
              {jobsSubTab === 'list' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h2 className="text-2xl font-extrabold text-slate-800">Monitor Operativo</h2>
                    <button onClick={exportToExcel} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-lg shadow-green-200 transition-colors"><Download className="w-5 h-5"/> Exportar Excel</button>
                  </div>
                  <JobsList jobs={jobs} drivers={drivers} role="admin" onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} onEditJob={setEditingJob} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
                </div>
              )}
              
              {jobsSubTab === 'create' && <NewJobForm />}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Mis Trabajos</h2>
              <JobsList jobs={jobs} drivers={drivers} role="driver" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'config' && activeRole === 'admin' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
           <div className="flex flex-wrap gap-1 mb-6 bg-white p-1.5 rounded-2xl border shadow-sm text-xs sm:text-sm">
                <button onClick={() => setConfigSubTab('vehicles')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${configSubTab==='vehicles'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Truck className="w-4 h-4"/> Flota</button>
                <button onClick={() => setConfigSubTab('drivers')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${configSubTab==='drivers'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Users className="w-4 h-4"/> Equipo</button>
                <button onClick={() => setConfigSubTab('tolls')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${configSubTab==='tolls'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Ticket className="w-4 h-4"/> Peajes</button>
                <button onClick={() => setConfigSubTab('destinations')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${configSubTab==='destinations'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Map className="w-4 h-4"/> Destinos</button>
           </div>

           {configSubTab === 'tolls' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.target); const data = { name: fd.get('name'), km: fd.get('km'), direction: fd.get('direction'), route: fd.get('route'), priceAuto: Number(fd.get('pa')), priceTruck2: Number(fd.get('pt2')), priceTruckMore: Number(fd.get('ptm')) }; try { if (editingToll) { await updateDoc(doc(db, 'tolls', editingToll.id), data); setEditingToll(null); showAlert("Peaje actualizado."); } else { await addDoc(collection(db, 'tolls'), data); showAlert("Peaje creado."); } e.target.reset(); } catch(err){} }} className="bg-white p-6 rounded-3xl border space-y-4">
                    <h3 className="font-extrabold text-lg flex items-center gap-2"><Ticket className="text-blue-600"/> {editingToll ? 'Editar Peaje' : 'Nuevo Peaje'}</h3>
                    <input name="name" defaultValue={editingToll?.name} placeholder="Nombre Peaje" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <div className="grid grid-cols-2 gap-3">
                      <input name="km" defaultValue={editingToll?.km} placeholder="Km" className="border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                      <select name="direction" defaultValue={editingToll?.direction || 'Norte'} className="border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"><option>Norte</option><option>Sur</option></select>
                    </div>
                    <input name="route" defaultValue={editingToll?.route} placeholder="Ruta (Ej. Ruta 5 Norte)" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <input name="pa" type="number" defaultValue={editingToll?.priceAuto} placeholder="Valor Auto / Camioneta" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <input name="pt2" type="number" defaultValue={editingToll?.priceTruck2} placeholder="Valor Camión 2 Ejes" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <input name="ptm" type="number" defaultValue={editingToll?.priceTruckMore} placeholder="Valor Camión >2 Ejes" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <div className="flex gap-2">
                       {editingToll && <button type="button" onClick={() => setEditingToll(null)} className="bg-slate-100 p-2.5 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}
                       <button type="submit" className="flex-1 w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm">Guardar Peaje</button>
                    </div>
                  </form>
                  <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                    <h3 className="font-extrabold text-lg mb-4">Peajes Base</h3>
                    {tolls.map(t => (
                      <div key={t.id} className="p-3 bg-slate-50 border rounded-xl mb-2.5 flex justify-between items-center text-xs">
                        <div><p className="font-bold text-sm">{t.name}</p><p className="text-slate-400 font-semibold">{t.route} (Km {t.km} {t.direction})</p><p className="text-blue-600 font-extrabold mt-1">Auto: {formatMoney(t.priceAuto)} | C2: {formatMoney(t.priceTruck2)} | C+: {formatMoney(t.priceTruckMore)}</p></div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditingToll(t)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={()=>showConfirm("¿Eliminar peaje?", async () => await deleteDoc(doc(db, 'tolls', t.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
           )}

           {configSubTab === 'destinations' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.target); const tIds = fd.getAll('tollIds'); const data = { name: fd.get('name'), tolls: tIds }; try { if (editingDestination) { await updateDoc(doc(db, 'destinations', editingDestination.id), data); setEditingDestination(null); showAlert("Destino actualizado."); } else { await addDoc(collection(db, 'destinations'), data); showAlert("Destino guardado."); } e.target.reset(); } catch(err){} }} className="bg-white p-6 rounded-3xl border space-y-4">
                    <h3 className="font-extrabold text-lg flex items-center gap-2"><Map className="text-blue-600"/> {editingDestination ? 'Editar Destino' : 'Nuevo Destino'}</h3>
                    <input name="name" defaultValue={editingDestination?.name} placeholder="Ciudad de Destino" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <div className="flex justify-between items-center"><p className="text-xs font-bold text-slate-500">Filtrar Peajes:</p><select value={destDirectionFilter} onChange={(e) => setDestDirectionFilter(e.target.value)} className="border-2 p-1 rounded-lg text-xs font-bold outline-none"><option value="Todos">Todos</option><option value="Norte">Norte</option><option value="Sur">Sur</option></select></div>
                    <div className="max-h-48 overflow-y-auto border-2 rounded-xl p-1 bg-slate-50 text-xs font-semibold">
                      {tolls.filter(t => destDirectionFilter === 'Todos' || t.direction === destDirectionFilter).map(t => <label key={t.id} className="flex items-center gap-2 p-1.5 border-b last:border-0 cursor-pointer hover:bg-slate-100"><input type="checkbox" name="tollIds" value={t.id} defaultChecked={editingDestination?.tolls?.includes(t.id)} className="w-4 h-4 rounded cursor-pointer"/> {t.name} ({t.direction})</label>)}
                    </div>
                    <div className="flex gap-2">
                       {editingDestination && <button type="button" onClick={() => setEditingDestination(null)} className="bg-slate-100 p-2.5 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}
                       <button type="submit" className="flex-1 w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm">Guardar Destino</button>
                    </div>
                  </form>
                  <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                    <h3 className="font-extrabold text-lg mb-4">Rutas por Destino</h3>
                    {destinations.map(d => (
                      <div key={d.id} className="p-3 bg-slate-50 border rounded-xl mb-2 flex justify-between items-center text-sm font-bold">
                        <div><p className="text-slate-800">{d.name}</p><p className="text-xs font-semibold text-slate-400">{d.tolls?.length || 0} Peajes vinculados</p></div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditingDestination(d)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={()=>showConfirm("¿Eliminar destino?", async () => await deleteDoc(doc(db, 'destinations', d.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
           )}

           {configSubTab === 'vehicles' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={async (e) => { e.preventDefault(); const formData = new FormData(e.target); const client = formData.get('client') === 'OTRO' ? formData.get('manualClient') : formData.get('client'); try { if(editingVehicle){ await updateDoc(doc(db, 'vehicles', editingVehicle.id), { client, brand: formData.get('brand'), model: formData.get('model'), plate: formData.get('plate').toUpperCase() }); setEditingVehicle(null); showAlert("Vehículo actualizado."); } else { await addDoc(collection(db, 'vehicles'), { client, brand: formData.get('brand'), model: formData.get('model'), plate: formData.get('plate').toUpperCase(), createdAt: Date.now() }); showAlert("Vehículo guardado."); } e.target.reset(); } catch (error) { console.error(error); } }} className="bg-white p-6 rounded-3xl border space-y-4 shadow-sm">
                    <h3 className="text-xl font-extrabold flex items-center gap-2"><Truck className="text-blue-600"/> {editingVehicle ? 'Editar' : 'Nuevo'} Vehículo</h3>
                    <select name="client" defaultValue={editingVehicle?.client || ''} className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm bg-white outline-none"><option value="">Cliente...</option>{CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}<option value="OTRO">Otro</option></select>
                    <input name="manualClient" placeholder="Si elegiste OTRO, escríbelo aquí" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <input name="brand" defaultValue={editingVehicle?.brand} placeholder="Marca" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <input name="model" defaultValue={editingVehicle?.model} placeholder="Modelo" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <input name="plate" defaultValue={editingVehicle?.plate} placeholder="Patente" required className="w-full border-2 p-2.5 rounded-xl font-bold uppercase text-sm outline-none"/>
                    <div className="flex gap-2">
                      {editingVehicle && <button type="button" onClick={()=>setEditingVehicle(null)} className="bg-slate-100 p-2.5 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm">Guardar Datos</button>
                    </div>
                  </form>
                  <div className="bg-white p-6 rounded-3xl border flex flex-col shadow-sm">
                    <div className="flex justify-between mb-4 items-center"><h3 className="text-lg font-extrabold">Base Flota</h3><select onChange={e=>setFleetFilter(e.target.value)} className="border-2 p-1.5 rounded-xl text-xs font-bold outline-none"><option value="">Todos</option>{CLIENTES.map(c=><option key={c}>{c}</option>)}</select></div>
                    <div className="space-y-2.5 overflow-y-auto max-h-[55vh]">
                      {vehicles.filter(v => !fleetFilter ? true : v.client === fleetFilter).map(v=>(
                        <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-xl text-sm">
                          <div><p className="font-extrabold text-slate-800">{v.brand} {v.model}</p><p className="text-xs font-bold text-blue-600">{v.plate}</p><p className="text-xs font-bold text-slate-400 mt-1">{v.client || 'Sin cliente'}</p></div>
                          <div className="flex gap-1"><button onClick={()=>setEditingVehicle(v)} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>showConfirm("¿Eliminar este vehículo de la base de datos?", async () => {try { await deleteDoc(doc(db, 'vehicles', v.id)); } catch (e) { console.error(e); }})} className="p-1.5 text-red-600 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {configSubTab === 'drivers' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const data = { name: fd.get('driverName'), email: fd.get('driverEmail').toLowerCase(), licenses: fd.getAll('licenses'), licenseExpiry: fd.get('licenseExpiry') }; try { if (editingDriver) { await updateDoc(doc(db, 'drivers', editingDriver.id), data); setEditingDriver(null); showAlert("Conductor actualizado exitosamente."); } else { data.balance = 0; data.createdAt = Date.now(); await addDoc(collection(db, 'drivers'), data); showAlert("Conductor creado exitosamente."); } e.target.reset(); } catch (err) { console.error(err); } }} className="bg-white p-6 rounded-3xl border space-y-4 shadow-sm">
                    <h3 className="text-lg font-extrabold"><User className="text-blue-600 inline mr-1"/> {editingDriver ? 'Editar' : 'Nuevo'} Conductor</h3>
                    <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre completo" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail" required type="email" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <div className="space-y-1.5 border-t pt-2">
                       <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Clase de Licencia</label>
                       <div className="grid grid-cols-3 gap-1.5">
                          {LICENCIAS.map(l => (
                            <label key={l} className="flex items-center gap-1 p-1 bg-slate-50 border rounded-lg text-[11px] font-bold cursor-pointer hover:bg-slate-100">
                              <input type="checkbox" name="licenses" value={l} defaultChecked={editingDriver?.licenses?.includes(l)} className="w-3.5 h-3.5 cursor-pointer" /> {l}
                            </label>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Fecha de Vencimiento Licencia</label>
                       <input name="licenseExpiry" type="date" defaultValue={editingDriver?.licenseExpiry || ''} className="w-full border-2 p-2 rounded-xl text-sm font-semibold outline-none text-slate-700 bg-white" />
                    </div>
                    <div className="flex gap-2 border-t pt-2">
                      {editingDriver && <button type="button" onClick={()=>setEditingDriver(null)} className="bg-slate-100 p-2 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-sm">Guardar Conductor</button>
                    </div>
                  </form>
                  <div className="bg-white p-6 rounded-3xl border max-h-[65vh] overflow-y-auto shadow-sm">
                    <h3 className="text-lg font-extrabold mb-4">Equipo Registrado</h3>
                    {drivers.map(d=>(
                      <div key={d.id} className="p-3 bg-slate-50 border rounded-2xl mb-2 flex justify-between items-center text-sm">
                        <div>
                          <p className="font-extrabold text-slate-800">{d.name}</p>
                          <p className="text-xs text-slate-400 font-bold">{d.email}</p>
                          {d.licenses && d.licenses.length > 0 && <p className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md mt-1 w-fit">Licencias: {d.licenses.join(', ')}</p>}
                          {d.licenseExpiry && <p className="text-[10px] font-bold text-red-500 mt-0.5">Vence: {formatDateDisplay(d.licenseExpiry)}</p>}
                        </div>
                        <button onClick={() => setEditingDriver(d)} className="p-2 text-blue-600 bg-blue-50 rounded-xl"><Edit2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      
      {editingJob && <EditJobModal job={editingJob} onClose={() => setEditingJob(null)} />}

      {currentView === 'checklist' && selectedJob && <main className="max-w-2xl mx-auto p-4 pt-6"><ChecklistForm job={selectedJob} db={db} currentUserEmail={currentUserEmail} onCancel={() => setCurrentView('main')} onComplete={() => { setSelectedJob(null); setCurrentView('main'); }} showAlert={showAlert} showConfirm={showConfirm} /></main>}

      {currentView === 'main' && (
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-2.5 z-40 pb-[env(safe-area-inset-bottom)] shadow-lg">
          <button onClick={handleQuickChecklist} className="flex flex-col items-center text-slate-400 hover:text-blue-600 w-16"><Zap className="w-6 h-6 mb-0.5 bg-slate-100 p-1 rounded-xl"/><span className="text-[10px] font-bold">Desde 0</span></button>
          <button onClick={() => {setMainTab('jobs'); setJobsSubTab('list');}} className={`flex flex-col items-center w-16 ${mainTab==='jobs' ? 'text-blue-600' : 'text-slate-400'}`}><ClipboardList className={`w-6 h-6 mb-0.5 ${mainTab==='jobs'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Trabajos</span></button>
          <button onClick={() => setMainTab('ranking')} className={`flex flex-col items-center w-16 ${mainTab==='ranking' ? 'text-yellow-600' : 'text-slate-400'}`}><Trophy className={`w-6 h-6 mb-0.5 ${mainTab==='ranking'?'bg-yellow-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Ranking</span></button>
          <button onClick={() => setMainTab('expenses')} className={`flex flex-col items-center w-16 ${mainTab==='expenses' ? 'text-blue-600' : 'text-slate-400'}`}><Wallet className={`w-6 h-6 mb-0.5 ${mainTab==='expenses'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Gastos</span></button>
          {activeRole === 'admin' && (
             <button onClick={() => setMainTab('config')} className={`flex flex-col items-center w-16 ${mainTab==='config' ? 'text-blue-600' : 'text-slate-400'}`}><Settings className={`w-6 h-6 mb-0.5 ${mainTab==='config'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Config</span></button>
          )}
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

// ==========================================
// MÓDULO RANKING Y HELPERS
// ==========================================
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

function LeaderboardView({ jobs, drivers, isAdminView }) {
  const [selectedDriverJobs, setSelectedDriverJobs] = useState(null);
  const now = new Date(); const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthlyCompleted = jobs.filter(j => j.status === 'completed' && j.completedAt >= firstOfCurrentMonth);
  const ranking = drivers.map(d => { const dj = monthlyCompleted.filter(j => j.acceptedByEmail === d.email); return { ...d, score: dj.length, jobs: dj }; }).sort((a, b) => b.score - a.score);

  return (
    <main className="max-w-5xl mx-auto p-4 pt-6 pb-24">
      <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Ranking Mensual</h2>
      <div className="bg-white rounded-3xl border p-2 sm:p-4 shadow-sm">
        {ranking.length === 0 ? <p className="text-center py-6 text-sm font-bold text-slate-400">Sin datos de traslados este mes.</p> : ranking.map((dr, i) => (
          <div key={dr.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-slate-50 rounded-xl text-sm">
             <div className="flex items-center gap-4"><span className={`text-xl font-black ${i===0?'text-yellow-500':i===1?'text-slate-400':i===2?'text-amber-700':'text-slate-300'}`}>#{i+1}</span><div><p className="font-extrabold text-slate-800">{dr.name}</p><p className="text-xs text-slate-500 font-bold">{dr.score} Traslados</p></div></div>
             {isAdminView && <button onClick={() => setSelectedDriverJobs(dr)} className="flex gap-1 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl font-bold text-xs items-center"><Eye className="w-3.5 h-3.5"/> Historial</button>}
          </div>
        ))}
      </div>
      {selectedDriverJobs && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col p-4">
            <div className="p-2 border-b flex justify-between items-center"><h2 className="text-lg font-extrabold text-slate-800">{selectedDriverJobs.name}</h2><button onClick={()=>setSelectedDriverJobs(null)} className="bg-slate-100 p-1.5 rounded-full"><X className="w-4 h-4"/></button></div>
            <div className="p-2 overflow-y-auto space-y-3 flex-1 mt-2">
              {selectedDriverJobs.jobs.length === 0 ? <p className="text-center text-sm font-bold text-slate-400">Sin traslados.</p> : selectedDriverJobs.jobs.map(j => (
                <div key={j.id} className="bg-slate-50 p-3 rounded-xl border text-xs">
                  <div className="flex justify-between mb-1"><p className="font-extrabold text-slate-800 text-sm">{j.brand} {j.model}</p><span className="border px-1.5 rounded bg-white font-bold text-slate-600 uppercase">{j.plate||j.vin}</span></div>
                  <p className="font-semibold text-slate-500">{getRouteStr(j)}</p>
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

  const activeOrPendingJobs = jobs?.filter(j => j.status === 'pending' || j.status === 'accepted') || [];

  const addExp = async (e, type, amount, detail, driverId, dName, dEmail) => {
    e.preventDefault();
    const currentBalance = drivers.find(d => d.id === driverId)?.balance || 0;
    if (type === 'expense' && amount > currentBalance) return showAlert("Saldo insuficiente.");
    
    const assocJobId = type === 'assignment' ? (e.target.jobId?.value || '') : '';
    let detailString = detail || 'Asignación de fondos';

    if (assocJobId) {
      const jb = activeOrPendingJobs.find(x => x.id === assocJobId);
      if (jb) detailString += ` (Asoc. a patente ${jb.plate || jb.vin || 'S/N'})`;
    }

    try {
      await updateDoc(doc(db, 'drivers', driverId), { balance: type === 'assignment' ? currentBalance + amount : currentBalance - amount });
      await addDoc(collection(db, 'expenses'), { driverId, driverEmail: dEmail, driverName: dName, type, amount, detail: detailString, jobId: assocJobId, createdAt: Date.now() });
      e.target.reset(); showAlert(type === 'assignment' ? "Fondo asignado correctamente." : "Gasto registrado");
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
        if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: (d.balance||0) + (exp.type === 'assignment' ? -exp.amount : exp.amount) });
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
      const amountDiff = newAmount - expense.amount;

      try {
        const driverSnapshot = drivers.find(d => d.id === expense.driverId);
        if (driverSnapshot) {
          let newBalance = driverSnapshot.balance || 0;
          if (expense.type === 'assignment') newBalance += amountDiff;
          if (expense.type === 'expense' || expense.type === 'return') newBalance -= amountDiff;
          await updateDoc(doc(db, 'drivers', expense.driverId), { balance: newBalance });
        }
        await updateDoc(doc(db, 'expenses', expense.id), { amount: newAmount, detail: newDetail });
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

  if (isAdminView) {
    return (
      <main className="max-w-5xl mx-auto p-4 pt-6 pb-24">
        {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}
        {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

        <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Wallet className="text-blue-600"/> Control Viáticos</h2>
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            {drivers.map(d => (
              <div key={d.id} className={`bg-white p-4 rounded-3xl border cursor-pointer ${selectedDriverId === d.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100 hover:border-blue-300'}`} onClick={() => setSelectedDriverId(d.id === selectedDriverId ? null : d.id)}>
                <div className="flex justify-between items-center"><div><p className="font-extrabold text-base text-slate-800">{d.name}</p><p className="text-xs text-slate-400 font-bold">{d.email}</p></div><div className="text-right"><p className="text-[10px] uppercase font-bold text-slate-400">Saldo</p><p className="font-black text-lg text-green-600">{formatMoney(d.balance||0)}</p></div></div>
                {selectedDriverId === d.id && (
                  <form onSubmit={(e) => addExp(e, 'assignment', Number(e.target.amount.value), '', d.id, d.name, d.email)} className="mt-4 border-t pt-3 space-y-2.5" onClick={e=>e.stopPropagation()}>
                    <input name="amount" type="number" required placeholder="Monto a asignar $" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-blue-500"/>
                    <select name="jobId" className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none focus:border-blue-500">
                       <option value="">Asociar a un Trabajo (Opcional)</option>
                       {activeOrPendingJobs.map(j => <option key={j.id} value={j.id}>{j.client} - {j.brand} ({j.plate || j.vin || 'S/N'})</option>)}
                    </select>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 w-full rounded-xl font-bold text-sm transition-colors">Enviar</button>
                  </form>
                )}
              </div>
            ))}
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden w-full">
            <h3 className="font-bold text-slate-700 mb-4 text-sm">{selectedDriverId ? 'Movimientos del Conductor' : 'Historial de Rendiciones'}</h3>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1" style={{ maxHeight: '60vh' }}>
              {expenses.filter(e => selectedDriverId ? e.driverId === selectedDriverId : true).map(e => (
                <div key={e.id} className="bg-slate-50 p-3 rounded-2xl border flex gap-3 items-start text-xs font-bold w-full overflow-hidden">
                  <div className="mt-1"><TransactionIcon type={e.type}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 break-words">{e.detail}</p>
                    <p className="text-[10px] text-slate-400 truncate">{!selectedDriverId && <span className="text-blue-600">{e.driverName} • </span>}{formatSafeDate(e.createdAt)}</p>
                    {e.receiptImage && <button onClick={() => setViewingReceipt(e.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver comprobante</button>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span className={`font-extrabold ${e.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{e.type === 'expense' ? '-' : '+'}{formatMoney(e.amount)}</span>
                    {e.type === 'pending_return' && <button onClick={() => approveReturn(e)} className="ml-1 text-xs font-bold bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors">Aprobar</button>}
                    {e.type !== 'pending_return' && (
                      <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                        <button onClick={() => setEditingExpense(e)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={() => delExp(e)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
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

  if (!myDriver) return <main className="p-8 text-center text-slate-500 font-bold pb-24">No estás registrado como conductor.</main>;
  const myBalance = myDriver.balance || 0;
  const hasPending = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  return (
    <main className="max-w-md mx-auto p-4 pt-6 space-y-6 pb-24">
      {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante de Transferencia</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

      {isReturnOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Rendir Vuelto</h3><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
            <p className="text-sm font-bold text-slate-500 mb-4 border-b border-slate-100 pb-4">Monto total a transferir: <span className="text-blue-600 text-xl font-extrabold block mt-1">{formatMoney(myBalance)}</span></p>
            
            <div className="flex gap-2 mb-4">
               <button onClick={()=>setReturnMethod('transferencia')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${returnMethod==='transferencia'?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>Transferencia</button>
               <button onClick={()=>setReturnMethod('efectivo')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${returnMethod==='efectivo'?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>Efectivo</button>
            </div>

            {returnMethod === 'transferencia' ? (
              <label className={`block w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors relative overflow-hidden ${returnReceipt ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={async e=>{const f=e.target.files[0];if(!f)return;const b=await window.createImageBitmap(f,{resizeWidth:800});const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);setReturnReceipt(c.toDataURL('image/jpeg',0.6));b.close();}} />
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

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-md text-center text-white relative overflow-hidden">
        <Wallet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
        <p className="text-blue-100 font-bold uppercase tracking-wider text-xs mb-1">Fondo Asignado Actual</p>
        <p className="text-4xl font-extrabold tracking-tight">{formatMoney(myBalance)}</p>
      </div>

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2 mb-4"><Receipt className="w-5 h-5 text-red-500"/> Registrar Gasto</h3>
        <form onSubmit={e=>addExp(e,'expense',Number(e.target.amount.value), e.target.detail.value, myDriver.id, myDriver.name, myDriver.email)} className="space-y-4">
          <input type="text" name="detail" placeholder="¿En qué gastaste? (Ej. Peaje)" required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-700" />
          <input type="number" name="amount" placeholder="Monto ($)" required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-700" />
          <button type="submit" disabled={myBalance <= 0 || hasPending} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-all ${myBalance > 0 && !hasPending ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Guardar Gasto</button>
        </form>
      </div>
      
      {hasPending ? (
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
                <p className="text-[10px] font-bold text-slate-400">{formatSafeDate(exp.createdAt)}</p>
                {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver foto</button>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                
                {exp.type !== 'assignment' && exp.type !== 'pending_return' ? (
                  <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                    <button onClick={() => setEditingExpense(exp)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={() => delExp(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
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

// ==========================================
// 4. COMPONENTE: LISTA DE TRABAJOS
// ==========================================
function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail, showAlert, showConfirm }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [jobToFail, setJobToFail] = useState(null);
  const [historyClientFilter, setHistoryClientFilter] = useState(''); 
  const now = new Date();
  const isAdminView = role === 'admin';
  
  const filteredJobs = jobs.filter(job => {
    if (!isAdminView && (!job.assignedEmails?.includes(currentUserEmail) && job.acceptedByEmail !== currentUserEmail)) return false;
    if (!isAdminView && job.status === 'failed' && job.tripType !== 'revision') return false; 
    if (!job.createdAt) return true;
    if (!isAdminView) {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if ((now.getTime() - job.createdAt) > sevenDays) return false;
    } else {
      const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      if (job.createdAt < firstOfCurrentMonth) return false;
    }
    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const adminOrder = { pending: 1, accepted: 2, completed: 3, failed: 3 };
    const driverOrder = { accepted: 1, pending: 2, completed: 3, failed: 3 };
    const order = isAdminView ? adminOrder : driverOrder;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === 'completed' || a.status === 'failed') return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
    return (a.scheduledDate ? new Date(a.scheduledDate).getTime() : a.createdAt) - (b.scheduledDate ? new Date(b.scheduledDate).getTime() : b.createdAt); 
  });

  const activeJobs = sortedJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
  const historyJobsRaw = sortedJobs.filter(j => j.status === 'completed' || j.status === 'failed');
  
  const historyJobs = historyJobsRaw.filter(j => {
     if (!historyClientFilter) return true;
     if (historyClientFilter === 'OTRO') return !CLIENTES.includes(j.client);
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

  const buildPDFDoc = async (job) => {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
    }
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF();
    
    docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 30, 'F'); docPDF.setTextColor(255, 255, 255);
    docPDF.setFontSize(22); docPDF.setFont("helvetica", "bold"); docPDF.text(job.tripType === 'revision' ? "CERTIFICADO DE REVISIÓN" : "CHECKLIST DE TRASLADO", 105, 20, null, null, "center");
    docPDF.setTextColor(0, 0, 0);

    if (job.status === 'failed') {
      docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(12); docPDF.text(`TRABAJO FALLIDO: ${job.failedReason || 'Sin motivo'}`, 20, 37); docPDF.setTextColor(0, 0, 0);
    }
    
    let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "No registrado";
    if (job.acceptedByEmail) { const foundDriver = drivers?.find(d => d.email === job.acceptedByEmail); if (foundDriver) driverNameStr = foundDriver.name; }

    docPDF.setFillColor(241, 245, 249); docPDF.rect(15, 40, 180, 50, 'F');
    docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("1. DATOS DEL SERVICIO Y VEHÍCULO", 20, 48);
    
    docPDF.setFontSize(11);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Fecha Traslado:`, 20, 58); docPDF.setFont("helvetica", "bold"); docPDF.text(`${formatDateDisplay(job.scheduledDate) || '-'}`, 52, 58);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Cliente:`, 110, 58); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.client || 'Sin Cliente'}`, 125, 58);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Vehículo:`, 20, 66); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.brand || '-'} ${job.model || '-'}`, 40, 66);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Patente/VIN:`, 110, 66); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.plate || job.vin || '-'}`, 135, 66);
    
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

    docPDF.setFont("helvetica", "normal"); docPDF.text(`Ruta:`, 20, 74); docPDF.setFont("helvetica", "bold"); docPDF.text(routeText, 35, 74);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Conductor:`, 20, 82); docPDF.setFont("helvetica", "bold"); docPDF.text(`${driverNameStr}`, 45, 82);

    docPDF.setFillColor(241, 245, 249); docPDF.rect(15, 95, 180, 45, 'F');
    docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("2. ESTADO Y DOCUMENTACIÓN", 20, 103);
    
    docPDF.setFontSize(11);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Nivel de Combustible:`, 20, 113); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.fuelLevel || '0'}%`, 65, 113);
    
    const docs = job.checklist?.docs || {};
    docPDF.setFont("helvetica", "normal"); docPDF.text(`SOAP:`, 20, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.soap ? 'SÍ' : 'NO', 35, 122);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Permiso de Circ.:`, 60, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.permiso ? 'SÍ' : 'NO', 93, 122);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Rev. Técnica:`, 120, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.revTecnica ? 'SÍ' : 'NO', 148, 122);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Gases:`, 165, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.gases ? 'SÍ' : 'NO', 180, 122);
    
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Observaciones:`, 20, 131); 
    const obsSplit = docPDF.splitTextToSize(`${job.checklist?.observations || 'Ninguna'}`, 140); docPDF.text(obsSplit, 50, 131);

    const startY = 131 + (obsSplit.length * 5) + 10;
    docPDF.setFillColor(241, 245, 249); docPDF.rect(15, startY, 180, 80, 'F');
    
    if (job.tripType === 'revision') {
       docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("3. RESULTADO REVISIÓN", 20, startY + 8);
       docPDF.setFontSize(12);
       if (job.checklist?.rtStatus === 'aprobado') {
         docPDF.setTextColor(22, 163, 74); docPDF.text("APROBADO", 20, startY + 20); docPDF.setTextColor(0, 0, 0);
       } else {
         docPDF.setTextColor(220, 38, 38); docPDF.text("RECHAZADO", 20, startY + 20); docPDF.setTextColor(0, 0, 0);
         docPDF.setFontSize(11); docPDF.setFont("helvetica", "normal");
         docPDF.text(`Razón: ${job.checklist?.rtRejectReason || 'No especificada'}`, 20, startY + 30);
       }
       
       // Incluir siempre los datos de recepción en revisiones, como solicitó el usuario
       docPDF.setFontSize(11);
       if (job.checklist?.noReception) {
         docPDF.setTextColor(220, 38, 38);
         docPDF.text("ENTREGA SIN RECEPCIÓN (Confirmada por conductor)", 20, startY + 45);
         docPDF.setTextColor(0, 0, 0);
       } else {
         docPDF.setFont("helvetica", "normal"); docPDF.text(`Receptor:`, 20, startY + 45); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverName || 'N/A'}`, 42, startY + 45);
         docPDF.setFont("helvetica", "normal"); docPDF.text(`RUT:`, 110, startY + 45); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverRut || 'N/A'}`, 122, startY + 45);
         if(job.checklist?.signatureData) { docPDF.setFont("helvetica", "normal"); docPDF.text(`Firma conformada:`, 20, startY + 65); docPDF.addImage(job.checklist.signatureData, 'PNG', 55, startY + 50, 70, 30); }
       }
    } else {
      docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("3. RECEPCIÓN", 20, startY + 8);
      
      if (job.checklist?.noReception) {
        docPDF.setTextColor(220, 38, 38);
        docPDF.setFontSize(12);
        docPDF.text("ENTREGA SIN RECEPCIÓN (Confirmada por conductor)", 20, startY + 20);
        docPDF.setTextColor(0, 0, 0);
      } else {
        docPDF.setFontSize(11);
        docPDF.setFont("helvetica", "normal"); docPDF.text(`Receptor:`, 20, startY + 18); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverName || 'N/A'}`, 42, startY + 18);
        docPDF.setFont("helvetica", "normal"); docPDF.text(`RUT:`, 110, startY + 18); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverRut || 'N/A'}`, 122, startY + 18);
        if(job.checklist?.signatureData) { docPDF.setFont("helvetica", "normal"); docPDF.text(`Firma conformada:`, 20, startY + 45); docPDF.addImage(job.checklist.signatureData, 'PNG', 55, startY + 30, 70, 45); }
      }

      if (job.checklist?.location) {
        const { lat, lng } = job.checklist.location;
        docPDF.setFont("helvetica", "normal"); docPDF.text(`Ubicación GPS:`, 20, startY + 28);
        docPDF.setTextColor(37, 99, 235); docPDF.textWithLink('Ver en Google Maps', 52, startY + 28, { url: `https://www.google.com/maps?q=${lat},${lng}` }); docPDF.setTextColor(0, 0, 0); 
      } else { docPDF.setFont("helvetica", "normal"); docPDF.text(`Ubicación GPS: No registrada`, 20, startY + 28); }
    }

    if (job.checklist?.photos) {
      const photos = job.checklist.photos;
      const labels = { front: 'Frente', left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atrás', tire: 'Repuesto', dashboard: 'Tablero', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4' };
      let currentY = 30; let currentCol = 1; let addedPage = false;
      const getImageDims = (src) => new Promise(resolve => { const img = new Image(); img.onload = () => resolve({ w: img.width, h: img.height }); img.src = src; });

      for (const key in photos) {
        if (photos[key]) {
          if (!addedPage) {
            docPDF.addPage(); docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 20, 'F'); docPDF.setTextColor(255, 255, 255);
            docPDF.setFontSize(16); docPDF.setFont("helvetica", "bold"); docPDF.text(`REGISTRO FOTOGRÁFICO ADJUNTO`, 105, 14, null, null, "center"); docPDF.setTextColor(0, 0, 0); addedPage = true;
          }
          const dims = await getImageDims(photos[key]);
          const ratio = dims.h / dims.w;
          let imgW = 80; let imgH = imgW * ratio; if (imgH > 100) { imgH = 100; imgW = imgH / ratio; }
          const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2);

          if (currentY + imgH > 280) {
             docPDF.addPage(); currentY = 30; docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 20, 'F'); docPDF.setTextColor(255, 255, 255);
             docPDF.setFontSize(16); docPDF.setFont("helvetica", "bold"); docPDF.text(`REGISTRO FOTOGRÁFICO (CONT.)`, 105, 14, null, null, "center"); docPDF.setTextColor(0, 0, 0);
          }
          docPDF.setFontSize(11); docPDF.setFont("helvetica", "bold"); docPDF.text(labels[key] || key, slotCenter, currentY - 3, { align: "center" });
          docPDF.setDrawColor(200, 200, 200); docPDF.rect(finalX - 1, currentY - 1, imgW + 2, imgH + 2); 
          docPDF.addImage(photos[key], 'JPEG', finalX, currentY, imgW, imgH);
          if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; currentY += (imgH > 80 ? imgH : 80) + 15; }
        }
      }
    }
    return docPDF;
  };

  const getJobDateStr = (job) => job.scheduledDate ? formatDateDisplay(job.scheduledDate) : formatDateDisplay(new Date().toISOString().split('T')[0]);
  
  const handleCopyWhatsApp = (job) => { 
    const dateStr = getJobDateStr(job);
    const dateShort = dateStr.substring(0, 5); 
    const text = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}`; 
    navigator.clipboard.writeText(text).then(() => { 
      showAlert("✅ Formato copiado al portapapeles. Listo para pegar en WhatsApp."); 
      setMenuOpenId(null); 
    }).catch(() => showAlert("Tu navegador bloqueó el copiado automático."));
  };

  const generatePDF = async (job) => {
    try { const docPDF = await buildPDFDoc(job); const fileName = `Check.${getJobDateStr(job).replace(/\//g, '-')}.${job.client || 'SinCliente'}.${job.plate || job.vin || 'SN'}.pdf`; docPDF.save(fileName); } 
    catch(e) { console.error(e); showAlert("Hubo un error al generar PDF."); }
  };

  const handleShareWhatsAppPDF = async (job) => {
    try {
      const dateStrForFile = getJobDateStr(job).replace(/\//g, '-');
      const dateShort = getJobDateStr(job).substring(0, 5);
      const fileName = `Check.${dateStrForFile}.${job.client || 'SinCliente'}.${job.plate || job.vin || 'SN'}.pdf`;
      const text = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}`;
      
      const docPDF = await buildPDFDoc(job); const pdfBlob = docPDF.output('blob'); const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title: fileName, text: text, files: [file] }); } 
      else { showAlert("Tu dispositivo no soporta compartir el archivo directamente. Descárgalo primero y compártelo manual."); handleCopyWhatsApp(job); }
    } catch (e) { console.error(e); }
  };

  return (
    <>
      <div className="pb-20">
        {activeJobs.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {activeJobs.map(job => {
              let realizedByName = '';
              if (job.status === 'accepted') {
                if (job.acceptedByEmail) { const foundD = drivers?.find(d => d.email === job.acceptedByEmail); realizedByName = foundD ? foundD.name : job.acceptedByEmail; } 
                else if (job.assignedDriverName) { realizedByName = job.assignedDriverName; }
              }

              return (
              <div key={job.id} className={`bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col relative transform transition-all duration-200 ${menuOpenId === job.id ? 'z-50 ring-2 ring-blue-100 scale-[1.02]' : 'z-10 hover:-translate-y-1'}`}>
                <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider ${job.status==='pending'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>
                    {job.status === 'pending' ? 'Pendiente' : 'En Curso'}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {isAdminView && (
                      <button onClick={() => onEditJob(job)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors" title="Editar Trabajo">
                        <Edit2 className="w-5 h-5"/>
                      </button>
                    )}
                    
                    <div className="relative">
                      <button onClick={() => setMenuOpenId(menuOpenId === job.id ? null : job.id)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors"><MoreVertical className="w-5 h-5"/></button>
                      {menuOpenId === job.id && (
                        <div className="absolute right-0 top-10 bg-white border border-slate-100 shadow-2xl rounded-2xl w-56 z-50 overflow-hidden">
                          <button onClick={() => handleCopyWhatsApp(job)} className="w-full text-left px-5 py-4 text-sm font-bold flex items-center gap-3 hover:bg-slate-50 text-slate-700 transition-colors"><Copy className="w-5 h-5 text-slate-400"/> Copiar formato texto</button>
                          <button onClick={() => { setJobToFail(job); setMenuOpenId(null); }} className="w-full text-left px-5 py-4 text-sm font-bold flex items-center gap-3 hover:bg-red-50 text-red-600 border-t border-slate-50 transition-colors"><XCircle className="w-5 h-5"/> Marcar Fallido</button>
                          {isAdminView && <button onClick={() => handleDeleteJob(job.id)} className="w-full text-left px-5 py-4 text-sm font-bold flex items-center gap-3 hover:bg-red-50 text-red-600 border-t border-slate-50 transition-colors"><Trash2 className="w-5 h-5"/> Eliminar Trabajo</button>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1">
                  <h3 className="font-extrabold text-xl text-slate-800 leading-tight mb-1">{job.brand || 'Sin Marca'} {job.model || ''}</h3>
                  <div className="flex items-center gap-2 mb-4 mt-2">
                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg"><Calendar className="w-4 h-4"/><span className="text-xs font-extrabold">{job.scheduledDate ? formatDateDisplay(job.scheduledDate) : 'Hoy'}</span></div>
                    <p className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">{job.client || 'Sin Cliente Asignado'}</p>
                  </div>
                  
                  {job.tripType === 'revision' && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 p-2 rounded-xl text-center">
                      <span className="text-[10px] font-black text-amber-700 uppercase">REVISIÓN TÉCNICA (TIPO {job.rtData?.type})</span>
                      <p className="text-[9px] font-bold text-amber-600 mt-0.5">
                        {job.rtData?.type === 'A' ? 
                          [job.rtData?.gases && 'Gases', job.rtData?.revision && 'Revisión', job.rtData?.inspeccion && 'Insp. Visual', job.rtData?.frenos && 'Cert. Frenos'].filter(Boolean).join(' • ')
                        : (job.rtData?.tipoB === 'gases' ? 'Sólo Gases' : 'Revisión Completa')}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-slate-300 shrink-0"/> <span className="text-sm font-bold text-slate-600">{job.origin || 'No especificado'}</span></div>
                    <div className="flex items-start gap-3"><Navigation className="w-5 h-5 text-slate-300 shrink-0"/> 
                      <span className="text-sm font-bold text-slate-600">
                        {job.tripType === 'revision' ? 'Planta de Revisión (PRT)' : (job.destination || 'No especificado')}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patente/VIN</span><span className="font-extrabold text-slate-700 uppercase bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-100">{job.plate || job.vin || 'N/A'}</span>
                  </div>
                </div>

                {isAdminView && (
                  <div className="px-6 py-3 bg-blue-50/50 border-t border-blue-100 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500 shrink-0"/>
                    {job.status === 'pending' ? <p className="text-xs font-bold text-slate-600">Notificados: <span className="text-blue-700 font-extrabold">{job.assignedDrivers?.map(d=>d.name.split(' ')[0]).join(', ') || 'Nadie'}</span></p> : <p className="text-xs font-bold text-slate-600">Responsable: <span className="text-blue-700 font-extrabold">{realizedByName}</span></p>}
                  </div>
                )}
                
                <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl space-y-3">
                  {job.status === 'pending' && (!isAdminView || job.assignedEmails?.includes(currentUserEmail)) && <button onClick={() => handleAcceptJob(job)} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors shadow-lg shadow-blue-200">Reclamar Traslado</button>}
                  {((job.status === 'accepted' && (isAdminView || job.acceptedByEmail === currentUserEmail)) || (job.status !== 'completed' && job.status !== 'failed' && isAdminView)) && <button onClick={() => onStartChecklist(job)} className="w-full bg-green-600 hover:bg-green-700 text-white text-base font-extrabold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-colors shadow-lg shadow-green-200"><FileText className="w-5 h-5" /> Llenar Checklist</button>}
                </div>
              </div>
            )})}
          </div>
        )}

        {/* SECCIÓN 2: HISTORIAL DE COMPLETADOS (LISTA SIMPLIFICADA) */}
        {historyJobs.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 pb-2">
               <h3 className="text-xl font-extrabold text-slate-800">Historial de Trabajos</h3>
               {isAdminView && (
                  <select onChange={e=>setHistoryClientFilter(e.target.value)} className="border-2 border-slate-200 p-1.5 rounded-lg text-xs font-bold outline-none text-slate-600">
                    <option value="">Todos los Clientes</option>
                    {CLIENTES.map(c=><option key={c} value={c}>{c}</option>)}
                    <option value="OTRO">Otros</option>
                  </select>
               )}
            </div>
            
            <div className="flex flex-col gap-4">
              {historyJobs.map(job => (
                <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${job.status === 'failed' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 ml-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${job.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        {job.status === 'failed' ? 'Fallido' : 'Completado'}
                      </span>
                      {job.tripType === 'revision' && <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-amber-50 text-amber-700">Revisión Técnica</span>}
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> {getJobDateStr(job)}</span>
                    </div>
                    
                    <div className="flex gap-2 mt-3 sm:mt-0 ml-2 sm:ml-0 w-full sm:w-auto relative">
                      <button onClick={() => handleCopyWhatsApp(job)} className="p-2 flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors flex justify-center items-center" title="Copiar Formato Texto"><Copy className="w-4 h-4"/></button>
                      <button onClick={() => generatePDF(job)} className="p-2 flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors flex justify-center items-center" title="Descargar PDF"><FileDown className="w-4 h-4"/></button>
                      {job.status !== 'failed' && <button onClick={() => handleShareWhatsAppPDF(job)} className="p-2 flex-[2] sm:flex-none bg-green-100 hover:bg-green-200 text-green-700 rounded-xl transition-colors flex justify-center items-center gap-1.5" title="Compartir PDF por WhatsApp"><Share2 className="w-4 h-4"/><span className="text-xs font-bold sm:hidden">Compartir PDF</span></button>}
                      
                      {isAdminView && (
                        <>
                          <button onClick={() => setMenuOpenId(menuOpenId === job.id ? null : job.id)} className="p-2 flex-1 sm:flex-none bg-slate-50 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors flex justify-center items-center"><MoreVertical className="w-4 h-4"/></button>
                          {menuOpenId === job.id && (
                            <div className="absolute right-0 top-10 bg-white border border-slate-100 shadow-2xl rounded-2xl w-48 z-50 overflow-hidden">
                              <button onClick={() => handleDeleteJob(job.id)} className="w-full text-left px-5 py-4 text-sm font-bold flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors"><Trash2 className="w-4 h-4"/> Eliminar Historial</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 ml-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Vehículo</p><p className="text-sm font-extrabold text-slate-800">{job.brand} {job.model}</p></div>
                    <div><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Patente/VIN</p><p className="text-sm font-extrabold text-slate-800 uppercase">{job.plate || job.vin || 'S/N'}</p></div>
                    <div className="col-span-2 sm:col-span-2"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Ruta</p><p className="text-sm font-bold text-slate-600">{getRouteStr(job)}</p></div>
                  </div>

                  {job.status === 'failed' && (
                    <div className="mt-3 ml-2 bg-red-50 border border-red-100 p-2.5 rounded-lg flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5"/>
                      <p className="text-xs font-bold text-red-800"><span className="uppercase text-[10px] block text-red-500 mb-0.5">Motivo del fallo:</span> {job.failedReason || 'No especificado'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensaje Vacío General */}
        {activeJobs.length === 0 && historyJobs.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm"><p className="text-slate-400 font-extrabold text-lg">No hay trabajos disponibles.</p></div>
        )}
      </div>

      {/* MODAL PARA JUSTIFICAR EL FALLO */}
      {jobToFail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleFailJob(jobToFail, e.target.reason.value); }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-extrabold text-slate-800 mb-2 flex items-center gap-2"><XCircle className="text-red-500 w-6 h-6"/> Reportar Trabajo Fallido</h3>
            <p className="text-sm font-bold text-slate-500 mb-6">El trabajo será marcado como terminado con estado fallido. Indica el motivo:</p>
            <textarea name="reason" required placeholder="Ej. El cliente no se presentó, vehículo con falla mecánica..." className="w-full border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-red-500 font-bold text-slate-700 mb-6" rows="4"></textarea>
            <div className="flex gap-4">
              <button type="button" onClick={() => setJobToFail(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-extrabold text-slate-600">Cancelar</button>
              <button type="submit" className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold shadow-lg shadow-red-200">Marcar Fallido</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ==========================================
// 5. COMPONENTE: FORMULARIO DE CHECKLIST (CON AUTOGUARDADO)
// ==========================================
function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm }) {
  const isQuickJob = job.id === 'NEW_QUICK_JOB';

  const [step, setStep] = useState(1);
  const [loadingLoc, setLoadingLoc] = useState(false);

  const [formData, setFormData] = useState({
    scheduledDate: job.scheduledDate || new Date().toISOString().split('T')[0],
    client: job.client || '', brand: job.brand || '', model: job.model || '', plateOrVin: job.plate || job.vin || '',
    origin: job.origin || '', destination: job.destination || '', fuelLevel: 50, 
    photos: { front: false, left: false, right: false, back: false, tire: false, dashboard: false, det1: false, det2: false, det3: false, det4: false },
    docs: { soap: false, permiso: false, revTecnica: false, gases: false }, 
    observations: '', receiverName: '', receiverCompany: '', receiverRut: '', receiverEmail: '', signatureData: null, location: null,
    noReception: false, rtStatus: 'aprobado', rtRejectReason: '', rtReturnOption: 'origin', rtReturnDestination: '' 
  });

  const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleImageUpload = async (e, photoId) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const bmp = await window.createImageBitmap(file, { resizeWidth: 800, resizeQuality: 'medium' });
      const canvas = document.createElement('canvas'); canvas.width = bmp.width; canvas.height = bmp.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bmp, 0, 0);
      updateForm('photos', { ...formData.photos, [photoId]: canvas.toDataURL('image/jpeg', 0.6) });
      bmp.close();
    } catch (error) { console.error(error); showAlert("Error de memoria al procesar la foto."); }
  };

  const handleGetLocation = () => {
    setLoadingLoc(true);
    if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => { updateForm('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoadingLoc(false); }, () => { showAlert("Error GPS."); setLoadingLoc(false); }); }
  };

  const submitForm = async (e) => { 
    e.preventDefault(); 
    if (!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es obligatoria."); 
    
    let submitData = { ...formData };
    if (formData.noReception) {
      submitData.receiverName = 'ENTREGA SIN RECEPCIÓN';
      submitData.receiverRut = 'N/A';
      submitData.receiverEmail = 'N/A';
    }

    const finalData = {
      scheduledDate: submitData.scheduledDate, client: submitData.client, brand: submitData.brand, model: submitData.model, vin: submitData.plateOrVin, plate: submitData.plateOrVin, origin: submitData.origin, destination: submitData.destination,
      status: 'completed', completedAt: Date.now(), checklist: submitData, tripType: job.tripType || 'traslado', expectedTollCost: job.expectedTollCost || 0
    };

    try {
      if (isQuickJob) { 
        finalData.createdAt = Date.now(); finalData.assignedDriverName = "Auto-creado"; finalData.acceptedByEmail = currentUserEmail; 
        
        if (submitData.plateOrVin) {
          const vehRef = collection(db, 'vehicles');
          onSnapshot(vehRef, async (snap) => {
            if (!snap.docs.find(doc => doc.data().plate === submitData.plateOrVin.toUpperCase())) {
              await addDoc(vehRef, { plate: submitData.plateOrVin.toUpperCase(), brand: submitData.brand, model: submitData.model, client: submitData.client, createdAt: Date.now() });
            }
          });
        }
        await addDoc(collection(db, 'transport_jobs'), finalData); 
      } 
      else { 
        if (job.tripType === 'revision' && submitData.rtStatus === 'rechazado') {
           finalData.status = 'failed';
           finalData.failedReason = submitData.rtRejectReason || 'Revisión Técnica Rechazada';
           
           const cloneJob = {
              scheduledDate: submitData.scheduledDate, client: submitData.client, brand: submitData.brand, model: submitData.model, vin: submitData.plateOrVin, plate: submitData.plateOrVin, origin: submitData.origin, destination: submitData.destination,
              tripType: job.tripType, rtData: job.rtData,
              assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [],
              status: 'pending', createdAt: Date.now(), checklist: null
           };
           await addDoc(collection(db, 'transport_jobs'), cloneJob);
        }
        await updateDoc(doc(db, 'transport_jobs', job.id), finalData); 
      }
      
      if (job.tripType === 'revision' && submitData.rtStatus === 'rechazado') {
          showAlert("Revisión guardada como RECHAZADA. Se ha creado un nuevo traslado pendiente.");
      } else {
          showAlert("✅ Checklist guardado correctamente."); 
      }
      onComplete();
    } catch (error) { console.error(error); showAlert("Hubo un error al guardar. Verifica tu conexión a internet."); onComplete(); }
  };

  const handleCancelClick = () => { 
    showConfirm("¿Estás seguro de cancelar? Se perderán los datos ingresados en este checklist.", () => { 
      onCancel(); 
    }); 
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden pb-10">
      <div className="bg-blue-600 text-white p-6 flex justify-between items-center">
        <h2 className="text-xl font-extrabold flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">{isQuickJob ? <Zap className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white" />}</div>
          {isQuickJob ? "Checklist Rápido" : "Checklist Asignado"}
        </h2>
        <button onClick={handleCancelClick} className="text-blue-100 text-sm font-bold hover:text-white bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-xl transition-colors">Cancelar</button>
      </div>
      <div className="flex bg-slate-100 h-1.5"><div className={`bg-green-500 transition-all duration-500 ${step === 1 ? 'w-1/2' : 'w-full'}`}></div></div>
      
      <div className="p-6 sm:p-8">
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-extrabold text-slate-800 border-b-2 border-slate-100 pb-2">Datos Principales</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <input type="date" value={formData.scheduledDate} onChange={e=>updateForm('scheduledDate', e.target.value)} required className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" />
              <select value={formData.client} onChange={e=>updateForm('client', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 bg-white">
                <option value="">Seleccione Cliente...</option>
                {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTRO">Otro (Ingreso manual)</option>
              </select>
              <input value={formData.brand} onChange={e=>updateForm('brand', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Marca" />
              <input value={formData.model} onChange={e=>updateForm('model', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Modelo" />
              <input value={formData.plateOrVin} onChange={e=>updateForm('plateOrVin', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl uppercase outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Patente o VIN" />
              <input value={formData.origin} onChange={e=>updateForm('origin', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Desde" />
              <input value={formData.destination} onChange={e=>updateForm('destination', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Hasta" />
            </div>

            {job.tripType === 'revision' && (
              <>
                <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-blue-600">Resultado de la Revisión</h3>
                <select value={formData.rtStatus} onChange={e=>updateForm('rtStatus', e.target.value)} className={`w-full border-2 p-4 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <option value="aprobado">✅ APROBADO</option>
                  <option value="rechazado">❌ RECHAZADO</option>
                </select>
                {formData.rtStatus === 'rechazado' && (
                  <input value={formData.rtRejectReason} onChange={e=>updateForm('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required className="w-full border-2 border-red-300 p-4 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2" />
                )}
                {formData.rtStatus === 'aprobado' && (
                  <div className="mt-4 p-4 border-2 border-green-200 bg-green-50 rounded-xl space-y-3">
                    <p className="text-sm font-bold text-green-800">¿Hacia dónde se dirige el vehículo tras aprobar?</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700">
                        <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e=>updateForm('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                        Volver al Origen
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700">
                        <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e=>updateForm('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                        Otro Destino
                      </label>
                    </div>
                    {formData.rtReturnOption === 'other' && (
                      <input value={formData.rtReturnDestination} onChange={e=>updateForm('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required className="w-full border-2 border-green-300 p-3 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />
                    )}
                  </div>
                )}
              </>
            )}

            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-slate-800">Documentos a bordo</h3>
            <div className="grid grid-cols-2 gap-3">
              {[{ id: 'soap', label: 'SOAP' }, { id: 'permiso', label: 'Permiso Circulación' }, { id: 'revTecnica', label: 'Revisión Técnica' }, { id: 'gases', label: 'Revisión Gases' }].map(doc => (
                <label key={doc.id} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData.docs[doc.id] ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  <input type="checkbox" className="w-5 h-5 text-green-600 rounded cursor-pointer" checked={formData.docs[doc.id]} onChange={(e) => updateForm('docs', { ...formData.docs, [doc.id]: e.target.checked })} />
                  <span className="font-extrabold text-sm">{doc.label}</span>
                </label>
              ))}
            </div>
            
            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-blue-600">Fotografías</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[{id:'front', l:'Frente'}, {id:'left', l:'Lat. Piloto'}, {id:'right', l:'Lat. Copiloto'}, {id:'back', l:'Atrás'}, {id:'tire', l:'Repuesto'}, {id:'dashboard', l:'Tablero'}, {id:'det1', l:'Detalle 1'}, {id:'det2', l:'Detalle 2'}, {id:'det3', l:'Detalle 3'}, {id:'det4', l:'Detalle 4'}].map(p => (
                <label key={p.id} className={`p-1 border-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative overflow-hidden h-28 ${formData.photos[p.id] ? 'bg-green-50 border-green-400 shadow-md shadow-green-100' : 'border-dashed border-slate-300 hover:bg-slate-50 hover:border-slate-400'}`}>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, p.id)} />
                  {formData.photos[p.id] ? (
                    <><img src={formData.photos[p.id]} alt={p.l} className="absolute inset-0 w-full h-full object-cover opacity-50" /><CheckCircle className="text-green-600 w-8 h-8 relative z-10 bg-white rounded-full shadow-sm"/><span className="text-[10px] font-extrabold text-slate-800 text-center relative z-10 bg-white/90 px-2 py-0.5 rounded-full shadow-sm mt-1">{p.l}</span></>
                  ) : (
                    <><div className="bg-slate-100 p-2 rounded-full mb-1"><Camera className="text-slate-400 w-5 h-5"/></div><span className="text-[10px] font-extrabold text-slate-500 text-center uppercase tracking-wider">{p.l}</span></>
                  )}
                </label>
              ))}
            </div>

            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-slate-800">Combustible: <span className="text-blue-600">{formData.fuelLevel}%</span></h3>
            <div className="w-full relative h-10 mt-2 flex flex-col justify-center">
               <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 opacity-20 pointer-events-none"></div>
               <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={(e) => updateForm('fuelLevel', e.target.value)} className="w-full accent-blue-600 h-3 bg-transparent rounded-full appearance-none cursor-pointer z-10 relative" style={{background: `linear-gradient(to right, ${formData.fuelLevel < 30 ? '#ef4444' : formData.fuelLevel < 80 ? '#eab308' : '#22c55e'} ${formData.fuelLevel}%, #e2e8f0 ${formData.fuelLevel}%)`}} />
            </div>
            
            <textarea rows="3" value={formData.observations} onChange={(e) => updateForm('observations', e.target.value)} placeholder="Observaciones de daños o detalles..." className="w-full border-2 border-slate-200 p-4 text-sm outline-none focus:border-blue-500 rounded-xl mt-6 font-bold text-slate-700"></textarea>
            
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-extrabold transition-all shadow-xl shadow-blue-200 text-lg mt-8">Continuar a Recepción</button>
          </div>
        )}
        
        {step === 2 && (
          <form onSubmit={submitForm} className="space-y-6">
            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 text-slate-800">Datos de Recepción</h3>
            
            <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-colors ${formData.noReception ? 'bg-amber-50 border-amber-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
              <input type="checkbox" checked={formData.noReception} onChange={e => updateForm('noReception', e.target.checked)} className="w-5 h-5 accent-amber-600 rounded cursor-pointer" />
              <span className="font-extrabold text-sm text-slate-700">Entregar sin recepción (Local cerrado, buzón, etc.)</span>
            </label>

            {!formData.noReception && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input required={!formData.noReception} value={formData.receiverName} onChange={e=>updateForm('receiverName', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Nombre completo del receptor" />
                  <input required={!formData.noReception} value={formData.receiverRut} onChange={e=>updateForm('receiverRut', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="RUT" />
                  <input type="email" value={formData.receiverEmail} onChange={e=>updateForm('receiverEmail', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl col-span-1 sm:col-span-2 outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Correo electrónico (Opcional)" />
                </div>
                <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-slate-800">Firma del Receptor</h3>
                <SignaturePad initialData={formData.signatureData} onSave={(data) => updateForm('signatureData', data)} onClear={() => updateForm('signatureData', null)} />
              </>
            )}

            <button type="button" onClick={handleGetLocation} className={`px-4 py-4 rounded-2xl text-base w-full font-extrabold transition-all shadow-sm ${formData.location ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-transparent'}`}>
              {formData.location ? "📍 GPS Capturado Exitosamente" : "📍 Tocar para Capturar GPS Actual"}
            </button>
            
            <div className="flex gap-4 pt-8 border-t-2 border-slate-100 mt-8">
              <button type="button" onClick={() => setStep(1)} className="flex-1 bg-slate-100 hover:bg-slate-200 py-4 rounded-2xl font-extrabold transition-colors text-slate-600">Atrás</button>
              <button type="submit" className="flex-[2] bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-extrabold transition-all shadow-xl shadow-green-200 text-lg">Guardar y Finalizar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}