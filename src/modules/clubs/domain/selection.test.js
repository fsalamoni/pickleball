import { describe, it, expect } from 'vitest';
import { callupCounts, callupGate, inviteOpen, publicName, slotsLeft, validateCallup } from './selection';

describe('seleção do clube (domínio do cliente)', () => {
  it('a convocação pede nome, evento e começo; o fim não vem antes', () => {
    expect(validateCallup({}).ok).toBe(false);
    const ok = validateCallup({ title: 'Seleção Sul', event_name: 'Interclubes', starts_at: '2027-05-01', accept_days: 99 });
    expect(ok.ok).toBe(true);
    expect(ok.value.accept_days).toBe(30);
    expect(validateCallup({ title: 'Seleção Sul', event_name: 'Interclubes', starts_at: '2027-05-02', ends_at: '2027-05-01' }).errors.ends_at).toBeTruthy();
  });

  it('conta confirmados por papel e as vagas que sobram', () => {
    const lista = [{ status: 'accepted', role: 'athlete' }, { status: 'invited', role: 'athlete' }, { status: 'accepted', role: 'staff' }, { status: 'declined', role: 'athlete' }];
    expect(callupCounts(lista)).toMatchObject({ accepted: 2, invited: 1, declined: 1, athletes: 1, staff: 1 });
    expect(slotsLeft({ slots: 3 }, lista)).toBe(1);
    expect(slotsLeft({ slots: 0 }, lista)).toBeNull();
    expect(callupCounts(undefined).accepted).toBe(0);
  });

  it('o menor aparece na lista pública só com o primeiro nome e a inicial', () => {
    expect(publicName('Bia Costa Alves', true)).toBe('Bia A.');
    expect(publicName('Bia Costa Alves', false)).toBe('Bia Costa Alves');
    expect(publicName('Teo', true)).toBe('Teo');
    expect(publicName('', true)).toBe('Atleta');
  });

  it('a trava: menor sem responsável autorizando e comissão sem proteção em dia não entram', () => {
    expect(callupGate({ role: 'athlete', minor: true, guardian: null }).reason).toBe('guardian');
    expect(callupGate({ role: 'athlete', minor: true, guardian: { consent: false } }).reason).toBe('consent');
    expect(callupGate({ role: 'athlete', minor: true, guardian: { consent: true } }).ok).toBe(true);
    expect(callupGate({ role: 'staff', minor: false, involvesMinors: true, cleared: false }).reason).toBe('protecao');
    expect(callupGate({ role: 'staff', minor: false, involvesMinors: true, cleared: true }).ok).toBe(true);
    expect(callupGate({ role: 'staff', minor: false, involvesMinors: false, cleared: false }).ok).toBe(true);
    expect(callupGate({ role: 'athlete', minor: false, cleared: false }).ok).toBe(true);
  });

  it('o convite só responde dentro do prazo', () => {
    expect(inviteOpen({ status: 'invited', expires_at_ms: 2000 }, 1000)).toBe(true);
    expect(inviteOpen({ status: 'invited', expires_at_ms: 500 }, 1000)).toBe(false);
    expect(inviteOpen({ status: 'accepted', expires_at_ms: 2000 }, 1000)).toBe(false);
  });
});
