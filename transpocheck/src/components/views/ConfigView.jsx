import React, { useState, useEffect } from 'react';
import { X, HardDrive } from 'lucide-react';
import { storage } from '../../firebase';
import ConfigClients from './Config/ConfigClients';
import ConfigVehicles from './Config/ConfigVehicles';
import ConfigBrandsModels from './Config/ConfigBrandsModels';
import ConfigDrivers from './Config/ConfigDrivers';
import ConfigDirectory from './Config/ConfigDirectory';
import ConfigTolls from './Config/ConfigTolls';
import ConfigEquipment from './Config/ConfigEquipment';
import FirebaseStorageMetrics from './Config/FirebaseStorageMetrics';

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

export default function ConfigView({ currentUserEmail, allClientsList, customClients, vehicles, vehicleModels = [], drivers, db, showAlert, showConfirm, isSuperAdmin, adminPermissions }) {
  // Inicializar recuperando la última pestaña guardada para que las modificaciones mantengan al usuario en su vista
  const [configSubTab, setConfigSubTab] = useState(() => {
    try {
      const saved = sessionStorage.getItem('config_active_subtab');
      return saved || 'clients';
    } catch (e) {
      return 'clients';
    }
  });

  const [fullScreenDoc, setFullScreenDoc] = useState(null); 

  const handleSelectTab = (tab) => {
    setConfigSubTab(tab);
    try {
      sessionStorage.setItem('config_active_subtab', tab);
    } catch (e) {}
  };
  
  // Validar permisos solo para asegurar que la pestaña activa sea lícita, sin forzar 'clients' si el usuario ya está en otra pestaña permitida
  useEffect(() => {
    const isAllowed = (tab) => {
      if (tab === 'clients') return adminPermissions?.manage_clients !== false;
      if (tab === 'vehicles' || tab === 'models') return adminPermissions?.manage_vehicles !== false;
      if (tab === 'drivers') return adminPermissions?.manage_users !== false;
      if (tab === 'directory') return adminPermissions?.manage_directory !== false;
      if (tab === 'tolls') return adminPermissions?.manage_tolls !== false;
      if (tab === 'equipment') return adminPermissions?.manage_equipment !== false;
      if (tab === 'storage') return !!isSuperAdmin;
      return false;
    };

    if (!isAllowed(configSubTab)) {
      let fallbackTab = 'clients';
      if (adminPermissions?.manage_clients !== false) fallbackTab = 'clients';
      else if (adminPermissions?.manage_vehicles !== false) fallbackTab = 'vehicles';
      else if (adminPermissions?.manage_users !== false) fallbackTab = 'drivers';
      else if (adminPermissions?.manage_directory !== false) fallbackTab = 'directory';
      else if (adminPermissions?.manage_tolls !== false) fallbackTab = 'tolls';
      else if (adminPermissions?.manage_equipment !== false) fallbackTab = 'equipment';
      else if (isSuperAdmin) fallbackTab = 'storage';

      setConfigSubTab(fallbackTab);
      try {
        sessionStorage.setItem('config_active_subtab', fallbackTab);
      } catch (e) {}
    }
  }, [adminPermissions, isSuperAdmin, configSubTab]);

  return (
    <div className="space-y-6 relative w-full">
      <div className="flex flex-wrap gap-2 pb-2 w-full">
         {adminPermissions?.manage_clients !== false && <button onClick={()=>handleSelectTab('clients')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='clients'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Clientes</button>}
         {adminPermissions?.manage_vehicles !== false && <button onClick={()=>handleSelectTab('vehicles')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='vehicles'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Vehículos</button>}
         {adminPermissions?.manage_vehicles !== false && <button onClick={()=>handleSelectTab('models')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='models'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Marcas y Modelos</button>}
         {adminPermissions?.manage_users !== false && <button onClick={()=>handleSelectTab('drivers')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='drivers'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Usuarios</button>}
         {adminPermissions?.manage_directory !== false && <button onClick={()=>handleSelectTab('directory')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='directory'?'bg-blue-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Directorio</button>}
         {adminPermissions?.manage_tolls !== false && <button onClick={()=>handleSelectTab('tolls')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='tolls'?'bg-emerald-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Peajes</button>}
         {adminPermissions?.manage_equipment !== false && <button onClick={()=>handleSelectTab('equipment')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='equipment'?'bg-amber-500 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Equipamiento</button>}
         {isSuperAdmin && <button onClick={()=>handleSelectTab('storage')} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-colors ${configSubTab==='storage'?'bg-purple-600 text-white':'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800'}`}>Almacenamiento Nube</button>}
      </div>

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

      {configSubTab === 'models' && (
        <ConfigBrandsModels 
          vehicles={vehicles} 
          vehicleModels={vehicleModels} 
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
          isSuperAdmin={isSuperAdmin} 
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

      {configSubTab === 'storage' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <FirebaseStorageMetrics 
            db={db} 
            storage={storage} 
            vehicles={vehicles} 
            showAlert={showAlert} 
            showConfirm={showConfirm} 
          />
          <StorageWidget />
        </div>
      )}

      {fullScreenDoc && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-zoom-out animate-in fade-in" onClick={() => setFullScreenDoc(null)}>
          <button className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 p-2 bg-white dark:bg-slate-900 hover:bg-white dark:bg-slate-900 rounded-full text-white transition-colors shadow-lg"><X className="w-6 h-6"/></button>
          <img src={fullScreenDoc} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
