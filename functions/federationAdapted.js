/**
 * PICKLEBALL ADAPTADO no servidor (rodada 3, Bloco 4b, `docs/50` §41, módulo
 * `adapted`). Só o servidor grava `federation_adapted_classifications` (a
 * regra é `write: if false`) e as categorias da federação
 * (`federations.adapted_classes`, em `fedLocked()`).
 *
 *  - O filiado em dia pede a classificação numa categoria, com o LAUDO. O
 *    arquivo sobe para a pasta dele (`federacao/{uid}/`) e é COPIADO para
 *    `federacao-laudos/{uid}/` — fechada à regra do Storage: ninguém o troca
 *    depois de enviado, e quem abre (a pessoa ou a comissão) passa por
 *    `report_file`, que registra quando é a equipe.
 *  - A comissão (permissão `competitions` ou `admin`) classifica — com data de
 *    revisão opcional —, recusa com motivo ou cancela. Quem pediu não decide o
 *    próprio pedido. A classificação vigente segue valendo enquanto um pedido
 *    novo está em análise; recusado o novo, ela continua.
 *  - Quem organiza um torneio chancelado confere, numa modalidade adaptada, a
 *    situação de cada inscrito (`check`) — só o resultado, nunca o laudo.
 *  - A varredura avisa uma vez antes da revisão e uma vez quando ela passa.
 *
 * A conta pura é `federationAdaptedPolicy.js` (cópia de
 * `src/modules/federations/domain/adapted.js`, com paridade).
 */
const P = require('./federationAdaptedPolicy.js');
const m = require('./federationMembership.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const COL = 'federation_adapted_classifications';
const FILE_MAX = 5 * 1024 * 1024;
const TIPOS = /^(application\/pdf|image\/(jpeg|png|webp))$/;
const INATIVAS = ['cancelled', 'withdrawn'];
const CS = P.CLASS_STATUS;
const LINK_MEU = (fedId) => `/federacoes/${fedId}?aba=minha`;
const LINK_GESTAO = (fedId) => `/federacoes/${fedId}/gerir?aba=adaptado`;
const br = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.split('-').reverse().join('/') : '');
const nomeDe = (u) => texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 120);
const sigla = (fed) => texto(fed.acronym || fed.name, 20);
const historico = (doc, actor, ctx, action, extra = {}) => [...(doc.history || []), { action, by: actor.uid, at_ms: ctx.now, ...extra }].slice(-30);

function exigeValido(r) {
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0] || 'Confira os campos.');
  return r.value;
}

async function contexto(ctx, actor, fedId) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, fedId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.adapted === true)) falha('failed-precondition', 'Esta federação não tem o pickleball adaptado ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms, hoje: m.isoDateBR(ctx.now), gere: P.canManageAdapted(perms), classes: P.adaptedClassesOf(fed) };
}

const exigeGestao = (c) => { if (!c.gere) falha('permission-denied', 'Só a comissão de competições e a administração classificam.'); };

async function avisar(ctx, uids, msg) {
  const lista = [...new Set(uids.filter(Boolean))];
  if (!lista.length) return 0;
  const batch = ctx.db.batch();
  lista.forEach((uid) => f.aviso(ctx, batch, uid, msg));
  await batch.commit();
  return lista.length;
}

const comissao = async (ctx, fedId, menos) => [...new Set([...await f.staffIds(ctx, fedId, 'competitions'), ...await f.staffIds(ctx, fedId, 'admin')])].filter((u) => u !== menos);

async function registro(ctx, fed, uid) {
  const ref = ctx.db.collection(COL).doc(`${fed.id}_${texto(uid, 128)}`);
  const snap = await ref.get();
  return { ref, rec: snap.exists ? { id: snap.id, ...snap.data() } : null };
}

/** Copia o laudo enviado (só da pasta de quem pede) para a pasta fechada. */
async function guardarLaudo(ctx, actor, fedId, path, nome) {
  if (!P.ownFilePath(path, actor.uid)) falha('invalid-argument', 'Envie o laudo pela tela (PDF ou foto, até 5 MB).');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const origem = ctx.bucket.file(path);
  const [meta] = await origem.getMetadata().catch(() => [null]);
  if (!meta) falha('failed-precondition', 'O arquivo não chegou ao servidor. Envie de novo.');
  const contentType = String(meta.contentType || '');
  const size = Number(meta.size) || 0;
  if (!TIPOS.test(contentType)) falha('failed-precondition', 'Envie o laudo em PDF ou imagem (JPG, PNG ou WebP).');
  if (!(size > 0) || size > FILE_MAX) falha('failed-precondition', 'O laudo passa de 5 MB.');
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1].replace('jpeg', 'jpg');
  // O nome da origem é um id gerado na tela: dois envios nunca caem no mesmo arquivo.
  const dest = `federacao-laudos/${actor.uid}/${fedId}_${path.split('/').pop().replace(/\.[^.]+$/, '')}.${ext}`;
  await origem.copy(ctx.bucket.file(dest));
  await origem.delete().catch(() => {});
  return { path: dest, name: texto(nome, 120) || `laudo.${ext}`, size, content_type: contentType };
}

