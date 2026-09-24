const fs = require('fs');
let code = fs.readFileSync('src/utils/helpers.js', 'utf8');

code = code.replace(
    "resolve(canvas.toDataURL('image/jpeg', quality));",
    "resolve({ base64: canvas.toDataURL('image/jpeg', quality), lat, lng });"
);

fs.writeFileSync('src/utils/helpers.js', code, 'utf8');
console.log("Updated helpers.js");
