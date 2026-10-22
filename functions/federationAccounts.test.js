/**
 * Orçamento e prestação de contas no SERVIDOR contra Firestore e Storage
 * falsos: quem prepara (financeiro/admin), quem dá parecer (conselho fiscal;
 * o admin fica registrado), lançamento que não se apaga (estorno com motivo),
 * período fechado depois de enviada, retrato congelado com as cobranças
 * pagas, avisos ao conselho e à equipe, publicar exige parecer e cria os atos
 * de transparência no acervo.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const ac = require('./federationAccounts.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0); // 10/03/2027
const PRES = { uid: 'pres', name: 'Presidente' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const FIS = { uid: 'fis', name: 'Conselheira' };
const SEC = { uid: 'sec', name: 'Secretaria' };

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

const RECIBO = 'federacao-contas/fin/rec1.pdf';
const ALHEIO = 'federacao-contas/sec/rec2.pdf';
const BALANCO = 'federacao-contas/fin/bal1.pdf';

function cenario(mods = { accounts: true, official_docs: true, calendar: true }) {
  const db = createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: mods },
    'federation_staff/fpp_pres': { federation_id: 'fpp', user_id: 'pres', role: 'president' },
    'federation_staff/fpp_fin': { federation_id: 'fpp', user_id: 'fin', role: 'treasurer' },
    'federation_staff/fpp_fis': { federation_id: 'fpp', user_id: 'fis', role: 'fiscal_council' },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
    'federation_charges/c1': { federation_id: 'fpp', status: 'paid', origin: 'membership', amount_cents: 15000, paid_at: '2026-03-05', plan_name: 'Atleta' },
    'federation_charges/c2': { federation_id: 'fpp', status: 'paid', origin: 'course', amount_cents: 30000, paid_at_ms: Date.UTC(2026, 6, 1, 1, 0) }, // 30/06 em Brasília
    'federation_charges/c3': { federation_id: 'fpp', status: 'open', origin: 'membership', amount_cents: 99999 },
    'federation_charges/c4': { federation_id: 'outra', status: 'paid', origin: 'membership', amount_cents: 77777, paid_at: '2026-03-05' },
    'federation_events/ago': { federation_id: 'fpp', kind: 'assembly_ordinary', title: 'AGO 2027', date: '2027-03-01' },
    'federation_events/etapa': { federation_id: 'fpp', kind: 'competition', title: 'Etapa 1', date: '2027-03-01' },
  });
  const bucket = fakeBucket({
    [RECIBO]: { bytes: 'recibo', contentType: 'application/pdf' },
    [ALHEIO]: { bytes: 'outro', contentType: 'application/pdf' },
    [BALANCO]: { bytes: 'balanco 2026', contentType: 'application/pdf' },
  });
  return { db, bucket };
}
const ctx = ({ db, bucket }, now = NOW) => ({ db, bucket, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => ac.accounts(ctx(c, now), actor, { federationId: 'fpp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const docs = (c, prefixo) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith(prefixo)).map(([p, d]) => ({ path: p, ...d }));
const lanc = (extra = {}) => ({ kind: 'expense', category: 'travel', date: '2026-05-10', amount_cents: 12000, description: 'Passagem da etapa 2', ...extra });
const PDF = (path, extra = {}) => ({ name: 'recibo.pdf', path, size: 6, content_type: 'application/pdf', ...extra });

describe('contas: quem pode', () => {
  it('módulo desligado, sem permissão e ação desconhecida são recusados', async () => {
    await expect(chamar(cenario({ official_docs: true }), FIN, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'failed-precondition' });
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIS, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIN, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('contas: orçamento', () => {
  it('rascunho → enviado → aprovado numa reunião da agenda → publicado (com a cópia pública)', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: {} } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'income.memberships': 500000, 'expense.travel': 200000, 'expense.nada': 5 } } });
    expect(doc(c, 'federation_budgets/fpp_2027')).toMatchObject({ status: 'draft', lines: { 'income.memberships': 500000, 'expense.travel': 200000 } });
    await expect(chamar(c, FIN, { action: 'budget_publish', year: 2027 })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, FIN, { action: 'budget_submit', year: 2027 });
    await expect(chamar(c, FIN, { action: 'budget_approve', year: 2027, approval: { date: '2027-03-01', event_id: 'etapa' } })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, FIN, { action: 'budget_approve', year: 2027, approval: { date: '2027-03-01', event_id: 'ago' } });
    expect(doc(c, 'federation_budgets/fpp_2027')).toMatchObject({ status: 'approved', approved_in: { event_id: 'ago', event_title: 'AGO 2027', date: '2027-03-01' } });
    await chamar(c, PRES, { action: 'budget_publish', year: 2027 });
    expect(doc(c, 'federation_budgets/fpp_2027')).toMatchObject({ status: 'published', published: { lines: { 'income.memberships': 500000, 'expense.travel': 200000 } } });
    expect(doc(c, 'federation_budgets/fpp_2027').pub).toBeUndefined();
    expect(doc(c, 'federation_budgets/fpp_2027_pub')).toMatchObject({ federation_id: 'fpp', year: 2027, pub: true, copy_of: 'fpp_2027', published: { lines: { 'income.memberships': 500000, 'expense.travel': 200000 } } });
  });

  it('reformular o publicado pede motivo, volta a rascunho, guarda as linhas e a cópia pública fica', async () => {
    const c = cenario();
    await chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'expense.travel': 100 } } });
    await chamar(c, FIN, { action: 'budget_submit', year: 2027 });
    await chamar(c, FIN, { action: 'budget_approve', year: 2027, approval: { date: '2027-03-01' } });
    await chamar(c, FIN, { action: 'budget_publish', year: 2027 });
    await expect(chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'expense.travel': 300 } } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'budget_save', budget: { year: 2027, lines: { 'expense.travel': 300 } }, reason: 'Etapa extra aprovada na AGE' });
    const b = doc(c, 'federation_budgets/fpp_2027');
    expect(b).toMatchObject({ status: 'draft', lines: { 'expense.travel': 300 }, published: { lines: { 'expense.travel': 100 } } });
    expect(b.pub).toBeUndefined(); // o rascunho reformulado nunca fica legível ao público
    expect(doc(c, 'federation_budgets/fpp_2027_pub')).toMatchObject({ pub: true, published: { lines: { 'expense.travel': 100 } } });
    expect(b.history.at(-1)).toMatchObject({ kind: 'reformulated', reason: 'Etapa extra aprovada na AGE', previous_status: 'published', previous_lines: { 'expense.travel': 100 } });
  });
});

describe('contas: lançamentos', () => {
  it('lança com anexo da própria pasta (copiado para a pasta oficial) e recusa anexo alheio e data futura', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc({ date: '2027-04-01' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc({ document: PDF(ALHEIO) }) })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, FIN, { action: 'entry_add', entry: lanc({ document: PDF(RECIBO) }) });
    const e = doc(c, `federation_ledger/${r.entryId}`);
    expect(e).toMatchObject({ federation_id: 'fpp', status: 'posted', amount_cents: 12000, created_by: 'fin' });
    expect(e.document.path).toBe(`federacao-contas-oficial/fpp/ledger/${r.entryId}/1.pdf`);
    expect(e.document.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(c.bucket.store.has(RECIBO)).toBe(false);
    const f = await chamar(c, FIS, { action: 'file', entryId: r.entryId });
    expect(Buffer.from(f.base64, 'base64').toString()).toBe('recibo');
  });

  it('estorno pede motivo e nunca apaga', async () => {
    const c = cenario();
    const { entryId } = await chamar(c, FIN, { action: 'entry_add', entry: lanc() });
    await expect(chamar(c, FIN, { action: 'entry_void', entryId, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'entry_void', entryId, reason: 'Lançado em duplicidade' });
    expect(doc(c, `federation_ledger/${entryId}`)).toMatchObject({ status: 'void', void_reason: 'Lançado em duplicidade', voided_by: 'fin' });
    await expect(chamar(c, FIN, { action: 'entry_void', entryId, reason: 'Lançado em duplicidade' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('contas: importação do extrato bancário', () => {
  const mov = (extra = {}) => ({ kind: 'income', category: 'sponsorship', date: '2026-04-02', amount_cents: 500000, description: 'PIX RECEBIDO PATROCINADOR', counterparty: 'Loja X', bank_ref: 'ofx:A1', ...extra });

  it('importa o lote com origem "extrato" e importar de novo só traz o que faltava', async () => {
    const c = cenario();
    const r = await chamar(c, FIN, { action: 'entry_import', entries: [mov(), mov({ kind: 'expense', category: 'admin', amount_cents: 3990, description: 'TARIFA', bank_ref: 'ofx:A2' })] });
    expect(r).toMatchObject({ ok: true, imported: 2, skipped: 0 });
    const lancs = docs(c, 'federation_ledger/');
    expect(lancs).toHaveLength(2);
    expect(lancs.find((x) => x.bank_ref === 'ofx:A1')).toMatchObject({
      federation_id: 'fpp', status: 'posted', source: 'bank', created_by: 'fin', document: null,
      kind: 'income', category: 'sponsorship', date: '2026-04-02', amount_cents: 500000, description: 'PIX RECEBIDO PATROCINADOR', counterparty: 'Loja X',
    });
    expect(lancs[0].path).toMatch(/^federation_ledger\/fpp_bk_[0-9a-f]{24}$/);
    const r2 = await chamar(c, FIN, { action: 'entry_import', entries: [mov(), mov({ bank_ref: 'ofx:A3', amount_cents: 100 })] });
    expect(r2).toMatchObject({ imported: 1, skipped: 1 });
    expect(docs(c, 'federation_ledger/')).toHaveLength(3);
    expect(docs(c, 'audit_logs/').some((a) => a.action === 'federation_ledger_import')).toBe(true);
  });

  it('a mesma régua do lançamento à mão: quem pode, movimento inválido derruba o lote, teto, período fechado', async () => {
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'entry_import', entries: [mov()] })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIN, { action: 'entry_import', entries: [] })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, FIN, { action: 'entry_import', entries: [mov(), mov({ bank_ref: 'ofx:B', date: '2027-12-01' })] })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, FIN, { action: 'entry_import', entries: [mov({ bank_ref: '' })] })).rejects.toMatchObject({ code: 'invalid-argument' });
    const muitos = Array.from({ length: 201 }, (_, i) => mov({ bank_ref: `ofx:${i}` }));
    await expect(chamar(c, FIN, { action: 'entry_import', entries: muitos })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(docs(c, 'federation_ledger/')).toHaveLength(0);
    await c.db.collection('federation_account_reports').doc('fpp_2026').set({ federation_id: 'fpp', period: '2026', status: 'submitted' });
    await expect(chamar(c, FIN, { action: 'entry_import', entries: [mov()] })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('contas: prestação de contas', () => {
  async function enviada(c) {
    await chamar(c, FIN, { action: 'budget_save', budget: { year: 2026, lines: { 'income.memberships': 20000, 'expense.travel': 10000 } } });
    await chamar(c, FIN, { action: 'budget_submit', year: 2026 });
    await chamar(c, FIN, { action: 'budget_approve', year: 2026, approval: { date: '2026-01-20' } });
    const { entryId } = await chamar(c, FIN, { action: 'entry_add', entry: lanc() });
    const v = await chamar(c, FIN, { action: 'entry_add', entry: lanc({ amount_cents: 999 }) });
    await chamar(c, FIN, { action: 'entry_void', entryId: v.entryId, reason: 'Lançado em duplicidade' });
    const { reportId } = await chamar(c, FIN, { action: 'report_open', period: '2026' });
    await chamar(c, FIN, { action: 'report_save', reportId, statements: [PDF(BALANCO, { name: 'balanco.pdf', size: 12, kind: 'balance_sheet' })], notes: 'Contas auditadas.' });
    const r = await chamar(c, FIN, { action: 'report_submit', reportId });
    return { reportId, entryId, notified: r.notified };
  }

  it('enviar CONGELA o retrato (cobranças pagas pela origem, estorno fora, orçamento aprovado) e avisa o conselho', async () => {
    const c = cenario();
    const { reportId, entryId, notified } = await enviada(c);
    const rep = doc(c, `federation_account_reports/${reportId}`);
    expect(reportId).toBe('fpp_2026');
    expect(rep.status).toBe('submitted');
    expect(rep.snapshot).toMatchObject({
      period: '2026', income_total: 45000, expense_total: 12000, balance: 33000, entries: 1, auto_entries: 2,
      income: { memberships: 15000, courses: 30000 }, expense: { travel: 12000 }, budget_lines: { 'income.memberships': 20000, 'expense.travel': 10000 },
    });
    expect(rep.statements[0]).toMatchObject({ kind: 'balance_sheet', name: 'balanco.pdf' });
    expect(rep.statements[0].path).toMatch(/^federacao-contas-oficial\/fpp\/reports\/fpp_2026\//);
    // Avisa quem tem `fiscal`: a conselheira e o presidente (que tem tudo); quem enviou, não.
    expect(notified).toBe(2);
    expect(docs(c, 'notifications/').map((n) => n.user_id).sort()).toEqual(['fis', 'pres']);
    // Período fechado: nem lança nem estorna nele.
    await expect(chamar(c, FIN, { action: 'entry_add', entry: lanc() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, FIN, { action: 'entry_void', entryId, reason: 'Ajuste depois do envio' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, FIN, { action: 'entry_add', entry: lanc({ date: '2027-01-05' }) });
  });

  it('o período em curso não se envia; trimestre já encerrado sim', async () => {
    const c = cenario();
    const { reportId } = await chamar(c, FIN, { action: 'report_open', period: '2027' });
    await expect(chamar(c, FIN, { action: 'report_submit', reportId })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, FIN, { action: 'report_open', period: '2027-Q2' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const q = await chamar(c, FIN, { action: 'report_open', period: '2026-Q2' });
    await chamar(c, FIN, { action: 'report_submit', reportId: q.reportId });
    expect(doc(c, 'federation_account_reports/fpp_2026-Q2').snapshot).toMatchObject({ from: '2026-04-01', to: '2026-06-30', income_total: 30000, budget_lines: null });
  });

  it('parecer: só conselho fiscal (ou admin, registrado); avisa a equipe; reabrir só antes do parecer', async () => {
    const c = cenario();
    const { reportId } = await enviada(c);
    await expect(chamar(c, FIN, { action: 'opinion', reportId, opinion: { verdict: 'approve', text: 'Contas em ordem e conferidas.' } })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, FIS, { action: 'opinion', reportId, opinion: { verdict: 'approve', text: 'curto' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, FIN, { action: 'report_publish', reportId })).rejects.toMatchObject({ code: 'failed-precondition' });
    const antes = docs(c, 'notifications/').length;
    await chamar(c, FIS, { action: 'opinion', reportId, opinion: { verdict: 'approve_with_reservations', text: 'Contas em ordem; falta o recibo da etapa 2.' } });
    const rep = doc(c, `federation_account_reports/${reportId}`);
    expect(rep).toMatchObject({ status: 'opinion', fiscal_opinion: { verdict: 'approve_with_reservations', by: 'fis', by_admin: false } });
    expect(docs(c, 'notifications/').slice(antes).map((n) => n.user_id).sort()).toEqual(['fin', 'pres']);
    await expect(chamar(c, FIN, { action: 'report_open', period: '2026', reason: 'Corrigir um lançamento' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('o admin pode dar o parecer, e fica registrado que foi o admin', async () => {
    const c = cenario();
    c.db.store.docs.set('federation_staff/fpp_pres', { federation_id: 'fpp', user_id: 'pres', role: 'president', perms: ['admin', 'finance'] });
    const { reportId } = await enviada(c);
    await chamar(c, PRES, { action: 'opinion', reportId, opinion: { verdict: 'approve', text: 'Conselho sem quórum; parecer da diretoria.' } });
    expect(doc(c, `federation_account_reports/${reportId}`).fiscal_opinion.by_admin).toBe(true);
  });

  it('reabrir a enviada sem parecer pede motivo e descongela', async () => {
    const c = cenario();
    const { reportId } = await enviada(c);
    await expect(chamar(c, FIN, { action: 'report_open', period: '2026' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, FIN, { action: 'report_open', period: '2026', reason: 'Faltou a nota da etapa 2' });
    expect(doc(c, `federation_account_reports/${reportId}`)).toMatchObject({ status: 'draft', snapshot: null });
  });

  it('assembleia e publicação: cria a demonstração e o parecer no acervo, públicos', async () => {
    const c = cenario();
    const { reportId } = await enviada(c);
    await chamar(c, FIS, { action: 'opinion', reportId, opinion: { verdict: 'approve', text: 'Contas em ordem e conferidas.' } });
    await expect(chamar(c, FIS, { action: 'report_assembly', reportId, assembly: { date: '2027-03-01', result: 'approved' } })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, FIN, { action: 'report_assembly', reportId, assembly: { date: '2027-03-01', result: 'approved', event_id: 'ago' } });
    expect(doc(c, `federation_account_reports/${reportId}`)).toMatchObject({ status: 'approved', assembly: { result: 'approved', event_title: 'AGO 2027' } });
    const r = await chamar(c, FIN, { action: 'report_publish', reportId });
    const rep = doc(c, `federation_account_reports/${reportId}`);
    expect(rep).toMatchObject({ status: 'published', pub: true });
    const dem = doc(c, `federation_docs/${r.acervo.statements_doc_id}`);
    const par = doc(c, `federation_docs/${r.acervo.opinion_doc_id}`);
    expect(dem).toMatchObject({ type: 'financial_statements', status: 'published', visibility: 'public', category: 'transparency' });
    expect(dem.body).toContain('Receitas: R$ 450,00');
    expect(dem.files[0].path).toMatch(/^federacao-acervo-oficial\/fpp\//);
    expect(dem.files[0].url).toContain('token=');
    expect(par).toMatchObject({ type: 'fiscal_opinion', status: 'published', body: 'Contas em ordem e conferidas.' });
    // A demonstração da prestação continua na pasta das contas.
    expect(c.bucket.store.has(rep.statements[0].path)).toBe(true);
  });

  it('sem o acervo ligado, publica só a prestação', async () => {
    const c = cenario({ accounts: true });
    const { reportId } = await enviada(c);
    await chamar(c, FIS, { action: 'opinion', reportId, opinion: { verdict: 'reject', text: 'Despesas sem comprovante.' } });
    const r = await chamar(c, FIN, { action: 'report_publish', reportId });
    expect(r.acervo).toBeNull();
    expect(docs(c, 'federation_docs/')).toHaveLength(0);
    expect(doc(c, `federation_account_reports/${reportId}`).status).toBe('published');
  });
});

describe('contas: as diárias pagas da arbitragem entram como despesa derivada', () => {
  const escalas = (c) => {
    c.db.store.docs.set('federation_assignments/a1', { federation_id: 'fpp', status: 'done', fee_cents: 20000, travel_cents: 5000, paid_at_ms: Date.UTC(2026, 4, 3, 15, 0) });
    c.db.store.docs.set('federation_assignments/a2', { federation_id: 'fpp', status: 'done', fee_cents: 20000 }); // a pagar: não entra
    c.db.store.docs.set('federation_assignments/a3', { federation_id: 'outra', status: 'done', fee_cents: 9999, paid_at_ms: Date.UTC(2026, 4, 3, 15, 0) });
  };

  it('sem o módulo de arbitragem ligado, nada', async () => {
    const c = cenario();
    escalas(c);
    expect(await ac.despesasDerivadas(ctx(c), { id: 'fpp', modules: { accounts: true } })).toEqual([]);
  });

  it('com a arbitragem ligada, a diária paga (diária + deslocamento) vai para a categoria arbitragem e entra no retrato', async () => {
    const c = cenario({ accounts: true, official_docs: true, calendar: true, referees: true });
    escalas(c);
    expect(await ac.despesasDerivadas(ctx(c), { id: 'fpp', modules: { referees: true } })).toEqual([{ date: '2026-05-03', amount_cents: 25000, category: 'referees', ref: 'a1' }]);
    const q = await chamar(c, FIN, { action: 'report_open', period: '2026-Q2' });
    await chamar(c, FIN, { action: 'report_submit', reportId: q.reportId });
    expect(doc(c, 'federation_account_reports/fpp_2026-Q2').snapshot).toMatchObject({ expense: { referees: 25000 }, expense_total: 25000 });
  });
});
