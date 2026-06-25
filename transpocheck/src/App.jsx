import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence, collection, addDoc, onSnapshot, updateDoc, setDoc, doc, deleteDoc, getDocs, query, where, orderBy, limit, deleteField } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage'; // <-- IMPORTADO CORRECTAMENTE
import { BrowserRouter as Router, useSearchParams, useNavigate } from 'react-router-dom';

// Eliminamos la importación global de jsPDF para que la app cargue más rápido (Lazy Loading)
import { 
  Car, MapPin, Camera, CheckCircle, FileText, Download, 
  Plus, User, Navigation, AlertCircle, Users, ClipboardList, Trash2, FileDown, LogOut, MoreVertical, Copy, Zap, Edit2, Bell, Share2, X, Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Truck, XCircle, Trophy, Eye, Clock, Save, Search,
  CloudOff, Wifi, QrCode, Sun, Moon, Settings, ChevronUp, ChevronDown, ChevronRight, Fuel, Megaphone, Star
} from 'lucide-react';
import SignaturePad from './components/ui/SignaturePad';
import CustomClientSelector from './components/ui/CustomClientSelector';
import LicensePlateBadge from './components/ui/LicensePlateBadge';
import VehicleShapeIcon from './components/ui/VehicleShapeIcon';
import SwipeButton from './components/ui/SwipeButton';
import WaitTimerBadge from './components/ui/WaitTimerBadge';
import { DEFAULT_CLIENTES, LICENCIAS, formatMoney, formatDateDisplay, resizeImage } from './utils/helpers';
import LeaderboardView from './components/views/LeaderboardView';
import RelayAcceptView from './components/views/RelayAcceptView';
import DriverOnboarding from './components/views/DriverOnboarding';
import ClientSignView from './components/views/ClientSignView';
import ExpensesView from './components/views/ExpensesView';
import ConfigView from './components/views/ConfigView';
import TrackingView from './components/views/TrackingView';
import NewJobForm from './components/views/NewJobForm';
import JobsList from './components/views/JobsList';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 

const uploadImageToStorage = async (base64String, folderPath, fileName) => {
  if (!base64String || !base64String.startsWith('data:image')) return base64String;
  const storageRef = ref(storage, `${folderPath}/${fileName}`);
  await uploadString(storageRef, base64String, 'data_url');
  return await getDownloadURL(storageRef);
};

let messaging = null;
isSupported().then((supported) => {
  if (supported) messaging = getMessaging(app);
});

enableMultiTabIndexedDbPersistence(db).catch((err) => {
  console.warn("Modo offline limitado (Multi-tab):", err.code);
});

const googleProvider = new GoogleAuthProvider();

