
import React, { useState, useEffect } from 'react';
import { updateDoc, doc, deleteDoc, addDoc, collection, deleteField, getDocs, query, where } from 'firebase/firestore';
import {
  Edit2, MoreVertical, Navigation, Share2, Users, CheckCircle,
  Copy, X, XCircle, MapPin, Clock, FileDown, Search, ChevronUp, ChevronDown,
  Trash2, Car, Repeat, PenTool, Truck, Plus, FileText, AlertCircle, DollarSign, Map as MapIcon, RefreshCw, Save, Camera, Key
} from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';
import VinPlateBadge from '../ui/VinPlateBadge';
import WaitTimerBadge from '../ui/WaitTimerBadge';
import SwipeButton from '../ui/SwipeButton';
import SignaturePad from '../ui/SignaturePad';
import InAppCamera from '../ui/InAppCamera';
import JobCard from './JobsList/JobCard';
import HistoryJobCard from './JobsList/HistoryJobCard';
import BulkReplaceModal from './JobsList/BulkReplaceModal';
import GuideUploadModal from './JobsList/GuideUploadModal';
import FullScreenPhotoModal from './JobsList/FullScreenPhotoModal';
import HistoryModal from './JobsList/HistoryModal';
import KovacsModal from './JobsList/KovacsModal';
import TrackingModal from './JobsList/TrackingModal';
import ArrivalModal from './JobsList/ArrivalModal';
import { formatDateDisplay, analyzeJobStatus, generateStandardFileName, generateWhatsAppText, getRouteStr, resizeImage } from '../../utils/helpers';

