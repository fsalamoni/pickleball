import { useEffect, useState } from 'react';
import { Lock, Clock } from 'lucide-react';
import { cn } from '@/core/lib/utils';

/**
 * Badge que mostra contagem regressiva até o deadline. Vira "Encerrado" quando passa.
 *
 * @param {{deadline: Date | {seconds:number}}} props
 */
export function DeadlineBadge({ deadline, className }) {
  const date = toDate(deadline);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);

  if (!date) return null;
  const diffMs = date.getTime() - now.getTime();
  const isLocked = diffMs <= 0;

  if (isLocked) {
    return (
      <span className={cn('inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 text-xs font-medium text-slate-600', className)}>
        <Lock className="w-3.5 h-3.5" /> Encerrado
      </span>
    );
  }

  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;

  let text;
  let color = 'text-emerald-700 bg-emerald-100';
  if (days >= 2) text = `Faltam ${days} dias`;
  else if (days === 1) text = `Falta 1 dia ${hours}h`;
  else if (hours >= 6) {
    text = `Faltam ${hours}h ${mins}m`;
    color = 'text-amber-800 bg-amber-100';
  } else {
    text = `Faltam ${hours}h ${mins}m`;
    color = 'text-red-700 bg-red-100';
  }

  return (
    <span className={cn('inline-flex h-7 items-center gap-1 rounded-md border border-current/10 px-2 text-xs font-medium', color, className)}>
      <Clock className="w-3.5 h-3.5" /> {text}
    </span>
  );
}

function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d === 'string' || typeof d === 'number') return new Date(d);
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  if (typeof d.toDate === 'function') return d.toDate();
  return null;
}