const apagar = (ctx, file) => (ctx.bucket && file && file.path ? ctx.bucket.file(file.path).delete().catch(() => {}) : Promise.resolve());

/* ============================================================== comissão == */

async function classesSave(ctx, actor, data, c) {
  exigeGestao(c);
  const v = exigeValido(P.validateAdaptedClasses(data.classes));
  await ctx.db.collection(f.C.federations).doc(c.fed.id).update({ adapted_classes: v, updated_at: ctx.Timestamp.fromMillis(ctx.now) });
  await f.auditoria(ctx, actor, 'federation_adapted_classes', { federation_id: c.fed.id, classes: v.map((x) => x.id) });
  return { ok: true, classes: v };
}

async function pedidoDe(ctx, c, uid) {
  const { ref, rec } = await registro(ctx, c.fed, uid);
  if (!rec) falha('not-found', 'Classificação não encontrada.');
  return { ref, rec };
}

async function decide(ctx, actor, data, c) {
  exigeGestao(c);
  const uid = texto(data.userId, 128);
  if (uid === actor.uid) falha('permission-denied', 'Quem pediu não decide o próprio pedido.');
  const { ref, rec } = await pedidoDe(ctx, c, uid);
  if (rec.status !== CS.PENDING || !rec.request) falha('failed-precondition', 'Não há pedido em análise.');
  const v = exigeValido(P.validateClassificationDecision(data, c.classes, c.hoje));
  const decisao = { decision: v.decision, note: v.note, by: actor.uid, at_ms: ctx.now };
  if (v.decision === 'classify') {
    const label = (c.classes.find((x) => x.id === v.class_id) || {}).label || '';
    await ref.update({
      status: CS.CLASSIFIED, class_id: v.class_id, class_label: label, valid_until: v.valid_until, classified_at: c.hoje,
      report: rec.request.report, request: null, decision: decisao, warned_for: '', expired_notified_for: '', updated_at_ms: ctx.now,
      history: historico(rec, actor, ctx, 'classify', { class_id: v.class_id, valid_until: v.valid_until }),
    });
    if (rec.report && rec.report.path !== rec.request.report.path) await apagar(ctx, rec.report);
    await avisar(ctx, [uid], {
      title: tx('Você foi classificado(a) no pickleball adaptado da {sigla}', { sigla: sigla(c.fed) }),
      message: v.valid_until ? tx('Categoria: {classe}. Revisão em {data}.', { classe: label, data: br(v.valid_until) }) : tx('Categoria: {classe}.', { classe: label }),
      link: LINK_MEU(c.fed.id),
    });
  } else {
    // Recusado o pedido novo, a classificação anterior (se houver) continua.
    await ref.update({
      status: rec.class_id ? CS.CLASSIFIED : CS.DECLINED, request: null, decision: decisao, updated_at_ms: ctx.now,
      history: historico(rec, actor, ctx, 'decline', { reason: v.note }),
    });
    await apagar(ctx, rec.request.report);
    await avisar(ctx, [uid], {
      title: tx('Seu pedido de classificação na {sigla} não foi aceito', { sigla: sigla(c.fed) }),
      message: tx('Motivo: {motivo}', { motivo: v.note }),
      link: LINK_MEU(c.fed.id),
    });
  }
  await f.auditoria(ctx, actor, 'federation_adapted_decide', { federation_id: c.fed.id, classification_id: ref.id, decision: v.decision, class_id: v.class_id });
  return { ok: true };
}

async function revoke(ctx, actor, data, c) {
  exigeGestao(c);
  const motivo = texto(data.reason, 300);
  if (motivo.length < 3) falha('invalid-argument', 'Diga o motivo.');
  const { ref, rec } = await pedidoDe(ctx, c, texto(data.userId, 128));
  if (!rec.class_id || rec.status === CS.REVOKED) falha('failed-precondition', 'Não há classificação para cancelar.');
  await ref.update({
    status: rec.request ? CS.PENDING : CS.REVOKED, class_id: '', class_label: '', valid_until: '', report: null,
    decision: { decision: 'revoke', note: motivo, by: actor.uid, at_ms: ctx.now }, updated_at_ms: ctx.now,
    history: historico(rec, actor, ctx, 'revoke', { reason: motivo }),
  });
  await apagar(ctx, rec.report);
  await avisar(ctx, [rec.user_id], {
    title: tx('Sua classificação no pickleball adaptado da {sigla} foi cancelada', { sigla: sigla(c.fed) }),
    message: tx('Motivo: {motivo}', { motivo }),
    link: LINK_MEU(c.fed.id),
  });
  await f.auditoria(ctx, actor, 'federation_adapted_revoke', { federation_id: c.fed.id, classification_id: ref.id });
  return { ok: true };
}

