import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, Plus, User, Navigation, AlertCircle, 
  Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, 
  Edit2, Bell, Share2, X, Calendar, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock
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
const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

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

  const draw = (e, type) => {
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
        onPointerDown={(e) => draw(e, 'start')} onPointerMove={(e) => draw(e, 'draw')}
        onPointerUp={(e) => draw(e, 'stop')} onPointerOut={(e) => draw(e, 'stop')}
        onTouchStart={(e) => draw(e, 'start')} onTouchMove={(e) => draw(e, 'draw')}
        onTouchEnd={(e) => draw(e, 'stop')}
      />
      <button type="button" onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,300,150); if(onClear) onClear(); }} className="mt-2 text-sm text-red-500 font-bold px-3 py-1 bg-red-50 rounded-lg">Limpiar firma</button>
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
  const [editingJob, setEditingJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [mainTab, setMainTab] = useState('jobs');
  const [activeRole, setActiveRole] = useState('driver');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const [dialogConfig, setDialogConfig] = useState(null);
  const showAlert = (message) => setDialogConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setDialogConfig({ type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialogConfig(null);

  const triggerNotification = (title, body) => {
    if (Notification.permission === "granted") {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: '/logo.png', vibrate: [200, 100, 200] })).catch(() => new Notification(title, { body }));
      } else { new Notification(title, { body }); }
    }
  };

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (Notification.permission === "granted") setNotificationsEnabled(true);
    });
  }, []);

  const currentUserEmail = user?.email;
  const isRealAdmin = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(currentUserEmail);

  useEffect(() => {
    setActiveRole(isRealAdmin ? 'admin' : 'driver');
  }, [isRealAdmin]);

  useEffect(() => {
    if (!user) return;
    const uJobs = onSnapshot(collection(db, 'transport_jobs'), snap => {
      setJobs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.createdAt - a.createdAt));
    });
    const uDrivers = onSnapshot(collection(db, 'drivers'), snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const uExpenses = onSnapshot(collection(db, 'expenses'), snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt)));
    const uVehicles = onSnapshot(collection(db, 'vehicles'), snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const uTolls = onSnapshot(collection(db, 'tolls'), snap => setTolls(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const uDests = onSnapshot(collection(db, 'destinations'), snap => setDestinations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { uJobs(); uDrivers(); uExpenses(); uVehicles(); uTolls(); uDests(); };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg"><Car className="w-10 h-10 text-white" /></div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2">LogisticAPP</h1>
          <p className="text-slate-500 mb-10 text-lg">Gestión de traslados inteligente</p>
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e))} className="w-full bg-white border-2 text-slate-700 font-bold py-4 px-4 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-sm">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" /> Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

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
    const totalTolls = selDest ? selDest.tolls.reduce((acc, tid) => acc + (tolls.find(x => x.id === tid) ? Number(tolls.find(x => x.id === tid)[tollCat]) : 0), 0) : 0;

    const handlePlateChange = (e) => {
      const val = e.target.value.toUpperCase(); setPlate(val);
      const v = vehicles.find(x => x.plate === val);
      if (v) {
        setBrand(v.brand); setModel(v.model);
        if (CLIENTES.includes(v.client)) setClient(v.client); else { setClient('OTRO'); setManualClient(v.client); }
      }
    };

    const submitJob = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target); const driverIds = fd.getAll('assignedDriverId');
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
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-3xl border shadow-sm">
        <h2 className="text-2xl font-extrabold mb-6 border-b pb-4 text-slate-800">Crear Nuevo Traslado</h2>
        <form onSubmit={submitJob} className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
            <h3 className="font-bold text-slate-700 text-sm">Tipo de Servicio</h3>
            <div className="flex gap-4">
              <button type="button" onClick={()=>setTripType('traslado')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm ${tripType === 'traslado' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white text-slate-500'}`}>Traslado Local</button>
              <button type="button" onClick={()=>setTripType('viaje')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm ${tripType === 'viaje' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white text-slate-500'}`}>Viaje Fuera de Santiago</button>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
             <h3 className="font-bold text-slate-700 text-sm">Vehículo</h3>
             <div className="grid grid-cols-2 gap-4">
               <input value={plate} onChange={handlePlateChange} type="text" placeholder="Patente o VIN" className="w-full border-2 p-3 rounded-xl col-span-2 uppercase font-bold" />
               <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 p-3 rounded-xl font-semibold bg-white" />
               <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 p-3 rounded-xl font-semibold bg-white" />
             </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
            <h3 className="font-bold text-slate-700 text-sm">Ruta y Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <input name="scheduledDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full border-2 p-3 rounded-xl font-semibold" />
              <select value={client} onChange={e => setClient(e.target.value)} className="w-full border-2 p-3 rounded-xl font-semibold bg-white text-slate-700">
                <option value="">Cliente...</option>
                {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTRO">Otro</option>
              </select>
              {client === 'OTRO' && <input type="text" value={manualClient} onChange={e => setManualClient(e.target.value)} placeholder="Escribe cliente" className="col-span-2 w-full border-2 p-3 rounded-xl font-semibold" />}
              <input name="origin" type="text" placeholder="Origen" className="col-span-2 w-full border-2 p-3 rounded-xl font-semibold" />
              {tripType === 'traslado' ? (
                <input name="destination" type="text" placeholder="Destino" className="col-span-2 w-full border-2 p-3 rounded-xl font-semibold" />
              ) : (
                <div className="col-span-2 space-y-3">
                  <select value={selectedDestId} onChange={e => setSelectedDestId(e.target.value)} required className="w-full border-2 p-3 rounded-xl font-bold bg-white text-slate-800">
                    <option value="">Destino Interurbano...</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {selectedDestId && (
                    <div className="p-3 bg-white border border-blue-100 rounded-xl space-y-2">
                      <select value={tollCat} onChange={e => setTollCat(e.target.value)} className="w-full border p-2 rounded-lg text-xs font-semibold">
                        <option value="priceAuto">Auto / Camioneta</option>
                        <option value="priceTruck2">Camión 2 Ejes</option>
                        <option value="priceTruckMore">Camión más de 2 Ejes</option>
                      </select>
                      <div className="flex justify-between items-center bg-blue-50 p-2.5 rounded-lg text-sm"><span className="font-bold text-blue-800">Gastos de Peajes:</span><span className="font-black text-blue-600">{formatMoney(totalTolls)}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
             <h3 className="font-bold text-slate-700 text-sm">Conductores</h3>
             <div className="max-h-40 overflow-y-auto border bg-white rounded-xl p-1">
                {drivers.map(d => (
                  <label key={d.id} className="flex items-center p-2 border-b last:border-0 hover:bg-blue-50 cursor-pointer text-sm font-semibold"><input type="checkbox" name="assignedDriverId" value={d.id} className="w-4 h-4 rounded mr-2" />{d.name}</label>
                ))}
             </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-extrabold text-lg">Guardar y Asignar Trabajo</button>
        </form>
      </div>
    );
  };

  const EditJobModal = ({ job, onClose }) => {
    const [selectedClient, setSelectedClient] = useState(CLIENTES.includes(job.client) ? job.client : (job.client ? 'OTRO' : ''));
    const [manualClient, setManualClient] = useState(!CLIENTES.includes(job.client) ? job.client : '');
    const defaultDate = job.scheduledDate || new Date().toISOString().split('T')[0];

    const handleUpdateJobSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target); const selectedDriverIds = formData.getAll('assignedDriverId');
      const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
      const finalClient = selectedClient === 'OTRO' ? manualClient : selectedClient;
      const updatedData = {
        scheduledDate: formData.get('scheduledDate'), client: finalClient, brand: formData.get('brand'), model: formData.get('model'),
        vin: formData.get('plateOrVin'), plate: formData.get('plateOrVin'), origin: formData.get('origin'), destination: formData.get('destination'),
      };
      if (assignedDriversList.length > 0) {
        updatedData.assignedDrivers = assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email}));
        updatedData.assignedEmails = assignedDriversList.map(d => d.email);
      }
      try { await updateDoc(doc(db, 'transport_jobs', job.id), updatedData); showAlert("Trabajo actualizado."); onClose(); } catch (error) { console.error(error); }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-xl font-extrabold text-slate-800">Modificar Trabajo</h2><button onClick={onClose} className="p-1 bg-slate-100 rounded-full"><X className="w-5 h-5"/></button></div>
          <form onSubmit={handleUpdateJobSubmit} className="space-y-4">
            <input name="scheduledDate" type="date" defaultValue={defaultDate} required className="w-full border-2 p-2 rounded-xl text-sm font-semibold"/>
            <input name="brand" defaultValue={job.brand} placeholder="Marca" className="w-full border-2 p-2 rounded-xl text-sm font-semibold"/>
            <input name="model" defaultValue={job.model} placeholder="Modelo" className="w-full border-2 p-2 rounded-xl text-sm font-semibold"/>
            <input name="plateOrVin" defaultValue={job.plate || job.vin} placeholder="Patente o VIN" className="w-full border-2 p-2 rounded-xl uppercase font-bold text-sm"/>
            <input name="origin" defaultValue={job.origin} placeholder="Origen" className="w-full border-2 p-2 rounded-xl text-sm font-semibold"/>
            <input name="destination" defaultValue={job.destination} placeholder="Destino" className="w-full border-2 p-2 rounded-xl text-sm font-semibold"/>
            <div className="max-h-32 overflow-y-auto border rounded-xl p-2">
                {drivers.map(d => (
                  <label key={d.id} className="flex items-center text-xs font-bold p-1"><input type="checkbox" name="assignedDriverId" value={d.id} defaultChecked={job.assignedEmails?.includes(d.email)} className="w-4 h-4 mr-2" />{d.name}</label>
                ))}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-md">Guardar Cambios</button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      {globalStyles}
      <header className="bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-xl"><Car className="w-6 h-6" /></div><h1 className="font-extrabold text-2xl hidden sm:block">LogisticAPP</h1></div>
        <div className="flex items-center gap-2 sm:gap-4">
          {!notificationsEnabled && <button onClick={requestNotificationPermission} className="p-2 bg-amber-500 rounded-xl"><Bell className="w-5 h-5" /></button>}
          {isRealAdmin && (
            <button onClick={() => setActiveRole(activeRole === 'admin' ? 'driver' : 'admin')} className="flex items-center gap-1.5 bg-white/20 px-3 py-2 rounded-xl text-sm font-bold">
              {activeRole === 'admin' ? <ToggleRight className="w-6 h-6 text-green-300"/> : <ToggleLeft className="w-6 h-6 text-slate-300"/>}
              <span className="hidden md:inline">{activeRole === 'admin' ? 'Admin' : 'Conductor'}</span>
            </button>
          )}
          <button onClick={() => signOut(auth)} className="bg-white/10 p-2.5 rounded-xl"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {editingJob && <EditJobModal job={editingJob} onClose={() => setEditingJob(null)} />}

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          {activeRole === 'admin' ? (
            <>
              <div className="flex flex-wrap gap-1 mb-6 bg-white p-1.5 rounded-2xl border shadow-sm text-xs sm:text-sm">
                <button onClick={() => setAdminTab('dashboard')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><ClipboardList className="w-4 h-4"/> Trabajos</button>
                <button onClick={() => setAdminTab('newJob')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Plus className="w-4 h-4"/> Crear</button>
                <button onClick={() => setAdminTab('tolls')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${adminTab==='tolls'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Ticket className="w-4 h-4"/> Peajes</button>
                <button onClick={() => setAdminTab('destinations')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${adminTab==='destinations'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Map className="w-4 h-4"/> Destinos</button>
                <button onClick={() => setAdminTab('vehicles')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${adminTab==='vehicles'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Truck className="w-4 h-4"/> Flota</button>
                <button onClick={() => setAdminTab('drivers')} className={`flex-1 py-2 rounded-xl font-bold flex justify-center gap-1.5 ${adminTab==='drivers'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Users className="w-4 h-4"/> Equipo</button>
              </div>
              
              {adminTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><h2 className="text-xl font-extrabold text-slate-800">Monitor Operativo</h2><button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex gap-1.5 items-center"><Download className="w-4 h-4"/> Excel</button></div>
                  <JobsList jobs={jobs} drivers={drivers} role="admin" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} onEditJob={setEditingJob} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
                </div>
              )}
              {adminTab === 'newJob' && <NewJobForm />}
              
              {adminTab === 'tolls' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.target); try { await addDoc(collection(db, 'tolls'), { name: fd.get('name'), km: fd.get('km'), direction: fd.get('direction'), route: fd.get('route'), priceAuto: Number(fd.get('pa')), priceTruck2: Number(fd.get('pt2')), priceTruckMore: Number(fd.get('ptm')) }); e.target.reset(); showAlert("Peaje creado."); } catch(err){} }} className="bg-white p-6 rounded-3xl border space-y-4">
                    <h3 className="font-extrabold text-lg flex items-center gap-2"><Ticket className="text-blue-600"/> Nuevo Peaje</h3>
                    <input name="name" placeholder="Nombre Peaje" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <div className="grid grid-cols-2 gap-3">
                      <input name="km" placeholder="Km" className="border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                      <select name="direction" className="border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"><option>Norte</option><option>Sur</option><option>Este</option><option>Oeste</option></select>
                    </div>
                    <input name="route" placeholder="Ruta (Ej. Ruta 5 Norte)" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <input name="pa" type="number" placeholder="Valor Auto / Camioneta" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <input name="pt2" type="number" placeholder="Valor Camión 2 Ejes" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <input name="ptm" type="number" placeholder="Valor Camión >2 Ejes" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm">Guardar Peaje</button>
                  </form>
                  <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                    <h3 className="font-extrabold text-lg mb-4">Peajes Base</h3>
                    {tolls.map(t => (
                      <div key={t.id} className="p-3 bg-slate-50 border rounded-xl mb-2.5 flex justify-between items-center text-xs">
                        <div><p className="font-bold text-sm">{t.name}</p><p className="text-slate-400 font-semibold">{t.route} (Km {t.km} {t.direction})</p><p className="text-blue-600 font-extrabold mt-1">Auto: {formatMoney(t.priceAuto)} | C2: {formatMoney(t.priceTruck2)} | C+: {formatMoney(t.priceTruckMore)}</p></div>
                        <button onClick={()=>showConfirm("¿Eliminar peaje?", async () => await deleteDoc(doc(db, 'tolls', t.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'destinations' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.target); const tIds = fd.getAll('tollIds'); try { await addDoc(collection(db, 'destinations'), { name: fd.get('name'), tolls: tIds }); e.target.reset(); showAlert("Destino guardado."); } catch(err){} }} className="bg-white p-6 rounded-3xl border space-y-4">
                    <h3 className="font-extrabold text-lg flex items-center gap-2"><Map className="text-blue-600"/> Nuevo Destino</h3>
                    <input name="name" placeholder="Ciudad de Destino" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                    <p className="text-xs font-bold text-slate-500">Peajes asociados en la ruta:</p>
                    <div className="max-h-48 overflow-y-auto border-2 rounded-xl p-1 bg-slate-50 text-xs font-semibold">
                      {tolls.map(t => <label key={t.id} className="flex items-center gap-2 p-1.5 border-b last:border-0"><input type="checkbox" name="tollIds" value={t.id} className="w-4 h-4"/> {t.name} ({t.direction})</label>)}
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm">Guardar Destino</button>
                  </form>
                  <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                    <h3 className="font-extrabold text-lg mb-4">Rutas por Destino</h3>
                    {destinations.map(d => (
                      <div key={d.id} className="p-3 bg-slate-50 border rounded-xl mb-2 flex justify-between items-center text-sm font-bold">
                        <div><p className="text-slate-800">{d.name}</p><p className="text-xs font-semibold text-slate-400">{d.tolls?.length || 0} Peajes vinculados</p></div>
                        <button onClick={()=>showConfirm("¿Eliminar destino?", async () => await deleteDoc(doc(db, 'destinations', d.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'vehicles' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={editingVehicle ? handleUpdateVehicle : handleCreateVehicle} className="bg-white p-6 rounded-3xl border space-y-4 shadow-sm">
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
                          <div><p className="font-extrabold text-slate-800">{v.brand} {v.model}</p><p className="text-xs font-bold text-blue-600">{v.plate}</p></div>
                          <div className="flex gap-1"><button onClick={()=>setEditingVehicle(v)} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleDeleteVehicle(v.id)} className="p-1.5 text-red-600 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'drivers' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={editingDriver ? handleUpdateDriver : handleCreateDriver} className="bg-white p-6 rounded-3xl border space-y-4 shadow-sm">
                    <h3 className="text-lg font-extrabold"><User className="text-blue-600 inline mr-1"/> {editingDriver ? 'Editar' : 'Nuevo'} Conductor</h3>
                    <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre completo" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail" required type="email" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                    
                    {/* LICENCIAS CHECKBOXES */}
                    <div className="space-y-1.5 border-t pt-2">
                       <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Clase de Licencia</label>
                       <div className="grid grid-cols-3 gap-1.5">
                          {LICENCIAS.map(l => (
                            <label key={l} className="flex items-center gap-1 p-1 bg-slate-50 border rounded-lg text-[11px] font-bold cursor-pointer">
                              <input type="checkbox" name="licenses" value={l} defaultChecked={editingDriver?.licenses?.includes(l)} className="w-3.5 h-3.5" />
                              {l}
                            </label>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Fecha de Vencimiento</label>
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
                        <button onClick={() => {
                          setEditingDriver(d);
                          // Forzar recarga de form si es el mismo
                        }} className="p-2 text-blue-600 bg-blue-50 rounded-xl"><Edit2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Mis Trabajos</h2>
              <JobsList jobs={jobs} drivers={drivers} role="driver" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      {currentView === 'checklist' && selectedJob && <main className="max-w-2xl mx-auto p-4 pt-6"><ChecklistForm job={selectedJob} db={db} currentUserEmail={currentUserEmail} onCancel={() => setCurrentView('main')} onComplete={() => { setSelectedJob(null); setCurrentView('main'); }} showAlert={showAlert} showConfirm={showConfirm} /></main>}

      {currentView === 'main' && (
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-2.5 z-40 pb-[env(safe-area-inset-bottom)] shadow-lg">
          <button onClick={handleQuickChecklist} className="flex flex-col items-center text-slate-400 hover:text-blue-600 w-20"><Zap className="w-6 h-6 mb-0.5 bg-slate-100 p-1 rounded-xl"/><span className="text-[10px] font-bold">Desde 0</span></button>
          <button onClick={() => setMainTab('jobs')} className={`flex flex-col items-center w-20 ${mainTab==='jobs' ? 'text-blue-600' : 'text-slate-400'}`}><ClipboardList className={`w-6 h-6 mb-0.5 ${mainTab==='jobs'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Trabajos</span></button>
          <button onClick={() => setMainTab('ranking')} className={`flex flex-col items-center w-20 ${mainTab==='ranking' ? 'text-yellow-600' : 'text-slate-400'}`}><Trophy className={`w-6 h-6 mb-0.5 ${mainTab==='ranking'?'bg-yellow-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Ranking</span></button>
          <button onClick={() => setMainTab('expenses')} className={`flex flex-col items-center w-20 ${mainTab==='expenses' ? 'text-blue-600' : 'text-slate-400'}`}><Wallet className={`w-6 h-6 mb-0.5 ${mainTab==='expenses'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Gastos</span></button>
        </nav>
      )}

      {dialogConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
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
                  <p className="font-semibold text-slate-500"><MapPin className="inline w-3 h-3 mr-0.5"/> {j.origin} ➔ <Navigation className="inline w-3 h-3 mr-0.5"/> {j.destination}</p>
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

  const activeOrPendingJobs = jobs.filter(j => j.status === 'pending' || j.status === 'accepted');

  const addExp = async (e, type, amount, detail, driverId, dName, dEmail) => {
    e.preventDefault();
    const currentBalance = drivers.find(d => d.id === driverId)?.balance || 0;
    if (type === 'expense' && amount > currentBalance) return showAlert("Saldo insuficiente.");
    
    // Obtener id del traslado si fue asociado
    const assocJobId = type === 'assignment' ? (e.target.jobId?.value || '') : '';
    let detailString = detail;
    if (assocJobId) {
      const jb = activeOrPendingJobs.find(x => x.id === assocJobId);
      if (jb) detailString += ` (Asoc. a patente ${jb.plate || 'S/N'})`;
    }

    try {
      await updateDoc(doc(db, 'drivers', driverId), { balance: type === 'assignment' ? currentBalance + amount : currentBalance - amount });
      await addDoc(collection(db, 'expenses'), { driverId, driverEmail: dEmail, driverName: dName, type, amount, detail: detailString, jobId: assocJobId, createdAt: Date.now() });
      e.target.reset(); showAlert(type === 'assignment' ? "Fondo asignado correctamente." : "Gasto registrado");
    } catch (err) { console.error(err); }
  };

  const submitReturn = async () => {
    if (!returnReceipt || !myDriver?.balance) return;
    try {
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: 'Rendición de Vuelto (En revisión)', receiptImage: returnReceipt, createdAt: Date.now() });
      setIsReturnOpen(false); setReturnReceipt(null); showAlert("Comprobante enviado. Esperando validación de Admin.");
    } catch(e) {}
  };

  const approveReturn = async (exp) => {
    try {
      const d = drivers.find(x => x.id === exp.driverId);
      if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: Math.max(0, (d.balance||0) - exp.amount) });
      await updateDoc(doc(db, 'expenses', exp.id), { type: 'return', detail: 'Rendición de Vuelto (Aprobada)' });
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

  const TI = ({t}) => t==='assignment' ? <ArrowUpCircle className="w-5 h-5 text-green-500 shrink-0"/> : t==='pending_return' ? <Clock className="w-5 h-5 text-amber-500 shrink-0"/> : t==='expense' ? <ArrowDownCircle className="w-5 h-5 text-red-500 shrink-0"/> : <CheckCircle className="w-5 h-5 text-blue-500 shrink-0"/>;

  if (isAdminView) {
    return (
      <main className="max-w-5xl mx-auto p-4 pt-6 pb-24">
        {viewingReceipt && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white p-4 rounded-3xl w-full max-w-sm relative"><button onClick={()=>setViewingReceipt(null)} className="absolute top-2 right-2 bg-slate-200 p-1 rounded-full"><X className="w-4 h-4"/></button><img src={viewingReceipt} className="w-full h-auto rounded-xl shadow-sm"/></div></div>}
        <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Wallet className="text-blue-600"/> Control Viáticos</h2>
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            {drivers.map(d => (
              <div key={d.id} className={`bg-white p-4 rounded-3xl border cursor-pointer ${selectedDriverId===d.id?'border-blue-500 ring-2 ring-blue-100':''}`} onClick={()=>setSelectedDriverId(d.id===selectedDriverId?null:d.id)}>
                <div className="flex justify-between items-center"><div><p className="font-extrabold text-base text-slate-800">{d.name}</p><p className="text-xs text-slate-400 font-bold">{d.email}</p></div><div className="text-right"><p className="text-[10px] uppercase font-bold text-slate-400">Saldo</p><p className="font-black text-lg text-green-600">{formatMoney(d.balance||0)}</p></div></div>
                {selectedDriverId === d.id && (
                  <form onSubmit={e=>addExp(e,'assignment',Number(e.target.amount.value), 'Asignación de fondos', d.id, d.name, d.email)} className="mt-4 border-t pt-3 space-y-2.5" onClick={e=>e.stopPropagation()}>
                    <input name="amount" type="number" required placeholder="Monto a asignar $" className="w-full border-2 rounded-xl p-2.5 text-sm font-bold outline-none"/>
                    <select name="jobId" className="w-full border-2 rounded-xl p-2.5 text-xs font-semibold bg-white text-slate-700 outline-none">
                       <option value="">Asociar a un Trabajo (Opcional)</option>
                       {activeOrPendingJobs.map(j => <option key={j.id} value={j.id}>{j.client} - {j.brand} ({j.plate || 'S/N'})</option>)}
                    </select>
                    <button className="bg-blue-600 text-white py-2 w-full rounded-xl font-bold text-sm">Cargar Dinero</button>
                  </form>
                )}
              </div>
            ))}
          </div>
          <div className="bg-white p-5 rounded-3xl border max-h-[65vh] flex flex-col overflow-hidden w-full">
            <h3 className="font-bold text-slate-700 mb-4 text-sm">{selectedDriverId ? 'Movimientos del Conductor' : 'Historial de Rendiciones'}</h3>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {expenses.filter(e => selectedDriverId ? e.driverId === selectedDriverId : true).map(e => (
                <div key={e.id} className="bg-slate-50 p-3 rounded-2xl border flex gap-3 items-start text-xs font-bold w-full overflow-hidden">
                  <TI t={e.type}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 break-words">{e.detail}</p>
                    <p className="text-[10px] text-slate-400 truncate">{!selectedDriverId && <span>{e.driverName} • </span>}{new Date(e.createdAt).toLocaleDateString()}</p>
                    {e.receiptImage && <button onClick={()=>setViewingReceipt(e.receiptImage)} className="mt-1.5 text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded font-bold">Ver Comprobante</button>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span className={e.type==='expense'?'text-red-500':'text-green-600'}>{e.type==='expense'?'-':'+'}{formatMoney(e.amount)}</span>
                    {e.type==='pending_return' && <button onClick={()=>approveReturn(e)} className="bg-green-600 text-white px-2 py-1 rounded-lg text-[11px] font-bold">Aprobar</button>}
                    {e.type!=='pending_return' && <button onClick={()=>delExp(e)} className="text-red-500 bg-red-50 p-1.5 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!myDriver) return <p className="text-center font-bold p-8">No registrado en el equipo.</p>;
  const bal = myDriver.balance || 0; const hasPending = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  return (
    <main className="max-w-md mx-auto p-4 pt-6 space-y-6 pb-24">
      {viewingReceipt && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-white p-4 rounded-2xl w-full relative"><button onClick={()=>setViewingReceipt(null)} className="absolute top-2 right-2 p-1 bg-slate-100 rounded-full"><X/></button><img src={viewingReceipt} className="w-full rounded-xl shadow-md"/></div></div>}
      
      {isReturnOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-4"><h3 className="font-extrabold text-lg">Rendir Fondos</h3><button onClick={()=>{setIsReturnOpen(false);setReturnReceipt(null)}} className="bg-slate-100 p-1.5 rounded-full"><X className="w-4 h-4"/></button></div>
            <p className="font-bold text-slate-500">Monto total a transferir: <span className="text-blue-600 font-black text-xl block">{formatMoney(bal)}</span></p>
            <label className="block border-2 border-dashed p-6 text-center mt-4 rounded-xl cursor-pointer bg-slate-50 relative">
              <input type="file" className="hidden" accept="image/*" onChange={async e=>{const f=e.target.files[0];if(!f)return;const b=await window.createImageBitmap(f,{resizeWidth:800});const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);setReturnReceipt(c.toDataURL('image/jpeg',0.6));b.close();}}/>
              {returnReceipt ? <><CheckCircle className="mx-auto text-green-500 w-8 h-8"/><p className="font-bold text-xs mt-1 text-green-700">Comprobante Listo</p></> : <><Camera className="mx-auto text-slate-400 w-8 h-8"/><p className="font-bold text-xs mt-1">Cargar Pantallazo Transferencia</p></>}
            </label>
            <button onClick={submitReturn} disabled={!returnReceipt} className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm ${returnReceipt?'bg-green-600 text-white shadow-md':'bg-slate-200 text-slate-400'}`}>Enviar Rendición</button>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-center text-white shadow-md"><p className="font-bold uppercase text-xs opacity-75 mb-1">Fondo Asignado Actual</p><p className="text-4xl font-black">{formatMoney(bal)}</p></div>
      <form onSubmit={e=>addExp(e,'expense',Number(e.target.amount.value), e.target.detail.value, myDriver.id, myDriver.name, myDriver.email)} className="bg-white p-5 rounded-3xl border space-y-4 shadow-sm"><h3 className="font-extrabold text-base flex items-center gap-1.5 text-slate-800"><Receipt className="text-red-500 w-5 h-5"/> Registrar Gasto</h3><input name="detail" required placeholder="¿En qué gastaste? (Ej. Peaje)" className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none"/><input name="amount" type="number" required placeholder="Monto $" className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none"/><button type="submit" disabled={bal<=0||hasPending} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl disabled:bg-slate-200 disabled:text-slate-400 text-sm shadow-sm">Guardar Movimiento</button></form>
      {hasPending ? <div className="bg-amber-50 p-4 border border-amber-200 rounded-2xl text-center text-amber-700 font-bold text-xs"><Clock className="w-5 h-5 mx-auto mb-1 text-amber-500 animate-pulse"/>Tu rendición está en revisión por administración.</div> : (bal>0 && <button onClick={()=>setIsReturnOpen(true)} className="w-full bg-green-50 text-green-700 font-bold py-3 rounded-2xl border-2 border-green-200 flex justify-center items-center gap-1.5 text-sm shadow-sm"><CheckCircle className="w-4 h-4"/> Rendir Vuelto</button>)}
      <div className="bg-white p-5 rounded-3xl border shadow-sm">
        <h3 className="font-extrabold text-sm text-slate-700 mb-3">Mis Últimos Movimientos</h3>
        <div className="space-y-2.5 max-h-56 overflow-y-auto">{expenses.filter(e=>e.driverId===myDriver.id).map(e=>(
          <div key={e.id} className="bg-slate-50 p-2.5 rounded-xl border flex gap-3 text-xs font-bold items-start"><TI t={e.type}/><div className="flex-1 min-w-0"><p className="text-slate-800 break-words">{e.detail}</p><p className="text-[10px] text-slate-400">{new Date(e.createdAt).toLocaleDateString()}</p>{e.receiptImage && <button onClick={()=>setViewingReceipt(e.receiptImage)} className="mt-1 text-[10px] text-blue-600 underline font-bold">Ver foto</button>}</div><div className="flex items-center gap-1.5 shrink-0 ml-1"><span className={e.type==='expense'?'text-red-500':'text-green-600'}>{e.type==='expense'?'-':'+'}{formatMoney(e.amount)}</span>{e.type!=='assignment'&&e.type!=='pending_return'&&<button onClick={()=>delExp(e)} className="bg-red-50 text-red-500 p-1 rounded-md"><Trash2 className="w-3.5 h-3.5"/></button>}</div></div>
        ))}</div>
      </div>
    </main>
  );
}

function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail, showAlert, showConfirm }) {
  const [menuOpenId, setMenuOpenId] = useState(null); const [jobToFail, setJobToFail] = useState(null); const isAdmin = role === 'admin';
  
  const fJobs = jobs.filter(j => {
    if (!isAdmin && (!j.assignedEmails?.includes(currentUserEmail) && j.acceptedByEmail !== currentUserEmail)) return false;
    if (!j.createdAt) return true;
    if (!isAdmin && (Date.now() - j.createdAt) > 604800000) return false;
    return true;
  });

  const sJobs = [...fJobs].sort((a, b) => {
    const ord = isAdmin ? { pending:1, accepted:2, completed:3, failed:3 } : { accepted:1, pending:2, completed:3, failed:3 };
    if(ord[a.status]!==ord[b.status]) return ord[a.status]-ord[b.status];
    if(a.status==='completed'||a.status==='failed') return (b.completedAt||b.createdAt)-(a.completedAt||a.createdAt);
    return (a.scheduledDate?new Date(a.scheduledDate).getTime():a.createdAt) - (b.scheduledDate?new Date(b.scheduledDate).getTime():b.createdAt);
  });

  const aJobs = sJobs.filter(j => j.status==='pending'||j.status==='accepted');
  const hJobs = sJobs.filter(j => j.status==='completed'||j.status==='failed');

  const getDStr = j => j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0]);
  const cpyWapp = j => { navigator.clipboard.writeText(`${getDStr(j)}\n${j.client}\n${j.brand} ${j.model}\n${j.plate||j.vin}\n${j.origin} - ${j.destination}`).then(()=>showAlert("Texto del servicio copiado.")); setMenuOpenId(null); };

  return (
    <div className="pb-16">
      {aJobs.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {aJobs.map(j => (
            <div key={j.id} className="bg-white rounded-3xl border p-5 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-3 border-b pb-3">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${j.status==='pending'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{j.status==='pending'?'Pendiente':'En Curso'}</span>
                <div className="flex gap-1.5 items-center">
                  {isAdmin && <button onClick={()=>onEditJob(j)} className="p-1 text-blue-600"><Edit2 className="w-4 h-4"/></button>}
                  <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-1 text-slate-400"><MoreVertical className="w-4 h-4"/></button>
                  {menuOpenId===j.id && (
                    <div className="absolute right-4 top-14 bg-white border shadow-2xl rounded-xl w-44 z-50 overflow-hidden text-xs">
                      <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-slate-50"><Copy className="w-4 h-4"/> Copiar Texto</button>
                      <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t"><XCircle className="w-4 h-4"/> Cancelar / Falló</button>
                    </div>
                  )}
                </div>
              </div>
              <h3 className="font-extrabold text-lg text-slate-800 leading-tight">{j.brand} {j.model}</h3>
              <p className="text-xs font-bold text-slate-400 mb-3">{j.client}</p>
              {j.tripType === 'viaje' && <div className="bg-blue-50 border border-blue-100 rounded-xl p-2 mb-3 text-center text-xs font-bold text-blue-700 uppercase">Viaje Fuera de Santiago</div>}
              <div className="space-y-1 text-xs font-bold text-slate-600 mb-4">
                <p><MapPin className="inline w-3.5 h-3.5 text-slate-300 mr-1"/> {j.origin}</p>
                <p><Navigation className="inline w-3.5 h-3.5 text-slate-300 mr-1"/> {j.destination}</p>
                <p className="text-slate-400 mt-2">Patente/VIN: <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded ml-1 uppercase">{j.plate || j.vin || 'N/A'}</span></p>
              </div>
              <div className="mt-auto pt-3 border-t flex flex-col">
                {j.status === 'pending' && (!isAdmin || j.assignedEmails?.includes(currentUserEmail)) && <button onClick={()=>updateDoc(doc(db,'transport_jobs',j.id),{status:'accepted',acceptedByEmail:currentUserEmail})} className="bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md">Reclamar Traslado</button>}
                {((j.status === 'accepted' && (isAdmin || j.acceptedByEmail === currentUserEmail)) || (j.status !== 'completed' && j.status !== 'failed' && isAdmin)) && <button onClick={()=>onStartChecklist(j)} className="bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md">Iniciar Checklist</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {hJobs.length > 0 && (
        <div className="mt-4">
          <h3 className="font-extrabold text-lg text-slate-700 mb-3 border-b-2 pb-1">Historial Simplificado</h3>
          <div className="flex flex-col gap-2.5">
            {hJobs.map(j => (
              <div key={j.id} className="bg-white p-3.5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs font-bold shadow-sm relative pl-4 overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${j.status==='failed'?'bg-red-500':'bg-green-500'}`}></div>
                <div>
                   <div className="flex gap-2 items-center mb-1"><span className={`px-2 py-0.5 rounded text-[9px] uppercase ${j.status==='failed'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{j.status==='failed'?'Fallido':'Ok'}</span><p className="text-sm font-black text-slate-800">{j.brand} {j.model} <span className="text-blue-600 uppercase text-xs ml-1">[{j.plate||'S/N'}]</span></p></div>
                   <p className="text-slate-500 font-semibold">{j.origin} ➔ {j.destination} <span className="text-slate-400 ml-1">({getDStr(j)})</span></p>
                   {j.status==='failed' && <p className="text-red-600 text-[11px] mt-0.5 font-bold">Razón: {j.failedReason}</p>}
                </div>
                <div className="flex gap-1.5 mt-2 sm:mt-0">
                  <button onClick={()=>cpyWapp(j)} className="p-2 bg-blue-50 text-blue-600 rounded-xl" title="Copiar Texto"><Copy className="w-4 h-4"/></button>
                  <button onClick={async ()=>{ try { const docPDF = await buildPDFDoc(j); docPDF.save(`Check.${j.plate || 'SN'}.pdf`); } catch(e){showAlert("Error generando PDF");} }} className="p-2 bg-slate-100 text-slate-700 rounded-xl" title="Descargar PDF"><FileDown className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
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
    </div>
  );
}

function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm }) {
  const isQuick = job.id === 'NEW_QUICK_JOB'; const DK = `ck_${job.id}`;
  const [step, setStep] = useState(() => Number(localStorage.getItem(`${DK}_s`)||1));
  const [formData, setFormData] = useState(() => {
    try { const s=localStorage.getItem(DK); if(s) return JSON.parse(s); } catch(e){}
    return { client: job.client||'', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false }, docs: { soap:false, permiso:false, revTecnica:false, gases:false }, observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null };
  });

  useEffect(() => { localStorage.setItem(DK, JSON.stringify(formData)); localStorage.setItem(`${DK}_s`, step); }, [formData, step, DK]);

  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  const handlePic = async (e, id) => {
    const f=e.target.files[0]; if(!f)return;
    try {
      const b = await window.createImageBitmap(f,{resizeWidth:800}); const c=document.createElement('canvas'); c.width=b.width; c.height=b.height; c.getContext('2d').drawImage(b,0,0);
      setF('photos', {...formData.photos, [id]:c.toDataURL('image/jpeg',0.6)}); b.close();
    } catch(err){ showAlert("Error al optimizar foto."); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if(!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    let d = {...formData}; if(d.noReception){ d.receiverName="ENTREGA SIN RECEPCIÓN"; d.receiverRut="N/A"; }
    const fd = { scheduledDate: new Date().toISOString().split('T')[0], client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType || 'traslado', expectedTollCost: job.expectedTollCost || 0 };
    try {
      if(isQuick) { fd.assignedDriverName="Auto-creado"; fd.acceptedByEmail=currentUserEmail; await addDoc(collection(db,'transport_jobs'), fd); }
      else { await updateDoc(doc(db,'transport_jobs',job.id), fd); }
      localStorage.removeItem(DK); localStorage.removeItem(`${DK}_s`); showAlert("Checklist Finalizado."); onComplete();
    } catch(e) { showAlert("Guardado localmente. Se subirá al recuperar señal."); onComplete(); }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border pb-10">
      <div className="bg-blue-600 text-white p-5 flex justify-between items-center rounded-t-3xl"><h2 className="font-bold text-base"><FileText className="inline w-5 h-5 mr-1"/> Formulario Checklist</h2><button type="button" onClick={()=>showConfirm("¿Pausar llenado?", onCancel)} className="bg-blue-800 px-3 py-1 rounded-xl text-xs font-bold">Pausar</button></div>
      <div className="flex bg-slate-100 h-1"><div className={`bg-green-500 transition-all duration-300 ${step===1?'w-1/2':'w-full'}`}></div></div>
      <div className="p-5">
        {step === 1 ? (
          <div className="space-y-4 text-sm">
            <input value={formData.client} onChange={e=>setF('client',e.target.value)} placeholder="Cliente" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700"/>
            <div className="grid grid-cols-2 gap-4"><input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="border-2 p-3 rounded-xl font-bold text-slate-700"/><input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="border-2 p-3 rounded-xl font-bold text-slate-700"/></div>
            <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente o VIN" className="w-full border-2 p-3 rounded-xl font-bold uppercase text-slate-700"/>
            
            <div className="space-y-1 pt-2"><label className="text-xs font-extrabold text-slate-400 uppercase">Combustible: {formData.fuelLevel}%</label><input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={e=>setF('fuelLevel',e.target.value)} className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"/></div>
            
            <div className="grid grid-cols-4 gap-2 pt-2">
              {['front','left','right','back'].map(p=><label key={p} className={`border-2 p-2 rounded-2xl text-center cursor-pointer relative overflow-hidden h-20 flex flex-col justify-center items-center ${formData.photos[p]?'bg-green-50 border-green-400':'border-dashed'}`}><input type="file" className="hidden" accept="image/*" onChange={e=>handlePic(e,p)}/><Camera className="w-5 h-5 text-slate-400 mb-0.5"/> <span className="text-[10px] font-bold text-slate-500 uppercase">{p}</span></label>)}
            </div>
            <button type="button" onClick={()=>setStep(2)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-6 text-sm">Siguiente Paso</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="flex items-center gap-2.5 p-4 bg-amber-50 rounded-2xl border-amber-300 border-2 cursor-pointer"><input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-5 h-5 cursor-pointer"/> <span className="font-extrabold text-sm text-slate-700">Dejar sin firma (Local cerrado / sin personal)</span></label>
            {!formData.noReception && (
              <><input required={!formData.noReception} value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre del receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/><input required={!formData.noReception} value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT Receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/><SignaturePad onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/></>
            )}
            <div className="flex gap-2 pt-4 border-t"><button type="button" onClick={()=>setStep(1)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm flex-1">Atrás</button><button type="submit" className="bg-green-600 text-white p-3 rounded-xl font-bold text-sm flex-[2]">Guardar Todo</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

const globalStyles = <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');body{font-family:'Nunito',sans-serif;background-color:#f8fafc;}`}</style>;