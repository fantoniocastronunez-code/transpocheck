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

  const part1 = cleanText.substring(0, 2);
  const part2 = cleanText.substring(2, 4);
  const part3 = cleanText.substring(4, 6);

  return (
    <div 
      className={`inline-flex flex-col items-center justify-center border-[2px] rounded-[6px] shadow-sm relative shrink-0 select-none overflow-hidden ${className}`} 
      style={{ width: '110px', height: '40px', backgroundColor: '#f8f9fa', borderColor: '#000000', color: '#000000' }}
    >
       <div className="flex items-center justify-center w-full" style={{ fontFamily: "'FE-Font', 'Arial', sans-serif", fontSize: '20px', lineHeight: '1', gap: '3px', marginTop: '-5px' }}>
          <span>{part1}</span>
          <span className="text-black" style={{ fontSize: '8px', transform: 'translateY(-2px)' }}>•</span>
          <span>{part2}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-[1px]" style={{ transform: 'translateY(-1px)' }}>
            <path d="M12 2L4 5V11C4 16.5 7.5 21.5 12 23C16.5 21.5 20 16.5 20 11V5L12 2Z" fill="#000000"/>
            <path d="M12 16L9 18L10 14.5L7 12H10.5L12 8.5L13.5 12H17L14 14.5L15 18L12 16Z" fill="#f8f9fa"/>
          </svg>
          <span>{part3}</span>
       </div>
       <span className="font-black uppercase leading-none absolute bottom-[3px]" style={{ fontSize: '5.5px', letterSpacing: '0.4em', color: '#000000', marginLeft: '0.4em' }}>
         CHILE
       </span>
    </div>
  );
};

export default LicensePlateBadge;