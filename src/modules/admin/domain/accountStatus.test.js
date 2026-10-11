import { describe, it, expect } from 'vitest';
import {
  accountStatusOf, accountStatusActions, validateStatusRequest, expiredSuspensions, isAccountOffline,
} from './accountStatus.js';

describe('accountStatusOf', () => {
  it('campo ausente é ativa', () => {
    expect(accountStatusOf({})).toMatchObject({ status: 'active', vencida: false, label: 'Ativa' });
  });
  it('suspensa com prazo passado fica vencida — e continua suspensa (nada reativa sozinho)', () => {
    const u = { account_status: 'suspended', status_until: 100 };
    expect(accountStatusOf(u, 200)).toMatchObject({ status: 'suspended', vencida: true });
    expect(accountStatusOf(u, 50).vencida).toBe(false);
    expect(isAccountOffline(u)).toBe(true);
    expect(expiredSuspensions([u, {}], 200)).toEqual([u]);
  });
});

describe('accountStatusActions', () => {
  const ctx = { actorUid: 'eu', ownerEmails: ['dono@x.com'] };
  it('ativa: suspender ou bloquear; suspensa: reativar ou bloquear; bloqueada: reativar ou suspender', () => {
    expect(accountStatusActions({ uid: 'u' }, ctx).actions).toEqual(['suspend', 'block']);
    expect(accountStatusActions({ uid: 'u', account_status: 'suspended' }, ctx).actions).toEqual(['reactivate', 'block']);
    expect(accountStatusActions({ uid: 'u', account_status: 'blocked' }, ctx).actions).toEqual(['reactivate', 'suspend']);
  });
  it('⭐ as três portas: a própria conta, admin e dono não têm ação', () => {
    expect(accountStatusActions({ uid: 'eu' }, ctx).actions).toEqual([]);
    expect(accountStatusActions({ uid: 'a', role: 'platform_admin' }, ctx).actions).toEqual([]);
    expect(accountStatusActions({ uid: 'd', email: 'dono@x.com' }, ctx).reason).toMatch(/dono/);
  });
});

describe('validateStatusRequest', () => {
  it('motivo e, na suspensão, o prazo', () => {
    expect(validateStatusRequest({ action: 'block', reason: 'spam' }).errors.reason).toBeTruthy();
    expect(validateStatusRequest({ action: 'suspend', reason: 'spam repetido' }).errors.days).toBeTruthy();
    expect(validateStatusRequest({ action: 'suspend', reason: 'spam repetido', days: 7 }).isValid).toBe(true);
    expect(validateStatusRequest({ action: 'reactivate', reason: 'resolvido' }).isValid).toBe(true);
  });
});
