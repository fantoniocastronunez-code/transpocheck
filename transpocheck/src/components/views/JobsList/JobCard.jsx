import React, { useState } from 'react';

const StatusAnimation = ({ type }) => {
  switch (type) {
    case 'searching':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2">
          <defs>
            <style>{`
              @keyframes searchAnim {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(200px); }
              }
              .lupa { animation: searchAnim 3s ease-in-out infinite; }
            `}</style>
          </defs>
          <g fill="currentColor" className="text-slate-300 dark:text-slate-600">
            <circle cx="50" cy="30" r="10" />
            <path d="M40 55 C 40 40, 60 40, 60 55 Z" />
            <circle cx="150" cy="30" r="10" />
            <path d="M140 55 C 140 40, 160 40, 160 55 Z" />
            <circle cx="250" cy="30" r="10" />
            <path d="M240 55 C 240 40, 260 40, 260 55 Z" />
          </g>
          <g className="lupa" transform="translate(10, 10)">
            <circle cx="20" cy="20" r="15" fill="none" stroke="#3B82F6" strokeWidth="4" />
            <line x1="30" y1="30" x2="45" y2="45" stroke="#3B82F6" strokeWidth="6" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 'assigned':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2">
          <defs>
            <style>{`
              @keyframes walkInAnim {
                0% { transform: translateX(-20px); opacity: 0; }
                100% { transform: translateX(130px); opacity: 1; }
              }
              .personIn { animation: walkInAnim 1s ease-out forwards; }
            `}</style>
          </defs>
          <g transform="translate(150, 0)" fill="currentColor" className="text-slate-300 dark:text-slate-600">
            <path d="M10 40 L 15 25 L 35 25 L 45 40 Z" />
            <rect x="5" y="40" width="45" height="10" rx="2" />
            <circle cx="15" cy="50" r="4" className="text-slate-400 dark:text-slate-500" />
            <circle cx="40" cy="50" r="4" className="text-slate-400 dark:text-slate-500" />
          </g>
          <g className="personIn" fill="#3B82F6">
            <circle cx="10" cy="25" r="5" />
            <path d="M 5 32 C 5 28, 15 28, 15 32 L 15 50 L 5 50 Z" />
          </g>
        </svg>
      );
    case 'transit':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2 overflow-hidden">
          <defs>
            <style>{`
              @keyframes driveAnim {
                0% { transform: translateX(-50px); }
                100% { transform: translateX(350px); }
              }
              @keyframes dashAnim {
                0% { transform: translateX(0); }
                100% { transform: translateX(-20px); }
              }
              .carMov { animation: driveAnim 4s linear infinite; }
              .streetDash { animation: dashAnim 0.5s linear infinite; }
            `}</style>
          </defs>
          <g stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="2" strokeDasharray="10 10">
            <line x1="0" y1="50" x2="320" y2="50" className="streetDash" />
          </g>
          <g className="carMov" fill="#3B82F6">
            <path d="M10 40 L 15 25 L 35 25 L 45 40 Z" />
            <rect x="5" y="40" width="45" height="10" rx="2" />
            <circle cx="15" cy="50" r="4" fill="#1E293B" />
            <circle cx="40" cy="50" r="4" fill="#1E293B" />
          </g>
        </svg>
      );
    case 'arrived':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2">
          <defs>
            <style>{`
              @keyframes driveInAnim {
                0% { transform: translateX(-100px); }
                100% { transform: translateX(110px); }
              }
              .carIn { animation: driveInAnim 1s ease-out forwards; }
            `}</style>
          </defs>
          <g transform="translate(170, 10)">
            <rect x="0" y="10" width="30" height="40" fill="currentColor" className="text-slate-400 dark:text-slate-500" rx="2" />
            <rect x="5" y="15" width="8" height="8" fill="currentColor" className="text-slate-200 dark:text-slate-700" />
            <rect x="17" y="15" width="8" height="8" fill="currentColor" className="text-slate-200 dark:text-slate-700" />
            <rect x="5" y="27" width="8" height="8" fill="currentColor" className="text-slate-200 dark:text-slate-700" />
            <rect x="17" y="27" width="8" height="8" fill="currentColor" className="text-slate-200 dark:text-slate-700" />
            <path d="M -5 10 L 15 -5 L 35 10 Z" fill="currentColor" className="text-slate-500 dark:text-slate-400" />
          </g>
          <g className="carIn" fill="#3B82F6">
            <path d="M10 40 L 15 25 L 35 25 L 45 40 Z" />
            <rect x="5" y="40" width="45" height="10" rx="2" />
            <circle cx="15" cy="50" r="4" fill="#1E293B" />
            <circle cx="40" cy="50" r="4" fill="#1E293B" />
          </g>
        </svg>
      );
    case 'prt_approved':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2 overflow-hidden">
          <defs>
            <style>{`
              @keyframes popInAnim {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes slideUpAnim {
                0% { transform: translateY(60px); }
                100% { transform: translateY(0); }
              }
              .docUp { animation: slideUpAnim 0.6s ease-out forwards; }
              .checkPop { animation: popInAnim 0.5s ease-out 0.4s forwards; opacity: 0; transform-origin: center; }
            `}</style>
          </defs>
          <g className="docUp" transform="translate(130, 10)">
            <rect x="0" y="0" width="40" height="50" fill="currentColor" className="text-slate-200 dark:text-slate-600" rx="4" />
            <line x1="10" y1="15" x2="30" y2="15" stroke="currentColor" className="text-slate-300 dark:text-slate-500" strokeWidth="2" />
            <line x1="10" y1="25" x2="25" y2="25" stroke="currentColor" className="text-slate-300 dark:text-slate-500" strokeWidth="2" />
            <line x1="10" y1="35" x2="30" y2="35" stroke="currentColor" className="text-slate-300 dark:text-slate-500" strokeWidth="2" />
          </g>
          <g className="checkPop" transform="translate(140, 20)">
            <circle cx="10" cy="10" r="16" fill="#22C55E" />
            <path d="M 4 10 L 8 14 L 16 6" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      );
    case 'prt_rejected':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2 overflow-hidden">
          <defs>
            <style>{`
              @keyframes popInRejectAnim {
                0% { transform: scale(0) rotate(-20deg); opacity: 0; }
                50% { transform: scale(1.2) rotate(10deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
              }
              @keyframes slideUpAnimR {
                0% { transform: translateY(60px); }
                100% { transform: translateY(0); }
              }
              .docUpR { animation: slideUpAnimR 0.6s ease-out forwards; }
              .crossPop { animation: popInRejectAnim 0.5s ease-out 0.4s forwards; opacity: 0; transform-origin: center; }
            `}</style>
          </defs>
          <g className="docUpR" transform="translate(130, 10)">
            <rect x="0" y="0" width="40" height="50" fill="currentColor" className="text-slate-200 dark:text-slate-600" rx="4" />
            <line x1="10" y1="15" x2="30" y2="15" stroke="currentColor" className="text-slate-300 dark:text-slate-500" strokeWidth="2" />
            <line x1="10" y1="25" x2="25" y2="25" stroke="currentColor" className="text-slate-300 dark:text-slate-500" strokeWidth="2" />
            <line x1="10" y1="35" x2="30" y2="35" stroke="currentColor" className="text-slate-300 dark:text-slate-500" strokeWidth="2" />
          </g>
          <g className="crossPop" transform="translate(140, 20)">
            <circle cx="10" cy="10" r="16" fill="#EF4444" />
            <line x1="4" y1="4" x2="16" y2="16" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <line x1="16" y1="4" x2="4" y2="16" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 'completed':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2">
          <defs>
            <style>{`
              @keyframes bounceCompleteAnim {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
              @keyframes appearStarsAnim {
                0% { opacity: 0; transform: scale(0.5); }
                100% { opacity: 1; transform: scale(1); }
              }
              .starGroup { animation: appearStarsAnim 0.8s ease-out forwards; }
              .flagBounce { animation: bounceCompleteAnim 2s ease-in-out infinite; transform-origin: bottom center; }
            `}</style>
          </defs>
          <g transform="translate(135, 10)">
            <g className="starGroup">
              <circle cx="-20" cy="10" r="2" fill="#F59E0B" />
              <circle cx="40" cy="5" r="3" fill="#F59E0B" />
              <circle cx="30" cy="35" r="2" fill="#F59E0B" />
              <circle cx="-10" cy="40" r="2.5" fill="#F59E0B" />
            </g>
            <g className="flagBounce">
              <path d="M 5 45 L 5 5" stroke="currentColor" className="text-slate-700 dark:text-slate-300" strokeWidth="3" strokeLinecap="round" />
              <path d="M 5 5 L 25 12 L 5 20 Z" fill="#22C55E" />
            </g>
          </g>
        </svg>
      );
    default:
      return null;
  }
};

