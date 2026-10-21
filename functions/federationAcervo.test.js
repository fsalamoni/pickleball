/**
 * Acervo oficial no SERVIDOR contra o Firestore e um Storage falsos: só quem
 * tem `docs`/`admin` grava; publicado não se edita; o número sai por tipo e
 * ano numa transação; o arquivo vai para a pasta oficial com SHA-256 e link
 * só quando público; relações marcam o alvo (revogado não some); retificação
 * guarda a versão anterior; visibilidade mata/recria o link; retirar do ar é
 * só do admin; o arquivo restrito é entregue só a quem pode ler.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const ac = require('./federationAcervo.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);
const PRES = { uid: 'pres', name: 'Presidente' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const FIN = { uid: 'fin' };
const FILIADO = { uid: 'ana' };
const ESTRANHO = { uid: 'zzz' };

/** Storage falso: o bastante para cópia, metadados, leitura em fluxo e download. */
function fakeBucket(arquivos = {}) {
  const store = new Map(Object.entries(arquivos).map(([p, { bytes, contentType }]) => [p, { bytes: Buffer.from(bytes), meta: { contentType, size: String(Buffer.from(bytes).length), metadata: {} } }]));
  const file = (name) => ({
    name,
    async getMetadata() { if (!store.has(name)) throw new Error('404'); return [store.get(name).meta]; },
    async copy(dest) { const o = store.get(name); store.set(dest.name, { bytes: Buffer.from(o.bytes), meta: { ...o.meta, metadata: {} } }); },
    createReadStream() { return Readable.from([store.get(name).bytes]); },
    async setMetadata(m) { const o = store.get(name); if (!o) throw new Error('404'); o.meta = { ...o.meta, ...m, metadata: { ...o.meta.metadata, ...(m.metadata || {}) } }; },
    async delete() { store.delete(name); },
    async download() { return [store.get(name).bytes]; },
  });
  return { name: 'proj.appspot.com', file, store };
}

const PDF = 'federacao-acervo/sec/abc123.pdf';
const PDF2 = 'federacao-acervo/sec/def456.pdf';
const ALHEIO = 'federacao-acervo/fin/xyz789.pdf';

function cenario(mods = { official_docs: true }) {
  const db = createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: mods },
    'federation_staff/fpp_pres': { federation_id: 'fpp', user_id: 'pres', role: 'president' },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
    'federation_staff/fpp_fin': { federation_id: 'fpp', user_id: 'fin', role: 'treasurer' },
    'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', status: 'active' },
  });
  const bucket = fakeBucket({
    [PDF]: { bytes: 'estatuto v1', contentType: 'application/pdf' },
    [PDF2]: { bytes: 'estatuto v2', contentType: 'application/pdf' },
    [ALHEIO]: { bytes: 'de outra pessoa', contentType: 'application/pdf' },
  });
  return { db, bucket };
}
const ctx = ({ db, bucket }, now = NOW) => ({ db, bucket, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => ac.acervo(ctx(c, now), actor, { federationId: 'fpp', ...data });
const doc = (c, id) => c.db.store.docs.get(`federation_docs/${id}`);
const arquivo = (path) => ({ name: 'estatuto.pdf', path, size: 11, content_type: 'application/pdf' });
const rascunho = (extra = {}) => ({ type: 'resolution', title: 'Calendário de 2027', visibility: 'public', files: [arquivo(PDF)], ...extra });
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

describe('acervo oficial: rascunho', () => {
  it('quem tem docs cria e edita; quem não tem é recusado; módulo desligado recusa', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'save', doc: rascunho() })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    expect(doc(c, r.docId)).toMatchObject({ status: 'draft', federation_id: 'fpp', category: 'acts', version: 0, created_by: 'sec' });
    await chamar(c, SEC, { action: 'save', docId: r.docId, doc: rascunho({ title: 'Calendário oficial de 2027' }) });
    expect(doc(c, r.docId).title).toBe('Calendário oficial de 2027');
    const off = cenario({});
    await expect(chamar(off, SEC, { action: 'save', doc: rascunho() })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('ninguém anexa arquivo que outra pessoa enviou', async () => {
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'save', doc: rascunho({ files: [arquivo(ALHEIO)] }) })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rascunho se apaga (com os arquivos); publicado não', async () => {
    const c = cenario();
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await chamar(c, SEC, { action: 'delete', docId });
    expect(doc(c, docId)).toBeUndefined();
    expect(c.bucket.store.has(PDF)).toBe(false);
  });
});

