import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Check, Clock, Lock } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { tallyVotes, isPollClosed, toggleOption } from '@/modules/clubs/domain/forumPoll';
import { usePollVotes, useMyPollVote, useSetPollVote } from '@/modules/clubs/hooks/useClubForum';
import { V2Badge, V2Button } from '@/v2/ui/primitives';

function closesLabel(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function V2ForumPoll({ thread }) {
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
    <div className="rounded-3xl border border-gray-100 bg-paper p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-ink" />
          <h4 className="font-display font-bold text-ink">{poll.question}</h4>
        </div>
        {closed ? (
          <V2Badge tone="neutral"><Lock className="h-3 w-3" /> Encerrada</V2Badge>
        ) : poll.closes_at_ms ? (
          <V2Badge tone="amber"><Clock className="h-3 w-3" /> até {closesLabel(poll.closes_at_ms)}</V2Badge>
        ) : null}
      </div>

      <p className="mb-4 text-xs text-gray-500">
        {poll.multiple ? 'Você pode escolher várias opções.' : 'Escolha uma opção.'}
      </p>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const r = results.find((x) => x.id === opt.id);
          const pct = r?.percent || 0;
          return (
            <button
              key={opt.id}
              onClick={() => handleToggle(opt.id)}
              disabled={closed}
              className={cn(
                'relative block w-full overflow-hidden rounded-2xl border p-3 text-left transition-colors',
                isSelected ? 'border-ink bg-white text-ink' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                closed && 'cursor-default opacity-80'
              )}
            >
              {revealResults && (
                <div
                  className={cn('absolute inset-y-0 left-0 transition-all duration-700 ease-out', isSelected ? 'bg-acid/30' : 'bg-gray-100')}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', isSelected ? 'border-ink bg-ink text-acid' : 'border-gray-300')}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{opt.text}</span>
                </span>
                {revealResults && <span className="text-xs text-gray-500">{pct}% ({r?.votes || 0})</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <span>{totalVoters} voto(s){poll.multiple ? ` em ${totalVotes} escolhas` : ''}</span>
        <div className="flex gap-2">
          {!revealResults && !closed && (
            <V2Button size="sm" variant="ghost" onClick={() => setShowResults(true)}>Ver parciais</V2Button>
          )}
          {!hasVoted && !closed && (
            <V2Button size="sm" onClick={handleVote} disabled={selected.length === 0 || setVote.isPending}>
              Votar
            </V2Button>
          )}
          {hasVoted && !closed && (
            <V2Button size="sm" variant="ghost" onClick={handleClear} disabled={setVote.isPending}>
              Remover voto
            </V2Button>
          )}
        </div>
      </div>
    </div>
  );
}
