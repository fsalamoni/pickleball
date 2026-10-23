/**
 * GESTÃO DA FEDERAÇÃO no servidor (Bloco 5, `docs/50` §34). Só o servidor
 * grava as duas coleções (a regra é `write: if false`):
 *
 *  - `federation_sponsor_contracts` (módulo `sponsors`, permissão `finance`
 *    ou `admin`; o conselho fiscal lê): vigência, parcelas e contrapartidas.
 *    A parcela RECEBIDA entra nas contas como receita de patrocínio derivada
 *    (`receitas`, lida por `federationAccounts`), sem lançamento à mão. Período
 *    com prestação de contas enviada não aceita recebimento novo nem desfeito.
 *  - `federation_assets` (módulo `assets`, `finance`/`admin`/`competitions`;
 *    o conselho fiscal lê): o bem com quantidade e os empréstimos a clube,
 *    arena ou evento, com a devolução registrada (data e estado).
 *
 * A varredura avisa uma vez cada: o fim da vigência a 30 dias (admin e
 * financeiro), a parcela vencida sem receber (financeiro), a contrapartida
 * atrasada (admin) e o empréstimo vencido sem devolução (quem emprestou).
 *
 * A conta pura é `federationManagementPolicy.js` (cópia de
 * `src/modules/federations/domain/management.js`, com paridade).
 */
const crypto = require('node:crypto');
const P = require('./federationManagementPolicy.js');
const A = require('./federationAccountsPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const CONTRACTS = 'federation_sponsor_contracts';
const ASSETS = 'federation_assets';
const linkGestao = (fedId, aba) => `/federacoes/${fedId}/gerir?aba=${aba}`;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const reais = (c) => `R$ ${(Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',')}`;
const novoId = () => crypto.randomBytes(6).toString('hex').slice(0, 10);
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now, ...extra }].slice(-50);

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', `Confira os campos: ${Object.keys(r.errors).join(', ')}.`);
  return r.value;
}

function exigeMotivo(data) {
  const motivo = texto(data.reason, 300);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  return motivo;
}

const exigeData = (v, hoje) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : hoje;
  if (d > hoje) falha('invalid-argument', 'A data não pode ser no futuro.');
  return d;
};

async function contexto(ctx, actor, data, modulo) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules[modulo] === true)) falha('failed-precondition', modulo === 'sponsors' ? 'Esta federação não tem o módulo de patrocinadores ligado.' : 'Esta federação não tem o módulo de patrimônio ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  const pode = modulo === 'sponsors' ? P.canManageContracts(perms) : P.canManageAssets(perms);
  if (!pode) falha('permission-denied', modulo === 'sponsors' ? 'Só o financeiro e a administração cuidam dos contratos de patrocínio.' : 'Só o financeiro, a administração e as competições cuidam do patrimônio.');
  return { fed, perms, hoje: m.isoDateBR(ctx.now), admin: perms.includes('admin') };
}

async function doc(ctx, c, colecao, id, nome) {
  const ref = ctx.db.collection(colecao).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', `${nome} não encontrado.`);
  return { ref, d: { id: snap.id, ...snap.data() } };
}

