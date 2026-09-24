const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

const target = \`  const submitArrival = async () => {
    
    try {
      if (!arrivalFuelPhoto) {\`;
const replacement = \`  const submitArrival = async () => {
    setProcessingId('general-arrival');
    try {
      if (!arrivalFuelPhoto) {\`;

code = code.replace(target, replacement);

const target2 = \`    setProcessingId('general-arrival');\\r\\n    try {\\r\\n      const currentDraft\`;
const replacement2 = \`      const currentDraft\`;
code = code.replace(target2, replacement2);

const target3 = \`    setProcessingId('general-arrival');\\n    try {\\n      const currentDraft\`;
const replacement3 = \`      const currentDraft\`;
code = code.replace(target3, replacement3);

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log('Fixed');
