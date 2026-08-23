/**
 * Painel de um CONFRONTO de equipes (Fase 4).
 *
 * - Admin: escala cada etapa (jogadores por lado, na ordem) e lança os placares;
 *   salva e apura o vencedor (regra "todas"/"melhor de X").
 * - Público: mesmas informações, somente leitura.
 *
 * As visões são independentes: o mesmo componente recebe `isAdmin` e alterna
 * entre edição e leitura, sem misturar responsabilidades.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Swords, CheckCircle2 } from 'lucide-react';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { COMPETITION_GENDER } from '@/modules/tournament/domain/constants';
import {
  TEAM_ETAPA_TYPE, TEAM_ETAPA_TYPE_LABELS, TEAM_SINGLES_MODE,
  etapaPlayersPerSide, etapaGenderNeeds, computeConfrontationResult,
} from '@/modules/tournament/domain/teamFormat';
import { useRecordConfrontation } from '@/modules/tournament/hooks/useTeams';

/** Opções de jogadores de uma equipe (chave estável: user_id ou índice). */
function rosterOptions(team, prefix) {
  const members = Array.isArray(team?.members) ? team.members : [];
  return members.map((m, idx) => ({
    key: m.user_id || `${prefix}${idx}`,
    name: m.name || `Atleta ${idx + 1}`,
    gender: m.gender || null,
  }));
}

/** Quantos seletores renderizar por lado para uma etapa. */
function slotsForEtapa(type, config, rosterSize) {
  if (type === TEAM_ETAPA_TYPE.SINGLES) {
    return config.singles_mode === TEAM_SINGLES_MODE.ROTATING ? Math.max(1, rosterSize) : 1;
  }
  return etapaPlayersPerSide(type);
}

/** Filtra opções por gênero exigido na posição (para duplas masc/fem/mista). */
function allowedForSlot(type, slotIndex, options) {
  const needs = etapaGenderNeeds(type);
  if (!needs) return options; // simples: livre
  if (type === TEAM_ETAPA_TYPE.MIXED_DOUBLES) {
    // slot 0 = masculino, slot 1 = feminino (convenção de exibição).
    const want = slotIndex === 0 ? COMPETITION_GENDER.MALE : COMPETITION_GENDER.FEMALE;
    return options.filter((o) => o.gender === want);
  }
  const want = needs.male > 0 ? COMPETITION_GENDER.MALE : COMPETITION_GENDER.FEMALE;
  return options.filter((o) => o.gender === want);
}

function initialEtapas(config, match) {
  const saved = Array.isArray(match?.etapas) ? match.etapas : [];
  return (config.etapas || []).map((spec, i) => {
    const prev = saved[i] || {};
    return {
      id: spec.id || `etapa_${i + 1}`,
      type: spec.type,
      label: spec.label || TEAM_ETAPA_TYPE_LABELS[spec.type],
      side_a: Array.isArray(prev.side_a) ? prev.side_a : [],
      side_b: Array.isArray(prev.side_b) ? prev.side_b : [],
      score_a: prev.score_a ?? '',
      score_b: prev.score_b ?? '',
    };
  });
}

const selCls = 'rounded-xl border border-gray-200 bg-paper px-2 py-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-acid/30';
const scoreCls = 'w-16 rounded-xl border border-gray-200 bg-paper px-2 py-2 text-center text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-acid/30';

