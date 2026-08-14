import React from 'react';
import { Camera, Upload, XCircle, CheckCircle, Trash2 } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step5Extras({ job, formData, setF, handleImageUpload, removeImage }) {
  return (
    <>
                {job.tripType !== 'simple' && step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Combustible a Bordo</h3>

              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${formData.fuelLevel < 30 ? 'bg-red-50' : 'bg-slate-50'}`}>
                      <Fuel className={`w-6 h-6 ${formData.fuelLevel < 30 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estanque</p>
                      <p className={`text-2xl font-black leading-none transition-colors ${formData.fuelLevel < 30 ? 'text-red-600' : formData.fuelLevel <= 50 ? 'text-amber-500' : 'text-green-600'}`}>
                        {formData.fuelLevel}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors ${formData.fuelLevel == 0 ? 'bg-red-100 text-red-700' : formData.fuelLevel <= 25 ? 'bg-red-50 text-red-600' : formData.fuelLevel <= 50 ? 'bg-amber-50 text-amber-600' : formData.fuelLevel <= 75 ? 'bg-green-50 text-green-600' : 'bg-green-100 text-green-700'}`}>
                      {formData.fuelLevel == 0 ? 'Vacío' : formData.fuelLevel <= 25 ? 'Reserva' : formData.fuelLevel <= 50 ? 'Medio' : formData.fuelLevel <= 75 ? '3/4' : 'Lleno'}
                    </span>
                  </div>
                </div>


                <div className="relative pt-2 pb-2">
                  <div className="flex justify-between text-[11px] font-black px-1 mb-2">
                    <span className="text-red-500">E</span>
                    <span className="text-slate-300">1/4</span>
                    <span className="text-slate-300">1/2</span>
                    <span className="text-slate-300">3/4</span>
                    <span className="text-green-500">F</span>
                  </div>

                  <div className="relative h-10 w-full group">
                    <input
                      type="range"
                      min="0" max="100" step="5"
                      value={formData.fuelLevel}
                      onChange={(e) => setF('fuelLevel', Number(e.target.value))}
                      className="absolute z-20 w-full h-full opacity-0 cursor-pointer inset-0 m-0"
                    />

                    <div className="absolute inset-y-2 inset-x-0 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200 pointer-events-none">
                      <div className="absolute inset-0 flex justify-between px-[25%] z-10">
                        <div className="w-0.5 h-full bg-white/80"></div>
                        <div className="w-0.5 h-full bg-white/80"></div>
                        <div className="w-0.5 h-full bg-white/80"></div>
                      </div>

                      <div
                        className={`h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 relative ${formData.fuelLevel < 30
                            ? 'bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_10px,#dc2626_10px,#dc2626_20px)]'
                            : formData.fuelLevel <= 50
                              ? 'bg-amber-400'
                              : 'bg-green-500'
                          }`}
                        style={{ width: `${formData.fuelLevel}%` }}
                      >
                        <div className="w-1.5 h-3 bg-white/50 rounded-full relative z-20"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 mt-6 text-slate-800 uppercase tracking-wider">Viáticos y Esperas</h3>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Wallet className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase leading-none">Fondo Asignado</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Patente: {job.plate || job.vin || 'N/A'}</p>
                  </div>
                </div>
                <p className="text-xl font-extrabold text-blue-700">
                  {formatMoney((expenses || []).filter(g => g.jobId === job.id && g.type === 'assignment').reduce((acc, curr) => acc + Number(curr.amount || 0), 0))}
                </p>
              </div>


              {job.tripType === 'revision' && (job.rtData?.revision || job.rtData?.inspeccion || job.rtData?.frenos) && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-4 h-4" /> Valores pagados en Planta (PRT)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.rtData?.revision && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Revisión Técnica ($)</label>
                        <input type="number" placeholder="Ej: 20000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostRevision || ''} onChange={e => setF('prtCostRevision', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.inspeccion && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Inspección Visual ($)</label>
                        <input type="number" placeholder="Ej: 5000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostInspeccion || ''} onChange={e => setF('prtCostInspeccion', e.target.value)} />
                      </div>
                    )}
                    {job.rtData?.frenos && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-indigo-600 uppercase">Certificado Frenos ($)</label>
                        <input type="number" placeholder="Ej: 8000" className="w-full border-2 border-indigo-100 p-2 rounded-xl font-bold text-sm bg-white" value={formData.prtCostFrenos || ''} onChange={e => setF('prtCostFrenos', e.target.value)} />
                      </div>
                    )}
                  </div>
                </div>
              )}


              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 select-none shadow-sm ${(job.tripType === 'revision' && formData.prtArrivalTime) || job.waitTimeMinutes >= 1 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  <Clock className="w-5 h-5" />
                  {job.tripType === 'revision' && formData.prtArrivalTime ? (
                    <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">
                      Trámite PRT:<br />{Math.floor(((formData.prtFinishTime || Date.now()) - formData.prtArrivalTime) / 60000)} min
                    </span>
                  ) : (
                    <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Espera: {job.waitTimeMinutes || 0} min</span>
                  )}
                </div>


                <button type="button" onClick={() => setF('hasFuelCharge', !formData.hasFuelCharge)} className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all select-none shadow-sm ${formData.hasFuelCharge ? 'border-blue-500 bg-blue-500 text-white shadow-blue-100' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {formData.hasFuelCharge ? <CheckCircle className="w-5 h-5 animate-in zoom-in" /> : <Fuel className="w-5 h-5" />}
                  <span className="font-black text-xs uppercase tracking-wider text-center leading-tight">Carga Combust.</span>
                </button>
              </div>


              {formData.hasFuelCharge && (
                <div className="animate-in fade-in slide-in-from-top-2 border rounded-xl p-3 bg-slate-50 shadow-inner max-w-sm mx-auto">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider text-center mb-1">Monto Rendición Gasolinera ($)</p>
                  <input type="number" placeholder="Ej: 15000" value={formData.fuelChargeAmount || ''} onChange={(e) => setF('fuelChargeAmount', e.target.value)} className="w-full bg-white border p-2 rounded-xl text-center text-sm font-bold outline-none" />
                </div>
              )}
            </div>
          )}
    </>
  );
}