async function relatorios(ctx, fedId) {
  const snap = await ctx.db.collection('federation_account_reports').where('federation_id', '==', fedId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** A parcela recebida mexe na conta: período com prestação ENVIADA não muda por baixo. */
async function exigePeriodoAberto(ctx, fed, date) {
  if (!(fed.modules && fed.modules.accounts === true)) return;
  const fechado = A.closedPeriodFor(date, await relatorios(ctx, fed.id));
  if (fechado) falha('failed-precondition', `A prestação de contas de ${fechado} já foi enviada: este período está fechado.`);
}

/* ============================================================ contratos == */

async function contractSave(ctx, actor, data, c) {
  const v = exigeValido(P.validateContract(data.contract || {}));
  if (!data.contractId) {
    const novo = P.mergeContractEdit(null, v).value;
    const ref = await ctx.db.collection(CONTRACTS).add({
      ...novo, federation_id: c.fed.id, status: P.CONTRACT_STATUS.ACTIVE, warned: { expiry_for: '', installments: [], counterparts: [] },
      created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'create'),
    });
    await f.auditoria(ctx, actor, 'federation_contract_create', { federation_id: c.fed.id, contract_id: ref.id, total_cents: novo.total_cents });
    return { ok: true, contractId: ref.id };
  }
  const { ref, d } = await doc(ctx, c, CONTRACTS, data.contractId, 'Contrato');
  if (d.status === P.CONTRACT_STATUS.CANCELLED) falha('failed-precondition', 'Contrato cancelado não se edita.');
  const r = P.mergeContractEdit(d, v);
  if (r.error) falha('failed-precondition', r.error);
  const warned = d.warned || {};
  await ref.update({
    ...r.value, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'update'),
    // Fim da vigência mudou: o aviso de vencimento volta a valer para a data nova.
    warned: { expiry_for: warned.expiry_for === r.value.end ? warned.expiry_for : '', installments: (warned.installments || []), counterparts: (warned.counterparts || []) },
  });
  await f.auditoria(ctx, actor, 'federation_contract_update', { federation_id: c.fed.id, contract_id: d.id, total_cents: r.value.total_cents });
  return { ok: true, contractId: d.id };
}

async function contractReceive(ctx, actor, data, c) {
  const { ref, d } = await doc(ctx, c, CONTRACTS, data.contractId, 'Contrato');
  if (d.status === P.CONTRACT_STATUS.CANCELLED) falha('failed-precondition', 'Contrato cancelado.');
  const id = texto(data.installmentId, 12);
  const parcela = (d.installments || []).find((x) => x.id === id);
  if (!parcela) falha('not-found', 'Parcela não encontrada.');
  if (parcela.received_at) falha('failed-precondition', 'Esta parcela já foi recebida.');
  const quando = exigeData(data.date, c.hoje);
  await exigePeriodoAberto(ctx, c.fed, quando);
  const installments = d.installments.map((x) => (x.id === id ? { ...x, received_at: quando, received_by: actor.uid } : x));
  await ref.update({ installments, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'receive', { installment: id, date: quando }) });
  await f.auditoria(ctx, actor, 'federation_contract_receive', { federation_id: c.fed.id, contract_id: d.id, installment: id, amount_cents: parcela.amount_cents, date: quando });
  return { ok: true };
}

async function contractUnreceive(ctx, actor, data, c) {
  const { ref, d } = await doc(ctx, c, CONTRACTS, data.contractId, 'Contrato');
  const id = texto(data.installmentId, 12);
  const parcela = (d.installments || []).find((x) => x.id === id);
  if (!parcela || !parcela.received_at) falha('failed-precondition', 'Esta parcela não está recebida.');
  const motivo = exigeMotivo(data);
  await exigePeriodoAberto(ctx, c.fed, parcela.received_at);
  const installments = d.installments.map((x) => (x.id === id ? { ...x, received_at: '', received_by: '' } : x));
  await ref.update({ installments, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'unreceive', { installment: id, reason: motivo }) });
  await f.auditoria(ctx, actor, 'federation_contract_unreceive', { federation_id: c.fed.id, contract_id: d.id, installment: id, reason: motivo });
  return { ok: true };
}

async function contractDeliver(ctx, actor, data, c) {
  const { ref, d } = await doc(ctx, c, CONTRACTS, data.contractId, 'Contrato');
  if (d.status === P.CONTRACT_STATUS.CANCELLED) falha('failed-precondition', 'Contrato cancelado.');
  const id = texto(data.counterpartId, 12);
  const alvo = (d.counterparts || []).find((x) => x.id === id);
  if (!alvo) falha('not-found', 'Contrapartida não encontrada.');
  const desfazer = data.undo === true;
  if (!desfazer && alvo.done_at) falha('failed-precondition', 'Esta contrapartida já foi entregue.');
  const quando = desfazer ? '' : exigeData(data.date, c.hoje);
  const counterparts = d.counterparts.map((x) => (x.id === id ? { ...x, done_at: quando, done_by: desfazer ? '' : actor.uid } : x));
  await ref.update({ counterparts, updated_at_ms: ctx.now, history: historico(d, actor, ctx, desfazer ? 'undeliver' : 'deliver', { counterpart: id }) });
  return { ok: true };
}

