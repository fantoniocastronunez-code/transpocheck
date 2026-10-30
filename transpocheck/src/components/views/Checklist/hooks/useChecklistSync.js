import { useEffect } from 'react';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../../../firebase'; // Ajustar ruta
import { formatMoney, getVehicleIdentifierLabel } from '../../../../utils/helpers'; // Ajustar ruta

export const useChecklistSync = ({
  job, isQuick, formData, setFormData, step, setStep, setIsDraftLoaded, defaultData, matchedVehicle, drivers, currentUserEmail, uploadImageToStorage, pushSyncTask, showAlert
}) => {
  // 1. Escuchar cambios en vivo de Firestore (Carga Inicial y Drafts)
  useEffect(() => {
    if (isQuick || !job?.id) return;
    let isFirstLoad = true;

    const handleInitialLoad = async (data) => {
      let draftData = { ...defaultData };
      let initialStep = 1;
      let hasDraft = false;

      // 1. Firebase Draft
      if (data?.draft) {
        draftData = { ...draftData, ...data.draft.formData };
        initialStep = data.draft.step || 1;
        hasDraft = true;
      } else if (data?.checklist) {
        draftData = { ...draftData, ...data.checklist };
      }
      
      // Normalizar niveles de combustible a 0-100% si vienen en formato 0-1 desde el PickupModal
      if (draftData.fuelLevel !== undefined && draftData.fuelLevel <= 1 && draftData.fuelLevel > 0) {
        draftData.fuelLevel = Math.round(draftData.fuelLevel * 100);
      }
      if (draftData.arrivalFuelLevel !== undefined && draftData.arrivalFuelLevel <= 1 && draftData.arrivalFuelLevel > 0) {
        draftData.arrivalFuelLevel = Math.round(draftData.arrivalFuelLevel * 100);
      }
      // Si era 1 (Full) el math.round lo hizo 100. Si era 0 (Empty), lo dejamos en 0.


      // 2. Local Draft (para recuperar fotos y firmas no subidas)
      try {
        const { getLocalDraft } = await import('../../../../utils/localDrafts.js');
        const localData = await getLocalDraft(job.id);
        if (localData && localData.formData) {
          hasDraft = true;
          if (localData.step) initialStep = localData.step;
          for (const key in localData.formData.photos || {}) {
            if (localData.formData.photos[key]) draftData.photos[key] = localData.formData.photos[key];
          }
          if (localData.formData.docsPhotos) {
            if (!draftData.docsPhotos) draftData.docsPhotos = {};
            for (const key in localData.formData.docsPhotos) {
              if (localData.formData.docsPhotos[key]) draftData.docsPhotos[key] = localData.formData.docsPhotos[key];
            }
          }
          const base64Fields = ['signatureData', 'fuelReceipt', 'scandocPdf', 'guiaDespachoPdf'];
          base64Fields.forEach(field => {
              if (localData.formData[field]) draftData[field] = localData.formData[field];
          });
          if (localData.formData.carDamages) {
            if (!draftData.carDamages) draftData.carDamages = {};
            for (const key in localData.formData.carDamages) {
              if (localData.formData.carDamages[key]) draftData.carDamages[key] = localData.formData.carDamages[key];
            }
          }
          
          const nonBase64Fields = Object.keys(localData.formData).filter(k => k !== 'photos' && k !== 'docsPhotos' && !base64Fields.includes(k));
          nonBase64Fields.forEach(field => {
            const localVal = localData.formData[field];
            const isLocalEmptyStr = localVal === '';
            const isLocalDefaultFuel = field === 'fuelLevel' && localVal === 50;
            
            // No sobrescribir datos reales de Firestore con datos vacíos o valores por defecto del localDraft
            if (localVal !== undefined) {
              if (isLocalEmptyStr && draftData[field] && draftData[field] !== '') {
                // Conservar Firestore
              } else if (isLocalDefaultFuel && draftData[field] !== undefined && draftData[field] !== 50) {
                // Conservar Firestore (si el usuario ya había seteado un nivel distinto en Firebase)
              } else {
                draftData[field] = localVal;
              }
            }
          });
        }
      } catch (e) {
        console.error("Error loading local draft", e);
      }

      // 3. Overrides from job data
      if (data?.prt_result) draftData.rtStatus = data.prt_result;
      if (data?.prt_reason) draftData.rtRejectReason = data.prt_reason;
      if (data?.checklist?.rtReturnOption || data?.draft?.formData?.rtReturnOption) {
        draftData.rtReturnOption = data.checklist?.rtReturnOption || data.draft?.formData?.rtReturnOption;
        draftData.rtReturnDestination = data.checklist?.rtReturnDestination || data.draft?.formData?.rtReturnDestination || '';
      }
      draftData.vehicleType = data?.checklist?.vehicleType || data?.vehicleType || matchedVehicle?.vehicleType || matchedVehicle?.type || draftData.vehicleType || 'auto';

      if (data?.checklist?.photos) {
        for (const key in data.checklist.photos) {
          if (data.checklist.photos[key] && !draftData.photos[key]) {
            draftData.photos[key] = data.checklist.photos[key];
          }
        }
      }

      // Integrar fotos de documentos de la ficha del vehículo si no están en el borrador
      if (matchedVehicle?.docsPhotos) {
        draftData.docsPhotos = {
          ...matchedVehicle.docsPhotos,
          ...(draftData.docsPhotos || {})
        };
      }

      setFormData(draftData);
      if (hasDraft) setStep(initialStep);
      setIsDraftLoaded(true);
    };

    const unsub = onSnapshot(doc(db, 'transport_jobs', job.id), (docSnap) => {
      const data = docSnap.data();

      if (isFirstLoad) {
        handleInitialLoad(data);
        isFirstLoad = false;
      } else {
        if (data?.prt_result) {
          setFormData(prev => {
            const newReason = data.prt_reason || prev.rtRejectReason;
            if (prev.rtStatus === data.prt_result && prev.rtRejectReason === newReason) return prev;
            return {
              ...prev,
              rtStatus: data.prt_result,
              rtRejectReason: newReason
            };
          });
        }
      }

      if (data?.checklist?.clientSigned) {
        setFormData(prev => {
          if (
            prev.signatureData === data.checklist.signatureData &&
            prev.receiverName === data.checklist.receiverName &&
            prev.receiverRut === data.checklist.receiverRut &&
            prev.clientComments === (data.checklist.clientComments || '')
          ) {
            return prev;
          }
          return {
            ...prev,
            signatureData: data.checklist.signatureData,
            receiverName: data.checklist.receiverName,
            receiverRut: data.checklist.receiverRut,
            clientComments: data.checklist.clientComments || ''
          };
        });
      }
    });
    return () => unsub();
  }, [job?.id, isQuick, db]);

  // 2. Guardado Automático de Borradores (Drafts)
  useEffect(() => {
    if (isQuick || !job?.id) return;
    const timer = setTimeout(async () => {
      const fullDraftData = JSON.parse(JSON.stringify(formData));
      
      // Save local draft first with all base64 photos
      try {
        const { saveLocalDraft } = await import('../../../../utils/localDrafts.js');
        await saveLocalDraft(job.id, { step, formData: fullDraftData });
      } catch (e) {
        console.error("Error saving local draft", e);
      }

      // Prepare for Firebase (strip base64)
      const fbDraftData = JSON.parse(JSON.stringify(formData));

      for (const key in fbDraftData.photos) {
        if (typeof fbDraftData.photos[key] === 'string' && !fbDraftData.photos[key].startsWith('http')) {
          fbDraftData.photos[key] = false;
        }
      }

      // Limpiar fotos base64 en fbDraftData.docsPhotos para evitar exceder 1MB en Firestore
      if (fbDraftData.docsPhotos) {
        for (const key in fbDraftData.docsPhotos) {
          if (typeof fbDraftData.docsPhotos[key] === 'string' && !fbDraftData.docsPhotos[key].startsWith('http')) {
            delete fbDraftData.docsPhotos[key];
          }
        }
      }

      const base64Fields = ['signatureData', 'fuelReceipt', 'scandocPdf', 'guiaDespachoPdf'];
      base64Fields.forEach(field => {
          if (typeof fbDraftData[field] === 'string' && !fbDraftData[field].startsWith('http')) {
              fbDraftData[field] = false; 
          }
      });
      if (fbDraftData.carDamages) {
        for (const zoneId in fbDraftData.carDamages) {
          if (typeof fbDraftData.carDamages[zoneId]?.photo === 'string' && !fbDraftData.carDamages[zoneId].photo.startsWith('http')) {
            fbDraftData.carDamages[zoneId] = { ...fbDraftData.carDamages[zoneId], photo: false };
          }
        }
      }

      const updates = { draft: { step, formData: fbDraftData } };

      if (job.tripType === 'revision') {
        updates.prt_result = fbDraftData.rtStatus;
        updates.prt_reason = fbDraftData.rtRejectReason || '';

        if (fbDraftData.rtStatus !== 'pendiente' && job.phase === 'arrived_prt') {
          updates.phase = 'prt_done';
        }

        if (fbDraftData.rtReturnOption) {
          const effectiveFinal = (fbDraftData.rtReturnOption === 'other' || fbDraftData.rtReturnOption === 'destination') ? (fbDraftData.rtReturnDestination || '') : job.origin;
          const prtPart = (job.destination || '').includes('->') ? job.destination.split('->')[0].trim() : (job.destination?.trim() || 'PRT');
          if (effectiveFinal) {
            updates.destination = `${prtPart} -> ${effectiveFinal}`;
          }
        }
      }

      updateDoc(doc(db, 'transport_jobs', job.id), updates).catch(() => { });
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, formData, job?.id, isQuick, db, job?.tripType, job?.phase]);

  // Helper para subir archivos al storage
  const syncFilesToStorage = async (currentData, setUploadProgress) => {
    const d = { ...currentData };
    const uploadedPhotos = {};
    const jobIdFolder = isQuick ? `quick_${Date.now()}` : job.id;

    let totalFiles = 0;
    for (const val of Object.values(d.photos)) { if (typeof val === 'string' && val.startsWith('data:image')) totalFiles++; }
    if (d.docsPhotos) {
      for (const val of Object.values(d.docsPhotos)) { if (typeof val === 'string' && val.startsWith('data:image')) totalFiles++; }
    }
    if (d.carDamages) {
      for (const val of Object.values(d.carDamages)) {
        if (typeof val?.photo === 'string' && val.photo.startsWith('data:image')) totalFiles++;
      }
    }
    if (typeof d.signatureData === 'string' && d.signatureData.startsWith('data:image')) totalFiles++;
    if (typeof d.scandocPdf === 'string' && d.scandocPdf.startsWith('data:')) totalFiles++;
    if (typeof d.guiaDespachoPdf === 'string' && d.guiaDespachoPdf.startsWith('data:')) totalFiles++;

    if (totalFiles > 0 && setUploadProgress) {
      setUploadProgress({ active: true, current: 0, total: totalFiles, text: 'Conectando...' });
    }

    let completed = 0;
    const updateProgress = (fileName) => {
      completed++;
      if(setUploadProgress) setUploadProgress(prev => ({ ...prev, current: completed, text: `Subiendo ${fileName}...` }));
    };

    for (const [key, val] of Object.entries(d.photos)) {
      if (typeof val === 'string' && val.startsWith('data:image')) {
        try {
          const url = await uploadImageToStorage(val, `checklists/${jobIdFolder}`, `photo_${key}_${Date.now()}.jpg`);
          uploadedPhotos[key] = url;
          updateProgress(`foto ${key.toUpperCase()}`);
        } catch (err) { console.error(`Error subiendo foto ${key}:`, err); }
      } else {
        uploadedPhotos[key] = val;
      }
    }

    // Subir fotos de documentos (SOAP, Permiso, Revisión Técnica, Gases) a Firebase Storage
    const uploadedDocsPhotos = {};
    if (d.docsPhotos) {
      for (const [key, val] of Object.entries(d.docsPhotos)) {
        if (typeof val === 'string' && val.startsWith('data:image')) {
          try {
            const url = await uploadImageToStorage(val, `checklists/${jobIdFolder}`, `doc_${key}_${Date.now()}.jpg`);
            uploadedDocsPhotos[key] = url;
            updateProgress(`doc ${key.toUpperCase()}`);
          } catch (err) {
            console.error(`[ERR-UPLOAD-DOC-${key.toUpperCase()}] Error subiendo foto doc ${key}:`, err);
          }
        } else if (typeof val === 'string' && val.startsWith('http')) {
          uploadedDocsPhotos[key] = val;
        }
      }
    }

    if (typeof d.signatureData === 'string' && d.signatureData.startsWith('data:image')) {
      try {
        const url = await uploadImageToStorage(d.signatureData, `checklists/${jobIdFolder}`, `signature_${Date.now()}.jpg`);
        d.signatureData = url;
        updateProgress('Firma');
      } catch (err) { console.error("Error subiendo firma:", err); }
    }

    if (typeof d.fuelReceipt === 'string' && d.fuelReceipt.startsWith('data:image')) {
      try {
        const url = await uploadImageToStorage(d.fuelReceipt, `checklists/${jobIdFolder}`, `fuel_receipt_${Date.now()}.jpg`);
        d.fuelReceipt = url;
        updateProgress('Boleta Combustible');
      } catch (err) { console.error("Error subiendo boleta de combustible:", err); }
    }

    if (typeof d.scandocPdf === 'string' && d.scandocPdf.startsWith('data:')) {
      try {
        const ext = d.scandocPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.scandocPdf, `checklists/${jobIdFolder}`, `doc_${Date.now()}.${ext}`);
        d.scandocPdf = url;
        updateProgress('Documento');
      } catch (err) { console.error("Error subiendo PDF:", err); }
    }

    if (typeof d.guiaDespachoPdf === 'string' && d.guiaDespachoPdf.startsWith('data:')) {
      try {
        const ext = d.guiaDespachoPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.guiaDespachoPdf, `checklists/${jobIdFolder}`, `guia_${Date.now()}.${ext}`);
        d.guiaDespachoPdf = url;
        updateProgress('Guía Despacho');
      } catch (err) { console.error("Error subiendo Guía:", err); }
    }

    if (d.carDamages) {
      const uploadedDamages = { ...d.carDamages };
      for (const [zoneId, dmg] of Object.entries(d.carDamages)) {
        if (typeof dmg?.photo === 'string' && dmg.photo.startsWith('data:image')) {
          try {
            const url = await uploadImageToStorage(dmg.photo, `checklists/${jobIdFolder}`, `damage_${zoneId}_${Date.now()}.jpg`);
            uploadedDamages[zoneId] = { ...dmg, photo: url };
            updateProgress(`daño ${zoneId.toUpperCase()}`);
          } catch (err) {
            console.error(`[ERR-UPLOAD-DAMAGE-${zoneId.toUpperCase()}] Error subiendo foto daño ${zoneId}:`, err);
          }
        }
      }
      d.carDamages = uploadedDamages;
    }

    d.photos = uploadedPhotos;
    d.docsPhotos = uploadedDocsPhotos;

    if (totalFiles > 0 && setUploadProgress) {
      setUploadProgress({ active: true, current: totalFiles, total: totalFiles, text: '¡Sincronizado!' });
      setTimeout(() => setUploadProgress({ active: false, current: 0, total: 0, text: '' }), 1000);
    }

    return d;
  };


  const checkIsExpired = (dateStr) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parts.length === 2) {
      const exp = new Date(parts[0], parts[1], 0);
      return exp < today;
    } else {
      const [y, m, day] = parts;
      if (!y || !m || !day) return false;
      const exp = new Date(y, m - 1, day);
      return exp < today;
    }
  };

  const clearLocalDraft = async () => {
    try {
      const { deleteLocalDraft } = await import('../../../../utils/localDrafts.js');
      await deleteLocalDraft(job.id);
    } catch(e){}
  };

  return { syncFilesToStorage, checkIsExpired, clearLocalDraft };
};
