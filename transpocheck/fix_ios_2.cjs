const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

code = code.replace(
    /\/\/ FIX iOS Clipboard: Replace[\s\S]*?globally before copying[\s\S]*?const text = generateWhatsAppText.*?\.replace\([\s\S]*?'\);/,
    "// FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying\n    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');"
);

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Fixed iOS regex with regex replace");
