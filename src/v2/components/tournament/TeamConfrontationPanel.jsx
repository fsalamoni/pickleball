/**
 * Painel de um CONFRONTO de equipes: a escalação e o resultado de cada ETAPA.
 *
 * - Admin: escala cada etapa (respeitando o gênero que a etapa exige e a ordem
 *   do rodízio no simples) e lança o placar — game único ou melhor de 3/5,
 *   conforme a modalidade definiu para aquela etapa. Salva e apura o vencedor
 *   pela regra do confronto ("todas as etapas" ou "melhor de X").
 * - Público: as mesmas informações, somente leitura.
 *
 * As visões são independentes: o mesmo componente recebe `isAdmin` e alterna
 * entre edição e leitura, sem misturar responsabilidades.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Repeat, Swords, Wand2,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { MATCH_STATUS } from '@/modules/tournament/domain/constants';
import {
  TEAM_ETAPA_TYPE, TEAM_SINGLES_MODE,
  buildEtapaDrafts, etapaLineupSlots, etapasToPayload, etapaScoreIssues,
  computeEtapaResult, computeConfrontationResult, suggestSideLineup,
  validateConfrontationLineup, formatEtapaScoringLabel,
} from '@/modules/tournament/domain/teamFormat';
import { useRecordConfrontation } from '@/modules/tournament/hooks/useTeams';

/** Elenco de uma equipe como opções de escalação (chave estável por atleta). */
function rosterOptions(team, prefix) {
  const members = Array.isArray(team?.members) ? team.members : [];
  return members.map((m, idx) => ({
    id: m.user_id || `${prefix}${idx}`,
    name: m.name || `Atleta ${idx + 1}`,
    gender: m.gender || null,
  }));
}

/** Atletas do elenco que podem ocupar uma vaga da etapa. */
function candidatesForSlot(slot, options) {
  if (!slot.gender) return options;
  return options.filter((o) => o.gender === slot.gender);
}

const selCls = 'w-full min-w-[7.5rem] rounded-xl border border-gray-200 bg-paper-pure px-2 py-1.5 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-acid/30';
const scoreCls = 'w-12 rounded-lg border border-gray-200 bg-paper-pure px-1 py-1.5 text-center text-sm tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-acid/30';

