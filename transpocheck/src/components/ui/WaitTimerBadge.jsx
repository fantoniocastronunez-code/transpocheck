import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// --- OPTIMIZACIÓN: Matemática de tiempo blindada para soportar horas y prevenir desbordes ---
const WaitTimerBadge = ({ arrivedAt, role = 'client' }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    // Calculamos la diferencia inicial y luego cada segundo
    const updateTimer = () => {
      const diffInSeconds = Math.max(0, Math.floor((Date.now() - arrivedAt) / 1000));
      setTime(diffInSeconds);
    };
    
    updateTimer(); // Disparo inicial para evitar el lag de 1 segundo
    const int = setInterval(updateTimer, 1000);
    return () => clearInterval(int);
  }, [arrivedAt]);

  // Cálculos matemáticos seguros
  const hours = Math.floor(time / 3600);
  const mins = Math.floor((time % 3600) / 60);
  const secs = time % 60;
  
  // Si hay horas, mostramos formato HH:MM:SS, si no, MM:SS
  const timeString = hours > 0 
    ? `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  // Total de minutos brutos para evaluar las advertencias lógicas
  const totalMins = Math.floor(time / 60);

  if (role === 'client' && totalMins < 20) return null;

  const isWarning = totalMins >= 15;
  const bgClass = isWarning ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-400';
  const iconClass = isWarning ? 'text-red-600' : 'text-amber-500';
  const textClass = isWarning ? 'text-red-800' : 'text-amber-800';
  const timeClass = isWarning ? 'text-red-600' : 'text-amber-600';

  return (
    <div className={`mt-4 mb-2 border-2 p-4 rounded-2xl flex items-center gap-4 animate-in zoom-in shadow-sm transition-colors duration-500 ${bgClass}`}>
      <Clock className={`w-8 h-8 shrink-0 ${iconClass} animate-pulse`}/>
      <div className="flex-1">
        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${textClass}`}>
          {role === 'driver' ? 'Llevas esperando:' : role === 'admin' ? 'Conductor esperando:' : 'El conductor te espera hace:'}
        </p>
        <p className={`font-black text-3xl ${timeClass} font-mono tracking-widest leading-none mt-1`}>
          {timeString}
        </p>
      </div>
    </div>
  );
};

export default WaitTimerBadge;