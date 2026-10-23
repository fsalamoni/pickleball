/**
 * CAMADA NACIONAL (Bloco 6, `docs/50` §35) — a conta PURA da confederação.
 *
 *  - Confederação é a federação que o admin da plataforma marca como tal
 *    (`federations.confederation`, campo travado). As federações estaduais se
 *    filiam a ela por um VÍNCULO (`federation_national_links/{conf}_{fed}`):
 *    uma pede e a outra aceita (ou a confederação convida e a estadual
 *    aceita). Uma estadual tem no máximo UMA confederação; o espelho do
 *    vínculo aprovado fica em `federations.national_body` (o selo "Filiada
 *    à" e a lista pública das filiadas saem dele).
 *  - Ranking nacional: a soma dos pontos LANÇADOS pelas filiadas e pela
 *    própria confederação (`federation_rankings/{conf}_nacional_{ano}`), com a
 *    mesma regra do ano que fecha em 31/01.
 *  - Transferência entre duas estaduais da mesma confederação: liberada pela
 *    federação de origem, espera a HOMOLOGAÇÃO da confederação; sem resposta
 *    no prazo, a varredura homologa.
 *  - Repasse da anuidade (`federation_dues/{conf}_{fed}_{ano}`): valor fixo +
 *    valor por filiado ativo; a estadual declara o pagamento e a confederação
 *    confirma. Pago, vira receita derivada da confederação e despesa
 *    derivada da estadual.
 *
 * O servidor tem uma CÓPIA (`functions/federationNationalPolicy.js`) com
 * paridade em `federationNational.parity.test.js`. Estados são GRAVADOS:
 * nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const inteiro = (v, min, max) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const DIAS_DO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const DUES_AMOUNT_MAX = 100_000_000;
export const HOMOLOGATION_DAYS_MAX = 60;

/* ------------------------------------------------------------- vínculo -- */

export const LINK_STATUS = Object.freeze({
  PENDING: 'pending', INVITED: 'invited', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled', LEFT: 'left', REMOVED: 'removed',
});
export const LINK_STATUS_LABELS = Object.freeze({
  pending: tk('Pedido aguardando a confederação'), invited: tk('Convite aguardando a federação'), approved: tk('Filiada'),
  rejected: tk('Recusado'), cancelled: tk('Cancelado'), left: tk('Desfiliada'), removed: tk('Desligada pela confederação'),
});
export const LINK_OPEN = Object.freeze([LINK_STATUS.PENDING, LINK_STATUS.INVITED]);
const PODE_ABRIR = [null, LINK_STATUS.REJECTED, LINK_STATUS.CANCELLED, LINK_STATUS.LEFT, LINK_STATUS.REMOVED];

export const nationalLinkId = (confId, fedId) => `${confId}_${fedId}`;
export const nationalRankingDocId = (confId, season) => `${confId}_nacional_${season}`;
export const nationalDuesId = (confId, fedId, year) => `${confId}_${fedId}_${year}`;

export const isConfederation = (fed) => Boolean(fed) && fed.confederation === true;
/** O vínculo aprovado espelhado na federação estadual (`{ id, name, acronym, slug, since_ms }`), ou `null`. */
export function nationalBodyOf(fed) {
  const nb = fed && fed.national_body;
  return nb && typeof nb.id === 'string' && nb.id ? nb : null;
}

/**
 * A ação sobre o vínculo, conforme o LADO de quem age (`state` = a federação
 * estadual, `national` = a confederação). Quem RECEBE o pedido aceita ou
 * recusa; quem pediu cancela. Devolve `{ status }` ou `{ error }`.
 */
export function linkTransition(link, action, side) {
  const atual = link && link.status ? link.status : null;
  const recebe = atual === LINK_STATUS.PENDING ? 'national' : 'state';
  const lado = (esperado) => (side === esperado ? null : tk('Esta ação cabe ao outro lado do vínculo.'));
  if (action === 'request' || action === 'invite') {
    const erro = lado(action === 'request' ? 'state' : 'national');
    if (erro) return { error: erro };
    if (atual === LINK_STATUS.APPROVED) return { error: tk('A federação já é filiada a esta confederação.') };
    if (LINK_OPEN.includes(atual)) return { error: tk('Já existe um pedido ou convite em aberto.') };
    if (!PODE_ABRIR.includes(atual)) return { error: tk('O vínculo mudou. Atualize a página.') };
    return { status: action === 'request' ? LINK_STATUS.PENDING : LINK_STATUS.INVITED };
  }
  if (action === 'accept' || action === 'reject' || action === 'cancel') {
    if (!LINK_OPEN.includes(atual)) return { error: tk('Não há pedido ou convite em aberto.') };
    const erro = action === 'cancel' ? lado(recebe === 'national' ? 'state' : 'national') : lado(recebe);
    if (erro) return { error: erro };
    return { status: action === 'accept' ? LINK_STATUS.APPROVED : action === 'reject' ? LINK_STATUS.REJECTED : LINK_STATUS.CANCELLED };
  }
  if (action === 'leave' || action === 'remove') {
    const erro = lado(action === 'leave' ? 'state' : 'national');
    if (erro) return { error: erro };
    if (atual !== LINK_STATUS.APPROVED) return { error: tk('A federação não está filiada a esta confederação.') };
    return { status: action === 'leave' ? LINK_STATUS.LEFT : LINK_STATUS.REMOVED };
  }
  return { error: tk('Ação desconhecida.') };
}

