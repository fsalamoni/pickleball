import { describe, it, expect } from 'vitest';
import { normalizeDiagram } from '@/modules/training/domain/diagram';
import {
  buildElement, defaultElement, elementName, nextPlayerLabel, popHistory, pushHistory, translateElement, viewCenter,
} from './diagramEditing';

describe('pôr elementos', () => {
  it('jogadores numerados por time', () => {
    const els = [{ t: 'jogador', team: 'a', x: 1, y: 1 }, { t: 'jogador', team: 'b', x: 2, y: 2 }];
    expect(nextPlayerLabel(els, 'a')).toBe('A2');
    expect(buildElement('jogador_b', { x: 30, y: 70 }, { elements: els })).toEqual({ t: 'jogador', x: 30, y: 70, team: 'b', label: 'B2' });
  });

  it('seta e zona precisam dos dois toques, e não nascem com tamanho zero', () => {
    expect(buildElement('seta_bola', { x: 10, y: 10 })).toBeNull();
    expect(buildElement('seta_mov', { x: 10, y: 10 }, { start: { x: 10, y: 10 } })).toBeNull();
    expect(buildElement('seta_mov', { x: 20, y: 30 }, { start: { x: 10, y: 10 } }))
      .toEqual({ t: 'seta', x: 10, y: 10, x2: 20, y2: 30, style: 'movimento' });
    expect(buildElement('zona', { x: 20, y: 30 }, { start: { x: 10, y: 10 } })).toMatchObject({ t: 'zona', x2: 20 });
  });

  it('texto nasce com rótulo (sem rótulo o domínio descarta)', () => {
    expect(buildElement('texto', { x: 5, y: 5 })).toMatchObject({ t: 'texto', label: 'Texto' });
  });

  it('pelo teclado: no meio da vista, e o diagrama continua válido', () => {
    expect(viewCenter('meia')).toEqual({ x: 50, y: 70 });
    const seta = defaultElement('seta_bola', 'cozinha', []);
    expect(seta).toMatchObject({ t: 'seta', style: 'bola' });
    expect(normalizeDiagram({ elements: [seta, defaultElement('cone', 'inteira')] }).elements).toHaveLength(2);
  });
});

describe('mover', () => {
  it('desloca e arredonda', () => {
    expect(translateElement({ t: 'bola', x: 10, y: 10 }, 2, -2)).toEqual({ t: 'bola', x: 12, y: 8 });
  });

  it('⭐ não sai da quadra — e a seta leva os dois pontos sem se deformar', () => {
    expect(translateElement({ t: 'cone', x: 99, y: 1 }, 5, -5)).toEqual({ t: 'cone', x: 100, y: 0 });
    const seta = { t: 'seta', x: 90, y: 50, x2: 96, y2: 60, style: 'bola' };
    expect(translateElement(seta, 10, 0)).toEqual({ ...seta, x: 94, x2: 100 });
  });
});

describe('desfazer', () => {
  it('empilha retratos e desfaz na ordem inversa', () => {
    let s = pushHistory([], 'a');
    s = pushHistory(s, 'b');
    const r = popHistory(s);
    expect(r.snapshot).toBe('b');
    expect(popHistory(r.stack).snapshot).toBe('a');
    expect(popHistory([]).snapshot).toBeNull();
  });

  it('a pilha tem limite', () => {
    let s = [];
    for (let i = 0; i < 60; i += 1) s = pushHistory(s, i, 50);
    expect(s).toHaveLength(50);
    expect(s[0]).toBe(10);
  });
});

describe('nome acessível', () => {
  it('diz o que é e onde está', () => {
    expect(elementName({ t: 'jogador', team: 'a', label: 'A1', x: 20, y: 60 })).toBe('Jogador A1, na cozinha de baixo, à esquerda');
    expect(elementName({ t: 'seta', style: 'movimento', x: 50, y: 90, x2: 50, y2: 60 }))
      .toBe('Deslocamento, do fundo de baixo até a cozinha de baixo');
  });
});
