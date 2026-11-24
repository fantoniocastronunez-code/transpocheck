@echo off
REM ============================================================================
REM Script de Rollback - Fire TV Stick 3ra Gen (AFTSSS / sheldonp)
REM Restaura valores visuales originales y re-habilita paquetes deshabilitados
REM ============================================================================

SET ADB="C:\Users\PC\AppData\Local\Android\Sdk\platform-tools\adb.exe"
SET DEVICE=192.168.1.142:5555

echo [1/6] Conectando a Fire TV (%DEVICE%)...
%ADB% connect %DEVICE%

echo [2/6] Restaurando resolucion y densidad originales (1920x1080 / 320 dpi)...
%ADB% -s %DEVICE% shell wm size reset
%ADB% -s %DEVICE% shell wm density reset

echo [3/6] Restaurando escalas de animacion originales (1.0x)...
%ADB% -s %DEVICE% shell settings put global window_animation_scale 1.0
%ADB% -s %DEVICE% shell settings put global transition_animation_scale 1.0
%ADB% -s %DEVICE% shell settings put global animator_duration_scale 1.0

echo [4/6] Restaurando escala de fuente original (1.0)...
%ADB% -s %DEVICE% shell settings put system font_scale 1.0

echo [5/6] Restaurando protector de pantalla y tiempos de espera originales...
%ADB% -s %DEVICE% shell settings put secure screensaver_enabled 1
%ADB% -s %DEVICE% shell settings put secure screensaver_components com.amazon.ftv.screensaver/.app.services.ScreensaverService
%ADB% -s %DEVICE% shell settings put system screen_off_timeout 300000
%ADB% -s %DEVICE% shell settings put secure sleep_timeout 1200000

echo [6/6] Re-habilitando paquetes deshabilitados durante la sesion...
REM --- PAQUETES DESHABILITADOS (se actualiza automaticamente) ---
%ADB% -s %DEVICE% shell pm enable com.amazon.kso.blackbird
%ADB% -s %DEVICE% shell pm enable com.amazon.tv.acr
%ADB% -s %DEVICE% shell pm enable com.amazon.hedwig
%ADB% -s %DEVICE% shell pm enable com.amazon.tv.releasenotes

echo [7/7] Restaurando servicios de accesibilidad...
%ADB% -s %DEVICE% shell settings delete secure enabled_accessibility_services
REM Para desinstalar Projectivy Launcher si lo deseas, descomenta la siguiente linea:
REM %ADB% -s %DEVICE% uninstall com.spocky.projengmenu

echo Verificando respuesta del dispositivo...
%ADB% -s %DEVICE% shell echo ok
echo Rollback completado con exito.
