/**
 * COMENTÁRIOS nos documentos do acervo (`federation_docs`) e nos eventos do
 * calendário (`federation_events`) — só o SERVIDOR grava
 * (`federation_comments` e `federation_comment_reports` são
 * `write: if false`; a pessoa lê só os PRÓPRIOS comentários pela regra, para
 * a exportação dos dados).
 *
 * A lista pública passa por aqui (`list`, também sem conta), porque quem pode
 * ver o comentário é quem pode ver o documento ou o evento AGORA — e a
 * visibilidade deles muda. Ações:
 * - `post`: quem pode ler e tem conta, com os comentários abertos, no máximo
 *   um a cada 30 s e 10 por dia no mesmo documento ou evento;
 * - `reply`: resposta OFICIAL da equipe (permissão `docs`/`admin`), sob um
 *   comentário; avisa quem comentou;
 * - `report`: denúncia, uma por pessoa; três denúncias ocultam até a moderação;
 * - `hide` / `restore`: a moderação oculta (com motivo, avisando o autor) e
 *   reabre (zerando a contagem: precisa de três denúncias NOVAS);
 * - `delete`: quem escreveu apaga o próprio (e as respostas a ele);
 * - `settings`: abertos, fechados ou consulta pública com prazo (equipe);
 * - `queue`: a fila da moderação (ocultos e denunciados) da federação.
 *
 * A conta pura é `federationCommentsPolicy.js` (paridade com o cliente).
 */
const C = require('./federationCommentsPolicy.js');
const f = require('./federations.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const COMMENTS = 'federation_comments';
const REPORTS = 'federation_comment_reports';
const ALVO = {
  doc: { col: 'federation_docs', modulo: 'official_docs', semModulo: 'Esta federação não tem o acervo oficial ligado.', naoAchou: 'Documento não encontrado.', pagina: 'acervo' },
  event: { col: 'federation_events', modulo: 'calendar', semModulo: 'Esta federação não tem o calendário oficial ligado.', naoAchou: 'Evento não encontrado.', pagina: 'agenda' },
};
const DAY_MS = 86400000;
const moderador = (perms) => perms.includes('docs') || perms.includes('admin');

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  const perms = actor ? await f.staffPerms(ctx, fed.id, actor) : [];
  return { fed, perms };
}

/** O documento ou evento comentado (da federação, com o módulo ligado). */
async function alvoDe(ctx, fed, kind, id) {
  const a = ALVO[kind];
  if (!a) falha('invalid-argument', 'Onde comentar?');
  if (!(fed.modules && fed.modules[a.modulo] === true)) falha('failed-precondition', a.semModulo);
  const ref = ctx.db.collection(a.col).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', a.naoAchou);
  return { ref, alvo: { id: snap.id, ...snap.data() }, key: `${kind}_${snap.id}` };
}

/** Quem lê: igual à regra do documento ou do evento (o público da federação OCULTA é quem a vê: equipe e filiados — `fedSees`). */
async function podeLer(ctx, fed, kind, alvo, actor, perms) {
  if (moderador(perms)) return true;
  if (kind === 'doc' && alvo.status !== 'published') return false;
  if (alvo.visibility === 'public' && f.publicada(fed)) return true;
  if (!actor) return false;
  if (perms.length > 0) return true;
  if (alvo.visibility !== 'members' && alvo.visibility !== 'public') return false;
  const m = await ctx.db.collection(f.C.members).doc(`${fed.id}_${actor.uid}`).get();
  return m.exists && m.data().status === 'active';
}

const estado = (fed, kind, alvo, ctx) => C.commentsState(alvo, { rules: fed.rules, kind, nowMs: ctx.now });
const linkDo = (fed, kind, id) => `/f/${encodeURIComponent(fed.slug || fed.id)}/${ALVO[kind].pagina}/${encodeURIComponent(id)}`;

/** O que vai para a tela: sem uid de ninguém (só "é meu"); a moderação vê denúncias e motivo. */
function paraTela(c, uid, mod) {
  const out = {
    id: c.id, text: c.text, user_name: c.user_name, official: c.official === true, org_name: c.org_name || '',
    parent_id: c.parent_id || null, created_at_ms: c.created_at_ms, mine: Boolean(uid) && c.user_id === uid, status: c.status,
  };
  if (mod) Object.assign(out, { reports_count: c.reports_count || 0, hidden_reason: c.hidden_reason || '', hidden_by: c.hidden_by || null });
  return out;
}

async function comentariosDo(ctx, key) {
  const snap = await ctx.db.collection(COMMENTS).where('target_key', '==', key).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function list(ctx, actor, data) {
  const { fed, perms } = await contexto(ctx, actor, data);
  const { alvo, key } = await alvoDe(ctx, fed, data.kind, data.targetId);
  if (!(await podeLer(ctx, fed, data.kind, alvo, actor, perms))) falha('permission-denied', 'Você não tem acesso a este conteúdo.');
  const mod = moderador(perms);
  const uid = actor ? actor.uid : null;
  const todos = await comentariosDo(ctx, key);
  const visiveis = todos
    .filter((c) => c.status === 'visible' || mod || (uid && c.user_id === uid))
    .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0))
    .slice(-C.COMMENT_LIST_MAX);
  return {
    ok: true, state: estado(fed, data.kind, alvo, ctx), can_moderate: mod, signed_in: Boolean(uid),
    count: todos.filter((c) => c.status === 'visible').length,
    comments: visiveis.map((c) => paraTela(c, uid, mod)),
  };
}

