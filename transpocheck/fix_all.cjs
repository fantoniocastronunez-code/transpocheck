const fs = require('fs');

let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

// The regex will match any whitespace/newlines around the broken text, to be very forgiving.
const regex1 = /\/\/ FIX iOS Clipboard: Replace \r?\n with \\r\r?\n globally before copying\r?\n\s*const text = generateWhatsAppText\(job, dateShort, jobPlate\)\.replace\(\/\r?\n\/g, '\\r\r?\n'\);/g;

content = content.replace(regex1, `// FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying\n    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');`);

const regex2 = /\/\/ FIX iOS Clipboard: Replace \r?\n with \\r\r?\n globally before copying to clipboard\r?\n\s*\/\/ Esto previene que iPhone\/iOS quite los saltos de línea al pegar en WhatsApp\.\r?\n\s*textToShare = textToShare\.replace\(\/\r?\n\/g, '\\r\r?\n'\);/g;

content = content.replace(regex2, `// FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard\n      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp.\n      textToShare = textToShare.replace(/\\n/g, '\\r\\n');`);

fs.writeFileSync('src/components/views/JobsList.jsx', content, 'utf8');
console.log("Fix all applied!");
