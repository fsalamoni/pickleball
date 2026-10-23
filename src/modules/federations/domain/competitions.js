/**
 * COMPETIÇÕES (Bloco 2): o que a chancela pede além da categoria — prazo,
 * taxa, diretor credenciado, premiação por gênero — e o que vem depois dela:
 * o checklist e o relatório do diretor e os convites para a final do
 * circuito. Lógica pura.
 *
 * O servidor tem uma CÓPIA da régua (`functions/federationCompetitionsPolicy.js`)
 * com teste de paridade: prazo, checklist, relatório e a escolha de quem é
 * convidado para a final valem igual nos dois lados.
 */
import { tk } from '@/core/i18n';
import { daysBetween } from './membership.js';
import { addDaysISO } from './referees.js';
import { normalizeRankingConfig } from './officialRanking.js';

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const int = (v, d, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : d;
};
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/* --------------------------------------------------------------- prazo -- */

/**
 * O pedido de chancela respeita a antecedência mínima da federação
 * (`rules.sanction_min_days`, 0 = sem prazo)? Sem data de início, com prazo,
 * não dá para pedir (`no_date`).
 * @returns {{ min_days: number, days_ahead: number|null, late: boolean, no_date: boolean, earliest: string|null }}
 */
export function sanctionTiming(rules, startsAt, hoje) {
  const min = int(rules && rules.sanction_min_days, 0, 0, 365);
  const inicio = String(startsAt || '').slice(0, 10);
  if (!min) return { min_days: 0, days_ahead: isIso(inicio) && hoje ? daysBetween(hoje, inicio) : null, late: false, no_date: false, earliest: null };
  if (!isIso(inicio)) return { min_days: min, days_ahead: null, late: false, no_date: true, earliest: hoje ? addDaysISO(hoje, min) : null };
  const dias = daysBetween(hoje, inicio);
  return { min_days: min, days_ahead: dias, late: dias < min, no_date: false, earliest: addDaysISO(hoje, min) };
}

/* --------------------------------------------------------------- taxa -- */

/** A taxa de chancela da categoria (centavos; 0 = sem taxa). */
export function tierFeeCents(federation, tierId) {
  const tier = normalizeRankingConfig((federation && federation.ranking_config) || {}).tiers.find((tt) => tt.id === tierId);
  return tier ? tier.sanction_fee_cents || 0 : 0;
}

/* ---------------------------------------------------------- premiação -- */

const centavos = (v) => {
  if (v === '' || v == null) return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 100000000) : null;
};

/** A premiação por gênero que o organizador informa no pedido (null = não informou). */
export function normalizePrize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = { female_cents: centavos(raw.female_cents), male_cents: centavos(raw.male_cents), note: str(raw.note, 200) };
  return p.female_cents == null && p.male_cents == null && !p.note ? null : p;
}

/**
 * Isonomia da premiação (Lei 14.597/2023): igual, diferente (quanto e quem
 * recebe menos), sem premiação em dinheiro, ou não informada.
 * @returns {{ state: 'equal'|'unequal'|'none'|'unknown', gap_cents: number, lower: 'female'|'male'|null }}
 */
export function prizeParity(prize) {
  const p = normalizePrize(prize);
  if (!p || p.female_cents == null || p.male_cents == null) return { state: 'unknown', gap_cents: 0, lower: null };
  if (!p.female_cents && !p.male_cents) return { state: 'none', gap_cents: 0, lower: null };
  if (p.female_cents === p.male_cents) return { state: 'equal', gap_cents: 0, lower: null };
  return { state: 'unequal', gap_cents: Math.abs(p.female_cents - p.male_cents), lower: p.female_cents < p.male_cents ? 'female' : 'male' };
}

/* ------------------------------------------------------------ diretor -- */

/** O código da credencial de diretor, como a pessoa digita (sem espaço, maiúsculo). */
export const normalizeDirectorCode = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

/* ---------------------------------------------- checklist e relatório -- */

export const CHECKLIST_ITEMS = Object.freeze(['insurance', 'referees', 'venue', 'medical', 'schedule']);
export const CHECKLIST_LABELS = Object.freeze({
  insurance: tk('Seguro dos atletas contratado para o evento'),
  referees: tk('Arbitragem confirmada'),
  venue: tk('Local reservado e quadras conferidas'),
  medical: tk('Atendimento de primeiros socorros no local'),
  schedule: tk('Programação publicada para os inscritos'),
});
export const REPORT_TEXT_MAX = 2000;
export const REPORT_COUNT_MAX = 9999;

/** O checklist antes do evento: o que foi marcado e se está completo. */
export function validateChecklist(input = {}) {
  const raw = (input && input.items) || {};
  const items = Object.fromEntries(CHECKLIST_ITEMS.map((id) => [id, raw[id] === true]));
  return { items, notes: str(input && input.notes, 500), complete: CHECKLIST_ITEMS.every((id) => items[id]) };
}

