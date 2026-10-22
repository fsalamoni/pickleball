/**
 * ACERVO OFICIAL da federação (módulo `official_docs`) — só o SERVIDOR grava
 * `federation_docs` (a regra é `allow write: if false`). Por que aqui: a
 * numeração por tipo e ano, a imutabilidade do publicado, o SHA-256 dos
 * arquivos e a cópia da pasta privada de quem enviou para a pasta oficial
 * não se garantem no navegador.
 *
 * Callable `federationAcervo` (permissão `docs` ou `admin` na federação):
 *  - `save`: cria/edita um RASCUNHO (publicado não se edita);
 *  - `delete`: apaga um rascunho (e os arquivos que ele enviou);
 *  - `publish`: confere relações, copia os arquivos para
 *    `federacao-acervo-oficial/{fed}/{doc}/v1/`, calcula o SHA-256, dá o
 *    número (Resolução nº 3/2026) numa transação e marca os atos que ele
 *    revoga, altera ou corrige;
 *  - `rectify`: nova versão (motivo obrigatório); a anterior fica no
 *    histórico, com os arquivos e os códigos de integridade;
 *  - `visibility`: público / só filiados / só equipe — o link público do
 *    arquivo só existe enquanto o documento é público;
 *  - `withdraw` (só `admin`): retira do ar com motivo (ordem judicial, dado
 *    pessoal). Nada é apagado; o link público morre;
 *  - publicar e retificar avisam quem SEGUE o acervo (`federation_followers`)
 *    e pode ler o ato;
 *  - `file`: entrega o arquivo (até 9 MB) a quem pode ler o documento e não
 *    tem link público — filiado, equipe, rascunho.
 *
 * A conta pura (tipos, arquivos, validação) é `federationAcervoPolicy.js`.
 */
const crypto = require('node:crypto');
const A = require('./federationAcervoPolicy.js');
const f = require('./federations.js');
const P = require('./federationStaffPolicy.js');
const { tx } = require('./avisoI18n.js');

const { falha, texto } = f;
const DOCS = 'federation_docs';
const VERSIONS_MAX = 10;
const BR_OFFSET_MS = 3 * 3600000;

const FOLLOWERS = 'federation_followers';
const LOTE = 400;

const podeAcervo = (perms) => perms.includes('docs') || perms.includes('admin');

/**
 * Avisa quem SEGUE as publicações oficiais (`federation_followers`): o ato do
 * acervo e o evento do calendário (`federationAgenda.js`). Só quem pode ler
 * recebe: público ⇒ todos; só filiados ⇒ filiado ativo ou equipe; só equipe
 * ⇒ ninguém (a equipe já está na Central). Quem agiu não se avisa. Falha aqui
 * nunca desfaz o que foi gravado: devolve -1.
 */
async function avisarSeguidores(ctx, actor, fed, { visibility, title, message, link }) {
  if (visibility === 'staff') return 0;
  try {
    const snap = await ctx.db.collection(FOLLOWERS).where('federation_id', '==', fed.id).get();
    let uids = [...new Set(snap.docs.map((d) => d.data().user_id).filter((u) => u && u !== actor.uid))];
    if (!uids.length) return 0;
    if (visibility === 'members') {
      const [membros, equipe] = await Promise.all([
        ctx.db.collection(f.C.members).where('federation_id', '==', fed.id).where('status', '==', 'active').get(),
        ctx.db.collection(f.C.staff).where('federation_id', '==', fed.id).get(),
      ]);
      const podem = new Set([
        ...membros.docs.map((d) => d.data().user_id),
        ...equipe.docs.map((d) => d.data()).filter((s) => P.permsOf(s, ctx.now).length > 0).map((s) => s.user_id),
      ].filter(Boolean));
      uids = uids.filter((u) => podem.has(u));
    }
    for (let i = 0; i < uids.length; i += LOTE) {
      const batch = ctx.db.batch();
      uids.slice(i, i + LOTE).forEach((uid) => f.aviso(ctx, batch, uid, { title, message, link }));
      await batch.commit();
    }
    return uids.length;
  } catch {
    return -1;
  }
}

/** O aviso do ato publicado ou retificado. */
function avisarDoAto(ctx, actor, fed, doc, kind) {
  const params = { sigla: fed.acronym || fed.name, titulo: texto(doc.title, 140) };
  return avisarSeguidores(ctx, actor, fed, {
    visibility: doc.visibility,
    title: kind === 'rectify' ? tx('{sigla} retificou: {titulo}', params) : tx('{sigla} publicou: {titulo}', params),
    message: texto(doc.summary, 300) || (doc.code ? texto(doc.code, 80) : ''),
    link: `/f/${encodeURIComponent(fed.slug || fed.id)}/acervo/${encodeURIComponent(doc.id)}`,
  });
}
const anoBrasil = (ms) => new Date(ms - BR_OFFSET_MS).getUTCFullYear();

