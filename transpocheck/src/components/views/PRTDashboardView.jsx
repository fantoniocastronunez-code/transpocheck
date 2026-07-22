import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Activity, MapPin, AlertTriangle, ShieldAlert, CheckCircle, Clock, Navigation, Video } from 'lucide-react';

export default function PRTDashboardView({ db, currentUserEmail, drivers, role, showAlert }) {
  const [prts, setPrts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Escuchar en tiempo real la colección prts
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'prts'), (snap) => {
      setPrts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const updatePRTStatus = async (prtId, newStatus, hasInspectors) => {
    setUpdatingId(prtId);
    try {
      const myName = drivers.find(d => d.email === currentUserEmail)?.name || currentUserEmail;
      await updateDoc(doc(db, 'prts', prtId), {
        status: newStatus,
        hasInspectors: hasInspectors,
        lastUpdated: Date.now(),
        lastUpdatedBy: myName
      });
      showAlert("✅ Estado de planta actualizado para toda la flota.");
    } catch (e) {
      showAlert("❌ Error al actualizar el estado.");
    }
    setUpdatingId(null);
  };

  const getStatusColor = (status) => {
    if (status === 'red') return 'bg-red-500 shadow-red-200 border-red-600';
    if (status === 'yellow') return 'bg-amber-400 shadow-amber-200 border-amber-500';
    return 'bg-emerald-500 shadow-emerald-200 border-emerald-600'; // green by default
  };

  const getStatusText = (status) => {
    if (status === 'red') return 'COLAPSADA';
    if (status === 'yellow') return 'FILA MODERADA';
    return 'DESPEJADA';
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Sin datos';
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'Hace instantes';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  };

  if (loading) {
    return <div className="text-center p-10 text-slate-400 font-bold animate-pulse">Cargando radar de Plantas RT...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pt-20 sm:pt-24 pb-32 animate-in slide-in-from-bottom-4 duration-300">
      
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl mb-6 relative overflow-hidden">
         <div className="relative z-10">
            <h2 className="text-2xl font-black mb-1 flex items-center gap-2"><Activity className="text-rose-400"/> Radar PRT</h2>
            <p className="text-xs font-bold text-slate-300 leading-relaxed">Waze Logístico: Reporta y visualiza en tiempo real el estado de las filas y fiscalizadores en las plantas.</p>
         </div>
         <Navigation className="w-32 h-32 absolute -bottom-6 -right-6 text-white opacity-5 transform rotate-45"/>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {prts.length === 0 ? (
          <div className="col-span-full p-10 bg-white border-2 border-dashed border-slate-200 rounded-3xl text-center">
            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2"/>
            <p className="font-bold text-slate-500">No hay plantas registradas en el sistema.</p>
            {role === 'admin' && <p className="text-xs text-slate-400 mt-1">Dirígete a la configuración para agregar plantas.</p>}
          </div>
        ) : prts.map(prt => (
          <div key={prt.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative">
            
            {/* Header / Info */}
            <div className="p-5 flex-1 z-10 relative">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 pr-2">
                  <h3 className="font-black text-slate-800 text-lg leading-tight">{prt.name}</h3>
                  {(prt.address || prt.comuna) && (
                    <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400"/> {prt.address}{prt.address && prt.comuna ? ', ' : ''}{prt.comuna}
                    </p>
                  )}

                  {/* NUEVO: Botón de Cámara en Vivo si existe la URL */}
                  {prt.camUrl && (
                    <a 
                      href={prt.camUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black transition-colors border border-blue-200 shadow-sm"
                    >
                      <Video className="w-4 h-4 text-blue-600 animate-pulse"/> Ver Cámara en Vivo
                    </a>
                  )}
                </div>
                {/* Semáforo Visual Circular */}
                <div className={`w-6 h-6 rounded-full border-2 shadow-md shrink-0 ${getStatusColor(prt.status)}`}></div>
              </div>

              {/* Fiscalizadores Alert */}
              {prt.hasInspectors && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 mb-3 shadow-sm animate-pulse">
                  <ShieldAlert className="w-4 h-4 shrink-0"/> Fiscalizadores en el perímetro
                </div>
              )}

              <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                <Clock className="w-3 h-3 shrink-0"/> Actualizado: {formatTimeAgo(prt.lastUpdated)} por {prt.lastUpdatedBy || 'Sistema'}
              </div>
            </div>

            {/* Panel de Acción Interactivo */}
            <div className="bg-slate-50 border-t border-slate-100 p-3 flex flex-col gap-3">
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tú reporte (Actualizar)</p>
               
               <div className="flex bg-white rounded-xl shadow-inner border border-slate-200 p-1">
                 <button disabled={updatingId === prt.id} onClick={() => updatePRTStatus(prt.id, 'green', prt.hasInspectors)} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${prt.status === 'green' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>Vacía</button>
                 <button disabled={updatingId === prt.id} onClick={() => updatePRTStatus(prt.id, 'yellow', prt.hasInspectors)} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${prt.status === 'yellow' ? 'bg-amber-400 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>Medio</button>
                 <button disabled={updatingId === prt.id} onClick={() => updatePRTStatus(prt.id, 'red', prt.hasInspectors)} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${prt.status === 'red' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>Llena</button>
               </div>

               <button disabled={updatingId === prt.id} onClick={() => updatePRTStatus(prt.id, prt.status, !prt.hasInspectors)} className={`w-full py-2.5 rounded-xl text-xs font-black flex justify-center items-center gap-2 border-2 transition-all ${prt.hasInspectors ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                 {prt.hasInspectors ? <><CheckCircle className="w-4 h-4"/> Todo despejado</> : <><AlertTriangle className="w-4 h-4"/> ¡Hay Fiscalizadores!</>}
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
