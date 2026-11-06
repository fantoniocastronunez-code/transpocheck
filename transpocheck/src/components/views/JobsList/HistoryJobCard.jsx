import React from 'react';
import { Receipt } from 'lucide-react';

export default function HistoryJobCard({ j, ...props }) {
  const { drivers, getJobIdentifier, setSelectedHistoryJob, latestVehiclePhotos, setFullScreenPhoto, auditMode, isAdminView, setEditDateJob, setEditKmJob, setEditDriverJob, handleSingleRecalculate, processingId, onEditJob, handleDuplicateJob, generatePDF, handleShareWhatsAppPDF, handleDeleteJob, updateDoc, doc, deleteField, db, showConfirm, showAlert, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, AlertCircle, Navigation, Edit2, MapPin, FileText, Clock, MapIcon, CheckCircle, Repeat, FileDown, Trash2, Share2, cpyWapp, Copy } = props;
  const drv = drivers?.find(d => d.email === j.acceptedByEmail);
  const driverName = drv ? drv.name : (j.checklist?.assignedDriverName || j.acceptedByEmail || 'No registrado');
  const isFailed = j.status === 'failed';
  const ident = getJobIdentifier(j);

  return (
    <div key={j.id} onClick={() => setSelectedHistoryJob(j)} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between relative hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer overflow-hidden mt-3">

      {/* Side Status Bar */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${isFailed ? 'bg-red-600' : 'bg-emerald-600'}`}></div>

      {/* Top Bar: Status & Date */}
      <div className="flex justify-between items-center mb-3 pl-2 relative z-10">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${isFailed ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'}`}>
            {isFailed ? 'RECHAZADO' : 'ENTREGADO'}
          </div>
          {j.expenses && j.expenses.length > 0 && (
            <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center gap-1">
              <Receipt className="w-3 h-3" /> {j.expenses.length} Gasto{j.expenses.length > 1 ? 's' : ''} (${j.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('es-CL')})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <p className="text-slate-500 dark:text-slate-400 font-mono font-medium text-[11px]">{new Date(j.completedAt || j.createdAt).toLocaleDateString('es-CL')}</p>
          {isAdminView && auditMode && (
            <button onClick={(e) => { e.stopPropagation(); setEditDateJob(j); }} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 p-1 rounded transition-colors" title="Corregir Fecha">
              <Edit2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Info: Photo & Title & Plate */}
      <div className="flex items-start mb-3.5 pl-2 gap-3 relative">
        {(() => {
          const displayPhoto = j.checklist?.photos?.front || latestVehiclePhotos[ident];
          if (!displayPhoto) return null;
          return (
            <img
              src={displayPhoto}
              alt="Frente"
              onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(displayPhoto); }}
              className="w-11 h-11 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
            />
          );
        })()}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {ident !== 'S/N' && (
            <div className="mb-0.5 max-w-[120px] transform scale-85 origin-left">
              <LicensePlateBadge text={ident} />
            </div>
          )}
          {j.tripType === 'simple' ? (
            <p className="text-xs font-bold uppercase text-slate-900 dark:text-slate-100 leading-tight truncate pr-2 mt-0.5">{j.description || 'Servicio en Terreno'}</p>
          ) : (
            <p className="text-xs font-bold uppercase text-slate-900 dark:text-slate-100 leading-tight truncate pr-2 mt-0.5">{j.brand} {j.model}</p>
          )}
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">Cond: <span className="text-slate-700 dark:text-slate-200 font-semibold">{driverName}</span></p>
        </div>
      </div>

      {isFailed && <p className="text-red-600 dark:text-red-400 text-xs mb-3 ml-2 font-medium line-clamp-2">Razón: {j.failedReason}</p>}

      {/* Main Content Area: Timeline + Stats */}
      <div className="flex gap-3.5 mb-3.5 pl-2">
        {/* Timeline (Left side) */}
        <div className="flex-1 min-w-0 relative pl-5 flex flex-col gap-3.5 py-1 justify-center">
          <div className="absolute left-[4px] top-[12px] bottom-[12px] w-px bg-slate-300 dark:bg-slate-700 z-10"></div>

          {/* Origin */}
          <div className="relative z-20 flex items-center gap-2">
            <div className="absolute -left-[20px] w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight truncate w-full pr-1">{j.origin || '-'}</span>
          </div>

          {/* Waypoints / PRT */}
          {(j.waypoints?.length > 0 || j.tripType === 'revision') && (
            <div className="relative z-20 flex items-center gap-2">
              <div className="absolute -left-[20px] w-2.5 h-2.5 rounded-full bg-amber-500"></div>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 leading-tight truncate uppercase w-full pr-1">
                {j.tripType === 'revision' ? (j.destination?.includes('->') ? (j.destination.split('->').length > 2 ? j.destination.split('->')[1].trim() : j.destination.split('->')[0].trim()) : 'PRT') : `${j.waypoints.length} PARADAS`}
              </span>
            </div>
          )}

          {/* Destination */}
          <div className="relative z-20 flex items-center gap-2">
            <div className="absolute -left-[20px] w-2.5 h-2.5 rounded-full bg-blue-600"></div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 leading-tight truncate w-full pr-1">
              {j.tripType === 'revision' ? getRtFinalDestination(j) : (j.destination || '-')}
            </span>
          </div>
        </div>

        {/* Stats Box (Right side) */}
        <div className="w-[96px] shrink-0 flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800 justify-center">
          <div className="flex flex-col items-center text-center">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mb-0.5" />
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none mb-0.5">Tiempo</span>
            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 leading-tight">
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

          <div className="w-8 h-px bg-slate-200 dark:bg-slate-700 mx-auto my-0.5"></div>

          <div className="flex flex-col items-center text-center relative">
            <div className="flex items-center gap-1 mb-0.5 relative">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {isAdminView && auditMode && (
                <button onClick={(e) => { e.stopPropagation(); handleSingleRecalculate(j); }} disabled={processingId === `${j.id}-recalc-km`} className="absolute -right-5 -top-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-50">
                  {processingId === `${j.id}-recalc-km` ? <Clock className="w-3 h-3 animate-spin" /> : <MapIcon className="w-3 h-3" />}
                </button>
              )}
            </div>
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none mb-0.5">Distancia</span>
            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 leading-tight truncate w-full px-1">
              {j.drivenDistance || 'No calc'}
            </span>
          </div>
        </div>
      </div>

      {/* AVISO VISUAL DE ACTA YA COMPARTIDA/RENDIDA */}
      {j.sharedCount > 0 && (
        <div className="mb-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold px-2.5 py-1 rounded-md text-center flex items-center justify-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" /> Acta Rendida ({j.sharedCount} {j.sharedCount === 1 ? 'vez' : 'veces'})
        </div>
      )}

      {/* SELECTOR RÁPIDO DE PRT PARA ADMIN */}
      {isAdminView && j.tripType === 'revision' && (j.status === 'completed' || j.status === 'failed') && (
        <div className="mb-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-md p-2 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Auditar Resultado PRT:</span>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); showConfirm("¿Aprobado Legal?", async () => { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado' }, status: 'completed', failedReason: deleteField() }); }); }}
              className={`flex-1 py-1.5 rounded text-[10px] font-semibold uppercase transition-colors ${j.prt_result === 'aprobado' || j.checklist?.rtStatus === 'aprobado' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-emerald-600'}`}>Legal</button>
            <button
              onClick={(e) => { e.stopPropagation(); showConfirm("¿Aprobado con Ayuda?", async () => { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'aprobado_ayuda', checklist: { ...(j.checklist || {}), rtStatus: 'aprobado_ayuda' }, status: 'completed', failedReason: deleteField() }); }); }}
              className={`flex-1 py-1.5 rounded text-[10px] font-semibold uppercase transition-colors ${j.prt_result === 'aprobado_ayuda' || j.checklist?.rtStatus === 'aprobado_ayuda' ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-amber-600'}`}>Ayuda</button>
            <button
              onClick={(e) => { e.stopPropagation(); showConfirm("¿Rechazado?", async () => { await updateDoc(doc(db, 'transport_jobs', j.id), { prt_result: 'rechazado', checklist: { ...(j.checklist || {}), rtStatus: 'rechazado' }, status: 'failed', failedReason: 'Rechazo en Planta PRT (Editado por Admin)' }); }); }}
              className={`flex-1 py-1.5 rounded text-[10px] font-semibold uppercase transition-colors ${j.prt_result === 'rechazado' || j.checklist?.rtStatus === 'rechazado' ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-red-600'}`}>Rechazo</button>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-1.5 mt-auto border-t border-slate-200 dark:border-slate-800 pt-2.5 pl-2">
        {isAdminView && <button onClick={(e) => { e.stopPropagation(); onEditJob(j); }} className="flex-1 py-1.5 flex justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition-colors border border-slate-200 dark:border-slate-700" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>}
        {isAdminView && <button onClick={(e) => { e.stopPropagation(); handleDuplicateJob(j); }} className="flex-1 py-1.5 flex justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition-colors border border-slate-200 dark:border-slate-700" title="Repetir"><Repeat className="w-3.5 h-3.5" /></button>}

        {j.checklist && (j.checklist.scandocPdf || j.checklist.scandocPdfInbox || j.checklist.scannerLink) && (
          <a href={j.checklist.scandocPdf || j.checklist.scandocPdfInbox || j.checklist.scannerLink} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="flex-1 py-1.5 flex justify-center items-center bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded transition-colors border border-blue-200 dark:border-blue-800/60" title="Ver Documentación PRT">
            <span className="sr-only">PRT</span><FileText className="w-3.5 h-3.5" />
          </a>
        )}

        {(() => {
          const historyDocHref = j.guideLink || j.guideUrl || j.docLink || j.docUrl || j.rtLink || j.rtDoc || (j.rtData && j.rtData.link) || j.pdfUrl || j.fileUrl || j.checklist?.guiaDespachoPdf || j.checklist?.guiaDespachoLink;
          if (historyDocHref) {
            return (
              <a href={historyDocHref} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="flex-1 py-1.5 flex justify-center items-center bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded transition-colors border border-blue-200 dark:border-blue-800/60" title="Ver Guía/Doc Adjunto">
                <span className="sr-only">GUÍA</span><FileText className="w-3.5 h-3.5" />
              </a>
            );
          }
          return null;
        })()}

        <button onClick={(e) => { e.stopPropagation(); generatePDF(j); }} disabled={processingId === `${j.id}-pdf`} className="flex-1 py-1.5 flex justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50" title="Descargar PDF">{processingId === `${j.id}-pdf` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}</button>
        {cpyWapp && (
          <button onClick={(e) => { e.stopPropagation(); cpyWapp(j); }} className="flex-1 py-1.5 flex justify-center items-center bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded transition-colors border border-blue-200 dark:border-blue-800/60" title="Copiar Resumen para WhatsApp">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); handleShareWhatsAppPDF(j); }} disabled={processingId === `${j.id}-wapp`} className="flex-1 py-1.5 flex justify-center items-center bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 rounded transition-colors border border-emerald-200 dark:border-emerald-800/60 disabled:opacity-50" title="Compartir PDF por WhatsApp">
          {processingId === `${j.id}-wapp` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
        {isAdminView && <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(j.id); }} className="flex-1 py-1.5 flex justify-center bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 rounded transition-colors border border-red-200 dark:border-red-900/50" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
    </div>
  );
}
