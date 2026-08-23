/**
 * Classificação de EQUIPES (somente leitura) — usada nas visões admin e pública.
 * Deriva tudo de `buildTeamStandingsFromMatches` (domínio puro). Critérios:
 * vitórias de confronto → saldo de etapas → saldo de pontos → confronto direto.
 */

import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { V2EmptyState, V2Surface } from '@/v2/ui/primitives';
import { buildTeamStandingsFromMatches } from '@/modules/tournament/services/teamService';

export default function TeamStandingsTable({ matches = [], teamRegistrations = [], config = {} }) {
  const rows = useMemo(
    () => buildTeamStandingsFromMatches({ matches, teamRegistrations, config }),
    [matches, teamRegistrations, config],
  );

  if (rows.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState icon={Trophy} title="Sem classificação ainda" description="A classificação aparece quando houver equipes e confrontos." />
      </V2Surface>
    );
  }

  return (
    <V2Surface className="overflow-x-auto p-0">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Equipe</th>
            <th className="px-4 py-3 text-center">Conf. V</th>
            <th className="px-4 py-3 text-center">Conf. D</th>
            <th className="px-4 py-3 text-center">Etapas (V–D)</th>
            <th className="px-4 py-3 text-center">Saldo etapas</th>
            <th className="px-4 py-3 text-center">Saldo pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const etapaBal = (r.etapa_wins || 0) - (r.etapa_losses || 0);
            const ptsBal = (r.points_for || 0) - (r.points_against || 0);
            return (
              <tr key={r.team_id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-bold text-ink">{r.position}</td>
                <td className="px-4 py-3 font-semibold text-ink">{r.team_name}</td>
                <td className="px-4 py-3 text-center tabular-nums text-emerald-600 font-semibold">{r.confrontation_wins}</td>
                <td className="px-4 py-3 text-center tabular-nums text-gray-500">{r.confrontation_losses}</td>
                <td className="px-4 py-3 text-center tabular-nums">{r.etapa_wins}–{r.etapa_losses}</td>
                <td className="px-4 py-3 text-center tabular-nums">{etapaBal > 0 ? `+${etapaBal}` : etapaBal}</td>
                <td className="px-4 py-3 text-center tabular-nums">{ptsBal > 0 ? `+${ptsBal}` : ptsBal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </V2Surface>
  );
}
