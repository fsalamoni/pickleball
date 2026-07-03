import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Info, Medal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AvatarGroup } from '@/components/ui/user-avatar';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { useModalities, useModalityRankingStructured } from '@/modules/tournament/hooks/useTournament';

export default function TournamentRankingTab({ tournament }) {
  const { data: modalities = [] } = useModalities(tournament.id);

  if (modalities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-500 text-center">
          Sem modalidades.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 flex items-start gap-2 text-sm text-green-800">
          <Info className="w-4 h-4 mt-0.5 text-green-700 shrink-0" />
          <div>
            <strong>Como funciona a classificação:</strong> a posição é definida pelo número de vitórias.
            Em caso de empate, valem na ordem: <strong>saldo de pontos</strong> (a favor − contra),
            <strong> pontos marcados</strong> e, por fim, <strong>menor número de pontos sofridos</strong>.
            Em torneios com fases e grupos, a classificação é mostrada por fase e por grupo.
          </div>
        </CardContent>
      </Card>
      {modalities.map((m) => (
        <ModalityRankingBlock key={m.id} modality={m} />
      ))}
    </div>
  );
}

const MEDAL_BY_POSITION = {
  1: { color: 'text-amber-500', label: 'Ouro' },
  2: { color: 'text-gray-400', label: 'Prata' },
  3: { color: 'text-amber-700', label: 'Bronze' },
};

const ROW_TONE_BY_POSITION = {
  1: 'bg-amber-50/70 hover:bg-amber-100/70',
  2: 'bg-paper/70 hover:bg-paper/70',
  3: 'bg-orange-50/60 hover:bg-orange-100/60',
};

function PositionCell({ position }) {
  const medal = MEDAL_BY_POSITION[position];
  return (
    <span className="inline-flex items-center gap-1 font-bold tabular-nums">
      {medal && <Medal className={`w-4 h-4 ${medal.color}`} aria-label={medal.label} />}
      {position}
    </span>
  );
}

export function ModalityRankingBlock({ modality }) {
  const { data, isLoading } = useModalityRankingStructured(modality.id);
  const phases = (data?.phases || []).filter((p) => p.played && p.groups.length > 0);
  const showPhaseHeaders = phases.length > 1;

  const subtitle = isLoading
    ? 'Carregando…'
    : phases.length === 0
      ? 'Aguardando resultados'
      : showPhaseHeaders
        ? `${phases.length} fases com resultados`
        : 'Classificação';

  return (
    <CollapsibleSection
      title={(
        <span className="inline-flex items-center gap-2">
          <Trophy className="w-4 h-4 text-green-600" /> {modality.name}
        </span>
      )}
      subtitle={subtitle}
      defaultOpen
    >
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
                  <GroupRanking
                    key={group.name || gi}
                    group={group}
                    showName={phase.groups.length > 1 || Boolean(group.name)}
                  />
                ))}
              </div>
            );
            if (!showPhaseHeaders) return <div key={phase.stageIndex}>{body}</div>;
            return (
              <CollapsibleSection
                key={phase.stageIndex}
                className="border-gray-200 bg-paper/40"
                headerClassName="py-1.5"
                title={`Fase ${phase.stageIndex + 1}`}
                badges={<Badge variant="secondary">{phase.typeLabel}</Badge>}
                defaultOpen
              >
                {body}
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}

function GroupRanking({ group, showName }) {
  return (
    <div>
      {showName && group.name && (
        <div className="text-xs font-semibold text-green-700 mb-1">{group.name}</div>
      )}
      <div className="hidden sm:block overflow-x-auto rounded-3xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-paper">
            <tr className="text-left">
              <th className="px-3 py-2">Pos.</th>
              <th className="px-3 py-2">Participante</th>
              <th className="px-3 py-2 text-center">PJ</th>
              <th className="px-3 py-2 text-center" title="Vitórias — critério principal">V</th>
              <th className="px-3 py-2 text-center">D</th>
              <th className="px-3 py-2 text-center">Sets (G–P)</th>
              <th className="px-3 py-2 text-center" title="Pontos a favor">PF</th>
              <th className="px-3 py-2 text-center" title="Pontos sofridos">PC</th>
              <th className="px-3 py-2 text-center" title="Saldo (PF − PC)">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => {
              const balance = (r.points_for || 0) - (r.points_against || 0);
              const tone = ROW_TONE_BY_POSITION[r.position] || '';
              return (
                <tr key={r.key} className={`border-t ${tone}`}>
                  <td className="px-3 py-2"><PositionCell position={r.position} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AvatarGroup size="sm" people={r.players || []} />
                      <span>{r.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{r.played}</td>
                  <td className="px-3 py-2 text-center font-semibold">{r.wins}</td>
                  <td className="px-3 py-2 text-center">{r.losses}</td>
                  <td className="px-3 py-2 text-center">{r.sets_won}–{r.sets_lost}</td>
                  <td className="px-3 py-2 text-center">{r.points_for}</td>
                  <td className="px-3 py-2 text-center">{r.points_against}</td>
                  <td className={`px-3 py-2 text-center font-medium ${balance > 0 ? 'text-green-700' : balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {balance > 0 ? `+${balance}` : balance}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 sm:hidden">
        {group.rows.map((r) => {
          const balance = (r.points_for || 0) - (r.points_against || 0);
          const tone = ROW_TONE_BY_POSITION[r.position] || 'bg-white';
          return (
            <div key={r.key} className={`rounded-2xl border border-gray-200 p-3 ${tone}`}>
              <div className="flex items-center gap-2">
                <PositionCell position={r.position} />
                <AvatarGroup size="sm" people={r.players || []} />
                <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
                <RankStat label="PJ" value={r.played} />
                <RankStat label="V" value={r.wins} strong />
                <RankStat label="D" value={r.losses} />
                <RankStat label="Sets" value={`${r.sets_won}–${r.sets_lost}`} />
                <RankStat label="PF" value={r.points_for} />
                <RankStat label="PC" value={r.points_against} />
                <RankStat
                  label="Saldo"
                  value={balance > 0 ? `+${balance}` : balance}
                  tone={balance > 0 ? 'text-green-700' : balance < 0 ? 'text-red-600' : 'text-gray-600'}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankStat({ label, value, strong, tone }) {
  return (
    <div className="rounded-lg bg-white/70 px-1 py-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-sm tabular-nums ${strong ? 'font-bold text-ink' : `font-medium ${tone || 'text-gray-600'}`}`}>{value}</div>
    </div>
  );
}
