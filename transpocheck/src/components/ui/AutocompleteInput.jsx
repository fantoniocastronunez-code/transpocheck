import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

import { X } from 'lucide-react';

export default function AutocompleteInput({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className, 
  required,
  name,
  defaultValue,
  onDeleteOption
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue || value || '');
  const wrapperRef = useRef(null);

  // Allow external control of the value, but prioritize internal input state while typing
  useEffect(() => {
    if (value !== undefined && value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(internalValue.toLowerCase())
  ).slice(0, 50); // limit to avoid massive lists

  const handleChange = (e) => {
    const val = e.target.value.toUpperCase();
    setInternalValue(val);
    if (onChange) onChange(e); // Pass the raw event for form handlers
    setIsOpen(true);
  };

  const handleSelect = (opt) => {
    setInternalValue(opt);
    if (onChange) {
      // Mock event for onChange handlers that expect e.target.value
      onChange({ target: { name, value: opt } });
    }
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        name={name}
        required={required}
        value={internalValue}
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        autoCapitalize="characters"
        className={className}
      />
      
      {isOpen && (internalValue || options.length > 0) && (
        <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-800/50 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <div 
                key={idx}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                className="px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2 group"
              >
                <div className="flex items-center gap-2">
                   <Search className="w-3.5 h-3.5 text-slate-400" />
                   <span className="truncate">{opt}</span>
                </div>
                {onDeleteOption && (
                   <button 
                     type="button"
                     onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteOption(opt); }}
                     className="p-1.5 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                     title="Eliminar de la lista"
                   >
                     <X className="w-4 h-4" />
                   </button>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm font-bold text-slate-400 dark:text-slate-500 italic">
              Usar "{internalValue}" como nuevo destino
            </div>
          )}
        </div>
      )}
    </div>
  );
}
