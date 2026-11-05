import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, updateDoc, doc, getDocs, query, where, orderBy, limit, deleteField } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { app, auth, db, storage, googleProvider } from '../firebase';

export { auth, db, storage, googleProvider };

let messaging = null;
isSupported().then((supported) => {
  if (supported) messaging = getMessaging(app);
});

// Función Utilitaria de Storage
export const uploadImageToStorage = async (base64String, folderPath, fileName) => {
  if (!base64String || !base64String.startsWith('data:image')) return base64String;
  const storageRef = ref(storage, `${folderPath}/${fileName}`);
  await uploadString(storageRef, base64String, 'data_url');
  return await getDownloadURL(storageRef);
};

// 2. EL CUSTOM HOOK PRINCIPAL
export function useFirebase(activeRole, simulatedDriverEmail, jobLimit, showAlert) {
  const [user, setUser] = useState(() => auth.currentUser || null);

  // Inicialización instantánea desde caché local para evitar pantalla de carga al reabrir el navegador
  const [jobs, setJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('app_cache_jobs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [drivers, setDrivers] = useState(() => {
    try {
      const saved = localStorage.getItem('app_cache_drivers');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem('app_cache_expenses');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [vehicles, setVehicles] = useState(() => {
    try {
      const saved = localStorage.getItem('app_cache_vehicles');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [vehicleModels, setVehicleModels] = useState(() => {
    try {
      const saved = localStorage.getItem('app_cache_vehicle_models');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [customClients, setCustomClients] = useState(() => {
    try {
      const saved = localStorage.getItem('app_cache_custom_clients');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [broadcast, setBroadcast] = useState(null);

  // Candado de carga: si ya tenemos conductores en caché, abrimos de inmediato (0ms de espera)
  const [dataLoaded, setDataLoaded] = useState(() => {
    try {
      const cached = localStorage.getItem('app_cache_drivers');
      return !!(cached && cached.length > 5);
    } catch (e) { return false; }
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Fallback de seguridad: si tras 2.5s no ha cargado, abrir la app de todos modos para nunca bloquear la pantalla
  useEffect(() => {
    if (dataLoaded) return;
    const timer = setTimeout(() => {
      setDataLoaded(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [dataLoaded]);

  // Variables de identidad derivadas
  const actualUserEmail = user?.email?.trim().toLowerCase();
  
  // MAGIA: Buscamos el perfil del usuario logueado en la base de datos en tiempo real
  const currentUserProfile = drivers.find(d => d.email?.trim().toLowerCase() === actualUserEmail);

  // Super Admin estricto (Felipe Castro o rol explícito de super_admin en base de datos)
  const isSuperAdmin = actualUserEmail === 'fcastro@logisticats.cl' || currentUserProfile?.role === 'super_admin';

  // Asignación de permisos 100% dinámicos
  const isRealAdmin = isSuperAdmin || ['hcastro@logisticats.cl'].includes(actualUserEmail) || 
                      currentUserProfile?.role === 'admin';
                      
  // Permisos granulares
  const defaultPermissions = {
    create_jobs: true,
    manage_users: true,
    manage_clients: true,
    manage_vehicles: true,
    manage_directory: true,
    manage_tolls: true,
    manage_equipment: true,
    manage_expenses: true,
    manage_stats: true,
    manage_history: true
  };
  
  const adminPermissions = isSuperAdmin 
    ? defaultPermissions 
    : (currentUserProfile?.permissions || defaultPermissions);
  
  const isQuoter = currentUserProfile?.role === 'quoter';
  const isPartTime = currentUserProfile?.role === 'part_time';
  
  const currentUserEmail = (activeRole === 'driver' && simulatedDriverEmail) ? simulatedDriverEmail : actualUserEmail;

  const isFirstLoad = useRef(true);
  const driversRef = useRef([]);
  const registeringRef = useRef(false);
  const notifiedJobs = useRef(new Set()); // <-- Memoria anti-spam

  // Funciones de Notificación
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

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) { 
      showAlert("Estás usando la versión App (APK). Las notificaciones son gestionadas por Android."); 
      setNotificationsEnabled(true); 
      return; 
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        showAlert("⏳ Generando token seguro...");
        if (messaging && user) {
          let registration;
          try {
            // Utilizamos un scope específico para no interferir con el Service Worker de Vite PWA
            registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' });
            await navigator.serviceWorker.ready;
          } catch (err) {
            console.error('Error registrando Service Worker:', err);
            showAlert("❌ Error al registrar el Service Worker [ERR-FCM-SW-01].");
            return;
          }
          
          const token = await getToken(messaging, { 
            vapidKey: 'BK8z3mxtN3JApx1nw-9cVLzsjp78ufh0qimwqsxJOTnRuMIbQ4HQgYWGkKJ8h9MWPpZYFC3WxbX9Y-jskpIaOHY',
            serviceWorkerRegistration: registration
          });
          
          if (token) {
            const driverSnap = driversRef.current.find(d => d.email === user.email);
            if (driverSnap) {
              await updateDoc(doc(db, 'drivers', driverSnap.id), { fcmToken: token });
              setNotificationsEnabled(true);
              showAlert("✅ Token guardado correctamente.");
            }
          }
        }
      }
    } catch (error) { showAlert("❌ Error [ERR-FCM-NOTIF-01]: " + error.message); }
  };

  // Efecto 1: Autenticación
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if ("Notification" in window && Notification.permission === "granted") {
        setNotificationsEnabled(true);
        if (messaging) {
          onMessage(messaging, (payload) => {
            triggerNotification(payload.notification.title, payload.notification.body);
          });
        }
      }
    });
    return () => unsub();
  }, []);

  // Actualizar ref de drivers
  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  // Efecto 2: Anuncio Global
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system_config', 'broadcast'), (docSnap) => {
      if (docSnap.exists()) setBroadcast(docSnap.data());
      else setBroadcast(null);
    });
    return () => unsub();
  }, []);

  // Efecto 3: Auto-registro Blindado Optimizado
  useEffect(() => {
    if (!user || !dataLoaded || activeRole !== 'driver' || !navigator.onLine || registeringRef.current) return;
    
    // Todo en minúsculas y sin espacios para evitar duplicados fantasma
    const safeEmail = currentUserEmail?.trim().toLowerCase() || '';
    const myDriver = drivers.find(d => d.email?.trim().toLowerCase() === safeEmail);
    const isClientAccount = customClients.some(c => c.email && c.email.toLowerCase().includes(safeEmail));
    
    // Agregamos !isQuoter para que a tu equipo de ventas no les pida licencia ni los anote como choferes
    if (!myDriver && !isClientAccount && !isRealAdmin && !isQuoter) {
      registeringRef.current = true;
      (async () => {
        try {
          await addDoc(collection(db, 'drivers'), {
            name: user.displayName || 'Usuario Nuevo',
            email: safeEmail, balance: 0, licenses: [], licenseExpiry: '', createdAt: Date.now(), role: 'driver'
          });
          console.log("✅ Auto-registro exitoso para:", safeEmail);
        } catch(e) { 
          console.error("[ERR-DRIVER-AUTOREG-01] Error auto-registro:", e); 
        } finally { 
          registeringRef.current = false; 
        }
      })();
    }
  }, [user, activeRole, dataLoaded, currentUserEmail, customClients, isRealAdmin, drivers]);

  // Efecto 4: Recolector de Basura (Garbage Collector)
  useEffect(() => {
    const cleanupDrafts = async () => {
      const finishedWithDrafts = jobs.filter(j => (j.status === 'completed' || j.status === 'failed') && j.draft);
      for (const j of finishedWithDrafts) {
         try { await updateDoc(doc(db, 'transport_jobs', j.id), { draft: deleteField() }); } 
         catch (e) { /* Ignorar error */ }
      }
    };
    if (jobs.length > 0) cleanupDrafts();
  }, [jobs]);

  // Efecto 5: Lectura de Base de Datos en Tiempo Real (Ultra-Optimizado con caché local persistente)
  useEffect(() => {
    if (!user) return;
    
    const isDriverMode = !isRealAdmin || (activeRole === 'driver' && simulatedDriverEmail);
    const unsubs = [];

    if (isDriverMode) {
      // 🚀 MODO CONDUCTOR: Reducción masiva de lecturas en Firestore y consumo de datos móviles
      let activeDocs = [];
      let recentDocs = [];

      const syncJobs = () => {
        const jobsMap = new Map();
        recentDocs.forEach(j => jobsMap.set(j.id, j));
        activeDocs.forEach(j => jobsMap.set(j.id, j));
        const finalJobs = Array.from(jobsMap.values());
        setJobs(finalJobs);
        try {
          localStorage.setItem('app_cache_jobs', JSON.stringify(finalJobs.slice(0, 50)));
        } catch (e) { /* ignore quota */ }
      };

      // 1. Trabajos activos
      const qActive = query(collection(db, 'transport_jobs'), where('status', 'in', ['pending', 'accepted', 'pending_guide', 'requested']));
      const unsubActive = onSnapshot(qActive, (snapshot) => {
        if (!isFirstLoad.current) {
          snapshot.docChanges().forEach((change) => {
            const d = change.doc.data();
            const isReallyNew = (Date.now() - (d.createdAt || 0)) < 120000;
            if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail) && isReallyNew) {
              triggerNotification('📍 ¡Nuevo Traslado!', `CLIENTE: ${d.client}\nPATENTE: ${d.plate || d.vin}`);
            }
          });
        }
        activeDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        syncJobs();
        isFirstLoad.current = false;
      }, (err) => console.error("[ERR-FB-JOBS-ACTIVE]", err));
      unsubs.push(unsubActive);

      // 2. Historial reciente
      const driverLimit = Math.min(jobLimit || 35, 50);
      const qRecent = query(collection(db, 'transport_jobs'), orderBy('createdAt', 'desc'), limit(driverLimit));
      const unsubRecent = onSnapshot(qRecent, (snapshot) => {
        recentDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        syncJobs();
      }, (err) => console.error("[ERR-FB-JOBS-RECENT]", err));
      unsubs.push(unsubRecent);

      // 3. Gastos optimizados
      const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(30));
      const unsubExpenses = onSnapshot(qExpenses, snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setExpenses(docs);
        try {
          localStorage.setItem('app_cache_expenses', JSON.stringify(docs.slice(0, 50)));
        } catch (e) { /* ignore quota */ }
      }, (err) => console.error("[ERR-FB-EXP-01]", err));
      unsubs.push(unsubExpenses);

    } else {
      // 🏢 MODO ADMINISTRADOR: Monitor completo de la central
      const qJobs = query(collection(db, 'transport_jobs'), orderBy('createdAt', 'desc'), limit(jobLimit));
      const unsubJobs = onSnapshot(qJobs, (snapshot) => {
        if (!isFirstLoad.current) {
          snapshot.docChanges().forEach((change) => {
            const d = change.doc.data();
            const isReallyNew = (Date.now() - (d.createdAt || 0)) < 120000;
            
            if (change.type === 'added' && d.status === 'pending' && d.assignedEmails?.includes(currentUserEmail) && isReallyNew) {
               triggerNotification('📍 ¡Nuevo Traslado!', `CLIENTE: ${d.client}\nPATENTE: ${d.plate || d.vin}`);
            }
            
            if (change.type === 'modified' && d.status === 'accepted' && isRealAdmin && activeRole === 'admin') {
               if (!notifiedJobs.current.has(d.id)) {
                   triggerNotification('✅ Trabajo Aceptado', `CLIENTE: ${d.client}\nPATENTE: ${d.plate || d.vin}`);
                   notifiedJobs.current.add(d.id);
               }
            }
          });
        }
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJobs(docs);
        try {
          localStorage.setItem('app_cache_jobs', JSON.stringify(docs.slice(0, 50)));
        } catch (e) { /* ignore quota */ }
        isFirstLoad.current = false;
      }, (err) => console.error("[ERR-FB-JOBS-ADMIN]", err));
      unsubs.push(unsubJobs);

      const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(300));
      const unsubExpenses = onSnapshot(qExpenses, snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setExpenses(docs);
        try {
          localStorage.setItem('app_cache_expenses', JSON.stringify(docs.slice(0, 50)));
        } catch (e) { /* ignore quota */ }
      }, (err) => console.error("[ERR-FB-EXP-ADMIN]", err));
      unsubs.push(unsubExpenses);
    }

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDrivers(docs);
      try {
        localStorage.setItem('app_cache_drivers', JSON.stringify(docs));
      } catch (e) { /* ignore quota */ }
      setDataLoaded(true); // Candado maestro abierto
    }, (err) => console.error("[ERR-FB-DRIVERS]", err));
    unsubs.push(unsubDrivers);

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(docs);
      try {
        localStorage.setItem('app_cache_vehicles', JSON.stringify(docs));
      } catch (e) { /* ignore quota */ }
    }, (err) => console.error("[ERR-FB-VEHICLES]", err));
    unsubs.push(unsubVehicles);

    const unsubVehicleModels = onSnapshot(collection(db, 'vehicle_models'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicleModels(docs);
      try {
        localStorage.setItem('app_cache_vehicle_models', JSON.stringify(docs));
      } catch (e) { /* ignore quota */ }
    }, (err) => console.error("[ERR-FB-MODELS]", err));
    unsubs.push(unsubVehicleModels);

    const unsubClients = onSnapshot(collection(db, 'clients'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomClients(docs);
      try {
        localStorage.setItem('app_cache_custom_clients', JSON.stringify(docs));
      } catch (e) { /* ignore quota */ }
    }, (err) => console.error("[ERR-FB-CLIENTS]", err));
    unsubs.push(unsubClients);

    return () => { unsubs.forEach(u => { if (typeof u === 'function') u(); }); };
  }, [user, currentUserEmail, isRealAdmin, jobLimit, activeRole, simulatedDriverEmail]);

  return {
    user, actualUserEmail, currentUserEmail, isRealAdmin, isSuperAdmin, isQuoter, isPartTime,
    adminPermissions,
    jobs, drivers, expenses, vehicles, customClients, vehicleModels,
    broadcast, dataLoaded, notificationsEnabled,
    requestNotificationPermission
  };
}
