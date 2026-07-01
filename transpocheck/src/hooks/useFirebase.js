import { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence, collection, addDoc, onSnapshot, updateDoc, doc, getDocs, query, where, orderBy, limit, deleteField } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// 1. CONFIGURACIÓN INICIAL
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

let messaging = null;
isSupported().then((supported) => {
  if (supported) messaging = getMessaging(app);
});

enableMultiTabIndexedDbPersistence(db).catch((err) => {
  console.warn("Modo offline limitado (Multi-tab):", err.code);
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
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customClients, setCustomClients] = useState([]);
  const [broadcast, setBroadcast] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Variables de identidad derivadas
  const actualUserEmail = user?.email?.toLowerCase();
  const isRealAdmin = ['fcastro@logisticats.cl', 'hcastro@logisticats.cl'].includes(actualUserEmail);
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
          const token = await getToken(messaging, { vapidKey: 'BK8z3mxtN3JApx1nw-9cVLzsjp78ufh0qimwqsxJOTnRuMIbQ4HQgYWGkKJ8h9MWPpZYFC3WxbX9Y-jskpIaOHY' });
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
    } catch (error) { showAlert("❌ Error: " + error.message); }
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

  // Efecto 3: Auto-registro Blindado
  useEffect(() => {
    const myDriver = user ? drivers.find(d => d.email === currentUserEmail) : null;
    if (user && activeRole === 'driver' && dataLoaded && !myDriver && navigator.onLine && !registeringRef.current) {
        const isClientAccount = customClients.some(c => c.email && c.email.toLowerCase().includes(currentUserEmail));
        if (!isClientAccount && !isRealAdmin) {
          registeringRef.current = true;
          (async () => {
            try {
              const q = query(collection(db, 'drivers'), where('email', '==', currentUserEmail));
              const snap = await getDocs(q);
              if (snap.empty) {
                await addDoc(collection(db, 'drivers'), {
                  name: user.displayName || 'Conductor Nuevo',
                  email: currentUserEmail, balance: 0, licenses: [], licenseExpiry: '', createdAt: Date.now()
                });
              }
            } catch(e) { console.error("Error auto-registro", e); } 
            finally { registeringRef.current = false; }
          })();
        }
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

  // Efecto 5: Lectura de Base de Datos en Tiempo Real
  useEffect(() => {
    if (!user) return;
    
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
             // Filtro Anti-Spam: Solo avisa si NO tenemos este ID en la memoria
             if (!notifiedJobs.current.has(d.id)) {
                 triggerNotification('✅ Trabajo Aceptado', `CLIENTE: ${d.client}\nPATENTE: ${d.plate || d.vin}`);
                 notifiedJobs.current.add(d.id); // Guardamos el ID para ignorar las siguientes actualizaciones del GPS
             }
          }
        });
      }
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      isFirstLoad.current = false;
    });

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), snap => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoaded(true); // Candado maestro abierto
    });
    
    const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(300));
    const unsubExpenses = onSnapshot(qExpenses, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, 'clients'), snap => setCustomClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubJobs(); unsubDrivers(); unsubExpenses(); unsubVehicles(); unsubClients(); };
  }, [user, currentUserEmail, isRealAdmin, jobLimit, activeRole]);

  return {
    user, actualUserEmail, currentUserEmail, isRealAdmin,
    jobs, drivers, expenses, vehicles, customClients,
    broadcast, dataLoaded, notificationsEnabled,
    requestNotificationPermission
  };
}
