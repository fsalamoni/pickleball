/**
 * Cartão de um CONFRONTO de equipes — SOMENTE LEITURA.
 *
 * É a peça da visão pública (e do resumo do organizador): mostra o confronto
 * fechado (equipes, placar em etapas, estado) e, ao ampliar, o detalhe de cada
 * ETAPA — quem jogou, os GAMES e quem venceu. Não existe nenhum campo editável
 * aqui: alterar escalação ou resultado é ação do organizador, no painel de
 * administração do torneio.
 */

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, Repeat, Swords,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import {
  TEAM_ETAPA_TYPE, TEAM_SINGLES_MODE,
  buildEtapaDrafts, computeEtapaResult, confrontationSnapshot,
  formatEtapaScoringLabel,
} from '@/modules/tournament/domain/teamFormat';

/** Nome de cada atleta do elenco, pela chave usada na escalação. */
function rosterNames(team, prefix) {
  const members = Array.isArray(team?.members) ? team.members : [];
  const map = new Map();
  members.forEach((m, idx) => map.set(m.user_id || `${prefix}${idx}`, m.name || `Atleta ${idx + 1}`));
  return map;
}

/** Escalação de um lado, em texto (com a ordem quando é rodízio). */
function LineupText({ ids = [], names, rotation, align = 'left' }) {
  const list = (ids || []).map((id) => names.get(id) || '—').filter(Boolean);
  if (list.length === 0) return <span className="text-xs text-gray-400">A definir</span>;
  return (
    <span className={cn('block text-xs text-gray-700', align === 'right' && 'text-right')}>
      {rotation ? list.map((n, i) => `${i + 1}º ${n}`).join(' · ') : list.join(' / ')}
    </span>
  );
}

const STAGE_TONE = {
  pendente: 'neutral',
  escalado: 'blue',
  em_andamento: 'amber',
  encerrado: 'green',
};

export default function TeamConfrontationCard({
  modality, match, teamA, teamB, defaultOpen = false,
}) {
  const config = modality.team_config;
  const [open, setOpen] = useState(defaultOpen);

  const namesA = useMemo(() => rosterNames(teamA, 'a'), [teamA]);
  const namesB = useMemo(() => rosterNames(teamB, 'b'), [teamB]);
  const etapas = useMemo(() => buildEtapaDrafts(config, match), [config, match]);
  const snapshot = useMemo(
    () => confrontationSnapshot(match, config, {
      rosterASize: (teamA?.members || []).length,
      rosterBSize: (teamB?.members || []).length,
    }),
    [match, config, teamA, teamB],
  );
  const { result } = snapshot;

  const teamAName = teamA?.team_name || 'A definir';
  const teamBName = teamB?.team_name || 'A definir';
  const rotationSingles = config.singles_mode === TEAM_SINGLES_MODE.ROTATING;

  return (
    <V2Surface className={cn('space-y-3 p-4', result.decided && 'border-acid/40')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Swords className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0 truncate font-bold text-ink">
            {teamAName} <span className="font-normal text-gray-400">vs</span> {teamBName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-lg font-bold tabular-nums text-ink">
            {result.etapaWins.a} – {result.etapaWins.b}
          </span>
          {result.decided && result.winner ? (
            <V2Badge tone="green">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              {result.winner === 'a' ? teamAName : teamBName}
            </V2Badge>
          ) : (
            <V2Badge tone={STAGE_TONE[snapshot.stage]}>{snapshot.label}</V2Badge>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {match.group && <V2Badge tone="neutral">{match.group}</V2Badge>}
            {match.court && <V2Badge tone="neutral">{match.court}</V2Badge>}
            {match.scheduled_at && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(match.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <V2Badge tone="neutral">
              {config.win_rule === 'best_of' ? `Melhor de ${config.win_target} etapas` : 'Todas as etapas'}
            </V2Badge>
            {rotationSingles && etapas.some((e) => e.type === TEAM_ETAPA_TYPE.SINGLES) && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Simples em rodízio: troca a cada {config.singles_rotation_points} pontos
              </span>
            )}
          </div>

          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="py-2 pr-2">Etapa</th>
                  <th className="py-2 pr-2">{teamAName}</th>
                  <th className="py-2 text-center">Games</th>
                  <th className="py-2 pl-2 text-right">{teamBName}</th>
                </tr>
              </thead>
              <tbody>
                {etapas.map((etapa) => {
                  const res = computeEtapaResult(etapa, config);
                  const rotation = etapa.type === TEAM_ETAPA_TYPE.SINGLES && rotationSingles;
                  const jogados = res.games;
                  return (
                    <tr key={etapa.id} className="border-t border-gray-100 align-top">
                      <td className="py-3 pr-2">
                        <div className="text-xs font-bold text-ink">{etapa.label}</div>
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          {formatEtapaScoringLabel(etapa.scoring)}
                        </div>
                        {res.decided && (
                          <V2Badge tone="green" className="mt-1">
                            {res.winner === 'a' ? teamAName : teamBName}
                          </V2Badge>
                        )}
                      </td>
                      <td className="py-3 pr-2">
                        <LineupText ids={etapa.side_a} names={namesA} rotation={rotation} />
                      </td>
                      <td className="py-3 text-center">
                        {jogados.length === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            {jogados.map((g, gi) => (
                              <span key={gi} className="font-display font-bold tabular-nums text-ink">
                                {g.a} × {g.b}
                              </span>
                            ))}
                            {jogados.length > 1 && (
                              <span className="text-[10px] text-gray-400">games {res.sets_a}–{res.sets_b}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pl-2">
                        <LineupText ids={etapa.side_b} names={namesB} rotation={rotation} align="right" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 text-xs font-semibold text-gray-500">
                  <td className="py-2">Pontos somados</td>
                  <td className="py-2 tabular-nums text-ink">{result.points.a}</td>
                  <td className="py-2 text-center tabular-nums text-gray-400">
                    {result.sets.a}–{result.sets.b} games
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink">{result.points.b}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </V2Surface>
  );
}
