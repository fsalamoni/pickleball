import { describe, it, expect } from 'vitest';
import {
  SG_FOREVER, backgroundDefaultUntil, backgroundState, clearance, expiresSoon, normalizeSgRules, openMinorReports,
  pendingBackgrounds, sgRequired, sortOverview, trainingUntil, validateBackgroundSubmit, validateSgRules,
} from './safeguarding';

const HOJE = '2026-10-22';

describe('proteção de menores: régua', () => {
  it('sem nada gravado: professor, árbitro, diretor e embaixador; certidão de 12 meses', () => {
    expect(normalizeSgRules(undefined)).toEqual({ required_for: ['coach', 'referee', 'director', 'ambassador'], background_months: 12 });
  });

  it('lista vazia gravada é escolha (ninguém), papel desconhecido sai', () => {
    expect(normalizeSgRules({ required_for: [] }).required_for).toEqual([]);
    expect(normalizeSgRules({ required_for: ['staff', 'xx', 'coach'] }).required_for).toEqual(['coach', 'staff']);
  });

  it('validade fora de 1–60 meses é erro', () => {
    expect(validateSgRules({ background_months: 0 }).ok).toBe(false);
    expect(validateSgRules({ background_months: 61 }).ok).toBe(false);
    expect(validateSgRules({ background_months: 24 }).ok).toBe(true);
  });

  it('só exige com o módulo ligado', () => {
    expect(sgRequired({ modules: { safeguarding: true } }, 'coach')).toBe(true);
    expect(sgRequired({ modules: { safeguarding: true } }, 'staff')).toBe(false);
    expect(sgRequired({ modules: {} }, 'coach')).toBe(false);
  });
});

describe('proteção de menores: curso, certidão e liberação', () => {
  it('o curso é a credencial de proteção válida DESTA federação; sem validade é para sempre', () => {
    const creds = [
      { kind: 'safeguarding', federation_id: 'fgp', valid_until: '2026-12-01' },
      { kind: 'safeguarding', federation_id: 'fgp', valid_until: '2027-03-01' },
      { kind: 'safeguarding', federation_id: 'fgp', status: 'revoked' },
      { kind: 'safeguarding', federation_id: 'outra' },
      { kind: 'coach', federation_id: 'fgp' },
    ];
    expect(trainingUntil(creds, 'fgp', HOJE)).toBe('2027-03-01');
    expect(trainingUntil(creds, 'outra', HOJE)).toBe(SG_FOREVER);
    expect(trainingUntil(creds, 'nada', HOJE)).toBe('');
  });

  it('certidão conferida vencida pela data deixa de valer', () => {
    expect(backgroundState({ background: { status: 'valid', valid_until: '2026-10-01' } }, HOJE)).toEqual({ status: 'expired', valid: false, until: '' });
    expect(backgroundState({ background: { status: 'pending' } }, HOJE).valid).toBe(false);
    expect(backgroundState(null, HOJE).status).toBe('');
  });

  it('liberado só com os DOIS em dia, até o menor vencimento', () => {
    const record = { background: { status: 'valid', valid_until: '2027-02-01' } };
    expect(clearance({ training: '2027-05-01', record, hoje: HOJE })).toMatchObject({ ok: true, until: '2027-02-01' });
    expect(clearance({ training: SG_FOREVER, record, hoje: HOJE }).until).toBe('2027-02-01');
    expect(clearance({ training: '', record, hoje: HOJE }).ok).toBe(false);
    expect(clearance({ training: '2027-05-01', record: null, hoje: HOJE })).toMatchObject({ ok: false, until: '' });
  });

  it('a certidão enviada: data válida, não futura e ainda dentro da validade', () => {
    expect(validateBackgroundSubmit({ issued_at: '', hoje: HOJE }).ok).toBe(false);
    expect(validateBackgroundSubmit({ issued_at: '2026-10-23', hoje: HOJE }).ok).toBe(false);
    expect(validateBackgroundSubmit({ issued_at: '2025-10-01', hoje: HOJE }).ok).toBe(false);
    expect(validateBackgroundSubmit({ issued_at: '2025-10-01', hoje: HOJE, rules: { background_months: 24 } }).ok).toBe(true);
    expect(validateBackgroundSubmit({ issued_at: '2026-09-01', hoje: HOJE }).ok).toBe(true);
    expect(backgroundDefaultUntil('2026-09-01', undefined)).toBe('2027-09-01');
  });

  it('vence em breve: até 30 dias, nunca o "para sempre"', () => {
    expect(expiresSoon('2026-11-21', HOJE)).toBe(true);
    expect(expiresSoon('2026-11-22', HOJE)).toBe(false);
    expect(expiresSoon('2026-10-21', HOJE)).toBe(false);
    expect(expiresSoon(SG_FOREVER, HOJE)).toBe(false);
  });
});

describe('proteção de menores: Central', () => {
  it('certidão para conferir primeiro, depois quem precisa e não está em dia, depois vencendo', () => {
    const rows = [
      { name: 'D', required: true, ok: true, until: '2027-06-01' },
      { name: 'C', required: true, ok: true, until: '2026-11-01' },
      { name: 'B', required: true, ok: false },
      { name: 'A', pending: { issued_at: '2026-10-01' } },
    ];
    expect(sortOverview(rows, HOJE).map((r) => r.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('pendências: fonte que falhou é indefinida, nunca zero', () => {
    expect(pendingBackgrounds([{ pending: {} }, { pending_background: {} }, {}])).toBe(2);
    expect(pendingBackgrounds(undefined)).toBeUndefined();
    expect(openMinorReports([{ kind: 'minor_protection', status: 'open' }, { kind: 'minor_protection', status: 'closed' }, { kind: 'conduct', status: 'open' }])).toBe(1);
    expect(openMinorReports(undefined)).toBeUndefined();
  });
});
