import React, { useState, useRef } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { 
  Calculator, MapPin, Fuel, DollarSign, Plus, CheckCircle, 
  User, Truck, Receipt, Printer, Send, Save, ArrowRight
} from 'lucide-react';
import { formatMoney } from '../../utils/helpers';

export default function QuotesView({ db, customClients, directoryList, showAlert, showConfirm, currentUserEmail }) {
  // Estados de la Cotización
  const [quoteData, setQuoteData] = useState({
    client: '',
    origin: '',
    destination: '',
    distanceKm: '',
    kmPerLiter: '',
    fuelPrice: 1050, // Precio promedio de la bencina/diésel
    tollsCost: '',
    driverFee: '',
    marginPct: 30, // Margen de ganancia por defecto (30%)
    description: '',
    vehicleType: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // Cálculos Automáticos en Tiempo Real
  const distance = parseFloat(quoteData.distanceKm) || 0;
  const kml = parseFloat(quoteData.kmPerLiter) || 1; // Evitar división por 0
  const fuelPrice = parseFloat(quoteData.fuelPrice) || 0;
  
  const totalLiters = distance / kml;
  const fuelCost = totalLiters * fuelPrice;
  const tolls = parseFloat(quoteData.tollsCost) || 0;
  const driver = parseFloat(quoteData.driverFee) || 0;
  
  const subtotalCosts = fuelCost + tolls + driver;
  const marginMultiplier = 1 + ((parseFloat(quoteData.marginPct) || 0) / 100);
  const finalPrice = subtotalCosts * marginMultiplier;
  const profit = finalPrice - subtotalCosts;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuoteData(prev => ({ ...prev, [name]: value }));
  };

  // Crear Traslado Automáticamente
  const handleApproveQuote = async () => {
    if (!quoteData.client || !quoteData.origin || !quoteData.destination) {
      return showAlert("⚠️ Faltan datos clave (Cliente, Origen o Destino) para crear el traslado.");
    }

    showConfirm(`¿Aprobar cotización por ${formatMoney(finalPrice)} y generar el traslado automáticamente?`, async () => {
      try {
        const matchedOrigin = directoryList.find(d => d.placeName.toLowerCase() === quoteData.origin.toLowerCase());
        const matchedDest = directoryList.find(d => d.placeName.toLowerCase() === quoteData.destination.toLowerCase());

        const newJob = {
          client: quoteData.client,
          origin: quoteData.origin,
          destination: quoteData.destination,
          originContactName: matchedOrigin?.contactName || '',
          originContactPhone: matchedOrigin?.contactPhone || '',
          originAddress: matchedOrigin?.address || '',
          destContactName: matchedDest?.contactName || '',
          destContactPhone: matchedDest?.contactPhone || '',
          destAddress: matchedDest?.address || '',
          description: `(Viene de Cotización) ${quoteData.description}`,
          brand: quoteData.vehicleType || 'Por definir',
          plate: 'S/N',
          tripType: 'traslado',
          status: 'pending', // Se va directo a la central de trabajos disponibles
          createdAt: Date.now(),
          scheduledDate: new Date().toISOString().split('T')[0],
          quotedPrice: Math.round(finalPrice), // Guardamos el valor cobrado
          requestedBy: currentUserEmail
        };

        await addDoc(collection(db, 'transport_jobs'), newJob);
        showAlert("✅ ¡Cotización aprobada! El traslado se ha enviado a la lista de trabajos pendientes.");
        
        // Limpiar formulario
        setQuoteData({
          client: '', origin: '', destination: '', distanceKm: '', kmPerLiter: '', 
          fuelPrice: 1050, tollsCost: '', driverFee: '', marginPct: 30, description: '', vehicleType: ''
        });
      } catch (error) {
        console.error("Error al crear traslado de cotización:", error);
        showAlert("❌ Hubo un error al generar el traslado.");
      }
    });
  };

  // Generador de PDF Elegante (Impresión HTML nativa)
  const handleGeneratePDF = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cotización Logística - ${quoteData.client || 'Cliente'}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { max-height: 80px; }
            .title { text-align: right; }
            .title h1 { margin: 0; color: #1e293b; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; }
            .title p { margin: 5px 0 0 0; color: #64748b; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-item h4 { margin: 0 0 5px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
            .info-item p { margin: 0; font-size: 16px; font-weight: bold; color: #0f172a; }
            table { w-full; width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #2563eb; color: white; text-align: left; padding: 12px; font-size: 14px; text-transform: uppercase; }
            td { padding: 15px 12px; border-bottom: 1px solid #e2e8f0; font-size: 15px; }
            .totals { width: 350px; margin-left: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
            .totals-row { display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; }
            .totals-row.final { background: #2563eb; color: white; font-weight: bold; font-size: 18px; border: none; }
            .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}/LogoLogistica.png" class="logo" alt="LogisticAPP Logo" onerror="this.style.display='none'" />
            <div class="title">
              <h1>Cotización de Traslado</h1>
              <p>Fecha: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div class="info-box">
            <div class="info-grid">
              <div class="info-item"><h4>Cliente Empresa</h4><p>${quoteData.client || 'A Quien Corresponda'}</p></div>
              <div class="info-item"><h4>Tipo de Vehículo</h4><p>${quoteData.vehicleType || 'No especificado'}</p></div>
              <div class="info-item"><h4>Origen</h4><p>${quoteData.origin || 'No especificado'}</p></div>
              <div class="info-item"><h4>Destino</h4><p>${quoteData.destination || 'No especificado'}</p></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción del Servicio</th>
                <th style="text-align: right;">Distancia</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${quoteData.description || 'Servicio de traslado logístico de vehículo'}</td>
                <td style="text-align: right;">${quoteData.distanceKm ? quoteData.distanceKm + ' KM' : 'N/A'}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal Neto</span>
              <span>${formatMoney(finalPrice)}</span>
            </div>
            <div class="totals-row final">
              <span>Total a Cobrar</span>
              <span>${formatMoney(finalPrice)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Esta cotización es válida por 15 días hábiles desde su emisión.</p>
            <p>Generado automáticamente por LogisticAPP - Plataforma de Gestión de Flotas</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    // Le damos un pequeño respiro para que cargue el logo antes de imprimir
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Cabecera */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
        <Calculator className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 transform rotate-12" />
        <h2 className="text-2xl font-black mb-1 relative z-10">Cotizador Inteligente</h2>
        <p className="text-purple-200 text-sm font-bold relative z-10">Calcula costos de ruta, peajes, bencina y genera PDFs al instante.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Tarjeta 1: Datos del Traslado */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3"><MapPin className="w-4 h-4 text-purple-600"/> Datos de Ruta</h3>
            
            <datalist id="quotes-directory-list">
               {directoryList.map((d, i) => <option key={i} value={d.placeName} />)}
            </datalist>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa Cliente</label>
                 <select name="client" value={quoteData.client} onChange={handleInputChange} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500 bg-slate-50">
                    <option value="">Selecciona un cliente...</option>
                    {customClients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                 </select>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen</label>
                 <input type="text" name="origin" list="quotes-directory-list" value={quoteData.origin} onChange={handleInputChange} placeholder="Desde dónde..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destino</label>
                 <input type="text" name="destination" list="quotes-directory-list" value={quoteData.destination} onChange={handleInputChange} placeholder="Hasta dónde..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Distancia Total (KM)</label>
                 <div className="relative">
                   <input type="number" name="distanceKm" value={quoteData.distanceKm} onChange={handleInputChange} placeholder="Ej: 120" className="w-full border-2 border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
                   <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Vehículo</label>
                 <div className="relative">
                   <input type="text" name="vehicleType" value={quoteData.vehicleType} onChange={handleInputChange} placeholder="Ej: Camioneta, Auto..." className="w-full border-2 border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
                   <Truck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                 </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción del Servicio (Para el PDF)</label>
                 <input type="text" name="description" value={quoteData.description} onChange={handleInputChange} placeholder="Detalles de la cotización..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Gastos Operativos y Calculadora */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3"><DollarSign className="w-4 h-4 text-emerald-600"/> Estructura de Costos</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Rendimiento (KM/L)</label>
                 <div className="relative">
                   <input type="number" step="0.1" name="kmPerLiter" value={quoteData.kmPerLiter} onChange={handleInputChange} placeholder="Ej: 10.5" className="w-full border-2 border-emerald-200 bg-emerald-50 rounded-xl p-3 pl-10 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500"/>
                   <Fuel className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3.5" />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio Combustible ($/L)</label>
                 <input type="number" name="fuelPrice" value={quoteData.fuelPrice} onChange={handleInputChange} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Costo Peajes ($)</label>
                 <input type="number" name="tollsCost" value={quoteData.tollsCost} onChange={handleInputChange} placeholder="Total peajes..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-purple-500"/>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Pago Conductor ($)</label>
                 <div className="relative">
                   <input type="number" name="driverFee" value={quoteData.driverFee} onChange={handleInputChange} placeholder="Honorarios..." className="w-full border-2 border-blue-200 bg-blue-50 rounded-xl p-3 pl-10 text-sm font-bold text-blue-800 outline-none focus:border-blue-500"/>
                   <User className="w-4 h-4 text-blue-500 absolute left-3.5 top-3.5" />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Margen Empresa (%)</label>
                 <div className="relative">
                   <input type="number" name="marginPct" value={quoteData.marginPct} onChange={handleInputChange} className="w-full border-2 border-purple-200 bg-purple-50 rounded-xl p-3 text-sm font-black text-purple-800 outline-none focus:border-purple-500"/>
                 </div>
              </div>
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: RESULTADOS Y ACCIONES */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Panel de Resultados */}
          <div className="bg-slate-800 rounded-3xl p-5 shadow-xl border border-slate-700 text-white">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Receipt className="w-4 h-4"/> Resumen Financiero</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                <span className="text-xs font-bold text-slate-300">Litros Estimados:</span>
                <span className="text-sm font-black text-white">{totalLiters > 0 ? totalLiters.toFixed(1) : 0} L</span>
              </div>
              <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                <span className="text-xs font-bold text-slate-300">Gasto Combustible:</span>
                <span className="text-sm font-black text-red-400">{formatMoney(fuelCost)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                <span className="text-xs font-bold text-slate-300">Costo Operativo (Total):</span>
                <span className="text-sm font-black text-amber-400">{formatMoney(subtotalCosts)}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-900/40 p-3 rounded-xl border border-emerald-700">
                <span className="text-xs font-bold text-emerald-400">Ganancia Empresa:</span>
                <span className="text-sm font-black text-emerald-400">{formatMoney(profit)}</span>
              </div>
            </div>

            <div className="bg-purple-600 rounded-2xl p-4 text-center border border-purple-500 shadow-inner">
              <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest mb-1">Precio Sugerido al Cliente</p>
              <p className="text-3xl font-black text-white">{formatMoney(finalPrice)}</p>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={handleGeneratePDF}
              className="w-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-black py-4 rounded-2xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              <Printer className="w-5 h-5 text-slate-500" /> Exportar Cotización (PDF)
            </button>
            
            <button 
              onClick={handleApproveQuote}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle className="w-5 h-5" /> Aprobar y Crear Traslado
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}