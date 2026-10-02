/**
 * periodReview — "Sua semana em revisão" e "Seu mês em revisão".
 *
 * O resumo do que a pessoa fez num período, com comparação com o anterior —
 * o gancho de retorno semanal que Strava, Duolingo e Whoop usam. É a pergunta
 * "como foi minha semana?" respondida sem a pessoa abrir cinco telas.
 *
 * Tudo é DERIVADO de registros datados que já existem (jogos com data e
 * resultado, datas de kudos, avaliações, conquistas...). Nada é gravado:
 * a revisão de qualquer semana passada pode ser montada de novo e dá o mesmo
 * resultado.
 *
 * Três regras de honestidade:
 *  1. **Fonte que falhou não vira zero.** `incomplete` lista o que faltou e a
 *     tela avisa — "0 jogos" afirmado sobre dado que não carregou seria mentira.
 *  2. **Aproveitamento só com amostra.** Menos de 3 jogos com resultado conhecido
 *     não gera percentual: "100%" com 1 jogo é ruído, não informação.
 *  3. **Período vazio é dito com gentileza**, nunca como cobrança.
 *
 * Lógica pura, sem I/O.
 */
import {
  missionDateKey, platformWeekKey, platformMonthKey, addDaysToDateKey, dayStartMs,
} from './missionDay.js';
import { distinctDays } from './activityFacts.js';

export const MIN_GAMES_FOR_WIN_RATE = 3;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const dd = (chave) => chave.slice(8, 10);
const diaMes = (chave) => `${Number(dd(chave))} de ${MESES[Number(chave.slice(5, 7)) - 1]}`;

/**
 * A janela do período, no fuso da plataforma.
 *
 * @param {'week'|'month'} kind
 * @param {number} [offset] 0 = o período corrente (em andamento), -1 = o anterior...
 * @param {Date} [now]
 * @returns {{ kind: string, key: string, startMs: number, endMs: number, label: string, inProgress: boolean }}
 */
export function periodWindow(kind, offset = 0, now = new Date()) {
  if (kind === 'month') {
    const [y0, m0] = platformMonthKey(now).split('-').map(Number);
    const idx = y0 * 12 + (m0 - 1) + offset;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const chave = `${y}-${String(m).padStart(2, '0')}-01`;
    const prox = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const startMs = dayStartMs(chave);
    const endMs = dayStartMs(prox);
    return {
      kind, key: chave.slice(0, 7), startMs, endMs,
      label: `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} de ${y}`,
      inProgress: now.getTime() < endMs,
    };
  }
  const segunda = addDaysToDateKey(platformWeekKey(now), offset * 7);
  const domingo = addDaysToDateKey(segunda, 6);
  const startMs = dayStartMs(segunda);
  const endMs = dayStartMs(addDaysToDateKey(segunda, 7));
  return {
    kind: 'week', key: segunda, startMs, endMs,
    label: `${diaMes(segunda)} a ${diaMes(domingo)}`,
    inProgress: now.getTime() < endMs,
  };
}

const dentro = (w) => (ms) => Number.isFinite(ms) && ms >= w.startMs && ms < w.endMs;

/** Último rating conhecido até `ate` (ms). */
function ratingAte(pontos, ate) {
  let ultimo = null;
  (pontos || []).forEach((p) => {
    const at = Number(p?.at);
    const r = Number(p?.rating);
    if (Number.isFinite(at) && Number.isFinite(r) && at <= ate && (!ultimo || at >= ultimo.at)) ultimo = { at, r };
  });
  return ultimo ? ultimo.r : null;
}

/** Marcos de contagem (jogos, vitórias) cruzados dentro do período. */
const MARCOS_JOGOS = [1, 10, 25, 50, 100, 250, 500, 1000];

function marcosCruzados(totalAgora, noPeriodo, lista, rotulo) {
  const antes = Math.max(0, totalAgora - noPeriodo);
  return lista.filter((n) => antes < n && totalAgora >= n).map((n) => ({
    key: `${rotulo.id}_${n}`,
    text: rotulo.texto(n),
  }));
}

/**
 * @param {{
 *   kind: 'week'|'month', offset?: number, now?: Date,
 *   records: Array<{ at: number, won?: boolean|null, opponents?: string[], partner?: string }>,
 *   tournamentDates?: number[],
 *   facts?: ReturnType<import('./activityFacts.js').buildActivityFacts>|null,
 *   achievements?: Array<{ achievementId: string, unlockedAt: number, rarity?: string }>,
 *   missionDocs?: Array<{ scope?: string, date?: string, missions?: Array<object> }>,
 *   ratingPoints?: Array<{ at: number, rating: number }>,
 *   totals?: { games?: number, wins?: number },
 *   streakWeeks?: number,
 *   nextAchievement?: { id: string, name: string, progress: number } | null,
 *   incompleteSources?: string[],
 * }} input
 */
