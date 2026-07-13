import React, { useState, useEffect } from 'react';
import { updateDoc, doc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { 
  Wallet, ArrowUpCircle, ArrowDownCircle, CheckCircle, 
  Clock, X, Edit2, Trash2, Camera, Receipt, ClipboardList 
} from 'lucide-react';
import { formatMoney, resizeImage } from '../../utils/helpers';

export default function ExpensesView({ role, drivers: rawDrivers, jobs, expenses: rawExpenses, db, currentUserEmail, showAlert, showConfirm }) {
  // SEGURO DE VIDA: Si Firebase demora un milisegundo en enviar los datos, usamos listas vacías temporalmente para que la app no se estrelle.
  const drivers = rawDrivers || [];
  const expenses = rawExpenses || [];

  const isAdminView = role === 'admin';
  const myDriver = drivers.find(d => d.email === currentUserEmail);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState(null);
  const [returnMethod, setReturnMethod] = useState('transferencia');
  const [editingExpense, setEditingExpense] = useState(null);
  const [adminTxType, setAdminTxType] = useState('assignment'); 
  const [selectedJobId, setSelectedJobId] = useState(''); // <-- NUEVO ESTADO PARA LA TARJETA DE TRABAJO 

  const activeOrPendingJobs = jobs?.filter(j => j.status === 'pending' || j.status === 'accepted') || [];
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 6. SKELETON SCREENS (Carga Fantasma)
  const [isAppReady, setIsAppReady] = useState(false);
  useEffect(() => {
     const timer = setTimeout(() => setIsAppReady(true), 800);
     return () => clearTimeout(timer);
  }, []);

  const addExp = async (e, type, amount, detail, driverId, dName, dEmail) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const currentBalance = drivers.find(d => d.id === driverId)?.balance || 0;
    
    if (!isAdminView && type === 'expense' && amount > currentBalance) {
        setIsSubmitting(false);
        return showAlert(`Saldo insuficiente. Tienes ${formatMoney(currentBalance)}. Solicita asignación de dinero al administrador para rendir este monto.`);
    }
    
    const assocJobId = e.target.jobId?.value || '';
    let detailString = detail || (type === 'assignment' ? 'Asignación de fondos' : 'Gasto registrado por Admin');

    if (assocJobId) {
      const jb = activeOrPendingJobs.find(x => x.id === assocJobId);
      if (jb) detailString += ` (Asoc. a patente ${jb.plate || jb.vin || 'S/N'})`;
    }

    let newBalance = currentBalance;
    let deductedAmount = amount; 
    
    if (type === 'assignment') {
       newBalance = currentBalance + amount;
    } else if (type === 'expense') {
       newBalance = currentBalance - amount;
    }

    try {
      // 8. INTERFAZ OPTIMISTA: Quitamos los 'await' para que Firebase lo resuelva en segundo plano
      updateDoc(doc(db, 'drivers', driverId), { balance: newBalance });
      addDoc(collection(db, 'expenses'), { driverId, driverEmail: dEmail, driverName: dName, type, amount, detail: detailString, jobId: assocJobId, deductedAmount, createdAt: Date.now() });
      
      // --- NUEVO: NOTIFICACIÓN POR CORREO AL CONDUCTOR ---
      const targetDriver = drivers.find(d => d.id === driverId);
      if (targetDriver && targetDriver.notifications) {
         const notifType = type === 'assignment' ? 'asignacion' : 'nuevo_monto';
         if (targetDriver.notifications[notifType]) {
            fetch('/api/notify-driver', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  email: targetDriver.email,
                  driverName: targetDriver.name,
                  type: notifType,
                  amount: amount,
                  detail: detailString,
                  newBalance: newBalance
               })
            }).catch(err => console.warn("Aviso de correo al conductor falló:", err));
         }
      }
      // ---------------------------------------------------

      e.target.reset(); 
      showAlert(type === 'assignment' ? "Fondo asignado correctamente." : "Gasto registrado exitosamente.");
    } catch (err) { console.error(err); }
    finally { setTimeout(() => setIsSubmitting(false), 300); }
  };

  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const submitReturn = async () => {
    if (returnMethod === 'transferencia' && !returnReceipt) return showAlert("Sube la foto de la transferencia.");
    if (!myDriver?.balance) return;
    if (isSubmittingReturn) return;
    setIsSubmittingReturn(true);
    
    let det = returnMethod === 'efectivo' ? 'Rendición en Efectivo (En revisión)' : 'Rendición de Vuelto (En revisión)';
    
    try {
      // Interfaz Optimista: Sin await en la base de datos
      addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: det, receiptImage: returnReceipt, createdAt: Date.now() });
      
      // Disparamos el correo al administrador en segundo plano
              fetch('/api/notify-admin', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                    type: 'rendicion',
                    driverName: myDriver.name,
                    amount: myDriver.balance,
                    detail: det
                 })
              }).catch(mailErr => console.warn("Aviso de correo al admin falló:", mailErr));

      // --- NUEVO: COPIA AL CORREO DEL CONDUCTOR (RENDICIÓN PENDIENTE) ---
              if (myDriver.notifications && myDriver.notifications.rendicion_pendiente) {
                 fetch('/api/notify-driver', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                       email: myDriver.email,
                       driverName: myDriver.name,
                       type: 'rendicion_pendiente',
                       amount: myDriver.balance,
                       detail: det
                    })
                 }).catch(err => console.warn("Copia al conductor falló:", err));
              }
      // ------------------------------------------------------------------

              setIsReturnOpen(false); setReturnReceipt(null); showAlert("✅ Rendición enviada. Esperando validación de Admin.");
            } catch(e) {
              console.error("Error enviando rendición:", e);
              showAlert("❌ Ocurrió un error al enviar la rendición.");
            }
            finally { setTimeout(() => setIsSubmittingReturn(false), 300); }
          };


          const approveReturn = async (exp) => {
            try {
              const d = drivers.find(x => x.id === exp.driverId);
              let newDriverBalance = 0;
              if (d) {
                 newDriverBalance = Math.max(0, (d.balance||0) - exp.amount);
                 await updateDoc(doc(db, 'drivers', d.id), { balance: newDriverBalance });
              }
              await updateDoc(doc(db, 'expenses', exp.id), { type: 'return', detail: 'Rendición Aprobada' });
              
              // --- NUEVO: NOTIFICAR APROBACIÓN AL CONDUCTOR ---
              if (d && d.notifications && d.notifications.nuevo_monto) {
                 fetch('/api/notify-driver', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                       email: d.email,
                       driverName: d.name,
                       type: 'rendicion_aprobada',
                       amount: exp.amount,
                       detail: 'Rendición Aprobada',
                       newBalance: newDriverBalance
                    })
                 }).catch(err => console.warn("Aviso de aprobación falló:", err));
              }
              // ------------------------------------------------

              showAlert("✅ Rendición aprobada. El balance del conductor volvió a 0.");
            } catch(e){
              console.error("Error aprobando rendición:", e);
              showAlert("❌ Error al aprobar la rendición. Revisa tu conexión.");
            }
          };

          const delExp = (exp) => {
            if (!isAdminView && exp.type === 'assignment') return showAlert("No posees permisos.");
            showConfirm("¿Eliminar registro financiero? El saldo se recalculará.", async () => {
              try {
                const d = drivers.find(x => x.id === exp.driverId);
                if (d) {
                   let amountToRestore = exp.type === 'assignment' ? -exp.amount : (exp.deductedAmount !== undefined ? exp.deductedAmount : exp.amount);
                   await updateDoc(doc(db, 'drivers', d.id), { balance: (d.balance||0) + amountToRestore });
                }
                await deleteDoc(doc(db, 'expenses', exp.id));
                showAlert("✅ Registro eliminado y saldo recalculado.");
              } catch(e){
                console.error("Error eliminando registro:", e);
                showAlert("❌ Error al eliminar el registro financiero.");
              }
            });
          };

  const resetBalance = (d) => {
     if (!d.balance || d.balance === 0) return showAlert("El saldo de este conductor ya es $0.");
     showConfirm(`¿Confirmas realizar un corte de caja? El saldo de ${d.name} quedará en $0 y se creará un registro de ajuste automático.`, async () => {
        try {
           const type = d.balance > 0 ? 'expense' : 'assignment'; // Restamos si hay saldo a favor, sumamos si está en negativo
           const amount = Math.abs(d.balance);
           const detailString = "Corte de Caja (Reinicio a $0 por Administrador)";
           
           await updateDoc(doc(db, 'drivers', d.id), { balance: 0 });
           await addDoc(collection(db, 'expenses'), { driverId: d.id, driverEmail: d.email, driverName: d.name, type, amount, detail: detailString, jobId: '', deductedAmount: amount, createdAt: Date.now() });
           
           showAlert(`Saldo de ${d.name} reiniciado correctamente a $0.`);
        } catch(e) {
           console.error(e);
           showAlert("Error al reiniciar el saldo a $0.");
        }
     });
  };

  const exportAndClearExpenses = async () => {
     if (expenses.length === 0) return showAlert("No hay movimientos para exportar.");
     showConfirm("⚠️ ATENCIÓN: Esto descargará el historial en Excel (CSV) y luego BORRARÁ todos los registros de gastos, dejando los saldos en $0. ¿Estás completamente seguro?", async () => {
        try {
           setIsSubmitting(true);
           
           // 1. Construir el CSV con BOM para que Excel lea las tildes (UTF-8)
           let csvContent = "Conductor,Email,Tipo de Movimiento,Monto,Detalle,Fecha\n";
           
           expenses.forEach(exp => {
              const d = new Date(exp.createdAt);
              const dateStr = isNaN(d.getTime()) ? 'Fecha inválida' : d.toLocaleString();
              const typeStr = exp.type === 'assignment' ? 'Fondo Asignado' : (exp.type === 'expense' ? 'Gasto' : (exp.type === 'return' ? 'Rendición Aprobada' : 'Rendición Pendiente'));
              const safeDetail = `"${(exp.detail || '').replace(/"/g, '""')}"`;
              csvContent += `"${exp.driverName || 'Desconocido'}","${exp.driverEmail || ''}","${typeStr}",${exp.amount},${safeDetail},"${dateStr}"\n`;
           });

           // 2. Descargar el archivo
           const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
           const link = document.createElement("a");
           link.href = URL.createObjectURL(blob);
           link.download = `Historial_Viaticos_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);

           // 3. Limpiar Base de Datos (Eliminar gastos masivamente)
           for (const exp of expenses) {
              await deleteDoc(doc(db, 'expenses', exp.id));
           }

           // 4. Reiniciar todos los saldos de conductores a $0
           for (const d of drivers) {
              if (d.balance && d.balance !== 0) {
                 await updateDoc(doc(db, 'drivers', d.id), { balance: 0 });
              }
           }

           showAlert("✅ Historial exportado y sistema limpiado correctamente.");
        } catch(error) {
           console.error(error);
           showAlert("Error al exportar y limpiar el sistema.");
        } finally {
           setIsSubmitting(false);
        }
     });
  };

  const TransactionIcon = ({ type }) => {
    if (type === 'assignment') return <ArrowUpCircle className="w-5 h-5 text-green-500 shrink-0"/>;
    if (type === 'pending_return') return <Clock className="w-5 h-5 text-amber-500 shrink-0"/>;
    if (type === 'expense') return <ArrowDownCircle className="w-5 h-5 text-red-500 shrink-0"/>;
    return <CheckCircle className="w-5 h-5 text-blue-500 shrink-0"/>;
  };

  const EditExpenseModal = ({ expense, onClose }) => {
    const handleUpdateSubmit = async (e) => {
      e.preventDefault();
      if (!isAdminView && expense.type === 'assignment') { showAlert("No puedes modificar una asignación."); return onClose(); }
      const newAmount = Number(e.target.amount.value);
      const newDetail = e.target.detail.value;

      try {
        let newlyDeducted = newAmount;
        const driverSnapshot = drivers.find(d => d.id === expense.driverId);
        let currentDriverBalance = driverSnapshot ? (driverSnapshot.balance || 0) : 0;
        
        if (driverSnapshot) {
          if (expense.type === 'assignment') {
             const amountDiff = newAmount - expense.amount;
             currentDriverBalance += amountDiff;
          } else if (expense.type === 'expense' || expense.type === 'return') {
             let oldDeducted = expense.deductedAmount !== undefined ? expense.deductedAmount : expense.amount;
             
             currentDriverBalance += oldDeducted;
             currentDriverBalance -= newAmount;
             newlyDeducted = newAmount;
          }
          await updateDoc(doc(db, 'drivers', expense.driverId), { balance: currentDriverBalance });
        }
        await updateDoc(doc(db, 'expenses', expense.id), { amount: newAmount, detail: newDetail, deductedAmount: newlyDeducted });
        
        // --- NUEVO: NOTIFICACIÓN POR CORREO AL CONDUCTOR (MODIFICACIÓN) ---
        if (driverSnapshot && driverSnapshot.notifications && driverSnapshot.notifications.modificacion) {
           fetch('/api/notify-driver', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 email: driverSnapshot.email,
                 driverName: driverSnapshot.name,
                 type: 'modificacion',
                 oldAmount: expense.amount,
                 newAmount: newAmount,
                 detail: newDetail,
                 newBalance: currentDriverBalance
              })
           }).catch(err => console.warn("Aviso de modificación falló:", err));
        }
        // ------------------------------------------------------------------

        showAlert("Registro actualizado."); onClose();
      } catch (error) { console.error(error); showAlert("Error actualizando."); }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <form onSubmit={handleUpdateSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Editar Registro</h3><button type="button" onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
          <div className="space-y-4">
            <div><label className="text-xs font-bold text-slate-500 uppercase">Detalle</label><input name="detail" defaultValue={expense.detail} required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" /></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Monto ($)</label><input name="amount" type="number" defaultValue={expense.amount} required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" /></div>
          </div>
          <div className="flex gap-4 mt-6"><button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button type="submit" className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Guardar</button></div>
        </form>
      </div>
    );
  };

  const safeDateRender = (timestamp) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return 'Fecha inválida';
      return d.toLocaleDateString();
    } catch(e) { return 'Fecha inválida'; }
  };

  // Muestra el Carga Fantasma mientras inicia la vista
  if (!isAppReady) {
    return (
      <main className={`${isAdminView ? 'max-w-3xl' : 'max-w-md'} mx-auto p-4 pt-20 sm:pt-24 space-y-6 pb-24`}>
        <div className="h-8 w-48 bg-slate-200/60 animate-pulse rounded-lg mb-6"></div>
        <div className="h-32 bg-slate-200/50 animate-pulse rounded-3xl w-full mb-6"></div>
        <div className="space-y-4">
           <div className="h-24 bg-slate-100/80 animate-pulse rounded-2xl w-full"></div>
           <div className="h-24 bg-slate-100/80 animate-pulse rounded-2xl w-full"></div>
           <div className="h-24 bg-slate-100/80 animate-pulse rounded-2xl w-full"></div>
        </div>
      </main>
    );
  }

  if (isAdminView) {
    return (
      <main className="max-w-3xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
        {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}
        {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
         <h2 className="text-2xl font-extrabold flex items-center gap-2"><Wallet className="text-blue-600"/> Control Viáticos</h2>
         <button 
            type="button" 
            onClick={exportAndClearExpenses} 
            disabled={isSubmitting || expenses.length === 0}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50"
         >
            <Trash2 className="w-4 h-4" /> Cierre de Ciclo
         </button>
       </div>
        
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest ml-2 mb-4">Directorio de Conductores</h3>
          {drivers.map(d => (
            <div key={d.id} className={`bg-white p-4 sm:p-5 rounded-3xl border transition-all ${selectedDriverId === d.id ? 'border-blue-500 shadow-md ring-4 ring-blue-50' : 'border-slate-200 shadow-sm hover:border-blue-300'}`}>
              
              <div className="flex justify-between items-center cursor-pointer" onClick={() => {setSelectedDriverId(d.id === selectedDriverId ? null : d.id); setAdminTxType('assignment'); setSelectedJobId('');}}>
                <div>
                  <p className="font-extrabold text-lg text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400 font-bold">{d.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Saldo</p>
                  <p className={`font-black text-xl ${d.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(d.balance||0)}</p>
                </div>
              </div>
              
              {selectedDriverId === d.id && (
                <div className="mt-5 border-t border-slate-100 pt-5 animate-in slide-in-from-top-2 duration-300">
                  
                  <form onSubmit={(e) => addExp(e, adminTxType, Number(e.target.amount.value), adminTxType === 'expense' ? e.target.detail?.value : '', d.id, d.name, d.email)} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 mb-6 relative">
                    <div className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black uppercase text-blue-600 tracking-widest border border-slate-200 rounded-full">Nuevo Registro</div>
                    
                    <div className="flex gap-2 mb-2 pt-1">
                       <button type="button" onClick={() => setAdminTxType('assignment')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${adminTxType === 'assignment' ? 'bg-green-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>+ Entregar Fondo</button>
                       <button type="button" onClick={() => setAdminTxType('expense')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${adminTxType === 'expense' ? 'bg-red-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>- Anotar Gasto</button>
                    </div>
                    
                    {adminTxType === 'expense' && (
                       <input name="detail" type="text" required placeholder="Detalle del gasto (ej. Peaje, Bencina)" className="w-full border-2 border-white bg-white p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-400 shadow-sm"/>
                    )}
                    
                    <input name="amount" type="number" required placeholder={adminTxType === 'assignment' ? "Monto a asignar $" : "Monto del gasto $"} className="w-full border-2 border-white bg-white p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-400 shadow-sm"/>
                    
                    <input type="hidden" name="jobId" value={selectedJobId} />
                    <div className="mt-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                          Asociar a un Traslado (Opcional)
                       </p>
                       {activeOrPendingJobs.length === 0 ? (
                          <p className="text-xs text-slate-400 font-bold text-center py-2 bg-slate-50 rounded-lg">No hay traslados activos.</p>
                       ) : (
                          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                             <label className={`relative flex items-center p-3 rounded-2xl border-2 cursor-pointer transition-all ${selectedJobId === '' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-blue-200'}`}>
                                <input type="radio" name="jobSelection" className="hidden" checked={selectedJobId === ''} onChange={() => setSelectedJobId('')} />
                                <div className="flex-1">
                                   <span className={`block text-xs font-black ${selectedJobId === '' ? 'text-blue-700' : 'text-slate-500'}`}>Ninguno (Gasto general)</span>
                                </div>
                                <CheckCircle className={`w-5 h-5 transition-transform duration-200 shrink-0 ${selectedJobId === '' ? 'scale-100 text-blue-600' : 'scale-0 text-slate-300'}`} />
                             </label>

                             {activeOrPendingJobs.map(j => (
                                <label key={j.id} className={`relative flex items-center p-3 rounded-2xl border-2 cursor-pointer transition-all shadow-sm ${selectedJobId === j.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-blue-200'}`}>
                                   <input type="radio" name="jobSelection" className="hidden" checked={selectedJobId === j.id} onChange={() => setSelectedJobId(j.id)} />
                                   <div className="flex-1 min-w-0">
                                      <span className={`block text-sm font-black truncate ${selectedJobId === j.id ? 'text-blue-800' : 'text-slate-700'}`}>
                                         {j.brand} {j.model}
                                         <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-md ${selectedJobId === j.id ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
                                            {j.plate || j.vin || 'S/N'}
                                         </span>
                                      </span>
                                      <span className={`block text-[10px] font-bold truncate mt-1 ${selectedJobId === j.id ? 'text-blue-600' : 'text-slate-500'}`}>
                                         🏢 Cliente: {j.client}
                                      </span>
                                      <span className={`block text-[10px] font-bold truncate mt-0.5 ${selectedJobId === j.id ? 'text-blue-600' : 'text-slate-500'}`}>
                                         📍 {j.origin || 'Origen'} ➔ 🏁 {j.destination || 'Destino'}
                                      </span>
                                   </div>
                                   <CheckCircle className={`w-5 h-5 transition-transform duration-200 shrink-0 ml-2 ${selectedJobId === j.id ? 'scale-100 text-blue-600' : 'scale-0 text-slate-300'}`} />
                                </label>
                             ))}
                          </div>
                       )}
                    </div>
                    
                    <button disabled={isSubmitting} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-colors text-white disabled:opacity-50 shadow-md mt-4 ${adminTxType === 'assignment' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>{isSubmitting ? 'Procesando...' : `Confirmar ${adminTxType === 'assignment' ? 'Fondo' : 'Gasto'}`}</button>
                  </form>

                  <div className="flex justify-between items-center mb-3">
                     <h4 className="font-extrabold text-slate-700 flex items-center gap-2 text-sm">
                        <ClipboardList className="w-4 h-4 text-slate-400"/> Historial de Movimientos
                     </h4>
                     <button type="button" onClick={() => resetBalance(d)} disabled={!d.balance || d.balance === 0} className="text-[10px] font-black uppercase bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Volver a $0
                     </button>
                  </div>
                  
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {expenses.filter(e => e.driverId === d.id).length === 0 ? (
                       <p className="text-slate-400 font-bold text-xs text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">Sin movimientos registrados.</p>
                    ) : expenses.filter(e => e.driverId === d.id).map(exp => (
                      <div key={exp.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex gap-3 items-start text-xs font-bold w-full overflow-hidden">
                        <div className="mt-1"><TransactionIcon type={exp.type}/></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 break-words">{exp.detail}</p>
                          <p className="text-[10px] text-slate-400 truncate">{safeDateRender(exp.createdAt)}</p>
                          {exp.receiptImage && <button type="button" onClick={(e) => { e.stopPropagation(); setViewingReceipt(exp.receiptImage); }} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver comprobante</button>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className={`font-extrabold text-sm ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                          {exp.type === 'pending_return' && <button type="button" onClick={(e) => { e.stopPropagation(); approveReturn(exp); }} className="ml-1 text-xs font-bold bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors">Aprobar</button>}
                          {exp.type !== 'pending_return' && (
                            <div className="flex gap-1 border-l border-slate-300 pl-2 ml-1">
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); }} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); delExp(exp); }} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (!myDriver) return <main className="p-8 text-center text-slate-500 font-bold pb-24">No estás registrado como conductor. Pide al admin que te agregue.</main>;
  const myBalance = myDriver.balance || 0;
  const hasPendingReturn = expenses.some(e => e.driverId === myDriver.id && e.type === 'pending_return');

  return (
    <main className="max-w-md mx-auto p-4 pt-20 sm:pt-24 space-y-6 pb-24">
      {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

      {isReturnOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-slate-800">Rendir Vuelto</h3><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button></div>
            <p className="text-sm font-bold text-slate-500 mb-4 border-b border-slate-100 pb-4">Monto total a transferir/rendir: <span className="text-blue-600 text-xl font-extrabold block mt-1">{formatMoney(myBalance)}</span></p>
            
            <div className="flex gap-2 mb-4">
               <button onClick={()=>setReturnMethod('transferencia')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${returnMethod==='transferencia'?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>Transferencia</button>
               <button onClick={()=>setReturnMethod('efectivo')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${returnMethod==='efectivo'?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>Efectivo</button>
            </div>

            {returnMethod === 'transferencia' ? (
              <label className={`block w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors relative overflow-hidden ${returnReceipt ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const dataUrl = await resizeImage(f, 500, 0.4); setReturnReceipt(dataUrl);}catch(e){showAlert("Error procesando foto");}}} />
                {returnReceipt ? (
                   <div className="relative z-10"><CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2 bg-white rounded-full"/><p className="text-sm font-extrabold text-green-700 mb-2">Comprobante Cargado</p><img src={returnReceipt} className="h-28 object-contain mx-auto rounded-lg shadow-sm border border-green-200" alt="preview"/><p className="text-xs font-bold text-slate-500 mt-3 underline">Cambiar foto</p></div>
                ) : (
                   <div className="py-4"><Camera className="w-10 h-10 text-slate-400 mx-auto mb-3"/><p className="text-sm font-extrabold text-slate-600">Sube aquí el comprobante</p></div>
                )}
              </label>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center"><p className="text-sm font-bold text-slate-600">Se registrará que entregaste el dinero en mano.</p></div>
            )}

            <div className="flex gap-4 mt-6"><button onClick={() => { setIsReturnOpen(false); setReturnReceipt(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={submitReturn} disabled={isSubmittingReturn} className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-extrabold transition-all shadow-lg shadow-green-200 disabled:opacity-50">{isSubmittingReturn ? 'Enviando...' : 'Confirmar'}</button></div>
          </div>
        </div>
      )}

      {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}

      <div className={`bg-gradient-to-br ${myBalance < 0 ? 'from-red-600 to-red-800' : 'from-blue-600 to-indigo-700'} p-6 rounded-3xl shadow-md text-center text-white relative overflow-hidden`}>
        <Wallet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
        <p className={`font-bold uppercase tracking-wider text-xs mb-1 ${myBalance < 0 ? 'text-red-200' : 'text-blue-100'}`}>Fondo Asignado Actual</p>
        <p className="text-4xl font-extrabold tracking-tight">{formatMoney(myBalance)}</p>
      </div>

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2 mb-4"><Receipt className="w-5 h-5 text-red-500"/> Registrar Gasto</h3>
        <form onSubmit={e=>addExp(e,'expense',Number(e.target.amount.value), e.target.detail.value, myDriver.id, myDriver.name, myDriver.email)} className="space-y-4">
          <input type="text" name="detail" placeholder="¿En qué gastaste? (Ej. Peaje)" required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-700" />
          <input type="number" name="amount" placeholder="Monto ($)" required className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-700" />
          <button type="submit" disabled={myBalance <= 0 || hasPendingReturn || isSubmitting} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-all ${myBalance > 0 && !hasPendingReturn && !isSubmitting ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{isSubmitting ? 'Procesando...' : 'Guardar Gasto'}</button>
        </form>
      </div>
      
      {hasPendingReturn ? (
        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-3xl text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2"/>
            <p className="font-extrabold text-sm text-amber-700">Rendición en Revisión</p>
            <p className="text-xs font-bold text-amber-600 mt-1">El administrador debe aprobar tu comprobante para actualizar el saldo a $0.</p>
        </div>
      ) : (
        myBalance > 0 && (
          <button onClick={() => setIsReturnOpen(true)} className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-2 border-green-200 py-4 rounded-3xl font-extrabold text-sm flex justify-center items-center gap-2 transition-all">
            <CheckCircle className="w-5 h-5"/> Rendir Vuelto ($0)
          </button>
        )
      )}

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-base font-extrabold text-slate-800 mb-4">Mis Movimientos</h3>
        <div className="space-y-3">
          {expenses.filter(e => e.driverId === myDriver.id).map(exp => (
            <div key={exp.id} className="flex items-start gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="mt-1"><TransactionIcon type={exp.type}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-slate-800 break-words">{exp.detail}</p>
                <p className="text-[10px] font-bold text-slate-400">{safeDateRender(exp.createdAt)}</p>
                {exp.receiptImage && <button onClick={() => setViewingReceipt(exp.receiptImage)} className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md transition-colors w-fit"><Camera className="w-3.5 h-3.5"/> Ver foto</button>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-extrabold ${exp.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{exp.type === 'expense' ? '-' : '+'}{formatMoney(exp.amount)}</span>
                {exp.type !== 'assignment' && exp.type !== 'pending_return' ? (
                  <div className="flex gap-1 border-l border-slate-200 pl-2 ml-1">
                    <button onClick={() => setEditingExpense(exp)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => delExp(exp)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                ) : <div className="pl-2 ml-1"><span className="text-[10px] font-bold text-slate-400 uppercase">{exp.type === 'assignment' ? 'Fondo' : 'Espera'}</span></div>}
              </div>
            </div>
          ))}
          {expenses.filter(e => e.driverId === myDriver.id).length === 0 && <p className="text-slate-400 font-bold text-sm text-center py-4">No has registrado movimientos.</p>}
        </div>
      </div>
    </main>
  );
}

