import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { usePlayerMatchDates } from '@/modules/progression/hooks/useProgression';
import { useSyncProgressionV2 } from '@/modules/progression/hooks/useSyncProgressionV2';
import ProgressionCardV2 from '@/modules/progression/components/ProgressionCardV2';
import { V2Badge } from '@/v2/ui/primitives';

/**
 * Bloco "Sua progressão" do perfil (gamificação V2).
 *
 * É um componente separado de propósito: `usePlayerStats()` não aceita
 * `enabled`, então a única forma de a flag desligada realmente não custar
 * leitura nenhuma é NÃO MONTAR o componente. Com o bloco inline no
 * `V2Profile`, todo mundo pagava as consultas de desempenho e de datas de
 * partida mesmo com a gamificação desativada.
 *
 * O pai só renderiza este componente quando `GAMIFICATION_V2` está ligada.
 */
export default function ProfileProgressionSection({ uid }) {
  const { stats } = usePlayerStats();
  const { data: matchDates = [] } = usePlayerMatchDates(uid, !!uid);
  useSyncProgressionV2(uid, stats, !!uid);

  return (
    <section className="mt-8" data-testid="profile-progression-v2">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold text-ink">Sua progressão</h2>
        <V2Badge tone="amber">V2</V2Badge>
      </div>
      <ProgressionCardV2 summary={stats} matchDates={matchDates} />
      <div className="mt-3 text-center text-sm">
        <Link
          to="/gamification"
          className="inline-flex items-center gap-1 font-bold text-ink hover:underline"
        >
          Ver missões e mais conquistas →
        </Link>
      </div>
    </section>
  );
}
