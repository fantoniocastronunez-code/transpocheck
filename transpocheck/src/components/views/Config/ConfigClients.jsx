import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { Camera, User, Edit2, Trash2, Clock, X, Plus, BookOpen, CheckCircle, Wallet } from 'lucide-react';
import { resizeImage } from '../../../utils/helpers';

export default function ConfigClients({ customClients, db, showAlert, showConfirm }) {
  const [editingProfile, setEditingProfile] = useState(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [clientLogo, setClientLogo] = useState(null);
  
  const defaultNotifs = { creado: false, asignado: true, llegada_origen: false, en_ruta: true, llegada_destino: false, finalizado: true };
  const [clientNotifs, setClientNotifs] = useState(defaultNotifs);
  
  const defaultPrices = { 
    local: '', 
    prt: '', 
    prtB: '', 
    prtAyuda: '', 
    prtAyudaB: '', 
    servicio: '',
    inspVisualA: '', 
    inspVisualB: '', 
    soloGasesB: '',  
    frenosA: ''      
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

          // Retroactividad Inteligente
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
                       newPrice = jobData.companyPrice || 0;
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

  return (
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
                 <div key={profile.id} className="flex flex-col p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-blue-200 dark:border-blue-800/50 hover:shadow-md transition-all group relative overflow-hidden">
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
                 <div key={profile.id} className="flex flex-col p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:border-slate-600 transition-all opacity-60">
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
                 <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900">
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
                    <input name="nombre" defaultValue={editingProfile !== 'NEW' ? editingProfile.nombre : ''} placeholder="Ej. Catalina" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors shadow-sm"/>
                 </div>
                 <div>
                    <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Apellido</label>
                    <input name="apellido" defaultValue={editingProfile !== 'NEW' ? editingProfile.apellido : ''} placeholder="Ej. Pérez" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors shadow-sm"/>
                 </div>
                 <div className="sm:col-span-2">
                    <label className="text-[11px] font-black uppercase text-slate-400 mb-1.5 block tracking-wider ml-1">Correo Electrónico (Acceso)</label>
                    <input id="correoInput" name="correo" type="email" defaultValue={editingProfile !== 'NEW' ? editingProfile.email : ''} placeholder="catalina@empresa.com" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="none" className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors shadow-sm"/>
                 </div>
              </div>
           </div>

           <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><BookOpen className="w-4 h-4"/> 2. Empresa Asociada</h4>
              <div>
                 <select name="empresa" value={selectedCompanyId} onChange={(e) => { setSelectedCompanyId(e.target.value); if (e.target.value === 'NEW') { setClientLogo(null); } else { const comp = customClients.find(c => c.id === e.target.value); if (comp) setClientLogo(comp.logo || null); } }} required className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 rounded-xl text-sm font-black text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors shadow-sm cursor-pointer">
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
                       <label className="relative w-16 h-16 shrink-0 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700/50 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-900 group hover:border-blue-500 transition-colors">
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
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
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
                            {isActive ? <CheckCircle className="w-5 h-5 animate-in zoom-in duration-200" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"></div>}
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
  );
}
