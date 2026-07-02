import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { CheckCircle, Clock, FileDown, Navigation, MapPin, X, Search, LogOut, Sun, Moon } from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';
import WaitTimerBadge from '../ui/WaitTimerBadge';
import SignaturePad from '../ui/SignaturePad';
import { formatDateDisplay } from '../../utils/helpers';

export default function TrackingView({ clientName, db, onBack, onLogout, darkMode, setDarkMode }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null); 
  
  // NUEVO: Atrapa el ID del trabajo desde la URL si viene desde el correo
  const [trackId, setTrackId] = useState(() => new URLSearchParams(window.location.search).get('track')); 

  useEffect(() => {
    const q = query(collection(db, 'transport_jobs'), where('client', '==', clientName));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setJobs(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Error al leer traslados", err);
      setLoading(false);
    });
    return () => unsub();
  }, [clientName, db]);

  const handleDownloadPDF = async (job) => {
    if (!job.checklist && job.status !== 'failed') return alert("Este traslado no tiene un checklist registrado.");
    try {
      setDownloadingId(job.id); 
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
          return await new Promise(resolve => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(fileBlob); });
        } catch (e) { return null; }
      };
      // NUEVO MOTOR QUE REPARA LA ORIENTACIÓN EXIF DE LOS CELULARES
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
            // Esto devuelve la foto "horneada" en su orientación real (horizontal o vertical)
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
        const dateTxt = typeof formatDateDisplay === 'function' && job.scheduledDate ? formatDateDisplay(job.scheduledDate) : (job.scheduledDate || '-');
        docPDF.setFontSize(9); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(148, 163, 184);
        docPDF.text(`FECHA TRASLADO: ${dateTxt}`, 105, 26, null, null, "center");
        docPDF.setFontSize(11); docPDF.setFont("times", "bolditalic"); docPDF.setTextColor(255, 255, 255);
        if (logoLogistica) { const ratio = logoLogistica.h / logoLogistica.w; let imgW = 35; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("Logística TS SpA", 27, 34, null, null, "center"); }
        if (logoApp) { const ratio = logoApp.h / logoApp.w; let imgW = 20; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("LogisticAPP", 183, 34, null, null, "center"); }
        docPDF.setFont("helvetica", "normal");
      };

      let pdfTitle = job.tripType === 'revision' ? "CERTIFICADO DE REVISION TECNICA" : (job.tripType === 'viaje' ? "TRASLADO A REGIONES" : "CHECKLIST DE TRASLADO");
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
      const drawSectionTitle = (title, y) => { docPDF.setFillColor(...lightBg); docPDF.rect(15, y - 6, leftColWidth, 10, 'F'); docPDF.setDrawColor(...accentColor); docPDF.setLineWidth(1); docPDF.line(15, y - 6, 15, y + 4); docPDF.setTextColor(...primaryColor); docPDF.setFontSize(10); docPDF.setFont("helvetica", "bold"); docPDF.text(cleanStr(title).toUpperCase(), 20, y+1); return y + 10; };
      const drawKV = (label, value, x, y, maxW = 40) => { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(cleanStr(label).toUpperCase(), x, y); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const splitValue = docPDF.splitTextToSize(cleanStr(value), maxW); docPDF.text(splitValue, x, y + 4); return splitValue.length * 4; };

      let driverNameStr = job.checklist?.assignedDriverName || job.acceptedByEmail || "Conductor";
      if (job.assignedDrivers && job.assignedDrivers.length > 0) { const found = job.assignedDrivers.find(d => d.email === job.acceptedByEmail); if (found) driverNameStr = found.name; }

      currentY = drawSectionTitle("1. Detalles del Vehiculo", currentY);
      let hC = drawKV("Cliente", `${job.client || 'Sin Cliente'}`, 15, currentY, 45);
      let hM = drawKV("Marca y Modelo", `${job.brand || '-'} ${job.model || '-'}`, 65, currentY, 45);
      currentY += Math.max(hC, hM) + 6;

      let plateText = job.plate || '-'; if (job.vin && job.vin !== job.plate) { plateText += ` / VIN: ${job.vin}`; }
      let hP = drawKV("Patente / VIN", plateText, 15, currentY, 45);
      let hD = drawKV("Conductor", driverNameStr, 65, currentY, 45);
      currentY += Math.max(hP, hD) + 6;
      
      let routeText = `${job.origin || '-'}  ->  ${job.destination || '-'}`;
      if (job.tripType === 'revision') { if (job.checklist?.rtStatus === 'aprobado') { const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin; routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`; } else if (job.checklist?.rtStatus === 'rechazado') { routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`; } else { routeText = `${job.origin || '-'}  ->  PRT`; } }
      let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
      currentY += routeH + 8;

      currentY = drawSectionTitle("2. Recepcion y Estado", currentY);
      const getDocStatus = (docKey) => { const isOk = job.checklist?.docs?.[docKey]; const expDate = job.checklist?.docsExpiry?.[docKey]; if (!isOk) return 'FALTA'; if (expDate) { const [y, m, d] = expDate.split('-'); return `AL DIA (Vence: ${d}/${m}/${y})`; } return 'AL DIA'; };
      let hFuel = drawKV("Combustible", `${job.checklist?.fuelLevel || '0'}%`, 15, currentY, 45);
      let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
      currentY += Math.max(hFuel, hSoap) + 6;
      let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
      let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
      currentY += Math.max(hPerm, hRev) + 6;
      let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
      currentY += hGas + 8;

      docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("OBSERVACIONES:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth); docPDF.text(obsSplit, 15, currentY + 4); currentY += (obsSplit.length * 4) + 6;
      if (job.waitTimeMinutes && job.waitTimeMinutes > 20) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38); const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA EN ORIGEN: ${job.waitTimeMinutes} minutos`, leftColWidth); docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2; } else if (job.checklist?.hasWaitTime) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);  const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);  docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;  }
      if (job.checklist?.hasFuelCharge) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235); const fcStr = docPDF.splitTextToSize(`CARGA DE COMBUSTIBLE: ${cleanStr(job.checklist.fuelChargeAmount || 'Sí')}`, leftColWidth); docPDF.text(fcStr, 15, currentY); currentY += (fcStr.length * 4) + 2; }
      currentY += 8; 

      let sectionNum = 3;
      if (job.tripType === 'revision') { currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY); if (job.checklist?.rtStatus === 'aprobado') { docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); docPDF.text("APROBADO", 15, currentY + 6); currentY += 18; } else { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); docPDF.text("RECHAZADO", 15, currentY + 6); docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27); const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth); docPDF.text(rejSplit, 15, currentY + 12); currentY += 20 + (rejSplit.length * 4); } sectionNum++; }

      currentY = drawSectionTitle(`${sectionNum}. Conformidad Entrega`, currentY);
      if (job.checklist?.noReception) { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(9); const nrSplit = docPDF.splitTextToSize("ENTREGA SIN RECEPCION (Confirmada por conductor en terreno)", leftColWidth); docPDF.text(nrSplit, 15, currentY + 4); currentY += (nrSplit.length * 4) + 6; } else { drawKV("Receptor", `${job.checklist?.receiverName || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; drawKV("RUT", `${job.checklist?.receiverRut || 'N/A'}`, 15, currentY, leftColWidth); currentY += 12; if (job.checklist?.clientComments) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("COMENTARIOS:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const commSplit = docPDF.splitTextToSize(cleanStr(job.checklist.clientComments), leftColWidth); docPDF.text(commSplit, 15, currentY + 4); currentY += (commSplit.length * 4) + 6; } 
        if(signatureStr) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("FIRMA DE CONFORMIDAD:", 15, currentY); try { docPDF.addImage(signatureStr, 'JPEG', 15, currentY + 2, 45, 25); } catch(e){ try{docPDF.addImage(signatureStr, 'PNG', 15, currentY + 2, 45, 25);}catch(err){} } currentY += 30; } 
      }
      
      if (job.checklist?.location) { currentY += 2; const { lat, lng } = job.checklist.location; docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(`UBICACION GPS:`, 15, currentY); docPDF.setFontSize(9); docPDF.setTextColor(...accentColor); docPDF.textWithLink('Clic aqui para ver mapa en Google', 15, currentY + 4, { url: `https://maps.google.com/?q=${lat},${lng}` }); }

      if (frontPhotoObj) { 
        try { 
          const dims = { w: frontPhotoObj.w, h: frontPhotoObj.h }; 
          const frontPhotoStr = frontPhotoObj.data;
          const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; } const rightX = 115; const rightY = startY + 6; docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" }); try { docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH); } catch(e){docPDF.addImage(frontPhotoStr, 'PNG', rightX, rightY + 2, imgW, imgH);} 
        } catch (err) {} 
      }

      const addFooter = () => { const pageCount = docPDF.internal.getNumberOfPages(); for(let i = 1; i <= pageCount; i++) { docPDF.setPage(i); docPDF.setFontSize(8); docPDF.setTextColor(148, 163, 184); docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center"); } }

      if (preloadedOtherPhotos.length > 0) {
        const labels = { left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', interior_front: 'Int. Adelante', interior_back: 'Int. Atras', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4', det5: 'Detalle 5', det6: 'Detalle 6', det7: 'Detalle 7', det8: 'Detalle 8' };
        let photoY = 46; let currentCol = 1; let addedPage = false;
        for (const item of preloadedOtherPhotos) { 
          if (!item) continue;
          const { key, base64Img, dims } = item;
          if (!addedPage) { docPDF.addPage(); drawHeader("ANEXO FOTOGRAFICO"); addedPage = true; } 
          try { 
            const ratio = dims.h / dims.w; let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; } const slotCenter = currentCol === 1 ? 55 : 155; const finalX = slotCenter - (imgW / 2); if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); } docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text((labels[key] || key).toUpperCase(), slotCenter, photoY - 3, { align: "center" }); 
            try { docPDF.addImage(base64Img, 'JPEG', finalX, photoY + 2, imgW, imgH); } catch(e) { docPDF.addImage(base64Img, 'PNG', finalX, photoY + 2, imgW, imgH); }
            if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; } 
          } catch (err) {} 
        }
      }

      addFooter();
      const cleanPlate = job.plate || job.vin || 'SN';
      const dateStrForFile = (job.scheduledDate || new Date().toISOString().split('T')[0]).replace(/\//g, '-');
      const fileName = `Certificado.${dateStrForFile}.${(job.client || 'Cliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; 
      docPDF.save(fileName); 
      setDownloadingId(null);
    } catch (error) {
      console.error("Error crítico generando PDF en Portal:", error);
      alert("Hubo un error al descargar el PDF. Verifica tu conexión a internet e intenta de nuevo.");
      setDownloadingId(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  
  const [batchSignOpen, setBatchSignOpen] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ name: '', rut: '', comments: '', signature: null, selectedIds: [] });

  const branding = React.useMemo(() => {
    const name = (clientName || '').toUpperCase();
    if (name.includes('KOVACS')) return { primary: 'bg-red-600', text: 'text-red-600', fill: 'bg-red-500', light: 'bg-red-50' };
    if (name.includes('SALFA')) return { primary: 'bg-emerald-600', text: 'text-emerald-600', fill: 'bg-emerald-500', light: 'bg-emerald-50' };
    if (name.includes('GRANDLEASING')) return { primary: 'bg-slate-900', text: 'text-slate-800', fill: 'bg-slate-800', light: 'bg-slate-100' };
    if (name.includes('ENEX')) return { primary: 'bg-sky-600', text: 'text-sky-600', fill: 'bg-sky-500', light: 'bg-sky-50' };
    return { primary: 'bg-blue-600', text: 'text-blue-600', fill: 'bg-blue-500', light: 'bg-blue-50' };
  }, [clientName]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 p-4 pt-24 space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 max-w-2xl mx-auto h-32 flex flex-col items-center justify-center animate-pulse shadow-sm">
         <div className="w-14 h-14 bg-slate-200 rounded-2xl mb-3"></div>
         <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
         <div className="h-6 bg-slate-200 rounded w-1/2"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 h-48 animate-pulse shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start"><div className="h-5 bg-slate-200 rounded w-1/2"></div><div className="h-6 w-20 bg-slate-200 rounded-lg"></div></div>
            <div className="space-y-3"><div className="h-3 bg-slate-200 rounded w-3/4"></div><div className="h-3 bg-slate-200 rounded w-1/2"></div></div>
          </div>
        ))}
      </div>
    </div>
  );

  const filteredJobs = jobs.filter(j => {
    // NUEVO: Si hay un ID de rastreo activo, ocultamos el resto de la flota
    if (trackId && j.id !== trackId) return false;
    
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (j.plate || '').toLowerCase().includes(term) || 
           (j.brand || '').toLowerCase().includes(term) || 
           (j.model || '').toLowerCase().includes(term);
  });

  const activeJobs = filteredJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
  const historyJobs = filteredJobs.filter(j => j.status === 'completed' || j.status === 'failed').slice(0, 30);
  
  const pendingSignatureJobs = activeJobs.filter(j => j.checklist && !j.checklist.clientSigned);
  
  const initials = clientName ? clientName.substring(0, 2).toUpperCase() : 'CL';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10 transition-colors duration-300">
      <header className={`fixed-nav-bar ${branding.primary} text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20 transition-colors duration-300`}>
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="bg-white/20 p-1 sm:p-1.5 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo App" className="w-7 h-7 sm:w-12 sm:h-12 object-contain" />
          </div>
          
          <h1 className="font-alfa text-lg sm:text-3xl tracking-wide shrink-0 text-white" style={{ paddingTop: '2px' }}>
            LogisticAPP
          </h1>
          
          <div className="bg-white/20 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0 ml-0.5 sm:ml-1 overflow-hidden">
            <img src="/LogoLogistica.png" alt="Logística TS SpA" className="h-8 sm:h-15 object-contain" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {setDarkMode && (
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors shadow-sm border border-white/10">
              {darkMode ? <Sun className="w-5 h-5 text-yellow-300"/> : <Moon className="w-5 h-5 text-white"/>}
            </button>
          )}

          {onBack && (
            <button onClick={onBack} className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl text-sm font-bold text-white transition-colors border border-red-400 shadow-sm flex items-center gap-1.5 z-10 shrink-0 ml-2">
              <LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Volver</span>
            </button>
          )}
          {onLogout && (
            <button onClick={onLogout} className="bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-xl text-sm font-bold text-white transition-colors border border-slate-700 shadow-sm flex items-center gap-1.5 z-10 shrink-0 ml-2">
              <LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 space-y-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden max-w-2xl mx-auto">
          <div className={`absolute top-0 left-0 w-full h-1.5 ${branding.fill}`}></div>
          
          <div className="mx-auto w-36 h-36 rounded-[28px] flex items-center justify-center mb-4 shadow-md border overflow-hidden transition-all duration-300 p-3" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
             <img
               src={
                 (clientName || '').toUpperCase().includes('KOVACS') ? '/logos/kovacs.png' :
                 (clientName || '').toUpperCase().includes('SALFA') ? '/logos/salfa.png' :
                 (clientName || '').toUpperCase().includes('GRANDLEASING') ? '/logos/grandleasing.png' :
                 (clientName || '').toUpperCase().includes('ENEX') ? '/logos/enex.png' :
                 `/logos/${clientName ? clientName.toLowerCase().replace(/[^a-z0-9]/g, '') : ''}.png`
               }
               alt={clientName}
               className="w-full h-full object-contain"
               onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
             />
             <div className={`w-full h-full flex items-center justify-center text-5xl font-black ${branding.text} ${branding.light} rounded-2xl`} style={{ display: 'none' }}>
               {initials}
             </div>
          </div>

          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-1">Portal de Seguimiento</h2>
             <p className="text-2xl font-black text-slate-800">{clientName}</p>
           </div>

           {/* NUEVO: BANNER DE VISTA FILTRADA */}
           {trackId && (
             <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in max-w-2xl mx-auto">
                <div>
                  <p className="text-xs font-black text-blue-800 uppercase tracking-widest text-left">Vista Filtrada</p>
                  <p className="text-sm font-bold text-blue-600 text-left">Mostrando solo el vehículo de la notificación.</p>
                </div>
                <button onClick={() => {
                   setTrackId(null);
                   window.history.replaceState({}, '', `${window.location.pathname}?client=${encodeURIComponent(clientName)}`);
                }} className="w-full sm:w-auto bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-colors whitespace-nowrap">
                   Ver toda mi flota
                </button>
             </div>
           )}

           {/* OCULTA EL BUSCADOR SI HAY UN FILTRO ACTIVO */}
           {!trackId && (
             <div className="relative max-w-2xl mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <input type="text" placeholder="Buscar por patente, marca o modelo..." className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
           )}

           {pendingSignatureJobs.length > 0 && (
          <div className="bg-blue-600 rounded-3xl p-5 shadow-xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in duration-300 border-4 border-blue-400 max-w-2xl mx-auto">
             <div>
               <h3 className="font-black text-xl flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-300"/> ¡Acción Requerida!</h3>
               <p className="font-bold text-blue-100 text-sm mt-1">Tienes {pendingSignatureJobs.length} vehículo(s) esperando tu firma de recepción.</p>
             </div>
             <button onClick={() => {
                setBatchFormData({ name: '', rut: '', comments: '', signature: null, selectedIds: pendingSignatureJobs.map(j => j.id) });
                setBatchSignOpen(true);
             }} className="w-full sm:w-auto bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-xl font-black shadow-md transition-colors whitespace-nowrap">
               Firmar Lote Completo
             </button>
          </div>
        )}

        <div>
          <h3 className="font-extrabold text-slate-700 mb-4 flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-600"/> Vehículos en Tránsito ({activeJobs.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeJobs.length === 0 ? (
               <p className="text-sm font-bold text-slate-400 bg-white p-4 rounded-2xl border text-center col-span-full">No se encontraron traslados activos.</p>
            ) : activeJobs.map(job => {
              const isPending = job.status === 'pending';
              const isAccepted = job.status === 'accepted';
              const phase = job.phase || 'claimed'; 
              
              const step2Done = isAccepted && ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
              const step3Done = isAccepted && ['arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
              const step4Done = isAccepted && phase === 'prt_done';

              return (
              <div key={job.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isPending ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
                <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">En Traslado</h2>
                    <p className="text-xl font-black text-slate-800 leading-none">{job.brand} {job.model}</p>
                  </div>
                  <LicensePlateBadge text={job.plate || job.vin} />
                </div>
                
                <div className="relative pl-8 space-y-6 flex-1 mt-2">
                  <div className="absolute top-2 bottom-4 left-[11px] w-0.5 bg-slate-100 rounded-full"></div>
                  <div className="absolute top-2 left-[11px] w-0.5 bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                       style={{ height: step4Done ? '100%' : step3Done ? '66%' : step2Done ? '33%' : isAccepted ? '10%' : '0%' }}></div>

                  <div className="relative"><div className="absolute -left-8 bg-blue-500 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-transform duration-300 hover:scale-110"><CheckCircle className="w-3 h-3 text-white"/></div><p className="font-extrabold text-slate-800 text-sm">{isAccepted ? (job.assignedDrivers?.find(d => d.email === job.acceptedByEmail)?.name || "Conductor en camino") : "Buscando conductor..."}</p><p className="text-xs font-bold text-slate-500 mt-0.5">{isAccepted ? `Responsable del retiro en ${job.origin}` : `Esperando asignación para ${job.origin}`}</p></div>
                  
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step2Done ? 'bg-blue-500 scale-110' : (phase === 'arrived_pickup' ? 'bg-amber-400 scale-110' : 'bg-slate-200')}`}>{step2Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step2Done ? 'text-slate-800' : (phase === 'arrived_pickup' ? 'text-amber-600' : 'text-slate-400')}`}>{phase === 'arrived_pickup' ? 'Esperando entrega en origen...' : 'Vehículo en Tránsito'}</p><p className={`text-xs font-bold mt-0.5 transition-colors duration-500 ${step2Done ? 'text-blue-600' : (phase === 'arrived_pickup' ? 'text-amber-500' : 'text-slate-400')}`}>{step2Done ? 'El conductor tiene el vehículo en su poder' : (phase === 'arrived_pickup' ? 'El conductor ya está en el punto de retiro' : 'Esperando llegada del conductor')}</p></div>
                  
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step3Done ? 'bg-blue-500 scale-110' : 'bg-slate-200'}`}>{step3Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step3Done ? 'text-slate-800' : 'text-slate-400'}`}>{job.tripType === 'revision' ? 'En Planta de Revisión' : 'Llegada a Destino'}</p><p className={`text-xs font-bold mt-0.5 transition-colors duration-500 ${step3Done ? 'text-blue-600' : 'text-slate-400'}`}>{step3Done ? (job.tripType === 'revision' ? 'Realizando inspección técnica' : 'En proceso de entrega y checklist') : `Hacia ${job.tripType === 'revision' ? 'PRT' : job.destination}`}</p></div>
                  
                  {job.tripType === 'revision' && (
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step4Done ? (job.prt_result === 'rechazado' ? 'bg-red-500 scale-110' : 'bg-green-500 scale-110') : 'bg-slate-200'}`}>{step4Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step4Done ? (job.prt_result === 'rechazado' ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>Resultado de Revisión</p>{step4Done ? (<p className={`text-xs font-bold mt-0.5 ${job.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-600'}`}>{job.prt_result === 'rechazado' ? `Rechazado: ${job.prt_reason}` : 'Aprobado Exitosamente'}</p>) : (<p className="text-xs font-bold text-slate-400 mt-0.5">Esperando documento de la planta</p>)}</div>
                  )}

                  {job.tripType === 'revision' && step4Done && (
                  <div className="relative"><div className="absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 bg-blue-500 scale-110"><div className="w-2 h-2 bg-white rounded-full animate-ping"></div></div><p className="font-extrabold text-sm text-slate-800">Camino a destino</p><p className="text-xs font-bold text-blue-600 mt-0.5">El vehículo va en ruta a su destino final</p></div>
                  )}
                </div>

                {job.phase === 'arrived_pickup' && job.arrivedPickupAt && <WaitTimerBadge arrivedAt={job.arrivedPickupAt} role="client" />}

                {job.liveLocation && job.phase === 'picked_up' && (
                  <div className="mt-6 border-t border-slate-100 pt-5 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-blue-600 uppercase flex items-center gap-1.5"><Navigation className="w-4 h-4 animate-bounce"/> GPS en vivo</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Conectado</p>
                    </div>
                    <div className="w-full h-48 bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner relative pointer-events-none">
                      <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        src={`https://maps.google.com/maps?q=${job.liveLocation.lat},${job.liveLocation.lng}&z=15&output=embed`}
                      ></iframe>
                    </div>
                  </div>
                )}

              </div>
            )})}
          </div>
        </div>

        <div>
          <h3 className="font-extrabold text-slate-700 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600"/> Últimos Finalizados</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyJobs.length === 0 ? (
               <p className="text-sm font-bold text-slate-400 bg-white p-4 rounded-2xl border text-center col-span-full">No se encontraron resultados.</p>
            ) : historyJobs.map(job => {
              const isFailed = job.status === 'failed';
              return (
              <div key={job.id} className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative pl-4 overflow-hidden hover:shadow-md transition-shadow h-[120px]">
                <div className={`absolute top-0 left-0 bottom-0 w-2 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
                
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-black text-slate-800 leading-tight truncate pr-2">{job.brand} {job.model}</p>
                  <LicensePlateBadge text={job.plate || job.vin} />
                </div>
                
                <p className="text-slate-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-1 truncate opacity-90"><MapPin className="w-3.5 h-3.5 shrink-0"/> {job.origin} ➔ {job.tripType === 'revision' ? 'PRT' : job.destination}</p>
                
                <div className="flex justify-between items-end mt-auto pt-2 border-t border-slate-50">
                  <div>
                    <p className={`text-[11px] font-black uppercase ${isFailed ? 'text-red-500' : 'text-green-600'}`}>
                      {isFailed ? 'RECHAZADO' : 'ENTREGADO'}
                    </p>
                    <p className="text-slate-400 text-[9px] font-bold mt-0.5">{new Date(job.completedAt || job.createdAt).toLocaleDateString('es-CL')}</p>
                  </div>
                  <button onClick={() => handleDownloadPDF(job)} disabled={downloadingId === job.id} className="flex items-center justify-center p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100 disabled:opacity-50" title="Descargar PDF">
                    {downloadingId === job.id ? <Clock className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>
      </main>

      {batchSignOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-black text-slate-800">Firma de Recepción</h2>
                <p className="text-xs font-bold text-slate-500">Selecciona los vehículos a recepcionar</p>
              </div>
              <button onClick={() => setBatchSignOpen(false)} className="bg-white hover:bg-slate-200 p-2 rounded-full transition-colors shadow-sm border border-slate-200"><X className="w-5 h-5 text-slate-700"/></button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-2 border-b border-slate-100 pb-4">
                 {pendingSignatureJobs.map(j => (
                   <label key={j.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${batchFormData.selectedIds.includes(j.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <input type="checkbox" checked={batchFormData.selectedIds.includes(j.id)} onChange={(e) => {
                         const ids = e.target.checked ? [...batchFormData.selectedIds, j.id] : batchFormData.selectedIds.filter(id => id !== j.id);
                         setBatchFormData({...batchFormData, selectedIds: ids});
                      }} className="w-6 h-6 accent-blue-600 rounded cursor-pointer shrink-0"/>
                      <div className="flex-1">
                         <p className="font-extrabold text-sm text-slate-800 leading-tight">{j.brand} {j.model}</p>
                         <p className="font-bold text-xs text-blue-600 uppercase mt-0.5">{j.plate || j.vin}</p>
                      </div>
                   </label>
                 ))}
              </div>

              <form id="batch-sign-form" onSubmit={async (e) => {
                 e.preventDefault();
                 if (batchFormData.selectedIds.length === 0) return alert("Debes seleccionar al menos un vehículo.");
                 if (!batchFormData.signature) return alert("Por favor, dibuja tu firma en el recuadro blanco.");
                 
                 try {
                    await Promise.all(batchFormData.selectedIds.map(async (id) => {
                       const jobToUpdate = jobs.find(x => x.id === id);
                       if (!jobToUpdate) return;
                       const updatedChecklist = {
                          ...jobToUpdate.checklist,
                          clientSigned: true,
                          receiverName: batchFormData.name,
                          receiverRut: batchFormData.rut,
                          clientComments: batchFormData.comments,
                          signatureData: batchFormData.signature
                       };
                       await updateDoc(doc(db, 'transport_jobs', id), { checklist: updatedChecklist });
                    }));
                    setBatchSignOpen(false);
                    alert("¡Recepción masiva exitosa! Los conductores ya han sido notificados para cerrar el traslado.");
                 } catch (error) {
                    console.error(error);
                    alert("Error guardando la firma.");
                 }
              }} className="space-y-3">
                 <input required type="text" placeholder="Nombre de quien recibe" value={batchFormData.name} onChange={e=>setBatchFormData({...batchFormData, name: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 text-sm" />
                 <input required type="text" placeholder="RUT (Ej: 12.345.678-9)" maxLength="12" value={batchFormData.rut} onChange={(e)=>{ let val = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase(); if (val.length > 1) { const dv = val.slice(-1); const body = val.slice(0, -1); val = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv; } setBatchFormData({...batchFormData, rut: val}); }} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 text-sm" />
                 <textarea placeholder="Comentarios generales para el lote (Opcional)" value={batchFormData.comments} onChange={e=>setBatchFormData({...batchFormData, comments: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 h-16 text-sm" />
                 
                 <div className="pt-2">
                    <h3 className="text-xs font-extrabold text-slate-500 uppercase mb-2">Firma Digital (Aplica para todos)</h3>
                    <SignaturePad initialData={batchFormData.signature} onSave={d=>setBatchFormData({...batchFormData, signature: d})} onClear={()=>setBatchFormData({...batchFormData, signature: null})} />
                 </div>
              </form>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button type="submit" form="batch-sign-form" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-colors text-lg">Confirmar Lote ({batchFormData.selectedIds.length})</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

