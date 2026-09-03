/**
 * Missões (lógica pura, sem I/O).
 *
 * Sistema de missões diárias, semanais e mensais:
 *  - **Diárias**: 3 missões curtas (~5 min cada), expiram à meia-noite.
 *  - **Semanais**: 5 missões (~30 min), expiram domingo 23:59.
 *  - **Mensais**: 10 missões, expiram último dia do mês.
 *
 * **O QUE MUDA vs V1 (não existe)**:
 *  - É um sistema NOVO. Não há missões V1.
 *  - Tudo aditivo, gated por flag `MISSIONS_V2`.
 *
 * **Algoritmo**:
 *  1. Catálogo de missões "template" (não pré-feitas).
 *  2. Gerador pega 3-5-10 templates e devolve missões concretas com prazo.
 *  3. Cada missão tem: `id`, `description`, `target`, `current`, `done`, `xpReward`.
 *  4. O usuário incrementa `current` via eventos; quando `current >= target`,
 *     `done = true` e `xpReward` é creditado.
 */


const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Catálogo de missões "template" (não pré-feitas).
 * O gerador pega algumas e instancia.
 *
 * Cada template tem:
 *  - `id` (string)
 *  - `description` (string, pt-BR)
 *  - `metric` (chave em XP_WEIGHTS_V2 ou campo de stats)
 *  - `target` (quantidade)
 *  - `xpReward` (XP ao completar)
 *  - `weight` (probabilidade de ser sorteado; maior = mais provável)
 *  - `tier` (mín. do tier do user; null = qualquer um)
 */
const MISSION_TEMPLATES = Object.freeze([
  // ─── DIÁRIAS (curtas, alto peso) ─────────────────────────────────
  { id: 'daily_play_1',      metric: 'game_played',     target: 1,  xpReward: 30,  weight: 10, tier: null },
  { id: 'daily_play_3',      metric: 'game_played',     target: 3,  xpReward: 60,  weight: 8,  tier: null },
  { id: 'daily_kudos_3',     metric: 'kudos_given',     target: 3,  xpReward: 20,  weight: 9,  tier: null },
  { id: 'daily_visit_athlete', metric: 'discover_athlete', target: 1, xpReward: 20, weight: 8, tier: null },
  { id: 'daily_chat',        metric: 'chat_message',    target: 1,  xpReward: 15,  weight: 9,  tier: null },
  { id: 'daily_first_action', metric: 'daily_first_action', target: 1, xpReward: 20, weight: 10, tier: null },
  { id: 'daily_share',       metric: 'share_card_generated', target: 1, xpReward: 10, weight: 6, tier: null },

  // ─── SEMANAIS (médias, xpReward maior) ──────────────────────────
  { id: 'weekly_play_3',     metric: 'game_played',     target: 3,  xpReward: 100, weight: 10, tier: null },
  { id: 'weekly_play_7',     metric: 'game_played',     target: 7,  xpReward: 200, weight: 8,  tier: null },
  { id: 'weekly_tournament', metric: 'tournament_attended', target: 1, xpReward: 150, weight: 9, tier: null },
  { id: 'weekly_publish_game_day', metric: 'game_day_attended', target: 2, xpReward: 100, weight: 8, tier: null },
  { id: 'weekly_invite_1',   metric: 'referral_signed_up', target: 1, xpReward: 100, weight: 7, tier: null },
  { id: 'weekly_arena_1',    metric: 'booking_attended', target: 1, xpReward: 80, weight: 8, tier: null },
  { id: 'weekly_kudos_10',   metric: 'kudos_given',     target: 10, xpReward: 50,  weight: 9, tier: null },
  { id: 'weekly_post_1',     metric: 'forum_post',      target: 1,  xpReward: 50,  weight: 7, tier: null },
  { id: 'weekly_results_3',  metric: 'game_result_logged', target: 3, xpReward: 80, weight: 7, tier: null },

  // ─── MENSAIS (longas, xpReward alto) ────────────────────────────
  { id: 'monthly_play_15',   metric: 'game_played',     target: 15, xpReward: 500, weight: 8, tier: null },
  { id: 'monthly_play_30',   metric: 'game_played',     target: 30, xpReward: 1000, weight: 6, tier: 'Aprendiz' },
  { id: 'monthly_tournaments_2', metric: 'tournament_attended', target: 2, xpReward: 300, weight: 8, tier: null },
  { id: 'monthly_club_event', metric: 'club_event_rsvp', target: 1, xpReward: 200, weight: 7, tier: null },
  { id: 'monthly_club_post',  metric: 'club_post',     target: 1,  xpReward: 100, weight: 7, tier: null },
  { id: 'monthly_lesson_1',   metric: 'lesson_attended', target: 1, xpReward: 200, weight: 6, tier: null },
  { id: 'monthly_arena_3',   metric: 'booking_attended', target: 3, xpReward: 250, weight: 7, tier: null },
  { id: 'monthly_referral_3', metric: 'referral_signed_up', target: 3, xpReward: 500, weight: 5, tier: null },
  { id: 'monthly_follow_5',  metric: 'follow_first',   target: 5,  xpReward: 100, weight: 7, tier: null },
  { id: 'monthly_review_2',  metric: 'arena_reviewed', target: 2,  xpReward: 150, weight: 6, tier: null },
]);

