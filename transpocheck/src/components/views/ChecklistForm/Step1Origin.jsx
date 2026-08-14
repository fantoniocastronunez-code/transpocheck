import React from 'react';
import { Camera, MapPin, Upload, XCircle, Search, Save, PenTool, CheckCircle, Clock } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step1Origin({ job, formData, setF, handleImageUpload, removeImage, getRouteStr, allClientsList }) {
  return (
    <>
                {job.tripType === 'simple' && step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-purple-50 border-2 border-purple-100 p-4 rounded-2xl shadow-sm mb-4">
                <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Descripción de la Tarea</p>
                <p className="text-sm font-bold text-purple-900 leading-snug">{job.description || 'Sin descripción detallada'}</p>
                {job.client && <p className="text-xs font-bold text-purple-700 mt-2 border-t border-purple-200 pt-2">Cliente / Autoriza: {job.client}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase">Lugar</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{job.origin || 'N/A'}</p>
                </div>
                {job.destination && (
                  <div className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase">Hasta</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{job.destination}</p>
                  </div>
                )}
              </div>

              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 mt-6 text-slate-800 uppercase tracking-wider">Notas del Operario</h3>
              <textarea className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-purple-500 min-h-[100px]" placeholder="Ej: Las plantillas de vinilo no dejaron residuos. Trabajo ejecutado sin novedades..." autoComplete="off" autoCorrect="off" spellCheck="false" value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />
            </div>
          )}
                {job.tripType !== 'simple' && step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">              {isQuick ? (
              <div className="space-y-2">
                <select value={formData.client} onChange={(e) => setF('client', e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 bg-white outline-none focus:border-blue-500">
                  <option value="">Selecciona el Cliente...</option>
                  {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="OTRO">Otro (Ingreso Manual)</option>
                </select>
                {formData.client === 'OTRO' && <input value={formData.manualClient} onChange={e => setF('manualClient', e.target.value)} placeholder="Escribe el nombre del cliente" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-700 mt-2" />}
              </div>
            ) : (
              <input value={formData.client} onChange={e => setF('client', e.target.value)} placeholder="Cliente" autoComplete="off" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 bg-slate-50" readOnly />
            )}

              <div className="grid grid-cols-2 gap-4">
                <input value={formData.brand} onChange={e => setF('brand', e.target.value)} placeholder="Marca" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800" />
                <input value={formData.model} onChange={e => setF('model', e.target.value)} placeholder="Modelo" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl font-bold text-slate-800" />
              </div>
              <input value={formData.plateOrVin} onChange={e => setF('plateOrVin', e.target.value)} placeholder="Patente o VIN" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 border-slate-300 bg-slate-100 p-3 rounded-xl font-black uppercase text-slate-800 shadow-inner mt-2" />

              {/* ALERTA DÉJÀ VU PERICIAL */}
              {dejaVuData && (
                <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-2xl shadow-sm animate-in zoom-in-95 flex items-start gap-3 mt-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                  <div className="bg-purple-200 p-2 rounded-full text-purple-700 animate-pulse shrink-0">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-purple-800 uppercase tracking-widest mb-1">Déjà Vu Pericial</h4>
                    <p className="text-[11px] font-bold text-purple-600 leading-tight mb-3">
                      Hay registros de daños previos en este vehículo (Traslado del {new Date(dejaVuData.completedAt).toLocaleDateString()}).
                    </p>
                    <button type="button" onClick={() => setShowDejaVuModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase transition-colors shadow-sm w-full">
                      Ver Daños Anteriores
                    </button>
                  </div>
                </div>
              )}


              {job.tripType === 'revision' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 mt-4">
                  <h3 className="text-sm font-extrabold text-blue-600 uppercase tracking-wider flex items-center gap-2"><Clock className="w-5 h-5" /> Tiempo en Planta</h3>

                  {(!formData.prtArrivalTime && formData.rtStatus === 'pendiente') && (
                    <button type="button" onClick={() => setF('prtArrivalTime', Date.now())} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-md shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95">
                      <MapPin className="w-5 h-5" /> LLEGUÉ A LA PRT (Iniciar Tiempo)
                    </button>
                  )}

                  {formData.prtArrivalTime && (
                    <div className="bg-blue-50 border-2 border-blue-200 p-3.5 rounded-xl flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${formData.rtStatus === 'pendiente' ? 'bg-blue-200 text-blue-700 animate-spin' : 'bg-green-200 text-green-700'}`}>
                          {formData.rtStatus === 'pendiente' ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Cronómetro Trámite</p>
                          <p className="text-sm font-bold text-blue-600">
                            {formData.rtStatus === 'pendiente'
                              ? `${Math.floor((nowTick - formData.prtArrivalTime) / 60000)} minutos corriendo...`
                              : `${Math.floor(((formData.prtFinishTime || Date.now()) - formData.prtArrivalTime) / 60000)} min en total (Finalizado)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(formData.prtArrivalTime || formData.rtStatus !== 'pendiente') && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider mt-5 mb-2">Resultado de la Revisión</h3>
                      <select value={formData.rtStatus} onChange={e => {
                        setF('rtStatus', e.target.value);
                        if (e.target.value !== 'pendiente' && !formData.prtFinishTime && formData.prtArrivalTime) {
                          setF('prtFinishTime', Date.now()); // Detiene el cronómetro para siempre
                        }
                      }} className={`w-full border-2 p-3.5 rounded-xl outline-none font-extrabold text-sm ${formData.rtStatus === 'pendiente' ? 'border-blue-300 bg-white text-blue-700' : formData.rtStatus === 'aprobado' ? 'border-green-200 bg-green-50 text-green-700' : formData.rtStatus === 'aprobado_ayuda' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        <option value="pendiente" disabled>⏳ TRÁMITE EN CURSO...</option>
                        <option value="aprobado">✅ APROBADO</option>
                        <option value="aprobado_ayuda">🤝 APROBADO CON AYUDA</option>
                        <option value="rechazado">❌ RECHAZADO</option>
                      </select>
                    </div>
                  )}

                  {formData.rtStatus === 'rechazado' && (
                    <input value={formData.rtRejectReason} onChange={e => setF('rtRejectReason', e.target.value)} placeholder="¿Cuál fue la razón del rechazo?" required={formData.rtStatus === 'rechazado'} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-red-300 p-3 rounded-xl outline-none focus:border-red-500 font-bold text-red-900 bg-white mt-2 animate-in fade-in" />
                  )}
                  {(formData.rtStatus === 'aprobado' || formData.rtStatus === 'aprobado_ayuda') && (
                    <div className="mt-2 p-3 border border-green-200 bg-white rounded-xl space-y-2 animate-in fade-in">
                      <p className="text-xs font-bold text-green-800">¿Hacia dónde se dirige el vehículo tras aprobar?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e => setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600" />
                          Volver al Origen
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700">
                          <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e => setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600" />
                          Otro Destino
                        </label>
                      </div>
                      {formData.rtReturnOption === 'other' && (
                        <input value={formData.rtReturnDestination} onChange={e => setF('rtReturnDestination', e.target.value)} placeholder="Especifique el destino final..." required={formData.rtReturnOption === 'other'} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-green-300 p-2.5 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 bg-white" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
    </>
  );
}