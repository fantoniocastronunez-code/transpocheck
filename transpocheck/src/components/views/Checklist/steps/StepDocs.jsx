import React from 'react';
import { Camera, CheckCircle, AlertTriangle, FileText, MapPin, CloudOff } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { FormattedMonthInput } from '../../../ui/FormattedMonthInput';

export const StepDocs = ({ openCamera }) => {
  const { job, formData, setF, showAlert } = useChecklist();

  const handleCapturePhoto = async (docId) => {
    openCamera(`Foto: ${docId}`, async (file) => {
      try {
        const { resizeImage } = await import('../../../../utils/helpers');
        const compressed = await resizeImage(file, 1200, 0.6);
        setF('docsPhotos', { ...(formData.docsPhotos || {}), [docId]: compressed });
      } catch (e) {
        showAlert("Error al procesar la foto.");
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
                         className={`p-2 rounded-xl border-2 transition-colors ${photo ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                      >
                         <Camera className="w-5 h-5" />
                      </button>
                   </div>
                </div>

                {/* Expiry Date (only if checked) */}
                {isChecked && (
                   <div className="pl-12 flex gap-4 animate-in fade-in slide-in-from-top-2">
                     <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-black uppercase text-slate-500">Vencimiento:</span>
                        <FormattedMonthInput 
                           value={(formData.docsExpiry?.[doc.id] || '').substring(0, 7)} 
                           onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} 
                        />
                     </div>
                     {photo && (
                       <div className="w-12 h-10 rounded-lg overflow-hidden border border-blue-500 shrink-0">
                          <img src={photo} className="w-full h-full object-cover" />
                       </div>
                     )}
                   </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* SECCIÓN DOCUMENTOS EXTERNOS Y BANDEJA */}
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

    </div>
  );
};
