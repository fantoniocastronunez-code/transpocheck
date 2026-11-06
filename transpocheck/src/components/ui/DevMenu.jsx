import React, { useState } from 'react';
import { X, Camera, Bug, Megaphone, Smartphone } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import InAppCamera from './InAppCamera';

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
        <div className="fixed inset-0 bg-slate-950/70 z-[991] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-lg p-5 shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <Bug className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Herramientas de Prueba
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
              Usa estas opciones para probar las funciones de la app sin necesidad de un viaje activo.
            </p>

            <div className="space-y-2.5">
              <button 
                onClick={testPhotoPopup}
                className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 rounded-md transition-colors text-left border border-slate-200 dark:border-slate-700"
              >
                <div className="bg-blue-50 dark:bg-blue-950/60 p-2.5 rounded-md text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold text-sm">Probar Pop-up de Tablero</div>
                  <div className="text-[11px] text-slate-500 font-medium">Simula el visor de fotos</div>
                </div>
              </button>

              <button 
                onClick={testCamera}
                className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 rounded-md transition-colors text-left border border-slate-200 dark:border-slate-700"
              >
                <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-md text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold text-sm">Probar Cámara</div>
                  <div className="text-[11px] text-slate-500 font-medium">Simula la toma de foto</div>
                </div>
              </button>
              
              <button 
                onClick={testLocalBroadcast}
                className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 rounded-md transition-colors text-left border border-slate-200 dark:border-slate-700"
              >
                <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-md text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold text-sm">Probar Notificaciones</div>
                  <div className="text-[11px] text-slate-500 font-medium">Ver avisos a conductores</div>
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
