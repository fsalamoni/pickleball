/**
 * SIMPLES × DUPLAS no dia de jogo (Onda CF) — lógica pura, sem I/O.
 *
 * Todo jogo de dia de jogo sempre teve um campo `kind` (`'doubles'` por
 * padrão), e o organizador legado do clube já criava jogo "Individual". O que
 * faltava era o resto do caminho: sortear jogo simples respeitando a fila,
 * separar o ranking do dia por tipo e mostrar a diferença na tela e no telão.
 *
 * ## De onde sai o tipo de um jogo
 *
 * Do NÚMERO DE ATLETAS de cada lado — a mesma regra que a publicação usa
 * (`inferKind`) e que o servidor usa para decidir entre o rating de simples e
 * o de duplas. Um lado com 1 e o outro com 1 é simples; o resto é duplas. Só
 * quando os lados ainda estão vazios (jogo em montagem) vale o campo `kind`.
 * Assim o ranking do dia, a publicação e o rating nunca discordam sobre o que
 * um jogo é.
 *
 * ## O tipo de uma QUADRA (formatos quadra a quadra)
 *
 * No Play e no Americano aprimorado a quadra "lembra" o tipo do último jogo
 * criado nela: a quadra 3 que recebeu uma partida de simples continua de
 * simples até alguém trocar. Isso é DERIVADO dos jogos — nenhum campo novo no
 * dia de jogo, nenhuma regra nova —, então todos os aparelhos (painel e telão)
 * enxergam o mesmo tipo sem combinar nada.
 */

export const GAME_KIND = Object.freeze({
  DOUBLES: 'doubles',
  SINGLES: 'singles',
});

export const GAME_KIND_LABELS = Object.freeze({
  [GAME_KIND.DOUBLES]: 'Duplas',
  [GAME_KIND.SINGLES]: 'Simples',
});

/** Jogadores por partida de cada tipo. */
export const GAME_KIND_SLOTS = Object.freeze({
  [GAME_KIND.DOUBLES]: 4,
  [GAME_KIND.SINGLES]: 2,
});

/** A ordem em que os tipos aparecem na tela (duplas é o padrão). */
export const GAME_KIND_ORDER = Object.freeze([GAME_KIND.DOUBLES, GAME_KIND.SINGLES]);

/** Qualquer valor vira um tipo válido: só `'singles'` é simples. */
export function normalizeGameKind(kind) {
  return kind === GAME_KIND.SINGLES ? GAME_KIND.SINGLES : GAME_KIND.DOUBLES;
}

/** Quantos atletas uma partida desse tipo leva. */
export function slotsForKind(kind) {
  return GAME_KIND_SLOTS[normalizeGameKind(kind)];
}

/** Atletas por LADO (1 no simples, 2 nas duplas). */
export function sideSizeForKind(kind) {
  return slotsForKind(kind) / 2;
}

const tamanhoDoLado = (side) => (Array.isArray(side) ? side.filter(Boolean).length : 0);

/**
 * O tipo de UM jogo. Lados preenchidos decidem (1×1 é simples); lados vazios
 * caem no campo `kind`; sem nada, duplas.
 */
export function gameKindOf(game) {
  const a = tamanhoDoLado(game?.side_a);
  const b = tamanhoDoLado(game?.side_b);
  if (a > 0 && b > 0) return a === 1 && b === 1 ? GAME_KIND.SINGLES : GAME_KIND.DOUBLES;
  return normalizeGameKind(game?.kind);
}

export const isSinglesGame = (game) => gameKindOf(game) === GAME_KIND.SINGLES;

/** Os jogos separados por tipo. */
export function splitGamesByKind(games = []) {
  const out = { [GAME_KIND.DOUBLES]: [], [GAME_KIND.SINGLES]: [] };
  (games || []).forEach((g) => { if (g) out[gameKindOf(g)].push(g); });
  return out;
}

