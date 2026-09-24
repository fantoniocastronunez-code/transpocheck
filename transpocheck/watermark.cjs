const fs = require('fs');

// 1. Add resizeAndWatermarkImage to helpers.js
let helpersContent = fs.readFileSync('src/utils/helpers.js', 'utf8');

const watermarkFunc = `
export const resizeAndWatermarkImage = (file, maxWidth = 1920, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const applyWatermark = (lat, lng) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const dateStr = new Date().toLocaleString('es-CL');
          const locStr = lat ? \`Lat: \${lat.toFixed(5)}, Lng: \${lng.toFixed(5)}\` : 'Ubicación no disponible';
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          const padding = 20;
          const fontSize = Math.max(16, Math.floor(width / 35));
          ctx.fillRect(0, height - (fontSize * 3 + padding), width, fontSize * 3 + padding);

          ctx.fillStyle = '#FFD700';
          ctx.font = \`bold \${fontSize}px sans-serif\`;
          ctx.textAlign = 'left';
          ctx.fillText(\`FECHA: \${dateStr}\`, padding, height - padding - fontSize * 1.5);
          ctx.fillText(\`GPS: \${locStr}\`, padding, height - padding);

          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          applyWatermark(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          applyWatermark(null, null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      applyWatermark(null, null);
    }
  });
};
`;

if (!helpersContent.includes('resizeAndWatermarkImage')) {
    helpersContent = helpersContent.replace('export const resizeImage = ', watermarkFunc + '\\nexport const resizeImage = ');
    fs.writeFileSync('src/utils/helpers.js', helpersContent, 'utf8');
    console.log("Updated helpers.js");
}

// 2. Update JobsList.jsx to use resizeAndWatermarkImage
let jobsListContent = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

if (!jobsListContent.includes('resizeAndWatermarkImage')) {
    // Import
    jobsListContent = jobsListContent.replace("resizeImage } from '../../utils/helpers';", "resizeImage, resizeAndWatermarkImage } from '../../utils/helpers';");
    
    // Usage (UNIX)
    jobsListContent = jobsListContent.replace(
        "const compressed = await resizeImage(file, 1200, 0.6);\\n              setArrivalFuelPhoto(compressed);",
        "const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);\\n              setArrivalFuelPhoto(compressed);"
    );
    // Usage (Windows)
    jobsListContent = jobsListContent.replace(
        "const compressed = await resizeImage(file, 1200, 0.6);\\r\\n              setArrivalFuelPhoto(compressed);",
        "const compressed = await resizeAndWatermarkImage(file, 1200, 0.6);\\r\\n              setArrivalFuelPhoto(compressed);"
    );
    fs.writeFileSync('src/components/views/JobsList.jsx', jobsListContent, 'utf8');
    console.log("Updated JobsList.jsx");
}
