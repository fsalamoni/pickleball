/**
 * TRANSFERÊNCIAS do filiado (PR 3, D9) — só o SERVIDOR grava `federation_transfers`.
 *
 *  - `request` (a pessoa, ou o responsável do dependente): troca de CLUBE
 *    representado (a própria federação decide) ou de FEDERAÇÃO (a atual
 *    LIBERA; sem resposta até o prazo — `rules.transfer_release_days`, 15 —
 *    a varredura libera sozinha). Carência entre transferências
 *    (`rules.transfer_cooldown_days`, 90). Os pontos ficam onde foram feitos.
 *  - `approve` / `reject` (secretaria da federação atual): clube → muda o
 *    clube na filiação; federação → a filiação atual é ENCERRADA (código deixa
 *    de verificar) e a pessoa pede a filiação na nova, que a aceita porque a
 *    antiga já não está ativa.
 *  - `cancel` (a pessoa) enquanto pendente ou aguardando homologação.
 *  - Bloco 6: troca entre duas estaduais da MESMA confederação — liberada pela
 *    antiga, passa a `homologation`; `homologate` / `deny` (secretaria ou
 *    admin da confederação). Negada, a filiação antiga segue como estava.
 *  - `sweep` (diária, chamada por `federationMembershipSweep`): libera as de
 *    federação vencidas e homologa as que passaram do prazo da confederação.
 */
const f = require('./federations.js');
const m = require('./federationMembership.js');
const N = require('./federationNationalPolicy.js');
const { tx } = require('./avisoI18n.js');

const COOLDOWN_DAYS = 90;
const RELEASE_DAYS = 15;
const cooldown = (fed) => { const n = Number(fed && fed.rules && fed.rules.transfer_cooldown_days); return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : COOLDOWN_DAYS; };
const releaseDays = (fed) => { const n = Number(fed && fed.rules && fed.rules.transfer_release_days); return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : RELEASE_DAYS; };
const addDays = (iso, dias) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + dias); return m.isoDateBR(d.getTime() + 3 * 3600000); };

async function carregar(ctx, transferId) {
  const snap = await ctx.db.collection(f.C.transfers).doc(f.texto(transferId, 80)).get();
  if (!snap.exists) f.falha('not-found', 'Transferência não encontrada.');
  return { ref: snap.ref, tr: { id: snap.id, ...snap.data() } };
}

/**
 * Aprova (gente ou varredura). Troca de FEDERAÇÃO entre duas estaduais da
 * mesma confederação (Bloco 6): a liberação da antiga não encerra nada —
 * a transferência passa a esperar a HOMOLOGAÇÃO da confederação (prazo nas
 * regras dela; silêncio = homologada pela varredura).
 */
async function aprovar(ctx, { ref, tr }, { by, auto = false }) {
  if (tr.kind === 'federation' && tr.status === 'pending') {
    const fed = await f.federacao(ctx, tr.federation_id);
    const nb = N.nationalBodyOf(fed);
    if (nb) {
      const [para, conf] = await Promise.all([f.federacao(ctx, tr.to_federation_id).catch(() => null), f.federacao(ctx, nb.id).catch(() => null)]);
      if (N.needsHomologation(fed, para, conf)) return pedirHomologacao(ctx, { ref, tr, fed, conf }, { by, auto });
    }
  }
  return efetivar(ctx, { ref, tr }, { by, auto });
}

async function pedirHomologacao(ctx, { ref, tr, fed, conf }, { by, auto }) {
  const prazo = N.homologationDeadline(m.isoDateBR(ctx.now), conf);
  const batch = ctx.db.batch();
  batch.update(ref, {
    status: 'homologation', released_by: by, released_at_ms: ctx.now, auto_released: auto,
    homologation_by: conf.id, homologation_conf_acronym: conf.acronym || conf.name || '', homologation_deadline: prazo, updated_at_ms: ctx.now,
  });
  (await f.staffIds(ctx, conf.id, 'members')).forEach((sid) => f.aviso(ctx, batch, sid, {
    title: tx('Transferência para homologar: {de} → {para}', { de: fed.acronym, para: tr.to_federation_acronym }),
    message: tx('{nome} foi liberado(a) pela {de}. Homologue ou negue até {prazo}; sem resposta, a homologação é automática.', { nome: tr.user_name, de: fed.acronym, prazo: prazo.split('-').reverse().join('/') }),
    link: `/federacoes/${conf.id}/gerir?aba=rede-homologacoes`,
  }));
  f.aviso(ctx, batch, f.destinatario(tr), { title: tx('{sigla} liberou sua transferência', { sigla: fed.acronym }), message: tx('Agora a {conf} homologa a troca (até {prazo}). Você recebe um aviso quando ela decidir.', { conf: conf.acronym || conf.name, prazo: prazo.split('-').reverse().join('/') }), link: '/perfil?secao=federacoes' });
  await batch.commit();
}

