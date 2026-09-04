/**
 * missionMetrics — progresso de missão a partir da ATIVIDADE REAL.
 *
 * Por que existe: as missões nasceram com um botão "+1" que o próprio usuário
 * clicava para marcar progresso. Isso não é missão, é honra — dava para
 * completar "Jogue 3 partidas" sem entrar em quadra, e ainda creditava XP.
 *
 * Aqui o progresso é DERIVADO do que a plataforma já sabe: datas de partida,
 * torneios, kudos dados, indicações. O usuário não informa nada.
 *
 * **Regra de ouro**: só existe missão para métrica que sabemos medir.
 * `isMeasurableMetric` é a fonte da verdade — o gerador filtra por ela, então
 * nunca aparece na tela uma missão que jamais sairia de 0. Quando um módulo
 * novo passar a expor seu contador, some a métrica aqui e a missão volta
 * sozinha para o sorteio.
 *
 * Lógica pura, sem I/O.
 */
import { missionDateKey, platformMonthKey } from './missionDay.js';

/**
 * Métricas mensuráveis e em QUAIS escopos.
 *
 * O escopo importa: partidas têm data, então dá para recortar qualquer
 * janela. Kudos e indicações vêm de contadores acumulados (o índice guarda
 * "hoje", o código guarda "este mês") — fora dessas janelas não há como
 * recortar, e prometer a missão seria mentir.
 *
 * @type {Readonly<Record<string, { scopes: string[], fonte: string }>>}
 */
export const MEASURABLE_MISSION_METRICS = Object.freeze({
  game_played: {
    scopes: ['daily', 'weekly', 'monthly'],
    fonte: 'partidas de torneio (H2H) + jogos de dia de jogo',
  },
  game_day_attended: {
    scopes: ['daily', 'weekly', 'monthly'],
    fonte: 'datas dos jogos de dia de jogo',
  },
  tournament_attended: {
    scopes: ['daily', 'weekly', 'monthly'],
    fonte: 'datas de início dos torneios disputados',
  },
  kudos_given: {
    scopes: ['daily'],
    fonte: 'contador do dia no índice de kudos',
  },
  referral_signed_up: {
    scopes: ['monthly'],
    fonte: 'contador do mês no código de indicação',
  },
});

/**
 * A métrica é mensurável neste escopo?
 *
 * @param {string} metric
 * @param {'daily'|'weekly'|'monthly'} [scope] omitido = em qualquer escopo
 */
export function isMeasurableMetric(metric, scope = null) {
  const def = MEASURABLE_MISSION_METRICS[metric];
  if (!def) return false;
  return scope ? def.scopes.includes(scope) : true;
}

/**
 * Janela do escopo, no fuso da plataforma.
 * - `daily`: o dia corrente de Brasília
 * - `weekly`: os últimos 7 dias (inclusive hoje)
 * - `monthly`: o mês corrente de Brasília
 *
 * @param {'daily'|'weekly'|'monthly'} scope
 * @param {Date} now
 * @returns {(ms: number) => boolean} predicado "está na janela?"
 */
export function inScopeWindow(scope, now = new Date()) {
  if (scope === 'daily') {
    const hoje = missionDateKey(now);
    return (ms) => Number.isFinite(ms) && missionDateKey(new Date(ms)) === hoje;
  }
  if (scope === 'monthly') {
    const mes = platformMonthKey(now);
    return (ms) => Number.isFinite(ms) && platformMonthKey(new Date(ms)) === mes;
  }
  // weekly: 7 dias corridos terminando hoje
  const fim = now.getTime();
  const inicio = fim - 7 * 24 * 60 * 60 * 1000;
  return (ms) => Number.isFinite(ms) && ms > inicio && ms <= fim;
}

function contarNaJanela(datas, dentro) {
  if (!Array.isArray(datas)) return 0;
  let n = 0;
  for (const d of datas) {
    const ms = d instanceof Date ? d.getTime() : Number(d);
    if (dentro(ms)) n += 1;
  }
  return n;
}

/**
 * Conta, por métrica, quanto o atleta realmente fez na janela do escopo.
 *
 * Fontes ausentes contam 0 — nunca `undefined`, para o progresso jamais
 * "sumir" e reabrir uma missão já concluída.
 *
 * @param {{
 *   matchDates?: Array<number|Date>,
 *   gameDayDates?: Array<number|Date>,
 *   tournamentDates?: Array<number|Date>,
 *   kudoIndex?: { givenToday?: number, givenCount?: number, lastKudoDay?: string } | null,
 *   referralCode?: { monthlyCount?: number, monthKey?: string, totalSignups?: number } | null,
 * }} sources
 * @param {{ scope: 'daily'|'weekly'|'monthly', now?: Date }} options
 * @returns {Record<string, number>} métrica → quantidade feita na janela
 */
export function computeMissionMetrics(sources = {}, { scope = 'daily', now = new Date() } = {}) {
  const dentro = inScopeWindow(scope, now);

  // "Partida jogada" soma torneio E dia de jogo — é o mesmo critério de
  // `foldGameDayGamesIntoStats`, que já conta os dois em `stats.played`.
  // Contar só torneio deixaria a missão diária inalcançável para quem joga
  // apenas dia de jogo, que é a maioria.
  const metricas = {
    game_played: contarNaJanela(sources.matchDates, dentro)
      + contarNaJanela(sources.gameDayDates, dentro),
    game_day_attended: contarNaJanela(sources.gameDayDates, dentro),
    tournament_attended: contarNaJanela(sources.tournamentDates, dentro),
    kudos_given: 0,
    referral_signed_up: 0,
  };

  // Kudos: o índice só guarda o contador do DIA corrente. Fora do escopo
  // diário não dá para recortar a janela, então não fingimos que dá.
  const idx = sources.kudoIndex;
  if (scope === 'daily' && idx && idx.lastKudoDay === missionDateKey(now)) {
    metricas.kudos_given = Math.max(0, Number(idx.givenToday) || 0);
  }

  // Indicações: o código guarda o contador do mês corrente.
  const code = sources.referralCode;
  if (scope === 'monthly' && code && code.monthKey === platformMonthKey(now)) {
    metricas.referral_signed_up = Math.max(0, Number(code.monthlyCount) || 0);
  }

  return metricas;
}

/**
 * Aplica os contadores reais às missões do documento.
 *
 * O progresso **nunca regride**: se o atleta fez 3 jogos hoje e um resultado é
 * corrigido depois, a missão concluída continua concluída. Regredir tiraria do
 * usuário algo que ele já viu conquistado.
 *
 * @param {Array<object>} missions missões do documento persistido
 * @param {Record<string, number>} metricas saída de `computeMissionMetrics`
 * @returns {{ missions: Array<object>, changed: boolean }}
 */
export function applyRealProgress(missions = [], metricas = {}) {
  let changed = false;
  const out = missions.map((m) => {
    const medido = Number(metricas[m.metric]);
    if (!Number.isFinite(medido)) return m;
    const alvo = Number(m.target) || 1;
    const atual = Number(m.current) || 0;
    const proximo = Math.min(alvo, Math.max(atual, medido));
    if (proximo === atual) return m;
    changed = true;
    return { ...m, current: proximo };
  });
  return { missions: out, changed };
}

/**
 * Extrai as datas de atividade a partir das estruturas REAIS do app.
 *
 * Existe para que o formato dos dados fique num lugar só, testado contra o
 * shape verdadeiro. A versão anterior adivinhava os campos na página
 * (`played_at || created_at || date` para dia de jogo — nenhum deles existe),
 * e o resultado era uma lista vazia: a missão nunca saía de zero e nada
 * acusava o erro.
 *
 * Ambas as fontes já entregam milissegundos:
 *  - `usePlayerStats().history[].startsAtMillis` (participação em torneio)
 *  - `usePlayerStats().gameDayGames[].at` (jogo de dia de jogo)
 *
 * @param {{ history?: Array<object>, gameDayGames?: Array<object> }} stats
 * @returns {{ tournamentDates: number[], gameDayDates: number[] }}
 */
export function extractActivityDates({ history, gameDayGames } = {}) {
  const validos = (lista, campo) => (Array.isArray(lista) ? lista : [])
    .map((item) => Number(item?.[campo]))
    .filter((ms) => Number.isFinite(ms) && ms > 0);

  return {
    tournamentDates: validos(history, 'startsAtMillis'),
    gameDayDates: validos(gameDayGames, 'at'),
  };
}
