import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { CheckCircle, Clock, FileDown, Navigation, MapPin, X, Search, LogOut, Sun, Moon, FileText, AlertCircle } from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';
import WaitTimerBadge from '../ui/WaitTimerBadge';
import SignaturePad from '../ui/SignaturePad';
import { formatDateDisplay } from '../../utils/helpers';

export default function TrackingView({ clientName, db, onBack, onLogout, darkMode, setDarkMode }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null); 
  const [clientLogo, setClientLogo] = useState(null); // NUEVO: Estado para el logo
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null); // <-- NUEVO: Estado para foto en pantalla completa
  const [selectedHistoryJob, setSelectedHistoryJob] = useState(null); // <-- NUEVO: Estado para Ficha Técnica interactiva
  
  // NUEVO: Atrapa el ID del trabajo desde la URL si viene desde el correo
  const [trackId, setTrackId] = useState(() => new URLSearchParams(window.location.search).get('track')); 
  
  // SOLUCIÓN AL ERROR 310: El estado de paginación DEBE ir siempre aquí arriba
  const [historyLimit, setHistoryLimit] = useState(30); 

  const [clientRecordId, setClientRecordId] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(''); // Extraemos el email 
  const [currentUserName, setCurrentUserName] = useState(''); // NUEVO: Extraemos el nombre

  // NUEVO: Helper para el saludo según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Buenos días';
    if (hour >= 12 && hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  useEffect(() => {
    if (clientName) {
      const fetchClientData = async () => {
         try {
           // ESCÁNER INTELIGENTE: Buscamos cualquier correo guardado en el navegador 
           // sin necesidad de saber el nombre exacto de la llave que usa App.jsx
           let possibleEmails = [];
           for (let i = 0; i < localStorage.length; i++) {
              const val = localStorage.getItem(localStorage.key(i));
              if (val && typeof val === 'string' && val.includes('@')) {
                 possibleEmails.push(val.trim().toLowerCase());
              }
           }

           const snap = await getDocs(collection(db, 'clients'));
           let foundClient = null;
           let targetEmail = '';

           for (const document of snap.docs) {
              const data = document.data();
              const emails = data.email ? data.email.split(',').map(e => e.trim().toLowerCase()) : [];
              
              const match = emails.find(e => possibleEmails.includes(e));
              if (match) {
                 targetEmail = match;
                 foundClient = { id: document.id, ...data, matchedIdx: emails.indexOf(match) };
                 break;
              }
              // Fallback por nombre de empresa
              if (!foundClient && data.name === clientName) {
                 foundClient = { id: document.id, ...data, matchedIdx: 0 };
              }
           }

           if (foundClient) {
             setClientRecordId(foundClient.id);
             setClientLogo(foundClient.logo || null);

             if (!targetEmail && foundClient.email) {
                targetEmail = foundClient.email.split(',')[foundClient.matchedIdx || 0].trim().toLowerCase();
             }
             
             setCurrentUserEmail(targetEmail);

             const rawNames = foundClient.contactName || foundClient.contactPerson || foundClient.contact || '';
             const names = rawNames ? rawNames.split(',').map(n => n.trim()) : [];
             let matchedName = names[foundClient.matchedIdx || 0] || names[0] || '';

             if (matchedName) setCurrentUserName(matchedName);
           }
         } catch(e) { console.error("Error al leer cliente", e); }
      };
      fetchClientData();
    }

    const q = query(collection(db, 'transport_jobs'), where('client', '==', clientName));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setJobs(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Error al leer traslados", err);
      setLoading(false);
    });
    return () => unsub();
  }, [clientName, db]);

