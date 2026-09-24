const fs = require('fs');

let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');
let lines = content.replace(/\\r\\n/g, '\\n').split('\\n');

let newLines = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].includes('// FIX iOS Clipboard: Replace ')) {
        // Line i is: "    // FIX iOS Clipboard: Replace "
        // Line i+1 is: " with \\r"
        // Line i+2 is: " globally before copying"
        // Line i+3 is: "    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/"
        // Line i+4 is: "/g, '\\r"
        // Line i+5 is: "');"
        
        let isFirstBlock = lines[i+2] && lines[i+2].includes('globally before copying');
        let isSecondBlock = lines[i+2] && lines[i+2].includes('globally before copying to clipboard');
        
        if (isFirstBlock && !isSecondBlock) {
            newLines.push("    // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying");
            newLines.push("    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');");
            i += 5; // skip i+1 through i+5
        } else if (isSecondBlock) {
            newLines.push("      // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard");
            newLines.push("      // Esto previene que iPhone/iOS quite los saltos de línea al pegar en WhatsApp.");
            newLines.push("      textToShare = textToShare.replace(/\\n/g, '\\r\\n');");
            i += 6; // skip i+1 through i+6 (line i+3 is the comment)
        } else {
            newLines.push(lines[i]);
        }
    } else {
        newLines.push(lines[i]);
    }
    i++;
}

fs.writeFileSync('src/components/views/JobsList.jsx', newLines.join('\\n'), 'utf8');
console.log("Ultimate fix 2 applied!");
