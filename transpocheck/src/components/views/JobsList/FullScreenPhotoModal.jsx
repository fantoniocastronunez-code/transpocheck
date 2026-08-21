import React from 'react';
import { X, FileDown, ZoomIn, ZoomOut } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function FullScreenPhotoModal({
  fullScreenPhoto,
  setFullScreenPhoto
}) {
  if (!fullScreenPhoto) return null;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[99999] flex flex-col p-2 sm:p-4" onClick={() => setFullScreenPhoto(null)}>
       {/* BARRA DE HERRAMIENTAS FLOTANTE SUPERIOR */}
       <div className="absolute top-4 right-4 flex gap-3 z-[100000]" onClick={(e) => e.stopPropagation()}>
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
           className="bg-slate-800/90 hover:bg-slate-700 text-white p-3 rounded-full transition-colors shadow-2xl backdrop-blur-xl flex items-center justify-center border border-slate-600/50"
           title="Descargar Imagen"
         >
           <FileDown className="w-6 h-6"/>
         </button>
         <button 
           onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(null); }} 
           className="bg-rose-600/90 hover:bg-rose-500 text-white p-3 rounded-full transition-colors shadow-2xl backdrop-blur-xl flex items-center justify-center border border-rose-500/50" 
           title="Cerrar"
         >
            <X className="w-6 h-6"/>
         </button>
       </div>

       {/* ÁREA DE ZOOM */}
       <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
         <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={8}
            centerOnInit={true}
            centerZoomedOut={true}
            limitToBounds={true}
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
            doubleClick={{ disabled: false, step: 0.5 }}
            panning={{ disabled: false }}
         >
            {({ zoomIn, zoomOut, resetTransform }) => (
               <React.Fragment>
                  <TransformComponent 
                     wrapperStyle={{ width: "100%", height: "100%" }}
                     contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                     <img 
                        src={fullScreenPhoto} 
                        alt="Ampliación" 
                        draggable={false}
                        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl select-none" 
                     />
                  </TransformComponent>
                  
                  {/* Controles de Zoom Inferiores */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-2 rounded-full shadow-2xl z-[100000]">
                     <button onClick={() => zoomOut()} className="p-3 text-white hover:bg-slate-800 rounded-full transition-colors" title="Alejar"><ZoomOut className="w-5 h-5"/></button>
                     <div className="w-px h-8 bg-slate-700/80 mx-1"></div>
                     <button onClick={() => resetTransform()} className="px-4 py-2 text-white hover:bg-slate-800 rounded-full transition-colors font-black text-[11px] uppercase tracking-widest" title="Restablecer">100%</button>
                     <div className="w-px h-8 bg-slate-700/80 mx-1"></div>
                     <button onClick={() => zoomIn()} className="p-3 text-white hover:bg-slate-800 rounded-full transition-colors" title="Acercar"><ZoomIn className="w-5 h-5"/></button>
                  </div>
               </React.Fragment>
            )}
         </TransformWrapper>
       </div>
    </div>
  );
}
