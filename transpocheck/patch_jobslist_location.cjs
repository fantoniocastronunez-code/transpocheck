const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

// 1. Add state
code = code.replace(
    "const [arrivalFuelPhoto, setArrivalFuelPhoto] = useState(null);",
    "const [arrivalFuelPhoto, setArrivalFuelPhoto] = useState(null);\\n  const [arrivalFuelPhotoLocation, setArrivalFuelPhotoLocation] = useState(null);"
);

// 2. Capture logic
code = code.replace(
    "const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);\\n              setArrivalFuelPhoto(compressed);",
    "const result = await resizeAndWatermarkImage(file, 1200, 0.6);\\n              setArrivalFuelPhoto(result.base64);\\n              if (result.lat && result.lng) setArrivalFuelPhotoLocation({ lat: result.lat, lng: result.lng });"
);

// 3. Submit logic (saving to DB)
code = code.replace(
    "updatedDraft.photos.fuelGauge = arrivalFuelPhoto;",
    "updatedDraft.photos.fuelGauge = arrivalFuelPhoto;\\n      if (arrivalFuelPhotoLocation) updatedDraft.photos.fuelGaugeLocation = arrivalFuelPhotoLocation;"
);

// 4. Reset state
code = code.replace(
    "setArrivalFuelPhoto(null);",
    "setArrivalFuelPhoto(null);\\n      setArrivalFuelPhotoLocation(null);"
);

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Updated JobsList.jsx");
