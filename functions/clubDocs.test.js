/**
 * Documentos oficiais do clube no SERVIDOR (Firestore e Storage falsos): só quem tem
 * `docs`/`admin` grava; só tipo da lista do clube; publicado não se edita; o número
 * sai por tipo e ano numa transação; as marcas `pub`/`members` que a regra lê seguem a
 * visibilidade; o arquivo restrito só chega a quem pode ler; o aviso aos associados
 * sai uma vez por versão; retirar do ar é só da administração.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const cd = require('./clubDocs.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0);
const PRES = { uid: 'pres', name: 'Presidente' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };
const EXT = { uid: 'ext', name: 'De fora' };

function fakeBucket(arquivos = {}) {
  const store = new Map(Object.entries(arquivos).map(([p, { bytes, contentType }]) => [p, { bytes: Buffer.from(bytes), meta: { contentType, size: String(Buffer.from(bytes).length), metadata: {} } }]));
  const file = (name) => ({
    name,
    async getMetadata() { if (!store.has(name)) throw new Error('404'); return [store.get(name).meta]; },
    async copy(dest) { const o = store.get(name); if (!o) throw new Error('404'); store.set(dest.name, { bytes: Buffer.from(o.bytes), meta: { ...o.meta, metadata: {} } }); },
    createReadStream() { return Readable.from([store.get(name).bytes]); },
    async setMetadata(m) { const o = store.get(name); if (!o) throw new Error('404'); o.meta = { ...o.meta, ...m, metadata: { ...o.meta.metadata, ...(m.metadata || {}) } }; },
    async delete() { store.delete(name); },
    async download() { return [store.get(name).bytes]; },
  });
  return { name: 'proj.appspot.com', file, store };
}

const PDF = 'clube-acervo/sec/abc123.pdf';
const PDF2 = 'clube-acervo/sec/def456.pdf';
const ALHEIO = 'clube-acervo/fin/xyz789.pdf';
const DA_FEDERACAO = 'federacao-acervo/sec/fed111.pdf';

function cenario({ associacao = true, flag = true } = {}) {
  const db = createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_members/c1_fin': { club_id: 'c1', user_id: 'fin', role: 'member' },
    'club_members/c1_ana': { club_id: 'c1', user_id: 'ana', role: 'member' },
    'club_x/c1/staff/sec': { club_id: 'c1', user_id: 'sec', perms: ['docs'], term_end_ms: 0 },
    'club_x/c1/staff/fin': { club_id: 'c1', user_id: 'fin', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', status: 'active', plan_id: 'anual', valid_until: '2028-01-01' },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', status: 'active', plan_id: 'anual', valid_until: '2028-01-01' },
    'club_x/c1/aff/caio': { club_id: 'c1', user_id: 'caio', status: 'active', plan_id: 'anual', valid_until: '2026-01-01' }, // venceu
  });
  const bucket = fakeBucket({
    [PDF]: { bytes: 'estatuto v1', contentType: 'application/pdf' },
    [PDF2]: { bytes: 'estatuto v2', contentType: 'application/pdf' },
    [ALHEIO]: { bytes: 'de outra pessoa', contentType: 'application/pdf' },
    [DA_FEDERACAO]: { bytes: 'da federação', contentType: 'application/pdf' },
  });
  return { db, bucket };
}
const ctx = ({ db, bucket }, now = NOW) => ({ db, bucket, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => cd.docs(ctx(c, now), actor, { clubId: 'c1', ...data });
const doc = (c, id) => c.db.store.docs.get(`club_x/c1/docs/${id}`);
const arquivo = (path) => ({ name: 'estatuto.pdf', path, size: 11, content_type: 'application/pdf' });
const rascunho = (extra = {}) => ({ type: 'bylaws', title: 'Regimento interno', visibility: 'public', files: [arquivo(PDF)], ...extra });
const avisosPara = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);

describe('documentos do clube: quem pode e o que vale', () => {
  it('flag desligada, associação fechada, sem permissão e ação desconhecida são recusados', async () => {
    await expect(chamar(cenario({ flag: false }), SEC, { action: 'save', doc: rascunho() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), SEC, { action: 'save', doc: rascunho() })).rejects.toMatchObject({ code: 'failed-precondition' });
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'save', doc: rascunho() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, EXT, { action: 'save', doc: rascunho() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, SEC, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('a secretaria (docs) e a administração criam e editam o rascunho; o clube não oferece tipo de federação', async () => {
    const c = cenario();
    const r = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    expect(doc(c, r.docId)).toMatchObject({ status: 'draft', club_id: 'c1', version: 0, pub: false, members: false, created_by: 'sec' });
    await chamar(c, PRES, { action: 'save', docId: r.docId, doc: rascunho({ title: 'Regimento interno revisado' }) });
    expect(doc(c, r.docId).title).toBe('Regimento interno revisado');
    // "Regimento de arbitragem" é da federação, não do clube.
    await expect(chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'referee_rules' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('ninguém anexa arquivo que outra pessoa enviou, nem o da pasta da federação', async () => {
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'save', doc: rascunho({ files: [arquivo(ALHEIO)] }) })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, SEC, { action: 'save', doc: rascunho({ files: [arquivo(DA_FEDERACAO)] }) })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rascunho se apaga com os arquivos; publicado não', async () => {
    const c = cenario();
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await chamar(c, SEC, { action: 'delete', docId });
    expect(doc(c, docId)).toBeUndefined();
    expect(c.bucket.store.has(PDF)).toBe(false);
    const outro = await chamar(c, SEC, { action: 'save', doc: rascunho({ files: [arquivo(PDF2)] }) });
    await chamar(c, SEC, { action: 'publish', docId: outro.docId });
    await expect(chamar(c, SEC, { action: 'delete', docId: outro.docId })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('documentos do clube: publicação', () => {
  it('numera por tipo e ano, copia o arquivo com SHA-256 e liga as duas marcas da regra', async () => {
    const c = cenario();
    const a = await chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'resolution', title: 'Reajuste das mensalidades', files: [arquivo(PDF)] }) });
    const b = await chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'resolution', title: 'Uso das quadras', files: [arquivo(PDF2)] }) });
    const ra = await chamar(c, SEC, { action: 'publish', docId: a.docId });
    const rb = await chamar(c, SEC, { action: 'publish', docId: b.docId });
    expect([ra.code, rb.code]).toEqual(['Resolução nº 1/2027', 'Resolução nº 2/2027']);
    const d = doc(c, a.docId);
    expect(d).toMatchObject({ status: 'published', version: 1, pub: true, members: true, number: 1, year: 2027 });
    expect(d.files[0].path).toBe(`clube-acervo-oficial/c1/${a.docId}/v1/1.pdf`);
    expect(d.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(d.files[0].url).toContain('alt=media'); // público: link direto
    expect(c.db.store.docs.get('club_x/c1/seq/docs').counters).toBeTruthy();
  });

  it('⭐ "só associados" liga só members e não deixa link público; "só a equipe" não liga nenhuma marca', async () => {
    const c = cenario();
    const a = await chamar(c, SEC, { action: 'save', doc: rascunho({ visibility: 'members' }) });
    await chamar(c, SEC, { action: 'publish', docId: a.docId });
    expect(doc(c, a.docId)).toMatchObject({ pub: false, members: true });
    expect(doc(c, a.docId).files[0].url).toBeUndefined();
    await chamar(c, SEC, { action: 'visibility', docId: a.docId, visibility: 'staff' });
    expect(doc(c, a.docId)).toMatchObject({ pub: false, members: false });
    await chamar(c, SEC, { action: 'visibility', docId: a.docId, visibility: 'public' });
    expect(doc(c, a.docId)).toMatchObject({ pub: true, members: true });
    expect(doc(c, a.docId).files[0].url).toBeTruthy();
  });

  it('publicado não se edita pelo salvar; retificar exige motivo e guarda a versão anterior', async () => {
    const c = cenario();
    const a = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await chamar(c, SEC, { action: 'publish', docId: a.docId });
    await expect(chamar(c, SEC, { action: 'save', docId: a.docId, doc: rascunho() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'rectify', docId: a.docId, reason: 'curto', doc: { title: 'Novo' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(c, SEC, { action: 'rectify', docId: a.docId, reason: 'Corrigido o prazo do artigo 4º', keep_files: [`clube-acervo-oficial/c1/${a.docId}/v1/1.pdf`], doc: { title: 'Regimento interno (corrigido)' } });
    expect(r.version).toBe(2);
    const d = doc(c, a.docId);
    expect(d.versions).toHaveLength(1);
    expect(d.versions[0]).toMatchObject({ version: 1, title: 'Regimento interno' });
    expect(d.title).toBe('Regimento interno (corrigido)');
  });

  it('um ato que revoga marca o alvo (que não some); relação com rascunho é recusada', async () => {
    const c = cenario();
    const velho = await chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'resolution', title: 'Resolução antiga', files: [arquivo(PDF)] }) });
    await chamar(c, SEC, { action: 'publish', docId: velho.docId });
    const novo = await chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'resolution', title: 'Revoga a antiga', files: [arquivo(PDF2)], relations: [{ kind: 'revokes', doc_id: velho.docId }] }) });
    await chamar(c, SEC, { action: 'publish', docId: novo.docId });
    expect(doc(c, velho.docId).revoked_by).toMatchObject({ doc_id: novo.docId });
    expect(doc(c, velho.docId).status).toBe('published');
    const rasc = await chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'resolution', title: 'Rascunho', files: [] , body: 'texto' }) });
    await expect(chamar(c, SEC, { action: 'save', doc: rascunho({ type: 'resolution', title: 'Aponta rascunho', files: [], body: 'texto', relations: [{ kind: 'amends', doc_id: rasc.docId }] }) })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('retirar do ar é só da administração, com motivo, e zera as marcas', async () => {
    const c = cenario();
    const a = await chamar(c, SEC, { action: 'save', doc: rascunho() });
    await chamar(c, SEC, { action: 'publish', docId: a.docId });
    await expect(chamar(c, SEC, { action: 'withdraw', docId: a.docId, reason: 'Publicado por engano, com dado pessoal' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, PRES, { action: 'withdraw', docId: a.docId, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, PRES, { action: 'withdraw', docId: a.docId, reason: 'Publicado por engano, com dado pessoal' });
    expect(doc(c, a.docId)).toMatchObject({ status: 'withdrawn', pub: false, members: false });
    expect(doc(c, a.docId).files[0].url).toBeUndefined();
  });
});

describe('documentos do clube: arquivo restrito e aviso', () => {
  async function publicado(c, visibility) {
    const { docId } = await chamar(c, SEC, { action: 'save', doc: rascunho({ visibility }) });
    await chamar(c, SEC, { action: 'publish', docId });
    return { docId, path: doc(c, docId).files[0].path };
  }

  it('⭐ o "só associados" chega ao membro do clube e a mais ninguém; rascunho só à equipe', async () => {
    const c = cenario();
    const { docId, path } = await publicado(c, 'members');
    const r = await chamar(c, ANA, { action: 'file', docId, path });
    expect(Buffer.from(r.base64, 'base64').toString()).toBe('estatuto v1');
    await expect(chamar(c, EXT, { action: 'file', docId, path })).rejects.toMatchObject({ code: 'permission-denied' });
    const { docId: rasc } = await chamar(c, SEC, { action: 'save', doc: rascunho({ files: [arquivo(PDF2)] }) });
    await expect(chamar(c, ANA, { action: 'file', docId: rasc, path: PDF2 })).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await chamar(c, SEC, { action: 'file', docId: rasc, path: PDF2 })).name).toBe('estatuto.pdf');
  });

  it('o aviso sai para os associados em dia, uma vez por versão, e não para a equipe só-leitura nem para o vencido', async () => {
    const c = cenario();
    const { docId } = await publicado(c, 'public');
    const r = await chamar(c, SEC, { action: 'notify', docId });
    expect(r.count).toBe(2); // ana e bia (caio venceu)
    expect(avisosPara(c, 'ana')[0].title).toContain('SUL publicou');
    expect(avisosPara(c, 'ana')[0].link).toBe(`/clubes/c1?tab=documentos&doc=${docId}`);
    expect(avisosPara(c, 'caio')).toHaveLength(0);
    await expect(chamar(c, SEC, { action: 'notify', docId })).rejects.toMatchObject({ code: 'failed-precondition' });
    // uma versão nova pode ser avisada de novo
    await chamar(c, SEC, { action: 'rectify', docId, reason: 'Corrigido o prazo do artigo 4º', keep_files: [doc(c, docId).files[0].path], doc: { title: 'Regimento (corrigido)' } });
    const r2 = await chamar(c, SEC, { action: 'notify', docId });
    expect(r2.count).toBe(2);
    expect(avisosPara(c, 'ana').at(-1).title).toContain('retificou');
  });

  it('"só a equipe" e rascunho não avisam ninguém', async () => {
    const c = cenario();
    const { docId } = await publicado(c, 'staff');
    await expect(chamar(c, SEC, { action: 'notify', docId })).rejects.toMatchObject({ code: 'failed-precondition' });
    const { docId: rasc } = await chamar(c, SEC, { action: 'save', doc: rascunho({ files: [arquivo(PDF2)] }) });
    await expect(chamar(c, SEC, { action: 'notify', docId: rasc })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
