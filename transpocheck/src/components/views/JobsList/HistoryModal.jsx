import React, { useState, useEffect } from 'react';
import { FileText, X, MapPin, AlertCircle, Loader2, Receipt, CheckSquare, Check, CheckCircle, Wrench, Copy, Fuel, User, Clock, Camera } from 'lucide-react';
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
  setFullScreenPhoto,
  cpyWapp
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
    <div className="fixed inset-0 bg-slate-950/75 z-[300] flex items-center justify-center p-4 cursor-default">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-lg overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-start shrink-0 relative">
          <div className="flex gap-3 items-center">
            <div className="bg-blue-50 dark:bg-blue-950/50 p-2 rounded-md border border-blue-200 dark:border-blue-800/60"><FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">Ficha Técnica</h3>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {new Date(selectedHistoryJob.completedAt || selectedHistoryJob.createdAt).toLocaleString('es-CL')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cpyWapp && (
              <button
                onClick={() => cpyWapp(selectedHistoryJob)}
                className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                title="Copiar Resumen para WhatsApp"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setSelectedHistoryJob(null)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">

          {/* 1. INFO VEHÍCULO */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">1. Información del Vehículo</h4>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-md border border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Marca / Modelo</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedHistoryJob.tripType === 'simple' ? selectedHistoryJob.description : `${selectedHistoryJob.brand} ${selectedHistoryJob.model}`}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Identificador</p>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{getJobIdentifier(selectedHistoryJob)} {selectedHistoryJob.vin && selectedHistoryJob.vin !== getJobIdentifier(selectedHistoryJob) ? `(VIN: ${selectedHistoryJob.vin})` : ''}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Cliente</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{selectedHistoryJob.client || 'Sin Cliente'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Conductor</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{selectedHistoryJob.checklist?.assignedDriverName || drivers?.find(d => d.email === selectedHistoryJob.acceptedByEmail)?.name || selectedHistoryJob.acceptedByEmail}</p>
              </div>
            </div>
          </div>

          {/* 2. VIAJE Y KILOMETRAJE */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">2. Ruta y Kilometraje</h4>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-md border border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 break-words">{getRouteStr(selectedHistoryJob)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                {String(selectedHistoryJob.vehicleType || selectedHistoryJob.checklist?.vehicleType || '').toLowerCase().includes('arrastre') ? (
                  <div className="col-span-2 sm:col-span-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-2.5 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Carro de Arrastre: Unidad exenta de registro de kilometraje y combustible</span>
                  </div>
                ) : (
                  <>
                    {/* Odómetro Inicio */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Odómetro Inicio</p>
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 leading-none">
                          {selectedHistoryJob.checklist?.mileage || 'No registrado'}
                        </p>
                        {pickupOdoImg ? (
                          <img
                            src={pickupOdoImg}
                            alt="Odómetro Inicio"
                            className="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setFullScreenPhoto ? setFullScreenPhoto(pickupOdoImg) : window.open(pickupOdoImg, '_blank')}
                          />
                        ) : loadingPhotos ? (
                          <div className="w-16 h-16 rounded-md border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Odómetro Fin */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Odómetro Fin</p>
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 leading-none">
                          {selectedHistoryJob.checklist?.arrivalMileage || 'No registrado'}
                        </p>
                        {arrivalOdoImg ? (
                          <img
                            src={arrivalOdoImg}
                            alt="Odómetro Fin"
                            className="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setFullScreenPhoto ? setFullScreenPhoto(arrivalOdoImg) : window.open(arrivalOdoImg, '_blank')}
                          />
                        ) : loadingPhotos ? (
                          <div className="w-16 h-16 rounded-md border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Combustible Inicio */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Comb. Inicio</p>
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 leading-none">
                          {selectedHistoryJob.checklist?.fuelLevel !== undefined ? `${Math.round(selectedHistoryJob.checklist.fuelLevel <= 1 && selectedHistoryJob.checklist.fuelLevel !== 0 ? selectedHistoryJob.checklist.fuelLevel * 100 : selectedHistoryJob.checklist.fuelLevel)}%` : 'No registrado'}
                        </p>
                        {pickupFuelImg ? (
                          <img
                            src={pickupFuelImg}
                            alt="Combustible Inicio"
                            className="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setFullScreenPhoto ? setFullScreenPhoto(pickupFuelImg) : window.open(pickupFuelImg, '_blank')}
                          />
                        ) : loadingPhotos ? (
                          <div className="w-16 h-16 rounded-md border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Combustible Fin */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Comb. Fin</p>
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 leading-none">
                          {selectedHistoryJob.checklist?.arrivalFuelLevel !== undefined ? `${Math.round(selectedHistoryJob.checklist.arrivalFuelLevel <= 1 && selectedHistoryJob.checklist.arrivalFuelLevel !== 0 ? selectedHistoryJob.checklist.arrivalFuelLevel * 100 : selectedHistoryJob.checklist.arrivalFuelLevel)}%` : 'No registrado'}
                        </p>
                        {arrivalFuelImg ? (
                          <img
                            src={arrivalFuelImg}
                            alt="Combustible Fin"
                            className="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setFullScreenPhoto ? setFullScreenPhoto(arrivalFuelImg) : window.open(arrivalFuelImg, '_blank')}
                          />
                        ) : loadingPhotos ? (
                          <div className="w-16 h-16 rounded-md border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}

                <div className="col-span-2 mt-2">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Distancia GPS (Maps)</p>
                  <p className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{selectedHistoryJob.drivenDistance || 'No calculado'}</p>
                </div>
                {(selectedHistoryJob.checklist?.photos?.fuelGaugeLocation || selectedHistoryJob.checklist?.photos?.odometerLocation || selectedHistoryJob.checklist?.location) && (
                  <div className="col-span-2 mt-2">
                    <a
                      href={`https://maps.google.com/?q=${(selectedHistoryJob.checklist?.photos?.fuelGaugeLocation || selectedHistoryJob.checklist?.photos?.odometerLocation || selectedHistoryJob.checklist?.location).lat},${(selectedHistoryJob.checklist?.photos?.fuelGaugeLocation || selectedHistoryJob.checklist?.photos?.odometerLocation || selectedHistoryJob.checklist?.location).lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 px-3 rounded-md font-semibold text-xs transition-colors border border-slate-200 dark:border-slate-700 w-full text-center"
                    >
                      <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Ver ubicación GPS del reporte</span>
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
              const [y, m] = dateStr.split('-');
              const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
              const monthStr = monthNames[parseInt(m, 10) - 1] || m;
              const today = new Date();
              const isExpired = parseInt(y, 10) < today.getFullYear() || (parseInt(y, 10) === today.getFullYear() && parseInt(m, 10) - 1 < today.getMonth());
              if (isExpired) return <span className="text-red-600 dark:text-red-400 font-mono font-semibold text-xs">{monthStr} {y} (Vencido)</span>;
              return <span className="text-emerald-700 dark:text-emerald-400 font-mono font-semibold text-xs">{monthStr} {y}</span>;
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
                <h4 className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">3. Vencimiento Documentos</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {docItems.map(({ id, name }) => {
                    const photoUrl = docPhotos[id];
                    return (
                      <div key={id} className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-md border border-slate-200 dark:border-slate-800 text-center flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">{name}</p>
                          {formatExp(vDocs[id])}
                        </div>
                        {photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http') && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(photoUrl); }}
                            className="mt-2 text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center justify-center gap-1 bg-blue-50 dark:bg-blue-950/40 py-1 px-1.5 rounded border border-blue-200 dark:border-blue-800/60 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> Ver Foto
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
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-md mb-4">
              <h4 className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-400 tracking-wider mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Notas durante el traslado</h4>
              <p className="text-xs font-medium text-amber-900 dark:text-amber-300">"{selectedHistoryJob.checklist.transitNotes}"</p>
            </div>
          )}

          {/* DETALLES Y OBSERVACIONES DE LA REVISIÓN */}
          {(selectedHistoryJob.checklist?.observations || selectedHistoryJob.checklist?.carDamages) && (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-md mb-4">
              <h4 className="text-[11px] font-semibold uppercase text-blue-600 dark:text-blue-400 tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Detalles y Observaciones de la Revisión
              </h4>
              {selectedHistoryJob.checklist?.observations ? (
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800">
                  "{selectedHistoryJob.checklist.observations}"
                </p>
              ) : (
                <p className="text-xs text-slate-400">Sin observaciones de texto adicionales.</p>
              )}

              {selectedHistoryJob.checklist?.carDamages && (() => {
                const damagedZones = Object.entries(selectedHistoryJob.checklist.carDamages)
                  .filter(([_, d]) => d && d.status && d.status !== 'ok');
                if (damagedZones.length === 0) return null;
                return (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      Inspección de Daños:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {damagedZones.map(([zone, d]) => (
                        <div key={zone} className="bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-semibold uppercase text-red-600 dark:text-red-400 block">
                              {zone}: {d.status}
                            </span>
                            {d.notes && (
                              <span className="text-xs text-slate-600 dark:text-slate-300 block mt-0.5">
                                "{d.notes}"
                              </span>
                            )}
                          </div>
                          {d.photo && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(d.photo); }}
                              className="shrink-0 text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/60"
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

          {/* EQUIPAMIENTO VERIFICADO */}
          {(selectedHistoryJob.checklist?.equipment || selectedHistoryJob.checklist?.hasEquipment) && (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-md mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Equipamiento Verificado
                </h4>
                {(() => {
                  const eq = selectedHistoryJob.checklist?.equipment || {};
                  const verifiedCount = Object.values(eq).filter(Boolean).length;
                  const totalCount = Object.keys(eq).length;
                  if (!totalCount) return null;
                  return (
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {verifiedCount} de {totalCount} presentes
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const eq = selectedHistoryJob.checklist?.equipment || {};
                const entries = Object.entries(eq);
                if (entries.length === 0) {
                  return (
                    <p className="text-xs text-slate-400">
                      Sin registro de ítems de equipamiento.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {entries.map(([item, isChecked]) => (
                      <div
                        key={item}
                        className={`p-2 rounded border flex items-center gap-2 text-xs font-medium ${isChecked
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                          }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${isChecked
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-300 dark:border-slate-600'
                            }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {selectedHistoryJob.checklist?.equipmentDetails && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-slate-500" /> Detalle de Equipamiento / Accesorios Extra:
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                    "{selectedHistoryJob.checklist.equipmentDetails}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* GASTOS ASOCIADOS AL TRASLADO */}
          {selectedHistoryJob.expenses && selectedHistoryJob.expenses.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-md mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-600 text-white rounded-md">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Gastos Asociados al Traslado
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedHistoryJob.expenses.length} registro{selectedHistoryJob.expenses.length > 1 ? 's' : ''} ingresado{selectedHistoryJob.expenses.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-md flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Gastos:</span>
                  <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    ${selectedHistoryJob.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString('es-CL')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedHistoryJob.expenses.map((exp, idx) => (
                  <div
                    key={exp.id || idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${exp.type === 'fuel'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                          }`}>
                          {exp.type === 'fuel' ? <><Fuel className="w-3 h-3" /> Combustible</> : <><Receipt className="w-3 h-3" /> {exp.category || 'Otro Gasto'}</>}
                        </span>
                        <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                          ${(Number(exp.amount) || 0).toLocaleString('es-CL')}
                        </span>
                      </div>

                      {exp.motivo && (
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                          "{exp.motivo}"
                        </p>
                      )}

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 mb-3">
                        <p className="flex items-center gap-1"><User className="w-3 h-3" /> <span className="font-medium">{exp.registeredByName || exp.registeredByEmail || 'Conductor'}</span></p>
                        {exp.createdAt && (
                          <p className="flex items-center gap-1 font-mono text-[10px]"><Clock className="w-3 h-3" /> {new Date(exp.createdAt).toLocaleString('es-CL')}</p>
                        )}
                      </div>
                    </div>

                    {/* FOTOS DEL GASTO */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                      {exp.fuelGaugeUrl && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(exp.fuelGaugeUrl); }}
                          className="flex-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 py-1.5 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Camera className="w-3 h-3" /> Estanque
                        </button>
                      )}
                      {exp.receiptUrl && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFullScreenPhoto(exp.receiptUrl); }}
                          className="flex-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 py-1.5 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Receipt className="w-3 h-3" /> Boleta
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. RECEPCIÓN */}
          {selectedHistoryJob.checklist && (
            <div>
              <h4 className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">4. Recepción</h4>
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-md border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex-1 text-center sm:text-left w-full">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Recibido por</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedHistoryJob.checklist.noReception ? 'Sin Recepción Formal' : (selectedHistoryJob.checklist.receiverName || selectedHistoryJob.receiverName || 'No registrado')}</p>
                  {(selectedHistoryJob.checklist.receiverRut || selectedHistoryJob.receiverRut) && <p className="text-xs font-mono text-slate-500 dark:text-slate-400">RUT: {selectedHistoryJob.checklist.receiverRut || selectedHistoryJob.receiverRut}</p>}

                  {(selectedHistoryJob.checklist.clientComments || selectedHistoryJob.clientComments) && (
                    <div className="mt-2 bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Comentarios</p>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">"{(selectedHistoryJob.checklist.clientComments || selectedHistoryJob.clientComments)}"</p>
                    </div>
                  )}
                </div>

                {!selectedHistoryJob.checklist.noReception && (
                  <div className="p-2 rounded-md border border-slate-200 dark:border-slate-700 shrink-0 flex flex-col items-center justify-center min-w-[140px] min-h-[80px] w-full sm:w-auto" style={{ backgroundColor: '#ffffff' }}>
                    {(selectedHistoryJob.checklist.signatureData || selectedHistoryJob.signatureData) ? (
                      <img src={selectedHistoryJob.checklist.signatureData || selectedHistoryJob.signatureData} alt="Firma" className="h-16 sm:h-20 object-contain" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Firma no registrada</span>
                    )}
                    <p className="text-[9px] font-semibold uppercase mt-1 tracking-wider" style={{ color: '#94a3b8' }}>Firma Digital</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. GALERÍA DE FOTOS */}
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
            const expensePhotos = {};
            if (selectedHistoryJob.expenses && Array.isArray(selectedHistoryJob.expenses)) {
              selectedHistoryJob.expenses.forEach((exp, idx) => {
                if (exp.fuelGaugeUrl && typeof exp.fuelGaugeUrl === 'string' && exp.fuelGaugeUrl.startsWith('http')) {
                  expensePhotos[`gasto_${idx + 1}_estanque`] = exp.fuelGaugeUrl;
                }
                if (exp.receiptUrl && typeof exp.receiptUrl === 'string' && exp.receiptUrl.startsWith('http')) {
                  expensePhotos[`gasto_${idx + 1}_boleta`] = exp.receiptUrl;
                }
              });
            }
            const allPhotos = { ...(selectedHistoryJob.checklist?.photos || {}), ...storagePhotos, ...docPhotos, ...damagePhotos, ...expensePhotos };

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

            const uniquePhotosMap = new Map();
            for (const [k, url] of Object.entries(allPhotos)) {
              if (typeof url !== 'string' || !url.startsWith('http')) continue;
              const existing = uniquePhotosMap.get(url);
              const score = keyPriority[k] || 10;
              let calculatedLabel = photoLabels[k];
              if (!calculatedLabel) {
                if (k.startsWith('gasto_')) {
                  calculatedLabel = k.includes('_boleta') ? `Gasto #${k.split('_')[1]}: Boleta` : `Gasto #${k.split('_')[1]}: Estanque`;
                } else {
                  calculatedLabel = k.replace('det', 'Detalle ');
                }
              }
              if (!existing || score > existing.score) {
                uniquePhotosMap.set(url, { key: k, url, score, label: calculatedLabel });
              }
            }

            const uniquePhotosList = Array.from(uniquePhotosMap.values());
            if (uniquePhotosList.length === 0) return null;

            return (
              <div>
                <h4 className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">5. Galería Fotográfica</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {uniquePhotosList.map(({ key: k, url: v, label }) => {
                    return (
                      <div key={v} className="relative group rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square cursor-pointer" onClick={() => setFullScreenPhoto(v)}>
                        <img src={v} alt={label} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1.5">
                          <p className="text-white text-[10px] font-semibold uppercase truncate">{label}</p>
                        </div>
                        {k === 'fuelGauge' && selectedHistoryJob.checklist?.photos?.fuelGaugeLocation && (
                          <a href={`https://maps.google.com/?q=${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lat},${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> Mapa</a>
                        )}
                        {k === 'mileage' && selectedHistoryJob.checklist?.photos?.mileageLocation && (
                          <a href={`https://maps.google.com/?q=${selectedHistoryJob.checklist.photos.mileageLocation.lat},${selectedHistoryJob.checklist.photos.mileageLocation.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> Mapa</a>
                        )}
                        {k === 'odometer' && selectedHistoryJob.checklist?.photos?.odometerLocation && (
                          <a href={`https://maps.google.com/?q=${selectedHistoryJob.checklist.photos.odometerLocation.lat},${selectedHistoryJob.checklist.photos.odometerLocation.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> Mapa</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
