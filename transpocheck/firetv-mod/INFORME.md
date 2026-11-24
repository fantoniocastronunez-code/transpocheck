# Informe de Personalización Estética – Amazon Fire TV Stick 3ª Gen

- **Dispositivo:** Amazon Fire TV Stick 3ª Gen (`AFTSSS` / `sheldonp`)
- **Sistema Operativo:** Fire OS 7.7.1.7 (`PS7717.5746N`, Android 9 / API 28, `armeabi-v7a`)
- **Dirección IP / Puerto ADB:** `192.168.1.142:5555`
- **Fecha de sesión:** 19 de noviembre de 2026

---

## 1. Comparativa de Estado: Antes vs. Después

| Parámetro | Estado Original (Antes) | Estado Personalizado (Después) | Método / Reversibilidad |
| :--- | :--- | :--- | :--- |
| **Resolución física** | `1920x1080` | `1920x1080` *(intacta)* | `wm size reset` |
| **Densidad de interfaz (`wm density`)** | `320` dpi | **`280` dpi** *(~12.5% más compacta)* | `wm density reset` |
| **Escala de fuente (`font_scale`)** | `1.0` | **`0.95`** | `settings put system font_scale 1.0` |
| **Animación de ventanas** | `1.0` (1x) | **`0.25`** (4x más rápida) | `settings put global window_animation_scale 1.0` |
| **Animación de transición** | `1.0` (1x) | **`0.25`** (4x más rápida) | `settings put global transition_animation_scale 1.0` |
| **Duración de animador** | `1.0` (1x) | **`0.25`** (4x más rápida) | `settings put global animator_duration_scale 1.0` |
| **Launcher disponible** | Solo `com.amazon.tv.launcher` | **Projectivy Launcher v4.73** (`com.spocky.projengmenu`) + Accesibilidad activa | `adb uninstall com.spocky.projengmenu` |
| **Protector de pantalla** | Amazon Screensaver (`com.amazon.ftv.screensaver`) | **Aerial Views v1.8.5** (`com.neilturner.aerialviews/.ui.screensaver.DreamActivity`) | `settings put secure screensaver_components com.amazon.ftv.screensaver/.app.services.ScreensaverService` |
| **Paquetes de sistema deshabilitados** | 1 (`com.android.nfc`) | **5** (`nfc` + 4 paquetes de publicidad/telemetría) | `pm enable <paquete>` |

---

## 2. Paquetes Deshabilitados (`pm disable-user --user 0`)

| Paquete | Descripción | Estado Actual | Comando para Revertir |
| :--- | :--- | :--- | :--- |
| `com.amazon.kso.blackbird` | Motor de ofertas especiales / banners publicitarios | `disabled-user` | `adb shell pm enable com.amazon.kso.blackbird` |
| `com.amazon.tv.acr` | Telemetría Automatic Content Recognition (ACR) | `disabled-user` | `adb shell pm enable com.amazon.tv.acr` |
| `com.amazon.hedwig` | Métricas y promociones de clips de vídeo en inicio | `disabled-user` | `adb shell pm enable com.amazon.hedwig` |
| `com.amazon.tv.releasenotes` | Ventanas emergentes de notas de versión tras OTA | `disabled-user` | `adb shell pm enable com.amazon.tv.releasenotes` |

*(Nota: `com.amazon.ftvads.deeplinking` se encuentra protegido a nivel de kernel en Fire OS 7.7.1.7 y no fue modificado).*

---

## 3. Aplicaciones Oficiales Instaladas (Sideload vía ADB)

1. **Projectivy Launcher v4.73** (`com.spocky.projengmenu`)
   - **Fuente oficial:** `https://github.com/spocky/miproja1/releases/tag/4.73`
   - **Copia local:** `apks/ProjectivyLauncher-4.73.apk`
   - **Servicio activado:** `com.spocky.projengmenu/com.spocky.projengmenu.services.ProjectivyAccessibilityService`
2. **Aerial Views Screensaver v1.8.5** (`com.neilturner.aerialviews`)
   - **Fuente oficial:** `https://github.com/theothernt/AerialViews/releases/tag/1.8.5`
   - **Copia local:** `apks/aerial-views-1.8.5.apk`
   - **Servicio activado:** `com.neilturner.aerialviews/.ui.screensaver.DreamActivity`
3. **Aurora Store v4.8.4** (`com.aurora.store`) — *Cliente alternativo de Google Play Store*
   - **Fuente oficial:** `https://f-droid.org/repo/com.aurora.store_76.apk` (`AuroraOSS/AuroraStore`)
   - **Copia local:** `apks/AuroraStore-4.8.4.apk`
   - **Permisos concedidos:** `REQUEST_INSTALL_PACKAGES allow`, `READ/WRITE_EXTERNAL_STORAGE`