export default function TeamConfrontationPanel({ modality, match, teamA, teamB, isAdmin }) {
  const config = modality.team_config;
  const optsA = useMemo(() => rosterOptions(teamA, 'a'), [teamA]);
  const optsB = useMemo(() => rosterOptions(teamB, 'b'), [teamB]);
  const nameByKey = useMemo(() => {
    const map = new Map();
    [...optsA, ...optsB].forEach((o) => map.set(o.key, o.name));
    return map;
  }, [optsA, optsB]);
  const [etapas, setEtapas] = useState(() => initialEtapas(config, match));
  const record = useRecordConfrontation(modality.id);

  const liveResult = useMemo(() => computeConfrontationResult({
    etapas: etapas.map((e) => ({
      ...e,
      score_a: e.score_a === '' ? null : Number(e.score_a),
      score_b: e.score_b === '' ? null : Number(e.score_b),
    })),
  }, config), [etapas, config]);

  function setSlot(ei, side, slot, key) {
    setEtapas((list) => list.map((e, idx) => {
      if (idx !== ei) return e;
      const arr = (side === 'a' ? e.side_a : e.side_b).slice();
      arr[slot] = key || undefined;
      const clean = arr.filter((x) => x != null);
      return { ...e, [side === 'a' ? 'side_a' : 'side_b']: clean };
    }));
  }
  function setScore(ei, side, val) {
    setEtapas((list) => list.map((e, idx) => (idx === ei ? { ...e, [side === 'a' ? 'score_a' : 'score_b']: val } : e)));
  }

  async function handleSave() {
    const genderById = new Map([...optsA, ...optsB].map((o) => [o.key, o.gender]));
    const payloadEtapas = etapas.map((e) => ({
      id: e.id,
      type: e.type,
      side_a: e.side_a,
      side_b: e.side_b,
      score_a: e.score_a === '' ? null : Number(e.score_a),
      score_b: e.score_b === '' ? null : Number(e.score_b),
    }));
    try {
      await record.mutateAsync({
        matchId: match.id,
        etapas: payloadEtapas,
        config,
        rosterAIds: optsA.map((o) => o.key),
        rosterBIds: optsB.map((o) => o.key),
        genderById,
        validate: true,
      });
      toast.success('Confronto salvo.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar o confronto.');
    }
  }

  const teamAName = teamA?.team_name || 'Equipe A';
  const teamBName = teamB?.team_name || 'Equipe B';

  const renderSide = (etapa, ei, side, opts) => {
    const size = slotsForEtapa(etapa.type, config, opts.length);
    const chosen = side === 'a' ? etapa.side_a : etapa.side_b;
    if (!isAdmin) {
      const names = chosen.map((k) => nameByKey.get(k) || '—');
      return <span className="text-xs text-gray-600">{names.length ? names.join(' / ') : '—'}</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: size }).map((_, slot) => {
          const allowed = allowedForSlot(etapa.type, slot, opts);
          return (
            <select key={slot} value={chosen[slot] || ''} onChange={(e) => setSlot(ei, side, slot, e.target.value)} className={selCls}>
              <option value="">—</option>
              {allowed.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
            </select>
          );
        })}
      </div>
    );
  };

  return (
    <V2Surface className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-ink">
          <Swords className="h-4 w-4" /> {teamAName} <span className="text-gray-400">vs</span> {teamBName}
        </div>
        <div className="flex items-center gap-2">
          <V2Badge tone="neutral">{liveResult.etapaWins.a} – {liveResult.etapaWins.b}</V2Badge>
          {liveResult.decided && liveResult.winner && (
            <V2Badge tone="green">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              {liveResult.winner === 'a' ? teamAName : teamBName}
            </V2Badge>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">
              <th className="py-2">Etapa</th>
              <th className="py-2">{teamAName}</th>
              <th className="py-2 text-center">Placar</th>
              <th className="py-2 text-right">{teamBName}</th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((etapa, ei) => (
              <tr key={etapa.id} className="border-t border-gray-50 align-top">
                <td className="py-2 pr-2 text-xs font-semibold text-ink">{etapa.label}</td>
                <td className="py-2 pr-2">{renderSide(etapa, ei, 'a', optsA)}</td>
                <td className="py-2 text-center">
                  {isAdmin ? (
                    <div className="flex items-center justify-center gap-1">
                      <input type="number" min="0" value={etapa.score_a} onChange={(e) => setScore(ei, 'a', e.target.value)} className={scoreCls} />
                      <span className="text-gray-400">×</span>
                      <input type="number" min="0" value={etapa.score_b} onChange={(e) => setScore(ei, 'b', e.target.value)} className={scoreCls} />
                    </div>
                  ) : (
                    <span className="font-display font-bold tabular-nums text-ink">{etapa.score_a === '' ? '–' : etapa.score_a} × {etapa.score_b === '' ? '–' : etapa.score_b}</span>
                  )}
                </td>
                <td className="py-2 pl-2 text-right">{renderSide(etapa, ei, 'b', optsB)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <V2Button size="sm" onClick={handleSave} disabled={record.isPending}>Salvar confronto</V2Button>
        </div>
      )}
    </V2Surface>
  );
}
