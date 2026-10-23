import { describe, it, expect } from 'vitest';
import {
  normalizeRefereeRules, refereeCredentialUntil, credentialStanding, credentialBlocker, promotionProgress, monthsBetween, REFEREE_FUNCTIONS,
} from './referees';

const POL = (p) => ({ credential_policy: p });

describe('vencimento da credencial de árbitro', () => {
  it('sem configuração: não exige, 30 dias de aviso, sem carência, só avisa', () => {
    expect(normalizeRefereeRules().credential_policy).toEqual({ required: false, grace_days: 0, warn_days: 30, on_expire: 'warn' });
    expect(normalizeRefereeRules(POL({ required: true, grace_days: 999, warn_days: -3, on_expire: 'xx' })).credential_policy).toEqual({ required: true, grace_days: 180, warn_days: 0, on_expire: 'warn' });
  });

  it('vale a melhor credencial de árbitro ativa da federação; sem validade vale para sempre', () => {
    const cs = [
      { kind: 'referee', federation_id: 'f', status: 'active', valid_until: '2026-05-01' },
      { kind: 'referee', federation_id: 'f', status: 'active', valid_until: '2027-01-10' },
      { kind: 'referee', federation_id: 'g', status: 'active', valid_until: '2030-01-01' },
      { kind: 'clinic', federation_id: 'f', status: 'active', valid_until: '2031-01-01' },
      { kind: 'referee', federation_id: 'f', status: 'revoked', valid_until: '2032-01-01' },
    ];
    expect(refereeCredentialUntil(cs, 'f')).toBe('2027-01-10');
    expect(refereeCredentialUntil([...cs, { kind: 'referee', federation_id: 'f', valid_until: '' }], 'f')).toBe('');
    expect(refereeCredentialUntil([], 'f')).toBeNull();
  });

  it('em dia, vencendo, na carência e vencida; só a regra que exige bloqueia', () => {
    const r = POL({ required: true, grace_days: 10, warn_days: 15, on_expire: 'block_new' });
    expect(credentialStanding('2026-12-31', r, '2026-10-01').state).toBe('ok');
    expect(credentialStanding('2026-10-10', r, '2026-10-01')).toMatchObject({ state: 'expiring', days_left: 9, blocks: false });
    expect(credentialStanding('2026-10-01', r, '2026-10-05')).toMatchObject({ state: 'grace', grace_until: '2026-10-11', blocks: false });
    const vencida = credentialStanding('2026-10-01', r, '2026-10-12');
    expect(vencida).toMatchObject({ state: 'lapsed', blocks: true, releases: false });
    expect(credentialBlocker(vencida)).toMatch(/venceu/);
    expect(credentialStanding('2026-10-01', POL({ ...r.credential_policy, on_expire: 'block_and_release' }), '2026-10-12')).toMatchObject({ blocks: true, releases: true });
    expect(credentialStanding('2026-10-01', POL({ ...r.credential_policy, required: false }), '2026-10-12')).toMatchObject({ state: 'lapsed', blocks: false });
    expect(credentialStanding(null, r, '2026-10-12')).toMatchObject({ state: 'none', blocks: true });
    expect(credentialStanding(null, POL({ required: true, on_expire: 'warn' }), '2026-10-12').blocks).toBe(false);
    expect(credentialStanding('', r, '2026-10-12').state).toBe('ok');
    expect(credentialBlocker(credentialStanding('', r))).toBe('');
  });
});

describe('progressão de nível', () => {
  it('a função de avaliador existe e os requisitos ficam só nos níveis acima do primeiro', () => {
    expect(REFEREE_FUNCTIONS).toContain('evaluator');
    const r = normalizeRefereeRules({ promotion: { trainee: { events: 3 }, l1: { events: '5', avg: 4.25, months: 6 }, l2: {}, zz: { events: 1 } } });
    expect(r.promotion).toEqual({ l1: { events: 5, avg: 4.3, months: 6 } });
  });

  it('meses inteiros completos', () => {
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(0);
    expect(monthsBetween('2026-01-15', '2026-07-15')).toBe(6);
    expect(monthsBetween('2026-07-15', '2026-01-15')).toBe(0);
  });

  it('conta só as atuações no nível atual, com a média das avaliações', () => {
    const rules = { promotion: { l1: { events: 2, avg: 4, months: 3 } } };
    const ref = { user_id: 'ana', federation_id: 'f', level: 'trainee', since: '2025-01-01', level_since: '2026-01-10' };
    const nota = (n) => ({ scores: { rules: n, positioning: n, communication: n, punctuality: n, presentation: n } });
    const escalas = [
      { status: 'done', referee_uid: 'ana', federation_id: 'f', event: { date: '2025-12-01' }, evaluation: nota(1) },
      { status: 'done', referee_uid: 'ana', federation_id: 'f', event: { date: '2026-02-01' }, evaluation: nota(5) },
      { status: 'done', referee_uid: 'ana', federation_id: 'f', event: { date: '2026-03-01' }, evaluation: nota(4) },
      { status: 'no_show', referee_uid: 'ana', federation_id: 'f', event: { date: '2026-03-02' } },
      { status: 'done', referee_uid: 'bia', federation_id: 'f', event: { date: '2026-03-03' } },
    ];
    const p = promotionProgress(ref, escalas, rules, '2026-05-01');
    expect(p.next).toEqual({ id: 'l1', label: 'Nível 1' });
    expect(p.have).toEqual({ events: 2, avg: 4.5, months: 3 });
    expect(p.met).toBe(true);
    expect(promotionProgress(ref, escalas, rules, '2026-04-01').met).toBe(false);
    expect(promotionProgress({ ...ref, level: 'l1' }, escalas, rules, '2026-05-01')).toMatchObject({ next: { id: 'l2' }, checks: [], met: null });
    expect(promotionProgress({ ...ref, level: 'certified' }, escalas, rules).next).toBeNull();
  });
});
