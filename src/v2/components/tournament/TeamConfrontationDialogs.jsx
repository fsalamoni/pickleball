/**
 * Os dois momentos do organizador num CONFRONTO de equipes — cada um no seu
 * diálogo, na ordem em que acontecem na quadra:
 *
 *  1. `TeamLineupDialog` — **INICIAR PARTIDA**: define a ESCALAÇÃO de cada
 *     ETAPA (quem joga a dupla masculina, a feminina, as mistas) e, no simples
 *     em rodízio, a ORDEM de entrada dos atletas.
 *  2. `TeamResultDialog` — **LANÇAR RESULTADO**: registra os GAMES (sets) de
 *     cada etapa, apura a etapa e, com elas, o confronto.
 *
 * São de uso EXCLUSIVO do admin do torneio (aba Resultados). A visão pública
 * usa `TeamConfrontationCard`, que não tem nenhum campo editável.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Repeat, Swords, Users, Wand2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Badge, V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import {
  TEAM_ETAPA_TYPE, TEAM_SINGLES_MODE,
  buildEtapaDrafts, etapaLineupSlots, etapasToPayload, etapaScoreIssues,
  computeEtapaResult, computeConfrontationResult, suggestSideLineup,
  validateConfrontationLineup, formatEtapaScoringLabel, confrontationLineupStatus,
} from '@/modules/tournament/domain/teamFormat';
import { useRecordConfrontation } from '@/modules/tournament/hooks/useTeams';

/* ----------------------------- compartilhado ----------------------------- */

/** Elenco de uma equipe como opções de escalação (chave estável por atleta). */
function rosterOptions(team, prefix) {
  const members = Array.isArray(team?.members) ? team.members : [];
  return members.map((m, idx) => ({
    id: m.user_id || `${prefix}${idx}`,
    name: m.name || `Atleta ${idx + 1}`,
    gender: m.gender || null,
  }));
}

const selCls = 'w-full rounded-xl border border-gray-200 bg-paper-pure px-2 py-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-acid/30';
const scoreCls = 'w-14 rounded-lg border border-gray-200 bg-paper-pure px-1 py-2 text-center text-sm tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-acid/30';

/**
 * Estado compartilhado pelos dois diálogos: o rascunho das etapas a partir do
 * confronto salvo, e o `salvar` que grava tudo (escalação + games).
 */
function useConfrontationDraft({ modality, match, teamA, teamB, onClose }) {
  const config = modality.team_config;
  const optsA = useMemo(() => rosterOptions(teamA, 'a'), [teamA]);
  const optsB = useMemo(() => rosterOptions(teamB, 'b'), [teamB]);
  const [etapas, setEtapas] = useState(() => buildEtapaDrafts(config, match));
  const record = useRecordConfrontation(modality.id);

  // Recarrega o rascunho quando o confronto salvo muda de conteúdo (o refetch
  // periódico devolve objetos novos e não pode apagar o que está sendo digitado).
  const savedSignature = useMemo(() => JSON.stringify(match?.etapas || []), [match?.etapas]);
  useEffect(() => {
    setEtapas(buildEtapaDrafts(config, match));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o gatilho é o conteúdo salvo, não a identidade dos objetos.
  }, [match?.id, savedSignature]);

  const genderById = useMemo(
    () => new Map([...optsA, ...optsB].map((o) => [o.id, o.gender])),
    [optsA, optsB],
  );

  const lineupCheck = useMemo(() => validateConfrontationLineup(
    etapas.filter((e) => (e.side_a || []).length || (e.side_b || []).length),
    config,
    optsA.map((o) => o.id),
    optsB.map((o) => o.id),
    genderById,
  ), [etapas, config, optsA, optsB, genderById]);

  const liveResult = useMemo(
    () => computeConfrontationResult({ etapas }, config),
    [etapas, config],
  );

  async function salvar(successMessage) {
    if (!lineupCheck.valid) {
      toast.error(lineupCheck.errors[0]);
      return false;
    }
    const validUids = [...(teamA?.members || []), ...(teamB?.members || [])]
      .map((m) => m.user_id)
      .filter(Boolean);
    try {
      await record.mutateAsync({
        matchId: match.id,
        etapas: etapasToPayload(etapas, config),
        config,
        rosterAIds: optsA.map((o) => o.id),
        rosterBIds: optsB.map((o) => o.id),
        genderById,
        validate: true,
        tournamentId: match.tournament_id || null,
        modalityId: modality.id,
        eventTitle: modality.name || 'Torneio',
        validUids,
      });
      toast.success(successMessage);
      onClose?.();
      return true;
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar o confronto.');
      return false;
    }
  }

  return { config, optsA, optsB, etapas, setEtapas, lineupCheck, liveResult, record, salvar };
}

