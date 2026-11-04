/**
 * Progressão do jogador V2 (lógica pura, sem I/O).
 *
 * **O QUE MUDA vs `progression.js` (V1)**:
 *  - XP multi-fonte: 40+ fontes diferentes (não só `played/wins/podiums/
 *    titles/tournaments`).
 *  - Caps anti-farm: diário, semanal, burst.
 *  - Mantém 100% compatibilidade numérica com V1 quando as fontes V1
 *    são usadas (escrita "shim" via `computeXpCompatV1`).
 *  - Funções novas: `computeXpV2`, `computeXpBySourceV2`,
 *    `computeDailyMissionProgress`, etc.
 *
 * **O QUE NÃO MUDA**:
 *  - `levelFromXp` (mesma curva incremental de 500*L).
 *  - `computeWeekStreak` (mesmo algoritmo).
 *  - `normalizeGoalInput` + `goalProgress` (mesmo).
 *  - Schema: novos campos do user_profile são OPCIONAIS e aditivos.
 *
 * **REGRA DE OURO**: NADA aqui altera o comportamento de quem importa
 * `progression.js` (V1). V2 convive lado a lado. Feature flag
 * `GAMIFICATION_V2` decide quem consome V2.
 *
 * Aditivo. Sem breaking change. Sem I/O.
 */

import { XP_WEIGHTS as V1_WEIGHTS } from './progression.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ────────────────────────────────────────────────────────────────────────────
// 1. PESOS DE XP V2 (multi-fonte)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Pesos de XP por fonte (V2). Cada chave é uma fonte específica que pode
 * gerar XP. Os valores são a quantidade de XP ganha por unidade daquela
 * fonte.
 *
 * **Convenção de nomes**: `<categoria>_<ação>`. Categorias:
 * - `tournament_*` — ações em torneios
 * - `game_*` — ações em jogos avulsos ou game-day
 * - `social_*` — follows, kudos, chat, comunidade
 * - `arena_*` — reservas e reviews de arena
 * - `coach_*` — aulas, pacotes, clínicas (lado aluno)
 * - `teacher_*` — aulas, clínicas, validações (lado professor)
 * - `club_*` — clubes, eventos, ranking interno
 * - `discovery_*` — onboarding, primeira vez, tour
 * - `referral_*` — convites da plataforma
 * - `bonus_*` — bônus fixos (daily login, completar missões)
 *
 * **Sinais negativos** são permitidos (punições leves): `arena_no_show`,
 * `arena_canceled_late`, `tournament_withdrew_late`.
 */
