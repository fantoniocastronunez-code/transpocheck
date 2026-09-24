const fs = require('fs');
let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

content = content.replace(
  '  const submitArrival = async (isSkip = false) => {\\r\\n    if (typeof isSkip !== \\'boolean\\') isSkip = false;\\r\\n    setProcessingId(\\'general-arrival\\');',
  \`  const submitArrival = async (isSkip = false) => {
    setProcessingId('general-arrival');
    try {
      if (!arrivalFuelPhoto) {
        showAlert("Debe adjuntar la foto del medidor de combustible de forma obligatoria.");
        setProcessingId(null);
        return;
      }

      const clientName = arrivalPromptJob?.clientName?.toUpperCase() || '';
      const isGrandleasingMileageRequired = clientName === 'GRANDLEASING LAS TORRES' || clientName === 'GRANDLEASING UMAÑA' || clientName === 'GRANDLEASING USADOS';

      if (isGrandleasingMileageRequired && (!arrivalMileage || arrivalMileage.trim() === '')) {
        showAlert("Debe ingresar el kilometraje de forma obligatoria para este cliente.");
        setProcessingId(null);
        return;
      }\`
);

content = content.replace(
  '        mileage: isSkip ? \\'\\' : (arrivalMileage || \\'\\'),\\r\\n        keyLocation: isSkip ? \\'\\' : (arrivalKeyLocation || \\'\\'),\\r\\n        keyHandedTo: isSkip ? \\'\\' : ((arrivalKeyLocation === \\'mano\\' ? arrivalKeyHandedTo : \\'\\'))',
  \`        mileage: arrivalMileage || '',
        keyLocation: arrivalKeyLocation || '',
        keyHandedTo: (arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : '')\`
);

content = content.replace(
  '      if (!isSkip && arrivalPhoto) {\\r\\n        updatedDraft.photos = { ...currentPhotos, odometer: arrivalPhoto };\\r\\n      }',
  \`      if (arrivalPhoto) {
        updatedDraft.photos = { ...currentPhotos, odometer: arrivalPhoto };
      }
      updatedDraft.photos = updatedDraft.photos || {};
      updatedDraft.photos.fuelGauge = arrivalFuelPhoto;\`
);

content = content.replace(
  '        arrivalPhoto={arrivalPhoto}\\r\\n        setArrivalPhoto={setArrivalPhoto}\\r\\n        arrivalKeyLocation={arrivalKeyLocation}',
  \`        arrivalPhoto={arrivalPhoto}
        setArrivalPhoto={setArrivalPhoto}
        arrivalFuelPhoto={arrivalFuelPhoto}
        setArrivalFuelPhoto={setArrivalFuelPhoto}
        arrivalKeyLocation={arrivalKeyLocation}\`
);

content = content.replace(
  '        onCapture={async (file) => {\\r\\n          if (cameraConfig.target === \\'arrivalPhoto\\') {\\r\\n            try {\\r\\n              const compressed = await resizeImage(file, 1200, 0.6);\\r\\n              setArrivalPhoto(compressed);\\r\\n            } catch (e) { showAlert("Error procesando foto."); }\\r\\n          }\\r\\n        }}',
  \`        onCapture={async (file) => {
          if (cameraConfig.target === 'arrivalPhoto') {
            try {
              const compressed = await resizeImage(file, 1200, 0.6);
              setArrivalPhoto(compressed);
            } catch (e) { showAlert("Error procesando foto."); }
          } else if (cameraConfig.target === 'arrivalFuelPhoto') {
            try {
              const compressed = await resizeImage(file, 1200, 0.6);
              setArrivalFuelPhoto(compressed);
            } catch (e) { showAlert("Error procesando foto."); }
          }
        }}\`
);

fs.writeFileSync('src/components/views/JobsList.jsx', content, 'utf8');
console.log('Done replacement');
