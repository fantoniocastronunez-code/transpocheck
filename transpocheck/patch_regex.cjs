const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

const regex = /else if \(cameraConfig\.target === 'arrivalFuelPhoto'\) \{\s*try \{\s*const compressed = await resizeImage\(file, 1200, 0\.6\);/g;
code = code.replace(regex, "else if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);");

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Regex patched!");
