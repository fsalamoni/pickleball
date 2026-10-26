/**
 * SELEÇÃO DO CLUBE-ASSOCIAÇÃO (Bloco E3, flag `club_association`) — a convocação de
 * associados (atletas e comissão técnica) para um evento: campeonato, interclubes, amistoso.
 * Só o SERVIDOR grava `club_x/{clube}/callups` e `callup_members` (a regra é `write: if false`
 * para as duas espécies).
 *
 * Callable `clubSelection`:
 *  - diretoria esportiva (`sports`/`admin`): `list`, `members`, `save`, `publish`, `close`,
 *    `cancel`, `add`, `remove`, `member_update`;
 *  - qualquer membro do clube: `mine` (os convites dele) e `answer` (aceita ou recusa, com o
 *    tamanho do uniforme quando a convocação pede).
 *
 * A TRAVA DE PROTEÇÃO (`clubSelectionPolicy.callupGate`) vale no servidor: menor de idade só
 * é convocado com o responsável legal registrado e autorizando; e quem integra a comissão de
 * uma convocação com menores só entra com a proteção de menores em dia (`clubSafeguarding`).
 * A lista pública da delegação (`roster` na convocação) leva só os confirmados, sem uid, e o
 * menor aparece só com o primeiro nome e a inicial. A varredura vence os convites sem resposta
 * e encerra a convocação cujo evento já passou.
 */
const crypto = require('node:crypto');
const P = require('./clubSelectionPolicy.js');
const S = require('./clubSafeguardingPolicy.js');
const m = require('./federationMembership.js');
const a = require('./clubAssociation.js');
const sg = require('./clubSafeguarding.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const CALLUPS = 'callups';
const MEMBERS = 'callup_members';
const DIA = 86400000;
const LOTE = 400;
const ST = P.CALLUP_STATUS;
const IS = P.MEMBER_STATUS;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const linkGestao = (club) => `/clubes/${club.id}/gerir?aba=selecao`;
const linkMinha = (club) => `/clubes/${club.id}?aba=associacao`;
const rosterKey = (memberId) => crypto.createHash('sha256').update(String(memberId)).digest('hex').slice(0, 12);

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', `Confira os campos: ${Object.keys(r.errors).join(', ')}.`);
  return r.value;
}

async function contexto(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  const perms = await a.permsDe(ctx, club.id, actor.uid);
  return { club, perms, hoje: m.isoDateBR(ctx.now), equipe: perms.includes('sports') || perms.includes('admin'), rules: S.normalizeRules(club.association.safeguarding_rules) };
}

const exigeEquipe = (c, oQue) => { if (!c.equipe) falha('permission-denied', `Só a diretoria esportiva ${oQue}.`); };

async function ehMembro(ctx, club, uid) {
  return (await ctx.db.collection('club_members').doc(`${club.id}_${uid}`).get()).exists;
}

async function convocacao(ctx, c, callupId) {
  const ref = col(ctx, c.club.id, CALLUPS).doc(texto(callupId, 80));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Convocação não encontrada.');
  return { ref, cu: { id: snap.id, ...snap.data() } };
}

