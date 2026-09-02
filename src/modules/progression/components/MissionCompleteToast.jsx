import React from 'react';
import { CheckCircle2, Sparkles, Gift, X } from 'lucide-react';

/**
 * MissionCompleteToast — toast pra missão completada.
 *
 * Props:
 *  - mission: { id, title, xp, bonus } (null se invisível)
 *  - onClose: () => void
 *  - autoCloseMs: padrão 4000
 *
 * Animação CSS (slide+fade) — sem dependência de framer-motion.
 */
export default function MissionCompleteToast({ mission, onClose, autoCloseMs = 4000 }) {
  React.useEffect(() => {
    if (!mission) return undefined;
    const t = setTimeout(() => onClose?.(), autoCloseMs);
    return () => clearTimeout(t);
  }, [mission, autoCloseMs, onClose]);

  if (!mission) return null;
  return (
    <div
      key={mission.id}
      data-testid="mission-complete-toast"
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed right-4 top-4 z-50 flex w-80 animate-[slide-in-right_0.3s_ease-out] items-start gap-3 rounded-3xl border border-emerald-200 bg-white p-3 shadow-2xl"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
          <Sparkles className="h-3 w-3" /> Missão completa
        </p>
        <p className="mt-0.5 text-sm font-bold text-ink">{mission.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
            +{mission.xp} XP
          </span>
          {mission.bonus > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
              <Gift className="h-3 w-3" /> bônus {mission.bonus}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-ink"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
