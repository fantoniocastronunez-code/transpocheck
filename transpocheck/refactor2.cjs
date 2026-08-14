const fs = require('fs');

let content = fs.readFileSync('src/components/views/ChecklistForm.jsx', 'utf8');

function extractBlock(startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start === -1) throw new Error("Start marker not found: " + startMarker);
  const end = content.indexOf(endMarker, start);
  if (end === -1) throw new Error("End marker not found: " + endMarker);
  return content.slice(start, end + endMarker.length);
}

// 1. Step 1 Origin
const simpleStep1 = extractBlock("{job.tripType === 'simple' && step === 1 && (", "        )}");
const vehicleStep1 = extractBlock("{job.tripType !== 'simple' && step === 1 && (", "        )}");

const step1Content = `import React from 'react';
import { Camera, MapPin, Upload, XCircle, Search, Save, PenTool, CheckCircle, Clock } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step1Origin({ job, formData, setF, handleImageUpload, removeImage, getRouteStr }) {
  return (
    <>
      ${simpleStep1}
      ${vehicleStep1}
    </>
  );
}`;
fs.writeFileSync('src/components/views/ChecklistForm/Step1Origin.jsx', step1Content);

// 2. Step 2 Vehicle / Service
const simpleStep2 = extractBlock("{job.tripType === 'simple' && step === 2 && (() => {", "        })()}");
const vehicleStep2 = extractBlock("{job.tripType !== 'simple' && step === 2 && (", "        )}");

const step2Content = `import React from 'react';
import { Camera, MapPin, Upload, XCircle, Search, Save, PenTool, CheckCircle, Clock, Trash2 } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step2Vehicle({ job, formData, setF, handleImageUpload, removeImage, fileInputRef, processingId }) {
  return (
    <>
      ${simpleStep2}
      ${vehicleStep2}
    </>
  );
}`;
fs.writeFileSync('src/components/views/ChecklistForm/Step2Vehicle.jsx', step2Content);

// 3. Step 3 Damage
const vehicleStep3 = extractBlock("{job.tripType !== 'simple' && step === 3 && (", "        )}");

const step3Content = `import React from 'react';
import { Camera, XCircle, FileText, CheckCircle, Upload, Trash2, Info } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step3Damage({ job, formData, setF, handleImageUpload, removeImage, addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex, setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex, setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData, setTempDamageData }) {
  return (
    <>
      ${vehicleStep3}
    </>
  );
}`;
fs.writeFileSync('src/components/views/ChecklistForm/Step3Damage.jsx', step3Content);

// 4. Step 4 Destination
const vehicleStep4 = extractBlock("{job.tripType !== 'simple' && step === 4 && (", "        )}");

const step4Content = `import React from 'react';
import { Camera, MapPin, Upload, XCircle, CheckCircle, Trash2, Edit2, Car } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step4Destination({ job, formData, setF, handleImageUpload, removeImage, getRouteStr, handleQuickSetLocation, allClientsList, fileInputRef, processingId }) {
  return (
    <>
      ${vehicleStep4}
    </>
  );
}`;
fs.writeFileSync('src/components/views/ChecklistForm/Step4Destination.jsx', step4Content);

// 5. Step 5 Extras
const vehicleStep5 = extractBlock("{job.tripType !== 'simple' && step === 5 && (", "        )}");

const step5Content = `import React from 'react';
import { Camera, Upload, XCircle, CheckCircle, Trash2 } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step5Signature({ job, formData, setF, handleImageUpload, removeImage }) {
  return (
    <>
      ${vehicleStep5}
    </>
  );
}`;
fs.writeFileSync('src/components/views/ChecklistForm/Step5Extras.jsx', step5Content);

// 6. Step 6 (Final Signature)
const signatureStep = extractBlock("{((job.tripType !== 'simple' && step === 6) || (job.tripType === 'simple' && step === 3)) && (", "        )}");

const step6Content = `import React from 'react';
import { PenTool, Search } from 'lucide-react';
import SignaturePad from '../SignaturePad';

export default function Step6SignatureFinal({ job, formData, setF }) {
  return (
    <>
      ${signatureStep}
    </>
  );
}`;
fs.writeFileSync('src/components/views/ChecklistForm/Step6Signature.jsx', step6Content);

// 7. DejaVuModal
const dejaVuModal = extractBlock("{showDejaVuModal && dejaVuData && (", "      )}");

const dejaVuContent = `import React from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export default function DejaVuModal({ showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu, formData }) {
  if (!showDejaVuModal || !dejaVuData) return null;
  return (
    <>
      ${dejaVuModal}
    </>
  );
}`;
fs.writeFileSync('src/components/views/ChecklistForm/DejaVuModal.jsx', dejaVuContent);

// Now let's replace all of them in ChecklistForm.jsx!

let newContent = content.replace(simpleStep1, '<Step1Origin {...formProps} />');
newContent = newContent.replace(vehicleStep1, '');

newContent = newContent.replace(simpleStep2, '<Step2Vehicle {...formProps} />');
newContent = newContent.replace(vehicleStep2, '');

newContent = newContent.replace(vehicleStep3, '<Step3Damage {...formProps} />');
newContent = newContent.replace(vehicleStep4, '<Step4Destination {...formProps} />');
newContent = newContent.replace(vehicleStep5, '<Step5Extras {...formProps} />');
newContent = newContent.replace(signatureStep, '<Step6Signature {...formProps} />');
newContent = newContent.replace(dejaVuModal, '<DejaVuModal showDejaVuModal={showDejaVuModal} setShowDejaVuModal={setShowDejaVuModal} dejaVuData={dejaVuData} handleAcceptDejaVu={handleAcceptDejaVu} formData={formData} />');

// Insert the formProps object right before the return statement inside ChecklistForm
const returnIndex = newContent.indexOf('return (');
const formPropsCode = `
  const formProps = {
    job, formData, setF, handleImageUpload, removeImage, getRouteStr, drivers,
    handleQuickSetLocation, step, setStep, showAlert, allClientsList,
    addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex,
    setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex,
    setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData,
    setTempDamageData, fileInputRef, processingId, currentUserEmail
  };
\n`;

newContent = newContent.slice(0, returnIndex) + formPropsCode + newContent.slice(returnIndex);

// Add imports
const imports = `import Step1Origin from './ChecklistForm/Step1Origin';
import Step2Vehicle from './ChecklistForm/Step2Vehicle';
import Step3Damage from './ChecklistForm/Step3Damage';
import Step4Destination from './ChecklistForm/Step4Destination';
import Step5Extras from './ChecklistForm/Step5Extras';
import Step6Signature from './ChecklistForm/Step6Signature';
import DejaVuModal from './ChecklistForm/DejaVuModal';\n`;

newContent = newContent.replace('import SignaturePad', imports + 'import SignaturePad');

fs.writeFileSync('src/components/views/ChecklistForm.jsx', newContent);

console.log('Successfully refactored ChecklistForm.jsx!');
