import React, { useState, useEffect } from 'react';
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
import { X, User, CheckCircle } from 'lucide-react';
import CustomClientSelector from '../ui/CustomClientSelector';

export default function NewJobForm({ jobToEdit, onCancelEdit, allClientsList, vehicles, drivers, db, showAlert, onSuccess }) {
  const [selectedClient, setSelectedClient] = useState(jobToEdit?.client && allClientsList.includes(jobToEdit.client) ? jobToEdit.client : (jobToEdit?.client ? 'OTRO' : ''));
  const [manualClient, setManualClient] = useState(jobToEdit?.client && !allClientsList.includes(jobToEdit.client) ? jobToEdit.client : '');
  const [brand, setBrand] = useState(jobToEdit?.brand || '');
  const [model, setModel] = useState(jobToEdit?.model || '');
  
  const initPlate = jobToEdit?.plate === jobToEdit?.vin && jobToEdit?.plate?.length !== 6 ? '' : (jobToEdit?.plate || '');
  const initVin = jobToEdit?.plate === jobToEdit?.vin && jobToEdit?.vin?.length === 6 ? '' : (jobToEdit?.vin || '');
  
  const [plate, setPlate] = useState(initPlate);
  const [vin, setVin] = useState(initVin);
  const [tripType, setTripType] = useState(jobToEdit?.tripType || 'traslado');
  const [vehicleType, setVehicleType] = useState(jobToEdit?.vehicleType || 'auto');
  
  const [revType, setRevType] = useState(jobToEdit?.rtData?.type || 'A');
  const [revA_gases, setRevA_gases] = useState(jobToEdit?.rtData?.gases || false);
  const [revA_revision, setRevA_revision] = useState(jobToEdit?.rtData?.revision || false);
  const [revA_inspeccion, setRevA_inspeccion] = useState(jobToEdit?.rtData?.inspeccion || false);
  const [revA_frenos, setRevA_frenos] = useState(jobToEdit?.rtData?.frenos || false);
  const [revB_tipo, setRevB_tipo] = useState(jobToEdit?.rtData?.tipoB || 'completa');
  const [selectedDriversUI, setSelectedDriversUI] = useState(() => jobToEdit?.assignedEmails ? drivers.filter(d => jobToEdit.assignedEmails.includes(d.email)).map(d => d.id) : []);
  
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (brand && model && vehicles.length > 0) {
      const match = vehicles.find(v => v.brand?.toLowerCase() === brand.toLowerCase() && v.model?.toLowerCase() === model.toLowerCase() && v.vehicleType);
      if (match) setVehicleType(match.vehicleType);
    }
  }, [brand, model, vehicles]);

  const handleVehicleSearch = (searchValue, type) => {
    const val = searchValue.toUpperCase(); 
    if (type === 'plate') setPlate(val);
    if (type === 'vin') setVin(val);
    
    const v = vehicles.find(x => (val && x.plate === val) || (val && x.vin === val));
    if (v) {
      setBrand(v.brand || ''); setModel(v.model || '');
      if (v.plate && type === 'vin') setPlate(v.plate);
      if (v.vin && type === 'plate') setVin(v.vin);
      if (v.vehicleType) setVehicleType(v.vehicleType); 
      if (allClientsList.includes(v.client)) setSelectedClient(v.client); else { setSelectedClient('OTRO'); setManualClient(v.client); }
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateOrUpdateJob = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData(e.target);
    const selectedDriverIds = formData.getAll('assignedDriverId');
    if (selectedDriverIds.length === 0) return showAlert("Debes seleccionar al menos un conductor.");

    const assignedDriversList = drivers.filter(d => selectedDriverIds.includes(d.id));
    const finalClient = selectedClient === 'OTRO' ? manualClient : selectedClient;
    
    const rtData = tripType === 'revision' ? {
      type: revType, gases: revType === 'A' ? revA_gases : (revB_tipo === 'gases'),
      revision: revType === 'A' ? revA_revision : (revB_tipo === 'completa'),
      inspeccion: revType === 'A' ? revA_inspeccion : false,
      frenos: revType === 'A' ? revA_frenos : false,
      tipoB: revType === 'B' ? revB_tipo : null
    } : null;

    const jobData = {
      scheduledDate: formData.get('scheduledDate'), client: finalClient, brand, model,
      vin: vin.toUpperCase(), plate: plate.toUpperCase(), origin: formData.get('origin'), destination: formData.get('destination'),
      tripType, vehicleType, rtData: rtData || null,
      assignedDrivers: assignedDriversList.map(d => ({id: d.id, name: d.name, email: d.email})), assignedEmails: assignedDriversList.map(d => d.email)
    };

    try {
      if (jobToEdit) {
         await updateDoc(doc(db, 'transport_jobs', jobToEdit.id), jobData);
         showAlert(`Trabajo actualizado exitosamente.`);
         if (onCancelEdit) onCancelEdit();
      } else {
         jobData.status = 'pending';
         jobData.createdAt = Date.now();
         jobData.checklist = null;
         await addDoc(collection(db, 'transport_jobs'), jobData);
         showAlert(`Trabajo asignado exitosamente.`);
      }
      
      if ((plate || vin) && !vehicles.find(v => (plate && v.plate === plate) || (vin && v.vin === vin))) await addDoc(collection(db, 'vehicles'), { plate: plate.toUpperCase(), vin: vin.toUpperCase(), vehicleType, brand, model, client: finalClient, createdAt: Date.now() });
      
      const driverTokens = assignedDriversList.map(d => d.fcmToken).filter(token => token);
      if (driverTokens.length > 0) {
        try {
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokens: driverTokens,
              title: jobToEdit ? "🔄 Traslado Actualizado" : "📍 ¡Nuevo Traslado Asignado!",
              body: `Vehículo: ${brand} ${model} (${plate || 'S/N'})\nDesde: ${jobData.origin}`
            })
          });
        } catch (pushErr) { console.warn("Fallo el envío Push:", pushErr); }
      }

      onSuccess();
    } catch (error) { console.error(error); showAlert("Ocurrió un error guardando el trabajo."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">{jobToEdit ? 'Editar Trabajo' : 'Crear Nuevo Trabajo'}</h2>
        {jobToEdit && <button type="button" onClick={onCancelEdit} className="text-slate-500 hover:bg-slate-100 p-2 rounded-xl transition"><X className="w-6 h-6"/></button>}
      </div>
      <form onSubmit={handleCreateOrUpdateJob} className="space-y-6">
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-slate-700">1. Tipo de Servicio</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={()=>setTripType('traslado')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'traslado' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>Traslado Local</button>
            <button type="button" onClick={()=>setTripType('viaje')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'viaje' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>A Regiones</button>
            <button type="button" onClick={()=>setTripType('revision')} className={`flex-1 p-3 border-2 rounded-xl text-center font-bold text-sm transition-colors ${tripType === 'revision' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>Revisión Técnica</button>
          </div>
          {tripType === 'revision' && (
            <div className="p-4 bg-white border-2 border-blue-100 rounded-xl space-y-4 mt-4 animate-in fade-in">
               <h4 className="text-xs font-extrabold text-blue-600 uppercase">Detalle Revisión Técnica</h4>
               <select value={revType} onChange={e=>setRevType(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700">
                 <option value="A">Revisión Tipo A</option>
                 <option value="B">Revisión Tipo B</option>
               </select>
               {revType === 'A' && (
                 <div className="grid grid-cols-2 gap-3 text-sm font-bold text-slate-600">
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_gases} onChange={e=>setRevA_gases(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Gases</label>
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_revision} onChange={e=>setRevA_revision(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Revisión</label>
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_inspeccion} onChange={e=>setRevA_inspeccion(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Insp. Visual</label>
                   <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={revA_frenos} onChange={e=>setRevA_frenos(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/> Cert. Frenos</label>
                 </div>
               )}
               {revType === 'B' && (
                 <select value={revB_tipo} onChange={e=>setRevB_tipo(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700">
                   <option value="completa">Revisión Completa</option>
                   <option value="gases">Sólo Gases</option>
                 </select>
               )}
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
           <h3 className="text-base font-bold text-slate-700">2. Vehículo <span className="text-xs text-blue-500 font-bold">(Escribe para autocompletar)</span></h3>
           <div className="grid grid-cols-2 gap-4">
             <input value={plate} onChange={e=>handleVehicleSearch(e.target.value, 'plate')} type="text" placeholder="Patente (Ej. ABCD12)" className="w-full border-2 border-slate-300 p-3 text-sm rounded-xl uppercase outline-none focus:border-blue-500 font-black bg-white text-slate-800 shadow-sm" />
             <input value={vin} onChange={e=>handleVehicleSearch(e.target.value, 'vin')} type="text" placeholder="VIN / Chasis" className="w-full border-2 border-slate-300 p-3 text-sm rounded-xl uppercase outline-none focus:border-blue-500 font-black bg-white text-slate-800 shadow-sm" />
             <input value={brand} onChange={e=>setBrand(e.target.value)} type="text" placeholder="Marca" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-800" />
             <input value={model} onChange={e=>setModel(e.target.value)} type="text" placeholder="Modelo" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-800" />
             <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl col-span-2 outline-none focus:border-blue-500 font-bold text-slate-700 bg-white">
               <option value="auto">🚙 Auto / SUV</option>
               <option value="camioneta">🛻 Camioneta</option>
               <option value="furgon_pequeno">🚐 Furgón Pequeño</option>
               <option value="furgon_grande">🚐 Furgón Grande</option>
               <option value="camion">🚚 Camión Simple</option>
               <option value="camion_doble">🚚 Camión Doble Cabina</option>
               <option value="camion_2ejes">🚛 Camión (2 Ejes traseros)</option>
               <option value="camion_3ejes">🚛 Camión (3 Ejes traseros)</option>
             </select>
           </div>
        </div>
        
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-slate-700">3. Programación y Ruta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
               <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Fecha de Traslado</label>
               <input name="scheduledDate" type="date" defaultValue={jobToEdit?.scheduledDate || todayStr} required className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white text-slate-700" />
            </div>
            <div className="space-y-1 relative z-50">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider ml-1">Cliente</label>
              <CustomClientSelector 
                value={selectedClient} 
                onChange={(val) => setSelectedClient(val)} 
                clients={allClientsList} 
                placeholder="Seleccione Cliente (Opcional)" 
              />
              {selectedClient === 'OTRO' && <input type="text" value={manualClient} onChange={(e) => setManualClient(e.target.value)} placeholder="Escribe el nombre del cliente" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white mt-2 animate-in fade-in slide-in-from-top-2" />}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <input name="origin" defaultValue={jobToEdit?.origin || ''} type="text" placeholder="Desde (Origen)" className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
            <input name="destination" defaultValue={jobToEdit?.destination || ''} type="text" placeholder={tripType === 'revision' ? 'Planta de Revisión (Destino)' : 'Hasta (Destino)'} className="w-full border-2 border-slate-200 p-3 text-sm rounded-xl outline-none focus:border-blue-500 font-semibold bg-white" />
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl space-y-4">
           <h3 className="text-base font-bold text-slate-700">4. Conductores <span className="text-xs text-red-500 font-normal">(Obligatorio seleccionar al menos 1)</span></h3>
           <div className="max-h-64 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drivers.length === 0 ? <p className="text-sm text-slate-400 p-4 font-semibold col-span-full text-center">No hay conductores registrados.</p> : drivers.map(d => {
                const isSelected = selectedDriversUI.includes(d.id);
                return (
                <label key={d.id} className="relative flex cursor-pointer group">
                  <input type="checkbox" name="assignedDriverId" value={d.id} checked={isSelected} onChange={() => setSelectedDriversUI(prev => prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id])} className="sr-only" />
                  
                  <div className={`w-full flex items-center p-3 bg-white border-2 rounded-2xl transition-all ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 group-hover:border-blue-300'}`}>
                    <div className={`p-2.5 rounded-xl transition-colors shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <User className="w-5 h-5" />
                    </div>
                    <div className="ml-3 flex-1 overflow-hidden">
                      <span className={`block text-sm font-extrabold truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>{d.name}</span>
                      <span className={`block text-[10px] font-bold truncate mt-0.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{d.email}</span>
                    </div>
                    <CheckCircle className={`w-6 h-6 transition-transform duration-200 shrink-0 ml-2 ${isSelected ? 'scale-100 text-blue-600' : 'scale-0 text-slate-300'}`} />
                  </div>
                </label>
              )})}
           </div>
        </div>
        <div className="flex gap-3 pt-2">
          {jobToEdit && <button type="button" onClick={onCancelEdit} className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 px-8 py-3 rounded-2xl font-extrabold text-sm sm:text-lg transition-colors">Cancelar</button>}
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-extrabold text-sm sm:text-lg transition-colors shadow-lg shadow-blue-200 disabled:opacity-50">{isSubmitting ? 'Procesando...' : (jobToEdit ? 'Actualizar Trabajo' : 'Guardar y Asignar')}</button>
        </div>
      </form>
    </div>
  );
}