4. **SmartTube Stable v32.80 (`armeabi-v7a`)** (`org.smarttube.stable`) — *YouTube para TV sin anuncios y con SponsorBlock*
   - **Fuente oficial:** `https://github.com/yuliskov/SmartTube/releases/tag/32.80s`
   - **Copia local:** `apks/SmartTube_stable_32.80_armeabi-v7a.apk`
   - **Permisos concedidos:** `REQUEST_INSTALL_PACKAGES allow`

---

## 4. Resumen de Comandos Utilizados

```bash
# Conexión
adb connect 192.168.1.142:5555

# Categoría 1 (A2) – Fluidez visual (0.25x)
adb -s 192.168.1.142:5555 shell settings put global window_animation_scale 0.25
adb -s 192.168.1.142:5555 shell settings put global transition_animation_scale 0.25
adb -s 192.168.1.142:5555 shell settings put global animator_duration_scale 0.25

# Categoría 2 (B2) – Densidad y fuente (280 dpi / 0.95)
adb -s 192.168.1.142:5555 shell wm density 280
adb -s 192.168.1.142:5555 shell settings put system font_scale 0.95

# Categoría 3 (D1) – Deshabilitar publicidad y telemetría
adb -s 192.168.1.142:5555 shell pm disable-user --user 0 com.amazon.kso.blackbird
adb -s 192.168.1.142:5555 shell pm disable-user --user 0 com.amazon.tv.acr
adb -s 192.168.1.142:5555 shell pm disable-user --user 0 com.amazon.hedwig
adb -s 192.168.1.142:5555 shell pm disable-user --user 0 com.amazon.tv.releasenotes

# Categoría 4 (C1/F1) – Projectivy Launcher + Accesibilidad
adb -s 192.168.1.142:5555 install -r apks/ProjectivyLauncher-4.73.apk
adb -s 192.168.1.142:5555 shell settings put secure enabled_accessibility_services com.spocky.projengmenu/com.spocky.projengmenu.services.ProjectivyAccessibilityService
adb -s 192.168.1.142:5555 shell settings put secure accessibility_enabled 1

# Categoría 5 (E2) – Aerial Views Screensaver
adb -s 192.168.1.142:5555 install -r apks/aerial-views-1.8.5.apk
adb -s 192.168.1.142:5555 shell settings put secure screensaver_components com.neilturner.aerialviews/.ui.screensaver.DreamActivity
```

---

## 5. Guía Rápida: Qué Hacer si Algo Sale Mal

### A) Revertir todos los cambios desde tu PC (1 clic)
Ejecuta el script de restauración:
- **En Windows:** Haz doble clic en `scripts\rollback.bat`
- **En Terminal:** Ejecuta `./scripts/rollback.sh`
Esto devuelve inmediatamente la densidad a `320` dpi, fuente a `1.0`, animaciones a `1.0x`, el salvapantallas original de Amazon y vuelve a habilitar los 4 paquetes deshabilitados.

### B) Reaplicar tus ajustes tras una actualización de Fire OS
Si una actualización OTA de Amazon restaura algún parámetro o desactiva el servicio de accesibilidad:
- **En Windows:** Haz doble clic en `scripts\reaplicar.bat`
- **En Terminal:** Ejecuta `./scripts/reaplicar.sh`

### C) Si el Fire TV se congela o no responde al mando (Reinicio sin perder datos)
1. **Reinicio suave por control remoto:** Mantén pulsados simultáneamente el botón **Seleccionar (botón central redondo)** y el botón **Play/Pausa** durante **5 a 7 segundos** hasta que el Fire TV se reinicie.
2. **Reinicio eléctrico:** Desconecta el cable de alimentación USB del Fire TV Stick durante 10 segundos y vuelve a conectarlo.

### D) Modo Seguro / Recuperación sin perder datos
Si alguna aplicación instalada por usuario impidiera usar la pantalla:
1. Conecta por ADB desde tu PC (`adb connect 192.168.1.142:5555`) — el demonio ADB se inicia antes que el launcher de usuario — y ejecuta `scripts\rollback.bat`.
2. Si necesitas entrar en **Modo Seguro de Fire OS** (que carga solo las apps de fábrica de Amazon desactivando temporalmente apps de terceros sin borrar tus datos):
   - Desconecta la corriente del Fire TV y vuelve a conectarla.
   - Mientras aparece el logo de **Fire TV** durante el arranque, mantén presionado el botón **Bajar Volumen (-)** (o **Menú + Izquierda** en mandos sin control de volumen) hasta que cargue la pantalla de inicio con la marca "Modo Seguro" en la esquina inferior. Desde ahí puedes ir a *Ajustes → Aplicaciones* y desinstalar cualquier app conflictiva.
