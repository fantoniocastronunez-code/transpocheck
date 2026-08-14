import React from 'react';
import { Camera, XCircle, FileText, CheckCircle, Upload, Trash2, Info } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step3Damage({ job, formData, setF, handleImageUpload, removeImage, addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex, setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex, setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData, setTempDamageData }) {
  return (
    <>
                {job.tripType !== 'simple' && step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Observaciones Generales</h3>
                <textarea className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[90px]" placeholder="Escribe aquí si hay algún daño, rayón o comentario del estado visual del vehículo..." autoComplete="off" autoCorrect="off" spellCheck="false" value={formData.observations || ''} onChange={(e) => setF('observations', e.target.value)} />
              </div>

              {/* NUEVO: NOTAS DURANTE EL TRASLADO */}
              <div className="space-y-4 bg-orange-50 p-4 rounded-3xl border border-orange-200 shadow-sm">
                <h3 className="text-sm font-extrabold pb-2 text-orange-800 uppercase tracking-wider flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Notas durante el traslado</h3>
                <p className="text-[10px] font-bold text-orange-600 leading-tight">Usa este espacio para reportar eventos como: ruidos extraños, pinchazos, piquetes en parabrisas, u otras novedades ocurridas netamente en la ruta.</p>
                <textarea className="w-full border-2 border-orange-200 p-3 rounded-xl text-sm font-bold text-orange-800 outline-none focus:border-orange-500 min-h-[90px] bg-white placeholder-orange-300" placeholder="Ej: Piquete en parabrisas en carretera, neumático con baja presión..." autoComplete="off" autoCorrect="off" spellCheck="false" value={formData.transitNotes || ''} onChange={(e) => setF('transitNotes', e.target.value)} />
              </div>

              {/* NUEVO: VERIFICACIÓN DE EQUIPAMIENTO */}
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                <label className="flex items-center gap-3 cursor-pointer relative z-10">
                  <input type="checkbox" checked={formData.hasEquipment || false} onChange={e => setF('hasEquipment', e.target.checked)} className="w-6 h-6 rounded cursor-pointer accent-blue-600" />
                  <span className="font-black text-slate-800 text-sm tracking-wide">VERIFICAR EQUIPAMIENTO</span>
                </label>

                {formData.hasEquipment && (
                  <div className="animate-in fade-in slide-in-from-top-2 pt-3 border-t border-slate-200 space-y-4 relative z-10">
                    <div className="grid grid-cols-2 gap-3">
                      {equipmentList.map(item => {
                        const isChecked = formData.equipment?.[item] || false;
                        return (
                          <label key={item} className={`flex items-start gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer select-none ${isChecked ? 'border-blue-500 bg-blue-100 text-blue-900 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}>
                            <input type="checkbox" checked={isChecked} onChange={e => setF('equipment', { ...formData.equipment, [item]: e.target.checked })} className="w-4 h-4 accent-blue-600 rounded shrink-0 mt-0.5" />
                            <span className="text-[11px] font-extrabold leading-tight">{item}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="space-y-1.5 pt-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Herramientas u otros detalles</label>
                      <input type="text" placeholder="Ej: Destornillador, chaleco extra..." value={formData.equipmentDetails || ''} onChange={e => setF('equipmentDetails', e.target.value)} autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-xs outline-none focus:border-blue-500 shadow-inner bg-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
    </>
  );
}