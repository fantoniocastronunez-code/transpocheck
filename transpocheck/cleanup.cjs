const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList.jsx', 'utf8');

// The goal is to clean up submitArrival completely
const startIdx = code.indexOf('  const submitArrival = async () => {');
const endIdx = code.indexOf('  // ------------------------------------------------------------', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newFunction = \`  const submitArrival = async () => {
    setProcessingId('general-arrival');
    try {
      if (!arrivalFuelPhoto) {
        showAlert("Debe adjuntar la foto del medidor de combustible de forma obligatoria.");
        setProcessingId(null);
        return;
      }
      
      const clientName = arrivalPromptJob?.clientName?.toUpperCase() || '';
      const isGrandleasingMileageRequired = clientName === 'GRANDLEASING LAS TORRES' || clientName === 'GRANDLEASING UMAÑA' || clientName === 'GRANDLEASING USADOS';
      
      if (isGrandleasingMileageRequired && (!arrivalMileage || arrivalMileage.trim() === '')) {
        showAlert("Debe ingresar el kilometraje de forma obligatoria para este cliente.");
        setProcessingId(null);
        return;
      }

      const currentDraft = arrivalPromptJob.draft?.formData || {};
      const currentPhotos = currentDraft.photos || {};

      const updatedDraft = {
        ...currentDraft,
        mileage: arrivalMileage || '',
        keyLocation: arrivalKeyLocation || '',
        keyHandedTo: arrivalKeyLocation === 'mano' ? arrivalKeyHandedTo : ''
      };

      updatedDraft.photos = { ...currentPhotos };
      if (arrivalPhoto) {
        updatedDraft.photos.odometer = arrivalPhoto;
      }
      updatedDraft.photos.fuelGauge = arrivalFuelPhoto;

      await updateDoc(doc(db, 'transport_jobs', arrivalPromptJob.id), {
        'draft.formData': updatedDraft
      });

      if (arrivalPromptJob.phase === 'prt_done') {
        notifyClient(arrivalPromptJob, 'en_ruta_destino');
      }
      await updatePhase(arrivalPromptJob, 'arrived_destination');

      setArrivalPromptJob(null);
      setArrivalMileage('');
      setArrivalPhoto(null);
      setArrivalFuelPhoto(null);
      setArrivalKeyLocation('');
      setArrivalKeyHandedTo('');
    } catch (e) {
      console.error(e);
      showAlert("❌ Error al guardar datos de llegada.");
    } finally {
      setProcessingId(null);
    }
  };
\`;
  code = code.substring(0, startIdx) + newFunction + code.substring(endIdx);
  fs.writeFileSync('src/components/views/JobsList.jsx', code, 'utf8');
  console.log("Cleanup complete");
} else {
  console.log("Could not find start or end index");
}
