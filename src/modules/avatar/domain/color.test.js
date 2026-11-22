import { describe, expect, it } from 'vitest';
import { isHexColor, luminance, mix, readableOn, shade } from './color.js';

describe('cores do avatar', () => {
  it('só aceita #rrggbb', () => {
    expect(isHexColor('#D4F82E')).toBe(true);
    for (const ruim of ['#fff', 'd4f82e', '#d4f82e00', 'red', null, 12]) expect(isHexColor(ruim)).toBe(false);
  });

  it('mistura duas cores', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('clareia para o branco e escurece para um tom frio, nunca fora da faixa', () => {
    expect(luminance(shade('#2563eb', 0.4))).toBeGreaterThan(luminance('#2563eb'));
    expect(luminance(shade('#2563eb', -0.4))).toBeLessThan(luminance('#2563eb'));
    expect(shade('#ffffff', 1)).toBe('#ffffff');
    expect(shade('não é cor', 0.5)).toBe('não é cor');
  });

  it('escolhe o texto que se lê sobre a cor da raquete', () => {
    expect(readableOn('#d4f82e')).toBe('#0b0f19');
    expect(readableOn('#0b0f19')).toBe('#ffffff');
    expect(readableOn('azul')).toBe('#ffffff');
  });
});
