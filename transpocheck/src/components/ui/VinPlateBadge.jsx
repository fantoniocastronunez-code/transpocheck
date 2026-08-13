import React from 'react';

const VinPlateBadge = ({ vin, className = "" }) => {
  if (!vin) return null;

  return (
    <div 
      className={`inline-flex items-center justify-between relative shrink-0 select-none ${className}`}
      style={{
        background: 'linear-gradient(to bottom, #d1d5db, #9ca3af)', // Silver metallic gradient
        border: '1px solid #6b7280',
        borderRadius: '3px',
        padding: '2px 10px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.15)',
      }}
      title="Número de Chasis (VIN)"
    >
      {/* Remaches simulados */}
      <div className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[2.5px] h-[2.5px] rounded-full bg-slate-300 border-[0.5px] border-slate-500 shadow-inner"></div>
      <div className="absolute right-[3px] top-1/2 -translate-y-1/2 w-[2.5px] h-[2.5px] rounded-full bg-slate-300 border-[0.5px] border-slate-500 shadow-inner"></div>

      {/* Texto troquelado */}
      <span 
        className="font-mono font-black text-[10px] tracking-[0.25em] uppercase"
        style={{
          color: '#374151',
          textShadow: '0 1px 0 rgba(255,255,255,0.7), 0 -1px 0 rgba(0,0,0,0.3)',
          marginLeft: '4px',
          marginRight: '1px'
        }}
      >
        {vin}
      </span>
    </div>
  );
};

export default VinPlateBadge;
