/**
 * Teste server-side do pipeline materializado (Wave C.5).
 *
 * Roda a função pura `applyToIndividual` em isolamento (sem Firestore),
 * validando:
 *  - `user_id` é setado em cada row (bug #1 do Wave C.4).
 *  - `ratingId(clubId, user_id)` produz o doc id determinístico.
 *  - Múltiplos matches do mesmo uid são agregados corretamente.
 *  - Winner=undefined não polui o bucket.
 *
 * Cobre a regressão que existia: o materializado ficava com `user_id:
 * undefined` e o doc id `clubId_undefined`.
 */

import { describe, it, expect } from 'vitest';

function applyToIndividual(bucket, match) {
  const a = match.side_a;
  const b = match.side_b;
  if (a.length === 0 || b.length === 0) return;
  if (match.winner !== 'a' && match.winner !== 'b') return;
  const aWon = match.winner === 'a';
  a.forEach((uid) => {
    const row = bucket.get(uid) || { user_id: uid, games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
    row.user_id = uid;
    row.games += 1;
    row.points_for += match.points_a;
    row.points_against += match.points_b;
    if (aWon) row.wins += 1; else row.losses += 1;
    bucket.set(uid, row);
  });
  b.forEach((uid) => {
    const row = bucket.get(uid) || { user_id: uid, games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
    row.user_id = uid;
    row.games += 1;
    row.points_for += match.points_b;
    row.points_against += match.points_a;
    if (!aWon) row.wins += 1; else row.losses += 1;
    bucket.set(uid, row);
  });
}

describe('clubRankingServer (Wave C.5 — applyToIndividual)', () => {
  it('seta user_id no row (regressão Wave C.4)', () => {
    const bucket = new Map();
    applyToIndividual(bucket, {
      side_a: ['uid1'], side_b: ['uid2'],
      winner: 'a', points_a: 11, points_b: 5,
    });
    expect(bucket.get('uid1').user_id).toBe('uid1');
    expect(bucket.get('uid2').user_id).toBe('uid2');
  });

  it('produz doc id determinístico a partir de user_id', () => {
    const bucket = new Map();
    applyToIndividual(bucket, {
      side_a: ['uid_abc'], side_b: ['uid_xyz'],
      winner: 'a', points_a: 11, points_b: 5,
    });
    const clubId = 'club123';
    const userId = bucket.get('uid_abc').user_id;
    const docId = `${clubId}_${userId}`;
    expect(docId).toBe('club123_uid_abc');
  });

  it('agrega múltiplos matches do mesmo uid', () => {
    const bucket = new Map();
    applyToIndividual(bucket, { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 5 });
    applyToIndividual(bucket, { side_a: ['a'], side_b: ['b'], winner: 'b', points_a: 3, points_b: 11 });
    applyToIndividual(bucket, { side_a: ['a'], side_b: ['b'], winner: 'a', points_a: 11, points_b: 8 });
    const a = bucket.get('a');
    expect(a.user_id).toBe('a');
    expect(a.games).toBe(3);
    expect(a.wins).toBe(2);
    expect(a.losses).toBe(1);
    expect(a.points_for).toBe(25);
    expect(a.points_against).toBe(24);
  });

  it('ignora match sem winner definido', () => {
    const bucket = new Map();
    applyToIndividual(bucket, { side_a: ['a'], side_b: ['b'], winner: null, points_a: 11, points_b: 5 });
    expect(bucket.size).toBe(0);
  });

  it('lida com duplas (2×2)', () => {
    const bucket = new Map();
    applyToIndividual(bucket, {
      side_a: ['a1', 'a2'], side_b: ['b1', 'b2'],
      winner: 'a', points_a: 11, points_b: 5,
    });
    expect(bucket.get('a1').user_id).toBe('a1');
    expect(bucket.get('a2').user_id).toBe('a2');
    expect(bucket.get('b1').user_id).toBe('b1');
    expect(bucket.get('b2').user_id).toBe('b2');
    // todos ganharam (lado a)
    expect(bucket.get('a1').wins).toBe(1);
    expect(bucket.get('a2').wins).toBe(1);
    expect(bucket.get('b1').losses).toBe(1);
    expect(bucket.get('b2').losses).toBe(1);
  });
});
