import React, { useMemo } from 'react';
import { ArrowDownToLine, AlertTriangle, SkipForward, LifeBuoy } from 'lucide-react';

import { normalizePhases } from '@/modules/tournament/domain/phases';
import { resolveStageScoringConfig } from '@/modules/tournament/domain/scoring';
import { rankEntrantsInGroup } from '@/modules/tournament/domain/phaseProgression';
import { headToHeadFromMatches } from '@/modules/tournament/domain/ranking';
import { planDirectEntries } from '@/modules/tournament/domain/directEntry';
import { registrationsToEntrants } from '@/modules/tournament/domain/registrationEntrant';
import { previewPhaseAdvance, describePhaseAdvance } from '@/modules/tournament/domain/phaseAdvancePreview';
import { MATCH_STATUS } from '@/modules/tournament/domain/constants';

const CONCLUIDOS = new Set([MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER]);

/** Reconstrói os grupos da fase do jeito que o serviço reconstrói. */
function gruposDaFase(storedGroups, matches, entrantById) {
  if (storedGroups.length > 0) {
    return storedGroups.map((g) => ({
      name: g.name,
      entrants: (Array.isArray(g.entrants) && g.entrants.length > 0)
        ? g.entrants
        : (g.participants || []).map((id) => entrantById.get(id) || { id, members: [id] }),
    }));
  }
  // Fase de grupo único: os participantes saem dos próprios jogos.
  const ids = new Set();
  matches.forEach((m) => {
    (m.side_a_ids || []).forEach((id) => ids.add(id));
    (m.side_b_ids || []).forEach((id) => ids.add(id));
  });
  if (ids.size === 0) return [];
  return [{
    name: 'Grupo único',
    entrants: [...ids].map((id) => entrantById.get(id) || { id, members: [id] }),
  }];
}

function Lista({ Icon, tone, titulo, nomes }) {
  if (nomes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
        {titulo}:
      </span>
      <span className="text-gray-700">{nomes.join(', ')}</span>
    </div>
  );
}

/**
 * Quem vai para a próxima fase — ANTES de clicar em "Gerar próxima fase".
 *
 * Esse botão é o mais irreversível do torneio: classifica os grupos pela ordem
 * de desempate configurada, compara quem veio de grupos de tamanhos
 * diferentes, chama os repescados, encaixa quem entra direto e sorteia a fase
 * seguinte — tudo de uma vez. Antes não dizia nada: quem organizava clicava no
 * escuro e descobria o resultado depois de gravado.
 *
 * A conta sai de `previewPhaseAdvance`, a MESMA função que o serviço usa para
 * gravar. O que está escrito aqui é o que vai acontecer — não uma segunda
 * implementação que pode divergir (é a lição do dia de jogo, em que a previsão
 * anunciava uma partida e o sorteio criava outra).
 */
export default function NextPhasePreview({
  tournament, modality, stageIndex, matches = [], groups = [], registrations = [],
}) {
  const isTeam = Boolean(modality?.team_config);

  const preview = useMemo(() => {
    const phases = normalizePhases(modality?.stages);
    const prevPhase = phases[stageIndex];
    const nextPhase = phases[stageIndex + 1];
    if (!prevPhase || !nextPhase) return null;

    const decididos = matches.filter((m) => CONCLUIDOS.has(m.status));
    if (decididos.length === 0) return null;

    const entrants = registrationsToEntrants(registrations, { isTeam });
    const entrantById = new Map(entrants.map((e) => [e.id, e]));
    const scoringConfig = resolveStageScoringConfig(modality, tournament, stageIndex);

    const base = gruposDaFase(groups, decididos, entrantById);
    if (base.length === 0) return null;

    const rankedGroups = base.map((g, i) => {
      const memberSet = new Set(g.entrants.flatMap((e) => e.members || [e.id]));
      const groupMatches = decididos.filter((m) => (
        m.group ? m.group === g.name : (m.side_a_ids || []).some((id) => memberSet.has(id))
      ));
      return {
        index: i,
        name: g.name,
        ranked: rankEntrantsInGroup(g.entrants, groupMatches, scoringConfig, {
          teamConfig: modality.team_config || null,
          tiebreakOrder: prevPhase.tiebreak_order,
        }),
        headToHead: headToHeadFromMatches(groupMatches, scoringConfig),
      };
    });

    const { byPhase } = planDirectEntries(entrants, phases);
    return previewPhaseAdvance({
      rankedGroups,
      prevPhase,
      nextPhase,
      // Semente estável: a prévia não pode dançar a cada renderização.
      seed: `previa_${modality.id}_${stageIndex + 1}`,
      directEntrants: byPhase.get(stageIndex + 1) || [],
      isTeam,
    });
  }, [tournament, modality, stageIndex, matches, groups, registrations, isTeam]);

  if (!preview) return null;

  const parcial = matches.some((m) => !CONCLUIDOS.has(m.status));

  return (
    <div
      className={`rounded-md border p-2.5 text-xs ${preview.blocked
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-sky-200 bg-sky-50 text-sky-950'}`}
    >
      <div className="flex items-start gap-2">
        {preview.blocked
          ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          : <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />}
        <div className="min-w-0 space-y-1.5">
          <p className="font-semibold">
            {preview.blocked ? 'A próxima fase ainda não pode ser gerada' : describePhaseAdvance(preview, { isTeam })}
          </p>

          {preview.blocked && <p className="leading-snug">{preview.blocked.message}</p>}

          {preview.counts.total > 0 && (
            <div className="space-y-1">
              <Lista
                Icon={ArrowDownToLine}
                tone="text-sky-800"
                titulo="Classificados"
                nomes={preview.names.qualifiers}
              />
              <Lista
                Icon={LifeBuoy}
                tone="text-emerald-800"
                titulo="Por repescagem"
                nomes={preview.names.wildcards}
              />
              <Lista
                Icon={SkipForward}
                tone="text-violet-800"
                titulo="Entram direto"
                nomes={preview.names.directs}
              />
            </div>
          )}

          {parcial && (
            <p className="text-[11px] leading-snug opacity-80">
              Ainda há jogos por decidir nesta fase — esta prévia considera só os resultados já
              lançados e vai mudar até o último jogo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
