/**
 * Vínculo da conta DUPR contra o Firestore falso e um cliente DUPR de mentira:
 * a identidade vem do DUPR (nunca do navegador), `BASIC_L1` é obrigatório, um
 * ID DUPR só vale numa conta, o rating chega pelo webhook com o token da URL
 * e desvincular tira o selo sem apagar o dado comum do perfil.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dupr = require('./dupr.js');
const { DuprError } = require('./duprClient.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const ANA = { uid: 'ana', name: 'Ana' };
const CREDS = { client_key: 'KEY', client_secret: 'SEGREDO', env: 'uat', webhook_token: 'tok-secreto-123' };

function clienteFalso(extra = {}) {
  return {
    ssoUrl: () => 'https://uat.dupr.gg/login-external-app/S0VZ',
    basicUserInfo: vi.fn(async () => ({ results: [{ duprId: 'abc123', fullName: 'Ana Souza' }] })),
    subscriptions: vi.fn(async () => ({ entitlements: { tournaments: ['BASIC_L1', 'PREMIUM_L1'] } })),
    getUser: vi.fn(async () => ({ result: { fullName: 'Ana Souza', ratings: { singles: '3.250', doubles: '3.875' } } })),
    subscribeRating: vi.fn(async () => ({})),
    unsubscribeRating: vi.fn(async () => ({})),
    refreshUserToken: vi.fn(async () => ({ result: { accessToken: 'A2', refreshToken: 'R2' } })),
    ...extra,
  };
}

function cenario({ flag = true, audience = 'all', secrets = CREDS, seed = {}, client = clienteFalso(), now = NOW } = {}) {
  const db = createFakeDb({
    'platform_settings/global': { feature_flags: { dupr_official_sync: flag } },
    ...(audience ? { 'platform_settings/dupr_policy': { audience } } : {}),
    ...(secrets ? { 'platform_secrets/dupr': secrets } : {}),
    'users/ana': { full_name: 'Ana Souza' },
    'athlete_profiles/ana': { platform_name: 'Ana' },
    'users/bia': { full_name: 'Bia' },
    ...seed,
  });
  const ctx = { db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { warn() {}, error() {} }, makeClient: () => client };
  return { ctx, db, client };
}
const dados = (db, path) => db.store.docs.get(path);
const SSO = { accessToken: 'ACC', refreshToken: 'REF' };
const erro = (p) => p.then(() => null, (e) => e);

describe('dupr — config', () => {
  it('desligada: não entrega a URL do login', async () => {
    const { ctx } = cenario({ flag: false });
    expect(await dupr.config(ctx, ANA)).toMatchObject({ enabled: false, configured: false, linked: null });
    expect((await dupr.config(ctx, ANA)).ssoUrl).toBeUndefined();
  });

  it('ligada e configurada: entrega a URL (só o clientKey em base64) e o ambiente', async () => {
    const { ctx } = cenario();
    const c = await dupr.config(ctx, ANA);
    expect(c).toMatchObject({ enabled: true, configured: true, env: 'uat', ssoUrl: 'https://uat.dupr.gg/login-external-app/S0VZ' });
    expect(JSON.stringify(c)).not.toContain('SEGREDO');
  });

  it('piloto (padrão, sem política gravada): só o admin da plataforma usa', async () => {
    const { ctx } = cenario({ audience: null });
    expect((await dupr.config(ctx, ANA)).enabled).toBe(false);
    expect((await dupr.config(ctx, { ...ANA, isPlatformAdmin: true })).enabled).toBe(true);
    expect((await erro(dupr.link(ctx, ANA, SSO))).code).toBe('failed-precondition');
  });
});

describe('dupr — vincular', () => {
  it('flag desligada: recusa', async () => {
    const e = await erro(dupr.link(cenario({ flag: false }).ctx, ANA, SSO));
    expect(e.code).toBe('failed-precondition');
  });

  it('sem credencial configurada: recusa dizendo o motivo', async () => {
    const e = await erro(dupr.link(cenario({ secrets: null }).ctx, ANA, SSO));
    expect(e.code).toBe('failed-precondition');
    expect(e.message).toMatch(/não foi configurada/);
  });

  it('sem os tokens do login: recusa', async () => {
    const e = await erro(dupr.link(cenario().ctx, ANA, {}));
    expect(e.code).toBe('invalid-argument');
  });

  it('vincula pela identidade do DUPR, guarda tokens à parte, espelha o perfil e inscreve no rating', async () => {
    const { ctx, db, client } = cenario();
    const r = await dupr.link(ctx, ANA, SSO);
    expect(r).toMatchObject({ duprId: 'ABC123', ratings: { singles: 3.25, doubles: 3.875 }, webhookOk: true });
    expect(client.basicUserInfo).toHaveBeenCalledWith('ACC');
    expect(client.subscribeRating).toHaveBeenCalledWith(['ABC123']);
    expect(dados(db, 'dupr_ids/ABC123')).toMatchObject({ user_id: 'ana' });
    expect(dados(db, 'dupr_link_tokens/ana')).toMatchObject({ access_token: 'ACC', refresh_token: 'REF' });
    // O resumo que o dono lê NÃO carrega token.
    expect(JSON.stringify(dados(db, 'dupr_links/ana'))).not.toMatch(/ACC|REF/);
    expect(dados(db, 'users/ana')).toMatchObject({ dupr_id: 'ABC123', dupr_rating: 3.875, dupr_rating_singles: 3.25, dupr_verified: true });
    expect(dados(db, 'athlete_profiles/ana')).toMatchObject({ dupr_id: 'ABC123', dupr_verified: true });
    expect(dados(db, 'athlete_profiles/ana').platform_name).toBe('Ana');
    expect([...db.store.docs.keys()].some((k) => k.startsWith('audit_logs/'))).toBe(true);
  });

  it('ignora (e recusa) um duprId diferente do que o DUPR confirmou', async () => {
    const { ctx, db } = cenario();
    const e = await erro(dupr.link(ctx, ANA, { ...SSO, duprId: 'OUTRO99' }));
    expect(e.code).toBe('permission-denied');
    expect(dados(db, 'dupr_links/ana')).toBeUndefined();
  });

  it('sem BASIC_L1 a conta está restrita: nada é gravado', async () => {
    const client = clienteFalso({ subscriptions: vi.fn(async () => ({ entitlements: { tournaments: [] } })) });
    const { ctx, db } = cenario({ client });
    const e = await erro(dupr.link(ctx, ANA, SSO));
    expect(e.code).toBe('permission-denied');
    expect(e.message).toMatch(/restrita/);
    expect(dados(db, 'dupr_links/ana')).toBeUndefined();
    expect(dados(db, 'users/ana').dupr_verified).toBeUndefined();
  });

  it('um ID DUPR só vale numa conta', async () => {
    const { ctx, db } = cenario({ seed: { 'dupr_ids/ABC123': { user_id: 'bia' } } });
    const e = await erro(dupr.link(ctx, ANA, SSO));
    expect(e.code).toBe('already-exists');
    expect(dados(db, 'dupr_ids/ABC123').user_id).toBe('bia');
    expect(dados(db, 'dupr_links/ana')).toBeUndefined();
  });

  it('o DUPR recusando o token vira mensagem para a tela, sem corpo nem segredo', async () => {
    const client = clienteFalso({ basicUserInfo: vi.fn(async () => { throw new DuprError('DUPR recusou (401): x', { status: 401, body: { segredo: 'SEGREDO' } }); }) });
    const e = await erro(dupr.link(cenario({ client }).ctx, ANA, SSO));
    expect(e.code).toBe('permission-denied');
    expect(e.message).not.toMatch(/SEGREDO|401/);
  });

  it('se a inscrição no webhook falha, o vínculo fica e a tela é avisada', async () => {
    const client = clienteFalso({ subscribeRating: vi.fn(async () => { throw new DuprError('x', { status: 500 }); }) });
    const { ctx, db } = cenario({ client });
    const r = await dupr.link(ctx, ANA, SSO);
    expect(r.webhookOk).toBe(false);
    expect(dados(db, 'dupr_links/ana').webhook_ok).toBe(false);
  });

  it('trocar de conta DUPR solta o ID antigo e cancela a inscrição dele', async () => {
    const { ctx, db, client } = cenario({ seed: { 'dupr_ids/VELHO1': { user_id: 'ana' }, 'dupr_links/ana': { user_id: 'ana', dupr_id: 'VELHO1', linked_at_ms: 1 } } });
    await dupr.link(ctx, ANA, SSO);
    expect(dados(db, 'dupr_ids/VELHO1')).toBeUndefined();
    expect(client.unsubscribeRating).toHaveBeenCalledWith(['VELHO1']);
    expect(dados(db, 'dupr_links/ana').dupr_id).toBe('ABC123');
  });
});

describe('dupr — desvincular', () => {
  it('tira o vínculo, os tokens e o selo; o ID e o rating ficam como informação comum', async () => {
    const { ctx, db, client } = cenario();
    await dupr.link(ctx, ANA, SSO);
    expect(await dupr.unlink(ctx, ANA)).toEqual({ unlinked: true });
    expect(client.unsubscribeRating).toHaveBeenCalledWith(['ABC123']);
    ['dupr_links/ana', 'dupr_link_tokens/ana', 'dupr_ids/ABC123'].forEach((p) => expect(dados(db, p)).toBeUndefined());
    const u = dados(db, 'users/ana');
    expect(u.dupr_verified).toBeUndefined();
    expect(u).toMatchObject({ dupr_id: 'ABC123', dupr_rating: 3.875 });
  });

  it('sem vínculo, não faz nada', async () => {
    expect(await dupr.unlink(cenario().ctx, ANA)).toEqual({ unlinked: false });
  });
});

describe('dupr — webhook de rating', () => {
  const evento = (extra = {}) => ({ clientId: 'KEY', event: 'RATING', message: { duprId: 'ABC123', name: 'Ana', timestamp: 1, rating: { singles: '3.400', doubles: '4.010' }, ...extra } });
  const post = (body, k = CREDS.webhook_token) => ({ method: 'POST', query: { k }, body });

  async function vinculado() {
    const c = cenario();
    await dupr.link(c.ctx, ANA, SSO);
    return c;
  }

  it('sem o token da URL, 401 e nada muda', async () => {
    const { ctx, db } = await vinculado();
    expect((await dupr.webhook(ctx, post(evento(), 'errado'))).status).toBe(401);
    expect((await dupr.webhook(ctx, { method: 'POST', query: {}, body: evento() })).status).toBe(401);
    expect(dados(db, 'dupr_links/ana').ratings.doubles).toBe(3.875);
  });

  it('GET (teste de alcance) responde 200 sem exigir nada', async () => {
    expect((await dupr.webhook(cenario().ctx, { method: 'GET', query: {} })).status).toBe(200);
  });

  it('RATING atualiza o vínculo e o perfil', async () => {
    const { ctx, db } = await vinculado();
    const r = await dupr.webhook({ ...ctx, now: NOW + 1000 }, post(evento()));
    expect(r.status).toBe(200);
    expect(dados(db, 'dupr_links/ana')).toMatchObject({ ratings: { singles: 3.4, doubles: 4.01 }, rating_updated_ms: NOW + 1000 });
    expect(dados(db, 'users/ana')).toMatchObject({ dupr_rating: 4.01, dupr_rating_singles: 3.4, dupr_verified: true });
    expect(dados(db, 'athlete_profiles/ana').dupr_rating).toBe(4.01);
  });

  it('RATING_SEED sem rating (nunca jogou) não apaga o que já existe', async () => {
    const { ctx, db } = await vinculado();
    const r = await dupr.webhook(ctx, post({ ...evento(), event: 'RATING_SEED', message: { duprId: 'ABC123', rating: null, metrics: null } }));
    expect(r.status).toBe(200);
    expect(dados(db, 'dupr_links/ana').ratings.doubles).toBe(3.875);
  });

  it('"NR" (sem rating) vira vazio, não zero nem texto', async () => {
    const { ctx, db } = await vinculado();
    await dupr.webhook(ctx, post(evento({ rating: { singles: 'NR', doubles: '3.100' } })));
    expect(dados(db, 'dupr_links/ana').ratings).toEqual({ singles: null, doubles: 3.1 });
    expect(dados(db, 'users/ana').dupr_rating_singles).toBe(3.25);
  });

  it('jogador que não é nosso, ou evento desconhecido: 200 e ignora', async () => {
    const { ctx, db } = await vinculado();
    expect((await dupr.webhook(ctx, post(evento({ duprId: 'ZZZ999' })))).body.ignored).toBe(true);
    expect((await dupr.webhook(ctx, post({ ...evento(), event: 'OUTRO' }))).body.ignored).toBe(true);
    expect(dados(db, 'dupr_links/ana').ratings.doubles).toBe(3.875);
  });
});

describe('dupr — status e assinaturas (cache de 24 h)', () => {
  it('dentro de 24 h não vai ao DUPR', async () => {
    const { ctx, client } = cenario();
    await dupr.link(ctx, ANA, SSO);
    client.subscriptions.mockClear();
    const r = await dupr.status({ ...ctx, now: NOW + 3600 * 1000 }, ANA);
    expect(r.linked.entitlements).toEqual(['BASIC_L1', 'PREMIUM_L1']);
    expect(client.subscriptions).not.toHaveBeenCalled();
  });

  it('passadas 24 h, busca de novo', async () => {
    const { ctx, client, db } = cenario();
    await dupr.link(ctx, ANA, SSO);
    client.subscriptions.mockResolvedValueOnce({ entitlements: { tournaments: ['BASIC_L1'] } });
    const r = await dupr.status({ ...ctx, now: NOW + 25 * 3600 * 1000 }, ANA);
    expect(r.linked.entitlements).toEqual(['BASIC_L1']);
    expect(dados(db, 'dupr_links/ana').entitlements_checked_ms).toBe(NOW + 25 * 3600 * 1000);
  });

  it('token do usuário vencido: renova com o refresh (que gira) e tenta de novo', async () => {
    const { ctx, client, db } = cenario();
    await dupr.link(ctx, ANA, SSO);
    client.subscriptions
      .mockRejectedValueOnce(new DuprError('x', { status: 401 }))
      .mockResolvedValueOnce({ entitlements: { tournaments: ['BASIC_L1', 'VERIFIED_L1'] } });
    const r = await dupr.status({ ...ctx, now: NOW + 25 * 3600 * 1000 }, ANA);
    expect(client.refreshUserToken).toHaveBeenCalledWith('REF');
    expect(dados(db, 'dupr_link_tokens/ana')).toMatchObject({ access_token: 'A2', refresh_token: 'R2' });
    expect(r.linked.entitlements).toEqual(['BASIC_L1', 'VERIFIED_L1']);
  });

  it('falha ao atualizar: vale o último valor, sem derrubar', async () => {
    const { ctx, client } = cenario();
    await dupr.link(ctx, ANA, SSO);
    client.subscriptions.mockRejectedValueOnce(new DuprError('x', { status: 500 }));
    const r = await dupr.status({ ...ctx, now: NOW + 25 * 3600 * 1000 }, ANA);
    expect(r.linked.entitlements).toEqual(['BASIC_L1', 'PREMIUM_L1']);
  });
});

describe('dupr — leitura de dados do DUPR', () => {
  it('rating: número válido, ou nada', () => {
    expect(dupr.parseRating('4.125')).toBe(4.125);
    expect(dupr.parseRating('3,5')).toBe(3.5);
    ['NR', '', null, undefined, '0', '99', 'abc'].forEach((v) => expect(dupr.parseRating(v)).toBeNull());
  });
});
