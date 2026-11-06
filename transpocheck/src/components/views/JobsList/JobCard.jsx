import React, { useState } from 'react';
import { CloudUpload, Receipt, MessageSquare, Phone, Camera } from 'lucide-react';

const renderVehicle = (vType, wheelClass, wheelFill, isChassisCab) => {
  const type = (vType || '').toLowerCase();

  if (type.includes('arrastre')) {
    return (
      <React.Fragment>
        <path d="M 20 35 L 32 35 L 32 45 L 20 45 Z" />
        <path d="M 32 25 L 42 25 L 48 35 L 48 45 L 32 45 Z" />
        <circle cx="26" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="42" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <line x1="15" y1="42" x2="20" y2="42" stroke="currentColor" strokeWidth="2" />
        <rect x="0" y="38" width="15" height="4" />
        <circle cx="8" cy="48" r="3" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('8x4') || type.includes('rigid')) {
    return (
      <React.Fragment>
        {isChassisCab ? <rect x="-4" y="38" width="38" height="3" /> : <rect x="-4" y="16" width="36" height="29" rx="1" />}
        <path d="M 34 26 L 46 26 L 50 36 L 50 45 L 34 45 Z" />
        <circle cx="4" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="14" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="34" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="44" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('3 ejes') || type.includes('tres ejes')) {
    return (
      <React.Fragment>
        {isChassisCab ? <rect x="-4" y="38" width="40" height="3" /> : <rect x="-4" y="18" width="38" height="27" rx="1" />}
        <path d="M 36 28 L 44 28 L 48 38 L 48 45 L 36 45 Z" />
        <circle cx="2" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="12" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="22" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="42" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('2 ejes') || type.includes('dos ejes')) {
    return (
      <React.Fragment>
        {isChassisCab ? <rect x="0" y="38" width="36" height="3" /> : <rect x="0" y="18" width="34" height="27" rx="1" />}
        <path d="M 36 28 L 44 28 L 48 38 L 48 45 L 36 45 Z" />
        <circle cx="8" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="18" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="40" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('doble cabina')) {
    return (
      <React.Fragment>
        {isChassisCab ? <rect x="2" y="38" width="24" height="3" /> : <rect x="2" y="22" width="22" height="23" rx="1" />}
        <path d="M 26 25 L 42 25 L 46 38 L 46 45 L 26 45 Z" />
        <circle cx="10" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="38" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('cami')) {
    return (
      <React.Fragment>
        {isChassisCab ? <rect x="2" y="38" width="32" height="3" /> : <rect x="2" y="20" width="30" height="25" rx="1" />}
        <path d="M 34 30 L 42 30 L 46 38 L 46 45 L 34 45 Z" />
        <circle cx="10" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="38" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('furgón grande') || type.includes('furgon grande') || type.includes('sprinter')) {
    return (
      <React.Fragment>
        <path d="M 2 18 L 38 18 L 46 30 L 46 45 L 2 45 Z" />
        <circle cx="10" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="38" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('furg')) {
    return (
      <React.Fragment>
        <path d="M 6 24 L 34 24 L 42 34 L 44 45 L 6 45 Z" />
        <circle cx="14" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="36" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('camioneta') || type.includes('pickup')) {
    return (
      <React.Fragment>
        <path d="M 5 35 L 20 35 L 20 45 L 5 45 Z" />
        <path d="M 20 25 L 35 25 L 45 35 L 45 45 L 20 45 Z" />
        <circle cx="15" cy="50" r="4" className={wheelClass} fill={wheelFill} />
        <circle cx="40" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  if (type.includes('maquin')) {
    return (
      <React.Fragment>
        <path d="M 12 25 L 28 25 L 30 35 L 36 38 L 36 45 L 8 45 L 8 38 Z" />
        <path d="M 32 38 L 44 42 L 48 34 L 46 46 L 40 46 Z" />
        <circle cx="16" cy="48" r="6" className={wheelClass} fill={wheelFill} />
        <circle cx="34" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <path d="M10 40 L 15 25 L 35 25 L 45 40 Z" />
      <rect x="5" y="40" width="45" height="10" rx="2" />
      <circle cx="15" cy="50" r="4" className={wheelClass} fill={wheelFill} />
      <circle cx="40" cy="50" r="4" className={wheelClass} fill={wheelFill} />
    </React.Fragment>
  );
};

const StatusAnimation = ({ type, vehicleType, isChassisCab, origin, destination, assignedDrivers = [] }) => {
  switch (type) {
    case 'searching':
      const driversToDisplay = assignedDrivers && assignedDrivers.length > 0 ? assignedDrivers.slice(0, 3) : [{}, {}, {}];

      return (
        <svg viewBox="0 0 300 70" className="w-full h-14 my-2">
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
            {driversToDisplay.map((d, idx) => {
              const cx = 50 + (idx * 100);
              return (
                <React.Fragment key={idx}>
                  <circle cx={cx} cy="25" r="10" />
                  <path d={`M${cx - 10} 50 C ${cx - 10} 35, ${cx + 10} 35, ${cx + 10} 50 Z`} />
                  {d.name && (
                    <foreignObject x={cx - 45} y="52" width="90" height="18">
                      <div xmlns="http://www.w3.org/1999/xhtml" className="w-full text-center">
                        <span className="text-[8px] sm:text-[9px] text-slate-500 font-semibold uppercase truncate block px-1 leading-tight">{d.name.split(' ')[0]}</span>
                      </div>
                    </foreignObject>
                  )}
                </React.Fragment>
              );
            })}
          </g>
          <g className="lupa" transform="translate(10, 5)">
            <circle cx="20" cy="20" r="15" fill="none" stroke="#2563EB" strokeWidth="3.5" />
            <line x1="30" y1="30" x2="45" y2="45" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 'assigned':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2">
          <defs>
            <style>{`
              @keyframes walkInAnim {
                0% { transform: translateX(-10px); opacity: 0; }
                5% { opacity: 1; }
                80% { transform: translateX(130px); opacity: 1; }
                100% { transform: translateX(130px); opacity: 0; }
              }
              .personIn { animation: walkInAnim 3.5s linear infinite; }
            `}</style>
          </defs>
          <g transform="translate(150, 0)" fill="currentColor" className="text-slate-300 dark:text-slate-600">
            {renderVehicle(vehicleType, "text-slate-400 dark:text-slate-500", undefined, isChassisCab)}
          </g>
          <g className="personIn" fill="#2563EB">
            <circle cx="10" cy="25" r="5" />
            <path d="M 5 32 C 5 28, 15 28, 15 32 L 15 50 L 5 50 Z" />
          </g>
        </svg>
      );
    case 'picked_up':
      return (
        <svg viewBox="0 0 300 60" className="w-full h-12 my-2">
          <defs>
            <style>{`
              @keyframes realFlashAnim {
                0% { opacity: 0; }
                5% { opacity: 0; }
                10% { opacity: 1; }
                20% { opacity: 0; }
                100% { opacity: 0; }
              }
              .cameraFlash { animation: realFlashAnim 3s infinite; }
            `}</style>
          </defs>
          <g transform="translate(150, 0)" fill="currentColor" className="text-slate-300 dark:text-slate-600">
            {renderVehicle(vehicleType, "text-slate-400 dark:text-slate-500", undefined, isChassisCab)}
          </g>
          <g transform="translate(115, 0)" fill="#2563EB">
            <circle cx="10" cy="25" r="5" />
            <path d="M 5 32 C 5 28, 15 28, 15 32 L 15 50 L 5 50 Z" />
            <path d="M 5 32 L 15 32 L 20 28" stroke="#2563EB" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="18" y="24" width="4" height="6" rx="1" fill="#1E293B" />
          </g>
          <polygon className="cameraFlash" points="135,27 220,-10 220,60" fill="rgba(59, 130, 246, 0.22)" />
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
          <foreignObject x="0" y="8" width="90" height="42">
            <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col items-center w-full h-full">
              <div className="bg-slate-700 dark:bg-slate-600 w-full rounded px-1.5 py-1.5 border-b-2 border-slate-900 dark:border-slate-800 flex items-center justify-center shrink-0">
                <span className="text-[10px] text-white font-semibold uppercase truncate leading-tight w-full text-center">{origin ? origin.split(',')[0] : 'Origen'}</span>
              </div>
              <div className="w-2 flex-1 bg-slate-400 dark:bg-slate-500 rounded-b-sm"></div>
            </div>
          </foreignObject>

          <foreignObject x="210" y="8" width="90" height="42">
            <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col items-center w-full h-full">
              <div className="bg-blue-600 dark:bg-blue-700 w-full rounded px-1.5 py-1.5 border-b-2 border-blue-900 flex items-center justify-center shrink-0">
                <span className="text-[10px] text-white font-semibold uppercase truncate leading-tight w-full text-center">{destination ? destination.split(',')[0] : 'Destino'}</span>
              </div>
              <div className="w-2 flex-1 bg-slate-400 dark:bg-slate-500 rounded-b-sm"></div>
            </div>
          </foreignObject>

          <g stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="2" strokeDasharray="10 10">
            <line x1="0" y1="50" x2="320" y2="50" className="streetDash" />
          </g>
          <g className="carMov" fill="#2563EB">
            {renderVehicle(vehicleType, undefined, "#1E293B", isChassisCab)}
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
          <g className="carIn" fill="#2563EB">
            {renderVehicle(vehicleType, undefined, "#1E293B", isChassisCab)}
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
            <circle cx="10" cy="10" r="16" fill="#059669" />
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
            <circle cx="10" cy="10" r="16" fill="#DC2626" />
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
                50% { transform: translateY(-6px); }
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
              <circle cx="-20" cy="10" r="2" fill="#D97706" />
              <circle cx="40" cy="5" r="3" fill="#D97706" />
              <circle cx="30" cy="35" r="2" fill="#D97706" />
              <circle cx="-10" cy="40" r="2.5" fill="#D97706" />
            </g>
            <g className="flagBounce">
              <path d="M 5 45 L 5 5" stroke="currentColor" className="text-slate-700 dark:text-slate-300" strokeWidth="3" strokeLinecap="round" />
              <path d="M 5 5 L 25 12 L 5 20 Z" fill="#059669" />
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
  const [showDocsModal, setShowDocsModal] = useState(false);
  const { analyzeJobStatus, getJobIdentifier, vehicles, menuOpenId, setMenuOpenId, isAdminView, onEditJob, currentUserEmail, setRelayPromptJob, setForceCloseJob, db, updateDoc, deleteField, doc, showAlert, showConfirm, setJobToFail, latestVehiclePhotos, setFullScreenPhoto, role, processingId, setProcessingId, handleApproveRequest, handleRejectRequest, handleApprovePhotoOverride, handleAcceptJob, setTrackingJobId, setGuideUploadJob, setGuideLink, setGuideFileBase64, updatePhase, setPickupPromptJob, setArrivalPromptJob, setArrivalMileage, setArrivalPhoto, setPrtApproveType, setPrtReturnOpt, setPrtReturnDest, setPrtApprovePromptJob, setPrtPromptJob, onStartChecklist, handleUndoPhase, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, WaitTimerBadge, SwipeButton, AlertCircle, Edit2, MoreVertical, Navigation, Share2, Users, CheckCircle, Truck, X, XCircle, Clock, Car, MapPin, FileText, RefreshCw, Search, syncQueue, setExpenseModalJob, Copy, cpyWapp } = props;
  const { isRequested, isPending, isAccepted, isPendingGuide, step2Done, step3Done, step4Done } = analyzeJobStatus(j);

  const ident = getJobIdentifier(j);

  // ESTADO DE SUBIDA EN SEGUNDO PLANO (COLA DE SUBIDAS)
  const activeSyncTask = syncQueue?.find(t => t.jobId === j.id && t.status === 'syncing');
  const isUploading = Boolean(activeSyncTask);

  // Motor de Alertas y Fotos de Documentos del Vehículo
  let expiringDocs = [];
  let vehicleDocPhotos = {};
  if (vehicles && ident && ident !== 'S/N' && j.tripType !== 'simple') {
    const v = vehicles.find(x => x.plate === ident.toUpperCase());
    if (v) {
      if (v.docsPhotos) vehicleDocPhotos = v.docsPhotos;
      if (v.docsExpiry) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const limit = new Date(); limit.setDate(today.getDate() + 30);
        const docNames = { soap: 'SOAP', permiso: 'Permiso Circ.', revTecnica: 'Rev. Técnica', gases: 'Gases' };

        for (const [key, dateStr] of Object.entries(v.docsExpiry)) {
          if (!dateStr) continue;
          const [year, month, day] = dateStr.split('-');
          const expDate = new Date(year, month - 1, day);
          if (expDate < today) {
            expiringDocs.push(`[VENCIDO] ${docNames[key]} (${day}/${month}/${year})`);
          } else if (expDate <= limit) {
            expiringDocs.push(`[POR VENCER] ${docNames[key]} (${day}/${month}/${year})`);
          }
        }
      }
    }
  }
  const combinedDocPhotos = { ...vehicleDocPhotos, ...(j.checklist?.docsPhotos || {}) };
  const availableDocPhotoKeys = Object.keys(combinedDocPhotos).filter(k => typeof combinedDocPhotos[k] === 'string' && combinedDocPhotos[k].startsWith('http'));

  return (
    <div
      key={j.id}
      className={`bg-white dark:bg-slate-900 rounded-lg border p-3.5 sm:p-4 flex flex-col shadow-xs relative ${!isUploading ? 'hover:border-slate-300 dark:hover:border-slate-700' : 'select-none'} transition-colors cursor-default group ${isUploading
        ? 'border-emerald-600'
        : (j.isUrgent ? 'border-red-500/80 dark:border-red-600/70' : 'border-slate-200 dark:border-slate-800')
        } ${menuOpenId === j.id ? 'z-50' : 'z-10'}`}
    >

      {/* OVERLAY DE SUBIDA EN SEGUNDO PLANO */}
      {isUploading && (
        <div className="absolute inset-0 z-40 rounded-lg bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center select-none pointer-events-auto cursor-wait border border-emerald-600">
          <div className="relative mb-3 flex items-center justify-center">
            <div className="w-12 h-12 rounded-md bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400">
              <CloudUpload className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          <span className="text-emerald-400 font-mono font-bold tracking-widest text-sm uppercase">
            SUBIENDO
          </span>

          <p className="text-xs font-medium text-slate-300 mt-1 max-w-[230px] leading-relaxed">
            Sincronizando fotos y checklist con la nube...
          </p>

          {activeSyncTask?.progressText && (
            <div className="mt-2.5 px-3 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />
              <span className="truncate max-w-[200px]">{activeSyncTask.progressText}</span>
            </div>
          )}

          <span className="text-[11px] text-slate-400 mt-2">
            No cierres la app mientras se completa la subida
          </span>
        </div>
      )}

      {/* Indicador lateral de estado (sólido, sin degradados ni brillos) */}
      <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
        <div className={`absolute top-0 left-0 bottom-0 w-1 ${isRequested ? 'bg-slate-500' : (isPending ? 'bg-amber-500' : 'bg-blue-600')}`}></div>
      </div>

      <div className="flex justify-between items-start mb-3 border-b border-slate-200 dark:border-slate-800 pb-3 pl-1.5 relative z-20">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex justify-between items-start w-full gap-2">
            <div className="shrink-0 relative z-10 flex flex-col items-start gap-1">
              {j.isUrgent && (
                <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> URGENTE
                </span>
              )}
              {j.tripType === 'simple' && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">SERVICIO</span>
              )}
              {ident !== 'S/N' && (
                <div className="transform scale-[0.82] origin-top-left mb-0.5">
                  {j.plate && j.plate !== 'S/N' ? (
                    <>
                      <LicensePlateBadge text={j.plate} />
                      {j.vin && j.vin !== j.plate && (
                        <div className="mr-1 mt-1"><VinPlateBadge vin={j.vin} compact /></div>
                      )}
                    </>
                  ) : (
                    <VinPlateBadge vin={j.vin || ident} />
                  )}
                </div>
              )}
              {(j.checklist?.transitNotes || j.draft?.formData?.transitNotes) && (
                <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> NOTA EN RUTA
                </span>
              )}
              {j.expenses && j.expenses.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpenseModalJob && setExpenseModalJob(j); }}
                  className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  title="Ver / registrar gastos"
                >
                  <Receipt className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  {j.expenses.length} Gasto{j.expenses.length > 1 ? 's' : ''} (${j.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('es-CL')})
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 relative shrink-0 z-50">
              {isAdminView && <button onClick={() => onEditJob(j)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors border border-slate-200 dark:border-slate-700"><Edit2 className="w-4 h-4" /></button>}
              <button onClick={() => setMenuOpenId(menuOpenId === j.id ? null : j.id)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors border border-slate-200 dark:border-slate-700"><MoreVertical className="w-4 h-4" /></button>
              {menuOpenId === j.id && (
                <div className="absolute right-0 top-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg rounded-lg w-56 z-[999] overflow-hidden text-xs text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
                  <button onClick={async () => {
                    const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                    const textToShare = `📍 Sigue en tiempo real todos los traslados de ${j.client || 'tu empresa'} aquí:\n${url}`;
                    try {
                      if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(textToShare);
                      } else {
                        throw new Error("fallback");
                      }
                      showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!");
                    } catch (e) {
                      const textArea = document.createElement("textarea");
                      textArea.value = textToShare;
                      textArea.style.position = "fixed";
                      textArea.style.left = "-9999px";
                      textArea.setAttribute('readonly', '');
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      textArea.setSelectionRange(0, 999999);
                      try {
                        document.execCommand('copy');
                        showAlert("✅ Portal de Cliente copiado. ¡Pégalo en WhatsApp!");
                      } catch (err) {}
                      document.body.removeChild(textArea);
                    }
                    setMenuOpenId(null);
                  }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400"><Navigation className="w-4 h-4" /> Portal Cliente</button>

                  {isAccepted && (
                    <button onClick={() => {
                      const url = `${window.location.origin}/?client=${encodeURIComponent(j.client || 'Sin Cliente')}`;
                      const textToShare = `📍 Hola! El vehículo ${ident} va en camino a ${j.destination || 'su destino'}. Puedes seguir el traslado en tiempo real aquí:\n${url}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(textToShare)}`, '_blank');
                      setMenuOpenId(null);
                    }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400"><Share2 className="w-4 h-4" /> Notificar Receptor</button>
                  )}

                  {cpyWapp && (
                    <button onClick={() => { cpyWapp(j); setMenuOpenId(null); }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Copy className="w-4 h-4" /> Copiar Resumen WhatsApp
                    </button>
                  )}

                  {(isAccepted || isAdminView) && (
                    <button onClick={() => { setExpenseModalJob && setExpenseModalJob(j); setMenuOpenId(null); }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400">
                      <Receipt className="w-4 h-4" /> Ingreso de Gastos
                    </button>
                  )}

                  {isAccepted && j.phase && j.phase !== 'claimed' && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                    <button onClick={() => handleUndoPhase(j)} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400">
                      <RefreshCw className="w-4 h-4" /> Deshacer último paso
                    </button>
                  )}

                  {isAccepted && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                    <button onClick={() => { setRelayPromptJob(j); setMenuOpenId(null); }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"><Users className="w-4 h-4" /> Traspaso a Compañero</button>
                  )}

                  {isAdminView && (
                    <button onClick={() => { setForceCloseJob(j); setMenuOpenId(null); }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-4 h-4" /> Forzar Cierre
                    </button>
                  )}

                  {isAdminView && j.fleetGroup && (
                    <button onClick={() => {
                      showConfirm("¿Quitar este vehículo del grupo de flota?", async () => {
                        try { await updateDoc(doc(db, 'transport_jobs', j.id), { fleetGroup: deleteField() }); setMenuOpenId(null); showAlert("Vehículo removido de la flota."); } catch (e) { showAlert("Error al desagrupar."); }
                      });
                    }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Truck className="w-4 h-4" /> Quitar de Flota
                    </button>
                  )}

                  {isAccepted && (!j.phase || j.phase === 'claimed' || j.phase === 'arrived_pickup') && (isAdminView || j.acceptedByEmail === currentUserEmail) && (
                    <button onClick={() => { showConfirm("¿Deseas cancelar la aceptación?", async () => { try { await updateDoc(doc(db, 'transport_jobs', j.id), { status: 'pending', acceptedByEmail: deleteField(), phase: deleteField(), liveLocation: deleteField(), arrivedPickupAt: deleteField(), waitTimeMinutes: deleteField() }); setMenuOpenId(null); showAlert("✅ Traslado liberado."); } catch (err) { showAlert("Error al liberar."); } }); }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <X className="w-4 h-4" /> Cancelar Aceptación (Soltar)
                    </button>
                  )}

                  {(isAdminView || j.acceptedByEmail === currentUserEmail) && (
                    <button onClick={() => { setJobToFail(j); setMenuOpenId(null); }} className="w-full text-left px-3 py-2.5 font-semibold flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"><XCircle className="w-4 h-4" /> Cancelar / Falló</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {(() => {
              const displayPhoto = j.checklist?.photos?.front || j.draft?.formData?.photos?.front || latestVehiclePhotos[ident];
              if (!displayPhoto) return null;
              return (
                <img
                  src={displayPhoto}
                  alt="Frente"
                  onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(displayPhoto); }}
                  className="w-10 h-10 rounded-md object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                />
              );
            })()}
            <div>
              {j.tripType === 'simple' ? (
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5 break-words pr-2">{j.description || 'Servicio en Terreno'}</p>
              ) : (
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5 break-words pr-2 tracking-tight">{j.brand} {j.model}</p>
              )}
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider flex items-center flex-wrap gap-2">
                {j.client}
                {j.fleetGroup && <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-blue-200 dark:border-blue-800/60">EN FLOTA (CONVOY)</span>}
              </p>
              {j.createdBy && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Creado por: {j.createdBy}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1 relative z-10 flex flex-col pt-1 pb-1 pl-1.5">
        {/* TIMELINE SECTION */}
        <div className="relative pl-6 flex flex-col gap-3.5">

          {/* Continuous Timeline Line */}
          {(j.destination || j.tripType !== 'simple') && (
            <div className="absolute left-[7px] top-[12px] bottom-[12px] w-px bg-slate-300 dark:bg-slate-700 z-10"></div>
          )}

          {/* Date Badge (Right Side) */}
          {j.scheduledDate && (
            <div className="absolute right-0 -top-1 bg-slate-100 dark:bg-slate-800 rounded-md px-2.5 py-1.5 flex flex-col items-center justify-center z-30 border border-slate-200 dark:border-slate-700">
              <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">
                {(() => {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const [y, m, d] = j.scheduledDate.split('-');
                  const schedDate = new Date(y, m - 1, d); schedDate.setHours(0, 0, 0, 0);
                  const diffDays = Math.round((schedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays === 0) return 'HOY';
                  if (diffDays === 1) return 'MAÑANA';
                  return `${d}/${m}`;
                })()}
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 leading-none">{j.scheduledTime || '--:--'}</span>
            </div>
          )}

          {/* Origin */}
          <div className="relative">
            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 z-20"></div>

            <div className="flex items-baseline gap-1.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">{j.tripType === 'simple' ? 'Lugar:' : 'Desde:'}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 pr-16 leading-snug uppercase">{j.origin || 'Por definir'}</p>
            </div>
          </div>

          {/* Intermediate Tags (PRT, Regiones, Waypoints) */}
          {(j.tripType !== 'simple' || j.waypoints?.length > 0) && (
            <div className="relative z-20 py-0.5 flex flex-col items-start gap-2">
              {j.tripType === 'revision' && (
                <div className="relative inline-block bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-0.5 rounded">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    1RA PARADA: {j.destination ? j.destination.split(' -> ')[0] : 'PRT'}
                  </p>
                </div>
              )}
              {j.tripType === 'viaje' && (
                <div className="relative inline-block bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-2.5 py-0.5 rounded">
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    A REGIONES
                  </p>
                </div>
              )}
              {j.waypoints && j.waypoints.length > 0 && (
                <div className="relative inline-block bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-0.5 rounded">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    {j.waypoints.length} PARADA{j.waypoints.length > 1 ? 'S' : ''} INTERMEDIA{j.waypoints.length > 1 ? 'S' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Destination */}
          {(j.destination || j.tripType !== 'simple') && (
            <div className="relative">
              <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 z-20"></div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">Hasta:</p>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 pr-16 leading-snug uppercase">{j.tripType === 'revision' ? getRtFinalDestination(j) : (j.destination || 'Por definir')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Contacts & Info Button */}
        {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone || j.originAddress || j.originCommune || j.destContactName || j.destContactPhone || j.destAddress || j.destCommune || (j.waypoints && j.waypoints.length > 0)) && (
          <div className="mt-3.5 mb-1 flex">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {showDetails ? 'Ocultar Detalles' : 'Contactos y Waze'}
              </span>
            </button>
          </div>
        )}

        {showDetails && (
          <div className="mt-3 mb-3 space-y-2 relative z-20">
            {/* BLOQUE ORIGEN */}
            {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone || j.originAddress || j.originCommune) && (
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                {(j.originContactName || j.contactName || j.originContactPhone || j.contactPhone) && (
                  <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-md border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded shrink-0 border border-emerald-200 dark:border-emerald-800/60"><Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Encargado Origen</p>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{j.originContactName || j.contactName || 'No especificado'}</p>
                      </div>
                    </div>
                    {(j.originContactPhone || j.contactPhone) && (
                      <div className="flex gap-1.5 shrink-0">
                        <a href={`https://wa.me/${(j.originContactPhone || j.contactPhone).replace(/[^\d]/g, '')}?text=${encodeURIComponent('Hola ' + (j.originContactName || j.contactName || '') + ', soy de LogisticAPP y voy a retirar el vehículo.')}`} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 hover:bg-emerald-700 text-white w-8 h-8 rounded-md flex items-center justify-center transition-colors" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></a>
                        <a href={`tel:${(j.originContactPhone || j.contactPhone).replace(/[^\d+]/g, '')}`} className="bg-slate-700 hover:bg-slate-800 text-white w-8 h-8 rounded-md flex items-center justify-center transition-colors" title="Llamar"><Phone className="w-3.5 h-3.5" /></a>
                      </div>
                    )}
                  </div>
                )}

                {(j.originAddress || j.originCommune) && (
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-md border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mr-2"><MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-400" />{j.originAddress}{j.originAddress && j.originCommune ? ', ' : ''}{j.originCommune}</p>
                    {isAccepted && (
                      <a href={`https://waze.com/ul?q=${encodeURIComponent(`${j.originAddress || ''} ${j.originCommune || ''}`)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 shrink-0 transition-colors border border-blue-200 dark:border-blue-800/60"><Navigation className="w-3 h-3" /> Waze</a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BLOQUE DESTINO */}
            {(j.destContactName || j.destContactPhone || j.destAddress || j.destCommune) && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                {(j.destContactName || j.destContactPhone) && (
                  <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-md border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="bg-blue-50 dark:bg-blue-950/50 p-1.5 rounded shrink-0 border border-blue-200 dark:border-blue-800/60"><Users className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Encargado Destino</p>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{j.destContactName || 'No especificado'}</p>
                      </div>
                    </div>
                    {j.destContactPhone && (
                      <div className="flex gap-1.5 shrink-0">
                        <a href={`https://wa.me/${j.destContactPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent('Hola ' + (j.destContactName || '') + ', soy de LogisticAPP y voy en camino al destino con el vehículo.')}`} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 hover:bg-emerald-700 text-white w-8 h-8 rounded-md flex items-center justify-center transition-colors" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></a>
                        <a href={`tel:${j.destContactPhone.replace(/[^\d+]/g, '')}`} className="bg-slate-700 hover:bg-slate-800 text-white w-8 h-8 rounded-md flex items-center justify-center transition-colors" title="Llamar"><Phone className="w-3.5 h-3.5" /></a>
                      </div>
                    )}
                  </div>
                )}

                {(j.destAddress || j.destCommune) && (
                  <div className="flex justify-between items-center bg-blue-50/60 dark:bg-blue-950/30 p-2 rounded-md border border-blue-200 dark:border-blue-800/60">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300 truncate mr-2"><MapPin className="w-3.5 h-3.5 inline mr-1 text-blue-500" />{j.destAddress}{j.destAddress && j.destCommune ? ', ' : ''}{j.destCommune}</p>
                    {isAccepted && (
                      <a href={`https://waze.com/ul?q=${encodeURIComponent(`${j.destAddress || ''} ${j.destCommune || ''}`)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 shrink-0 transition-colors"><Navigation className="w-3 h-3" /> Waze</a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {j.waypoints && j.waypoints.length > 0 && showDetails && (
          <div className="mb-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Ruta intermedia:</p>
            <div className="flex flex-col gap-1">
              {j.waypoints.map((wp, i) => (
                <span key={i} className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug break-words"><span className="font-mono font-semibold mr-1 text-slate-500">{i + 1}.</span> {wp}</span>
              ))}
            </div>
          </div>
        )}

        {/* STATUS AND ANIMATION */}
        {(() => {
          let statusIcon = <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
          let statusTitle = isAccepted ? (j.assignedDrivers?.find(d => d.email === j.acceptedByEmail)?.name || "Conductor") : "Buscando conductor";
          let statusSub = isAccepted ? (j.tripType === 'simple' ? `Asignado a ${j.origin}` : `Retira en ${j.origin}`) : `Para ${j.origin}`;
          let animationType = 'searching';

          if (j.tripType === 'revision' && step4Done) {
            statusTitle = j.prt_result === 'rechazado' ? 'Revisión Rechazada' : 'Revisión Aprobada';
            statusIcon = <CheckCircle className={`w-4 h-4 ${j.prt_result === 'rechazado' ? 'text-red-500' : 'text-emerald-600'}`} />;
            statusSub = `En camino a: ${getRtFinalDestination(j)}`;
            animationType = j.prt_result === 'rechazado' ? 'prt_rejected' : 'prt_approved';
          } else if (step3Done || j.phase === 'arrived_destination') {
            statusTitle = j.tripType === 'simple' ? 'Trabajo Terminado' : (j.tripType === 'revision' ? 'En PRT' : 'Llegué a destino');
            statusSub = j.tripType === 'simple' ? (j.destination || '') : (j.tripType === 'revision' ? 'Planta' : j.destination);
            animationType = (j.tripType === 'simple' || j.phase === 'arrived_destination' || step4Done) ? 'completed' : 'arrived';
          } else if (j.phase === 'arrived_waypoint') {
            statusTitle = 'En Parada Intermedia';
            statusSub = (j.waypoints && j.waypoints[0]) || '';
            animationType = 'arrived';
          } else if (j.phase === 'departed_waypoint' || j.phase === 'picked_up' || step2Done) {
            statusTitle = j.phase === 'departed_waypoint' ? 'Camino a Destino Final' : (j.tripType === 'simple' ? 'Realizando Trabajo' : (j.waypoints?.length > 0 ? 'Camino a 1ra Parada' : 'Vehículo en ruta'));
            statusSub = '';
            animationType = 'transit';
          } else if (j.phase === 'arrived_pickup') {
            statusTitle = j.tripType === 'simple' ? 'En Lugar' : 'Vehículo en mi poder';
            statusSub = '';
            animationType = 'picked_up';
          } else if (isAccepted) {
            const driverName = j.assignedDrivers?.find(d => d.email === j.acceptedByEmail)?.name;
            statusTitle = driverName ? `Conductor asignado: ${driverName}` : 'Conductor asignado';
            animationType = 'assigned';
          }

          return (
            <div className="mt-2 pt-3 flex flex-col border-t border-slate-200 dark:border-slate-800">
              {animationType === 'searching' ? (
                <div className="flex items-center justify-center gap-2 mb-2 mt-0.5">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{statusTitle}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 w-full bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-md border border-slate-200 dark:border-slate-800 mb-2">
                  <div className="p-1 shrink-0 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                    {statusIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">{statusTitle}</p>
                    {statusSub && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{statusSub}</p>}
                  </div>
                </div>
              )}

              {animationType !== 'searching' && (
                <div className="scale-75 origin-top mb-[-2rem]">
                  <StatusAnimation type={animationType} vehicleType={j.vehicleType} isChassisCab={j.isChassisCab} origin={j.origin} destination={j.tripType === 'revision' ? getRtFinalDestination(j) : j.destination} assignedDrivers={j.assignedDrivers} />
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {j.phase === 'arrived_pickup' && j.arrivedPickupAt && (
        <div className="flex items-center gap-2 mb-3 pl-1.5">
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
              } catch (e) { showAlert("Error al cancelar."); }
            });
          }} className="bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 p-2.5 rounded-md border border-red-200 dark:border-red-900/50 transition-colors flex items-center justify-center shrink-0" title="Cancelar Timer">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PANEL DE ALERTA DE DOCUMENTOS VENCIDOS O POR VENCER */}
      {expiringDocs.length > 0 && (
        <div className="mb-2 mt-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 rounded-md pl-3.5">
          <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Alerta de Documentos
          </p>
          <ul className="text-xs font-mono font-medium text-red-800 dark:text-red-300 space-y-1">
            {expiringDocs.map((docAlert, idx) => (
              <li key={idx} className="bg-white dark:bg-slate-900 px-2 py-1 rounded border border-red-200 dark:border-red-900/50">{docAlert}</li>
            ))}
          </ul>
        </div>
      )}

      {availableDocPhotoKeys.length > 0 && (
        <div className="mt-2 mb-1 pl-1.5">
          <button
            type="button"
            onClick={() => setShowDocsModal(true)}
            className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold py-2 px-3 rounded-md text-xs transition-colors flex justify-center items-center gap-2"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Ver Fotos Documentos del Vehículo ({availableDocPhotoKeys.length})</span>
          </button>
        </div>
      )}

      {(() => {
        const activeDocHref = j.guideLink || j.guideUrl || j.docLink || j.docUrl || j.rtLink || j.rtDoc || (j.rtData && j.rtData.link) || j.pdfUrl || j.fileUrl || j.checklist?.guiaDespachoPdf || j.checklist?.guiaDespachoLink;
        if (activeDocHref) {
          return (
            <div className="mt-2 pl-1.5">
              <a href={activeDocHref} target="_blank" rel="noreferrer" className="w-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-semibold py-2 rounded-md text-xs transition-colors flex justify-center items-center gap-2">
                <FileText className="w-4 h-4" /> Ver Doc. Adjunto (Guía / RT)
              </a>
            </div>
          );
        }
        return null;
      })()}

      <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2 pl-1.5">
        {isRequested && (
          <>
            {isAdminView ? (
              <div className="flex gap-2">
                <button onClick={() => handleApproveRequest(j)} disabled={processingId === `${j.id}-approve`} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-md text-xs transition-colors flex justify-center items-center gap-1.5 disabled:opacity-50">
                  {processingId === `${j.id}-approve` ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {processingId === `${j.id}-approve` ? 'Procesando...' : 'Aprobar'}
                </button>
                <button onClick={() => handleRejectRequest(j)} className="flex-1 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-semibold py-2.5 rounded-md text-xs transition-colors flex justify-center items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Rechazar
                </button>
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold text-center py-2.5 rounded-md flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" /> Pendiente de Aprobación
              </div>
            )}
          </>
        )}
        {isAdminView && j.photoOverrideRequested && !j.photoOverrideApproved && (
          <div className="mb-1 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-md">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Conductor solicita omitir fotos de llegada</p>
            <button onClick={() => handleApprovePhotoOverride(j)} disabled={processingId === `${j.id}-approve-photo`} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 rounded text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {processingId === `${j.id}-approve-photo` ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Aprobar Omisión
            </button>
          </div>
        )}

        {(!isRequested && (j.status === 'accepted' || j.status === 'pending_guide') && j.acceptedByEmail !== currentUserEmail) ? (
          <div className="flex flex-col gap-2">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium text-center py-2.5 rounded-md">Vehículo a cargo de un compañero.</div>
            {isAdminView && (
              <button
                type="button"
                onClick={() => setExpenseModalJob && setExpenseModalJob(j)}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 px-3 rounded-md text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4 text-emerald-200" />
                <span>Ingreso de Gastos</span>
                {j.expenses && j.expenses.length > 0 && (
                  <span className="ml-1 bg-emerald-900/60 text-white px-2 py-0.5 rounded font-mono text-[10px] font-semibold">
                    {j.expenses.length} (${j.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('es-CL')})
                  </span>
                )}
              </button>
            )}
          </div>
        ) : (
          <>
            {isPending && (!isAdminView || j.assignedEmails?.includes(currentUserEmail)) && (
              <SwipeButton key={`btn-accept-${j.id}`} onConfirm={() => handleAcceptJob(j)} text="Desliza para Aceptar" colorClass="bg-blue-600" isProcessing={processingId === `${j.id}-accept`} />
            )}

            {isAccepted && (j.acceptedByEmail === currentUserEmail) && (
              <>
                {isPendingGuide ? (
                  <div className="flex flex-col gap-2">
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold text-center py-2.5 rounded-md flex items-center justify-center gap-1.5">
                      <Clock className="w-4 h-4" /> A ESPERA DE GUÍA DE DESPACHO
                    </div>
                    <button onClick={() => { setGuideUploadJob(j); setGuideLink(''); setGuideFileBase64(null); }} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-md text-xs transition-colors flex justify-center items-center gap-2">
                      <FileText className="w-4 h-4" /> Subir Guía y Finalizar
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseModalJob && setExpenseModalJob(j)}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 px-3 rounded-md text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4 text-emerald-200" />
                      <span>Ingreso de Gastos</span>
                      {j.expenses && j.expenses.length > 0 && (
                        <span className="ml-1 bg-emerald-900/60 text-white px-2 py-0.5 rounded font-mono text-[10px] font-semibold">
                          {j.expenses.length} (${j.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('es-CL')})
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    {(!j.phase || j.phase === 'claimed') && <SwipeButton key={`btn-pickup-${j.id}`} onConfirm={() => updatePhase(j, 'arrived_pickup', { arrivedPickupAt: Date.now() })} text={j.tripType === 'simple' ? "Desliza: Llegué al lugar" : "Desliza: Llegué a retirar"} icon={<MapPin className="w-4 h-4" />} colorClass="bg-amber-600" isProcessing={processingId === `${j.id}-arrived_pickup`} />}

                    {j.phase === 'arrived_pickup' && <SwipeButton key={`btn-power-${j.id}`} onConfirm={() => {
                      const waitMins = j.arrivedPickupAt ? Math.floor((Date.now() - j.arrivedPickupAt) / 60000) : 0;
                      setPickupPromptJob(j);
                    }} text={j.tripType === 'simple' ? "Desliza: Iniciar Trabajo" : "Desliza: Vehículo en mi poder"} icon={j.tripType === 'simple' ? <Clock className="w-4 h-4" /> : <Car className="w-4 h-4" />} colorClass="bg-blue-600" isProcessing={processingId === `${j.id}-picked_up`} />}

                    {j.phase === 'picked_up' && j.tripType !== 'revision' && (!j.waypoints || j.waypoints.length === 0) && <SwipeButton key={`btn-dest-${j.id}`} onConfirm={() => {
                      setArrivalPromptJob(j);
                      setArrivalMileage('');
                      setArrivalPhoto(null);
                      setMenuOpenId(null);
                    }} text={j.tripType === 'simple' ? "Desliza: Finalizar Trabajo" : "Desliza: Llegué a Destino"} icon={<MapPin className="w-4 h-4" />} colorClass="bg-blue-700" isProcessing={processingId === `${j.id}-arrived_destination`} />}

                    {j.phase === 'picked_up' && j.tripType !== 'revision' && j.waypoints && j.waypoints.length > 0 && <SwipeButton key={`btn-wp1-${j.id}`} onConfirm={() => {
                      updatePhase(j, 'arrived_waypoint', { arrivedWaypointAt: Date.now() });
                    }} text="Desliza: Llegué a 1ra Parada" icon={<MapPin className="w-4 h-4" />} colorClass="bg-blue-600" isProcessing={processingId === `${j.id}-arrived_waypoint`} />}

                    {j.phase === 'arrived_waypoint' && <SwipeButton key={`btn-wp2-${j.id}`} onConfirm={() => {
                      updatePhase(j, 'departed_waypoint', { departedWaypointAt: Date.now() });
                    }} text="Desliza: Camino a Destino Final" icon={<Car className="w-4 h-4" />} colorClass="bg-blue-700" isProcessing={processingId === `${j.id}-departed_waypoint`} />}

                    {j.phase === 'departed_waypoint' && <SwipeButton key={`btn-dest-final-${j.id}`} onConfirm={() => {
                      setArrivalPromptJob(j);
                      setArrivalMileage('');
                      setArrivalPhoto(null);
                      setMenuOpenId(null);
                    }} text="Desliza: Llegué a Destino Final" icon={<MapPin className="w-4 h-4" />} colorClass="bg-blue-700" isProcessing={processingId === `${j.id}-arrived_destination`} />}

                    {j.phase === 'picked_up' && j.tripType === 'revision' && <SwipeButton key={`btn-prt-${j.id}`} onConfirm={() => updatePhase(j, 'arrived_prt')} text="Desliza: Llegué a PRT" icon={<MapPin className="w-4 h-4" />} colorClass="bg-blue-700" isProcessing={processingId === `${j.id}-arrived_prt`} />}

                    {j.phase === 'arrived_prt' && (() => {
                      const assigned = (j.destination || '').includes('->')
                        ? j.destination.split('->').slice(1).join('->').trim()
                        : (!j.destination?.toLowerCase().includes('prt') && !j.destination?.toLowerCase().includes('planta') ? (j.destination?.trim() || '') : '');
                      return (
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setPrtApproveType('aprobado');
                            if (assigned) {
                              setPrtReturnOpt('destination');
                              setPrtReturnDest(assigned);
                            } else {
                              setPrtReturnOpt('origin');
                              setPrtReturnDest('');
                            }
                            setPrtApprovePromptJob(j);
                          }} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-md text-xs transition-colors flex justify-center items-center gap-1.5 disabled:opacity-50 cursor-pointer">
                            {processingId === `${j.id}-prt_done` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} {processingId === `${j.id}-prt_done` ? 'Procesando...' : 'Aprobado'}
                          </button>
                          <button onClick={() => {
                            setPrtReturnOpt('origin');
                            setPrtReturnDest('');
                            setPrtPromptJob(j);
                          }} disabled={processingId === `${j.id}-prt_done`} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-md text-xs transition-colors disabled:opacity-50 flex justify-center items-center gap-1.5 cursor-pointer">
                            {processingId === `${j.id}-prt_done` ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} {processingId === `${j.id}-prt_done` ? 'Procesando...' : 'Rechazado'}
                          </button>
                        </div>
                      );
                    })()}

                    {j.phase === 'prt_done' && (() => {
                      const targetDest = getRtFinalDestination(j);
                      const displayDest = targetDest.length > 15 ? targetDest.substring(0, 15) + '...' : targetDest;
                      return (
                        <SwipeButton key={`btn-dest-prt-${j.id}`} onConfirm={() => {
                          setArrivalPromptJob(j);
                          setArrivalMileage('');
                          setArrivalPhoto(null);
                          setMenuOpenId(null);
                        }} text={`Desliza: Llegué a ${displayDest}`} icon={<MapPin className="w-4 h-4" />} colorClass="bg-blue-700" isProcessing={processingId === `${j.id}-arrived_destination`} />
                      );
                    })()}

                    {/* BOTÓN: INGRESO DE GASTOS */}
                    <button
                      type="button"
                      onClick={() => setExpenseModalJob && setExpenseModalJob(j)}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 px-3 rounded-md text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4 text-emerald-200" />
                      <span>Ingreso de Gastos</span>
                      {j.expenses && j.expenses.length > 0 && (
                        <span className="ml-1 bg-emerald-900/60 text-white px-2 py-0.5 rounded font-mono text-[10px] font-semibold">
                          {j.expenses.length} (${j.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('es-CL')})
                        </span>
                      )}
                    </button>

                    <button onClick={() => onStartChecklist(j)} className={`w-full font-semibold py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 ${(j.phase === 'arrived_destination') ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'}`}>
                      <Camera className="w-3.5 h-3.5" /> {(j.phase === 'arrived_destination') ? (j.tripType === 'simple' ? 'Cerrar Acta de Servicio' : 'Cerrar Checklist') : (j.tripType === 'simple' ? 'Pre-llenar Acta' : 'Pre-llenar Checklist')}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* MODAL DE FOTOS DE DOCUMENTOS DEL VEHÍCULO */}
      {showDocsModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[9999] flex items-center justify-center p-4 cursor-default" onClick={() => setShowDocsModal(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-md p-5 flex flex-col shadow-lg relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/60">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase">Documentos del Vehículo</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{ident}</p>
                </div>
              </div>
              <button onClick={() => setShowDocsModal(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { id: 'soap', label: 'Seguro SOAP' },
                { id: 'permiso', label: 'Permiso de Circulación' },
                { id: 'revTecnica', label: 'Revisión Técnica' },
                { id: 'gases', label: 'Gases' }
              ].map(docItem => {
                const url = combinedDocPhotos[docItem.id];
                if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
                return (
                  <div
                    key={docItem.id}
                    onClick={() => { setShowDocsModal(false); setFullScreenPhoto(url); }}
                    className="bg-slate-50 dark:bg-slate-800/60 hover:border-blue-500 border border-slate-200 dark:border-slate-700 rounded-md p-2 flex flex-col items-center gap-1.5 cursor-pointer transition-colors group"
                  >
                    <div className="w-full aspect-[4/3] rounded overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      <img src={url} alt={docItem.label} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 text-center truncate w-full">{docItem.label}</span>
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1"><Search className="w-3 h-3" /> Ver documento</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
              <button
                onClick={() => setShowDocsModal(false)}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 rounded-md text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
