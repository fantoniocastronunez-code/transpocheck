import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Camera, CheckCircle } from 'lucide-react';
import { resizeImage } from '../../utils/helpers';

export default function DriverOnboarding({ driver, db, showAlert }) {
  const [docs, setDocs] = useState({ 
    photo: driver.photo || null, 
    idFront: driver.idFront || null, 
    idBack: driver.idBack || null, 
    licenseFront: driver.licenseFront || null, 
    licenseBack: driver.licenseBack || null 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await resizeImage(file, 800, 0.5);
      setDocs(prev => ({ ...prev, [field]: compressed }));
    } catch (error) {
      console.error("Error de imagen:", error);
      if (showAlert) showAlert("❌ Error al procesar la imagen. Intente de nuevo.");
      else alert("Error al procesar la imagen. Intente de nuevo.");
    }
  };

  const isComplete = docs.photo && docs.idFront && docs.idBack && docs.licenseFront && docs.licenseBack;

  const submitDocs = async () => {
    if (!isComplete) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'drivers', driver.id), docs);
    } catch (error) {
      console.error("Error guardando docs:", error);
      if (showAlert) showAlert("❌ Error al guardar los documentos. Revisa tu conexión.");
      else alert("Error guardando los documentos.");
      setIsSubmitting(false);
    }
  };

  // --- OPTIMIZACIÓN: Añadimos un parámetro 'captureType' para saltarnos la galería y abrir la cámara directa ---
  const uploadBtn = (field, label, captureType = "environment") => (
    <label className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-sm active:scale-[0.98] ${docs[field] ? 'bg-green-50 border-green-400' : 'bg-white border-slate-200 hover:border-blue-400'}`}>
      <div className="flex items-center gap-3">
         <div className={`p-2.5 rounded-full shadow-inner ${docs[field] ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-600'}`}>
            {docs[field] ? <CheckCircle className="w-5 h-5 animate-in zoom-in"/> : <Camera className="w-5 h-5"/>}
         </div>
         <span className={`font-bold text-sm ${docs[field] ? 'text-green-700' : 'text-slate-700'}`}>{label}</span>
      </div>
      
      {/* El atributo capture="user" abrirá la cámara frontal, "environment" la trasera. En PC pedirá archivo. */}
      <input 
        type="file" 
        accept="image/*" 
        capture={captureType} 
        className="hidden" 
        onChange={(e) => handleUpload(e, field)} 
      />
      
      {docs[field] ? (
         <img src={docs[field]} alt="OK" className="w-10 h-10 object-cover rounded-lg border border-green-200 shadow-sm animate-in fade-in" />
      ) : (
         <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest bg-blue-50 px-2 py-1 rounded-md">Subir</span>
      )}
    </label>
  );

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-100 space-y-6 max-w-md mx-auto animate-in zoom-in-95 duration-500">
      <div className="text-center space-y-2">
        <div className="bg-blue-600 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-200 mb-4"><User className="w-8 h-8 text-white"/></div>
        <h2 className="text-2xl font-black text-slate-800">Completa tu Perfil</h2>
        <p className="text-sm font-bold text-slate-500">Por normativa de la empresa, debes subir las fotografías de tu documentación para acceder a la ruta.</p>
      </div>

      <div className="space-y-3">
         {/* A la selfie le pasamos 'user' para forzar la cámara frontal automáticamente */}
         {uploadBtn('photo', 'Foto de Perfil (Selfie)', 'user')}
         
         {/* A los documentos les pasamos 'environment' para forzar la cámara trasera */}
         {uploadBtn('idFront', 'Carnet de Identidad (Frente)', 'environment')}
         {uploadBtn('idBack', 'Carnet de Identidad (Reverso)', 'environment')}
         {uploadBtn('licenseFront', 'Licencia de Conducir (Frente)', 'environment')}
         {uploadBtn('licenseBack', 'Licencia de Conducir (Reverso)', 'environment')}
      </div>

      <div className="pt-4 border-t border-slate-100">
         <button onClick={submitDocs} disabled={!isComplete || isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2 text-lg">
            {isSubmitting ? 'Guardando Perfil...' : 'Comenzar a Trabajar ➔'}
         </button>
         {!isComplete && <p className="text-[10px] font-bold text-slate-400 text-center mt-3 uppercase tracking-widest">Debes subir las 5 fotos para continuar</p>}
      </div>
    </div>
  );
}