export function buildPeriodReview(input = {}) {
  const {
    kind = 'week', offset = 0, now = new Date(), records = [], tournamentDates = [],
    facts = null, achievements = [], missionDocs = [], ratingPoints = [], totals = {},
    streakWeeks = 0, nextAchievement = null, incompleteSources = [],
  } = input;
  const w = periodWindow(kind, offset, now);
  const anterior = periodWindow(kind, offset - 1, now);
  const emW = dentro(w);
  const emAnt = dentro(anterior);

  const jogos = records.filter((r) => emW(Number(r?.at)));
  const jogosAnt = records.filter((r) => emAnt(Number(r?.at)));
  const comResultado = jogos.filter((r) => typeof r.won === 'boolean');
  const vitorias = comResultado.filter((r) => r.won).length;
  const vitoriasAnt = jogosAnt.filter((r) => r.won === true).length;
  const aproveitamento = comResultado.length >= MIN_GAMES_FOR_WIN_RATE
    ? Math.round((vitorias / comResultado.length) * 100) : null;

  const parceiros = new Set();
  const adversarios = new Set();
  jogos.forEach((r) => {
    String(r.partner || '').split(' / ').map((s) => s.trim()).filter(Boolean).forEach((p) => parceiros.add(p));
    (Array.isArray(r.opponents) ? r.opponents : []).map((s) => String(s).trim()).filter(Boolean).forEach((p) => adversarios.add(p));
  });

  const fatos = facts?.dates || {};
  const contar = (datas) => (datas || []).filter(emW).length;
  const diasAtivos = distinctDays(jogos.map((r) => r.at)).size;
  const torneios = distinctDays((tournamentDates || []).filter(emW)).size;

  const novasConquistas = achievements
    .filter((a) => emW(Number(a?.unlockedAt)))
    .map((a) => ({ id: a.achievementId, rarity: a.rarity || null }));

  let missoesFeitas = 0;
  missionDocs.forEach((d) => {
    if (!d || !Array.isArray(d.missions)) return;
    // O documento diário tem a data do dia; semanal/mensal, a chave do período.
    const ref = d.scope === 'daily' || !d.scope ? d.date : null;
    if (ref) {
      const ms = dayStartMs(String(ref).slice(0, 10));
      if (!emW(ms)) return;
    } else if (d.scope === 'weekly') {
      if (kind !== 'week' || d.date !== w.key) return;
    } else if (d.scope === 'monthly') {
      if (kind !== 'month' || String(d.date).slice(0, 7) !== w.key) return;
    } else return;
    missoesFeitas += d.missions.filter((m) => (Number(m.current) || 0) >= (Number(m.target) || 1)).length;
  });

  const ratingFim = ratingAte(ratingPoints, Math.min(now.getTime(), w.endMs));
  const ratingIni = ratingAte(ratingPoints, w.startMs);
  const ratingDelta = ratingFim != null && ratingIni != null ? Math.round(ratingFim - ratingIni) : null;

  const totalJogos = Number(totals.games) || 0;
  const totalVitorias = Number(totals.wins) || 0;
  const marcos = [
    ...marcosCruzados(totalJogos, jogos.length, MARCOS_JOGOS, { id: 'games', texto: (n) => (n === 1 ? 'Seu primeiro jogo!' : `Seu ${n}º jogo!`) }),
    ...marcosCruzados(totalVitorias, vitorias, [1, 10, 25, 50, 100], { id: 'wins', texto: (n) => (n === 1 ? 'Sua primeira vitória!' : `${n} vitórias na carreira!`) }),
  ];

  const review = {
    window: w,
    previous: anterior,
    games: jogos.length,
    gamesPrev: jogosAnt.length,
    gamesDelta: jogos.length - jogosAnt.length,
    wins: vitorias,
    losses: comResultado.length - vitorias,
    winsPrev: vitoriasAnt,
    knownResults: comResultado.length,
    winRate: aproveitamento,
    activeDays: diasAtivos,
    tournaments: torneios,
    partners: parceiros.size,
    opponents: adversarios.size,
    kudosGiven: contar(fatos.kudosGiven),
    reviewsGiven: contar(fatos.matchReviews),
    lettersSent: contar(fatos.letters),
    bookings: contar(fatos.bookings),
    lessons: contar(fatos.lessons),
    follows: contar(fatos.follows),
    newAchievements: novasConquistas,
    missionsDone: missoesFeitas,
    ratingDelta,
    milestones: marcos,
    streakWeeks,
    nextAchievement,
    incomplete: [...incompleteSources],
  };
  review.isEmpty = review.games === 0 && review.kudosGiven === 0 && review.bookings === 0
    && review.lessons === 0 && review.newAchievements.length === 0 && review.missionsDone === 0
    && review.follows === 0 && review.reviewsGiven === 0;
  return review;
}

const plural = (n, um, varios) => (n === 1 ? um : varios);

/**
 * As linhas de destaque, em pt-BR, na ordem em que importam. Só entra o que
 * tem número — linha com "0" não é destaque, é ruído.
 *
 * @param {object} r saída de `buildPeriodReview`
 * @param {{ nameOf?: (achievementId: string) => string }} [opts] nome de exibição da conquista
 * @returns {Array<{ id: string, icon: string, text: string, tone: 'good'|'neutral'|'info' }>}
 */
