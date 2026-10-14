/**
 * A coleção de troféus de uma pessoa — DERIVADA do que já está no banco.
 *
 * Dois tipos, separados de propósito (um título de torneio e uma vitória no
 * dia de jogo de terça não são a mesma coisa):
 *  - `torneio`: colocação final (1º, 2º, 3º) numa categoria ENCERRADA, pela
 *    mesma conta do ranking da casa (`modalityPodium`);
 *  - `dia_de_jogo`: colocação no ranking do dia de um dia de jogo PUBLICADO no
 *    ranking, por tipo de jogo (duplas e simples são dois rankings).
 *
 * PURO. Sem React, sem Firebase.
 */
import { instanteEmMs, instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { gameDayHouseEvents } from '@/modules/arenas/domain/houseRanking.js';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants.js';
import { modalityPodium, PODIUM_PLACE } from '@/modules/tournament/domain/podium.js';
import { t, tk } from '@/core/i18n';

export const TROPHY_KIND = Object.freeze({ TOURNAMENT: 'torneio', GAME_DAY: 'dia_de_jogo' });

export const TROPHY_KIND_LABEL = Object.freeze({
  [TROPHY_KIND.TOURNAMENT]: tk('Torneios'),
  [TROPHY_KIND.GAME_DAY]: tk('Dias de jogo'),
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
  return trofeu.kind === TROPHY_KIND.TOURNAMENT
    ? `trofeu:${trofeu.tournamentId}:${trofeu.modalityId}:${trofeu.position}`
    : `trofeu:gd:${trofeu.gameDayId}${trofeu.gameKind ? `:${trofeu.gameKind}` : ''}:${trofeu.position}`;
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

/** Um documento do espelho (`club_event_games`) no formato do ranking do dia. */
function espelhoParaJogo(m) {
  const porSets = Array.isArray(m.set_scores) && m.set_scores.length > 1;
  return {
    id: m.id,
    kind: m.kind,
    side_a: (m.side_a_ids || []).map((id) => ({ id })),
    side_b: (m.side_b_ids || []).map((id) => ({ id })),
    score_a: porSets ? m.sets_a : m.score_a,
    score_b: porSets ? m.sets_b : m.score_b,
    ...(porSets ? { sets: m.set_scores, points_a: m.score_a, points_b: m.score_b } : {}),
  };
}

/**
 * Os troféus de DIA DE JOGO de `uid`: para cada dia publicado em que jogou,
 * a colocação no ranking do dia (1º a 3º), por tipo de jogo.
 *
 * @param {string} uid
 * @param {Map<string, object[]>} espelhoPorEvento TODOS os jogos publicados de cada dia
 * @param {Map<string, string>} [nomePorUid]
 */
export function gameDayTrophies(uid, espelhoPorEvento, nomePorUid = new Map()) {
  const out = [];
  (espelhoPorEvento || new Map()).forEach((docs, eventId) => {
    const lista = (docs || []).filter((m) => m?.winner_side === 'a' || m?.winner_side === 'b');
    if (lista.length === 0) return;
    const modular = lista.every((m) => m.source === 'athlete_game_day');
    const ids = new Set();
    lista.forEach((m) => [...(m.side_a_ids || []), ...(m.side_b_ids || [])].forEach((x) => ids.add(x)));
    if (!ids.has(uid)) return;
    const participants = [...ids].map((id) => ({ id, user_id: id, name: nomePorUid.get(id) || t('Atleta') }));
    const date = Math.max(...lista.map((m) => ms(m.result_recorded_at) || ms(m.created_at)));
    const gameDay = { id: eventId, title: lista[0].event_title || t('Dia de jogo'), date };
    gameDayHouseEvents({ gameDay, participants, games: lista.map(espelhoParaJogo) }).forEach((ev) => {
      const eu = ev.entries.find((e) => e.user_id === uid);
      if (!eu || eu.position > 3) return;
      const empatados = ev.entries.filter((e) => e.position === eu.position).length;
      out.push({
        id: `gd:${eventId}:${ev.gameKind || 'duplas'}:${eu.position}`,
        kind: TROPHY_KIND.GAME_DAY,
        position: eu.position,
        placeLabel: t(PODIUM_PLACE[eu.position].um),
        title: lista[0].event_title || t('Dia de jogo'),
        subtitle: ev.gameKind ? (ev.gameKind === 'singles' ? t('Ranking do dia · simples') : t('Ranking do dia · duplas')) : t('Ranking do dia'),
        date,
        link: modular ? `/dia-de-jogo/${eventId}` : null,
        publicLink: null,
        gameDayId: eventId,
        gameKind: ev.gameKind || null,
        people: [{ user_id: uid, name: nomePorUid.get(uid) || t('Atleta'), photo_url: null }],
        record: { played: eu.played, won: eu.won, decidedGames: ev.decidedGames, players: ev.entries.length },
        shared: empatados > 1,
      });
    });
  });
  return out.sort((a, b) => b.date - a.date || a.position - b.position);
}

/**
 * A coleção agrupada para a estante: por tipo, com as contagens por metal.
 * Fonte que FALHOU chega como `undefined` e a estante diz que ficou de fora.
 */
export function groupTrophies({ torneios, diasDeJogo } = {}) {
  const conta = (lista) => ({
    ouro: (lista || []).filter((t) => t.position === 1).length,
    prata: (lista || []).filter((t) => t.position === 2).length,
    bronze: (lista || []).filter((t) => t.position === 3).length,
    total: (lista || []).length,
  });
  const tudo = [...(torneios || []), ...(diasDeJogo || [])];
  return {
    torneios: torneios || [],
    diasDeJogo: diasDeJogo || [],
    faltou: [torneios === undefined && t('os torneios'), diasDeJogo === undefined && t('os dias de jogo')].filter(Boolean),
    contagem: { ...conta(tudo), torneios: conta(torneios), diasDeJogo: conta(diasDeJogo) },
    destaque: [...tudo].sort((a, b) => a.position - b.position || b.date - a.date)[0] || null,
  };
}