async function nomeDe(ctx, uid) {
  const s = await ctx.db.collection('users').doc(uid).get();
  const u = s.exists ? s.data() : {};
  return texto(u.platform_name || u.full_name || u.display_name || 'Atleta', 80);
}

async function post(ctx, actor, data, { fed, perms }) {
  const { alvo, key } = await alvoDe(ctx, fed, data.kind, data.targetId);
  if (!(await podeLer(ctx, fed, data.kind, alvo, actor, perms))) falha('permission-denied', 'Você não tem acesso a este conteúdo.');
  const st = estado(fed, data.kind, alvo, ctx);
  if (!st.open) falha('failed-precondition', st.why === 'ended' ? 'A consulta pública terminou.' : 'Os comentários estão fechados.');
  const v = C.validateCommentText(data.text);
  if (!v.ok) falha('invalid-argument', v.error);
  const meus = (await ctx.db.collection(COMMENTS).where('target_key', '==', key).where('user_id', '==', actor.uid).get()).docs.map((d) => d.data());
  if (meus.some((c) => ctx.now - (c.created_at_ms || 0) < C.COMMENT_INTERVAL_MS)) falha('resource-exhausted', 'Espere um pouco antes de comentar de novo.');
  if (meus.filter((c) => ctx.now - (c.created_at_ms || 0) < DAY_MS).length >= C.COMMENT_DAILY_MAX) falha('resource-exhausted', `No máximo ${C.COMMENT_DAILY_MAX} comentários por dia aqui.`);
  const ref = ctx.db.collection(COMMENTS).doc();
  await ref.set({
    federation_id: fed.id, target_kind: data.kind, target_id: alvo.id, target_key: key, target_title: texto(alvo.title, 200),
    user_id: actor.uid, user_name: await nomeDe(ctx, actor.uid), text: v.value, official: false, parent_id: null,
    status: 'visible', reports_count: 0, created_at_ms: ctx.now,
  });
  return { ok: true, id: ref.id };
}

