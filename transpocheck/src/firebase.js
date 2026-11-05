import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDlX1VY0n5dDEvD_Tyivb0u_DLdfsargfI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "logisticapp-45452.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "logisticapp-45452",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "logisticapp-45452.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "522404772814",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:522404772814:web:6ae1154eb945d36475099f"
};

// Singleton para asegurar una única instancia compartida en toda la app
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Motor Offline persistente en IndexedDB (soporta múltiples pestañas sin colisiones)
let database;
try {
  database = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (error) {
  database = getFirestore(app);
}
export const db = database;

export const storage = getStorage(app);
