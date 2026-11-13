/**
 * O PLAYOFF da liga: o mata-mata do fim da temporada, divisão a divisão.
 *
 * A chave sai da classificação (os N primeiros, cabeças pela posição) e cada
 * fase nasce quando a anterior termina — nada além dos jogos é gravado: quem
 * avança, o campeão e o 3º lugar são DERIVADOS dos placares. A conta tem cópia
 * no servidor (`functions/leaguePlayoff.js`, paridade), que é quem grava.
 *
 * Os jogos do playoff são os jogos de sempre com `phase: 'playoff'`, `round`
 * (1 = primeira fase), `slot` (a posição na fase) e, na disputa do 3º lugar,
 * `third: true`. Na 1ª fase também `seed_a`/`seed_b` (as cabeças).
 */
import { tk } from '@/core/i18n';
import { matchWinner } from './leagueResults.js';

export const PLAYOFF_SIZES = Object.freeze([2, 4, 8]);

/** Quem cruza com quem na 1ª fase (cabeça 1 contra a última, e a 1 e a 2 só na final). */
const ORDEM = Object.freeze({ 2: [1, 2], 4: [1, 4, 2, 3], 8: [1, 8, 4, 5, 2, 7, 3, 6] });

/** O tamanho da chave: o pedido, cortado ao que as inscrições permitem (0 = não dá). */
export function playoffSize(requested, count) {
  const teto = Math.min(Number(requested) || 0, Number(count) || 0);
  return [8, 4, 2].find((n) => n <= teto) || 0;
}

/** Os jogos da 1ª fase a partir das inscrições na ordem da classificação. */
export function playoffFirstRound(seedIds, requested) {
  const ids = Array.isArray(seedIds) ? seedIds : [];
  const size = playoffSize(requested, ids.length);
  const ordem = ORDEM[size] || [];
  const out = [];
  for (let i = 0; i < ordem.length; i += 2) {
    out.push({ round: 1, slot: i / 2, side_a: ids[ordem[i] - 1], side_b: ids[ordem[i + 1] - 1], seed_a: ordem[i], seed_b: ordem[i + 1] });
  }
  return out;
}

/**
 * Onde o playoff está: `none` (sem chave), `playing` (fase com jogo sem
 * placar), `ready` (fase fechada: `next` são os jogos da próxima) ou `done`
 * (`champion`, `runner_up` e, com a disputa, `third`).
 *
 * @param {object[]} matches  os jogos da divisão (os de fora do playoff são ignorados)
 * @param {{ thirdPlace?: boolean, winnerOf?: (m: object) => ('a'|'b'|null) }} [opts]
 */
export function playoffState(matches, { thirdPlace = false, winnerOf = matchWinner } = {}) {
  const po = (Array.isArray(matches) ? matches : []).filter((m) => m?.phase === 'playoff');
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

/** O nome da fase (`round` de `total`). */
export function playoffRoundLabel(round, total) {
  const falta = (Number(total) || 0) - (Number(round) || 0);
  if (falta <= 0) return tk('Final');
  if (falta === 1) return tk('Semifinal');
  return tk('Quartas de final');
}
