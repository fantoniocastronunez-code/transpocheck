import React from 'react';
import { FileText, X, CheckCircle, Clock } from 'lucide-react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

export default function GuideUploadModal({
  guideUploadJob,
  setGuideUploadJob,
  guideLink,
  setGuideLink,
  guideFileBase64,
  setGuideFileBase64,
  processingId,
  setProcessingId,
  showAlert,
  notifyClient,
  db
}) {
  if (!guideUploadJob) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center z-[200] p-4">
       <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-md shadow-lg flex flex-col">
          <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
             <div>
               <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><FileText className="w-5 h-5 text-amber-600 dark:text-amber-400"/> Subir Guía de Despacho</h3>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Finaliza el traslado adjuntando la guía firmada.
               </p>
             </div>
             <button onClick={()=>setGuideUploadJob(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-600 dark:text-slate-300"/></button>
          </div>

          <div className="space-y-4 mb-5">
             <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Enlace del Documento</label>
                <input type="url" placeholder="Ej: https://acrobat.adobe.com/..." value={guideLink} onChange={(e) => setGuideLink(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 rounded-md font-medium text-slate-800 dark:text-slate-200 text-sm outline-none focus:border-blue-600 transition-colors" />
             </div>

             <div className="flex items-center gap-2 my-2"><div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div><span className="text-[10px] font-semibold uppercase text-slate-400">O Subir Archivo PDF/Foto</span><div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div></div>

             <label className="w-full bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 p-4 rounded-md font-semibold text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => {
                   const f = e.target.files[0];
                   if(!f) return;
                   const reader = new FileReader();
                   reader.onload = () => {
                       setGuideFileBase64(reader.result);
                       showAlert("✅ Guía adjuntada correctamente.");
                   };
                   reader.readAsDataURL(f);
                }}/>
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400"/>
                <span className="text-center">{guideFileBase64 ? 'GUÍA CARGADA (Toca para cambiar)' : 'ADJUNTAR PDF O FOTO'}</span>
             </label>
          </div>

          <button 
             onClick={async () => {
                if (!guideLink && !guideFileBase64) return showAlert("⚠️ Debes adjuntar la Guía (Link o Archivo) para poder cerrar el traslado.");
                setProcessingId(`guide-${guideUploadJob.id}`);
                try {
                   let finalUrl = guideLink;
                   if (guideFileBase64) {
                       const ext = guideFileBase64.includes('application/pdf') ? 'pdf' : 'jpg';
                       const storage = getStorage();
                       const fileRef = ref(storage, `checklists/${guideUploadJob.id}/guia_despacho_kovacs_${Date.now()}.${ext}`);
                       const metadata = { contentType: guideFileBase64.includes('application/pdf') ? 'application/pdf' : 'image/jpeg' };
                       await uploadString(fileRef, guideFileBase64, 'data_url', metadata);
                       finalUrl = await getDownloadURL(fileRef);
                   }

                   const draftData = guideUploadJob.draft?.formData || {};
                   const draftPhotos = draftData.photos || {};
                   const checklistPhotos = guideUploadJob.checklist?.photos || {};
                   const existingPhotos = { ...checklistPhotos, ...draftPhotos };

                   Object.entries(checklistPhotos).forEach(([k, v]) => {
                     if (typeof v === 'string' && v.startsWith('http')) {
                       existingPhotos[k] = v;
                     }
                   });

                   const newChecklist = { ...draftData, ...(guideUploadJob.checklist || {}), photos: existingPhotos };
                   if (guideLink) newChecklist.guiaDespachoLink = guideLink;
                   if (finalUrl && finalUrl !== guideLink) newChecklist.guiaDespachoPdf = finalUrl;

                   await updateDoc(doc(db, 'transport_jobs', guideUploadJob.id), {
                      status: 'completed',
                      checklist: newChecklist,
                      draft: deleteField()
                   });

                   notifyClient({ ...guideUploadJob, checklist: newChecklist, status: 'completed' }, 'finalizado');
                   showAlert("✅ Traslado finalizado y cliente notificado.");
                   setGuideUploadJob(null);
                } catch (e) {
                   console.error(e);
                   showAlert("❌ Error al subir la guía o cerrar el traslado.");
                } finally {
                   setProcessingId(null);
                }
             }} 
             disabled={processingId === `guide-${guideUploadJob.id}`} 
             className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
             {processingId === `guide-${guideUploadJob.id}` ? <Clock className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
             Finalizar Traslado
          </button>
       </div>
    </div>
  );
}
