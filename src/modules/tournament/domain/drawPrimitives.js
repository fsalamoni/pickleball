/**
 * Peças básicas do sorteio, sem dependência nenhuma: RNG semeado, embaralhar
 * e posições canônicas da chave. Separadas de draw.js para que suíço, Mexicano
 * e dupla eliminação as usem sem importar draw.js (que importa os três).
 */

/* ----------------------------- RNG semeado ------------------------------- */

/**
 * Gera um RNG determinístico baseado em mulberry32, semeado por uma string.
 * @param {string|number} seed
 * @returns {() => number}
 */
export function seededRng(seed = 'pickleball') {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let tt = Math.imul(a ^ (a >>> 15), 1 | a);
    tt = (tt + Math.imul(tt ^ (tt >>> 7), 61 | tt)) ^ tt;
    return ((tt ^ (tt >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle Fisher–Yates determinístico.
 * @template T
 * @param {T[]} list
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calcula a próxima potência de 2 >= n.
 */
export function nextPowerOfTwo(n) {
  if (n <= 1) return 1;
  return 1 << Math.ceil(Math.log2(n));
}

/**
 * Ordem CANÔNICA da chave: `order[slot]` é o número de cabeça que ocupa aquela
 * posição. Construída pela regra clássica — a cada dobra de tamanho, cada
 * número `s` vira o par `(s, m+1−s)`:
 *
 *   tamanho 2 → [1, 2]
 *   tamanho 4 → [1, 4, 2, 3]            (1×4 e 2×3)
 *   tamanho 8 → [1, 8, 4, 5, 2, 7, 3, 6] (1×8, 4×5, 2×7, 3×6)
 *
 * É o que garante as duas propriedades que se espera de uma chave: o nº 1
 * enfrenta o mais fraco na 1ª rodada, e o nº 1 e o nº 2 só podem se encontrar
 * na FINAL.
 *
 * 🐞 A versão anterior refletia a sequência errada (`m−1−p` em vez de
 * `m+1−s` sobre os NÚMEROS), e produzia 1×5, 3×7, 4×8, 2×6 numa chave de 8:
 * o nº 1 pegava o nº 5 na estreia e, com chave incompleta, o bye ia para o
 * nº 4. Ninguém percebia porque a chave "parecia" uma chave.
 *
 * @param {number} size potência de 2
 * @returns {number[]} `order[slot] = número de cabeça` (1-based)
 */
export function bracketSeedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2;
    const next = [];
    for (let i = 0; i < order.length; i += 1) {
      next.push(order[i]);
      next.push(m + 1 - order[i]);
    }
    order = next;
  }
  return order;
}

export function seedSlot(seedNum, size) {
  const order = bracketSeedOrder(size);
  const alvo = ((Math.floor(seedNum) - 1 + size) % size) + 1;
  const idx = order.indexOf(alvo);
  return idx >= 0 ? idx : 0;
}
