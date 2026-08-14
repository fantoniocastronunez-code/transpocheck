import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { Camera, Eye, EyeOff, User, Edit2, Trash2, Truck, Clock, X, Plus, BookOpen, Phone, CheckCircle, MapPin, AlertCircle, Activity, Video, Wallet, Search, Ticket } from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';
import { LICENCIAS, resizeImage } from '../../utils/helpers';

export default function ConfiView({ currentUserEmail, allClientsList, customClients, vehicles, drivers, db, showAlert, showConfirm }) {
  const [configSubTab, setConfigSubTab] = useState('clients');
  const [editingDir, setEditingDir] = useState(null); 
  const [directoryList, setDirectoryList] = useState([]); 
  const [tollsList, setTollsList] = useState([]); // NUEVO: Estado para peajes
  const [editingToll, setEditingToll] = useState(null); // NUEVO: Estado para editar peaje

  const [dirSearchTerm, setDirSearchTerm] = useState(''); // NUEVO: Buscador de Directorio
  
  // NUEVO: Filtrado inteligente en tiempo real para el Directorio
  const filteredDirectoryList = directoryList.filter(d => {
    if (!dirSearchTerm) return true;
    const term = dirSearchTerm.toLowerCase();
    return (d.placeName || '').toLowerCase().includes(term) ||
           (d.address || '').toLowerCase().includes(term) ||
           (d.plusCode || '').toLowerCase().includes(term) ||
           (d.commune || '').toLowerCase().includes(term) ||
           (d.contactName || '').toLowerCase().includes(term);
  });
  
  // NUEVO: Estado para la Lista de Equipamiento Modificable
  const [equipmentList, setEquipmentList] = useState([
    "Gata", "Llave de ruedas", "Barrotes", "Botiquín", "Manuales", 
    "Piso de goma", "Colchoneta", "Cortinas", "Triángulos reflectantes", 
    "Extintor", "Chaleco reflectante"
  ]);
  const [newEquipmentItem, setNewEquipmentItem] = useState('');

  useEffect(() => {
    import('firebase/firestore').then(({ doc, getDoc }) => {
      getDoc(doc(db, 'system_config', 'equipment')).then(snap => {
        if (snap.exists() && snap.data().items) setEquipmentList(snap.data().items);
      }).catch(() => {});
    });
  }, [db]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapDir = await getDocs(collection(db, 'directory'));
        setDirectoryList(snapDir.docs.map(d => ({ id: d.id, ...d.data() })));
        const snapTolls = await getDocs(collection(db, 'tolls'));
        setTollsList(snapTolls.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.error("Error cargando datos:", e); }
    };
    fetchData();
  }, [db, configSubTab]);

  const [editingDriver, setEditingDriver] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [fleetFilter, setFleetFilter] = useState('');
  const [driverDocs, setDriverDocs] = useState({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null });
  const [fullScreenDoc, setFullScreenDoc] = useState(null); 
  
  const defaultNotifs = { creado: false, asignado: true, llegada_origen: false, en_ruta: true, llegada_destino: false, finalizado: true };
  const defaultDriverNotifs = { asignacion: true, modificacion: true, nuevo_monto: true, rendicion_pendiente: true };
  const [clientNotifs, setClientNotifs] = useState(defaultNotifs);
  const [driverNotifs, setDriverNotifs] = useState(defaultDriverNotifs);
  const [clientLogo, setClientLogo] = useState(null);
  
  // NUEVO: Estado para Tarifas Predefinidas
  const defaultPrices = { 
    local: '', 
    prt: '', // Clase A
    prtB: '', // Clase B
    prtAyuda: '', // Ayuda Clase A
    prtAyudaB: '', // Ayuda Clase B
    servicio: '',
    inspVisualA: '', // Inspección Visual Clase A
    inspVisualB: '', // Inspección Visual Clase B
    soloGasesB: '',  // Solo Gases Clase B
    frenosA: ''      // Certificado de Frenos
  };
  const [clientPrices, setClientPrices] = useState(defaultPrices);

  React.useEffect(() => {
    if (editingProfile) {
       if (editingProfile === 'NEW') {
          setSelectedCompanyId('');
          setClientLogo(null);
          setClientNotifs(defaultNotifs);
          setClientPrices(defaultPrices);
       } else {
          setSelectedCompanyId(editingProfile.companyId);
          setClientLogo(editingProfile.companyLogo || null);
          setClientNotifs(editingProfile.notifications || defaultNotifs);
          setClientPrices(editingProfile.prices || defaultPrices);
       }
    } else {
       setSelectedCompanyId('');
       setClientLogo(null);
       setClientNotifs(defaultNotifs);
       setClientPrices(defaultPrices);
    }
  }, [editingProfile]);

  const clientProfiles = React.useMemo(() => {
    return customClients.flatMap(company => {
       const emails = company.email ? company.email.split(',').map(e=>e.trim()).filter(Boolean) : [];
       const names = company.contactName ? company.contactName.split(',').map(n=>n.trim()) : [];
       const pins = company.contactPin ? company.contactPin.split(',').map(p=>p.trim()) : [];
       
       if (emails.length === 0) {
          return [{ id: `${company.id}-empty`, companyId: company.id, companyName: company.name, companyLogo: company.logo, email: '', nombre: '', apellido: '', pin: '', notifications: company.notifications || defaultNotifs, prices: company.prices || defaultPrices, isEmptyCompany: true }];
       }
       
       return emails.map((e, i) => {
          const fullName = names[i] || '';
          const parts = fullName.split(' ');
          const nombre = parts[0] || '';
          const apellido = parts.slice(1).join(' ') || '';
          return {
             id: `${company.id}-${e}`,
             companyId: company.id,
             companyName: company.name,
             companyLogo: company.logo,
             email: e,
             nombre,
             apellido,
             pin: pins[i] || '0000',
             notifications: company.notifications || defaultNotifs,
             prices: company.prices || defaultPrices,
             isEmptyCompany: false
          };
       });
    });
  }, [customClients]);

  const handleSaveProfile = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const nombre = fd.get('nombre').trim();
      const apellido = fd.get('apellido').trim();
      const fullName = `${nombre} ${apellido}`.trim();
      const email = fd.get('correo').trim().toLowerCase();
      const companySelection = fd.get('empresa');
      
      try {
          if (companySelection === 'NEW') {
             const newCompanyName = fd.get('nuevaEmpresa').trim();
             await addDoc(collection(db, 'clients'), {
                name: newCompanyName,
                email: email,
                contactName: fullName,
                contactPin: '0000',
                notifications: clientNotifs,
                enableNotifications: Object.values(clientNotifs).some(v=>v),
                logo: clientLogo,
                prices: clientPrices,
                createdAt: Date.now()
             });
          } else {
             const company = customClients.find(c => c.id === companySelection);
             if (!company) return;
             
             let emails = company.email ? company.email.split(',').map(e=>e.trim()).filter(Boolean) : [];
             let names = company.contactName ? company.contactName.split(',').map(n=>n.trim()) : [];
             let pins = company.contactPin ? company.contactPin.split(',').map(p=>p.trim()) : [];
             
             while(names.length < emails.length) names.push('Usuario');
             while(pins.length < emails.length) pins.push('0000');
             
             if (editingProfile && editingProfile !== 'NEW' && editingProfile.email) {
                const idx = emails.indexOf(editingProfile.email);
                if (idx !== -1) {
                   emails[idx] = email;
                   names[idx] = fullName;
                } else {
                   emails.push(email);
                   names.push(fullName);
                   pins.push('0000');
                }
             } else {
                if (emails.includes(email)) return showAlert("Este correo ya existe en esta empresa.");
                emails.push(email);
                names.push(fullName);
                pins.push('0000');
             }
             
             await updateDoc(doc(db, 'clients', company.id), {
                email: emails.join(','),
                contactName: names.join(','),
                contactPin: pins.join(','),
                notifications: clientNotifs, 
                enableNotifications: Object.values(clientNotifs).some(v=>v),
                logo: clientLogo !== null ? clientLogo : (company.logo || null),
                prices: clientPrices
             });
          }

          // NUEVO: Retroactividad Inteligente (Actualizar todos los traslados previos)
          try {
             const targetCompanyName = companySelection === 'NEW' ? fd.get('nuevaEmpresa').trim() : customClients.find(c => c.id === companySelection)?.name;
             
             if (targetCompanyName) {
                const qJobs = query(collection(db, 'transport_jobs'), where('client', '==', targetCompanyName));
                const snapJobs = await getDocs(qJobs);
                
                const updatePromises = snapJobs.docs.map(jobDoc => {
                    const jobData = jobDoc.data();
                    let newPrice = 0;
                    
                    if (jobData.tripType === 'simple') {
                       newPrice = Number(clientPrices.servicio) || 0;
                    } else if (jobData.tripType === 'revision') {
                       if (jobData.prt_result === 'aprobado_ayuda' || jobData.checklist?.rtStatus === 'aprobado_ayuda') {
                          newPrice = jobData.rtData?.type === 'B' ? (Number(clientPrices.prtAyudaB) || 0) : (Number(clientPrices.prtAyuda) || 0);
                       } else if (jobData.rtData?.type === 'B') {
                          newPrice = Number(clientPrices.prtB) || 0;
                       } else {
                          newPrice = Number(clientPrices.prt) || 0;
                       }
                    } else if (jobData.tripType === 'viaje') {
                       newPrice = jobData.companyPrice || 0; // Regiones queda manual (no lo sobreescribimos)
                    } else {
                       newPrice = Number(clientPrices.local) || 0;
                    }
                    
                    return updateDoc(doc(db, 'transport_jobs', jobDoc.id), { companyPrice: newPrice });
                });
                
                await Promise.all(updatePromises);
             }
          } catch (errorRetro) {
             console.error("Error al actualizar traslados antiguos de forma retroactiva:", errorRetro);
          }

          setEditingProfile(null);
          showAlert("Perfil y tarifas guardadas exitosamente.");
      } catch (err) {
          console.error(err);
          showAlert("❌ Error al guardar el perfil.");
      }
  };

  const handleDeleteProfile = async (profile) => {
      const company = customClients.find(c => c.id === profile.companyId);
      if (!company) return;
      let emails = company.email ? company.email.split(',').map(e=>e.trim()).filter(Boolean) : [];
      let names = company.contactName ? company.contactName.split(',').map(n=>n.trim()) : [];
      let pins = company.contactPin ? company.contactPin.split(',').map(p=>p.trim()) : [];
      
      const idx = emails.indexOf(profile.email);
      if (idx !== -1) {
         emails.splice(idx, 1);
         names.splice(idx, 1);
         pins.splice(idx, 1);
         
         if (emails.length === 0) {
            await updateDoc(doc(db, 'clients', company.id), { email: '', contactName: '', contactPin: '' });
         } else {
            await updateDoc(doc(db, 'clients', company.id), { email: emails.join(','), contactName: names.join(','), contactPin: pins.join(',') });
         }
      }
  };

  const handleDocUpload = async (e, field, size) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, size, 0.4);
      setDriverDocs(prev => ({ ...prev, [field]: dataUrl }));
    } catch (err) { showAlert("Error procesando foto."); }
  };

  const DocUploader = ({ field, label }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">{label}</span>
        <div className="relative h-20 w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 group hover:border-blue-400 transition-colors flex items-center justify-center">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => handleDocUpload(e, field, 800)} />
            {driverDocs[field] ? (
                <>
                    <img src={driverDocs[field]} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <span className="text-white text-xs font-bold flex flex-col items-center"><Camera className="w-4 h-4 mb-1"/> Cambiar</span>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); setFullScreenDoc(driverDocs[field]); }} className="absolute top-1 right-1 bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-md z-30 hover:bg-slate-100 dark:bg-slate-800"><Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/></button>
                </>
            ) : (
                <div className="text-center text-slate-400 group-hover:text-blue-500 flex flex-col items-center">
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-[9px] font-black uppercase">Subir</span>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="space-y-6 relative w-full">
      <div className="flex flex-wrap gap-2 pb-2 w-full">
         <button onClick={()=>setConfigSubTab('clients')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='clients'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Clientes</button>
         <button onClick={()=>setConfigSubTab('vehicles')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='vehicles'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Vehículos</button>
         <button onClick={()=>setConfigSubTab('drivers')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='drivers'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Usuarios</button>
         <button onClick={()=>setConfigSubTab('directory')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='directory'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Directorio</button>
         <button onClick={()=>setConfigSubTab('tolls')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='tolls'?'bg-emerald-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Peajes</button>
         <button onClick={()=>setConfigSubTab('equipment')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='equipment'?'bg-amber-500 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Equipamiento</button>
      </div>

      {configSubTab === 'clients' && (
        <div className="w-full min-w-0 flex flex-col gap-6">
          
          {!editingProfile ? (
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-5">
                  <div>
                     <h3 className="font-extrabold text-xl text-slate-800 dark:text-slate-200">Directorio de Clientes</h3>
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Administra los accesos individuales por usuario y empresa</p>
                  </div>
                  <button onClick={() => setEditingProfile('NEW')} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-3 rounded-xl text-sm font-black shadow-md shadow-blue-200 flex items-center gap-2 transition-all shrink-0">
                     <Plus className="w-4 h-4"/> Nuevo Perfil
                  </button>
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {clientProfiles.filter(p => !p.isEmptyCompany).map(profile => (
                     <div key={profile.id} className="flex flex-col p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-blue-200 dark:border-blue-800/50 hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                        <div className="flex justify-between items-start mb-4 pl-2">
                           <div className="flex items-center gap-3 w-full min-w-0 pr-2">
                              <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                 {profile.companyLogo ? <img src={profile.companyLogo} className="w-full h-full object-contain p-1" /> : <User className="w-5 h-5 text-slate-300"/>}
                              </div>
                              <div className="min-w-0">
                                 <p className="font-black text-slate-800 dark:text-slate-200 truncate text-sm">{profile.nombre} {profile.apellido}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{profile.companyName}</p>
                              </div>
                           </div>
                           <div className="flex gap-1 shrink-0 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                              <button onClick={() => { setEditingProfile(profile); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                              <button onClick={() => showConfirm("¿Eliminar este perfil de acceso?", () => handleDeleteProfile(profile))} className="p-1.5 text-red-500 hover:bg-red-50 dark:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                           </div>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center pl-2">
                           <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate flex items-center gap-1.5"><div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center shrink-0"><User className="w-3 h-3 text-slate-500 dark:text-slate-400"/></div> <span className="truncate">{profile.email}</span></span>
                        </div>
                     </div>
                  ))}
                  
                  {clientProfiles.filter(p => p.isEmptyCompany).map(profile => (
                     <div key={profile.id} className="flex flex-col p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:border-slate-600 transition-all opacity-60">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                 {profile.companyLogo ? <img src={profile.companyLogo} className="w-full h-full object-contain p-1" /> : <span className="font-black text-slate-300">{profile.companyName.charAt(0)}</span>}
                              </div>
                              <div>
                                 <p className="font-black text-slate-800 dark:text-slate-200 text-sm">{profile.companyName}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Empresa sin perfiles activos</p>
                              </div>
                           </div>
                           <button onClick={() => showConfirm("¿Eliminar empresa vacía?", async () => await deleteDoc(doc(db, 'clients', profile.companyId)))} className="p-2 bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 text-red-500 hover:bg-red-50 dark:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                     </div>
                  ))}

                  {clientProfiles.length === 0 && (
                     <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900/50">
                        <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm mx-auto mb-3"><User className="w-8 h-8 text-slate-300"/></div>
                        <p className="text-sm font-black text-slate-600 dark:text-slate-400">Aún no hay perfiles en la base de datos.</p>
                        <p className="text-xs font-bold text-slate-400 mt-1">Crea el primer perfil para empezar a operar.</p>
                     </div>
                  )}
               </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-8 animate-in fade-in zoom-in-95 max-w-3xl mx-auto w-full relative">
               <div className="absolute top-0 left-0 w-full h-2 bg-blue-600 rounded-t-3xl"></div>
               
               <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-5 pt-2">
                  <div>
                     <h3 className="font-black text-2xl text-slate-800 dark:text-slate-200">{editingProfile === 'NEW' ? 'Crear Nuevo Perfil' : 'Editar Perfil'}</h3>
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Configuración individual de acceso y notificaciones</p>
                  </div>
                  <button type="button" onClick={() => setEditingProfile(null)} className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl transition-colors font-bold shadow-sm"><X className="w-5 h-5"/></button>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><User className="w-4 h-4"/> 1. Datos Personales</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Nombre</label>
                        <input name="nombre" defaultValue={editingProfile !== 'NEW' ? editingProfile.nombre : ''} placeholder="Ej. Catalina" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:bg-slate-900 transition-colors shadow-sm"/>
                     </div>
                     <div>
                        <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Apellido</label>
                        <input name="apellido" defaultValue={editingProfile !== 'NEW' ? editingProfile.apellido : ''} placeholder="Ej. Pérez" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:bg-slate-900 transition-colors shadow-sm"/>
                     </div>
                     <div className="sm:col-span-2">
                        <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Correo Electrónico (Acceso)</label>
                        <input id="correoInput" name="correo" type="email" defaultValue={editingProfile !== 'NEW' ? editingProfile.email : ''} placeholder="catalina@empresa.com" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="none" className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:bg-slate-900 transition-colors shadow-sm"/>
                     </div>
                  </div>
               </div>

               <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><BookOpen className="w-4 h-4"/> 2. Empresa Asociada</h4>
                  <div>
                     <select name="empresa" value={selectedCompanyId} onChange={(e) => { setSelectedCompanyId(e.target.value); if (e.target.value === 'NEW') { setClientLogo(null); } else { const comp = customClients.find(c => c.id === e.target.value); if (comp) setClientLogo(comp.logo || null); } }} required className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 p-4 rounded-xl text-sm font-black text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:bg-slate-900 transition-colors shadow-sm cursor-pointer">
                        <option value="" disabled>Selecciona a qué empresa pertenece...</option>
                        {customClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="NEW">✨ + Crear y asociar a Nueva Empresa</option>
                     </select>
                  </div>

                  {selectedCompanyId === 'NEW' && (
                     <div className="p-5 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-100 dark:border-blue-800/50 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                           <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5 block ml-1">Nombre de la Nueva Empresa</label>
                           <input name="nuevaEmpresa" placeholder="Ej. Automotora Kovacs" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-slate-900 p-3.5 rounded-xl text-sm font-black text-blue-900 dark:text-blue-300 outline-none focus:border-blue-500 shadow-sm" />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">
                           <label className="relative w-16 h-16 shrink-0 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700/50 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-900/50 group hover:border-blue-500 transition-colors">
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files[0]; if (!file) return; try { const dataUrl = await resizeImage(file, 400, 0.6); setClientLogo(dataUrl); } catch (err) { showAlert("Error procesando logo."); } }} />
                              {clientLogo ? <img src={clientLogo} alt="Logo" className="w-full h-full object-contain p-1" /> : <div className="text-center text-blue-400 group-hover:text-blue-600 dark:text-blue-400"><Camera className="w-5 h-5" /></div>}
                           </label>
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">Logo Corporativo (Opcional)</span>
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-tight">Aparecerá en el portal público.</span>
                              {clientLogo && <button type="button" onClick={() => setClientLogo(null)} className="text-[10px] font-bold text-red-500 hover:underline w-fit mt-1">Quitar Logo</button>}
                           </div>
                        </div>
                     </div>
                  )}
               </div>

               <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-4 h-4"/> 3. Preferencias de Notificación</h4>
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-4 leading-tight">Selecciona qué correos llegarán a este cliente.</p>
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {[ 
                          { id: 'creado', label: 'Al Crear' }, 
                          { id: 'asignado', label: 'Asignación' }, 
                          { id: 'llegada_origen', label: 'En Origen' }, 
                          { id: 'en_ruta', label: 'En Ruta' }, 
                          { id: 'llegada_prt', label: 'Llegó a PRT' }, 
                          { id: 'rt_aprobada', label: 'RT Aprobada' }, 
                          { id: 'rt_rechazada', label: 'RT Rechazada' }, 
                          { id: 'en_ruta_destino', label: 'Ruta Destino' }, 
                          { id: 'llegada_destino', label: 'En Destino' }, 
                          { id: 'finalizado', label: 'Acta PDF' } 
                        ].map(notif => {
                           const isActive = clientNotifs[notif.id];
                           return (
                             <button key={notif.id} type="button" onClick={() => setClientNotifs({...clientNotifs, [notif.id]: !isActive})} className={`py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border-2 flex flex-col items-center justify-center gap-2 select-none ${ isActive ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-100' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300 dark:border-blue-700/50 hover:text-blue-500 hover:bg-blue-50 dark:bg-blue-900/30 scale-[0.98]' }`}>
                                {isActive ? <CheckCircle className="w-5 h-5 animate-in zoom-in duration-200" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50"></div>}
                                <span className="text-center leading-tight">{notif.label}</span>
                             </button>
                           );
                        })}
                     </div>
                  </div>
               </div>

               <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet className="w-4 h-4"/> 4. Tarifas Predefinidas (Solo Admin)</h4>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-4 leading-tight">Define los valores a cobrar para automatizar los ingresos en cada trabajo de esta empresa. Los viajes a Regiones se cobran manualmente.</p>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Local ($)</label>
                           <input type="number" value={clientPrices.local || ''} onChange={(e) => setClientPrices({...clientPrices, local: e.target.value})} placeholder="15000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Otros Serv. ($)</label>
                           <input type="number" value={clientPrices.servicio || ''} onChange={(e) => setClientPrices({...clientPrices, servicio: e.target.value})} placeholder="10000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div className="col-span-full border-b border-indigo-200 dark:border-indigo-800/50/50 mt-2 mb-1"></div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">RT Clase A ($)</label>
                           <input type="number" value={clientPrices.prt || ''} onChange={(e) => setClientPrices({...clientPrices, prt: e.target.value})} placeholder="25000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Ayuda Clase A ($)</label>
                           <input type="number" value={clientPrices.prtAyuda || ''} onChange={(e) => setClientPrices({...clientPrices, prtAyuda: e.target.value})} placeholder="35000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Insp. Visual A ($)</label>
                           <input type="number" value={clientPrices.inspVisualA || ''} onChange={(e) => setClientPrices({...clientPrices, inspVisualA: e.target.value})} placeholder="12000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Cert. Frenos ($)</label>
                           <input type="number" value={clientPrices.frenosA || ''} onChange={(e) => setClientPrices({...clientPrices, frenosA: e.target.value})} placeholder="15000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div className="col-span-full border-b border-indigo-200 dark:border-indigo-800/50/50 mt-2 mb-1"></div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">RT Clase B ($)</label>
                           <input type="number" value={clientPrices.prtB || ''} onChange={(e) => setClientPrices({...clientPrices, prtB: e.target.value})} placeholder="20000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Ayuda Clase B ($)</label>
                           <input type="number" value={clientPrices.prtAyudaB || ''} onChange={(e) => setClientPrices({...clientPrices, prtAyudaB: e.target.value})} placeholder="25000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Insp. Visual B ($)</label>
                           <input type="number" value={clientPrices.inspVisualB || ''} onChange={(e) => setClientPrices({...clientPrices, inspVisualB: e.target.value})} placeholder="10000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Solo Gases B ($)</label>
                           <input type="number" value={clientPrices.soloGasesB || ''} onChange={(e) => setClientPrices({...clientPrices, soloGasesB: e.target.value})} placeholder="12000" className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-sm"/>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="flex gap-3 pt-2 mt-4">
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-sm transition-colors shadow-md shadow-blue-200">
                     Guardar Perfil de Acceso
                  </button>
               </div>
            </form>
          )}
        </div>
      )}

      {configSubTab === 'vehicles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0">
          <form key={editingVehicle ? editingVehicle.id : 'new'} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const client = fd.get('client') === 'OTRO' ? fd.get('manualClient') : fd.get('client'); const vehicleType = fd.get('vehicleType'); try { if(editingVehicle){ await updateDoc(doc(db, 'vehicles', editingVehicle.id), { client, vehicleType, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase() }); setEditingVehicle(null); showAlert("Vehículo actualizado."); } else { await addDoc(collection(db, 'vehicles'), { client, vehicleType, brand: fd.get('brand'), model: fd.get('model'), plate: fd.get('plate').toUpperCase(), createdAt: Date.now() }); showAlert("Vehículo guardado."); } e.target.reset(); } catch (error) { console.error("Error guardando vehículo:", error); showAlert("❌ Error al guardar el vehículo."); } }} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 w-full min-w-0">
            <h3 className="font-extrabold flex items-center gap-2"><Truck className="text-blue-600 dark:text-blue-400"/> {editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
            <select name="client" defaultValue={editingVehicle?.client || ''} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 bg-white dark:bg-slate-900">
              <option value="">Cliente...</option>
              {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="OTRO">Otro (Se debe escribir manualmente)</option>
            </select>
            <input name="manualClient" placeholder="Si es OTRO, escribe el cliente aquí" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="brand" defaultValue={editingVehicle?.brand} placeholder="Marca (Ej. Chevrolet)" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            <input name="model" defaultValue={editingVehicle?.model} placeholder="Modelo (Ej. NPR 816)" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold" onChange={(e) => {
              const b = e.target.form.brand.value.trim().toLowerCase();
              const m = e.target.value.trim().toLowerCase();
              const match = vehicles.find(v => v.brand?.toLowerCase() === b && v.model?.toLowerCase() === m && v.vehicleType);
              if (match && e.target.form.vehicleType) e.target.form.vehicleType.value = match.vehicleType;
            }}/>
            <input name="plate" defaultValue={editingVehicle?.plate} placeholder="Patente" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm uppercase outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-200"/>
            <select name="vehicleType" defaultValue={editingVehicle?.vehicleType || 'auto'} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
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
            <div className="flex gap-2">
              {editingVehicle && <button type="button" onClick={()=>setEditingVehicle(null)} className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl font-bold text-sm w-1/3 hover:bg-slate-200 dark:bg-slate-700 transition-colors">Cancelar</button>}
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-lg transition-colors shadow-lg shadow-blue-200">Guardar Vehículo</button>
            </div>
          </form>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 w-full min-w-0 flex flex-col">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-200 whitespace-nowrap">Base Flota</h3>
              <select onChange={(e) => setFleetFilter(e.target.value)} className="border-2 border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 outline-none focus:border-blue-500 flex-1 max-w-[150px] sm:max-w-full truncate">
                <option value="">Todos los Clientes</option>
                {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTRO">Otros</option>
              </select>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 sm:pr-2">
              {vehicles.filter(v => {
                if (!fleetFilter) return true;
                if (fleetFilter === 'OTRO') return !allClientsList.includes(v.client);
                return v.client === fleetFilter;
              }).map(v=>{
                const clientUpper = v.client?.toUpperCase() || '';
                const grad = clientUpper.includes('KOVACS') ? 'from-red-600 to-red-800' : clientUpper.includes('SALFA') ? 'from-emerald-600 to-emerald-800' : clientUpper.includes('GRANDLEASING') ? 'from-slate-700 to-slate-900' : 'from-blue-600 to-blue-800';
                
                const logoUrl = clientUpper.includes('KOVACS') ? '/logos/kovacs.png' : 
                                clientUpper.includes('SALFA') ? '/logos/salfa.png' : 
                                clientUpper.includes('GRANDLEASING') ? '/logos/grandleasing.png' : 
                                clientUpper.includes('ENEX') ? '/logos/enex.png' : 
                                `/logos/${v.client?.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

                let emoji = '🚙';
                if (v.vehicleType === 'camioneta') emoji = '🛻';
                else if (v.vehicleType?.includes('furgon')) emoji = '🚐';
                else if (v.vehicleType?.includes('2ejes') || v.vehicleType?.includes('3ejes') || v.vehicleType?.includes('8x4')) emoji = '🚛';
                else if (v.vehicleType?.includes('camion')) emoji = '🚚';
                else if (v.vehicleType === 'carro_arrastre') emoji = '🛒';

                return (
                <div key={v.id} className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl shadow-md bg-gradient-to-br ${grad} text-white group transition-all w-full`}>
                  
                  <div className="absolute -left-2 -bottom-2 w-32 h-32 opacity-30 pointer-events-none mix-blend-overlay rotate-[-15deg] grayscale">
                    <img src={logoUrl} alt="" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'}/>
                  </div>

                  <div className="absolute -right-2 -bottom-4 opacity-40 pointer-events-none text-[120px] leading-none select-none mix-blend-overlay grayscale">
                    {emoji}
                  </div>

                  <div className="flex justify-between items-start gap-2 relative z-10 w-full">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-white/70 uppercase tracking-widest truncate">{v.client || 'Sin cliente'}</p>
                      <p className="text-base sm:text-lg font-black leading-tight mt-0.5 truncate">{v.brand} {v.model}</p>
                      {v.vehicleType && <span className="inline-block mt-1.5 text-[9px] font-black bg-white dark:bg-slate-900/20 px-2 py-0.5 rounded-md uppercase backdrop-blur-md border border-white dark:border-slate-800/10 truncate max-w-full">{v.vehicleType.replace('_', ' ')}</span>}
                    </div>
                    <div className="shrink-0 relative z-20">
                      <LicensePlateBadge text={v.plate} />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 relative z-20 justify-end border-t border-white dark:border-slate-800/10 pt-3">
                    <button onClick={() => {setEditingVehicle(v); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-white dark:bg-slate-900/10 hover:bg-white dark:bg-slate-900/20 rounded-lg transition-colors backdrop-blur-sm shadow-sm"><Edit2 className="w-4 h-4 text-white"/></button>
                    <button onClick={()=>showConfirm("¿Eliminar vehículo?", async () => {try { await deleteDoc(doc(db, 'vehicles', v.id)); } catch (e) {}})} className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors backdrop-blur-sm shadow-sm"><Trash2 className="w-4 h-4 text-white"/></button>
                  </div>
                </div>
              )})}
              {vehicles.length === 0 && <p className="text-sm font-semibold text-slate-400 text-center py-4">No hay vehículos registrados</p>}
            </div>
          </div>
        </div>
      )}

      {configSubTab === 'drivers' && (
        <div className="grid md:grid-cols-2 gap-6">
          <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const enableNotifications = Object.values(driverNotifs).some(v => v); const data = { name: fd.get('driverName'), email: fd.get('driverEmail').toLowerCase(), role: fd.get('role'), licenses: fd.getAll('licenses'), licenseExpiry: fd.get('licenseExpiry'), enableNotifications, notifications: driverNotifs, ...driverDocs }; try { if (editingDriver) { await updateDoc(doc(db, 'drivers', editingDriver.id), data); setEditingDriver(null); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); setDriverNotifs(defaultDriverNotifs); showAlert("Perfil actualizado exitosamente."); } else { data.balance = 0; data.createdAt = Date.now(); await addDoc(collection(db, 'drivers'), data); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); setDriverNotifs(defaultDriverNotifs); showAlert("Usuario creado exitosamente."); } e.target.reset(); } catch (err) { console.error(err); } }} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 relative">
            
            {/* Lógica silenciosa para cargar notificaciones previas al editar */}
            <div className="hidden">
               {editingDriver && driverNotifs === defaultDriverNotifs && editingDriver.notifications && setDriverNotifs(editingDriver.notifications)}
            </div>

            <div className="flex justify-between items-start">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2"><User className="text-blue-600 dark:text-blue-400"/> {editingDriver ? 'Perfil de Usuario' : 'Nuevo Usuario'}</h3>
              {editingDriver?.createdAt && (
                <div className="text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Registro en App</span>
                  <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-blue-100 dark:border-blue-800/50 shadow-sm">
                    {new Date(editingDriver.createdAt).toLocaleDateString('es-CL')}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-center justify-center gap-2 pb-2">
              <label className="relative w-20 h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-900 group hover:border-blue-500 transition-colors shadow-inner">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDocUpload(e, 'photo', 160)} />
                {driverDocs.photo ? (
                  <img src={driverDocs.photo} alt="Previsualización" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center flex flex-col items-center justify-center">
                    <Camera className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Selfie</span>
                  </div>
                )}
              </label>
              {driverDocs.photo && <button type="button" onClick={() => setDriverDocs(prev => ({...prev, photo: null}))} className="text-[10px] font-bold text-red-500 hover:underline">Quitar foto</button>}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rol en el Sistema</label>
                 <select name="role" defaultValue={editingDriver?.role || 'driver'} className="w-full border-2 border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/30 p-3 rounded-xl text-sm font-black text-purple-900 dark:text-purple-300 outline-none focus:border-purple-500">
                    <option value="driver">Conductor Titular (Con documentos)</option>
                    <option value="part_time">Conductor Part-Time (Sin validación docs)</option>
                    <option value="quoter">Cotizador / Ventas</option>
                    <option value="admin">Administrador (Oficina)</option>
                    {currentUserEmail === 'fcastro@logisticats.cl' && <option value="super_admin">Super Administrador</option>}
                 </select>
              </div>
              <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre completo" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
              <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail de acceso" required type="email" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="none" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold"/>
            </div>
            
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Documentación de Respaldo</h4>
               <div className="grid grid-cols-2 gap-3">
                  <DocUploader field="idFront" label="Carnet (Frente)" />
                  <DocUploader field="idBack" label="Carnet (Reverso)" />
                  <DocUploader field="licenseFront" label="Licencia (Frente)" />
                  <DocUploader field="licenseBack" label="Licencia (Reverso)" />
               </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 mt-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clase de Licencia</label>
               <div className="grid grid-cols-3 gap-1.5">
                  {LICENCIAS.map(l => (
                    <label key={l} className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-900/50 border rounded-lg text-[11px] font-bold cursor-pointer hover:bg-slate-100 dark:bg-slate-800">
                      <input type="checkbox" name="licenses" value={l} defaultChecked={editingDriver?.licenses?.includes(l)} className="w-3.5 h-3.5 cursor-pointer" />
                      {l}
                    </label>
                  ))}
               </div>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimiento Licencia</label>
               <input name="licenseExpiry" type="date" defaultValue={editingDriver?.licenseExpiry || ''} className="w-full border-2 p-2 rounded-xl text-sm font-semibold outline-none text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900" />
            </div>

            {/* PANEL DE NOTIFICACIONES COPIADO EXACTAMENTE */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 p-4 rounded-xl shadow-sm space-y-3 mt-4">
               <div className="border-b border-blue-200 dark:border-blue-800/50/50 pb-2">
                  <p className="text-xs font-extrabold text-blue-900 dark:text-blue-300 flex items-center gap-1.5"><Eye className="w-4 h-4"/> Correos al Conductor</p>
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 leading-tight">Selecciona exactamente qué copias recibirá este conductor.</p>
               </div>

               <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { id: 'asignacion', label: 'Asignación' },
                    { id: 'modificacion', label: 'Modificación' },
                    { id: 'nuevo_monto', label: 'Nuevo Monto' },
                    { id: 'rendicion_pendiente', label: 'Rendición Pdte.' }
                  ].map(notif => {
                     const isActive = driverNotifs[notif.id];
                     return (
                       <button
                         key={notif.id}
                         type="button"
                         onClick={() => setDriverNotifs({...driverNotifs, [notif.id]: !isActive})}
                         className={`py-3 px-1.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1.5 select-none ${
                           isActive
                             ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-100'
                             : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300 dark:border-blue-700/50 hover:text-blue-500 hover:bg-blue-50 dark:bg-blue-900/30 scale-[0.98]'
                         }`}
                       >
                         {isActive ? <CheckCircle className="w-5 h-5 mb-0.5 animate-in zoom-in duration-200" /> : <div className="w-5 h-5 mb-0.5 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"></div>}
                         <span className="text-center leading-tight">{notif.label}</span>
                       </button>
                     );
                  })}
               </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 mt-4">
              {editingDriver && <button type="button" onClick={() => { setEditingDriver(null); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); setDriverNotifs(defaultDriverNotifs); }} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-extrabold text-sm transition-colors">Cancelar</button>}
              <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-sm transition-colors shadow-lg shadow-blue-200">{editingDriver ? 'Guardar Cambios' : 'Guardar Usuario'}</button>
            </div>
          </form>
          
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 mb-4">Gestión de Usuarios</h3>
            <div className="space-y-2">
              {drivers.length === 0 ? <p className="text-sm font-semibold text-slate-400">Directorio vacío</p> : drivers.map(d=>(
                <div key={d.id} className={`flex justify-between items-center p-3 border rounded-xl group transition-all ${d.isHidden ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-75' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm relative">
                      {d.photo ? (
                        <img src={d.photo} alt={d.name} className={`w-full h-full object-cover ${d.isHidden ? 'grayscale' : ''}`} />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                      {d.isHidden && <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center"><EyeOff className="w-4 h-4 text-white"/></div>}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                         <p className={`text-sm font-extrabold truncate ${d.isHidden ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{d.name}</p>
                         {d.isHidden && <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">Oculto</span>}
                      </div>
                      <p className="text-xs font-bold text-slate-400 truncate leading-tight">{d.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                           d.role === 'super_admin' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50' :
                           d.role === 'admin' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' :
                           d.role === 'quoter' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' :
                           d.role === 'part_time' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' :
                           'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                        }`}>
                           {d.role === 'super_admin' ? 'Super Admin' : d.role === 'admin' ? 'Admin' : d.role === 'quoter' ? 'Cotizador' : d.role === 'part_time' ? 'Part-Time' : 'Conductor'}
                        </span>
                        {(!d.role || d.role === 'driver') && d.licenses && d.licenses.length > 0 && (
                           <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${d.isHidden ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'}`}>
                             Licencias: {d.licenses.join(', ')}
                           </span>
                        )}
                      </div>
                      {d.createdAt && <p className="text-[9px] font-bold text-slate-400 mt-1.5 flex items-center gap-1"><Clock className="w-3 h-3"/> Ingreso: {new Date(d.createdAt).toLocaleDateString('es-CL')}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                     <button onClick={async () => {
                         try { await updateDoc(doc(db, 'drivers', d.id), { isHidden: !d.isHidden }); }
                         catch (e) { showAlert("Error al cambiar estado."); }
                     }} className={`p-2 rounded-lg transition-colors shadow-sm ${d.isHidden ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 hover:bg-green-200 border border-green-200 dark:border-green-800/50' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:bg-slate-600'}`} title={d.isHidden ? "Restaurar Conductor" : "Ocultar Conductor"}>
                         {d.isHidden ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                     </button>
                     <button onClick={() => { 
                       setEditingDriver(d); 
                       setDriverDocs({ photo: d.photo || null, idFront: d.idFront || null, idBack: d.idBack || null, licenseFront: d.licenseFront || null, licenseBack: d.licenseBack || null }); 
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                     }} className={`px-3 py-2 rounded-lg transition-colors shadow-sm text-xs font-bold flex items-center gap-1.5 ${d.isHidden ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:bg-slate-600' : 'bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 text-blue-600 dark:text-blue-400'}`} title="Ver Perfil y Documentos"><User className="w-4 h-4"/> Perfil</button>
                     <button onClick={() => showConfirm("¿Eliminar conductor?", async()=>await deleteDoc(doc(db,'drivers',d.id)))} className="p-2 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {configSubTab === 'directory' && (
        <div className="grid md:grid-cols-2 gap-6 w-full min-w-0">
          <form key={editingDir ? editingDir.id : 'new-dir'} onSubmit={async (e) => { 
             e.preventDefault(); 
             const fd = new FormData(e.target); 

             // Lógica inteligente para prefijo telefónico
             let phone = fd.get('contactPhone')?.trim() || '';
             if (phone) {
                phone = phone.replace(/\s+/g, ''); // Limpiamos espacios en blanco
                if (!phone.startsWith('+569')) {
                   if (phone.startsWith('569')) phone = '+' + phone;
                   else if (phone.startsWith('9')) phone = '+56' + phone;
                   else phone = '+569' + phone.replace(/^\+/, '');
                }
             }

             const data = { 
                placeName: fd.get('placeName')?.trim() || '', 
                contactName: fd.get('contactName')?.trim() || '', 
                contactPhone: phone,
                address: fd.get('address')?.trim() || '',
                commune: fd.get('commune')?.trim() || '',
                plusCode: fd.get('plusCode')?.trim() || '' // <-- NUEVO: Guardar Plus Code
             }; 

             try { 
                if (editingDir) { 
                   await updateDoc(doc(db, 'directory', editingDir.id), data); 
                   setEditingDir(null); 
                   showAlert("Destino actualizado."); 
                } else { 
                   await addDoc(collection(db, 'directory'), data); 
                   showAlert("Destino guardado en el directorio."); 
                } 
                const snap = await getDocs(collection(db, 'directory'));
                setDirectoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                e.target.reset(); 
             } catch (err) { showAlert("Error al guardar."); } 
          }} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
               <h3 className="font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200"><BookOpen className="text-blue-600 dark:text-blue-400 w-5 h-5"/> {editingDir ? 'Editar Destino' : 'Nuevo Destino'}</h3>
               {editingDir && <button type="button" onClick={()=>setEditingDir(null)} className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg uppercase">Cancelar</button>}
            </div>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 leading-tight">Agrega los destinos frecuentes. Cuando crees un trabajo y escribas exactamente el mismo lugar, el sistema adjuntará toda esta información automáticamente.</p>
            
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lugar / Destino exacto <span className="text-red-500">*</span></label>
               <input name="placeName" defaultValue={editingDir?.placeName} placeholder="Ej: Samex Quilicura (Obligatorio)" required autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
            </div>
            
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Encargado (Opcional)</label>
               <input name="contactName" defaultValue={editingDir?.contactName} placeholder="Ej: Luis Ahumada" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
            </div>
            
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono (Opcional)</label>
               <input name="contactPhone" defaultValue={editingDir?.contactPhone} placeholder="Ej: +56912345678" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección Exacta (Opcional)</label>
                  <input name="address" defaultValue={editingDir?.address} placeholder="Ej: Av. Vespucio 1501" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comuna / Ciudad (Opcional)</label>
                  <input name="commune" defaultValue={editingDir?.commune} placeholder="Ej: Quilicura" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold"/>
               </div>
            </div>

            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex flex-wrap items-center gap-1"><MapPin className="w-3 h-3 text-blue-500 shrink-0"/> Plus Code de Google Maps (Prioridad GPS)</label>
               <input name="plusCode" defaultValue={editingDir?.plusCode} placeholder="Ej: 8MP3+VX Santiago" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold bg-blue-50 dark:bg-blue-900/30"/>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-sm transition-colors shadow-md shadow-blue-200 mt-2">
               {editingDir ? 'Guardar Cambios' : 'Agregar al Directorio'}
            </button>
          </form>

          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Destinos Guardados</h3>
              <div className="relative w-full sm:w-72 shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar lugar, Plus Code, nombre..."
                  value={dirSearchTerm}
                  onChange={(e) => setDirSearchTerm(e.target.value)}
                  autoComplete="off" autoCorrect="off" spellCheck="false"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {directoryList.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-4">Directorio vacío</p> : filteredDirectoryList.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-4">No se encontraron destinos</p> : filteredDirectoryList.map(d=>(
                <div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-blue-200 dark:border-blue-800/50 transition-all">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 truncate">{d.placeName}</p>
                    {d.plusCode && <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 mt-0.5 truncate flex items-center gap-1"><MapPin className="w-3 h-3"/> {d.plusCode} (Plus Code)</p>}
                    {(d.address || d.commune) && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400"/> {d.address}{d.address && d.commune ? ', ' : ''}{d.commune}</p>}
                    {(d.contactName || d.contactPhone) && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1"><User className="w-3 h-3 text-emerald-600 dark:text-emerald-400"/> {d.contactName || 'Sin nombre'} {d.contactPhone && `• ${d.contactPhone}`}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                     <button onClick={() => {setEditingDir(d); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 text-blue-600 dark:text-blue-400 rounded-lg transition-colors shadow-sm" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                     <button onClick={() => showConfirm("¿Eliminar destino del directorio?", async () => { 
                         await deleteDoc(doc(db,'directory',d.id));
                         setDirectoryList(directoryList.filter(item => item.id !== d.id));
                     })} className="p-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {configSubTab === 'tolls' && (
        <div className="grid md:grid-cols-2 gap-6 w-full min-w-0 animate-in fade-in">
          <form key={editingToll ? editingToll.id : 'new-toll'} onSubmit={async (e) => {
             e.preventDefault();
             const fd = new FormData(e.target);
             const data = {
                name: fd.get('name')?.trim() || '',
                route: fd.get('route')?.trim() || '',
                prices: {
                   'Auto / SUV': Number(fd.get('priceAuto')) || 0,
                   'Camioneta': Number(fd.get('priceCamioneta')) || 0,
                   'Furgón Pequeño': Number(fd.get('priceFurgonPequeno')) || 0,
                   'Furgón Grande': Number(fd.get('priceFurgonGrande')) || 0,
                   'Camión Simple': Number(fd.get('priceCamionSimple')) || 0,
                   'Camión Doble Cabina': Number(fd.get('priceCamionDoble')) || 0,
                   'Camión (2 Ejes traseros)': Number(fd.get('priceCamion2Ejes')) || 0,
                   'Camión (3 Ejes traseros)': Number(fd.get('priceCamion3Ejes')) || 0,
                   'Camión Rigid (8x4)': Number(fd.get('priceCamion8x4')) || 0,
                   'Carro Arrastre': Number(fd.get('priceCarro')) || 0
                }
             };

             try {
                if (editingToll) {
                   await updateDoc(doc(db, 'tolls', editingToll.id), data);
                   setEditingToll(null);
                   showAlert("✅ Peaje actualizado.");
                } else {
                   await addDoc(collection(db, 'tolls'), data);
                   showAlert("✅ Nuevo peaje creado.");
                }
                const snap = await getDocs(collection(db, 'tolls'));
                setTollsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                e.target.reset();
             } catch (err) { showAlert("❌ Error al guardar peaje."); }
          }} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200"><Ticket className="text-emerald-600 dark:text-emerald-400 w-5 h-5"/> {editingToll ? 'Editar Peaje' : 'Nuevo Peaje'}</h3>
                {editingToll && <button type="button" onClick={()=>setEditingToll(null)} className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg uppercase transition-colors hover:bg-slate-200 dark:bg-slate-700">Cancelar</button>}
             </div>
             <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 leading-tight">Configura el nombre, la ruta y el costo por tipo de vehículo para calcular rápidamente en las rendiciones.</p>
             
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Peaje <span className="text-red-500">*</span></label>
                <input name="name" defaultValue={editingToll?.name} placeholder="Ej: Peaje Lampa" required autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold"/>
             </div>
             
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ruta / Autopista (Opcional)</label>
                <input name="route" defaultValue={editingToll?.route} placeholder="Ej: Ruta 5 Norte" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold"/>
             </div>

             <div className="grid grid-cols-2 gap-3 bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                <div className="col-span-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border-b border-emerald-200 dark:border-emerald-800/50/50 pb-1 mb-1">Valores por Categoría de Vehículo</div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Auto / SUV ($)</label>
                   <input name="priceAuto" type="number" defaultValue={editingToll?.prices?.['Auto / SUV']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camioneta ($)</label>
                   <input name="priceCamioneta" type="number" defaultValue={editingToll?.prices?.['Camioneta']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Furgón Pequeño ($)</label>
                   <input name="priceFurgonPequeno" type="number" defaultValue={editingToll?.prices?.['Furgón Pequeño']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Furgón Grande ($)</label>
                   <input name="priceFurgonGrande" type="number" defaultValue={editingToll?.prices?.['Furgón Grande']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión Simple ($)</label>
                   <input name="priceCamionSimple" type="number" defaultValue={editingToll?.prices?.['Camión Simple']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión Doble ($)</label>
                   <input name="priceCamionDoble" type="number" defaultValue={editingToll?.prices?.['Camión Doble Cabina']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión (2 Ejes) ($)</label>
                   <input name="priceCamion2Ejes" type="number" defaultValue={editingToll?.prices?.['Camión (2 Ejes traseros)']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión (3 Ejes) ($)</label>
                   <input name="priceCamion3Ejes" type="number" defaultValue={editingToll?.prices?.['Camión (3 Ejes traseros)']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Camión (8x4) ($)</label>
                   <input name="priceCamion8x4" type="number" defaultValue={editingToll?.prices?.['Camión Rigid (8x4)']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 ml-1">Carro Arrastre ($)</label>
                   <input name="priceCarro" type="number" defaultValue={editingToll?.prices?.['Carro Arrastre']} placeholder="0" required className="w-full border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-lg text-sm outline-none focus:border-emerald-500 font-bold bg-white dark:bg-slate-900"/>
                </div>
             </div>

             <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-sm transition-colors shadow-md shadow-emerald-200 mt-2">
                {editingToll ? 'Guardar Cambios' : 'Agregar Peaje'}
             </button>
          </form>

          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-h-[85vh] flex flex-col">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-4">
               <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Base de Peajes</h3>
               <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">Total: {tollsList.length}</span>
             </div>
             <div className="space-y-2 overflow-y-auto pr-1 flex-1">
               {tollsList.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-4">No hay peajes configurados.</p> : tollsList.map(t=>(
                 <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-emerald-200 dark:border-emerald-800/50 transition-all group">
                   <div className="flex-1 min-w-0 pr-2">
                     <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 truncate">{t.name}</p>
                     {t.route && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{t.route}</p>}
                     <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚙 Auto: ${t.prices?.['Auto / SUV'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🛻 Camioneta: ${t.prices?.['Camioneta'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚐 Furgón P: ${t.prices?.['Furgón Pequeño'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚐 Furgón G: ${t.prices?.['Furgón Grande'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚚 Camión S: ${t.prices?.['Camión Simple'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚚 Camión DC: ${t.prices?.['Camión Doble Cabina'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚛 Camión 2E: ${t.prices?.['Camión (2 Ejes traseros)'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚛 Camión 3E: ${t.prices?.['Camión (3 Ejes traseros)'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🚚 Camión 8x4: ${t.prices?.['Camión Rigid (8x4)'] || 0}</span>
                        <span className="text-[9px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">🛒 Carro: ${t.prices?.['Carro Arrastre'] || 0}</span>
                     </div>
                   </div>
                   <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                      <button onClick={() => {setEditingToll(t); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors shadow-sm" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={() => showConfirm(`¿Eliminar peaje ${t.name}?`, async () => { 
                          await deleteDoc(doc(db,'tolls',t.id));
                          setTollsList(tollsList.filter(item => item.id !== t.id));
                      })} className="p-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {configSubTab === 'equipment' && (
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 w-full min-w-0 animate-in fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200"><CheckCircle className="text-amber-500 w-5 h-5"/> Lista de Equipamiento</h3>
          </div>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-6 leading-tight">Agrega o elimina los ítems que los conductores deben verificar en el checklist. Se actualizará en los celulares al instante.</p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const item = newEquipmentItem.trim();
            if (!item) return;
            if (equipmentList.map(i=>i.toLowerCase()).includes(item.toLowerCase())) {
              return showAlert("Ese ítem ya está en la lista.");
            }
            const newList = [...equipmentList, item];
            try {
              const { doc, setDoc } = await import('firebase/firestore');
              await setDoc(doc(db, 'system_config', 'equipment'), { items: newList }, { merge: true });
              setEquipmentList(newList);
              setNewEquipmentItem('');
              showAlert("✅ Ítem agregado a la lista de equipamiento.");
            } catch (err) { showAlert("❌ Error al guardar."); }
          }} className="flex flex-col sm:flex-row gap-2 mb-6">
            <input type="text" value={newEquipmentItem} onChange={(e) => setNewEquipmentItem(e.target.value)} placeholder="Ej: Gata, Chaleco, Botiquín..." autoComplete="off" autoCorrect="off" spellCheck="false" className="flex-1 min-w-0 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold outline-none focus:border-amber-500" />
            <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-black shadow-sm transition-colors flex items-center justify-center gap-2 shrink-0">
              <Plus className="w-5 h-5"/> Agregar
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {equipmentList.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-sm gap-2">
                <span className="flex-1 min-w-0 text-sm font-extrabold text-slate-700 dark:text-slate-300 break-words">{item}</span>
                <button type="button" onClick={() => showConfirm(`¿Eliminar "${item}" de la lista?`, async () => {
                  const newList = equipmentList.filter(i => i !== item);
                  try {
                    const { doc, setDoc } = await import('firebase/firestore');
                    await setDoc(doc(db, 'system_config', 'equipment'), { items: newList }, { merge: true });
                    setEquipmentList(newList);
                  } catch(err) { showAlert("❌ Error al eliminar."); }
                })} className="p-2 bg-white dark:bg-slate-900 text-red-500 hover:bg-red-50 dark:bg-red-900/30 hover:text-red-600 dark:text-red-400 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            ))}
            {equipmentList.length === 0 && <p className="text-slate-400 text-center col-span-full py-4 text-sm font-bold">No hay ítems en la lista.</p>}
          </div>
        </div>
      )}

      {fullScreenDoc && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-zoom-out animate-in fade-in" onClick={() => setFullScreenDoc(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white dark:bg-slate-900/20 hover:bg-white dark:bg-slate-900/40 rounded-full text-white transition-colors shadow-lg"><X className="w-6 h-6"/></button>
          <img src={fullScreenDoc} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}