/** Sair e desligar exigem o motivo (fica no histórico e vai no aviso ao outro lado). */
export const linkNeedsReason = (action) => action === 'leave' || action === 'remove';

/**
 * Pode abrir o vínculo? A estadual precisa ser aprovada e não ser
 * confederação; a confederação precisa ser confederação; e a estadual não pode
 * estar filiada a OUTRA confederação.
 */
export function canOpenLink(fed, conf) {
  if (!fed || !conf || fed.id === conf.id) return { error: tk('Escolha outra federação.') };
  if (!isConfederation(conf)) return { error: tk('Esta federação não é uma confederação.') };
  if (isConfederation(fed)) return { error: tk('Uma confederação não se filia a outra.') };
  if (fed.status !== 'approved' || conf.status !== 'approved') return { error: tk('As duas federações precisam estar aprovadas pela plataforma.') };
  const nb = nationalBodyOf(fed);
  if (nb && nb.id !== conf.id) return { error: tk('A federação já é filiada a outra confederação. Desfilie-se antes.') };
  return { ok: true };
}

/* ------------------------------------------------------- configuração -- */

export const NATIONAL_CONFIG_DEFAULT = Object.freeze({
  homologate_transfers: true, homologation_days: 15, dues_fixed_cents: 0, dues_per_member_cents: 0, dues_due_md: '03-31',
});

const mdOk = (v) => {
  const m = /^(\d{2})-(\d{2})$/.exec(String(v || ''));
  if (!m) return false;
  const mes = Number(m[1]); const dia = Number(m[2]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= DIAS_DO_MES[mes - 1];
};

/** As regras da rede gravadas na confederação (`national_config`), com os padrões no que faltar. */
export function normalizeNationalConfig(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = NATIONAL_CONFIG_DEFAULT;
  return {
    homologate_transfers: r.homologate_transfers === false ? false : d.homologate_transfers,
    homologation_days: inteiro(r.homologation_days, 1, HOMOLOGATION_DAYS_MAX) ?? d.homologation_days,
    dues_fixed_cents: inteiro(r.dues_fixed_cents, 0, DUES_AMOUNT_MAX) ?? d.dues_fixed_cents,
    dues_per_member_cents: inteiro(r.dues_per_member_cents, 0, DUES_AMOUNT_MAX) ?? d.dues_per_member_cents,
    dues_due_md: mdOk(r.dues_due_md) ? r.dues_due_md : d.dues_due_md,
  };
}

/** O que a confederação digitou nas regras → o que pode ser gravado (o servidor confere de novo). */
export function validateNationalConfig(input = {}) {
  const errors = {};
  const dias = inteiro(input.homologation_days, 1, HOMOLOGATION_DAYS_MAX);
  if (dias == null) errors.homologation_days = tk('Entre 1 e 60 dias.');
  const fixo = inteiro(input.dues_fixed_cents, 0, DUES_AMOUNT_MAX);
  if (fixo == null) errors.dues_fixed_cents = tk('Valor inválido.');
  const porFiliado = inteiro(input.dues_per_member_cents, 0, DUES_AMOUNT_MAX);
  if (porFiliado == null) errors.dues_per_member_cents = tk('Valor inválido.');
  if (!mdOk(input.dues_due_md)) errors.dues_due_md = tk('Escolha um dia válido (dia e mês).');
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { homologate_transfers: input.homologate_transfers !== false, homologation_days: dias, dues_fixed_cents: fixo, dues_per_member_cents: porFiliado, dues_due_md: input.dues_due_md } };
}

/* ----------------------------------------------------- homologação -- */

/** A troca entre duas estaduais da MESMA confederação espera a homologação dela (se a regra dela pede). */
export function needsHomologation(from, to, conf) {
  const a = nationalBodyOf(from);
  const b = nationalBodyOf(to);
  if (!a || !b || a.id !== b.id) return false;
  if (!conf || conf.id !== a.id || !isConfederation(conf) || conf.status !== 'approved') return false;
  return normalizeNationalConfig(conf.national_config).homologate_transfers;
}

