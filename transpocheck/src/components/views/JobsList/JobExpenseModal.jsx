import React, { useState } from 'react';
import { 
  Receipt, Fuel, Camera, X, Check, DollarSign, 
  AlertCircle, Loader2, Plus, Tag, FileText, CheckCircle2 
} from 'lucide-react';
import InAppCamera from '../../ui/InAppCamera';
import { resizeImage } from '../../../utils/helpers';
import { uploadImageToStorage } from '../../../hooks/useFirebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

export default function JobExpenseModal({
  job,
  isOpen,
  onClose,
  currentUserEmail,
  drivers = [],
  showAlert,
  showConfirm,
  db,
  setFullScreenPhoto
}) {
  if (!isOpen || !job) return null;

  const [expenseType, setExpenseType] = useState('fuel'); // 'fuel' | 'other'
  const [amount, setAmount] = useState('');
  const [motivo, setMotivo] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [fuelGaugePhoto, setFuelGaugePhoto] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cámara nativa in-app
  const [cameraConfig, setCameraConfig] = useState({ isOpen: false, title: '', target: null });

  const isFuel = expenseType === 'fuel';
  const jobIdent = job.plate || job.vin || 'S/N';
  const assignedDriverEmail = job.acceptedByEmail || currentUserEmail;
  const currentDriver = drivers.find(d => d.email === assignedDriverEmail) || 
                        drivers.find(d => d.email === currentUserEmail) || 
                        { name: currentUserEmail, email: currentUserEmail };

  const handleCapturePhoto = (target, title) => {
    setCameraConfig({
      isOpen: true,
      title,
      target
    });
  };

  const handleCameraCapture = async (file) => {
    try {
      const compressedDataUrl = await resizeImage(file, 1200, 0.65);
      if (cameraConfig.target === 'receipt') {
        setReceiptPhoto(compressedDataUrl);
      } else if (cameraConfig.target === 'fuelGauge') {
        setFuelGaugePhoto(compressedDataUrl);
      }
    } catch (err) {
      console.error("[ERR-EXP-PHOTO-01] Error al procesar imagen de gasto:", err);
      showAlert("❌ [ERR-EXP-PHOTO-01] Error al procesar la fotografía. Intenta nuevamente.");
    } finally {
      setCameraConfig({ isOpen: false, title: '', target: null });
    }
  };

  const handleFileInput = async (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await resizeImage(file, 1200, 0.65);
      if (target === 'receipt') {
        setReceiptPhoto(compressedDataUrl);
      } else if (target === 'fuelGauge') {
        setFuelGaugePhoto(compressedDataUrl);
      }
    } catch (err) {
      console.error("[ERR-EXP-FILE-01] Error al leer archivo de imagen:", err);
      showAlert("❌ [ERR-EXP-FILE-01] No se pudo cargar el archivo de imagen.");
    }
  };

  const cleanNumericAmount = (str) => {
    return Number(String(str).replace(/[^0-9]/g, '')) || 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSaving) return;

    const numAmount = cleanNumericAmount(amount);

    if (numAmount <= 0) {
      return showAlert("❌ [ERR-EXP-VAL-01] Debes ingresar un monto válido mayor a $0.");
    }

    if (isFuel) {
      if (!fuelGaugePhoto) {
        return showAlert("❌ [ERR-EXP-VAL-02] Es obligatoria la foto del estanque después de cargar combustible.");
      }
      if (!receiptPhoto) {
        return showAlert("❌ [ERR-EXP-VAL-03] Es obligatoria la foto de la boleta o comprobante de combustible.");
      }
    } else {
      if (!motivo || motivo.trim().length === 0) {
        return showAlert("❌ [ERR-EXP-VAL-04] Debes indicar el motivo del gasto (Ej: Peaje, Estacionamiento, etc.).");
      }
      if (!receiptPhoto) {
        return showAlert("❌ [ERR-EXP-VAL-05] Es obligatoria la foto de la boleta o comprobante del gasto.");
      }
    }

    setIsSaving(true);

    try {
      // 1. Subir imágenes a Firebase Storage
      const timestamp = Date.now();
      const receiptUrl = await uploadImageToStorage(
        receiptPhoto, 
        `expenses/${job.id}`, 
        `receipt_${timestamp}.jpg`
      );

      let fuelGaugeUrl = null;
      if (isFuel && fuelGaugePhoto) {
        fuelGaugeUrl = await uploadImageToStorage(
          fuelGaugePhoto, 
          `expenses/${job.id}`, 
          `fuel_after_${timestamp}.jpg`
        );
      }

      const detailText = isFuel 
        ? `Carga de Combustible (Patente: ${jobIdent})`
        : `${motivo.trim()} (Patente: ${jobIdent})`;

      // 2. Crear registro en colección global 'expenses' para finanzas y rendiciones
      await addDoc(collection(db, 'expenses'), {
        driverId: currentDriver?.id || '',
        driverEmail: currentDriver?.email || currentUserEmail,
        driverName: currentDriver?.name || currentUserEmail,
        type: 'expense',
        category: isFuel ? 'combustible' : 'otro',
        amount: numAmount,
        detail: detailText,
        jobId: job.id,
        plate: jobIdent,
        deductedAmount: numAmount,
        receiptImage: receiptUrl,
        fuelGaugeImage: fuelGaugeUrl || null,
        createdAt: timestamp
      });

      // 3. Descontar del saldo del conductor en 'drivers'
      if (currentDriver?.id) {
        const curBal = Number(currentDriver.balance) || 0;
        await updateDoc(doc(db, 'drivers', currentDriver.id), {
          balance: curBal - numAmount
        });
      }

      // 4. Guardar en el documento de traslado 'transport_jobs' para Ficha Técnica inmediata
      const existingExpenses = Array.isArray(job.expenses) ? job.expenses : [];
      const newExpenseRecord = {
        id: `exp_${timestamp}`,
        type: isFuel ? 'fuel' : 'other',
        category: isFuel ? 'combustible' : 'otro',
        motivo: isFuel ? 'Carga de Combustible' : motivo.trim(),
        amount: numAmount,
        receiptUrl,
        fuelGaugeUrl: fuelGaugeUrl || null,
        registeredByEmail: currentUserEmail,
        registeredByName: currentDriver?.name || currentUserEmail,
        createdAt: timestamp
      };

      await updateDoc(doc(db, 'transport_jobs', job.id), {
        expenses: [...existingExpenses, newExpenseRecord]
      });

      showAlert(`✅ [OK-EXP-01] Gasto de $${numAmount.toLocaleString('es-CL')} registrado con éxito e integrado a la Ficha Técnica.`);
      onClose();
    } catch (err) {
      console.error("[ERR-EXP-SAVE-01] Error al guardar gasto del traslado:", err);
      showAlert(`❌ [ERR-EXP-SAVE-01] Ocurrió un error al guardar el gasto: ${err.message || 'Error de conexión'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const existingExpenses = Array.isArray(job.expenses) ? job.expenses : [];
  const quickMotivos = ["Peaje", "Estacionamiento", "Lavado", "Reparación / Pinchazo", "Líquido de frenos", "Otro"];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 sm:p-5 text-white flex justify-between items-center shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black leading-tight uppercase tracking-wider">
                Ingreso de Gastos
              </h3>
              <p className="text-xs text-amber-100 font-bold">
                {job.brand} {job.model} • <span className="underline">{jobIdent}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* Selector de Tipo de Gasto */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block mb-2">
              Tipo de Gasto a Registrar
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExpenseType('fuel')}
                className={`py-3.5 px-3 rounded-2xl border-2 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  isFuel 
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 shadow-sm shadow-amber-500/20 ring-2 ring-amber-500/20' 
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Fuel className="w-4 h-4 text-amber-500" />
                <span>Combustible</span>
              </button>

              <button
                type="button"
                onClick={() => setExpenseType('other')}
                className={`py-3.5 px-3 rounded-2xl border-2 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  !isFuel 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-sm shadow-blue-500/20 ring-2 ring-blue-500/20' 
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Receipt className="w-4 h-4 text-blue-500" />
                <span>Otro Gasto</span>
              </button>
            </div>
          </div>

          {/* Campo Motivo (si es Otro Gasto) */}
          {!isFuel && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block">
                Motivo del Gasto *
              </label>

              {/* Botones de selección rápida */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {quickMotivos.map((qm) => (
                  <button
                    key={qm}
                    type="button"
                    onClick={() => setMotivo(qm === 'Otro' ? '' : qm)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      motivo === qm 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {qm}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Peaje Ruta del Maipo, Estacionamiento terminal..."
                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors shadow-inner"
              />
            </div>
          )}

          {/* Monto ($ CLP) */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block mb-1">
              Monto del Gasto ($ CLP) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amount ? Number(amount.replace(/[^0-9]/g, '')).toLocaleString('es-CL') : ''}
                onChange={(e) => {
                  const rawVal = e.target.value.replace(/[^0-9]/g, '');
                  setAmount(rawVal);
                }}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-9 pr-4 text-xl font-black text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Fotos Requeridas */}
          <div className="space-y-4 pt-1">

            {/* 1. Foto de Estanque después de la carga (SOLO SI ES COMBUSTIBLE) */}
            {isFuel && (
              <div className="p-4 rounded-2xl border-2 border-amber-200/80 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-3 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5 tracking-wider">
                    <Fuel className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Foto del Estanque después de la carga *
                  </span>
                  {fuelGaugePhoto && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3" /> Capturada
                    </span>
                  )}
                </div>

                {fuelGaugePhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-amber-300 dark:border-amber-700 aspect-[16/9] group">
                    <img 
                      src={fuelGaugePhoto} 
                      alt="Estanque después de carga" 
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setFullScreenPhoto && setFullScreenPhoto(fuelGaugePhoto)}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 flex justify-between items-center">
                      <span className="text-[10px] text-white font-bold">Toca para ampliar</span>
                      <button
                        type="button"
                        onClick={() => handleCapturePhoto('fuelGauge', 'Foto del Estanque (Después de Cargar)')}
                        className="text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg"
                      >
                        Repetir Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCapturePhoto('fuelGauge', 'Foto del Estanque (Después de Cargar)')}
                      className="py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                      <Camera className="w-4 h-4" /> Tomar Foto
                    </button>

                    <label className="py-3 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-amber-400 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm">
                      <FileText className="w-4 h-4 text-slate-400" /> Galería
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleFileInput(e, 'fuelGauge')} 
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 2. Foto de la Boleta o Comprobante (OBLIGATORIA PARA AMBOS) */}
            <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5 tracking-wider">
                  <Receipt className="w-4 h-4 text-blue-500" />
                  Foto de la Boleta o Comprobante *
                </span>
                {receiptPhoto && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Capturada
                  </span>
                )}
              </div>

              {receiptPhoto ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 aspect-[16/9] group">
                  <img 
                    src={receiptPhoto} 
                    alt="Boleta" 
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setFullScreenPhoto && setFullScreenPhoto(receiptPhoto)}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 flex justify-between items-center">
                    <span className="text-[10px] text-white font-bold">Toca para ampliar</span>
                    <button
                      type="button"
                      onClick={() => handleCapturePhoto('receipt', 'Foto Boleta / Comprobante')}
                      className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg"
                    >
                      Repetir Foto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCapturePhoto('receipt', 'Foto Boleta / Comprobante')}
                    className="py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Camera className="w-4 h-4" /> Tomar Boleta
                  </button>

                  <label className="py-3 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm">
                    <FileText className="w-4 h-4 text-slate-400" /> Galería
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleFileInput(e, 'receipt')} 
                    />
                  </label>
                </div>
              )}
            </div>

          </div>

          {/* Historial de Gastos ya registrados en este traslado */}
          {existingExpenses.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-2 flex items-center justify-between">
                <span>Gastos Registrados en este Traslado ({existingExpenses.length})</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  Total: ${existingExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString('es-CL')}
                </span>
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {existingExpenses.map((exp, idx) => (
                  <div key={exp.id || idx} className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        {exp.motivo || (exp.type === 'fuel' ? 'Combustible' : 'Otro')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {exp.createdAt ? new Date(exp.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 dark:text-slate-100">
                        ${Number(exp.amount || 0).toLocaleString('es-CL')}
                      </span>
                      {exp.receiptUrl && (
                        <button
                          type="button"
                          onClick={() => setFullScreenPhoto && setFullScreenPhoto(exp.receiptUrl)}
                          className="text-[9px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800"
                        >
                          Boleta
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer / Acciones */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando Gasto...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Guardar e Integrar a Ficha</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Cámara Nativa Interna */}
      <InAppCamera
        isOpen={cameraConfig.isOpen}
        title={cameraConfig.title}
        onClose={() => setCameraConfig({ isOpen: false, title: '', target: null })}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
