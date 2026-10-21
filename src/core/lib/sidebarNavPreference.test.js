import { describe, it, expect } from 'vitest';
import { parseSidebar } from './sidebarNavPreference';

describe('parseSidebar', () => {
  it('lê `known` quando existe; escolha antiga (sem ele) devolve null', () => {
    expect(parseSidebar('{"v":1,"preset":"atleta","items":["inicio","jogar","perfil"],"known":["inicio","jogar"]}'))
      .toEqual({ preset: 'atleta', items: ['inicio', 'jogar', 'perfil'], known: ['inicio', 'jogar'] });
    expect(parseSidebar('{"v":1,"preset":"atleta","items":["inicio","perfil"]}').known).toBeNull();
  });
  it('texto ilegível ou sem itens = nunca escolheu', () => {
    expect(parseSidebar('')).toBeNull();
    expect(parseSidebar('{x')).toBeNull();
    expect(parseSidebar('{"preset":"atleta"}')).toBeNull();
  });
});
