/**
 * Gestão da federação (Bloco 5) — a conta PURA dos contratos de patrocínio e
 * do patrimônio.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/management.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationManagement.parity.test.js`. Ids, estados e categorias são
 * GRAVADOS: nunca renomeie.
 */
const t = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : `{${k}}`));
const str = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const cents = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, AMOUNT_MAX) : 0; };
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const idOk = (v) => /^[a-z0-9]{1,12}$/.test(String(v || ''));
/** Ids estáveis da linha: o que veio (válido e único) fica; a linha nova ganha o primeiro `{prefixo}{n}` livre. */
const comIds = (itens, prefixo) => {
  const dados = new Set(itens.map((x) => x?.id).filter(idOk));
  const vistos = new Set();
  return itens.map((x, i) => {
    let id = idOk(x?.id) && !vistos.has(x.id) ? x.id : '';
    if (!id) { let k = i + 1; while (dados.has(`${prefixo}${k}`) || vistos.has(`${prefixo}${k}`)) k += 1; id = `${prefixo}${k}`; }
    vistos.add(id);
    return id;
  });
};
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const somaMeses = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d, ultimo))).toISOString().slice(0, 10);
};

const AMOUNT_MAX = 100_000_000_000;
const CONTRACT_EXPIRY_WARN_DAYS = 30;
const INSTALLMENTS_MAX = 60;
const COUNTERPARTS_MAX = 30;
const CONTRACT_NOTES_MAX = 2000;
const ASSET_NOTES_MAX = 1000;
const ASSET_QTY_MAX = 9999;
const LOANS_KEPT = 100;

/* ------------------------------------------------- contratos de patrocínio -- */

const CONTRACT_STATUS = Object.freeze({ ACTIVE: 'active', CANCELLED: 'cancelled' });
/** A situação na tela (derivada da vigência): `upcoming` ainda não começou, `expiring` acaba em até 30 dias. */
const CONTRACT_STATE_LABELS = Object.freeze({
  upcoming: ('A começar'), active: ('Em vigor'), expiring: ('Vence em breve'), ended: ('Encerrado'), cancelled: ('Cancelado'),
});
const CONTRACT_TIERS = Object.freeze(['main', 'support', 'partner']);

/** Um contrato que a pessoa digitou → o que pode ser gravado (o servidor confere de novo). */
function validateContract(input = {}) {
  const errors = {};
  const sponsor_name = str(input.sponsor_name, 120);
  if (sponsor_name.length < 2) errors.sponsor_name = t('Diga o nome do patrocinador.');
  const start = isIso(input.start) ? input.start : '';
  const end = isIso(input.end) ? input.end : '';
  if (!start) errors.start = t('Informe o início da vigência.');
  if (!end) errors.end = t('Informe o fim da vigência.');
  else if (start && end < start) errors.end = t('O fim vem depois do início.');
  const tier = CONTRACT_TIERS.includes(input.tier) ? input.tier : 'support';
  const parcelasIn = lista(input.installments).slice(0, INSTALLMENTS_MAX);
  const idsP = comIds(parcelasIn, 'p');
  const installments = parcelasIn.map((x, i) => {
    const id = idsP[i];
    const due = isIso(x?.due) ? x.due : '';
    const amount_cents = cents(x?.amount_cents);
    if (!due || !amount_cents) errors[`installments.${i}`] = t('Cada parcela precisa de vencimento e valor.');
    return { id, due, amount_cents };
  });
  if (lista(input.installments).length > INSTALLMENTS_MAX) errors.installments = t('No máximo {n} parcelas.', { n: INSTALLMENTS_MAX });
  const contrasIn = lista(input.counterparts).slice(0, COUNTERPARTS_MAX);
  const idsC = comIds(contrasIn, 'c');
  const counterparts = contrasIn.map((x, i) => {
    const id = idsC[i];
    const text = str(x?.text, 200);
    if (text.length < 3) errors[`counterparts.${i}`] = t('Descreva a contrapartida.');
    return { id, text, due: isIso(x?.due) ? x.due : '' };
  });
  if (lista(input.counterparts).length > COUNTERPARTS_MAX) errors.counterparts = t('No máximo {n} contrapartidas.', { n: COUNTERPARTS_MAX });
  const value = {
    sponsor_name, sponsor_doc: str(input.sponsor_doc, 20), tier, start, end,
    installments: [...installments].sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id)),
    counterparts, notes: txt(input.notes, CONTRACT_NOTES_MAX),
  };
  value.total_cents = value.installments.reduce((s, x) => s + x.amount_cents, 0);
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Divide um total em `n` parcelas mensais a partir de `first` (o resto dos centavos vai na primeira). */
function splitInstallments(totalCents, n, first) {
  const total = cents(totalCents);
  const qtd = Math.min(INSTALLMENTS_MAX, Math.max(1, Math.trunc(Number(n)) || 1));
  if (!total || !isIso(first)) return [];
  const base = Math.floor(total / qtd);
  return Array.from({ length: qtd }, (_, i) => ({ id: `p${i + 1}`, due: somaMeses(first, i), amount_cents: base + (i === 0 ? total - base * qtd : 0) }));
}

