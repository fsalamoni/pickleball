import { describe, it, expect } from 'vitest';
import {
  LEVEL_BRACKETS, LEGACY_LEVEL_BRACKETS, bracketRange, isOfficialBracket, levelBracketOptions, levelBracketText, levelVsBracket,
} from './levelBrackets.js';

describe('lista oficial de faixas de nível', () => {
  it('é a da Carreira, na ordem do seletor (valores gravados)', () => {
    expect(LEVEL_BRACKETS).toEqual([
      '2.000-2.999', '3.000-3.499', '3.500-3.999', '3.000-3.999', '4.000-4.499', '4.500+',
      'beginner', 'intermediate', 'advanced', 'pro', 'open', 'other',
    ]);
  });

  it('as numéricas têm intervalo; as descritivas, não', () => {
    expect(bracketRange('3.500-3.999')).toEqual({ min: 3.5, max: 3.999 });
    expect(bracketRange('4.500+')).toEqual({ min: 4.5, max: null });
    for (const b of ['beginner', 'intermediate', 'advanced', 'pro', 'open', 'other']) expect(bracketRange(b)).toBeNull();
  });

  it('o texto: oficial, antigo da Carreira como gravado, antigo do torneio com o nome de antes', () => {
    expect(levelBracketText('4.500+')).toBe('Superior a 4,500');
    expect(levelBracketText('other', 'B+')).toBe('B+');
    expect(levelBracketText('4.0')).toBe('4.0');
    expect(levelBracketText('intermediate_plus')).toBe('Intermediário Plus (3.5–4.0)');
    expect(levelBracketText('')).toBe('');
  });

  it('o seletor mostra a lista e mantém o valor antigo gravado', () => {
    expect(levelBracketOptions().map((o) => o.value)).toEqual(LEVEL_BRACKETS);
    expect(levelBracketOptions('elite').at(-1)).toEqual({ value: 'elite', label: 'Elite (Profissional)' });
    expect(levelBracketOptions('open').length).toBe(LEVEL_BRACKETS.length);
    expect(levelBracketOptions(null, { withOther: false }).map((o) => o.value)).not.toContain('other');
    for (const b of LEGACY_LEVEL_BRACKETS) expect(isOfficialBracket(b)).toBe(false);
  });

  it('nível × faixa: fora, dentro, e "não dá para dizer"', () => {
    expect(levelVsBracket(3.2, '3.500-3.999')).toBe('below');
    expect(levelVsBracket(3.999, '3.500-3.999')).toBe('inside');
    expect(levelVsBracket(4.01, '3.500-3.999')).toBe('above');
    expect(levelVsBracket(7.5, '4.500+')).toBe('inside');
    expect(levelVsBracket(null, '3.500-3.999')).toBeNull();
    expect(levelVsBracket(3.2, 'open')).toBeNull();
  });
});
