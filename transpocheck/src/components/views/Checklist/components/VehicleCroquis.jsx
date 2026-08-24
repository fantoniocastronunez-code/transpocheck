import React from 'react';
import { Search, X, Camera, CheckCircle } from 'lucide-react';
import { useChecklist } from '../ChecklistContext';

export const VehicleCroquis = ({ handlePhotoClick }) => {
  const { formData, setF, showAlert } = useChecklist();

  return (
    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl border-2 border-slate-100 dark:border-slate-800 mb-4 select-none relative shadow-sm">
      <div className="flex justify-between items-center mb-4 min-h-[40px]">
        {!formData.zoomZone ? (
          <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed w-full text-center">
            Toca los recuadros para fotos generales.<br />
            <span className="text-blue-500 text-xs">Toca un cuadrante del auto para acercar y marcar.</span>
          </p>
        ) : (
          <div className="w-full flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/50 animate-in fade-in shadow-inner">
            <p className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase animate-pulse flex items-center gap-1.5"><Search className="w-4 h-4" /> Toca el daño exacto</p>
            <button type="button" onClick={() => setF('zoomZone', null)} className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"><X className="w-3 h-3" /> Volver</button>
          </div>
        )}
      </div>
      <div className="relative w-full max-w-[200px] sm:max-w-[240px] h-[400px] mx-auto my-12">
        <div
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 cursor-crosshair transition-all duration-300 ease-out drop-shadow-xl ${!formData.zoomZone ? 'scale-100 z-10 hover:opacity-90' :
            formData.zoomZone === 'tl' ? 'scale-[1.8] origin-top-left z-50' :
              formData.zoomZone === 'tr' ? 'scale-[1.8] origin-top-right z-50' :
                formData.zoomZone === 'ml' ? 'scale-[1.8] origin-left z-50' :
                  formData.zoomZone === 'mr' ? 'scale-[1.8] origin-right z-50' :
                     formData.zoomZone === 'bl' ? 'scale-[1.8] origin-bottom-left z-50' :
                      'scale-[1.8] origin-bottom-right z-50'
            }`}
          style={{ height: formData.vehicleType?.includes('camion') || formData.vehicleType === 'furgon_grande' || formData.vehicleType === 'carro_arrastre' ? '260px' : '220px' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            if (!formData.zoomZone) {
              let zone = y < 33 ? 't' : y < 66 ? 'm' : 'b';
              zone += x < 50 ? 'l' : 'r';
              setF('zoomZone', zone);
              return;
            }

            const availableDet = ['det1', 'det2', 'det3', 'det4', 'det5', 'det6', 'det7', 'det8'].find(d => !formData.photos[d]);
            if (!availableDet) return showAlert("Máximo de 8 fotos de detalles/daños alcanzado.");

            setF('pendingPin', { id: availableDet, x, y });
            setF('zoomZone', null);
            handlePhotoClick(availableDet, 'Detalle del Daño', true); // enableAnnotation = true
          }}
        >
          {!formData.zoomZone && (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 pointer-events-none z-40 opacity-40 mix-blend-multiply">
              <div className="border-r-2 border-b-2 border-dashed border-blue-500 rounded-tl-[40px]"></div>
              <div className="border-b-2 border-dashed border-blue-500 rounded-tr-[40px]"></div>
              <div className="border-r-2 border-b-2 border-dashed border-blue-500"></div>
              <div className="border-b-2 border-dashed border-blue-500"></div>
              <div className="border-r-2 border-dashed border-blue-500 rounded-bl-[40px]"></div>
              <div className="border-dashed border-blue-500 rounded-br-[40px]"></div>
            </div>
          )}

          {(!formData.vehicleType || formData.vehicleType === 'auto') && (
            <div className="w-full h-full relative flex justify-center">
              <div className="absolute top-[15%] left-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>
              <div className="absolute top-[15%] right-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>
              <div className="absolute bottom-[12%] left-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>
              <div className="absolute bottom-[12%] right-[2%] w-3.5 h-10 bg-slate-800 rounded-sm shadow-md z-0"></div>
              <div className="absolute top-[34%] left-[4%] w-2 h-4 bg-slate-400 rounded-l-md shadow-sm z-20"></div>
              <div className="absolute top-[34%] right-[4%] w-2 h-4 bg-slate-400 rounded-r-md shadow-sm z-20"></div>
              <div className="w-[88%] h-full bg-slate-300 dark:bg-slate-600 rounded-t-[45px] rounded-b-[35px] border-4 border-slate-400 relative flex flex-col p-1 shadow-inner z-10 overflow-hidden">
                <div className="absolute top-[-2%] left-[15%] w-[70%] h-[20%] border-x-2 border-slate-400/40 rounded-t-[30px] pointer-events-none"></div>
                <div className="flex flex-col h-full justify-between pt-[18%] pb-[12%] z-10">
                  <div className="w-[85%] h-[16%] bg-slate-800/40 mx-auto rounded-t-[25px] rounded-b-[4px] shadow-sm border-t-2 border-white dark:border-slate-800/20"></div>
                  <div className="flex-1 w-[80%] mx-auto bg-slate-200 dark:bg-slate-700 border-x-4 border-slate-800/40 relative flex flex-col my-1 shadow-sm rounded-sm">
                    <div className="w-full h-1/2 border-b-2 border-slate-400/30"></div>
                  </div>
                  <div className="w-[80%] h-[11%] bg-slate-800/40 mx-auto rounded-b-[20px] rounded-t-[4px] shadow-sm border-b-2 border-white dark:border-slate-800/20"></div>
                </div>
                <div className="absolute bottom-1.5 left-[20%] w-[60%] h-4 border-t-2 border-slate-400/60 rounded-t-lg pointer-events-none"></div>
              </div>
            </div>
          )}

          {formData.vehicleType === 'furgon_pequeno' && (
            <div className="w-full h-full relative flex flex-col items-center z-10">
              <div className="w-[80%] h-[18%] bg-slate-300 dark:bg-slate-600 rounded-t-[35px] border-x-4 border-t-4 border-slate-400 shadow-inner z-0"></div>
              <div className="w-[100%] h-[82%] bg-slate-200 dark:bg-slate-700 rounded-t-[15px] rounded-b-[20px] border-4 border-slate-400 shadow-inner flex flex-col p-1.5 z-10 -mt-2">
                <div className="w-[90%] h-[20%] bg-slate-800/40 mx-auto rounded-t-[15px] rounded-b-sm mb-1.5 shadow-sm"></div>
                <div className="flex-1 w-[95%] mx-auto bg-slate-300 dark:bg-slate-600 border-2 border-slate-400/30 rounded-md relative flex justify-center overflow-hidden">
                  <div className="absolute top-1/4 w-full border-t-2 border-slate-400/20"></div>
                  <div className="absolute top-2/4 w-full border-t-2 border-slate-400/20"></div>
                  <div className="absolute top-3/4 w-full border-t-2 border-slate-400/20"></div>
                </div>
              </div>
            </div>
          )}

          {formData.vehicleType === 'furgon_grande' && (
            <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-t-[35px] rounded-b-[10px] border-4 border-slate-400 relative flex flex-col justify-start p-2 shadow-inner z-10">
              <div className="w-[85%] h-[15%] bg-slate-800/40 mx-auto rounded-t-[20px] rounded-b-sm mt-1"></div>
              <div className="flex-1 w-[90%] mx-auto bg-slate-300 dark:bg-slate-600 border-2 border-slate-400/30 rounded-sm mt-3 mb-1 flex items-center justify-center relative overflow-hidden shadow-sm">
                <div className="absolute top-1/4 w-full border-t border-slate-400/20"></div>
                <div className="absolute top-2/4 w-full border-t border-slate-400/20"></div>
                <div className="absolute top-3/4 w-full border-t border-slate-400/20"></div>
              </div>
            </div>
          )}

          {formData.vehicleType === 'camioneta' && (
            <div className="w-full h-full relative flex flex-col">
              <div className="w-full h-[55%] bg-slate-300 dark:bg-slate-600 rounded-t-[35px] rounded-b-md border-4 border-slate-400 p-2 flex flex-col justify-between shadow-inner relative overflow-hidden">
                <div className="w-5/6 h-8 bg-slate-800/30 mx-auto rounded-t-xl rounded-b-sm mt-1 z-10"></div>
                <div className="flex-1 w-full mx-auto relative flex flex-col justify-center my-1">
                  <div className="w-full border-t-2 border-slate-400/40"></div>
                </div>
                <div className="w-5/6 h-4 bg-slate-800/30 mx-auto rounded-b-xl rounded-t-sm mb-0.5 z-10"></div>
              </div>
              <div className="w-[90%] h-[43%] mx-auto bg-slate-200 dark:bg-slate-700 border-x-4 border-b-4 border-slate-400 rounded-b-xl mt-1 relative shadow-inner">
                <div className="absolute inset-1.5 border-2 border-slate-300 dark:border-slate-600/80 rounded-sm"></div>
                <div className="absolute inset-y-2 left-1/3 border-l-2 border-slate-300 dark:border-slate-600/50"></div>
                <div className="absolute inset-y-2 right-1/3 border-r-2 border-slate-300 dark:border-slate-600/50"></div>
              </div>
            </div>
          )}

          {formData.vehicleType === 'camion' && (
            <div className="w-full h-full relative flex flex-col">
              <div className="w-[105%] -ml-[2.5%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 dark:border-blue-700/50 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                <div className="w-full h-1/2 bg-slate-800/40 rounded-t-md rounded-b-sm mb-1"></div>
              </div>
              <div className="w-full h-[78%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
              </div>
            </div>
          )}

          {formData.vehicleType === 'camion_doble' && (
            <div className="w-full h-full relative flex flex-col">
              <div className="w-[105%] -ml-[2.5%] h-[32%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-300 dark:border-blue-700/50 p-1 flex flex-col justify-end gap-1 shadow-inner z-10 relative">
                <div className="w-full h-[40%] bg-slate-800/40 rounded-t-md"></div>
                <div className="w-full h-[35%] bg-slate-800/40 rounded-sm mb-0.5"></div>
              </div>
              <div className="w-full h-[66%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
              </div>
            </div>
          )}

          {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes' || formData.vehicleType === 'camion_8x4' || formData.vehicleType === 'carro_arrastre') && (
            <div className="w-full h-full relative flex flex-col items-center">
              {formData.vehicleType === 'camion_8x4' && (
                <>
                  <div className="absolute top-[10%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute top-[10%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute top-[22%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute top-[22%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute bottom-[20%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute bottom-[20%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute bottom-[7%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute bottom-[7%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>

                  <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                    <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                  </div>
                  <div className="w-full h-[78%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                  </div>
                </>
              )}
              {formData.vehicleType === 'carro_arrastre' && (
                <div className="w-full h-full relative overflow-hidden flex justify-center items-center">
                  <div className="w-[90%] h-[80%] bg-slate-300 dark:bg-slate-600 rounded-md border-4 border-slate-400 relative overflow-hidden shadow-inner flex justify-center items-center z-10 mt-6">
                    <div className="w-[90%] h-[90%] border-2 border-slate-300 dark:border-slate-600/50 rounded-sm"></div>
                  </div>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-10 border-x-4 border-t-4 border-slate-500 rounded-t-full bg-slate-400 z-0"></div>
                  <div className="absolute top-[48%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                    <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                    <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                  </div>
                  <div className="absolute top-[56%] left-1/2 -translate-x-1/2 w-[105%] -ml-[2.5%] h-2 bg-slate-800/80 rounded-sm flex justify-between z-0">
                    <div className="w-4 h-8 rounded-sm bg-slate-800 -ml-1 -mt-3 shadow-md"></div>
                    <div className="w-4 h-8 rounded-sm bg-slate-800 -mr-1 -mt-3 shadow-md"></div>
                  </div>
                </div>
              )}
              {(formData.vehicleType === 'camion_2ejes' || formData.vehicleType === 'camion_3ejes') && (
                <>
                  <div className="absolute top-[8%] -left-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                  <div className="absolute top-[8%] -right-3 w-3.5 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                  {formData.vehicleType === 'camion_2ejes' && (
                    <>
                      <div className="absolute bottom-[17%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[17%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[5%] -left-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[5%] -right-3 w-4 h-11 bg-slate-800 rounded-sm shadow-md"></div>
                    </>
                  )}
                  {formData.vehicleType === 'camion_3ejes' && (
                    <>
                      <div className="absolute bottom-[27%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[27%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[16%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[16%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[5%] -left-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                      <div className="absolute bottom-[5%] -right-3 w-4 h-10 bg-slate-800 rounded-sm shadow-md"></div>
                    </>
                  )}
                  <div className="w-[105%] h-[20%] bg-blue-200 rounded-t-xl rounded-b-sm border-4 border-blue-400 p-1 flex flex-col justify-end shadow-inner z-10 relative">
                    <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
                  </div>
                  <div className="w-full h-[78%] mx-auto bg-slate-200 dark:bg-slate-700 border-4 border-slate-400 rounded-sm mt-2 relative overflow-hidden shadow-inner z-10">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_15px,#cbd5e1_15px,#cbd5e1_18px)] opacity-60"></div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Pines de daño */}
          {(formData.detailPins || []).map(pin => (
            <div key={pin.id} onClick={() => handlePhotoClick(pin.id, 'Detalle del Daño')} className="absolute w-10 h-10 -ml-5 -mt-5 bg-red-500 rounded-full border-[3px] border-white dark:border-slate-800 shadow-xl flex items-center justify-center z-50 animate-in zoom-in cursor-pointer hover:scale-110 transition-transform" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
              <img src={formData.photos[pin.id]} className="w-full h-full object-cover rounded-full opacity-90" alt="Detalle" />
              <button type="button" onClick={(e) => { e.stopPropagation(); setF('photos', { ...formData.photos, [pin.id]: false }); setF('detailPins', formData.detailPins.filter(p => p.id !== pin.id)); }} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-700 shadow-md transition-colors"><X className="w-3 h-3" /></button>
            </div>
          ))}

          {/* Botón FRENTE (Arriba al centro) */}
          <button type="button" onClick={() => handlePhotoClick('front', 'FRENTE')} 
            className={`absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex flex-col items-center justify-center cursor-pointer shadow-lg overflow-hidden bg-white dark:bg-slate-900 transition-all z-20 hover:scale-105 active:scale-95 ${formData.photos.front ? 'border-green-400 ring-4 ring-green-100/50' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {formData.photos.front ? (
              <><img src={formData.photos.front} className="absolute inset-0 w-full h-full object-cover opacity-70" /><CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 relative z-10 bg-white/80 dark:bg-slate-900/80 rounded-full drop-shadow-md" /></>
            ) : (
              <><Camera className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mb-0.5" /><span className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-400 tracking-wider">FRENTE</span></>
            )}
          </button>

          {/* Botón ATRÁS (Abajo al centro) */}
          <button type="button" onClick={() => handlePhotoClick('back', 'ATRÁS')} 
            className={`absolute -bottom-12 sm:-bottom-16 left-1/2 -translate-x-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex flex-col items-center justify-center cursor-pointer shadow-lg overflow-hidden bg-white dark:bg-slate-900 transition-all z-20 hover:scale-105 active:scale-95 ${formData.photos.back ? 'border-green-400 ring-4 ring-green-100/50' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {formData.photos.back ? (
              <><img src={formData.photos.back} className="absolute inset-0 w-full h-full object-cover opacity-70" /><CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 relative z-10 bg-white/80 dark:bg-slate-900/80 rounded-full drop-shadow-md" /></>
            ) : (
              <><Camera className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mb-0.5" /><span className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-400 tracking-wider">ATRÁS</span></>
            )}
          </button>

          {/* Botón LATERAL PILOTO (Izquierda) */}
          <button type="button" onClick={() => handlePhotoClick('left', 'LATERAL PILOTO')} 
            className={`absolute top-1/2 -left-10 sm:-left-16 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex flex-col items-center justify-center cursor-pointer shadow-lg overflow-hidden bg-white dark:bg-slate-900 transition-all z-20 hover:scale-105 active:scale-95 ${formData.photos.left ? 'border-green-400 ring-4 ring-green-100/50' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {formData.photos.left ? (
              <><img src={formData.photos.left} className="absolute inset-0 w-full h-full object-cover opacity-70" /><CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 relative z-10 bg-white/80 dark:bg-slate-900/80 rounded-full drop-shadow-md" /></>
            ) : (
              <><Camera className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mb-0.5" /><span className="text-[7px] sm:text-[8px] font-black text-slate-500 dark:text-slate-400 tracking-wider text-center leading-tight">LAT.<br/>PILOTO</span></>
            )}
          </button>

          {/* Botón LATERAL COPILOTO (Derecha) */}
          <button type="button" onClick={() => handlePhotoClick('right', 'LATERAL COPILOTO')} 
            className={`absolute top-1/2 -right-10 sm:-right-16 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex flex-col items-center justify-center cursor-pointer shadow-lg overflow-hidden bg-white dark:bg-slate-900 transition-all z-20 hover:scale-105 active:scale-95 ${formData.photos.right ? 'border-green-400 ring-4 ring-green-100/50' : 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {formData.photos.right ? (
              <><img src={formData.photos.right} className="absolute inset-0 w-full h-full object-cover opacity-70" /><CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 relative z-10 bg-white/80 dark:bg-slate-900/80 rounded-full drop-shadow-md" /></>
            ) : (
              <><Camera className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mb-0.5" /><span className="text-[7px] sm:text-[8px] font-black text-slate-500 dark:text-slate-400 tracking-wider text-center leading-tight">LAT.<br/>COPILOTO</span></>
            )}
          </button>

        </div>
      </div>
    </div>
  );
};