/**
 * Junta o que foi digitado com o que já está gravado: a parcela recebida e a
 * contrapartida entregue guardam quem e quando. Parcela recebida não some nem
 * muda de valor (desfaça o recebimento antes) — devolve `error` nesse caso.
 */
function mergeContractEdit(stored, value) {
  const antigas = new Map(lista(stored?.installments).map((x) => [x.id, x]));
  const novas = new Map(value.installments.map((x) => [x.id, x]));
  for (const [id, x] of antigas) {
    if (!x.received_at) continue;
    const n = novas.get(id);
    if (!n || n.amount_cents !== x.amount_cents) return { error: t('A parcela de {data} já foi recebida: desfaça o recebimento antes de mudar ou apagar.', { data: x.due.split('-').reverse().join('/') }) };
  }
  const entregues = new Map(lista(stored?.counterparts).map((x) => [x.id, x]));
  return {
    value: {
      ...value,
      installments: value.installments.map((x) => { const a = antigas.get(x.id); return a && a.received_at ? { ...x, received_at: a.received_at, received_by: a.received_by || '' } : { ...x, received_at: '', received_by: '' }; }),
      counterparts: value.counterparts.map((x) => { const a = entregues.get(x.id); return a && a.done_at ? { ...x, done_at: a.done_at, done_by: a.done_by || '' } : { ...x, done_at: '', done_by: '' }; }),
    },
  };
}

/** A situação do contrato hoje: vigência, quanto entrou, o que venceu sem receber e as contrapartidas. */
function contractState(c, hoje) {
  const parcelas = lista(c?.installments);
  const contras = lista(c?.counterparts);
  let state = 'active';
  if (c?.status === CONTRACT_STATUS.CANCELLED) state = 'cancelled';
  else if (c?.start && hoje < c.start) state = 'upcoming';
  else if (c?.end && hoje > c.end) state = 'ended';
  else if (c?.end && dias(hoje, c.end) <= CONTRACT_EXPIRY_WARN_DAYS) state = 'expiring';
  const recebido = parcelas.filter((x) => x.received_at).reduce((s, x) => s + cents(x.amount_cents), 0);
  const total = parcelas.reduce((s, x) => s + cents(x.amount_cents), 0);
  const atrasadas = state === 'cancelled' ? [] : parcelas.filter((x) => !x.received_at && x.due && x.due < hoje);
  const contrasAtrasadas = state === 'cancelled' ? [] : contras.filter((x) => !x.done_at && x.due && x.due < hoje);
  return {
    state, daysLeft: c?.end ? dias(hoje, c.end) : null,
    total_cents: total, received_cents: recebido, pending_cents: total - recebido,
    overdue: atrasadas, overdue_cents: atrasadas.reduce((s, x) => s + cents(x.amount_cents), 0),
    counterparts_done: contras.filter((x) => x.done_at).length, counterparts_total: contras.length, counterparts_late: contrasAtrasadas,
  };
}

