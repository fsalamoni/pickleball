import { describe, it, expect } from 'vitest';
import { MAX_PENDING, addPending, parsePending, removePending, serializePending } from './draftQueue.js';

describe('rascunho sem sinal', () => {
  it('⭐ põe, troca pelo id e tira o que foi gravado', () => {
    let f = addPending([], { id: 'u_a', name: 'A' });
    f = addPending(f, { id: 'u_b', name: 'B' });
    f = addPending(f, { id: 'u_a', name: 'A2' });
    expect(f.map((x) => x.name)).toEqual(['B', 'A2']);
    expect(removePending(f, ['u_b']).map((x) => x.id)).toEqual(['u_a']);
  });
  it('texto estragado vira fila vazia; fila vazia apaga a preferência', () => {
    expect(parsePending('{xx')).toEqual([]);
    expect(parsePending('[{"id":"u_a"},{"x":1}]')).toEqual([{ id: 'u_a' }]);
    expect(serializePending([])).toBeNull();
    expect(parsePending(serializePending([{ id: 'u_a' }]))).toEqual([{ id: 'u_a' }]);
  });
  it('a fila tem teto', () => {
    let f = [];
    for (let i = 0; i < MAX_PENDING + 5; i += 1) f = addPending(f, { id: `u_${i}` });
    expect(f).toHaveLength(MAX_PENDING);
    expect(f[0].id).toBe('u_5');
  });
});
