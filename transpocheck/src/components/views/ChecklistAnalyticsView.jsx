import React, { useMemo } from 'react';
import { 
  CheckCircle, AlertTriangle, Clock, FileText, Calendar, 
  UserX, Trophy, ShieldAlert, Navigation, Car, AlertCircle
} from 'lucide-react';

export default function ChecklistAnalyticsView({ jobs, drivers, currentUserEmail, activeRole }) {
  const analytics = useMemo(() => {
    const completedJobs = jobs.filter(j => j.status === 'completed' || j.phase === 'completed');
    
    let totalChecklists = completedJobs.length;
    let completionSum = 0;
    
    const driverStats = {};
    
    completedJobs.forEach(job => {
      const driverEmail = job.acceptedByEmail;
      if (!driverEmail) return;
      
      if (!driverStats[driverEmail]) {
        const driverName = drivers?.find(d => d.email === driverEmail)?.name || driverEmail;
        driverStats[driverEmail] = {
          name: driverName,
          email: driverEmail,
          totalJobs: 0,
          completionSum: 0,
          docsAttached: 0,
          expiryDatesFilled: 0,
          selfSignatures: 0,
          fastTransfers: 0,
          fastTransferDetails: []
        };
      }
      
      const stats = driverStats[driverEmail];
      stats.totalJobs++;
      
      // 1. Completion Percentage
      let fieldsFilled = 0;
      let totalFields = 0;
      
      const checkField = (val) => {
        totalFields++;
        if (val) fieldsFilled++;
      };
      
      const cl = job.checklist || {};
      
      // Check photos
      if (cl.photos) {
         Object.values(cl.photos).forEach(photo => {
            if (typeof photo === 'string' && photo.length > 50) checkField(true);
            else checkField(false);
         });
      }
      // Check docs
      if (cl.docsPhotos) {
         Object.values(cl.docsPhotos).forEach(photo => {
            if (typeof photo === 'string' && photo.length > 50) {
               checkField(true);
               stats.docsAttached++;
            } else checkField(false);
         });
      }
      if (cl.scandocPdf || cl.scandocPdfInbox) {
         checkField(true);
         stats.docsAttached++;
      }
      
      // Check signature
      checkField(cl.signature);
      checkField(cl.receiverName);
      checkField(cl.receiverRut);
      
      // Expiry dates
      if (cl.docsExpiry) {
         Object.values(cl.docsExpiry).forEach(date => {
            if (date) {
               checkField(true);
               stats.expiryDatesFilled++;
            } else {
               checkField(false);
            }
         });
      }
      
      const jobCompletion = totalFields > 0 ? (fieldsFilled / totalFields) * 100 : 0;
      stats.completionSum += jobCompletion;
      completionSum += jobCompletion;
      
      // Self signatures
      if (cl.receiverName && stats.name) {
         const rName = cl.receiverName.toLowerCase().trim();
         const dName = stats.name.toLowerCase().trim();
         
         const isSelf = rName.length > 3 && dName.length > 3 && (rName.includes(dName.split(' ')[0]) || dName.includes(rName.split(' ')[0]));
         if (isSelf) {
            stats.selfSignatures++;
         }
      }
      
      // Transfer times (Suspiciously fast: < 5 minutes)
      // Check arrivedPickupAt (or acceptedAt) and completedAt
      const startMs = job.arrivedPickupAt || job.timestamps?.arrivedPickupAt || job.acceptedAt;
      const endMs = job.completedAt || job.timestamps?.completedAt || job.lastUpdatedAt;
      
      if (startMs && endMs) {
         const diffMins = (endMs - startMs) / (1000 * 60);
         // If finished in less than 5 minutes, it's suspiciously fast
         if (diffMins > 0 && diffMins < 5) {
            stats.fastTransfers++;
            stats.fastTransferDetails.push({ 
               jobId: job.id, 
               diffMins: Math.round(diffMins), 
               plate: job.plate || job.vin || 'S/N'
            });
         }
      }
      
    });
    
    const driverArr = Object.values(driverStats).filter(d => d.totalJobs > 0);
    driverArr.forEach(d => {
       d.avgCompletion = d.completionSum / d.totalJobs;
       // Compute a "bad score" based on red flags and low completion
       d.badScore = (d.selfSignatures * 20) + (d.fastTransfers * 30) + (100 - d.avgCompletion);
    });
    
    const bestDrivers = [...driverArr].sort((a, b) => b.avgCompletion - a.avgCompletion);
    const bestDocs = [...driverArr].sort((a, b) => (b.docsAttached/b.totalJobs) - (a.docsAttached/a.totalJobs));
    const bestExpiry = [...driverArr].sort((a, b) => (b.expiryDatesFilled/b.totalJobs) - (a.expiryDatesFilled/a.totalJobs));
    const worstDrivers = [...driverArr].sort((a, b) => b.badScore - a.badScore);
    
    return {
      totalChecklists,
      avgCompletion: totalChecklists > 0 ? (completionSum / totalChecklists) : 0,
      bestDriver: bestDrivers[0],
      bestDocsDriver: bestDocs[0],
      bestExpiryDriver: bestExpiry[0],
      worstDriver: worstDrivers[0],
      driverArr,
      suspiciousJobs: driverArr.flatMap(d => d.fastTransferDetails.map(j => ({ ...j, driverName: d.name })))
    };
  }, [jobs, drivers]);

  if (activeRole !== 'admin') {
     return (
        <main className="max-w-3xl mx-auto p-4 pt-20 pb-32 flex flex-col items-center justify-center min-h-screen text-center">
           <AlertTriangle className="w-16 h-16 text-slate-300 mb-4" />
           <h2 className="text-xl font-black text-slate-500">Acceso Denegado</h2>
           <p className="text-sm font-bold text-slate-400 mt-2">El análisis de checklist es exclusivo para administradores.</p>
        </main>
     );
  }

  return (
    <main className="max-w-4xl mx-auto p-4 pt-20 sm:pt-24 pb-32 animate-in fade-in duration-300">
      
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-indigo-200/50 mb-6 relative overflow-hidden">
         <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-1 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8" /> Análisis de Checklist
            </h2>
            <p className="text-sm font-bold text-indigo-100 leading-relaxed max-w-lg">
              Monitoreo de calidad en llenado de formularios, rendimientos por conductor y alertas automáticas de malas prácticas o fraudes en ruta.
            </p>
         </div>
         <FileText className="w-40 h-40 absolute -bottom-8 -right-8 text-white opacity-10 transform -rotate-12 pointer-events-none"/>
      </div>

      {analytics.totalChecklists === 0 ? (
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">No hay trabajos completados suficientes para analizar.</p>
         </div>
      ) : (
         <div className="space-y-6">
            
            {/* GLOBAL STATS */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
               <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Analizados</span>
                  <p className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-slate-200">{analytics.totalChecklists}</p>
               </div>
               <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Completitud Global</span>
                  <div className="flex items-center gap-2 mt-1">
                     <p className={`text-3xl sm:text-4xl font-black ${analytics.avgCompletion >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {Math.round(analytics.avgCompletion)}%
                     </p>
                  </div>
               </div>
            </div>

            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 pt-2 border-b border-slate-100 dark:border-slate-800 pb-2">Destacados por Calidad</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
               
               {/* MEJOR CONDUCTOR */}
               <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-3xl shadow-sm relative overflow-hidden">
                  <div className="relative z-10">
                     <div className="flex items-center gap-1.5 mb-2">
                        <Trophy className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Mejor Completitud</span>
                     </div>
                     <p className="text-lg font-black text-emerald-900 dark:text-emerald-100 leading-tight">
                        {analytics.bestDriver?.name || 'N/A'}
                     </p>
                     {analytics.bestDriver && (
                        <p className="text-xs font-bold text-emerald-600 mt-1">
                           Promedio: {Math.round(analytics.bestDriver.avgCompletion)}% en {analytics.bestDriver.totalJobs} viajes
                        </p>
                     )}
                  </div>
                  <CheckCircle className="w-16 h-16 absolute -bottom-2 -right-2 text-emerald-600 opacity-5 transform -rotate-12" />
               </div>

               {/* MAS DOCUMENTOS */}
               <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-4 rounded-3xl shadow-sm relative overflow-hidden">
                  <div className="relative z-10">
                     <div className="flex items-center gap-1.5 mb-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Documentador</span>
                     </div>
                     <p className="text-lg font-black text-blue-900 dark:text-blue-100 leading-tight">
                        {analytics.bestDocsDriver?.name || 'N/A'}
                     </p>
                     {analytics.bestDocsDriver && (
                        <p className="text-xs font-bold text-blue-600 mt-1">
                           {analytics.bestDocsDriver.docsAttached} doc. escaneados
                        </p>
                     )}
                  </div>
               </div>

               {/* MEJOR EN FECHAS VENCIMIENTO */}
               <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-4 rounded-3xl shadow-sm relative overflow-hidden">
                  <div className="relative z-10">
                     <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Experto en Fechas</span>
                     </div>
                     <p className="text-lg font-black text-purple-900 dark:text-purple-100 leading-tight">
                        {analytics.bestExpiryDriver?.name || 'N/A'}
                     </p>
                     {analytics.bestExpiryDriver && (
                        <p className="text-xs font-bold text-purple-600 mt-1">
                           {analytics.bestExpiryDriver.expiryDatesFilled} fechas registradas
                        </p>
                     )}
                  </div>
               </div>
            </div>

            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 pt-4 border-b border-slate-100 dark:border-slate-800 pb-2">Alertas y Malas Prácticas</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               {/* PEOR CONDUCTOR */}
               <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 rounded-3xl shadow-sm relative">
                  <div className="flex items-center gap-1.5 mb-2">
                     <UserX className="w-4 h-4 text-red-600" />
                     <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Alerta de Calidad</span>
                  </div>
                  <p className="text-lg font-black text-red-900 dark:text-red-100 leading-tight mb-2">
                     {analytics.worstDriver?.name || 'N/A'}
                  </p>
                  {analytics.worstDriver && (
                     <div className="text-xs font-bold text-red-700 dark:text-red-400 space-y-1">
                        <p>• Completitud promedio: <span className="font-black">{Math.round(analytics.worstDriver.avgCompletion)}%</span></p>
                        {analytics.worstDriver.selfSignatures > 0 && (
                           <p>• <span className="font-black bg-red-200 dark:bg-red-900/60 px-1 rounded">{analytics.worstDriver.selfSignatures} firmas</span> coinciden con su propio nombre.</p>
                        )}
                        {analytics.worstDriver.fastTransfers > 0 && (
                           <p>• <span className="font-black bg-red-200 dark:bg-red-900/60 px-1 rounded">{analytics.worstDriver.fastTransfers} trabajos</span> cerrados sospechosamente rápido.</p>
                        )}
                     </div>
                  )}
               </div>

               {/* TRASLADOS SOSPECHOSAMENTE RAPIDOS */}
               <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 p-4 rounded-3xl shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Tiempos Dudosos (&lt; 5 min)</span>
                     </div>
                     <span className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{analytics.suspiciousJobs.length}</span>
                  </div>
                  <p className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-3">
                     Trabajos donde el tiempo entre "Llegué a retirar" y "Trabajo terminado" fue extremadamente corto (menos de 5 minutos).
                  </p>
                  {analytics.suspiciousJobs.length > 0 ? (
                     <div className="max-h-32 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {analytics.suspiciousJobs.map((j, i) => (
                           <div key={i} className="bg-white/60 dark:bg-black/20 p-2 rounded-xl flex items-center justify-between border border-orange-100 dark:border-orange-800/40">
                              <div>
                                 <p className="text-[10px] font-black text-slate-800 dark:text-slate-200">{j.driverName}</p>
                                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{j.plate}</p>
                              </div>
                              <span className="text-xs font-black text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded-lg">
                                 {j.diffMins} min
                              </span>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <p className="text-xs font-bold text-emerald-600">No se detectaron traslados sospechosamente rápidos.</p>
                  )}
               </div>
            </div>

         </div>
      )}
    </main>
  );
}
