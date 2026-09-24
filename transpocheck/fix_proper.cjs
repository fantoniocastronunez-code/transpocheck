const fs = require('fs');

// helpers.js
let helpers = fs.readFileSync('src/utils/helpers.js', 'utf8');
helpers = helpers.replace(
    "\\nexport const resizeImage = (file, maxWidth = 1920, quality = 0.85) => {",
    "\\nexport const resizeImage = (file, maxWidth = 1920, quality = 0.85) => {" // Wait, the file actually contains the characters "\" and "n" literally.
);
// I need to replace the literal string "\n" with an actual newline "\n" ONLY for that specific one.
helpers = helpers.replace(
    "\\nexport const resizeImage",
    "\nexport const resizeImage"
);
fs.writeFileSync('src/utils/helpers.js', helpers, 'utf8');


// JobsList.jsx
let jobs = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

jobs = jobs.replace(
    "const [arrivalFuelPhoto, setArrivalFuelPhoto] = useState(null);\\n  const [arrivalFuelPhotoLocation, setArrivalFuelPhotoLocation] = useState(null);",
    "const [arrivalFuelPhoto, setArrivalFuelPhoto] = useState(null);\n  const [arrivalFuelPhotoLocation, setArrivalFuelPhotoLocation] = useState(null);"
);

jobs = jobs.replace(
    "updatedDraft.photos.fuelGauge = arrivalFuelPhoto;\\n      if (arrivalFuelPhotoLocation) updatedDraft.photos.fuelGaugeLocation = arrivalFuelPhotoLocation;",
    "updatedDraft.photos.fuelGauge = arrivalFuelPhoto;\n      if (arrivalFuelPhotoLocation) updatedDraft.photos.fuelGaugeLocation = arrivalFuelPhotoLocation;"
);

jobs = jobs.replace(
    "setArrivalFuelPhoto(null);\\n      setArrivalFuelPhotoLocation(null);",
    "setArrivalFuelPhoto(null);\n      setArrivalFuelPhotoLocation(null);"
);

jobs = jobs.replace(
    "} else if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const result = await resizeAndWatermarkImage(file, 1200, 0.6);\\n              setArrivalFuelPhoto(result.base64);\\n              if (result.lat && result.lng) setArrivalFuelPhotoLocation({ lat: result.lat, lng: result.lng });",
    "} else if (cameraConfig.target === 'arrivalFuelPhoto') {\n            try {\n              const result = await resizeAndWatermarkImage(file, 1200, 0.6);\n              setArrivalFuelPhoto(result.base64);\n              if (result.lat && result.lng) setArrivalFuelPhotoLocation({ lat: result.lat, lng: result.lng });"
);

fs.writeFileSync('src/components/views/JobsList.jsx', jobs, 'utf8');
console.log("Fixed files properly");
