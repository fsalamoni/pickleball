/**
 * Licença de professor e proteção de menores no SERVIDOR contra um Firestore
 * falso: quem concede (só `courses`/`admin`, nunca a si mesmo), o que se
 * dispensa (credencial e horas, com motivo) e o que não se dispensa (a
 * proteção), o selo público, a certidão (só o responsável confere, o arquivo
 * é apagado), a denúncia de proteção avisando na hora e a varredura.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const co = require('./federationCoaching.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 22, 15, 0, 0); // 22/10/2026, meio-dia em Brasília
const PRES = { uid: 'pres', name: 'Presidente' };
const CUR = { uid: 'cur', name: 'Cursos' };
const SGO = { uid: 'sgo', name: 'Proteção' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const ARQ = 'federacao/ana/cert1.pdf';

function cenario(extra = {}, mods = { coach_licenses: true, safeguarding: true, courses: true, discipline: true }) {
  const arquivos = new Set([ARQ]);
  return {
    arquivos,
    bucket: {
      file: (path) => ({
        delete: async () => { arquivos.delete(path); },
        getMetadata: async () => (arquivos.has(path) ? [{ size: 10, contentType: 'application/pdf' }] : Promise.reject(new Error('404'))),
        download: async () => [Buffer.from('PDF')],
      }),
    },
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, modules: mods },
      'federation_staff/fgp_pres': { federation_id: 'fgp', user_id: 'pres', role: 'president' },
      'federation_staff/fgp_cur': { federation_id: 'fgp', user_id: 'cur', role: 'referees' },
      'federation_staff/fgp_sgo': { federation_id: 'fgp', user_id: 'sgo', role: 'custom', perms: ['safeguarding'] },
      'users/ana': { platform_name: 'Ana Professora', city: 'Porto Alegre', state: 'rs', email: 'ana@x.com' },
      'users/bia': { full_name: 'Bia' },
      'federation_credentials/k1_ana': { federation_id: 'fgp', user_id: 'ana', kind: 'coach', level: 'Nível 1', status: 'active', valid_until: '2027-12-31', course_name: 'Formação 1' },
      'federation_courses/up1': { federation_id: 'fgp', hours: 8 },
      'federation_course_enrollments/up1_ana': { federation_id: 'fgp', course_id: 'up1', user_id: 'ana', status: 'passed', graded_at_ms: Date.UTC(2026, 5, 1) },
      ...extra,
    }),
  };
}
const ctx = (c, now = NOW) => ({ db: c.db, bucket: c.bucket, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => co.coaching(ctx(c, now), actor, { federationId: 'fgp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && (!uid || d.user_id === uid)).map(([, d]) => d);
/** Ana em dia com a proteção: curso de proteção + certidão conferida. */
const SG_OK = {
  'federation_credentials/s1_ana': { federation_id: 'fgp', user_id: 'ana', kind: 'safeguarding', status: 'active', valid_until: '2027-06-30' },
  'federation_safeguarding/fgp_ana': { federation_id: 'fgp', user_id: 'ana', name: 'Ana Professora', background: { status: 'valid', issued_at: '2026-09-01', valid_until: '2027-09-01' } },
};