export const XP_WEIGHTS_V2 = Object.freeze({
  // ── TORNEIOS ──────────────────────────────────────────────────────
  tournament_attended: 30,
  tournament_podium: 40,
  tournament_title: 120,
  tournament_created: 200,
  tournament_16plus_created: 500,
  tournament_recurring_created: 1000,
  tournament_finished_fast: 100, // bônus se admin lança resultado em 24h
  tournament_withdrew_late: -20, // desistência após prazo

  // ── JOGOS AVULSOS / GAME-DAY ──────────────────────────────────────
  game_played: 10,
  game_won: 20,
  game_day_attended: 20,
  game_day_organized: 80,
  game_day_published_to_ranking: 50,
  game_result_logged: 15,
  game_open_published: 30,
  game_open_accepted: 15,
  game_mexicano_played: 5, // bônus por jogar Mexicano (formato especial)
  game_king_of_court_played: 5,

  // ── SOCIAL ────────────────────────────────────────────────────────
  follow_first: 10,
  followed_by_10: 100,
  kudos_given: 1, // cap diário
  kudos_received: 1, // cap diário
  chat_message: 1, // cap diário
  profile_completed: 100,
  profile_photo_added: 30,
  profile_cover_added: 30,
  profile_bio_added: 20,
  profile_quadrant_set: 20,
  share_card_generated: 10,
  help_newcomer_solution: 50,
  forum_post: 20,
  forum_comment: 10,
  poll_created: 30,
  newsfeed_post: 30,
  photo_posted: 20, // cap mensal

  // ── ARENA ─────────────────────────────────────────────────────────
  booking_first: 50,
  booking_attended: 30,
  booking_cancelled_late: -10,
  booking_no_show: -30,
  arena_reviewed: 30,
  arena_visited_first: 50,
  arena_referred: 200,
  arena_visited_3_different: 150,
  arena_visited_10_different: 1000,

  // ── PROFESSOR (aluno) ─────────────────────────────────────────────
  lesson_first: 80,
  lesson_attended: 40,
  package_purchased: 100,
  package_completed: 250, // 10 aulas completadas
  clinic_attended: 60,
  clinic_invited_friend: 40,
  level_validated_by_coach: 200,

  // ── PROFESSOR (lado supply) ───────────────────────────────────────
  teacher_first_lesson: 200,
  teacher_10_lessons_month: 500,
  teacher_lesson_attended: 30, // também conta para o prof
  teacher_validated_student: 30,
  teacher_clinic_created: 100,
  teacher_clinic_full_fast: 300, // lotou em 24h
  teacher_5star_20reviews: 1000,
  teacher_100_students: 1500,
  teacher_content_published: 50,
  teacher_package_seasonal: 200,

  // ── CLUBE ─────────────────────────────────────────────────────────
  club_joined: 50,
  club_created: 200,
  club_event_created: 100,
  club_event_rsvp: 5,
  club_post: 20,
  club_event_recurring_4w: 300,
  club_member_invited: 30,
  club_member_invited_became_admin: 200,
  club_50_members: 1000,
  club_100_members: 2500,
  club_admin_6_months: 500,
  club_event_published_to_ranking: 50,

  // ── DISCOVERY / ONBOARDING ────────────────────────────────────────
  onboarding_welcome: 50,
  onboarding_policy_accepted: 20,
  onboarding_leveling_done: 50,
  onboarding_city_set: 20,
  onboarding_first_tournament_watched: 30,
  onboarding_first_club_or_3_follows: 50,
  first_share: 10,
  first_photo: 20,

  // ── REFERRAL ──────────────────────────────────────────────────────
  referral_signed_up: 50, // quem indica ganha
  referral_first_action: 200, // indicou + indicado fez 5+ jogos
  referral_organized_tournament: 500, // indicado organizou torneio
  referral_activated_bonus: 50, // indicado ganha no cadastro

  // ── BÔNUS DIÁRIOS / SEMANAIS ─────────────────────────────────────
  daily_first_action: 20,
  daily_all_missions_complete: 50,
  weekly_all_missions_complete: 250,
  monthly_all_missions_complete: 1000,
  comeback_after_4w_break: 200,
  loyalty_veteran_90d_return: 500, // one-shot
});

/**
 * Soma V1 (compat) sobre um resumo `buildPlayerStats` para garantir que
 * os totais atuais continuem fazendo sentido se o admin desligar V2
 * (`GAMIFICATION_V2` OFF).
 *
 * @param {object} summary — `{ tournaments, played, wins, podiums, titles, ... }`
 * @returns {number} XP total (mesmo cálculo de `computeXp` V1)
 */
