import React from 'react';
import { X, Navigation, CheckCircle, MapPin, Clock, Car } from 'lucide-react';
import SwipeButton from '../../ui/SwipeButton';

export default function TrackingModal({
  jobs,
  trackingJobId,
  setTrackingJobId,
  getJobIdentifier,
  updatePhase,
  processingId,
  setArrivalPromptJob,
  setArrivalMileage,
  setArrivalPhoto,
  setArrivalKeyLocation,
  setArrivalKeyHandedTo,
  onStartChecklist,
  setPrtApproveType,
  setPrtReturnOpt,
  setPrtReturnDest,
  setPrtApprovePromptJob,
  setPrtPromptJob
}) {
  if (!trackingJobId) return null;

  const tj = jobs.find(j => j.id === trackingJobId);
  if (!tj) return null;
  const isSimple = tj.tripType === 'simple';
  const ident = getJobIdentifier(tj);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[500] flex items-end justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 flex flex-col relative max-h-[95vh]">
        <div className="absolute top-0 left-0 right-0 h-2 bg-blue-600"></div>
        <div className="flex justify-between items-start mb-4 mt-2">
          <div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-600"/> Panel de Viaje</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">{isSimple ? tj.description : `${tj.brand} ${tj.model}`} • {ident}</p>
          </div>
          <button onClick={() => setTrackingJobId(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5 text-slate-600"/></button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 pb-4 scrollbar-none">
          {/* ESTADOS DEL VIAJE */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute left-[27px] top-8 bottom-8 w-1 bg-slate-200 rounded-full"></div>
            {/* Origen */}
            <div className="flex gap-4 items-start relative z-10 mb-6">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${tj.phase && tj.phase !== 'claimed' ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                {tj.phase && tj.phase !== 'claimed' ? <CheckCircle className="w-3 h-3 text-white"/> : <div className="w-2 h-2 bg-slate-300 rounded-full"></div>}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Origen</p>
                <p className={`text-sm font-bold ${tj.phase && tj.phase !== 'claimed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{tj.origin}</p>
              </div>
            </div>
            {/* Destino */}
            <div className="flex gap-4 items-start relative z-10">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${tj.phase === 'arrived_destination' ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'}`}>
                {tj.phase === 'arrived_destination' ? <CheckCircle className="w-3 h-3 text-white"/> : <div className="w-2 h-2 bg-slate-300 rounded-full"></div>}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Destino</p>
                <p className="text-sm font-bold text-blue-700">{tj.tripType === 'revision' ? (tj.destination?.includes('->') ? tj.destination.split('->')[tj.destination.split('->').length - 1].trim() : 'PRT') : (tj.destination || 'Por definir')}</p>
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN RÁPIDA */}
          <div className="space-y-3 pt-2">
            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest text-center mb-2 animate-bounce">Desliza para actualizar estado</p>

            {(!tj.phase || tj.phase === 'claimed') && <SwipeButton key={`btn-pickup-${tj.id}`} onConfirm={()=>updatePhase(tj, 'arrived_pickup', { arrivedPickupAt: Date.now() })} text={tj.tripType === 'simple' ? "Desliza: Llegué al lugar" : "Desliza: Llegué a retirar"} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-amber-500" isProcessing={processingId === `${tj.id}-arrived_pickup`} />}

            {tj.phase === 'arrived_pickup' && <SwipeButton key={`btn-power-${tj.id}`} onConfirm={()=>{
              const waitMins = tj.arrivedPickupAt ? Math.floor((Date.now() - tj.arrivedPickupAt) / 60000) : 0;
              updatePhase(tj, 'picked_up', { pickedUpAt: Date.now(), waitTimeMinutes: waitMins });
            }} text={tj.tripType === 'simple' ? "Desliza: Iniciar Trabajo" : "Desliza: Vehículo en mi poder"} icon={tj.tripType === 'simple' ? <Clock className="w-4 h-4"/> : <Car className="w-4 h-4"/>} colorClass="bg-indigo-600" isProcessing={processingId === `${tj.id}-picked_up`} />}

            {tj.phase === 'picked_up' && tj.tripType !== 'revision' && <SwipeButton key={`btn-dest-${tj.id}`} onConfirm={()=>{
                setArrivalPromptJob(tj); 
                setArrivalMileage(''); 
                setArrivalPhoto(null); 
                setArrivalKeyLocation(''); 
                setArrivalKeyHandedTo(''); 
                setTrackingJobId(null);
            }} text={tj.tripType === 'simple' ? "Desliza: Finalizar Trabajo" : "Desliza: Llegué a Destino"} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${tj.id}-arrived_destination`} />}

            {tj.phase === 'picked_up' && tj.tripType === 'revision' && <SwipeButton key={`btn-prt-${tj.id}`} onConfirm={()=>updatePhase(tj, 'arrived_prt')} text="Desliza: Llegué a PRT" icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${tj.id}-arrived_prt`} />}

            {tj.phase === 'arrived_prt' && (
              <div className="flex gap-2">
                <button onClick={() => { setPrtApproveType('aprobado'); setPrtReturnOpt('origin'); setPrtReturnDest(''); setPrtApprovePromptJob(tj); setTrackingJobId(null); }} disabled={processingId === `${tj.id}-prt_done`} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-sm transition-colors flex justify-center items-center gap-1 disabled:opacity-50">
                  {processingId === `${tj.id}-prt_done` ? <Clock className="w-4 h-4 animate-spin"/> : '✅'} Aprobado
                </button>
                <button onClick={() => { setPrtReturnOpt('origin'); setPrtReturnDest(''); setPrtPromptJob(tj); setTrackingJobId(null); }} disabled={processingId === `${tj.id}-prt_done`} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-sm transition-colors disabled:opacity-50">
                  ❌ Rechazado
                </button>
              </div>
            )}

            {tj.phase === 'prt_done' && (
              <SwipeButton key={`btn-dest-prt-${tj.id}`} onConfirm={()=>{
                  setArrivalPromptJob(tj); 
                  setArrivalMileage(''); 
                  setArrivalPhoto(null); 
                  setArrivalKeyLocation(''); 
                  setArrivalKeyHandedTo(''); 
                  setTrackingJobId(null);
              }} text={`Desliza: Llegué a ${tj.checklist?.rtReturnOption === 'other' ? (tj.checklist?.rtReturnDestination?.substring(0,10) + '...') : 'Origen'}`} icon={<MapPin className="w-4 h-4"/>} colorClass="bg-purple-600" isProcessing={processingId === `${tj.id}-arrived_destination`} />
            )}

            <button onClick={()=>{ setTrackingJobId(null); onStartChecklist(tj); }} className={`w-full font-black py-4 rounded-xl text-sm shadow-sm transition-colors ${(tj.phase === 'arrived_destination') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}>
              📸 {(tj.phase === 'arrived_destination') ? (tj.tripType === 'simple' ? 'Cerrar Acta de Servicio' : 'Cerrar Checklist') : (tj.tripType === 'simple' ? 'Pre-llenar Acta' : 'Pre-llenar Checklist')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
