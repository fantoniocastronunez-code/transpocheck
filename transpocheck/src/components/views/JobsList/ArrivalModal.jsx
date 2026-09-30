import React, { useState, useRef } from 'react';
import { X, Key, CheckCircle, Clock, Camera, Trash2, ArrowLeft } from 'lucide-react';

export default function ArrivalModal({
  arrivalPromptJob,
  setArrivalPromptJob,
  arrivalMileage,
  setArrivalMileage,
  arrivalPhoto,
  setArrivalPhoto,
  arrivalFuelPhoto,
  setArrivalFuelPhoto,
  arrivalFuelLevel,
  setArrivalFuelLevel,
  processingId,
  submitArrival,
  handleRequestPhotoOverride,
  openCamera
}) {
  if (!arrivalPromptJob) return null;

  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef(null);

  const updateFuelFromEvent = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (clientX == null || clientY == null) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * (100 / 110);
    const dx = clientX - centerX;
    const dy = centerY - clientY;
    let angle = Math.atan2(dx, dy) * (180 / Math.PI);
    if (angle < -90) angle = -90;
    if (angle > 90) angle = 90;
    setArrivalFuelLevel((angle + 90) / 180);
  };

  const isServiceJob = arrivalPromptJob?.tripType === 'simple';

  return (
    <div className="fixed inset-0 bg-[#060b19]/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 overflow-hidden animate-in fade-in">
      <div className="bg-slate-900/60 p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(59,130,246,0.15)] w-full max-w-sm flex flex-col relative overflow-hidden border border-slate-700/50 backdrop-blur-3xl pb-8 my-auto">
        {/* Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-blue-500/50 rounded-full blur-[40px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-12 bg-blue-500/30 rounded-full blur-[40px] pointer-events-none" />

        <h3 className="text-lg font-bold text-white mb-6 mt-2 tracking-wide text-center">
          {isServiceJob ? 'Registro de Llegada' : 'Combustible y Kilometraje'}
        </h3>

        {arrivalPromptJob?.photoOverrideApproved && (
          <div className="mb-4 bg-green-500/10 p-3 rounded-2xl border border-green-500/30 relative z-10">
            <p className="text-[10px] font-bold text-green-400 flex items-center justify-center gap-2 uppercase tracking-widest text-center">
              <CheckCircle className="w-4 h-4" /> Excepción de fotos aprobada
            </p>
          </div>
        )}

        <div className="space-y-6 relative z-10 flex-1">
          {!isServiceJob ? (
            <>
              {/* Odómetro */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1 px-4">
                   <label className="text-xs text-slate-300 font-medium tracking-wide">Odómetro Final</label>
                   <span className="text-xs text-slate-500 font-medium">Km</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={arrivalMileage || ''}
                    onChange={e => setArrivalMileage(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700/50 p-4 rounded-[1.5rem] text-center text-3xl font-black text-white outline-none focus:border-blue-500/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all shadow-inner"
                  />
                </div>
                <p className="text-center text-[10px] text-slate-500 mt-2 font-medium tracking-wide uppercase">Ingresa el Kilometraje de Término</p>
              </div>

              {/* Medidor Combustible Visual */}
              <div className="relative w-full aspect-[2/1] mt-4 flex items-end justify-center">
                 <svg 
                    ref={svgRef}
                    viewBox="0 0 200 110" 
                    className="w-[90%] overflow-visible touch-none cursor-pointer"
                    onPointerDown={(e) => { setIsDragging(true); updateFuelFromEvent(e); e.currentTarget.setPointerCapture(e.pointerId); }}
                    onPointerMove={(e) => { if(isDragging) updateFuelFromEvent(e); }}
                    onPointerUp={(e) => { setIsDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
                    onPointerCancel={(e) => { setIsDragging(false); }}
                 >
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                    <path 
                      d="M 20 100 A 80 80 0 0 1 180 100" 
                      fill="none" 
                      stroke="url(#fuelGradient)" 
                      strokeWidth="12" 
                      strokeLinecap="round" 
                      strokeDasharray={`${Math.PI * 80 * (arrivalFuelLevel ?? 0)} ${Math.PI * 80}`}
                      style={{ transition: isDragging ? 'none' : 'stroke-dasharray 0.3s ease-out' }}
                    />
                    <defs>
                      <linearGradient id="fuelGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>

                    <g transform={`translate(100, 100) rotate(${-90 + ((arrivalFuelLevel ?? 0) * 180)})`} style={{ transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      <circle cx="0" cy="0" r="8" fill="#3b82f6" className="shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                      <circle cx="0" cy="0" r="4" fill="#0f172a" />
                      <path d="M -3 -8 L 0 -65 L 3 -8 Z" fill="#3b82f6" />
                    </g>

                    <text x="100" y="65" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
                      {arrivalFuelLevel === 0 ? 'Vacío' : arrivalFuelLevel === 1 ? 'Full' : `${Math.round((arrivalFuelLevel ?? 0) * 100)}%`}
                    </text>
                    <text x="100" y="80" textAnchor="middle" fill="#64748b" fontSize="10">nivel final</text>
                    
                    <text x="15" y="115" textAnchor="middle" fill="#ec4899" fontSize="12" fontWeight="bold">E</text>
                    <text x="185" y="115" textAnchor="middle" fill="#06b6d4" fontSize="12" fontWeight="bold">F</text>
                 </svg>
              </div>

              {/* Botones de fotos */}
              <div className="flex flex-col gap-3 mt-4">
                <button
                   type="button"
                   onClick={() => openCamera('Foto del Odómetro', 'arrivalPhoto')}
                   className={`relative overflow-hidden w-full py-3.5 rounded-[1.25rem] flex items-center justify-center gap-2 border transition-all ${arrivalPhoto ? 'border-green-500/50 bg-green-900/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-blue-500/30 bg-gradient-to-b from-blue-600/20 to-blue-900/40 text-blue-300 hover:from-blue-500/30 hover:to-blue-800/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                >
                   {processingId === 'processing-image' ? <Clock className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                   <span className="text-xs font-bold tracking-wider uppercase">
                      {arrivalPhoto ? 'Foto Odómetro (OK)' : 'Subir Foto Odómetro'}
                   </span>
                </button>
                {arrivalPhoto && (
                  <div className="relative animate-in fade-in slide-in-from-top-2">
                    <img src={arrivalPhoto} alt="Odómetro" className="w-full h-20 object-cover rounded-2xl border border-green-500/30 opacity-70" />
                    <button type="button" onClick={() => setArrivalPhoto(null)} className="absolute top-1.5 right-1.5 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full shadow-md backdrop-blur-sm">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                   type="button"
                   onClick={() => openCamera('Foto del Medidor de Combustible', 'arrivalFuelPhoto')}
                   className={`relative overflow-hidden w-full py-3.5 rounded-[1.25rem] flex items-center justify-center gap-2 border transition-all ${arrivalFuelPhoto ? 'border-green-500/50 bg-green-900/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-blue-500/30 bg-gradient-to-b from-blue-600/20 to-blue-900/40 text-blue-300 hover:from-blue-500/30 hover:to-blue-800/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                >
                   {processingId === 'processing-image' ? <Clock className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                   <span className="text-xs font-bold tracking-wider uppercase">
                      {arrivalFuelPhoto ? 'Foto Recibo/Tablero (OK)' : 'Subir Foto Recibo'}
                   </span>
                </button>
                {arrivalFuelPhoto && (
                  <div className="relative animate-in fade-in slide-in-from-top-2">
                    <img src={arrivalFuelPhoto} alt="Combustible" className="w-full h-20 object-cover rounded-2xl border border-green-500/30 opacity-70" />
                    <button type="button" onClick={() => setArrivalFuelPhoto(null)} className="absolute top-1.5 right-1.5 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full shadow-md backdrop-blur-sm">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
             <div className="text-center py-10">
               <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                 <CheckCircle className="w-10 h-10 text-blue-400" />
               </div>
               <p className="text-sm font-medium text-slate-300">Confirma la finalización del servicio simple.</p>
             </div>
          )}

          {!isServiceJob && (!arrivalFuelPhoto || !arrivalPhoto) && !arrivalPromptJob.photoOverrideApproved && (
            <button 
              onClick={() => handleRequestPhotoOverride(arrivalPromptJob)} 
              disabled={processingId === 'photo-override'}
              className="w-full mt-4 py-3 bg-orange-900/30 hover:bg-orange-800/50 border border-orange-500/30 text-orange-400 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-sm transition-colors"
            >
              {processingId === 'photo-override' ? 'Solicitando...' : arrivalPromptJob.photoOverrideRequested ? 'Permiso Solicitado (Avisa al admin)' : 'Solicitar Excepción de Fotos'}
            </button>
          )}

        </div>

        {/* Navegación inferior tipo mockup */}
        <div className="flex justify-between items-center mt-8 relative z-10 px-2">
          <button
            onClick={() => setArrivalPromptJob(null)}
            className="w-12 h-12 rounded-full bg-[#131b2e] border border-slate-700/50 text-slate-400 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex gap-2">
             <div className="w-2 h-2 rounded-full bg-slate-600"></div>
             <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
          </div>

          <button
            onClick={() => submitArrival()}
            disabled={processingId === 'general-arrival'}
            className="w-12 h-12 rounded-full bg-[#131b2e] border border-blue-500/30 text-blue-400 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.2)] disabled:opacity-50"
          >
            {processingId === 'general-arrival' ? <Clock className="w-5 h-5 animate-spin" /> : <ArrowLeft className="w-5 h-5 rotate-180" />}
          </button>
        </div>

      </div>
    </div>
  );
}
