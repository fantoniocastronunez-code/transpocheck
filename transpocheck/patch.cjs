const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');
code = code.replace(
    "if (cameraConfig.target === 'arrivalFuelPhoto') {\\r\\n            try {\\r\\n              const compressed = await resizeImage(file, 1200, 0.6);",
    "if (cameraConfig.target === 'arrivalFuelPhoto') {\\r\\n            try {\\r\\n              const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);"
);
code = code.replace(
    "if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const compressed = await resizeImage(file, 1200, 0.6);",
    "if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);"
);
fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Patched");
