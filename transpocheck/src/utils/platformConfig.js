/**
 * Configuraciones independientes por plataforma (iPhone/iOS, Android y Escritorio).
 * Detecta automáticamente el dispositivo de ingreso para aplicar parámetros de cámara
 * y flujo de compartido adaptados sin interferencias entre sistemas operativos.
 */

const AUX_SENSOR_KEYWORDS = ['lidar', 'depth', 'profundidad', 'tof', 'infrared'];
const FRONT_CAMERA_KEYWORDS = ['front', 'delantera', 'frontal', 'user', 'selfie'];
const ULTRA_CAMERA_KEYWORDS = ['ultra', 'gran angular', 'wide-angle', '0.5', '0,5'];
const TELE_3X_KEYWORDS = ['3x', '3.0x', 'periscope', 'periscopio', 'telephoto', 'teleobjetivo', 'tele'];
const TELE_FALLBACK_KEYWORDS = ['zoom', '2x'];

/**
 * Detecta automáticamente la plataforma desde la que se ingresó a la aplicación.
 * @returns {'ios' | 'android' | 'desktop'}
 */
export const detectPlatform = () => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
};

export const PLATFORM_CONFIGS = {
  ios: {
    id: 'ios',
    label: 'iPhone / iPad (iOS)',
    shortLabel: 'iOS',
    isIOS: true,
    isAndroid: false,
    isMobile: true,
    camera: {
      excludeTrueDepthFromBack: true,
      excludeAuxSensors: true,
      auxKeywords: AUX_SENSOR_KEYWORDS,
      frontKeywords: FRONT_CAMERA_KEYWORDS,
      ultraKeywords: ULTRA_CAMERA_KEYWORDS,
      tele3xKeywords: TELE_3X_KEYWORDS,
      teleFallbackKeywords: TELE_FALLBACK_KEYWORDS,
      mainStrategy: 'ios-prefer-active',
      mainExplicitKeywords: ['main', 'principal', 'standard', 'estandar', '1x'],
      preferredResolution: { width: { ideal: 3840 }, height: { ideal: 2160 } },
      fallbackResolution: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      // En iOS, abrir el lente físico "Back Telephoto Camera" bloquea el enfoque cercano en WebKit.
      useOpticalTelephotoIn3x: false,
      allowFallbackToEnvWhenNoMainIn3x: true,
      highQualityCanvasSmoothing: true,
      getVideoTransformStyle: (digitalZoom) => ({
        transform: `scale(${digitalZoom}) translateZ(0)`,
        transformOrigin: 'center center',
        willChange: 'transform'
      })
    },
    share: {
      // Safari requiere interacción síncrona por separado para compartir archivo PDF y texto con saltos de línea.
      alwaysUseTwoStepPdfModal: true,
      keepModalOpenAfterPdfShare: true
    }
  },
  android: {
    id: 'android',
    label: 'Android',
    shortLabel: 'Android',
    isIOS: false,
    isAndroid: true,
    isMobile: true,
    camera: {
      excludeTrueDepthFromBack: false,
      excludeAuxSensors: false,
      auxKeywords: AUX_SENSOR_KEYWORDS,
      frontKeywords: FRONT_CAMERA_KEYWORDS,
      ultraKeywords: ULTRA_CAMERA_KEYWORDS,
      tele3xKeywords: TELE_3X_KEYWORDS,
      teleFallbackKeywords: TELE_FALLBACK_KEYWORDS,
      mainStrategy: 'android-standard',
      mainKeywords: ['main', 'principal', 'standard', 'estandar', '1x', 'wide'],
      // Mantiene proporción nativa 4:3 en Camera2 HAL sin recortar a 16:9 ni reiniciar zoom/focusMode.
      preferredResolution: { width: { ideal: 4096 }, height: { ideal: 2160 } },
      fallbackResolution: null,
      useOpticalTelephotoIn3x: true,
      allowFallbackToEnvWhenNoMainIn3x: false,
      highQualityCanvasSmoothing: true,
      getVideoTransformStyle: (digitalZoom) => ({
        transform: `scale(${digitalZoom})`
      })
    },
    share: {
      alwaysUseTwoStepPdfModal: false,
      keepModalOpenAfterPdfShare: false
    }
  },
  desktop: {
    id: 'desktop',
    label: 'PC / Escritorio',
    shortLabel: 'Web',
    isIOS: false,
    isAndroid: false,
    isMobile: false,
    camera: {
      excludeTrueDepthFromBack: false,
      excludeAuxSensors: false,
      auxKeywords: AUX_SENSOR_KEYWORDS,
      frontKeywords: FRONT_CAMERA_KEYWORDS,
      ultraKeywords: ULTRA_CAMERA_KEYWORDS,
      tele3xKeywords: TELE_3X_KEYWORDS,
      teleFallbackKeywords: TELE_FALLBACK_KEYWORDS,
      mainStrategy: 'android-standard',
      mainKeywords: ['main', 'principal', 'standard', 'estandar', '1x', 'wide'],
      preferredResolution: { width: { ideal: 4096 }, height: { ideal: 2160 } },
      fallbackResolution: null,
      useOpticalTelephotoIn3x: true,
      allowFallbackToEnvWhenNoMainIn3x: false,
      highQualityCanvasSmoothing: true,
      getVideoTransformStyle: (digitalZoom) => ({
        transform: `scale(${digitalZoom})`
      })
    },
    share: {
      alwaysUseTwoStepPdfModal: false,
      keepModalOpenAfterPdfShare: false
    }
  }
};

/**
 * Obtiene el perfil de configuración completo para la plataforma detectada (o la indicada).
 * @param {'ios' | 'android' | 'desktop' | null} platformOverride
 */
