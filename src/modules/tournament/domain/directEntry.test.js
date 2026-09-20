import { describe, it, expect } from 'vitest';
import {
  DIRECT_ENTRY_MODE, DIRECT_ENTRY_MODE_LABELS, DIRECT_ENTRY_MODE_HELP,
  normalizeDirectEntry, hasDirectEntry, planDirectEntries, describeDirectEntries,
} from './directEntry.js';

const atleta = (id, forca) => ({ id, label: id.toUpperCase(), strength: forca });
const fase = (extra = {}) => ({ name: '', ...extra });

describe('normalizeDirectEntry', () => {
  it('ausente ⇒ ninguém entra direto (campo aditivo)', () => {
    expect(normalizeDirectEntry()).toEqual({ mode: 'none', count: 0, ids: [] });
    expect(normalizeDirectEntry({})).toEqual({ mode: 'none', count: 0, ids: [] });
    expect(hasDirectEntry(undefined)).toBe(false);
  });

  it('modo cabeças guarda a contagem e ignora ids', () => {
    expect(normalizeDirectEntry({ mode: 'seeds', count: '4', ids: ['x'] }))
      .toEqual({ mode: 'seeds', count: 4, ids: [] });
  });

  it('modo manual guarda a lista, sem repetir e sem vazio', () => {
    expect(normalizeDirectEntry({ mode: 'manual', ids: ['a', 'a', '', ' b '] }))
      .toEqual({ mode: 'manual', count: 2, ids: ['a', 'b'] });
  });

  it('modo desconhecido cai em nenhum', () => {
    expect(normalizeDirectEntry({ mode: 'xpto', count: 5 }).mode).toBe('none');
  });

  it('contagem 0 ou lista vazia não conta como configurado', () => {
    expect(hasDirectEntry({ mode: 'seeds', count: 0 })).toBe(false);
    expect(hasDirectEntry({ mode: 'manual', ids: [] })).toBe(false);
  });

  it('todo modo tem rótulo e explicação', () => {
    Object.values(DIRECT_ENTRY_MODE).forEach((m) => {
      expect(DIRECT_ENTRY_MODE_LABELS[m]).toBeTruthy();
      expect(DIRECT_ENTRY_MODE_HELP[m].length).toBeGreaterThan(30);
    });
  });
});