/** O efeito da transferência aprovada (ou homologada): troca o clube, ou encerra a filiação para a pessoa pedir na nova. */
async function efetivar(ctx, { ref, tr }, { by, auto = false, homologated = false }) {
  const fed = await f.federacao(ctx, tr.federation_id);
  const hoje = m.isoDateBR(ctx.now);
  const memberRef = ctx.db.collection(f.C.members).doc(tr.member_id);
  const ms = await memberRef.get();
  const member = ms.exists ? { id: ms.id, ...ms.data() } : null;
  const batch = ctx.db.batch();
  batch.update(ref, homologated
    ? { status: 'approved', homologated_by: by, homologated_at_ms: ctx.now, auto_homologated: auto, updated_at_ms: ctx.now }
    : { status: 'approved', decided_by: by, decided_at_ms: ctx.now, auto_released: auto, updated_at_ms: ctx.now });
  const destino = f.destinatario(tr);
  if (tr.kind === 'club') {
    if (member) batch.update(memberRef, { represented_club_id: tr.to_club_id || null, represented_club_name: tr.to_club_name || '', last_transfer_at: hoje, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
    f.aviso(ctx, batch, destino, { title: tx('Transferência aprovada — {sigla}', { sigla: fed.acronym }), message: tr.to_club_name ? tx('Você agora representa o clube {clube}.', { clube: tr.to_club_name }) : tx('Você agora está sem clube na federação.'), link: '/perfil?secao=federacoes' });
  } else {
    if (member && f.LIVE.includes(member.status)) {
      f.encerrarFiliacao(ctx, batch, memberRef, member, { status: 'cancelled', cancelled_at_ms: ctx.now, cancelled_by: by, released_to_federation_id: tr.to_federation_id, last_transfer_at: hoje });
      const abertas = await ctx.db.collection(f.C.charges).where('member_id', '==', memberRef.id).get();
      abertas.docs.filter((d) => ['open', 'declared'].includes(d.data().status)).forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at_ms: ctx.now }));
    }
    f.aviso(ctx, batch, destino, homologated
      ? { title: tx('{conf} homologou sua transferência', { conf: tr.homologation_conf_acronym || '' }), message: tx('Agora peça a filiação na {nova}. Seus pontos no ranking da {sigla} ficam lá.', { nova: tr.to_federation_acronym || tr.to_federation_name, sigla: fed.acronym }), link: `/federacoes/${tr.to_federation_id}/filiar` }
      : { title: tx('{sigla} liberou sua transferência', { sigla: fed.acronym }), message: tx('Agora peça a filiação na {nova}. Seus pontos no ranking da {sigla} ficam lá.', { nova: tr.to_federation_acronym || tr.to_federation_name, sigla: fed.acronym }), link: `/federacoes/${tr.to_federation_id}/filiar` });
  }
  await batch.commit();
}

