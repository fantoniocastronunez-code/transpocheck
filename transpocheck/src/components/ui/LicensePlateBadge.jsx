import React from 'react';

const LicensePlateBadge = ({ text, className = "" }) => {
  const cleanText = (text || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (cleanText.length !== 6) {
    return (
      <span className={`bg-slate-800 text-white px-2 py-1 rounded-md text-xs font-black tracking-widest shrink-0 ${className}`}>
        {text || 'S/N'}
      </span>
    );
  }

  // Identificar el formato (Antiguo: 2 letras 4 números, Nuevo: 4 letras 2 números)
  const isOldFormat = /^[A-Z]{2}[0-9]{4}$/.test(cleanText);

  let part1, part2, part3, separator1, separator2;

  const ShieldIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-[1px] translate-y-[1px]">
      <path d="M12 2L4 5V11C4 16.5 7.5 21.5 12 23C16.5 21.5 20 16.5 20 11V5L12 2Z" fill="#111"/>
      <path d="M12 16L9 18L10 14.5L7 12H10.5L12 8.5L13.5 12H17L14 14.5L15 18L12 16Z" fill="#fff"/>
    </svg>
  );

  const DotIcon = () => (
    <div className="w-[4px] h-[4px] bg-[#111] rounded-full mx-[2px]"></div>
  );

  if (isOldFormat) {
    part1 = cleanText.substring(0, 2);
    part2 = cleanText.substring(2, 4);
    part3 = cleanText.substring(4, 6);
    separator1 = <ShieldIcon />;
    separator2 = <DotIcon />;
  } else {
    part1 = cleanText.substring(0, 2);
    part2 = cleanText.substring(2, 4);
    part3 = cleanText.substring(4, 6);
    separator1 = <DotIcon />;
    separator2 = <ShieldIcon />;
  }

  return (
    <div 
      className={`inline-flex flex-col items-center justify-center relative shrink-0 select-none ${className}`}
      style={{
        width: '150px',
        height: '52px',
        borderRadius: '6px',
        border: '1.5px solid #111',
        backgroundColor: '#ffffff',
        color: '#111',
        boxShadow: 'inset 0 0 0 2px #ffffff, inset 0 0 0 3px #111',
      }}
    >
       {/* Tornillos simulados */}
       <div className="absolute left-[4px] top-1/2 -translate-y-1/2 w-[3.5px] h-[3.5px] rounded-full bg-slate-300 border-[0.5px] border-slate-500 shadow-inner"></div>
       <div className="absolute right-[4px] top-1/2 -translate-y-1/2 w-[3.5px] h-[3.5px] rounded-full bg-slate-300 border-[0.5px] border-slate-500 shadow-inner"></div>

       {/* Texto de la Patente */}
       <div className="flex items-center justify-center w-full text-[32px] font-black tracking-tight leading-none mt-[2px] gap-[2px] px-2" style={{ fontFamily: "'FE-Font', 'Arial Narrow', Arial, sans-serif" }}>
         <span className="scale-y-[1.15] scale-x-[0.95] inline-block origin-bottom">{part1}</span>
         {separator1}
         <span className="scale-y-[1.15] scale-x-[0.95] inline-block origin-bottom">{part2}</span>
         {separator2}
         <span className="scale-y-[1.15] scale-x-[0.95] inline-block origin-bottom">{part3}</span>
       </div>
       
       {/* Letras de CHILE */}
       <span className="font-bold uppercase absolute bottom-[3px] text-[7.5px] tracking-[0.55em] ml-[0.55em] text-[#111]" style={{ fontFamily: "Arial, sans-serif" }}>
         CHILE
       </span>

       {/* Microtextos */}
       <span className="absolute bottom-[3px] left-[7px] text-[4px] font-bold text-slate-400 opacity-70 tracking-widest">
         DELANTERA
       </span>

       <div className="absolute bottom-[3px] right-[6px] text-[3.5px] font-bold text-slate-400 opacity-70 tracking-tighter flex items-center justify-center w-[12px] h-[12px]">
         <div className="border-[0.5px] border-slate-400 rounded-full w-full h-full flex items-center justify-center">
            <span className="scale-[0.6] text-center leading-[1.1]">REGISTRO<br/>CIVIL</span>
         </div>
       </div>
    </div>
  );
};

export default LicensePlateBadge;