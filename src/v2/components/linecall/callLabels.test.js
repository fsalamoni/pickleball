/**
 * O rótulo do "revisar" diz ONDE olhar. O pé no saque e o quique longo
 * decidem pela mesma linha de fundo, mas são lances diferentes: o "revisar"
 * do pé tem de dizer que é o pé (7.A), senão parece um quique na linha (8.B).
 */
import { describe, it, expect } from 'vitest';
import { callLabel } from './callLabels.js';

describe('callLabel: o "revisar" diz onde olhar', () => {
  it('⭐ o pé no saque não se confunde com o quique na linha de fundo', () => {
    expect(callLabel({ type: 'serve_foot', call: 'review', reason: 'baseline' })).toBe('Revisar: pé na linha de fundo');
    expect(callLabel({ kind: 'bounce', call: 'review', reason: 'long' })).toBe('Revisar: linha de fundo');
  });

  it('nos prolongamentos da lateral e da central também é o pé', () => {
    expect(callLabel({ kind: 'serve_foot', call: 'review', reason: 'sideline' })).toBe('Revisar: pé na extensão da lateral');
    expect(callLabel({ kind: 'serve_foot', call: 'review', reason: 'centerline' })).toBe('Revisar: pé na extensão da central');
    expect(callLabel({ kind: 'serve_foot', call: 'review', reason: 'airborne' })).toBe('Revisar: pé no ar');
  });
});
