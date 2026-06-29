import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Maximize, Minimize, CheckCircle } from 'lucide-react';

export default function SignaturePad({ initialData, onSave, onClear }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Redibuja el canvas si cambia el tamaño (de normal a pantalla completa)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (initialData) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
        img.src = initialData;
      }
    }
  }, [initialData, isFullscreen]); 

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Soporte para S-Pen / Stylus
    const pressure = e.pressure && e.pointerType === 'pen' ? e.pressure * 5 : 2.5;
    
    ctx.lineWidth = pressure;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    if (e.pointerType === 'pen') {
       ctx.lineWidth = Math.max(e.pressure * 5, 0.5);
    }
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearPad = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <>
      {/* Overlay oscuro cuando está en pantalla completa */}
      {isFullscreen && <div className="fixed inset-0 bg-slate-900/90 z-[9998] backdrop-blur-sm transition-opacity"></div>}

      <div className={
        isFullscreen
          ? "fixed inset-x-4 top-1/2 -translate-y-1/2 h-80 z-[9999] border-2 border-slate-300 rounded-3xl bg-white overflow-hidden shadow-2xl touch-none flex flex-col animate-in zoom-in-95"
          : "relative border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden shadow-sm touch-none h-32"
      }>
        
        {/* Cabecera solo en pantalla completa */}
        {isFullscreen && (
           <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center">
             <span className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Dibuja tu firma</span>
             <button onClick={() => setIsFullscreen(false)} className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:bg-blue-50 transition-colors">
                <Minimize className="w-4 h-4"/>
             </button>
           </div>
        )}

        <canvas
          ref={canvasRef}
          className={`w-full cursor-crosshair touch-none ${isFullscreen ? 'flex-1' : 'h-full'}`}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />

        {/* Controles Flotantes */}
        <div className={`absolute flex gap-2 ${isFullscreen ? 'bottom-4 right-4' : 'top-2 right-2'}`}>
          
          {!isFullscreen && (
            <button 
              type="button" 
              onClick={() => setIsFullscreen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-lg shadow-sm transition-colors border border-slate-200"
              title="Pantalla Completa"
            >
              <Maximize className="w-4 h-4"/>
            </button>
          )}

          <button 
            type="button" 
            onClick={clearPad} 
            className="bg-red-50 hover:bg-red-100 text-red-500 p-1.5 rounded-lg shadow-sm transition-colors border border-red-200"
            title="Borrar Firma"
          >
            <Eraser className="w-4 h-4"/>
          </button>
        </div>
        
        {/* Mensaje inferior en pantalla completa */}
        {isFullscreen && (
           <div className="bg-blue-50 p-2 text-center border-t border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 flex justify-center items-center gap-1"><CheckCircle className="w-3 h-3"/> La firma se guarda al levantar el dedo.</p>
           </div>
        )}

      </div>
    </>
  );
}