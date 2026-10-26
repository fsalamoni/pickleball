/**
 * ACERVO DO CLUBE-ASSOCIAÇÃO (Bloco D2, flag `club_association`) — estatuto,
 * regimento, atas, editais, resoluções, prestação de contas, vídeos. Só o
 * SERVIDOR grava `club_x/{clube}/docs` (a regra é `write: if false` para a
 * espécie): a numeração por tipo e ano, a imutabilidade do publicado, o SHA-256
 * dos arquivos e a cópia da pasta privada de quem enviou para a pasta oficial
 * não se garantem no navegador.
 *
 * É o desenho do acervo da federação (`federationAcervo.js`) sem copiar a régua:
 * o documento, os arquivos e as relações são os MESMOS (`federationAcervoPolicy.js`,
 * `ac.oficializar`); aqui mudam o endereço dos dados (`club_x/{clube}/docs`), quem
 * pode (cargo do clube, `permsDe`), os tipos (lista menor, `clubDocsPolicy.js`) e
 * quem é avisado (os associados em dia, uma vez por versão, quando a equipe pede).
 *
 * Callable `clubDocs` (permissão `docs` ou `admin`; a administração do clube tem
 * todas): `save`, `delete` (rascunho), `publish`, `rectify` (nova versão, motivo),
 * `visibility`, `withdraw` (só `admin`), `notify` e `file` (entrega o arquivo — até
 * 9 MB — a quem pode ler o documento e não tem link público).
 *
 * Quem lê: o público só vê o que tem `pub` (público e publicado, com a associação
 * aberta); o membro do clube, o que tem `members`; "só a equipe" fica com quem
 * cuida do acervo. As duas marcas são mantidas aqui — a regra só lê.
 */
