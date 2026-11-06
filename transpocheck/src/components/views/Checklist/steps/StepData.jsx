import React, { useEffect, useState } from 'react';
import { Search, Clock, MapPin, CheckCircle } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { useDejaVu } from '../hooks/useDejaVu';
import { db } from '../../../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import DejaVuModal from '../components/DejaVuModal';

export const StepData = () => {
  const { job, formData, setF, isQuick, allClientsList } = useChecklist();

  // Custom hook para el Déjà Vu Pericial
  const { dejaVuData, showDejaVuModal, setShowDejaVuModal } = useDejaVu(formData.plateOrVin, job?.id);

  // Reloj local para trámite PRT
  const [nowTick, setNowTick] = useState(Date.now());

  const assignedDest = (() => {
    if (!job || !job.destination) return '';
    if (job.destination.includes('->')) {
      const parts = job.destination.split('->').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) return parts.slice(1).join(' -> ');
    }
    const destLower = job.destination.toLowerCase();
    if (!destLower.includes('prt') && !destLower.includes('planta') && !destLower.includes('revision') && !destLower.includes('revisión')) {
      return job.destination.trim();
    }
    return '';
  })();

  useEffect(() => {
    if (formData.prtArrivalTime && formData.rtStatus === 'pendiente') {
      const interval = setInterval(() => setNowTick(Date.now()), 60000);
      return () => clearInterval(interval);
    }
  }, [formData.prtArrivalTime, formData.rtStatus]);

  return (
    <div className="space-y-4 animate-in fade-in duration-150 pt-3">

      {/* Selector de Cliente */}
      {isQuick ? (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cliente</label>
          <div className="relative">
            <select
              value={formData.client}
              onChange={(e) => setF('client', e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 p-3 rounded-lg font-semibold text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 outline-none focus:border-sky-600 appearance-none transition-colors"
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
              className="w-full border border-slate-300 dark:border-slate-700 p-3 rounded-lg font-semibold text-sm text-slate-800 dark:text-slate-200 mt-2 focus:border-sky-600 outline-none transition-colors bg-white dark:bg-slate-900"
            />
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cliente Asignado</label>
          <input
            value={formData.client}
            readOnly
            className="w-full border border-slate-200 dark:border-slate-800 p-3 rounded-lg font-semibold text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 cursor-not-allowed"
          />
        </div>
      )}

      {/* Datos del Vehículo */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 relative overflow-hidden">

        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          Vehículo
        </h3>

        <div className="relative">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block mb-1">Patente o VIN</label>
          <input
            value={formData.plateOrVin}
            onChange={e => setF('plateOrVin', e.target.value)}
            placeholder="XX-YY-11"
            autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters"
            className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg font-bold font-mono text-lg uppercase text-slate-900 dark:text-slate-100 text-center tracking-[0.15em] focus:border-sky-600 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            value={formData.brand}
            onChange={e => setF('brand', e.target.value)}
            placeholder="Marca"
            autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters"
            className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg font-semibold text-sm text-slate-800 dark:text-slate-200 focus:border-sky-600 focus:bg-white dark:focus:bg-slate-900 outline-none transition-colors"
          />
          <input
            value={formData.model}
            onChange={e => setF('model', e.target.value)}
            placeholder="Modelo"
            autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters"
            className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg font-semibold text-sm text-slate-800 dark:text-slate-200 focus:border-sky-600 focus:bg-white dark:focus:bg-slate-900 outline-none transition-colors"
          />
        </div>

        {/* Checkbox Vehículo Nuevo */}
        <label className="flex items-center gap-3 mt-3 cursor-pointer bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sky-500 transition-colors">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={formData.isNewVehicle || false}
              onChange={e => setF('isNewVehicle', e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 border rounded-md transition-colors flex items-center justify-center ${formData.isNewVehicle ? 'bg-sky-600 border-sky-600' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
              <CheckCircle className={`w-3.5 h-3.5 text-white transition-transform ${formData.isNewVehicle ? 'scale-100' : 'scale-0'}`} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Vehículo Nuevo</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">No cuenta con documentación (no suma puntos)</span>
          </div>
        </label>
      </div>

      {/* ALERTA DÉJÀ VU PERICIAL */}
      {dejaVuData && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-xl flex items-start gap-3 relative overflow-hidden">
          <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-lg text-amber-700 dark:text-amber-400 shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-1">
              Déjà Vu Pericial
            </h4>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400 leading-snug mb-3">
              Hay registros de daños previos en este vehículo (Traslado del {new Date(dejaVuData.completedAt).toLocaleDateString()}).
            </p>
            <button
              type="button"
              onClick={() => setShowDejaVuModal(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-colors w-full"
            >
              Ver Daños Anteriores
            </button>
          </div>
        </div>
      )}

      {/* Tiempos de Planta (Solo para revisiones) */}
      {job?.tripType === 'revision' && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" /> Tiempo en Planta (PRT)
          </h3>

          {(!formData.prtArrivalTime && formData.rtStatus === 'pendiente') && (
            <button
              type="button"
              onClick={async () => {
                setF('prtArrivalTime', Date.now());
                if (job?.phase === 'picked_up') {
                  try {
                    await updateDoc(doc(db, 'transport_jobs', job.id), { phase: 'arrived_prt' });
                  } catch (e) {
                    console.error("[ERR-PRT-01]", e);
                  }
                }
              }}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs uppercase tracking-wider"
            >
              <MapPin className="w-4 h-4" /> Llegué a la PRT (Iniciar Tiempo)
            </button>
          )}

          {formData.prtArrivalTime && (
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 p-3.5 rounded-lg flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${formData.rtStatus === 'pendiente' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'}`}>
                  {formData.rtStatus === 'pendiente' ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-sky-800/70 dark:text-sky-300/70 uppercase tracking-wider">Cronómetro</p>
                  <p className="text-sm font-bold font-mono text-sky-700 dark:text-sky-400 mt-0.5">
                    {formData.rtStatus === 'pendiente'
                      ? `${Math.floor((nowTick - formData.prtArrivalTime) / 60000)} minutos en trámite...`
                      : `${Math.floor(((formData.prtFinishTime || Date.now()) - formData.prtArrivalTime) / 60000)} min en total`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(formData.prtArrivalTime || formData.rtStatus !== 'pendiente') && (
            <div className="animate-in fade-in duration-150 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Resultado de la Revisión</h3>
              <select
                value={formData.rtStatus}
                onChange={e => {
                  setF('rtStatus', e.target.value);
                  if (e.target.value !== 'pendiente' && !formData.prtFinishTime && formData.prtArrivalTime) {
                    setF('prtFinishTime', Date.now());
                  }
                }}
                className={`w-full border p-3.5 rounded-lg outline-none font-bold text-xs uppercase tracking-wider appearance-none transition-colors
                ${formData.rtStatus === 'pendiente'
                    ? 'border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400'
                    : formData.rtStatus === 'aprobado'
                      ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                      : formData.rtStatus === 'aprobado_ayuda'
                        ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                        : 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                  }`}
              >
                <option value="pendiente" disabled>TRÁMITE EN CURSO...</option>
                <option value="aprobado">APROBADO</option>
                <option value="aprobado_ayuda">APROBADO CON AYUDA</option>
                <option value="rechazado">RECHAZADO</option>
              </select>
            </div>
          )}

          {formData.rtStatus === 'rechazado' && (
            <div className="space-y-3 animate-in fade-in">
              <input
                value={formData.rtRejectReason}
                onChange={e => setF('rtRejectReason', e.target.value)}
                placeholder="¿Cuál fue la razón del rechazo?"
                required
                autoComplete="off" autoCorrect="off" spellCheck="false"
                className="w-full border border-red-300 dark:border-red-700 p-3 rounded-lg outline-none focus:border-red-500 font-semibold text-sm text-red-900 dark:text-red-300 bg-white dark:bg-slate-900 mt-2"
              />
              <div className="p-3.5 border border-red-200 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/20 rounded-lg space-y-2.5">
                <p className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">¿Destino tras rechazo?</p>
                <div className="flex flex-wrap gap-4">
                  {assignedDest && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-red-700 dark:text-red-300 select-none">
                      <input type="radio" name="rtReturnOptionRej" value="destination" checked={formData.rtReturnOption === 'destination'} onChange={() => { setF('rtReturnOption', 'destination'); setF('rtReturnDestination', assignedDest); }} className="w-4 h-4 accent-red-600" />
                      Continuar a {assignedDest}
                    </label>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-red-700 dark:text-red-300 select-none">
                    <input type="radio" name="rtReturnOptionRej" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={() => { setF('rtReturnOption', 'origin'); setF('rtReturnDestination', ''); }} className="w-4 h-4 accent-red-600" />
                    Volver al Origen
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-red-700 dark:text-red-300 select-none">
                    <input type="radio" name="rtReturnOptionRej" value="other" checked={formData.rtReturnOption === 'other'} onChange={() => { setF('rtReturnOption', 'other'); setF('rtReturnDestination', ''); }} className="w-4 h-4 accent-red-600" />
                    Otro Destino
                  </label>
                </div>
                {formData.rtReturnOption === 'other' && (
                  <input
                    value={formData.rtReturnDestination}
                    onChange={e => setF('rtReturnDestination', e.target.value)}
                    placeholder="Especifique el destino final tras rechazo..."
                    required
                    autoComplete="off" autoCorrect="off" spellCheck="false"
                    className="w-full border border-red-300 dark:border-red-700 p-3 rounded-lg outline-none focus:border-red-500 font-semibold text-sm text-red-900 dark:text-red-300 bg-white dark:bg-slate-900 mt-2"
                  />
                )}
              </div>
            </div>
          )}

          {(formData.rtStatus === 'aprobado' || formData.rtStatus === 'aprobado_ayuda') && (
            <div className="mt-3 p-3.5 border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-lg space-y-2.5 animate-in fade-in">
              <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">¿Destino tras aprobar?</p>
              <div className="flex flex-wrap gap-4">
                {assignedDest && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-300 select-none">
                    <input type="radio" name="rtReturnOption" value="destination" checked={formData.rtReturnOption === 'destination'} onChange={() => { setF('rtReturnOption', 'destination'); setF('rtReturnDestination', assignedDest); }} className="w-4 h-4 accent-emerald-600" />
                    Continuar a {assignedDest}
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-300 select-none">
                  <input type="radio" name="rtReturnOption" value="origin" checked={formData.rtReturnOption === 'origin'} onChange={() => { setF('rtReturnOption', 'origin'); setF('rtReturnDestination', ''); }} className="w-4 h-4 accent-emerald-600" />
                  Volver al Origen
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-300 select-none">
                  <input type="radio" name="rtReturnOption" value="other" checked={formData.rtReturnOption === 'other'} onChange={() => { setF('rtReturnOption', 'other'); setF('rtReturnDestination', ''); }} className="w-4 h-4 accent-emerald-600" />
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
                  className="w-full border border-emerald-300 dark:border-emerald-700 p-3 rounded-lg outline-none focus:border-emerald-500 font-semibold text-sm text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-900 mt-2"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* RENDERIZADO DEL MODAL DÉJÀ VU */}
      <DejaVuModal
        showDejaVuModal={showDejaVuModal}
        setShowDejaVuModal={setShowDejaVuModal}
        dejaVuData={dejaVuData}
      />
    </div>
  );
};
