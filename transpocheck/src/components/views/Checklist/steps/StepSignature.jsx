import React from 'react';
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
    <div className="space-y-5 animate-in fade-in duration-150 pt-3">
      
      {/* Firma Remota / QR */}
      {!formData.noReception && !formData.signatureData && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 text-center">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Firma Remota (Recomendado)
          </h3>
          
          <div className="bg-white dark:bg-slate-950 p-4 inline-block rounded-xl border border-slate-200 dark:border-slate-800 mx-auto">
            <QRCode value={`https://kovacs-logistica.web.app/sign/${job?.id}`} size={160} bgColor="transparent" fgColor="currentColor" className="text-slate-900 dark:text-slate-100" />
          </div>
          
          <button 
            type="button" 
            onClick={handleShare} 
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 rounded-lg transition-colors text-xs uppercase tracking-wider"
          >
            Compartir Enlace por WhatsApp
          </button>
        </div>
      )}

      {/* Firma en Pantalla */}
      {!formData.noReception && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Firma en Dispositivo
          </h3>
          
          <div className="space-y-3">
             <input type="text" placeholder="Nombre de quien recibe" value={formData.receiverName || ''} onChange={e => setF('receiverName', e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 p-3 rounded-lg text-sm font-medium bg-slate-50 dark:bg-slate-950 outline-none focus:border-sky-600 transition-colors" />
             <input type="text" placeholder="RUT (Ej: 12.345.678-9)" value={formData.receiverRut || ''} onChange={e => {
                let val = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase();
                if (val.length > 1) {
                  const dv = val.slice(-1);
                  const digits = val.slice(0, -1);
                  val = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
                }
                setF('receiverRut', val);
             }} className="w-full border border-slate-300 dark:border-slate-700 p-3 rounded-lg text-sm font-mono font-medium bg-slate-50 dark:bg-slate-950 outline-none focus:border-sky-600 transition-colors" />
          </div>

          {!formData.signatureLocked ? (
            <div className="mt-2 relative">
               <SignaturePad 
                 initialData={formData.signatureData || null}
                 onChange={(dataUrl) => setF('signatureData', dataUrl)}
                 onSave={(dataUrl) => {
                   saveSignature(dataUrl);
                   setF('signatureLocked', true);
                 }}
                 onClear={() => {
                   setF('signatureData', null);
                   setF('signatureLocked', false);
                 }}
               />
            </div>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-center relative overflow-hidden mt-4">
              <div className="absolute top-0 right-0 p-3"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
              <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-3">
                Acta Firmada
              </h3>
              <img src={formData.signatureData} alt="Firma" className="mx-auto h-24 object-contain opacity-90 mix-blend-multiply dark:mix-blend-screen dark:invert" />
              <button type="button" onClick={() => setF('signatureLocked', false)} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline mt-3">Volver a firmar</button>
            </div>
          )}
        </div>
      )}

      {/* Opción Sin Recepción */}
      {!formData.signatureData && (
        <label className={`flex p-4 rounded-xl border transition-colors cursor-pointer items-center gap-3 ${formData.noReception ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors border ${formData.noReception ? 'bg-red-600 border-red-600' : 'bg-transparent border-slate-300 dark:border-slate-600'}`}>
            <input type="checkbox" checked={formData.noReception || false} onChange={e => setF('noReception', e.target.checked)} className="hidden" />
            {formData.noReception && <CheckCircle className="w-3.5 h-3.5 text-white" />}
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-xs tracking-wider uppercase">Sin Recepción</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">Se cerrará el acta sin firma de cliente (dejar fuera de horario, etc).</p>
          </div>
        </label>
      )}

    </div>
  );
};
