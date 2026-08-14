import React from 'react';
export default function JobCard({ j, ...props }) {
  const { analyzeJobStatus, getJobIdentifier, vehicles, menuOpenId, setMenuOpenId, isAdminView, onEditJob, currentUserEmail, setRelayPromptJob, setForceCloseJob, db, updateDoc, deleteField, doc, showAlert, showConfirm, setJobToFail, latestVehiclePhotos, setFullScreenPhoto, role, processingId, setProcessingId, handleApproveRequest, handleRejectRequest, handleAcceptJob, setTrackingJobId, setGuideUploadJob, setGuideLink, setGuideFileBase64, updatePhase, setArrivalPromptJob, setArrivalMileage, setArrivalPhoto, setArrivalKeyLocation, setArrivalKeyHandedTo, setPrtApproveType, setPrtReturnOpt, setPrtReturnDest, setPrtApprovePromptJob, setPrtPromptJob, onStartChecklist, handleUndoPhase, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, WaitTimerBadge, SwipeButton, AlertCircle, Edit2, MoreVertical, Navigation, Share2, Users, CheckCircle, Truck, X, XCircle, Clock, Car, MapPin, FileText } = props;
    const { isRequested, isPending, isAccepted, isPendingGuide, step2Done, step3Done, step4Done } = analyzeJobStatus(j);
    
    const ident = getJobIdentifier(j);

  const getRtFinalDestination = (job) => {
    // 1. PRIORIDAD ABSOLUTA: Si el administrador editó la ruta con flechas, esta gana por sobre el checklist.
    if (job.destination && job.destination.includes('->')) {
      const parts = job.destination.split('->');
      return parts[parts.length - 1].trim();
    }

    // 2. Si no hay ruta editada manual, tomamos la decisión del checklist
    if (job.checklist?.rtReturnOption === 'other' && job.checklist?.rtReturnDestination) {
      return job.checklist.rtReturnDestination;
    }
    if (job.checklist?.rtReturnOption === 'origin') {
      return job.origin;
    }
    
    // 3. Fallback final si no hay checklist cerrado ni flechas
    if (job.destination && !job.destination.toLowerCase().includes('prt')) {
      return job.destination.trim();
    }
    return job.origin || 'Por definir';
  };

    // NUEVO: Motor de Alertas de Documentos por Vencer (30 días) o Vencidos
    let expiringDocs = [];
    if (vehicles && ident && ident !== 'S/N' && j.tripType !== 'simple') {
       const v = vehicles.find(x => x.plate === ident.toUpperCase());
       if (v && v.docsExpiry) {
           const today = new Date(); today.setHours(0,0,0,0);
           const limit = new Date(); limit.setDate(today.getDate() + 30); // Aviso 30 días antes
           const docNames = { soap: 'SOAP', permiso: 'Permiso Circ.', revTecnica: 'Rev. Técnica', gases: 'Gases' };
           
           for (const [key, dateStr] of Object.entries(v.docsExpiry)) {
               if (!dateStr) continue;
               const [year, month, day] = dateStr.split('-');
               const expDate = new Date(year, month - 1, day);
               if (expDate < today) {
                   expiringDocs.push(`🔴 ${docNames[key]} Vencido (${day}/${month}/${year})`);
               } else if (expDate <= limit) {
                   expiringDocs.push(`🟠 ${docNames[key]} vence el ${day}/${month}/${year}`);
               }
           }
       }
    }

    return (
      // --- OPTIMIZACIÓN: Quitamos el overflow-hidden del padre para que el menú no se corte ---
      // Además, si la tarjeta tiene el menú abierto, elevamos su z-index
      <div key={j.id} className={`bg-white rounded-[2rem] border p-4 sm:p-5 flex flex-col shadow-sm relative hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-default group ${j.isUrgent ? 'border-red-400 ring-2 ring-red-100' : (j.fleetGroup ? 'border-indigo-200' : 'border-slate-100')} ${menuOpenId === j.id ? 'z-50' : 'z-10'}`}>
        
        {/* --- OPTIMIZACIÓN: Los fondos decorativos ahora viven en un contenedor con overflow-hidden para no salirse de los bordes redondeados --- */}
        <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
            {/* Efecto de luz ambiental en la esquina */}
            <div className={`absolute -right-16 -top-16 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${isRequested ? 'bg-pink-500' : (isPending ? 'bg-amber-500' : 'bg-blue-500')}`}></div>
            {/* Borde izquierdo iluminado con gradiente */}
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 transition-all ${isRequested ? 'bg-gradient-to-b from-pink-400 to-pink-600' : (isPending ? 'bg-gradient-to-b from-amber-300 to-amber-500' : 'bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]')}`}></div>
        </div>
        
        <div className="flex justify-between items-start mb-5 border-b border-slate-100/80 pb-4 pl-2 relative z-20">
          <div className="flex flex-col gap-3 w-full">
            <div className="flex justify-between items-start w-full gap-2">
              <div className="shrink-0 relative z-10 flex flex-col items-end gap-1">
                {j.isUrgent && (
                   <span className="bg-red-500 text-white border border-red-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm max-w-[150px] text-center leading-tight mb-1 flex items-center gap-1 animate-pulse">
                     <AlertCircle className="w-3 h-3"/> URGENTE
                   </span>
                )}
                {j.tripType === 'simple' && (
                   <span className="bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm max-w-[150px] text-center leading-tight mb-1">SERVICIO</span>
                )}
                {ident !== 'S/N' && (
                   <>
                     <LicensePlateBadge text={ident} />
                     {j.vin && ident !== j.vin && (
                       <div className="mr-1 mt-1"><VinPlateBadge vin={j.vin} /></div>
                     )}
                   </>
                )}
                {(j.checklist?.transitNotes || j.draft?.formData?.transitNotes) && (
                   <span className="bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm max-w-[150px] text-center leading-tight mb-1 flex items-center gap-1 animate-pulse">
                     <AlertCircle className="w-3 h-3"/> NOTA EN RUTA
                   </span>
                )}
              </div>
              
              <div className="flex items-center gap-1 relative shrink-0 z-50">
                {isAdminView && <button onClick={()=>onEditJob(j)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-5 h-5"/></button>}
                <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"><MoreVertical className="w-5 h-5"/></button>
                {/* --- OPTIMIZACIÓN: z-[999] para aplastar cualquier capa inferior --- */}
                {menuOpenId===j.id && (
                  <div className="absolute right-0 top-10 bg-white border shadow-[0_10px_40px_rgba(0,0,0,0.2)] rounded-xl w-56 z-[999] overflow-hidden text-xs">
                    <button onClick={() => {
                      const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                      const textToShare = `📍 Sigue en tiempo real todos los traslados de ${j.client || 'tu empresa'} aquí:\n${url}`;
                      const textArea = document.createElement("textarea");
                      textArea.value = textToShare; textArea.style.position = "fixed"; document.body.appendChild(textArea);
                      textArea.focus(); textArea.select();
                      try { document.execCommand('copy'); showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!"); } catch(e) {}
                      document.body.removeChild(textArea); setMenuOpenId(null);
                    }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-blue-50 text-blue-600"><Navigation className="w-4 h-4"/> Portal Cliente</button>
                    
                    {isAccepted && (
                      <button onClick={() => {
                        const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                        const textToShare = `📍 Hola! El vehículo ${ident} va en camino a ${j.destination || 'su destino'}. Puedes seguir el traslado en tiempo real aquí:\n${url}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank');
                        setMenuOpenId(null);
                      }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-green-50 text-green-600 border-t border-slate-50"><Share2 className="w-4 h-4"/> Notificar Receptor</button>
                    )}
                    <button onClick={() => {
                      const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                      const textToShare = `📍 Sigue en tiempo real todos los traslados de ${j.client || 'tu empresa'} aquí:\n${url}`;
                      const textArea = document.createElement("textarea");
                      textArea.value = textToShare; textArea.style.position = "fixed"; document.body.appendChild(textArea);
                      textArea.focus(); textArea.select();
                      try { document.execCommand('copy'); showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!"); } catch(e) {}
                      document.body.removeChild(textArea); setMenuOpenId(null);
                    }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-blue-50 text-blue-600"><Navigation className="w-4 h-4"/> Portal Cliente</button>
                    
                    {isAccepted && (
                      <button onClick={() => {
                        const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                        const textToShare = `📍 Hola! El vehículo ${ident} va en camino a ${j.destination || 'su destino'}. Puedes seguir el traslado en tiempo real aquí:\n${url}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank');
                        setMenuOpenId(null);
                      }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-green-50 text-green-600 border-t border-slate-50"><Share2 className="w-4 h-4"/> Notificar Receptor</button>
                    )}

                    {/* NUEVO BOTÓN: DESHACER PASO */}
                    {isAccepted && j.phase && j.phase !== 'claimed' && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={() => handleUndoPhase(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-orange-50 text-orange-600 border-t border-slate-50">
                        <RefreshCw className="w-4 h-4"/> Deshacer último paso
                      </button>
                    )}

                    {/* El botón de traspaso solo es visible para el dueño del trabajo o un admin */}
                    {isAccepted && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={() => { setRelayPromptJob(j); setMenuOpenId(null); }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-purple-50 text-purple-600 border-t border-slate-50"><Users className="w-4 h-4"/> Traspaso a Compañero</button>
                    )}
                    
                    {isAdminView && (
                      <button onClick={() => { setForceCloseJob(j); setMenuOpenId(null); }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-emerald-50 text-emerald-600 border-t border-slate-50">
                        <CheckCircle className="w-4 h-4"/> Forzar Cierre
                      </button>
                    )}

                    {isAdminView && j.fleetGroup && (
                       <button onClick={() => {
                          showConfirm("¿Quitar este vehículo del grupo de flota?", async () => {
                             try { await updateDoc(doc(db, 'transport_jobs', j.id), { fleetGroup: deleteField() }); setMenuOpenId(null); showAlert("Vehículo removido de la flota."); } catch (e) { showAlert("Error al desagrupar."); }
                          });
                       }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-indigo-50 text-indigo-600 border-t border-slate-50">
                          <Truck className="w-4 h-4"/> Quitar de Flota
                       </button>
                    )}
                    
                    {isAccepted && (!j.phase || j.phase === 'claimed' || j.phase === 'arrived_pickup') && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={() => { showConfirm("¿Deseas cancelar la aceptación?", async () => { try { await updateDoc(doc(db, 'transport_jobs', j.id), { status: 'pending', acceptedByEmail: deleteField(), phase: deleteField(), liveLocation: deleteField(), arrivedPickupAt: deleteField(), waitTimeMinutes: deleteField() }); setMenuOpenId(null); showAlert("✅ Traslado liberado."); } catch (err) { showAlert("Error al liberar."); } }); }} className="w-full text-left p-3 font-bold flex gap-2 text-amber-600 hover:bg-amber-50 border-t border-slate-50">
                        <X className="w-4 h-4"/> Cancelar Aceptación (Soltar)
                      </button>
                    )}

                    {(isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 hover:bg-red-50 border-t border-slate-50"><XCircle className="w-4 h-4"/> Cancelar / Falló</button>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
                {/* NUEVO: Miniatura con inteligencia histórica (Busca la foto actual o la última registrada) */}
                {(() => {
                   const displayPhoto = j.checklist?.photos?.front || j.draft?.formData?.photos?.front || latestVehiclePhotos[ident];
                   if (!displayPhoto) return null;
                   return (
                      <img 
                         src={displayPhoto} 
                         alt="Frente" 
                         onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(displayPhoto); }}
                         className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                      />
                   );
                })()}
                <div>
                    {j.tripType === 'simple' ? (
                       <p className="text-lg font-black text-purple-800 leading-tight mt-1 break-words pr-2">{j.description || 'Servicio en Terreno'}</p>
                    ) : (
                       <p className="text-xl font-black text-slate-800 leading-tight mt-1 break-words pr-2">{j.brand} {j.model}</p>
                    )}
                    <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wide flex items-center flex-wrap gap-2">
                       {j.client}
                       {j.fleetGroup && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[9px] font-black border border-indigo-200">EN FLOTA (CONVOY)</span>}
                    </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 mt-3 relative z-10 flex flex-col gap-1.5">
            {/* ORIGEN */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 z-10">
              <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                {j.tripType === 'simple' ? 'Lugar' : 'Desde'}
              </span>
              <p className="text-sm font-extrabold text-slate-800 leading-snug break-words">{j.origin || 'Por definir'}</p>
            </div>

            {(j.destination || j.tripType !== 'simple') && (
              <>
                {/* ICONO CENTRAL O 1ra PARADA PRT */}
                <div className="flex justify-center -my-2.5 z-20">
                  {j.tripType === 'revision' ? (
                     <div className="bg-amber-100 px-3 py-0.5 rounded-lg border border-amber-200 shadow-sm text-center">
                       <p className="text-[10px] font-black text-amber-800 uppercase">1ra Parada: PRT</p>
                     </div>
                  ) : j.waypoints && j.waypoints.length > 0 ? (
                     <div className="bg-amber-100 px-3 py-0.5 rounded-lg border border-amber-200 shadow-sm text-center">
                       <p className="text-[10px] font-black text-amber-700">{j.waypoints.length} paradas</p>
                     </div>
                  ) : (
                    <div className="bg-white p-1 rounded-full border border-slate-200 text-slate-300 shadow-sm">
                      <Navigation className="w-3 h-3 rotate-180" />
                    </div>
                  )}
                </div>

                {/* DESTINO */}
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] z-10">
                  <span className="flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    Hasta
                  </span>
                  <p className="text-sm font-extrabold text-blue-700 leading-snug break-words whitespace-normal">
                    {j.tripType === 'revision' ? getRtFinalDestination(j) : (j.destination || 'Por definir')}
                  </p>
                </div>
              </>
            )}
            
            {j.waypoints && j.waypoints.length > 0 && (
              <div className="mt-1 pt-2 border-t border-slate-100">
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3"/> Ruta intermedia:</p>
                <div className="flex flex-col gap-1">
                  {j.waypoints.map((wp, i) => (
                     <span key={i} className="text-[11px] font-bold text-slate-600 leading-snug break-words"><span className="font-black mr-1 text-slate-400">{i + 1}.</span> {wp}</span>
                  ))}
                </div>
              </div>
            )}

            {/* CONTACTOS, DIRECCIONES Y NAVEGACIÓN INTELIGENTE */}
            <div className="mt-3 space-y-2">
              
              {/* BLOQUE ORIGEN */}
              {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone || j.originAddress || j.originCommune) && (
                <div className="pt-3 border-t border-slate-200/60 flex flex-col gap-2">
                   {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone) && (
                   <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                     <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="bg-emerald-50 p-2 rounded-lg shrink-0 border border-emerald-100"><Users className="w-4 h-4 text-emerald-600"/></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Encargado Origen</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{j.originContactName || j.contactName || 'No especificado'}</p>
                        </div>
                     </div>
                     {(j.originContactPhone || j.contactPhone) && (
                     <div className="flex gap-1.5 shrink-0">
                       <a href={`https://wa.me/${(j.originContactPhone || j.contactPhone).replace(/[^\d]/g, '')}?text=${encodeURIComponent('Hola ' + (j.originContactName || j.contactName || '') + ', soy de LogisticAPP y voy a retirar el vehículo.')}`} target="_blank" rel="noopener noreferrer" className="bg-emerald-500 hover:bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 text-sm">💬</a>
                       <a href={`tel:${(j.originContactPhone || j.contactPhone).replace(/[^\d+]/g, '')}`} className="bg-slate-800 hover:bg-slate-900 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 text-sm">📞</a>
                     </div>
                     )}
                   </div>
                   )}
                   
                   {(j.originAddress || j.originCommune) && (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm mt-1">
                        <p className="text-[10px] font-bold text-slate-600 truncate mr-2 ml-1"><MapPin className="w-3 h-3 inline mr-1 text-slate-400"/>{j.originAddress}{j.originAddress && j.originCommune ? ', ' : ''}{j.originCommune}</p>
                        {isAccepted && (
                          <a href={`https://waze.com/ul?q=${encodeURIComponent(`${j.originAddress || ''} ${j.originCommune || ''}`)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-colors border border-blue-200"><Navigation className="w-3 h-3"/> Waze</a>
                        )}
                      </div>
                   )}
                </div>
              )}

              {/* BLOQUE DESTINO */}
              {(j.destContactName || j.destContactPhone || j.destAddress || j.destCommune) && (
                <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-2">
                   {(j.destContactName || j.destContactPhone) && (
                   <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                     <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="bg-blue-50 p-2 rounded-lg shrink-0 border border-blue-100"><Users className="w-4 h-4 text-blue-600"/></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">Encargado Destino</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{j.destContactName || 'No especificado'}</p>
                        </div>
                     </div>
                     {j.destContactPhone && (
                     <div className="flex gap-1.5 shrink-0">
                       <a href={`https://wa.me/${j.destContactPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent('Hola ' + (j.destContactName || '') + ', soy de LogisticAPP y voy en camino al destino con el vehículo.')}`} target="_blank" rel="noopener noreferrer" className="bg-emerald-500 hover:bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 text-sm">💬</a>
                       <a href={`tel:${j.destContactPhone.replace(/[^\d+]/g, '')}`} className="bg-slate-800 hover:bg-slate-900 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 text-sm">📞</a>
                     </div>
                     )}
                   </div>
                   )}

                   {(j.destAddress || j.destCommune) && (
                      <div className="flex justify-between items-center bg-blue-50/50 p-2.5 rounded-xl border border-blue-200 shadow-sm animate-in fade-in slide-in-from-top-1 mt-1">
                        <p className="text-[10px] font-bold text-blue-800 truncate mr-2 ml-1"><MapPin className="w-3 h-3 inline mr-1 text-blue-500"/>{j.destAddress}{j.destAddress && j.destCommune ? ', ' : ''}{j.destCommune}</p>
                        {isAccepted && (
                          <a href={`https://waze.com/ul?q=${encodeURIComponent(`${j.destAddress || ''} ${j.destCommune || ''}`)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-md transition-colors"><Navigation className="w-3 h-3"/> Waze</a>
                        )}
                      </div>
                   )}
                </div>
              )}
            </div>
          </div>

          {j.tripType === 'revision' && <div className="mb-3 bg-amber-50 border border-amber-200 p-2 rounded-xl text-center shadow-sm"><span className="text-[10px] font-black text-amber-700 uppercase">REVISIÓN TÉCNICA (TIPO {j.rtData?.type})</span></div>}
          {j.tripType === 'viaje' && <div className="mb-3 bg-indigo-50 border border-indigo-100 rounded-xl p-2 mb-3 text-center shadow-sm"><span className="text-[10px] font-black text-indigo-700 uppercase">A Regiones</span></div>}
          
          {(() => {
             if (!j.scheduledDate) return null;
             const today = new Date(); today.setHours(0,0,0,0);
             const [y, m, d] = j.scheduledDate.split('-');
             const schedDate = new Date(y, m - 1, d); schedDate.setHours(0,0,0,0);
             const diffDays = Math.round((schedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
             const timeStr = j.scheduledTime ? ` a las ${j.scheduledTime}` : '';
             
             // Detectamos si el traslado ya fue iniciado por el conductor
             const isStarted = ['picked_up', 'arrived_destination', 'arrived_prt', 'prt_done'].includes(j.phase);

             if (diffDays === 0) {
                 if (!j.scheduledTime) return null;
                 return <div className="mb-3 bg-blue-50 border border-blue-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-blue-700 uppercase tracking-widest">📅 HOY{timeStr}</span></div>;
             }
             if (diffDays === 1) return <div className="mb-3 bg-cyan-50 border border-cyan-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-cyan-700 uppercase tracking-widest">📅 Mañana{timeStr}</span></div>;
             if (diffDays > 1) return <div className="mb-3 bg-slate-100 border border-slate-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-slate-600 uppercase tracking-widest">📅 Para el {d}/{m}/{y}{timeStr}</span></div>;
             
             // Si ya pasó la fecha planificada pero el viaje ESTÁ EN PROCESO, evitamos el rojo
             if (isStarted) return <div className="mb-3 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-emerald-700 uppercase tracking-widest">🚀 EN RUTA ({d}/{m}/{y})</span></div>;

             // Si se pasó la fecha, no ha iniciado y sigue activo, se trata visualmente como HOY (Reprogramación automática)
             if (!j.scheduledTime) return null;
             return <div className="mb-3 bg-blue-50 border border-blue-200 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-blue-700 uppercase tracking-widest">📅 HOY{timeStr}</span></div>;
          })()}

        <div className="relative pl-7 space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[10px] before:w-0.5 before:bg-slate-100 mb-5">
          <div className="relative"><div className="absolute -left-7 bg-blue-500 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center"><CheckCircle className="w-2.5 h-2.5 text-white"/></div><p className="font-extrabold text-slate-800 text-sm leading-tight break-words">{isAccepted ? (j.assignedDrivers?.find(d => d.email === j.acceptedByEmail)?.name || "Conductor") : "Buscando conductor"}</p><p className="text-xs font-bold text-slate-500 break-words whitespace-normal">{isAccepted ? (j.tripType === 'simple' ? `Asignado a ${j.origin}` : `Retira en ${j.origin}`) : `Para ${j.origin}`}</p></div>
          <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step2Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step2Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-sm leading-tight ${step2Done ? 'text-slate-800' : 'text-slate-400'}`}>{j.tripType === 'simple' ? 'Realizando Trabajo' : 'Vehículo en Tránsito'}</p></div>
          <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step3Done ? 'bg-blue-500' : 'bg-slate-200'}`}>{step3Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-sm leading-tight ${step3Done ? 'text-slate-800' : 'text-slate-400'}`}>{j.tripType === 'simple' ? 'Trabajo Terminado' : (j.tripType === 'revision' ? 'En PRT' : 'Llegada a Destino')}</p><p className={`text-xs font-bold whitespace-normal break-words pr-2 ${step3Done ? 'text-blue-600' : 'text-slate-400'}`}>{j.tripType === 'simple' ? (j.destination || '') : (j.tripType === 'revision' ? 'Planta' : j.destination)}</p></div>
          
          {j.tripType === 'revision' && (
            <>
              <div className="relative"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${step4Done ? (j.prt_result === 'rechazado' ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-200'}`}>{step4Done && <CheckCircle className="w-2.5 h-2.5 text-white"/>}</div><p className={`font-extrabold text-sm leading-tight ${step4Done ? (j.prt_result === 'rechazado' ? 'text-red-600' : 'text-green-600') : 'text-slate-400'}`}>Resultado Revisión</p>{step4Done && <p className={`text-xs font-bold ${j.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-600'}`}>{j.prt_result === 'rechazado' ? `Rechazado` : 'Aprobado'}</p>}</div>
              {/* Mostrar a dónde se dirige después de PRT (sea aprobado o rechazado) */}
              {step4Done && (
                <div className="relative pt-2"><div className={`absolute -left-7 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center bg-blue-500`}><Navigation className="w-2.5 h-2.5 text-white"/></div><p className="font-extrabold text-sm leading-tight text-slate-800">En camino a:</p><p className="text-xs font-bold text-blue-600 whitespace-normal break-words pr-2">
                    {getRtFinalDestination(j)}
                </p></div>
              )}
            </>
          )}
        </div>

        {j.phase === 'arrived_pickup' && j.arrivedPickupAt && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <WaitTimerBadge arrivedAt={j.arrivedPickupAt} role={role} />
            </div>
            <button onClick={() => {
              showConfirm("¿Deseas cancelar el contador de espera? (Se registrará como 0 minutos al avanzar)", async () => {
                try {
                  await updateDoc(doc(db, 'transport_jobs', j.id), {
                    arrivedPickupAt: deleteField()
                  });
                  showAlert("✅ Tiempo de espera cancelado.");
                } catch(e) { showAlert("Error al cancelar."); }
              });
            }} className="bg-red-50 hover:bg-red-100 text-red-600 p-2.5 rounded-xl border border-red-200 shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0" title="Cancelar Timer">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

 
        {/* NUEVO: PANEL DE ALERTA DE DOCUMENTOS VENCIDOS O POR VENCER */}
        {expiringDocs.length > 0 && (
          <div className="mb-2 mt-3 bg-red-50 border-2 border-red-200 p-3 rounded-xl shadow-sm animate-in fade-in">
             <p className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
               <AlertCircle className="w-4 h-4" /> Alerta de Documentos
             </p>
             <ul className="text-xs font-bold text-red-800 space-y-1">
               {expiringDocs.map((docAlert, idx) => (
                 <li key={idx} className="bg-white/60 px-2 py-1 rounded-md border border-red-100">{docAlert}</li>
               ))}
             </ul>
          </div>
        )}

        {(() => {
           const activeDocHref = j.guideLink || j.guideUrl || j.docLink || j.docUrl || j.rtLink || j.rtDoc || (j.rtData && j.rtData.link) || j.pdfUrl || j.fileUrl || j.checklist?.guiaDespachoPdf || j.checklist?.guiaDespachoLink;
           if (activeDocHref) {
             return (
               <div className="mt-3">
                 <a href={activeDocHref} target="_blank" rel="noreferrer" className="w-full bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 font-bold py-2.5 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-2">
                    <FileText className="w-4 h-4"/> Ver Doc. Adjunto (Guía / RT)
                 </a>
               </div>
             );
           }
           return null;
        })()}

        <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
          {isRequested && (
            <>
              {isAdminView ? (
                <div className="flex gap-2">
                  <button onClick={() => handleApproveRequest(j)} disabled={processingId === `${j.id}-approve`} className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-1 disabled:opacity-50">
                    {processingId === `${j.id}-approve` ? <Clock className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>} Aprobar
                  </button>
                  <button onClick={() => handleRejectRequest(j)} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-1">
                    <XCircle className="w-4 h-4"/> Rechazar
                  </button>
                </div>
              ) : (
                <div className="bg-pink-50 border border-pink-200 text-pink-700 text-xs font-bold text-center py-3 rounded-xl flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> Pendiente de Aprobación
                </div>
              )}
            </>
          )}

          {(!isRequested && (j.status === 'accepted' || j.status === 'pending_guide') && j.acceptedByEmail !== currentUserEmail) ? (
             <div className="bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold text-center py-3 rounded-xl">Vehículo a cargo de un compañero.</div>
          ) : (
            <>
              {isPending && (!isAdminView || j.assignedEmails?.includes(currentUserEmail)) && (
                <SwipeButton key={`btn-accept-${j.id}`} onConfirm={() => handleAcceptJob(j)} text="Desliza para Aceptar" colorClass="bg-blue-600" isProcessing={processingId === `${j.id}-accept`} />
              )}

              {isAccepted && (j.acceptedByEmail === currentUserEmail) && (
                <>
                  <button onClick={() => setTrackingJobId(j.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 mb-3 shadow-blue-200">
                    <Navigation className="w-5 h-5"/> ABRIR PANEL DE VIAJE
                  </button>
                  {isPendingGuide ? (
                    <div className="flex flex-col gap-2">
                       <div className="bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-black text-center py-3 rounded-xl animate-pulse flex items-center justify-center gap-1.5 shadow-sm">
                         <Clock className="w-4 h-4"/> A ESPERA DE GUÍA DE DESPACHO
                       </div>
                       <button onClick={() => { setGuideUploadJob(j); setGuideLink(''); setGuideFileBase64(null); }} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3.5 rounded-xl text-sm shadow-md transition-colors flex justify-center items-center gap-2">
                          <FileText className="w-5 h-5"/> Subir Guía y Finalizar
                       </button>
                    </div>
                  ) : (
                    <>
                      {(!j.phase || j.phase === 'claimed') && <SwipeButton key={`btn-pickup-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_pickup', { arrivedPickupAt: Date.now() })} text={j.tripType === 'simple' ? "Desliza: Llegué al lugar" : "Desliza: Llegué a retirar"} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-amber-500" isProcessing={processingId === `${j.id}-arrived_pickup`} />}
                      
                      {j.phase === 'arrived_pickup' && <SwipeButton key={`btn-power-${j.id}`} onConfirm={()=>{
                        const waitMins = j.arrivedPickupAt ? Math.floor((Date.now() - j.arrivedPickupAt) / 60000) : 0;
                        updatePhase(j, 'picked_up', { pickedUpAt: Date.now(), waitTimeMinutes: waitMins });
                      }} text={j.tripType === 'simple' ? "Desliza: Iniciar Trabajo" : "Desliza: Vehículo en mi poder"} icon={j.tripType === 'simple' ? <Clock className="w-4 h-4"/> : <Car className="w-4 h-4"/>} colorClass="bg-indigo-600" isProcessing={processingId === `${j.id}-picked_up`} />}
                      
                      {j.phase === 'picked_up' && j.tripType !== 'revision' && <SwipeButton key={`btn-dest-${j.id}`} onConfirm={()=>{
                          setArrivalPromptJob(j); 
                          setArrivalMileage(''); 
                          setArrivalPhoto(null); 
                          setArrivalKeyLocation(''); 
                          setArrivalKeyHandedTo(''); 
                          setMenuOpenId(null);
                      }} text={j.tripType === 'simple' ? "Desliza: Finalizar Trabajo" : "Desliza: Llegué a Destino"} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${j.id}-arrived_destination`} />}
                      
                      {j.phase === 'picked_up' && j.tripType === 'revision' && <SwipeButton key={`btn-prt-${j.id}`} onConfirm={()=>updatePhase(j, 'arrived_prt')} text="Desliza: Llegué a PRT" icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${j.id}-arrived_prt`} />}
                      
                      {j.phase === 'arrived_prt' && (
                        <div className="flex gap-2">
                          <button onClick={() => { setPrtApproveType('aprobado'); setPrtReturnOpt('origin'); setPrtReturnDest(''); setPrtApprovePromptJob(j); }} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-1 disabled:opacity-50">
                             {processingId === `${j.id}-prt_done` ? <Clock className="w-3 h-3 animate-spin"/> : '✅'} Aprobado
                          </button>
                          <button onClick={() => { setPrtReturnOpt('origin'); setPrtReturnDest(''); setPrtPromptJob(j); }} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50">❌ Rechazado</button>
                        </div>
                      )}

                      {j.phase === 'prt_done' && (
                        <SwipeButton key={`btn-dest-prt-${j.id}`} onConfirm={()=>{
                            setArrivalPromptJob(j); 
                            setArrivalMileage(''); 
                            setArrivalPhoto(null); 
                            setArrivalKeyLocation(''); 
                            setArrivalKeyHandedTo(''); 
                            setMenuOpenId(null);
                        }} text={`Desliza: Llegué a ${j.checklist?.rtReturnOption === 'other' ? (j.checklist?.rtReturnDestination?.substring(0,10) + '...') : 'Origen'}`} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${j.id}-arrived_destination`} />
                      )}

                      <button onClick={()=>onStartChecklist(j)} className={`w-full font-bold py-2 rounded-xl text-xs shadow-sm transition-colors ${(j.phase === 'arrived_destination') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}>
                        📸 {(j.phase === 'arrived_destination') ? (j.tripType === 'simple' ? 'Cerrar Acta de Servicio' : 'Cerrar Checklist') : (j.tripType === 'simple' ? 'Pre-llenar Acta' : 'Pre-llenar Checklist')}
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }