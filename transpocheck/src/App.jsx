import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, Edit2, Bell, Share2, X, Calendar, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Map, Ticket, Settings
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

const CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];
const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;
const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

const getRouteStr = (j) => {
  if (j.tripType === 'revision') {
     if (j.checklist?.rtStatus === 'aprobado') {
         const ret = j.checklist.rtReturnOption === 'other' ? j.checklist.rtReturnDestination : j.origin;
         return `${j.origin} - PRT - ${ret || 'N/A'}`;
     }
     if (j.checklist?.rtStatus === 'rechazado') return `${j.origin} - PRT (Rechazada)`;
     return `${j.origin} - PRT`;
  }
  return `${j.origin} - ${j.destination}`;
};

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
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
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
      <button type="button" onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,300,150); if(onClear) onClear(); }} className="mt-2 text-sm text-red-500 font-bold px-3 py-1.5 bg-red-50 rounded-lg">Limpiar firma</button>
    </div>
  );
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
  const [editingToll, setEditingToll] = useState(null);
  const [editingDestination, setEditingDestination] = useState(null);
  
  const [fleetFilter, setFleetFilter] = useState('');
  const [destDirectionFilter, setDestDirectionFilter] = useState('Todos'); 
  
  const [adminTab, setAdminTab] = useState('dashboard');
  const [configTab, setConfigTab] = useState('vehicles');
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [mainTab, setMainTab] = useState('jobs');
  const [activeRole, setActiveRole] = useState('driver');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const isFirstLoad = useRef(true);

  const [dialogConfig, setDialogConfig] = useState(null);
  const showAlert = (message) => setDialogConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setDialogConfig({ type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialogConfig(null);

  const triggerNotification = (title, body) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body: body, icon: '/logo.png', vibrate: [200, 100, 200] })).catch(() => new Notification(title, { body }));
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
          if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail)) triggerNotification('📍 ¡Nuevo Traslado!', `Para el ${formatDateDisplay(d.scheduledDate) || 'Hoy'}`);
          if (change.type === 'modified' && d.status === 'accepted' && isRealAdmin && activeRole === 'admin') triggerNotification('✅ Trabajo Aceptado', `Conductor: ${d.acceptedByEmail} aceptó el traslado.`);
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

  const globalStyles = <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');body{font-family:'Nunito',sans-serif;}`}</style>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg"><Car className="w-10 h-10 text-white" /></div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2">LogisticAPP</h1>
          <p className="text-slate-500 mb-10 text-lg">Gestión inteligente</p>
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e))} className="w-full bg-white border-2 text-slate-700 font-bold py-4 px-4 rounded-2xl flex items-center justify-center gap-3 text-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" /> Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  const exportToExcel = () => {
    const headers = ['ID', 'Fecha Prog.', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Ruta Real', 'Conductores Asignados', 'Conductor Realizó', 'Estado', 'Fecha Creación'];
    const rows = jobs.map(j => {
      let realizedBy = '';
      if (['completed', 'accepted', 'failed'].includes(j.status)) realizedBy = j.acceptedByEmail ? (drivers.find(d => d.email === j.acceptedByEmail)?.name || j.acceptedByEmail) : (j.assignedDriverName || '');
      let st = j.status === 'pending' ? 'Pendiente' : j.status === 'accepted' ? 'En Curso' : j.status === 'completed' ? 'Completado' : `Fallido - ${j.failedReason || ''}`;
      return [ j.id, `"${formatDateDisplay(j.scheduledDate) || ''}"`, `"${j.client || ''}"`, `"${j.brand || ''}"`, `"${j.model || ''}"`, `"${j.plate || j.vin || ''}"`, `"${getRouteStr(j)}"`, `"${j.assignedDrivers?.map(d=>d.name).join(' - ') || ''}"`, `"${realizedBy}"`, `"${st}"`, `"${new Date(j.createdAt).toLocaleString()}"` ];
    });
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = "Reporte_Trabajos.csv"; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleDriverSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { name: fd.get('driverName'), email: fd.get('driverEmail').toLowerCase(), licenses: fd.getAll('licenses'), licenseExpiry: fd.get('licenseExpiry') };
    try {
      if (editingDriver) { await updateDoc(doc(db, 'drivers', editingDriver.id), data); setEditingDriver(null); showAlert("Conductor actualizado."); } 
      else { data.balance = 0; data.createdAt = Date.now(); await addDoc(collection(db, 'drivers'), data); showAlert("Conductor creado."); }
    } catch (err) {}
  };

  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const client = fd.get('client') === 'OTRO' ? fd.get('manualClient') : fd.get('client');
    const data = { client, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase() };
    try {
      if (editingVehicle) { await updateDoc(doc(db, 'vehicles', editingVehicle.id), data); setEditingVehicle(null); showAlert("Vehículo actualizado."); } 
      else { data.createdAt = Date.now(); await addDoc(collection(db, 'vehicles'), data); showAlert("Vehículo guardado."); }
    } catch (err) {}
  };

  const handleTollSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), km: fd.get('km'), direction: fd.get('direction'), route: fd.get('route'), priceAuto: Number(fd.get('pa')), priceTruck2: Number(fd.get('pt2')), priceTruckMore: Number(fd.get('ptm')) };
    try {
      if (editingToll) { await updateDoc(doc(db, 'tolls', editingToll.id), data); setEditingToll(null); showAlert("Peaje actualizado."); } 
      else { await addDoc(collection(db, 'tolls'), data); showAlert("Peaje creado."); }
    } catch(err) {}
  };

  const handleDestSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), tolls: fd.getAll('tollIds') };
    try {
      if (editingDestination) { await updateDoc(doc(db, 'destinations', editingDestination.id), data); setEditingDestination(null); showAlert("Destino actualizado."); } 
      else { await addDoc(collection(db, 'destinations'), data); showAlert("Destino guardado."); }
    } catch(err) {}
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
    
    // Opciones RT
    const [revType, setRevType] = useState('A');
    const [revA_gases, setRevA_gases] = useState(false);
    const [revA_revision, setRevA_revision] = useState(false);
    const [revA_inspeccion, setRevA_inspeccion] = useState(false);
    const [revA_frenos, setRevA_frenos] = useState(false);
    const [revB_tipo, setRevB_tipo] = useState('completa');
    
    const selDest = destinations.find(d => d.id === selectedDestId);
    const totalTolls = selDest ? selDest.tolls.reduce((acc, tid) => acc + (tolls.find(x => x.id === tid) ? Number(tolls.find(x => x.id === tid)[tollCat]) : 0), 0) : 0;

    const handlePlateChange = (e) => {
      const val = e.target.value.toUpperCase(); setPlate(val);
      const v = vehicles.find(x => x.plate === val);
      if (v) { setBrand(v.brand); setModel(v.model); if (CLIENTES.includes(v.client)) setSelectedClient(v.client); else { setSelectedClient('OTRO'); setManualClient(v.client); } }
    };

    const handleCreateJobSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const selectedDriverIds = formData.getAll('assignedDriverId');
      if (selectedDriverIds.length === 0) return showAlert("Debes seleccionar al menos un conductor.");

      const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
      const finalClient = selectedClient === 'OTRO' ? manualClient : selectedClient;
      
      const rtData = tripType === 'revision' ? {
        type: revType,
        gases: revType === 'A' ? revA_gases : (revB_tipo === 'gases'),
        revision: revType === 'A' ? revA_revision : (revB_tipo === 'completa'),
        inspeccion: revType === 'A' ? revA_inspeccion : false,
        frenos: revType === 'A' ? revA_frenos : false,
        tipoB: revType === 'B' ? revB_tipo : null
      } : null;

      const newJob = {
        scheduledDate: formData.get('scheduledDate'), client: finalClient, brand, model, vin: plate, plate,
        origin: formData.get('origin'), destination: tripType === 'viaje' ? (selDest?.name || '') : formData.get('destination'),
        tripType, rtData, expectedTollCost: tripType === 'viaje' ? totalTolls : 0, tollCategory: tripType === 'viaje' ? tollCat : null,
        assignedDrivers: assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email})), assignedEmails: assignedDriversList.map(d => d.email),
        status: 'pending', createdAt: Date.now(), checklist: null
      };

      try {
        await addDoc(collection(db, 'transport_jobs'), newJob);
        if (plate && !vehicles.find(v => v.plate === plate)) await addDoc(collection(db, 'vehicles'), { plate, brand, model, client: finalClient, createdAt: Date.now() });
        setAdminTab('dashboard'); showAlert(`Trabajo asignado exitosamente.`);
      } catch (error) {}
    };

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border shadow-sm">
        <h2 className="text-2xl font-extrabold mb-6 border-b pb-4">Crear Nuevo Trabajo</h2>
        <form onSubmit={handleCreateJobSubmit} className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-700">1. Tipo de Servicio</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={()=>setTripType('traslado')} className={`flex-1 p-3 border-2 rounded-xl font-bold text-sm ${tripType === 'traslado' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white text-slate-500'}`}>Traslado Local</button>
              <button type="button" onClick={()=>setTripType('viaje')} className={`flex-1 p-3 border-2 rounded-xl font-bold text-sm ${tripType === 'viaje' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white text-slate-500'}`}>Viaje Interurbano</button>
              <button type="button" onClick={()=>setTripType('revision')} className={`flex-1 p-3 border-2 rounded-xl font-bold text-sm ${tripType === 'revision' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white text-slate-500'}`}>Revisión Técnica</button>
            </div>
            {tripType === 'revision' && (
              <div className="p-4 bg-white border-2 border-blue-100 rounded-xl space-y-4 mt-4">
                 <h4 className="text-xs font-extrabold text-blue-600 uppercase">Detalle Revisión</h4>
                 <select value={revType} onChange={e=>setRevType(e.target.value)} className="w-full border-2 p-3 text-sm rounded-xl font-bold outline-none">
                   <option value="A">Revisión Tipo A</option>
                   <option value="B">Revisión Tipo B</option>
                 </select>
                 {revType === 'A' && (
                   <div className="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600">
                     <label className="flex gap-2"><input type="checkbox" checked={revA_gases} onChange={e=>setRevA_gases(e.target.checked)} className="w-4 h-4 rounded"/> Gases</label>
                     <label className="flex gap-2"><input type="checkbox" checked={revA_revision} onChange={e=>setRevA_revision(e.target.checked)} className="w-4 h-4 rounded"/> Revisión</label>
                     <label className="flex gap-2"><input type="checkbox" checked={revA_inspeccion} onChange={e=>setRevA_inspeccion(e.target.checked)} className="w-4 h-4 rounded"/> Insp. Visual</label>
                     <label className="flex gap-2"><input type="checkbox" checked={revA_frenos} onChange={e=>setRevA_frenos(e.target.checked)} className="w-4 h-4 rounded"/> Cert. Frenos</label>
                   </div>
                 )}
                 {revType === 'B' && (
                   <select value={revB_tipo} onChange={e=>setRevB_tipo(e.target.value)} className="w-full border-2 p-3 text-sm rounded-xl font-bold outline-none">
                     <option value="completa">Revisión Completa</option>
                     <option value="gases">Sólo Gases</option>
                   </select>
                 )}
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="font-bold text-slate-700">2. Vehículo</h3>
             <div className="grid grid-cols-2 gap-4">
               <input value={plate} onChange={handlePlateChange} type="text" placeholder="Patente o VIN" className="w-full border-2 border-blue-200 p-3 text-sm rounded-xl col-span-2 uppercase font-bold bg-white text-blue-900" />
               <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 p-3 text-sm rounded-xl font-semibold bg-white" />
               <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 p-3 text-sm rounded-xl font-semibold bg-white" />
             </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-700">3. Programación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="scheduledDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full border-2 p-3 text-sm rounded-xl font-semibold bg-white" />
              <div className="space-y-2">
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border-2 p-3 text-sm rounded-xl font-semibold bg-white">
                  <option value="">Seleccione Cliente...</option>
                  {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="OTRO">Otro (Ingreso manual)</option>
                </select>
                {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Nombre del cliente" className="w-full border-2 p-3 text-sm rounded-xl font-semibold bg-white" />}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <input name="origin" type="text" placeholder="Desde (Origen)" className="w-full border-2 p-3 text-sm rounded-xl font-semibold bg-white" />
              {tripType !== 'viaje' ? (
                <input name="destination" type="text" placeholder={tripType === 'revision' ? 'Planta de Revisión (Destino)' : 'Hasta (Destino)'} className="w-full border-2 p-3 text-sm rounded-xl font-semibold bg-white" />
              ) : (
                <div className="col-span-1 md:col-span-2 space-y-4 mt-2">
                  <select value={selectedDestId} onChange={e => setSelectedDestId(e.target.value)} required className="w-full border-2 border-blue-200 p-3 text-sm rounded-xl font-bold bg-white">
                    <option value="">Seleccione Destino Interurbano...</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {selectedDestId && (
                    <div className="p-4 bg-white border-2 border-blue-100 rounded-xl space-y-3">
                      <select value={tollCat} onChange={e => setTollCat(e.target.value)} className="w-full border-2 p-3 rounded-xl text-sm font-semibold">
                        <option value="priceAuto">Auto / Camioneta</option>
                        <option value="priceTruck2">Camión 2 Ejes</option>
                        <option value="priceTruckMore">Camión más de 2 Ejes</option>
                      </select>
                      <div className="flex justify-between bg-blue-50 p-3 rounded-xl"><span className="font-bold text-blue-800 text-sm">Gastos de Peajes Est.:</span><span className="font-black text-blue-600 text-lg">{formatMoney(totalTolls)}</span></div>
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
                  <label key={d.id} className="flex items-center p-4 border-b hover:bg-blue-50 cursor-pointer">
                    <input type="checkbox" name="assignedDriverId" value={d.id} className="w-5 h-5 rounded text-blue-600" />
                    <div className="ml-4"><span className="block font-bold">{d.name}</span></div>
                  </label>
                ))}
             </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-extrabold text-lg">Guardar y Asignar</button>
        </form>
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
            <button onClick={() => { setActiveRole(activeRole === 'admin' ? 'driver' : 'admin'); setMainTab('jobs'); }} className="flex items-center gap-1.5 bg-white/20 px-3 py-2 rounded-xl text-sm font-bold">
              {activeRole === 'admin' ? <ToggleRight className="w-6 h-6 text-green-300"/> : <ToggleLeft className="w-6 h-6 text-slate-300"/>}
              <span className="hidden md:inline">{activeRole === 'admin' ? 'Admin' : 'Conductor'}</span>
            </button>
          )}
          <button onClick={() => signOut(auth)} className="bg-white/10 p-2.5 rounded-xl"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          {activeRole === 'admin' ? (
            <>
              <div className="flex gap-2 mb-6 bg-white p-2 rounded-2xl border shadow-sm">
                <button onClick={() => setAdminTab('dashboard')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><ClipboardList className="w-5 h-5"/><span className="hidden sm:inline">Trabajos</span></button>
                <button onClick={() => setAdminTab('newJob')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Plus className="w-5 h-5"/><span className="hidden sm:inline">Crear</span></button>
              </div>
              
              {adminTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><h2 className="text-xl font-extrabold">Monitor</h2><button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex gap-2"><Download className="w-4 h-4"/> Excel</button></div>
                  <JobsList jobs={jobs} drivers={drivers} role="admin" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
                </div>
              )}
              {adminTab === 'newJob' && <NewJobForm />}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold">Mis Trabajos</h2>
              <JobsList jobs={jobs} drivers={drivers} role="driver" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      
      {/* PESTAÑA CONFIG (SOLO ADMIN) */}
      {currentView === 'main' && mainTab === 'config' && activeRole === 'admin' && (
        <main className="max-w-5xl mx-auto p-4 pt-6 pb-24">
          <h2 className="text-2xl font-extrabold mb-6"><Settings className="inline text-slate-500"/> Configuración</h2>
          <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-2xl border shadow-sm">
             <button onClick={() => setConfigTab('vehicles')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${configTab==='vehicles'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Truck className="w-5 h-5"/><span className="hidden sm:inline">Flota</span></button>
             <button onClick={() => setConfigTab('drivers')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${configTab==='drivers'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Users className="w-5 h-5"/><span className="hidden sm:inline">Conductores</span></button>
             <button onClick={() => setConfigTab('tolls')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${configTab==='tolls'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Ticket className="w-5 h-5"/><span className="hidden sm:inline">Peajes</span></button>
             <button onClick={() => setConfigTab('destinations')} className={`flex-1 py-3 rounded-xl font-bold flex justify-center gap-2 ${configTab==='destinations'?'bg-blue-100 text-blue-700':'text-slate-500'}`}><Map className="w-5 h-5"/><span className="hidden sm:inline">Destinos</span></button>
          </div>

          {configTab === 'vehicles' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form key={editingVehicle ? editingVehicle.id : 'new_veh'} onSubmit={editingVehicle ? handleVehicleSubmit : handleVehicleSubmit} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><Truck className="text-blue-600 inline"/> {editingVehicle ? 'Editar' : 'Nuevo'} Vehículo</h3>
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
              <div className="bg-white p-6 rounded-3xl border flex flex-col">
                <div className="flex justify-between mb-4"><h3 className="font-extrabold text-lg">Base Flota</h3><select onChange={e=>setFleetFilter(e.target.value)} className="border-2 p-2 rounded-xl text-xs font-bold"><option value="">Todos</option>{CLIENTES.map(c=><option key={c}>{c}</option>)}<option value="OTRO">Otros</option></select></div>
                <div className="space-y-2 overflow-y-auto max-h-[55vh]">
                  {vehicles.filter(v => !fleetFilter ? true : (fleetFilter === 'OTRO' ? !CLIENTES.includes(v.client) : v.client === fleetFilter)).map(v=>(
                    <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-xl">
                      <div><p className="font-extrabold text-sm">{v.brand} {v.model}</p><p className="text-xs font-bold text-blue-600">{v.plate}</p></div>
                      <div className="flex gap-1"><button onClick={()=>setEditingVehicle(v)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>showConfirm("¿Eliminar?", ()=>deleteDoc(doc(db,'vehicles',v.id)))} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {configTab === 'drivers' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form key={editingDriver ? editingDriver.id : 'new_drv'} onSubmit={editingDriver ? handleDriverSubmit : handleDriverSubmit} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><User className="text-blue-600 inline"/> {editingDriver ? 'Editar' : 'Nuevo'} Conductor</h3>
                <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre" required className="w-full border-2 p-3 rounded-xl font-semibold"/>
                <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail" required type="email" className="w-full border-2 p-3 rounded-xl font-semibold"/>
                <div className="space-y-1.5 border-t pt-2"><label className="text-xs font-extrabold text-slate-500 uppercase">Licencias</label><div className="grid grid-cols-3 gap-1.5">{LICENCIAS.map(l => (<label key={l} className="flex items-center gap-1 p-1 bg-slate-50 border rounded-lg text-[11px] font-bold"><input type="checkbox" name="licenses" value={l} defaultChecked={editingDriver?.licenses?.includes(l)} className="w-3.5 h-3.5" />{l}</label>))}</div></div>
                <div className="space-y-1"><label className="text-xs font-extrabold text-slate-500 uppercase">Vencimiento Licencia</label><input name="licenseExpiry" type="date" defaultValue={editingDriver?.licenseExpiry || ''} className="w-full border-2 p-2 rounded-xl text-sm font-semibold" /></div>
                <div className="flex gap-2">
                  {editingDriver && <button type="button" onClick={()=>setEditingDriver(null)} className="bg-slate-100 p-3 rounded-xl font-bold w-1/3">Cancelar</button>}
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Guardar</button>
                </div>
              </form>
              <div className="bg-white p-6 rounded-3xl border max-h-[65vh] overflow-y-auto">
                <h3 className="font-extrabold text-lg mb-4">Equipo Registrado</h3>
                {drivers.map(d=>(
                  <div key={d.id} className="p-3 bg-slate-50 border rounded-xl mb-2 flex justify-between items-center text-sm">
                    <div><p className="font-extrabold">{d.name}</p><p className="text-xs text-slate-500">{d.email}</p>{d.licenses?.length>0 && <p className="text-[10px] font-black text-blue-600">Licencias: {d.licenses.join(', ')}</p>}</div>
                    <button onClick={() => setEditingDriver(d)} className="p-2 text-blue-600 bg-blue-50 rounded-xl"><Edit2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {configTab === 'tolls' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form key={editingToll ? editingToll.id : 'new_toll'} onSubmit={handleTollSubmit} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><Ticket className="text-blue-600 inline"/> {editingToll ? 'Editar' : 'Nuevo'} Peaje</h3>
                <input name="name" defaultValue={editingToll?.name} placeholder="Nombre Peaje" required className="w-full border-2 p-3 rounded-xl font-semibold text-sm"/>
                <div className="grid grid-cols-2 gap-3"><input name="km" defaultValue={editingToll?.km} placeholder="Km" className="border-2 p-3 rounded-xl font-semibold text-sm"/><select name="direction" defaultValue={editingToll?.direction || 'Norte'} className="border-2 p-3 rounded-xl font-semibold text-sm"><option>Norte</option><option>Sur</option></select></div>
                <input name="route" defaultValue={editingToll?.route} placeholder="Ruta (Ej. Ruta 5)" className="w-full border-2 p-3 rounded-xl font-semibold text-sm"/>
                <input name="pa" type="number" defaultValue={editingToll?.priceAuto} placeholder="Valor Auto" required className="w-full border-2 p-3 rounded-xl text-sm font-semibold"/>
                <input name="pt2" type="number" defaultValue={editingToll?.priceTruck2} placeholder="Valor Camión 2 Ejes" required className="w-full border-2 p-3 rounded-xl text-sm font-semibold"/>
                <input name="ptm" type="number" defaultValue={editingToll?.priceTruckMore} placeholder="Valor Camión >2 Ejes" required className="w-full border-2 p-3 rounded-xl text-sm font-semibold"/>
                <div className="flex gap-2">
                   {editingToll && <button type="button" onClick={() => setEditingToll(null)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}
                   <button type="submit" className="flex-1 w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">Guardar Peaje</button>
                </div>
              </form>
              <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                <h3 className="font-extrabold text-lg mb-4">Peajes Base</h3>
                {tolls.map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 border rounded-xl mb-3 flex justify-between items-center text-xs">
                    <div><p className="font-bold text-sm">{t.name}</p><p className="text-slate-400 font-semibold">{t.route} (Km {t.km} {t.direction})</p></div>
                    <div className="flex gap-1"><button onClick={() => setEditingToll(t)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>showConfirm("¿Eliminar peaje?", async () => await deleteDoc(doc(db, 'tolls', t.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {configTab === 'destinations' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form key={editingDestination ? editingDestination.id : 'new_dest'} onSubmit={handleDestSubmit} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><Map className="text-blue-600 inline"/> {editingDestination ? 'Editar' : 'Nuevo'} Destino</h3>
                <input name="name" defaultValue={editingDestination?.name} placeholder="Ciudad de Destino" required className="w-full border-2 p-3 rounded-xl text-sm font-semibold"/>
                <div className="flex justify-between items-center"><p className="text-xs font-bold text-slate-500">Filtrar Peajes:</p><select value={destDirectionFilter} onChange={(e) => setDestDirectionFilter(e.target.value)} className="border-2 p-1 rounded-lg text-xs font-bold"><option value="Todos">Todos</option><option value="Norte">Norte</option><option value="Sur">Sur</option></select></div>
                <div className="max-h-48 overflow-y-auto border-2 rounded-xl p-1 bg-slate-50 text-xs font-semibold">
                  {tolls.filter(t => destDirectionFilter === 'Todos' || t.direction === destDirectionFilter).map(t => (
                    <label key={t.id} className="flex items-center gap-2 p-2 border-b last:border-0 cursor-pointer"><input type="checkbox" name="tollIds" value={t.id} defaultChecked={editingDestination?.tolls?.includes(t.id)} className="w-4 h-4 rounded"/> {t.name} ({t.direction})</label>
                  ))}
                </div>
                <div className="flex gap-2">
                   {editingDestination && <button type="button" onClick={() => setEditingDestination(null)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}
                   <button type="submit" className="flex-1 w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">Guardar Destino</button>
                </div>
              </form>
              <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                <h3 className="font-extrabold text-lg mb-4">Rutas</h3>
                {destinations.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 border rounded-xl mb-3 flex justify-between items-center text-sm font-bold">
                    <div><p className="text-slate-800">{d.name}</p><p className="text-xs font-semibold text-slate-400">{d.tolls?.length || 0} peajes</p></div>
                    <div className="flex gap-1"><button onClick={() => setEditingDestination(d)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>showConfirm("¿Eliminar destino?", async () => await deleteDoc(doc(db, 'destinations', d.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4 pt-6">
          <ChecklistForm job={selectedJob} db={db} currentUserEmail={currentUserEmail} onCancel={() => setCurrentView('main')} onComplete={() => { setSelectedJob(null); setCurrentView('main'); }} showAlert={showAlert} showConfirm={showConfirm} />
        </main>
      )}

      {currentView === 'main' && (
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-2.5 z-40 pb-[env(safe-area-inset-bottom)] shadow-lg">
          <button onClick={() => { setSelectedJob({ id: 'NEW_QUICK_JOB', client: '', brand: '', model: '', plate: '', vin: '', origin: '', destination: '', tripType: 'traslado', expectedTollCost: 0, scheduledDate: new Date().toISOString().split('T')[0] }); setCurrentView('checklist'); }} className="flex flex-col items-center text-slate-400 hover:text-blue-600 w-16"><Zap className="w-6 h-6 mb-0.5 bg-slate-100 p-1 rounded-xl"/><span className="text-[10px] font-bold">Desde 0</span></button>
          <button onClick={() => setMainTab('jobs')} className={`flex flex-col items-center w-16 ${mainTab==='jobs' ? 'text-blue-600' : 'text-slate-400'}`}><ClipboardList className={`w-6 h-6 mb-0.5 ${mainTab==='jobs'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Trabajos</span></button>
          <button onClick={() => setMainTab('ranking')} className={`flex flex-col items-center w-16 ${mainTab==='ranking' ? 'text-yellow-600' : 'text-slate-400'}`}><Trophy className={`w-6 h-6 mb-0.5 ${mainTab==='ranking'?'bg-yellow-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Ranking</span></button>
          <button onClick={() => setMainTab('expenses')} className={`flex flex-col items-center w-16 ${mainTab==='expenses' ? 'text-blue-600' : 'text-slate-400'}`}><Wallet className={`w-6 h-6 mb-0.5 ${mainTab==='expenses'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Gastos</span></button>
          {activeRole === 'admin' && (
             <button onClick={() => setMainTab('config')} className={`flex flex-col items-center w-16 ${mainTab==='config' ? 'text-blue-600' : 'text-slate-400'}`}><Settings className={`w-6 h-6 mb-0.5 ${mainTab==='config'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Config.</span></button>
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
      e.target.reset(); showAlert(type === 'assignment' ? "Fondo asignado." : "Gasto registrado");
    } catch (err) { console.error(err); }
  };

  const submitReturn = async () => {
    if (!myDriver?.balance) return;
    if (returnMethod === 'transferencia' && !returnReceipt) return showAlert("Comprobante obligatorio.");
    
    const detailText = returnMethod === 'transferencia' ? 'Rendición de Vuelto (Transferencia - En revisión)' : 'Rendición de Vuelto (Efectivo - En revisión)';
    try {
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: detailText, receiptImage: returnReceipt || null, returnMethod, createdAt: Date.now() });
      setIsReturnOpen(false); setReturnReceipt(null); showAlert("Comprobante enviado. Esperando validación del Admin.");
    } catch(e) {}
  };

  const approveReturn = async (exp) => {
    try {
      const d = drivers.find(x => x.id === exp.driverId);
      if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: Math.max(0, (d.balance||0) - exp.amount) });
      await updateDoc(doc(db, 'expenses', exp.id), { type: 'return', detail: `Rendición Aprobada (${exp.returnMethod==='efectivo'?'Efectivo':'Transferencia'})` });
      showAlert("Rendición aprobada. Saldo del conductor vuelto a $0.");
    } catch(e){}
  };

  const delExp = (exp) => {
    if (!isAdminView && exp.type === 'assignment') return showAlert("No posees permisos.");
    showConfirm("¿Eliminar registro? El saldo se recalculará.", async () => {
      try {
        const d = drivers.find(x => x.id === exp.driverId);
        if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: (d.balance||0) + (exp.type === 'assignment' ? -exp.amount : exp.amount) });
        await deleteDoc(doc(db, 'expenses', exp.id));
      } catch(e){}
    });
  };

  const TI = ({t}) => t==='assignment' ? <ArrowUpCircle className="w-5 h-5 text-green-500 shrink-0"/> : t==='pending_return' ? <Clock className="w-5 h-5 text-amber-500 shrink-0"/> : t==='expense' ? <ArrowDownCircle className="w-5 h-5 text-red-500 shrink-0"/> : <CheckCircle className="w-5 h-5 text-blue-500 shrink-0"/>;

  const EditExpenseModal = ({ expense, onClose }) => {
    const handleUpdateSubmit = async (e) => {
      e.preventDefault();
      if (!isAdminView && expense.type === 'assignment') { showAlert("No puedes modificar fondos asignados."); return onClose(); }
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
          <div className="flex gap-4 mt-6"><button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button type="submit" className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Guardar Cambios</button></div>
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
                       {activeOrPendingJobs.map(j => <option key={j.id} value={j.id}>{j.client} - {j.brand} ({j.plate || 'S/N'})</option>)}
                    </select>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 w-full rounded-xl font-bold text-sm transition-colors">Enviar</button>
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
                  <div className="mt-1"><TI t={e.type}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 break-words">{e.detail}</p>
                    <p className="text-[10px] text-slate-400 truncate">{!selectedDriverId && <span>{e.driverName} • </span>}{new Date(e.createdAt).toLocaleDateString()}</p>
                    {e.receiptImage && <button onClick={() => setViewingReceipt(e.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Foto</button>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span className={e.type==='expense'?'text-red-500':'text-green-600'}>{e.type==='expense'?'-':'+'}{formatMoney(e.amount)}</span>
                    {e.type==='pending_return' && <button onClick={()=>approveReturn(e)} className="bg-green-600 text-white px-2 py-1 rounded-lg text-[11px] font-bold">Aprobar</button>}
                    {e.type!=='pending_return' && (
                      <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                        <button onClick={() => setEditingExpense(e)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={() => delExp(e)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!myDriver) return <main className="p-8 text-center text-slate-500 font-bold pb-24">No estás registrado como conductor.</main>;
  const bal = myDriver.balance || 0;
  const hasPending = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  // Alerta 24 hrs
  let needsToReturn = false;
  if (bal > 0) {
    const lastMovement = expenses.filter(e => e.driverId === myDriver.id)[0];
    if (lastMovement && (Date.now() - lastMovement.createdAt > 86400000)) needsToReturn = true;
  }

  return (
    <main className="max-w-md mx-auto p-4 pt-6 space-y-6 pb-24">
      {needsToReturn && !hasPending && (
        <div className="bg-amber-100 border-2 border-amber-300 p-5 rounded-3xl text-center shadow-lg mb-6">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-2 animate-bounce"/>
          <h3 className="font-extrabold text-amber-800 text-lg">¡Tienes fondos por rendir!</h3>
          <p className="text-sm font-bold text-amber-700 mt-1">Han pasado más de 24 horas desde tu último registro. Por favor, rinde el vuelto de {formatMoney(bal)} a la brevedad.</p>
        </div>
      )}

      {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

      {isReturnOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Rendir Vuelto</h3><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
            <p className="text-sm font-bold text-slate-500 mb-4 border-b border-slate-100 pb-4">Monto total a rendir: <span className="text-blue-600 text-xl font-extrabold block mt-1">{formatMoney(bal)}</span></p>
            
            <div className="flex gap-2 mb-4">
              <button onClick={()=>setReturnMethod('transferencia')} className={`flex-1 p-3 rounded-xl font-bold text-sm border-2 ${returnMethod==='transferencia'?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-500'}`}>Transferencia</button>
              <button onClick={()=>setReturnMethod('efectivo')} className={`flex-1 p-3 rounded-xl font-bold text-sm border-2 ${returnMethod==='efectivo'?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-500'}`}>Efectivo</button>
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
              <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl text-center"><p className="font-bold text-sm text-slate-700">Entregarás el dinero físicamente a la administración. Tu saldo volverá a $0 cuando lo aprueben.</p></div>
            )}

            <div className="flex gap-4 mt-6"><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={submitReturn} disabled={returnMethod==='transferencia' && !returnReceipt} className={`flex-[2] py-3 rounded-xl font-extrabold transition-all ${returnMethod==='efectivo' || returnReceipt ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200' : 'bg-slate-200 text-slate-400'}`}>Confirmar</button></div>
          </div>
        </div>
      )}

      {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-md text-center text-white relative overflow-hidden">
        <Wallet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
        <p className="font-bold uppercase text-xs opacity-75 mb-1">Fondo Asignado Actual</p>
        <p className="text-5xl font-black">{formatMoney(bal)}</p>
      </div>
      <form onSubmit={e=>addExp(e,'expense',Number(e.target.amount.value), e.target.detail.value, myDriver.id, myDriver.name, myDriver.email)} className="bg-white p-6 rounded-3xl border space-y-4 shadow-sm"><h3 className="font-extrabold text-base flex items-center gap-1.5 text-slate-800"><Receipt className="text-red-500 w-5 h-5"/> Registrar Gasto</h3><input name="detail" required placeholder="¿En qué gastaste? (Ej. Peaje)" className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none"/><input name="amount" type="number" required placeholder="Monto $" className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none"/><button type="submit" disabled={bal<=0||hasPending} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:bg-slate-200 disabled:text-slate-400 text-sm shadow-sm">Guardar Movimiento</button></form>
      
      {hasPending ? <div className="bg-amber-50 p-4 border border-amber-200 rounded-2xl text-center text-amber-700 font-bold text-sm"><Clock className="w-6 h-6 mx-auto mb-1 text-amber-500 animate-pulse"/>Tu rendición está en revisión por administración.</div> : (bal>0 && <button onClick={()=>setIsReturnOpen(true)} className="w-full bg-green-50 text-green-700 font-bold py-4 rounded-2xl border-2 border-green-200 flex justify-center items-center gap-2 shadow-sm text-lg"><CheckCircle className="w-5 h-5"/> Rendir Vuelto</button>)}
      
      <div className="bg-white p-5 rounded-3xl border shadow-sm">
        <h3 className="font-extrabold text-sm text-slate-700 mb-3">Mis Últimos Movimientos</h3>
        <div className="space-y-2.5 max-h-60 overflow-y-auto">{expenses.filter(e=>e.driverId===myDriver.id).map(e=>(
          <div key={e.id} className="bg-slate-50 p-3 rounded-xl border flex gap-3 text-xs font-bold items-start w-full overflow-hidden"><TI t={e.type}/><div className="flex-1 min-w-0"><p className="text-slate-800 break-words">{e.detail}</p><p className="text-[10px] text-slate-400">{new Date(e.createdAt).toLocaleDateString()}</p>{e.receiptImage && <button onClick={()=>setViewingReceipt(e.receiptImage)} className="mt-1.5 text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded font-bold">Ver Foto</button>}</div><div className="flex items-center gap-1.5 shrink-0 ml-1"><span className={e.type==='expense'?'text-red-500':'text-green-600'}>{e.type==='expense'?'-':'+'}{formatMoney(e.amount)}</span>{e.type!=='assignment'&&e.type!=='pending_return'&&(<div className="flex gap-1 border-l border-slate-200 pl-2 ml-1"><button onClick={()=>setEditingExpense(e)} className="p-1 text-blue-500 hover:bg-blue-100 rounded-md"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={()=>delExp(e)} className="bg-red-50 text-red-500 p-1 rounded-md"><Trash2 className="w-3.5 h-3.5"/></button></div>)}</div></div>
        ))}</div>
      </div>
    </main>
  );
}

function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail, showAlert, showConfirm }) {
  const [menuOpenId, setMenuOpenId] = useState(null); const [jobToFail, setJobToFail] = useState(null); const [historyClientFilter, setHistoryClientFilter] = useState(''); const isAdmin = role === 'admin';
  
  const fJobs = jobs.filter(j => (!isAdmin && !j.assignedEmails?.includes(currentUserEmail) && j.acceptedByEmail !== currentUserEmail) || !j.createdAt || (!isAdmin && (Date.now() - j.createdAt) > 604800000) ? false : true);
  const sJobs = [...fJobs].sort((a, b) => {
    const ord = isAdmin ? { pending:1, accepted:2, completed:3, failed:3 } : { accepted:1, pending:2, completed:3, failed:3 };
    if(ord[a.status]!==ord[b.status]) return ord[a.status]-ord[b.status];
    if(a.status==='completed'||a.status==='failed') return (b.completedAt||b.createdAt)-(a.completedAt||a.createdAt);
    return (a.scheduledDate?new Date(a.scheduledDate).getTime():a.createdAt) - (b.scheduledDate?new Date(b.scheduledDate).getTime():b.createdAt);
  });

  const aJobs = sJobs.filter(j => j.status==='pending'||j.status==='accepted');
  const hJobs = sJobs.filter(j => j.status==='completed'||j.status==='failed').filter(j => !historyClientFilter ? true : (historyClientFilter==='OTRO' ? !CLIENTES.includes(j.client) : j.client===historyClientFilter));

  const pdfFn = async (job) => {
    if(!window.jspdf) await new Promise(r=>{const s=document.createElement('script');s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";s.onload=r;document.head.appendChild(s);});
    const d=new window.jspdf.jsPDF(); d.setFillColor(37,99,235); d.rect(0,0,210,30,'F'); d.setTextColor(255); d.setFontSize(22); d.setFont("helvetica","bold"); d.text(job.tripType==='revision'?"CERTIFICADO REVISIÓN":"CHECKLIST DE TRASLADO",105,20,null,null,"center"); d.setTextColor(0);
    if(job.status==='failed'){d.setTextColor(220,38,38); d.setFontSize(12); d.text(`FALLIDO: ${job.failedReason||''}`,20,37); d.setTextColor(0);}
    let dN = job.checklist?.assignedDriverName||job.acceptedByEmail||""; if(job.acceptedByEmail){const fd=drivers?.find(x=>x.email===job.acceptedByEmail); if(fd) dN=fd.name;}
    d.setFillColor(241,245,249); d.rect(15,40,180,50,'F'); d.setFontSize(14); d.setFont("helvetica","bold"); d.text("1. DATOS SERVICIO",20,48); d.setFontSize(11); d.setFont("helvetica","normal");
    d.text(`Fecha:`,20,58); d.setFont("helvetica","bold"); d.text(`${formatDateDisplay(job.scheduledDate)||'-'}`,45,58); d.setFont("helvetica","normal"); d.text(`Cliente:`,110,58); d.setFont("helvetica","bold"); d.text(`${job.client||''}`,125,58);
    d.setFont("helvetica","normal"); d.text(`Vehículo:`,20,66); d.setFont("helvetica","bold"); d.text(`${job.brand||''} ${job.model||''}`,40,66); d.setFont("helvetica","normal"); d.text(`Patente:`,110,66); d.setFont("helvetica","bold"); d.text(`${job.plate||job.vin||''}`,125,66);
    d.setFont("helvetica","normal"); d.text(`Ruta:`,20,74); d.setFont("helvetica","bold"); d.text(getRouteStr(job),35,74); d.setFont("helvetica","normal"); d.text(`Conductor:`,20,82); d.setFont("helvetica","bold"); d.text(`${dN}`,45,82);
    
    if (job.tripType === 'viaje' && job.expectedTollCost > 0) { d.setFont("helvetica","normal"); d.text(`Peajes est.:`,110,82); d.setFont("helvetica","bold"); d.text(`${formatMoney(job.expectedTollCost)}`,135,82); }

    d.setFillColor(241,245,249); d.rect(15,95,180,45,'F'); d.setFontSize(14); d.setFont("helvetica","bold"); d.text("2. ESTADO",20,103); d.setFontSize(11); d.setFont("helvetica","normal");
    d.text(`Combustible:`,20,113); d.setFont("helvetica","bold"); d.text(`${job.checklist?.fuelLevel||'0'}%`,50,113);
    const dc=job.checklist?.docs||{}; d.setFont("helvetica","normal"); d.text(`SOAP:`,20,122); d.setFont("helvetica","bold"); d.text(dc.soap?'SÍ':'NO',35,122); d.setFont("helvetica","normal"); d.text(`Permiso:`,60,122); d.setFont("helvetica","bold"); d.text(dc.permiso?'SÍ':'NO',80,122); d.setFont("helvetica","normal"); d.text(`Rev.Tec:`,110,122); d.setFont("helvetica","bold"); d.text(dc.revTecnica?'SÍ':'NO',130,122); d.setFont("helvetica","normal"); d.text(`Gases:`,150,122); d.setFont("helvetica","bold"); d.text(dc.gases?'SÍ':'NO',165,122);
    d.setFont("helvetica","normal"); d.text(`Obs:`,20,131); d.text(d.splitTextToSize(`${job.checklist?.observations||'Ninguna'}`,140),35,131);
    
    const sy=150; d.setFillColor(241,245,249); d.rect(15,sy,180,70,'F');
    if(job.tripType==='revision'){
      d.setFontSize(14); d.setFont("helvetica","bold"); d.text("3. RESULTADO REVISIÓN",20,sy+8); d.setFontSize(12);
      if(job.checklist?.rtStatus==='aprobado'){d.setTextColor(22,163,74);d.text("APROBADO",20,sy+20);d.setTextColor(0);}else{d.setTextColor(220,38,38);d.text("RECHAZADO",20,sy+20);d.setTextColor(0);d.setFontSize(11);d.setFont("helvetica","normal");d.text(`Razón: ${job.checklist?.rtRejectReason||''}`,20,sy+30);}
    } else {
      d.setFontSize(14); d.setFont("helvetica","bold"); d.text("3. RECEPCIÓN",20,sy+8);
      if(job.checklist?.noReception){d.setTextColor(220,38,38); d.text("ENTREGA SIN RECEPCIÓN",20,sy+20); d.setTextColor(0);}
      else {d.setFontSize(11); d.setFont("helvetica","normal"); d.text(`Nombre:`,20,sy+18); d.setFont("helvetica","bold"); d.text(`${job.checklist?.receiverName||''}`,40,sy+18); d.setFont("helvetica","normal"); d.text(`RUT:`,110,sy+18); d.setFont("helvetica","bold"); d.text(`${job.checklist?.receiverRut||''}`,125,sy+18); if(job.checklist?.signatureData){d.text(`Firma:`,20,sy+35); d.addImage(job.checklist.signatureData,'PNG',40,sy+25,60,35);}}
    }
    
    if(job.checklist?.photos){
      let cy=30; let cc=1; let ap=false; const ph=job.checklist.photos; const lbls={front:'Frente',driver:'Lat Piloto',passenger:'Lat Copiloto',back:'Atrás',tire:'Repuesto',dashboard:'Tablero',det1:'Det 1',det2:'Det 2',det3:'Det 3',det4:'Det 4'};
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
  const cpyWapp = j => { navigator.clipboard.writeText(`${getDStr(j).substring(0,5)}\n${j.client}\n${j.brand} ${j.model}\n${j.plate||j.vin}\n${getRouteStr(j)}`).then(()=>showAlert("Copiado al portapapeles.")); setMenuOpenId(null); };

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
                  <div className="relative">
                    <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-1 text-slate-400"><MoreVertical className="w-4 h-4"/></button>
                    {menuOpenId===j.id && (
                      <div className="absolute right-4 top-10 bg-white border shadow-2xl rounded-xl w-44 z-50 overflow-hidden text-xs">
                        <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-slate-50"><Copy className="w-4 h-4"/> Copiar Info</button>
                        <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t"><XCircle className="w-4 h-4"/> Falló / Cancelado</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <h3 className="font-extrabold text-lg text-slate-800 leading-tight">{j.brand} {j.model}</h3>
              <p className="text-xs font-bold text-slate-400 mb-3">{j.client}</p>
              {j.tripType === 'revision' && <div className="mb-3 bg-amber-50 border border-amber-200 p-2 rounded-xl text-center"><span className="text-[10px] font-black text-amber-700 uppercase">REVISIÓN TÉCNICA (TIPO {j.rtData?.type})</span></div>}
              {j.tripType === 'viaje' && <div className="bg-blue-50 border border-blue-100 rounded-xl p-2 mb-3 text-center text-xs font-bold text-blue-700 uppercase">Viaje Fuera de Santiago</div>}
              
              <div className="space-y-1 text-xs font-bold text-slate-600 mb-4">
                <p><MapPin className="inline w-3.5 h-3.5 text-slate-300 mr-1"/> {j.origin}</p>
                <p><Navigation className="inline w-3.5 h-3.5 text-slate-300 mr-1"/> {j.tripType==='revision' ? 'Planta de Revisión (PRT)' : j.destination}</p>
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
          <div className="flex justify-between items-center mb-3 border-b-2 pb-1">
             <h3 className="font-extrabold text-lg text-slate-700">Historial</h3>
             {isAdmin && (
                <select onChange={e=>setHistoryClientFilter(e.target.value)} className="border-2 border-slate-200 p-1.5 rounded-lg text-xs font-bold outline-none text-slate-600">
                  <option value="">Todos los Clientes</option>
                  {CLIENTES.map(c=><option key={c} value={c}>{c}</option>)}
                  <option value="OTRO">Otros</option>
                </select>
             )}
          </div>
          <div className="flex flex-col gap-2.5">
            {hJobs.map(j => (
              <div key={j.id} className="bg-white p-3.5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs font-bold shadow-sm relative pl-4 overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${j.status==='failed'?'bg-red-500':'bg-green-500'}`}></div>
                <div>
                   <div className="flex gap-2 items-center mb-1"><span className={`px-2 py-0.5 rounded text-[9px] uppercase ${j.status==='failed'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{j.status==='failed'?'Fallido':'Ok'}</span><p className="text-sm font-black text-slate-800">{j.brand} {j.model} <span className="text-blue-600 uppercase text-xs ml-1">[{j.plate||'S/N'}]</span></p></div>
                   <p className="text-slate-500 font-semibold">{getRouteStr(j)} <span className="text-slate-400 ml-1">({getDStr(j)})</span></p>
                   {j.status==='failed' && <p className="text-red-600 text-[11px] mt-0.5 font-bold">Razón: {j.failedReason}</p>}
                </div>
                <div className="flex gap-1.5 mt-2 sm:mt-0">
                  <button onClick={()=>cpyWapp(j)} className="p-2 bg-blue-50 text-blue-600 rounded-xl" title="Copiar Texto"><Copy className="w-4 h-4"/></button>
                  <button onClick={async ()=>{ try { const docPDF = await pdfFn(j); docPDF.save(`Check.${j.plate || 'SN'}.pdf`); } catch(e){showAlert("Error generando PDF");} }} className="p-2 bg-slate-100 text-slate-700 rounded-xl" title="Descargar PDF"><FileDown className="w-4 h-4"/></button>
                  {isAdmin && <button onClick={()=>showConfirm("¿Eliminar?", ()=>deleteDoc(doc(db,'transport_jobs',j.id)))} className="p-2 bg-red-50 text-red-500 rounded-xl" title="Eliminar Historial"><Trash2 className="w-4 h-4"/></button>}
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
    return { client: job.client||'', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', fuelLevel: 50, photos: { front:false, driver:false, passenger:false, back:false, tire:false, dashboard:false, det1:false, det2:false, det3:false, det4:false }, docs: { soap:false, permiso:false, revTecnica:false, gases:false }, observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null, rtStatus: 'aprobado', rtRejectReason: '', rtReturnOption: 'origin', rtReturnDestination: '' };
  });

  useEffect(() => { localStorage.setItem(DK, JSON.stringify(formData)); localStorage.setItem(`${DK}_s`, step); }, [formData, step, DK]);
  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  const handlePic = async (e, id) => {
    const f=e.target.files[0]; if(!f)return;
    try { const b = await window.createImageBitmap(f,{resizeWidth:800}); const c=document.createElement('canvas'); c.width=b.width; c.height=b.height; c.getContext('2d').drawImage(b,0,0); setF('photos', {...formData.photos, [id]:c.toDataURL('image/jpeg',0.6)}); b.close(); } catch(err){ showAlert("Error al optimizar foto."); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (job.tripType !== 'revision' && !formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    let d = {...formData}; 
    if (job.tripType === 'revision') { d.receiverName = "PLANTA RT"; d.receiverRut = "N/A"; } else if(d.noReception) { d.receiverName="ENTREGA SIN RECEPCIÓN"; d.receiverRut="N/A"; }
    const fd = { scheduledDate: new Date().toISOString().split('T')[0], client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType || 'traslado', expectedTollCost: job.expectedTollCost || 0 };
    try {
      if(isQuick) { fd.assignedDriverName="Auto-creado"; fd.acceptedByEmail=currentUserEmail; if (d.plateOrVin) { const vehRef = collection(db, 'vehicles'); onSnapshot(vehRef, async (snap) => { if (!snap.docs.find(doc => doc.data().plate === d.plateOrVin.toUpperCase())) { await addDoc(vehRef, { plate: d.plateOrVin.toUpperCase(), brand: d.brand, model: d.model, client: d.client, createdAt: Date.now() }); } }); } await addDoc(collection(db,'transport_jobs'), fd); }
      else { if (job.tripType === 'revision' && d.rtStatus === 'rechazado') { fd.status = 'failed'; fd.failedReason = d.rtRejectReason || 'Revisión Técnica Rechazada'; const cloneJob = { scheduledDate: d.scheduledDate, client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, tripType: job.tripType, rtData: job.rtData, assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [], status: 'pending', createdAt: Date.now(), checklist: null }; await addDoc(collection(db, 'transport_jobs'), cloneJob); } await updateDoc(doc(db,'transport_jobs',job.id), fd); }
      localStorage.removeItem(DK); localStorage.removeItem(`${DK}_s`); 
      if (job.tripType === 'revision' && d.rtStatus === 'rechazado') showAlert("Revisión RECHAZADA. Se creó un nuevo traslado pendiente."); else showAlert("✅ Checklist guardado."); 
      onComplete();
    } catch(e) { showAlert("Guardado localmente. Se subirá al recuperar señal."); onComplete(); }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border pb-10">
      <div className="bg-blue-600 text-white p-5 flex justify-between items-center rounded-t-3xl"><h2 className="font-bold text-base"><FileText className="inline w-5 h-5 mr-1"/> Checklist</h2><button type="button" onClick={()=>showConfirm("¿Pausar llenado?", onCancel)} className="bg-blue-800 px-3 py-1 rounded-xl text-xs font-bold">Pausar / Salir</button></div>
      <div className="flex bg-slate-100 h-1"><div className={`bg-green-500 transition-all duration-300 ${step===1?'w-1/2':'w-full'}`}></div></div>
      <div className="p-5">
        {step === 1 ? (
          <div className="space-y-4 text-sm">
            <input value={formData.client} onChange={e=>setF('client',e.target.value)} placeholder="Cliente" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700"/>
            <div className="grid grid-cols-2 gap-4"><input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="border-2 p-3 rounded-xl font-bold text-slate-700"/><input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="border-2 p-3 rounded-xl font-bold text-slate-700"/></div>
            <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente o VIN" className="w-full border-2 p-3 rounded-xl font-bold uppercase text-slate-700"/>
            
            {job.tripType === 'revision' && (
              <>
                <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-blue-600">Resultado de la Revisión</h3>
                <select value={formData.rtStatus} onChange={e=>setF('rtStatus', e.target.value)} className={`w-full border-2 p-4 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <option value="aprobado">✅ APROBADO</option><option value="rechazado">❌ RECHAZADO</option>
                </select>
                {formData.rtStatus === 'rechazado' && <input value={formData.rtRejectReason} onChange={e=>setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required className="w-full border-2 border-red-300 p-4 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2" />}
                {formData.rtStatus === 'aprobado' && (
                  <div className="mt-4 p-4 border-2 border-green-200 bg-green-50 rounded-xl space-y-3">
                    <p className="text-sm font-bold text-green-800">¿Hacia dónde se dirige tras aprobar?</p>
                    <div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700"><input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/> Volver al Origen</label><label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700"><input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/> Otro Destino</label></div>
                    {formData.rtReturnOption === 'other' && <input value={formData.rtReturnDestination} onChange={e=>setF('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required className="w-full border-2 border-green-300 p-3 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />}
                  </div>
                )}
              </>
            )}

            <div className="space-y-1 pt-2"><label className="text-xs font-extrabold text-slate-400 uppercase">Combustible: {formData.fuelLevel}%</label><input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={e=>setF('fuelLevel',e.target.value)} className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"/></div>
            
            <h3 className="text-sm font-extrabold border-b-2 border-slate-100 pb-2 mt-6 text-slate-800">Documentos</h3>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'soap', label: 'SOAP' }, { id: 'permiso', label: 'Permiso' }, { id: 'revTecnica', label: 'Rev. Técnica' }, { id: 'gases', label: 'Gases' }].map(doc => (
                <label key={doc.id} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer ${formData.docs[doc.id] ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <input type="checkbox" className="w-4 h-4 text-green-600 rounded cursor-pointer" checked={formData.docs[doc.id]} onChange={(e) => setF('docs', { ...formData.docs, [doc.id]: e.target.checked })} />
                  <span className="font-extrabold text-xs">{doc.label}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-4">
              {[{id:'front', l:'Frente'}, {id:'driver', l:'Piloto'}, {id:'passenger', l:'Copiloto'}, {id:'back', l:'Atrás'}, {id:'tire', l:'Repuesto'}, {id:'dashboard', l:'Tablero'}, {id:'det1', l:'Detalle 1'}, {id:'det2', l:'Detalle 2'}, {id:'det3', l:'Detalle 3'}, {id:'det4', l:'Detalle 4'}].map(p => (
                <label key={p.id} className={`p-1 border-2 rounded-2xl text-center cursor-pointer relative overflow-hidden h-20 flex flex-col justify-center items-center ${formData.photos[p.id]?'bg-green-50 border-green-400':'border-dashed'}`}>
                  <input type="file" className="hidden" accept="image/*" onChange={e=>handlePic(e,p.id)}/>
                  {formData.photos[p.id] ? <><img src={formData.photos[p.id]} className="absolute inset-0 w-full h-full object-cover opacity-50"/><CheckCircle className="text-green-600 w-5 h-5 relative z-10 bg-white rounded-full"/><span className="text-[10px] font-bold text-slate-800 bg-white/90 px-1 rounded relative z-10">{p.l}</span></> : <><Camera className="w-5 h-5 text-slate-400 mb-0.5"/> <span className="text-[10px] font-bold text-slate-500 uppercase">{p.l}</span></>}
                </label>
              ))}
            </div>
            <button type="button" onClick={()=>setStep(2)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-6 text-sm">Siguiente Paso</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {job.tripType !== 'revision' ? (
               <>
                 <label className="flex items-center gap-2.5 p-4 bg-amber-50 rounded-2xl border-amber-300 border-2 cursor-pointer"><input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-5 h-5 cursor-pointer"/> <span className="font-extrabold text-sm text-slate-700">Dejar sin firma (Local cerrado)</span></label>
                 {!formData.noReception && (
                   <><input required={!formData.noReception} value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre del receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/><input required={!formData.noReception} value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT Receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/><SignaturePad onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/></>
                 )}
               </>
            ) : (
               <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl text-center mb-6">
                 <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-2"/>
                 <h3 className="text-lg font-extrabold text-blue-800">Cierre de Revisión Técnica</h3>
               </div>
            )}
            <button type="button" onClick={() => { if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => setF('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }), () => showAlert("Error GPS.")); } }} className={`px-4 py-4 rounded-2xl text-sm w-full font-extrabold shadow-sm ${formData.location ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-slate-100 text-slate-700 border-2'}`}>{formData.location ? "📍 GPS Capturado Exitosamente" : "📍 Tocar para Capturar GPS Actual"}</button>
            <div className="flex gap-2 pt-4 border-t"><button type="button" onClick={()=>setStep(1)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm flex-1">Atrás</button><button type="submit" className="bg-green-600 text-white p-3 rounded-xl font-bold text-sm flex-[2]">Guardar Todo</button></div>
          </form>
        )}
      </div>
    </div>
  );
}