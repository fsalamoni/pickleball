/**
 * Suspender/bloquear/reativar — as regras puras e a ordem das escritas, sobre
 * um Firestore e um Auth falsos.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateStatusRequest, applyAccountStatus, statusForAction } = require('../functions/accountStatus.js');

function fakeDb(users = {}) {
  const writes = [];
  const adds = [];
  return {
    writes, adds,
    collection: (col) => ({
      doc: (id) => ({
        get: async () => ({ exists: Boolean(users[id]), data: () => users[id], ref: { set: async (d) => writes.push({ id, d }) } }),
      }),
      add: async (d) => adds.push({ col, d }),
    }),
  };
}
const fakeAuth = () => {
  const calls = [];
  return { calls, updateUser: async (uid, p) => calls.push(['update', uid, p]), revokeRefreshTokens: async (uid) => calls.push(['revoke', uid]) };
};
const actor = { uid: 'admin', email: 'admin@x.com' };

describe('validateStatusRequest', () => {
  it('exige conta, ação conhecida e motivo', () => {
    expect(validateStatusRequest({}).error).toMatch(/conta/);
    expect(validateStatusRequest({ uid: 'u', action: 'nuke', reason: 'motivo ok' }).error).toMatch(/Ação/);
    expect(validateStatusRequest({ uid: 'u', action: 'block', reason: 'a' }).error).toMatch(/motivo/);
  });
  it('suspensão exige dias entre 1 e 365', () => {
    expect(validateStatusRequest({ uid: 'u', action: 'suspend', reason: 'motivo ok' }).error).toMatch(/dias/);
    expect(validateStatusRequest({ uid: 'u', action: 'suspend', reason: 'motivo ok', days: 400 }).error).toMatch(/dias/);
    expect(validateStatusRequest({ uid: 'u', action: 'suspend', reason: 'motivo ok', days: 7 }).days).toBe(7);
  });
  it('mapa ação → status', () => {
    expect(statusForAction('suspend')).toBe('suspended');
    expect(statusForAction('block')).toBe('blocked');
    expect(statusForAction('reactivate')).toBe('active');
  });
});

describe('applyAccountStatus', () => {
  it('⭐ suspender desliga o login, revoga tokens, grava o status com prazo e audita', async () => {
    const db = fakeDb({ u1: { email: 'a@b.com', platform_name: 'Ana' } });
    const auth = fakeAuth();
    const res = await applyAccountStatus({ db, auth }, { uid: 'u1', action: 'suspend', reason: 'spam no chat', days: 7 }, { actor, now: 1000 });
    expect(res.status).toBe('ok');
    expect(auth.calls).toEqual([['update', 'u1', { disabled: true }], ['revoke', 'u1']]);
    expect(db.writes[0].d).toMatchObject({ account_status: 'suspended', status_reason: 'spam no chat', status_until: 1000 + 7 * 86_400_000, status_set_by: 'admin' });
    expect(db.adds[0].d).toMatchObject({ action: 'admin_account_suspended', user_id: 'u1', actor_id: 'admin' });
  });
  it('reativar religa o login e limpa motivo e prazo', async () => {
    const db = fakeDb({ u1: { email: 'a@b.com', account_status: 'blocked' } });
    const auth = fakeAuth();
    await applyAccountStatus({ db, auth }, { uid: 'u1', action: 'reactivate', reason: 'resolvido' }, { actor });
    expect(auth.calls).toEqual([['update', 'u1', { disabled: false }]]);
    expect(db.writes[0].d).toMatchObject({ account_status: 'active', status_reason: null, status_until: null });
  });
  it('⭐ as três portas da exclusão valem aqui: a própria conta, admin, dono', async () => {
    const db = fakeDb({ admin: {}, a2: { role: 'platform_admin' }, d: { email: 'fsalamoni@gmail.com' } });
    for (const uid of ['admin', 'a2', 'd']) {
      // eslint-disable-next-line no-await-in-loop
      const r = await applyAccountStatus({ db, auth: fakeAuth() }, { uid, action: 'block', reason: 'motivo ok' }, { actor });
      expect(r.status).toBe('error');
    }
    expect(db.writes).toHaveLength(0);
  });
  it('conta sem login (auth/user-not-found) ainda grava o status', async () => {
    const db = fakeDb({ u1: {} });
    const auth = { updateUser: async () => { const e = new Error('x'); e.code = 'auth/user-not-found'; throw e; } };
    const r = await applyAccountStatus({ db, auth }, { uid: 'u1', action: 'block', reason: 'motivo ok' }, { actor });
    expect(r).toMatchObject({ status: 'ok', authApplied: false });
    expect(db.writes).toHaveLength(1);
  });
});
