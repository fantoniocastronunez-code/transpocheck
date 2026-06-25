import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const SignaturePad = ({ onSave, onClear, initialData }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a'; 
    ctx.lineWidth = 4;
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    
    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = initialData;
    }
  }, [initialData]);

  const generateStampedSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    if (!pixelBuffer.some(color => color !== 0)) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width; offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');
    
    offCtx.fillStyle = '#ffffff'; offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
    offCtx.drawImage(canvas, 0, 0);
    
    const now = new Date();
    const hash = Math.random().toString(36).substring(2, 8).toUpperCase() + now.getTime().toString().slice(-4);
    const stampText = `Firma Digital • ID: ${hash} • ${now.toLocaleString('es-CL')}`;
    
    offCtx.font = "14px monospace"; offCtx.fillStyle = "#94a3b8"; offCtx.textAlign = "right";
    offCtx.fillText(stampText, offscreen.width - 8, offscreen.height - 8);
    
    return offscreen.toDataURL('image/jpeg', 0.8);
  };

  const lastPoint = useRef(null);

  const drawEvent = (e, type) => {
    if (e.cancelable && type === 'start' && e.type === 'touchstart') e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    
    if (type === 'start') { 
      setIsDrawing(true); 
      lastPoint.current = { x, y }; 
    }
    if (type === 'draw' && isDrawing && lastPoint.current) { 
      ctx.beginPath(); 
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y); 
      ctx.lineTo(x, y); 
      ctx.stroke(); 
      lastPoint.current = { x, y };
    }
    if (type === 'stop') {
      setIsDrawing(false);
      lastPoint.current = null;
      if (onSave) {
        if (navigator.vibrate) navigator.vibrate(20);
        const stampedData = generateStampedSignature();
        if (stampedData) onSave(stampedData);
      }
    }
  };

  const handleToggleFullscreen = (e, state) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFullscreen(state);
  };

  return (
    <div className={isFullscreen 
      ? "fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200" 
      : "border-2 border-dashed border-blue-200 rounded-2xl p-2 bg-white relative overflow-hidden"}>
      
      {isFullscreen && (
        <div className="w-full flex justify-between items-center mb-2 shrink-0 max-w-3xl mx-auto">
          <h3 className="text-white font-black text-xl">Dibuje su firma aquí</h3>
          <button type="button" onClick={(e) => handleToggleFullscreen(e, false)} className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-full transition-colors"><X className="w-5 h-5"/></button>
        </div>
      )}

      <div className={`relative w-full mx-auto flex items-center justify-center shrink-0 ${isFullscreen ? 'flex-1 min-h-0' : 'aspect-[2/1]'}`}>
         {!isFullscreen && <p className="absolute top-3 left-3 text-[10px] font-black text-slate-200 uppercase tracking-widest pointer-events-none select-none">Área de Firma Segura</p>}
         
         {!isFullscreen && (
           <button type="button" onClick={(e) => handleToggleFullscreen(e, true)} className="absolute top-2 right-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black px-3 py-2 rounded-xl shadow-md z-20 transition-colors border border-slate-200 flex items-center gap-1">
             🔲 Pantalla Completa
           </button>
         )}

         <canvas ref={canvasRef} width={600} height={300} 
           className={`touch-none cursor-crosshair relative z-10 ${isFullscreen ? 'rounded-2xl shadow-2xl border-2 border-slate-500 bg-white max-h-full max-w-full w-auto h-auto object-contain' : 'w-full h-full rounded-xl bg-transparent'}`}
           style={{ touchAction: 'none', aspectRatio: '2/1' }}
           onPointerDown={(e) => drawEvent(e, 'start')} onPointerMove={(e) => drawEvent(e, 'draw')}
           onPointerUp={(e) => drawEvent(e, 'stop')} onPointerOut={(e) => drawEvent(e, 'stop')}
           onTouchStart={(e) => drawEvent(e, 'start')} onTouchMove={(e) => drawEvent(e, 'draw')}
           onTouchEnd={(e) => drawEvent(e, 'stop')}
         />
      </div>

      <div className={`flex gap-3 shrink-0 ${isFullscreen ? 'w-full max-w-3xl mx-auto mt-4 pb-2' : 'w-full mt-2'}`}>
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); canvasRef.current.getContext('2d').clearRect(0,0,600,300); if(onClear) onClear(); }} className={`font-bold py-3 rounded-xl transition-colors shadow-sm border flex items-center justify-center ${isFullscreen ? 'flex-1 bg-red-500 text-white hover:bg-red-600 border-transparent text-sm sm:text-base' : 'w-full text-sm text-red-500 hover:text-red-600 bg-red-50 border-transparent px-3'}`}>
            Limpiar {isFullscreen ? 'Firma' : 'recuadro'}
        </button>
        {isFullscreen && (
            <button type="button" onClick={(e) => handleToggleFullscreen(e, false)} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-200 transition-colors text-sm sm:text-base">
                Guardar y Cerrar
            </button>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;