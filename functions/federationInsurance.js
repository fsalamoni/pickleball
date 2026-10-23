/**
 * SEGURO: TERMO E CERTIFICADO no servidor (rodada 3, Bloco 5, `docs/50` §42,
 * módulo `insurance`). Só o servidor grava o aceite do termo na filiação e
 * `federation_insurance_certificates` (a regra é `write: if false`).
 *
 *  - `term_accept`: o titular (ou o responsável pelo dependente) aceita a
 *    versão do termo em vigor — a mesma que a tela mostrou (`version`). O
 *    pedido e a renovação da filiação conferem o aceite em `federations.js`.
 *  - O clube ou a arena FILIADA (gestor da organização) pede um certificado de
 *    seguro para um evento; a equipe (`members`/`admin`) emite — com código no
 *    índice da carteirinha (`kind: 'insurance_certificate'`), verificável em
 *    `/f/verificar/:codigo` —, recusa ou cancela com motivo. Quem gere a
 *    organização não decide o próprio pedido. A emissão confere a apólice: tem
 *    de estar vigente e cobrir as datas do evento.
 *
 * A conta pura é `federationInsurancePolicy.js` (cópia de
 * `src/modules/federations/domain/insurance.js`, com paridade).
 */
const P = require('./federationInsurancePolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { gereOrg } = require('./federationOrgMembers.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const COL = 'federation_insurance_certificates';
const AFF = 'federation_affiliations';
const KINDS = ['club', 'arena'];
const CS = P.CERT_STATUS;
const LINK_ORG = (c) => (c.kind === 'club' ? `/clubes/${c.org_id}?tab=admin` : `/arenas/${c.org_id}/gerir?aba=federacao`);
const LINK_GESTAO = (fedId) => `/federacoes/${fedId}/gerir?aba=ocorrencias`;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, at_ms: ctx.now, ...extra }].slice(-30);

async function contexto(ctx, actor, fedId) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, fedId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.insurance === true)) falha('failed-precondition', 'Esta federação não tem o seguro ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now), equipe: perms.includes('members') || perms.includes('admin') };
}

async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  if (!lista.length) return;
  const batch = ctx.db.batch();
  lista.forEach((uid) => f.aviso(ctx, batch, uid, msg));
  await batch.commit();
}

const equipe = async (ctx, fedId, menos) => [...new Set([...await f.staffIds(ctx, fedId, 'members'), ...await f.staffIds(ctx, fedId, 'admin')])].filter((u) => u !== menos);

async function certificado(ctx, c, id) {
  const snap = await ctx.db.collection(COL).doc(texto(id, 200)).get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Certificado não encontrado.');
  return { ref: snap.ref, cert: { id: snap.id, ...snap.data() } };
}

/* ================================================================== termo == */

async function termAccept(ctx, actor, data, c) {
  const ref = ctx.db.collection(f.C.members).doc(texto(data.memberId, 200));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== c.fed.id) falha('not-found', 'Filiação não encontrada.');
  const member = snap.data();
  if (member.user_id !== actor.uid && member.guardian_uid !== actor.uid) falha('permission-denied', 'Só o titular (ou o responsável) aceita o termo.');
  const st = P.termState(member, c.fed);
  if (!st.required) falha('failed-precondition', 'Esta filiação não precisa aceitar o termo do seguro.');
  if (String(data.version || '') !== st.version) falha('failed-precondition', 'O termo mudou enquanto você lia. Leia a versão nova e aceite de novo.');
  if (st.accepted) return { ok: true, already: true };
  await ref.update({ ...P.termAcceptancePatch(member, st.version, actor.uid, ctx.now), updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await f.auditoria(ctx, actor, 'federation_insurance_term_accept', { federation_id: c.fed.id, member_id: ref.id, version: st.version });
  return { ok: true };
}

/* ============================================================ certificado == */

async function certRequest(ctx, actor, data, c) {
  const kind = String(data.kind || '');
  const orgId = texto(data.orgId, 80);
  if (!KINDS.includes(kind)) falha('invalid-argument', 'Tipo de organização inválido.');
  if (!(await gereOrg(ctx, kind, orgId, actor.uid))) falha('permission-denied', kind === 'club' ? 'Só quem administra o clube pede o certificado.' : 'Só quem gere a arena pede o certificado.');
  const aff = await ctx.db.collection(AFF).doc(`${c.fed.id}_${kind}_${orgId}`).get();
  if (!aff.exists || aff.data().status !== 'approved') falha('failed-precondition', 'Só clube ou arena filiado a esta federação pede o certificado.');
  const r = P.validateCertificateRequest(data, c.hoje);
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  const a = aff.data();
  const ref = ctx.db.collection(COL).doc();
  await ref.set({
    federation_id: c.fed.id, federation_name: texto(c.fed.name, 120), federation_acronym: texto(c.fed.acronym, 20),
    kind, org_id: orgId, org_name: texto(a.org_name, 120), org_city: texto(a.org_city, 80), org_state: texto(a.org_state, 2),
    requested_by: actor.uid, event: r.value, status: CS.REQUESTED, code: null, policy: null,
    created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'request'),
  });
  await avisar(ctx, await equipe(ctx, c.fed.id, actor.uid), {
    title: tx('Pedido de certificado de seguro: {org}', { org: texto(a.org_name, 120) }),
    message: tx('{org} pediu o certificado do seguro para "{evento}" em {data}. Emita na Central.', { org: texto(a.org_name, 120), evento: r.value.event_name, data: br(r.value.date_from) }),
    link: LINK_GESTAO(c.fed.id),
  });
  await f.auditoria(ctx, actor, 'federation_insurance_cert_request', { federation_id: c.fed.id, certificate_id: ref.id, kind, org_id: orgId });
  return { ok: true, certificateId: ref.id };
}

