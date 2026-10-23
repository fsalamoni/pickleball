/**
 * REPASSES da cobrança dividida (rodada 3, Bloco 6d, `docs/50` §46).
 *
 * A cobrança de filiação paga anota a parte do clube e da confederação em
 * `federation_repasses/{cobrança}_{destino}` ("a repassar", `federations.js`
 * → `anotarRepasses`). Aqui o financeiro da federação que recebeu:
 *
 *  - `pay`: fez a transferência → "Repassado" na data (vira despesa derivada
 *    dela e receita derivada da confederação); avisa o financeiro da
 *    confederação;
 *  - `reopen`: desfaz (marcou por engano), com motivo.
 *
 * Período com prestação de contas enviada (de quem repassa ou da confederação)
 * não aceita nenhum dos dois. `contas` entrega os itens derivados às contas.
 */
const P = require('./federationSplitPolicy.js');
const A = require('./federationAccountsPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const REPASSES = 'federation_repasses';

async function exigePeriodoAberto(ctx, fedId, date) {
  const s = await ctx.db.collection(f.C.federations).doc(fedId).get();
  const fed = s.exists ? s.data() : {};
  if (!(fed.modules && fed.modules.accounts === true)) return;
  const reps = await ctx.db.collection('federation_account_reports').where('federation_id', '==', fedId).get();
  const fechado = A.closedPeriodFor(date, reps.docs.map((d) => ({ id: d.id, ...d.data() })));
  if (fechado) falha('failed-precondition', `A prestação de contas de ${fechado} da ${fed.acronym || fed.name || 'federação'} já foi enviada: este período está fechado.`);
}

async function split(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const action = texto(data.action, 20);
  if (!['pay', 'reopen'].includes(action)) falha('invalid-argument', 'Ação desconhecida.');
  const ref = ctx.db.collection(REPASSES).doc(texto(data.repasseId, 160));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Repasse não encontrado.');
  const r = { id: snap.id, ...snap.data() };
  const perms = await f.staffPerms(ctx, r.federation_id, actor);
  if (!perms.includes('finance') && !perms.includes('admin')) falha('permission-denied', 'Só o financeiro (ou quem administra a federação) marca repasses.');
  const tr = P.repasseTransition(r, action);
  if (!tr.ok) falha('failed-precondition', tr.error);
  const hoje = m.isoDateBR(ctx.now);
  const reason = texto(data.reason, 300);
  if (action === 'reopen' && reason.length < 3) falha('invalid-argument', 'Diga o motivo.');
  // A data que sai das contas (ao desfazer) e a que entra (ao marcar) têm de cair em período aberto, dos dois lados.
  const data_ = action === 'pay' ? hoje : r.paid_at;
  await exigePeriodoAberto(ctx, r.federation_id, data_);
  if (r.to === P.REPASSE_TO.CONFEDERATION) await exigePeriodoAberto(ctx, r.to_id, data_);
  const historia = [...(r.history || []), { action, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now, ...(reason ? { reason } : {}) }].slice(-20);
  const batch = ctx.db.batch();
  batch.update(ref, action === 'pay'
    ? { status: tr.status, paid_at: hoje, paid_by: actor.uid, history: historia }
    : { status: tr.status, paid_at: null, paid_by: null, history: historia });
  if (action === 'pay' && r.to === P.REPASSE_TO.CONFEDERATION) {
    const fin = [...new Set([...(await f.staffIds(ctx, r.to_id, 'finance')), ...(await f.staffIds(ctx, r.to_id, 'admin'))])];
    fin.forEach((uid) => f.aviso(ctx, batch, uid, {
      title: tx('Repasse recebido da {sigla}', { sigla: r.federation_acronym || r.federation_name }),
      message: tx('{valor} de uma filiação no plano {plano}. Já entra nas contas.', { valor: `R$ ${(r.amount_cents / 100).toFixed(2).replace('.', ',')}`, plano: r.plan_name }),
      link: `/federacoes/${r.to_id}/gerir?aba=contas`,
    }));
  }
  await batch.commit();
  await f.auditoria(ctx, actor, `federation_repasse_${action}`, { federation_id: r.federation_id, repasse_id: r.id, to: r.to, to_id: r.to_id, amount_cents: r.amount_cents, reason });
  return { ok: true };
}

/** Os repasses FEITOS nas contas: despesa de quem repassou, receita da confederação que recebeu. */
async function contas(ctx, fed) {
  const [saiu, entrou] = await Promise.all([
    ctx.db.collection(REPASSES).where('federation_id', '==', fed.id).get(),
    ctx.db.collection(REPASSES).where('to_id', '==', fed.id).get(),
  ]);
  const lerDocs = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { despesas: P.repasseExpenses(lerDocs(saiu)), receitas: P.repasseIncome(lerDocs(entrou)) };
}

module.exports = { split, contas, REPASSES };
