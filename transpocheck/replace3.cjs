const fs = require('fs');
let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

// 1. Replace submitArrival signature and add validation
content = content.replace(
  /const submitArrival = async \(isSkip = false\) => \{\s*if \(typeof isSkip !== 'boolean'\) isSkip = false;\s*setProcessingId\('general-arrival'\);\s*try \{\s*const currentDraft = arrivalPromptJob\.draft\?\.formData \|\| \{\};\s*const currentPhotos = currentDraft\.photos \|\| \{\};/,
  \`const submitArrival = async () => {
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
      }

      const currentDraft = arrivalPromptJob.draft?.formData || {};
      const currentPhotos = currentDraft.photos || {};\`
);

// 2. Replace updatedDraft
content = content.replace(
  /const updatedDraft = \{\s*\.\.\.currentDraft,\s*mileage: isSkip \? '' : \(arrivalMileage \|\| ''\),\s*keyLocation: isSkip \? '' : \(arrivalKeyLocation \|\| ''\),\s*keyHandedTo: isSkip \? '' : \(\(arrivalKeyLocation === 'mano' \? arrivalKeyHandedTo : ''\)\)\s*\};/,
  \`const updatedDraft = {
        ...currentDraft,
        mileage: arrivalMileage || '',
        keyLocation: arrivalKeyLocation || '',
        keyHandedTo: arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : ''
      };\`
);

// 3. Replace updatedDraft.photos
content = content.replace(
  /if \(!isSkip && arrivalPhoto\) \{\s*updatedDraft\.photos = \{ \.\.\.currentPhotos, odometer: arrivalPhoto \};\s*\}/,
  \`if (arrivalPhoto) {
        updatedDraft.photos = { ...currentPhotos, odometer: arrivalPhoto };
      }
      updatedDraft.photos = updatedDraft.photos || {};
      updatedDraft.photos.fuelGauge = arrivalFuelPhoto;\`
);

// 4. Update ArrivalModal props (if not already done)
if (!content.includes('arrivalFuelPhoto={arrivalFuelPhoto}')) {
  content = content.replace(
    /arrivalPhoto=\{arrivalPhoto\}\s*setArrivalPhoto=\{setArrivalPhoto\}\s*arrivalKeyLocation=\{arrivalKeyLocation\}/,
    \`arrivalPhoto={arrivalPhoto}
        setArrivalPhoto={setArrivalPhoto}
        arrivalFuelPhoto={arrivalFuelPhoto}
        setArrivalFuelPhoto={setArrivalFuelPhoto}
        arrivalKeyLocation={arrivalKeyLocation}\`
  );
}

// 5. Update InAppCamera onCapture
content = content.replace(
  /onCapture=\{async \(file\) => \{\s*if \(cameraConfig\.target === 'arrivalPhoto'\) \{\s*try \{\s*const compressed = await resizeImage\(file, 1200, 0\.6\);\s*setArrivalPhoto\(compressed\);\s*\} catch \(e\) \{ showAlert\("Error procesando foto\."\); \}\s*\}\s*\}\}/,
  \`onCapture={async (file) => {
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
console.log("Replacements complete with regex");