async function contractCancel(ctx, actor, data, c) {
  if (!c.admin) falha('permission-denied', 'Só a administração cancela ou apaga contratos.');
  const { ref, d } = await doc(ctx, c, CONTRACTS, data.contractId, 'Contrato');
  if (data.remove === true) {
    if ((d.installments || []).some((x) => x.received_at)) falha('failed-precondition', 'Contrato com parcela recebida não se apaga (ela está nas contas): cancele.');
    await ref.delete();
    await f.auditoria(ctx, actor, 'federation_contract_delete', { federation_id: c.fed.id, contract_id: d.id });
    return { ok: true };
  }
  if (d.status === P.CONTRACT_STATUS.CANCELLED) falha('failed-precondition', 'Este contrato já está cancelado.');
  const motivo = exigeMotivo(data);
  await ref.update({ status: P.CONTRACT_STATUS.CANCELLED, cancelled_reason: motivo, cancelled_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'cancel', { reason: motivo }) });
  await f.auditoria(ctx, actor, 'federation_contract_cancel', { federation_id: c.fed.id, contract_id: d.id, reason: motivo });
  return { ok: true };
}

/* =========================================================== patrimônio == */

async function assetSave(ctx, actor, data, c) {
  const v = exigeValido(P.validateAsset(data.asset || {}));
  if (!data.assetId) {
    const ref = await ctx.db.collection(ASSETS).add({ ...v, federation_id: c.fed.id, status: P.ASSET_STATUS.ACTIVE, loans: [], created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'create') });
    await f.auditoria(ctx, actor, 'federation_asset_create', { federation_id: c.fed.id, asset_id: ref.id });
    return { ok: true, assetId: ref.id };
  }
  const { ref, d } = await doc(ctx, c, ASSETS, data.assetId, 'Bem');
  const fora = P.assetState(d, c.hoje).lent;
  if (v.quantity < fora) falha('failed-precondition', `Há ${fora} emprestado(s): a quantidade não pode ficar abaixo disso.`);
  await ref.update({ ...v, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'update') });
  await f.auditoria(ctx, actor, 'federation_asset_update', { federation_id: c.fed.id, asset_id: d.id });
  return { ok: true, assetId: d.id };
}

async function assetLoan(ctx, actor, data, c) {
  const { ref, d } = await doc(ctx, c, ASSETS, data.assetId, 'Bem');
  const v = exigeValido(P.validateLoan(d, data.loan || {}, c.hoje));
  if (v.out_at > c.hoje) falha('invalid-argument', 'A saída não pode ser no futuro.');
  const loan = { id: novoId(), ...v, lent_by: actor.uid, lent_by_name: texto(actor.name, 80), lent_at_ms: ctx.now, returned_at: '', warned_for: '' };
  await ref.update({ loans: P.trimLoans([...(d.loans || []), loan]), updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'loan', { loan: loan.id, quantity: v.quantity, to: v.borrower_name }) });
  await f.auditoria(ctx, actor, 'federation_asset_loan', { federation_id: c.fed.id, asset_id: d.id, loan_id: loan.id, quantity: v.quantity });
  return { ok: true, loanId: loan.id };
}

