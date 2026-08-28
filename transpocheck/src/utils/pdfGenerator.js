import { formatDateDisplay } from './helpers';

export const buildPDFDoc = async (job, isPublic = false, drivers = []) => {
    const jsPDFModule = await import('jspdf');
    const JsPDFClass = jsPDFModule.default?.jsPDF || jsPDFModule.default || jsPDFModule.jsPDF;
    const docPDF = new JsPDFClass();

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
        const isApproved = job.checklist.rtStatus === 'aprobado' || job.checklist.rtStatus === 'aprobado_ayuda';
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
    if (job.acceptedByEmail && drivers && drivers.length > 0) { const foundDriver = drivers.find(d => d.email === job.acceptedByEmail); if (foundDriver) driverNameStr = foundDriver.name; }
    else if (job.assignedDrivers && job.assignedDrivers.length > 0) { const found = job.assignedDrivers.find(d => d.email === job.acceptedByEmail); if (found) driverNameStr = found.name; }

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
        
        if (job.tripType === 'revision') { if (job.checklist?.rtStatus === 'aprobado' || job.checklist?.rtStatus === 'aprobado_ayuda') { const ret = job.checklist.rtReturnOption === 'other' ? job.checklist.rtReturnDestination : job.origin; routeText = `${job.origin || '-'}  ->  PRT  ->  ${ret || '-'}`; } else if (job.checklist?.rtStatus === 'rechazado') { routeText = `${job.origin || '-'}  ->  PRT (Rechazada)`; } else { routeText = `${job.origin || '-'}  ->  PRT`; } }
        let routeH = drawKV("Ruta Asignada", routeText, 15, currentY, leftColWidth);
        currentY += routeH + 8;
        sectionNum++;

        currentY = drawSectionTitle(`${sectionNum}. Recepcion y Estado`, currentY);
        const getDocStatus = (docKey) => { const isOk = job.checklist?.docs?.[docKey]; const expDate = job.checklist?.docsExpiry?.[docKey]; if (!isOk) return 'FALTA'; if (expDate) { const [y, m] = expDate.split('-'); const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]; const monthStr = monthNames[parseInt(m, 10) - 1] || m; return `AL DIA (Vence: ${monthStr} ${y})`; } return 'AL DIA'; };
        const drawFuelMeter = (x, y, level, title) => {
          docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor);
          docPDF.text(title, x, y);
          docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor);
          docPDF.text(`${level}%`, x + 40, y, { align: 'right' });
          const barW = 40; const barY = y + 2;
          docPDF.setFillColor(226, 232, 240); docPDF.roundedRect(x, barY, barW, 3, 1.5, 1.5, 'F');
          if (level > 0) {
            if (level > 50) docPDF.setFillColor(34, 197, 94);
            else if (level > 20) docPDF.setFillColor(245, 158, 11);
            else docPDF.setFillColor(239, 68, 68);
            docPDF.roundedRect(x, barY, (barW * level) / 100, 3, 1.5, 1.5, 'F');
          }
          return 8;
        };

        let hFuel = drawFuelMeter(15, currentY + 3, job.checklist?.fuelLevel || 0, "Combustible Inicio:");
        let hSoap = drawKV("Seguro SOAP", getDocStatus('soap'), 65, currentY, 45);
        currentY += Math.max(hFuel, hSoap) + 6;

        if (job.checklist?.hasFuelCharge) {
          let hFuelAfter = drawFuelMeter(15, currentY + 3, job.checklist?.fuelLevelAfter ?? job.checklist?.fuelLevel, "Combustible Final:");
          let hChargeAmount = !isPublic ? drawKV("Monto Cargado", `$${(job.checklist?.fuelChargeAmount || 0).toLocaleString('es-CL')}`, 65, currentY, 45) : 0;
          currentY += Math.max(hFuelAfter, hChargeAmount) + 6;
        }
        let hPerm = drawKV("Permiso Circ.", getDocStatus('permiso'), 15, currentY, 45);
        let hRev = drawKV("Rev. Tecnica", getDocStatus('revTecnica'), 65, currentY, 45);
        currentY += Math.max(hPerm, hRev) + 6;
        let hGas = drawKV("Gases", getDocStatus('gases'), 15, currentY, 45);
        let hKm = drawKV("Kilometraje", `${job.checklist?.mileage || 'No reg.'}`, 65, currentY, 45);
        currentY += Math.max(hGas, hKm) + 8;

        if (job.checklist?.keyLocation) {
          const keyStr = job.checklist.keyLocation === 'puestas' ? 'Puestas' : 
                         job.checklist.keyLocation === 'puerta' ? 'En la puerta' :
                         job.checklist.keyLocation === 'mano' ? `A mano: ${job.checklist.keyHandedTo || ''}` : job.checklist.keyLocation;
          let hKeys = drawKV("Ubicación de Llaves", cleanStr(keyStr), 15, currentY, 95);
          currentY += hKeys + 8;
        }

        docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("OBSERVACIONES:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor); const obsSplit = docPDF.splitTextToSize(cleanStr(`${job.checklist?.observations || 'Sin observaciones registradas.'}`), leftColWidth); docPDF.text(obsSplit, 15, currentY + 4); currentY += (obsSplit.length * 4) + 8;
        
        if (job.checklist?.transitNotes) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("NOTAS DURANTE EL TRASLADO:", 15, currentY); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38); const transitSplit = docPDF.splitTextToSize(cleanStr(job.checklist.transitNotes), leftColWidth); docPDF.text(transitSplit, 15, currentY + 4); currentY += (transitSplit.length * 4) + 8; }

        if (job.checklist?.hasEquipment && job.checklist?.equipment) {
          docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("EQUIPAMIENTO VERIFICADO:", 15, currentY); currentY += 4;
          const eqKeys = Object.keys(job.checklist.equipment).filter(k => job.checklist.equipment[k]);
          docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...primaryColor);
          if (eqKeys.length > 0) {
            const eqStr = docPDF.splitTextToSize(cleanStr(eqKeys.join(', ')), leftColWidth);
            docPDF.text(eqStr, 15, currentY); currentY += (eqStr.length * 4) + 2;
          } else {
            docPDF.text("Ningún ítem marcado", 15, currentY); currentY += 6;
          }
          if (job.checklist?.equipmentDetails) {
            docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text("DETALLE HERRAMIENTAS:", 15, currentY); currentY += 4;
            docPDF.setFontSize(8); docPDF.setFont("helvetica", "italic"); docPDF.setTextColor(...primaryColor);
            const detStr = docPDF.splitTextToSize(cleanStr(job.checklist.equipmentDetails), leftColWidth);
            docPDF.text(detStr, 15, currentY); currentY += (detStr.length * 4) + 4;
          }
        }

        if (job.waitTimeMinutes && job.waitTimeMinutes > 20) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38); const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA EN ORIGEN: ${job.waitTimeMinutes} minutos`, leftColWidth); docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2; } else if (job.checklist?.hasWaitTime) { docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(220, 38, 38);  const wtStr = docPDF.splitTextToSize(`TIEMPO DE ESPERA: ${cleanStr(job.checklist.waitTime || 'Sí')}`, leftColWidth);  docPDF.text(wtStr, 15, currentY); currentY += (wtStr.length * 4) + 2;  }
        
        if (job.tripType === 'revision' && !isPublic) {
          const prtTotal = (Number(job.checklist?.prtCostRevision)||0) + (Number(job.checklist?.prtCostInspeccion)||0) + (Number(job.checklist?.prtCostFrenos)||0) + (Number(job.checklist?.prtCostGases)||0);
          if (prtTotal > 0) {
            docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(37, 99, 235);
            const prtStr = docPDF.splitTextToSize(`VALOR PRT TOTAL: $${prtTotal.toLocaleString('es-CL')} (Rev: $${(Number(job.checklist?.prtCostRevision)||0).toLocaleString('es-CL')} | Insp: $${(Number(job.checklist?.prtCostInspeccion)||0).toLocaleString('es-CL')} | Fre: $${(Number(job.checklist?.prtCostFrenos)||0).toLocaleString('es-CL')} | Gas: $${(Number(job.checklist?.prtCostGases)||0).toLocaleString('es-CL')})`, leftColWidth);
            docPDF.text(prtStr, 15, currentY);
            currentY += (prtStr.length * 4) + 2;
          }
        }

        sectionNum++;
    }

    if (job.tripType === 'revision') { currentY = drawSectionTitle(`${sectionNum}. Resultado`, currentY); if (job.checklist?.rtStatus === 'aprobado' || job.checklist?.rtStatus === 'aprobado_ayuda') { docPDF.setTextColor(22, 163, 74); docPDF.setFontSize(16); docPDF.text("APROBADO", 15, currentY + 6); currentY += 18; } else { docPDF.setTextColor(220, 38, 38); docPDF.setFontSize(16); docPDF.text("RECHAZADO", 15, currentY + 6); docPDF.setFontSize(10); docPDF.setTextColor(153, 27, 27); const rejSplit = docPDF.splitTextToSize(cleanStr(`Motivo: ${job.checklist?.rtRejectReason || job.failedReason || 'No especificada'}`), leftColWidth); docPDF.text(rejSplit, 15, currentY + 12); currentY += 20 + (rejSplit.length * 4); } sectionNum++; }

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

    const attachedDocHref = job.guideLink || job.guideUrl || job.docLink || job.docUrl || job.rtLink || job.rtDoc || (job.rtData && job.rtData.link) || job.pdfUrl || job.fileUrl || job.checklist?.guiaDespachoPdf || job.checklist?.guiaDespachoLink;
    if (attachedDocHref) { 
      currentY += (job.checklist?.location ? 10 : 2);
      docPDF.setFontSize(8); docPDF.setFont("helvetica", "normal"); docPDF.setTextColor(...secondaryColor); docPDF.text(`DOCUMENTO ADJUNTO (GUIA/RT):`, 15, currentY); 
      docPDF.setFontSize(9); docPDF.setTextColor(...accentColor); docPDF.textWithLink('Clic aqui para abrir documento', 15, currentY + 4, { url: attachedDocHref }); 
    }

    if (frontPhotoObj && job.tripType !== 'simple') { 
      try { 
        const dims = { w: frontPhotoObj.w, h: frontPhotoObj.h }; 
        const frontPhotoStr = frontPhotoObj.data;
        const ratio = dims.h / dims.w; let imgW = 80; let imgH = imgW * ratio; if (imgH > 130) { imgH = 130; imgW = imgH / ratio; } const rightX = 115; const rightY = startY + 6; docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(rightX - 2, rightY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(rightX - 2, rightY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text("VISTA FRONTAL", rightX + (imgW/2), rightY - 3, { align: "center" }); 
        try { docPDF.addImage(frontPhotoStr, 'JPEG', rightX, rightY + 2, imgW, imgH); } catch(e) { docPDF.addImage(frontPhotoStr, 'PNG', rightX, rightY + 2, imgW, imgH); }
        if (typeof photos.front === 'string' && photos.front.startsWith('http')) {
          docPDF.link(rightX, rightY + 2, imgW, imgH, { url: photos.front });
        }
      } catch (err) { console.error("Error al incrustar foto frontal:", err); } 
    }

    const addFooter = () => { const pageCount = docPDF.internal.getNumberOfPages(); for(let i = 1; i <= pageCount; i++) { docPDF.setPage(i); docPDF.setFontSize(8); docPDF.setTextColor(148, 163, 184); docPDF.text(`Generado por LogisticAPP el ${new Date().toLocaleString('es-CL')} - Pagina ${i} de ${pageCount}`, 105, 290, null, null, "center"); } }

    if (preloadedOtherPhotos.length > 0) {
      const labels = job.tripType === 'simple' 
         ? { det1: 'Evidencia 1', det2: 'Evidencia 2', det3: 'Evidencia 3', det4: 'Evidencia 4', det5: 'Evidencia 5', det6: 'Evidencia 6', det7: 'Evidencia 7', det8: 'Evidencia 8', det9: 'Evidencia 9', det10: 'Evidencia 10' }
         : { left: 'Lat. Piloto', right: 'Lat. Copiloto', back: 'Atras', tire: 'Repuesto', dashboard: 'Tablero', interior_front: 'Int. Adelante', interior_back: 'Int. Atras', odometer: 'Odómetro', det1: 'Detalle 1', det2: 'Detalle 2', det3: 'Detalle 3', det4: 'Detalle 4', det5: 'Detalle 5', det6: 'Detalle 6', det7: 'Detalle 7', det8: 'Detalle 8' };
      
      let photoY = 46; let currentCol = 1; let addedPage = false; 
      const detailPins = job.checklist?.detailPins || [];
      if (detailPins.length > 0 && job.tripType !== 'simple') { 
          docPDF.addPage(); drawHeader("ESQUEMA DE DAÑOS Y DETALLES"); addedPage = true; 
          
          const mapX = 65; const mapY = 45; const mapW = 80; const mapH = 45; 
          docPDF.setFillColor(248, 250, 252); docPDF.roundedRect(mapX, mapY, mapW, mapH, 3, 3, 'F'); 
          docPDF.setDrawColor(203, 213, 225); docPDF.roundedRect(mapX, mapY, mapW, mapH, 3, 3, 'S'); 
          
          const vType = job.checklist.vehicleType || 'auto'; 
          const vx = mapX + 8; const vw = mapW - 16; const vy = mapY + 8; const vh = mapH - 16; 
          
          docPDF.setFillColor(203, 213, 225); docPDF.setDrawColor(148, 163, 184); docPDF.setLineWidth(1); 
          
          if (vType === 'camioneta') { 
              docPDF.roundedRect(vx, vy, vw*0.35, vh, 3, 3, 'FD'); 
              docPDF.setFillColor(71, 85, 105); docPDF.rect(vx+3, vy+4, 6, vh-8, 'F'); 
              docPDF.setFillColor(226, 232, 240); docPDF.roundedRect(vx+vw*0.38, vy+2, vw*0.62, vh-4, 2, 2, 'FD'); 
          } else if (vType === 'camion') { 
              docPDF.setFillColor(191, 219, 254); docPDF.roundedRect(vx, vy-2, vw*0.2, vh+4, 2, 2, 'FD'); 
              docPDF.setFillColor(226, 232, 240); docPDF.roundedRect(vx+vw*0.22, vy, vw*0.78, vh, 1, 1, 'FD'); 
          } else { 
              docPDF.roundedRect(vx, vy, vw, vh, 6, 6, 'FD'); 
              docPDF.setFillColor(71, 85, 105); 
              docPDF.rect(vx+6, vy+4, 8, vh-8, 'F'); 
              docPDF.rect(vx+vw-12, vy+4, 6, vh-8, 'f'); 
          } 
          
          if (Array.isArray(detailPins)) {
              detailPins.forEach(pin => { 
                  const px = vx + (vw * ((pin?.y || 0) / 100)); 
                  const py = vy + (vh * ((100 - (pin?.x || 0)) / 100)); 
                  
                  docPDF.setFillColor(239, 68, 68); docPDF.circle(px, py, 4, 'F'); 
                  docPDF.setTextColor(255, 255, 255); docPDF.setFontSize(8); docPDF.setFont("helvetica", "bold"); 
                  docPDF.text(String(pin?.id || '').replace('det', ''), px, py + 1, {align: 'center', baseline: 'middle'}); 
              });
          } 
          
          docPDF.setFontSize(8); docPDF.setTextColor(100, 116, 139); docPDF.setFont("helvetica", "normal"); 
          docPDF.text("Los numeros rojos indican daños descritos a continuación:", 105, mapY + mapH + 6, null, null, "center"); 
          
          photoY = 105; 
      }
      
      const sortedOtherPhotos = [...preloadedOtherPhotos].filter(Boolean).sort((a, b) => { const aIsDet = a.key.startsWith('det'); const bIsDet = b.key.startsWith('det'); if (aIsDet && !bIsDet) return -1; if (!aIsDet && bIsDet) return 1; if (aIsDet && bIsDet) return parseInt(a.key.replace('det','')) - parseInt(b.key.replace('det','')); return 0; });
      for (const item of sortedOtherPhotos) { 
        const { key, base64Img, dims } = item; 
        if (!addedPage) { docPDF.addPage(); drawHeader("ANEXO FOTOGRAFICO"); addedPage = true; } 
        try { 
          const ratio = dims.h / dims.w; let imgW = 85; let imgH = imgW * ratio; if (imgH > 95) { imgH = 95; imgW = imgH / ratio; }
          
          const slotCenter = currentCol === 1 ? 55 : 155; let finalX = slotCenter - (imgW / 2);
          if (photoY + imgH > 275) { docPDF.addPage(); photoY = 46; currentCol = 1; drawHeader("ANEXO FOTOGRAFICO (CONT.)"); finalX = 55 - (imgW / 2); }
          
          docPDF.setDrawColor(...borderColor); docPDF.setLineWidth(0.5); docPDF.roundedRect(finalX - 2, photoY - 8, imgW + 4, imgH + 12, 2, 2, 'S'); docPDF.setFillColor(...lightBg); docPDF.rect(finalX - 2, photoY - 8, imgW + 4, 8, 'F'); docPDF.setFontSize(9); docPDF.setFont("helvetica", "bold"); docPDF.setTextColor(...secondaryColor); docPDF.text((labels[key] || key).toUpperCase(), finalX + (imgW/2), photoY - 3, { align: "center" }); 
          try { docPDF.addImage(base64Img, 'JPEG', finalX, photoY + 2, imgW, imgH); } catch(e) { docPDF.addImage(base64Img, 'PNG', finalX, photoY + 2, imgW, imgH); }
          if (typeof photos[key] === 'string' && photos[key].startsWith('http')) { docPDF.link(finalX, photoY + 2, imgW, imgH, { url: photos[key] }); }
          
          if (currentCol === 1) { currentCol = 2; } else { currentCol = 1; photoY += (imgH > 80 ? imgH : 80) + 20; } 
        } catch (err) { console.error("Error al incrustar la foto:", key, err); } 
      }
    }

    addFooter();
    return docPDF;
};