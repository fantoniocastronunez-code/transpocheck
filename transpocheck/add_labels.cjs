const fs = require('fs');

const filesToUpdate = [
    {
        path: 'src/utils/pdfGenerator.js',
        replacements: [
            {
                search: "odometer: 'Odómetro' }",
                replace: "odometer: 'Odómetro', fuelGauge: 'Med. Combustible' }"
            },
            {
                search: "odometer: 'Odómetro', det1: 'Detalle 1'",
                replace: "odometer: 'Odómetro', fuelGauge: 'Med. Combustible', det1: 'Detalle 1'"
            }
        ]
    },
    {
        path: 'src/components/views/JobsList/HistoryModal.jsx',
        replacements: [
            {
                search: "odometer: 'Odómetro', vin: 'Nro Chasis', mileage: 'Kilometraje' };",
                replace: "odometer: 'Odómetro', vin: 'Nro Chasis', mileage: 'Kilometraje', fuelGauge: 'Med. Combustible' };"
            }
        ]
    },
    {
        path: 'src/components/views/TrackingView.jsx',
        replacements: [
            {
                search: "odometer: 'Odómetro', vin: 'Nro Chasis', mileage: 'Kilometraje' };",
                replace: "odometer: 'Odómetro', vin: 'Nro Chasis', mileage: 'Kilometraje', fuelGauge: 'Med. Combustible' };"
            }
        ]
    }
];

filesToUpdate.forEach(fileDef => {
    try {
        let content = fs.readFileSync(fileDef.path, 'utf8');
        fileDef.replacements.forEach(r => {
            content = content.replace(r.search, r.replace);
        });
        fs.writeFileSync(fileDef.path, content, 'utf8');
        console.log("Updated " + fileDef.path);
    } catch (e) {
        console.error("Error updating " + fileDef.path, e);
    }
});
