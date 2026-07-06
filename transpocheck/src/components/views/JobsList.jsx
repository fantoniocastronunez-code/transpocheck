                 ))}
              </div>
           </div>
        </div>
      )}

      {/* NUEVO: MODAL INTELIGENTE DE CONTINUIDAD (DUPLICAR) */}
      {dupPromptJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 border-t-8 border-purple-500">
              <div className="flex justify-between items-start mb-4">
                 <div>
                   <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Repeat className="w-5 h-5 text-purple-600"/> Nuevo Traslado</h3>
                   <p className="text-xs font-bold text-slate-500 mt-1">
                      {dupPromptJob.tripType === 'simple' ? dupPromptJob.description : `${dupPromptJob.brand} ${dupPromptJob.model}`} • {dupPromptJob.plate || dupPromptJob.vin || 'S/N'}
                   </p>
                 </div>
                 <button onClick={()=>setDupPromptJob(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X className="w-5 h-5"/></button>
              </div>

              <div className="overflow-y-auto space-y-5 pr-1 pb-4">
                 
                 {/* OPCIONES DE RUTA */}
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">¿Qué tipo de ruta hará ahora?</label>
                    
                    <button onClick={() => setDupMode('clone')} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${dupMode === 'clone' ? 'border-purple-600 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-purple-200'}`}>
                       <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dupMode === 'clone' ? 'border-purple-600' : 'border-slate-300'}`}>
                          {dupMode === 'clone' && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                       </div>
                       <div>
                          <p className={`font-extrabold text-sm ${dupMode === 'clone' ? 'text-purple-800' : 'text-slate-700'}`}>Clonar Exactamente Igual</p>
                          <p className="text-[10px] font-bold text-slate-500">{dupPromptJob.origin} ➔ {dupPromptJob.destination || 'Mismo destino'}</p>
                       </div>
                    </button>

                    <button onClick={() => setDupMode('return')} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${dupMode === 'return' ? 'border-purple-600 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-purple-200'}`}>
                       <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dupMode === 'return' ? 'border-purple-600' : 'border-slate-300'}`}>
                          {dupMode === 'return' && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                       </div>
                       <div>
                          <p className={`font-extrabold text-sm ${dupMode === 'return' ? 'text-purple-800' : 'text-slate-700'}`}>Retornar al Origen</p>
                          <p className="text-[10px] font-bold text-slate-500">{dupPromptJob.tripType === 'revision' ? 'PRT' : (dupPromptJob.destination || dupPromptJob.origin)} ➔ {dupPromptJob.origin}</p>
                       </div>
                    </button>

                    <button onClick={() => { setDupMode('continue'); setDupDestination(''); }} className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${dupMode === 'continue' ? 'border-purple-600 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-purple-200'}`}>
                       <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dupMode === 'continue' ? 'border-purple-600' : 'border-slate-300'}`}>
                          {dupMode === 'continue' && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                       </div>
                       <div className="w-full">
                          <p className={`font-extrabold text-sm ${dupMode === 'continue' ? 'text-purple-800' : 'text-slate-700'}`}>Continuar a Otro Destino</p>
                          {dupMode === 'continue' ? (
                             <div className="mt-2 animate-in fade-in slide-in-from-top-1 w-full">
                                <input type="text" autoFocus placeholder="Escribe el nuevo destino..." value={dupDestination} onChange={e=>setDupDestination(e.target.value)} className="w-full bg-white border border-purple-200 p-2.5 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-400 font-bold" />
                             </div>
                          ) : (
                             <p className="text-[10px] font-bold text-slate-500">{dupPromptJob.tripType === 'revision' ? 'PRT' : (dupPromptJob.destination || dupPromptJob.origin)} ➔ ???</p>
                          )}
                       </div>
                    </button>
                 </div>

                 {/* ASIGNACIÓN DE CONDUCTOR */}
                 <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Asignar a Conductor</label>
                    <select value={dupDriverEmail} onChange={e=>setDupDriverEmail(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-purple-500 font-bold text-slate-700 bg-slate-50">
                       <option value="">Nadie aún (Enviar a Bolsa de Trabajo)</option>
                       {drivers.map(d => (
                          <option key={d.id} value={d.email}>{d.name}</option>
                       ))}
                    </select>
                 </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 mt-auto">
                 <button onClick={()=>setDupPromptJob(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-extrabold text-sm transition-colors">Cancelar</button>
                 <button onClick={executeDuplicate} disabled={processingId === `dup-${dupPromptJob.id}`} className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-xl font-extrabold text-sm transition-colors shadow-lg shadow-purple-200 flex justify-center items-center gap-2 disabled:opacity-50">
                    {processingId === `dup-${dupPromptJob.id}` ? <Clock className="w-5 h-5 animate-spin"/> : 'Crear Traslado'}
                 </button>
              </div>
           </div>
        </div>
      )}

      </div>
  );
}