export function computeXpCompatV1(summary = {}) {
  return (
    (Number(summary.played) || 0) * V1_WEIGHTS.played
    + (Number(summary.wins) || 0) * V1_WEIGHTS.wins
    + (Number(summary.podiums) || 0) * V1_WEIGHTS.podiums
    + (Number(summary.titles) || 0) * V1_WEIGHTS.titles
    + (Number(summary.tournaments) || 0) * V1_WEIGHTS.tournaments
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 2. (sem teto anti-farm aqui)
// ────────────────────────────────────────────────────────────────────────────

// `XP_CAPS_V2`/`applyXpCapV2` (teto diário/semanal/por evento) saíram em
// 2026-11 (PR 0b da carreira): nenhuma tela nem serviço passava `applyCaps`,
// então o teto nunca valeu e só confundia quem lia. O XP é derivado de fatos
// (`xpTotal.js`) e o antifarm é do servidor: marca para o admin revisar,
// nunca corta (`functions/gamificationCore.js` → `integritySignals`).

// ────────────────────────────────────────────────────────────────────────────
// 3. COMPUTAÇÃO PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────

/**
 * Computa XP total V2 a partir de um **mapa de XP por fonte**
 * (`{ [source]: amount }`).
 *
 * Diferente de `computeXp` V1, que recebia um `summary` agregado. Aqui
 * você passa o delta direto: cada chave é uma fonte do `XP_WEIGHTS_V2`.
 *
 * @param {Record<string, number>} xpBySource — mapa fonte → quantidade
 * @returns {{ xpTotal: number, xpBySource: object }}
 */
export function computeXpV2(xpBySource = {}) {
  const map = xpBySource && typeof xpBySource === 'object' ? xpBySource : {};
  const out = {};
  let total = 0;

  for (const [source, amount] of Object.entries(map)) {
    const weight = XP_WEIGHTS_V2[source];
    if (weight === undefined) {
      // fonte desconhecida — ignora silenciosamente
      // (mas mantém em out para debug)
      out[source] = 0;
      continue;
    }
    const n = Number(amount) || 0;
    out[source] = n * weight;
    total += n * weight;
  }

  return { xpTotal: total, xpBySource: out };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. CURVA DE NÍVEL (mesma do V1, re-exportada para V2 conviver)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Curva de nível V2. **Mesma do V1** para garantir que um usuário que
 * tinha Nível 4 no V1 continua Nível 4 no V2. Compatibilidade total.
 *
 * Cada nível L exige 500*L de XP incremental.
 *
 * @param {number} xp
 * @returns {{ level: number, xp: number, xpIntoLevel: number, xpForNext: number, progress: number }}
 */
/**
 * Teto de sanidade do nível PERSISTIDO (não da curva).
 *
 * A curva de `levelFromXpV2` é idêntica à V1 e continua sem teto — mexer nela
 * quebraria a compatibilidade numérica que é a regra de ouro deste módulo.
 * Este número existe só para o schema/regra recusarem valores absurdos: o
 * nível 200 exige ~10 milhões de XP, muito além de qualquer conta real.
 *
 * O bug que ele resolve era o oposto: o schema aceitava no máximo nível 20,
 * que a curva ultrapassa com 105.000 XP — e a partir daí a progressão do
 * usuário simplesmente parava de salvar.
 */
export const MAX_LEVEL_V2 = 200;

export function levelFromXpV2(xp) {
  const total = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  let need = 500;
  let rem = total;
  while (rem >= need) {
    rem -= need;
    level += 1;
    need = 500 * level;
  }
  return { level, xp: total, xpIntoLevel: rem, xpForNext: need, progress: rem / need };
}

/**
 * Tabela de thresholds de nível (V2, mesma do V1).
 * Útil para testes e para a UI mostrar "faltam X para o próximo nível".
 *
 * @returns {Array<{ level: number, threshold: number }>}
 */
export function levelThresholds() {
  const out = [];
  let acc = 0;
  for (let L = 1; L <= 30; L += 1) {
    out.push({ level: L, threshold: acc });
    acc += 500 * L;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. STREAK (mesma curva, função mantida para V2 conviver)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Streak de semanas ativas consecutivas terminando na semana do jogo mais
 * recente. **Mesmo algoritmo do V1** — mantido como V2 por convenção.
 *
 * @param {number[]} datesMillis
 * @returns {number}
 */
export function computeWeekStreakV2(datesMillis) {
  const weeks = [...new Set(
    (datesMillis || [])
      .filter((ms) => Number.isFinite(ms) && ms > 0)
      .map((ms) => Math.floor(ms / WEEK_MS)),
  )].sort((a, b) => a - b);
  if (weeks.length === 0) return 0;
  let streak = 1;
  for (let i = weeks.length - 1; i > 0; i -= 1) {
    if (weeks[i] - weeks[i - 1] === 1) streak += 1;
    else break;
  }
  return streak;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. ADAPTERS (V1 → V2) — para migração suave
// ────────────────────────────────────────────────────────────────────────────

/**
 * Adapter: dado um `summary` V1 (do `buildPlayerStats`), monta o
 * `xpBySource` V2 equivalente. Útil para o admin master ativar V2 sem
 * perder os totais já acumulados.
 *
 * @param {object} summary
 * @returns {Record<string, number>}
 */
export function summaryToXpBySource(summary = {}) {
  return {
    tournament_attended: Number(summary.tournaments) || 0,
    tournament_podium: Number(summary.podiums) || 0,
    tournament_title: Number(summary.titles) || 0,
    game_played: Number(summary.played) || 0,
    game_won: Number(summary.wins) || 0,
  };
}

/**
 * Adapter: V1 XP total é igual a V2 XP total quando a única fonte é
 * o `summary` V1. Use para verificar compatibilidade em testes.
 *
 * @param {object} summary
 * @returns {number}
 */
export function compatV1TotalFromSummary(summary = {}) {
  return computeXpCompatV1(summary);
}
