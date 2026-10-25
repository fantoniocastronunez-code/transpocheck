import React, { useState, useEffect } from 'react';
import { FileText, X, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { db, storage } from '../../../firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

export default function HistoryModal({
  selectedHistoryJob,
  setSelectedHistoryJob,
  getJobIdentifier,
  getRouteStr,
  vehicles,
  drivers,
  setFullScreenPhoto
}) {
  const [storagePhotos, setStoragePhotos] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    if (!selectedHistoryJob?.id) {
      setStoragePhotos({});
      return;
    }

    const currentPhotos = selectedHistoryJob.checklist?.photos || {};
    const hasPickupOdo = Boolean(currentPhotos.pickup_odo || currentPhotos.mileage || currentPhotos.pickupOdometer);
    const hasArrivalOdo = Boolean(currentPhotos.arrival_odo || (selectedHistoryJob.status === 'completed' && currentPhotos.odometer) || currentPhotos.arrivalOdometer);
    const hasPickupFuel = Boolean(currentPhotos.pickup_fuel || currentPhotos.fuel || currentPhotos.pickupFuel);
    const hasArrivalFuel = Boolean(currentPhotos.arrival_fuel || (selectedHistoryJob.status === 'completed' && currentPhotos.fuelGauge) || currentPhotos.arrivalFuel);

    // Si ya tiene las 4 fotos con URL válida, no es necesario consultar Storage
    if (hasPickupOdo && hasArrivalOdo && hasPickupFuel && hasArrivalFuel) {
      setStoragePhotos({});
      return;
    }

    let isMounted = true;
    const fetchStoragePhotos = async () => {
      try {
        setLoadingPhotos(true);
        const folderRef = ref(storage, `checklists/${selectedHistoryJob.id}`);
        const listResult = await listAll(folderRef);
        if (!isMounted) return;

        const resolved = {};
        for (const item of listResult.items) {
          const lowerName = item.name.toLowerCase();
          if (lowerName.startsWith('pickup_odo')) {
            resolved.pickup_odo = await getDownloadURL(item);
          } else if (lowerName.startsWith('pickup_fuel')) {
            resolved.pickup_fuel = await getDownloadURL(item);
          } else if (lowerName.startsWith('arrival_odo')) {
            resolved.arrival_odo = await getDownloadURL(item);
          } else if (lowerName.startsWith('arrival_fuel')) {
            resolved.arrival_fuel = await getDownloadURL(item);
          }
        }

        if (isMounted) {
          setStoragePhotos(resolved);

          // Sincronizar en segundo plano con Firestore para que queden guardadas de forma permanente (solo llaves canónicas)
          const updates = {};
          if (resolved.pickup_odo && !currentPhotos.pickup_odo) updates['checklist.photos.pickup_odo'] = resolved.pickup_odo;
          if (resolved.pickup_fuel && !currentPhotos.pickup_fuel) updates['checklist.photos.pickup_fuel'] = resolved.pickup_fuel;
          if (resolved.arrival_odo && !currentPhotos.arrival_odo) updates['checklist.photos.arrival_odo'] = resolved.arrival_odo;
          if (resolved.arrival_fuel && !currentPhotos.arrival_fuel) updates['checklist.photos.arrival_fuel'] = resolved.arrival_fuel;

          if (Object.keys(updates).length > 0) {
            updateDoc(doc(db, 'transport_jobs', selectedHistoryJob.id), updates).catch(err => {
              console.warn("[ERR-SYNC-STORAGE-PHOTOS-01]", err);
            });
          }
        }
      } catch (err) {
        console.warn("[ERR-RESOLVE-STORAGE-PHOTOS-02]", err);
      } finally {
        if (isMounted) setLoadingPhotos(false);
      }
    };

    fetchStoragePhotos();

    return () => { isMounted = false; };
  }, [selectedHistoryJob?.id]);

  if (!selectedHistoryJob) return null;

  const chkPhotos = selectedHistoryJob.checklist?.photos || {};

  const pickupOdoImg = storagePhotos.pickup_odo 
    || chkPhotos.pickup_odo 
    || chkPhotos.mileage 
    || chkPhotos.pickupOdometer 
    || chkPhotos.dashboardInitial
    || (chkPhotos.dashboard && chkPhotos.dashboard !== (storagePhotos.arrival_odo || chkPhotos.arrival_odo || chkPhotos.odometer) ? chkPhotos.dashboard : null)
    || (selectedHistoryJob.status !== 'completed' ? chkPhotos.odometer : null);

  const arrivalOdoImg = storagePhotos.arrival_odo 
    || chkPhotos.arrival_odo 
    || chkPhotos.arrivalOdometer 
    || (selectedHistoryJob.status === 'completed' ? chkPhotos.odometer : null)
    || (chkPhotos.dashboard && chkPhotos.dashboard !== pickupOdoImg ? chkPhotos.dashboard : null);

  const pickupFuelImg = storagePhotos.pickup_fuel 
    || chkPhotos.pickup_fuel 
    || chkPhotos.fuel 
    || chkPhotos.pickupFuel 
    || (selectedHistoryJob.status !== 'completed' ? chkPhotos.fuelGauge : null);

  const arrivalFuelImg = storagePhotos.arrival_fuel 
    || chkPhotos.arrival_fuel 
    || chkPhotos.arrivalFuel 
    || (selectedHistoryJob.status === 'completed' ? chkPhotos.fuelGauge : null);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 cursor-default">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex justify-between items-start shrink-0 relative">
          <div className="flex gap-3 items-center">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2.5 rounded-xl"><FileText className="w-6 h-6 text-blue-600 dark:text-blue-400"/></div>
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
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
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
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"/>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 break-words">{getRouteStr(selectedHistoryJob)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                {/* Odómetro Inicio */}
                <div>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Odómetro Inicio</p>
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-none">
                       {selectedHistoryJob.checklist?.mileage || 'No registrado'}
                    </p>
                    {pickupOdoImg ? (
                       <img 
                         src={pickupOdoImg} 
                         alt="Odómetro Inicio" 
                         className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shadow-sm" 
                         onClick={() => setFullScreenPhoto ? setFullScreenPhoto(pickupOdoImg) : window.open(pickupOdoImg, '_blank')} 
                       />
                    ) : loadingPhotos ? (
                       <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                         <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                       </div>
                    ) : null}
                  </div>
                </div>

                {/* Odómetro Fin */}
                <div>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Odómetro Fin</p>
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-none">
                       {selectedHistoryJob.checklist?.arrivalMileage || 'No registrado'}
                    </p>
                    {arrivalOdoImg ? (
                       <img 
                         src={arrivalOdoImg} 
                         alt="Odómetro Fin" 
                         className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shadow-sm" 
                         onClick={() => setFullScreenPhoto ? setFullScreenPhoto(arrivalOdoImg) : window.open(arrivalOdoImg, '_blank')} 
                       />
                    ) : loadingPhotos ? (
                       <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                         <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                       </div>
                    ) : null}
                  </div>
                </div>

                {/* Combustible Inicio */}
                <div>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Comb. Inicio</p>
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-none">
                       {selectedHistoryJob.checklist?.fuelLevel !== undefined ? `${Math.round(selectedHistoryJob.checklist.fuelLevel <= 1 && selectedHistoryJob.checklist.fuelLevel !== 0 ? selectedHistoryJob.checklist.fuelLevel * 100 : selectedHistoryJob.checklist.fuelLevel)}%` : 'No registrado'}
                    </p>
                    {pickupFuelImg ? (
                       <img 
                         src={pickupFuelImg} 
                         alt="Combustible Inicio" 
                         className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shadow-sm" 
                         onClick={() => setFullScreenPhoto ? setFullScreenPhoto(pickupFuelImg) : window.open(pickupFuelImg, '_blank')} 
                       />
                    ) : loadingPhotos ? (
                       <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                         <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                       </div>
                    ) : null}
                  </div>
                </div>

                {/* Combustible Fin */}
                <div>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Comb. Fin</p>
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-none">
                       {selectedHistoryJob.checklist?.arrivalFuelLevel !== undefined ? `${Math.round(selectedHistoryJob.checklist.arrivalFuelLevel <= 1 && selectedHistoryJob.checklist.arrivalFuelLevel !== 0 ? selectedHistoryJob.checklist.arrivalFuelLevel * 100 : selectedHistoryJob.checklist.arrivalFuelLevel)}%` : 'No registrado'}
                    </p>
                    {arrivalFuelImg ? (
                       <img 
                         src={arrivalFuelImg} 
                         alt="Combustible Fin" 
                         className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity shadow-sm" 
                         onClick={() => setFullScreenPhoto ? setFullScreenPhoto(arrivalFuelImg) : window.open(arrivalFuelImg, '_blank')} 
                       />
                    ) : loadingPhotos ? (
                       <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                         <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                       </div>
                    ) : null}
                  </div>
                </div>

                <div className="col-span-2 mt-2">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Distancia GPS (Maps)</p>
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400">{selectedHistoryJob.drivenDistance || 'No calculado'}</p>
                </div>
                {(selectedHistoryJob.checklist?.photos?.fuelGaugeLocation || selectedHistoryJob.checklist?.photos?.odometerLocation || selectedHistoryJob.checklist?.location) && (
                <div className="col-span-2 mt-2">
                  <a 
                    href={`https://maps.google.com/?q=${(selectedHistoryJob.checklist?.photos?.fuelGaugeLocation || selectedHistoryJob.checklist?.photos?.odometerLocation || selectedHistoryJob.checklist?.location).lat},${(selectedHistoryJob.checklist?.photos?.fuelGaugeLocation || selectedHistoryJob.checklist?.photos?.odometerLocation || selectedHistoryJob.checklist?.location).lng}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 px-4 rounded-xl font-extrabold text-xs transition-colors border border-slate-200 dark:border-slate-700 shadow-sm w-full text-center"
                  >
                    <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Reporte de kilometraje y combustible tomado acá</span>
                  </a>
                </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. FECHAS VENCIMIENTO DOCUMENTOS */}
          {(() => {
             const ident = getJobIdentifier(selectedHistoryJob);
             let vDocs = selectedHistoryJob.checklist?.docsExpiry;
             const v = (vehicles && ident && ident !== 'S/N') ? vehicles.find(x => x.plate === ident.toUpperCase()) : null;
             if (!vDocs && v && v.docsExpiry) vDocs = v.docsExpiry;
             if (!vDocs) return null;

             const formatExp = (dateStr) => {
                if (!dateStr) return <span className="text-slate-400 text-xs">No reg.</span>;
                const [y,m] = dateStr.split('-');
                const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
                const monthStr = monthNames[parseInt(m, 10) - 1] || m;
                const today = new Date();
                const isExpired = parseInt(y, 10) < today.getFullYear() || (parseInt(y, 10) === today.getFullYear() && parseInt(m, 10) - 1 < today.getMonth());
                if (isExpired) return <span className="text-red-600 dark:text-red-400 font-bold text-xs">{monthStr} {y} (Vencido)</span>;
                return <span className="text-green-700 dark:text-green-400 font-bold text-xs">{monthStr} {y}</span>;
             };

             const docPhotos = { ...(v?.docsPhotos || {}), ...(selectedHistoryJob.checklist?.docsPhotos || {}) };
             const docItems = [
               { id: 'revTecnica', name: 'Rev. Técnica' },
               { id: 'gases', name: 'Gases' },
               { id: 'permiso', name: 'Permiso Circ.' },
               { id: 'soap', name: 'SOAP' }
             ];

             return (
               <div>
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">3. Vencimiento Documentos</h4>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   {docItems.map(({ id, name }) => {
                     const photoUrl = docPhotos[id];
                     return (
                       <div key={id} className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center flex flex-col justify-between">
                         <div>
                           <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">{name}</p>
                           {formatExp(vDocs[id])}
                         </div>
                         {photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http') && (
                           <button 
                             type="button" 
                             onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(photoUrl); }}
                             className="mt-2 text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center justify-center gap-1 bg-blue-50 dark:bg-blue-900/30 py-1 px-1.5 rounded-lg border border-blue-200 dark:border-blue-800/40 transition-colors"
                           >
                             <FileText className="w-3 h-3"/> Ver Foto
                           </button>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </div>
             );
          })()}

          {/* NOTAS DE TRASLADO EN FICHA */}
          {selectedHistoryJob.checklist?.transitNotes && (
            <div className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-200 dark:border-orange-800/50 p-4 rounded-xl shadow-sm mb-4">
              <h4 className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-widest mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> Notas durante el traslado</h4>
              <p className="text-xs font-bold text-orange-800 dark:text-orange-300 italic">"{selectedHistoryJob.checklist.transitNotes}"</p>
            </div>
          )}

          {/* DETALLES Y OBSERVACIONES DE LA REVISIÓN */}
          {(selectedHistoryJob.checklist?.observations || selectedHistoryJob.checklist?.carDamages) && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm mb-4">
              <h4 className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4"/> Detalles y Observaciones de la Revisión
              </h4>
              {selectedHistoryJob.checklist?.observations ? (
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 italic">
                  "{selectedHistoryJob.checklist.observations}"
                </p>
              ) : (
                <p className="text-xs font-medium text-slate-400 italic">Sin observaciones de texto adicionales.</p>
              )}

              {/* Inspección por zonas si hay daños marcados */}
              {selectedHistoryJob.checklist?.carDamages && (() => {
                const damagedZones = Object.entries(selectedHistoryJob.checklist.carDamages)
                  .filter(([_, d]) => d && d.status && d.status !== 'ok');
                if (damagedZones.length === 0) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      Inspección de Daños:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {damagedZones.map(([zone, d]) => (
                        <div key={zone} className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 block">
                              {zone}: {d.status}
                            </span>
                            {d.notes && (
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 italic block mt-0.5">
                                "{d.notes}"
                              </span>
                            )}
                          </div>
                          {d.photo && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(d.photo); }}
                              className="shrink-0 text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded border border-blue-200 dark:border-blue-800"
                            >
                              Ver Foto
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 4. RECEPCIÓN */}
          {selectedHistoryJob.checklist && (
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">4. Recepción</h4>
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
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

          {/* 5. GALERÍA DE FOTOS (CON DEDUPLICACIÓN INTELIGENTE DE FOTOS Y ALIASES) */}
          {(() => {
            const ident = getJobIdentifier(selectedHistoryJob);
            const v = (vehicles && ident && ident !== 'S/N') ? vehicles.find(x => x.plate === ident.toUpperCase()) : null;
            const docPhotos = { ...(v?.docsPhotos || {}), ...(selectedHistoryJob.checklist?.docsPhotos || {}) };
            const damagePhotos = {};
            if (selectedHistoryJob.checklist?.carDamages) {
              for (const [zone, d] of Object.entries(selectedHistoryJob.checklist.carDamages)) {
                if (d?.photo && typeof d.photo === 'string' && d.photo.startsWith('http')) {
                  damagePhotos[`damage_${zone}`] = d.photo;
                }
              }
            }
            const allPhotos = { ...(selectedHistoryJob.checklist?.photos || {}), ...storagePhotos, ...docPhotos, ...damagePhotos };
            
            const photoLabels = { 
              pickup_odo: 'Odómetro Inicio',
              pickup_fuel: 'Comb. Inicio',
              arrival_odo: 'Odómetro Fin',
              arrival_fuel: 'Comb. Fin',
              front: 'Frente', 
              back: 'Atrás', 
              left: 'Lat. Piloto', 
              right: 'Lat. Copiloto', 
              left_cab: 'Lat. Cabina Piloto', 
              left_body: 'Lat. Carroc. Piloto', 
              right_cab: 'Lat. Cabina Copiloto', 
              right_body: 'Lat. Carroc. Copiloto', 
              dashboard: 'Tablero', 
              tire: 'Repuesto', 
              interior_front: 'Int. Adelante', 
              interior_back: 'Int. Atrás', 
              vin: 'Nro Chasis', 
              fuelGauge: 'Med. Combustible', 
              odometer: selectedHistoryJob.status === 'completed' ? 'Odómetro Fin' : 'Odómetro Inicio', 
              mileage: 'Odómetro Inicio', 
              fuel: 'Comb. Inicio',
              pickupOdometer: 'Odómetro Inicio',
              arrivalOdometer: 'Odómetro Fin',
              pickupFuel: 'Comb. Inicio',
              arrivalFuel: 'Comb. Fin',
              dashboardInitial: 'Odómetro Inicio',
              permiso: 'Permiso Circ.', 
              soap: 'Seguro SOAP', 
              revTecnica: 'Rev. Técnica', 
              gases: 'Gases',
              damage_luces: 'Daño: Luces',
              damage_neumaticos: 'Daño: Neumáticos',
              damage_carroceria: 'Daño: Carrocería',
              damage_parabrisas: 'Daño: Parabrisas'
            };

            const keyPriority = {
              pickup_odo: 100, arrival_odo: 100, pickup_fuel: 100, arrival_fuel: 100,
              front: 90, back: 90, left: 90, right: 90, left_cab: 90, right_cab: 90, left_body: 90, right_body: 90,
              damage_luces: 88, damage_neumaticos: 88, damage_carroceria: 88, damage_parabrisas: 88,
              dashboard: 85, tire: 85, interior_front: 85, interior_back: 85, vin: 85,
              permiso: 80, soap: 80, revTecnica: 80, gases: 80,
              fuelGauge: 70, odometer: 70, mileage: 60, fuel: 60,
              pickupOdometer: 50, arrivalOdometer: 50, pickupFuel: 50, arrivalFuel: 50, dashboardInitial: 40
            };

            // DEDUPLICACIÓN: Mapear por URL única para evitar mostrar la misma foto repetida por aliases
            const uniquePhotosMap = new Map();
            for (const [k, url] of Object.entries(allPhotos)) {
              if (typeof url !== 'string' || !url.startsWith('http')) continue;
              const existing = uniquePhotosMap.get(url);
              const score = keyPriority[k] || 10;
              if (!existing || score > existing.score) {
                uniquePhotosMap.set(url, { key: k, url, score, label: photoLabels[k] || k.replace('det', 'Detalle ') });
              }
            }

            const uniquePhotosList = Array.from(uniquePhotosMap.values());
            if (uniquePhotosList.length === 0) return null;

            return (
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">5. Galería Fotográfica</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {uniquePhotosList.map(({ key: k, url: v, label }) => {
                  return (
                    <div key={v} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square cursor-pointer" onClick={() => setFullScreenPhoto(v)}>
                      <img src={v} alt={label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-white text-[9px] font-black uppercase truncate">{label}</p>
                      </div>
                      {k === 'fuelGauge' && selectedHistoryJob.checklist?.photos?.fuelGaugeLocation && (
                        <a href={`https://maps.google.com/?q=${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lat},${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-md transition-colors">📍 Mapa</a>
                      )}
                      {k === 'mileage' && selectedHistoryJob.checklist?.photos?.mileageLocation && (
                        <a href={`https://maps.google.com/?q=${selectedHistoryJob.checklist.photos.mileageLocation.lat},${selectedHistoryJob.checklist.photos.mileageLocation.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-md transition-colors">📍 Mapa</a>
                      )}
                      {k === 'odometer' && selectedHistoryJob.checklist?.photos?.odometerLocation && (
                        <a href={`https://maps.google.com/?q=${selectedHistoryJob.checklist.photos.odometerLocation.lat},${selectedHistoryJob.checklist.photos.odometerLocation.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-md transition-colors">📍 Mapa</a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );})()}

        </div>
      </div>
    </div>
  );
}