const handleDownloadPDF = async (job) => {
    if (!job.checklist && job.status !== 'failed') return alert("Este traslado no tiene un checklist registrado.");
    try {
      setDownloadingId(job.id); 
      const { buildPDFDoc: masterPDFBuilder } = await import('../../utils/pdfGenerator');
      const docPDF = await masterPDFBuilder(job);

      const cleanPlate = job.plate || job.vin || 'SN';
      const dateStrForFile = (job.scheduledDate || new Date().toISOString().split('T')[0]).replace(/\//g, '-');
      const fileName = `Certificado.${dateStrForFile}.${(job.client || 'Cliente').replace(/[^\w\s-]/g, '')}.${cleanPlate}.pdf`; 
      docPDF.save(fileName); 
      setDownloadingId(null);
    } catch (error) {
      console.error("Error crítico generando PDF en Portal:", error);
      alert("Hubo un error al descargar el PDF. Verifica tu conexión a internet e intenta de nuevo.");
      setDownloadingId(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');  
  const [batchSignOpen, setBatchSignOpen] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ name: '', rut: '', comments: '', signature: null, selectedIds: [] });

  const branding = React.useMemo(() => {
    const name = (clientName || '').toUpperCase();
    if (name.includes('KOVACS')) return { primary: 'bg-red-600', text: 'text-red-600 dark:text-red-400', fill: 'bg-red-500', light: 'bg-red-50 dark:bg-red-900/30' };
    if (name.includes('SALFA')) return { primary: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400', fill: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-900/30' };
    if (name.includes('GRANDLEASING')) return { primary: 'bg-slate-900', text: 'text-slate-800 dark:text-slate-200', fill: 'bg-slate-800', light: 'bg-slate-100 dark:bg-slate-800' };
    if (name.includes('ENEX')) return { primary: 'bg-sky-600', text: 'text-sky-600', fill: 'bg-sky-500', light: 'bg-sky-50' };
    return { primary: 'bg-blue-600', text: 'text-blue-600 dark:text-blue-400', fill: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/30' };
  }, [clientName]);

  // NUEVO: Diccionario histórico (Puesto en un lugar seguro, antes de los retornos)
  const latestVehiclePhotos = React.useMemo(() => {
     const photoMap = {};
     const sortedAll = [...jobs].sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
     sortedAll.forEach(j => {
        const ident = j.plate || j.vin || j.associatedPlate;
        if (ident && ident !== 'S/N' && !photoMap[ident]) {
           if (j.checklist?.photos?.front) {
              photoMap[ident] = j.checklist.photos.front;
           }
        }
     });
     return photoMap;
  }, [jobs]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 pt-24 space-y-6 max-w-5xl mx-auto">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 max-w-2xl mx-auto h-32 flex flex-col items-center justify-center animate-pulse shadow-sm">
         <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl mb-3"></div>
         <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
         <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 h-48 animate-pulse shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div><div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div></div>
            <div className="space-y-3"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div></div>
          </div>
        ))}
      </div>
    </div>
  );

  const filteredJobs = jobs.filter(j => {
    if (trackId && j.id !== trackId) return false;
    
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (j.plate || '').toLowerCase().includes(term) || 
           (j.brand || '').toLowerCase().includes(term) || 
           (j.model || '').toLowerCase().includes(term);
  });

  const activeJobs = filteredJobs.filter(j => j.status === 'pending' || j.status === 'accepted');
  const allHistoryJobs = filteredJobs.filter(j => j.status === 'completed' || j.status === 'failed');
  const historyJobs = allHistoryJobs.slice(0, historyLimit);
  
  const pendingSignatureJobs = activeJobs.filter(j => j.checklist && !j.checklist.clientSigned);
  
  const initials = clientName ? clientName.substring(0, 2).toUpperCase() : 'CL';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans pb-10 transition-colors duration-300">
      
      <header className={`fixed-nav-bar ${branding.primary} text-white p-4 shadow-lg flex justify-between items-center h-16 sm:h-20 transition-colors duration-300`}>
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="bg-white dark:bg-slate-900 p-1 sm:p-1.5 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo App" className="w-7 h-7 sm:w-12 sm:h-12 object-contain" />
          </div>
          
          <h1 className="font-alfa text-lg sm:text-3xl tracking-wide shrink-0 text-white" style={{ paddingTop: '2px' }}>
            LogisticAPP
          </h1>
          
          <div className="bg-white dark:bg-slate-900 rounded-xl backdrop-blur-sm flex items-center justify-center shrink-0 ml-0.5 sm:ml-1 overflow-hidden">
            <img src="/LogoLogistica.png" alt="Logística TS SpA" className="h-8 sm:h-15 object-contain" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {setDarkMode && (
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-white dark:bg-slate-900 hover:bg-white dark:bg-slate-900 rounded-xl transition-colors shadow-sm border border-white dark:border-slate-800/10">
              {darkMode ? <Sun className="w-5 h-5 text-yellow-300"/> : <Moon className="w-5 h-5 text-white"/>}
            </button>
          )}

          {onBack && (
            <button onClick={onBack} className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl text-sm font-bold text-white transition-colors border border-red-400 shadow-sm flex items-center gap-1.5 z-10 shrink-0 ml-2">
              <LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Volver</span>
            </button>
          )}
          {onLogout && (
            <button onClick={onLogout} className="bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-xl text-sm font-bold text-white transition-colors border border-slate-700 shadow-sm flex items-center gap-1.5 z-10 shrink-0 ml-2">
              <LogOut className="w-4 h-4"/> <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 space-y-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden max-w-2xl mx-auto">
          <div className={`absolute top-0 left-0 w-full h-1.5 ${branding.fill}`}></div>
          
          <div className="mx-auto w-36 h-36 rounded-[28px] flex items-center justify-center mb-4 shadow-md border overflow-hidden transition-all duration-300 p-3" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
             <img
               src={
                 clientLogo || ( // NUEVO: Prioriza el logo de Firebase si existe
                   (clientName || '').toUpperCase().includes('KOVACS') ? '/logos/kovacs.png' :
                   (clientName || '').toUpperCase().includes('SALFA') ? '/logos/salfa.png' :
                   (clientName || '').toUpperCase().includes('GRANDLEASING') ? '/logos/grandleasing.png' :
                   (clientName || '').toUpperCase().includes('ENEX') ? '/logos/enex.png' :
                   `/logos/${clientName ? clientName.toLowerCase().replace(/[^a-z0-9]/g, '') : ''}.png`
                 )
               }
               alt={clientName}
               className="w-full h-full object-contain"
               onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
             />
             <div className={`w-full h-full flex items-center justify-center text-5xl font-black ${branding.text} ${branding.light} rounded-2xl`} style={{ display: 'none' }}>
               {initials}
             </div>
          </div>

          {/* NUEVO: Saludo dinámico con el nombre del usuario logueado */}
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-0.5">
            {getGreeting()}{currentUserName ? `, ${currentUserName.split(' ')[0]}` : ''}
          </p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">{clientName}</p>
        </div>

           {/* NUEVO: BANNER DE VISTA FILTRADA */}
           {trackId && (
             <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800/50 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in max-w-2xl mx-auto">
                <div>
                  <p className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest text-left">Vista Filtrada</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 text-left">Mostrando solo el vehículo de la notificación.</p>
                </div>
                <button onClick={() => {
                   setTrackId(null);
                   window.history.replaceState({}, '', `${window.location.pathname}?client=${encodeURIComponent(clientName)}`);
                }} className="w-full sm:w-auto bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:bg-blue-900/40 px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-colors whitespace-nowrap">
                   Ver toda mi flota
                </button>
             </div>
           )}

           {/* OCULTA EL BUSCADOR SI HAY UN FILTRO ACTIVO */}
           {!trackId && (
             <div className="relative max-w-2xl mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <input type="text" placeholder="Buscar por patente, marca o modelo..." className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 shadow-sm transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
           )}

           {pendingSignatureJobs.length > 0 && (
          <div className="bg-blue-600 rounded-3xl p-5 shadow-xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in duration-300 border-4 border-blue-400 max-w-2xl mx-auto">
             <div>
               <h3 className="font-black text-xl flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-300"/> ¡Acción Requerida!</h3>
               <p className="font-bold text-blue-100 text-sm mt-1">Tienes {pendingSignatureJobs.length} vehículo(s) esperando tu firma de recepción.</p>
             </div>
             <button onClick={() => {
                setBatchFormData({ name: '', rut: '', comments: '', signature: null, selectedIds: pendingSignatureJobs.map(j => j.id) });
                setBatchSignOpen(true);
             }} className="w-full sm:w-auto bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 px-6 py-3 rounded-xl font-black shadow-md transition-colors whitespace-nowrap">
               Firmar Lote Completo
             </button>
          </div>
        )}

        <div>
          <h3 className="font-extrabold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-600 dark:text-blue-400"/> Vehículos en Tránsito ({activeJobs.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeJobs.length === 0 ? (
               <p className="text-sm font-bold text-slate-400 bg-white dark:bg-slate-900 p-4 rounded-2xl border text-center col-span-full">No se encontraron traslados activos.</p>
            ) : activeJobs.map(job => {
              const isPending = job.status === 'pending';
              const isAccepted = job.status === 'accepted';
              const phase = job.phase || 'claimed'; 
              
              const step2Done = isAccepted && ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
              const step3Done = isAccepted && ['arrived_destination', 'arrived_prt', 'prt_done'].includes(phase);
              const step4Done = isAccepted && phase === 'prt_done';

              const getRtFinalDestination = (j) => {
                if (j.checklist?.rtReturnOption === 'other' && j.checklist?.rtReturnDestination) return j.checklist.rtReturnDestination;
                if (j.checklist?.rtReturnOption === 'origin') return j.origin;
                if (j.destination && !j.destination.toLowerCase().includes('planta prt')) return j.destination;
                if (j.destName && !j.destName.toLowerCase().includes('planta prt')) return j.destName;
                return j.origin || 'Por definir';
              };

              return (
              <div key={job.id} className="bg-white dark:bg-slate-900 w-full max-w-[calc(100vw-2rem)] sm:max-w-none p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isPending ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
                <div className="flex justify-between items-start mb-3 gap-3">
                  {/* NUEVO: Miniatura con inteligencia histórica */}
                  {(() => {
                     const ident = job.plate || job.vin || job.associatedPlate;
                     const displayPhoto = job.checklist?.photos?.front || job.draft?.formData?.photos?.front || latestVehiclePhotos[ident];
                     if (!displayPhoto) return null;
                     return (
                        <img 
                           src={displayPhoto} 
                           alt="Frente" 
                           onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(displayPhoto); }}
                           className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                        />
                     );
                  })()}
                  <div className="flex-1 min-w-0 pr-2">
                    <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 flex-wrap">
                      {job.tripType === 'simple' ? 'Servicio en Terreno' : 'En Traslado'}
                      {(job.checklist?.transitNotes || job.draft?.formData?.transitNotes) && (
                        <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-2.5 h-2.5"/> NOTA EN RUTA
                        </span>
                      )}
                    </h2>
                    <p className="text-xl font-black text-slate-800 dark:text-slate-200 leading-tight truncate">
                      {job.tripType === 'simple' ? (job.description || 'Servicio') : `${job.brand} ${job.model}`}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <LicensePlateBadge text={job.plate || job.vin} />
                  </div>
                </div>

                <div className="mb-4 mt-3 relative z-10 flex flex-col gap-1.5">
                  {/* ORIGEN */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 z-10">
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                      {job.tripType === 'simple' ? 'Lugar' : 'Desde'}
                    </span>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-snug break-words">{job.origin || 'Por definir'}</p>
                  </div>

                  {(job.destination || job.tripType !== 'simple') && (
                    <>
                      {/* ICONO CENTRAL O 1ra PARADA PRT */}
                      <div className="flex justify-center -my-2.5 z-20">
                        {job.tripType === 'revision' ? (
                           <div className="bg-amber-100 dark:bg-amber-900/40 px-3 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-sm text-center">
                             <p className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase">1ra Parada: PRT</p>
                           </div>
                        ) : job.waypoints && job.waypoints.length > 0 ? (
                           <div className="bg-amber-100 dark:bg-amber-900/40 px-3 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-sm text-center">
                             <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">{job.waypoints.length} paradas</p>
                           </div>
                        ) : (
                          <div className="bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-300 shadow-sm">
                            <Navigation className="w-3 h-3 rotate-180" />
                          </div>
                        )}
                      </div>

                      {/* DESTINO */}
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2PX_10px_rgba(0,0,0,0.04)] z-10">
                        <span className="flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          Hasta
                        </span>
                        <p className="text-sm font-extrabold text-blue-700 dark:text-blue-400 leading-snug break-words">
                          {job.tripType === 'revision' ? getRtFinalDestination(job) : (job.destination || 'Por definir')}
                        </p>
                      </div>
                    </>
                  )}
                  
                  {job.waypoints && job.waypoints.length > 0 && (
                    <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3"/> Ruta intermedia:</p>
                      <div className="flex flex-col gap-1">
                        {job.waypoints.map((wp, i) => (
                           <span key={i} className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-snug break-words"><span className="font-black mr-1 text-slate-400">{i + 1}.</span> {wp}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="relative pl-8 space-y-6 mt-2 mb-4">
                  <div className="absolute top-2 bottom-4 left-[11px] w-0.5 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                  <div className="absolute top-2 left-[11px] w-0.5 bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                       style={{ height: step4Done ? '100%' : step3Done ? '66%' : step2Done ? '33%' : isAccepted ? '10%' : '0%' }}></div>

                  <div className="relative"><div className="absolute -left-8 bg-blue-500 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 shadow-sm flex items-center justify-center z-10 transition-transform duration-300 hover:scale-110"><CheckCircle className="w-3 h-3 text-white"/></div><p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{isAccepted ? (job.assignedDrivers?.find(d => d.email === job.acceptedByEmail)?.name || "Conductor en camino") : "Buscando conductor..."}</p><p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{isAccepted ? `Responsable del retiro en ${job.origin}` : `Esperando asignación para ${job.origin}`}</p></div>
                  
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step2Done ? 'bg-blue-500 scale-110' : (phase === 'arrived_pickup' ? 'bg-amber-400 scale-110' : 'bg-slate-200 dark:bg-slate-700')}`}>{step2Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step2Done ? 'text-slate-800 dark:text-slate-200' : (phase === 'arrived_pickup' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}`}>{phase === 'arrived_pickup' ? 'Esperando entrega en origen...' : 'Vehículo en Tránsito'}</p><p className={`text-xs font-bold mt-0.5 transition-colors duration-500 ${step2Done ? 'text-blue-600 dark:text-blue-400' : (phase === 'arrived_pickup' ? 'text-amber-500' : 'text-slate-400')}`}>{step2Done ? 'El conductor tiene el vehículo en su poder' : (phase === 'arrived_pickup' ? 'El conductor ya está en el punto de retiro' : 'Esperando llegada del conductor')}</p></div>
                  
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step3Done ? 'bg-blue-500 scale-110' : 'bg-slate-200 dark:bg-slate-700'}`}>{step3Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step3Done ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{job.tripType === 'revision' ? 'En Planta de Revisión' : 'Llegada a Destino'}</p><p className={`text-xs font-bold mt-0.5 transition-colors duration-500 ${step3Done ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>{step3Done ? (job.tripType === 'revision' ? 'Realizando inspección técnica' : 'En proceso de entrega y checklist') : `Hacia ${job.tripType === 'revision' ? 'PRT' : job.destination}`}</p></div>
                  
                  {job.tripType === 'revision' && (
                  <div className="relative"><div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 shadow-sm flex items-center justify-center z-10 transition-all duration-500 ${step4Done ? (job.prt_result === 'rechazado' ? 'bg-red-500 scale-110' : 'bg-green-500 scale-110') : 'bg-slate-200 dark:bg-slate-700'}`}>{step4Done && <CheckCircle className="w-3 h-3 text-white animate-in zoom-in"/>}</div><p className={`font-extrabold text-sm transition-colors duration-500 ${step4Done ? (job.prt_result === 'rechazado' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-slate-400'}`}>Resultado de Revisión</p>{step4Done ? (<p className={`text-xs font-bold mt-0.5 ${job.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{job.prt_result === 'rechazado' ? `Rechazado: ${job.prt_reason}` : 'Aprobado Exitosamente'}</p>) : (<p className="text-xs font-bold text-slate-400 mt-0.5">Esperando documento de la planta</p>)}</div>
                  )}

                  {job.tripType === 'revision' && step4Done && (job.prt_result === 'aprobado' || job.prt_result === 'aprobado_ayuda') && (
                  <div className="relative pt-2"><div className="absolute -left-8 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 shadow-sm flex items-center justify-center z-10 bg-blue-500 scale-110"><Navigation className="w-3 h-3 text-white"/></div><p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Camino a destino</p><p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">{job.checklist?.rtReturnOption === 'other' ? job.checklist?.rtReturnDestination : job.origin}</p></div>
                  )}
                </div>

                {job.phase === 'arrived_pickup' && job.arrivedPickupAt && <WaitTimerBadge arrivedAt={job.arrivedPickupAt} role="client" />}

                {job.liveLocation && job.phase === 'picked_up' && (
                  <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1.5"><Navigation className="w-4 h-4 animate-bounce"/> GPS en vivo</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Conectado</p>
                    </div>
                    <div className="w-full h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-inner relative pointer-events-none">
                      <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        src={`https://maps.google.com/maps?q=${job.liveLocation.lat},${job.liveLocation.lng}&z=15&output=embed`}
                      ></iframe>
                    </div>
                  </div>
                )}

              </div>
            )})}
          </div>
        </div>

        <div>
          <h3 className="font-extrabold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400"/> Últimos Finalizados</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyJobs.length === 0 ? (
               <p className="text-sm font-bold text-slate-400 bg-white dark:bg-slate-900 p-4 rounded-2xl border text-center col-span-full">No se encontraron resultados.</p>
            ) : historyJobs.map(job => {
              const isFailed = job.status === 'failed';
              return (
              <div key={job.id} onClick={() => setSelectedHistoryJob(job)} className="bg-white dark:bg-slate-900 w-full max-w-[calc(100vw-2rem)] sm:max-w-none p-3.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between relative pl-4 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                <div className={`absolute top-0 left-0 bottom-0 w-2 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
                
                <div className="flex justify-between items-center mb-2 gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                     {/* NUEVO: Miniatura con inteligencia histórica */}
                     {(() => {
                         const ident = job.plate || job.vin || job.associatedPlate;
                         const displayPhoto = job.checklist?.photos?.front || latestVehiclePhotos[ident];
                         if (!displayPhoto) return null;
                         return (
                            <img 
                               src={displayPhoto} 
                               alt="Frente" 
                               onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(displayPhoto); }}
                               className="w-10 h-10 rounded-md object-cover border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                            />
                         );
                     })()}
                     <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight truncate">{job.brand} {job.model}</p>
                        {job.checklist?.transitNotes && (
                          <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 mt-1 w-max">
                            <AlertCircle className="w-2.5 h-2.5"/> NOTA EN RUTA
                          </span>
                        )}
                     </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <LicensePlateBadge text={job.plate || job.vin} />
                  </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2 mb-3 mt-1 shadow-inner relative z-10">
                  <div className="text-[10px] font-black flex items-center justify-between gap-1">
                    <span className="truncate text-slate-700 dark:text-slate-300 max-w-[45%]" title={job.origin}>
                       <MapPin className="inline w-3 h-3 mr-0.5 -mt-0.5 text-slate-400 shrink-0"/>
                       {job.origin || '-'}
                    </span>
                    <span className="text-slate-300 font-black shrink-0">➔</span>
                    <span className="truncate text-blue-600 dark:text-blue-400 max-w-[45%] text-right" title={job.destination}>
                       {job.tripType === 'revision' ? 'PRT' : (job.destination || '-')}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-auto pt-2 border-t border-slate-50">
                  <div>
                    <p className={`text-[11px] font-black uppercase ${isFailed ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                      {isFailed ? 'RECHAZADO' : 'ENTREGADO'}
                    </p>
                    <p className="text-slate-400 text-[9px] font-bold mt-0.5">{new Date(job.completedAt || job.createdAt).toLocaleDateString('es-CL')}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {job.checklist && (job.checklist.scandocPdf || job.checklist.scandocPdfInbox || job.checklist.scannerLink) && (
                      <a href={job.checklist.scandocPdf || job.checklist.scandocPdfInbox || job.checklist.scannerLink} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="flex items-center justify-center p-2.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:bg-indigo-900/40 rounded-xl transition-colors border border-indigo-100 dark:border-indigo-800/50 relative" title="Ver Documentación PRT">
                        <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[7px] font-black px-1 py-0.5 rounded shadow-sm">PRT</span>
                        <FileText className="w-4 h-4"/>
                      </a>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(job); }} disabled={downloadingId === job.id} className="flex items-center justify-center p-2.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:bg-blue-900/40 rounded-xl transition-colors border border-blue-100 dark:border-blue-800/50 disabled:opacity-50" title="Descargar PDF">
                      {downloadingId === job.id ? <Clock className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>
              </div>
            )})}
          </div>

          {/* nuevo: botón de cargar más historiales */}
          {allHistoryJobs.length > historyLimit && (
            <div className="mt-8 text-center pb-8 animate-in fade-in duration-300">
              <button 
                onClick={() => setHistoryLimit(prev => prev + 30)}
                className="bg-white dark:bg-slate-900 border-2 border-blue-100 dark:border-blue-800/50 hover:border-blue-300 dark:border-blue-700/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 px-8 py-3 rounded-2xl font-black shadow-sm transition-all flex items-center justify-center gap-2 mx-auto"
              >
                cargar traslados anteriores <FileDown className="w-5 h-5"/>
              </button>
              <p className="text-xs font-bold text-slate-400 mt-3">mostrando {historyJobs.length} de {allHistoryJobs.length} traslados históricos</p>
            </div>
          )}

        </div>
      </main>

      {batchSignOpen && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center z-[200] p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-[420px] max-h-[92vh] flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95">
            
            {/* CABECERA FLOTANTE */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Firma de Recepción</h2>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Selecciona los vehículos a recepcionar</p>
              </div>
              <button onClick={() => setBatchSignOpen(false)} className="bg-white dark:bg-slate-900 hover:bg-slate-200 dark:bg-slate-700 p-2.5 rounded-full transition-colors shadow-sm border border-slate-200 dark:border-slate-700"><X className="w-5 h-5 text-slate-700 dark:text-slate-300"/></button>
            </div>

            {/* CUERPO CON SCROLL INTERNO */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* LISTA DE VEHÍCULOS (Más compacta) */}
              <div className="space-y-2.5 border-b border-slate-100 dark:border-slate-800 pb-5">
                 {pendingSignatureJobs.map(j => (
                   <label key={j.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${batchFormData.selectedIds.includes(j.id) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-sm' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:border-slate-600'}`}>
                      <input type="checkbox" checked={batchFormData.selectedIds.includes(j.id)} onChange={(e) => {
                         const ids = e.target.checked ? [...batchFormData.selectedIds, j.id] : batchFormData.selectedIds.filter(id => id !== j.id);
                         setBatchFormData({...batchFormData, selectedIds: ids});
                      }} className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"/>
                      <div className="flex-1">
                         <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200 leading-tight truncate">{j.brand} {j.model}</p>
                         <p className="font-bold text-[11px] text-blue-600 dark:text-blue-400 uppercase mt-0.5 tracking-wider">{j.plate || j.vin}</p>
                      </div>
                   </label>
                 ))}
              </div>

              {/* FORMULARIO CON MÁS AIRE */}
              <form id="batch-sign-form" onSubmit={async (e) => {
                 e.preventDefault();
                 if (batchFormData.selectedIds.length === 0) return alert("Debes seleccionar al menos un vehículo.");
                 if (!batchFormData.signature) return alert("Por favor, dibuja tu firma en el recuadro blanco.");
                 
                 try {
                    await Promise.all(batchFormData.selectedIds.map(async (id) => {
                       const jobToUpdate = jobs.find(x => x.id === id);
                       if (!jobToUpdate) return;
                       const updatedChecklist = {
                          ...jobToUpdate.checklist,
                          clientSigned: true,
                          receiverName: batchFormData.name,
                          receiverRut: batchFormData.rut,
                          clientComments: batchFormData.comments,
                          signatureData: batchFormData.signature
                       };
                       await updateDoc(doc(db, 'transport_jobs', id), { checklist: updatedChecklist });
                    }));
                    setBatchSignOpen(false);
                    alert("¡Recepción masiva exitosa! Los conductores ya han sido notificados para cerrar el traslado.");
                 } catch (error) {
                    console.error(error);
                    alert("Error guardando la firma.");
                 }
              }} className="space-y-4">
                 
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nombre Receptor</label>
                    <input required type="text" placeholder="¿Quién recibe?" value={batchFormData.name} onChange={e=>setBatchFormData({...batchFormData, name: e.target.value})} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 text-sm transition-colors bg-white dark:bg-slate-900 shadow-sm" />
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">RUT Receptor</label>
                    <input required type="text" placeholder="Ej: 12.345.678-9" maxLength="12" value={batchFormData.rut} onChange={(e)=>{ let val = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase(); if (val.length > 1) { const dv = val.slice(-1); const body = val.slice(0, -1); val = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv; } setBatchFormData({...batchFormData, rut: val}); }} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 text-sm transition-colors bg-white dark:bg-slate-900 shadow-sm" />
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Observaciones del Lote</label>
                    <textarea placeholder="Comentarios generales (Opcional)" value={batchFormData.comments} onChange={e=>setBatchFormData({...batchFormData, comments: e.target.value})} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 h-20 text-sm resize-none transition-colors bg-white dark:bg-slate-900 shadow-sm" />
                 </div>
                 
                 <div className="pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1 block">Firma Digital</label>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Aplica para todos</span>
                    </div>
                    <div className="rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700">
                      <SignaturePad initialData={batchFormData.signature} onSave={d=>setBatchFormData({...batchFormData, signature: d})} onClear={()=>setBatchFormData({...batchFormData, signature: null})} />
                    </div>
                 </div>
              </form>
            </div>
            
            {/* PIE DE PÁGINA (Botón Independiente) */}
            <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <button type="submit" form="batch-sign-form" className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black py-4 rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.3)] transition-all text-[15px] flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5"/> Confirmar Lote ({batchFormData.selectedIds.length})
              </button>
            </div>

          </div>
        </div>
      )}

      {/* NUEVO MODAL: VISOR DE FOTO PANTALLA COMPLETA */}
      {fullScreenPhoto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[999] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setFullScreenPhoto(null)}>
           <div className="absolute top-4 right-4 flex gap-3 z-[1000]">
             <button 
               onClick={async (e) => {
                 e.stopPropagation();
                 try {
                   const res = await fetch(fullScreenPhoto);
                   const blob = await res.blob();
                   const url = window.URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `evidencia_${Date.now()}.jpg`;
                   document.body.appendChild(a);
                   a.click();
                   window.URL.revokeObjectURL(url);
                   document.body.removeChild(a);
                 } catch (err) {
                   // Plan B por si el navegador bloquea la descarga directa
                   window.open(fullScreenPhoto, '_blank');
                 }
               }} 
               className="bg-white dark:bg-slate-900 p-2 rounded-full hover:bg-white dark:bg-slate-900 transition-colors shadow-lg backdrop-blur-md flex items-center justify-center"
               title="Descargar Imagen"
             >
               <FileDown className="w-6 h-6 text-white"/>
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(null); }} 
               className="bg-white dark:bg-slate-900 p-2 rounded-full hover:bg-white dark:bg-slate-900 transition-colors shadow-lg backdrop-blur-md flex items-center justify-center" 
               title="Cerrar"
             >
                <X className="w-6 h-6 text-white"/>
             </button>
           </div>
           <img src={fullScreenPhoto} alt="Ampliación" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-default" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* NUEVO MODAL: FICHA TÉCNICA DE HISTORIAL */}
      {selectedHistoryJob && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 cursor-default">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex justify-between items-start shrink-0 relative">
              <div className="flex gap-3 items-center">
                <div className="bg-blue-100 dark:bg-blue-900/40 p-2.5 rounded-xl"><FileText className="w-6 h-6 text-blue-600 dark:text-blue-400"/></div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 leading-tight">Ficha Técnica</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {new Date(selectedHistoryJob.completedAt || selectedHistoryJob.createdAt).toLocaleString('es-CL')}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedHistoryJob(null)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-100 dark:bg-slate-800 transition-colors">
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400"/>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              
              {/* 1. INFO VEHÍCULO */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">1. Información del Vehículo</h4>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Marca / Modelo</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedHistoryJob.tripType === 'simple' ? selectedHistoryJob.description : `${selectedHistoryJob.brand} ${selectedHistoryJob.model}`}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Identificador</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {selectedHistoryJob.plate || selectedHistoryJob.vin || selectedHistoryJob.associatedPlate || 'S/N'} 
                      {selectedHistoryJob.vin && selectedHistoryJob.vin !== selectedHistoryJob.plate ? ` (VIN: ${selectedHistoryJob.vin})` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Cliente</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedHistoryJob.client || 'Sin Cliente'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Conductor</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedHistoryJob.checklist?.assignedDriverName || selectedHistoryJob.assignedDrivers?.find(d => d.email === selectedHistoryJob.acceptedByEmail)?.name || selectedHistoryJob.acceptedByEmail || 'No registrado'}</p>
                  </div>
                </div>
              </div>

              {/* 2. VIAJE Y KILOMETRAJE */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">2. Ruta y Kilometraje</h4>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"/>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 break-words">
                        {selectedHistoryJob.origin || '-'} ➔ {selectedHistoryJob.waypoints?.length ? `(+${selectedHistoryJob.waypoints.length} int) ➔ ` : ''}{selectedHistoryJob.tripType === 'revision' ? (selectedHistoryJob.checklist?.rtReturnOption === 'other' ? selectedHistoryJob.checklist.rtReturnDestination : selectedHistoryJob.origin) : (selectedHistoryJob.destination || '-')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Odómetro Reportado</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedHistoryJob.checklist?.mileage || 'No registrado'}</p>
                    </div>
                    {selectedHistoryJob.checklist?.keyLocation && (
                    <div className="col-span-2">
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Ubicación de Llaves</p>
                      <p className="text-sm font-black text-orange-600 dark:text-orange-400">
                         {selectedHistoryJob.checklist.keyLocation === 'puestas' ? 'Puestas' : 
                          selectedHistoryJob.checklist.keyLocation === 'puerta' ? 'En la puerta' :
                          selectedHistoryJob.checklist.keyLocation === 'mano' ? `Entregadas por mano a: ${selectedHistoryJob.checklist.keyHandedTo || ''}` : selectedHistoryJob.checklist.keyLocation}
                      </p>
                    </div>
                    )}
                    <div className="col-span-2 mt-2">
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Distancia GPS (Maps)</p>
                      <p className="text-sm font-black text-blue-600 dark:text-blue-400">{selectedHistoryJob.drivenDistance || 'No calculado'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. FECHAS VENCIMIENTO DOCUMENTOS */}
              {(() => {
                 const vDocs = selectedHistoryJob.checklist?.docsExpiry;
                 if (!vDocs) return null;

                 const formatExp = (dateStr) => {
                    if (!dateStr) return <span className="text-slate-400 text-xs">No reg.</span>;
                    const [y,m,d] = dateStr.split('-');
                    const expDate = new Date(y, m-1, d);
                    const today = new Date(); today.setHours(0,0,0,0);
                    if (expDate < today) return <span className="text-red-600 dark:text-red-400 font-bold text-xs">{d}/{m}/{y} (Vencido)</span>;
                    return <span className="text-green-700 dark:text-green-400 font-bold text-xs">{d}/{m}/{y}</span>;
                 };

                 return (
                   <div>
                     <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">3. Vencimiento Documentos</h4>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                       <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Rev. Técnica</p>{formatExp(vDocs.revTecnica)}</div>
                       <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Gases</p>{formatExp(vDocs.gases)}</div>
                       <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Permiso Circ.</p>{formatExp(vDocs.permiso)}</div>
                       <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">SOAP</p>{formatExp(vDocs.soap)}</div>
                     </div>
                   </div>
                 );
              })()}

              {/* NOTAS DE TRASLADO EN FICHA */}
              {selectedHistoryJob.checklist?.transitNotes && (
                <div className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-200 dark:border-orange-800/50 p-4 rounded-xl shadow-sm mb-4">
                  <h4 className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-widest mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> Notas durante el traslado</h4>
                  <p className="text-xs font-bold text-orange-800 dark:text-orange-300 italic">"{selectedHistoryJob.checklist.transitNotes}"</p>
                </div>
              )}

              {/* 4. RECEPCIÓN */}
              {selectedHistoryJob.checklist && (
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">4. Recepción</h4>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="flex-1 text-center sm:text-left w-full">
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Recibido por</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedHistoryJob.checklist.noReception ? 'Sin Recepción Formal' : (selectedHistoryJob.checklist.receiverName || selectedHistoryJob.receiverName || 'No registrado')}</p>
                      {(selectedHistoryJob.checklist.receiverRut || selectedHistoryJob.receiverRut) && <p className="text-xs font-bold text-slate-500 dark:text-slate-400">RUT: {selectedHistoryJob.checklist.receiverRut || selectedHistoryJob.receiverRut}</p>}
                      
                      {(selectedHistoryJob.checklist.clientComments || selectedHistoryJob.clientComments) && (
                         <div className="mt-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                           <p className="text-[9px] font-bold text-slate-400 uppercase">Comentarios</p>
                           <p className="text-xs font-bold text-slate-700 dark:text-slate-300 italic">"{(selectedHistoryJob.checklist.clientComments || selectedHistoryJob.clientComments)}"</p>
                         </div>
                      )}
                    </div>
                    
                    {!selectedHistoryJob.checklist.noReception && (
                      <div className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 shrink-0 flex flex-col items-center justify-center min-w-[140px] min-h-[80px] w-full sm:w-auto shadow-inner" style={{ backgroundColor: '#ffffff' }}>
                        {(selectedHistoryJob.checklist.signatureData || selectedHistoryJob.signatureData) ? (
                          <img src={selectedHistoryJob.checklist.signatureData || selectedHistoryJob.signatureData} alt="Firma" className="h-16 sm:h-20 object-contain drop-shadow-sm" />
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Firma no registrada</span>
                        )}
                        <p className="text-[8px] font-black uppercase mt-1 tracking-widest" style={{ color: '#cbd5e1' }}>Firma Digital</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. GALERÍA DE FOTOS */}
              {selectedHistoryJob.checklist?.photos && Object.values(selectedHistoryJob.checklist.photos).filter(p => typeof p === 'string' && p.startsWith('http')).length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">5. Galería Fotográfica</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(selectedHistoryJob.checklist.photos).filter(([k,v]) => typeof v === 'string' && v.startsWith('http')).map(([k,v]) => (
                      <div key={k} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square cursor-pointer" onClick={() => setFullScreenPhoto(v)}>
                        <img src={v} alt={k} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-[9px] font-black uppercase truncate">{k.replace('det', 'Detalle ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}