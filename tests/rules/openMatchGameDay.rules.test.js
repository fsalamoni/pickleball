/**
 * Regras do JOGO ABERTO QUE É UM DIA DE JOGO (Onda CA).
 *
 * Nenhuma regra nova: a ligação usa só o que já existia. Estas asserções
 * provam que os LOTES do serviço passam pelas regras de sempre — e que as
 * portas continuam fechadas para quem tenta ir além de si mesmo.
 *
 *  - a arena cria a vitrine e o dia de jogo no mesmo lote;
 *  - o atleta entra: vitrine + participante + membro, num lote, só ELE;
 *  - o atleta sai: desfaz os três, só ELE;
 *  - a arena espelha a lista na vitrine; o atleta não.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, writeBatch, arrayUnion, arrayRemove, serverTimestamp, updateDoc,
} from 'firebase/firestore';

const GESTOR = 'gestor_uid';
const ANA = 'ana_uid';
const BIA = 'bia_uid';
const ARENA = 'arena_1';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-open-match-game-day-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const DIA = {
  arena_id: ARENA, visibility: 'public', created_by: GESTOR, member_uids: [GESTOR],
  invited_uids: [], admin_uids: [], status: 'active', format: 'americano', open_slot_id: 's1',
  manage_mode: 'owner_only',
};
const VAGA = {
  arena_id: ARENA, status: 'open', total_spots: 4, filled_spots: 0, participants: [], game_day_id: 'gd1',
};

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', GESTOR), { uid: GESTOR, role: 'user' });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), { arena_id: ARENA, user_id: GESTOR });
    await setDoc(doc(db, 'game_days', 'gd1'), DIA);
    await setDoc(doc(db, 'arena_open_slots', 's1'), VAGA);
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('a arena publica: vitrine + dia de jogo no mesmo lote', () => {
  it('passa para quem gerencia a arena', async () => {
    const db = como(GESTOR);
    const b = writeBatch(db);
    b.set(doc(db, 'game_days', 'gd2'), { ...DIA, open_slot_id: 's2' });
    b.set(doc(db, 'arena_open_slots', 's2'), { ...VAGA, game_day_id: 'gd2' });
    await assertSucceeds(b.commit());
  });

  it('não passa para um atleta qualquer (a vitrine é da arena)', async () => {
    const db = como(ANA);
    const b = writeBatch(db);
    b.set(doc(db, 'game_days', 'gd2'), { ...DIA, created_by: ANA, member_uids: [ANA], open_slot_id: 's2' });
    b.set(doc(db, 'arena_open_slots', 's2'), { ...VAGA, game_day_id: 'gd2' });
    await assertFails(b.commit());
  });
});

function lotedeEntrada(db, uid, { participante = uid, naVitrine = [uid] } = {}) {
  const b = writeBatch(db);
  b.update(doc(db, 'arena_open_slots', 's1'), {
    participants: naVitrine, filled_spots: naVitrine.length, status: 'open', updated_at: serverTimestamp(),
  });
  b.set(doc(db, 'game_days', 'gd1', 'participants', `p_${participante}`), {
    id: `p_${participante}`, user_id: participante, name: 'Atleta', source: 'joined',
  });
  b.update(doc(db, 'game_days', 'gd1'), { member_uids: arrayUnion(participante), updated_at: serverTimestamp() });
  return b;
}

describe('⭐ o atleta entra: os três num lote, só ele', () => {
  it('entrar a si mesmo passa', async () => {
    await assertSucceeds(lotedeEntrada(como(ANA), ANA).commit());
  });

  it('inscrever OUTRA pessoa pela vitrine não passa', async () => {
    await assertFails(lotedeEntrada(como(ANA), ANA, { naVitrine: [ANA, BIA] }).commit());
  });

  it('criar o participante de OUTRA pessoa no dia de jogo não passa', async () => {
    await assertFails(lotedeEntrada(como(ANA), ANA, { participante: BIA }).commit());
  });
});

describe('⭐ o atleta sai: desfaz os três, só ele', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'arena_open_slots', 's1'), { ...VAGA, participants: [ANA, BIA], filled_spots: 2 });
      await setDoc(doc(db, 'game_days', 'gd1'), { ...DIA, member_uids: [GESTOR, ANA, BIA] });
      await setDoc(doc(db, 'game_days', 'gd1', 'participants', 'p_ana'), { user_id: ANA, name: 'Ana' });
      await setDoc(doc(db, 'game_days', 'gd1', 'participants', 'p_bia'), { user_id: BIA, name: 'Bia' });
    });
  });

  it('sair a si mesmo passa', async () => {
    const db = como(ANA);
    const b = writeBatch(db);
    b.update(doc(db, 'arena_open_slots', 's1'), {
      participants: arrayRemove(ANA), filled_spots: 1, status: 'open', updated_at: serverTimestamp(),
    });
    b.delete(doc(db, 'game_days', 'gd1', 'participants', 'p_ana'));
    b.update(doc(db, 'game_days', 'gd1'), { member_uids: arrayRemove(ANA), updated_at: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('tirar OUTRA pessoa não passa', async () => {
    const db = como(ANA);
    const b = writeBatch(db);
    b.update(doc(db, 'arena_open_slots', 's1'), {
      participants: arrayRemove(BIA), filled_spots: 1, status: 'open', updated_at: serverTimestamp(),
    });
    b.delete(doc(db, 'game_days', 'gd1', 'participants', 'p_bia'));
    await assertFails(b.commit());
  });
});

describe('o espelho da vitrine', () => {
  it('a arena espelha a lista do dia de jogo na vitrine', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_open_slots', 's1'), {
      participants: [ANA, BIA], filled_spots: 2, status: 'open', updated_at: serverTimestamp(),
    }));
  });

  it('o atleta não reescreve a lista dos outros', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'arena_open_slots', 's1'), {
      participants: [BIA], filled_spots: 1, status: 'open', updated_at: serverTimestamp(),
    }));
  });

  it('o atleta não troca o dia de jogo da vitrine', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'arena_open_slots', 's1'), { game_day_id: 'outro' }));
  });
});
