/**
 * FEDERAÇÕES — cargos, mandatos e admins master (só o servidor grava
 * `federation_staff` e `federations.staff_roles`), e o acesso JUSTIFICADO
 * e temporário do admin da plataforma (`federation_admin_grants`).
 *
 *  - `staff` (callable `federationStaff`): `role_save`/`role_delete` (só
 *    admin master), `appoint`, `extend` (prorrogação, com motivo e
 *    histórico), `remove` (inclusive sair) e `transfer` (passar a
 *    administração, ficando ou saindo). A federação NUNCA fica sem admin
 *    master; quem tem `staff` sem ser master só mexe fora dos cargos de
 *    master, nunca em si mesmo e só dá permissões que tem.
 *  - `adminAccess` (callable `federationAdminAccess`): o admin da plataforma
 *    diz o motivo e o prazo (até 8 h); o registro vai PRIMEIRO para
 *    `admin_access_logs` (registro interno da plataforma) e só então o acesso
 *    é aberto. A regra (`fedPlat`), o servidor (`staffPerms`) e a tela só dão
 *    poder na federação com o acesso valendo.
 *  - `sweep` (diária): avisa 30/7/1 dias antes do fim do mandato; mandato
 *    vencido sai da equipe — o último admin master fica, e é avisado.
 *
 * A conta pura é `federationStaffPolicy.js` (cópia do cliente, com paridade).
 */
