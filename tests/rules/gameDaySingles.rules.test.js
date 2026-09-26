/**
 * Regras do jogo SIMPLES no dia de jogo (Onda CF) — zero regra nova.
 *
 * O jogo simples é um jogo do dia com `kind: 'singles'` e 1 atleta por lado
 * — campo que já existia. Publicado, vira um `club_event_games` com
 * `kind: 'singles'` e um uid por lado, formato que a regra de sempre já
 * validava (singles = 1, doubles = 2). Estas asserções provam, contra as
 * regras de sempre, que:
 *
 *  1. ⭐ quem organiza grava o jogo simples no dia (dono, administrador
 *     nomeado, arena);
 *  2. ⭐ quem organiza PUBLICA o simples no ranking — e a regra recusa o
 *     formato torto (simples com dois de cada lado, duplas com um);
 *  3. ⭐ quem só participa não publica, e quem é de fora não grava jogo.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const DONO = 'dono_uid';
const ADMIN = 'admin_uid';
const JOGA = 'joga_uid';
const FORA = 'fora_uid';
const GESTOR = 'gestor_uid';
const ARENA = 'arena_1';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-game-day-singles-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', DONO), { uid: DONO, role: 'user' });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), { arena_id: ARENA, user_id: GESTOR });
    // Dia do atleta, restrito, com um administrador nomeado.
    await setDoc(doc(db, 'game_days', 'gd1'), {
      id: 'gd1', created_by: DONO, title: 'Sábado', format: 'play', visibility: 'private', status: 'active',
      member_uids: [DONO, ADMIN, JOGA], invited_uids: [], manage_mode: 'owner_only', admin_uids: [ADMIN],
    });
    // Dia da arena.
    await setDoc(doc(db, 'game_days', 'gd-arena'), {
      id: 'gd-arena', created_by: 'alguem', title: 'Terça', format: 'americano_live', visibility: 'public',
      status: 'active', member_uids: [JOGA], invited_uids: [], arena_id: ARENA,
    });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

const jogoSimples = (extra = {}) => ({
  id: 'g1', round: null, court: 2, kind: 'singles', status: 'open',
  side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }],
  side_b: [{ id: 'p2', name: 'Bia', user_id: 'u2' }],
  score_a: null, score_b: null, order: 1, ...extra,
});

const espelho = (eventId, extra = {}) => ({
  id: `gd_${eventId}_g1`, source: 'athlete_game_day', event_id: eventId, date_id: 'main', club_id: null,
  game_id: 'g1', kind: 'singles', side_a: 'u1', side_b: 'u2', side_a_ids: ['u1'], side_b_ids: ['u2'],
  score_a: 11, score_b: 4, winner_side: 'a', status: 'finished', ...extra,
});

describe('⭐ o jogo simples no dia de jogo', () => {
  it('o dono e o administrador nomeado gravam o jogo simples', async () => {
    await assertSucceeds(setDoc(doc(como(DONO), 'game_days', 'gd1', 'games', 'g1'), jogoSimples()));
    await assertSucceeds(setDoc(doc(como(ADMIN), 'game_days', 'gd1', 'games', 'g2'), jogoSimples({ id: 'g2' })));
  });

  it('quem gere a ARENA grava o jogo simples no dia da arena', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'game_days', 'gd-arena', 'games', 'g1'), jogoSimples()));
  });

  it('quem é de fora não grava jogo nenhum', async () => {
    await assertFails(setDoc(doc(como(FORA), 'game_days', 'gd1', 'games', 'g9'), jogoSimples({ id: 'g9' })));
  });
});

describe('⭐ a publicação do simples no ranking', () => {
  it('⭐ o dono publica o simples (kind singles, um uid por lado)', async () => {
    await assertSucceeds(setDoc(doc(como(DONO), 'club_event_games', 'gd_gd1_g1'), espelho('gd1')));
  });

  it('⭐ quem gere a arena publica o simples do dia da arena', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'club_event_games', 'gd_gd-arena_g1'), espelho('gd-arena')));
  });

  it('⭐ a regra recusa o formato torto', async () => {
    const db = como(DONO);
    // "Simples" com dois de cada lado.
    await assertFails(setDoc(doc(db, 'club_event_games', 'x1'), espelho('gd1', {
      side_a_ids: ['u1', 'u3'], side_b_ids: ['u2', 'u4'],
    })));
    // "Duplas" com um de cada lado.
    await assertFails(setDoc(doc(db, 'club_event_games', 'x2'), espelho('gd1', { kind: 'doubles' })));
  });

  it('quem só participa não publica', async () => {
    await assertFails(setDoc(doc(como(JOGA), 'club_event_games', 'gd_gd1_g1'), espelho('gd1')));
  });
});
