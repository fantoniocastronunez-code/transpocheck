import React from 'react';
import VinPlateBadge from './VinPlateBadge';

const LicensePlateBadge = ({ text, className = "" }) => {
  const cleanText = (text || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (cleanText.length !== 6) {
    if (cleanText.length >= 10) {
      return <VinPlateBadge vin={cleanText} className={className} />;
    }
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 -translate-y-[2px]">
      <path d="M12 2L4 5V11C4 16.5 7.5 21.5 12 23C16.5 21.5 20 16.5 20 11V5L12 2Z" fill="#111"/>
      <path d="M12 16L9 18L10 14.5L7 12H10.5L12 8.5L13.5 12H17L14 14.5L15 18L12 16Z" fill="#fff"/>
    </svg>
  );

  const DotIcon = () => (
    <div className="w-[8px] h-[8px] bg-[#111] rounded-full shrink-0 -translate-y-[2px]"></div>
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
        width: '166px',
        height: '60px',
        borderRadius: '6px',
        border: '1.5px solid #111',
        backgroundColor: '#ffffff',
        color: '#111',
        boxShadow: 'inset 0 0 0 2px #ffffff, inset 0 0 0 3px #111',
      }}
    >
       {/* Tornillos simulados */}
       <div className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3.5px] h-[3.5px] rounded-full bg-slate-300 dark:bg-slate-600 border-[0.5px] border-slate-500 shadow-inner z-10"></div>
       <div className="absolute right-[3px] top-1/2 -translate-y-1/2 w-[3.5px] h-[3.5px] rounded-full bg-slate-300 dark:bg-slate-600 border-[0.5px] border-slate-500 shadow-inner z-10"></div>

       {/* Texto de la Patente */}
       <div className="flex items-center justify-between w-full px-[10px] mb-[6px]" style={{ fontFamily: "'FE-Font', 'Arial Narrow', Arial, sans-serif" }}>
         
         <div className="flex items-center gap-[1px]">
           <span className="text-[38px] font-black tracking-tight leading-none scale-y-[1.1] scale-x-[0.85] inline-block origin-bottom">{part1[0]}</span>
           <span className="text-[38px] font-black tracking-tight leading-none scale-y-[1.1] scale-x-[0.85] inline-block origin-bottom">{part1[1]}</span>
         </div>
         
         <div className="flex items-center justify-center shrink-0">
           {separator1}
         </div>
         
         <div className="flex items-center gap-[1px]">
           <span className="text-[38px] font-black tracking-tight leading-none scale-y-[1.1] scale-x-[0.85] inline-block origin-bottom">{part2[0]}</span>
           <span className="text-[38px] font-black tracking-tight leading-none scale-y-[1.1] scale-x-[0.85] inline-block origin-bottom">{part2[1]}</span>
         </div>
         
         <div className="flex items-center justify-center shrink-0">
           {separator2}
         </div>
         
         <div className="flex items-center gap-[1px]">
           <span className="text-[38px] font-black tracking-tight leading-none scale-y-[1.1] scale-x-[0.85] inline-block origin-bottom">{part3[0]}</span>
           <span className="text-[38px] font-black tracking-tight leading-none scale-y-[1.1] scale-x-[0.85] inline-block origin-bottom">{part3[1]}</span>
         </div>

       </div>
       
       {/* Letras de CHILE */}
       <span className="font-bold uppercase absolute bottom-[4px] text-[8px] tracking-[0.55em] ml-[0.55em] text-[#111]" style={{ fontFamily: "Arial, sans-serif" }}>
         CHILE
       </span>

       {/* Left Microtext */}
       <div className="absolute bottom-[4px] left-[5px] flex items-center justify-center px-[3px] py-[1px] border-[1px] border-[#111] rounded-[6px]">
         <span className="text-[4px] font-black text-[#111] leading-none tracking-wider">
           DELANTERA
         </span>
       </div>

       {/* Right Microtext */}
       <div className="absolute bottom-[5px] right-[4px] flex items-center justify-center w-[16px] h-[9px] border-[1px] border-[#111] rounded-[40%]">
         <span className="text-[2.5px] font-black text-[#111] leading-[3px] text-center scale-[0.85]">
           REGISTROCIVIL<br/>E<br/>IDENTIFICACION
         </span>
       </div>
    </div>
  );
};

export default LicensePlateBadge;