async function convitesDa(ctx, club, callupId) {
  const snap = await col(ctx, club.id, MEMBERS).where('callup_id', '==', callupId).get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

/** Refaz a lista pública (só os confirmados, sem uid), a contagem e a marca de "pública". */
async function refazer(ctx, club, cu) {
  const membros = await convitesDa(ctx, club, cu.id);
  const roster = membros.filter((x) => x.status === IS.ACCEPTED)
    .sort((x, y) => (x.role === y.role ? String(x.user_name).localeCompare(String(y.user_name)) : x.role === 'athlete' ? -1 : 1))
    .map((x) => ({ key: rosterKey(x.id), name: P.publicName(x.user_name, x.is_minor === true), role: x.role, label: texto(x.label, 60) }));
  const status = cu.status;
  await col(ctx, club.id, CALLUPS).doc(cu.id).update({ roster, counts: P.callupCounts(membros), pub: P.PUBLIC_STATUSES.includes(status), updated_at_ms: ctx.now });
  return membros;
}

async function avisarLote(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < lista.length; i += LOTE) {
    const batch = ctx.db.batch();
    lista.slice(i, i + LOTE).forEach((uid) => a.aviso(ctx, batch, uid, msg));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

const linhaDoConvite = (x) => ({
  id: x.id, user_id: x.user_id, name: x.user_name, photo_url: x.photo_url || '', role: x.role, label: x.label || '', status: x.status,
  expires_at_ms: x.expires_at_ms || null, uniform_size: x.uniform_size || '', docs_ok: x.docs_ok || {}, staff_note: x.staff_note || '', is_minor: x.is_minor === true,
});

/* ------------------------------------------------------------- diretoria -- */

async function list(ctx, actor, data, c) {
  exigeEquipe(c, 'vê as convocações');
  const snap = await col(ctx, c.club.id, CALLUPS).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => String(y.starts_at).localeCompare(String(x.starts_at)));
  return { ok: true, rows };
}

async function members(ctx, actor, data, c) {
  exigeEquipe(c, 'vê quem foi convocado');
  const { cu } = await convocacao(ctx, c, data.callupId);
  const lista = await convitesDa(ctx, c.club, cu.id);
  return { ok: true, callup: cu, rows: lista.map(linhaDoConvite) };
}

async function save(ctx, actor, data, c) {
  exigeEquipe(c, 'monta a convocação');
  const v = exigeValido(P.validateCallup(data));
  if (!data.callupId) {
    const ref = col(ctx, c.club.id, CALLUPS).doc();
    await ref.set({ club_id: c.club.id, ...v, status: ST.DRAFT, pub: false, roster: [], counts: P.callupCounts([]), created_by: actor.uid, created_by_name: texto(actor.name, 120), created_at_ms: ctx.now, updated_at_ms: ctx.now });
    await a.auditoria(ctx, actor, 'club_callup_create', { club_id: c.club.id, callup_id: ref.id });
    return { ok: true, callupId: ref.id };
  }
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status === ST.CANCELLED || cu.status === ST.CLOSED) falha('failed-precondition', 'Esta convocação já foi encerrada.');
  // Aberta, o que foi anunciado (vagas, menores, prazo) fica; a logística segue editável.
  const patch = cu.status === ST.DRAFT ? v : { title: v.title, event_name: v.event_name, place: v.place, starts_at: v.starts_at, ends_at: v.ends_at, travel_docs: v.travel_docs, collect_uniform: v.collect_uniform, message: v.message };
  await ref.update({ ...patch, updated_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_callup_update', { club_id: c.club.id, callup_id: cu.id });
  return { ok: true, callupId: cu.id };
}

async function publish(ctx, actor, data, c) {
  exigeEquipe(c, 'publica a convocação');
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status !== ST.DRAFT) falha('failed-precondition', 'Esta convocação já foi publicada.');
  exigeValido(P.validateCallup(cu));
  if (cu.starts_at < c.hoje) falha('failed-precondition', 'O evento já começou: ajuste a data.');
  await ref.update({ status: ST.OPEN, pub: true, published_at_ms: ctx.now, published_by: actor.uid, updated_at_ms: ctx.now });
  await a.auditoria(ctx, actor, 'club_callup_publish', { club_id: c.club.id, callup_id: cu.id });
  return { ok: true };
}

async function close(ctx, actor, data, c) {
  exigeEquipe(c, 'encerra a convocação');
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status !== ST.OPEN) falha('failed-precondition', 'Só uma convocação aberta pode ser encerrada.');
  await ref.update({ status: ST.CLOSED, closed_at_ms: ctx.now, updated_at_ms: ctx.now });
  // Quem ainda não respondeu não responde mais.
  const pend = (await convitesDa(ctx, c.club, cu.id)).filter((x) => x.status === IS.INVITED);
  if (pend.length) {
    const batch = ctx.db.batch();
    pend.forEach((x) => batch.update(x.ref, { status: IS.EXPIRED, updated_at_ms: ctx.now }));
    await batch.commit();
  }
  await refazer(ctx, c.club, { ...cu, status: ST.CLOSED });
  await a.auditoria(ctx, actor, 'club_callup_close', { club_id: c.club.id, callup_id: cu.id });
  return { ok: true };
}

