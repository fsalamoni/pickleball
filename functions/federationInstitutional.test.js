/**
 * Cofre de certidões e projetos da Lei de Incentivo no SERVIDOR contra um
 * Firestore e um bucket falsos: quem grava (financeiro/admin; o conselho
 * fiscal só lê), o arquivo copiado para a pasta fechada, a nova certidão no
 * mesmo registro, os avisos de vencimento uma vez cada, o fluxo do projeto
 * (captação → execução → prestação → encerrado), o aporte virando receita das
 * contas e o período fechado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const inst = require('./federationInstitutional.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0); // 23/10/2026, meio-dia em Brasília
const DIA = 86400000;
const PRES = { uid: 'pres', name: 'Presidente' };
const FIN = { uid: 'fin', name: 'Financeiro' };
const FIS = { uid: 'fis', name: 'Fiscal' };
const SEC = { uid: 'sec', name: 'Secretaria' };

function fakeBucket(arquivos = {}) {
  const store = new Map(Object.entries(arquivos).map(([p, { bytes, contentType }]) => [p, { bytes: Buffer.from(bytes), meta: { contentType, size: String(Buffer.from(bytes).length) } }]));
  const file = (name) => ({
    name,
    async getMetadata() { if (!store.has(name)) throw new Error('404'); return [store.get(name).meta]; },
    async copy(dest) { const o = store.get(name); if (!o) throw new Error('404'); store.set(dest.name, { bytes: Buffer.from(o.bytes), meta: { ...o.meta } }); },
    async delete() { store.delete(name); },
    async download() { return [store.get(name).bytes]; },
  });
  return { file, store };
}

const PDF = 'federacao-contas/fin/cnd.pdf';
const PDF2 = 'federacao-contas/fin/cnd2.pdf';
const ALHEIO = 'federacao-contas/sec/x.pdf';
const ZIP = 'federacao-contas/fin/x.zip';

function cenario(extra = {}, mods = { certificates: true, incentive_projects: true, accounts: true }) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', status: 'approved', published: true, modules: mods },
      'federation_staff/fgp_pres': { federation_id: 'fgp', user_id: 'pres', role: 'president' },
      'federation_staff/fgp_fin': { federation_id: 'fgp', user_id: 'fin', role: 'custom', perms: ['finance'] },
      'federation_staff/fgp_fis': { federation_id: 'fgp', user_id: 'fis', role: 'custom', perms: ['fiscal'] },
      'federation_staff/fgp_sec': { federation_id: 'fgp', user_id: 'sec', role: 'custom', perms: ['members'] },
      ...extra,
    }),
    bucket: fakeBucket({
      [PDF]: { bytes: 'cnd', contentType: 'application/pdf' },
      [PDF2]: { bytes: 'cnd nova', contentType: 'application/pdf' },
      [ALHEIO]: { bytes: 'x', contentType: 'application/pdf' },
      [ZIP]: { bytes: 'zip', contentType: 'application/zip' },
    }),
  };
}
const ctx = (c, now = NOW) => ({ db: c.db, bucket: c.bucket, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => inst.institutional(ctx(c, now), actor, { federationId: 'fgp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const CND = { kind: 'cnd_federal', number: '123', issued_at: '2026-10-01', valid_until: '2027-03-30' };

describe('cofre de certidões', () => {
  it('o financeiro anexa: o arquivo vai para a pasta fechada; fiscal e secretaria não gravam', async () => {
    const c = cenario();
    const { certId } = await chamar(c, FIN, { action: 'cert_save', cert: CND, file: { path: PDF, name: 'cnd.pdf' } });
    const d = doc(c, `federation_certificates/${certId}`);
    expect(d).toMatchObject({ federation_id: 'fgp', kind: 'cnd_federal', valid_until: '2027-03-30', warned_steps: [], created_by: 'fin' });
    expect(d.file.path).toMatch(new RegExp(`^federacao-certidoes/fgp/${certId}/\\d+\\.pdf$`));
    expect(c.bucket.store.has(d.file.path)).toBe(true);
    expect(c.bucket.store.has(PDF)).toBe(false);
    await expect(chamar(c, FIS, { action: 'cert_save', cert: CND, file: { path: PDF2 } })).rejects.toThrow(/financeiro/);
    await expect(chamar(c, SEC, { action: 'cert_save', cert: CND, file: { path: PDF2 } })).rejects.toThrow(/financeiro/);
  });

  it('recusa sem arquivo, arquivo de outra pessoa, tipo errado, emissão futura e módulo desligado', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'cert_save', cert: CND })).rejects.toThrow(/Anexe/);
    await expect(chamar(c, FIN, { action: 'cert_save', cert: CND, file: { path: ALHEIO } })).rejects.toThrow(/de novo/);
    await expect(chamar(c, FIN, { action: 'cert_save', cert: CND, file: { path: ZIP } })).rejects.toThrow(/PDF ou imagem/);
    await expect(chamar(c, FIN, { action: 'cert_save', cert: { ...CND, issued_at: '2026-11-01' }, file: { path: PDF } })).rejects.toThrow(/futuro/);
    await expect(chamar(cenario({}, { incentive_projects: true }), FIN, { action: 'cert_save', cert: CND, file: { path: PDF } })).rejects.toThrow(/cofre de certidões/);
  });

  it('o fiscal abre o arquivo; a secretaria não; só o admin apaga, com motivo', async () => {
    const c = cenario();
    const { certId } = await chamar(c, FIN, { action: 'cert_save', cert: CND, file: { path: PDF, name: 'cnd.pdf' } });
    const r = await chamar(c, FIS, { action: 'cert_file', certId });
    expect(Buffer.from(r.base64, 'base64').toString()).toBe('cnd');
    expect(r).toMatchObject({ name: 'cnd.pdf', contentType: 'application/pdf' });
    await expect(chamar(c, SEC, { action: 'cert_file', certId })).rejects.toThrow(/conselho fiscal/);
    await expect(chamar(c, FIN, { action: 'cert_delete', certId, reason: 'duplicada' })).rejects.toThrow(/administração/);
    await expect(chamar(c, PRES, { action: 'cert_delete', certId })).rejects.toThrow(/motivo/);
    const caminho = doc(c, `federation_certificates/${certId}`).file.path;
    await chamar(c, PRES, { action: 'cert_delete', certId, reason: 'Anexada por engano' });
    expect(doc(c, `federation_certificates/${certId}`)).toBeUndefined();
    expect(c.bucket.store.has(caminho)).toBe(false);
  });

  it('renovar no mesmo registro troca o arquivo e recomeça os avisos', async () => {
    const c = cenario();
    const { certId } = await chamar(c, FIN, { action: 'cert_save', cert: CND, file: { path: PDF } });
    const antigo = doc(c, `federation_certificates/${certId}`).file.path;
    c.db.store.docs.get(`federation_certificates/${certId}`).warned_steps = [30];
    await chamar(c, FIN, { action: 'cert_save', certId, cert: { ...CND, valid_until: '2027-09-30' }, file: { path: PDF2 } }, NOW + 1000);
    const d = doc(c, `federation_certificates/${certId}`);
    expect(d.warned_steps).toEqual([]);
    expect(c.bucket.store.has(antigo)).toBe(false);
    expect(c.bucket.store.has(d.file.path)).toBe(true);
  });

  it('a varredura avisa 30, 7 e 1 dia antes e quando vence, uma vez cada, só a atual', async () => {
    const c = cenario({
      'federation_certificates/velha': { federation_id: 'fgp', kind: 'fgts', issued_at: '2026-01-01', valid_until: '2026-02-01', warned_steps: [] },
      'federation_certificates/fgts': { federation_id: 'fgp', kind: 'fgts', issued_at: '2026-10-20', valid_until: '2026-11-20', warned_steps: [] },
      'federation_certificates/off': { federation_id: 'outra', kind: 'fgts', issued_at: '2026-10-20', valid_until: '2026-10-25', warned_steps: [] },
    });
    await inst.sweep(ctx(c));
    expect(avisos(c)).toHaveLength(2); // pres + fin, só da atual (a "velha" é substituída), a de outra federação não existe
    expect(avisos(c)[0]).toMatchObject({ link: '/federacoes/fgp/gerir?aba=certidoes' });
    expect(doc(c, 'federation_certificates/fgts').warned_steps).toEqual([30]);
    await inst.sweep(ctx(c));
    expect(avisos(c)).toHaveLength(2);
    await inst.sweep(ctx(c, NOW + 21 * DIA)); // faltam 7
    expect(doc(c, 'federation_certificates/fgts').warned_steps).toEqual([30, 7]);
    await inst.sweep(ctx(c, NOW + 29 * DIA)); // venceu
    expect(doc(c, 'federation_certificates/fgts').warned_steps).toEqual([30, 7, 0]);
    expect(avisos(c)).toHaveLength(6);
  });
});

const PROJ = { title: 'Pickleball nas escolas', approved_cents: 10000000, capture_until: '2026-11-15', exec_start: '2027-01-01', exec_end: '2027-12-31' };
const APORTE = { donor_name: 'Raquetes Sul', donor_doc: '12345678000190', kind: 'sponsorship', amount_cents: 2500000, date: '2026-10-20' };

describe('projetos da Lei de Incentivo', () => {
  it('o financeiro registra; o fiscal não; o aporte vira receita das contas', async () => {
    const c = cenario();
    const { projectId } = await chamar(c, FIN, { action: 'project_save', project: PROJ });
    expect(doc(c, `federation_incentive_projects/${projectId}`)).toMatchObject({ status: 'capturing', receipts: [], created_by: 'fin' });
    await expect(chamar(c, FIS, { action: 'project_save', project: PROJ })).rejects.toThrow(/financeiro/);
    await expect(chamar(c, FIN, { action: 'project_receive', projectId, receipt: { ...APORTE, date: '2026-12-01' } })).rejects.toThrow(/campos/);
    const { receiptId } = await chamar(c, FIN, { action: 'project_receive', projectId, receipt: APORTE });
    const rec = await inst.receitas(ctx(c), { id: 'fgp', modules: { incentive_projects: true } });
    expect(rec).toEqual([expect.objectContaining({ date: '2026-10-20', amount_cents: 2500000, category: 'grants', auto: 'incentive', ref: `incentive:${projectId}:${receiptId}` })]);
    expect(await inst.receitas(ctx(c), { id: 'fgp', modules: {} })).toEqual([]);
    // Estorno pede motivo e sai das contas.
    await expect(chamar(c, FIN, { action: 'project_void', projectId, receiptId })).rejects.toThrow(/motivo/);
    await chamar(c, FIN, { action: 'project_void', projectId, receiptId, reason: 'Depósito devolvido' });
    expect(await inst.receitas(ctx(c), { id: 'fgp', modules: { incentive_projects: true } })).toEqual([]);
    await expect(chamar(c, FIN, { action: 'project_void', projectId, receiptId, reason: 'de novo' })).rejects.toThrow(/não está registrado/);
  });

  it('aporte em período com prestação enviada é recusado', async () => {
    const c = cenario({ 'federation_account_reports/a': { federation_id: 'fgp', period: '2026', status: 'submitted' } });
    const { projectId } = await chamar(c, FIN, { action: 'project_save', project: PROJ });
    await expect(chamar(c, FIN, { action: 'project_receive', projectId, receipt: APORTE })).rejects.toThrow(/fechado/);
  });

  it('o fluxo passa uma etapa de cada vez; prestação pede data; encerramento pede resultado; voltar pede motivo', async () => {
    const c = cenario();
    const { projectId } = await chamar(c, FIN, { action: 'project_save', project: PROJ });
    await chamar(c, FIN, { action: 'project_receive', projectId, receipt: APORTE });
    await expect(chamar(c, FIN, { action: 'project_status', projectId, to: 'reporting', sentAt: '2026-10-22' })).rejects.toThrow(/etapa de cada vez/);
    await expect(chamar(c, FIN, { action: 'project_status', projectId, to: 'cancelled', reason: 'desistimos' })).rejects.toThrow(/com aporte não se cancela/);
    await chamar(c, FIN, { action: 'project_status', projectId, to: 'executing' });
    await expect(chamar(c, FIN, { action: 'project_status', projectId, to: 'reporting' })).rejects.toThrow(/data/);
    await chamar(c, FIN, { action: 'project_status', projectId, to: 'reporting', sentAt: '2026-10-22', protocol: 'SEI 42' });
    expect(doc(c, `federation_incentive_projects/${projectId}`).accountability).toMatchObject({ sent_at: '2026-10-22', protocol: 'SEI 42' });
    await expect(chamar(c, FIN, { action: 'project_receive', projectId, receipt: APORTE })).rejects.toThrow(/captação ou em execução/);
    await expect(chamar(c, FIN, { action: 'project_status', projectId, to: 'closed' })).rejects.toThrow(/resultado/);
    await chamar(c, FIN, { action: 'project_status', projectId, to: 'closed', result: 'approved', resultAt: '2026-10-23' });
    expect(doc(c, `federation_incentive_projects/${projectId}`)).toMatchObject({ status: 'closed', accountability: { result: 'approved', result_at: '2026-10-23' } });
    await expect(chamar(c, FIN, { action: 'project_status', projectId, to: 'reporting' })).rejects.toThrow(/motivo/);
    await chamar(c, FIN, { action: 'project_status', projectId, to: 'reporting', reason: 'Resultado lançado errado' });
    expect(doc(c, `federation_incentive_projects/${projectId}`).accountability).toMatchObject({ sent_at: '2026-10-22', result: '' });
    // Com aporte, nem o admin apaga.
    await expect(chamar(c, PRES, { action: 'project_delete', projectId })).rejects.toThrow(/não se apaga/);
  });

  it('sem aporte: cancela com motivo; só o admin apaga', async () => {
    const c = cenario();
    const { projectId } = await chamar(c, FIN, { action: 'project_save', project: PROJ });
    await expect(chamar(c, FIN, { action: 'project_status', projectId, to: 'cancelled' })).rejects.toThrow(/motivo/);
    await chamar(c, FIN, { action: 'project_status', projectId, to: 'cancelled', reason: 'Não captou' });
    await expect(chamar(c, FIN, { action: 'project_save', projectId, project: PROJ })).rejects.toThrow(/cancelado/);
    await expect(chamar(c, FIN, { action: 'project_delete', projectId })).rejects.toThrow(/administração/);
    await chamar(c, PRES, { action: 'project_delete', projectId });
    expect(doc(c, `federation_incentive_projects/${projectId}`)).toBeUndefined();
  });

  it('a varredura avisa uma vez 30 dias antes do fim da captação', async () => {
    const c = cenario({
      'federation_incentive_projects/p1': { federation_id: 'fgp', title: 'Escolas', status: 'capturing', approved_cents: 100000, capture_until: '2026-11-15', receipts: [{ id: 'r', amount_cents: 25000, date: '2026-10-01', donor_name: 'A' }], warned_capture_for: '' },
      'federation_incentive_projects/p2': { federation_id: 'fgp', title: 'Longe', status: 'capturing', approved_cents: 100000, capture_until: '2027-06-01', receipts: [], warned_capture_for: '' },
    });
    await inst.sweep(ctx(c));
    expect(avisos(c)).toHaveLength(2);
    expect(avisos(c)[0]).toMatchObject({ link: '/federacoes/fgp/gerir?aba=lei-incentivo' });
    expect(avisos(c)[0].message).toMatch(/R\$ 250,00 de R\$ 1000,00/);
    expect(doc(c, 'federation_incentive_projects/p1').warned_capture_for).toBe('2026-11-15');
    await inst.sweep(ctx(c));
    expect(avisos(c)).toHaveLength(2);
  });
});
