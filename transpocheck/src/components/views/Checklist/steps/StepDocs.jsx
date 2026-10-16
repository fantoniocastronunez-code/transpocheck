import React, { useState } from 'react';
import { Camera, CheckCircle, AlertTriangle, FileText, MapPin, CloudOff, Eye, X } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { FormattedMonthInput } from '../../../ui/FormattedMonthInput';

export const StepDocs = ({ openCamera }) => {
  const { job, formData, setF, showAlert } = useChecklist();
  const [previewDocPhoto, setPreviewDocPhoto] = useState(null);

  const isRevisionTecnica = job?.tripType === 'revision' || 
                            job?.destination?.toUpperCase()?.includes('REVISION TECNICA') ||
                            job?.destination?.toUpperCase()?.includes('REVISIÓN TÉCNICA');

  const handleCapturePhoto = async (docId) => {
    openCamera(`Foto: ${docId}`, async (file) => {
      try {
        const { resizeImage } = await import('../../../../utils/helpers');
        const compressed = await resizeImage(file, 1200, 0.6);
        setF('docsPhotos', { ...(formData.docsPhotos || {}), [docId]: compressed });
      } catch (e) {
        console.error("[ERR-DOC-PHOTO-01]", e);
        showAlert("Error al procesar la foto [ERR-DOC-PHOTO-01].");
      }
    });
  };

  const docsConfig = [
    { id: 'permiso', label: 'Permiso de Circulación', icon: <MapPin className="w-5 h-5" /> }, 
    { id: 'soap', label: 'Seguro SOAP', icon: <FileText className="w-5 h-5" /> }, 
    { id: 'revTecnica', label: 'Revisión Técnica', icon: <CheckCircle className="w-5 h-5" /> },
    { id: 'gases', label: 'Certificado de Gases', icon: <CloudOff className="w-5 h-5" /> }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      
      <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-lg relative overflow-hidden">
        {/* Glassmorphism Background Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>

        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-6 relative z-10">
          Verificar Documentos
        </h3>
        
        {formData.isNewVehicle ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-5 rounded-2xl flex items-center gap-4 relative z-10 shadow-inner">
            <div className="p-3 bg-blue-100 dark:bg-blue-800/50 rounded-xl text-blue-600 dark:text-blue-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-0.5">Vehículo Nuevo</p>
              <p className="text-[11px] font-bold text-blue-600/80 dark:text-blue-400/80">No se requiere documentación. Puedes continuar.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            {docsConfig.map(doc => {
              const isChecked = !!formData.docs?.[doc.id];
              const photo = formData.docsPhotos?.[doc.id];

              return (
                <div key={doc.id} className="flex flex-col gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isChecked ? 'bg-green-500/10 text-green-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                           {doc.icon}
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{doc.label}</span>
                     </div>
                     
                     <div className="flex items-center gap-4">
                        {/* Toggle Switch */}
                        <label className="relative flex items-center cursor-pointer">
                          <input 
                             type="checkbox" 
                             className="sr-only" 
                             checked={isChecked} 
                             onChange={() => setF('docs', { ...formData.docs, [doc.id]: !isChecked })} 
                          />
                          <div className={`block w-12 h-7 rounded-full transition-colors ${isChecked ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                          <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isChecked ? 'transform translate-x-5 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : ''}`}></div>
                        </label>

                        {/* Camera Button */}
                        <button 
                           type="button" 
                           onClick={() => handleCapturePhoto(doc.id)}
                           title={photo ? "Tomar nueva foto para reemplazar" : "Tomar foto"}
                           className={`p-2 rounded-xl border-2 transition-colors flex items-center gap-1.5 ${photo ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                        >
                           <Camera className="w-5 h-5" />
                        </button>
                     </div>
                  </div>

                  {/* Expiry Date (only if checked) */}
                  {isChecked && (
                     <div className="pl-12 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                       <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-black uppercase text-slate-500">Vencimiento:</span>
                          <FormattedMonthInput 
                             value={(formData.docsExpiry?.[doc.id] || '').substring(0, 7)} 
                             onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} 
                          />
                       </div>
                       {photo && (
                         <div 
                           onClick={() => setPreviewDocPhoto({ url: photo, title: doc.label })}
                           className="h-10 px-2 rounded-xl border border-blue-400/80 bg-blue-50 dark:bg-blue-900/40 flex items-center gap-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-colors shrink-0 shadow-sm"
                           title="Toca para ver el documento en grande"
                         >
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-blue-500 shrink-0">
                               <img src={photo} className="w-full h-full object-cover" alt={doc.label} />
                            </div>
                            <div className="flex flex-col text-left">
                               <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1 leading-tight">
                                  <Eye className="w-3 h-3"/> Ver
                                </span>
                               {typeof photo === 'string' && photo.startsWith('http') && (
                                  <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 leading-tight">En Ficha</span>
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
      <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-800/30 shadow-sm mt-6">
        <h3 className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Escaneo y PDFs
        </h3>
        <p className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 mb-5 leading-tight">
          Pega el link de CamScanner/Acrobat o sube el PDF directamente.
        </p>

        <div className="space-y-5">
          {/* Input de Enlace */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Enlace del Documento</label>
            <div className="flex gap-2">
              <input 
                type="url" 
                placeholder="Ej: https://acrobat.adobe.com/..." 
                value={formData.scannerLink || ''} 
                onChange={(e) => setF('scannerLink', e.target.value)} 
                className="w-full border-2 border-indigo-200 dark:border-indigo-700/50 bg-white dark:bg-slate-900 p-3.5 rounded-2xl font-bold text-slate-700 dark:text-slate-300 text-sm outline-none focus:border-indigo-500 transition-colors shadow-inner" 
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
                className="bg-indigo-600 text-white px-5 rounded-2xl font-black text-[10px] shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all flex flex-col items-center justify-center leading-tight tracking-widest"
              >
                <span>ENVIAR</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 opacity-50">
            <div className="h-px bg-indigo-300 dark:bg-indigo-600 flex-1" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-800 dark:text-indigo-300">O Sube PDF</span>
            <div className="h-px bg-indigo-300 dark:bg-indigo-600 flex-1" />
          </div>

          {/* Botón de Upload */}
          <label className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-300 dark:border-indigo-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-6 rounded-3xl font-black text-[11px] uppercase tracking-widest flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-sm group">
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
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-full group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-center">
              {formData.scandocPdf ? '✅ ARCHIVO CARGADO (Toca para cambiar)' : 'ADJUNTAR ARCHIVO DIRECTO'}
            </span>
          </label>
        </div>

        {/* PDF de Bandeja */}
        {job?.checklist?.scandocPdfInbox && (
          <div className="mt-5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Bandeja</p>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Doc. Asignado en Central</p>
              </div>
            </div>
            <a 
              href={job.checklist.scandocPdfInbox} 
              target="_blank" 
              rel="noreferrer" 
              className="text-[10px] bg-emerald-600 text-white px-3 py-2 rounded-xl font-black shadow-md hover:bg-emerald-500 active:scale-95 transition-all"
            >
              VER PDF
            </a>
          </div>
        )}
      </div>
      )}

      {/* Modal de Previsualización de Foto del Documento */}
      {previewDocPhoto && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4 cursor-pointer animate-in fade-in" onClick={() => setPreviewDocPhoto(null)}>
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-3xl max-w-lg w-full flex flex-col gap-3 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <FileText className="w-5 h-5 text-blue-400" />
                <span className="font-black text-sm uppercase">{previewDocPhoto.title}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setPreviewDocPhoto(null)} 
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-2xl flex items-center justify-center bg-black/60 p-1">
              <img src={previewDocPhoto.url} alt={previewDocPhoto.title} className="max-w-full max-h-[68vh] object-contain rounded-xl" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span>Toca la cámara si necesitas actualizar o reemplazar esta foto.</span>
              <button 
                type="button"
                onClick={() => window.open(previewDocPhoto.url, '_blank')}
                className="text-blue-400 hover:underline font-bold"
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
