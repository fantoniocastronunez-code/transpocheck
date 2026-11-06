import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

/**
 * Selector desplegable con botón "X" por opción para eliminar elementos guardados.
 * Mantiene un <input type="hidden" name={name}> para que funcione con FormData.
 * options: Array<{ id?: string, name: string }>
 */
export default function DeletableSelect({
  name,
  value,
  onChange,
  options = [],
  onDeleteOption,
  placeholder = 'Selecciona...',
  emptyText = 'No hay opciones guardadas',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      {name && <input type="hidden" name={name} value={value || ''} />}

      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${className} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${value ? '' : 'text-slate-400 dark:text-slate-500'}`}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-md max-h-60 overflow-y-auto"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2.5 text-xs font-medium text-slate-400 dark:text-slate-500">{emptyText}</li>
          ) : (
            options.map((opt) => {
              const isSelected = opt.name === value;
              return (
                <li
                  key={opt.id || opt.name}
                  role="option"
                  aria-selected={isSelected}
                  className={`flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 last:border-0 ${isSelected ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => { onChange(opt.name); setIsOpen(false); }}
                    className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left font-medium text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {isSelected ? <Check className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" /> : <span className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{opt.name}</span>
                  </button>
                  {onDeleteOption && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteOption(opt); }}
                      title="Eliminar de la lista"
                      aria-label={`Eliminar ${opt.name}`}
                      className="mr-2 p-1 shrink-0 rounded bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
