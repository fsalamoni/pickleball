import { describe, it, expect } from 'vitest';
import {
  activeFilterCount, libraryFiltersToParams, libraryPool, readLibraryFilters, toFilterItems,
} from './libraryFilters';

const p = (s) => new URLSearchParams(s);

describe('filtros da biblioteca na URL', () => {
  it('lê os válidos e descarta o resto', () => {
    const f = readLibraryFilters(p('q=dink&tipo=drill&habilidade=kitchen.dink_cruzado&nivel=meu&jogadores=4&local=quadra&tempo=20&origem=salvos'));
    expect(f).toEqual({
      q: 'dink', tipo: 'drill', habilidade: 'kitchen.dink_cruzado', nivel: true,
      jogadores: 4, local: 'quadra', tempo: 20, origem: 'salvos',
    });
    const ruim = readLibraryFilters(p('tipo=xx&habilidade=nada&jogadores=99&local=lua&tempo=7&origem=hack'));
    expect(activeFilterCount(ruim)).toBe(0);
  });

  it('ida e volta pela URL', () => {
    const f = readLibraryFilters(p('tipo=fisico&nivel=meu'));
    const extras = libraryFiltersToParams(f);
    expect(extras.tipo).toBe('fisico');
    expect(extras.nivel).toBe('meu');
    expect(extras.q).toBe('');
  });

  it('origem escolhe a fonte; salvos usa os favoritos', () => {
    const pub = [{ id: 'a' }, { id: 'b' }];
    const coach = [{ id: 'b' }, { id: 'cc_1' }];
    expect(libraryPool({ origem: '' }, { pub, coach }).map((i) => i.id)).toEqual(['a', 'b', 'cc_1']);
    expect(libraryPool({ origem: 'meus_professores' }, { pub, coach }).map((i) => i.id)).toEqual(['b', 'cc_1']);
    expect(libraryPool({ origem: 'salvos' }, { pub, coach, favorites: ['cc_1'] }).map((i) => i.id)).toEqual(['cc_1']);
  });

  it('"do meu nível" sem nível conhecido não filtra', () => {
    const f = readLibraryFilters(p('nivel=meu&origem=professor'));
    expect(toFilterItems(f, { level: null }).level).toBeNull();
    expect(toFilterItems(f, { level: 3.5 }).level).toBe(3.5);
    expect(toFilterItems(f).origin).toBe('professor');
    expect(toFilterItems(readLibraryFilters(p('origem=salvos'))).origin).toBe('');
  });
});
