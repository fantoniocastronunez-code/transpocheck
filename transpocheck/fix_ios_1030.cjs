const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

const brokenStr = "      // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard\\n      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp.\\n      textToShare = textToShare.replace(/\\n/g, '\\r\\n');".replace(/\\n/g, '\n').replace(/\\r/g, '\r');

// Since the file literally contains actual newlines inside the regex because of fix_literals.cjs
code = code.replace(
    /(\/\/ FIX iOS Clipboard: Replace)[\s\S]*?(with \\r)[\s\S]*?(globally before copying to clipboard)[\s\S]*?(\/\/ Esto previene que iPhone\/iOS quite los saltos de línea al pegar en WhatsApp.)[\s\S]*?(textToShare = textToShare\.replace\()[\s\S]*?(\/g, '\\r)[\s\S]*?('\);)/g,
    "      // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard\n      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp.\n      textToShare = textToShare.replace(/\\n/g, '\\r\\n');"
);

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Fixed iOS regex 1030");
