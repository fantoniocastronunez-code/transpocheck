import { useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { saveLocalDraft, getLocalDraft, deleteLocalDraft } from '../../../../utils/localDrafts';

export const useChecklistSync = ({
  job, isQuick, formData, setFormData, step, setStep, isDraftLoaded, setIsDraftLoaded, defaultData, matchedVehicle, drivers, currentUserEmail, uploadImageToStorage, pushSyncTask, showAlert
}) => {
  const formDataRef = useRef(formData);
  const stepRef = useRef(step);
  const isDraftLoadedRef = useRef(isDraftLoaded);

  useEffect(() => {
    formDataRef.current = formData;
    stepRef.current = step;
    isDraftLoadedRef.current = isDraftLoaded;
  }, [formData, step, isDraftLoaded]);

  // Helper para guardar inmediatamente en IndexedDB (local, instantáneo, sin riesgo de límite de tamaño)
  const saveDraftToIndexedDB = useCallback(async (customFormData = null, customStep = null) => {
    if (isQuick || !job?.id) return;
    try {
      const targetData = customFormData || formDataRef.current;
      const targetStep = customStep ?? stepRef.current;
      if (!targetData) return;
      const fullDraftData = JSON.parse(JSON.stringify(targetData));
      await saveLocalDraft(job.id, { step: targetStep, formData: fullDraftData });
    } catch (e) {
      console.warn("[ERR-DRAFT-LOCAL-SAVE-02] Error al guardar localDraft:", e);
    }
  }, [job?.id, isQuick]);

  // Helper para guardar en Firestore (limpiando base64 para no exceder 1MB)
  const saveDraftToFirestore = useCallback(async (customFormData = null, customStep = null) => {
    if (isQuick || !job?.id || !isDraftLoadedRef.current) return;
    try {
      const targetData = customFormData || formDataRef.current;
      const targetStep = customStep ?? stepRef.current;
      if (!targetData) return;

      const fbDraftData = JSON.parse(JSON.stringify(targetData));

      // Limpiar fotos base64 de vehículo
      if (fbDraftData.photos) {
        for (const key in fbDraftData.photos) {
          if (typeof fbDraftData.photos[key] === 'string' && !fbDraftData.photos[key].startsWith('http')) {
            fbDraftData.photos[key] = false;
          }
        }
      }

      // Limpiar fotos base64 de docs
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

      const updates = { draft: { step: targetStep, formData: fbDraftData } };

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

      await updateDoc(doc(db, 'transport_jobs', job.id), updates);
    } catch (e) {
      console.warn("[ERR-DRAFT-FS-SAVE-01] Error guardando borrador en Firestore:", e);
    }
  }, [job?.id, isQuick, job?.tripType, job?.phase]);

  // Flush completo: local y nube
  const flushDraft = useCallback(async (customFormData = null, customStep = null) => {
    await saveDraftToIndexedDB(customFormData, customStep);
    await saveDraftToFirestore(customFormData, customStep);
  }, [saveDraftToIndexedDB, saveDraftToFirestore]);

  // Guardado inmediato de URL permanente en Firestore cuando una foto termina de subir al Storage
  const persistStoragePhoto = useCallback(async (photoCategory, photoKey, storageUrl) => {
    if (isQuick || !job?.id || !photoKey) return;
    try {
      const updateKey = photoCategory === 'docsPhotos'
        ? `draft.formData.docsPhotos.${photoKey}`
        : `draft.formData.photos.${photoKey}`;
      await updateDoc(doc(db, 'transport_jobs', job.id), {
        [updateKey]: storageUrl || false
      });
    } catch (err) {
      console.warn(`[ERR-PERSIST-PHOTO-${photoKey.toUpperCase()}] No se pudo persistir URL en Firestore:`, err);
    }
  }, [job?.id, isQuick]);

  // 1. Escuchar cambios en vivo de Firestore (Carga Inicial y Drafts)
  useEffect(() => {
    if (isQuick || !job?.id) return;
    let isFirstLoad = true;

    const handleInitialLoad = async (data) => {
      let draftData = { ...defaultData };
      let initialStep = 1;
      let hasDraft = false;

      // Fotos previas existentes en el job o en la base de datos
      const existingJobPhotos = {
        ...(job?.checklist?.photos || {}),
        ...(data?.checklist?.photos || {})
      };
      for (const key in existingJobPhotos) {
        if (existingJobPhotos[key]) {
          draftData.photos[key] = existingJobPhotos[key];
        }
      }

      // 1. Firebase Draft
      if (data?.draft) {
        hasDraft = true;
        initialStep = data.draft.step || 1;
        const fbForm = data.draft.formData || {};
        
        draftData = { ...draftData, ...fbForm };

        // Asegurar que fotos previas válidas no se borren por un `false` en fbForm
        if (fbForm.photos) {
          draftData.photos = { ...draftData.photos };
          for (const key in fbForm.photos) {
            const fbVal = fbForm.photos[key];
            if (fbVal) {
              draftData.photos[key] = fbVal;
            }
          }
        }

        if (fbForm.docsPhotos) {
          draftData.docsPhotos = { ...(draftData.docsPhotos || {}) };
          for (const key in fbForm.docsPhotos) {
            if (fbForm.docsPhotos[key]) {
              draftData.docsPhotos[key] = fbForm.docsPhotos[key];
            }
          }
        }
      } else if (data?.checklist) {
        draftData = { ...draftData, ...data.checklist };
      }
      
      // Normalizar niveles de combustible a 0-100% si vienen en formato 0-1
      if (draftData.fuelLevel !== undefined && draftData.fuelLevel <= 1 && draftData.fuelLevel > 0) {
        draftData.fuelLevel = Math.round(draftData.fuelLevel * 100);
      }
      if (draftData.arrivalFuelLevel !== undefined && draftData.arrivalFuelLevel <= 1 && draftData.arrivalFuelLevel > 0) {
        draftData.arrivalFuelLevel = Math.round(draftData.arrivalFuelLevel * 100);
      }

      // 2. Local Draft (para recuperar fotos y firmas en base64 no subidas)
      try {
        const localData = await getLocalDraft(job.id);
        if (localData && localData.formData) {
          hasDraft = true;
          if (localData.step) initialStep = localData.step;

          for (const key in localData.formData.photos || {}) {
            const locVal = localData.formData.photos[key];
            if (locVal) {
              const currentVal = draftData.photos[key];
              const isCurrentHttp = typeof currentVal === 'string' && currentVal.startsWith('http');
              const isLocalBase64 = typeof locVal === 'string' && locVal.startsWith('data:image');
              // Si ya tenemos una URL HTTP definitiva en Firebase, conservarla frente al base64 local
              if (isCurrentHttp && isLocalBase64) {
                // Conservar URL definitiva
              } else {
                draftData.photos[key] = locVal;
              }
            }
          }

          if (localData.formData.docsPhotos) {
            if (!draftData.docsPhotos) draftData.docsPhotos = {};
            for (const key in localData.formData.docsPhotos) {
              const locVal = localData.formData.docsPhotos[key];
              if (locVal) {
                const currentVal = draftData.docsPhotos[key];
                const isCurrentHttp = typeof currentVal === 'string' && currentVal.startsWith('http');
                const isLocalBase64 = typeof locVal === 'string' && locVal.startsWith('data:image');
                if (isCurrentHttp && isLocalBase64) {
                  // Conservar URL definitiva
                } else {
                  draftData.docsPhotos[key] = locVal;
                }
              }
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
            
            if (localVal !== undefined) {
              if (isLocalEmptyStr && draftData[field] && draftData[field] !== '') {
                // Conservar Firestore
              } else if (isLocalDefaultFuel && draftData[field] !== undefined && draftData[field] !== 50) {
                // Conservar Firestore
              } else {
                draftData[field] = localVal;
              }
            }
          });
        }
      } catch (e) {
        console.error("[ERR-DRAFT-LOAD-LOCAL-01] Error cargando local draft:", e);
      }

      // 3. Overrides from job data
      if (data?.prt_result) draftData.rtStatus = data.prt_result;
      if (data?.prt_reason) draftData.rtRejectReason = data.prt_reason;
      if (data?.checklist?.rtReturnOption || data?.draft?.formData?.rtReturnOption) {
        draftData.rtReturnOption = data.checklist?.rtReturnOption || data.draft?.formData?.rtReturnOption;
        draftData.rtReturnDestination = data.checklist?.rtReturnDestination || data.draft?.formData?.rtReturnDestination || '';
      }
      draftData.vehicleType = data?.checklist?.vehicleType || data?.vehicleType || matchedVehicle?.vehicleType || matchedVehicle?.type || draftData.vehicleType || 'auto';

      // Integrar fotos de documentos de la ficha del vehículo si no están en el borrador
      if (matchedVehicle?.docsPhotos) {
        if (!draftData.docsPhotos) draftData.docsPhotos = {};
        for (const k in matchedVehicle.docsPhotos) {
          if (matchedVehicle.docsPhotos[k] && !draftData.docsPhotos[k]) {
            draftData.docsPhotos[k] = matchedVehicle.docsPhotos[k];
          }
        }
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
  }, [job?.id, isQuick]);

  // 2. Guardado en cambios de visibilidad o antes de cerrar pestaña
  useEffect(() => {
    if (isQuick || !job?.id) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isDraftLoadedRef.current) {
        flushDraft();
      }
    };

    const handleBeforeUnload = () => {
      if (isDraftLoadedRef.current) {
        saveDraftToIndexedDB();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Flush al desmontar si el borrador ya estaba cargado
      if (isDraftLoadedRef.current) {
        saveDraftToIndexedDB();
        saveDraftToFirestore();
      }
    };
  }, [job?.id, isQuick, flushDraft, saveDraftToIndexedDB, saveDraftToFirestore]);

  // 3. Guardado Automático Periódico (Debounced) - NUNCA corre si !isDraftLoaded
  useEffect(() => {
    if (isQuick || !job?.id || !isDraftLoaded) return;

    const timer = setTimeout(() => {
      saveDraftToIndexedDB();
      saveDraftToFirestore();
    }, 800);

    return () => clearTimeout(timer);
  }, [step, formData, job?.id, isQuick, isDraftLoaded, saveDraftToIndexedDB, saveDraftToFirestore]);

  // Helper para subir archivos al storage al finalizar el checklist
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
    if (typeof d.fuelReceipt === 'string' && d.fuelReceipt.startsWith('data:image')) totalFiles++;
    if (typeof d.scandocPdf === 'string' && d.scandocPdf.startsWith('data:')) totalFiles++;
    if (typeof d.guiaDespachoPdf === 'string' && d.guiaDespachoPdf.startsWith('data:')) totalFiles++;

    if (totalFiles > 0 && setUploadProgress) {
      setUploadProgress({ active: true, current: 0, total: totalFiles, text: 'Conectando...' });
    }

    let completed = 0;
    const updateProgress = (fileName) => {
      completed++;
      if (setUploadProgress) setUploadProgress(prev => ({ ...prev, current: completed, text: `Subiendo ${fileName}...` }));
    };

    for (const [key, val] of Object.entries(d.photos)) {
      if (typeof val === 'string' && val.startsWith('data:image')) {
        try {
          const url = await uploadImageToStorage(val, `checklists/${jobIdFolder}`, `photo_${key}_${Date.now()}.jpg`);
          uploadedPhotos[key] = url;
          updateProgress(`foto ${key.toUpperCase()}`);
        } catch (err) {
          console.error(`[ERR-UPLOAD-PHOTO-${key.toUpperCase()}] Error subiendo foto ${key}:`, err);
        }
      } else {
        uploadedPhotos[key] = val;
      }
    }

    // Subir fotos de documentos (SOAP, Permiso, Revisión Técnica, Gases)
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
      } catch (err) {
        console.error("[ERR-UPLOAD-SIGN-01] Error subiendo firma:", err);
      }
    }

    if (typeof d.fuelReceipt === 'string' && d.fuelReceipt.startsWith('data:image')) {
      try {
        const url = await uploadImageToStorage(d.fuelReceipt, `checklists/${jobIdFolder}`, `fuel_receipt_${Date.now()}.jpg`);
        d.fuelReceipt = url;
        updateProgress('Boleta Combustible');
      } catch (err) {
        console.error("[ERR-UPLOAD-FUEL-RECEIPT-01] Error subiendo boleta combustible:", err);
      }
    }

    if (typeof d.scandocPdf === 'string' && d.scandocPdf.startsWith('data:')) {
      try {
        const ext = d.scandocPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.scandocPdf, `checklists/${jobIdFolder}`, `doc_${Date.now()}.${ext}`);
        d.scandocPdf = url;
        updateProgress('Documento');
      } catch (err) {
        console.error("[ERR-UPLOAD-PDF-01] Error subiendo PDF:", err);
      }
    }

    if (typeof d.guiaDespachoPdf === 'string' && d.guiaDespachoPdf.startsWith('data:')) {
      try {
        const ext = d.guiaDespachoPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.guiaDespachoPdf, `checklists/${jobIdFolder}`, `guia_${Date.now()}.${ext}`);
        d.guiaDespachoPdf = url;
        updateProgress('Guía Despacho');
      } catch (err) {
        console.error("[ERR-UPLOAD-GUIA-01] Error subiendo Guía:", err);
      }
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
      await deleteLocalDraft(job.id);
    } catch (e) {
      console.warn("[ERR-DRAFT-CLEAR-LOCAL-01] Error eliminando localDraft:", e);
    }
  };

  return {
    syncFilesToStorage,
    checkIsExpired,
    clearLocalDraft,
    flushDraft,
    saveDraftToIndexedDB,
    persistStoragePhoto
  };
};