/** Cabeçalho comum: as duas equipes e o placar em etapas. */
function ConfrontationHeading({ teamAName, teamBName, result }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
      <span className="text-sm font-bold text-ink">
        {teamAName} <span className="font-normal text-gray-400">vs</span> {teamBName}
      </span>
      <span className="font-display text-lg font-bold tabular-nums text-ink">
        {result.etapaWins.a} – {result.etapaWins.b}
      </span>
    </div>
  );
}

/* ------------------------ 1) INICIAR PARTIDA ----------------------------- */

export function TeamLineupDialog({ modality, match, teamA, teamB, open, onClose }) {
  const {
    config, optsA, optsB, etapas, setEtapas, lineupCheck, liveResult, record, salvar,
  } = useConfrontationDraft({ modality, match, teamA, teamB, onClose });

  const teamAName = teamA?.team_name || 'Equipe A';
  const teamBName = teamB?.team_name || 'Equipe B';
  const jaIniciada = confrontationLineupStatus(match, config, {
    rosterASize: optsA.length, rosterBSize: optsB.length,
  }).iniciada;

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

  function suggestLineup() {
    const a = suggestSideLineup(config, optsA);
    const b = suggestSideLineup(config, optsB);
    setEtapas((list) => list.map((e, i) => ({ ...e, side_a: a[i] || [], side_b: b[i] || [] })));
    toast.success('Escalação sugerida — ajuste o que precisar.');
  }

  function renderSide(etapa, ei, side, options) {
    const slots = etapaLineupSlots(etapa, config, options.length);
    const chosen = side === 'a' ? etapa.side_a : etapa.side_b;
    return (
      <div className="space-y-1">
        {slots.map((slot) => {
          const taken = (chosen || []).filter((_, i) => i !== slot.index);
          const candidates = options
            .filter((o) => !slot.gender || o.gender === slot.gender)
            .filter((o) => !taken.includes(o.id) || chosen[slot.index] === o.id);
          return (
            <label key={slot.index} className="flex items-center gap-2">
              <span className="w-[5.5rem] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {slot.label}
              </span>
              <select
                value={chosen[slot.index] || ''}
                onChange={(e) => setSlot(ei, side, slot.index, e.target.value)}
                aria-label={`${etapa.label} — ${side === 'a' ? teamAName : teamBName} — ${slot.label}`}
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> {jaIniciada ? 'Editar escalação' : 'Iniciar partida'}
          </DialogTitle>
          <DialogDescription>
            Defina quem joga cada etapa deste confronto. O placar é lançado depois,
            em “Lançar resultado”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ConfrontationHeading teamAName={teamAName} teamBName={teamBName} result={liveResult} />

          {config.singles_mode === TEAM_SINGLES_MODE.ROTATING
            && (config.etapas || []).some((e) => e.type === TEAM_ETAPA_TYPE.SINGLES) && (
            <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Repeat className="h-3.5 w-3.5" />
              No simples, todos jogam em rodízio: defina a ORDEM de entrada — troca a cada{' '}
              {config.singles_rotation_points} pontos.
            </p>
          )}

          <div className="space-y-3">
            {etapas.map((etapa, ei) => (
              <div key={etapa.id} className="rounded-2xl border border-gray-100 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-ink">{ei + 1}. {etapa.label}</span>
                  <V2Badge tone="neutral">{formatEtapaScoringLabel(etapa.scoring)}</V2Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">{teamAName}</div>
                    {renderSide(etapa, ei, 'a', optsA)}
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">{teamBName}</div>
                    {renderSide(etapa, ei, 'b', optsB)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {lineupCheck.errors.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> Confira a escalação
              </div>
              {lineupCheck.errors.map((msg) => <div key={msg}>• {msg}</div>)}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <V2Button variant="ghost" onClick={suggestLineup} disabled={record.isPending}>
            <Wand2 className="h-4 w-4" /> Escalação sugerida
          </V2Button>
          <V2Button variant="ghost" onClick={onClose} disabled={record.isPending}>Cancelar</V2Button>
          <V2Button
            onClick={() => salvar(jaIniciada ? 'Escalação atualizada.' : 'Partida iniciada — boa sorte!')}
            disabled={record.isPending || !lineupCheck.valid}
          >
            {record.isPending ? 'Salvando…' : jaIniciada ? 'Salvar escalação' : 'Iniciar partida'}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------ 2) LANÇAR RESULTADO ---------------------------- */

export function TeamResultDialog({
  modality, match, teamA, teamB, open, onClose, onEditLineup,
}) {
  const {
    config, optsA, optsB, etapas, setEtapas, lineupCheck, liveResult, record, salvar,
  } = useConfrontationDraft({ modality, match, teamA, teamB, onClose });

  const teamAName = teamA?.team_name || 'Equipe A';
  const teamBName = teamB?.team_name || 'Equipe B';
  const nameById = useMemo(
    () => new Map([...optsA, ...optsB].map((o) => [o.id, o.name])),
    [optsA, optsB],
  );
  const lineup = confrontationLineupStatus(match, config, {
    rosterASize: optsA.length, rosterBSize: optsB.length,
  });
  const scoreIssues = useMemo(
    () => etapas.flatMap((e) => etapaScoreIssues(e, config).map((msg) => `${e.label}: ${msg}`)),
    [etapas, config],
  );

  function setGame(ei, gi, side, value) {
    setEtapas((list) => list.map((e, idx) => {
      if (idx !== ei) return e;
      return { ...e, games: e.games.map((g, gidx) => (gidx === gi ? { ...g, [side]: value } : g)) };
    }));
  }

  const lineupText = (ids, etapa) => {
    const list = (ids || []).map((id) => nameById.get(id)).filter(Boolean);
    if (list.length === 0) return 'a definir';
    const rotation = etapa.type === TEAM_ETAPA_TYPE.SINGLES
      && config.singles_mode === TEAM_SINGLES_MODE.ROTATING;
    return rotation ? list.map((n, i) => `${i + 1}º ${n}`).join(' · ') : list.join(' / ');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" /> Lançar resultado
          </DialogTitle>
          <DialogDescription>
            Registre os games de cada etapa. O confronto é apurado pela regra da
            modalidade assim que as etapas necessárias forem decididas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ConfrontationHeading teamAName={teamAName} teamBName={teamBName} result={liveResult} />

          {!lineup.completa && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {lineup.iniciada
                  ? `${lineup.pendentes} etapa(s) ainda sem escalação completa.`
                  : 'Este confronto ainda não foi escalado.'}
              </span>
              {onEditLineup && (
                <V2Button size="sm" variant="ghost" onClick={onEditLineup}>
                  <Users className="h-4 w-4" /> {lineup.iniciada ? 'Editar escalação' : 'Iniciar partida'}
                </V2Button>
              )}
            </div>
          )}

          <div className="space-y-3">
            {etapas.map((etapa, ei) => {
              const res = computeEtapaResult(etapa, config);
              return (
                <div
                  key={etapa.id}
                  className={cn('rounded-2xl border p-3', res.decided ? 'border-acid/40 bg-acid/5' : 'border-gray-100')}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-ink">{ei + 1}. {etapa.label}</span>
                    <V2Badge tone="neutral">{formatEtapaScoringLabel(etapa.scoring)}</V2Badge>
                    {res.decided && (
                      <V2Badge tone="green">{res.winner === 'a' ? teamAName : teamBName}</V2Badge>
                    )}
                  </div>

                  <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                    <div className="text-xs text-gray-600">
                      <div className="font-semibold text-ink">{teamAName}</div>
                      {lineupText(etapa.side_a, etapa)}
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      {etapa.games.map((g, gi) => (
                        <div key={gi} className="flex items-center gap-1">
                          {etapa.games.length > 1 && (
                            <span className="w-10 text-right text-[10px] font-semibold uppercase text-gray-400">
                              Game {gi + 1}
                            </span>
                          )}
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
                        </div>
                      ))}
                      {etapa.games.length > 1 && (
                        <span className="text-[10px] text-gray-400">games {res.sets_a}–{res.sets_b}</span>
                      )}
                    </div>

                    <div className="text-xs text-gray-600 sm:text-right">
                      <div className="font-semibold text-ink">{teamBName}</div>
                      {lineupText(etapa.side_b, etapa)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3 text-xs">
            <span className="font-semibold text-gray-500">
              Etapas {liveResult.etapaWins.a}–{liveResult.etapaWins.b} · games {liveResult.sets.a}–{liveResult.sets.b} ·
              pontos {liveResult.points.a}–{liveResult.points.b}
            </span>
            {liveResult.decided && (
              <V2Badge tone={liveResult.winner ? 'green' : 'amber'}>
                {liveResult.winner
                  ? `Vencedor: ${liveResult.winner === 'a' ? teamAName : teamBName}`
                  : 'Empate em etapas'}
              </V2Badge>
            )}
          </div>

          {(scoreIssues.length > 0 || lineupCheck.errors.length > 0) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> Confira antes de salvar
              </div>
              {[...lineupCheck.errors, ...scoreIssues].map((msg) => <div key={msg}>• {msg}</div>)}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <V2Button variant="ghost" onClick={onClose} disabled={record.isPending}>Cancelar</V2Button>
          <V2Button
            onClick={() => salvar(liveResult.decided ? 'Confronto encerrado e classificação atualizada.' : 'Parcial salva.')}
            disabled={record.isPending || !lineupCheck.valid}
          >
            {record.isPending ? 'Salvando…' : 'Salvar resultado'}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
