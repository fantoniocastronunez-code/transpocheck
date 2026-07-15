import React, { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle, ChevronRight } from 'lucide-react';

const SwipeButton = ({ onConfirm, text, icon, colorClass = "bg-blue-600", isProcessing = false }) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const fillRef = useRef(null);
  const startX = useRef(0);
  const currentLeft = useRef(0);
  const isDragging = useRef(false);
  const prevProcessing = useRef(false);

  // Resetear el botón cuando termina de procesar
  useEffect(() => {
    if (prevProcessing.current && !isProcessing && isConfirmed) {
      setIsConfirmed(false);
      resetSlider();
    }
    prevProcessing.current = isProcessing;
  }, [isProcessing, isConfirmed]);

  const resetSlider = () => {
    currentLeft.current = 0;
    if (buttonRef.current) buttonRef.current.style.transform = `translateX(0px)`;
    if (fillRef.current) fillRef.current.style.width = `24px`;
  };

  if (isProcessing) {
    return (
      <button disabled className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-extrabold text-white opacity-70 cursor-not-allowed ${colorClass}`}>
        <Clock className="w-5 h-5 animate-spin"/> Procesando...
      </button>
    );
  }

  const handleStart = (clientX) => {
    if (isConfirmed) return;
    isDragging.current = true;
    startX.current = clientX - currentLeft.current;
    
    // Quitar la transición CSS para que el arrastre sea instantáneo (1 a 1 con el dedo)
    if (buttonRef.current) buttonRef.current.style.transition = 'none';
    if (fillRef.current) fillRef.current.style.transition = 'none';
  };

  const handleMove = (clientX) => {
    if (isConfirmed || !isDragging.current || !containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const maxLeft = containerWidth - 48; // 48px es el ancho del botón + padding
    let newLeft = clientX - startX.current;
    
    // Validar límites visuales
    if (newLeft < 0) newLeft = 0;
    if (newLeft > maxLeft) newLeft = maxLeft;

    currentLeft.current = newLeft;

    // Actualización DIRECTA al DOM (¡60 FPS sin re-renderizar React!)
    if (buttonRef.current) buttonRef.current.style.transform = `translateX(${newLeft}px)`;
    if (fillRef.current) fillRef.current.style.width = `${newLeft + 24}px`;

    // Disparo inmediato si llega al final
    if (newLeft >= maxLeft * 0.90) {
      finalizeSwipe(maxLeft);
    }
  };

  const handleEnd = () => {
    if (isConfirmed || !isDragging.current || !containerRef.current) return;
    isDragging.current = false;
    
    const maxLeft = containerRef.current.offsetWidth - 48;
    
    // Devolver las transiciones CSS para que vuelva (o complete) suavemente
    if (buttonRef.current) buttonRef.current.style.transition = 'transform 0.3s ease-out';
    if (fillRef.current) fillRef.current.style.transition = 'width 0.3s ease-out';

    // Si soltó el dedo después de la mitad, confirmar. Si no, devolver a 0.
    if (currentLeft.current > maxLeft * 0.60) { 
      finalizeSwipe(maxLeft);
    } else {
      resetSlider();
    }
  };

  const finalizeSwipe = (maxLeft) => {
    isDragging.current = false;
    currentLeft.current = maxLeft;
    setIsConfirmed(true);
    
    if (buttonRef.current) buttonRef.current.style.transform = `translateX(${maxLeft}px)`;
    if (fillRef.current) fillRef.current.style.width = `${maxLeft + 24}px`;
    
    if (navigator.vibrate) { try { navigator.vibrate([30, 40, 30]); } catch(e){} }
    onConfirm();
  };

  return (
    <div ref={containerRef} className="relative w-full h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 select-none" style={{ touchAction: 'none' }}>
      
      {/* Texto de fondo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <span className={`text-xs font-extrabold transition-colors duration-300 ${isConfirmed ? 'text-white z-10' : 'text-slate-500'}`}>
            {isConfirmed ? '¡Confirmado!' : text}
         </span>
      </div>

      {/* Relleno de color que crece */}
      <div 
        ref={fillRef}
        className={`absolute top-0 left-0 h-full ${colorClass}`} 
        style={{ width: '24px', opacity: isConfirmed ? 1 : 0.3 }} 
      />

      {/* Botón arrastrable */}
      <div 
        ref={buttonRef}
        className={`absolute top-1 bottom-1 left-1 w-10 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm z-10 ${isConfirmed ? 'bg-white text-green-600' : `${colorClass} text-white`}`}
        style={{ transform: 'translateX(0px)' }}
        onTouchStart={e => { e.stopPropagation(); handleStart(e.touches[0].clientX); }}
        onTouchMove={e => { e.stopPropagation(); handleMove(e.touches[0].clientX); }}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        onMouseDown={e => { e.stopPropagation(); handleStart(e.clientX); }}
        onMouseMove={e => handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        {isConfirmed ? <CheckCircle className="w-4 h-4 animate-in zoom-in"/> : (icon || <ChevronRight className="w-4 h-4"/>)}
      </div>
    </div>
  );
};

export default SwipeButton;