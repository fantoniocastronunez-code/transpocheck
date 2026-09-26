// src/utils/helpers.js

export const DEFAULT_CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];

export const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

export const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;

export const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

export const getVehicleIdentifierLabel = (val) => {
  const cleanVal = val || '';
  if (cleanVal.length === 17) return `VIN: ${cleanVal}`;
  return `Patente: ${cleanVal || 'S/N'}`;
};


export const resizeAndWatermarkImage = (file, maxWidth = 1920, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const applyWatermark = (lat, lng) => {
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

          const dateStr = new Date().toLocaleString('es-CL');
          const locStr = lat ? `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}` : 'Ubicación no disponible';
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          const padding = 20;
          const fontSize = Math.max(16, Math.floor(width / 35));
          ctx.fillRect(0, height - (fontSize * 3 + padding), width, fontSize * 3 + padding);

          ctx.fillStyle = '#FFD700';
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(`FECHA: ${dateStr}`, padding, height - padding - fontSize * 1.5);
          ctx.fillText(`GPS: ${locStr}`, padding, height - padding);

          resolve({ base64: canvas.toDataURL('image/jpeg', quality), lat, lng });
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          applyWatermark(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          applyWatermark(null, null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      applyWatermark(null, null);
    }
  });
};
export const resizeImage = (file, maxWidth = 1920, quality = 0.85) => {
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
  
  if (j.tripType === 'revision' && j.checklist) {
    const rev = Number(j.checklist?.prtCostRevision || 0);
    const insp = Number(j.checklist?.prtCostInspeccion || 0);
    const frenos = Number(j.checklist?.prtCostFrenos || 0);
    const gases = Number(j.checklist?.prtCostGases || 0);
    const prtTotal = rev + insp + frenos + gases;
    
    if (prtTotal > 0) {
      t += `\nVALOR PRT TOTAL: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(prtTotal)}`;
      if (rev > 0) t += `\nRevisión: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(rev)}`;
      if (insp > 0) t += `\nInspección: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(insp)}`;
      if (frenos > 0) t += `\nFrenos: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(frenos)}`;
      if (gases > 0) t += `\nGases: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(gases)}`;
    }
  }

  if (j.tripType === 'revision' && j.rtData?.tipoB === 'inspeccion' && j.rtData?.motivoInspeccion) {
    t += `\nINSPECCIÓN VISUAL: ${j.rtData.motivoInspeccion}`;
  }

  return t;
};

export const generateWhatsAppText = (job, dateShort, identifier) => {
  let carInfo = '-';
  if (job.brand || job.model) {
    if (job.brand && !job.model) carInfo = `${job.brand} (falta modelo)`;
    else if (!job.brand && job.model) carInfo = job.model;
    else carInfo = `${job.brand} ${job.model}`;
  }
  
  let text = job.tripType === 'simple' 
    ? `${dateShort}\n${job.client || 'Sin Cliente'}\n📌 TAREA: ${job.description || 'Servicio en Terreno'}\n🚗 VEHÍCULO: ${identifier}\n📍 LUGAR: ${getRouteStr(job)}${getExtraWappTxt(job)}`
    : `${dateShort}\n${job.client || 'Sin Cliente'}\n${carInfo}\n${identifier}\n${getRouteStr(job)}${getExtraWappTxt(job)}`; 
  
  if (job.status === 'failed') {
    text = `❌ TRASLADO FALLIDO\nMotivo: ${job.failedReason || 'No especificada'}\n ${text}`;
  } else if (job.tripType === 'revision') {
    if (job.checklist?.rtStatus === 'aprobado') {
       text = `✅ APROBADO (LEGAL)\n ${text}`;
    } else if (job.checklist?.rtStatus === 'aprobado_ayuda') {
       text = `🤝 APROBADO (CON AYUDA)\n ${text}`;
    }
  }
  return text;
};

