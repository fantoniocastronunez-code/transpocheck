import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// --- OPTIMIZACIÓN: Matemática de tiempo blindada para soportar horas y prevenir desbordes ---
const WaitTimerBadge = ({ arrivedAt, role = 'client' }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const diffInSeconds = Math.max(0, Math.floor((Date.now() - arrivedAt) / 1000));
      setTime(diffInSeconds);
    };
    
    updateTimer();
    const int = setInterval(updateTimer, 1000);
    return () => clearInterval(int);
  }, [arrivedAt]);

  const hours = Math.floor(time / 3600);
  const mins = Math.floor((time % 3600) / 60);
  const secs = time % 60;
  
  const timeString = hours > 0 
    ? `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  const totalMins = Math.floor(time / 60);

  if (role === 'client' && totalMins < 20) return null;

  const isWarning = totalMins >= 15;
  const bgClass = isWarning
    ? 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800'
    : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800';
  const iconClass = isWarning ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400';
  const textClass = isWarning ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300';
  const timeClass = isWarning ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400';

  return (
    <div className={`mt-3 mb-2 border p-3 rounded-md flex items-center gap-3 transition-colors ${bgClass}`}>
      <Clock className={`w-6 h-6 shrink-0 ${iconClass}`}/>
      <div className="flex-1">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${textClass}`}>
          {role === 'driver' ? 'Llevas esperando:' : role === 'admin' ? 'Conductor esperando:' : 'El conductor te espera hace:'}
        </p>
        <p className={`font-bold text-2xl ${timeClass} font-mono tabular-nums tracking-wider leading-none mt-1`}>
          {timeString}
        </p>
      </div>
    </div>
  );
};

export default WaitTimerBadge;
