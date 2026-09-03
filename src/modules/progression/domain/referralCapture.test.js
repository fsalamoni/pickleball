import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  capturePendingReferral,
  readPendingReferral,
  clearPendingReferral,
  REFERRAL_CAPTURE_TTL_MS,
} from './referralCapture.js';

const VALIDO = 'AB2CD3EF';

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('capturePendingReferral', () => {
  it('guarda um código válido e devolve normalizado', () => {
    expect(capturePendingReferral('ab2cd3ef')).toBe(VALIDO);
    expect(readPendingReferral()).toBe(VALIDO);
  });

  it('recusa código com formato inválido', () => {
    expect(capturePendingReferral('abc')).toBeNull();
    expect(capturePendingReferral('')).toBeNull();
    expect(capturePendingReferral(null)).toBeNull();
    expect(readPendingReferral()).toBeNull();
  });

  it('não explode se o localStorage estiver bloqueado', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    // o link ainda abre: só a indicação se perde
    expect(capturePendingReferral(VALIDO)).toBe(VALIDO);
  });
});

describe('readPendingReferral', () => {
  it('devolve null quando não há nada guardado', () => {
    expect(readPendingReferral()).toBeNull();
  });

  it('descarta convite expirado', () => {
    const agora = Date.now();
    capturePendingReferral(VALIDO, agora);
    expect(readPendingReferral(agora + REFERRAL_CAPTURE_TTL_MS - 1000)).toBe(VALIDO);
    expect(readPendingReferral(agora + REFERRAL_CAPTURE_TTL_MS + 1000)).toBeNull();
  });

  it('limpa o registro expirado em vez de deixar lixo', () => {
    const agora = Date.now();
    capturePendingReferral(VALIDO, agora);
    readPendingReferral(agora + REFERRAL_CAPTURE_TTL_MS + 1);
    expect(window.localStorage.getItem('picklerush.referral.pending')).toBeNull();
  });

  it('ignora conteúdo corrompido sem quebrar', () => {
    window.localStorage.setItem('picklerush.referral.pending', 'isso não é json');
    expect(readPendingReferral()).toBeNull();
  });

  it('ignora registro sem carimbo de tempo', () => {
    window.localStorage.setItem('picklerush.referral.pending', JSON.stringify({ code: VALIDO }));
    expect(readPendingReferral()).toBeNull();
  });
});

describe('clearPendingReferral', () => {
  it('remove o código guardado', () => {
    capturePendingReferral(VALIDO);
    clearPendingReferral();
    expect(readPendingReferral()).toBeNull();
  });

  it('é seguro chamar sem nada guardado', () => {
    expect(() => clearPendingReferral()).not.toThrow();
  });
});
