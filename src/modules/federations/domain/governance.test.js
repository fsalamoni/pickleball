import { describe, it, expect } from 'vitest';
import { hasGovernance, sortMinutes, validateGovernance, womenQuota, womenQuotaText, BOARD_MAX, MINUTES_MAX } from './governance.js';

describe('validateGovernance', () => {
  it('aceita o conjunto completo e normaliza', () => {
    const r = validateGovernance({
      statute_url: 'https://x/estatuto.pdf', bylaws: ' Regimento ', mandate: { start: '2026-01-01', end: '2027-12-31' },
      board: [{ role: 'Presidente', name: 'Ana' }], minutes: [{ title: 'Assembleia 2026', date: '2026-03-10', url: 'https://x/ata.pdf' }],
    });
    expect(r.ok).toBe(true);
    expect(r.value.bylaws).toBe('Regimento');
    expect(r.value.board).toEqual([{ role: 'Presidente', name: 'Ana' }]);
  });
  it('recusa mandato invertido, link http, membro sem cargo e ata sem título', () => {
    const r = validateGovernance({ statute_url: 'http://x', mandate: { start: '2027-01-01', end: '2026-01-01' }, board: [{ name: 'Ana' }], minutes: [{ title: 'A' }] });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['board.0', 'mandate.end', 'minutes.0.title', 'statute_url']);
  });
  it('remuneração do dirigente: opcional, zero vale (não remunerado), negativo recusa', () => {
    const r = validateGovernance({ board: [{ role: 'Presidente', name: 'Ana', pay_cents: 0, pay_note: ' pro bono ' }, { role: 'Tesoureiro', name: 'Bia', pay_cents: 350000 }, { role: 'Vice', name: 'Caio', pay_cents: '' }] });
    expect(r.value.board).toEqual([{ role: 'Presidente', name: 'Ana', pay_cents: 0, pay_note: 'pro bono' }, { role: 'Tesoureiro', name: 'Bia', pay_cents: 350000 }, { role: 'Vice', name: 'Caio' }]);
    expect(validateGovernance({ board: [{ role: 'P', name: 'A', pay_cents: -1 }] }).errors['board.0.pay']).toBeTruthy();
  });
});

describe('hasGovernance / sortMinutes', () => {
  it('em branco não há o que mostrar', () => {
    expect(hasGovernance(null)).toBe(false);
    expect(hasGovernance({ mandate: {}, board: [], minutes: [] })).toBe(false);
    expect(hasGovernance({ board: [{ role: 'P', name: 'A' }] })).toBe(true);
  });
  it('as atas saem da mais recente para a mais antiga', () => {
    expect(sortMinutes([{ date: '2025-01-01' }, { date: '2026-01-01' }, {}]).map((a) => a.date)).toEqual(['2026-01-01', '2025-01-01', undefined]);
  });
});

describe('tetos ditos, nunca corte calado (revisão geral)', () => {
  it('diretoria acima do teto é erro', () => {
    const board = Array.from({ length: BOARD_MAX + 1 }, (_, i) => ({ name: `Pessoa ${i + 1}`, role: 'Diretor' }));
    expect(validateGovernance({ board }).errors.board).toBeTruthy();
    expect(validateGovernance({ board: board.slice(0, BOARD_MAX) }).errors.board).toBeUndefined();
  });
  it('atas acima do teto é erro', () => {
    const minutes = Array.from({ length: MINUTES_MAX + 1 }, (_, i) => ({ title: `Ata ${i + 1} ordinária`, date: '2026-01-01', url: 'https://x.y/a.pdf' }));
    expect(validateGovernance({ minutes }).errors.minutes).toBeTruthy();
  });
});

describe('cota de mulheres na direção (art. 36, IX — só aviso)', () => {
  const board = (n) => Array.from({ length: n }, (_, i) => ({ role: `Cargo ${i + 1}`, name: `Pessoa ${i + 1}` }));
  it('o número é opcional, inteiro e não passa do tamanho da diretoria', () => {
    expect(validateGovernance({ board: board(5) }).value.women_count).toBeNull();
    expect(validateGovernance({ board: board(5), women_count: '2' }).value.women_count).toBe(2);
    expect(validateGovernance({ board: board(5), women_count: '6' }).errors.women_count).toBeTruthy();
    expect(validateGovernance({ board: board(5), women_count: '1.5' }).errors.women_count).toBeTruthy();
    expect(validateGovernance({ board: board(5), women_count: '-1' }).errors.women_count).toBeTruthy();
  });
  it('30% arredondado para cima, sem erro de ponto flutuante', () => {
    expect(womenQuota({ board: board(10), women_count: 3 })).toMatchObject({ status: 'ok', min: 3 });
    expect(womenQuota({ board: board(10), women_count: 2 })).toMatchObject({ status: 'below', min: 3 });
    expect(womenQuota({ board: board(7), women_count: 2 })).toMatchObject({ status: 'below', min: 3 });
    expect(womenQuota({ board: board(4) })).toMatchObject({ status: 'unknown', min: 2 });
    expect(womenQuota({})).toMatchObject({ status: 'empty' });
    expect(womenQuotaText(womenQuota({}))).toBe('');
    expect(womenQuotaText(womenQuota({ board: board(10), women_count: 2 }))).toContain('2 de 10');
  });
});
