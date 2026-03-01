'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  endTime: string;
  compact?: boolean;
  className?: string;
}

function formatTimeLeft(ms: number) {
  if (ms <= 0) return { display: 'Ended', urgent: false, critical: false };
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    display: h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`,
    urgent: ms < 5 * 60 * 1000,  // < 5 min
    critical: ms < 10 * 1000,     // < 10 sec
    ending: ms < 60 * 1000,       // < 60 sec
  };
}

export function CountdownTimer({ endTime, compact = false, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(new Date(endTime).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(new Date(endTime).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const { display, urgent, critical, ending } = formatTimeLeft(timeLeft) as any;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 text-sm font-mono font-semibold',
        ending ? 'text-red-400' : urgent ? 'text-amber-400' : 'text-foreground',
        critical && 'animate-pulse-bid',
        className
      )}>
        <span className={cn('w-1.5 h-1.5 rounded-full', ending ? 'bg-red-400' : 'bg-emerald-400', 'animate-pulse')} />
        {display}
      </div>
    );
  }

  return (
    <div className={cn('text-center', className)}>
      <p className="text-xs text-muted-foreground mb-1">Ends in</p>
      <div className={cn(
        'text-4xl font-mono font-bold tracking-tight',
        ending ? 'text-red-400' : urgent ? 'text-amber-400' : 'text-foreground',
        critical && 'animate-pulse-bid',
      )}>
        {display}
      </div>
      {ending && !critical && (
        <p className="text-xs text-red-400 mt-1 font-medium">⚡ Ending very soon!</p>
      )}
      {critical && (
        <p className="text-xs text-red-400 mt-1 font-bold animate-pulse">🔥 LAST {Math.ceil(timeLeft / 1000)} SECONDS!</p>
      )}
    </div>
  );
}
