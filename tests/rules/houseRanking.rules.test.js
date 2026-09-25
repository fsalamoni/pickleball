/**
 * Regras do RANKING DA CASA (Onda CB) — e o defeito que ele desenterrou.
 *
 * O ranking da casa é DERIVADO: ele só LÊ o que já existe. Nenhuma regra nova.
 * Estas asserções provam que cada leitura que ele faz passa pelas regras de
 * sempre, para o atleta e para quem gere a arena.
 *
 * 🐞 E provam a correção de `listArenaGameDays`: filtrando só por `arena_id`,
 * a consulta era recusada para TODO MUNDO menos o admin da plataforma — o
 * gestor da própria arena inclusive. A regra de leitura de `game_days`
 * libera por `created_by`, `member_uids`, `visibility == 'public'` ou pelo
 * clube, e numa consulta o Firestore só aceita o que consegue provar para
 * tudo o que ela pode devolver. Com `visibility == 'public'` na consulta, a
 * regra fica provável. A asserção "sem o filtro é recusada" fica aqui de
 * propósito: é ela que impede alguém de "simplificar" a consulta de volta.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, setDoc, where,
} from 'firebase/firestore';

const GESTOR = 'gestor_uid';
const ANA = 'ana_uid';
const ARENA = 'arena_1';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-house-ranking-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', GESTOR), { uid: GESTOR, role: 'user' });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), { arena_id: ARENA, user_id: GESTOR });
    await setDoc(doc(db, 'game_days', 'gd1'), {
      arena_id: ARENA, visibility: 'public', created_by: GESTOR, member_uids: [GESTOR],
      status: 'active', format: 'americano', date: '2026-09-20',
    });
    // Um segundo dia, criado por OUTRO gestor: é o caso em que "eu criei"
    // deixa de provar a regra para a consulta inteira.
    await setDoc(doc(db, 'game_days', 'gd2'), {
      arena_id: ARENA, visibility: 'public', created_by: 'outro_gestor', member_uids: ['outro_gestor'],
      status: 'active', format: 'mexicano', date: '2026-09-21',
    });
    await setDoc(doc(db, 'game_days', 'gd1', 'participants', 'p1'), { user_id: ANA, name: 'Ana' });
    await setDoc(doc(db, 'game_days', 'gd1', 'games', 'g1'), { side_a: [{ id: 'p1' }], side_b: [], score_a: 11, score_b: 5 });
    await setDoc(doc(db, 'tournaments', 't1'), { arena_id: ARENA, status: 'finished', visibility: 'public', name: 'Open' });
    await setDoc(doc(db, 'tournament_modalities', 'm1'), { tournament_id: 't1', name: 'Duplas' });
    await setDoc(doc(db, 'tournament_registrations', 'r1'), { id: 'r1', tournament_id: 't1', modality_id: 'm1' });
    await setDoc(doc(db, 'tournament_matches', 'x1'), { tournament_id: 't1', modality_id: 'm1' });
    await setDoc(doc(db, 'arena_internal_tournaments', 'it1'), { arena_id: ARENA, status: 'finished', game_day_id: 'gd1' });
    await setDoc(doc(db, 'arena_ladders', `${ARENA}_geral`), { arena_id: ARENA, period: 'geral', rankings: [] });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const diasDaArena = (db) => query(
  collection(db, 'game_days'), where('arena_id', '==', ARENA), where('visibility', '==', 'public'),
);

describe('🐞 listar os dias de jogo de uma arena', () => {
  it('⭐ o atleta lista (com o filtro de visibilidade)', async () => {
    await assertSucceeds(getDocs(diasDaArena(como(ANA))));
  });

  it('⭐ o gestor da arena lista — inclusive os dias que OUTRO gestor criou', async () => {
    await assertSucceeds(getDocs(diasDaArena(como(GESTOR))));
  });

  it('sem o filtro de visibilidade a consulta é RECUSADA — até para o gestor (era o defeito)', async () => {
    await assertFails(getDocs(query(collection(como(GESTOR), 'game_days'), where('arena_id', '==', ARENA))));
    await assertFails(getDocs(query(collection(como(ANA), 'game_days'), where('arena_id', '==', ARENA))));
  });

  it('sem conta, não lista', async () => {
    await assertFails(getDocs(diasDaArena(testEnv.unauthenticatedContext().firestore())));
  });
});

describe('as leituras do ranking da casa passam pelas regras de sempre', () => {
  it('o atleta lê participantes e jogos de um dia de jogo da arena', async () => {
    const db = como(ANA);
    await assertSucceeds(getDocs(collection(db, 'game_days', 'gd1', 'participants')));
    await assertSucceeds(getDocs(collection(db, 'game_days', 'gd1', 'games')));
  });

  it('o atleta lê os torneios da casa: torneio, categorias, inscrições e partidas', async () => {
    const db = como(ANA);
    await assertSucceeds(getDocs(query(collection(db, 'tournaments'), where('arena_id', '==', ARENA))));
    await assertSucceeds(getDocs(query(collection(db, 'tournament_modalities'), where('tournament_id', '==', 't1'))));
    await assertSucceeds(getDocs(query(collection(db, 'tournament_registrations'), where('tournament_id', '==', 't1'))));
    await assertSucceeds(getDocs(query(collection(db, 'tournament_matches'), where('tournament_id', '==', 't1'))));
  });

  it('o atleta lê o ladder antigo e os torneios internos antigos (para não somar duas vezes)', async () => {
    const db = como(ANA);
    await assertSucceeds(getDoc(doc(db, 'arena_ladders', `${ARENA}_geral`)));
    await assertSucceeds(getDoc(doc(db, 'arena_ladders', 'outra_arena_geral')));
    await assertSucceeds(getDocs(query(collection(db, 'arena_internal_tournaments'), where('arena_id', '==', ARENA))));
  });
});

describe('o ranking da casa é derivado: ninguém escreve nele pelo navegador', () => {
  it('o atleta não grava o ladder', async () => {
    await assertFails(setDoc(doc(como(ANA), 'arena_ladders', `${ARENA}_geral`), {
      arena_id: ARENA, period: 'geral', rankings: [{ user_id: ANA, points: 9999 }],
    }));
  });

  it('o atleta não cria o ladder de outra arena', async () => {
    await assertFails(setDoc(doc(como(ANA), 'arena_ladders', 'arena_2_geral'), {
      arena_id: 'arena_2', period: 'geral', rankings: [],
    }));
  });
});
