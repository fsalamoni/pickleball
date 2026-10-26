/**
 * REDE E DESENVOLVIMENTO no servidor (rodada 3, Bloco 3, `docs/50` §38). Só o
 * servidor grava as duas coleções (a regra é `write: if false`); a
 * secretaria (filiados) e a administração decidem:
 *
 *  - `federation_ambassadors/{fed}_{uid}` (módulo `ambassadors`): o filiado
 *    em dia se candidata aceitando o código de conduta; a equipe nomeia para
 *    uma região — com a proteção de menores conferida quando a federação a
 *    exige para embaixador — e ele manda o relatório a cada N meses. A lista
 *    PÚBLICA (nome, foto, região, sem uid) é gravada em
 *    `federations.ambassadors_public` a cada mudança.
 *  - `federation_club_seals/{fed}_{kind}_{org}` (módulo `club_seal`): quem
 *    gere o clube ou a arena FILIADA pede o selo com as evidências; a
 *    plataforma confere o que sabe (arena: torneio chancelado nos últimos 12
 *    meses e professor licenciado) e a equipe decide. O selo concedido é
 *    copiado para a filiação (`federation_affiliations.seal`), que é o que a
 *    página pública já lê.
 *
 * A conta pura é `federationDevelopmentPolicy.js` (cópia de
 * `src/modules/federations/domain/development.js`, com paridade).
 */
const P = require('./federationDevelopmentPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { gereOrg } = require('./federationOrgMembers.js');
const { clearanceBlocker } = require('./federationCoaching.js');
const { rosterKey } = require('./federationSelection.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const AMBS = 'federation_ambassadors';
const SEALS = 'federation_club_seals';
const AFF = 'federation_affiliations';
const FILE_MAX = 9 * 1024 * 1024;
/** O bloco do embaixador mora na aba "Minha filiação" da página da federação. */
const LINK_MEU = (fedId) => `/federacoes/${fedId}?aba=minha`;
const linkGestao = (fedId, aba) => `/federacoes/${fedId}/gerir?aba=${aba}`;
/** Onde quem gere a organização acompanha o selo (o mesmo cartão "Federação" da filiação). */
const LINK_SELO = (s) => (s.kind === 'club' ? `/clubes/${s.org_id}/gerir?aba=pagina` : `/arenas/${s.org_id}/gerir?aba=federacao`);
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const nomeDe = (u) => texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 120);
const sigla = (fed) => texto(fed.acronym || fed.name, 20);
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, at_ms: ctx.now, ...extra }].slice(-50);
const AS = P.AMBASSADOR_STATUS;
const SS = P.SEAL_STATUS;

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0] || 'Confira os campos.');
  return r.value;
}

function exigeMotivo(data) {
  const motivo = texto(data.reason, 300);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  return motivo;
}

async function contexto(ctx, actor, data, modulo) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules[modulo] === true)) falha('failed-precondition', modulo === 'ambassadors' ? 'Esta federação não tem o programa de embaixadores ligado.' : 'Esta federação não tem o selo de clube certificado ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now), gere: P.canManageDevelopment(perms) };
}

const exigeGestao = (c) => { if (!c.gere) falha('permission-denied', 'Só a secretaria e a administração cuidam disto.'); };

async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  if (!lista.length) return 0;
  const batch = ctx.db.batch();
  lista.forEach((uid) => f.aviso(ctx, batch, uid, msg));
  await batch.commit();
  return lista.length;
}

const equipe = async (ctx, fedId, menos) => [...await f.staffIds(ctx, fedId, 'members'), ...await f.staffIds(ctx, fedId, 'admin')].filter((u) => u !== menos);

/* ========================================================== embaixadores == */

