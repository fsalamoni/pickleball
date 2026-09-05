/**
 * Domínio puro dos formatos do Game Day (flag gameday_formats).
 *
 * Além do Americano (gameDayDraw.generateGameDayGames), oferece:
 *  - Mexicano: rodadas com pareamento 1&4 vs 2&3 dentro de cada quadra, com
 *    rotação determinística dos jogadores entre as rodadas (pré-sorteio).
 *  - Rei da Quadra (King of the Court): rodada 1 sorteada; as rodadas seguintes
 *    são geradas a partir dos RESULTADOS — a dupla vencedora sobe uma quadra e a
 *    perdedora desce (quadra 1 é a "quadra do rei"). Result-driven.
 *
 * Todos retornam jogos no mesmo formato do sorteio existente:
 *   { round, side_a: [id, id], side_b: [id, id] } (Rei da Quadra inclui `court`).
 * Sem I/O — testável.
 */

export const GAME_DAY_FORMAT = Object.freeze({
  AMERICANO: 'americano',
  MEXICANO: 'mexicano',
  KING_OF_COURT: 'king_of_court',
  // Play (open play) — organizado por ordem de chegada/espera, quadra a quadra,
  // sem sorteio de grade e sem resultados. Domínio próprio em
  // `modules/games/domain/gamePlay.js` (não usa o motor de sorteio acima).
  PLAY: 'play',
});

export const GAME_DAY_FORMAT_LABELS = Object.freeze({
  [GAME_DAY_FORMAT.AMERICANO]: 'Americano',
  [GAME_DAY_FORMAT.MEXICANO]: 'Mexicano',
  [GAME_DAY_FORMAT.KING_OF_COURT]: 'Rei da Quadra',
  [GAME_DAY_FORMAT.PLAY]: 'Play (jogo aberto por ordem de chegada)',
});

/**
 * Formatos que usam o SORTEIO de grade (Americano/Mexicano/Rei da Quadra).
 * O formato Play é organizado dinamicamente por ordem de chegada e por isso
 * NÃO aparece nos seletores de sorteio — só na criação do dia de jogo.
 */
export const DRAW_FORMATS = Object.freeze([
  GAME_DAY_FORMAT.AMERICANO,
  GAME_DAY_FORMAT.MEXICANO,
  GAME_DAY_FORMAT.KING_OF_COURT,
]);

/** É o formato Play (open play)? */
export function isPlayFormat(format) {
  return format === GAME_DAY_FORMAT.PLAY;
}

/* --------------------------- utilidades RNG --------------------------- */

