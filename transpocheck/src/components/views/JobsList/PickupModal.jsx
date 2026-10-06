import React, { useState, useRef } from 'react';
import { X, Key, CheckCircle, Clock, Camera, Trash2, ArrowLeft } from 'lucide-react';

export default function PickupModal({
  pickupPromptJob,
  setPickupPromptJob,
  pickupMileage,
  setPickupMileage,
  pickupPhoto,
  setPickupPhoto,
  pickupFuelPhoto,
  setPickupFuelPhoto,
  pickupFuelLevel,
  setPickupFuelLevel,
  processingId,
  submitPickup,
  handleRequestPhotoOverride,
  openCamera
}) {
  if (!pickupPromptJob) return null;

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
    setPickupFuelLevel((angle + 90) / 180);
  };

  const isServiceJob = pickupPromptJob?.tripType === 'simple';

  return (
    <div className="fixed inset-0 bg-[#060b19]/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 overflow-hidden animate-in fade-in">
      <div className="bg-slate-900/60 p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(59,130,246,0.15)] w-full max-w-sm flex flex-col relative overflow-y-auto max-h-[75vh] border border-slate-700/50 backdrop-blur-3xl pb-8 my-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-blue-500/50 rounded-full blur-[40px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-12 bg-blue-500/30 rounded-full blur-[40px] pointer-events-none" />

        <h3 className="text-lg font-bold text-white mb-6 mt-2 tracking-wide text-center">
          {isServiceJob ? 'Inicio de Servicio' : 'Combustible y Kilometraje Inicial'}
        </h3>

        {pickupPromptJob?.photoOverrideApproved && (
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
                   <label className="text-xs text-slate-300 font-medium tracking-wide">Odómetro Inicial</label>
                   <span className="text-xs text-slate-500 font-medium">Km</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={pickupMileage || ''}
                    onChange={e => setPickupMileage(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700/50 p-4 rounded-[1.5rem] text-center text-3xl font-black text-white outline-none focus:border-blue-500/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all shadow-inner"
                  />
                </div>
                <p className="text-center text-[10px] text-slate-500 mt-2 font-medium tracking-wide uppercase">Ingresa el Kilometraje Inicial</p>
              </div>

              {/* Medidor Combustible Visual (Línea Recta) */}
              <div className="mt-4 mb-4">
                <div className="flex flex-col items-center justify-center mb-6">
                  <div className="text-3xl font-black text-white tracking-wider">
                    {pickupFuelLevel === 0 ? 'Vacío' : pickupFuelLevel === 1 ? 'Full' : `${Math.round((pickupFuelLevel ?? 0) * 100)}%`}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">Nivel Inicial</div>
                </div>

                <div className="relative pt-2 pb-8 px-3">
                  {/* Pista de fondo */}
                  <div className="absolute top-1/2 left-3 right-3 h-4 bg-slate-800 -translate-y-1/2 rounded-full border border-slate-700/50" />
                  
                  {/* Relleno Activo */}
                  <div 
                    className="absolute top-1/2 left-3 h-4 bg-gradient-to-r from-red-500 via-amber-500 to-green-500 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-200 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                    style={{ width: `calc(${(pickupFuelLevel ?? 0) * 100}% * (1 - 24px/100%) )` /* aproximación para que no se pase */, width: `calc(${(pickupFuelLevel ?? 0) * 100}% - ${(pickupFuelLevel ?? 0) * 16}px)` }}
                  />
                  
                  {/* Fix del ancho del relleno para que coincida con el rango */}
                  <div className="absolute top-1/2 left-3 right-3 h-4 -translate-y-1/2 pointer-events-none rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 transition-all duration-200"
                      style={{ width: `${(pickupFuelLevel ?? 0) * 100}%` }}
                    />
                  </div>

                  {/* Marcas divisorias */}
                  <div className="absolute top-1/2 left-3 right-3 h-4 -translate-y-1/2 pointer-events-none flex justify-between px-1 items-center">
                     <div className="w-0.5 h-2 bg-slate-900/50 rounded-full"></div>
                     <div className="w-0.5 h-2 bg-slate-900/50 rounded-full"></div>
                     <div className="w-0.5 h-2 bg-slate-900/50 rounded-full"></div>
                     <div className="w-0.5 h-2 bg-slate-900/50 rounded-full"></div>
                     <div className="w-0.5 h-2 bg-slate-900/50 rounded-full"></div>
                  </div>

                  {/* Input Rango Real */}
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={pickupFuelLevel ?? 0}
                    onChange={(e) => setPickupFuelLevel(parseFloat(e.target.value))}
                    className="absolute top-1/2 left-3 w-[calc(100%-24px)] h-8 -translate-y-1/2 opacity-0 cursor-pointer z-10"
                  />
                  
                  {/* Botón Pulgar Visual */}
                  <div 
                    className="absolute top-1/2 w-6 h-6 bg-white border-4 border-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] -translate-y-1/2 pointer-events-none transition-all duration-200"
                    style={{ left: `calc(12px + ${(pickupFuelLevel ?? 0) * 100}% * ((100% - 24px) / 100%) - 12px)`, left: `calc(12px + (100% - 24px) * ${pickupFuelLevel ?? 0} - 12px)` }}
                  />
                  
                  {/* Etiquetas */}
                  <div className="absolute top-full left-0 w-full flex justify-between mt-2 text-[10px] font-extrabold tracking-wider text-slate-400">
                    <span className="text-red-400">0</span>
                    <span>1/4</span>
                    <span>1/2</span>
                    <span>3/4</span>
                    <span className="text-green-400">FULL</span>
                  </div>
                </div>
              </div>

              {/* Botones de fotos */}
              <div className="flex flex-col gap-3 mt-4">
                <button
                   type="button"
                   onClick={() => openCamera('Foto del Odómetro', 'pickupPhoto')}
                   className={`relative overflow-hidden w-full py-3.5 rounded-[1.25rem] flex items-center justify-center gap-2 border transition-all ${pickupPhoto ? 'border-green-500/50 bg-green-900/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-blue-500/30 bg-gradient-to-b from-blue-600/20 to-blue-900/40 text-blue-300 hover:from-blue-500/30 hover:to-blue-800/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                >
                   {processingId === 'processing-image' ? <Clock className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                   <span className="text-xs font-bold tracking-wider uppercase">
                      {pickupPhoto ? 'Foto Odómetro (OK)' : 'Subir Foto Odómetro'}
                   </span>
                </button>
                {pickupPhoto && (
                  <div className="relative animate-in fade-in slide-in-from-top-2">
                    <img src={pickupPhoto} alt="Odómetro" className="w-full h-20 object-cover rounded-2xl border border-green-500/30 opacity-70" />
                    <button type="button" onClick={() => setPickupPhoto(null)} className="absolute top-1.5 right-1.5 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full shadow-md backdrop-blur-sm">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                   type="button"
                   onClick={() => openCamera('Foto del Medidor de Combustible', 'pickupFuelPhoto')}
                   className={`relative overflow-hidden w-full py-3.5 rounded-[1.25rem] flex items-center justify-center gap-2 border transition-all ${pickupFuelPhoto ? 'border-green-500/50 bg-green-900/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-blue-500/30 bg-gradient-to-b from-blue-600/20 to-blue-900/40 text-blue-300 hover:from-blue-500/30 hover:to-blue-800/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}
                >
                   {processingId === 'processing-image' ? <Clock className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                   <span className="text-xs font-bold tracking-wider uppercase">
                      {pickupFuelPhoto ? 'Foto Recibo/Tablero (OK)' : 'Medidor de Combustible'}
                   </span>
                </button>
                {pickupFuelPhoto && (
                  <div className="relative animate-in fade-in slide-in-from-top-2">
                    <img src={pickupFuelPhoto} alt="Combustible" className="w-full h-20 object-cover rounded-2xl border border-green-500/30 opacity-70" />
                    <button type="button" onClick={() => setPickupFuelPhoto(null)} className="absolute top-1.5 right-1.5 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full shadow-md backdrop-blur-sm">
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
               <p className="text-sm font-medium text-slate-300">Confirma el inicio del servicio simple.</p>
             </div>
          )}

          {!isServiceJob && (!pickupFuelPhoto || !pickupPhoto) && !pickupPromptJob.photoOverrideApproved && (
            <button 
              onClick={() => handleRequestPhotoOverride(pickupPromptJob)} 
              disabled={processingId === 'photo-override'}
              className="w-full mt-4 py-3 bg-orange-900/30 hover:bg-orange-800/50 border border-orange-500/30 text-orange-400 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-sm transition-colors"
            >
              {processingId === 'photo-override' ? 'Solicitando...' : pickupPromptJob.photoOverrideRequested ? 'Permiso Solicitado (Avisa al admin)' : 'Solicitar Excepción de Fotos'}
            </button>
          )}

        </div>

        {/* Navegación inferior tipo mockup */}
        <div className="flex justify-between items-center mt-4 relative z-10 px-2">
          <button
            onClick={() => setPickupPromptJob(null)}
            className="w-12 h-12 rounded-full bg-[#131b2e] border border-slate-700/50 text-slate-400 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex gap-2">
             <div className="w-2 h-2 rounded-full bg-slate-600"></div>
             <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
          </div>

          <button
            onClick={() => submitPickup()}
            disabled={processingId === 'general-pickup'}
            className="w-12 h-12 rounded-full bg-[#131b2e] border border-blue-500/30 text-blue-400 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.2)] disabled:opacity-50"
          >
            {processingId === 'general-pickup' ? <Clock className="w-5 h-5 animate-spin" /> : <ArrowLeft className="w-5 h-5 rotate-180" />}
          </button>
        </div>

      </div>
    </div>
  );
}
