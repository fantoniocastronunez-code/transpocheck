import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, Edit2, Bell, Share2, X, Calendar, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Map, Ticket, Settings } from 'lucide-react';

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

try { enableIndexedDbPersistence(db).catch(()=>{}); } catch (e) {}

const CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];
const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

const SignaturePad = ({ onSave, onClear, initialData }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (initialData) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = initialData; }
  }, [initialData]);

  const drawEvent = (e, type) => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    if (type === 'start') { ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); }
    if (type === 'draw' && isDrawing) { ctx.lineTo(x, y); ctx.stroke(); }
    if (type === 'stop') { setIsDrawing(false); if (onSave) onSave(canvas.toDataURL()); }
  };

  return (
    <div className="border-2 border-dashed border-blue-200 rounded-2xl p-2 bg-white">
      <canvas ref={canvasRef} width={300} height={150} className="w-full h-[150px] touch-none cursor-crosshair bg-white rounded-xl" onPointerDown={e=>drawEvent(e, 'start')} onPointerMove={e=>drawEvent(e, 'draw')} onPointerUp={e=>drawEvent(e, 'stop')} onPointerOut={e=>drawEvent(e, 'stop')} onTouchStart={e=>drawEvent(e, 'start')} onTouchMove={e=>drawEvent(e, 'draw')} onTouchEnd={e=>drawEvent(e, 'stop')} />
      <button type="button" onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,300,150); if(onClear) onClear(); }} className="mt-2 text-sm text-red-500 font-bold px-3 py-1.5 bg-red-50 rounded-lg">Limpiar firma</button>
    </div>
  );
};

