import React from 'react';

const VinPlateBadge = ({ vin, compact = false, className = "" }) => {
  if (!vin) return null;

  const cleanVin = String(vin).trim().toUpperCase();

  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 select-none shrink-0 ${className}`}
        title="Número de Chasis (VIN)"
      >
        <span className="font-mono text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">VIN</span>
        <span className="font-mono font-semibold text-[11px] tracking-[0.14em] uppercase text-slate-800 dark:text-slate-200 tabular-nums">
          {cleanVin}
        </span>
      </div>
    );
  }

  const isLong = cleanVin.length > 8;

  return (
    <div 
      className={`inline-flex flex-col items-center justify-center relative shrink-0 select-none bg-slate-100 dark:bg-[#171E29] border-2 border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 shadow-xs px-2.5 py-1 ${className}`}
      style={{
        width: '166px',
        height: '60px',
      }}
      title="Número de Chasis (VIN)"
    >
      {/* Remaches técnicos simulados */}
      <div className="absolute left-[5px] top-1/2 -translate-y-1/2 w-[4px] h-[4px] rounded-full bg-slate-300 dark:bg-slate-600 border border-slate-400 dark:border-slate-500"></div>
      <div className="absolute right-[5px] top-1/2 -translate-y-1/2 w-[4px] h-[4px] rounded-full bg-slate-300 dark:bg-slate-600 border border-slate-400 dark:border-slate-500"></div>

      {/* Etiqueta superior de Chasis / VIN */}
      <span className="font-mono text-[8px] font-bold tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase -mt-0.5">
        CHASIS • VIN
      </span>

      {/* Valor troquelado técnico */}
      <span 
        className={`font-mono font-bold tracking-[0.16em] uppercase tabular-nums text-slate-900 dark:text-slate-100 mt-0.5 ${
          isLong ? 'text-[11px] max-w-[144px] truncate' : 'text-[18px]'
        }`}
      >
        {cleanVin}
      </span>
    </div>
  );
};

export default VinPlateBadge;
