/**
 * Contas do clube no SERVIDOR (Firestore e Storage falsos): quem prepara
 * (financeiro/administração), quem dá parecer (conselho fiscal; a administração
 * fica registrada), lançamento que não se apaga (estorno com motivo), período
 * fechado depois de enviada, retrato congelado com as cobranças pagas, avisos ao
 * conselho e à equipe, publicar exige parecer e liga a cópia pública do orçamento.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const ca = require('./clubAccounts.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0); // 10/03/2027
const PRES = { uid: 'pres', name: 'Presidente' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const FIS = { uid: 'fis', name: 'Conselheira' };
const SEC = { uid: 'sec', name: 'Secretaria' };
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

const RECIBO = 'clube-contas/fin/rec1.pdf';
const ALHEIO = 'clube-contas/sec/rec2.pdf';
const DA_FEDERACAO = 'federacao-contas/fin/rec3.pdf';

function cenario({ associacao = true, flag = true } = {}) {
  const db = createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_fin': { club_id: 'c1', user_id: 'fin', role: 'member' },
    'club_members/c1_fis': { club_id: 'c1', user_id: 'fis', role: 'member' },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_x/c1/staff/fin': { club_id: 'c1', user_id: 'fin', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/staff/fis': { club_id: 'c1', user_id: 'fis', perms: ['fiscal'], term_end_ms: 0 },
    'club_x/c1/staff/sec': { club_id: 'c1', user_id: 'sec', perms: ['members'], term_end_ms: 0 },
    'club_x/c1/charges/c1': { club_id: 'c1', status: 'paid', origin: 'membership', amount_cents: 15000, paid_at: '2026-03-05', plan_name: 'Sócio' },
    'club_x/c1/charges/c2': { club_id: 'c1', status: 'paid', origin: 'renewal', amount_cents: 30000, paid_at_ms: Date.UTC(2026, 6, 1, 1, 0) }, // 30/06 em Brasília
    'club_x/c1/charges/c3': { club_id: 'c1', status: 'open', origin: 'membership', amount_cents: 99999 },
    'club_x/c2/charges/x1': { club_id: 'c2', status: 'paid', origin: 'membership', amount_cents: 77777, paid_at: '2026-03-05' },
  });
  const bucket = fakeBucket({
    [RECIBO]: { bytes: 'recibo', contentType: 'application/pdf' },
    [ALHEIO]: { bytes: 'outro', contentType: 'application/pdf' },
    [DA_FEDERACAO]: { bytes: 'fed', contentType: 'application/pdf' },
  });
  return { db, bucket };
}
const ctx = ({ db, bucket }, now = NOW) => ({ db, bucket, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => ca.accounts(ctx(c, now), actor, { clubId: 'c1', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const docs = (c, prefixo) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith(prefixo)).map(([p, d]) => ({ path: p, ...d }));
const lanc = (extra = {}) => ({ kind: 'expense', category: 'travel', date: '2026-05-10', amount_cents: 12000, description: 'Passagem da etapa 2', ...extra });
const PDF = (path, extra = {}) => ({ name: 'recibo.pdf', path, size: 6, content_type: 'application/pdf', ...extra });
const avisosPara = (c, uid) => docs(c, 'notifications/').filter((d) => d.user_id === uid);

describe('contas do clube: quem pode', () => {
  it('flag desligada, associação fechada, sem permissão e ação desconhecida são recusados', async () => {
    await expect(chamar(cenario({ flag: false }), FIN, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), FIN, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'failed-precondition' });
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, EXT, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIS, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIN, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('o cargo de quem saiu do clube não vale', async () => {
    const c = cenario();
    c.db.store.docs.delete('club_members/c1_fin');
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('contas do clube: orçamento', () => {
  it('rascunho → enviado → aprovado → publicado (com a cópia pública)', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: {} } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'income.memberships': 500000, 'expense.travel': 200000, 'expense.nada': 5 } } });
    expect(doc(c, 'club_x/c1/budgets/2027')).toMatchObject({ club_id: 'c1', status: 'draft', lines: { 'income.memberships': 500000, 'expense.travel': 200000 } });
    await expect(chamar(c, FIN, { action: 'budget_publish', year: 2027 })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, FIN, { action: 'budget_submit', year: 2027 });
    await expect(chamar(c, FIN, { action: 'budget_approve', year: 2027, approval: { date: 'ontem' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'budget_approve', year: 2027, approval: { date: '2027-03-01', note: 'AGO', event_id: 'qualquer' } });
    expect(doc(c, 'club_x/c1/budgets/2027')).toMatchObject({ status: 'approved', approved_in: { date: '2027-03-01', note: 'AGO', event_id: '' } });
    await chamar(c, PRES, { action: 'budget_publish', year: 2027 });
    expect(doc(c, 'club_x/c1/budgets/2027').pub).toBeUndefined();
    expect(doc(c, 'club_x/c1/budgets/2027_pub')).toMatchObject({ club_id: 'c1', year: 2027, pub: true, copy_of: '2027' });
  });

  it('reformular o publicado pede motivo, volta a rascunho e a cópia pública fica', async () => {
    const c = cenario();
    await chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'expense.travel': 100 } } });
    await chamar(c, FIN, { action: 'budget_submit', year: 2027 });
    await chamar(c, FIN, { action: 'budget_approve', year: 2027, approval: { date: '2027-03-01' } });
    await chamar(c, FIN, { action: 'budget_publish', year: 2027 });
    await expect(chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'expense.travel': 300 } } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'expense.travel': 300 } }, reason: 'Etapa extra aprovada na assembleia' });
    const b = doc(c, 'club_x/c1/budgets/2027');
    expect(b).toMatchObject({ status: 'draft', lines: { 'expense.travel': 300 }, published: { lines: { 'expense.travel': 100 } } });
    expect(doc(c, 'club_x/c1/budgets/2027_pub')).toMatchObject({ pub: true, published: { lines: { 'expense.travel': 100 } } });
  });
});

describe('contas do clube: lançamentos', () => {
  it('lança com anexo da própria pasta e recusa anexo alheio, de outra pasta e data futura', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc({ date: '2027-04-01' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc({ document: PDF(ALHEIO) }) })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc({ document: PDF(DA_FEDERACAO) }) })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, FIN, { action: 'entry_add', entry: lanc({ document: PDF(RECIBO) }) });
    const e = doc(c, `club_x/c1/ledger/${r.entryId}`);
    expect(e).toMatchObject({ club_id: 'c1', status: 'posted', amount_cents: 12000, created_by: 'fin' });
    expect(e.document.path).toBe(`clube-contas-oficial/c1/ledger/${r.entryId}/1.pdf`);
    expect(c.bucket.store.has(RECIBO)).toBe(false);
    const f = await chamar(c, FIS, { action: 'file', entryId: r.entryId });
    expect(Buffer.from(f.base64, 'base64').toString()).toBe('recibo');
  });

  it('estorno pede motivo e nunca apaga', async () => {
    const c = cenario();
    const { entryId } = await chamar(c, FIN, { action: 'entry_add', entry: lanc() });
    await expect(chamar(c, FIN, { action: 'entry_void', entryId, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'entry_void', entryId, reason: 'Lançado em duplicidade' });
    expect(doc(c, `club_x/c1/ledger/${entryId}`)).toMatchObject({ status: 'void', void_reason: 'Lançado em duplicidade', voided_by: 'fin' });
    await expect(chamar(c, FIN, { action: 'entry_void', entryId, reason: 'Lançado em duplicidade' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('importar o mesmo extrato de novo não duplica', async () => {
    const c = cenario();
    const mov = (extra = {}) => ({ kind: 'income', category: 'sponsorship', date: '2026-04-02', amount_cents: 500000, description: 'PIX RECEBIDO', bank_ref: 'ofx:A1', ...extra });
    const r1 = await chamar(c, FIN, { action: 'entry_import', entries: [mov(), mov({ bank_ref: 'ofx:A2' })] });
    expect(r1).toMatchObject({ imported: 2, skipped: 0 });
    const r2 = await chamar(c, FIN, { action: 'entry_import', entries: [mov(), mov({ bank_ref: 'ofx:A3' })] });
    expect(r2).toMatchObject({ imported: 1, skipped: 1 });
    expect(docs(c, 'club_x/c1/ledger/')).toHaveLength(3);
    await expect(chamar(c, FIN, { action: 'entry_import', entries: [mov({ bank_ref: '' })] })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('contas do clube: prestação de contas', () => {
  async function ate(c, passo) {
    await chamar(c, FIN, { action: 'entry_add', entry: lanc({ date: '2026-05-10', amount_cents: 12000 }) });
    await chamar(c, FIN, { action: 'report_open', period: '2026' });
    if (passo === 'aberta') return;
    await chamar(c, FIN, { action: 'report_submit', reportId: '2026' });
  }

  it('só se envia o período que terminou; o retrato congela receitas das cobranças pagas do PRÓPRIO clube', async () => {
    const c = cenario();
    await chamar(c, FIN, { action: 'report_open', period: '2027-Q1' });
    await expect(chamar(c, FIN, { action: 'report_submit', reportId: '2027-Q1' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, FIN, { action: 'report_open', period: '2028' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await ate(c);
    const r = doc(c, 'club_x/c1/reports/2026');
    expect(r.status).toBe('submitted');
    expect(r.snapshot).toMatchObject({ income_total: 45000, expense_total: 12000, balance: 33000 });
    expect(avisosPara(c, 'fis')).toHaveLength(1);
    expect(avisosPara(c, 'fis')[0]).toMatchObject({ type: 'club_association', link: '/clubes/c1/gerir?aba=prestacao' });
    expect(avisosPara(c, 'fin')).toHaveLength(0);
  });

  it('enviado, o período fecha: lançar, estornar e importar nele são recusados', async () => {
    const c = cenario();
    await ate(c);
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc({ date: '2026-06-01' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    const [{ path }] = docs(c, 'club_x/c1/ledger/');
    await expect(chamar(c, FIN, { action: 'entry_void', entryId: path.split('/').pop(), reason: 'Lançado em duplicidade' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, FIN, { action: 'entry_import', entries: [{ kind: 'income', category: 'sponsorship', date: '2026-04-02', amount_cents: 100, description: 'Pix', bank_ref: 'x' }] })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, FIN, { action: 'entry_add', entry: lanc({ date: '2027-01-15' }) }); // período aberto
  });

  it('o parecer é do conselho fiscal (a administração fica registrada), avisa o financeiro e publicar exige parecer', async () => {
    const c = cenario();
    await ate(c);
    await expect(chamar(c, FIN, { action: 'opinion', reportId: '2026', opinion: { verdict: 'approve', text: 'Contas conferidas.' } })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIN, { action: 'report_publish', reportId: '2026' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, FIS, { action: 'opinion', reportId: '2026', opinion: { verdict: 'approve', text: 'curto' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIS, { action: 'opinion', reportId: '2026', opinion: { verdict: 'approve', text: 'Contas conferidas e em ordem, com os comprovantes.' } });
    expect(doc(c, 'club_x/c1/reports/2026')).toMatchObject({ status: 'opinion', fiscal_opinion: { verdict: 'approve', by: 'fis', by_admin: false } });
    expect(avisosPara(c, 'fin')).toHaveLength(1);
    expect(avisosPara(c, 'pres')).toHaveLength(2); // quem administra recebe o aviso do envio e o do parecer
    await chamar(c, FIN, { action: 'report_assembly', reportId: '2026', assembly: { date: '2027-03-05', result: 'approved', note: 'AGO', event_id: 'x' } });
    expect(doc(c, 'club_x/c1/reports/2026')).toMatchObject({ status: 'approved', assembly: { result: 'approved', event_id: '' } });
    await chamar(c, FIN, { action: 'report_publish', reportId: '2026' });
    expect(doc(c, 'club_x/c1/reports/2026')).toMatchObject({ status: 'published', pub: true });
  });

  it('quem administra o clube pode dar o parecer, e fica dito que foi a administração', async () => {
    const c = cenario();
    await ate(c);
    await chamar(c, PRES, { action: 'opinion', reportId: '2026', opinion: { verdict: 'approve_with_reservations', text: 'Aprovo com ressalvas sobre os recibos.' } });
    expect(doc(c, 'club_x/c1/reports/2026').fiscal_opinion).toMatchObject({ by_admin: true, verdict: 'approve_with_reservations' });
  });

  it('reabrir a enviada sem parecer pede motivo e solta o retrato', async () => {
    const c = cenario();
    await ate(c);
    await expect(chamar(c, FIN, { action: 'report_open', period: '2026' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'report_open', period: '2026', reason: 'Faltou um recibo' });
    expect(doc(c, 'club_x/c1/reports/2026')).toMatchObject({ status: 'draft', snapshot: null });
  });

  it('as demonstrações vêm da própria pasta e vão para a pasta oficial', async () => {
    const c = cenario();
    await ate(c, 'aberta');
    await expect(chamar(c, FIN, { action: 'report_save', reportId: '2026', statements: [{ ...PDF(ALHEIO), kind: 'balance_sheet' }] })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, FIN, { action: 'report_save', reportId: '2026', notes: 'Notas do exercício', statements: [{ ...PDF(RECIBO), kind: 'balance_sheet' }] });
    const [d] = doc(c, 'club_x/c1/reports/2026').statements;
    expect(d.path).toMatch(/^clube-contas-oficial\/c1\/reports\/2026\//);
    const f = await chamar(c, FIS, { action: 'file', reportId: '2026', path: d.path });
    expect(Buffer.from(f.base64, 'base64').toString()).toBe('recibo');
  });
});
