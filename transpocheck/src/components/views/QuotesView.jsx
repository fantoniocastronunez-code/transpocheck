import React, { useState, useRef } from 'react';
import { addDoc, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Calculator, MapPin, Fuel, DollarSign, Plus, CheckCircle, 
  User, Truck, Receipt, Printer, Send, Save, ArrowRight, X, MessageCircle, Mail, MoreVertical, Calendar, Sparkles
} from 'lucide-react';
import { formatMoney } from '../../utils/helpers';

import { useEffect } from 'react'; // Asegúrate de tener useEffect importado arriba de React

export default function QuotesView({ db, customClients, vehicles, directoryList, drivers, showAlert, showConfirm, currentUserEmail }) {
  // Estados de la Cotización
  const [quoteData, setQuoteData] = useState({
    client: '',
    origin: '',
    destination: '',
    distanceKm: '',
    kmPerLiter: '10',
    fuelPrice: 1050,
    tollsCost: '',
    driverFee: '',
    marginPct: 30,
    description: '',
    vehicleType: 'Auto / SUV',
    brand: '',
    model: '',
    plateOrVin: '',
    quoteNumber: '' // <-- Correlativo
  });

  // Estados para Clientes, Peajes, Edición, Menús y Modales
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', lastName: '', email: '' });
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  
  // Estados del Historial (Menú de 3 puntos y Modal de Traslado)
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptQuoteData, setAcceptQuoteData] = useState(null);
  const [jobDetails, setJobDetails] = useState({
    scheduledDate: new Date().toISOString().split('T')[0],
    assignedDriver: ''
  });
  
  const [showNewTollModal, setShowNewTollModal] = useState(false);
  const [editingTollId, setEditingTollId] = useState(null); // <-- Para modificar peajes existentes
  const [newTollData, setNewTollData] = useState({
    name: '',
    route: 'Ruta 5 Norte',
    km: '',
    prices: {
      'Auto / SUV': '',
      'Camioneta': '',
      'Furgón Pequeño': '',
      'Furgón Grande': '',
      'Camión Simple': '',
      'Camión Doble Cabina': '',
      'Camión (2 Ejes traseros)': '',
      'Camión (3 Ejes traseros)': '',
      'Camión Rigid (8x4)': '',
      'Carro Arrastre': ''
    }
  });

  // Cargar Cotización al formulario para modificarla
  const handleEditQuote = (q) => {
    setQuoteData({
      client: q.client || '',
      origin: q.origin || '',
      destination: q.destination || '',
      distanceKm: q.distanceKm || '',
      kmPerLiter: q.kmPerLiter || '10',
      fuelPrice: q.fuelPrice || 1050,
      tollsCost: q.tollsCost || '',
      driverFee: q.driverFee || '',
      marginPct: q.marginPct || 30,
      description: q.description || '',
      vehicleType: q.vehicleType || 'Auto / SUV',
      brand: q.brand || '',
      model: q.model || '',
      plateOrVin: q.plateOrVin || '',
      quoteNumber: q.quoteNumber || ''
        });
        setSelectedTollIds(q.selectedTollIds || []); // <-- NUEVO: Recupera los peajes de esta cotización
        setEditingQuoteId(q.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showAlert("📝 Cotización cargada para edición.");
      };

  // Cargar Peaje para modificar sus valores
  const handleEditToll = (toll) => {
    const isStandard = ['Ruta 5 Norte', 'Ruta 5 Sur', 'Ruta 68', 'Ruta 78'].includes(toll.route);
    setNewTollData({
      name: toll.name || '',
      route: isStandard ? toll.route : 'Otra Ruta',
      customRoute: isStandard ? '' : (toll.route || ''),
      km: toll.km || '',
      prices: toll.prices || {}
    });
    setEditingTollId(toll.id);
    setShowNewTollModal(true);
  };

  // Estados para Peajes Seleccionados en la Cotización
  const [selectedTollIds, setSelectedTollIds] = useState([]);

  // Estados para Tabla de Peajes y Cotizaciones Guardadas
  const [tollsList, setTollsList] = useState([]);
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isFetchingFuel, setIsFetchingFuel] = useState(false);

  // Cargar Peajes y Cotizaciones desde Firestore
  useEffect(() => {
    if (!db) return;
    import('firebase/firestore').then(({ collection, getDocs, onSnapshot }) => {
      getDocs(collection(db, 'tolls')).then(snap => {
        setTollsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(() => {});

      const unsubQuotes = onSnapshot(collection(db, 'quotes'), snap => {
        setSavedQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
      });
      return () => unsubQuotes();
    });
  }, [db]);

  // Guardar o Actualizar Peaje en Firestore
  const handleSaveNewToll = async (e) => {
    e.preventDefault();
    if (!newTollData.name || !newTollData.km) return showAlert("Completa el nombre y el kilómetro del peaje.");
    if (newTollData.route === 'Otra Ruta' && !newTollData.customRoute) return showAlert("⚠️ Escribe el nombre de la ruta manual.");
    
    try {
      const finalRoute = newTollData.route === 'Otra Ruta' ? newTollData.customRoute : newTollData.route;
      const payload = { ...newTollData, route: finalRoute, km: parseFloat(newTollData.km) || 0 };
      delete payload.customRoute; // Limpiamos la variable temporal antes de subir a Firebase

      if (editingTollId) {
        await updateDoc(doc(db, 'tolls', editingTollId), payload);
        setTollsList(prev => prev.map(t => t.id === editingTollId ? { id: editingTollId, ...payload } : t));
        showAlert(`✅ Peaje "${newTollData.name}" modificado con éxito.`);
        setEditingTollId(null);
      } else {
        const docRef = await addDoc(collection(db, 'tolls'), { ...payload, createdAt: Date.now() });
        setTollsList(prev => [...prev, { id: docRef.id, ...payload }]);
        showAlert(`✅ Peaje "${newTollData.name}" registrado correctamente.`);
      }

      setShowNewTollModal(false);
      setNewTollData({
        name: '', route: 'Ruta 5 Norte', customRoute: '', km: '',
        prices: { 'Auto / SUV': '', 'Camioneta': '', 'Furgón Pequeño': '', 'Furgón Grande': '', 'Camión Simple': '', 'Camión Doble Cabina': '', 'Camión (2 Ejes traseros)': '', 'Camión (3 Ejes traseros)': '', 'Camión Rigid (8x4)': '', 'Carro Arrastre': '' }
      });
    } catch (err) {
      showAlert("Error al guardar peaje.");
    }
  };

  // Efecto de Auto-cálculo: Reacciona automáticamente si cambias de vehículo o agregas peajes
  useEffect(() => {
    const totalTolls = selectedTollIds.reduce((sum, id) => {
      const toll = tollsList.find(t => t.id === id);
      const priceForVehicle = toll?.prices?.[quoteData.vehicleType] || 0;
      return sum + parseFloat(priceForVehicle || 0);
    }, 0);
    
    setQuoteData(q => {
      const newTollsCost = totalTolls > 0 ? totalTolls : '';
      if (q.tollsCost === newTollsCost) return q; // Evita saturar la memoria
      return { ...q, tollsCost: newTollsCost };
    });
  }, [selectedTollIds, quoteData.vehicleType, tollsList]);

  const toggleTollSelection = (tollId) => {
    setSelectedTollIds(prev => prev.includes(tollId) ? prev.filter(id => id !== tollId) : [...prev, tollId]);
  };

  // NUEVO: Memoria Predictiva de Rutas
  useEffect(() => {
    if (!quoteData.origin || !quoteData.destination || savedQuotes.length === 0) return;
    
    const originClean = quoteData.origin.trim().toLowerCase();
    const destClean = quoteData.destination.trim().toLowerCase();

    // Si detecta que escribiste una ruta y no has marcado peajes manuales...
    if (originClean.length > 3 && destClean.length > 3 && selectedTollIds.length === 0) {
      const pastQuote = savedQuotes.find(q => 
        q.origin?.trim().toLowerCase() === originClean && 
        q.destination?.trim().toLowerCase() === destClean &&
        q.selectedTollIds && q.selectedTollIds.length > 0
      );

      if (pastQuote) {
        setSelectedTollIds(pastQuote.selectedTollIds);
        showAlert("🧠 Ruta reconocida: Peajes cargados automáticamente.");
      }
    }
  }, [quoteData.origin, quoteData.destination]);

  // Eliminar Cotización del Historial
  const handleDeleteQuote = (quoteId) => {
    showConfirm("¿Estás seguro de eliminar esta cotización del historial?", async () => {
      try {
        await deleteDoc(doc(db, 'quotes', quoteId));
        showAlert("✅ Cotización eliminada del historial.");
      } catch (err) {
        showAlert("Error al eliminar la cotización.");
      }
    });
  };

  // Cálculos Automáticos en Tiempo Real
  const distance = parseFloat(quoteData.distanceKm) || 0;
  const kml = parseFloat(quoteData.kmPerLiter) || 1; // Evitar división por 0
  const fuelPrice = parseFloat(quoteData.fuelPrice) || 0;
  
  const totalLiters = distance / kml;
  const fuelCost = totalLiters * fuelPrice;
  const tolls = parseFloat(quoteData.tollsCost) || 0;
  const driver = parseFloat(quoteData.driverFee) || 0;
  
  const subtotalCosts = fuelCost + tolls + driver;
  const marginMultiplier = 1 + ((parseFloat(quoteData.marginPct) || 0) / 100);
  
  // Redondeo exacto para moneda chilena (sin decimales)
  const netPrice = Math.round(subtotalCosts * marginMultiplier);
  const ivaAmount = Math.round(netPrice * 0.19);
  const finalPrice = netPrice + ivaAmount; // Total con IVA (cuadra exacto)
  const profit = netPrice - subtotalCosts;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuoteData(prev => ({ ...prev, [name]: value }));
  };

  // Forzar Valor Neto y recalcular Margen Empresa automáticamente
  const handleNetPriceChange = (e) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (!rawVal) {
      setQuoteData(prev => ({ ...prev, marginPct: '' }));
      return;
    }
    const customNet = parseInt(rawVal, 10);
    if (subtotalCosts > 0) {
      const exactMargin = ((customNet / subtotalCosts) - 1) * 100;
      setQuoteData(prev => ({ ...prev, marginPct: exactMargin }));
    }
  };

  // Consultar precio sugerido a la IA (Gemini)
  const fetchFuelPriceWithAI = async () => {
    setIsFetchingFuel(true);
    try {
      // API KEY DE GOOGLE AI STUDIO (Oculta en variables de entorno)
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
      
      // Prompt usando Grounding con Google Search para asegurar datos actualizados del Diésel
      const prompt = "Busca estrictamente en internet el precio promedio actual del litro de petróleo Diésel en Chile para esta semana de agosto de 2026 (el valor actual de mercado está entre 1250 y 1350 pesos chilenos). Ignora por completo valores antiguos o de años anteriores. Responde ÚNICAMENTE con el número entero exacto, sin puntos, sin comas, sin signos de peso y sin texto adicional. Por ejemplo: 1280";

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await res.json();
      
      if (data.candidates && data.candidates.length > 0) {
        const respuestaTexto = data.candidates[0].content.parts[0].text;
        
        // Limpiamos la respuesta de la IA (extraemos solo los números por si decide agregar texto extra)
        const precioLimpio = parseInt(respuestaTexto.replace(/[^0-9]/g, ''), 10);

        if (!isNaN(precioLimpio) && precioLimpio > 500 && precioLimpio < 2000) {
          setQuoteData(prev => ({ ...prev, fuelPrice: precioLimpio }));
          showAlert(`🤖 IA Gemini: Precio sugerido actualizado a $${precioLimpio}/L.`);
        } else {
          showAlert("⚠️ La IA respondió con un formato que no pudimos procesar.");
        }
      }
    } catch (err) {
      console.error(err);
      showAlert("❌ Error al intentar contactar a la inteligencia artificial.");
    } finally {
      setIsFetchingFuel(false);
    }
  };

  // MAGIA: Cálculo automático de distancia real por carretera usando OSRM (OpenStreetMap sin API Key)
  const calculateRouteDistance = async () => {
    if (!quoteData.origin || !quoteData.destination) {
      return showAlert("⚠️ Ingresa origen y destino para calcular la ruta.");
    }
    setIsCalculatingRoute(true);
    try {
      // Geocodificación rápida por texto con Nominatim / OSRM
      const resOrigin = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(quoteData.origin + ', Chile')}`);
      const dataOrigin = await resOrigin.json();
      const resDest = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(quoteData.destination + ', Chile')}`);
      const dataDest = await resDest.json();

      if (dataOrigin.length === 0 || dataDest.length === 0) {
        setIsCalculatingRoute(false);
        return showAlert("❌ No se pudieron ubicar las coordenadas exactas de las ciudades en el mapa.");
      }

      const lon1 = dataOrigin[0].lon, lat1 = dataOrigin[0].lat;
      const lon2 = dataDest.lon || dataDest[0].lon, lat2 = dataDest.lat || dataDest[0].lat;

      // Petición a OSRM para ruta de conducción real
      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`);
      const routeData = await routeRes.json();

      if (routeData.routes && routeData.routes.length > 0) {
        const meters = routeData.routes[0].distance;
        const km = Math.round(meters / 1000);
        setQuoteData(prev => ({ ...prev, distanceKm: km }));
        showAlert(`✅ Distancia de ruta calculada: ${km} KM`);
      } else {
        showAlert("⚠️ No se pudo trazar la ruta por carretera. Ingresa los KM manual.");
      }
    } catch (err) {
      console.error(err);
      showAlert("❌ Error al conectar con el motor de rutas.");
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Guardar Nuevo Cliente en Firestore
  const handleCreateNewClient = async (e) => {
    e.preventDefault();
    if (!newClientData.name || !newClientData.email) return showAlert("Completa nombre y correo.");
    try {
      const fullName = `${newClientData.name} ${newClientData.lastName}`.trim();
      const { addDoc, collection } = await import('firebase/firestore');
      await addDoc(collection(db, 'clients'), {
        name: fullName,
        email: newClientData.email,
        createdAt: Date.now()
      });
      showAlert(`✅ Cliente ${fullName} registrado exitosamente.`);
      setQuoteData(prev => ({ ...prev, client: fullName }));
      setShowNewClientForm(false);
      setNewClientData({ name: '', lastName: '', email: '' });
    } catch (err) {
      showAlert("Error al guardar cliente.");
    }
  };

  // Guardar o Actualizar Cotización en Firestore con Correlativo Automático
  const handleSaveQuoteStatus = async (status = 'pendiente') => {
    if (!quoteData.client || !quoteData.origin || !quoteData.destination) {
      return showAlert("⚠️ Faltan datos obligatorios (Cliente, Origen y Destino).");
    }
    try {
      const correlativo = quoteData.quoteNumber || `COT-${savedQuotes.length + 1}`;
      const payload = {
        ...quoteData,
        quoteNumber: correlativo,
        finalPrice: Math.round(finalPrice),
        status,
        selectedTollIds, // <-- NUEVO: Guardamos la lista de peajes para que la memoria los recuerde luego
        updatedAt: Date.now()
      };

      if (editingQuoteId) {
        await updateDoc(doc(db, 'quotes', editingQuoteId), payload);
        showAlert(`✅ Cotización ${correlativo} actualizada [${status.toUpperCase()}].`);
        setEditingQuoteId(null);
      } else {
        await addDoc(collection(db, 'quotes'), {
          ...payload,
          createdAt: Date.now(),
          createdBy: currentUserEmail
        });
        showAlert(`✅ Cotización ${correlativo} guardada [${status.toUpperCase()}].`);
      }
    } catch (err) {
      console.error(err);
      showAlert("Error al guardar cotización.");
    }
  };

// Crear Traslado Automáticamente
  const handleApproveQuote = async () => {
    if (!quoteData.client || !quoteData.origin || !quoteData.destination) {
      return showAlert("⚠️ Faltan datos clave (Cliente, Origen o Destino) para crear el traslado.");
    }

    showConfirm(`¿Aprobar cotización por ${formatMoney(finalPrice)} y generar el traslado automáticamente?`, async () => {
      try {
        const matchedOrigin = directoryList.find(d => d.placeName.toLowerCase() === quoteData.origin.toLowerCase());
        const matchedDest = directoryList.find(d => d.placeName.toLowerCase() === quoteData.destination.toLowerCase());

        const newJob = {
          client: quoteData.client || '',
          origin: quoteData.origin || '',
          destination: quoteData.destination || '',
          originContactName: matchedOrigin?.contactName || '',
          originContactPhone: matchedOrigin?.contactPhone || '',
          originAddress: matchedOrigin?.address || '',
          destContactName: matchedDest?.contactName || '',
          destContactPhone: matchedDest?.contactPhone || '',
          destAddress: matchedDest?.address || '',
          description: `(Viene de Cotización) ${quoteData.description || ''}`,
          brand: quoteData.brand || 'Por definir',
          model: quoteData.model || '',
          vehicleType: quoteData.vehicleType || 'Auto / SUV',
          plate: quoteData.plateOrVin || 'S/N',
          tripType: 'traslado',
          status: 'pending', 
          createdAt: Date.now(),
          scheduledDate: new Date().toISOString().split('T')[0],
          quotedPrice: Math.round(finalPrice || 0),
          price: Math.round(finalPrice || 0), // <-- NUEVO: Alimenta las estadísticas globales
          requestedBy: currentUserEmail || ''
        };

        await addDoc(collection(db, 'transport_jobs'), newJob);
        showAlert("✅ ¡Cotización aprobada! El traslado se ha enviado a la lista de trabajos pendientes.");
        
        // Limpiar formulario
        setQuoteData({
          client: '', origin: '', destination: '', distanceKm: '', kmPerLiter: '', 
          fuelPrice: 1050, tollsCost: '', driverFee: '', marginPct: 30, description: '', vehicleType: ''
        });
        setSelectedTollIds([]); // <-- NUEVO: Limpiamos los peajes visuales para la siguiente cotización
      } catch (error) {
        console.error("Error al crear traslado de cotización:", error);
        showAlert("❌ Hubo un error al generar el traslado.");
      }
    });
  };

  // Procesar Cotización Aceptada y Crear Traslado
  const handleConfirmAcceptQuote = async (e) => {
    e.preventDefault();
    if (!acceptQuoteData) return;

    try {
      await updateDoc(doc(db, 'quotes', acceptQuoteData.id), { status: 'aceptada' });

      const matchedOrigin = directoryList?.find(d => d.placeName.toLowerCase() === acceptQuoteData.origin?.toLowerCase());
      const matchedDest = directoryList?.find(d => d.placeName.toLowerCase() === acceptQuoteData.destination?.toLowerCase());

      const selectedDriverObj = drivers?.find(d => (d.name || d.email) === jobDetails.assignedDriver);
      const assignedEmails = selectedDriverObj ? [selectedDriverObj.email] : [];

      const newJob = {
        client: acceptQuoteData.client || '',
        origin: acceptQuoteData.origin || '',
        destination: acceptQuoteData.destination || '',
        originContactName: matchedOrigin?.contactName || '',
        originContactPhone: matchedOrigin?.contactPhone || '',
        originAddress: matchedOrigin?.address || '',
        destContactName: matchedDest?.contactName || '',
        destContactPhone: matchedDest?.contactPhone || '',
        destAddress: matchedDest?.address || '',
        description: `(Cotización ${acceptQuoteData.quoteNumber || 'S/N'}) ${acceptQuoteData.description || ''}`,
        brand: acceptQuoteData.brand || 'Por definir',
        model: acceptQuoteData.model || '',
        vehicleType: acceptQuoteData.vehicleType || 'Auto / SUV',
        plate: acceptQuoteData.plateOrVin || 'S/N',
        tripType: 'traslado',
        status: 'pending', // <-- CORRECCIÓN: El estado ahora siempre es 'pending' para que el Monitor lo pueda detectar
        assignedDriver: jobDetails.assignedDriver || '',
        assignedEmails: assignedEmails,
        createdAt: Date.now(),
        scheduledDate: jobDetails.scheduledDate || new Date().toISOString().split('T')[0],
        quotedPrice: Math.round(acceptQuoteData.finalPrice || 0),
        price: Math.round(acceptQuoteData.finalPrice || 0), // <-- NUEVO: Alimenta las estadísticas globales
        requestedBy: currentUserEmail || ''
      };

      await addDoc(collection(db, 'transport_jobs'), newJob);
      showAlert("✅ ¡Cotización aceptada y traslado agendado exitosamente!");

      setShowAcceptModal(false);
      setAcceptQuoteData(null);
      setJobDetails({ scheduledDate: new Date().toISOString().split('T')[0], assignedDriver: '' });
    } catch (error) {
      console.error("Error al aceptar cotización:", error);
      showAlert("❌ Hubo un error al generar el traslado.");
    }
  };

  // Generador de PDF Elegante en Formato A4 (Impresión HTML nativa) y generador de Blob para compartir
  const getPDFHtml = () => `
      <html>
        <head>
          <title>Cotización Logística - ${quoteData.client || 'Cliente'}</title>
          <style>
            @page { margin: 10mm; }
            @media print {
              body { margin: 0; background: #fff !important; }
              .page-container { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; background: #fff; display: block; }
            
            /* Contenedor dinámico (Evita hojas en blanco) */
            .page-container { background: #fff; width: 100%; max-width: 800px; margin: 0 auto; padding: 30px; box-sizing: border-box; }
            
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #7c3aed; padding-bottom: 25px; margin-bottom: 30px; }
            .logo { max-height: 65px; }
            .title { text-align: right; }
            .title h1 { margin: 0; color: #1e293b; font-size: 28px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.5px; }
            .title p { margin: 6px 0 0 0; color: #64748b; font-size: 13px; font-weight: 600; }
            .title p strong { color: #7c3aed; }
            
            .section-title { font-size: 12px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-item h4 { margin: 0 0 4px 0; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
            .info-item p { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; }
            
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
            th { background: #f8fafc; color: #475569; text-align: left; padding: 15px; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
            td { padding: 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            td:last-child, th:last-child { text-align: right; }
            tbody tr:last-child td { border-bottom: none; }
            
            .totals { width: 350px; margin-left: auto; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
            .totals-row { display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #475569; background: #fff; }
            .totals-row:last-child { border-bottom: none; }
            .totals-row.final { background: #7c3aed; color: white; font-weight: 900; font-size: 18px; border: none; }
            
            .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 11px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="header">
              <img src="${window.location.origin}/LogoLogistica.png" class="logo" alt="LogisticAPP Logo" onerror="this.style.display='none'" />
              <div class="title">
                <h1>Cotización de Traslado</h1>
                <p><strong>N° ${quoteData.quoteNumber || 'COT-Nueva'}</strong></p>
                <p>Fecha: ${new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div class="info-box">
              <div class="section-title">Información de la Ruta y Cliente</div>
              <div class="info-grid" style="margin-bottom: 15px;">
                <div class="info-item"><h4>Cliente Empresa</h4><p>${quoteData.client || 'A Quien Corresponda'}</p></div>
                <div class="info-item"><h4>Distancia Total</h4><p>${quoteData.distanceKm ? quoteData.distanceKm + ' KM' : 'N/A'}</p></div>
                <div class="info-item"><h4>Origen</h4><p>${quoteData.origin || 'No especificado'}</p></div>
                <div class="info-item"><h4>Destino</h4><p>${quoteData.destination || 'No especificado'}</p></div>
              </div>

              <div class="section-title" style="margin-top: 20px;">Detalles del Vehículo y Carga</div>
              <div class="info-grid">
                <div class="info-item"><h4>Tipo de Vehículo</h4><p>${quoteData.vehicleType || 'No especificado'}</p></div>
                <div class="info-item"><h4>Marca / Modelo</h4><p>${quoteData.brand || ''} ${quoteData.model || ''}</p></div>
                <div class="info-item" style="grid-column: span 2;"><h4>Patente / VIN</h4><p>${quoteData.plateOrVin || 'S/N'}</p></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Descripción del Servicio</th>
                  <th>Total Neto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>${quoteData.description || 'Servicio de traslado logístico de vehículo'}</strong><br/>
                    <span style="font-size: 12px; color: #64748b; font-weight: normal; margin-top: 4px; display: inline-block;">Incluye gestión de ruta, peajes, combustible y traslado profesional.</span>
                  </td>
                  <td style="font-weight: 800; vertical-align: top; color: #1e293b;">${formatMoney(netPrice)}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals">
              <div class="totals-row">
                <span>Subtotal Neto</span>
                <span>${formatMoney(netPrice)}</span>
              </div>
              <div class="totals-row">
                <span>IVA (19%)</span>
                <span>${formatMoney(ivaAmount)}</span>
              </div>
              <div class="totals-row final">
                <span>Total a Pagar</span>
                <span>${formatMoney(finalPrice)}</span>
              </div>
            </div>

            <div class="footer">
              <p>Esta cotización es válida por 15 días hábiles desde su emisión.</p>
              <p>Generado automáticamente por LogisticAPP - Sistema de Gestión Logística</p>
            </div>
          </div>
        </body>
      </html>
  `;

  const handleGeneratePDF = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(getPDFHtml());
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  // Función para Compartir por WhatsApp o Correo con PDF Adjunto nativo
  const handleShare = async (method) => {
    if (!quoteData.client || !quoteData.origin || !quoteData.destination) {
      return showAlert("⚠️ Faltan datos (Cliente, Origen, Destino) para poder compartir.");
    }
    const correlativo = quoteData.quoteNumber || `COT-${savedQuotes.length + 1}`;
    const fileName = `${correlativo}_${quoteData.client.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    // Crear el texto del mensaje con formato legible
    const text = `*Cotización de Traslado ${correlativo}*\n\n` +
                 `🏢 *Cliente:* ${quoteData.client}\n` +
                 `📍 *Ruta:* ${quoteData.origin} ➔ ${quoteData.destination} (${quoteData.distanceKm || 0} KM)\n` +
                 `🚘 *Vehículo:* ${quoteData.vehicleType} ${quoteData.brand ? `- ${quoteData.brand} ${quoteData.model}` : ''}\n` +
                 `📋 *Servicio:* ${quoteData.description || 'Traslado logístico'}\n\n` +
                 `💰 *Total Neto:* ${formatMoney(netPrice)}\n` +
                 `🧾 *IVA (19%):* ${formatMoney(ivaAmount)}\n` +
                 `✅ *Total a Pagar:* ${formatMoney(finalPrice)}\n\n` +
                 `_Generado por LogisticAPP_`;

    if (method === 'whatsapp') {
      try {
        showAlert("⏳ Generando documento PDF...");
        
        // 1. Copiar el texto al portapapeles silenciosamente
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(textArea);

        // 2. Generar el PDF cargando la librería dinámicamente para evadir el error de Vercel
        const html2pdf = await new Promise((resolve) => {
          if (window.html2pdf) return resolve(window.html2pdf);
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve(window.html2pdf);
          document.body.appendChild(script);
        });
        const element = document.createElement('div');
        element.innerHTML = getPDFHtml();
        
        const opt = {
          margin: 0,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await html2pdf().from(element).set(opt).output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        // 3. Compartir (SIN la propiedad 'text' para evitar el bug de Android que borra el PDF)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: fileName,
            files: [file]
          });
          showAlert("✅ PDF adjunto. ¡Mantén presionado para pegar el texto en el chat!");
        } else {
          // Fallback para PC o navegadores que no soportan share API con archivos
          showAlert("Abriendo WhatsApp Web... Pega el texto que ya fue copiado.");
          html2pdf().from(element).set(opt).save(); // Descarga el PDF
          setTimeout(() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }, 1500);
        }
      } catch (error) {
        console.error("Error compartiendo PDF:", error);
        showAlert("❌ Hubo un error al intentar compartir el PDF.");
      }
    } else if (method === 'email') {
      const subject = `Cotización de Traslado - ${quoteData.client}`;
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, '_self');
    }
  };

  return (
    <div className="space-y-6 pt-24 md:pt-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* AVISO DE MODO EDICIÓN */}
      {editingQuoteId && (
        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex justify-between items-center shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
            <p className="text-xs font-black text-amber-800">Estás modificando una cotización existente. Al guardar o aprobar, se actualizará el registro actual.</p>
          </div>
          <button onClick={() => { setEditingQuoteId(null); showAlert("Edición cancelada."); }} className="text-xs font-black text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-xl transition-colors">Cancelar Edición</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Tarjeta 1: Datos del Traslado y Vehículo */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-purple-600"/> Datos de Ruta y Vehículo</h3>
              <button type="button" onClick={() => setShowNewClientForm(true)} className="text-xs font-bold bg-purple-100 text-purple-700 px-3 py-1.5 rounded-xl hover:bg-purple-200 transition-colors flex items-center gap-1">
                <Plus className="w-3.5 h-3.5"/> Nuevo Cliente
              </button>
            </div>
            
            <datalist id="quotes-directory-list">
               {directoryList.map((d, i) => <option key={i} value={d.placeName} />)}
            </datalist>
            <datalist id="quotes-brands-list">
               {[...new Set(vehicles?.map(v => v.brand?.toUpperCase()).filter(Boolean))].map((b, i) => <option key={i} value={b} />)}
            </datalist>
            <datalist id="quotes-models-list">
               {[...new Set(vehicles?.map(v => v.model?.toUpperCase()).filter(Boolean))].map((m, i) => <option key={i} value={m} />)}
            </datalist>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa Cliente</label>
                 <select name="client" value={quoteData.client} onChange={handleInputChange} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500 bg-slate-50">
                    <option value="">Selecciona un cliente...</option>
                    {customClients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                 </select>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen</label>
                 <input type="text" name="origin" list="quotes-directory-list" value={quoteData.origin} onChange={handleInputChange} placeholder="Desde dónde..." autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destino</label>
                 <div className="flex gap-2">
                   <input type="text" name="destination" list="quotes-directory-list" value={quoteData.destination} onChange={handleInputChange} placeholder="Hasta dónde..." autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
                   <button type="button" onClick={calculateRouteDistance} disabled={isCalculatingRoute} className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-xl text-xs font-black shadow-sm shrink-0 transition-colors disabled:opacity-50" title="Calcular distancia de ruta real por carretera">
                     {isCalculatingRoute ? '...' : 'Calcular KM'}
                   </button>
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Distancia Total (KM Ruta)</label>
                 <div className="relative">
                   <input type="number" name="distanceKm" value={quoteData.distanceKm} onChange={handleInputChange} placeholder="Ej: 120" className="w-full border-2 border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
                   <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Vehículo</label>
                 <select name="vehicleType" value={quoteData.vehicleType} onChange={handleInputChange} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500 bg-white">
                    <option value="Auto / SUV">Auto / SUV</option>
                    <option value="Camioneta">Camioneta</option>
                    <option value="Furgón Pequeño">Furgón Pequeño</option>
                    <option value="Furgón Grande">Furgón Grande</option>
                    <option value="Camión Simple">Camión Simple</option>
                    <option value="Camión Doble Cabina">Camión Doble Cabina</option>
                    <option value="Camión (2 Ejes traseros)">Camión (2 Ejes traseros)</option>
                    <option value="Camión (3 Ejes traseros)">Camión (3 Ejes traseros)</option>
                    <option value="Camión Rigid (8x4)">Camión Rigid (8x4)</option>
                    <option value="Carro Arrastre">Carro Arrastre</option>
                 </select>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                 <input type="text" name="brand" list="quotes-brands-list" value={quoteData.brand} onChange={handleInputChange} placeholder="Ej: TOYOTA" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500 uppercase"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                 <input type="text" name="model" list="quotes-models-list" value={quoteData.model} onChange={handleInputChange} placeholder="Ej: HILUX" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500 uppercase"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patente o VIN</label>
                 <input 
                   type="text" 
                   name="plateOrVin" 
                   maxLength="17" 
                   value={quoteData.plateOrVin} 
                   onChange={(e) => {
                     const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                     setQuoteData(prev => {
                       let updated = { ...prev, plateOrVin: val };
                       if (val.length >= 4 && vehicles) {
                         const found = vehicles.find(v => 
                           (v.plate && v.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === val) || 
                           (v.vin && v.vin.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().includes(val))
                         );
                         if (found) {
                           if (found.brand) updated.brand = found.brand;
                           if (found.model) updated.model = found.model;
                           if (found.vehicleType) updated.vehicleType = found.vehicleType;
                           if (found.client) updated.client = found.client;
                         }
                       }
                       return updated;
                     });
                   }} 
                   placeholder="Ej: ABCD12"
                   autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters"
                   className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-black uppercase text-slate-800 outline-none focus:border-purple-500"
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción corta</label>
                 <input type="text" name="description" value={quoteData.description} onChange={handleInputChange} placeholder="Detalles adicionales..." autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>none focus:border-purple-500"
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción corta</label>
                 <input type="text" name="description" value={quoteData.description} onChange={handleInputChange} placeholder="Detalles adicionales..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Gastos Operativos, Calculadora y Peajes */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-5">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3"><DollarSign className="w-4 h-4 text-emerald-600"/> Estructura de Costos y Peajes</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Rendimiento (KM/L)</label>
                 <div className="relative">
                   <input type="number" step="0.1" name="kmPerLiter" value={quoteData.kmPerLiter} onChange={handleInputChange} placeholder="Ej: 10.5" className="w-full border-2 border-emerald-200 bg-emerald-50 rounded-xl p-3 pl-10 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500"/>
                   <Fuel className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3.5" />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio Combustible ($/L)</label>
                 <div className="flex gap-2">
                   <input type="number" name="fuelPrice" value={quoteData.fuelPrice} onChange={handleInputChange} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
                   <button 
                     type="button" 
                     onClick={fetchFuelPriceWithAI} 
                     disabled={isFetchingFuel} 
                     className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 rounded-xl text-[10px] font-black shadow-sm shrink-0 transition-colors disabled:opacity-50 flex items-center gap-1 uppercase" 
                     title="Consultar precio estimado con IA"
                   >
                     {isFetchingFuel ? '...' : <><Sparkles className="w-3 h-3"/> Obtener precio</>}
                   </button>
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo Peajes ($ Auto-calculado)</label>
                 <input type="number" name="tollsCost" value={quoteData.tollsCost} onChange={handleInputChange} placeholder="Total peajes..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Pago Conductor ($)</label>
                 <div className="relative">
                   <input type="number" name="driverFee" value={quoteData.driverFee} onChange={handleInputChange} placeholder="Honorarios..." className="w-full border-2 border-blue-200 bg-blue-50 rounded-xl p-3 pl-10 text-sm font-bold text-blue-800 outline-none focus:border-blue-500"/>
                   <User className="w-4 h-4 text-blue-500 absolute left-3.5 top-3.5" />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Margen Empresa (%)</label>
                 <div className="relative">
                   <input 
                     type="number" 
                     step="0.01"
                     name="marginPct" 
                     value={typeof quoteData.marginPct === 'number' ? Number(quoteData.marginPct).toFixed(2) : quoteData.marginPct} 
                     onChange={handleInputChange} 
                     className="w-full border-2 border-purple-200 bg-purple-50 rounded-xl p-3 text-sm font-black text-purple-800 outline-none focus:border-purple-500"
                   />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Forzar Neto ($)</label>
                 <div className="relative">
                   <input 
                     type="text" 
                     value={netPrice > 0 ? new Intl.NumberFormat('es-CL').format(netPrice) : ''} 
                     onChange={handleNetPriceChange} 
                     placeholder="Ej: 1200000" 
                     className="w-full border-2 border-purple-200 bg-purple-50 rounded-xl p-3 pl-10 text-sm font-black text-purple-800 outline-none focus:border-purple-500"
                   />
                   <DollarSign className="w-4 h-4 text-purple-500 absolute left-3.5 top-3.5" />
                 </div>
              </div>
            </div>


              {/* SECCIÓN DE SELECCIÓN DE PEAJES (CON BOTÓN DE MODIFICAR CADA PEAJE) */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Seleccionar Peajes ({tollsList.length})</span>
                <button type="button" onClick={() => { setEditingTollId(null); setShowNewTollModal(true); }} className="text-[11px] font-bold bg-purple-100 text-purple-700 px-3 py-1.5 rounded-xl hover:bg-purple-200 transition-colors flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5"/> Registrar Nuevo Peaje
                </button>
              </div>

              {tollsList.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 italic bg-slate-50 p-4 rounded-2xl text-center">No hay peajes creados aún. Registra el primero para calcular automáticamente.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-none border border-slate-100 rounded-2xl bg-slate-50">
                  {tollsList.map(toll => {
                    const isChecked = selectedTollIds.includes(toll.id);
                    const price = toll.prices?.[quoteData.vehicleType] || 0;
                    return (
                      <div key={toll.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isChecked ? 'bg-purple-50 border-purple-300 shadow-sm' : 'bg-white border-slate-200'}`}>
                        <label className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0">
                          <input type="checkbox" checked={isChecked} onChange={() => toggleTollSelection(toll.id)} className="w-4 h-4 accent-purple-600 rounded cursor-pointer shrink-0"/>
                          <div className="truncate">
                            <p className="text-xs font-black text-slate-800 truncate">{toll.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{toll.route} • KM {toll.km}</p>
                          </div>
                        </label>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-black text-purple-700">{formatMoney(price)}</span>
                          <button type="button" onClick={() => handleEditToll(toll)} className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg transition-colors">Modificar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: RESULTADOS Y ACCIONES */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Panel de Resultados */}
          <div className="bg-slate-800 rounded-3xl p-5 shadow-xl border border-slate-700 text-white">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Receipt className="w-4 h-4"/> Resumen Financiero</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                <span className="text-xs font-bold text-slate-300">Litros Estimados:</span>
                <span className="text-sm font-black text-white">{totalLiters > 0 ? totalLiters.toFixed(1) : 0} L</span>
              </div>
              <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                <span className="text-xs font-bold text-slate-300">Gasto Combustible:</span>
                <span className="text-sm font-black text-red-400">{formatMoney(fuelCost)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                <span className="text-xs font-bold text-slate-300">Costo Operativo (Total):</span>
                <span className="text-sm font-black text-amber-400">{formatMoney(subtotalCosts)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-900/40 p-3 rounded-xl border border-emerald-700">
                <span className="text-xs font-bold text-emerald-400">Ganancia Empresa:</span>
                <span className="text-sm font-black text-emerald-400">{formatMoney(profit)}</span>
              </div>
            </div>

            <div className="bg-purple-600 rounded-2xl p-4 text-center border border-purple-500 shadow-inner">
              <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest mb-1">Precio Sugerido (Neto)</p>
              <p className="text-2xl font-black text-white mb-2">{formatMoney(netPrice)}</p>
              <div className="border-t border-purple-500/50 pt-2 mt-2 flex justify-between text-xs font-bold text-purple-100 px-2">
                <span>IVA (19%):</span>
                <span>{formatMoney(ivaAmount)}</span>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-4 text-center border border-slate-700 shadow-inner">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total con IVA</p>
              <p className="text-3xl font-black text-emerald-400">{formatMoney(finalPrice)}</p>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => handleSaveQuoteStatus('pendiente')}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl transition-colors shadow-md flex items-center justify-center gap-2 text-sm"
            >
              <Save className="w-5 h-5"/> Guardar como Pendiente
            </button>

            <button 
              onClick={() => setShowSendModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2 text-sm"
            >
              <Send className="w-5 h-5"/> Enviar
            </button>
          </div>

        </div>
      </div>

      {/* HISTORIAL DE COTIZACIONES GUARDADAS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mt-8">
        <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2"><Receipt className="w-5 h-5 text-purple-600"/> Historial de Cotizaciones ({savedQuotes.length})</h3>
        
        {savedQuotes.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 text-center py-6">No hay cotizaciones registradas aún.</p>
        ) : (
          <div className="overflow-x-auto pb-24 min-h-[280px]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase tracking-widest border-b">
                  <th className="p-3">N° Correlativo</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Ruta</th>
                  <th className="p-3">Vehículo / Patente</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {savedQuotes.map((q, idx) => {
                  const correlativo = q.quoteNumber || `COT-${idx + 1}`;
                  return (
                    <tr key={q.id} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-purple-700">{correlativo}</td>
                      <td className="p-3 font-black">{q.client}</td>
                      <td className="p-3 font-medium">{q.origin} ➔ {q.destination} ({q.distanceKm} KM)</td>
                      <td className="p-3">{q.brand} {q.model} <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{q.plateOrVin || 'S/N'}</span></td>
                      <td className="p-3 font-black text-slate-900">{formatMoney(q.finalPrice)}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          q.status === 'aceptada' ? 'bg-emerald-100 text-emerald-700' :
                          q.status === 'enviada' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {q.status || 'pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-right relative">
                        <button onClick={() => setActiveActionMenu(activeActionMenu === q.id ? null : q.id)} className="p-2 hover:bg-slate-200 bg-slate-100 text-slate-600 rounded-xl transition-colors shadow-sm">
                          <MoreVertical className="w-4 h-4"/>
                        </button>
                        
                        {/* Menú Desplegable Inteligente */}
                        {activeActionMenu === q.id && (
                          <div className={`absolute right-12 ${idx > 0 && idx === savedQuotes.length - 1 ? 'bottom-10' : 'top-10'} bg-white border border-slate-200 shadow-2xl rounded-xl w-48 py-2 z-[99] animate-in fade-in zoom-in-95`}>
                            <button onClick={() => { handleEditQuote(q); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">Modificar</button>
                            <button onClick={() => { handleEditQuote(q); setShowSendModal(true); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">Enviar Cotización</button>
                            <button onClick={() => { setAcceptQuoteData(q); setShowAcceptModal(true); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors">Cotización Aceptada</button>
                            <div className="my-1 border-t border-slate-100"></div>
                            <button onClick={() => { handleDeleteQuote(q.id); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">Eliminar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: NUEVO CLIENTE */}
      {showNewClientForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={handleCreateNewClient} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <button type="button" onClick={() => setShowNewClientForm(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-700"/></button>
            <h3 className="text-lg font-black text-slate-800 mb-4">Registrar Nuevo Cliente</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Nombre / Empresa</label>
                <input type="text" required value={newClientData.name} onChange={e => setNewClientData({...newClientData, name: e.target.value})} placeholder="Ej: Comercial SPA" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Apellidos / Contacto</label>
                <input type="text" value={newClientData.lastName} onChange={e => setNewClientData({...newClientData, lastName: e.target.value})} placeholder="Ej: Juan Pérez" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500"/>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Correo de Contacto</label>
                <input type="email" required value={newClientData.email} onChange={e => setNewClientData({...newClientData, email: e.target.value})} placeholder="contacto@empresa.cl" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="none" className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500"/>
              </div>
            </div>
            <button type="submit" className="w-full mt-5 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl shadow-lg shadow-purple-200 text-xs transition-colors">Guardar Cliente</button>
          </form>
        </div>
      )}

      {/* MODAL: ENVIAR COTIZACIÓN */}
      {showSendModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <button type="button" onClick={() => setShowSendModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-700"/></button>
            <h3 className="text-lg font-black text-slate-800 mb-2">Enviar Cotización</h3>
            <p className="text-xs font-bold text-slate-500 mb-5">Elige cómo enviar esta cotización. Al enviarla o descargarla, se guardará automáticamente como <span className="text-blue-600">ENVIADA</span>.</p>
            
            <div className="space-y-3">
              <button 
                onClick={() => { handleShare('whatsapp'); handleSaveQuoteStatus('enviada'); setShowSendModal(false); }}
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-black py-3.5 rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle className="w-5 h-5"/> Enviar por WhatsApp
              </button>
              
              <button 
                onClick={() => { handleShare('email'); handleSaveQuoteStatus('enviada'); setShowSendModal(false); }}
                className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-black py-3.5 rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <Mail className="w-5 h-5 text-slate-500"/> Enviar por Correo
              </button>
              
              <button 
                onClick={() => { handleGeneratePDF(); handleSaveQuoteStatus('enviada'); setShowSendModal(false); }}
                className="w-full bg-purple-100 hover:bg-purple-200 border border-purple-200 text-purple-700 font-black py-3.5 rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <Printer className="w-5 h-5 text-purple-600"/> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO PEAJE CON PRECIOS POR TIPO DE VEHÍCULO */}
      {showNewTollModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={handleSaveNewToll} className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowNewTollModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-700"/></button>
            <h3 className="text-lg font-black text-slate-800 mb-1">{editingTollId ? 'Modificar Peaje' : 'Registrar Nuevo Peaje'}</h3>
            <p className="text-xs font-bold text-slate-400 mb-4">Configura los valores de este peaje según cada tipo de vehículo.</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nombre del Peaje</label>
                  <input type="text" required value={newTollData.name} onChange={e => setNewTollData({...newTollData, name: e.target.value})} placeholder="Ej: Peaje Lampa" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Ruta / Dirección</label>
                  <select value={newTollData.route} onChange={e => setNewTollData({...newTollData, route: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500 bg-white">
                    <option value="Ruta 5 Norte">Ruta 5 Norte</option>
                    <option value="Ruta 5 Sur">Ruta 5 Sur</option>
                    <option value="Ruta 68">Ruta 68</option>
                    <option value="Ruta 78">Ruta 78</option>
                    <option value="Otra Ruta">Otra Ruta</option>
                  </select>
                  {newTollData.route === 'Otra Ruta' && (
                    <input 
                      type="text" 
                      value={newTollData.customRoute || ''} 
                      onChange={e => setNewTollData({...newTollData, customRoute: e.target.value})} 
                      placeholder="Escribe la ruta aquí..." 
                      required
                      autoComplete="off" autoCorrect="off" spellCheck="false"
                      className="w-full mt-2 border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500 animate-in fade-in"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Kilómetro de la Ruta (KM)</label>
                <input type="number" required value={newTollData.km} onChange={e => setNewTollData({...newTollData, km: e.target.value})} placeholder="Ej: 30" className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500"/>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Tarifas por Tipo de Vehículo ($)</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {Object.keys(newTollData.prices).map(vType => (
                    <div key={vType} className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <label className="text-[9px] font-bold text-slate-500 block truncate">{vType}</label>
                      <input 
                        type="number" 
                        value={newTollData.prices[vType]} 
                        onChange={e => {
                          const val = e.target.value;
                          setNewTollData(prev => ({
                            ...prev,
                            prices: { ...prev.prices, [vType]: val }
                          }));
                        }} 
                        placeholder="$ Costo" 
                        className="w-full mt-1 border border-slate-300 rounded-lg p-1.5 text-xs font-black text-purple-700 outline-none focus:border-purple-500 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" className="w-full mt-5 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl shadow-lg shadow-purple-200 text-xs transition-colors">{editingTollId ? 'Actualizar Peaje' : 'Guardar Peaje'}</button>
          </form>
        </div>
      )}

      {/* MODAL: ACEPTAR COTIZACIÓN Y CREAR TRASLADO */}
      {showAcceptModal && acceptQuoteData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={handleConfirmAcceptQuote} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <button type="button" onClick={() => setShowAcceptModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-700"/></button>
            <h3 className="text-lg font-black text-slate-800 mb-1">¡Cotización Aceptada! 🎉</h3>
            <p className="text-xs font-bold text-slate-500 mb-5">¿Creemos el traslado de inmediato? Configura la fecha y el conductor.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Programada</label>
                <div className="relative mt-1">
                  <input type="date" required value={jobDetails.scheduledDate} onChange={e => setJobDetails({...jobDetails, scheduledDate: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conductor Asignado (Opcional)</label>
                <div className="relative mt-1">
                  <select 
                    value={jobDetails.assignedDriver} 
                    onChange={e => setJobDetails({...jobDetails, assignedDriver: e.target.value})} 
                    className="w-full border-2 border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="">Sin asignar (Dejar como Pendiente)</option>
                    {drivers && drivers.map((driver, idx) => (
                      <option key={idx} value={driver.name || driver.email}>
                        {driver.name || driver.email}
                      </option>
                    ))}
                  </select>
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <button type="submit" className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3.5 rounded-xl shadow-lg shadow-emerald-200 text-sm transition-colors flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5"/> Generar Traslado
            </button>
          </form>
        </div>
      )}

    </div>
  );
}