async function cancel(ctx, actor, data, c) {
  exigeEquipe(c, 'cancela a convocação');
  const motivo = texto(data.reason, P.LIMITS.REASON);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  const { ref, cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status === ST.CANCELLED) falha('failed-precondition', 'Esta convocação já foi cancelada.');
  await ref.update({ status: ST.CANCELLED, pub: false, cancel_reason: motivo, cancelled_at_ms: ctx.now, updated_at_ms: ctx.now });
  const vivos = (await convitesDa(ctx, c.club, cu.id)).filter((x) => P.occupies(x));
  if (vivos.length) {
    const batch = ctx.db.batch();
    vivos.forEach((x) => batch.update(x.ref, { status: IS.CANCELLED, updated_at_ms: ctx.now }));
    await batch.commit();
    await avisarLote(ctx, vivos.map((x) => x.user_id), { title: tx('Convocação cancelada: {titulo}', { titulo: cu.title }), message: tx('O {clube} cancelou a convocação. Motivo: {motivo}', { clube: c.club.name, motivo }), link: linkMinha(c.club) });
  }
  await a.auditoria(ctx, actor, 'club_callup_cancel', { club_id: c.club.id, callup_id: cu.id, reason: motivo });
  return { ok: true, notified: vivos.length };
}

async function add(ctx, actor, data, c) {
  exigeEquipe(c, 'convoca');
  const { cu } = await convocacao(ctx, c, data.callupId);
  if (cu.status !== ST.OPEN) falha('failed-precondition', 'Publique a convocação antes de convocar.');
  const role = P.ROLES.includes(data.role) ? data.role : 'athlete';
  const uid = texto(data.userId, 128);
  if (!uid || !(await ehMembro(ctx, c.club, uid))) falha('failed-precondition', 'Só quem é do clube pode ser convocado.');
  const ref = col(ctx, c.club.id, MEMBERS).doc(P.memberDocId(cu.id, uid));
  const [ja, lista, perfil, menor, lib] = await Promise.all([
    ref.get(), convitesDa(ctx, c.club, cu.id), a.perfil(ctx, uid), col(ctx, c.club.id, 'minors').doc(uid).get(), sg.situacao(ctx, c.club, uid, c),
  ]);
  if (ja.exists && P.occupies(ja.data())) falha('already-exists', 'Esta pessoa já está convocada.');
  if (role === 'athlete' && P.slotsLeft(cu, lista) === 0) falha('failed-precondition', 'As vagas de atleta desta convocação acabaram.');
  const minor = S.isMinor(perfil.nascimento, c.hoje);
  const gate = P.callupGate({ role, minor, guardian: minor && menor.exists ? menor.data().guardian || null : null, cleared: lib.ok, involvesMinors: cu.involves_minors === true });
  if (!gate.ok) falha('failed-precondition', gate.message);
  const doc = {
    club_id: c.club.id, callup_id: cu.id, callup_title: cu.title, event_name: cu.event_name, starts_at: cu.starts_at, user_id: uid, user_name: perfil.nome, photo_url: perfil.foto,
    role, label: texto(data.label, P.LIMITS.LABEL), is_minor: minor, status: IS.INVITED, expires_at_ms: ctx.now + (cu.accept_days || 7) * DIA, invited_by: actor.uid,
    uniform_size: '', docs_ok: {}, staff_note: '', created_at_ms: ctx.now, updated_at_ms: ctx.now,
  };
  const batch = ctx.db.batch();
  batch.set(ref, doc);
  a.aviso(ctx, batch, uid, {
    title: tx('Convocação: {titulo}', { titulo: cu.title }),
    message: tx('O {clube} convocou você para {evento}. Responda até {data} em Minha filiação.', { clube: c.club.name, evento: cu.event_name, data: br(m.isoDateBR(doc.expires_at_ms)) }),
    link: linkMinha(c.club),
  });
  await batch.commit();
  await refazer(ctx, c.club, cu);
  await a.auditoria(ctx, actor, 'club_callup_add', { club_id: c.club.id, callup_id: cu.id, user_id: uid, role });
  return { ok: true, memberId: ref.id };
}