/**
 * Mapa de tiers (string → ordinal) para validar o tier mínimo.
 * Calouro = 0 (mais baixo). Cada tier "real" depois incrementa.
 * Templates com `tier: 'Aprendiz'` aceitam Aprendiz OU superior
 * (NÃO Calouro).
 */
const TIER_ORDINAL = {
  'Calouro': 0,
  'Aprendiz': 1,
  'Jogador': 2,
  'Regular': 3,
  'Veterano': 4,
  'Expert': 5,
  'Elite': 6,
  'Lenda': 7,
  'Imortal': 8,
};

/**
 * Missão template é compatível com o tier do user?
 */
function templateMatchesTier(template, currentTier) {
  if (!template.tier) return true;
  const req = TIER_ORDINAL[template.tier] || 0;
  const cur = TIER_ORDINAL[currentTier] || 0;
  return cur >= req;
}

/**
 * Gerador determinístico (seeded) de missões.
 * Pega N templates aleatórios, respeitando pesos e tier do user.
 *
 * @param {{
 *   count: number,
 *   pool: Array<object>,  // templates
 *   tier?: string,        // tier do user
 *   seed?: number,        // semente pra determinismo (default: ts do dia)
 *   excludeIds?: string[], // ids já usados hoje
 * }} options
 * @returns {Array<object>} N templates selecionados
 */
function pickTemplates({ count, pool, tier = null, seed = Date.now(), excludeIds = [] }) {
  const eligible = pool.filter((t) => {
    if (excludeIds.includes(t.id)) return false;
    if (tier && !templateMatchesTier(t, tier)) return false;
    return true;
  });
  if (eligible.length === 0) return [];

  // PRNG determinístico (Mulberry32)
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const selected = [];
  const remaining = [...eligible];

  while (selected.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((s, t) => s + (t.weight || 1), 0);
    let pick = rand() * totalWeight;
    for (let i = 0; i < remaining.length; i += 1) {
      pick -= (remaining[i].weight || 1);
      if (pick <= 0) {
        selected.push(remaining[i]);
        remaining.splice(i, 1);
        break;
      }
    }
  }

  return selected;
}

/**
 * Constrói missões a partir de templates.
 *
 * @param {Array<object>} templates
 * @param {{
 *   date?: Date,
 *   startOfDayMs?: number,
 *   endOfDayMs?: number,
 *   uid?: string,
 *   scope?: 'daily'|'weekly'|'monthly',
 * }} options
 * @returns {Array<object>} missões instanciadas
 */
