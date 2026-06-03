import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { collection, addDoc, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { 
  Car, MapPin, Camera, Fuel, PenTool, CheckCircle, FileText, Download, 
  Plus, User, Building, Hash, Navigation, AlertCircle, Users, ClipboardList, LogOut
} from 'lucide-react';

// --- CONFIGURACIÓN DE ACCESOS SEGURA ---
const ADMIN_EMAILS = [
  "fcastro@logisticats.cl", 
  "hcastro@logisticats.cl"
];

// --- DATOS MAESTROS INICIALES ---
const INICIAL_CLIENTES = ["Grandleasing", "Kovacs", "Salfa", "Particular"];
const INICIAL_MARCAS = ["Toyota", "Chevrolet", "Ford", "Nissan", "Hyundai", "Kia", "Suzuki"];
const INICIAL_MODELOS = {
  "Toyota": ["Yaris", "Corolla", "Hilux", "RAV4"],
  "Chevrolet": ["Spark", "Sail", "Tracker", "Colorado"],
  "Nissan": ["Versa", "Sentra", "Navara", "X-Trail"]
};

// --- COMPONENTE DE FIRMA (Canvas HTML5) ---
const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    ctx.lineTo(x, y); ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (onSave && canvasRef.current) onSave(canvasRef.current.toDataURL());
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (onClear) onClear();
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
      <canvas
        ref={canvasRef} width={300} height={150}
        className="w-full h-[150px] touch-none cursor-crosshair bg-white"
        onPointerDown={startDrawing} onPointerMove={draw}
        onPointerUp={stopDrawing} onPointerOut={stopDrawing}
      />
      <button type="button" onClick={clearCanvas} className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium">Limpiar firma</button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');

  const [clients] = useState(INICIAL_CLIENTES);
  const [brands] = useState(INICIAL_MARCAS);
  const [modelsDict] = useState(INICIAL_MODELOS);

  // Escuchar estado de autenticación (Inicio de sesión real)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Escuchar base de datos (solo si hay usuario)
  useEffect(() => {
    if (!user) return;
    const jobsRef = collection(db, 'transport_jobs');
    const driversRef = collection(db, 'drivers');
    
    const unsubJobs = onSnapshot(jobsRef, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      jobsData.sort((a, b) => b.createdAt - a.createdAt);
      setJobs(jobsData);
    });

    const unsubDrivers = onSnapshot(driversRef, (snapshot) => {
      const driversData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDrivers(driversData);
    });

    return () => { unsubJobs(); unsubDrivers(); };
  }, [user]);

  // FUNCIONES DE AUTENTICACIÓN GOOGLE
  const loginConGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error en login:", error);
      alert("Hubo un error al iniciar sesión.");
    }
  };

  const logout = async () => {
    try { await signOut(auth); } catch (error) { console.error(error); }
  };

  // VARIABLES DE USUARIO ACTUAL
  const currentUserEmail = user?.email || "";
  const isAdmin = ADMIN_EMAILS.includes(currentUserEmail.toLowerCase());

  // --- PANTALLA DE CARGA ---
  if (authLoading) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 font-medium">Conectando...</div>;

  // --- PANTALLA DE LOGIN ---
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">TranspoCheck</h1>
          <p className="text-gray-500 text-sm mb-8">Sistema de gestión y checklist de traslados.</p>
          <button 
            onClick={loginConGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  // --- FUNCIONES DE ADMINISTRADOR ---
  const handleCreateDriver = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newDriver = {
      name: formData.get('driverName'),
      email: formData.get('driverEmail').toLowerCase(),
      createdAt: Date.now()
    };
    try {
      await addDoc(collection(db, 'drivers'), newDriver);
      e.target.reset();
      alert("Conductor creado exitosamente.");
    } catch (error) { console.error("Error creando conductor:", error); }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedDriverId = formData.get('assignedDriverId');
    if (!selectedDriverId) return alert("Debes seleccionar un conductor.");

    const assignedDriver = drivers.find(d => d.id === selectedDriverId);
    const newJob = {
      client: formData.get('client'), brand: formData.get('brand'), model: formData.get('model'),
      vin: formData.get('plateOrVin'), plate: formData.get('plateOrVin'), origin: formData.get('origin'),
      destination: formData.get('destination'), assignedDriverId: assignedDriver.id,
      assignedDriverName: assignedDriver.name, assignedEmail: assignedDriver.email, 
      status: 'pending', createdAt: Date.now(), checklist: null
    };

    try {
      await addDoc(collection(db, 'transport_jobs'), newJob);
      setAdminTab('dashboard');
      alert(`Trabajo creado y asignado a ${assignedDriver.name}.`);
    } catch (error) { console.error("Error:", error); }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Desde', 'Hasta', 'Conductor', 'Estado', 'Fecha'];
    const rows = jobs.map(job => [
      job.id, job.client || 'N/A', job.brand, job.model, job.plate || job.vin,
      job.origin || 'N/A', job.destination || 'N/A', job.assignedDriverName || 'N/A',
      job.status, new Date(job.createdAt).toLocaleString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "movimientos_historicos.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleStartChecklist = (job) => { setSelectedJob(job); setCurrentView('checklist'); };

  const handleSubmitChecklist = async (checklistData) => {
    try {
      await updateDoc(doc(db, 'transport_jobs', selectedJob.id), {
        status: 'completed', completedAt: Date.now(), checklist: checklistData
      });
      alert("Checklist completado y guardado.");
      setSelectedJob(null); setCurrentView('main');
    } catch (error) { console.error("Error:", error); }
  };

  const NewJobForm = () => {
    const [selectedDriver, setSelectedDriver] = useState('');

    return (
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-6 border-b pb-2">Crear Nuevo Traslado</h2>
        <form onSubmit={handleCreateJob} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">1. Cliente y Ruta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                <select name="client" required className="w-full border-gray-300 rounded p-2 text-sm border">
                  <option value="">Seleccione Cliente...</option>
                  {clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="hidden md:block"></div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde (Origen)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input name="origin" required type="text" className="w-full rounded pl-8 p-2 text-sm border" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta (Destino)</label>
                <div className="relative">
                  <Navigation className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input name="destination" required type="text" className="w-full rounded pl-8 p-2 text-sm border" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
             <h3 className="text-sm font-bold text-gray-700">2. Vehículo</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
                  <input name="brand" required type="text" placeholder="Ej: Toyota" className="w-full border p-2 text-sm rounded" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Modelo</label>
                  <input name="model" required type="text" placeholder="Ej: Yaris" className="w-full border p-2 text-sm rounded" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Patente o VIN</label>
                  <input name="plateOrVin" required type="text" placeholder="Ej: ABCD12 o Chasis" className="w-full border p-2 text-sm rounded uppercase" />
               </div>
             </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
             <h3 className="text-sm font-bold text-gray-700">3. Conductor</h3>
             <div className="max-h-40 overflow-y-auto border bg-white rounded">
                {drivers.map(driver => (
                  <label key={driver.id} className="flex items-center p-3 border-b hover:bg-blue-50 cursor-pointer">
                    <input type="radio" name="assignedDriverId" value={driver.id} required onChange={() => setSelectedDriver(driver.id)} className="w-4 h-4 cursor-pointer" />
                    <div className="ml-3"><span className="block text-sm font-medium">{driver.name}</span><span className="block text-xs text-gray-500">{driver.email}</span></div>
                  </label>
                ))}
             </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">Guardar y Asignar</button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20 md:pb-0">
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Car className="w-6 h-6 text-blue-400" />
          <h1 className="font-bold text-xl tracking-tight hidden sm:block">TranspoCheck</h1>
        </div>
        <div className="flex items-center gap-4 bg-slate-800 p-1.5 px-3 rounded-lg">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">
              {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Usuario')}
            </span>
            <span className={`text-[10px] font-bold uppercase ${isAdmin ? 'text-purple-400' : 'text-blue-400'}`}>
              {isAdmin ? 'Administrador' : 'Conductor'}
            </span>
          </div>
          <img src={user?.photoURL || 'https://via.placeholder.com/150'} alt="Perfil" className="w-8 h-8 rounded-full border border-slate-600" />
          <button onClick={logout} className="ml-2 p-2 hover:bg-slate-700 rounded transition text-red-400" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {currentView === 'main' && (
        <main className="max-w-5xl mx-auto p-4">
          {isAdmin && (
            <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border overflow-x-auto">
              <button onClick={() => setAdminTab('dashboard')} className={`flex-1 flex justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${adminTab === 'dashboard' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}><ClipboardList className="w-4 h-4"/> Trabajos</button>
              <button onClick={() => setAdminTab('newJob')} className={`flex-1 flex justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${adminTab === 'newJob' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}><Plus className="w-4 h-4"/> Crear</button>
              <button onClick={() => setAdminTab('drivers')} className={`flex-1 flex justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${adminTab === 'drivers' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}><Users className="w-4 h-4"/> Conductores</button>
            </div>
          )}

          {isAdmin && adminTab === 'dashboard' && (
             <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-purple-900">Monitor (Admin)</h2>
                  <button onClick={exportToCSV} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"><Download className="w-4 h-4" /> Exportar</button>
                </div>
                <JobsList jobs={jobs} role="admin" onStartChecklist={handleStartChecklist} db={db} currentUserEmail={currentUserEmail} />
             </div>
          )}

          {isAdmin && adminTab === 'newJob' && <NewJobForm />}

          {isAdmin && adminTab === 'drivers' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-900"><User className="w-5 h-5"/> Registrar</h3>
                <form onSubmit={handleCreateDriver} className="space-y-4">
                  <input name="driverName" required type="text" placeholder="Nombre completo" className="w-full border rounded p-2 text-sm" />
                  <input name="driverEmail" required type="email" placeholder="Correo (Gmail)" className="w-full border rounded p-2 text-sm" />
                  <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded">Crear Conductor</button>
                </form>
              </div>
              <div className="bg-white p-6 rounded-xl border">
                <h3 className="text-lg font-bold mb-4">Directorio</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {drivers.map(driver => (
                    <div key={driver.id} className="flex items-center gap-3 p-2 bg-gray-50 border rounded"><User className="w-4 h-4 text-purple-600"/><div><p className="text-sm font-medium">{driver.name}</p><p className="text-xs text-gray-500">{driver.email}</p></div></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isAdmin && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-blue-900">Mis Trabajos</h2>
              <JobsList jobs={jobs.filter(job => job.assignedEmail === currentUserEmail)} role="driver" onStartChecklist={handleStartChecklist} db={db} currentUserEmail={currentUserEmail} />
            </div>
          )}
        </main>
      )}

      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4">
          <ChecklistForm job={selectedJob} onCancel={() => setCurrentView('main')} onSubmit={handleSubmitChecklist} />
        </main>
      )}
    </div>
  );
}

function JobsList({ jobs, role, onStartChecklist, db, currentUserEmail }) {
  const handleAcceptJob = async (job) => {
    try { await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'accepted' }); } 
    catch (error) { console.error(error); }
  };

  if (jobs.length === 0) return <div className="text-center py-12 bg-white rounded-xl border"><AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay trabajos.</p></div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {jobs.map(job => (
        <div key={job.id} className="bg-white rounded-xl shadow-sm border flex flex-col">
          <div className="bg-gray-50 px-4 py-2 border-b flex justify-between">
            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${job.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : job.status === 'accepted' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'}`}>{job.status === 'pending' ? 'Pendiente' : job.status === 'accepted' ? 'En Curso' : 'Completado'}</span>
          </div>
          <div className="p-4 flex-1">
            <h3 className="font-bold text-lg leading-tight">{job.brand} {job.model}</h3>
            <p className="text-xs text-gray-500 mb-2">{job.client}</p>
            <div className="text-sm bg-gray-50 p-2 rounded">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Patente/VIN:</span> 
                <span className="font-medium bg-white px-2 py-0.5 border rounded uppercase">{job.plate || job.vin || 'S/N'}</span>
              </div>
            </div>
            {role === 'admin' && <div className="mt-2 text-xs"><span>Conductor: </span><span className="font-medium text-blue-700">{job.assignedDriverName}</span></div>}
          </div>
          <div className="p-3 bg-gray-50 border-t">
            {job.status === 'pending' && (role === 'driver' || job.assignedEmail === currentUserEmail) && (
              <button onClick={() => handleAcceptJob(job)} className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded">Aceptar Traslado</button>
            )}
            {((job.status === 'accepted' && (role === 'driver' || job.assignedEmail === currentUserEmail)) || (job.status !== 'completed' && role === 'admin')) && (
              <button onClick={() => onStartChecklist(job)} className="w-full bg-green-600 text-white text-sm font-medium py-2 rounded flex justify-center items-center gap-2"><FileText className="w-4 h-4" /> Hacer Checklist</button>
            )}
            {job.status === 'completed' && <div className="text-sm text-green-700 flex items-center justify-center gap-1 bg-green-100 p-2 rounded"><CheckCircle className="w-4 h-4" /> Entregado</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChecklistForm({ job, onCancel, onSubmit }) {
  const [step, setStep] = useState(1);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [formData, setFormData] = useState({
    fuelLevel: 50, photos: { front: false, left: false, right: false, back: false },
    observations: '', receiverName: '', receiverCompany: '', receiverRut: '', receiverEmail: '',
    signatureData: null, location: null
  });

  const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const handleGetLocation = () => {
    setLoadingLoc(true);
    if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(
      (pos) => { updateForm('location', { lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoadingLoc(false); },
      (err) => { alert("Error GPS."); setLoadingLoc(false); }
    ); else { alert("GPS no soportado."); setLoadingLoc(false); }
  };

  const submitForm = (e) => { e.preventDefault(); if (!formData.signatureData) return alert("Firma obligatoria."); onSubmit(formData); };

  return (
    <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /> Checklist</h2>
        <button onClick={onCancel} className="text-sm text-slate-300">Cancelar</button>
      </div>
      <div className="p-4">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-bold border-b pb-2">Fotos</h3>
            <div className="grid grid-cols-2 gap-2">
              {['front', 'left', 'right', 'back'].map(side => (
                <button key={side} onClick={() => updateForm('photos', { ...formData.photos, [side]: !formData.photos[side] })} className={`p-3 border rounded ${formData.photos[side] ? 'bg-green-50 border-green-500' : 'border-dashed'}`}>{formData.photos[side] ? <CheckCircle className="mx-auto text-green-600"/> : <Camera className="mx-auto text-gray-400"/>}</button>
              ))}
            </div>
            <h3 className="font-bold border-b pb-2 mt-4">Combustible: {formData.fuelLevel}%</h3>
            <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={(e) => updateForm('fuelLevel', e.target.value)} className="w-full" />
            <textarea rows="3" value={formData.observations} onChange={(e) => updateForm('observations', e.target.value)} placeholder="Observaciones..." className="w-full border rounded p-2 text-sm mt-2"></textarea>
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 text-white py-3 rounded mt-2">Continuar</button>
          </div>
        )}
        {step === 2 && (
          <form onSubmit={submitForm} className="space-y-4">
            <h3 className="font-bold border-b pb-2">Receptor</h3>
            <input required type="text" value={formData.receiverName} onChange={e => updateForm('receiverName', e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Nombre" />
            <input required type="text" value={formData.receiverRut} onChange={e => updateForm('receiverRut', e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="RUT" />
            <input required type="email" value={formData.receiverEmail} onChange={e => updateForm('receiverEmail', e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Correo" />
            
            <h3 className="font-bold border-b pb-2 mt-2">GPS</h3>
            <button type="button" onClick={handleGetLocation} className="bg-slate-200 px-3 py-2 rounded text-sm w-full">{formData.location ? "GPS Capturado ✅" : "Capturar GPS"}</button>
            
            <h3 className="font-bold border-b pb-2 mt-2">Firma</h3>
            <SignaturePad onSave={(data) => updateForm('signatureData', data)} onClear={() => updateForm('signatureData', null)} />
            
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-100 py-3 rounded">Atrás</button>
              <button type="submit" className="flex-1 bg-green-600 text-white py-3 rounded font-bold">Finalizar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}