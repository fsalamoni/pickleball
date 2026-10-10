import { describe, it, expect } from 'vitest';
import { ROTULOS_ANTIGOS, ROTULOS_V3, navRotulos } from './navRotulos';

describe('navRotulos', () => {
  it('flag desligada devolve os rótulos de sempre', () => {
    expect(navRotulos(false)).toBe(ROTULOS_ANTIGOS);
    expect(navRotulos(undefined).vagas).toBe('Procura-se jogo');
  });
  it('flag ligada devolve o vocabulário do plano (§5.1)', () => {
    expect(navRotulos(true)).toBe(ROTULOS_V3);
    expect(ROTULOS_V3).toMatchObject({ abaDiaDeJogo: 'Hoje', vagas: 'Vagas', pessoas: 'Pessoas' });
  });
  it('os dois conjuntos têm as mesmas chaves', () => {
    expect(Object.keys(ROTULOS_V3).sort()).toEqual(Object.keys(ROTULOS_ANTIGOS).sort());
  });
});