/* ================================================================ atleta == */

async function request(ctx, actor, data, c) {
  const filiacao = await ctx.db.collection(f.C.members).doc(`${c.fed.id}_${actor.uid}`).get();
  if (!filiacao.exists || m.membershipState(filiacao.data(), c.hoje, ctx.now).status !== 'active') falha('failed-precondition', 'Só filiado em dia nesta federação pede a classificação.');
  const v = exigeValido(P.validateClassificationRequest(data, c.classes));
  const { ref, rec } = await registro(ctx, c.fed, actor.uid);
  if (rec && rec.status === CS.PENDING) falha('failed-precondition', 'Você já tem um pedido em análise.');
  const report = await guardarLaudo(ctx, actor, c.fed.id, texto(data.filePath, 200), data.fileName);
  const u = await ctx.db.collection('users').doc(actor.uid).get();
  const nome = nomeDe(u.exists ? u.data() : {});
  const label = (c.classes.find((x) => x.id === v.class_id) || {}).label || '';
  const pedido = { class_id: v.class_id, class_label: label, note: v.note, report, at_ms: ctx.now };
  if (rec) await ref.update({ status: CS.PENDING, request: pedido, name: nome, updated_at_ms: ctx.now, history: historico(rec, actor, ctx, 'request', { class_id: v.class_id }) });
  else {
    await ref.set({
      federation_id: c.fed.id, federation_acronym: sigla(c.fed), user_id: actor.uid, name: nome, status: CS.PENDING, request: pedido,
      class_id: '', class_label: '', valid_until: '', report: null, decision: null, warned_for: '', expired_notified_for: '',
      created_at_ms: ctx.now, updated_at_ms: ctx.now, history: historico({}, actor, ctx, 'request', { class_id: v.class_id }),
    });
  }
  await avisar(ctx, await comissao(ctx, c.fed.id, actor.uid), {
    title: tx('Pedido de classificação no adaptado: {nome}', { nome }),
    message: tx('Categoria pedida: {classe}. Confira o laudo e decida na Central.', { classe: label }),
    link: LINK_GESTAO(c.fed.id),
  });
  await f.auditoria(ctx, actor, 'federation_adapted_request', { federation_id: c.fed.id, classification_id: ref.id, class_id: v.class_id });
  return { ok: true };
}

async function withdraw(ctx, actor, data, c) {
  const { ref, rec } = await registro(ctx, c.fed, actor.uid);
  if (!rec || rec.status !== CS.PENDING || !rec.request) falha('failed-precondition', 'Não há pedido em análise.');
  if (rec.class_id) await ref.update({ status: CS.CLASSIFIED, request: null, updated_at_ms: ctx.now, history: historico(rec, actor, ctx, 'withdraw') });
  else await ref.delete();
  await apagar(ctx, rec.request.report);
  await f.auditoria(ctx, actor, 'federation_adapted_withdraw', { federation_id: c.fed.id, classification_id: ref.id });
  return { ok: true };
}

