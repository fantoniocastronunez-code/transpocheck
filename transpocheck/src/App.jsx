import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, useSearchParams, useNavigate } from 'react-router-dom';
import { signOut, signInWithPopup } from 'firebase/auth';
import { doc, updateDoc, setDoc, deleteField, onSnapshot } from 'firebase/firestore';

import { 
  Car, MapPin, Camera, CheckCircle, FileText, Download, Plus, User, Navigation, 
  AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, 
  Zap, Edit2, Bell, Share2, X, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, 
  XCircle, Trophy, Eye, Clock, Save, Search, CloudOff, Wifi, QrCode, Sun, Moon, 
  Settings, ChevronUp, ChevronDown, ChevronRight, Fuel, Megaphone, Star, ShieldCheck
} from 'lucide-react';

import SignaturePad from './components/ui/SignaturePad';
import CustomClientSelector from './components/ui/CustomClientSelector';
import LicensePlateBadge from './components/ui/LicensePlateBadge';
import VehicleShapeIcon from './components/ui/VehicleShapeIcon';
import SwipeButton from './components/ui/SwipeButton';
import WaitTimerBadge from './components/ui/WaitTimerBadge';
import { DEFAULT_CLIENTES, LICENCIAS, formatMoney, formatDateDisplay, resizeImage } from './utils/helpers';
// IMPORTACIONES "PEREZOSAS" (LAZY LOADING) - Solo se descargan cuando se necesitan
const LeaderboardView = React.lazy(() => import('./components/views/LeaderboardView'));
const RelayAcceptView = React.lazy(() => import('./components/views/RelayAcceptView'));
const DriverOnboarding = React.lazy(() => import('./components/views/DriverOnboarding'));
const ClientSignView = React.lazy(() => import('./components/views/ClientSignView'));
const ExpensesView = React.lazy(() => import('./components/views/ExpensesView'));
const ConfigView = React.lazy(() => import('./components/views/ConfigView'));
const TrackingView = React.lazy(() => import('./components/views/TrackingView'));
const NewJobForm = React.lazy(() => import('./components/views/NewJobForm'));
const JobsList = React.lazy(() => import('./components/views/JobsList'));
const ChecklistForm = React.lazy(() => import('./components/views/ChecklistForm'));
const VehicleHistoryView = React.lazy(() => import('./components/views/VehicleHistoryView'));

// EL NUEVO MOTOR (Hook)
import { auth, db, googleProvider, uploadImageToStorage, useFirebase } from './hooks/useFirebase';

