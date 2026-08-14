const fs = require('fs');
let content = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

// Find renderActiveJobCard
const activeStart = content.indexOf('const renderActiveJobCard = (j) => {');
let activeEnd = -1;
let braces = 0;
for (let i = activeStart; i < content.length; i++) {
  if (content[i] === '{') braces++;
  if (content[i] === '}') {
    braces--;
    if (braces === 0) {
      activeEnd = i + 1;
      break;
    }
  }
}

const activeCodeToReplace = content.slice(activeStart, activeEnd);

// Find renderHistoryJobCard
const historyStart = content.indexOf('const renderHistoryJobCard = (j) => {');
let historyEnd = -1;
braces = 0;
for (let i = historyStart; i < content.length; i++) {
  if (content[i] === '{') braces++;
  if (content[i] === '}') {
    braces--;
    if (braces === 0) {
      historyEnd = i + 1;
      break;
    }
  }
}

const historyCodeToReplace = content.slice(historyStart, historyEnd);

let newContent = content.replace(activeCodeToReplace, `const getRtFinalDestination = (job) => {
    // 1. PRIORIDAD ABSOLUTA: Si el administrador editó la ruta con flechas, esta gana por sobre el checklist.
    if (job.destination && job.destination.includes('->')) {
      const parts = job.destination.split('->');
      return parts[parts.length - 1].trim();
    }

    // 2. Si no hay ruta editada manual, tomamos la decisión del checklist
    if (job.checklist?.rtReturnOption === 'other' && job.checklist?.rtReturnDestination) {
      return job.checklist.rtReturnDestination;
    }
    if (job.checklist?.rtReturnOption === 'origin') {
      return job.origin;
    }
    
    // 3. Fallback final si no hay checklist cerrado ni flechas
    if (job.destination && !job.destination.toLowerCase().includes('prt')) {
      return job.destination.trim();
    }
    return job.origin || 'Por definir';
};

const jobCardProps = {
  analyzeJobStatus, getJobIdentifier, vehicles, menuOpenId, setMenuOpenId, isAdminView, onEditJob, currentUserEmail, setRelayPromptJob, setForceCloseJob, db, updateDoc, deleteField, doc, showAlert, showConfirm, setJobToFail, latestVehiclePhotos, setFullScreenPhoto, role, processingId, setProcessingId, handleApproveRequest, handleRejectRequest, handleAcceptJob, setTrackingJobId, setGuideUploadJob, setGuideLink, setGuideFileBase64, updatePhase, setArrivalPromptJob, setArrivalMileage, setArrivalPhoto, setArrivalKeyLocation, setArrivalKeyHandedTo, setPrtApproveType, setPrtReturnOpt, setPrtReturnDest, setPrtApprovePromptJob, setPrtPromptJob, onStartChecklist, handleUndoPhase, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, WaitTimerBadge, SwipeButton, AlertCircle, Edit2, MoreVertical, Navigation, Share2, Users, CheckCircle, Truck, X, XCircle, Clock, Car, MapPin, FileText
};
const renderActiveJobCard = (j) => <JobCard key={j.id} j={j} {...jobCardProps} />;`);

newContent = newContent.replace(historyCodeToReplace, `const historyJobCardProps = {
  drivers, getJobIdentifier, setSelectedHistoryJob, latestVehiclePhotos, setFullScreenPhoto, auditMode, isAdminView, setEditDateJob, setEditKmJob, handleSingleRecalculate, processingId, onEditJob, handleDuplicateJob, generatePDF, handleShareWhatsAppPDF, handleDeleteJob, updateDoc, doc, deleteField, db, showConfirm, showAlert, getRtFinalDestination, LicensePlateBadge, VinPlateBadge, AlertCircle, Navigation, Edit2, MapPin, FileText, Clock, MapIcon, CheckCircle, Repeat, FileDown, Trash2, Share2
};
const renderHistoryJobCard = (j) => <HistoryJobCard key={j.id} j={j} {...historyJobCardProps} />;`);

// Replace modals
const modalsStart = newContent.indexOf('{/* NUEVO MODAL: BUSCAR Y REEMPLAZAR MASIVO */}');
const modalsEnd = newContent.indexOf('{/* NUEVO MODAL: PANEL DE SEGUIMIENTO EN VIVO */}');
if(modalsStart !== -1 && modalsEnd !== -1) {
    const modalsCodeToReplace = newContent.slice(modalsStart, modalsEnd);

    newContent = newContent.replace(modalsCodeToReplace, `<BulkReplaceModal
        showReplaceModal={showReplaceModal}
        setShowReplaceModal={setShowReplaceModal}
        replaceField={replaceField}
        setReplaceField={setReplaceField}
        replaceSearchTerm={replaceSearchTerm}
        setReplaceSearchTerm={setReplaceSearchTerm}
        replaceNewTerm={replaceNewTerm}
        setReplaceNewTerm={setReplaceNewTerm}
        executeBulkReplace={executeBulkReplace}
        processingId={processingId}
      />

      <GuideUploadModal
        guideUploadJob={guideUploadJob}
        setGuideUploadJob={setGuideUploadJob}
        guideLink={guideLink}
        setGuideLink={setGuideLink}
        guideFileBase64={guideFileBase64}
        setGuideFileBase64={setGuideFileBase64}
        processingId={processingId}
        setProcessingId={setProcessingId}
        showAlert={showAlert}
        notifyClient={notifyClient}
        db={db}
      />

      <FullScreenPhotoModal
        fullScreenPhoto={fullScreenPhoto}
        setFullScreenPhoto={setFullScreenPhoto}
      />

      <HistoryModal
        selectedHistoryJob={selectedHistoryJob}
        setSelectedHistoryJob={setSelectedHistoryJob}
        getJobIdentifier={getJobIdentifier}
        getRouteStr={getRouteStr}
        vehicles={vehicles}
        drivers={drivers}
        setFullScreenPhoto={setFullScreenPhoto}
      />
      
      `);
}

// Add imports
const imports = `import JobCard from './JobsList/JobCard';
import HistoryJobCard from './JobsList/HistoryJobCard';
import BulkReplaceModal from './JobsList/BulkReplaceModal';
import GuideUploadModal from './JobsList/GuideUploadModal';
import FullScreenPhotoModal from './JobsList/FullScreenPhotoModal';
import HistoryModal from './JobsList/HistoryModal';\n`;
if(!newContent.includes('import JobCard')) {
    newContent = newContent.replace('import KovacsModal', imports + 'import KovacsModal');
}

fs.writeFileSync('src/components/views/JobsList.jsx', newContent);
console.log('Successfully completely refactored JobsList.jsx!');
