import React, { useMemo, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
    BarChart3, Users, Car, CheckCircle, Map as MapIcon, Navigation, Repeat, X, MapPin, 
    DollarSign, Download, ChevronLeft, ChevronRight, Calendar, Shield, Clock, Settings,
    RefreshCw, Trash2, Database, AlertCircle
} from 'lucide-react';
import { getVehicleIdentifierLabel } from '../../utils/helpers';
import { 
    getMonthKey, 
    parseDist, 
    extractLightweightJob, 
    calculateStatsFromLightweightJobs, 
    syncMonthJobs, 
    removeJobFromMonthlyStats 
} from '../../utils/statsSync';

export default function StatsView({ jobs = [], drivers = [], vehicles = [], allClientsList = [], db, showAlert, showConfirm }) {
    // Estado del modal de detalles
    const [modalData, setModalData] = useState(null);
    
    // Mes visualizado
    const [viewDate, setViewDate] = useState(new Date());

    // Estado local de las estadísticas sincronizadas desde Firestore
    const [storedStats, setStoredStats] = useState(null);
    const [jobsSummaryMap, setJobsSummaryMap] = useState({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);

    const currentMonthKey = getMonthKey(viewDate) || `${viewDate.getFullYear()}-${(viewDate.getMonth() + 1).toString().padStart(2, '0')}`;

    // 1. ESCUCHADOR EN TIEMPO REAL de las estadísticas independientes del mes seleccionado
    useEffect(() => {
        if (!db || !currentMonthKey) return;

        const docRef = doc(db, 'monthly_stats', currentMonthKey);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const summary = data.jobsSummary || {};
                setJobsSummaryMap(summary);

                const jobsList = Object.values(summary).sort((a, b) => 
                    (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0)
                );

                if (data.stats) {
                    setStoredStats({
                        ...data.stats,
                        monthlyJobs: jobsList.length > 0 ? jobsList : (data.stats.monthlyJobs || [])
                    });
                } else if (jobsList.length > 0) {
                    setStoredStats(calculateStatsFromLightweightJobs(jobsList));
                }
            } else {
                setStoredStats(null);
                setJobsSummaryMap({});
            }
        }, (err) => {
            console.error('[ERR-STATS-SNAPSHOT-01] Error escuchando monthly_stats:', err);
        });

        return () => unsubscribe();
    }, [db, currentMonthKey]);

    // 2. AUTO-SINCRONIZACIÓN: Recopilar datos desde los traslados de forma independiente
    // y sumarlos a las estadísticas del mes sin duplicar ni bloquear
    const syncLockRef = useRef(false);
    useEffect(() => {
        if (!db || !currentMonthKey || syncLockRef.current) return;

        let isMounted = true;
        const autoSync = async () => {
            syncLockRef.current = true;
            try {
                const result = await syncMonthJobs(db, currentMonthKey, jobs, drivers);
                if (isMounted && result?.stats) {
                    setSyncSuccess(true);
                    setTimeout(() => { if (isMounted) setSyncSuccess(false); }, 3000);
                }
            } catch (err) {
                console.error('[ERR-STATS-AUTOSYNC-01] Error en auto-sincronización:', err);
            } finally {
                syncLockRef.current = false;
            }
        };

        autoSync();

        return () => { isMounted = false; };
    }, [db, currentMonthKey, jobs, drivers]);

    // 3. CÁLCULO DE MÉTRICAS VISUALES
    const stats = useMemo(() => {
        if (storedStats) return storedStats;

        // Fallback provisional si aún no carga el documento en Firestore
        const monthActiveJobs = (jobs || []).filter(j => {
            if (j.status !== 'completed' && j.status !== 'failed') return false;
            return getMonthKey(j.completedAt || j.createdAt) === currentMonthKey;
        }).map(j => extractLightweightJob(j, drivers)).filter(Boolean);

        return calculateStatsFromLightweightJobs(monthActiveJobs);
    }, [storedStats, jobs, drivers, currentMonthKey]);

    // Sincronización manual forzada por el usuario
    const handleManualSync = async () => {
        if (!db) {
            if (showAlert) showAlert("[ERR-STATS-SYNC-02] Base de datos no conectada.");
            return;
        }
        setIsSyncing(true);
        try {
            const res = await syncMonthJobs(db, currentMonthKey, jobs, drivers);
            if (res && showAlert) {
                showAlert("✅ Estadísticas sincronizadas e independientes resguardadas.");
            }
        } catch (e) {
            console.error('[ERR-STATS-MANUAL-SYNC]', e);
            if (showAlert) showAlert("[ERR-STATS-MANUAL-SYNC] Error al sincronizar estadísticas.");
        } finally {
            setIsSyncing(false);
        }
    };

    // Eliminación de un registro individual de estadísticas (ej: prueba o error)
    const handleDeleteStatRecord = (jobId) => {
        if (!showConfirm || !jobId) return;
        showConfirm("¿Eliminar este registro específico de las estadísticas?\n\nLos totales de kilómetros, ingresos y cantidad de traslados se recalcularán automáticamente sin afectar la lista de traslados activos.", async () => {
            try {
                const ok = await removeJobFromMonthlyStats(db, currentMonthKey, jobId);
                if (ok) {
                    if (showAlert) showAlert("✅ Registro eliminado de las estadísticas.");
                    setModalData(prev => prev ? {
                        ...prev,
                        jobs: (prev.jobs || []).filter(item => String(item.id) !== String(jobId))
                    } : null);
                } else {
                    if (showAlert) showAlert("[ERR-STATS-DEL-01] No se encontró el registro a eliminar.");
                }
            } catch (err) {
                console.error('[ERR-STATS-DEL-02] Error al eliminar registro:', err);
                if (showAlert) showAlert("[ERR-STATS-DEL-02] Error al eliminar de estadísticas.");
            }
        });
    };

    // UI HELPER
    const getPercent = (value, total) => total === 0 ? 0 : Math.round((value / total) * 100);

    // 4. FUNCIONES DE CLICK (Abre el modal con los traslados resguardados)
    const handleClientClick = (clientName) => {
        const filtered = (stats.monthlyJobs || []).filter(j => (j.client || 'Sin Cliente') === clientName);
        setModalData({ title: `Traslados Cliente: ${clientName}`, jobs: filtered });
    };

    const handlePRTClick = (type) => {
        const mJobs = (stats.monthlyJobs || []).filter(j => j.tripType === 'revision');
        let filtered = [], title = "";
        if (type === 'approved') {
            filtered = mJobs.filter(j => j.status !== 'failed' && j.prt_result !== 'rechazado' && j.prt_result !== 'aprobado_ayuda');
            title = "Revisiones Legales (Aprobadas)";
        } else if (type === 'help') {
            filtered = mJobs.filter(j => j.prt_result === 'aprobado_ayuda');
            title = "Revisiones Aprobadas con Ayuda";
        } else {
            filtered = mJobs.filter(j => j.status === 'failed' || j.prt_result === 'rechazado');
            title = "Revisiones Rechazadas";
        }
        setModalData({ title, jobs: filtered });
    };

    const handleDriverKmClick = (driverName) => {
        const filtered = (stats.monthlyJobs || []).filter(j => {
            const matchesDriver = (j.driverName === driverName) || 
                (Array.isArray(drivers) && drivers.find(d => d.email === j.driverEmail)?.name === driverName);
            const km = Number(j.km) || parseDist(j.drivenDistance);
            return matchesDriver && km > 0;
        });
        setModalData({ title: `Rutas de ${driverName}`, jobs: filtered });
    };

    const handleCategoryClick = (categoryKey, driverName, categoryLabel) => {
        const filtered = (stats.monthlyJobs || []).filter(j => {
            const matchesDriver = (j.driverName === driverName) || 
                (Array.isArray(drivers) && drivers.find(d => d.email === j.driverEmail)?.name === driverName);
            const vType = (j.vehicleType || 'auto').toLowerCase();
            return matchesDriver && vType === categoryKey;
        });
        setModalData({ title: `${categoryLabel} - ${driverName}`, jobs: filtered });
    };

    const handlePlateClick = (targetPlate) => {
        const filtered = (stats.monthlyJobs || []).filter(j => {
            const plate = j.plate || '';
            return plate.toUpperCase().trim() === targetPlate.toUpperCase().trim();
        });
        setModalData({ title: `Movimientos ${getVehicleIdentifierLabel(targetPlate)}`, jobs: filtered });
    };

    // Exportar tabla a Excel (CSV) con UTF-8
    const handleExportExcel = () => {
        if (!modalData || !modalData.jobs || modalData.jobs.length === 0) return;
        const headers = ['Fecha', 'Marca', 'Modelo', 'Patente/VIN', 'Desde', 'Hasta', 'Conductor', 'Distancia', 'Valor ($)'];
        
        const rows = modalData.jobs.map(j => {
            const date = new Date(j.completedAt || j.createdAt).toLocaleDateString('es-CL');
            const brand = j.brand || '-';
            const model = j.model || '-';
            const plate = j.plate || 'S/N';
            const origin = j.origin || '-';
            const destination = j.destination || '-';
            const driver = j.driverName || 'Desconocido';
            const distance = j.drivenDistance || (j.km ? `${j.km} km` : '-');
            const price = j.companyPrice || 0;
            return `"${date}";"${brand}";"${model}";"${plate}";"${origin}";"${destination}";"${driver}";"${distance}";"${price}"`;
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Estadisticas_${modalData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            
            {/* ENCABEZADO */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 sm:p-8 rounded-3xl shadow-lg text-white relative overflow-hidden">
                <BarChart3 className="absolute -right-6 -top-6 w-32 h-32 opacity-10 pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 relative z-10 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl sm:text-3xl font-black">Dashboard Analítico</h2>
                            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider" title="Los datos se recopilan independientemente y persisten aunque borres traslados">
                                <Database className="w-3 h-3 text-emerald-300" /> Independiente
                            </span>
                        </div>
                        <p className="text-blue-100 font-bold text-sm">Métricas recopiladas de forma autónoma desde traslados</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        {/* CONTROLADOR DE MESES */}
                        <div className="flex items-center gap-3 bg-white/10 dark:bg-slate-900/40 p-1.5 rounded-2xl backdrop-blur-md border border-white/20 dark:border-slate-800/20 shrink-0">
                            <button 
                                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} 
                                className="p-2 hover:bg-white/20 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                                title="Mes anterior"
                            >
                                <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                            <div className="flex flex-col items-center justify-center min-w-[120px]">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 flex items-center gap-1">
                                    <Calendar className="w-3 h-3"/> Período
                                </p>
                                <p className="text-sm font-extrabold capitalize text-white">
                                    {viewDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <button 
                                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} 
                                disabled={viewDate.getMonth() === new Date().getMonth() && viewDate.getFullYear() === new Date().getFullYear()} 
                                className="p-2 hover:bg-white/20 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                                title="Mes siguiente"
                            >
                                <ChevronRight className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* BOTÓN SINCRONIZAR AHORA */}
                        <button 
                            onClick={handleManualSync} 
                            disabled={isSyncing}
                            className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 rounded-2xl transition-all shadow-sm flex items-center gap-2"
                            title="Actualizar y verificar sincronización de datos independientes"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-300' : 'text-blue-200'}`} />
                            <span className="text-xs font-bold hidden sm:inline">
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* BANNER INFORMATIVO DE PERSISTENCIA */}
                <div className="bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-slate-800/10 p-3 rounded-2xl mb-6 relative z-10 flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left">
                    <p className="text-xs font-bold text-blue-100 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-emerald-300 shrink-0" />
                        <span>
                            Mostrando <span className="text-white font-black">{stats.totalJobs || 0}</span> traslados del <span className="text-white font-black">1 al {new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()} de {viewDate.toLocaleString('es-CL', { month: 'long' })}</span>.
                        </span>
                    </p>
                    <span className="text-[11px] font-medium text-blue-200 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                        🛡️ Resguardo activo: Si eliminas traslados de la lista, sus datos numéricos permanecen aquí.
                    </span>
                </div>
                
                {/* TARJETAS PRINCIPALES */}
                <div className="flex flex-wrap gap-4 relative z-10">
                    <div className="bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-slate-800/20 p-4 rounded-2xl flex-1 min-w-[120px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Total Traslados</p>
                        <p className="text-3xl font-black">{stats.totalJobs || 0}</p>
                    </div>
                    <div className="bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-slate-800/20 p-4 rounded-2xl flex-1 min-w-[120px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1 flex items-center gap-1">
                            <MapIcon className="w-3 h-3" /> KM del Período
                        </p>
                        <p className="text-3xl font-black text-emerald-300">
                            {Number(stats.totalKm || 0).toLocaleString('es-CL')} <span className="text-sm font-bold text-emerald-100">km</span>
                        </p>
                    </div>
                    <div className="bg-white/10 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-slate-800/20 p-4 rounded-2xl flex-1 min-w-[120px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-200 mb-1 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Ingresos Totales
                        </p>
                        <p className="text-3xl font-black text-amber-300">
                            <span className="text-sm font-bold text-amber-100">$</span>
                            {stats.totalRevenue ? stats.totalRevenue.toLocaleString('es-CL') : 0}
                        </p>
                    </div>
                </div>
            </div>

            {/* SECCIONES ESTADÍSTICAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. TOP CLIENTES */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                        <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-xl"><Users className="w-4 h-4 text-blue-600 dark:text-blue-400"/></div>
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Top Clientes del Período</h3>
                    </div>
                    {(!stats.topClients || stats.topClients.length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay datos suficientes este mes.</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.topClients.map(({name, count}, idx) => (
                                <button key={name} onClick={() => handleClientClick(name)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-[1.01] active:scale-95 transition-all rounded-xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:shadow-sm">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${idx === 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate pr-2">{name}</span>
                                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">{count} viajes</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${getPercent(count, stats.topClients[0].count)}%` }}></div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. INGRESOS POR CLIENTE */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-xl"><DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/></div>
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Ingresos por Cliente</h3>
                    </div>
                    {(!stats.topClientsByRevenue || stats.topClientsByRevenue.length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay ingresos registrados este mes.</p>
                    ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-none">
                            {stats.topClientsByRevenue.map(({name, value: revenue}, idx) => (
                                <button key={name} onClick={() => handleClientClick(name)} className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-[1.01] active:scale-95 transition-all rounded-xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:shadow-sm">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${idx === 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{name}</p>
                                    </div>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md shrink-0 border border-emerald-100 dark:border-emerald-800/50">
                                        ${revenue.toLocaleString('es-CL')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. RENDIMIENTO PRT */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-xl"><CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400"/></div>
                            <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Rendimiento PRT</h3>
                        </div>
                        <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg">
                            {stats.prtStats?.total || 0} Revisiones
                        </span>
                    </div>
                    
                    {(!stats.prtStats || stats.prtStats.total === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay revisiones registradas.</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                                <div className="bg-green-500 h-full" style={{ width: `${getPercent(stats.prtStats.approved, stats.prtStats.total)}%` }}></div>
                                <div className="bg-amber-400 h-full border-l-2 border-white dark:border-slate-800" style={{ width: `${getPercent(stats.prtStats.help, stats.prtStats.total)}%` }}></div>
                                <div className="bg-red-500 h-full border-l-2 border-white dark:border-slate-800" style={{ width: `${getPercent(stats.prtStats.rejected, stats.prtStats.total)}%` }}></div>
                            </div>
                            
                            <div className="flex gap-2 text-center mt-2">
                                <button onClick={() => handlePRTClick('approved')} className="flex-1 bg-green-50 dark:bg-green-900/30 p-2 rounded-xl border border-green-100 dark:border-green-800/50 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/50 hover:scale-105 active:scale-95 transition-all shadow-sm">
                                    <p className="text-lg font-black text-green-600 dark:text-green-400">{stats.prtStats.approved}</p>
                                    <p className="text-[9px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide leading-tight">Legales<br/>100%</p>
                                </button>
                                <button onClick={() => handlePRTClick('help')} className="flex-1 bg-amber-50 dark:bg-amber-900/30 p-2 rounded-xl border border-amber-100 dark:border-amber-800/50 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 hover:scale-105 active:scale-95 transition-all shadow-sm">
                                    <p className="text-lg font-black text-amber-600 dark:text-amber-400">{stats.prtStats.help}</p>
                                    <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide leading-tight">Aprob.<br/>Ayuda</p>
                                </button>
                                <button onClick={() => handlePRTClick('rejected')} className="flex-1 bg-red-50 dark:bg-red-900/30 p-2 rounded-xl border border-red-100 dark:border-red-800/50 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 hover:scale-105 active:scale-95 transition-all shadow-sm">
                                    <p className="text-lg font-black text-red-600 dark:text-red-400">{stats.prtStats.rejected}</p>
                                    <p className="text-[9px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wide leading-tight">Rechazos<br/>PRT</p>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. KILÓMETROS POR CONDUCTOR */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-xl"><MapIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/></div>
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Kilómetros por Conductor</h3>
                    </div>
                    
                    {(!stats.topDriversKm || stats.topDriversKm.length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay kilómetros registrados este mes.</p>
                    ) : (
                        <div className="overflow-x-auto scrollbar-none -mx-2 px-2">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="pb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800 w-8">Pos.</th>
                                        <th className="pb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">Conductor</th>
                                        <th className="pb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right border-b border-slate-100 dark:border-slate-800">Distancia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topDriversKm.map(({name, km}, idx) => (
                                        <tr key={name} onClick={() => handleDriverKmClick(name)} className="hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 cursor-pointer transition-colors group">
                                            <td className="py-2.5 pr-2 border-b border-slate-50 dark:border-slate-800 text-center rounded-l-xl">
                                                <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-black ${idx === 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : idx === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400' : idx === 2 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-800'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2 border-b border-slate-50 dark:border-slate-800">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{name}</p>
                                            </td>
                                            <td className="py-2.5 pl-1 border-b border-slate-50 dark:border-slate-800 text-right rounded-r-xl pr-2">
                                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                                                    {Math.round(km).toLocaleString('es-CL')} <span className="text-[9px] text-indigo-400 uppercase tracking-widest ml-0.5">km</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 5. LÍDERES POR VEHÍCULO */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                        <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-xl"><Car className="w-4 h-4 text-blue-600 dark:text-blue-400"/></div>
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Líderes por Vehículo</h3>
                    </div>
                    
                    {(!stats.topDriversByCategory || Object.keys(stats.topDriversByCategory).length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">Aún no hay datos de categorías este mes.</p>
                    ) : (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-none">
                            {[
                                { key: 'auto', label: 'AUTOS / SUV' },
                                { key: 'camioneta', label: 'CAMIONETA' },
                                { key: 'furgon_pequeno', label: 'FURGÓN PEQUEÑO' },
                                { key: 'furgon_grande', label: 'FURGÓN GRANDE' },
                                { key: 'camion_simple', label: 'CAMIÓN SIMPLE' },
                                { key: 'camion_doble', label: 'CAMIÓN DOBLE CABINA' },
                                { key: 'camion_2ejes', label: 'CAMIÓN (2 EJES TRASEROS)' },
                                { key: 'camion_3ejes', label: 'CAMIÓN (3 EJES TRASEROS)' },
                                { key: 'camion_8x4', label: 'CAMIÓN 8X4' },
                                { key: 'carro_arrastre', label: 'CARRO DE ARRASTRE' },
                                { key: 'maquinaria', label: 'MAQUINARIA' },
                                { key: 'servicio', label: 'SERVICIOS EN TERRENO' }
                            ].map(({ key, label }) => {
                                const leader = stats.topDriversByCategory[key];
                                if (!leader) return null;

                                return (
                                    <button key={key} onClick={() => handleCategoryClick(key, leader.name, label)} className="w-full text-left flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider truncate">{label}</span>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{leader.name}</span>
                                        </div>
                                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-lg text-[10px] font-black shrink-0">
                                            {leader.count} viajes
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 6. VEHÍCULOS FRECUENTES */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 dark:border-slate-800 pb-3">
                        <div className="bg-rose-100 dark:bg-rose-900/40 p-2 rounded-xl"><Repeat className="w-4 h-4 text-rose-600 dark:text-rose-400"/></div>
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Vehículos Frecuentes del Mes</h3>
                    </div>
                    
                    {(!stats.topPlates || stats.topPlates.length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay patentes registradas este mes.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {stats.topPlates.map(({plate, count}, idx) => (
                                <button key={plate} onClick={() => handlePlateClick(plate)} className="w-full text-left flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${idx === 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{idx + 1}</span>
                                        <div className="bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-600 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md text-xs font-black tracking-widest shadow-sm">
                                            {plate}
                                        </div>
                                    </div>
                                    <span className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider border border-rose-100 dark:border-rose-800/40">
                                        {count} VIAJES
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* MODAL DE DETALLES: Registros resguardados e independientes */}
            {modalData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                        
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-t-3xl">
                            <div className="min-w-0 pr-4">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Database className="w-3 h-3 text-blue-500" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Registros Resguardados ({modalData.jobs ? modalData.jobs.length : 0})
                                    </p>
                                </div>
                                <h3 className="font-black text-slate-800 dark:text-slate-200 text-[15px] truncate">{modalData.title}</h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button 
                                    onClick={handleExportExcel} 
                                    className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl hover:bg-emerald-200 transition-colors shadow-sm active:scale-95 flex items-center gap-2" 
                                    title="Descargar Tabla en Excel"
                                >
                                    <Download className="w-4 h-4"/> 
                                    <span className="hidden sm:inline text-xs font-black uppercase tracking-wider">Excel</span>
                                </button>
                                <button 
                                    onClick={() => setModalData(null)} 
                                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800/50 transition-colors shadow-sm active:scale-95"
                                >
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4 overflow-y-auto scrollbar-none flex-1 space-y-3 bg-slate-100 dark:bg-slate-800/30 rounded-b-3xl">
                            {(!modalData.jobs || modalData.jobs.length === 0) ? (
                                <p className="text-center text-slate-400 font-bold py-6 text-sm">No se encontraron registros activos en este grupo.</p>
                            ) : (
                                modalData.jobs.map(j => (
                                    <div key={j.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 group-hover:bg-blue-600 transition-colors"></div>
                                        
                                        {/* CABECERA: FECHA, CLIENTE, VEHÍCULO Y PATENTE */}
                                        <div className="flex justify-between items-start mb-3 pl-1.5">
                                            <div className="pr-2">
                                                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">
                                                    {new Date(j.completedAt || j.createdAt).toLocaleDateString('es-CL')}
                                                </p>
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-tight truncate">
                                                    {j.client || 'Sin cliente'}
                                                </p>
                                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">
                                                    {(j.operationMode === 'servicio' || !!j.description) 
                                                        ? (j.associatedVehicle || j.description || 'Servicio en Terreno') 
                                                        : `${j.brand || 'S/MARCA'} ${j.model || ''}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="bg-slate-800 text-white text-[10px] font-black px-2.5 py-1 rounded-md tracking-widest shadow-sm">
                                                    {j.plate || j.vin || j.associatedPlate || 'S/N'}
                                                </span>
                                                <button 
                                                    onClick={() => handleDeleteStatRecord(j.id)}
                                                    className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title="Quitar este traslado de las estadísticas"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* RUTA O DESCRIPCIÓN */}
                                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-3 border border-slate-100 dark:border-slate-800 space-y-2 ml-1.5">
                                            {(j.operationMode === 'servicio' || !!j.description) ? (
                                                <>
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="bg-purple-100 dark:bg-purple-900/40 p-1.5 rounded-full shrink-0"><Settings className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400"/></div>
                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">Servicio Realizado</p>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">{j.description || 'Servicio no especificado'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="bg-blue-100 dark:bg-blue-900/40 p-1.5 rounded-full shrink-0"><MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/></div>
                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">Ubicación</p>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">{j.origin || 'Ubicación no especificada'}</p>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="bg-blue-100 dark:bg-blue-900/40 p-1.5 rounded-full shrink-0"><MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/></div>
                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">Desde (Origen)</p>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">{j.origin || 'Origen no especificado'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="bg-amber-100 dark:bg-amber-900/40 p-1.5 rounded-full shrink-0"><Navigation className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"/></div>
                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">Hasta (Destino)</p>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">{j.destination || 'Destino no especificado'}</p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* CONDUCTOR, DISTANCIA Y PRECIO */}
                                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 pl-1.5 flex-wrap gap-2">
                                            <p className="flex items-center gap-1.5">
                                                <Car className="w-3.5 h-3.5 text-slate-400 shrink-0"/> 
                                                <span>{j.driverName || 'Conductor'}</span>
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {(j.km > 0 || j.drivenDistance) && (
                                                    <span className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/50">
                                                        <MapIcon className="w-3 h-3 text-indigo-500 shrink-0"/> 
                                                        {j.drivenDistance || `${j.km} km`}
                                                    </span>
                                                )}
                                                {Number(j.companyPrice) > 0 && (
                                                    <span className="flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[10px] font-black border border-emerald-100 dark:border-emerald-800/50">
                                                        ${Number(j.companyPrice).toLocaleString('es-CL')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}