async function assetReturn(ctx, actor, data, c) {
  const { ref, d } = await doc(ctx, c, ASSETS, data.assetId, 'Bem');
  const id = texto(data.loanId, 12);
  const loan = (d.loans || []).find((l) => l.id === id);
  if (!loan || loan.returned_at) falha('failed-precondition', 'Este empréstimo não está em aberto.');
  const quando = exigeData(data.date, c.hoje);
  if (quando < loan.out_at) falha('invalid-argument', 'A devolução vem depois da saída.');
  const condicao = P.ASSET_CONDITIONS.includes(data.condition) ? data.condition : 'good';
  const loans = d.loans.map((l) => (l.id === id ? { ...l, returned_at: quando, returned_by: actor.uid, return_condition: condicao, return_note: texto(data.note, 300) } : l));
  // Voltou danificado: o estado do bem passa a dizer isso (a equipe corrige se só uma parte se danificou).
  const extra = condicao === 'damaged' ? { condition: 'damaged' } : {};
  await ref.update({ ...extra, loans: P.trimLoans(loans), updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'return', { loan: id, condition: condicao }) });
  await f.auditoria(ctx, actor, 'federation_asset_return', { federation_id: c.fed.id, asset_id: d.id, loan_id: id, condition: condicao });
  return { ok: true };
}

async function assetRetire(ctx, actor, data, c) {
  const { ref, d } = await doc(ctx, c, ASSETS, data.assetId, 'Bem');
  if (data.remove === true) {
    if (!c.admin) falha('permission-denied', 'Só a administração apaga um bem do inventário.');
    if ((d.loans || []).length) falha('failed-precondition', 'Bem com empréstimos registrados não se apaga: dê baixa.');
    await ref.delete();
    await f.auditoria(ctx, actor, 'federation_asset_delete', { federation_id: c.fed.id, asset_id: d.id });
    return { ok: true };
  }
  if (data.undo === true) {
    if (d.status !== P.ASSET_STATUS.RETIRED) falha('failed-precondition', 'Este bem não está baixado.');
    await ref.update({ status: P.ASSET_STATUS.ACTIVE, retired_reason: '', updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'reactivate') });
    return { ok: true };
  }
  if (P.assetState(d, c.hoje).lent > 0) falha('failed-precondition', 'Há empréstimo em aberto: registre a devolução antes da baixa.');
  const motivo = exigeMotivo(data);
  await ref.update({ status: P.ASSET_STATUS.RETIRED, retired_reason: motivo, retired_at: c.hoje, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'retire', { reason: motivo }) });
  await f.auditoria(ctx, actor, 'federation_asset_retire', { federation_id: c.fed.id, asset_id: d.id, reason: motivo });
  return { ok: true };
}

/* ============================================================== callable == */

const ACOES = {
  contract_save: ['sponsors', contractSave],
  contract_receive: ['sponsors', contractReceive],
  contract_unreceive: ['sponsors', contractUnreceive],
  contract_deliver: ['sponsors', contractDeliver],
  contract_cancel: ['sponsors', contractCancel],
  asset_save: ['assets', assetSave],
  asset_loan: ['assets', assetLoan],
  asset_return: ['assets', assetReturn],
  asset_retire: ['assets', assetRetire],
};

async function management(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao[1](ctx, actor, data, await contexto(ctx, actor, data, acao[0]));
}

/* ============================================================= varredura == */

async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  if (!lista.length) return 0;
  const batch = ctx.db.batch();
  lista.forEach((uid) => f.aviso(ctx, batch, uid, msg));
  await batch.commit();
  return lista.length;
}

async function federacaoLigada(ctx, cache, fedId, modulo) {
  if (!cache.has(fedId)) {
    const s = await ctx.db.collection(f.C.federations).doc(fedId).get();
    cache.set(fedId, s.exists ? s.data() : null);
  }
  const fed = cache.get(fedId);
  return Boolean(fed && fed.status === 'approved' && fed.modules && fed.modules[modulo] === true);
}