async function conviteDe(ctx, c, memberId) {
  const ref = col(ctx, c.club.id, MEMBERS).doc(texto(memberId, 240));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Convite não encontrado.');
  return { ref, inv: { id: snap.id, ...snap.data() } };
}

async function remove(ctx, actor, data, c) {
  exigeEquipe(c, 'retira alguém da convocação');
  const motivo = texto(data.reason, P.LIMITS.REASON);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  const { ref, inv } = await conviteDe(ctx, c, data.memberId);
  if (!P.occupies(inv)) falha('failed-precondition', 'Este convite já não está valendo.');
  const { cu } = await convocacao(ctx, c, inv.callup_id);
  await ref.update({ status: IS.CANCELLED, removed_reason: motivo, updated_at_ms: ctx.now });
  const batch = ctx.db.batch();
  a.aviso(ctx, batch, inv.user_id, { title: tx('Convocação retirada: {titulo}', { titulo: cu.title }), message: tx('O {clube} retirou você da convocação. Motivo: {motivo}', { clube: c.club.name, motivo }), link: linkMinha(c.club) });
  await batch.commit();
  await refazer(ctx, c.club, cu);
  await a.auditoria(ctx, actor, 'club_callup_remove', { club_id: c.club.id, callup_id: cu.id, user_id: inv.user_id, reason: motivo });
  return { ok: true };
}

async function memberUpdate(ctx, actor, data, c) {
  exigeEquipe(c, 'confere os documentos');
  const { ref, inv } = await conviteDe(ctx, c, data.memberId);
  const { cu } = await convocacao(ctx, c, inv.callup_id);
  const docs_ok = {};
  P.TRAVEL_DOCS.forEach((d) => { if ((cu.travel_docs || []).includes(d)) docs_ok[d] = Boolean((data.docs_ok || {})[d]); });
  await ref.update({ docs_ok, staff_note: texto(data.staff_note, 300), updated_at_ms: ctx.now });
  return { ok: true };
}

/* ---------------------------------------------------------------- pessoa -- */

async function mine(ctx, actor, data, c) {
  const snap = await col(ctx, c.club.id, MEMBERS).where('user_id', '==', actor.uid).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => x.status !== IS.CANCELLED || x.starts_at >= c.hoje)
    .sort((x, y) => String(y.starts_at).localeCompare(String(x.starts_at))).slice(0, 20);
  const cus = await Promise.all([...new Set(rows.map((x) => x.callup_id))].map((id) => col(ctx, c.club.id, CALLUPS).doc(id).get()));
  const porId = new Map(cus.filter((s) => s.exists).map((s) => [s.id, s.data()]));
  return {
    ok: true,
    member: true,
    rows: rows.map((x) => {
      const cu = porId.get(x.callup_id) || {};
      return {
        id: x.id, callup_id: x.callup_id, title: x.callup_title, event_name: x.event_name, place: cu.place || '', starts_at: x.starts_at, ends_at: cu.ends_at || '', role: x.role, label: x.label || '',
        status: x.status, expires_at_ms: x.expires_at_ms, uniform_size: x.uniform_size || '', collect_uniform: cu.collect_uniform === true, travel_docs: cu.travel_docs || [],
        docs_ok: x.docs_ok || {}, message: cu.message || '', open: P.inviteOpen(x, ctx.now) && cu.status === ST.OPEN,
      };
    }),
  };
}

