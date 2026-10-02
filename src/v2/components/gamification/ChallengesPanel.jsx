import React, { useMemo, useState } from 'react';
import { Flag, Target, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import {
  useActiveChallenges, useChallengeActions, useChallengeEntries, useFinishedChallenges, useMyEntries,
} from '@/modules/progression/hooks/useChallenges';
import {
  CHALLENGE_ISSUER_LABEL, CHALLENGE_METRICS, canJoinChallenge, challengeTimeLabel, challengeTimeState, myStanding, prizeFor, rankEntries,
} from '@/modules/progression/domain/challenges';
import { usePeople, useClubNames } from '@/modules/progression/hooks/usePeople';
import { cn } from '@/core/lib/utils';

const dataBR = (ms) => new Date(Number(ms)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/** O placar de um desafio (top 10 + a posição da própria pessoa). */
function Leaderboard({ challenge, subjectId }) {
  const q = useChallengeEntries(challenge.id);
  const ranked = useMemo(() => rankEntries(q.entries), [q.entries]);
  const unit = CHALLENGE_METRICS[challenge.metric]?.unit || '';
  const eu = myStanding(ranked, subjectId);
  const top = ranked.slice(0, 10);
  const { people } = usePeople(top.filter((e) => e.subjectType !== 'club').map((e) => e.subjectId));
  const clubs = useClubNames(top.filter((e) => e.subjectType === 'club').map((e) => e.subjectId));
  const nomeDe = (e) => (e.subjectType === 'club' ? clubs.get(e.subjectId) : people.get(e.subjectId)?.name) || 'Atleta';
  if (q.isLoading) return <V2Skeleton lines={4} />;
  if (q.isError) return <V2ErrorState inline title="Não deu para carregar o placar" onRetry={q.refetch} />;
  if (!ranked.length) return <p className="text-sm text-gray-500">Ninguém entrou ainda. Seja a primeira pessoa.</p>;
  return (
    <div className="space-y-2">
      {eu && (
        <p className="rounded-xl bg-acid/20 p-2.5 text-sm text-ink" data-testid="my-standing">
          Você está em <strong>{eu.position}º</strong> de {eu.total} com <strong>{eu.value} {unit}</strong>
          {eu.toPodium != null && <> · faltam {eu.toPodium} para o pódio</>}
          {eu.inPodium && <> · no pódio 🎉</>}
        </p>
      )}
      <ol className="space-y-1">
        {top.map((e) => {
          const premio = prizeFor(challenge, e.position);
          return (
            <li key={e.id} className={cn('flex items-center justify-between rounded-xl px-3 py-1.5 text-sm', e.subjectId === subjectId ? 'bg-paper font-bold' : '')}>
              <span className="flex items-center gap-2">
                <span className="w-6 tabular-nums text-gray-400">{e.position}º</span>
                <span className="text-ink">{nomeDe(e)}</span>
                {premio && <V2Badge tone="amber">{premio.label || `${premio.xp} XP`}</V2Badge>}
              </span>
              <span className="tabular-nums text-gray-600">{e.value || 0} {unit}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-gray-400">O placar é calculado pelo servidor a cada poucas horas, a partir dos jogos registrados.</p>
    </div>
  );
}

function ChallengeCard({ c, entry, onOpen, onJoin, joining }) {
  const metrica = CHALLENGE_METRICS[c.metric];
  const estado = challengeTimeState(c);
  const pode = canJoinChallenge(c);
  return (
    <li className="rounded-2xl border border-gray-100 p-4" data-challenge={c.id}>
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">{c.emoji || '🏆'}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-display text-base font-bold text-ink">{c.title}</p>
            <V2Badge tone="purple">{CHALLENGE_ISSUER_LABEL[c.issuerType] || 'Desafio'}</V2Badge>
            {c.subject === 'club' && <V2Badge tone="blue"><Users className="h-3 w-3" /> entre clubes</V2Badge>}
            {entry && <V2Badge tone="green">você está dentro</V2Badge>}
          </div>
          {c.description && <p className="mt-0.5 text-sm text-gray-600">{c.description}</p>}
          <p className="mt-1 text-xs text-gray-500">
            Mede: {metrica?.label || c.metric} · {dataBR(c.startsAt)} a {dataBR(c.endsAt)} · {challengeTimeLabel(c)}
          </p>
          {c.prizes?.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {c.prizes.map((p) => `${p.place}º: ${p.label || `${p.xp} XP`}`).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <V2Button size="sm" variant="secondary" onClick={() => onOpen(c)}>Ver placar</V2Button>
        {!entry && c.subject !== 'club' && estado !== 'ended' && (
          pode.ok ? (
            <V2Button size="sm" disabled={joining} onClick={() => onJoin(c)}>Entrar no desafio</V2Button>
          ) : <span className="text-xs text-gray-500">{pode.reason}</span>
        )}
        {entry && estado !== 'ended' && <span className="text-xs text-gray-500">Seu progresso é contado automaticamente.</span>}
      </div>
    </li>
  );
}

const TABS = [
  { value: 'ativos', label: 'Ativos', icon: Target },
  { value: 'meus', label: 'Meus desafios', icon: Flag },
  { value: 'encerrados', label: 'Resultados', icon: Trophy },
];

/** Descobrir, entrar e acompanhar desafios. @param {{ uid: string }} props */
export default function ChallengesPanel({ uid }) {
  const [aba, setAba] = useState('ativos');
  const [aberto, setAberto] = useState(null);
  const ativos = useActiveChallenges();
  const encerrados = useFinishedChallenges(aba === 'encerrados');
  const mine = useMyEntries(uid);
  const act = useChallengeActions(uid);

  const lista = useMemo(() => {
    if (aba === 'ativos') return ativos.challenges.filter((c) => challengeTimeState(c) !== 'ended').sort((a, b) => Number(a.endsAt) - Number(b.endsAt));
    if (aba === 'meus') return ativos.challenges.filter((c) => mine.byChallenge.has(c.id));
    return encerrados.challenges;
  }, [aba, ativos.challenges, encerrados.challenges, mine.byChallenge]);

  const carregando = ativos.isLoading || mine.isLoading || (aba === 'encerrados' && encerrados.isLoading);
  const falhou = ativos.isError || mine.isError || (aba === 'encerrados' && encerrados.isError);

  const entrar = async (c) => {
    try {
      await act.join.mutateAsync(c.id);
      toast.success(`Você entrou em “${c.title}”.`);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível entrar agora.');
    }
  };

  return (
    <V2Surface data-testid="challenges-panel" data-dica="desafios" className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Trophy className="h-5 w-5" aria-hidden="true" /> Desafios
      </h2>
      <V2SubTabs tabs={TABS} activeValue={aba} onSelect={(t) => setAba(t.value)} ariaLabel="Tipo de desafio" />
      {carregando ? <V2Skeleton lines={4} /> : falhou ? (
        <V2ErrorState inline title="Não deu para carregar os desafios" onRetry={() => { ativos.refetch(); mine.refetch(); }} />
      ) : lista.length === 0 ? (
        <V2EmptyState
          icon={Trophy}
          title={aba === 'meus' ? 'Você não está em nenhum desafio' : aba === 'encerrados' ? 'Nenhum resultado ainda' : 'Nenhum desafio aberto agora'}
          description={aba === 'meus' ? 'Entre num desafio ativo para competir pelo placar.' : 'Quando a plataforma, uma arena, um clube ou um professor abrir um desafio, ele aparece aqui.'}
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((c) => (
            <ChallengeCard key={c.id} c={c} entry={mine.byChallenge.get(c.id)} onOpen={setAberto} onJoin={entrar} joining={act.join.isPending} />
          ))}
        </ul>
      )}
      {aberto && (
        <Dialog open onOpenChange={(v) => { if (!v) setAberto(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{aberto.emoji} {aberto.title}</DialogTitle>
              <DialogDescription>{aberto.rules || aberto.description || 'Quem somar mais, vence.'}</DialogDescription>
            </DialogHeader>
            <Leaderboard challenge={aberto} subjectId={uid} />
          </DialogContent>
        </Dialog>
      )}
    </V2Surface>
  );
}
