const fs = require('fs');

// Read the file as an array of lines, handling \r\n or \n
let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');
let lines = content.replace(/\\r\\n/g, '\\n').split('\\n');
let newLines = [];

for (let i = 0; i < lines.length; i++) {
    // Check for the first block: "    // FIX iOS Clipboard: Replace "
    if (lines[i] === '    // FIX iOS Clipboard: Replace ' && lines[i+1] === ' with \\r' && lines[i+2] === ' globally before copying') {
        newLines.push('    // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying');
        newLines.push("    const text = generateWhatsAppText(job, dateShort, jobPlate).replace(/\\n/g, '\\r\\n');");
        // Skip the next 5 lines that correspond to this broken block
        i += 6; 
    } 
    // Check for the second block: "      // FIX iOS Clipboard: Replace "
    else if (lines[i] === '      // FIX iOS Clipboard: Replace ' && lines[i+1] === ' with \\r' && lines[i+2] === ' globally before copying to clipboard') {
        newLines.push('      // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard');
        newLines.push(lines[i+3]); // The "Esto previene..." comment
        newLines.push("      textToShare = textToShare.replace(/\\n/g, '\\r\\n');");
        // Skip the next 6 lines
        i += 7;
    } 
    else {
        newLines.push(lines[i]);
    }
}

fs.writeFileSync('src/components/views/JobsList.jsx', newLines.join('\\n'), 'utf8');
console.log("Ultimate fix applied!");
