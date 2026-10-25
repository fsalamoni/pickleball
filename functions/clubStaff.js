/**
 * DIRETORIA DO CLUBE — cargos e mandatos (só o servidor grava `club_x/{clube}/staff`
 * e a lista de cargos em `club_x/{clube}/roles/list`).
 *
 *  - `staff` (callable `clubStaff`): `role_save`/`role_delete` (só quem administra
 *    o clube ou o cargo master), `appoint`, `extend` (prorrogação, com motivo e
 *    histórico) e `remove` (inclusive sair). Quem tem `staff` sem ser master só
 *    mexe fora dos cargos master, nunca em si mesmo e só dá as permissões que
 *    tem. A pessoa nomeada precisa ser MEMBRO do clube (a regra e o servidor só
 *    dão poder a quem ainda é membro).
 *  - `sweep` (diária, chamada pela varredura da associação): avisa 30/7/1 dias
 *    antes do fim do mandato e encerra o vencido, avisando quem tem `staff`.
 *
 * Quem ADMINISTRA o clube (`club_members.role == 'admin'`) age como master sem
 * precisar de cargo. A conta pura é `clubStaffPolicy.js` (cópia do cliente).
 */
const crypto = require('node:crypto');
const P = require('./clubStaffPolicy.js');
const a = require('./clubAssociation.js');
const m = require('./federationMembership.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const WARN_DAYS = Object.freeze([30, 7, 1]);
const HISTORY_MAX = 20;
const DIA_MS = 86400000;

const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const staffRef = (ctx, clubId, uid) => col(ctx, clubId, 'staff').doc(uid);
const rolesRef = (ctx, clubId) => col(ctx, clubId, 'roles').doc('list');

async function equipe(ctx, clubId) {
  const snap = await col(ctx, clubId, 'staff').get();
  return snap.docs.map((d) => ({ id: d.id, user_id: d.id, ...d.data() }));
}

async function cargos(ctx, clubId) {
  const snap = await rolesRef(ctx, clubId).get();
  return P.effectiveRoles(snap.exists ? snap.data().roles : null);
}

/** O ator como "pessoa da diretoria": quem administra o clube é master; os demais vêm do cargo e só valem sendo membros. */
async function atorNaEquipe(ctx, clubId, actor, lista) {
  const mem = await ctx.db.collection('club_members').doc(`${clubId}_${actor.uid}`).get();
  if (!mem.exists) return null;
  if (mem.data().role === 'admin') return { user_id: actor.uid, is_master: true, perms: [...P.ALL], club_admin: true };
  return lista.find((s) => s.user_id === actor.uid) || null;
}

const nomeDaConta = (u = {}) => texto(u.platform_name, 120) || texto(u.full_name, 120) || texto(u.name, 120) || '';

function avisoCargo(ctx, batch, uid, club, title, message, params = {}) {
  a.aviso(ctx, batch, uid, { title: tx(title.$t, { clube: club.name, ...params }), message: tx(message.$t, { clube: club.name, ...params }), link: `/clubes/${club.id}/gerir?aba=equipe` });
}

const fimPadrao = (role, inicio) => (role.term_months ? m.addMonthsISO(inicio, role.term_months) : '');

function docDoCargo(ctx, { club, uid, nome, foto, role, termStart, termEnd, anterior, por }) {
  return {
    club_id: club.id, user_id: uid, user_name: nome, ...(foto ? { photo_url: foto } : {}),
    role: role.id, role_id: role.id, role_name: role.name, perms: [...role.perms], is_master: Boolean(role.is_master),
    term_start: termStart, term_end: termEnd || '', term_end_ms: termEnd ? m.endOfDayBrMs(termEnd) : 0,
    term_history: (anterior && Array.isArray(anterior.term_history) ? anterior.term_history : []).slice(-HISTORY_MAX),
    term_warned: [],
    added_by: (anterior && anterior.added_by) || por,
    created_at: (anterior && anterior.created_at) || ctx.Timestamp.fromMillis(ctx.now),
    updated_at: ctx.Timestamp.fromMillis(ctx.now),
  };
}

/* ------------------------------------------------------------ cargos -- */

function novoIdDeCargo(nome, existentes) {
  const base = String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'cargo';
  let id = base.length >= 2 ? base : `cargo-${base}`;
  while (existentes.includes(id)) id = `${base.slice(0, 30)}-${crypto.randomBytes(2).toString('hex')}`;
  return id;
}

async function salvarCargo(ctx, actor, club, lista, ator, data) {
  if (!P.isMaster(ator)) falha('permission-denied', 'Só quem administra o clube ou o cargo de presidência monta os cargos.');
  const v = P.validateRole(data.role || {});
  if (!v.ok) falha('invalid-argument', Object.values(v.errors)[0]);
  const roles = (await cargos(ctx, club.id)).map((r) => ({ ...r, perms: [...r.perms] }));
  let role;
  if (v.value.id) {
    const i = roles.findIndex((r) => r.id === v.value.id);
    if (i < 0) falha('not-found', 'Cargo não encontrado. Atualize a página.');
    role = { ...v.value };
    roles[i] = role;
  } else {
    if (roles.length >= P.ROLES_MAX) falha('failed-precondition', `No máximo ${P.ROLES_MAX} cargos.`);
    role = { ...v.value, id: novoIdDeCargo(v.value.name, roles.map((r) => r.id)) };
    roles.push(role);
  }
  const batch = ctx.db.batch();
  batch.set(rolesRef(ctx, club.id), { roles, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  // Quem está no cargo leva a cópia nova das permissões (é o que a regra lê).
  lista.filter((s) => (s.role_id || s.role) === role.id).forEach((s) => {
    batch.update(staffRef(ctx, club.id, s.user_id), { role_id: role.id, role_name: role.name, perms: [...role.perms], is_master: role.is_master, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  });
  await batch.commit();
  await a.auditoria(ctx, actor, 'club_role_save', { club_id: club.id, role_id: role.id, perms: role.perms, is_master: role.is_master });
  return { ok: true, roleId: role.id };
}

async function apagarCargo(ctx, actor, club, lista, ator, data) {
  if (!P.isMaster(ator)) falha('permission-denied', 'Só quem administra o clube ou o cargo de presidência monta os cargos.');
  const id = texto(data.roleId, 40);
  const roles = await cargos(ctx, club.id);
  if (!roles.some((r) => r.id === id)) falha('not-found', 'Cargo não encontrado. Atualize a página.');
  if (lista.some((s) => (s.role_id || s.role) === id)) falha('failed-precondition', 'Há gente neste cargo. Mude essas pessoas de cargo antes.');
  await rolesRef(ctx, club.id).set({ roles: roles.filter((r) => r.id !== id), updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await a.auditoria(ctx, actor, 'club_role_delete', { club_id: club.id, role_id: id });
  return { ok: true };
}

/* ------------------------------------------------------------ pessoas -- */

async function nomear(ctx, actor, club, lista, ator, data) {
  const uid = texto(data.userId, 128);
  if (!uid) falha('invalid-argument', 'Escolha a pessoa.');
  const role = (await cargos(ctx, club.id)).find((r) => r.id === texto(data.roleId, 40));
  if (!role) falha('not-found', 'Cargo não encontrado. Atualize a página.');
  const anterior = lista.find((s) => s.user_id === uid) || null;
  if (!P.allowed({ actor: ator, target: anterior, role, now: ctx.now })) falha('permission-denied', 'Você não pode nomear para este cargo.');
  const mem = await ctx.db.collection('club_members').doc(`${club.id}_${uid}`).get();
  if (!mem.exists) falha('failed-precondition', 'A pessoa precisa ser membro do clube para ter um cargo.');
  const hoje = m.isoDateBR(ctx.now);
  const termStart = texto(data.termStart, 10) || hoje;
  const termEnd = data.termEnd === undefined ? fimPadrao(role, termStart) : texto(data.termEnd, 10);
  const vt = P.validateTerm({ term_start: termStart, term_end: termEnd });
  if (!vt.ok) falha('invalid-argument', Object.values(vt.errors)[0]);
  const conta = await ctx.db.collection('users').doc(uid).get();
  const u = conta.exists ? conta.data() : {};
  const batch = ctx.db.batch();
  batch.set(staffRef(ctx, club.id, uid), docDoCargo(ctx, {
    club, uid, nome: nomeDaConta(u) || mem.data().user_name || texto(data.userName, 120), foto: texto(u.photo_url, 500) || texto(mem.data().photo_url, 500), role, termStart, termEnd, anterior, por: actor.uid,
  }));
  if (uid !== actor.uid) {
    avisoCargo(ctx, batch, uid, club, tx('Você é {cargo} do {clube}'),
      termEnd ? tx('Mandato de {inicio} a {fim}. A Central do clube abre o que o cargo permite.') : tx('Mandato a partir de {inicio}, sem data de fim. A Central do clube abre o que o cargo permite.'),
      { cargo: role.name, inicio: dataBR(termStart), fim: dataBR(termEnd) });
  }
  await batch.commit();
  await a.auditoria(ctx, actor, anterior ? 'club_staff_change' : 'club_staff_appoint', { club_id: club.id, user_id: uid, role_id: role.id, term_start: termStart, term_end: termEnd });
  return { ok: true };
}

async function prorrogar(ctx, actor, club, lista, ator, data) {
  const uid = texto(data.userId, 128);
  const alvo = lista.find((s) => s.user_id === uid);
  if (!alvo) falha('not-found', 'Essa pessoa não está na diretoria.');
  const role = (await cargos(ctx, club.id)).find((r) => r.id === (alvo.role_id || alvo.role)) || null;
  if (!P.allowed({ actor: ator, target: alvo, role, now: ctx.now })) falha('permission-denied', 'Você não pode prorrogar este mandato.');
  const termEnd = texto(data.termEnd, 10);
  const reason = texto(data.reason, 300);
  if (reason.length < 3) falha('invalid-argument', 'Diga o motivo da prorrogação.');
  const vt = P.validateTerm({ term_start: alvo.term_start || m.isoDateBR(ctx.now), term_end: termEnd });
  if (!vt.ok) falha('invalid-argument', Object.values(vt.errors)[0]);
  if (termEnd && alvo.term_end && termEnd <= alvo.term_end) falha('invalid-argument', 'Prorrogar é estender: escolha uma data depois do fim atual.');
  const historico = [...(Array.isArray(alvo.term_history) ? alvo.term_history : []), { at_ms: ctx.now, by: actor.uid, from: alvo.term_end || '', to: termEnd, reason }].slice(-HISTORY_MAX);
  const batch = ctx.db.batch();
  batch.update(staffRef(ctx, club.id, uid), {
    term_end: termEnd, term_end_ms: termEnd ? m.endOfDayBrMs(termEnd) : 0, term_history: historico, term_warned: [], updated_at: ctx.Timestamp.fromMillis(ctx.now),
  });
  if (uid !== actor.uid) {
    avisoCargo(ctx, batch, uid, club, tx('Seu mandato no {clube} foi prorrogado'), termEnd ? tx('Agora vale até {fim}. Motivo: {motivo}.') : tx('Agora não tem data de fim. Motivo: {motivo}.'), { fim: dataBR(termEnd), motivo: reason });
  }
  await batch.commit();
  await a.auditoria(ctx, actor, 'club_staff_extend', { club_id: club.id, user_id: uid, from: alvo.term_end || '', to: termEnd, reason });
  return { ok: true };
}

async function tirar(ctx, actor, club, lista, ator, data) {
  const uid = texto(data.userId, 128);
  const alvo = lista.find((s) => s.user_id === uid);
  if (!alvo) falha('not-found', 'Essa pessoa não está na diretoria.');
  const proprio = uid === actor.uid;
  if (!proprio) {
    const role = (await cargos(ctx, club.id)).find((r) => r.id === (alvo.role_id || alvo.role)) || null;
    if (!P.allowed({ actor: ator, target: alvo, role, now: ctx.now })) falha('permission-denied', 'Você não pode tirar esta pessoa da diretoria.');
  }
  const reason = texto(data.reason, 300);
  const batch = ctx.db.batch();
  batch.delete(staffRef(ctx, club.id, uid));
  if (!proprio) avisoCargo(ctx, batch, uid, club, tx('Você saiu da diretoria do {clube}'), reason ? tx('Motivo: {motivo}.') : tx('Quem administra o clube tirou você da diretoria.'), { motivo: reason });
  await batch.commit();
  await a.auditoria(ctx, actor, proprio ? 'club_staff_leave' : 'club_staff_remove', { club_id: club.id, user_id: uid, role_id: alvo.role_id || alvo.role, reason });
  return { ok: true };
}

const ACOES = { role_save: salvarCargo, role_delete: apagarCargo, appoint: nomear, extend: prorrogar, remove: tirar };

async function staff(ctx, actor, data) {
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  if (!(await a.flagLigada(ctx))) falha('failed-precondition', 'A associação de clubes não está ligada nesta plataforma.');
  const club = await a.clube(ctx, data.clubId);
  const lista = await equipe(ctx, club.id);
  const ator = await atorNaEquipe(ctx, club.id, actor, lista);
  if (!ator) falha('permission-denied', 'Você não está na diretoria deste clube.');
  return acao(ctx, actor, club, lista, ator, data);
}

/* ----------------------------------------------------------- varredura -- */

/** Avisa 30/7/1 dias antes do fim e encerra o mandato vencido (quem tem `staff` e o próprio são avisados). */
async function sweep(ctx) {
  const clubes = await ctx.db.collection('clubs').where('association.enabled', '==', true).get();
  let avisados = 0; let encerrados = 0;
  for (const cd of clubes.docs) {
    const club = { id: cd.id, ...cd.data() };
    /* eslint-disable no-await-in-loop */
    const lista = (await equipe(ctx, club.id)).filter((s) => Number(s.term_end_ms) > 0);
    const gestores = lista.length ? await a.quemTem(ctx, club.id, 'staff') : [];
    /* eslint-enable no-await-in-loop */
    for (const s of lista) {
      const dias = Math.ceil((Number(s.term_end_ms) - ctx.now) / DIA_MS);
      if (dias > WARN_DAYS[0]) continue;
      const batch = ctx.db.batch();
      const cargoNome = s.role_name || s.role;
      const outros = gestores.filter((g) => g !== s.user_id);
      if (dias > 0) {
        const ja = Array.isArray(s.term_warned) ? s.term_warned : [];
        const marco = WARN_DAYS.filter((w) => dias <= w && !ja.includes(w)).pop();
        if (marco === undefined) continue;
        avisoCargo(ctx, batch, s.user_id, club, tx('Seu mandato no {clube} termina em {dias} dia(s)'), tx('O cargo de {cargo} vale até {fim}. Para continuar, a diretoria precisa prorrogar.'), { dias, cargo: cargoNome, fim: dataBR(s.term_end) });
        outros.forEach((uid) => avisoCargo(ctx, batch, uid, club, tx('Mandato de {nome} termina em {dias} dia(s)'), tx('{cargo} do {clube} até {fim}. Prorrogue ou nomeie outra pessoa.'), { nome: s.user_name || '', dias, cargo: cargoNome, fim: dataBR(s.term_end) }));
        batch.update(staffRef(ctx, club.id, s.user_id), { term_warned: [...new Set([...ja, ...WARN_DAYS.filter((w) => dias <= w)])] });
        avisados += 1;
      } else {
        batch.delete(staffRef(ctx, club.id, s.user_id));
        avisoCargo(ctx, batch, s.user_id, club, tx('Seu mandato no {clube} terminou'), tx('O cargo de {cargo} acabou em {fim}. Obrigado pelo trabalho!'), { cargo: cargoNome, fim: dataBR(s.term_end) });
        outros.forEach((uid) => avisoCargo(ctx, batch, uid, club, tx('Mandato de {nome} terminou'), tx('{cargo} do {clube} saiu da diretoria em {fim}.'), { nome: s.user_name || '', cargo: cargoNome, fim: dataBR(s.term_end) }));
        encerrados += 1;
      }
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
    }
  }
  if (ctx.logger) ctx.logger.info(`clubStaff.sweep: ${avisados} aviso(s), ${encerrados} mandato(s) encerrado(s)`);
  return { avisados, encerrados };
}

module.exports = { staff, sweep, WARN_DAYS };
