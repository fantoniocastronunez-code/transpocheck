const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

const t1 = "  const submitArrival = async () => {\\r\\n    \\r\\n    try {\\r\\n      if (!arrivalFuelPhoto) {";
const r1 = "  const submitArrival = async () => {\\n    setProcessingId('general-arrival');\\n    try {\\n      if (!arrivalFuelPhoto) {";
code = code.replace(t1, r1);

const t1_unix = "  const submitArrival = async () => {\\n    \\n    try {\\n      if (!arrivalFuelPhoto) {";
const r1_unix = "  const submitArrival = async () => {\\n    setProcessingId('general-arrival');\\n    try {\\n      if (!arrivalFuelPhoto) {";
code = code.replace(t1_unix, r1_unix);

const t2 = "    setProcessingId('general-arrival');\\r\\n    try {\\r\\n      const currentDraft";
const r2 = "      const currentDraft";
code = code.replace(t2, r2);

const t2_unix = "    setProcessingId('general-arrival');\\n    try {\\n      const currentDraft";
const r2_unix = "      const currentDraft";
code = code.replace(t2_unix, r2_unix);

fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
console.log('Fixed syntax');
