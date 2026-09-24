const fs = require('fs');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace the literal two-character string '\n' with an actual newline
    // But be careful not to replace '\n' inside string literals that actually want it!
    // However, none of my replacements intended for literal '\n' except where they were replacing actual newlines.
    // Wait, in helpers.js, I also had '\`Lat: \${lat.toFixed(5)}, Lng: \${lng.toFixed(5)}\`' where '\$' is used. But those didn't end up as literal strings.
    // Actually, I can just do content = content.split('\\\\n').join('\\n');
    content = content.split('\\n').join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Fixed", filePath);
}

fixFile('src/utils/helpers.js');
fixFile('src/components/views/JobsList.jsx');
