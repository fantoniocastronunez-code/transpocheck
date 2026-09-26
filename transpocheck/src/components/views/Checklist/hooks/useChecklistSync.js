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
          const base64Fields = ['signatureData', 'fuelReceipt', 'scandocPdf', 'guiaDespachoPdf'];
          base64Fields.forEach(field => {
              if (localData.formData[field]) draftData[field] = localData.formData[field];
          });
          
          const nonBase64Fields = Object.keys(localData.formData).filter(k => k !== 'photos' && !base64Fields.includes(k));
          nonBase64Fields.forEach(field => {
            if (localData.formData[field] !== undefined) draftData[field] = localData.formData[field];
          });
        }
      } catch (e) {
        console.error("Error loading local draft", e);
      }

      // 3. Overrides from job data
      if (data?.prt_result) draftData.rtStatus = data.prt_result;
      if (data?.prt_reason) draftData.rtRejectReason = data.prt_reason;
      if (data?.checklist?.rtReturnOption) {
        draftData.rtReturnOption = data.checklist.rtReturnOption;
        draftData.rtReturnDestination = data.checklist.rtReturnDestination || '';
      }
      draftData.vehicleType = data?.checklist?.vehicleType || data?.vehicleType || matchedVehicle?.vehicleType || matchedVehicle?.type || draftData.vehicleType || 'auto';

      if (data?.checklist?.photos) {
        for (const key in data.checklist.photos) {
          if (data.checklist.photos[key] && !draftData.photos[key]) {
            draftData.photos[key] = data.checklist.photos[key];
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

      // Limpiar otros campos base64 en el borrador de Firestore
      const base64Fields = ['signatureData', 'fuelReceipt', 'scandocPdf', 'guiaDespachoPdf'];
      base64Fields.forEach(field => {
          if (typeof fbDraftData[field] === 'string' && !fbDraftData[field].startsWith('http')) {
              fbDraftData[field] = false; 
          }
      });

      const updates = { draft: { step, formData: fbDraftData } };

      if (job.tripType === 'revision') {
        updates.prt_result = fbDraftData.rtStatus;
        updates.prt_reason = fbDraftData.rtRejectReason || '';

        if (fbDraftData.rtStatus !== 'pendiente' && job.phase === 'arrived_prt') {
          updates.phase = 'prt_done';
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
    for (const val of Object.values(d.photos)) { if (val && val.startsWith('data:image')) totalFiles++; }
    if (d.signatureData && d.signatureData.startsWith('data:image')) totalFiles++;
    if (d.scandocPdf && d.scandocPdf.startsWith('data:')) totalFiles++;
    if (d.guiaDespachoPdf && d.guiaDespachoPdf.startsWith('data:')) totalFiles++;

    if (totalFiles > 0 && setUploadProgress) {
      setUploadProgress({ active: true, current: 0, total: totalFiles, text: 'Conectando...' });
    }

    let completed = 0;
    const updateProgress = (fileName) => {
      completed++;
      if(setUploadProgress) setUploadProgress(prev => ({ ...prev, current: completed, text: `Subiendo ${fileName}...` }));
    };

    for (const [key, val] of Object.entries(d.photos)) {
      if (val && val.startsWith('data:image')) {
        try {
          const url = await uploadImageToStorage(val, `checklists/${jobIdFolder}`, `photo_${key}_${Date.now()}.jpg`);
          uploadedPhotos[key] = url;
          updateProgress(`foto ${key.toUpperCase()}`);
        } catch (err) { console.error(`Error subiendo foto ${key}:`, err); }
      } else {
        uploadedPhotos[key] = val;
      }
    }

    if (d.signatureData && d.signatureData.startsWith('data:image')) {
      try {
        const url = await uploadImageToStorage(d.signatureData, `checklists/${jobIdFolder}`, `signature_${Date.now()}.jpg`);
        d.signatureData = url;
        updateProgress('Firma');
      } catch (err) { console.error("Error subiendo firma:", err); }
    }

    if (d.fuelReceipt && d.fuelReceipt.startsWith('data:image')) {
      try {
        const url = await uploadImageToStorage(d.fuelReceipt, `checklists/${jobIdFolder}`, `fuel_receipt_${Date.now()}.jpg`);
        d.fuelReceipt = url;
        updateProgress('Boleta Combustible');
      } catch (err) { console.error("Error subiendo boleta de combustible:", err); }
    }

    if (d.scandocPdf && d.scandocPdf.startsWith('data:')) {
      try {
        const ext = d.scandocPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.scandocPdf, `checklists/${jobIdFolder}`, `doc_${Date.now()}.${ext}`);
        d.scandocPdf = url;
        updateProgress('Documento');
      } catch (err) { console.error("Error subiendo PDF:", err); }
    }

    if (d.guiaDespachoPdf && d.guiaDespachoPdf.startsWith('data:')) {
      try {
        const ext = d.guiaDespachoPdf.includes('application/pdf') ? 'pdf' : 'jpg';
        const url = await uploadImageToStorage(d.guiaDespachoPdf, `checklists/${jobIdFolder}`, `guia_${Date.now()}.${ext}`);
        d.guiaDespachoPdf = url;
        updateProgress('Guía Despacho');
      } catch (err) { console.error("Error subiendo Guía:", err); }
    }

    d.photos = uploadedPhotos;

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
