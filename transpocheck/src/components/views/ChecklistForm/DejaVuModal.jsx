import React from 'react';
import { RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react';

export default function DejaVuModal(props) {
  const { job, formData, setF, handleImageUpload, removeImage, getRouteStr, drivers,
    handleQuickSetLocation, step, setStep, showAlert, allClientsList,
    addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex,
    setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex,
    setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData,
    setTempDamageData, fileInputRef, processingId, currentUserEmail,
    showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu,
    uploadProgress, cameraConfig, setCameraConfig, processingAction,
    handleRemoteSignRequest, handleOpenQR, handlePhotoClick, isSubmitting, clearDraft, isDraftLoaded } = props;

  if (!showDejaVuModal || !dejaVuData) return null;
  return (
    <>
            {showDejaVuModal && dejaVuData && (
        <div className="fixed inset-0 bg-slate-900/80 z-[9998] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDejaVuModal(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="bg-purple-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-black flex items-center gap-2"><Search className="w-5 h-5" /> Memoria Histórica</h3>
              <button onClick={() => setShowDejaVuModal(false)} className="bg-white/20 p-1.5 rounded-full text-white hover:bg-white/30 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Último Conductor:</p>
                <p className="text-xs font-extrabold text-slate-700">{dejaVuData.assignedDriverName || dejaVuData.acceptedByEmail}</p>
              </div>


              {dejaVuData.checklist.observations && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <p className="text-[10px] font-black text-amber-700 uppercase mb-1">Observaciones Anteriores:</p>
                  <p className="text-xs font-bold text-amber-900 italic">"{dejaVuData.checklist.observations}"</p>
                </div>
              )}

              {dejaVuData.checklist.detailPins && dejaVuData.checklist.detailPins.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Fotos de Daños Registrados:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {dejaVuData.checklist.detailPins.map(pin => (
                      dejaVuData.checklist.photos[pin.id] && (
                        <img
                          key={pin.id}
                          src={dejaVuData.checklist.photos[pin.id]}
                          className="w-full h-24 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                          alt="Daño anterior"
                          onClick={() => { setShowDejaVuModal(false); setFullScreenImage({ url: dejaVuData.checklist.photos[pin.id] }); }}
                        />
                      )
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={() => setShowDejaVuModal(false)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition-colors text-xs uppercase tracking-widest mt-2">
                Entendido, Volver al Checklist
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}