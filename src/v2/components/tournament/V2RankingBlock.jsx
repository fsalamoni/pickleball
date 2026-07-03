import React from 'react';
import { Info, Medal, Trophy } from 'lucide-react';
import { AvatarGroup } from '@/components/ui/user-avatar';
import { useModalities, useModalityRankingStructured } from '@/modules/tournament/hooks/useTournament';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import V2Collapsible from './V2Collapsible';
import { cn } from '@/core/lib/utils';

const MEDAL_COLOR = { 1: 'text-amber-500', 2: 'text-gray-400', 3: 'text-amber-700' };
const ROW_TONE = { 1: 'bg-amber-50/70', 2: 'bg-gray-100/70', 3: 'bg-orange-50/60' };

function Position({ position }) {
  const color = MEDAL_COLOR[position];
  return (
    <span className="inline-flex items-center gap-1 font-bold tabular-nums text-ink">
      {color && <Medal className={cn('h-4 w-4', color)} />}
      {position}
    </span>
  );
}

function RankStat({ label, value, strong, tone }) {
  return (
    <div className="rounded-xl bg-white/80 px-1 py-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={cn('text-sm tabular-nums', strong ? 'font-bold text-ink' : cn('font-medium', tone || 'text-gray-600'))}>{value}</div>
    </div>
  );
}

function GroupRanking({ group, showName }) {
  return (
    <div>
      {showName && group.name && <div className="mb-1 text-xs font-bold text-ink">{group.name}</div>}

      {/* Desktop */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-paper text-gray-500">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Pos.</th>
              <th className="px-3 py-2 font-semibold">Participante</th>
              <th className="px-3 py-2 text-center font-semibold">PJ</th>
              <th className="px-3 py-2 text-center font-semibold" title="Vitórias">V</th>
              <th className="px-3 py-2 text-center font-semibold">D</th>
              <th className="px-3 py-2 text-center font-semibold">Sets</th>
              <th className="px-3 py-2 text-center font-semibold">PF</th>
              <th className="px-3 py-2 text-center font-semibold">PC</th>
              <th className="px-3 py-2 text-center font-semibold">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => {
              const balance = (r.points_for || 0) - (r.points_against || 0);
              return (
                <tr key={r.key} className={cn('border-t border-gray-100', ROW_TONE[r.position])}>
                  <td className="px-3 py-2"><Position position={r.position} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AvatarGroup size="sm" people={r.players || []} />
                      <span className="text-ink">{r.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{r.played}</td>
                  <td className="px-3 py-2 text-center font-semibold text-ink">{r.wins}</td>
                  <td className="px-3 py-2 text-center">{r.losses}</td>
                  <td className="px-3 py-2 text-center">{r.sets_won}–{r.sets_lost}</td>
                  <td className="px-3 py-2 text-center">{r.points_for}</td>
                  <td className="px-3 py-2 text-center">{r.points_against}</td>
                  <td className={cn('px-3 py-2 text-center font-medium', balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-gray-600')}>
                    {balance > 0 ? `+${balance}` : balance}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2 sm:hidden">
        {group.rows.map((r) => {
          const balance = (r.points_for || 0) - (r.points_against || 0);
          return (
            <div key={r.key} className={cn('rounded-2xl border border-gray-100 p-3', ROW_TONE[r.position] || 'bg-white')}>
              <div className="flex items-center gap-2">
                <Position position={r.position} />
                <AvatarGroup size="sm" people={r.players || []} />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.label}</span>
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
                <RankStat label="PJ" value={r.played} />
                <RankStat label="V" value={r.wins} strong />
                <RankStat label="D" value={r.losses} />
                <RankStat label="Sets" value={`${r.sets_won}–${r.sets_lost}`} />
                <RankStat label="PF" value={r.points_for} />
                <RankStat label="PC" value={r.points_against} />
                <RankStat label="Saldo" value={balance > 0 ? `+${balance}` : balance} tone={balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-gray-700'} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function V2ModalityRanking({ modality }) {
  const { data, isLoading } = useModalityRankingStructured(modality.id);
  const phases = (data?.phases || []).filter((p) => p.played && p.groups.length > 0);
  const showPhaseHeaders = phases.length > 1;
  const subtitle = isLoading ? 'Carregando…' : phases.length === 0 ? 'Aguardando resultados' : showPhaseHeaders ? `${phases.length} fases com resultados` : 'Classificação';

  return (
    <V2Collapsible title={<span className="inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-ink" /> {modality.name}</span>} subtitle={subtitle}>
      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : phases.length === 0 ? (
        <p className="text-sm text-gray-500">Aguardando resultados.</p>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => {
            const body = (
              <div className="space-y-2">
                {phase.groups.map((group, gi) => (
                  <GroupRanking key={group.name || gi} group={group} showName={phase.groups.length > 1 || Boolean(group.name)} />
                ))}
              </div>
            );
            if (!showPhaseHeaders) return <div key={phase.stageIndex}>{body}</div>;
            return (
              <V2Collapsible key={phase.stageIndex} tone="nested" title={`Fase ${phase.stageIndex + 1}`} badges={<V2Badge tone="neutral">{phase.typeLabel}</V2Badge>}>
                {body}
              </V2Collapsible>
            );
          })}
        </div>
      )}
    </V2Collapsible>
  );
}

export function V2TournamentRanking({ tournament }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  if (modalities.length === 0) {
    return <V2Surface className="text-center"><p className="py-6 text-sm text-gray-500">Sem modalidades.</p></V2Surface>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-3xl border border-acid/30 bg-acid/10 p-4 text-sm text-ink">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
        <div>
          <strong>Como funciona a classificação:</strong> a posição é definida pelo número de vitórias. Em caso de empate, valem na ordem:
          <strong> saldo de pontos</strong> (a favor − contra), <strong>pontos marcados</strong> e, por fim, <strong>menor número de pontos sofridos</strong>.
          Em torneios com fases e grupos, a classificação é mostrada por fase e por grupo.
        </div>
      </div>
      {modalities.map((m) => <V2ModalityRanking key={m.id} modality={m} />)}
    </div>
  );
}
