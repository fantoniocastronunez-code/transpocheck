const fs = require('fs');
let code = fs.readFileSync('src/components/views/JobsList/HistoryModal.jsx', 'utf8');

const target = "</div>\\n                    </div>";
const replacement = "</div>\\n                      {k === 'fuelGauge' && selectedHistoryJob.checklist?.photos?.fuelGaugeLocation && (\\n                        <a href={`https://maps.google.com/?q=${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lat},${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lng}`} target=\"_blank\" rel=\"noopener noreferrer\" onClick={(e) => e.stopPropagation()} className=\"absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-md transition-colors\">📍 Mapa</a>\\n                      )}\\n                    </div>";

// Fix \r\n vs \n issues by doing replace all
code = code.replace(/<\/div>[\r\n\s]+<\/div>[\r\n\s]+\);[\r\n\s]+}\)}[\r\n\s]+<\/div>[\r\n\s]+<\/div>[\r\n\s]+)}/, (match) => {
    return `</div>
                      {k === 'fuelGauge' && selectedHistoryJob.checklist?.photos?.fuelGaugeLocation && (
                        <a href={\`https://maps.google.com/?q=\${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lat},\${selectedHistoryJob.checklist.photos.fuelGaugeLocation.lng}\`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-md transition-colors">📍 Mapa</a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}`;
});

fs.writeFileSync('src/components/views/JobsList/HistoryModal.jsx', code, 'utf8');
console.log("Patched HistoryModal");
