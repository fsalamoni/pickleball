import React, { useMemo } from 'react';
import { Swords } from 'lucide-react';
import { toast } from 'sonner';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useMyDuels } from '@/modules/progression/hooks/useChallenges';
import { cn } from '@/core/lib/utils';

/** Quantos jogos e vitórias a pessoa tem na janela do duelo (do que ela mesma sabe). */
function minhaParcial(records, duel) {
  const lista = (records || []).filter((r) => r.at >= duel.startsAt && r.at < duel.endsAt);
  return { games: lista.length, wins: lista.filter((r) => r.won === true).length };
}

function DuelBody({ duel, uid, records, onDecline, declining }) {
  const souA = duel.uidA === uid;
  const adversario = souA ? duel.nameB : duel.nameA;
  const meu = souA ? duel.resultA : duel.resultB;
  const dele = souA ? duel.resultB : duel.resultA;
  const parcial = useMemo(() => minhaParcial(records, duel), [records, duel]);
  const terminou = duel.status === 'finished';
  const ganhei = terminou && duel.winner === uid;
  const empate = terminou && duel.outcome === 'tie';

  return (
    <div className="space-y-3" data-duel={duel.id} data-status={duel.status}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Contra <strong className="text-ink">{adversario || 'Atleta'}</strong>
        </p>
        {duel.status === 'active' && <V2Badge tone="amber">em andamento</V2Badge>}
        {terminou && <V2Badge tone={ganhei ? 'green' : empate ? 'neutral' : 'red'}>{ganhei ? 'você venceu' : empate ? 'empate' : 'ficou com o adversário'}</V2Badge>}
        {duel.status === 'declined' && <V2Badge>recusado</V2Badge>}
      </div>
      {terminou ? (
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className={cn('rounded-2xl p-3', ganhei ? 'bg-green-50' : 'bg-paper')}>
            <p className="text-3xl font-black tabular-nums text-ink">{meu?.wins ?? 0}</p>
            <p className="text-xs text-gray-500">suas vitórias ({meu?.games ?? 0} jogos)</p>
          </div>
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-3xl font-black tabular-nums text-ink">{dele?.wins ?? 0}</p>
            <p className="text-xs text-gray-500">vitórias de {adversario || 'Atleta'}</p>
          </div>
        </div>
      ) : duel.status === 'active' ? (
        <>
          <div className="rounded-2xl bg-paper p-3 text-center">
            <p className="text-3xl font-black tabular-nums text-ink">{parcial.wins}</p>
            <p className="text-xs text-gray-500">suas vitórias até agora ({parcial.games} {parcial.games === 1 ? 'jogo' : 'jogos'})</p>
          </div>
          <p className="text-xs text-gray-500">
            Vence quem somar mais vitórias até domingo, à meia-noite. O placar do adversário aparece só no final, para
            ninguém jogar olhando o outro.
          </p>
          <V2Button variant="ghost" size="sm" disabled={declining} onClick={() => onDecline(duel.id)}>Recusar este duelo</V2Button>
        </>
      ) : null}
    </div>
  );
}

/**
 * O duelo da semana: o servidor emparelha quem tem nível parecido; vence quem
 * somar mais vitórias. Recusar é um toque e não tem penalidade.
 *
 * @param {{ uid: string, records: Array<object> }} props
 */
export default function DuelCard({ uid, records }) {
  const q = useMyDuels(uid);
  if (q.isLoading) return <V2Skeleton className="h-40 rounded-4xl" />;
  if (q.isError) return <V2Surface><V2ErrorState inline title="Não deu para carregar o duelo" onRetry={q.refetch} /></V2Surface>;
  const atual = q.duels.find((d) => d.status === 'active') || q.duels[0] || null;

  return (
    <V2Surface data-testid="duel-card" data-dica="duelo">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Swords className="h-5 w-5" aria-hidden="true" /> Duelo da semana
      </h2>
      {atual ? (
        <DuelBody
          duel={atual} uid={uid} records={records} declining={q.decline.isPending}
          onDecline={(id) => q.decline.mutate(id, { onSuccess: () => toast('Duelo recusado. Na próxima semana tem outro.') })}
        />
      ) : (
        <p className="text-sm text-gray-600">
          Toda segunda-feira o PickleRush emparelha você com alguém de nível parecido. Jogue ao menos uma partida na
          semana para entrar no sorteio — e se não quiser duelos, desligue em Preferências.
        </p>
      )}
    </V2Surface>
  );
}
