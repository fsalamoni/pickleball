/**
 * O PLAYOFF da liga no SERVIDOR — cópia de
 * `src/modules/leagues/domain/leaguePlayoff.js` (paridade em
 * `leaguePlayoff.parity.test.js`). A chave sai dos N primeiros da tabela e cada
 * fase nasce dos vencedores da anterior; quem avança é derivado dos placares.
 */
const P = require('./leaguePolicy.js');

const PLAYOFF_SIZES = [2, 4, 8];
const ORDEM = { 2: [1, 2], 4: [1, 4, 2, 3], 8: [1, 8, 4, 5, 2, 7, 3, 6] };

function playoffSize(requested, count) {
  const teto = Math.min(Number(requested) || 0, Number(count) || 0);
  return [8, 4, 2].find((n) => n <= teto) || 0;
}

function playoffFirstRound(seedIds, requested) {
  const ids = Array.isArray(seedIds) ? seedIds : [];
  const size = playoffSize(requested, ids.length);
  const ordem = ORDEM[size] || [];
  const out = [];
  for (let i = 0; i < ordem.length; i += 2) {
    out.push({ round: 1, slot: i / 2, side_a: ids[ordem[i] - 1], side_b: ids[ordem[i + 1] - 1], seed_a: ordem[i], seed_b: ordem[i + 1] });
  }
  return out;
}

/** O vencedor do jogo gravado (o DreamBreaker gravado decide o empate das equipes). */
function matchWinner(m) {
  if (!m) return null;
  if (m.wo_winner === 'a' || m.wo_winner === 'b') return m.wo_winner;
  const r = P.validateResult({ games: m.games, dreambreaker: m.dreambreaker }, { dreambreaker: Boolean(m.dreambreaker) });
  return r.ok ? r.winner : null;
}

function playoffState(matches, { thirdPlace = false, winnerOf = matchWinner } = {}) {
  const po = (Array.isArray(matches) ? matches : []).filter((m) => m && m.phase === 'playoff');
  const main = po.filter((m) => !m.third);
  if (!main.length) return { stage: 'none', total: 0 };
  const total = Math.max(1, Math.round(Math.log2(main.filter((m) => m.round === 1).length * 2)));
  const last = Math.max(...main.map((m) => Number(m.round) || 1));
  const atual = main.filter((m) => m.round === last).sort((a, b) => (a.slot || 0) - (b.slot || 0));
  const terceiro = po.find((m) => m.third) || null;
  const daFase = terceiro && terceiro.round === last ? [...atual, terceiro] : atual;
  if (daFase.some((m) => !winnerOf(m))) return { stage: 'playing', round: last, total };
  const ganhou = (m) => (winnerOf(m) === 'a' ? m.side_a : m.side_b);
  const perdeu = (m) => (winnerOf(m) === 'a' ? m.side_b : m.side_a);
  if (last >= total) {
    return { stage: 'done', round: last, total, champion: ganhou(atual[0]), runner_up: perdeu(atual[0]), third: terceiro ? ganhou(terceiro) : null };
  }
  const next = [];
  for (let i = 0; i + 1 < atual.length; i += 2) next.push({ round: last + 1, slot: i / 2, side_a: ganhou(atual[i]), side_b: ganhou(atual[i + 1]) });
  if (thirdPlace && atual.length === 2) next.push({ round: last + 1, slot: 1, third: true, side_a: perdeu(atual[0]), side_b: perdeu(atual[1]) });
  return { stage: 'ready', round: last, total, next };
}

module.exports = { PLAYOFF_SIZES, playoffSize, playoffFirstRound, playoffState, matchWinner };