describe('licença: pedir e conceder', () => {
  it('o professor pede; a equipe de cursos é avisada', async () => {
    const c = cenario();
    const r = await chamar(c, ANA, { action: 'license_apply', level: 'l1', note: 'Dou aula há 3 anos.' });
    expect(r).toEqual({ ok: true, renewal: false });
    const lic = doc(c, 'federation_coach_licenses/fgp_ana');
    expect(lic).toMatchObject({ status: 'pending', level: 'l1', name: 'Ana Professora', state: 'RS', request_note: 'Dou aula há 3 anos.' });
    expect(lic.email).toBeUndefined();
    expect(avisos(c, 'cur')).toHaveLength(1);
    expect(avisos(c, 'pres')).toHaveLength(1);
    expect(avisos(c, 'sgo')).toHaveLength(0);
    await expect(chamar(c, ANA, { action: 'license_apply', level: 'l1' })).rejects.toThrow(/já está em análise/);
  });

  it('só courses/admin decide, e ninguém concede a própria licença', async () => {
    const c = cenario(SG_OK);
    await expect(chamar(c, SGO, { action: 'license_grant', userId: 'ana', level: 'l1' })).rejects.toThrow(/permissão/);
    await expect(chamar(c, BIA, { action: 'license_list' })).rejects.toThrow(/permissão/);
    await expect(chamar(c, CUR, { action: 'license_grant', userId: 'cur', level: 'l1' })).rejects.toThrow(/sua própria/);
  });

  it('a proteção de menores fora do dia NUNCA se dispensa', async () => {
    const c = cenario();
    await expect(chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l1', waiverReason: 'Conhecida de longa data.' })).rejects.toThrow(/não se dispensa/);
  });

  it('com tudo em dia concede sem motivo; o selo vai ao perfil e o professor é avisado', async () => {
    const c = cenario(SG_OK);
    const r = await chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l1' });
    expect(r).toEqual({ ok: true, valid_until: '2027-10-22', waived: [] });
    expect(doc(c, 'federation_coach_licenses/fgp_ana')).toMatchObject({ status: 'active', valid_until: '2027-10-22', granted_by: 'cur', waiver: null, safeguarding_until: '2027-06-30' });
    expect(doc(c, 'federation_coach_badges/ana')).toMatchObject({ user_id: 'ana', federation_ids: ['fgp'], badges: [{ federation_id: 'fgp', acronym: 'FGP', level_id: 'l1', valid_until: '2027-10-22' }] });
    expect(avisos(c, 'ana')[0].title).toMatch(/licenciado pela FGP/);
  });

  it('faltando horas: só com motivo escrito, que fica gravado', async () => {
    const c = cenario(SG_OK);
    await expect(chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l2' })).rejects.toThrow(/motivo da dispensa/);
    const r = await chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l2', waiverReason: 'Ex-atleta profissional, banca avaliou.' });
    expect(r.waived).toEqual(['credential', 'hours']);
    expect(doc(c, 'federation_coach_licenses/fgp_ana').waiver).toMatchObject({ missing: ['credential', 'hours'], by: 'cur' });
  });

  it('renovar antes de vencer soma a partir do vencimento', async () => {
    const c = cenario({ ...SG_OK, 'federation_coach_licenses/fgp_ana': { federation_id: 'fgp', user_id: 'ana', name: 'Ana', status: 'active', level: 'l1', level_label: 'Nível 1', valid_until: '2026-11-10' } });
    expect(await chamar(c, ANA, { action: 'license_apply', level: 'l1' })).toEqual({ ok: true, renewal: true });
    expect(doc(c, 'federation_coach_licenses/fgp_ana').renewal_requested_at_ms).toBe(NOW);
    const r = await chamar(c, CUR, { action: 'license_grant', userId: 'ana' });
    expect(r.valid_until).toBe('2027-11-10');
    expect(doc(c, 'federation_coach_licenses/fgp_ana').renewal_requested_at_ms).toBeNull();
  });
});

describe('licença: decisões e selo', () => {
  it('suspender tira o selo; reativar devolve; recusa e cassação pedem motivo', async () => {
    const c = cenario(SG_OK);
    await chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l1' });
    await expect(chamar(c, CUR, { action: 'license_suspend', userId: 'ana', reason: '' })).rejects.toThrow(/motivo/);
    await chamar(c, CUR, { action: 'license_suspend', userId: 'ana', reason: 'Denúncia em apuração' });
    expect(doc(c, 'federation_coach_badges/ana')).toBeUndefined();
    await chamar(c, CUR, { action: 'license_reinstate', userId: 'ana' });
    expect(doc(c, 'federation_coach_badges/ana').badges).toHaveLength(1);
    await chamar(c, CUR, { action: 'license_revoke', userId: 'ana', reason: 'Conduta' });
    expect(doc(c, 'federation_coach_licenses/fgp_ana').status).toBe('revoked');
    expect(doc(c, 'federation_coach_badges/ana')).toBeUndefined();
    await expect(chamar(c, ANA, { action: 'license_apply', level: 'l1' })).rejects.toThrow(/suspensa ou cassada/);
  });

  it('o professor esconde o selo do perfil', async () => {
    const c = cenario(SG_OK);
    await chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l1' });
    await chamar(c, ANA, { action: 'license_prefs', publicListing: false });
    expect(doc(c, 'federation_coach_badges/ana')).toBeUndefined();
    await chamar(c, ANA, { action: 'license_prefs', publicListing: true });
    expect(doc(c, 'federation_coach_badges/ana')).toBeDefined();
  });

  it('federação oculta não dá selo', async () => {
    const c = cenario(SG_OK);
    c.db.store.docs.set('federations/fgp', { ...doc(c, 'federations/fgp'), published: false });
    await chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l1' });
    expect(doc(c, 'federation_coach_badges/ana')).toBeUndefined();
  });

  it('módulo desligado recusa', async () => {
    const c = cenario({}, { safeguarding: true });
    await expect(chamar(c, ANA, { action: 'license_apply', level: 'l1' })).rejects.toThrow(/licença de professor ligada/);
  });
});

describe('proteção de menores: certidão', () => {
  it('a pessoa envia do próprio Storage; só o responsável é avisado', async () => {
    const c = cenario();
    await expect(chamar(c, ANA, { action: 'sg_submit', issuedAt: '2026-10-01', filePath: 'federacao/bia/x.pdf' })).rejects.toThrow(/pela tela/);
    await expect(chamar(c, ANA, { action: 'sg_submit', issuedAt: '2026-11-01', filePath: ARQ })).rejects.toThrow(/futuro/);
    await chamar(c, ANA, { action: 'sg_submit', issuedAt: '2026-10-01', filePath: ARQ });
    expect(doc(c, 'federation_safeguarding/fgp_ana').pending_background).toMatchObject({ issued_at: '2026-10-01', valid_until: '2027-10-01', file_path: ARQ });
    expect(avisos(c, 'sgo')).toHaveLength(1);
    expect(avisos(c, 'pres')).toHaveLength(1);
    expect(avisos(c, 'cur')).toHaveLength(0);
  });

  it('só quem tem `safeguarding` vê o arquivo e confere; conferida, o arquivo é apagado', async () => {
    const c = cenario({ 'federation_credentials/s1_ana': SG_OK['federation_credentials/s1_ana'] });
    await chamar(c, ANA, { action: 'sg_submit', issuedAt: '2026-10-01', filePath: ARQ });
    await expect(chamar(c, CUR, { action: 'sg_file', userId: 'ana' })).rejects.toThrow(/Só o responsável/);
    await expect(chamar(c, CUR, { action: 'sg_verify', userId: 'ana', decision: 'valid' })).rejects.toThrow(/Só o responsável/);
    expect((await chamar(c, SGO, { action: 'sg_file', userId: 'ana' })).base64).toBe(Buffer.from('PDF').toString('base64'));
    await chamar(c, SGO, { action: 'sg_verify', userId: 'ana', decision: 'valid' });
    const rec = doc(c, 'federation_safeguarding/fgp_ana');
    expect(rec.pending_background).toBeUndefined();
    expect(rec.background).toMatchObject({ status: 'valid', valid_until: '2027-10-01', verified_by: 'sgo' });
    expect(rec.cleared_until).toBe('2027-06-30');
    expect(c.arquivos.has(ARQ)).toBe(false);
  });

  it('não aceita exige motivo, que vai à pessoa; o responsável não confere a própria', async () => {
    const c = cenario({ 'users/sgo': { full_name: 'Sônia' } });
    await chamar(c, ANA, { action: 'sg_submit', issuedAt: '2026-10-01', filePath: ARQ });
    await expect(chamar(c, SGO, { action: 'sg_verify', userId: 'ana', decision: 'rejected' })).rejects.toThrow(/motivo/);
    await chamar(c, SGO, { action: 'sg_verify', userId: 'ana', decision: 'rejected', reason: 'Documento ilegível' });
    expect(doc(c, 'federation_safeguarding/fgp_ana').last_rejection.reason).toBe('Documento ilegível');
    expect(avisos(c, 'ana').some((a) => /Documento ilegível/.test(a.message))).toBe(true);
    await expect(chamar(c, SGO, { action: 'sg_verify', userId: 'sgo', decision: 'valid' })).rejects.toThrow(/sua própria/);
  });

  it('revogar tira a liberação e a licença perde a data', async () => {
    const c = cenario(SG_OK);
    await chamar(c, CUR, { action: 'license_grant', userId: 'ana', level: 'l1' });
    await chamar(c, SGO, { action: 'sg_revoke', userId: 'ana', reason: 'Fato novo apurado' });
    expect(doc(c, 'federation_safeguarding/fgp_ana').background.status).toBe('revoked');
    expect(doc(c, 'federation_coach_licenses/fgp_ana').safeguarding_until).toBe('');
  });

  it('o "me" da pessoa não leva caminho do arquivo nem quem conferiu', async () => {
    const c = cenario(SG_OK);
    const r = await chamar(c, ANA, { action: 'me' });
    expect(r.sg).toMatchObject({ ok: true, until: '2027-06-30' });
    expect(JSON.stringify(r)).not.toMatch(/verified_by|file_path/);
    expect(r.levels.find((l) => l.id === 'l1').requirements.ok).toBe(true);
  });

  it('o quadro da Central junta professor, árbitro, diretor e o que está em dia', async () => {
    const c = cenario({
      ...SG_OK,
      'federation_referees/fgp_bia': { federation_id: 'fgp', user_id: 'bia', name: 'Bia', status: 'active', functions: ['referee'] },
      'federation_coach_licenses/fgp_ana': { federation_id: 'fgp', user_id: 'ana', name: 'Ana', status: 'active', valid_until: '2027-01-01' },
    });
    await expect(chamar(c, CUR, { action: 'sg_overview' })).rejects.toThrow(/Só o responsável/);
    const { rows } = await chamar(c, SGO, { action: 'sg_overview' });
    expect(rows.find((r) => r.user_id === 'ana')).toMatchObject({ roles: ['coach'], required: true, ok: true });
    expect(rows.find((r) => r.user_id === 'bia')).toMatchObject({ roles: ['referee'], required: true, ok: false });
  });

  it('clearanceBlocker diz o que falta e respeita a régua', async () => {
    const c = cenario();
    const fed = { id: 'fgp', ...doc(c, 'federations/fgp') };
    expect(await co.clearanceBlocker(ctx(c), fed, 'ana', 'referee')).toMatch(/curso de proteção.*certidão/);
    expect(await co.clearanceBlocker(ctx(c), fed, 'ana', 'staff')).toBeNull();
    expect(await co.clearanceBlocker(ctx(c), { ...fed, modules: {} }, 'ana', 'referee')).toBeNull();
  });
});

describe('denúncia e varredura', () => {
  it('denúncia de proteção avisa SÓ o responsável, sem o texto', async () => {
    const c = cenario();
    const r = await co.onReportCreated(ctx(c), { kind: 'minor_protection', federation_id: 'fgp', body: 'Segredo do relato' });
    expect(r.notified).toBe(2);
    expect(avisos(c, 'sgo')).toHaveLength(1);
    expect(avisos(c, 'cur')).toHaveLength(0);
    expect(JSON.stringify(avisos(c))).not.toMatch(/Segredo/);
    expect(await co.onReportCreated(ctx(c), { kind: 'conduct', federation_id: 'fgp' })).toEqual({ skipped: true });
  });

  it('avisa a licença que vence uma vez só; vencida tira o selo', async () => {
    const c = cenario({ ...SG_OK, 'federation_coach_licenses/fgp_ana': { federation_id: 'fgp', user_id: 'ana', name: 'Ana', status: 'active', level: 'l1', level_label: 'Nível 1', valid_until: '2026-11-05' } });
    await co.recomputeBadge(ctx(c), 'ana');
    expect(doc(c, 'federation_coach_badges/ana')).toBeDefined();
    expect((await co.sweep(ctx(c))).warned).toBe(1);
    expect((await co.sweep(ctx(c))).warned).toBe(0);
    const depois = Date.UTC(2026, 10, 6, 15);
    expect((await co.sweep(ctx(c, depois))).expired).toBe(1);
    expect(doc(c, 'federation_coach_badges/ana')).toBeUndefined();
    expect((await co.sweep(ctx(c, depois))).expired).toBe(0);
  });

  it('avisa a certidão que vence', async () => {
    const c = cenario({ ...SG_OK, 'federation_safeguarding/fgp_ana': { federation_id: 'fgp', user_id: 'ana', name: 'Ana', background: { status: 'valid', valid_until: '2026-11-10' } } });
    expect((await co.sweep(ctx(c))).sg_warned).toBe(1);
    expect((await co.sweep(ctx(c))).sg_warned).toBe(0);
  });
});
