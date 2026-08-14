const fs = require('fs');
const dir = 'src/components/views/ChecklistForm/';
const files = fs.readdirSync(dir);

const allLucideIcons = [
  'FileText', 'MapPin', 'CheckCircle', 'CloudOff', 'AlertCircle', 'Eye',
  'Trash2', 'Camera', 'Search', 'X', 'Fuel', 'Clock', 'Wallet', 'Receipt',
  'Share2', 'QrCode', 'Save', 'Zap', 'Upload', 'XCircle', 'PenTool', 'MoreVertical',
  'Check', 'ChevronRight', 'ChevronLeft', 'CameraOff'
];

files.forEach(file => {
  if (file.endsWith('.jsx') && file !== 'DejaVuModal.jsx') {
    let content = fs.readFileSync(dir + file, 'utf8');
    
    // Check which icons are used in JSX
    const usedIcons = allLucideIcons.filter(icon => {
      return content.includes('<' + icon) || content.includes(icon + ' ');
    });
    
    // Replace the existing lucide-react import
    content = content.replace(/import \{[^}]+\} from 'lucide-react';/, "import { " + usedIcons.join(', ') + " } from 'lucide-react';");
    
    fs.writeFileSync(dir + file, content);
  }
});
console.log('Fixed Lucide imports');
