import { describe, it, expect, vi, beforeEach } from 'vitest';

const leituras = vi.hoisted(() => ({ fila: [] }));

vi.mock('@/core/config/firebase', () => ({ app: {}, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (...partes) => partes.slice(1).join('/'),
  getDoc: vi.fn(async () => {
    const chave = leituras.fila.length ? leituras.fila.shift() : '';
    return { exists: () => chave !== null, data: () => ({ push: { vapid_public_key: chave } }) };
  }),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: () => 'agora',
}));

const PUBLICA = `B${'x'.repeat(86)}`;

describe('pushService', () => {
  beforeEach(async () => {
    leituras.fila = [];
    const m = await import('./pushService');
    m.forgetVapidKey();
  });

  it('⭐ o "não tem chave" não fica guardado: a chave salva depois aparece sem recarregar', async () => {
    const { getVapidKey, isPushConfigured } = await import('./pushService');
    leituras.fila = ['', PUBLICA];
    expect(await isPushConfigured()).toBe(false);
    expect(await getVapidKey()).toBe(PUBLICA);
  });

  it('a chave achada fica guardada; esquecer lê de novo (o admin trocou)', async () => {
    const { getVapidKey, forgetVapidKey } = await import('./pushService');
    const NOVA = `B${'y'.repeat(86)}`;
    leituras.fila = [PUBLICA, NOVA];
    expect(await getVapidKey()).toBe(PUBLICA);
    expect(await getVapidKey()).toBe(PUBLICA);
    forgetVapidKey();
    expect(await getVapidKey()).toBe(NOVA);
  });

  it('chave que não é a pública (ex.: a privada) vale como sem chave', async () => {
    const { getVapidKey } = await import('./pushService');
    leituras.fila = ['k'.repeat(43)];
    expect(await getVapidKey()).toBe('');
  });

  it('traduz a falha do navegador/FCM num motivo explicável', async () => {
    const { pushFailureReason } = await import('./pushService');
    expect(pushFailureReason({ name: 'InvalidAccessError' })).toBe('bad_key');
    expect(pushFailureReason({ code: 'messaging/token-subscribe-failed' })).toBe('fcm_rejected');
    expect(pushFailureReason({ code: 'messaging/failed-service-worker-registration' })).toBe('sw_failed');
    expect(pushFailureReason({ name: 'AbortError', message: 'Registration failed - push service error' })).toBe('push_service');
    expect(pushFailureReason({ code: 'messaging/permission-blocked' })).toBe('denied');
    expect(pushFailureReason(new Error('qualquer'))).toBe('error');
  });

  it('o id do documento do aparelho é estável por conta e token', async () => {
    const { tokenDocId } = await import('./pushService');
    expect(tokenDocId('u1', 'abc')).toBe(tokenDocId('u1', 'abc'));
    expect(tokenDocId('u1', 'abc')).not.toBe(tokenDocId('u1', 'abd'));
    expect(tokenDocId('u1', 'abc').startsWith('u1_')).toBe(true);
  });
});
