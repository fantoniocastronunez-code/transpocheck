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
        const reader = new FileReader();
        reader.onload = () => {
          setF('docsPhotos', { ...(formData.docsPhotos || {}), [docId]: reader.result });
        };
        reader.readAsDataURL(compressed);
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

    </div>
  );
};
