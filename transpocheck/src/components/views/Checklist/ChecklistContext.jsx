import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../../../firebase'; // Asumiendo que esta es la ruta, ajustar si es necesario
import { getVehicleIdentifierLabel } from '../../../utils/helpers'; // Asumiendo la ruta

const ChecklistContext = createContext();

export const useChecklist = () => useContext(ChecklistContext);

export const ChecklistProvider = ({ children, job, currentUserEmail, onCancel, onComplete, showAlert, showConfirm, allClientsList, drivers, expenses, vehicles, uploadImageToStorage, pushSyncTask }) => {
  const isQuick = job?.id === 'NEW_QUICK_JOB';
  const matchedVehicle = vehicles?.find(v => v.plate === String(job?.plate || job?.vin || '').toUpperCase());
  const initialDocs = matchedVehicle?.docs || { soap: false, permiso: false, revTecnica: false, gases: false };
  const initialDocsExpiry = matchedVehicle?.docsExpiry || {};
  const initialReminders = matchedVehicle?.internalReminders || [];

  let autoReturnOpt = 'origin';
  let autoReturnDest = '';
  if (job?.tripType === 'revision' && job?.destination) {
    const parts = job.destination.split('->');
    const finalLeg = (parts.length > 1 ? parts[1] : job.destination).trim();
    if (finalLeg && job.origin && finalLeg.toLowerCase() !== job.origin.toLowerCase()) {
      autoReturnOpt = 'other';
      autoReturnDest = finalLeg;
    }
  }

  const defaultData = {
    client: job?.client || '', manualClient: '', brand: job?.brand || '', model: job?.model || '', plateOrVin: job?.plate || job?.vin || '', origin: job?.origin || '', destination: job?.destination || '',
    vehicleType: job?.checklist?.vehicleType || job?.vehicleType || matchedVehicle?.vehicleType || matchedVehicle?.type || 'auto',
    fuelLevel: 50, mileage: job?.checklist?.mileage || '',
    photos: job?.checklist?.photos || { front: false, left: false, right: false, left_cab: false, left_body: false, right_cab: false, right_body: false, back: false, tire: false, dashboard: false, mileage: false, vin: false, ...Array.from({ length: 30 }).reduce((acc, _, i) => { acc[`det${i + 1}`] = false; return acc; }, {}) },
    detailPins: job?.checklist?.detailPins || [],
    pendingPin: null,
    docs: job?.checklist?.docs || initialDocs,
    docsExpiry: job?.checklist?.docsExpiry || initialDocsExpiry,
    internalReminders: job?.checklist?.internalReminders || initialReminders,
    observations: '', transitNotes: job?.checklist?.transitNotes || '', receiverName: '', receiverRut: '', noReception: false, signatureData: null, location: null,
    hasEquipment: job?.checklist?.hasEquipment || false,
    equipment: job?.checklist?.equipment || {},
    equipmentDetails: job?.checklist?.equipmentDetails || '',
    rtStatus: job?.prt_result ? job.prt_result : 'pendiente',
    rtRejectReason: job?.prt_reason ? job.prt_reason : '',
    rtReturnOption: job?.checklist?.rtReturnOption || autoReturnOpt,
    rtReturnDestination: job?.checklist?.rtReturnDestination || autoReturnDest,
    prtArrivalTime: job?.checklist?.prtArrivalTime || null,
    prtFinishTime: job?.checklist?.prtFinishTime || null,
    scandocPdfInbox: job?.checklist?.scandocPdfInbox || null,
    scandocPdf: job?.checklist?.scandocPdf || null,
    scannerLink: job?.checklist?.scannerLink || '',
    guiaDespachoLink: job?.checklist?.guiaDespachoLink || '',
    guiaDespachoPdf: job?.checklist?.guiaDespachoPdf || null
  };

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(defaultData);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  // Helper para setear campos individuales fácilmente
  const setF = (f, v) => setFormData(p => ({ ...p, [f]: v }));

  const value = {
    job, currentUserEmail, onCancel, onComplete, showAlert, showConfirm,
    allClientsList, drivers, expenses, vehicles, uploadImageToStorage, pushSyncTask,
    step, setStep,
    formData, setFormData, setF,
    isDraftLoaded, setIsDraftLoaded,
    isSubmitting, setIsSubmitting,
    processingAction, setProcessingAction,
    isQuick,
    defaultData,
    db
  };

  return (
    <ChecklistContext.Provider value={value}>
      {children}
    </ChecklistContext.Provider>
  );
};
