#!/usr/bin/env bash
# ============================================================================
# Script de Reaplicacion - Fire TV Stick 3ra Gen (AFTSSS / sheldonp)
# Reaplica la personalizacion estetica tras una actualizacion de Fire OS
# ============================================================================

ADB="${ADB:-adb}"
DEVICE="192.168.1.142:5555"

echo "[1/6] Conectando a Fire TV ($DEVICE)..."
"$ADB" connect "$DEVICE"

echo "[2/6] Aplicando fluidez visual A2 (animaciones a 0.25x)..."
"$ADB" -s "$DEVICE" shell settings put global window_animation_scale 0.25
"$ADB" -s "$DEVICE" shell settings put global transition_animation_scale 0.25
"$ADB" -s "$DEVICE" shell settings put global animator_duration_scale 0.25

echo "[3/6] Aplicando densidad B2 (280 dpi) y escala de fuente (0.95)..."
"$ADB" -s "$DEVICE" shell wm density 280
"$ADB" -s "$DEVICE" shell settings put system font_scale 0.95

echo "[4/6] Deshabilitando paquetes de publicidad y telemetria (D1)..."
"$ADB" -s "$DEVICE" shell pm disable-user --user 0 com.amazon.kso.blackbird
"$ADB" -s "$DEVICE" shell pm disable-user --user 0 com.amazon.tv.acr
"$ADB" -s "$DEVICE" shell pm disable-user --user 0 com.amazon.hedwig
"$ADB" -s "$DEVICE" shell pm disable-user --user 0 com.amazon.tv.releasenotes

echo "[5/6] Activando servicio de accesibilidad de Projectivy Launcher (C1)..."
"$ADB" -s "$DEVICE" shell settings put secure enabled_accessibility_services com.spocky.projengmenu/com.spocky.projengmenu.services.ProjectivyAccessibilityService
"$ADB" -s "$DEVICE" shell settings put secure accessibility_enabled 1

echo "[6/6] Configurando Aerial Views como protector de pantalla por defecto (E2)..."
"$ADB" -s "$DEVICE" shell settings put secure screensaver_enabled 1
"$ADB" -s "$DEVICE" shell settings put secure screensaver_components com.neilturner.aerialviews/.ui.screensaver.DreamActivity

echo "Verificando respuesta del dispositivo..."
"$ADB" -s "$DEVICE" shell echo ok
echo "Personalizacion reaplicada con exito."
