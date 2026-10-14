/**
 * O PÓDIO de uma categoria de torneio — fonte ÚNICA de "quem ficou em 1º, 2º
 * e 3º" (ranking da casa, cartões de campeões, coleção de troféus).
 *
 * Mata-mata: 1º quem venceu a final, 2º quem perdeu; 3º e 4º pela disputa de
 * 3º lugar, ou — sem ela — os dois semifinalistas dividem o 3º. Contar
 * vitórias no lugar da chave daria o título a quem ganhou mais jogos na fase
 * de grupos, e não a quem venceu a final.
 *
 * Qualquer outra estrutura (pontos corridos, grupos, suíço, americana,
 * mexicano, dupla eliminação): a classificação oficial da ÚLTIMA fase, com os
 * critérios de desempate da plataforma (`buildRanking`).
 *
 * PURO. Sem React, sem Firebase.
 */
import { buildRanking } from './ranking.js';
import { resolveStageScoringConfig } from './scoring.js';
import { normalizePhases } from './phases.js';
import { isMatchDecided, matchLoserIds, matchWinnerIds } from './progression.js';
import { MATCH_STATUS, TOURNAMENT_STAGE_TYPE, rotulos } from './constants.js';
import { isModalityComplete } from './tournamentCompletion.js';
import { t, tk } from '@/core/i18n';

function idsDoLado(m, lado) {
  const ids = m?.[lado === 'a' ? 'side_a_ids' : 'side_b_ids'];
  if (Array.isArray(ids) && ids.length > 0) return ids.map(String).filter(Boolean);
  const bruto = m?.[lado === 'a' ? 'side_a' : 'side_b'];
  if (bruto == null) return [];
  if (Array.isArray(bruto)) return bruto.map(String).filter(Boolean);
  return String(bruto).split('+').map((s) => s.trim()).filter(Boolean);
}

/** O jogo aconteceu de verdade (dois lados, resultado) — bye e W.O. não. */
function jogouDeVerdade(m) {
  return m?.status === MATCH_STATUS.FINISHED
    && idsDoLado(m, 'a').length > 0 && idsDoLado(m, 'b').length > 0
    && matchWinnerIds(m) != null;
}

/**
 * A colocação final de UMA categoria de torneio.
 *
 * @returns {Map<string, { position: number|null, played: number, won: number }>}
 *   chave = id da inscrição
 */
export function modalityPlacement({ modality = null, tournament = null, matches = [] } = {}) {
  const saida = new Map();
  const garante = (id) => {
    if (!saida.has(id)) saida.set(id, { position: null, played: 0, won: 0 });
    return saida.get(id);
  };

  const daCategoria = (matches || []).filter((m) => !modality?.id || !m.modality_id || m.modality_id === modality.id);
  daCategoria.filter(jogouDeVerdade).forEach((m) => {
    const vencedores = new Set(matchWinnerIds(m) || []);
    [...idsDoLado(m, 'a'), ...idsDoLado(m, 'b')].forEach((id) => {
      const s = garante(id);
      s.played += 1;
      if (vencedores.has(id)) s.won += 1;
    });
  });

  const decididos = daCategoria.filter((m) => isMatchDecided(m));
  if (decididos.length === 0) return saida;

  const ultimaFase = Math.max(...decididos.map((m) => Number(m.stage_index ?? 0) || 0));
  const naUltima = decididos.filter((m) => (Number(m.stage_index ?? 0) || 0) === ultimaFase);
  const fases = normalizePhases(modality?.stages);
  const tipo = fases[ultimaFase]?.type;

  const coloca = (ids, posicao) => (ids || []).forEach((id) => {
    const s = garante(String(id));
    if (s.position == null || posicao < s.position) s.position = posicao;
  });

  if (tipo === TOURNAMENT_STAGE_TYPE.KNOCKOUT) {
    const principais = naUltima.filter((m) => !m.third_place);
    const ultimaRodada = Math.max(0, ...principais.map((m) => Number(m.round) || 1));
    const finais = principais.filter((m) => (Number(m.round) || 1) === ultimaRodada);
    if (finais.length === 1) {
      coloca(matchWinnerIds(finais[0]), 1);
      coloca(matchLoserIds(finais[0]), 2);
      const terceiro = naUltima.find((m) => m.third_place);
      if (terceiro) {
        coloca(matchWinnerIds(terceiro), 3);
        coloca(matchLoserIds(terceiro), 4);
      } else {
        principais
          .filter((m) => (Number(m.round) || 1) === ultimaRodada - 1)
          .forEach((m) => coloca(matchLoserIds(m), 3));
      }
      return saida;
    }
    // Final ainda sem vencedor: cai na classificação geral da fase.
  }

  const participantes = [...new Set(naUltima.flatMap((m) => [...idsDoLado(m, 'a'), ...idsDoLado(m, 'b')]))];
  const config = (m) => resolveStageScoringConfig(modality, tournament, m.stage_index ?? 0);
  buildRanking(naUltima, participantes, config)
    .filter((r) => Number(r.played) > 0)
    .forEach((r) => coloca([String(r.participant_id)], Number(r.position)));
  return saida;
}

