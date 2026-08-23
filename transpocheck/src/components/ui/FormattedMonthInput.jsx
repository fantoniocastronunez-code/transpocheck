import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export const FormattedMonthInput = ({ value, onChange, isExp }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (isOpen) {
      const initialY = value ? parseInt(value.split('-')[0], 10) : new Date().getFullYear();
      setSelectedYear(initialY);
    }
  }, [isOpen, value]);

  const formatMonthToShort = (yyyyMm) => {
    if (!yyyyMm) return '';
    const [y, m] = yyyyMm.split('-');
    if (!y || !m) return yyyyMm;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${months[parseInt(m, 10) - 1]}-${y}`;
  };

  const handleSelect = (y, m) => {
    const formatted = `${y}-${m.toString().padStart(2, '0')}`;
    onChange({ target: { value: formatted } });
    setIsOpen(false);
  };

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`w-full bg-white dark:bg-slate-900 border p-2 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 outline-none text-center transition-colors uppercase cursor-pointer flex items-center justify-center min-h-[38px] shadow-sm active:scale-95 ${isExp ? 'border-red-300 dark:border-red-700/50' : 'border-green-200 dark:border-green-800/50 hover:border-green-400'} ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}
      >
        {value ? formatMonthToShort(value) : 'MM-AAAA'}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest">Seleccionar Fecha</h3>
              <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors active:scale-95">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5">
              <div className="flex justify-between items-center mb-5 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5">
                <button 
                  type="button"
                  onClick={() => setSelectedYear(y => y - 1)}
                  className="w-12 h-10 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 shadow-sm active:scale-95 transition-all"
                >
                  -
                </button>
                <span className="text-lg font-black text-slate-800 dark:text-white tracking-widest">{selectedYear}</span>
                <button 
                  type="button"
                  onClick={() => setSelectedYear(y => y + 1)}
                  className="w-12 h-10 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 shadow-sm active:scale-95 transition-all"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {months.map((m, i) => {
                  const monthNum = i + 1;
                  const isSelected = value && parseInt(value.split('-')[1], 10) === monthNum && parseInt(value.split('-')[0], 10) === selectedYear;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelect(selectedYear, monthNum)}
                      className={`py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-900' 
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/50 shadow-sm'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
               <button 
                 type="button"
                 onClick={() => {
                   onChange({ target: { value: '' } });
                   setIsOpen(false);
                 }}
                 className="w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-95"
               >
                 Borrar Fecha
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
