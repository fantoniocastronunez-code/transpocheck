import React, { useMemo } from 'react';
import { 
  Trophy, Car, Wallet, Clock, ChevronRight, FileText, 
  CheckCircle, Star, Navigation, TrendingUp, Shield, 
  AlertTriangle, MapPin, Zap, Award, Route, Fuel, User
} from 'lucide-react';
import { formatMoney } from '../../utils/helpers';
import LicensePlateBadge from '../ui/LicensePlateBadge';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Helper para parsear distancias (copiado de StatsView para coherencia)
const parseDist = (str) => {
  if (!str) return 0;
  let s = str.toLowerCase().replace(/[^\d.,]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes('.') && s.split('.').pop().length === 3) s = s.replace(/\./g, '');
  return parseFloat(s) || 0;
};

export default function DriverDashboardView({ myDriver, jobs, expenses, drivers, currentUserEmail }) {
  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();

  const stats = useMemo(() => {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Todos mis trabajos
    const myJobs = jobs.filter(j => 
      j.acceptedByEmail === currentUserEmail || 
      (!j.acceptedByEmail && j.assignedEmails?.includes(currentUserEmail))
    );

    // Completados este mes
    const monthlyCompleted = myJobs.filter(j => {
      const jobDate = j.completedAt || j.createdAt || 0;
      return jobDate >= firstOfMonth && j.status === 'completed';
    });

    // Total completados histórico
    const totalCompleted = myJobs.filter(j => j.status === 'completed').length;

    // --- KILOMETRAJE ---
    let monthlyKm = 0;
    let totalKm = 0;
    myJobs.filter(j => j.status === 'completed').forEach(j => {
      if (j.drivenDistance && j.drivenDistance.includes('km')) {
        const km = parseDist(j.drivenDistance);
        totalKm += km;
        const jobDate = j.completedAt || j.createdAt || 0;
        if (jobDate >= firstOfMonth) monthlyKm += km;
      }
    });

    // --- RANKING (Misma lógica exacta que LeaderboardView) ---
    const monthlyCompletedAll = jobs.filter(j => {
      const jobDate = j.completedAt || j.createdAt || 0;
      return jobDate >= firstOfMonth && j.status === 'completed';
    });

    const ranking = drivers.filter(d => !d.isHidden).map(d => {
      const dj = monthlyCompletedAll.filter(j => 
        j.acceptedByEmail === d.email || (!j.acceptedByEmail && j.assignedEmails?.includes(d.email))
      );
      const validScoreJobs = dj.filter(j => {
        const isService = j.tripType === 'simple' || j.isPintura;
        return isService ? !!j.forceRanking : !j.excludeFromRanking;
      });
      return { email: d.email, score: validScoreJobs.length };
    }).sort((a, b) => b.score - a.score);

    const uniqueScores = [...new Set(ranking.map(d => d.score))].sort((a, b) => b - a);
    const myRankEntry = ranking.find(r => r.email === currentUserEmail);
    const myRankPosition = myRankEntry ? uniqueScores.indexOf(myRankEntry.score) + 1 : null;
    const myScore = myRankEntry?.score || 0;

    // --- DESGLOSE POR TIPO ---
    const traslados = monthlyCompleted.filter(j => j.tripType === 'traslado' || (!j.tripType && j.tripType !== 'simple' && j.tripType !== 'revision' && j.tripType !== 'viaje')).length;
    const prt = monthlyCompleted.filter(j => j.tripType === 'revision').length;
    const servicios = monthlyCompleted.filter(j => j.tripType === 'simple').length;
    const viajes = monthlyCompleted.filter(j => j.tripType === 'viaje').length;

    // --- ÚLTIMOS TRABAJOS (8 más recientes) ---
    const recentJobs = myJobs
      .filter(j => j.status === 'completed' || j.status === 'failed')
      .sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0))
      .slice(0, 8);

    // --- TRABAJOS ACTIVOS ---
    const activeJobs = myJobs.filter(j => j.status === 'accepted' || j.status === 'pending').length;

    // --- RACHA (días consecutivos con al menos 1 trabajo completado) ---
    let streak = 0;
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    for (let i = 0; i < 60; i++) {
      const dayStart = todayMs - (i * 86400000);
      const dayEnd = dayStart + 86400000;
      const hasJob = myJobs.some(j => {
        const t = j.completedAt || j.createdAt || 0;
        return t >= dayStart && t < dayEnd && j.status === 'completed';
      });
      if (hasJob) streak++;
      else if (i > 0) break; // Si hoy no tiene, igual permitimos que sea 0, pero rompemos en cualquier otro día sin trabajo
    }

    return {
      monthlyCompleted: monthlyCompleted.length,
      totalCompleted,
      monthlyKm: Math.round(monthlyKm),
      totalKm: Math.round(totalKm),
      rankPosition: myRankPosition,
      totalDrivers: ranking.length,
      myScore,
      breakdown: { traslados, prt, servicios, viajes },
      recentJobs,
      activeJobs,
      streak
    };
  }, [jobs, drivers, currentUserEmail]);

  // --- ESTADO DE LICENCIA ---
  const licenseStatus = useMemo(() => {
    if (!myDriver?.licenseExpiry) return { status: 'unknown', text: 'Sin dato', color: 'slate' };
    const [y, m] = myDriver.licenseExpiry.split('-');
    if (!y || !m) return { status: 'unknown', text: 'Sin dato', color: 'slate' };
    const expiryDate = new Date(parseInt(y), parseInt(m), 0); // último día del mes
    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { status: 'expired', text: 'Vencida', color: 'red' };
    if (daysLeft <= 30) return { status: 'critical', text: `Vence en ${daysLeft} días`, color: 'red' };
    if (daysLeft <= 90) return { status: 'warning', text: `Vence en ${Math.ceil(daysLeft / 30)} meses`, color: 'amber' };
    return { status: 'ok', text: 'Vigente', color: 'green' };
  }, [myDriver]);

  // --- FECHA LEGIBLE DE "MIEMBRO DESDE" ---
  const memberSince = useMemo(() => {
    if (!myDriver?.createdAt) return '';
    const d = new Date(myDriver.createdAt);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, [myDriver]);

  // --- CÁLCULO DE BARRA MÁS GRANDE (para escala relativa) ---
  const maxBreakdown = Math.max(stats.breakdown.traslados, stats.breakdown.prt, stats.breakdown.servicios, stats.breakdown.viajes, 1);

  // --- RANKING MEDAL ---
  const getRankIcon = (pos) => {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return `#${pos}`;
  };

  return (
    <main className="max-w-2xl mx-auto p-4 pt-20 sm:pt-24 pb-32 animate-in fade-in duration-500">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECCIÓN 1: HERO CARD DEL CONDUCTOR                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-3xl overflow-hidden shadow-2xl mb-6">
        {/* Patrón decorativo de fondo */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl translate-y-8 -translate-x-8" />
        
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-[3px] border-white/20 shadow-xl ring-4 ring-white/5">
              {myDriver?.photo ? (
                <img src={myDriver.photo} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <User className="w-12 h-12 text-slate-500" />
                </div>
              )}
            </div>
            {/* Badge de ranking sobre el avatar */}
            {stats.rankPosition && stats.rankPosition <= 3 && (
              <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-slate-900 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shadow-lg shadow-yellow-400/30 border-2 border-yellow-300">
                {getRankIcon(stats.rankPosition)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">{myDriver?.name || 'Conductor'}</h2>
            <p className="text-sm font-bold text-slate-400 truncate mt-0.5">{currentUserEmail}</p>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              {memberSince && (
                <span className="bg-white/10 backdrop-blur-sm text-white/70 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/10">
                  Desde {memberSince}
                </span>
              )}
              {myDriver?.licenses?.length > 0 && (
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-blue-400/20">
                  {myDriver.licenses.join(' · ')}
                </span>
              )}
            </div>

            {/* Racha */}
            {stats.streak > 0 && (
              <div className="mt-3 flex items-center justify-center sm:justify-start gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-amber-400">{stats.streak} {stats.streak === 1 ? 'día' : 'días'} consecutivos trabajando</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECCIÓN 2: 4 TARJETAS DE MÉTRICAS                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        
        {/* Ranking */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-400/5 dark:bg-yellow-400/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-125 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-yellow-100 dark:bg-yellow-900/40 p-2 rounded-xl"><Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" /></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ranking</span>
            </div>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {stats.rankPosition ? getRankIcon(stats.rankPosition) : '-'}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">de {stats.totalDrivers} conductores</p>
          </div>
        </div>

        {/* Trabajos del Mes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-400/5 dark:bg-blue-400/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-125 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-xl"><Car className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Este Mes</span>
            </div>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.monthlyCompleted}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">{stats.totalCompleted} total histórico</p>
          </div>
        </div>

        {/* Kilometraje */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-400/5 dark:bg-emerald-400/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-125 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-xl"><Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Km Mes</span>
            </div>
            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.monthlyKm.toLocaleString('es-CL')}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">{stats.totalKm.toLocaleString('es-CL')} km totales</p>
          </div>
        </div>

        {/* Balance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-20 h-20 bg-violet-400/5 dark:bg-violet-400/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-125 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-violet-100 dark:bg-violet-900/40 p-2 rounded-xl"><Wallet className="w-4 h-4 text-violet-600 dark:text-violet-400" /></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo</span>
            </div>
            <p className={`text-2xl font-black ${(myDriver?.balance || 0) >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>
              {formatMoney(myDriver?.balance || 0)}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Disponible para gastos</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECCIÓN 3: ESTADO DE DOCUMENTOS                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" /> Mis Documentos
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {/* Licencia de Conducir */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                licenseStatus.color === 'green' ? 'bg-green-500 shadow-sm shadow-green-500/30' :
                licenseStatus.color === 'amber' ? 'bg-amber-500 shadow-sm shadow-amber-500/30 animate-pulse' :
                licenseStatus.color === 'red' ? 'bg-red-500 shadow-sm shadow-red-500/30 animate-pulse' :
                'bg-slate-300 dark:bg-slate-600'
              }`} />
              <div>
                <p className="text-xs font-black text-slate-700 dark:text-slate-300">Licencia de Conducir</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {myDriver?.licenseExpiry ? `Venc: ${myDriver.licenseExpiry.split('-').reverse().join('/')}` : 'Sin fecha registrada'}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
              licenseStatus.color === 'green' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' :
              licenseStatus.color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' :
              licenseStatus.color === 'red' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50' :
              'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              {licenseStatus.text}
            </span>
          </div>

          {/* Documentos Fotográficos */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                myDriver?.photo && myDriver?.idFront && myDriver?.idBack && myDriver?.licenseFront && myDriver?.licenseBack
                  ? 'bg-green-500 shadow-sm shadow-green-500/30'
                  : 'bg-amber-500 shadow-sm shadow-amber-500/30 animate-pulse'
              }`} />
              <div>
                <p className="text-xs font-black text-slate-700 dark:text-slate-300">Documentos Fotográficos</p>
                <p className="text-[10px] font-bold text-slate-400">
                  Selfie, Carnet (2), Licencia (2)
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
              myDriver?.photo && myDriver?.idFront && myDriver?.idBack && myDriver?.licenseFront && myDriver?.licenseBack
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
            }`}>
              {myDriver?.photo && myDriver?.idFront && myDriver?.idBack && myDriver?.licenseFront && myDriver?.licenseBack ? 'Completo' : 'Incompleto'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECCIÓN 4: DESGLOSE MENSUAL POR TIPO                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Rendimiento — {currentMonthName} {currentYear}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Barra: Traslados Locales */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-emerald-500" /> Traslados Locales
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{stats.breakdown.traslados}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-inner"
                style={{ width: `${Math.max((stats.breakdown.traslados / maxBreakdown) * 100, stats.breakdown.traslados > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>

          {/* Barra: PRT */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" /> Revisiones Técnicas
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{stats.breakdown.prt}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-1000 ease-out shadow-inner"
                style={{ width: `${Math.max((stats.breakdown.prt / maxBreakdown) * 100, stats.breakdown.prt > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>

          {/* Barra: Viajes a Regiones */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" /> Viajes a Regiones
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{stats.breakdown.viajes}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-1000 ease-out shadow-inner"
                style={{ width: `${Math.max((stats.breakdown.viajes / maxBreakdown) * 100, stats.breakdown.viajes > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>

          {/* Barra: Servicios */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-500" /> Servicios en Terreno
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{stats.breakdown.servicios}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full transition-all duration-1000 ease-out shadow-inner"
                style={{ width: `${Math.max((stats.breakdown.servicios / maxBreakdown) * 100, stats.breakdown.servicios > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>

          {/* Total en texto */}
          {stats.monthlyCompleted === 0 && (
            <p className="text-xs text-center font-bold text-slate-400 pt-2">Aún no has completado trabajos este mes.</p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECCIÓN 5: ACTIVIDAD RECIENTE                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Actividad Reciente
          </h3>
          {stats.activeJobs > 0 && (
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider animate-pulse border border-blue-200 dark:border-blue-800/50">
              {stats.activeJobs} {stats.activeJobs === 1 ? 'activo' : 'activos'}
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {stats.recentJobs.length === 0 ? (
            <div className="p-8 text-center">
              <Car className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">Sin actividad registrada.</p>
            </div>
          ) : (
            stats.recentJobs.map(j => {
              const date = j.completedAt ? new Date(j.completedAt) : (j.createdAt ? new Date(j.createdAt) : null);
              const dateStr = date ? `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}` : '';
              const isFailed = j.status === 'failed';
              const isService = j.tripType === 'simple';
              const isPRT = j.tripType === 'revision';
              
              return (
                <div key={j.id} className="flex items-center gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  {/* Icono de estado */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    isFailed ? 'bg-red-100 dark:bg-red-900/30' :
                    isPRT ? 'bg-amber-100 dark:bg-amber-900/30' :
                    isService ? 'bg-purple-100 dark:bg-purple-900/30' :
                    'bg-emerald-100 dark:bg-emerald-900/30'
                  }`}>
                    {isFailed ? <AlertTriangle className="w-5 h-5 text-red-500" /> :
                     isPRT ? <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" /> :
                     isService ? <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" /> :
                     <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                  </div>

                  {/* Info del trabajo */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${isFailed ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {isService ? (j.description || 'Servicio en Terreno') : `${j.brand || ''} ${j.model || ''}`.trim() || 'Vehículo'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 truncate">
                      {j.client || 'Sin cliente'} · {j.origin || '-'} → {j.destination || '-'}
                    </p>
                  </div>

                  {/* Placa y fecha */}
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 tracking-wider">{j.plate || j.vin || 'S/N'}</p>
                    <p className="text-[10px] font-bold text-slate-400">{dateStr}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer inspiracional */}
      <div className="mt-6 text-center">
        <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">
          LogisticAPP · Dashboard del Conductor
        </p>
      </div>

    </main>
  );
}
