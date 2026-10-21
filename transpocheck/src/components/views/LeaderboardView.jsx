import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trophy, Eye, X, MapPin, Navigation, EyeOff, Archive, RefreshCw, Calendar, CheckCircle } from 'lucide-react';
import { updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { getMonthKey, syncMonthJobs } from '../../utils/statsSync';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function LeaderboardView({ jobs = [], drivers = [], isAdminView, db }) {
  const [selectedDriverEmail, setSelectedDriverEmail] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [monthlyStatsData, setMonthlyStatsData] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const now = new Date();
  const currentMonthKey = getMonthKey(now) || `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const currentMonthDisplay = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  // 1. ESCUCHADOR EN TIEMPO REAL: Estadísticas independientes y respaldo del mes en curso
  useEffect(() => {
    if (!db || !currentMonthKey) return;
    const statRef = doc(db, 'monthly_stats', currentMonthKey);
    const unsub = onSnapshot(statRef, (snap) => {
      if (snap.exists()) {
        setMonthlyStatsData(snap.data());
      } else {
        setMonthlyStatsData(null);
      }
    }, (err) => {
      console.error('[ERR-RANKING-SNAPSHOT-01] Error escuchando estadísticas de monthly_stats:', err);
    });
    return () => unsub();
  }, [db, currentMonthKey]);

  // 2. AUTO-SINCRONIZACIÓN: Asegurar que todos los traslados activos queden guardados en monthly_stats
  const syncLockRef = useRef(false);
  useEffect(() => {
    if (!db || !currentMonthKey || syncLockRef.current) return;
    let isMounted = true;
    const runAutoSync = async () => {
      syncLockRef.current = true;
      try {
        if (isMounted) setIsSyncing(true);
        await syncMonthJobs(db, currentMonthKey, jobs, drivers);
      } catch (err) {
        console.warn('[ERR-RANKING-AUTOSYNC-01] Advertencia en auto-sincronización de ranking:', err);
      } finally {
        syncLockRef.current = false;
        if (isMounted) setIsSyncing(false);
      }
    };
    runAutoSync();
    return () => { isMounted = false; };
  }, [db, currentMonthKey, jobs, drivers]);

  // 3. FUSIÓN DE TRASLADOS: Combina los activos con los resguardados (incluyendo eliminados >30 días)
  // Se reinicia de forma limpia el día 1 de cada mes porque firstOfCurrentMonth y currentMonthKey corresponden al mes actual.
  const monthlyCompleted = useMemo(() => {
    const mergedMap = new Map();

    // A) Traslados resguardados en monthly_stats (conserva traslados eliminados con >30 días)
    const storedSummary = monthlyStatsData?.jobsSummary || {};
    Object.values(storedSummary).forEach(sj => {
      if (!sj || !sj.id) return;
      const jDate = sj.completedAt || sj.createdAt || 0;
      if (jDate >= firstOfCurrentMonth && (sj.status === 'completed' || sj.status === 'finished')) {
        mergedMap.set(sj.id, { ...sj, isArchived: true });
      }
    });

    // B) Traslados activos en memoria (transport_jobs en vivo, con prioridad fresca)
    (jobs || []).forEach(j => {
      if (!j || !j.id) return;
      const jDate = j.completedAt || j.createdAt || 0;
      if (jDate >= firstOfCurrentMonth && j.status === 'completed') {
        mergedMap.set(j.id, { ...j, isArchived: false });
      }
    });

    return Array.from(mergedMap.values());
  }, [jobs, monthlyStatsData, firstOfCurrentMonth]);

  const uniqueDrivers = useMemo(() => {
    return Array.from(
      new Map((drivers || []).filter(d => !d.isHidden).map(d => [d.email?.toLowerCase().trim(), d])).values()
    );
  }, [drivers]);

  // 4. CÁLCULO DEL RANKING MENSUAL POR CONDUCTOR
  const ranking = useMemo(() => {
    return uniqueDrivers.map(d => {
      const dEmail = (d.email || '').toLowerCase().trim();

      const dj = monthlyCompleted.filter(j => {
        const jAccepted = (j.acceptedByEmail || j.driverEmail || '').toLowerCase().trim();
        if (jAccepted && jAccepted === dEmail) return true;
        if (!jAccepted && Array.isArray(j.assignedEmails)) {
          return j.assignedEmails.some(ae => (ae || '').toLowerCase().trim() === dEmail);
        }
        return false;
      });

      const validScoreJobs = dj.filter(j => {
        const isService = j.tripType === 'simple' || j.isPintura;
        if (isService) {
          return !!j.forceRanking;
        } else {
          return !j.excludeFromRanking;
        }
      });

      const archivedCount = validScoreJobs.filter(j => j.isArchived).length;

      return {
        ...d,
        score: validScoreJobs.length,
        jobs: dj,
        archivedCount
      };
    }).sort((a, b) => b.score - a.score);
  }, [uniqueDrivers, monthlyCompleted]);

  // Modal de Historial para Administrador
  const activeModalData = selectedDriverEmail
    ? ranking.find(d => (d.email || '').toLowerCase().trim() === (selectedDriverEmail || '').toLowerCase().trim())
    : null;

  // Empates reales (misma posición para mismo puntaje)
  const uniqueScores = useMemo(() => {
    return [...new Set(ranking.map(d => d.score))].sort((a, b) => b - a);
  }, [ranking]);

  // Control para Administrador: Sumar o Quitar del Ranking (soporta traslados activos y archivados)
  const toggleRankingStatus = async (job) => {
    if (!db || processingId) return;
    setProcessingId(job.id);
    const isService = job.tripType === 'simple' || job.isPintura;
    const field = isService ? 'forceRanking' : 'excludeFromRanking';
    const newVal = isService ? !job.forceRanking : !job.excludeFromRanking;

    try {
      // 1. Intentar actualizar en transport_jobs si aún existe
      try {
        await updateDoc(doc(db, 'transport_jobs', job.id), { [field]: newVal });
      } catch (errLive) {
        // Documento ya eliminado de transport_jobs (>30 días), se manejará en monthly_stats
      }

      // 2. Actualizar permanentemente en monthly_stats
      const jobMonthKey = getMonthKey(job.completedAt || job.createdAt) || currentMonthKey;
      try {
        const statRef = doc(db, 'monthly_stats', jobMonthKey);
        await updateDoc(statRef, {
          [`jobsSummary.${job.id}.${field}`]: newVal
        });
      } catch (errStats) {
        console.warn('[WARN-RANKING-STATS-UPDATE]', errStats);
      }
    } catch (e) {
      console.error("[ERR-RANKING-TOGGLE-01] Error al actualizar estado del ranking:", e);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2">
            <Trophy className="text-yellow-500 w-7 h-7" /> Ranking Mensual
          </h2>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500" /> Periodo: <span className="text-slate-700 dark:text-slate-200 uppercase font-black">{currentMonthDisplay}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSyncing && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800/50">
              <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...
            </span>
          )}
        </div>
      </div>

      {/* Tarjeta Informativa de Reglas del Ranking */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            Los traslados completados de más de 30 días eliminados <strong>siguen contando en el ranking como número</strong>. Se reinicia automáticamente el <strong>día 1 de cada mes</strong>.
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-2 sm:p-4 shadow-sm">
        {ranking.length === 0 ? (
          <p className="text-center py-8 text-sm font-bold text-slate-400">Sin datos de traslados este mes.</p>
        ) : (
          ranking.map((dr) => {
            const rankIndex = uniqueScores.indexOf(dr.score);
            const rankPosition = rankIndex + 1;
            const rankColor = rankIndex === 0 
              ? 'text-yellow-500' 
              : rankIndex === 1 
              ? 'text-slate-400' 
              : rankIndex === 2 
              ? 'text-amber-700 dark:text-amber-400' 
              : 'text-slate-300';
            
            return (
              <div 
                key={dr.id || dr.email} 
                className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl text-sm transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-xl font-black ${rankColor} w-8 text-center`}>
                    #{rankPosition}
                  </span>
                  <div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">{dr.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5 flex-wrap">
                      <span>{dr.score} {dr.score === 1 ? 'Traslado' : 'Traslados'}</span>
                      {dr.archivedCount > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          ({dr.archivedCount} resguardados &gt;15d)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {isAdminView && (
                  <button 
                    onClick={() => setSelectedDriverEmail(dr.email)} 
                    className="flex gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:bg-blue-900/40 px-3 py-2 rounded-xl font-bold text-xs items-center transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Historial
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Historial Detallado para Administrador */}
      {activeModalData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col p-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-2 border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-200">{activeModalData.name}</h2>
                <p className="text-xs font-bold text-slate-400">{activeModalData.score} traslados contabilizados este mes</p>
              </div>
              <button 
                onClick={() => setSelectedDriverEmail(null)} 
                className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full hover:bg-slate-200 dark:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 overflow-y-auto space-y-3 flex-1 mt-2">
              {activeModalData.jobs.length === 0 ? (
                <p className="text-center text-sm font-bold text-slate-400 py-6">Sin traslados este mes.</p>
              ) : (
                activeModalData.jobs.map(j => {
                  const isService = j.tripType === 'simple' || j.isPintura;
                  const isScoring = isService ? !!j.forceRanking : !j.excludeFromRanking;
                  const isProcessing = processingId === j.id;

                  return (
                    <div key={j.id} className="bg-slate-50 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs relative overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${j.status === 'failed' ? 'bg-red-500' : isScoring ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                      
                      <div className="flex justify-between items-start mb-1 pl-2 gap-2">
                        <p className={`font-extrabold text-sm flex items-center gap-1.5 flex-wrap ${j.tripType === 'simple' ? 'text-purple-800 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200'}`}>
                          {j.tripType === 'simple' ? (j.description || 'Servicio en Terreno') : `${j.brand || ''} ${j.model || ''}`.trim() || 'Vehículo'}
                          {j.status === 'failed' && (
                            <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-[9px] px-1.5 py-0.5 rounded uppercase shrink-0 font-bold">
                              Rechazado
                            </span>
                          )}
                          {j.isArchived && (
                            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] px-1.5 py-0.5 rounded font-black uppercase shrink-0 flex items-center gap-1">
                              <Archive className="w-2.5 h-2.5 text-slate-500" /> Resguardado (&gt;15d)
                            </span>
                          )}
                        </p>

                        {j.tripType === 'simple' ? (
                          <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-1.5 py-0.5 rounded text-[9px] uppercase font-black shrink-0 shadow-sm">
                            SERVICIO
                          </span>
                        ) : (
                          <span className="border px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 font-bold text-slate-600 dark:text-slate-400 uppercase shrink-0 text-[10px]">
                            {j.plate || j.vin || 'S/N'}
                          </span>
                        )}
                      </div>

                      <p className="font-bold text-slate-500 dark:text-slate-400 pl-2 mt-1.5 flex items-center flex-wrap gap-x-1.5 gap-y-1">
                        <span className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-slate-400" /> 
                          <span className="truncate max-w-[120px]">{j.origin || '-'}</span>
                        </span>
                        {(j.destination || j.tripType !== 'simple') && (
                          <span className="flex items-center">
                            <span className="text-slate-300 mx-1 text-[10px] font-black">➔</span> 
                            <Navigation className="w-3 h-3 mr-1 text-blue-400" /> 
                            <span className="truncate max-w-[120px]">{j.tripType === 'revision' ? 'PRT' : (j.destination || '-')}</span>
                          </span>
                        )}
                      </p>

                      {/* Controles de Administrador para el Ranking */}
                      {isAdminView && (
                        <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <button 
                            onClick={() => toggleRankingStatus(j)}
                            disabled={isProcessing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-colors shadow-sm ${
                              isProcessing 
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed' 
                                : isScoring
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:bg-red-900/40' 
                                : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/50 hover:bg-green-100 dark:bg-green-900/40'
                            }`}
                            title="Excluir o Incluir en el conteo del ranking"
                          >
                            {isScoring ? (
                              <EyeOff className={`w-3.5 h-3.5 ${isProcessing ? 'animate-pulse' : ''}`} />
                            ) : (
                              <Eye className={`w-3.5 h-3.5 ${isProcessing ? 'animate-pulse' : ''}`} />
                            )}
                            {isProcessing ? 'Actualizando...' : (isScoring ? 'Quitar del Ranking' : 'Sumar al Ranking')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