/** O relatório depois do evento: W.O., ocorrências, lesões e reclamações. */
export function validateEventReport(input = {}) {
  const v = {
    entrants: int(input.entrants, 0, 0, REPORT_COUNT_MAX),
    walkovers: int(input.walkovers, 0, 0, REPORT_COUNT_MAX),
    injuries: int(input.injuries, 0, 0, REPORT_COUNT_MAX),
    complaints: int(input.complaints, 0, 0, REPORT_COUNT_MAX),
    incidents_text: str(input.incidents_text, REPORT_TEXT_MAX),
    injuries_text: str(input.injuries_text, REPORT_TEXT_MAX),
    complaints_text: str(input.complaints_text, REPORT_TEXT_MAX),
    notes: str(input.notes, REPORT_TEXT_MAX),
    // Jogo limpo (rodada 3): o diretor confirma a lista de equipamentos e as cláusulas antidopagem.
    equipment_checked: input.equipment_checked === true,
    antidoping_clauses: input.antidoping_clauses === true,
  };
  const errors = {};
  if (v.injuries > 0 && v.injuries_text.length < 5) errors.injuries_text = 'describe';
  if (v.complaints > 0 && v.complaints_text.length < 5) errors.complaints_text = 'describe';
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/**
 * Onde está o diretor em relação ao torneio chancelado: falta o checklist
 * (antes do início), falta o relatório (a partir do início) ou entregue.
 * @returns {'checklist'|'report'|'done'}
 */
export function directorStage(report, tournament, hoje) {
  if (report && report.report && report.report.submitted_at_ms) return 'done';
  const inicio = String((tournament && tournament.starts_at) || '').slice(0, 10);
  if (isIso(inicio) && hoje >= inicio) return 'report';
  return 'checklist';
}

/* ------------------------------------------------- final do circuito -- */

export const FINAL_INVITE_STATUS = Object.freeze({ INVITED: 'invited', ACCEPTED: 'accepted', DECLINED: 'declined', EXPIRED: 'expired', CANCELLED: 'cancelled' });
export const FINAL_INVITE_STATUS_LABELS = Object.freeze({
  invited: tk('Convidado'), accepted: tk('Confirmou'), declined: tk('Recusou'), expired: tk('Prazo vencido'), cancelled: tk('Cancelado'),
});
export const FINAL_PER_CATEGORY_MAX = 64;
export const FINAL_ACCEPT_DAYS = 7;

/** As opções do convite: quantos por categoria, dias para responder, quais categorias. */
export function normalizeFinalOptions(input = {}) {
  return {
    per_category: int(input.per_category, 8, 1, FINAL_PER_CATEGORY_MAX),
    accept_days: int(input.accept_days, FINAL_ACCEPT_DAYS, 1, 30),
    season: Number(input.season) >= 2000 ? int(input.season, 0, 2000, 2100) : null,
    categories: Array.isArray(input.categories) ? [...new Set(input.categories.map((k) => str(k, 120)).filter(Boolean))].slice(0, 40) : null,
  };
}

/** Id do convite: um por atleta, categoria e torneio. A chave da categoria entra limpa. */
export const finalInviteDocId = (tournamentId, categoryKey, uid) => `${tournamentId}_${String(categoryKey).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80)}_${uid}`;

/**
 * Quem convidar agora para a final, categoria a categoria: pela posição no
 * ranking do ano, completando as vagas (`per_category`) com quem ainda não foi
 * convidado — convidado e confirmado ocupam vaga; recusou, venceu ou foi
 * cancelado libera, e o próximo do ranking é chamado (suplente).
 * @param {object[]} categories `federation_rankings.categories`
 * @param {object[]} existing os convites que já existem para este torneio
 */
export function finalInvitesToSend(categories = [], existing = [], options = {}) {
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

/** O resumo dos convites de uma categoria: vagas, confirmados, esperando. */
export function finalCategorySummary(invites = [], perCategory) {
  const conta = (s) => invites.filter((i) => i.status === s).length;
  return { per_category: perCategory || 0, accepted: conta(FINAL_INVITE_STATUS.ACCEPTED), invited: conta(FINAL_INVITE_STATUS.INVITED), declined: conta(FINAL_INVITE_STATUS.DECLINED), expired: conta(FINAL_INVITE_STATUS.EXPIRED) };
}

/** O convite ainda espera resposta (e o prazo não venceu)? */
export const finalInviteOpen = (inv, now = Date.now()) => Boolean(inv) && inv.status === FINAL_INVITE_STATUS.INVITED && Number(inv.expires_at_ms) > now;
