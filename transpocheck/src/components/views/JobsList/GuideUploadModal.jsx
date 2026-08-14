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
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
       <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col animate-in zoom-in-95 border-t-8 border-orange-500">
          <div className="flex justify-between items-start mb-4">
             <div>
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-orange-500"/> Subir Guía de Despacho</h3>
               <p className="text-xs font-bold text-slate-500 mt-1">
                  Finaliza el traslado adjuntando la guía firmada.
               </p>
             </div>
             <button onClick={()=>setGuideUploadJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5"/></button>
          </div>

          <div className="space-y-4 mb-6">
             <div className="space-y-1">
                <label className="text-[10px] font-black text-orange-700 uppercase tracking-widest ml-1">Enlace del Documento</label>
                <input type="url" placeholder="Ej: https://acrobat.adobe.com/..." value={guideLink} onChange={(e) => setGuideLink(e.target.value)} className="w-full border-2 border-orange-200 bg-white p-3 rounded-xl font-bold text-slate-700 text-sm outline-none focus:border-orange-500 transition-colors" />
             </div>

             <div className="flex items-center gap-2 my-2 opacity-60"><div className="h-px bg-orange-300 flex-1"></div><span className="text-[10px] font-black uppercase text-orange-500">O Subir Archivo PDF/Foto</span><div className="h-px bg-orange-300 flex-1"></div></div>

             <label className="w-full bg-white border-2 border-dashed border-orange-300 hover:bg-orange-50 text-orange-600 p-4 rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm">
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
                <FileText className="w-6 h-6"/>
                <span className="text-center">{guideFileBase64 ? '✅ GUÍA CARGADA (Toca para cambiar)' : 'ADJUNTAR PDF O FOTO'}</span>
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

                   const newChecklist = { ...(guideUploadJob.checklist || {}) };
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
             className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-black shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
             {processingId === `guide-${guideUploadJob.id}` ? <Clock className="w-5 h-5 animate-spin"/> : <CheckCircle className="w-5 h-5"/>}
             Finalizar Traslado
          </button>
       </div>
    </div>
  );
}
