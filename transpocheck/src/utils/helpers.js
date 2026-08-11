// src/utils/helpers.js

export const DEFAULT_CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];

export const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

export const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;

export const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

export const resizeImage = (file, maxWidth = 1280, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    // 1. Método de Respaldo Clásico (Por si es un iPhone/Safari muy antiguo)
    const runFallback = () => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    };

    // 2. Método Ultra-Rápido con Web Workers y Aceleración de Hardware
    if (window.Worker && window.OffscreenCanvas) {
      try {
        const workerCode = `
          self.onmessage = async function(e) {
            try {
              const { file, maxWidth, quality } = e.data;
              const bitmap = await createImageBitmap(file);
              let width = bitmap.width;
              let height = bitmap.height;
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
              const canvas = new OffscreenCanvas(width, height);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(bitmap, 0, 0, width, height);
              
              const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = () => self.postMessage({ result: reader.result });
            } catch (err) {
              self.postMessage({ error: err.message });
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = (e) => {
          if (e.data.error) runFallback();
          else resolve(e.data.result);
          worker.terminate(); // Mata el proceso secundario para liberar RAM
        };
        
        worker.onerror = () => { runFallback(); worker.terminate(); };
        worker.postMessage({ file, maxWidth, quality });
      } catch(e) {
        runFallback();
      }
    } else {
      runFallback();
    }
  });
};

// ==============================================================
// LÓGICA CENTRALIZADA PARA LOGISTICAPP (TARJETAS, TEXTOS Y PDFS)
// ==============================================================

export const analyzeJobStatus = (job) => {
  const isRequested = job?.status === 'requested';
  const isPending = job?.status === 'pending';
  const isAccepted = job?.status === 'accepted' || job?.status === 'pending_guide';
  const isPendingGuide = job?.status === 'pending_guide';
  const phase = job?.phase || 'claimed'; 
  const step2Done = isAccepted && ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
  const step3Done = isAccepted && ['arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
  const step4Done = isAccepted && ['prt_done', 'arrived_destination'].includes(phase);
  
  return { isRequested, isPending, isAccepted, isPendingGuide, phase, step2Done, step3Done, step4Done };
};

export const generateStandardFileName = (job, dateStr, identifier) => {
  const safeDate = (dateStr || '').replace(/\//g, '-');
  const safeClient = (job?.client || 'SinCliente').replace(/[^\w\s-]/g, '');
  return `Check.${safeDate}.${safeClient}.${identifier}.pdf`;
};

export const getRouteStr = (j) => {
  if (j.tripType === 'revision') {
    const rtStat = j.checklist?.rtStatus || j.prt_result;
    const manualDest = j.destination?.includes('->') 
                    ? j.destination.split('->')[j.destination.split('->').length - 1].trim() 
                    : null;
    
    const ret = manualDest 
       ? manualDest 
       : (j.checklist?.rtReturnOption === 'other' && j.checklist?.rtReturnDestination
          ? j.checklist.rtReturnDestination 
          : (j.checklist?.rtReturnOption === 'origin' ? j.origin : (j.destination && !j.destination.toLowerCase().includes('prt') ? j.destination : j.origin)));

    if (rtStat === 'aprobado' || rtStat === 'aprobado_ayuda') {
        return `${j.origin || '-'} ➔ PRT ➔ ${ret || '-'}`;
    }
    if (rtStat === 'rechazado') {
        return `${j.origin || '-'} ➔ PRT (Rechazada) ➔ ${ret || '-'}`;
    }
    return `${j.origin || '-'} ➔ Planta de Revisión (PRT)`;
  }
  let route = j.origin || '';
  if (j.waypoints && j.waypoints.length > 0) route += ` ➔ ${j.waypoints.join(' ➔ ')}`;
  if (j.destination) route += ` ➔ ${j.destination}`;
  return route;
};

export const getExtraWappTxt = (j) => {
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

export const generateWhatsAppText = (job, dateShort, identifier) => {
  let text = job.tripType === 'simple' 
    ? `${dateShort}\n${job.client || 'Sin Cliente'}\n📌 TAREA: ${job.description || 'Servicio en Terreno'}\n🚗 VEHÍCULO: ${identifier}\n📍 LUGAR: ${getRouteStr(job)}${getExtraWappTxt(job)}`
    : `${dateShort}\n${job.client || 'Sin Cliente'}\n${job.brand || '-'} ${job.model || '-'}\n${identifier}\n${getRouteStr(job)}${getExtraWappTxt(job)}`; 
  
  if (job.status === 'failed') {
    text = `❌ TRASLADO FALLIDO\nMotivo: ${job.failedReason || 'No especificada'}\n\n${text}`;
  } else if (job.tripType === 'revision') {
    if (job.checklist?.rtStatus === 'aprobado') {
       text = `✅ APROBADO (LEGAL)\n\n${text}`;
    } else if (job.checklist?.rtStatus === 'aprobado_ayuda') {
       text = `🤝 APROBADO (CON AYUDA)\n\n${text}`;
    }
  }
  return text;
};