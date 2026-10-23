import { describe, it, expect } from 'vitest';
import {
  addMonthsISO, ownFilePath, normalizeAmbassadorRules, validateAmbassadorApply, validateAppointment, ambassadorState, ambassadorsPublic,
  normalizeSealRules, validateSealApply, sealState, sealDecision, affiliationSealValid, canManageDevelopment, DEFAULT_CONDUCT,
} from './development.js';

const HOJE = '2026-10-23';

describe('embaixadores: régua', () => {
  it('meses somados sem estourar o fim do mês', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-10-23', -12)).toBe('2025-10-23');
  });

  it('regras: sem nada gravado, aberto, código padrão, relatório a cada 3 meses', () => {
    expect(normalizeAmbassadorRules(undefined)).toEqual({ open: true, conduct_text: DEFAULT_CONDUCT, conduct_version: 1, report_months: 3 });
    expect(normalizeAmbassadorRules({ report_months: 5, conduct_text: 'curto' }).report_months).toBe(3);
  });

  it('candidatura exige motivação, região e o aceite', () => {
    expect(validateAmbassadorApply({ motivation: 'curta', region_wish: 'X', accept_conduct: false }).errors).toHaveProperty('accept_conduct');
    expect(validateAmbassadorApply({ motivation: 'Quero levar o esporte ao interior do estado.', region_wish: 'Serra', accept_conduct: true }).ok).toBe(true);
  });

  it('mandato termina depois de hoje', () => {
    expect(validateAppointment({ region: 'Serra', term_until: '2026-10-01' }, HOJE).ok).toBe(false);
    expect(validateAppointment({ region: 'Serra' }, HOJE).ok).toBe(true);
  });

  it('situação: relatório vencido, código novo e mandato acabado', () => {
    const a = { status: 'appointed', next_report_due: '2026-10-01', conduct_version: 1 };
    const st = ambassadorState(a, { conduct_version: 2 }, HOJE);
    expect(st).toMatchObject({ appointed: true, reportDue: true, overdueDays: 22, needsReaccept: true, canApply: false });
    expect(ambassadorState({ ...a, term_until: '2026-10-10' }, {}, HOJE)).toMatchObject({ appointed: false, termEnded: true, canApply: true });
  });

  it('lista pública: só nomeados em mandato, sem uid, por região', () => {
    const pub = ambassadorsPublic([
      { key: 'k2', user_id: 'u2', user_name: 'Bia', region: 'Serra', status: 'appointed' },
      { key: 'k1', user_id: 'u1', user_name: 'Ana', region: 'Capital', status: 'appointed', appointed_at: '2026-01-01' },
      { key: 'k3', user_id: 'u3', user_name: 'Caio', region: 'Sul', status: 'applied' },
      { key: 'k4', user_id: 'u4', user_name: 'Duda', region: 'Oeste', status: 'appointed', term_until: '2026-01-01' },
    ], HOJE);
    expect(pub.map((x) => x.name)).toEqual(['Ana', 'Bia']);
    expect(pub[0]).toEqual({ key: 'k1', name: 'Ana', photo_url: '', region: 'Capital', since: '2026-01-01' });
  });
});

describe('selo de clube: régua', () => {
  it('sem critérios gravados, os padrão; ids únicos e limpos', () => {
    expect(normalizeSealRules(undefined).criteria.map((c) => c.id)).toEqual(['safeguarding', 'coach', 'insurance', 'courts', 'event']);
    const r = normalizeSealRules({ criteria: [{ id: 'A b', label: 'Primeiro' }, { id: 'ab', label: 'Segundo' }], validity_months: 99 });
    expect(r.criteria.map((c) => c.id)).toEqual(['ab', 'ab2']);
    expect(r.validity_months).toBe(36);
  });

  it('arquivo só da pasta de quem envia', () => {
    expect(ownFilePath('federacao/ges/x1.pdf', 'ges')).toBe(true);
    expect(ownFilePath('federacao/outro/x1.pdf', 'ges')).toBe(false);
  });

  it('evidência: obrigatório pede texto ou arquivo; o automático só dispensa na arena', () => {
    const base = { evidence: { safeguarding: { text: 'Política' }, insurance: { text: 'Apólice' }, courts: { text: 'Fotos' } } };
    expect(validateSealApply(undefined, 'arena', base, 'g').ok).toBe(true);
    expect(validateSealApply(undefined, 'club', base, 'g').errors).toHaveProperty('coach');
  });

  it('situação: renovação abre 60 dias antes; aviso a 30', () => {
    expect(sealState({ status: 'granted', granted_until: '2027-06-01' }, HOJE)).toMatchObject({ valid: true, expiring: false, canApply: false });
    expect(sealState({ status: 'granted', granted_until: '2026-11-10' }, HOJE)).toMatchObject({ valid: true, expiring: true, canApply: true });
    expect(sealState({ status: 'revoked', granted_until: '2027-06-01' }, HOJE).valid).toBe(false);
  });

  it('decisão: a plataforma confere o automático só na arena', () => {
    const marcados = { safeguarding: true, insurance: true, courts: true };
    expect(sealDecision(undefined, 'arena', { licensed_coach: true }, marcados).ok).toBe(true);
    expect(sealDecision(undefined, 'club', { licensed_coach: true }, marcados).missing).toEqual(['coach']);
  });

  it('selo da filiação e quem cuida', () => {
    expect(affiliationSealValid({ seal: { valid_until: '2027-01-01' } }, HOJE)).toBe(true);
    expect(affiliationSealValid({ seal: null }, HOJE)).toBe(false);
    expect(canManageDevelopment(['members'])).toBe(true);
    expect(canManageDevelopment(['finance'])).toBe(false);
  });
});
