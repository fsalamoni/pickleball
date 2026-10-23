/**
 * Pickleball adaptado no SERVIDOR contra um Firestore e um bucket falsos: o
 * filiado pede com o laudo (copiado para a pasta fechada), a comissão
 * classifica, recusa ou cancela (nunca o próprio pedido), a classificação
 * vigente sobrevive a um pedido novo, o organizador confere os inscritos sem
 * ver o laudo, e a varredura avisa uma vez por data.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ad = require('./federationAdapted.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const DIA = 86400000;
const ANA = { uid: 'ana', name: 'Ana' };
const COMP = { uid: 'comp', name: 'Competições' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const ORG = { uid: 'org', name: 'Organizador' };
const ZE = { uid: 'ze', name: 'Zé' };

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

const MEMBRO = (uid) => ({ federation_id: 'fgp', user_id: uid, status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-01-01' });

function cenario(extra = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', status: 'approved', published: true, modules: { adapted: true } },
      'federation_staff/fgp_comp': { federation_id: 'fgp', user_id: 'comp', role: 'custom', perms: ['competitions'] },
      'federation_staff/fgp_sec': { federation_id: 'fgp', user_id: 'sec', role: 'custom', perms: ['members'] },
      'federation_members/fgp_ana': MEMBRO('ana'),
      'federation_members/fgp_comp': MEMBRO('comp'),
      'users/ana': { platform_name: 'Ana Souza' },
      'tournaments/t1': { name: 'Open', federation_id: 'fgp', creator_uid: 'org' },
      'tournament_modalities/m1': { tournament_id: 't1', adapted_class: 'wheelchair' },
      'tournament_modalities/m2': { tournament_id: 't1' },
      'tournament_registrations/r1': { tournament_id: 't1', modality_id: 'm1', format: 'doubles', status: 'confirmed', player_a_user_id: 'ana', player_a_name: 'Ana', player_b_user_id: 'bia', player_b_name: 'Bia' },
      'tournament_registrations/r2': { tournament_id: 't1', modality_id: 'm1', format: 'doubles', status: 'cancelled', player_a_user_id: 'caio', player_a_name: 'Caio' },
      'tournament_registrations/r3': { tournament_id: 't1', modality_id: 'm1', format: 'singles', status: 'pending_payment', player_a_name: 'Sem conta' },
      ...extra,
    }),
    bucket: fakeBucket({
      'federacao/ana/l1.pdf': { bytes: 'laudo', contentType: 'application/pdf' },
      'federacao/ana/l2.pdf': { bytes: 'laudo novo', contentType: 'application/pdf' },
      'federacao/ana/x.pdf': { bytes: 'zip', contentType: 'application/zip' },
      'federacao/comp/l1.pdf': { bytes: 'laudo', contentType: 'application/pdf' },
    }),
  };
}
const ctx = (c, now = NOW) => ({ db: c.db, bucket: c.bucket, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => ad.adapted(ctx(c, now), actor, { federationId: 'fgp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const pedir = (c, file = 'federacao/ana/l1.pdf', class_id = 'wheelchair') => chamar(c, ANA, { action: 'request', class_id, filePath: file, fileName: 'laudo.pdf' });

describe('pickleball adaptado: pedido', () => {
  it('filiado em dia pede; o laudo vai para a pasta fechada e a comissão é avisada', async () => {
    const c = cenario();
    await pedir(c);
    const d = doc(c, 'federation_adapted_classifications/fgp_ana');
    expect(d).toMatchObject({ user_id: 'ana', name: 'Ana Souza', status: 'pending', class_id: '', request: { class_id: 'wheelchair', class_label: 'Cadeira de rodas' } });
    expect(d.request.report.path).toMatch(/^federacao-laudos\/ana\/fgp_l1\.pdf$/);
    expect(c.bucket.store.has('federacao/ana/l1.pdf')).toBe(false);
    expect(avisos(c).map((a) => a.user_id)).toEqual(['comp']);
    await expect(pedir(c, 'federacao/ana/l2.pdf')).rejects.toThrow(/em análise/);
  });

  it('recusa quem não é filiado, arquivo de outra pessoa, tipo errado e módulo desligado', async () => {
    const c = cenario();
    await expect(chamar(c, ZE, { action: 'request', class_id: 'wheelchair', filePath: 'federacao/ze/a.pdf' })).rejects.toThrow(/filiado/);
    await expect(pedir(c, 'federacao/comp/l1.pdf')).rejects.toThrow(/pela tela/);
    await expect(pedir(c, 'federacao/ana/x.pdf')).rejects.toThrow(/PDF ou imagem/);
    await expect(pedir(c, 'federacao/ana/l1.pdf', 'zz')).rejects.toThrow(/categoria/);
    const off = cenario({ 'federations/fgp': { name: 'F', acronym: 'FGP', status: 'approved', modules: {} } });
    await expect(pedir(off)).rejects.toThrow(/adaptado/);
  });

  it('desistir apaga o pedido e o arquivo', async () => {
    const c = cenario();
    await pedir(c);
    const path = doc(c, 'federation_adapted_classifications/fgp_ana').request.report.path;
    await chamar(c, ANA, { action: 'withdraw' });
    expect(doc(c, 'federation_adapted_classifications/fgp_ana')).toBeUndefined();
    expect(c.bucket.store.has(path)).toBe(false);
  });
});

describe('pickleball adaptado: decisão da comissão', () => {
  it('classifica com revisão; secretaria não decide; ninguém decide o próprio pedido', async () => {
    const c = cenario();
    await pedir(c);
    await expect(chamar(c, SEC, { action: 'decide', userId: 'ana', decision: 'classify', class_id: 'wheelchair' })).rejects.toThrow(/comissão/);
    await chamar(c, COMP, { action: 'request', class_id: 'standing', filePath: 'federacao/comp/l1.pdf' });
    await expect(chamar(c, COMP, { action: 'decide', userId: 'comp', decision: 'classify', class_id: 'standing' })).rejects.toThrow(/próprio/);
    await chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'classify', class_id: 'wheelchair', valid_until: '2027-10-23' });
    const d = doc(c, 'federation_adapted_classifications/fgp_ana');
    expect(d).toMatchObject({ status: 'classified', class_id: 'wheelchair', class_label: 'Cadeira de rodas', valid_until: '2027-10-23', request: null });
    expect(d.report.path).toMatch(/^federacao-laudos\/ana\//);
    expect(avisos(c).some((a) => a.user_id === 'ana' && /classificado/.test(a.title))).toBe(true);
  });

  it('pedido novo recusado mantém a classificação vigente e apaga só o laudo novo', async () => {
    const c = cenario();
    await pedir(c);
    await chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'classify', class_id: 'wheelchair' });
    const vigente = doc(c, 'federation_adapted_classifications/fgp_ana').report.path;
    await pedir(c, 'federacao/ana/l2.pdf', 'standing');
    expect(doc(c, 'federation_adapted_classifications/fgp_ana')).toMatchObject({ status: 'pending', class_id: 'wheelchair' });
    const novo = doc(c, 'federation_adapted_classifications/fgp_ana').request.report.path;
    await expect(chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'decline', note: 'x' })).rejects.toThrow(/motivo/);
    await chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'decline', note: 'Laudo antigo' });
    expect(doc(c, 'federation_adapted_classifications/fgp_ana')).toMatchObject({ status: 'classified', class_id: 'wheelchair', request: null });
    expect(c.bucket.store.has(vigente)).toBe(true);
    expect(c.bucket.store.has(novo)).toBe(false);
  });

  it('reclassificar troca o laudo vigente e apaga o antigo; cancelar exige motivo', async () => {
    const c = cenario();
    await pedir(c);
    await chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'classify', class_id: 'wheelchair' });
    const antigo = doc(c, 'federation_adapted_classifications/fgp_ana').report.path;
    await pedir(c, 'federacao/ana/l2.pdf', 'standing');
    await chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'classify', class_id: 'standing' });
    const d = doc(c, 'federation_adapted_classifications/fgp_ana');
    expect(d.class_id).toBe('standing');
    expect(c.bucket.store.has(antigo)).toBe(false);
    await expect(chamar(c, COMP, { action: 'revoke', userId: 'ana', reason: '' })).rejects.toThrow(/motivo/);
    await chamar(c, COMP, { action: 'revoke', userId: 'ana', reason: 'Laudo contestado' });
    expect(doc(c, 'federation_adapted_classifications/fgp_ana')).toMatchObject({ status: 'revoked', class_id: '', report: null });
    expect(c.bucket.store.has(d.report.path)).toBe(false);
  });

  it('o laudo abre para a pessoa e para a comissão (registrado), não para a secretaria', async () => {
    const c = cenario();
    await pedir(c);
    const meu = await chamar(c, ANA, { action: 'report_file', which: 'request' });
    expect(Buffer.from(meu.base64, 'base64').toString()).toBe('laudo');
    await chamar(c, COMP, { action: 'report_file', userId: 'ana', which: 'request' });
    await expect(chamar(c, SEC, { action: 'report_file', userId: 'ana', which: 'request' })).rejects.toThrow(/comissão/);
    const logs = [...c.db.store.docs.values()].filter((d) => d.action === 'federation_adapted_report_view');
    expect(logs).toHaveLength(1);
  });

  it('categorias próprias só pela comissão', async () => {
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'classes_save', classes: [{ label: 'Cadeira' }] })).rejects.toThrow(/comissão/);
    await expect(chamar(c, COMP, { action: 'classes_save', classes: [] })).rejects.toThrow(/ao menos/);
    await chamar(c, COMP, { action: 'classes_save', classes: [{ label: 'Cadeira ágil' }] });
    expect(doc(c, 'federations/fgp').adapted_classes).toEqual([{ id: 'cadeira_agil', label: 'Cadeira ágil', description: '' }]);
  });
});

describe('pickleball adaptado: conferência do organizador e varredura', () => {
  it('o organizador vê a situação de cada inscrito ativo, sem laudo', async () => {
    const c = cenario();
    await pedir(c);
    await chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'classify', class_id: 'wheelchair' });
    const r = await ad.adapted(ctx(c), ORG, { action: 'check', tournamentId: 't1', modalityId: 'm1' });
    expect(r.class_label).toBe('Cadeira de rodas');
    expect(r.rows).toEqual([
      { registration_id: 'r1', players: [{ name: 'Ana', check: 'ok' }, { name: 'Bia', check: 'missing' }] },
      { registration_id: 'r3', players: [{ name: 'Sem conta', check: 'no_account' }] },
    ]);
    expect(JSON.stringify(r)).not.toMatch(/federacao-laudos/);
    await expect(ad.adapted(ctx(c), ZE, { action: 'check', tournamentId: 't1', modalityId: 'm1' })).rejects.toThrow(/organiza/);
    await expect(ad.adapted(ctx(c), ORG, { action: 'check', tournamentId: 't1', modalityId: 'm2' })).rejects.toThrow(/não é adaptada/);
    expect((await ad.adapted(ctx(c), COMP, { action: 'check', tournamentId: 't1', modalityId: 'm1' })).rows).toHaveLength(2);
  });

  it('a varredura avisa uma vez antes da revisão e uma vez quando passa', async () => {
    const c = cenario();
    await pedir(c);
    await chamar(c, COMP, { action: 'decide', userId: 'ana', decision: 'classify', class_id: 'wheelchair', valid_until: '2026-11-10' });
    const antes = avisos(c).length;
    await ad.sweep(ctx(c));
    await ad.sweep(ctx(c));
    expect(avisos(c).length).toBe(antes + 1);
    await ad.sweep(ctx(c, NOW + 20 * DIA));
    await ad.sweep(ctx(c, NOW + 21 * DIA));
    expect(avisos(c).length).toBe(antes + 2);
    expect(doc(c, 'federation_adapted_classifications/fgp_ana')).toMatchObject({ warned_for: '2026-11-10', expired_notified_for: '2026-11-10' });
  });
});
