const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

const target1 = 'const submitArrival = async (isSkip = false) => {';
let rep1 = `const submitArrival = async () => {
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
      }`;
code = code.replace(target1, rep1);
code = code.replace(`if (typeof isSkip !== 'boolean') isSkip = false;`, '');
code = code.replace(`setProcessingId('general-arrival');`, ''); // removes the old one

code = code.replace(`mileage: isSkip ? '' : (arrivalMileage || ''),`, `mileage: arrivalMileage || '',`);
code = code.replace(`keyLocation: isSkip ? '' : (arrivalKeyLocation || ''),`, `keyLocation: arrivalKeyLocation || '',`);
code = code.replace(`keyHandedTo: isSkip ? '' : ((arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : ''))`, `keyHandedTo: arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : ''`);

code = code.replace(`if (!isSkip && arrivalPhoto) {`, `if (arrivalPhoto) {`);

let originalPhotos = `updatedDraft.photos = { ...currentPhotos, odometer: arrivalPhoto };`;
let newPhotos = `updatedDraft.photos = { ...currentPhotos, odometer: arrivalPhoto };
      }
      updatedDraft.photos = updatedDraft.photos || {};
      updatedDraft.photos.fuelGauge = arrivalFuelPhoto;
      if (false) {`; // dummy to close the original block properly
code = code.replace(originalPhotos, newPhotos);

let modalProps = `arrivalPhoto={arrivalPhoto}\r
        setArrivalPhoto={setArrivalPhoto}\r
        arrivalKeyLocation={arrivalKeyLocation}`;
let newModalProps = `arrivalPhoto={arrivalPhoto}\r
        setArrivalPhoto={setArrivalPhoto}\r
        arrivalFuelPhoto={arrivalFuelPhoto}\r
        setArrivalFuelPhoto={setArrivalFuelPhoto}\r
        arrivalKeyLocation={arrivalKeyLocation}`;
if (code.includes(modalProps)) {
    code = code.replace(modalProps, newModalProps);
} else {
    modalProps = `arrivalPhoto={arrivalPhoto}\n        setArrivalPhoto={setArrivalPhoto}\n        arrivalKeyLocation={arrivalKeyLocation}`;
    newModalProps = `arrivalPhoto={arrivalPhoto}\n        setArrivalPhoto={setArrivalPhoto}\n        arrivalFuelPhoto={arrivalFuelPhoto}\n        setArrivalFuelPhoto={setArrivalFuelPhoto}\n        arrivalKeyLocation={arrivalKeyLocation}`;
    code = code.replace(modalProps, newModalProps);
}

let captureBlock = `} catch (e) { showAlert("Error procesando foto."); }\r
          }\r
        }}`;
let newCaptureBlock = `} catch (e) { showAlert("Error procesando foto."); }\r
          } else if (cameraConfig.target === 'arrivalFuelPhoto') {\r
            try {\r
              const compressed = await resizeImage(file, 1200, 0.6);\r
              setArrivalFuelPhoto(compressed);\r
            } catch (e) { showAlert("Error procesando foto."); }\r
          }\r
        }}`;
if (code.includes(captureBlock)) {
    code = code.replace(captureBlock, newCaptureBlock);
} else {
    captureBlock = `} catch (e) { showAlert("Error procesando foto."); }\n          }\n        }}`;
    newCaptureBlock = `} catch (e) { showAlert("Error procesando foto."); }\n          } else if (cameraConfig.target === 'arrivalFuelPhoto') {\n            try {\n              const compressed = await resizeImage(file, 1200, 0.6);\n              setArrivalFuelPhoto(compressed);\n            } catch (e) { showAlert("Error procesando foto."); }\n          }\n        }}`;
    code = code.replace(captureBlock, newCaptureBlock);
}

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log('Done replacement');
