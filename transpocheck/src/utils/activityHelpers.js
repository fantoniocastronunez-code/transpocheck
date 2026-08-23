// src/utils/activityHelpers.js
// Motor de derivación de eventos para la Bitácora / Centro de Actividad
// Extrae actividades de datos existentes SIN modificar otros módulos

import {
  Car, CheckCircle, XCircle, MapPin, Wallet, ArrowUpCircle,
  ArrowDownCircle, Clock, UserPlus, Truck, Navigation, Fuel,
  AlertTriangle, FileText, Repeat, Receipt, Flag, Zap
} from 'lucide-react';

// ══════════════════════════════════════════════════════
// 1. CATÁLOGO DE TIPOS DE EVENTO
// ══════════════════════════════════════════════════════
export const EVENT_TYPES = {
  JOB_CREATED:       { id: 'job_created',       label: 'Trabajo Creado',        category: 'jobs',    color: 'blue',    bgLight: 'bg-blue-100 dark:bg-blue-900/40',    textColor: 'text-blue-600 dark:text-blue-400',    borderColor: 'border-blue-500',  icon: FileText },
  JOB_ACCEPTED:      { id: 'job_accepted',      label: 'Trabajo Aceptado',      category: 'jobs',    color: 'emerald', bgLight: 'bg-emerald-100 dark:bg-emerald-900/40', textColor: 'text-emerald-600 dark:text-emerald-400', borderColor: 'border-emerald-500', icon: CheckCircle },
  JOB_ARRIVED_PICKUP:{ id: 'job_arrived_pickup', label: 'Llegó a Retirar',       category: 'jobs',    color: 'amber',   bgLight: 'bg-amber-100 dark:bg-amber-900/40',   textColor: 'text-amber-600 dark:text-amber-400',   borderColor: 'border-amber-500', icon: MapPin },
  JOB_PICKED_UP:     { id: 'job_picked_up',     label: 'Vehículo Recogido',     category: 'jobs',    color: 'indigo',  bgLight: 'bg-indigo-100 dark:bg-indigo-900/40',  textColor: 'text-indigo-600 dark:text-indigo-400',  borderColor: 'border-indigo-500', icon: Car },
  JOB_IN_ROUTE:      { id: 'job_in_route',      label: 'En Ruta a Destino',     category: 'jobs',    color: 'sky',     bgLight: 'bg-sky-100 dark:bg-sky-900/40',       textColor: 'text-sky-600 dark:text-sky-400',       borderColor: 'border-sky-500',   icon: Navigation },
  JOB_ARRIVED_DEST:  { id: 'job_arrived_dest',  label: 'Llegó a Destino',       category: 'jobs',    color: 'violet',  bgLight: 'bg-violet-100 dark:bg-violet-900/40',  textColor: 'text-violet-600 dark:text-violet-400',  borderColor: 'border-violet-500', icon: Flag },
  JOB_COMPLETED:     { id: 'job_completed',     label: 'Trabajo Completado',    category: 'jobs',    color: 'green',   bgLight: 'bg-green-100 dark:bg-green-900/40',    textColor: 'text-green-600 dark:text-green-400',    borderColor: 'border-green-500', icon: CheckCircle },
  JOB_FAILED:        { id: 'job_failed',        label: 'Trabajo Fallido',       category: 'jobs',    color: 'red',     bgLight: 'bg-red-100 dark:bg-red-900/40',       textColor: 'text-red-600 dark:text-red-400',       borderColor: 'border-red-500',   icon: XCircle },
  JOB_RELAYED:       { id: 'job_relayed',       label: 'Relevo de Conductor',   category: 'jobs',    color: 'purple',  bgLight: 'bg-purple-100 dark:bg-purple-900/40',  textColor: 'text-purple-600 dark:text-purple-400',  borderColor: 'border-purple-500', icon: Repeat },
  EXP_ASSIGNMENT:    { id: 'exp_assignment',    label: 'Fondos Asignados',      category: 'expenses', color: 'emerald', bgLight: 'bg-emerald-100 dark:bg-emerald-900/40', textColor: 'text-emerald-600 dark:text-emerald-400', borderColor: 'border-emerald-500', icon: ArrowUpCircle },
  EXP_EXPENSE:       { id: 'exp_expense',       label: 'Gasto Registrado',      category: 'expenses', color: 'orange',  bgLight: 'bg-orange-100 dark:bg-orange-900/40',  textColor: 'text-orange-600 dark:text-orange-400',  borderColor: 'border-orange-500', icon: ArrowDownCircle },
  EXP_RETURN_PENDING:{ id: 'exp_return_pending',label: 'Rendición Enviada',     category: 'expenses', color: 'amber',   bgLight: 'bg-amber-100 dark:bg-amber-900/40',   textColor: 'text-amber-600 dark:text-amber-400',   borderColor: 'border-amber-500', icon: Clock },
  EXP_RETURN_APPROVED:{ id: 'exp_return_approved',label: 'Rendición Aprobada',  category: 'expenses', color: 'green',   bgLight: 'bg-green-100 dark:bg-green-900/40',    textColor: 'text-green-600 dark:text-green-400',    borderColor: 'border-green-500', icon: CheckCircle },
  DRIVER_REGISTERED: { id: 'driver_registered', label: 'Nuevo Conductor',       category: 'team',    color: 'cyan',    bgLight: 'bg-cyan-100 dark:bg-cyan-900/40',     textColor: 'text-cyan-600 dark:text-cyan-400',     borderColor: 'border-cyan-500',  icon: UserPlus },
};

