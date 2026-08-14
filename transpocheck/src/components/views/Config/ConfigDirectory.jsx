import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { BookOpen, MapPin, Search, User, Edit2, Trash2 } from 'lucide-react';

export default function ConfigDirectory({ db, showAlert, showConfirm }) {
  const [editingDir, setEditingDir] = useState(null); 
  const [directoryList, setDirectoryList] = useState([]); 
  const [dirSearchTerm, setDirSearchTerm] = useState('');

  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const snapDir = await getDocs(collection(db, 'directory'));
        setDirectoryList(snapDir.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.error("Error cargando directorio:", e); }
    };
    fetchDirectory();
  }, [db]);

  const filteredDirectoryList = directoryList.filter(d => {
    if (!dirSearchTerm) return true;
    const term = dirSearchTerm.toLowerCase();
    return (d.placeName || '').toLowerCase().includes(term) ||
           (d.address || '').toLowerCase().includes(term) ||
           (d.plusCode || '').toLowerCase().includes(term) ||
           (d.commune || '').toLowerCase().includes(term) ||
           (d.contactName || '').toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-w-0 max-w-full overflow-x-hidden">
      <form key={editingDir ? editingDir.id : 'new-dir'} onSubmit={async (e) => { 
         e.preventDefault(); 
         const fd = new FormData(e.target); 

         // Lógica inteligente para prefijo telefónico
         let phone = fd.get('contactPhone')?.trim() || '';
         if (phone) {
            phone = phone.replace(/\s+/g, ''); // Limpiamos espacios en blanco
            if (!phone.startsWith('+569')) {
               if (phone.startsWith('569')) phone = '+' + phone;
               else if (phone.startsWith('9')) phone = '+56' + phone;
               else phone = '+569' + phone.replace(/^\+/, '');
            }
         }

         const data = { 
            placeName: fd.get('placeName')?.trim() || '', 
            contactName: fd.get('contactName')?.trim() || '', 
            contactPhone: phone,
            address: fd.get('address')?.trim() || '',
            commune: fd.get('commune')?.trim() || '',
            plusCode: fd.get('plusCode')?.trim() || '' // <-- NUEVO: Guardar Plus Code
         }; 

         try { 
            if (editingDir) { 
               await updateDoc(doc(db, 'directory', editingDir.id), data); 
               setEditingDir(null); 
               showAlert("Destino actualizado."); 
            } else { 
               await addDoc(collection(db, 'directory'), data); 
               showAlert("Destino guardado en el directorio."); 
            } 
            const snap = await getDocs(collection(db, 'directory'));
            setDirectoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            e.target.reset(); 
         } catch (err) { showAlert("Error al guardar."); } 
      }} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 w-full lg:w-1/2 min-w-0">
        <div className="flex justify-between items-center">
           <h3 className="font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200"><BookOpen className="text-blue-600 dark:text-blue-400 w-5 h-5"/> {editingDir ? 'Editar Destino' : 'Nuevo Destino'}</h3>
           {editingDir && <button type="button" onClick={()=>setEditingDir(null)} className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg uppercase">Cancelar</button>}
        </div>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 leading-tight">Agrega los destinos frecuentes. Cuando crees un trabajo y escribas exactamente el mismo lugar, el sistema adjuntará toda esta información automáticamente.</p>
        
        <div className="space-y-1">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lugar / Destino exacto <span className="text-red-500">*</span></label>
           <input name="placeName" defaultValue={editingDir?.placeName} placeholder="Ej: Samex Quilicura (Obligatorio)" required autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full min-w-0 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold bg-transparent"/>
        </div>
        
        <div className="space-y-1">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Encargado (Opcional)</label>
           <input name="contactName" defaultValue={editingDir?.contactName} placeholder="Ej: Luis Ahumada" autoComplete="off" autoCorrect="off" spellCheck="false" autoCapitalize="words" className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold bg-transparent"/>
        </div>
        
        <div className="space-y-1">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono (Opcional)</label>
           <input name="contactPhone" defaultValue={editingDir?.contactPhone} placeholder="Ej: +56912345678" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full min-w-0 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold bg-transparent"/>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección Exacta (Opcional)</label>
              <input name="address" defaultValue={editingDir?.address} placeholder="Ej: Av. Vespucio 1501" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full min-w-0 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold bg-transparent"/>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comuna / Ciudad (Opcional)</label>
              <input name="commune" defaultValue={editingDir?.commune} placeholder="Ej: Quilicura" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full min-w-0 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold bg-transparent"/>
           </div>
        </div>

        <div className="space-y-1">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex flex-wrap items-center gap-1"><MapPin className="w-3 h-3 text-blue-500 shrink-0"/> Plus Code de Google Maps (Prioridad GPS)</label>
           <input name="plusCode" defaultValue={editingDir?.plusCode} placeholder="Ej: 8MP3+VX Santiago" autoComplete="off" autoCorrect="off" spellCheck="false" className="w-full min-w-0 border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-bold bg-blue-50 dark:bg-blue-900/30"/>
        </div>

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-sm transition-colors shadow-md shadow-blue-200 mt-2">
           {editingDir ? 'Guardar Cambios' : 'Agregar al Directorio'}
        </button>
      </form>

      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-h-[85vh] flex flex-col w-full lg:w-1/2 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-200">Destinos Guardados</h3>
          <div className="relative w-full sm:w-72 shrink-0 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar lugar, Plus Code, nombre..."
              value={dirSearchTerm}
              onChange={(e) => setDirSearchTerm(e.target.value)}
              autoComplete="off" autoCorrect="off" spellCheck="false"
              className="w-full min-w-0 pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="space-y-2 overflow-y-auto pr-1 flex-1">
          {directoryList.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-4">Directorio vacío</p> : filteredDirectoryList.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-4">No se encontraron destinos</p> : filteredDirectoryList.map(d=>(
            <div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-blue-200 dark:border-blue-800/50 transition-all">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 truncate">{d.placeName}</p>
                {d.plusCode && <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 mt-0.5 truncate"><MapPin className="w-3 h-3 inline-block align-text-bottom mr-1 shrink-0"/> {d.plusCode} (Plus Code)</p>}
                {(d.address || d.commune) && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate"><MapPin className="w-3 h-3 text-slate-400 inline-block align-text-bottom mr-1 shrink-0"/> {d.address}{d.address && d.commune ? ', ' : ''}{d.commune}</p>}
                {(d.contactName || d.contactPhone) && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate"><User className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline-block align-text-bottom mr-1 shrink-0"/> {d.contactName || 'Sin nombre'} {d.contactPhone && `• ${d.contactPhone}`}</p>}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                 <button onClick={() => {setEditingDir(d); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="p-1.5 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 text-blue-600 dark:text-blue-400 rounded-lg transition-colors shadow-sm" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                 <button onClick={() => showConfirm("¿Eliminar destino del directorio?", async () => { 
                     await deleteDoc(doc(db,'directory',d.id));
                     setDirectoryList(directoryList.filter(item => item.id !== d.id));
                 })} className="p-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-500 rounded-lg transition-colors shadow-sm" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
