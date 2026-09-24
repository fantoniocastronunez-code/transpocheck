const fs = require('fs');
let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

const target1 = `  const submitArrival = async (isSkip = false) => {\\r\\n    if (typeof isSkip !== 'boolean') isSkip = false;\\r\\n    setProcessingId('general-arrival');\\r\\n    try {\\r\\n      const currentDraft = arrivalPromptJob.draft?.formData || {};\\r\\n      const currentPhotos = currentDraft.photos || {};`;

const replacement1 = `  const submitArrival = async () => {
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
      const currentPhotos = currentDraft.photos || {};`;

const target2 = `      const updatedDraft = {\\r\\n        ...currentDraft,\\r\\n        mileage: isSkip ? '' : (arrivalMileage || ''),\\r\\n        keyLocation: isSkip ? '' : (arrivalKeyLocation || ''),\\r\\n        keyHandedTo: isSkip ? '' : ((arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : ''))\\r\\n      };\\r\\n\\r\\n      if (!isSkip && arrivalPhoto) {\\r\\n        updatedDraft.photos = { ...currentPhotos, odometer: arrivalPhoto };\\r\\n      }`;

const replacement2 = `      const updatedDraft = {
        ...currentDraft,
        mileage: arrivalMileage || '',
        keyLocation: arrivalKeyLocation || '',
        keyHandedTo: arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : ''
      };

      updatedDraft.photos = { ...currentPhotos };
      if (arrivalPhoto) {
        updatedDraft.photos.odometer = arrivalPhoto;
      }
      updatedDraft.photos.fuel = arrivalFuelPhoto;`;

const target3 = `        arrivalPhoto={arrivalPhoto}\\r\\n        setArrivalPhoto={setArrivalPhoto}\\r\\n        arrivalKeyLocation={arrivalKeyLocation}`;

const replacement3 = `        arrivalPhoto={arrivalPhoto}
        setArrivalPhoto={setArrivalPhoto}
        arrivalFuelPhoto={arrivalFuelPhoto}
        setArrivalFuelPhoto={setArrivalFuelPhoto}
        arrivalKeyLocation={arrivalKeyLocation}`;

const target4 = `        onCapture={async (file) => {\\r\\n          if (cameraConfig.target === 'arrivalPhoto') {\\r\\n            try {\\r\\n              const compressed = await resizeImage(file, 1200, 0.6);\\r\\n              setArrivalPhoto(compressed);\\r\\n            } catch (e) { showAlert("Error procesando foto."); }\\r\\n          }\\r\\n        }}`;

const replacement4 = `        onCapture={async (file) => {
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
        }}`;

content = content.replace(target1, replacement1.replace(/\\n/g, '\\r\\n'));
content = content.replace(target2, replacement2.replace(/\\n/g, '\\r\\n'));
content = content.replace(target3, replacement3.replace(/\\n/g, '\\r\\n'));
content = content.replace(target4, replacement4.replace(/\\n/g, '\\r\\n'));

fs.writeFileSync('src/components/views/JobsList.jsx', content, 'utf8');
console.log("Replacements complete");