/** As pessoas (com conta) de uma inscrição: A e B numa dupla, o elenco numa equipe. */
export function registrationPeople(reg) {
  if (!reg) return [];
  if (reg.kind === 'team') {
    return (reg.members || [])
      .filter((m) => m?.user_id)
      .map((m) => ({ user_id: m.user_id, name: m.name || t('Atleta'), photo_url: m.photo_url || null }));
  }
  return [
    reg.player_a_user_id || reg.user_id
      ? { user_id: reg.player_a_user_id || reg.user_id, name: reg.player_a_name || t('Atleta'), photo_url: reg.player_a_photo || null }
      : null,
    reg.player_b_user_id
      ? { user_id: reg.player_b_user_id, name: reg.player_b_name || t('Atleta'), photo_url: reg.player_b_photo || null }
      : null,
  ].filter(Boolean);
}

/**
 * TODAS as pessoas de uma inscrição, com ou sem conta — o cartão impresso
 * precisa do nome de quem jogou, tenha conta ou não.
 */
export function registrationAllPeople(reg) {
  if (!reg) return [];
  if (reg.kind === 'team') {
    return (reg.members || []).map((m) => ({ user_id: m?.user_id || null, name: m?.name || t('Atleta'), photo_url: m?.photo_url || null }));
  }
  const a = { user_id: reg.player_a_user_id || reg.user_id || null, name: reg.player_a_name || t('Atleta'), photo_url: reg.player_a_photo || null };
  const b = reg.player_b_name || reg.player_b_user_id
    ? { user_id: reg.player_b_user_id || null, name: reg.player_b_name || t('Atleta'), photo_url: reg.player_b_photo || null }
    : null;
  return [a, b].filter(Boolean);
}

/** O nome de cada degrau — singular e plural, sem gênero marcado onde dá. */
export const PODIUM_PLACE = Object.freeze({
  1: rotulos({ um: tk('Campeão'), varios: tk('Campeões'), fem: tk('Campeã'), femVarias: tk('Campeãs'), curto: tk('Ouro') }),
  2: rotulos({ um: tk('Vice-campeão'), varios: tk('Vice-campeões'), fem: tk('Vice-campeã'), femVarias: tk('Vice-campeãs'), curto: tk('Prata') }),
  3: rotulos({ um: tk('3º lugar'), varios: tk('3º lugar'), fem: tk('3º lugar'), femVarias: tk('3º lugar'), curto: tk('Bronze') }),
});

/**
 * O pódio de uma categoria: os três degraus, cada um com as inscrições que o
 * ocupam (o 3º pode ter DUAS, sem disputa de terceiro) e as pessoas de cada
 * inscrição. `complete` diz se há um campeão decidido.
 *
 * @returns {{ complete: boolean, places: Array<{ position: 1|2|3, label: string,
 *   entries: Array<{ registrationId: string, label: string, people: Array<{ user_id, name, photo_url }> }> }> }}
 */
export function modalityPodium({ modality = null, tournament = null, matches = [], registrations = [] } = {}) {
  // O título só existe com a categoria ENCERRADA (a final decidida, a última
  // rodada lançada): a colocação provisória serve ao ranking da casa, não ao
  // cartão de campeão.
  const complete = Boolean(modality) && isModalityComplete(modality, matches || []);
  if (!complete) return { complete: false, places: [] };
  const colocacao = modalityPlacement({ modality, tournament, matches });
  const regPorId = new Map((registrations || []).filter((r) => r?.id).map((r) => [String(r.id), r]));
  const places = [1, 2, 3].map((position) => {
    const entries = [];
    colocacao.forEach((c, regId) => {
      if (c.position !== position) return;
      const reg = regPorId.get(regId);
      const people = registrationAllPeople(reg);
      entries.push({
        registrationId: regId,
        label: reg?.label || people.map((p) => p.name).join(' / ') || 'Inscrição',
        people,
      });
    });
    entries.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    const pessoas = entries.reduce((n, e) => n + e.people.length, 0);
    return { position, label: pessoas > 1 ? PODIUM_PLACE[position].varios : PODIUM_PLACE[position].um, entries };
  }).filter((p) => p.entries.length > 0);
  return { complete: places.some((p) => p.position === 1), places };
}
