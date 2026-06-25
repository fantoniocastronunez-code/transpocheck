import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, CheckCircle } from 'lucide-react';

const CustomClientSelector = ({ value, onChange, clients, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getLogoPath = (name) => {
    if (!name || name === 'OTRO') return null;
    const upper = name.toUpperCase();
    if (upper.includes('KOVACS')) return '/logos/kovacs.png';
    if (upper.includes('SALFA')) return '/logos/salfa.png';
    if (upper.includes('GRANDLEASING')) return '/logos/grandleasing.png';
    if (upper.includes('ENEX')) return '/logos/enex.png';

    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `/logos/${cleanName}.png`; 
  };

  const getBadgeColor = (name) => {
    if (!name) return 'bg-slate-200 text-slate-500';
    if (name === 'OTRO') return 'bg-slate-700 text-white';
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-sky-500', 'bg-pink-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `${colors[Math.abs(hash) % colors.length]} text-white`;
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 outline-none focus:border-blue-500 flex justify-between items-center transition-colors shadow-sm"
      >
        <div className="flex items-center gap-3 truncate">
          {value && value !== 'OTRO' ? (
            <>
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <img src={getLogoPath(value)} alt={value} className="w-full h-full object-contain bg-white" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <span className={`w-full h-full flex items-center justify-center text-[10px] font-black ${getBadgeColor(value)}`} style={{display: 'none'}}>{value.substring(0, 2).toUpperCase()}</span>
              </div>
              <span className="truncate">{value}</span>
            </>
          ) : value === 'OTRO' ? (
            <>
              <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black ${getBadgeColor('OTRO')}`}>+</div>
              <span>Otro (Ingreso manual)</span>
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[40vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
          <button type="button" onClick={() => { onChange(""); setIsOpen(false); }} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold text-slate-400 dark:text-slate-500 transition-colors border-b border-slate-50 dark:border-slate-700">
            Ninguno / Limpiar selección
          </button>
          
          {clients.map(c => (
            <button key={c} type="button" onClick={() => { onChange(c); setIsOpen(false); }} className={`w-full flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors text-left ${value === c ? 'bg-blue-50 dark:bg-slate-700/50' : ''}`}>
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                <img src={getLogoPath(c)} alt={c} className="w-full h-full object-contain p-1 bg-white" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <span className={`w-full h-full flex items-center justify-center text-xs font-black ${getBadgeColor(c)}`} style={{display: 'none'}}>{c.substring(0, 2).toUpperCase()}</span>
              </div>
              <span className={`text-sm font-bold flex-1 truncate ${value === c ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>{c}</span>
              {value === c && <CheckCircle className="w-4 h-4 text-blue-500 shrink-0" />}
            </button>
          ))}

          <button type="button" onClick={() => { onChange("OTRO"); setIsOpen(false); }} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-t border-slate-100 dark:border-slate-700">
            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-black shadow-sm ${getBadgeColor('OTRO')}`}>+</div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1">Otro (Ingreso manual)</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomClientSelector;