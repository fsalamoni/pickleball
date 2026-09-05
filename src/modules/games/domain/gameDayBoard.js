/**
 * Painel do dia de jogo (modo telão / segunda tela) — lógica pura, sem I/O.
 *
 * Separa os jogos do dia em três grupos, do jeito que quem está na quadra
 * precisa ver:
 *
 *   - `live`     — o que está acontecendo AGORA;
 *   - `upcoming` — o que vem a seguir;
 *   - `recent`   — os últimos resultados.
 *
 * ## Dois modelos de dia de jogo, um painel só
 *
 * Os formatos de GRADE (Americano, Mexicano, Rei da Quadra) sorteiam rodadas
 * inteiras de uma vez: todos os jogos já existem, e o que separa "agora" de
 * "depois" é a RODADA — a rodada corrente é a primeira que ainda tem jogo sem
 * placar.
 *
 * O formato PLAY cria um jogo por vez, sob demanda: não existe rodada, e o que
 * separa "agora" de "depois" é o STATUS (`open` / `finished`). Não há jogos
 * futuros gravados — a fila de quem entra é a ordem de participação, calculada
 * em `gamePlay.js` e exibida à parte no painel.
 *
 * Estas funções não sabem qual é o formato: elas olham os dados. Um jogo com
 * `status` é tratado como Play; sem `status`, como grade. Assim o painel
 * funciona igual num dia de jogo do atleta e num dia de jogo de clube, que
 * gravam jogos no mesmo formato.
 */

/** Um jogo está decidido quando os DOIS placares foram preenchidos. */
export function isDecided(game) {
  return game?.score_a != null && game?.score_b != null;
}

/** Um jogo do Play já terminou? (só o Play usa `status`). */
export function isFinishedPlayGame(game) {
  return game?.status === 'finished';
}

/**
 * Nomes de um lado da partida, prontos para exibir.
 * Aceita `[{ id, name }]` (formato gravado) e `['id']` (formato antigo/manual).
 * @returns {string[]}
 */
export function sideNames(side) {
  return (side || [])
    .map((p) => {
      if (!p) return null;
      if (typeof p === 'string') return p;
      return p.name || null;
    })
    .filter(Boolean);
}

/** Placar como texto ("11 × 7"), ou `null` quando ainda não há. */
export function scoreText(game) {
  if (!isDecided(game)) return null;
  return `${Number(game.score_a)} × ${Number(game.score_b)}`;
}

/**
 * Qual lado venceu: 'a', 'b' ou `null` (indeciso ou empate).
 */
export function winnerSide(game) {
  if (!isDecided(game)) return null;
  const a = Number(game.score_a);
  const b = Number(game.score_b);
  if (a === b) return null;
  return a > b ? 'a' : 'b';
}

/** Ordena por quadra (as sem quadra vão ao fim), depois pela ordem de criação. */
function byCourtThenOrder(a, b) {
  const ca = a.court == null ? Number.POSITIVE_INFINITY : Number(a.court);
  const cb = b.court == null ? Number.POSITIVE_INFINITY : Number(b.court);
  if (ca !== cb) return ca - cb;
  return Number(a.order || 0) - Number(b.order || 0);
}

/** Mais recente primeiro: rodada maior antes, e dentro dela a ordem maior. */
function byMostRecent(a, b) {
  const ra = Number(a.round || 0);
  const rb = Number(b.round || 0);
  if (ra !== rb) return rb - ra;
  return Number(b.order || 0) - Number(a.order || 0);
}

/**
 * Rodada corrente de um dia de jogo em grade: a PRIMEIRA rodada que ainda tem
 * jogo sem placar. Quando está tudo decidido, é a última rodada existente —
 * o dia acabou, e o painel deve mostrar a rodada final, não uma rodada vazia.
 *
 * @param {Array} games
 * @returns {number|null} `null` quando não há jogos com rodada
 */
export function currentRoundOf(games = []) {
  const rounds = games
    .map((g) => Number(g.round))
    .filter((r) => Number.isFinite(r) && r > 0);
  if (rounds.length === 0) return null;

  const pendentes = games
    .filter((g) => !isDecided(g))
    .map((g) => Number(g.round))
    .filter((r) => Number.isFinite(r) && r > 0);

  return pendentes.length > 0 ? Math.min(...pendentes) : Math.max(...rounds);
}

/**
 * Separa os jogos do dia nos três grupos do painel.
 *
 * @param {Array} games jogos do dia (formato gravado em `game_days/{id}/games`)
 * @param {{ recentLimit?: number, upcomingLimit?: number }} [options]
 * @returns {{
 *   live: Array, upcoming: Array, recent: Array,
 *   currentRound: number|null, isPlay: boolean,
 *   totals: { total: number, decided: number, pending: number }
 * }}
 */
export function buildGameDayBoard(games = [], options = {}) {
  const { recentLimit = 8, upcomingLimit = 8 } = options;
  const lista = (games || []).filter(Boolean);

  // Um único jogo com `status` já caracteriza o Play: nos formatos de grade
  // o campo simplesmente não é gravado.
  const isPlay = lista.some((g) => g.status != null);

  const totals = {
    total: lista.length,
    decided: lista.filter(isDecided).length,
    pending: lista.filter((g) => !isDecided(g)).length,
  };

  if (isPlay) {
    const emQuadra = lista.filter((g) => !isFinishedPlayGame(g)).sort(byCourtThenOrder);
    const concluidos = lista
      .filter(isFinishedPlayGame)
      .sort((a, b) => Number(b.order || 0) - Number(a.order || 0))
      .slice(0, recentLimit);
    return {
      live: emQuadra,
      // No Play não existem jogos futuros gravados: quem vem a seguir sai da
      // ordem de participação, que o painel mostra em bloco próprio.
      upcoming: [],
      recent: concluidos,
      currentRound: null,
      isPlay: true,
      totals,
    };
  }

  const currentRound = currentRoundOf(lista);
  const pendentes = lista.filter((g) => !isDecided(g));

  // Sem rodada nenhuma (só partidas avulsas): tudo o que falta jogar é "agora".
  const live = currentRound == null
    ? pendentes.slice().sort(byCourtThenOrder)
    : pendentes.filter((g) => Number(g.round) === currentRound).sort(byCourtThenOrder);

  const upcoming = currentRound == null
    ? []
    : pendentes
      .filter((g) => Number(g.round) > currentRound)
      .sort((a, b) => (Number(a.round) - Number(b.round)) || byCourtThenOrder(a, b))
      .slice(0, upcomingLimit);

  const recent = lista.filter(isDecided).sort(byMostRecent).slice(0, recentLimit);

  return { live, upcoming, recent, currentRound, isPlay: false, totals };
}
