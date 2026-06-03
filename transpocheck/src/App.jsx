import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, Edit2, Bell, Share2, X, Calendar, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye
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

const CLIENTES = ["Grandleasing", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];

// ==========================================
// 2. COMPONENTE: FIRMA DIGITAL
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

// --- HELPER FORMATO MONEDA Y FECHA ---
const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;
const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
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
  
  const isFirstLoad = useRef(true);

  const requestNotificationPermission = () => {
    if (!("Notification" in window)) { alert("Tu navegador no soporta notificaciones."); return; }
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
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, { body: body, icon: '/logo.png', vibrate: [200, 100, 200] });
        }).catch(() => new Notification(title, { body }));
      } else {
        new Notification(title, { body });
      }
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
  const adminEmails = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'];
  const isRealAdmin = adminEmails.includes(currentUserEmail);

  useEffect(() => {
    if (isRealAdmin) setActiveRole('admin');
    else setActiveRole('driver');
  }, [isRealAdmin]);

  useEffect(() => {
    if (!user) return;
    
    const unsubJobs = onSnapshot(collection(db, 'transport_jobs'), (snapshot) => {
      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const jobData = change.doc.data();
          if (change.type === 'added' && jobData.status === 'pending' && jobData.assignedEmails?.includes(currentUserEmail)) {
            triggerNotification('📍 ¡Nuevo Traslado!', `Vehículo: ${jobData.brand || 'Vehículo'} para el ${formatDateDisplay(jobData.scheduledDate) || 'Hoy'}`);
          }
          if (change.type === 'modified' && jobData.status === 'accepted' && isRealAdmin && activeRole === 'admin') {
            triggerNotification('✅ Trabajo Aceptado', `Conductor: ${jobData.acceptedByEmail} aceptó el traslado.`);
          }
        });
      }
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      jobsData.sort((a, b) => b.createdAt - a.createdAt);
      setJobs(jobsData);
      isFirstLoad.current = false;
    });

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const expData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      expData.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(expData);
    });

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubJobs(); unsubDrivers(); unsubExpenses(); unsubVehicles(); };
  }, [user, activeRole]);

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
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 transform rotate-3 hover:rotate-0 transition-transform">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">LogisticAPP</h1>
          <p className="text-slate-500 mb-10 text-lg">Gestión de traslados inteligente</p>
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e))} className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 px-4 rounded-2xl shadow-sm hover:bg-slate-50 flex items-center justify-center gap-3 transition-all text-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" /> Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'drivers'), { name: e.target.driverName.value, email: e.target.driverEmail.value.toLowerCase(), balance: 0, createdAt: Date.now() });
      e.target.reset(); alert("Conductor creado exitosamente.");
    } catch (error) { console.error(error); }
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'drivers', editingDriver.id), { name: e.target.driverName.value, email: e.target.driverEmail.value.toLowerCase() });
      setEditingDriver(null); alert("Conductor actualizado exitosamente.");
    } catch (error) { console.error(error); }
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const client = formData.get('client') === 'OTRO' ? formData.get('manualClient') : formData.get('client');
    try {
      await addDoc(collection(db, 'vehicles'), { 
        client: client, brand: formData.get('brand'), model: formData.get('model'), plate: formData.get('plate').toUpperCase(), createdAt: Date.now() 
      });
      e.target.reset(); alert("Vehículo guardado exitosamente.");
    } catch (error) { console.error(error); }
  };

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const client = formData.get('client') === 'OTRO' ? formData.get('manualClient') : formData.get('client');
    try {
      await updateDoc(doc(db, 'vehicles', editingVehicle.id), { 
        client: client, brand: formData.get('brand'), model: formData.get('model'), plate: formData.get('plate').toUpperCase() 
      });
      setEditingVehicle(null); alert("Vehículo actualizado exitosamente.");
    } catch (error) { console.error(error); }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if(window.confirm("¿Eliminar este vehículo de la base de datos?")) {
      try { await deleteDoc(doc(db, 'vehicles', vehicleId)); } catch (e) { console.error(e); }
    }
  };

  const handleQuickChecklist = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedJob({ id: 'NEW_QUICK_JOB', client: '', brand: '', model: '', plate: '', vin: '', origin: '', destination: '', scheduledDate: today });
    setCurrentView('checklist');
  };

  const exportToExcel = () => {
    const headers = ['ID', 'Fecha Prog.', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Desde', 'Hasta', 'Conductores Asignados', 'Conductor Realizó', 'Estado', 'Fecha Creación'];
    const rows = jobs.map(j => {
      let realizedBy = '';
      if (j.status === 'completed' || j.status === 'accepted' || j.status === 'failed') {
        if (j.acceptedByEmail) {
          const d = drivers.find(drv => drv.email === j.acceptedByEmail);
          realizedBy = d ? d.name : j.acceptedByEmail;
        } else if (j.assignedDriverName) { realizedBy = j.assignedDriverName; }
      }
      
      let statusText = j.status;
      if (j.status === 'pending') statusText = 'Pendiente';
      if (j.status === 'accepted') statusText = 'En Curso';
      if (j.status === 'completed') statusText = 'Completado';
      if (j.status === 'failed') statusText = `Fallido - ${j.failedReason || ''}`;

      return [
        j.id, `"${formatDateDisplay(j.scheduledDate) || ''}"`, `"${j.client || ''}"`, `"${j.brand || ''}"`, `"${j.model || ''}"`, `"${j.plate || j.vin || ''}"`, 
        `"${j.origin || ''}"`, `"${j.destination || ''}"`, `"${j.assignedDrivers?.map(d=>d.name).join(' - ') || ''}"`,
        `"${realizedBy}"`, `"${statusText}"`, `"${new Date(j.createdAt).toLocaleString()}"`
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", "Reporte_Trabajos.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const NewJobForm = () => {
    const [selectedClient, setSelectedClient] = useState('');
    const [manualClient, setManualClient] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [plate, setPlate] = useState('');
    const todayStr = new Date().toISOString().split('T')[0];

    const handlePlateChange = (e) => {
      const val = e.target.value.toUpperCase();
      setPlate(val);
      const foundVehicle = vehicles.find(v => v.plate === val);
      if (foundVehicle) {
        setBrand(foundVehicle.brand); setModel(foundVehicle.model);
        if (CLIENTES.includes(foundVehicle.client)) { setSelectedClient(foundVehicle.client); } 
        else { setSelectedClient('OTRO'); setManualClient(foundVehicle.client); }
      }
    };

    const handleCreateJobSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const selectedDriverIds = formData.getAll('assignedDriverId');
      if (selectedDriverIds.length === 0) return alert("Debes seleccionar al menos un conductor.");

      const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
      const finalClient = selectedClient === 'OTRO' ? manualClient : selectedClient;
      
      const newJob = {
        scheduledDate: formData.get('scheduledDate'), client: finalClient, brand: brand, model: model,
        vin: plate, plate: plate, origin: formData.get('origin'), destination: formData.get('destination'),
        assignedDrivers: assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email})), assignedEmails: assignedDriversList.map(d => d.email),
        status: 'pending', createdAt: Date.now(), checklist: null
      };
      try { await addDoc(collection(db, 'transport_jobs'), newJob); setAdminTab('dashboard'); alert(`Trabajo asignado.`); } catch (error) { console.error(error); }
    };

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-extrabold mb-6 border-b pb-4 text-slate-800">Crear Nuevo Traslado</h2>
        <form onSubmit={handleCreateJobSubmit} className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">1. Vehículo <span className="text-xs text-blue-500 font-bold">(Escribe la patente para autocompletar)</span></h3>
             <div className="grid grid-cols-2 gap-4">
               <input value={plate} onChange={handlePlateChange} type="text" placeholder="Patente o VIN" className="w-full border-2 border-blue-200 p-3 text-sm rounded-xl col-span-2 uppercase outline-none focus:border-blue-500 font-bold bg-white text-blue-900 shadow-sm" />
               <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
               <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
             </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-700">2. Programación y Ruta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Fecha de Traslado</label>
                 <input name="scheduledDate" type="date" defaultValue={todayStr} required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-700" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Cliente</label>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white">
                  <option value="">Seleccione Cliente (Opcional)</option>
                  {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="OTRO">Otro (Ingreso manual)</option>
                </select>
                {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white mt-2" />}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <input name="origin" type="text" placeholder="Desde (Origen)" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
              <input name="destination" type="text" placeholder="Hasta (Destino)" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
            </div>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">3. Conductores <span className="text-xs text-red-500 font-normal">(Obligatorio seleccionar al menos 1)</span></h3>
             <div className="max-h-48 overflow-y-auto border-2 border-slate-200 bg-white rounded-xl">
                {drivers.length === 0 ? <p className="text-sm text-slate-400 p-4 font-semibold">No hay conductores.</p> : drivers.map(d => (
                  <label key={d.id} className="flex items-center p-4 border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                    <input type="checkbox" name="assignedDriverId" value={d.id} className="w-5 h-5 cursor-pointer rounded text-blue-600 focus:ring-blue-500" />
                    <div className="ml-4"><span className="block text-base font-bold text-slate-800">{d.name}</span><span className="block text-sm font-semibold text-slate-400">{d.email}</span></div>
                  </label>
                ))}
             </div>
          </div>
          <div className="flex justify-end pt-2"><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">Guardar y Asignar</button></div>
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
      const formData = new FormData(e.target);
      const selectedDriverIds = formData.getAll('assignedDriverId');
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
      try { await updateDoc(doc(db, 'transport_jobs', job.id), updatedData); alert("Trabajo actualizado."); onClose(); } catch (error) { console.error(error); }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
            <h2 className="text-xl font-extrabold text-slate-800">Modificar Trabajo</h2><button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button>
          </div>
          <form onSubmit={handleUpdateJobSubmit} className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Programación, Cliente y Ruta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha Programada</label><input name="scheduledDate" type="date" defaultValue={defaultDate} required className="w-full border-2 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-700" /></div>
                <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase ml-1">Cliente</label><select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border-2 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold"><option value="">Seleccione Cliente...</option>{CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}<option value="OTRO">Otro (Ingreso manual)</option></select>{selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Nombre del cliente" className="w-full border-2 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold mt-2" />}</div>
                <input name="origin" defaultValue={job.origin} type="text" placeholder="Desde" className="w-full border-2 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold" />
                <input name="destination" defaultValue={job.destination} type="text" placeholder="Hasta" className="w-full border-2 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 mt-6">Vehículo</h3>
              <div className="grid grid-cols-2 gap-4">
                <input name="brand" defaultValue={job.brand} type="text" placeholder="Marca" className="w-full border-2 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold" />
                <input name="model" defaultValue={job.model} type="text" placeholder="Modelo" className="w-full border-2 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold" />
                <input name="plateOrVin" defaultValue={job.plate || job.vin} type="text" placeholder="Patente o VIN" className="w-full border-2 p-3 text-sm rounded-xl col-span-2 uppercase outline-none focus:border-blue-500 font-semibold" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 mt-6">Conductores Asignados <span className="text-xs font-normal text-slate-400">(Dejar igual si no quieres cambiarlos)</span></h3>
              <div className="max-h-40 overflow-y-auto border-2 rounded-xl">
                  {drivers.map(d => {
                    const isPreselected = job.assignedEmails?.includes(d.email);
                    return (<label key={d.id} className="flex items-center p-3 border-b hover:bg-blue-50 cursor-pointer"><input type="checkbox" name="assignedDriverId" value={d.id} defaultChecked={isPreselected} className="w-5 h-5 cursor-pointer rounded text-blue-600" /><div className="ml-3"><span className="block text-sm font-bold text-slate-800">{d.name}</span></div></label>)
                  })}
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t"><button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold">Cancelar</button><button type="submit" className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Guardar Cambios</button></div>
          </form>
        </div>
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
            <button onClick={() => setActiveRole(activeRole === 'admin' ? 'driver' : 'admin')} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl text-sm font-bold transition-all border border-white/10 backdrop-blur-sm">
              {activeRole === 'admin' ? <ToggleRight className="w-6 h-6 text-green-300"/> : <ToggleLeft className="w-6 h-6 text-slate-300"/>}
              <span className="hidden md:inline">{activeRole === 'admin' ? 'Modo Admin' : 'Modo Conductor'}</span>
            </button>
          )}
          <div className="hidden md:block text-right mr-2"><p className="text-xs text-blue-200 font-bold uppercase tracking-wider">Sesión iniciada</p><p className="text-sm font-extrabold">{currentUserEmail}</p></div>
          <button onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors" title="Cerrar sesión"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {editingJob && <EditJobModal job={editingJob} onClose={() => setEditingJob(null)} />}

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          {activeRole === 'admin' ? (
            <>
              <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={() => setAdminTab('dashboard')} className={`flex-1 flex justify-center gap-2 px-4 py-3 rounded-xl text-sm sm:text-base font-extrabold transition-colors ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><ClipboardList className="w-5 h-5"/> Trabajos</button>
                <button onClick={() => setAdminTab('newJob')} className={`flex-1 flex justify-center gap-2 px-4 py-3 rounded-xl text-sm sm:text-base font-extrabold transition-colors ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-5 h-5"/> Crear</button>
                <button onClick={() => setAdminTab('vehicles')} className={`flex-1 flex justify-center gap-2 px-4 py-3 rounded-xl text-sm sm:text-base font-extrabold transition-colors ${adminTab==='vehicles'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Truck className="w-5 h-5"/> Vehículos</button>
                <button onClick={() => setAdminTab('drivers')} className={`flex-1 flex justify-center gap-2 px-4 py-3 rounded-xl text-sm sm:text-base font-extrabold transition-colors ${adminTab==='drivers'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Users className="w-5 h-5"/> Conductores</button>
              </div>
              
              {adminTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h2 className="text-2xl font-extrabold text-slate-800">Monitor Administrativo</h2>
                    <button onClick={exportToExcel} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-lg shadow-green-200 transition-colors"><Download className="w-5 h-5"/> Exportar Excel</button>
                  </div>
                  <JobsList jobs={jobs} drivers={drivers} role="admin" onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} onEditJob={setEditingJob} db={db} currentUserEmail={currentUserEmail} />
                </div>
              )}
              
              {adminTab === 'newJob' && <NewJobForm />}
              
              {/* PESTAÑA VEHÍCULOS MEJORADA (Filtro y Edición) */}
              {adminTab === 'vehicles' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form key={editingVehicle ? editingVehicle.id : 'new'} onSubmit={editingVehicle ? handleUpdateVehicle : handleCreateVehicle} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><Truck className="text-blue-600"/> {editingVehicle ? 'Editar Vehículo' : 'Guardar Nuevo Vehículo'}</h3>
                    <p className="text-xs font-bold text-slate-500 mb-2">Agrega vehículos frecuentes a tu base de datos para autocompletar al crear un trabajo.</p>
                    
                    <select name="client" defaultValue={editingVehicle && CLIENTES.includes(editingVehicle.client) ? editingVehicle.client : (editingVehicle ? 'OTRO' : '')} className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold text-slate-700">
                      <option value="">Seleccione Cliente al que pertenece...</option>
                      {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="OTRO">Otro (Se debe escribir manualmente)</option>
                    </select>
                    <input name="manualClient" defaultValue={editingVehicle && !CLIENTES.includes(editingVehicle.client) ? editingVehicle.client : ''} placeholder="Si seleccionaste Otro, escribe el cliente aquí" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
                    
                    <input name="brand" defaultValue={editingVehicle ? editingVehicle.brand : ''} placeholder="Marca (Ej. Chevrolet)" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
                    <input name="model" defaultValue={editingVehicle ? editingVehicle.model : ''} placeholder="Modelo (Ej. NPR 816)" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
                    <input name="plate" defaultValue={editingVehicle ? editingVehicle.plate : ''} placeholder="Patente" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm uppercase outline-none focus:border-blue-500 font-bold text-slate-800"/>
                    
                    <div className="flex gap-3">
                      {editingVehicle && <button type="button" onClick={() => setEditingVehicle(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-extrabold text-lg transition-colors">Cancelar</button>}
                      <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">{editingVehicle ? 'Guardar Cambios' : 'Guardar Vehículo'}</button>
                    </div>
                  </form>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-extrabold text-slate-800">Flota</h3>
                      <select value={fleetFilter} onChange={(e) => setFleetFilter(e.target.value)} className="border-2 border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-blue-500">
                        <option value="">Todos los Clientes</option>
                        {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="OTRO">Otros</option>
                      </select>
                    </div>
                    
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2" style={{ maxHeight: '60vh' }}>
                      {vehicles.filter(v => {
                        if (!fleetFilter) return true;
                        if (fleetFilter === 'OTRO') return !CLIENTES.includes(v.client);
                        return v.client === fleetFilter;
                      }).map(v=>(
                        <div key={v.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl group transition-all">
                          <div>
                            <p className="text-base font-extrabold text-slate-800">{v.brand} {v.model}</p>
                            <p className="text-sm font-bold text-blue-600">{v.plate}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1">{v.client || 'Sin cliente'}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setEditingVehicle(v)} className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors shadow-sm"><Edit2 className="w-5 h-5"/></button>
                            <button onClick={() => handleDeleteVehicle(v.id)} className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors shadow-sm"><Trash2 className="w-5 h-5"/></button>
                          </div>
                        </div>
                      ))}
                      {vehicles.length === 0 && <p className="text-sm font-semibold text-slate-400">No hay vehículos registrados</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA CONDUCTORES */}
              {adminTab === 'drivers' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={editingDriver ? handleUpdateDriver : handleCreateDriver} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><User className="text-blue-600"/> {editingDriver ? 'Editar Conductor' : 'Nuevo Conductor'}</h3>
                    <input name="driverName" defaultValue={editingDriver ? editingDriver.name : ''} placeholder="Nombre completo" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
                    <input name="driverEmail" defaultValue={editingDriver ? editingDriver.email : ''} placeholder="Correo Gmail del conductor" required type="email" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
                    <div className="flex gap-3">
                      {editingDriver && <button type="button" onClick={() => setEditingDriver(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-extrabold text-lg transition-colors">Cancelar</button>}
                      <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">{editingDriver ? 'Guardar Cambios' : 'Crear Conductor'}</button>
                    </div>
                  </form>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xl font-extrabold text-slate-800 mb-6">Directorio</h3>
                    <div className="space-y-3">
                      {drivers.length === 0 ? <p className="text-sm font-semibold text-slate-400">Directorio vacío</p> : drivers.map(d=>(
                        <div key={d.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl group transition-all">
                          <div><p className="text-base font-extrabold text-slate-800">{d.name}</p><p className="text-sm font-bold text-slate-400">{d.email}</p></div>
                          <button onClick={() => setEditingDriver(d)} className="p-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl transition-colors shadow-sm"><Edit2 className="w-5 h-5"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Mis Trabajos Asignados</h2>
              <JobsList jobs={jobs} drivers={drivers} role="driver" onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} />
            </div>
          )}
        </main>
      )}

      {/* PESTAÑA RANKING (LEADERBOARD) */}
      {currentView === 'main' && mainTab === 'ranking' && (
        <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} db={db} />
      )}

      {/* PESTAÑA GASTOS */}
      {currentView === 'main' && mainTab === 'expenses' && (
        <ExpensesView role={activeRole} drivers={drivers} expenses={expenses} db={db} currentUserEmail={currentUserEmail} />
      )}

      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4 pt-6">
          <ChecklistForm job={selectedJob} db={db} currentUserEmail={currentUserEmail} onCancel={() => setCurrentView('main')} onComplete={() => { setSelectedJob(null); setCurrentView('main'); }} />
        </main>
      )}

      {/* BOTTOM NAV BAR */}
      {currentView === 'main' && (
        <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center p-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
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
    </div>
  );
}

// ==========================================
// MÓDULO RANKING (LEADERBOARD)
// ==========================================
function LeaderboardView({ jobs, drivers, isAdminView, db }) {
  const [selectedDriverJobs, setSelectedDriverJobs] = useState(null);

  // Calcular mes actual
  const now = new Date();
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // Filtrar solo trabajos completados del mes actual
  const monthlyCompletedJobs = jobs.filter(j => j.status === 'completed' && j.completedAt >= firstOfCurrentMonth);

  // Calcular ranking
  const ranking = drivers.map(d => {
    const driverJobs = monthlyCompletedJobs.filter(j => j.acceptedByEmail === d.email);
    return { ...d, score: driverJobs.length, jobs: driverJobs };
  }).sort((a, b) => b.score - a.score);

  return (
    <main className="max-w-5xl mx-auto p-4 pt-6 pb-24">
      <h2 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Ranking Mensual</h2>
      
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-2 sm:p-6">
        {ranking.length === 0 ? <p className="text-slate-400 font-bold text-center py-6">No hay datos suficientes.</p> : ranking.map((driver, index) => (
          <div key={driver.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-slate-50 transition-colors rounded-xl">
             <div className="flex items-center gap-4">
                <span className={`text-2xl font-black ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-700' : 'text-slate-300'}`}>
                  #{index+1}
                </span>
                <div>
                   <p className="font-extrabold text-slate-800 text-lg">{driver.name}</p>
                   <p className="text-sm text-slate-500 font-bold">{driver.score} Traslados</p>
                </div>
             </div>
             {isAdminView && (
                <button onClick={() => setSelectedDriverJobs(driver)} className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors">
                   <Eye className="w-4 h-4"/> <span className="hidden sm:inline">Ver Historial</span>
                </button>
             )}
          </div>
        ))}
      </div>

      {/* Modal Historial de Conductor para Admin */}
      {selectedDriverJobs && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-800">Historial: {selectedDriverJobs.name}</h2>
              <button onClick={() => setSelectedDriverJobs(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {selectedDriverJobs.jobs.length === 0 ? <p className="text-slate-500 font-bold text-center">Sin traslados este mes.</p> :
                selectedDriverJobs.jobs.map(job => (
                  <div key={job.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-extrabold text-slate-800 text-lg">{job.brand} {job.model}</p>
                      <span className="text-xs font-bold bg-white border px-2 py-1 rounded uppercase text-slate-500">{job.plate || job.vin}</span>
                    </div>
                    <div className="space-y-1 mb-3">
                      <p className="text-sm font-bold text-slate-600 flex items-center gap-1"><MapPin className="w-4 h-4 text-slate-400"/> {job.origin}</p>
                      <p className="text-sm font-bold text-slate-600 flex items-center gap-1"><Navigation className="w-4 h-4 text-slate-400"/> {job.destination}</p>
                    </div>
                    <p className="text-xs font-bold text-blue-600 border-t pt-2">{new Date(job.completedAt).toLocaleString()}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// MÓDULO DE GASTOS
// ==========================================
function ExpensesView({ role, drivers, expenses, db, currentUserEmail }) {
  const isAdminView = role === 'admin';
  const myDriver = drivers.find(d => d.email === currentUserEmail);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const handleAssignFunds = async (e, driver) => {
    e.preventDefault();
    const amount = Number(e.target.amount.value);
    try {
      await updateDoc(doc(db, 'drivers', driver.id), { balance: (driver.balance || 0) + amount });
      await addDoc(collection(db, 'expenses'), { driverId: driver.id, driverEmail: driver.email, driverName: driver.name, type: 'assignment', amount, detail: 'Asignación de fondos', createdAt: Date.now() });
      e.target.reset(); alert(`$${amount} asignados a ${driver.name}`);
    } catch (error) { console.error(error); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const amount = Number(e.target.amount.value);
    const detail = e.target.detail.value;
    const currentBalance = myDriver?.balance || 0;
    if (amount > currentBalance) return alert("No tienes saldo suficiente asignado.");
    try {
      await updateDoc(doc(db, 'drivers', myDriver.id), { balance: currentBalance - amount });
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: currentUserEmail, driverName: myDriver.name, type: 'expense', amount, detail, createdAt: Date.now() });
      e.target.reset(); alert("Gasto registrado");
    } catch (error) { console.error(error); }
  };

  const handleReceiptUploadCompress = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const bmp = await window.createImageBitmap(file, { resizeWidth: 800, resizeQuality: 'medium' });
      const canvas = document.createElement('canvas'); canvas.width = bmp.width; canvas.height = bmp.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bmp, 0, 0);
      setReturnReceipt(canvas.toDataURL('image/jpeg', 0.6));
      bmp.close();
    } catch (error) { console.error(error); alert("Error al procesar el comprobante."); }
  };

  const submitReturnFunds = async () => {
    const currentBalance = myDriver?.balance || 0;
    if (currentBalance <= 0 || !returnReceipt) return;
    try {
      await updateDoc(doc(db, 'drivers', myDriver.id), { balance: 0 });
      await addDoc(collection(db, 'expenses'), { 
        driverId: myDriver.id, driverEmail: currentUserEmail, driverName: myDriver.name, 
        type: 'return', amount: currentBalance, detail: 'Rendición de Vuelto', receiptImage: returnReceipt, createdAt: Date.now() 
      });
      alert("Fondos rendidos y comprobante guardado.");
      setIsReturnModalOpen(false); setReturnReceipt(null);
    } catch (error) { console.error(error); alert("Error al rendir fondos"); }
  };

  const handleDeleteExpense = async (expense) => {
    if (!isAdminView && expense.type === 'assignment') return alert("No puedes eliminar una asignación. Pide al admin que lo haga.");
    if (window.confirm("¿Eliminar este registro? El saldo se ajustará automáticamente.")) {
      try {
        const driverSnapshot = drivers.find(d => d.id === expense.driverId);
        if (driverSnapshot) {
          let newBalance = driverSnapshot.balance || 0;
          if (expense.type === 'assignment') newBalance -= expense.amount;
          if (expense.type === 'expense' || expense.type === 'return') newBalance += expense.amount;
          await updateDoc(doc(db, 'drivers', expense.driverId), { balance: newBalance });
        }
        await deleteDoc(doc(db, 'expenses', expense.id));
      } catch(error) { console.error(error); }
    }
  };

  const TransactionIcon = ({ type }) => {
    if (type === 'assignment') return <ArrowUpCircle className="w-5 h-5 text-green-500"/>;
    if (type === 'expense') return <ArrowDownCircle className="w-5 h-5 text-red-500"/>;
    return <CheckCircle className="w-5 h-5 text-blue-500"/>;
  };

  const EditExpenseModal = ({ expense, onClose }) => {
    const handleUpdateSubmit = async (e) => {
      e.preventDefault();
      if (!isAdminView && expense.type === 'assignment') { alert("No puedes modificar una asignación."); return onClose(); }
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
        alert("Actualizado correctamente."); onClose();
      } catch (error) { console.error(error); alert("Error actualizando."); }
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
        {viewingReceipt && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-3xl p-4 w-full max-w-md relative">
              <button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button>
              <h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante de Transferencia</h3>
              <img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl border border-slate-100 shadow-sm" />
            </div>
          </div>
        )}

        <h2 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-2"><Wallet className="text-blue-600"/> Control de Viáticos</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-600">Conductores y Saldos</h3>
            {drivers.map(d => (
              <div key={d.id} className={`bg-white p-5 rounded-3xl shadow-sm border transition-all cursor-pointer ${selectedDriverId === d.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100 hover:border-blue-300'}`} onClick={() => setSelectedDriverId(d.id === selectedDriverId ? null : d.id)}>
                <div className="flex justify-between items-center">
                  <div><p className="font-extrabold text-slate-800 text-lg">{d.name}</p><p className="text-sm text-slate-400 font-bold">{d.email}</p></div>
                  <div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase">Saldo Actual</p><p className={`text-xl font-extrabold ${d.balance > 0 ? 'text-green-600' : 'text-slate-700'}`}>{formatMoney(d.balance || 0)}</p></div>
                </div>
                {selectedDriverId === d.id && (
                  <form onSubmit={(e) => handleAssignFunds(e, d)} className="mt-5 pt-5 border-t border-slate-100 flex gap-2" onClick={e=>e.stopPropagation()}>
                    <input type="number" name="amount" placeholder="Monto a asignar ($)" required className="flex-1 border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 font-extrabold rounded-xl transition-colors">Enviar</button>
                  </form>
                )}
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-fit">
            <h3 className="text-lg font-bold text-slate-600 mb-4">{selectedDriverId ? 'Historial del Conductor' : 'Historial Global'}</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {expenses.filter(e => selectedDriverId ? e.driverId === selectedDriverId : true).map(exp => (
                <div key={exp.id} className="flex items-start gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="mt-1"><TransactionIcon type={exp.type}/></div>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold text-slate-800">{exp.detail}</p>
                    <p className="text-xs font-bold text-slate-400">{!selectedDriverId && <span className="text-blue-600">{exp.driverName} • </span>}{new Date(exp.createdAt).toLocaleDateString()}</p>
                    {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver comprobante</button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                    <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                      <button onClick={() => setEditingExpense(exp)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => handleDeleteExpense(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
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

  return (
    <main className="max-w-md mx-auto p-4 pt-6 space-y-6 pb-24">
      {viewingReceipt && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-3xl p-4 w-full max-w-md relative">
            <button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button>
            <h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante de Transferencia</h3>
            <img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl border border-slate-100 shadow-sm" />
          </div>
        </div>
      )}

      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Rendir Vuelto</h3><button onClick={() => { setIsReturnModalOpen(false); setReturnReceipt(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
            <p className="text-sm font-bold text-slate-500 mb-4 border-b border-slate-100 pb-4">Monto total a rendir: <span className="text-blue-600 text-xl font-extrabold block mt-1">{formatMoney(myBalance)}</span></p>
            <label className={`block w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors relative overflow-hidden ${returnReceipt ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
              <input type="file" accept="image/*" className="hidden" onChange={handleReceiptUploadCompress} />
              {returnReceipt ? (
                 <div className="relative z-10"><CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2 bg-white rounded-full"/><p className="text-sm font-extrabold text-green-700 mb-2">Comprobante Cargado</p><img src={returnReceipt} className="h-28 object-contain mx-auto rounded-lg shadow-sm border border-green-200" alt="preview"/><p className="text-xs font-bold text-slate-500 mt-3 underline">Tocar para cambiar</p></div>
              ) : (
                 <div className="py-4"><Camera className="w-10 h-10 text-slate-400 mx-auto mb-3"/><p className="text-sm font-extrabold text-slate-600">Sube aquí el comprobante</p></div>
              )}
            </label>
            <div className="flex gap-4 mt-6"><button onClick={() => { setIsReturnModalOpen(false); setReturnReceipt(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={submitReturnFunds} disabled={!returnReceipt} className={`flex-[2] py-3 rounded-xl font-extrabold transition-all ${returnReceipt ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200' : 'bg-slate-200 text-slate-400'}`}>Confirmar</button></div>
          </div>
        </div>
      )}

      {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-xl text-center text-white relative overflow-hidden">
        <Wallet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
        <p className="text-blue-100 font-bold uppercase tracking-wider text-sm mb-2">Fondo Asignado Actual</p>
        <p className="text-5xl font-extrabold tracking-tight">{formatMoney(myBalance)}</p>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 mb-4"><Receipt className="w-5 h-5 text-red-500"/> Registrar Gasto</h3>
        <form onSubmit={handleAddExpense} className="space-y-4">
          <input type="text" name="detail" placeholder="¿En qué gastaste? (Ej. Peaje)" required className="w-full border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" />
          <input type="number" name="amount" placeholder="Monto ($)" required className="w-full border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" />
          <button type="submit" disabled={myBalance <= 0} className={`w-full py-4 rounded-2xl font-extrabold text-lg transition-all ${myBalance > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Guardar Gasto</button>
        </form>
      </div>
      
      {myBalance > 0 && (
        <button onClick={() => setIsReturnModalOpen(true)} className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-2 border-green-200 py-4 rounded-3xl font-extrabold text-lg flex justify-center items-center gap-2 transition-all">
          <CheckCircle className="w-6 h-6"/> Rendir Vuelto ($0)
        </button>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-extrabold text-slate-800 mb-4">Mis Movimientos</h3>
        <div className="space-y-3">
          {expenses.filter(e => e.driverId === myDriver.id).map(exp => (
            <div key={exp.id} className="flex items-start gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="mt-1"><TransactionIcon type={exp.type}/></div>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-slate-800">{exp.detail}</p>
                <p className="text-[10px] font-bold text-slate-400">{new Date(exp.createdAt).toLocaleString()}</p>
                {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver comprobante</button>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                {exp.type !== 'assignment' ? (
                  <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                    <button onClick={() => setEditingExpense(exp)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={() => handleDeleteExpense(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ) : <div className="pl-2 ml-1"><span className="text-[10px] font-bold text-slate-400 uppercase">Fondo</span></div>}
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
function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [jobToFail, setJobToFail] = useState(null);
  const now = new Date();
  const isAdminView = role === 'admin';
  
  const filteredJobs = jobs.filter(job => {
    if (!isAdminView) {
      if (job.status === 'pending') {
        if (!job.assignedEmails?.includes(currentUserEmail)) return false;
      } else {
        if (job.acceptedByEmail !== currentUserEmail) return false;
      }
    }
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
    const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : a.createdAt;
    const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : b.createdAt;
    return dateA - dateB; 
  });

  const activeJobs = sortedJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
  const historyJobs = sortedJobs.filter(j => j.status === 'completed' || j.status === 'failed');

  const handleAcceptJob = async (job) => {
    try { await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'accepted', acceptedByEmail: currentUserEmail }); } 
    catch (e) { console.error(e); }
  };

  const handleDeleteJob = async (jobId) => {
    if(window.confirm("¿Estás seguro de eliminar este trabajo definitivamente?")) {
      try { await deleteDoc(doc(db, 'transport_jobs', jobId)); } 
      catch (e) { console.error(e); }
    }
  };

  const handleFailJob = async (job, reason) => {
    try {
      await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'failed', failedReason: reason, completedAt: Date.now(), acceptedByEmail: job.acceptedByEmail || currentUserEmail });
      setJobToFail(null); alert("Trabajo marcado como fallido.");
    } catch (e) { console.error(e); }
  };

  const buildPDFDoc = async (job) => {
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
      });
    }
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF();
    
    docPDF.setFillColor(37, 99, 235); docPDF.rect(0, 0, 210, 30, 'F'); docPDF.setTextColor(255, 255, 255);
    docPDF.setFontSize(22); docPDF.setFont("helvetica", "bold"); docPDF.text("CHECKLIST DE TRASLADO", 105, 20, null, null, "center");
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
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Ruta:`, 20, 74); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.origin || '-'}  ->  ${job.destination || '-'}`, 35, 74);
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
    docPDF.setFontSize(14); docPDF.setFont("helvetica", "bold"); docPDF.text("3. RECEPCIÓN", 20, startY + 8);
    
    docPDF.setFontSize(11);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`Receptor:`, 20, startY + 18); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverName || 'N/A'}`, 42, startY + 18);
    docPDF.setFont("helvetica", "normal"); docPDF.text(`RUT:`, 110, startY + 18); docPDF.setFont("helvetica", "bold"); docPDF.text(`${job.checklist?.receiverRut || 'N/A'}`, 122, startY + 18);
    
    if (job.checklist?.location) {
      const { lat, lng } = job.checklist.location;
      docPDF.setFont("helvetica", "normal"); docPDF.text(`Ubicación GPS:`, 20, startY + 28);
      docPDF.setTextColor(37, 99, 235); docPDF.textWithLink('Ver en Google Maps', 52, startY + 28, { url: `https://www.google.com/maps?q=${lat},${lng}` }); docPDF.setTextColor(0, 0, 0); 
    } else { docPDF.setFont("helvetica", "normal"); docPDF.text(`Ubicación GPS: No registrada`, 20, startY + 28); }

    if(job.checklist?.signatureData) { docPDF.setFont("helvetica", "normal"); docPDF.text(`Firma conformada:`, 20, startY + 45); docPDF.addImage(job.checklist.signatureData, 'PNG', 55, startY + 30, 70, 45); }

    if (job.checklist?.photos) {
      const photos = job.checklist.photos;
      const labels = { front: 'Frente', driver: 'Lateral Piloto', passenger: 'Lateral Copiloto', back: 'Atrás', tire: 'Repuesto', dashboard: 'Tablero', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4' };
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
          docPDF.setFontSize(11); docPDF.setFont("helvetica", "bold"); docPDF.text(labels[key], slotCenter, currentY - 3, { align: "center" });
          docPDF.setDrawColor(200, 200, 200); docPDF.rect(finalX - 1, currentY - 1, imgW + 2, imgH + 2); 
          docPDF.addImage(photos[key], 'JPEG', finalX, currentY, imgW, imgH);
          if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; currentY += (imgH > 80 ? imgH : 80) + 15; }
        }
      }
    }
    return docPDF;
  };

  const getJobDateStr = (job) => job.scheduledDate ? formatDateDisplay(job.scheduledDate) : formatDateDisplay(new Date().toISOString().split('T')[0]);
  const handleCopyWhatsApp = (job) => { const text = `${getJobDateStr(job)}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${job.origin || '-'} - ${job.destination || '-'}`; navigator.clipboard.writeText(text).then(() => { alert("✅ Formato copiado al portapapeles. Listo para pegar en WhatsApp."); setMenuOpenId(null); }); };

  const generatePDF = async (job) => {
    try { const docPDF = await buildPDFDoc(job); const fileName = `Check.${getJobDateStr(job).replace(/\//g, '-')}.${job.client || 'SinCliente'}.${job.plate || job.vin || 'SN'}.pdf`; docPDF.save(fileName); } 
    catch(e) { console.error(e); alert("Hubo un error al generar PDF."); }
  };

  const handleShareWhatsAppPDF = async (job) => {
    try {
      const fileName = `Check.${getJobDateStr(job).replace(/\//g, '-')}.${job.client || 'SinCliente'}.${job.plate || job.vin || 'SN'}.pdf`;
      const text = `${getJobDateStr(job)}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${job.plate || job.vin || '-'}\n${job.origin || '-'} - ${job.destination || '-'}`;
      const docPDF = await buildPDFDoc(job); const pdfBlob = docPDF.output('blob'); const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title: fileName, text: text, files: [file] }); } 
      else { alert("Tu dispositivo no soporta compartir el archivo directamente. Descárgalo primero y compártelo manual."); handleCopyWhatsApp(job); }
    } catch (e) { console.error(e); }
  };

  return (
    <>
      <div className="pb-20">
        
        {/* SECCIÓN 1: TRABAJOS ACTIVOS (CUADRÍCULA) */}
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
                    {/* BOTÓN EDITAR FUERA DEL MENÚ PARA ADMINS */}
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
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-slate-300 shrink-0"/> <span className="text-sm font-bold text-slate-600">{job.origin || 'No especificado'}</span></div>
                    <div className="flex items-start gap-3"><Navigation className="w-5 h-5 text-slate-300 shrink-0"/> <span className="text-sm font-bold text-slate-600">{job.destination || 'No especificado'}</span></div>
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
            <h3 className="text-xl font-extrabold text-slate-800 mb-6 border-b-2 border-slate-100 pb-2">Historial de Trabajos</h3>
            <div className="flex flex-col gap-4">
              {historyJobs.map(job => (
                <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${job.status === 'failed' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 ml-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${job.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        {job.status === 'failed' ? 'Fallido' : 'Completado'}
                      </span>
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
                    <div className="col-span-2 sm:col-span-2"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Ruta</p><p className="text-sm font-bold text-slate-600">{job.origin} ➔ {job.destination}</p></div>
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
function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete }) {
  const isQuickJob = job.id === 'NEW_QUICK_JOB';
  const DRAFT_KEY = `checklist_draft_${job.id}`;

  const [step, setStep] = useState(() => { const savedStep = localStorage.getItem(`${DRAFT_KEY}_step`); return savedStep ? parseInt(savedStep, 10) : 1; });
  const [loadingLoc, setLoadingLoc] = useState(false);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) { try { return JSON.parse(saved); } catch(e) { console.error("Error cargando borrador"); } }
    return {
      scheduledDate: job.scheduledDate || new Date().toISOString().split('T')[0],
      client: job.client || '', brand: job.brand || '', model: job.model || '', plateOrVin: job.plate || job.vin || '',
      origin: job.origin || '', destination: job.destination || '', fuelLevel: 50, 
      photos: { front: false, driver: false, passenger: false, back: false, tire: false, dashboard: false, det1: false, det2: false, det3: false, det4: false },
      docs: { soap: false, permiso: false, revTecnica: false, gases: false }, 
      observations: '', receiverName: '', receiverCompany: '', receiverRut: '', receiverEmail: '', signatureData: null, location: null
    };
  });

  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); localStorage.setItem(`${DRAFT_KEY}_step`, step); }, [formData, step, DRAFT_KEY]);

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
    } catch (error) { console.error(error); alert("Error de memoria al procesar la foto."); }
  };

  const handleGetLocation = () => {
    setLoadingLoc(true);
    if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => { updateForm('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoadingLoc(false); }, () => { alert("Error GPS."); setLoadingLoc(false); }); }
  };

  const submitForm = async (e) => { 
    e.preventDefault(); 
    if (!formData.signatureData) return alert("Firma obligatoria."); 
    const finalData = {
      scheduledDate: formData.scheduledDate, client: formData.client, brand: formData.brand, model: formData.model, vin: formData.plateOrVin, plate: formData.plateOrVin, origin: formData.origin, destination: formData.destination,
      status: 'completed', completedAt: Date.now(), checklist: formData
    };
    try {
      if (isQuickJob) { finalData.createdAt = Date.now(); finalData.assignedDriverName = "Auto-creado"; finalData.acceptedByEmail = currentUserEmail; await addDoc(collection(db, 'transport_jobs'), finalData); } 
      else { await updateDoc(doc(db, 'transport_jobs', job.id), finalData); }
      localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(`${DRAFT_KEY}_step`);
      alert("✅ Checklist guardado correctamente."); onComplete();
    } catch (error) { console.error(error); alert("Hubo un error al guardar."); }
  };

  const handleCancelClick = () => { if (window.confirm("El progreso de este checklist ha sido autoguardado en tu teléfono. ¿Deseas pausar y salir por ahora?")) { onCancel(); } };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden pb-10">
      <div className="bg-blue-600 text-white p-6 flex justify-between items-center">
        <h2 className="text-xl font-extrabold flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">{isQuickJob ? <Zap className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white" />}</div>
          {isQuickJob ? "Checklist Rápido" : "Checklist Asignado"}
        </h2>
        <button onClick={handleCancelClick} className="text-blue-100 text-sm font-bold hover:text-white bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-xl transition-colors">Pausar / Salir</button>
      </div>
      <div className="flex bg-slate-100 h-1.5"><div className={`bg-green-500 transition-all duration-500 ${step === 1 ? 'w-1/2' : 'w-full'}`}></div></div>
      
      <div className="p-6 sm:p-8">
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-extrabold text-slate-800 border-b-2 border-slate-100 pb-2">Datos Principales</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <input type="date" value={formData.scheduledDate} onChange={e=>updateForm('scheduledDate', e.target.value)} required className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" />
              <input value={formData.client} onChange={e=>updateForm('client', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Cliente Empresa o Particular" />
              <input value={formData.brand} onChange={e=>updateForm('brand', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Marca" />
              <input value={formData.model} onChange={e=>updateForm('model', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Modelo" />
              <input value={formData.plateOrVin} onChange={e=>updateForm('plateOrVin', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl uppercase outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Patente/VIN" />
              <input value={formData.origin} onChange={e=>updateForm('origin', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Desde" />
              <input value={formData.destination} onChange={e=>updateForm('destination', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Hasta" />
            </div>

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
              {[{id:'front', l:'Frente'}, {id:'driver', l:'Piloto'}, {id:'passenger', l:'Copiloto'}, {id:'back', l:'Atrás'}, {id:'tire', l:'Repuesto'}, {id:'dashboard', l:'Tablero'}, {id:'det1', l:'Detalle 1'}, {id:'det2', l:'Detalle 2'}, {id:'det3', l:'Detalle 3'}, {id:'det4', l:'Detalle 4'}].map(p => (
                <label key={p.id} className={`p-1 border-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative overflow-hidden h-28 ${formData.photos[p.id] ? 'bg-green-50 border-green-400 shadow-md shadow-green-100' : 'border-dashed border-slate-300 hover:bg-slate-50 hover:border-slate-400'}`}>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, p.id)} />
                  {formData.photos[p.id] ? (
                    <><img src={formData.photos[p.id]} alt={p.l} className="absolute inset-0 w-full h-full object-cover opacity-50" /><CheckCircle className="text-green-600 w-8 h-8 relative z-10 bg-white rounded-full shadow-sm"/><span className="text-[10px] font-extrabold text-slate-800 text-center relative z-10 bg-white/90 px-2 py-0.5 rounded-full shadow-sm mt-1">{p.l}</span></>
                  ) : (
                    <><div className="bg-slate-100 p-2 rounded-full mb-1"><Camera className="text-slate-400 w-5 h-5"/></div><span className="text-[10px] font-extrabold text-slate-500 text-center uppercase tracking-wider">{p.l}</span></>
                  )}
                </label>
              ))}
            </div>

            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-slate-800">Combustible: <span className="text-blue-600">{formData.fuelLevel}%</span></h3>
            <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={(e) => updateForm('fuelLevel', e.target.value)} className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2" />
            
            <textarea rows="3" value={formData.observations} onChange={(e) => updateForm('observations', e.target.value)} placeholder="Observaciones de daños o detalles..." className="w-full border-2 border-slate-200 p-4 text-sm outline-none focus:border-blue-500 rounded-xl mt-6 font-bold text-slate-700"></textarea>
            
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-extrabold transition-all shadow-xl shadow-blue-200 text-lg mt-8">Continuar a Recepción</button>
          </div>
        )}
        
        {step === 2 && (
          <form onSubmit={submitForm} className="space-y-6">
            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 text-slate-800">Datos de Recepción</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input required value={formData.receiverName} onChange={e=>updateForm('receiverName', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Nombre completo del receptor" />
              <input required value={formData.receiverRut} onChange={e=>updateForm('receiverRut', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="RUT" />
              <input required type="email" value={formData.receiverEmail} onChange={e=>updateForm('receiverEmail', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl col-span-1 sm:col-span-2 outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Correo electrónico del receptor" />
            </div>
            
            <button type="button" onClick={handleGetLocation} className={`px-4 py-4 rounded-2xl text-base w-full font-extrabold transition-all shadow-sm ${formData.location ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-transparent'}`}>
              {formData.location ? "📍 GPS Capturado Exitosamente" : "📍 Tocar para Capturar GPS Actual"}
            </button>
            
            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-slate-800">Firma del Receptor</h3>
            <SignaturePad initialData={formData.signatureData} onSave={(data) => updateForm('signatureData', data)} onClear={() => updateForm('signatureData', null)} />
            
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