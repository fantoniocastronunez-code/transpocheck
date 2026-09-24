const fs = require('fs');

let helpers = fs.readFileSync('src/utils/helpers.js', 'utf8');
helpers = helpers.split("\\nexport const resizeImage").join("\nexport const resizeImage");
fs.writeFileSync('src/utils/helpers.js', helpers, 'utf8');

let jobs = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

jobs = jobs.split("const [arrivalFuelPhoto, setArrivalFuelPhoto] = useState(null);\\n  const [arrivalFuelPhotoLocation, setArrivalFuelPhotoLocation] = useState(null);").join("const [arrivalFuelPhoto, setArrivalFuelPhoto] = useState(null);\n  const [arrivalFuelPhotoLocation, setArrivalFuelPhotoLocation] = useState(null);");

jobs = jobs.split("updatedDraft.photos.fuelGauge = arrivalFuelPhoto;\\n      if (arrivalFuelPhotoLocation) updatedDraft.photos.fuelGaugeLocation = arrivalFuelPhotoLocation;").join("updatedDraft.photos.fuelGauge = arrivalFuelPhoto;\n      if (arrivalFuelPhotoLocation) updatedDraft.photos.fuelGaugeLocation = arrivalFuelPhotoLocation;");

jobs = jobs.split("setArrivalFuelPhoto(null);\\n      setArrivalFuelPhotoLocation(null);").join("setArrivalFuelPhoto(null);\n      setArrivalFuelPhotoLocation(null);");

jobs = jobs.split("} else if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const result = await resizeAndWatermarkImage(file, 1200, 0.6);\\n              setArrivalFuelPhoto(result.base64);\\n              if (result.lat && result.lng) setArrivalFuelPhotoLocation({ lat: result.lat, lng: result.lng });").join("} else if (cameraConfig.target === 'arrivalFuelPhoto') {\n            try {\n              const result = await resizeAndWatermarkImage(file, 1200, 0.6);\n              setArrivalFuelPhoto(result.base64);\n              if (result.lat && result.lng) setArrivalFuelPhotoLocation({ lat: result.lat, lng: result.lng });");

// For the iOS fix, the string actually contains real newlines inside it, but it was split.
// The literal in the file right now is exactly:
/*
    // FIX iOS Clipboard: Replace \n with \r\n globally before copying
    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\n/g, '\r\n');
*/
// Wait, NO! The literal in the file in the Vercel branch IS NOT the broken \r\n!
// Wait! Let me check `git show HEAD:src/components/views/JobsList.jsx` at line 966!
// Did the Vercel branch HAVE the broken iOS regex?
// Vercel only reported line 79 and 94 errors: "Invalid Unicode escape sequence".
// IT DID NOT REPORT A SYNTAX ERROR ON LINE 966!
// That means the broken iOS regex ONLY happened because `fix_literals.cjs` replaced `.replace(/\\n/g, '\\r\\n')` with `.replace(/\n/g, '\r\n')`!
// IT WAS NEVER BROKEN ON GITHUB! IT WAS ONLY BROKEN LOCALLY AFTER I RAN `fix_literals.cjs`!!!
// So by restoring from `git`, line 966 is ALREADY CORRECT!
// I ONLY need to fix the literal `\\n` that I added!

fs.writeFileSync('src/components/views/JobsList.jsx', jobs, 'utf8');
console.log("Fixed ONLY the literal \\n errors.");