export default function JobCard({ j, ...props }) {
  const [showDetails, setShowDetails] = useState(false);
  const { analyzeJobStatus, getJobIdentifier, vehicles, menuOpenId, setMenuOpenId, isAdminView, onEditJob, currentUserEmail, setRelayPromptJob, setForceCloseJob, db, updateDoc, deleteField, doc, showAlert, showConfirm, setJobToFail, latestVehiclePhotos, setFullScreenPhoto, role, processingId, setProcessingId, handleApproveRequest, handleRejectRequest, handleAcceptJob, setTrackingJobId, setGuideUploadJob, setGuideLink, setGuideFileBase64, updatePhase, setArrivalPromptJob, setArrivalMileage, setArrivalPhoto, setArrivalKeyLocation, setArrivalKeyHandedTo, setPrtApproveType, setPrtReturnOpt, setPrtReturnDest, setPrtApprovePromptJob, setPrtPromptJob, onStartChecklist, handleUndoPhase, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, WaitTimerBadge, SwipeButton, AlertCircle, Edit2, MoreVertical, Navigation, Share2, Users, CheckCircle, Truck, X, XCircle, Clock, Car, MapPin, FileText, RefreshCw } = props;
    const { isRequested, isPending, isAccepted, isPendingGuide, step2Done, step3Done, step4Done } = analyzeJobStatus(j);
    
    const ident = getJobIdentifier(j);



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
      <div key={j.id} className={`bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-[2rem] border p-4 sm:p-5 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.15)] relative hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-default group ${j.isUrgent ? 'border-red-400/50 ring-2 ring-red-400/30' : (j.fleetGroup ? 'border-indigo-400/50' : 'border-white/20')} ${menuOpenId === j.id ? 'z-50' : 'z-10'}`}>
        
        {/* --- OPTIMIZACIÓN: Los fondos decorativos ahora viven en un contenedor con overflow-hidden para no salirse de los bordes redondeados --- */}
        <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
            {/* Efecto de luz ambiental en la esquina */}
            <div className={`absolute -right-16 -top-16 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${isRequested ? 'bg-pink-500' : (isPending ? 'bg-amber-500' : 'bg-blue-500')}`}></div>
            {/* Borde izquierdo iluminado con gradiente */}
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 transition-all ${isRequested ? 'bg-gradient-to-b from-pink-400 to-pink-600' : (isPending ? 'bg-gradient-to-b from-amber-300 to-amber-500' : 'bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]')}`}></div>
        </div>
        
        <div className="flex justify-between items-start mb-5 border-b border-white/10 pb-4 pl-2 relative z-20">
          <div className="flex flex-col gap-3 w-full">
            <div className="flex justify-between items-start w-full gap-2">
              <div className="shrink-0 relative z-10 flex flex-col items-end gap-1">
                {j.isUrgent && (
                   <span className="bg-red-500 text-white border border-red-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm max-w-[150px] text-center leading-tight mb-1 flex items-center gap-1 animate-pulse">
                     <AlertCircle className="w-3 h-3"/> URGENTE
                   </span>
                )}
                {j.tripType === 'simple' && (
                   <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm max-w-[150px] text-center leading-tight mb-1">SERVICIO</span>
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
                   <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm max-w-[150px] text-center leading-tight mb-1 flex items-center gap-1 animate-pulse">
                     <AlertCircle className="w-3 h-3"/> NOTA EN RUTA
                   </span>
                )}
              </div>
              
              <div className="flex items-center gap-1 relative shrink-0 z-50">
                {isAdminView && <button onClick={()=>onEditJob(j)} className="p-2 bg-white/40 dark:bg-black/40 text-blue-600 dark:text-blue-400 hover:bg-white/60 dark:hover:bg-black/60 rounded-xl transition-colors backdrop-blur-sm border border-white/20 shadow-sm"><Edit2 className="w-5 h-5"/></button>}
                <button onClick={()=>setMenuOpenId(menuOpenId===j.id?null:j.id)} className="p-2 bg-white/40 dark:bg-black/40 text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-black/60 rounded-xl transition-colors backdrop-blur-sm border border-white/20 shadow-sm"><MoreVertical className="w-5 h-5"/></button>
                {/* --- OPTIMIZACIÓN: z-[999] para aplastar cualquier capa inferior --- */}
                {menuOpenId===j.id && (
                  <div className="absolute right-0 top-10 bg-white/20 dark:bg-black/50 backdrop-blur-lg border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.3)] rounded-xl w-56 z-[999] overflow-hidden text-xs dark:text-slate-200">
                    <button onClick={() => {
                      const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                      const textToShare = `📍 Sigue en tiempo real todos los traslados de ${j.client || 'tu empresa'} aquí:\n${url}`;
                      const textArea = document.createElement("textarea");
                      textArea.value = textToShare; textArea.style.position = "fixed"; document.body.appendChild(textArea);
                      textArea.focus(); textArea.select();
                      try { document.execCommand('copy'); showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!"); } catch(e) {}
                      document.body.removeChild(textArea); setMenuOpenId(null);
                    }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"><Navigation className="w-4 h-4"/> Portal Cliente</button>
                    
                    {isAccepted && (
                      <button onClick={() => {
                        const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                        const textToShare = `📍 Hola! El vehículo ${ident} va en camino a ${j.destination || 'su destino'}. Puedes seguir el traslado en tiempo real aquí:\n${url}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank');
                        setMenuOpenId(null);
                      }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-t border-slate-50 dark:border-slate-700/50"><Share2 className="w-4 h-4"/> Notificar Receptor</button>
                    )}


                    {/* NUEVO BOTÓN: DESHACER PASO */}
                    {isAccepted && j.phase && j.phase !== 'claimed' && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={() => handleUndoPhase(j)} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-t border-slate-50 dark:border-slate-700/50">
                        <RefreshCw className="w-4 h-4"/> Deshacer último paso
                      </button>
                    )}

                    {/* El botón de traspaso solo es visible para el dueño del trabajo o un admin */}
                    {isAccepted && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={() => { setRelayPromptJob(j); setMenuOpenId(null); }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-t border-slate-50 dark:border-slate-700/50"><Users className="w-4 h-4"/> Traspaso a Compañero</button>
                    )}
                    
                    {isAdminView && (
                      <button onClick={() => { setForceCloseJob(j); setMenuOpenId(null); }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-t border-slate-50 dark:border-slate-700/50">
                        <CheckCircle className="w-4 h-4"/> Forzar Cierre
                      </button>
                    )}

                    {isAdminView && j.fleetGroup && (
                       <button onClick={() => {
                          showConfirm("¿Quitar este vehículo del grupo de flota?", async () => {
                             try { await updateDoc(doc(db, 'transport_jobs', j.id), { fleetGroup: deleteField() }); setMenuOpenId(null); showAlert("Vehículo removido de la flota."); } catch (e) { showAlert("Error al desagrupar."); }
                          });
                       }} className="w-full text-left p-3 font-bold flex gap-2 hover:bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-t border-slate-50 dark:border-slate-700/50">
                          <Truck className="w-4 h-4"/> Quitar de Flota
                       </button>
                    )}
                    
                    {isAccepted && (!j.phase || j.phase === 'claimed' || j.phase === 'arrived_pickup') && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={() => { showConfirm("¿Deseas cancelar la aceptación?", async () => { try { await updateDoc(doc(db, 'transport_jobs', j.id), { status: 'pending', acceptedByEmail: deleteField(), phase: deleteField(), liveLocation: deleteField(), arrivedPickupAt: deleteField(), waitTimeMinutes: deleteField() }); setMenuOpenId(null); showAlert("✅ Traslado liberado."); } catch (err) { showAlert("Error al liberar."); } }); }} className="w-full text-left p-3 font-bold flex gap-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:bg-amber-900/30 border-t border-slate-50 dark:border-slate-700/50">
                        <X className="w-4 h-4"/> Cancelar Aceptación (Soltar)
                      </button>
                    )}

                    {(isAdminView || j.acceptedByEmail === currentUserEmail) && (
                      <button onClick={()=>{setJobToFail(j);setMenuOpenId(null);}} className="w-full text-left p-3 font-bold flex gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/30 border-t border-slate-50 dark:border-slate-700/50"><XCircle className="w-4 h-4"/> Cancelar / Falló</button>
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
                         className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                      />
                   );
                })()}
                <div>
                    {j.tripType === 'simple' ? (
                       <p className="text-lg font-black text-purple-800 dark:text-purple-300 leading-tight mt-1 break-words pr-2">{j.description || 'Servicio en Terreno'}</p>
                    ) : (
                       <p className="text-xl font-black text-slate-800 dark:text-slate-200 leading-tight mt-1 break-words pr-2">{j.brand} {j.model}</p>
                    )}
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide flex items-center flex-wrap gap-2">
                       {j.client}
                       {j.fleetGroup && <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[9px] font-black border border-indigo-200 dark:border-indigo-800/50">EN FLOTA (CONVOY)</span>}
                    </p>
                    {j.createdBy && (
                       <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 mt-0.5">Creado por: {j.createdBy}</p>
                    )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 mt-3 relative z-10 flex flex-col gap-1.5">
            {/* ORIGEN */}
            <div className="bg-white/20 dark:bg-black/40 backdrop-blur-sm p-2.5 rounded-xl border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.05)] z-10">
              <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                {j.tripType === 'simple' ? 'Lugar' : 'Desde'}
              </span>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-snug break-words">{j.origin || 'Por definir'}</p>
            </div>

            {(j.destination || j.tripType !== 'simple') && (
              <>
                {/* ICONO CENTRAL O 1ra PARADA PRT */}
                <div className="flex justify-center -my-2.5 z-20">
                  {j.tripType === 'revision' ? (
                     <div className="bg-amber-100 dark:bg-amber-900/40 px-3 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-sm text-center max-w-[80%]">
                       <p className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase truncate">1ra Parada: {j.destination ? j.destination.split(' -> ')[0] : 'PRT'}</p>
                     </div>
                  ) : j.waypoints && j.waypoints.length > 0 ? (
                     <div className="bg-amber-100 dark:bg-amber-900/40 px-3 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-sm text-center">
                       <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">{j.waypoints.length} paradas</p>
                     </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-500 dark:text-slate-400 shadow-sm">
                      <Navigation className="w-3 h-3 rotate-180" />
                    </div>
                  )}
                </div>

                {/* DESTINO */}
                <div className="bg-white/20 dark:bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.1)] z-10">
                  <span className="flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    Hasta
                  </span>
                  <p className="text-sm font-extrabold text-blue-700 dark:text-blue-400 leading-snug break-words whitespace-normal">
                    {j.tripType === 'revision' ? getRtFinalDestination(j) : (j.destination || 'Por definir')}
                  </p>
                </div>
              </>
            )}
            
            {j.waypoints && j.waypoints.length > 0 && (
              <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3"/> Ruta intermedia:</p>
                <div className="flex flex-col gap-1">
                  {j.waypoints.map((wp, i) => (
                     <span key={i} className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-snug break-words"><span className="font-black mr-1 text-slate-400">{i + 1}.</span> {wp}</span>
                  ))}
                </div>
              </div>
            )}

            {/* CONTACTOS, DIRECCIONES Y NAVEGACIÓN INTELIGENTE */}
            {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone || j.originAddress || j.originCommune || j.destContactName || j.destContactPhone || j.destAddress || j.destCommune) && (
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/40 p-2.5 rounded-xl border border-white/20 dark:border-slate-800/60 transition-colors text-slate-600 dark:text-slate-300 font-bold text-xs mt-1 shadow-[0_2px_8px_rgba(0,0,0,0.05)] backdrop-blur-sm"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" /> Contactos y Direcciones
                </span>
                <span className="text-slate-400 text-[10px] uppercase">
                  {showDetails ? 'Ocultar' : 'Ver todo'}
                </span>
              </button>
            )}
            
            {showDetails && (
            <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              
              {/* BLOQUE ORIGEN */}
              {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone || j.originAddress || j.originCommune) && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 dark:border-slate-800/60 flex flex-col gap-2">
                   {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone) && (
                   <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                     <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg shrink-0 border border-emerald-100 dark:border-emerald-800/50"><Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5 truncate">Encargado Origen</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{j.originContactName || j.contactName || 'No especificado'}</p>
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
                      <div className="flex justify-between items-center bg-white/20 dark:bg-black/40 backdrop-blur-sm p-2.5 rounded-xl border border-white/20 shadow-sm mt-1">
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate mr-2 ml-1"><MapPin className="w-3 h-3 inline mr-1 text-slate-400 dark:text-slate-500 dark:text-slate-400"/>{j.originAddress}{j.originAddress && j.originCommune ? ', ' : ''}{j.originCommune}</p>
                        {isAccepted && (
                          <a href={`https://waze.com/ul?q=${encodeURIComponent(`${j.originAddress || ''} ${j.originCommune || ''}`)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-colors border border-blue-200 dark:border-blue-800/50"><Navigation className="w-3 h-3"/> Waze</a>
                        )}
                      </div>
                   )}
                </div>
              )}

              {/* BLOQUE DESTINO */}
              {(j.destContactName || j.destContactPhone || j.destAddress || j.destCommune) && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-col gap-2">
                   {(j.destContactName || j.destContactPhone) && (
                   <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                     <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg shrink-0 border border-blue-100 dark:border-blue-800/50"><Users className="w-4 h-4 text-blue-600 dark:text-blue-400"/></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5 truncate">Encargado Destino</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{j.destContactName || 'No especificado'}</p>
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
                      <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/10 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-sm animate-in fade-in slide-in-from-top-1 mt-1">
                        <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 truncate mr-2 ml-1"><MapPin className="w-3 h-3 inline mr-1 text-blue-500 dark:text-blue-400"/>{j.destAddress}{j.destAddress && j.destCommune ? ', ' : ''}{j.destCommune}</p>
                        {isAccepted && (
                          <a href={`https://waze.com/ul?q=${encodeURIComponent(`${j.destAddress || ''} ${j.destCommune || ''}`)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-md transition-colors"><Navigation className="w-3 h-3"/> Waze</a>
                        )}
                      </div>
                   )}
                </div>
              )}
            </div>
            )}
          </div>

          {j.tripType === 'revision' && <div className="mb-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 p-2 rounded-xl text-center shadow-sm"><span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">REVISIÓN TÉCNICA (TIPO {j.rtData?.type})</span></div>}
          {j.tripType === 'viaje' && <div className="mb-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-2 mb-3 text-center shadow-sm"><span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">A Regiones</span></div>}
          
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
                 return <div className="mb-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">📅 HOY{timeStr}</span></div>;
             }
             if (diffDays === 1) return <div className="mb-3 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800/50 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-cyan-700 dark:text-cyan-400 uppercase tracking-widest">📅 Mañana{timeStr}</span></div>;
             if (diffDays > 1) return <div className="mb-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">📅 Para el {d}/{m}/{y}{timeStr}</span></div>;
             
             // Si ya pasó la fecha planificada pero el viaje ESTÁ EN PROCESO, evitamos el rojo
             if (isStarted) return <div className="mb-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">🚀 EN RUTA ({d}/{m}/{y})</span></div>;

             // Si se pasó la fecha, no ha iniciado y sigue activo, se trata visualmente como HOY (Reprogramación automática)
             if (!j.scheduledTime) return null;
             return <div className="mb-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 p-3 rounded-xl text-center shadow-sm"><span className="text-sm font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">📅 HOY{timeStr}</span></div>;
          })()}

          {(() => {
             let statusIcon = <CheckCircle className="w-4 h-4 text-blue-500"/>;
             let statusTitle = isAccepted ? (j.assignedDrivers?.find(d => d.email === j.acceptedByEmail)?.name || "Conductor") : "Buscando conductor";
             let statusSub = isAccepted ? (j.tripType === 'simple' ? `Asignado a ${j.origin}` : `Retira en ${j.origin}`) : `Para ${j.origin}`;
             let highlight = false;
             let animationType = 'searching';

             if (j.tripType === 'revision' && step4Done) {
                statusTitle = j.prt_result === 'rechazado' ? 'Revisión Rechazada' : 'Revisión Aprobada';
                statusIcon = <CheckCircle className={`w-4 h-4 ${j.prt_result === 'rechazado' ? 'text-red-500' : 'text-green-500'}`}/>;
                statusSub = `En camino a: ${getRtFinalDestination(j)}`;
                highlight = true;
                animationType = j.prt_result === 'rechazado' ? 'prt_rejected' : 'prt_approved';
             } else if (step3Done) {
                statusTitle = j.tripType === 'simple' ? 'Trabajo Terminado' : (j.tripType === 'revision' ? 'En PRT' : 'Llegada a Destino');
                statusSub = j.tripType === 'simple' ? (j.destination || '') : (j.tripType === 'revision' ? 'Planta' : j.destination);
                highlight = true;
                animationType = (j.tripType === 'simple' || j.phase === 'arrived_destination' || step4Done) ? 'completed' : 'arrived';
             } else if (step2Done) {
                statusTitle = j.tripType === 'simple' ? 'Realizando Trabajo' : 'Vehículo en Tránsito';
                statusSub = '';
                highlight = true;
                animationType = 'transit';
             } else if (isAccepted) {
                animationType = 'assigned';
             }
             
             return (
               <div className="mb-4 bg-white/40 dark:bg-black/20 backdrop-blur-sm border border-white/30 dark:border-slate-800 pt-1 pb-3 px-3 rounded-xl shadow-sm flex flex-col">
                 <StatusAnimation type={animationType} />
                 <div className="flex items-center gap-3 w-full border-t border-white/20 dark:border-slate-800/60 pt-2">
                   <div className={`p-2 rounded-full shrink-0 ${highlight ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                     {statusIcon}
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200 truncate">{statusTitle}</p>
                     {statusSub && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{statusSub}</p>}
                   </div>
                 </div>
               </div>
             );
          })()}

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
            }} className="bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 p-2.5 rounded-xl border border-red-200 dark:border-red-800/50 shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0" title="Cancelar Timer">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

 
        {/* NUEVO: PANEL DE ALERTA DE DOCUMENTOS VENCIDOS O POR VENCER */}
        {expiringDocs.length > 0 && (
          <div className="mb-2 mt-3 bg-red-50 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-800/50 p-3 rounded-xl shadow-sm animate-in fade-in">
             <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
               <AlertCircle className="w-4 h-4" /> Alerta de Documentos
             </p>
             <ul className="text-xs font-bold text-red-800 dark:text-red-300 space-y-1">
               {expiringDocs.map((docAlert, idx) => (
                 <li key={idx} className="bg-white dark:bg-slate-900 px-2 py-1 rounded-md border border-red-100 dark:border-red-800/50">{docAlert}</li>
               ))}
             </ul>
          </div>
        )}

        {(() => {
           const activeDocHref = j.guideLink || j.guideUrl || j.docLink || j.docUrl || j.rtLink || j.rtDoc || (j.rtData && j.rtData.link) || j.pdfUrl || j.fileUrl || j.checklist?.guiaDespachoPdf || j.checklist?.guiaDespachoLink;
           if (activeDocHref) {
             return (
               <div className="mt-3">
                 <a href={activeDocHref} target="_blank" rel="noreferrer" className="w-full bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-100 dark:bg-cyan-900/40 font-bold py-2.5 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-2">
                    <FileText className="w-4 h-4"/> Ver Doc. Adjunto (Guía / RT)
                 </a>
               </div>
             );
           }
           return null;
        })()}

        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          {isRequested && (
            <>
              {isAdminView ? (
                <div className="flex gap-2">
                  <button onClick={() => handleApproveRequest(j)} disabled={processingId === `${j.id}-approve`} className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-1 disabled:opacity-50">
                    {processingId === `${j.id}-approve` ? <Clock className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>} {processingId === `${j.id}-approve` ? 'Procesando...' : 'Aprobar'}
                  </button>
                  <button onClick={() => handleRejectRequest(j)} className="flex-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-400 font-bold py-3 rounded-xl text-xs shadow-sm transition-colors flex justify-center items-center gap-1">
                    <XCircle className="w-4 h-4"/> Rechazar
                  </button>
                </div>
              ) : (
                <div className="bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800/50 text-pink-700 dark:text-pink-400 text-xs font-bold text-center py-3 rounded-xl flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> Pendiente de Aprobación
                </div>
              )}
            </>
          )}

          {(!isRequested && (j.status === 'accepted' || j.status === 'pending_guide') && j.acceptedByEmail !== currentUserEmail) ? (
             <div className="bg-white/10 dark:bg-black/30 backdrop-blur-sm border border-white/20 text-slate-600 dark:text-slate-300 text-xs font-bold text-center py-3 rounded-xl">Vehículo a cargo de un compañero.</div>
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
                       <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 text-[11px] font-black text-center py-3 rounded-xl animate-pulse flex items-center justify-center gap-1.5 shadow-sm">
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
                             {processingId === `${j.id}-prt_done` ? <Clock className="w-3 h-3 animate-spin"/> : '✅'} {processingId === `${j.id}-prt_done` ? 'Procesando...' : 'Aprobado'}
                          </button>
                          <button onClick={() => { setPrtReturnOpt('origin'); setPrtReturnDest(''); setPrtPromptJob(j); }} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50 flex justify-center items-center gap-1">
                             {processingId === `${j.id}-prt_done` ? <Clock className="w-3 h-3 animate-spin"/> : '❌'} {processingId === `${j.id}-prt_done` ? 'Procesando...' : 'Rechazado'}
                          </button>
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

                      <button onClick={()=>onStartChecklist(j)} className={`w-full font-bold py-2 rounded-xl text-xs shadow-sm transition-colors ${(j.phase === 'arrived_destination') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
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