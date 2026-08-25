import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, CheckCircle, RefreshCw, RefreshCcw, Edit3 } from 'lucide-react';

export default function InAppCamera({ isOpen, onClose, onCapture, title, enableAnnotation = false }) {
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [landscapeAngle, setLandscapeAngle] = useState(0);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [activeZoomLabel, setActiveZoomLabel] = useState(1);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const videoRef = useRef(null);

  // States for Photo Annotation
  const [previewImage, setPreviewImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvasRef = useRef(null);

  const startCamera = async (deviceId = null, isFirst = false) => {
    if (stream && !isFirst) stream.getTracks().forEach(t => t.stop());
    
    try {
       // Solicitar máxima resolución posible (ideal 4K, el navegador ajustará al máximo de la cámara)
       const baseConstraints = { width: { ideal: 4096 }, height: { ideal: 2160 } };
       
       let targetDeviceId = deviceId;
       
       // Si es la primera vez y no hay deviceId, intentar recuperar el último guardado (evita la doble carga)
       if (isFirst && !deviceId) {
           const savedUltraId = localStorage.getItem('ultraCameraId');
           if (savedUltraId) {
               targetDeviceId = savedUltraId;
           }
       }

       const constraints = targetDeviceId 
         ? { video: { deviceId: { exact: targetDeviceId }, ...baseConstraints } } 
         : { video: { facingMode: 'environment', ...baseConstraints } };
       
       let newStream = await navigator.mediaDevices.getUserMedia(constraints);
       
       if (isFirst) {
          const devs = await navigator.mediaDevices.enumerateDevices();
          // iOS en español usa "posterior", Android usa "trasera" o "back". ¡Debemos atraparlos todos!
          let backCameras = devs.filter(d => d.kind === 'videoinput' && (
             d.label.toLowerCase().includes('back') || 
             d.label.toLowerCase().includes('trasera') || 
             d.label.toLowerCase().includes('posterior') || 
             d.label.toLowerCase().includes('environment') || 
             d.label.toLowerCase().includes('0')
          ));
          if (backCameras.length === 0) backCameras = devs.filter(d => d.kind === 'videoinput');
          
          setDevices(backCameras);
          
          // --- BÚSQUEDA DE CÁMARA 0.5x ---
          const findByKeyword = (keywords) => backCameras.find(d => keywords.some(k => d.label.toLowerCase().includes(k)));
          let ultraDevice = findByKeyword(['ultra', 'gran angular', '0.5', '0,5']);
          
          // En muchos dispositivos móviles (ej. iOS), la backCamera[0] suele ser la ultra wide.
          if (!ultraDevice && backCameras.length > 0) ultraDevice = backCameras[0];
            let currentTrackLabel = newStream.getVideoTracks().length > 0 ? newStream.getVideoTracks()[0].label : '';
           
           if (ultraDevice && ultraDevice.label !== currentTrackLabel && ultraDevice.deviceId) {
               localStorage.setItem('ultraCameraId', ultraDevice.deviceId);

               // Si abrimos la por defecto y no era la ultra, cerramos y volvemos a abrir
               if (!targetDeviceId || targetDeviceId !== ultraDevice.deviceId) {
                   newStream.getTracks().forEach(t => t.stop());
                   const ultraStream = await navigator.mediaDevices.getUserMedia({
                       video: { deviceId: { exact: ultraDevice.deviceId }, ...baseConstraints }
                   });
                   newStream = ultraStream;
               }
           } else if (ultraDevice && ultraDevice.deviceId) {
               // Si ya era la ultra, la guardamos
               localStorage.setItem('ultraCameraId', ultraDevice.deviceId);
           }
          
          let activeIdx = 0;
          currentTrackLabel = newStream.getVideoTracks().length > 0 ? newStream.getVideoTracks()[0].label : '';
          if (currentTrackLabel) {
             const foundIdx = backCameras.findIndex(d => d.label === currentTrackLabel);
             if (foundIdx !== -1) activeIdx = foundIdx;
          }
          setCurrentIndex(activeIdx);
          
          setActiveZoomLabel(0.5);
          setDigitalZoom(1);
       }
       setStream(newStream);
    } catch (error) {
       console.warn("Error de hardware:", error);
       // Fallback por si el ID guardado de localStorage ya no es válido (suele pasar en Safari iOS al recargar)
       if (isFirst && !deviceId && localStorage.getItem('ultraCameraId')) {
           localStorage.removeItem('ultraCameraId');
           return startCamera(null, true);
       }
       if (isFirst) {
           alert("No se pudo iniciar la cámara. Verifica que los permisos estén habilitados.");
           onClose();
       }
    }
  };

  useEffect(() => {
    if (isOpen) {
        setPreviewImage(null);
        setHasDrawing(false);
        setIsDrawing(false);
        setIsManualOverride(false);
        startCamera(null, true);
    } else {
        if (stream) stream.getTracks().forEach(t => t.stop());
        setStream(null);
        setDevices([]);
        setCurrentIndex(0);
        setLandscapeAngle(0);
        setIsManualOverride(false);
        setActiveZoomLabel(1);
        setPreviewImage(null);
        setHasDrawing(false);
        setIsDrawing(false);
    }
    return () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line
  }, [isOpen]);

  const toggleOrientation = () => {
    setIsManualOverride(true);
    setLandscapeAngle(prev => prev === 0 ? -90 : 0);
  };

  // Conectar el video al reproductor web
  useEffect(() => {
    if (isOpen && stream && videoRef.current) {
        videoRef.current.srcObject = stream;
    }
  }, [isOpen, stream]);

  // Oído biónico para el giroscopio
  useEffect(() => {
    const handleOrientation = (event) => {
      if (isManualOverride) return;

      const gamma = event.gamma;
      const beta = event.beta;  

      if (gamma === null || beta === null) return;
      
      // Si el teléfono está plano sobre la mesa, ignorar cambios bruscos
      if (Math.abs(beta) < 25 && Math.abs(gamma) < 25) return;

      // Histéresis: ángulos más amplios para activar, más cerrados para desactivar
      if (gamma > 50) setLandscapeAngle(-90);
      else if (gamma < -50) setLandscapeAngle(90); 
      else if (Math.abs(gamma) < 35) setLandscapeAngle(0);  
    };

    if (isOpen) window.addEventListener('deviceorientation', handleOrientation);
    else setLandscapeAngle(0);
    
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isOpen]);

  const setZoomLevel = (level) => {
    setActiveZoomLabel(level);
    
    if (devices.length === 0) {
       setDigitalZoom(level >= 1 ? level : 1);
       return;
    }

    const findByKeyword = (keywords) => devices.find(d => keywords.some(k => d.label.toLowerCase().includes(k)));
    let targetDevice = null;
    let fallbackDigitalZoom = 1;

    if (level === 0.5) {
       targetDevice = findByKeyword(['ultra', 'gran angular', '0.5', '0,5']);
       if (!targetDevice) targetDevice = devices[0];
       fallbackDigitalZoom = 1;
    } else if (level === 2) {
       targetDevice = findByKeyword(['tele', 'telephoto', 'zoom', '2x', 'teleobjetivo']);
       if (!targetDevice) {
           if (devices.length >= 3) {
               targetDevice = devices[2];
               fallbackDigitalZoom = 1;
           } else if (devices.length === 2) {
               targetDevice = devices[1]; 
               fallbackDigitalZoom = 2; // Digital zoom on the main camera
           } else {
               targetDevice = devices[0];
               fallbackDigitalZoom = 2;
           }
       } else {
           fallbackDigitalZoom = 1;
       }
    } else {
       targetDevice = findByKeyword(['main', 'principal', 'estandar', 'standard', '1x']);
       if (!targetDevice) {
           // En iOS Safari, a menudo todas se llaman "Cámara trasera". 
           // Si tenemos más de 1 lente, asumimos que el 0 es el gran angular (0.5x) y el 1 es el principal (1x).
           const nonUltra = devices.find(d => !d.label.toLowerCase().includes('ultra') && !d.label.toLowerCase().includes('tele') && !d.label.toLowerCase().includes('angular') && d.deviceId !== devices[0]?.deviceId);
           targetDevice = nonUltra || (devices.length > 1 ? devices[1] : devices[0]);
       }
       fallbackDigitalZoom = 1;
    }

    if (targetDevice && devices[currentIndex] && targetDevice.deviceId !== devices[currentIndex].deviceId) {
       startCamera(targetDevice.deviceId, false);
       const idx = devices.findIndex(d => d.deviceId === targetDevice.deviceId);
       if (idx !== -1) setCurrentIndex(idx);
    }
    setDigitalZoom(fallbackDigitalZoom);
  };

  const takeInAppPhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const needsRotation = (landscapeAngle !== 0) && (video.videoHeight > video.videoWidth);
    const applyRotationNow = needsRotation && !enableAnnotation;

    const sx = (video.videoWidth - (video.videoWidth / digitalZoom)) / 2;
    const sy = (video.videoHeight - (video.videoHeight / digitalZoom)) / 2;
    const sWidth = video.videoWidth / digitalZoom;
    const sHeight = video.videoHeight / digitalZoom;

    // LIMITAR LA RESOLUCIÓN PARA EVITAR QUE toDataURL CONGELE LA PANTALLA
    const MAX_DIMENSION = 1920; 
    let scale = 1;
    if (sWidth > MAX_DIMENSION || sHeight > MAX_DIMENSION) {
        scale = MAX_DIMENSION / Math.max(sWidth, sHeight);
    }

    const drawWidth = sWidth * scale;
    const drawHeight = sHeight * scale;

    if (applyRotationNow) {
      canvas.width = drawHeight;
      canvas.height = drawWidth;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-landscapeAngle * Math.PI / 180); 
      ctx.drawImage(video, sx, sy, sWidth, sHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    } else {
      // Dibujamos sin rotar para que el usuario pueda hacer anotaciones de forma natural
      canvas.width = drawWidth;
      canvas.height = drawHeight;
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, drawWidth, drawHeight);
    }

    if (enableAnnotation) {
      // Guardamos la foto sin rotar para la vista de anotación
      setPreviewImage(canvas.toDataURL('image/jpeg', 0.85));
      if (stream) stream.getTracks().forEach(t => t.stop());
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], "photo_capture.jpg", { type: "image/jpeg" }));
      onClose();
    }, 'image/jpeg', 0.95);
  };

  // --- ANNOTATION LOGIC ---
  useEffect(() => {
    if (previewImage && canvasRef.current) {
       const canvas = canvasRef.current;
       const ctx = canvas.getContext('2d');
       const img = new Image();
       img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, img.width, img.height);
          setHasDrawing(false);
       };
       img.src = previewImage;
    }
  }, [previewImage]);

  const handlePointerDown = (e) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    if (e.touches && e.touches.length > 0) e.preventDefault(); // Evitar scroll
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    ctx.lineTo(x, y);
    ctx.globalCompositeOperation = 'source-over';
    
    // Borde negro (Sombra fuerte) para contraste en fondos claros
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 8;
    
    // Color principal fluorescente para contraste en fondos oscuros
    ctx.strokeStyle = '#eab308'; // Amarillo brillante (Yellow-500)
    ctx.lineWidth = Math.max(5, canvas.width / 100); 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasDrawing(true);
  };

  const handlePointerUp = () => {
    if (isDrawing) {
       setIsDrawing(false);
       if (canvasRef.current) canvasRef.current.getContext('2d').closePath();
    }
  };
  
  const clearAnnotation = () => {
    if (previewImage && canvasRef.current) {
       const canvas = canvasRef.current;
       const ctx = canvas.getContext('2d');
       const img = new Image();
       img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, img.width, img.height);
          setHasDrawing(false);
       };
       img.src = previewImage;
    }
  };
  
  const confirmAnnotation = () => {
     if (!canvasRef.current) return;
     const canvas = canvasRef.current;
     
     // Si la cámara estaba en apaisado, rotamos la imagen *después* de haber dibujado
     const needsRotation = (landscapeAngle !== 0) && (canvas.height > canvas.width);
     
     if (needsRotation) {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = canvas.height;
        finalCanvas.height = canvas.width;
        const ctx = finalCanvas.getContext('2d');
        
        ctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
        ctx.rotate(-landscapeAngle * Math.PI / 180);
        ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        
        finalCanvas.toBlob((blob) => {
           if (!blob) return;
           onCapture(new File([blob], "photo_capture_annotated.jpg", { type: "image/jpeg" }));
           setPreviewImage(null);
           onClose();
        }, 'image/jpeg', 0.95);
     } else {
        canvas.toBlob((blob) => {
           if (!blob) return;
           onCapture(new File([blob], "photo_capture_annotated.jpg", { type: "image/jpeg" }));
           setPreviewImage(null);
           onClose();
        }, 'image/jpeg', 0.95);
     }
  };
  
  const retryPhoto = () => {
     setPreviewImage(null);
     setHasDrawing(false);
     startCamera(null, false);
  };
  // -------------------------

  if (!isOpen) return null;

  const modalContent = previewImage ? (
      <div className="fixed inset-0 w-full h-[100dvh] bg-black z-[99999] flex flex-col animate-in fade-in duration-200">
        <div className="bg-black text-white p-4 flex justify-between items-center z-10 shadow-md border-b border-slate-800">
          <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 truncate max-w-[50%]"><Edit3 className="w-5 h-5 text-red-400 shrink-0"/> Marcar Daños</h3>
          <button onClick={onClose} className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden touch-none">
           {/* Hint text at top */}
           <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-bold pointer-events-none z-20 border border-white/10">
              Dibuja con tu dedo para marcar zonas
           </div>

           <canvas 
             ref={canvasRef}
             className="max-w-full max-h-full object-contain cursor-crosshair"
             onMouseDown={handlePointerDown}
             onMouseMove={handlePointerMove}
             onMouseUp={handlePointerUp}
             onMouseLeave={handlePointerUp}
             onTouchStart={handlePointerDown}
             onTouchMove={handlePointerMove}
             onTouchEnd={handlePointerUp}
             onTouchCancel={handlePointerUp}
           />
        </div>
        
        <div className="bg-slate-900 pb-8 pt-4 px-4 flex flex-col gap-3 z-10 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
           <div className="flex gap-3">
             <button onClick={retryPhoto} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-2xl font-black text-sm flex justify-center items-center gap-2 border border-slate-700 active:scale-95 transition-all">
                <RefreshCw className="w-4 h-4"/> Reintentar
             </button>
             {hasDrawing && (
               <button onClick={clearAnnotation} className="flex-1 bg-red-900/40 hover:bg-red-900/60 text-red-300 py-3.5 rounded-2xl font-black text-sm flex justify-center items-center gap-2 border border-red-900/50 active:scale-95 transition-all">
                  <X className="w-4 h-4"/> Borrar Trazo
               </button>
             )}
           </div>
           
           <button onClick={confirmAnnotation} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 transition-all mt-1">
              <CheckCircle className="w-6 h-6"/> Confirmar y Guardar
           </button>
        </div>
      </div>
  ) : (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black z-[99999] flex flex-col animate-in fade-in duration-200">
      <div className="bg-black text-white p-4 flex justify-between items-center z-10 shadow-md border-b border-slate-800">
        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 truncate max-w-[40%]"><Camera className="w-5 h-5 text-blue-400 shrink-0"/> {title}</h3>
        <div className="flex items-center gap-3">
          <button onClick={toggleOrientation} className="bg-slate-800 p-2 rounded-full text-white hover:bg-slate-700 transition-colors shadow-sm"><RefreshCw className="w-5 h-5"/></button>
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
             <button onClick={() => setZoomLevel(0.5)} className={`w-12 h-10 rounded-full text-sm font-black transition-all duration-300 ${activeZoomLabel === 0.5 ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-slate-300 hover:text-white'}`}>0.5x</button>
             <button onClick={() => setZoomLevel(1)} className={`w-12 h-10 rounded-full text-sm font-black transition-all duration-300 ${activeZoomLabel === 1 ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-slate-300 hover:text-white'}`}>1x</button>
             <button onClick={() => setZoomLevel(2)} className={`w-12 h-10 rounded-full text-sm font-black transition-all duration-300 ${activeZoomLabel === 2 ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-slate-300 hover:text-white'}`}>2x</button>
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
               if (f) { 
                  if (enableAnnotation) {
                     const reader = new FileReader();
                     reader.onload = (ev) => {
                        setPreviewImage(ev.target.result);
                        if (stream) stream.getTracks().forEach(t => t.stop());
                     };
                     reader.readAsDataURL(f);
                  } else {
                     onCapture(f); onClose(); 
                  }
               }
            }} />
            🖼️ O elegir una de tu Galería
         </label>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
