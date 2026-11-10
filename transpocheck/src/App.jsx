import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { signOut, signInWithPopup } from 'firebase/auth';
import { doc, updateDoc, setDoc, deleteField, onSnapshot, collection, getDocs } from 'firebase/firestore';

import {
  Car, MapPin, Camera, CheckCircle, FileText, Download, Plus, User, Navigation,
  AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy,
  Zap, Edit2, Bell, Share2, X, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck,
  XCircle, Trophy, Eye, Clock, Save, Search, CloudOff, Wifi, QrCode, Sun, Moon,
  Settings, ChevronUp, ChevronDown, ChevronRight, Fuel, Megaphone, Star, ShieldCheck, Activity, AlertTriangle
} from 'lucide-react';

import SignaturePad from './components/ui/SignaturePad';
import CustomClientSelector from './components/ui/CustomClientSelector';
import LicensePlateBadge from './components/ui/LicensePlateBadge';
import VehicleShapeIcon from './components/ui/VehicleShapeIcon';
import SwipeButton from './components/ui/SwipeButton';
import WaitTimerBadge from './components/ui/WaitTimerBadge';
import { DevMenu } from './components/ui/DevMenu';
import { DEFAULT_CLIENTES, LICENCIAS, formatMoney, formatDateDisplay, resizeImage } from './utils/helpers';

// MAGIA ANTI-CHUNK ERROR: Función que intercepta los fallos de carga en Vercel y recarga la página limpiamente
const lazyWithRetry = (componentImport) =>
  React.lazy(async () => {
    let pageHasAlreadyBeenForceRefreshed = false;
    try {
      pageHasAlreadyBeenForceRefreshed = JSON.parse(
        window.localStorage.getItem('page-has-been-force-refreshed') || 'false'
      );
    } catch (e) {
      console.warn("localStorage not accessible");
    }
    try {
      const component = await componentImport();
      try { window.localStorage.setItem('page-has-been-force-refreshed', 'false'); } catch (e) { }
      return component;
    } catch (error) {
      console.error("Error en lazy load:", error);
      if (!pageHasAlreadyBeenForceRefreshed) {
        try { window.localStorage.setItem('page-has-been-force-refreshed', 'true'); } catch (e) { }
        try { window.sessionStorage.setItem('page-has-been-force-refreshed', 'true'); } catch (e) { }
        // Destruir el Service Worker (PWA Caché) para obligar a descargar la nueva versión
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for (let registration of registrations) {
              registration.unregister();
            }
          });
        }
        // Limpiar cachés de Workbox agresivos
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (let name of names) caches.delete(name);
          });
        }
        // Mostrar UI nativa y luego recargar
        return {
          default: () => {
            React.useEffect(() => {
              const timer = setTimeout(() => {
                window.location.reload(true);
              }, 2500);
              return () => clearTimeout(timer);
            }, []);

            return (
              <div className="fixed inset-0 bg-slate-950/75 flex flex-col items-center justify-center z-[9999] p-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg max-w-sm w-full text-center shadow-lg border border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/50 rounded-md flex items-center justify-center mx-auto mb-3 relative">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Actualizando versión...</p>
                </div>
              </div>
            );
          }
        };
      }
      console.error("El chunk de React sigue fallando tras recargar.");
      throw error;
    }
  });

