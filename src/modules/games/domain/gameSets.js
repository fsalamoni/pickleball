import { t } from '@/core/i18n';
/**
 * PLACAR POR SETS no dia de jogo (Americano, Americano aprimorado e demais
 * formatos de placar).
 *
 * A regra é UM set — exatamente o placar de sempre. Quem lança o resultado pode
 * acrescentar sets na hora; com dois ou mais, o jogo grava:
 *
 *  - `sets`: [{ a, b }, …] — o placar de cada set;
 *  - `score_a`/`score_b`: os SETS VENCIDOS (2 × 1);
 *  - `points_a`/`points_b`: o total de pontos dos sets.
 *
 * Por que `score_*` vira sets vencidos: todo leitor da plataforma decide o
 * vencedor por `score_a > score_b` (ranking do dia, publicação, telão, meus
 * jogos, ranking da casa, balanço). Com os sets ali, o vencedor sai certo em
 * todos sem tocar em cada um — e um vencedor por PONTOS poderia ser o perdedor
 * por sets (11-0, 9-11, 9-11). Quem precisa de PONTOS (saldo do dia, rating)
 * lê `gamePoints`, que cai no `score_*` quando o jogo é de um set só.
 *
 * Com um set só, `sets`/`points_*` vão nulos: o documento é o de sempre, e
 * corrigir um jogo de três sets para um apaga os campos que sobrariam.
 */

/** Teto de sets por partida — melhor de 5 é o máximo que se joga. */
export const MAX_SETS = 5;

const vazio = (v) => v === '' || v == null;

function inteiroValido(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Os sets de um jogo para EDITAR: os gravados quando há dois ou mais; senão um
 * set com o placar de sempre (ou em branco).
 * @returns {{ a: string, b: string }[]}
 */
export function setsForEdit(game) {
  const lista = gameSetList(game);
  if (lista.length > 1) return lista.map((s) => ({ a: String(s.a), b: String(s.b) }));
  return [{
    a: game?.score_a != null ? String(game.score_a) : '',
    b: game?.score_b != null ? String(game.score_b) : '',
  }];
}

/**
 * Traduz os sets digitados nos campos do jogo.
 *
 * @param {{ a: any, b: any }[]} sets
 * @param {{ allowEmpty?: boolean }} [opts] — `allowEmpty`: um set em branco
 *   limpa o placar (a grade do Americano deixa apagar o resultado).
 * @returns {{ ok: true, fields: object } | { ok: false, error: string }}
 */
export function resultFromSets(sets, { allowEmpty = false } = {}) {
  const lista = Array.isArray(sets) ? sets : [];
  if (lista.length === 0) return { ok: false, error: t('Informe o placar.') };
  if (lista.length > MAX_SETS) return { ok: false, error: t('No máximo {n} sets por partida.', { n: MAX_SETS }) };

  if (lista.length === 1) {
    const [s] = lista;
    if (allowEmpty && vazio(s?.a) && vazio(s?.b)) {
      return { ok: true, fields: { score_a: null, score_b: null, sets: null, points_a: null, points_b: null } };
    }
    const a = inteiroValido(s?.a);
    const b = inteiroValido(s?.b);
    if (vazio(s?.a) || vazio(s?.b) || a == null || b == null) {
      return { ok: false, error: t('Informe os dois placares.') };
    }
    return { ok: true, fields: { score_a: a, score_b: b, sets: null, points_a: null, points_b: null } };
  }

  const limpos = [];
  for (let i = 0; i < lista.length; i += 1) {
    const s = lista[i];
    const a = inteiroValido(s?.a);
    const b = inteiroValido(s?.b);
    if (vazio(s?.a) || vazio(s?.b) || a == null || b == null) {
      return { ok: false, error: t('Informe os dois placares do set {n} (ou remova o set).', { n: i + 1 }) };
    }
    if (a === b) return { ok: false, error: t('O set {n} está empatado: cada set precisa de um vencedor.', { n: i + 1 }) };
    limpos.push({ a, b });
  }
  const setsA = limpos.filter((s) => s.a > s.b).length;
  const setsB = limpos.length - setsA;
  if (setsA === setsB) {
    return { ok: false, error: t('Os sets ficaram {a} × {b}: acrescente o set de desempate.', { a: setsA, b: setsB }) };
  }
  return {
    ok: true,
    fields: {
      score_a: setsA,
      score_b: setsB,
      sets: limpos,
      points_a: limpos.reduce((t, s) => t + s.a, 0),
      points_b: limpos.reduce((t, s) => t + s.b, 0),
    },
  };
}

/** Os sets digitados formam um resultado válido? (para habilitar o "Salvar"). */
export function setsReady(sets) {
  return resultFromSets(sets).ok;
}

/** Os sets gravados (dois ou mais), ou `[]` quando o jogo é de um set. */
export function gameSetList(game) {
  const lista = Array.isArray(game?.sets) ? game.sets : [];
  return lista.length > 1 ? lista.map((s) => ({ a: Number(s?.a) || 0, b: Number(s?.b) || 0 })) : [];
}

/** O jogo foi lançado por sets (dois ou mais)? */
export function hasSets(game) {
  return gameSetList(game).length > 1;
}

/**
 * Os PONTOS do jogo — o que o saldo do dia e o rating usam. Por sets, o total
 * dos sets; com um set, o placar de sempre.
 * @returns {{ a: number, b: number }}
 */
export function gamePoints(game) {
  if (hasSets(game)) {
    const lista = gameSetList(game);
    const a = Number.isFinite(Number(game?.points_a)) && game?.points_a != null
      ? Number(game.points_a) : lista.reduce((t, s) => t + s.a, 0);
    const b = Number.isFinite(Number(game?.points_b)) && game?.points_b != null
      ? Number(game.points_b) : lista.reduce((t, s) => t + s.b, 0);
    return { a, b };
  }
  return { a: Number(game?.score_a) || 0, b: Number(game?.score_b) || 0 };
}

/** Os sets como texto ("11-9 · 9-11 · 11-7"), ou `null` num jogo de um set. */
export function setsText(game) {
  const lista = gameSetList(game);
  return lista.length > 1 ? lista.map((s) => `${s.a}-${s.b}`).join(' · ') : null;
}
