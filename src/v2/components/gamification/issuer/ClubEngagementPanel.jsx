import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { useClubMembers, useClubEvents } from '@/modules/clubs/hooks/useClubs';
import { useClubPublishedGames } from '@/modules/progression/hooks/useClubPublishedGames';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import { clubMetrics, monthWindow } from '@/modules/progression/domain/supplyMetrics';
import { V2Surface, V2Badge } from '@/v2/ui/primitives';
import MiniStat from '../MiniStat';
import OwnerEngagementPanel from './OwnerEngagementPanel';

function GoalRow({ g }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3" data-club-goal={g.id}>
      <span className="text-2xl" aria-hidden="true">{g.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{g.label}</p>
        <p className="text-xs text-gray-500">{g.hint}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
          <div className={g.done ? 'h-full rounded-full bg-green-500' : 'h-full rounded-full bg-amber-400'} style={{ width: `${Math.round(g.progress * 100)}%` }} />
        </div>
      </div>
      {g.done ? <V2Badge tone="green">conquistada</V2Badge> : <span className="text-xs tabular-nums text-gray-500">{g.value}/{g.target}</span>}
    </li>
  );
}

/** Atividade do clube: jogos, membros ativos, quem mais joga e as conquistas coletivas. @param {{ club: { id: string, name?: string } }} props */
export default function ClubEngagementPanel({ club }) {
  const games = useClubPublishedGames(club.id);
  const members = useClubMembers(club.id);
  const events = useClubEvents(club.id);
  const ok = (q) => (q.isError ? undefined : q.data);
  const m = useMemo(() => clubMetrics({ games: ok(games), members: ok(members), events: ok(events) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games.data, games.isError, members.data, members.isError, events.data, events.isError]);
  const top = m.month?.topContributors || [];
  const { people } = usePeople(top.map((t) => t.uid));

  const summary = (
    <V2Surface data-testid="club-activity" data-dica="clube-atividade" className="space-y-5">
      <h2 className="font-display text-lg font-bold text-ink">Atividade do clube</h2>
      {m.unknown.length > 0 && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Não deu para carregar: {m.unknown.join(', ')}. Os números dependentes ficaram de fora.</p>}
      {m.week && m.month ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Jogos na semana" value={m.week.games} />
            <MiniStat label="Jogos no mês" value={m.month.games} />
            <MiniStat label="Membros ativos no mês" value={`${m.month.activeMembers}/${m.month.totalMembers}`} hint={`${m.month.activeRate}%`} />
            <MiniStat label="Membros novos no mês" value={m.month.newMembers} />
          </div>
          {top.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400"><Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Quem mais jogou no mês</p>
              <ol className="space-y-1">
                {top.map((t, i) => <li key={t.uid} className="flex justify-between text-sm"><span className="text-ink">{i + 1}º {people.get(t.uid)?.name || 'Atleta'}</span><span className="tabular-nums text-gray-600">{t.games} {t.games === 1 ? 'jogo' : 'jogos'} · {t.wins} {t.wins === 1 ? 'vitória' : 'vitórias'}</span></li>)}
              </ol>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Conquistas coletivas</p>
            <ul className="space-y-2">{[...m.goalsWeek, ...m.goalsMonth].map((g) => <GoalRow key={g.id} g={g} />)}</ul>
          </div>
        </>
      ) : <p className="text-sm text-gray-600">Sem dados para mostrar agora.</p>}
      <p className="text-[11px] leading-4 text-gray-400">Contam os jogos publicados no ranking pelos dias de jogo do clube. Nada aqui é público — só quem administra o clube vê.</p>
    </V2Surface>
  );
  return <OwnerEngagementPanel ownerType="club" issuer={{ type: 'club', id: club.id, name: club.name }} summary={summary} actuals={m.actuals} monthKey={monthWindow().key} />;
}
