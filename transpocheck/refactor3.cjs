const fs = require('fs');
const content = fs.readFileSync('src/components/views/ChecklistForm.jsx', 'utf8');
const lines = content.split('\n');

function getLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// Ensure the line numbers are correct
// Simple Step 1: 801 to 825
// Simple Step 2: 827 to 865
// Vehicle Step 1: 868 to 977
// Vehicle Step 2: 980 to 1168
// Vehicle Step 3: 1171 to 1213
// Vehicle Step 4: 1216 to 1523
// Vehicle Step 5: 1526 to 1663
// Signature Step: 1666 to 1785
// DejaVuModal: 1787 to 1833

const simpleStep1 = getLines(801, 825);
const simpleStep2 = getLines(827, 865);
const vehicleStep1 = getLines(868, 977);
const vehicleStep2 = getLines(980, 1168);
const vehicleStep3 = getLines(1171, 1213);
const vehicleStep4 = getLines(1216, 1523);
const vehicleStep5 = getLines(1526, 1663);
const signatureStep = getLines(1666, 1785);
const dejaVuModal = getLines(1787, 1833);

fs.writeFileSync('src/components/views/ChecklistForm/Step1Origin.jsx', `import React from 'react';
import { Camera, MapPin, Upload, XCircle, Search, Save, PenTool, CheckCircle, Clock } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step1Origin({ job, formData, setF, handleImageUpload, removeImage, getRouteStr, allClientsList }) {
  return (
    <>
      ${simpleStep1}
      ${vehicleStep1}
    </>
  );
}`);

fs.writeFileSync('src/components/views/ChecklistForm/Step2Vehicle.jsx', `import React from 'react';
import { Camera, MapPin, Upload, XCircle, Search, Save, PenTool, CheckCircle, Clock, Trash2 } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step2Vehicle({ job, formData, setF, handleImageUpload, removeImage, fileInputRef, processingId, showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu }) {
  return (
    <>
      ${simpleStep2}
      ${vehicleStep2}
    </>
  );
}`);

fs.writeFileSync('src/components/views/ChecklistForm/Step3Damage.jsx', `import React from 'react';
import { Camera, XCircle, FileText, CheckCircle, Upload, Trash2, Info } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step3Damage({ job, formData, setF, handleImageUpload, removeImage, addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex, setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex, setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData, setTempDamageData }) {
  return (
    <>
      ${vehicleStep3}
    </>
  );
}`);

fs.writeFileSync('src/components/views/ChecklistForm/Step4Destination.jsx', `import React from 'react';
import { Camera, MapPin, Upload, XCircle, CheckCircle, Trash2, Edit2, Car } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step4Destination({ job, formData, setF, handleImageUpload, removeImage, getRouteStr, handleQuickSetLocation, allClientsList, fileInputRef, processingId }) {
  return (
    <>
      ${vehicleStep4}
    </>
  );
}`);

fs.writeFileSync('src/components/views/ChecklistForm/Step5Extras.jsx', `import React from 'react';
import { Camera, Upload, XCircle, CheckCircle, Trash2 } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step5Extras({ job, formData, setF, handleImageUpload, removeImage }) {
  return (
    <>
      ${vehicleStep5}
    </>
  );
}`);

fs.writeFileSync('src/components/views/ChecklistForm/Step6Signature.jsx', `import React from 'react';
import { PenTool, Search } from 'lucide-react';
import SignaturePad from '../../SignaturePad';

export default function Step6Signature({ job, formData, setF }) {
  return (
    <>
      ${signatureStep}
    </>
  );
}`);

fs.writeFileSync('src/components/views/ChecklistForm/DejaVuModal.jsx', `import React from 'react';
import { RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react';

export default function DejaVuModal({ showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu, formData }) {
  if (!showDejaVuModal || !dejaVuData) return null;
  return (
    <>
      ${dejaVuModal}
    </>
  );
}`);

const beforeSteps = getLines(1, 800);
const afterSteps = getLines(1834, lines.length);

const imports = `import Step1Origin from './ChecklistForm/Step1Origin';
import Step2Vehicle from './ChecklistForm/Step2Vehicle';
import Step3Damage from './ChecklistForm/Step3Damage';
import Step4Destination from './ChecklistForm/Step4Destination';
import Step5Extras from './ChecklistForm/Step5Extras';
import Step6Signature from './ChecklistForm/Step6Signature';
import DejaVuModal from './ChecklistForm/DejaVuModal';
`;

let finalFile = beforeSteps.replace('import SignaturePad from \'../SignaturePad\';', imports + 'import SignaturePad from \'../SignaturePad\';');

const formProps = `
  const formProps = {
    job, formData, setF, handleImageUpload, removeImage, getRouteStr, drivers,
    handleQuickSetLocation, step, setStep, showAlert, allClientsList,
    addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex,
    setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex,
    setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData,
    setTempDamageData, fileInputRef, processingId, currentUserEmail,
    showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu
  };
`;

finalFile = finalFile.replace('return (', formProps + '\n  return (');

finalFile += `
          <Step1Origin {...formProps} />
          <Step2Vehicle {...formProps} />
          <Step3Damage {...formProps} />
          <Step4Destination {...formProps} />
          <Step5Extras {...formProps} />
          <Step6Signature {...formProps} />

        </form>
      </div>
      <DejaVuModal {...formProps} />
    </div>
  );
}
`;

fs.writeFileSync('src/components/views/ChecklistForm.jsx', finalFile);
console.log('Successfully refactored with explicit line numbers!');
