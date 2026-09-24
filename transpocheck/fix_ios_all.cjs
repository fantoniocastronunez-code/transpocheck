const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

// There are multiple instances of the broken iOS fix string.
// Let's replace any instance that starts with "// FIX iOS Clipboard: Replace" followed by broken newlines.
code = code.replace(
    /\/\/ FIX iOS Clipboard: Replace[\s\S]*?globally before copying[\s\S]*?const text = generateWhatsAppText.*?\.replace\([\s\S]*?'\);/g,
    "// FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying\n    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');"
);

// Wait, the generateWhatsAppText might take different arguments in different places.
// Let's look closer. "const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');"
// What if it takes other variables? Let's use capture groups.
code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

code = code.replace(
    /\/\/ FIX iOS Clipboard: Replace[\s\S]*?globally before copying[\s\S]*?const text = (generateWhatsAppText.*?)\.replace\([\s\S]*?'\);/g,
    "// FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying\n    const text = $1.replace(/\\n/g, '\\r\\n');"
);

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Fixed iOS regex everywhere");
