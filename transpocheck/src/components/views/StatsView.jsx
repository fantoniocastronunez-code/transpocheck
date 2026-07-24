import React, { useMemo } from 'react';
import { 
    BarChart3, TrendingUp, Users, Car, CheckCircle, 
    XCircle, AlertTriangle, Map, Navigation, Repeat 
} from 'lucide-react';

export default function StatsView({ jobs = [], drivers = [], vehicles = [], allClientsList = [] }) {

    // 1. Filtrar los trabajos relevantes (completados o fallidos) del mes actual
    const stats = useMemo(() => {
        // Blindaje: Si jobs no es un array, devolvemos datos vacíos para no romper la app
        if (!Array.isArray(jobs)) {
            return { totalJobs: 0, topClients: [], prtStats: { total: 0, approved: 0, help: 0, rejected: 0 }, regionJobs: 0, totalKm: 0, todayKm: 0, topDriversKm: [], topDriversByCategory: {}, topPlates: [] };
        }

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyJobs = jobs.filter(j => {
            const jobDate = j.completedAt ? new Date(j.completedAt) : (j.createdAt ? new Date(j.createdAt) : null);
            return jobDate && jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear && (j.status === 'completed' || j.status === 'failed');
        });

        // --- 1. Top Clientes del Mes ---
        const clientCounts = {};
        monthlyJobs.forEach(j => {
            const cName = j.client || 'Sin Cliente';
            clientCounts[cName] = (clientCounts[cName] || 0) + 1;
        });
        const topClients = Object.entries(clientCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5

        // --- 2. Análisis de PRT ---
        const prtJobs = monthlyJobs.filter(j => j.tripType === 'revision');
        let prtApproved = 0, prtApprovedHelp = 0, prtRejected = 0;
        prtJobs.forEach(j => {
            if (j.status === 'failed' || j.prt_result === 'rechazado') prtRejected++;
            else if (j.prt_result === 'aprobado_ayuda') prtApprovedHelp++;
            else prtApproved++; 
        });

        // --- 3. Rutas a Regiones ---
        const regionJobs = monthlyJobs.filter(j => j.tripType === 'viaje').length;

        // --- 4. Kilometraje Diario y Mensual ---
        let totalKm = 0;
        let todayKm = 0;
        const todayStr = now.toISOString().split('T')[0];

        monthlyJobs.forEach(j => {
            if (j.drivenDistance && j.drivenDistance.includes('km')) {
                const km = parseFloat(j.drivenDistance.replace(/[^\d.]/g, ''));
                if (!isNaN(km)) {
                    totalKm += km;
                    if (j.completedAt) {
                        const jDate = new Date(j.completedAt).toISOString().split('T')[0];
                        if (jDate === todayStr) todayKm += km;
                    }
                }
            }
        });

        // --- 5. Kilometraje por Conductor ---
        const driverKms = {};
        monthlyJobs.forEach(j => {
            if (j.status !== 'completed' || !j.acceptedByEmail) return;
            
            if (j.drivenDistance && j.drivenDistance.includes('km')) {
                const km = parseFloat(j.drivenDistance.replace(/[^\d.]/g, ''));
                if (!isNaN(km)) {
                    const drvName = (Array.isArray(drivers) ? drivers.find(d => d.email === j.acceptedByEmail)?.name : null) || 'Desconocido';
                    driverKms[drvName] = (driverKms[drvName] || 0) + km;
                }
            }
        });

        const topDriversKm = Object.entries(driverKms).sort((a, b) => b[1] - a[1]);

        // --- 6. Especialización por Tipo de Vehículo ---
        const categoryCounts = {
            'auto': {}, 'camioneta': {}, 'furgon_pequeno': {}, 'furgon_grande': {},
            'camion_simple': {}, 'camion_doble': {}, 'camion_2ejes': {},
            'camion_3ejes': {}, 'camion_8x4': {}, 'carro_arrastre': {}
        };

        monthlyJobs.forEach(j => {
            if (j.status !== 'completed' || !j.acceptedByEmail) return;
            const drvName = (Array.isArray(drivers) ? drivers.find(d => d.email === j.acceptedByEmail)?.name : null) || 'Desconocido';
            const vType = j.checklist?.vehicleType || 'auto';
            
            if (categoryCounts[vType] !== undefined) {
                categoryCounts[vType][drvName] = (categoryCounts[vType][drvName] || 0) + 1;
            }
        });

        const topDriversByCategory = {};
        for (const [cat, counts] of Object.entries(categoryCounts)) {
            let topDriver = null;
            let maxCount = 0;
            for (const [drv, count] of Object.entries(counts)) {
                if (count > maxCount) {
                    maxCount = count;
                    topDriver = drv;
                }
            }
            if (topDriver) {
                topDriversByCategory[cat] = { name: topDriver, count: maxCount };
            }
        }

        // --- 7. Patentes más repetidas ---
        const plateCounts = {};
        monthlyJobs.forEach(j => {
            const plate = (j.plate && j.plate !== 'S/N') ? j.plate : ((j.vin && j.vin !== 'S/N') ? j.vin : null);
            if (plate) {
                const cleanPlate = plate.toUpperCase().trim();
                plateCounts[cleanPlate] = (plateCounts[cleanPlate] || 0) + 1;
            }
        });
        
        const topPlates = Object.entries(plateCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return {
            totalJobs: monthlyJobs.length,
            topClients,
            prtStats: { total: prtJobs.length, approved: prtApproved, help: prtApprovedHelp, rejected: prtRejected },
            regionJobs,
            totalKm: Math.round(totalKm),
            todayKm: Math.round(todayKm),
            topDriversKm,
            topDriversByCategory,
            topPlates
        };

    }, [jobs, drivers]);

    // UI HELPER para porcentajes
    const getPercent = (value, total) => total === 0 ? 0 : Math.round((value / total) * 100);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            
            {/* ENCABEZADO */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 rounded-3xl shadow-lg text-white relative overflow-hidden">
                <BarChart3 className="absolute -right-6 -top-6 w-32 h-32 opacity-10" />
                <h2 className="text-2xl font-black mb-1 relative z-10">Dashboard Analítico</h2>
                <p className="text-blue-100 font-bold text-sm relative z-10">Métricas operativas del mes actual</p>
                
                <div className="mt-6 flex flex-wrap gap-4 relative z-10">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex-1 min-w-[120px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Total Traslados</p>
                        <p className="text-3xl font-black">{stats.totalJobs || 0}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex-1 min-w-[120px]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1 flex items-center gap-1"><Map className="w-3 h-3" /> KM Este Mes</p>
                        <p className="text-3xl font-black text-emerald-300">{stats.totalKm || 0} <span className="text-sm font-bold text-emerald-100">km</span></p>
                    </div>
                </div>
            </div>

            {/* GRÁFICOS Y PANELES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. TOP CLIENTES */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                        <div className="bg-blue-100 p-2 rounded-xl"><Users className="w-4 h-4 text-blue-600"/></div>
                        <h3 className="font-extrabold text-slate-800">Top Clientes del Mes</h3>
                    </div>
                    {(!stats.topClients || stats.topClients.length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay datos suficientes este mes.</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.topClients.map(([name, count], idx) => (
                                <div key={name} className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs font-bold text-slate-700 truncate pr-2">{name}</span>
                                            <span className="text-xs font-black text-blue-600">{count} viajes</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${getPercent(count, stats.topClients[0][1])}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. RENDIMIENTO PRT */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="bg-amber-100 p-2 rounded-xl"><CheckCircle className="w-4 h-4 text-amber-600"/></div>
                            <h3 className="font-extrabold text-slate-800">Rendimiento PRT</h3>
                        </div>
                        <span className="text-xs font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{stats.prtStats?.total || 0} Revisiones</span>
                    </div>
                    
                    {(!stats.prtStats || stats.prtStats.total === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay revisiones registradas.</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                <div className="bg-green-500 h-full" style={{ width: `${getPercent(stats.prtStats.approved, stats.prtStats.total)}%` }}></div>
                                <div className="bg-amber-400 h-full border-l-2 border-white" style={{ width: `${getPercent(stats.prtStats.help, stats.prtStats.total)}%` }}></div>
                                <div className="bg-red-500 h-full border-l-2 border-white" style={{ width: `${getPercent(stats.prtStats.rejected, stats.prtStats.total)}%` }}></div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-center mt-2">
                                <div className="bg-green-50 p-2 rounded-xl border border-green-100">
                                    <p className="text-lg font-black text-green-600">{stats.prtStats.approved}</p>
                                    <p className="text-[9px] font-bold text-green-700 uppercase tracking-wide leading-tight">Legales<br/>100%</p>
                                </div>
                                <div className="bg-amber-50 p-2 rounded-xl border border-amber-100">
                                    <p className="text-lg font-black text-amber-600">{stats.prtStats.help}</p>
                                    <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide leading-tight">Aprob.<br/>Ayuda</p>
                                </div>
                                <div className="bg-red-50 p-2 rounded-xl border border-red-100">
                                    <p className="text-lg font-black text-red-600">{stats.prtStats.rejected}</p>
                                    <p className="text-[9px] font-bold text-red-700 uppercase tracking-wide leading-tight">Rechazos<br/>PRT</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. VIAJES A REGIONES VS KILOMETRAJE HOY */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-3xl shadow-sm text-white flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-slate-200">Operación en Terreno</h3>
                        <Navigation className="w-5 h-5 text-slate-500" />
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="flex-1 bg-white/10 p-4 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase text-amber-400 mb-1">Traslados a Región</p>
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-black text-white">{stats.regionJobs || 0}</p>
                                <p className="text-xs font-bold text-slate-400 mb-1">viajes largos</p>
                            </div>
                        </div>
                        <div className="flex-1 bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/30">
                            <p className="text-[10px] font-black uppercase text-emerald-300 mb-1">Kilómetros Hoy</p>
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-black text-white">{stats.todayKm || 0}</p>
                                <p className="text-xs font-bold text-emerald-200 mb-1">km rutados</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. TABLA DE KILOMETRAJE POR CONDUCTOR */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                        <div className="bg-indigo-100 p-2 rounded-xl"><Map className="w-4 h-4 text-indigo-600"/></div>
                        <h3 className="font-extrabold text-slate-800">Kilómetros por Conductor</h3>
                    </div>
                    
                    {(!stats.topDriversKm || stats.topDriversKm.length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay kilómetros registrados este mes.</p>
                    ) : (
                        <div className="overflow-x-auto scrollbar-none -mx-2 px-2">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="pb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 w-8">Pos.</th>
                                        <th className="pb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">Conductor</th>
                                        <th className="pb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right border-b border-slate-100">Distancia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topDriversKm.map(([name, km], idx) => (
                                        <tr key={name} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 pr-2 border-b border-slate-50 text-center">
                                                <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-black ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2 border-b border-slate-50">
                                                <p className="text-xs font-bold text-slate-700 whitespace-nowrap">{name}</p>
                                            </td>
                                            <td className="py-2.5 pl-1 border-b border-slate-50 text-right">
                                                <span className="text-xs font-black text-indigo-600">{Math.round(km).toLocaleString('es-CL')} <span className="text-[9px] text-indigo-400 uppercase tracking-widest ml-0.5">km</span></span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 5. ESPECIALIZACIÓN POR TIPO DE VEHÍCULO */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                        <div className="bg-blue-100 p-2 rounded-xl"><Car className="w-4 h-4 text-blue-600"/></div>
                        <h3 className="font-extrabold text-slate-800">Líderes por Tipo de Vehículo</h3>
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
                                { key: 'carro_arrastre', label: 'CARRO DE ARRASTRE' }
                            ].map(({ key, label }) => {
                                const leader = stats.topDriversByCategory[key];
                                if (!leader) return null;

                                return (
                                    <div key={key} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider truncate">{label}</span>
                                            <span className="text-xs font-bold text-slate-800 truncate">{leader.name}</span>
                                        </div>
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-black shrink-0">
                                            {leader.count} viajes
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 6. VEHÍCULOS MÁS MOVIDOS (PATENTES REPETIDAS) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                        <div className="bg-rose-100 p-2 rounded-xl"><Repeat className="w-4 h-4 text-rose-600"/></div>
                        <h3 className="font-extrabold text-slate-800">Vehículos Frecuentes del Mes</h3>
                    </div>
                    
                    {(!stats.topPlates || stats.topPlates.length === 0) ? (
                        <p className="text-xs text-center text-slate-400 font-bold py-4">No hay patentes registradas este mes.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {stats.topPlates.map(([plate, count], idx) => (
                                <div key={plate} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{idx + 1}</span>
                                        <div className="bg-white border-2 border-slate-800 text-slate-800 px-2 py-0.5 rounded-md text-xs font-black tracking-widest shadow-sm">
                                            {plate}
                                        </div>
                                    </div>
                                    <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider border border-rose-100">
                                        {count} VIAJES
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}