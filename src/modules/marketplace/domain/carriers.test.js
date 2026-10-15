import { describe, it, expect } from 'vitest';
import { CARRIERS, detectCarrier, findCarrier, trackingLink } from './carriers.js';

describe('transportadoras', () => {
  it('detecta os Correios pelo padrão do código', () => {
    expect(detectCarrier('AB123456789BR').id).toBe('correios');
    expect(detectCarrier('ab 123456789 br').id).toBe('correios');
    expect(detectCarrier('123456')).toBeNull();
    expect(detectCarrier('')).toBeNull();
  });
  it('monta o link sem espaços e sem transportadora quando não há padrão', () => {
    expect(trackingLink({ carrier: 'Correios', code: 'AB 123456789 BR' })).toBe('https://rastreamento.correios.com.br/app/index.php?objetos=AB123456789BR');
    expect(trackingLink({ carrier: 'jadlog', code: '123' })).toBe('https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=123');
    expect(trackingLink({ carrier: 'Loggi', code: 'XYZ' })).toBe('https://www.loggi.com/rastreador/XYZ');
    expect(trackingLink({ carrier: 'Braspress', code: '1' })).toBeNull();
    expect(trackingLink({ carrier: 'Minha van', code: '1' })).toBeNull();
    expect(trackingLink({ carrier: 'Correios', code: '' })).toBeNull();
    expect(trackingLink({})).toBeNull();
  });
  it('sem transportadora gravada, cai na detecção pelo código', () => {
    expect(trackingLink({ code: 'QB987654321BR' })).toMatch(/correios/);
  });
  it('acha pelo id ou pelo rótulo; "Outra" existe e não tem link', () => {
    expect(findCarrier('correios').label).toBe('Correios');
    expect(findCarrier('Total Express').id).toBe('total_express');
    expect(findCarrier('')).toBeNull();
    expect(CARRIERS.at(-1).id).toBe('other');
    expect(CARRIERS.at(-1).trackUrl('x')).toBeNull();
  });
});