describe('⭐ pular fase: quem entra onde', () => {
  const todos = [
    atleta('a', 6.0), atleta('b', 5.5), atleta('c', 5.0), atleta('d', 4.5),
    atleta('e', 4.0), atleta('f', 3.5), atleta('g', 3.0), atleta('h', 2.5),
  ];

  it('sem configuração, todos começam na 1ª fase', () => {
    const p = planDirectEntries(todos, [fase(), fase()]);
    expect(p.byPhase.get(0)).toHaveLength(8);
    expect(p.byPhase.get(1)).toEqual([]);
    expect(p.warnings).toEqual([]);
  });

  it('⭐ os 4 melhores entram direto na 2ª fase e NÃO jogam a 1ª', () => {
    const p = planDirectEntries(todos, [
      fase(),
      fase({ direct_entry: { mode: 'seeds', count: 4 } }),
    ]);
    expect(p.byPhase.get(1).map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(p.byPhase.get(0).map((e) => e.id)).toEqual(['e', 'f', 'g', 'h']);
  });

  it('⭐ dá para pular DUAS fases (entrar direto na 3ª)', () => {
    const p = planDirectEntries(todos, [
      fase(), fase(),
      fase({ direct_entry: { mode: 'seeds', count: 2 } }),
    ]);
    expect(p.byPhase.get(2).map((e) => e.id)).toEqual(['a', 'b']);
    expect(p.byPhase.get(0)).toHaveLength(6);
    expect(p.byPhase.get(1)).toEqual([]);
    expect(p.phaseOfEntrant.get('a')).toBe(2);
    expect(p.phaseOfEntrant.get('c')).toBe(0);
  });

  it('⭐ lista manual: o campeão entra direto, mesmo sem ser o mais forte', () => {
    const p = planDirectEntries(todos, [
      fase(),
      fase({ direct_entry: { mode: 'manual', ids: ['g'] } }),
    ]);
    expect(p.byPhase.get(1).map((e) => e.id)).toEqual(['g']);
    expect(p.byPhase.get(0).map((e) => e.id)).not.toContain('g');
  });

  it('⭐ declarado em duas fases: vale a MAIS CEDO, com aviso', () => {
    const p = planDirectEntries(todos, [
      fase(),
      fase({ direct_entry: { mode: 'manual', ids: ['a'] } }),
      fase({ direct_entry: { mode: 'manual', ids: ['a'] } }),
    ]);
    expect(p.phaseOfEntrant.get('a')).toBe(1);
    expect(p.byPhase.get(2)).toEqual([]);
    expect(p.warnings.some((w) => /entrada mais cedo/.test(w.text))).toBe(true);
  });

  it('cabeças e manual convivem: quem já foi alocado não é realocado', () => {
    const p = planDirectEntries(todos, [
      fase(),
      fase({ direct_entry: { mode: 'seeds', count: 2 } }),     // a, b
      fase({ direct_entry: { mode: 'seeds', count: 2 } }),     // c, d
    ]);
    expect(p.byPhase.get(1).map((e) => e.id)).toEqual(['a', 'b']);
    expect(p.byPhase.get(2).map((e) => e.id)).toEqual(['c', 'd']);
    expect(p.byPhase.get(0).map((e) => e.id)).toEqual(['e', 'f', 'g', 'h']);
  });

  it('id que não está mais inscrito é ignorado, com aviso', () => {
    const p = planDirectEntries(todos, [
      fase(), fase({ direct_entry: { mode: 'manual', ids: ['desistiu'] } }),
    ]);
    expect(p.byPhase.get(1)).toEqual([]);
    expect(p.warnings.some((w) => /não está mais inscrito/.test(w.text))).toBe(true);
  });

  it('pedir mais cabeças do que existem avisa, mas não quebra', () => {
    const p = planDirectEntries(todos.slice(0, 3), [
      fase(), fase({ direct_entry: { mode: 'seeds', count: 10 } }),
    ]);
    expect(p.byPhase.get(1)).toHaveLength(3);
    expect(p.warnings.some((w) => w.level === 'warn')).toBe(true);
    // ...e sobra ninguém para a 1ª fase, o que é ERRO.
    expect(p.warnings.some((w) => w.level === 'error')).toBe(true);
  });

  it('⭐ esvaziar a 1ª fase é ERRO, não um sorteio impossível em silêncio', () => {
    const p = planDirectEntries(todos, [
      fase(), fase({ direct_entry: { mode: 'seeds', count: 7 } }),
    ]);
    expect(p.byPhase.get(0)).toHaveLength(1);
    expect(p.warnings.some((w) => w.level === 'error')).toBe(true);
  });

  it('entrada direta na 1ª fase é ignorada (todos já entram lá)', () => {
    const p = planDirectEntries(todos, [
      fase({ direct_entry: { mode: 'seeds', count: 3 } }), fase(),
    ]);
    expect(p.byPhase.get(0)).toHaveLength(8);
  });

  it('quem não tem nível vai para o fim da fila dos cabeças', () => {
    const p = planDirectEntries(
      [atleta('x'), atleta('y', 5), atleta('z', 4)],
      [fase(), fase({ direct_entry: { mode: 'seeds', count: 1 } })],
    );
    expect(p.byPhase.get(1).map((e) => e.id)).toEqual(['y']);
  });

  it('lista vazia não quebra', () => {
    const p = planDirectEntries([], [fase(), fase()]);
    expect(p.byPhase.get(0)).toEqual([]);
    expect(p.warnings).toEqual([]);
  });
});

describe('describeDirectEntries', () => {
  it('⭐ explica em texto quantos pulam quantas fases', () => {
    const todos = [atleta('a', 6), atleta('b', 5), atleta('c', 4), atleta('d', 3)];
    const fases = [fase(), fase(), fase({ direct_entry: { mode: 'seeds', count: 2 } })];
    const d = describeDirectEntries(planDirectEntries(todos, fases), fases);
    expect(d[0].text).toContain('2 começam na 1ª fase');
    expect(d[1].text).toContain('pulando 2 fase(s)');
  });

  it('fases sem entrada direta não aparecem na lista', () => {
    const fases = [fase(), fase()];
    const d = describeDirectEntries(planDirectEntries([atleta('a', 1)], fases), fases);
    expect(d).toHaveLength(1);
  });
});
