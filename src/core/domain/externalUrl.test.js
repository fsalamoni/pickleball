import { describe, it, expect } from 'vitest';
import { safeHttpUrl, isSafeHttpUrl } from './externalUrl.js';

describe('safeHttpUrl', () => {
  it('aceita apenas http(s) absolutos', () => {
    expect(safeHttpUrl('https://picklerush.web.app/a')).toBe('https://picklerush.web.app/a');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com');
    expect(safeHttpUrl('/interno')).toBe('');
    expect(safeHttpUrl('javascript:alert(1)')).toBe('');
    expect(safeHttpUrl('ftp://example.com')).toBe('');
  });

  it('rejeita credenciais, espaços e controles', () => {
    expect(safeHttpUrl('******example.com')).toBe('');
    expect(safeHttpUrl('https://example.com/a b')).toBe('');
    expect(safeHttpUrl('https://example.com/\n')).toBe('https://example.com/');
    expect(safeHttpUrl('https://exa\u0000mple.com')).toBe('');
  });

  it('pode exigir host com ponto para links públicos de parceiros', () => {
    expect(isSafeHttpUrl('https://localhost:5173', { requireHostWithDot: true })).toBe(false);
    expect(isSafeHttpUrl('https://loja.com.br', { requireHostWithDot: true })).toBe(true);
  });

  it('rejeita URLs longas em vez de truncar destino', () => {
    expect(safeHttpUrl(`https://example.com/${'a'.repeat(20)}`, { maxLength: 10 })).toBe('');
  });
});