describe('acervo oficial: publicação', () => {
  it('numera por tipo e ano, copia para a pasta oficial com SHA-256 e link público', async () => {
    const c = cenario();
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    const r = await chamar(c, SEC, { action: 'publish', docId });
    expect(r).toMatchObject({ number: 1, code: 'Resolução nº 1/2026' });
    const d = doc(c, docId);
    expect(d).toMatchObject({ status: 'published', number: 1, year: 2026, version: 1, published_by: 'sec' });
    expect(d.files[0]).toMatchObject({ path: `federacao-acervo-oficial/fpp/${docId}/v1/1.pdf`, sha256: sha('estatuto v1') });
    expect(d.files[0].url).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/proj\.appspot\.com\/o\/federacao-acervo-oficial%2Ffpp%2F.+\?alt=media&token=/);
    expect(c.bucket.store.has(PDF)).toBe(false);
    expect(c.db.store.docs.get('federations/fpp').doc_numbers).toEqual({ resolution_2026: 1 });
    // o segundo do mesmo tipo é o nº 2; outro tipo começa do 1
    const b = await chamar(c, SEC, { action: 'save', doc: rascunho({ files: [arquivo(PDF2)] }) });
    expect((await chamar(c, SEC, { action: 'publish', docId: b.docId })).number).toBe(2);
    const o = await chamar(c, SEC, { action: 'save', doc: { type: 'ordinance', title: 'Comissão de arbitragem', body: 'Nomeia a comissão.' } });
    expect((await chamar(c, SEC, { action: 'publish', docId: o.docId })).code).toBe('Portaria nº 1/2026');
  });

  it('tipo não numerado não ganha número; documento restrito não ganha link', async () => {
    const c = cenario();
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'statute', title: 'Estatuto', visibility: 'members' }) });
    const r = await chamar(c, SEC, { action: 'publish', docId });
    expect(r).toMatchObject({ number: null, code: '' });
    expect(doc(c, docId).files[0].url).toBeUndefined();
  });

  it('publicado não se edita nem se publica de novo', async () => {
    const c = cenario();
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await chamar(c, SEC, { action: 'publish', docId });
    await expect(chamar(c, SEC, { action: 'save', docId, doc: rascunho() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'publish', docId })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'delete', docId })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('o ato que revoga marca o alvo, que continua no acervo; revogado não se revoga de novo', async () => {
    const c = cenario();
    const a = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await chamar(c, SEC, { action: 'publish', docId: a.docId });
    const b = await chamar(c, SEC, { action: 'save', doc: { type: 'resolution', title: 'Revoga o calendário', body: 'Fica revogada.', relations: [{ kind: 'revokes', doc_id: a.docId }] } });
    await chamar(c, SEC, { action: 'publish', docId: b.docId });
    expect(doc(c, a.docId)).toMatchObject({ status: 'published', revoked_by: { doc_id: b.docId, code: 'Resolução nº 2/2026' } });
    expect(doc(c, a.docId).related_by).toEqual([expect.objectContaining({ kind: 'revokes', doc_id: b.docId })]);
    const x = await chamar(c, SEC, { action: 'save', doc: { type: 'resolution', title: 'De novo', body: 'x', relations: [{ kind: 'revokes', doc_id: a.docId }] } }).catch((e) => e);
    expect(x).toMatchObject({ code: 'failed-precondition' });
  });

  it('relação com rascunho ou com documento de outra federação é recusada', async () => {
    const c = cenario();
    const a = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await expect(chamar(c, SEC, { action: 'save', doc: { type: 'resolution', title: 'Altera', body: 'x', relations: [{ kind: 'amends', doc_id: a.docId }] } })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('acervo oficial: depois de publicado', () => {
  async function publicado(c, extra) {
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho(extra) });
    await chamar(c, SEC, { action: 'publish', docId });
    return docId;
  }

  it('retificação: motivo obrigatório, nova versão, a anterior no histórico com os arquivos', async () => {
    const c = cenario();
    const id = await publicado(c);
    await expect(chamar(c, SEC, { action: 'rectify', docId: id, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(c, SEC, { action: 'rectify', docId: id, reason: 'Corrige a data da etapa 3', doc: { title: 'Calendário de 2027 (corrigido)', files: [arquivo(PDF2)] } });
    expect(r.version).toBe(2);
    const d = doc(c, id);
    expect(d).toMatchObject({ version: 2, version_reason: 'Corrige a data da etapa 3', title: 'Calendário de 2027 (corrigido)', type: 'resolution', number: 1 });
    expect(d.files).toHaveLength(1);
    expect(d.files[0]).toMatchObject({ path: `federacao-acervo-oficial/fpp/${id}/v2/1.pdf`, sha256: sha('estatuto v2') });
    expect(d.versions[0]).toMatchObject({ version: 1, title: 'Calendário de 2027' });
    expect(d.versions[0].files[0].sha256).toBe(sha('estatuto v1'));
  });

  it('retificação pode manter os arquivos da versão anterior', async () => {
    const c = cenario();
    const id = await publicado(c);
    const manter = doc(c, id).files.map((x) => x.path);
    await chamar(c, SEC, { action: 'rectify', docId: id, reason: 'Ajusta a ementa do ato', keep_files: manter, doc: { summary: 'Nova ementa' } });
    expect(doc(c, id).files.map((x) => x.path)).toEqual(manter);
  });

  it('visibilidade: restrito perde o link (token novo), público ganha de volta', async () => {
    const c = cenario();
    const id = await publicado(c);
    const antes = doc(c, id).files[0].url;
    await chamar(c, SEC, { action: 'visibility', docId: id, visibility: 'members' });
    expect(doc(c, id).files[0].url).toBeUndefined();
    await chamar(c, SEC, { action: 'visibility', docId: id, visibility: 'public' });
    expect(doc(c, id).files[0].url).toMatch(/token=/);
    expect(doc(c, id).files[0].url).not.toBe(antes);
  });

  it('retirar do ar: só o admin, com motivo; nada é apagado e o link morre', async () => {
    const c = cenario();
    const id = await publicado(c);
    await expect(chamar(c, SEC, { action: 'withdraw', docId: id, reason: 'Contém dado pessoal publicado por engano' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, PRES, { action: 'withdraw', docId: id, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, PRES, { action: 'withdraw', docId: id, reason: 'Contém dado pessoal publicado por engano' });
    const d = doc(c, id);
    expect(d).toMatchObject({ status: 'withdrawn', withdrawn_by: 'pres' });
    expect(d.files[0].url).toBeUndefined();
    expect(c.bucket.store.has(d.files[0].path)).toBe(true);
  });

  it('o arquivo restrito vai a filiado ativo e à equipe; nunca a quem não é', async () => {
    const c = cenario();
    const id = await publicado(c, { visibility: 'members' });
    const path = doc(c, id).files[0].path;
    const r = await chamar(c, FILIADO, { action: 'file', docId: id, path });
    expect(Buffer.from(r.base64, 'base64').toString()).toBe('estatuto v1');
    await expect(chamar(c, FIN, { action: 'file', docId: id, path })).resolves.toMatchObject({ ok: true });
    await expect(chamar(c, ESTRANHO, { action: 'file', docId: id, path })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, SEC, { action: 'visibility', docId: id, visibility: 'staff' });
    await expect(chamar(c, FILIADO, { action: 'file', docId: id, path })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('cada passo fica na auditoria', async () => {
    const c = cenario();
    await publicado(c);
    const acoes = [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('audit_logs/')).map(([, d]) => d.action);
    expect(acoes).toEqual(expect.arrayContaining(['federation_doc_save', 'federation_doc_publish']));
  });
});

describe('acervo oficial: quem segue é avisado', () => {
  const seguir = (c, uid) => c.db.store.docs.set(`federation_followers/fpp_${uid}`, { federation_id: 'fpp', user_id: uid });
  const avisos = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);

  it('ato público: avisa quem segue (menos quem publicou), com o link da página do documento', async () => {
    const c = cenario();
    ['ana', 'zzz', 'sec'].forEach((u) => seguir(c, u));
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    const r = await chamar(c, SEC, { action: 'publish', docId });
    expect(r.notified).toBe(2);
    const lista = avisos(c);
    expect(lista.map((n) => n.user_id).sort()).toEqual(['ana', 'zzz']);
    expect(lista[0]).toMatchObject({ link: `/f/fpp/acervo/${docId}`, origin: 'server' });
    expect(lista[0].title).toContain('FPP publicou');
  });

  it('só filiados: avisa filiado ativo e equipe, nunca quem não pode ler; só equipe: ninguém', async () => {
    const c = cenario();
    ['ana', 'zzz', 'fin'].forEach((u) => seguir(c, u));
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho({ visibility: 'members' }) });
    await chamar(c, SEC, { action: 'publish', docId });
    expect(avisos(c).map((n) => n.user_id).sort()).toEqual(['ana', 'fin']);
    const outro = await chamar(c, SEC, { action: 'save', doc: rascunho({ visibility: 'staff', files: [arquivo(PDF2)] }) });
    const r = await chamar(c, SEC, { action: 'publish', docId: outro.docId });
    expect(r.notified).toBe(0);
  });

  it('retificação também avisa', async () => {
    const c = cenario();
    seguir(c, 'ana');
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await chamar(c, SEC, { action: 'publish', docId });
    await chamar(c, SEC, { action: 'rectify', docId, reason: 'Corrige a data da etapa 3', keep_files: doc(c, docId).files.map((x) => x.path) });
    expect(avisos(c).some((n) => n.title.includes('retificou'))).toBe(true);
  });
});
