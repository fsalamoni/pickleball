/**
 * Política de envio de partidas ao DUPR — cópia do servidor de
 * `src/modules/rating/domain/duprPolicy.js` (o pacote de Functions é publicado
 * isolado e não enxerga `src/`). `functions/duprPolicy.parity.test.js` roda as
 * duas sobre as mesmas entradas e exige resultado idêntico: mexer num lado só
 * quebra o teste, de propósito.
 */

const DUPR_MODE = Object.freeze({ OFF: 'off', MANUAL: 'manual', RULES: 'rules' });
const DUPR_AUDIENCE = Object.freeze({ ADMINS: 'admins', ALL: 'all' });
const DUPR_LEVEL = Object.freeze({ REQUIRED: 'required', OPTIONAL: 'optional', EXCLUDED: 'excluded', OFF: 'off' });
const DUPR_BUCKET = Object.freeze({
  TOURNAMENT_FIXED: 'tournament_fixed',
  TOURNAMENT_TEAM: 'tournament_team',
  TOURNAMENT_ROTATION: 'tournament_rotation',
  GAME_DAY_ROTATION: 'game_day_rotation',
  GAME_DAY_PLAY: 'game_day_play',
});
const DUPR_CONFIGURABLE_BUCKETS = Object.freeze([
  DUPR_BUCKET.TOURNAMENT_FIXED,
  DUPR_BUCKET.TOURNAMENT_TEAM,
  DUPR_BUCKET.TOURNAMENT_ROTATION,
  DUPR_BUCKET.GAME_DAY_ROTATION,
]);
const ROTATION_STAGE_TYPES = Object.freeze(['americano', 'mexicano', 'americano_etapas']);
const GRACE_MIN = 0;
const GRACE_MAX = 24 * 60;

const DEFAULT_DUPR_POLICY = Object.freeze({
  mode: DUPR_MODE.OFF,
  audience: DUPR_AUDIENCE.ADMINS,
  optional_default_on: false,
  grace_minutes: 30,
  rules: Object.freeze({
    [DUPR_BUCKET.TOURNAMENT_FIXED]: DUPR_LEVEL.REQUIRED,
    [DUPR_BUCKET.TOURNAMENT_TEAM]: DUPR_LEVEL.REQUIRED,
    [DUPR_BUCKET.TOURNAMENT_ROTATION]: DUPR_LEVEL.OPTIONAL,
    [DUPR_BUCKET.GAME_DAY_ROTATION]: DUPR_LEVEL.OPTIONAL,
  }),
});

const LEVELS_VALIDOS = [DUPR_LEVEL.REQUIRED, DUPR_LEVEL.OPTIONAL, DUPR_LEVEL.EXCLUDED];

function normalizeDuprPolicy(raw) {
  const d = DEFAULT_DUPR_POLICY;
  const r = raw && typeof raw === 'object' ? raw : {};
  const rules = {};
  DUPR_CONFIGURABLE_BUCKETS.forEach((b) => {
    const v = r.rules && r.rules[b];
    rules[b] = LEVELS_VALIDOS.includes(v) ? v : d.rules[b];
  });
  const grace = Number(r.grace_minutes);
  return {
    mode: Object.values(DUPR_MODE).includes(r.mode) ? r.mode : d.mode,
    audience: r.audience === DUPR_AUDIENCE.ALL ? DUPR_AUDIENCE.ALL : DUPR_AUDIENCE.ADMINS,
    optional_default_on: r.optional_default_on === true,
    grace_minutes: Number.isFinite(grace) ? Math.min(GRACE_MAX, Math.max(GRACE_MIN, Math.round(grace))) : d.grace_minutes,
    rules,
  };
}

function duprBucket({ origin, stageType, gameDayFormat, teamConfrontation } = {}) {
  if (origin === 'tournament') {
    if (teamConfrontation) return DUPR_BUCKET.TOURNAMENT_TEAM;
    if (ROTATION_STAGE_TYPES.includes(stageType)) return DUPR_BUCKET.TOURNAMENT_ROTATION;
    return DUPR_BUCKET.TOURNAMENT_FIXED;
  }
  if (gameDayFormat === 'play') return DUPR_BUCKET.GAME_DAY_PLAY;
  return DUPR_BUCKET.GAME_DAY_ROTATION;
}

