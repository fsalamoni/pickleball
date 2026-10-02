import React, { useMemo, useState } from 'react';
import { Check, MessageSquareHeart } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useMyReviews, useSubmitReviews } from '@/modules/progression/hooks/useSocialGamification';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import {
  pendingReviews, REVIEW_TAGS, REVIEW_ISSUES, REVIEW_MAX_TAGS, LOW_RATING,
} from '@/modules/progression/domain/matchReviews';
import { StarPicker } from './Stars';
import { cn } from '@/core/lib/utils';

const RELATION = { partner: 'Companheiro de dupla', opponent: 'Adversário' };

const quando = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

function ReviewDialog({ open, onClose, match, people, onSubmit, submitting }) {
  const [draft, setDraft] = useState({});
  const set = (uid, patch) => setDraft((d) => ({ ...d, [uid]: { rating: 0, tags: [], issues: [], ...d[uid], ...patch } }));
  const items = match.targets
    .filter((t) => draft[t.uid]?.rating >= 1)
    .map((t) => ({ toUid: t.uid, relation: t.relation, rating: draft[t.uid].rating, tags: draft[t.uid].tags || [], issues: draft[t.uid].issues || [] }));

  const toggle = (uid, campo, id, max) => {
    const atual = draft[uid]?.[campo] || [];
    const prox = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id].slice(0, max);
    set(uid, { [campo]: prox });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Como foi jogar com eles?</DialogTitle>
          <DialogDescription>
            {match.label || 'Jogo'} · {quando(match.at)}. Só você e a equipe de moderação veem quem deu qual nota; a pessoa
            avaliada vê apenas a média, e só depois de reunir avaliações suficientes.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55dvh] space-y-5 overflow-y-auto pr-1">
          {match.targets.map((t) => {
            const p = people.get(t.uid) || { name: 'Atleta', photoUrl: '' };
            const d = draft[t.uid] || { rating: 0, tags: [], issues: [] };
            return (
              <div key={t.uid} className="space-y-2 rounded-2xl border border-gray-100 p-3" data-target={t.uid}>
                <div className="flex items-center gap-2">
                  <V2Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                  <div>
                    <p className="text-sm font-bold text-ink">{p.name}</p>
                    <p className="text-[11px] text-gray-500">{RELATION[t.relation]}</p>
                  </div>
                </div>
                <StarPicker value={d.rating} onChange={(n) => set(t.uid, { rating: n, ...(n <= LOW_RATING ? { tags: [] } : { issues: [] }) })} label={`Nota para ${p.name}`} />
                {d.rating >= 3 && (
                  <div className="flex flex-wrap gap-1.5" aria-label="Elogios">
                    {Object.entries(REVIEW_TAGS).map(([id, m]) => (
                      <button
                        key={id} type="button" aria-pressed={d.tags.includes(id)}
                        onClick={() => toggle(t.uid, 'tags', id, REVIEW_MAX_TAGS)}
                        className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', d.tags.includes(id) ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-600 hover:border-ink/40')}
                      >{m.emoji} {m.label}</button>
                    ))}
                  </div>
                )}
                {d.rating >= 1 && d.rating <= LOW_RATING && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">O que aconteceu? (opcional, só a moderação lê)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(REVIEW_ISSUES).map(([id, m]) => (
                        <button
                          key={id} type="button" aria-pressed={d.issues.includes(id)}
                          onClick={() => toggle(t.uid, 'issues', id, 4)}
                          className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', d.issues.includes(id) ? 'border-red-500 bg-red-500 text-white' : 'border-gray-200 text-gray-600 hover:border-red-300')}
                        >{m.emoji} {m.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Agora não</V2Button>
          <V2Button disabled={items.length === 0 || submitting} onClick={() => onSubmit(items)}>
            Enviar {items.length > 0 ? `(${items.length})` : ''}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * As avaliações pós-jogo pendentes (jogos recentes, com alguém a avaliar).
 * @param {{ uid: string, records: Array<object>, windowDays?: number, recordsLoading?: boolean, recordsError?: boolean, onRetry?: Function }} props
 */
export default function ReviewsPanel({ uid, records, windowDays = 14, recordsLoading, recordsError, onRetry }) {
  const mine = useMyReviews(uid);
  const submit = useSubmitReviews(uid);
  const [open, setOpen] = useState(null);

  const pend = useMemo(
    () => pendingReviews(records, mine.reviews, { uid, windowDays, max: 5 }),
    [records, mine.reviews, uid, windowDays],
  );
  const uids = useMemo(() => pend.flatMap((m) => m.targets.map((t) => t.uid)), [pend]);
  const { people } = usePeople(uids);

  if (mine.isLoading || recordsLoading) return <V2Skeleton className="h-40 rounded-4xl" />;
  if (mine.isError || recordsError) {
    return <V2Surface><V2ErrorState inline title="Não deu para carregar as avaliações" onRetry={() => { mine.refetch(); onRetry?.(); }} /></V2Surface>;
  }

  const enviar = async (items) => {
    try {
      await submit.mutateAsync({ matchKey: open.matchKey, items });
      toast.success('Avaliação enviada. Obrigado por ajudar a comunidade.');
      setOpen(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível enviar agora.');
    }
  };

  return (
    <V2Surface data-testid="reviews-panel" data-dica="avaliacoes">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <MessageSquareHeart className="h-5 w-5" aria-hidden="true" /> Avalie seus jogos
        </h2>
        {pend.length > 0 && <V2Badge tone="amber">{pend.length} {pend.length === 1 ? 'pendente' : 'pendentes'}</V2Badge>}
      </div>
      {pend.length === 0 ? (
        <V2EmptyState
          icon={Check}
          title="Nada para avaliar agora"
          description={`Depois de um jogo com resultado publicado, você pode avaliar quem jogou com você por até ${windowDays} dias.`}
        />
      ) : (
        <ul className="space-y-2">
          {pend.map((m) => (
            <li key={m.matchKey} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{m.label || 'Jogo'}</p>
                <p className="text-xs text-gray-500">{quando(m.at)} · {m.targets.length} {m.targets.length === 1 ? 'pessoa' : 'pessoas'} para avaliar</p>
              </div>
              <V2Button size="sm" onClick={() => setOpen(m)}>Avaliar</V2Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-4 text-gray-400">Sem comentários livres: estrelas e elogios. Você pode retirar uma avaliação a qualquer momento.</p>
      {open && (
        <ReviewDialog open match={open} people={people} onClose={() => setOpen(null)} onSubmit={enviar} submitting={submit.isPending} />
      )}
    </V2Surface>
  );
}
