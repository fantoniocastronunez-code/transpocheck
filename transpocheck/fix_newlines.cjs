const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

code = code.replace(
    "} else if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);",
    "} else if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);"
);

// Actually, I wrote `\\n` in the script. I'll just use string literal:
code = code.replace(
    "} else if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);",
    "} else if (cameraConfig.target === 'arrivalFuelPhoto') {\\n            try {\\n              const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);"
);

// Wait, the literal `\n` in the file is probably `\\n` when read.
code = code.split("\\n            try {\\n").join("\\n            try {\\n"); // No, wait, string splitting.

fs.writeFileSync('src/components/views/JobsList.jsx', code.replace(/\\n/g, '\n'), 'utf8');
console.log("Fixed newlines");
