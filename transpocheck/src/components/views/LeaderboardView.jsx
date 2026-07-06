import React, { useState } from 'react';
import { Trophy, Eye, X, MapPin, Navigation, EyeOff } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';

export default function LeaderboardView({ jobs, drivers, isAdminView, db }) {
  const [selectedDriverEmail, setSelectedDriverEmail] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const now = new Date(); const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  
  // NUEVO: Función inteligente para controlar si un trabajo suma puntos o no
  const toggleRankingStatus = async (job) => {
    if (!db || processingId) return;
    setProcessingId(job.id); // Activa la animación del botón
    const isService = job.tripType === 'simple' || job.isPintura;
    try {
      if (isService) {
         await updateDoc(doc(db, 'transport_jobs', job.id), { forceRanking: !job.forceRanking });
      } else {
         await updateDoc(doc(db, 'transport_jobs', job.id), { excludeFromRanking: !job.excludeFromRanking });
      }
    } catch (e) { console.error("Error al actualizar estado del ranking:", e); }
    finally { setProcessingId(null); } // Apaga la animación del botón
  };

  const monthlyCompleted = jobs.filter(j => {
    const jobDate = j.completedAt || j.createdAt || 0;
    if (jobDate < firstOfCurrentMonth) return false;
    return j.status === 'completed'; // Excluye los fallidos
  });
  
  const ranking = drivers.map(d => { 
     const dj = monthlyCompleted.filter(j => j.acceptedByEmail === d.email || (!j.acceptedByEmail && j.assignedEmails?.includes(d.email))); 
     const validScoreJobs = dj.filter(j => {
        const isService = j.tripType === 'simple' || j.isPintura;
        if (isService) {
           return !!j.forceRanking; 
        } else {
           return !j.excludeFromRanking; 
        }
     });
     return { ...d, score: validScoreJobs.length, jobs: dj }; 
  }).sort((a, b) => b.score - a.score);

  // NUEVO: Obtenemos los datos frescos en CADA milisegundo para que el cuadro negro se actualice solo
  const activeModalData = selectedDriverEmail ? ranking.find(d => d.email === selectedDriverEmail) : null;

  return (
    <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
      <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Ranking Mensual</h2>
      <div className="bg-white rounded-3xl border p-2 sm:p-4 shadow-sm">
        {ranking.length === 0 ? <p className="text-center py-6 text-sm font-bold text-slate-400">Sin datos de traslados este mes.</p> : ranking.map((dr, i) => (
          <div key={dr.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-slate-50 rounded-xl text-sm transition-colors">
             <div className="flex items-center gap-4"><span className={`text-xl font-black ${i===0?'text-yellow-500':i===1?'text-slate-400':i===2?'text-amber-700':'text-slate-300'}`}>#{i+1}</span><div><p className="font-extrabold text-slate-800">{dr.name}</p><p className="text-xs text-slate-500 font-bold">{dr.score} Traslados</p></div></div>
                         {isAdminView && <button onClick={() => setSelectedDriverEmail(dr.email)} className="flex gap-1 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl font-bold text-xs items-center transition-colors"><Eye className="w-3.5 h-3.5"/> Historial</button>}
          </div>
        ))}
      </div>
      {activeModalData && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col p-4">
            <div className="p-2 border-b flex justify-between items-center"><h2 className="text-lg font-extrabold text-slate-800">{activeModalData.name}</h2><button onClick={()=>setSelectedDriverEmail(null)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X className="w-4 h-4"/></button></div>
            <div className="p-2 overflow-y-auto space-y-3 flex-1 mt-2">
              {activeModalData.jobs.length === 0 ? <p className="text-center text-sm font-bold text-slate-400">Sin traslados.</p> : activeModalData.jobs.map(j => (
                <div key={j.id} className="bg-slate-50 p-3 rounded-xl border text-xs relative overflow-hidden">

                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${j.status==='failed'?'bg-red-500':'bg-green-500'}`}></div>
                  <div className="flex justify-between items-start mb-1 pl-2 gap-2">
                     <p className={`font-extrabold text-sm flex items-center gap-2 flex-wrap ${j.tripType === 'simple' ? 'text-purple-800' : 'text-slate-800'}`}>
                       {j.tripType === 'simple' ? (j.description || 'Servicio en Terreno') : `${j.brand || ''} ${j.model || ''}`.trim()}
                       {j.status === 'failed' && <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded uppercase shrink-0">Rechazada</span>}
                     </p>
                     {j.tripType === 'simple' ? (
                        <span className="bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded text-[9px] uppercase font-black shrink-0 shadow-sm">SERVICIO</span>
                     ) : (
                        <span className="border px-1.5 py-0.5 rounded bg-white font-bold text-slate-600 uppercase shrink-0 text-[10px]">{j.plate || j.vin || 'S/N'}</span>
                     )}
                  </div>
                  <p className="font-semibold text-slate-500 pl-2 mt-1 truncate">
                     <MapPin className="inline w-3 h-3 mr-0.5 -mt-0.5"/> {j.origin} 
                     {(j.destination || j.tripType !== 'simple') && <> <span className="text-slate-400 mx-1 text-[10px] font-black">➔</span> <Navigation className="inline w-3 h-3 mr-0.5 -mt-0.5"/> {j.tripType === 'revision' ? 'PRT' : j.destination}</>}
                  </p>
                  
                  {/* NUEVO: Controles de Administrador para el Ranking */}
                  {isAdminView && (
                     <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
                        {(() => {
                           const isService = j.tripType === 'simple' || j.isPintura;
                           const isScoring = isService ? !!j.forceRanking : !j.excludeFromRanking;
                           const isProcessing = processingId === j.id;

                           return (
                              <button 
                                 onClick={() => toggleRankingStatus(j)}
                                 disabled={isProcessing}
                                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-colors shadow-sm ${
                                    isProcessing ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' :
                                    isScoring
                                       ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                                       : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                                 }`}
                                 title="Excluir o Incluir en el conteo del ranking"
                              >
                                 {isScoring ? <EyeOff className={`w-3.5 h-3.5 ${isProcessing ? 'animate-pulse' : ''}`}/> : <Eye className={`w-3.5 h-3.5 ${isProcessing ? 'animate-pulse' : ''}`}/>}
                                 {isProcessing ? 'Actualizando...' : (isScoring ? 'Quitar del Ranking' : 'Sumar al Ranking')}
                              </button>
                           );
                        })()}
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


