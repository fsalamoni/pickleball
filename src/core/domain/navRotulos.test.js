import { describe, it, expect } from 'vitest';
import { NAV_ROTULOS, navRotulos } from './navRotulos';

describe('navRotulos', () => {
  it('devolve o vocabulário do plano (§5.1), sem flag', () => {
    expect(navRotulos()).toBe(NAV_ROTULOS);
    expect(NAV_ROTULOS).toMatchObject({ abaDiaDeJogo: 'Hoje', vagas: 'Vagas', pessoas: 'Pessoas' });
  });
  it('os nomes antigos não voltam', () => {
    expect(Object.values(NAV_ROTULOS)).not.toContain('Procura-se jogo');
    expect(Object.values(NAV_ROTULOS)).not.toContain('Encontrar jogadores');
  });
});
