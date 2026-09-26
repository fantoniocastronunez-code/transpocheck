import React, { useState } from 'react';
import { X, Camera, Bug, Megaphone, Smartphone, Settings } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import InAppCamera from './InAppCamera'; // Intento por defecto, sino nombrada

// Fix for named/default imports
const CameraComponent = InAppCamera || require('./InAppCamera').InAppCamera;

export const DevMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [cameraConfig, setCameraConfig] = useState({ isOpen: false, title: '' });

  const testPhotoPopup = () => {
    const evt = new CustomEvent('openFullScreenImage', { 
      detail: { 
        url: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&q=80', 
        id: 'dashboard', 
        label: 'Foto de Tablero (Prueba)' 
      }
    });
    window.dispatchEvent(evt);
    setIsOpen(false);
  };

  const testCamera = () => {
    setCameraConfig({ isOpen: true, title: 'Cámara de Prueba' });
    setIsOpen(false);
  };

  const testLocalBroadcast = () => {
    alert("Para probar el popup de broadcast, puedes activar el anuncio desde el menú de Administrador.");
  };

  return (
    <>


      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[991] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl flex items-center gap-2 text-slate-800 dark:text-white">
                <Bug className="w-5 h-5 text-emerald-500" />
                Herramientas de Prueba
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-4">
              Usa estas opciones para probar las funciones de la app sin necesidad de un viaje activo.
            </p>

            <div className="space-y-3">
              <button 
                onClick={testPhotoPopup}
                className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-95 text-left border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-xl text-blue-600 dark:text-blue-400">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-slate-800 dark:text-slate-200 font-black text-sm">Probar Pop-up de Tablero</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Simula el visor de fotos</div>
                </div>
              </button>

              <button 
                onClick={testCamera}
                className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-95 text-left border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <div className="bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-slate-800 dark:text-slate-200 font-black text-sm">Probar Cámara</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Simula la toma de foto</div>
                </div>
              </button>
              
              <button 
                onClick={testLocalBroadcast}
                className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-95 text-left border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <div className="bg-purple-100 dark:bg-purple-900/40 p-3 rounded-xl text-purple-600 dark:text-purple-400">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-slate-800 dark:text-slate-200 font-black text-sm">Probar Notificaciones</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Ver avisos a conductores</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor Global */}
      <ImageViewer />
      
      {/* Camara Global Mock */}
      {CameraComponent && typeof CameraComponent === 'function' ? (
        <CameraComponent 
          isOpen={cameraConfig.isOpen}
          title={cameraConfig.title}
          enableAnnotation={false}
          onClose={() => setCameraConfig({ isOpen: false, title: '' })}
          onCapture={(file) => {
            setCameraConfig({ isOpen: false, title: '' });
            alert("Foto tomada con éxito (Prueba)");
          }}
        />
      ) : null}
    </>
  );
};