async function transfer(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) f.falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const acao = f.texto(data.action, 20);
  const hoje = m.isoDateBR(ctx.now);

  if (acao === 'request') {
    const fed = await f.federacao(ctx, data.federationId);
    const memberId = f.texto(data.memberId, 120) || `${fed.id}_${actor.uid}`;
    const ms = await ctx.db.collection(f.C.members).doc(memberId).get();
    if (!ms.exists || ms.data().federation_id !== fed.id) f.falha('not-found', 'Filiação não encontrada.');
    const member = { id: ms.id, ...ms.data() };
    if (member.user_id !== actor.uid && member.guardian_uid !== actor.uid) f.falha('permission-denied', 'Esta filiação não é sua.');
    if (!f.LIVE.includes(member.status)) f.falha('failed-precondition', 'Só quem tem filiação nesta federação pede transferência.');
    const pendentes = await ctx.db.collection(f.C.transfers).where('member_id', '==', member.id).get();
    if (pendentes.docs.some((d) => ['pending', 'homologation'].includes(d.data().status))) f.falha('already-exists', 'Já existe uma transferência aguardando resposta.');
    const dias = cooldown(fed);
    if (dias > 0 && member.last_transfer_at && m.daysBetween(String(member.last_transfer_at), hoje) < dias) f.falha('failed-precondition', `Carência de ${dias} dias desde a última transferência.`);
    const kind = f.texto(data.kind, 20);
    const doc = {
      federation_id: fed.id, federation_acronym: fed.acronym || '', member_id: member.id, user_id: member.user_id || null, guardian_uid: member.guardian_uid || null,
      user_name: member.user_name || '', kind, reason: f.texto(data.reason, 500), status: 'pending', requested_by: actor.uid,
      requested_at: hoje, requested_at_ms: ctx.now, updated_at_ms: ctx.now, deadline: null,
      to_club_id: null, to_club_name: '', to_federation_id: null, to_federation_name: '', to_federation_acronym: '',
    };
    if (kind === 'club') {
      doc.to_club_id = f.texto(data.toClubId, 80) || null;
      doc.to_club_name = f.texto(data.toClubName, 120);
      if ((doc.to_club_id || null) === (member.represented_club_id || null)) f.falha('invalid-argument', 'Você já representa esse clube.');
    } else if (kind === 'federation') {
      const nova = await f.federacao(ctx, data.toFederationId);
      if (nova.id === fed.id) f.falha('invalid-argument', 'Escolha outra federação.');
      if (!f.publicada(nova)) f.falha('failed-precondition', 'A federação de destino não está recebendo filiações.');
      Object.assign(doc, { to_federation_id: nova.id, to_federation_name: nova.name, to_federation_acronym: nova.acronym || '', deadline: addDays(hoje, releaseDays(fed)) });
    } else f.falha('invalid-argument', 'Tipo de transferência desconhecido.');
    const ref = ctx.db.collection(f.C.transfers).doc();
    const batch = ctx.db.batch();
    batch.set(ref, doc);
    (await f.staffIds(ctx, fed.id, 'members')).forEach((sid) => f.aviso(ctx, batch, sid, {
      title: tx('Pedido de transferência na {sigla}', { sigla: fed.acronym }),
      message: kind === 'club' ? tx('{nome} pede para trocar de clube.', { nome: doc.user_name }) : tx('{nome} pede transferência para a {nova}. Sem resposta até {prazo}, a liberação é automática.', { nome: doc.user_name, nova: doc.to_federation_acronym, prazo: doc.deadline }),
      link: `/federacoes/${fed.id}/gerir?aba=transferencias`,
    }));
    await batch.commit();
    await f.auditoria(ctx, actor, 'federation_transfer_request', { federation_id: fed.id, member_id: member.id, user_id: member.user_id, kind, transfer_id: ref.id });
    return { ok: true, transferId: ref.id };
  }

  const { ref, tr } = await carregar(ctx, data.transferId);
  if (acao === 'cancel') {
    if (!['pending', 'homologation'].includes(tr.status)) f.falha('failed-precondition', 'Esta transferência já foi decidida.');
    if (tr.user_id !== actor.uid && tr.guardian_uid !== actor.uid) f.falha('permission-denied', 'Esta transferência não é sua.');
    await ref.update({ status: 'cancelled', cancelled_at_ms: ctx.now, updated_at_ms: ctx.now });
    return { ok: true };
  }
  if (acao === 'homologate' || acao === 'deny') return homologacao(ctx, actor, data, { ref, tr }, acao);
  if (tr.status !== 'pending') f.falha('failed-precondition', 'Esta transferência já foi decidida.');
  await f.exigePerm(ctx, tr.federation_id, actor, 'members');
  if (acao === 'approve') {
    await aprovar(ctx, { ref, tr }, { by: actor.uid });
    await f.auditoria(ctx, actor, 'federation_transfer_approve', { federation_id: tr.federation_id, member_id: tr.member_id, user_id: tr.user_id, transfer_id: tr.id });
    return { ok: true };
  }
  if (acao === 'reject') {
    const reason = f.texto(data.reason, 500);
    if (reason.length < 3) f.falha('invalid-argument', 'Diga o motivo da recusa.');
    const fed = await f.federacao(ctx, tr.federation_id);
    const batch = ctx.db.batch();
    batch.update(ref, { status: 'rejected', reject_reason: reason, decided_by: actor.uid, decided_at_ms: ctx.now, updated_at_ms: ctx.now });
    f.aviso(ctx, batch, f.destinatario(tr), { title: tx('Transferência recusada — {sigla}', { sigla: fed.acronym }), message: tx('Motivo: {motivo}.', { motivo: reason }), link: '/perfil?secao=federacoes' });
    await batch.commit();
    await f.auditoria(ctx, actor, 'federation_transfer_reject', { federation_id: tr.federation_id, member_id: tr.member_id, user_id: tr.user_id, transfer_id: tr.id, reason });
    return { ok: true };
  }
  return f.falha('invalid-argument', 'Ação desconhecida.');
}