export function reviewHighlights(r, { nameOf = (id) => id } = {}) {
  if (!r) return [];
  const vs = r.window.kind === 'month' ? 'o mês passado' : 'a semana passada';
  const out = [];
  if (r.games > 0) {
    const d = r.gamesDelta;
    const comp = r.gamesPrev === 0 && d > 0 ? '' : d === 0 ? ` (igual a ${vs})`
      : ` (${d > 0 ? '+' : ''}${d} que ${vs})`;
    out.push({ id: 'games', icon: '🎾', tone: 'neutral', text: `${r.games} ${plural(r.games, 'jogo', 'jogos')}${comp}` });
  }
  if (r.winRate != null) {
    out.push({ id: 'winrate', icon: '🏆', tone: r.winRate >= 50 ? 'good' : 'neutral', text: `${r.wins} ${plural(r.wins, 'vitória', 'vitórias')} · ${r.winRate}% de aproveitamento` });
  } else if (r.wins > 0) {
    out.push({ id: 'wins', icon: '🏆', tone: 'good', text: `${r.wins} ${plural(r.wins, 'vitória', 'vitórias')}` });
  }
  if (r.activeDays >= 2) out.push({ id: 'days', icon: '📅', tone: 'neutral', text: `Jogou em ${r.activeDays} dias diferentes` });
  if (r.tournaments > 0) out.push({ id: 'tournaments', icon: '🥇', tone: 'neutral', text: `${r.tournaments} ${plural(r.tournaments, 'dia de torneio', 'dias de torneio')}` });
  if (r.partners >= 2) out.push({ id: 'partners', icon: '🤝', tone: 'neutral', text: `Jogou com ${r.partners} parceiros diferentes` });
  if (r.ratingDelta != null && r.ratingDelta !== 0) {
    out.push({ id: 'rating', icon: r.ratingDelta > 0 ? '📈' : '📉', tone: r.ratingDelta > 0 ? 'good' : 'neutral', text: `Rating ${r.ratingDelta > 0 ? 'subiu' : 'caiu'} ${Math.abs(r.ratingDelta)} ${plural(Math.abs(r.ratingDelta), 'ponto', 'pontos')}` });
  }
  if (r.bookings > 0) out.push({ id: 'bookings', icon: '🏟️', tone: 'neutral', text: `${r.bookings} ${plural(r.bookings, 'reserva de quadra jogada', 'reservas de quadra jogadas')}` });
  if (r.lessons > 0) out.push({ id: 'lessons', icon: '🎓', tone: 'neutral', text: `${r.lessons} ${plural(r.lessons, 'aula', 'aulas')} com professor` });
  if (r.kudosGiven > 0) out.push({ id: 'kudos', icon: '👏', tone: 'neutral', text: `${r.kudosGiven} ${plural(r.kudosGiven, 'kudo dado', 'kudos dados')}` });
  if (r.reviewsGiven + r.lettersSent > 0) out.push({ id: 'social', icon: '💬', tone: 'neutral', text: `${r.reviewsGiven} ${plural(r.reviewsGiven, 'avaliação', 'avaliações')} e ${r.lettersSent} ${plural(r.lettersSent, 'carta', 'cartas')} aos companheiros` });
  if (r.missionsDone > 0) out.push({ id: 'missions', icon: '🎯', tone: 'good', text: `${r.missionsDone} ${plural(r.missionsDone, 'missão cumprida', 'missões cumpridas')}` });
  r.newAchievements.forEach((a) => out.push({ id: `ach_${a.id}`, icon: '🏅', tone: 'good', text: `Conquista desbloqueada: ${nameOf(a.id)}`, achievementId: a.id }));
  r.milestones.forEach((m) => out.push({ id: m.key, icon: '✨', tone: 'good', text: m.text }));
  return out;
}

/** A mensagem de abertura, calibrada para o que aconteceu (e nunca cobra). */
export function reviewHeadline(r) {
  if (!r) return '';
  const quando = r.window.kind === 'month' ? 'neste mês' : 'nesta semana';
  if (r.isEmpty) {
    return r.window.inProgress
      ? `Ainda sem registros ${quando}. Um jogo já muda isso.`
      : `Foi um período tranquilo. Quando voltar à quadra, a revisão volta com você.`;
  }
  if (r.milestones.length > 0) return r.milestones[0].text;
  if (r.newAchievements.length > 0) return `Você desbloqueou ${r.newAchievements.length} ${plural(r.newAchievements.length, 'conquista', 'conquistas')} ${quando}.`;
  if (r.gamesDelta > 0 && r.gamesPrev > 0) return `Você jogou mais que no período anterior. Bom ritmo.`;
  if (r.games > 0) return `Você jogou ${r.games} ${plural(r.games, 'vez', 'vezes')} ${quando}.`;
  return `Você esteve ativo ${quando}.`;
}

/** A chave do dia, reexportada para a tela formatar sem importar dois módulos. */
export { missionDateKey };
