import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity, Search, X, ChevronDown, ChevronRight, Filter,
  Zap, Truck, Wallet, UserPlus, Clock, RefreshCw, Eye
} from 'lucide-react';
import {
  deriveActivitiesFromJobs,
  deriveActivitiesFromExpenses,
  deriveActivitiesFromDrivers,
  mergeAndSortActivities,
  groupActivitiesByTime,
  formatRelativeTime,
  formatAbsoluteTime,
  FILTER_CATEGORIES
} from '../../utils/activityHelpers';

// ══════════════════════════════════════════════════════
// COMPONENTE: AVATAR INTELIGENTE
// ══════════════════════════════════════════════════════
const ActorAvatar = ({ actor, size = 'md' }) => {
  const sizes = {
    sm: 'w-7 h-7 text-[9px]',
    md: 'w-9 h-9 text-[10px]',
    lg: 'w-11 h-11 text-xs'
  };
  
  if (actor?.photo) {
    return (
      <div className={`${sizes[size]} rounded-xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm shrink-0`}>
        <img src={actor.photo} alt={actor.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  
  return (
    <div className={`${sizes[size]} rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center font-black text-white border-2 border-white dark:border-slate-800 shadow-sm shrink-0`}>
      {actor?.initials || '??'}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// COMPONENTE: TARJETA DE EVENTO (EL CORAZÓN VISUAL)
// ══════════════════════════════════════════════════════
const ActivityCard = ({ activity, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const IconComponent = activity.type.icon;
  const isRecent = (Date.now() - activity.timestamp) < 600000; // 10 min

  return (
    <div className="flex gap-3 group relative">
      {/* LÍNEA VERTICAL CONECTORA */}
      <div className="flex flex-col items-center shrink-0 relative">
        {/* Dot con icono */}
        <div className={`relative z-10 w-10 h-10 rounded-2xl ${activity.type.bgLight} flex items-center justify-center shadow-sm border border-white/50 dark:border-slate-700/50 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${isRecent ? 'ring-2 ring-offset-2 dark:ring-offset-slate-900 ring-blue-400/50 animate-pulse' : ''}`}>
          <IconComponent className={`w-4.5 h-4.5 ${activity.type.textColor}`} />
        </div>
        {/* Línea conectora vertical */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-200 dark:from-slate-700 to-transparent min-h-[20px]" />
        )}
      </div>

      {/* TARJETA DE CONTENIDO */}
      <div 
        className="flex-1 mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group-hover:border-slate-200 dark:group-hover:border-slate-700 ${isRecent ? 'border-l-[3px] ' + activity.type.borderColor : ''}`}>
          <div className="p-3.5 sm:p-4">
            {/* Fila superior: Actor + Timestamp */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <ActorAvatar actor={activity.actor} size="sm" />
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{activity.actor?.name || 'Sistema'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {isRecent && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums" title={new Date(activity.timestamp).toLocaleString()}>
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            </div>

            {/* Tipo de evento (badge) */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`${activity.type.bgLight} ${activity.type.textColor} px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest`}>
                {activity.type.label}
              </span>
            </div>

            {/* Título y Descripción */}
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-snug">{activity.title}</h4>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{activity.description}</p>

            {/* Subtítulo (ruta, distancia, etc.) */}
            {activity.subtitle && (
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 truncate italic">{activity.subtitle}</p>
            )}

            {/* Detalles expandibles */}
            {isExpanded && activity.meta && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                {activity.meta.plate && activity.meta.plate !== 'S/N' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Patente</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg tracking-wider">{activity.meta.plate}</span>
                  </div>
                )}
                {activity.meta.client && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Cliente</span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{activity.meta.client}</span>
                  </div>
                )}
                {activity.meta.brand && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Vehículo</span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{activity.meta.brand} {activity.meta.model || ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Hora</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums">{formatAbsoluteTime(activity.timestamp)} — {new Date(activity.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════
// COMPONENTE: GRUPO TEMPORAL
// ══════════════════════════════════════════════════════
const TimeGroup = ({ group }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isLive = group.key === 'now';

  return (
    <div className="mb-2">
      {/* Header del grupo */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 mb-4 group/header w-full text-left"
      >
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-colors ${
          isLive 
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
        }`}>
          {isLive && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-600"></span>
            </span>
          )}
          {group.label}
          <span className="bg-white/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded-md text-[9px] ml-0.5">{group.items.length}</span>
        </div>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>

      {/* Eventos del grupo */}
      {!isCollapsed && (
        <div className="pl-0 animate-in fade-in slide-in-from-top-2 duration-300">
          {group.items.map((activity, idx) => (
            <ActivityCard key={activity.id} activity={activity} isLast={idx === group.items.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: ACTIVITY VIEW
// ══════════════════════════════════════════════════════
export default function ActivityView({ jobs, drivers, expenses, currentUserEmail, activeRole }) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month'
  const [showFilters, setShowFilters] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(80);
  const [nowTick, setNowTick] = useState(Date.now());

  // Reloj en vivo: actualiza los timestamps relativos cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── MOTOR DE DERIVACIÓN ───
  const allActivities = useMemo(() => {
    const fromJobs = deriveActivitiesFromJobs(jobs, drivers);
    const fromExpenses = deriveActivitiesFromExpenses(expenses);
    const fromDrivers = deriveActivitiesFromDrivers(drivers);
    return mergeAndSortActivities(fromJobs, fromExpenses, fromDrivers);
  }, [jobs, drivers, expenses]);

  // ─── FILTROS ───
  const filteredActivities = useMemo(() => {
    let result = allActivities;

    // Filtro por categoría
    if (categoryFilter !== 'all') {
      result = result.filter(a => a.type.category === categoryFilter);
    }

    // Filtro por conductor
    if (driverFilter) {
      result = result.filter(a => 
        a.actor?.name?.toLowerCase().includes(driverFilter.toLowerCase()) ||
        a.meta?.driverEmail?.toLowerCase().includes(driverFilter.toLowerCase())
      );
    }

    // Filtro por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a =>
        a.title?.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term) ||
        a.subtitle?.toLowerCase().includes(term) ||
        a.actor?.name?.toLowerCase().includes(term) ||
        a.meta?.plate?.toLowerCase().includes(term) ||
        a.meta?.client?.toLowerCase().includes(term)
      );
    }

    // Filtro por fecha
    if (dateFilter !== 'all') {
      const now = new Date();
      let threshold = 0;
      if (dateFilter === 'today') {
        threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      } else if (dateFilter === 'yesterday') {
        threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      } else if (dateFilter === 'week') {
        threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
      } else if (dateFilter === 'month') {
        threshold = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      }
      result = result.filter(a => a.timestamp >= threshold);
    }

    return result;
  }, [allActivities, categoryFilter, driverFilter, searchTerm, dateFilter, nowTick]);

  // ─── AGRUPACIÓN ───
  const displayedActivities = filteredActivities.slice(0, displayLimit);
  const groups = useMemo(() => groupActivitiesByTime(displayedActivities), [displayedActivities, nowTick]);
  const hasMore = filteredActivities.length > displayLimit;

  // ─── STATS EN VIVO ───
  const liveStats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();
    
    const todayEvents = allActivities.filter(a => a.timestamp >= todayTs).length;
    
    const activeDrivers = new Set(
      (jobs || [])
        .filter(j => j.status === 'accepted')
        .map(j => j.acceptedByEmail)
        .filter(Boolean)
    ).size;

    const todayJobs = (jobs || []).filter(j => {
      const t = j.completedAt || j.createdAt || 0;
      return t >= todayTs && (j.status === 'completed' || j.status === 'accepted');
    }).length;

    return { todayEvents, activeDrivers, todayJobs };
  }, [allActivities, jobs, nowTick]);

  // ─── LISTA DE CONDUCTORES PARA FILTRO ───
  const driversList = useMemo(() => {
    if (!Array.isArray(drivers)) return [];
    return drivers
      .filter(d => !d.isHidden && d.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drivers]);

  return (
    <main className="max-w-2xl mx-auto p-4 pt-20 sm:pt-24 pb-32 animate-in fade-in duration-500">

      {/* ═══════════════════════════════════════════════════ */}
      {/* HERO BANNER — STATS EN VIVO                       */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-3xl overflow-hidden shadow-2xl mb-6">
        {/* Patrón decorativo */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl translate-y-8 -translate-x-8" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

        <div className="relative p-6 sm:p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Bitácora</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Centro de Actividad</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-emerald-400/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">En Vivo</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3.5 border border-white/5 hover:bg-white/10 transition-colors">
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{liveStats.todayEvents}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Eventos Hoy</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3.5 border border-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-baseline gap-1">
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">{liveStats.activeDrivers}</p>
                {liveStats.activeDrivers > 0 && <span className="text-[9px] font-bold text-emerald-600 animate-pulse">●</span>}
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">En Ruta</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3.5 border border-white/5 hover:bg-white/10 transition-colors">
              <p className="text-2xl sm:text-3xl font-black text-blue-400 tabular-nums">{liveStats.todayJobs}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Trabajos</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FILTROS RÁPIDOS (CATEGORY CHIPS)                  */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_CATEGORIES.map(cat => {
          const IconComp = cat.icon;
          const isActive = categoryFilter === cat.id;
          const count = cat.id === 'all' ? allActivities.length : allActivities.filter(a => a.type.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-300/30 dark:shadow-none scale-[1.02]'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              {cat.label}
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 dark:bg-slate-900/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* BARRA DE BÚSQUEDA + FILTROS AVANZADOS             */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="space-y-3 mb-6">
        {/* Búsqueda */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por patente, conductor, cliente..."
              className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl border-2 transition-all shrink-0 ${
              showFilters || driverFilter || dateFilter !== 'all'
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200/50 dark:shadow-none'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Filtros avanzados (expandibles) */}
        {showFilters && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4 space-y-4 animate-in slide-in-from-top-3 duration-300 shadow-sm">
            {/* Filtro por Conductor */}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Filtrar por Conductor</label>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500"
              >
                <option value="">Todos los conductores</option>
                {driversList.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Rango de Fecha */}
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Período</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'all', label: 'Todo' },
                  { id: 'today', label: 'Hoy' },
                  { id: 'yesterday', label: 'Ayer' },
                  { id: 'week', label: 'Semana' },
                  { id: 'month', label: 'Mes' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setDateFilter(opt.id)}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                      dateFilter === opt.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón Limpiar */}
            {(driverFilter || dateFilter !== 'all') && (
              <button
                onClick={() => { setDriverFilter(''); setDateFilter('all'); }}
                className="w-full py-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl text-xs font-black transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* INDICADOR DE RESULTADOS                           */}
      {/* ═══════════════════════════════════════════════════ */}
      {(searchTerm || categoryFilter !== 'all' || driverFilter || dateFilter !== 'all') && (
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filteredActivities.length} {filteredActivities.length === 1 ? 'resultado' : 'resultados'}
          </p>
          <button
            onClick={() => { setSearchTerm(''); setCategoryFilter('all'); setDriverFilter(''); setDateFilter('all'); }}
            className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider hover:underline"
          >
            Ver todo
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TIMELINE PRINCIPAL                                */}
      {/* ═══════════════════════════════════════════════════ */}
      {groups.length > 0 ? (
        <div className="space-y-2">
          {groups.map(group => (
            <TimeGroup key={group.key} group={group} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 text-center shadow-sm">
          <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-300 mb-1">Sin actividad</h3>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 max-w-[250px] mx-auto leading-relaxed">
            {searchTerm || categoryFilter !== 'all' || driverFilter
              ? 'No hay eventos que coincidan con tus filtros. Intenta con otros criterios.'
              : 'Aún no hay actividad registrada. Los eventos aparecerán aquí en tiempo real.'}
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* BOTÓN CARGAR MÁS                                 */}
      {/* ═══════════════════════════════════════════════════ */}
      {hasMore && (
        <button
          onClick={() => setDisplayLimit(prev => prev + 50)}
          className="w-full mt-6 py-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-extrabold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Cargar más ({filteredActivities.length - displayLimit} restantes)
        </button>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* FOOTER INFORMATIVO                                */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="mt-6 text-center">
        <p className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest">
          {allActivities.length} eventos totales · Actualización automática cada 30s
        </p>
      </div>

    </main>
  );
}
