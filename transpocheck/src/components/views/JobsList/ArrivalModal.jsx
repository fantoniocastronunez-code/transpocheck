import React, { useState, useRef } from 'react';
import { X, Key, CheckCircle, Clock, Camera, Trash2, ArrowLeft } from 'lucide-react';
import PointerRange from '../../ui/PointerRange';
import { isTrailerVehicle } from '../../../utils/helpers';

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
  openCamera,
  vehicles = []
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
  const isTrailerJob = isTrailerVehicle(arrivalPromptJob, vehicles);

  return (
    <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-[200] p-4 overflow-hidden">
      <div className="bg-slate-900 p-5 rounded-lg shadow-lg w-full max-w-sm flex flex-col relative overflow-y-auto max-h-[82vh] border border-slate-800 pb-6 my-auto" style={{ WebkitOverflowScrolling: 'touch' }}>

        <h3 className="text-base font-bold text-white mb-5 mt-1 tracking-tight text-center">
          {isTrailerJob ? 'Registro de Llegada (Carro de Arrastre)' : (isServiceJob ? 'Registro de Llegada' : 'Combustible y Kilometraje')}
        </h3>

        {arrivalPromptJob?.photoOverrideApproved && (
          <div className="mb-4 bg-emerald-950/40 p-2.5 rounded-md border border-emerald-800/60 relative z-10">
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center justify-center gap-1.5 uppercase tracking-wider text-center">
              <CheckCircle className="w-4 h-4" /> Excepción de fotos aprobada
            </p>
          </div>
        )}

        <div className="space-y-5 relative z-10 flex-1">
          {isTrailerJob ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-950/50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-800/60 text-emerald-400">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Carro de Arrastre</h4>
              <p className="text-xs font-medium text-slate-300 mt-1.5 max-w-[260px] mx-auto leading-relaxed">
                Este vehículo no utiliza kilometraje ni combustible. Presiona confirmar para registrar la llegada a destino.
              </p>
            </div>
          ) : !isServiceJob ? (
            <>
              {/* Odómetro */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1 px-1">
                  <label className="text-xs text-slate-300 font-semibold">Odómetro Final</label>
                  <span className="text-xs text-slate-500 font-mono">KM</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={arrivalMileage || ''}
                    onChange={e => setArrivalMileage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-md text-center text-2xl font-mono font-bold text-white outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <p className="text-center text-[10px] text-slate-500 mt-1 font-medium uppercase tracking-wider">Ingresa el Kilometraje de Término</p>
              </div>

              {/* Medidor Combustible Visual */}
              <div className="mt-3 mb-7">
                <div className="flex flex-col items-center justify-center mb-4">
                  <div className="text-2xl font-mono font-bold text-white">
                    {arrivalFuelLevel === 0 ? 'Vacío' : arrivalFuelLevel === 1 ? 'Full' : `${Math.round((arrivalFuelLevel ?? 0) * 100)}%`}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Nivel Final</div>
                </div>

                <div className="relative pt-2 pb-8 px-3">
                  {/* Pista de fondo */}
                  <div className="absolute top-1/2 left-3 right-3 h-3 bg-slate-800 -translate-y-1/2 rounded-full border border-slate-700" />
                  
                  {/* Relleno Activo */}
                  <div className="absolute top-1/2 left-3 right-3 h-3 -translate-y-1/2 pointer-events-none rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-150"
                      style={{ width: `${(arrivalFuelLevel ?? 0) * 100}%` }}
                    />
                  </div>

                  {/* Marcas divisorias */}
                  <div className="absolute top-1/2 left-3 right-3 h-3 -translate-y-1/2 pointer-events-none flex justify-between px-1 items-center">
                    <div className="w-0.5 h-1.5 bg-slate-950/60"></div>
                    <div className="w-0.5 h-1.5 bg-slate-950/60"></div>
                    <div className="w-0.5 h-1.5 bg-slate-950/60"></div>
                    <div className="w-0.5 h-1.5 bg-slate-950/60"></div>
                    <div className="w-0.5 h-1.5 bg-slate-950/60"></div>
                  </div>

                  <PointerRange
                    min={0}
                    max={1}
                    step={0.05}
                    value={arrivalFuelLevel}
                    onChange={setArrivalFuelLevel}
                    ariaLabel="Nivel de combustible final"
                    className="absolute top-1/2 left-3 w-[calc(100%-24px)] h-8 -translate-y-1/2 cursor-pointer z-10"
                  />
                  
                  {/* Botón Pulgar Visual */}
                  <div 
                    className="absolute top-1/2 w-5 h-5 bg-white border-2 border-blue-600 rounded-full -translate-y-1/2 pointer-events-none transition-all duration-150"
                    style={{ left: `calc(12px + (100% - 24px) * ${arrivalFuelLevel ?? 0} - 10px)` }}
                  />
                  
                  {/* Etiquetas */}
                  <div className="absolute top-full left-0 w-full flex justify-between mt-1.5 text-[10px] font-mono font-semibold text-slate-400">
                    <span className="text-red-400">0</span>
                    <span>1/4</span>
                    <span>1/2</span>
                    <span>3/4</span>
                    <span className="text-emerald-400">FULL</span>
                  </div>
                </div>
              </div>

              {/* Botones de fotos */}
              <div className="flex flex-col gap-2.5 mt-3">
                <button
                  type="button"
                  onClick={() => openCamera('Foto del Odómetro', 'arrivalPhoto')}
                  className={`w-full py-2.5 rounded-md flex items-center justify-center gap-2 border transition-colors ${arrivalPhoto ? 'border-emerald-700 bg-emerald-950/40 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                >
                  {processingId === 'processing-arrivalPhoto' ? <Clock className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {arrivalPhoto ? 'Foto Odómetro (OK)' : 'Subir Foto Odómetro'}
                  </span>
                </button>
                {arrivalPhoto && (
                  <div className="relative">
                    <img src={arrivalPhoto} alt="Odómetro" className="w-full h-20 object-cover rounded-md border border-emerald-700/60" />
                    <button type="button" onClick={() => setArrivalPhoto(null)} className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-md">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openCamera('Foto del Medidor de Combustible', 'arrivalFuelPhoto')}
                  className={`w-full py-2.5 rounded-md flex items-center justify-center gap-2 border transition-colors ${arrivalFuelPhoto ? 'border-emerald-700 bg-emerald-950/40 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                >
                  {processingId === 'processing-arrivalFuelPhoto' ? <Clock className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {arrivalFuelPhoto ? 'Foto Recibo/Tablero (OK)' : 'Medidor de Combustible'}
                  </span>
                </button>
                {arrivalFuelPhoto && (
                  <div className="relative">
                    <img src={arrivalFuelPhoto} alt="Combustible" className="w-full h-20 object-cover rounded-md border border-emerald-700/60" />
                    <button type="button" onClick={() => setArrivalFuelPhoto(null)} className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-md">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-blue-950/50 rounded-md flex items-center justify-center mx-auto mb-3 border border-blue-800/60">
                <CheckCircle className="w-7 h-7 text-blue-400" />
              </div>
              <p className="text-sm font-medium text-slate-300">Confirma la finalización del servicio simple.</p>
            </div>
          )}

          {!isServiceJob && !isTrailerJob && (!arrivalFuelPhoto || !arrivalPhoto) && !arrivalPromptJob.photoOverrideApproved && (
            <button 
              onClick={() => handleRequestPhotoOverride(arrivalPromptJob)} 
              disabled={processingId === 'photo-override'}
              className="w-full mt-3 py-2.5 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 text-amber-400 rounded-md font-semibold text-xs uppercase tracking-wider transition-colors"
            >
              {processingId === 'photo-override' ? 'Solicitando...' : arrivalPromptJob.photoOverrideRequested ? 'Permiso Solicitado (Avisa al admin)' : 'Solicitar Excepción de Fotos'}
            </button>
          )}

        </div>

        {/* Navegación inferior */}
        <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-800 relative z-10">
          <button
            onClick={() => setArrivalPromptJob(null)}
            className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>

          <button
            onClick={() => submitArrival()}
            disabled={processingId === 'general-arrival'}
            className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {processingId === 'general-arrival' ? <Clock className="w-4 h-4 animate-spin" /> : <>Confirmar <ArrowLeft className="w-4 h-4 rotate-180" /></>}
          </button>
        </div>

      </div>
    </div>
  );
}
