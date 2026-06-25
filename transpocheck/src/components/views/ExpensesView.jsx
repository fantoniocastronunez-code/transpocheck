import React, { useState } from 'react';
import { updateDoc, doc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { 
  Wallet, ArrowUpCircle, ArrowDownCircle, CheckCircle, 
  Clock, X, Edit2, Trash2, Camera, Receipt, ClipboardList 
} from 'lucide-react';
import { formatMoney, resizeImage } from '../../utils/helpers';

export default function ExpensesView({ role, drivers, jobs, expenses, db, currentUserEmail, showAlert, showConfirm }) {
  const isAdminView = role === 'admin';
  const myDriver = drivers.find(d => d.email === currentUserEmail);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState(null);
  const [returnMethod, setReturnMethod] = useState('transferencia');
  const [editingExpense, setEditingExpense] = useState(null);
  const [adminTxType, setAdminTxType] = useState('assignment'); 

  const activeOrPendingJobs = jobs?.filter(j => j.status === 'pending' || j.status === 'accepted') || [];
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await updateDoc(doc(db, 'drivers', driverId), { balance: newBalance });
      await addDoc(collection(db, 'expenses'), { driverId, driverEmail: dEmail, driverName: dName, type, amount, detail: detailString, jobId: assocJobId, deductedAmount, createdAt: Date.now() });
      e.target.reset(); 
      showAlert(type === 'assignment' ? "Fondo asignado correctamente." : "Gasto registrado exitosamente.");
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const submitReturn = async () => {
    if (returnMethod === 'transferencia' && !returnReceipt) return showAlert("Sube la foto de la transferencia.");
    if (!myDriver?.balance) return;
    if (isSubmittingReturn) return;
    setIsSubmittingReturn(true);
    
    let det = returnMethod === 'efectivo' ? 'Rendición en Efectivo (En revisión)' : 'Rendición de Vuelto (En revisión)';
    
    try {
      await addDoc(collection(db, 'expenses'), { driverId: myDriver.id, driverEmail: myDriver.email, driverName: myDriver.name, type: 'pending_return', amount: myDriver.balance, detail: det, receiptImage: returnReceipt, createdAt: Date.now() });
      setIsReturnOpen(false); setReturnReceipt(null); showAlert("Rendición enviada. Esperando validación de Admin.");
    } catch(e) {}
    finally { setIsSubmittingReturn(false); }
  };

  const approveReturn = async (exp) => {
    try {
      const d = drivers.find(x => x.id === exp.driverId);
      if (d) await updateDoc(doc(db, 'drivers', d.id), { balance: Math.max(0, (d.balance||0) - exp.amount) });
      await updateDoc(doc(db, 'expenses', exp.id), { type: 'return', detail: 'Rendición Aprobada' });
      showAlert("Rendición aprobada. El balance del conductor volvió a 0.");
    } catch(e){}
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
      } catch(e){}
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
        
        if (driverSnapshot) {
          let currentDriverBalance = driverSnapshot.balance || 0;
          
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

  if (isAdminView) {
    return (
      <main className="max-w-3xl mx-auto p-4 pt-20 sm:pt-24 pb-24">
        {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}
        {viewingReceipt && <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-3xl p-4 w-full max-w-md relative"><button onClick={() => setViewingReceipt(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-700"/></button><h3 className="font-extrabold text-slate-800 mb-4 ml-2">Comprobante</h3><img src={viewingReceipt} alt="Comprobante" className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" /></div></div>}

       <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2"><Wallet className="text-blue-600"/> Control Viáticos</h2>
        
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest ml-2 mb-4">Directorio de Conductores</h3>
          {drivers.map(d => (
            <div key={d.id} className={`bg-white p-4 sm:p-5 rounded-3xl border transition-all ${selectedDriverId === d.id ? 'border-blue-500 shadow-md ring-4 ring-blue-50' : 'border-slate-200 shadow-sm hover:border-blue-300'}`}>
              
              <div className="flex justify-between items-center cursor-pointer" onClick={() => {setSelectedDriverId(d.id === selectedDriverId ? null : d.id); setAdminTxType('assignment');}}>
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
                    
                    <select name="jobId" className="w-full border-2 border-white bg-white p-3 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-400 shadow-sm">
                       <option value="">{adminTxType === 'assignment' ? "Asociar a un Trabajo (Opcional)" : "Trabajo activo (Opcional, permite saldo negativo)"}</option>
                       {activeOrPendingJobs.map(j => <option key={j.id} value={j.id}>{j.client} - {j.brand} ({j.plate || j.vin || 'S/N'})</option>)}
                    </select>
                    
                    <button disabled={isSubmitting} className={`w-full py-3 rounded-xl font-extrabold text-sm transition-colors text-white disabled:opacity-50 shadow-md mt-2 ${adminTxType === 'assignment' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>{isSubmitting ? 'Procesando...' : `Confirmar ${adminTxType === 'assignment' ? 'Fondo' : 'Gasto'}`}</button>
                  </form>

                  <h4 className="font-extrabold text-slate-700 mb-3 flex items-center gap-2 text-sm"><ClipboardList className="w-4 h-4 text-slate-400"/> Historial de Movimientos</h4>
                  
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