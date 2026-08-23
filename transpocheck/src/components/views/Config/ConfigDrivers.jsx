import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Camera, Eye, EyeOff, User, Edit2, Trash2, Clock, CheckCircle } from 'lucide-react';
import { LICENCIAS, resizeImage } from '../../../utils/helpers';

export default function ConfigDrivers({ currentUserEmail, drivers, db, showAlert, showConfirm, setFullScreenDoc, isSuperAdmin }) {
  const [editingDriver, setEditingDriver] = useState(null);
  const [driverDocs, setDriverDocs] = useState({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null });
  
  const defaultDriverNotifs = { asignacion: true, modificacion: true, nuevo_monto: true, rendicion_pendiente: true };
  const [driverNotifs, setDriverNotifs] = useState(defaultDriverNotifs);

  const defaultPermissions = {
    create_jobs: true,
    manage_users: true,
    manage_clients: true,
    manage_vehicles: true,
    manage_directory: true,
    manage_tolls: true,
    manage_equipment: true,
    manage_expenses: true,
    manage_stats: true,
    manage_history: true
  };
  const [driverPermissions, setDriverPermissions] = useState(defaultPermissions);

  const handleDocUpload = async (e, field, size) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, size, 0.4);
      setDriverDocs(prev => ({ ...prev, [field]: dataUrl }));
    } catch (err) { showAlert("Error procesando foto."); }
  };

  const DocUploader = ({ field, label }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">{label}</span>
        <div className="relative h-20 w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 group hover:border-blue-400 transition-colors flex items-center justify-center">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => handleDocUpload(e, field, 800)} />
            {driverDocs[field] ? (
                <>
                    <img src={driverDocs[field]} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <span className="text-white text-xs font-bold flex flex-col items-center"><Camera className="w-4 h-4 mb-1"/> Cambiar</span>
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); setFullScreenDoc(driverDocs[field]); }} className="absolute top-1 right-1 bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-md z-30 hover:bg-slate-100 dark:bg-slate-800"><Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/></button>
                </>
            ) : (
                <div className="text-center text-slate-400 group-hover:text-blue-500 flex flex-col items-center">
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-[9px] font-black uppercase">Subir</span>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form key={editingDriver ? editingDriver.id : 'new'} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); const enableNotifications = Object.values(driverNotifs).some(v => v); const data = { name: fd.get('driverName'), email: fd.get('driverEmail').toLowerCase(), role: fd.get('role'), licenses: fd.getAll('licenses'), licenseExpiry: fd.get('licenseExpiry'), enableNotifications, notifications: driverNotifs, permissions: driverPermissions, ...driverDocs }; try { if (editingDriver) { await updateDoc(doc(db, 'drivers', editingDriver.id), data); setEditingDriver(null); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); setDriverNotifs(defaultDriverNotifs); setDriverPermissions(defaultPermissions); showAlert("Perfil actualizado exitosamente."); } else { data.balance = 0; data.createdAt = Date.now(); await addDoc(collection(db, 'drivers'), data); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); setDriverNotifs(defaultDriverNotifs); setDriverPermissions(defaultPermissions); showAlert("Usuario creado exitosamente."); } e.target.reset(); } catch (err) { console.error(err); } }} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 relative">
        


        <div className="flex justify-between items-start">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2"><User className="text-blue-600 dark:text-blue-400"/> {editingDriver ? 'Perfil de Usuario' : 'Nuevo Usuario'}</h3>
          {editingDriver?.createdAt && (
            <div className="text-right">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Registro en App</span>
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-blue-100 dark:border-blue-800/50 shadow-sm">
                {new Date(editingDriver.createdAt).toLocaleDateString('es-CL')}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <label className="relative w-20 h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-900 group hover:border-blue-500 transition-colors shadow-inner">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDocUpload(e, 'photo', 160)} />
            {driverDocs.photo ? (
              <img src={driverDocs.photo} alt="Previsualización" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center flex flex-col items-center justify-center">
                <Camera className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Selfie</span>
              </div>
            )}
          </label>
          {driverDocs.photo && <button type="button" onClick={() => setDriverDocs(prev => ({...prev, photo: null}))} className="text-[10px] font-bold text-red-500 hover:underline">Quitar foto</button>}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rol en el Sistema</label>
             <select name="role" defaultValue={editingDriver?.role || 'driver'} className="w-full border-2 border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/30 p-3 rounded-xl text-sm font-black text-purple-900 dark:text-purple-300 outline-none focus:border-purple-500">
                <option value="driver">Conductor Titular (Con documentos)</option>
                <option value="part_time">Conductor Part-Time (Sin validación docs)</option>
                <option value="quoter">Cotizador / Ventas</option>
                <option value="admin">Administrador (Oficina)</option>
                {currentUserEmail === 'fcastro@logisticats.cl' && <option value="super_admin">Super Administrador</option>}
             </select>
          </div>
          <input name="driverName" defaultValue={editingDriver?.name} placeholder="Nombre completo" required autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold bg-transparent"/>
          <input name="driverEmail" defaultValue={editingDriver?.email} placeholder="Correo Gmail de acceso" required type="email" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="none" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-semibold bg-transparent"/>
        </div>
        
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Documentación de Respaldo</h4>
           <div className="grid grid-cols-2 gap-3">
              <DocUploader field="idFront" label="Carnet (Frente)" />
              <DocUploader field="idBack" label="Carnet (Reverso)" />
              <DocUploader field="licenseFront" label="Licencia (Frente)" />
              <DocUploader field="licenseBack" label="Licencia (Reverso)" />
           </div>
        </div>

        <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 mt-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clase de Licencia</label>
           <div className="grid grid-cols-3 gap-1.5">
              {LICENCIAS.map(l => (
                <label key={l} className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-900 border rounded-lg text-[11px] font-bold cursor-pointer hover:bg-slate-100 dark:bg-slate-800">
                  <input type="checkbox" name="licenses" value={l} defaultChecked={editingDriver?.licenses?.includes(l)} className="w-3.5 h-3.5 cursor-pointer" />
                  {l}
                </label>
              ))}
           </div>
        </div>
        <div className="space-y-1">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimiento Licencia</label>
           <input name="licenseExpiry" type="date" defaultValue={editingDriver?.licenseExpiry || ''} className="w-full border-2 p-2 rounded-xl text-sm font-semibold outline-none text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900" />
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 p-4 rounded-xl shadow-sm space-y-3 mt-4">
           <div className="border-b border-blue-200 dark:border-blue-800/50/50 pb-2">
              <p className="text-xs font-extrabold text-blue-900 dark:text-blue-300 flex items-center gap-1.5"><Eye className="w-4 h-4"/> Correos al Conductor</p>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 leading-tight">Selecciona exactamente qué copias recibirá este conductor.</p>
           </div>

           <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { id: 'asignacion', label: 'Asignación' },
                { id: 'modificacion', label: 'Modificación' },
                { id: 'nuevo_monto', label: 'Nuevo Monto' },
                { id: 'rendicion_pendiente', label: 'Rendición Pdte.' }
              ].map(notif => {
                 const isActive = driverNotifs[notif.id];
                 return (
                   <button
                     key={notif.id}
                     type="button"
                     onClick={() => setDriverNotifs({...driverNotifs, [notif.id]: !isActive})}
                     className={`py-3 px-1.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1.5 select-none ${
                       isActive
                         ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-100'
                         : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300 dark:border-blue-700/50 hover:text-blue-500 hover:bg-blue-50 dark:bg-blue-900/30 scale-[0.98]'
                     }`}
                   >
                     {isActive ? <CheckCircle className="w-5 h-5 mb-0.5 animate-in zoom-in duration-200" /> : <div className="w-5 h-5 mb-0.5 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"></div>}
                     <span className="text-center leading-tight">{notif.label}</span>
                   </button>
                 );
              })}
           </div>
        </div>

        {isSuperAdmin && (
          <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800/50 p-4 rounded-xl shadow-sm space-y-3 mt-4">
             <div className="border-b border-purple-200 dark:border-purple-800/50 pb-2">
                <p className="text-xs font-extrabold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">Permisos de Acceso (Super Admin)</p>
                <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-0.5 leading-tight">Activa o desactiva módulos para este usuario.</p>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {[
                  { id: 'create_jobs', label: 'Crear Traslados' },
                  { id: 'manage_users', label: 'Usuarios' },
                  { id: 'manage_clients', label: 'Clientes' },
                  { id: 'manage_vehicles', label: 'Vehículos' },
                  { id: 'manage_directory', label: 'Directorio' },
                  { id: 'manage_tolls', label: 'Peajes' },
                  { id: 'manage_equipment', label: 'Equipamiento' },
                  { id: 'manage_expenses', label: 'Gastos' },
                  { id: 'manage_stats', label: 'Estadísticas' },
                  { id: 'manage_history', label: 'Peritaje' }
                ].map(perm => {
                   const isActive = driverPermissions[perm.id];
                   return (
                     <button
                       key={perm.id}
                       type="button"
                       onClick={() => setDriverPermissions({...driverPermissions, [perm.id]: !isActive})}
                       className={`py-2 px-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1.5 select-none ${
                         isActive
                           ? 'bg-purple-600 border-purple-600 text-white shadow-sm scale-100'
                           : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-purple-300 dark:border-purple-700/50 hover:text-purple-500 hover:bg-purple-50 dark:bg-purple-900/30 scale-[0.98]'
                       }`}
                     >
                       {isActive ? <CheckCircle className="w-4 h-4 mb-0.5 animate-in zoom-in duration-200" /> : <div className="w-4 h-4 mb-0.5 rounded-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"></div>}
                       <span className="text-center leading-tight">{perm.label}</span>
                     </button>
                   );
                })}
             </div>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 mt-4">
          {editingDriver && <button type="button" onClick={() => { setEditingDriver(null); setDriverDocs({ photo: null, idFront: null, idBack: null, licenseFront: null, licenseBack: null }); setDriverNotifs(defaultDriverNotifs); setDriverPermissions(defaultPermissions); }} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-extrabold text-sm transition-colors">Cancelar</button>}
          <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-sm transition-colors shadow-lg shadow-blue-200">{editingDriver ? 'Guardar Cambios' : 'Guardar Usuario'}</button>
        </div>
      </form>
      
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-200 mb-4">Gestión de Usuarios</h3>
        <div className="space-y-2">
          {drivers.length === 0 ? <p className="text-sm font-semibold text-slate-400">Directorio vacío</p> : drivers.map(d=>(
            <div key={d.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-2xl group transition-all ${d.isHidden ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-75' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
              <div className="flex items-start sm:items-center gap-3 overflow-hidden w-full">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm relative mt-1 sm:mt-0">
                  {d.photo ? (
                    <img src={d.photo} alt={d.name} className={`w-full h-full object-cover ${d.isHidden ? 'grayscale' : ''}`} />
                  ) : (
                    <User className="w-6 h-6 sm:w-7 sm:h-7 text-slate-400" />
                  )}
                  {d.isHidden && <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center"><EyeOff className="w-5 h-5 text-white"/></div>}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                     <p className={`text-base sm:text-lg font-extrabold leading-tight break-words ${d.isHidden ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{d.name}</p>
                     {d.isHidden && <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">Oculto</span>}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 break-all leading-tight mb-1.5">{d.email}</p>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                       d.role === 'super_admin' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50' :
                       d.role === 'admin' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' :
                       d.role === 'quoter' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' :
                       d.role === 'part_time' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' :
                       'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                    }`}>
                       {d.role === 'super_admin' ? 'Super Admin' : d.role === 'admin' ? 'Admin' : d.role === 'quoter' ? 'Cotizador' : d.role === 'part_time' ? 'Part-Time' : 'Conductor'}
                    </span>
                    {(!d.role || d.role === 'driver') && d.licenses && d.licenses.length > 0 && (
                       <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${d.isHidden ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'}`}>
                         Licencias: {d.licenses.join(', ')}
                       </span>
                    )}
                  </div>
                  {d.createdAt && <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 mt-2.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> Ingreso: {new Date(d.createdAt).toLocaleDateString('es-CL')}</p>}
                </div>
              </div>
              
              <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-200 dark:border-slate-700/70">
                 <button onClick={async () => {
                     try { await updateDoc(doc(db, 'drivers', d.id), { isHidden: !d.isHidden }); }
                     catch (e) { showAlert("Error al cambiar estado."); }
                 }} className={`p-3 sm:p-2.5 flex-1 sm:flex-none flex items-center justify-center rounded-xl transition-colors shadow-sm ${d.isHidden ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 hover:bg-green-200 border border-green-200 dark:border-green-800/50' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:bg-slate-600'}`} title={d.isHidden ? "Restaurar Conductor" : "Ocultar Conductor"}>
                     {d.isHidden ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>}
                 </button>
                 <button onClick={() => { 
                   setEditingDriver(d); 
                   setDriverDocs({ photo: d.photo || null, idFront: d.idFront || null, idBack: d.idBack || null, licenseFront: d.licenseFront || null, licenseBack: d.licenseBack || null }); 
                   setDriverNotifs(d.notifications || defaultDriverNotifs);
                   setDriverPermissions(d.permissions || defaultPermissions);
                   window.scrollTo({ top: 0, behavior: 'smooth' });
                 }} className={`px-4 py-3 sm:py-2.5 flex-[2] sm:flex-none justify-center rounded-xl transition-colors shadow-sm text-sm font-extrabold flex items-center gap-2 ${d.isHidden ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:bg-slate-600' : 'bg-blue-600 hover:bg-blue-700 text-white'}`} title="Ver Perfil y Documentos"><User className="w-4.5 h-4.5"/> Perfil</button>
                 <button onClick={() => showConfirm("¿Eliminar conductor?", async()=>await deleteDoc(doc(db,'drivers',d.id)))} className="p-3 sm:p-2.5 flex-1 sm:flex-none flex items-center justify-center bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-500 rounded-xl transition-colors shadow-sm"><Trash2 className="w-5 h-5"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
