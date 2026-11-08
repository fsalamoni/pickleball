import { describe, it, expect } from 'vitest';
import { bounceMap, lanceSummary } from './report';

describe('mapa dos quiques', () => {
  it('só quiques com posição; profundidade média do saque válido', () => {
    const lances = [
      { id: 'a', kind: 'bounce', call: 'in', serve: true, best: { x: 1.5, y: 12.4 } },
      { id: 'b', kind: 'bounce', call: 'in', serve: true, best: { x: 4.5, y: 0.6 } },
      { id: 'c', kind: 'bounce', call: 'out', best: { x: 6.3, y: 9 } },
      { id: 'd', kind: 'volley', call: 'fault', best: { x: 2, y: 5 } },
      { id: 'e', kind: 'bounce', call: 'in', best: {} },
    ];
    const r = bounceMap(lances);
    expect(r.marks.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(r.serveDepthM).toBeCloseTo((13.411 - 12.4 + 0.6) / 2, 5);
    expect(bounceMap([]).serveDepthM).toBeNull();
    expect(lanceSummary(lances).total).toBe(5);
  });
});