async function certWithdraw(ctx, actor, data, c) {
  const { ref, cert } = await certificado(ctx, c, data.certificateId);
  if (!(await gereOrg(ctx, cert.kind, cert.org_id, actor.uid))) falha('permission-denied', 'Só quem gere a organização retira o pedido.');
  if (cert.status !== CS.REQUESTED) falha('failed-precondition', 'Este pedido já foi decidido.');
  await ref.update({ status: CS.WITHDRAWN, updated_at_ms: ctx.now, history: historico(cert, actor, ctx, 'withdraw') });
  return { ok: true };
}

async function certIssue(ctx, actor, data, c) {
  if (!c.equipe) falha('permission-denied', 'Só a secretaria e a administração emitem o certificado.');
  const { ref, cert } = await certificado(ctx, c, data.certificateId);
  if (cert.status !== CS.REQUESTED) falha('failed-precondition', 'Este pedido já foi decidido.');
  if (await gereOrg(ctx, cert.kind, cert.org_id, actor.uid)) falha('permission-denied', 'Quem gere a organização não emite o próprio certificado: peça a outra pessoa da equipe.');
  const ins = c.fed.insurance || null;
  const erro = P.certificateIssueError(ins, cert.event, c.hoje);
  if (erro) falha('failed-precondition', erro);
  const code = f.novoCodigo();
  const policy = { insurer: texto(ins.insurer, 80), policy: texto(ins.policy, 40), valid_from: ins.valid_from || null, valid_until: ins.valid_until, coverage: texto(ins.coverage, 800), phone: texto(ins.phone, 30) };
  const batch = ctx.db.batch();
  batch.update(ref, { status: CS.ISSUED, code, policy, issued_by: actor.uid, issued_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico(cert, actor, ctx, 'issue') });
  batch.set(ctx.db.collection(f.C.cardIndex).doc(code), { kind: 'insurance_certificate', certificate_id: ref.id, federation_id: c.fed.id, created_at_ms: ctx.now });
  f.aviso(ctx, batch, cert.requested_by, {
    title: tx('Certificado de seguro emitido: {evento}', { evento: cert.event.event_name }),
    message: tx('A {sigla} emitiu o certificado do seguro para {org}. Imprima ou mostre o QR a quem pedir.', { sigla: texto(c.fed.acronym || c.fed.name, 20), org: cert.org_name }),
    link: LINK_ORG(cert),
  });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_insurance_cert_issue', { federation_id: c.fed.id, certificate_id: ref.id });
  return { ok: true, code };
}

async function certDecide(ctx, actor, data, c, acao) {
  if (!c.equipe) falha('permission-denied', 'Só a secretaria e a administração decidem o certificado.');
  const { ref, cert } = await certificado(ctx, c, data.certificateId);
  const motivo = texto(data.reason, P.INSURANCE_LIMITS.REASON_MAX);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  if (acao === 'decline' && cert.status !== CS.REQUESTED) falha('failed-precondition', 'Este pedido já foi decidido.');
  if (acao === 'cancel' && cert.status !== CS.ISSUED) falha('failed-precondition', 'Só certificado emitido pode ser cancelado.');
  const batch = ctx.db.batch();
  batch.update(ref, { status: acao === 'decline' ? CS.DECLINED : CS.CANCELLED, decision_reason: motivo, decided_by: actor.uid, updated_at_ms: ctx.now, history: historico(cert, actor, ctx, acao, { reason: motivo }) });
  // O código continua no índice: a verificação pública passa a dizer "cancelado", não "não encontrado".
  f.aviso(ctx, batch, cert.requested_by, acao === 'decline'
    ? { title: tx('Pedido de certificado não aceito: {evento}', { evento: cert.event.event_name }), message: tx('Motivo: {motivo}', { motivo }), link: LINK_ORG(cert) }
    : { title: tx('Certificado de seguro cancelado: {evento}', { evento: cert.event.event_name }), message: tx('Motivo: {motivo}. A verificação pelo QR passa a dizer que ele foi cancelado.', { motivo }), link: LINK_ORG(cert) });
  await batch.commit();
  await f.auditoria(ctx, actor, `federation_insurance_cert_${acao}`, { federation_id: c.fed.id, certificate_id: ref.id, reason: motivo });
  return { ok: true };
}

const ACOES = {
  term_accept: termAccept,
  cert_request: certRequest,
  cert_withdraw: certWithdraw,
  cert_issue: certIssue,
  cert_decline: (ctx, actor, data, c) => certDecide(ctx, actor, data, c, 'decline'),
  cert_cancel: (ctx, actor, data, c) => certDecide(ctx, actor, data, c, 'cancel'),
};

async function insurance(ctx, actor, data = {}) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao(ctx, actor, data, await contexto(ctx, actor, data.federationId));
}

/** A verificação pública de um certificado (chamada por `federations.verify`). */
async function verifyCertificate(ctx, idx, fed, hoje) {
  const s = await ctx.db.collection(COL).doc(String(idx.certificate_id || '')).get();
  return s.exists ? P.publicCertificateVerification(s.data(), fed, hoje) : { found: false };
}

module.exports = { insurance, verifyCertificate, COL };
