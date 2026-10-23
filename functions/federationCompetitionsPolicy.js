/**
 * Competições da federação (Bloco 2) — a conta PURA (sem banco): prazo da
 * chancela, taxa da categoria, checklist e relatório do diretor e quem
 * convidar para a final do circuito.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/competitions.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationCompetitions.parity.test.js`. Ids e estados são GRAVADOS: nunca
 * renomeie.
 */
const m = require('./federationMembership');
const { addDaysISO } = require('./federationRefereesPolicy');
const { normalizeRankingConfig } = require('./federationRanking');

const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
const int = (v, d, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : d;
};
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

function sanctionTiming(rules, startsAt, hoje) {
  const min = int(rules && rules.sanction_min_days, 0, 0, 365);
  const inicio = String(startsAt || '').slice(0, 10);
  if (!min) return { min_days: 0, days_ahead: isIso(inicio) && hoje ? m.daysBetween(hoje, inicio) : null, late: false, no_date: false, earliest: null };
  if (!isIso(inicio)) return { min_days: min, days_ahead: null, late: false, no_date: true, earliest: hoje ? addDaysISO(hoje, min) : null };
  const dias = m.daysBetween(hoje, inicio);
  return { min_days: min, days_ahead: dias, late: dias < min, no_date: false, earliest: addDaysISO(hoje, min) };
}

function tierFeeCents(federation, tierId) {
  const tier = normalizeRankingConfig((federation && federation.ranking_config) || {}).tiers.find((tt) => tt.id === tierId);
  return tier ? tier.sanction_fee_cents || 0 : 0;
}

const normalizeDirectorCode = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

const CHECKLIST_ITEMS = Object.freeze(['insurance', 'referees', 'venue', 'medical', 'schedule']);
const REPORT_TEXT_MAX = 2000;
const REPORT_COUNT_MAX = 9999;

function validateChecklist(input = {}) {
  const raw = (input && input.items) || {};
  const items = Object.fromEntries(CHECKLIST_ITEMS.map((id) => [id, raw[id] === true]));
  return { items, notes: str(input && input.notes, 500), complete: CHECKLIST_ITEMS.every((id) => items[id]) };
}

function validateEventReport(input = {}) {
  const v = {
    entrants: int(input.entrants, 0, 0, REPORT_COUNT_MAX),
    walkovers: int(input.walkovers, 0, 0, REPORT_COUNT_MAX),
    injuries: int(input.injuries, 0, 0, REPORT_COUNT_MAX),
    complaints: int(input.complaints, 0, 0, REPORT_COUNT_MAX),
    incidents_text: str(input.incidents_text, REPORT_TEXT_MAX),
    injuries_text: str(input.injuries_text, REPORT_TEXT_MAX),
    complaints_text: str(input.complaints_text, REPORT_TEXT_MAX),
    notes: str(input.notes, REPORT_TEXT_MAX),
    equipment_checked: input.equipment_checked === true,
    antidoping_clauses: input.antidoping_clauses === true,
  };
  const errors = {};
  if (v.injuries > 0 && v.injuries_text.length < 5) errors.injuries_text = 'describe';
  if (v.complaints > 0 && v.complaints_text.length < 5) errors.complaints_text = 'describe';
  return { ok: !Object.keys(errors).length, errors, value: v };
}

const FINAL_INVITE_STATUS = Object.freeze({ INVITED: 'invited', ACCEPTED: 'accepted', DECLINED: 'declined', EXPIRED: 'expired', CANCELLED: 'cancelled' });
const FINAL_PER_CATEGORY_MAX = 64;
const FINAL_ACCEPT_DAYS = 7;

function normalizeFinalOptions(input = {}) {
  return {
    per_category: int(input.per_category, 8, 1, FINAL_PER_CATEGORY_MAX),
    accept_days: int(input.accept_days, FINAL_ACCEPT_DAYS, 1, 30),
    season: Number(input.season) >= 2000 ? int(input.season, 0, 2000, 2100) : null,
    categories: Array.isArray(input.categories) ? [...new Set(input.categories.map((k) => str(k, 120)).filter(Boolean))].slice(0, 40) : null,
  };
}

const finalInviteDocId = (tournamentId, categoryKey, uid) => `${tournamentId}_${String(categoryKey).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80)}_${uid}`;

function finalInvitesToSend(categories = [], existing = [], options = {}) {
  const o = normalizeFinalOptions(options);
  const ocupa = new Set([FINAL_INVITE_STATUS.INVITED, FINAL_INVITE_STATUS.ACCEPTED]);
  const out = [];
  (categories || []).forEach((c) => {
    if (!c || !c.key || (o.categories && !o.categories.includes(c.key))) return;
    const daqui = (existing || []).filter((i) => i.category_key === c.key);
    const jaChamados = new Set(daqui.map((i) => i.user_id));
    let vagas = o.per_category - daqui.filter((i) => ocupa.has(i.status)).length;
    const linhas = [...(c.rows || [])].filter((r) => r && r.uid).sort((a, b) => (a.position || 9999) - (b.position || 9999));
    for (const r of linhas) {
      if (vagas <= 0) break;
      if (jaChamados.has(r.uid)) continue;
      out.push({
        category_key: c.key, gender_category: c.gender_category || 'open', age_category: c.age_category || 'open', format: c.format || 'doubles',
        user_id: r.uid, user_name: str(r.name, 120), position: r.position || null, points: r.points || 0, substitute: (r.position || 9999) > o.per_category,
      });
      vagas -= 1;
    }
  });
  return out;
}

module.exports = {
  CHECKLIST_ITEMS, REPORT_TEXT_MAX, REPORT_COUNT_MAX, FINAL_INVITE_STATUS, FINAL_PER_CATEGORY_MAX, FINAL_ACCEPT_DAYS,
  sanctionTiming, tierFeeCents, normalizeDirectorCode, validateChecklist, validateEventReport, normalizeFinalOptions, finalInviteDocId, finalInvitesToSend,
};
