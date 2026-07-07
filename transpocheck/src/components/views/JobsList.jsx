import React, { useState, useEffect } from 'react';
import { updateDoc, doc, deleteDoc, addDoc, collection, deleteField, getDocs, query, where } from 'firebase/firestore';
import { 
  Edit2, MoreVertical, Navigation, Share2, Users, CheckCircle, 
  Copy, X, XCircle, MapPin, Clock, FileDown, Search, ChevronUp, ChevronDown,
  Trash2, Car, Repeat, AlertCircle, PenTool
} from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';
import WaitTimerBadge from '../ui/WaitTimerBadge';
import SwipeButton from '../ui/SwipeButton';
import SignaturePad from '../ui/SignaturePad';
import { formatDateDisplay } from '../../utils/helpers';

export default function JobsList({ jobs, drivers, role, onStartChecklist, onEditJob, db, currentUserEmail, showAlert, showConfirm, allClientsList, onLoadMore }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [jobToFail, setJobToFail] = useState(null);
  const [prtPromptJob, setPrtPromptJob] = useState(null); 
  const [relayPromptJob, setRelayPromptJob] = useState(null); 
  const [forceCloseJob, setForceCloseJob] = useState(null); 
  
  const [dupPromptJob, setDupPromptJob] = useState(null);
  const [dupMode, setDupMode] = useState('clone');
  const [dupDestination, setDupDestination] = useState('');
  const [dupDriverEmail, setDupDriverEmail] = useState('');

  const [showBulkSign, setShowBulkSign] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkReceiverName, setBulkReceiverName] = useState('');
  const [bulkReceiverRut, setBulkReceiverRut] = useState('');
  const [bulkSignature, setBulkSignature] = useState(null);

  const [historyClientFilter, setHistoryClientFilter] = useState(''); 
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isInProgressOpen, setIsInProgressOpen] = useState(true);
  const [processingId, setProcessingId] = useState(null); 

  const [isAppReady, setIsAppReady] = useState(false);
  useEffect(() => {
     const timer = setTimeout(() => setIsAppReady(true), 800);
     return () => clearTimeout(timer);
  }, []); 

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

  const updatePhase = async (job, phase, extra = {}) => {
    if (processingId) return;
    setProcessingId(`${job.id}-${phase}`);
    try { 
       updateDoc(doc(db, 'transport_jobs', job.id), { phase, ...extra }).catch(e => {
           console.error(e); showAlert("Error de conexión al actualizar fase.");
       }); 
       if (phase === 'arrived_pickup') notifyClient(job, 'llegada_origen');
       if (phase === 'picked_up') notifyClient(job, 'en_ruta');
       if (phase === 'arrived_destination' || phase === 'arrived_prt') notifyClient(job, 'llegada_destino');
    } 
    finally { 
       setTimeout(() => setProcessingId(null), 300); 
    }
  }; 

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
    } 
    finally { 
       setTimeout(() => setProcessingId(null), 300); 
    }
  }; 
  
  const now = new Date();
  const isAdminView = role === 'admin';
  
  const filteredJobs = jobs.filter(job => {
    if (!isAdminView) {
      if (job.status === 'pending') {
        if (!job.assignedEmails?.includes(currentUserEmail)) return false;
      } else {
        if (job.acceptedByEmail !== currentUserEmail) return false;
      }
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
      if (!matchPlate && !matchBrand && !matchModel && !matchClient) return false;
    }
    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const adminOrder = { pending: 1, accepted: 2, completed: 3, failed: 3 };
    const driverOrder = { accepted: 1, pending: 2, completed: 3, failed: 3 };
    const order = isAdminView ? adminOrder : driverOrder;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === 'completed' || a.status === 'failed') return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
    const getValidTime = (dateStr, fallback) => {
       if (!dateStr) return fallback || 0;
       const time = new Date(dateStr).getTime();
       return isNaN(time) ? fallback || 0 : time;
    };
    return getValidTime(a.scheduledDate, a.createdAt) - getValidTime(b.scheduledDate, b.createdAt);
  });

  const activeJobs = sortedJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
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

  const pendingJobsList = activeJobs.filter(j => j.status === 'pending');
  const inProgressJobsList = activeJobs.filter(j => j.status === 'accepted');

  const handleDeleteJob = async (jobId) => {
    showConfirm("¿Estás seguro de eliminar este trabajo definitivamente?", async () => {
      try { await deleteDoc(doc(db, 'transport_jobs', jobId)); } catch (e) { console.error(e); }
    });
  };

  const handleDuplicateJob = (job) => {
    setDupPromptJob(job);
    setDupMode('clone');
    setDupDestination('');
    setDupDriverEmail('');
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

        if (dupDriverEmail) {
            const drv = drivers.find(d => d.email === dupDriverEmail);
            if (drv) {
                assignedDrivers = [{ id: drv.id, name: drv.name, email: drv.email }];
                assignedEmails = [drv.email];
            }
        }

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
            status: 'pending',
            createdAt: Date.now()
        };

        await addDoc(collection(db, 'transport_jobs'), cloneJob);
        showAlert("✅ Nuevo traslado creado con éxito. Revisa la lista de pendientes.");
        setDupPromptJob(null);
    } catch (e) {
        console.error(e);
        showAlert("Error al crear el nuevo traslado.");
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
              completedAt: Date.now(),
              checklist: mergedChecklist,
              phase: jobToClose.tripType === 'revision' ? 'prt_done' : 'arrived_destination',
              draft: deleteField()
           });
           
           notifyClient({...jobToClose, acceptedByEmail: jobToClose.acceptedByEmail, assignedDriverName: mergedChecklist.assignedDriverName}, 'finalizado');
        }
        
        showAlert(`✅ ${bulkSelectedIds.length} traslados finalizados exitosamente con una sola firma.`);
        setShowBulkSign(false);
        setBulkSelectedIds([]);
        setBulkReceiverName('');
        setBulkReceiverRut('');
        setBulkSignature(null);
     } catch(e) {
        console.error(e);
        showAlert("Error crítico al procesar la firma masiva. Verifica tu conexión.");
     } finally {
        setProcessingId(null);
     }
  };

  const getRouteStr = (j) => {
    if (j.tripType === 'revision') {
       if (j.checklist?.rtStatus === 'aprobado') {
           const ret = j.checklist.rtReturnOption === 'other' ? j.checklist.rtReturnDestination : j.origin;
           return `${j.origin} ➔ PRT ➔ ${ret || '-'}`;
       }
       if (j.checklist?.rtStatus === 'rechazado') {
           return `${j.origin} ➔ PRT (Rechazada)`;
       }
       return `${j.origin} ➔ Planta de Revisión (PRT)`;
    }
    let route = j.origin || '';
    if (j.waypoints && j.waypoints.length > 0) route += ` ➔ ${j.waypoints.join(' ➔ ')}`;
    if (j.destination) route += ` ➔ ${j.destination}`;
    return route;
  };

  const buildPDFDoc = async (job) => {
    const jsPDFModule = await import('jspdf');
    const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
    const docPDF = new JsPDFClass();

    const cleanStr = (str) => { if (!str) return ''; return String(str).replace(/➔/g, '->').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); };
    
    const fetchImageAsBase64 = async (url) => {
      if (!url) return null;
      if (url.startsWith('data:image')) return url;
      try {
        const res = await fetch(url, { mode: 'cors' });
        const blob = await res.blob();
        const fileBlob = new Blob([blob], { type: blob.type.includes('image') ? blob.type : 'image/jpeg' });
        return await new Promise(resolve => { 
          const reader = new FileReader(); 
          reader.onloadend = () => resolve(reader.result); 
          reader.readAsDataURL(fileBlob); 
        });
      } catch (e) { return null; }
    };

    const fixImageOrientation = async (base64) => {
      if (!base64) return null;
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, img.width, img.height);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.8), w: img.width, h: img.height });
        };
        img.onerror = () => resolve(null);
        img.src = base64;
      });
    };
    const loadSimpleLogo = async (src) => { return new Promise((resolve) => { const img = new Image(); img.src = src; img.crossOrigin = "Anonymous"; img.onload = () => { const tempCanvas = document.createElement('canvas'); tempCanvas.width = img.width; tempCanvas.height = img.height; const ctx = tempCanvas.getContext('2d'); ctx.drawImage(img, 0, 0, img.width, img.height); resolve({ data: tempCanvas.toDataURL('image/png'), w: img.width, h: img.height }); }; img.onerror = () => resolve(null); setTimeout(() => resolve(null), 1500); }); };

    const photos = job.checklist?.photos || {};
    const otherPhotoKeys = Object.keys(photos).filter(k => k !== 'front' && typeof photos[k] === 'string' && photos[k]);

    const [logoApp, logoLogistica, frontPhotoObj, signatureStr, ...preloadedOtherPhotos] = await Promise.all([
      loadSimpleLogo('/logo.png'),
      loadSimpleLogo('/LogoLogistica.png'),
      fetchImageAsBase64(photos.front).then(fixImageOrientation),
      fetchImageAsBase64(job.checklist?.signatureData),
      ...otherPhotoKeys.map(async (key) => {
         const base64Img = await fetchImageAsBase64(photos[key]);
         if (!base64Img) return null;
         const processed = await fixImageOrientation(base64Img);
         if (!processed) return null;
         return { key, base64Img: processed.data, dims: { w: processed.w, h: processed.h } };
      })
    ]);

    const primaryColor = [30, 41, 59]; const secondaryColor = [100, 116, 139]; const accentColor = [37, 99, 235]; const lightBg = [248, 250, 252]; const borderColor = [226, 232, 240];

    const drawHeader = (titleText) => {
      docPDF.setFillColor(...primaryColor); docPDF.rect(0, 0, 210, 40, 'F');
      docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(18); docPDF.setFont("helvetica", "bold");
      docPDF.text(cleanStr(titleText), 105, 18, null, null, "center");
      docPDF.setFontSize(9); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(148, 163, 184);
      docPDF.text(`FECHA TRASLADO: ${formatDateDisplay(job.scheduledDate) || '-'}`, 105, 26, null, null, "center");
      docPDF.setFontSize(11); docPDF.setFont("times", "bolditalic"); docPDF.setTextColor(255, 255, 255);
      if (logoLogistica) { const ratio = logoLogistica.h / logoLogistica.w; let imgW = 35; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("Logística TS SpA", 27, 34, null, null, "center"); }
      if (logoApp) { const ratio = logoApp.h / logoApp.w; let imgW = 20; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("LogisticAPP", 183, 34, null, null, "center"); }
      docPDF.setFont("helvetica", "normal");
    };

    let pdfTitle = job.tripType === 'revision' ? "CERTIFICADO DE REVISION TECNICA" : (job.tripType === 'viaje' ? "TRASLADO A REGIONES" : (job.tripType === 'simple' ? "ACTA DE SERVICIO EN TERRENO" : "CHECKLIST DE TRASLADO"));
    drawHeader(pdfTitle);
    let currentY = 50;

    if (job.tripType === 'revision' && job.checklist?.rtStatus) {
        const isApproved = job.checklist.rtStatus === 'aprobado';
        const statusText = isApproved ? "APROBADO" : "RECHAZADO";
        docPDF.setFillColor(isApproved ? 220 : 254, isApproved ? 252 : 226, isApproved ? 231 : 226);
        docPDF.rect(0, 40, 210, 12, 'F');
        docPDF.setFontSize(16); docPDF.setFont("helvetica", "bold");
        docPDF.setTextColor(isApproved ? 22 : 220, isApproved ? 163 : 38, isApproved ? 74 : 38); 
        docPDF.text(statusText, 195, 48, null, null, "right");
        currentY = 60; 
    }

    const startY = currentY; const leftColWidth = 90;
    const drawSectionTitle = (title, y, customWidth = leftColWidth) => { docPDF.setFillColor(...lightBg); docPDF.rect(15, y - 6, customWidth, 10, 'F'); docPDF.setDrawColor(...accentColor); docPDF.setLineWidth(1); docPDF.line(15, y - 6, 15, y + 4); docPDF.setTextColor(...primaryColor); docPDF.setFontSize(10); docPDF.setFont("helvetica", "bold"); docPDF.text(cleanStr(title).toUpperCase(), 20, y+1); return y + 10; };
    const drawKV = (label, value, x, y, maxW = 40) => { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(cleanStr(label).toUpperCase(), x, y); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const splitValue = docPDF.splitTextToSize(cleanStr(value), maxW); docPDF.text(splitValue, x, y + 4); return splitValue.length * 4; };

    let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "No registrado";
    if (job.acceptedByEmail) { const foundDriver = drivers?.find(d => d.email === job.acceptedByEmail); if (foundDriver) driverNameStr = foundDriver.name; }

    let sectionNum = 1;

    if (job.tripType === 'simple') {
        currentY = drawSectionTitle(`${sectionNum}. Detalles del Servicio`, currentY, 180);
        let hC = drawKV("Cliente / Solicitante", `${job.client || 'Sin Cliente'}`, 15, currentY, 80);
        let hD = drawKV("Operario Encargado", driverNameStr, 105, currentY, 80);
        currentY += Math.max(hC, hD) + 6;
        
        let hDesc = drawKV("Descripcion de la Tarea", `${job.description || 'Sin descripcion detallada'}`, 15, currentY, 180);
        currentY += hDesc + 6;
        
        let routeText = `${job.origin || '-'}`;
        if (job.destination) routeText += `  ->  ${job.destination}`;
        let hLoc = drawKV("Lugar de Ejecucion", routeText, 15, currentY, 180);
        currentY += hLoc + 8;
        sectionNum++;

        currentY = drawSectionTitle(`${sectionNum}. Notas del Operario`, currentY, 180);
        docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); 
        const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin notas registradas.'}`), 180); 
        docPDF.text(obsSplit, 15, currentY + 2); 
        currentY += (obsSplit.length * 4) + 10;
        sectionNum++;
    } else {
        currentY = drawSectionTitle(`${sectionNum}. Detalles del Vehiculo`, currentY);
        let hC = drawKV("Cliente", `${job.client || 'Sin Cliente'}`, 15, currentY, 45);
        let hM = drawKV("Marca y Modelo", `${job.brand || '-'} ${job.model || '-'}`, 65, currentY, 45);
        currentY += Math.max(hC, hM) + 6;
        
        let plateText = getJobIdentifier(job); if (job.vin && job.vin !== plateText) { plateText += ` / VIN: ${job.vin}`; }
        let hP = drawKV("Patente / VIN", plateText, 15, currentY, 45);
        let hD = drawKV("Conductor", driverNameStr, 65, currentY, 45);
        currentY += Math.max(hP, hD) + 6;
        
        let routeText = `${job.origin || '-'}`;
        if (job.waypoints && job.waypoints.length > 0) { routeText += `  ->  ${job.waypoints.join('  ->  ')}`; }
        if (job.destination) { routeText += `  ->  ${job.destination}`; }
        
        if (job.tripType === 'revision') { if (job.checklist?.rtStatus === 'aprobado') { const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin; routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`; } else if (job.checklist?.rtStatus === 'rechazado') { routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`; } else { routeText = `${job.origin || '-'}  ->  PRT`; } }
        let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
        currentY += routeH + 8;
        sectionNum++;

        currentY = drawSectionTitle(`${sectionNum}. Recepcion y Estado`, currentY);
        const getDocStatus = (docKey) => { const isOk = job.checklist?.docs?.[docKey]; const expDate = job.checklist?.docsExpiry?.[docKey]; if (!isOk) return 'FALTA'; if (expDate) { const [y, m, d] = expDate.split('-'); return `AL DIA (Vence: ${d}/${m}/${y})`; } return 'AL DIA'; };
        let hFuel = drawKV("Combustible", `${job.checklist?.fuelLevel || '0'}%`, 15, currentY, 45);
        let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
        currentY += Math.max(hFuel, hSoap) + 6;
        let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
        let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
        currentY += Math.max(hPerm, hRev) + 6;
        let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
        currentY += hGas + 8;

        docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("OBSERVACIONES:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth); docPDF.text(obsSplit, 15, currentY + 4); currentY += (obsSplit.length * 4) + 8;
        if (job.waitTimeMinutes && job.waitTimeMinutes > 20) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38); const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA EN ORIGEN: ${job.waitTimeMinutes} minutos`, leftColWidth); docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2; } else if (job.checklist?.hasWaitTime) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);  const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);  docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;  }
        if (job.checklist?.hasFuelCharge) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235); const fcStr = docPDF.splitTextToSize(`CARGA DE COMBUSTIBLE: ${cleanStr(job.checklist.fuelChargeAmount || 'Sí')}`, leftColWidth); docPDF.text(fcStr, 15, currentY); currentY += (fcStr.length * 4) + 2; }
        sectionNum++;
    }

    if (job.tripType === 'revision') { currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY); if (job.checklist?.rtStatus === 'aprobado') { docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); docPDF.text("APROBADO", 15, currentY + 6); currentY += 18; } else { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); docPDF.text("RECHAZADO", 15, currentY + 6); docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27); const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth); docPDF.text(rejSplit, 15, currentY + 12); currentY += 20 + (rejSplit.length * 4); } sectionNum++; }

    if (job.status === 'failed' && job.tripType !== 'revision') {
        currentY = drawSectionTitle(`${sectionNum}. Resultado del Traslado`, currentY, job.tripType === 'simple' ? 180 : leftColWidth);
        docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); docPDF.text("TRASLADO FALLIDO / CANCELADO", 15, currentY + 6);
        docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27);
        const failSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.failedReason || 'No especificada'}`), job.tripType === 'simple' ? 180 : leftColWidth);
        docPDF.text(failSplit, 15, currentY + 12);
        currentY += 20 + (failSplit.length * 4);
        sectionNum++;
    }

    currentY = drawSectionTitle(`${sectionNum}. Conformidad Entrega`, currentY, job.tripType === 'simple' ? 180 : leftColWidth);
    if (job.checklist?.noReception) { 
      docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(9); const nrSplit = docPDF.splitTextToSize("TRABAJO SIN FIRMA DE RECEPCION (Confirmada por operario en terreno)", job.tripType === 'simple' ? 180 : leftColWidth); docPDF.text(nrSplit, 15, currentY + 4); currentY += (nrSplit.length * 4) + 6; 
    } else { 
      drawKV("Receptor", `${job.checklist?.receiverName || 'N/A'}`, 15, currentY, job.tripType === 'simple' ? 180 : leftColWidth); currentY += 12; 
      drawKV("RUT", `${job.checklist?.receiverRut || 'N/A'}`, 15, currentY, job.tripType === 'simple' ? 180 : leftColWidth); currentY += 12; 
      if (job.checklist?.clientComments) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("COMENTARIOS:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const commSplit = docPDF.splitTextToSize(cleanStr(job.checklist.clientComments), job.tripType === 'simple' ? 180 : leftColWidth); docPDF.text(commSplit, 15, currentY + 4); currentY += (commSplit.length * 4) + 6; } 
      if(signatureStr) { 
        docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("FIRMA DE CONFORMIDAD:", 15, currentY); 
        try { docPDF.addImage(signatureStr, 'JPEG', 15, currentY + 2, 45, 25); } catch(e) { try { docPDF.addImage(signatureStr, 'PNG', 15, currentY + 2, 45, 25); } catch(err){} }
        currentY += 30; 
      } 
    }
    
    if (job.checklist?.location) { currentY += 2; const { lat, lng } = job.checklist.location; docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(`UBICACION GPS:`, 15, currentY); docPDF.setFontSize(9); docPDF.setTextColor(...accentColor); docPDF.textWithLink('Clic aqui para ver mapa en Google', 15, currentY + 4, { url: `https://maps.google.com/?q=${lat},${lng}` }); }

    if (frontPhotoObj && job.tripType !== 'simple') { 
      try { 
        const dims = { w: frontPhotoObj.w, h: frontPhotoObj.h }; 
        const frontPhotoStr = frontPhotoObj.data;
        const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; } const rightX = 115; const rightY = startY + 6; docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" }); 
        try { docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH); } catch(e) { docPDF.addImage(frontPhotoStr, 'PNG', rightX, rightY + 2, imgW, imgH); }
      } catch (err) { console.error("Error al incrustar foto frontal:", err); } 
    }

    const addFooter = () => { const pageCount = docPDF.internal.getNumberOfPages(); for(let i = 1; i <= pageCount; i++) { docPDF.setPage(i); docPDF.setFontSize(8); docPDF.setTextColor(148, 163, 184); docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center"); } }

    if (preloadedOtherPhotos.length > 0) {
      const labels = job.tripType === 'simple' 
         ? { det1: 'Evidencia 1', det2: 'Evidencia 2', det3: 'Evidencia 3', det4: 'Evidencia 4', det5: 'Evidencia 5', det6: 'Evidencia 6', det7: 'Evidencia 7', det8: 'Evidencia 8', det9: 'Evidencia 9', det10: 'Evidencia 10' }
         : { left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', interior_front: 'Int. Adelante', interior_back: 'Int. Atras', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4', det5: 'Detalle 5', det6: 'Detalle 6', det7: 'Detalle 7', det8: 'Detalle 8' };
      
      let photoY = 46; let currentCol = 1; let addedPage = false;
      const detailPins = job.checklist?.detailPins || [];
      if (detailPins.length > 0 && job.tripType !== 'simple') { docPDF.addPage(); drawHeader("ESQUEMA DE DAÑOS Y DETALLES"); addedPage = true; const mapX = 75; const mapY = 50; const mapW = 60; const mapH = 100; docPDF.setFillColor(248, 250, 252); docPDF.roundedRect(mapX, mapY, mapW, mapH, 3, 3, 'F'); docPDF.setDrawColor(203, 213, 225); docPDF.roundedRect(mapX, mapY, mapW, mapH, 3, 3, 'S'); const vType = job.checklist.vehicleType || 'auto'; const vx = mapX + 10; const vw = mapW - 20; const vy = mapY + 10; const vh = mapH - 20; docPDF.setFillColor(203, 213, 225); docPDF.setDrawColor(148, 163, 184); docPDF.setLineWidth(1); if (vType === 'camioneta') { docPDF.roundedRect(vx, vy, vw, vh*0.35, 3, 3, 'FD'); docPDF.setFillColor(71, 85, 105); docPDF.rect(vx+4, vy+4, vw-8, 6, 'F'); docPDF.setFillColor(226, 232, 240); docPDF.roundedRect(vx+2, vy+vh*0.38, vw-4, vh*0.62, 2, 2, 'FD'); } else if (vType === 'camion') { docPDF.setFillColor(191, 219, 254); docPDF.roundedRect(vx-2, vy, vw+4, vh*0.2, 2, 2, 'FD'); docPDF.setFillColor(226, 232, 240); docPDF.roundedRect(vx, vy+vh*0.22, vw, vh*0.78, 1, 1, 'FD'); } else { docPDF.roundedRect(vx, vy, vw, vh, 6, 6, 'FD'); docPDF.setFillColor(71, 85, 105); docPDF.rect(vx+4, vy+8, vw-8, 8, 'F'); docPDF.rect(vx+4, vy+vh-12, vw-8, 6, 'F'); } detailPins.forEach(pin => { const px = vx + (vw * (pin.x / 100)); const py = vy + (vh * (pin.y / 100)); docPDF.setFillColor(239, 68, 68); docPDF.circle(px, py, 3.5, 'F'); docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(8); docPDF.text(pin.id.replace('det', ''), px, py + 1.2, {align: 'center', baseline: 'middle'}); }); docPDF.setFontSize(9); docPDF.setTextColor(100, 116, 139); docPDF.text("Los numeros en rojo corresponden a las fotos de detalle del anexo:", 105, 165, null, null, "center"); photoY = 180; }
      
      for (const item of preloadedOtherPhotos) { 
        if (!item) continue;
        const { key, base64Img, dims } = item;
        if (!addedPage) { docPDF.addPage(); drawHeader("ANEXO FOTOGRAFICO"); addedPage = true; } 
        try { 
          const ratio = dims.h / dims.w; let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; } const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2); if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); } docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text((labels[key] || key).toUpperCase(), slotCenter, photoY - 3, { align: "center" }); 
          try { docPDF.addImage(base64Img, 'JPEG', finalX, photoY + 2, imgW, imgH); } catch(e) { docPDF.addImage(base64Img, 'PNG', finalX, photoY + 2, imgW, imgH); }
          if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; } 
        } catch (err) { console.error("Error al incrustar la foto:", key, err); } 
      }
    }

    addFooter();
    return docPDF;
  };

  const getDStr = j => j.scheduledDate?formatDateDisplay(j.scheduledDate):formatDateDisplay(new Date().toISOString().split('T')[0]);
  
  const getExtraWappTxt = (j) => {
    let t = '';
    if (j.checklist?.hasWaitTime) t += `\nTIEMPO DE ESPERA: ${j.checklist.waitTime || 'Sí'}`;
    if (j.checklist?.hasFuelCharge) {
       const fuelCost = Number(j.checklist.fuelChargeAmount);
       t += `\nCARGA DE COMBUSTIBLE: ${fuelCost ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(fuelCost) : 'Sí'}`;
    }
    
    if (j.tripType === 'revision') {
      const prtTotal = Number(j.checklist?.prtCostRevision || 0) + Number(j.checklist?.prtCostInspeccion || 0) + Number(j.checklist?.prtCostFrenos || 0);
      if (prtTotal > 0) {
        t += `\nVALOR PRT: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(prtTotal)}`;
      }
    }
    
    return t;
  };

  const handleCopyWhatsApp = (job) => { 
    const dateStr = getDStr(job);
    const dateShort = dateStr.substring(0, 5); 
    const jobPlate = getJobIdentifier(job);
    
    let text = job.tripType === 'simple' 
      ? `${dateShort}\n${job.client || 'Sin Cliente'}\n📌 TAREA: ${job.description || 'Servicio en Terreno'}\n🚗 VEHÍCULO: ${jobPlate}\n📍 LUGAR: ${getRouteStr(job)}${getExtraWappTxt(job)}`
      : `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${jobPlate}\n${getRouteStr(job)}${getExtraWappTxt(job)}`; 
    
    if (job.status === 'failed') {
      text = `❌ TRASLADO FALLIDO\nMotivo: ${job.failedReason || 'No especificada'}\n\n${text}`;
    }

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
    try { const docPDF = await buildPDFDoc(job); const cleanPlate = getJobIdentifier(job); const fileName = `Check.${getDStr(job).replace(/\//g, '-')}.${(job.client || 'SinCliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; docPDF.save(fileName); } catch(e) { console.error(e); showAlert("Hubo un error al generar PDF."); }
    finally { setProcessingId(null); }
  };

  const handleShareWhatsAppPDF = async (job) => {
    if (processingId) return;
    setProcessingId(`${job.id}-wapp`);
    try {
      const dateStrForFile = getDStr(job).replace(/\//g, '-');
      const dateShort = getDStr(job).substring(0, 5);
      const cleanPlate = getJobIdentifier(job);
      const fileName = `Check.${dateStrForFile}.${(job.client || 'SinCliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`;
      
      let textToShare = job.tripType === 'simple' 
        ? `${dateShort}\n${job.client || 'Sin Cliente'}\n📌 TAREA: ${job.description || 'Servicio en Terreno'}\n🚗 VEHÍCULO: ${cleanPlate}\n📍 LUGAR: ${getRouteStr(job)}${getExtraWappTxt(job)}`
        : `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${cleanPlate}\n${getRouteStr(job)}${getExtraWappTxt(job)}`;
      
      if (job.status === 'failed') {
        textToShare = `❌ TRASLADO FALLIDO\nMotivo: ${job.failedReason || 'No especificada'}\n\n${textToShare}`;
      }

      const docPDF = await buildPDFDoc(job); 
      const pdfBlob = docPDF.output('blob'); 
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const textArea = document.createElement("textarea");
      textArea.value = textToShare;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);

      if (navigator.canShare && navigator.canShare({ files: [file] })) { 
         await navigator.share({ 
           title: fileName, 
           text: textToShare,
           files: [file] 
         }); 
      } else { 
         showAlert("Tu dispositivo no soporta compartir el archivo directamente. Descárgalo primero."); 
         handleCopyWhatsApp(job); 
      }
    } catch (e) { 
      console.error("Compartir cancelado o fallido:", e); 
    } finally { 
      setProcessingId(null); 
    }
  };

  const renderActiveJobCard = (j) => {
    const isPending = j.status === 'pending';
    const isAccepted = j.status === 'accepted';
    const phase = j.phase || 'claimed'; 
    const step2Done = isAccepted && ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
    const step3Done = isAccepted && ['arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
    const step4Done = isAccepted && phase === 'prt_done';
    
    const ident = getJobIdentifier(j);

    return (
      <div key={j.id} className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 flex flex-col shadow-sm relative hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 overflow-hidden cursor-default">
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isPending ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
        
        <div className="flex justify-between items-start mb-5 border-b border-slate-100 pb-4 pl-2">
          <div className="flex flex-col gap-3 w-full">
            <div className="flex justify-between items-start w-full gap-2">
              <div className="shrink-0 relative z-20 flex flex-col items-end gap-1">
                {j.tripType === 'simple' && (
                   <span className="bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm max-w-[150px] text-center leading-tight mb-1">SERVICIO</span>
                )}
                {ident !== 'S/N' && (
                   <>
                     <LicensePlateBadge text={ident} />
                     {j.vin && ident !== j.vin && (
                       <span className="text-[9px] font-black bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm mr-1">VIN: {j.vin}</span>
                     )}
                   </>
                )}
              </div>
              
              <div className="flex items-center gap-1 relative shrink-0">
                {isAdminView && <button onClick={()=>onEditJob(j)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-5 h-5"/></button>}
                <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"><MoreVertical className="w-5 h-5"/></button>
                {menuOpenId===j.id && (
                  <div className="absolute right-0 top-10 bg-white border shadow-2xl rounded-xl w-48 z-50 overflow-hidden text-xs">
                    <button onClick={() => {
                      const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                      const textToShare = `📍 Sigue en tiempo real todos los traslados de ${j.client || 'tu empresa'} aquí:\n${url}`;
                      const textArea = document.createElement("textarea");
                      textArea.value = textToShare; textArea.style.position = "fixed"; document.body.appendChild(textArea);
                      textArea.focus(); textArea.select();
                      try { document.execCommand('copy'); showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!"); } catch(e) {}
                      document.body.removeChild(textArea); setMenuOpenId(null);
                    }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-blue-50 text-blue-600"><Navigation className="w-4 h-4"/> Portal Cliente</button>
                    
                    {isAccepted && (
                      <button onClick={() => {
                        const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                        const textToShare = `📍 Hola! El vehículo ${ident} va en camino a ${j.destination || 'su destino'}. Puedes seguir el traslado en tiempo real aquí:\n${url}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank');
                        setMenuOpenId(null);
                      }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-green-50 text-green-600 border-t border-slate-50"><Share2 className="w-4 h-4"/> Notificar Receptor</button>
                    )}

                    {isAccepted && (j.phase === 'picked_up' || !j.phase) && (
                      <button onClick={() => { setRelayPromptJob(j); setMenuOpenId(null); }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-purple-50 text-purple-600 border-t border-slate-50"><Users className="w-4 h-4"/> Traspaso a Compañero</button>
                    )}
                    
                    {isAdminView && (
                      <button onClick={() => { setForceCloseJob(j); setMenuOpenId(null); }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-emerald-50 text-emerald-600 border-t border-slate-50">
                        <CheckCircle className="w-4 h-4"/> Forzar Cierre
                      </button>
                    )}

                    <button onClick={()=>cpyWapp(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-slate-50 border-t border-slate-50"><Copy className="w-4 h-4"/> Copiar Resumen</button>
                    
                    {isAccepted && (!j.phase || j.phase === 'claimed' || j.phase === 'arrived_pickup') && (
                      <button onClick={() => { showConfirm("¿Deseas cancelar la aceptación?", async () => { try { await updateDoc(doc(db, 'transport_jobs', j.id), { status: 'pending', acceptedByEmail: deleteField(), phase: deleteField(), liveLocation: deleteField(), arrivedPickupAt: deleteField(), waitTimeMinutes: deleteField() }); setMenuOpenId(null); showAlert("✅ Traslado liberado."); } catch (err) { showAlert("Error al liberar."); } }); }} className="w-full text-left p-3 font-bold flex gap-2 text-amber-600 hover:bg-amber-50 border-t border-slate-50">
                        <X className="w-4 h-4"/> Cancelar Aceptación (Soltar)
                      </button>
                    )}

                    <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t border-slate-50"><XCircle className="w-4 h-4"/> Cancelar / Falló</button>
                  </div>
                )}
              </div>
            </div>
            
            <div>
                {j.tripType === 'simple' ? (
                   <p className="text-lg font-black text-purple-800 leading-tight mt-1 break-words pr-2">{j.description || 'Servicio en Terreno'}</p>
                ) : (
                   <p className="text-xl font-black text-slate-800 leading-tight mt-1 break-words pr-2">{j.brand} {j.model}</p>
                )}
                <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wide">{j.client}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 p-3 rounded-2xl border-2 border-slate-200 mb-4 mt-1 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">{j.tripType === 'simple' ? 'Lugar' : 'Desde'}</span>
                <p className="text-sm font-extrabold text-slate-800 truncate">{j.origin || 'Por definir'}</p>
              </div>
              {(j.destination || j.tripType !== 'simple') && (
                <>
                  <div className="text-slate-400 font-black text-sm px-2">➔</div>
                  {j.waypoints && j.waypoints.length > 0 && (
                     <>
                        <div className="flex-1 min-w-0 text-center">
                           <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block mb-0.5">{j.waypoints.length === 1 ? 'Parada' : 'Paradas'}</span>
                           <p className="text-xs font-extrabold text-amber-600 truncate" title={j.waypoints.join(' ➔ ')}>{j.waypoints.length} int.</p>
                        </div>
                        <div className="text-slate-400 font-black text-sm px-2">➔</div>
                     </>
                  )}
                  <div className="flex-1 min-w-0 text-right">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Hasta</span>
                    <p className="text-sm font-extrabold text-blue-600 truncate">{j.tripType === 'revision' ? 'Planta PRT' : (j.destination || 'Por definir')}</p>
                  </div>
                </>
              )}
            </div>
            
            {j.waypoints && j.waypoints.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200/60">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Ruta intermedia:</p>
                <div className="flex flex-wrap gap-1.5">
                  {j.waypoints.map((wp, i) => (
                     <span key={i} className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-200 shadow-sm">{i + 1}. {wp}</span>
                  ))}
                </div>
              </div>
            )}

            {j.contactName && j.contactPhone && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                 <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="bg-emerald-100 p-1.5 rounded-full shrink-0"><Users className="w-4 h-4 text-emerald-600"/></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Encargado</p>
                      <p className="text-xs font-bold text-slate-700 truncate">{j.contactName}</p>
                    </div>
                 </div>
                 <div className="flex gap-2 shrink-0">
                   <a href={`https://wa.me/${j.contactPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent('Hola ' + j.contactName + ', soy de LogisticAPP y voy en camino al destino con el vehículo.')}`} target="_blank" rel="noopener noreferrer" className="bg-emerald-500 hover:bg-emerald-600 text-white w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm active:scale-95 text-base">💬</a>
                   <a href={`tel:${j.contactPhone.replace(/[^\d+]/g, '')}`} className="bg-blue-500 hover:bg-blue-600 text-white w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm active:scale-95 text-base">📞</a>
                 </div>
              </div>
            )}
          </div>

          {j.tripType === 'revision' && <div className="mb-3 bg-amber-50 border border-amber-200 p-2 rounded-xl text-center shadow-sm"><span className="text-[10px] font-black text-amber-700 uppercase">REVISIÓN TÉCNICA (TIPO {j.rtData?.type})</span></div>}
          {j.tripType === 'viaje' && <div className="mb-3 bg-indigo-50 border border-indigo-100 rounded-xl p-2 mb-3 text-center shadow-sm"><span className="text-[10px] font-black text-indigo-700 uppercase">A Regiones</span></div>}
          
          {(() => {
             if (!j.scheduledDate) return null;
             const today = new Date(); today.setHours(0,0,0,0);
             const [y, m, d] = j.scheduledDate.split('-');
             const schedDate = new Date(y, m - 1, d); schedDate.setHours(0,0,0,0);
             const diffDays = Math.round((schedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
             const timeStr = j.scheduledTime ? ` a las ${j.scheduledTime}` : '';
             if (diffDays === 0) {
                 if (!j.scheduledTime) return null;
                 return <div className="mb-3 bg-blue-50 border border-blue-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-blue-700 uppercase tracking-widest">📅 HOY{timeStr}</span></div>;
             }
             if (diffDays === 1) return <div className="mb-3 bg-cyan-50 border border-cyan-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-cyan-700 uppercase tracking-widest">📅 Mañana{timeStr}</span></div>;
             if (diffDays > 1) return <div className="mb-3 bg-slate-100 border border-slate-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-slate-600 uppercase tracking-widest">📅 Para el {d}/{m}/{y}{timeStr}</span></div>;
             return <div className="mb-3 bg-red-50 border border-red-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-red-700 uppercase tracking-widest">⚠️ Atrasado ({d}/{m}/{y}{timeStr})</span></div>;
          })()}

        <div className="relative pl-7 space-y-5 before:absolute before:inset-y-2 before:left-[10px] before:w-0.5 before:bg-slate-100 flex-1 mb-5">
          <div className="relative"><div className="absolute -left-7 bg-blue-500 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center"><CheckCircle className="w-2.5 h-2.5 text-white"/></div><p className="font-extrabold text-slate-800 text-sm leading-tight">{isAccepted ? (j.assignedDrivers?.find(d => d.email === j.acceptedByEmail)?.name || "Conductor") : "Buscando conductor"}</p><p className="text-xs font-bold text-slate-500">{isAccepted ? (j.tripType === 'simple' ? `Asignado a ${j.origin}` : `Retira en ${j.origin}`) : `Para ${j.origin}`}</p></div>
          <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step2Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step2Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-sm leading-tight ${step2Done ? 'text-slate-800' : 'text-slate-400'}`}>{j.tripType === 'simple' ? 'Realizando Trabajo' : 'Vehículo en Tránsito'}</p></div>
          <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step3Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step3Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-sm leading-tight ${step3Done ? 'text-slate-800' : 'text-slate-400'}`}>{j.tripType === 'simple' ? 'Trabajo Terminado' : (j.tripType === 'revision' ? 'En PRT' : 'Llegada a Destino')}</p><p className={`text-xs font-bold ${step3Done ? 'text-blue-600' : 'text-slate-400'}`}>{j.tripType === 'simple' ? (j.destination || '') : (j.tripType === 'revision' ? 'Planta' : j.destination)}</p></div>
          
          {j.tripType === 'revision' && (
            <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step4Done ? (j.prt_result === 'rechazado' ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-200'}`}>{step4Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-sm leading-tight ${step4Done ? (j.prt_result === 'rechazado' ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>Resultado Revisión</p>{step4Done && <p className={`text-xs font-bold ${j.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-600'}`}>{j.prt_result === 'rechazado' ? `Rechazado` : 'Aprobado'}</p>}</div>
          )}
        </div>

        {j.phase === 'arrived_pickup' && j.arrivedPickupAt && <WaitTimerBadge arrivedAt={j.arrivedPickupAt} role={role} />}

        <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
          {isPending && (!isAdminView || j.assignedEmails?.includes(currentUserEmail)) && (
            <SwipeButton key={`btn-accept-${j.id}`} onConfirm={() => handleAcceptJob(j)} text="Desliza para Aceptar" colorClass="bg-blue-600" isProcessing={processingId === `${j.id}-accept`} />
          )}

          {isAccepted && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
            <>
              {(!j.phase || j.phase === 'claimed') && <SwipeButton key={`btn-pickup-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_pickup', { arrivedPickupAt: Date.now() })} text={j.tripType === 'simple' ? "Desliza: Llegué al lugar" : "Desliza: Llegué a retirar"} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-amber-500" isProcessing={processingId === `${j.id}-arrived_pickup`} />}
              
              {j.phase === 'arrived_pickup' && <SwipeButton key={`btn-power-${j.id}`} onConfirm={()=>{
                const waitMins = j.arrivedPickupAt ? Math.floor((Date.now() - j.arrivedPickupAt) / 60000) : 0;
                updatePhase(j, 'picked_up', { pickedUpAt: Date.now(), waitTimeMinutes: waitMins });
              }} text={j.tripType === 'simple' ? "Desliza: Iniciar Trabajo" : "Desliza: Vehículo en mi poder"} icon={j.tripType === 'simple' ? <Clock className="w-4 h-4"/> : <Car className="w-4 h-4"/>} colorClass="bg-indigo-600" isProcessing={processingId === `${j.id}-picked_up`} />}
              
              {j.phase === 'picked_up' && j.tripType !== 'revision' && <SwipeButton key={`btn-dest-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_destination')} text={j.tripType === 'simple' ? "Desliza: Finalizar Trabajo" : "Desliza: Llegué a Destino"} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${j.id}-arrived_destination`} />}
              
              {j.phase === 'picked_up' && j.tripType === 'revision' && <SwipeButton key={`btn-prt-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_prt')} text="Desliza: Llegué a PRT" icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${j.id}-arrived_prt`} />}
              
              {j.phase === 'arrived_prt' && (
                <div className="flex gap-2">
                  <button onClick={()=>updatePhase(j, 'prt_done', { prt_result: 'aprobado' })} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-1 disabled:opacity-50">
                     {processingId === `${j.id}-prt_done` ? <Clock className="w-3 h-3 animate-spin"/> : '✅'} Aprobado
                  </button>
                  <button onClick={()=>setPrtPromptJob(j)} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50">❌ Rechazado</button>
                </div>
              )}

              <button onClick={()=>onStartChecklist(j)} className={`w-full font-bold py-2 rounded-xl text-xs shadow-sm transition-colors ${(j.phase === 'arrived_destination' || j.phase === 'prt_done') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}>
                📸 {(j.phase === 'arrived_destination' || j.phase === 'prt_done') ? (j.tripType === 'simple' ? 'Cerrar Acta de Servicio' : 'Cerrar Checklist') : (j.tripType === 'simple' ? 'Pre-llenar Acta' : 'Pre-llenar Checklist')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderHistoryJobCard = (j) => {
    const drv = drivers?.find(d => d.email === j.acceptedByEmail);
    const driverName = drv ? drv.name : (j.checklist?.assignedDriverName || j.acceptedByEmail || 'No registrado');
    const isFailed = j.status === 'failed';
    const ident = getJobIdentifier(j);
    
    return (
      <div key={j.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative pl-5 overflow-hidden hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-default">
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
        <div className="flex justify-between items-start mb-2 gap-2">
          {j.tripType === 'simple' ? (
             <p className="text-sm font-black text-purple-800 leading-tight break-words mt-1 pr-2">{j.description || 'Servicio en Terreno'}</p>
          ) : (
             <p className="text-sm font-black text-slate-800 leading-tight break-words mt-1 pr-2">{j.brand} {j.model}</p>
          )}
          <div className="flex flex-col items-end shrink-0 gap-1">
            {j.tripType === 'simple' && (
               <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm mb-0.5">SERVICIO</span>
            )}
            {ident !== 'S/N' && (
               <>
                 <LicensePlateBadge text={ident} />
                 {j.vin && ident !== j.vin && (
                   <span className="text-[8px] font-black bg-slate-100 border border-slate-200 text-slate-500 px-1 py-[1px] rounded uppercase tracking-widest mr-1">VIN: {j.vin}</span>
                 )}
               </>
            )}
          </div>
        </div>
        <div className="my-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs font-black flex items-center justify-between gap-1">
          <span className="truncate text-slate-700 max-w-[45%]"><MapPin className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-slate-400 shrink-0"/>{j.origin}</span>
          <span className="text-slate-400 font-bold shrink-0">➔</span>
          <span className="truncate text-blue-600 max-w-[45%] text-right">{j.tripType === 'revision' ? 'PRT' : j.destination}</span>
        </div>
        <div className="mb-3">
           <p className="text-blue-600 font-extrabold text-[10px] uppercase tracking-wide truncate">Conductor: <span className="text-slate-700">{driverName}</span></p>
           {isFailed && <p className="text-red-600 text-[10px] mt-0.5 font-bold line-clamp-1">Razón: {j.failedReason}</p>}
        </div>
        <div className="flex justify-between items-end border-t border-slate-50 pt-2 mb-2">
          <p className={`text-[10px] font-black uppercase ${isFailed ? 'text-red-500' : 'text-green-600'}`}>{isFailed ? 'RECHAZADO' : 'ENTREGADO'}</p>
          <p className="text-slate-400 font-bold text-[9px]">{getDStr(j)}</p>
        </div>
         <div className="flex gap-1.5 mt-auto">
          {isAdminView && <button onClick={()=>onEditJob(j)} className="flex-1 py-1.5 flex justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors" title="Editar Traslado"><Edit2 className="w-3.5 h-3.5"/></button>}
          {isAdminView && <button onClick={()=>handleDuplicateJob(j)} className="flex-1 py-1.5 flex justify-center bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors" title="Repetir Vehículo"><Repeat className="w-3.5 h-3.5"/></button>}
          <button onClick={()=>cpyWapp(j)} className="flex-1 py-1.5 flex justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Copiar Resumen"><Copy className="w-3.5 h-3.5"/></button>
          <button onClick={() => generatePDF(j)} disabled={processingId === `${j.id}-pdf`} className="flex-1 py-1.5 flex justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50" title="Descargar PDF">{processingId === `${j.id}-pdf` ? <Clock className="w-3.5 h-3.5 animate-spin"/> : <FileDown className="w-3.5 h-3.5"/>}</button>
          <button onClick={() => handleShareWhatsAppPDF(j)} disabled={processingId === `${j.id}-wapp`} className="flex-1 py-1.5 flex justify-center items-center bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50" title="Compartir PDF por WhatsApp">
            {processingId === `${j.id}-wapp` ? <Clock className="w-3.5 h-3.5 animate-spin"/> : <Share2 className="w-3.5 h-3.5"/>}
          </button>
          {isAdminView && <button onClick={()=>handleDeleteJob(j.id)} className="flex-1 py-1.5 flex justify-center bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar Traslado"><Trash2 className="w-3.5 h-3.5"/></button>}
        </div>
      </div>
    );
  };

  const handlePurgeOldJobs = async () => {
    showConfirm("⚠️ ¿Limpiar DB? Se empaquetarán actas > 30 días en ZIP.", async () => {
      try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const q = query(collection(db, 'transport_jobs'), where('createdAt', '<', thirtyDaysAgo));
        const snap = await getDocs(q);
        if (snap.empty) return showAlert("Nada que limpiar.");

        let count = 0;
        for (const document of snap.docs) {
          await deleteDoc(doc(db, 'transport_jobs', document.id));
          count++;
        }
        showAlert(`✅ Limpieza completada: ${count} traslados eliminados.`);
      } catch (err) { showAlert("Error al limpiar."); }
    });
  };

  const handleDownloadAllZIP = async () => {
    showAlert("⏳ Comprimiendo...");
    try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (const job of historyJobs.filter(j => j.checklist)) {
           const docPDF = await buildPDFDoc(job);
           zip.file(`Acta_${job.id}.pdf`, docPDF.output('blob'));
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Actas_Export_${Date.now()}.zip`;
        link.click();
    } catch (err) { showAlert("Error al generar ZIP."); }
  };

  if (!isAppReady) return null;

  return (
    <div className="pb-16">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="w-5 h-5 text-slate-400" /></div>
           <input type="text" placeholder="Buscar..." className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
           <button onClick={() => { setBulkSelectedIds([]); setBulkReceiverName(''); setBulkReceiverRut(''); setBulkSignature(null); setShowBulkSign(true); }} className="group bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shrink-0">
             <PenTool className="w-5 h-5"/> Firma Masiva
           </button>
           {isAdminView && (
             <>
               <button type="button" onClick={handlePurgeOldJobs} className="group bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shrink-0">
                 <Trash2 className="w-5 h-5"/> Limpiar DB
               </button>
               <button type="button" onClick={handleDownloadAllZIP} className="group bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shrink-0">
                 <FileDown className="w-5 h-5"/> ZIP
               </button>
             </>
           )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="w-full md:w-1/2 flex flex-col overflow-hidden">
          <button onClick={() => setIsInProgressOpen(!isInProgressOpen)} className="w-full flex justify-between items-center p-4">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-600"/> En Curso ({inProgressJobsList.length})</h3>
            {isInProgressOpen ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
          </button>
          {isInProgressOpen && <div className="flex flex-col gap-4 p-4 pt-0">{inProgressJobsList.map(j => renderActiveJobCard(j))}</div>}
        </div>
        <div className="w-full md:w-1/2 flex flex-col overflow-hidden">
          <button onClick={() => setIsPendingOpen(!isPendingOpen)} className="w-full flex justify-between items-center p-4">
            <h3 className="font-extrabold text-slate-700 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500"/> Pendientes ({pendingJobsList.length})</h3>
            {isPendingOpen ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
          </button>
          {isPendingOpen && <div className="flex flex-col gap-4 p-4 pt-0">{pendingJobsList.map(j => renderActiveJobCard(j))}</div>}
        </div>
      </div>

      <div className="mt-10">
          <h3 className="font-extrabold text-slate-700 mb-4 border-b-2 pb-2">Finalizados de Hoy ({todayHistoryJobs.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">{todayHistoryJobs.map(j => renderHistoryJobCard(j))}</div>
      </div>

      {/* MODALES */}
      {jobToFail && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleFailJob(jobToFail, e.target.reason.value); }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-extrabold">¿Motivo del fallo?</h3>
            <textarea name="reason" required className="w-full border-2 p-3 rounded-xl font-bold text-sm" rows="3"></textarea>
            <div className="flex gap-3"><button type="button" onClick={()=>setJobToFail(null)} className="flex-1 py-2 bg-slate-100 rounded-xl">Volver</button><button type="submit" className="flex-[2] py-2 bg-red-600 text-white rounded-xl">Confirmar</button></div>
          </form>
        </div>
      )}
      
      {/* MODAL DE RECHAZO PRT */}
      {prtPromptJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={(e) => { e.preventDefault(); updatePhase(prtPromptJob, 'prt_done', { prt_result: 'rechazado', prt_reason: e.target.reason.value }); setPrtPromptJob(null); }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl border-t-8 border-red-500">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-1.5"><XCircle className="text-red-500"/> Motivo del Rechazo PRT</h3>
            <textarea name="reason" required placeholder="Escribe por qué rechazaron el vehículo en la planta..." className="w-full border-2 p-3 rounded-xl font-bold text-sm outline-none focus:border-red-500" rows="3"></textarea>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setPrtPromptJob(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-sm text-slate-600 transition-colors">Cancelar</button>
              <button type="submit" className="flex-[2] py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors">Guardar Rechazo</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE TRASPASO A COMPAÑERO */}
      {relayPromptJob && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 border border-slate-100">
            <button type="button" onClick={() => setRelayPromptJob(null)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-700"/></button>
            <h3 className="text-xl font-black text-slate-800 mb-1">Traspaso a Compañero</h3>
            <p className="text-xs font-bold text-slate-500 mb-5">Pide al otro conductor que escanee este código con la cámara de su celular para entregarle el auto.</p>
            
            <div className="bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-inner inline-block">
              <img src={`https://quickchart.io/qr?size=250&margin=1&text=${encodeURIComponent(`${window.location.origin}/?relay=${relayPromptJob.id}`)}`} alt="QR Relevo" className="w-48 h-48 mx-auto" />
            </div>
            
            <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">O envíale el link por WhatsApp:</p>
              <button onClick={() => {
                 const link = `${window.location.origin}/?relay=${relayPromptJob.id}`;
                 const text = `🔑 Toma mi relevo del vehículo ${relayPromptJob.plate || relayPromptJob.vin} abriendo este link: ${link}`;
                 window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }} className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-sm shadow-md transition-colors flex justify-center items-center gap-2"><Share2 className="w-4 h-4"/> Enviar Link a Compañero</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CIERRE FORZADO (ADMIN) */}
      {forceCloseJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col max-h-[80vh] animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-500"/> Asignar y Finalizar</h3>
                 <button onClick={()=>setForceCloseJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4"/></button>
              </div>
              <p className="text-sm font-bold text-slate-500 mb-4 pb-4 border-b border-slate-100">Selecciona al conductor que realizó este traslado. El acta se cerrará automáticamente a su nombre (como entrega sin recepción).</p>
              
              <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                 {drivers.map(d => (
                    <button key={d.id} onClick={async () => {
                       showConfirm(`¿Guardar el traslado de la patente ${forceCloseJob.plate || forceCloseJob.vin} a nombre de ${d.name}?`, async () => {
                          try {
                             const mockChecklist = {
                                client: forceCloseJob.client || '', brand: forceCloseJob.brand || '', model: forceCloseJob.model || '', 
                                plateOrVin: forceCloseJob.plate || forceCloseJob.vin || '', origin: forceCloseJob.origin || '', 
                                destination: forceCloseJob.destination || '', fuelLevel: 50, photos: {}, docs: {}, 
                                observations: 'Sin observaciones registradas.', 
                                receiverName: 'ENTREGA SIN RECEPCIÓN', receiverRut: 'N/A', noReception: true, signatureData: null, 
                                assignedDriverName: d.name
                             };
                             await updateDoc(doc(db, 'transport_jobs', forceCloseJob.id), {
                                status: 'completed',
                                completedAt: Date.now(),
                                acceptedByEmail: d.email,
                                assignedDrivers: [{id: d.id, name: d.name, email: d.email}],
                                assignedEmails: [d.email],
                                checklist: mockChecklist,
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

      {dupPromptJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 border-t-8 border-purple-500">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Repeat className="w-5 h-5 text-purple-600"/> Nuevo Traslado</h3>
                 <button onClick={()=>setDupPromptJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-4 h-4"/></button>
              </div>
              <div className="space-y-2">
                 <button onClick={() => setDupMode('clone')} className={`w-full text-left p-3 rounded-xl border-2 font-extrabold ${dupMode === 'clone' ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-slate-100 text-slate-700'}`}>Clonar Exactamente Igual</button>
                 <button onClick={() => setDupMode('return')} className={`w-full text-left p-3 rounded-xl border-2 font-extrabold ${dupMode === 'return' ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-slate-100 text-slate-700'}`}>Retornar al Origen</button>
                 <button onClick={() => { setDupMode('continue'); setDupDestination(''); }} className={`w-full text-left p-3 rounded-xl border-2 font-extrabold ${dupMode === 'continue' ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-slate-100 text-slate-700'}`}>Continuar a Otro Destino</button>
                 {dupMode === 'continue' && (
                    <input type="text" placeholder="Escribe el nuevo destino..." value={dupDestination} onChange={e=>setDupDestination(e.target.value)} className="w-full border-2 border-purple-300 p-3 rounded-xl mt-2 font-bold outline-none focus:border-purple-500"/>
                 )}
              </div>
              <button onClick={executeDuplicate} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-xl font-black shadow-md transition-colors">Crear Traslado</button>
              <button onClick={()=>setDupPromptJob(null)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors">Cancelar</button>
           </div>
        </div>
      )}

           {showBulkSign && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] border-t-8 border-emerald-500">
              <div className="flex justify-between mb-4">
                 <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-emerald-600" /> Firma Masiva
                 </h3>
                 <button onClick={()=>setShowBulkSign(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button>
              </div>
              <div className="overflow-y-auto space-y-4 flex-1">
                 <div className="bg-slate-50 border p-3 rounded-xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Selecciona los vehículos a entregar:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                       {inProgressJobsList.length === 0 ? (
                          <p className="text-xs font-bold text-slate-400 text-center">No hay vehículos en curso.</p>
                       ) : (
                          inProgressJobsList.map(j => (
                             <label key={j.id} className="flex items-center gap-3 p-3 border rounded-xl bg-white cursor-pointer hover:bg-slate-50">
                                <input type="checkbox" className="w-4 h-4 accent-emerald-600" checked={bulkSelectedIds.includes(j.id)} onChange={e => e.target.checked ? setBulkSelectedIds([...bulkSelectedIds, j.id]) : setBulkSelectedIds(bulkSelectedIds.filter(id => id !== j.id))}/>
                                <div className="text-xs font-black text-slate-700">
                                   {getJobIdentifier(j)} - {j.tripType === 'simple' ? j.description : `${j.brand} ${j.model}`}
                                </div>
                             </label>
                          ))
                       )}
                    </div>
                 </div>
                 <input type="text" placeholder="Nombre del Receptor" value={bulkReceiverName} onChange={e=>setBulkReceiverName(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                 <input type="text" placeholder="RUT Receptor" value={bulkReceiverRut} onChange={e=>setBulkReceiverRut(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                 <div className="border-2 rounded-xl overflow-hidden">
                    <SignaturePad onSave={d=>setBulkSignature(d)} onClear={()=>setBulkSignature(null)}/>
                 </div>
              </div>
              <button onClick={handleBulkSignSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black mt-4 shadow-md transition-colors">Finalizar Flota</button>
           </div>
        </div>
      )}
    </div>
  );
}


