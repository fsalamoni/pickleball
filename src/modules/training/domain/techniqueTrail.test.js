import { describe, it, expect } from 'vitest';
import {
  TRAIL_FAMILIES, buildTechniqueTrail, relatedDrills, trailFamilyOf, trailPosition,
} from './techniqueTrail.js';

const seed = (slug, over = {}) => ({ id: `pickle_${slug}`, seed_slug: slug, kind: 'fundamento', title: slug, ...over });

describe('TRAIL_FAMILIES', () => {
  it('slug aparece numa família só, em kebab-case', () => {
    const todos = TRAIL_FAMILIES.flatMap((f) => f.slugs);
    expect(new Set(todos).size).toBe(todos.length);
    for (const s of todos) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('trailFamilyOf', () => {
  it('da plataforma: pela lista, qualquer tipo (o Erne é jogada)', () => {
    expect(trailFamilyOf(seed('dink'))).toBe('cozinha');
    expect(trailFamilyOf(seed('erne', { kind: 'jogada' }))).toBe('avancados');
  });

  it('de outro autor: só fundamento, pela habilidade principal', () => {
    expect(trailFamilyOf({ kind: 'fundamento', skills: ['serve.efeito'] })).toBe('saque');
    expect(trailFamilyOf({ kind: 'fundamento', skills: ['net.meio_voleio'] })).toBe('transicao');
    expect(trailFamilyOf({ kind: 'fundamento', skills: ['mental.foco', 'kitchen'] })).toBe('cozinha');
    expect(trailFamilyOf({ kind: 'fundamento', skills: ['mental.foco'] })).toBeNull();
    expect(trailFamilyOf({ kind: 'drill', skills: ['net.voleio'] })).toBeNull();
    expect(trailFamilyOf({ kind: 'fundamento', legacy: true, skills: ['net.voleio'] })).toBeNull();
  });
});

describe('buildTechniqueTrail', () => {
  const items = [
    seed('voleio'), seed('dink-de-backhand'), seed('dink'),
    { id: 'meu', kind: 'fundamento', title: 'A meu dink', skills: ['kitchen.dink_cruzado'] },
    { id: 'drill1', kind: 'drill', skills: ['kitchen.dink_cruzado'] },
  ];

  it('famílias na ordem, itens na ordem da trilha e os de outro autor no fim', () => {
    const t = buildTechniqueTrail(items);
    expect(t.families.map((f) => f.id)).toEqual(['cozinha', 'rede']);
    expect(t.families[0].items.map((x) => x.item.id)).toEqual(['pickle_dink', 'pickle_dink-de-backhand', 'meu']);
  });

  it('conta o domínio e sugere continuar pelo que está "aprendendo"', () => {
    const t = buildTechniqueTrail(items, { pickle_dink: 'dominado', 'pickle_dink-de-backhand': 'aprendendo', pickle_voleio: 'inventado' });
    expect(t.counts).toEqual({ total: 4, dominado: 1, consistente: 0, aprendendo: 1, novo: 2 });
    expect(t.families[0].counts.dominado).toBe(1);
    expect(t.next.id).toBe('pickle_dink-de-backhand');
  });

  it('sem nada aprendendo, o próximo é o primeiro não marcado; tudo marcado, nenhum', () => {
    expect(buildTechniqueTrail(items, { pickle_dink: 'consistente' }).next.id).toBe('pickle_dink-de-backhand');
    const tudo = Object.fromEntries(items.map((i) => [i.id, 'dominado']));
    expect(buildTechniqueTrail(items, tudo).next).toBeNull();
  });

  it('lista vazia não quebra', () => {
    expect(buildTechniqueTrail([])).toEqual({ families: [], counts: { total: 0, dominado: 0, consistente: 0, aprendendo: 0, novo: 0 }, next: null });
  });
});

describe('trailPosition', () => {
  const items = [seed('dink'), seed('dink-de-backhand'), seed('dink-com-efeito')];
  it('posição e vizinhos dentro da família', () => {
    const p = trailPosition(items[1], items);
    expect(p).toMatchObject({ family: { id: 'cozinha' }, index: 2, total: 3 });
    expect(p.prev.id).toBe('pickle_dink');
    expect(p.next.id).toBe('pickle_dink-com-efeito');
    expect(trailPosition(items[0], items).prev).toBeNull();
  });

  it('item que não é da trilha: null; item fora da lista entra na conta', () => {
    expect(trailPosition({ kind: 'drill' }, items)).toBeNull();
    expect(trailPosition(seed('dink-voleio'), items)).toMatchObject({ index: 4, total: 4 });
  });
});

describe('relatedDrills', () => {
  const golpe = { id: 'g', kind: 'fundamento', skills: ['kitchen.dink_cruzado', 'kitchen.paciencia', 'kitchen'], level_min: 3 };
  const drills = [
    { id: 'a', kind: 'drill', title: 'A', skills: ['kitchen.dink_cruzado'], level_min: 5 },
    { id: 'b', kind: 'drill', title: 'B', skills: ['kitchen.dink_cruzado', 'kitchen.paciencia'] },
    { id: 'c', kind: 'drill', title: 'C', skills: ['kitchen.dink_cruzado'], level_min: 3 },
    { id: 'd', kind: 'drill', title: 'D', skills: ['kitchen'] },
    { id: 'e', kind: 'fundamento', title: 'E', skills: ['kitchen.dink_cruzado'] },
    { id: 'f', kind: 'drill', title: 'F', skills: ['kitchen.dink_cruzado'], legacy: true },
    { id: 'h', kind: 'drill', title: 'H', skills: ['kitchen.dink_cruzado'], featured: true, level_min: 6 },
  ];

  it('mais habilidades em comum, depois destaque, depois nível mais perto', () => {
    expect(relatedDrills(golpe, [golpe, ...drills]).map((d) => d.id)).toEqual(['b', 'h', 'c', 'a']);
    expect(relatedDrills(golpe, drills, { limit: 2 })).toHaveLength(2);
  });

  it('só a área não liga nada', () => {
    expect(relatedDrills({ id: 'x', skills: ['kitchen'] }, drills)).toEqual([]);
  });
});
