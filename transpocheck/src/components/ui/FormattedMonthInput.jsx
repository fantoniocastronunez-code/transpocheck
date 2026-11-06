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
        className={`w-full bg-white dark:bg-slate-900 border px-2.5 py-2 rounded-md text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 outline-none text-center transition-colors uppercase cursor-pointer flex items-center justify-center min-h-[38px] ${isExp ? 'border-red-400 dark:border-red-700' : 'border-emerald-300 dark:border-emerald-800 hover:border-emerald-500'} ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}
      >
        {value ? formatMonthToShort(value) : 'MM-AAAA'}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-xs overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h3 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Seleccionar Fecha</h3>
              <button type="button" onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1 bg-slate-100 dark:bg-slate-800 rounded transition-colors">
                <X size={15} />
              </button>
            </div>
            
            <div className="p-4">
              <div className="flex justify-between items-center mb-4 bg-slate-100 dark:bg-slate-800 rounded-md p-1 border border-slate-200 dark:border-slate-700">
                <button 
                  type="button"
                  onClick={() => setSelectedYear(y => y - 1)}
                  className="w-10 h-8 flex items-center justify-center bg-white dark:bg-slate-900 rounded font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                >
                  -
                </button>
                <span className="text-base font-mono font-bold text-slate-900 dark:text-white tabular-nums">{selectedYear}</span>
                <button 
                  type="button"
                  onClick={() => setSelectedYear(y => y + 1)}
                  className="w-10 h-8 flex items-center justify-center bg-white dark:bg-slate-900 rounded font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {months.map((m, i) => {
                  const monthNum = i + 1;
                  const isSelected = value && parseInt(value.split('-')[1], 10) === monthNum && parseInt(value.split('-')[0], 10) === selectedYear;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelect(selectedYear, monthNum)}
                      className={`py-2.5 rounded-md font-semibold text-xs uppercase tracking-wider transition-colors ${
                        isSelected 
                          ? 'bg-blue-700 dark:bg-blue-600 text-white border border-blue-700' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
               <button 
                 type="button"
                 onClick={() => {
                   onChange({ target: { value: '' } });
                   setIsOpen(false);
                 }}
                 className="w-full py-2 rounded-md font-semibold text-xs uppercase tracking-wider text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900"
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
