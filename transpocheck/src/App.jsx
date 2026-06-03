import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, ToggleLeft, ToggleRight, Edit2
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

const CLIENTES = ["Grandleasing", "Kovacs", "Salfa", "Enex"];

// ==========================================
// 2. COMPONENTE: FIRMA DIGITAL
// ==========================================
const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }, []);

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
      <button type="button" onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,300,150); if(onClear) onClear(); }} className="mt-2 text-sm text-red-500 hover:text-red-600 font-bold px-2 py-1 bg-red-50 rounded-lg">Limpiar firma</button>
    </div>
  );
};

// ==========================================
// 3. APLICACIÓN PRINCIPAL
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [editingDriver, setEditingDriver] = useState(null);
  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [activeRole, setActiveRole] = useState('driver');
  
  const isFirstLoad = useRef(true);

  const triggerNotification = (title, body) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") new Notification(title, { body });
      });
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
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
            triggerNotification('📍 ¡Nuevo Traslado Asignado!', `Tienes que mover un ${jobData.brand} ${jobData.model} desde ${jobData.origin}`);
          }
          if (change.type === 'modified' && jobData.status === 'accepted' && isRealAdmin && activeRole === 'admin') {
            triggerNotification('✅ Trabajo Aceptado', `El conductor ${jobData.acceptedByEmail} aceptó el traslado del ${jobData.brand} ${jobData.model}`);
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

    return () => { unsubJobs(); unsubDrivers(); };
  }, [user, activeRole]);

  // FUENTE AMIGABLE GLOBAL
  const globalStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
      body { font-family: 'Nunito', sans-serif; }
    `}</style>
  );

  // Pantalla de Login
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
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e))} className="w-full bg-white border-2 border-gray-200 text-slate-700 font-bold py-4 px-4 rounded-2xl shadow-sm hover:bg-gray-50 hover:border-blue-200 flex items-center justify-center gap-3 transition-all text-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" /> Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'drivers'), { name: e.target.driverName.value, email: e.target.driverEmail.value.toLowerCase(), createdAt: Date.now() });
      e.target.reset(); alert("Conductor creado exitosamente.");
    } catch (error) { console.error(error); }
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'drivers', editingDriver.id), { 
        name: e.target.driverName.value, 
        email: e.target.driverEmail.value.toLowerCase() 
      });
      setEditingDriver(null);
      alert("Conductor actualizado exitosamente.");
    } catch (error) { console.error(error); }
  };

  const handleQuickChecklist = () => {
    setSelectedJob({ id: 'NEW_QUICK_JOB', client: '', brand: '', model: '', plate: '', vin: '', origin: '', destination: '' });
    setCurrentView('checklist');
  };

  const exportToExcel = () => {
    const headers = ['ID', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Desde', 'Hasta', 'Conductores', 'Estado', 'Fecha'];
    const rows = jobs.map(j => [
      j.id, `"${j.client || ''}"`, `"${j.brand || ''}"`, `"${j.model || ''}"`, `"${j.plate || j.vin || ''}"`, 
      `"${j.origin || ''}"`, `"${j.destination || ''}"`, `"${j.assignedDrivers?.map(d=>d.name).join(' - ') || ''}"`, 
      `"${j.status || ''}"`, `"${new Date(j.createdAt).toLocaleString()}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", "Reporte_Trabajos.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const NewJobForm = () => {
    const [selectedClient, setSelectedClient] = useState('');
    const [manualClient, setManualClient] = useState('');

    const handleCreateJobSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const selectedDriverIds = formData.getAll('assignedDriverId');
      if (selectedDriverIds.length === 0) return alert("Debes seleccionar al menos un conductor.");

      const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
      const finalClient = selectedClient === 'OTRO' ? manualClient : selectedClient;
      
      const newJob = {
        client: finalClient, brand: formData.get('brand'), model: formData.get('model'),
        vin: formData.get('plateOrVin'), plate: formData.get('plateOrVin'), 
        origin: formData.get('origin'), destination: formData.get('destination'),
        assignedDrivers: assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email})),
        assignedEmails: assignedDriversList.map(d => d.email),
        status: 'pending', createdAt: Date.now(), checklist: null
      };

      try {
        await addDoc(collection(db, 'transport_jobs'), newJob);
        setAdminTab('dashboard'); alert(`Trabajo asignado a ${assignedDriversList.length} conductor(es).`);
      } catch (error) { console.error(error); }
    };

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-extrabold mb-6 border-b pb-4 text-slate-800">Crear Nuevo Traslado</h2>
        <form onSubmit={handleCreateJobSubmit} className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-700">1. Cliente y Ruta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <select required value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white">
                  <option value="">Seleccione Cliente...</option>
                  {CLIENTES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="OTRO">Otro (Ingreso manual)</option>
                </select>
                {selectedClient === 'OTRO' && (
                  <input type="text" required value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
                )}
              </div>
              <div className="hidden md:block"></div>
              <input name="origin" required type="text" placeholder="Desde (Origen)" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
              <input name="destination" required type="text" placeholder="Hasta (Destino)" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">2. Vehículo</h3>
             <div className="grid grid-cols-2 gap-4">
               <input name="brand" type="text" placeholder="Marca" required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
               <input name="model" type="text" placeholder="Modelo" required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
               <input name="plateOrVin" type="text" placeholder="Patente o VIN" required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl col-span-2 uppercase outline-none focus:border-blue-500 font-semibold bg-white" />
             </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
             <h3 className="text-base font-bold text-slate-700">3. Conductores</h3>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      {globalStyles}
      <header className="bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Car className="w-6 h-6 text-white" /></div>
          <h1 className="font-extrabold text-2xl tracking-tight">LogisticAPP</h1>
        </div>
        <div className="flex items-center gap-4">
          {isRealAdmin && (
            <button 
              onClick={() => setActiveRole(activeRole === 'admin' ? 'driver' : 'admin')}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-white/10 backdrop-blur-sm"
              title="Cambiar Vista"
            >
              {activeRole === 'admin' ? <ToggleRight className="w-6 h-6 text-green-300"/> : <ToggleLeft className="w-6 h-6 text-slate-300"/>}
              <span className="hidden sm:inline">{activeRole === 'admin' ? 'Modo Admin' : 'Modo Conductor'}</span>
            </button>
          )}

          <div className="hidden sm:block text-right">
            <p className="text-xs text-blue-200 font-bold uppercase tracking-wider">Sesión iniciada</p>
            <p className="text-sm font-extrabold">{currentUserEmail}</p>
          </div>
          <button onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {currentView === 'main' && (
        <main className="max-w-5xl mx-auto p-4 pt-6">
          <div className="mb-8">
            <button onClick={handleQuickChecklist} className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-2 shadow-xl shadow-indigo-200 transition-all transform hover:scale-[1.02]">
              <Zap className="w-6 h-6 fill-current"/> Checklist Rápido (Desde 0)
            </button>
          </div>

          {activeRole === 'admin' ? (
            <>
              <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={() => setAdminTab('dashboard')} className={`flex-1 flex justify-center gap-2 px-4 py-3 rounded-xl text-base font-extrabold transition-colors ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><ClipboardList className="w-5 h-5"/> Trabajos</button>
                <button onClick={() => setAdminTab('newJob')} className={`flex-1 flex justify-center gap-2 px-4 py-3 rounded-xl text-base font-extrabold transition-colors ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-5 h-5"/> Crear</button>
                <button onClick={() => setAdminTab('drivers')} className={`flex-1 flex justify-center gap-2 px-4 py-3 rounded-xl text-base font-extrabold transition-colors ${adminTab==='drivers'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Users className="w-5 h-5"/> Conductores</button>
              </div>
              {adminTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><h2 className="text-2xl font-extrabold text-slate-800">Monitor Administrativo</h2><button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-green-200 transition-colors"><Download className="w-4 h-4"/> Exportar a Excel</button></div>
                  <JobsList jobs={jobs} role="admin" onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} />
                </div>
              )}
              {adminTab === 'newJob' && <NewJobForm />}
              {adminTab === 'drivers' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={editingDriver ? handleUpdateDriver : handleCreateDriver} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                      <User className="text-blue-600"/> {editingDriver ? 'Editar Conductor' : 'Nuevo Conductor'}
                    </h3>
                    <input name="driverName" defaultValue={editingDriver ? editingDriver.name : ''} placeholder="Nombre completo" required className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
                    <input name="driverEmail" defaultValue={editingDriver ? editingDriver.email : ''} placeholder="Correo Gmail del conductor" required type="email" className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
                    
                    <div className="flex gap-3">
                      {editingDriver && (
                        <button type="button" onClick={() => setEditingDriver(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-extrabold text-lg transition-colors">Cancelar</button>
                      )}
                      <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">
                        {editingDriver ? 'Guardar Cambios' : 'Crear Conductor'}
                      </button>
                    </div>
                  </form>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xl font-extrabold text-slate-800 mb-6">Directorio</h3>
                    <div className="space-y-3">
                      {drivers.length === 0 ? <p className="text-sm font-semibold text-slate-400">Directorio vacío</p> : drivers.map(d=>(
                        <div key={d.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl group transition-all">
                          <div>
                            <p className="text-base font-extrabold text-slate-800">{d.name}</p>
                            <p className="text-sm font-bold text-slate-400">{d.email}</p>
                          </div>
                          <button onClick={() => setEditingDriver(d)} className="p-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl transition-colors shadow-sm" title="Editar Conductor">
                            <Edit2 className="w-5 h-5"/>
                          </button>
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
              <JobsList jobs={jobs} role="driver" onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} />
            </div>
          )}
        </main>
      )}

      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4 pt-6">
          <ChecklistForm job={selectedJob} db={db} currentUserEmail={currentUserEmail} onCancel={() => setCurrentView('main')} onComplete={() => { setSelectedJob(null); setCurrentView('main'); }} />
        </main>
      )}
    </div>
  );
}

// ==========================================
// 4. COMPONENTE: LISTA DE TRABAJOS
// ==========================================
function JobsList({ jobs, role, onStartChecklist, db, currentUserEmail }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const now = new Date();
  const isAdminView = role === 'admin';
  
  const filteredJobs = jobs.filter(job => {
    if (!isAdminView && (!job.assignedEmails?.includes(currentUserEmail) && job.acceptedByEmail !== currentUserEmail)) return false;
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

  const handleCopyWhatsApp = (job) => {
    const date = new Date();
    const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const text = `${formattedDate}\n${job.client || 'Sin Cliente'}\n${job.brand} ${job.model}\n${job.plate || job.vin}\n${job.origin} - ${job.destination}`;
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Formato copiado al portapapeles. Listo para pegar en WhatsApp.");
      setMenuOpenId(null);
    });
  };

  const generatePDF = async (job) => {
    try {
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const { jsPDF } = window.jspdf;
      const docPDF = new jsPDF();
      
      docPDF.setFontSize(18); docPDF.text(`Checklist de Traslado`, 105, 20, null, null, "center");
      docPDF.setFontSize(12); 
      docPDF.text(`Vehiculo: ${job.brand} ${job.model}`, 20, 40);
      docPDF.text(`Patente/VIN: ${job.plate || job.vin}`, 20, 50);
      docPDF.text(`Ruta: ${job.origin} -> ${job.destination}`, 20, 60);
      docPDF.text(`Nivel de Combustible: ${job.checklist?.fuelLevel || '0'}%`, 20, 70);
      docPDF.text(`Receptor: ${job.checklist?.receiverName || 'N/A'}`, 20, 80);
      docPDF.text(`RUT Receptor: ${job.checklist?.receiverRut || 'N/A'}`, 20, 90);
      docPDF.text(`Observaciones: ${job.checklist?.observations || 'Ninguna'}`, 20, 100);

      if (job.checklist?.location) {
        const { lat, lng } = job.checklist.location;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        docPDF.text(`Ubicación GPS:`, 20, 110);
        docPDF.setTextColor(0, 0, 255); 
        docPDF.textWithLink('Ver en Google Maps', 55, 110, { url: mapsUrl });
        docPDF.setTextColor(0, 0, 0); 
      } else { docPDF.text(`Ubicación GPS: No registrada`, 20, 110); }

      if(job.checklist?.signatureData) {
        docPDF.text(`Firma:`, 20, 130);
        docPDF.addImage(job.checklist.signatureData, 'PNG', 20, 135, 80, 40);
      }

      if (job.checklist?.photos) {
        const photos = job.checklist.photos;
        const labels = { front: 'Frente', driver: 'Lateral Piloto', passenger: 'Lateral Copiloto', back: 'Atrás', tire: 'Repuesto', dashboard: 'Tablero', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4' };
        
        let currentY = 30; let currentCol = 1; let addedPage = false;
        const getImageDims = (src) => new Promise(resolve => {
          const img = new Image(); img.onload = () => resolve({ w: img.width, h: img.height }); img.src = src;
        });

        for (const key in photos) {
          if (photos[key]) {
            if (!addedPage) {
              docPDF.addPage(); docPDF.setFontSize(16); docPDF.text(`Registro Fotográfico Adjunto`, 105, 20, null, null, "center"); addedPage = true;
            }
            const dims = await getImageDims(photos[key]);
            const ratio = dims.h / dims.w;
            let imgW = 80; let imgH = imgW * ratio; 
            if (imgH > 110) { imgH = 110; imgW = imgH / ratio; }
            const slotCenter = currentCol === 1 ? 60 : 150; 
            const finalX = slotCenter - (imgW / 2);

            if (currentY + imgH > 280) {
               docPDF.addPage(); currentY = 30; docPDF.setFontSize(16); docPDF.text(`Registro Fotográfico Adjunto (Cont.)`, 105, 20, null, null, "center");
            }
            docPDF.setFontSize(10);
            docPDF.text(labels[key], slotCenter, currentY - 3, { align: "center" });
            docPDF.addImage(photos[key], 'JPEG', finalX, currentY, imgW, imgH);
            
            if (currentCol === 1) { currentCol = 2; } 
            else { currentCol = 1; currentY += (imgH > 90 ? imgH : 90) + 15; }
          }
        }
      }

      const d = new Date();
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const fileName = `Check.${day}-${month}.${job.client || 'SinCliente'}.${job.plate || job.vin || 'SN'}.pdf`;
      docPDF.save(fileName);
      
    } catch(e) { console.error(e); alert("Hubo un error al generar PDF. Verifica tu conexión a internet."); }
  };

  if (filteredJobs.length === 0) return <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm"><p className="text-slate-400 font-extrabold text-lg">No hay trabajos disponibles.</p></div>;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-20">
      {filteredJobs.map(job => (
        <div key={job.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-visible flex flex-col relative transform hover:-translate-y-1 transition-transform duration-200">
          
          <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
            <span className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider ${job.status==='pending'?'bg-amber-100 text-amber-700':job.status==='accepted'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700'}`}>
              {job.status === 'pending' ? 'Pendiente' : job.status === 'accepted' ? 'En Curso' : 'Completado'}
            </span>
            
            <div className="relative">
              <button onClick={() => setMenuOpenId(menuOpenId === job.id ? null : job.id)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5"/>
              </button>
              {menuOpenId === job.id && (
                <div className="absolute right-0 top-10 bg-white border border-slate-100 shadow-2xl rounded-2xl w-56 z-10 overflow-hidden">
                  <button onClick={() => handleCopyWhatsApp(job)} className="w-full text-left px-5 py-4 text-sm font-bold flex items-center gap-3 hover:bg-slate-50 text-slate-700 transition-colors">
                    <Copy className="w-5 h-5 text-blue-500"/> Copiar para WhatsApp
                  </button>
                  {isAdminView && (
                    <button onClick={() => handleDeleteJob(job.id)} className="w-full text-left px-5 py-4 text-sm font-bold flex items-center gap-3 hover:bg-red-50 text-red-600 border-t border-slate-50 transition-colors">
                      <Trash2 className="w-5 h-5"/> Eliminar Trabajo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 flex-1">
            <h3 className="font-extrabold text-xl text-slate-800 leading-tight mb-1">{job.brand} {job.model}</h3>
            <p className="text-sm font-extrabold text-blue-600 uppercase tracking-wider mb-4">{job.client}</p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-slate-300 shrink-0"/> <span className="text-sm font-bold text-slate-600">{job.origin}</span></div>
              <div className="flex items-start gap-3"><Navigation className="w-5 h-5 text-slate-300 shrink-0"/> <span className="text-sm font-bold text-slate-600">{job.destination}</span></div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patente/VIN</span>
              <span className="font-extrabold text-slate-700 uppercase bg-white px-3 py-1 rounded-lg shadow-sm">{job.plate || job.vin}</span>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl">
            {job.status === 'pending' && (!isAdminView || job.assignedEmails?.includes(currentUserEmail)) && (
              <button onClick={() => handleAcceptJob(job)} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors shadow-lg shadow-blue-200">Reclamar Traslado</button>
            )}
            {((job.status === 'accepted' && (isAdminView || job.acceptedByEmail === currentUserEmail)) || (job.status !== 'completed' && isAdminView)) && (
              <button onClick={() => onStartChecklist(job)} className="w-full bg-green-600 hover:bg-green-700 text-white text-base font-extrabold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-colors shadow-lg shadow-green-200"><FileText className="w-5 h-5" /> Llenar Checklist</button>
            )}
            {job.status === 'completed' && (
              <button onClick={() => generatePDF(job)} className="w-full bg-slate-800 hover:bg-slate-900 text-white text-base font-extrabold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-colors shadow-lg shadow-slate-200"><FileDown className="w-5 h-5"/> Descargar PDF</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// 5. COMPONENTE: FORMULARIO DE CHECKLIST
// ==========================================
function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete }) {
  const [step, setStep] = useState(1);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const isQuickJob = job.id === 'NEW_QUICK_JOB';

  const [formData, setFormData] = useState({
    client: job.client || '', brand: job.brand || '', model: job.model || '', plateOrVin: job.plate || job.vin || '',
    origin: job.origin || '', destination: job.destination || '', fuelLevel: 50, 
    photos: { front: false, driver: false, passenger: false, back: false, tire: false, dashboard: false, det1: false, det2: false, det3: false, det4: false },
    observations: '', receiverName: '', receiverCompany: '', receiverRut: '', receiverEmail: '', signatureData: null, location: null
  });

  const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleImageUpload = async (e, photoId) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const bmp = await window.createImageBitmap(file, { resizeWidth: 800, resizeQuality: 'medium' });
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      updateForm('photos', { ...formData.photos, [photoId]: dataUrl });
      bmp.close();
    } catch (error) { console.error(error); alert("La foto es demasiado pesada para procesarla en memoria."); }
  };

  const handleGetLocation = () => {
    setLoadingLoc(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { updateForm('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoadingLoc(false); },
        () => { alert("Error GPS."); setLoadingLoc(false); }
      );
    }
  };

  const submitForm = async (e) => { 
    e.preventDefault(); 
    if (!formData.signatureData) return alert("Firma obligatoria."); 
    const finalData = {
      client: formData.client, brand: formData.brand, model: formData.model, vin: formData.plateOrVin, plate: formData.plateOrVin, origin: formData.origin, destination: formData.destination,
      status: 'completed', completedAt: Date.now(), checklist: formData
    };
    try {
      if (isQuickJob) {
        finalData.createdAt = Date.now(); finalData.assignedDriverName = "Auto-creado"; finalData.acceptedByEmail = currentUserEmail;
        await addDoc(collection(db, 'transport_jobs'), finalData);
      } else { await updateDoc(doc(db, 'transport_jobs', job.id), finalData); }
      alert("✅ Checklist guardado correctamente."); onComplete();
    } catch (error) { console.error(error); alert("Hubo un error al guardar."); }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden pb-10">
      <div className="bg-blue-600 text-white p-6 flex justify-between items-center">
        <h2 className="text-xl font-extrabold flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
            {isQuickJob ? <Zap className="w-5 h-5 text-white" /> : <FileText className="w-5 h-5 text-white" />} 
          </div>
          {isQuickJob ? "Checklist Rápido" : "Checklist Asignado"}
        </h2>
        <button onClick={onCancel} className="text-blue-100 text-sm font-bold hover:text-white bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-xl transition-colors">Cancelar</button>
      </div>
      <div className="flex bg-slate-100 h-1.5"><div className={`bg-green-500 transition-all duration-500 ${step === 1 ? 'w-1/2' : 'w-full'}`}></div></div>
      
      <div className="p-6 sm:p-8">
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-extrabold text-slate-800 border-b-2 border-slate-100 pb-2">Datos Principales</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <input value={formData.client} onChange={e=>updateForm('client', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Cliente Empresa o Particular" required/>
              <input value={formData.brand} onChange={e=>updateForm('brand', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Marca" required/>
              <input value={formData.model} onChange={e=>updateForm('model', e.target.value)} className="border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Modelo" required/>
              <input value={formData.plateOrVin} onChange={e=>updateForm('plateOrVin', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl uppercase outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Patente/VIN" required/>
              <input value={formData.origin} onChange={e=>updateForm('origin', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Desde" required/>
              <input value={formData.destination} onChange={e=>updateForm('destination', e.target.value)} className="col-span-2 border-2 border-slate-200 p-4 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" placeholder="Hasta" required/>
            </div>
            
            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-blue-600">Fotografías</h3>
            <p className="text-xs font-bold text-slate-400 -mt-2 mb-4">Toca un cuadro para elegir cámara o galería</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                {id:'front', l:'Frente'}, {id:'driver', l:'Piloto'}, {id:'passenger', l:'Copiloto'}, {id:'back', l:'Atrás'}, 
                {id:'tire', l:'Repuesto'}, {id:'dashboard', l:'Tablero'}, {id:'det1', l:'Detalle 1'}, {id:'det2', l:'Detalle 2'}, {id:'det3', l:'Detalle 3'}, {id:'det4', l:'Detalle 4'}
              ].map(p => (
                <label key={p.id} className={`p-1 border-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative overflow-hidden h-28 ${formData.photos[p.id] ? 'bg-green-50 border-green-400 shadow-md shadow-green-100' : 'border-dashed border-slate-300 hover:bg-slate-50 hover:border-slate-400'}`}>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, p.id)} />
                  {formData.photos[p.id] ? (
                    <>
                      <img src={formData.photos[p.id]} alt={p.l} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                      <CheckCircle className="text-green-600 w-8 h-8 relative z-10 bg-white rounded-full shadow-sm"/>
                      <span className="text-[10px] font-extrabold text-slate-800 text-center relative z-10 bg-white/90 px-2 py-0.5 rounded-full shadow-sm mt-1">{p.l}</span>
                    </>
                  ) : (
                    <>
                      <div className="bg-slate-100 p-2 rounded-full mb-1"><Camera className="text-slate-400 w-5 h-5"/></div>
                      <span className="text-[10px] font-extrabold text-slate-500 text-center uppercase tracking-wider">{p.l}</span>
                    </>
                  )}
                </label>
              ))}
            </div>

            <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 mt-8 text-slate-800">Combustible: <span className="text-blue-600">{formData.fuelLevel}%</span></h3>
            <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={(e) => updateForm('fuelLevel', e.target.value)} className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2" />
            
            <textarea rows="3" value={formData.observations} onChange={(e) => updateForm('observations', e.target.value)} placeholder="Observaciones de daños o detalles..." className="w-full border-2 border-slate-200 p-4 text-sm outline-none focus:border-blue-500 rounded-xl mt-6 font-bold text-slate-700"></textarea>
            
            <button onClick={() => {
              if(!formData.brand || !formData.model || !formData.plateOrVin) return alert("Completa los datos del vehículo");
              setStep(2);
            }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-extrabold transition-all shadow-xl shadow-blue-200 text-lg mt-8">Continuar a Recepción</button>
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
            <SignaturePad onSave={(data) => updateForm('signatureData', data)} onClear={() => updateForm('signatureData', null)} />
            
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