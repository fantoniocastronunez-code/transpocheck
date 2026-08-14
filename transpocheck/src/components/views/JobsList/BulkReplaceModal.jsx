import React from 'react';
import { RefreshCw, X, ChevronDown, Clock } from 'lucide-react';

export default function BulkReplaceModal({
  showReplaceModal,
  setShowReplaceModal,
  replaceField,
  setReplaceField,
  replaceSearchTerm,
  setReplaceSearchTerm,
  replaceNewTerm,
  setReplaceNewTerm,
  executeBulkReplace,
  processingId
}) {
  if (!showReplaceModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 border-t-8 border-purple-500">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Renombrar Masivo</h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Busca y unifica los nombres de orígenes o destinos para que coincidan con tu Directorio.</p>
          </div>
          <button onClick={() => setShowReplaceModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${replaceField === 'destination' ? 'bg-white dark:bg-slate-900 shadow-sm text-purple-700 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700'}`}
              onClick={() => setReplaceField('destination')}
            >
              Destinos
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${replaceField === 'origin' ? 'bg-white dark:bg-slate-900 shadow-sm text-purple-700 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700'}`}
              onClick={() => setReplaceField('origin')}
            >
              Orígenes
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Texto Actual a Reemplazar</label>
            <input type="text" value={replaceSearchTerm} onChange={e => setReplaceSearchTerm(e.target.value)} placeholder="Ej: kovac bilbao" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm font-bold outline-none focus:border-purple-400" />
          </div>

          <div className="flex justify-center -my-1 relative z-10"><div className="bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"><ChevronDown className="w-4 h-4 text-purple-500" /></div></div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">Nuevo Texto Oficial</label>
            <input type="text" value={replaceNewTerm} onChange={e => setReplaceNewTerm(e.target.value)} placeholder="Ej: Automotora Kovacs Bilbao" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-800/50 p-3 rounded-xl text-sm font-black text-purple-900 dark:text-purple-300 outline-none focus:border-purple-500" />
          </div>
        </div>

        <button
          onClick={executeBulkReplace}
          disabled={processingId === 'bulk-replace'}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black mt-6 shadow-md shadow-purple-200 transition-colors disabled:opacity-50 flex justify-center gap-2"
        >
          {processingId === 'bulk-replace' ? <Clock className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          Ejecutar Reemplazo
        </button>
      </div>
    </div>
  );
}
