/**
 * Rede e desenvolvimento no SERVIDOR contra um Firestore falso: o embaixador
 * (só filiado em dia se candidata, ninguém nomeia a si mesmo, a proteção de
 * menores barra a nomeação, a lista pública sem uid, o relatório e a
 * varredura) e o selo de clube (só quem gere a organização filiada pede, a
 * conferência automática da arena, quem gere não decide o próprio selo, a
 * cópia na filiação e a cassação).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dv = require('./federationDevelopment.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0); // 23/10/2026, meio-dia em Brasília
const PRES = { uid: 'pres', name: 'Presidente' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const GES = { uid: 'ges', name: 'Gestor' };
const ARQ = 'federacao/ges/seguro1.pdf';

function cenario(extra = {}, mods = { ambassadors: true, club_seal: true, affiliations: true }) {
  return {
    bucket: { file: () => ({ getMetadata: async () => [{ size: 10, contentType: 'application/pdf' }], download: async () => [Buffer.from('PDF')] }) },
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, modules: mods, ambassador_rules: { open: true }, club_seal: { open: true } },
      'federation_staff/fgp_pres': { federation_id: 'fgp', user_id: 'pres', role: 'president' },
      'federation_staff/fgp_sec': { federation_id: 'fgp', user_id: 'sec', role: 'secretary' },
      'users/ana': { platform_name: 'Ana Silva', city: 'Pelotas', state: 'rs', photo_url: 'https://x/a.png', email: 'ana@x.com' },
      'federation_members/fgp_ana': { federation_id: 'fgp', user_id: 'ana', status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-01-01' },
      'federation_members/fgp_sec': { federation_id: 'fgp', user_id: 'sec', status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-01-01' },
      'arena_managers/ar1_ges': { arena_id: 'ar1', user_id: 'ges' },
      'federation_affiliations/fgp_arena_ar1': { federation_id: 'fgp', kind: 'arena', org_id: 'ar1', org_name: 'Arena Sul', status: 'approved' },
      ...extra,
    }),
  };
}
const ctx = (c, now = NOW) => ({ db: c.db, bucket: c.bucket, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => dv.development(ctx(c, now), actor, { federationId: 'fgp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && (!uid || d.user_id === uid)).map(([, d]) => d);
const CANDIDATURA = { action: 'amb_apply', motivation: 'Quero levar o pickleball para a zona sul do estado.', region_wish: 'Zona Sul', accept_conduct: true };

describe('embaixadores', () => {
  it('só filiado em dia se candidata, aceitando o código de conduta', async () => {
    const c = cenario();
    await expect(chamar(c, BIA, CANDIDATURA)).rejects.toThrow(/filiado em dia/);
    await expect(chamar(c, ANA, { ...CANDIDATURA, accept_conduct: false })).rejects.toThrow();
    await chamar(c, ANA, CANDIDATURA);
    const a = doc(c, 'federation_ambassadors/fgp_ana');
    expect(a).toMatchObject({ status: 'applied', user_name: 'Ana Silva', state: 'RS', conduct_version: 1, region_wish: 'Zona Sul' });
    expect(a.email).toBeUndefined();
    expect(avisos(c, 'sec')).toHaveLength(1);
  });

  it('com as candidaturas fechadas, ninguém se candidata', async () => {
    const c = cenario({ 'federations/fgp': { name: 'FGP', acronym: 'FGP', status: 'approved', modules: { ambassadors: true }, ambassador_rules: { open: false } } });
    await expect(chamar(c, ANA, CANDIDATURA)).rejects.toThrow(/não está recebendo/);
  });

  it('nomear: só a equipe, nunca a si mesmo; a lista pública não leva uid', async () => {
    const c = cenario();
    await chamar(c, ANA, CANDIDATURA);
    await chamar(c, SEC, { ...CANDIDATURA });
    await expect(chamar(c, BIA, { action: 'amb_appoint', userId: 'ana', region: 'Zona Sul' })).rejects.toThrow(/secretaria/);
    await expect(chamar(c, SEC, { action: 'amb_appoint', userId: 'sec', region: 'Capital' })).rejects.toThrow(/a si mesmo/);
    await chamar(c, PRES, { action: 'amb_appoint', userId: 'ana', region: 'Zona Sul', term_until: '2027-12-31' });
    expect(doc(c, 'federation_ambassadors/fgp_ana')).toMatchObject({ status: 'appointed', region: 'Zona Sul', next_report_due: '2027-01-23' });
    const pub = doc(c, 'federations/fgp').ambassadors_public;
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({ name: 'Ana Silva', region: 'Zona Sul' });
    expect(JSON.stringify(pub)).not.toContain('ana@');
    expect(pub[0].user_id).toBeUndefined();
    expect(avisos(c, 'ana').some((n) => /embaixador/.test(n.title))).toBe(true);
  });

  it('a proteção de menores exigida barra a nomeação', async () => {
    const c = cenario({ 'federations/fgp': { name: 'FGP', acronym: 'FGP', status: 'approved', modules: { ambassadors: true, safeguarding: true }, ambassador_rules: { open: true }, safeguarding: { required_for: ['ambassador'] } } });
    await chamar(c, ANA, CANDIDATURA);
    await expect(chamar(c, PRES, { action: 'amb_appoint', userId: 'ana', region: 'Zona Sul' })).rejects.toThrow(/proteção de menores/);
  });

  it('relatório, encerramento com motivo e saída da lista pública', async () => {
    const c = cenario();
    await chamar(c, ANA, CANDIDATURA);
    await expect(chamar(c, ANA, { action: 'amb_report', text: 'Fiz duas clínicas e um festival na região.' })).rejects.toThrow(/nomeado/);
    await chamar(c, PRES, { action: 'amb_appoint', userId: 'ana', region: 'Zona Sul' });
    await chamar(c, ANA, { action: 'amb_report', text: 'Fiz duas clínicas e um festival na região.' });
    expect(doc(c, 'federation_ambassadors/fgp_ana').reports).toHaveLength(1);
    await expect(chamar(c, PRES, { action: 'amb_end', userId: 'ana' })).rejects.toThrow(/motivo/);
    await chamar(c, PRES, { action: 'amb_end', userId: 'ana', reason: 'Mudou de cidade' });
    expect(doc(c, 'federation_ambassadors/fgp_ana').status).toBe('ended');
    expect(doc(c, 'federations/fgp').ambassadors_public).toEqual([]);
  });

  it('a varredura encerra o mandato vencido e avisa o relatório atrasado uma vez', async () => {
    const c = cenario({
      'federation_ambassadors/fgp_ana': { federation_id: 'fgp', user_id: 'ana', user_name: 'Ana', status: 'appointed', region: 'Sul', term_until: '2026-10-01', conduct_version: 1 },
      'federation_ambassadors/fgp_sec': { federation_id: 'fgp', user_id: 'sec', user_name: 'Sec', status: 'appointed', region: 'Capital', next_report_due: '2026-10-01', conduct_version: 1 },
    });
    await dv.sweep(ctx(c));
    expect(doc(c, 'federation_ambassadors/fgp_ana').status).toBe('ended');
    expect(doc(c, 'federation_ambassadors/fgp_sec').warned_for).toBe('2026-10-01');
    const antes = avisos(c, 'sec').length;
    await dv.sweep(ctx(c));
    expect(avisos(c, 'sec').length).toBe(antes);
    expect(doc(c, 'federations/fgp').ambassadors_public.map((x) => x.name)).toEqual(['Sec']);
  });
});

describe('selo de clube certificado', () => {
  const PEDIDO = { action: 'seal_apply', kind: 'arena', orgId: 'ar1', evidence: {
    safeguarding: { text: 'Todos os professores fizeram o curso de proteção.' },
    insurance: { text: 'Apólice coletiva vigente.', file: { path: ARQ, name: 'seguro.pdf' } },
    courts: { text: 'Quatro quadras oficiais cobertas.' },
    coach: { text: 'Professor licenciado na equipe.' },
  } };

  it('só quem gere a arena filiada pede; a plataforma confere o que sabe', async () => {
    const c = cenario({
      'arena_coaches/c1': { arena_id: 'ar1', user_id: 'ana' },
      'federation_coach_licenses/fgp_ana': { federation_id: 'fgp', user_id: 'ana', status: 'active', valid_until: '2027-06-30' },
      'tournaments/t1': { federation_id: 'fgp', arena_id: 'ar1', starts_at: '2026-05-10', federation_sanction: { status: 'approved' } },
    });
    await expect(chamar(c, ANA, PEDIDO)).rejects.toThrow(/gere a arena/);
    await expect(chamar(c, GES, { ...PEDIDO, evidence: { insurance: { file: { path: 'federacao/outro/x.pdf', name: 'x' } } } })).rejects.toThrow();
    const r = await chamar(c, GES, PEDIDO);
    expect(r.sealId).toBe('fgp_arena_ar1');
    expect(doc(c, 'federation_club_seals/fgp_arena_ar1')).toMatchObject({ status: 'applied', applicant_uid: 'ges', auto_checks: { hosted_event: true, licensed_coach: true } });
    expect(avisos(c, 'sec')).toHaveLength(1);
  });

  it('organização não filiada não pede', async () => {
    const c = cenario({ 'federation_affiliations/fgp_arena_ar1': { federation_id: 'fgp', kind: 'arena', org_id: 'ar1', status: 'pending' } });
    await expect(chamar(c, GES, PEDIDO)).rejects.toThrow(/filiado/);
  });

  it('conceder copia o selo para a filiação; quem gere não decide o próprio; cassar tira', async () => {
    const c = cenario({ 'arena_managers/ar1_sec': { arena_id: 'ar1', user_id: 'sec' } });
    await chamar(c, GES, PEDIDO);
    await expect(chamar(c, SEC, { action: 'seal_grant', sealId: 'fgp_arena_ar1', checks: { safeguarding: true, coach: true, insurance: true, courts: true } })).rejects.toThrow(/próprio selo/);
    await expect(chamar(c, PRES, { action: 'seal_grant', sealId: 'fgp_arena_ar1', checks: { safeguarding: true } })).rejects.toThrow(/Faltam/);
    const r = await chamar(c, PRES, { action: 'seal_grant', sealId: 'fgp_arena_ar1', checks: { safeguarding: true, coach: true, insurance: true, courts: true } });
    expect(r.until).toBe('2027-10-23');
    expect(doc(c, 'federation_affiliations/fgp_arena_ar1').seal).toMatchObject({ name: 'Clube certificado', valid_until: '2027-10-23' });
    expect(avisos(c, 'ges').some((n) => /recebeu o selo/.test(n.title))).toBe(true);
    await expect(chamar(c, GES, PEDIDO)).rejects.toThrow(/renovação abre/);
    await chamar(c, PRES, { action: 'seal_revoke', sealId: 'fgp_arena_ar1', reason: 'Seguro vencido' });
    expect(doc(c, 'federation_affiliations/fgp_arena_ar1').seal).toBeNull();
    expect(doc(c, 'federation_club_seals/fgp_arena_ar1').status).toBe('revoked');
  });

  it('o arquivo da evidência: a equipe e quem gere; ninguém mais', async () => {
    const c = cenario();
    await chamar(c, GES, PEDIDO);
    await expect(chamar(c, ANA, { action: 'seal_file', sealId: 'fgp_arena_ar1', criterionId: 'insurance' })).rejects.toThrow(/evidências/);
    const r = await chamar(c, SEC, { action: 'seal_file', sealId: 'fgp_arena_ar1', criterionId: 'insurance' });
    expect(r).toMatchObject({ ok: true, name: 'seguro.pdf' });
  });

  it('a varredura avisa o selo que vence, uma vez por validade', async () => {
    const c = cenario({ 'federation_club_seals/fgp_arena_ar1': { federation_id: 'fgp', kind: 'arena', org_id: 'ar1', org_name: 'Arena Sul', applicant_uid: 'ges', status: 'granted', granted_until: '2026-11-10' } });
    await dv.sweep(ctx(c));
    await dv.sweep(ctx(c));
    expect(avisos(c, 'ges').filter((n) => /vence/.test(n.title))).toHaveLength(1);
  });
});
