import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDuprClient, hostsFor, DuprError } = require('./duprClient');

const resp = (json, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => (k === 'x-request-id' ? 'rid-1' : null) },
  json: async () => json,
});

const tokenOk = (token = 'T1') => resp({ status: 'SUCCESS', result: { token, expiry: 'x' } });

function cliente(fetchImpl, extra = {}) {
  return createDuprClient({ clientKey: 'KEY', clientSecret: 'SEGREDO', env: 'uat', fetchImpl, ...extra });
}

describe('duprClient', () => {
  it('sem credencial não cria o cliente', () => {
    expect(() => createDuprClient({ clientKey: '', clientSecret: '' })).toThrow(DuprError);
  });

  it('o ambiente é UAT a menos que esteja escrito prod', () => {
    expect(hostsFor('prod').partner).toContain('prod.mydupr.com');
    expect(hostsFor('PROD').user).toBe('https://api.dupr.gg');
    expect(hostsFor(undefined).partner).toContain('uat.mydupr.com');
    expect(hostsFor('qualquer coisa').partner).toContain('uat.mydupr.com');
  });

  it('o token sai de base64(key:secret) no x-authorization e fica em cache', async () => {
    const f = vi.fn(async () => tokenOk());
    const c = cliente(f);
    await c.partnerToken();
    await c.partnerToken();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://uat.mydupr.com/api/auth/v1.0/token');
    expect(init.method).toBe('POST');
    expect(init.headers['x-authorization']).toBe(Buffer.from('KEY:SEGREDO').toString('base64'));
  });

  it('renova o token depois do prazo', async () => {
    let t = 0;
    const f = vi.fn(async () => tokenOk());
    const c = cliente(f, { now: () => t });
    await c.partnerToken();
    t = 51 * 60 * 1000;
    await c.partnerToken();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('chamada de parceiro leva Bearer; num 401 renova uma vez e repete', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(tokenOk('A'))
      .mockResolvedValueOnce(resp({ message: 'expirou' }, { status: 401 }))
      .mockResolvedValueOnce(tokenOk('B'))
      .mockResolvedValueOnce(resp({ status: 'SUCCESS', result: { id: 'X1' } }));
    const r = await cliente(f).getUser('X 1');
    expect(r.result.id).toBe('X1');
    expect(f.mock.calls[1][0]).toBe('https://uat.mydupr.com/api/user/v1.0/X%201');
    expect(f.mock.calls[1][1].headers.Authorization).toBe('Bearer A');
    expect(f.mock.calls[3][1].headers.Authorization).toBe('Bearer B');
  });

  it('erro do DUPR traz status e mensagem — e nunca o segredo', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resp({ status: 'FAILURE', message: 'Usuário não conectado' }, { status: 403 }));
    const err = await cliente(f).getUser('ZZZ').catch((e) => e);
    expect(err).toBeInstanceOf(DuprError);
    expect(err.status).toBe(403);
    expect(err.requestId).toBe('rid-1');
    expect(JSON.stringify({ m: err.message, b: err.body })).not.toContain('SEGREDO');
  });

  it('o token do usuário vai ao host api.dupr.gg e o refresh usa x-refresh-token', async () => {
    const f = vi.fn(async () => resp({ status: 'SUCCESS', results: [{ duprId: 'D1' }] }));
    const c = cliente(f);
    await c.basicUserInfo('UT');
    await c.refreshUserToken('RT');
    expect(f.mock.calls[0][0]).toBe('https://api.uat.dupr.gg/public/user/info');
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer UT');
    expect(f.mock.calls[1][0]).toBe('https://api.uat.dupr.gg/auth/v1.0/refresh');
    expect(f.mock.calls[1][1].headers['x-refresh-token']).toBe('RT');
  });

  it('a URL do SSO leva o clientKey em base64 (nunca o segredo)', () => {
    const url = cliente(vi.fn()).ssoUrl();
    expect(url).toBe(`https://uat.dupr.gg/login-external-app/${Buffer.from('KEY').toString('base64')}`);
    expect(url).not.toContain('SEGREDO');
  });

  it('rede caindo vira DuprError legível', async () => {
    const f = vi.fn(async () => { throw new Error('ECONNRESET'); });
    await expect(cliente(f).partnerToken()).rejects.toThrow(/Sem resposta do DUPR/);
  });
});
