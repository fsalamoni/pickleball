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


import { isMeasurableMetric } from './missionMetrics.js';
import { missionDateKey } from './missionDay.js';

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
  // ─── DIÁRIAS ─────────────────────────────────────────────────────
  // `category`: o gerador garante ao menos uma missão de JOGO e uma SOCIAL.
  // `module`: o módulo do admin de que a missão depende (desligado = não sai).
  { id: 'daily_play_1',      metric: 'game_played',       target: 1,  xpReward: 30,  weight: 10, tier: null, category: 'play' },
  { id: 'daily_play_3',      metric: 'game_played',       target: 3,  xpReward: 60,  weight: 6,  tier: null, category: 'play' },
  { id: 'daily_game_day_1',  metric: 'game_day_attended', target: 1,  xpReward: 30,  weight: 6,  tier: null, category: 'play' },
  { id: 'daily_kudos_3',     metric: 'kudos_given',       target: 3,  xpReward: 20,  weight: 9,  tier: null, category: 'social' },
  { id: 'daily_follow_2',    metric: 'follow_made',       target: 2,  xpReward: 20,  weight: 8,  tier: null, category: 'social' },
  { id: 'daily_review_1',    metric: 'review_given',      target: 1,  xpReward: 25,  weight: 7,  tier: null, category: 'social', module: 'match_reviews' },

  // ─── SEMANAIS ────────────────────────────────────────────────────
  { id: 'weekly_play_3',      metric: 'game_played',       target: 3,  xpReward: 100, weight: 10, tier: null, category: 'play' },
  { id: 'weekly_play_7',      metric: 'game_played',       target: 7,  xpReward: 200, weight: 6,  tier: 'Aprendiz', category: 'play' },
  { id: 'weekly_tournament',  metric: 'tournament_attended', target: 1, xpReward: 150, weight: 7, tier: null, category: 'play' },
  { id: 'weekly_game_days_2', metric: 'game_day_attended', target: 2,  xpReward: 100, weight: 8,  tier: null, category: 'play' },
  { id: 'weekly_active_days_3', metric: 'active_days',     target: 3,  xpReward: 120, weight: 8,  tier: null, category: 'play' },
  { id: 'weekly_kudos_10',    metric: 'kudos_given',       target: 10, xpReward: 50,  weight: 7,  tier: null, category: 'social' },
  { id: 'weekly_follow_3',    metric: 'follow_made',       target: 3,  xpReward: 60,  weight: 7,  tier: null, category: 'social' },
  { id: 'weekly_review_2',    metric: 'review_given',      target: 2,  xpReward: 60,  weight: 7,  tier: null, category: 'social', module: 'match_reviews' },
  { id: 'weekly_letter_1',    metric: 'letter_sent',       target: 1,  xpReward: 50,  weight: 5,  tier: null, category: 'social', module: 'partner_letters' },
  { id: 'weekly_booking_1',   metric: 'booking_attended',  target: 1,  xpReward: 80,  weight: 7,  tier: null, category: 'discover' },
  { id: 'weekly_lesson_1',    metric: 'lesson_attended',   target: 1,  xpReward: 100, weight: 5,  tier: null, category: 'discover' },

  // ─── MENSAIS ─────────────────────────────────────────────────────
  { id: 'monthly_play_15',    metric: 'game_played',       target: 15, xpReward: 500, weight: 8,  tier: null, category: 'play' },
  { id: 'monthly_play_30',    metric: 'game_played',       target: 30, xpReward: 1000, weight: 6, tier: 'Aprendiz', category: 'play' },
  { id: 'monthly_tournaments_2', metric: 'tournament_attended', target: 2, xpReward: 300, weight: 8, tier: null, category: 'play' },
  { id: 'monthly_active_days_8', metric: 'active_days',    target: 8,  xpReward: 400, weight: 7,  tier: null, category: 'play' },
  { id: 'monthly_kudos_20',   metric: 'kudos_given',       target: 20, xpReward: 150, weight: 6,  tier: null, category: 'social' },
  { id: 'monthly_follow_5',   metric: 'follow_made',       target: 5,  xpReward: 100, weight: 7,  tier: null, category: 'social' },
  { id: 'monthly_reviews_5',  metric: 'review_given',      target: 5,  xpReward: 150, weight: 6,  tier: null, category: 'social', module: 'match_reviews' },
  { id: 'monthly_letters_2',  metric: 'letter_sent',       target: 2,  xpReward: 100, weight: 4,  tier: null, category: 'social', module: 'partner_letters' },
  { id: 'monthly_referral_3', metric: 'referral_signed_up', target: 3, xpReward: 500, weight: 5,  tier: null, category: 'social' },
  { id: 'monthly_arena_3',    metric: 'booking_attended',  target: 3,  xpReward: 250, weight: 7,  tier: null, category: 'discover' },
  { id: 'monthly_lesson_1',   metric: 'lesson_attended',   target: 1,  xpReward: 200, weight: 6,  tier: null, category: 'discover' },
  { id: 'monthly_review_arena_2', metric: 'arena_reviewed', target: 2, xpReward: 150, weight: 5,  tier: null, category: 'discover' },
  { id: 'monthly_clinic_1',   metric: 'clinic_attended',   target: 1,  xpReward: 150, weight: 4,  tier: null, category: 'discover' },
  { id: 'monthly_challenge_1', metric: 'challenge_joined', target: 1,  xpReward: 120, weight: 5,  tier: null, category: 'discover', module: 'challenges' },
]);