export default function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, onNewJob, db, currentUserEmail, showAlert, showConfirm, allClientsList, onLoadMore, vehicles }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [auditMode, setAuditMode] = useState(false); // <-- NUEVO: Estado del switch de auditoría
  const [trackingJobId, setTrackingJobId] = useState(null); // <-- NUEVO: Estado para Panel de Seguimiento
  const [jobToFail, setJobToFail] = useState(null);
  const [prtPromptJob, setPrtPromptJob] = useState(null);
  const [prtApprovePromptJob, setPrtApprovePromptJob] = useState(null);
  const [prtApproveType, setPrtApproveType] = useState('aprobado');
  const [prtReturnOpt, setPrtReturnOpt] = useState('origin');
  const [prtReturnDest, setPrtReturnDest] = useState('');
  const [relayPromptJob, setRelayPromptJob] = useState(null);
  const [forceCloseJob, setForceCloseJob] = useState(null);
  const [editPriceJob, setEditPriceJob] = useState(null); // <-- NUEVO: Estado para editar cobro
  const [editDateJob, setEditDateJob] = useState(null); // <-- NUEVO: Estado para editar fecha de término
  const [editKmJob, setEditKmJob] = useState(null); // <-- NUEVO: Estado para editar kilometraje manual

  const [dupPromptJob, setDupPromptJob] = useState(null);
  const [dupMode, setDupMode] = useState('clone');
  const [dupDestination, setDupDestination] = useState('');
  const [dupDriverEmails, setDupDriverEmails] = useState([]); // AHORA ES UN ARREGLO
  const [directoryMemory, setDirectoryMemory] = useState([]); // <-- NUEVO: Memoria de directorio para sugerencias

  const [showBulkSign, setShowBulkSign] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkReceiverName, setBulkReceiverName] = useState('');
  const [bulkReceiverRut, setBulkReceiverRut] = useState('');
  const [bulkSignature, setBulkSignature] = useState(null);

  const [showFleetModal, setShowFleetModal] = useState(false);
  const [fleetSelectedIds, setFleetSelectedIds] = useState([]);
  const [showFleetMenu, setShowFleetMenu] = useState(false); // <-- NUEVO ESTADO PARA EL MENÚ
  const [showActiveFleetsModal, setShowActiveFleetsModal] = useState(false); // <-- NUEVO: Para ver y editar flotas activas

  const [historyClientFilter, setHistoryClientFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [localSearchTerm, setLocalSearchTerm] = useState(''); // <-- NUEVO: Estado para el Anti-Lag (Debounce)

  const [isRequestedOpen, setIsRequestedOpen] = useState(true);
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isInProgressOpen, setIsInProgressOpen] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [isCalculatingKm, setIsCalculatingKm] = useState(false); // NUEVO: Estado para recálculo de KM
  const [calcProgress, setCalcProgress] = useState(''); // NUEVO: Progreso del recálculo

  // NUEVO: Estados para Buscar y Reemplazar Masivo
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceField, setReplaceField] = useState('destination');
  const [replaceSearchTerm, setReplaceSearchTerm] = useState('');
  const [replaceNewTerm, setReplaceNewTerm] = useState('');

  const [showKovacsModal, setShowKovacsModal] = useState(false);
  const [kovacsStartDate, setKovacsStartDate] = useState('');
  const [kovacsEndDate, setKovacsEndDate] = useState('');

  const [guideUploadJob, setGuideUploadJob] = useState(null);
  const [guideLink, setGuideLink] = useState('');
  const [guideFileBase64, setGuideFileBase64] = useState(null);

  const [fullScreenPhoto, setFullScreenPhoto] = useState(null); // <-- NUEVO: Estado para foto en pantalla completa
  const [selectedHistoryJob, setSelectedHistoryJob] = useState(null); // <-- NUEVO: Estado para Ficha Técnica interactiva

  // --- ESTADOS PARA REQUISITO LLEGADA (TODOS LOS CLIENTES) ---
  const [arrivalPromptJob, setArrivalPromptJob] = useState(null);
  const [arrivalMileage, setArrivalMileage] = useState('');
  const [arrivalPhoto, setArrivalPhoto] = useState(null);
  const [arrivalKeyLocation, setArrivalKeyLocation] = useState('');
  const [arrivalKeyHandedTo, setArrivalKeyHandedTo] = useState('');
  const [cameraConfig, setCameraConfig] = useState({ isOpen: false, title: '', target: null });

  const submitArrival = async (isSkip = false) => {
    if (typeof isSkip !== 'boolean') isSkip = false;
    setProcessingId('general-arrival');
    try {
      const currentDraft = arrivalPromptJob.draft?.formData || {};
      const currentPhotos = currentDraft.photos || {};

      const updatedDraft = {
        ...currentDraft,
        mileage: isSkip ? '' : (arrivalMileage || ''),
        keyLocation: isSkip ? '' : (arrivalKeyLocation || ''),
        keyHandedTo: isSkip ? '' : ((arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : ''))
      };

      if (!isSkip && arrivalPhoto) {
        updatedDraft.photos = { ...currentPhotos, mileage: arrivalPhoto };
      }

      await updateDoc(doc(db, 'transport_jobs', arrivalPromptJob.id), {
        'draft.formData': updatedDraft
      });

      if (arrivalPromptJob.phase === 'prt_done') {
        notifyClient(arrivalPromptJob, 'en_ruta_destino');
      }
      await updatePhase(arrivalPromptJob, 'arrived_destination');

      setArrivalPromptJob(null);
      setArrivalMileage('');
      setArrivalPhoto(null);
      setArrivalKeyLocation('');
      setArrivalKeyHandedTo('');
    } catch (e) {
      console.error(e);
      showAlert("❌ Error al guardar datos de llegada.");
    } finally {
      setProcessingId(null);
    }
  };
  // ------------------------------------------------------------

  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAppReady(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // --- NUEVO: Cargar Directorio para sugerencias de Destino ---
  useEffect(() => {
    const loadDirectory = async () => {
      try {
        const snap = await getDocs(collection(db, 'directory'));
        setDirectoryMemory(snap.docs.map(d => d.data()));
      } catch (e) { console.error("Error cargando directorio:", e); }
    };
    if (db) loadDirectory();
  }, [db]);
  // ------------------------------------------------------------

  // --- NUEVO: Motor Anti-Lag (Debounce) para el Buscador ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchTerm(localSearchTerm);
    }, 400); // La app espera 400ms después de que dejas de teclear para buscar
    return () => clearTimeout(delayDebounceFn);
  }, [localSearchTerm]);
  // ----------------------------------------------------------

  // --- NUEVO: Auto-reprogramar traslados atrasados al día actual ---
  useEffect(() => {
    if (!jobs || jobs.length === 0 || !db) return;
    // Solo permitimos que la app del 'admin' dispare la actualización para evitar 
    // múltiples sobreescrituras en Firebase si hay varios conductores conectados
    if (role !== 'admin') return;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTime = new Date();
    todayTime.setHours(0, 0, 0, 0);

    const lateJobs = jobs.filter(j => {
      if (!j.scheduledDate) return false;
      if (j.status === 'completed' || j.status === 'failed') return false;

      // Si ya está en proceso (el conductor lo inició pero pasó la hora media noche), no lo tocamos
      const isStarted = ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(j.phase);
      if (isStarted) return false;

      const [y, m, d] = j.scheduledDate.split('-');
      const schedDate = new Date(y, m - 1, d);
      schedDate.setHours(0, 0, 0, 0);

      return schedDate.getTime() < todayTime.getTime();
    });

    lateJobs.forEach(job => {
      updateDoc(doc(db, 'transport_jobs', job.id), { scheduledDate: todayStr })
        .catch(e => console.error("Error auto-reprogramando:", e));
    });
  }, [jobs, db, role]);
  // ----------------------------------------------------------

  const getJobIdentifier = (j) => {
    if (j.plate && j.plate !== 'S/N') return j.plate;
    if (j.associatedPlate && j.associatedPlate !== 'S/N') return j.associatedPlate;
    if (j.vin && j.vin !== 'S/N') return j.vin;
    if (j.tripType === 'simple' && j.description) {
      const match = j.description.match(/(PATENTE|VIN)\s+([A-Z0-9]+)/i);
      if (match) return match[2];
    }
    return 'S/N';
  };

  // NUEVO: Diccionario histórico inteligente para encontrar la última foto de cada vehículo
  const latestVehiclePhotos = React.useMemo(() => {
    const photoMap = {};
    // Ordenamos de más nuevo a más viejo para quedarnos con la última foto
    const sortedAll = [...(jobs || [])].sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
    sortedAll.forEach(j => {
      const ident = getJobIdentifier(j);
      if (ident && ident !== 'S/N' && !photoMap[ident]) {
        if (j.checklist?.photos?.front) {
          photoMap[ident] = j.checklist.photos.front;
        }
      }
    });
    return photoMap;
  }, [jobs]);

  const notifyClient = async (jobData, statusType) => {
    try {
      if (!jobData.client || jobData.client === 'Sin Cliente') return;
      const q = query(collection(db, 'clients'), where('name', '==', jobData.client));
      const snap = await getDocs(q);
      if (snap.empty) return;

      const clientRecord = snap.docs[0].data();
      const notifs = clientRecord.notifications || {
        creado: false,
        asignado: !!clientRecord.enableNotifications,
        llegada_origen: false,
        en_ruta: !!clientRecord.enableNotifications,
        llegada_destino: false,
        finalizado: !!clientRecord.enableNotifications
      };

      if (!notifs[statusType] || !clientRecord.email) return;

      let driverName = jobData.assignedDriverName || jobData.acceptedByEmail || 'Asignado';
      if (jobData.acceptedByEmail && drivers) {
        const d = drivers.find(x => x.email === jobData.acceptedByEmail);
        if (d) driverName = d.name;
      }

      await fetch('/api/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clientRecord.email,
          clientName: clientRecord.name,
          type: statusType,
          jobDetails: {
            id: jobData.id,
            driverName: driverName,
            vehicle: jobData.tripType === 'simple' ? (jobData.description || 'Servicio en Terreno') : (`${jobData.brand || ''} ${jobData.model || ''}`.trim() || 'Vehículo'),
            plate: getJobIdentifier(jobData),
            origin: jobData.origin || 'Origen no especificado',
            destination: jobData.destination || ''
          }
        })
      });
    } catch (e) { console.error("Error al notificar al cliente:", e); }
  };

  // === MOTOR INTELIGENTE DE KILOMETRAJE (Con Ida y Vuelta para RT) ===
  const calculateJobDistance = async (job) => {
    if (!window.google || !window.google.maps) return 'No calculado';
    try {
      const directionsService = new window.google.maps.DirectionsService();

      // 1. Buscador Universal y Blindado (Insensible a mayúsculas/minúsculas)
      const resolveAddress = async (nameToFind, addrFallback, comFallback) => {
        if (!nameToFind) return null;

        const searchName = nameToFind.trim().toLowerCase();

        try {
          // Buscar en Clientes (Intento rápido exacto)
          const clientSnap = await getDocs(query(collection(db, 'clients'), where('name', '==', nameToFind)));
          if (!clientSnap.empty) {
            const cData = clientSnap.docs[0].data();
            if (cData.plusCode) return cData.plusCode;
            if (cData.address) return `${cData.address}, ${cData.commune || 'Santiago'}, Chile`;
          } else {
            // Intento exhaustivo insensible a mayúsculas
            const allClientsSnap = await getDocs(collection(db, 'clients'));
            const foundClient = allClientsSnap.docs.map(d => d.data()).find(c => c.name?.trim().toLowerCase() === searchName);
            if (foundClient) {
              if (foundClient.plusCode) return foundClient.plusCode;
              if (foundClient.address) return `${foundClient.address}, ${foundClient.commune || 'Santiago'}, Chile`;
            }
          }

          // Buscar en el Directorio local ya cargado en RAM (Ultra rápido y sin costo en DB)
          const foundDir = directoryMemory.find(d =>
            (d.placeName && d.placeName.trim().toLowerCase() === searchName) ||
            (d.name && d.name.trim().toLowerCase() === searchName)
          );
          if (foundDir) {
            if (foundDir.plusCode) return foundDir.plusCode;
            if (foundDir.address) return `${foundDir.address}, ${foundDir.commune || 'Santiago'}, Chile`;
          }
        } catch (e) { console.error("Error en resolveAddress:", e); }

        // RESPALDO: Si no hay match, usa las direcciones del formulario o devuelve el texto
        if (addrFallback) return `${addrFallback}, ${comFallback || 'Santiago'}, Chile`;
        return nameToFind;
      };

      let orig = await resolveAddress(job.origin, job.originAddress, job.originCommune);

      // LIMPIEZA: Extraer correctamente la PRT y el Destino Final manejando 1, 2 o 3 tramos con flechas "->"
      let rawDest = job.destination || job.destName || '';
      let prtName = rawDest;
      let finalDestAfterPrt = null;

      if (job.tripType === 'revision' && rawDest.includes('->')) {
        const parts = rawDest.split('->').map(p => p.trim()).filter(Boolean);
        // Buscar qué fragmento es la PRT
        const prtIndex = parts.findIndex(p => p.toLowerCase().includes('prt') || p.toLowerCase().includes('planta') || p.toLowerCase().includes('revision'));

        if (prtIndex !== -1) {
          prtName = parts[prtIndex];
          if (prtIndex + 1 < parts.length) {
            finalDestAfterPrt = parts[parts.length - 1]; // Toma el último destino real
          }
        } else {
          // Si nadie dice PRT, asumimos por estructura
          if (parts.length >= 3) {
            prtName = parts[1];
            finalDestAfterPrt = parts[2];
          } else if (parts.length === 2) {
            prtName = parts[0];
            finalDestAfterPrt = parts[1];
          }
        }
      }

      let dest = await resolveAddress(prtName, job.destAddress, job.destCommune);

      // Tratamiento especial a la Base de Datos de PRTs
      if (job.tripType === 'revision') {
        try {
          const prtSnap = await getDocs(query(collection(db, 'prts'), where('name', '==', prtName)));
          if (!prtSnap.empty) {
            const pData = prtSnap.docs[0].data();
            if (pData.plusCode) dest = pData.plusCode;
            else if (pData.address) dest = `${pData.address}, ${pData.comuna || 'Santiago'}, Chile`;
          } else {
            // Búsqueda exhaustiva insensible a mayúsculas
            const allPrtsSnap = await getDocs(collection(db, 'prts'));
            const foundPrt = allPrtsSnap.docs.map(d => d.data()).find(p => p.name?.trim().toLowerCase() === prtName.toLowerCase().trim());
            if (foundPrt) {
              if (foundPrt.plusCode) dest = foundPrt.plusCode;
              else if (foundPrt.address) dest = `${foundPrt.address}, ${foundPrt.comuna || 'Santiago'}, Chile`;
            }
          }
        } catch (e) { }
      }

      // PRECAUCIÓN: No arruinar los Plus Codes agregándoles ", Chile" (Los Plus Codes usan un signo '+')
      if (orig && !orig.toLowerCase().includes('chile') && !orig.includes('+')) orig += ', Chile';
      if (dest && !dest.toLowerCase().includes('chile') && !dest.includes('+')) dest += ', Chile';

      if (!orig || !dest) return 'No calculado';

      let returnDest = null;

      // 2. Lógica Inteligente para el Retorno (Tramo 2: PRT -> Destino Final)
      if (job.tripType === 'revision') {
        const typedDest = job.checklist?.rtReturnDestination || '';
        const cleanFinalDest = finalDestAfterPrt ? finalDestAfterPrt.toLowerCase().trim() : '';
        const cleanOrigin = job.origin ? job.origin.toLowerCase().trim() : '';

        // Verificar si el destino final es literalmente el mismo que el origen original
        const isExplicitOrigin = job.checklist?.rtReturnOption === 'origin' ||
          (typedDest && cleanOrigin && typedDest.toLowerCase().trim() === cleanOrigin) ||
          (cleanFinalDest && cleanOrigin && cleanFinalDest === cleanOrigin);

        if (isExplicitOrigin) {
          // 🔥 EL SECRETO: Si vuelve al origen, usamos EXACTAMENTE la variable `orig` (que ya contiene el Plus Code válido)
          returnDest = orig;
        } else if (job.checklist?.rtReturnOption === 'other' && typedDest) {
          let resolvedRet = await resolveAddress(typedDest, null, null);
          if (resolvedRet && !resolvedRet.toLowerCase().includes('chile') && !resolvedRet.includes('+')) resolvedRet += ', Chile';
          returnDest = resolvedRet;
        } else if (cleanFinalDest && cleanFinalDest !== prtName.toLowerCase().trim() && !cleanFinalDest.includes('prt')) {
          // Hay un destino en las flechas y NO es la PRT de nuevo
          let resolvedRet = await resolveAddress(finalDestAfterPrt, null, null);
          if (resolvedRet && !resolvedRet.toLowerCase().includes('chile') && !resolvedRet.includes('+')) resolvedRet += ', Chile';
          returnDest = resolvedRet;
        } else {
          // Fallback ultra-seguro: Ante cualquier texto extraño o ambiguo, fuerza el regreso al Origen
          returnDest = orig;
        }
      }

      const getMeters = (from, to) => new Promise((resolve, reject) => {
        const request = {
          origin: from,
          destination: to,
          travelMode: 'DRIVING',
          region: 'CL'
        };
        console.log("📍 GOOGLE MAPS CALCULANDO RUTA:");
        console.log("   🔴 DESDE:", from);
        console.log("   🟢 HASTA:", to);
        directionsService.route(request, (result, status) => {
          if (status === 'OK' && result.routes && result.routes.length > 0) {
            resolve(result.routes[0].legs[0].distance.value);
          } else {
            reject(new Error('Ruta no encontrada'));
          }
        });
      });

      // Tramo 1 (km1): Origen -> PRT
      let totalMeters = await Promise.race([
        getMeters(orig, dest),
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 4000))
      ]).catch(() => 'Error');

      // Tramo 2 (km2): PRT -> Destino Final
      if (typeof totalMeters === 'number' && job.tripType === 'revision' && returnDest) {
        await new Promise(r => setTimeout(r, 600)); // Delay para no saturar la API
        let returnMeters = await Promise.race([
          getMeters(dest, returnDest),
          new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 4500))
        ]).catch(() => 'Error');

        if (typeof returnMeters === 'number') {
          totalMeters += returnMeters;
        }
      }

      if (typeof totalMeters === 'number') {
        return (totalMeters / 1000).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
      }
      return 'No calculado';
    } catch (err) {
      return 'No calculado';
    }
  };

  const updatePhase = async (job, phase, extra = {}) => {
    if (processingId) return;
    setProcessingId(`${job.id}-${phase}`);
    try {
      let finalExtra = { ...extra };

      if (phase === 'arrived_destination' || phase === 'arrived_prt') {
        // eslint-disable-next-line react-hooks/purity
        if (!job.arrivedDestinationAt) finalExtra.arrivedDestinationAt = Date.now();
        finalExtra.drivenDistance = await calculateJobDistance(job);
      }

      await updateDoc(doc(db, 'transport_jobs', job.id), { phase, ...finalExtra });

      if (phase === 'arrived_pickup') notifyClient(job, 'llegada_origen');
      if (phase === 'picked_up') notifyClient(job, 'en_ruta');

      if (phase === 'arrived_prt') notifyClient(job, 'llegada_prt');
      if (phase === 'prt_done') {
        if (extra.prt_result === 'rechazado') notifyClient(job, 'rt_rechazada');
        else notifyClient(job, 'rt_aprobada');
      }

      if (phase === 'arrived_destination') {
        if (job.tripType === 'revision' && job.phase === 'prt_done') {
          // Si viene saliendo de la PRT, es llegada a destino
          notifyClient(job, 'llegada_destino');
        } else {
          notifyClient(job, 'llegada_destino');
        }
      }
    } catch (e) {
      console.error(e); showAlert("Error de conexión al actualizar fase.");
    } finally {
      setTimeout(() => setProcessingId(null), 300);
    }
  };

  // === NUEVO: FUNCIÓN PARA DESHACER FASE ===
  const handleUndoPhase = async (job) => {
    if (processingId) return;

    let prevPhase = null;
    let updates = {};

    switch (job.phase) {
      case 'arrived_pickup':
        prevPhase = deleteField();
        updates.arrivedPickupAt = deleteField();
        break;
      case 'picked_up':
        prevPhase = 'arrived_pickup';
        updates.pickedUpAt = deleteField();
        updates.waitTimeMinutes = deleteField();
        break;
      case 'arrived_prt':
        prevPhase = 'picked_up';
        updates.arrivedDestinationAt = deleteField();
        updates.drivenDistance = deleteField();
        break;
      case 'prt_done':
        prevPhase = 'arrived_prt';
        updates.prt_result = deleteField();
        updates.prt_reason = deleteField();
        break;
      case 'arrived_destination':
        prevPhase = job.tripType === 'revision' ? 'prt_done' : 'picked_up';
        updates.arrivedDestinationAt = deleteField();
        updates.drivenDistance = deleteField();
        break;
      default:
        return showAlert("No hay ningún paso anterior para deshacer.");
    }

    showConfirm("¿Estás seguro de deshacer el último estado y volver un paso atrás?", async () => {
      setProcessingId(`${job.id}-undo`);
      try {
        await updateDoc(doc(db, 'transport_jobs', job.id), { phase: prevPhase, ...updates });
        showAlert("⏪ Paso atrás realizado con éxito.");
        setMenuOpenId(null);
      } catch (e) {
        console.error(e);
        showAlert("Error al deshacer el estado.");
      } finally {
        setProcessingId(null);
      }
    });
  };
  // ==========================================

  const handleAcceptJob = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-accept`);
    try {
      updateDoc(doc(db, 'transport_jobs', job.id), { status: 'accepted', acceptedByEmail: currentUserEmail }).catch(e => console.error(e));
      notifyClient({ ...job, acceptedByEmail: currentUserEmail }, 'asignado');

      const driverName = drivers?.find(d => d.email === currentUserEmail)?.name || currentUserEmail;

      fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'job_accepted',
          driverName: driverName,
          jobDetails: {
            client: job.client || 'Sin Cliente',
            vehicle: job.tripType === 'simple' ? (job.description || 'Servicio en Terreno') : (`${job.brand || ''} ${job.model || ''}`.trim() || 'Servicio'),
            plate: getJobIdentifier(job),
            origin: job.origin || 'No especificado'
          }
        })
      }).catch(err => console.warn("Aviso al admin falló:", err));

      window.scrollTo({ top: 0, behavior: 'smooth' });

      // NUEVO: Abrir automáticamente el Panel de Viaje al aceptar
      setTrackingJobId(job.id);
    }
    finally {
      setTimeout(() => setProcessingId(null), 300);
    }
  };

  const now = new Date();
  const isAdminView = role === 'admin';

  const myFleetGroups = jobs.filter(j =>
    ((j.status === 'pending' && j.assignedEmails?.includes(currentUserEmail)) ||
      ((j.status === 'accepted' || j.status === 'pending_guide') && j.acceptedByEmail === currentUserEmail)) &&
    j.fleetGroup
  ).map(j => j.fleetGroup);

  const filteredJobs = jobs.filter(job => {
    if (job.isArchived) return false; // <-- NUEVO: Oculta los purgados de la interfaz pero mantienen las estadísticas

    if (!isAdminView) {
      // NUEVO: Ocultar inmediatamente trabajos aceptados por otros (salvo que sea un convoy donde ya participes)
      if ((job.status === 'accepted' || job.status === 'pending_guide' || job.status === 'completed' || job.status === 'failed') && job.acceptedByEmail !== currentUserEmail) {
        const isMyFleet = job.fleetGroup && myFleetGroups.includes(job.fleetGroup);
        if (!isMyFleet) return false;
      }

      const isMine = (job.status === 'pending' && job.assignedEmails?.includes(currentUserEmail)) ||
        ((job.status === 'accepted' || job.status === 'pending_guide') && job.acceptedByEmail === currentUserEmail) ||
        (job.status === 'requested' && job.requestedBy === currentUserEmail) ||
        ((job.status === 'completed' || job.status === 'failed') && job.acceptedByEmail === currentUserEmail);
      const isMyFleet = job.fleetGroup && myFleetGroups.includes(job.fleetGroup);
      if (!isMine && !isMyFleet) return false;
    }

    if (!job.createdAt) return true;
    if (!isAdminView) {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if ((now.getTime() - job.createdAt) > sevenDays) return false;
    } else {
      const sixtyDays = 60 * 24 * 60 * 60 * 1000;
      if ((now.getTime() - job.createdAt) > sixtyDays) return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchPlate = (job.plate || job.associatedPlate || '').toLowerCase().includes(term);
      const matchBrand = (job.brand || '').toLowerCase().includes(term);
      const matchModel = (job.model || '').toLowerCase().includes(term);
      const matchClient = (job.client || '').toLowerCase().includes(term);
      const matchOrigin = (job.origin || '').toLowerCase().includes(term);
      const matchDest = (job.destination || job.destName || '').toLowerCase().includes(term);

      if (!matchPlate && !matchBrand && !matchModel && !matchClient && !matchOrigin && !matchDest) return false;
    }
    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const adminOrder = { requested: 1, pending: 2, accepted: 3, pending_guide: 3, completed: 4, failed: 4 };
    const driverOrder = { accepted: 1, pending_guide: 1, requested: 2, pending: 3, completed: 4, failed: 4 };
    const order = isAdminView ? adminOrder : driverOrder;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === 'completed' || a.status === 'failed') return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);

    // NUEVO: Prioridad Urgente bypass a la fecha (los sube al inicio de su lista)
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;

    const getValidTime = (dateStr, fallback) => {
      if (!dateStr) return fallback || 0;
      const time = new Date(dateStr).getTime();
      return isNaN(time) ? fallback || 0 : time;
    };
    return getValidTime(a.scheduledDate, a.createdAt) - getValidTime(b.scheduledDate, b.createdAt);
  });

  const activeJobs = sortedJobs.filter(j => j.status === 'requested' || j.status === 'pending' || j.status === 'accepted' || j.status === 'pending_guide');
  const historyJobsRaw = sortedJobs.filter(j => j.status === 'completed' || j.status === 'failed');

  const historyJobs = historyJobsRaw.filter(j => {
    if (!historyClientFilter) return true;
    if (historyClientFilter === 'OTRO') return !allClientsList.includes(j.client);
    return j.client === historyClientFilter;
  });

  const isToday = (timestamp) => {
    if (!timestamp) return false;
    const d = new Date(timestamp);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const todayHistoryJobs = historyJobs.filter(j => isToday(j.completedAt || j.createdAt));
  const olderHistoryJobs = historyJobs.filter(j => !isToday(j.completedAt || j.createdAt));

  const requestedJobsList = activeJobs.filter(j => j.status === 'requested');
  const pendingJobsList = activeJobs.filter(j => j.status === 'pending');
  const inProgressJobsList = activeJobs.filter(j => j.status === 'accepted' || j.status === 'pending_guide');

  const handleApproveRequest = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-approve`);
    try {
      await updateDoc(doc(db, 'transport_jobs', job.id), { status: 'pending' });
      showAlert("✅ Solicitud aprobada. El trabajo ha sido publicado a la flota.");
    } catch (e) {
      console.error(e); showAlert("Error al aprobar.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (job) => {
    showConfirm("¿Rechazar y eliminar esta solicitud de trabajo permanentemente?", async () => {
      try { await deleteDoc(doc(db, 'transport_jobs', job.id)); showAlert("❌ Solicitud rechazada y eliminada."); }
      catch (e) { console.error(e); }
    });
  };

  const handleDeleteJob = async (jobId) => {
    showConfirm("¿Estás seguro de eliminar este trabajo definitivamente?", async () => {
      try {
        await deleteDoc(doc(db, 'transport_jobs', jobId));
        showAlert("✅ Traslado eliminado correctamente de la base de datos.");
      } catch (e) {
        console.error("Error eliminando traslado:", e);
        showAlert("❌ Error al eliminar el traslado. Revisa tu conexión.");
      }
    });
  };

  const handleFailJob = async (job, reason) => {
    if (processingId) return;
    setProcessingId(`${job.id}-fail`);
    try {
      await updateDoc(doc(db, 'transport_jobs', job.id), {
        status: 'failed',
        failedReason: reason,
        completedAt: Date.now()
      });
      showAlert("❌ Trabajo marcado como fallido/cancelado.");
      setJobToFail(null);
    } catch (error) {
      console.error(error);
      showAlert("Error al cancelar el trabajo.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDuplicateJob = (job) => {
    setDupPromptJob(job);
    setDupMode('clone');
    setDupDestination('');
    setDupDriverEmails([]); // LIMPIA EL ARREGLO MÚLTIPLE
  };

  const executeDuplicate = async () => {
    if (dupMode === 'continue' && !dupDestination.trim() && dupPromptJob.tripType !== 'simple') {
      return showAlert("Debes ingresar el nuevo destino para continuar la ruta.");
    }
    setProcessingId(`dup-${dupPromptJob.id}`);

    try {
      let origin = dupPromptJob.origin || '';
      let destination = dupPromptJob.destination || '';

      if (dupMode === 'return') {
        origin = dupPromptJob.tripType === 'revision' ? 'Planta PRT' : (dupPromptJob.destination || dupPromptJob.origin);
        destination = dupPromptJob.origin || '';
      } else if (dupMode === 'continue') {
        origin = dupPromptJob.tripType === 'revision' ? 'Planta PRT' : (dupPromptJob.destination || dupPromptJob.origin);
        destination = dupDestination.trim();
      }

      let assignedDrivers = [];
      let assignedEmails = [];

      if (dupDriverEmails.length > 0) {
        // BUSCA Y ASIGNA A TODOS LOS CONDUCTORES SELECCIONADOS
        assignedDrivers = drivers
          .filter(d => dupDriverEmails.includes(d.email))
          .map(d => ({ id: d.id, name: d.name, email: d.email }));
        assignedEmails = dupDriverEmails;
      }

      const isRequestMode = role !== 'admin';
      const finalStatus = isRequestMode ? 'requested' : 'pending';

      const cloneJob = {
        client: dupPromptJob.client || '',
        brand: dupPromptJob.brand || '',
        model: dupPromptJob.model || '',
        vin: dupPromptJob.vin || '',
        plate: dupPromptJob.plate || '',
        associatedPlate: dupPromptJob.associatedPlate || '',
        isPintura: dupPromptJob.isPintura || false,
        qtyPintura: dupPromptJob.qtyPintura || 0,
        isGrabado: dupPromptJob.isGrabado || false,
        qtyGrabado: dupPromptJob.qtyGrabado || 0,
        tripType: dupPromptJob.tripType || 'viaje',
        description: dupPromptJob.description || '',
        origin: origin,
        destination: destination,
        assignedDrivers: assignedDrivers,
        assignedEmails: assignedEmails,
        status: finalStatus,
        requestedBy: isRequestMode ? currentUserEmail : null,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'transport_jobs'), cloneJob);
      showAlert(isRequestMode ? "✅ Solicitud enviada. Esperando aprobación del administrador." : "✅ Nuevo traslado creado con éxito. Revisa la lista de pendientes.");
      setDupPromptJob(null);
    } catch (e) {
      console.error(e);
      showAlert("Error al crear el nuevo traslado.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateFleet = async () => {
    if (fleetSelectedIds.length < 2) return showAlert("Selecciona al menos 2 vehículos para formar un convoy.");
    setProcessingId('create-fleet');
    try {
      const newFleetId = `FLT-${Date.now()}`;
      for (const jId of fleetSelectedIds) {
        await updateDoc(doc(db, 'transport_jobs', jId), { fleetGroup: newFleetId });
      }
      showAlert("✅ Convoy de Flota creado exitosamente. La Firma Masiva está habilitada para este grupo.");
      setShowFleetModal(false);
      setFleetSelectedIds([]);
    } catch (e) {
      console.error(e);
      showAlert("Error al agrupar los vehículos.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkSignSubmit = async () => {
    if (bulkSelectedIds.length === 0) return showAlert("Selecciona al menos un vehículo para entregar.");
    if (!bulkReceiverName || !bulkReceiverRut || !bulkSignature) return showAlert("Faltan datos del receptor o la firma.");

    setProcessingId('bulk-sign');
    try {
      for (const jId of bulkSelectedIds) {
        const jobToClose = inProgressJobsList.find(j => j.id === jId);
        if (!jobToClose) continue;

        const draftData = jobToClose.draft?.formData || {};
        const existingPhotos = draftData.photos || jobToClose.checklist?.photos || {};

        const mergedChecklist = {
          client: jobToClose.client || '',
          brand: jobToClose.brand || '',
          model: jobToClose.model || '',
          plateOrVin: jobToClose.plate || jobToClose.vin || jobToClose.associatedPlate || '',
          origin: jobToClose.origin || '',
          destination: jobToClose.destination || '',
          fuelLevel: draftData.fuelLevel || 50,
          photos: existingPhotos,
          docs: draftData.docs || {},
          observations: draftData.observations || 'Entrega masiva de flota.',
          receiverName: bulkReceiverName,
          receiverRut: bulkReceiverRut,
          noReception: false,
          signatureData: bulkSignature,
          assignedDriverName: drivers?.find(d => d.email === jobToClose.acceptedByEmail)?.name || jobToClose.acceptedByEmail
        };

        await updateDoc(doc(db, 'transport_jobs', jId), {
          status: 'completed',
          // eslint-disable-next-line react-hooks/purity
          completedAt: Date.now(),
          checklist: mergedChecklist,
          phase: jobToClose.tripType === 'revision' ? 'prt_done' : 'arrived_destination',
          draft: deleteField()
        });

        notifyClient({ ...jobToClose, acceptedByEmail: jobToClose.acceptedByEmail, assignedDriverName: mergedChecklist.assignedDriverName }, 'finalizado');
      }

      showAlert(`✅ ${bulkSelectedIds.length} traslados finalizados exitosamente con una sola firma.`);
      setShowBulkSign(false);
      setBulkSelectedIds([]);
      setBulkReceiverName('');
      setBulkReceiverRut('');
      setBulkSignature(null);
    } catch (e) {
      console.error(e);
      showAlert("Error crítico al procesar la firma masiva. Verifica tu conexión.");
    } finally {
      setProcessingId(null);
    }
  };

  // Función Global (Recalcula TODOS los traslados finalizados)
  const handleRecalculateKm = async () => {
    if (!window.google || !window.google.maps) return showAlert("La API de Google Maps no está disponible en este momento.");

    const jobsToUpdate = jobs.filter(j =>
      (j.status === 'completed' || j.status === 'failed') &&
      j.origin && (j.destination || j.destName || j.tripType === 'revision')
    );

    if (jobsToUpdate.length === 0) return showAlert("No se encontraron traslados válidos para recalcular.");

    showConfirm(`Se actualizarán las distancias de ${jobsToUpdate.length} traslados finalizados. ¿Deseas recalcularlos ahora de forma automática? (Puede tardar un momento)`, async () => {
      setIsCalculatingKm(true);
      let successCount = 0;

      for (let i = 0; i < jobsToUpdate.length; i++) {
        const job = jobsToUpdate[i];
        setCalcProgress(`${i + 1}/${jobsToUpdate.length}`);
        const dist = await calculateJobDistance(job);
        if (dist !== 'No calculado') {
          await updateDoc(doc(db, 'transport_jobs', job.id), { drivenDistance: dist });
          successCount++;
        }
        await new Promise(r => setTimeout(r, 800)); // Delay para no saturar la API
      }

      setIsCalculatingKm(false);
      setCalcProgress('');
      showAlert(`✅ Recálculo terminado. Se actualizaron ${successCount} traslados correctamente.`);
    });
  };

  // Función Individual de Recálculo (Usa el mismo motor inteligente)
  const handleSingleRecalculate = async (job) => {
    if (!window.google || !window.google.maps) return showAlert("La API de Google Maps no está disponible.");
    setProcessingId(`${job.id}-recalc-km`);

    try {
      const dist = await calculateJobDistance(job);
      if (dist !== 'No calculado') {
        await updateDoc(doc(db, 'transport_jobs', job.id), { drivenDistance: dist });
        showAlert("✅ Kilómetros recalculados con éxito para este traslado.");
      } else {
        showAlert("❌ Maps no pudo trazar la ruta con esas direcciones.");
      }
    } catch (err) {
      showAlert("❌ Error al procesar la ruta.");
    } finally {
      setProcessingId(null);
    }
  };
  const buildPDFDoc = async (job) => {
    const { buildPDFDoc: masterPDFBuilder } = await import('../../utils/pdfGenerator');
    return await masterPDFBuilder(job, drivers);
  };

  const getDStr = j => j.scheduledDate ? formatDateDisplay(j.scheduledDate) : formatDateDisplay(new Date().toISOString().split('T')[0]);

  const handleCopyWhatsApp = (job) => {
    updateDoc(doc(db, 'transport_jobs', job.id), { sharedCount: (job.sharedCount || 0) + 1 }).catch(e => console.log(e));

    const dateStr = getDStr(job);
    const dateShort = dateStr.substring(0, 5);
    const jobPlate = getJobIdentifier(job);
    const text = generateWhatsAppText(job, dateShort, jobPlate);

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); showAlert("✅ Formato copiado al portapapeles. Listo para pegar en WhatsApp."); } catch (err) { showAlert("Tu navegador bloqueó el copiado automático."); }
    document.body.removeChild(textArea);
    setMenuOpenId(null);
  };
  const cpyWapp = handleCopyWhatsApp;

  const generatePDF = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-pdf`);
    try {
      const docPDF = await buildPDFDoc(job);
      const cleanPlate = getJobIdentifier(job);
      const fileName = generateStandardFileName(job, getDStr(job), cleanPlate);
      docPDF.save(fileName);
    } catch (e) { console.error(e); showAlert("Hubo un error al generar PDF."); }
    finally { setProcessingId(null); }
  };

  const handleShareWhatsAppPDF = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-wapp`);

    updateDoc(doc(db, 'transport_jobs', job.id), {
      sharedCount: (job.sharedCount || 0) + 1
    }).catch(e => console.log("Error contador:", e));

    try {
      const dateStrForFile = getDStr(job);
      const dateShort = dateStrForFile.substring(0, 5);
      const cleanPlate = getJobIdentifier(job);

      const fileName = generateStandardFileName(job, dateStrForFile, cleanPlate);
      const textToShare = generateWhatsAppText(job, dateShort, cleanPlate);

      // Copiamos el texto al portapapeles de inmediato, por si cualquier cosa falla después
      const textArea = document.createElement("textarea");
      textArea.value = textToShare;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch (err) { }
      document.body.removeChild(textArea);

      const docPDF = await buildPDFDoc(job);
      const pdfBlob = docPDF.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: fileName,
            text: textToShare,
            files: [file]
          });
        } catch (shareError) {
          if (shareError.name !== 'AbortError') {
            showAlert("El dispositivo bloqueó compartir directamente. Descargando archivo...");
            docPDF.save(fileName);
          }
        }
      } else {
        showAlert("Tu dispositivo no soporta compartir el archivo directamente. Descargando PDF...");
        docPDF.save(fileName);
      }

    } catch (e) {
      console.error("Error general al intentar compartir:", e);
      // Si ocurre un error real, ahora veremos el motivo técnico exacto en pantalla
      showAlert(`Error técnico: ${e.message || 'No se pudo generar PDF'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const getRtFinalDestination = (job) => {
    // 1. PRIORIDAD ABSOLUTA: Si el administrador editó la ruta con flechas, esta gana por sobre el checklist.
    if (job.destination && job.destination.includes('->')) {
      const parts = job.destination.split('->');
      return parts[parts.length - 1].trim();
    }

    // 2. Si no hay ruta editada manual, tomamos la decisión del checklist
    if (job.checklist?.rtReturnOption === 'other' && job.checklist?.rtReturnDestination) {
      return job.checklist.rtReturnDestination;
    }
    if (job.checklist?.rtReturnOption === 'origin') {
      return job.origin;
    }

    // 3. Fallback final si no hay checklist cerrado ni flechas
    if (job.destination && !job.destination.toLowerCase().includes('prt')) {
      return job.destination.trim();
    }
    return job.origin || 'Por definir';
  };

  const jobCardProps = {
    analyzeJobStatus, getJobIdentifier, vehicles, menuOpenId, setMenuOpenId, isAdminView, onEditJob, currentUserEmail, setRelayPromptJob, setForceCloseJob, db, updateDoc, deleteField, doc, showAlert, showConfirm, setJobToFail, latestVehiclePhotos, setFullScreenPhoto, role, processingId, setProcessingId, handleApproveRequest, handleRejectRequest, handleAcceptJob, setTrackingJobId, setGuideUploadJob, setGuideLink, setGuideFileBase64, updatePhase, setArrivalPromptJob, setArrivalMileage, setArrivalPhoto, setArrivalKeyLocation, setArrivalKeyHandedTo, setPrtApproveType, setPrtReturnOpt, setPrtReturnDest, setPrtApprovePromptJob, setPrtPromptJob, onStartChecklist, handleUndoPhase, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, WaitTimerBadge, SwipeButton, AlertCircle, Edit2, MoreVertical, Navigation, Share2, Users, CheckCircle, Truck, X, XCircle, Clock, Car, MapPin, FileText,
    // FALTANTES QUE CAUSABAN LA PANTALLA BLANCA AL ABRIR EL MENÚ:
    Copy, Trash2, Repeat, FileDown, cpyWapp, handleDuplicateJob, handleDeleteJob, generatePDF, handleShareWhatsAppPDF
  };
  const renderActiveJobCard = (j) => <JobCard key={j.id} j={j} {...jobCardProps} />;

  const historyJobCardProps = {
    drivers, getJobIdentifier, setSelectedHistoryJob, latestVehiclePhotos, setFullScreenPhoto, auditMode, isAdminView, setEditDateJob, setEditKmJob, handleSingleRecalculate, processingId, onEditJob, handleDuplicateJob, generatePDF, handleShareWhatsAppPDF, handleDeleteJob, updateDoc, doc, deleteField, db, showConfirm, showAlert, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, AlertCircle, Navigation, Edit2, MapPin, FileText, Clock, MapIcon, CheckCircle, Repeat, FileDown, Trash2, Share2,
    // FALTANTES DE SEGURIDAD EN EL HISTORIAL:
    Copy, MoreVertical, cpyWapp
  };
  const renderHistoryJobCard = (j) => <HistoryJobCard key={j.id} j={j} {...historyJobCardProps} />;

  const handlePurgeOldJobs = async () => {
    showConfirm("⚠️ ¿Estás seguro de limpiar la base de datos? Se empaquetarán todas las actas de más de 30 días en un archivo ZIP para tu respaldo, y luego se eliminarán de la nube.", async () => {
      try {
        showAlert("⏳ Buscando traslados antiguos en la base de datos...");
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        const q = query(collection(db, 'transport_jobs'), where('createdAt', '<', thirtyDaysAgo));
        const snap = await getDocs(q);

        if (snap.empty) return showAlert("No hay traslados antiguos para eliminar.");

        const jobsToExport = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(j => j.checklist);

        if (jobsToExport.length > 0) {
          showAlert(`⏳ Procesando ${jobsToExport.length} actas antiguas en un archivo ZIP. Por favor no cierres la aplicación...`);

          const JSZip = await new Promise((resolve) => {
            if (window.JSZip) return resolve(window.JSZip);
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            document.body.appendChild(script);
          });

          const zip = new JSZip();
          for (const job of jobsToExport) {
            const docPDF = await buildPDFDoc(job);
            const cleanPlate = getJobIdentifier(job);
            const fileName = generateStandardFileName(job, getDStr(job), cleanPlate);
            zip.file(fileName, docPDF.output('blob'));
          }

          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          const link = document.createElement("a");
          link.href = url;
          link.download = `Respaldo_Limpieza_LogisticAPP_${new Date().toISOString().split('T')[0]}.zip`;
          link.click();

          showAlert("✅ Respaldo ZIP descargado. Consolidando estadísticas y borrando...");
        }

        // NUEVO: Agrupar traslados a eliminar por mes para crear la "fotografía estática"
        const { getDoc, setDoc } = await import('firebase/firestore');
        const jobsByMonth = {};

        snap.docs.forEach(documentSnap => {
          const j = { id: documentSnap.id, ...documentSnap.data() };
          if (j.status === 'completed' || j.status === 'failed') {
            const d = new Date(j.completedAt || j.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!jobsByMonth[key]) jobsByMonth[key] = [];
            jobsByMonth[key].push(j);
          }
        });

        // Guardar estadísticas estáticas en Firebase
        for (const [monthKey, monthJobs] of Object.entries(jobsByMonth)) {
          const statRef = doc(db, 'historical_stats', monthKey);
          const statSnap = await getDoc(statRef);
          let monthStats = statSnap.exists() ? statSnap.data() : {
            isStaticSnapshot: true,
            totalJobs: 0, totalKm: 0, totalRevenue: 0,
            prtStats: { total: 0, approved: 0, help: 0, rejected: 0 },
            clientCounts: {}, clientRevenues: {}, driverKms: {}, categoryCounts: {}, plateCounts: {}
          };

          monthJobs.forEach(j => {
            monthStats.totalJobs += 1;

            const cName = j.client || 'Sin Cliente';
            monthStats.clientCounts[cName] = (monthStats.clientCounts[cName] || 0) + 1;

            const price = Number(j.companyPrice) || 0;
            monthStats.clientRevenues[cName] = (monthStats.clientRevenues[cName] || 0) + price;
            monthStats.totalRevenue += price;

            if (j.tripType === 'revision') {
              monthStats.prtStats.total += 1;
              if (j.status === 'failed' || j.prt_result === 'rechazado') monthStats.prtStats.rejected += 1;
              else if (j.prt_result === 'aprobado_ayuda') monthStats.prtStats.help += 1;
              else monthStats.prtStats.approved += 1;
            }

            let km = 0;
            if (j.drivenDistance && j.drivenDistance.includes('km')) {
              let s = j.drivenDistance.toLowerCase().replace(/[^\d.,]/g, '');
              if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
              else if (s.includes('.') && s.split('.').pop().length === 3) s = s.replace(/\./g, '');
              km = parseFloat(s) || 0;
            }

            if (km > 0) {
              monthStats.totalKm += km;
              const drvName = (Array.isArray(drivers) ? drivers.find(d => d.email === j.acceptedByEmail)?.name : null) || j.acceptedByEmail || 'Desconocido';
              monthStats.driverKms[drvName] = (monthStats.driverKms[drvName] || 0) + km;
            }

            if ((j.status === 'completed' || j.status === 'failed') && j.acceptedByEmail) {
              const drvName = (Array.isArray(drivers) ? drivers.find(d => d.email === j.acceptedByEmail)?.name : null) || j.acceptedByEmail || 'Desconocido';
              let vType = (j.checklist?.vehicleType || 'auto').toLowerCase();
              if (j.tripType === 'simple') vType = 'servicio';

              if (!monthStats.categoryCounts[vType]) monthStats.categoryCounts[vType] = {};
              monthStats.categoryCounts[vType][drvName] = (monthStats.categoryCounts[vType][drvName] || 0) + 1;
            }

            const plate = (j.plate && j.plate !== 'S/N') ? j.plate : ((j.vin && j.vin !== 'S/N') ? j.vin : null);
            if (plate) {
              const cleanPlate = plate.toUpperCase().trim();
              monthStats.plateCounts[cleanPlate] = (monthStats.plateCounts[cleanPlate] || 0) + 1;
            }
          });

          await setDoc(statRef, monthStats);
        }

        let count = 0;
        for (const document of snap.docs) {
          // AHORA SÍ: Eliminamos el documento por completo para liberar espacio 100% real
          await deleteDoc(doc(db, 'transport_jobs', document.id));
          count++;
        }
        showAlert(`✅ Limpieza Maestra: ${count} traslados respaldados en ZIP y eliminados de la nube (Fotografía estadística guardada con éxito).`);
      } catch (err) { console.error(err); showAlert("Error al limpiar la base de datos."); }
    });
  };

  const handleDownloadAllZIP = async () => {
    showAlert("⏳ Comprimiendo... Por favor espera.");
    try {
      const JSZip = await new Promise((resolve) => {
        if (window.JSZip) return resolve(window.JSZip);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        document.body.appendChild(script);
      });

      const zip = new JSZip();
      for (const job of historyJobs.filter(j => j.checklist)) {
        const docPDF = await buildPDFDoc(job);
        const cleanPlate = getJobIdentifier(job);
        const fileName = generateStandardFileName(job, getDStr(job), cleanPlate);
        zip.file(fileName, docPDF.output('blob'));
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Actas_LogisticAPP_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      showAlert("✅ ¡Archivo ZIP generado y descargado con éxito!");
    } catch (err) { showAlert("Error al generar ZIP."); }
  };

  // NUEVO: Descarga Facturación Kovacs (Actas sin foto + Guías de Despacho)
  const handleKovacsZIP = async () => {
    if (!kovacsStartDate || !kovacsEndDate) return showAlert("⚠️ Debes seleccionar una fecha de inicio y fin.");

    const startObj = new Date(kovacsStartDate + "T00:00:00");
    const endObj = new Date(kovacsEndDate + "T23:59:59");
    const startTime = startObj.getTime();
    const endTime = endObj.getTime();

    const kovacsJobs = jobs.filter(j => {
      if (j.status !== 'completed' || !j.checklist || !(j.client || '').toLowerCase().includes('kovac')) return false;
      let jobTime = j.completedAt;
      if (!jobTime && j.createdAt) jobTime = typeof j.createdAt.toMillis === 'function' ? j.createdAt.toMillis() : j.createdAt;
      if (typeof jobTime !== 'number') return false;
      return jobTime >= startTime && jobTime <= endTime;
    });

    if (kovacsJobs.length === 0) return showAlert("No hay traslados de Kovacs finalizados en el rango seleccionado.");

    setShowKovacsModal(false);
    showAlert(`⏳ Facturación Kovacs: Procesando ${kovacsJobs.length} traslados...`);
    try {
      const JSZip = await new Promise((resolve) => {
        if (window.JSZip) return resolve(window.JSZip);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        document.body.appendChild(script);
      });

      const zip = new JSZip();
      let count = 0;

      for (const job of kovacsJobs) {
        const cleanPlate = getJobIdentifier(job);
        const dateStr = getDStr(job);

        // 1. Crear copia del trabajo y vaciar las fotos del checklist para generar PDF liviano (1 hoja)
        const jobSinFotos = JSON.parse(JSON.stringify(job));
        if (jobSinFotos.checklist) {
          jobSinFotos.checklist.photos = {};
        }

        const docPDF = await buildPDFDoc(jobSinFotos);
        const actaName = `Acta_SinFotos_${cleanPlate}_${dateStr}.pdf`.replace(/\//g, '-');
        zip.file(actaName, docPDF.output('blob'));

        // 2. Extraer Guía de Despacho si está adjunta
        const guideUrl = job.guideLink || job.guideUrl || job.docLink || job.docUrl || job.rtLink || job.rtDoc || job.pdfUrl || job.fileUrl || job.checklist?.guiaDespachoPdf || job.checklist?.guiaDespachoLink;

        if (guideUrl && guideUrl.startsWith('http')) {
          try {
            const res = await fetch(guideUrl);
            const blob = await res.blob();
            const ext = blob.type.includes('image') ? 'jpg' : 'pdf';
            const guideName = `Guia_${cleanPlate}_${dateStr}.${ext}`.replace(/\//g, '-');
            zip.file(guideName, blob);
          } catch (fetchErr) {
            console.warn(`CORS o error al obtener guía de ${cleanPlate}`);
          }
        }
        count++;
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Facturacion_KOVACS_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      showAlert(`✅ ¡Facturación Kovacs lista! Se descargaron ${count} actas simplificadas con sus respectivas guías.`);
    } catch (err) {
      console.error(err);
      showAlert("Error al generar el paquete de Kovacs.");
    }
  };

  // NUEVO: Función para Buscar y Reemplazar Masivamente
  const executeBulkReplace = async () => {
    if (!replaceSearchTerm.trim() || !replaceNewTerm.trim()) {
      return showAlert("Debes ingresar el texto a buscar y el nuevo texto de reemplazo.");
    }

    const searchLower = replaceSearchTerm.trim().toLowerCase();
    const jobsToModify = jobs.filter(j => {
      if (replaceField === 'destination') {
        const val = j.destination || j.destName || '';
        return val.toLowerCase() === searchLower; // Coincidencia exacta (ignorando mayúsculas)
      } else {
        const val = j.origin || '';
        return val.toLowerCase() === searchLower;
      }
    });

    if (jobsToModify.length === 0) {
      return showAlert(`No se encontraron traslados con ese ${replaceField === 'destination' ? 'Destino' : 'Origen'} exacto.`);
    }

    showConfirm(`Se encontraron ${jobsToModify.length} traslados. ¿Estás seguro de reemplazar masivamente "${replaceSearchTerm}" por "${replaceNewTerm}"? Esto no se puede deshacer.`, async () => {
      setProcessingId('bulk-replace');
      let count = 0;
      try {
        for (const job of jobsToModify) {
          const updateData = replaceField === 'destination'
            ? { destination: replaceNewTerm.trim(), destName: replaceNewTerm.trim() }
            : { origin: replaceNewTerm.trim() };

          await updateDoc(doc(db, 'transport_jobs', job.id), updateData);
          count++;
        }
        showAlert(`✅ Éxito: Se actualizaron ${count} registros masivamente.`);
        setShowReplaceModal(false);
        setReplaceSearchTerm('');
        setReplaceNewTerm('');
      } catch (err) {
        console.error("Error en reemplazo masivo:", err);
        showAlert("❌ Ocurrió un error al intentar actualizar los registros.");
      } finally {
        setProcessingId(null);
      }
    });
  };

  if (!isAppReady) return null;
  const canBulkSign = inProgressJobsList.some(j => j.fleetGroup);

  // --- LÓGICA DE KILOMETRAJE MENSUAL DEL CONDUCTOR ---
  const parseDist = (str) => {
    if (!str) return 0;
    let s = str.toLowerCase().replace(/[^\d.,]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes('.') && s.split('.').pop().length === 3) s = s.replace(/\./g, '');
    return parseFloat(s) || 0;
  };

  const currMonth = new Date().getMonth();
  const currYear = new Date().getFullYear();
  const myMonthlyKm = jobs.filter(j => {
    if (!(j.status === 'completed' || j.status === 'failed') || j.acceptedByEmail !== currentUserEmail) return false;
    const d = new Date(j.completedAt || j.createdAt);
    return d.getMonth() === currMonth && d.getFullYear() === currYear;
  }).reduce((acc, job) => acc + parseDist(job.drivenDistance), 0);

  return (
    <div className="pb-16">
      {!isAdminView && (
        <div className="mb-6 bg-gradient-to-br from-indigo-800 to-blue-600 rounded-[2rem] p-6 sm:p-8 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-[-10%] top-[-20%] bottom-0 opacity-10 pointer-events-none">
            <MapIcon className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Rendimiento Mensual</p>
            <p className="text-2xl sm:text-3xl font-black leading-tight">Este mes has conducido <span className="text-amber-400">{myMonthlyKm.toLocaleString('es-CL')} km</span></p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 relative z-10">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="w-5 h-5 text-slate-400" /></div>
          <input type="text" placeholder="Buscar patente, marca, cliente, origen o destino..." autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="none" className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" value={localSearchTerm} onChange={(e) => setLocalSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-none items-center">
          {isAdminView && (
            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3.5 rounded-2xl border-2 border-slate-200 shadow-sm hover:bg-slate-50 transition-colors shrink-0">
              <span className={`text-xs font-black uppercase tracking-widest ${auditMode ? 'text-purple-600' : 'text-slate-400'}`}>Modo Auditoría</span>
              <div className="relative flex items-center">
                <input type="checkbox" className="sr-only" checked={auditMode} onChange={() => setAuditMode(!auditMode)} />
                <div className={`block w-8 h-4 rounded-full transition-colors ${auditMode ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
                <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${auditMode ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>
          )}

          {canBulkSign && (
            <button onClick={() => { setBulkSelectedIds([]); setBulkReceiverName(''); setBulkReceiverRut(''); setBulkSignature(null); setShowBulkSign(true); }} className="group bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shrink-0">
              <PenTool className="w-5 h-5" /> Firma Masiva
            </button>
          )}
          {isAdminView && (
            <>
              <button type="button" onClick={() => setShowFleetMenu(true)} className="group bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shrink-0">
                <Truck className="w-5 h-5" /> Flotas
              </button>
              {auditMode && (
                <>
                  <button type="button" onClick={handlePurgeOldJobs} className="group bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shrink-0 transition-colors">
                    <Trash2 className="w-5 h-5" /> Limpiar DB
                  </button>
                  <button type="button" onClick={() => setShowReplaceModal(true)} className="group bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shrink-0 transition-colors">
                    <RefreshCw className="w-5 h-5" /> Renombrar Masivo
                  </button>
                  <button type="button" onClick={handleRecalculateKm} disabled={isCalculatingKm} className="group bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 shadow-md transition-colors">
                    {isCalculatingKm ? <Clock className="w-5 h-5 animate-spin" /> : <MapIcon className="w-5 h-5" />}
                    {isCalculatingKm ? `Calc: ${calcProgress}` : 'Recalcular KM'}
                  </button>
                  <button type="button" onClick={handleDownloadAllZIP} className="group bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shrink-0 transition-colors">
                    <FileDown className="w-5 h-5" /> ZIP
                  </button>
                  <button type="button" onClick={() => setShowKovacsModal(true)} className="group bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shrink-0 shadow-md transition-colors">
                    <FileText className="w-5 h-5" /> Facturación Kovacs
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">

        {/* COLUMNA SOLICITUDES (NUEVO) */}
        {requestedJobsList.length > 0 && (
          <div className="w-full lg:flex-1 flex flex-col overflow-hidden border-2 border-pink-100 bg-pink-50/40 rounded-3xl shadow-sm">
            <button onClick={() => setIsRequestedOpen(!isRequestedOpen)} className="w-full flex justify-between items-center p-4">
              <h3 className="font-extrabold text-pink-600 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Por Aprobar ({requestedJobsList.length})</h3>
              {isRequestedOpen ? <ChevronUp className="w-5 h-5 text-pink-600" /> : <ChevronDown className="w-5 h-5 text-pink-600" />}
            </button>
            {isRequestedOpen && (
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-8 pt-2 -mx-4 lg:mx-0 lg:px-4 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {requestedJobsList.map(j => (
                  <div key={j.id} className="w-[calc(100vw-2rem)] sm:w-[350px] lg:w-full shrink-0 snap-center [&>div]:h-full">
                    {renderActiveJobCard(j)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COLUMNA EN CURSO */}
        <div className="w-full lg:flex-1 flex flex-col overflow-hidden">
          <button onClick={() => setIsInProgressOpen(!isInProgressOpen)} className="w-full flex justify-between items-center p-4">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-600" /> En Curso ({inProgressJobsList.length})</h3>
            {isInProgressOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {isInProgressOpen && (
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-8 pt-2 -mx-4 lg:mx-0 lg:px-4 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {inProgressJobsList.map(j => (
                <div key={j.id} className="w-[calc(100vw-2rem)] sm:w-[350px] lg:w-full shrink-0 snap-center [&>div]:h-full">
                  {renderActiveJobCard(j)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA PENDIENTES */}
        <div className="w-full lg:flex-1 flex flex-col overflow-hidden">
          <button onClick={() => setIsPendingOpen(!isPendingOpen)} className="w-full flex justify-between items-center p-4">
            <h3 className="font-extrabold text-slate-700 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Pendientes ({pendingJobsList.length})</h3>
            {isPendingOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {isPendingOpen && (
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-8 pt-2 -mx-4 lg:mx-0 lg:px-4 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {pendingJobsList.map(j => (
                <div key={j.id} className="w-[calc(100vw-2rem)] sm:w-[350px] lg:w-full shrink-0 snap-center [&>div]:h-full">
                  {renderActiveJobCard(j)}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="mt-10">
        <h3 className="font-extrabold text-slate-700 mb-4 border-b-2 pb-2">Finalizados de Hoy ({todayHistoryJobs.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">{todayHistoryJobs.map(j => renderHistoryJobCard(j))}</div>
      </div>

      {olderHistoryJobs.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Historial Anterior</h4>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">{olderHistoryJobs.length} registros</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {olderHistoryJobs.map(j => {
              const isFailed = j.status === 'failed';
              const ident = getJobIdentifier(j);
              return (
                <div key={j.id} onClick={() => setSelectedHistoryJob(j)} className="p-2 sm:p-3 hover:bg-slate-50 flex flex-col transition-colors gap-2 border-b border-slate-100 last:border-0 cursor-pointer">
                  {/* FILA ORIGINAL COMPACTA */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          {j.tripType === 'simple' ? (
                            <p className="text-xs font-black text-purple-800 truncate">{j.description || 'Servicio en Terreno'}</p>
                          ) : (
                            <p className="text-xs font-black text-slate-800 truncate">{j.brand} {j.model}</p>
                          )}
                          {j.tripType === 'simple' ? (
                            <span className="text-[9px] bg-purple-100 border border-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-black uppercase shadow-sm">SERVICIO</span>
                          ) : (
                            <LicensePlateBadge text={ident} />
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 truncate">
                          {j.origin}
                          {j.waypoints && j.waypoints.length > 0 ? ` ➔ +${j.waypoints.length} int.` : ''}
                          {j.destination && j.tripType !== 'simple' ? ` ➔ ${j.destination}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mr-1">
                        {new Date(j.completedAt || j.createdAt).toLocaleDateString('es-CL')}
                        {isAdminView && auditMode && (
                          <button onClick={(e) => { e.stopPropagation(); setEditDateJob(j); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded transition-colors" title="Corregir Fecha">
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                      {isAdminView && <button onClick={(e) => { e.stopPropagation(); onEditJob(j); }} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md transition-colors" title="Editar Traslado"><Edit2 className="w-3.5 h-3.5" /></button>}
                      {isAdminView && <button onClick={(e) => { e.stopPropagation(); handleDuplicateJob(j); }} className="p-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-md transition-colors" title="Repetir Vehículo"><Repeat className="w-3.5 h-3.5" /></button>}
                      <button onClick={(e) => { e.stopPropagation(); cpyWapp(j); }} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Copiar Resumen"><Copy className="w-3.5 h-3.5" /></button>

                      {(() => {
                        const oldHistDocHref = j.guideLink || j.guideUrl || j.docLink || j.docUrl || j.rtLink || j.rtDoc || (j.rtData && j.rtData.link) || j.pdfUrl || j.fileUrl || j.checklist?.guiaDespachoPdf || j.checklist?.guiaDespachoLink;
                        if (oldHistDocHref) {
                          return (
                            <a href={oldHistDocHref} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="p-1.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-md transition-colors" title="Ver Guía/Doc Adjunto">
                              <FileText className="w-3.5 h-3.5" />
                            </a>
                          );
                        }
                        return null;
                      })()}

                      <button onClick={(e) => { e.stopPropagation(); generatePDF(j); }} className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors" title="Descargar PDF"><FileDown className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleShareWhatsAppPDF(j); }} disabled={processingId === `${j.id}-wapp`} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50" title="Compartir PDF">
                        {processingId === `${j.id}-wapp` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                      </button>
                      {isAdminView && <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(j.id); }} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-colors" title="Eliminar Traslado"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>

                  {/* NUEVO PANEL PRT AUDITORIA */}
                  {isAdminView && auditMode && j.tripType === 'revision' && (j.status === 'completed' || j.status === 'failed') && (
                    <div className="bg-slate-100/50 border border-slate-200 rounded-lg p-2 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner ml-4">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Auditar Resultado PRT:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm("¿Cambiar a Aprobado Legal?", async () => {
                              try { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado' }, status: 'completed', failedReason: deleteField() }); showAlert("✅ Corregido a Legal"); } catch (err) { showAlert("Error al actualizar"); }
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'aprobado' || j.checklist?.rtStatus === 'aprobado' ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200'}`}>
                          Legal
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm("¿Cambiar a Aprobado con Ayuda?", async () => {
                              try { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado_ayuda', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado_ayuda' }, status: 'completed', failedReason: deleteField() }); showAlert("✅ Corregido a Con Ayuda"); } catch (err) { showAlert("Error al actualizar"); }
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'aprobado_ayuda' || j.checklist?.rtStatus === 'aprobado_ayuda' ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'}`}>
                          Ayuda
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm("¿Cambiar a Rechazado?", async () => {
                              try { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'rechazado', checklist: { ...(j.checklist || {}), rtStatus: 'rechazado' }, status: 'failed', failedReason: 'Rechazo en Planta PRT (Editado por Admin)' }); showAlert("✅ Corregido a Rechazado"); } catch (err) { showAlert("Error al actualizar"); }
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'rechazado' || j.checklist?.rtStatus === 'rechazado' ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}>
                          Rechazo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NUEVO PANEL AUDITORIA CATEGORIA VEHICULO */}
                  {isAdminView && auditMode && (j.status === 'completed' || j.status === 'failed') && j.tripType !== 'simple' && (
                    <div className="bg-slate-100/50 border border-slate-200 rounded-lg p-2 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner ml-4">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Corregir Categoría (Estadísticas):</span>
                      <select
                        value={j.checklist?.vehicleType || 'auto'}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newType = e.target.value;
                          const targetPlate = j.plate || j.vin;

                          showConfirm(`¿Actualizar la categoría en TODOS los traslados de la patente ${targetPlate}?`, async () => {
                            setProcessingId(`${j.id}-updating-cat`);
                            try {
                              // 1. Buscamos TODOS los trabajos que tengan esta misma patente o VIN
                              const q1 = query(collection(db, 'transport_jobs'), where('plate', '==', targetPlate));
                              const q2 = query(collection(db, 'transport_jobs'), where('vin', '==', targetPlate));

                              const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

                              // Unimos los resultados y evitamos duplicados (Protegido usando window.Map)
                              const allDocsToUpdate = new window.Map();
                              snap1.docs.forEach(d => allDocsToUpdate.set(d.id, d));
                              snap2.docs.forEach(d => allDocsToUpdate.set(d.id, d));

                              // 2. Actualizamos cada uno
                              let count = 0;
                              for (let [docId, documentSnap] of allDocsToUpdate) {
                                const docData = documentSnap.data();
                                // Solo si tiene checklist, actualizamos la categoría adentro
                                if (docData.checklist) {
                                  await updateDoc(doc(db, 'transport_jobs', docId), {
                                    'checklist.vehicleType': newType
                                  });
                                  count++;
                                }
                              }

                              showAlert(`✅ Categoría corregida con éxito en ${count} traslados.`);
                            } catch (err) {
                              console.error(err);
                              showAlert("Error al actualizar la categoría masivamente");
                            } finally {
                              setProcessingId(null);
                            }
                          });
                        }}
                        disabled={processingId === `${j.id}-updating-cat`}
                        className="bg-white border border-slate-200 text-slate-700 text-xs font-bold py-1 px-2 rounded-lg outline-none cursor-pointer focus:border-blue-500 shadow-sm transition-colors disabled:opacity-50"
                      >
                        <option value="auto">Autos / SUV</option>
                        <option value="camioneta">Camioneta</option>
                        <option value="furgon_pequeno">Furgón Pequeño</option>
                        <option value="furgon_grande">Furgón Grande</option>
                        <option value="camion_simple">Camión Simple</option>
                        <option value="camion_doble">Camión Doble Cabina</option>
                        <option value="camion_2ejes">Camión (2 Ejes Traseros)</option>
                        <option value="camion_3ejes">Camión (3 Ejes Traseros)</option>
                        <option value="camion_8x4">Camión 8x4</option>
                        <option value="carro_arrastre">Carro de Arrastre</option>
                      </select>
                    </div>
                  )}

                  {/* NUEVO PANEL AUDITORIA PRECIO / COBRO */}
                  {isAdminView && auditMode && (j.status === 'completed' || j.status === 'failed') && (
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner ml-4">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Corregir Ingreso ($):</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-700">${Number(j.companyPrice || 0).toLocaleString('es-CL')}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditPriceJob(j); }}
                          className="bg-white border border-emerald-200 text-emerald-700 text-[10px] font-bold py-1 px-2 rounded-lg outline-none cursor-pointer hover:bg-emerald-100 shadow-sm transition-colors"
                        >
                          Modificar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NUEVO PANEL AUDITORIA DISTANCIA (KM) */}
                  {isAdminView && auditMode && (j.status === 'completed' || j.status === 'failed') && (
                    <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-2 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner ml-4">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Auditar Distancia (KM):</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-700">{j.drivenDistance || 'No calculado'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditKmJob(j); }}
                          className="bg-white border border-emerald-200 text-emerald-700 text-[10px] font-bold py-1 px-2 rounded-lg outline-none cursor-pointer hover:bg-emerald-100 shadow-sm transition-colors flex items-center gap-1"
                          title="Editar KM Manualmente"
                        >
                          <Edit2 className="w-3 h-3" /> Modificar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSingleRecalculate(j); }}
                          disabled={processingId === `${j.id}-recalc-km`}
                          className="bg-white border border-blue-200 text-blue-700 text-[10px] font-bold py-1 px-2 rounded-lg outline-none cursor-pointer hover:bg-blue-100 shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Forzar Recálculo de Ruta"
                        >
                          {processingId === `${j.id}-recalc-km` ? <Clock className="w-3 h-3 animate-spin" /> : <MapIcon className="w-3 h-3" />}
                          Recalcular
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {onLoadMore && (
            <button onClick={onLoadMore} className="w-full bg-slate-50 hover:bg-slate-100 text-blue-600 font-bold text-sm py-4 transition-colors border-t border-slate-200 shadow-inner">
              Cargar más traslados antiguos...
            </button>
          )}
        </div>
      )}

      {/* MODALES */}
      {jobToFail && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleFailJob(jobToFail, e.target.reason.value); }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-extrabold">¿Motivo del fallo?</h3>
            <textarea name="reason" required autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 p-3 rounded-xl font-bold text-sm" rows="3"></textarea>
            <div className="flex gap-3"><button type="button" onClick={() => setJobToFail(null)} className="flex-1 py-2 bg-slate-100 rounded-xl">Volver</button><button type="submit" className="flex-[2] py-2 bg-red-600 text-white rounded-xl">Confirmar</button></div>
          </form>
        </div>
      )}

      {prtPromptJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (prtReturnOpt === 'other' && !prtReturnDest.trim()) return showAlert("Debes ingresar el nuevo destino para continuar.");

            let finalReturnOpt = prtReturnOpt;
            let finalReturnDest = prtReturnDest;

            // Magia: Si eligen ayuda, lo catalogamos como 'otro destino' forzado para que el sistema no se rompa
            if (prtReturnOpt === 'prt_help') {
              finalReturnOpt = 'other';
              finalReturnDest = 'PRT (Reintento con Ayuda)';
            }

            const reasonText = e.target.reason.value;
            const mergedChecklist = {
              ...(prtPromptJob.checklist || {}),
              rtStatus: 'rechazado',
              rtRejectReason: reasonText,
              rtReturnOption: finalReturnOpt,
              rtReturnDestination: finalReturnOpt === 'other' ? finalReturnDest : ''
            };

            const extraUpdates = {
              prt_result: 'rechazado',
              prt_reason: reasonText,
              checklist: mergedChecklist
            };

            // Sincroniza hacia el interior del borrador si existe, para que el formulario no despierte mareado
            if (prtPromptJob.draft?.formData) {
              extraUpdates['draft.formData.rtStatus'] = 'rechazado';
              extraUpdates['draft.formData.rtRejectReason'] = reasonText;
              extraUpdates['draft.formData.rtReturnOption'] = finalReturnOpt;
              extraUpdates['draft.formData.rtReturnDestination'] = finalReturnOpt === 'other' ? finalReturnDest : '';
            }

            updatePhase(prtPromptJob, 'prt_done', extraUpdates);
            setPrtPromptJob(null);
          }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border-t-8 border-red-500 animate-in zoom-in-95 flex flex-col max-h-[90vh]">

            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5"><XCircle className="text-red-500 w-5 h-5" /> Rechazo PRT</h3>
              <button type="button" onClick={() => setPrtPromptJob(null)} className="p-1.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
            </div>

            <div className="overflow-y-auto space-y-5 pr-1 pb-2">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">1. Motivo del Rechazo</label>
                <textarea name="reason" required placeholder="Escribe por qué rechazaron el vehículo..." autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none focus:border-red-500" rows="2"></textarea>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">2. ¿Hacia dónde se dirige ahora?</label>

                <button type="button" onClick={() => { setPrtReturnOpt('origin'); setPrtReturnDest(''); }} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${prtReturnOpt === 'origin' ? 'border-red-500 bg-red-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-red-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${prtReturnOpt === 'origin' ? 'border-red-500' : 'border-slate-300'}`}>
                    {prtReturnOpt === 'origin' && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-extrabold text-sm ${prtReturnOpt === 'origin' ? 'text-red-800' : 'text-slate-700'}`}>Retornar al Origen</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">Volver a {prtPromptJob.origin}</p>
                  </div>
                </button>

                <button type="button" onClick={() => { setPrtReturnOpt('prt_help'); setPrtReturnDest(''); }} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${prtReturnOpt === 'prt_help' ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-amber-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${prtReturnOpt === 'prt_help' ? 'border-amber-500' : 'border-slate-300'}`}>
                    {prtReturnOpt === 'prt_help' && <div className="w-2 h-2 bg-amber-500 rounded-full"></div>}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-extrabold text-sm ${prtReturnOpt === 'prt_help' ? 'text-amber-800' : 'text-slate-700'}`}>Reintentar con Ayuda</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">Se queda gestionando ayuda</p>
                  </div>
                </button>

                <button type="button" onClick={() => setPrtReturnOpt('other')} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${prtReturnOpt === 'other' ? 'border-red-500 bg-red-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-red-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${prtReturnOpt === 'other' ? 'border-red-500' : 'border-slate-300'}`}>
                    {prtReturnOpt === 'other' && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                  </div>
                  <div className="w-full min-w-0">
                    <p className={`font-extrabold text-sm ${prtReturnOpt === 'other' ? 'text-red-800' : 'text-slate-700'}`}>Ir a Otro Destino</p>
                    {prtReturnOpt === 'other' ? (
                      <div className="mt-2 w-full animate-in fade-in slide-in-from-top-1">
                        <input type="text" list="directory-destinations-prt-rej" autoFocus required placeholder="Escribe el destino..." value={prtReturnDest} onChange={e => setPrtReturnDest(e.target.value.toUpperCase())} autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full bg-white border border-red-300 p-2.5 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-500 font-bold" onClick={(e) => e.stopPropagation()} />

                        <datalist id="directory-destinations-prt-rej">
                          {directoryMemory.map((dir, idx) => (
                            <option key={`dir-prt-rej-${idx}`} value={dir.name || dir.address} />
                          ))}
                          {allClientsList && allClientsList.map((client, idx) => (
                            <option key={`cli-prt-rej-${idx}`} value={client} />
                          ))}
                        </datalist>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-500 truncate">Elige un nuevo lugar</p>
                    )}
                  </div>
                </button>
              </div>
            </div>

            <button type="submit" disabled={processingId === `${prtPromptJob.id}-prt_done`} className="w-full shrink-0 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm shadow-md transition-colors mt-2 flex justify-center items-center gap-2 disabled:opacity-50">
              Confirmar Rechazo y Continuar
            </button>
          </form>
        </div>
      )}

      {/* NUEVO: POP-UP DE TIPO DE APROBACIÓN PRT CON DESTINO */}
      {prtApprovePromptJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (prtReturnOpt === 'other' && !prtReturnDest.trim()) return showAlert("Debes ingresar el nuevo destino para continuar.");

            const mergedChecklist = {
              ...(prtApprovePromptJob.checklist || {}),
              rtStatus: prtApproveType,
              rtReturnOption: prtReturnOpt,
              rtReturnDestination: prtReturnOpt === 'other' ? prtReturnDest : ''
            };

            const extraUpdates = {
              prt_result: prtApproveType,
              checklist: mergedChecklist
            };

            // Sincroniza hacia el interior del borrador si existe
            if (prtApprovePromptJob.draft?.formData) {
              extraUpdates['draft.formData.rtStatus'] = prtApproveType;
              extraUpdates['draft.formData.rtReturnOption'] = prtReturnOpt;
              extraUpdates['draft.formData.rtReturnDestination'] = prtReturnOpt === 'other' ? prtReturnDest : '';
            }

            updatePhase(prtApprovePromptJob, 'prt_done', extraUpdates);
            setPrtApprovePromptJob(null);
          }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border-t-8 border-green-500 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5"><CheckCircle className="text-green-500 w-5 h-5" /> Aprobación PRT</h3>
              <button type="button" onClick={() => setPrtApprovePromptJob(null)} className="p-1.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
            </div>

            <div className="overflow-y-auto space-y-5 pr-1 pb-2">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">1. Tipo de Aprobación</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPrtApproveType('aprobado')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all border-2 ${prtApproveType === 'aprobado' ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}>✅ Legal</button>
                  <button type="button" onClick={() => setPrtApproveType('aprobado_ayuda')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all border-2 ${prtApproveType === 'aprobado_ayuda' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}>🤝 Con Ayuda</button>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">2. ¿Hacia dónde se dirige ahora?</label>
                <button type="button" onClick={() => { setPrtReturnOpt('origin'); setPrtReturnDest(''); }} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${prtReturnOpt === 'origin' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-green-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${prtReturnOpt === 'origin' ? 'border-green-500' : 'border-slate-300'}`}>
                    {prtReturnOpt === 'origin' && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-extrabold text-sm ${prtReturnOpt === 'origin' ? 'text-green-800' : 'text-slate-700'}`}>Retornar al Origen</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">Volver a {prtApprovePromptJob.origin}</p>
                  </div>
                </button>

                <button type="button" onClick={() => setPrtReturnOpt('other')} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${prtReturnOpt === 'other' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-green-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${prtReturnOpt === 'other' ? 'border-green-500' : 'border-slate-300'}`}>
                    {prtReturnOpt === 'other' && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                  </div>
                  <div className="w-full min-w-0">
                    <p className={`font-extrabold text-sm ${prtReturnOpt === 'other' ? 'text-green-800' : 'text-slate-700'}`}>Ir a Otro Destino</p>
                    {prtReturnOpt === 'other' ? (
                      <div className="mt-2 w-full animate-in fade-in slide-in-from-top-1">
                        <input type="text" list="directory-destinations-prt" autoFocus required placeholder="Escribe el destino..." value={prtReturnDest} onChange={e => setPrtReturnDest(e.target.value.toUpperCase())} autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full bg-white border border-green-300 p-2.5 rounded-lg text-xs outline-none focus:ring-2 focus:ring-green-500 font-bold" onClick={(e) => e.stopPropagation()} />


                        <datalist id="directory-destinations-prt">
                          {directoryMemory.map((dir, idx) => (
                            <option key={`dir-prt-${idx}`} value={dir.name || dir.address} />
                          ))}
                          {allClientsList && allClientsList.map((client, idx) => (
                            <option key={`cli-prt-${idx}`} value={client} />
                          ))}
                        </datalist>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-500 truncate">Elige un nuevo lugar</p>
                    )}
                  </div>
                </button>
              </div>
            </div>

            <button type="submit" disabled={processingId === `${prtApprovePromptJob.id}-prt_done`} className="w-full shrink-0 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm shadow-md transition-colors mt-2 flex justify-center items-center gap-2 disabled:opacity-50">
              Confirmar y Continuar
            </button>
          </form>
        </div>
      )}

      {relayPromptJob && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 border border-slate-100">
            <button type="button" onClick={() => setRelayPromptJob(null)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-700" /></button>
            <h3 className="text-xl font-black text-slate-800 mb-1">Traspaso a Compañero</h3>
            <p className="text-xs font-bold text-slate-500 mb-5">Pide al otro conductor que escanee este código con la cámara de su celular para entregarle el auto.</p>

            <div className="bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-inner inline-block">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/?relay=${relayPromptJob.id}`)}`} alt="QR Relevo" className="w-48 h-48 mx-auto" />
            </div>

            <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">O envíale el link por WhatsApp:</p>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`🔑 Toma mi relevo del vehículo ${relayPromptJob.plate || relayPromptJob.vin} abriendo este link: ${window.location.origin}/?relay=${relayPromptJob.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-sm shadow-md transition-colors flex justify-center items-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Enviar Link a Compañero
              </a>
            </div>
          </div>
        </div>
      )}

      {forceCloseJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col max-h-[80vh] animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-500" /> Asignar y Finalizar</h3>
              <button onClick={() => setForceCloseJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-4 pb-4 border-b border-slate-100">Selecciona al conductor que realizó este traslado. El acta se cerrará automáticamente a su nombre (como entrega sin recepción).</p>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {drivers.map(d => (
                <button key={d.id} onClick={async () => {
                  showConfirm(`¿Guardar el traslado de la patente ${forceCloseJob.plate || forceCloseJob.vin} a nombre de ${d.name}?`, async () => {
                    try {
                      // NUEVO: Rescatar el borrador o checklist existente para no perder fotos ni info
                      const existingData = forceCloseJob.draft?.formData || forceCloseJob.checklist || {};

                      const mergedChecklist = {
                        ...existingData, // <-- Mantiene fotos, firmas previas, equipamiento, etc.
                        client: forceCloseJob.client || '',
                        brand: forceCloseJob.brand || '',
                        model: forceCloseJob.model || '',
                        plateOrVin: forceCloseJob.plate || forceCloseJob.vin || forceCloseJob.associatedPlate || '',
                        origin: forceCloseJob.origin || '',
                        destination: forceCloseJob.destination || '',
                        fuelLevel: existingData.fuelLevel || 50,
                        photos: existingData.photos || {},
                        docs: existingData.docs || {},
                        observations: existingData.observations || 'Cierre forzado por administrador.',
                        receiverName: existingData.receiverName || 'ENTREGA FORZADA (SIN RECEPCIÓN)',
                        receiverRut: existingData.receiverRut || 'N/A',
                        noReception: existingData.noReception !== undefined ? existingData.noReception : true,
                        signatureData: existingData.signatureData || null,
                        assignedDriverName: d.name
                      };

                      await updateDoc(doc(db, 'transport_jobs', forceCloseJob.id), {
                        status: 'completed',
                        completedAt: Date.now(),
                        acceptedByEmail: d.email,
                        assignedDrivers: [{ id: d.id, name: d.name, email: d.email }],
                        assignedEmails: [d.email],
                        checklist: mergedChecklist,
                        draft: deleteField(), // <-- Limpia el borrador al cerrar
                        phase: forceCloseJob.tripType === 'revision' ? 'prt_done' : 'arrived_destination',
                        prt_result: forceCloseJob.tripType === 'revision' ? (forceCloseJob.prt_result || 'aprobado') : null
                      });
                      notifyClient({ ...forceCloseJob, acceptedByEmail: d.email, assignedDriverName: d.name }, 'finalizado');
                      setForceCloseJob(null);
                      showAlert(`✅ Traslado cerrado exitosamente a nombre de ${d.name}.`);
                    } catch (e) { console.error(e); showAlert("Error al forzar el cierre."); }
                  });
                }} className="w-full text-left p-3 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-100 rounded-xl transition-colors">
                  <p className="font-extrabold text-slate-800">{d.name}</p>
                  <p className="text-[10px] font-bold text-slate-400">{d.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NUEVO MENÚ CENTRAL DE FLOTAS */}
      {showFleetMenu && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl flex flex-col animate-in zoom-in-95 border-t-8 border-indigo-500 relative">
            <button onClick={() => setShowFleetMenu(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-700" /></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-100 p-2.5 rounded-full"><Truck className="w-6 h-6 text-indigo-600" /></div>
              <h3 className="text-xl font-black text-slate-800 leading-tight">Gestión de<br />Flotas</h3>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setShowFleetMenu(false); setFleetSelectedIds([]); setShowFleetModal(true); }} className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold py-3.5 rounded-xl transition-colors flex items-center gap-3 px-4 shadow-sm">
                <Plus className="w-5 h-5" /> Crear Nueva Flota
              </button>
              <button onClick={() => { setShowFleetMenu(false); setShowActiveFleetsModal(true); }} className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold py-3.5 rounded-xl transition-colors flex items-center gap-3 px-4 shadow-sm">
                <Edit2 className="w-5 h-5 text-indigo-500" /> Modificar Flotas
              </button>
              <button onClick={() => { setShowFleetMenu(false); setShowActiveFleetsModal(true); }} className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold py-3.5 rounded-xl transition-colors flex items-center gap-3 px-4 shadow-sm">
                <Navigation className="w-5 h-5 text-indigo-500" /> Flotas Activas
              </button>
            </div>
          </div>
        </div>
      )}

      {showFleetModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] border-t-8 border-indigo-500 animate-in zoom-in-95">
            <div className="flex justify-between mb-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-600" /> Agrupar Flota</h3>
              <button onClick={() => setShowFleetModal(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto space-y-4 flex-1">
              <p className="text-xs font-bold text-slate-500">Selecciona los traslados activos que viajarán juntos en convoy. Esto habilitará la firma masiva para todos los conductores de este grupo.</p>
              <div className="bg-slate-50 border p-3 rounded-xl">
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {activeJobs.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 text-center">No hay vehículos activos.</p>
                  ) : (
                    activeJobs.map(j => (
                      <label key={j.id} className="flex items-center gap-3 p-3 border rounded-xl bg-white cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={fleetSelectedIds.includes(j.id)} onChange={e => e.target.checked ? setFleetSelectedIds([...fleetSelectedIds, j.id]) : setFleetSelectedIds(fleetSelectedIds.filter(id => id !== j.id))} />
                        <div className="text-xs font-black text-slate-700 flex-1 min-w-0">
                          <div className="truncate">{getJobIdentifier(j)} - {j.tripType === 'simple' ? j.description : `${j.brand} ${j.model}`}</div>
                          {j.fleetGroup && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded uppercase mt-1 inline-block">Ya en Flota</span>}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <button onClick={handleCreateFleet} disabled={processingId === 'create-fleet'} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-black mt-4 shadow-md transition-colors disabled:opacity-50">
              {processingId === 'create-fleet' ? 'Creando...' : 'Crear Grupo de Flota'}
            </button>
          </div>
        </div>
      )}

      {/* NUEVO MODAL: GESTIÓN DE FLOTAS ACTIVAS */}
      {showActiveFleetsModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] border-t-8 border-indigo-500 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Navigation className="w-5 h-5 text-indigo-600" /> Flotas Activas</h3>
              <button onClick={() => setShowActiveFleetsModal(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-700" /></button>
            </div>
            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              <p className="text-xs font-bold text-slate-500 mb-2">Aquí puedes ver los convoyes en ruta, quitar un vehículo específico o disolver flotas enteras.</p>
              {Object.keys(activeJobs.reduce((acc, j) => { if (j.fleetGroup) acc[j.fleetGroup] = true; return acc; }, {})).length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center flex flex-col items-center">
                  <Truck className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-extrabold text-slate-500">No hay ninguna flota activa en este momento.</p>
                </div>
              ) : (
                Object.entries(activeJobs.reduce((acc, job) => {
                  if (job.fleetGroup) {
                    if (!acc[job.fleetGroup]) acc[job.fleetGroup] = [];
                    acc[job.fleetGroup].push(job);
                  }
                  return acc;
                }, {})).map(([fleetId, fleetJobs]) => (
                  <div key={fleetId} className="bg-white border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-sm mb-3">
                    <div className="bg-indigo-50 p-3 flex justify-between items-center border-b border-indigo-100">
                      <p className="font-black text-indigo-800 text-sm flex items-center gap-2">
                        <Truck className="w-4 h-4" /> Convoy: <span className="font-bold text-indigo-500 text-xs">{fleetId.replace('FLT-', '')}</span>
                      </p>
                      <span className="bg-indigo-200 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-lg">{fleetJobs.length} veh.</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {fleetJobs.map(j => (
                        <div key={j.id} className="flex justify-between items-center bg-slate-50 hover:bg-white p-2.5 rounded-xl border border-slate-100 transition-colors">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0"></div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-700 text-xs truncate flex items-center gap-1.5">
                                {getJobIdentifier(j)}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 truncate uppercase tracking-wide">
                                {j.tripType === 'simple' ? j.description : `${j.brand} ${j.model}`}
                              </p>
                            </div>
                          </div>
                          <button onClick={() => {
                            showConfirm(`¿Quitar la patente ${getJobIdentifier(j)} de este convoy?`, async () => {
                              try { await updateDoc(doc(db, 'transport_jobs', j.id), { fleetGroup: deleteField() }); showAlert("✅ Vehículo removido del convoy."); } catch (e) { showAlert("❌ Error al desagrupar."); }
                            });
                          }} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors shrink-0" title="Quitar de la flota">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 bg-slate-50 border-t border-slate-100">
                      <button onClick={() => {
                        showConfirm("⚠️ ¿Estás seguro de desarmar y disolver este convoy completo? Los vehículos volverán a ser individuales.", async () => {
                          setProcessingId(`disband-${fleetId}`);
                          try {
                            for (const j of fleetJobs) { await updateDoc(doc(db, 'transport_jobs', j.id), { fleetGroup: deleteField() }); }
                            showAlert("✅ Convoy desarmado completamente.");
                          } catch (e) { showAlert("❌ Error al desarmar flota."); } finally { setProcessingId(null); }
                        });
                      }} disabled={processingId === `disband-${fleetId}`} className="w-full text-center text-[11px] font-black text-red-500 hover:text-red-700 hover:bg-red-100 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {processingId === `disband-${fleetId}` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Disolver Convoy
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {dupPromptJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 border-t-8 border-purple-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Repeat className="w-5 h-5 text-purple-600" /> Nuevo Traslado</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  {dupPromptJob.tripType === 'simple' ? dupPromptJob.description : `${dupPromptJob.brand} ${dupPromptJob.model}`} • {getJobIdentifier(dupPromptJob)}
                </p>
              </div>
              <button onClick={() => setDupPromptJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto space-y-5 pr-1 pb-4">

              {/* OPCIONES DE RUTA */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">¿Qué tipo de ruta hará ahora?</label>

                <button onClick={() => setDupMode('clone')} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${dupMode === 'clone' ? 'border-purple-600 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-purple-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dupMode === 'clone' ? 'border-purple-600' : 'border-slate-300'}`}>
                    {dupMode === 'clone' && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                  </div>
                  <div>
                    <p className={`font-extrabold text-sm ${dupMode === 'clone' ? 'text-purple-800' : 'text-slate-700'}`}>Clonar Exactamente Igual</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">{dupPromptJob.origin} ➔ {dupPromptJob.destination || 'Mismo destino'}</p>
                  </div>
                </button>

                <button onClick={() => setDupMode('return')} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${dupMode === 'return' ? 'border-purple-600 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-purple-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dupMode === 'return' ? 'border-purple-600' : 'border-slate-300'}`}>
                    {dupMode === 'return' && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                  </div>
                  <div>
                    <p className={`font-extrabold text-sm ${dupMode === 'return' ? 'text-purple-800' : 'text-slate-700'}`}>Retornar al Origen</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">{dupPromptJob.tripType === 'revision' ? 'PRT' : (dupPromptJob.destination || dupPromptJob.origin)} ➔ {dupPromptJob.origin}</p>
                  </div>
                </button>

                <button onClick={() => { setDupMode('continue'); setDupDestination(''); }} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${dupMode === 'continue' ? 'border-purple-600 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-purple-200'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dupMode === 'continue' ? 'border-purple-600' : 'border-slate-300'}`}>
                    {dupMode === 'continue' && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                  </div>
                  <div className="w-full overflow-hidden">
                    <p className={`font-extrabold text-sm ${dupMode === 'continue' ? 'text-purple-800' : 'text-slate-700'}`}>Continuar a Otro Destino</p>
                    {dupMode === 'continue' ? (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-1 w-full">
                        <input type="text" list="directory-destinations" autoFocus placeholder="Escribe el nuevo destino..." value={dupDestination} onChange={e => setDupDestination(e.target.value.toUpperCase())} autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full bg-white border border-purple-200 p-2.5 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-400 font-bold" />
                        <datalist id="directory-destinations">
                          {directoryMemory.map((dir, idx) => (
                            <option key={`dir-${idx}`} value={dir.name || dir.address} />
                          ))}
                          {/* También incluimos los nombres de clientes como destinos sugeridos para mayor rapidez */}
                          {allClientsList && allClientsList.map((client, idx) => (
                            <option key={`cli-${idx}`} value={client} />
                          ))}
                        </datalist>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-500 truncate">{dupPromptJob.tripType === 'revision' ? 'PRT' : (dupPromptJob.destination || dupPromptJob.origin)} ➔ ???</p>
                    )}
                  </div>
                </button>
              </div>

              {/* ASIGNACIÓN DE CONDUCTORES (MÚLTIPLE) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Asignar a Conductores</label>
                <div className="bg-slate-50 border-2 border-slate-100 rounded-xl overflow-hidden">
                  <div className="max-h-40 overflow-y-auto p-1.5 space-y-1 scrollbar-none">

                    <div onClick={() => setDupDriverEmails([])} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${dupDriverEmails.length === 0 ? 'border-purple-500 bg-purple-50' : 'border-transparent hover:bg-slate-100'}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${dupDriverEmails.length === 0 ? 'border-purple-600 bg-purple-600' : 'border-slate-300 bg-white'}`}>
                        {dupDriverEmails.length === 0 && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-xs font-black ${dupDriverEmails.length === 0 ? 'text-purple-800' : 'text-slate-600'}`}>Nadie aún (Bolsa de Trabajo)</span>
                    </div>

                    {drivers.filter(d => !d.isHidden).map(d => {
                      const isSelected = dupDriverEmails.includes(d.email);
                      return (
                        <div key={d.id} onClick={() => {
                          if (isSelected) {
                            setDupDriverEmails(dupDriverEmails.filter(email => email !== d.email));
                          } else {
                            setDupDriverEmails([...dupDriverEmails, d.email]);
                          }
                        }} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-transparent hover:bg-slate-100'}`}>
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-slate-300 bg-white'}`}>
                            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`text-xs font-black ${isSelected ? 'text-purple-800' : 'text-slate-700'}`}>{d.name}</span>
                        </div>
                      );
                    })}

                  </div>
                </div>
              </div>

            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100 mt-auto">
              <button onClick={() => setDupPromptJob(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-extrabold text-sm transition-colors">Cancelar</button>
              <button onClick={executeDuplicate} disabled={processingId === `dup-${dupPromptJob.id}`} className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-xl font-extrabold text-sm transition-colors shadow-lg shadow-purple-200 flex justify-center items-center gap-2 disabled:opacity-50">
                {processingId === `dup-${dupPromptJob.id}` ? <Clock className="w-5 h-5 animate-spin" /> : 'Crear Traslado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO MODAL: EDITAR FECHA DEL TRASLADO */}
      {editDateJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const dateVal = e.target.newDate.value;
            if (!dateVal) return showAlert("Selecciona una fecha válida");

            // Creamos un timestamp a las 12:00 del día seleccionado para evitar problemas de zona horaria
            const [y, m, d] = dateVal.split('-');
            const newDateObj = new Date(y, m - 1, d, 12, 0, 0);
            const newTimestamp = newDateObj.getTime();

            setProcessingId(`${editDateJob.id}-date`);
            try {
              await updateDoc(doc(db, 'transport_jobs', editDateJob.id), {
                completedAt: newTimestamp,
                scheduledDate: dateVal // Mantenemos coherencia
              });
              showAlert("✅ Fecha actualizada correctamente.");
              setEditDateJob(null);
            } catch (err) {
              console.error(err);
              showAlert("❌ Error al actualizar la fecha.");
            } finally {
              setProcessingId(null);
            }
          }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl border-t-8 border-blue-500 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" /> Corregir Fecha
              </h3>
              <button type="button" onClick={() => setEditDateJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trabajo a editar</p>
              <p className="text-sm font-bold text-slate-700 truncate">
                {editDateJob.tripType === 'simple' ? editDateJob.description : `${editDateJob.brand} ${editDateJob.model}`}
              </p>
              <p className="text-xs font-bold text-slate-500">{getJobIdentifier(editDateJob)}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Fecha Real de Término</label>
              <input name="newDate" type="date" defaultValue={new Date(editDateJob.completedAt || editDateJob.createdAt).toISOString().split('T')[0]} required className="w-full border-2 border-blue-200 bg-blue-50 p-3.5 rounded-xl font-black text-lg text-blue-900 outline-none focus:border-blue-500 mt-1 shadow-sm" />
            </div>
            <button type="submit" disabled={processingId === `${editDateJob.id}-date`} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {processingId === `${editDateJob.id}-date` ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {processingId === `${editDateJob.id}-date` ? 'Guardando...' : 'Actualizar Fecha'}
            </button>
          </form>
        </div>
      )}

      {/* NUEVO MODAL: EDITAR COBRO DEL TRASLADO */}
      {editPriceJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const newPrice = Number(e.target.price.value) || 0;
            setProcessingId(`${editPriceJob.id}-price`);
            try {
              await updateDoc(doc(db, 'transport_jobs', editPriceJob.id), { companyPrice: newPrice });
              showAlert("✅ Ingreso actualizado correctamente.");
              setEditPriceJob(null);
            } catch (err) {
              console.error(err);
              showAlert("❌ Error al actualizar el cobro.");
            } finally {
              setProcessingId(null);
            }
          }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl border-t-8 border-emerald-500 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" /> Editar Cobro
              </h3>
              <button type="button" onClick={() => setEditPriceJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trabajo a editar</p>
              <p className="text-sm font-bold text-slate-700 truncate">
                {editPriceJob.tripType === 'simple' ? editPriceJob.description : `${editPriceJob.brand} ${editPriceJob.model}`}
              </p>
              <p className="text-xs font-bold text-slate-500">{getJobIdentifier(editPriceJob)}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Nuevo Valor del Servicio ($)</label>
              <input name="price" type="number" defaultValue={editPriceJob.companyPrice || 0} required autoFocus className="w-full border-2 border-emerald-200 bg-emerald-50 p-3.5 rounded-xl font-black text-xl text-emerald-900 outline-none focus:border-emerald-500 mt-1 shadow-sm" />
            </div>
            <button type="submit" disabled={processingId === `${editPriceJob.id}-price`} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {processingId === `${editPriceJob.id}-price` ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {processingId === `${editPriceJob.id}-price` ? 'Guardando...' : 'Guardar Nuevo Valor'}
            </button>
          </form>
        </div>
      )}

      {/* NUEVO MODAL: EDITAR KILOMETRAJE DEL TRASLADO */}
      {editKmJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <form onSubmit={async (e) => {
            e.preventDefault();
            let rawValue = e.target.kmValue.value.trim();
            if (!rawValue) return showAlert("Ingresa un valor válido.");

            // Reemplazamos la coma por punto para formatear a número y luego reconstruimos el string
            rawValue = rawValue.replace(',', '.');
            const numValue = parseFloat(rawValue);

            if (isNaN(numValue)) return showAlert("El valor debe ser numérico.");

            const finalKmStr = numValue.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';

            setProcessingId(`${editKmJob.id}-km`);
            try {
              await updateDoc(doc(db, 'transport_jobs', editKmJob.id), { drivenDistance: finalKmStr });
              showAlert("✅ Kilometraje actualizado manualmente.");
              setEditKmJob(null);
            } catch (err) {
              console.error(err);
              showAlert("❌ Error al actualizar el kilometraje.");
            } finally {
              setProcessingId(null);
            }
          }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl border-t-8 border-emerald-500 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <MapIcon className="w-6 h-6 text-emerald-600" /> Editar Distancia
              </h3>
              <button type="button" onClick={() => setEditKmJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trabajo a editar</p>
              <p className="text-sm font-bold text-slate-700 truncate">
                {editKmJob.tripType === 'simple' ? editKmJob.description : `${editKmJob.brand} ${editKmJob.model}`}
              </p>
              <p className="text-xs font-bold text-slate-500">{getJobIdentifier(editKmJob)}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Distancia Total (KM)</label>
              <div className="relative mt-1">
                <input name="kmValue" type="text" inputMode="decimal" defaultValue={editKmJob.drivenDistance ? editKmJob.drivenDistance.replace(/[^\d.,]/g, '') : ''} required autoFocus autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-emerald-200 bg-emerald-50 p-3.5 pr-12 rounded-xl font-black text-xl text-emerald-900 outline-none focus:border-emerald-500 shadow-sm" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600/50">km</span>
              </div>
            </div>
            <button type="submit" disabled={processingId === `${editKmJob.id}-km`} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {processingId === `${editKmJob.id}-km` ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {processingId === `${editKmJob.id}-km` ? 'Guardando...' : 'Guardar Kilometraje'}
            </button>
          </form>
        </div>
      )}

      {showBulkSign && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] border-t-8 border-emerald-500">
            <div className="flex justify-between mb-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><PenTool className="w-5 h-5 text-emerald-600" /> Firma Masiva</h3>
              <button onClick={() => setShowBulkSign(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto space-y-4 flex-1">
              <div className="bg-slate-50 border p-3 rounded-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Selecciona los vehículos a entregar:</p>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {inProgressJobsList.filter(j => j.fleetGroup).length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 text-center">No perteneces a ninguna flota activa.</p>
                  ) : (
                    inProgressJobsList.filter(j => j.fleetGroup).map(j => (
                      <label key={j.id} className="flex items-center gap-3 p-3 border rounded-xl bg-white cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" className="w-4 h-4 accent-emerald-600" checked={bulkSelectedIds.includes(j.id)} onChange={e => e.target.checked ? setBulkSelectedIds([...bulkSelectedIds, j.id]) : setBulkSelectedIds(bulkSelectedIds.filter(id => id !== j.id))} />
                        <div className="text-xs font-black text-slate-700">
                          {getJobIdentifier(j)} - {j.tripType === 'simple' ? j.description : `${j.brand} ${j.model}`}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <input type="text" placeholder="Nombre del Receptor" value={bulkReceiverName} onChange={e => setBulkReceiverName(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-emerald-500" />
              <input type="text" placeholder="RUT Receptor" maxLength="12" value={bulkReceiverRut} onChange={(e) => { let val = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase(); if (val.length > 1) { const dv = val.slice(-1); const body = val.slice(0, -1); val = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv; } setBulkReceiverRut(val); }} autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-emerald-500" />
              <div className="border-2 rounded-xl overflow-hidden">
                <SignaturePad onSave={d => setBulkSignature(d)} onClear={() => setBulkSignature(null)} />
              </div>
            </div>
            <button onClick={handleBulkSignSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black mt-4 shadow-md transition-colors">Finalizar Flota</button>
          </div>
        </div>
      )}

      <BulkReplaceModal
        showReplaceModal={showReplaceModal}
        setShowReplaceModal={setShowReplaceModal}
        replaceField={replaceField}
        setReplaceField={setReplaceField}
        replaceSearchTerm={replaceSearchTerm}
        setReplaceSearchTerm={setReplaceSearchTerm}
        replaceNewTerm={replaceNewTerm}
        setReplaceNewTerm={setReplaceNewTerm}
        executeBulkReplace={executeBulkReplace}
        processingId={processingId}
      />

      <GuideUploadModal
        guideUploadJob={guideUploadJob}
        setGuideUploadJob={setGuideUploadJob}
        guideLink={guideLink}
        setGuideLink={setGuideLink}
        guideFileBase64={guideFileBase64}
        setGuideFileBase64={setGuideFileBase64}
        processingId={processingId}
        setProcessingId={setProcessingId}
        showAlert={showAlert}
        notifyClient={notifyClient}
        db={db}
      />

      <FullScreenPhotoModal
        fullScreenPhoto={fullScreenPhoto}
        setFullScreenPhoto={setFullScreenPhoto}
      />

      <HistoryModal
        selectedHistoryJob={selectedHistoryJob}
        setSelectedHistoryJob={setSelectedHistoryJob}
        getJobIdentifier={getJobIdentifier}
        getRouteStr={getRouteStr}
        vehicles={vehicles}
        drivers={drivers}
        setFullScreenPhoto={setFullScreenPhoto}
      />

      {/* NUEVO MODAL: PANEL DE SEGUIMIENTO EN VIVO */}
      <TrackingModal
        jobs={jobs}
        trackingJobId={trackingJobId}
        setTrackingJobId={setTrackingJobId}
        getJobIdentifier={getJobIdentifier}
        updatePhase={updatePhase}
        processingId={processingId}
        setArrivalPromptJob={setArrivalPromptJob}
        setArrivalMileage={setArrivalMileage}
        setArrivalPhoto={setArrivalPhoto}
        setArrivalKeyLocation={setArrivalKeyLocation}
        setArrivalKeyHandedTo={setArrivalKeyHandedTo}
        onStartChecklist={onStartChecklist}
        setPrtApproveType={setPrtApproveType}
        setPrtReturnOpt={setPrtReturnOpt}
        setPrtReturnDest={setPrtReturnDest}
        setPrtApprovePromptJob={setPrtApprovePromptJob}
        setPrtPromptJob={setPrtPromptJob}
      />

      {/* NUEVO MODAL: REQUISITO LLEGADA (GENERAL / GRANDLEASING) */}
      <ArrivalModal
        arrivalPromptJob={arrivalPromptJob}
        setArrivalPromptJob={setArrivalPromptJob}
        arrivalMileage={arrivalMileage}
        setArrivalMileage={setArrivalMileage}
        arrivalKeyLocation={arrivalKeyLocation}
        setArrivalKeyLocation={setArrivalKeyLocation}
        arrivalKeyHandedTo={arrivalKeyHandedTo}
        setArrivalKeyHandedTo={setArrivalKeyHandedTo}
        processingId={processingId}
        submitArrival={submitArrival}
      />

      {/* --- CÁMARA INTERNA NATIVA --- */}
      <InAppCamera
        isOpen={cameraConfig.isOpen}
        title={cameraConfig.title}
        onClose={() => setCameraConfig({ isOpen: false, title: '', target: null })}
        onCapture={async (file) => {
          if (cameraConfig.target === 'arrivalPhoto') {
            try {
              const compressed = await resizeImage(file, 1200, 0.6);
              setArrivalPhoto(compressed);
            } catch (e) { showAlert("Error procesando foto."); }
          }
        }}
      />

      {/* --- MODAL KOVACS DATE PICKER --- */}
      <KovacsModal
        showKovacsModal={showKovacsModal}
        setShowKovacsModal={setShowKovacsModal}
        kovacsStartDate={kovacsStartDate}
        setKovacsStartDate={setKovacsStartDate}
        kovacsEndDate={kovacsEndDate}
        setKovacsEndDate={setKovacsEndDate}
        handleKovacsZIP={handleKovacsZIP}
      />

    </div>
  );
}
















