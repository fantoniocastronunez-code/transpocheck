const fs = require('fs');
const dir = 'src/components/views/ChecklistForm/';
const files = fs.readdirSync(dir);

const destructureStr = `
  const { job, formData, setF, handleImageUpload, removeImage, getRouteStr, drivers,
    handleQuickSetLocation, step, setStep, showAlert, allClientsList,
    addDamageMarker, removeDamageMarker, updateDamageMarker, selectedDamageIndex,
    setSelectedDamageIndex, showHelpOverlay, setShowHelpOverlay, currentImageIndex,
    setCurrentImageIndex, setShowDamageModal, showDamageModal, tempDamageData,
    setTempDamageData, fileInputRef, processingId, currentUserEmail,
    showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu,
    uploadProgress, cameraConfig, setCameraConfig, processingAction,
    handleRemoteSignRequest, handleOpenQR, handlePhotoClick, isSubmitting, clearDraft, isDraftLoaded } = props;
`;

files.forEach(file => {
  if (file.endsWith('.jsx')) {
    let content = fs.readFileSync(dir + file, 'utf8');
    
    // Replace export default function StepName({ job, formData, setF }) { ...
    // With export default function StepName(props) { ... \n destructureStr
    content = content.replace(/export default function ([A-Za-z0-9_]+)\(\{[^}]+\}\) \{/, (match, funcName) => {
      return 'export default function ' + funcName + '(props) {' + destructureStr;
    });
    
    fs.writeFileSync(dir + file, content);
  }
});
console.log('Fixed step signatures');
