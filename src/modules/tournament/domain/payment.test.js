import { describe, expect, it } from 'vitest';
import { buildPixPayload, crc16, formatBrlCents, tournamentHasPixConfig } from './payment.js';

describe('crc16 (CCITT-FALSE)', () => {
  it('bate com o vetor de verificação padrão "123456789" → 29B1', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('retorna sempre 4 dígitos hexadecimais maiúsculos', () => {
    expect(crc16('')).toMatch(/^[0-9A-F]{4}$/);
    expect(crc16('pix')).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe('buildPixPayload', () => {
  const base = {
    key: 'organizador@exemplo.com',
    merchantName: 'Copa Pickle',
    merchantCity: 'Sao Paulo',
  };

  it('retorna null sem chave', () => {
    expect(buildPixPayload({})).toBeNull();
    expect(buildPixPayload({ key: '  ' })).toBeNull();
  });

  it('começa com o indicador de formato e contém o GUI do PIX e a chave', () => {
    const payload = buildPixPayload(base);
    expect(payload.startsWith('000201')).toBe(true);
    expect(payload).toContain('br.gov.bcb.pix');
    expect(payload).toContain('organizador@exemplo.com');
  });

  it('inclui moeda BRL (986), país BR, nome e cidade', () => {
    const payload = buildPixPayload(base);
    expect(payload).toContain('5303986');
    expect(payload).toContain('5802BR');
    expect(payload).toContain('Copa Pickle');
    expect(payload).toContain('Sao Paulo');
  });

  it('inclui o valor quando amountCents > 0 e omite quando ausente', () => {
    const withAmount = buildPixPayload({ ...base, amountCents: 12345 });
    expect(withAmount).toContain('5406123.45');
    const withoutAmount = buildPixPayload(base);
    expect(withoutAmount).not.toMatch(/54\d{2}\d+\.\d{2}/);
  });

  it('termina com o campo 63 (CRC) consistente com o restante do payload', () => {
    const payload = buildPixPayload({ ...base, amountCents: 5000 });
    const body = payload.slice(0, -4);
    const crc = payload.slice(-4);
    expect(body.endsWith('6304')).toBe(true);
    expect(crc).toBe(crc16(body));
  });

  it('remove acentos e limita nome (25) e cidade (15)', () => {
    const payload = buildPixPayload({
      key: 'x',
      merchantName: 'Associação de Pickleball de São Paulo',
      merchantCity: 'São José dos Campos',
    });
    expect(payload).not.toMatch(/[çãéíõ]/i);
    expect(payload).toContain('Associacao de Pickleball');
    expect(payload).toContain('Sao Jose dos Ca');
    expect(payload).not.toContain('Sao Jose dos Campos');
  });

  it('usa *** como txid padrão', () => {
    expect(buildPixPayload(base)).toContain('62070503***');
  });
});

describe('formatBrlCents', () => {
  it('formata centavos em pt-BR', () => {
    expect(formatBrlCents(12345)).toContain('123,45');
    expect(formatBrlCents(0)).toContain('0,00');
  });
});

describe('tournamentHasPixConfig', () => {
  it('reconhece chave configurada', () => {
    expect(tournamentHasPixConfig({ payment_pix_key: 'abc' })).toBe(true);
    expect(tournamentHasPixConfig({ payment_pix_key: '  ' })).toBe(false);
    expect(tournamentHasPixConfig({})).toBe(false);
    expect(tournamentHasPixConfig(null)).toBe(false);
  });
});
