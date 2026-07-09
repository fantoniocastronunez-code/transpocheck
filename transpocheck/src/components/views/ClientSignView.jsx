 import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { 
  Clock, XCircle, CheckCircle, Download, Camera, 
  X, AlertCircle, User 
} from 'lucide-react';
import SignaturePad from '../ui/SignaturePad';
import LicensePlateBadge from '../ui/LicensePlateBadge';

export default function ClientSignView({ jobId, db }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', rut: '', comments: '', signature: null });
  const [fullScreenImage, setFullScreenImage] = useState(null); 
  const [alertMessage, setAlertMessage] = useState(null); 
  const [isDownloading, setIsDownloading] = useState(false); 

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'transport_jobs', jobId), (docSnap) => {
      if (docSnap.exists()) {
        setJob({ id: docSnap.id, ...docSnap.data() });
      } else {
        setJob(null);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setAlertMessage("Error de conexión: " + error.message);
      setLoading(false);
    });
    return () => unsub();
  }, [jobId, db]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400"><Clock className="w-5 h-5 mr-2 animate-spin"/> Cargando acta...</div>;
  
  if (!job) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-bold text-red-500"><XCircle className="w-12 h-12 mb-4 text-red-400"/>Acta no encontrada.<br/><span className="text-sm text-slate-400 mt-2">Verifica el link o escanea nuevamente.</span></div>;
  
  if (!job.checklist) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-bold text-slate-600"><Clock className="w-12 h-12 mb-4 text-blue-500 animate-spin mx-auto"/>Sincronizando datos...<br/><span className="text-sm text-slate-400 mt-2">Esperando a que el celular del conductor termine de enviar las fotografías. No cierres esta pantalla, la firma aparecerá automáticamente.</span></div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.signature) return setAlertMessage("Por favor, firme en el recuadro blanco."); 
    
    try {
      const updatedChecklist = {
        ...job.checklist,
        clientSigned: true,
        receiverName: formData.name || '',
        receiverRut: formData.rut || '',
        clientComments: formData.comments || '',
        signatureData: formData.signature
      };

      await updateDoc(doc(db, 'transport_jobs', jobId), {
        checklist: updatedChecklist
      });
      
      setSubmitted(true);
    } catch (error) { 
      console.error("Firebase Error:", error); 
      setAlertMessage("Error al guardar la firma: " + error.message); 
    }
  };

  if (submitted || job.checklist.clientSigned) {
    const isFinished = job.status === 'completed' || job.status === 'failed';

    const handleDirectDownloadPDF = async () => {
      if (isDownloading) return;
      setIsDownloading(true);
      try {
        const jsPDFModule = await import('jspdf');
        const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
        const docPDF = new JsPDFClass();

        const cleanStr = (str) => { if (!str) return ''; return String(str).replace(/➔/g, '->').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); };
        const fetchImageAsBase64 = async (url) => {
          if (!url) return null;
          if (url.startsWith('data:image')) return url;
          try {
            const response = await fetch(url, { mode: 'cors' });
            const blob = await response.blob();
            const fileBlob = new Blob([blob], { type: blob.type.includes('image') ? blob.type : 'image/jpeg' });
            return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(fileBlob); });
          } catch (e) { return null; }
        };
        const getImageDims = (src) => new Promise(resolve => { const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => resolve({ w: img.width, h: img.height }); img.onerror = () => resolve({ w: 85, h: 60 }); img.src = src; });
        const loadSimpleLogo = async (src) => { return new Promise((resolve) => { const img = new Image(); img.src = src; img.crossOrigin = "Anonymous"; img.onload = () => { const tempCanvas = document.createElement('canvas'); tempCanvas.width = img.width; tempCanvas.height = img.height; const ctx = tempCanvas.getContext('2d'); ctx.drawImage(img, 0, 0, img.width, img.height); resolve({ data: tempCanvas.toDataURL('image/png'), w: img.width, h: img.height }); }; img.onerror = () => resolve(null); setTimeout(() => resolve(null), 1500); }); };
        
        const photos = job.checklist?.photos || {};
        const otherPhotoKeys = Object.keys(photos).filter(k => k !== 'front' && typeof photos[k] === 'string' && photos[k]);

        const [logoApp, logoLogistica, frontPhotoStr, signatureStr, ...preloadedOtherPhotos] = await Promise.all([
          loadSimpleLogo('/logo.png'),
          loadSimpleLogo('/LogoLogistica.png'),
          fetchImageAsBase64(photos.front),
          fetchImageAsBase64(job.checklist?.signatureData),
          ...otherPhotoKeys.map(async (key) => {
             const base64Img = await fetchImageAsBase64(photos[key]);
             if (!base64Img) return null;
             const dims = await getImageDims(base64Img);
             return { key, base64Img, dims };
          })
        ]);

        const primaryColor = [30, 41, 59]; const secondaryColor = [100, 116, 139]; const accentColor = [37, 99, 235]; const lightBg = [248, 250, 252]; const borderColor = [226, 232, 240];

        const drawHeader = (titleText) => {
          docPDF.setFillColor(...primaryColor); docPDF.rect(0, 0, 210, 40, 'F');
          docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(18); docPDF.setFont("helvetica", "bold");
          docPDF.text(cleanStr(titleText), 105, 18, null, null, "center");
          const dateTxt = job.scheduledDate ? job.scheduledDate.split('-').reverse().join('/') : '-';
          docPDF.setFontSize(9); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(148, 163, 184);
          docPDF.text(`FECHA TRASLADO: ${dateTxt}`, 105, 26, null, null, "center");
          docPDF.setFontSize(11); docPDF.setFont("times", "bolditalic"); docPDF.setTextColor(255, 255, 255);
          if (logoLogistica) { const ratio = logoLogistica.h / logoLogistica.w; let imgW = 35; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoLogistica.data, 'PNG', 27 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("Logística TS SpA", 27, 34, null, null, "center"); }
          if (logoApp) { const ratio = logoApp.h / logoApp.w; let imgW = 20; let imgH = imgW * ratio; if (imgH > 24) { imgH = 24; imgW = imgH / ratio; } docPDF.addImage(logoApp.data, 'PNG', 183 - (imgW/2), 19 - (imgH/2), imgW, imgH); docPDF.text("LogisticAPP", 183, 34, null, null, "center"); }
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

        if (frontPhotoStr) { try { const dims = await getImageDims(frontPhotoStr); const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; } const rightX = 115; const rightY = startY + 6; docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" }); try { docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH); } catch(e){docPDF.addImage(frontPhotoStr, 'PNG', rightX, rightY + 2, imgW, imgH);} } catch (err) {} }

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
        setIsDownloading(false);
      } catch (error) {
        console.error("Error crítico generando PDF en Portal:", error);
        alert("Hubo un error al descargar el PDF. Verifica tu conexión a internet e intenta de nuevo.");
        setIsDownloading(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className={`bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border-t-8 transition-colors duration-500 ${isFinished ? 'border-green-500' : 'border-blue-500'}`}>
          {isFinished ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-in zoom-in"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">¡Traslado Finalizado!</h2>
              <p className="text-slate-500 font-bold text-sm mb-6">El conductor ha cerrado el acta. Ya puedes descargar tu copia del checklist.</p>
              
              <button onClick={handleDirectDownloadPDF} disabled={isDownloading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isDownloading ? <Clock className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5"/>} 
                {isDownloading ? "Generando PDF..." : "Descargar PDF"}
              </button>
            </>
          ) : (
            <>
              <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse"/>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Firma Recibida</h2>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4 mb-4">
                <p className="text-blue-700 font-bold text-sm flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin"></span>
                  A LA ESPERA DE TERMINAR EL CHECKLIST
                </p>
              </div>
              <p className="text-xs text-slate-400">Esta pantalla se actualizará automáticamente con el botón de descarga cuando el conductor finalice en su sistema.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const photos = job.checklist.photos || {};
  const hasPhotos = Object.values(photos).some(val => typeof val === 'string');

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      <header className="bg-blue-600 text-white p-4 shadow-md text-center">
        <h1 className="font-black text-xl tracking-wide">Acta de Recepción</h1>
      </header>

      <main className="max-w-md mx-auto p-4 pt-6 space-y-6">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
             <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-1">Vehículo a recibir</p>
             <h2 className="text-xl sm:text-2xl font-black text-slate-800">{job.brand} {job.model}</h2>
          </div>
          <LicensePlateBadge text={job.plate || job.vin} />
        </div>

        {hasPhotos && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-800 mb-1 flex items-center gap-2"><Camera className="w-4 h-4 text-blue-500"/> Registro Fotográfico</h3>
            <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wide">Toca una foto para ampliarla</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(photos).map(([key, val]) => val && typeof val === 'string' && (
                 <img key={key} src={val} alt="Evidencia" onClick={() => setFullScreenImage(val)} className="w-full h-20 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all" />
              ))}
            </div>
          </div>
        )}

        {fullScreenImage && (
          <div className="fixed inset-0 bg-slate-900/95 z-[200] flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
            <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors shadow-lg">
              <X className="w-6 h-6" />
            </button>
            <img src={fullScreenImage} alt="Evidencia Ampliada" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
           <h3 className="text-sm font-extrabold text-slate-800 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-blue-500"/> Tus Datos de Recepción</h3>
           <input required type="text" placeholder="Nombre Completo" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500" />
           <input required type="text" placeholder="RUT" value={formData.rut} onChange={e=>setFormData({...formData, rut: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500" />
           
           <h3 className="text-sm font-extrabold text-slate-800 pt-2 border-t border-slate-100">Comentarios (Opcional)</h3>
           <textarea placeholder="¿Alguna observación sobre el estado del vehículo al recibirlo?" value={formData.comments} onChange={e=>setFormData({...formData, comments: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[80px]" />

           <h3 className="text-sm font-extrabold text-slate-800 pt-2 border-t border-slate-100">Firma Digital</h3>
           <div className="relative mt-1">
             {formData.signature && <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 z-10 shadow-sm"><CheckCircle className="w-3 h-3"/> CAPTURADA</div>}
             <SignaturePad initialData={formData.signature} onSave={d=>setFormData({...formData, signature: d})} onClear={()=>setFormData({...formData, signature: null})} />
           </div>

           <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-200 transition-colors mt-4 text-lg">Confirmar y Enviar Acta</button>
        </form>
      </main>

      {alertMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-full"><AlertCircle className="w-6 h-6 text-blue-600"/></div>
              <h3 className="text-xl font-extrabold text-slate-800">LOGISTICAPP / LOGÍSTICA TS</h3>
            </div>
            <p className="text-slate-600 font-bold mb-6 text-sm">{alertMessage}</p>
            <button onClick={() => setAlertMessage(null)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md transition-colors hover:bg-blue-700">Aceptar</button>
          </div>
        </div>
      )}

    </div>
  );
}
