import React, { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle, ChevronRight } from 'lucide-react';

const SwipeButton = ({ onConfirm, text, icon, colorClass = "bg-blue-600", isProcessing = false }) => {
  const [sliderLeft, setSliderLeft] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const containerRef = useRef(null);
  const startX = useRef(0);
  const prevProcessing = useRef(false);

  useEffect(() => {
    if (prevProcessing.current && !isProcessing && isConfirmed) {
      setIsConfirmed(false);
      setSliderLeft(0);
    }
    prevProcessing.current = isProcessing;
  }, [isProcessing, isConfirmed]);

  if (isProcessing) {
    return (
      <button disabled className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-extrabold text-white opacity-70 cursor-not-allowed ${colorClass}`}>
        <Clock className="w-5 h-5 animate-spin"/> Procesando...
      </button>
    );
  }

  const handleStart = (clientX) => {
    if (isConfirmed) return;
    startX.current = clientX - sliderLeft;
  };

  const handleMove = (clientX) => {
    if (isConfirmed || !startX.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const maxLeft = containerWidth - 48;
    let newLeft = clientX - startX.current;
    
    // Validar límites
    if (newLeft < 0) newLeft = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;

    setSliderLeft(newLeft);

    // Disparo al superar el 85% del recorrido
    if (newLeft >= maxLeft * 0.85) {
      setIsConfirmed(true);
      setSliderLeft(maxLeft);
      startX.current = 0;
      if (navigator.vibrate) { try { navigator.vibrate(50); } catch(e){} }
      onConfirm();
    }
  };

  const handleEnd = () => {
    if (isConfirmed || !startX.current) return;
    const maxLeft = containerRef.current.offsetWidth - 48;
    if (sliderLeft > maxLeft * 0.75) { 
      setSliderLeft(maxLeft);
      setIsConfirmed(true);
      if (navigator.vibrate) { try { navigator.vibrate([30, 40, 30]); } catch(e){} }
      onConfirm(); 
    } else {
      setSliderLeft(0); 
    }
    startX.current = 0;
  };

  return (
    <div ref={containerRef} className="relative w-full h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 select-none" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <span className={`text-xs font-extrabold ${isConfirmed ? 'text-white z-10' : 'text-slate-500'}`}>
            {isConfirmed ? '¡Confirmado!' : text}
         </span>
      </div>
      <div className={`absolute top-0 left-0 h-full ${colorClass} transition-opacity duration-200`} style={{ width: `${sliderLeft + 24}px`, opacity: isConfirmed ? 1 : 0.3 }} />
      <div 
        className={`absolute top-1 bottom-1 w-10 rounded-lg flex items-center justify-center cursor-grab shadow-sm transition-colors z-10 ${isConfirmed ? 'bg-white text-green-600' : `${colorClass} text-white`}`}
        // Eliminamos la transición manual para evitar el "flicker" durante el arrastre y dejamos que el navegador gestione la posición
        style={{ left: `${sliderLeft + 4}px`, transition: startX.current ? 'none' : 'left 0.1s linear' }}
        onTouchStart={e => { e.stopPropagation(); handleStart(e.touches[0].clientX); }}
        onTouchMove={e => { e.stopPropagation(); handleMove(e.touches[0].clientX); }}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        onMouseDown={e => handleStart(e.clientX)}
        onMouseMove={e => startX.current && handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        {isConfirmed ? <CheckCircle className="w-4 h-4"/> : (icon || <ChevronRight className="w-4 h-4"/>)}
      </div>
    </div>
  );
};

export default SwipeButton;