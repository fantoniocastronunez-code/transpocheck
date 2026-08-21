import React, { useState, useEffect } from 'react';
import { X, HardDrive } from 'lucide-react';
import ConfigClients from './Config/ConfigClients';
import ConfigVehicles from './Config/ConfigVehicles';
import ConfigDrivers from './Config/ConfigDrivers';
import ConfigDirectory from './Config/ConfigDirectory';
import ConfigTolls from './Config/ConfigTolls';
import ConfigEquipment from './Config/ConfigEquipment';

function StorageWidget() {
  const [usage, setUsage] = useState(0);
  const [quota, setQuota] = useState(1);
  const [supported, setSupported] = useState(true);
  
  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        setUsage(estimate.usage || 0);
        setQuota(estimate.quota || 1);
      }).catch(() => setSupported(false));
    } else {
      setSupported(false);
    }
  }, []);

  if (!supported) return null;

  const percentage = Math.min(100, Math.round((usage / quota) * 100)) || 0;
  const usageMB = (usage / (1024 * 1024)).toFixed(1);
  const quotaGB = (quota / (1024 * 1024 * 1024)).toFixed(1);

  const strokeDasharray = 283;
  const strokeDashoffset = strokeDasharray - (percentage / 100) * strokeDasharray;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
      <div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1">
          <HardDrive className="w-5 h-5 text-blue-500"/> Almacenamiento Local (Caché)
        </h3>
        <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 max-w-[200px] sm:max-w-none">
          Espacio ocupado por la App en este dispositivo.
        </p>
        <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mt-2">
          {usageMB} MB / {quotaGB} GB
        </p>
      </div>
      
      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          <circle className="text-slate-100 dark:text-slate-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="45" fill="transparent"></circle>
          <circle 
            className={`stroke-current transition-all duration-1000 ease-out ${percentage > 80 ? 'text-red-500' : percentage > 50 ? 'text-amber-500' : 'text-blue-500'}`} 
            strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="45" fill="transparent" 
            strokeDasharray={strokeDasharray} 
            strokeDashoffset={strokeDashoffset}
          ></circle>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
           <span className="text-sm font-black text-slate-800 dark:text-slate-200">{percentage}%</span>
        </div>
      </div>
    </div>
  );
}

export default function ConfigView({ currentUserEmail, allClientsList, customClients, vehicles, drivers, db, showAlert, showConfirm }) {
  const [configSubTab, setConfigSubTab] = useState('clients');
  const [fullScreenDoc, setFullScreenDoc] = useState(null); 

  return (
    <div className="space-y-6 relative w-full">
      <div className="flex flex-wrap gap-2 pb-2 w-full">
         <button onClick={()=>setConfigSubTab('clients')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='clients'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Clientes</button>
         <button onClick={()=>setConfigSubTab('vehicles')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='vehicles'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Vehículos</button>
         <button onClick={()=>setConfigSubTab('drivers')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='drivers'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Usuarios</button>
         <button onClick={()=>setConfigSubTab('directory')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='directory'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Directorio</button>
         <button onClick={()=>setConfigSubTab('tolls')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='tolls'?'bg-emerald-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Peajes</button>
         <button onClick={()=>setConfigSubTab('equipment')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='equipment'?'bg-amber-500 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Equipamiento</button>
      </div>
      
      <StorageWidget />

      {configSubTab === 'clients' && (
        <ConfigClients 
          customClients={customClients} 
          db={db} 
          showAlert={showAlert} 
          showConfirm={showConfirm} 
        />
      )}

      {configSubTab === 'vehicles' && (
        <ConfigVehicles 
          allClientsList={allClientsList} 
          vehicles={vehicles} 
          db={db} 
          showAlert={showAlert} 
          showConfirm={showConfirm} 
        />
      )}

      {configSubTab === 'drivers' && (
        <ConfigDrivers 
          currentUserEmail={currentUserEmail} 
          drivers={drivers} 
          db={db} 
          showAlert={showAlert} 
          showConfirm={showConfirm} 
          setFullScreenDoc={setFullScreenDoc} 
        />
      )}

      {configSubTab === 'directory' && (
        <ConfigDirectory 
          db={db} 
          showAlert={showAlert} 
          showConfirm={showConfirm} 
        />
      )}

      {configSubTab === 'tolls' && (
        <ConfigTolls 
          db={db} 
          showAlert={showAlert} 
          showConfirm={showConfirm} 
        />
      )}

      {configSubTab === 'equipment' && (
        <ConfigEquipment 
          db={db} 
          showAlert={showAlert} 
          showConfirm={showConfirm} 
        />
      )}

      {fullScreenDoc && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-zoom-out animate-in fade-in" onClick={() => setFullScreenDoc(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white dark:bg-slate-900 hover:bg-white dark:bg-slate-900 rounded-full text-white transition-colors shadow-lg"><X className="w-6 h-6"/></button>
          <img src={fullScreenDoc} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
