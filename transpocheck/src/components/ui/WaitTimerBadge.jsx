import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const WaitTimerBadge = ({ arrivedAt, role = 'client' }) => {
  const [time, setTime] = useState(Math.floor((Date.now() - arrivedAt) / 1000));

  useEffect(() => {
    const int = setInterval(() => setTime(Math.floor((Date.now() - arrivedAt) / 1000)), 1000);
    return () => clearInterval(int);
  }, [arrivedAt]);

  const mins = Math.floor(time / 60);
  const secs = time % 60;
  const timeString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  if (role === 'client' && mins < 20) return null;

  const isWarning = mins >= 15;
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