function seededRng(seed) {
  const s = String(seed || 'gameday');
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Rotaciona o array à esquerda por k posições. */
function rotate(arr, k) {
  const n = arr.length;
  if (n === 0) return [];
  const kk = ((k % n) + n) % n;
  return arr.slice(kk).concat(arr.slice(0, kk));
}

/* ------------------------- níveis (régua unificada) ------------------------- */

/**
 * Adapta o mapa `{ id: nível }` para uma função de leitura, ou devolve `null`
 * quando não há nenhum nível conhecido — nesse caso os formatos se comportam
 * exatamente como antes.
 *
 * Guarda importante: `Number(null)` é `0`, que é finito. Sem o teste explícito
 * de nulo, "sem nível" viraria o piso da régua e o atleta seria tratado como o
 * mais fraco de todos.
 */
function levelReader(levels) {
  if (!levels || typeof levels !== 'object') return null;
  const valores = Object.values(levels);
  const algum = valores.some((v) => v != null && v !== '' && Number.isFinite(Number(v)));
  if (!algum) return null;
  return (id) => {
    const v = levels[id];
    if (v == null || v === '') return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
}

/**
 * Ordena ids do mais forte para o mais fraco na régua unificada (2.0–8.0).
 *
 * Quem não tem nível conhecido entra pela MEDIANA do grupo: nem favorecido nem
 * penalizado. Empates preservam a ordem de entrada (que veio do sorteio), então
 * a aleatoriedade continua sendo o critério de desempate.
 */
function sortDescByLevel(ids, levelOf) {
  const conhecidos = ids
    .map((id) => levelOf(id))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (conhecidos.length === 0) return ids.slice();
  const mediana = conhecidos[Math.floor(conhecidos.length / 2)];
  return ids
    .map((id, i) => {
      const v = levelOf(id);
      return { id, i, v: Number.isFinite(v) ? v : mediana };
    })
    .sort((a, b) => (b.v - a.v) || (a.i - b.i))
    .map((x) => x.id);
}

/* ------------------------------ Mexicano ------------------------------ */

/**
 * Gera um cronograma Mexicano com `rounds` rodadas. Em cada quadra (grupo de 4)
 * o pareamento é 1&4 vs 2&3. Entre as rodadas, a ordem dos jogadores rotaciona
 * para variar parcerias/adversários e quem descansa.
 *
 * @param {string[]} playerIds
 * @param {{ rounds?: number, seed?: string, levels?: Record<string, number>|null }} [options]
 *   `levels` mapeia id → nível na régua unificada (2.0–8.0). Quando informado,
 *   o 1&4 vs 2&3 clássico do Mexicano passa a valer de verdade: os quatro da
 *   quadra são ordenados por nível, então a dupla do mais forte leva o mais
 *   fraco. Quem entra na quadra, quem descansa e a rotação entre rodadas NÃO
 *   mudam — só o recorte da dupla dentro do grupo de quatro.
 * @returns {Array<{ round, side_a:[string,string], side_b:[string,string] }>}
 */
export function generateMexicanoSchedule(playerIds, options = {}) {
  const ids = (playerIds || []).filter(Boolean);
  const n = ids.length;
  if (n < 4) throw new Error('O Mexicano exige no mínimo 4 participantes.');
  const { seed = 'mexicano', rounds = 5 } = options;
  const totalRounds = Math.max(1, Math.min(60, Math.floor(rounds)));
  const rng = seededRng(seed);
  const levelOf = levelReader(options.levels);
  const base = shuffle(ids, rng);
  const courts = Math.floor(n / 4);
  const playPerRound = courts * 4;

  const out = [];
  for (let r = 0; r < totalRounds; r += 1) {
    // Rotaciona para mudar grupos e quem descansa a cada rodada.
    const order = rotate(base, r * 1);
    const playing = order.slice(0, playPerRound);
    for (let c = 0; c < courts; c += 1) {
      const four = levelOf
        ? sortDescByLevel(playing.slice(c * 4, c * 4 + 4), levelOf)
        : playing.slice(c * 4, c * 4 + 4);
      out.push({
        round: r + 1,
        court: c + 1,
        side_a: [four[0], four[3]],
        side_b: [four[1], four[2]],
      });
    }
  }
  return out;
}

/* -------------------------- Rei da Quadra --------------------------- */

/**
 * Rodada 1 do Rei da Quadra: distribui os jogadores nas quadras (4 por quadra),
 * quadra 1 = "quadra do rei". Pareia como duplas [0,1] vs [2,3].
 *
 * Com `levels` (régua unificada 2.0–8.0) a rodada 1 já sai escalonada: quem
 * joga continua sendo decidido pelo sorteio (ninguém fica de fora por ser mais
 * fraco), mas os que jogam são distribuídos por nível — quadra 1 com os mais
 * fortes, como manda o formato — e dentro de cada quadra a dupla do mais forte
 * leva o mais fraco. Da rodada 2 em diante nada muda: o formato é movido pelo
 * RESULTADO (`kingOfCourtNextRound`), e é assim que deve continuar.
 *
 * @param {string[]} playerIds
 * @param {{ seed?: string, levels?: Record<string, number>|null }} [options]
 */
export function kingOfCourtFirstRound(playerIds, options = {}) {
  const ids = (playerIds || []).filter(Boolean);
  const n = ids.length;
  if (n < 4) throw new Error('O Rei da Quadra exige no mínimo 4 participantes.');
  const { seed = 'king' } = options;
  const rng = seededRng(seed);
  const levelOf = levelReader(options.levels);
  const courts = Math.floor(n / 4);
  // Sorteia PRIMEIRO quem joga (o corte é aleatório, não por nível) e só depois
  // ordena os escolhidos — assim o nível nunca decide quem fica de fora.
  const sorteados = shuffle(ids, rng).slice(0, courts * 4);
  const playing = levelOf ? sortDescByLevel(sorteados, levelOf) : sorteados;
  const out = [];
  for (let c = 0; c < courts; c += 1) {
    const four = playing.slice(c * 4, c * 4 + 4);
    out.push({
      round: 1,
      court: c + 1,
      side_a: levelOf ? [four[0], four[3]] : [four[0], four[1]],
      side_b: levelOf ? [four[1], four[2]] : [four[2], four[3]],
    });
  }
  return out;
}

/** Extrai os ids de um "lado" (aceita [id] ou [{id}]). */
function sideIds(side) {
  return (side || []).map((p) => (p && typeof p === 'object' ? p.id : p)).filter(Boolean);
}

/**
 * Próxima rodada do Rei da Quadra a partir dos resultados da última rodada.
 * A dupla vencedora sobe uma quadra (rumo à quadra 1); a perdedora desce. Na
 * quadra 1 o vencedor permanece; na última, o perdedor permanece. Jogos sem
 * placar (ou empate) mantêm as duplas na mesma quadra.
 *
 * @param {Array<{court, side_a, side_b, score_a, score_b}>} lastRoundGames
 * @param {{ round: number }} opts número da nova rodada
 * @returns {Array<{ round, court, side_a:[string,string], side_b:[string,string] }>}
 */
export function kingOfCourtNextRound(lastRoundGames = [], { round } = {}) {
  const games = (lastRoundGames || []).filter((g) => g && g.court != null);
  if (games.length === 0) return [];
  const courts = games.length;
  const nextRound = Number.isFinite(round) ? round : (Math.max(...games.map((g) => g.round || 1)) + 1);

  // Cada quadra produz duas duplas com destino (quadra da próxima rodada).
  const pairsByCourt = new Map(); // court -> [pairIds, ...]
  const place = (court, ids) => {
    if (!pairsByCourt.has(court)) pairsByCourt.set(court, []);
    pairsByCourt.get(court).push(ids);
  };

  games.forEach((g) => {
    const a = sideIds(g.side_a);
    const b = sideIds(g.side_b);
    const sa = g.score_a;
    const sb = g.score_b;
    const decided = sa != null && sb != null && sa !== sb;
    if (!decided) {
      // Sem resultado: mantém as duas duplas na mesma quadra.
      place(g.court, a);
      place(g.court, b);
      return;
    }
    const winner = sa > sb ? a : b;
    const loser = sa > sb ? b : a;
    const up = Math.max(1, g.court - 1);
    const down = Math.min(courts, g.court + 1);
    place(up, winner);
    place(down, loser);
  });

  // Monta jogos por quadra (as duas primeiras duplas de cada quadra se enfrentam).
  const out = [];
  Array.from(pairsByCourt.keys()).sort((x, y) => x - y).forEach((court) => {
    const pairs = pairsByCourt.get(court);
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      out.push({
        round: nextRound,
        court,
        side_a: pairs[i],
        side_b: pairs[i + 1],
      });
    }
  });
  return out;
}

/**
 * Classificação simples do Rei da Quadra por pontos (vitória=3) e por ter
 * alcançado a quadra do rei. Usa os ids de participante como chave.
 */
export function kingOfCourtStandings(games = []) {
  const pts = new Map();
  const add = (id, p) => pts.set(id, (pts.get(id) || 0) + p);
  (games || []).forEach((g) => {
    const a = sideIds(g.side_a);
    const b = sideIds(g.side_b);
    const decided = g.score_a != null && g.score_b != null && g.score_a !== g.score_b;
    if (!decided) return;
    const winners = g.score_a > g.score_b ? a : b;
    const losers = g.score_a > g.score_b ? b : a;
    winners.forEach((id) => add(id, 3));
    losers.forEach((id) => add(id, 1));
    // Bônus por vencer na quadra 1 (quadra do rei).
    if (g.court === 1) winners.forEach((id) => add(id, 1));
  });
  return Array.from(pts.entries())
    .map(([id, points]) => ({ id, points }))
    .sort((x, y) => y.points - x.points);
}
