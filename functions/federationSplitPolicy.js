/**
 * Cobrança dividida e troca de plano (rodada 3, Bloco 6d) — a conta PURA.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/split.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationSplit.parity.test.js`. Estados e destinos são GRAVADOS: nunca renomeie.
 */
const t = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : `{${k}}`));
const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const pctOk = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(SPLIT_PCT_MAX, Math.max(0, n)) : 0; };

const SPLIT_PCT_MAX = 50;
const SPLIT_TOTAL_MAX = 90;

const REPASSE_TO = Object.freeze({ CLUB: 'club', CONFEDERATION: 'confederation' });
const REPASSE_TO_LABELS = Object.freeze({ club: ('Clube'), confederation: ('Confederação') });
const REPASSE_STATUS = Object.freeze({ PENDING: 'pending', PAID: 'paid' });
const REPASSE_STATUS_LABELS = Object.freeze({ pending: ('A repassar'), paid: ('Repassado') });
/** Cobranças que geram repasse: a filiação, a renovação e a troca de plano. */
const SPLIT_ORIGINS = Object.freeze(['membership', 'renewal', 'upgrade']);

const repasseId = (chargeId, to) => `${chargeId}_${to}`;

/** As porcentagens do plano, sempre inteiras entre 0 e 50. */
const normalizeSplit = (input) => ({ club_pct: pctOk(input?.club_pct), confederation_pct: pctOk(input?.confederation_pct) });

/** Plano com repasse: as duas partes somadas não passam de 90% (a federação fica com algo). */
function validateSplit(input) {
  const value = normalizeSplit(input);
  const errors = {};
  if (value.club_pct + value.confederation_pct > SPLIT_TOTAL_MAX) errors.split = t('Os repasses somados passam de {n}%: a federação precisa ficar com uma parte.', { n: SPLIT_TOTAL_MAX });
  return { ok: !errors.split, errors, value };
}

/**
 * Quanto vai para cada um, em centavos. As partes saem arredondadas para baixo;
 * o centavo que sobra fica com a federação. Destino ausente ⇒ a parte fica com ela.
 * @param {number} amountCents
 * @param {{ club_pct?: number, confederation_pct?: number }} split
 * @param {{ club?: { id: string, name: string }|null, confederation?: { id: string, name: string }|null }} destinos
 */
function splitShares(amountCents, split, { club = null, confederation = null } = {}) {
  const total = Math.max(0, Math.trunc(Number(amountCents) || 0));
  const s = normalizeSplit(split);
  const shares = [];
  const parte = (to, dest, pct) => {
    const cents = Math.floor((total * pct) / 100);
    if (dest && dest.id && cents > 0) shares.push({ to, to_id: String(dest.id), to_name: str(dest.name, 120), pct, amount_cents: cents });
  };
  parte(REPASSE_TO.CLUB, club, s.club_pct);
  parte(REPASSE_TO.CONFEDERATION, confederation, s.confederation_pct);
  return { shares, federation_cents: total - shares.reduce((a, x) => a + x.amount_cents, 0) };
}

/** Marcar repassado (a repassar → repassado) e desfazer (repassado → a repassar). */
function repasseTransition(r, action) {
  const st = r?.status;
  if (action === 'pay' && st === REPASSE_STATUS.PENDING) return { ok: true, status: REPASSE_STATUS.PAID };
  if (action === 'reopen' && st === REPASSE_STATUS.PAID) return { ok: true, status: REPASSE_STATUS.PENDING };
  return { ok: false, error: t('Este repasse não está no estado certo para isso.') };
}

const repassados = (repasses) => lista(repasses).filter((r) => r && r.status === REPASSE_STATUS.PAID && isIso(r.paid_at) && Number(r.amount_cents) > 0);

/** Os repasses FEITOS como despesa da federação que repassou (formato de `extraExpenseItems`). */
function repasseExpenses(repasses) {
  return repassados(repasses).map((r) => ({
    date: r.paid_at, amount_cents: Math.trunc(Number(r.amount_cents)), category: 'other_expense', ref: `repasse:${r.id}`,
    description: str(`${t('Repasse')} · ${r.plan_name || ''}`, 200), counterparty: str(r.to_name, 120), auto: 'repasse',
  }));
}

/** Os repasses RECEBIDOS pela confederação como receita (formato de `extraIncomeItems`). */
function repasseIncome(repasses) {
  return repassados(repasses).filter((r) => r.to === REPASSE_TO.CONFEDERATION).map((r) => ({
    date: r.paid_at, amount_cents: Math.trunc(Number(r.amount_cents)), category: 'memberships', ref: `repasse:${r.id}`,
    description: str(`${t('Repasse de filiação')} · ${r.federation_acronym || r.federation_name || ''}`, 200), counterparty: str(r.federation_name, 120), auto: 'repasse',
  }));
}

/* ------------------------------------------------------- troca de plano -- */

const entidade = (p) => p?.entity || 'person';

/**
 * Pode trocar deste plano para aquele? Só filiação ATIVA, para outro plano
 * ativo da mesma federação, do mesmo período e da mesma natureza, vínculo
 * Filiado. O preço (a diferença) quem confere é quem chama.
 * @returns {string|null} o motivo da recusa, ou `null`
 */
function upgradeBlocker(member, current, target) {
  if (!member || member.status !== 'active') return t('A troca de plano é para filiação em dia.');
  if (!target || target.active === false) return t('Este plano não está disponível.');
  if (!current || target.id === current.id) return t('Escolha um plano diferente do atual.');
  if (target.federation_id && member.federation_id && target.federation_id !== member.federation_id) return t('Este plano é de outra federação.');
  if ((target.billing || 'annual') !== (current.billing || 'annual')) return t('A troca é entre planos do mesmo período (mensal ou anual).');
  if (entidade(target) !== entidade(current) || (target.person_type || 'athlete') !== (current.person_type || 'athlete')) return t('A troca é entre planos do mesmo tipo de filiado.');
  if ((target.tier || 'federated') !== 'federated') return t('A troca é para um plano de filiado.');
  return null;
}

/** A diferença a pagar; zero ou menos ⇒ não é troca (plano mais barato é com a federação). */
function upgradeDifference(currentPriceCents, targetPriceCents) {
  const d = Math.trunc(Number(targetPriceCents) || 0) - Math.trunc(Number(currentPriceCents) || 0);
  return d > 0 ? { ok: true, diff_cents: d } : { ok: false, error: t('Plano de valor igual ou menor: para trocar, fale com a federação.') };
}

/** Os planos para onde a filiação pode trocar, do mais barato ao mais caro. */
function upgradeTargets(plans, member, current) {
  const base = Math.trunc(Number(current?.price_cents) || 0);
  return lista(plans)
    .filter((p) => !upgradeBlocker(member, current, p) && Math.trunc(Number(p.price_cents) || 0) > base)
    .sort((a, b) => (Number(a.price_cents) || 0) - (Number(b.price_cents) || 0));
}

module.exports = {
  SPLIT_PCT_MAX, SPLIT_TOTAL_MAX, REPASSE_TO, REPASSE_TO_LABELS, REPASSE_STATUS, REPASSE_STATUS_LABELS, SPLIT_ORIGINS, repasseId, normalizeSplit, validateSplit, splitShares, repasseTransition, repasseExpenses, repasseIncome, upgradeBlocker, upgradeDifference, upgradeTargets,
};
