/**
 * Regras do "JOGAR" — os dias de jogo públicos dos próximos dias.
 *
 * O "Jogar" do início passou a ler os dias de jogo públicos (do atleta e da
 * ARENA) numa consulta só: `visibility == 'public'` + `date IN [próximos
 * dias]`. Nenhuma regra nova. Estas asserções provam, com contas que NÃO são
 * admin, que:
 *  - a consulta passa pela regra de sempre (com o filtro de visibilidade);
 *  - sem o filtro, a regra a recusa — por isso o guarda de fonte existe;
 *  - quem abre o dia de jogo pelo "Jogar" lê o dia, os inscritos, e entra e
 *    sai sozinho (só a si mesmo), como já fazia pelo Procura-se jogo.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const ANA = 'ana_uid';
const BIA = 'bia_uid';
const GESTOR = 'gestor_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-jogar-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'game_days', 'arena'), {
      arena_id: 'A1', visibility: 'public', created_by: GESTOR, member_uids: [GESTOR],
      status: 'active', format: 'play', date: '2026-10-02', capacity: 8, title: 'Dia da arena',
    });
    await setDoc(doc(db, 'game_days', 'atleta'), {
      visibility: 'public', created_by: BIA, member_uids: [BIA], invited_uids: [],
      status: 'active', format: 'americano', date: '2026-10-03', title: 'Racha',
    });
    await setDoc(doc(db, 'game_days', 'privado'), {
      visibility: 'private', created_by: BIA, member_uids: [BIA],
      status: 'active', format: 'americano', date: '2026-10-03', title: 'Só convidados',
    });
    await setDoc(doc(db, 'game_days', 'arena', 'participants', 'p1'), { user_id: 'x', name: 'X' });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const dias = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

describe('a consulta do "Jogar"', () => {
  it('⭐ um atleta qualquer lista os dias públicos dos próximos dias', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(ANA), 'game_days'),
      where('visibility', '==', 'public'),
      where('date', 'in', dias),
    )));
  });

  it('sem o filtro de visibilidade, a regra recusa (e por isso ele é contrato)', async () => {
    await assertFails(getDocs(query(collection(como(ANA), 'game_days'), where('date', 'in', dias))));
  });

  it('quem não entrou não abre o dia privado', async () => {
    await assertFails(getDoc(doc(como(ANA), 'game_days', 'privado')));
  });
});

describe('abrir o dia de jogo pelo "Jogar" e participar', () => {
  it('⭐ lê o dia e os inscritos de um dia público', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'game_days', 'arena')));
    await assertSucceeds(getDocs(collection(como(ANA), 'game_days', 'arena', 'participants')));
  });

  it('⭐ entra sozinho num dia público (a própria inscrição e a própria associação)', async () => {
    const db = como(ANA);
    await assertSucceeds(setDoc(doc(db, 'game_days', 'atleta', 'participants', 'ana'), { user_id: ANA, name: 'Ana' }));
    await assertSucceeds(updateDoc(doc(db, 'game_days', 'atleta'), { member_uids: arrayUnion(ANA) }));
  });

  it('não inscreve outra pessoa', async () => {
    await assertFails(setDoc(doc(como(ANA), 'game_days', 'atleta', 'participants', 'x'), { user_id: 'outra', name: 'Outra' }));
  });

  it('sai sozinho (apaga a PRÓPRIA inscrição, não a dos outros)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'game_days', 'atleta', 'participants', 'ana'), { user_id: ANA, name: 'Ana' });
    });
    await assertSucceeds(deleteDoc(doc(como(ANA), 'game_days', 'atleta', 'participants', 'ana')));
    await assertFails(deleteDoc(doc(como(ANA), 'game_days', 'arena', 'participants', 'p1')));
  });
});
