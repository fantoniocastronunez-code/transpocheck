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
      setIsRotating(false);
    };
    window.addEventListener('openFullScreenImage', handleOpen);
    return () => window.removeEventListener('openFullScreenImage', handleOpen);
  }, []);

  const handleClose = () => {
    setImgData(null);
    setCurrentUrl(null);
    setRotationAngle(0);
    setIsRotating(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && imgData) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imgData]);

  if (!imgData) return null;

  const handleRotate = async () => {
    if (!imgData || isRotating) return;
    setIsRotating(true);
    setRotationAngle(prev => prev + 90);

    try {
      const activeSrc = currentUrl || imgData.url;
      const rotatedUrl = await rotateImage90Degrees(activeSrc);
      setCurrentUrl(rotatedUrl);
      setImgData(prev => prev ? { ...prev, url: rotatedUrl } : null);
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
    handleClose();
  };

  const handleDelete = () => {
    const evt = new CustomEvent('deleteImage', { detail: { id: imgData.id } });
    window.dispatchEvent(evt);
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-150">
      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex justify-between items-center z-10">
        <button
          type="button"
          onClick={handleClose}
          className="w-9 h-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
          title="Cerrar vista previa"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-slate-100 font-semibold tracking-wider uppercase text-xs truncate max-w-[55%]">
          {imgData.label || 'VISTA PREVIA'}
        </span>
        <button
          type="button"
          onClick={handleRotate}
          disabled={isRotating}
          title="Girar imagen 90°"
          className="w-9 h-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md flex items-center justify-center text-amber-400 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 ${isRotating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* IMAGEN */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-slate-950">
        <img
          src={currentUrl || imgData.url}
          alt={imgData.label || 'Foto'}
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transition: isRotating ? 'transform 0.2s ease' : 'none'
          }}
          className="max-w-full max-h-full object-contain rounded border border-slate-800 select-none"
        />
      </div>

      {/* FOOTER ACTIONS */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex justify-center gap-3">
        <button
          type="button"
          onClick={handleDelete}
          className="flex-1 max-w-[130px] bg-red-950/60 hover:bg-red-900/60 border border-red-800 text-red-200 py-2.5 rounded-md flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Eliminar</span>
        </button>
        <button
          type="button"
          onClick={handleRotate}
          disabled={isRotating}
          className="flex-1 max-w-[130px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 py-2.5 rounded-md flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 text-amber-400 ${isRotating ? 'animate-spin' : ''}`} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Girar 90°</span>
        </button>
        <button
          type="button"
          onClick={handleRetake}
          className="flex-1 max-w-[130px] bg-blue-700 hover:bg-blue-600 border border-blue-600 text-white py-2.5 rounded-md flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Camera className="w-4 h-4 text-white" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Re-tomar</span>
        </button>
      </div>
    </div>
  );
};

export default ImageViewer;