export const getPlatformConfig = (platformOverride = null) => {
  const platform = platformOverride && PLATFORM_CONFIGS[platformOverride]
    ? platformOverride
    : detectPlatform();
  return PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.desktop;
};

/**
 * Clasifica los lentes físicos disponibles usando estrictamente las reglas de la plataforma activa.
 */
export const classifyCamerasForPlatform = (platformConfig, deviceList = [], activeDeviceId = null) => {
  const camCfg = platformConfig?.camera || PLATFORM_CONFIGS.android.camera;
  const videoInputs = (deviceList || []).filter(d => d.kind === 'videoinput');

  const isFront = (label) => {
    const l = (label || '').toLowerCase();
    return camCfg.frontKeywords.some(k => l.includes(k)) ||
      (camCfg.excludeTrueDepthFromBack && l.includes('truedepth'));
  };

  const isAuxSensor = (label) => {
    const l = (label || '').toLowerCase();
    return camCfg.auxKeywords.some(k => l.includes(k));
  };

  const backCams = videoInputs.filter(
    d => !isFront(d.label) && (!camCfg.excludeAuxSensors || !isAuxSensor(d.label))
  );
  const cameras = backCams.length > 0 ? backCams : videoInputs.filter(d => !isFront(d.label));
  const usableCameras = cameras.length > 0 ? cameras : videoInputs;

  const ultraKeywords = camCfg.ultraKeywords;
  const tele3xKeywords = camCfg.tele3xKeywords;
  const teleFallbackKeywords = camCfg.teleFallbackKeywords;
  const teleKeywords = [...tele3xKeywords, ...teleFallbackKeywords];

  // 1. Cámara Ultra Gran Angular (0.5x)
  let ultra = usableCameras.find(d => ultraKeywords.some(k => (d.label || '').toLowerCase().includes(k)));

  // 2. Cámara Teleobjetivo (3x óptico prioritario sobre 2x)
  const tele =
    usableCameras.find(d => {
      const l = (d.label || '').toLowerCase();
      return l.includes('3x') || l.includes('3.0x');
    }) ||
    usableCameras.find(d => tele3xKeywords.some(k => (d.label || '').toLowerCase().includes(k))) ||
    usableCameras.find(d => teleFallbackKeywords.some(k => (d.label || '').toLowerCase().includes(k)));

  // 3. Cámara Principal (1x) según estrategia específica de plataforma
  let main = null;
  if (camCfg.mainStrategy === 'ios-prefer-active') {
    const mainExplicit = camCfg.mainExplicitKeywords || ['main', 'principal', 'standard', 'estandar', '1x'];
    main = usableCameras.find(d => {
      const l = (d.label || '').toLowerCase();
      return !ultraKeywords.some(k => l.includes(k)) &&
        !teleKeywords.some(k => l.includes(k)) &&
        mainExplicit.some(k => l.includes(k));
    });
    if (!main && activeDeviceId) {
      main = usableCameras.find(d =>
        d.deviceId === activeDeviceId &&
        d.deviceId !== ultra?.deviceId &&
        d.deviceId !== tele?.deviceId
      );
    }
    if (!main) {
      main = usableCameras.find(d => {
        const l = (d.label || '').toLowerCase();
        return !ultraKeywords.some(k => l.includes(k)) &&
          !teleKeywords.some(k => l.includes(k)) &&
          !l.includes('dual') &&
          !l.includes('triple') &&
          (l.includes('wide') || l === 'back camera' || l === 'cámara trasera');
      });
    }
  } else {
    const mainKeywords = camCfg.mainKeywords || ['main', 'principal', 'standard', 'estandar', '1x', 'wide'];
    main = usableCameras.find(d => {
      const l = (d.label || '').toLowerCase();
      return !ultraKeywords.some(k => l.includes(k)) &&
        !teleKeywords.some(k => l.includes(k)) &&
        mainKeywords.some(k => l.includes(k));
    });
    if (!main && activeDeviceId) {
      main = usableCameras.find(d => d.deviceId === activeDeviceId);
    }
  }

  // Fallback genérico para múltiples cámaras traseras sin etiqueta (común en Android)
  if (!ultra && usableCameras.length > 1) {
    ultra = usableCameras.find(d => d.deviceId !== main?.deviceId && (!tele || d.deviceId !== tele.deviceId));
  }

  if (!main && usableCameras.length > 0) {
    main = usableCameras.find(d => d.deviceId !== ultra?.deviceId) || usableCameras[0];
  }

  return { main, ultra, tele, cameras: usableCameras };
};

/**
 * Abre un stream de video respetando las restricciones de hardware de la plataforma activa.
 */
export const acquireCameraStreamForPlatform = async (platformConfig, targetDeviceId = null) => {
  const camCfg = platformConfig?.camera || PLATFORM_CONFIGS.android.camera;
  const preferred = camCfg.preferredResolution;
  const fallbackRes = camCfg.fallbackResolution || preferred;

  if (!targetDeviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', ...preferred }
      });
    } catch (hiErr) {
      if (fallbackRes !== preferred) {
        console.warn("[ERR-CAM-HIRES] Fallback a resolución secundaria en environment:", hiErr);
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', ...fallbackRes }
        });
      }
      throw hiErr;
    }
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: targetDeviceId }, ...preferred }
    });
  } catch (exactErr) {
    console.warn("[ERR-CAM-EXACT] Fallback a ideal deviceId:", exactErr);
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: targetDeviceId, ...fallbackRes }
      });
    } catch (idealErr) {
      console.warn("[ERR-CAM-IDEAL] Fallback a environment estándar:", idealErr);
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', ...fallbackRes }
      });
    }
  }
};
