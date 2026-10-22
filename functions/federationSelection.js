/**
 * SELEÇÃO E APOIO AO ATLETA no servidor (Bloco 3, `docs/50` §32). Só o
 * servidor grava as quatro coleções (a regra é `write: if false`):
 *
 *  - `federation_callups`: a convocação da seleção ou delegação (módulo
 *    `selection`, equipe `competitions`/`admin`). Pelo ranking oficial do ano
 *    (a mesma escolha da final do circuito) ou a dedo. Publicar convida;
 *    recusar, vencer o prazo (varredura) ou ser cancelado chama o próximo do
 *    ranking, até o evento começar. Documentos de viagem (a comissão confere),
 *    tamanho do uniforme (o convocado escolhe) e custos (o financeiro marca o
 *    pago — entram nas contas como despesa derivada).
 *  - `federation_callup_members`: o convite de cada atleta. A lista pública da
 *    delegação (`roster` na convocação) leva só nome e categoria, com uma
 *    chave opaca no lugar do id.
 *  - `federation_grants`: o edital de apoio ao atleta (módulo `grants`):
 *    publicado (e no acervo, com o módulo ligado), inscrições até o prazo,
 *    análise, resultado com prazo de recurso, encerramento, pagamento.
 *  - `federation_grant_applications`: a inscrição, com os arquivos na pasta de
 *    quem se inscreve (`federacao/{uid}/`); a equipe os abre pelo
 *    `federationDocument` (`applicationId`), com registro.
 *
 * A conta pura é `federationSelectionPolicy.js` (cópia de
 * `src/modules/federations/domain/selection.js`, com paridade).
 */
const crypto = require('node:crypto');
const P = require('./federationSelectionPolicy.js');
const CP = require('./federationCompetitionsPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { publicarAtoDeTexto } = require('./federationAcervo.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const CALLUPS = 'federation_callups';
const MEMBERS = 'federation_callup_members';
const GRANTS = 'federation_grants';
const APPS = 'federation_grant_applications';
const DIA = 86400000;
const LOTE = 400;
const SISTEMA = { uid: 'system', name: 'Servidor' };
const LINK_MEU = '/perfil?secao=federacoes';
const linkGestao = (fedId, aba) => `/federacoes/${fedId}/gerir?aba=${aba}`;
const linkPublico = (fedId, ancora) => `/federacoes/${fedId}?aba=competicoes&ancora=${ancora}`;
const sigla = (fed) => fed.acronym || fed.name || '';
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const reais = (c) => `R$ ${(Math.trunc(Number(c) || 0) / 100).toFixed(2).replace('.', ',')}`;
const nomeDe = (u) => texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 120);
/** A chave da linha na lista PÚBLICA da delegação: opaca (o id do convite leva o uid). */
const rosterKey = (memberId) => crypto.createHash('sha256').update(String(memberId)).digest('hex').slice(0, 12);
const ST = P.CALLUP_STATUS;
const IS = P.CALLUP_MEMBER_STATUS;
const GS = P.GRANT_STATUS;
const AS = P.APPLICATION_STATUS;

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', `Confira os campos: ${Object.keys(r.errors).join(', ')}.`);
  return r.value;
}

function exigeMotivo(data, min = 3) {
  const motivo = texto(data.reason, 300);
  if (motivo.length < min) falha('invalid-argument', 'Diga o motivo.');
  return motivo;
}

async function contexto(ctx, actor, data, modulo) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules[modulo] === true)) falha('failed-precondition', modulo === 'selection' ? 'Esta federação não tem o módulo de seleção e delegações ligado.' : 'Esta federação não tem o módulo de editais ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now), equipe: perms.includes('competitions') || perms.includes('admin'), financeiro: perms.includes('finance') || perms.includes('admin') };
}

const exigeEquipe = (c, oQue) => { if (!c.equipe) falha('permission-denied', `Só a equipe de competições ${oQue}.`); };

async function avisarLote(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < lista.length; i += LOTE) {
    const batch = ctx.db.batch();
    lista.slice(i, i + LOTE).forEach((uid) => f.aviso(ctx, batch, uid, msg));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  return lista.length;
}

/* ============================================================ convocação == */

