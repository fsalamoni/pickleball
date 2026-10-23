/**
 * CAMADA NACIONAL no servidor (Bloco 6, `docs/50` §35). Só o servidor grava
 * as duas coleções (a regra é `write: if false`):
 *
 *  - `federation_national_links/{conf}_{fed}`: o vínculo da federação
 *    estadual com a confederação. A estadual PEDE (ou a confederação
 *    CONVIDA) e o outro lado aceita; só o admin de cada lado age. Aprovado, o
 *    espelho vai para `federations/{fed}.national_body` (campo travado) — o
 *    selo "Filiada à" e a lista pública das filiadas saem dele. Uma estadual
 *    tem no máximo uma confederação.
 *  - `federation_dues/{conf}_{fed}_{ano}`: o repasse da anuidade. A
 *    confederação lança o ano (fixo + por filiado ativo, pelas regras dela),
 *    a estadual declara o pagamento e a confederação confirma, reabre ou
 *    dispensa. Paga, entra nas contas das duas como item derivado
 *    (`contas`, lido por `federationAccounts`), e período com prestação
 *    enviada não muda por baixo.
 *
 * O RANKING NACIONAL (`federation_rankings/{conf}_nacional_{ano}`) soma os
 * pontos lançados pelas filiadas e pela própria confederação; é refeito
 * quando qualquer uma delas soma o ano (`federationRanking.recomputeSeason`)
 * e quando uma estadual entra ou sai. Ano fechado não muda.
 *
 * A HOMOLOGAÇÃO da transferência entre estaduais da mesma confederação mora
 * em `federationTransfers.js`. A conta pura é `federationNationalPolicy.js`
 * (cópia de `src/modules/federations/domain/national.js`, com paridade).
 */
const P = require('./federationNationalPolicy.js');
const A = require('./federationAccountsPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const LINKS = 'federation_national_links';
const DUES = 'federation_dues';
const linkGestao = (fedId, aba) => `/federacoes/${fedId}/gerir?aba=${aba}`;
const reais = (c) => `R$ ${(Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',')}`;
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now, ...extra }].slice(-50);
const sigla = (fed) => fed.acronym || fed.name || '';

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now) };
}

const exige = (ok, msg) => { if (!ok) falha('permission-denied', msg); };
const exigeAdmin = (c) => exige(P.canManageNetwork(c.perms), 'Só a administração da federação cuida do vínculo com a confederação.');
const exigeFinanceiro = (c) => exige(P.canManageDues(c.perms), 'Só o financeiro e a administração cuidam da anuidade.');
const exigeConf = (c) => { if (!P.isConfederation(c.fed)) falha('failed-precondition', 'Esta federação não é uma confederação.'); };

function exigeMotivo(data) {
  const motivo = texto(data.reason, 300);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  return motivo;
}

async function avisar(ctx, batch, fedId, perms, msg) {
  const ids = new Set();
  for (const p of perms) {
    // eslint-disable-next-line no-await-in-loop
    (await f.staffIds(ctx, fedId, p)).forEach((u) => ids.add(u));
  }
  ids.forEach((uid) => f.aviso(ctx, batch, uid, msg));
}

/* ============================================================= vínculo == */

const resumo = (fed) => ({ name: fed.name || '', acronym: fed.acronym || '', slug: fed.slug || '' });

async function linkOpen(ctx, actor, data, c, action) {
  exigeAdmin(c);
  const outra = await f.federacao(ctx, action === 'request' ? data.confId : data.targetId);
  const [state, conf] = action === 'request' ? [c.fed, outra] : [outra, c.fed];
  const pode = P.canOpenLink(state, conf);
  if (pode.error) falha('failed-precondition', pode.error);
  const ref = ctx.db.collection(LINKS).doc(P.nationalLinkId(conf.id, state.id));
  const snap = await ref.get();
  const atual = snap.exists ? snap.data() : null;
  const r = P.linkTransition(atual, action, action === 'request' ? 'state' : 'national');
  if (r.error) falha('failed-precondition', r.error);
  const batch = ctx.db.batch();
  batch.set(ref, {
    conf_id: conf.id, conf_name: resumo(conf).name, conf_acronym: resumo(conf).acronym, conf_slug: resumo(conf).slug,
    federation_id: state.id, federation_name: resumo(state).name, federation_acronym: resumo(state).acronym, federation_slug: resumo(state).slug, federation_state: state.state || '',
    status: r.status, opened_by_side: action === 'request' ? 'state' : 'national', opened_by: actor.uid, opened_at_ms: ctx.now,
    message: texto(data.message, 500), reason: '', decided_by: null, decided_at_ms: null, since_ms: (atual && atual.since_ms) || null,
    updated_at_ms: ctx.now, history: historico(atual || {}, actor, ctx, action),
  });
  if (action === 'request') {
    await avisar(ctx, batch, conf.id, ['admin'], { title: tx('{sigla} pede filiação à confederação', { sigla: sigla(state) }), message: tx('A federação pede para se filiar à {conf}. Aceite ou recuse em Rede nacional → Filiadas.', { conf: sigla(conf) }), link: linkGestao(conf.id, 'rede-filiadas') });
  } else {
    await avisar(ctx, batch, state.id, ['admin'], { title: tx('{conf} convida a federação a se filiar', { conf: sigla(conf) }), message: tx('Aceite ou recuse o convite em Confederação, na Central.'), link: linkGestao(state.id, 'confederacao') });
  }
  await batch.commit();
  await f.auditoria(ctx, actor, `federation_national_${action}`, { federation_id: c.fed.id, conf_id: conf.id, state_id: state.id });
  return { ok: true, linkId: ref.id };
}