/** Escalação de um lado numa etapa (edição ou leitura). */
function LineupSide({ etapa, slots, options, chosen, isAdmin, onPick, align = 'left' }) {
  const nameById = useMemo(() => new Map(options.map((o) => [o.id, o.name])), [options]);
  const isRotation = etapa.type === TEAM_ETAPA_TYPE.SINGLES && slots.length > 1;

  if (!isAdmin) {
    const names = (chosen || []).map((id) => nameById.get(id) || '—').filter(Boolean);
    if (names.length === 0) return <span className="text-xs text-gray-400">A definir</span>;
    return (
      <span className={cn('block text-xs text-gray-700', align === 'right' && 'text-right')}>
        {isRotation ? names.map((n, i) => `${i + 1}º ${n}`).join(' · ') : names.join(' / ')}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {slots.map((slot) => {
        const taken = (chosen || []).filter((_, i) => i !== slot.index);
        const candidates = candidatesForSlot(slot, options).filter(
          (o) => !taken.includes(o.id) || chosen[slot.index] === o.id,
        );
        return (
          <label key={slot.index} className="flex items-center gap-1.5">
            <span className="w-[4.5rem] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {slot.label}
            </span>
            <select
              value={chosen[slot.index] || ''}
              onChange={(e) => onPick(slot.index, e.target.value)}
              aria-label={`${etapa.label} — ${slot.label}`}
              className={selCls}
            >
              <option value="">—</option>
              {candidates.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        );
      })}
    </div>
  );
}

export default function TeamConfrontationPanel({
  modality, match, teamA, teamB, isAdmin, defaultOpen = false,
}) {
  const config = modality.team_config;
  const optsA = useMemo(() => rosterOptions(teamA, 'a'), [teamA]);
  const optsB = useMemo(() => rosterOptions(teamB, 'b'), [teamB]);
  const [open, setOpen] = useState(defaultOpen);
  const [etapas, setEtapas] = useState(() => buildEtapaDrafts(config, match));
  const record = useRecordConfrontation(modality.id);

  // Recarrega o rascunho SÓ quando o confronto salvo realmente muda (outra aba
  // salvou). A comparação é pelo conteúdo — o refetch periódico do React Query
  // devolve um objeto novo a cada 20s e não pode apagar o que o admin digitou.
  const savedSignature = useMemo(() => JSON.stringify(match?.etapas || []), [match?.etapas]);
  useEffect(() => {
    setEtapas(buildEtapaDrafts(config, match));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `match`/`config` mudam de identidade a cada refetch; o gatilho é o conteúdo salvo.
  }, [match?.id, savedSignature]);

  const liveResult = useMemo(
    () => computeConfrontationResult({ etapas }, config),
    [etapas, config],
  );

  const slotsByEtapa = useMemo(
    () => etapas.map((e) => ({
      a: etapaLineupSlots(e, config, optsA.length),
      b: etapaLineupSlots(e, config, optsB.length),
    })),
    [etapas, config, optsA.length, optsB.length],
  );

  const lineupCheck = useMemo(() => validateConfrontationLineup(
    etapas.filter((e) => (e.side_a || []).length || (e.side_b || []).length),
    config,
    optsA.map((o) => o.id),
    optsB.map((o) => o.id),
    new Map([...optsA, ...optsB].map((o) => [o.id, o.gender])),
  ), [etapas, config, optsA, optsB]);

  const scoreIssues = useMemo(
    () => etapas.flatMap((e) => etapaScoreIssues(e, config).map((msg) => `${e.label}: ${msg}`)),
    [etapas, config],
  );

  function setSlot(ei, side, slotIndex, id) {
    setEtapas((list) => list.map((e, idx) => {
      if (idx !== ei) return e;
      const key = side === 'a' ? 'side_a' : 'side_b';
      const arr = (e[key] || []).slice();
      while (arr.length <= slotIndex) arr.push(undefined);
      arr[slotIndex] = id || undefined;
      return { ...e, [key]: arr };
    }));
  }

  function setGame(ei, gi, side, value) {
    setEtapas((list) => list.map((e, idx) => {
      if (idx !== ei) return e;
      const games = e.games.map((g, gidx) => (gidx === gi ? { ...g, [side]: value } : g));
      return { ...e, games };
    }));
  }

  /** Escalação sugerida: distribui o elenco pelas etapas respeitando as regras. */
  function suggestLineup() {
    const a = suggestSideLineup(config, optsA);
    const b = suggestSideLineup(config, optsB);
    setEtapas((list) => list.map((e, i) => ({ ...e, side_a: a[i] || [], side_b: b[i] || [] })));
    toast.success('Escalação sugerida — ajuste o que precisar antes de salvar.');
  }

  async function handleSave() {
    if (!lineupCheck.valid) {
      toast.error(lineupCheck.errors[0]);
      return;
    }
    const payload = etapasToPayload(etapas, config);
    const validUids = [...(teamA?.members || []), ...(teamB?.members || [])]
      .map((m) => m.user_id)
      .filter(Boolean);
    try {
      await record.mutateAsync({
        matchId: match.id,
        etapas: payload,
        config,
        rosterAIds: optsA.map((o) => o.id),
        rosterBIds: optsB.map((o) => o.id),
        genderById: new Map([...optsA, ...optsB].map((o) => [o.id, o.gender])),
        validate: true,
        tournamentId: match.tournament_id || null,
        modalityId: modality.id,
        eventTitle: modality.name || 'Torneio',
        validUids,
      });
      toast.success(liveResult.decided ? 'Confronto encerrado e classificação atualizada.' : 'Parcial do confronto salva.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar o confronto.');
    }
  }

  const teamAName = teamA?.team_name || match.side_a_ids?.[0] || 'Equipe A';
  const teamBName = teamB?.team_name || match.side_b_ids?.[0] || 'Equipe B';
  const finished = match.status === MATCH_STATUS.FINISHED;
  const canEdit = isAdmin && Boolean(teamA) && Boolean(teamB);

  return (
    <V2Surface className={cn('space-y-3 p-4', liveResult.decided && 'border-acid/40')}>
      {/* Cabeçalho: equipes, placar em etapas e estado */}
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
            {liveResult.etapaWins.a} – {liveResult.etapaWins.b}
          </span>
          {liveResult.decided && liveResult.winner ? (
            <V2Badge tone="green">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              {liveResult.winner === 'a' ? teamAName : teamBName}
            </V2Badge>
          ) : liveResult.decided ? (
            /* Empate em etapas: só existe em "todas as etapas" com nº par —
               numa chave, o organizador precisa desempatar. */
            <V2Badge tone="amber">Empate em etapas</V2Badge>
          ) : finished ? (
            <V2Badge tone="neutral">Encerrado</V2Badge>
          ) : (
            <V2Badge tone="neutral">
              {liveResult.etapasDecided}/{liveResult.etapasTotal} etapas
            </V2Badge>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <V2Badge tone="neutral">
              {config.win_rule === 'best_of' ? `Melhor de ${config.win_target} etapas` : 'Todas as etapas'}
            </V2Badge>
            {match.group && <V2Badge tone="neutral">{match.group}</V2Badge>}
            {match.court && <V2Badge tone="neutral">{match.court}</V2Badge>}
            {config.etapas?.some((e) => e.type === TEAM_ETAPA_TYPE.SINGLES)
              && config.singles_mode === TEAM_SINGLES_MODE.ROTATING && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Simples em rodízio: troca a cada {config.singles_rotation_points} pontos
              </span>
            )}
          </div>

          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="py-2 pr-2">Etapa</th>
                  <th className="py-2 pr-2">{teamAName}</th>
                  <th className="py-2 text-center">Games</th>
                  <th className="py-2 pl-2 text-right">{teamBName}</th>
                </tr>
              </thead>
              <tbody>
                {etapas.map((etapa, ei) => {
                  const res = computeEtapaResult(etapa, config);
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
                        <LineupSide
                          etapa={etapa}
                          slots={slotsByEtapa[ei].a}
                          options={optsA}
                          chosen={etapa.side_a}
                          isAdmin={canEdit}
                          onPick={(slot, id) => setSlot(ei, 'a', slot, id)}
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col items-center gap-1">
                          {etapa.games.map((g, gi) => (
                            <div key={gi} className="flex items-center gap-1">
                              {etapa.games.length > 1 && (
                                <span className="w-4 text-[10px] font-semibold text-gray-400">{gi + 1}</span>
                              )}
                              {canEdit ? (
                                <>
                                  <input
                                    type="number" min="0" inputMode="numeric"
                                    value={g.a}
                                    onChange={(e) => setGame(ei, gi, 'a', e.target.value)}
                                    aria-label={`${etapa.label} — game ${gi + 1}, ${teamAName}`}
                                    className={scoreCls}
                                  />
                                  <span className="text-gray-300">×</span>
                                  <input
                                    type="number" min="0" inputMode="numeric"
                                    value={g.b}
                                    onChange={(e) => setGame(ei, gi, 'b', e.target.value)}
                                    aria-label={`${etapa.label} — game ${gi + 1}, ${teamBName}`}
                                    className={scoreCls}
                                  />
                                </>
                              ) : (
                                <span className="font-display font-bold tabular-nums text-ink">
                                  {g.a === '' || g.a == null ? '–' : g.a} × {g.b === '' || g.b == null ? '–' : g.b}
                                </span>
                              )}
                            </div>
                          ))}
                          {etapa.games.length > 1 && (
                            <span className="text-[10px] text-gray-400">
                              games {res.sets_a}–{res.sets_b}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pl-2">
                        <div className="flex justify-end">
                          <LineupSide
                            etapa={etapa}
                            slots={slotsByEtapa[ei].b}
                            options={optsB}
                            chosen={etapa.side_b}
                            isAdmin={canEdit}
                            onPick={(slot, id) => setSlot(ei, 'b', slot, id)}
                            align="right"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 text-xs font-semibold text-gray-500">
                  <td className="py-2">Pontos somados</td>
                  <td className="py-2 tabular-nums text-ink">{liveResult.points.a}</td>
                  <td className="py-2 text-center tabular-nums text-gray-400">
                    {liveResult.sets.a}–{liveResult.sets.b} games
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink">{liveResult.points.b}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {canEdit && (lineupCheck.errors.length > 0 || scoreIssues.length > 0) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> Confira antes de salvar
              </div>
              {[...lineupCheck.errors, ...scoreIssues].map((msg) => <div key={msg}>• {msg}</div>)}
            </div>
          )}

          {isAdmin && !canEdit && (
            <p className="text-xs text-gray-500">
              Uma das equipes ainda não está definida (aguarda o resultado da fase anterior).
            </p>
          )}

          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              <V2Button size="sm" variant="ghost" onClick={suggestLineup}>
                <Wand2 className="h-4 w-4" /> Escalação sugerida
              </V2Button>
              <V2Button size="sm" onClick={handleSave} disabled={record.isPending || !lineupCheck.valid}>
                {record.isPending ? 'Salvando…' : 'Salvar confronto'}
              </V2Button>
            </div>
          )}
        </>
      )}
    </V2Surface>
  );
}