// ══════════════════════════════════════════════════════
// 2. DERIVAR EVENTOS DESDE TRABAJOS
// ══════════════════════════════════════════════════════
export function deriveActivitiesFromJobs(jobs, drivers) {
  if (!Array.isArray(jobs)) return [];
  const activities = [];
  const driverMap = {};
  if (Array.isArray(drivers)) {
    drivers.forEach(d => { if (d.email) driverMap[d.email.toLowerCase()] = d; });
  }

  const getDriverInfo = (email) => {
    if (!email) return { name: 'Sistema', initials: 'SYS', photo: null };
    const d = driverMap[email.toLowerCase()];
    if (d) {
      const parts = (d.name || '').split(' ');
      const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] || 'U').substring(0, 2).toUpperCase();
      return { name: d.name || email, initials, photo: d.photo || null };
    }
    return { name: email, initials: email.substring(0, 2).toUpperCase(), photo: null };
  };

  jobs.forEach(j => {
    const plate = j.plate || j.vin || 'S/N';
    const client = j.client || 'Sin Cliente';
    const jobMeta = { jobId: j.id, plate, client, brand: j.brand, model: j.model, tripType: j.tripType };

    // Evento: Trabajo Creado
    if (j.createdAt) {
      const creator = j.requestedBy || (j.assignedEmails?.[0]) || null;
      activities.push({
        id: `job-created-${j.id}`,
        type: EVENT_TYPES.JOB_CREATED,
        timestamp: j.createdAt,
        actor: getDriverInfo(creator),
        title: `Nuevo ${j.tripType === 'revision' ? 'PRT' : j.tripType === 'simple' ? 'Servicio' : j.tripType === 'viaje' ? 'Viaje' : 'Traslado'}`,
        description: `${plate} — ${client}`,
        subtitle: j.origin && j.destination ? `${j.origin} → ${j.destination}` : (j.origin || ''),
        meta: jobMeta
      });
    }

    // Evento: Trabajo Aceptado
    if (j.status !== 'pending' && j.acceptedByEmail && (j.arrivedPickupAt || j.createdAt)) {
      const acceptTime = j.arrivedPickupAt ? j.arrivedPickupAt - 120000 : j.createdAt + 60000;
      if (j.status === 'accepted' || j.status === 'completed' || j.status === 'failed') {
        activities.push({
          id: `job-accepted-${j.id}`,
          type: EVENT_TYPES.JOB_ACCEPTED,
          timestamp: acceptTime,
          actor: getDriverInfo(j.acceptedByEmail),
          title: 'Trabajo Aceptado',
          description: `${plate} — ${client}`,
          subtitle: `Aceptado por ${getDriverInfo(j.acceptedByEmail).name.split(' ')[0]}`,
          meta: jobMeta
        });
      }
    }

    // Evento: Llegó a Retirar
    if (j.arrivedPickupAt) {
      activities.push({
        id: `job-pickup-${j.id}`,
        type: EVENT_TYPES.JOB_ARRIVED_PICKUP,
        timestamp: j.arrivedPickupAt,
        actor: getDriverInfo(j.acceptedByEmail),
        title: j.tripType === 'simple' ? 'Llegó al Lugar' : 'Llegó a Retirar',
        description: `${plate} en ${j.origin || 'origen'}`,
        meta: jobMeta
      });
    }

    // Evento: Trabajo Completado
    if (j.status === 'completed' && j.completedAt) {
      activities.push({
        id: `job-completed-${j.id}`,
        type: EVENT_TYPES.JOB_COMPLETED,
        timestamp: j.completedAt,
        actor: getDriverInfo(j.acceptedByEmail),
        title: j.tripType === 'simple' ? 'Servicio Completado' : 'Traslado Completado',
        description: `${plate} — ${client}`,
        subtitle: j.drivenDistance ? `Distancia: ${j.drivenDistance}` : null,
        meta: jobMeta
      });
    }

    // Evento: Trabajo Fallido
    if (j.status === 'failed' && j.completedAt) {
      activities.push({
        id: `job-failed-${j.id}`,
        type: EVENT_TYPES.JOB_FAILED,
        timestamp: j.completedAt,
        actor: getDriverInfo(j.acceptedByEmail),
        title: j.tripType === 'revision' ? 'PRT Rechazada' : 'Trabajo Fallido',
        description: `${plate} — ${j.failedReason || 'Sin motivo'}`,
        meta: jobMeta
      });
    }
  });

  return activities;
}

