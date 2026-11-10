import React, { useState, useRef, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc, deleteDoc, setDoc, onSnapshot, getDocs, increment } from 'firebase/firestore';
import {
  Calculator, MapPin, Fuel, DollarSign, Plus, CheckCircle,
  User, Truck, Receipt, Printer, Send, Save, ArrowRight, X, MessageCircle, Mail, MoreVertical, Calendar, Sparkles,
  Settings, Sliders, Hash, RotateCcw, Building2, Briefcase, Phone, Globe, FileText, Check, Download, Smartphone,
  FlaskConical, Filter
} from 'lucide-react';
import { formatMoney } from '../../utils/helpers';

export default function QuotesView({ db, customClients = [], vehicles = [], directoryList = [], drivers = [], showAlert, showConfirm, currentUserEmail }) {
  // Modo de Cotizador: 'simple' (Modo Rápido / Celular) o 'full' (Calculadora Detallada)
  const [quoteMode, setQuoteMode] = useState(() => {
    try {
      return localStorage.getItem('preferred_quote_mode') || 'simple';
    } catch (e) {
      return 'simple';
    }
  });

  const handleSetQuoteMode = (mode) => {
    setQuoteMode(mode);
    try {
      localStorage.setItem('preferred_quote_mode', mode);
    } catch (e) { }
  };

  // Modo Cotización de Prueba (Test / Simulación)
  const [isTestQuote, setIsTestQuote] = useState(false);

  // Filtro para el Historial de Cotizaciones ('all', 'official', 'test')
  const [historyFilter, setHistoryFilter] = useState('all');

  // Configuración de Correlativo
  const [correlativeConfig, setCorrelativeConfig] = useState({
    prefix: 'COT-',
    startNumber: 1,
    nextNumber: 1,
    minDigits: 4,
    includeYear: false
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempConfig, setTempConfig] = useState({
    prefix: 'COT-',
    nextNumber: 1,
    minDigits: 4,
    includeYear: false
  });

  // Configuración de Empresa Emisora (Nuestra Empresa)
  const defaultIssuerCompany = {
    companyName: 'LogisticAPP - Soluciones Logísticas SpA',
    rut: '77.842.190-3',
    giro: 'Transporte de Vehículos y Logística Integral',
    address: 'Santiago, Chile',
    phone: '+56 9 8765 4321',
    email: 'contacto@logisticapp.cl'
  };
  const [issuerCompany, setIssuerCompany] = useState(defaultIssuerCompany);

  // Estados del Configurador de Cliente y Empresa
  const [showClientConfigModal, setShowClientConfigModal] = useState(false);
  const [clientConfigTab, setClientConfigTab] = useState('client'); // 'client' | 'issuer'
  const [selectedClientForEdit, setSelectedClientForEdit] = useState('');
  const [clientForm, setClientForm] = useState({
    name: '',
    rut: '',
    giro: '',
    address: '',
    city: '',
    contactName: '',
    phone: '',
    email: ''
  });
  const [issuerForm, setIssuerForm] = useState(defaultIssuerCompany);

  // Estados para el Modo Simplificado (Celular)
  const [simpleData, setSimpleData] = useState({
    amount: '',
    addIva: true
  });

  // Estado para la cotización recién creada lista para compartir
  const [createdQuoteToShare, setCreatedQuoteToShare] = useState(null);
  const [showShareSuccessModal, setShowShareSuccessModal] = useState(false);

  // Función formateadora de correlativo
  const formatCorrelativeNumber = (cfg, numVal) => {
    const pfx = cfg?.prefix !== undefined ? cfg.prefix : 'COT-';
    const yr = cfg?.includeYear ? `${new Date().getFullYear()}-` : '';
    const digits = parseInt(cfg?.minDigits ?? 4, 10);
    const num = numVal !== undefined ? numVal : (parseInt(cfg?.nextNumber, 10) || 1);
    const formattedNum = digits > 0 ? String(num).padStart(digits, '0') : String(num);
    return `${pfx}${yr}${formattedNum}`;
  };

  // Estados de la Cotización Principal
  const [quoteData, setQuoteData] = useState({
    client: '',
    clientRut: '',
    clientGiro: '',
    clientAddress: '',
    clientCity: '',
    clientPhone: '',
    clientEmail: '',
    clientContact: '',
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
    quoteNumber: ''
  });

  // Estados para Edición, Menús y Modales
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
  const [editingTollId, setEditingTollId] = useState(null);
  const [newTollData, setNewTollData] = useState({
    name: '',
    route: 'Ruta 5 Norte',
    customRoute: '',
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

  // Estados para Peajes Seleccionados en la Cotización
  const [selectedTollIds, setSelectedTollIds] = useState([]);

  // Estados para Tabla de Peajes y Cotizaciones Guardadas
  const [tollsList, setTollsList] = useState([]);
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isFetchingFuel, setIsFetchingFuel] = useState(false);

  // Cargar Peajes, Cotizaciones, Correlativo y Empresa Emisora desde Firestore
  useEffect(() => {
    if (!db) return;

    // Cargar Peajes
    getDocs(collection(db, 'tolls'))
      .then(snap => {
        setTollsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
      .catch(err => {
        console.error("[ERR-TOLL-FETCH-01] Error cargando peajes:", err);
      });

    // Suscripción a Cotizaciones
    const unsubQuotes = onSnapshot(collection(db, 'quotes'), snap => {
      setSavedQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, err => {
      console.error("[ERR-QUOTE-FETCH-01] Error escuchando cotizaciones:", err);
    });

    // Suscripción a Configuración de Correlativo en Firestore
    const unsubCorrelative = onSnapshot(doc(db, 'system_config', 'quotes_correlative'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setCorrelativeConfig({
          prefix: data.prefix !== undefined ? data.prefix : 'COT-',
          startNumber: data.startNumber !== undefined ? Number(data.startNumber) : 1,
          nextNumber: data.nextNumber !== undefined ? Number(data.nextNumber) : 1,
          minDigits: data.minDigits !== undefined ? Number(data.minDigits) : 4,
          includeYear: !!data.includeYear
        });
      }
    }, err => {
      console.error("[ERR-QUOTE-CFG-FETCH-01] Error escuchando configuración de correlativo:", err);
    });

    // Suscripción a Datos de Nuestra Empresa Emisora
    const unsubCompany = onSnapshot(doc(db, 'system_config', 'quote_company'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setIssuerCompany(prev => ({ ...prev, ...data }));
      }
    }, err => {
      console.error("[ERR-COMPANY-FETCH-01] Error escuchando empresa emisora:", err);
    });

    return () => {
      unsubQuotes();
      unsubCorrelative();
      unsubCompany();
    };
  }, [db]);

  // Manejo de Selección de Cliente en el Formulario
  const handleClientChange = (e) => {
    const selectedName = e.target.value;
    const clientRecord = customClients.find(c => c.name === selectedName);
    setQuoteData(prev => ({
      ...prev,
      client: selectedName,
      clientRut: clientRecord?.rut || '',
      clientGiro: clientRecord?.giro || '',
      clientAddress: clientRecord?.address || '',
      clientCity: clientRecord?.city || '',
      clientPhone: clientRecord?.phone || '',
      clientEmail: clientRecord?.email?.split(',')[0]?.trim() || '',
      clientContact: clientRecord?.contactName?.split(',')[0]?.trim() || ''
    }));
  };

  // Cargar Cotización al formulario para modificarla
  const handleEditQuote = (q) => {
    const clientRecord = customClients.find(c => c.name === q.client);
    setQuoteData({
      client: q.client || '',
      clientRut: q.clientRut || clientRecord?.rut || '',
      clientGiro: q.clientGiro || clientRecord?.giro || '',
      clientAddress: q.clientAddress || clientRecord?.address || '',
      clientCity: q.clientCity || clientRecord?.city || '',
      clientPhone: q.clientPhone || clientRecord?.phone || '',
      clientEmail: q.clientEmail || clientRecord?.email?.split(',')[0]?.trim() || '',
      clientContact: q.clientContact || clientRecord?.contactName?.split(',')[0]?.trim() || '',
      origin: q.origin || '',
      destination: q.destination || '',
      distanceKm: q.distanceKm || '',
      kmPerLiter: q.kmPerLiter || '10',
      fuelPrice: q.fuelPrice || 1050,
      tollsCost: q.tollsCost || '',
      driverFee: q.driverFee || '',
      marginPct: q.marginPct !== undefined ? q.marginPct : 30,
      description: q.description || '',
      vehicleType: q.vehicleType || 'Auto / SUV',
      brand: q.brand || '',
      model: q.model || '',
      plateOrVin: q.plateOrVin || '',
      quoteNumber: q.quoteNumber || ''
    });

    // Si viene de modo simple o tiene precio definido
    if (q.finalPrice) {
      setSimpleData({
        amount: q.netPrice || q.finalPrice,
        addIva: q.ivaAmount > 0
      });
    }

    setSelectedTollIds(q.selectedTollIds || []);
    setIsTestQuote(!!q.isTest);
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

  // Guardar o Actualizar Peaje en Firestore
  const handleSaveNewToll = async (e) => {
    e.preventDefault();
    if (!newTollData.name || !newTollData.km) {
      return showAlert("⚠️ [ERR-TOLL-VAL-01] Completa el nombre y el kilómetro del peaje.");
    }
    if (newTollData.route === 'Otra Ruta' && !newTollData.customRoute) {
      return showAlert("⚠️ [ERR-TOLL-VAL-02] Escribe el nombre de la ruta manual.");
    }

    try {
      const finalRoute = newTollData.route === 'Otra Ruta' ? newTollData.customRoute : newTollData.route;
      const payload = { ...newTollData, route: finalRoute, km: parseFloat(newTollData.km) || 0 };
      delete payload.customRoute;

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
      console.error("[ERR-TOLL-SAVE-01]", err);
      showAlert("❌ [ERR-TOLL-SAVE-01] Error al guardar peaje.");
    }
  };

  // Guardar Configuración de Correlativo en Firestore
  const handleSaveCorrelativeConfig = async (e) => {
    e.preventDefault();
    const num = parseInt(tempConfig.nextNumber, 10);
    if (isNaN(num) || num < 1) {
      return showAlert("⚠️ [ERR-QUOTE-CFG-VAL-01] El número inicial debe ser un entero mayor o igual a 1.");
    }

    try {
      const payload = {
        prefix: tempConfig.prefix?.trim() ?? 'COT-',
        nextNumber: num,
        startNumber: num,
        minDigits: parseInt(tempConfig.minDigits, 10) || 0,
        includeYear: !!tempConfig.includeYear,
        updatedAt: Date.now(),
        updatedBy: currentUserEmail || ''
      };

      await setDoc(doc(db, 'system_config', 'quotes_correlative'), payload, { merge: true });
      setCorrelativeConfig(payload);
      showAlert(`✅ Configuración de correlativo guardada. Próxima: ${formatCorrelativeNumber(payload, num)}`);
      setShowConfigModal(false);
    } catch (err) {
      console.error("[ERR-QUOTE-CFG-SAVE-01]", err);
      showAlert("❌ [ERR-QUOTE-CFG-SAVE-01] Error al guardar la configuración del correlativo.");
    }
  };

  // Abrir Modal de Configuración de Correlativo
  const handleOpenConfigModal = () => {
    setTempConfig({
      prefix: correlativeConfig.prefix,
      nextNumber: correlativeConfig.nextNumber,
      minDigits: correlativeConfig.minDigits,
      includeYear: correlativeConfig.includeYear
    });
    setShowConfigModal(true);
  };

  // Abrir Modal de Configuración de Cliente y Empresa
  const handleOpenClientConfigModal = (clientNameToPreselect) => {
    setIssuerForm({ ...issuerCompany });
    setClientConfigTab('client');

    const targetName = clientNameToPreselect || quoteData.client;
    const found = targetName ? customClients.find(c => c.name?.toLowerCase() === targetName.toLowerCase()) : null;

    if (found) {
      setSelectedClientForEdit(found.id);
      setClientForm({
        name: found.name || '',
        rut: found.rut || '',
        giro: found.giro || '',
        address: found.address || '',
        city: found.city || '',
        contactName: found.contactName || '',
        phone: found.phone || '',
        email: found.email || ''
      });
    } else if (customClients.length > 0) {
      const first = customClients[0];
      setSelectedClientForEdit(first.id);
      setClientForm({
        name: first.name || '',
        rut: first.rut || '',
        giro: first.giro || '',
        address: first.address || '',
        city: first.city || '',
        contactName: first.contactName || '',
        phone: first.phone || '',
        email: first.email || ''
      });
    } else {
      setSelectedClientForEdit('NEW');
      setClientForm({
        name: '',
        rut: '',
        giro: '',
        address: '',
        city: '',
        contactName: '',
        phone: '',
        email: ''
      });
    }

    setShowClientConfigModal(true);
  };

  // Cambiar cliente seleccionado para edición dentro del modal
  const handleSelectClientToEdit = (clientId) => {
    setSelectedClientForEdit(clientId);
    if (clientId === 'NEW') {
      setClientForm({
        name: '',
        rut: '',
        giro: '',
        address: '',
        city: '',
        contactName: '',
        phone: '',
        email: ''
      });
    } else {
      const found = customClients.find(c => c.id === clientId);
      if (found) {
        setClientForm({
          name: found.name || '',
          rut: found.rut || '',
          giro: found.giro || '',
          address: found.address || '',
          city: found.city || '',
          contactName: found.contactName || '',
          phone: found.phone || '',
          email: found.email || ''
        });
      }
    }
  };

  // Guardar Datos del Cliente en Firestore
  const handleSaveClientConfig = async (e) => {
    e.preventDefault();
    if (!clientForm.name?.trim()) {
      return showAlert("⚠️ [ERR-CLIENT-VAL-02] El nombre o razón social de la empresa es obligatorio.");
    }

    try {
      const payload = {
        name: clientForm.name.trim(),
        rut: clientForm.rut?.trim() || '',
        giro: clientForm.giro?.trim() || '',
        address: clientForm.address?.trim() || '',
        city: clientForm.city?.trim() || '',
        contactName: clientForm.contactName?.trim() || '',
        phone: clientForm.phone?.trim() || '',
        email: clientForm.email?.trim() || '',
        updatedAt: Date.now()
      };

      if (selectedClientForEdit === 'NEW') {
        await addDoc(collection(db, 'clients'), {
          ...payload,
          createdAt: Date.now()
        });
        showAlert(`✅ Nueva empresa "${payload.name}" registrada con éxito.`);
        setQuoteData(prev => ({
          ...prev,
          client: payload.name,
          clientRut: payload.rut,
          clientGiro: payload.giro,
          clientAddress: payload.address,
          clientCity: payload.city,
          clientContact: payload.contactName,
          clientPhone: payload.phone,
          clientEmail: payload.email
        }));
      } else {
        await updateDoc(doc(db, 'clients', selectedClientForEdit), payload);
        showAlert(`✅ Datos de la empresa "${payload.name}" actualizados.`);
        if (quoteData.client === payload.name) {
          setQuoteData(prev => ({
            ...prev,
            clientRut: payload.rut,
            clientGiro: payload.giro,
            clientAddress: payload.address,
            clientCity: payload.city,
            clientContact: payload.contactName,
            clientPhone: payload.phone,
            clientEmail: payload.email
          }));
        }
      }

      setShowClientConfigModal(false);
    } catch (err) {
      console.error("[ERR-CLIENT-SAVE-02]", err);
      showAlert("❌ [ERR-CLIENT-SAVE-02] Error al guardar datos de la empresa cliente.");
    }
  };

  // Guardar Datos de Nuestra Empresa Emisora en Firestore
  const handleSaveIssuerConfig = async (e) => {
    e.preventDefault();
    if (!issuerForm.companyName?.trim()) {
      return showAlert("⚠️ [ERR-EMPRESA-VAL-01] El nombre de nuestra empresa es obligatorio.");
    }

    try {
      const payload = {
        companyName: issuerForm.companyName.trim(),
        rut: issuerForm.rut?.trim() || '',
        giro: issuerForm.giro?.trim() || '',
        address: issuerForm.address?.trim() || '',
        phone: issuerForm.phone?.trim() || '',
        email: issuerForm.email?.trim() || '',
        updatedAt: Date.now(),
        updatedBy: currentUserEmail || ''
      };

      await setDoc(doc(db, 'system_config', 'quote_company'), payload, { merge: true });
      setIssuerCompany(payload);
      showAlert("✅ Datos de la empresa emisora actualizados correctamente.");
      setShowClientConfigModal(false);
    } catch (err) {
      console.error("[ERR-EMPRESA-SAVE-01]", err);
      showAlert("❌ [ERR-EMPRESA-SAVE-01] Error al guardar datos de nuestra empresa.");
    }
  };

  // Auto-cálculo de Peajes al cambiar de vehículo o seleccionar peajes
  useEffect(() => {
    const totalTolls = selectedTollIds.reduce((sum, id) => {
      const toll = tollsList.find(t => t.id === id);
      const priceForVehicle = toll?.prices?.[quoteData.vehicleType] || 0;
      return sum + parseFloat(priceForVehicle || 0);
    }, 0);

    setQuoteData(q => {
      const newTollsCost = totalTolls > 0 ? totalTolls : '';
      if (q.tollsCost === newTollsCost) return q;
      return { ...q, tollsCost: newTollsCost };
    });
  }, [selectedTollIds, quoteData.vehicleType, tollsList]);

  const toggleTollSelection = (tollId) => {
    setSelectedTollIds(prev => prev.includes(tollId) ? prev.filter(id => id !== tollId) : [...prev, tollId]);
  };

  // Memoria Predictiva de Rutas
  useEffect(() => {
    if (!quoteData.origin || !quoteData.destination || savedQuotes.length === 0) return;

    const originClean = quoteData.origin.trim().toLowerCase();
    const destClean = quoteData.destination.trim().toLowerCase();

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
        console.error("[ERR-QUOTE-DEL-01]", err);
        showAlert("❌ [ERR-QUOTE-DEL-01] Error al eliminar la cotización.");
      }
    });
  };

  // Cálculos Automáticos para Modo Completo (Calculadora)
  const distance = parseFloat(quoteData.distanceKm) || 0;
  const kml = parseFloat(quoteData.kmPerLiter) || 1;
  const fuelPrice = parseFloat(quoteData.fuelPrice) || 0;

  const totalLiters = distance / kml;
  const fuelCost = totalLiters * fuelPrice;
  const tolls = parseFloat(quoteData.tollsCost) || 0;
  const driver = parseFloat(quoteData.driverFee) || 0;

  const subtotalCosts = fuelCost + tolls + driver;
  const marginMultiplier = 1 + ((parseFloat(quoteData.marginPct) || 0) / 100);

  const netPrice = Math.round(subtotalCosts * marginMultiplier);
  const ivaAmount = Math.round(netPrice * 0.19);
  const finalPrice = netPrice + ivaAmount;
  const profit = netPrice - subtotalCosts;

  // Cálculos para Modo Simplificado
  const simpleAmountNum = parseFloat(simpleData.amount) || 0;
  const simpleNet = Math.round(simpleAmountNum);
  const simpleIva = simpleData.addIva ? Math.round(simpleAmountNum * 0.19) : 0;
  const simpleFinal = simpleNet + simpleIva;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuoteData(prev => ({ ...prev, [name]: value }));
  };

  // Consultar precio sugerido a la IA (Gemini)
  const fetchFuelPriceWithAI = async () => {
    setIsFetchingFuel(true);
    try {
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      const prompt = "Busca en internet el precio promedio actual del litro de petróleo Diésel en Chile para este mes. Responde ÚNICAMENTE con el número entero exacto, sin puntos, sin comas y sin texto adicional. Por ejemplo: 1280";

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await res.json();

      if (data.candidates && data.candidates.length > 0) {
        const respuestaTexto = data.candidates[0].content.parts[0].text;
        const precioLimpio = parseInt(respuestaTexto.replace(/[^0-9]/g, ''), 10);

        if (!isNaN(precioLimpio) && precioLimpio > 500 && precioLimpio < 2500) {
          setQuoteData(prev => ({ ...prev, fuelPrice: precioLimpio }));
          showAlert(`🤖 IA Gemini: Precio sugerido actualizado a $${precioLimpio}/L.`);
        } else {
          showAlert("⚠️ [ERR-AI-FUEL-02] La IA respondió con un formato no procesable.");
        }
      }
    } catch (err) {
      console.error("[ERR-AI-FUEL-01]", err);
      showAlert("❌ [ERR-AI-FUEL-01] Error al consultar el precio del combustible a la IA.");
    } finally {
      setIsFetchingFuel(false);
    }
  };

  // Cálculo de distancia de ruta por carretera usando OSRM
  const calculateRouteDistance = async () => {
    if (!quoteData.origin || !quoteData.destination) {
      return showAlert("⚠️ [ERR-ROUTE-VAL-01] Ingresa origen y destino para calcular la ruta.");
    }
    setIsCalculatingRoute(true);
    try {
      const resOrigin = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(quoteData.origin + ', Chile')}`);
      const dataOrigin = await resOrigin.json();
      const resDest = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(quoteData.destination + ', Chile')}`);
      const dataDest = await resDest.json();

      if (dataOrigin.length === 0 || dataDest.length === 0) {
        setIsCalculatingRoute(false);
        return showAlert("❌ [ERR-GEO-01] No se pudieron ubicar las coordenadas de las ciudades en el mapa.");
      }

      const lon1 = dataOrigin[0].lon, lat1 = dataOrigin[0].lat;
      const lon2 = dataDest[0].lon, lat2 = dataDest[0].lat;

      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`);
      const routeData = await routeRes.json();

      if (routeData.routes && routeData.routes.length > 0) {
        const meters = routeData.routes[0].distance;
        const km = Math.round(meters / 1000);
        setQuoteData(prev => ({ ...prev, distanceKm: km }));
        showAlert(`✅ Distancia de ruta calculada: ${km} KM`);
      } else {
        showAlert("⚠️ [ERR-ROUTE-01] No se pudo trazar la ruta por carretera. Ingresa los KM manual.");
      }
    } catch (err) {
      console.error("[ERR-ROUTE-02]", err);
      showAlert("❌ [ERR-ROUTE-02] Error al conectar con el motor de rutas.");
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Guardar Cotización en Modo Simplificado (Celular)
  const handleSaveSimpleQuote = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!quoteData.client?.trim()) {
      return showAlert("⚠️ [ERR-SIMPLE-VAL-01] Selecciona la Empresa Cliente.");
    }
    const amountVal = parseFloat(simpleData.amount);
    if (!amountVal || amountVal <= 0) {
      return showAlert("⚠️ [ERR-SIMPLE-VAL-02] Ingresa el monto a cobrar por el traslado.");
    }

    try {
      const isTest = !!isTestQuote;
      const correlativoFinal = quoteData.quoteNumber?.trim() || (isTest
        ? `TEST-${formatCorrelativeNumber(correlativeConfig)}`
        : formatCorrelativeNumber(correlativeConfig));
      const isAddIva = !!simpleData.addIva;
      const netVal = Math.round(amountVal);
      const ivaVal = isAddIva ? Math.round(amountVal * 0.19) : 0;
      const finalVal = netVal + ivaVal;

      const payload = {
        client: quoteData.client || '',
        clientRut: quoteData.clientRut || '',
        clientGiro: quoteData.clientGiro || '',
        clientAddress: quoteData.clientAddress || '',
        clientCity: quoteData.clientCity || '',
        clientPhone: quoteData.clientPhone || '',
        clientEmail: quoteData.clientEmail || '',
        clientContact: quoteData.clientContact || '',
        description: quoteData.description?.trim() || 'Servicio de traslado de vehículo',
        origin: quoteData.origin?.trim() || '',
        destination: quoteData.destination?.trim() || '',
        distanceKm: quoteData.distanceKm || '',
        brand: quoteData.brand?.trim() || '',
        model: quoteData.model?.trim() || '',
        plateOrVin: quoteData.plateOrVin?.trim() || '',
        vehicleType: quoteData.vehicleType || 'Auto / SUV',
        netPrice: netVal,
        ivaAmount: ivaVal,
        finalPrice: finalVal,
        addIva: isAddIva,
        quoteNumber: correlativoFinal,
        isTest,
        status: isTest ? 'prueba' : 'pendiente',
        createdAt: Date.now(),
        createdBy: currentUserEmail || '',
        mode: 'simple'
      };

      let quoteId = editingQuoteId;
      if (editingQuoteId) {
        await updateDoc(doc(db, 'quotes', editingQuoteId), { ...payload, updatedAt: Date.now() });
        setEditingQuoteId(null);
      } else {
        const docRef = await addDoc(collection(db, 'quotes'), payload);
        quoteId = docRef.id;

        // Avanzar contador de correlativo SOLO si NO fue de prueba y fue automático
        if (!isTest && (!quoteData.quoteNumber?.trim() || quoteData.quoteNumber.trim() === formatCorrelativeNumber(correlativeConfig))) {
          try {
            await setDoc(doc(db, 'system_config', 'quotes_correlative'), {
              nextNumber: increment(1),
              updatedAt: Date.now(),
              updatedBy: currentUserEmail || ''
            }, { merge: true });
          } catch (incErr) {
            console.error("[ERR-QUOTE-INC-02]", incErr);
          }
        }
      }

      const savedQuoteObj = { id: quoteId, ...payload };
      showAlert(isTest
        ? `🧪 Cotización de prueba ${correlativoFinal} generada (sin alterar correlativo oficial).`
        : `✅ Cotización ${correlativoFinal} generada exitosamente.`
      );

      // Abrir modal de compartir de inmediato con la cotización creada
      setCreatedQuoteToShare(savedQuoteObj);
      setShowShareSuccessModal(true);

      // Limpiar datos dinámicos
      setQuoteData(prev => ({
        ...prev,
        description: '',
        brand: '',
        model: '',
        plateOrVin: '',
        quoteNumber: ''
      }));
      setSimpleData(prev => ({ ...prev, amount: '' }));

    } catch (err) {
      console.error("[ERR-SIMPLE-SAVE-01]", err);
      showAlert("❌ [ERR-SIMPLE-SAVE-01] Error al generar la cotización simplificada.");
    }
  };

  // Guardar o Actualizar Cotización en Modo Calculadora Detallada
  const handleSaveQuoteStatus = async (status = 'pendiente') => {
    if (!quoteData.client || !quoteData.origin || !quoteData.destination) {
      return showAlert("⚠️ [ERR-QUOTE-VAL-01] Faltan datos obligatorios (Cliente, Origen y Destino).");
    }
    try {
      const isTest = !!isTestQuote;
      const correlativoFinal = quoteData.quoteNumber?.trim() || (isTest
        ? `TEST-${formatCorrelativeNumber(correlativeConfig)}`
        : formatCorrelativeNumber(correlativeConfig));

      const payload = {
        ...quoteData,
        clientRut: quoteData.clientRut || '',
        clientGiro: quoteData.clientGiro || '',
        clientAddress: quoteData.clientAddress || '',
        clientCity: quoteData.clientCity || '',
        clientPhone: quoteData.clientPhone || '',
        clientEmail: quoteData.clientEmail || '',
        clientContact: quoteData.clientContact || '',
        quoteNumber: correlativoFinal,
        finalPrice: Math.round(finalPrice),
        netPrice: Math.round(netPrice),
        ivaAmount: Math.round(ivaAmount),
        addIva: true,
        isTest,
        status: isTest ? 'prueba' : status,
        selectedTollIds,
        updatedAt: Date.now(),
        mode: 'full'
      };

      let quoteId = editingQuoteId;
      if (editingQuoteId) {
        await updateDoc(doc(db, 'quotes', editingQuoteId), payload);
        showAlert(isTest
          ? `🧪 Cotización de prueba ${correlativoFinal} actualizada.`
          : `✅ Cotización ${correlativoFinal} actualizada [${status.toUpperCase()}].`
        );
        setEditingQuoteId(null);
      } else {
        const docRef = await addDoc(collection(db, 'quotes'), {
          ...payload,
          createdAt: Date.now(),
          createdBy: currentUserEmail || ''
        });
        quoteId = docRef.id;

        // Avanzar contador de correlativo SOLO si NO fue de prueba y fue automático
        if (!isTest && (!quoteData.quoteNumber?.trim() || quoteData.quoteNumber.trim() === formatCorrelativeNumber(correlativeConfig))) {
          try {
            await setDoc(doc(db, 'system_config', 'quotes_correlative'), {
              nextNumber: increment(1),
              updatedAt: Date.now(),
              updatedBy: currentUserEmail || ''
            }, { merge: true });
          } catch (incErr) {
            console.error("[ERR-QUOTE-INC-01]", incErr);
          }
        }

        showAlert(isTest
          ? `🧪 Cotización de prueba ${correlativoFinal} guardada (sin alterar correlativo oficial).`
          : `✅ Cotización ${correlativoFinal} guardada [${status.toUpperCase()}].`
        );
        setQuoteData(prev => ({ ...prev, quoteNumber: '' }));
      }

      const savedQuoteObj = { id: quoteId, ...payload };
      setCreatedQuoteToShare(savedQuoteObj);

    } catch (err) {
      console.error("[ERR-QUOTE-SAVE-01]", err);
      showAlert("❌ [ERR-QUOTE-SAVE-01] Error al guardar cotización.");
    }
  };

  // Aprobar Cotización y Crear Traslado Automáticamente
  const handleApproveQuote = async () => {
    if (!quoteData.client) {
      return showAlert("⚠️ [ERR-QUOTE-APPROVE-VAL-01] Selecciona una empresa cliente.");
    }

    const currentPrice = quoteMode === 'simple' ? simpleFinal : finalPrice;
    const correlativo = quoteData.quoteNumber?.trim() || formatCorrelativeNumber(correlativeConfig);

    showConfirm(`¿Aprobar cotización ${correlativo} por ${formatMoney(currentPrice)} y generar el traslado automáticamente?`, async () => {
      try {
        const matchedOrigin = directoryList.find(d => d.placeName.toLowerCase() === (quoteData.origin || '').toLowerCase());
        const matchedDest = directoryList.find(d => d.placeName.toLowerCase() === (quoteData.destination || '').toLowerCase());

        const newJob = {
          client: quoteData.client || '',
          clientRut: quoteData.clientRut || '',
          clientAddress: quoteData.clientAddress || '',
          origin: quoteData.origin || 'Por definir',
          destination: quoteData.destination || 'Por definir',
          originContactName: matchedOrigin?.contactName || quoteData.clientContact || '',
          originContactPhone: matchedOrigin?.contactPhone || quoteData.clientPhone || '',
          originAddress: matchedOrigin?.address || quoteData.clientAddress || '',
          destContactName: matchedDest?.contactName || '',
          destContactPhone: matchedDest?.contactPhone || '',
          destAddress: matchedDest?.address || '',
          description: `(Cotización ${correlativo}) ${quoteData.description || 'Traslado logístico'}`,
          brand: quoteData.brand || 'Por definir',
          model: quoteData.model || '',
          vehicleType: quoteData.vehicleType || 'Auto / SUV',
          plate: quoteData.plateOrVin || 'S/N',
          tripType: 'traslado',
          status: 'pending',
          createdAt: Date.now(),
          scheduledDate: new Date().toISOString().split('T')[0],
          quotedPrice: Math.round(currentPrice || 0),
          price: Math.round(currentPrice || 0),
          requestedBy: currentUserEmail || ''
        };

        await addDoc(collection(db, 'transport_jobs'), newJob);

        if (quoteMode === 'simple') {
          await handleSaveSimpleQuote();
        } else {
          await handleSaveQuoteStatus('aceptada');
        }

        showAlert("✅ ¡Cotización aprobada! El traslado se ha enviado al Monitor de Trabajos.");
      } catch (error) {
        console.error("[ERR-QUOTE-APPROVE-01]", error);
        showAlert("❌ [ERR-QUOTE-APPROVE-01] Hubo un error al generar el traslado.");
      }
    });
  };

  // Procesar Cotización Aceptada desde el Historial
  const handleConfirmAcceptQuote = async (e) => {
    e.preventDefault();
    if (!acceptQuoteData) return;

    try {
      await updateDoc(doc(db, 'quotes', acceptQuoteData.id), { status: 'aceptada' });

      const matchedOrigin = directoryList?.find(d => d.placeName.toLowerCase() === (acceptQuoteData.origin || '').toLowerCase());
      const matchedDest = directoryList?.find(d => d.placeName.toLowerCase() === (acceptQuoteData.destination || '').toLowerCase());

      const selectedDriverObj = drivers?.find(d => (d.name || d.email) === jobDetails.assignedDriver);
      const assignedEmails = selectedDriverObj ? [selectedDriverObj.email] : [];

      const newJob = {
        client: acceptQuoteData.client || '',
        clientRut: acceptQuoteData.clientRut || '',
        origin: acceptQuoteData.origin || 'Por definir',
        destination: acceptQuoteData.destination || 'Por definir',
        originContactName: matchedOrigin?.contactName || acceptQuoteData.clientContact || '',
        originContactPhone: matchedOrigin?.contactPhone || acceptQuoteData.clientPhone || '',
        originAddress: matchedOrigin?.address || acceptQuoteData.clientAddress || '',
        destContactName: matchedDest?.contactName || '',
        destContactPhone: matchedDest?.contactPhone || '',
        destAddress: matchedDest?.address || '',
        description: `(Cotización ${acceptQuoteData.quoteNumber || 'S/N'}) ${acceptQuoteData.description || 'Traslado logístico'}`,
        brand: acceptQuoteData.brand || 'Por definir',
        model: acceptQuoteData.model || '',
        vehicleType: acceptQuoteData.vehicleType || 'Auto / SUV',
        plate: acceptQuoteData.plateOrVin || 'S/N',
        tripType: 'traslado',
        status: 'pending',
        assignedDriver: jobDetails.assignedDriver || '',
        assignedEmails: assignedEmails,
        createdAt: Date.now(),
        scheduledDate: jobDetails.scheduledDate || new Date().toISOString().split('T')[0],
        quotedPrice: Math.round(acceptQuoteData.finalPrice || 0),
        price: Math.round(acceptQuoteData.finalPrice || 0),
        requestedBy: currentUserEmail || ''
      };

      await addDoc(collection(db, 'transport_jobs'), newJob);
      showAlert("✅ ¡Cotización aceptada y traslado agendado exitosamente!");

      setShowAcceptModal(false);
      setAcceptQuoteData(null);
      setJobDetails({ scheduledDate: new Date().toISOString().split('T')[0], assignedDriver: '' });
    } catch (error) {
      console.error("[ERR-QUOTE-ACCEPT-01]", error);
      showAlert("❌ [ERR-QUOTE-ACCEPT-01] Hubo un error al generar el traslado.");
    }
  };

  // Cache para el logo en Base64 para evitar bloqueos por CORS o demoras de carga
  const getLogoBase64 = async () => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          resolve(`${window.location.origin}/LogoLogistica.png`);
        }
      };
      img.onerror = () => resolve(`${window.location.origin}/LogoLogistica.png`);
      setTimeout(() => resolve(`${window.location.origin}/LogoLogistica.png`), 1500);
      img.src = `${window.location.origin}/LogoLogistica.png`;
    });
  };

  // Cargador seguro de html2pdf con detección de scripts existentes y timeout
  const loadHtml2Pdf = () => {
    return new Promise((resolve, reject) => {
      if (window.html2pdf) return resolve(window.html2pdf);
      const existing = document.querySelector('script[src*="html2pdf"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.html2pdf));
        existing.addEventListener('error', () => reject(new Error('Failed to load html2pdf script')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve(window.html2pdf);
      script.onerror = () => reject(new Error('Failed to load html2pdf from CDN'));
      document.head.appendChild(script);
      setTimeout(() => {
        if (window.html2pdf) resolve(window.html2pdf);
        else reject(new Error('html2pdf script load timeout'));
      }, 7000);
    });
  };

  // Generador de HTML para PDF Desacoplado (Sirve para cualquier cotización del historial o del formulario)
  const buildQuotePDFHtml = (targetQuote, customLogoUrl) => {
    const qData = targetQuote || quoteData;
    const correlativo = qData.quoteNumber?.trim() || formatCorrelativeNumber(correlativeConfig);
    const clientFullAddress = [qData.clientAddress, qData.clientCity].filter(Boolean).join(', ');
    const issuerFullContact = [issuerCompany.phone, issuerCompany.email].filter(Boolean).join(' • ');
    const hasIva = qData.ivaAmount > 0;
    const logoSrc = customLogoUrl || `${window.location.origin}/LogoLogistica.png`;

    return `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; width: 800px; margin: 0; padding: 30px; box-sizing: border-box;">
        ${qData.isTest ? `
          <div style="background: #fffbeb; border: 2px dashed #f59e0b; color: #b45309; padding: 12px 18px; border-radius: 12px; margin-bottom: 22px; text-align: center;">
            <div style="font-size: 13px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">
              ⚠️ DOCUMENTO DE PRUEBA / BORRADOR - SIN VALIDEZ TRIBUTARIA
            </div>
            <div style="font-size: 10px; font-weight: 600; color: #92400e; margin-top: 3px;">
              Esta cotización fue generada con fines de prueba y simulación interna. No constituye un compromiso comercial formal.
            </div>
          </div>
        ` : ''}

        <!-- ENCABEZADO CON MEMBRETE DE NUESTRA EMPRESA -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #7c3aed; padding-bottom: 20px; margin-bottom: 25px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img src="${logoSrc}" style="max-height: 60px;" alt="Logo" onerror="this.style.display='none'" />
            <div>
              <h2 style="margin: 0; color: #1e293b; font-size: 15px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.3px;">${issuerCompany.companyName || 'LogisticAPP - Sistema de Gestión Logística'}</h2>
              ${issuerCompany.rut ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600;"><strong>RUT:</strong> ${issuerCompany.rut}</p>` : ''}
              ${issuerCompany.giro ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600;"><strong>Giro:</strong> ${issuerCompany.giro}</p>` : ''}
              ${issuerCompany.address ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600;">${issuerCompany.address}</p>` : ''}
              ${issuerFullContact ? `<p style="margin: 2px 0 0 0; color: #7c3aed; font-weight: 700; font-size: 11px;">${issuerFullContact}</p>` : ''}
            </div>
          </div>

          <div style="text-align: right;">
            <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.5px; ${qData.isTest ? 'color: #d97706;' : 'color: #7c3aed;'}">${qData.isTest ? 'Cotización (Prueba)' : 'Cotización'}</h1>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 900; font-family: monospace; ${qData.isTest ? 'color: #d97706;' : 'color: #0f172a;'}">${correlativo}</p>
            <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600;">Fecha de Emisión: ${new Date(qData.createdAt || Date.now()).toLocaleDateString('es-CL')}</p>
            <p style="margin: 3px 0 0 0; color: #94a3b8; font-size: 10px;">${qData.isTest ? 'Documento de simulación' : 'Válida por 15 días corridos'}</p>
          </div>
        </div>

        <!-- DATOS FORMALES DE LA EMPRESA CLIENTE -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 900; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">Datos de la Empresa Cliente</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px;">
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Razón Social / Empresa</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a; word-break: break-word;">${qData.client || 'A Quien Corresponda'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">RUT Empresa</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.clientRut || 'Sin RUT registrado'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Giro Comercial</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.clientGiro || 'No especificado'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Dirección Comercial</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${clientFullAddress || 'No especificada'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Atención a / Contacto</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.clientContact || 'Departamento de Adquisiciones'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Teléfono / Correo</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${[qData.clientPhone, qData.clientEmail].filter(Boolean).join(' • ') || 'No especificado'}</div>
            </div>
          </div>
        </div>

        <!-- DETALLES DE LA RUTA Y VEHÍCULO -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; margin-top: -5px;">
          <div style="font-size: 11px; font-weight: 900; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">Detalles del Traslado y Carga</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px;">
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Ruta Programada</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.origin || qData.destination ? `${qData.origin || 'Origen'} ➔ ${qData.destination || 'Destino'}` : 'Según itinerario acordado'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Distancia Estimada</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.distanceKm ? qData.distanceKm + ' KM' : 'N/A'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Tipo de Vehículo</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.vehicleType || 'No especificado'}</div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Vehículo (Marca / Modelo)</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.brand || ''} ${qData.model || ''}</div>
            </div>
            <div style="grid-column: span 2;">
              <div style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800; margin-bottom: 3px;">Patente / Identificador VIN</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${qData.plateOrVin || 'S/N'}</div>
            </div>
          </div>
        </div>

        <!-- TABLA DE VALORES -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr>
              <th style="background: #f8fafc; color: #475569; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Descripción del Servicio Logístico</th>
              <th style="background: #f8fafc; color: #475569; text-align: right; padding: 12px 16px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Total Neto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                <strong>${qData.description || 'Servicio de traslado logístico de vehículo'}</strong><br/>
                <span style="font-size: 11px; color: #64748b; font-weight: normal; margin-top: 4px; display: inline-block;">
                  Incluye conducción profesional, inspección visual de recepción y entrega segura.
                </span>
              </td>
              <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 800; vertical-align: top; text-align: right; color: #1e293b;">${formatMoney(qData.netPrice || qData.finalPrice)}</td>
            </tr>
          </tbody>
        </table>

        <!-- RESUMEN FINANCIERO -->
        <div style="width: 330px; margin-left: auto; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          ${hasIva ? `
            <div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #475569; background: #fff;">
              <span>Subtotal Neto</span>
              <span>${formatMoney(qData.netPrice)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #475569; background: #fff;">
              <span>IVA (19%)</span>
              <span>${formatMoney(qData.ivaAmount)}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #475569; background: #fff;">
              <span>Régimen Tributario</span>
              <span style="color: #64748b; font-weight: 800;">Exento / Sin IVA</span>
            </div>
          `}
          <div style="display: flex; justify-content: space-between; padding: 10px 16px; font-size: 16px; font-weight: 900; background: #7c3aed; color: #fff;">
            <span>Total a Pagar</span>
            <span>${formatMoney(qData.finalPrice)}</span>
          </div>
        </div>

        <!-- PIE DE PÁGINA -->
        <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-weight: 600; line-height: 1.5;">
          <p style="margin: 0 0 4px 0;">Esta cotización formal tiene una validez de 15 días corridos a contar de su fecha de emisión.</p>
          <p style="margin: 0;">Generado automáticamente a través de LogisticAPP - Sistema Integral de Gestión Logística</p>
        </div>
      </div>
    `;
  };

  // Descarga Directa de Archivo PDF para cualquier cotización
  const handleDownloadPDFForQuote = async (targetQuote) => {
    if (!targetQuote) return;
    showAlert("⏳ Generando descarga de documento PDF...");
    const correlativo = targetQuote.quoteNumber || 'Cotizacion';
    const clientClean = (targetQuote.client || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${correlativo}_${clientClean}.pdf`;

    try {
      const [html2pdf, logoDataUrl] = await Promise.all([
        loadHtml2Pdf(),
        getLogoBase64()
      ]);

      const htmlContent = buildQuotePDFHtml(targetQuote, logoDataUrl);

      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().from(htmlContent).set(opt).save();
      showAlert("✅ Archivo PDF descargado correctamente.");
    } catch (err) {
      console.error("[ERR-QUOTE-DL-01]", err);
      try {
        const logoDataUrl = await getLogoBase64();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(buildQuotePDFHtml(targetQuote, logoDataUrl));
          printWindow.document.close();
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        } else {
          showAlert("❌ [ERR-QUOTE-DL-02] Bloqueador de popups impidió imprimir el PDF.");
        }
      } catch (err2) {
        console.error("[ERR-QUOTE-DL-03]", err2);
        showAlert("❌ [ERR-QUOTE-DL-03] Error al procesar la descarga del PDF.");
      }
    }
  };

  // Compartir por WhatsApp o Correo con PDF Adjunto (Desacoplado)
  const handleShareQuote = async (targetQuote, method) => {
    const qData = targetQuote || quoteData;
    if (!qData.client) {
      return showAlert("⚠️ [ERR-QUOTE-SHARE-VAL-01] Falta la empresa cliente para compartir.");
    }

    const correlativo = qData.quoteNumber?.trim() || formatCorrelativeNumber(correlativeConfig);
    const fileName = `${correlativo}_${(qData.client || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    const testHeader = qData.isTest
      ? `🧪 *[COTIZACIÓN DE PRUEBA / SIMULACIÓN]*\n_Aviso: Este documento es únicamente una prueba sin validez legal ni tributaria._\n\n`
      : '';

    const text = testHeader +
      `*Cotización de Traslado ${correlativo}*\n\n` +
      `🏢 *Empresa Cliente:* ${qData.client}${qData.clientRut ? ` (RUT: ${qData.clientRut})` : ''}\n` +
      (qData.clientGiro ? `💼 *Giro:* ${qData.clientGiro}\n` : '') +
      (qData.clientAddress ? `📍 *Dirección:* ${qData.clientAddress}\n` : '') +
      (qData.clientContact ? `👤 *Atención:* ${qData.clientContact}\n` : '') +
      (qData.origin && qData.destination ? `🛣️ *Ruta:* ${qData.origin} ➔ ${qData.destination} ${qData.distanceKm ? `(${qData.distanceKm} KM)` : ''}\n` : '') +
      `🚘 *Vehículo:* ${qData.vehicleType || 'Vehículo'} ${qData.brand ? `- ${qData.brand} ${qData.model || ''}` : ''} ${qData.plateOrVin ? `[${qData.plateOrVin}]` : ''}\n` +
      `📋 *Servicio:* ${qData.description || 'Traslado logístico'}\n\n` +
      (qData.ivaAmount > 0 ? (
        `💰 *Subtotal Neto:* ${formatMoney(qData.netPrice)}\n` +
        `🧾 *IVA (19%):* ${formatMoney(qData.ivaAmount)}\n`
      ) : '') +
      `✅ *Total a Pagar:* ${formatMoney(qData.finalPrice)}${qData.ivaAmount === 0 ? ' (Exento/Sin IVA)' : ''}\n\n` +
      (issuerCompany.companyName ? `_Emitido por: ${issuerCompany.companyName}${issuerCompany.rut ? ` (RUT: ${issuerCompany.rut})` : ''}_\n` : '') +
      `_Generado por LogisticAPP_`;

    if (method === 'whatsapp') {
      try {
        showAlert("⏳ Preparando documento PDF para WhatsApp...");

        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) { }
        document.body.removeChild(textArea);

        const [html2pdf, logoDataUrl] = await Promise.all([
          loadHtml2Pdf(),
          getLogoBase64()
        ]);

        const htmlContent = buildQuotePDFHtml(qData, logoDataUrl);

        const opt = {
          margin: 0,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#ffffff'
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await html2pdf().from(htmlContent).set(opt).output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: fileName,
            files: [file]
          });
          showAlert("✅ PDF adjunto listo. Pega el texto en el chat.");
        } else {
          showAlert("Abriendo WhatsApp Web... Pega el texto que ya fue copiado.");
          await html2pdf().from(htmlContent).set(opt).save();

          setTimeout(() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }, 1500);
        }

        if (qData.id) {
          updateDoc(doc(db, 'quotes', qData.id), { status: 'enviada', updatedAt: Date.now() }).catch(() => { });
        }
      } catch (error) {
        console.error("[ERR-QUOTE-PDF-01]", error);
        showAlert("❌ [ERR-QUOTE-PDF-01] Hubo un error al intentar compartir el PDF.");
      }
    } else if (method === 'email') {
      const subject = `Cotización de Traslado ${correlativo} - ${qData.client}`;
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, '_self');
      if (qData.id) {
        updateDoc(doc(db, 'quotes', qData.id), { status: 'enviada', updatedAt: Date.now() }).catch(() => { });
      }
    }
  };

  const previewNextCorrelative = isTestQuote
    ? `TEST-${formatCorrelativeNumber(correlativeConfig)}`
    : formatCorrelativeNumber(correlativeConfig);

  return (
    <div className="space-y-6 pt-20 md:pt-22 max-w-6xl mx-auto px-4 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* BANNER SUPERIOR: TÍTULO, CONFIGURAR CORRELATIVO Y CONFIGURAR EMPRESA/CLIENTES */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="bg-purple-100 dark:bg-purple-900/40 p-3 rounded-2xl text-purple-600 dark:text-purple-400 shrink-0">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Cotizador de Traslados
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border transition-all ${isTestQuote
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                }`}>
                {isTestQuote ? `🧪 ${previewNextCorrelative}` : `Próximo: ${previewNextCorrelative}`}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Costea traslados, calcula márgenes y genera servicios agendados con emisión inmediata.
            </p>
          </div>
        </div>

        {/* BOTONES DE CONFIGURACIÓN SUPERIORES */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleOpenConfigModal}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Configurar Correlativo
          </button>

          <button
            type="button"
            onClick={() => handleOpenClientConfigModal(quoteData.client)}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-xs transition-colors border border-purple-200 dark:border-purple-800 shadow-sm"
          >
            <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Configurar Cliente / Empresa
          </button>
        </div>
      </div>

      {/* SELECTOR DE MODO Y SWITCH DE COTIZACIÓN DE PRUEBA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 w-full sm:max-w-md shadow-sm">
          <button
            type="button"
            onClick={() => handleSetQuoteMode('simple')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${quoteMode === 'simple'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-300 dark:shadow-none'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
          >
            <Smartphone className="w-4 h-4" />
            Modo Rápido (Celular)
          </button>

          <button
            type="button"
            onClick={() => handleSetQuoteMode('full')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${quoteMode === 'full'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-300 dark:shadow-none'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
          >
            <Calculator className="w-4 h-4" />
            Calculadora de Ruta & Peajes
          </button>
        </div>

        {/* INTERRUPTOR: COTIZACIÓN DE PRUEBA */}
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border transition-all shadow-sm ${isTestQuote
          ? 'bg-amber-500/10 border-amber-400 dark:border-amber-500/40 text-amber-900 dark:text-amber-200'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl shrink-0 ${isTestQuote ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black">Cotización de Prueba</span>
                {isTestQuote && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-amber-500 text-white rounded">
                    TEST
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {isTestQuote ? 'No alterará correlativo oficial' : 'Simulación sin afectar correlativos'}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isTestQuote}
            onClick={() => setIsTestQuote(prev => !prev)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isTestQuote ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isTestQuote ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
          </button>
        </div>
      </div>

      {/* AVISO DE MODO EDICIÓN */}
      {editingQuoteId && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700/50 p-4 rounded-2xl flex justify-between items-center shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
            <p className="text-xs font-black text-amber-800 dark:text-amber-300">
              Modificando cotización existente ({quoteData.quoteNumber || 'S/N'}). Los cambios actualizarán el registro actual.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingQuoteId(null);
              setQuoteData(prev => ({ ...prev, quoteNumber: '' }));
              setSimpleData({ amount: '', addIva: true });
              showAlert("Edición cancelada.");
            }}
            className="text-xs font-black text-amber-900 dark:text-amber-300 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-xl transition-colors"
          >
            Cancelar Edición
          </button>
        </div>
      )}

      {/* CONTENIDO SEGÚN MODO SELECCIONADO */}
      {quoteMode === 'simple' ? (

        /* ========================================================================= */
        /* MODO SIMPLIFICADO (ESPECIAL PARA CELULAR / COTIZACIÓN DIRECTA)             */
        /* ========================================================================= */
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-xl text-purple-600 dark:text-purple-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Cotización Rápida
                </h3>
                <p className="text-[11px] font-bold text-slate-400">
                  Ingresa los datos directos y genera la cotización al instante
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenClientConfigModal()}
              className="text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-xl hover:bg-purple-200 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
            </button>
          </div>

          <form onSubmit={handleSaveSimpleQuote} className="space-y-4">

            {/* 1. Empresa Cliente */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  1. Empresa Cliente *
                </label>
                {quoteData.client && (
                  <button
                    type="button"
                    onClick={() => handleOpenClientConfigModal(quoteData.client)}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <Building2 className="w-3 h-3" /> Editar RUT
                  </button>
                )}
              </div>
              <select
                value={quoteData.client}
                onChange={handleClientChange}
                required
                className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 bg-slate-50 dark:bg-slate-900"
              >
                <option value="">Selecciona cliente / empresa...</option>
                {customClients.map(c => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name} {c.rut ? `(RUT: ${c.rut})` : ''}
                  </option>
                ))}
              </select>

              {/* Ficha rápida si está seleccionado */}
              {quoteData.client && (
                <div className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span><strong>RUT:</strong> {quoteData.clientRut || 'Sin RUT'}</span>
                  <span><strong>Giro:</strong> {quoteData.clientGiro || 'General'}</span>
                </div>
              )}
            </div>

            {/* 2. Descripción del Servicio */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                2. Descripción del Servicio / Ruta
              </label>
              <input
                type="text"
                value={quoteData.description}
                onChange={e => setQuoteData({ ...quoteData, description: e.target.value })}
                placeholder="Ej: Traslado Santiago a Valparaíso o Traslado por falla mecánica"
                className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
              />
            </div>

            {/* 3. Datos del Vehículo: Marca, Modelo y Patente */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Marca
                </label>
                <input
                  type="text"
                  value={quoteData.brand}
                  onChange={e => setQuoteData({ ...quoteData, brand: e.target.value })}
                  placeholder="Ej: TOYOTA"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Modelo
                </label>
                <input
                  type="text"
                  value={quoteData.model}
                  onChange={e => setQuoteData({ ...quoteData, model: e.target.value })}
                  placeholder="Ej: HILUX"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Patente o VIN
                </label>
                <input
                  type="text"
                  maxLength="17"
                  value={quoteData.plateOrVin}
                  onChange={e => {
                    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    setQuoteData(prev => ({ ...prev, plateOrVin: val }));
                  }}
                  placeholder="Ej: ABCD12"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase outline-none focus:border-purple-500 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            {/* 4. Monto a Cobrar */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">
                4. Monto a Cobrar ($) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  value={simpleData.amount}
                  onChange={e => setSimpleData({ ...simpleData, amount: e.target.value })}
                  placeholder="Ej: 150000"
                  className="w-full border-2 border-purple-300 dark:border-purple-700 rounded-2xl p-3.5 pl-11 text-lg font-black text-purple-700 dark:text-purple-300 outline-none focus:border-purple-600 bg-purple-50/20 dark:bg-purple-950/30"
                />
                <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400 absolute left-3.5 top-4" />
              </div>
            </div>

            {/* 5. Pregunta: ¿Suma IVA o no? */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  ¿Sumar IVA (19%)?
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {simpleData.addIva ? 'Neto + IVA' : 'Valor Final / Exento'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSimpleData({ ...simpleData, addIva: true })}
                  className={`py-3 px-3 rounded-xl text-xs font-black transition-all border ${simpleData.addIva
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                >
                  Sí, Sumar IVA (+19%)
                </button>

                <button
                  type="button"
                  onClick={() => setSimpleData({ ...simpleData, addIva: false })}
                  className={`py-3 px-3 rounded-xl text-xs font-black transition-all border ${!simpleData.addIva
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                >
                  No, Valor Final / Exento
                </button>
              </div>

              {/* Desglose en Vivo */}
              {simpleAmountNum > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs flex justify-between items-center font-bold">
                  {simpleData.addIva ? (
                    <>
                      <span className="text-slate-500">Neto: {formatMoney(simpleNet)} + IVA: {formatMoney(simpleIva)}</span>
                      <span className="text-sm font-black text-purple-700 dark:text-purple-300">Total: {formatMoney(simpleFinal)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-500">Monto Exento</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Total Final: {formatMoney(simpleFinal)}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 6. Interruptor de Cotización de Prueba (Modo Rápido) */}
            <div className={`p-3.5 rounded-2xl border transition-all ${isTestQuote
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60'
              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isTestQuote ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      ¿Es una cotización de prueba?
                      {isTestQuote && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-500 text-white rounded-full">
                          Activo
                        </span>
                      )}
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isTestQuote
                        ? 'No consumirá el correlativo oficial y llevará sello de prueba.'
                        : 'Desactivado: usará el correlativo oficial de tu empresa.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isTestQuote}
                  onClick={() => setIsTestQuote(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isTestQuote ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isTestQuote ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* 7. Botón de Aceptar y Generar Cotización */}
            <button
              type="submit"
              className={`w-full text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm ${isTestQuote
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 dark:shadow-none'
                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200 dark:shadow-none'
                }`}
            >
              {isTestQuote ? (
                <>
                  <FlaskConical className="w-5 h-5" /> Generar Cotización de Prueba
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" /> Aceptar y Generar Cotización
                </>
              )}
            </button>
          </form>
        </div>

      ) : (

        /* ========================================================================= */
        /* MODO CALCULADORA DETALLADA (DISTANCIA, PEAJES, COMBUSTIBLE Y MARGEN)        */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* COLUMNA IZQUIERDA: FORMULARIO DETALLADO */}
          <div className="lg:col-span-8 space-y-6">

            {/* Tarjeta 1: Datos del Traslado y Vehículo */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Datos de Ruta y Vehículo
                </h3>
                <button
                  type="button"
                  onClick={() => handleOpenClientConfigModal()}
                  className="text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
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

                {/* N° Correlativo */}
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      N° Correlativo de Cotización
                    </label>
                    <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                      {quoteData.quoteNumber ? 'Manual / Editado' : `Automático (${previewNextCorrelative})`}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      name="quoteNumber"
                      value={quoteData.quoteNumber}
                      onChange={handleInputChange}
                      placeholder={previewNextCorrelative}
                      autoComplete="off"
                      spellCheck="false"
                      className="w-full border-2 border-purple-200 dark:border-purple-900/50 rounded-xl p-3 pl-10 text-sm font-black text-purple-700 dark:text-purple-300 outline-none focus:border-purple-500 bg-purple-50/20 dark:bg-purple-950/20 font-mono"
                    />
                    <Hash className="w-4 h-4 text-purple-500 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                {/* Empresa Cliente Selector & Ficha Formal */}
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Empresa Cliente (Para la Cotización)
                    </label>
                    {quoteData.client && (
                      <button
                        type="button"
                        onClick={() => handleOpenClientConfigModal(quoteData.client)}
                        className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <Building2 className="w-3 h-3" /> Editar RUT y Datos
                      </button>
                    )}
                  </div>

                  <select
                    name="client"
                    value={quoteData.client}
                    onChange={handleClientChange}
                    className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-slate-50 dark:bg-slate-900"
                  >
                    <option value="">Selecciona una empresa cliente...</option>
                    {customClients.map(c => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name} {c.rut ? `(RUT: ${c.rut})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Ficha corporativa */}
                  {quoteData.client && (
                    <div className="bg-purple-50/40 dark:bg-purple-950/30 p-3.5 rounded-2xl border border-purple-100 dark:border-purple-900/50 text-xs animate-in fade-in">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-black text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            {quoteData.client}
                          </span>
                          {quoteData.clientRut ? (
                            <span className="text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-md inline-block mt-0.5">
                              RUT: {quoteData.clientRut}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md inline-block mt-0.5">
                              ⚠️ Sin RUT registrado
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenClientConfigModal(quoteData.client)}
                          className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-50 transition-colors"
                        >
                          Configurar
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400 font-medium pt-1 border-t border-purple-100 dark:border-purple-900/30">
                        <p><strong className="text-slate-700 dark:text-slate-300">Giro:</strong> {quoteData.clientGiro || 'No especificado'}</p>
                        <p><strong className="text-slate-700 dark:text-slate-300">Dirección:</strong> {[quoteData.clientAddress, quoteData.clientCity].filter(Boolean).join(', ') || 'No especificada'}</p>
                        <p><strong className="text-slate-700 dark:text-slate-300">Contacto:</strong> {quoteData.clientContact || 'No especificado'}</p>
                        <p><strong className="text-slate-700 dark:text-slate-300">Teléfono:</strong> {quoteData.clientPhone || quoteData.clientEmail || 'No especificado'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Origen */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen</label>
                  <input type="text" name="origin" list="quotes-directory-list" value={quoteData.origin} onChange={handleInputChange} placeholder="Desde dónde..." autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900" />
                </div>

                {/* Destino */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destino</label>
                  <div className="flex gap-2">
                    <input type="text" name="destination" list="quotes-directory-list" value={quoteData.destination} onChange={handleInputChange} placeholder="Hasta dónde..." autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900" />
                    <button type="button" onClick={calculateRouteDistance} disabled={isCalculatingRoute} className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-xl text-xs font-black shadow-sm shrink-0 transition-colors disabled:opacity-50" title="Calcular distancia de ruta real por carretera">
                      {isCalculatingRoute ? '...' : 'Calcular KM'}
                    </button>
                  </div>
                </div>

                {/* Distancia Total KM */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Distancia Total (KM Ruta)</label>
                  <div className="relative">
                    <input type="number" name="distanceKm" value={quoteData.distanceKm} onChange={handleInputChange} placeholder="Ej: 120" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900" />
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                {/* Tipo de Vehículo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Vehículo</label>
                  <select name="vehicleType" value={quoteData.vehicleType} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900">
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

                {/* Marca */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                  <input type="text" name="brand" list="quotes-brands-list" value={quoteData.brand} onChange={handleInputChange} placeholder="Ej: TOYOTA" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 uppercase bg-white dark:bg-slate-900" />
                </div>

                {/* Modelo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                  <input type="text" name="model" list="quotes-models-list" value={quoteData.model} onChange={handleInputChange} placeholder="Ej: HILUX" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 uppercase bg-white dark:bg-slate-900" />
                </div>

                {/* Patente o VIN */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patente o VIN</label>
                  <input
                    type="text"
                    name="plateOrVin"
                    maxLength="17"
                    value={quoteData.plateOrVin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                      setQuoteData(prev => ({ ...prev, plateOrVin: val }));
                    }}
                    placeholder="Ej: ABCD12"
                    className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-black uppercase text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción corta</label>
                  <input type="text" name="description" value={quoteData.description} onChange={handleInputChange} placeholder="Detalles adicionales..." autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900" />
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Gastos Operativos, Calculadora y Peajes */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Estructura de Costos y Peajes
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">Rendimiento (KM/L)</label>
                  <div className="relative">
                    <input type="number" step="0.1" name="kmPerLiter" value={quoteData.kmPerLiter} onChange={handleInputChange} placeholder="Ej: 10.5" className="w-full border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl p-3 pl-10 text-sm font-black text-emerald-800 dark:text-emerald-300 outline-none focus:border-emerald-500" />
                    <Fuel className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio Combustible ($/L)</label>
                  <div className="flex gap-2">
                    <input type="number" name="fuelPrice" value={quoteData.fuelPrice} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900" />
                    <button type="button" onClick={fetchFuelPriceWithAI} disabled={isFetchingFuel} className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 px-3 rounded-xl text-xs font-black shadow-sm shrink-0 transition-colors disabled:opacity-50" title="Consultar precio sugerido a Gemini">
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Honorarios Conductor ($)</label>
                  <div className="relative">
                    <input type="number" name="driverFee" value={quoteData.driverFee} onChange={handleInputChange} placeholder="Ej: 35000" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900" />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Peajes Calculados ($)</label>
                  <div className="relative">
                    <input type="number" name="tollsCost" value={quoteData.tollsCost} onChange={handleInputChange} placeholder="Auto o manual..." className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900" />
                    <Receipt className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">Margen de Utilidad (%)</label>
                  <div className="relative">
                    <input type="number" name="marginPct" value={quoteData.marginPct} onChange={handleInputChange} placeholder="30" className="w-full border-2 border-purple-200 dark:border-purple-800/60 rounded-xl p-3 pl-10 text-sm font-black text-purple-700 dark:text-purple-300 outline-none focus:border-purple-500 bg-purple-50/30 dark:bg-purple-950/20" />
                    <DollarSign className="w-4 h-4 text-purple-500 absolute left-3.5 top-3.5" />
                  </div>
                </div>
              </div>

              {/* SECCIÓN DE SELECCIÓN DE PEAJES */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Seleccionar Peajes ({tollsList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEditingTollId(null); setShowNewTollModal(true); }}
                    className="text-[11px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Registrar Nuevo Peaje
                  </button>
                </div>

                {tollsList.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 italic bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-center">
                    No hay peajes creados aún. Registra el primero para calcular automáticamente.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-none border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900">
                    {tollsList.map(toll => {
                      const isChecked = selectedTollIds.includes(toll.id);
                      const price = toll.prices?.[quoteData.vehicleType] || 0;
                      return (
                        <div key={toll.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isChecked ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700/50 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                          <label className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0">
                            <input type="checkbox" checked={isChecked} onChange={() => toggleTollSelection(toll.id)} className="w-4 h-4 accent-purple-600 rounded cursor-pointer shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{toll.name}</p>
                              <p className="text-[10px] font-bold text-slate-400">{toll.route} • KM {toll.km}</p>
                            </div>
                          </label>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs font-black text-purple-700 dark:text-purple-400">{formatMoney(price)}</span>
                            <button type="button" onClick={() => handleEditToll(toll)} className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-lg transition-colors">Modificar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: RESULTADOS Y ACCIONES MODO COMPLETO */}
          <div className="lg:col-span-4 space-y-6">

            {/* Panel de Resultados */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-5 shadow-xl border border-slate-800 text-white">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" /> Resumen Financiero
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-xs font-bold text-slate-300">Litros Estimados:</span>
                  <span className="text-sm font-black text-white">{totalLiters > 0 ? totalLiters.toFixed(1) : 0} L</span>
                </div>
                <div className="flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-xs font-bold text-slate-300">Gasto Combustible:</span>
                  <span className="text-sm font-black text-red-400">{formatMoney(fuelCost)}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-xs font-bold text-slate-300">Costo Operativo (Total):</span>
                  <span className="text-sm font-black text-amber-400">{formatMoney(subtotalCosts)}</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/60">
                  <span className="text-xs font-bold text-emerald-400">Ganancia Estimada:</span>
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

              <div className="bg-slate-950 rounded-2xl p-4 text-center border border-slate-800 mt-4 shadow-inner">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar (con IVA)</p>
                <p className="text-3xl font-black text-emerald-400">{formatMoney(finalPrice)}</p>
              </div>
            </div>

            {/* Interruptor: Cotización de Prueba (Calculadora) */}
            <div className={`p-4 rounded-2xl border transition-all ${isTestQuote
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isTestQuote ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      Cotización de Prueba
                      {isTestQuote && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-500 text-white rounded-full">
                          Activo
                        </span>
                      )}
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isTestQuote ? 'No consumirá el correlativo oficial.' : 'Simulación de prueba o borrador.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isTestQuote}
                  onClick={() => setIsTestQuote(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isTestQuote ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isTestQuote ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => handleSaveQuoteStatus('pendiente')}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl transition-colors shadow-md flex items-center justify-center gap-2 text-sm border border-slate-700"
              >
                <Save className="w-5 h-5" /> Guardar como Pendiente
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedQuoteToShare({
                    ...quoteData,
                    netPrice,
                    ivaAmount,
                    finalPrice,
                    quoteNumber: quoteData.quoteNumber || formatCorrelativeNumber(correlativeConfig)
                  });
                  setShowShareSuccessModal(true);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-colors shadow-md shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 text-sm"
              >
                <Send className="w-5 h-5" /> Enviar Cotización
              </button>

              <button
                type="button"
                onClick={handleApproveQuote}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-colors shadow-md shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle className="w-5 h-5" /> Aprobar y Crear Traslado
              </button>
            </div>

          </div>
        </div>
      )}

      {/* HISTORIAL DE COTIZACIONES GUARDADAS */}
      {(() => {
        const filteredQuotes = savedQuotes.filter(q => {
          if (historyFilter === 'official') return !q.isTest;
          if (historyFilter === 'test') return !!q.isTest;
          return true;
        });
        const testCount = savedQuotes.filter(q => q.isTest).length;
        const officialCount = savedQuotes.length - testCount;

        return (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 mt-8">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Historial de Cotizaciones
                </h3>

                {/* FILTRO DE HISTORIAL: TODAS / OFICIALES / PRUEBAS */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${historyFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                  >
                    Todas ({savedQuotes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('official')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${historyFilter === 'official'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                  >
                    Oficiales ({officialCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('test')}
                    className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${historyFilter === 'test'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                      }`}
                  >
                    <FlaskConical className="w-3 h-3" />
                    Pruebas ({testCount})
                  </button>
                </div>
              </div>

              <span className="text-[11px] font-bold text-slate-400">
                Mostrando {filteredQuotes.length} de {savedQuotes.length} • Descarga directa en un clic
              </span>
            </div>

            {filteredQuotes.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400">
                  {historyFilter === 'test'
                    ? 'No hay cotizaciones de prueba registradas.'
                    : historyFilter === 'official'
                      ? 'No hay cotizaciones oficiales registradas.'
                      : 'No hay cotizaciones registradas aún.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-24 min-h-[280px]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3">N° Correlativo</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Ruta / Servicio</th>
                      <th className="p-3">Vehículo / Patente</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    {filteredQuotes.map((q, idx) => {
                      const correlativo = q.quoteNumber || `COT-${idx + 1}`;
                      return (
                        <tr key={q.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${q.isTest ? 'bg-amber-500/5 dark:bg-amber-500/5' : ''
                          }`}>
                          <td className="p-3 font-mono font-black">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={q.isTest ? 'text-amber-600 dark:text-amber-400' : 'text-purple-700 dark:text-purple-400'}>
                                {correlativo}
                              </span>
                              {q.isTest && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5 font-extrabold uppercase">
                                  <FlaskConical className="w-2.5 h-2.5" /> TEST
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-black">
                            {q.client}
                            {q.clientRut && <span className="block text-[10px] font-mono font-normal text-slate-400">{q.clientRut}</span>}
                          </td>
                          <td className="p-3 font-medium">
                            {q.origin && q.destination
                              ? `${q.origin} ➔ ${q.destination} ${q.distanceKm ? `(${q.distanceKm} KM)` : ''}`
                              : (q.description || 'Traslado logístico')
                            }
                          </td>
                          <td className="p-3">
                            {q.brand} {q.model} <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-1 font-mono">{q.plateOrVin || 'S/N'}</span>
                          </td>
                          <td className="p-3 font-black text-slate-900 dark:text-slate-100">
                            {formatMoney(q.finalPrice)}
                            {q.ivaAmount === 0 && <span className="block text-[9px] font-normal text-slate-400">Exento</span>}
                          </td>
                          <td className="p-3">
                            {q.isTest ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1">
                                <FlaskConical className="w-3 h-3" /> Prueba
                              </span>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${q.status === 'aceptada' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800' :
                                q.status === 'enviada' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                }`}>
                                {q.status || 'pendiente'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right relative">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* BOTÓN RÁPIDO DE DESCARGA DIRECTA DE PDF */}
                              <button
                                type="button"
                                onClick={() => handleDownloadPDFForQuote(q)}
                                title="Descargar PDF de esta cotización"
                                className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/50 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 rounded-xl transition-colors shadow-sm"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {/* MENÚ DE TRES PUNTOS */}
                              <button
                                type="button"
                                onClick={() => setActiveActionMenu(activeActionMenu === q.id ? null : q.id)}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl transition-colors shadow-sm"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Menú Desplegable Inteligente */}
                            {activeActionMenu === q.id && (
                              <div className={`absolute right-12 ${idx > 0 && idx === filteredQuotes.length - 1 ? 'bottom-10' : 'top-10'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl w-48 py-2 z-[99] animate-in fade-in zoom-in-95`}>
                                <button onClick={() => { handleDownloadPDFForQuote(q); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors flex items-center gap-2">
                                  <Download className="w-3.5 h-3.5" /> Descargar PDF
                                </button>
                                <button onClick={() => { handleEditQuote(q); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Modificar</button>
                                <button onClick={() => { setCreatedQuoteToShare(q); setShowShareSuccessModal(true); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Enviar Cotización</button>
                                <button onClick={() => { setAcceptQuoteData(q); setShowAcceptModal(true); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">Cotización Aceptada</button>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-800"></div>
                                <button onClick={() => { handleDeleteQuote(q.id); setActiveActionMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">Eliminar</button>
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
        );
      })()}

      {/* MODAL: COMPARTIR COTIZACIÓN (WHATSAPP, CORREO O DESCARGAR PDF) */}
      {showShareSuccessModal && createdQuoteToShare && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setShowShareSuccessModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>

            <div className="text-center mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 ${createdQuoteToShare.isTest
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                }`}>
                {createdQuoteToShare.isTest ? <FlaskConical className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                {createdQuoteToShare.isTest ? `¡Cotización de Prueba Lista!` : `¡Cotización ${createdQuoteToShare.quoteNumber} Lista!`}
              </h3>
              {createdQuoteToShare.isTest && (
                <div className="mt-1">
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-700">
                    Modo Prueba • Correlativo No Alterado
                  </span>
                </div>
              )}
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                {createdQuoteToShare.client} • {formatMoney(createdQuoteToShare.finalPrice)}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => { handleShareQuote(createdQuoteToShare, 'whatsapp'); }}
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-black py-3.5 rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle className="w-5 h-5" /> Enviar por WhatsApp
              </button>

              <button
                onClick={() => { handleShareQuote(createdQuoteToShare, 'email'); }}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-black py-3.5 rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <Mail className="w-5 h-5 text-slate-500 dark:text-slate-400" /> Enviar por Correo
              </button>

              <button
                onClick={() => { handleDownloadPDFForQuote(createdQuoteToShare); }}
                className="w-full bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300 font-black py-3.5 rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-5 h-5" /> Descargar Archivo PDF
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setShowShareSuccessModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowShareSuccessModal(false);
                  setAcceptQuoteData(createdQuoteToShare);
                  setShowAcceptModal(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
              >
                Crear Traslado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURADOR DE CLIENTE Y EMPRESA */}
      {showClientConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowClientConfigModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                  Configuración Comercial
                </h3>
                <p className="text-[11px] font-bold text-slate-400">
                  RUT y datos corporativos para cotizaciones formales
                </p>
              </div>
            </div>

            {/* PESTAÑAS: EMPRESAS CLIENTES vs NUESTRA EMPRESA */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-4 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setClientConfigTab('client')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${clientConfigTab === 'client'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Empresa Cliente
              </button>

              <button
                type="button"
                onClick={() => setClientConfigTab('issuer')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${clientConfigTab === 'issuer'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Nuestra Empresa (Emisor)
              </button>
            </div>

            {/* FORMULARIO 1: EMPRESA CLIENTE */}
            {clientConfigTab === 'client' && (
              <form onSubmit={handleSaveClientConfig} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Seleccionar Empresa a Configurar
                  </label>
                  <select
                    value={selectedClientForEdit}
                    onChange={e => handleSelectClientToEdit(e.target.value)}
                    className="w-full mt-1 border-2 border-purple-200 dark:border-purple-900/60 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 bg-purple-50/20 dark:bg-slate-900"
                  >
                    <option value="NEW">+ Registrar Nueva Empresa Cliente...</option>
                    {customClients.map(c => (
                      <option key={c.id || c.name} value={c.id}>
                        {c.name} {c.rut ? `(RUT: ${c.rut})` : '(Sin RUT)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Razón Social / Nombre Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientForm.name}
                      onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                      placeholder="Ej: Kovacs SpA o Portillo Automotriz"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">
                      RUT de la Empresa
                    </label>
                    <input
                      type="text"
                      value={clientForm.rut}
                      onChange={e => setClientForm({ ...clientForm, rut: e.target.value.toUpperCase() })}
                      placeholder="Ej: 76.123.456-7"
                      className="w-full mt-1 border-2 border-purple-200 dark:border-purple-900/60 rounded-xl p-2.5 text-xs font-black text-purple-700 dark:text-purple-300 outline-none focus:border-purple-500 bg-purple-50/30 dark:bg-purple-950/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Giro Comercial
                    </label>
                    <input
                      type="text"
                      value={clientForm.giro}
                      onChange={e => setClientForm({ ...clientForm, giro: e.target.value })}
                      placeholder="Ej: Venta de vehículos y repuestos"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Dirección Comercial
                    </label>
                    <input
                      type="text"
                      value={clientForm.address}
                      onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
                      placeholder="Ej: Av. Américo Vespucio 1500"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Comuna / Ciudad
                    </label>
                    <input
                      type="text"
                      value={clientForm.city}
                      onChange={e => setClientForm({ ...clientForm, city: e.target.value })}
                      placeholder="Ej: Pudahuel, Santiago"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Nombre de Contacto / Atención
                    </label>
                    <input
                      type="text"
                      value={clientForm.contactName}
                      onChange={e => setClientForm({ ...clientForm, contactName: e.target.value })}
                      placeholder="Ej: Felipe Castro"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      value={clientForm.phone}
                      onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                      placeholder="Ej: +56 9 1234 5678"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Correo Electrónico de Facturación / Contacto
                    </label>
                    <input
                      type="email"
                      value={clientForm.email}
                      onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                      placeholder="Ej: adquisiciones@empresa.cl"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClientConfigModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none text-xs transition-colors"
                  >
                    Guardar Datos del Cliente
                  </button>
                </div>
              </form>
            )}

            {/* FORMULARIO 2: NUESTRA EMPRESA (EMISOR) */}
            {clientConfigTab === 'issuer' && (
              <form onSubmit={handleSaveIssuerConfig} className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-purple-50 dark:bg-purple-950/40 p-3 rounded-2xl border border-purple-200 dark:border-purple-800/50">
                  Estos datos se imprimirán en el <strong>membrete oficial de las cotizaciones</strong> para que tengan validez y presentación formal ante tus clientes.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Razón Social de Nuestra Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={issuerForm.companyName}
                      onChange={e => setIssuerForm({ ...issuerForm, companyName: e.target.value })}
                      placeholder="Ej: LogisticAPP Soluciones SpA"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">
                      RUT Emisor
                    </label>
                    <input
                      type="text"
                      value={issuerForm.rut}
                      onChange={e => setIssuerForm({ ...issuerForm, rut: e.target.value.toUpperCase() })}
                      placeholder="Ej: 77.842.190-3"
                      className="w-full mt-1 border-2 border-purple-200 dark:border-purple-900/60 rounded-xl p-2.5 text-xs font-black text-purple-700 dark:text-purple-300 outline-none focus:border-purple-500 bg-purple-50/30 dark:bg-purple-950/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Giro de Nuestra Empresa
                    </label>
                    <input
                      type="text"
                      value={issuerForm.giro}
                      onChange={e => setIssuerForm({ ...issuerForm, giro: e.target.value })}
                      placeholder="Ej: Transporte de Carga y Logística"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Dirección Casa Matriz / Ubicación
                    </label>
                    <input
                      type="text"
                      value={issuerForm.address}
                      onChange={e => setIssuerForm({ ...issuerForm, address: e.target.value })}
                      placeholder="Ej: Santiago, Región Metropolitana"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Teléfono Comercial
                    </label>
                    <input
                      type="text"
                      value={issuerForm.phone}
                      onChange={e => setIssuerForm({ ...issuerForm, phone: e.target.value })}
                      placeholder="Ej: +56 9 8765 4321"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={issuerForm.email}
                      onChange={e => setIssuerForm({ ...issuerForm, email: e.target.value })}
                      placeholder="Ej: contacto@logisticapp.cl"
                      className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClientConfigModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none text-xs transition-colors"
                  >
                    Guardar Datos de Emisor
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURACIÓN DE CORRELATIVO */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={handleSaveCorrelativeConfig} className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Configuración de Correlativo</h3>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-5">
              Personaliza el formato y el número de inicio para las próximas cotizaciones.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prefijo / Siglas</label>
                <input
                  type="text"
                  value={tempConfig.prefix}
                  onChange={e => setTempConfig({ ...tempConfig, prefix: e.target.value })}
                  placeholder="Ej: COT- o CTZ-"
                  className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                />
                <span className="text-[10px] text-slate-400 ml-1">Texto que aparece antes del número (ej: COT-, PROP-, CTZ-).</span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Próximo Número / Desde dónde iniciará</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={tempConfig.nextNumber}
                  onChange={e => setTempConfig({ ...tempConfig, nextNumber: e.target.value })}
                  placeholder="Ej: 1 o 1001"
                  className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-black text-purple-700 dark:text-purple-400 outline-none focus:border-purple-500 bg-white dark:bg-slate-900 font-mono"
                />
                <span className="text-[10px] text-slate-400 ml-1">El valor del contador a partir del cual se emitirá la siguiente cotización.</span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Formato de Ceros a la Izquierda</label>
                <select
                  value={tempConfig.minDigits}
                  onChange={e => setTempConfig({ ...tempConfig, minDigits: parseInt(e.target.value, 10) })}
                  className="w-full mt-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                >
                  <option value="0">Sin ceros a la izquierda (ej: 1, 2, 3...)</option>
                  <option value="3">3 Dígitos (ej: 001, 002...)</option>
                  <option value="4">4 Dígitos (ej: 0001, 0002...)</option>
                  <option value="5">5 Dígitos (ej: 00001, 00002...)</option>
                  <option value="6">6 Dígitos (ej: 000001, 000002...)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">Incluir Año Actual</p>
                  <p className="text-[10px] font-bold text-slate-400">Agrega el año en curso (ej: {new Date().getFullYear()})</p>
                </div>
                <input
                  type="checkbox"
                  checked={tempConfig.includeYear}
                  onChange={e => setTempConfig({ ...tempConfig, includeYear: e.target.checked })}
                  className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                />
              </div>

              {/* Caja de Vista Previa en Vivo */}
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-center">
                <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">
                  Vista Previa del Próximo Correlativo
                </p>
                <p className="text-2xl font-black text-purple-900 dark:text-purple-200 font-mono">
                  {formatCorrelativeNumber(tempConfig, parseInt(tempConfig.nextNumber, 10) || 1)}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none text-xs transition-colors"
              >
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NUEVO PEAJE */}
      {showNewTollModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={handleSaveNewToll} className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <button type="button" onClick={() => setShowNewTollModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-700 dark:text-slate-300" /></button>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-4">{editingTollId ? 'Modificar Peaje' : 'Registrar Nuevo Peaje'}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Nombre del Peaje / Plaza</label>
                <input type="text" required value={newTollData.name} onChange={e => setNewTollData({ ...newTollData, name: e.target.value })} placeholder="Ej: Peaje Angostura" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Ruta / Autopista</label>
                <div className="space-y-2">
                  <select
                    value={newTollData.route}
                    onChange={e => setNewTollData({ ...newTollData, route: e.target.value })}
                    className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value="Ruta 5 Norte">Ruta 5 Norte</option>
                    <option value="Ruta 5 Sur">Ruta 5 Sur</option>
                    <option value="Ruta 68">Ruta 68</option>
                    <option value="Ruta 78">Ruta 78</option>
                    <option value="Otra Ruta">Otra Ruta (Escribir manual)</option>
                  </select>
                  {newTollData.route === 'Otra Ruta' && (
                    <input
                      type="text"
                      value={newTollData.customRoute || ''}
                      onChange={e => setNewTollData({ ...newTollData, customRoute: e.target.value })}
                      placeholder="Escribe la ruta aquí..."
                      required
                      autoComplete="off" autoCorrect="off" spellCheck="false"
                      className="w-full mt-2 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 animate-in fade-in"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Kilómetro de la Ruta (KM)</label>
                <input type="number" required value={newTollData.km} onChange={e => setNewTollData({ ...newTollData, km: e.target.value })} placeholder="Ej: 30" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Tarifas por Tipo de Vehículo ($)</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {Object.keys(newTollData.prices).map(vType => (
                    <div key={vType} className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block truncate">{vType}</label>
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
                        className="w-full mt-1 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-xs font-black text-purple-700 dark:text-purple-400 outline-none focus:border-purple-500 bg-white dark:bg-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" className="w-full mt-5 bg-purple-600 hover:bg-purple-700 text-white font-black py-3 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none text-xs transition-colors">{editingTollId ? 'Actualizar Peaje' : 'Guardar Peaje'}</button>
          </form>
        </div>
      )}

      {/* MODAL: ACEPTAR COTIZACIÓN Y CREAR TRASLADO */}
      {showAcceptModal && acceptQuoteData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={handleConfirmAcceptQuote} className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <button type="button" onClick={() => setShowAcceptModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-700 dark:text-slate-300" /></button>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">¡Cotización Aceptada! 🎉</h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-5">Configura la fecha y el conductor para generar el traslado en el sistema.</p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Programada</label>
                <div className="relative mt-1">
                  <input type="date" required value={jobDetails.scheduledDate} onChange={e => setJobDetails({ ...jobDetails, scheduledDate: e.target.value })} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 bg-white dark:bg-slate-900" />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conductor Asignado (Opcional)</label>
                <div className="relative mt-1">
                  <select
                    value={jobDetails.assignedDriver}
                    onChange={e => setJobDetails({ ...jobDetails, assignedDriver: e.target.value })}
                    className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 bg-white dark:bg-slate-900"
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

            <button type="submit" className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none text-sm transition-colors flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" /> Generar Traslado
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
