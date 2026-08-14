import React from 'react';
import { FileText, X, MapPin, AlertCircle } from 'lucide-react';

export default function HistoryModal({
  selectedHistoryJob,
  setSelectedHistoryJob,
  getJobIdentifier,
  getRouteStr,
  vehicles,
  drivers,
  setFullScreenPhoto
}) {
  if (!selectedHistoryJob) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 cursor-default">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex justify-between items-start shrink-0 relative">
          <div className="flex gap-3 items-center">
            <div className="bg-blue-100 p-2.5 rounded-xl"><FileText className="w-6 h-6 text-blue-600"/></div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 leading-tight">Ficha Técnica</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {new Date(selectedHistoryJob.completedAt || selectedHistoryJob.createdAt).toLocaleString('es-CL')}
              </p>
            </div>
          </div>
          <button onClick={() => setSelectedHistoryJob(null)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-100 dark:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400"/>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          
          {/* 1. INFO VEHÍCULO */}
          <div>
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">1. Información del Vehículo</h4>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Marca / Modelo</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedHistoryJob.tripType === 'simple' ? selectedHistoryJob.description : `${selectedHistoryJob.brand} ${selectedHistoryJob.model}`}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Identificador</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">{getJobIdentifier(selectedHistoryJob)} {selectedHistoryJob.vin && selectedHistoryJob.vin !== getJobIdentifier(selectedHistoryJob) ? `(VIN: ${selectedHistoryJob.vin})` : ''}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Cliente</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedHistoryJob.client || 'Sin Cliente'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Conductor</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedHistoryJob.checklist?.assignedDriverName || drivers?.find(d => d.email === selectedHistoryJob.acceptedByEmail)?.name || selectedHistoryJob.acceptedByEmail}</p>
              </div>
            </div>
          </div>

          {/* 2. VIAJE Y KILOMETRAJE */}
          <div>
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">2. Ruta y Kilometraje</h4>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"/>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 break-words">{getRouteStr(selectedHistoryJob)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Odómetro Reportado</p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedHistoryJob.checklist?.mileage || 'No registrado'}</p>
                </div>
                {selectedHistoryJob.checklist?.keyLocation && (
                <div className="col-span-2">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Ubicación de Llaves</p>
                  <p className="text-sm font-black text-orange-600">
                     {selectedHistoryJob.checklist.keyLocation === 'puestas' ? 'Puestas' : 
                      selectedHistoryJob.checklist.keyLocation === 'puerta' ? 'En la puerta' :
                      selectedHistoryJob.checklist.keyLocation === 'mano' ? `Entregadas por mano a: ${selectedHistoryJob.checklist.keyHandedTo || ''}` : selectedHistoryJob.checklist.keyLocation}
                  </p>
                </div>
                )}
                <div className="col-span-2 mt-2">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Distancia GPS (Maps)</p>
                  <p className="text-sm font-black text-blue-600">{selectedHistoryJob.drivenDistance || 'No calculado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FECHAS VENCIMIENTO DOCUMENTOS */}
          {(() => {
             const ident = getJobIdentifier(selectedHistoryJob);
             let vDocs = selectedHistoryJob.checklist?.docsExpiry;
             if (!vDocs && vehicles && ident && ident !== 'S/N') {
                 const v = vehicles.find(x => x.plate === ident.toUpperCase());
                 if (v && v.docsExpiry) vDocs = v.docsExpiry;
             }
             if (!vDocs) return null;

             const formatExp = (dateStr) => {
                if (!dateStr) return <span className="text-slate-400 text-xs">No reg.</span>;
                const [y,m,d] = dateStr.split('-');
                const expDate = new Date(y, m-1, d);
                const today = new Date(); today.setHours(0,0,0,0);
                if (expDate < today) return <span className="text-red-600 font-bold text-xs">{d}/{m}/{y} (Vencido)</span>;
                return <span className="text-green-700 font-bold text-xs">{d}/{m}/{y}</span>;
             };

             return (
               <div>
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">3. Vencimiento Documentos</h4>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Rev. Técnica</p>{formatExp(vDocs.revTecnica)}</div>
                   <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Gases</p>{formatExp(vDocs.gases)}</div>
                   <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Permiso Circ.</p>{formatExp(vDocs.permiso)}</div>
                   <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-center"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">SOAP</p>{formatExp(vDocs.soap)}</div>
                 </div>
               </div>
             );
          })()}

          {/* NOTAS DE TRASLADO EN FICHA */}
          {selectedHistoryJob.checklist?.transitNotes && (
            <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-xl shadow-sm mb-4">
              <h4 className="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> Notas durante el traslado</h4>
              <p className="text-xs font-bold text-orange-800 italic">"{selectedHistoryJob.checklist.transitNotes}"</p>
            </div>
          )}

          {/* 4. RECEPCIÓN */}
          {selectedHistoryJob.checklist && (
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">4. Recepción</h4>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex-1 text-center sm:text-left w-full">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Recibido por</p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedHistoryJob.checklist.noReception ? 'Sin Recepción Formal' : (selectedHistoryJob.checklist.receiverName || selectedHistoryJob.receiverName || 'No registrado')}</p>
                  {(selectedHistoryJob.checklist.receiverRut || selectedHistoryJob.receiverRut) && <p className="text-xs font-bold text-slate-500 dark:text-slate-400">RUT: {selectedHistoryJob.checklist.receiverRut || selectedHistoryJob.receiverRut}</p>}
                  
                  {(selectedHistoryJob.checklist.clientComments || selectedHistoryJob.clientComments) && (
                     <div className="mt-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                       <p className="text-[9px] font-bold text-slate-400 uppercase">Comentarios</p>
                       <p className="text-xs font-bold text-slate-700 dark:text-slate-300 italic">"{(selectedHistoryJob.checklist.clientComments || selectedHistoryJob.clientComments)}"</p>
                     </div>
                  )}
                </div>
                
                {!selectedHistoryJob.checklist.noReception && (
                  <div className="p-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 shrink-0 flex flex-col items-center justify-center min-w-[140px] min-h-[80px] w-full sm:w-auto shadow-inner" style={{ backgroundColor: '#ffffff' }}>
                    {(selectedHistoryJob.checklist.signatureData || selectedHistoryJob.signatureData) ? (
                      <img src={selectedHistoryJob.checklist.signatureData || selectedHistoryJob.signatureData} alt="Firma" className="h-16 sm:h-20 object-contain drop-shadow-sm" />
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Firma no registrada</span>
                    )}
                    <p className="text-[8px] font-black uppercase mt-1 tracking-widest" style={{ color: '#cbd5e1' }}>Firma Digital</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. GALERÍA DE FOTOS */}
          {selectedHistoryJob.checklist?.photos && Object.values(selectedHistoryJob.checklist.photos).filter(p => typeof p === 'string' && p.startsWith('http')).length > 0 && (
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">5. Galería Fotográfica</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(selectedHistoryJob.checklist.photos).filter(([k,v]) => typeof v === 'string' && v.startsWith('http')).map(([k,v]) => (
                  <div key={k} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square cursor-pointer" onClick={() => setFullScreenPhoto(v)}>
                    <img src={v} alt={k} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-white text-[9px] font-black uppercase truncate">{k.replace('det', 'Detalle ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