// ══════════════════════════════════════════════════════
// 3. DERIVAR EVENTOS DESDE GASTOS
// ══════════════════════════════════════════════════════
export function deriveActivitiesFromExpenses(expenses) {
  if (!Array.isArray(expenses)) return [];
  return expenses.map(exp => {
    let type;
    switch (exp.type) {
      case 'assignment': type = EVENT_TYPES.EXP_ASSIGNMENT; break;
      case 'expense': type = EVENT_TYPES.EXP_EXPENSE; break;
      case 'pending_return': type = EVENT_TYPES.EXP_RETURN_PENDING; break;
      case 'return': type = EVENT_TYPES.EXP_RETURN_APPROVED; break;
      default: type = EVENT_TYPES.EXP_EXPENSE;
    }

    const parts = (exp.driverName || 'Usuario').split(' ');
    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();

    return {
      id: `exp-${exp.id}`,
      type,
      timestamp: exp.createdAt,
      actor: { name: exp.driverName || 'Desconocido', initials, photo: null },
      title: type.label,
      description: `$${Number(exp.amount || 0).toLocaleString('es-CL')} — ${exp.detail || 'Sin detalle'}`,
      meta: { expenseId: exp.id, driverEmail: exp.driverEmail }
    };
  });
}

// ══════════════════════════════════════════════════════
// 4. DERIVAR EVENTOS DESDE CONDUCTORES
// ══════════════════════════════════════════════════════
export function deriveActivitiesFromDrivers(drivers) {
  if (!Array.isArray(drivers)) return [];
  return drivers
    .filter(d => d.createdAt)
    .map(d => {
      const parts = (d.name || 'Nuevo').split(' ');
      const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
      return {
        id: `driver-reg-${d.id}`,
        type: EVENT_TYPES.DRIVER_REGISTERED,
        timestamp: d.createdAt,
        actor: { name: d.name || 'Usuario Nuevo', initials, photo: d.photo || null },
        title: 'Nuevo Conductor Registrado',
        description: d.name || d.email || 'Sin nombre',
        subtitle: d.email,
        meta: { driverId: d.id }
      };
    });
}

// ══════════════════════════════════════════════════════
// 5. MERGE, DEDUPLICAR Y ORDENAR
// ══════════════════════════════════════════════════════
export function mergeAndSortActivities(...activityArrays) {
  const all = activityArrays.flat().filter(a => a && a.timestamp);
  const seen = new Set();
  const unique = [];
  for (const a of all) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      unique.push(a);
    }
  }
  return unique.sort((a, b) => b.timestamp - a.timestamp);
}

// ══════════════════════════════════════════════════════
// 6. AGRUPACIÓN TEMPORAL INTELIGENTE
// ══════════════════════════════════════════════════════
export function groupActivitiesByTime(activities) {
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);

  const groups = [
    { label: 'Ahora mismo', key: 'now', items: [], threshold: now - 600000 },
    { label: 'Última hora', key: 'hour', items: [], threshold: now - 3600000 },
    { label: 'Hoy', key: 'today', items: [], threshold: todayStart.getTime() },
    { label: 'Ayer', key: 'yesterday', items: [], threshold: yesterdayStart.getTime() },
    { label: 'Esta semana', key: 'week', items: [], threshold: weekStart.getTime() },
    { label: 'Anteriores', key: 'older', items: [], threshold: 0 }
  ];

  activities.forEach(a => {
    for (const g of groups) {
      if (a.timestamp >= g.threshold) {
        g.items.push(a);
        break;
      }
    }
  });

  return groups.filter(g => g.items.length > 0);
}

// ══════════════════════════════════════════════════════
// 7. TIEMPO RELATIVO
// ══════════════════════════════════════════════════════
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'ahora';
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `hace ${mins} min`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `hace ${hours}h`;
  }
  if (diff < 172800000) return 'ayer';
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `hace ${days} días`;
  }

  const date = new Date(timestamp);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function formatAbsoluteTime(timestamp) {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ══════════════════════════════════════════════════════
// 8. CATEGORÍAS PARA FILTROS
// ══════════════════════════════════════════════════════
export const FILTER_CATEGORIES = [
  { id: 'all', label: 'Todos', icon: Zap },
  { id: 'jobs', label: 'Trabajos', icon: Truck },
  { id: 'expenses', label: 'Gastos', icon: Wallet },
  { id: 'team', label: 'Equipo', icon: UserPlus },
];
