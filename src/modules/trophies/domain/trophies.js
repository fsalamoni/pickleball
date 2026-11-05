/**
 * A coleção de troféus de uma pessoa — DERIVADA do que já está no banco.
 *
 * Só TORNEIO tem troféu: a colocação final (1º, 2º, 3º) numa categoria
 * ENCERRADA, pela mesma conta do ranking da casa (`modalityPodium`).
 *
 * ⭐ Dia de jogo NÃO é torneio e não tem medalha, ainda que tenha ranking do
 * dia (decisão do dono, 2026-11-05). O ranking do dia continua no próprio dia;
 * ele só não vira troféu, cartão de campeão nem pódio na carreira.
 *
 * PURO. Sem React, sem Firebase.
 */
import { instanteEmMs, instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants.js';
import { modalityPodium, PODIUM_PLACE } from '@/modules/tournament/domain/podium.js';
import { t, tk } from '@/core/i18n';

export const TROPHY_KIND = Object.freeze({ TOURNAMENT: 'torneio' });

export const TROPHY_KIND_LABEL = Object.freeze({
  [TROPHY_KIND.TOURNAMENT]: tk('Torneios'),
});

const ms = (v) => {
  const n = instanteEmMs(v);
  return Number.isFinite(n) ? n : 0;
};

/** Data do torneio ("2026-10-12" é o dia LOCAL, não meia-noite UTC). */
const dia = (v) => {
  const n = instanteDoDiaEmMs(v);
  return Number.isFinite(n) ? n : 0;
};

/** Id do troféu e `contextId` do kudo de parabéns: um por conquista, por pessoa. */
export function trophyContextId(trofeu) {
  if (!trofeu) return '';
  return `trofeu:${trofeu.tournamentId}:${trofeu.modalityId}:${trofeu.position}`;
}

/**
 * Os troféus de TORNEIO de `uid`.
 *
 * @param {string} uid
 * @param {{
 *   registrations: object[],                       as inscrições da pessoa
 *   tournamentById: Map<string, object>,
 *   modalityById: Map<string, object>,
 *   matchesByModality: Map<string, object[]>,      TODAS as fases
 *   registrationsByModality: Map<string, object[]> para os nomes da dupla/equipe
 * }} ctx
 */
export function tournamentTrophies(uid, ctx) {
  const out = [];
  const vistos = new Set();
  (ctx?.registrations || []).forEach((reg) => {
    const tournament = ctx.tournamentById?.get(reg.tournament_id);
    const modality = ctx.modalityById?.get(reg.modality_id);
    if (!tournament || !modality) return;
    if (tournament.status !== TOURNAMENT_STATUS.FINISHED || tournament.archived) return;
    const podio = modalityPodium({
      modality, tournament,
      matches: ctx.matchesByModality?.get(modality.id) || [],
      registrations: ctx.registrationsByModality?.get(modality.id) || [reg],
    });
    if (!podio.complete) return;
    podio.places.forEach((place) => {
      // A inscrição da pessoa, conferida pela CONTA (não pela lista recebida):
      // é o que impede o troféu de outra dupla cair na estante errada.
      const entry = place.entries.find((e) => e.registrationId === String(reg.id)
        && e.people.some((p) => p.user_id === uid));
      if (!entry) return;
      const id = `t:${tournament.id}:${modality.id}:${place.position}`;
      if (vistos.has(id)) return;
      vistos.add(id);
      out.push({
        id,
        kind: TROPHY_KIND.TOURNAMENT,
        position: place.position,
        placeLabel: t(entry.people.length > 1 ? PODIUM_PLACE[place.position].varios : PODIUM_PLACE[place.position].um),
        title: tournament.name || t('Torneio'),
        subtitle: modality.name || t('Categoria'),
        date: dia(tournament.ends_at) || dia(tournament.starts_at),
        city: tournament.city || '', state: tournament.state || '',
        link: `/torneios/${tournament.id}`,
        publicLink: `/p/${tournament.id}`,
        tournamentId: tournament.id,
        modalityId: modality.id,
        arenaId: tournament.arena_id || null,
        people: entry.people,
        shared: place.entries.length > 1,
      });
    });
  });
  return out.sort((a, b) => b.date - a.date || a.position - b.position);
}

/**
 * A coleção agrupada para a estante, com as contagens por metal. A lista que
 * FALHOU chega como `undefined` e a estante diz que ficou de fora.
 */
export function groupTrophies({ torneios } = {}) {
  const lista = torneios || [];
  const conta = (p) => lista.filter((x) => x.position === p).length;
  return {
    torneios: lista,
    faltou: torneios === undefined ? [t('os torneios')] : [],
    contagem: { ouro: conta(1), prata: conta(2), bronze: conta(3), total: lista.length },
    destaque: [...lista].sort((a, b) => a.position - b.position || b.date - a.date)[0] || null,
  };
}
