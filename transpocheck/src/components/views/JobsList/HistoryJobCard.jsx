import React from 'react';
export default function HistoryJobCard({ j, ...props }) {
  const { drivers, getJobIdentifier, setSelectedHistoryJob, latestVehiclePhotos, setFullScreenPhoto, auditMode, isAdminView, setEditDateJob, setEditKmJob, setEditDriverJob, handleSingleRecalculate, processingId, onEditJob, handleDuplicateJob, generatePDF, handleShareWhatsAppPDF, handleDeleteJob, updateDoc, doc, deleteField, db, showConfirm, showAlert, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, AlertCircle, Navigation, Edit2, MapPin, FileText, Clock, MapIcon, CheckCircle, Repeat, FileDown, Trash2, Share2 } = props;
  const drv = drivers?.find(d => d.email === j.acceptedByEmail);
  const driverName = drv ? drv.name : (j.checklist?.assignedDriverName || j.acceptedByEmail || 'No registrado');
  const isFailed = j.status === 'failed';
  const ident = getJobIdentifier(j);

  return (
    <div key={j.id} onClick={() => setSelectedHistoryJob(j)} className="bg-slate-900/40 p-4 rounded-2xl shadow-xl border border-white/5 backdrop-blur-md flex flex-col justify-between relative hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden mt-3">
      
      {/* Side Status Bar */}
      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>

      {/* Header: Photo & Title & Plate */}
      <div className="flex justify-between items-start mb-4 pl-2 gap-3">
        <div className="flex gap-3 overflow-hidden items-center flex-1">
          {/* Photo Thumbnail */}
          {(() => {
            const displayPhoto = j.checklist?.photos?.front || latestVehiclePhotos[ident];
            if (!displayPhoto) return null;
            return (
              <img
                src={displayPhoto}
                alt="Frente"
                onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(displayPhoto); }}
                className="w-12 h-12 rounded-lg object-cover border border-slate-700/50 shadow-md cursor-pointer hover:opacity-80 transition-opacity shrink-0"
              />
            );
          })()}
          <div className="flex-1 min-w-0">
             {ident !== 'S/N' && (
                <div className="mb-1 transform scale-90 origin-left">
                  <LicensePlateBadge text={ident} />
                </div>
             )}
             {j.tripType === 'simple' ? (
                <p className="text-[14px] font-black uppercase text-purple-300 leading-tight break-words pr-2">{j.description || 'Servicio en Terreno'}</p>
             ) : (
                <p className="text-[14px] font-black uppercase text-white leading-tight break-words pr-2">{j.brand} {j.model}</p>
             )}
             <p className="text-[11px] font-bold text-slate-400 truncate">Conductor: <span className="text-slate-200">{driverName}</span></p>
          </div>
        </div>

        {/* Date / Status */}
        <div className="flex flex-col items-end shrink-0 gap-1.5">
           <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ${isFailed ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
             {isFailed ? 'RECHAZADO' : 'ENTREGADO'}
           </div>
           <div className="flex items-center gap-1">
             <p className="text-slate-400 font-bold text-[10px]">{new Date(j.completedAt || j.createdAt).toLocaleDateString('es-CL')}</p>
             {isAdminView && auditMode && (
               <button onClick={(e) => { e.stopPropagation(); setEditDateJob(j); }} className="text-blue-400 hover:bg-blue-900/30 p-1 rounded transition-colors" title="Corregir Fecha">
                 <Edit2 className="w-3 h-3" />
               </button>
             )}
           </div>
        </div>
      </div>

      {isFailed && <p className="text-red-400 text-[11px] mb-3 ml-2 font-bold line-clamp-2">Razón: {j.failedReason}</p>}

      {/* Main Content Area: Timeline + Stats */}
      <div className="flex gap-3 mb-4 pl-2">
        {/* Timeline (Left side) */}
        <div className="flex-1 relative pl-[20px] flex flex-col gap-3 py-1 justify-center">
           {/* Connecting Line */}
           <div className="absolute left-[3.5px] top-2 bottom-2 w-[2px] bg-slate-700/80 z-10"></div>
           
           {/* Origin */}
           <div className="relative z-20 flex items-start gap-2">
              <div className="absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-[#1a1e27] shadow-sm"></div>
              <span className="text-[11px] font-bold text-slate-300 leading-tight break-words">{j.origin || '-'}</span>
           </div>

           {/* Waypoints / PRT */}
           {(j.waypoints?.length > 0 || j.tripType === 'revision') && (
             <div className="relative z-20 flex items-start gap-2">
                <div className="absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-[#1a1e27] shadow-sm"></div>
                <span className="text-[10px] font-black text-amber-500 leading-tight break-words uppercase">
                  {j.tripType === 'revision' ? (j.destination?.includes('->') ? (j.destination.split('->').length > 2 ? j.destination.split('->')[1].trim() : j.destination.split('->')[0].trim()) : 'PRT') : `${j.waypoints.length} PARADAS`}
                </span>
             </div>
           )}

           {/* Destination */}
           <div className="relative z-20 flex items-start gap-2">
              <div className="absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#1a1e27] shadow-sm"></div>
              <span className="text-[11px] font-bold text-blue-300 leading-tight break-words">
                 {j.tripType === 'revision'
                      ? (j.destination?.includes('->')
                          ? j.destination.split('->')[j.destination.split('->').length - 1].trim()
                          : (j.checklist?.rtReturnOption === 'other' && j.checklist?.rtReturnDestination
                            ? j.checklist.rtReturnDestination
                            : j.checklist?.rtReturnOption === 'origin'
                              ? j.origin
                              : (j.destination && !j.destination.toLowerCase().includes('prt') ? j.destination : (j.origin || 'Por definir'))))
                      : (j.destination || '-')}
              </span>
           </div>
        </div>

        {/* Stats Glass Box (Right side) */}
        <div className="w-[110px] shrink-0 flex flex-col gap-2 bg-[#1c2235] p-2.5 rounded-xl border border-[#2a3441] shadow-inner justify-center">
           <div className="flex flex-col items-center text-center">
              <Clock className="w-3.5 h-3.5 text-blue-400 mb-1" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">Tiempo</span>
              <span className="text-xs font-bold text-white leading-tight">
                {(() => {
                  const endTime = j.arrivedDestinationAt || j.completedAt || Date.now();
                  const startTime = j.pickedUpAt || j.createdAt || endTime;
                  const diffMs = endTime - startTime;
                  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
                  const hrs = Math.floor(diffMins / 60);
                  const mins = diffMins % 60;
                  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;
                })()}
              </span>
           </div>
           
           <div className="w-full h-px bg-slate-700/50 my-0.5"></div>
           
           <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-1 mb-1">
                 <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                 {isAdminView && auditMode && (
                   <button onClick={(e) => { e.stopPropagation(); handleSingleRecalculate(j); }} disabled={processingId === `${j.id}-recalc-km`} className="text-blue-400 hover:text-blue-300 disabled:opacity-50">
                     {processingId === `${j.id}-recalc-km` ? <Clock className="w-3 h-3 animate-spin" /> : <MapIcon className="w-3 h-3" />}
                   </button>
                 )}
              </div>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">Distancia</span>
              <span className="text-xs font-bold text-white leading-tight truncate w-full">
                {j.drivenDistance || 'No calc'}
              </span>
           </div>
        </div>
      </div>

      {/* AVISO VISUAL DE ACTA YA COMPARTIDA/RENDIDA */}
      {j.sharedCount > 0 && (
        <div className="mb-3 bg-[#0f172a] border border-emerald-900/50 text-emerald-400 text-[10px] font-bold px-2 py-1.5 rounded-lg text-center flex items-center justify-center gap-1.5 shadow-sm">
          <CheckCircle className="w-3.5 h-3.5" /> Acta Rendida ({j.sharedCount} {j.sharedCount === 1 ? 'vez' : 'veces'})
        </div>
      )}

      {/* NUEVO: SELECTOR RÁPIDO DE PRT PARA ADMIN */}
      {isAdminView && j.tripType === 'revision' && (j.status === 'completed' || j.status === 'failed') && (
        <div className="mb-3 bg-[#1c2235] border border-[#2a3441] rounded-xl p-2 flex flex-col gap-1.5 shadow-inner">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Auditar Resultado PRT:</span>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); showConfirm("¿Aprobado Legal?", async () => { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado' }, status: 'completed', failedReason: deleteField() }); }); }}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'aprobado' || j.checklist?.rtStatus === 'aprobado' ? 'bg-green-600 text-white shadow-sm' : 'bg-[#0f172a] border border-slate-700 text-slate-400 hover:text-green-400'}`}>Legal</button>
            <button
              onClick={(e) => { e.stopPropagation(); showConfirm("¿Aprobado con Ayuda?", async () => { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado_ayuda', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado_ayuda' }, status: 'completed', failedReason: deleteField() }); }); }}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'aprobado_ayuda' || j.checklist?.rtStatus === 'aprobado_ayuda' ? 'bg-amber-600 text-white shadow-sm' : 'bg-[#0f172a] border border-slate-700 text-slate-400 hover:text-amber-400'}`}>Ayuda</button>
            <button
              onClick={(e) => { e.stopPropagation(); showConfirm("¿Rechazado?", async () => { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'rechazado', checklist: { ...(j.checklist || {}), rtStatus: 'rechazado' }, status: 'failed', failedReason: 'Rechazo en Planta PRT (Editado por Admin)' }); }); }}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'rechazado' || j.checklist?.rtStatus === 'rechazado' ? 'bg-red-600 text-white shadow-sm' : 'bg-[#0f172a] border border-slate-700 text-slate-400 hover:text-red-400'}`}>Rechazo</button>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-1.5 mt-auto border-t border-slate-700/50 pt-3">
        {isAdminView && <button onClick={(e) => { e.stopPropagation(); onEditJob(j); }} className="flex-1 py-2 flex justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/50" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>}
        {isAdminView && <button onClick={(e) => { e.stopPropagation(); handleDuplicateJob(j); }} className="flex-1 py-2 flex justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/50" title="Repetir"><Repeat className="w-3.5 h-3.5" /></button>}

        {j.checklist && (j.checklist.scandocPdf || j.checklist.scandocPdfInbox || j.checklist.scannerLink) && (
          <a href={j.checklist.scandocPdf || j.checklist.scandocPdfInbox || j.checklist.scannerLink} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="flex-1 py-2 flex justify-center items-center bg-indigo-900/40 hover:bg-indigo-800/50 text-indigo-400 rounded-lg transition-colors border border-indigo-800/50" title="Ver Documentación PRT">
            <span className="sr-only">PRT</span><FileText className="w-3.5 h-3.5" />
          </a>
        )}

        {(() => {
          const historyDocHref = j.guideLink || j.guideUrl || j.docLink || j.docUrl || j.rtLink || j.rtDoc || (j.rtData && j.rtData.link) || j.pdfUrl || j.fileUrl || j.checklist?.guiaDespachoPdf || j.checklist?.guiaDespachoLink;
          if (historyDocHref) {
            return (
              <a href={historyDocHref} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="flex-1 py-2 flex justify-center items-center bg-cyan-900/40 hover:bg-cyan-800/50 text-cyan-400 rounded-lg transition-colors border border-cyan-800/50" title="Ver Guía/Doc Adjunto">
                <span className="sr-only">GUÍA</span><FileText className="w-3.5 h-3.5" />
              </a>
            );
          }
          return null;
        })()}

        <button onClick={(e) => { e.stopPropagation(); generatePDF(j); }} disabled={processingId === `${j.id}-pdf`} className="flex-1 py-2 flex justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/50 disabled:opacity-50" title="Descargar PDF">{processingId === `${j.id}-pdf` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}</button>
        <button onClick={(e) => { e.stopPropagation(); handleShareWhatsAppPDF(j); }} disabled={processingId === `${j.id}-wapp`} className="flex-1 py-2 flex justify-center items-center bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-400 rounded-lg transition-colors border border-emerald-800/50 disabled:opacity-50" title="Compartir PDF por WhatsApp">
          {processingId === `${j.id}-wapp` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
        {isAdminView && <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(j.id); }} className="flex-1 py-2 flex justify-center bg-red-900/40 hover:bg-red-800/50 text-red-400 rounded-lg transition-colors border border-red-800/50" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
    </div>
  );
}