/** A confederação homologa ou nega (a equipe dela com `members`, ou o admin). */
async function homologacao(ctx, actor, data, { ref, tr }, acao) {
  if (tr.status !== 'homologation' || !tr.homologation_by) f.falha('failed-precondition', 'Esta transferência não está aguardando homologação.');
  const perms = await f.staffPerms(ctx, tr.homologation_by, actor);
  if (!N.canHomologate(perms)) f.falha('permission-denied', 'Só a secretaria e a administração da confederação homologam transferências.');
  if (acao === 'homologate') {
    await efetivar(ctx, { ref, tr }, { by: actor.uid, homologated: true });
    await f.auditoria(ctx, actor, 'federation_transfer_homologate', { federation_id: tr.homologation_by, member_id: tr.member_id, user_id: tr.user_id, transfer_id: tr.id });
    return { ok: true };
  }
  const reason = f.texto(data.reason, 500);
  if (reason.length < 3) f.falha('invalid-argument', 'Diga o motivo.');
  const batch = ctx.db.batch();
  batch.update(ref, { status: 'denied', deny_reason: reason, homologated_by: actor.uid, homologated_at_ms: ctx.now, updated_at_ms: ctx.now });
  const msg = { title: tx('Transferência negada pela {conf}', { conf: tr.homologation_conf_acronym || '' }), message: tx('{nome} → {para}. Motivo: {motivo}. A filiação na {de} continua como estava.', { nome: tr.user_name, para: tr.to_federation_acronym, motivo: reason, de: tr.federation_acronym }), link: '/perfil?secao=federacoes' };
  f.aviso(ctx, batch, f.destinatario(tr), msg);
  for (const fid of [tr.federation_id, tr.to_federation_id]) {
    // eslint-disable-next-line no-await-in-loop
    (await f.staffIds(ctx, fid, 'members')).forEach((sid) => f.aviso(ctx, batch, sid, { ...msg, link: `/federacoes/${fid}/gerir?aba=transferencias` }));
  }
  await batch.commit();
  await f.auditoria(ctx, actor, 'federation_transfer_deny', { federation_id: tr.homologation_by, member_id: tr.member_id, user_id: tr.user_id, transfer_id: tr.id, reason });
  return { ok: true };
}

/**
 * Varredura: a troca de federação sem resposta até o prazo é liberada (D9);
 * a que espera a confederação sem resposta até o prazo dela é homologada.
 */
async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const pend = await ctx.db.collection(f.C.transfers).where('status', '==', 'pending').where('kind', '==', 'federation').get();
  let liberadas = 0;
  for (const d of pend.docs) {
    const tr = { id: d.id, ...d.data() };
    if (tr.deadline && String(tr.deadline) < hoje) {
      // eslint-disable-next-line no-await-in-loop
      await aprovar(ctx, { ref: d.ref, tr }, { by: 'system', auto: true });
      liberadas += 1;
    }
  }
  const homol = await ctx.db.collection(f.C.transfers).where('status', '==', 'homologation').get();
  let homologadas = 0;
  for (const d of homol.docs) {
    const tr = { id: d.id, ...d.data() };
    if (tr.homologation_deadline && String(tr.homologation_deadline) < hoje) {
      // eslint-disable-next-line no-await-in-loop
      await efetivar(ctx, { ref: d.ref, tr }, { by: 'system', auto: true, homologated: true });
      homologadas += 1;
    }
  }
  if (ctx.logger && (liberadas || homologadas)) ctx.logger.info('Federações: transferências liberadas/homologadas pelo prazo.', { liberadas, homologadas });
  return { liberadas, homologadas };
}

module.exports = { transfer, sweep, COOLDOWN_DAYS, RELEASE_DAYS };
