import React from 'react';
import { FileText, MapPin, CheckCircle, CloudOff, AlertCircle } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import { FormattedMonthInput } from '../../../ui/FormattedMonthInput';

export const StepDocs = () => {
  const { job, formData, setF, showAlert, currentUserEmail, drivers, db } = useChecklist();

  // Helper to check expiry
  const checkIsExpired = (dateStr) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parts.length === 2) {
      const exp = new Date(parts[0], parts[1], 0);
      return exp < today;
    } else {
      const [y, m, day] = parts;
      if (!y || !m || !day) return false;
      const exp = new Date(y, m - 1, day);
      return exp < today;
    }
  };

  const handleUploadDirectPdf = async (e) => {
    const f = e.target.files[0];
    if (!f) return;

    if (job?.id === 'NEW_QUICK_JOB') {
      const reader = new FileReader();
      reader.onload = () => {
        setF('scandocPdf', reader.result);
        showAlert("✅ Archivo adjuntado temporalmente. Se subirá al finalizar el acta.");
      };
      reader.readAsDataURL(f);
      return;
    }

    showAlert("⏳ Subiendo documento y notificando al cliente...");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const ext = f.type.includes('pdf') ? 'pdf' : 'jpg';

          const { getStorage, ref, uploadString, getDownloadURL } = await import('firebase/storage');
          const storage = getStorage();
          const fileRef = ref(storage, `checklists/${job.id}/documento_PRT_directo_${Date.now()}.${ext}`);

          await uploadString(fileRef, base64, 'data_url', { contentType: f.type });
          const url = await getDownloadURL(fileRef);

          const { updateDoc, doc, query, collection, where, getDocs } = await import('firebase/firestore');
          const newChecklist = { ...(job.checklist || {}), scandocPdf: url };
          await updateDoc(doc(db, 'transport_jobs', job.id), { checklist: newChecklist });

          setF('scandocPdf', url);

          // Buscar cliente y notificar
          const qClient = query(collection(db, 'clients'), where('name', '==', job.client || ''));
          const snapClient = await getDocs(qClient);

          if (!snapClient.empty) {
            const clientRecord = snapClient.docs[0].data();
            const targetEmail = clientRecord.email?.split(',')[0]?.trim();

            if (targetEmail) {
              fetch('/api/notify-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: targetEmail,
                  clientName: clientRecord.name,
                  type: 'revision_tecnica',
                  jobDetails: {
                    id: job.id,
                    driverName: drivers?.find(x => x.email === currentUserEmail)?.name || currentUserEmail,
                    vehicle: `${job.brand || ''} ${job.model || ''}`.trim() || 'Vehículo',
                    plate: job.plate || job.vin || job.associatedPlate || 'S/N',
                    origin: job.origin || 'Origen',
                    destination: job.destination || 'Destino',
                    checklist: newChecklist
                  }
                })
              }).catch((err) => console.error("Error enviando correo:", err));
            }
          }

          showAlert("✅ Documento guardado y cliente notificado exitosamente.");
        } catch (uploadError) {
          console.error(uploadError);
          showAlert("❌ Error al subir y notificar.");
        }
      };
      reader.readAsDataURL(f);
    } catch (err) {
      showAlert("❌ Error al leer el documento.");
    }
  };

  const docsConfig = [
    { id: 'soap', label: 'SOAP', icon: <FileText className="w-6 h-6" /> }, 
    { id: 'permiso', label: 'Permiso Circ.', icon: <MapPin className="w-6 h-6" /> }, 
    { id: 'revTecnica', label: 'Rev. Técnica', icon: <CheckCircle className="w-6 h-6" /> }, 
    { id: 'gases', label: 'Gases', icon: <CloudOff className="w-6 h-6" /> }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Grid de Documentos Físicos */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4">
          Estado de Documentos
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {docsConfig.map(doc => {
            const isExp = checkIsExpired(formData.docsExpiry?.[doc.id]);
            const isChecked = !!formData.docs[doc.id];

            return (
              <div key={doc.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setF('docs', { ...formData.docs, [doc.id]: !isChecked })}
                  className={`flex flex-col items-center justify-center gap-2 h-28 rounded-2xl border-2 active:scale-95 transition-all duration-200 select-none shadow-sm 
                  ${!isChecked 
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800' 
                    : isExp 
                      ? 'border-red-400 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/20' 
                      : 'border-green-400 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-500/20'
                  }`}
                >
                  {isChecked 
                    ? (isExp ? <AlertCircle className="w-7 h-7 animate-in zoom-in" /> : <CheckCircle className="w-7 h-7 animate-in zoom-in" />) 
                    : doc.icon
                  }
                  <span className="font-black text-[11px] uppercase tracking-wider">{doc.label}</span>
                </button>
                
                {isChecked && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className={`${isExp ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/30' : 'bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/30'} border p-3 rounded-2xl flex flex-col gap-2 shadow-inner transition-colors`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest text-center ${isExp ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        Vencimiento {isExp && '(VENCIDO)'}
                      </p>
                      <FormattedMonthInput 
                        value={(formData.docsExpiry?.[doc.id] || '').substring(0, 7)} 
                        onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} 
                        isExp={isExp} 
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* SECCIÓN DOCUMENTOS EXTERNOS Y BANDEJA */}
      <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-800/30 shadow-sm">
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

                  showAlert("⏳ Guardando link y notificando al cliente...");
                  try {
                    const { updateDoc, doc, query, collection, where, getDocs } = await import('firebase/firestore');
                    const newChecklist = { ...(job.checklist || {}), scannerLink: formData.scannerLink };
                    await updateDoc(doc(db, 'transport_jobs', job.id), { checklist: newChecklist });

                    // Buscar cliente y notificar
                    const qClient = query(collection(db, 'clients'), where('name', '==', job.client || ''));
                    const snapClient = await getDocs(qClient);

                    if (!snapClient.empty) {
                      const clientRecord = snapClient.docs[0].data();
                      const targetEmail = clientRecord.email?.split(',')[0]?.trim();

                      if (targetEmail) {
                        fetch('/api/notify-client', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: targetEmail,
                            clientName: clientRecord.name,
                            type: 'revision_tecnica',
                            jobDetails: {
                              id: job.id,
                              driverName: drivers?.find(x => x.email === currentUserEmail)?.name || currentUserEmail,
                              vehicle: `${job.brand || ''} ${job.model || ''}`.trim() || 'Vehículo',
                              plate: job.plate || job.vin || job.associatedPlate || 'S/N',
                              origin: job.origin || 'Origen',
                              destination: job.destination || 'Destino',
                              checklist: newChecklist
                            }
                          })
                        }).catch((err) => console.error("Error enviando correo:", err));
                      }
                    }

                    showAlert("✅ Link guardado y cliente notificado exitosamente.");
                  } catch (error) {
                    console.error(error);
                    showAlert("❌ Error al guardar y notificar.");
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
              onChange={handleUploadDirectPdf} 
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
