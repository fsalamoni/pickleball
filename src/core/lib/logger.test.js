import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sanitiza Error antes de enviar ao console, sem stack', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('falhou');
    err.code = 'permission-denied';

    logger.error('ctx', err);

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][2];
    expect(payload).toEqual({ message: 'falhou', code: 'permission-denied' });
    expect(payload).not.toHaveProperty('stack');
  });

  it('redacta payloads sensíveis em warn/error', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('ctx', { email: 'a@b.com', uid: 'u1' });
    expect(spy.mock.calls[0][2]).toEqual({ email: '[REDACTED]', uid: 'u1' });
  });
});

