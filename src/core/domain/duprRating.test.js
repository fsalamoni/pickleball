import { describe, it, expect } from 'vitest';
import {
  readDuprRating, isValidDuprRating, formatDuprRating, duprRatingToInput, duprIdProblem,
} from './duprRating.js';

const ok = (v) => ({ status: 'ok', value: v, suggestion: null, reason: null });

describe('readDuprRating', () => {
  it('vazio é vazio (o campo é opcional)', () => {
    expect(readDuprRating('').status).toBe('empty');
    expect(readDuprRating('   ').status).toBe('empty');
    expect(readDuprRating(null).status).toBe('empty');
  });

  it('vírgula e ponto valem como decimal: "4.525" é 4,525, nunca quatro mil', () => {
    expect(readDuprRating('4,525')).toEqual(ok(4.525));
    expect(readDuprRating('4.525')).toEqual(ok(4.525));
    expect(readDuprRating(' 3,5 ')).toEqual(ok(3.5));
    expect(readDuprRating('4')).toEqual(ok(4));
    expect(readDuprRating('4,')).toEqual(ok(4));
    expect(readDuprRating('4.5250')).toEqual(ok(4.525));
    expect(readDuprRating(4.525)).toEqual(ok(4.525));
    expect(readDuprRating('2')).toEqual(ok(2));
    expect(readDuprRating('8,000')).toEqual(ok(8));
  });

  it('⭐ fora da faixa NUNCA é limitado ao teto: vira palpite com a vírgula depois do 1º número', () => {
    expect(readDuprRating('4525')).toMatchObject({ status: 'suggest', value: null, suggestion: 4.525, reason: 'missingComma' });
    expect(readDuprRating('45')).toMatchObject({ status: 'suggest', suggestion: 4.5 });
    expect(readDuprRating('45250')).toMatchObject({ status: 'suggest', suggestion: 4.525 });
    expect(readDuprRating('4.525.000')).toMatchObject({ status: 'suggest', suggestion: 4.525 });
    expect(readDuprRating('3525,0')).toMatchObject({ status: 'suggest', suggestion: 3.525 });
  });

  it('mais de três casas: sugere o arredondado', () => {
    expect(readDuprRating('4,5256')).toMatchObject({ status: 'suggest', suggestion: 4.526, reason: 'decimals' });
  });

  it('sem palpite possível, diz o motivo', () => {
    expect(readDuprRating('5931502152')).toMatchObject({ status: 'invalid', reason: 'looksLikeId' });
    expect(readDuprRating('DDQ0KL')).toMatchObject({ status: 'invalid', reason: 'letters' });
    expect(readDuprRating('1,5')).toMatchObject({ status: 'invalid', reason: 'below' });
    expect(readDuprRating('0')).toMatchObject({ status: 'invalid', reason: 'below' });
    expect(readDuprRating('8,5')).toMatchObject({ status: 'invalid', reason: 'above' });
    expect(readDuprRating('10')).toMatchObject({ status: 'invalid', reason: 'above' });
    expect(readDuprRating(',5')).toMatchObject({ status: 'invalid', reason: 'format' });
  });
});

describe('isValidDuprRating / formatação', () => {
  it('só 2 a 8, e vazio não é rating', () => {
    expect(isValidDuprRating(2)).toBe(true);
    expect(isValidDuprRating(8)).toBe(true);
    expect(isValidDuprRating('4.5')).toBe(true);
    expect(isValidDuprRating(8.001)).toBe(false);
    expect(isValidDuprRating(4525)).toBe(false);
    expect(isValidDuprRating('')).toBe(false);
    expect(isValidDuprRating(null)).toBe(false);
  });

  it('três casas no separador do idioma (pt-BR: vírgula)', () => {
    expect(formatDuprRating(4.5)).toBe('4,500');
    expect(formatDuprRating(8)).toBe('8,000');
  });

  it('valor de partida do campo: o válido formatado, o antigo fora da regra cru', () => {
    expect(duprRatingToInput(3.5)).toBe('3,500');
    expect(duprRatingToInput(4525)).toBe('4525');
    expect(duprRatingToInput(null)).toBe('');
  });
});

describe('duprIdProblem', () => {
  it('ID numérico e curto são aceitos; rating no campo do ID é apontado', () => {
    expect(duprIdProblem('5931502152')).toBeNull();
    expect(duprIdProblem('DDQ0KL')).toBeNull();
    expect(duprIdProblem('')).toBeNull();
    expect(duprIdProblem('4,525')).toBe('looksLikeRating');
    expect(duprIdProblem('4.5')).toBe('looksLikeRating');
    expect(duprIdProblem('DDQ 0KL')).toBe('format');
    expect(duprIdProblem('59.315.021')).toBe('format');
  });
});
