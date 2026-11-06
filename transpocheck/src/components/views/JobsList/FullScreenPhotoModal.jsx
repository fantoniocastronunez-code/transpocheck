import React from 'react';
import { X, FileDown, ZoomIn, ZoomOut } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function FullScreenPhotoModal({
  fullScreenPhoto,
  setFullScreenPhoto
}) {
  if (!fullScreenPhoto) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[99999] flex flex-col p-2 sm:p-4" onClick={() => setFullScreenPhoto(null)}>
       {/* BARRA DE HERRAMIENTAS SUPERIOR */}
       <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 flex gap-2.5 z-[100000]" onClick={(e) => e.stopPropagation()}>
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
           className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-md transition-colors flex items-center justify-center border border-slate-700"
           title="Descargar Imagen"
         >
           <FileDown className="w-5 h-5"/>
         </button>
         <button 
           onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(null); }} 
           className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-md transition-colors flex items-center justify-center border border-red-500" 
           title="Cerrar"
         >
            <X className="w-5 h-5"/>
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
                        className="max-w-full max-h-[90vh] object-contain rounded-md select-none" 
                     />
                  </TransformComponent>
                  
                  {/* Controles de Zoom Inferiores */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900 border border-slate-700 p-1.5 rounded-md shadow-lg z-[100000]">
                     <button onClick={() => zoomOut()} className="p-2 text-white hover:bg-slate-800 rounded transition-colors" title="Alejar"><ZoomOut className="w-4 h-4"/></button>
                     <div className="w-px h-6 bg-slate-700 mx-0.5"></div>
                     <button onClick={() => resetTransform()} className="px-3 py-1.5 text-white hover:bg-slate-800 rounded transition-colors font-mono font-semibold text-xs" title="Restablecer">100%</button>
                     <div className="w-px h-6 bg-slate-700 mx-0.5"></div>
                     <button onClick={() => zoomIn()} className="p-2 text-white hover:bg-slate-800 rounded transition-colors" title="Acercar"><ZoomIn className="w-4 h-4"/></button>
                  </div>
               </React.Fragment>
            )}
         </TransformWrapper>
       </div>
    </div>
  );
}
