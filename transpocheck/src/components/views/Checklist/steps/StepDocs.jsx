import React, { useState } from 'react';
import { Camera, CheckCircle, FileText, MapPin, CloudOff, Eye, X } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { FormattedMonthInput } from '../../../ui/FormattedMonthInput';

export const StepDocs = ({ openCamera }) => {
  const { job, formData, setF, setFormData, showAlert, uploadImageToStorage, saveDraftToIndexedDB, persistStoragePhoto } = useChecklist();
  const [previewDocPhoto, setPreviewDocPhoto] = useState(null);

  const isRevisionTecnica = job?.tripType === 'revision' || 
                            job?.destination?.toUpperCase()?.includes('REVISION TECNICA') ||
                            job?.destination?.toUpperCase()?.includes('REVISIÓN TÉCNICA');

  const handleCapturePhoto = async (docId) => {
    openCamera(`Foto: ${docId}`, async (file) => {
      try {
        const { resizeImage } = await import('../../../../utils/helpers');
        const compressed = await resizeImage(file, 1200, 0.6);
        
        setFormData(prev => {
          const updated = {
            ...prev,
            docsPhotos: { ...(prev.docsPhotos || {}), [docId]: compressed }
          };
          if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
          return updated;
        });

        if (job?.id && job.id !== 'NEW_QUICK_JOB' && uploadImageToStorage) {
          uploadImageToStorage(
            compressed,
            `checklists/${job.id}`,
            `doc_${docId}_${Date.now()}.jpg`
          ).then(storageUrl => {
            if (storageUrl) {
              setFormData(prev => {
                const updated = {
                  ...prev,
                  docsPhotos: { ...(prev.docsPhotos || {}), [docId]: storageUrl }
                };
                if (saveDraftToIndexedDB) saveDraftToIndexedDB(updated);
                return updated;
              });
              if (persistStoragePhoto) {
                persistStoragePhoto('docsPhotos', docId, storageUrl);
              }
            }
          }).catch(err => {
            console.warn(`[ERR-DOC-UPLOAD-BG-${docId.toUpperCase()}] Error subiendo doc a storage:`, err);
          });
        }
      } catch (e) {
        console.error("[ERR-DOC-PHOTO-01]", e);
        showAlert("Error al procesar la foto [ERR-DOC-PHOTO-01].");
      }
    });
  };

  const docsConfig = [
    { id: 'permiso', label: 'Permiso de Circulación', icon: <MapPin className="w-4 h-4" /> }, 
    { id: 'soap', label: 'Seguro SOAP', icon: <FileText className="w-4 h-4" /> }, 
    { id: 'revTecnica', label: 'Revisión Técnica', icon: <CheckCircle className="w-4 h-4" /> },
    { id: 'gases', label: 'Certificado de Gases', icon: <CloudOff className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-150 pb-10 pt-3">
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-xs relative overflow-hidden">

        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-5">
          Verificar Documentos
        </h3>
        
        {formData.isNewVehicle ? (
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 p-4 rounded-lg flex items-center gap-3.5">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-900/50 rounded-lg text-sky-600 dark:text-sky-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-sky-900 dark:text-sky-300 uppercase tracking-wider mb-0.5">Vehículo Nuevo</p>
              <p className="text-xs font-medium text-sky-700 dark:text-sky-400">No se requiere documentación. Puedes continuar.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {docsConfig.map(doc => {
              const isChecked = !!formData.docs?.[doc.id];
              const photo = formData.docsPhotos?.[doc.id];

              return (
                <div key={doc.id} className="flex flex-col gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isChecked ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                           {doc.icon}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{doc.label}</span>
                     </div>
                     
                     <div className="flex items-center gap-3">
                        {/* Toggle Switch */}
                        <label className="relative flex items-center cursor-pointer">
                          <input 
                             type="checkbox" 
                             className="sr-only" 
                             checked={isChecked} 
                             onChange={() => setF('docs', { ...formData.docs, [doc.id]: !isChecked })} 
                          />
                          <div className={`block w-11 h-6 rounded-full transition-colors ${isChecked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isChecked ? 'transform translate-x-5' : ''}`}></div>
                        </label>

                        {/* Camera Button */}
                        <button 
                           type="button" 
                           onClick={() => handleCapturePhoto(doc.id)}
                           title={photo ? "Tomar nueva foto para reemplazar" : "Tomar foto"}
                           className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 ${photo ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:border-sky-500 hover:text-sky-600'}`}
                        >
                           <Camera className="w-4 h-4" />
                        </button>
                     </div>
                  </div>

                  {/* Expiry Date (only if checked) */}
                  {isChecked && (
                     <div className="pl-11 flex items-center gap-3 animate-in fade-in">
                       <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Vencimiento:</span>
                          <FormattedMonthInput 
                             value={(formData.docsExpiry?.[doc.id] || '').substring(0, 7)} 
                             onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} 
                          />
                       </div>
                       {photo && (
                         <div 
                           onClick={() => setPreviewDocPhoto({ url: photo, title: doc.label })}
                           className="h-10 px-2.5 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 flex items-center gap-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors shrink-0"
                           title="Toca para ver el documento en grande"
                         >
                            <div className="w-7 h-7 rounded-md overflow-hidden border border-sky-400 shrink-0">
                               <img src={photo} className="w-full h-full object-cover" alt={doc.label} />
                            </div>
                            <div className="flex flex-col text-left">
                               <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 flex items-center gap-1 leading-tight">
                                  <Eye className="w-3 h-3"/> Ver
                                </span>
                               {typeof photo === 'string' && photo.startsWith('http') && (
                                  <span className="text-[8px] font-medium text-slate-500 dark:text-slate-400 leading-tight">En Ficha</span>
                               )}
                            </div>
                         </div>
                       )}
                     </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN DOCUMENTOS EXTERNOS Y BANDEJA */}
      {isRevisionTecnica && (
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs mt-4">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5 flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Escaneo y PDFs
        </h3>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4 leading-tight">
          Pega el link de CamScanner/Acrobat o sube el PDF directamente.
        </p>

        <div className="space-y-4">
          {/* Input de Enlace */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Enlace del Documento</label>
            <div className="flex gap-2">
              <input 
                type="url" 
                placeholder="Ej: https://acrobat.adobe.com/..." 
                value={formData.scannerLink || ''} 
                onChange={(e) => setF('scannerLink', e.target.value)} 
                className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg font-medium text-slate-800 dark:text-slate-200 text-sm outline-none focus:border-sky-600 transition-colors" 
              />
              <button 
                type="button" 
                onClick={async () => {
                  if (!formData.scannerLink) return showAlert("⚠️ Pega un link primero.");
                  if (job?.id === 'NEW_QUICK_JOB') return showAlert("⚠️ Debes 'Finalizar y Guardar' el acta abajo para poder notificar este link.");

                  try {
                    showAlert("⏳ Guardando link y notificando al cliente...");
                    const { doc, updateDoc } = await import('firebase/firestore');
                    const { db } = await import('../../../../firebase');
                    
                    const updatedChecklist = { ...(job.checklist || {}), ...formData, scannerLink: formData.scannerLink };
                    await updateDoc(doc(db, 'transport_jobs', job.id), {
                      'checklist.scannerLink': formData.scannerLink
                    });
                    
                    const { generateWhatsAppText } = await import('../../../../utils/helpers');
                    const msg = generateWhatsAppText(job, updatedChecklist, "Hola, aquí está el link con la revisión técnica escaneada:");
                    window.open(`https://wa.me/${job.originContactPhone || ''}?text=${encodeURIComponent(msg)}`, '_blank');
                    showAlert("✅ Link guardado y WhatsApp abierto.");
                  } catch (err) {
                    console.error("[ERR-DOC-01]", err);
                    showAlert("❌ Error al guardar el link [ERR-DOC-01].");
                  }
                }} 
                className="bg-sky-600 text-white px-4 rounded-lg font-bold text-xs hover:bg-sky-700 transition-colors flex flex-col items-center justify-center leading-tight tracking-wider"
              >
                <span>ENVIAR</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">O Sube PDF</span>
            <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
          </div>

          {/* Botón de Upload */}
          <label className="w-full bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 p-5 rounded-xl font-bold text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-colors">
            <input 
              type="file" 
              accept="application/pdf,image/*" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setF('scandocPdf', ev.target.result);
                  showAlert("✅ Archivo adjunto listo para guardar.");
                };
                reader.readAsDataURL(file);
              }} 
            />
            <div className="bg-slate-200/70 dark:bg-slate-800 p-2.5 rounded-lg">
              <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="text-center">
              {formData.scandocPdf ? 'ARCHIVO CARGADO (Toca para cambiar)' : 'ADJUNTAR ARCHIVO DIRECTO'}
            </span>
          </label>
        </div>

        {/* PDF de Bandeja */}
        {job?.checklist?.scandocPdfInbox && (
          <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">Bandeja</p>
                <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Doc. Asignado en Central</p>
              </div>
            </div>
            <a 
              href={job.checklist.scandocPdfInbox} 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors"
            >
              VER PDF
            </a>
          </div>
        )}
      </div>
      )}

      {/* Modal de Previsualización de Foto del Documento */}
      {previewDocPhoto && (
        <div className="fixed inset-0 bg-slate-950/85 z-[9999] flex flex-col items-center justify-center p-4 cursor-pointer animate-in fade-in" onClick={() => setPreviewDocPhoto(null)}>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl max-w-lg w-full flex flex-col gap-3 shadow-lg relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-xs uppercase tracking-wider">{previewDocPhoto.title}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setPreviewDocPhoto(null)} 
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-lg flex items-center justify-center bg-slate-950 p-1">
              <img src={previewDocPhoto.url} alt={previewDocPhoto.title} className="max-w-full max-h-[68vh] object-contain rounded-md" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span>Toca la cámara si necesitas actualizar o reemplazar esta foto.</span>
              <button 
                type="button"
                onClick={() => window.open(previewDocPhoto.url, '_blank')}
                className="text-sky-400 hover:underline font-bold"
              >
                Abrir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
