import React from 'react';
import { X, FileText, FileDown } from 'lucide-react';

export default function KovacsModal({
  showKovacsModal,
  setShowKovacsModal,
  kovacsStartDate,
  setKovacsStartDate,
  kovacsEndDate,
  setKovacsEndDate,
  handleKovacsZIP
}) {
  if (!showKovacsModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 z-[90] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-5 w-full max-w-sm shadow-lg relative border border-slate-200 dark:border-slate-800">
          <button onClick={() => setShowKovacsModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-md transition-colors"><X className="w-4 h-4"/></button>
          
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400"/>
          </div>
          
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Facturación Kovacs</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Selecciona el rango de fechas de los traslados que deseas exportar en ZIP.</p>

          <div className="space-y-3.5 mb-5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 block">Desde (Fecha de Término)</label>
              <input type="date" value={kovacsStartDate} onChange={e=>setKovacsStartDate(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 rounded-md font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 transition-colors"/>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 block">Hasta (Fecha de Término)</label>
              <input type="date" value={kovacsEndDate} onChange={e=>setKovacsEndDate(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 rounded-md font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 transition-colors"/>
            </div>
          </div>

          <button onClick={handleKovacsZIP} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition-colors flex items-center justify-center gap-2">
            <FileDown className="w-4 h-4"/> Generar y Descargar ZIP
          </button>
      </div>
    </div>
  );
}
