import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, CheckCircle } from 'lucide-react';

// --- OPTIMIZACIÓN: Funciones movidas fuera del componente para evitar recreación en memoria ---
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
  if (!name) return 'bg-slate-200 dark:bg-slate-700 text-slate-500';
  if (name === 'OTRO') return 'bg-slate-800 text-white';
  const colors = ['bg-slate-700', 'bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-slate-600'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `${colors[Math.abs(hash) % colors.length]} text-white`;
};

// --- OPTIMIZACIÓN: Generador de avatar SVG extraído para limpiar el código HTML/JSX ---
const handleImageError = (e, name) => {
  e.currentTarget.onerror = null;
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23ECEEF2'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,sans-serif' font-weight='700' font-size='38' fill='%23475263'>${initials}</text></svg>`;
};

const CustomClientSelector = ({ value, onChange, clients, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setSearchTerm(''); }}
        className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2.5 rounded-md font-medium text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 outline-none focus:border-blue-600 flex justify-between items-center transition-colors"
      >
        <div className="flex items-center gap-2.5 truncate">
          {value && value !== 'OTRO' ? (
            <>
              <div className="w-6 h-6 rounded overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <img src={getLogoPath(value)} alt={value} className="w-full h-full object-contain bg-white" onError={(e) => handleImageError(e, value)} />
              </div>
              <span className="truncate font-semibold">{value}</span>
            </>
          ) : value === 'OTRO' ? (
            <>
              <div className={`w-6 h-6 rounded shrink-0 flex items-center justify-center text-[10px] font-bold ${getBadgeColor('OTRO')}`}>+</div>
              <span className="font-semibold">Otro (Ingreso manual)</span>
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-md overflow-hidden max-h-[40vh] overflow-y-auto flex flex-col">
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button type="button" onClick={() => { onChange(""); setIsOpen(false); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors border-b border-slate-100 dark:border-slate-800 shrink-0">
            Ninguno / Limpiar selección
          </button>
          
          <div className="overflow-y-auto">
            {filteredClients.map(c => (
              <button key={c} type="button" onClick={() => { onChange(c); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left ${value === c ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}>
                <div className="w-7 h-7 rounded overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <img src={getLogoPath(c)} alt={c} className="w-full h-full object-contain p-0.5 bg-white" onError={(e) => handleImageError(e, c)} />
                </div>
                <span className={`text-sm font-semibold flex-1 truncate ${value === c ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>{c}</span>
                {value === c && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            ))}

            {filteredClients.length === 0 && (
              <div className="p-4 text-center text-xs font-medium text-slate-500">No se encontraron clientes</div>
            )}
          </div>

          <button type="button" onClick={() => { onChange("OTRO"); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left border-t border-slate-200 dark:border-slate-800 shrink-0">
            <div className={`w-7 h-7 rounded shrink-0 flex items-center justify-center text-xs font-bold ${getBadgeColor('OTRO')}`}>+</div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">Otro (Ingreso manual)</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomClientSelector;
