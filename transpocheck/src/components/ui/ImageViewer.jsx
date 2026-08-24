import React, { useEffect, useState } from 'react';
import { X, Trash2, Camera } from 'lucide-react';

export const ImageViewer = () => {
  const [imgData, setImgData] = useState(null);

  useEffect(() => {
    const handleOpen = (e) => {
      setImgData(e.detail);
    };
    window.addEventListener('openFullScreenImage', handleOpen);
    return () => window.removeEventListener('openFullScreenImage', handleOpen);
  }, []);

  if (!imgData) return null;

  const handleRetake = () => {
    const evt = new CustomEvent('retakeImage', { detail: { id: imgData.id, label: imgData.label } });
    window.dispatchEvent(evt);
    setImgData(null);
  };

  const handleDelete = () => {
    const evt = new CustomEvent('deleteImage', { detail: { id: imgData.id } });
    window.dispatchEvent(evt);
    setImgData(null);
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col animate-in fade-in zoom-in-95 duration-200">
      {/* HEADER */}
      <div className="bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-between items-center absolute top-0 left-0 right-0 z-10">
        <button 
          onClick={() => setImgData(null)}
          className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-md text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-black tracking-widest text-sm drop-shadow-md">
          {imgData.label || 'VISTA PREVIA'}
        </span>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* IMAGEN */}
      <div className="flex-1 flex items-center justify-center p-4">
        <img 
          src={imgData.url} 
          alt={imgData.label} 
          className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-lg"
        />
      </div>

      {/* FOOTER ACTIONS */}
      <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pb-10 flex justify-center gap-6 absolute bottom-0 left-0 right-0">
        <button 
          onClick={handleDelete}
          className="flex-1 max-w-[140px] bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-100 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-md transition-all active:scale-95"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Eliminar</span>
        </button>
        <button 
          onClick={handleRetake}
          className="flex-1 max-w-[140px] bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 text-blue-100 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-md transition-all active:scale-95"
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Re-tomar</span>
        </button>
      </div>
    </div>
  );
};