/** O catálogo (somente leitura) — a Central do admin e os testes o consultam. */
export const MISSION_CATALOG = MISSION_TEMPLATES;

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
function pickTemplates({
  count, pool, tier = null, seed = Date.now(), excludeIds = [], required = [],
}) {
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

  const remaining = [...eligible];
  const selected = [];
  const sortearUm = (candidatos) => {
    const totalWeight = candidatos.reduce((acc, t) => acc + (t.weight || 1), 0);
    let pick = rand() * totalWeight;
    for (const t of candidatos) {
      pick -= (t.weight || 1);
      if (pick <= 0) return t;
    }
    return candidatos[candidatos.length - 1];
  };

  // 1º: garante o equilíbrio — uma missão de cada categoria exigida (quando
  // existe candidata). Sem isto o sorteio podia entregar três missões de
  // "dar kudos" no mesmo dia, e ninguém joga para cumpri-las.
  for (const [categoria, minimo] of required) {
    for (let i = 0; i < minimo && selected.length < count; i += 1) {
      const candidatos = remaining.filter((t) => t.category === categoria);
      if (candidatos.length === 0) break;
      const escolhida = sortearUm(candidatos);
      selected.push(escolhida);
      remaining.splice(remaining.indexOf(escolhida), 1);
    }
  }
  // 2º: o resto, por peso.
  while (selected.length < count && remaining.length > 0) {
    const escolhida = sortearUm(remaining);
    selected.push(escolhida);
    remaining.splice(remaining.indexOf(escolhida), 1);
  }
  return selected;
}

/** Quantas de cada categoria o escopo garante (ordem = prioridade). */
const REQUIRED_BY_SCOPE = Object.freeze({
  daily: [['play', 1], ['social', 1]],
  weekly: [['play', 2], ['social', 1], ['discover', 1]],
  monthly: [['play', 2], ['social', 2], ['discover', 2]],
});

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
/**
 * Rótulo humano da missão, em pt-BR.
 *
 * Os templates guardam só a métrica e o alvo — não o texto. Sem isto,
 * `description` saía `undefined`, o Firestore recusava o documento inteiro
 * ("Unsupported field value: undefined") e NENHUMA missão era criada.
 *
 * @param {{ metric: string, target: number }} t
 * @returns {{ title: string, description: string }}
 */
