import React, { useRef } from 'react';
import { Share2, FileSignature, CheckCircle } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';
import SignaturePad from '../../../ui/SignaturePad';
import QRCode from 'react-qr-code';

export const StepSignature = () => {
  const { job, formData, setF, showAlert } = useChecklist();

  const handleShare = async () => {
    try {
      const url = `https://kovacs-logistica.web.app/sign/${job.id}`;
      if (navigator.share) {
        await navigator.share({
          title: `Firma Acta - ${formData.plateOrVin}`,
          text: 'Por favor, firma el acta de recepción de tu vehículo en el siguiente enlace:',
          url: url
        });
      } else {
        await navigator.clipboard.writeText(url);
        showAlert("✅ Enlace copiado al portapapeles.");
      }
    } catch (e) {
      console.error(e);
      showAlert("❌ Error al compartir.");
    }
  };

  const saveSignature = (dataUrl) => {
    if (!dataUrl) {
      return showAlert("⚠️ Por favor firme antes de guardar.");
    }
    setF('signatureData', dataUrl);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Firma Remota / QR */}
      {!formData.noReception && !formData.signatureData && (
        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-3xl border border-indigo-200/50 dark:border-indigo-800/30 shadow-sm space-y-5 text-center">
          <h3 className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-widest flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" /> Firma Remota (Recomendado)
          </h3>
          
          <div className="bg-white dark:bg-slate-800 p-4 inline-block rounded-3xl shadow-sm mx-auto">
            <QRCode value={`https://kovacs-logistica.web.app/sign/${job?.id}`} size={160} bgColor="transparent" fgColor="currentColor" className="text-slate-800 dark:text-slate-100" />
          </div>
          
          <button 
            type="button" 
            onClick={handleShare} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-500/30 active:scale-95 transition-all text-sm tracking-wide"
          >
            COMPARTIR ENLACE POR WHATSAPP
          </button>
        </div>
      )}

      {/* Firma en Pantalla */}
      {!formData.noReception && !formData.signatureData && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
          <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <FileSignature className="w-4 h-4" /> Firma en Dispositivo
          </h3>
          
          <div className="space-y-3">
             <input type="text" placeholder="Nombre de quien recibe" value={formData.receiverName || ''} onChange={e => setF('receiverName', e.target.value)} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-sm font-bold bg-slate-50/50 dark:bg-slate-800/50 outline-none focus:border-blue-500 transition-colors" />
             <input type="text" placeholder="RUT (Ej: 12.345.678-9)" value={formData.receiverRut || ''} onChange={e => setF('receiverRut', e.target.value)} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-sm font-bold bg-slate-50/50 dark:bg-slate-800/50 outline-none focus:border-blue-500 transition-colors" />
          </div>

          <div className="mt-2 relative">
             <SignaturePad 
               initialData={null}
               onSave={(dataUrl) => saveSignature(dataUrl)}
               onClear={() => setF('signatureData', null)}
             />
          </div>
        </div>
      )}

      {/* Mostrar Firma Guardada */}
      {formData.signatureData && (
        <div className="bg-green-50/50 dark:bg-green-900/10 p-5 rounded-3xl border border-green-200/50 dark:border-green-800/30 shadow-sm text-center relative overflow-hidden animate-in zoom-in-95">
          <div className="absolute top-0 right-0 p-3"><CheckCircle className="w-6 h-6 text-green-500" /></div>
          <h3 className="text-[11px] font-black text-green-800 dark:text-green-300 uppercase tracking-widest mb-4">
            Acta Firmada
          </h3>
          <img src={formData.signatureData} alt="Firma" className="mx-auto h-24 object-contain opacity-80 mix-blend-multiply dark:mix-blend-screen dark:invert" />
          {formData.receiverName && <p className="text-sm font-bold text-green-900 dark:text-green-100 mt-2">{formData.receiverName}</p>}
          <button type="button" onClick={() => setF('signatureData', null)} className="text-[10px] font-black text-green-600/70 hover:text-green-700 underline mt-3">Volver a firmar</button>
        </div>
      )}

      {/* Opción Sin Recepción */}
      {!formData.signatureData && (
        <label className={`flex p-4 rounded-3xl border-2 transition-all cursor-pointer items-center gap-3 ${formData.noReception ? 'border-red-400 bg-red-50 dark:bg-red-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'}`}>
          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors border-2 ${formData.noReception ? 'bg-red-500 border-red-500' : 'bg-transparent border-slate-300 dark:border-slate-600'}`}>
            <input type="checkbox" checked={formData.noReception || false} onChange={e => setF('noReception', e.target.checked)} className="hidden" />
            {formData.noReception && <CheckCircle className="w-4 h-4 text-white" />}
          </div>
          <div>
            <p className="font-black text-slate-800 dark:text-slate-200 text-xs tracking-widest uppercase">SIN RECEPCIÓN</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">Se cerrará el acta sin firma de cliente (dejar fuera de horario, llaves en buzón, etc).</p>
          </div>
        </label>
      )}

    </div>
  );
};