const crypto = require('node:crypto');
const P = require('./federationStaffPolicy.js');
const f = require('./federations.js');
const m = require('./federationMembership.js');
const { REASON_CATEGORIES, REASON_TEXT_MIN } = require('./supportAccess.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const STAFF = 'federation_staff';
const GRANTS = 'federation_admin_grants';
const WARN_DAYS = Object.freeze([30, 7, 1]);
const ACCESS_HOURS = Object.freeze([1, 2, 4, 8]);
const HISTORY_MAX = 20;
const DIA_MS = 86400000;

const staffRef = (ctx, fedId, uid) => ctx.db.collection(STAFF).doc(`${fedId}_${uid}`);

async function equipe(ctx, fedId) {
  const snap = await ctx.db.collection(STAFF).where('federation_id', '==', fedId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function grantDe(ctx, fedId, uid) {
  const g = await ctx.db.collection(GRANTS).doc(`${fedId}_${uid}`).get();
  return g.exists ? g.data() : null;
}

/** O ator como "pessoa da equipe": o admin da plataforma com acesso valendo é admin master. */
async function atorNaEquipe(ctx, fed, actor, lista) {
  if (actor.isPlatformAdmin && P.grantActive(await grantDe(ctx, fed.id, actor.uid), ctx.now)) {
    return { user_id: actor.uid, is_master: true, perms: [...P.ALL], platform: true };
  }
  return lista.find((s) => s.user_id === actor.uid) || null;
}

function cargo(fed, roleId) {
  const r = P.effectiveRoles(fed).find((x) => x.id === roleId);
  if (!r) falha('not-found', 'Cargo não encontrado. Atualize a página.');
  return r;
}

const nomeDaConta = (u = {}) => texto(u.platform_name, 120) || texto(u.full_name, 120) || texto(u.name, 120) || '';

/** O documento da pessoa no cargo, com o mandato. Preserva histórico e criação. */
function docDoCargo(ctx, { fed, uid, nome, foto, role, termStart, termEnd, anterior, por }) {
  return {
    federation_id: fed.id, federation_name: texto(fed.name, 120), federation_acronym: texto(fed.acronym, 12),
    user_id: uid, user_name: nome, ...(foto ? { photo_url: foto } : {}),
    role: role.id, role_id: role.id, role_name: role.name, perms: [...role.perms], is_master: Boolean(role.is_master),
    term_start: termStart, term_end: termEnd || '', term_end_ms: termEnd ? m.endOfDayBrMs(termEnd) : 0,
    term_history: (anterior && Array.isArray(anterior.term_history) ? anterior.term_history : []).slice(-HISTORY_MAX),
    term_warned: [],
    added_by: (anterior && anterior.added_by) || por,
    created_at: (anterior && anterior.created_at) || ctx.Timestamp.fromMillis(ctx.now),
    updated_at: ctx.Timestamp.fromMillis(ctx.now),
  };
}

const fimPadrao = (role, inicio) => (role.term_months ? m.addMonthsISO(inicio, role.term_months) : '');
const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

function avisoCargo(ctx, batch, uid, fed, title, message, params = {}) {
  const p = { sigla: fed.acronym || fed.name, ...params };
  f.aviso(ctx, batch, uid, { title: tx(title.$t, p), message: tx(message.$t, p), link: `/federacoes/${fed.id}/gerir?aba=equipe` });
}

/* ------------------------------------------------------------ cargos -- */

function novoIdDeCargo(nome, existentes) {
  const base = String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'cargo';
  let id = base.length >= 2 ? base : `cargo-${base}`;
  while (existentes.includes(id)) id = `${base.slice(0, 30)}-${crypto.randomBytes(2).toString('hex')}`;
  return id;
}

async function salvarCargo(ctx, actor, fed, lista, ator, data) {
  if (!P.isMaster(ator)) falha('permission-denied', 'Só um admin master monta os cargos.');
  const v = P.validateRole(data.role || {});
  if (!v.ok) falha('invalid-argument', Object.values(v.errors)[0]);
  const roles = P.effectiveRoles(fed).map((r) => ({ ...r, perms: [...r.perms] }));
  let role;
  if (v.value.id) {
    const i = roles.findIndex((r) => r.id === v.value.id);
    if (i < 0) falha('not-found', 'Cargo não encontrado. Atualize a página.');
    role = { ...v.value };
    // Deixar de ser master: só se sobrar admin master fora deste cargo.
    if (roles[i].is_master && !role.is_master && !lista.some((s) => P.isMaster(s) && (s.role_id || s.role) !== role.id)) {
      falha('failed-precondition', 'A federação ficaria sem admin master. Nomeie outro admin master antes.');
    }
    roles[i] = role;
  } else {
    if (roles.length >= P.ROLES_MAX) falha('failed-precondition', `No máximo ${P.ROLES_MAX} cargos.`);
    role = { ...v.value, id: novoIdDeCargo(v.value.name, roles.map((r) => r.id)) };
    roles.push(role);
  }
  if (!roles.some((r) => r.is_master)) falha('failed-precondition', 'Mantenha ao menos um cargo de admin master.');

  const batch = ctx.db.batch();
  batch.update(ctx.db.collection('federations').doc(fed.id), { staff_roles: roles, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  // Quem está no cargo leva a cópia nova das permissões (é o que a regra lê).
  lista.filter((s) => (s.role_id || s.role) === role.id).forEach((s) => {
    batch.update(ctx.db.collection(STAFF).doc(s.id), { role_id: role.id, role_name: role.name, perms: [...role.perms], is_master: role.is_master, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  });
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_role_save', { federation_id: fed.id, role_id: role.id, perms: role.perms, is_master: role.is_master });
  return { ok: true, roleId: role.id };
}

async function apagarCargo(ctx, actor, fed, lista, ator, data) {
  if (!P.isMaster(ator)) falha('permission-denied', 'Só um admin master monta os cargos.');
  const id = texto(data.roleId, 40);
  const roles = P.effectiveRoles(fed);
  const role = roles.find((r) => r.id === id);
  if (!role) falha('not-found', 'Cargo não encontrado. Atualize a página.');
  if (lista.some((s) => (s.role_id || s.role) === id)) falha('failed-precondition', 'Há gente neste cargo. Mude essas pessoas de cargo antes.');
  const resto = roles.filter((r) => r.id !== id);
  if (!resto.some((r) => r.is_master)) falha('failed-precondition', 'Mantenha ao menos um cargo de admin master.');
  await ctx.db.collection('federations').doc(fed.id).update({ staff_roles: resto, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await f.auditoria(ctx, actor, 'federation_role_delete', { federation_id: fed.id, role_id: id });
  return { ok: true };
}

/* ------------------------------------------------------------ pessoas -- */

async function nomear(ctx, actor, fed, lista, ator, data, { batch: lote = null } = {}) {
  const uid = texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  const role = cargo(fed, texto(data.roleId, 40));
  const anterior = lista.find((s) => s.user_id === uid) || null;
  if (!P.allowed({ actor: ator, target: anterior, role, now: ctx.now })) falha('permission-denied', 'Você não pode nomear para este cargo.');
  if (anterior && P.isMaster(anterior) && !role.is_master && P.isLastMaster(anterior, lista)) {
    falha('failed-precondition', 'A federação ficaria sem admin master. Nomeie outro admin master antes.');
  }
  const hoje = m.isoDateBR(ctx.now);
  const termStart = texto(data.termStart, 10) || hoje;
  const termEnd = data.termEnd === undefined ? fimPadrao(role, termStart) : texto(data.termEnd, 10);
  const vt = P.validateTerm({ term_start: termStart, term_end: termEnd });
  if (!vt.ok) falha('invalid-argument', Object.values(vt.errors)[0]);
  const conta = await ctx.db.collection('users').doc(uid).get();
  if (!conta.exists) falha('not-found', 'Essa conta não existe mais.');
  const u = conta.data() || {};
  const batch = lote || ctx.db.batch();
  batch.set(staffRef(ctx, fed.id, uid), docDoCargo(ctx, {
    fed, uid, nome: nomeDaConta(u) || texto(data.userName, 120), foto: texto(u.photo_url, 500), role, termStart, termEnd, anterior, por: actor.uid,
  }));
  if (uid !== actor.uid) {
    avisoCargo(ctx, batch, uid, fed, tx('Você é {cargo} da {sigla}'),
      termEnd ? tx('Mandato de {inicio} a {fim}. A Central da federação abre o que o cargo permite.') : tx('Mandato a partir de {inicio}, sem data de fim. A Central da federação abre o que o cargo permite.'),
      { cargo: role.name, inicio: dataBR(termStart), fim: dataBR(termEnd) });
  }
  if (!lote) await batch.commit();
  await f.auditoria(ctx, actor, anterior ? 'federation_staff_change' : 'federation_staff_appoint', { federation_id: fed.id, user_id: uid, role_id: role.id, term_start: termStart, term_end: termEnd, by_platform: Boolean(ator.platform) });
  return { ok: true };
}

async function prorrogar(ctx, actor, fed, lista, ator, data) {
  const uid = texto(data.userId, 128);
  const alvo = lista.find((s) => s.user_id === uid);
  if (!alvo) falha('not-found', 'Essa pessoa não está na equipe.');
  const role = P.effectiveRoles(fed).find((r) => r.id === (alvo.role_id || alvo.role)) || null;
  if (!P.allowed({ actor: ator, target: alvo, role, now: ctx.now })) falha('permission-denied', 'Você não pode prorrogar este mandato.');
  const termEnd = texto(data.termEnd, 10);
  const reason = texto(data.reason, 300);
  const act = texto(data.act, 120);
  if (reason.length < 3) falha('invalid-argument', 'Diga o motivo da prorrogação.');
  const vt = P.validateTerm({ term_start: alvo.term_start || m.isoDateBR(ctx.now), term_end: termEnd });
  if (!vt.ok) falha('invalid-argument', Object.values(vt.errors)[0]);
  if (termEnd && alvo.term_end && termEnd <= alvo.term_end) falha('invalid-argument', 'Prorrogar é estender: escolha uma data depois do fim atual.');
  const historico = [...(Array.isArray(alvo.term_history) ? alvo.term_history : []), { at_ms: ctx.now, by: actor.uid, from: alvo.term_end || '', to: termEnd, reason, act }].slice(-HISTORY_MAX);
  const batch = ctx.db.batch();
  batch.update(ctx.db.collection(STAFF).doc(alvo.id), {
    term_end: termEnd, term_end_ms: termEnd ? m.endOfDayBrMs(termEnd) : 0, term_history: historico, term_warned: [], term_held_notified: false,
    updated_at: ctx.Timestamp.fromMillis(ctx.now),
  });
  if (uid !== actor.uid) {
    avisoCargo(ctx, batch, uid, fed, tx('Seu mandato na {sigla} foi prorrogado'), termEnd ? tx('Agora vale até {fim}. Motivo: {motivo}.') : tx('Agora não tem data de fim. Motivo: {motivo}.'), { fim: dataBR(termEnd), motivo: reason });
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_staff_extend', { federation_id: fed.id, user_id: uid, from: alvo.term_end || '', to: termEnd, reason, act });
  return { ok: true };
}

async function tirar(ctx, actor, fed, lista, ator, data) {
  const uid = texto(data.userId, 128);
  const alvo = lista.find((s) => s.user_id === uid);
  if (!alvo) falha('not-found', 'Essa pessoa não está na equipe.');
  const proprio = uid === actor.uid;
  if (!proprio) {
    const role = P.effectiveRoles(fed).find((r) => r.id === (alvo.role_id || alvo.role)) || null;
    if (!P.allowed({ actor: ator, target: alvo, role, now: ctx.now })) falha('permission-denied', 'Você não pode tirar esta pessoa da equipe.');
  }
  if (P.isLastMaster(alvo, lista)) falha('failed-precondition', 'É o único admin master. Nomeie outro admin master antes de sair.');
  const reason = texto(data.reason, 300);
  const batch = ctx.db.batch();
  batch.delete(ctx.db.collection(STAFF).doc(alvo.id));
  if (!proprio) avisoCargo(ctx, batch, uid, fed, tx('Você saiu da equipe da {sigla}'), reason ? tx('Motivo: {motivo}.') : tx('Quem administra a federação tirou você da equipe.'), { motivo: reason });
  await batch.commit();
  await f.auditoria(ctx, actor, proprio ? 'federation_staff_leave' : 'federation_staff_remove', { federation_id: fed.id, user_id: uid, role_id: alvo.role_id || alvo.role, reason });
  return { ok: true };
}

/** Passar a administração: a pessoa vira admin master; com `leave`, quem passou sai — num lote só. */
async function passar(ctx, actor, fed, lista, ator, data) {
  if (!P.isMaster(ator) || ator.platform) falha('permission-denied', 'Só um admin master passa a administração.');
  const uid = texto(data.userId, 128);
  if (!uid || uid === actor.uid) falha('invalid-argument', 'Escolha outra pessoa.');
  const role = data.roleId ? cargo(fed, texto(data.roleId, 40)) : P.effectiveRoles(fed).find((r) => r.is_master);
  if (!role || !role.is_master) falha('invalid-argument', 'Escolha um cargo de admin master.');
  const batch = ctx.db.batch();
  await nomear(ctx, actor, fed, lista, ator, { userId: uid, roleId: role.id, termStart: data.termStart, termEnd: data.termEnd }, { batch });
  if (data.leave === true) batch.delete(staffRef(ctx, fed.id, actor.uid));
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_admin_transfer', { federation_id: fed.id, user_id: uid, role_id: role.id, leave: data.leave === true });
  return { ok: true };
}

const ACOES = { role_save: salvarCargo, role_delete: apagarCargo, appoint: nomear, extend: prorrogar, remove: tirar, transfer: passar };

async function staff(ctx, actor, data) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A equipe só é montada depois da aprovação da federação.');
  const lista = await equipe(ctx, fed.id);
  const ator = await atorNaEquipe(ctx, fed, actor, lista);
  if (!ator) falha('permission-denied', 'Você não está na equipe desta federação.');
  return acao(ctx, actor, fed, lista, ator, data);
}

/* --------------------------------------- acesso do admin da plataforma -- */

const hash = (v) => (v ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 24) : null);

async function adminAccess(ctx, actor, data, { ip = '', userAgent = '' } = {}) {
  if (!actor.isPlatformAdmin) falha('permission-denied', 'Só o admin da plataforma pede acesso a uma federação.');
  const fed = await f.federacao(ctx, data.federationId);
  const ref = ctx.db.collection(GRANTS).doc(`${fed.id}_${actor.uid}`);
  const registro = (extra) => ctx.db.collection('admin_access_logs').add({
    admin_uid: actor.uid, admin_email: actor.email || '', target_federation_id: fed.id, target_name_snapshot: texto(fed.name, 120),
    result: 'ok', ip_hash: hash(ip), user_agent: String(userAgent || '').slice(0, 200), at: new Date(ctx.now), at_ms: ctx.now, ...extra,
  });
  if (data.action === 'end') {
    await registro({ action: 'federation_access_end' });
    await ref.delete();
    return { ok: true };
  }
  if (data.action !== 'grant') falha('invalid-argument', 'Ação desconhecida.');
  const reasonCategory = texto(data.reason_category, 40);
  const reasonText = texto(data.reason_text, 500);
  const ticketRef = texto(data.ticket_ref, 200);
  const hours = Number(data.hours);
  if (!REASON_CATEGORIES.includes(reasonCategory)) falha('invalid-argument', 'Escolha a categoria do motivo.');
  if (reasonText.length < REASON_TEXT_MIN) falha('invalid-argument', `Descreva o motivo (mínimo ${REASON_TEXT_MIN} caracteres).`);
  if (!ACCESS_HOURS.includes(hours)) falha('invalid-argument', 'Escolha por quanto tempo.');
  const expires = ctx.now + hours * 3600000;
  // Registra PRIMEIRO: falhou o registro, o acesso não abre.
  const log = await registro({ action: 'federation_access', reason_category: reasonCategory, reason_text: reasonText, ticket_ref: ticketRef, hours, expires_ms: expires });
  await ref.set({
    federation_id: fed.id, federation_name: texto(fed.name, 120), admin_uid: actor.uid, admin_email: actor.email || '',
    reason_category: reasonCategory, reason_text: reasonText, ticket_ref: ticketRef, hours, granted_at_ms: ctx.now, expires_ms: expires, log_id: log.id,
  });
  return { ok: true, expires_ms: expires };
}

/* ----------------------------------------------------------- varredura -- */

async function sweep(ctx) {
  const snap = await ctx.db.collection(STAFF).where('term_end_ms', '>', 0).get();
  const porFed = new Map();
  const feds = new Map();
  let avisados = 0;
  let encerrados = 0;
  for (const d of snap.docs) {
    const s = { id: d.id, ...d.data() };
    const dias = Math.ceil((Number(s.term_end_ms) - ctx.now) / DIA_MS);
    if (dias > WARN_DAYS[0]) continue;
    /* eslint-disable no-await-in-loop */
    if (!feds.has(s.federation_id)) feds.set(s.federation_id, (await ctx.db.collection('federations').doc(s.federation_id).get()).data() || {});
    if (!porFed.has(s.federation_id)) porFed.set(s.federation_id, await equipe(ctx, s.federation_id));
    /* eslint-enable no-await-in-loop */
    const fed = { id: s.federation_id, ...feds.get(s.federation_id) };
    const lista = porFed.get(s.federation_id);
    const masters = lista.filter((x) => P.isMaster(x) && x.user_id !== s.user_id).map((x) => x.user_id);
    const batch = ctx.db.batch();
    const cargoNome = s.role_name || s.role;
    if (dias > 0) {
      const ja = Array.isArray(s.term_warned) ? s.term_warned : [];
      const marco = WARN_DAYS.filter((w) => dias <= w && !ja.includes(w)).pop();
      if (marco === undefined) continue;
      avisoCargo(ctx, batch, s.user_id, fed, tx('Seu mandato na {sigla} termina em {dias} dia(s)'), tx('O cargo de {cargo} vale até {fim}. Para continuar, alguém com o poder de equipe precisa prorrogar.'), { dias, cargo: cargoNome, fim: dataBR(s.term_end) });
      masters.forEach((uid) => avisoCargo(ctx, batch, uid, fed, tx('Mandato de {nome} termina em {dias} dia(s)'), tx('{cargo} da {sigla} até {fim}. Prorrogue ou nomeie outra pessoa.'), { nome: s.user_name || '', dias, cargo: cargoNome, fim: dataBR(s.term_end) }));
      batch.update(ctx.db.collection(STAFF).doc(s.id), { term_warned: [...new Set([...ja, ...WARN_DAYS.filter((w) => dias <= w)])] });
      avisados += 1;
    } else if (!P.isMaster(s) || masters.length) {
      batch.delete(ctx.db.collection(STAFF).doc(s.id));
      avisoCargo(ctx, batch, s.user_id, fed, tx('Seu mandato na {sigla} terminou'), tx('O cargo de {cargo} acabou em {fim}. Obrigado pelo trabalho!'), { cargo: cargoNome, fim: dataBR(s.term_end) });
      masters.forEach((uid) => avisoCargo(ctx, batch, uid, fed, tx('Mandato de {nome} terminou'), tx('{cargo} da {sigla} saiu da equipe em {fim}.'), { nome: s.user_name || '', cargo: cargoNome, fim: dataBR(s.term_end) }));
      porFed.set(s.federation_id, lista.filter((x) => x.user_id !== s.user_id));
      encerrados += 1;
    } else if (!s.term_held_notified) {
      // O último admin master não sai sozinho: a federação ficaria sem ninguém.
      avisoCargo(ctx, batch, s.user_id, fed, tx('Seu mandato na {sigla} venceu'), tx('Você continua como admin master porque é o único. Prorrogue o mandato ou nomeie outra pessoa.'), {});
      batch.update(ctx.db.collection(STAFF).doc(s.id), { term_held_notified: true });
    } else continue;
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  ctx.logger?.info?.(`federationStaff.sweep: ${avisados} aviso(s), ${encerrados} mandato(s) encerrado(s)`);
  return { avisados, encerrados };
}

module.exports = { staff, adminAccess, sweep, ACCESS_HOURS, WARN_DAYS };
