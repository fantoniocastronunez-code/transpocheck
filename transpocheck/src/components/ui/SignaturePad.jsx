import React, { useRef, useState, useEffect } from 'react';
import { Eraser } from 'lucide-react';

export default function SignaturePad({ initialData, onSave, onClear }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

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
  }, [initialData]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
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

  return (
    <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden shadow-sm touch-none">
      <canvas
        ref={canvasRef}
        className="w-full h-32 cursor-crosshair touch-none"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <button 
        type="button" 
        onClick={() => {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          onClear();
        }} 
        className="absolute top-2 right-2 bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-lg shadow-sm transition-colors border border-slate-200"
      >
        <Eraser className="w-4 h-4"/>
      </button>
    </div>
  );
}