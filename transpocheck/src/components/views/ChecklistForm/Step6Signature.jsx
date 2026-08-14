import React from 'react';
import { MapPin, CheckCircle, CloudOff, Camera, Search, Clock, Share2, QrCode, Zap, Check } from 'lucide-react';
import SignaturePad from '../../ui/SignaturePad';

export default function Step6Signature(props) {
  const { job, formData, setF, handleImageUpload, removeImage, getRouteStr, drivers,
    handleQuickSetLocation, step, setStep, showAlert, allClientsList,
    addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex,
    setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex,
    setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData,
    setTempDamageData, fileInputRef, processingId, currentUserEmail,
    showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu,
    uploadProgress, cameraConfig, setCameraConfig, processingAction,
    handleRemoteSignRequest, handleOpenQR, handlePhotoClick, isSubmitting, clearDraft, isDraftLoaded } = props;

  return (
    <>
                {((job.tripType !== 'simple' && step === 6) || (job.tripType === 'simple' && step === 3)) && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Cierre y Conformidad</h3>

              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 mb-4 shadow-sm">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" /> Kilometraje de Entrega</h4>
                <div className="flex items-center gap-3">
                  <input type="number" placeholder="Ej: 145000" value={formData.mileage || ''} onChange={e => setF('mileage', e.target.value)} className="flex-1 border-2 border-slate-300 p-3 rounded-xl font-bold text-slate-700 text-sm outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => handlePhotoClick('mileage', 'Foto del Odómetro')} className={`h-[48px] px-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${formData.photos?.mileage ? 'bg-green-100 text-green-700 border-2 border-green-400 shadow-sm' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 border-2 border-transparent'}`}>
                    {formData.photos?.mileage ? <><CheckCircle className="w-5 h-5"/> Lista</> : <><Camera className="w-5 h-5"/> Foto</>}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-2xl border-slate-900 border-2 cursor-pointer shadow-md transition-colors hover:bg-slate-700">
                <input type="checkbox" checked={formData.noReception} onChange={e => setF('noReception', e.target.checked)} className="w-6 h-6 cursor-pointer accent-blue-500 rounded" />
                <span className="font-extrabold text-sm text-white">Dejar sin firma (Local cerrado / PRT)</span>
              </label>

              {!formData.noReception && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                  <h3 className="font-extrabold text-blue-800 mb-1 flex items-center gap-2"><Zap className="w-5 h-5" /> Firma Remota o QR</h3>
                  <p className="text-[11px] font-bold text-blue-600 mb-3">Envía el link al cliente o muéstrale el QR para que firme desde su celular.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleRemoteSignRequest} disabled={processingAction === 'wapp'} className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                      {processingAction === 'wapp' ? <Clock className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} {processingAction === 'wapp' ? 'Cargando...' : 'Compartir Link'}
                    </button>
                    <button type="button" onClick={handleOpenQR} disabled={processingAction === 'qr'} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-sm flex justify-center items-center gap-1.5 text-xs transition-colors">
                      {processingAction === 'qr' ? <Clock className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} {processingAction === 'qr' ? 'QR' : 'Mostrar QR'}
                    </button>
                  </div>
                </div>
              )}


              {!formData.noReception && (
                <div className="space-y-3">

                  <div className="flex items-center gap-2 my-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-bold text-slate-400 uppercase">Firma en pantalla</span><div className="h-px bg-slate-200 flex-1"></div></div>

                  <input required={!formData.noReception} value={formData.receiverName} onChange={e => setF('receiverName', e.target.value)} placeholder="Nombre del receptor" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm" />
                  <input value={formData.receiverRut} onChange={(e) => { let val = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase(); if (val.length > 1) { const dv = val.slice(-1); const body = val.slice(0, -1); val = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv; } setF('receiverRut', val); }} placeholder="RUT Receptor (Opcional)" maxLength="12" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="characters" className="w-full border-2 p-3 rounded-xl font-bold text-slate-700 text-sm" />

                  {formData.clientComments && (
                    <div className="bg-slate-100 p-2.5 rounded-xl border">
                      <p className="text-[9px] font-extrabold text-slate-500 uppercase">Comentarios del Receptor:</p>
                      <p className="text-xs font-bold text-slate-800 italic">"{formData.clientComments}"</p>
                    </div>
                  )}


                  <div className="relative mt-1">
                    {formData.signatureData && <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 z-10"><CheckCircle className="w-3 h-3" /> CAPTURADA</div>}
                    <SignaturePad initialData={formData.signatureData} onSave={d => setF('signatureData', d)} onClear={() => setF('signatureData', null)} />
                  </div>
                </div>
              )}
            </div>
          )}


          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-3 rounded-xl text-sm w-1/3 active:scale-[0.97] transition-all duration-200">
                Atrás
              </button>
            )}

            {step < (job.tripType === 'simple' ? 3 : 6) ? (
              <button type="button" onClick={() => setStep(step + 1)} className={`group flex-1 text-white font-extrabold py-3 rounded-xl text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-200 flex justify-center items-center gap-2 relative overflow-hidden ${job.tripType === 'simple' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <span className="relative z-10">Siguiente Paso</span>
                <span className="relative z-10 transform group-hover:translate-x-1.5 transition-transform duration-300">➔</span>
                <div className="absolute inset-0 h-full w-full translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-in-out"></div>
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="group flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 transition-all duration-200 flex justify-center items-center gap-2">
                {isSubmitting ? <><Clock className="w-4 h-4 animate-spin" /> Guardando GPS y Acta...</> : <><span className="group-hover:animate-bounce">🏁</span> Finalizar y Guardar</>}
              </button>
            )}
          </div>

      {uploadProgress.active && (
        <div className="fixed bottom-[88px] left-1/2 transform -translate-x-1/2 z-[60] w-[92%] max-w-sm animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-3xl shadow-2xl border-2 border-slate-700 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <div className="relative">
                  <CloudOff className="w-5 h-5 text-blue-400 animate-pulse" />
                </div>
                Sincronizando
              </span>
              <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                {uploadProgress.current} / {uploadProgress.total}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner border border-slate-900">
              <div className="bg-blue-500 h-full transition-all duration-300 relative" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}>
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[pulse_1s_ease-in-out_infinite]"></div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold truncate leading-none">{uploadProgress.text}</p>
          </div>
        </div>
      )}
      {/* --- CÁMARA INTERNA CENTRALIZADA --- */}
      <InAppCamera
        isOpen={cameraConfig.isOpen}
        title={cameraConfig.title}
        onClose={() => setCameraConfig(prev => ({ ...prev, isOpen: false }))}
        onCapture={cameraConfig.onCapture}
      />

      {/* MODAL DEL DÉJÀ VU PERICIAL */}


    </>
  );
}