async function embaixador(ctx, fed, uid) {
  const ref = ctx.db.collection(AMBS).doc(`${fed.id}_${texto(uid, 128)}`);
  const snap = await ref.get();
  return { ref, a: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

async function filiadoEmDia(ctx, fed, uid, hoje) {
  const s = await ctx.db.collection(f.C.members).doc(`${fed.id}_${uid}`).get();
  return s.exists && m.membershipState(s.data(), hoje, ctx.now).status === 'active';
}

/** Regrava a lista pública (sem uid) a partir dos nomeados. */
async function refazerPublico(ctx, fedId, hoje) {
  const snap = await ctx.db.collection(AMBS).where('federation_id', '==', fedId).where('status', '==', AS.APPOINTED).get();
  const lista = P.ambassadorsPublic(snap.docs.map((d) => ({ ...d.data(), key: rosterKey(d.id) })), hoje);
  await ctx.db.collection(f.C.federations).doc(fedId).update({ ambassadors_public: lista });
  return lista.length;
}

async function ambApply(ctx, actor, data, c) {
  const regras = P.normalizeAmbassadorRules(c.fed.ambassador_rules);
  if (!regras.open) falha('failed-precondition', 'A federação não está recebendo candidaturas de embaixador agora.');
  if (!(await filiadoEmDia(ctx, c.fed, actor.uid, c.hoje))) falha('failed-precondition', 'Só filiado em dia nesta federação pode ser embaixador.');
  const v = exigeValido(P.validateAmbassadorApply(data));
  const { ref, a } = await embaixador(ctx, c.fed, actor.uid);
  const st = P.ambassadorState(a, regras, c.hoje);
  if (a && st.status === AS.APPOINTED && !st.termEnded) falha('failed-precondition', 'Você já é embaixador desta federação.');
  const u = await ctx.db.collection('users').doc(actor.uid).get();
  const perfil = u.exists ? u.data() : {};
  const base = {
    ...v, federation_id: c.fed.id, user_id: actor.uid, user_name: nomeDe(perfil), photo_url: texto(perfil.photo_url || perfil.avatar_url, 500),
    city: texto(perfil.city, 80), state: texto(perfil.state, 2).toUpperCase(), status: AS.APPLIED, conduct_version: regras.conduct_version,
    conduct_accepted_at_ms: ctx.now, applied_at_ms: ctx.now, updated_at_ms: ctx.now, decision: null,
  };
  if (a) await ref.update({ ...base, region: '', term_until: '', history: historico(a, actor, ctx, 'apply') });
  else await ref.set({ ...base, region: '', term_until: '', reports: [], next_report_due: '', warned_for: '', created_at_ms: ctx.now, history: historico({}, actor, ctx, 'apply') });
  await avisar(ctx, await equipe(ctx, c.fed.id, actor.uid), {
    title: tx('Nova candidatura a embaixador: {nome}', { nome: base.user_name }),
    message: tx('Região pretendida: {regiao}. Confira a proteção de menores e decida na Central.', { regiao: v.region_wish }),
    link: linkGestao(c.fed.id, 'embaixadores'),
  });
  await f.auditoria(ctx, actor, 'federation_ambassador_apply', { federation_id: c.fed.id, ambassador_id: ref.id });
  return { ok: true };
}

async function ambWithdraw(ctx, actor, data, c) {
  const { ref, a } = await embaixador(ctx, c.fed, actor.uid);
  if (!a || ![AS.APPLIED, AS.APPOINTED].includes(a.status)) falha('failed-precondition', 'Não há candidatura nem mandato para encerrar.');
  if (a.status === AS.APPLIED) await ref.delete();
  else {
    await ref.update({ status: AS.ENDED, ended_at: c.hoje, decision: { reason: 'Saiu a pedido.', by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now, history: historico(a, actor, ctx, 'resign') });
    await refazerPublico(ctx, c.fed.id, c.hoje);
  }
  await f.auditoria(ctx, actor, 'federation_ambassador_withdraw', { federation_id: c.fed.id, ambassador_id: ref.id, was: a.status });
  return { ok: true };
}

async function ambAccept(ctx, actor, data, c) {
  if (data.accept_conduct !== true) falha('invalid-argument', 'É preciso aceitar o código de conduta.');
  const { ref, a } = await embaixador(ctx, c.fed, actor.uid);
  if (!a || a.status !== AS.APPOINTED) falha('failed-precondition', 'Só o embaixador nomeado aceita o código novo.');
  const regras = P.normalizeAmbassadorRules(c.fed.ambassador_rules);
  await ref.update({ conduct_version: regras.conduct_version, conduct_accepted_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(a, actor, ctx, 'accept_conduct', { version: regras.conduct_version }) });
  return { ok: true };
}

async function ambReport(ctx, actor, data, c) {
  const { ref, a } = await embaixador(ctx, c.fed, actor.uid);
  const regras = P.normalizeAmbassadorRules(c.fed.ambassador_rules);
  if (!P.ambassadorState(a, regras, c.hoje).appointed) falha('failed-precondition', 'Só o embaixador nomeado manda relatório.');
  const v = exigeValido(P.validateReport(data));
  const reports = [...(a.reports || []), { id: String(ctx.now), text: v.text, at_ms: ctx.now, due: a.next_report_due || '' }].slice(-P.AMB_LIMITS.REPORTS_MAX);
  await ref.update({ reports, next_report_due: P.addMonthsISO(c.hoje, regras.report_months), warned_for: '', updated_at_ms: ctx.now });
  await avisar(ctx, await equipe(ctx, c.fed.id, actor.uid), {
    title: tx('Relatório do embaixador {nome}', { nome: a.user_name }),
    message: tx('Região: {regiao}. Leia na Central.', { regiao: a.region }),
    link: linkGestao(c.fed.id, 'embaixadores'),
  });
  await f.auditoria(ctx, actor, 'federation_ambassador_report', { federation_id: c.fed.id, ambassador_id: ref.id });
  return { ok: true };
}

async function alvo(ctx, c, uid) {
  const r = await embaixador(ctx, c.fed, texto(uid, 128));
  if (!r.a) falha('not-found', 'Candidatura não encontrada.');
  return r;
}

async function ambAppoint(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, a } = await alvo(ctx, c, data.userId);
  if (a.status !== AS.APPLIED) falha('failed-precondition', 'Só se nomeia quem está com a candidatura em análise.');
  if (a.user_id === actor.uid) falha('permission-denied', 'Ninguém nomeia a si mesmo: peça a outra pessoa da equipe.');
  const v = exigeValido(P.validateAppointment(data, c.hoje));
  if (!(await filiadoEmDia(ctx, c.fed, a.user_id, c.hoje))) falha('failed-precondition', 'A filiação desta pessoa não está em dia.');
  const bloqueio = await clearanceBlocker(ctx, c.fed, a.user_id, 'ambassador');
  if (bloqueio) falha('failed-precondition', bloqueio);
  const regras = P.normalizeAmbassadorRules(c.fed.ambassador_rules);
  await ref.update({
    ...v, status: AS.APPOINTED, appointed_at: c.hoje, next_report_due: P.addMonthsISO(c.hoje, regras.report_months), warned_for: '',
    decision: { by: actor.uid, at_ms: ctx.now, reason: '' }, updated_at_ms: ctx.now, history: historico(a, actor, ctx, 'appoint', { region: v.region }),
  });
  await refazerPublico(ctx, c.fed.id, c.hoje);
  await avisar(ctx, [a.user_id], {
    title: tx('Você é embaixador da {sigla}', { sigla: sigla(c.fed) }),
    message: tx('Região: {regiao}. O primeiro relatório vence em {data}.', { regiao: v.region, data: br(P.addMonthsISO(c.hoje, regras.report_months)) }),
    link: LINK_MEU(c.fed.id),
  });
  await f.auditoria(ctx, actor, 'federation_ambassador_appoint', { federation_id: c.fed.id, ambassador_id: ref.id, region: v.region, term_until: v.term_until });
  return { ok: true };
}

async function ambUpdate(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, a } = await alvo(ctx, c, data.userId);
  if (a.status !== AS.APPOINTED) falha('failed-precondition', 'Só se edita o embaixador nomeado.');
  const v = exigeValido(P.validateAppointment(data, c.hoje));
  await ref.update({ ...v, updated_at_ms: ctx.now, history: historico(a, actor, ctx, 'update', { region: v.region, term_until: v.term_until }) });
  await refazerPublico(ctx, c.fed.id, c.hoje);
  await f.auditoria(ctx, actor, 'federation_ambassador_update', { federation_id: c.fed.id, ambassador_id: ref.id, region: v.region, term_until: v.term_until });
  return { ok: true };
}

async function ambDecideOut(ctx, actor, data, c, encerrar) {
  exigeGestao(c);
  const { ref, a } = await alvo(ctx, c, data.userId);
  if (a.status !== (encerrar ? AS.APPOINTED : AS.APPLIED)) falha('failed-precondition', encerrar ? 'Só se encerra o mandato de quem está nomeado.' : 'Só se recusa a candidatura em análise.');
  const motivo = exigeMotivo(data);
  await ref.update({
    status: encerrar ? AS.ENDED : AS.REJECTED, ...(encerrar ? { ended_at: c.hoje } : {}),
    decision: { by: actor.uid, at_ms: ctx.now, reason: motivo }, updated_at_ms: ctx.now, history: historico(a, actor, ctx, encerrar ? 'end' : 'reject', { reason: motivo }),
  });
  if (encerrar) await refazerPublico(ctx, c.fed.id, c.hoje);
  await avisar(ctx, [a.user_id], encerrar
    ? { title: tx('Seu mandato de embaixador da {sigla} foi encerrado', { sigla: sigla(c.fed) }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_MEU(c.fed.id) }
    : { title: tx('Candidatura a embaixador da {sigla} não aceita', { sigla: sigla(c.fed) }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_MEU(c.fed.id) });
  await f.auditoria(ctx, actor, encerrar ? 'federation_ambassador_end' : 'federation_ambassador_reject', { federation_id: c.fed.id, ambassador_id: ref.id, reason: motivo });
  return { ok: true };
}

/* ============================================================ selo de clube == */

const KINDS = ['club', 'arena'];

async function selo(ctx, fed, kind, orgId) {
  if (!KINDS.includes(kind)) falha('invalid-argument', 'Tipo de organização inválido.');
  const id = `${fed.id}_${kind}_${texto(orgId, 80)}`;
  const ref = ctx.db.collection(SEALS).doc(id);
  const snap = await ref.get();
  return { id, ref, s: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

/** O que a plataforma confere sozinha (só arena: o torneio aponta a arena e o professor está no cadastro dela). `null` = não sabe. */
async function conferenciaAutomatica(ctx, fed, kind, orgId, hoje) {
  if (kind !== 'arena') return { hosted_event: null, licensed_coach: null };
  const desde = P.addMonthsISO(hoje, -12);
  const [torneios, professores] = await Promise.all([
    ctx.db.collection('tournaments').where('federation_id', '==', fed.id).get(),
    ctx.db.collection('arena_coaches').where('arena_id', '==', orgId).get(),
  ]);
  const data = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    const ms = typeof v.toMillis === 'function' ? v.toMillis() : Number(v);
    return Number.isFinite(ms) ? m.isoDateBR(ms) : '';
  };
  const hosted_event = torneios.docs.some((d) => {
    const t = d.data();
    const quando = data(t.starts_at);
    return t.arena_id === orgId && t.arena_confirmed !== false && (t.federation_sanction || {}).status === 'approved' && quando >= desde && quando <= hoje;
  });
  const uids = [...new Set(professores.docs.map((d) => d.data().user_id).filter(Boolean))].slice(0, 30);
  const lics = await Promise.all(uids.map((uid) => ctx.db.collection('federation_coach_licenses').doc(`${fed.id}_${uid}`).get()));
  const licensed_coach = lics.some((s) => s.exists && s.data().status === 'active' && (!s.data().valid_until || String(s.data().valid_until) >= hoje));
  return { hosted_event, licensed_coach };
}

async function exigeGestorDaOrg(ctx, actor, kind, orgId) {
  if (!(await gereOrg(ctx, kind, orgId, actor.uid))) falha('permission-denied', kind === 'club' ? 'Só quem administra o clube pede o selo.' : 'Só quem gere a arena pede o selo.');
}

async function sealApply(ctx, actor, data, c) {
  const kind = String(data.kind || '');
  const orgId = texto(data.orgId, 80);
  await exigeGestorDaOrg(ctx, actor, kind, orgId);
  const regras = P.normalizeSealRules(c.fed.club_seal);
  if (!regras.open) falha('failed-precondition', 'A federação não está recebendo pedidos de selo agora.');
  const { id, ref, s } = await selo(ctx, c.fed, kind, orgId);
  const aff = await ctx.db.collection(AFF).doc(id).get();
  if (!aff.exists || aff.data().status !== 'approved') falha('failed-precondition', 'Só clube ou arena filiado a esta federação pede o selo.');
  const st = P.sealState(s, c.hoje);
  if (s && !st.canApply && !st.applied) falha('failed-precondition', `O selo vale até ${br(st.validUntil)}: a renovação abre ${P.SEAL_LIMITS.RENEW_DAYS} dias antes.`);
  const v = exigeValido(P.validateSealApply(regras, kind, data, actor.uid));
  const auto = await conferenciaAutomatica(ctx, c.fed, kind, orgId, c.hoje);
  const a = aff.data();
  const base = {
    federation_id: c.fed.id, kind, org_id: orgId, org_name: texto(a.org_name, 120), org_city: texto(a.org_city, 80), org_state: texto(a.org_state, 2),
    applicant_uid: actor.uid, evidence: v.evidence, auto_checks: auto, criteria: regras.criteria, seal_name: regras.name,
    status: SS.APPLIED, applied_at_ms: ctx.now, updated_at_ms: ctx.now,
  };
  if (s) await ref.update({ ...base, history: historico(s, actor, ctx, 'apply') });
  else await ref.set({ ...base, granted_until: '', decision: null, warned_until: '', created_at_ms: ctx.now, history: historico({}, actor, ctx, 'apply') });
  await avisar(ctx, await equipe(ctx, c.fed.id, actor.uid), {
    title: tx('Pedido de selo: {org}', { org: base.org_name }),
    message: tx('{org} pediu o selo "{selo}". Confira as evidências na Central.', { org: base.org_name, selo: regras.name }),
    link: linkGestao(c.fed.id, 'selo-clubes'),
  });
  await f.auditoria(ctx, actor, 'federation_seal_apply', { federation_id: c.fed.id, seal_id: id, kind, org_id: orgId });
  return { ok: true, sealId: id };
}

async function sealWithdraw(ctx, actor, data, c) {
  const kind = String(data.kind || '');
  const orgId = texto(data.orgId, 80);
  await exigeGestorDaOrg(ctx, actor, kind, orgId);
  const { id, ref, s } = await selo(ctx, c.fed, kind, orgId);
  if (!s || s.status !== SS.APPLIED) falha('failed-precondition', 'Não há pedido em análise.');
  // Renovação retirada: o selo concedido continua até a validade.
  if (s.granted_until) await ref.update({ status: SS.GRANTED, updated_at_ms: ctx.now, history: historico(s, actor, ctx, 'withdraw') });
  else await ref.delete();
  await f.auditoria(ctx, actor, 'federation_seal_withdraw', { federation_id: c.fed.id, seal_id: id });
  return { ok: true };
}

async function seloPorId(ctx, c, sealId) {
  const snap = await ctx.db.collection(SEALS).doc(texto(sealId, 200)).get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Pedido de selo não encontrado.');
  return { ref: snap.ref, s: { id: snap.id, ...snap.data() } };
}

async function sealRecheck(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, s } = await seloPorId(ctx, c, data.sealId);
  const auto = await conferenciaAutomatica(ctx, c.fed, s.kind, s.org_id, c.hoje);
  await ref.update({ auto_checks: auto, updated_at_ms: ctx.now });
  return { ok: true, auto };
}

async function sealGrant(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, s } = await seloPorId(ctx, c, data.sealId);
  if (s.status !== SS.APPLIED) falha('failed-precondition', 'Só se concede o pedido em análise.');
  if (await gereOrg(ctx, s.kind, s.org_id, actor.uid)) falha('permission-denied', 'Quem gere a organização não decide o próprio selo: peça a outra pessoa da equipe.');
  const aff = await ctx.db.collection(AFF).doc(s.id).get();
  if (!aff.exists || aff.data().status !== 'approved') falha('failed-precondition', 'A organização não está mais filiada: o selo não pode ser concedido.');
  const regras = P.normalizeSealRules(c.fed.club_seal);
  const auto = await conferenciaAutomatica(ctx, c.fed, s.kind, s.org_id, c.hoje);
  const dec = P.sealDecision(regras, s.kind, auto, data.checks && typeof data.checks === 'object' ? data.checks : {});
  if (!dec.ok) falha('failed-precondition', `Faltam critérios obrigatórios: ${dec.missing.map((x) => (regras.criteria.find((k) => k.id === x) || {}).label || x).join('; ')}.`);
  const ate = P.addMonthsISO(c.hoje, regras.validity_months);
  const batch = ctx.db.batch();
  batch.update(ref, {
    status: SS.GRANTED, granted_until: ate, granted_at: c.hoje, auto_checks: auto, criteria: regras.criteria, seal_name: regras.name, warned_until: '',
    decision: { checks: dec.checks, note: texto(data.note, P.SEAL_LIMITS.NOTE_MAX), by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now,
    history: historico(s, actor, ctx, 'grant', { until: ate }),
  });
  batch.update(aff.ref, { seal: { name: regras.name, valid_until: ate, granted_at: c.hoje } });
  await batch.commit();
  await avisar(ctx, [s.applicant_uid], {
    title: tx('{org} recebeu o selo "{selo}"', { org: s.org_name, selo: regras.name }),
    message: tx('Vale até {data} e já aparece na página da {sigla}.', { data: br(ate), sigla: sigla(c.fed) }),
    link: `/federacoes/${c.fed.id}`,
  });
  await f.auditoria(ctx, actor, 'federation_seal_grant', { federation_id: c.fed.id, seal_id: s.id, until: ate, checks: dec.checks });
  return { ok: true, until: ate };
}

async function sealReject(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, s } = await seloPorId(ctx, c, data.sealId);
  if (s.status !== SS.APPLIED) falha('failed-precondition', 'Só se recusa o pedido em análise.');
  const motivo = exigeMotivo(data);
  await ref.update({ status: SS.REJECTED, decision: { reason: motivo, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now, history: historico(s, actor, ctx, 'reject', { reason: motivo }) });
  await avisar(ctx, [s.applicant_uid], { title: tx('Pedido de selo de {org} não aceito', { org: s.org_name }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_SELO(s) });
  await f.auditoria(ctx, actor, 'federation_seal_reject', { federation_id: c.fed.id, seal_id: s.id, reason: motivo });
  return { ok: true };
}

async function sealRevoke(ctx, actor, data, c) {
  exigeGestao(c);
  const { ref, s } = await seloPorId(ctx, c, data.sealId);
  if (!P.sealState(s, c.hoje).valid) falha('failed-precondition', 'Este selo não está valendo.');
  const motivo = exigeMotivo(data);
  const batch = ctx.db.batch();
  batch.update(ref, { status: SS.REVOKED, granted_until: '', decision: { reason: motivo, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now, history: historico(s, actor, ctx, 'revoke', { reason: motivo }) });
  const aff = await ctx.db.collection(AFF).doc(s.id).get();
  if (aff.exists) batch.update(aff.ref, { seal: null });
  await batch.commit();
  await avisar(ctx, [s.applicant_uid], { title: tx('Selo de {org} cassado', { org: s.org_name }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_SELO(s) });
  await f.auditoria(ctx, actor, 'federation_seal_revoke', { federation_id: c.fed.id, seal_id: s.id, reason: motivo });
  return { ok: true };
}

/** O arquivo de uma evidência: a equipe ou quem gere a organização. */
async function sealFile(ctx, actor, data, c) {
  const { s } = await seloPorId(ctx, c, data.sealId);
  if (!c.gere && !(await gereOrg(ctx, s.kind, s.org_id, actor.uid))) falha('permission-denied', 'Só a equipe da federação e quem gere a organização veem as evidências.');
  const e = (s.evidence || {})[texto(data.criterionId, 24)];
  if (!e || !e.file || !P.ownFilePath(e.file.path, s.applicant_uid)) falha('not-found', 'Arquivo não encontrado.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const file = ctx.bucket.file(e.file.path);
  const [meta] = await file.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > FILE_MAX) falha('failed-precondition', 'Arquivo grande demais para abrir por aqui.');
  const [bytes] = await file.download();
  if (c.gere) await f.auditoria(ctx, actor, 'federation_seal_file_view', { federation_id: c.fed.id, seal_id: s.id, criterion: data.criterionId });
  return { ok: true, name: e.file.name, contentType: meta.contentType || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

/* ============================================================== callable == */

const ACOES = {
  amb_apply: ['ambassadors', ambApply],
  amb_withdraw: ['ambassadors', ambWithdraw],
  amb_accept: ['ambassadors', ambAccept],
  amb_report: ['ambassadors', ambReport],
  amb_appoint: ['ambassadors', ambAppoint],
  amb_update: ['ambassadors', ambUpdate],
  amb_reject: ['ambassadors', (ctx, a, d, c) => ambDecideOut(ctx, a, d, c, false)],
  amb_end: ['ambassadors', (ctx, a, d, c) => ambDecideOut(ctx, a, d, c, true)],
  seal_apply: ['club_seal', sealApply],
  seal_withdraw: ['club_seal', sealWithdraw],
  seal_recheck: ['club_seal', sealRecheck],
  seal_grant: ['club_seal', sealGrant],
  seal_reject: ['club_seal', sealReject],
  seal_revoke: ['club_seal', sealRevoke],
  seal_file: ['club_seal', sealFile],
};

async function development(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao[1](ctx, actor, data, await contexto(ctx, actor, data, acao[0]));
}

/* ============================================================= varredura == */

async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const feds = new Map();
  const fedDe = async (id) => {
    if (!feds.has(id)) {
      const s = await ctx.db.collection(f.C.federations).doc(id).get();
      feds.set(id, s.exists ? { id, ...s.data() } : null);
    }
    return feds.get(id);
  };
  const ligado = (fed, mod) => Boolean(fed && fed.status === 'approved' && fed.modules && fed.modules[mod] === true);
  let avisos = 0;
  const refazer = new Set();
  /* eslint-disable no-await-in-loop */
  const nomeados = await ctx.db.collection(AMBS).where('status', '==', AS.APPOINTED).get();
  for (const d of nomeados.docs) {
    const a = d.data();
    const fed = await fedDe(a.federation_id);
    if (!ligado(fed, 'ambassadors')) continue;
    const st = P.ambassadorState(a, fed.ambassador_rules, hoje);
    if (st.termEnded) {
      // O mandato tinha data para acabar: acabou.
      await d.ref.update({ status: AS.ENDED, ended_at: hoje, decision: { reason: 'Fim do mandato.', by: 'system', at_ms: ctx.now }, updated_at_ms: ctx.now });
      refazer.add(fed.id);
      avisos += await avisar(ctx, [a.user_id], { title: tx('Seu mandato de embaixador da {sigla} terminou', { sigla: sigla(fed) }), message: tx('Obrigado pelo trabalho na região {regiao}.', { regiao: a.region }), link: LINK_MEU(fed.id) });
      continue;
    }
    if (st.reportDue && a.warned_for !== a.next_report_due) {
      avisos += await avisar(ctx, [a.user_id], { title: tx('Hora do relatório de embaixador da {sigla}', { sigla: sigla(fed) }), message: tx('O relatório venceu em {data}. Conte o que foi feito na região.', { data: br(a.next_report_due) }), link: LINK_MEU(fed.id) });
      await d.ref.update({ warned_for: a.next_report_due });
    }
  }
  for (const fedId of refazer) await refazerPublico(ctx, fedId, hoje);
  // Concedido e renovação em análise (o pedido de renovação mantém `granted_until`).
  const concedidos = await Promise.all([SS.GRANTED, SS.APPLIED].map((st) => ctx.db.collection(SEALS).where('status', '==', st).get()));
  for (const d of concedidos.flatMap((q) => q.docs)) {
    const s = { id: d.id, ...d.data() };
    const st = P.sealState(s, hoje);
    if (!st.expiring || s.warned_until === s.granted_until) continue;
    const fed = await fedDe(s.federation_id);
    if (!ligado(fed, 'club_seal')) continue;
    avisos += await avisar(ctx, [s.applicant_uid], {
      title: tx('O selo de {org} vence em {data}', { org: s.org_name, data: br(s.granted_until) }),
      message: st.applied ? tx('A renovação está em análise na {sigla}.', { sigla: sigla(fed) }) : tx('Peça a renovação à {sigla} para não perder o selo.', { sigla: sigla(fed) }),
      link: LINK_SELO(s),
    });
    await d.ref.update({ warned_until: s.granted_until });
  }
  /* eslint-enable no-await-in-loop */
  if (ctx.logger) ctx.logger.info('Federações: embaixadores e selo de clube.', { avisos });
  return { notices: avisos };
}

module.exports = { development, sweep, refazerPublico, AMBS, SEALS };
