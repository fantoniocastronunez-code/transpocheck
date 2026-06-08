import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, Edit2, Bell, Share2, X, Calendar, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Save
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

// Lista por defecto de clientes
const DEFAULT_CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];
const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

// --- UTILIDADES ---
const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;
const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

// --- COMPONENTE DE FIRMA ---
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

// --- FUNCIÓN REDIMENSIONAR IMAGEN ---
const resizeImage = (file, maxWidth, quality) => {
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


export default function App() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customClients, setCustomClients] = useState([]);
  
  const [adminTab, setAdminTab] = useState('dashboard');
  const [configSubTab, setConfigSubTab] = useState('clients');
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
    const unsubClients = onSnapshot(collection(db, 'clients'), snap => setCustomClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubDrivers(); unsubExpenses(); unsubVehicles(); unsubClients(); };
  }, [user, activeRole, currentUserEmail, isRealAdmin]);

  const allClientsList = Array.from(new Set([...DEFAULT_CLIENTES, ...customClients.map(c => c.name)])).sort();

  const globalStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
      body { font-family: 'Nunito', sans-serif; background-color: #f8fafc; }
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

  // --- FORMULARIO NUEVO TRABAJO / EDICIÓN ---
  const NewJobForm = ({ jobToEdit, onCancelEdit }) => {
    const [selectedClient, setSelectedClient] = useState(jobToEdit?.client && allClientsList.includes(jobToEdit.client) ? jobToEdit.client : (jobToEdit?.client ? 'OTRO' : ''));
    const [manualClient, setManualClient] = useState(jobToEdit?.client && !allClientsList.includes(jobToEdit.client) ? jobToEdit.client : '');
    const [brand, setBrand] = useState(jobToEdit?.brand || '');
    const [model, setModel] = useState(jobToEdit?.model || '');
    const [plate, setPlate] = useState(jobToEdit?.plate || jobToEdit?.vin || '');
    const [tripType, setTripType] = useState(jobToEdit?.tripType || 'traslado');
    
    // Revisiones Técnicas
    const [revType, setRevType] = useState(jobToEdit?.rtData?.type || 'A');
    const [revA_gases, setRevA_gases] = useState(jobToEdit?.rtData?.gases || false);
    const [revA_revision, setRevA_revision] = useState(jobToEdit?.rtData?.revision || false);
    const [revA_inspeccion, setRevA_inspeccion] = useState(jobToEdit?.rtData?.inspeccion || false);
    const [revA_frenos, setRevA_frenos] = useState(jobToEdit?.rtData?.frenos || false);
    const [revB_tipo, setRevB_tipo] = useState(jobToEdit?.rtData?.tipoB || 'completa');
    
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
        tripType, rtData,
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
        setAdminTab('dashboard'); 
      } catch (error) { console.error(error); }
    };

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-2xl font-extrabold text-slate-800">{jobToEdit ? 'Editar Trabajo' : 'Crear Nuevo Trabajo'}</h2>
          {jobToEdit && <button type="button" onClick={onCancelEdit} className="text-slate-500 hover:bg-slate-100 p-2 rounded-xl transition"><X className="w-6 h-6"/></button>}
        </div>
        <form onSubmit={handleCreateOrUpdateJob} className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
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

          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">2. Vehículo <span className="text-xs text-blue-500 font-bold">(Escribe la patente para autocompletar)</span></h3>
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
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">4. Conductores <span className="text-xs text-red-500 font-normal">(Obligatorio seleccionar al menos 1)</span></h3>
             <div className="max-h-48 overflow-y-auto border-2 border-slate-200 bg-white rounded-xl">
                {drivers.length === 0 ? <p className="text-sm text-slate-400 p-4 font-semibold">No hay conductores.</p> : drivers.map(d => (
                  <label key={d.id} className="flex items-center p-4 border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                    <input type="checkbox" name="assignedDriverId" value={d.id} defaultChecked={jobToEdit?.assignedEmails?.includes(d.email)} className="w-5 h-5 cursor-pointer rounded text-blue-600 focus:ring-blue-500" />
                    <div className="ml-4"><span className="block text-base font-bold text-slate-800">{d.name}</span><span className="block text-sm font-semibold text-slate-400">{d.email}</span></div>
                  </label>
                ))}
             </div>
          </div>
          <div className="flex gap-3 pt-2">
            {jobToEdit && <button type="button" onClick={onCancelEdit} className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 px-8 py-3 rounded-2xl font-extrabold text-lg transition-colors">Cancelar</button>}
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">{jobToEdit ? 'Actualizar Trabajo' : 'Guardar y Asignar'}</button>
          </div>
        </form>
      </div>
    );
  };

  // --- CONFIGURACIÓN GENERAL UNIFICADA ---
  const ConfigView = () => {
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

        {/* --- SUBTAB: CLIENTES --- */}
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

        {/* --- SUBTAB: VEHICULOS --- */}
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

        {/* --- SUBTAB: CONDUCTORES --- */}
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
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-32">
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
              <span className="hidden md:inline">{activeRole === 'admin' ? 'Admin' : 'Conductor'}</span>
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
              
              {adminTab === 'newJob' && <NewJobForm jobToEdit={editingJob} onCancelEdit={() => {setEditingJob(null); setAdminTab('dashboard');}} />}
              {adminTab === 'config' && <ConfigView />}
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
        <main className="max-w-2xl mx-auto p-4 pt-6 pb-24">
          <ChecklistForm 
             job={selectedJob} db={db} currentUserEmail={currentUserEmail} 
             allClientsList={allClientsList}
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

  const safeDateRender = (timestamp) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return 'Fecha inválida';
      return d.toLocaleDateString();
    } catch(e) { return 'Fecha inválida'; }
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

  // --- VISTA DRIVERS GASTOS ---
  if (!myDriver) return (
    <main className="p-8 text-center text-slate-500 font-bold pb-24">
       <div className="bg-white p-6 rounded-3xl border max-w-sm mx-auto shadow-sm">
          <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4"/>
          <p>No estás registrado como conductor con el correo <b>{currentUserEmail}</b>.</p>
          <p className="text-sm mt-2 text-slate-400">Pide al administrador que te agregue usando exactamente este correo.</p>
       </div>
    </main>
  );

  const myBalance = myDriver.balance || 0;
  const hasPendingReturn = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  return (
    <main className="max-w-md mx-auto p-4 pt-6 space-y-6 pb-24">
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

  const buildPDFDoc = async (job) => {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
    }
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF();
    
    docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 30, 'F'); docPDF.setTextColor(255, 255, 255);
    
    // CAMBIO DE TÍTULO DEPENDIENDO DEL TIPO
    let pdfTitle = "CHECKLIST DE TRASLADO";
    if (job.tripType === 'revision') pdfTitle = "CERTIFICADO DE REVISIÓN";
    if (job.tripType === 'viaje') pdfTitle = "TRASLADO A REGIONES";
    
    docPDF.setFontSize(22); docPDF.setFont("helvetica", "bold"); docPDF.text(pdfTitle, 105, 20, null, null, "center");
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

    if (job.tripType !== 'revision' && job.checklist?.photos) {
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

  const getDStr = j => j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0]);
  
  const handleCopyWhatsApp = (job) => { 
    const dateStr = getDStr(job);
    const dateShort = dateStr.substring(0, 5); 
    const text = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}`; 
    navigator.clipboard.writeText(text).then(() => { 
      showAlert("✅ Formato copiado al portapapeles. Listo para pegar en WhatsApp."); 
      setMenuOpenId(null); 
    }).catch(() => showAlert("Tu navegador bloqueó el copiado automático.")); 
  };
  const cpyWapp = handleCopyWhatsApp; 

  const generatePDF = async (job) => {
    try { 
      const docPDF = await buildPDFDoc(job); 
      const fileName = `Check.${getDStr(job).replace(/\//g, '-')}.${job.client || 'SinCliente'}.${job.plate || job.vin || 'SN'}.pdf`; 
      docPDF.save(fileName); 
    } catch(e) { console.error(e); showAlert("Hubo un error al generar PDF."); }
  };

  const handleShareWhatsAppPDF = async (job) => {
    try {
      const dateStrForFile = getDStr(job).replace(/\//g, '-');
      const dateShort = getDStr(job).substring(0, 5);
      const fileName = `Check.${dateStrForFile}.${job.client || 'SinCliente'}.${job.plate || job.vin || 'SN'}.pdf`;
      const text = `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${getRouteStr(job)}`;
      
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
                    <div className="absolute right-0 top-8 bg-white border shadow-2xl rounded-xl w-44 z-50 overflow-hidden text-xs">
                      <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-slate-50"><Copy className="w-4 h-4"/> Copiar Texto</button>
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
          <h3 className="font-extrabold text-lg text-slate-700 mb-3 border-b-2 pb-1">Historial Simplificado</h3>
          <div className="flex flex-col gap-2.5">
            {historyJobs.map(j => (
              <div key={j.id} className="bg-white p-3.5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs font-bold shadow-sm relative pl-4 overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${j.status==='failed'?'bg-red-500':'bg-green-500'}`}></div>
                <div>
                   <div className="flex gap-2 items-center mb-1"><span className={`px-2 py-0.5 rounded text-[9px] uppercase ${j.status==='failed'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{j.status==='failed'?'Fallido':'Ok'}</span><p className="text-sm font-black text-slate-800">{j.brand} {j.model} <span className="text-blue-600 uppercase text-xs ml-1">[{j.plate||'S/N'}]</span></p></div>
                   <p className="text-slate-500 font-semibold">{getRouteStr(j)} <span className="text-slate-400 ml-1">({getDStr(j)})</span></p>
                   {j.status==='failed' && <p className="text-red-600 text-[11px] mt-0.5 font-bold">Razón: {j.failedReason}</p>}
                </div>
                <div className="flex gap-1.5 mt-2 sm:mt-0">
                  <button onClick={()=>cpyWapp(j)} className="p-2 bg-blue-50 text-blue-600 rounded-xl" title="Copiar Texto"><Copy className="w-4 h-4"/></button>
                  <button onClick={() => generatePDF(j)} className="p-2 bg-slate-100 text-slate-700 rounded-xl" title="Descargar PDF"><FileDown className="w-4 h-4"/></button>
                  {j.status !== 'failed' && <button onClick={() => handleShareWhatsAppPDF(j)} className="p-2 bg-green-100 text-green-700 rounded-xl" title="Compartir PDF"><Share2 className="w-4 h-4"/></button>}
                  {isAdminView && <button onClick={()=>handleDeleteJob(j.id)} className="p-2 bg-red-50 text-red-500 rounded-xl" title="Eliminar Historial"><Trash2 className="w-4 h-4"/></button>}
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

function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm, allClientsList }) {
  const isQuick = job.id === 'NEW_QUICK_JOB'; 
  const localStorageKey = `checklist_draft_${job.id}`;

  const defaultData = {
    client: job.client||'', manualClient: '', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false, tire:false, dashboard:false, det1:false, det2:false, det3:false, det4:false }, docs: { soap:false, permiso:false, revTecnica:false, gases:false }, observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null,
    rtStatus: 'aprobado', rtRejectReason: '', rtReturnOption: 'origin', rtReturnDestination: '' 
  };

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(defaultData);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // Cargar borrador de localStorage
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

  // Guardar en localStorage cada vez que hay un cambio
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
      const dataUrl = await resizeImage(f, 800, 0.6);
      setF('photos', {...formData.photos, [id]: dataUrl}); 
    } catch(err){ 
      console.error("Error al procesar la foto:", err);
      showAlert("Error al procesar la foto. Intenta con una imagen más pequeña."); 
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (job.tripType !== 'revision' && !formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    
    let d = {...formData}; 
    d.client = d.client === 'OTRO' ? d.manualClient : d.client; 

    if (job.tripType === 'revision') {
      d.receiverName = "PLANTA RT";
      d.receiverRut = "N/A";
    } else if(d.noReception) { 
      d.receiverName="ENTREGA SIN RECEPCIÓN"; 
      d.receiverRut="N/A"; 
    }
    
    const fd = { scheduledDate: new Date().toISOString().split('T')[0], client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType || 'traslado' };
    
    try {
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
                scheduledDate: d.scheduledDate, client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination,
                tripType: job.tripType, rtData: job.rtData,
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
      showAlert("Hubo un error al guardar. Verifica tu conexión a internet o el tamaño de las fotos."); 
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
            
            <div className="grid grid-cols-2 gap-4"><input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="border-2 p-3 rounded-xl font-bold text-slate-700"/><input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="border-2 p-3 rounded-xl font-bold text-slate-700"/></div>
            <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente o VIN" className="w-full border-2 p-3 rounded-xl font-bold uppercase text-slate-700"/>
            
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
            
            <h3 className="text-sm font-extrabold border-b-2 border-slate-100 pb-2 mt-6 text-slate-800">Documentos a bordo</h3>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'soap', label: 'SOAP' }, { id: 'permiso', label: 'Permiso' }, { id: 'revTecnica', label: 'Rev. Técnica' }, { id: 'gases', label: 'Gases' }].map(doc => (
                <label key={doc.id} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.docs[doc.id] ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <input type="checkbox" className="w-4 h-4 text-green-600 rounded cursor-pointer" checked={formData.docs[doc.id]} onChange={(e) => setF('docs', { ...formData.docs, [doc.id]: e.target.checked })} />
                  <span className="font-extrabold text-xs">{doc.label}</span>
                </label>
              ))}
            </div>

            {/* SECCIÓN DE FOTOS (Oculta si es Revisión Técnica) */}
            {job.tripType !== 'revision' && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-4">
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
            )}
            
            <button type="button" onClick={()=>setStep(2)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-6 text-sm">Siguiente Paso</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {job.tripType !== 'revision' ? (
               <>
                 <label className="flex items-center gap-2.5 p-4 bg-amber-50 rounded-2xl border-amber-300 border-2 cursor-pointer"><input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-5 h-5 cursor-pointer"/> <span className="font-extrabold text-sm text-slate-700">Dejar sin firma (Local cerrado)</span></label>
                 {!formData.noReception && (
                   <><input required={!formData.noReception} value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre del receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/><input required={!formData.noReception} value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT Receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/><SignaturePad initialData={formData.signatureData} onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/></>
                 )}
               </>
            ) : (
               <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl text-center mb-6">
                 <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-2"/>
                 <h3 className="text-lg font-extrabold text-blue-800">Cierre de Revisión Técnica</h3>
                 <p className="text-sm font-bold text-blue-600">Al finalizar, no se requiere firma del receptor.</p>
               </div>
            )}
            
            <button type="button" onClick={() => { if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => setF('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }), () => showAlert("Error GPS.")); } }} className={`px-4 py-4 rounded-2xl text-sm w-full font-extrabold shadow-sm ${formData.location ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-slate-100 text-slate-700 border-2'}`}>
              {formData.location ? "📍 GPS Capturado Exitosamente" : "📍 Tocar para Capturar GPS Actual"}
            </button>

            <div className="flex gap-2 pt-4 border-t"><button type="button" onClick={()=>setStep(1)} className="bg-slate-100 p-3 rounded-xl font-bold text-sm flex-1">Atrás</button><button type="submit" className="bg-green-600 text-white p-3 rounded-xl font-bold text-sm flex-[2]">Finalizar y Guardar</button></div>
          </form>
        )}
      </div>
    </div>
  );
}