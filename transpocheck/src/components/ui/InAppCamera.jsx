import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, CheckCircle } from 'lucide-react';

export default function InAppCamera({ isOpen, onClose, onCapture, title }) {
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [landscapeAngle, setLandscapeAngle] = useState(0);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const videoRef = useRef(null);

  const startCamera = async (deviceId = null, isFirst = false) => {
    if (stream && !isFirst) stream.getTracks().forEach(t => t.stop());
    
    try {
       const constraints = deviceId ? { video: { deviceId: { exact: deviceId } } } : { video: { facingMode: 'environment' } };
       const newStream = await navigator.mediaDevices.getUserMedia(constraints);
       
       if (isFirst) {
          const devs = await navigator.mediaDevices.enumerateDevices();
          let backCameras = devs.filter(d => d.kind === 'videoinput' && (d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('0')));
          if (backCameras.length === 0) backCameras = devs.filter(d => d.kind === 'videoinput');
          
          setDevices(backCameras);
          setCurrentIndex(0);
       }
       setStream(newStream);
    } catch (error) {
       console.warn("Error de hardware:", error);
       if (isFirst) {
           alert("No se pudo iniciar la cámara. Verifica que los permisos estén habilitados.");
           onClose();
       }
    }
  };

  // Encender o apagar la cámara al abrir/cerrar el modal
  useEffect(() => {
    if (isOpen) {
        startCamera(null, true);
    } else {
        if (stream) stream.getTracks().forEach(t => t.stop());
        setStream(null);
        setDevices([]);
        setCurrentIndex(0);
        setLandscapeAngle(0);
    }
    return () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line
  }, [isOpen]);

  // Conectar el video al reproductor web
  useEffect(() => {
    if (isOpen && stream && videoRef.current) {
        videoRef.current.srcObject = stream;
    }
  }, [isOpen, stream]);

  // Oído biónico para el giroscopio
  useEffect(() => {
    const handleOrientation = (event) => {
      const gamma = event.gamma;
      const beta = event.beta;  

      if (gamma === null || beta === null) return;
      if (Math.abs(beta) < 25 || Math.abs(beta) > 155) return; // Filtro de planitud

      if (gamma > 60) setLandscapeAngle(-90);
      else if (gamma < -60) setLandscapeAngle(90); 
      else if (gamma > -30 && gamma < 30) setLandscapeAngle(0);  
    };

    if (isOpen) window.addEventListener('deviceorientation', handleOrientation);
    else setLandscapeAngle(0);
    
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isOpen]);

  const setLens = (index) => {
    if (index < 0 || index >= devices.length || index === currentIndex) return;
    startCamera(devices[index].deviceId, false);
    setCurrentIndex(index);
  };

  const takeInAppPhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const needsRotation = (landscapeAngle !== 0) && (video.videoHeight > video.videoWidth);

    const sx = (video.videoWidth - (video.videoWidth / digitalZoom)) / 2;
    const sy = (video.videoHeight - (video.videoHeight / digitalZoom)) / 2;
    const sWidth = video.videoWidth / digitalZoom;
    const sHeight = video.videoHeight / digitalZoom;

    if (needsRotation) {
      canvas.width = sHeight;
      canvas.height = sWidth;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-landscapeAngle * Math.PI / 180); 
      ctx.drawImage(video, sx, sy, sWidth, sHeight, -sWidth / 2, -sHeight / 2, sWidth, sHeight);
    } else {
      canvas.width = sWidth;
      canvas.height = sHeight;
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], "photo_capture.jpg", { type: "image/jpeg" }));
      onClose();
    }, 'image/jpeg', 0.95);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-[99999] flex flex-col animate-in fade-in duration-200">
      <div className="bg-black text-white p-4 flex justify-between items-center z-10 shadow-md border-b border-slate-800">
        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 truncate max-w-[40%]"><Camera className="w-5 h-5 text-blue-400 shrink-0"/> {title}</h3>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
        </div>
      </div>
      
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
         <video ref={videoRef} playsInline autoPlay className="w-full h-full object-cover transition-transform duration-300" style={{ transform: `scale(${digitalZoom})` }} />
         <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
           <div className={`w-full h-full border-2 border-dashed rounded-xl transition-all duration-500 ${landscapeAngle !== 0 ? 'border-green-400 bg-green-500/10 shadow-[0_0_50px_rgba(34,197,94,0.3)_inset]' : 'border-white/50'}`}></div>
         </div>
         
         {landscapeAngle !== 0 && (
           <div 
             className="absolute top-1/2 left-1/2 bg-green-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full font-black text-sm uppercase tracking-widest flex items-center gap-2 z-50 border border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all duration-300"
             style={{
               transform: `translate(-50%, -50%) rotate(${landscapeAngle}deg)`,
               transformOrigin: 'center center'
             }}
           >
             <CheckCircle className="w-5 h-5"/> Apaisado Activo
           </div>
         )}
         
         <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/20 z-20 shadow-xl">
           {devices.length > 1 && (
             <button onClick={() => setLens((currentIndex + 1) % devices.length)} className="px-3 h-10 rounded-full text-xs font-black text-slate-300 hover:text-white border-r border-white/20 mr-1">
               LENTE {currentIndex + 1}
             </button>
           )}
           <button onClick={() => setDigitalZoom(0.5)} className={`w-12 h-10 rounded-full text-sm font-black transition-all duration-300 ${digitalZoom === 0.5 ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-slate-300 hover:text-white'}`}>0.5x</button>
           <button onClick={() => setDigitalZoom(1)} className={`w-12 h-10 rounded-full text-sm font-black transition-all duration-300 ${digitalZoom === 1 ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-slate-300 hover:text-white'}`}>1x</button>
           <button onClick={() => setDigitalZoom(2)} className={`w-12 h-10 rounded-full text-sm font-black transition-all duration-300 ${digitalZoom === 2 ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-slate-300 hover:text-white'}`}>2x</button>
         </div>
      </div>
      
      <div className="bg-slate-900 pb-8 pt-5 px-6 flex flex-col gap-4 z-10 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
         <button onClick={takeInAppPhoto} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 transition-all">
            <div className="w-8 h-8 rounded-full border-4 border-white flex items-center justify-center"><div className="w-3 h-3 bg-white rounded-full"></div></div>
            TOMAR FOTO AHORA
         </button>
         <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3.5 rounded-xl font-bold text-sm flex justify-center items-center gap-2 cursor-pointer transition-colors border border-slate-700 active:scale-95">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
               const f = e.target.files[0];
               if (f) { onCapture(f); onClose(); }
            }} />
            🖼️ O elegir una de tu Galería
         </label>
      </div>
    </div>
  );
}