/** As parcelas RECEBIDAS como receita de patrocínio (no formato de `extraIncomeItems`). */
function sponsorIncome(contracts = []) {
  const out = [];
  lista(contracts).forEach((c) => {
    if (!c) return;
    lista(c.installments).filter((x) => isIso(x.received_at) && cents(x.amount_cents)).forEach((x) => out.push({
      date: x.received_at, amount_cents: cents(x.amount_cents), category: 'sponsorship', ref: `sponsor:${c.id}:${x.id}`,
      description: `${str(c.sponsor_name, 80)} · ${x.due.split('-').reverse().join('/')}`.slice(0, 200), counterparty: str(c.sponsor_name, 120), auto: 'sponsor',
    }));
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

/**
 * O que a varredura avisa, uma vez cada: o fim da vigência a 30 dias, a
 * parcela vencida sem receber e a contrapartida atrasada.
 */
function contractAlerts(c, hoje) {
  const st = contractState(c, hoje);
  if (['cancelled', 'ended', 'upcoming'].includes(st.state)) return { expiry: false, installments: [], counterparts: [] };
  const w = c.warned || {};
  return {
    expiry: st.state === 'expiring' && w.expiry_for !== c.end,
    installments: st.overdue.filter((x) => !lista(w.installments).includes(x.id)).map((x) => x.id),
    counterparts: st.counterparts_late.filter((x) => !lista(w.counterparts).includes(x.id)).map((x) => x.id),
  };
}

/* ---------------------------------------------------------- patrimônio -- */

const ASSET_CATEGORIES = Object.freeze(['nets', 'scoreboards', 'balls', 'paddles', 'court_kits', 'electronics', 'furniture', 'uniforms', 'other']);
const ASSET_CATEGORY_LABELS = Object.freeze({
  nets: ('Redes'), scoreboards: ('Placares'), balls: ('Bolas'), paddles: ('Raquetes'), court_kits: ('Kits de quadra (linhas, postes)'),
  electronics: ('Eletrônicos'), furniture: ('Mobiliário e estrutura'), uniforms: ('Uniformes'), other: ('Outros'),
});
const ASSET_CONDITIONS = Object.freeze(['new', 'good', 'fair', 'damaged']);
const ASSET_CONDITION_LABELS = Object.freeze({ new: ('Novo'), good: ('Bom'), fair: ('Regular'), damaged: ('Danificado') });
const ASSET_STATUS = Object.freeze({ ACTIVE: 'active', RETIRED: 'retired' });
/** Para quem se empresta (nunca uma pessoa: o nome digitado não teria como sair na exclusão de conta). */
const BORROWER_KINDS = Object.freeze(['club', 'arena', 'event', 'other']);
const BORROWER_KIND_LABELS = Object.freeze({ club: ('Clube'), arena: ('Arena'), event: ('Evento'), other: ('Outra entidade') });

function validateAsset(input = {}) {
  const errors = {};
  const name = str(input.name, 120);
  if (name.length < 2) errors.name = t('Diga o nome do bem.');
  const quantity = Math.trunc(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > ASSET_QTY_MAX) errors.quantity = t('Quantidade de 1 a {n}.', { n: ASSET_QTY_MAX });
  const value = {
    name, category: ASSET_CATEGORIES.includes(input.category) ? input.category : 'other', code: str(input.code, 30),
    quantity: Number.isFinite(quantity) ? Math.min(ASSET_QTY_MAX, Math.max(1, quantity)) : 1,
    condition: ASSET_CONDITIONS.includes(input.condition) ? input.condition : 'good', location: str(input.location, 120),
    acquired_at: isIso(input.acquired_at) ? input.acquired_at : '', value_cents: cents(input.value_cents), notes: txt(input.notes, ASSET_NOTES_MAX),
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Quanto está emprestado agora e o que sobra. */
function assetState(a, hoje) {
  const abertos = lista(a?.loans).filter((l) => !l.returned_at);
  const fora = abertos.reduce((s, l) => s + (Math.trunc(Number(l.quantity)) || 0), 0);
  return {
    retired: a?.status === ASSET_STATUS.RETIRED,
    lent: fora, available: Math.max(0, (Math.trunc(Number(a?.quantity)) || 0) - fora),
    openLoans: abertos, overdue: abertos.filter((l) => l.due_at && l.due_at < hoje),
  };
}

/** Um empréstimo digitado, conferido contra o que está disponível hoje. */
function validateLoan(asset, input = {}, hoje) {
  const errors = {};
  const st = assetState(asset, hoje);
  if (st.retired) errors.asset = t('Bem baixado não se empresta.');
  const borrower_kind = BORROWER_KINDS.includes(input.borrower_kind) ? input.borrower_kind : 'other';
  const borrower_name = str(input.borrower_name, 120);
  if (borrower_name.length < 2) errors.borrower_name = t('Para quem vai o empréstimo?');
  const quantity = Math.trunc(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1) errors.quantity = t('Quantidade a emprestar.');
  else if (quantity > st.available) errors.quantity = t('Só há {n} disponível(is).', { n: st.available });
  const out_at = isIso(input.out_at) ? input.out_at : hoje;
  const due_at = isIso(input.due_at) ? input.due_at : '';
  if (!due_at) errors.due_at = t('Informe a data combinada para a devolução.');
  else if (due_at < out_at) errors.due_at = t('A devolução vem depois da saída.');
  const value = { borrower_kind, borrower_name, borrower_ref: str(input.borrower_ref, 80), quantity: Number.isFinite(quantity) ? Math.max(1, quantity) : 1, out_at, due_at, note: str(input.note, 300) };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Empréstimos atrasados ainda não avisados (a varredura avisa uma vez por data combinada). */
function overdueLoansToWarn(a, hoje) {
  if (a?.status === ASSET_STATUS.RETIRED) return [];
  return assetState(a, hoje).overdue.filter((l) => l.warned_for !== l.due_at);
}

/** Mantém os empréstimos abertos e os últimos devolvidos (até `LOANS_KEPT`). */
function trimLoans(loans = []) {
  const abertos = lista(loans).filter((l) => !l.returned_at);
  const devolvidos = lista(loans).filter((l) => l.returned_at).sort((a, b) => String(b.returned_at).localeCompare(String(a.returned_at)));
  return [...abertos, ...devolvidos.slice(0, Math.max(0, LOANS_KEPT - abertos.length))];
}

/* ------------------------------------------------------------ permissões -- */

const tem = (perms, ...ps) => Array.isArray(perms) && ps.some((p) => perms.includes(p));
/** Contratos: o financeiro e o admin gerem; o conselho fiscal lê. */
const canManageContracts = (perms) => tem(perms, 'finance', 'admin');
const canViewContracts = (perms) => tem(perms, 'finance', 'admin', 'fiscal');
/** Patrimônio: financeiro, admin e competições (o material vai aos eventos); o conselho fiscal lê. */
const canManageAssets = (perms) => tem(perms, 'finance', 'admin', 'competitions');
const canViewAssets = (perms) => tem(perms, 'finance', 'admin', 'competitions', 'fiscal');

module.exports = {
  AMOUNT_MAX, CONTRACT_EXPIRY_WARN_DAYS, INSTALLMENTS_MAX, COUNTERPARTS_MAX, CONTRACT_NOTES_MAX, ASSET_NOTES_MAX, ASSET_QTY_MAX, LOANS_KEPT, CONTRACT_STATUS, CONTRACT_STATE_LABELS, CONTRACT_TIERS, validateContract, splitInstallments, mergeContractEdit, contractState, sponsorIncome, contractAlerts, ASSET_CATEGORIES, ASSET_CATEGORY_LABELS, ASSET_CONDITIONS, ASSET_CONDITION_LABELS, ASSET_STATUS, BORROWER_KINDS, BORROWER_KIND_LABELS, validateAsset, assetState, validateLoan, overdueLoansToWarn, trimLoans, canManageContracts, canViewContracts, canManageAssets, canViewAssets,
};
