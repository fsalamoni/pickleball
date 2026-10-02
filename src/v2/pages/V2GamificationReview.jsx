import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useGamificationEngine } from '@/modules/progression/hooks/useGamificationEngine';
import { usePeriodReview } from '@/modules/progression/hooks/usePeriodReview';
import { ReviewBody } from '@/v2/components/gamification/PeriodReviewCard';
import { V2Button, V2EmptyState, V2ErrorState, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { Sparkles } from 'lucide-react';
import MiniStat from '@/v2/components/gamification/MiniStat';

const KINDS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

/** Revisão do período: semana ou mês, com navegação para os anteriores. */
export default function V2GamificationReview() {
  const on = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!on) {
    return (
      <div className="mx-auto max-w-[900px]">
        <V2PageIntro title="Revisão" subtitle="O resumo do seu período." />
        <V2Surface><V2EmptyState icon={Sparkles} title="Disponível em breve" description="A revisão da semana chega junto com a gamificação." /></V2Surface>
      </div>
    );
  }
  return <ReviewOn />;
}

function ReviewOn() {
  const { user } = useAuth();
  const engine = useGamificationEngine(user?.uid, { enabled: !!user, sync: false });
  const [kind, setKind] = useState('week');
  const [offset, setOffset] = useState(0);
  const { review, isLoading, isError, refetch } = usePeriodReview(engine, kind, offset);

  const trocar = (k) => { setKind(k); setOffset(0); };

  return (
    <div className="mx-auto max-w-[900px] space-y-5" data-testid="gamification-review">
      <Link to="/gamification" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Gamificação
      </Link>
      <V2PageIntro title="Sua revisão" subtitle="O que você fez no período, comparado com o anterior. Nada aqui é cobrança." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <V2SubTabs tabs={KINDS} activeValue={kind} onSelect={(t) => trocar(t.value)} ariaLabel="Tipo de período" />
        <div className="flex items-center gap-1">
          <V2Button variant="ghost" size="sm" onClick={() => setOffset((o) => o - 1)} aria-label="Período anterior">
            <ChevronLeft className="h-4 w-4" />
          </V2Button>
          <span className="min-w-[10rem] text-center text-sm font-bold text-ink">{review?.window?.label || '…'}</span>
          <V2Button variant="ghost" size="sm" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))} aria-label="Período seguinte">
            <ChevronRight className="h-4 w-4" />
          </V2Button>
        </div>
      </div>

      {isLoading ? (
        <V2Skeleton className="h-64 rounded-4xl" />
      ) : isError ? (
        <V2Surface><V2ErrorState title="Não deu para montar a revisão" onRetry={refetch} /></V2Surface>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Jogos" value={review.games} />
            <MiniStat label="Vitórias" value={review.wins} />
            <MiniStat label="Dias ativos" value={review.activeDays} />
            <MiniStat label="Missões" value={review.missionsDone} />
          </div>
          <V2Surface>
            <ReviewBody review={review} />
            {review.nextAchievement && (
              <p className="mt-4 rounded-2xl bg-paper p-3 text-sm text-gray-600">
                Próxima conquista mais perto: <strong className="text-ink">{review.nextAchievement.name}</strong> ({Math.round(review.nextAchievement.progress * 100)}%).
              </p>
            )}
          </V2Surface>
        </>
      )}
    </div>
  );
}
