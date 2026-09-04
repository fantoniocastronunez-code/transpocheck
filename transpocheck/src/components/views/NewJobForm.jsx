import React, { useState, useEffect } from 'react';
import { updateDoc, doc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { X, User, CheckCircle, Plus, AlertCircle, FileText, Loader2, Camera } from 'lucide-react';
import CustomClientSelector from '../ui/CustomClientSelector';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import InAppCamera from '../ui/InAppCamera';

// ✨ Solución 100% Nativa VITE: Importamos el motor interno. Cero bloqueos de CORS.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function NewJobForm({ jobToEdit, onCancelEdit, allClientsList, vehicles, drivers, db, showAlert, onSuccess, pushSyncTask, myDriver, user }) {
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  
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
  const [prtList, setPrtList] = useState([]); // <-- NUEVO ESTADO PARA PLANTAS PRT

  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const snap = await getDocs(collection(db, 'directory'));
        setDirectoryList(snap.docs.map(d => d.data()));
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
  
  const [revType, setRevType] = useState(jobToEdit?.rtData?.type || (draft?.revType || 'A'));
  const [revModalidad, setRevModalidad] = useState(jobToEdit?.rtData?.modalidad || (draft?.revModalidad || 'legal')); // NUEVO: Legal o Con Ayuda
  const [revA_gases, setRevA_gases] = useState(jobToEdit?.rtData?.gases ?? (draft?.revA_gases || false));
  const [revA_revision, setRevA_revision] = useState(jobToEdit?.rtData?.revision ?? (draft?.revA_revision || false));
  const [revA_inspeccion, setRevA_inspeccion] = useState(jobToEdit?.rtData?.inspeccion ?? (draft?.revA_inspeccion || false));
  const [revA_frenos, setRevA_frenos] = useState(jobToEdit?.rtData?.frenos ?? (draft?.revA_frenos || false));
  const [revB_tipo, setRevB_tipo] = useState(jobToEdit?.rtData?.tipoB || (draft?.revB_tipo || 'completa'));
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
        brand, model, plate, vin, multiVehicles, tripType, vehicleType, isUrgent,
        revType, revModalidad, revA_gases, revA_revision, revA_inspeccion, revA_frenos, revB_tipo,
        selectedDriversUI, spotDriverEmail, operationMode, description, waypoints
      };
      localStorage.setItem('app_newJobDraft', JSON.stringify(currentDraft));
    }
  }, [selectedClient, manualClient, isPintura, qtyPintura, isGrabado, qtyGrabado, associatedJobId, brand, model, plate, vin, multiVehicles, tripType, vehicleType, isUrgent, revType, revModalidad, revA_gases, revA_revision, revA_inspeccion, revA_frenos, revB_tipo, selectedDriversUI, spotDriverEmail, operationMode, description, waypoints, jobToEdit]);

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
        if (v.plate && type === 'vin') setPlate(v.plate);
        if (v.vin && type === 'plate') setVin(v.vin);
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

    if (operationMode === 'traslado' && historicalVehicleType && historicalVehicleType !== vehicleType) {
        const confirmMsg = `⚠️ ALERTA DE TIPO DE VEHÍCULO\n\nEstás guardando este traslado como '${vehicleType}', pero históricamente este modelo (${model}) se ha registrado como '${historicalVehicleType}'.\n\n¿Estás seguro que deseas guardarlo como '${vehicleType}'?`;
        if (!window.confirm(confirmMsg)) {
            return;
        }
    }

    setIsSubmitting(true);
    const formData = new FormData(e.target);
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
      inspeccion: revType === 'A' ? revA_inspeccion : false,
      frenos: revType === 'A' ? revA_frenos : false,
      tipoB: revType === 'B' ? revB_tipo : null
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
          jobData.originContactName = matchedOrigin.contactName;
          jobData.originContactPhone = matchedOrigin.contactPhone;
          jobData.originAddress = matchedOrigin.address || '';
          jobData.originCommune = matchedOrigin.commune || '';
       }
    }

    // NUEVO: BUSCAR DESTINO EN EL DIRECTORIO
    const destinationValue = jobData.destination?.trim().toLowerCase();
    if (destinationValue) {
       const matchedDest = directoryList.find(d => d.placeName.trim().toLowerCase() === destinationValue);
       if (matchedDest) {
          jobData.destContactName = matchedDest.contactName;
          jobData.destContactPhone = matchedDest.contactPhone;
          jobData.destAddress = matchedDest.address || '';
          jobData.destCommune = matchedDest.commune || '';
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
            if (plate || vin) vehiclesToProcess.push({ plate, vin, brand, model, vehicleType });
        } else {
            vehiclesToProcess = [{ plate, vin, brand, model, vehicleType }];
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

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 mb-28">
      
      {/* NUEVO: Datalist invisible para autocompletar destinos */}
      <datalist id="directory-destinations">
        {directoryList.map((dir, idx) => (
          <option key={idx} value={dir.placeName}>{dir.contactName}</option>
        ))}
      </datalist>

      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-200">{jobToEdit ? 'Editar Trabajo' : 'Crear Nuevo Trabajo'}</h2>
        {jobToEdit && <button type="button" onClick={onCancelEdit} className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 p-2 rounded-xl transition"><X className="w-6 h-6"/></button>}
      </div>
      <form onSubmit={handleCreateOrUpdateJob} className="space-y-6">

        {/* BOTÓN DE URGENCIA */}
        <div className="flex justify-end -mt-2">
          <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all shadow-sm ${isUrgent ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900'}`}>
            <AlertCircle className={`w-5 h-5 ${isUrgent ? 'animate-pulse text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
            <span className="font-extrabold text-sm uppercase tracking-wider">{isUrgent ? '🚨 Trabajo Urgente' : 'Marcar como Urgente'}</span>
            <div className="relative flex items-center ml-2">
              <input type="checkbox" className="sr-only" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
              <div className={`block w-10 h-6 rounded-full transition-colors ${isUrgent ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
              <div className={`absolute left-1 top-1 bg-white dark:bg-slate-900 w-4 h-4 rounded-full transition-transform ${isUrgent ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
        </div>
        
        {/* NUEVO TABS DE MODO DE OPERACIÓN */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mb-2 shadow-inner">
          <button type="button" onClick={() => setOperationMode('traslado')} className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition-all duration-200 ${operationMode === 'traslado' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}>🚚 Traslado de Vehículo</button>
          <button type="button" onClick={() => setOperationMode('servicio')} className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition-all duration-200 ${operationMode === 'servicio' ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}>🛠️ Servicio en Terreno</button>
        </div>

        {operationMode === 'traslado' ? (
          <>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">1. Tipo de Servicio</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Traslado Local */}
                <button type="button" onClick={()=>setTripType('traslado')} className={`relative flex items-center gap-3 p-3.5 border-2 rounded-2xl transition-all duration-300 w-full group overflow-hidden ${tripType === 'traslado' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 dark:border-blue-700/50 hover:bg-slate-50 dark:bg-slate-900'}`}>
                   <div className={`p-2 rounded-xl transition-colors shrink-0 ${tripType === 'traslado' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:bg-blue-900/40 group-hover:text-blue-600 dark:text-blue-400'}`}>
                      📍
                   </div>
                   <span className={`font-black text-sm flex-1 text-left ${tripType === 'traslado' ? 'text-blue-800 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>Traslado Local</span>
                   {tripType === 'traslado' && <CheckCircle className="w-5 h-5 text-blue-500 animate-in zoom-in shrink-0"/>}
                </button>

                {/* A Regiones */}
                <button type="button" onClick={()=>setTripType('viaje')} className={`relative flex items-center gap-3 p-3.5 border-2 rounded-2xl transition-all duration-300 w-full group overflow-hidden ${tripType === 'viaje' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:border-indigo-700/50 hover:bg-slate-50 dark:bg-slate-900'}`}>
                   <div className={`p-2 rounded-xl transition-colors shrink-0 ${tripType === 'viaje' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-100 dark:bg-indigo-900/40 group-hover:text-indigo-600 dark:text-indigo-400'}`}>
                      🛣️
                   </div>
                   <span className={`font-black text-sm flex-1 text-left ${tripType === 'viaje' ? 'text-indigo-800 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>A Regiones</span>
                   {tripType === 'viaje' && <CheckCircle className="w-5 h-5 text-indigo-500 animate-in zoom-in shrink-0"/>}
                </button>

                {/* Revisión Técnica */}
                <button type="button" onClick={() => {
                   setTripType('revision');
                   // MAGIA: Auto-asignamos la primera planta PRT si no hay destino previo,
                   // o si el destino anterior no era una PRT
                   const destInput = document.querySelector('select[name="prtSelect"]');
                   if (!jobToEdit && prtList.length > 0 && (!destInput || !destInput.value)) {
                      setTimeout(() => {
                         const select = document.querySelector('select[name="prtSelect"]');
                         if (select) select.value = prtList[0].name;
                      }, 100);
                   }
                }} className={`relative flex items-center gap-3 p-3.5 border-2 rounded-2xl transition-all duration-300 w-full group overflow-hidden ${tripType === 'revision' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:border-emerald-700/50 hover:bg-slate-50 dark:bg-slate-900'}`}>
                   <div className={`p-2 rounded-xl transition-colors shrink-0 ${tripType === 'revision' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-100 dark:bg-emerald-900/40 group-hover:text-emerald-600 dark:text-emerald-400'}`}>
                      📋
                   </div>
                   <span className={`font-black text-sm flex-1 text-left ${tripType === 'revision' ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>Revisión Técnica</span>
                   {tripType === 'revision' && <CheckCircle className="w-5 h-5 text-emerald-500 animate-in zoom-in shrink-0"/>}
                </button>
              </div>
              {tripType === 'revision' && (
                <div className="p-4 bg-white dark:bg-slate-900 border-2 border-blue-100 dark:border-blue-800/50 rounded-xl space-y-4 mt-4 animate-in fade-in">
                   <h4 className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase">Detalle Revisión Técnica</h4>
                   <div className="grid grid-cols-2 gap-3">
                     <select value={revType} onChange={e=>setRevType(e.target.value)} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-300">
                       <option value="A">Clase A</option>
                       <option value="B">Clase B</option>
                     </select>
                     <select value={revModalidad} onChange={e=>setRevModalidad(e.target.value)} className={`w-full border-2 p-3 text-sm rounded-xl outline-none font-bold shadow-sm ${revModalidad === 'ayuda' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:border-blue-500'}`}>
                       <option value="legal">Legal (Normal)</option>
                       <option value="ayuda">Con Ayuda</option>
                     </select>
                   </div>
                   {revType === 'A' && (
                     <div className="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                       <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_gases} onChange={e=>setRevA_gases(e.target.checked)} className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded"/> Gases</label>
                       <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_revision} onChange={e=>setRevA_revision(e.target.checked)} className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded"/> Revisión</label>
                       <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_inspeccion} onChange={e=>setRevA_inspeccion(e.target.checked)} className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded"/> Insp. Visual</label>
                       <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_frenos} onChange={e=>setRevA_frenos(e.target.checked)} className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded"/> Cert. Frenos</label>
                     </div>
                   )}
                   {revType === 'B' && (
                     <select value={revB_tipo} onChange={e=>setRevB_tipo(e.target.value)} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900">
                       <option value="completa">Revisión Completa</option>
                       <option value="gases">Sólo Gases</option>
                     </select>
                   )}
                </div>
              )}
            </div>

            <div className={`p-4 sm:p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 transition-colors duration-300 ${vehicleFoundStatus === 'found' ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50' : 'bg-slate-50 dark:bg-slate-900 border border-transparent'}`}>
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 
                 <div className="flex items-center gap-3">
                    {vehiclePhoto && (
                       <img 
                          src={vehiclePhoto} 
                          alt="Perfil Vehículo" 
                          className="w-12 h-12 rounded-xl object-cover border-2 border-white dark:border-slate-800 shadow-md animate-in zoom-in shrink-0"
                       />
                    )}
                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 flex flex-col sm:block">
                       2. Vehículo 
                       <span className="text-xs text-blue-500 font-bold sm:ml-2">(Escribe para autocompletar)</span>
                    </h3>
                 </div>
                 
                 {/* BOTÓN MÁGICO DE ESCÁNER DE GUÍA DE DESPACHO (AHORA ABRE CÁMARA NATIVA) */}
                 <div className="w-full sm:w-auto shrink-0 flex gap-2">
                   {/* Botón para abrir la InAppCamera */}
                   <button type="button" onClick={() => setCameraConfig({ isOpen: true })} disabled={isOcrProcessing} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${isOcrProcessing ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400' : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}>
                     {isOcrProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                     {isOcrProcessing ? 'Leyendo...' : 'Escanear Guía'}
                   </button>
                   
                   {/* Botón secundario para subir PDF/Imagen de archivo */}
                   <div className="relative flex-1 sm:flex-none">
                     <input type="file" accept="image/*,application/pdf" onChange={handleOcrUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isOcrProcessing} />
                     <button type="button" disabled={isOcrProcessing} className="w-full h-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/30 transition-colors">
                       <FileText className="w-4 h-4"/> Archivo
                     </button>
                   </div>
                 </div>
               </div>

               <div className="flex items-center -mt-2 min-h-[24px]">
                 {isSearchingVehicle && <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-md animate-pulse">Buscando en base de datos...</span>}
                 {vehicleFoundStatus === 'found' && !isSearchingVehicle && <span className="text-xs font-black text-green-700 dark:text-green-400 bg-green-200 px-2 py-1 rounded-md flex items-center gap-1"><CheckCircle className="w-3 h-3"/> ¡Vehículo encontrado en historial!</span>}
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <input value={plate} onChange={e=>handleVehicleSearch(e.target.value.replace(/[^a-zA-Z0-9]/g, ''), 'plate')} maxLength="6" type="text" placeholder="Patente (Ej. ABCD12)" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className={`w-full border-2 p-3 text-sm rounded-xl uppercase outline-none font-black bg-white dark:bg-slate-900 shadow-sm transition-colors ${isSearchingVehicle ? 'border-blue-400 ring-2 ring-blue-100' : vehicleFoundStatus === 'found' ? 'border-green-400 text-green-800 dark:text-green-300' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 text-slate-800 dark:text-slate-200'}`} />
                 <input value={vin} onChange={e=>handleVehicleSearch(e.target.value.replace(/[^a-zA-Z0-9]/g, ''), 'vin')} maxLength="17" type="text" placeholder="VIN / Chasis" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className={`w-full border-2 p-3 text-sm rounded-xl uppercase outline-none font-black bg-white dark:bg-slate-900 shadow-sm transition-colors ${isSearchingVehicle ? 'border-blue-400 ring-2 ring-blue-100' : vehicleFoundStatus === 'found' ? 'border-green-400 text-green-800 dark:text-green-300' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 text-slate-800 dark:text-slate-200'}`} />
                 {/* NUEVO: Listas de autocompletado inteligente (Aprende de tu propia flota) */}
                 <datalist id="brands-list">
                   {[...new Set(vehicles.map(v => v.brand?.toUpperCase().trim()).filter(Boolean))].sort().map((b, i) => (
                     <option key={i} value={b} />
                   ))}
                 </datalist>
                 <datalist id="models-list">
                   {[...new Set(vehicles.filter(v => v.brand?.toUpperCase().trim() === brand?.toUpperCase().trim()).map(v => v.model?.toUpperCase().trim()).filter(Boolean))].sort().map((m, i) => (
                     <option key={i} value={m} />
                   ))}
                 </datalist>

                 <input value={brand} onChange={e=>setBrand(e.target.value.toUpperCase())} list="brands-list" type="text" placeholder="Marca (Ej. CHEVROLET)" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className={`w-full border-2 p-3 text-sm rounded-xl outline-none font-semibold bg-white dark:bg-slate-900 transition-colors uppercase ${vehicleFoundStatus === 'found' ? 'border-green-300 dark:border-green-700/50 text-green-800 dark:text-green-300' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-800 dark:text-slate-200'}`} />
                 <input value={model} onChange={e=>setModel(e.target.value.toUpperCase())} list="models-list" type="text" placeholder="Modelo (Ej. SPARK)" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className={`w-full border-2 p-3 text-sm rounded-xl outline-none font-semibold bg-white dark:bg-slate-900 transition-colors uppercase ${vehicleFoundStatus === 'found' ? 'border-green-300 dark:border-green-700/50 text-green-800 dark:text-green-300' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-800 dark:text-slate-200'}`} />

                 <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className={`w-full border-2 p-3 text-sm rounded-xl col-span-2 outline-none font-bold bg-white dark:bg-slate-900 transition-colors ${vehicleFoundStatus === 'found' ? 'border-green-300 dark:border-green-700/50 text-green-800 dark:text-green-300' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-700 dark:text-slate-300'}`}>
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

               {/* NUEVO: TRASLADO MASIVO DE VEHÍCULOS */}
               {!jobToEdit && (
                 <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    {multiVehicles.length > 0 && (
                      <div className="mb-3 space-y-2">
                         <p className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase">Vehículos en Lista Masiva ({multiVehicles.length}):</p>
                         {multiVehicles.map((v, idx) => (
                           <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm animate-in zoom-in">
                              <div>
                                 <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase">{v.plate || v.vin || 'S/N'}</p>
                                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{v.brand} {v.model}</p>
                              </div>
                              <button type="button" onClick={() => handleRemoveMultiVehicle(idx)} className="text-red-400 hover:text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
                           </div>
                         ))}
                      </div>
                    )}
                    <button type="button" onClick={handleAddMultiVehicle} className="w-full sm:w-auto text-xs font-extrabold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:bg-blue-900/30 hover:text-blue-600 dark:text-blue-400 hover:border-blue-200 dark:border-blue-800/50 py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm">
                       <Plus className="w-4 h-4"/> Añadir a Lista Masiva (Permite agregar otro)
                    </button>
                 </div>
               )}
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">3. Programación y Ruta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Fecha y Hora de Traslado</label>
                   <div className="flex gap-2">
                     <input name="scheduledDate" type="date" defaultValue={jobToEdit?.scheduledDate || todayStr} required className="w-3/5 border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300" />
                     <input name="scheduledTime" type="time" defaultValue={jobToEdit?.scheduledTime || ''} className="w-2/5 border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300" />
                   </div>
                </div>
                <div className="space-y-1 relative z-[999]">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Cliente</label>
                  <CustomClientSelector 
                    value={selectedClient} 
                    onChange={(val) => setSelectedClient(val)} 
                    clients={allClientsList} 
                    placeholder="Seleccione Cliente (Opcional)" 
                  />
                  {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900 mt-2 animate-in fade-in slide-in-from-top-2" />}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                   <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Lugar de Retiro (Origen)</label>
                   <input name="origin" list="directory-destinations" defaultValue={jobToEdit?.origin || ''} required type="text" placeholder="Desde (Origen)" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900" />
                </div>
                
                {tripType === 'revision' ? (
                  <div className="space-y-3 md:row-span-2">
                     <div className="space-y-1">
                        <label className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider ml-1">Planta de Revisión</label>
                        <select key={`prtSelect-${prtList.length}`} name="prtSelect" defaultValue={jobToEdit?.destination?.split('->')[0]?.trim() || (prtList.length > 0 ? prtList[0].name : '')} required className="w-full border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/30 p-3 text-sm rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-800 dark:text-emerald-300 shadow-sm cursor-pointer">
                          <option value="">Selecciona la Planta...</option>
                          {prtList.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1 relative z-10">
                        <label className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider ml-1">Destino Final (Post-PRT)</label>
                        <input name="destFinal" list="directory-destinations" defaultValue={jobToEdit?.destination?.split('->')[1]?.trim() || ''} type="text" placeholder="Ej: Av. San José (Opcional)" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-blue-200 dark:border-blue-800/50 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900" />
                     </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                     <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Destino Final</label>
                     <input name="destination" list="directory-destinations" defaultValue={jobToEdit?.destination || ''} required type="text" placeholder="Hasta (Destino)" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900" />
                  </div>
                )}
              </div>

              {/* PARADAS INTERMEDIAS */}
              {tripType !== 'revision' && (
                <div className="pt-2 space-y-2 mt-2">
                   {waypoints.map((wp, idx) => (
                      <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                         <div className="bg-slate-200 dark:bg-slate-700 w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-inner"><span className="text-xs font-black text-slate-500 dark:text-slate-400">{idx + 1}</span></div>
                         <input type="text" value={wp} onChange={(e) => handleWaypointChange(idx, e.target.value)} placeholder={`Parada intermedia ${idx + 1} (Ej: Pesaje, Notaría, Carga...)`} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-2.5 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900" />
                         <button type="button" onClick={() => handleRemoveWaypoint(idx)} className="p-2.5 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-xl hover:bg-red-100 dark:bg-red-900/40 transition-colors border border-red-100 dark:border-red-800/50"><X className="w-4 h-4"/></button>
                      </div>
                   ))}
                   <button type="button" onClick={handleAddWaypoint} className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:bg-blue-900/40 py-2.5 px-4 rounded-xl transition-colors flex items-center gap-1.5 w-full sm:w-fit border border-blue-200 dark:border-blue-800/50 shadow-sm">
                      <Plus className="w-4 h-4"/> + Añadir Parada Intermedia
                   </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* VISTA SERVICIO SIMPLE */
          <div className="bg-purple-50 dark:bg-purple-900/30 p-4 sm:p-6 rounded-2xl space-y-5 border border-purple-100 dark:border-purple-800/50 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-base font-black text-purple-800 dark:text-purple-300">Detalles del Servicio</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider ml-1">Descripción del Trabajo</label>
              <textarea 
                 value={description} 
                 onChange={e=>setDescription(e.target.value)} 
                 required={!(isPintura || isGrabado)} 
                 rows="3" 
                 placeholder={(isPintura || isGrabado) ? "Opcional. El sistema redactará el detalle de la pintura/grabado automáticamente." : "Ej: Retiro de documentos en notaría..."} 
                 className="w-full border-2 border-purple-200 dark:border-purple-800/50 p-3 text-sm rounded-xl outline-none focus:border-purple-500 font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none shadow-sm" 
              />
            </div>
            
            {/* NUEVO: Opciones Especiales (Pintura / Grabado) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-purple-100 dark:border-purple-800/50 shadow-sm space-y-4">
               <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-purple-50 dark:bg-purple-900/30 rounded-lg transition-colors">
                         <input type="checkbox" checked={isPintura} onChange={(e) => setIsPintura(e.target.checked)} className="w-5 h-5 text-purple-600 dark:text-purple-400 rounded border-purple-300 dark:border-purple-700/50 focus:ring-purple-500" />
                         <span className="text-sm font-extrabold text-slate-700 dark:text-slate-300">🎨 Pintura de Patentes</span>
                      </label>
                      {isPintura && (
                         <div className="pl-9 pr-2 animate-in slide-in-from-top-1">
                             <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 p-2 rounded-xl border-2 border-purple-100 dark:border-purple-800/50">
                                <span className="text-xs font-bold text-purple-800 dark:text-purple-300 flex-1">Cantidad:</span>
                                <button type="button" onClick={() => setQtyPintura(2)} className={`px-3 py-1 rounded-lg text-sm font-black transition-colors ${Number(qtyPintura) === 2 ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-200/50 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-700/50'}`}>2</button>
                                <input type="number" min="1" max="10" value={qtyPintura} onChange={(e) => setQtyPintura(e.target.value)} className="w-16 text-center border-none p-1 text-sm rounded-lg outline-none font-black text-purple-900 dark:text-purple-300 bg-white dark:bg-slate-900 shadow-sm" />
                             </div>
                         </div>
                      )}
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-purple-50 dark:bg-purple-900/30 rounded-lg transition-colors">
                         <input type="checkbox" checked={isGrabado} onChange={(e) => setIsGrabado(e.target.checked)} className="w-5 h-5 text-purple-600 dark:text-purple-400 rounded border-purple-300 dark:border-purple-700/50 focus:ring-purple-500" />
                         <span className="text-sm font-extrabold text-slate-700 dark:text-slate-300">🪟 Grabado de Vidrios</span>
                      </label>
                      {isGrabado && (
                         <div className="pl-9 pr-2 animate-in slide-in-from-top-1">
                             <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 p-2 rounded-xl border-2 border-purple-100 dark:border-purple-800/50">
                                <span className="text-xs font-bold text-purple-800 dark:text-purple-300 flex-1">Cantidad:</span>
                                <button type="button" onClick={() => setQtyGrabado(3)} className={`px-3 py-1 rounded-lg text-sm font-black transition-colors ${Number(qtyGrabado) === 3 ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-200/50 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-700/50'}`}>3</button>
                                <input type="number" min="1" max="20" value={qtyGrabado} onChange={(e) => setQtyGrabado(e.target.value)} className="w-16 text-center border-none p-1 text-sm rounded-lg outline-none font-black text-purple-900 dark:text-purple-300 bg-white dark:bg-slate-900 shadow-sm" />
                             </div>
                         </div>
                      )}
                  </div>
               </div>
               
               {(isPintura || isGrabado) && (
                  <div className="animate-in fade-in slide-in-from-top-2 pt-2 border-t border-purple-50">
                     <label className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider ml-1 mb-1 block">Asociar a un Vehículo en Curso (Opcional)</label>
                     <select 
                        value={associatedJobId} 
                        onChange={(e) => {
                           const newId = e.target.value;
                           setAssociatedJobId(newId);
                           
                           // AUTO-COMPLETADO DEL CLIENTE
                           if (newId) {
                              const matchJob = activeJobsList.find(j => j.id === newId);
                              if (matchJob && matchJob.client) {
                                 if (allClientsList.includes(matchJob.client)) {
                                    setSelectedClient(matchJob.client);
                                 } else {
                                    setSelectedClient('OTRO');
                                    setManualClient(matchJob.client);
                                 }
                              }
                           }
                        }} 
                        className="w-full border-2 border-purple-200 dark:border-purple-800/50 p-3 text-sm rounded-xl outline-none focus:border-purple-500 font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm"
                     >
                        <option value="">-- Seleccionar vehículo activo --</option>
                        {activeJobsList.filter(j => j.tripType !== 'simple').map(j => (
                           <option key={j.id} value={j.id}>
                              {j.plate || j.vin || 'S/N'} - {j.brand} {j.model} ({j.client})
                           </option>
                        ))}
                     </select>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider ml-1">Fecha y Hora de Ejecución</label>
                 <div className="flex gap-2">
                   <input name="scheduledDate" type="date" defaultValue={jobToEdit?.scheduledDate || todayStr} required className="w-3/5 border-2 border-purple-200 dark:border-purple-800/50 p-3 text-sm rounded-xl outline-none focus:border-purple-500 font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm" />
                   <input name="scheduledTime" type="time" defaultValue={jobToEdit?.scheduledTime || ''} className="w-2/5 border-2 border-purple-200 dark:border-purple-800/50 p-3 text-sm rounded-xl outline-none focus:border-purple-500 font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm" />
                 </div>
              </div>
              <div className="space-y-1 relative z-[999]">
                <label className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider ml-1">Cliente Asociado (Opcional)</label>
                <CustomClientSelector 
                  value={selectedClient} 
                  onChange={(val) => setSelectedClient(val)} 
                  clients={allClientsList} 
                  placeholder="Seleccione Cliente" 
                />
                {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-purple-200 dark:border-purple-800/50 p-3 text-sm rounded-xl outline-none focus:border-purple-500 font-bold bg-white dark:bg-slate-900 mt-2 animate-in fade-in shadow-sm" />}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider ml-1">Lugar de Trabajo</label>
                <input name="origin" list="directory-destinations" defaultValue={jobToEdit?.origin || ''} required type="text" placeholder="¿Dónde se realizará?" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-purple-200 dark:border-purple-800/50 p-3 text-sm rounded-xl outline-none focus:border-purple-500 font-bold bg-white dark:bg-slate-900 shadow-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider ml-1">Hasta / Destino (Opcional)</label>
                <input name="destination" list="directory-destinations" defaultValue={jobToEdit?.destination || ''} type="text" placeholder="Si requiere moverse a otro lugar" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-purple-200 dark:border-purple-800/50 p-3 text-sm rounded-xl outline-none focus:border-purple-500 font-bold bg-white dark:bg-slate-900 shadow-sm" />
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 rounded-2xl space-y-4">
           <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">4. Conductores <span className="text-xs text-red-500 font-normal">(Seleccionar o ingresar correo)</span></h3>

           <div className="max-h-64 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drivers.length === 0 ? <p className="text-sm text-slate-400 p-4 font-semibold col-span-full text-center">No hay conductores registrados.</p> : (() => {
                 const visibleDrivers = drivers.filter(d => !d.isHidden && !(d.role === 'driver_regions' && tripType !== 'viaje'));
                 if (visibleDrivers.length === 0) return <p className="text-sm text-slate-400 p-4 font-semibold col-span-full text-center">No hay conductores disponibles.</p>;
                 return visibleDrivers.map(d => {
                    const isSelected = selectedDriversUI.includes(d.id);
                    return (
                    <label key={d.id} className="relative flex cursor-pointer group">
                      <input type="checkbox" name="assignedDriverId" value={d.id} checked={isSelected} onChange={() => setSelectedDriversUI(prev => prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id])} className="sr-only" />
                      
                      <div className={`w-full flex items-center p-3 bg-white dark:bg-slate-900 border-2 rounded-2xl transition-all ${isSelected ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700 group-hover:border-blue-300 dark:border-blue-700/50'}`}>
                        <div className={`p-2.5 rounded-xl transition-colors shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div className="ml-3 flex-1 overflow-hidden">
                          <span className={`block text-sm font-extrabold truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>{d.name}</span>
                          <span className={`block text-[10px] font-bold truncate mt-0.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{d.email}</span>
                        </div>
                        <CheckCircle className={`w-6 h-6 transition-transform duration-200 shrink-0 ml-2 ${isSelected ? 'scale-100 text-blue-600 dark:text-blue-400' : 'scale-0 text-slate-300'}`} />
                      </div>
                    </label>
                  )});
              })()}
           </div>

           <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 p-4 rounded-xl mt-4">
              <label className="text-xs font-extrabold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1 block">Conductor Externo (Spot / Única Vez)</label>
              <input 
                 type="email" 
                 value={spotDriverEmail} 
                 onChange={(e) => setSpotDriverEmail(e.target.value)} 
                 placeholder="correo@ejemplo.com (Opcional si seleccionaste uno arriba)" 
                 className="w-full border-2 border-blue-200 dark:border-blue-800/50 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm placeholder:text-slate-400"
              />
           </div>
        </div>
        <div className="flex gap-3 pt-2">
          {jobToEdit && <button type="button" onClick={onCancelEdit} className="w-1/3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-8 py-3 rounded-2xl font-extrabold text-sm sm:text-lg transition-colors">Cancelar</button>}
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-extrabold text-sm sm:text-lg transition-colors shadow-lg shadow-blue-200 disabled:opacity-50">{isSubmitting ? 'Procesando...' : (jobToEdit ? 'Actualizar Trabajo' : 'Guardar y Asignar')}</button>
        </div>
      </form>

      {/* --- CÁMARA INTERNA CENTRALIZADA --- */}
      <InAppCamera 
        isOpen={cameraConfig.isOpen} 
        title="Escáner Inteligente"
        onClose={() => setCameraConfig({ isOpen: false })}
        onCapture={handleOcrUpload}
      />
    </div>
  );
}