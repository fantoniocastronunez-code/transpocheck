import React from 'react';

const LicensePlateBadge = ({ text, className = "" }) => {
  const cleanText = (text || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (cleanText.length !== 6) {
    return (
      <span className={`bg-slate-800 dark:bg-slate-700 text-white px-2 py-1 rounded-md text-xs font-black tracking-widest shrink-0 ${className}`}>
        {text || 'S/N'}
      </span>
    );
  }

  const part1 = cleanText.substring(0, 2);
  const part2 = cleanText.substring(2, 4);
  const part3 = cleanText.substring(4, 6);

  return (
    <div 
      className={`inline-flex flex-col items-center justify-center border-2 border-black rounded-md shadow-sm relative shrink-0 select-none overflow-hidden w-[110px] h-[40px] bg-[#f8f9fa] text-black ${className}`} 
    >
       <div className="flex items-center justify-center w-full text-[20px] leading-none gap-[3px] -mt-[5px]" style={{ fontFamily: "'FE-Font', Arial, sans-serif" }}>
         <span>{part1}</span>
         <span className="text-[8px] -translate-y-0.5">•</span>
         <span>{part2}</span>
         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-[1px] -translate-y-[1px]">
           <path d="M12 2L4 5V11C4 16.5 7.5 21.5 12 23C16.5 21.5 20 16.5 20 11V5L12 2Z" fill="#000000"/>
           <path d="M12 16L9 18L10 14.5L7 12H10.5L12 8.5L13.5 12H17L14 14.5L15 18L12 16Z" fill="#f8f9fa"/>
         </svg>
         <span>{part3}</span>
       </div>
       <span className="font-black uppercase leading-none absolute bottom-[3px] text-[5.5px] tracking-[0.4em] ml-[0.4em]">
         CHILE
       </span>
    </div>
  );
};

export default LicensePlateBadge;