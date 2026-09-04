import { describe, it, expect } from 'vitest';
import {
  SELECT_ALL_STATE,
  toSelection,
  toggleId,
  addIds,
  removeIds,
  selectAllState,
  countVisibleSelected,
  countHiddenSelected,
  resolveSelectedEntries,
  pruneSelection,
} from './duprSelection.js';

describe('toSelection', () => {
  it('aceita Set, array e nulo — sempre devolvendo um Set novo', () => {
    const origem = new Set(['a']);
    const copia = toSelection(origem);
    expect(copia).toEqual(new Set(['a']));
    expect(copia).not.toBe(origem);
    expect(toSelection(['a', 'b'])).toEqual(new Set(['a', 'b']));
    expect(toSelection(null)).toEqual(new Set());
  });

  it('descarta ids vazios', () => {
    expect(toSelection(['a', '', null, undefined])).toEqual(new Set(['a']));
  });
});

describe('toggleId', () => {
  it('marca e desmarca sem alterar a seleção original', () => {
    const s0 = new Set();
    const s1 = toggleId(s0, 'a');
    expect(s0.size).toBe(0);
    expect(s1.has('a')).toBe(true);
    expect(toggleId(s1, 'a').has('a')).toBe(false);
  });

  it('ignora id vazio', () => {
    expect(toggleId(new Set(['a']), '')).toEqual(new Set(['a']));
  });
});

describe('addIds / removeIds', () => {
  it('acrescenta sem apagar o que já estava marcado (inclusive fora da vista)', () => {
    const atual = new Set(['oculta']);
    expect(addIds(atual, ['a', 'b'])).toEqual(new Set(['oculta', 'a', 'b']));
  });

  it('remove só os ids pedidos — os demais continuam marcados', () => {
    const atual = new Set(['oculta', 'a', 'b']);
    expect(removeIds(atual, ['a', 'b'])).toEqual(new Set(['oculta']));
  });
});

describe('selectAllState', () => {
  it('reflete nenhum / alguns / todos os VISÍVEIS', () => {
    expect(selectAllState(new Set(), ['a', 'b'])).toBe(SELECT_ALL_STATE.NONE);
    expect(selectAllState(new Set(['a']), ['a', 'b'])).toBe(SELECT_ALL_STATE.SOME);
    expect(selectAllState(new Set(['a', 'b']), ['a', 'b'])).toBe(SELECT_ALL_STATE.ALL);
  });

  it('ids selecionados fora da vista não deixam o check "cheio"', () => {
    expect(selectAllState(new Set(['a', 'oculta']), ['a'])).toBe(SELECT_ALL_STATE.ALL);
    expect(selectAllState(new Set(['oculta']), ['a'])).toBe(SELECT_ALL_STATE.NONE);
  });

  it('lista vazia não fica marcada', () => {
    expect(selectAllState(new Set(['a']), [])).toBe(SELECT_ALL_STATE.NONE);
  });
});

describe('contagens visíveis / ocultas', () => {
  it('separa o que está no recorte do que ficou fora dele', () => {
    const selecionadas = new Set(['a', 'b', 'oculta']);
    expect(countVisibleSelected(selecionadas, ['a', 'b', 'c'])).toBe(2);
    expect(countHiddenSelected(selecionadas, ['a', 'b', 'c'])).toBe(1);
  });

  it('sem recorte visível, tudo é considerado oculto', () => {
    expect(countHiddenSelected(new Set(['a', 'b']), [])).toBe(2);
  });
});

describe('resolveSelectedEntries', () => {
  const base = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('devolve as entries na ordem da base de referência', () => {
    expect(resolveSelectedEntries(new Set(['c', 'a']), base).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('descarta ids sem entry correspondente', () => {
    expect(resolveSelectedEntries(new Set(['a', 'fantasma']), base).map((e) => e.id)).toEqual(['a']);
  });

  it('seleção vazia não resolve nada', () => {
    expect(resolveSelectedEntries(new Set(), base)).toEqual([]);
  });
});

describe('pruneSelection', () => {
  it('tira só os ids que sumiram da plataforma', () => {
    expect(pruneSelection(new Set(['a', 'sumiu']), ['a', 'b'])).toEqual(new Set(['a']));
  });

  it('aceita Set como base conhecida', () => {
    expect(pruneSelection(new Set(['a']), new Set(['a']))).toEqual(new Set(['a']));
  });
});
