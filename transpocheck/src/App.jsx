import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { 
  Car, MapPin, Camera, Fuel, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut
} from 'lucide-react';

// 1. CONFIGURACIÓN EXACTA DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDlX1VY0n5dDEvD_Tyivb0u_DLdfsargfI",
  authDomain: "logisticapp-45452.firebaseapp.com",
  projectId: "logisticapp-45452",
  storageBucket: "logisticapp-45452.firebasestorage.app",
  messagingSenderId: "522404772814",
  appId: "1:522404772814:web:6ae1154eb945d36475099f"
};

// 2. INICIALIZAR FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- DATOS MAESTROS ---
const INICIAL_CLIENTES = ["AutoMundo S.A.", "RentACar Pacific", "Logística Express", "Particular"];

// --- COMPONENTE DE FIRMA ---
const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  }, []);

  const drawEvent = (e, type) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Soporte para touch (celulares) y mouse (PC)
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
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
      <canvas ref={canvasRef} width={300} height={150} className="w-full h-[150px] touch-none cursor-crosshair bg-white"
        onPointerDown={(e) => drawEvent(e, 'start')} onPointerMove={(e) => drawEvent(e, 'draw')}
        onPointerUp={(e) => drawEvent(e, 'stop')} onPointerOut={(e) => drawEvent(e, 'stop')}
        onTouchStart={(e) => drawEvent(e, 'start')} onTouchMove={(e) => drawEvent(e, 'draw')}
        onTouchEnd={(e) => drawEvent(e, 'stop')}
      />
      <button type="button" onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,300,150); if(onClear) onClear(); }} className="mt-2 text-sm text-red-600 font-medium">Limpiar firma</button>
    </div>
  );
};

