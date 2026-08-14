import React from 'react';
import { X, Key, CheckCircle, Clock, Camera, Trash2 } from 'lucide-react';

export default function ArrivalModal({
  arrivalPromptJob,
  setArrivalPromptJob,
  arrivalMileage,
  setArrivalMileage,
  arrivalPhoto,
  setArrivalPhoto,
  arrivalKeyLocation,
  setArrivalKeyLocation,
  arrivalKeyHandedTo,
  setArrivalKeyHandedTo,
  processingId,
  submitArrival,
  openCamera
}) {
  if (!arrivalPromptJob) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col animate-in zoom-in-95 border-t-8 my-auto border-purple-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-500"/> Registro de Llegada
            </h3>
            <button onClick={()=>setArrivalPromptJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-4 h-4"/></button>
          </div>
          
          <p className="text-xs font-bold text-slate-500 mb-4 pb-4 border-b border-slate-100">Por favor, registra el kilometraje final y la ubicación de las llaves del vehículo (opcional).</p>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Kilometraje de Término</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={arrivalMileage} onChange={e=>setArrivalMileage(e.target.value)} placeholder="Ej: 45250" className="flex-1 border-2 bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none shadow-sm border-slate-200 focus:border-purple-400"/>
                <button 
                  type="button" 
                  onClick={() => openCamera('Foto del Odómetro', 'arrivalPhoto')}
                  className={`h-[48px] px-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all shrink-0 ${arrivalPhoto ? 'bg-green-100 text-green-700 border-2 border-green-400 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-2 border-slate-200'}`}
                >
                  {arrivalPhoto ? <><CheckCircle className="w-5 h-5" /> Foto</> : <><Camera className="w-5 h-5" /> Foto</>}
                </button>
              </div>
              {arrivalPhoto && (
                <div className="mt-2 relative animate-in fade-in slide-in-from-top-2">
                  <img src={arrivalPhoto} alt="Odómetro" className="w-full h-28 object-cover rounded-xl border-2 border-green-300 shadow-sm" />
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
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">¿Dónde dejaste las llaves?</label>
              <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => setArrivalKeyLocation('puestas')} className={`p-3 rounded-xl border-2 text-sm font-bold transition-colors text-left flex items-center justify-between ${arrivalKeyLocation === 'puestas' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                    Puestas {arrivalKeyLocation === 'puestas' && <CheckCircle className="w-4 h-4"/>}
                  </button>
                  <button onClick={() => setArrivalKeyLocation('puerta')} className={`p-3 rounded-xl border-2 text-sm font-bold transition-colors text-left flex items-center justify-between ${arrivalKeyLocation === 'puerta' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                    En la puerta {arrivalKeyLocation === 'puerta' && <CheckCircle className="w-4 h-4"/>}
                  </button>
                  <button onClick={() => setArrivalKeyLocation('mano')} className={`p-3 rounded-xl border-2 text-sm font-bold transition-colors text-left flex items-center justify-between ${arrivalKeyLocation === 'mano' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                    Entregadas por mano {arrivalKeyLocation === 'mano' && <CheckCircle className="w-4 h-4"/>}
                  </button>
              </div>
              {arrivalKeyLocation === 'mano' && (
                  <input type="text" value={arrivalKeyHandedTo} onChange={e=>setArrivalKeyHandedTo(e.target.value)} placeholder="Nombre de quien recibe" className="w-full border-2 border-purple-200 bg-purple-50 p-3 rounded-xl font-bold text-purple-900 outline-none focus:border-purple-400 mt-2 shadow-sm animate-in fade-in slide-in-from-top-2"/>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => submitArrival(true)} disabled={processingId === 'general-arrival'} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-extrabold text-sm transition-colors disabled:opacity-50">
              Omitir
            </button>
            <button onClick={() => submitArrival(false)} disabled={processingId === 'general-arrival'} className="flex-[2] py-3.5 text-white bg-purple-600 hover:bg-purple-700 rounded-xl font-black text-sm shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {processingId === 'general-arrival' ? <Clock className="w-5 h-5 animate-spin"/> : <CheckCircle className="w-5 h-5"/>} Guardar Datos
            </button>
          </div>
      </div>
    </div>
  );
}
