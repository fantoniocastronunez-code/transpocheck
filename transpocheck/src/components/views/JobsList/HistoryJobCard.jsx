import React from 'react';
export default function HistoryJobCard({ j, ...props }) {
  const { drivers, getJobIdentifier, setSelectedHistoryJob, latestVehiclePhotos, setFullScreenPhoto, auditMode, isAdminView, setEditDateJob, setEditKmJob, handleSingleRecalculate, processingId, onEditJob, handleDuplicateJob, generatePDF, handleShareWhatsAppPDF, handleDeleteJob, updateDoc, doc, deleteField, db, showConfirm, showAlert, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, AlertCircle, Navigation, Edit2, MapPin, FileText, Clock, MapIcon, CheckCircle, Repeat, FileDown, Trash2, Share2 } = props;
    const drv = drivers?.find(d => d.email === j.acceptedByEmail);
    const driverName = drv ? drv.name : (j.checklist?.assignedDriverName || j.acceptedByEmail || 'No registrado');
    const isFailed = j.status === 'failed';
    const ident = getJobIdentifier(j);
    
    return (
      <div key={j.id} onClick={() => setSelectedHistoryJob(j)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between relative pl-5 overflow-hidden hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer">
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isFailed ? 'bg-red-500' : 'bg-green-500'}`}></div>
        
        <div className="flex justify-between items-center mb-2 gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
             {/* NUEVO: Miniatura con inteligencia histórica */}
             {(() => {
                 const displayPhoto = j.checklist?.photos?.front || latestVehiclePhotos[ident];
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
             {j.tripType === 'simple' ? (
                <p className="text-sm font-black text-purple-800 leading-tight break-words mt-1 pr-2">{j.description || 'Servicio en Terreno'}</p>
             ) : (
                <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight break-words mt-1 pr-2">{j.brand} {j.model}</p>
             )}
          </div>
          <div className="flex flex-col items-end shrink-0 gap-1">
             {j.checklist?.transitNotes && (
                <span className="bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm mb-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> NOTA EN RUTA</span>
             )}
             {j.tripType === 'simple' && (
                <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm mb-0.5">SERVICIO</span>
             )}
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2 mb-3 shadow-inner">
          {/* Fila de Ruta: Origen y Destino (Vertical) */}
          <div className="flex flex-col gap-1.5 w-full">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-2">
               <div className="mt-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div></div>
               <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 leading-tight break-words whitespace-normal">{j.origin || '-'}</span>
            </div>
            
            <div className="flex justify-center -my-1.5 z-10 relative">
               {j.waypoints && j.waypoints.length > 0 ? (
                 <div className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-md border border-amber-200">{j.waypoints.length} int.</div>
               ) : (
                 <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700"><Navigation className="w-3 h-3 text-slate-400 rotate-180"/></div>
               )}
            </div>

            {j.tripType === 'revision' ? (
                <>
                   <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-100 shadow-sm flex items-start gap-2">
                      <div className="mt-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]"></div></div>
                      <span className="text-[10px] font-black text-amber-700 leading-tight break-words whitespace-normal">
                         {j.destination?.includes('->') ? (j.destination.split('->').length > 2 ? j.destination.split('->')[1].trim() : j.destination.split('->')[0].trim()) : 'PRT'}
                      </span>
                   </div>

                   <>
                      <div className="flex justify-center -my-1.5 z-10 relative">
                         <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700"><Navigation className="w-3 h-3 text-slate-400 rotate-180"/></div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-blue-100 shadow-sm flex items-start gap-2">
                         <div className="mt-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.6)]"></div></div>
                         <span className="text-[10px] font-black text-blue-700 leading-tight break-words whitespace-normal">
                            {j.destination?.includes('->') 
                               ? j.destination.split('->')[j.destination.split('->').length - 1].trim()
                               : (j.checklist?.rtReturnOption === 'other' && j.checklist?.rtReturnDestination 
                                  ? j.checklist.rtReturnDestination 
                                  : j.checklist?.rtReturnOption === 'origin' 
                                    ? j.origin 
                                    : (j.destination && !j.destination.toLowerCase().includes('prt') ? j.destination : (j.origin || 'Por definir')))}
                         </span>
                      </div>
                   </>
                </>
            ) : (
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-blue-100 shadow-sm flex items-start gap-2">
                   <div className="mt-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.6)]"></div></div>
                   <span className="text-[10px] font-black text-blue-700 leading-tight break-words whitespace-normal">{j.destination || '-'}</span>
                </div>
            )}
          </div>

          {/* Fila de Patente Agrandada al Máximo en el Centro de la caja */}
          {ident !== 'S/N' && (
            <div className="flex flex-col items-center border-t border-slate-200 dark:border-slate-700/60 pt-4 mt-2 gap-2 pb-1">
              {/* Usamos tu componente original que ya funciona perfecto, pero lo escalamos un 40% */}
              <div className="transform scale-[1.4] origin-center my-2">
                <LicensePlateBadge text={ident} />
              </div>
              
              {j.vin && ident !== j.vin && (
                <div className="mt-2"><VinPlateBadge vin={j.vin} /></div>
              )}
            </div>
          )}
        </div>

        <div className="mb-3">
           <p className="text-blue-600 font-extrabold text-[10px] uppercase tracking-wide truncate">Conductor: <span className="text-slate-700 dark:text-slate-300">{driverName}</span></p>
           {isFailed && <p className="text-red-600 text-[10px] mt-0.5 font-bold line-clamp-1">Razón: {j.failedReason}</p>}
        </div>
        
        <div className="flex justify-between items-end border-t border-slate-50 pt-2 mb-2">
          <p className={`text-[10px] font-black uppercase ${isFailed ? 'text-red-500' : 'text-green-600'}`}>{isFailed ? 'RECHAZADO' : 'ENTREGADO'}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-slate-400 font-bold text-[9px]">{new Date(j.completedAt || j.createdAt).toLocaleDateString('es-CL')}</p>
            {isAdminView && auditMode && (
              <button onClick={(e) => { e.stopPropagation(); setEditDateJob(j); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded transition-colors" title="Corregir Fecha">
                <Edit2 className="w-3 h-3"/>
              </button>
            )}
          </div>
        </div>

        {/* NUEVO: CRONÓMETRO Y KILOMETRAJE EN LA TARJETA FINALIZADA */}
        {(j.status === 'completed' || j.status === 'failed') && (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-3 shadow-inner">
                <div className="flex items-center gap-2 flex-1">
                    <div className="bg-blue-100 p-1.5 rounded-lg"><Clock className="w-3.5 h-3.5 text-blue-600"/></div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Tiempo en Ruta</span>
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 leading-tight">
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
                </div>
                <div className="w-px h-8 bg-slate-200 shrink-0 mx-2"></div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0"><MapPin className="w-3.5 h-3.5 text-emerald-600"/></div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Distancia</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 leading-tight truncate">
                                {j.drivenDistance || 'No calculado'}
                            </span>
                            {isAdminView && auditMode && (
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setEditKmJob(j); }}
                                        className="p-1 bg-white dark:bg-slate-900 border border-emerald-200 text-emerald-600 rounded hover:bg-emerald-50 transition-colors shadow-sm shrink-0"
                                        title="Editar KM Manualmente"
                                    >
                                        <Edit2 className="w-3 h-3"/>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSingleRecalculate(j); }}
                                        disabled={processingId === `${j.id}-recalc-km`}
                                        className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 rounded hover:bg-blue-50 transition-colors shadow-sm disabled:opacity-50 shrink-0"
                                        title="Forzar Recálculo de Ruta (Maps)"
                                    >
                                        {processingId === `${j.id}-recalc-km` ? <Clock className="w-3 h-3 animate-spin"/> : <MapIcon className="w-3 h-3"/>}
                                    </button>
                                </div>
                            )}
                        </div>
                        
                    </div>
                </div>
            </div>
        )}

        {/* AVISO VISUAL DE ACTA YA COMPARTIDA/RENDIDA */}
        {j.sharedCount > 0 && (
           <div className="mb-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2 py-1.5 rounded-lg text-center flex items-center justify-center gap-1.5 shadow-sm animate-in zoom-in duration-300">
              <CheckCircle className="w-3.5 h-3.5" /> Ya rendido ({j.sharedCount} {j.sharedCount === 1 ? 'vez' : 'veces'})
           </div>
        )}

        {/* NUEVO: SELECTOR RÁPIDO DE PRT PARA ADMIN */}
        {isAdminView && j.tripType === 'revision' && (j.status === 'completed' || j.status === 'failed') && (
            <div className="mb-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2 flex flex-col gap-1.5 shadow-inner">
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Auditar Resultado PRT:</span>
                <div className="flex gap-1">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            showConfirm("¿Cambiar el resultado de esta PRT a Aprobado Legal?", async () => {
                                try {
                                    await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado' }, status: 'completed', failedReason: deleteField() });
                                    showAlert("✅ Corregido a Legal");
                                } catch(err) { showAlert("Error al actualizar"); }
                            });
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'aprobado' || j.checklist?.rtStatus === 'aprobado' ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-200' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-green-50 hover:text-green-600 hover:border-green-200'}`}>
                        Legal
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            showConfirm("¿Cambiar el resultado de esta PRT a Aprobado con Ayuda?", async () => {
                                try {
                                    await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado_ayuda', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado_ayuda' }, status: 'completed', failedReason: deleteField() });
                                    showAlert("✅ Corregido a Con Ayuda");
                                } catch(err) { showAlert("Error al actualizar"); }
                            });
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'aprobado_ayuda' || j.checklist?.rtStatus === 'aprobado_ayuda' ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'}`}>
                        Ayuda
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            showConfirm("¿Cambiar el resultado de esta PRT a Rechazado?", async () => {
                                try {
                                    await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'rechazado', checklist: { ...(j.checklist || {}), rtStatus: 'rechazado' }, status: 'failed', failedReason: 'Rechazo en Planta PRT (Editado por Admin)' });
                                    showAlert("✅ Corregido a Rechazado");
                                } catch(err) { showAlert("Error al actualizar"); }
                            });
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${j.prt_result === 'rechazado' || j.checklist?.rtStatus === 'rechazado' ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-200' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}>
                        Rechazo
                    </button>
                </div>
            </div>
        )}

         <div className="flex gap-1.5 mt-auto">
          {isAdminView && <button onClick={(e)=>{e.stopPropagation(); onEditJob(j);}} className="flex-1 py-1.5 flex justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors" title="Editar Traslado"><Edit2 className="w-3.5 h-3.5"/></button>}
          {isAdminView && <button onClick={(e)=>{e.stopPropagation(); handleDuplicateJob(j);}} className="flex-1 py-1.5 flex justify-center bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors" title="Repetir Vehículo"><Repeat className="w-3.5 h-3.5"/></button>}
          

          {j.checklist && (j.checklist.scandocPdf || j.checklist.scandocPdfInbox || j.checklist.scannerLink) && (
            <a href={j.checklist.scandocPdf || j.checklist.scandocPdfInbox || j.checklist.scannerLink} onClick={(e)=>e.stopPropagation()} target="_blank" rel="noreferrer" className="flex-1 py-1.5 flex justify-center items-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors relative" title="Ver Documentación PRT">
               <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[7px] font-black px-1 py-0.5 rounded shadow-sm">PRT</span>
               <FileText className="w-3.5 h-3.5"/>
            </a>
          )}
          
          {(() => {
             const historyDocHref = j.guideLink || j.guideUrl || j.docLink || j.docUrl || j.rtLink || j.rtDoc || (j.rtData && j.rtData.link) || j.pdfUrl || j.fileUrl || j.checklist?.guiaDespachoPdf || j.checklist?.guiaDespachoLink;
             if (historyDocHref) {
                return (
                  <a href={historyDocHref} onClick={(e)=>e.stopPropagation()} target="_blank" rel="noreferrer" className="flex-1 py-1.5 flex justify-center items-center bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-lg transition-colors relative" title="Ver Guía/Doc Adjunto">
                     <span className="absolute -top-1.5 -right-1.5 bg-cyan-600 text-white text-[7px] font-black px-1 py-0.5 rounded shadow-sm">DOC</span>
                     <FileText className="w-3.5 h-3.5"/>
                  </a>
                );
             }
             return null;
          })()}

          <button onClick={(e) => {e.stopPropagation(); generatePDF(j);}} disabled={processingId === `${j.id}-pdf`} className="flex-1 py-1.5 flex justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50" title="Descargar PDF">{processingId === `${j.id}-pdf` ? <Clock className="w-3.5 h-3.5 animate-spin"/> : <FileDown className="w-3.5 h-3.5"/>}</button>
          <button onClick={(e) => {e.stopPropagation(); handleShareWhatsAppPDF(j);}} disabled={processingId === `${j.id}-wapp`} className="flex-1 py-1.5 flex justify-center items-center bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50" title="Compartir PDF por WhatsApp">
            {processingId === `${j.id}-wapp` ? <Clock className="w-3.5 h-3.5 animate-spin"/> : <Share2 className="w-3.5 h-3.5"/>}
          </button>
          {isAdminView && <button onClick={(e)=>{e.stopPropagation(); handleDeleteJob(j.id);}} className="flex-1 py-1.5 flex justify-center bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar Traslado"><Trash2 className="w-3.5 h-3.5"/></button>}
        </div>
      </div>
    );
  }