const crypto = require('node:crypto');
const A = require('./federationAcervoPolicy.js');
const ac = require('./federationAcervo.js');
const m = require('./federationMembership.js');
const a = require('./clubAssociation.js');
const P = require('./clubDocsPolicy.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto, col } = a;
const DOCS = 'docs';
const SEQ = 'seq';
const VERSIONS_MAX = 10;
const BR_OFFSET_MS = 3 * 3600000;
const LOTE = 400;

const podeAcervo = (perms) => perms.includes('docs') || perms.includes('admin');
const anoBrasil = (ms) => new Date(ms - BR_OFFSET_MS).getUTCFullYear();

async function contexto(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const club = await a.clube(ctx, data.clubId);
  if (!(club.association && club.association.enabled === true)) falha('failed-precondition', 'Este clube ainda não abriu a associação.');
  const perms = await a.permsDe(ctx, club.id, actor.uid);
  return { club, perms };
}

async function documento(ctx, club, docId) {
  const ref = col(ctx, club.id, DOCS).doc(texto(docId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().club_id !== club.id) falha('not-found', 'Documento não encontrado.');
  return { ref, doc: { id: snap.id, ...snap.data() } };
}

function exigeValido(input) {
  const r = P.validateClubDoc(input);
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  return r.value;
}

/** As relações apontam atos PUBLICADOS deste clube (e revogar/alterar/corrigir um revogado não faz sentido). */
async function alvos(ctx, club, relations, docId) {
  const lista = [];
  for (const r of relations) {
    if (r.doc_id === docId) falha('invalid-argument', 'Um documento não se relaciona com ele mesmo.');
    const ref = col(ctx, club.id, DOCS).doc(r.doc_id);
    // eslint-disable-next-line no-await-in-loop
    const snap = await ref.get();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.club_id !== club.id || d.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Uma relação aponta um documento que não está publicado neste clube.');
    if (['revokes', 'amends', 'errata'].includes(r.kind) && d.revoked_by) falha('failed-precondition', `"${d.code || d.title}" já foi revogado.`);
    lista.push({ ...r, ref });
  }
  return lista;
}

/** Arquivo NOVO só da pasta de quem está salvando (ninguém anexa o rascunho que outra pessoa enviou e não usou). */
function exigeDono(files, actor, jaNoDocumento = []) {
  const antigos = new Set(jaNoDocumento.map((x) => x.path));
  const alheio = files.find((x) => !antigos.has(x.path) && !x.path.startsWith(`clube-acervo/${actor.uid}/`));
  if (alheio) falha('permission-denied', `O arquivo "${alheio.name}" não foi enviado por você. Envie de novo.`);
}

/* -------------------------------------------------------------- arquivos -- */

const urlPublica = (bucket, path, token) => `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

const caminhoOficial = (clubId, docId, versao, i, contentType) => {
  const ext = (String(contentType).split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  return `clube-acervo-oficial/${clubId}/${docId}/v${versao}/${i + 1}.${ext}`;
};

/** Liga (público) ou mata (restrito) o link de cada arquivo já oficial. */
async function ajustarLinks(ctx, files, publico) {
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const out = [];
  for (const item of files || []) {
    if (!publico && Number(item.size) > A.RESTRICTED_FILE_MAX) falha('failed-precondition', `"${item.name}" passa de 9 MB: só pode ficar público.`);
    const token = crypto.randomUUID(); // um token novo invalida o link antigo
    // eslint-disable-next-line no-await-in-loop
    await ctx.bucket.file(item.path).setMetadata({ cacheControl: publico ? 'public, max-age=31536000, immutable' : 'private, max-age=0', metadata: { firebaseStorageDownloadTokens: token } });
    const { url: _url, ...resto } = item;
    out.push(publico ? { ...resto, url: urlPublica(ctx.bucket, item.path, token) } : resto);
  }
  return out;
}

/* ---------------------------------------------------------------- ações -- */

async function save(ctx, actor, data, { club }) {
  const value = exigeValido(data.doc || {});
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  if (data.docId) {
    const { ref, doc } = await documento(ctx, club, data.docId);
    if (doc.status !== A.STATUS.DRAFT) falha('failed-precondition', 'Documento publicado não se edita: use retificação, errata ou um novo ato.');
    exigeDono(value.files, actor, doc.files || []);
    await alvos(ctx, club, value.relations, doc.id);
    await ref.update({ ...value, updated_at: ts, updated_at_ms: ctx.now, updated_by: actor.uid });
    await a.auditoria(ctx, actor, 'club_doc_save', { club_id: club.id, doc_id: doc.id });
    return { ok: true, docId: doc.id };
  }
  exigeDono(value.files, actor);
  await alvos(ctx, club, value.relations, null);
  const ref = col(ctx, club.id, DOCS).doc();
  await ref.set({
    club_id: club.id, ...value, status: A.STATUS.DRAFT, version: 0, pub: false, members: false,
    created_by: actor.uid, created_by_name: texto(actor.name, 80), created_at: ts, created_at_ms: ctx.now, updated_at: ts, updated_at_ms: ctx.now,
  });
  await a.auditoria(ctx, actor, 'club_doc_save', { club_id: club.id, doc_id: ref.id, created: true });
  return { ok: true, docId: ref.id };
}

async function remove(ctx, actor, data, { club }) {
  const { ref, doc } = await documento(ctx, club, data.docId);
  if (doc.status !== A.STATUS.DRAFT) falha('failed-precondition', 'Documento publicado não se apaga. Para tirar do ar, quem administra o clube usa "Retirar do ar".');
  await ref.delete();
  if (ctx.bucket) await Promise.all((doc.files || []).map((x) => ctx.bucket.file(x.path).delete().catch(() => {})));
  await a.auditoria(ctx, actor, 'club_doc_delete', { club_id: club.id, doc_id: doc.id });
  return { ok: true };
}

/** Marca no alvo a relação recebida (sem repetir). */
const marcaRecebida = (alvo, rel, novo) => {
  const lista = (Array.isArray(alvo.related_by) ? alvo.related_by : []).filter((x) => x.doc_id !== novo.id);
  lista.push({ kind: rel.kind, doc_id: novo.id, code: novo.code || '', title: novo.title });
  return { related_by: lista.slice(-50), ...(rel.kind === 'revokes' ? { revoked_by: { doc_id: novo.id, code: novo.code || '', title: novo.title, at_ms: novo.at_ms } } : {}) };
};

async function publish(ctx, actor, data, { club }) {
  const { ref, doc } = await documento(ctx, club, data.docId);
  if (doc.status !== A.STATUS.DRAFT) falha('failed-precondition', 'Este documento já foi publicado.');
  const value = exigeValido(doc);
  const rels = await alvos(ctx, club, value.relations, doc.id);
  const publico = value.visibility === 'public';
  const files = [];
  for (const [i, item] of value.files.entries()) {
    // eslint-disable-next-line no-await-in-loop
    files.push(await ac.oficializar(ctx, item, caminhoOficial(club.id, doc.id, 1, i, item.content_type), publico));
  }
  const ano = anoBrasil(ctx.now);
  const seqRef = col(ctx, club.id, SEQ).doc(DOCS);
  const resultado = await ctx.db.runTransaction(async (tr) => {
    const [seqSnap, docSnap, ...alvoSnaps] = await Promise.all([tr.get(seqRef), tr.get(ref), ...rels.map((r) => tr.get(r.ref))]);
    if (!docSnap.exists || docSnap.data().status !== A.STATUS.DRAFT) falha('failed-precondition', 'Este documento já foi publicado.');
    let number = null;
    if (A.TYPES[value.type].numbered) {
      const contadores = { ...((seqSnap.data() || {}).counters || {}) };
      const chave = A.counterKey(value.type, ano);
      number = (Number(contadores[chave]) || 0) + 1;
      contadores[chave] = number;
      tr.set(seqRef, { club_id: club.id, counters: contadores, updated_at_ms: ctx.now });
    }
    const code = A.codeOf(value.type, number, ano);
    const ts = ctx.Timestamp.fromMillis(ctx.now);
    tr.update(ref, {
      ...value, files, status: A.STATUS.PUBLISHED, number, year: ano, code, ...P.readFlags(A.STATUS.PUBLISHED, value.visibility),
      version: 1, version_reason: '', version_at_ms: ctx.now, versions: [],
      published_at: ts, published_at_ms: ctx.now, published_by: actor.uid, published_by_name: texto(actor.name, 80),
      updated_at: ts, updated_at_ms: ctx.now,
    });
    const novo = { id: doc.id, code, title: value.title, at_ms: ctx.now };
    alvoSnaps.forEach((s, i) => tr.update(rels[i].ref, marcaRecebida(s.data() || {}, rels[i], novo)));
    return { number, code };
  });
  await a.auditoria(ctx, actor, 'club_doc_publish', { club_id: club.id, doc_id: doc.id, code: resultado.code, type: value.type });
  return { ok: true, ...resultado };
}

async function rectify(ctx, actor, data, { club }) {
  const { ref, doc } = await documento(ctx, club, data.docId);
  if (doc.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Só um documento publicado é retificado.');
  if (doc.revoked_by) falha('failed-precondition', 'Documento revogado não se retifica.');
  const reason = texto(data.reason, 500);
  if (reason.length < A.REASON_MIN) falha('invalid-argument', `Diga o motivo da retificação (mínimo ${A.REASON_MIN} caracteres).`);
  const versoes = Array.isArray(doc.versions) ? doc.versions : [];
  if (versoes.length >= VERSIONS_MAX) falha('failed-precondition', 'Este documento já tem muitas versões. Publique um ato novo que o altere.');
  const manter = (Array.isArray(data.keep_files) ? data.keep_files : []).map(String);
  const mantidos = (doc.files || []).filter((x) => manter.includes(x.path));
  const d = data.doc || {};
  const pega = (k) => (d[k] !== undefined ? d[k] : doc[k]);
  // Tipo, número, visibilidade e relações não mudam na retificação: só o conteúdo.
  const r = P.validateClubDoc({
    type: doc.type, visibility: doc.visibility, relations: doc.relations || [], files: Array.isArray(d.files) ? d.files : [],
    title: pega('title'), summary: pega('summary'), body: pega('body'), act_date: pega('act_date'), signed_by: pega('signed_by'), tags: pega('tags'), media_links: pega('media_links'),
  });
  const erros = Object.entries(r.errors).filter(([k]) => !(k === 'content' && mantidos.length));
  if (erros.length) falha('invalid-argument', erros[0][1]);
  const value = r.value;
  exigeDono(value.files, actor);
  if (value.files.length + mantidos.length > A.FILES_MAX) falha('invalid-argument', `No máximo ${A.FILES_MAX} arquivos.`);
  const versao = (Number(doc.version) || 1) + 1;
  const publico = doc.visibility === 'public';
  const novos = [];
  for (const [i, item] of value.files.entries()) {
    // eslint-disable-next-line no-await-in-loop
    novos.push(await ac.oficializar(ctx, item, caminhoOficial(club.id, doc.id, versao, i, item.content_type), publico));
  }
  const anterior = {
    version: Number(doc.version) || 1, title: doc.title, summary: doc.summary || '', body: doc.body || '', files: doc.files || [], media_links: doc.media_links || [],
    version_reason: doc.version_reason || '', version_at_ms: Number(doc.version_at_ms) || Number(doc.published_at_ms) || 0,
  };
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  await ref.update({
    title: value.title, summary: value.summary, body: value.body, media_links: value.media_links, signed_by: value.signed_by, tags: value.tags, act_date: value.act_date,
    files: [...mantidos, ...novos], version: versao, version_reason: reason, version_at_ms: ctx.now, versions: [...versoes, anterior],
    updated_at: ts, updated_at_ms: ctx.now, updated_by: actor.uid,
  });
  await a.auditoria(ctx, actor, 'club_doc_rectify', { club_id: club.id, doc_id: doc.id, version: versao, reason });
  return { ok: true, version: versao };
}

async function visibility(ctx, actor, data, { club }) {
  const { ref, doc } = await documento(ctx, club, data.docId);
  if (doc.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Só um documento publicado muda de visibilidade.');
  const nova = A.VISIBILITY.includes(data.visibility) ? data.visibility : null;
  if (!nova) falha('invalid-argument', 'Visibilidade inválida.');
  if (nova === doc.visibility) return { ok: true };
  const publico = nova === 'public';
  const files = await ajustarLinks(ctx, doc.files, publico);
  const versions = [];
  for (const v of doc.versions || []) {
    // eslint-disable-next-line no-await-in-loop
    versions.push({ ...v, files: await ajustarLinks(ctx, v.files, publico) });
  }
  await ref.update({ visibility: nova, files, versions, ...P.readFlags(A.STATUS.PUBLISHED, nova), updated_at_ms: ctx.now, updated_by: actor.uid });
  await a.auditoria(ctx, actor, 'club_doc_visibility', { club_id: club.id, doc_id: doc.id, from: doc.visibility, to: nova });
  return { ok: true };
}

async function withdraw(ctx, actor, data, { club, perms }) {
  if (!perms.includes('admin')) falha('permission-denied', 'Só quem administra o clube retira um documento do ar.');
  const { ref, doc } = await documento(ctx, club, data.docId);
  if (doc.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Só um documento publicado é retirado do ar.');
  const reason = texto(data.reason, 500);
  if (reason.length < A.WITHDRAW_REASON_MIN) falha('invalid-argument', `Diga o motivo (mínimo ${A.WITHDRAW_REASON_MIN} caracteres).`);
  // O link público morre (token novo); o arquivo fica, para a equipe e para a história.
  const matar = async (files) => {
    for (const item of files || []) {
      // eslint-disable-next-line no-await-in-loop
      if (ctx.bucket) await ctx.bucket.file(item.path).setMetadata({ metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } }).catch(() => {});
    }
    return (files || []).map(({ url: _url, ...resto }) => resto);
  };
  const files = await matar(doc.files);
  const versions = [];
  for (const v of doc.versions || []) {
    // eslint-disable-next-line no-await-in-loop
    versions.push({ ...v, files: await matar(v.files) });
  }
  await ref.update({
    status: A.STATUS.WITHDRAWN, files, versions, ...P.readFlags(A.STATUS.WITHDRAWN, doc.visibility),
    withdrawn_reason: reason, withdrawn_at_ms: ctx.now, withdrawn_by: actor.uid, updated_at_ms: ctx.now,
  });
  await a.auditoria(ctx, actor, 'club_doc_withdraw', { club_id: club.id, doc_id: doc.id, code: doc.code || '', reason });
  return { ok: true };
}

/**
 * O AVISO do ato publicado aos associados em dia (sino, e-mail e push pelas regras
 * de `messaging`), uma vez por versão: quem comunica não lê a lista de associados
 * (dado pessoal). "Só a equipe" não avisa ninguém.
 */
async function notify(ctx, actor, data, { club }) {
  const { ref, doc } = await documento(ctx, club, data.docId);
  if (doc.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Publique o documento antes de avisar os associados.');
  if (doc.visibility === 'staff') falha('failed-precondition', 'Documento só da equipe não avisa os associados.');
  const versao = Number(doc.version) || 1;
  if (Number(doc.notified_version) === versao) falha('failed-precondition', 'Os associados já foram avisados desta versão.');
  const hoje = m.isoDateBR(ctx.now);
  const ativos = await col(ctx, club.id, 'aff').where('status', '==', 'active').get();
  const uids = [...new Set(ativos.docs.map((d) => d.data()).filter((x) => m.membershipState(x, hoje, ctx.now).status === 'active').map((x) => x.user_id).filter((u) => u && u !== actor.uid))];
  const params = { clube: a.sigla(club) || club.name, titulo: texto(doc.code ? `${doc.code} — ${doc.title}` : doc.title, 140) };
  const title = versao > 1 ? tx('{clube} retificou: {titulo}', params) : tx('{clube} publicou: {titulo}', params);
  const message = texto(doc.summary, 300);
  const link = `/clubes/${encodeURIComponent(club.id)}?tab=documentos&doc=${encodeURIComponent(doc.id)}`;
  for (let i = 0; i < uids.length; i += LOTE) {
    const batch = ctx.db.batch();
    uids.slice(i, i + LOTE).forEach((uid) => a.aviso(ctx, batch, uid, { title, message, link }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  await ref.update({ notified_version: versao, notified_at_ms: ctx.now, notified_count: uids.length, notified_by: actor.uid });
  await a.auditoria(ctx, actor, 'club_doc_notify', { club_id: club.id, doc_id: doc.id, version: versao, count: uids.length });
  return { ok: true, count: uids.length };
}

/** Quem lê o documento: a equipe do acervo sempre; o publicado público, todos; o "só associados", quem é membro do clube. */
async function podeLer(ctx, club, doc, actor, perms) {
  if (podeAcervo(perms)) return true;
  if (doc.status !== A.STATUS.PUBLISHED) return false;
  if (doc.visibility === 'public') return true;
  if (doc.visibility !== 'members') return false;
  const membro = await ctx.db.collection('club_members').doc(`${club.id}_${actor.uid}`).get();
  return membro.exists;
}

async function file(ctx, actor, data, { club, perms }) {
  const { doc } = await documento(ctx, club, data.docId);
  if (!(await podeLer(ctx, club, doc, actor, perms))) falha('permission-denied', 'Você não tem acesso a este documento.');
  const path = String(data.path || '');
  const todos = [...(doc.files || []), ...(doc.versions || []).flatMap((v) => v.files || [])];
  const item = todos.find((x) => x.path === path);
  if (!item) falha('not-found', 'Arquivo não encontrado neste documento.');
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const alvo = ctx.bucket.file(path);
  const [meta] = await alvo.getMetadata().catch(() => [null]);
  if (!meta) falha('not-found', 'O arquivo não está mais no servidor.');
  if (Number(meta.size) > A.RESTRICTED_FILE_MAX) falha('failed-precondition', 'Arquivo grande demais para abrir por aqui.');
  const [bytes] = await alvo.download();
  return { ok: true, name: item.name, contentType: meta.contentType || item.content_type || 'application/octet-stream', base64: Buffer.from(bytes).toString('base64') };
}

const ACOES = { save, delete: remove, publish, rectify, visibility, withdraw, notify };

/**
 * Cria e PUBLICA um ato só de texto (sem arquivo), pela mesma régua e numeração do
 * `publish`: o edital e a ata das eleições (`clubElections.js`). Quem chama já conferiu
 * a permissão. Não avisa ninguém (a eleição avisa pelo caminho dela).
 */
async function publicarAtoDeTexto(ctx, actor, club, input) {
  const value = exigeValido({ ...input, files: [], media_links: [], relations: [] });
  const ref = col(ctx, club.id, DOCS).doc();
  const ano = anoBrasil(ctx.now);
  const seqRef = col(ctx, club.id, SEQ).doc(DOCS);
  const resultado = await ctx.db.runTransaction(async (tr) => {
    const seqSnap = await tr.get(seqRef);
    let number = null;
    if (A.TYPES[value.type].numbered) {
      const contadores = { ...((seqSnap.data() || {}).counters || {}) };
      const chave = A.counterKey(value.type, ano);
      number = (Number(contadores[chave]) || 0) + 1;
      contadores[chave] = number;
      tr.set(seqRef, { club_id: club.id, counters: contadores, updated_at_ms: ctx.now });
    }
    const code = A.codeOf(value.type, number, ano);
    const ts = ctx.Timestamp.fromMillis(ctx.now);
    tr.set(ref, {
      club_id: club.id, ...value, status: A.STATUS.PUBLISHED, number, year: ano, code, ...P.readFlags(A.STATUS.PUBLISHED, value.visibility),
      version: 1, version_reason: '', version_at_ms: ctx.now, versions: [],
      created_by: actor.uid, created_by_name: texto(actor.name, 80), created_at: ts, created_at_ms: ctx.now,
      published_at: ts, published_at_ms: ctx.now, published_by: actor.uid, published_by_name: texto(actor.name, 80),
      updated_at: ts, updated_at_ms: ctx.now,
    });
    return { number, code };
  });
  await a.auditoria(ctx, actor, 'club_doc_publish', { club_id: club.id, doc_id: ref.id, code: resultado.code, type: value.type, origin: input.origin || '' });
  return { docId: ref.id, ...resultado };
}

async function docs(ctx, actor, data = {}) {
  const c = await contexto(ctx, actor, data);
  if (data.action === 'file') return file(ctx, actor, data, c);
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  if (!podeAcervo(c.perms)) falha('permission-denied', 'Você não tem permissão para o acervo deste clube.');
  return fn(ctx, actor, data, c);
}

module.exports = { docs, publicarAtoDeTexto, DOCS, SEQ, VERSIONS_MAX };