async function comentario(ctx, fed, id) {
  const ref = ctx.db.collection(COMMENTS).doc(texto(id, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Comentário não encontrado.');
  return { ref, c: { id: snap.id, ...snap.data() } };
}

function exigeModerador(perms) {
  if (!moderador(perms)) falha('permission-denied', 'Só quem cuida do acervo ou administra a federação modera os comentários.');
}

async function reply(ctx, actor, data, { fed, perms }) {
  exigeModerador(perms);
  const { c: pai } = await comentario(ctx, fed, data.commentId);
  if (pai.parent_id) falha('failed-precondition', 'Responda ao comentário, não a uma resposta.');
  const v = C.validateCommentText(data.text);
  if (!v.ok) falha('invalid-argument', v.error);
  const ref = ctx.db.collection(COMMENTS).doc();
  await ref.set({
    federation_id: fed.id, target_kind: pai.target_kind, target_id: pai.target_id, target_key: pai.target_key, target_title: pai.target_title || '',
    user_id: actor.uid, user_name: await nomeDe(ctx, actor.uid), org_name: texto(fed.acronym || fed.name, 80), text: v.value, official: true, parent_id: pai.id,
    status: 'visible', reports_count: 0, created_at_ms: ctx.now,
  });
  let notified = 0;
  if (pai.user_id && pai.user_id !== actor.uid && !pai.official) {
    const batch = ctx.db.batch();
    f.aviso(ctx, batch, pai.user_id, {
      title: tx('{sigla} respondeu ao seu comentário', { sigla: fed.acronym || fed.name }),
      message: texto(pai.target_title, 140),
      link: linkDo(fed, pai.target_kind, pai.target_id),
    });
    await batch.commit();
    notified = 1;
  }
  await f.auditoria(ctx, actor, 'federation_comment_reply', { federation_id: fed.id, comment_id: pai.id, reply_id: ref.id });
  return { ok: true, id: ref.id, notified };
}

async function report(ctx, actor, data, { fed }) {
  const { ref, c } = await comentario(ctx, fed, data.commentId);
  if (c.user_id === actor.uid) falha('failed-precondition', 'Você não denuncia o próprio comentário: apague-o.');
  if (c.official) falha('failed-precondition', 'A resposta oficial não é denunciada aqui: use a ouvidoria.');
  if (c.status !== 'visible') return { ok: true, hidden: true };
  const reason = C.REPORT_REASON_IDS.includes(data.reason) ? data.reason : null;
  if (!reason) falha('invalid-argument', 'Escolha o motivo da denúncia.');
  const repRef = ctx.db.collection(REPORTS).doc(`${c.id}_${actor.uid}`);
  return ctx.db.runTransaction(async (t) => {
    const [rep, atual] = await Promise.all([t.get(repRef), t.get(ref)]);
    if (rep.exists) return { ok: true, already: true, hidden: atual.data().status !== 'visible' };
    const n = (atual.data().reports_count || 0) + 1;
    const ocultar = n >= C.COMMENT_REPORTS_TO_HIDE;
    t.set(repRef, { federation_id: fed.id, comment_id: c.id, reporter_id: actor.uid, reason, created_at_ms: ctx.now });
    t.update(ref, { reports_count: n, ...(ocultar ? { status: 'hidden', hidden_by: 'reports', hidden_reason: '', hidden_at_ms: ctx.now } : {}) });
    return { ok: true, hidden: ocultar };
  });
}

async function hide(ctx, actor, data, { fed, perms }) {
  exigeModerador(perms);
  const { ref, c } = await comentario(ctx, fed, data.commentId);
  const reason = texto(data.reason, 300);
  if (reason.length < C.COMMENT_REASON_MIN) falha('invalid-argument', `Diga o motivo (mínimo ${C.COMMENT_REASON_MIN} caracteres).`);
  await ref.update({ status: 'hidden', hidden_by: 'staff', hidden_reason: reason, hidden_at_ms: ctx.now, moderated_by: actor.uid });
  if (c.user_id && c.user_id !== actor.uid) {
    const batch = ctx.db.batch();
    f.aviso(ctx, batch, c.user_id, {
      title: tx('{sigla} ocultou um comentário seu', { sigla: fed.acronym || fed.name }),
      message: tx('Motivo: {motivo}', { motivo: reason }),
      link: linkDo(fed, c.target_kind, c.target_id),
    });
    await batch.commit();
  }
  await f.auditoria(ctx, actor, 'federation_comment_hide', { federation_id: fed.id, comment_id: c.id, reason });
  return { ok: true };
}

async function restore(ctx, actor, data, { fed, perms }) {
  exigeModerador(perms);
  const { ref, c } = await comentario(ctx, fed, data.commentId);
  await ref.update({ status: 'visible', hidden_by: null, hidden_reason: '', reports_count: 0, moderated_by: actor.uid, restored_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_comment_restore', { federation_id: fed.id, comment_id: c.id });
  return { ok: true };
}

async function apagarComentarios(ctx, ids) {
  const reps = [];
  for (const id of ids) reps.push(...(await ctx.db.collection(REPORTS).where('comment_id', '==', id).get()).docs.map((d) => d.ref));
  const refs = [...ids.map((id) => ctx.db.collection(COMMENTS).doc(id)), ...reps];
  for (let i = 0; i < refs.length; i += 400) {
    const batch = ctx.db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

async function remove(ctx, actor, data, { fed }) {
  const { c } = await comentario(ctx, fed, data.commentId);
  if (c.user_id !== actor.uid) falha('permission-denied', 'Só quem escreveu apaga o comentário.');
  const respostas = c.parent_id ? [] : (await comentariosDo(ctx, c.target_key)).filter((x) => x.parent_id === c.id).map((x) => x.id);
  await apagarComentarios(ctx, [c.id, ...respostas]);
  return { ok: true };
}

async function settings(ctx, actor, data, { fed, perms }) {
  exigeModerador(perms);
  const { ref, alvo } = await alvoDe(ctx, fed, data.kind, data.targetId);
  const v = C.validateCommentSettings(data.settings, { nowMs: ctx.now });
  if (!v.ok) falha('invalid-argument', v.error);
  await ref.update({ comments: { ...v.value, updated_at_ms: ctx.now, updated_by: actor.uid } });
  await f.auditoria(ctx, actor, 'federation_comment_settings', { federation_id: fed.id, kind: data.kind, target_id: alvo.id, mode: v.value.mode, until_date: v.value.until_date });
  return { ok: true, state: C.commentsState({ ...alvo, comments: v.value }, { rules: fed.rules, kind: data.kind, nowMs: ctx.now }) };
}

async function queue(ctx, actor, data, { fed, perms }) {
  exigeModerador(perms);
  const snap = await ctx.db.collection(COMMENTS).where('federation_id', '==', fed.id).get();
  const itens = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.status === 'hidden' || (c.reports_count || 0) > 0)
    .sort((a, b) => (b.hidden_at_ms || b.created_at_ms || 0) - (a.hidden_at_ms || a.created_at_ms || 0))
    .slice(0, 200)
    .map((c) => ({ ...paraTela(c, actor.uid, true), target_kind: c.target_kind, target_id: c.target_id, target_title: c.target_title || '' }));
  return { ok: true, items: itens };
}

const ACOES = { post, reply, report, hide, restore, delete: remove, settings, queue };

async function comments(ctx, actor, data = {}) {
  if (data.action === 'list') return list(ctx, actor, data);
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  const c = await contexto(ctx, actor, data);
  return fn(ctx, actor, data, c);
}

module.exports = { comments, list, COMMENTS, REPORTS };
