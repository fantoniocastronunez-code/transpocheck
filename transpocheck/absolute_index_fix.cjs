const fs = require('fs');

let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');
let lines = content.replace(/\\r\\n/g, '\\n').split('\\n');

// Block 1 (Indices 964 to 969)
// 964: "    // FIX iOS Clipboard: Replace "
// 965: " with \r"
// 966: " globally before copying"
// 967: "    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/"
// 968: "/g, '\r"
// 969: "');"

lines[964] = "    // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying";
lines[965] = "    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');";
lines[966] = ""; // We can leave them empty or splice them out. Let's splice them out.
lines.splice(966, 4); // Removes 966, 967, 968, 969

// Wait! Splicing changes the indices! 
// Let's do it from bottom to top so indices don't change.

// Block 2 (Indices 1032 to 1038)
// 1032: "      // FIX iOS Clipboard: Replace "
// 1033: " with \r"
// 1034: " globally before copying to clipboard"
// 1035: "      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp."
// 1036: "      textToShare = textToShare.replace(/"
// 1037: "/g, '\r"
// 1038: "');"

lines[1032] = "      // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard";
lines[1033] = "      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp.";
lines[1034] = "      textToShare = textToShare.replace(/\\n/g, '\\r\\n');";
lines.splice(1035, 4); // Removes 1035, 1036, 1037, 1038

fs.writeFileSync('src/components/views/JobsList.jsx', lines.join('\\n'), 'utf8');
console.log("Absolute index fix applied");