async function contexto(ctx, actor, data) {
  if (!(await f.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  const fed = await f.federacao(ctx, data.federationId);
  if (fed.status !== 'approved') falha('failed-precondition', 'A federação ainda não foi aprovada pela plataforma.');
  if (!(fed.modules && fed.modules.official_docs === true)) falha('failed-precondition', 'Esta federação não tem o acervo oficial ligado.');
  const perms = await f.staffPerms(ctx, fed.id, actor);
  return { fed, perms };
}

async function documento(ctx, fed, docId) {
  const ref = ctx.db.collection(DOCS).doc(texto(docId, 80));
  const snap = await ref.get();
  if (!snap.exists || snap.data().federation_id !== fed.id) falha('not-found', 'Documento não encontrado.');
  return { ref, doc: { id: snap.id, ...snap.data() } };
}

function exigeValido(input) {
  const r = A.validateDoc(input);
  if (!r.ok) falha('invalid-argument', Object.values(r.errors)[0]);
  return r.value;
}

/** As relações apontam atos PUBLICADOS desta federação (e revogar/alterar/corrigir um revogado não faz sentido). */
async function alvos(ctx, fed, relations, docId) {
  const lista = [];
  for (const r of relations) {
    if (r.doc_id === docId) falha('invalid-argument', 'Um documento não se relaciona com ele mesmo.');
    const snap = await ctx.db.collection(DOCS).doc(r.doc_id).get();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.federation_id !== fed.id || d.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Uma relação aponta um documento que não está publicado nesta federação.');
    if (['revokes', 'amends', 'errata'].includes(r.kind) && d.revoked_by) falha('failed-precondition', `"${d.code || d.title}" já foi revogado.`);
    lista.push({ ...r, ref: snap.ref || ctx.db.collection(DOCS).doc(r.doc_id) });
  }
  return lista;
}

/** Arquivo NOVO só da pasta de quem está salvando (ninguém anexa o rascunho que outra pessoa enviou e não usou). */
function exigeDono(files, actor, jaNoDocumento = []) {
  const antigos = new Set(jaNoDocumento.map((x) => x.path));
  const alheio = files.find((x) => !antigos.has(x.path) && !x.path.startsWith(`federacao-acervo/${actor.uid}/`));
  if (alheio) falha('permission-denied', `O arquivo "${alheio.name}" não foi enviado por você. Envie de novo.`);
}

/* -------------------------------------------------------------- arquivos -- */

const urlPublica = (bucket, path, token) => `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    file.createReadStream().on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

const disposicao = (nome) => `inline; filename*=UTF-8''${encodeURIComponent(String(nome || 'arquivo').slice(0, 120))}`;

/**
 * Copia o rascunho para a pasta oficial, confere tipo e tamanho pelo que o
 * STORAGE diz (não pelo que a tela mandou), calcula o SHA-256 e, se público,
 * cria o link (token de download). O arquivo de origem é apagado depois.
 */
async function oficializar(ctx, item, dest, publico) {
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const origem = ctx.bucket.file(item.path);
  const [meta] = await origem.getMetadata().catch(() => [null]);
  if (!meta) falha('failed-precondition', `O arquivo "${item.name}" não chegou ao servidor. Envie de novo.`);
  const contentType = String(meta.contentType || '');
  const fam = A.familyOf(contentType);
  const size = Number(meta.size) || 0;
  if (!fam || !(size > 0) || size > fam.max) falha('failed-precondition', `O arquivo "${item.name}" não é aceito.`);
  if (!publico && size > A.RESTRICTED_FILE_MAX) falha('failed-precondition', `"${item.name}" passa de 9 MB: documento só para filiados ou equipe aceita até 9 MB por arquivo.`);
  const destino = ctx.bucket.file(dest);
  await origem.copy(destino);
  const hash = await sha256(destino);
  const token = crypto.randomUUID();
  await destino.setMetadata({
    contentType, contentDisposition: disposicao(item.name),
    cacheControl: publico ? 'public, max-age=31536000, immutable' : 'private, max-age=0',
    metadata: { firebaseStorageDownloadTokens: token },
  });
  await origem.delete().catch(() => {});
  return { name: item.name, path: dest, size, content_type: contentType, sha256: hash, ...(publico ? { url: urlPublica(ctx.bucket, dest, token) } : {}) };
}

/** Liga (público) ou mata (restrito) o link de cada arquivo já oficial. */
async function ajustarLinks(ctx, files, publico) {
  if (!ctx.bucket) falha('unavailable', 'Arquivos indisponíveis no momento. Tente de novo.');
  const out = [];
  for (const item of files || []) {
    if (!publico && Number(item.size) > A.RESTRICTED_FILE_MAX) falha('failed-precondition', `"${item.name}" passa de 9 MB: só pode ficar público.`);
    const token = crypto.randomUUID(); // um token novo invalida o link antigo
    await ctx.bucket.file(item.path).setMetadata({ cacheControl: publico ? 'public, max-age=31536000, immutable' : 'private, max-age=0', metadata: { firebaseStorageDownloadTokens: token } });
    const { url: _url, ...resto } = item;
    out.push(publico ? { ...resto, url: urlPublica(ctx.bucket, item.path, token) } : resto);
  }
  return out;
}

const caminhoOficial = (fedId, docId, versao, i, contentType) => {
  const ext = (String(contentType).split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  return `federacao-acervo-oficial/${fedId}/${docId}/v${versao}/${i + 1}.${ext}`;
};

/* ---------------------------------------------------------------- ações -- */

async function save(ctx, actor, data, { fed }) {
  const value = exigeValido(data.doc || {});
  const ts = ctx.Timestamp.fromMillis(ctx.now);
  if (data.docId) {
    const { ref, doc } = await documento(ctx, fed, data.docId);
    if (doc.status !== A.STATUS.DRAFT) falha('failed-precondition', 'Documento publicado não se edita: use retificação, errata ou um novo ato.');
    exigeDono(value.files, actor, doc.files || []);
    await alvos(ctx, fed, value.relations, doc.id);
    await ref.update({ ...value, updated_at: ts, updated_at_ms: ctx.now, updated_by: actor.uid });
    await f.auditoria(ctx, actor, 'federation_doc_save', { federation_id: fed.id, doc_id: doc.id });
    return { ok: true, docId: doc.id };
  }
  exigeDono(value.files, actor);
  await alvos(ctx, fed, value.relations, null);
  const ref = ctx.db.collection(DOCS).doc();
  await ref.set({
    federation_id: fed.id, ...value, status: A.STATUS.DRAFT, version: 0,
    created_by: actor.uid, created_by_name: texto(actor.name, 80), created_at: ts, created_at_ms: ctx.now, updated_at: ts, updated_at_ms: ctx.now,
  });
  await f.auditoria(ctx, actor, 'federation_doc_save', { federation_id: fed.id, doc_id: ref.id, created: true });
  return { ok: true, docId: ref.id };
}

async function remove(ctx, actor, data, { fed }) {
  const { ref, doc } = await documento(ctx, fed, data.docId);
  if (doc.status !== A.STATUS.DRAFT) falha('failed-precondition', 'Documento publicado não se apaga. Para tirar do ar, um admin usa "Retirar do ar".');
  await ref.delete();
  if (ctx.bucket) await Promise.all((doc.files || []).map((x) => ctx.bucket.file(x.path).delete().catch(() => {})));
  await f.auditoria(ctx, actor, 'federation_doc_delete', { federation_id: fed.id, doc_id: doc.id });
  return { ok: true };
}

/** Marca no alvo a relação recebida (sem repetir). */
const marcaRecebida = (alvo, rel, novo) => {
  const lista = (Array.isArray(alvo.related_by) ? alvo.related_by : []).filter((x) => x.doc_id !== novo.id);
  lista.push({ kind: rel.kind, doc_id: novo.id, code: novo.code || '', title: novo.title });
  return { related_by: lista.slice(-50), ...(rel.kind === 'revokes' ? { revoked_by: { doc_id: novo.id, code: novo.code || '', title: novo.title, at_ms: novo.at_ms } } : {}) };
};

async function publish(ctx, actor, data, { fed }) {
  const { ref, doc } = await documento(ctx, fed, data.docId);
  if (doc.status !== A.STATUS.DRAFT) falha('failed-precondition', 'Este documento já foi publicado.');
  const value = exigeValido(doc);
  const rels = await alvos(ctx, fed, value.relations, doc.id);
  const publico = value.visibility === 'public';
  const files = [];
  for (const [i, item] of value.files.entries()) files.push(await oficializar(ctx, item, caminhoOficial(fed.id, doc.id, 1, i, item.content_type), publico));
  const ano = anoBrasil(ctx.now);
  const fedRef = ctx.db.collection(f.C.federations).doc(fed.id);
  const resultado = await ctx.db.runTransaction(async (tr) => {
    const [fedSnap, docSnap, ...alvoSnaps] = await Promise.all([tr.get(fedRef), tr.get(ref), ...rels.map((r) => tr.get(r.ref))]);
    if (!docSnap.exists || docSnap.data().status !== A.STATUS.DRAFT) falha('failed-precondition', 'Este documento já foi publicado.');
    const numerado = A.TYPES[value.type].numbered;
    let number = null;
    if (numerado) {
      const contadores = { ...((fedSnap.data() || {}).doc_numbers || {}) };
      const chave = A.counterKey(value.type, ano);
      number = (Number(contadores[chave]) || 0) + 1;
      contadores[chave] = number;
      tr.update(fedRef, { doc_numbers: contadores });
    }
    const code = A.codeOf(value.type, number, ano);
    const ts = ctx.Timestamp.fromMillis(ctx.now);
    tr.update(ref, {
      ...value, files, status: A.STATUS.PUBLISHED, number, year: ano, code,
      version: 1, version_reason: '', version_at_ms: ctx.now, versions: [],
      published_at: ts, published_at_ms: ctx.now, published_by: actor.uid, published_by_name: texto(actor.name, 80),
      updated_at: ts, updated_at_ms: ctx.now,
    });
    const novo = { id: doc.id, code, title: value.title, at_ms: ctx.now };
    alvoSnaps.forEach((s, i) => tr.update(rels[i].ref, marcaRecebida(s.data() || {}, rels[i], novo)));
    return { number, code };
  });
  const avisados = await avisarDoAto(ctx, actor, fed, { ...value, id: doc.id, code: resultado.code }, 'publish');
  await f.auditoria(ctx, actor, 'federation_doc_publish', { federation_id: fed.id, doc_id: doc.id, code: resultado.code, type: value.type, followers_notified: avisados });
  return { ok: true, ...resultado, notified: avisados };
}

async function rectify(ctx, actor, data, { fed }) {
  const { ref, doc } = await documento(ctx, fed, data.docId);
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
  const r = A.validateDoc({
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
  for (const [i, item] of value.files.entries()) novos.push(await oficializar(ctx, item, caminhoOficial(fed.id, doc.id, versao, i, item.content_type), publico));
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
  const avisados = await avisarDoAto(ctx, actor, fed, { ...doc, title: value.title, summary: value.summary }, 'rectify');
  await f.auditoria(ctx, actor, 'federation_doc_rectify', { federation_id: fed.id, doc_id: doc.id, version: versao, reason, followers_notified: avisados });
  return { ok: true, version: versao, notified: avisados };
}

async function visibility(ctx, actor, data, { fed }) {
  const { ref, doc } = await documento(ctx, fed, data.docId);
  if (doc.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Só um documento publicado muda de visibilidade.');
  const nova = A.VISIBILITY.includes(data.visibility) ? data.visibility : null;
  if (!nova) falha('invalid-argument', 'Visibilidade inválida.');
  if (nova === doc.visibility) return { ok: true };
  const publico = nova === 'public';
  const files = await ajustarLinks(ctx, doc.files, publico);
  const versions = [];
  for (const v of doc.versions || []) versions.push({ ...v, files: await ajustarLinks(ctx, v.files, publico) });
  await ref.update({ visibility: nova, files, versions, updated_at_ms: ctx.now, updated_by: actor.uid });
  await f.auditoria(ctx, actor, 'federation_doc_visibility', { federation_id: fed.id, doc_id: doc.id, from: doc.visibility, to: nova });
  return { ok: true };
}

async function withdraw(ctx, actor, data, { fed, perms }) {
  if (!perms.includes('admin')) falha('permission-denied', 'Só quem administra a federação retira um documento do ar.');
  const { ref, doc } = await documento(ctx, fed, data.docId);
  if (doc.status !== A.STATUS.PUBLISHED) falha('failed-precondition', 'Só um documento publicado é retirado do ar.');
  const reason = texto(data.reason, 500);
  if (reason.length < A.WITHDRAW_REASON_MIN) falha('invalid-argument', `Diga o motivo (mínimo ${A.WITHDRAW_REASON_MIN} caracteres).`);
  // O link público morre (token novo); o arquivo fica, para a equipe e para a história.
  const matar = async (files) => {
    for (const item of files || []) {
      if (ctx.bucket) await ctx.bucket.file(item.path).setMetadata({ metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } }).catch(() => {});
    }
    return (files || []).map(({ url: _url, ...resto }) => resto);
  };
  const files = await matar(doc.files);
  const versions = [];
  for (const v of doc.versions || []) versions.push({ ...v, files: await matar(v.files) });
  await ref.update({ status: A.STATUS.WITHDRAWN, files, versions, withdrawn_reason: reason, withdrawn_at_ms: ctx.now, withdrawn_by: actor.uid, updated_at_ms: ctx.now });
  await f.auditoria(ctx, actor, 'federation_doc_withdraw', { federation_id: fed.id, doc_id: doc.id, code: doc.code || '', reason });
  return { ok: true };
}

/** Quem lê o documento: equipe do acervo sempre; publicado público, todos; só filiados, filiado ativo ou equipe; só equipe, a equipe. */
async function podeLer(ctx, fed, doc, actor, perms) {
  if (podeAcervo(perms)) return true;
  if (doc.status !== A.STATUS.PUBLISHED) return false;
  if (doc.visibility === 'public') return true;
  if (perms.length > 0) return true;
  if (doc.visibility !== 'members') return false;
  const m = await ctx.db.collection(f.C.members).doc(`${fed.id}_${actor.uid}`).get();
  return m.exists && m.data().status === 'active';
}

async function file(ctx, actor, data, { fed, perms }) {
  const { doc } = await documento(ctx, fed, data.docId);
  if (!(await podeLer(ctx, fed, doc, actor, perms))) falha('permission-denied', 'Você não tem acesso a este documento.');
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

/**
 * Publica DIRETO um ato só de texto, gerado por outro módulo (o edital e a
 * ata das eleições): mesma régua, mesma numeração e mesmo aviso a quem segue
 * do `publish`, sem passar por rascunho. Quem chama já conferiu a permissão.
 */
async function publicarAtoDeTexto(ctx, actor, fed, input) {
  const value = exigeValido({ ...input, files: [], media_links: [], relations: [] });
  const ref = ctx.db.collection(DOCS).doc();
  const ano = anoBrasil(ctx.now);
  const fedRef = ctx.db.collection(f.C.federations).doc(fed.id);
  const resultado = await ctx.db.runTransaction(async (tr) => {
    const fedSnap = await tr.get(fedRef);
    const contadores = { ...((fedSnap.data() || {}).doc_numbers || {}) };
    let number = null;
    if (A.TYPES[value.type].numbered) {
      const chave = A.counterKey(value.type, ano);
      number = (Number(contadores[chave]) || 0) + 1;
      contadores[chave] = number;
      tr.update(fedRef, { doc_numbers: contadores });
    }
    const code = A.codeOf(value.type, number, ano);
    const ts = ctx.Timestamp.fromMillis(ctx.now);
    tr.set(ref, {
      federation_id: fed.id, ...value, status: A.STATUS.PUBLISHED, number, year: ano, code,
      version: 1, version_reason: '', version_at_ms: ctx.now, versions: [],
      created_by: actor.uid, created_by_name: texto(actor.name, 80), created_at: ts, created_at_ms: ctx.now,
      published_at: ts, published_at_ms: ctx.now, published_by: actor.uid, published_by_name: texto(actor.name, 80),
      updated_at: ts, updated_at_ms: ctx.now,
    });
    return { number, code };
  });
  await avisarDoAto(ctx, actor, fed, { ...value, id: ref.id, code: resultado.code }, 'publish');
  await f.auditoria(ctx, actor, 'federation_doc_publish', { federation_id: fed.id, doc_id: ref.id, code: resultado.code, type: value.type, origin: input.origin || '' });
  return { docId: ref.id, ...resultado };
}

const ACOES = { save, delete: remove, publish, rectify, visibility, withdraw };

/**
 * Cria e publica um ato de uma vez, pela MESMA régua (`save` + `publish`):
 * usado pela prestação de contas (`federationAccounts.js`), que já conferiu a
 * permissão dela. Os arquivos têm de estar em `federacao-acervo/{actor}/`.
 */
async function publicarAto(ctx, actor, fed, doc) {
  const { docId } = await save(ctx, actor, { doc }, { fed });
  const r = await publish(ctx, actor, { docId }, { fed });
  return { ...r, docId };
}

async function acervo(ctx, actor, data = {}) {
  const c = await contexto(ctx, actor, data);
  if (data.action === 'file') return file(ctx, actor, data, c);
  const fn = ACOES[data.action];
  if (!fn) falha('invalid-argument', 'Ação desconhecida.');
  if (!podeAcervo(c.perms)) falha('permission-denied', 'Você não tem permissão para o acervo desta federação.');
  return fn(ctx, actor, data, c);
}

module.exports = { acervo, avisarSeguidores, publicarAtoDeTexto, DOCS, FOLLOWERS, VERSIONS_MAX, oficializar, publicarAto };
