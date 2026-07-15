import React from 'react';

// 1. Guardamos los diseños "puros" en constantes (Solo se dibujan en memoria 1 vez)
const autoShape = (
  <div className="w-full h-full bg-white rounded-[40px] border-[6px] border-slate-500 relative overflow-hidden flex flex-col justify-between p-2 shadow-inner">
    <div className="w-4/5 h-1/5 bg-slate-800/40 mx-auto rounded-t-2xl rounded-b-sm mt-2"></div>
    <div className="w-4/5 h-10 bg-slate-800/40 mx-auto rounded-b-xl rounded-t-sm mb-2"></div>
  </div>
);

const furgonPequenoShape = (
  <div className="w-full h-full relative flex flex-col items-center">
    <div className="w-[80%] h-[20%] bg-white rounded-t-[35px] border-x-4 border-t-4 border-slate-500 shadow-inner z-0"></div>
    <div className="w-full h-[80%] bg-slate-100 rounded-t-[15px] rounded-b-[20px] border-4 border-slate-500 shadow-inner flex flex-col p-1.5 z-10 -mt-2">
      <div className="w-[90%] h-[20%] bg-slate-800/40 mx-auto rounded-t-[15px] rounded-b-sm mb-1.5"></div>
    </div>
  </div>
);

const furgonGrandeShape = (
  <div className="w-full h-full bg-white rounded-t-[35px] rounded-b-[10px] border-4 border-slate-500 relative flex flex-col justify-start p-2 shadow-inner z-10">
    <div className="w-[85%] h-[15%] bg-slate-800/40 mx-auto rounded-t-[20px] rounded-b-sm mt-1"></div>
  </div>
);

const camionetaShape = (
  <div className="w-full h-full relative flex flex-col">
    <div className="w-full h-[40%] bg-white rounded-t-[35px] rounded-b-md border-4 border-slate-500 p-2 flex flex-col justify-between shadow-inner">
      <div className="w-5/6 h-5 bg-slate-800/40 mx-auto rounded-t-xl rounded-b-sm mt-1"></div>
    </div>
    <div className="w-[90%] h-[60%] mx-auto bg-slate-200 border-x-4 border-b-4 border-slate-500 rounded-b-xl mt-1 relative">
      <div className="absolute inset-2 border-2 border-slate-400 rounded-sm"></div>
    </div>
  </div>
);

const camionDobleShape = (
  <div className="w-full h-full relative flex flex-col">
    <div className="w-full h-[40%] bg-white rounded-t-xl rounded-b-sm border-4 border-slate-500 p-1 flex flex-col justify-end gap-1 shadow-inner z-10 relative">
      <div className="w-full h-[40%] bg-slate-800/40 rounded-t-md"></div>
      <div className="w-full h-[35%] bg-slate-800/40 rounded-sm mb-0.5"></div>
    </div>
    <div className="w-full h-[60%] mx-auto bg-slate-200 border-4 border-slate-500 rounded-sm mt-1 relative overflow-hidden shadow-inner z-10"></div>
  </div>
);

const heavyTruckShape = (
  <div className="w-full h-full relative flex flex-col items-center">
    <div className="absolute top-[8%] left-1 w-2 h-6 bg-slate-800 rounded-sm"></div>
    <div className="absolute top-[8%] right-1 w-2 h-6 bg-slate-800 rounded-sm"></div>
    <div className="w-full h-[25%] bg-white rounded-t-xl rounded-b-sm border-4 border-slate-500 p-1 flex flex-col justify-end shadow-inner z-10 relative">
      <div className="w-full h-1/2 bg-slate-800/50 rounded-t-md rounded-b-sm mb-1"></div>
    </div>
    <div className="w-full h-[75%] mx-auto bg-slate-200 border-4 border-slate-500 rounded-sm mt-1 relative overflow-hidden shadow-inner z-10">
       <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_5px,#94a3b8_5px,#94a3b8_8px)] opacity-60"></div>
    </div>
  </div>
);

const carroArrastreShape = (
  <div className="w-full h-full relative flex flex-col items-center pt-4">
    <div className="w-[90%] h-[85%] bg-slate-200 rounded-md border-4 border-slate-500 relative overflow-hidden shadow-inner flex justify-center items-center z-10">
       <div className="w-[90%] h-[90%] border-2 border-slate-400/50 rounded-sm"></div>
    </div>
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-6 border-x-4 border-t-4 border-slate-500 rounded-t-full bg-slate-400 z-0"></div>
  </div>
);

// 2. Diccionario de Enrutamiento (Soporta todos tus tipos específicos, acentos y variaciones)
const SHAPES = {
  'auto': autoShape,
  'suv': autoShape,
  'auto/suv': autoShape,
  
  'furgon_pequeno': furgonPequenoShape,
  'furgon pequeño': furgonPequenoShape,
  
  'furgon_grande': furgonGrandeShape,
  'furgón grande': furgonGrandeShape,
  
  'camioneta': camionetaShape,
  
  'camion_doble_cabina': camionDobleShape,
  'camión doble cabina': camionDobleShape,
  
  'camion_2ejes': heavyTruckShape,
  'camíon 2 ejes': heavyTruckShape,
  'camión 2 ejes': heavyTruckShape,
  
  'camion_3ejes': heavyTruckShape,
  'camión 3 ejes': heavyTruckShape,
  
  'camion_4ejes': heavyTruckShape,
  'camión 4 ejes': heavyTruckShape,
  
  'camion_8x4': heavyTruckShape,
  'camion con doble barra direccional': heavyTruckShape,
  'camión con doble barra direccional': heavyTruckShape,
  
  'carro_arrastre': carroArrastreShape,
  'carro de arrastre': carroArrastreShape,
};

const VehicleShapeIcon = ({ type }) => {
  // Limpiamos el texto que viene de la BD: lo pasamos a minúsculas y quitamos espacios al inicio/fin
  // Esto evita que "Camión 4 Ejes " falle por una mayúscula o un espacio accidental.
  const normalizedType = type ? type.toString().toLowerCase().trim() : 'auto';
  
  // Si el tipo no existe en el diccionario, usamos 'auto' como salvavidas por defecto
  const shapeToRender = SHAPES[normalizedType] || SHAPES['auto'];

  return (
    <div className="w-full h-full p-2 grayscale brightness-200">
      {shapeToRender}
    </div>
  );
};

export default VehicleShapeIcon;