async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const feds = new Map();
  let avisos = 0;
  const contratos = await ctx.db.collection(CONTRACTS).where('status', '==', P.CONTRACT_STATUS.ACTIVE).get();
  for (const s of contratos.docs) {
    const c = { id: s.id, ...s.data() };
    // eslint-disable-next-line no-await-in-loop
    if (!(await federacaoLigada(ctx, feds, c.federation_id, 'sponsors'))) continue;
    const al = P.contractAlerts(c, hoje);
    if (!al.expiry && !al.installments.length && !al.counterparts.length) continue;
    const link = linkGestao(c.federation_id, 'contratos-patrocinio');
    const w = c.warned || {};
    /* eslint-disable no-await-in-loop */
    if (al.expiry) {
      const ids = [...await f.staffIds(ctx, c.federation_id, 'admin'), ...await f.staffIds(ctx, c.federation_id, 'finance')];
      avisos += await avisar(ctx, ids, { title: tx('Contrato de patrocínio vence em {data}', { data: br(c.end) }), message: tx('O contrato com {patrocinador} acaba em {data}. Combine a renovação ou o encerramento.', { patrocinador: c.sponsor_name, data: br(c.end) }), link });
    }
    if (al.installments.length) {
      const valor = (c.installments || []).filter((x) => al.installments.includes(x.id)).reduce((t, x) => t + (Number(x.amount_cents) || 0), 0);
      avisos += await avisar(ctx, await f.staffIds(ctx, c.federation_id, 'finance'), { title: tx('Parcela de patrocínio sem receber'), message: tx('{patrocinador}: {valor} venceu e não está marcado como recebido.', { patrocinador: c.sponsor_name, valor: reais(valor) }), link });
    }
    if (al.counterparts.length) {
      avisos += await avisar(ctx, await f.staffIds(ctx, c.federation_id, 'admin'), { title: tx('Contrapartida de patrocínio atrasada'), message: tx('O contrato com {patrocinador} tem {n} contrapartida(s) com o prazo vencido.', { patrocinador: c.sponsor_name, n: al.counterparts.length }), link });
    }
    await s.ref.update({ warned: {
      expiry_for: al.expiry ? c.end : (w.expiry_for || ''),
      installments: [...new Set([...(w.installments || []), ...al.installments])].slice(-100),
      counterparts: [...new Set([...(w.counterparts || []), ...al.counterparts])].slice(-100),
    } });
    /* eslint-enable no-await-in-loop */
  }
  const bens = await ctx.db.collection(ASSETS).where('status', '==', P.ASSET_STATUS.ACTIVE).get();
  for (const s of bens.docs) {
    const a = { id: s.id, ...s.data() };
    const atrasados = P.overdueLoansToWarn(a, hoje);
    if (!atrasados.length) continue;
    // eslint-disable-next-line no-await-in-loop
    if (!(await federacaoLigada(ctx, feds, a.federation_id, 'assets'))) continue;
    for (const l of atrasados) {
      // eslint-disable-next-line no-await-in-loop
      const para = l.lent_by ? [l.lent_by] : await f.staffIds(ctx, a.federation_id, 'admin');
      // eslint-disable-next-line no-await-in-loop
      avisos += await avisar(ctx, para, { title: tx('Empréstimo sem devolução: {bem}', { bem: a.name }), message: tx('{qtd} × {bem} emprestado(s) a {quem} deveria(m) ter voltado em {data}.', { qtd: l.quantity, bem: a.name, quem: l.borrower_name, data: br(l.due_at) }), link: linkGestao(a.federation_id, 'patrimonio') });
    }
    const ids = atrasados.map((l) => l.id);
    // eslint-disable-next-line no-await-in-loop
    await s.ref.update({ loans: (a.loans || []).map((l) => (ids.includes(l.id) ? { ...l, warned_for: l.due_at } : l)) });
  }
  if (ctx.logger) ctx.logger.info('Federações: contratos e patrimônio.', { avisos });
  return { notices: avisos };
}

/** As receitas derivadas das contas: as parcelas recebidas dos contratos (módulo `sponsors` ligado). */
async function receitas(ctx, fed) {
  if (!(fed.modules && fed.modules.sponsors === true)) return [];
  const snap = await ctx.db.collection(CONTRACTS).where('federation_id', '==', fed.id).get();
  return P.sponsorIncome(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

module.exports = { management, sweep, receitas, CONTRACTS, ASSETS };
