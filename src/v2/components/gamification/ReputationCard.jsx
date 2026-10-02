import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useMyPrivateReputation, useReputation } from '@/modules/progression/hooks/useSocialGamification';
import { REVIEW_ISSUES, REVIEW_TAGS } from '@/modules/progression/domain/matchReviews';
import { StarsStatic } from './Stars';
import TermHint from './TermHint';

/**
 * A reputação da pessoa como parceira de jogo. O número só é público com
 * amostra suficiente; as categorias de problema são visíveis só para ela.
 *
 * @param {{ uid: string, minForPublicScore?: number, self?: boolean }} props
 */
export default function ReputationCard({ uid, minForPublicScore = 5, self = true }) {
  const rep = useReputation(uid);
  const priv = useMyPrivateReputation(uid, self);
  if (rep.isLoading) return <V2Skeleton className="h-32 rounded-4xl" />;
  const r = rep.reputation;
  const count = r?.count || 0;
  const issues = Object.entries(priv.privateReputation?.issues || {}).filter(([id, n]) => REVIEW_ISSUES[id] && n > 0);

  return (
    <V2Surface data-testid="reputation-card" data-dica="reputacao">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Sua reputação em quadra <TermHint term="reputacao" />
      </h2>
      {r?.publicScore ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-display text-4xl font-black tabular-nums text-ink">{Number(r.average).toFixed(1)}</p>
          <div>
            <StarsStatic value={r.average} />
            <p className="text-xs text-gray-500">{count} avaliações de quem jogou com você</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          Ainda faltam <strong className="text-ink">{Math.max(0, minForPublicScore - count)}</strong> avaliações para a sua nota aparecer.
          Antes disso ela não é exibida — poucas notas dizem pouco.
        </p>
      )}
      {r?.topTags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.topTags.map(({ tag, count: n }) => REVIEW_TAGS[tag] && (
            <span key={tag} className="rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-ink">
              {REVIEW_TAGS[tag].emoji} {REVIEW_TAGS[tag].label} <span className="text-gray-400">×{n}</span>
            </span>
          ))}
        </div>
      )}
      {self && issues.length > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Só você vê isto: alguns jogadores apontaram {issues.map(([id]) => REVIEW_ISSUES[id].label.toLowerCase()).join(', ')}.
          Não mostramos quem — é um retrato para você ajustar o que quiser.
        </p>
      )}
    </V2Surface>
  );
}
