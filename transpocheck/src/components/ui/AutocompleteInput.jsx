import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

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

  const filteredOptions = (options || []).filter(opt =>
    typeof opt === 'string' && opt.toLowerCase().includes((internalValue || '').toLowerCase())
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

      {isOpen && (internalValue || (options && options.length > 0)) && (
        <div className="absolute z-[200] left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-md max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                className="px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 font-medium text-sm text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{opt}</span>
                </div>
                {onDeleteOption && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); onDeleteOption(opt); }}
                    className="p-1 rounded bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/50"
                    title="Eliminar de la lista"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Usar "{internalValue}" como nuevo destino
            </div>
          )}
        </div>
      )}
    </div>
  );
}
