/**
 * PATRIMÔNIO DO CLUBE-ASSOCIAÇÃO (Bloco E2a, flag `club_association`) — o
 * inventário dos bens (redes, bolas, placares, quadras, o que o clube tem) e o
 * empréstimo a quem precisa, com a devolução registrada (data e estado em que
 * voltou). Só o SERVIDOR grava `club_x/{clube}/assets` (a regra é `write: if
 * false` para a espécie).
 *
 * É o patrimônio da federação (`federationManagement.js`) com o clube no lugar
 * dela: a régua — validação do bem, conta de disponível/emprestado/atrasado e
 * do empréstimo — é a MESMA (`federationManagementPolicy.js`); aqui mudam o
 * endereço dos dados, quem pode (cargo do clube) e quem é avisado.
 *
 * Callable `clubManagement` (`finance`, `sports` ou `admin`; o conselho fiscal
 * só lê, pela regra):
 *  - `asset_save`: cadastra ou edita (a quantidade não fica abaixo do que está emprestado);
 *  - `asset_loan`: empresta (clube parceiro, arena, evento, associado), com a devolução combinada;
 *  - `asset_return`: registra a devolução (voltou danificado ⇒ o bem passa a dizer isso);
 *  - `asset_retire`: dá baixa (motivo) / reativa; `remove` apaga o que nunca foi emprestado (administração).
 *
 * A varredura (junto da diária da associação) avisa uma vez o empréstimo que
 * passou da devolução combinada a quem emprestou.
 */
const crypto = require('node:crypto');
const P = require('./federationManagementPolicy.js');
const m = require('./federationMembership.js');
const a = require('./clubAssociation.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const ASSETS = 'assets';
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const novoId = () => crypto.randomBytes(6).toString('hex').slice(0, 10);
const link = (club) => `/clubes/${club.id}/gerir?aba=patrimonio`;
const historico = (d, actor, ctx, action, extra = {}) => [...(d.history || []), { action, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now, ...extra }].slice(-50);

const PODE = ['admin', 'finance', 'sports'];

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

async function contexto(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  const perms = await a.permsDe(ctx, club.id, actor.uid);
  if (!PODE.some((p) => perms.includes(p))) falha('permission-denied', 'Só o financeiro, a diretoria esportiva e a administração cuidam do patrimônio do clube.');
  return { club, perms, hoje: m.isoDateBR(ctx.now), admin: perms.includes('admin') };
}

async function bem(ctx, c, id) {
  const ref = col(ctx, c.club.id, ASSETS).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().club_id !== c.club.id) falha('not-found', 'Bem não encontrado.');
  return { ref, d: { id: snap.id, ...snap.data() } };
}

async function assetSave(ctx, actor, data, c) {
  const v = exigeValido(P.validateAsset(data.asset || {}));
  if (!data.assetId) {
    const ref = await col(ctx, c.club.id, ASSETS).add({ ...v, club_id: c.club.id, status: P.ASSET_STATUS.ACTIVE, loans: [], created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'create') });
    await a.auditoria(ctx, actor, 'club_asset_create', { club_id: c.club.id, asset_id: ref.id });
    return { ok: true, assetId: ref.id };
  }
  const { ref, d } = await bem(ctx, c, data.assetId);
  const fora = P.assetState(d, c.hoje).lent;
  if (v.quantity < fora) falha('failed-precondition', `Há ${fora} emprestado(s): a quantidade não pode ficar abaixo disso.`);
  await ref.update({ ...v, updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'update') });
  await a.auditoria(ctx, actor, 'club_asset_update', { club_id: c.club.id, asset_id: d.id });
  return { ok: true, assetId: d.id };
}

