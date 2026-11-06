import React from 'react';
import { Search, X } from 'lucide-react';

export default function DejaVuModal({ showDejaVuModal, setShowDejaVuModal, dejaVuData, setFullScreenImage }) {
  if (!showDejaVuModal || !dejaVuData) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 z-[9998] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setShowDejaVuModal(false)}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg flex flex-col max-h-[85vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 dark:bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center shrink-0">
          <h3 className="text-white font-bold text-sm flex items-center gap-2"><Search className="w-4 h-4 text-sky-400" /> Memoria Histórica</h3>
          <button onClick={() => setShowDejaVuModal(false)} className="bg-slate-800 p-1.5 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Último Conductor</p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{dejaVuData.assignedDriverName || dejaVuData.acceptedByEmail}</p>
          </div>

          {dejaVuData.checklist?.observations && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3 rounded-lg">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Observaciones Anteriores</p>
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">"{dejaVuData.checklist.observations}"</p>
            </div>
          )}

          {dejaVuData.checklist?.detailPins && dejaVuData.checklist.detailPins.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Fotos de Daños Registrados</p>
              <div className="grid grid-cols-2 gap-2">
                {dejaVuData.checklist.detailPins.map(pin => (
                  dejaVuData.checklist.photos?.[pin.id] && (
                    <img
                      key={pin.id}
                      src={dejaVuData.checklist.photos[pin.id]}
                      className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                      alt="Daño anterior"
                      onClick={() => {
                        setShowDejaVuModal(false);
                        if (setFullScreenImage) setFullScreenImage({ url: dejaVuData.checklist.photos[pin.id] });
                      }}
                    />
                  )
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={() => setShowDejaVuModal(false)} className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-colors text-xs uppercase tracking-wider mt-2">
            Entendido, Volver al Checklist
          </button>
        </div>
      </div>
    </div>
  );
}
