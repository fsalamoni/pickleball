/**
 * O TESTE DE PRECISÃO da quadra, no espírito do protocolo da ITF para
 * arbitragem eletrônica (nível Bronze, piso duro): solta-se a bola sobre
 * marcas a uma distância CONHECIDA da linha e compara-se com o que as
 * câmeras disseram. É a única forma honesta de dizer quanto o sistema acerta
 * NAQUELA quadra, com AQUELAS câmeras e AQUELA luz. Zero banco.
 *
 * Distância com sinal, como a margem do motor: positiva DENTRO, negativa
 * FORA, medida da borda externa da linha até a borda da marca da bola.
 */

/** As distâncias oferecidas para a marca no chão, em metros. */
export const TEST_DISTANCES = Object.freeze([0.1, 0.05, 0.02, -0.02, -0.05, -0.1]);

/** As faixas da ITF: até 25 mm da linha, e de 25 a 100 mm. */
export const BANDS = Object.freeze([
  Object.freeze({ id: 'near', max: 0.025, goal: 0.75 }),
  Object.freeze({ id: 'mid', max: 0.1, goal: 0.85 }),
]);

/** Quantos lances por faixa, no mínimo, para dar um veredito. */
export const MIN_PER_BAND = 10;

export const bandOf = (expected) => BANDS.find((b) => Math.abs(expected) <= b.max + 1e-9)?.id || null;

/**
 * Uma tentativa: o lance que chegou para uma marca.
 * @param {number} expected a distância da marca (positiva dentro)
 * @param {{ call: string, best?: { margin_m?: number } }} lance o lance juntado da central
 */
export function makeTrial(expected, lance) {
  const measured = lance?.best?.margin_m;
  const want = expected >= 0 ? 'in' : 'out';
  const call = lance?.call;
  return {
    expected,
    measured: Number.isFinite(measured) ? measured : null,
    call,
    result: call === want ? 'right' : call === 'review' ? 'review' : 'wrong',
  };
}

/**
 * O relatório. "Revisar" não conta como acerto (a ITF mede a chamada), mas
 * aparece separado: é o sistema dizendo que não sabe, e não errando.
 * @returns {{ bands: Array<{ id, n, right, review, wrong, pct, goal, ok }>,
 *   meanErrorCm: number|null, verdict: 'bronze'|'below'|'insufficient', n: number }}
 */
export function precisionReport(trials) {
  const list = trials || [];
  const bands = BANDS.map((b) => {
    const mine = list.filter((t) => bandOf(t.expected) === b.id);
    const count = (r) => mine.filter((t) => t.result === r).length;
    const n = mine.length;
    const right = count('right');
    const pct = n ? right / n : null;
    return { id: b.id, n, right, review: count('review'), wrong: count('wrong'), pct, goal: b.goal, ok: pct !== null && pct >= b.goal };
  });
  const errs = list.filter((t) => t.measured !== null).map((t) => Math.abs(t.measured - t.expected));
  const meanErrorCm = errs.length ? Math.round((errs.reduce((a, b) => a + b, 0) / errs.length) * 1000) / 10 : null;
  const verdict = bands.some((b) => b.n < MIN_PER_BAND) ? 'insufficient' : bands.every((b) => b.ok) ? 'bronze' : 'below';
  return { bands, meanErrorCm, verdict, n: list.length };
}
