import React from 'react';

const VinPlateBadge = ({ vin, className = "" }) => {
  if (!vin) return null;

  return (
    <div 
      className={`inline-flex items-center justify-between relative shrink-0 select-none bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 ${className}`}
      title="Número de Chasis (VIN)"
    >
      <span className="font-mono font-semibold text-[11px] tracking-[0.14em] uppercase text-slate-800 dark:text-slate-200 tabular-nums">
        {vin}
      </span>
    </div>
  );
};

export default VinPlateBadge;
