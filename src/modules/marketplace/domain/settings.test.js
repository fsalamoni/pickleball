import { describe, it, expect } from 'vitest';
import {
  normalizeMarketSettings, DEFAULT_MARKET_SETTINGS, findBannedTerm, findContactLeak, validateQuestion, validateAnswer,
} from './settings.js';

describe('configuração do Mercado', () => {
  it('sem documento vale o padrão; valor fora da faixa é contido', () => {
    expect(normalizeMarketSettings(null)).toEqual(DEFAULT_MARKET_SETTINGS);
    const s = normalizeMarketSettings({ payment_hours: 9999, offers_enabled: false, max_active_listings: { athlete: 0 }, banned_terms: [' x ', ''] });
    expect(s.payment_hours).toBe(168);
    expect(s.offers_enabled).toBe(false);
    expect(s.max_active_listings.athlete).toBe(1);
    expect(s.banned_terms).toEqual(['x']);
  });
  it('termo proibido por palavra inteira, sem acento', () => {
    expect(findBannedTerm('Raquete RÉPLICA perfeita')).toBe('replica');
    expect(findBannedTerm('raquete replicante')).toBeNull();
    expect(findBannedTerm('vendo cigarro', ['cigarro'])).toBe('cigarro');
  });
  it('pergunta pública não leva contato', () => {
    expect(findContactLeak('me chama no 11 98888-7777')).toBe('telefone');
    expect(findContactLeak('ana@x.com')).toBe('e-mail');
    expect(validateQuestion('Ainda tem? me chama wa.me/5511').error).toMatch(/pública/);
    expect(validateQuestion('Qual o peso da raquete?').value).toBeTruthy();
    expect(validateQuestion('oi').error).toBeTruthy();
    expect(validateAnswer('Pesa 225 g.').value).toBe('Pesa 225 g.');
  });
});
