import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, CheckCircle, RefreshCw, RefreshCcw, Edit3, AlertCircle, AlertTriangle } from 'lucide-react';
import { safeStorageSet } from '../../utils/helpers';

export default function InAppCamera({ isOpen, onClose, onCapture, title, enableAnnotation = false }) {
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [landscapeAngle, setLandscapeAngle] = useState(0);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [activeZoomLabel, setActiveZoomLabel] = useState(0.5);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [isSwitchingLens, setIsSwitchingLens] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const videoRef = useRef(null);

  // Hardware Camera Classification Refs
  const mainCameraRef = useRef(null);
  const ultraCameraRef = useRef(null);
  const teleCameraRef = useRef(null);
  const currentDeviceIdRef = useRef(null);
  const streamRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // States for Photo Annotation
  const [previewImage, setPreviewImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvasRef = useRef(null);

  // Sync stream ref
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Sync current device ID ref
  useEffect(() => {
    currentDeviceIdRef.current = currentDeviceId;
  }, [currentDeviceId]);

  const showToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const stopActiveTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (e) { /* ignore */ }
      });
      streamRef.current = null;
    }
  };

  // Clasifica los dispositivos de cámara disponibles
  const classifyCameras = (deviceList, activeDeviceId) => {
    const isFront = (label) => {
      const l = (label || '').toLowerCase();
      return l.includes('front') || l.includes('delantera') || l.includes('frontal') || l.includes('user') || l.includes('selfie');
    };

    const backCams = deviceList.filter(d => d.kind === 'videoinput' && !isFront(d.label));
    const cameras = backCams.length > 0 ? backCams : deviceList.filter(d => d.kind === 'videoinput');

    const ultraKeywords = ['ultra', 'gran angular', 'wide-angle', '0.5', '0,5'];
    const tele3xKeywords = ['3x', '3.0x', 'periscope', 'periscopio', 'telephoto', 'teleobjetivo', 'tele'];
    const teleFallbackKeywords = ['zoom', '2x'];
    const teleKeywords = [...tele3xKeywords, ...teleFallbackKeywords];
    const mainKeywords = ['main', 'principal', 'standard', 'estandar', '1x', 'wide'];

    // 1. Cámara Ultra Gran Angular (0.5x)
    let ultra = cameras.find(d => ultraKeywords.some(k => d.label.toLowerCase().includes(k)));

    // 2. Cámara Teleobjetivo (prioriza 3x óptico / telefoto dedicado sobre 2x) - Solo si tiene palabras clave explícitas para no abrir sensores macro o ToF de profundidad
    let tele =
      cameras.find(d => {
        const l = d.label.toLowerCase();
        return l.includes('3x') || l.includes('3.0x');
      }) ||
      cameras.find(d => tele3xKeywords.some(k => d.label.toLowerCase().includes(k))) ||
      cameras.find(d => teleFallbackKeywords.some(k => d.label.toLowerCase().includes(k)));

    // 3. Cámara Principal (1x)
    let main = cameras.find(d =>
      !ultraKeywords.some(k => d.label.toLowerCase().includes(k)) &&
      !teleKeywords.some(k => d.label.toLowerCase().includes(k)) &&
      mainKeywords.some(k => d.label.toLowerCase().includes(k))
    );

    // Si no tiene etiqueta explícita de 'main', la cámara activa por defecto en 'environment' es la principal
    if (!main && activeDeviceId) {
      main = cameras.find(d => d.deviceId === activeDeviceId);
    }

    // Si aún no se detecta ultra gran angular pero hay múltiples cámaras traseras con nombres genéricos
    // (común en Android: camera2 0 = principal, camera2 2 = ultra gran angular):
    if (!ultra && cameras.length > 1) {
      ultra = cameras.find(d => d.deviceId !== main?.deviceId && (!tele || d.deviceId !== tele.deviceId));
    }

    // Fallbacks si falta alguna
    if (!main && cameras.length > 0) {
      main = cameras.find(d => d.deviceId !== ultra?.deviceId) || cameras[0];
    }

    return { main, ultra, tele, cameras };
  };

  const getMediaConstraints = (targetDeviceId) => {
    const baseConstraints = { width: { ideal: 4096 }, height: { ideal: 2160 } };
    if (targetDeviceId) {
      return { video: { deviceId: { exact: targetDeviceId }, ...baseConstraints } };
    }
    return { video: { facingMode: 'environment', ...baseConstraints } };
  };

  const safeGetUserMedia = async (targetDeviceId) => {
    const baseConstraints = { width: { ideal: 4096 }, height: { ideal: 2160 } };
    if (!targetDeviceId) {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', ...baseConstraints }
      });
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: targetDeviceId }, ...baseConstraints }
      });
    } catch (exactErr) {
      console.warn("[ERR-CAM-EXACT] Fallback a ideal deviceId:", exactErr);
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: targetDeviceId, ...baseConstraints }
        });
      } catch (idealErr) {
        console.warn("[ERR-CAM-IDEAL] Fallback a environment estándar:", idealErr);
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', ...baseConstraints }
        });
      }
    }
  };

  const startCamera = async (isFirst = false) => {
    setCameraError(null);
    stopActiveTracks();

    try {
      // 1. Abrir cámara base por defecto
      let initialStream = await safeGetUserMedia(null);
      let activeTrack = initialStream.getVideoTracks()[0];
      let activeDeviceId = activeTrack?.getSettings()?.deviceId || null;

      // 2. Enumerate devices para conocer el hardware físico del teléfono
      const devs = await navigator.mediaDevices.enumerateDevices();
      const { main, ultra, tele, cameras } = classifyCameras(devs, activeDeviceId);

      setDevices(cameras);
      mainCameraRef.current = main;
      ultraCameraRef.current = ultra;
      teleCameraRef.current = tele;

      // Guardar ultraId si se identificó
      if (ultra?.deviceId) {
        safeStorageSet('ultraCameraId', ultra.deviceId);
      }

      // 3. Revisar si el track nativo soporta zoom por hardware
      const caps = activeTrack && typeof activeTrack.getCapabilities === 'function' ? activeTrack.getCapabilities() : {};
      const hasNativeZoom = !!caps.zoom;

      // Decidir si iniciamos en 0.5x (por preferencia de checklist) o 1x
      let currentActiveStream = initialStream;
      let chosenZoom = 0.5;

      if (hasNativeZoom && caps.zoom.min <= 0.6) {
        // La cámara principal soporta zoom ultra-wide nativo
        try {
          await activeTrack.applyConstraints({ advanced: [{ zoom: Math.max(caps.zoom.min, 0.5) }] });
        } catch (e) {
          console.warn("[ERR-CAM-START-01] Error aplicando zoom nativo 0.5:", e);
        }
        setDigitalZoom(1);
        setActiveZoomLabel(0.5);
      } else if (ultra && ultra.deviceId && ultra.deviceId !== activeDeviceId) {
        // Cambiar al lente ultra gran angular físico
        try {
          initialStream.getTracks().forEach(t => t.stop());
          await new Promise(r => setTimeout(r, 60)); // Breve pausa para liberar sensor en iOS/Android
          const ultraStream = await safeGetUserMedia(ultra.deviceId);
          currentActiveStream = ultraStream;
          activeTrack = ultraStream.getVideoTracks()[0];
          activeDeviceId = activeTrack?.getSettings()?.deviceId || ultra.deviceId;
          setDigitalZoom(1);
          setActiveZoomLabel(0.5);
        } catch (switchErr) {
          console.warn("[ERR-CAM-START-02] No se pudo conmutar a ultra gran angular inicial:", switchErr);
          // Si falló cambiar a ultra, recuperamos la principal a 1x
          currentActiveStream = await safeGetUserMedia(main?.deviceId || null);
          activeTrack = currentActiveStream.getVideoTracks()[0];
          activeDeviceId = activeTrack?.getSettings()?.deviceId || null;
          chosenZoom = 1;
          setActiveZoomLabel(1);
          setDigitalZoom(1);
        }
      } else {
        // Dispositivo sin ultra gran angular físico ni zoom nativo < 1
        chosenZoom = 1;
        setActiveZoomLabel(1);
        setDigitalZoom(1);
      }

      setCurrentDeviceId(activeDeviceId);
      setStream(currentActiveStream);
    } catch (error) {
      console.error("[ERR-CAM-INIT-01] Error iniciando cámara:", error);
      setCameraError({
        code: "[ERR-CAM-INIT-01]",
        message: "No se pudo acceder a la cámara. Por favor asegúrate de haber concedido los permisos de cámara en tu navegador."
      });
    }
  };

  // Cambio dinámico de lente y nivel de zoom
  const setZoomLevel = async (level) => {
    if (isSwitchingLens) return;
    setActiveZoomLabel(level);
    setIsSwitchingLens(true);

    try {
      const activeStream = streamRef.current;
      const activeTrack = activeStream?.getVideoTracks()[0];
      const caps = activeTrack && typeof activeTrack.getCapabilities === 'function' ? activeTrack.getCapabilities() : {};
      const hasNativeZoom = !!caps.zoom;

      // ==========================================
      // CASO 0.5x (Ultra Gran Angular)
      // ==========================================
      if (level === 0.5) {
        // Intento 1: Zoom nativo si la cámara actual lo permite
        if (hasNativeZoom && caps.zoom.min <= 0.6) {
          try {
            await activeTrack.applyConstraints({ advanced: [{ zoom: Math.max(caps.zoom.min, 0.5) }] });
            setDigitalZoom(1);
            setIsSwitchingLens(false);
            return;
          } catch (e) {
            console.warn("[ERR-CAM-ZOOM-05N] Falló zoom nativo 0.5:", e);
          }
        }

        // Intento 2: Conmutar al lente físico ultra gran angular si existe
        const ultraCam = ultraCameraRef.current;
        if (ultraCam && ultraCam.deviceId && ultraCam.deviceId !== currentDeviceIdRef.current) {
          stopActiveTracks();
          await new Promise(r => setTimeout(r, 60)); // Pausa de liberación de hardware
          try {
            const newStream = await safeGetUserMedia(ultraCam.deviceId);
            const newTrack = newStream.getVideoTracks()[0];
            const newId = newTrack?.getSettings()?.deviceId || ultraCam.deviceId;
            setCurrentDeviceId(newId);
            setStream(newStream);
            setDigitalZoom(1);
            setIsSwitchingLens(false);
            return;
          } catch (switchErr) {
            console.error("[ERR-CAM-ZOOM-05SW] Error conmutando a ultra gran angular:", switchErr);
            showToast("No se pudo activar el lente 0.5x en este dispositivo. [ERR-CAM-ZOOM-05SW]");
          }
        }

        setDigitalZoom(1);
        setIsSwitchingLens(false);
        return;
      }

      // ==========================================
      // CASO 1x (Lente Estándar / Principal)
      // ==========================================
      if (level === 1) {
        const mainCam = mainCameraRef.current;
        let workingStream = activeStream;

        // Si estamos actualmente en el lente ultra (o tele) y tenemos la cámara principal identificada, conmutar a la principal
        if (mainCam && mainCam.deviceId && mainCam.deviceId !== currentDeviceIdRef.current) {
          stopActiveTracks();
          await new Promise(r => setTimeout(r, 60));
          try {
            const newStream = await safeGetUserMedia(mainCam.deviceId);
            workingStream = newStream;
            const newTrack = newStream.getVideoTracks()[0];
            const newId = newTrack?.getSettings()?.deviceId || mainCam.deviceId;
            setCurrentDeviceId(newId);
            setStream(newStream);
          } catch (switchErr) {
            console.error("[ERR-CAM-ZOOM-1XSW] Error conmutando a cámara principal:", switchErr);
            showToast("Error al volver al lente 1x. [ERR-CAM-ZOOM-1XSW]");
            // Fallback a environment estándar
            const fallbackStream = await safeGetUserMedia(null);
            workingStream = fallbackStream;
            setCurrentDeviceId(fallbackStream.getVideoTracks()[0]?.getSettings()?.deviceId || null);
            setStream(fallbackStream);
          }
        }

        // En la cámara principal, restaurar zoom nativo a 1.0 si está disponible
        const currentTrack = workingStream?.getVideoTracks()[0];
        const currentCaps = currentTrack && typeof currentTrack.getCapabilities === 'function' ? currentTrack.getCapabilities() : {};
        if (currentCaps.zoom) {
          try {
            const targetZ = Math.max(currentCaps.zoom.min, Math.min(1.0, currentCaps.zoom.max));
            await currentTrack.applyConstraints({ advanced: [{ zoom: targetZ }] });
          } catch (zErr) {
            console.warn("[ERR-CAM-ZOOM-1XN] Falló aplicar zoom nativo 1.0:", zErr);
          }
        }

        setDigitalZoom(1);
        setIsSwitchingLens(false);
        return;
      }

      // ==========================================
      // CASO 3x (Teleobjetivo Óptico / Zoom 3x)
      // ==========================================
      if (level === 3) {
        // Intento 1: Si existe cámara física teleobjetivo dedicada (3x / telephoto), conmutar directo al lente óptico
        const teleCam = teleCameraRef.current;
        if (teleCam && teleCam.deviceId) {
          try {
            let teleStream = activeStream;
            if (teleCam.deviceId !== currentDeviceIdRef.current) {
              stopActiveTracks();
              await new Promise(r => setTimeout(r, 60));
              teleStream = await safeGetUserMedia(teleCam.deviceId);
              const newTrack = teleStream.getVideoTracks()[0];
              const newId = newTrack?.getSettings()?.deviceId || teleCam.deviceId;
              setCurrentDeviceId(newId);
              setStream(teleStream);
            }

            const teleTrack = teleStream?.getVideoTracks()[0];
            const teleCaps = teleTrack && typeof teleTrack.getCapabilities === 'function' ? teleTrack.getCapabilities() : {};
            const teleLabel = (teleCam.label || '').toLowerCase();
            const isExplicit2xOnly = teleLabel.includes('2x') && !teleLabel.includes('3x');

            if (isExplicit2xOnly) {
              // Si el sensor dedicado es 2x, ajustar a 3x con zoom nativo (1.5x) o digital
              if (teleCaps.zoom && teleCaps.zoom.max >= 1.5) {
                await teleTrack.applyConstraints({ advanced: [{ zoom: 1.5 }] });
                setDigitalZoom(1);
              } else {
                setDigitalZoom(1.5);
              }
            } else {
              if (teleCaps.zoom) {
                const targetZ = Math.max(teleCaps.zoom.min, Math.min(1.0, teleCaps.zoom.max));
                await teleTrack.applyConstraints({ advanced: [{ zoom: targetZ }] });
              }
              setDigitalZoom(1);
            }

            setIsSwitchingLens(false);
            return;
          } catch (teleErr) {
            console.warn("[ERR-CAM-ZOOM-3XSW] Falló cambio a teleobjetivo físico, intentando zoom óptico nativo 3x:", teleErr);
          }
        }

        // Intento 2: Asegurar cámara principal (evitar zoom digital sobre el lente 0.5x) y aplicar zoom óptico/nativo 3.0
        const mainCam = mainCameraRef.current;
        let workingStream = streamRef.current;
        if (mainCam && mainCam.deviceId && mainCam.deviceId !== currentDeviceIdRef.current) {
          stopActiveTracks();
          await new Promise(r => setTimeout(r, 60));
          try {
            const newStream = await safeGetUserMedia(mainCam.deviceId);
            workingStream = newStream;
            const newTrack = newStream.getVideoTracks()[0];
            const newId = newTrack?.getSettings()?.deviceId || mainCam.deviceId;
            setCurrentDeviceId(newId);
            setStream(newStream);
          } catch (e) {
            console.warn("[ERR-CAM-ZOOM-3X-MAIN] Error cambiando a cámara principal para zoom 3x:", e);
          }
        }

        const currentTrack = workingStream?.getVideoTracks()[0];
        const currentCaps = currentTrack && typeof currentTrack.getCapabilities === 'function' ? currentTrack.getCapabilities() : {};
        if (currentCaps.zoom && currentCaps.zoom.max >= 3.0) {
          try {
            await currentTrack.applyConstraints({ advanced: [{ zoom: 3.0 }] });
            setDigitalZoom(1);
            setIsSwitchingLens(false);
            return;
          } catch (e) {
            console.warn("[ERR-CAM-ZOOM-3XN] Falló zoom nativo 3.0:", e);
          }
        } else if (currentCaps.zoom && currentCaps.zoom.max > 1.0) {
          try {
            const maxNative = currentCaps.zoom.max;
            await currentTrack.applyConstraints({ advanced: [{ zoom: maxNative }] });
            setDigitalZoom(3.0 / maxNative);
            setIsSwitchingLens(false);
            return;
          } catch (e) {
            console.warn("[ERR-CAM-ZOOM-3XHYB] Falló zoom híbrido hasta 3.0:", e);
          }
        }

        // Intento 3: Fallback a Zoom Digital 3x de alta resolución sobre el sensor principal
        setDigitalZoom(3);
        setIsSwitchingLens(false);
        return;
      }
    } catch (unexpectedError) {
      console.error("[ERR-CAM-ZOOM-UNEXPECTED] Error general al cambiar zoom:", unexpectedError);
      showToast("No se pudo cambiar el lente seleccionado. [ERR-CAM-ZOOM-UNEXPECTED]");
    } finally {
      setIsSwitchingLens(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCameraError(null);
      setPreviewImage(null);
      setHasDrawing(false);
      setIsDrawing(false);
      setIsManualOverride(false);
      startCamera(true);
    } else {
      stopActiveTracks();
      setStream(null);
      setDevices([]);
      setCurrentDeviceId(null);
      setLandscapeAngle(0);
      setIsManualOverride(false);
      setActiveZoomLabel(0.5);
      setDigitalZoom(1);
      setPreviewImage(null);
      setHasDrawing(false);
      setIsDrawing(false);
      setCameraError(null);
      setToastMessage(null);
    }
    return () => {
      stopActiveTracks();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
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
      videoRef.current.play().catch(e => {
        console.warn("[ERR-CAM-PLAY] Autoplay bloqueado:", e);
      });
    }
  }, [isOpen, stream]);

  // Detección de giroscopio con histéresis
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
  }, [isOpen, isManualOverride]);

  const takeInAppPhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      showToast("La cámara se está inicializando. Intenta en un segundo. [ERR-CAM-BUSY]");
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const needsRotation = (landscapeAngle !== 0) && (video.videoHeight > video.videoWidth);
    const applyRotationNow = needsRotation && !enableAnnotation;

    const currentZoom = digitalZoom || 1;
    const sx = (video.videoWidth - (video.videoWidth / currentZoom)) / 2;
    const sy = (video.videoHeight - (video.videoHeight / currentZoom)) / 2;
    const sWidth = video.videoWidth / currentZoom;
    const sHeight = video.videoHeight / currentZoom;

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
      setPreviewImage(canvas.toDataURL('image/jpeg', 0.85));
      stopActiveTracks();
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        showToast("Error al procesar la fotografía. [ERR-CAM-BLOB-01]");
        return;
      }
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
    if (e.touches && e.touches.length > 0) e.preventDefault();
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
    ctx.strokeStyle = '#eab308'; // Amarillo brillante
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
    startCamera(false);
  };
  // -------------------------

  if (!isOpen) return null;

  const modalContent = cameraError ? (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 z-[99999] flex flex-col justify-center items-center p-6 text-white text-center">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg max-w-sm w-full flex flex-col items-center gap-4 shadow-lg">
        <div className="w-12 h-12 rounded-md bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-white">Error de Cámara</h3>
          <span className="text-[11px] font-mono font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
            {cameraError.code}
          </span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">{cameraError.message}</p>
        <div className="flex flex-col w-full gap-2 pt-2">
          <button
            onClick={() => startCamera(true)}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-md text-sm border border-slate-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  ) : previewImage ? (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 z-[99999] flex flex-col">
      <div className="bg-slate-900 text-white px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex justify-between items-center z-10 border-b border-slate-800">
        <h3 className="font-semibold text-xs uppercase tracking-wider flex items-center gap-2 truncate max-w-[50%]">
          <Edit3 className="w-4 h-4 text-red-400 shrink-0" /> Marcar Daños
        </h3>
        <button onClick={onClose} className="bg-slate-800 p-2 rounded-md text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden touch-none">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 px-3 py-1.5 rounded-md text-slate-200 text-xs font-medium pointer-events-none z-20 border border-slate-700">
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

      <div className="bg-slate-900 pt-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-3 z-10 border-t border-slate-800">
        <div className="flex gap-2.5">
          <button
            onClick={retryPhoto}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-100 py-2.5 rounded-md font-semibold text-xs flex justify-center items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
          {hasDrawing && (
            <button
              onClick={clearAnnotation}
              className="flex-1 bg-red-950/60 hover:bg-red-900/60 text-red-300 py-2.5 rounded-md font-semibold text-xs flex justify-center items-center gap-2 border border-red-800 transition-colors"
            >
              <X className="w-4 h-4" /> Borrar Trazo
            </button>
          )}
        </div>

        <button
          onClick={confirmAnnotation}
          className="w-full bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-md font-semibold text-sm flex justify-center items-center gap-2 transition-colors"
        >
          <CheckCircle className="w-5 h-5" /> Confirmar y Guardar
        </button>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 z-[99999] flex flex-col">
      <div className="bg-slate-900 text-white px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex justify-between items-center z-10 border-b border-slate-800">
        <h3 className="font-semibold text-xs uppercase tracking-wider flex items-center gap-2 truncate max-w-[55%]">
          <Camera className="w-4 h-4 text-blue-400 shrink-0" /> {title}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={toggleOrientation} className="bg-slate-800 p-2 rounded-md text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="bg-slate-800 p-2 rounded-md text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className="w-full h-full object-cover transition-transform duration-150"
          style={{ transform: `scale(${digitalZoom})` }}
        />

        {/* Notificación Toast Nativa */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900 text-amber-300 text-xs px-3.5 py-2 rounded-md shadow-md z-50 border border-amber-700 font-medium max-w-[90%] text-center flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900/95 px-4 py-2 rounded-md text-white text-center font-medium text-xs shadow-md border border-slate-700 z-40 w-[85%] max-w-xs flex items-center justify-center gap-2">
          <Camera className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Fotografiar:</span> <span className="text-blue-400 font-semibold truncate">{title}</span>
        </div>

        {landscapeAngle !== 0 && (
          <div
            className="absolute top-1/2 left-1/2 bg-emerald-700 text-white px-4 py-2 rounded-md font-semibold text-xs uppercase tracking-wider flex items-center gap-2 z-50 border border-emerald-500 shadow-md transition-transform duration-150"
            style={{
              transform: `translate(-50%, -50%) rotate(${landscapeAngle}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <CheckCircle className="w-4 h-4" /> Apaisado Activo
          </div>
        )}

        {/* Controles de Lente / Zoom Inteligente */}
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-1 bg-slate-900/95 p-1 rounded-md border border-slate-700 z-20 shadow-md">
          <button
            onClick={() => setZoomLevel(0.5)}
            disabled={isSwitchingLens}
            className={`w-10 h-9 rounded font-mono text-xs font-semibold transition-colors ${activeZoomLabel === 0.5 ? 'bg-blue-700 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            0.5x
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            disabled={isSwitchingLens}
            className={`w-10 h-9 rounded font-mono text-xs font-semibold transition-colors ${activeZoomLabel === 1 ? 'bg-blue-700 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            1x
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(3)}
            disabled={isSwitchingLens}
            className={`w-10 h-9 rounded font-mono text-xs font-semibold transition-colors ${activeZoomLabel === 3 ? 'bg-blue-700 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            3x
          </button>
        </div>
      </div>

      <div className="bg-slate-900 pt-4 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-3 z-10 border-t border-slate-800">
        <button
          onClick={takeInAppPhoto}
          className="w-full bg-blue-700 hover:bg-blue-600 text-white py-3.5 rounded-md font-semibold text-sm flex justify-center items-center gap-2.5 transition-colors"
        >
          <Camera className="w-5 h-5" />
          TOMAR FOTO AHORA
        </button>
        <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-md font-medium text-xs flex justify-center items-center gap-2 cursor-pointer transition-colors border border-slate-700">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files[0];
              if (f) {
                if (enableAnnotation) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setPreviewImage(ev.target.result);
                    stopActiveTracks();
                  };
                  reader.readAsDataURL(f);
                } else {
                  onCapture(f);
                  onClose();
                }
              }
            }}
          />
          Elegir imagen desde la galería
        </label>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