async function linkDecide(ctx, actor, data, c, action) {
  exigeAdmin(c);
  const ref = ctx.db.collection(LINKS).doc(texto(data.linkId, 200));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Vínculo não encontrado.');
  const link = snap.data();
  const side = link.conf_id === c.fed.id ? 'national' : link.federation_id === c.fed.id ? 'state' : null;
  if (!side) falha('not-found', 'Vínculo não encontrado.');
  const r = P.linkTransition(link, action, side);
  if (r.error) falha('failed-precondition', r.error);
  const reason = P.linkNeedsReason(action) ? exigeMotivo(data) : texto(data.reason, 300);
  const [state, conf] = await Promise.all([f.federacao(ctx, link.federation_id), f.federacao(ctx, link.conf_id)]);
  if (action === 'accept') {
    const pode = P.canOpenLink(state, conf);
    if (pode.error) falha('failed-precondition', pode.error);
  }
  const batch = ctx.db.batch();
  const aprovado = r.status === P.LINK_STATUS.APPROVED;
  batch.update(ref, {
    status: r.status, reason, decided_by: actor.uid, decided_at_ms: ctx.now, updated_at_ms: ctx.now,
    ...(aprovado ? { since_ms: ctx.now } : {}), history: historico(link, actor, ctx, action, reason ? { reason } : {}),
  });
  const stateRef = ctx.db.collection(f.C.federations).doc(state.id);
  if (aprovado) batch.update(stateRef, { national_body: { id: conf.id, ...resumo(conf), since_ms: ctx.now }, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  if (action === 'leave' || action === 'remove') batch.update(stateRef, { national_body: null, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  // Avisa o OUTRO lado.
  const outro = side === 'national' ? state : conf;
  const aba = side === 'national' ? 'confederacao' : 'rede-filiadas';
  const textos = {
    accept: [tx('Vínculo nacional aprovado: {a} e {b}', { a: sigla(state), b: sigla(conf) }), tx('{fed} agora é filiada à {conf}. Os pontos dela entram no ranking nacional.', { fed: sigla(state), conf: sigla(conf) })],
    reject: [tx('Vínculo nacional recusado'), reason ? tx('{quem} recusou. Motivo: {motivo}.', { quem: sigla(c.fed), motivo: reason }) : tx('{quem} recusou.', { quem: sigla(c.fed) })],
    cancel: [tx('Pedido de vínculo nacional cancelado'), tx('{quem} cancelou o pedido.', { quem: sigla(c.fed) })],
    leave: [tx('{fed} se desfiliou da confederação', { fed: sigla(state) }), tx('Motivo: {motivo}. Os pontos dela saem do ranking nacional do ano em curso.', { motivo: reason })],
    remove: [tx('A {conf} desligou a federação', { conf: sigla(conf) }), tx('Motivo: {motivo}.', { motivo: reason })],
  }[action];
  await avisar(ctx, batch, outro.id, ['admin'], { title: textos[0], message: textos[1], link: linkGestao(outro.id, aba) });
  await batch.commit();
  await f.auditoria(ctx, actor, `federation_national_${action}`, { federation_id: c.fed.id, conf_id: conf.id, state_id: state.id, reason });
  if (aprovado || action === 'leave' || action === 'remove') await refazerNacional(ctx, conf.id);
  return { ok: true, status: r.status };
}

async function configSave(ctx, actor, data, c) {
  exigeConf(c);
  exigeAdmin(c);
  const r = P.validateNationalConfig(data.config || {});
  if (!r.ok) falha('invalid-argument', `Confira os campos: ${Object.keys(r.errors).join(', ')}.`);
  await ctx.db.collection(f.C.federations).doc(c.fed.id).update({ national_config: r.value, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await f.auditoria(ctx, actor, 'federation_national_config', { federation_id: c.fed.id, config: r.value });
  return { ok: true };
}

/* ============================================================ anuidade == */

async function exigePeriodoAberto(ctx, fedId, date) {
  const s = await ctx.db.collection(f.C.federations).doc(fedId).get();
  const fed = s.exists ? s.data() : {};
  if (!(fed.modules && fed.modules.accounts === true)) return;
  const reps = await ctx.db.collection('federation_account_reports').where('federation_id', '==', fedId).get();
  const fechado = A.closedPeriodFor(date, reps.docs.map((d) => ({ id: d.id, ...d.data() })));
  if (fechado) falha('failed-precondition', `A prestação de contas de ${fechado} da ${fed.acronym || fed.name || 'federação'} já foi enviada: este período está fechado.`);
}

async function duesIssue(ctx, actor, data, c) {
  exigeConf(c);
  exigeFinanceiro(c);
  const year = Math.trunc(Number(data.year));
  if (!P.duesYearOk(year, c.hoje)) falha('invalid-argument', 'Escolha o ano anterior, o atual ou o próximo.');
  const cfg = P.normalizeNationalConfig(c.fed.national_config);
  if (!cfg.dues_fixed_cents && !cfg.dues_per_member_cents) falha('failed-precondition', 'Defina o valor da anuidade em Rede nacional → Regras antes de lançar.');
  const links = await ctx.db.collection(LINKS).where('conf_id', '==', c.fed.id).where('status', '==', P.LINK_STATUS.APPROVED).get();
  if (links.empty) falha('failed-precondition', 'A confederação ainda não tem federações filiadas.');
  const batch = ctx.db.batch();
  let criadas = 0;
  let existentes = 0;
  for (const l of links.docs) {
    const link = l.data();
    const ref = ctx.db.collection(DUES).doc(P.nationalDuesId(c.fed.id, link.federation_id, year));
    // eslint-disable-next-line no-await-in-loop
    const [ja, est] = await Promise.all([ref.get(), ctx.db.collection(f.C.federations).doc(link.federation_id).get()]);
    if (ja.exists) { existentes += 1; continue; }
    const v = P.duesAmount(cfg, est.exists ? est.data().member_count : 0);
    batch.set(ref, {
      conf_id: c.fed.id, conf_name: c.fed.name || '', conf_acronym: c.fed.acronym || '',
      federation_id: link.federation_id, federation_name: link.federation_name || '', federation_acronym: link.federation_acronym || '',
      year, due: P.duesDueDate(cfg, year), status: P.DUES_STATUS.OPEN, ...v, paid_at: null, warned_for: '',
      issued_by: actor.uid, issued_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'issue'),
    });
    // eslint-disable-next-line no-await-in-loop
    await avisar(ctx, batch, link.federation_id, ['finance', 'admin'], { title: tx('Anuidade {ano} da {conf}', { ano: year, conf: sigla(c.fed) }), message: tx('{valor}, com vencimento em {data}. Pague e declare o pagamento em Confederação → Anuidades.', { valor: reais(v.amount_cents), data: P.duesDueDate(cfg, year).split('-').reverse().join('/') }), link: linkGestao(link.federation_id, 'confederacao-anuidades') });
    criadas += 1;
  }
  if (criadas) await batch.commit();
  await f.auditoria(ctx, actor, 'federation_dues_issue', { federation_id: c.fed.id, year, created: criadas, existing: existentes });
  return { ok: true, created: criadas, existing: existentes };
}

async function duesDoc(ctx, id) {
  const ref = ctx.db.collection(DUES).doc(texto(id, 200));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Anuidade não encontrada.');
  return { ref, d: { id: snap.id, ...snap.data() } };
}

async function duesAct(ctx, actor, data, c, action) {
  exigeFinanceiro(c);
  const { ref, d } = await duesDoc(ctx, data.duesId);
  const lado = action === 'declare' ? 'federation_id' : 'conf_id';
  if (d[lado] !== c.fed.id) falha('not-found', 'Anuidade não encontrada.');
  const r = P.duesTransition(d, action);
  if (r.error) falha('failed-precondition', r.error);
  const reason = P.duesNeedsReason(action) ? exigeMotivo(data) : '';
  const patch = { status: r.status, updated_at_ms: ctx.now };
  if (action === 'declare') Object.assign(patch, { declared_by: actor.uid, declared_at_ms: ctx.now, declared_note: texto(data.note, 300) });
  if (action === 'confirm') {
    const quando = /^\d{4}-\d{2}-\d{2}$/.test(String(data.date || '')) ? data.date : c.hoje;
    if (quando > c.hoje) falha('invalid-argument', 'A data não pode ser no futuro.');
    await exigePeriodoAberto(ctx, d.conf_id, quando);
    await exigePeriodoAberto(ctx, d.federation_id, quando);
    Object.assign(patch, { paid_at: quando, confirmed_by: actor.uid, confirmed_at_ms: ctx.now });
  }
  if (action === 'reopen' || action === 'waive') {
    if (d.status === P.DUES_STATUS.PAID && d.paid_at) {
      await exigePeriodoAberto(ctx, d.conf_id, d.paid_at);
      await exigePeriodoAberto(ctx, d.federation_id, d.paid_at);
    }
    Object.assign(patch, { paid_at: null, reason });
  }
  patch.history = historico(d, actor, ctx, action, reason ? { reason } : {});
  const batch = ctx.db.batch();
  batch.update(ref, patch);
  const ano = d.year;
  if (action === 'declare') {
    await avisar(ctx, batch, d.conf_id, ['finance', 'admin'], { title: tx('{fed} declarou o pagamento da anuidade {ano}', { fed: d.federation_acronym || d.federation_name, ano }), message: tx('Confira o recebimento de {valor} e confirme em Rede nacional → Anuidades.', { valor: reais(d.amount_cents) }), link: linkGestao(d.conf_id, 'rede-anuidades') });
  } else {
    const msg = {
      confirm: [tx('Anuidade {ano} confirmada', { ano }), tx('A {conf} confirmou o recebimento de {valor}.', { conf: d.conf_acronym || d.conf_name, valor: reais(d.amount_cents) })],
      reopen: [tx('Anuidade {ano} reaberta', { ano }), tx('Motivo: {motivo}.', { motivo: reason })],
      waive: [tx('Anuidade {ano} dispensada', { ano }), tx('A {conf} dispensou a anuidade. Motivo: {motivo}.', { conf: d.conf_acronym || d.conf_name, motivo: reason })],
    }[action];
    await avisar(ctx, batch, d.federation_id, ['finance', 'admin'], { title: msg[0], message: msg[1], link: linkGestao(d.federation_id, 'confederacao-anuidades') });
  }
  await batch.commit();
  await f.auditoria(ctx, actor, `federation_dues_${action}`, { federation_id: c.fed.id, dues_id: d.id, amount_cents: d.amount_cents, reason });
  return { ok: true, status: r.status };
}

/* ============================================================== callable == */

const ACOES = {
  link_request: (ctx, a, d, c) => linkOpen(ctx, a, d, c, 'request'),
  link_invite: (ctx, a, d, c) => { exigeConf(c); return linkOpen(ctx, a, d, c, 'invite'); },
  link_accept: (ctx, a, d, c) => linkDecide(ctx, a, d, c, 'accept'),
  link_reject: (ctx, a, d, c) => linkDecide(ctx, a, d, c, 'reject'),
  link_cancel: (ctx, a, d, c) => linkDecide(ctx, a, d, c, 'cancel'),
  link_leave: (ctx, a, d, c) => linkDecide(ctx, a, d, c, 'leave'),
  link_remove: (ctx, a, d, c) => linkDecide(ctx, a, d, c, 'remove'),
  config_save: configSave,
  dues_issue: duesIssue,
  dues_declare: (ctx, a, d, c) => duesAct(ctx, a, d, c, 'declare'),
  dues_confirm: (ctx, a, d, c) => { exigeConf(c); return duesAct(ctx, a, d, c, 'confirm'); },
  dues_reopen: (ctx, a, d, c) => { exigeConf(c); return duesAct(ctx, a, d, c, 'reopen'); },
  dues_waive: (ctx, a, d, c) => { exigeConf(c); return duesAct(ctx, a, d, c, 'waive'); },
};

async function national(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao(ctx, actor, data, await contexto(ctx, actor, data));
}

/* ======================================================= ranking nacional == */

/**
 * Soma a temporada NACIONAL de uma confederação: os lançamentos das filiadas
 * aprovadas agora e os da própria confederação, com as regras do ranking
 * dela. Grava `federation_rankings/{conf}_nacional_{ano}`. Ano fechado não
 * muda (`null`).
 */
async function recomputeNational(ctx, confId, season) {
  const R = require('./federationRanking.js');
  const agora = Number(ctx.now) || Date.now();
  if (!confId || !Number.isInteger(Number(season)) || R.seasonClosed(Number(season), agora)) return null;
  const confSnap = await ctx.db.collection(f.C.federations).doc(confId).get();
  const conf = confSnap.exists ? { id: confSnap.id, ...confSnap.data() } : null;
  if (!conf || !P.isConfederation(conf)) return null;
  const links = await ctx.db.collection(LINKS).where('conf_id', '==', confId).where('status', '==', P.LINK_STATUS.APPROVED).get();
  const feds = [{ id: confId, acronym: conf.acronym || '', name: conf.name || '' }, ...links.docs.map((d) => ({ id: d.data().federation_id, acronym: d.data().federation_acronym || '', name: d.data().federation_name || '' }))];
  const entries = [];
  for (const x of feds) {
    // eslint-disable-next-line no-await-in-loop
    const s = await ctx.db.collection('federation_points').where('federation_id', '==', x.id).where('season', '==', Number(season)).get();
    s.docs.forEach((d) => entries.push({ id: d.id, ...d.data() }));
  }
  const calc = R.aggregateSeason({ entries, config: conf.ranking_config || {}, season: Number(season) });
  const ref = ctx.db.collection('federation_rankings').doc(P.nationalRankingDocId(confId, season));
  if (!entries.length && !(await ref.get()).exists) return calc;
  await ref.set({ ...R.rankingDocument(confId, calc, agora), scope: 'national', federations: feds });
  if (ctx.logger) ctx.logger.info('federationNational: ranking nacional somado', { confId, season, federacoes: feds.length, lancamentos: calc.entries_count });
  return calc;
}

/** Os anos abertos de novo — depois de uma estadual entrar ou sair. Falha aqui não desfaz o vínculo. */
async function refazerNacional(ctx, confId) {
  const R = require('./federationRanking.js');
  for (const season of R.openSeasons(Number(ctx.now) || Date.now())) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await recomputeNational(ctx, confId, season);
    } catch (e) {
      if (ctx.logger) ctx.logger.warn('federationNational: ranking nacional não refeito', { confId, season, erro: String(e && e.message) });
    }
  }
}

/** Ponto de junção com `recomputeSeason`: a federação que somou o ano leva junto o nacional da confederação dela. */
async function afterSeason(ctx, fed, fedId, season) {
  const confId = P.isConfederation(fed) ? fedId : (P.nationalBodyOf(fed) || {}).id;
  if (!confId) return;
  try {
    await recomputeNational(ctx, confId, season);
  } catch (e) {
    if (ctx.logger) ctx.logger.warn('federationNational: ranking nacional não refeito', { confId, season, erro: String(e && e.message) });
  }
}

/* ============================================================== contas == */

/** As anuidades PAGAS nas contas: receita da confederação, despesa da estadual. */
async function contas(ctx, fed) {
  const [comoConf, comoFed] = await Promise.all([
    P.isConfederation(fed) ? ctx.db.collection(DUES).where('conf_id', '==', fed.id).get() : null,
    ctx.db.collection(DUES).where('federation_id', '==', fed.id).get(),
  ]);
  const lerDocs = (s) => (s ? s.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
  return { receitas: P.duesIncome(lerDocs(comoConf)), despesas: P.duesExpenses(lerDocs(comoFed)) };
}

/* ============================================================= varredura == */

/** A anuidade vencida sem pagamento avisa o financeiro da estadual UMA vez por vencimento. */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const abertas = await ctx.db.collection(DUES).where('status', '==', P.DUES_STATUS.OPEN).get();
  let avisos = 0;
  for (const s of abertas.docs) {
    const d = { id: s.id, ...s.data() };
    if (!P.duesToWarn(d, hoje)) continue;
    const batch = ctx.db.batch();
    // eslint-disable-next-line no-await-in-loop
    await avisar(ctx, batch, d.federation_id, ['finance', 'admin'], { title: tx('Anuidade {ano} da {conf} vencida', { ano: d.year, conf: d.conf_acronym || d.conf_name }), message: tx('{valor} venceu em {data}. Pague e declare o pagamento em Confederação → Anuidades.', { valor: reais(d.amount_cents), data: String(d.due).split('-').reverse().join('/') }), link: linkGestao(d.federation_id, 'confederacao-anuidades') });
    batch.update(s.ref, { warned_for: d.due });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
    avisos += 1;
  }
  if (ctx.logger && avisos) ctx.logger.info('Federações: anuidades vencidas avisadas.', { avisos });
  return { notices: avisos };
}

module.exports = { national, sweep, recomputeNational, afterSeason, contas, LINKS, DUES };
