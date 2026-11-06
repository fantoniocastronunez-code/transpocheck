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
    <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center z-[200] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-md shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Renombrar Masivo</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Busca y unifica los nombres de orígenes o destinos para que coincidan con tu Directorio.</p>
          </div>
          <button onClick={() => setShowReplaceModal(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
        </div>

        <div className="space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md">
            <button
              className={`flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${replaceField === 'destination' ? 'bg-white dark:bg-slate-900 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              onClick={() => setReplaceField('destination')}
            >
              Destinos
            </button>
            <button
              className={`flex-1 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${replaceField === 'origin' ? 'bg-white dark:bg-slate-900 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              onClick={() => setReplaceField('origin')}
            >
              Orígenes
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Texto Actual a Reemplazar</label>
            <input type="text" value={replaceSearchTerm} onChange={e => setReplaceSearchTerm(e.target.value)} placeholder="Ej: kovac bilbao" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-2.5 rounded-md text-sm font-medium outline-none focus:border-blue-600" />
          </div>

          <div className="flex justify-center -my-1 relative z-10"><div className="bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-700"><ChevronDown className="w-4 h-4 text-blue-600" /></div></div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Nuevo Texto Oficial</label>
            <input type="text" value={replaceNewTerm} onChange={e => setReplaceNewTerm(e.target.value)} placeholder="Ej: Automotora Kovacs Bilbao" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 p-2.5 rounded-md text-sm font-semibold text-blue-900 dark:text-blue-200 outline-none focus:border-blue-600" />
          </div>
        </div>

        <button
          onClick={executeBulkReplace}
          disabled={processingId === 'bulk-replace'}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-md text-xs font-semibold mt-5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processingId === 'bulk-replace' ? <Clock className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Ejecutar Reemplazo
        </button>
      </div>
    </div>
  );
}
