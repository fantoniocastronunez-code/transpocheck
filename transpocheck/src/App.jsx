import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, 
  Plus, User, Navigation, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, Edit2, Bell, Share2, X, Calendar, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Map, Ticket
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
const googleProvider = new GoogleAuthProvider();

try { enableIndexedDbPersistence(db).catch(() => {}); } catch (e) {}

const CLIENTES = ["Grandleasing", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];

const SignaturePad = ({ onSave, onClear, initialData }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
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
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    if (type === 'start') { ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); }
    if (type === 'draw' && isDrawing) { ctx.lineTo(x, y); ctx.stroke(); }
    if (type === 'stop') { setIsDrawing(false); if (onSave) onSave(canvas.toDataURL()); }
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
  const [fleetFilter, setFleetFilter] = useState('');
  
  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [mainTab, setMainTab] = useState('jobs');
  const [activeRole, setActiveRole] = useState('driver');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const isFirstLoad = useRef(true);

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
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: '/logo.png', vibrate: [200, 100, 200] })).catch(() => new Notification(title, { body }));
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
    if (isRealAdmin) setActiveRole('admin');
    else setActiveRole('driver');
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center justify-center p-4" style={{fontFamily: "'Nunito', sans-serif"}}>
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
      if (['completed', 'accepted', 'failed'].includes(j.status)) realizedBy = j.acceptedByEmail ? (drivers.find(d => d.email === j.acceptedByEmail)?.name || j.acceptedByEmail) : (j.assignedDriverName || '');
      let st = j.status === 'pending' ? 'Pendiente' : j.status === 'accepted' ? 'En Curso' : j.status === 'completed' ? 'Completado' : `Fallido - ${j.failedReason || ''}`;
      return [j.id, `"${formatDateDisplay(j.scheduledDate) || ''}"`, `"${j.client || ''}"`, `"${j.brand || ''}"`, `"${j.model || ''}"`, `"${j.plate || j.vin || ''}"`, `"${j.origin || ''}"`, `"${j.destination || ''}"`, `"${j.assignedDrivers?.map(d=>d.name).join(' - ') || ''}"`, `"${realizedBy}"`, `"${st}"`, `"${new Date(j.createdAt).toLocaleString()}"`];
    });
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = "Reporte_Trabajos.csv"; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const NewJobForm = () => {
    const [client, setClient] = useState('');
    const [manualClient, setManualClient] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [plate, setPlate] = useState('');
    const [tripType, setTripType] = useState('traslado');
    const [selectedDestId, setSelectedDestId] = useState('');
    const [tollCat, setTollCat] = useState('priceAuto');

    const selDest = destinations.find(d => d.id === selectedDestId);
    const totalTolls = selDest ? selDest.tolls.reduce((acc, tid) => {
      const t = tolls.find(x => x.id === tid);
      return acc + (t ? Number(t[tollCat]) : 0);
    }, 0) : 0;

    const handlePlateChange = (e) => {
      const val = e.target.value.toUpperCase();
      setPlate(val);
      const v = vehicles.find(x => x.plate === val);
      if (v) {
        setBrand(v.brand); setModel(v.model);
        if (CLIENTES.includes(v.client)) setClient(v.client); else { setClient('OTRO'); setManualClient(v.client); }
      }
    };

    const submitJob = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const driverIds = fd.getAll('assignedDriverId');
      if (!driverIds.length) return showAlert("Selecciona al menos un conductor.");
      const cFinal = client === 'OTRO' ? manualClient : client;
      
      const nj = {
        scheduledDate: fd.get('scheduledDate'), client: cFinal, brand, model, vin: plate, plate,
        origin: fd.get('origin'), destination: tripType === 'viaje' ? (selDest?.name || '') : fd.get('destination'),
        tripType, expectedTollCost: tripType === 'viaje' ? totalTolls : 0, tollCategory: tripType === 'viaje' ? tollCat : null,
        assignedDrivers: drivers.filter(d => driverIds.includes(d.id)).map(d => ({id:d.id, name:d.name, email:d.email})),
        assignedEmails: drivers.filter(d => driverIds.includes(d.id)).map(d => d.email),
        status: 'pending', createdAt: Date.now(), checklist: null
      };
      
      try { 
        await addDoc(collection(db, 'transport_jobs'), nj); 
        if (plate && !vehicles.find(v => v.plate === plate)) await addDoc(collection(db, 'vehicles'), { plate, brand, model, client: cFinal, createdAt: Date.now() });
        setAdminTab('dashboard'); showAlert(`Trabajo guardado y asignado.`); 
      } catch (e) { console.error(e); }
    };

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-extrabold mb-6 border-b pb-4 text-slate-800">Crear Nuevo Traslado</h2>
        <form onSubmit={submitJob} className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-700">1. Tipo de Servicio</h3>
            <div className="flex gap-4">
              <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer text-center font-bold transition-colors ${tripType === 'traslado' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                <input type="radio" name="tripType" value="traslado" checked={tripType==='traslado'} onChange={()=>setTripType('traslado')} className="hidden"/> Traslado Local
              </label>
              <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer text-center font-bold transition-colors ${tripType === 'viaje' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                <input type="radio" name="tripType" value="viaje" checked={tripType==='viaje'} onChange={()=>setTripType('viaje')} className="hidden"/> Viaje Interurbano
              </label>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="font-bold text-slate-700">2. Vehículo</h3>
             <div className="grid grid-cols-2 gap-4">
               <input value={plate} onChange={handlePlateChange} type="text" placeholder="Patente o VIN" className="w-full border-2 p-3 rounded-xl col-span-2 uppercase outline-none focus:border-blue-500 font-bold bg-white text-blue-900" />
               <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
               <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
             </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-700">3. Programación y Ruta</h3>
            <div className="grid grid-cols-2 gap-4">
              <input name="scheduledDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-700" />
              <select value={client} onChange={e => setClient(e.target.value)} className="w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white">
                <option value="">Cliente...</option>
                {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTRO">Otro</option>
              </select>
              {client === 'OTRO' && <input type="text" value={manualClient} onChange={e => setManualClient(e.target.value)} placeholder="Escribe cliente" className="col-span-2 w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />}
              
              <input name="origin" type="text" placeholder="Origen" className="col-span-2 w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
              
              {tripType === 'traslado' ? (
                <input name="destination" type="text" placeholder="Destino" className="col-span-2 w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
              ) : (
                <div className="col-span-2 space-y-4">
                  <select value={selectedDestId} onChange={e => setSelectedDestId(e.target.value)} required className="w-full border-2 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-800 bg-white">
                    <option value="">Seleccione Destino Interurbano...</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {selectedDestId && (
                    <div className="p-4 bg-white border-2 border-blue-100 rounded-xl space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase">Cálculo de Peajes</p>
                      <select value={tollCat} onChange={e => setTollCat(e.target.value)} className="w-full border p-2 rounded-lg text-sm font-semibold outline-none focus:border-blue-500">
                        <option value="priceAuto">Auto / Camioneta</option>
                        <option value="priceTruck2">Camión 2 Ejes</option>
                        <option value="priceTruckMore">Camión más 2 Ejes</option>
                      </select>
                      <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                        <span className="font-bold text-blue-800">Gastos Estimados:</span>
                        <span className="font-black text-blue-600 text-lg">{formatMoney(totalTolls)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="font-bold text-slate-700">4. Conductores</h3>
             <div className="max-h-48 overflow-y-auto border-2 bg-white rounded-xl">
                {drivers.map(d => (
                  <label key={d.id} className="flex items-center p-3 border-b hover:bg-blue-50 cursor-pointer">
                    <input type="checkbox" name="assignedDriverId" value={d.id} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                    <span className="ml-3 font-bold text-slate-800">{d.name}</span>
                  </label>
                ))}
             </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-extrabold text-lg shadow-lg shadow-blue-200">Guardar y Asignar</button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans" style={{fontFamily: "'Nunito', sans-serif"}}>
      <header className="bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl"><Car className="w-6 h-6" /></div>
          <h1 className="font-extrabold text-2xl hidden sm:block">LogisticAPP</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {!notificationsEnabled && <button onClick={requestNotificationPermission} className="p-2 bg-amber-500 rounded-xl"><Bell className="w-5 h-5" /></button>}
          {isRealAdmin && (
            <button onClick={() => setActiveRole(activeRole === 'admin' ? 'driver' : 'admin')} className="flex items-center gap-1.5 bg-white/20 px-3 py-2 rounded-xl text-sm font-bold">
              {activeRole === 'admin' ? <ToggleRight className="w-6 h-6 text-green-300"/> : <ToggleLeft className="w-6 h-6 text-slate-300"/>}
              <span className="hidden md:inline">{activeRole === 'admin' ? 'Admin' : 'Conductor'}</span>
            </button>
          )}
          <div className="hidden md:block text-right mr-2"><p className="text-xs text-blue-200 font-bold uppercase">Sesión</p><p className="text-sm font-extrabold">{currentUserEmail}</p></div>
          <button onClick={() => signOut(auth)} className="bg-white/10 p-2.5 rounded-xl"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          {activeRole === 'admin' ? (
            <>
              <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border">
                <button onClick={() => setAdminTab('dashboard')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><ClipboardList className="w-5 h-5"/> Trabajos</button>
                <button onClick={() => setAdminTab('newJob')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-5 h-5"/> Crear</button>
                <button onClick={() => setAdminTab('tolls')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='tolls'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Ticket className="w-5 h-5"/> Peajes</button>
                <button onClick={() => setAdminTab('destinations')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='destinations'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Map className="w-5 h-5"/> Destinos</button>
                <button onClick={() => setAdminTab('vehicles')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='vehicles'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Truck className="w-5 h-5"/> Flota</button>
                <button onClick={() => setAdminTab('drivers')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='drivers'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Users className="w-5 h-5"/> Equipo</button>
              </div>
              
              {adminTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><h2 className="text-2xl font-extrabold text-slate-800">Monitor</h2><button onClick={exportToExcel} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold flex gap-2"><Download className="w-5 h-5"/> Excel</button></div>
                  <JobsList jobs={jobs} drivers={drivers} role="admin" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
                </div>
              )}
              {adminTab === 'newJob' && <NewJobForm />}
              
              {adminTab === 'tolls' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.target); try { await addDoc(collection(db, 'tolls'), { name: fd.get('name'), km: fd.get('km'), direction: fd.get('direction'), route: fd.get('route'), priceAuto: Number(fd.get('pa')), priceTruck2: Number(fd.get('pt2')), priceTruckMore: Number(fd.get('ptm')) }); e.target.reset(); showAlert("Peaje guardado."); } catch(err){} }} className="bg-white p-8 rounded-3xl border space-y-4">
                    <h3 className="font-extrabold text-xl flex items-center gap-2"><Ticket className="text-blue-600"/> Crear Peaje</h3>
                    <input name="name" placeholder="Nombre peaje" required className="w-full border-2 p-3 rounded-xl font-semibold outline-none focus:border-blue-500"/>
                    <div className="grid grid-cols-2 gap-3">
                      <input name="km" placeholder="Km" className="border-2 p-3 rounded-xl font-semibold"/>
                      <select name="direction" className="border-2 p-3 rounded-xl font-semibold"><option>Norte</option><option>Sur</option><option>Este</option><option>Oeste</option></select>
                    </div>
                    <input name="route" placeholder="Ruta (Ej. Ruta 5)" className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <input name="pa" type="number" placeholder="Valor Auto/Camioneta" required className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <input name="pt2" type="number" placeholder="Valor Camión 2 ejes" required className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <input name="ptm" type="number" placeholder="Valor Camión >2 ejes" required className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Guardar Peaje</button>
                  </form>
                  <div className="bg-white p-8 rounded-3xl border overflow-y-auto max-h-[70vh]">
                    <h3 className="font-extrabold text-xl mb-4">Lista de Peajes</h3>
                    {tolls.map(t => (
                      <div key={t.id} className="p-3 bg-slate-50 border rounded-xl mb-3 flex justify-between items-center">
                        <div><p className="font-bold">{t.name} <span className="text-xs text-slate-400">({t.route} - Km {t.km} {t.direction})</span></p><p className="text-xs font-semibold text-blue-600">Auto: {formatMoney(t.priceAuto)} | C2: {formatMoney(t.priceTruck2)} | C+: {formatMoney(t.priceTruckMore)}</p></div>
                        <button onClick={()=>showConfirm("¿Eliminar peaje?", async () => await deleteDoc(doc(db, 'tolls', t.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'destinations' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.target); const tIds = fd.getAll('tollIds'); try { await addDoc(collection(db, 'destinations'), { name: fd.get('name'), tolls: tIds }); e.target.reset(); showAlert("Destino guardado."); } catch(err){} }} className="bg-white p-8 rounded-3xl border space-y-4">
                    <h3 className="font-extrabold text-xl flex items-center gap-2"><Map className="text-blue-600"/> Crear Destino</h3>
                    <input name="name" placeholder="Nombre Ciudad/Destino" required className="w-full border-2 p-3 rounded-xl font-semibold outline-none focus:border-blue-500"/>
                    <p className="text-sm font-bold text-slate-500">Selecciona los peajes de la ruta:</p>
                    <div className="max-h-60 overflow-y-auto border-2 rounded-xl p-2 bg-slate-50">
                      {tolls.map(t => <label key={t.id} className="flex items-center gap-2 p-2 border-b"><input type="checkbox" name="tollIds" value={t.id} className="w-4 h-4"/> <span className="text-sm font-bold">{t.name} ({t.direction})</span></label>)}
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Guardar Destino</button>
                  </form>
                  <div className="bg-white p-8 rounded-3xl border overflow-y-auto max-h-[70vh]">
                    <h3 className="font-extrabold text-xl mb-4">Destinos y Rutas</h3>
                    {destinations.map(d => (
                      <div key={d.id} className="p-3 bg-slate-50 border rounded-xl mb-3 flex justify-between items-start">
                        <div><p className="font-bold text-lg">{d.name}</p><p className="text-xs font-semibold text-slate-500">{d.tolls.length} peajes asignados</p></div>
                        <button onClick={()=>showConfirm("¿Eliminar destino?", async () => await deleteDoc(doc(db, 'destinations', d.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'vehicles' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={editingVehicle ? handleUpdateVehicle : handleCreateVehicle} className="bg-white p-8 rounded-3xl shadow-sm border space-y-4">
                    <h3 className="text-xl font-extrabold flex items-center gap-2"><Truck className="text-blue-600"/> {editingVehicle ? 'Editar' : 'Nuevo'} Vehículo</h3>
                    <select name="client" defaultValue={editingVehicle?.client || ''} className="w-full border-2 p-3 rounded-xl font-semibold outline-none"><option value="">Cliente...</option>{CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}<option value="OTRO">Otro</option></select>
                    <input name="manualClient" placeholder="Si es OTRO, escribe aquí" className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <input name="brand" defaultValue={editingVehicle?.brand} placeholder="Marca" required className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <input name="model" defaultValue={editingVehicle?.model} placeholder="Modelo" required className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <input name="plate" defaultValue={editingVehicle?.plate} placeholder="Patente" required className="w-full border-2 p-3 rounded-xl font-bold uppercase"/>
                    <div className="flex gap-2">
                      {editingVehicle && <button type="button" onClick={()=>setEditingVehicle(null)} className="bg-slate-100 p-3 rounded-xl font-bold w-1/3">Cancelar</button>}
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Guardar</button>
                    </div>
                  </form>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border flex flex-col">
                    <div className="flex justify-between mb-4"><h3 className="text-xl font-extrabold">Flota</h3><select onChange={e=>setFleetFilter(e.target.value)} className="border-2 p-2 rounded-xl text-xs font-bold"><option value="">Todos</option>{CLIENTES.map(c=><option key={c}>{c}</option>)}</select></div>
                    <div className="space-y-3 overflow-y-auto max-h-[60vh]">
                      {vehicles.filter(v => !fleetFilter ? true : v.client === fleetFilter).map(v=>(
                        <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-xl">
                          <div><p className="font-extrabold">{v.brand} {v.model}</p><p className="text-sm font-bold text-blue-600">{v.plate}</p></div>
                          <div className="flex gap-1"><button onClick={()=>setEditingVehicle(v)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleDeleteVehicle(v.id)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'drivers' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={editingDriver ? handleUpdateDriver : handleCreateDriver} className="bg-white p-8 rounded-3xl border space-y-4">
                    <h3 className="text-xl font-extrabold"><User className="text-blue-600 inline"/> {editingDriver ? 'Editar' : 'Nuevo'} Conductor</h3>
                    <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre" required className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail" required type="email" className="w-full border-2 p-3 rounded-xl font-semibold"/>
                    <div className="flex gap-2">
                      {editingDriver && <button type="button" onClick={()=>setEditingDriver(null)} className="bg-slate-100 p-3 rounded-xl font-bold w-1/3">Cancelar</button>}
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Guardar</button>
                    </div>
                  </form>
                  <div className="bg-white p-8 rounded-3xl border max-h-[70vh] overflow-y-auto">
                    <h3 className="text-xl font-extrabold mb-4">Equipo</h3>
                    {drivers.map(d=>(
                      <div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-xl mb-2">
                        <div><p className="font-extrabold">{d.name}</p><p className="text-xs text-slate-500">{d.email}</p></div>
                        <button onClick={()=>setEditingDriver(d)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold">Mis Trabajos</h2>
              <JobsList jobs={jobs} drivers={drivers} role="driver" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} db={db} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      {currentView === 'checklist' && selectedJob && <main className="max-w-2xl mx-auto p-4"><ChecklistForm job={selectedJob} db={db} currentUserEmail={currentUserEmail} onCancel={() => setCurrentView('main')} onComplete={() => { setSelectedJob(null); setCurrentView('main'); }} showAlert={showAlert} showConfirm={showConfirm} /></main>}

      {currentView === 'main' && (
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-2 z-40 pb-[env(safe-area-inset-bottom)]">
          <button onClick={handleQuickChecklist} className="flex flex-col items-center text-slate-400 hover:text-blue-600 w-20"><Zap className="w-6 h-6 mb-1 bg-slate-100 p-1 rounded"/><span className="text-[10px] font-bold">Rápido</span></button>
          <button onClick={() => setMainTab('jobs')} className={`flex flex-col items-center w-20 ${mainTab==='jobs' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}><ClipboardList className={`w-6 h-6 mb-1 ${mainTab==='jobs'?'bg-blue-100':'bg-transparent'} p-1 rounded`}/><span className="text-[10px] font-bold">Trabajos</span></button>
          <button onClick={() => setMainTab('ranking')} className={`flex flex-col items-center w-20 ${mainTab==='ranking' ? 'text-yellow-600' : 'text-slate-400 hover:text-yellow-600'}`}><Trophy className={`w-6 h-6 mb-1 ${mainTab==='ranking'?'bg-yellow-100':'bg-transparent'} p-1 rounded`}/><span className="text-[10px] font-bold">Ranking</span></button>
          <button onClick={() => setMainTab('expenses')} className={`flex flex-col items-center w-20 ${mainTab==='expenses' ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}><Wallet className={`w-6 h-6 mb-1 ${mainTab==='expenses'?'bg-blue-100':'bg-transparent'} p-1 rounded`}/><span className="text-[10px] font-bold">Gastos</span></button>
        </nav>
      )}

      {dialogConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4"><div className="bg-blue-100 p-2 rounded-full">{dialogConfig.type === 'confirm' ? <AlertCircle className="w-6 h-6 text-blue-600"/> : <Bell className="w-6 h-6 text-blue-600"/>}</div><h3 className="text-xl font-extrabold">LogisticAPP</h3></div>
            <p className="text-slate-600 font-bold mb-6">{dialogConfig.message}</p>
            <div className="flex gap-3">
              {dialogConfig.type === 'confirm' && <button onClick={closeDialog} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">Cancelar</button>}
              <button onClick={() => { if (dialogConfig.onConfirm) dialogConfig.onConfirm(); closeDialog(); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">{dialogConfig.type === 'confirm' ? 'Confirmar' : 'Aceptar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardView({ jobs, drivers, isAdminView }) {
  const [selectedDriverJobs, setSelectedDriverJobs] = useState(null);
  const now = new Date();
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthlyCompleted = jobs.filter(j => j.status === 'completed' && j.completedAt >= firstOfCurrentMonth);
  const ranking = drivers.map(d => { const dj = monthlyCompleted.filter(j => j.acceptedByEmail === d.email); return { ...d, score: dj.length, jobs: dj }; }).sort((a, b) => b.score - a.score);

  return (
    <main className="max-w-5xl mx-auto p-4 pt-6 pb-24">
      <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Ranking Mensual</h2>
      <div className="bg-white rounded-3xl border p-2 sm:p-6">
        {ranking.length === 0 ? <p className="text-center py-6">Sin datos.</p> : ranking.map((dr, i) => (
          <div key={dr.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-slate-50 rounded-xl">
             <div className="flex items-center gap-4"><span className={`text-2xl font-black ${i===0?'text-yellow-500':i===1?'text-slate-400':i===2?'text-amber-700':'text-slate-300'}`}>#{i+1}</span><div><p className="font-extrabold text-lg">{dr.name}</p><p className="text-sm text-slate-500 font-bold">{dr.score} Traslados</p></div></div>
             {isAdminView && <button onClick={() => setSelectedDriverJobs(dr)} className="flex gap-1 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl font-bold text-sm"><Eye className="w-4 h-4"/> <span className="hidden sm:inline">Historial</span></button>}
          </div>
        ))}
      </div>
      {selectedDriverJobs && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between"><h2 className="text-xl font-extrabold">{selectedDriverJobs.name}</h2><button onClick={()=>setSelectedDriverJobs(null)} className="bg-slate-100 p-2 rounded-full"><X className="w-5 h-5"/></button></div>
            <div className="p-6 overflow-y-auto space-y-4">
              {selectedDriverJobs.jobs.length === 0 ? <p className="text-center">Sin traslados.</p> : selectedDriverJobs.jobs.map(j => (
                <div key={j.id} className="bg-slate-50 p-4 rounded-xl border">
                  <div className="flex justify-between mb-2"><p className="font-extrabold">{j.brand} {j.model}</p><span className="text-xs border px-2 rounded font-bold bg-white">{j.plate||j.vin}</span></div>
                  <p className="text-sm font-bold text-slate-600"><MapPin className="inline w-3 h-3"/> {j.origin} <br/><Navigation className="inline w-3 h-3"/> {j.destination}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ExpensesView({ role, drivers, expenses, db, currentUserEmail, showAlert, showConfirm }) {
  const isAdminView = role === 'admin';
  const myDriver = drivers.find(d => d.email === currentUserEmail);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState(null);

  const addExp = async (e, type, amount, detail, driverId, dName, dEmail) => {
    e.preventDefault();
    const currentBalance = drivers.find(d => d.id === driverId)?.balance || 0;
    if (type === 'expense' && amount > currentBalance) return showAlert("Saldo insuficiente.");
    try {
      await updateDoc(doc(db, 'drivers', driverId), { balance: type === 'assignment' ? currentBalance + amount : currentBalance - amount });
      await addDoc(collection(db, 'expenses'), { driverId, driverEmail: dEmail, driverName: dName, type, amount, detail, createdAt: Date.now() });
      e.target.reset(); showAlert(type === 'assignment' ? `Asignado $${amount}` : "Gasto registrado");
    } catch (err) { console.error(err); }
  };

  const submitReturn = async () => {
    if (!returnReceipt || !myDriver?.balance) return;
    try {
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: 'Rendición (En revisión)', receiptImage: returnReceipt, createdAt: Date.now() });
      setIsReturnOpen(false); setReturnReceipt(null); showAlert("Comprobante enviado. Esperando aprobación.");
    } catch(e) {}
  };

  const approveReturn = async (exp) => {
    try {
      const d = drivers.find(x => x.id === exp.driverId);
      if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: Math.max(0, (d.balance||0) - exp.amount) });
      await updateDoc(doc(db, 'expenses', exp.id), { type: 'return', detail: 'Rendición Aprobada' });
      showAlert("Rendición aprobada. Saldo a $0.");
    } catch(e){}
  };

  const delExp = (exp) => {
    if (!isAdminView && exp.type === 'assignment') return showAlert("Pide al admin eliminar esto.");
    showConfirm("¿Eliminar registro? El saldo se ajustará.", async () => {
      try {
        const d = drivers.find(x => x.id === exp.driverId);
        if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: (d.balance||0) + (exp.type === 'assignment' ? -exp.amount : exp.amount) });
        await deleteDoc(doc(db, 'expenses', exp.id));
      } catch(e){}
    });
  };

  const TI = ({t}) => t==='assignment' ? <ArrowUpCircle className="w-5 h-5 text-green-500 shrink-0"/> : t==='pending_return' ? <Clock className="w-5 h-5 text-amber-500 shrink-0"/> : t==='expense' ? <ArrowDownCircle className="w-5 h-5 text-red-500 shrink-0"/> : <CheckCircle className="w-5 h-5 text-blue-500 shrink-0"/>;

  if (isAdminView) {
    return (
      <main className="max-w-5xl mx-auto p-4 pt-6 pb-24">
        {viewingReceipt && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white p-4 rounded-xl w-full max-w-md relative"><button onClick={()=>setViewingReceipt(null)} className="absolute top-2 right-2 bg-slate-200 p-1 rounded-full"><X/></button><img src={viewingReceipt} className="w-full h-auto rounded"/></div></div>}
        <h2 className="text-2xl font-extrabold mb-6"><Wallet className="inline text-blue-600"/> Viáticos</h2>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {drivers.map(d => (
              <div key={d.id} className={`bg-white p-5 rounded-3xl border cursor-pointer ${selectedDriverId===d.id?'border-blue-500 ring-2 ring-blue-100':''}`} onClick={()=>setSelectedDriverId(d.id===selectedDriverId?null:d.id)}>
                <div className="flex justify-between"><div><p className="font-extrabold text-lg">{d.name}</p><p className="text-sm text-slate-400">{d.email}</p></div><div className="text-right"><p className="text-xs uppercase font-bold text-slate-400">Saldo</p><p className="font-black text-xl text-green-600">{formatMoney(d.balance||0)}</p></div></div>
                {selectedDriverId === d.id && <form onSubmit={e=>addExp(e,'assignment',Number(e.target.amount.value), 'Asignación', d.id, d.name, d.email)} className="mt-4 flex gap-2" onClick={e=>e.stopPropagation()}><input name="amount" type="number" required placeholder="Monto $" className="w-full border-2 rounded-xl p-2 font-bold outline-none"/><button className="bg-blue-600 text-white px-4 rounded-xl font-bold">Enviar</button></form>}
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-3xl border h-fit max-h-[70vh] flex flex-col">
            <h3 className="font-bold mb-4">{selectedDriverId ? 'Historial Conductor' : 'Historial Global'}</h3>
            <div className="overflow-y-auto space-y-3 pr-2">
              {expenses.filter(e => selectedDriverId ? e.driverId === selectedDriverId : true).map(e => (
                <div key={e.id} className="bg-slate-50 p-3 rounded-xl border flex gap-3 items-start w-full overflow-hidden">
                  <TI t={e.type}/>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-sm break-words">{e.detail}</p>
                    <p className="text-xs text-slate-400 truncate">{!selectedDriverId && <span className="text-blue-600">{e.driverName} </span>}{new Date(e.createdAt).toLocaleDateString()}</p>
                    {e.receiptImage && <button onClick={()=>setViewingReceipt(e.receiptImage)} className="mt-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded font-bold"><Camera className="inline w-3 h-3"/> Foto</button>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-black ${e.type==='expense'?'text-red-500':'text-green-600'}`}>{e.type==='expense'?'-':'+'}{formatMoney(e.amount)}</span>
                    {e.type==='pending_return' && <button onClick={()=>approveReturn(e)} className="bg-green-600 text-white px-2 py-1 rounded-lg text-xs font-bold">Aprobar</button>}
                    {e.type!=='pending_return' && <button onClick={()=>delExp(e)} className="text-red-500 bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4"/></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!myDriver) return <p className="text-center font-bold p-8">No registrado como conductor.</p>;
  const bal = myDriver.balance || 0;
  const hasPending = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  return (
    <main className="max-w-md mx-auto p-4 pt-6 space-y-6 pb-24">
      {viewingReceipt && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white p-4 rounded-xl w-full relative"><button onClick={()=>setViewingReceipt(null)} className="absolute top-2 right-2 bg-slate-200 p-1 rounded-full"><X/></button><img src={viewingReceipt} className="w-full rounded"/></div></div>}
      
      {isReturnOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm"><div className="flex justify-between mb-4"><h3 className="font-extrabold text-xl">Rendir Vuelto</h3><button onClick={()=>{setIsReturnOpen(false);setReturnReceipt(null)}} className="bg-slate-100 p-2 rounded-full"><X/></button></div><p className="font-bold text-slate-500">Monto: <span className="text-blue-600 text-xl">{formatMoney(bal)}</span></p><label className="block border-2 border-dashed p-6 text-center mt-4 rounded-xl cursor-pointer bg-slate-50"><input type="file" className="hidden" onChange={async e=>{const f=e.target.files[0];if(!f)return;const b=await window.createImageBitmap(f,{resizeWidth:800});const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);setReturnReceipt(c.toDataURL('image/jpeg',0.6));b.close();}}/>{returnReceipt?<><CheckCircle className="mx-auto text-green-500 w-8 h-8"/><p className="font-bold text-sm mt-2">Cargado</p></>:<><Camera className="mx-auto text-slate-400 w-8 h-8"/><p className="font-bold text-sm mt-2">Subir Comprobante</p></>}</label><button onClick={submitReturn} disabled={!returnReceipt} className={`w-full mt-4 py-3 rounded-xl font-bold ${returnReceipt?'bg-green-600 text-white':'bg-slate-200'}`}>Confirmar</button></div>
        </div>
      )}

      <div className="bg-blue-600 p-8 rounded-3xl text-center text-white"><p className="font-bold uppercase text-sm opacity-80">Saldo Asignado</p><p className="text-5xl font-black">{formatMoney(bal)}</p></div>
      <form onSubmit={e=>addExp(e,'expense',Number(e.target.amount.value), e.target.detail.value, myDriver.id, myDriver.name, myDriver.email)} className="bg-white p-6 rounded-3xl border space-y-4"><h3 className="font-extrabold text-lg"><Receipt className="inline text-red-500"/> Registrar Gasto</h3><input name="detail" required placeholder="Detalle (Ej. Peaje)" className="w-full border-2 p-3 rounded-xl font-bold"/><input name="amount" type="number" required placeholder="Monto $" className="w-full border-2 p-3 rounded-xl font-bold"/><button type="submit" disabled={bal<=0||hasPending} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl disabled:bg-slate-300">Guardar Gasto</button></form>
      {hasPending ? <div className="bg-amber-50 p-4 border border-amber-200 rounded-2xl text-center"><Clock className="w-6 h-6 text-amber-500 mx-auto"/><p className="font-bold text-amber-700">Rendición en Revisión</p></div> : (bal>0 && <button onClick={()=>setIsReturnOpen(true)} className="w-full bg-green-50 text-green-700 font-bold py-4 rounded-2xl border flex justify-center gap-2"><CheckCircle/> Rendir Vuelto</button>)}
      <div className="bg-white p-6 rounded-3xl border">
        <h3 className="font-extrabold text-lg mb-4">Movimientos</h3>
        <div className="space-y-3">{expenses.filter(e=>e.driverId===myDriver.id).map(e=>(
          <div key={e.id} className="bg-slate-50 p-3 rounded-xl border flex gap-3 w-full overflow-hidden items-start"><TI t={e.type}/><div className="flex-1 min-w-0"><p className="font-extrabold text-sm break-words">{e.detail}</p><p className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleDateString()}</p>{e.receiptImage && <button onClick={()=>setViewingReceipt(e.receiptImage)} className="mt-1 text-xs text-blue-600 font-bold"><Camera className="inline w-3 h-3"/> Foto</button>}</div><div className="flex items-center gap-2 shrink-0"><span className={`font-black ${e.type==='expense'?'text-red-500':'text-green-600'}`}>{e.type==='expense'?'-':'+'}{formatMoney(e.amount)}</span>{e.type!=='assignment'&&e.type!=='pending_return'&&<button onClick={()=>delExp(e)} className="bg-red-50 text-red-500 p-1.5 rounded"><Trash2 className="w-4 h-4"/></button>}</div></div>
        ))}</div>
      </div>
    </main>
  );
}

function JobsList({ jobs, drivers, role, onStartChecklist, db, currentUserEmail, showAlert, showConfirm }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [jobToFail, setJobToFail] = useState(null);
  const isAdmin = role === 'admin';
  
  const fJobs = jobs.filter(j => (!isAdmin && !j.assignedEmails?.includes(currentUserEmail) && j.acceptedByEmail !== currentUserEmail) || !j.createdAt || (!isAdmin && (Date.now() - j.createdAt) > 604800000) ? false : true);
  const sJobs = [...fJobs].sort((a, b) => {
    const ord = isAdmin ? { pending:1, accepted:2, completed:3, failed:3 } : { accepted:1, pending:2, completed:3, failed:3 };
    if(ord[a.status]!==ord[b.status]) return ord[a.status]-ord[b.status];
    if(a.status==='completed'||a.status==='failed') return (b.completedAt||b.createdAt)-(a.completedAt||a.createdAt);
    return (a.scheduledDate?new Date(a.scheduledDate).getTime():a.createdAt) - (b.scheduledDate?new Date(b.scheduledDate).getTime():b.createdAt);
  });

  const aJobs = sJobs.filter(j => j.status==='pending'||j.status==='accepted');
  const hJobs = sJobs.filter(j => j.status==='completed'||j.status==='failed');

  const pdfFn = async (job) => {
    if(!window.jspdf) await new Promise(r=>{const s=document.createElement('script');s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";s.onload=r;document.head.appendChild(s);});
    const d=new window.jspdf.jsPDF(); d.setFillColor(37,99,235); d.rect(0,0,210,30,'F'); d.setTextColor(255); d.setFontSize(22); d.setFont("helvetica","bold"); d.text("CHECKLIST DE TRASLADO",105,20,null,null,"center"); d.setTextColor(0);
    if(job.status==='failed'){d.setTextColor(220,38,38); d.setFontSize(12); d.text(`FALLIDO: ${job.failedReason||''}`,20,37); d.setTextColor(0);}
    let dN = job.checklist?.assignedDriverName||job.acceptedByEmail||""; if(job.acceptedByEmail){const fd=drivers?.find(x=>x.email===job.acceptedByEmail); if(fd) dN=fd.name;}
    d.setFillColor(241,245,249); d.rect(15,40,180,50,'F'); d.setFontSize(14); d.setFont("helvetica","bold"); d.text("1. DATOS SERVICIO",20,48); d.setFontSize(11); d.setFont("helvetica","normal");
    d.text(`Fecha:`,20,58); d.setFont("helvetica","bold"); d.text(`${formatDateDisplay(job.scheduledDate)||'-'}`,45,58); d.setFont("helvetica","normal"); d.text(`Cliente:`,110,58); d.setFont("helvetica","bold"); d.text(`${job.client||''}`,125,58);
    d.setFont("helvetica","normal"); d.text(`Vehículo:`,20,66); d.setFont("helvetica","bold"); d.text(`${job.brand||''} ${job.model||''}`,40,66); d.setFont("helvetica","normal"); d.text(`Patente:`,110,66); d.setFont("helvetica","bold"); d.text(`${job.plate||job.vin||''}`,125,66);
    d.setFont("helvetica","normal"); d.text(`Ruta:`,20,74); d.setFont("helvetica","bold"); d.text(`${job.origin||''} -> ${job.destination||''}`,35,74); d.setFont("helvetica","normal"); d.text(`Conductor:`,20,82); d.setFont("helvetica","bold"); d.text(`${dN}`,45,82);
    
    // Gastos de peaje si es viaje
    if (job.tripType === 'viaje' && job.expectedTollCost > 0) {
      d.setFont("helvetica","normal"); d.text(`Peajes est.:`,110,82); d.setFont("helvetica","bold"); d.text(`${formatMoney(job.expectedTollCost)}`,135,82);
    }

    d.setFillColor(241,245,249); d.rect(15,95,180,45,'F'); d.setFontSize(14); d.setFont("helvetica","bold"); d.text("2. ESTADO",20,103); d.setFontSize(11); d.setFont("helvetica","normal");
    d.text(`Combustible:`,20,113); d.setFont("helvetica","bold"); d.text(`${job.checklist?.fuelLevel||'0'}%`,50,113);
    const dc=job.checklist?.docs||{}; d.setFont("helvetica","normal"); d.text(`SOAP:`,20,122); d.setFont("helvetica","bold"); d.text(dc.soap?'SÍ':'NO',35,122); d.setFont("helvetica","normal"); d.text(`Permiso:`,60,122); d.setFont("helvetica","bold"); d.text(dc.permiso?'SÍ':'NO',80,122); d.setFont("helvetica","normal"); d.text(`Rev.Tec:`,110,122); d.setFont("helvetica","bold"); d.text(dc.revTecnica?'SÍ':'NO',130,122); d.setFont("helvetica","normal"); d.text(`Gases:`,150,122); d.setFont("helvetica","bold"); d.text(dc.gases?'SÍ':'NO',165,122);
    d.setFont("helvetica","normal"); d.text(`Obs:`,20,131); d.text(d.splitTextToSize(`${job.checklist?.observations||'Ninguna'}`,140),35,131);
    
    const sy=150; d.setFillColor(241,245,249); d.rect(15,sy,180,70,'F'); d.setFontSize(14); d.setFont("helvetica","bold"); d.text("3. RECEPCIÓN",20,sy+8);
    if(job.checklist?.noReception){d.setTextColor(220,38,38); d.text("ENTREGA SIN RECEPCIÓN",20,sy+20); d.setTextColor(0);}
    else {d.setFontSize(11); d.setFont("helvetica","normal"); d.text(`Nombre:`,20,sy+18); d.setFont("helvetica","bold"); d.text(`${job.checklist?.receiverName||''}`,40,sy+18); d.setFont("helvetica","normal"); d.text(`RUT:`,110,sy+18); d.setFont("helvetica","bold"); d.text(`${job.checklist?.receiverRut||''}`,125,sy+18); if(job.checklist?.signatureData){d.text(`Firma:`,20,sy+35); d.addImage(job.checklist.signatureData,'PNG',40,sy+25,60,35);}}
    
    if(job.checklist?.photos){
      let cy=30; let cc=1; let ap=false;
      const ph=job.checklist.photos; const lbls={front:'Frente',left:'Lat Izq',right:'Lat Der',back:'Atrás'};
      const gD=(s)=>new Promise(r=>{const i=new Image();i.onload=()=>r({w:i.width,h:i.height});i.src=s;});
      for(const k in ph){if(ph[k]){
        if(!ap){d.addPage();d.setFillColor(37,99,235);d.rect(0,0,210,20,'F');d.setTextColor(255);d.setFontSize(16);d.setFont("helvetica","bold");d.text("FOTOGRAFÍAS",105,14,null,null,"center");d.setTextColor(0);ap=true;}
        const dm=await gD(ph[k]); const rt=dm.h/dm.w; let iw=80; let ih=iw*rt; if(ih>100){ih=100;iw=ih/rt;}
        const sc=cc===1?55:155; const fx=sc-(iw/2);
        if(cy+ih>280){d.addPage();cy=30;d.setFillColor(37,99,235);d.rect(0,0,210,20,'F');d.setTextColor(255);d.setFontSize(16);d.text("FOTOGRAFÍAS",105,14,null,null,"center");d.setTextColor(0);}
        d.setFontSize(11);d.text(lbls[k]||k,sc,cy-3,{align:"center"});d.addImage(ph[k],'JPEG',fx,cy,iw,ih);
        if(cc===1)cc=2;else{cc=1;cy+=Math.max(ih,80)+15;}
      }}
    }
    return d;
  };

  const getDStr = j => j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0]);
  const cpyWapp = j => { navigator.clipboard.writeText(`${getDStr(j)}\n${j.client}\n${j.brand} ${j.model}\n${j.plate||j.vin}\n${j.origin} - ${j.destination}`).then(()=>showAlert("Copiado al portapapeles.")); setMenuOpenId(null); };

  return (
    <div className="pb-20">
      {aJobs.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {aJobs.map(j => (
            <div key={j.id} className="bg-white rounded-3xl shadow-sm border p-6 flex flex-col relative z-10">
              <div className="flex justify-between items-center mb-4 border-b pb-4">
                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${j.status==='pending'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{j.status==='pending'?'Pendiente':'En Curso'}</span>
                <div className="relative">
                  <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-1"><MoreVertical className="w-5 h-5"/></button>
                  {menuOpenId===j.id && (
                    <div className="absolute right-0 top-8 bg-white border shadow-xl rounded-xl w-48 z-50 overflow-hidden">
                      <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 text-sm font-bold flex gap-2 hover:bg-slate-50"><Copy className="w-4 h-4"/> Copiar Info</button>
                      {isAdmin && <button onClick={()=>showConfirm("¿Eliminar?", ()=>deleteDoc(doc(db,'transport_jobs',j.id)))} className="w-full text-left p-3 text-sm font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t"><Trash2 className="w-4 h-4"/> Eliminar</button>}
                    </div>
                  )}
                </div>
              </div>
              <h3 className="font-extrabold text-xl mb-1">{j.brand} {j.model}</h3>
              <p className="text-xs font-bold text-slate-400 mb-4">{j.client}</p>
              {j.tripType === 'viaje' && <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-4 text-center"><span className="text-[10px] font-black text-blue-600 uppercase">Viaje Interurbano</span>{j.expectedTollCost > 0 && <p className="text-xs font-bold text-blue-800">Peajes est.: {formatMoney(j.expectedTollCost)}</p>}</div>}
              <div className="space-y-2 mb-4">
                <p className="text-sm font-bold text-slate-600"><MapPin className="inline w-4 h-4 text-slate-400"/> {j.origin}</p>
                <p className="text-sm font-bold text-slate-600"><Navigation className="inline w-4 h-4 text-slate-400"/> {j.destination}</p>
              </div>
              <div className="mt-auto pt-4 border-t flex flex-col gap-2">
                {j.status === 'pending' && (!isAdmin || j.assignedEmails?.includes(currentUserEmail)) && <button onClick={()=>updateDoc(doc(db,'transport_jobs',j.id),{status:'accepted',acceptedByEmail:currentUserEmail})} className="bg-blue-600 text-white font-bold py-3 rounded-xl">Reclamar</button>}
                {((j.status === 'accepted' && (isAdmin || j.acceptedByEmail === currentUserEmail)) || (j.status !== 'completed' && isAdmin)) && <button onClick={()=>onStartChecklist(j)} className="bg-green-600 text-white font-bold py-3 rounded-xl">Hacer Checklist</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {hJobs.length > 0 && (
        <div>
          <h3 className="font-extrabold text-xl mb-4">Historial</h3>
          <div className="space-y-3">
            {hJobs.map(j => (
              <div key={j.id} className="bg-white p-4 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${j.status==='failed'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{j.status==='failed'?'Fallido':'Ok'}</span><p className="font-bold">{j.brand} {j.model}</p></div>
                <div className="flex gap-2">
                  <button onClick={()=>cpyWapp(j)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Copy className="w-4 h-4"/></button>
                  <button onClick={async ()=>{try{const d=await buildPDFDoc(j); d.save(`Check.${j.plate||'SN'}.pdf`);}catch(e){showAlert("Error PDF");}}} className="p-2 bg-slate-100 text-slate-700 rounded-lg"><FileDown className="w-4 h-4"/></button>
                  {isAdmin && <button onClick={()=>showConfirm("¿Eliminar?", ()=>deleteDoc(doc(db,'transport_jobs',j.id)))} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 className="w-4 h-4"/></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm }) {
  const isQuick = job.id === 'NEW_QUICK_JOB';
  const DK = `ck_${job.id}`;
  const [step, setStep] = useState(() => Number(localStorage.getItem(`${DK}_s`)||1));
  const [formData, setFormData] = useState(() => {
    try { const s=localStorage.getItem(DK); if(s)return JSON.parse(s); }catch(e){}
    return { client: job.client||'', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false }, docs: { soap:false, permiso:false, revTecnica:false, gases:false }, observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null };
  });

  useEffect(() => { localStorage.setItem(DK, JSON.stringify(formData)); localStorage.setItem(`${DK}_s`, step); }, [formData, step]);

  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  const handlePic = async (e, id) => {
    const f=e.target.files[0]; if(!f)return;
    const b = await window.createImageBitmap(f,{resizeWidth:800}); const c=document.createElement('canvas'); c.width=b.width; c.height=b.height; c.getContext('2d').drawImage(b,0,0);
    setF('photos', {...formData.photos, [id]:c.toDataURL('image/jpeg',0.6)}); b.close();
  };

  const submit = async (e) => {
    e.preventDefault();
    if(!formData.noReception && !formData.signatureData) return showAlert("Firma obligatoria.");
    let d = {...formData}; if(d.noReception){ d.receiverName="SIN RECEPCIÓN"; d.receiverRut="N/A"; }
    const fd = { scheduledDate: new Date().toISOString(), client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType, expectedTollCost: job.expectedTollCost };
    try {
      if(isQuick) { fd.assignedDriverName="Auto"; fd.acceptedByEmail=currentUserEmail; await addDoc(collection(db,'transport_jobs'), fd); }
      else { await updateDoc(doc(db,'transport_jobs',job.id), fd); }
      localStorage.removeItem(DK); localStorage.removeItem(`${DK}_s`); showAlert("Checklist Guardado."); onComplete();
    } catch(e) { showAlert("Error o Modo Offline Activo. Se sincronizará."); onComplete(); }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border pb-10">
      <div className="bg-blue-600 text-white p-6 flex justify-between items-center"><h2 className="font-bold text-lg"><FileText className="inline w-5 h-5"/> Checklist</h2><button onClick={()=>showConfirm("¿Pausar?", onCancel)} className="bg-blue-800 px-3 py-1 rounded">Pausar</button></div>
      <div className="flex bg-slate-100 h-1"><div className={`bg-green-500 transition-all ${step===1?'w-1/2':'w-full'}`}></div></div>
      <div className="p-6">
        {step === 1 ? (
          <div className="space-y-4">
            <input value={formData.client} onChange={e=>setF('client',e.target.value)} placeholder="Cliente" className="w-full border-2 p-3 rounded-xl font-bold"/>
            <div className="grid grid-cols-2 gap-4"><input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="border-2 p-3 rounded-xl font-bold"/><input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="border-2 p-3 rounded-xl font-bold"/></div>
            <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente/VIN" className="w-full border-2 p-3 rounded-xl font-bold uppercase"/>
            <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={e=>setF('fuelLevel',e.target.value)} className="w-full mt-4"/>
            <div className="grid grid-cols-4 gap-2 mt-4">
              {['front','left','right','back'].map(p=><label key={p} className={`border-2 p-2 rounded-xl text-center cursor-pointer ${formData.photos[p]?'bg-green-50 border-green-400':''}`}><input type="file" className="hidden" accept="image/*" onChange={e=>handlePic(e,p)}/><Camera className="mx-auto mb-1 w-5 h-5"/> <span className="text-[10px] font-bold">{p}</span></label>)}
            </div>
            <button onClick={()=>setStep(2)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-6">Siguiente</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="flex items-center gap-2 p-4 bg-amber-50 rounded-xl border-amber-200 border-2 cursor-pointer"><input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-5 h-5"/> <span className="font-bold text-sm">Entregar sin recepción (Local cerrado)</span></label>
            {!formData.noReception && (
              <><input required value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre Receptor" className="w-full border-2 p-3 rounded-xl font-bold"/><input required value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT" className="w-full border-2 p-3 rounded-xl font-bold"/><SignaturePad onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/></>
            )}
            <div className="flex gap-2 mt-6"><button type="button" onClick={()=>setStep(1)} className="bg-slate-100 p-3 rounded-xl font-bold flex-1">Atrás</button><button type="submit" className="bg-green-600 text-white p-3 rounded-xl font-bold flex-[2]">Finalizar</button></div>
          </form>
        )}
      </div>
    </div>
  );
}