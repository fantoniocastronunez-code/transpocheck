import React, { useEffect, useState } from 'react';
import { Search, Clock, MapPin, CheckCircle } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { useDejaVu } from '../hooks/useDejaVu';

export const StepData = () => {
  const { job, formData, setF, isQuick, allClientsList } = useChecklist();
  
  // Custom hook para el Déjà Vu Pericial
  const { dejaVuData, showDejaVuModal, setShowDejaVuModal } = useDejaVu(formData.plateOrVin, job?.id);

  // Reloj local para trámite PRT
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (formData.prtArrivalTime && formData.rtStatus === 'pendiente') {
      const interval = setInterval(() => setNowTick(Date.now()), 60000);
      return () => clearInterval(interval);
    }
  }, [formData.prtArrivalTime, formData.rtStatus]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Selector de Cliente */}
      {isQuick ? (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente</label>
          <div className="relative">
            <select
              value={formData.client}
              onChange={(e) => setF('client', e.target.value)}
              className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 appearance-none shadow-sm transition-all"
            >
              <option value="">Selecciona el Cliente...</option>
              {allClientsList.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="OTRO">Otro (Ingreso Manual)</option>
            </select>
          </div>
          {formData.client === 'OTRO' && (
            <input
              value={formData.manualClient}
              onChange={e => setF('manualClient', e.target.value)}
              placeholder="Escribe el nombre del cliente"
              autoComplete="off" autoCorrect="off" spellCheck="false"
              className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-slate-700 dark:text-slate-300 mt-2 shadow-sm focus:border-blue-500 outline-none transition-all"
            />
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente Asignado</label>
          <input
            value={formData.client}
            readOnly
            className="w-full border border-slate-200/60 dark:border-slate-700/50 p-3.5 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 cursor-not-allowed"
          />
        </div>
      )}

      {/* Datos del Vehículo */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        
        <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
          Vehículo
        </h3>
        
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <input
            value={formData.brand}
            onChange={e => setF('brand', e.target.value)}
            placeholder="Marca"
            autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters"
            className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 rounded-2xl font-bold text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all shadow-inner"
          />
          <input
            value={formData.model}
            onChange={e => setF('model', e.target.value)}
            placeholder="Modelo"
            autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters"
            className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 rounded-2xl font-bold text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all shadow-inner"
          />
        </div>
        
        <div className="relative z-10 pt-1">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1">Patente o VIN</label>
          <input
            value={formData.plateOrVin}
            onChange={e => setF('plateOrVin', e.target.value)}
            placeholder="XX-YY-11"
            autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters"
            className="w-full border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl font-black text-lg uppercase text-slate-800 dark:text-slate-200 shadow-inner text-center tracking-[0.2em] focus:border-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* ALERTA DÉJÀ VU PERICIAL */}
      {dejaVuData && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border-2 border-purple-200 dark:border-purple-800/50 p-4 rounded-3xl shadow-sm animate-in zoom-in-95 flex items-start gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
          <div className="bg-purple-200/50 dark:bg-purple-800/50 p-2.5 rounded-full text-purple-700 dark:text-purple-300 shrink-0">
            <Search className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <h4 className="text-[11px] font-black text-purple-800 dark:text-purple-300 uppercase tracking-widest mb-1">
              Déjà Vu Pericial
            </h4>
            <p className="text-[12px] font-bold text-purple-600/90 dark:text-purple-400/90 leading-snug mb-3">
              Hay registros de daños previos en este vehículo (Traslado del {new Date(dejaVuData.completedAt).toLocaleDateString()}).
            </p>
            <button 
              type="button" 
              onClick={() => setShowDejaVuModal(true)} 
              className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] px-4 py-2.5 rounded-xl font-black uppercase transition-colors shadow-md shadow-purple-500/20 w-full active:scale-95"
            >
              Ver Daños Anteriores
            </button>
          </div>
        </div>
      )}

      {/* Tiempos de Planta (Solo para revisiones) */}
      {job?.tripType === 'revision' && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
          <h3 className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" /> Tiempo en Planta (PRT)
          </h3>

          {(!formData.prtArrivalTime && formData.rtStatus === 'pendiente') && (
            <button 
              type="button" 
              onClick={() => setF('prtArrivalTime', Date.now())} 
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <MapPin className="w-5 h-5" /> LLEGUÉ A LA PRT (Iniciar Tiempo)
            </button>
          )}

          {formData.prtArrivalTime && (
            <div className="bg-blue-50/50 dark:bg-blue-900/20 border-2 border-blue-200/50 dark:border-blue-800/30 p-4 rounded-2xl flex justify-between items-center shadow-inner">
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-full ${formData.rtStatus === 'pendiente' ? 'bg-blue-200 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 animate-spin-slow' : 'bg-green-200 dark:bg-green-800/50 text-green-700 dark:text-green-300'}`}>
                  {formData.rtStatus === 'pendiente' ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-800/60 dark:text-blue-300/60 uppercase tracking-widest">Cronómetro</p>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mt-0.5">
                    {formData.rtStatus === 'pendiente'
                      ? `${Math.floor((nowTick - formData.prtArrivalTime) / 60000)} minutos en trámite...`
                      : `${Math.floor(((formData.prtFinishTime || Date.now()) - formData.prtArrivalTime) / 60000)} min en total`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(formData.prtArrivalTime || formData.rtStatus !== 'pendiente') && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Resultado de la Revisión</h3>
              <select 
                value={formData.rtStatus} 
                onChange={e => {
                  setF('rtStatus', e.target.value);
                  if (e.target.value !== 'pendiente' && !formData.prtFinishTime && formData.prtArrivalTime) {
                    setF('prtFinishTime', Date.now()); 
                  }
                }} 
                className={`w-full border-2 p-4 rounded-2xl outline-none font-black text-sm appearance-none shadow-sm transition-all
                ${formData.rtStatus === 'pendiente' 
                  ? 'border-blue-300 dark:border-blue-700/50 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400' 
                  : formData.rtStatus === 'aprobado' 
                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-green-500/10' 
                    : formData.rtStatus === 'aprobado_ayuda' 
                      ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 shadow-amber-500/10' 
                      : 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-red-500/10'
                }`}
              >
                <option value="pendiente" disabled>⏳ TRÁMITE EN CURSO...</option>
                <option value="aprobado">✅ APROBADO</option>
                <option value="aprobado_ayuda">🤝 APROBADO CON AYUDA</option>
                <option value="rechazado">❌ RECHAZADO</option>
              </select>
            </div>
          )}

          {formData.rtStatus === 'rechazado' && (
            <input 
              value={formData.rtRejectReason} 
              onChange={e => setF('rtRejectReason', e.target.value)} 
              placeholder="¿Cuál fue la razón del rechazo?" 
              required 
              autoComplete="off" autoCorrect="off" spellCheck="false" 
              className="w-full border-2 border-red-300 dark:border-red-700/50 p-3.5 rounded-2xl outline-none focus:border-red-500 font-bold text-red-900 dark:text-red-300 bg-white dark:bg-slate-900 mt-3 animate-in fade-in shadow-inner" 
            />
          )}

          {(formData.rtStatus === 'aprobado' || formData.rtStatus === 'aprobado_ayuda') && (
            <div className="mt-3 p-4 border border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-900/10 rounded-2xl space-y-3 animate-in fade-in">
              <p className="text-[11px] font-black text-green-800 dark:text-green-400 uppercase tracking-widest">¿Destino tras aprobar?</p>
              <div className="flex gap-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700 dark:text-green-300 select-none">
                  <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={e => setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600" />
                  Volver al Origen
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-green-700 dark:text-green-300 select-none">
                  <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={e => setF('rtReturnOption', e.target.value)} className="w-4 h-4 accent-green-600" />
                  Otro Destino
                </label>
              </div>
              {formData.rtReturnOption === 'other' && (
                <input 
                  value={formData.rtReturnDestination} 
                  onChange={e => setF('rtReturnDestination', e.target.value)} 
                  placeholder="Especifique el destino final..." 
                  required 
                  autoComplete="off" autoCorrect="off" spellCheck="false" 
                  className="w-full border-2 border-green-300 dark:border-green-700/50 p-3 rounded-xl outline-none focus:border-green-500 font-bold text-green-900 dark:text-green-300 bg-white dark:bg-slate-900 mt-2 shadow-inner" 
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