function duprSubmissionDecision({ bucket, creatorChoice = null } = {}, policy = null) {
  const p = normalizeDuprPolicy(policy);
  if (p.mode === DUPR_MODE.OFF) {
    return { level: DUPR_LEVEL.OFF, submit: false, needsApproval: false, reason: 'policy_off' };
  }
  if (bucket === DUPR_BUCKET.GAME_DAY_PLAY) {
    return { level: DUPR_LEVEL.EXCLUDED, submit: false, needsApproval: false, reason: 'play_no_score' };
  }
  const level = p.rules[bucket] || DUPR_LEVEL.EXCLUDED;
  let submit = false;
  let reason = 'excluded_by_rule';
  if (level === DUPR_LEVEL.REQUIRED) {
    submit = true;
    reason = 'required';
  } else if (level === DUPR_LEVEL.OPTIONAL) {
    if (creatorChoice === true) { submit = true; reason = 'creator_on'; }
    else if (creatorChoice === false) { submit = false; reason = 'creator_off'; }
    else if (p.optional_default_on) { submit = true; reason = 'default_on'; }
    else { submit = false; reason = 'default_off'; }
  }
  return { level, submit, needsApproval: submit && p.mode === DUPR_MODE.MANUAL, reason };
}

const DUPR_MATCH_PROBLEM = Object.freeze({
  NO_PLAYERS: 'no_players',
  UNEVEN_SIDES: 'uneven_sides',
  TOO_MANY_PLAYERS: 'too_many_players',
  REPEATED_PLAYER: 'repeated_player',
  NO_SCORE: 'no_score',
  TIED_GAME: 'tied_game',
  WINNER_MISMATCH: 'winner_mismatch',
});

function duprMatchEligibility(m) {
  const problems = [];
  const a = Array.isArray(m && m.side_a) ? m.side_a : [];
  const b = Array.isArray(m && m.side_b) ? m.side_b : [];
  if (a.length === 0 || b.length === 0 || a.some((u) => !u) || b.some((u) => !u)) problems.push(DUPR_MATCH_PROBLEM.NO_PLAYERS);
  else {
    if (a.length !== b.length) problems.push(DUPR_MATCH_PROBLEM.UNEVEN_SIDES);
    if (a.length > 2 || b.length > 2) problems.push(DUPR_MATCH_PROBLEM.TOO_MANY_PLAYERS);
    if (new Set([...a, ...b]).size !== a.length + b.length) problems.push(DUPR_MATCH_PROBLEM.REPEATED_PLAYER);
  }
  const games = (Array.isArray(m && m.games) ? m.games : [])
    .map((g) => ({ a: Number(g && g.a), b: Number(g && g.b) }))
    .filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b));
  if (games.length === 0 || games.every((g) => g.a === 0 && g.b === 0)) problems.push(DUPR_MATCH_PROBLEM.NO_SCORE);
  else {
    if (games.some((g) => g.a === g.b)) problems.push(DUPR_MATCH_PROBLEM.TIED_GAME);
    const wa = games.filter((g) => g.a > g.b).length;
    const wb = games.filter((g) => g.b > g.a).length;
    if ((m.winner === 'a' && wa <= wb) || (m.winner === 'b' && wb <= wa)) problems.push(DUPR_MATCH_PROBLEM.WINNER_MISMATCH);
  }
  return { ok: problems.length === 0, problems };
}

const DUPR_REQUIRED_ENTITLEMENT = 'BASIC_L1';

function duprReadiness(uids, links) {
  const map = links && typeof links === 'object' ? links : {};
  const missing = [];
  const noEntitlement = [];
  (Array.isArray(uids) ? uids : []).forEach((uid) => {
    const l = map[uid];
    if (!l || !l.dupr_id) { missing.push(uid); return; }
    const ents = (Array.isArray(l.entitlements) ? l.entitlements : []).map((e) => String(e).toUpperCase());
    if (!ents.includes(DUPR_REQUIRED_ENTITLEMENT)) noEntitlement.push(uid);
  });
  return { ok: missing.length === 0 && noEntitlement.length === 0, missing, noEntitlement };
}

const DUPR_ID_KIND = Object.freeze({ TOURNAMENT_MATCH: 'tm', GAME_DAY_GAME: 'gd', PILOT: 'pl' });

function duprIdentifier(kind, id) {
  const limpo = String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  if (!limpo || !Object.values(DUPR_ID_KIND).includes(kind)) return null;
  return `pr:${kind}:${limpo}`;
}

module.exports = {
  DUPR_MODE, DUPR_AUDIENCE, DUPR_LEVEL, DUPR_BUCKET, DUPR_CONFIGURABLE_BUCKETS, DEFAULT_DUPR_POLICY, GRACE_MIN, GRACE_MAX,
  normalizeDuprPolicy, duprBucket, duprSubmissionDecision,
  DUPR_MATCH_PROBLEM, duprMatchEligibility, DUPR_REQUIRED_ENTITLEMENT, duprReadiness, DUPR_ID_KIND, duprIdentifier,
};