function LogisticApp() {
  // Inicializamos el motor de navegación ultra-rápido de React Router
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const clientTrack = searchParams.get('client');
  const liveTrackId = searchParams.get('track'); 
  
  // Limpiamos la URL por si el escáner QR le agrega barras invertidas ("/") o espacios al final
  const rawSign = searchParams.get('sign');
  const signTrackId = rawSign ? rawSign.replace(/[^a-zA-Z0-9_-]/g, '') : null;

  // Detector del código de Relevo (Traspaso en Ruta)
  const rawRelay = searchParams.get('relay');
  const relayJobId = rawRelay ? rawRelay.replace(/[^a-zA-Z0-9_-]/g, '') : null;

  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customClients, setCustomClients] = useState([]);
  
  const [adminTab, setAdminTab] = useState('dashboard');
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [mainTab, setMainTab] = useState('jobs');
  const [activeRole, setActiveRole] = useState('driver');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [simulatedClient, setSimulatedClient] = useState('');
  const [simulatedDriverEmail, setSimulatedDriverEmail] = useState(''); // <-- NUEVO: Guarda a quién estamos simulando
  const [favDriverEmail, setFavDriverEmail] = useState(() => localStorage.getItem('favDriverEmail') || ''); // <-- NUEVO: Guarda al conductor favorito (Felipe)
  
  // Estados para Modo Oscuro, Conexión Offline y Tuerca
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // <-- NUEVO: Candado de base de datos
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [jobLimit, setJobLimit] = useState(300); // <-- AMPLIADO a 300 para que el Ranking y el Excel contabilicen todo el mes sin perder datos
  
  // NUEVO: Lectura Inteligente del Tema del Sistema Operativo
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const isFirstLoad = useRef(true);
  const driversRef = useRef([]);
  const [dialogConfig, setDialogConfig] = useState(null);

  // NUEVO: Estados y variables para el Anuncio Global (Pop-Up)
  const [broadcast, setBroadcast] = useState(null);
  const [showBroadcastAdmin, setShowBroadcastAdmin] = useState(false);
  const [localDismissed, setLocalDismissed] = useState(() => localStorage.getItem('dismissedBroadcast'));

  // Escuchador en tiempo real del Anuncio Global
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system_config', 'broadcast'), (docSnap) => {
      if (docSnap.exists()) setBroadcast(docSnap.data());
      else setBroadcast(null);
    });
    return () => unsub();
  }, [db]);

  // Escuchador de conexión a Internet y Cambios de Tema OS
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

  // Aplicador del Modo Oscuro Global
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);
  const showAlert = (message) => setDialogConfig({ type: 'alert', message });
  const showConfirm = (message, onConfirm) => setDialogConfig({ type: 'confirm', message, onConfirm });
  const closeDialog = () => setDialogConfig(null);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) { 
      // Detectamos que estamos dentro del APK (WebView) y no en Chrome web
      showAlert("Estás usando la versión App (APK). Las notificaciones son gestionadas directamente por el sistema Android."); 
      setNotificationsEnabled(true); // Ponemos el botón en verde "Activas" para no confundir al chofer
      return; 
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        showAlert("⏳ Permiso concedido. Generando token seguro...");
        
        if (messaging && user) {
          const token = await getToken(messaging, { vapidKey: 'BK8z3mxtN3JApx1nw-9cVLzsjp78ufh0qimwqsxJOTnRuMIbQ4HQgYWGkKJ8h9MWPpZYFC3WxbX9Y-jskpIaOHY' });
          if (token) {
            const driverSnap = driversRef.current.find(d => d.email === user.email);
            if (driverSnap) {
              await updateDoc(doc(db, 'drivers', driverSnap.id), { fcmToken: token });
              setNotificationsEnabled(true);
              showAlert("✅ ¡Éxito! Token guardado correctamente en la base de datos.");
            } else {
              showAlert(`❌ Error: Tu correo (${user.email}) no coincide con ningún conductor registrado.`);
            }
          } else {
            showAlert("❌ Error: Firebase no pudo generar el token.");
          }
        } else {
          showAlert("❌ Error: El servicio de mensajería (FCM) fue bloqueado por tu navegador o modo incógnito.");
        }
      } else {
        showAlert("⚠️ Rechazaste el permiso de notificaciones.");
      }
    } catch (error) {
      showAlert("❌ Error de sistema: " + error.message);
    }
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
      if ("Notification" in window && Notification.permission === "granted") {
        setNotificationsEnabled(true);
        // Escuchamos los mensajes silenciosos cuando la app está abierta en la pantalla
        if (messaging) {
          onMessage(messaging, (payload) => {
            triggerNotification(payload.notification.title, payload.notification.body);
          });
        }
      }
    });
    return () => unsub();
  }, []);

  // 1. Guardamos quién eres tú realmente de forma inalterable
  const actualUserEmail = user?.email?.toLowerCase();
  const isRealAdmin = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(actualUserEmail);

  // 2. MAGIA: Si eliges ayudar a un conductor, toda la App pensará que eres él. Si no, usa tu correo normal.
  const currentUserEmail = (activeRole === 'driver' && simulatedDriverEmail) ? simulatedDriverEmail : actualUserEmail;

  useEffect(() => {
    if (isRealAdmin) setActiveRole('admin');
  }, [isRealAdmin]);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  // --- HOOKS DE AUTO-REGISTRO Y DETECCIÓN DE CLIENTES MULTI-CUENTA ---
  // Prioridad: Si por error el sistema duplicó cuentas, rescata automáticamente la que ya tiene sus fotos subidas
  const myDriver = user ? (drivers.find(d => d.email === currentUserEmail && d.photo) || drivers.find(d => d.email === currentUserEmail)) : null;
  
  // Detección inteligente: separa los correos por coma y revisa si el usuario está en la lista de permitidos de algún cliente
  const loggedClientRecord = user ? customClients.find(c => c.email && c.email.toLowerCase().split(',').map(e => e.trim()).includes(currentUserEmail)) : null;
  const registeringRef = useRef(false);

  useEffect(() => {
    // CANDADO MAESTRO: Solo evalúa si falta un conductor cuando dataLoaded sea TRUE
    if (user && activeRole === 'driver' && dataLoaded && !myDriver && isOnline && !registeringRef.current) {
        const isClientAccount = customClients.some(c => c.email && c.email.toLowerCase().split(',').map(e => e.trim()).includes(currentUserEmail));
        
        // Solo auto-registra al conductor si NO ES ADMINISTRADOR y NO ES UNA CUENTA DE CLIENTE
        if (!isClientAccount && !isRealAdmin) {
          registeringRef.current = true;
          // Ejecutamos una función asíncrona directamente para hacer la verificación de seguridad
          (async () => {
            try {
              // VERIFICACIÓN BLINDADA: Consultamos directo al servidor de Firebase antes de crear nada
              const q = query(collection(db, 'drivers'), where('email', '==', currentUserEmail));
              const snap = await getDocs(q);
              
              if (snap.empty) {
                await addDoc(collection(db, 'drivers'), {
                  name: user.displayName || 'Conductor Nuevo',
                  email: currentUserEmail,
                  balance: 0,
                  licenses: [],
                  licenseExpiry: '',
                  createdAt: Date.now()
                });
              }
            } catch(e) {
              console.error("Error al auto-registrar:", e);
            } finally {
              registeringRef.current = false;
            }
          })();
        }
    }
  }, [user, activeRole, myDriver, dataLoaded, isOnline, currentUserEmail, db, customClients, isRealAdmin]);
  // --------------------------------------------------------------

  // --- NUEVO: RECOLECTOR DE BASURA (TRASH COLLECTOR) EN SEGUNDO PLANO ---
  // Elimina fotos Base64 de la memoria local de aquellos traslados que ya se completaron
  useEffect(() => {
    const cleanupDrafts = async () => {
      const finishedWithDrafts = jobs.filter(j => (j.status === 'completed' || j.status === 'failed') && j.draft);
      for (const j of finishedWithDrafts) {
         try { await updateDoc(doc(db, 'transport_jobs', j.id), { draft: deleteField() }); } 
         catch (e) { /* Ignorar si falla, lo intentará luego */ }
      }
    };
    if (jobs.length > 0) cleanupDrafts();
  }, [jobs, db]);

  useEffect(() => {
    if (!user) return;
    
    // APLICADA MEJORA: Paginación dinámica con límite variable (jobLimit)
    const qJobs = query(collection(db, 'transport_jobs'), orderBy('createdAt', 'desc'), limit(jobLimit));

    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const d = change.doc.data();
          // Solo notifica si es realmente nuevo (creado hace menos de 2 minutos)
          const isReallyNew = (Date.now() - (d.createdAt || 0)) < 120000;
          if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail) && isReallyNew) {
             triggerNotification('📍 ¡Nuevo Traslado!', `CLIENTE: ${d.client || 'Sin Cliente'}\nMARCA: ${d.brand || '-'}\nMODELO: ${d.model || '-'}\nPATENTE: ${d.plate || d.vin || 'S/N'}\nDESDE: ${d.origin || '-'}\nHASTA: ${d.destination || '-'}`);
          }
          if (change.type === 'modified' && d.status === 'accepted' && isRealAdmin && activeRole === 'admin') {
             const driverName = driversRef.current.find(drv => drv.email === d.acceptedByEmail)?.name || d.acceptedByEmail;
             triggerNotification('✅ Trabajo Aceptado', `Conductor: ${driverName}\nCLIENTE: ${d.client || 'Sin Cliente'}\nMARCA: ${d.brand || '-'}\nMODELO: ${d.model || '-'}\nPATENTE: ${d.plate || d.vin || 'S/N'}\nDESDE: ${d.origin || '-'}\nHASTA: ${d.destination || '-'}`);
          }
        });
      }
      // Ya vienen ordenados de Firebase, solo mapeamos
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      isFirstLoad.current = false;
    }, (error) => {
      console.error("Error en conexión en tiempo real Firebase:", error);
    });

    // OPTIMIZACIÓN 2: Traer solo los últimos 300 gastos
    const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(300));

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), snap => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoaded(true); // <-- Candado maestro abierto: Firebase terminó de cargar
    });
    const unsubExpenses = onSnapshot(qExpenses, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, 'clients'), snap => setCustomClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubDrivers(); unsubExpenses(); unsubVehicles(); unsubClients(); };
  }, [user, activeRole, currentUserEmail, isRealAdmin, jobLimit]);

  // --- MOTOR DE TRACKING GPS EN TIEMPO REAL (OPTIMIZADO BATERÍA/iOS) ---
  // 1. Aislamos el ID del trabajo para no re-renderizar todo cuando el GPS se mueve
  const activeTrackingJobId = React.useMemo(() => {
    if (!user || activeRole !== 'driver') return null;
    const activeJob = jobs.find(j => j.acceptedByEmail === currentUserEmail && j.status === 'accepted' && j.phase === 'picked_up');
    return activeJob ? activeJob.id : null;
  }, [jobs, user, activeRole, currentUserEmail]);

  // 2. Encendemos el GPS SOLAMENTE cuando el ID cambia (inicia o termina el viaje)
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

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeTrackingJobId, db]);
  // ---------------------------------------------------

  // Ahora TODOS los clientes provienen exclusivamente de tu base de datos (100% editables)
  const allClientsList = customClients.map(c => c.name).sort((a, b) => a.localeCompare(b));

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
      
      /* REGLAS MAESTRAS MODO OSCURO (Anula Tailwind) */
      .dark body { background-color: #020617 !important; color: #f8fafc !important; }
      .dark header.fixed-nav-bar { background-color: #0f172a !important; border-bottom: 1px solid #1e293b !important; }
      .dark .bg-white:not(canvas) { background-color: #0f172a !important; border-color: #1e293b !important; }
      .dark canvas { background-color: #ffffff !important; border-radius: 0.5rem; color: #000 !important; }
      .dark .bg-slate-50 { background-color: #020617 !important; border-color: #0f172a !important; }
      .dark .bg-slate-100 { background-color: #1e293b !important; }
      .dark .bg-slate-200 { background-color: #334155 !important; }
      
      .dark .text-slate-800, .dark .text-slate-900 { color: #f8fafc !important; }
      .dark .text-slate-700 { color: #e2e8f0 !important; }
      .dark .text-slate-600 { color: #cbd5e1 !important; }
      .dark .text-slate-500, .dark .text-slate-400 { color: #94a3b8 !important; }
      .dark .border-slate-100, .dark .border-slate-200, .dark .border-slate-300 { border-color: #1e293b !important; }
      
      .dark .bg-blue-50 { background-color: rgba(30, 58, 138, 0.3) !important; border-color: #1e3a8a !important; }
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
             <DriverOnboarding driver={myDriver} db={db} />
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
            <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors shadow-sm border border-white/10">
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
                        // 1. Matar la caché visual y de archivos
                        if ('caches' in window) {
                          caches.keys().then((names) => {
                            names.forEach(name => caches.delete(name));
                          });
                        }
                        // 2. Destruir Service Workers trabados por el navegador
                        if ('serviceWorker' in navigator) {
                          navigator.serviceWorker.getRegistrations().then(regs => {
                            regs.forEach(r => r.unregister());
                          });
                        }
                        // 3. BOMBA NUCLEAR: Destruir la base de datos congelada de Firebase (sin cerrar la sesión)
                        if (window.indexedDB && window.indexedDB.databases) {
                          window.indexedDB.databases().then(dbs => {
                            dbs.forEach(dbFile => {
                              // 'firestore' es donde Firebase guarda los trabajos offline
                              if (dbFile.name.startsWith('firestore')) {
                                window.indexedDB.deleteDatabase(dbFile.name);
                              }
                            });
                          });
                        }
                        // 4. Forzar recarga completa después de limpiar todo
                        setTimeout(() => window.location.reload(true), 300);
                    }} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors active:bg-blue-300">
                      FORZAR
                    </button>
                  </div>

                </div>
                {/* VERSIÓN DE LA APP */}
                <div className="bg-slate-50 p-2.5 text-center border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">LogisticAPP v.2.5 22</p>
                </div>
              </div>
            )}
          </div>
          {isRealAdmin && (
            <div className="relative">
              {/* Botón dinámico inteligente: se vuelve morado y parpadea si estás asistiendo a un conductor */}
              <button 
                onClick={() => setRoleMenuOpen(!roleMenuOpen)} 
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all border shadow-sm ${
                  (activeRole === 'driver' && simulatedDriverEmail) 
                    ? 'bg-purple-600 border-purple-400 text-white animate-pulse font-black' 
                    : 'bg-white/20 hover:bg-white/30 border-white/10 text-white font-bold backdrop-blur-sm'
                }`}
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
                       {drivers.sort((a, b) => a.name.localeCompare(b.name)).map(d => {
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
          <div className="hidden md:block text-right mr-2"><p className="text-xs text-blue-200 font-bold uppercase tracking-wider">Sesión iniciada</p><p className="text-sm font-extrabold">{currentUserEmail}</p></div>
          <button onClick={() => signOut(auth)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-white transition-colors" title="Cerrar sesión"><LogOut className="w-5 h-5" /></button>
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
                    onLoadMore={() => setJobLimit(prev => prev + 20)}
                  />
                </div>
              )}
              
              {adminTab === 'newJob' && <div className="animate-in zoom-in-[0.98] slide-in-from-bottom-8 duration-500 ease-out"><NewJobForm key={editingJob ? editingJob.id : 'new'} jobToEdit={editingJob} onCancelEdit={() => {setEditingJob(null); setAdminTab('dashboard');}} allClientsList={allClientsList} vehicles={vehicles} drivers={drivers} db={db} showAlert={showAlert} onSuccess={() => setAdminTab('dashboard')} /></div>}
              {adminTab === 'config' && <div className="animate-in zoom-in-[0.98] duration-300"><ConfigView allClientsList={allClientsList} customClients={customClients} vehicles={vehicles} drivers={drivers} db={db} showAlert={showAlert} showConfirm={showConfirm} /></div>}
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Mis Trabajos Asignados</h2>
              <JobsList 
                 jobs={jobs} drivers={drivers} role="driver" 
                 onStartChecklist={(j) => {setSelectedJob(j); setCurrentView('checklist')}} 
                 db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} allClientsList={allClientsList}
                 onLoadMore={() => setJobLimit(prev => prev + 20)}
              />
            </div>
          )}
        </main>
      )}

      {currentView === 'main' && mainTab === 'ranking' && <LeaderboardView jobs={jobs} drivers={drivers} isAdminView={activeRole === 'admin'} />}
      {currentView === 'main' && mainTab === 'expenses' && <ExpensesView role={activeRole} drivers={drivers} jobs={jobs} expenses={expenses} db={db} currentUserEmail={currentUserEmail} showAlert={showAlert} showConfirm={showConfirm} />}
      
      {currentView === 'checklist' && selectedJob && (
        <main className="max-w-2xl mx-auto p-4 pt-20 sm:pt-24 pb-24 animate-in zoom-in-[0.98] slide-in-from-bottom-8 duration-500 ease-out">
          <ChecklistForm 
             job={selectedJob} db={db} currentUserEmail={currentUserEmail} 
             allClientsList={allClientsList}
             vehicles={vehicles}
             drivers={drivers} expenses={expenses} 
             onCancel={() => { 
                // Ya no eliminamos el borrador al presionar Salir, para que se mantenga en Firebase
                setCurrentView('main');
             }} 
             onComplete={async () => { 
                // Limpiamos la base de datos de basura solo cuando el trabajo se finalizó con éxito
                if (selectedJob.id !== 'NEW_QUICK_JOB') await updateDoc(doc(db, 'transport_jobs', selectedJob.id), { draft: null });
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

function ChecklistForm({ job, db, currentUserEmail, onCancel, onComplete, showAlert, showConfirm, allClientsList, drivers, expenses, vehicles }) {
  const isQuick = job.id === 'NEW_QUICK_JOB'; 
  const localStorageKey = `checklist_draft_${job.id}`;

  // BUSCAMOS SI LA PATENTE YA TIENE DATOS DE DOCUMENTOS GUARDADOS EN LA FLOTA
  const matchedVehicle = vehicles?.find(v => v.plate === (job.plate || job.vin)?.toUpperCase());
  const initialDocs = matchedVehicle?.docs || { soap:false, permiso:false, revTecnica:false, gases:false };
  const initialDocsExpiry = matchedVehicle?.docsExpiry || {};
  const initialReminders = matchedVehicle?.internalReminders || []; 

  // Sincroniza automáticamente lo seleccionado en la tarjeta de traslado del flujo principal
  const defaultData = {
    client: job.client||'', manualClient: '', brand: job.brand||'', model: job.model||'', plateOrVin: job.plate||job.vin||'', origin: job.origin||'', destination: job.destination||'', vehicleType: job.vehicleType||'auto', fuelLevel: 50, photos: { front:false, left:false, right:false, back:false, tire:false, dashboard:false, det1:false, det2:false, det3:false, det4:false }, 
    docs: job.checklist?.docs || initialDocs, 
    docsExpiry: job.checklist?.docsExpiry || initialDocsExpiry, 
    internalReminders: job.checklist?.internalReminders || initialReminders, 
    observations: '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null,
    rtStatus: job.prt_result ? job.prt_result : 'aprobado', 
    rtRejectReason: job.prt_reason ? job.prt_reason : '', 
    rtReturnOption: 'origin', rtReturnDestination: '' 
  };
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(defaultData);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false); // <-- NUEVO ESTADO PARA QR (Idea 8)
  const [fullScreenImage, setFullScreenImage] = useState(null); // <-- NUEVO: ESTADO PARA VER FOTOS EN GRANDE

  // LÓGICA DE BORRADORES Y FIRMA EN FIRESTORE (Reemplaza a localStorage)
  useEffect(() => {
    if (isQuick || !job.id) return;
    let isFirstLoad = true;
    const unsub = onSnapshot(doc(db, 'transport_jobs', job.id), (docSnap) => {
      const data = docSnap.data();
      
      // 1. Cargar borrador si existe en Firebase (solo la primera vez al entrar al componente)
      if (isFirstLoad) {
        if (data?.draft) {
          setFormData(data.draft.formData);
          setStep(data.draft.step || 1);
          setIsDraftLoaded(true);
        }
        isFirstLoad = false;
      }

      // 2. Escuchar siempre en tiempo real si el cliente firma desde su celular
      if (data?.checklist?.clientSigned) {
        setFormData(prev => ({
          ...prev,
          signatureData: data.checklist.signatureData,
          receiverName: data.checklist.receiverName,
          receiverRut: data.checklist.receiverRut,
          clientComments: data.checklist.clientComments || ''
        }));
      }
    });
    return () => unsub();
  }, [job.id, isQuick, db]);

  // Guardado Automático de Borrador en Firestore (en vez de local)
  useEffect(() => {
    if (isQuick || !job.id) return;
    const timer = setTimeout(() => {
      // FILTRO DE SEGURIDAD: Limpiamos los Base64 gigantes del borrador para evitar el límite de 1MB de Firestore
      const draftData = JSON.parse(JSON.stringify(formData));
      for (const key in draftData.photos) {
         // Si la foto no es un link de Storage (http), la quitamos del borrador
         if (draftData.photos[key] && !draftData.photos[key].startsWith('http')) {
             draftData.photos[key] = false; 
         }
      }
      // La firma es muy ligera (10KB), pero por seguridad extrema también la filtramos
      if (draftData.signatureData && !draftData.signatureData.startsWith('http')) {
         draftData.signatureData = null;
      }

      updateDoc(doc(db, 'transport_jobs', job.id), { draft: { step, formData: draftData } }).catch(() => {});
    }, 2000); // 2 segundos de retraso para no saturar la base de datos
    return () => clearTimeout(timer);
  }, [step, formData, job.id, isQuick, db]);

  const [processingAction, setProcessingAction] = useState(null);

  // --- MOTOR MAESTRO DE SINCRONIZACIÓN DE FOTOS A STORAGE ---
  const syncFilesToStorage = async (currentData) => {
    const d = { ...currentData };
    const uploadPromises = [];
    const uploadedPhotos = {};
    const jobIdFolder = job.id === 'NEW_QUICK_JOB' ? `quick_${Date.now()}` : job.id;

    for (const [key, val] of Object.entries(d.photos)) {
      if (val && val.startsWith('data:image')) {
        const p = uploadImageToStorage(val, `checklists/${jobIdFolder}`, `photo_${key}_${Date.now()}.jpg`)
          .then(url => uploadedPhotos[key] = url);
        uploadPromises.push(p);
      } else {
        uploadedPhotos[key] = val;
      }
    }
    await Promise.all(uploadPromises);
    d.photos = uploadedPhotos;

    if (d.signatureData && d.signatureData.startsWith('data:image')) {
       d.signatureData = await uploadImageToStorage(d.signatureData, `checklists/${jobIdFolder}`, `signature_${Date.now()}.jpg`);
    }
    return d;
  };

  // Función para generar y mandar el link de firma
  const handleRemoteSignRequest = async () => {
    if (isQuick) return showAlert("⚠️ Para usar la Firma Remota en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    setProcessingAction('wapp');
    try {
      // 1. Sincronizamos fotos pesadas a Storage antes de guardar el documento
      const syncedData = await syncFilesToStorage(formData);
      setFormData(syncedData); // Actualizamos el estado para que el botón Finalizar no vuelva a subirlas

      const url = `${window.location.href.split('?')[0]}?sign=${job.id}`;
      const textToShare = `¡Hola! Por favor firma el acta de recepción y revisa las fotografías del vehículo aquí:\n${url}`;

      const textArea = document.createElement("textarea");
      textArea.value = textToShare;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);

      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: syncedData }, { merge: true });

      if (navigator.share) {
        try { await navigator.share({ title: 'Firma de Recepción', text: textToShare }); } catch (err) { showAlert("✅ Link copiado al portapapeles automáticamente."); }
      } else {
        showAlert("✅ Link copiado al portapapeles. ¡Pégalo en WhatsApp!");
      }
    } catch (e) { 
      console.error(e); 
      showAlert("Error al preparar la firma remota. Verifica tu conexión.");
    }
    finally { setProcessingAction(null); }
  };

  // Función para guardar datos antes de mostrar el QR
  const handleOpenQR = async () => {
    if (isQuick) return showAlert("⚠️ Para usar el Código QR en un trabajo nuevo (Desde 0), PRIMERO debes presionar 'Finalizar y Guardar' abajo.");
    if (!navigator.onLine) return showAlert("⚠️ Tu celular no tiene señal en este momento. Usa 'Compartir Link' y envíalo cuando recuperes la conexión.");
    
    setProcessingAction('qr');
    try {
      const syncedData = await syncFilesToStorage(formData);
      setFormData(syncedData);
      await setDoc(doc(db, 'transport_jobs', job.id), { checklist: syncedData }, { merge: true });
      setQrOpen(true);
    } catch (e) {
      console.error(e);
      showAlert("Error al generar el QR. Revisa tu conexión.");
    } finally { setProcessingAction(null); }
  };

  const setF = (f, v) => setFormData(p => ({...p, [f]:v}));

  // FUNCIONES PARA LOS AVISOS INTERNOS
  const handleReminderChange = (index, field, value) => {
    const newRems = [...(formData.internalReminders || [])];
    newRems[index][field] = value;
    setF('internalReminders', newRems);
  };
  const addReminder = () => setF('internalReminders', [...(formData.internalReminders || []), { id: Date.now().toString(), text: '', photo: null, resolved: false }]);
  const removeReminder = (index) => {
    const newRems = [...(formData.internalReminders || [])];
    newRems.splice(index, 1);
    setF('internalReminders', newRems);
  };

  const clearDraft = () => {
    showConfirm("¿Eliminar borrador y empezar de nuevo?", async () => {
      if (!isQuick) await updateDoc(doc(db, 'transport_jobs', job.id), { draft: null });
      setFormData(defaultData);
      setStep(1);
      setIsDraftLoaded(false);
    });
  };

  const handlePic = async (e, id) => {
    const f=e.target.files[0]; if(!f)return;
    try {
      // EQUILIBRIO PERFECTO: Subimos a 720px de ancho y 60% de calidad.
      // Las fotos se verán completamente nítidas en el PDF,
      // pero manteniendo un peso seguro para Firebase.
      const dataUrl = await resizeImage(f, 720, 0.6); 
      setFormData(prev => {
        const newData = { ...prev, photos: { ...prev.photos, [id]: dataUrl } };
        // Si la foto era un detalle tocado en el auto, guardamos el pin y su coordenada
        if (prev.pendingPin && prev.pendingPin.id === id) {
          newData.detailPins = [...(prev.detailPins || []), prev.pendingPin];
          newData.pendingPin = null;
        }
        return newData;
      });
    } catch(err){ 
      console.error("Error al procesar la foto:", err);
      showAlert("Error al procesar la foto. Intenta con una imagen más pequeña."); 
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.noReception && !formData.signatureData) return showAlert("La firma del receptor es mandatoria.");
    setIsSubmitting(true);
    
    let d = {...formData}; 
    d.client = d.client === 'OTRO' ? d.manualClient : d.client; 

    if(d.noReception) { 
      d.receiverName="ENTREGA SIN RECEPCIÓN"; 
      d.receiverRut="N/A"; 
    }

    // --- MAGIA STORAGE: SUBIR FOTOS Y FIRMA A LA NUBE PRIMERO ---
    try {
      // Utilizamos el motor central de sincronización
      d = await syncFilesToStorage(d);
    } catch (uploadError) {
      console.error("Error subiendo imágenes:", uploadError);
      showAlert("Hubo un error subiendo las imágenes a la nube. Verifica tu internet.");
      setIsSubmitting(false);
      return;
    }
    // -----------------------------------------------------------

    // --- MAGIA GPS: CAPTURAMOS LA UBICACIÓN INVISIBLEMENTE ANTES DE GUARDAR ---
    const getGPS = () => new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => resolve(null), // Si rechaza permisos o falla, devolvemos null para no bloquear el guardado de la app
        { timeout: 6000, enableHighAccuracy: true } // Máximo 6 segundos de espera
      );
    });

    if (!d.location) {
      const coords = await getGPS();
      if (coords) d.location = coords;
    }
    // -------------------------------------------------------------------------
    
    const fd = { scheduledDate: new Date().toISOString().split('T')[0], client: d.client, brand: d.brand, model: d.model, vin: d.plateOrVin, plate: d.plateOrVin, origin: d.origin, destination: d.destination, status: 'completed', completedAt: Date.now(), checklist: d, tripType: job.tripType || 'traslado' };
    
    try {
      // --- PARTE 2: AUTOMATIZAR MÚLTIPLES GASTOS (COMBUSTIBLE + PRT) ---
      let totalToDeduct = 0;
      const expensesToRegister = [];

      // Función interna para limpiar números y añadir a la lista
      const processExpense = (amountStr, detailStr) => {
        const num = Number(String(amountStr).replace(/[^0-9]/g, ''));
        if (num > 0) {
          totalToDeduct += num;
          expensesToRegister.push({ amount: num, detail: detailStr });
        }
      };

      // 1. Leer Gasto de Combustible
      if (d.hasFuelCharge && d.fuelChargeAmount) {
        processExpense(d.fuelChargeAmount, `Carga Combustible (Patente: ${d.plateOrVin || 'S/N'})`);
      }
      
      // 2. Leer Gastos PRT (Solo si es Revisión Técnica)
      if (job.tripType === 'revision') {
        if (job.rtData?.revision && d.prtCostRevision) processExpense(d.prtCostRevision, `Valor Revisión Técnica (Patente: ${d.plateOrVin || 'S/N'})`);
        if (job.rtData?.inspeccion && d.prtCostInspeccion) processExpense(d.prtCostInspeccion, `Valor Inspección Visual (Patente: ${d.plateOrVin || 'S/N'})`);
        if (job.rtData?.frenos && d.prtCostFrenos) processExpense(d.prtCostFrenos, `Valor Cert. Frenos (Patente: ${d.plateOrVin || 'S/N'})`);
      }

      // Si hubo algún gasto, lo procesamos
      if (totalToDeduct > 0) {
        const currentDriver = drivers?.find(drv => drv.email === currentUserEmail);
        const isAdminUser = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(currentUserEmail);

        if (currentDriver) {
          const currentBalance = currentDriver.balance || 0;
          
          // REGLA: Si es conductor y el gasto supera su fondo, BLOQUEAR envío del checklist
          if (!isAdminUser && totalToDeduct > currentBalance) {
              return showAlert(`No puedes enviar el checklist. Intentas rendir ${formatMoney(totalToDeduct)} en gastos, pero tu fondo actual es de solo ${formatMoney(currentBalance)}. Pide a la central que te asigne más dinero e intenta de nuevo.`);
          }

          const newBalance = currentBalance - totalToDeduct;

          // A. Descontar del saldo del conductor TODO sumado
          await updateDoc(doc(db, 'drivers', currentDriver.id), { balance: newBalance });

          // B. Registrar CADA gasto individualmente en la pestaña Finanzas
          for (const exp of expensesToRegister) {
            await addDoc(collection(db, 'expenses'), {
              driverId: currentDriver.id,
              driverEmail: currentDriver.email,
              driverName: currentDriver.name,
              type: 'expense',
              amount: exp.amount,
              detail: exp.detail,
              jobId: job.id === 'NEW_QUICK_JOB' ? '' : job.id,
              deductedAmount: exp.amount,
              createdAt: Date.now()
            });
          }
        }
      }
      // ----------------------------------------------------

      // --- NUEVO: GUARDAR FECHAS Y ALERTAS EN EL PERFIL DEL VEHÍCULO ---
      if (d.plateOrVin) {
          const plateUpper = d.plateOrVin.toUpperCase();
          const vehRef = collection(db, 'vehicles');
          const q = query(vehRef, where('plate', '==', plateUpper));
          const querySnapshot = await getDocs(q);
          
          // Filtramos los avisos "Solucionados" para que desaparezcan en el próximo viaje
          const activeReminders = (d.internalReminders || []).filter(r => !r.resolved);

          if (!querySnapshot.empty) {
              // Actualizar vehículo existente
              const vehDocId = querySnapshot.docs[0].id;
              await updateDoc(doc(db, 'vehicles', vehDocId), {
                  docs: d.docs,
                  docsExpiry: d.docsExpiry || {},
                  internalReminders: activeReminders
              });
          } else {
              // Crear vehículo nuevo
              await addDoc(vehRef, { 
                  plate: plateUpper, brand: d.brand, model: d.model, client: d.client, 
                  docs: d.docs, docsExpiry: d.docsExpiry || {}, 
                  internalReminders: activeReminders,
                  createdAt: Date.now() 
              });
          }
      }
      // ----------------------------------------------------------------------------

      if(isQuick) { 
          fd.assignedDriverName="Auto-creado"; fd.acceptedByEmail=currentUserEmail; 
          await addDoc(collection(db,'transport_jobs'), fd); 
      }
      else { 
          if (job.tripType === 'revision' && d.rtStatus === 'rechazado') {
             fd.status = 'failed';
             fd.failedReason = d.rtRejectReason || 'Revisión Técnica Rechazada';
             
             const cloneJob = {
                scheduledDate: d.scheduledDate || null, client: d.client || '', brand: d.brand || '', model: d.model || '', vin: d.plateOrVin || '', plate: d.plateOrVin || '', origin: d.origin || '', destination: d.destination || '',
                tripType: job.tripType || 'traslado', rtData: job.rtData || null,
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
      // AHORA MOSTRARÁ EL ERROR REAL DE FIREBASE EN LA PANTALLA
      showAlert(`Error de base de datos: ${error.message}`); 
    } finally { setIsSubmitting(false); }
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
      
      {/* Barra Pegajosa Flotante Dinámica */}
      <div className="sticky top-[64px] sm:top-[80px] z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-5 py-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]">
         <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso del Acta</span>
            {/* Cálculo de progreso al vuelo */}
            <span className="text-xs font-black text-blue-600">
               {(() => {
                 let p = 0;
                 if (formData.brand && formData.model && formData.plateOrVin) p += 25;
                 if (formData.fuelLevel !== undefined) p += 25;
                 if (Object.values(formData.photos).filter(v => v).length >= 2) p += 25;
                 if (formData.signatureData || formData.noReception) p += 25;
                 return p;
               })()}%
            </span>
         </div>
         <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full transition-all duration-500 ease-out" style={{width: `${
                 (formData.brand ? 25 : 0) + (formData.fuelLevel !== undefined ? 25 : 0) + (Object.values(formData.photos).filter(v => v).length >= 2 ? 25 : 0) + (formData.signatureData || formData.noReception ? 25 : 0)
            }%`}}></div>
         </div>
      </div>

      <div className="p-5">
        {/* Barra superior de pestañas táctiles e interactivas */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-5 border-b border-slate-100 scrollbar-none">
          {[
            { id: 1, label: '📋 Datos' },
            { id: 2, label: '📄 Docs' },
            { id: 3, label: '💬 Notas' },
            { id: 4, label: '📸 Fotos' },
            { id: 5, label: '⛽ Comb. & Espera' },
            { id: 6, label: '✍️ Entrega' }
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setStep(t.id)} className={`px-3 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all shrink-0 ${step === t.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5 text-sm">
          
          {/* PESTAÑA 1: DATOS */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {isQuick ? (
                <div className="space-y-2">
                   <select value={formData.client} onChange={(e) => setF('client', e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 bg-white outline-none focus:border-blue-500">
                      <option value="">Selecciona el Cliente...</option>
                      {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="OTRO">Otro (Ingreso Manual)</option>
                   </select>
                   {formData.client === 'OTRO' && <input value={formData.manualClient} onChange={e=>setF('manualClient',e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 mt-2"/>}
                </div>
              ) : (
                <input value={formData.client} onChange={e=>setF('client',e.target.value)} placeholder="Cliente" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 bg-slate-50" readOnly/>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <input value={formData.brand} onChange={e=>setF('brand',e.target.value)} placeholder="Marca" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
                <input value={formData.model} onChange={e=>setF('model',e.target.value)} placeholder="Modelo" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800"/>
              </div>
              <input value={formData.plateOrVin} onChange={e=>setF('plateOrVin',e.target.value)} placeholder="Patente o VIN" className="w-full border-2 border-slate-300 bg-slate-100 p-3 rounded-xl font-black uppercase text-slate-800 shadow-inner mt-2"/>
              
              {job.tripType === 'revision' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 mt-4">
                  <h3 className="text-sm font-extrabold text-blue-600 uppercase tracking-wider">Resultado de la Revisión</h3>
                  <select value={formData.rtStatus} onChange={e=>setF('rtStatus', e.target.value)} className={`w-full border-2 p-3.5 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <option value="aprobado">✅ APROBADO</option>
                    <option value="rechazado">❌ RECHAZADO</option>
                  </select>
                  {formData.rtStatus === 'rechazado' && (
                    <input value={formData.rtRejectReason} onChange={e=>setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required={formData.rtStatus === 'rechazado'} className="w-full border-2 border-red-300 p-3 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2" />
                  )}
                  {formData.rtStatus === 'aprobado' && (
                    <div className="mt-2 p-3 border border-green-200 bg-white rounded-xl space-y-2">
                      <p className="text-xs font-bold text-green-800">¿Hacia dónde se dirige el vehículo tras aprobar?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                          Volver al Origen
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e=>setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600"/>
                          Otro Destino
                        </label>
                      </div>
                      {formData.rtReturnOption === 'other' && (
                        <input value={formData.rtReturnDestination} onChange={e=>setF('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required={formData.rtReturnOption === 'other'} className="w-full border-2 border-green-300 p-2.5 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 2: DOCUMENTOS */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Documentos del Vehículo</h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[{ id: 'soap', label: 'SOAP', icon: <FileText className="w-5 h-5"/> }, { id: 'permiso', label: 'Permiso Circ.', icon: <MapPin className="w-5 h-5"/> }, { id: 'revTecnica', label: 'Rev. Técnica', icon: <CheckCircle className="w-5 h-5"/> }, { id: 'gases', label: 'Gases', icon: <CloudOff className="w-5 h-5"/> }].map(doc => (
                  <div key={doc.id} className="flex flex-col gap-2">
                    <button 
                      type="button" 
                      onClick={() => setF('docs', { ...formData.docs, [doc.id]: !formData.docs[doc.id] })} 
                      className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all duration-200 select-none shadow-sm ${formData.docs[doc.id] ? 'border-green-500 bg-green-500 text-white shadow-green-200' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:border-slate-300'}`}
                    >
                      {formData.docs[doc.id] ? <CheckCircle className="w-6 h-6 animate-in zoom-in"/> : doc.icon}
                      <span className="font-black text-xs uppercase tracking-wider">{doc.label}</span>
                    </button>
                    {formData.docs[doc.id] && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-green-50 border border-green-200 p-2 rounded-xl flex flex-col gap-1 shadow-inner">
                          <p className="text-[9px] font-extrabold text-green-700 uppercase tracking-widest text-center">Vencimiento</p>
                          <input type="date" value={formData.docsExpiry?.[doc.id] || ''} onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} className="w-full bg-white border border-green-200 p-1.5 rounded-lg text-xs font-black text-slate-700 outline-none focus:border-green-500 text-center" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PESTAÑA 3: OBSERVACIONES Y ALERTAS INTERNAS */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Observaciones Generales</h3>
              <textarea className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[90px]" placeholder="Escribe aquí si hay algún daño, rayón o comentario del estado visual del vehículo..." value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />

              <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 mt-4 shadow-sm">
                  <h3 className="text-sm font-extrabold text-amber-800 mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Alertas Internas de Patente</h3>
                  <p className="text-[10px] font-bold text-amber-700 mb-4 leading-tight">Avisos privados que no salen en el PDF. Sirven como historial para el próximo traslado.</p>
                  
                  {(formData.internalReminders || []).map((rem, idx) => (
                      <div key={rem.id} className={`p-3 rounded-xl border-2 mb-3 bg-white transition-all ${rem.resolved ? 'border-green-300 opacity-60 grayscale-[50%]' : 'border-amber-300 shadow-sm'}`}>
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aviso #{idx + 1}</span>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200 transition-colors">
                                  <input type="checkbox" className="w-4 h-4 accent-green-600 rounded cursor-pointer" checked={rem.resolved} onChange={e => handleReminderChange(idx, 'resolved', e.target.checked)}/>
                                  Solucionado
                              </label>
                          </div>
                          <textarea disabled={rem.resolved} value={rem.text} onChange={e => handleReminderChange(idx, 'text', e.target.value)} placeholder="Ej: Triángulo roto, falta gata, rueda repuesto baja..." className="w-full border-2 border-slate-100 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-amber-500 mb-2 disabled:bg-slate-50 text-slate-700 resize-none min-h-[60px]"/>
                          
                          <div className="flex items-center gap-2">
                              <label className={`flex-1 py-2 text-center rounded-lg border-2 border-dashed cursor-pointer text-[10px] font-extrabold transition-colors uppercase tracking-wide ${rem.photo ? 'bg-green-50 border-green-400 text-green-700' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-500'}`}>
                                  <input type="file" accept="image/*" className="hidden" disabled={rem.resolved} onChange={async e => { const f=e.target.files[0]; if(!f)return; try{ const dUrl = await resizeImage(f, 400, 0.4); handleReminderChange(idx, 'photo', dUrl); }catch(err){}}}/>
                                  {rem.photo ? '📸 Foto Guardada' : '📸 Adjuntar Foto'}
                              </label>
                              {rem.photo && <button type="button" onClick={() => {
                                  const w = window.open(""); 
                                  w.document.write(`<img src="${rem.photo}" style="width:100%;max-width:800px;margin:auto;display:block;padding-top:20px;"/>`);
                              }} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors border border-blue-200"><Eye className="w-4 h-4"/></button>}
                              <button type="button" onClick={()=>removeReminder(idx)} className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors border border-red-200"><Trash2 className="w-4 h-4"/></button>
                          </div>
                      </div>
                  ))}
                  <button type="button" onClick={addReminder} className="w-full py-3 bg-amber-200 hover:bg-amber-300 text-amber-800 font-black text-xs uppercase tracking-widest rounded-xl transition-colors border border-amber-300 shadow-sm">+ Agregar Nuevo Aviso</button>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: FOTOS (MAPA FOTOGRÁFICO INTERACTIVO) */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Croquis Pericial de Daños</h3>
                <select value={formData.vehicleType || 'auto'} onChange={e => setF('vehicleType', e.target.value)} className="bg-slate-100 border-2 border-slate-200 text-[10px] font-bold p-1.5 rounded-lg outline-none text-slate-700 cursor-pointer max-w-[140px]">
                  <option value="auto">🚙 Auto/SUV</option>
                  <option value="camioneta">🛻 Camioneta</option>
                  <option value="furgon_pequeno">🚐 Furgón Peq.</option>
                  <option value="furgon_grande">🚐 Furgón Grande</option>
                  <option value="camion">🚚 Camión Simple</option>
                  <option value="camion_doble">🚚 Camión Doble Cab.</option>
                  <option value="camion_2ejes">🚛 Camión (2 Ejes)</option>
                  <option value="camion_3ejes">🚛 Camión (3 Ejes)</option>
                  <option value="camion_8x4">🚚 Camión Rigid (8x4)</option>
                  <option value="carro_arrastre">🛒 Carro Arrastre</option>
                </select>
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl border-2 border-slate-100 mb-4 select-none relative">
                <div className="flex justify-between items-center mb-4 min-h-[40px]">
                  {!formData.zoomZone ? (
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed w-full text-center">
                      Toca los recuadros para fotos generales.<br/>
                      <span className="text-blue-500 text-xs">Toca un cuadrante del auto para acercar y marcar.</span>
                    </p>
                  ) : (
                    <div className="w-full flex items-center justify-between bg-blue-50 p-2 rounded-xl border border-blue-200 animate-in fade-in">
                      <p className="text-[11px] font-black text-blue-700 uppercase animate-pulse flex items-center gap-1"><Search className="w-4 h-4"/> Toca el daño exacto</p>
                      <button type="button" onClick={() => setF('zoomZone', null)} className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm border border-slate-200 flex items-center gap-1 hover:bg-slate-100 transition-colors"><X className="w-3 h-3"/> Volver</button>
                    </div>
                  )}
                </div>
                
                <div className="relative w-full max-w-[280px] h-[400px] mx-auto my-6">
                  {/* VEHÍCULO INTERACTIVO CENTRAL CON ZOOM */}
                  <div 
                     className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 cursor-crosshair transition-all duration-300 ease-out drop-shadow-lg ${
                       !formData.zoomZone ? 'scale-100 z-10 hover:opacity-90' : 
                       formData.zoomZone === 'tl' ? 'scale-[1.8] origin-top-left z-50' :
                       formData.zoomZone === 'tr' ? 'scale-[1.8] origin-top-right z-50' :
                       formData.zoomZone === 'ml' ? 'scale-[1.8] origin-left z-50' :
                       formData.zoomZone === 'mr' ? 'scale-[1.8] origin-right z-50' :
                       formData.zoomZone === 'bl' ? 'scale-[1.8] origin-bottom-left z-50' :
                       'scale-[1.8] origin-bottom-right z-50'
                     }`}
                     style={{ height: formData.vehicleType?.includes('camion') || formData.vehicleType === 'furgon_grande' || formData.vehicleType === 'carro_arrastre' ? '260px' : '220px' }}
                     onClick={(e) => {
                       const rect = e.currentTarget.getBoundingClientRect();
                       const x = ((e.clientX - rect.left) / rect.width) * 100;
                       const y = ((e.clientY - rect.top) / rect.height) * 100;

                       if (!formData.zoomZone) {
                         let zone = y < 33 ? 't' : y < 66 ? 'm' : 'b';
                         zone += x < 50 ? 'l' : 'r';
                         setF('zoomZone', zone);
                         return;
                       }

                       const availableDet = ['det1', 'det2', 'det3', 'det4', 'det5', 'det6', 'det7', 'det8'].find(d => !formData.photos[d]);
                       if (!availableDet) return showAlert("Máximo de 8 fotos de detalles/daños alcanzado.");
                       
                       setF('pendingPin', { id: availableDet, x, y });
                       document.getElementById(`pic-${availableDet}`).click();
                       setF('zoomZone', null);
                     }}
                  >
                    {!formData.zoomZone && (
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 pointer-events-none z-40 opacity-40 mix-blend-multiply">
                        <div className="border-r-2 border-b-2 border-dashed border-blue-500 rounded-tl-[40px]"></div>
                        <div className="border-b-2 border-dashed border-blue-500 rounded-tr-[40px]"></div>
                        <div className="border-r-2 border-b-2 border-dashed border-blue-500"></div>
                        <div className="border-b-2 border-dashed border-blue-500"></div>
                        <div className="border-r-2 border-dashed border-blue-500 rounded-bl-[40px]"></div>
                        <div className="border-dashed border-blue-500 rounded-br-[40px]"></div>
                      </div>
                    )}

                    {(!formData.vehicleType || formData.vehicleType === 'auto') && (
                      <div className="w-full h-full bg-slate-300 rounded-[40px] border-4 border-slate-400 relative overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                        <div className="w-4/5 h-1/5 bg-slate-800/30 mx-auto rounded-t-2xl rounded-b-sm mt-5"></div>
                        <div className="w-4/5 h-12 bg-slate-800/30 mx-auto rounded-b-xl rounded-t-sm mb-3"></div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_pequeno' && (
                      <div className="w-full h-full relative flex flex-col items-center z-10">
                        <div className="w-[80%] h-[18%] bg-slate-300 rounded-t-[35px] border-x-4 border-t-4 border-slate-400 shadow-inner z-0"></div>
                        <div className="w-[100%] h-[82%] bg-slate-200 rounded-t-[15px] rounded-b-[20px] border-4 border-slate-400 shadow-inner flex flex-col p-1.5 z-10 -mt-2">
                          <div className="w-[90%] h-[20%] bg-slate-800/40 mx-auto rounded-t-[15px] rounded-b-sm mb-1.5 shadow-sm"></div>
                          <div className="flex-1 w-[95%] mx-auto bg-slate-300 border-2 border-slate-400/30 rounded-md relative flex justify-center overflow-hidden">
                            <div className="w-1/2 h-full border-r-2 border-slate-400/50"></div>
                            <div className="absolute top-1/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-2/4 w-full border-t-2 border-slate-400/20"></div>
                            <div className="absolute top-3/4 w-full border-t-2 border-slate-400/20"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'furgon_grande' && (
                      <div className="w-full h-full bg-slate-200 rounded-t-[35px] rounded-b-[10px] border-4 border-slate-400 relative flex flex-col justify-start p-2 shadow-inner z-10">
                        <div className="w-[85%] h-[15%] bg-slate-800/40 mx-auto rounded-t-[20px] rounded-b-sm mt-1"></div>
                        <div className="flex-1 w-[90%] mx-auto bg-slate-300 border-2 border-slate-400/30 rounded-sm mt-3 mb-1 flex items-center justify-center relative overflow-hidden shadow-sm">
                          <div className="w-1/2 h-full border-r-2 border-slate-400/40"></div>
                          <div className="absolute top-1/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-2/4 w-full border-t border-slate-400/20"></div>
                          <div className="absolute top-3/4 w-full border-t border-slate-400/20"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camioneta' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-full h-[40%] bg-slate-300 rounded-t-[35px] rounded-b-md border-4 border-slate-400 p-2 flex flex-col justify-between shadow-inner">
                          <div className="w-5/6 h-8 bg-slate-800/30 mx-auto rounded-t-xl rounded-b-sm mt-2"></div>
                          <div className="w-5/6 h-4 bg-slate-800/30 mx-auto rounded-b-xl rounded-t-sm mb-1"></div>
                        </div>
                        <div className="w-[90%] h-[60%] mx-auto bg-slate-200 border-x-4 border-b-4 border-slate-400 rounded-b-xl mt-1 relative">
                          <div className="absolute inset-2 border-2 border-slate-300 rounded-sm"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                          <div className="w-full h-1/2 bg-slate-800/40 rounded-t-md rounded-b-sm mb-1"></div>
                        </div>
                        <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                        </div>
                      </div>
                    )}
                    {formData.vehicleType === 'camion_doble' && (
                      <div className="w-full h-full relative flex flex-col">
                        <div className="w-[105%] -ml-[2.5%] h-[32%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 p-1 flex flex-col justify-end gap-1 shadow-inner z-10 relative">
                          <div className="w-full h-[40%] bg-slate-800/40 rounded-t-md"></div>
                          <div className="w-full h-[35%] bg-slate-800/40 rounded-sm mb-0.5"></div>
                        </div>
                        <div className="w-full h-[66%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                        </div>
                      </div>
                    )}
                    {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes' || formData.vehicleType === 'camion_8x4' || formData.vehicleType === 'carro_arrastre') && (
                      <div className="w-full h-full relative flex flex-col items-center">
                        
                        {/* RENDERIZADO DEL CAMIÓN 8x4 */}
                        {formData.vehicleType === 'camion_8x4' && (
                          <>
                            {/* Dirección Doble Frontal */}
                            <div className="absolute top-[10%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[10%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[22%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute top-[22%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                            {/* Tracción Doble Trasera */}
                            <div className="absolute bottom-[20%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[20%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[7%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            <div className="absolute bottom-[7%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                            
                            <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                              <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                            </div>
                            <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}
                        
                        {/* RENDERIZADO DEL CARRO DE ARRASTRE */}
                        {formData.vehicleType === 'carro_arrastre' && (
                          <div className="w-full h-full relative overflow-hidden flex justify-center items-center">
                            {/* Cuerpo del carro */}
                            <div className="w-[90%] h-[80%] bg-slate-300 rounded-md border-4 border-slate-400 relative overflow-hidden shadow-inner flex justify-center items-center z-10 mt-6">
                                {/* Contorno interior táctil */}
                                <div className="w-[90%] h-[90%] border-2 border-slate-300/50 rounded-sm"></div>
                            </div>

                            {/* Tiro del carro (Triángulo frontal) */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-10 border-x-4 border-t-4 border-slate-500 rounded-t-full bg-slate-400 z-0"></div>

                            {/* Eje 1 (Delantero) */}
                            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                            </div>

                            {/* Eje 2 (Trasero) */}
                            <div className="absolute top-[56%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                                <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Camiones de 2 y 3 ejes (Mantener los originales) */}
                        {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes') && (
                          <>
                             <div className="absolute top-[8%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                             <div className="absolute top-[8%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                             {formData.vehicleType === 'camion_2ejes' && (
                              <>
                                <div className="absolute bottom-[17%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[17%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                              </>
                            )}
                            {formData.vehicleType === 'camion_3ejes' && (
                              <>
                                <div className="absolute bottom-[27%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[27%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[16%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[16%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                                <div className="absolute bottom-[5%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                              </>
                            )}
                            <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                              <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                            </div>
                            <div className="w-full h-[78%] mx-auto bg-slate-200 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(formData.detailPins || []).map(pin => (
                      <div key={pin.id} className="absolute w-8 h-8 -ml-4 -mt-4 bg-red-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center z-50 animate-in zoom-in" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                        <img src={formData.photos[pin.id]} className="w-full h-full object-cover rounded-full opacity-90" alt="Detalle" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setF('photos', {...formData.photos, [pin.id]: false}); setF('detailPins', formData.detailPins.filter(p => p.id !== pin.id)); }} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-700 shadow-md"><X className="w-3 h-3"/></button>
                      </div>
                    ))}
                  </div>

                  {/* FOTOS GENERALES */}
                  <label className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.front ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-front" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'front')}/>
                    {formData.photos.front ? <><img src={formData.photos.front} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-1"/><span className="text-[9px] font-black text-slate-500 tracking-wide">FRENTE</span></>}
                  </label>

                  <label className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.back ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-back" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'back')}/>
                    {formData.photos.back ? <><img src={formData.photos.back} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-1"/><span className="text-[9px] font-black text-slate-500 tracking-wide">ATRÁS</span></>}
                  </label>

                  <label className={`absolute top-1/2 left-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.left ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-left" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'left')}/>
                    {formData.photos.left ? <><img src={formData.photos.left} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5"/><span className="text-[8px] font-black text-slate-500 text-center leading-tight">LATERAL<br/>PILOTO</span></>}
                  </label>

                  <label className={`absolute top-1/2 right-0 transform -translate-y-1/2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer shadow-md z-20 bg-white transition-all ${formData.photos.right ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-blue-50'}`}>
                    <input type="file" id="pic-right" className="sr-only" accept="image/*" onChange={e=>handlePic(e,'right')}/>
                    {formData.photos.right ? <><img src={formData.photos.right} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-50"/><CheckCircle className="w-6 h-6 text-green-500 relative z-10 bg-white rounded-full"/></> : <><Camera className="w-5 h-5 text-blue-500 mb-0.5"/><span className="text-[8px] font-black text-slate-500 text-center leading-tight">LATERAL<br/>COPILOTO</span></>}
                  </label>

                  {['det1','det2','det3','det4','det5','det6','det7','det8'].map(d => <input key={d} type="file" id={`pic-${d}`} className="sr-only" accept="image/*" onChange={e=>handlePic(e,d)}/>)}
                </div>

                {/* Botones Flotantes Inferiores */}
                <div className="grid grid-cols-2 gap-3 mt-6 border-t-2 border-slate-100 pt-4">
                  {[{id:'dashboard', l:'Tablero'}, {id:'tire', l:'Repuesto'}, {id:'interior_front', l:'Int. Adelante'}, {id:'interior_back', l:'Int. Atrás'}].map(p => (
                     <label key={p.id} className={`w-full h-12 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white shadow-sm transition-all ${formData.photos[p.id] ? 'border-green-400 ring-2 ring-green-100' : 'border-dashed border-slate-300 hover:bg-slate-50'}`}>
                       <input type="file" className="sr-only" accept="image/*" onChange={e=>handlePic(e,p.id)}/>
                       {formData.photos[p.id] ? <><img src={formData.photos[p.id]} className="absolute inset-0 w-full h-full object-cover opacity-30"/><CheckCircle className="w-5 h-5 text-green-500 relative z-10 bg-white rounded-full"/><span className="text-[10px] font-black text-green-800 relative z-10">{p.l}</span></> : <><Camera className="w-4 h-4 text-slate-400"/><span className="text-[10px] font-black text-slate-500 uppercase">{p.l}</span></>}
                     </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 5: EVENTOS EN RUTA Y COMBUSTIBLE */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* COMBUSTIBLE AHORA ESTÁ AQUÍ */}
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Combustible a Bordo</h3>
              
              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${formData.fuelLevel < 30 ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <Fuel className={`w-6 h-6 ${formData.fuelLevel < 30 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estanque</p>
                       <p className={`text-2xl font-black leading-none transition-colors ${formData.fuelLevel < 30 ? 'text-red-600' : formData.fuelLevel <= 50 ? 'text-amber-500' : 'text-green-600'}`}>
                         {formData.fuelLevel}%
                       </p>
                    </div>
                  </div>
                  <div className="text-right">
                     <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors ${formData.fuelLevel == 0 ? 'bg-red-100 text-red-700' : formData.fuelLevel <= 25 ? 'bg-red-50 text-red-600' : formData.fuelLevel <= 50 ? 'bg-amber-50 text-amber-600' : formData.fuelLevel <= 75 ? 'bg-green-50 text-green-600' : 'bg-green-100 text-green-700'}`}>
                       {formData.fuelLevel == 0 ? 'Vacío' : formData.fuelLevel <= 25 ? 'Reserva' : formData.fuelLevel <= 50 ? 'Medio' : formData.fuelLevel <= 75 ? '3/4' : 'Lleno'}
                     </span>
                  </div>
                </div>

                <div className="relative pt-2 pb-2">
                  {/* Letras E y F flotantes */}
                  <div className="flex justify-between text-[11px] font-black px-1 mb-2">
                    <span className="text-red-500">E</span>
                    <span className="text-slate-300">1/4</span>
                    <span className="text-slate-300">1/2</span>
                    <span className="text-slate-300">3/4</span>
                    <span className="text-green-500">F</span>
                  </div>
                  
                  <div className="relative h-10 w-full group">
                      {/* Slider Nativo Invisible para mantener la función táctil/arrastre intacta */}
                      <input 
                        type="range" 
                        min="0" max="100" step="5" 
                        value={formData.fuelLevel} 
                        onChange={(e) => setF('fuelLevel', e.target.value)} 
                        className="absolute z-20 w-full h-full opacity-0 cursor-pointer inset-0 m-0" 
                      />
                      
                      {/* Pista Gráfica (Fondo) */}
                      <div className="absolute inset-y-2 inset-x-0 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200 pointer-events-none">
                        {/* Marcas de cuartos (rayitas divisorias blancas) */}
                        <div className="absolute inset-0 flex justify-between px-[25%] z-10">
                           <div className="w-0.5 h-full bg-white/80"></div>
                           <div className="w-0.5 h-full bg-white/80"></div>
                           <div className="w-0.5 h-full bg-white/80"></div>
                        </div>
                        
                        {/* Relleno animado con color dinámico y franjas de peligro si está bajo */}
                        <div 
                          className={`h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 relative ${
                             formData.fuelLevel < 30 
                               ? 'bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_10px,#dc2626_10px,#dc2626_20px)]' 
                               : formData.fuelLevel <= 50 
                               ? 'bg-amber-400' 
                               : 'bg-green-500'
                          }`}
                          style={{ width: `${formData.fuelLevel}%` }}
                        >
                           {/* Pequeño destello (brillo) en la punta para simular efecto 3D/Luz */}
                           <div className="w-1.5 h-3 bg-white/50 rounded-full relative z-20"></div>
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 mt-6 text-slate-800 uppercase tracking-wider">Viáticos y Esperas</h3>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Wallet className="w-5 h-5"/></div>
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase leading-none">Fondo Asignado</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Patente: {job.plate || job.vin || 'N/A'}</p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-blue-700">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(
                    expenses?.filter(g => g.jobId === job.id && g.type === 'assignment').reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0
                  )}
                </p>
              </div>

              {job.tripType === 'revision' && (job.rtData?.revision || job.rtData?.inspeccion || job.rtData?.frenos) && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-4 h-4"/> Valores pagados en Planta (PRT)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.rtData?.revision && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Revisión Técnica ($)</label>
                        <input type="number" placeholder="Ej: 20000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostRevision || ''} onChange={e => setF('prtCostRevision', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.inspeccion && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Inspección Visual ($)</label>
                        <input type="number" placeholder="Ej: 5000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostInspeccion || ''} onChange={e => setF('prtCostInspeccion', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.frenos && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Certificado Frenos ($)</label>
                        <input type="number" placeholder="Ej: 8000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostFrenos || ''} onChange={e => setF('prtCostFrenos', e.target.value)} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 select-none shadow-sm ${job.waitTimeMinutes >= 1 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  <Clock className="w-5 h-5"/>
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Espera: {job.waitTimeMinutes || 0} min</span>
                </div>

                <button type="button" onClick={() => setF('hasFuelCharge', !formData.hasFuelCharge)} className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all select-none shadow-sm ${formData.hasFuelCharge ? 'border-blue-500 bg-blue-500 text-white shadow-blue-100' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {formData.hasFuelCharge ? <CheckCircle className="w-5 h-5 animate-in zoom-in"/> : <Fuel className="w-5 h-5"/>}
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Carga Combust.</span>
                </button>
              </div>

              {formData.hasFuelCharge && (
                <div className="animate-in fade-in slide-in-from-top-2 border rounded-xl p-3 bg-slate-50 shadow-inner max-w-sm mx-auto">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider text-center mb-1">Monto Rendición Gasolinera ($)</p>
                  <input type="number" placeholder="Ej: 15000" value={formData.fuelChargeAmount || ''} onChange={(e) => setF('fuelChargeAmount', e.target.value)} className="w-full bg-white border p-2 rounded-xl text-center text-sm font-bold outline-none" />
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 6: ENTREGA Y FIRMAS */}
          {step === 6 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Cierre y Conformidad</h3>
              
              <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-2xl border-slate-900 border-2 cursor-pointer shadow-md transition-colors hover:bg-slate-700">
                 <input type="checkbox" checked={formData.noReception} onChange={e=>setF('noReception',e.target.checked)} className="w-6 h-6 cursor-pointer accent-blue-500 rounded"/> 
                 <span className="font-extrabold text-sm text-white">Dejar sin firma (Local cerrado / PRT)</span>
              </label>
               
               {!formData.noReception && (
                 <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                    <h3 className="font-extrabold text-blue-800 mb-1 flex items-center gap-2"><Zap className="w-5 h-5"/> Firma Remota o QR</h3>
                    <p className="text-[11px] font-bold text-blue-600 mb-3">Envía el link al cliente o muéstrale el QR para que firme desde su celular.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleRemoteSignRequest} disabled={processingAction === 'wapp'} className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                         {processingAction === 'wapp' ? <Clock className="w-4 h-4 animate-spin"/> : <Share2 className="w-4 h-4"/>} {processingAction === 'wapp' ? 'Cargando...' : 'Compartir Link'}
                      </button>
                      <button type="button" onClick={handleOpenQR} disabled={processingAction === 'qr'} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                         {processingAction === 'qr' ? <Clock className="w-4 h-4 animate-spin"/> : <QrCode className="w-4 h-4"/>} {processingAction === 'qr' ? 'QR' : 'Mostrar QR'}
                      </button>
                    </div>
                 </div>
               )}

               {!formData.noReception && (
                 <div className="space-y-3">
                   <div className="flex items-center gap-2 my-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-bold text-slate-400 uppercase">O llenar manualmente</span><div className="h-px bg-slate-200 flex-1"></div></div>
                   
                   <input required={!formData.noReception} value={formData.receiverName} onChange={e=>setF('receiverName',e.target.value)} placeholder="Nombre del receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   <input required={!formData.noReception} value={formData.receiverRut} onChange={e=>setF('receiverRut',e.target.value)} placeholder="RUT Receptor" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm"/>
                   
                   {formData.clientComments && (
                     <div className="bg-slate-100 p-2.5 rounded-xl border">
                       <p className="text-[9px] font-extrabold text-slate-500 uppercase">Comentarios del Receptor:</p>
                       <p className="text-xs font-bold text-slate-800 italic">"{formData.clientComments}"</p>
                     </div>
                   )}

                   <div className="relative mt-1">
                     {formData.signatureData && <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 z-10"><CheckCircle className="w-3 h-3"/> CAPTURADA</div>}
                     <SignaturePad initialData={formData.signatureData} onSave={d=>setF('signatureData',d)} onClear={()=>setF('signatureData',null)}/>
                   </div>
                 </div>
               )}
              
              {/* El botón GPS manual fue eliminado. Se captura automáticamente al presionar Finalizar. */}
            </div>
          )}

          {/* BOTONERA NAVEGACIÓN INFERIOR DINÁMICA */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-3 rounded-xl text-sm w-1/3 active:scale-[0.97] transition-all duration-200">
                Atrás
              </button>
            )}
            
            {step < 6 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="group flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-200 flex justify-center items-center gap-2 relative overflow-hidden">
                <span className="relative z-10">Siguiente Paso</span>
                <span className="relative z-10 transform group-hover:translate-x-1.5 transition-transform duration-300">➔</span>
                {/* Efecto de destello de luz (Shine) */}
                <div className="absolute inset-0 h-full w-full translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-in-out"></div>
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="group flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 transition-all duration-200 flex justify-center items-center gap-2">
                {isSubmitting ? <><Clock className="w-4 h-4 animate-spin"/> Guardando GPS y Acta...</> : <><span className="group-hover:animate-bounce">🏁</span> Finalizar y Guardar</>}
              </button>
            )}
          </div>

        </form>
      </div>

      {/* NUEVO: MODAL DE FOTO EN PANTALLA COMPLETA PARA EL CONDUCTOR */}
      {fullScreenImage && (
        <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors shadow-lg">
            <X className="w-6 h-6" />
          </button>
          <img src={fullScreenImage} alt="Evidencia Ampliada" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
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
      <LogisticApp />
    </Router>
  );
}