// ==========================================
// APLICACIÓN PRINCIPAL
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [clients] = useState(INICIAL_CLIENTES);

  // Escuchar Autenticación
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // Escuchar Base de Datos
  useEffect(() => {
    if (!user) return;
    const unsubJobs = onSnapshot(collection(db, 'transport_jobs'), (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      jobsData.sort((a, b) => b.createdAt - a.createdAt);
      setJobs(jobsData);
    });
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubJobs(); unsubDrivers(); };
  }, [user]);

  // Pantalla de Login
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">TranspoCheck</h1>
          <p className="text-gray-500 mb-8">Gestión logística de traslados</p>
          <button 
            onClick={() => signInWithPopup(auth, googleProvider).catch(e => console.error(e))} 
            className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 flex items-center justify-center gap-3 transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  // Lógica de Roles
  const currentUserEmail = user.email;
  const adminEmails = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'];
  const isAdmin = adminEmails.includes(currentUserEmail);

  // --- FUNCIONES ---
  const handleCreateDriver = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'drivers'), { name: e.target.driverName.value, email: e.target.driverEmail.value.toLowerCase(), createdAt: Date.now() });
      e.target.reset(); alert("Conductor creado.");
    } catch (error) { console.error(error); }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedDriverIds = formData.getAll('assignedDriverId');
    if (selectedDriverIds.length === 0) return alert("Debes seleccionar al menos un conductor.");

    const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
    
    const newJob = {
      client: formData.get('client'), brand: formData.get('brand'), model: formData.get('model'),
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

  const exportToCSV = () => {
    const headers = ['ID', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Desde', 'Hasta', 'Conductores', 'Estado', 'Fecha'];
    const rows = jobs.map(j => [j.id, j.client, j.brand, j.model, j.plate || j.vin, j.origin, j.destination, j.assignedDrivers?.map(d=>d.name).join(' | '), j.status, new Date(j.createdAt).toLocaleString()]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "reporte.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleSubmitChecklist = async (checklistData) => {
    try {
      await updateDoc(doc(db, 'transport_jobs', selectedJob.id), {
        status: 'completed', completedAt: Date.now(),
        brand: checklistData.brand, model: checklistData.model, vin: checklistData.plateOrVin, plate: checklistData.plateOrVin,
        origin: checklistData.origin, destination: checklistData.destination, checklist: checklistData
      });
      alert("✅ Checklist guardado.\n\nEn producción, esto enviará el PDF y lo subirá a Drive vía Make.com");
      setSelectedJob(null); setCurrentView('main');
    } catch (error) { console.error(error); }
  };

  // --- COMPONENTE INTERNO: Formulario Nuevo Trabajo ---
  const NewJobForm = () => (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold mb-6 border-b pb-2">Crear Nuevo Traslado</h2>
      <form onSubmit={handleCreateJob} className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">1. Cliente y Ruta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select name="client" required className="border p-2 text-sm rounded outline-none"><option value="">Seleccione Cliente...</option>{clients.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <div className="hidden md:block"></div>
            <input name="origin" required type="text" placeholder="Desde (Origen)" className="border p-2 text-sm rounded outline-none" />
            <input name="destination" required type="text" placeholder="Hasta (Destino)" className="border p-2 text-sm rounded outline-none" />
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
           <h3 className="text-sm font-bold text-gray-700">2. Vehículo</h3>
           <div className="grid grid-cols-2 gap-4">
             <input name="brand" type="text" placeholder="Marca" required className="border p-2 text-sm rounded outline-none" />
             <input name="model" type="text" placeholder="Modelo" required className="border p-2 text-sm rounded outline-none" />
             <input name="plateOrVin" type="text" placeholder="Patente o VIN" required className="border p-2 text-sm rounded col-span-2 uppercase outline-none" />
           </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
           <h3 className="text-sm font-bold text-gray-700">3. Conductores (Selección múltiple)</h3>
           <div className="max-h-40 overflow-y-auto border bg-white rounded">
              {drivers.length === 0 ? <p className="text-sm text-gray-500 p-3">No hay conductores creados.</p> : drivers.map(d => (
                <label key={d.id} className="flex items-center p-3 border-b hover:bg-blue-50 cursor-pointer">
                  <input type="checkbox" name="assignedDriverId" value={d.id} className="w-4 h-4 cursor-pointer" />
                  <div className="ml-3"><span className="block text-sm">{d.name}</span><span className="block text-xs text-gray-500">{d.email}</span></div>
                </label>
              ))}
           </div>
        </div>
        <div className="flex justify-end"><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">Guardar y Asignar</button></div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
      {/* HEADER */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2"><Car className="w-6 h-6 text-blue-400" /><h1 className="font-bold text-xl">TranspoCheck</h1></div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-slate-400">Sesión iniciada</p>
            <p className="text-sm font-medium">{currentUserEmail}</p>
          </div>
          <button onClick={() => signOut(auth)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300 transition-colors" title="Cerrar sesión"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {currentView === 'main' && (
        <main className="max-w-5xl mx-auto p-4">
          {isAdmin ? (
            <>
              <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border">
                <button onClick={() => setAdminTab('dashboard')} className={`flex-1 flex justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-gray-600'}`}><ClipboardList className="w-4 h-4"/> Trabajos</button>
                <button onClick={() => setAdminTab('newJob')} className={`flex-1 flex justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-gray-600'}`}><Plus className="w-4 h-4"/> Crear</button>
                <button onClick={() => setAdminTab('drivers')} className={`flex-1 flex justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${adminTab==='drivers'?'bg-blue-100 text-blue-700':'text-gray-600'}`}><Users className="w-4 h-4"/> Conductores</button>
              </div>
              {adminTab === 'dashboard' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Monitor Administrativo</h2><button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2"><Download className="w-4 h-4"/> Exportar</button></div>
                  <JobsList jobs={jobs} isAdmin={isAdmin} onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} />
                </div>
              )}
              {adminTab === 'newJob' && <NewJobForm />}
              {adminTab === 'drivers' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={handleCreateDriver} className="bg-white p-6 rounded-xl shadow-sm border space-y-4"><h3 className="font-bold flex gap-2"><User/> Nuevo Conductor</h3><input name="driverName" placeholder="Nombre completo" required className="w-full border p-2 rounded text-sm outline-none"/><input name="driverEmail" placeholder="Correo Gmail del conductor" required type="email" className="w-full border p-2 rounded text-sm outline-none"/><button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">Crear</button></form>
                  <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-bold mb-4">Directorio</h3><div className="space-y-2">{drivers.length === 0 ? <p className="text-sm text-gray-500">Vacío</p> : drivers.map(d=><div key={d.id} className="p-2 bg-gray-50 border rounded text-sm font-medium">{d.name} <span className="text-xs font-normal text-gray-500 block">{d.email}</span></div>)}</div></div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-blue-900">Mis Trabajos Asignados</h2>
              <JobsList jobs={jobs} isAdmin={isAdmin} onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} db={db} currentUserEmail={currentUserEmail} />
            </div>
          )}
        </main>
      )}

      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4"><ChecklistForm job={selectedJob} onCancel={() => setCurrentView('main')} onSubmit={handleSubmitChecklist} /></main>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: LISTA DE TRABAJOS
// ==========================================
function JobsList({ jobs, isAdmin, onStartChecklist, db, currentUserEmail }) {
  const now = new Date();
  
  // Reglas de Retención (7 Días para conductores, mes en curso para admins)
  const filteredJobs = jobs.filter(job => {
    if (!isAdmin && (!job.assignedEmails?.includes(currentUserEmail))) return false;
    if (!job.createdAt) return true;

    if (!isAdmin) {
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
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text(`Checklist de Traslado`, 105, 20, null, null, "center");
      doc.setFontSize(12); 
      doc.text(`Vehiculo: ${job.brand} ${job.model}`, 20, 40);
      doc.text(`Patente/VIN: ${job.plate || job.vin}`, 20, 50);
      doc.text(`Ruta: ${job.origin} -> ${job.destination}`, 20, 60);
      doc.text(`Receptor: ${job.checklist?.receiverName || 'N/A'}`, 20, 70);
      doc.text(`RUT: ${job.checklist?.receiverRut || 'N/A'}`, 20, 80);
      doc.text(`Observaciones: ${job.checklist?.observations || 'Ninguna'}`, 20, 90);
      if(job.checklist?.signatureData) doc.addImage(job.checklist.signatureData, 'PNG', 20, 100, 80, 40);
      doc.save(`Checklist_${job.plate || job.vin}.pdf`);
    } catch(e) { 
      console.error(e);
      alert("Hubo un error al generar el PDF. Verifica tu conexión a internet."); 
    }
  };

  if (filteredJobs.length === 0) return <div className="text-center py-12 bg-white rounded-xl border"><p className="text-gray-500">No hay trabajos disponibles.</p></div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredJobs.map(job => (
        <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${job.status==='pending'?'bg-yellow-200 text-yellow-800':job.status==='accepted'?'bg-blue-200 text-blue-800':'bg-green-200 text-green-800'}`}>
              {job.status === 'pending' ? 'Pendiente' : job.status === 'accepted' ? 'En Curso' : 'Completado'}
            </span>
            {isAdmin && <button onClick={()=>handleDeleteJob(job.id)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>}
          </div>
          <div className="p-4 flex-1">
            <h3 className="font-bold text-lg leading-tight">{job.brand} {job.model}</h3>
            <div className="mt-2 text-xs text-gray-600 space-y-1 mb-3">
              <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400"/> <span>Desde: {job.origin}</span></div>
              <div className="flex items-center gap-1"><Navigation className="w-3 h-3 text-gray-400"/> <span>Hasta: {job.destination}</span></div>
            </div>
            <div className="text-sm bg-gray-50 p-2 rounded flex justify-between"><span className="text-gray-500">Patente/VIN:</span><span className="font-medium uppercase">{job.plate || job.vin}</span></div>
          </div>
          <div className="p-3 bg-gray-50 border-t space-y-2">
            {job.status === 'pending' && (!isAdmin || job.assignedEmails?.includes(currentUserEmail)) && (
              <button onClick={() => handleAcceptJob(job)} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded transition-colors">Reclamar Traslado</button>
            )}
            {((job.status === 'accepted' && (isAdmin || job.acceptedByEmail === currentUserEmail)) || (job.status !== 'completed' && isAdmin)) && (
              <button onClick={() => onStartChecklist(job)} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded flex justify-center items-center gap-2 transition-colors"><FileText className="w-4 h-4" /> Llenar Checklist</button>
            )}
            {job.status === 'completed' && (
              <button onClick={() => generatePDF(job)} className="w-full bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium py-2 rounded flex justify-center items-center gap-2 transition-colors"><FileDown className="w-4 h-4"/> Descargar PDF</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// COMPONENTE: FORMULARIO DE CHECKLIST
// ==========================================
function ChecklistForm({ job, onCancel, onSubmit }) {
  const [step, setStep] = useState(1);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [formData, setFormData] = useState({
    brand: job.brand || '', model: job.model || '', plateOrVin: job.plate || job.vin || '',
    origin: job.origin || '', destination: job.destination || '', fuelLevel: 50, 
    photos: { front: false, driver: false, passenger: false, back: false, tire: false, dashboard: false, det1: false, det2: false, det3: false, det4: false },
    observations: '', receiverName: '', receiverCompany: '', receiverRut: '', receiverEmail: '', signatureData: null, location: null
  });

  const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleGetLocation = () => {
    setLoadingLoc(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { updateForm('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoadingLoc(false); },
        () => { alert("Error GPS."); setLoadingLoc(false); }
      );
    }
  };

  const submitForm = (e) => { 
    e.preventDefault(); 
    if (!formData.signatureData) return alert("Firma obligatoria."); 
    onSubmit(formData); 
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center"><h2 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /> Checklist</h2><button onClick={onCancel} className="text-slate-300 text-sm hover:text-white">Cancelar</button></div>
      <div className="flex bg-slate-100 h-1"><div className={`bg-blue-500 transition-all ${step === 1 ? 'w-1/2' : 'w-full'}`}></div></div>
      <div className="p-4 sm:p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-bold border-b pb-2">Datos Modificables</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <input value={formData.brand} onChange={e=>updateForm('brand', e.target.value)} className="border p-2 rounded outline-none focus:border-blue-500" placeholder="Marca"/>
              <input value={formData.model} onChange={e=>updateForm('model', e.target.value)} className="border p-2 rounded outline-none focus:border-blue-500" placeholder="Modelo"/>
              <input value={formData.plateOrVin} onChange={e=>updateForm('plateOrVin', e.target.value)} className="col-span-2 border p-2 rounded uppercase outline-none focus:border-blue-500" placeholder="Patente/VIN"/>
              <input value={formData.origin} onChange={e=>updateForm('origin', e.target.value)} className="col-span-2 border p-2 rounded outline-none focus:border-blue-500" placeholder="Desde"/>
              <input value={formData.destination} onChange={e=>updateForm('destination', e.target.value)} className="col-span-2 border p-2 rounded outline-none focus:border-blue-500" placeholder="Hasta"/>
            </div>
            
            <h3 className="font-bold border-b pb-2 mt-4">10 Fotografías (Tocar para marcar)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                {id:'front', l:'Frente'}, {id:'driver', l:'Piloto'}, {id:'passenger', l:'Copiloto'}, {id:'back', l:'Atrás'}, 
                {id:'tire', l:'Repuesto'}, {id:'dashboard', l:'Tablero'}, {id:'det1', l:'Detalle 1'}, {id:'det2', l:'Detalle 2'}, {id:'det3', l:'Detalle 3'}, {id:'det4', l:'Detalle 4'}
              ].map(p => (
                <button key={p.id} onClick={() => updateForm('photos', {...formData.photos, [p.id]: !formData.photos[p.id]})} className={`p-2 border rounded flex flex-col items-center justify-center gap-1 transition-colors ${formData.photos[p.id] ? 'bg-green-50 border-green-500' : 'border-dashed border-gray-300'}`}>
                  {formData.photos[p.id] ? <CheckCircle className="text-green-600 w-4 h-4"/> : <Camera className="text-gray-400 w-4 h-4"/>}
                  <span className="text-[9px] font-medium text-center">{p.l}</span>
                </button>
              ))}
            </div>

            <h3 className="font-bold border-b pb-2 mt-4">Combustible: {formData.fuelLevel}%</h3>
            <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={(e) => updateForm('fuelLevel', e.target.value)} className="w-full accent-blue-600" />
            
            <textarea rows="3" value={formData.observations} onChange={(e) => updateForm('observations', e.target.value)} placeholder="Observaciones de daños o detalles..." className="w-full border p-2 text-sm outline-none focus:border-blue-500 rounded"></textarea>
            
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors">Continuar</button>
          </div>
        )}
        
        {step === 2 && (
          <form onSubmit={submitForm} className="space-y-5">
            <h3 className="font-bold border-b pb-2">Receptor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input required value={formData.receiverName} onChange={e=>updateForm('receiverName', e.target.value)} className="border p-2 rounded outline-none focus:border-blue-500" placeholder="Nombre completo" />
              <input required value={formData.receiverRut} onChange={e=>updateForm('receiverRut', e.target.value)} className="border p-2 rounded outline-none focus:border-blue-500" placeholder="RUT" />
              <input required type="email" value={formData.receiverEmail} onChange={e=>updateForm('receiverEmail', e.target.value)} className="border p-2 rounded col-span-1 sm:col-span-2 outline-none focus:border-blue-500" placeholder="Correo electrónico del receptor" />
            </div>
            
            <button type="button" onClick={handleGetLocation} className="bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded text-sm w-full font-medium transition-colors">
              {formData.location ? "GPS Capturado ✅" : "Capturar GPS de Entrega"}
            </button>
            
            <h3 className="font-bold border-b pb-2 mt-4">Firma</h3>
            <SignaturePad onSave={(data) => updateForm('signatureData', data)} onClear={() => updateForm('signatureData', null)} />
            
            <div className="flex gap-3 pt-4 border-t mt-4">
              <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-3 rounded-lg font-medium transition-colors">Atrás</button>
              <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition-colors">Finalizar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}