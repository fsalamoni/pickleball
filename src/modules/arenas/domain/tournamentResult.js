/**
 * O resultado de um torneio da casa — do dia de jogo ao ladder.
 *
 * 🐞 "Encerrar o torneio" (que soma o resultado ao ladder) existia no serviço
 * e **não tinha botão**: o torneio começava, virava dia de jogo, e ficava "em
 * andamento" para sempre — o ladder, que a Onda AM passou a escrever, nunca
 * recebia nada, porque nada chamava a escrita.
 *
 * A classificação vem de onde o torneio foi jogado: o **ranking do dia**
 * (`computeGameDayLeaderboard`, o mesmo que o painel e o telão mostram).
 * Formato sem placar (Play) não tem ranking — aí a arena escolhe o pódio, e
 * todo mundo que jogou leva os pontos de presença.
 *
 * PURO. Sem I/O.
 */
import { computeGameDayLeaderboard } from '../../clubs/domain/gameDayLeaderboard.js';
import { ladderPointsFor } from './leagues.js';

/** Quantas posições de pódio a arena pode escolher à mão. */
export const PODIUM_SIZE = 4;

/**
 * A classificação sugerida do torneio.
 *
 * Base: quem está no DIA DE JOGO com conta (`user_id`) — é quem de fato
 * jogou. Sem dia de jogo carregado, vale o `roster` do torneio. Com placar,
 * a ordem é a do ranking do dia e só quem jogou alguma partida tem posição;
 * sem placar, ninguém tem posição (a arena escolhe o pódio).
 *
 * @param {{
 *   roster?: Array<{ user_id: string, name?: string, photo_url?: string }>,
 *   participants?: Array<{ id: string, user_id?: string, name?: string, photo_url?: string }>,
 *   games?: Array<object>,
 *   hasScores?: boolean,
 * }} input
 * @returns {Array<{ user_id: string, name: string, photo_url: string|null, position: number|null, won: number, played: number }>}
 */
export function tournamentStandings({ roster = [], participants = [], games = [], hasScores = false } = {}) {
  const comConta = (participants || []).filter((p) => p?.user_id);
  const base = comConta.length > 0
    ? comConta.map((p) => ({ key: p.id, user_id: p.user_id, name: p.name, photo_url: p.photo_url || null }))
    : (roster || []).filter((r) => r?.user_id)
      .map((r) => ({ key: r.user_id, user_id: r.user_id, name: r.name, photo_url: r.photo_url || null }));

  // Uma pessoa, uma linha — mesmo que apareça duas vezes no dia de jogo.
  const vistos = new Set();
  const pessoas = base.filter((p) => (vistos.has(p.user_id) ? false : vistos.add(p.user_id)));

  const semPosicao = (p) => ({
    user_id: p.user_id, name: p.name || 'Atleta', photo_url: p.photo_url, position: null, won: 0, played: 0,
  });

  if (!hasScores || comConta.length === 0) {
    return pessoas.map(semPosicao)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  const linhas = computeGameDayLeaderboard(
    comConta.map((p) => ({ id: p.id, name: p.name })),
    games || [],
  );
  const porParticipante = new Map(comConta.map((p) => [p.id, p]));
  const saida = [];
  const jaNaSaida = new Set();
  let posicao = 0;
  linhas.forEach((l) => {
    const p = porParticipante.get(l.id);
    if (!p || jaNaSaida.has(p.user_id)) return;
    jaNaSaida.add(p.user_id);
    const jogou = Number(l.games) > 0;
    if (jogou) posicao += 1;
    saida.push({
      user_id: p.user_id,
      name: p.name || l.name || 'Atleta',
      photo_url: p.photo_url || null,
      position: jogou ? posicao : null,
      won: Number(l.wins) || 0,
      played: Number(l.games) || 0,
    });
  });
  // Quem está no torneio mas não entrou no ranking (sem jogo) vai no fim.
  pessoas.filter((p) => !jaNaSaida.has(p.user_id)).forEach((p) => saida.push(semPosicao(p)));
  // O ranking do dia põe quem não jogou ACIMA de quem perdeu tudo (tem menos
  // derrotas). No torneio, quem não jogou não tem posição: vai para o fim.
  return saida.sort((a, b) => {
    const pa = a.position ?? Infinity;
    const pb = b.position ?? Infinity;
    return pa - pb || String(a.name).localeCompare(String(b.name), 'pt-BR');
  });
}

/**
 * Aplica o pódio escolhido pela arena.
 *
 * O pódio é uma lista de uids na ordem (1º, 2º, 3º, 4º); vazio numa posição =
 * ninguém nela. Quem não está no pódio perde a posição e leva a presença —
 * inclusive quem o ranking do dia tinha posto em 5º: o ladder só pontua
 * diferente até o 4º, e mostrar "5º" sem ponto a mais só confunde.
 *
 * @param {Array} standings  saída de `tournamentStandings`
 * @param {Array<string|null>} podium
 */
export function applyPodium(standings = [], podium = []) {
  const posDe = new Map();
  (podium || []).slice(0, PODIUM_SIZE).forEach((uid, i) => {
    if (uid && !posDe.has(uid)) posDe.set(uid, i + 1);
  });
  return (standings || [])
    .map((s) => ({ ...s, position: posDe.get(s.user_id) ?? null }))
    .sort((a, b) => {
      const pa = a.position ?? Infinity;
      const pb = b.position ?? Infinity;
      return pa - pb || String(a.name).localeCompare(String(b.name), 'pt-BR');
    });
}

/** O pódio que a tela mostra de início: os 4 primeiros do ranking do dia. */
export function suggestedPodium(standings = []) {
  const podio = (standings || [])
    .filter((s) => s.position != null)
    .sort((a, b) => a.position - b.position)
    .slice(0, PODIUM_SIZE)
    .map((s) => s.user_id);
  while (podio.length < PODIUM_SIZE) podio.push(null);
  return podio;
}

/**
 * A classificação como o serviço grava (`finishInternalTournament`), com os
 * pontos que cada um vai levar — para a arena conferir ANTES de confirmar.
 */
export function classificationForLadder(standings = []) {
  return (standings || [])
    .filter((s) => s?.user_id)
    .map((s) => ({
      user_id: s.user_id,
      name: s.name || 'Atleta',
      position: s.position ?? null,
      won: Number(s.won) || 0,
      points: ladderPointsFor(s.position),
    }));
}
