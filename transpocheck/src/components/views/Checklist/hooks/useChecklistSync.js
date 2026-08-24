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
    const unsub = onSnapshot(doc(db, 'transport_jobs', job.id), (docSnap) => {
      const data = docSnap.data();

      if (isFirstLoad) {
        if (data?.draft) {
          const draftData = { ...defaultData, ...data.draft.formData };
          if (data.prt_result) draftData.rtStatus = data.prt_result;
          if (data.prt_reason) draftData.rtRejectReason = data.prt_reason;
          if (data.checklist?.rtReturnOption) {
            draftData.rtReturnOption = data.checklist.rtReturnOption;
            draftData.rtReturnDestination = data.checklist.rtReturnDestination || '';
          }

          draftData.vehicleType = data.checklist?.vehicleType || data.vehicleType || matchedVehicle?.vehicleType || matchedVehicle?.type || draftData.vehicleType || 'auto';

          if (data.checklist?.photos) {
            for (const key in data.checklist.photos) {
              if (data.checklist.photos[key] && !draftData.photos[key]) {
                draftData.photos[key] = data.checklist.photos[key];
              }
            }
          }

          setFormData(draftData);
          setStep(data.draft.step || 1);
          setIsDraftLoaded(true);
        } else if (data?.checklist) {
          setFormData(prev => ({
            ...prev,
            ...data.checklist,
            rtStatus: data.prt_result || data.checklist.rtStatus || prev.rtStatus,
            rtRejectReason: data.prt_reason || data.checklist.rtRejectReason || prev.rtRejectReason
          }));
        } else if (data?.prt_result) {
          setFormData(prev => ({
            ...prev,
            rtStatus: data.prt_result,
            rtRejectReason: data.prt_reason || prev.rtRejectReason
          }));
        }
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
    const timer = setTimeout(() => {
      const draftData = JSON.parse(JSON.stringify(formData));

      for (const key in draftData.photos) {
        if (typeof draftData.photos[key] === 'string' && !draftData.photos[key].startsWith('http')) {
          draftData.photos[key] = false;
        }
      }

      const updates = { draft: { step, formData: draftData } };

      if (job.tripType === 'revision') {
        updates.prt_result = draftData.rtStatus;
        updates.prt_reason = draftData.rtRejectReason || '';

        if (draftData.rtStatus !== 'pendiente' && job.phase === 'arrived_prt') {
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

  return { syncFilesToStorage, checkIsExpired };
};