async function answer(ctx, actor, data, c) {
  const { ref, inv } = await conviteDe(ctx, c, data.memberId);
  if (inv.user_id !== actor.uid) falha('permission-denied', 'Este convite não é seu.');
  if (inv.status !== IS.INVITED) falha('failed-precondition', 'Este convite já foi respondido.');
  if (Number(inv.expires_at_ms) <= ctx.now) falha('failed-precondition', 'O prazo para responder venceu.');
  const { cu } = await convocacao(ctx, c, inv.callup_id);
  if (cu.status !== ST.OPEN) falha('failed-precondition', 'Esta convocação não está mais aberta.');
  const aceitou = data.accept === true;
  const patch = { status: aceitou ? IS.ACCEPTED : IS.DECLINED, answered_at_ms: ctx.now, updated_at_ms: ctx.now };
  if (aceitou && cu.collect_uniform) {
    if (!P.UNIFORM_SIZES.includes(data.uniform_size)) falha('invalid-argument', 'Escolha o tamanho do uniforme.');
    patch.uniform_size = data.uniform_size;
  }
  await ref.update(patch);
  await refazer(ctx, c.club, cu);
  const batch = ctx.db.batch();
  (await a.quemTem(ctx, c.club.id, 'sports')).filter((u) => u !== actor.uid).forEach((u) => a.aviso(ctx, batch, u, {
    title: aceitou ? tx('{nome} confirmou a convocação', { nome: inv.user_name }) : tx('{nome} recusou a convocação', { nome: inv.user_name }),
    message: tx('{titulo}: veja quem já respondeu na Seleção.', { titulo: cu.title }),
    link: linkGestao(c.club),
  }));
  await batch.commit();
  await a.auditoria(ctx, actor, aceitou ? 'club_callup_accept' : 'club_callup_decline', { club_id: c.club.id, callup_id: cu.id });
  return { ok: true };
}

const ROTAS = { list, members, save, publish, close, cancel, add, remove, member_update: memberUpdate, mine, answer };

async function selection(ctx, actor, data = {}) {
  const fn = ROTAS[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  if (['mine', 'answer'].includes(data.action) && !(await ehMembro(ctx, c.club, actor.uid))) {
    if (data.action === 'mine') return { ok: true, member: false, rows: [] }; // quem não é do clube não tem convite: a tela some, sem erro
    falha('failed-precondition', 'Só quem é do clube responde convocações.');
  }
  return fn(ctx, actor, data, c);
}

/* -------------------------------------------------------------- varredura -- */

/** Diária: vence os convites sem resposta e encerra a convocação cujo evento já passou. */
async function sweep(ctx) {
  if (!(await a.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const conta = { expired: 0, closed: 0 };
  const clubes = await ctx.db.collection('clubs').where('association.enabled', '==', true).get();
  for (const cd of clubes.docs) {
    const club = { id: cd.id, ...cd.data() };
    // eslint-disable-next-line no-await-in-loop
    const abertas = await col(ctx, club.id, CALLUPS).where('status', '==', ST.OPEN).get();
    for (const d of abertas.docs) {
      const cu = { id: d.id, ...d.data() };
      // eslint-disable-next-line no-await-in-loop
      const convites = await convitesDa(ctx, club, cu.id);
      const vencidos = convites.filter((x) => x.status === IS.INVITED && Number(x.expires_at_ms) <= ctx.now);
      const fim = cu.ends_at || cu.starts_at;
      const passou = Boolean(fim) && fim < hoje;
      if (vencidos.length || passou) {
        const batch = ctx.db.batch();
        vencidos.forEach((x) => batch.update(x.ref, { status: IS.EXPIRED, updated_at_ms: ctx.now }));
        if (passou) batch.update(d.ref, { status: ST.CLOSED, closed_at_ms: ctx.now });
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
        // eslint-disable-next-line no-await-in-loop
        await refazer(ctx, club, { ...cu, status: passou ? ST.CLOSED : cu.status });
        conta.expired += vencidos.length;
        if (passou) conta.closed += 1;
      }
    }
  }
  if (ctx.logger) ctx.logger.info('Clubes: seleção.', conta);
  return conta;
}

module.exports = { selection, sweep, CALLUPS, MEMBERS };
