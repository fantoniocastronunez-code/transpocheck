import React, { useState } from 'react';
import { X } from 'lucide-react';
import ConfigClients from './Config/ConfigClients';
import ConfigVehicles from './Config/ConfigVehicles';
import ConfigDrivers from './Config/ConfigDrivers';
import ConfigDirectory from './Config/ConfigDirectory';
import ConfigTolls from './Config/ConfigTolls';
import ConfigEquipment from './Config/ConfigEquipment';

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
