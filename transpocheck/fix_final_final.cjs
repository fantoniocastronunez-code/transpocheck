const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

let lines = code.split('\\n');
// Wait, the file is separated by \r\n or \n. Let's just read it line by line.
lines = code.replace(/\\r\\n/g, '\\n').split('\\n');

let newLines = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].includes('// FIX iOS Clipboard: Replace ')) {
        // Wait, the string was split across MULTIPLE LINES because the literal had actual newlines!
        // That means lines[i] is literally "// FIX iOS Clipboard: Replace "
        // lines[i+1] is " with \\r"
        // lines[i+2] is " globally before copying"
        if (lines[i+1] && lines[i+1].includes(' with \\r')) {
            newLines.push('    // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying');
            // Skip the next two broken lines
            i += 2;
            if (lines[i].includes('globally before copying to clipboard')) {
                newLines[newLines.length - 1] = '      // FIX iOS Clipboard: Replace \\n with \\r\\n globally before copying to clipboard';
            }
        } else {
            newLines.push(lines[i]);
        }
    } else if (lines[i].includes('.replace(/') && lines[i+1] && lines[i+1] === "/g, '\\r") {
        let prefix = lines[i].split('.replace(/')[0];
        newLines.push(prefix + ".replace(/\\n/g, '\\r\\n');");
        i += 2;
    } else {
        newLines.push(lines[i]);
    }
    i++;
}

fs.writeFileSync('src/components/views/JobsList.jsx', newLines.join('\\n'), 'utf8');
console.log("Fixed lines manually!");