export const calculateDriverChecklistScore = (jobs, driverEmail, drivers = []) => {
  const completedJobs = jobs.filter(j => (j.status === 'completed' || j.phase === 'completed') && j.acceptedByEmail === driverEmail);
  
  if (completedJobs.length === 0) return { score: 0, grade: '1.0/10', tips: ['No hay suficientes trabajos para evaluar.'], totalJobs: 0 };
  
  const driverName = drivers.find(d => d.email === driverEmail)?.name || driverEmail;
  
  let totalFields = 0;
  let fieldsFilled = 0;
  
  let missingPhotos = 0;
  let missingSignatures = 0;
  
  let selfSignaturesCount = 0;
  let fastTransfersCount = 0;
  
  completedJobs.forEach(job => {
    const cl = job.checklist || {};
    
    // Check photos - Flexible: Maximo 4 fotos necesarias para tener puntaje perfecto
    let vehiclePhotos = 0;
    if (cl.photos) {
       Object.values(cl.photos).forEach(photo => {
          if (typeof photo === 'string' && photo.length > 50) vehiclePhotos++;
       });
    }
    totalFields += 4;
    fieldsFilled += Math.min(4, vehiclePhotos);
    if (vehiclePhotos < 4) missingPhotos += (4 - vehiclePhotos);
    
    // signature
    // Require signature unless the job is a failed revision
    if (job.status !== 'failed') {
       totalFields++;
       if (cl.signature) fieldsFilled++;
       else missingSignatures++;
       
       totalFields++;
       if (cl.receiverName && cl.receiverName.trim().length > 2) fieldsFilled++;
       else missingSignatures++;
       
       // Penalización 1: Firmar con su propio nombre
       if (cl.receiverName && driverName) {
          const rName = cl.receiverName.toLowerCase().trim();
          const dName = driverName.toLowerCase().trim();
          const isSelf = rName.length > 3 && dName.length > 3 && (rName.includes(dName.split(' ')[0]) || dName.includes(rName.split(' ')[0]));
          if (isSelf) selfSignaturesCount++;
       }
    }
    
    // Penalización 2: Traslados extremadamente cortos (< 5 minutos)
    const startMs = job.arrivedPickupAt || (job.timestamps && job.timestamps.arrivedPickupAt) || job.acceptedAt;
    const endMs = job.completedAt || (job.timestamps && job.timestamps.completedAt) || job.lastUpdatedAt;
    
    if (startMs && endMs) {
       const diffMins = (endMs - startMs) / (1000 * 60);
       if (diffMins > 0 && diffMins < 5) {
          fastTransfersCount++;
       }
    }
  });
  
  const completionPercentage = totalFields > 0 ? (fieldsFilled / totalFields) : 0;
  
  // Escala inicial X/10 (basada puramente en completitud)
  let scoreValue = completionPercentage * 10;
  
  // Aplicar penalizaciones
  // Resta hasta 3.0 puntos en total si siempre firman ellos mismos
  if (completedJobs.length > 0) {
      scoreValue -= (selfSignaturesCount / completedJobs.length) * 3;
      // Resta hasta 4.0 puntos en total si siempre hacen trabajos irrealmente rápidos
      scoreValue -= (fastTransfersCount / completedJobs.length) * 4;
  }
  
  // Limitar entre 1.0 y 10.0
  scoreValue = Math.max(1.0, Math.min(10.0, scoreValue));
  const grade = `${scoreValue.toFixed(1)}/10`;
  
  const tips = [];
  
  // Priorizar tips de malas prácticas primero
  if (selfSignaturesCount > 0) {
      tips.push('PENALIZACIÓN: No debes firmar con tu propio nombre en la recepción.');
  }
  if (fastTransfersCount > 0) {
      tips.push('PENALIZACIÓN: Se detectaron tiempos de traslado irreales (< 5 min).');
  }
  
  if (completionPercentage < 0.95) {
     if (missingPhotos >= missingSignatures) {
        tips.push('Toma más fotos del vehículo (frente, interior, daños).');
     } else if (missingSignatures > 0) {
        tips.push('Asegúrate de pedir siempre la firma y nombre de quien recibe.');
     } else {
        tips.push('Completa todos los datos requeridos antes de finalizar el trabajo.');
     }
  } else {
     tips.push('¡Excelente trabajo! Sigue así.');
  }
  
  return { score: completionPercentage * 100, grade, tips, totalJobs: completedJobs.length };
};