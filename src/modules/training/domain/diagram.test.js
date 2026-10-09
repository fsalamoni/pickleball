import { describe, it, expect } from 'vitest';
import {
  COURT, MAX_ELEMENTS, MAX_DIAGRAMS, normalizeElement, normalizeDiagram, normalizeDiagrams, describeDiagram, zoneOf,
} from './diagram.js';

describe('normalizeElement', () => {
  it('prende as coordenadas em 0–100 com uma casa', () => {
    expect(normalizeElement({ t: 'bola', x: 150, y: -5 })).toEqual({ t: 'bola', x: 100, y: 0 });
    expect(normalizeElement({ t: 'cone', x: '12.36', y: 33.333 })).toEqual({ t: 'cone', x: 12.4, y: 33.3 });
  });

  it('recusa tipo desconhecido e coordenada que não é número', () => {
    expect(normalizeElement({ t: 'raquete', x: 1, y: 1 })).toBeNull();
    expect(normalizeElement({ t: 'bola', x: 'abc', y: 1 })).toBeNull();
    expect(normalizeElement(null)).toBeNull();
  });

  it('seta e zona exigem x2/y2 e recusam comprimento zero', () => {
    expect(normalizeElement({ t: 'seta', x: 10, y: 10 })).toBeNull();
    expect(normalizeElement({ t: 'zona', x: 10, y: 10, x2: 10, y2: 10 })).toBeNull();
    // zero depois do arredondamento/limite também é zero
    expect(normalizeElement({ t: 'seta', x: 120, y: 5, x2: 150, y2: 5 })).toBeNull();
    expect(normalizeElement({ t: 'seta', x: 10, y: 10, x2: 20, y2: 30 }))
      .toEqual({ t: 'seta', x: 10, y: 10, x2: 20, y2: 30, style: 'bola' });
    expect(normalizeElement({ t: 'seta', x: 10, y: 10, x2: 20, y2: 30, style: 'movimento' }).style).toBe('movimento');
    expect(normalizeElement({ t: 'zona', x: 0, y: 0, x2: 50, y2: 50 })).not.toHaveProperty('style');
  });

  it('jogador tem time a ou b (padrão a)', () => {
    expect(normalizeElement({ t: 'jogador', x: 1, y: 1 }).team).toBe('a');
    expect(normalizeElement({ t: 'jogador', x: 1, y: 1, team: 'b' }).team).toBe('b');
    expect(normalizeElement({ t: 'jogador', x: 1, y: 1, team: 'z' }).team).toBe('a');
  });

  it('texto precisa de rótulo; rótulo vai até 12 caracteres', () => {
    expect(normalizeElement({ t: 'texto', x: 1, y: 1, label: '   ' })).toBeNull();
    expect(normalizeElement({ t: 'texto', x: 1, y: 1, label: 'Cozinha da esquerda' }).label).toBe('Cozinha da e');
    expect(normalizeElement({ t: 'bola', x: 1, y: 1, label: '' })).not.toHaveProperty('label');
  });
});

describe('normalizeDiagram(s)', () => {
  it('diagrama sem elementos válidos não é diagrama', () => {
    expect(normalizeDiagram({ elements: [] })).toBeNull();
    expect(normalizeDiagram({ elements: [{ t: 'x' }] })).toBeNull();
    expect(normalizeDiagram()).toBeNull();
  });

  it('padrões de tag e vista, título até 80', () => {
    const d = normalizeDiagram({ title: 'x'.repeat(100), tag: 'raro', court: 'lua', elements: [{ t: 'bola', x: 1, y: 1 }] });
    expect(d.tag).toBe('neutro');
    expect(d.court).toBe('inteira');
    expect(d.title).toHaveLength(80);
  });

  it(`no máximo ${MAX_ELEMENTS} elementos e ${MAX_DIAGRAMS} diagramas`, () => {
    const elements = Array.from({ length: 40 }, (_, i) => ({ t: 'cone', x: i, y: i }));
    expect(normalizeDiagram({ elements }).elements).toHaveLength(MAX_ELEMENTS);
    const list = Array.from({ length: 7 }, () => ({ elements: [{ t: 'bola', x: 1, y: 1 }] }));
    expect(normalizeDiagrams(list)).toHaveLength(MAX_DIAGRAMS);
    expect(normalizeDiagrams('nada')).toEqual([]);
  });

  it('descarta os diagramas vazios da lista', () => {
    expect(normalizeDiagrams([{ elements: [] }, { elements: [{ t: 'bola', x: 1, y: 1 }] }])).toHaveLength(1);
  });
});

describe('describeDiagram', () => {
  it('conta jogadores, trajetórias, deslocamentos, alvos e cones', () => {
    const d = normalizeDiagram({
      title: 'Dink cruzado',
      tag: 'certo',
      elements: [
        { t: 'jogador', x: 20, y: 70 }, { t: 'jogador', x: 80, y: 30, team: 'b' },
        { t: 'seta', x: 20, y: 70, x2: 80, y2: 30, style: 'bola' },
        { t: 'seta', x: 20, y: 70, x2: 30, y2: 70, style: 'movimento' },
        { t: 'alvo', x: 80, y: 40 }, { t: 'zona', x: 60, y: 35, x2: 90, y2: 45 },
        { t: 'cone', x: 50, y: 60 },
      ],
    });
    expect(describeDiagram(d)).toBe(
      'Forma certa: Dink cruzado — 2 jogadores, 1 trajetória da bola, 1 deslocamento, 2 alvos, 1 cone.',
    );
  });

  it('sem título e só texto; vazio devolve ""', () => {
    expect(describeDiagram({ tag: 'errado', elements: [{ t: 'texto', label: 'oi' }] })).toBe('Forma errada.');
    expect(describeDiagram({ elements: [] })).toBe('');
    expect(describeDiagram(null)).toBe('');
  });
});

describe('zoneOf', () => {
  it('a cozinha tem 7 pés de cada lado da rede', () => {
    expect(COURT.kitchenTop).toBeCloseTo(34.09, 2);
    expect(COURT.kitchenBottom).toBeCloseTo(65.91, 2);
  });

  it('limites de cada zona', () => {
    expect(zoneOf(0)).toBe('fundo_superior');
    expect(zoneOf(34)).toBe('fundo_superior');
    expect(zoneOf(COURT.kitchenTop)).toBe('cozinha_superior');
    expect(zoneOf(49.9)).toBe('cozinha_superior');
    expect(zoneOf(50)).toBe('cozinha_inferior');
    expect(zoneOf(COURT.kitchenBottom)).toBe('cozinha_inferior');
    expect(zoneOf(66)).toBe('fundo_inferior');
    expect(zoneOf(100)).toBe('fundo_inferior');
  });
});
