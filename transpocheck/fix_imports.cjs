const fs = require('fs');
const dir = 'src/components/views/ChecklistForm/';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.jsx')) {
    let content = fs.readFileSync(dir + file, 'utf8');
    // Fix InAppCamera import
    content = content.replace(/import InAppCamera from '\.\/InAppCamera';/g, "import InAppCamera from '../../ui/InAppCamera';");
    content = content.replace(/import InAppCamera from "\.\/InAppCamera";/g, "import InAppCamera from '../../ui/InAppCamera';");
    
    // Fix SignaturePad import inside Step6Signature.jsx
    content = content.replace(/import SignaturePad from '\.\.\/\.\.\/SignaturePad';/g, "import SignaturePad from '../../ui/SignaturePad';");

    fs.writeFileSync(dir + file, content);
  }
});
console.log('Fixed imports');