function instantiateMissions(templates, options = {}) {
  const {
    date = new Date(),
    startOfDayMs = null,
    endOfDayMs = null,
    uid = '',
    scope = 'daily',
  } = options;

  return templates.map((t, i) => ({
    id: `${uid}_${scope}_${date.toISOString().slice(0, 10)}_${t.id}`,
    templateId: t.id,
    description: t.description,
    metric: t.metric,
    target: t.target,
    current: 0,
    done: false,
    xpReward: t.xpReward,
    scope,
    expiresAt: endOfDayMs || (date.getTime() + DAY_MS),
    startedAt: startOfDayMs || date.getTime(),
    order: i,
  }));
}

/**
 * Calcula a janela de tempo de uma missão baseada no escopo.
 *
 * @param {'daily'|'weekly'|'monthly'} scope
 * @param {Date} [now]
 * @returns {{ startMs: number, endMs: number }}
 */
export function missionWindow(scope, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (scope === 'daily') {
    return { startMs: d.getTime(), endMs: d.getTime() + DAY_MS };
  }
  if (scope === 'weekly') {
    // semana começa segunda
    const day = d.getDay() || 7; // dom = 7
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day - 1));
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return { startMs: monday.getTime(), endMs: nextMonday.getTime() };
  }
  if (scope === 'monthly') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }
  // fallback diário
  return { startMs: d.getTime(), endMs: d.getTime() + DAY_MS };
}

/**
 * Gera missões para um user.
 *
 * @param {{
 *   uid: string,
 *   scope: 'daily'|'weekly'|'monthly',
 *   currentTier?: string,
 *   now?: Date,
 *   excludeIds?: string[],
 *   seed?: number,
 * }} options
 * @returns {Array<object>}
 */
export function generateMissions({ uid, scope, currentTier = null, now = new Date(), excludeIds = [], seed = null }) {
  const counts = { daily: 3, weekly: 5, monthly: 10 };
  const count = counts[scope] || 3;

  const pool = MISSION_TEMPLATES.filter((t) => {
    // Templates marcados com scope compatível:
    // daily → id começa com 'daily_'
    // weekly → id começa com 'weekly_'
    // monthly → id começa com 'monthly_'
    return t.id.startsWith(`${scope}_`);
  });

  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const { startMs, endMs } = missionWindow(scope, now);
  const effectiveSeed = seed !== null ? seed : date.getTime() + (scope === 'daily' ? 0 : scope === 'weekly' ? 1 : 2);

  const templates = pickTemplates({
    count,
    pool,
    tier: currentTier,
    seed: effectiveSeed,
    excludeIds,
  });

  return instantiateMissions(templates, {
    date,
    startOfDayMs: startMs,
    endOfDayMs: endMs,
    uid,
    scope,
  });
}

/**
 * Atualiza o progresso de uma missão.
 *
 * @param {object} mission
 * @param {number} delta
 * @returns {object} missão atualizada
 */
export function progressMission(mission, delta = 1) {
  if (!mission) return null;
  const current = Math.max(0, (mission.current || 0) + (Number(delta) || 0));
  const target = mission.target || 1;
  const done = current >= target;
  return {
    ...mission,
    current,
    done,
    xpEarned: done && !mission.xpEarned ? mission.xpReward : (mission.xpEarned || 0),
  };
}

/**
 * Calcula XP total ganho em missões completadas.
 */
export function totalMissionXp(missions = []) {
  return (missions || []).reduce((s, m) => s + (m.xpEarned || 0), 0);
}

/**
 * Calcula progresso agregado de missões (0-1).
 */
export function missionsProgress(missions = []) {
  const list = missions || [];
  if (list.length === 0) return 0;
  const total = list.reduce((s, m) => s + (m.target || 1), 0);
  const done = list.reduce((s, m) => s + Math.min(m.current || 0, m.target || 1), 0);
  return total > 0 ? Math.min(1, done / total) : 0;
}

/**
 * Bônus por completar TODAS as missões de um escopo.
 */
export const MISSION_BONUS_XP = Object.freeze({
  daily: 50,
  weekly: 250,
  monthly: 1000,
});

/**
 * Estado de missões resumido.
 */
export function summarizeMissions(missions = []) {
  const list = missions || [];
  return {
    total: list.length,
    done: list.filter((m) => m.done).length,
    progress: missionsProgress(list),
    xpEarned: totalMissionXp(list),
  };
}
