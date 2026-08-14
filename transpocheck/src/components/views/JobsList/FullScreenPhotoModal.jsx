import React from 'react';
import { X, FileDown } from 'lucide-react';

export default function FullScreenPhotoModal({
  fullScreenPhoto,
  setFullScreenPhoto
}) {
  if (!fullScreenPhoto) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[999] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setFullScreenPhoto(null)}>
       <div className="absolute top-4 right-4 flex gap-3 z-[1000]">
         <button 
           onClick={async (e) => {
             e.stopPropagation();
             try {
               const res = await fetch(fullScreenPhoto);
               const blob = await res.blob();
               const url = window.URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = `evidencia_${Date.now()}.jpg`;
               document.body.appendChild(a);
               a.click();
               window.URL.revokeObjectURL(url);
               document.body.removeChild(a);
             } catch (err) {
               window.open(fullScreenPhoto, '_blank');
             }
           }} 
           className="bg-white dark:bg-slate-900/20 p-2 rounded-full hover:bg-white dark:bg-slate-900/40 transition-colors shadow-lg backdrop-blur-md flex items-center justify-center"
           title="Descargar Imagen"
         >
           <FileDown className="w-6 h-6 text-white"/>
         </button>
         <button 
           onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(null); }} 
           className="bg-white dark:bg-slate-900/20 p-2 rounded-full hover:bg-white dark:bg-slate-900/40 transition-colors shadow-lg backdrop-blur-md flex items-center justify-center" 
           title="Cerrar"
         >
            <X className="w-6 h-6 text-white"/>
         </button>
       </div>
       <img src={fullScreenPhoto} alt="Ampliación" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-default" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
