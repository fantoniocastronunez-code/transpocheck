import React, { useState, useEffect } from 'react';
import { updateDoc, doc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { X, User, CheckCircle, Plus, AlertCircle, FileText, Loader2, Camera } from 'lucide-react';
import CustomClientSelector from '../ui/CustomClientSelector';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import InAppCamera from '../ui/InAppCamera';
import AutocompleteInput from '../ui/AutocompleteInput';

// ✨ Solución 100% Nativa VITE: Importamos el motor interno. Cero bloqueos de CORS.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function NewJobForm({ jobToEdit, onCancelEdit, allClientsList, vehicles, drivers, db, showAlert, onSuccess, pushSyncTask, myDriver, user }) {
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // NUEVO: Leer borrador silencioso (Solo se usa si NO estamos editando un trabajo existente)
  const getDraft = () => {
    if (jobToEdit) return null; // Si estamos editando, ignorar borrador
    try {
      const draft = localStorage.getItem('app_newJobDraft');
      return draft ? JSON.parse(draft) : null;
    } catch(e) { return null; }
  };
  const draft = getDraft();

  const [selectedClient, setSelectedClient] = useState(jobToEdit?.client && allClientsList.includes(jobToEdit.client) ? jobToEdit.client : (jobToEdit?.client ? 'OTRO' : (draft?.selectedClient || '')));
  
  // NUEVO: Estado para cargar el directorio de destinos
  const [directoryList, setDirectoryList] = useState([]);
  const [activeJobsList, setActiveJobsList] = useState([]); // NUEVO: Memoria de trabajos activos
  const [confirmModal, setConfirmModal] = useState(null); // NUEVO: Modal de confirmación nativo

  const showConfirmDialog = (message, title) => {
    return new Promise((resolve) => {
      setConfirmModal({
        message,
        title,
        onConfirm: () => { setConfirmModal(null); resolve(true); },
        onCancel: () => { setConfirmModal(null); resolve(false); }
      });
    });
  };
  const [prtList, setPrtList] = useState([]); // <-- NUEVO ESTADO PARA PLANTAS PRT

  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const snap = await getDocs(collection(db, 'directory'));
        setDirectoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.error("Error cargando directorio:", e); }
    };
    
    // NUEVO: Traer vehículos que están actualmente en ruta o pendientes
    const fetchActiveJobs = async () => {
      try {
        const q = query(collection(db, 'transport_jobs'), where('status', 'in', ['pending', 'accepted']));
        const snap = await getDocs(q);
        setActiveJobsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.error("Error cargando trabajos activos:", e); }
    };

    const fetchPRTs = async () => {
      try {
        const snap = await getDocs(collection(db, 'prts'));
        setPrtList(snap.docs.map(d => d.data()));
      } catch(e) { console.error("Error cargando PRTs:", e); }
    };

    fetchDirectory();
    fetchActiveJobs();
    fetchPRTs();
  }, [db]);
  
  const [manualClient, setManualClient] = useState(jobToEdit?.client && !allClientsList.includes(jobToEdit.client) ? jobToEdit.client : (draft?.manualClient || ''));
  
  // NUEVOS ESTADOS: Pintura y Grabado
  const [isPintura, setIsPintura] = useState(jobToEdit?.isPintura ?? (draft?.isPintura || false));
  const [qtyPintura, setQtyPintura] = useState(jobToEdit?.qtyPintura || (draft?.qtyPintura || 1)); // NUEVO
  const [isGrabado, setIsGrabado] = useState(jobToEdit?.isGrabado ?? (draft?.isGrabado || false));
  const [qtyGrabado, setQtyGrabado] = useState(jobToEdit?.qtyGrabado || (draft?.qtyGrabado || 1)); // NUEVO
  const [associatedJobId, setAssociatedJobId] = useState(jobToEdit?.associatedJobId || (draft?.associatedJobId || ''));
  const [brand, setBrand] = useState(jobToEdit?.brand || (draft?.brand || ''));
  const [model, setModel] = useState(jobToEdit?.model || (draft?.model || ''));
  
  const initPlate = jobToEdit?.plate === jobToEdit?.vin && jobToEdit?.plate?.length !== 6 ? '' : (jobToEdit?.plate || (draft?.plate || ''));
  const initVin = jobToEdit?.plate === jobToEdit?.vin && jobToEdit?.vin?.length === 6 ? '' : (jobToEdit?.vin || (draft?.vin || ''));
  
  const [plate, setPlate] = useState(initPlate);
  const [vin, setVin] = useState(initVin);
  const [multiVehicles, setMultiVehicles] = useState(draft?.multiVehicles || []); // NUEVO: Lista para traslados masivos
  const [tripType, setTripType] = useState(jobToEdit?.tripType || (draft?.tripType || 'traslado'));
  const [vehicleType, setVehicleType] = useState(jobToEdit?.vehicleType || (draft?.vehicleType || 'auto'));
  const [historicalVehicleType, setHistoricalVehicleType] = useState(null);
  const [isUrgent, setIsUrgent] = useState(jobToEdit?.isUrgent ?? (draft?.isUrgent || false));
  const [isChassisCab, setIsChassisCab] = useState(jobToEdit?.isChassisCab ?? (draft?.isChassisCab || false));
  
  const [revType, setRevType] = useState(jobToEdit?.rtData?.type || (draft?.revType || 'A'));
  const [revModalidad, setRevModalidad] = useState(jobToEdit?.rtData?.modalidad || (draft?.revModalidad || 'legal')); // NUEVO: Legal o Con Ayuda
  const [revA_gases, setRevA_gases] = useState(jobToEdit?.rtData?.gases ?? (draft?.revA_gases || false));
  const [revA_revision, setRevA_revision] = useState(jobToEdit?.rtData?.revision ?? (draft?.revA_revision || false));
  const [revA_inspeccion, setRevA_inspeccion] = useState(jobToEdit?.rtData?.inspeccion ?? (draft?.revA_inspeccion || false));
  const [revA_frenos, setRevA_frenos] = useState(jobToEdit?.rtData?.frenos ?? (draft?.revA_frenos || false));
  const [revB_tipo, setRevB_tipo] = useState(jobToEdit?.rtData?.tipoB || (draft?.revB_tipo || 'completa'));
  const [revB_motivo, setRevB_motivo] = useState(jobToEdit?.rtData?.motivoInspeccion || (draft?.revB_motivo || ''));
  const [selectedDriversUI, setSelectedDriversUI] = useState(() => jobToEdit?.assignedEmails ? drivers.filter(d => jobToEdit.assignedEmails.includes(d.email)).map(d => d.id) : (draft?.selectedDriversUI || []));
  const [spotDriverEmail, setSpotDriverEmail] = useState(jobToEdit?.spotDriverEmail || (draft?.spotDriverEmail || '')); // NUEVO: Correo conductor externo
  
  // --- ESTADOS PARA TRABAJOS SIMPLES ---
  const [operationMode, setOperationMode] = useState(jobToEdit?.tripType === 'simple' ? 'servicio' : (draft?.operationMode || 'traslado'));
  const [description, setDescription] = useState(jobToEdit?.description || (draft?.description || ''));
  const [waypoints, setWaypoints] = useState(jobToEdit?.waypoints || (draft?.waypoints || []));

  const todayStr = new Date().toISOString().split('T')[0];

  // NUEVO: Autoguardado Silencioso (Motor de Memoria)
  useEffect(() => {
    if (!jobToEdit) { // Solo guarda si estamos creando uno nuevo
      const currentDraft = {
        selectedClient, manualClient, isPintura, qtyPintura, isGrabado, qtyGrabado, associatedJobId,
        brand, model, plate, vin, multiVehicles, tripType, vehicleType, isUrgent, isChassisCab,
        revType, revModalidad, revA_gases, revA_revision, revA_inspeccion, revA_frenos, revB_tipo, revB_motivo,
        selectedDriversUI, spotDriverEmail, operationMode, description, waypoints
      };
      localStorage.setItem('app_newJobDraft', JSON.stringify(currentDraft));
    }
  }, [selectedClient, manualClient, isPintura, qtyPintura, isGrabado, qtyGrabado, associatedJobId, brand, model, plate, vin, multiVehicles, tripType, vehicleType, isUrgent, revType, revModalidad, revA_gases, revA_revision, revA_inspeccion, revA_frenos, revB_tipo, revB_motivo, selectedDriversUI, spotDriverEmail, operationMode, description, waypoints, jobToEdit]);

  // --- NUEVO: Memoria Muscular Profunda para Tipo de Vehículo ---
  useEffect(() => {
    const autoSelectVehicleType = async () => {
      if (brand && model && brand.length > 1 && model.length > 1) {
        // 1. Buscar en la memoria rápida (lista de vehículos frecuentes o recientes)
        const localMatch = vehicles.find(v => 
          v.brand?.toUpperCase().trim() === brand.toUpperCase().trim() && 
          v.model?.toUpperCase().trim() === model.toUpperCase().trim() && 
          v.vehicleType
        );
        
        if (localMatch) {
          setVehicleType(localMatch.vehicleType);
          setHistoricalVehicleType(localMatch.vehicleType);
          return;
        }

        // 2. Buscar en el historial profundo de traslados antiguos en la base de datos
        try {
          const q = query(collection(db, 'transport_jobs'), where('model', '==', model.toUpperCase().trim()));
          const snap = await getDocs(q);
          
          const docMatch = snap.docs.find(d => {
            const docData = d.data();
            const vType = docData.vehicleType || docData.checklist?.vehicleType; // Busca tanto en la raíz como en checklists cerrados
            return docData.brand?.toUpperCase().trim() === brand.toUpperCase().trim() && vType;
          });
          
          if (docMatch) {
            const foundType = docMatch.data().vehicleType || docMatch.data().checklist?.vehicleType;
            setVehicleType(foundType);
            setHistoricalVehicleType(foundType);
          } else {
            setHistoricalVehicleType(null);
          }
        } catch(e) {
          console.warn("Búsqueda profunda de modelo omitida:", e);
        }
      }
    };

    // Esperamos 600ms después de que termines de escribir para no saturar la base de datos
    const delayDebounceFn = setTimeout(() => {
      autoSelectVehicleType();
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [brand, model, vehicles, db]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingVehicle, setIsSearchingVehicle] = useState(false);
  const [vehicleFoundStatus, setVehicleFoundStatus] = useState(null); // 'found', 'not_found', null
  const [vehiclePhoto, setVehiclePhoto] = useState(jobToEdit?.checklist?.photos?.front || null);

  const handleVehicleSearch = async (searchValue, type) => {
    const val = searchValue.toUpperCase().trim();
    if (type === 'plate') setPlate(val);
    if (type === 'vin') setVin(val);

    // Reseteamos estados visuales
    setVehicleFoundStatus(null);
    setVehiclePhoto(null);

    // Disparamos la búsqueda solo si la patente parece estar completa (mínimo 5 letras) o el VIN
    if ((type === 'plate' && val.length >= 5) || (type === 'vin' && val.length >= 6)) {
      setIsSearchingVehicle(true);

      // Simulamos un retraso de red para dar retroalimentación visual
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Buscamos en nuestra base de datos local de vehículos:
      const v = vehicles.find(x => (val && x.plate === val) || (val && x.vin === val));

      if (v) {
        setBrand(v.brand || ''); setModel(v.model || '');
        const cleanPlate = v.plate ? v.plate.toUpperCase().trim() : '';
        const cleanVin = v.vin ? v.vin.toUpperCase().trim() : '';
        if (cleanPlate && cleanPlate !== val && type === 'vin') setPlate(cleanPlate);
        if (cleanVin && cleanVin !== val && type === 'plate') setVin(cleanVin);
        if (v.vehicleType) { setVehicleType(v.vehicleType); setHistoricalVehicleType(v.vehicleType); }
        if (allClientsList.includes(v.client)) setSelectedClient(v.client); else { setSelectedClient('OTRO'); setManualClient(v.client); }
        
        setVehicleFoundStatus('found');
        setTimeout(() => setVehicleFoundStatus(null), 3000);
      } else {
        setVehicleFoundStatus('not_found');
      }

      // Buscar foto histórica en la BD para mostrarla de perfil
      try {
         const searchField = type === 'plate' ? 'plate' : 'vin';
         const qPhoto = query(collection(db, 'transport_jobs'), where(searchField, '==', val));
         const snapPhoto = await getDocs(qPhoto);
         if (!snapPhoto.empty) {
             const sorted = snapPhoto.docs.map(d => d.data()).sort((a,b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
             const foundPhotoJob = sorted.find(j => j.checklist?.photos?.front);
             if (foundPhotoJob) {
                 setVehiclePhoto(foundPhotoJob.checklist.photos.front);
             }
         }
      } catch (e) { console.error("Error buscando foto histórica:", e); }
      
      setIsSearchingVehicle(false);
    }
  };

  const handleAddMultiVehicle = () => {
    if (!plate && !vin) return showAlert("⚠️ Ingresa al menos la patente o el VIN para agregarlo a la lista masiva.");
    setMultiVehicles([...multiVehicles, { plate, vin, brand, model, vehicleType }]);
    setPlate(''); setVin(''); setBrand(''); setModel(''); setVehicleFoundStatus(null);
  };

  const handleRemoveMultiVehicle = (index) => {
    const newList = [...multiVehicles]; newList.splice(index, 1); setMultiVehicles(newList);
  };

  const handleAddWaypoint = () => setWaypoints([...waypoints, '']);
  const handleWaypointChange = (index, val) => { const nw = [...waypoints]; nw[index] = val; setWaypoints(nw); };
  const handleRemoveWaypoint = (index) => { const nw = [...waypoints]; nw.splice(index, 1); setWaypoints(nw); };

  const [cameraConfig, setCameraConfig] = useState({ isOpen: false });

  // --- NUEVO MOTOR OCR/PDF PARA GUÍAS DE DESPACHO ---
  const handleOcrUpload = async (fileOrEvent) => {
    // SOPORTA TANTO EL EVENTO DEL INPUT NATIVO COMO EL ARCHIVO DIRECTO DE LA CÁMARA
    const file = fileOrEvent.target ? fileOrEvent.target.files[0] : fileOrEvent;
    if (!file) return;

    setIsOcrProcessing(true);
    showAlert("⏳ Analizando documento... Esto puede tomar unos segundos.");

    try {
      let text = "";

      if (file.type === 'application/pdf') {
        // ✨ SOLUCIÓN AL ERROR: Alimentamos a la librería con los bytes crudos
        const arrayBuffer = await file.arrayBuffer();
        // Convertimos explícitamente a Uint8Array (el formato estricto que exige data)
        const uint8Array = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        
        // 1. Intentar lectura de texto digital nativo (Velocidad rayo)
        let nativeText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            nativeText += content.items.map(item => item.str).join(" ") + " ";
        }

        if (nativeText.trim().length > 50) {
            text = nativeText.toUpperCase();
        } else {
            // 2. Es un PDF escaneado (Foto pegada adentro). Renderizamos y pasamos a Tesseract
            showAlert("📸 Detectado PDF escaneado. Aplicando motor OCR visual...");
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 }); // Escala alta para mejor resolución
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const result = await Tesseract.recognize(canvas, 'spa');
            text = result.data.text.toUpperCase();
        }
      } else {
        // Es una imagen (JPG, PNG) va directo a Tesseract
        const result = await Tesseract.recognize(file, 'spa');
        text = result.data.text.toUpperCase();
      }

      // === APLICACIÓN DE REGLAS DE NEGOCIO AL TEXTO ENCONTRADO ===
      
      // 1. Buscar Patente Chilena (4 Letras 2 Números, o 2 Letras 4 Números)
      const plateMatch = text.match(/[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{4}/);
      if (plateMatch) setPlate(plateMatch[0]);

      // 2. Buscar VIN (17 caracteres alfanuméricos)
      const vinMatch = text.match(/[A-HJ-NPR-Z0-9]{17}/);
      if (vinMatch) setVin(vinMatch[0]);

      // 3. Deducir Marca buscando coincidencias de tu propia base de datos
      const allBrands = [...new Set(vehicles.map(v => v.brand?.toUpperCase().trim()).filter(Boolean))];
      let foundBrand = '';
      for (const b of allBrands) {
        if (b.length > 2 && text.includes(b)) {
          foundBrand = b;
          setBrand(b);
          break;
        }
      }

      // 4. Si encontramos la marca, deducimos el Modelo de esa marca específica
      if (foundBrand) {
        const modelsOfBrand = [...new Set(vehicles.filter(v => v.brand?.toUpperCase().trim() === foundBrand).map(v => v.model?.toUpperCase().trim()).filter(Boolean))];
        for (const m of modelsOfBrand) {
          if (m.length > 1 && text.includes(m)) {
            setModel(m);
            break;
          }
        }
      }

      showAlert("✅ ¡Documento analizado! Datos autocompletados.");
    } catch (err) {
      console.error("Error Leyendo Documento:", err);
      showAlert(`❌ Hubo un error procesando el archivo: ${err.message || 'Intente nuevamente'}`);
    } finally {
      setIsOcrProcessing(false);
      if (fileOrEvent && fileOrEvent.target) fileOrEvent.target.value = null; // Limpiar el input
    }
  };

  const handleCreateOrUpdateJob = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(e.target);

    if (operationMode === 'traslado' && historicalVehicleType && historicalVehicleType !== vehicleType) {
        const confirmMsg = `Estás guardando este traslado como '${vehicleType}', pero históricamente este modelo (${model}) se ha registrado como '${historicalVehicleType}'.\n\n¿Estás seguro que deseas guardarlo como '${vehicleType}'?`;
        const isConfirmed = await showConfirmDialog(confirmMsg, "ALERTA DE TIPO DE VEHÍCULO");
        if (!isConfirmed) return;
    }

    if (operationMode === 'traslado' && !jobToEdit) {
        const vPlate = plate.toUpperCase().trim();
        const vVin = vin.toUpperCase().trim();
        const dup = activeJobsList.find(j => 
            (vPlate && j.plate === vPlate) || (vVin && j.vin === vVin)
        );
        if (dup) {
            const confirmMsg = `Ya existe un traslado ACTIVO para el vehículo ${dup.plate || dup.vin} (${dup.brand || ''} ${dup.model || ''}).\n\n¿Estás seguro de que deseas crear OTRO traslado para el mismo vehículo?`;
            const isConfirmed = await showConfirmDialog(confirmMsg, "ALERTA DE TRASLADO DUPLICADO");
            if (!isConfirmed) return;
        }
    }

    setIsSubmitting(true);
    const selectedDriverIds = formData.getAll('assignedDriverId');
    
    const cleanSpotEmail = spotDriverEmail.trim().toLowerCase();
    
    if (selectedDriverIds.length === 0 && !cleanSpotEmail) {
        setIsSubmitting(false);
        return showAlert("❌ Debes seleccionar al menos un conductor de tu plantilla o ingresar un correo externo.");
    }

    const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
    
    // Si hay correo externo, creamos un conductor temporal simulado en la memoria de este trabajo
    if (cleanSpotEmail) {
        assignedDriversList.push({
            id: `spot_${Date.now()}`,
            name: `Conductor Externo (${cleanSpotEmail.split('@')[0]})`,
            email: cleanSpotEmail
        });
    }

    const finalClient = selectedClient === 'OTRO' ? manualClient : selectedClient;
    
    const rtData = (operationMode === 'traslado' && tripType === 'revision') ? {
      type: revType,
      modalidad: revModalidad, // NUEVO
      gases: revType === 'A' ? revA_gases : (revB_tipo === 'gases'),
      revision: revType === 'A' ? revA_revision : (revB_tipo === 'completa'),
      inspeccion: revType === 'A' ? revA_inspeccion : (revB_tipo === 'inspeccion'),
      frenos: revType === 'A' ? revA_frenos : false,
      tipoB: revType === 'B' ? revB_tipo : null,
      motivoInspeccion: revType === 'B' && revB_tipo === 'inspeccion' ? revB_motivo : null
    } : null;

    const finalTripType = operationMode === 'servicio' ? 'simple' : tripType;

    // MAGIA: Si es Revisión Técnica y anotaron Destino Final, lo estructuramos
    let finalDestination = formData.get('destination') || '';
    if (finalTripType === 'revision') {
      const prtSelected = formData.get('prtSelect') || '';
      const destFinal = formData.get('destFinal') || '';
      if (prtSelected && destFinal) {
        finalDestination = `${prtSelected} -> ${destFinal}`;
      } else if (prtSelected) {
        finalDestination = prtSelected;
      }
    }

    const jobData = {
      scheduledDate: formData.get('scheduledDate'), 
      scheduledTime: formData.get('scheduledTime') || '', // <-- NUEVO CAMPO
      client: finalClient, 
      origin: formData.get('origin'), destination: finalDestination,
      tripType: finalTripType,
      isUrgent: isUrgent,
      assignedDrivers: assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email})), assignedEmails: assignedDriversList.map(d => d.email)
    };

    // Si es traslado agregamos los datos del auto, si es servicio agregamos la descripción
    if (operationMode === 'traslado') {
       jobData.brand = brand; jobData.model = model; jobData.vin = vin.toUpperCase(); jobData.plate = plate.toUpperCase();
       jobData.vehicleType = vehicleType; jobData.rtData = rtData;
       jobData.waypoints = waypoints.filter(w => w.trim() !== ''); // Filtra paradas vacías
    } else {
       jobData.isPintura = isPintura;
       jobData.qtyPintura = isPintura ? Number(qtyPintura) : 0;
       jobData.isGrabado = isGrabado;
       jobData.qtyGrabado = isGrabado ? Number(qtyGrabado) : 0;
       jobData.associatedJobId = (isPintura || isGrabado) ? associatedJobId : null;
       
       let finalDesc = description;
       
       if ((isPintura || isGrabado) && associatedJobId) {
          const asocJob = activeJobsList.find(j => j.id === associatedJobId);
          if (asocJob) {
             jobData.associatedPlate = asocJob.plate || asocJob.vin || 'S/N';
             jobData.associatedVehicle = `${asocJob.brand || ''} ${asocJob.model || ''}`.trim();
             
             // Generación automática del texto con cantidades exactas
             const acciones = [];
             if (isPintura) acciones.push(`PINTURA DE ${qtyPintura} PATENTE${qtyPintura > 1 ? 'S' : ''}`);
             if (isGrabado) acciones.push(`GRABADO DE ${qtyGrabado} VIDRIO${qtyGrabado > 1 ? 'S' : ''}`);
             
             // Adaptamos el texto y priorizamos mostrar la PATENTE en lugar del VIN
             const tipoVeh = asocJob.vehicleType?.includes('camion') ? 'CAMIÓN' : 'VEHÍCULO';
             const identificador = asocJob.plate ? `PATENTE ${asocJob.plate}` : `VIN ${asocJob.vin || 'S/N'}`;
             const autoText = `${acciones.join(" Y ")} DE ${tipoVeh} ${asocJob.brand?.toUpperCase() || ''} MODELO ${asocJob.model?.toUpperCase() || ''} ${identificador}`.trim();
             
             // Si escribiste algo extra lo suma, si no, usa solo el texto automático
             finalDesc = description.trim() ? `${autoText} - Notas adicionales: ${description}` : autoText;
          }
       }
       
       jobData.description = finalDesc || 'Servicio en Terreno';
    }

    // NUEVO: BUSCAR ORIGEN EN EL DIRECTORIO
    const originValue = jobData.origin?.trim().toLowerCase();
    if (originValue) {
       const matchedOrigin = directoryList.find(d => d.placeName.trim().toLowerCase() === originValue);
       if (matchedOrigin) {
          jobData.originContactName = matchedOrigin.contactName || '';
          jobData.originContactPhone = matchedOrigin.contactPhone || '';
          jobData.originAddress = matchedOrigin.address || '';
          jobData.originCommune = matchedOrigin.commune || '';
       } else {
          try { addDoc(collection(db, 'directory'), { placeName: jobData.origin.trim().toUpperCase(), contactName: jobData.origin.trim().toUpperCase(), isAutoSaved: true }); } catch(e){}
       }
    }

    // NUEVO: BUSCAR DESTINO EN EL DIRECTORIO
    const destinationValue = jobData.destination?.trim().toLowerCase();
    if (destinationValue && !destinationValue.includes('->') && !destinationValue.includes('-')) {
       const matchedDest = directoryList.find(d => d.placeName.trim().toLowerCase() === destinationValue);
       if (matchedDest) {
          jobData.destContactName = matchedDest.contactName || '';
          jobData.destContactPhone = matchedDest.contactPhone || '';
          jobData.destAddress = matchedDest.address || '';
          jobData.destCommune = matchedDest.commune || '';
       } else {
          try { addDoc(collection(db, 'directory'), { placeName: jobData.destination.trim().toUpperCase(), contactName: jobData.destination.trim().toUpperCase(), isAutoSaved: true }); } catch(e){}
       }
    }

    // MAGIA UX: CIERRE INMEDIATO
    showAlert("⏳ Creando y asignando traslado...");
    
    // NUEVO: Si estamos creando uno nuevo y fue exitoso, destruimos el borrador
    if (!jobToEdit) {
      localStorage.removeItem('app_newJobDraft');
    }

    if (jobToEdit && onCancelEdit) onCancelEdit();
    else onSuccess();
    
    // Abrimos el registro en la cola global
    const taskName = jobToEdit ? `Actualizando ${plate || brand || 'Traslado'}` : `Creando ${plate || brand || 'Traslado'}`;
    const syncTask = pushSyncTask ? pushSyncTask(taskName) : { finish:()=>{}, error:()=>{} };

    // BURBUJA ASÍNCRONA (Segundo Plano)
    (async () => {
      try {
        // --- 1. DETERMINAR PRECIO PREDEFINIDO DEL CLIENTE ---
        let companyPrice = jobToEdit?.companyPrice || 0;
        let clientRecord = null;
        
        if (jobData.client && jobData.client !== 'Sin Cliente' && jobData.client !== 'OTRO') {
            try {
                const qClient = query(collection(db, 'clients'), where('name', '==', jobData.client));
                const snapClient = await getDocs(qClient);
                if (!snapClient.empty) {
                    clientRecord = snapClient.docs[0].data();
                    
                    if (!jobToEdit || !jobToEdit.companyPrice) {
                        const prices = clientRecord.prices || {};
                        if (operationMode === 'servicio') {
                            companyPrice = Number(prices.servicio) || 0;
                        } else if (tripType === 'revision') {
                            let totalRev = 0;
                            
                            // Determinamos el valor base dependiendo si es Legal o Con Ayuda
                            const basePriceA = revModalidad === 'ayuda' ? (Number(prices.prtAyuda) || 0) : (Number(prices.prt) || 0);
                            const basePriceB = revModalidad === 'ayuda' ? (Number(prices.prtAyuda) || 0) : (Number(prices.prtB) || 0);

                            if (revType === 'A') {
                                if (revA_gases || revA_revision) totalRev += basePriceA;
                                if (revA_inspeccion) totalRev += (Number(prices.inspVisualA) || 0);
                                if (revA_frenos) totalRev += (Number(prices.frenosA) || 0); // Ocupa el nuevo cajón de Frenos
                            } else if (revType === 'B') {
                                if (revB_tipo === 'completa') {
                                    totalRev += basePriceB;
                                } else if (revB_tipo === 'gases') {
                                    totalRev += (Number(prices.soloGasesB) || 0);
                                } else if (revB_tipo === 'inspeccion') {
                                    totalRev += (Number(prices.inspVisualB) || 0);
                                }
                            }
                            companyPrice = totalRev;
                        } else if (tripType === 'viaje') {
                            companyPrice = Number(prices.region) || 0;
                        } else {
                            companyPrice = Number(prices.local) || 0;
                        }
                    }
                }
            } catch (e) { console.error("Error buscando cliente:", e); }
        }
        
        jobData.companyPrice = companyPrice;

        // --- NUEVO: DETERMINAR LISTA DE VEHÍCULOS PARA CREACIÓN MASIVA ---
        let vehiclesToProcess = [];
        if (operationMode === 'traslado' && !jobToEdit && multiVehicles.length > 0) {
            vehiclesToProcess = [...multiVehicles];
            if (plate || vin) vehiclesToProcess.push({ plate, vin, brand, model, vehicleType, isChassisCab });
        } else {
            vehiclesToProcess = [{ plate, vin, brand, model, vehicleType, isChassisCab }];
        }

        // 1. GUARDADO EXPRÉS EN BASE DE DATOS (En Paralelo y con ID único)
        const savePromises = vehiclesToProcess.map(async (v, index) => {
            const currentJobData = { ...jobData };

            const vPlate = (v.plate || '').toUpperCase();
            const vVin = (v.vin || '').toUpperCase();
            const vBrand = v.brand || '';
            const vModel = v.model || '';

            if (operationMode === 'traslado') {
                currentJobData.brand = vBrand;
                currentJobData.model = vModel;
                currentJobData.vin = vVin;
                currentJobData.plate = vPlate;
                currentJobData.vehicleType = v.vehicleType;
                currentJobData.isChassisCab = v.isChassisCab !== undefined ? v.isChassisCab : isChassisCab;
            }

            if (jobToEdit) {
               await updateDoc(doc(db, 'transport_jobs', jobToEdit.id), currentJobData);
            } else {
               currentJobData.status = 'pending';
               currentJobData.createdAt = Date.now() + index; // ID de tiempo único
               currentJobData.checklist = null;
               currentJobData.createdBy = myDriver?.name || user?.displayName || user?.email || 'Admin';
               await addDoc(collection(db, 'transport_jobs'), currentJobData);
            }
            
            if (operationMode === 'traslado' && (vPlate || vVin) && !jobToEdit) {
                const existingVehicle = vehicles.find(veh => (vPlate && veh.plate === vPlate) || (vVin && veh.vin === vVin));
                if (existingVehicle) {
                    await updateDoc(doc(db, 'vehicles', existingVehicle.id), {
                        tripsCount: (existingVehicle.tripsCount || 0) + 1,
                        lastTripDate: Date.now()
                    });
                } else {
                    await addDoc(collection(db, 'vehicles'), { 
                        plate: vPlate, 
                        vin: vVin, 
                        vehicleType: v.vehicleType, 
                        brand: vBrand, 
                        model: vModel, 
                        client: finalClient, 
                        createdAt: Date.now() + index,
                        tripsCount: 1,
                        lastTripDate: Date.now()
                    });
                }
            }
            
            return { currentJobData, vPlate, vVin, vBrand, vModel };
        });

        // Esperamos a que TODOS se guarden en Firebase en paralelo
        const processedJobs = await Promise.all(savePromises);

        // 2. DISPARAR NOTIFICACIONES EN SEGUNDO PLANO
        processedJobs.forEach(({ currentJobData, vPlate, vVin, vBrand, vModel }) => {
            const driverTokens = assignedDriversList.map(d => d.fcmToken).filter(token => token);
            if (driverTokens.length > 0) {
              const pushTitle = jobToEdit ? (isUrgent ? "🚨 URGENTE: Trabajo Actualizado" : "🔄 Trabajo Actualizado") : (operationMode === 'servicio' ? (isUrgent ? "🚨 URGENTE: Nuevo Servicio" : "🛠️ ¡Nuevo Servicio Asignado!") : (isUrgent ? "🚨 URGENTE: Nuevo Traslado" : "📍 ¡Nuevo Traslado Asignado!"));
              const pushBody = operationMode === 'servicio' ? `Tarea: ${description}\nLugar: ${currentJobData.origin}` : `Vehículo: ${vBrand} ${vModel} (${vPlate || 'S/N'})\nDesde: ${currentJobData.origin}`;
              fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: driverTokens, title: pushTitle, body: pushBody }) }).catch(()=>{});
            }

            const driverEmails = assignedDriversList.map(d => d.email).filter(e => e);
            if (driverEmails.length > 0) {
               fetch('/api/notify-driver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: driverEmails, isEdit: !!jobToEdit, isService: operationMode === 'servicio', jobDetails: { client: currentJobData.client || 'Sin cliente', origin: currentJobData.origin, destination: currentJobData.destination || '', date: currentJobData.scheduledDate, plate: vPlate || vVin || currentJobData.associatedPlate || 'S/N', vehicle: operationMode === 'servicio' ? (currentJobData.description || 'Servicio en Terreno') : (`${vBrand} ${vModel}`.trim() || 'N/A'), description: description || '' } }) }).catch(()=>{});
            }
            
            if (!jobToEdit && clientRecord) {
                const notifs = clientRecord.notifications || { creado: false };
                if (notifs.creado && clientRecord.email) {
                   fetch('/api/notify-client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: clientRecord.email, clientName: clientRecord.name, type: 'creado', jobDetails: { id: 'N/A', driverName: 'Buscando conductor...', vehicle: operationMode === 'servicio' ? (currentJobData.description || 'Servicio en Terreno') : (`${vBrand} ${vModel}`.trim() || 'Vehículo'), plate: vPlate || vVin || currentJobData.associatedPlate || 'S/N', origin: currentJobData.origin || 'Origen', destination: currentJobData.destination || 'Destino' } }) }).catch(()=>{});
                }
            }
        });

        syncTask.finish(); // Marca en verde en el Ojo
        
        // Dispara el mensaje de éxito
        showAlert("✅ ¡Listo! Traslado procesado.");
        setTimeout(() => {
           showAlert(null);
        }, 500);
        
      } catch (error) { 
        console.error(error); 
        syncTask.error("Error de conexión");
        showAlert("❌ Hubo un error al guardar el traslado.");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleDeleteDestinationOption = async (optName) => {
    const isConfirmed = await showConfirmDialog(`¿Estás seguro que deseas eliminar "${optName}" de la lista de sugerencias?`, "Eliminar Destino");
    if (!isConfirmed) return;
    
    const dirItem = directoryList.find(d => d.placeName === optName);
    if (dirItem && dirItem.id) {
       try {
          const { deleteDoc, doc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'directory', dirItem.id));
          setDirectoryList(prev => prev.filter(d => d.id !== dirItem.id));
          showAlert(`✅ "${optName}" eliminado del directorio.`);
       } catch (e) {
          showAlert("❌ Error al eliminar el destino.");
       }
    } else {
       showAlert(`❌ "${optName}" no se puede eliminar (es un cliente predefinido).`);
    }
  };

  const handleDeleteBrandOption = async (optName) => {
    const isConfirmed = await showConfirmDialog(`¿Estás seguro que deseas eliminar la marca "${optName}" de las sugerencias?`, "Eliminar Marca");
    if (!isConfirmed) return;
    try {
       const { updateDoc, doc, deleteField } = await import('firebase/firestore');
       const toUpdate = vehicles.filter(v => v.brand?.toUpperCase().trim() === optName.toUpperCase().trim());
       for(let v of toUpdate) {
          await updateDoc(doc(db, 'vehicles', v.id), { brand: deleteField() });
       }
       showAlert(`✅ Marca "${optName}" eliminada de las sugerencias.`);
    } catch(e) {
       showAlert("❌ Error al eliminar la marca.");
    }
  };

  const handleDeleteModelOption = async (optName) => {
    const isConfirmed = await showConfirmDialog(`¿Estás seguro que deseas eliminar el modelo "${optName}" de las sugerencias?`, "Eliminar Modelo");
    if (!isConfirmed) return;
    try {
       const { updateDoc, doc, deleteField } = await import('firebase/firestore');
       const toUpdate = vehicles.filter(v => v.model?.toUpperCase().trim() === optName.toUpperCase().trim());
       for(let v of toUpdate) {
          await updateDoc(doc(db, 'vehicles', v.id), { model: deleteField() });
       }
       showAlert(`✅ Modelo "${optName}" eliminado de las sugerencias.`);
    } catch(e) {
       showAlert("❌ Error al eliminar el modelo.");
    }
  };

  const brandOptions = [...new Set(vehicles.map(v => v.brand?.toUpperCase().trim()).filter(Boolean))].sort();
  const modelOptions = [...new Set(vehicles.filter(v => !brand || v.brand?.toUpperCase().trim() === brand?.toUpperCase().trim()).map(v => v.model?.toUpperCase().trim()).filter(Boolean))].sort();

  const destinationOptions = [
    ...directoryList.map(dir => dir.placeName),
    ...(allClientsList || [])
  ].filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 rounded-3xl mb-28">

      {/* HEADER: Title & Urgency */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{jobToEdit ? 'Editar Trabajo' : 'Crear Nuevo Trabajo'}</h2>
        
        <div className="flex items-center gap-4">
          <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border-2 transition-all shadow-sm ${isUrgent ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-transparent border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <AlertCircle className={`w-5 h-5 ${isUrgent ? 'animate-pulse text-red-500' : 'text-slate-400'}`} />
            <span className="font-extrabold text-xs uppercase tracking-wider">{isUrgent ? 'Urgente' : 'Marcar Urgente'}</span>
            <div className="relative flex items-center ml-2">
              <input type="checkbox" className="sr-only" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
              <div className={`block w-10 h-6 rounded-full transition-colors ${isUrgent ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
              <div className={`absolute left-1 top-1 bg-white dark:bg-slate-900 w-4 h-4 rounded-full transition-transform ${isUrgent ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
          {jobToEdit && <button type="button" onClick={onCancelEdit} className="text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 p-2 rounded-xl transition"><X className="w-6 h-6"/></button>}
        </div>
      </div>

      <form onSubmit={handleCreateOrUpdateJob} className="space-y-6">
        
        {/* GLASSMORPHISM MAIN CARD */}
        <div className="bg-slate-50/50 dark:bg-[#131b2f]/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 p-6 sm:p-10 rounded-3xl shadow-2xl relative space-y-12">
           
           {/* STEP 1: TIPO DE SERVICIO */}
           <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-6">
                <div className="flex justify-center mb-8 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl max-w-md mx-auto">
                  <button type="button" onClick={() => setOperationMode('traslado')} className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 ${operationMode === 'traslado' ? 'bg-white dark:bg-slate-900 text-blue-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}>🚚 Traslado de Vehículo</button>
                  <button type="button" onClick={() => setOperationMode('servicio')} className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 ${operationMode === 'servicio' ? 'bg-white dark:bg-slate-900 text-purple-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}>🛠️ Servicio en Terreno</button>
                </div>

                {operationMode === 'traslado' ? (
                   <>
                     <div className="flex flex-col sm:flex-row justify-center bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl max-w-2xl mx-auto gap-1 sm:gap-0">
                        <button type="button" onClick={() => setTripType('traslado')} className={`flex-1 py-3 flex justify-center items-center gap-2 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 ${tripType === 'traslado' ? 'bg-white dark:bg-slate-900 text-blue-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}>
                           <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                           <span>Traslado Local</span>
                        </button>
                        <button type="button" onClick={() => setTripType('viaje')} className={`flex-1 py-3 flex justify-center items-center gap-2 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 ${tripType === 'viaje' ? 'bg-white dark:bg-slate-900 text-blue-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}>
                           <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                           <span>A Regiones</span>
                        </button>
                        <button type="button" onClick={() => setTripType('revision')} className={`flex-1 py-3 flex justify-center items-center gap-2 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 ${tripType === 'revision' ? 'bg-white dark:bg-slate-900 text-blue-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}>
                           <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                           <span>Revisión Técnica</span>
                        </button>
                     </div>
                     {tripType === 'revision' && (
                        <div className="mt-6 p-6 bg-white/50 dark:bg-[#0f172a]/50 rounded-2xl border border-blue-500/20 animate-in fade-in slide-in-from-top-4">
                           <h4 className="text-xs font-extrabold text-blue-500 uppercase tracking-widest mb-4">Detalles de la Revisión</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <select value={revType} onChange={e=>setRevType(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-200 transition-colors">
                                 <option value="A">Clase A</option>
                                 <option value="B">Clase B</option>
                              </select>
                              <select value={revModalidad} onChange={e=>setRevModalidad(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-200 transition-colors">
                                 <option value="legal">Legal (Normal)</option>
                                 <option value="ayuda">Con Ayuda</option>
                              </select>
                           </div>
                           {revType === 'A' && (
                             <div className="grid grid-cols-2 gap-3 mt-4 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 p-4 rounded-xl">
                               <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_gases} onChange={e=>setRevA_gases(e.target.checked)} className="w-5 h-5 text-blue-500 rounded accent-blue-500"/> Gases</label>
                               <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_revision} onChange={e=>setRevA_revision(e.target.checked)} className="w-5 h-5 text-blue-500 rounded accent-blue-500"/> Revisión</label>
                               <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_inspeccion} onChange={e=>setRevA_inspeccion(e.target.checked)} className="w-5 h-5 text-blue-500 rounded accent-blue-500"/> Insp. Visual</label>
                               <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_frenos} onChange={e=>setRevA_frenos(e.target.checked)} className="w-5 h-5 text-blue-500 rounded accent-blue-500"/> Cert. Frenos</label>
                             </div>
                           )}
                           {revType === 'B' && (
                              <div className="space-y-4 mt-4">
                                <select value={revB_tipo} onChange={e=>setRevB_tipo(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-200 transition-colors">
                                  <option value="completa">Revisión Completa</option>
                                  <option value="gases">Sólo Gases</option>
                                  <option value="inspeccion">Inspección Visual</option>
                                </select>
                                {revB_tipo === 'inspeccion' && (
                                   <input type="text" placeholder="Motivo de la Inspección Visual" value={revB_motivo} onChange={e=>setRevB_motivo(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-200 transition-colors" />
                                )}
                              </div>
                           )}
                        </div>
                     )}
                   </>
                ) : (
                   <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
                      <div className="w-20 h-20 bg-purple-500/10 text-purple-500 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">Servicio en Terreno seleccionado</h3>
                      <p className="text-sm max-w-sm">Completa los detalles y la ruta del servicio a continuación.</p>
                   </div>
                )}
           </div>

           {/* STEP 2: VEHICULO / SERVICIO */}
           <div className="animate-in fade-in slide-in-from-right-8 duration-500 border-t border-slate-200/50 dark:border-slate-700/50 pt-8">
               {operationMode === 'traslado' ? (
                 <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
                      <div className="flex items-center gap-4">
                         {vehiclePhoto && (
                            <img src={vehiclePhoto} alt="Perfil" className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-md animate-in zoom-in" />
                         )}
                         <div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Datos del Vehículo</h3>
                            <p className="text-xs text-blue-500 font-bold">Escribe Patente o VIN para autocompletar</p>
                         </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button type="button" onClick={() => setCameraConfig({ isOpen: true })} disabled={isOcrProcessing} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm transition-all border border-blue-500/30 ${isOcrProcessing ? 'bg-blue-500/10 text-blue-500' : 'bg-blue-500 text-white hover:bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}>
                          {isOcrProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                          {isOcrProcessing ? 'Leyendo...' : 'Escanear Guía'}
                        </button>
                        <div className="relative flex-1 sm:flex-none">
                          <input type="file" accept="image/*,application/pdf" onChange={handleOcrUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isOcrProcessing} />
                          <button type="button" disabled={isOcrProcessing} className="w-full h-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <FileText className="w-4 h-4"/> Archivo
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center min-h-[24px]">
                      {isSearchingVehicle && <span className="text-xs font-black text-blue-500 animate-pulse">Buscando coincidencia...</span>}
                      {vehicleFoundStatus === 'found' && !isSearchingVehicle && <span className="text-xs font-black text-green-500">¡Encontrado en tu historial!</span>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                       <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Patente</label>
                          <input value={plate} onChange={e=>handleVehicleSearch(e.target.value.replace(/[^a-zA-Z0-9]/g, ''), 'plate')} maxLength="6" type="text" placeholder="ABCD12" autoComplete="off" className={`w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl uppercase outline-none font-black transition-all ${isSearchingVehicle ? 'border-blue-400 ring-2 ring-blue-500/20' : vehicleFoundStatus === 'found' ? 'border-green-500/50 text-green-600 dark:text-green-400' : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-slate-100'}`} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">VIN / Chasis</label>
                          <input value={vin} onChange={e=>handleVehicleSearch(e.target.value.replace(/[^a-zA-Z0-9]/g, ''), 'vin')} maxLength="17" type="text" placeholder="17 CARACTERES" autoComplete="off" className={`w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl uppercase outline-none font-black transition-all ${isSearchingVehicle ? 'border-blue-400 ring-2 ring-blue-500/20' : vehicleFoundStatus === 'found' ? 'border-green-500/50 text-green-600 dark:text-green-400' : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-slate-100'}`} />
                       </div>

                       <div className="space-y-1 z-[990] relative">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Marca</label>
                          <AutocompleteInput name="brand" options={brandOptions} onDeleteOption={handleDeleteBrandOption} value={brand} onChange={e=>setBrand(e.target.value?.toUpperCase() || '')} placeholder="Ej: TOYOTA" className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl uppercase outline-none font-black text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
                       </div>
                       <div className="space-y-1 z-[980] relative">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Modelo</label>
                          <AutocompleteInput name="model" options={modelOptions} onDeleteOption={handleDeleteModelOption} value={model} onChange={e=>setModel(e.target.value?.toUpperCase() || '')} placeholder="Ej: HILUX" className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl uppercase outline-none font-black text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
                       </div>
                       
                       <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Categoría</label>
                          <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer">
                            <option value="auto">🚙 Auto / SUV</option>
                            <option value="camioneta">🛻 Camioneta</option>
                            <option value="furgon_pequeno">🚐 Furgón Pequeño</option>
                            <option value="furgon_grande">🚐 Furgón Grande</option>
                            <option value="camion">🚚 Camión Simple</option>
                            <option value="camion_doble">🚚 Camión Doble Cabina</option>
                            <option value="camion_2ejes">🚛 Camión (2 Ejes traseros)</option>
                            <option value="camion_3ejes">🚛 Camión (3 Ejes traseros)</option>
                            <option value="camion_8x4">🚚 Camión Rigid (8x4)</option>
                            <option value="carro_arrastre">🛒 Carro Arrastre</option>
                          </select>
                       </div>
                    </div>
                    {vehicleType.includes('camion') && vehicleType !== 'camioneta' && (
                      <label className="flex items-center gap-3 cursor-pointer bg-slate-500/5 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:bg-slate-500/10 transition-colors">
                        <input type="checkbox" checked={isChassisCab} onChange={e => setIsChassisCab(e.target.checked)} className="w-5 h-5 accent-blue-500 rounded cursor-pointer" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Es Chasis Cabina (sin caja/carrocería atrás)</span>
                      </label>
                    )}

                    {!jobToEdit && (
                      <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                         {multiVehicles.length > 0 && (
                           <div className="mb-4 space-y-2">
                              <p className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest">Lista Masiva ({multiVehicles.length}):</p>
                              {multiVehicles.map((v, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white/40 dark:bg-slate-900/40 p-3 rounded-xl border border-blue-500/20 shadow-sm animate-in zoom-in">
                                   <div>
                                      <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase">{v.plate || v.vin || 'S/N'}</p>
                                      <p className="text-[10px] font-bold text-slate-500 uppercase">{v.brand} {v.model}</p>
                                   </div>
                                   <button type="button" onClick={() => handleRemoveMultiVehicle(idx)} className="text-red-400 hover:text-red-500 bg-red-500/10 p-2 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
                                </div>
                              ))}
                           </div>
                         )}
                         <button type="button" onClick={handleAddMultiVehicle} className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4"/> Añadir a Lista Masiva
                         </button>
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="space-y-6">
                    <h3 className="text-xl font-extrabold text-purple-500">Detalles del Servicio</h3>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Descripción de la Tarea</label>
                      <textarea value={description} onChange={e=>setDescription(e.target.value)} required={!(isPintura || isGrabado)} rows="3" placeholder={(isPintura || isGrabado) ? "Opcional." : "Ej: Trámites, retiros, reparaciones..."} className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all resize-none" />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="bg-white/40 dark:bg-slate-900/40 border border-purple-500/20 p-4 rounded-2xl flex flex-col gap-3">
                           <label className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={isPintura} onChange={(e) => setIsPintura(e.target.checked)} className="w-5 h-5 accent-purple-500 rounded" />
                             <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 group-hover:text-purple-500 transition-colors">🎨 Pintura de Patentes</span>
                           </label>
                           {isPintura && (
                              <div className="flex items-center gap-3 bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20 animate-in fade-in">
                                 <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Cant:</span>
                                 <button type="button" onClick={() => setQtyPintura(2)} className={`px-3 py-1 rounded-lg text-sm font-black transition-colors ${Number(qtyPintura) === 2 ? 'bg-purple-500 text-white shadow-md' : 'bg-white/50 dark:bg-slate-800 text-purple-500'}`}>2</button>
                                 <input type="number" min="1" max="10" value={qtyPintura} onChange={(e) => setQtyPintura(e.target.value)} className="w-14 text-center bg-white dark:bg-slate-900 border-none p-1 rounded-lg font-black text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500" />
                              </div>
                           )}
                       </div>
                       <div className="bg-white/40 dark:bg-slate-900/40 border border-purple-500/20 p-4 rounded-2xl flex flex-col gap-3">
                           <label className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={isGrabado} onChange={(e) => setIsGrabado(e.target.checked)} className="w-5 h-5 accent-purple-500 rounded" />
                             <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 group-hover:text-purple-500 transition-colors">🪟 Grabado de Vidrios</span>
                           </label>
                           {isGrabado && (
                              <div className="flex items-center gap-3 bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20 animate-in fade-in">
                                 <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Cant:</span>
                                 <button type="button" onClick={() => setQtyGrabado(3)} className={`px-3 py-1 rounded-lg text-sm font-black transition-colors ${Number(qtyGrabado) === 3 ? 'bg-purple-500 text-white shadow-md' : 'bg-white/50 dark:bg-slate-800 text-purple-500'}`}>3</button>
                                 <input type="number" min="1" max="20" value={qtyGrabado} onChange={(e) => setQtyGrabado(e.target.value)} className="w-14 text-center bg-white dark:bg-slate-900 border-none p-1 rounded-lg font-black text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500" />
                              </div>
                           )}
                       </div>
                    </div>
                    
                    {(isPintura || isGrabado) && (
                       <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                          <label className="text-[10px] font-extrabold text-purple-500 uppercase tracking-wider ml-1 mb-1 block">Asociar a Vehículo Activo</label>
                          <select value={associatedJobId} onChange={(e) => {
                               const newId = e.target.value; setAssociatedJobId(newId);
                               if (newId) {
                                  const matchJob = activeJobsList.find(j => j.id === newId);
                                  if (matchJob && matchJob.client) {
                                     if (allClientsList.includes(matchJob.client)) setSelectedClient(matchJob.client);
                                     else { setSelectedClient('OTRO'); setManualClient(matchJob.client); }
                                  }
                               }
                             }} className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-purple-500/30 p-3.5 text-sm rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-bold text-slate-800 dark:text-slate-200 cursor-pointer transition-all">
                             <option value="">-- Opcional --</option>
                             {activeJobsList.filter(j => j.tripType !== 'simple').map(j => <option key={j.id} value={j.id}>{j.plate || j.vin || 'S/N'} - {j.brand} {j.model} ({j.client})</option>)}
                          </select>
                       </div>
                    )}
                 </div>
               )}
             </div>

           {/* STEP 3: RUTA Y PROGRAMACION */}
           <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-6 border-t border-slate-200/50 dark:border-slate-700/50 pt-8">
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 border-b border-slate-200/50 dark:border-slate-700/50 pb-4">Programación y Ruta</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Fecha y Hora</label>
                        <div className="flex gap-2">
                          <input name="scheduledDate" type="date" defaultValue={jobToEdit?.scheduledDate || todayStr} required className="w-3/5 bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all" />
                          <input name="scheduledTime" type="time" defaultValue={jobToEdit?.scheduledTime || ''} className="w-2/5 bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all" />
                        </div>
                     </div>
                     <div className="space-y-1 relative z-[999]">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Cliente</label>
                        <CustomClientSelector value={selectedClient} onChange={setSelectedClient} clients={allClientsList} placeholder="Seleccione Cliente" />
                        {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={e => setManualClient(e.target.value)} placeholder="Nombre del cliente" required className="w-full mt-2 bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all animate-in fade-in slide-in-from-top-2" />}
                     </div>
                  </div>
                  
                  <div className="space-y-4">
                     <div className="space-y-1 relative z-[900]">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Origen / Retiro</label>
                        <AutocompleteInput name="origin" options={destinationOptions} onDeleteOption={handleDeleteDestinationOption} defaultValue={jobToEdit?.origin || ''} required placeholder="¿Desde dónde?" className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all" />
                     </div>
                     
                     {operationMode === 'traslado' && tripType === 'revision' ? (
                        <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 space-y-3 relative z-[800]">
                           <div className="space-y-1">
                              <label className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider ml-1">Planta de Revisión</label>
                              <select name="prtSelect" defaultValue={jobToEdit?.destination?.split('->')[0]?.trim() || (prtList.length > 0 ? prtList[0].name : '')} required className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-blue-200 dark:border-blue-800/50 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all cursor-pointer">
                                <option value="">Selecciona la Planta...</option>
                                {prtList.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
                              </select>
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider ml-1">Destino Final (Post-PRT)</label>
                              <AutocompleteInput name="destFinal" options={destinationOptions} onDeleteOption={handleDeleteDestinationOption} defaultValue={jobToEdit?.destination?.split('->')[1]?.trim() || ''} placeholder="Opcional" className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all" />
                           </div>
                        </div>
                     ) : (
                        <div className="space-y-1 relative z-[800]">
                           <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Destino Final</label>
                           <AutocompleteInput name="destination" options={destinationOptions} onDeleteOption={handleDeleteDestinationOption} defaultValue={jobToEdit?.destination || ''} required={operationMode === 'traslado'} placeholder="Hasta (Destino)" className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all" />
                        </div>
                     )}
                  </div>
                </div>

                {operationMode === 'traslado' && tripType !== 'revision' && (
                  <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3">
                     <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Paradas Intermedias (Opcional)</label>
                     {waypoints.map((wp, idx) => (
                        <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                           <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 shrink-0">{idx + 1}</div>
                           <input type="text" value={wp} onChange={(e) => handleWaypointChange(idx, e.target.value)} placeholder={`Ej: Pesaje, Notaría...`} className="flex-1 bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100" />
                           <button type="button" onClick={() => handleRemoveWaypoint(idx)} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                     ))}
                     <button type="button" onClick={handleAddWaypoint} className="w-full py-3 px-4 rounded-xl font-extrabold text-sm border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4"/> Añadir Parada
                     </button>
                  </div>
                )}
             </div>

           {/* STEP 4: CONDUCTORES */}
           <div className="animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col h-full border-t border-slate-200/50 dark:border-slate-700/50 pt-8">
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-6">Asignar Conductores</h3>
                
                <div className="flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                     {drivers.length === 0 ? <p className="text-sm text-slate-400 font-semibold col-span-full">No hay conductores.</p> : (() => {
                        const visibleDrivers = drivers.filter(d => !d.isHidden && !(d.role === 'driver_regions' && tripType !== 'viaje'));
                        return visibleDrivers.map(d => {
                           const isSelected = selectedDriversUI.includes(d.id);
                           return (
                           <label key={d.id} className="relative flex cursor-pointer group">
                             <input type="checkbox" name="assignedDriverId" value={d.id} checked={isSelected} onChange={() => setSelectedDriversUI(prev => prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id])} className="sr-only" />
                             <div className={`w-full flex items-center p-3 bg-white/50 dark:bg-[#0f172a]/50 border-2 rounded-2xl transition-all duration-300 ${isSelected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] bg-blue-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-400/50 hover:bg-white dark:hover:bg-[#0f172a]'}`}>
                               <div className="ml-2 flex-1 overflow-hidden">
                                 <span className={`block text-sm font-black truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>{d.name}</span>
                                 <span className="block text-[10px] font-bold text-slate-400 truncate">{d.email}</span>
                               </div>
                               <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}`}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                               </div>
                             </div>
                           </label>
                         )});
                     })()}
                  </div>

                  <div className="bg-slate-500/5 border border-slate-200/50 dark:border-slate-700/50 p-5 rounded-2xl">
                     <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block">Conductor Externo (Spot / Única Vez)</label>
                     <input type="email" value={spotDriverEmail} onChange={(e) => setSpotDriverEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full bg-white/60 dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-700 p-3.5 text-sm rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400" />
                  </div>
                </div>
             </div>

           {/* SUBMIT BUTTON */}
           <div className="mt-10 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-end items-center relative z-20">
               <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-8 py-3 rounded-2xl font-extrabold text-white bg-green-500 hover:bg-green-600 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
                  {isSubmitting ? 'Procesando...' : (jobToEdit ? 'Actualizar Trabajo' : 'Guardar y Asignar')}
                  {!isSubmitting && <CheckCircle className="w-5 h-5"/>}
               </button>
           </div>

        </div>
      </form>

      {/* --- CÁMARA INTERNA CENTRALIZADA --- */}
      <InAppCamera isOpen={cameraConfig.isOpen} title="Escáner Inteligente" onClose={() => setCameraConfig({ isOpen: false })} onCapture={handleOcrUpload} />

      {/* NUEVO: Modal de Confirmación Nativo */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col animate-in zoom-in-95 border-t-8 border-orange-500">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3 leading-tight">
              <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" /> {confirmModal.title}
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 whitespace-pre-wrap">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button onClick={confirmModal.onCancel} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-extrabold text-sm transition-colors">Cancelar</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-extrabold text-sm shadow-md transition-colors">Aceptar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
