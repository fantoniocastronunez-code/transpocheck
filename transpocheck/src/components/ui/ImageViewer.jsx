import React, { useEffect, useState } from 'react';
import { X, Trash2, Camera, RotateCw } from 'lucide-react';
import { rotateImage90Degrees } from '../../utils/helpers';

export const ImageViewer = () => {
  const [imgData, setImgData] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);

  useEffect(() => {
    const handleOpen = (e) => {
      setImgData(e.detail);
      setCurrentUrl(e.detail?.url || null);
      setRotationAngle(0);
    };
    window.addEventListener('openFullScreenImage', handleOpen);
    return () => window.removeEventListener('openFullScreenImage', handleOpen);
  }, []);

  if (!imgData) return null;

  const handleRotate = async () => {
    if (!imgData || isRotating) return;
    setIsRotating(true);
    setRotationAngle(prev => prev + 90);

    try {
      const activeSrc = currentUrl || imgData.url;
      const rotatedUrl = await rotateImage90Degrees(activeSrc);
      setCurrentUrl(rotatedUrl);
      setRotationAngle(0);

      // Notificar al contexto/formulario que la foto ha rotado
      const evt = new CustomEvent('rotateImage', {
        detail: {
          id: imgData.id,
          url: rotatedUrl,
          label: imgData.label
        }
      });
      window.dispatchEvent(evt);
    } catch (err) {
      console.error("[ERR-PHOTO-ROTATE-VIEWER] Error rotando imagen:", err);
    } finally {
      setIsRotating(false);
    }
  };

  const handleRetake = () => {
    const evt = new CustomEvent('retakeImage', { detail: { id: imgData.id, label: imgData.label } });
    window.dispatchEvent(evt);
    setImgData(null);
    setCurrentUrl(null);
    setRotationAngle(0);
  };

  const handleDelete = () => {
    const evt = new CustomEvent('deleteImage', { detail: { id: imgData.id } });
    window.dispatchEvent(evt);
    setImgData(null);
    setCurrentUrl(null);
    setRotationAngle(0);
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col animate-in fade-in zoom-in-95 duration-200">
      {/* HEADER */}
      <div className="bg-gradient-to-b from-black/80 to-transparent px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center absolute top-0 left-0 right-0 z-10">
        <button
          onClick={() => { setImgData(null); setCurrentUrl(null); }}
          className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-md text-white transition-colors active:scale-95"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-black tracking-widest text-sm drop-shadow-md truncate max-w-[55%]">
          {imgData.label || 'VISTA PREVIA'}
        </span>
        <button
          onClick={handleRotate}
          disabled={isRotating}
          title="Girar imagen 90°"
          className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-md text-amber-300 transition-colors active:scale-95"
        >
          <RotateCw className={`w-5 h-5 ${isRotating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* IMAGEN */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <img
          src={currentUrl || imgData.url}
          alt={imgData.label}
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transition: isRotating ? 'transform 0.25s ease' : 'none'
          }}
          className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-lg"
        />
      </div>

      {/* FOOTER ACTIONS */}
      <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center gap-3 sm:gap-6 absolute bottom-0 left-0 right-0">
        <button
          onClick={handleDelete}
          className="flex-1 max-w-[120px] bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-100 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-md transition-all active:scale-95 shadow-lg"
        >
          <Trash2 className="w-5 h-5 text-red-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Eliminar</span>
        </button>
        <button
          onClick={handleRotate}
          disabled={isRotating}
          className="flex-1 max-w-[120px] bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 text-amber-100 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-md transition-all active:scale-95 shadow-lg"
        >
          <RotateCw className={`w-5 h-5 text-amber-400 ${isRotating ? 'animate-spin' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Girar 90°</span>
        </button>
        <button
          onClick={handleRetake}
          className="flex-1 max-w-[120px] bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 text-blue-100 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-md transition-all active:scale-95 shadow-lg"
        >
          <Camera className="w-5 h-5 text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Re-tomar</span>
        </button>
      </div>
    </div>
  );
};
