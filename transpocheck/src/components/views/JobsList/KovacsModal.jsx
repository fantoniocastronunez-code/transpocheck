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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border-4 border-orange-100">
          <button onClick={() => setShowKovacsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-full transition-colors"><X className="w-5 h-5"/></button>
          
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-orange-600"/>
          </div>
          
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-1">Facturación Kovacs</h2>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6">Selecciona el rango de fechas de los traslados que deseas exportar en ZIP.</p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Desde (Fecha de Término)</label>
              <input type="date" value={kovacsStartDate} onChange={e=>setKovacsStartDate(e.target.value)} className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-orange-400 focus:ring-4 ring-orange-400/20 transition-all"/>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Hasta (Fecha de Término)</label>
              <input type="date" value={kovacsEndDate} onChange={e=>setKovacsEndDate(e.target.value)} className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-orange-400 focus:ring-4 ring-orange-400/20 transition-all"/>
            </div>
          </div>

          <button onClick={handleKovacsZIP} className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-sm shadow-md transition-colors flex items-center justify-center gap-2">
            <FileDown className="w-5 h-5"/> Generar y Descargar ZIP
          </button>
      </div>
    </div>
  );
}
