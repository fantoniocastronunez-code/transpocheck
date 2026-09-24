const fs = require('fs');

let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

// There are multiple instances of the broken iOS fix string.
// Let's replace any instance that looks like the broken one.

// Instance 1: line 965
const broken1 = `    // FIX iOS Clipboard: Replace \n with \\r\n globally before copying\n    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\n/g, '\\r\n');`;

code = code.split(broken1).join(`    // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying\n    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');`);

// Instance 2: line 1030
const broken2 = `      // FIX iOS Clipboard: Replace \n with \\r\n globally before copying to clipboard\n      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp.\n      textToShare = textToShare.replace(/\n/g, '\\r\n');`;

code = code.split(broken2).join(`      // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard\n      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp.\n      textToShare = textToShare.replace(/\\n/g, '\\r\\n');`);


// Let's see if there are any other `\n` that I broke.
// What about `replace(/\\n/g, '<br/>')` ? If I broke that, it would be `replace(/\n/g, '<br/>')`.
code = code.split(`replace(/\n/g, '<br/>')`).join(`replace(/\\n/g, '<br/>')`);

// Write the file back
fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Super fixed JobsList");