async function convocacao(ctx, c, callupId) {
  const ref = ctx.db.collection(CALLUPS).doc(texto(callupId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Convocação não encontrada.');
  return { ref, cu: { id: snap.id, ...snap.data() } };
}

async function convitesDa(ctx, callupId) {
  const snap = await ctx.db.collection(MEMBERS).where('callup_id', '==', callupId).get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

/** Refaz a lista pública da delegação (só os confirmados, sem uid) e as contagens. */
async function refazerLista(ctx, callupId) {
  const membros = await convitesDa(ctx, callupId);
  const roster = membros.filter((x) => x.status === IS.ACCEPTED)
    .sort((a, b) => String(a.category_key).localeCompare(String(b.category_key)) || (a.position || 9999) - (b.position || 9999) || String(a.user_name).localeCompare(String(b.user_name)))
    .map((x) => ({ key: rosterKey(x.id), name: texto(x.user_name, 120), category_key: x.category_key, gender_category: x.gender_category || 'open', age_category: x.age_category || 'open', format: x.format || 'doubles', label: texto(x.label, 60) }));
  await ctx.db.collection(CALLUPS).doc(callupId).update({ roster, counts: P.callupCounts(membros), updated_at_ms: ctx.now });
  return roster;
}

function novoConvite(ctx, fed, cu, n, actor) {
  return {
    ...n, label: texto(n.label, 60), federation_id: fed.id, federation_acronym: fed.acronym || '', callup_id: cu.id, callup_title: cu.title, event_name: cu.event_name,
    starts_at: cu.starts_at || '', status: IS.INVITED, expires_at_ms: ctx.now + (cu.accept_days || 7) * DIA, invited_by: actor.uid,
    uniform_size: '', docs_ok: {}, staff_note: '', created_at_ms: ctx.now, updated_at_ms: ctx.now,
  };
}

function avisoDoConvite(ctx, batch, fed, cu, doc) {
  f.aviso(ctx, batch, doc.user_id, {
    title: tx('Convocação: {titulo}', { titulo: cu.title }),
    message: doc.substitute
      ? tx('Abriu uma vaga e você foi chamado pelo ranking da {sigla} para {evento}. Responda até {data} em Minha área → Federações.', { sigla: sigla(fed), evento: cu.event_name, data: br(m.isoDateBR(doc.expires_at_ms)) })
      : tx('A {sigla} convocou você para {evento}. Responda até {data} em Minha área → Federações.', { sigla: sigla(fed), evento: cu.event_name, data: br(m.isoDateBR(doc.expires_at_ms)) }),
    link: LINK_MEU,
  });
}

/** Pelo ranking: cria os convites que faltam (e os suplentes). Devolve quantos. */
async function convidarPeloRanking(ctx, fed, cu, actor) {
  if (cu.criterion !== P.CALLUP_CRITERIA.RANKING || !cu.season) return 0;
  const [rank, existentes] = await Promise.all([ctx.db.collection('federation_rankings').doc(`${fed.id}_${cu.season}`).get(), convitesDa(ctx, cu.id)]);
  const novos = P.callupInvitesToSend(rank.exists ? rank.data().categories || [] : [], existentes, cu);
  if (!novos.length) return 0;
  const batch = ctx.db.batch();
  novos.forEach((n) => {
    const doc = novoConvite(ctx, fed, cu, n, actor);
    batch.set(ctx.db.collection(MEMBERS).doc(CP.finalInviteDocId(cu.id, n.category_key, n.user_id)), doc);
    avisoDoConvite(ctx, batch, fed, cu, doc);
  });
  await batch.commit();
  return novos.length;
}

/** Uma vaga abriu: o próximo do ranking, se a convocação está aberta e o evento não começou. */
async function chamarSuplentes(ctx, fed, callupId, actor) {
  const snap = await ctx.db.collection(CALLUPS).doc(callupId).get();
  if (!snap.exists) return 0;
  const cu = { id: snap.id, ...snap.data() };
  if (cu.status !== ST.OPEN || (cu.starts_at && m.isoDateBR(ctx.now) >= cu.starts_at)) return 0;
  return convidarPeloRanking(ctx, fed, cu, actor);
}

async function callupSave(ctx, actor, data, c) {
  exigeEquipe(c, 'monta a convocação');
  const v = exigeValido(P.validateCallup(data));
  if (!data.callupId) {
    const ref = ctx.db.collection(CALLUPS).doc();
    await ref.set({ federation_id: c.fed.id, ...v, status: ST.DRAFT, costs: [], roster: [], counts: P.callupCounts([]), created_by: actor.uid, created_by_name: texto(actor.name, 120), created_at_ms: ctx.now, updated_at_ms: ctx.now });
    await f.auditoria(ctx, actor, 'federation_callup_create', { federation_id: c.fed.id, callup_id: ref.id });
    return { ok: true, callupId: ref.id };
  }
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status === ST.CANCELLED) falha('failed-precondition', 'Esta convocação foi cancelada.');
  // Publicada, o critério (ranking, ano, categorias, vagas) fica como foi anunciado; a logística segue editável.
  const patch = cu.status === ST.DRAFT ? v : {
    title: v.title, event_name: v.event_name, place: v.place, starts_at: v.starts_at, ends_at: v.ends_at, accept_days: v.accept_days,
    travel_docs: v.travel_docs, collect_uniform: v.collect_uniform, notes: v.notes,
  };
  await ref.update({ ...patch, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_callup_update', { federation_id: c.fed.id, callup_id: cu.id });
  return { ok: true, callupId: cu.id };
}

async function callupCosts(ctx, actor, data, c) {
  if (!c.equipe && !c.financeiro) falha('permission-denied', 'Só a equipe de competições ou o financeiro cuidam dos custos.');
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  const costs = P.normalizeCallupCosts(data.costs).filter((x) => x.label);
  // Quem não é do financeiro não marca nem desmarca pagamento: o "pago" vira despesa nas contas.
  if (!c.financeiro) {
    const antes = new Map(P.normalizeCallupCosts(cu.costs).map((x) => [x.id, x]));
    costs.forEach((x) => { x.paid_at = (antes.get(x.id) || {}).paid_at || ''; });
  }
  await ref.update({ costs, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_callup_costs', { federation_id: c.fed.id, callup_id: cu.id, ...P.callupCostsTotal(costs) });
  return { ok: true, ...P.callupCostsTotal(costs) };
}

async function callupPublish(ctx, actor, data, c) {
  exigeEquipe(c, 'publica a convocação');
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status !== ST.DRAFT) falha('failed-precondition', 'Esta convocação já foi publicada.');
  exigeValido(P.validateCallup(cu));
  if (cu.starts_at && cu.starts_at < c.hoje) falha('failed-precondition', 'O evento já começou: ajuste a data.');
  await ref.update({ status: ST.OPEN, published_at_ms: ctx.now, published_by: actor.uid, updated_at_ms: ctx.now });
  const convidados = await convidarPeloRanking(ctx, c.fed, { ...cu, status: ST.OPEN }, actor);
  await refazerLista(ctx, cu.id);
  await f.auditoria(ctx, actor, 'federation_callup_publish', { federation_id: c.fed.id, callup_id: cu.id, invited: convidados });
  return { ok: true, invited: convidados };
}

async function callupAdd(ctx, actor, data, c) {
  exigeEquipe(c, 'convoca');
  const { cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status !== ST.OPEN) falha('failed-precondition', 'Publique a convocação antes de convocar.');
  const uid = texto(data.userId, 128);
  const perfil = uid ? await ctx.db.collection('users').doc(uid).get() : null;
  if (!perfil || !perfil.exists) falha('not-found', 'Pessoa não encontrada na plataforma.');
  const ref = ctx.db.collection(MEMBERS).doc(CP.finalInviteDocId(cu.id, P.MANUAL_CATEGORY, uid));
  const ja = await ref.get();
  if (ja.exists && [IS.INVITED, IS.ACCEPTED].includes(ja.data().status)) falha('already-exists', 'Esta pessoa já está convocada.');
  const doc = novoConvite(ctx, c.fed, cu, {
    category_key: P.MANUAL_CATEGORY, gender_category: 'open', age_category: 'open', format: 'doubles', user_id: uid, user_name: nomeDe(perfil.data()),
    position: null, points: 0, substitute: false, label: texto(data.label, 60),
  }, actor);
  const batch = ctx.db.batch();
  batch.set(ref, doc);
  avisoDoConvite(ctx, batch, c.fed, cu, doc);
  await batch.commit();
  await refazerLista(ctx, cu.id);
  await f.auditoria(ctx, actor, 'federation_callup_add', { federation_id: c.fed.id, callup_id: cu.id, user_id: uid });
  return { ok: true, memberId: ref.id };
}

async function conviteDe(ctx, c, memberId) {
  const ref = ctx.db.collection(MEMBERS).doc(texto(memberId, 240));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Convite não encontrado.');
  return { ref, inv: { id: snap.id, ...snap.data() } };
}

async function callupAnswer(ctx, actor, data, c) {
  const { ref, inv } = await conviteDe(ctx, c, data.memberId);
  if (inv.user_id !== actor.uid) falha('permission-denied', 'Este convite não é seu.');
  if (inv.status !== IS.INVITED) falha('failed-precondition', 'Este convite já foi respondido.');
  if (Number(inv.expires_at_ms) <= ctx.now) falha('failed-precondition', 'O prazo para responder venceu.');
  const { cu } = await convocacao(ctx, c, inv.callup_id);
  if (cu.status !== ST.OPEN) falha('failed-precondition', 'Esta convocação não está mais aberta.');
  const aceitou = data.accept === true;
  const patch = { status: aceitou ? IS.ACCEPTED : IS.DECLINED, answered_at_ms: ctx.now, updated_at_ms: ctx.now };
  if (aceitou && cu.collect_uniform && P.UNIFORM_SIZES.includes(data.uniform_size)) patch.uniform_size = data.uniform_size;
  await ref.update(patch);
  await f.auditoria(ctx, actor, aceitou ? 'federation_callup_accept' : 'federation_callup_decline', { federation_id: c.fed.id, callup_id: cu.id });
  const chamados = aceitou ? 0 : await chamarSuplentes(ctx, c.fed, cu.id, SISTEMA);
  await refazerLista(ctx, cu.id);
  return { ok: true, substitutes: chamados };
}

async function callupMemberUpdate(ctx, actor, data, c) {
  const { ref, inv } = await conviteDe(ctx, c, data.memberId);
  const { cu } = await convocacao(ctx, c, inv.callup_id);
  if (cu.status === ST.CANCELLED) falha('failed-precondition', 'Esta convocação foi cancelada.');
  const patch = { updated_at_ms: ctx.now };
  if (inv.user_id === actor.uid && data.uniform_size !== undefined) {
    if (!cu.collect_uniform) falha('failed-precondition', 'Esta convocação não pede o tamanho do uniforme.');
    if (!P.UNIFORM_SIZES.includes(data.uniform_size)) falha('invalid-argument', 'Escolha um tamanho da lista.');
    if (inv.status !== IS.ACCEPTED) falha('failed-precondition', 'Confirme a convocação antes.');
    patch.uniform_size = data.uniform_size;
  }
  if (data.docs_ok !== undefined || data.staff_note !== undefined) {
    exigeEquipe(c, 'confere os documentos');
    if (data.docs_ok !== undefined) patch.docs_ok = Object.fromEntries(P.TRAVEL_DOCS.filter((k) => (cu.travel_docs || []).includes(k)).map((k) => [k, (data.docs_ok || {})[k] === true]));
    if (data.staff_note !== undefined) patch.staff_note = texto(data.staff_note, 300);
  }
  if (Object.keys(patch).length === 1) falha('permission-denied', 'Nada para mudar aqui.');
  await ref.update(patch);
  return { ok: true };
}

async function callupCancelMember(ctx, actor, data, c) {
  exigeEquipe(c, 'cancela convocado');
  const { ref, inv } = await conviteDe(ctx, c, data.memberId);
  if (![IS.INVITED, IS.ACCEPTED].includes(inv.status)) falha('failed-precondition', 'Este convite já está fechado.');
  const motivo = exigeMotivo(data);
  const batch = ctx.db.batch();
  batch.update(ref, { status: IS.CANCELLED, cancel_reason: motivo, cancelled_by: actor.uid, updated_at_ms: ctx.now });
  f.aviso(ctx, batch, inv.user_id, { title: tx('Convocação cancelada: {titulo}', { titulo: inv.callup_title }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_MEU });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_callup_cancel_member', { federation_id: c.fed.id, callup_id: inv.callup_id, user_id: inv.user_id, reason: motivo });
  const chamados = await chamarSuplentes(ctx, c.fed, inv.callup_id, actor);
  await refazerLista(ctx, inv.callup_id);
  return { ok: true, substitutes: chamados };
}

/** Fecha (delegação definida) ou cancela: quem ainda esperava resposta é avisado. */
async function encerrar(ctx, actor, data, c, cancelar) {
  exigeEquipe(c, cancelar ? 'cancela a convocação' : 'fecha a delegação');
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  if (cancelar && cu.status === ST.DRAFT) {
    await ref.delete();
    await f.auditoria(ctx, actor, 'federation_callup_delete', { federation_id: c.fed.id, callup_id: cu.id });
    return { ok: true, deleted: true };
  }
  if (cu.status !== ST.OPEN && !(cancelar && cu.status === ST.CLOSED)) falha('failed-precondition', 'Esta convocação não está aberta.');
  const motivo = cancelar ? exigeMotivo(data) : 'Delegação fechada.';
  const membros = await convitesDa(ctx, cu.id);
  const batch = ctx.db.batch();
  batch.update(ref, { status: cancelar ? ST.CANCELLED : ST.CLOSED, ...(cancelar ? { cancel_reason: motivo, cancelled_at_ms: ctx.now } : { closed_at_ms: ctx.now }), updated_at_ms: ctx.now });
  membros.forEach((x) => {
    if (x.status === IS.INVITED || (cancelar && x.status === IS.ACCEPTED)) {
      batch.update(x.ref, { status: IS.CANCELLED, cancel_reason: motivo, cancelled_by: actor.uid, updated_at_ms: ctx.now });
      f.aviso(ctx, batch, x.user_id, { title: tx('Convocação encerrada: {titulo}', { titulo: cu.title }), message: cancelar ? tx('Motivo: {motivo}', { motivo }) : tx('A delegação foi fechada antes da sua resposta.'), link: LINK_MEU });
    } else if (!cancelar && x.status === IS.ACCEPTED) {
      f.aviso(ctx, batch, x.user_id, { title: tx('Delegação fechada: {titulo}', { titulo: cu.title }), message: tx('Você está na delegação para {evento}. Confira os documentos de viagem em Minha área → Federações.', { evento: cu.event_name }), link: LINK_MEU });
    }
  });
  await batch.commit();
  await refazerLista(ctx, cu.id);
  await f.auditoria(ctx, actor, cancelar ? 'federation_callup_cancel' : 'federation_callup_close', { federation_id: c.fed.id, callup_id: cu.id, reason: cancelar ? motivo : null });
  return { ok: true };
}

/* =============================================================== editais == */

async function edital(ctx, c, grantId) {
  const ref = ctx.db.collection(GRANTS).doc(texto(grantId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Edital não encontrado.');
  return { ref, g: { id: snap.id, ...snap.data() } };
}

async function inscricoesDo(ctx, grantId) {
  const snap = await ctx.db.collection(APPS).where('grant_id', '==', grantId).get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

async function inscricao(ctx, c, appId) {
  const ref = ctx.db.collection(APPS).doc(texto(appId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Inscrição não encontrada.');
  return { ref, app: { id: snap.id, ...snap.data() } };
}

const historico = (g, actor, ctx, action, extra = {}) => [...(g.history || []), { action, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now, ...extra }].slice(-50);

async function grantSave(ctx, actor, data, c) {
  exigeEquipe(c, 'monta o edital');
  if (!data.grantId) {
    const v = exigeValido(P.validateGrant(data));
    const ref = ctx.db.collection(GRANTS).doc();
    await ref.set({ federation_id: c.fed.id, ...v, status: GS.DRAFT, result: [], payments: [], history: [], created_by: actor.uid, created_at_ms: ctx.now, updated_at_ms: ctx.now });
    await f.auditoria(ctx, actor, 'federation_grant_create', { federation_id: c.fed.id, grant_id: ref.id });
    return { ok: true, grantId: ref.id };
  }
  const { ref, g } = await edital(ctx, c, data.grantId);
  if (g.status === GS.DRAFT) {
    const v = exigeValido(P.validateGrant(data));
    await ref.update({ ...v, updated_at_ms: ctx.now });
  } else if (g.status === GS.OPEN) {
    // Publicado, só o prazo de inscrição pode crescer (com motivo, no histórico): mudar as regras no meio prejudica quem já se inscreveu.
    const novo = P.normalizeGrant({ ...g, closes_at: data.closes_at }).closes_at;
    if (!novo || novo <= g.closes_at) falha('failed-precondition', 'Com o edital publicado, só dá para prorrogar o prazo de inscrição.');
    const motivo = exigeMotivo(data);
    await ref.update({ closes_at: novo, history: historico(g, actor, ctx, 'extend', { from: g.closes_at, to: novo, reason: motivo }), updated_at_ms: ctx.now });
  } else falha('failed-precondition', 'Este edital não pode mais ser editado.');
  await f.auditoria(ctx, actor, 'federation_grant_update', { federation_id: c.fed.id, grant_id: g.id });
  return { ok: true, grantId: g.id };
}

async function grantPublish(ctx, actor, data, c) {
  exigeEquipe(c, 'publica o edital');
  const { ref, g } = await edital(ctx, c, data.grantId);
  if (g.status !== GS.DRAFT) falha('failed-precondition', 'Este edital já foi publicado.');
  const v = exigeValido(P.validateGrant({ ...g, opens_at: g.opens_at || c.hoje }));
  if (v.closes_at < c.hoje) falha('failed-precondition', 'O prazo de inscrição já passou: ajuste a data.');
  let ato = null;
  if (c.fed.modules && c.fed.modules.official_docs === true) {
    ato = await publicarAtoDeTexto(ctx, actor, c.fed, { type: 'notice', title: `Edital: ${v.title}`.slice(0, 120), summary: 'Edital de apoio ao atleta', body: P.grantNoticeText(c.fed, v), act_date: c.hoje, visibility: 'public', tags: ['editais'], origin: 'grants' });
  }
  await ref.update({ ...v, status: GS.OPEN, notice_doc_id: ato ? ato.docId : null, notice_code: ato ? ato.code : '', published_at_ms: ctx.now, published_by: actor.uid, history: historico(g, actor, ctx, 'publish'), updated_at_ms: ctx.now });
  const membros = await ctx.db.collection(f.C.members).where('federation_id', '==', c.fed.id).where('status', '==', 'active').get();
  const avisados = await avisarLote(ctx, membros.docs.map((d) => d.data().user_id || d.data().guardian_uid), {
    title: tx('Edital aberto: {titulo}', { titulo: v.title }), message: tx('Inscrições até {data} pelo aplicativo, na página da {sigla}.', { data: br(v.closes_at), sigla: sigla(c.fed) }), link: linkPublico(c.fed.id, 'fed-editais'),
  });
  await f.auditoria(ctx, actor, 'federation_grant_publish', { federation_id: c.fed.id, grant_id: g.id, notified: avisados, notice_code: ato ? ato.code : null });
  return { ok: true, notified: avisados, noticeCode: ato ? ato.code : null };
}

async function grantApply(ctx, actor, data, c) {
  const { g } = await edital(ctx, c, data.grantId);
  if (!P.grantAcceptsApplications(g, c.hoje)) falha('failed-precondition', 'As inscrições deste edital não estão abertas.');
  const ms = await ctx.db.collection(f.C.members).doc(`${c.fed.id}_${actor.uid}`).get();
  const filiado = ms.exists && m.membershipState(ms.data(), c.hoje, ctx.now).status === 'active';
  if (g.members_only && !filiado) falha('failed-precondition', 'Este edital é só para filiados em dia nesta federação.');
  const v = exigeValido(P.validateApplication(g, data, actor.uid));
  const ja = (await ctx.db.collection(APPS).where('grant_id', '==', g.id).where('user_id', '==', actor.uid).get()).docs[0];
  if (ja && ![AS.SUBMITTED, AS.WITHDRAWN].includes(ja.data().status)) falha('failed-precondition', 'Sua inscrição já foi analisada.');
  const perfil = await ctx.db.collection('users').doc(actor.uid).get();
  const base = {
    federation_id: c.fed.id, grant_id: g.id, grant_title: g.title, user_id: actor.uid, user_name: nomeDe(perfil.exists ? perfil.data() : {}),
    member_id: filiado ? ms.id : null, text: v.text, files: v.files, status: AS.SUBMITTED, submitted_at_ms: ctx.now, updated_at_ms: ctx.now,
  };
  const ref = ja ? ja.ref : ctx.db.collection(APPS).doc();
  if (ja) await ref.update(base);
  else await ref.set({ ...base, decision: null, appeal: null, payment: null, created_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_grant_apply', { federation_id: c.fed.id, grant_id: g.id, application_id: ref.id, files: Object.keys(v.files).length });
  return { ok: true, applicationId: ref.id };
}

async function grantWithdraw(ctx, actor, data, c) {
  const { ref, app } = await inscricao(ctx, c, data.applicationId);
  if (app.user_id !== actor.uid) falha('permission-denied', 'Esta inscrição não é sua.');
  if (app.status !== AS.SUBMITTED) falha('failed-precondition', 'Sua inscrição já foi analisada.');
  const { g } = await edital(ctx, c, app.grant_id);
  if (g.status !== GS.OPEN) falha('failed-precondition', 'As inscrições já fecharam.');
  await ref.update({ status: AS.WITHDRAWN, withdrawn_at_ms: ctx.now, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_grant_withdraw', { federation_id: c.fed.id, grant_id: g.id, application_id: app.id });
  return { ok: true };
}

async function grantDecide(ctx, actor, data, c) {
  exigeEquipe(c, 'analisa as inscrições');
  const { ref, app } = await inscricao(ctx, c, data.applicationId);
  const { g } = await edital(ctx, c, app.grant_id);
  if (g.status !== GS.REVIEW) falha('failed-precondition', 'A análise começa quando as inscrições fecham.');
  if ([AS.WITHDRAWN].includes(app.status)) falha('failed-precondition', 'Esta pessoa desistiu.');
  const status = [AS.APPROVED, AS.WAITLISTED, AS.REJECTED].includes(data.decision) ? data.decision : null;
  if (!status) falha('invalid-argument', 'Escolha contemplado, lista de espera ou não contemplado.');
  const motivo = texto(data.reason, 500);
  if (status !== AS.APPROVED && motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  if (status === AS.APPROVED && app.status !== AS.APPROVED && P.grantSlotsLeft(g, await inscricoesDo(ctx, g.id)) <= 0) falha('failed-precondition', 'As vagas do edital já estão preenchidas.');
  const score = data.score === '' || data.score == null ? null : Math.min(100, Math.max(0, Math.trunc(Number(data.score) || 0)));
  await ref.update({ status, decision: { status, reason: motivo, score, by: actor.uid, by_name: texto(actor.name, 80), at_ms: ctx.now }, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_grant_decide', { federation_id: c.fed.id, grant_id: g.id, application_id: app.id, decision: status });
  return { ok: true };
}

async function publicarResultadoNoAcervo(ctx, actor, fed, g, result) {
  if (!(fed.modules && fed.modules.official_docs === true)) return null;
  const corpo = [`Resultado do edital ${g.title}${g.notice_code ? ` (${g.notice_code})` : ''}.`, '', 'Contemplados:', ...(result.length ? result.map((r) => `- ${r.name}`) : ['Nenhum contemplado.']), '', `Prazo de recurso: até ${br(g.appeal_until)}, pelo aplicativo.`].join('\n');
  return publicarAtoDeTexto(ctx, actor, fed, { type: 'official_note', title: `Resultado: ${g.title}`.slice(0, 120), summary: 'Resultado do edital de apoio ao atleta', body: corpo, act_date: m.isoDateBR(ctx.now), visibility: 'public', tags: ['editais'], origin: 'grants' });
}

async function grantResult(ctx, actor, data, c) {
  exigeEquipe(c, 'publica o resultado');
  const { ref, g } = await edital(ctx, c, data.grantId);
  if (g.status !== GS.REVIEW) falha('failed-precondition', 'O resultado sai depois do fim das inscrições.');
  const apps = await inscricoesDo(ctx, g.id);
  if (apps.some((a) => a.status === AS.SUBMITTED)) falha('failed-precondition', 'Ainda há inscrições sem decisão.');
  const result = P.grantPublicResult(apps);
  const appeal_until = P.appealUntil(c.hoje, g.appeal_days);
  const ato = await publicarResultadoNoAcervo(ctx, actor, c.fed, { ...g, appeal_until }, result);
  await ref.update({ status: GS.RESULT, result, appeal_until, result_at_ms: ctx.now, result_doc_id: ato ? ato.docId : null, result_code: ato ? ato.code : '', history: historico(g, actor, ctx, 'result'), updated_at_ms: ctx.now });
  const batch = ctx.db.batch();
  apps.filter((a) => a.status !== AS.WITHDRAWN).forEach((a) => f.aviso(ctx, batch, a.user_id, {
    title: tx('Resultado do edital {titulo}', { titulo: g.title }),
    message: a.status === AS.APPROVED ? tx('Você foi contemplado.') : tx('Você não foi contemplado. Se quiser, entre com recurso até {data} em Minha área → Federações.', { data: br(appeal_until) }),
    link: LINK_MEU,
  }));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_grant_result', { federation_id: c.fed.id, grant_id: g.id, approved: result.length });
  return { ok: true, approved: result.length, appealUntil: appeal_until };
}

async function grantAppeal(ctx, actor, data, c) {
  const { ref, app } = await inscricao(ctx, c, data.applicationId);
  if (app.user_id !== actor.uid) falha('permission-denied', 'Esta inscrição não é sua.');
  const { g } = await edital(ctx, c, app.grant_id);
  if (!P.canAppeal(app, g, c.hoje)) falha('failed-precondition', 'O prazo de recurso não está aberto para esta inscrição.');
  const text = texto(data.text, 2000);
  if (text.length < 10) falha('invalid-argument', 'Explique o recurso (mínimo 10 caracteres).');
  await ref.update({ appeal: { status: P.APPEAL_STATUS.PENDING, text, at_ms: ctx.now }, updated_at_ms: ctx.now });
  const batch = ctx.db.batch();
  (await f.staffIds(ctx, c.fed.id, 'competitions')).forEach((uid) => f.aviso(ctx, batch, uid, { title: tx('Recurso no edital {titulo}', { titulo: g.title }), message: tx('{nome} entrou com recurso.', { nome: app.user_name }), link: linkGestao(c.fed.id, 'editais') }));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_grant_appeal', { federation_id: c.fed.id, grant_id: g.id, application_id: app.id });
  return { ok: true };
}

async function grantAppealDecide(ctx, actor, data, c) {
  exigeEquipe(c, 'julga o recurso');
  const { ref, app } = await inscricao(ctx, c, data.applicationId);
  const { ref: gRef, g } = await edital(ctx, c, app.grant_id);
  if (!app.appeal || app.appeal.status !== P.APPEAL_STATUS.PENDING) falha('failed-precondition', 'Não há recurso pendente nesta inscrição.');
  const motivo = exigeMotivo(data);
  const aceito = data.accept === true;
  const apps = await inscricoesDo(ctx, g.id);
  if (aceito && P.grantSlotsLeft(g, apps) <= 0) falha('failed-precondition', 'Não há vaga: para dar provimento, mude antes a decisão de outro contemplado.');
  await ref.update({
    ...(aceito ? { status: AS.APPROVED } : {}),
    appeal: { ...app.appeal, status: aceito ? P.APPEAL_STATUS.ACCEPTED : P.APPEAL_STATUS.REJECTED, reason: motivo, by: actor.uid, decided_at_ms: ctx.now }, updated_at_ms: ctx.now,
  });
  if (aceito) await gRef.update({ result: P.grantPublicResult(apps.map((a) => (a.id === app.id ? { ...a, status: AS.APPROVED } : a))), updated_at_ms: ctx.now });
  const batch = ctx.db.batch();
  f.aviso(ctx, batch, app.user_id, { title: tx('Recurso julgado: {titulo}', { titulo: g.title }), message: aceito ? tx('Recurso aceito: você foi contemplado.') : tx('Recurso negado. Motivo: {motivo}', { motivo }), link: LINK_MEU });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_grant_appeal_decide', { federation_id: c.fed.id, grant_id: g.id, application_id: app.id, accepted: aceito });
  return { ok: true };
}

async function grantFinalize(ctx, actor, data, c) {
  exigeEquipe(c, 'encerra o edital');
  const { ref, g } = await edital(ctx, c, data.grantId);
  if (!P.grantCanFinalize(g, await inscricoesDo(ctx, g.id), c.hoje)) falha('failed-precondition', 'Espere o fim do prazo de recurso e julgue os recursos pendentes.');
  await ref.update({ status: GS.FINAL, final_at_ms: ctx.now, history: historico(g, actor, ctx, 'final'), updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_grant_final', { federation_id: c.fed.id, grant_id: g.id });
  return { ok: true };
}

async function grantPay(ctx, actor, data, c) {
  if (!c.financeiro) falha('permission-denied', 'Só o financeiro registra o pagamento.');
  const { ref, app } = await inscricao(ctx, c, data.applicationId);
  const { ref: gRef, g } = await edital(ctx, c, app.grant_id);
  if (![GS.RESULT, GS.FINAL].includes(g.status) || app.status !== AS.APPROVED) falha('failed-precondition', 'Só se paga quem foi contemplado no resultado publicado.');
  const outros = (g.payments || []).filter((p) => p.application_id !== app.id);
  if (data.undo === true) {
    await ref.update({ payment: null, updated_at_ms: ctx.now });
    await gRef.update({ payments: outros, updated_at_ms: ctx.now });
    await f.auditoria(ctx, actor, 'federation_grant_pay_undo', { federation_id: c.fed.id, grant_id: g.id, application_id: app.id });
    return { ok: true };
  }
  const paid_at = /^\d{4}-\d{2}-\d{2}$/.test(String(data.paid_at || '')) ? data.paid_at : c.hoje;
  if (paid_at > c.hoje) falha('invalid-argument', 'A data do pagamento não pode ser no futuro.');
  const amount_cents = Math.trunc(Number(data.amount_cents == null || data.amount_cents === '' ? g.amount_cents : data.amount_cents) || 0);
  if (amount_cents <= 0 || amount_cents > 1e9) falha('invalid-argument', 'Informe o valor pago.');
  await ref.update({ payment: { paid_at, amount_cents, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now });
  await gRef.update({ payments: [...outros, { application_id: app.id, name: texto(app.user_name, 120), amount_cents, paid_at }], updated_at_ms: ctx.now });
  const batch = ctx.db.batch();
  f.aviso(ctx, batch, app.user_id, { title: tx('Pagamento do edital {titulo}', { titulo: g.title }), message: tx('A {sigla} registrou o pagamento de {valor} em {data}.', { sigla: sigla(c.fed), valor: reais(amount_cents), data: br(paid_at) }), link: LINK_MEU });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_grant_pay', { federation_id: c.fed.id, grant_id: g.id, application_id: app.id, amount_cents, paid_at });
  return { ok: true };
}

async function grantCancel(ctx, actor, data, c) {
  exigeEquipe(c, 'cancela o edital');
  const { ref, g } = await edital(ctx, c, data.grantId);
  if (g.status === GS.DRAFT) {
    await ref.delete();
    await f.auditoria(ctx, actor, 'federation_grant_delete', { federation_id: c.fed.id, grant_id: g.id });
    return { ok: true, deleted: true };
  }
  if ([GS.FINAL, GS.CANCELLED].includes(g.status) || (g.payments || []).length) falha('failed-precondition', 'Edital encerrado ou com pagamento registrado não é cancelado.');
  const motivo = exigeMotivo(data);
  await ref.update({ status: GS.CANCELLED, cancel_reason: motivo, cancelled_at_ms: ctx.now, history: historico(g, actor, ctx, 'cancel', { reason: motivo }), updated_at_ms: ctx.now });
  const apps = await inscricoesDo(ctx, g.id);
  await avisarLote(ctx, apps.filter((a) => a.status !== AS.WITHDRAWN).map((a) => a.user_id), { title: tx('Edital cancelado: {titulo}', { titulo: g.title }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_MEU });
  await f.auditoria(ctx, actor, 'federation_grant_cancel', { federation_id: c.fed.id, grant_id: g.id, reason: motivo });
  return { ok: true };
}

/* ============================================================== callable == */

const ACOES = {
  callup_save: ['selection', callupSave],
  callup_costs: ['selection', callupCosts],
  callup_publish: ['selection', callupPublish],
  callup_add: ['selection', callupAdd],
  callup_answer: ['selection', callupAnswer],
  callup_member_update: ['selection', callupMemberUpdate],
  callup_cancel_member: ['selection', callupCancelMember],
  callup_close: ['selection', (ctx, a, d, c) => encerrar(ctx, a, d, c, false)],
  callup_cancel: ['selection', (ctx, a, d, c) => encerrar(ctx, a, d, c, true)],
  grant_save: ['grants', grantSave],
  grant_publish: ['grants', grantPublish],
  grant_apply: ['grants', grantApply],
  grant_withdraw: ['grants', grantWithdraw],
  grant_decide: ['grants', grantDecide],
  grant_result: ['grants', grantResult],
  grant_appeal: ['grants', grantAppeal],
  grant_appeal_decide: ['grants', grantAppealDecide],
  grant_finalize: ['grants', grantFinalize],
  grant_pay: ['grants', grantPay],
  grant_cancel: ['grants', grantCancel],
};

async function selection(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao[1](ctx, actor, data, await contexto(ctx, actor, data, acao[0]));
}

/** O arquivo de uma inscrição (pasta de quem se inscreveu): ele mesmo ou a equipe de competições. */
async function applicationFile(ctx, actor, applicationId, fileKey) {
  const snap = await ctx.db.collection(APPS).doc(texto(applicationId, 80)).get();
  if (!snap.exists) falha('not-found', 'Inscrição não encontrada.');
  const a = snap.data();
  const dono = a.user_id === actor.uid;
  if (!dono) {
    const perms = await f.staffPerms(ctx, a.federation_id, actor);
    if (!perms.includes('competitions') && !perms.includes('admin')) falha('permission-denied', 'Só a equipe de competições vê os arquivos das inscrições.');
  }
  const arq = (a.files || {})[texto(fileKey, 12)];
  if (!arq || !P.ownFilePath(arq.path, a.user_id)) falha('not-found', 'Arquivo não encontrado.');
  return { path: arq.path, dono, audit: { federation_id: a.federation_id, application_id: snap.id, user_id: a.user_id, file_key: fileKey } };
}

/* ============================================================= varredura == */

async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  // 1) Convite sem resposta no prazo vence; o próximo do ranking é chamado.
  const conv = await ctx.db.collection(MEMBERS).where('status', '==', IS.INVITED).get();
  const vencidos = conv.docs.filter((d) => Number(d.data().expires_at_ms) <= ctx.now);
  const porConvocacao = new Map();
  if (vencidos.length) {
    const batch = ctx.db.batch();
    vencidos.forEach((d) => { batch.update(d.ref, { status: IS.EXPIRED, updated_at_ms: ctx.now }); porConvocacao.set(d.data().callup_id, d.data().federation_id); });
    await batch.commit();
  }
  let suplentes = 0;
  for (const [cid, fedId] of porConvocacao) {
    // eslint-disable-next-line no-await-in-loop
    const fs = await ctx.db.collection(f.C.federations).doc(fedId).get();
    // eslint-disable-next-line no-await-in-loop
    if (fs.exists) suplentes += await chamarSuplentes(ctx, { id: fs.id, ...fs.data() }, cid, SISTEMA);
    // eslint-disable-next-line no-await-in-loop
    await refazerLista(ctx, cid);
  }
  // 2) Edital com inscrições vencidas vai para análise (avisa competições).
  const abertos = await ctx.db.collection(GRANTS).where('status', '==', GS.OPEN).get();
  let analise = 0;
  for (const d of abertos.docs) {
    const g = { id: d.id, ...d.data() };
    if (!g.closes_at || g.closes_at >= hoje) continue;
    // eslint-disable-next-line no-await-in-loop
    await d.ref.update({ status: GS.REVIEW, review_at_ms: ctx.now, history: historico(g, SISTEMA, ctx, 'review'), updated_at_ms: ctx.now });
    // eslint-disable-next-line no-await-in-loop
    await avisarLote(ctx, await f.staffIds(ctx, g.federation_id, 'competitions'), { title: tx('Inscrições encerradas: {titulo}', { titulo: g.title }), message: tx('O edital está em análise. Decida cada inscrição e publique o resultado.'), link: linkGestao(g.federation_id, 'editais') });
    analise += 1;
  }
  // 3) Resultado com o prazo de recurso vencido e nada pendente fica definitivo.
  const resultados = await ctx.db.collection(GRANTS).where('status', '==', GS.RESULT).get();
  let finais = 0;
  for (const d of resultados.docs) {
    const g = { id: d.id, ...d.data() };
    // eslint-disable-next-line no-await-in-loop
    if (!P.grantCanFinalize(g, await inscricoesDo(ctx, g.id), hoje)) continue;
    // eslint-disable-next-line no-await-in-loop
    await d.ref.update({ status: GS.FINAL, final_at_ms: ctx.now, history: historico(g, SISTEMA, ctx, 'final'), updated_at_ms: ctx.now });
    finais += 1;
  }
  if (ctx.logger) ctx.logger.info('Federações: seleção e editais.', { vencidos: vencidos.length, suplentes, analise, finais });
  return { expired: vencidos.length, substitutes: suplentes, review: analise, final: finais };
}

/** As despesas derivadas das contas (custos pagos da convocação e pagamentos dos editais). */
async function despesas(ctx, fed) {
  const mods = fed.modules || {};
  const [cu, gr] = await Promise.all([
    mods.selection === true ? ctx.db.collection(CALLUPS).where('federation_id', '==', fed.id).get() : null,
    mods.grants === true ? ctx.db.collection(GRANTS).where('federation_id', '==', fed.id).get() : null,
  ]);
  const de = (s) => (s ? s.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
  return [...P.callupExpenses(de(cu)), ...P.grantExpenses(de(gr))];
}

module.exports = { selection, sweep, despesas, applicationFile, rosterKey, CALLUPS, MEMBERS, GRANTS, APPS };