export function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** O prazo da homologação: sem resposta até ele, a varredura homologa. */
export const homologationDeadline = (hoje, conf) => addDaysIso(hoje, normalizeNationalConfig(conf && conf.national_config).homologation_days);

/* -------------------------------------------------------- anuidade -- */

export const DUES_STATUS = Object.freeze({ OPEN: 'open', DECLARED: 'declared', PAID: 'paid', WAIVED: 'waived' });
export const DUES_STATUS_LABELS = Object.freeze({
  open: tk('Em aberto'), declared: tk('Pagamento declarado'), paid: tk('Paga'), waived: tk('Dispensada'), overdue: tk('Vencida'),
});

/** O valor da anuidade de uma filiada: fixo + por filiado ativo (a contagem do dia, a mesma da página). */
export function duesAmount(config, memberCount) {
  const c = normalizeNationalConfig(config);
  const n = Math.max(0, Math.trunc(Number(memberCount) || 0));
  return { fixed_cents: c.dues_fixed_cents, per_member_cents: c.dues_per_member_cents, member_count: n, amount_cents: c.dues_fixed_cents + c.dues_per_member_cents * n };
}

export const duesDueDate = (config, year) => `${year}-${normalizeNationalConfig(config).dues_due_md}`;

/** O ano que pode ser lançado: o anterior, o atual ou o próximo. */
export function duesYearOk(year, hoje) {
  const y = Number(String(hoje || '').slice(0, 4));
  return Number.isInteger(year) && year >= y - 1 && year <= y + 1;
}

/**
 * `declare` (a estadual), `confirm`/`reopen`/`waive` (a confederação).
 * Devolve `{ status }` ou `{ error }`.
 */
export function duesTransition(d, action) {
  const s = d && d.status;
  const T = {
    declare: [[DUES_STATUS.OPEN], DUES_STATUS.DECLARED],
    confirm: [[DUES_STATUS.OPEN, DUES_STATUS.DECLARED], DUES_STATUS.PAID],
    reopen: [[DUES_STATUS.DECLARED, DUES_STATUS.PAID, DUES_STATUS.WAIVED], DUES_STATUS.OPEN],
    waive: [[DUES_STATUS.OPEN, DUES_STATUS.DECLARED], DUES_STATUS.WAIVED],
  }[action];
  if (!T) return { error: tk('Ação desconhecida.') };
  if (!T[0].includes(s)) return { error: tk('A anuidade já mudou de situação. Atualize a página.') };
  return { status: T[1] };
}

export const duesNeedsReason = (action) => action === 'reopen' || action === 'waive';

/** A situação na tela: em aberto depois do vencimento é "vencida". */
export const duesState = (d, hoje) => (d && d.status === DUES_STATUS.OPEN && isIso(d.due) && d.due < hoje ? 'overdue' : (d && d.status) || DUES_STATUS.OPEN);

/** A varredura avisa UMA vez por vencimento. */
export const duesToWarn = (d, hoje) => duesState(d, hoje) === 'overdue' && d.warned_for !== d.due;

const pagas = (dues) => lista(dues).filter((d) => d && d.status === DUES_STATUS.PAID && isIso(d.paid_at) && Number(d.amount_cents) > 0);

/** As anuidades PAGAS como receita da confederação (no formato de `extraIncomeItems`). */
export function duesIncome(dues) {
  return pagas(dues).map((d) => ({
    date: d.paid_at, amount_cents: Math.trunc(Number(d.amount_cents)), category: 'memberships', ref: `dues:${d.id}`,
    description: str(`${t('Anuidade')} ${d.year} · ${d.federation_acronym || d.federation_name || ''}`, 200), counterparty: str(d.federation_name, 120), auto: 'dues',
  }));
}

/** As anuidades PAGAS como despesa da estadual (no formato de `extraExpenseItems`). */
export function duesExpenses(dues) {
  return pagas(dues).map((d) => ({
    date: d.paid_at, amount_cents: Math.trunc(Number(d.amount_cents)), category: 'taxes', ref: `dues:${d.id}`,
    description: str(`${t('Anuidade')} ${d.year} · ${d.conf_acronym || d.conf_name || ''}`, 200), counterparty: str(d.conf_name, 120), auto: 'dues',
  }));
}

/* ------------------------------------------------------- permissões -- */

export const canManageNetwork = (perms = []) => perms.includes('admin');
export const canHomologate = (perms = []) => perms.includes('members') || perms.includes('admin');
export const canManageDues = (perms = []) => perms.includes('finance') || perms.includes('admin');
export const canSeeDues = (perms = []) => canManageDues(perms) || perms.includes('fiscal');
