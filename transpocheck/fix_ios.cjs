const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

const targetStr = `    // FIX iOS Clipboard: Replace 
 with \\r
 globally before copying
    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/
/g, '\\r
');`;

const replaceStr = `    // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying
    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Fixed iOS regex");