const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;
const formatDateDisplay = (date) => { if (!date) return ''; const [y, m, d] = date.split('-'); return `${d}/${m}/${y}`; };

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
  
  const [mainTab, setMainTab] = useState('jobs');
  const [jobsSubTab, setJobsSubTab] = useState('dashboard');
  const [configSubTab, setConfigSubTab] = useState('vehicles');
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [activeRole, setActiveRole] = useState('driver');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const isFirstLoad = useRef(true);
  const [dialogConfig, setDialogConfig] = useState(null);
  const showAlert = (message) => setDialogConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setDialogConfig({ type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialogConfig(null);

  const requestNotificationPermission = () => {
    if (!("Notification" in window)) return showAlert("Tu navegador no soporta notificaciones.");
    Notification.requestPermission().then(permission => {
      if (permission === "granted") { setNotificationsEnabled(true); triggerNotification("¡Notificaciones Activadas!", "Recibirás alertas aquí."); }
    });
  };

  const triggerNotification = (title, body) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: '/logo.png', vibrate: [200, 100, 200] })).catch(() => new Notification(title, { body }));
    else new Notification(title, { body });
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

  useEffect(() => { setActiveRole(isRealAdmin ? 'admin' : 'driver'); }, [isRealAdmin]);

  useEffect(() => {
    if (!user) return;
    const unsubJobs = onSnapshot(collection(db, 'transport_jobs'), (snapshot) => {
      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const d = change.doc.data();
          if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail)) triggerNotification('📍 ¡Nuevo Traslado!', `Vehículo: ${d.brand || 'Vehículo'} programado para ${formatDateDisplay(d.scheduledDate) || 'Hoy'}`);
          if (change.type === 'modified' && d.status === 'accepted' && isRealAdmin && activeRole === 'admin') triggerNotification('✅ Trabajo Aceptado', `Conductor: ${d.acceptedByEmail} aceptó un traslado.`);
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" style={{fontFamily: "'Nunito', sans-serif"}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');body{font-family:'Nunito',sans-serif;}`}</style>
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"><Car className="w-10 h-10 text-white" /></div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2">LogisticAPP</h1>
          <p className="text-slate-500 mb-10 text-lg">Gestión de traslados inteligente</p>
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e=>console.error(e))} className="w-full bg-white border-2 text-slate-700 font-bold py-4 rounded-2xl shadow-sm flex items-center justify-center gap-3 text-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" /> Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  const exportToExcel = () => {
    const headers = ['ID', 'Fecha Prog.', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Desde', 'Hasta', 'Conductores', 'Realizado Por', 'Estado', 'Fecha Creación'];
    const rows = jobs.map(j => {
      let realizedBy = '';
      if (['completed', 'accepted', 'failed'].includes(j.status)) realizedBy = j.acceptedByEmail ? (drivers.find(d => d.email === j.acceptedByEmail)?.name || j.acceptedByEmail) : (j.assignedDriverName || '');
      let st = j.status === 'pending' ? 'Pendiente' : j.status === 'accepted' ? 'En Curso' : j.status === 'completed' ? 'Completado' : `Fallido - ${j.failedReason || ''}`;
      return [j.id, `"${formatDateDisplay(j.scheduledDate) || ''}"`, `"${j.client || ''}"`, `"${j.brand || ''}"`, `"${j.model || ''}"`, `"${j.plate || j.vin || ''}"`, `"${j.origin || ''}"`, `"${j.destination || ''}"`, `"${j.assignedDrivers?.map(d=>d.name).join(' - ') || ''}"`, `"${realizedBy}"`, `"${st}"`, `"${new Date(j.createdAt).toLocaleString()}"`];
    });
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = "Reporte_Trabajos.csv"; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleQuickChecklist = () => {
    setSelectedJob({ id: 'NEW_QUICK_JOB', client: '', brand: '', model: '', plate: '', vin: '', origin: '', destination: '', tripType: 'traslado', expectedTollCost: 0, scheduledDate: new Date().toISOString().split('T')[0] });
    setCurrentView('checklist');
  };

  const submitDriver = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const data = { name: fd.get('driverName'), email: fd.get('driverEmail').toLowerCase(), licenses: fd.getAll('licenses'), licenseExpiry: fd.get('licenseExpiry') };
    try {
      if (editingDriver) { await updateDoc(doc(db, 'drivers', editingDriver.id), data); setEditingDriver(null); showAlert("Conductor actualizado."); } 
      else { data.balance = 0; data.createdAt = Date.now(); await addDoc(collection(db, 'drivers'), data); showAlert("Conductor creado."); } e.target.reset();
    } catch(err) {}
  };

  const submitVehicle = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const client = fd.get('client') === 'OTRO' ? fd.get('manualClient') : fd.get('client');
    const data = { client, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase() };
    try {
      if (editingVehicle) { await updateDoc(doc(db, 'vehicles', editingVehicle.id), data); setEditingVehicle(null); showAlert("Vehículo actualizado."); } 
      else { data.createdAt = Date.now(); await addDoc(collection(db, 'vehicles'), data); showAlert("Vehículo guardado."); } e.target.reset();
    } catch(err) {}
  };

  const submitToll = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const data = { name: fd.get('name'), km: fd.get('km'), direction: fd.get('direction'), route: fd.get('route'), priceAuto: Number(fd.get('pa')), priceTruck2: Number(fd.get('pt2')), priceTruckMore: Number(fd.get('ptm')) };
    try {
      if (editingToll) { await updateDoc(doc(db, 'tolls', editingToll.id), data); setEditingToll(null); showAlert("Peaje actualizado."); } 
      else { await addDoc(collection(db, 'tolls'), data); showAlert("Peaje creado."); } e.target.reset();
    } catch(err){}
  };

  const submitDest = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const data = { name: fd.get('name'), tolls: fd.getAll('tollIds') };
    try {
      if (editingDestination) { await updateDoc(doc(db, 'destinations', editingDestination.id), data); setEditingDestination(null); showAlert("Destino actualizado."); } 
      else { await addDoc(collection(db, 'destinations'), data); showAlert("Destino creado."); } e.target.reset();
    } catch(err){}
  };

  const NewJobForm = () => {
    const [client, setClient] = useState(''); const [manualClient, setManualClient] = useState('');
    const [brand, setBrand] = useState(''); const [model, setModel] = useState(''); const [plate, setPlate] = useState('');
    const [tripType, setTripType] = useState('traslado'); 
    const [selectedDestId, setSelectedDestId] = useState(''); const [tollCat, setTollCat] = useState('priceAuto');
    const [revType, setRevType] = useState('A'); const [revA_gases, setRevA_gases] = useState(false); const [revA_revision, setRevA_revision] = useState(false); const [revA_inspeccion, setRevA_inspeccion] = useState(false); const [revA_frenos, setRevA_frenos] = useState(false); const [revB_tipo, setRevB_tipo] = useState('completa');
    
    const selDest = destinations.find(d => d.id === selectedDestId);
    const totalTolls = selDest ? selDest.tolls.reduce((acc, tid) => acc + (tolls.find(x => x.id === tid) ? Number(tolls.find(x => x.id === tid)[tollCat]) : 0), 0) : 0;

    const handlePlateChange = (e) => {
      const val = e.target.value.toUpperCase(); setPlate(val);
      const v = vehicles.find(x => x.plate === val);
      if (v) { setBrand(v.brand); setModel(v.model); if (CLIENTES.includes(v.client)) setClient(v.client); else { setClient('OTRO'); setManualClient(v.client); } }
    };

    const submitJob = async (e) => {
      e.preventDefault(); const fd = new FormData(e.target); const driverIds = fd.getAll('assignedDriverId');
      if (!driverIds.length) return showAlert("Selecciona al menos un conductor.");
      const cFinal = client === 'OTRO' ? manualClient : client;
      const rtData = tripType === 'revision' ? { type: revType, gases: revType === 'A' ? revA_gases : (revB_tipo === 'gases'), revision: revType === 'A' ? revA_revision : (revB_tipo === 'completa'), inspeccion: revType === 'A' ? revA_inspeccion : false, frenos: revType === 'A' ? revA_frenos : false, tipoB: revType === 'B' ? revB_tipo : null } : null;
      const nj = { scheduledDate: fd.get('scheduledDate'), client: cFinal, brand, model, vin: plate, plate, origin: fd.get('origin'), destination: tripType === 'viaje' ? (selDest?.name || '') : fd.get('destination'), tripType, rtData, expectedTollCost: tripType === 'viaje' ? totalTolls : 0, tollCategory: tripType === 'viaje' ? tollCat : null, assignedDrivers: drivers.filter(d => driverIds.includes(d.id)).map(d => ({id:d.id, name:d.name, email:d.email})), assignedEmails: drivers.filter(d => driverIds.includes(d.id)).map(d => d.email), status: 'pending', createdAt: Date.now(), checklist: null };
      try { 
        await addDoc(collection(db, 'transport_jobs'), nj); 
        if (plate && !vehicles.find(v => v.plate === plate)) await addDoc(collection(db, 'vehicles'), { plate, brand, model, client: cFinal, createdAt: Date.now() });
        setJobsSubTab('dashboard'); showAlert(`Trabajo guardado.`); 
      } catch (e) { console.error(e); }
    };

    return (
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-3xl border shadow-sm">
        <form onSubmit={submitJob} className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
            <h3 className="font-bold text-slate-700 text-sm">Tipo de Servicio</h3>
            <div className="flex gap-2">
              <button type="button" onClick={()=>setTripType('traslado')} className={`flex-1 p-3 border-2 rounded-xl text-xs font-bold ${tripType==='traslado'?'border-blue-500 bg-blue-50 text-blue-700':'bg-white text-slate-500'}`}>Traslado</button>
              <button type="button" onClick={()=>setTripType('viaje')} className={`flex-1 p-3 border-2 rounded-xl text-xs font-bold ${tripType==='viaje'?'border-blue-500 bg-blue-50 text-blue-700':'bg-white text-slate-500'}`}>Viaje Interurbano</button>
              <button type="button" onClick={()=>setTripType('revision')} className={`flex-1 p-3 border-2 rounded-xl text-xs font-bold ${tripType==='revision'?'border-blue-500 bg-blue-50 text-blue-700':'bg-white text-slate-500'}`}>Rev. Técnica</button>
            </div>
            {tripType === 'revision' && (
              <div className="p-3 bg-white border border-blue-100 rounded-xl space-y-3 mt-3">
                 <select value={revType} onChange={e=>setRevType(e.target.value)} className="w-full border p-2 text-sm rounded-xl font-bold text-slate-700"><option value="A">Revisión Tipo A</option><option value="B">Revisión Tipo B</option></select>
                 {revType === 'A' ? (
                   <div className="grid grid-cols-2 gap-2 text-xs font-bold"><label className="flex gap-1"><input type="checkbox" checked={revA_gases} onChange={e=>setRevA_gases(e.target.checked)}/> Gases</label><label className="flex gap-1"><input type="checkbox" checked={revA_revision} onChange={e=>setRevA_revision(e.target.checked)}/> Revisión</label><label className="flex gap-1"><input type="checkbox" checked={revA_inspeccion} onChange={e=>setRevA_inspeccion(e.target.checked)}/> Insp. Visual</label><label className="flex gap-1"><input type="checkbox" checked={revA_frenos} onChange={e=>setRevA_frenos(e.target.checked)}/> Cert. Frenos</label></div>
                 ) : (
                   <select value={revB_tipo} onChange={e=>setRevB_tipo(e.target.value)} className="w-full border p-2 text-sm rounded-xl font-bold"><option value="completa">Completa</option><option value="gases">Sólo Gases</option></select>
                 )}
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
             <h3 className="font-bold text-slate-700 text-sm">Vehículo</h3>
             <div className="grid grid-cols-2 gap-4">
               <input value={plate} onChange={handlePlateChange} type="text" placeholder="Patente o VIN" className="w-full border p-3 rounded-xl col-span-2 uppercase font-bold" />
               <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border p-3 rounded-xl font-semibold" />
               <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border p-3 rounded-xl font-semibold" />
             </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
            <h3 className="font-bold text-slate-700 text-sm">Ruta y Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <input name="scheduledDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full border p-3 rounded-xl font-semibold" />
              <select value={client} onChange={e => setClient(e.target.value)} className="w-full border p-3 rounded-xl font-semibold bg-white text-slate-700">
                <option value="">Cliente...</option>
                {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTRO">Otro</option>
              </select>
              {client === 'OTRO' && <input type="text" value={manualClient} onChange={e => setManualClient(e.target.value)} placeholder="Escribe cliente" className="col-span-2 w-full border p-3 rounded-xl font-semibold" />}
              <input name="origin" type="text" placeholder="Origen" className="col-span-2 w-full border p-3 rounded-xl font-semibold" />
              {tripType === 'traslado' || tripType === 'revision' ? (
                <input name="destination" type="text" placeholder={tripType==='revision'?"Planta PRT":"Destino"} className="col-span-2 w-full border p-3 rounded-xl font-semibold" />
              ) : (
                <div className="col-span-2 space-y-3 border-t pt-3">
                  <select value={selectedDestId} onChange={e => setSelectedDestId(e.target.value)} required className="w-full border p-3 rounded-xl font-bold bg-white">
                    <option value="">Destino Interurbano...</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {selectedDestId && (
                    <div className="p-3 bg-white border rounded-xl space-y-2">
                      <select value={tollCat} onChange={e => setTollCat(e.target.value)} className="w-full border p-2 rounded-lg text-xs font-semibold">
                        <option value="priceAuto">Auto / Camioneta</option><option value="priceTruck2">Camión 2 Ejes</option><option value="priceTruckMore">Camión > 2 Ejes</option>
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
                  <label key={d.id} className="flex items-center p-2 border-b hover:bg-blue-50 cursor-pointer text-sm font-semibold"><input type="checkbox" name="assignedDriverId" value={d.id} className="w-4 h-4 rounded mr-2" />{d.name}</label>
                ))}
             </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-extrabold text-lg">Guardar y Asignar</button>
        </form>
      </div>
    );
  };

  const EditJobModal = ({ job, onClose }) => {
    const [client, setClient] = useState(CLIENTES.includes(job.client) ? job.client : (job.client ? 'OTRO' : ''));
    const [manualClient, setManualClient] = useState(!CLIENTES.includes(job.client) ? job.client : '');

    const updateJob = async (e) => {
      e.preventDefault(); const fd = new FormData(e.target); const dIds = fd.getAll('assignedDriverId');
      const data = {
        scheduledDate: fd.get('scheduledDate'), client: client === 'OTRO' ? manualClient : client, brand: fd.get('brand'), model: fd.get('model'),
        vin: fd.get('plateOrVin'), plate: fd.get('plateOrVin'), origin: fd.get('origin'), destination: fd.get('destination')
      };
      if (dIds.length > 0) {
        const dList = drivers.filter(d => dIds.includes(d.id));
        data.assignedDrivers = dList.map(d => ({id: d.id, name: d.name, email: d.email})); data.assignedEmails = dList.map(d => d.email);
      }
      try { await updateDoc(doc(db, 'transport_jobs', job.id), data); showAlert("Actualizado."); onClose(); } catch(err){}
    };

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-xl font-extrabold">Editar Trabajo</h2><button onClick={onClose} className="p-1 bg-slate-100 rounded-full"><X className="w-5 h-5"/></button></div>
          <form onSubmit={updateJob} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input name="scheduledDate" type="date" defaultValue={job.scheduledDate || new Date().toISOString().split('T')[0]} required className="border p-2 rounded-xl text-sm font-semibold"/>
              <select value={client} onChange={(e) => setClient(e.target.value)} className="border p-2 rounded-xl text-sm font-semibold"><option value="">Cliente...</option>{CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}<option value="OTRO">Otro</option></select>
              {client === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Cliente" className="col-span-2 border p-2 rounded-xl text-sm font-semibold" />}
              <input name="brand" defaultValue={job.brand} placeholder="Marca" className="border p-2 rounded-xl text-sm font-semibold" />
              <input name="model" defaultValue={job.model} placeholder="Modelo" className="border p-2 rounded-xl text-sm font-semibold" />
              <input name="plateOrVin" defaultValue={job.plate || job.vin} placeholder="Patente/VIN" className="col-span-2 border p-2 rounded-xl uppercase font-bold text-sm"/>
              <input name="origin" defaultValue={job.origin} placeholder="Desde" className="col-span-2 border p-2 rounded-xl text-sm font-semibold"/>
              <input name="destination" defaultValue={job.destination} placeholder="Hasta" className="col-span-2 border p-2 rounded-xl text-sm font-semibold"/>
            </div>
            <div className="max-h-24 overflow-y-auto border rounded-xl p-2 bg-slate-50">
                {drivers.map(d => <label key={d.id} className="flex items-center text-xs font-bold p-1"><input type="checkbox" name="assignedDriverId" value={d.id} defaultChecked={job.assignedEmails?.includes(d.email)} className="w-4 h-4 mr-2" />{d.name}</label>)}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Guardar Cambios</button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');body{font-family:'Nunito',sans-serif;}`}</style>
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

      {editingJob && <EditJobModal job={editingJob} onClose={() => setEditingJob(null)} />}

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          {activeRole === 'admin' && (
             <div className="flex bg-slate-200 rounded-xl p-1 mb-6">
               <button onClick={()=>setJobsSubTab('dashboard')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${jobsSubTab==='dashboard'?'bg-white shadow':'text-slate-500'}`}>Monitor</button>
               <button onClick={()=>setJobsSubTab('new')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${jobsSubTab==='new'?'bg-white shadow':'text-slate-500'}`}>Crear Trabajo</button>
             </div>
          )}
          {activeRole === 'admin' && jobsSubTab === 'dashboard' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center"><h2 className="text-xl font-extrabold">Monitor Operativo</h2><button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex gap-1.5 items-center"><Download className="w-4 h-4"/> Excel</button></div>
              <JobsList jobs={jobs} drivers={drivers} role="admin" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} onEditJob={setEditingJob} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
            </div>
          )}
          {activeRole === 'admin' && jobsSubTab === 'new' && <NewJobForm />}
          {activeRole === 'driver' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-extrabold">Mis Trabajos</h2>
              <JobsList jobs={jobs} drivers={drivers} role="driver" onStartChecklist={j => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'config' && activeRole === 'admin' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          <div className="flex flex-wrap bg-slate-200 rounded-xl p-1 mb-6 text-xs sm:text-sm">
            <button onClick={()=>setConfigSubTab('vehicles')} className={`flex-1 py-2 rounded-lg font-bold ${configSubTab==='vehicles'?'bg-white shadow':'text-slate-500'}`}>Flota</button>
            <button onClick={()=>setConfigSubTab('drivers')} className={`flex-1 py-2 rounded-lg font-bold ${configSubTab==='drivers'?'bg-white shadow':'text-slate-500'}`}>Equipo</button>
            <button onClick={()=>setConfigSubTab('tolls')} className={`flex-1 py-2 rounded-lg font-bold ${configSubTab==='tolls'?'bg-white shadow':'text-slate-500'}`}>Peajes</button>
            <button onClick={()=>setConfigSubTab('destinations')} className={`flex-1 py-2 rounded-lg font-bold ${configSubTab==='destinations'?'bg-white shadow':'text-slate-500'}`}>Destinos</button>
          </div>

          {configSubTab === 'tolls' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={submitToll} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><Ticket className="inline text-blue-600"/> {editingToll?'Editar':'Nuevo'} Peaje</h3>
                <input name="name" defaultValue={editingToll?.name} placeholder="Nombre Peaje" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm outline-none"/>
                <div className="grid grid-cols-2 gap-3"><input name="km" defaultValue={editingToll?.km} placeholder="Km" className="border-2 p-2.5 rounded-xl font-semibold text-sm"/><select name="direction" defaultValue={editingToll?.direction||'Norte'} className="border-2 p-2.5 rounded-xl font-semibold text-sm"><option>Norte</option><option>Sur</option></select></div>
                <input name="route" defaultValue={editingToll?.route} placeholder="Ruta" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm"/>
                <div className="grid grid-cols-3 gap-2"><input name="pa" type="number" defaultValue={editingToll?.priceAuto} placeholder="Auto" required className="border-2 p-2.5 rounded-xl text-sm font-semibold"/><input name="pt2" type="number" defaultValue={editingToll?.priceTruck2} placeholder="C2 Ejes" required className="border-2 p-2.5 rounded-xl text-sm font-semibold"/><input name="ptm" type="number" defaultValue={editingToll?.priceTruckMore} placeholder="C>2 Ejes" required className="border-2 p-2.5 rounded-xl text-sm font-semibold"/></div>
                <div className="flex gap-2">{editingToll && <button type="button" onClick={()=>setEditingToll(null)} className="p-3 bg-slate-100 rounded-xl font-bold w-1/3 text-sm">Cancelar</button>}<button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">Guardar Peaje</button></div>
              </form>
              <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                <h3 className="font-extrabold text-lg mb-4">Lista Peajes</h3>
                {tolls.map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 border rounded-xl mb-2 flex justify-between items-center text-xs">
                    <div><p className="font-bold text-sm">{t.name}</p><p className="text-slate-400 font-semibold">{t.route} (Km {t.km} {t.direction})</p><p className="text-blue-600 font-extrabold mt-1">Auto: {formatMoney(t.priceAuto)} | C2: {formatMoney(t.priceTruck2)} | C+: {formatMoney(t.priceTruckMore)}</p></div>
                    <div className="flex gap-1"><button onClick={()=>setEditingToll(t)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>showConfirm("¿Eliminar peaje?", ()=>deleteDoc(doc(db,'tolls',t.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {configSubTab === 'destinations' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={submitDest} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><Map className="inline text-blue-600"/> {editingDestination?'Editar':'Nuevo'} Destino</h3>
                <input name="name" defaultValue={editingDestination?.name} placeholder="Ciudad/Destino" required className="w-full border-2 p-2.5 rounded-xl text-sm font-semibold outline-none"/>
                <div className="flex justify-between items-center"><p className="text-xs font-bold text-slate-500">Filtrar Peajes:</p><select value={destDirectionFilter} onChange={(e) => setDestDirectionFilter(e.target.value)} className="border-2 p-1 rounded-lg text-xs font-bold"><option value="Todos">Todos</option><option value="Norte">Norte</option><option value="Sur">Sur</option></select></div>
                <div className="max-h-48 overflow-y-auto border-2 rounded-xl p-1 bg-slate-50 text-xs font-semibold">
                  {tolls.filter(t => destDirectionFilter==='Todos' || t.direction===destDirectionFilter).map(t => <label key={t.id} className="flex items-center gap-2 p-1.5 border-b hover:bg-slate-100 cursor-pointer"><input type="checkbox" name="tollIds" value={t.id} defaultChecked={editingDestination?.tolls?.includes(t.id)} className="w-4 h-4"/> {t.name} ({t.direction})</label>)}
                </div>
                <div className="flex gap-2">{editingDestination && <button type="button" onClick={()=>setEditingDestination(null)} className="p-3 bg-slate-100 rounded-xl font-bold w-1/3 text-sm">Cancelar</button>}<button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">Guardar Destino</button></div>
              </form>
              <div className="bg-white p-6 rounded-3xl border overflow-y-auto max-h-[65vh]">
                <h3 className="font-extrabold text-lg mb-4">Destinos y Rutas</h3>
                {destinations.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 border rounded-xl mb-2 flex justify-between items-center text-sm font-bold">
                    <div><p className="text-slate-800">{d.name}</p><p className="text-xs font-semibold text-slate-400">{d.tolls?.length||0} Peajes vinculados</p></div>
                    <div className="flex gap-1"><button onClick={()=>setEditingDestination(d)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>showConfirm("¿Eliminar destino?", ()=>deleteDoc(doc(db,'destinations',d.id)))} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {configSubTab === 'vehicles' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={submitVehicle} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><Truck className="inline text-blue-600"/> {editingVehicle?'Editar':'Nuevo'} Vehículo</h3>
                <select name="client" defaultValue={editingVehicle?.client||''} className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm bg-white"><option value="">Cliente...</option>{CLIENTES.map(c=><option key={c} value={c}>{c}</option>)}<option value="OTRO">Otro</option></select>
                <input name="manualClient" placeholder="Si es OTRO, escríbelo aquí" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm"/>
                <input name="brand" defaultValue={editingVehicle?.brand} placeholder="Marca" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm"/>
                <input name="model" defaultValue={editingVehicle?.model} placeholder="Modelo" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm"/>
                <input name="plate" defaultValue={editingVehicle?.plate} placeholder="Patente" required className="w-full border-2 p-2.5 rounded-xl font-bold uppercase text-sm"/>
                <div className="flex gap-2">{editingVehicle && <button type="button" onClick={()=>setEditingVehicle(null)} className="bg-slate-100 p-2.5 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}<button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm">Guardar Datos</button></div>
              </form>
              <div className="bg-white p-6 rounded-3xl border flex flex-col">
                <div className="flex justify-between mb-4 items-center"><h3 className="font-extrabold text-lg">Base Flota</h3><select onChange={e=>setFleetFilter(e.target.value)} className="border-2 p-1.5 rounded-xl text-xs font-bold"><option value="">Todos</option>{CLIENTES.map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="space-y-2.5 overflow-y-auto max-h-[55vh]">
                  {vehicles.filter(v=>!fleetFilter?true:v.client===fleetFilter).map(v=>(
                    <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-xl text-sm">
                      <div><p className="font-extrabold">{v.brand} {v.model}</p><p className="text-xs font-bold text-blue-600">{v.plate}</p></div>
                      <div className="flex gap-1"><button onClick={()=>setEditingVehicle(v)} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>showConfirm("¿Eliminar?",()=>deleteDoc(doc(db,'vehicles',v.id)))} className="p-1.5 text-red-600 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {configSubTab === 'drivers' && (
            <div className="grid md:grid-cols-2 gap-6">
              <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={submitDriver} className="bg-white p-6 rounded-3xl border space-y-4">
                <h3 className="font-extrabold text-lg"><User className="inline text-blue-600"/> {editingDriver?'Editar':'Nuevo'} Conductor</h3>
                <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre" required className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm"/>
                <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail" required type="email" className="w-full border-2 p-2.5 rounded-xl font-semibold text-sm"/>
                <div className="space-y-1.5 border-t pt-2"><label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Clase de Licencia</label><div className="grid grid-cols-3 gap-1.5">{LICENCIAS.map(l => <label key={l} className="flex items-center gap-1 p-1 bg-slate-50 border rounded-lg text-[11px] font-bold cursor-pointer"><input type="checkbox" name="licenses" value={l} defaultChecked={editingDriver?.licenses?.includes(l)} className="w-3.5 h-3.5" />{l}</label>)}</div></div>
                <div className="space-y-1"><label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Vencimiento Licencia</label><input name="licenseExpiry" type="date" defaultValue={editingDriver?.licenseExpiry||''} className="w-full border-2 p-2 rounded-xl text-sm font-semibold" /></div>
                <div className="flex gap-2 border-t pt-2">{editingDriver && <button type="button" onClick={()=>setEditingDriver(null)} className="bg-slate-100 p-2.5 rounded-xl font-bold text-sm w-1/3">Cancelar</button>}<button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm">Guardar Conductor</button></div>
              </form>
              <div className="bg-white p-6 rounded-3xl border max-h-[65vh] overflow-y-auto">
                <h3 className="font-extrabold text-lg mb-4">Equipo</h3>
                {drivers.map(d=>(
                  <div key={d.id} className="p-3 bg-slate-50 border rounded-2xl mb-2 flex justify-between items-center text-sm">
                    <div><p className="font-extrabold">{d.name}</p><p className="text-xs text-slate-400 font-bold">{d.email}</p></div>
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
      {currentView === 'checklist' && selectedJob && <main className="max-w-2xl mx-auto p-4 pt-6"><ChecklistForm job={selectedJob} db={db} currentUserEmail={currentUserEmail} onCancel={() => setCurrentView('main')} onComplete={() => { setSelectedJob(null); setCurrentView('main'); }} showAlert={showAlert} showConfirm={showConfirm} /></main>}

      {currentView === 'main' && (
        <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-2.5 z-40 pb-[env(safe-area-inset-bottom)] shadow-lg">
          <button onClick={handleQuickChecklist} className="flex flex-col items-center text-slate-400 hover:text-blue-600 w-20"><Zap className="w-6 h-6 mb-0.5 bg-slate-100 p-1 rounded-xl"/><span className="text-[10px] font-bold">Desde 0</span></button>
          <button onClick={() => setMainTab('jobs')} className={`flex flex-col items-center w-20 ${mainTab==='jobs' ? 'text-blue-600' : 'text-slate-400'}`}><ClipboardList className={`w-6 h-6 mb-0.5 ${mainTab==='jobs'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Trabajos</span></button>
          <button onClick={() => setMainTab('ranking')} className={`flex flex-col items-center w-20 ${mainTab==='ranking' ? 'text-yellow-600' : 'text-slate-400'}`}><Trophy className={`w-6 h-6 mb-0.5 ${mainTab==='ranking'?'bg-yellow-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Ranking</span></button>
          <button onClick={() => setMainTab('expenses')} className={`flex flex-col items-center w-20 ${mainTab==='expenses' ? 'text-blue-600' : 'text-slate-400'}`}><Wallet className={`w-6 h-6 mb-0.5 ${mainTab==='expenses'?'bg-blue-100':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Gastos</span></button>
          {isRealAdmin && <button onClick={() => setMainTab('config')} className={`flex flex-col items-center w-20 ${mainTab==='config' ? 'text-slate-800' : 'text-slate-400'}`}><Settings className={`w-6 h-6 mb-0.5 ${mainTab==='config'?'bg-slate-200':'bg-transparent'} p-1 rounded-xl`}/><span className="text-[10px] font-bold">Config.</span></button>}
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
  const [returnMethod, setReturnMethod] = useState('transfer'); 

  const activeOrPendingJobs = jobs?.filter(j => j.status === 'pending' || j.status === 'accepted') || [];

  const addExp = async (e, type, amount, detail, driverId, dName, dEmail) => {
    e.preventDefault();
    const currentBalance = drivers.find(d => d.id === driverId)?.balance || 0;
    if (type === 'expense' && amount > currentBalance) return showAlert("Saldo insuficiente.");
    
    const assocJobId = e.target.jobId?.value || '';
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
    if (returnMethod === 'transfer' && !returnReceipt) return showAlert("Sube el comprobante de transferencia.");
    
    try {
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: `Rendición de Vuelto (${returnMethod==='transfer'?'Transferencia':'Efectivo'})`, receiptImage: returnReceipt, createdAt: Date.now() });
      setIsReturnOpen(false); setReturnReceipt(null); showAlert("Rendición enviada. Esperando validación de Admin.");
    } catch(e) {}
  };

  const approveReturn = async (exp) => {
    try {
      const d = drivers.find(x => x.id === exp.driverId);
      if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: Math.max(0, (d.balance||0) - exp.amount) });
      await updateDoc(doc(db, 'expenses', exp.id), { type: 'return', detail: `Rendición Aprobada` });
      showAlert("Rendición aprobada. Saldo a $0.");
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
          <div className="bg-white p-5 rounded-3xl border max-h-[65vh] flex flex-col overflow-hidden w-full">
            <h3 className="font-bold text-slate-700 mb-4 text-sm">{selectedDriverId ? 'Movimientos del Conductor' : 'Historial de Rendiciones'}</h3>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {expenses.filter(e => selectedDriverId ? e.driverId === selectedDriverId : true).map(exp => (
                <div key={exp.id} className="bg-slate-50 p-3 rounded-2xl border flex gap-3 items-start text-xs font-bold w-full overflow-hidden">
                  <div className="mt-1"><TI t={exp.type}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 break-words">{exp.detail}</p>
                    <p className="text-[10px] text-slate-400 truncate">{!selectedDriverId && <span className="text-blue-600">{exp.driverName} • </span>}{new Date(exp.createdAt).toLocaleDateString()}</p>
                    {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver comprobante</button>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                    {exp.type === 'pending_return' && <button onClick={() => approveReturn(exp)} className="ml-1 text-xs font-bold bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors">Aprobar</button>}
                    {exp.type !== 'pending_return' && <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1"><button onClick={() => delExp(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div>}
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
  const hasPendingReturn = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  return (
    <main className="max-w-md mx-auto p-4 pt-6 space-y-6 pb-24">
      {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Rendir Vuelto</h3><button onClick={() => { setIsReturnModalOpen(false); setReturnReceipt(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
            <p className="text-sm font-bold text-slate-500 mb-4 border-b border-slate-100 pb-4">Monto total a rendir: <span className="text-blue-600 text-xl font-extrabold block mt-1">{formatMoney(myBalance)}</span></p>
            
            <div className="flex gap-2 mb-4">
               <button onClick={()=>setReturnMethod('transfer')} className={`flex-1 p-2 rounded-lg font-bold text-xs ${returnMethod==='transfer'?'bg-blue-600 text-white':'bg-slate-100 text-slate-500'}`}>Transferencia</button>
               <button onClick={()=>setReturnMethod('cash')} className={`flex-1 p-2 rounded-lg font-bold text-xs ${returnMethod==='cash'?'bg-blue-600 text-white':'bg-slate-100 text-slate-500'}`}>Efectivo</button>
            </div>

            {returnMethod === 'transfer' ? (
              <label className={`block w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors relative overflow-hidden ${returnReceipt ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={async e=>{const f=e.target.files[0];if(!f)return;const b=await window.createImageBitmap(f,{resizeWidth:800});const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);setReturnReceipt(c.toDataURL('image/jpeg',0.6));b.close();}} />
                {returnReceipt ? (
                   <div className="relative z-10"><CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2 bg-white rounded-full"/><p className="text-sm font-extrabold text-green-700 mb-2">Comprobante Cargado</p><img src={returnReceipt} className="h-28 object-contain mx-auto rounded-lg shadow-sm border border-green-200" alt="preview"/><p className="text-xs font-bold text-slate-500 mt-3 underline">Tocar para cambiar</p></div>
                ) : (
                   <div className="py-4"><Camera className="w-10 h-10 text-slate-400 mx-auto mb-3"/><p className="text-sm font-extrabold text-slate-600">Sube el comprobante</p></div>
                )}
              </label>
            ) : (
              <div className="bg-amber-50 p-4 border border-amber-200 rounded-xl text-center"><p className="text-xs font-bold text-amber-800">Recuerda entregar el dinero físicamente al administrador. El saldo se actualizará cuando él lo apruebe en el sistema.</p></div>
            )}
            <div className="flex gap-4 mt-6"><button onClick={() => { setIsReturnModalOpen(false); setReturnReceipt(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={submitReturn} className="flex-[2] py-3 rounded-xl font-extrabold transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200">Confirmar</button></div>
          </div>
        </div>
      )}

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
          <button type="submit" disabled={myBalance <= 0 || hasPendingReturn} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-all ${myBalance > 0 && !hasPendingReturn ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Guardar Gasto</button>
        </form>
      </div>
      
      {hasPendingReturn ? (
        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-3xl text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2"/>
            <p className="font-extrabold text-sm text-amber-700">Rendición en Revisión</p>
            <p className="text-xs font-bold text-amber-600 mt-1">El administrador debe aprobar la rendición para actualizar el saldo a $0.</p>
        </div>
      ) : (
        myBalance > 0 && (
          <button onClick={() => setIsReturnModalOpen(true)} className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-2 border-green-200 py-4 rounded-3xl font-extrabold text-sm flex justify-center items-center gap-2 transition-all">
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
                <p className="text-[10px] font-bold text-slate-400 truncate">{new Date(exp.createdAt).toLocaleString()}</p>
                {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver foto</button>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                {exp.type !== 'assignment' && exp.type !== 'pending_return' ? (
                  <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1"><button onClick={() => delExp(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div>
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

function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail, showAlert, showConfirm }) {
  const [menuOpenId, setMenuOpenId] = useState(null); const [jobToFail, setJobToFail] = useState(null); const [historyClientFilter, setHistoryClientFilter] = useState(''); 
  const now = new Date(); const isAdminView = role === 'admin';
  
  const filteredJobs = jobs.filter(job => {
    if (!isAdminView && (!job.assignedEmails?.includes(currentUserEmail) && job.acceptedByEmail !== currentUserEmail)) return false;
    if (!isAdminView && job.status === 'failed') return false; 
    if (!job.createdAt) return true;
    if (!isAdminView) { if ((now.getTime() - job.createdAt) > 604800000) return false; } 
    else { if (job.createdAt < new Date(now.getFullYear(), now.getMonth(), 1).getTime()) return false; }
    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const ord = isAdminView ? { pending: 1, accepted: 2, completed: 3, failed: 3 } : { accepted: 1, pending: 2, completed: 3, failed: 3 };
    if (ord[a.status] !== ord[b.status]) return ord[a.status] - ord[b.status];
    if (a.status === 'completed' || a.status === 'failed') return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
    return (a.scheduledDate ? new Date(a.scheduledDate).getTime() : a.createdAt) - (b.scheduledDate ? new Date(b.scheduledDate).getTime() : b.createdAt); 
  });

  const activeJobs = sortedJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
  const historyJobs = sortedJobs.filter(j => j.status === 'completed' || j.status === 'failed').filter(j => {
     if (!historyClientFilter) return true; if (historyClientFilter === 'OTRO') return !CLIENTES.includes(j.client); return j.client === historyClientFilter;
  });

  const handleAcceptJob = async (job) => { try { await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'accepted', acceptedByEmail: currentUserEmail }); } catch (e) { console.error(e); } };
  const handleDeleteJob = async (jobId) => { showConfirm("¿Eliminar este trabajo definitivamente?", async () => { try { await deleteDoc(doc(db, 'transport_jobs', jobId)); } catch (e) { console.error(e); } }); };
  const handleFailJob = async (job, reason) => {
    try {
      if (job.tripType === 'revision' && reason === 'RECHAZO_RT_AUTOMATICO') {
          await addDoc(collection(db, 'transport_jobs'), { scheduledDate: job.scheduledDate, client: job.client, brand: job.brand, model: job.model, vin: job.vin, plate: job.plate, origin: job.origin, destination: job.destination, tripType: job.tripType, rtData: job.rtData, assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [], status: 'pending', createdAt: Date.now(), checklist: null });
      }
      await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'failed', failedReason: reason === 'RECHAZO_RT_AUTOMATICO' ? job.checklist?.rtRejectReason || 'Revisión Rechazada' : reason, completedAt: Date.now(), acceptedByEmail: job.acceptedByEmail || currentUserEmail });
      setJobToFail(null); showAlert(reason === 'RECHAZO_RT_AUTOMATICO' ? "Revisión guardada como rechazada. Se creó un nuevo traslado." : "Trabajo marcado como fallido.");
    } catch (e) { console.error(e); }
  };

  const buildPDFDoc = async (job) => {
    if (!window.jspdf) { await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); }); }
    const { jsPDF } = window.jspdf; const docPDF = new jsPDF();
    
    docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 30, 'F'); docPDF.setTextColor(255, 255, 255);
    docPDF.setFontSize(22); docPDF.setFont("helvetica", "bold"); docPDF.text(job.tripType === 'revision' ? "CERTIFICADO DE REVISIÓN" : "CHECKLIST DE TRASLADO", 105, 20, null, null, "center"); docPDF.setTextColor(0, 0, 0);

    if (job.status === 'failed') { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(12); docPDF.text(`TRABAJO FALLIDO: ${job.failedReason || 'Sin motivo'}`, 20, 37); docPDF.setTextColor(0, 0, 0); }
    
    let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "No registrado";
    if (job.acceptedByEmail) { const foundDriver = drivers?.find(d => d.email === job.acceptedByEmail); if (foundDriver) driverNameStr = foundDriver.name; }

    docPDF.setFillColor(241, 245, 249); docPDF.rect(15, 40, 180, 50, 'F'); docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("1. DATOS DEL SERVICIO Y VEHÍCULO", 20, 48);
    docPDF.setFontSize(11); docPDF.setFont("helvetica", "normal"); docPDF.text(`Fecha Traslado:`, 20, 58); docPDF.setFont("helvetica", "bold"); docPDF.text(`${formatDateDisplay(job.scheduledDate) || '-'}`, 52, 58);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Cliente:`, 110, 58); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.client || 'Sin Cliente'}`, 125, 58);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Vehículo:`, 20, 66); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.brand || '-'} ${job.model || '-'}`, 40, 66);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Patente/VIN:`, 110, 66); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.plate || job.vin || '-'}`, 135, 66);
    
    let routeText = `${job.origin || '-'}  ->  ${job.destination || '-'}`;
    if (job.tripType === 'revision') {
      if (job.checklist?.rtStatus === 'aprobado') { const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin; routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`; } 
      else if (job.checklist?.rtStatus === 'rechazado') { routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`; } 
      else { routeText = `${job.origin || '-'}  ->  PRT`; }
    }
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Ruta:`, 20, 74); docPDF.setFont("helvetica", "bold"); docPDF.text(routeText, 35, 74);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Conductor:`, 20, 82); docPDF.setFont("helvetica", "bold"); docPDF.text(`${driverNameStr}`, 45, 82);

    docPDF.setFillColor(241, 245, 249); docPDF.rect(15, 95, 180, 45, 'F'); docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("2. ESTADO Y DOCUMENTACIÓN", 20, 103);
    docPDF.setFontSize(11); docPDF.setFont("helvetica", "normal"); docPDF.text(`Nivel de Combustible:`, 20, 113); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.fuelLevel || '0'}%`, 65, 113);
    const docs = job.checklist?.docs || {}; docPDF.setFont("helvetica", "normal"); docPDF.text(`SOAP:`, 20, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.soap ? 'SÍ' : 'NO', 35, 122); docPDF.setFont("helvetica", "normal"); docPDF.text(`Permiso de Circ.:`, 60, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.permiso ? 'SÍ' : 'NO', 93, 122); docPDF.setFont("helvetica", "normal"); docPDF.text(`Rev. Técnica:`, 120, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.revTecnica ? 'SÍ' : 'NO', 148, 122); docPDF.setFont("helvetica", "normal"); docPDF.text(`Gases:`, 165, 122); docPDF.setFont("helvetica", "bold"); docPDF.text(docs.gases ? 'SÍ' : 'NO', 180, 122);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Observaciones:`, 20, 131); const obsSplit = docPDF.splitTextToSize(`${job.checklist?.observations || 'Ninguna'}`, 140); docPDF.text(obsSplit, 50, 131);

    const startY = 131 + (obsSplit.length * 5) + 10;
    docPDF.setFillColor(241, 245, 249); docPDF.rect(15, startY, 180, 80, 'F');
    if (job.tripType === 'revision') {
       docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("3. RESULTADO REVISIÓN", 20, startY + 8); docPDF.setFontSize(12);
       if (job.checklist?.rtStatus === 'aprobado') { docPDF.setTextColor(22, 163, 74); docPDF.text("APROBADO", 20, startY + 20); docPDF.setTextColor(0, 0, 0); } 
       else { docPDF.setTextColor(220, 38, 38); docPDF.text("RECHAZADO", 20, startY + 20); docPDF.setTextColor(0, 0, 0); docPDF.setFontSize(11); docPDF.setFont("helvetica", "normal"); docPDF.text(`Razón: ${job.checklist?.rtRejectReason || 'No especificada'}`, 20, startY + 30); }
    } else {
      docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("3. RECEPCIÓN", 20, startY + 8);
      if (job.checklist?.noReception) { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(12); docPDF.text("ENTREGA SIN RECEPCIÓN (Confirmada por conductor)", 20, startY + 20); docPDF.setTextColor(0, 0, 0); } 
      else { docPDF.setFontSize(11); docPDF.setFont("helvetica", "normal"); docPDF.text(`Receptor:`, 20, startY + 18); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverName || 'N/A'}`, 42, startY + 18); docPDF.setFont("helvetica", "normal"); docPDF.text(`RUT:`, 110, startY + 18); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverRut || 'N/A'}`, 122, startY + 18); if(job.checklist?.signatureData) { docPDF.setFont("helvetica", "normal"); docPDF.text(`Firma conformada:`, 20, startY + 45); docPDF.addImage(job.checklist.signatureData, 'PNG', 55, startY + 30, 70, 45); } }
      if (job.checklist?.location) { const { lat, lng } = job.checklist.location; docPDF.setFont("helvetica", "normal"); docPDF.text(`Ubicación GPS:`, 20, startY + 28); docPDF.setTextColor(37, 99, 235); docPDF.textWithLink('Ver en Google Maps', 52, startY + 28, { url: `https://www.google.com/maps?q=${lat},${lng}` }); docPDF.setTextColor(0, 0, 0); } 
      else { docPDF.setFont("helvetica", "normal"); docPDF.text(`Ubicación GPS: No registrada`, 20, startY + 28); }
    }

    if (job.checklist?.photos) {
      const photos = job.checklist.photos; const labels = { front: 'Frente', left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atrás', tire: 'Repuesto', dashboard: 'Tablero', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4' };
      let currentY = 30; let currentCol = 1; let addedPage = false;
      const getImageDims = (src) => new Promise(resolve => { const img = new Image(); img.onload = () => resolve({ w: img.width, h: img.height }); img.src = src; });
      for (const key in photos) {
        if (photos[key]) {
          if (!addedPage) { docPDF.addPage(); docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 20, 'F'); docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(16); docPDF.setFont("helvetica", "bold"); docPDF.text(`REGISTRO FOTOGRÁFICO ADJUNTO`, 105, 14, null, null, "center"); docPDF.setTextColor(0, 0, 0); addedPage = true; }
          const dims = await getImageDims(photos[key]); const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 100) { imgH = 100; imgW = imgH / ratio; }
          const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2);
          if (currentY + imgH > 280) { docPDF.addPage(); currentY = 30; docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 20, 'F'); docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(16); docPDF.setFont("helvetica", "bold"); docPDF.text(`REGISTRO FOTOGRÁFICO (CONT.)`, 105, 14, null, null, "center"); docPDF.setTextColor(0, 0, 0); }
          docPDF.setFontSize(11); docPDF.setFont("helvetica", "bold"); docPDF.text(labels[key] || key, slotCenter, currentY - 3, { align: "center" }); docPDF.setDrawColor(200, 200, 200); docPDF.rect(finalX - 1, currentY - 1, imgW + 2, imgH + 2); docPDF.addImage(photos[key], 'JPEG', finalX, currentY, imgW, imgH);
          if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; currentY += (imgH > 80 ? imgH : 80) + 15; }
        }
      }
    }
    return docPDF;
  };

  const cpyWapp = j => { 
    const dStr = j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0]);
    navigator.clipboard.writeText(`${dStr.substring(0, 5)}\n${j.client || 'Sin Cliente'}\n${j.brand || '-'} ${j.model || '-'}\n${j.plate || j.vin || '-'}\n${getRouteStr(j)}`).then(() => { showAlert("✅ Copiado al portapapeles."); setMenuOpenId(null); }); 
  };

  return (
    <div className="pb-16">
      {activeJobs.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {activeJobs.map(j => (
            <div key={j.id} className="bg-white rounded-3xl border p-5 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-3 border-b pb-3">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${j.status==='pending'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>{j.status==='pending'?'Pendiente':'En Curso'}</span>
                <div className="flex gap-1.5 items-center">
                  {isAdminView && <button onClick={()=>onEditJob(j)} className="p-1 text-blue-600"><Edit2 className="w-4 h-4"/></button>}
                  <div className="relative">
                    <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-1 text-slate-400"><MoreVertical className="w-4 h-4"/></button>
                    {menuOpenId===j.id && (
                      <div className="absolute right-0 top-8 bg-white border shadow-2xl rounded-xl w-44 z-50 overflow-hidden text-xs">
                        <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-slate-50"><Copy className="w-4 h-4"/> Copiar Texto</button>
                        <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t"><XCircle className="w-4 h-4"/> Cancelar / Falló</button>
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
                <p className="flex items-start gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/> <span className="flex-1">{j.origin}</span></p>
                <p className="flex items-start gap-1"><Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/> <span className="flex-1">{getRouteStr(j)}</span></p>
                <p className="text-slate-400 mt-2">Patente/VIN: <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded ml-1 uppercase">{j.plate || j.vin || 'N/A'}</span></p>
              </div>
              <div className="mt-auto pt-3 border-t flex flex-col">
                {j.status === 'pending' && (!isAdminView || j.assignedEmails?.includes(currentUserEmail)) && <button onClick={()=>handleAcceptJob(j)} className="bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md">Reclamar Traslado</button>}
                {((j.status === 'accepted' && (isAdminView || j.acceptedByEmail === currentUserEmail)) || (j.status !== 'completed' && j.status !== 'failed' && isAdminView)) && <button onClick={()=>onStartChecklist(j)} className="bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md">Iniciar Checklist</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {historyJobs.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-3 border-b-2 pb-1">
             <h3 className="font-extrabold text-lg text-slate-700">Historial</h3>
             {isAdminView && (
                <select onChange={e=>setHistoryClientFilter(e.target.value)} className="border-2 border-slate-200 p-1.5 rounded-lg text-xs font-bold outline-none text-slate-600">
                  <option value="">Todos los Clientes</option>{CLIENTES.map(c=><option key={c} value={c}>{c}</option>)}<option value="OTRO">Otros</option>
                </select>
             )}
          </div>
          <div className="flex flex-col gap-2.5">
            {historyJobs.map(j => (
              <div key={j.id} className="bg-white p-3.5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs font-bold shadow-sm relative pl-4 overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${j.status==='failed'?'bg-red-500':'bg-green-500'}`}></div>
                <div>
                   <div className="flex gap-2 items-center mb-1"><span className={`px-2 py-0.5 rounded text-[9px] uppercase ${j.status==='failed'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{j.status==='failed'?'Fallido':'Ok'}</span><p className="text-sm font-black text-slate-800">{j.brand} {j.model} <span className="text-blue-600 uppercase text-xs ml-1">[{j.plate||'S/N'}]</span></p></div>
                   <p className="text-slate-500 font-semibold">{getRouteStr(j)} <span className="text-slate-400 ml-1">({j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0])})</span></p>
                   {j.status==='failed' && <p className="text-red-600 text-[11px] mt-0.5 font-bold">Razón: {j.failedReason}</p>}
                </div>
                <div className="flex gap-1.5 mt-2 sm:mt-0">
                  <button onClick={()=>cpyWapp(j)} className="p-2 bg-blue-50 text-blue-600 rounded-xl" title="Copiar Texto"><Copy className="w-4 h-4"/></button>
                  <button onClick={async ()=>{ try { const docPDF = await buildPDFDoc(j); docPDF.save(`Check.${j.plate || 'SN'}.pdf`); } catch(e){showAlert("Error generando PDF");} }} className="p-2 bg-slate-100 text-slate-700 rounded-xl" title="Descargar PDF"><FileDown className="w-4 h-4"/></button>
                  {isAdminView && <button onClick={()=>handleDeleteJob(j.id)} className="p-2 bg-red-50 text-red-600 rounded-xl" title="Eliminar Historial"><Trash2 className="w-4 h-4"/></button>}
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
            <textarea name="reason" required placeholder="Escribe el motivo del fallo..." className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none focus:border-red-500" rows="3"></textarea>
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
    return { client: job.client||'', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false, tire:false, dashboard:false, det1:false, det2:false, det3:false, det4:false }, docs: { soap:false, permiso:false, revTecnica:false, gases:false }, observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null, rtStatus: 'aprobado', rtRejectReason: '', rtReturnOption: 'origin', rtReturnDestination: '' };
  });

  useEffect(() => { localStorage.setItem(DK, JSON.stringify(formData)); localStorage.setItem(`${DK}_s`, step); }, [formData, step, DK]);
  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  const handlePic = async (e, id) => {
    const f=e.target.files[0]; if(!f)return;
    try { const b = await window.createImageBitmap(f,{resizeWidth:800}); const c=document.createElement('canvas'); c.width=b.width; c.height=b.height; c.getContext('2d').drawImage(b,0,0); setF('photos', {...formData.photos, [id]:c.toDataURL('image/jpeg',0.6)}); b.close(); } 
    catch(err){ showAlert("Error al optimizar foto."); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (job.tripType !== 'revision' && !formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    let d = {...formData}; 
    if (job.tripType === 'revision') { d.receiverName = "PLANTA RT"; d.receiverRut = "N/A"; } else if(d.noReception) { d.receiverName="ENTREGA SIN RECEPCIÓN"; d.receiverRut="N/A"; }
    const fd = { scheduledDate: new Date().toISOString().split('T')[0], client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType || 'traslado', expectedTollCost: job.expectedTollCost || 0 };
    try {
      if(isQuick) { 
          fd.assignedDriverName="Auto-creado"; fd.acceptedByEmail=currentUserEmail; 
          if (d.plateOrVin) { const vehRef = collection(db, 'vehicles'); onSnapshot(vehRef, async (snap) => { if (!snap.docs.find(doc => doc.data().plate === d.plateOrVin.toUpperCase())) { await addDoc(vehRef, { plate: d.plateOrVin.toUpperCase(), brand: d.brand, model: d.model, client: d.client, createdAt: Date.now() }); } }); }
          await addDoc(collection(db,'transport_jobs'), fd); 
      }
      else { 
          if (job.tripType === 'revision' && d.rtStatus === 'rechazado') {
             fd.status = 'failed'; fd.failedReason = d.rtRejectReason || 'Revisión Técnica Rechazada';
             await addDoc(collection(db, 'transport_jobs'), { scheduledDate: d.scheduledDate, client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, tripType: job.tripType, rtData: job.rtData, assignedDrivers: job.assignedDrivers || [], assignedEmails: job.assignedEmails || [], status: 'pending', createdAt: Date.now(), checklist: null });
          }
          await updateDoc(doc(db,'transport_jobs',job.id), fd); 
      }
      localStorage.removeItem(DK); localStorage.removeItem(`${DK}_s`); 
      if (job.tripType === 'revision' && d.rtStatus === 'rechazado') showAlert("Revisión guardada como RECHAZADA. Se ha creado un nuevo traslado pendiente."); else showAlert("✅ Checklist guardado correctamente."); 
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
                <select value={formData.rtStatus} onChange={e=>setF('rtStatus', e.target.value)} className={`w-full border-2 p-4 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}><option value="aprobado">✅ APROBADO</option><option value="rechazado">❌ RECHAZADO</option></select>
                {formData.rtStatus === 'rechazado' && <input value={formData.rtRejectReason} onChange={e=>setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required className="w-full border-2 border-red-300 p-4 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2" />}
                {formData.rtStatus === 'aprobado' && (
                  <div className="mt-4 p-4 border-2 border-green-200 bg-green-50 rounded-xl space-y-3">
                    <p className="text-sm font-bold text-green-800">¿Hacia dónde se dirige tras aprobar?</p>
                    <div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700"><input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/> Volver al Origen</label><label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700"><input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/> Otro Destino</label></div>
                    {formData.rtReturnOption === 'other' && <input value={formData.rtReturnDestination} onChange={e=>setF('rtReturnDestination', e.target.value)} placeholder="Especifique destino final..." required className="w-full border-2 border-green-300 p-3 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />}
                  </div>
                )}
              </>
            )}

            <div className="space-y-1 pt-2"><label className="text-xs font-extrabold text-slate-400 uppercase">Combustible: {formData.fuelLevel}%</label><input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={e=>setF('fuelLevel',e.target.value)} className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"/></div>
            
            <h3 className="text-sm font-extrabold border-b-2 border-slate-100 pb-2 mt-6 text-slate-800">Documentos a bordo</h3>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'soap', label: 'SOAP' }, { id: 'permiso', label: 'Permiso' }, { id: 'revTecnica', label: 'Rev. Técnica' }, { id: 'gases', label: 'Gases' }].map(doc => (
                <label key={doc.id} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.docs[doc.id] ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600'}`}><input type="checkbox" className="w-4 h-4 text-green-600 rounded cursor-pointer" checked={formData.docs[doc.id]} onChange={(e) => setF('docs', { ...formData.docs, [doc.id]: e.target.checked })} /><span className="font-extrabold text-xs">{doc.label}</span></label>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-4">
              {[{id:'front', l:'Frente'}, {id:'left', l:'Lat. Piloto'}, {id:'right', l:'Lat. Copiloto'}, {id:'back', l:'Atrás'}, {id:'tire', l:'Repuesto'}, {id:'dashboard', l:'Tablero'}, {id:'det1', l:'Detalle 1'}, {id:'det2', l:'Detalle 2'}, {id:'det3', l:'Detalle 3'}, {id:'det4', l:'Detalle 4'}].map(p => (
                <label key={p.id} className={`p-1 border-2 rounded-2xl text-center cursor-pointer relative overflow-hidden h-20 flex flex-col justify-center items-center ${formData.photos[p.id]?'bg-green-50 border-green-400':'border-dashed'}`}><input type="file" className="hidden" accept="image/*" onChange={e=>handlePic(e,p.id)}/><Camera className="w-5 h-5 text-slate-400 mb-0.5"/> <span className="text-[10px] font-bold text-slate-500 uppercase">{p.l}</span></label>
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
               <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl text-center mb-6"><CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-2"/><h3 className="text-lg font-extrabold text-blue-800">Cierre de Revisión Técnica</h3><p className="text-sm font-bold text-blue-600">Al finalizar, no se requiere firma del receptor.</p></div>
            )}
            
            <button type="button" onClick={() => { if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => setF('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }), () => showAlert("Error GPS.")); } }} className={`px-4 py-4 rounded-2xl text-sm w-full font-extrabold shadow-sm ${formData.location ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-slate-100 text-slate-700 border-2'}`}>
              {formData.location ? "📍 GPS Capturado Exitosamente" : "📍 Tocar para Capturar GPS Actual"}
            </button>

            <div className="flex gap-2 pt-4 border-t"><button type="button" onClick={()=>setStep(1)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm flex-1">Atrás</button><button type="submit" className="bg-green-600 text-white p-3 rounded-xl font-bold text-sm flex-[2]">Guardar Todo</button></div>
          </form>
        )}
      </div>
    </div>
  );
}