// IMPORTACIONES "PEREZOSAS" (LAZY LOADING) - Blindadas contra fallos de despliegue en Vercel
const LeaderboardView = lazyWithRetry(() => import('./components/views/LeaderboardView'));
const RelayAcceptView = lazyWithRetry(() => import('./components/views/RelayAcceptView'));
const DriverOnboarding = lazyWithRetry(() => import('./components/views/DriverOnboarding'));
const ClientSignView = lazyWithRetry(() => import('./components/views/ClientSignView'));
const ExpensesView = lazyWithRetry(() => import('./components/views/ExpensesView'));
const ConfigView = lazyWithRetry(() => import('./components/views/ConfigView'));
const TrackingView = lazyWithRetry(() => import('./components/views/TrackingView'));
const NewJobForm = lazyWithRetry(() => import('./components/views/NewJobForm'));
const JobsList = lazyWithRetry(() => import('./components/views/JobsList'));
const ChecklistForm = lazyWithRetry(() => import('./components/views/Checklist/ChecklistForm.jsx'));
const VehicleHistoryView = lazyWithRetry(() => import('./components/views/VehicleHistoryView'));
const StatsView = lazyWithRetry(() => import('./components/views/StatsView'));
const DriverDashboardView = lazyWithRetry(() => import('./components/views/DriverDashboardView'));
const ActivityView = lazyWithRetry(() => import('./components/views/ActivityView'));
const ChecklistAnalyticsView = lazyWithRetry(() => import('./components/views/ChecklistAnalyticsView'));
const QuotesView = lazyWithRetry(() => import('./components/views/QuotesView'));

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
  const APP_VERSION = "v1.3.07"; // IMPORTANT: Update this version string when making changes.

  // VARIABLES MÁGICAS: Atrapan lo que Android nos comparte desde CamScanner o Adobe Scan
  const sharedText = searchParams.get('shared_text');
  const sharedUrl = searchParams.get('shared_url');

  // NUEVO: Memoria persistente para recordar la última pantalla y simulaciones activas
  const [adminTab, setAdminTab] = useState(() => {
    try { return localStorage.getItem('app_adminTab') || 'dashboard'; }
    catch (e) { return 'dashboard'; }
  });
  const [selectedJob, setSelectedJob] = useState(() => {
    try {
      const saved = localStorage.getItem('app_selectedJob');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [editingJob, setEditingJob] = useState(() => {
    try {
      const saved = localStorage.getItem('app_editingJob');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  const [currentView, setCurrentView] = useState(() => { try { return localStorage.getItem('app_currentView') || 'main'; } catch (e) { return 'main'; } });
  const [mainTab, setMainTab] = useState(() => { try { return localStorage.getItem('app_mainTab') || 'jobs'; } catch (e) { return 'jobs'; } });
  const [activeRole, setActiveRole] = useState(() => { try { return localStorage.getItem('app_activeRole') || 'driver'; } catch (e) { return 'driver'; } });
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [simulatedClient, setSimulatedClient] = useState(() => { try { return localStorage.getItem('app_simulatedClient') || ''; } catch (e) { return ''; } });
  const [simulatedDriverEmail, setSimulatedDriverEmail] = useState(() => { try { return localStorage.getItem('app_simulatedDriver') || ''; } catch (e) { return ''; } });
  const [favDriverEmail, setFavDriverEmail] = useState(() => { try { return localStorage.getItem('favDriverEmail') || ''; } catch (e) { return ''; } });

  // NUEVO: Sincronización automática de la memoria cada vez que cambias de vista
  useEffect(() => { localStorage.setItem('app_adminTab', adminTab); }, [adminTab]);
  useEffect(() => {
    if (selectedJob) {
      localStorage.setItem('app_selectedJob', JSON.stringify(selectedJob));
    } else {
      localStorage.removeItem('app_selectedJob');
    }
  }, [selectedJob]);
  useEffect(() => {
    if (editingJob) {
      localStorage.setItem('app_editingJob', JSON.stringify(editingJob));
    } else {
      localStorage.removeItem('app_editingJob');
    }
  }, [editingJob]);
  useEffect(() => { localStorage.setItem('app_currentView', currentView); }, [currentView]);
  useEffect(() => { localStorage.setItem('app_mainTab', mainTab); }, [mainTab]);
  useEffect(() => { localStorage.setItem('app_activeRole', activeRole); }, [activeRole]);
  useEffect(() => { localStorage.setItem('app_simulatedClient', simulatedClient); }, [simulatedClient]);
  useEffect(() => { localStorage.setItem('app_simulatedDriver', simulatedDriverEmail); }, [simulatedDriverEmail]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [jobLimit, setJobLimit] = useState(300);
  const [showBroadcastAdmin, setShowBroadcastAdmin] = useState(false);
  const [localDismissed, setLocalDismissed] = useState(() => localStorage.getItem('dismissedBroadcast'));
  const [dialogConfig, setDialogConfig] = useState(null);

  const [showRequestJob, setShowRequestJob] = useState(false); // <-- NUEVO ESTADO PARA SOLICITAR TRASLADO
  const [directoryList, setDirectoryList] = useState([]); // <-- NUEVO: Memoria del Directorio
  const [prtList, setPrtList] = useState([]); // <-- NUEVO: Memoria PRT

  // Carga el directorio en segundo plano de forma 100% segura
  useEffect(() => {
    import('firebase/firestore').then(({ getDocs, collection, addDoc }) => {
      getDocs(collection(db, 'directory')).then(snap => setDirectoryList(snap.docs.map(d => d.data()))).catch(() => { });
      getDocs(collection(db, 'prts')).then(snap => {
        const prts = snap.docs.map(d => d.data());
        setPrtList(prts);
        // Auto-agregar PRT Santa Margarita solo si no hay ninguna planta guardada
        // (así no reaparece si el usuario la elimina desde el selector)
        if (prts.length === 0) {
          addDoc(collection(db, 'prts'), { name: 'PRT Santa Margarita' }).catch(console.error);
        }
      }).catch(() => { });
    });
  }, [db]);

  // NUEVO: ESTADO GLOBAL DE COLA EN SEGUNDO PLANO
  const [syncQueue, setSyncQueue] = useState([]);
  const pushSyncTask = (taskName, meta = {}) => {
    const id = Date.now() + Math.random();
    const jobId = typeof meta === 'string' ? meta : meta?.jobId;
    const newTask = { id, name: taskName, status: 'syncing', jobId, progressText: '', ...(typeof meta === 'object' ? meta : {}) };
    setSyncQueue(prev => [...prev, newTask]);
    return {
      updateProgress: (text) => {
        setSyncQueue(prev => prev.map(t => t.id === id ? { ...t, progressText: text } : t));
      },
      finish: () => {
        setSyncQueue(prev => prev.map(t => t.id === id ? { ...t, status: 'done', progressText: '¡Listo!' } : t));
        setTimeout(() => setSyncQueue(prev => prev.filter(t => t.id !== id)), 5000); // Desaparece tras 5 seg
      },
      error: (err) => {
        const errMsg = err?.message || String(err);
        setSyncQueue(prev => prev.map(t => t.id === id ? { ...t, status: 'error', error: errMsg } : t));
        setTimeout(() => setSyncQueue(prev => prev.filter(t => t.id !== id)), 10000);
      }
    };
  };

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const closeDialog = () => setDialogConfig(null);

  const showAlert = (message) => {
    if (!message) {
      setDialogConfig(null);
      return;
    }
    setDialogConfig({ type: 'alert', message });

    // Auto-cierre inteligente: Si el mensaje contiene "✅", se cierra en 1 segundo (1000ms)
    if (typeof message === 'string' && message.includes('✅')) {
      setTimeout(() => {
        // Solo cerramos si el modal sigue siendo el mismo mensaje (evita cerrar otros modales por error)
        setDialogConfig(prev => (prev && prev.message === message) ? null : prev);
      }, 1000);
    }
  };

  const showConfirm = (message, onConfirm) => setDialogConfig({ type: 'confirm', message, onConfirm });

  // EL HOOK QUE HACE TODO EL TRABAJO SUCIO
  const {
    user, actualUserEmail, currentUserEmail, isRealAdmin, isSuperAdmin, isQuoter, isPartTime,
    adminPermissions,
    jobs, drivers, expenses, vehicles, customClients, vehicleModels,
    broadcast, dataLoaded, notificationsEnabled, requestNotificationPermission
  } = useFirebase(activeRole, simulatedDriverEmail, jobLimit, showAlert);

  // NUEVO: Estado en Tiempo Real para la Bandeja de Entrada de PDFs
  const [inboxDocs, setInboxDocs] = useState([]);
  useEffect(() => {
    if (!db || !currentUserEmail) return;
    let unsub = () => { };
    import('firebase/firestore').then(({ query, collection, where, onSnapshot }) => {
      const q = query(collection(db, 'inbox'), where('userEmail', '==', currentUserEmail));
      unsub = onSnapshot(q, snap => {
        setInboxDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
      });
    });
    return () => unsub();
  }, [db, currentUserEmail]);

  // MAGIA ANDROID: Escuchar si nos acaban de compartir un Link desde CamScanner/Adobe Scan
  useEffect(() => {
    const incomingLink = sharedUrl || sharedText;
    if (incomingLink && user && currentUserEmail && db) {
      import('firebase/firestore').then(({ addDoc, collection }) => {
        addDoc(collection(db, 'inbox'), {
          userEmail: currentUserEmail,
          fileName: 'Link Escaneado (Recibido Externo)',
          fileType: 'link',
          url: incomingLink,
          createdAt: Date.now()
        }).then(() => {
          showAlert("✅ Link recibido desde otra App y guardado en tu Bandeja.");
          setMainTab('inbox');
          navigate('/', { replace: true }); // Limpia la URL para evitar que se duplicar al recargar
        });
      });
    }
  }, [sharedUrl, sharedText, user, currentUserEmail, db]);

  // --- AUTO-SELECCIÓN DE ROL Y BLOQUEO COMERCIAL ---
  useEffect(() => {
    if (isQuoter) {
      setActiveRole('quoter');
      setMainTab('quotes'); // Obligamos a que la pantalla sea siempre la de cotizaciones
    } else if (isRealAdmin && activeRole === 'driver' && !simulatedDriverEmail) {
      setActiveRole('admin');
    }
  }, [isRealAdmin, isQuoter, activeRole, simulatedDriverEmail]);

  // --- MOTOR DE ACTUALIZACIÓN PROGRAMADA (SOLO MADRUGADA) ---
  useEffect(() => {
    const checkAndForceUpdate = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const dateString = now.toISOString().split('T')[0];
      const lastUpdate = localStorage.getItem('last_daily_refresh');

      // Solo si la app quedó abierta de madrugada (3:00 AM - 4:59 AM)
      if ((currentHour === 3 || currentHour === 4) && lastUpdate !== dateString) {
        localStorage.setItem('last_daily_refresh', dateString);
        console.log("Ejecutando actualización programada de madrugada...");
        setTimeout(() => window.location.reload(), 1000);
      }
    };

    const interval = setInterval(checkAndForceUpdate, 15 * 60 * 1000);
    return () => clearInterval(interval);
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
            console.log("Orden de actualización global recibida desde la central.");
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

  const lastGpsTimeRef = useRef(0);

  useEffect(() => {
    if (!activeTrackingJobId || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        // Limit updates to every 15 seconds to prevent Firestore 'resource-exhausted'
        if (now - lastGpsTimeRef.current < 15000) return;
        lastGpsTimeRef.current = now;

        const { latitude, longitude } = position.coords;
        updateDoc(doc(db, 'transport_jobs', activeTrackingJobId), {
          liveLocation: { lat: latitude, lng: longitude, timestamp: now }
        }).catch(e => console.warn("Error enviando GPS [ERR-GPS-01]:", e));
      },
      (error) => console.warn("Error GPS en vivo [ERR-GPS-02]:", error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTrackingJobId, db]);

  const allClientsList = customClients.map(c => c.name).sort((a, b) => a.localeCompare(b));

  const myDriver = user ? (drivers.find(d => d.email === currentUserEmail && d.photo) || drivers.find(d => d.email === currentUserEmail)) : null;
  const loggedClientRecord = user ? customClients.find(c => c.email && c.email.toLowerCase().split(',').map(e => e.trim()).includes(currentUserEmail)) : null;

  // NUEVO: Detector de Part-Time. Si el usuario no existe en la DB de conductores pero SÍ tiene un trabajo asignado, lo dejamos entrar sin pedir fotos.
  const isPartTimeAssigned = user && !myDriver && jobs.some(j => j.assignedEmails && j.assignedEmails.includes(currentUserEmail));

  const globalStyles = null;

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
      <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-lg shadow-sm w-full max-w-md text-center border border-slate-200 dark:border-slate-800">
          <div className="flex justify-center items-center gap-6 mb-6">
            <img src="/LogoLogistica.png" alt="Logistica TS" className="h-16 w-auto object-contain" />
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-700"></div>
            <img src="/logo.png" alt="LogisticAPP" className="h-14 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1 tracking-tight">LogisticAPP</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Plataforma de Gestión y Control Operativo</p>

          {/* SECCIÓN 1: ACCESO DIRECTO PARA CLIENTES */}
          <div className="mt-8 mb-6">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 text-left">Portal de Clientes</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const btn = e.nativeEvent.submitter;
              const originalText = btn.innerHTML;
              btn.innerHTML = 'Verificando acceso...';
              btn.disabled = true;

              const email = e.target.email.value.trim().toLowerCase();
              try {
                // Usamos las herramientas ya importadas arriba
                const snap = await getDocs(collection(db, 'clients'));
                let foundClient = null;

                snap.forEach(doc => {
                  const data = doc.data();
                  if (data.email) {
                    const allowedEmails = data.email.split(',').map(em => em.trim().toLowerCase());
                    if (allowedEmails.includes(email)) {
                      foundClient = data.name;
                    }
                  }
                });

                if (foundClient) {
                  // CORRECCIÓN CLAVE: Guardamos el correo en el navegador para que TrackingView sepa quién es y le pida su PIN
                  localStorage.setItem('logisticapp_user_email', email);
                  navigate(`/?client=${encodeURIComponent(foundClient)}`);
                } else {
                  alert("El correo no está registrado ni asociado a ninguna empresa. Contacta al administrador.");
                  btn.innerHTML = originalText;
                  btn.disabled = false;
                }
              } catch (err) {
                console.error("Error de Firebase:", err);
                alert("Error de Firebase: " + err.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
              }
            }} className="flex flex-col gap-3">
              <input
                name="email"
                type="email"
                placeholder="Ingresa tu correo autorizado..."
                required
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 rounded-md text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 transition-colors"
              />
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold py-2.5 rounded-md transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                <Search className="w-4 h-4" /> Ingresar a mi portal
              </button>
            </form>
          </div>

          {/* SECCIÓN 2: ACCESO EQUIPO INTERNO */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 text-left">Equipo Interno</p>
            <button
              disabled={isGoogleLoading}
              onClick={async () => {
                if (isGoogleLoading) return;
                setIsGoogleLoading(true);
                try {
                  await signInWithPopup(auth, googleProvider);
                } catch (e) {
                  if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
                    alert("Error de Acceso: " + e.message);
                  }
                } finally {
                  setIsGoogleLoading(false);
                }
              }}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2.5 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGoogleLoading ? <Clock className="w-4 h-4 animate-spin text-slate-500" /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />}
              {isGoogleLoading ? 'Conectando...' : 'Ingresar con Google'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  // NUEVO: Pantalla de carga global mientras Firebase descarga la base de datos
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-center p-4">
        {globalStyles}
        <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sincronizando datos...</p>
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">LogisticAPP</p>
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
        `"${j.origin || ''}"`, `"${j.destination || ''}"`, `"${j.assignedDrivers?.map(d => d.name).join(' - ') || ''}"`, `"${realizedBy}"`, `"${st}"`, `"${new Date(j.createdAt).toLocaleString()}"`
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", "Reporte_Trabajos.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- CONTROL DE ONBOARDING ESTRICTO ---
  // Se excluye a los conductores con rol Part-Time de la exigencia de fotos de documentos
  const needsOnboarding = myDriver && myDriver.role !== 'part_time' && (
    !myDriver.photo || myDriver.photo === "" ||
    !myDriver.idFront || myDriver.idFront === "" ||
    !myDriver.idBack || myDriver.idBack === "" ||
    !myDriver.licenseFront || myDriver.licenseFront === "" ||
    !myDriver.licenseBack || myDriver.licenseBack === ""
  );

  // BLOQUEO ABSOLUTO: Nadie en modo "Conductor" pasa a la app sin sus 5 fotos.
  // EXCEPCIÓN: Conductores con rol part_time o asignados temporalmente entran directo a trabajar.
  if (activeRole === 'driver' && !isPartTimeAssigned && myDriver?.role !== 'part_time' && (needsOnboarding || !myDriver)) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-slate-800 dark:text-slate-200 font-sans pb-10">
        {globalStyles}
        <header className="fixed-nav-bar bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 px-4 flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-md border border-slate-200 dark:border-slate-700"><img src="/logo.png" className="w-7 h-7 object-contain" alt="Logo" /></div>
            <h1 className="font-semibold text-base tracking-tight">Verificación Obligatoria</h1>
          </div>
          {isRealAdmin ? (
            <button onClick={() => { setActiveRole('admin'); setRoleMenuOpen(false); }} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-md text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700">
              <LogOut className="w-3.5 h-3.5" /> Salir a Admin
            </button>
          ) : (
            <button onClick={() => signOut(auth)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-md text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700">
              <LogOut className="w-3.5 h-3.5" /> Salir
            </button>
          )}
        </header>
        <main className="max-w-md mx-auto p-4 pt-20 pb-10">
          {myDriver ? (
            <DriverOnboarding driver={myDriver} db={db} uploadImageToStorage={uploadImageToStorage} />
          ) : (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border text-center space-y-4 shadow-xs border-slate-200 dark:border-slate-800">
              <div className="relative w-14 h-14 mx-auto">
                <div className="absolute inset-0 border-2 border-slate-200 dark:border-slate-800 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <User className="absolute inset-0 m-auto w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-base">Creando credenciales...</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Estableciendo conexión segura con la central logística</p>
            </div>
          )}
        </main>
      </div>
    );
  }
  // -----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-slate-800 dark:text-slate-200 font-sans pb-28 mx-auto relative w-full z-0">

      {globalStyles}
      <header className="fixed-nav-bar bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 px-4 flex justify-between items-center h-14 sm:h-16">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo App" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
          </div>

          <h1 className="font-bold text-base sm:text-lg tracking-tight shrink-0 text-slate-900 dark:text-slate-100">
            LogisticAPP
          </h1>

          <div className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 ml-0.5 overflow-hidden">
            <img src="/LogoLogistica.png" alt="Logística TS SpA" className="h-6 sm:h-8 object-contain" />
          </div>
        </div>
        <div className="flex items-center gap-2">

          {/* BOTÓN TUERCA (AJUSTES) */}
          <div className="relative">
            <button
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setRoleMenuOpen(false);
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Settings className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-11 mt-1 w-64 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden z-[100]">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ajustes de App</p>
                </div>

                {/* PANEL DE COLA DE SUBIDAS MOVIDO A LA TUERCA */}
                {syncQueue.length > 0 && (
                  <div className="p-3 bg-slate-900 text-white border-b border-slate-800">
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"><CloudOff className="w-3.5 h-3.5 text-blue-400" /> Cola en Segundo Plano</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-none">
                      {syncQueue.map(task => (
                        <div key={task.id} className="flex justify-between items-center bg-slate-800 p-2 rounded-md text-xs border border-slate-700">
                          <span className="font-medium truncate mr-2">{task.name}</span>
                          {task.status === 'syncing' && <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />}
                          {task.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {task.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" title={task.error} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3.5 space-y-3.5">
                  {/* Estado de Red */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Señal de Red</span>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${isOnline ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/60'}`}>
                      {isOnline ? <><Wifi className="w-3.5 h-3.5" /> En línea</> : <><CloudOff className="w-3.5 h-3.5" /> Sin conexión</>}
                    </div>
                  </div>
                  {/* Switch Modo Oscuro */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      {darkMode ? <Moon className="w-4 h-4 text-blue-500" /> : <Sun className="w-4 h-4 text-amber-500" />} Modo Oscuro
                    </span>
                    <button onClick={() => setDarkMode(!darkMode)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {/* Permisos de Notificaciones */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Bell className={`w-4 h-4 ${notificationsEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`} /> Notificaciones
                    </span>
                    {!notificationsEnabled ? (
                      <button onClick={requestNotificationPermission} className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition-colors">Activar</button>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded text-[11px] font-semibold">Activas</span>
                    )}
                  </div>

                  {/* --- SÚPER BOTÓN MATA-CACHÉ (SOLUCIÓN DEFINITIVA XIAOMI/PWA) --- */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 w-full">
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
                    }} className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors flex justify-center items-center gap-2">
                      Actualizar App
                    </button>
                  </div>

                  {/* --- MATA-CACHÉ GLOBAL (SÓLO PARA ADMINISTRADORES) --- */}
                  {activeRole === 'admin' && (
                    <div className="pt-1 w-full">
                      <button onClick={() => {
                        showConfirm("¿Forzar a todos los celulares de la flota a recargarse y actualizarse en este mismo instante?", async () => {
                          try {
                            await setDoc(doc(db, 'system_config', 'force_refresh'), { timestamp: Date.now() });
                            showAlert("✅ Orden de actualización enviada a toda la flota.");
                          } catch (err) {
                            console.error(err);
                            showAlert("Error al enviar la orden.");
                          }
                        });
                      }} className="w-full py-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-md text-xs font-semibold transition-colors flex justify-center items-center gap-2">
                        Actualizar a Todos
                      </button>
                    </div>
                  )}

                  {/* --- BOTÓN CERRAR SESIÓN --- */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-2 truncate">{currentUserEmail}</p>
                    <button onClick={() => signOut(auth)} className="w-full py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-red-200 dark:border-red-900/50">
                      <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
                    </button>
                  </div>

                </div>
                {/* VERSIÓN DE LA APP */}
                <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-center border-t border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">LogisticAPP {APP_VERSION}</p>
                </div>
              </div>
            )}
          </div>
          {isRealAdmin && (
            <div className="relative">
              <button
                onClick={() => {
                  setRoleMenuOpen(!roleMenuOpen);
                  setSettingsOpen(false);
                }}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-md transition-colors border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span className="hidden md:inline">
                  {activeRole === 'admin' ? 'Modo: Admin' : activeRole === 'driver' ? (
                    simulatedDriverEmail
                      ? `Asistiendo a: ${drivers.find(dr => dr.email === simulatedDriverEmail)?.name?.split(' ')[0]}`
                      : 'Modo: Conductor'
                  ) : 'Modo: Cliente'}
                </span>
              </button>
              {roleMenuOpen && (
                <div className="absolute right-0 top-11 mt-1 w-72 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden z-[100] text-slate-800 dark:text-slate-200">
                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Panel de Control General</p></div>

                  <button onClick={() => { setActiveRole('admin'); setMainTab('jobs'); setSimulatedDriverEmail(''); setRoleMenuOpen(false); }} className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors ${activeRole === 'admin' ? 'text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40' : 'text-slate-700 dark:text-slate-300'}`}>
                    <Users className="w-4 h-4" /> Volver a Administrador
                  </button>

                  {/* SECCIÓN: ASISTIR/SIMULAR CONDUCTOR */}
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2"><Car className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Entrar como Conductor</p>

                    {/* BOTÓN RÁPIDO DE FAVORITO */}
                    {favDriverEmail && drivers.find(d => d.email === favDriverEmail) && (
                      <button onClick={() => { setSimulatedDriverEmail(favDriverEmail); setActiveRole('driver'); setMainTab('jobs'); setRoleMenuOpen(false); }} className="w-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100/70 dark:hover:bg-amber-950/50 text-amber-800 dark:text-amber-300 p-2 rounded-md text-xs font-semibold flex justify-between items-center transition-colors mb-2.5">
                        <div className="flex items-center gap-2"><Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Entrar como {drivers.find(d => d.email === favDriverEmail).name.split(' ')[0]}</div>
                        <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                      </button>
                    )}

                    {/* LISTA SCROLLEABLE INTERNA DE CONDUCTORES */}
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                      {drivers.filter(d => !d.isHidden).sort((a, b) => a.name.localeCompare(b.name)).map(d => {
                        const isCurrentActive = activeRole === 'driver' && simulatedDriverEmail === d.email;
                        return (
                          <div key={d.id} className={`flex items-center justify-between p-1 transition-colors group ${isCurrentActive ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-2 border-blue-600' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                            <button onClick={() => { setSimulatedDriverEmail(d.email); setActiveRole('driver'); setMainTab('jobs'); setRoleMenuOpen(false); }} className={`flex-1 text-left px-2 py-1.5 text-xs truncate transition-colors ${isCurrentActive ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-300 font-medium'}`}>
                              {d.name} {isCurrentActive && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded ml-1 font-mono">ACTIVO</span>}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setFavDriverEmail(d.email); localStorage.setItem('favDriverEmail', d.email); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Fijar como Favorito">
                              <Star className={`w-3.5 h-3.5 transition-colors ${favDriverEmail === d.email ? 'fill-amber-500 text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECCIÓN EXISTENTE: SIMULAR CLIENTE */}
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Ver Portal de Cliente</p>
                    <select value={simulatedClient} onChange={(e) => setSimulatedClient(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 p-2 rounded-md text-xs font-medium outline-none focus:border-blue-600 bg-white dark:bg-slate-950 dark:text-slate-200">
                      <option value="">Seleccionar Cliente...</option>
                      {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => { if (simulatedClient) { setActiveRole('client'); setRoleMenuOpen(false); } else { showAlert("Selecciona un cliente de la lista primero"); } }} className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-md transition-colors">Entrar a la vista Cliente</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <Routes>
        {/* RUTA COMODÍN: Atrapa la raíz (/) y cualquier ruta alterada por Vercel */}
        <Route path="*" element={
          <>
            {mainTab === 'jobs' && (
              <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-22">
                {activeRole === 'admin' ? (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-6 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <button onClick={() => { setAdminTab('dashboard'); setEditingJob(null); }} className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${adminTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><ClipboardList className="w-4 h-4" /> Monitor</button>
                      {adminPermissions?.create_jobs !== false && (
                        <button onClick={() => { setAdminTab('newJob'); setEditingJob(null); }} className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${adminTab === 'newJob' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Plus className="w-4 h-4" /> Crear</button>
                      )}
                      {adminPermissions?.manage_stats !== false && (
                        <button onClick={() => setAdminTab('stats')} className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${adminTab === 'stats' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Activity className="w-4 h-4" /> Estadísticas</button>
                      )}
                      {(isSuperAdmin || adminPermissions?.manage_users || adminPermissions?.manage_clients || adminPermissions?.manage_vehicles || adminPermissions?.manage_directory || adminPermissions?.manage_tolls || adminPermissions?.manage_equipment) && (
                        <button onClick={() => setAdminTab('config')} className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${adminTab === 'config' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Truck className="w-4 h-4" /> Config</button>
                      )}
                      {adminPermissions?.manage_history !== false && (
                        <button onClick={() => setAdminTab('history')} className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${adminTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><ShieldCheck className="w-4 h-4" /> Peritaje</button>
                      )}
                    </div>

                    {adminTab === 'dashboard' && (
                      <div className="space-y-5">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Monitor de Trabajos</h2>
                          <button onClick={exportToExcel} className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-md text-xs font-semibold flex justify-center items-center gap-2 transition-colors"><Download className="w-4 h-4" /> Exportar Excel</button>
                        </div>
                        <JobsList
                          jobs={jobs} drivers={drivers} vehicles={vehicles} role="admin"
                          onStartChecklist={(j) => { setSelectedJob(j); navigate('/checklist') }}
                          onEditJob={(j) => { setEditingJob(j); setAdminTab('newJob'); }}
                          onNewJob={(type) => { setEditingJob(null); setAdminTab('newJob'); }}
                          db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
                          onLoadMore={() => setJobLimit(prev => prev + 20)}
                          syncQueue={syncQueue}
                        />
                      </div>
                    )}

                    {adminTab === 'newJob' && <div><NewJobForm key={editingJob ? editingJob.id : 'new'} jobToEdit={editingJob} onCancelEdit={() => { setEditingJob(null); setAdminTab('dashboard'); }} allClientsList={allClientsList} vehicles={vehicles} vehicleModels={vehicleModels} drivers={drivers.filter(d => !d.isHidden)} db={db} showAlert={showAlert} onSuccess={() => setAdminTab('dashboard')} pushSyncTask={pushSyncTask} myDriver={myDriver} user={user} /></div>}

                    {adminTab === 'history' && <div><VehicleHistoryView db={db} showAlert={showAlert} /></div>}

                    {adminTab === 'stats' && <div><StatsView jobs={jobs} drivers={drivers} vehicles={vehicles} allClientsList={allClientsList} db={db} showAlert={showAlert} showConfirm={showConfirm} /></div>}

                    {isSuperAdmin && adminTab === 'config' && <div><ConfigView currentUserEmail={currentUserEmail} allClientsList={allClientsList} customClients={customClients} vehicles={vehicles} vehicleModels={vehicleModels} drivers={drivers} db={db} showAlert={showAlert} showConfirm={showConfirm} isSuperAdmin={isSuperAdmin} adminPermissions={adminPermissions} /></div>}
                  </>
                ) : (
                  <div className="space-y-5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Mis Trabajos Asignados</h2>
                    <JobsList
                      jobs={jobs} drivers={drivers} vehicles={vehicles} role="driver"
                      onStartChecklist={(j) => { setSelectedJob(j); navigate('/checklist') }}
                      onNewJob={(type) => setShowRequestJob(type)}
                      db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
                      onLoadMore={() => setJobLimit(prev => prev + 20)}
                      syncQueue={syncQueue}
                    />
                  </div>
                )}
              </main>
            )}


            {mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} db={db} />}
            {mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
            {mainTab === 'profile' && <DriverDashboardView myDriver={myDriver} jobs={jobs} expenses={expenses} drivers={drivers} currentUserEmail={currentUserEmail} db={db} />}
            {mainTab === 'quotes' && <QuotesView db={db} customClients={customClients} vehicles={vehicles} directoryList={directoryList} showAlert={showAlert} showConfirm={showConfirm} drivers={drivers} currentUserEmail={currentUserEmail} isSuperAdmin={isSuperAdmin} />}
            {mainTab === 'analytics' && <ChecklistAnalyticsView jobs={jobs} drivers={drivers} currentUserEmail={currentUserEmail} activeRole={activeRole} />}

            {mainTab === 'inbox' && (
              <main className="max-w-2xl mx-auto p-4 pt-20 pb-32">
                <div className="bg-slate-900 dark:bg-slate-800 text-white p-5 rounded-lg border border-slate-800 dark:border-slate-700 mb-5">
                  <h2 className="text-lg font-bold mb-1">Bandeja de Entrada</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">Sube aquí los PDFs o fotos de otras apps (CamScanner, etc) para enlazarlos directamente a tus traslados.</p>
                </div>

                <label className="w-full bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 p-5 rounded-lg font-semibold text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors mb-5">
                  <input type="file" accept="application/pdf,image/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files[0];
                    if (!f) return;
                    showAlert("⏳ Subiendo documento a tu bandeja...");
                    try {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        try {
                          const base64 = reader.result;
                          const ext = f.type.includes('pdf') ? 'pdf' : 'jpg';


                          // Subida dinámica que respeta el formato original (PDF o Imagen)
                          const { getStorage, ref, uploadString, getDownloadURL } = await import('firebase/storage');
                          const storage = getStorage();
                          const fileRef = ref(storage, `inbox/${currentUserEmail}/doc_bandeja_${Date.now()}.${ext}`);

                          // MAGIA: Declaramos explícitamente el contentType para evitar el bloqueo del navegador
                          const metadata = { contentType: f.type };
                          await uploadString(fileRef, base64, 'data_url', metadata);
                          const url = await getDownloadURL(fileRef);

                          const { addDoc, collection } = await import('firebase/firestore');
                          await addDoc(collection(db, 'inbox'), {
                            userEmail: currentUserEmail,
                            fileName: f.name || 'Documento Escaneado',
                            fileType: f.type,
                            url: url,
                            createdAt: Date.now()
                          });

                          e.target.value = ''; // Limpiamos la memoria del botón
                          showAlert("✅ ¡Subida exitosa! Presiona Confirmar para cerrar este aviso.");
                        } catch (uploadError) {
                          console.error("Error al subir:", uploadError);
                          e.target.value = '';
                          showAlert("❌ Error al subir el archivo.");
                        }
                      };
                      reader.readAsDataURL(f);
                    } catch (err) {
                      e.target.value = '';
                      showAlert("❌ Error al leer el documento.");
                    }
                  }} />
                  <div className="bg-blue-50 dark:bg-blue-950/50 p-2.5 rounded-md"><Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
                  SUBIR NUEVO ARCHIVO
                </label>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Archivos Pendientes ({inboxDocs.length})</h3>
                  {inboxDocs.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center">
                      <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No tienes documentos sin asignar.</p>
                    </div>
                  ) : (
                    inboxDocs.map(docItem => (
                      <div key={docItem.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-md border border-slate-200 dark:border-slate-700"><FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{docItem.fileName}</p>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{new Date(docItem.createdAt).toLocaleString()}</p>
                          </div>
                          <button onClick={async () => {
                            const { deleteDoc, doc } = await import('firebase/firestore');
                            showConfirm("¿Eliminar este documento?", () => deleteDoc(doc(db, 'inbox', docItem.id)));
                          }} className="p-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-100 transition-colors border border-red-200 dark:border-red-900/50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800">

                          <a href={docItem.url} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50">
                            <Eye className="w-3.5 h-3.5" /> VER
                          </a>

                          <select onChange={async (e) => {
                            const jobId = e.target.value;
                            if (!jobId) return;
                            showAlert("⏳ Asignando al traslado...");
                            try {
                              const { updateDoc, doc, deleteDoc } = await import('firebase/firestore');
                              const jobToUpdate = jobs.find(j => j.id === jobId);
                              const newChecklist = { ...(jobToUpdate?.checklist || {}), scandocPdfInbox: docItem.url };

                              await updateDoc(doc(db, 'transport_jobs', jobId), { checklist: newChecklist });
                              await deleteDoc(doc(db, 'inbox', docItem.id));

                              // GATILLADOR: Envío de correo automático para Revisión Técnica desde la Bandeja
                              const clientRecord = customClients.find(c => c.name === jobToUpdate?.client);
                              const targetEmail = clientRecord?.email?.split(',')[0]?.trim();
                              if (targetEmail) {
                                fetch('/api/notify-client', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    email: targetEmail,
                                    clientName: jobToUpdate?.client || 'Cliente',
                                    type: 'revision_tecnica',
                                    jobDetails: {
                                      id: jobId,
                                      vehicle: `${jobToUpdate?.brand || ''} ${jobToUpdate?.model || ''}`.trim() || 'Vehículo',
                                      plate: jobToUpdate?.plate || jobToUpdate?.vin || 'S/N',
                                      origin: jobToUpdate?.origin || 'Origen',
                                      destination: jobToUpdate?.destination || '',
                                      driverName: drivers.find(d => d.email === currentUserEmail)?.name || 'Conductor',
                                      checklist: newChecklist
                                    }
                                  })
                                }).catch(err => console.error("Error enviando correo PRT desde bandeja:", err));
                              }

                              showAlert("✅ Documento asignado y cliente notificado por correo.");
                            } catch (err) {
                              showAlert("❌ Error al asignar el documento.");
                            }
                          }} className="flex-[2] bg-blue-600 text-white py-2 px-3 rounded text-xs font-semibold outline-none cursor-pointer text-center appearance-none">
                            <option value="" className="text-center">AÑADIR A TRABAJO...</option>
                            {jobs.filter(j => j.status === 'accepted' && j.acceptedByEmail === currentUserEmail).map(j => (
                              <option key={j.id} value={j.id}>{j.plate || j.vin || 'S/N'} - {j.brand}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </main>
            )}

            <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40">
              {activeRole === 'quoter' ? (
                <button onClick={() => setMainTab('quotes')} className="flex flex-col items-center text-blue-600 dark:text-blue-400 transition-colors flex-1">
                  <div className="bg-blue-50 dark:bg-blue-950/50 p-1.5 rounded-md mb-0.5"><Receipt className="w-4 h-4" /></div>
                  <span className="text-[10px] font-semibold">Cotizar</span>
                </button>
              ) : (
                <>
                  {activeRole === 'admin' ? (
                    <button onClick={() => setMainTab('quotes')} className={`flex flex-col items-center transition-colors flex-1 ${mainTab === 'quotes' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                      <div className={`${mainTab === 'quotes' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-transparent'} p-1.5 rounded-md mb-0.5`}><Receipt className="w-4 h-4" /></div>
                      <span className="text-[10px] font-semibold">Cotizar</span>
                    </button>
                  ) : (
                    <button onClick={() => setShowRequestJob('traslado')} className="flex flex-col items-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-1">
                      <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-md mb-0.5"><Plus className="w-4 h-4" /></div>
                      <span className="text-[10px] font-semibold">Solicitar</span>
                    </button>
                  )}
                  <button onClick={() => setMainTab('jobs')} className={`flex flex-col items-center transition-colors flex-1 ${mainTab === 'jobs' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    <div className={`${mainTab === 'jobs' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-transparent'} p-1.5 rounded-md mb-0.5`}><ClipboardList className="w-4 h-4" /></div>
                    <span className="text-[10px] font-semibold">Trabajos</span>
                  </button>
                  <button onClick={() => setMainTab('ranking')} className={`flex flex-col items-center transition-colors flex-1 ${mainTab === 'ranking' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    <div className={`${mainTab === 'ranking' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-transparent'} p-1.5 rounded-md mb-0.5`}><Trophy className="w-4 h-4" /></div>
                    <span className="text-[10px] font-semibold">Ranking</span>
                  </button>

                  {(activeRole !== 'admin' || adminPermissions?.manage_expenses !== false) && (
                    <button onClick={() => setMainTab('expenses')} className={`flex flex-col items-center transition-colors flex-1 ${mainTab === 'expenses' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                      <div className={`${mainTab === 'expenses' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-transparent'} p-1.5 rounded-md mb-0.5`}><Wallet className="w-4 h-4" /></div>
                      <span className="text-[10px] font-semibold">Gastos</span>
                    </button>
                  )}
                  {activeRole === 'admin' && (
                    <button onClick={() => setMainTab('analytics')} className={`flex flex-col items-center transition-colors flex-1 ${mainTab === 'analytics' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                      <div className={`${mainTab === 'analytics' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-transparent'} p-1.5 rounded-md mb-0.5`}><ShieldCheck className="w-4 h-4" /></div>
                      <span className="text-[10px] font-semibold">Análisis</span>
                    </button>
                  )}
                  {activeRole === 'driver' && (
                    <button onClick={() => setMainTab('profile')} className={`flex flex-col items-center transition-colors flex-1 ${mainTab === 'profile' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                      <div className={`${mainTab === 'profile' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-transparent'} p-1.5 rounded-md mb-0.5`}><User className="w-4 h-4" /></div>
                      <span className="text-[10px] font-semibold">Perfil</span>
                    </button>
                  )}
                </>
              )}
            </nav>
          </>
        } />

        <Route path="/checklist" element={
          selectedJob ? (
            <main className="max-w-2xl mx-auto p-4 pt-20 pb-24">
              <ChecklistForm
                job={selectedJob} db={db} currentUserEmail={currentUserEmail}
                allClientsList={allClientsList}
                vehicles={vehicles}
                drivers={drivers} expenses={expenses}
                onCancel={() => {
                  navigate('/');
                }}
                onComplete={async () => {
                  try {
                    // Intentamos limpiar el borrador
                    if (selectedJob.id !== 'NEW_QUICK_JOB') {
                      await updateDoc(doc(db, 'transport_jobs', selectedJob.id), { draft: null });
                    }
                  } catch (e) {
                    // Si Firebase lo bloquea porque el trabajo ya se cerró, lo ignoramos en silencio
                  } finally {
                    // ESTO ASEGURA QUE LA PANTALLA SE CIERRE PASE LO QUE PASE
                    setSelectedJob(null);
                    navigate('/');
                  }
                }}
                showAlert={showAlert} showConfirm={showConfirm}
                uploadImageToStorage={uploadImageToStorage}
                pushSyncTask={pushSyncTask}
              />
            </main>
          ) : (
            /* MAGIA REACT: Te redirige al inicio SOLO si entras directo a esta URL sin datos */
            <Navigate to="/" replace />
          )
        } />
      </Routes>

      {/* Bandeja Flotante de Trabajo Offline */}
      {!isOnline && user && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[100] w-[92%] max-w-sm">
          <div className="bg-slate-900 text-white p-3.5 rounded-lg shadow-lg border border-slate-700 flex items-center gap-3">
            <div className="bg-amber-950/60 border border-amber-700/60 p-2 rounded-md relative shrink-0">
              <CloudOff className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-0.5">Modo Sin Conexión</p>
              <p className="text-[11px] text-slate-300 leading-tight">Trabajando con memoria caché local. Se sincronizará automáticamente al volver la red.</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR TRASLADO CON AUTOCOMPLETADO Y WAZE */}
      {showRequestJob && (
        <div className="fixed inset-0 bg-slate-950/65 flex items-center justify-center z-[9999] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const autoAssign = fd.get('autoAssign') === 'on';

            const originValue = fd.get('origin')?.trim();
            const destValue = fd.get('destination')?.trim();

            // MAGIA: Buscamos si el texto escrito coincide con algún lugar del directorio
            const matchedOrigin = directoryList.find(d => d.placeName.trim().toLowerCase() === originValue.toLowerCase());
            const matchedDest = directoryList.find(d => d.placeName.trim().toLowerCase() === destValue.toLowerCase());

            const isRequestMode = activeRole !== 'admin';
            const finalStatus = isRequestMode ? 'requested' : (autoAssign ? 'accepted' : 'pending');

            const newJob = {
              client: fd.get('client'),
              brand: fd.get('brand') || '',
              model: fd.get('model') || '',
              plate: fd.get('plateOrVin') ? fd.get('plateOrVin').toUpperCase() : 'S/N',
              vin: fd.get('plateOrVin') ? fd.get('plateOrVin').toUpperCase() : 'S/N',
              description: fd.get('description') || '',
              origin: originValue,
              destination: destValue || '',

              // Inyectamos la dirección, comuna y contactos en segundo plano para que Waze funcione
              originContactName: matchedOrigin?.contactName || '',
              originContactPhone: matchedOrigin?.contactPhone || '',
              originAddress: matchedOrigin?.address || '',
              originCommune: matchedOrigin?.commune || '',

              destContactName: matchedDest?.contactName || '',
              destContactPhone: matchedDest?.contactPhone || '',
              destAddress: matchedDest?.address || '',
              destCommune: matchedDest?.commune || '',

              tripType: (typeof showRequestJob === 'string' && showRequestJob !== 'true') ? showRequestJob : 'traslado',
              status: finalStatus,
              createdAt: Date.now(),
              scheduledDate: new Date().toISOString().split('T')[0],
              assignedDrivers: autoAssign ? [{ id: myDriver?.id || 'auto', name: myDriver?.name || currentUserEmail, email: currentUserEmail }] : [],
              assignedEmails: autoAssign ? [currentUserEmail] : [],
              // Si el conductor lo pide, evitamos que se acepte automáticamente hasta que el admin lo apruebe
              acceptedByEmail: (autoAssign && !isRequestMode) ? currentUserEmail : null,
              requestedBy: currentUserEmail
            };

            try {
              const { addDoc, collection } = await import('firebase/firestore');
              await addDoc(collection(db, 'transport_jobs'), newJob);
              setShowRequestJob(false);

              if (isRequestMode) {
                showAlert("✅ Solicitud de traslado enviada. Esperando aprobación del administrador.");
              } else {
                showAlert(autoAssign ? "✅ Traslado creado y asignado a ti exitosamente." : "✅ Traslado publicado en la central.");
              }
            } catch (err) {
              showAlert("Error al crear la solicitud.");
            }
          }} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm shadow-lg relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowRequestJob(false)} className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>

            <div className="flex items-center gap-3 mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="bg-blue-50 dark:bg-blue-950/50 p-2 rounded-md border border-blue-200 dark:border-blue-800/60"><Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Solicitar Trabajo</h3>
            </div>

            {/* SELECTOR DE TIPO DE TRABAJO (4 OPCIONES) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-md mb-4 gap-1">
              <button type="button" onClick={() => setShowRequestJob('traslado')} className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition-colors ${showRequestJob === 'traslado' || showRequestJob === true ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><Car className="w-3.5 h-3.5" /> Local</button>
              <button type="button" onClick={() => setShowRequestJob('simple')} className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition-colors ${showRequestJob === 'simple' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><FileText className="w-3.5 h-3.5" /> Servicio</button>
              <button type="button" onClick={() => setShowRequestJob('viaje')} className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition-colors ${showRequestJob === 'viaje' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><MapPin className="w-3.5 h-3.5" /> Regiones</button>
              <button type="button" onClick={() => setShowRequestJob('revision')} className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition-colors ${showRequestJob === 'revision' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><CheckCircle className="w-3.5 h-3.5" /> PRT</button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Empresa / Cliente</label>
                <select name="client" required className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 bg-white dark:bg-slate-950">
                  <option value="">Selecciona un cliente...</option>
                  {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {showRequestJob === 'simple' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Descripción del Servicio</label>
                    <input name="description" required placeholder="Ej: Instalación de GPS, Batería..." className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Patente / VIN (Opcional)</label>
                    <input name="plateOrVin" maxLength="17" placeholder="Ej: ABCD12 (Si aplica)" onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                      e.target.value = val;
                      if (val.length >= 5 && vehicles) {
                        const found = vehicles.find(v => v.plate === val || (v.vin && v.vin === val));
                        if (found && e.target.form.client && found.client) {
                          const exists = Array.from(e.target.form.client.options).some(opt => opt.value === found.client);
                          if (exists) e.target.form.client.value = found.client;
                        }
                      }
                    }} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-mono font-semibold uppercase text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <datalist id="request-brands-list">
                      {[...new Set(vehicles?.map(v => v.brand?.toUpperCase().trim()).filter(Boolean) || [])].sort().map((b, i) => (
                        <option key={i} value={b} />
                      ))}
                    </datalist>
                    <datalist id="request-models-list">
                      {[...new Set(vehicles?.map(v => v.model?.toUpperCase().trim()).filter(Boolean) || [])].sort().map((m, i) => (
                        <option key={i} value={m} />
                      ))}
                    </datalist>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Marca</label>
                      <input name="brand" list="request-brands-list" required placeholder="Ej: CHEVROLET" onChange={(e) => e.target.value = e.target.value.toUpperCase()} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 uppercase" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Modelo</label>
                      <input name="model" list="request-models-list" required placeholder="Ej: SPARK" onChange={(e) => e.target.value = e.target.value.toUpperCase()} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 uppercase" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Patente o VIN</label>
                    <input name="plateOrVin" required maxLength="17" placeholder="Ej: ABCD12" onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                      e.target.value = val;
                      if (val.length >= 5 && vehicles) {
                        const found = vehicles.find(v => v.plate === val || (v.vin && v.vin === val));
                        if (found) {
                          const form = e.target.form;
                          if (form.brand && found.brand) form.brand.value = found.brand;
                          if (form.model && found.model) form.model.value = found.model;
                          if (form.client && found.client) {
                            const exists = Array.from(form.client.options).some(opt => opt.value === found.client);
                            if (exists) form.client.value = found.client;
                          }
                        }
                      }
                    }} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-mono font-semibold uppercase text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600" />
                  </div>
                </>
              )}

              <datalist id="directory-places">
                {directoryList.map((d, i) => <option key={i} value={d.placeName} />)}
              </datalist>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Desde (Origen)</label>
                <input name="origin" list="directory-places" required placeholder="Toca para buscar o escribe..." className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Hasta (Destino)</label>
                {showRequestJob === 'revision' ? (
                  <select name="destination" required className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 cursor-pointer">
                    <option value="">Selecciona la Planta PRT...</option>
                    {prtList.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                  </select>
                ) : (
                  <input name="destination" list="directory-places" required placeholder="Toca para buscar o escribe..." className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600" />
                )}
              </div>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-md mt-2 cursor-pointer">
                <input type="checkbox" name="autoAssign" defaultChecked className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Asignarme este traslado a mí automáticamente</span>
              </label>
            </div>
            <button type="submit" className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-md transition-colors text-sm">Crear Solicitud</button>
          </form>
        </div>
      )}

      {dialogConfig && (
        <div className="fixed inset-0 bg-slate-950/65 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-lg w-full max-w-sm p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="bg-blue-50 dark:bg-blue-950/50 p-2 rounded-md border border-blue-200 dark:border-blue-800/60">
                {dialogConfig.type === 'confirm' ? <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" /> : <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">LogisticAPP</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 font-medium mb-5 text-sm leading-relaxed">
              {typeof dialogConfig.message === 'string'
                ? dialogConfig.message.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\uFE0F?\s*/gu, '')
                : dialogConfig.message}
            </p>
            <div className="flex gap-2.5">
              {dialogConfig.type === 'confirm' && <button onClick={closeDialog} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-colors">Cancelar</button>}
              <button onClick={() => { if (dialogConfig.onConfirm) dialogConfig.onConfirm(); closeDialog(); }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ADMIN: CREAR ANUNCIO --- */}
      {showBroadcastAdmin && (
        <div className="fixed inset-0 bg-slate-950/65 flex items-center justify-center z-[9999] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const msg = e.target.message.value.trim();
            if (!msg) return;
            try {
              await setDoc(doc(db, 'system_config', 'broadcast'), { message: msg, timestamp: Date.now(), active: true });
              setShowBroadcastAdmin(false);
              showAlert("✅ Anuncio enviado exitosamente a toda la flota.");
            } catch (err) { console.error(err); showAlert("Error enviando anuncio."); }
          }} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm shadow-lg relative">
            <button type="button" onClick={() => setShowBroadcastAdmin(false)} className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="bg-blue-50 dark:bg-blue-950/50 p-2 rounded-md border border-blue-200 dark:border-blue-800/60"><Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Comunicado Global</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">Envía un aviso que aparecerá en la pantalla de todos los conductores al abrir la aplicación.</p>

            {broadcast?.active && (
              <div className="mb-4 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-md border border-slate-200 dark:border-slate-700 relative">
                <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1 tracking-wider">Anuncio Activo Actual:</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">"{broadcast.message}"</p>
                <button type="button" onClick={async () => {
                  await setDoc(doc(db, 'system_config', 'broadcast'), { active: false }, { merge: true });
                  showAlert("Anuncio apagado. Ya no le saldrá a nadie.");
                }} className="mt-2.5 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded transition-colors border border-red-200 dark:border-red-900/50">Apagar Anuncio</button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Escribir Nuevo Mensaje</label>
              <textarea name="message" rows="4" required placeholder="Ej: Recuerden tomar fotografías claras a los comprobantes de peaje..." className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md p-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 resize-none"></textarea>
            </div>
            <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-md transition-colors text-xs">Emitir a toda la flota</button>
          </form>
        </div>
      )}

      {/* --- POP-UP CONDUCTORES: MOSTRAR ANUNCIO --- */}
      {user && broadcast?.active && broadcast.timestamp.toString() !== localDismissed && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="bg-slate-900 dark:bg-slate-800 p-5 text-center border-b border-slate-800">
              <div className="w-12 h-12 bg-blue-600 rounded-md flex items-center justify-center mx-auto mb-3">
                <Megaphone className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Aviso Importante</h3>
            </div>
            <div className="p-5 text-center flex-1 flex flex-col justify-center bg-white dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-6 leading-relaxed whitespace-pre-wrap">{broadcast.message}</p>
              <button onClick={() => {
                localStorage.setItem('dismissedBroadcast', broadcast.timestamp.toString());
                setLocalDismissed(broadcast.timestamp.toString());
              }} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors text-sm">
                Confirmar lectura
              </button>
            </div>
          </div>
        </div>
      )}

      <DevMenu />
    </div>
  );
}

// --- ENVOLTORIO MAESTRO DE NAVEGACIÓN ---
export default function App() {
  return (
    <Router>
      {/* ENVUELVE LA APP PARA ATRAPAR LAS CARGAS DIFERIDAS DE LAS VISTAS */}
      <React.Suspense fallback={
        <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cargando aplicación...</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">LogisticAPP</p>
        </div>
      }>
        <LogisticApp />
      </React.Suspense>
    </Router>
  );
}