async function assetLoan(ctx, actor, data, c) {
  const { ref, d } = await bem(ctx, c, data.assetId);
  const v = exigeValido(P.validateLoan(d, data.loan || {}, c.hoje));
  if (v.out_at > c.hoje) falha('invalid-argument', 'A saída não pode ser no futuro.');
  const loan = { id: novoId(), ...v, lent_by: actor.uid, lent_by_name: texto(actor.name, 80), lent_at_ms: ctx.now, returned_at: '', warned_for: '' };
  await ref.update({ loans: P.trimLoans([...(d.loans || []), loan]), updated_at_ms: ctx.now, history: historico(d, actor, ctx, 'loan', { loan: loan.id, quantity: v.quantity, to: v.borrower_name }) });
  await a.auditoria(ctx, actor, 'club_asset_loan', { club_id: c.club.id, asset_id: d.id, loan_id: loan.id, quantity: v.quantity });
  return { ok: true, loanId: loan.id };
}

async function assetReturn(ctx, actor, data, c) {
  const { ref, d } = await bem(ctx, c, data.assetId);
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
  await a.auditoria(ctx, actor, 'club_asset_return', { club_id: c.club.id, asset_id: d.id, loan_id: id, condition: condicao });
  return { ok: true };
}

async function assetRetire(ctx, actor, data, c) {
  const { ref, d } = await bem(ctx, c, data.assetId);
  if (data.remove === true) {
    if (!c.admin) falha('permission-denied', 'Só a administração apaga um bem do inventário.');
    if ((d.loans || []).length) falha('failed-precondition', 'Bem com empréstimos registrados não se apaga: dê baixa.');
    await ref.delete();
    await a.auditoria(ctx, actor, 'club_asset_delete', { club_id: c.club.id, asset_id: d.id });
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
  await a.auditoria(ctx, actor, 'club_asset_retire', { club_id: c.club.id, asset_id: d.id, reason: motivo });
  return { ok: true };
}

const ACOES = { asset_save: assetSave, asset_loan: assetLoan, asset_return: assetReturn, asset_retire: assetRetire };

async function management(ctx, actor, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, actor, data, await contexto(ctx, actor, data));
}

/**
 * Diária: avisa, uma vez por devolução combinada, o empréstimo vencido sem
 * devolução (a quem emprestou; sem ele, à administração do clube).
 * ponytail: lê os bens ativos de cada clube com associação aberta; sem índice novo.
 */
async function sweep(ctx) {
  if (!(await a.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  let avisos = 0;
  const clubes = await ctx.db.collection('clubs').where('association.enabled', '==', true).get();
  for (const cd of clubes.docs) {
    const club = { id: cd.id, ...cd.data() };
    // eslint-disable-next-line no-await-in-loop
    const bens = await col(ctx, club.id, ASSETS).where('status', '==', P.ASSET_STATUS.ACTIVE).get();
    for (const s of bens.docs) {
      const x = { id: s.id, ...s.data() };
      const atrasados = P.overdueLoansToWarn(x, hoje);
      if (!atrasados.length) continue;
      for (const l of atrasados) {
        // eslint-disable-next-line no-await-in-loop
        const para = l.lent_by ? [l.lent_by] : await a.quemTem(ctx, club.id, 'admin');
        const batch = ctx.db.batch();
        para.forEach((uid) => a.aviso(ctx, batch, uid, {
          title: tx('Empréstimo sem devolução: {bem}', { bem: x.name }),
          message: tx('{qtd} × {bem} emprestado(s) a {quem} deveria(m) ter voltado em {data}.', { qtd: l.quantity, bem: x.name, quem: l.borrower_name, data: br(l.due_at) }),
          link: link(club),
        }));
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
        avisos += para.length;
      }
      const ids = atrasados.map((l) => l.id);
      // eslint-disable-next-line no-await-in-loop
      await s.ref.update({ loans: (x.loans || []).map((l) => (ids.includes(l.id) ? { ...l, warned_for: l.due_at } : l)) });
    }
  }
  if (ctx.logger) ctx.logger.info('Clubes: patrimônio.', { avisos });
  return { notices: avisos };
}

module.exports = { management, sweep, ASSETS };
