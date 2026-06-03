import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { 
  Car, MapPin, Camera, Fuel, PenTool, CheckCircle, FileText, Download, 
  Plus, User, Building, Hash, Navigation, AlertCircle, Users, ClipboardList
} from 'lucide-react';

// --- CONFIGURACIÓN DE ACCESOS ---
const ADMIN_EMAILS = [
  "fcastro@logisticats.cl", 
  "hcastro@logisticats.cl"
];

// --- DATOS MAESTROS INICIALES ---
const INICIAL_CLIENTES = ["AutoMundo S.A.", "RentACar Pacific", "Logística Express", "Particular"];
const INICIAL_MARCAS = ["Toyota", "Chevrolet", "Ford", "Nissan", "Hyundai", "Kia", "Suzuki"];
const INICIAL_MODELOS = {
  "Toyota": ["Yaris", "Corolla", "Hilux", "RAV4"],
  "Chevrolet": ["Spark", "Sail", "Tracker", "Colorado", "NKR 612", "NKR "],
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
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (onSave && canvasRef.current) {
      onSave(canvasRef.current.toDataURL());
    }
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
        ref={canvasRef}
        width={300}
        height={150}
        className="w-full h-[150px] touch-none cursor-crosshair bg-white"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerOut={stopDrawing}
      />
      <button 
        type="button" 
        onClick={clearCanvas}
        className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
      >
        Limpiar firma
      </button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  
  // INICIAMOS CON UN CORREO ADMIN PARA VER EL PANEL INMEDIATAMENTE
  const [currentUserEmail, setCurrentUserEmail] = useState('fcastro@logisticats.cl');
  
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');

  const [clients] = useState(INICIAL_CLIENTES);
  const [brands] = useState(INICIAL_MARCAS);
  const [modelsDict] = useState(INICIAL_MODELOS);

  // EVALUADOR DE ROL (¿El correo actual está en la lista de administradores?)
  const isAdmin = ADMIN_EMAILS.includes(currentUserEmail.toLowerCase());

  // Autenticación inicial 
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Escuchar Trabajos y Conductores
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

    return () => {
      unsubJobs();
      unsubDrivers();
    };
  }, [user]);

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
    } catch (error) {
      console.error("Error creando conductor:", error);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedDriverId = formData.get('assignedDriverId');
    
    if (!selectedDriverId) {
      alert("Debes seleccionar un conductor.");
      return;
    }

    const assignedDriver = drivers.find(d => d.id === selectedDriverId);

    const newJob = {
      client: formData.get('client'),
      brand: formData.get('brand'),
      model: formData.get('model'),
      vin: formData.get('vin'),
      plate: formData.get('plate'),
      origin: formData.get('origin'),
      destination: formData.get('destination'),
      assignedDriverId: assignedDriver.id,
      assignedDriverName: assignedDriver.name,
      assignedEmail: assignedDriver.email, 
      status: 'pending',
      createdAt: Date.now(),
      checklist: null
    };

    try {
      await addDoc(collection(db, 'transport_jobs'), newJob);
      setAdminTab('dashboard');
      alert(`Trabajo creado y asignado a ${assignedDriver.name}.`);
    } catch (error) {
      console.error("Error creando trabajo:", error);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Cliente', 'Marca', 'Modelo', 'VIN/Patente', 'Desde', 'Hasta', 'Conductor', 'Estado', 'Fecha'];
    const rows = jobs.map(job => [
      job.id,
      job.client || 'N/A',
      job.brand,
      job.model,
      job.plate || job.vin,
      job.origin || 'N/A',
      job.destination || 'N/A',
      job.assignedDriverName || 'N/A',
      job.status,
      new Date(job.createdAt).toLocaleString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "movimientos_historicos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FUNCIONES COMUNES (Checklist) ---
  const handleStartChecklist = (job) => {
    setSelectedJob(job);
    setCurrentView('checklist');
  };

  const handleSubmitChecklist = async (checklistData) => {
    try {
      const jobRef = doc(db, 'transport_jobs', selectedJob.id);
      await updateDoc(jobRef, {
        status: 'completed',
        completedAt: Date.now(),
        checklist: checklistData
      });
      alert("Checklist completado y guardado.");
      setSelectedJob(null);
      setCurrentView('main');
    } catch (error) {
      console.error("Error guardando checklist:", error);
    }
  };

  // --- COMPONENTE DE FORMULARIO DE TRABAJO ---
  const NewJobForm = () => {
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedDriver, setSelectedDriver] = useState('');

    const availableModels = selectedBrand && modelsDict[selectedBrand] ? modelsDict[selectedBrand] : [];

    return (
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-6 border-b pb-2">Crear Nuevo Traslado</h2>
        <form onSubmit={handleCreateJob} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">1. Cliente y Ruta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                <select name="client" required className="w-full border-gray-300 rounded p-2 text-sm outline-none border focus:border-blue-500">
                  <option value="">Seleccione Cliente...</option>
                  {clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="hidden md:block"></div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde (Origen)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input name="origin" required type="text" placeholder="Ej: Puerto Valparaíso" className="w-full border-gray-300 rounded pl-8 p-2 text-sm outline-none border focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta (Destino)</label>
                <div className="relative">
                  <Navigation className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input name="destination" required type="text" placeholder="Ej: Sucursal Santiago" className="w-full border-gray-300 rounded pl-8 p-2 text-sm outline-none border focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
             <h3 className="text-sm font-bold text-gray-700">2. Datos del Vehículo</h3>
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
                  <select name="brand" required value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full border-gray-300 rounded p-2 text-sm outline-none border focus:border-blue-500">
                    <option value="">Seleccione...</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Modelo</label>
                  <select name="model" required className="w-full border-gray-300 rounded p-2 text-sm outline-none border focus:border-blue-500">
                    <option value="">Seleccione...</option>
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value="OTRO">Otro</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Patente</label>
                  <input name="plate" type="text" className="w-full border-gray-300 rounded p-2 text-sm outline-none border focus:border-blue-500 uppercase" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">VIN</label>
                  <input name="vin" required type="text" className="w-full border-gray-300 rounded p-2 text-sm outline-none border focus:border-blue-500 uppercase" />
               </div>
             </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100">
             <div className="flex justify-between items-center">
               <h3 className="text-sm font-bold text-gray-700">3. Asignación de Conductor</h3>
               {drivers.length === 0 && <span className="text-xs text-red-500">No hay conductores creados.</span>}
             </div>
             <div className="max-h-40 overflow-y-auto border border-gray-200 rounded bg-white">
                {drivers.map(driver => (
                  <label key={driver.id} className={`flex items-center p-3 border-b hover:bg-blue-50 cursor-pointer ${selectedDriver === driver.id ? 'bg-blue-50' : ''}`}>
                    <input type="radio" name="assignedDriverId" value={driver.id} required onChange={() => setSelectedDriver(driver.id)} className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900">{driver.name}</span>
                      <span className="block text-xs text-gray-500">{driver.email}</span>
                    </div>
                  </label>
                ))}
             </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-sm">
              Guardar y Asignar
            </button>
          </div>
        </form>
      </div>
    );
  };

  if (!user) return <div className="flex h-screen items-center justify-center">Cargando sistema...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20 md:pb-0">
      <header className="bg-slate-900 text-white p-4 shadow-md flex flex-wrap justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2 mb-2 sm:mb-0">
          <Car className="w-6 h-6 text-blue-400" />
          <h1 className="font-bold text-xl tracking-tight">TranspoCheck</h1>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end text-sm bg-slate-800 p-2 rounded-lg">
          {/* SIMULADOR DE CORREO: Permite cambiar entre admin y conductor */}
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase">Simular Login de:</span>
            <input 
              type="email" 
              value={currentUserEmail}
              onChange={(e) => {
                setCurrentUserEmail(e.target.value);
                setCurrentView('main');
              }}
              className="bg-transparent text-white outline-none border-b border-slate-600 w-44 text-xs focus:border-blue-400 pb-1"
            />
          </div>
          
          {/* INDICADOR DE ROL AUTOMÁTICO */}
          <div className="flex items-center gap-2 border-l border-slate-600 pl-4">
            <span className={`px-3 py-1 rounded text-xs font-bold shadow-sm ${isAdmin ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}`}>
              {isAdmin ? 'Administrador' : 'Conductor'}
            </span>
          </div>
        </div>
      </header>

      {currentView === 'main' && (
        <main className="max-w-5xl mx-auto p-4">
          
          {/* VISTA DE ADMINISTRADOR */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
              <button onClick={() => setAdminTab('dashboard')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${adminTab === 'dashboard' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}><ClipboardList className="w-4 h-4"/> Trabajos</button>
              <button onClick={() => setAdminTab('newJob')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${adminTab === 'newJob' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}><Plus className="w-4 h-4"/> Crear Trabajo</button>
              <button onClick={() => setAdminTab('drivers')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${adminTab === 'drivers' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}><Users className="w-4 h-4"/> Conductores</button>
            </div>
          )}

          {isAdmin && adminTab === 'dashboard' && (
             <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-purple-900">Monitor de Traslados (Admin)</h2>
                  <button onClick={exportToCSV} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition">
                    <Download className="w-4 h-4" /> Exportar CSV
                  </button>
                </div>
                <JobsList jobs={jobs} role="admin" onStartChecklist={handleStartChecklist} db={db} />
             </div>
          )}

          {isAdmin && adminTab === 'newJob' && <NewJobForm />}

          {isAdmin && adminTab === 'drivers' && (
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-900"><User className="w-5 h-5"/> Registrar Conductor</h3>
                <form onSubmit={handleCreateDriver} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                    <input name="driverName" required type="text" className="w-full border-gray-300 rounded p-2 text-sm outline-none border focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Correo (Gmail)</label>
                    <input name="driverEmail" required type="email" className="w-full border-gray-300 rounded p-2 text-sm outline-none border focus:border-blue-500" />
                  </div>
                  <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition">Crear Conductor</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-4 text-purple-900">Directorio ({drivers.length})</h3>
                <div className="space-y-3">
                  {drivers.length === 0 ? <p className="text-sm text-gray-500">No hay conductores.</p> : 
                    drivers.map(driver => (
                      <div key={driver.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                        <div className="bg-purple-100 text-purple-600 p-2 rounded-full"><User className="w-4 h-4"/></div>
                        <div>
                          <p className="font-medium text-sm">{driver.name}</p>
                          <p className="text-xs text-gray-500">{driver.email}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* VISTA DE CONDUCTOR */}
          {!isAdmin && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-blue-900"><ClipboardList className="w-5 h-5"/> Mis Trabajos Asignados</h2>
              <JobsList 
                jobs={jobs.filter(job => job.assignedEmail === currentUserEmail.toLowerCase())} 
                role="driver" 
                onStartChecklist={handleStartChecklist} 
                db={db} 
              />
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

function JobsList({ jobs, role, onStartChecklist, db }) {
  const handleAcceptJob = async (job) => {
    try {
      await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'accepted' });
    } catch (error) {
      console.error("Error aceptando trabajo:", error);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No hay trabajos en lista.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {jobs.map(job => (
        <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${job.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : job.status === 'accepted' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'}`}>
              {job.status === 'pending' ? 'Pendiente' : job.status === 'accepted' ? 'En Curso' : 'Completado'}
            </span>
          </div>
          <div className="p-4 flex-1">
            <h3 className="font-bold text-lg leading-tight">{job.brand} {job.model}</h3>
            <p className="text-xs text-gray-500 mb-3">{job.client}</p>
            <div className="text-sm text-gray-600 space-y-1.5 bg-gray-50 p-2 rounded">
              <div className="flex justify-between"><span className="text-gray-400">Patente:</span> <span className="font-medium">{job.plate || 'S/N'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">VIN:</span> <span className="font-mono text-xs">{job.vin}</span></div>
            </div>
            {role === 'admin' && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
                <span className="text-gray-500">Conductor: </span><span className="font-medium text-blue-700">{job.assignedDriverName}</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-gray-50 border-t border-gray-100">
            {job.status === 'pending' && role === 'driver' && (
              <button onClick={() => handleAcceptJob(job)} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded transition">Aceptar Traslado</button>
            )}
            {((job.status === 'accepted' && role === 'driver') || (job.status !== 'completed' && role === 'admin')) && (
              <button onClick={() => onStartChecklist(job)} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded transition flex justify-center items-center gap-2"><FileText className="w-4 h-4" /> Hacer Checklist</button>
            )}
            {job.status === 'completed' && (
              <div className="text-sm text-green-700 flex items-center justify-center gap-1 bg-green-100 p-2 rounded"><CheckCircle className="w-4 h-4" /> Entregado</div>
            )}
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
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => { updateForm('location', { lat: position.coords.latitude, lng: position.coords.longitude }); setLoadingLoc(false); },
        (error) => { alert("Error GPS."); setLoadingLoc(false); }
      );
    } else { alert("GPS no soportado."); setLoadingLoc(false); }
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (!formData.signatureData) { alert("Firma obligatoria."); return; }
    onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /> Checklist</h2>
        <button onClick={onCancel} className="text-slate-300 hover:text-white text-sm">Cancelar</button>
      </div>
      <div className="flex bg-slate-100 h-1"><div className={`bg-blue-500 ${step === 1 ? 'w-1/2' : 'w-full'}`}></div></div>
      <div className="p-4 sm:p-6">
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-md font-bold border-b pb-2 flex items-center gap-2"><Camera className="w-4 h-4"/> Fotos</h3>
            <div className="grid grid-cols-2 gap-3">
              {['front', 'left', 'right', 'back'].map((side) => (
                <button key={side} onClick={() => updateForm('photos', { ...formData.photos, [side]: !formData.photos[side] })} className={`p-3 border rounded-lg ${formData.photos[side] ? 'border-green-500 bg-green-50' : 'border-dashed'}`}>
                  {formData.photos[side] ? <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-600" /> : <Camera className="w-6 h-6 mx-auto mb-1 text-gray-400" />}
                </button>
              ))}
            </div>
            <h3 className="text-md font-bold border-b pb-2 flex items-center gap-2 mt-6"><Fuel className="w-4 h-4"/> Combustible: {formData.fuelLevel}%</h3>
            <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={(e) => updateForm('fuelLevel', e.target.value)} className="w-full" />
            <textarea rows="3" value={formData.observations} onChange={(e) => updateForm('observations', e.target.value)} placeholder="Observaciones..." className="w-full border-gray-300 rounded-lg p-2 text-sm border outline-none"></textarea>
            <button onClick={() => setStep(2)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium">Continuar</button>
          </div>
        )}
        {step === 2 && (
          <form onSubmit={submitForm} className="space-y-5">
            <h3 className="text-md font-bold border-b pb-2">Receptor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input required type="text" value={formData.receiverName} onChange={e => updateForm('receiverName', e.target.value)} className="w-full border p-2 rounded" placeholder="Nombre" />
              <input required type="text" value={formData.receiverRut} onChange={e => updateForm('receiverRut', e.target.value)} className="w-full border p-2 rounded" placeholder="RUT" />
              <input required type="email" value={formData.receiverEmail} onChange={e => updateForm('receiverEmail', e.target.value)} className="w-full border p-2 rounded" placeholder="Correo" />
            </div>
            <h3 className="text-md font-bold border-b pb-2 mt-4">Ubicación</h3>
            <button type="button" onClick={handleGetLocation} className="bg-slate-200 px-3 py-1.5 rounded text-sm w-full">{formData.location ? "GPS Capturado ✅" : "Capturar GPS"}</button>
            <h3 className="text-md font-bold border-b pb-2 mt-4">Firma</h3>
            <SignaturePad onSave={(data) => updateForm('signatureData', data)} onClear={() => updateForm('signatureData', null)} />
            <div className="flex gap-3 pt-4 border-t mt-4">
              <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-100 py-3 rounded-lg">Atrás</button>
              <button type="submit" className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold">Finalizar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}