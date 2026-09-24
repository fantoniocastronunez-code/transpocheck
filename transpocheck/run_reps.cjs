const fs = require('fs');
const reps = JSON.parse(fs.readFileSync('reps.json', 'utf8'));
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

for (const rep of reps) {
    let target = rep.target.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n');
    let replacement = rep.replacement.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n');
    
    if (code.includes(target)) {
        code = code.replace(target, replacement);
        console.log("Replaced target");
    } else {
        console.log("Target not found");
    }
}

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log("Done");
