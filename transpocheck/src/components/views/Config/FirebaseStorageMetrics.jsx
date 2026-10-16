// src/components/views/Config/FirebaseStorageMetrics.jsx
import React, { useState, useEffect } from 'react';
import { Cloud, HardDrive, RefreshCw, Trash2, ShieldCheck, Truck, Clock, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { formatBytes, scanStorageMetrics, purgeOrphanStoragePhotos } from '../../../utils/storageMetrics';

export default function FirebaseStorageMetrics({ db, storage, vehicles, showAlert, showConfirm }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [purging, setPurging] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Suscribirse a las métricas guardadas en Firestore para carga instantánea
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system_config', 'storage_metrics'), (snap) => {
      if (snap.exists()) {
        setMetrics(snap.data());
      }
      setLoading(false);
    }, (err) => {
      console.warn('[ERR-METRICS-SUBSCRIBE]', err);
      setLoading(false);
    });

    return () => unsub();
  }, [db]);

  const handleScan = async () => {
    if (scanning || purging) return;
    try {
      setScanning(true);
      setProgressMsg('Iniciando escaneo de Firebase Storage...');
      const result = await scanStorageMetrics(db, storage, (msg) => setProgressMsg(msg));
      setMetrics(result);
      showAlert(`✅ Escaneo de Storage completado: ${result.totalFiles} fotos/archivos (${formatBytes(result.totalBytes)}) encontrados.`);
    } catch (err) {
      console.error('[ERR-SCAN-STORAGE-UI-01]', err);
      showAlert('❌ Error al escanear métricas de Storage. [ERR-SCAN-STORAGE-UI-01]');
    } finally {
      setScanning(false);
      setProgressMsg('');
    }
  };

  const handlePurge = async () => {
    if (scanning || purging) return;

    const orphanCount = metrics?.orphanFiles || 0;
    const orphanSizeStr = formatBytes(metrics?.orphanBytes || 0);

    showConfirm(
      `⚠️ ¿Deseas escanear y eliminar las fotos huérfanas de Firebase Storage?\n\n` +
      (orphanCount > 0 
        ? `Se detectaron ${orphanCount} fotos (${orphanSizeStr}) de traslados eliminados en el pasado.\n\n` 
        : `Se buscarán fotos de traslados eliminados que hayan quedado ocupando espacio.\n\n`) +
      `Las fotos de documentos vehiculares (SOAP, RT, Padrón, etc.) están 100% protegidas y NO se borrarán.`,
      async () => {
        try {
          setPurging(true);
          setProgressMsg('Eliminando fotos huérfanas...');
          const result = await purgeOrphanStoragePhotos(db, storage, vehicles, (msg) => setProgressMsg(msg));
          
          if (result.deletedCount === 0) {
            showAlert('✅ No se encontraron fotos huérfanas. Tu almacenamiento en Storage está completamente al día.');
          } else {
            showAlert(`✅ ¡Barrido exitoso! Se eliminaron ${result.deletedCount} fotos huérfanas y se liberaron ${formatBytes(result.bytesFreed)} de Storage. Se conservaron ${result.protectedCount} documentos vehiculares protegidos.`);
          }
        } catch (err) {
          console.error('[ERR-PURGE-STORAGE-UI-01]', err);
          showAlert('❌ Error al eliminar fotos huérfanas. [ERR-PURGE-STORAGE-UI-01]');
        } finally {
          setPurging(false);
          setProgressMsg('');
        }
      }
    );
  };

  // Cuota gratuita de Firebase Storage = 5 GB
  const FREE_TIER_BYTES = 5 * 1024 * 1024 * 1024;
  const totalBytes = metrics?.totalBytes || 0;
  const usagePercent = Math.min(100, Math.max(0, ((totalBytes / FREE_TIER_BYTES) * 100))).toFixed(1);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER DE STORAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                Almacenamiento Firebase Cloud Storage
              </h3>
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                Nube Google
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Fotos de traslados, checklist y documentos vehiculares alojados en Storage.
            </p>
          </div>
        </div>

        {/* ACCIONES SUPERADMIN */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || purging}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-all active:scale-95 disabled:opacity-50"
            title="Escanear Storage y actualizar métricas"
          >
            <RefreshCw className={`w-4 h-4 text-blue-500 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Escaneando...' : 'Escanear Storage'}</span>
          </button>

          <button
            type="button"
            onClick={handlePurge}
            disabled={scanning || purging}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all active:scale-95 disabled:opacity-50 ${
              (metrics?.orphanFiles || 0) > 0
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md shadow-purple-500/20'
                : 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
            }`}
            title="Eliminar fotos de viajes antiguos sin tocar documentos"
          >
            <Trash2 className="w-4 h-4" />
            <span>{purging ? 'Limpiando...' : 'Barrer Huérfanas'}</span>
          </button>
        </div>
      </div>

      {/* MENSAJE DE PROGRESO */}
      {(scanning || purging) && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/60 p-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in">
          <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
          <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
            {progressMsg || 'Procesando en Firebase Storage...'}
          </p>
        </div>
      )}

      {/* BARRA DE CUOTA DE STORAGE */}
      <div className="space-y-2 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-slate-700 dark:text-slate-300">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span>Espacio Ocupado en Nube:</span>
            <span className="text-blue-600 dark:text-blue-400 text-sm font-black">
              {formatBytes(totalBytes)}
            </span>
            <span className="text-slate-400 font-medium">de 5.0 GB gratuitos</span>
          </div>
          <span className="font-black text-slate-500 dark:text-slate-400">
            {usagePercent}%
          </span>
        </div>

        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
          <div 
            className={`h-full rounded-full transition-all duration-700 ${
              Number(usagePercent) > 80 
                ? 'bg-gradient-to-r from-red-500 to-rose-600' 
                : Number(usagePercent) > 50 
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500' 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}
            style={{ width: `${Math.max(2, Math.min(100, Number(usagePercent)))}%` }}
          />
        </div>
      </div>

      {/* TARJETAS DE DESGLOSE DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* 1. TOTAL FOTOS */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total en Storage</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">
              {formatBytes(totalBytes)}
            </p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {metrics?.totalFiles ? `${metrics.totalFiles} fotos y archivos` : 'Sin escanear'}
            </p>
          </div>
        </div>

        {/* 2. TRASLADOS ACTIVOS */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Traslados Activos</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
              {formatBytes(metrics?.activeBytes || 0)}
            </p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {metrics?.activeFiles || 0} fotos en {metrics?.activeJobsCount || 0} viajes
            </p>
          </div>
        </div>

        {/* 3. DOCUMENTOS VEHICULARES */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Documentos Vehiculares</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-cyan-600 dark:text-cyan-400 leading-tight">
              {formatBytes(metrics?.protectedDocBytes || 0)}
            </p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {metrics?.protectedDocFiles || 0} docs (SOAP, RT) protegidos
            </p>
          </div>
        </div>

        {/* 4. FOTOS HUÉRFANAS */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
          (metrics?.orphanFiles || 0) > 0
            ? 'bg-purple-50/70 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50'
            : 'bg-slate-50 dark:bg-slate-950/60 border-slate-100 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fotos Huérfanas</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              (metrics?.orphanFiles || 0) > 0
                ? 'bg-purple-100 dark:bg-purple-800/50 text-purple-600 dark:text-purple-300'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
            }`}>
              {(metrics?.orphanFiles || 0) > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>
          <div>
            <p className={`text-xl font-black leading-tight ${
              (metrics?.orphanFiles || 0) > 0
                ? 'text-purple-700 dark:text-purple-300'
                : 'text-slate-800 dark:text-slate-200'
            }`}>
              {formatBytes(metrics?.orphanBytes || 0)}
            </p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {(metrics?.orphanFiles || 0) > 0 
                ? `${metrics.orphanFiles} fotos listas para borrar` 
                : '0 fotos huérfanas (Limpio)'}
            </p>
          </div>
        </div>

      </div>

      {/* PIE DE FECHA Y ÚLTIMA LIMPIEZA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 text-[11px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {metrics?.scannedAt 
              ? `Último escaneo completo: ${new Date(metrics.scannedAt).toLocaleString('es-CL')}`
              : 'Aún no se ha realizado un escaneo. Presiona "Escanear Storage" para calcular métricas.'}
          </span>
        </div>

        {metrics?.lastPurgeAt && (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Última limpieza: {new Date(metrics.lastPurgeAt).toLocaleDateString('es-CL')} (liberados {formatBytes(metrics.lastPurgeBytesFreed || 0)})
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
