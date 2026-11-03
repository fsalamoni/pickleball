/**
 * O ADMINISTRADOR DA PLATAFORMA ajusta e conduz o dia de jogo de qualquer
 * pessoa (2026-11-03): o documento do dia ele já editava (`adm()` no update);
 * agora também os participantes e os jogos (`isGameDayAdminOf` com `adm()`) e
 * o convite público em nome de quem criou o dia (`open_games` create).
 * E nada disso vale para uma conta comum.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const CRIADOR = 'criador_uid';
const ADMIN = 'admin_plataforma_uid';
const OUTRO = 'outro_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-admin-dia-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { role: 'platform_admin' });
    await setDoc(doc(db, 'users', OUTRO), { role: 'user' });
    await setDoc(doc(db, 'game_days', 'dia'), {
      created_by: CRIADOR, member_uids: [CRIADOR], visibility: 'private', status: 'active',
      format: 'americano', date: '2026-11-05', time: '19:00', title: 'Racha',
    });
    await setDoc(doc(db, 'game_days', 'dia', 'participants', 'p1'), { user_id: CRIADOR, name: 'Criador' });
    await setDoc(doc(db, 'game_days', 'dia', 'games', 'g1'), { order: 1, score_a: 0, score_b: 0 });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('administrador da plataforma num dia de jogo de outra pessoa', () => {
  it('configura o documento do dia (data, horário, formato, organizadores)', async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'game_days', 'dia'), {
      date: '2026-11-06', time: '20:00', format: 'play', admin_uids: [OUTRO], manage_mode: 'participants',
    }));
  });

  it('insere, edita e remove participantes', async () => {
    const db = como(ADMIN);
    await assertSucceeds(setDoc(doc(db, 'game_days', 'dia', 'participants', 'p2'), { user_id: null, name: 'Convidado' }));
    await assertSucceeds(updateDoc(doc(db, 'game_days', 'dia', 'participants', 'p1'), { name: 'Criador (corrigido)' }));
    await assertSucceeds(deleteDoc(doc(db, 'game_days', 'dia', 'participants', 'p2')));
  });

  it('cria, corrige e apaga jogos', async () => {
    const db = como(ADMIN);
    await assertSucceeds(setDoc(doc(db, 'game_days', 'dia', 'games', 'g2'), { order: 2 }));
    await assertSucceeds(updateDoc(doc(db, 'game_days', 'dia', 'games', 'g1'), { score_a: 11, score_b: 7 }));
    await assertSucceeds(deleteDoc(doc(db, 'game_days', 'dia', 'games', 'g2')));
  });

  it('publica o convite público em nome de quem criou o dia', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN), 'open_games', 'og1'), {
      kind: 'game_day', game_day_id: 'dia', created_by: CRIADOR, status: 'open',
    }));
  });
});

describe('conta comum continua sem poder no dia dos outros', () => {
  it('não configura, não mexe em participantes nem em jogos', async () => {
    const db = como(OUTRO);
    await assertFails(updateDoc(doc(db, 'game_days', 'dia'), { time: '21:00' }));
    await assertFails(setDoc(doc(db, 'game_days', 'dia', 'participants', 'p3'), { user_id: CRIADOR, name: 'X' }));
    await assertFails(updateDoc(doc(db, 'game_days', 'dia', 'games', 'g1'), { score_a: 11 }));
  });

  it('não cria convite em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(como(OUTRO), 'open_games', 'og2'), {
      kind: 'game_day', game_day_id: 'dia', created_by: CRIADOR, status: 'open',
    }));
  });
});