/** O laudo vigente (`current`) ou o do pedido em análise (`request`): a pessoa ou a comissão. */
async function reportFile(ctx, actor, data, c) {
  const uid = texto(data.userId || actor.uid, 128);
  const proprio = uid === actor.uid;
  if (!proprio) exigeGestao(c);
  const { rec } = await pedidoDe(ctx, c, uid);
  const file = data.which === 'request' ? rec.request && rec.request.report : rec.report;
  if (!file || !file.path) falha('not-found', 'Não há laudo guardado.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const alvo = ctx.bucket.file(file.path);
  const [meta] = await alvo.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  const [bytes] = await alvo.download();
  if (!proprio) await f.auditoria(ctx, actor, 'federation_adapted_report_view', { federation_id: c.fed.id, classification_id: rec.id, which: data.which === 'request' ? 'request' : 'current' });
  return { ok: true, name: file.name, contentType: meta.contentType || file.content_type || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

/* ============================================================ organizador == */

/** A conferência dos inscritos de uma modalidade adaptada: só o resultado, nunca o laudo. */
async function check(ctx, actor, data) {
  const tId = texto(data.tournamentId, 80);
  const tSnap = await ctx.db.collection('tournaments').doc(tId).get();
  if (!tSnap.exists) falha('not-found', 'Torneio não encontrado.');
  const t = tSnap.data();
  if (!t.federation_id) falha('failed-precondition', 'O torneio não é de uma federação.');
  const c = await contexto(ctx, actor, t.federation_id);
  const organiza = t.creator_uid === actor.uid || (await ctx.db.collection('tournament_admins').doc(`${tId}_${actor.uid}`).get()).exists;
  if (!organiza && !c.gere) falha('permission-denied', 'Só quem organiza o torneio confere a classificação.');
  const modSnap = await ctx.db.collection('tournament_modalities').doc(texto(data.modalityId, 80)).get();
  if (!modSnap.exists || modSnap.data().tournament_id !== tId) falha('not-found', 'Modalidade não encontrada.');
  const classId = modSnap.data().adapted_class;
  if (!classId) falha('failed-precondition', 'Esta modalidade não é adaptada.');
  const regs = await ctx.db.collection('tournament_registrations').where('modality_id', '==', modSnap.id).get();
  const ativas = regs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.tournament_id === tId && !INATIVAS.includes(r.status));
  const uids = [...new Set(ativas.flatMap((r) => [r.player_a_user_id, r.player_b_user_id]).filter(Boolean))];
  const snaps = await Promise.all(uids.map((u) => ctx.db.collection(COL).doc(`${c.fed.id}_${u}`).get()));
  const porUid = new Map(snaps.map((s, i) => [uids[i], s.exists ? s.data() : null]));
  const jogador = (uid, nome) => ({ name: texto(nome, 120) || '—', check: P.adaptedPlayerCheck(uid || '', porUid.get(uid) || null, classId, c.hoje) });
  const rows = ativas.map((r) => ({
    registration_id: r.id,
    players: [jogador(r.player_a_user_id, r.player_a_name), ...(r.format === 'doubles' || r.player_b_user_id || r.player_b_name ? [jogador(r.player_b_user_id, r.player_b_name)] : [])],
  }));
  return { ok: true, class_id: classId, class_label: P.adaptedClassesOf(c.fed).find((x) => x.id === classId)?.label || modSnap.data().adapted_class_label || '', rows };
}

const ACOES = {
  classes_save: classesSave, decide, revoke, request, withdraw, report_file: reportFile,
};

async function adapted(ctx, actor, data = {}) {
  if (data.action === 'check') return check(ctx, actor, data);
  const acao = ACOES[data.action];
  if (!acao) falha('invalid-argument', 'Ação desconhecida.');
  return acao(ctx, actor, data, await contexto(ctx, actor, data.federationId));
}

/* ============================================================= varredura == */

async function sweep(ctx) {
  if (!(await f.flagLigada(ctx))) return { skipped: 'flag' };
  const hoje = m.isoDateBR(ctx.now);
  const feds = new Map();
  let avisos = 0;
  const snap = await ctx.db.collection(COL).where('status', 'in', [CS.CLASSIFIED, CS.PENDING]).get();
  /* eslint-disable no-await-in-loop */
  for (const d of snap.docs) {
    const rec = d.data();
    const tipo = P.classificationNotice(rec, hoje);
    if (!tipo) continue;
    if (!feds.has(rec.federation_id)) {
      const s = await ctx.db.collection(f.C.federations).doc(rec.federation_id).get();
      feds.set(rec.federation_id, s.exists ? { id: s.id, ...s.data() } : null);
    }
    const fed = feds.get(rec.federation_id);
    if (!(fed && fed.status === 'approved' && fed.modules && fed.modules.adapted === true)) continue;
    const msg = tipo === 'expired'
      ? { title: tx('Sua classificação no adaptado da {sigla} venceu', { sigla: sigla(fed) }), message: tx('A revisão era em {data}. Peça a reclassificação com um laudo atualizado.', { data: br(rec.valid_until) }) }
      : { title: tx('Sua classificação no adaptado da {sigla} vence em {data}', { sigla: sigla(fed), data: br(rec.valid_until) }), message: tx('Peça a reclassificação com um laudo atualizado antes da data.') };
    avisos += await avisar(ctx, [rec.user_id], { ...msg, link: LINK_MEU(fed.id) });
    await d.ref.update(tipo === 'expired' ? { expired_notified_for: rec.valid_until } : { warned_for: rec.valid_until });
  }
  /* eslint-enable no-await-in-loop */
  if (ctx.logger) ctx.logger.info('Federações: pickleball adaptado.', { avisos });
  return { notices: avisos };
}

module.exports = { adapted, sweep, COL };
