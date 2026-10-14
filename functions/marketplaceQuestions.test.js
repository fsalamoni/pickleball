/** O aviso da pergunta do Mercado: nova → quem vende; respondida → quem perguntou. */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { notifyQuestion } = require('./marketplace.js');

function fakeDb() {
  const gravados = [];
  return {
    gravados,
    collection: () => ({ doc: () => ({}) , where: () => ({ get: async () => ({ docs: [] }) }) }),
    batch: () => ({ set: (_ref, data) => gravados.push(data), commit: async () => {} }),
  };
}

const q = { listing_id: 'L1', listing_title: 'Raquete', seller_key: 'athlete_vend', asker_uid: 'comp', text: 'Tem 16 mm?', status: 'open' };

describe('notifyQuestion', () => {
  it('pergunta nova avisa o vendedor, com link sem #', async () => {
    const db = fakeDb();
    expect(await notifyQuestion({ db, now: 1 }, 'q1', null, q)).toBe('seller');
    expect(db.gravados.map((n) => n.user_id)).toEqual(['vend']);
    expect(db.gravados[0].link).toBe('/mercado/anuncio/L1?ancora=perguntas');
  });
  it('resposta avisa quem perguntou; outras edições não avisam', async () => {
    const db = fakeDb();
    expect(await notifyQuestion({ db, now: 1 }, 'q1', q, { ...q, status: 'answered', answer: 'Sim' })).toBe('asker');
    expect(db.gravados.map((n) => n.user_id)).toEqual(['comp']);
    expect(await notifyQuestion({ db, now: 1 }, 'q1', { ...q, status: 'answered' }, { ...q, status: 'answered' })).toBe(null);
    expect(await notifyQuestion({ db, now: 1 }, 'q1', q, null)).toBe(null);
  });
});
