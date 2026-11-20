import { describe, it, expect } from 'vitest';
import { rowHeights } from './alignRows.js';

describe('câmeras lado a lado', () => {
  it('cada etapa fica com a altura da maior entre as câmeras', () => {
    const m = rowHeights([
      { key: 'passo-1', h: 300 }, { key: 'passo-1', h: 340 },
      { key: 'calib-area', h: 120 }, { key: 'calib-area', h: 180 },
      { key: '', h: 999 },
    ]);
    expect(m.get('passo-1')).toBe(340);
    expect(m.get('calib-area')).toBe(180);
    expect(m.size).toBe(2);
  });
});
