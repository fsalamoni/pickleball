import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Check, Clock, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/core/lib/utils';
import { tallyVotes, isPollClosed, toggleOption } from '@/modules/clubs/domain/forumPoll';
import { usePollVotes, useMyPollVote, useSetPollVote } from '@/modules/clubs/hooks/useClubForum';

function closesLabel(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Enquete do fórum: votação (única ou múltipla) com apuração em tempo real,
 * encerramento automático por data e exibição de percentuais.
 */
export default function ForumPoll({ thread }) {
  const poll = thread?.poll;
  const { data: votes = [] } = usePollVotes(thread?.id);
  const { data: myVote } = useMyPollVote(thread?.id);
  const setVote = useSetPollVote(thread?.id);

  const [selected, setSelected] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const closed = isPollClosed(poll);
  const hasVoted = (myVote?.option_ids || []).length > 0;

  useEffect(() => {
    setSelected(myVote?.option_ids || []);
  }, [myVote?.option_ids]);

  const { results, totalVotes, totalVoters } = useMemo(() => tallyVotes(poll, votes), [poll, votes]);

  if (!poll) return null;

  const revealResults = showResults || hasVoted || closed;

  const handleToggle = (optionId) => {
    if (closed) return;
    setSelected((prev) => toggleOption(prev, optionId, poll.multiple));
  };

  const handleVote = async () => {
    if (selected.length === 0) {
      toast.error('Selecione ao menos uma opção.');
      return;
    }
    try {
      await setVote.mutateAsync({ thread, optionIds: selected });
      toast.success('Voto registrado.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível votar.');
    }
  };

  const handleClear = async () => {
    try {
      await setVote.mutateAsync({ thread, optionIds: [] });
      setSelected([]);
      toast.success('Voto removido.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover o voto.');
    }
  };

  return (
    <div className="rounded-xl border border-emerald-950/10 bg-secondary/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-700" />
          <h4 className="font-semibold text-slate-900">{poll.question}</h4>
        </div>
        {closed ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            <Lock className="h-3 w-3" /> Encerrada
          </span>
        ) : poll.closes_at_ms ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            <Clock className="h-3 w-3" /> até {closesLabel(poll.closes_at_ms)}
          </span>
        ) : null}
      </div>

      <p className="mb-3 text-xs text-slate-500">
        {poll.multiple ? 'Você pode escolher várias opções.' : 'Escolha uma opção.'}
      </p>

      <div className="space-y-2">
        {results.map((option) => {
          const isSelected = selected.includes(option.id);
          const isMine = (myVote?.option_ids || []).includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleToggle(option.id)}
              disabled={closed}
              className={cn(
                'relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors',
                isSelected ? 'border-emerald-500 bg-white' : 'border-emerald-950/10 bg-white/70 hover:border-emerald-300',
                closed && 'cursor-default',
              )}
            >
              {revealResults && (
                <span
                  className="absolute inset-y-0 left-0 bg-emerald-100/80"
                  style={{ width: `${option.percentage}%` }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-slate-800">
                  <span className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center border',
                    poll.multiple ? 'rounded' : 'rounded-full',
                    isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300',
                  )}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  {option.text}
                  {isMine && <span className="text-[11px] font-medium text-emerald-700">· seu voto</span>}
                </span>
                {revealResults && (
                  <span className="relative shrink-0 text-xs font-semibold text-slate-600">
                    {option.percentage}% ({option.count})
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {totalVoters} participante(s) · {totalVotes} voto(s)
        </span>
        <div className="flex gap-2">
          {!closed && !revealResults && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowResults(true)}>
              Ver parcial
            </Button>
          )}
          {!closed && hasVoted && (
            <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={handleClear} disabled={setVote.isPending}>
              Remover voto
            </Button>
          )}
          {!closed && (
            <Button size="sm" className="h-8" onClick={handleVote} disabled={setVote.isPending || selected.length === 0}>
              {hasVoted ? 'Atualizar voto' : 'Votar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
