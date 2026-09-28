import React from 'react';
import { X, Key, CheckCircle, Clock, Camera, Trash2 } from 'lucide-react';

export default function ArrivalModal({
  arrivalPromptJob,
  setArrivalPromptJob,
  arrivalMileage,
  setArrivalMileage,
  arrivalPhoto,
  setArrivalPhoto,
  arrivalFuelPhoto,
  setArrivalFuelPhoto,
  processingId,
  submitArrival,
  openCamera
}) {
  if (!arrivalPromptJob) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col animate-in zoom-in-95 border-t-8 my-auto border-purple-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-500"/> Registro de Llegada
            </h3>
            <button onClick={()=>setArrivalPromptJob(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"><X className="w-4 h-4"/></button>
          </div>
          
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">Por favor, registra el nivel de combustible y el kilometraje final.</p>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Medidor de Combustible (Obligatorio)</label>
              <div className="flex items-center gap-2 mt-1 mb-4">
                <button 
                  type="button" 
                  onClick={() => openCamera('Foto del Medidor de Combustible', 'arrivalFuelPhoto')}
                  className={`h-[48px] px-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all w-full ${arrivalFuelPhoto ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-2 border-green-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-700'}`}
                >
                  {processingId === 'processing-image' ? <><Clock className="w-5 h-5 animate-spin" /> Procesando...</> : arrivalFuelPhoto ? <><CheckCircle className="w-5 h-5" /> Foto Capturada</> : <><Camera className="w-5 h-5" /> Tomar Foto del Medidor</>}
                </button>
              </div>
              {arrivalFuelPhoto && (
                <div className="mt-2 mb-4 relative animate-in fade-in slide-in-from-top-2">
                  <img src={arrivalFuelPhoto} alt="Combustible" className="w-full h-28 object-cover rounded-xl border-2 border-green-300 dark:border-green-700/50 shadow-sm" />
                  <button 
                    type="button" 
                    onClick={() => setArrivalFuelPhoto(null)}
                    className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Kilometraje de Término (Obligatorio)</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={arrivalMileage} onChange={e=>setArrivalMileage(e.target.value)} placeholder="Ej: 45250" className="w-[130px] shrink-0 border-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm border-slate-200 dark:border-slate-700 focus:border-purple-400"/>
                <button 
                  type="button" 
                  onClick={() => openCamera('Foto del Odómetro', 'arrivalPhoto')}
                  className={`h-[48px] px-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all flex-1 ${arrivalPhoto ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-2 border-green-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-700'}`}
                >
                  {processingId === 'processing-image' ? <><Clock className="w-5 h-5 animate-spin" /> Procesando...</> : arrivalPhoto ? <><CheckCircle className="w-5 h-5" /> Foto Odómetro</> : <><Camera className="w-5 h-5" /> Foto Odómetro</>}
                </button>
              </div>
              {arrivalPhoto && (
                <div className="mt-2 relative animate-in fade-in slide-in-from-top-2">
                  <img src={arrivalPhoto} alt="Odómetro" className="w-full h-28 object-cover rounded-xl border-2 border-green-300 dark:border-green-700/50 shadow-sm" />
                  <button 
                    type="button" 
                    onClick={() => setArrivalPhoto(null)}
                    className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setArrivalPromptJob(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl font-extrabold text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={() => submitArrival()} disabled={processingId === 'general-arrival'} className="flex-[2] py-3.5 text-white bg-purple-600 hover:bg-purple-700 rounded-xl font-black text-sm shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {processingId === 'general-arrival' ? <Clock className="w-5 h-5 animate-spin"/> : <CheckCircle className="w-5 h-5"/>} Finalizar Traslado
            </button>
          </div>
      </div>
    </div>
  );
}
