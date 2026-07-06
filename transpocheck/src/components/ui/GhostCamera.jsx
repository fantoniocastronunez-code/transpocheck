import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, Car, Truck } from 'lucide-react';

export default function GhostCamera({ onClose, onCapture, defaultVehicleType = 'camioneta' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' es la cámara trasera
  const [activeSilhouette, setActiveSilhouette] = useState(defaultVehicleType);

  // Iniciar la cámara
  const startCamera = async (mode) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accediendo a la cámara:", error);
      alert("No se pudo acceder a la cámara. Revisa los permisos de tu navegador.");
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line
  }, [facingMode]);

  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      // Dibujar el cuadro actual del video en el canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Convertir a base64 (Formato WebP para que pese menos)
      const photoUrl = canvas.toDataURL('image/webp', 0.8);
      setCapturedPhoto(photoUrl);
    }
  };

  const confirmPhoto = () => {
    if (onCapture) onCapture(capturedPhoto);
    onClose();
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  // --- DIBUJOS VECTORIALES (SVG) ---
  const renderSilhouette = () => {
    if (activeSilhouette === 'auto') {
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full drop-shadow-2xl" style={{ filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,1))' }}>
          <path d="M 20 70 L 20 50 L 50 45 L 80 25 L 140 25 L 170 45 L 180 50 L 180 70 Z" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="6 4" />
          <circle cx="45" cy="70" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
          <circle cx="155" cy="70" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
        </svg>
      );
    }
    if (activeSilhouette === 'camion') {
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full drop-shadow-2xl" style={{ filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,1))' }}>
          <path d="M 10 80 L 10 20 L 130 20 L 130 80 Z" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="6 4" />
          <path d="M 135 80 L 135 35 L 180 35 L 190 50 L 190 80 Z" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="6 4" />
          <circle cx="40" cy="80" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
          <circle cx="90" cy="80" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
          <circle cx="160" cy="80" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
        </svg>
      );
    }
    // Por defecto: Camioneta
    return (
      <svg viewBox="0 0 200 100" className="w-full h-full drop-shadow-2xl" style={{ filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,1))' }}>
        <path d="M 15 70 L 15 45 L 45 45 L 65 25 L 120 25 L 130 45 L 185 45 L 190 70 Z" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="6 4" />
        <circle cx="45" cy="70" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
        <circle cx="155" cy="70" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 3" />
        <line x1="85" y1="45" x2="85" y2="70" stroke="white" strokeWidth="2" opacity="0.4" strokeDasharray="3 3" />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 bg-black z-[999] flex flex-col">
      {/* Cabecera Negra */}
      <div className="bg-black text-white p-4 flex justify-between items-center pb-6">
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
          <X className="w-6 h-6" />
        </button>
        <span className="font-extrabold text-sm tracking-widest uppercase">Peritaje Inteligente</span>
        {!capturedPhoto ? (
          <button onClick={flipCamera} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
            <RefreshCw className="w-6 h-6" />
          </button>
        ) : <div className="w-10"></div>}
      </div>

      {/* Visor de la Cámara */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        {!capturedPhoto ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="absolute w-full h-full object-cover"></video>
            
            {/* Capa Fantasma SVG */}
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-4 opacity-60">
              {renderSilhouette()}
            </div>
            
            <div className="absolute top-4 left-0 right-0 text-center z-20 pointer-events-none">
              <span className="bg-black/60 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase backdrop-blur-md border border-white/20 shadow-lg">
                Alinee el vehículo con la línea
              </span>
            </div>
          </>
        ) : (
          <img src={capturedPhoto} alt="Captura" className="absolute w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden"></canvas>
      </div>

      {/* Controles Inferiores */}
      <div className="bg-black pb-8 pt-6 px-6">
        {!capturedPhoto ? (
          <div className="flex justify-between items-center">
            {/* Selector de tipo de vehículo para probar en vivo */}
            <div className="flex gap-2 bg-slate-800 p-1.5 rounded-2xl">
              <button onClick={()=>setActiveSilhouette('auto')} className={`p-2 rounded-xl ${activeSilhouette==='auto'?'bg-white text-black':'text-white'}`}><Car className="w-5 h-5"/></button>
              <button onClick={()=>setActiveSilhouette('camioneta')} className={`p-2 rounded-xl ${activeSilhouette==='camioneta'?'bg-white text-black':'text-white'}`}><Truck className="w-5 h-5"/></button>
              <button onClick={()=>setActiveSilhouette('camion')} className={`p-2 rounded-xl ${activeSilhouette==='camion'?'bg-white text-black':'text-white'}`}><Truck className="w-5 h-5"/></button>
            </div>

            {/* Botón Disparador */}
            <button onClick={takePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 shadow-xl flex items-center justify-center active:scale-95 transition-transform">
              <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center">
                 <Camera className="w-8 h-8 text-black" />
              </div>
            </button>
            
            <div className="w-[104px]"></div> {/* Espaciador fantasma para centrar el botón */}
          </div>
        ) : (
          <div className="flex justify-between items-center gap-4">
            <button onClick={retakePhoto} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-extrabold uppercase text-sm">
              Reintentar
            </button>
            <button onClick={confirmPhoto} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-extrabold uppercase text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50">
              <Check className="w-5 h-5" /> Usar Foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
