/**
 * Classificação de EQUIPES (somente leitura) — usada nas visões admin e pública.
 *
 * Mostra UMA TABELA POR GRUPO quando a fase foi sorteada em grupos, e uma
 * tabela única em grupo único / pontos corridos. Tudo derivado de
 * `buildTeamGroupStandings` (domínio puro). Critérios, nesta ordem:
 * vitórias de confronto → saldo de etapas → saldo de pontos → confronto direto.
 */

import React, { useMemo } from 'react';
import { Medal, Trophy } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2EmptyState, V2Surface } from '@/v2/ui/primitives';
import { buildTeamGroupStandings } from '@/modules/tournament/services/teamService';

const ROW_TONE = { 1: 'bg-amber-50/70', 2: 'bg-gray-100/60', 3: 'bg-orange-50/50' };
const MEDAL_COLOR = { 1: 'text-amber-500', 2: 'text-gray-400', 3: 'text-amber-700' };

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

function GroupTable({ name, rows }) {
  return (
    <div className="space-y-2">
      {name && <div className="text-sm font-bold text-ink">{name}</div>}
      <V2Surface className="overflow-x-auto p-0">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Equipe</th>
              <th className="px-4 py-3 text-center" title="Confrontos disputados">CJ</th>
              <th className="px-4 py-3 text-center" title="Confrontos vencidos">V</th>
              <th className="px-4 py-3 text-center" title="Confrontos perdidos">D</th>
              <th className="px-4 py-3 text-center">Etapas (V–D)</th>
              <th className="px-4 py-3 text-center">Saldo etapas</th>
              <th className="px-4 py-3 text-center">Saldo pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const etapaBal = (r.etapa_wins || 0) - (r.etapa_losses || 0);
              const ptsBal = (r.points_for || 0) - (r.points_against || 0);
              const medal = MEDAL_COLOR[r.position];
              return (
                <tr key={r.team_id} className={cn('border-b border-gray-50 last:border-0', ROW_TONE[r.position])}>
                  <td className="px-4 py-3 font-bold text-ink">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {medal && <Medal className={cn('h-4 w-4', medal)} />}
                      {r.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">{r.team_name}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-gray-500">{r.confrontations_played}</td>
                  <td className="px-4 py-3 text-center font-semibold tabular-nums text-emerald-600">{r.confrontation_wins}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-gray-500">{r.confrontation_losses}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{r.etapa_wins}–{r.etapa_losses}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{signed(etapaBal)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{signed(ptsBal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </V2Surface>
    </div>
  );
}

export default function TeamStandingsTable({ matches = [], teamRegistrations = [], config = {}, singleGroup = false }) {
  const tables = useMemo(
    () => buildTeamGroupStandings({ matches, teamRegistrations, config, singleGroup })
      .filter((t) => t.rows.length > 0),
    [matches, teamRegistrations, config, singleGroup],
  );

  if (tables.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState
          icon={Trophy}
          title="Sem classificação ainda"
          description="A classificação aparece quando houver equipes e confrontos sorteados."
        />
      </V2Surface>
    );
  }

  return (
    <div className="space-y-4">
      {tables.map((t, i) => <GroupTable key={t.name || i} name={t.name} rows={t.rows} />)}
      <p className="text-[11px] leading-5 text-gray-400">
        Critérios de desempate: vitórias de confronto → saldo de etapas → saldo de pontos → confronto direto.
      </p>
    </div>
  );
}
