const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList/HistoryModal.jsx', 'utf8');

const targetStr = `                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-white text-[9px] font-black uppercase truncate">{photoLabels[k] || k.replace('det', 'Detalle ')}</p>
                      </div>
                    </div>`;

const replaceStr = `                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-white text-[9px] font-black uppercase truncate">{photoLabels[k] || k.replace('det', 'Detalle ')}</p>
                      </div>
                      {k === 'fuelGauge' && selectedHistoryJob.checklist?.photos?.fuelGaugeLocation && (
                        <a href={\`https://maps.google.com/?q=\${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lat},\${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lng}\`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-md transition-colors">📍 Mapa</a>
                      )}
                    </div>`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/views/JobsList/HistoryModal.jsx', code, 'utf8');
console.log("Patched HistoryModal");