/** Os tipos presentes nos jogos, na ordem da tela. Sem jogo, nenhum. */
export function gameKindsIn(games = []) {
  const presentes = new Set((games || []).filter(Boolean).map(gameKindOf));
  return GAME_KIND_ORDER.filter((k) => presentes.has(k));
}

/**
 * O tipo de cada quadra, derivado do último jogo criado NELA (aberto ou
 * encerrado). Quadra que nunca recebeu jogo é de duplas.
 *
 * @param {Array} games
 * @param {number} courts
 * @returns {Record<number, 'doubles'|'singles'>}
 */
export function courtKindsFromGames(games = [], courts = 1) {
  const total = Math.max(1, Math.floor(Number(courts)) || 1);
  const ultimo = new Map();
  (games || []).forEach((g) => {
    const c = Number(g?.court);
    if (!Number.isFinite(c) || c < 1) return;
    const ordem = Number(g.created_at_ms ?? g.order ?? 0) || 0;
    const atual = ultimo.get(c);
    if (!atual || ordem >= atual.ordem) ultimo.set(c, { ordem, kind: gameKindOf(g) });
  });
  const out = {};
  for (let c = 1; c <= total; c += 1) out[c] = ultimo.get(c)?.kind || GAME_KIND.DOUBLES;
  return out;
}

/**
 * Junta o tipo DERIVADO das quadras com a escolha que quem organiza fez agora
 * (e ainda não virou jogo). A escolha vence; o que ela não diz, o derivado diz.
 */
export function mergeCourtKinds(derivado = {}, escolha = {}) {
  const out = { ...derivado };
  Object.entries(escolha || {}).forEach(([c, k]) => {
    if (Number(c) >= 1) out[c] = normalizeGameKind(k);
  });
  return out;
}

/** O tipo de uma quadra num mapa de tipos (duplas quando o mapa não diz). */
export function kindOfCourt(courtKinds, court) {
  return normalizeGameKind(courtKinds?.[court]);
}

/** Há alguma quadra de simples no mapa? */
export function hasSinglesCourt(courtKinds) {
  return Object.values(courtKinds || {}).some((k) => k === GAME_KIND.SINGLES);
}

/**
 * A fila SEM os vínculos de dupla — é a fila que vale para escolher um jogo
 * simples. Dupla vinculada é coisa de duplas: no simples cada um joga por si,
 * e manter o vínculo ali faria o motor colocar os dois na MESMA partida, um
 * contra o outro (é exatamente o efeito de "sempre entram juntos" num jogo de
 * dois lugares).
 *
 * Quem tem parceiro em quadra não fica "aguardando" para o simples: sem o
 * vínculo, ele está livre para jogar.
 */
export function withoutPartnerLinks(pool = []) {
  return (pool || []).map((p) => (p?.partner_id ? { ...p, partner_id: null } : p));
}

/**
 * Quantas das quadras livres dá para ENCHER com quem está na fila, cada uma
 * com o seu tipo. As de duplas contam primeiro (é o que o sorteio da rodada
 * faz); as de simples, com o que sobrar. Serve para a tela saber se "sortear
 * todas as quadras" faz sentido (pelo menos duas) — quem decide quem joga
 * continua sendo o sorteio.
 *
 * @param {number[]} freeCourts
 * @param {Record<number, string>} courtKinds
 * @param {number} available  quantos estão na fila
 */
export function fillableCourts(freeCourts = [], courtKinds = {}, available = 0) {
  let resto = Math.max(0, Math.floor(Number(available)) || 0);
  let cheias = 0;
  const ordem = [
    ...(freeCourts || []).filter((c) => kindOfCourt(courtKinds, c) === GAME_KIND.DOUBLES),
    ...(freeCourts || []).filter((c) => kindOfCourt(courtKinds, c) === GAME_KIND.SINGLES),
  ];
  ordem.forEach((c) => {
    const vagas = slotsForKind(kindOfCourt(courtKinds, c));
    if (resto >= vagas) { resto -= vagas; cheias += 1; }
  });
  return cheias;
}
