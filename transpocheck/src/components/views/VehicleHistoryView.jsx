import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, ShieldCheck, Calendar, User, MapPin, Camera, X, AlertTriangle, FileText, Clock } from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';

export default function VehicleHistoryView({ db, showAlert }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    const term = searchTerm.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!term) return;

    setSearchTerm(term); // Actualiza el input visualmente
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      // Buscar por Patente
      const qPlate = query(collection(db, 'transport_jobs'), where('plate', '==', term));
      const snapPlate = await getDocs(qPlate);
      
      // Buscar por VIN (Chasis)
      const qVin = query(collection(db, 'transport_jobs'), where('vin', '==', term));
      const snapVin = await getDocs(qVin);

      const combined = [];
      const seenIds = new Set();

      const processDoc = (docSnap) => {
        if (!seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          combined.push({ id: docSnap.id, ...docSnap.data() });
        }
      };

      snapPlate.forEach(processDoc);
      snapVin.forEach(processDoc);

      // Ordenar resultados desde el más reciente al más antiguo
      combined.sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));

      setResults(combined);
    } catch (error) {
      console.error("Error buscando historial:", error);
      showAlert("Ocurrió un error al buscar en la base de datos histórica.");
    } finally {
      setIsSearching(false);
    }
  };

  const renderGallery = (photos) => {
    if (!photos) return <p className="text-xs text-slate-400 font-bold italic mt-2">Sin registro fotográfico.</p>;
    
    // Filtrar solo las fotos que realmente se subieron y tienen una URL
    const validPhotos = Object.entries(photos).filter(([k, v]) => v && typeof v === 'string' && v.startsWith('http'));
    
    if (validPhotos.length === 0) return <p className="text-xs text-slate-400 font-bold italic mt-2">Sin registro fotográfico.</p>;

    const labels = { front: 'Frente', back: 'Atrás', left: 'Lat. Piloto', right: 'Lat. Copiloto', dashboard: 'Tablero', tire: 'Repuesto', interior_front: 'Int. Adelante', interior_back: 'Int. Atrás' };

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4">
        {validPhotos.map(([key, url]) => (
          <div key={key} onClick={() => setFullScreenImage(url)} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shadow-sm group">
            <img src={url} alt={`Evidencia ${key}`} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 to-transparent p-2 pt-4">
              <p className="text-[9px] text-white font-black uppercase text-center truncate tracking-wider">
                {labels[key] || key.replace('det', 'Daño ')}
              </p>
            </div>
            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/20 transition-colors flex items-center justify-center">
               <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"/>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Encabezado y Buscador */}
      <div className="bg-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
           <ShieldCheck className="w-48 h-48 text-white transform rotate-12" />
        </div>
        
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white flex items-center gap-2 mb-2">
            <ShieldCheck className="w-7 h-7 text-blue-400" /> Peritaje de Siniestros
          </h2>
          <p className="text-slate-300 text-sm font-bold mb-6 max-w-lg">
            Busca cualquier patente o VIN en el historial completo de la empresa. Encuentra fotos y observaciones para defenderte ante reclamos de clientes.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <input 
                type="text" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Ingresa Patente o VIN..." 
                className="w-full pl-11 pr-4 py-4 bg-white border-2 border-transparent rounded-2xl text-sm font-black uppercase text-slate-800 outline-none focus:border-blue-400 shadow-inner transition-colors"
                required
              />
            </div>
            <button type="submit" disabled={isSearching} className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-4 rounded-2xl font-black text-sm transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2">
              {isSearching ? <Clock className="w-5 h-5 animate-spin" /> : 'Buscar'}
            </button>
          </form>
        </div>
      </div>

      {/* Resultados */}
      {hasSearched && !isSearching && results.length === 0 && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-800">Sin Resultados</h3>
          <p className="text-slate-500 font-bold text-sm mt-1">No se encontró ningún traslado histórico para la patente/VIN: <span className="text-slate-800 uppercase">{searchTerm}</span></p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-6">
          <h3 className="font-extrabold text-slate-700 ml-2">Línea de Tiempo del Vehículo ({results.length} traslados)</h3>
          
          <div className="relative border-l-4 border-slate-200 ml-4 space-y-8 pb-8">
            {results.map((job, index) => {
              const dateStr = new Date(job.completedAt || job.createdAt).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              const driverName = job.assignedDrivers?.[0]?.name || job.checklist?.assignedDriverName || job.acceptedByEmail || 'Conductor desconocido';

              return (
                <div key={job.id} className="relative pl-6 sm:pl-8">
                  {/* Pin de la línea de tiempo */}
                  <div className={`absolute -left-[14px] top-5 w-6 h-6 rounded-full border-4 border-slate-50 shadow-sm flex items-center justify-center ${index === 0 ? 'bg-blue-500' : 'bg-slate-400'}`}>
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    
                    {/* Cabecera del Acta */}
                    <div className="bg-slate-50 p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{dateStr}</p>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-black text-slate-800 truncate">{job.brand} {job.model}</h4>
                          <div className="shrink-0"><LicensePlateBadge text={job.plate || job.vin} /></div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap text-sm font-bold text-slate-500 mt-1">
                           <MapPin className="w-4 h-4 text-slate-400 shrink-0"/> 
                           <span className="text-slate-700">{job.origin}</span>
                           {(job.destination || job.tripType !== 'simple') && (
                              <>
                                <span className="text-slate-300 font-black mx-1">➔</span>
                                {job.waypoints && job.waypoints.length > 0 && (
                                   <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-xs">+{job.waypoints.length} paradas</span>
                                )}
                                {job.waypoints && job.waypoints.length > 0 && <span className="text-slate-300 font-black mx-1">➔</span>}
                                <span className="text-blue-600">{job.tripType === 'revision' ? 'PRT' : job.destination}</span>
                              </>
                           )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right bg-white p-3 rounded-xl border border-slate-100 shadow-sm shrink-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsable del Traslado</p>
                        <p className="text-sm font-bold text-blue-700 flex items-center sm:justify-end gap-1.5"><User className="w-4 h-4"/> {driverName}</p>
                      </div>
                    </div>

                    {/* Cuerpo del Peritaje */}
                    <div className="p-4 sm:p-5 space-y-5">
                      
                      {/* Observaciones (Lo más importante para siniestros) */}
                      <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 mb-2"><FileText className="w-4 h-4 text-amber-500"/> Observaciones del Conductor</h5>
                        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-sm font-bold text-amber-900 italic">
                          "{job.checklist?.observations || 'Sin observaciones registradas al momento del retiro.'}"
                        </div>
                      </div>

                      {/* Comentarios del Cliente (Receptor) */}
                      {job.checklist?.clientComments && (
                        <div>
                          <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 mb-2"><FileText className="w-4 h-4 text-blue-500"/> Comentarios del Receptor</h5>
                          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-sm font-bold text-blue-900 italic">
                            "{job.checklist.clientComments}"
                          </div>
                        </div>
                      )}

                      {/* Galería de Fotos */}
                      <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Camera className="w-4 h-4 text-slate-500"/> Evidencia Fotográfica</h5>
                        {renderGallery(job.checklist?.photos)}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Imagen a Pantalla Completa */}
      {fullScreenImage && (
        <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors shadow-lg">
            <X className="w-6 h-6" />
          </button>
          <img src={fullScreenImage} alt="Evidencia Ampliada" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}