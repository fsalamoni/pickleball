import { describe, it, expect } from 'vitest';
import { MAX_PENDING, addPending, orphanPhotoPaths, parsePending, pendingFull, removePending, serializePending } from './draftQueue.js';

describe('rascunho sem sinal', () => {
  it('⭐ foto que o registro gravado deixou de apontar: só a da pasta da pessoa, e só a que saiu', () => {
    const antes = { photos: [{ path: 'carreira/u1/a.webp' }, { path: 'carreira/u1/b.webp' }, { path: 'carreira/outro/c.webp' }, {}] };
    expect(orphanPhotoPaths(antes, { photos: [{ path: 'carreira/u1/b.webp' }] }, 'u1')).toEqual(['carreira/u1/a.webp']);
    // Sem o estado anterior (lista que não carregou) nada é apagado.
    expect(orphanPhotoPaths(undefined, { photos: [] }, 'u1')).toEqual([]);
    expect(orphanPhotoPaths(antes, antes, 'u1')).toEqual([]);
  });
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
  it('⭐ a fila tem teto, mas nunca descarta o que já estava guardado: quem guarda pergunta antes', () => {
    let f = [];
    for (let i = 0; i < MAX_PENDING; i += 1) f = addPending(f, { id: `u_${i}` });
    expect(pendingFull(f.slice(1), { id: 'u_novo' })).toBe(false);
    expect(pendingFull(f, { id: 'u_novo' })).toBe(true);
    // Trocar um rascunho que já está na fila sempre cabe.
    expect(pendingFull(f, { id: 'u_3' })).toBe(false);
    f = addPending(f, { id: 'u_novo' });
    expect(f[0].id).toBe('u_0');
    expect(f).toHaveLength(MAX_PENDING + 1);
  });
});
