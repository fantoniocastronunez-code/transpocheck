import React from 'react';
import { Camera, MapPin, Upload, XCircle, Search, Save, PenTool, CheckCircle, Clock, Trash2 } from 'lucide-react';
import InAppCamera from './InAppCamera';

export default function Step2Vehicle({ job, formData, setF, handleImageUpload, removeImage, fileInputRef, processingId, showDejaVuModal, setShowDejaVuModal, dejaVuData, handleAcceptDejaVu }) {
  return (
    <>
                {job.tripType === 'simple' && step === 2 && (() => {
            const isSpecialJob = job.isPintura || job.isGrabado;
            const reqPhotos = isSpecialJob ? ((job.qtyPintura || 0) + (job.qtyGrabado || 0)) : 4;
            const photoKeys = Array.from({ length: reqPhotos > 0 ? reqPhotos : 4 }, (_, i) => `det${i + 1}`);

            return (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Evidencia Fotográfica</h3>

                {isSpecialJob ? (
                  <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-2xl mb-4 shadow-sm">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Requisito Obligatorio</p>
                    <p className="text-sm font-bold text-purple-900 leading-tight">Se requieren <span className="font-black bg-purple-200 px-1.5 py-0.5 rounded">{reqPhotos} fotografías</span> individuales (Una por cada patente o vidrio trabajado).</p>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-500 mb-4">Añade al menos 1 fotografía que respalde el trabajo terminado.</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {photoKeys.map((photoId, idx) => {
                    let label = `Foto ${idx + 1}`;
                    if (isSpecialJob) {
                      if (idx < (job.qtyPintura || 0)) {
                        label = `Patente ${idx + 1}`;
                      } else {
                        label = `Vidrio ${(idx + 1) - (job.qtyPintura || 0)}`;
                      }
                    }

                    return (
                      <button type="button" key={photoId} onClick={() => handlePhotoClick(photoId, label)} className={`w-full h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden bg-white shadow-sm transition-all ${formData.photos[photoId] ? 'border-purple-400 ring-2 ring-purple-100' : 'border-dashed border-purple-300 hover:bg-purple-50'}`}>
                        {formData.photos[photoId] ? <><img src={formData.photos[photoId]} className="absolute inset-0 w-full h-full object-cover opacity-60" /><CheckCircle className="w-6 h-6 text-purple-600 relative z-10 bg-white rounded-full" /><span className="text-[10px] font-black text-purple-900 relative z-10 bg-white/80 px-2 rounded-md">{label}</span></> : <><Camera className="w-6 h-6 text-purple-400" /><span className="text-[10px] font-black text-purple-600 uppercase tracking-wide text-center leading-tight">{label}</span></>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
                {job.tripType !== 'simple' && step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-sm font-extrabold border-b border-slate-100 pb-2 text-slate-800 uppercase tracking-wider">Documentos del Vehículo</h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[{ id: 'soap', label: 'SOAP', icon: <FileText className="w-5 h-5" /> }, { id: 'permiso', label: 'Permiso Circ.', icon: <MapPin className="w-5 h-5" /> }, { id: 'revTecnica', label: 'Rev. Técnica', icon: <CheckCircle className="w-5 h-5" /> }, { id: 'gases', label: 'Gases', icon: <CloudOff className="w-5 h-5" /> }].map(doc => {
                  const isExp = checkIsExpired(formData.docsExpiry?.[doc.id]);
                  const isChecked = !!formData.docs[doc.id];

                  return (
                    <div key={doc.id} className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setF('docs', { ...formData.docs, [doc.id]: !isChecked })}
                        className={`flex flex-col items-center justify-center gap-1.5 h-24 rounded-2xl border-2 active:scale-95 transition-all duration-200 select-none shadow-sm ${!isChecked ? 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:border-slate-300' : isExp ? 'border-red-500 bg-red-500 text-white shadow-red-200' : 'border-green-500 bg-green-500 text-white shadow-green-200'}`}
                      >
                        {isChecked ? (isExp ? <AlertCircle className="w-6 h-6 animate-in zoom-in" /> : <CheckCircle className="w-6 h-6 animate-in zoom-in" />) : doc.icon}
                        <span className="font-black text-xs uppercase tracking-wider">{doc.label}</span>
                      </button>
                      {isChecked && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className={`${isExp ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border p-2 rounded-xl flex flex-col gap-1 shadow-inner transition-colors`}>
                            <p className={`text-[9px] font-extrabold uppercase tracking-widest text-center ${isExp ? 'text-red-700' : 'text-green-700'}`}>Vencimiento {isExp && '(VENCIDO)'}</p>
                            <input type="date" value={formData.docsExpiry?.[doc.id] || ''} onChange={(e) => setF('docsExpiry', { ...(formData.docsExpiry || {}), [doc.id]: e.target.value })} className={`w-full bg-white border p-1.5 rounded-lg text-xs font-black text-slate-700 outline-none text-center transition-colors ${isExp ? 'border-red-300 focus:border-red-500' : 'border-green-200 focus:border-green-500'}`} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* SECCIÓN DOCUMENTOS EXTERNOS Y BANDEJA */}
              <div className="mt-8 border-t-2 border-slate-100 pt-5">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500" /> Documentos Adicionales</h3>
                <p className="text-[10px] font-bold text-slate-500 mb-4 leading-tight">Si escaneaste con CamScanner o Adobe Scan, pega el link aquí o adjunta el PDF directamente.</p>

                <div className="space-y-4">

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Enlace / Link del Documento</label>
                    <div className="flex gap-2">
                      <input type="url" placeholder="Ej: https://acrobat.adobe.com/..." value={formData.scannerLink || ''} onChange={(e) => setF('scannerLink', e.target.value)} className="w-full border-2 border-indigo-100 bg-indigo-50/30 p-3 rounded-xl font-bold text-slate-700 text-sm outline-none focus:border-indigo-500 transition-colors" />
                      <button type="button" onClick={async () => {
                        if (!formData.scannerLink) return showAlert("⚠️ Pega un link primero.");
                        if (job.id === 'NEW_QUICK_JOB') return showAlert("⚠️ Debes 'Finalizar y Guardar' el acta abajo para poder notificar este link.");

                        showAlert("⏳ Guardando link y notificando al cliente...");
                        try {
                          const { updateDoc, doc, query, collection, where, getDocs } = await import('firebase/firestore');
                          const newChecklist = { ...(job.checklist || {}), scannerLink: formData.scannerLink };
                          await updateDoc(doc(db, 'transport_jobs', job.id), { checklist: newChecklist });

                          // Buscamos al cliente directo en la colección segura para sacar el correo real
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
                                    vehicle: job.tripType === 'simple' ? (job.description || 'Servicio en Terreno') : (`${job.brand || ''} ${job.model || ''}`.trim() || 'Vehículo'),
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
                        } catch (err) {
                          showAlert("❌ Error al guardar el link.");
                        }
                      }} className="bg-indigo-600 text-white px-4 rounded-xl font-black text-[10px] shadow-sm hover:bg-indigo-700 active:scale-95 transition-all flex flex-col items-center justify-center leading-tight">
                        <span>ENVIAR</span><span>AVISO</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 opacity-60"><div className="h-px bg-slate-300 flex-1"></div><span className="text-[10px] font-black uppercase text-slate-400">O Subir Archivo Físico</span><div className="h-px bg-slate-300 flex-1"></div></div>

                  <label className="w-full bg-white border-2 border-dashed border-indigo-300 hover:bg-indigo-50 text-indigo-600 p-4 rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm">
                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files[0];
                      if (!f) return;

                      // Prevención: Si es un trabajo nuevo, se sube normal al final
                      if (job.id === 'NEW_QUICK_JOB') {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setF('scandocPdf', reader.result);
                          showAlert("✅ Archivo adjuntado temporalmente. Se subirá y notificará al finalizar el acta.");
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

                            const metadata = { contentType: f.type };
                            await uploadString(fileRef, base64, 'data_url', metadata);
                            const url = await getDownloadURL(fileRef);

                            const { updateDoc, doc, query, collection, where, getDocs } = await import('firebase/firestore');
                            const newChecklist = { ...(job.checklist || {}), scandocPdf: url };
                            await updateDoc(doc(db, 'transport_jobs', job.id), { checklist: newChecklist });

                            setF('scandocPdf', url);

                            // Buscamos al cliente directo en la colección segura para sacar el correo real
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
                                      id: job.id === 'NEW_QUICK_JOB' ? 'N/A' : job.id,
                                      driverName: drivers?.find(x => x.email === currentUserEmail)?.name || currentUserEmail,
                                      vehicle: job.tripType === 'simple' ? (job.description || 'Servicio en Terreno') : (`${job.brand || ''} ${job.model || ''}`.trim() || 'Vehículo'),
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
                    }} />
                    <FileText className="w-6 h-6" />
                    <span className="text-center">{formData.scandocPdf ? '✅ ARCHIVO CARGADO (Toca para cambiar)' : 'ADJUNTAR PDF O FOTO Y NOTIFICAR AL CLIENTE'}</span>
                  </label>
                </div>

                {job.checklist?.scandocPdfInbox && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <p className="text-[11px] font-black text-emerald-800 uppercase tracking-tight">Doc. Asignado (Bandeja)</p>
                    </div>
                    <a href={job.checklist.scandocPdfInbox} target="_blank" rel="noreferrer" className="text-[10px] bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg font-bold shadow-sm hover:bg-emerald-500">VER PDF</a>
                  </div>
                )}
              </div>
            </div>
          )}
    </>
  );
}