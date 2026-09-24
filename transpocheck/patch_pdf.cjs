const fs = require('fs');
let code = fs.readFileSync('src/utils/pdfGenerator.js', 'utf8');

const targetPdf = "if (typeof photos[key] === 'string' && photos[key].startsWith('http')) { docPDF.link(finalX, photoY + 2, imgW, imgH, { url: photos[key] }); }";
const replacePdf = "if (key === 'fuelGauge' && photos.fuelGaugeLocation) { docPDF.setTextColor(0, 102, 204); docPDF.setFontSize(8); docPDF.text('Ver Mapa', finalX + (imgW/2), photoY + imgH + 5, { align: 'center' }); docPDF.link(finalX, photoY + 2, imgW, imgH + 5, { url: `https://maps.google.com/?q=\${photos.fuelGaugeLocation.lat},\${photos.fuelGaugeLocation.lng}` }); } else if (typeof photos[key] === 'string' && photos[key].startsWith('http')) { docPDF.link(finalX, photoY + 2, imgW, imgH, { url: photos[key] }); }";

code = code.replace(targetPdf, replacePdf);
fs.writeFileSync('src/utils/pdfGenerator.js', code, 'utf8');
console.log("Patched PDF generator");