function LogisticApp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const clientTrack = searchParams.get('client');
  const liveTrackId = searchParams.get('track'); 
  const rawSign = searchParams.get('sign');
  const signTrackId = rawSign ? rawSign.replace(/[^a-zA-Z0-9_-]/g, '') : null;
  const rawRelay = searchParams.get('relay');
  const relayJobId = rawRelay ? rawRelay.replace(/[^a-zA-Z0-9_-]/g, '') : null;

  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [mainTab, setMainTab] = useState('jobs');
  const [activeRole, setActiveRole] = useState('driver');
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [simulatedClient, setSimulatedClient] = useState('');
  const [simulatedDriverEmail, setSimulatedDriverEmail] = useState('');
  const [favDriverEmail, setFavDriverEmail] = useState(() => localStorage.getItem('favDriverEmail') || '');
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [jobLimit, setJobLimit] = useState(300);
  const [showBroadcastAdmin, setShowBroadcastAdmin] = useState(false);
  const [localDismissed, setLocalDismissed] = useState(() => localStorage.getItem('dismissedBroadcast'));
  const [dialogConfig, setDialogConfig] = useState(null);
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const showAlert = (message) => setDialogConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setDialogConfig({ type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialogConfig(null);

  // 🚀 LA MAGIA: EL HOOK QUE HACE TODO EL TRABAJO SUCIO
  const { 
    user, actualUserEmail, currentUserEmail, isRealAdmin, 
    jobs, drivers, expenses, vehicles, customClients, 
    broadcast, dataLoaded, notificationsEnabled, requestNotificationPermission
  } = useFirebase(activeRole, simulatedDriverEmail, jobLimit, showAlert);

  // --- AUTO-SELECCIÓN DE ROL (SALTO DIRECTO A ADMIN) ---
  useEffect(() => {
    // Si la base de datos confirma que eres admin, y no estás intentando simular a un conductor específico...
    if (isRealAdmin && activeRole === 'driver' && !simulatedDriverEmail) {
      setActiveRole('admin'); // Te enviamos directo a tu panel de control
    }
  }, [isRealAdmin, activeRole, simulatedDriverEmail]);

  // --- MOTOR DE ACTUALIZACIÓN AUTOMÁTICA (3:00 AM) ---
  useEffect(() => {
    const checkAndForceUpdate = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const dateString = now.toISOString().split('T')[0]; 
      const lastUpdate = localStorage.getItem('last_daily_refresh');

      // Si son las 3:00 AM o más tarde, y hoy no se ha refrescado...
      if (currentHour >= 3 && lastUpdate !== dateString) {
        localStorage.setItem('last_daily_refresh', dateString);
        
        // 1. Limpiar caché visual del navegador
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach(name => caches.delete(name));
          });
        }
        
        // 2. Destruir Service Workers (Evita que la PWA se quede pegada)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
          });
        }
        
        // 3. Recargar forzosamente
        console.log("⏰ Ejecutando limpieza y actualización de las 3 AM...");
        setTimeout(() => window.location.reload(true), 300);
      }
    };

    checkAndForceUpdate(); // Revisa apenas el usuario abre la app
    const interval = setInterval(checkAndForceUpdate, 10 * 60 * 1000); // Revisa cada 10 min si la pantalla quedó prendida
    
    // Revisa instantáneamente si el conductor desbloquea el celular
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkAndForceUpdate();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  // --------------------------------------------------

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e) => {
      if (localStorage.getItem('darkMode') === null) setDarkMode(e.matches);
    };
    mediaQuery.addEventListener('change', handleThemeChange);

    return () => { 
      window.removeEventListener('online', handleOnline); 
      window.removeEventListener('offline', handleOffline); 
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  // --- MOTOR DE RECARGA GLOBAL (BOTÓN DEL PÁNICO DEL ADMIN) ---
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system_config', 'force_refresh'), (docSnap) => {
      const data = docSnap.data();
      if (data && data.timestamp) {
        const lastGlobalRefresh = localStorage.getItem('last_global_refresh');
        const newTimestamp = data.timestamp.toString();
        
        // Si la marca de tiempo es nueva y diferente a la que el celular tenía guardada
        if (lastGlobalRefresh !== newTimestamp) {
          localStorage.setItem('last_global_refresh', newTimestamp);
          
          // El seguro "!= null" evita que el celular se recargue la primera vez que instala la app
          if (lastGlobalRefresh !== null) {
            console.log("⚠️ ¡Orden de actualización global recibida desde la central!");
            if ('caches' in window) caches.keys().then(names => names.forEach(n => caches.delete(n)));
            if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
            setTimeout(() => window.location.reload(true), 1000);
          }
        }
      }
    });
    return () => unsub();
  }, [db]);
  // -------------------------------------------------------------

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const activeTrackingJobId = React.useMemo(() => {
    if (!user || activeRole !== 'driver') return null;
    const activeJob = jobs.find(j => j.acceptedByEmail === currentUserEmail && j.status === 'accepted' && j.phase === 'picked_up');
    return activeJob ? activeJob.id : null;
  }, [jobs, user, activeRole, currentUserEmail]);

  useEffect(() => {
    if (!activeTrackingJobId || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateDoc(doc(db, 'transport_jobs', activeTrackingJobId), {
          liveLocation: { lat: latitude, lng: longitude, timestamp: Date.now() }
        }).catch(e => console.warn("Error enviando GPS", e));
      },
      (error) => console.warn("Error GPS en vivo:", error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTrackingJobId, db]);

  const allClientsList = customClients.map(c => c.name).sort((a, b) => a.localeCompare(b));
  
  const myDriver = user ? (drivers.find(d => d.email === currentUserEmail && d.photo) || drivers.find(d => d.email === currentUserEmail)) : null;
  const loggedClientRecord = user ? customClients.find(c => c.email && c.email.toLowerCase().split(',').map(e => e.trim()).includes(currentUserEmail)) : null;
  const globalStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Alfa+Slab+One&display=swap');
      
      @font-face {
        font-family: 'FE-Font';
        src: url('https://cdn.jsdelivr.net/gh/kreativekorp/open-din-schriften@master/FE-Font/FE-Font.woff2') format('woff2'),
             url('https://cdn.jsdelivr.net/gh/kreativekorp/open-din-schriften@master/FE-Font/FE-Font.woff') format('woff');
        font-weight: normal;
        font-style: normal;
      }
      
      body { 
        font-family: 'Nunito', sans-serif; 
        background-color: #f8fafc; 
        transition: background-color 0.3s; 
        
        /* MAGIA APP NATIVA */
        overscroll-behavior-y: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      
      .font-alfa { font-family: 'Alfa Slab One', serif; font-weight: 400; }
      
      /* REGLAS MAESTRAS MODO OSCURO OLED (True Black) */
      .dark body { background-color: #000000 !important; color: #f8fafc !important; }
      .dark header.fixed-nav-bar { background-color: #000000 !important; border-bottom: 1px solid #171717 !important; }
      .dark .bg-white:not(canvas) { background-color: #000000 !important; border-color: #171717 !important; }
      .dark canvas { background-color: #ffffff !important; border-radius: 0.5rem; color: #000 !important; }
      .dark .bg-slate-50 { background-color: #000000 !important; border-color: #171717 !important; }
      .dark .bg-slate-100 { background-color: #0a0a0a !important; }
      .dark .bg-slate-200 { background-color: #171717 !important; }
      
      .dark .text-slate-800, .dark .text-slate-900 { color: #f8fafc !important; }
      .dark .text-slate-700 { color: #e2e8f0 !important; }
      .dark .text-slate-600 { color: #cbd5e1 !important; }
      .dark .text-slate-500, .dark .text-slate-400 { color: #94a3b8 !important; }
      .dark .border-slate-100, .dark .border-slate-200, .dark .border-slate-300 { border-color: #171717 !important; }
      
      /* Botones de alto contraste OLED */
      .dark .bg-blue-50 { background-color: rgba(37, 99, 235, 0.15) !important; border-color: rgba(37, 99, 235, 0.3) !important; }
      .dark .text-blue-800 { color: #93c5fd !important; }
      .dark .text-blue-600 { color: #60a5fa !important; }

      /* CORRECCIÓN: FORZAR FONDO OSCURO EN LAS LISTAS DESPLEGABLES */
      .dark select, .dark option {
        background-color: #0f172a !important;
        color: #e2e8f0 !important;
      }

      /* CLASE CUSTOM PARA CONGELAR LA BARRA DE NAVEGACIÓN SIN REBOTE */
      .fixed-nav-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 50 !important;
      }

      /* PREVENIR AUTO-ZOOM EN iPHONE (IOS SAFARI) AL ESCRIBIR EN INPUTS */
      @media screen and (max-width: 768px) {
        input, select, textarea { 
          font-size: 16px !important; 
        }
      }
    `}</style>
  );

  // --- NUEVO: SI HAY UN CLIENTE EN LA URL, MOSTRAR PORTAL DE CLIENTE ---
  if (clientTrack) {
    return (
      <>
        {globalStyles}
        <TrackingView clientName={clientTrack} db={db} darkMode={darkMode} setDarkMode={setDarkMode} />
      </>
    );
  }
  // --------------------------------------------------------------------------------

  // --- NUEVO: SI EL ADMIN ELIGE VISTA CLIENTE ---
  if (user && activeRole === 'client' && simulatedClient) {
    return (
      <>
        {globalStyles}
        <TrackingView clientName={simulatedClient} db={db} onBack={() => { setActiveRole('admin'); setRoleMenuOpen(false); }} darkMode={darkMode} setDarkMode={setDarkMode} />
      </>
    );
  }
  // --- NUEVO: SI EL USUARIO LOGUEADO ES UN CLIENTE REAL (Y NO ES ADMIN) ---
  if (user && loggedClientRecord && !isRealAdmin) {
    return (
      <>
        {globalStyles}
        <TrackingView 
           clientName={loggedClientRecord.name} 
           db={db} 
           onLogout={() => signOut(auth)} 
           darkMode={darkMode} 
           setDarkMode={setDarkMode} 
        />
      </>
    );
  }
  // --------------------------------------------------------------------------------
  // --- NUEVO: VISTA DE FIRMA REMOTA DEL CLIENTE ---
  if (signTrackId) {
    return (
      <>
        {globalStyles}
        <ClientSignView jobId={signTrackId} db={db} />
      </>
    );
  }
  // --------------------------------------------------------------------------------

  // --- NUEVO: VISTA DE TRASPASO EN RUTA (RELEVO) ---
  if (relayJobId && user) {
    return (
      <>
        {globalStyles}
        <RelayAcceptView jobId={relayJobId} db={db} currentUserEmail={user.email} drivers={drivers} />
      </>
    );
  }
  // Si no está logueado, seguirá hacia abajo para pedir Google, y conservará la URL para entrar a esta vista después
  // --------------------------------------------------------------------------------
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-blue-50">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 transform rotate-3 hover:rotate-0 transition-transform"><Car className="w-10 h-10 text-white" /></div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">LogisticAPP</h1>
          <p className="text-slate-500 mb-10 text-lg">Gestión de traslados inteligente</p>
          <button onClick={() => signInWithPopup(auth, googleProvider).catch(e => alert("Error de Acceso: " + e.message))} className="w-full bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 px-4 rounded-2xl shadow-sm hover:bg-slate-50 flex items-center justify-center gap-3 transition-all text-lg">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" /> Ingresar con Google
          </button>
        </div>
      </div>
    );
  }
  // NUEVO: Pantalla de carga global mientras Firebase descarga la base de datos
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 shadow-sm"></div>
        <p className="text-lg font-extrabold text-slate-700 tracking-tight">Sincronizando datos...</p>
        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">LogisticAPP</p>
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

  // --- CONTROL DE ONBOARDING ESTRICTO ---
  const needsOnboarding = myDriver && (
    !myDriver.photo || myDriver.photo === "" || 
    !myDriver.idFront || myDriver.idFront === "" || 
    !myDriver.idBack || myDriver.idBack === "" || 
    !myDriver.licenseFront || myDriver.licenseFront === "" || 
    !myDriver.licenseBack || myDriver.licenseBack === ""
  );

  // BLOQUEO ABSOLUTO: Nadie en modo "Conductor" pasa a la app sin sus 5 fotos (sin excepciones)
  if (activeRole === 'driver' && (needsOnboarding || !myDriver)) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10 transition-colors duration-300 dark:bg-slate-950">
        {globalStyles}
        <header className="fixed-nav-bar bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20">
           <div className="flex items-center gap-3">
             <div className="bg-white/20 p-1.5 rounded-xl"><img src="/logo.png" className="w-8 h-8 object-contain"/></div>
             <h1 className="font-alfa text-xl text-white">Verificación Obligatoria</h1>
           </div>
           {isRealAdmin ? (
             <button onClick={() => { setActiveRole('admin'); setRoleMenuOpen(false); }} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors flex items-center gap-2 text-xs font-bold">
               <LogOut className="w-4 h-4" /> Salir a Admin
             </button>
           ) : (
             <button onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors flex items-center gap-2 text-xs font-bold">
               <LogOut className="w-4 h-4" /> Salir
             </button>
           )}
        </header>
        <main className="max-w-md mx-auto p-4 pt-24 sm:pt-28 pb-10">
           {myDriver ? (
             <DriverOnboarding driver={myDriver} db={db} uploadImageToStorage={uploadImageToStorage} />
           ) : (
             <div className="bg-white p-8 rounded-3xl border text-center space-y-5 shadow-lg border-slate-100">
               <div className="relative w-20 h-20 mx-auto">
                 <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                 <User className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
               </div>
               <p className="font-black text-slate-800 text-xl">Creando credenciales...</p>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider leading-relaxed">Estableciendo conexión segura con la central logística</p>
             </div>
           )}
        </main>
      </div>
    );
  }
  // -----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-32 transition-colors duration-300">
      {globalStyles}
      <header className="fixed-nav-bar bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20 transition-colors duration-300">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
      {/* Logo de la app más pequeño en móvil */}
      <div className="bg-white/20 p-1 sm:p-1.5 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0">
        <img src="/logo.png" alt="Logo App" className="w-7 h-7 sm:w-12 sm:h-12 object-contain" />
      </div>
      
      {/* Nombre de la aplicación adaptado para no chocar */}
      <h1 className="font-alfa text-lg sm:text-3xl tracking-wide shrink-0 text-white" style={{ paddingTop: '2px' }}>
        LogisticAPP
      </h1>
      
      {/* Logo Logística TS SpA ajustado al nuevo tamaño */}
      <div className="bg-white/20 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0 ml-0.5 sm:ml-1 overflow-hidden">
        <img src="/LogoLogistica.png" alt="Logística TS SpA" className="h-8 sm:h-15 object-contain" />
      </div>
    </div>
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* NUEVO: BOTÓN TUERCA (AJUSTES) */}
          <div className="relative">
            <button 
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setRoleMenuOpen(false); // <-- NUEVO: Cierra el ojo al abrir la tuerca
              }} 
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors shadow-sm border border-white/10"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
            
            {settingsOpen && (
              <div className="absolute right-0 top-12 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Ajustes de App</p>
                </div>
                <div className="p-4 space-y-5">
                  {/* Estado de Red */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Señal de Red</span>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm border ${isOnline ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200 animate-pulse'}`}>
                      {isOnline ? <><Wifi className="w-3.5 h-3.5"/> Online</> : <><CloudOff className="w-3.5 h-3.5"/> Offline</>}
                    </div>
                  </div>
                  {/* Switch Modo Oscuro */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      {darkMode ? <Moon className="w-4 h-4 text-blue-600"/> : <Sun className="w-4 h-4 text-amber-500"/>} Modo Oscuro
                    </span>
                    <button onClick={() => setDarkMode(!darkMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner ${darkMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {/* Permisos de Notificaciones */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Bell className={`w-4 h-4 ${notificationsEnabled ? 'text-green-500' : 'text-amber-500 animate-pulse'}`}/> Notificaciones
                    </span>
                    {!notificationsEnabled ? (
                      <button onClick={requestNotificationPermission} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors">Activar</button>
                    ) : (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Activas</span>
                    )}
                  </div>

                  {/* --- SÚPER BOTÓN MATA-CACHÉ (SOLUCIÓN DEFINITIVA XIAOMI/PWA) --- */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-600"/> Recargar App
                    </span>
                    <button onClick={() => {
                        if ('caches' in window) {
                          caches.keys().then((names) => {
                            names.forEach(name => caches.delete(name));
                          });
                        }
                        if ('serviceWorker' in navigator) {
                          navigator.serviceWorker.getRegistrations().then(regs => {
                            regs.forEach(r => r.unregister());
                          });
                        }
                        if (window.indexedDB && window.indexedDB.databases) {
                          window.indexedDB.databases().then(dbs => {
                            dbs.forEach(dbFile => {
                              if (dbFile.name.startsWith('firestore')) {
                                window.indexedDB.deleteDatabase(dbFile.name);
                              }
                            });
                          });
                        }
                        setTimeout(() => window.location.reload(true), 300);
                    }} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors active:bg-blue-300">
                      FORZAR LOCAL
                    </button>
                  </div>

                  {/* --- MATA-CACHÉ GLOBAL (SÓLO PARA ADMINISTRADORES) --- */}
                  {activeRole === 'admin' && (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 bg-purple-50 -mx-4 px-4 pb-2">
                      <span className="text-sm font-black text-purple-700 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-600"/> Forzar a TODOS
                      </span>
                      <button onClick={() => {
                          showConfirm("⚠️ ¿Forzar a todos los celulares de la flota a recargarse y actualizarse en este mismo instante?", async () => {
                             try {
                               await setDoc(doc(db, 'system_config', 'force_refresh'), { timestamp: Date.now() });
                               showAlert("✅ Orden de actualización enviada a toda la flota.");
                             } catch(err) { 
                               console.error(err); 
                               showAlert("Error al enviar la orden."); 
                             }
                          });
                      }} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors active:scale-95">
                        ¡EJECUTAR!
                      </button>
                    </div>
                  )}
                  
                  {/* --- BOTÓN CERRAR SESIÓN --- */}
                  <div className="border-t border-slate-100 pt-4 mt-2">
                     <p className="text-[10px] text-center font-bold text-slate-400 mb-2 truncate">Sesión: {currentUserEmail}</p>
                     <button onClick={() => signOut(auth)} className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-colors border border-red-100 shadow-sm active:scale-95">
                        <LogOut className="w-4 h-4"/> Cerrar Sesión
                     </button>
                  </div>

                </div>
                {/* VERSIÓN DE LA APP */}
                <div className="bg-slate-50 p-2.5 text-center border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">LogisticAPP v.2.8.4</p>
                </div>
              </div>
            )}
          </div>
          {isRealAdmin && (
            <div className="relative">
              {/* Botón dinámico inteligente: se vuelve morado y parpadea si estás asistiendo a un conductor */}
              <button 
              onClick={() => {
                setRoleMenuOpen(!roleMenuOpen);
                setSettingsOpen(false); // <-- NUEVO: Cierra la tuerca al abrir el ojo
              }} 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-colors shadow-sm border border-white/10"
            >
              <Eye className="w-5 h-5 text-white"/>
                <span className="hidden md:inline">
                  {activeRole === 'admin' ? 'Modo: Admin' : activeRole === 'driver' ? (
                    simulatedDriverEmail 
                      ? `Asistiendo a: ${drivers.find(dr => dr.email === simulatedDriverEmail)?.name?.split(' ')[0]}` 
                      : 'Modo: Conductor'
                  ) : 'Modo: Cliente'}
                </span>
              </button>
              {roleMenuOpen && (
                <div className="absolute right-0 top-12 mt-1 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 text-slate-800">
                  <div className="p-2 border-b border-slate-100 bg-slate-50"><p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Panel de Control General</p></div>
                  
                  <button onClick={() => { setActiveRole('admin'); setMainTab('jobs'); setSimulatedDriverEmail(''); setRoleMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors ${activeRole==='admin'?'text-blue-600 bg-blue-50':'text-slate-600'}`}>
                     <Users className="w-4 h-4"/> Volver a Administrador
                  </button>

                  {/* NUEVA SECCIÓN: ASISTIR/SIMULAR CONDUCTOR (DISEÑO MEJORADO Y RÁPIDO) */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                     <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-2"><Car className="w-3.5 h-3.5 text-blue-600"/> Entrar como Conductor</p>
                     
                     {/* BOTÓN RÁPIDO DE FAVORITO */}
                     {favDriverEmail && drivers.find(d => d.email === favDriverEmail) && (
                       <button onClick={() => { setSimulatedDriverEmail(favDriverEmail); setActiveRole('driver'); setMainTab('jobs'); setRoleMenuOpen(false); }} className="w-full bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-200 hover:from-amber-200 text-amber-800 p-2.5 rounded-xl text-xs font-black flex justify-between items-center transition-colors shadow-sm mb-3">
                         <div className="flex items-center gap-2"><Star className="w-4 h-4 fill-amber-500 text-amber-500"/> Entrar como {drivers.find(d => d.email === favDriverEmail).name.split(' ')[0]}</div>
                         <ChevronRight className="w-4 h-4 text-amber-500"/>
                       </button>
                     )}

                     {/* LISTA SCROLLEABLE INTERNA DE CONDUCTORES */}
                     <div className="bg-white border border-slate-200 rounded-xl max-h-40 overflow-y-auto shadow-inner divide-y divide-slate-50">
                       {drivers.filter(d => !d.isHidden).sort((a, b) => a.name.localeCompare(b.name)).map(d => {
                         const isCurrentActive = activeRole === 'driver' && simulatedDriverEmail === d.email;
                         return (
                         <div key={d.id} className={`flex items-center justify-between p-1 transition-colors group ${isCurrentActive ? 'bg-purple-50 border-l-4 border-purple-500' : 'hover:bg-blue-50'}`}>
                            {/* Al tocar el nombre, entras directo */}
                            <button onClick={() => { setSimulatedDriverEmail(d.email); setActiveRole('driver'); setMainTab('jobs'); setRoleMenuOpen(false); }} className={`flex-1 text-left px-2 py-2 text-xs truncate ${isCurrentActive ? 'text-purple-700 font-black' : 'text-slate-700 font-bold group-hover:text-blue-700'}`}>
                               {d.name} {isCurrentActive && <span className="text-[9px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded ml-1 animate-pulse">ACTIVO</span>}
                            </button>
                            {/* Estrella para fijarlo como favorito arriba */}
                            <button onClick={(e) => { e.stopPropagation(); setFavDriverEmail(d.email); localStorage.setItem('favDriverEmail', d.email); }} className="p-2 rounded-lg hover:bg-amber-50 transition-colors" title="Fijar como Favorito">
                               <Star className={`w-4 h-4 transition-colors ${favDriverEmail === d.email ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-300'}`} />
                            </button>
                         </div>
                         );
                       })}
                     </div>
                  </div>

                  {/* SECCIÓN EXISTENTE: SIMULAR CLIENTE */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2">
                     <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-slate-800"/> Ver Portal de Cliente</p>
                     <select value={simulatedClient} onChange={(e) => setSimulatedClient(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:border-slate-800 bg-white">
                        <option value="">Seleccionar Cliente...</option>
                        {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <button onClick={() => { if(simulatedClient) { setActiveRole('client'); setRoleMenuOpen(false); } else { showAlert("Selecciona un cliente de la lista primero"); } }} className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-sm">Entrar a la vista Cliente</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {currentView === 'main' && mainTab === 'jobs' && (
        <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24">
          {activeRole === 'admin' ? (
            <>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={() => {setAdminTab('dashboard'); setEditingJob(null);}} className={`flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors ${adminTab==='dashboard'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><ClipboardList className="w-4 h-4 sm:w-5 sm:h-5"/> Monitor</button>
                <button onClick={() => {setAdminTab('newJob'); setEditingJob(null);}} className={`flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors ${adminTab==='newJob'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Plus className="w-4 h-4 sm:w-5 sm:h-5"/> Crear</button>
                <button onClick={() => setAdminTab('config')} className={`flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors ${adminTab==='config'?'bg-blue-100 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Truck className="w-4 h-4 sm:w-5 sm:h-5"/> Config</button>
                <button onClick={() => setShowBroadcastAdmin(true)} className="flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors text-purple-600 bg-purple-50 hover:bg-purple-100"><Megaphone className="w-4 h-4 sm:w-5 sm:h-5"/> Aviso</button>
                <button onClick={() => setAdminTab('history')} className={`flex-1 flex justify-center items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-sm font-extrabold transition-colors ${adminTab==='history'?'bg-slate-800 text-white shadow-md':'text-slate-500 hover:bg-slate-50'}`}><ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5"/> Peritaje</button>
              </div>
              
              {adminTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h2 className="text-2xl font-extrabold text-slate-800">Monitor de Trabajos</h2>
                    <button onClick={exportToExcel} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-lg shadow-green-200 transition-colors"><Download className="w-5 h-5"/> Exportar Excel</button>
                  </div>
                  <JobsList 
                    jobs={jobs} drivers={drivers} vehicles={vehicles} role="admin" 
                    onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} 
                    onEditJob={(j) => { setEditingJob(j); setAdminTab('newJob'); }} 
                    db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
                    onLoadMore={() => setJobLimit(prev => prev + 20)}
                  />
                </div>
              )}
              
              {adminTab === 'newJob' && <div className="animate-in zoom-in-[0.98] slide-in-from-bottom-8 duration-500 ease-out"><NewJobForm key={editingJob ? editingJob.id : 'new'} jobToEdit={editingJob} onCancelEdit={() => {setEditingJob(null); setAdminTab('dashboard');}} allClientsList={allClientsList} vehicles={vehicles} drivers={drivers.filter(d => !d.isHidden)} db={db} showAlert={showAlert} onSuccess={() => setAdminTab('dashboard')} /></div>}
              
              {adminTab === 'history' && <div className="animate-in zoom-in-[0.98] duration-300"><VehicleHistoryView db={db} showAlert={showAlert} /></div>}
              
              {adminTab === 'config' && <div className="animate-in zoom-in-[0.98] duration-300"><ConfigView allClientsList={allClientsList} customClients={customClients} vehicles={vehicles} drivers={drivers} db={db} showAlert={showAlert} showConfirm={showConfirm} /></div>}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Mis Trabajos Asignados</h2>
              <JobsList 
                 jobs={jobs} drivers={drivers} vehicles={vehicles} role="driver" 
                 onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} 
                 db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
                 onLoadMore={() => setJobLimit(prev => prev + 20)}
              />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} db={db} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      
      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4 pt-20 sm:pt-24 pb-24 animate-in zoom-in-[0.98] slide-in-from-bottom-8 duration-500 ease-out">
          <ChecklistForm 
             job={selectedJob} db={db} currentUserEmail={currentUserEmail} 
             allClientsList={allClientsList}
             vehicles={vehicles}
             drivers={drivers} expenses={expenses} 
             onCancel={() => { 
                setCurrentView('main');
             }} 
             onComplete={async () => { 
                try {
                   // Intentamos limpiar el borrador
                   if (selectedJob.id !== 'NEW_QUICK_JOB') {
                      await updateDoc(doc(db, 'transport_jobs', selectedJob.id), { draft: null });
                   }
                } catch(e) { 
                   // Si Firebase lo bloquea porque el trabajo ya se cerró, lo ignoramos en silencio
                } finally {
                   // ESTO ASEGURA QUE LA PANTALLA SE CIERRE PASE LO QUE PASE
                   setSelectedJob(null); 
                   setCurrentView('main'); 
                }
             }} 
             showAlert={showAlert} showConfirm={showConfirm} 
             uploadImageToStorage={uploadImageToStorage}
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

      {/* NUEVO: Bandeja Flotante de Trabajo Offline (Idea 3) */}
      {!isOnline && user && (
        <div className="fixed bottom-[88px] sm:bottom-[92px] left-1/2 transform -translate-x-1/2 z-[100] w-[92%] max-w-sm animate-in slide-in-from-bottom-5 duration-500">
          <div className="bg-slate-800 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3">
            <div className="bg-slate-700 p-2.5 rounded-full relative shrink-0">
              <CloudOff className="w-5 h-5 text-amber-400" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-0.5">Modo Sin Conexión</p>
              <p className="text-[10px] font-bold text-slate-300 leading-tight">Trabajando con memoria caché local. Se sincronizará automáticamente al volver la red.</p>
            </div>
          </div>
        </div>
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

      {/* --- MODAL ADMIN: CREAR ANUNCIO --- */}
      {showBroadcastAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={async (e) => {
              e.preventDefault();
              const msg = e.target.message.value.trim();
              if (!msg) return;
              try {
                await setDoc(doc(db, 'system_config', 'broadcast'), { message: msg, timestamp: Date.now(), active: true });
                setShowBroadcastAdmin(false);
                showAlert("✅ Anuncio enviado exitosamente a toda la flota.");
              } catch(err) { console.error(err); showAlert("Error enviando anuncio."); }
          }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
              <button type="button" onClick={()=>setShowBroadcastAdmin(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-700"/></button>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-purple-100 p-2.5 rounded-full"><Megaphone className="w-6 h-6 text-purple-600"/></div>
                <h3 className="text-xl font-black text-slate-800">Pop-up Global</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-5 leading-relaxed">Envía una alerta urgente que aparecerá obligatoriamente en medio de la pantalla de todos los conductores al abrir la app.</p>

              {broadcast?.active && (
                <div className="mb-5 bg-purple-50 p-4 rounded-2xl border border-purple-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                    <p className="text-[10px] font-black text-purple-600 uppercase mb-1.5 tracking-widest">Anuncio Activo Actual:</p>
                    <p className="text-sm font-bold text-slate-700 italic leading-snug">"{broadcast.message}"</p>
                    <button type="button" onClick={async () => {
                      await setDoc(doc(db, 'system_config', 'broadcast'), { active: false }, { merge: true });
                      showAlert("Anuncio apagado. Ya no le saldrá a nadie.");
                    }} className="mt-3 text-[10px] font-black uppercase text-red-500 hover:text-red-600 bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-200">Apagar Anuncio</button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escribir Nuevo Mensaje</label>
                <textarea name="message" rows="4" required placeholder="Ej: Muchachos, recuerden tomar fotografías claras a los comprobantes de peaje..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500 resize-none"></textarea>
              </div>
              <button type="submit" className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-purple-200 transition-colors text-sm">Emitir a toda la flota</button>
          </form>
        </div>
      )}

      {/* --- POP-UP CONDUCTORES: MOSTRAR ANUNCIO --- */}
      {user && broadcast?.active && broadcast.timestamp.toString() !== localDismissed && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border-4 border-purple-500 flex flex-col">
              <div className="bg-purple-600 p-6 text-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 opacity-10"><Megaphone className="w-40 h-40 text-white"/></div>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl relative z-10">
                    <Megaphone className="w-8 h-8 text-purple-600 animate-pulse"/>
                </div>
                <h3 className="text-2xl font-black text-white relative z-10 tracking-wide">¡Aviso Importante!</h3>
              </div>
              <div className="p-6 text-center flex-1 flex flex-col justify-center bg-slate-50">
                <p className="text-base font-extrabold text-slate-700 mb-8 leading-relaxed whitespace-pre-wrap">{broadcast.message}</p>
                <button onClick={() => {
                    localStorage.setItem('dismissedBroadcast', broadcast.timestamp.toString());
                    setLocalDismissed(broadcast.timestamp.toString());
                }} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black shadow-lg shadow-purple-200 transition-all text-lg active:scale-95">
                  ¡Entendido!
                </button>
              </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- ENVOLTORIO MAESTRO DE NAVEGACIÓN ---
// Esto convierte tu aplicación entera en una Single Page Application (SPA) ultra veloz
export default function App() {
  return (
    <Router>
      {/* ENVUELVE LA APP PARA ATRAPAR LAS CARGAS DIFERIDAS DE LAS VISTAS */}
      <React.Suspense fallback={
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 border-4 border-slate-900 border-t-blue-600 rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(37,99,235,0.3)]"></div>
          <p className="text-[11px] font-black text-slate-400 tracking-widest uppercase animate-pulse">Optimizando módulos...</p>
        </div>
      }>
        <LogisticApp />
      </React.Suspense>
    </Router>
  );
}