export function missionLabel({ metric, target = 1 } = {}) {
  const n = Math.max(1, Number(target) || 1);
  const plural = n > 1;
  const textos = {
    game_played: {
      title: plural ? `Jogue ${n} partidas` : 'Jogue 1 partida',
      description: plural
        ? `Dispute ${n} partidas — de torneio ou de dia de jogo.`
        : 'Dispute uma partida — de torneio ou de dia de jogo.',
    },
    game_day_attended: {
      title: plural ? `Participe de ${n} dias de jogo` : 'Participe de um dia de jogo',
      description: plural
        ? `Entre em quadra em ${n} dias de jogo.`
        : 'Entre em quadra num dia de jogo.',
    },
    tournament_attended: {
      title: plural ? `Dispute ${n} torneios` : 'Dispute um torneio',
      description: plural
        ? `Participe de ${n} torneios.`
        : 'Participe de um torneio.',
    },
    kudos_given: {
      title: plural ? `Dê ${n} kudos` : 'Dê 1 kudo',
      description: plural
        ? `Reconheça ${n} atletas com um 👏.`
        : 'Reconheça um atleta com um 👏.',
    },
    referral_signed_up: {
      title: plural ? `Convide ${n} amigos` : 'Convide um amigo',
      description: plural
        ? `${n} amigos entram na plataforma pelo seu convite.`
        : 'Um amigo entra na plataforma pelo seu convite.',
    },
    active_days: {
      title: `Jogue em ${n} dias diferentes`,
      description: `Entre em quadra em ${n} dias diferentes — constância vale mais que maratona.`,
    },
    follow_made: {
      title: plural ? `Siga ${n} atletas` : 'Siga 1 atleta',
      description: 'Descubra atletas na lista e comece a seguir quem joga perto de você.',
    },
    booking_attended: {
      title: plural ? `Jogue em ${n} reservas de quadra` : 'Jogue numa reserva de quadra',
      description: 'Reserve uma quadra numa arena e vá jogar — reserva concluída conta.',
    },
    lesson_attended: {
      title: plural ? `Faça ${n} aulas` : 'Faça uma aula',
      description: 'Uma aula com um professor da plataforma, marcada como concluída.',
    },
    arena_reviewed: {
      title: plural ? `Avalie ${n} arenas` : 'Avalie uma arena',
      description: 'Conte como foi jogar numa arena — a avaliação ajuda quem vem depois.',
    },
    clinic_attended: {
      title: plural ? `Participe de ${n} clínicas` : 'Participe de uma clínica',
      description: 'Inscreva-se numa clínica ou workshop de um professor.',
    },
    review_given: {
      title: plural ? `Avalie ${n} jogos` : 'Avalie um jogo',
      description: 'Depois do jogo, avalie o companheiro e os adversários — é rápido.',
    },
    letter_sent: {
      title: plural ? `Escreva ${n} cartas ao companheiro` : 'Escreva uma carta ao companheiro',
      description: 'Uma frase para o parceiro de dupla depois do jogo. Anônima por padrão.',
    },
    challenge_joined: {
      title: plural ? `Entre em ${n} desafios` : 'Entre num desafio',
      description: 'Participe de um desafio da plataforma, de um clube ou de uma arena.',
    },
  };
  return textos[metric] || {
    title: `Complete ${n}`,
    description: `Chegue a ${n} nesta missão.`,
  };
}

function instantiateMissions(templates, options = {}) {
  const {
    date = new Date(),
    startOfDayMs = null,
    endOfDayMs = null,
    uid = '',
    scope = 'daily',
  } = options;

  return templates.map((t, i) => {
    const { title, description } = missionLabel(t);
    return {
    id: `${uid}_${scope}_${missionDateKey(date)}_${t.id}`,
    templateId: t.id,
    title,
    description,
    metric: t.metric,
    target: t.target,
    current: 0,
    done: false,
    xpReward: t.xpReward,
    scope,
    expiresAt: endOfDayMs || (date.getTime() + DAY_MS),
    startedAt: startOfDayMs || date.getTime(),
    order: i,
    };
  });
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
export function generateMissions({
  uid, scope, currentTier = null, now = new Date(), excludeIds = [], seed = null, modules = null,
}) {
  const counts = { daily: 3, weekly: 5, monthly: 8 };
  const count = counts[scope] || 3;

  const pool = MISSION_TEMPLATES.filter((t) => {
    // Templates marcados com scope compatível:
    // daily → id começa com 'daily_'
    // weekly → id começa com 'weekly_'
    // monthly → id começa com 'monthly_'
    if (!t.id.startsWith(`${scope}_`)) return false;
    // E, principalmente: só entra missão cuja métrica a plataforma sabe
    // MEDIR. Missão de métrica não medível ficaria parada em 0 para sempre
    // (ou dependeria do usuário marcar sozinho, que era o furo antigo).
    if (t.module && modules && modules[t.module] === false) return false;
    return isMeasurableMetric(t.metric, scope);
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
    required: REQUIRED_BY_SCOPE[scope] || [],
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
