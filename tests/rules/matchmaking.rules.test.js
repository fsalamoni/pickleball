/**
 * Regras do JOGO ABERTO, da FILA DE ESPERA, das INDICAÇÕES e do PDV
 * (2026-09-24).
 *
 * Estas funcionalidades estavam "prontas" desde a Onda AH e **nenhuma
 * funcionava para o atleta** — sem teste de regra nenhum que mostrasse:
 *
 *  - entrar no jogo aberto grava `participants` na vaga, e só a arena podia
 *    atualizar a vaga;
 *  - entrar na fila exige saber quantos estão na frente, e o atleta não podia
 *    ler a fila;
 *  - aceitar/recusar a chamada é atualizar a PRÓPRIA entrada, e só a arena
 *    podia;
 *  - a arena não conseguia ler as indicações dela (o resgate procurava o
 *    código com uma consulta recusada);
 *  - confirmar pagamento listava os pagamentos da venda só por `sale_id`.
 *
 * Metade das asserções prova o que passou a funcionar; a outra metade, o que
 * continua (ou passou a ser) barrado.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where,
  arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';

const GESTOR = 'gestor_uid';
const ATLETA = 'atleta_uid';
const OUTRO = 'outro_uid';
const ARENA = 'arena_1';
const ARENA_2 = 'arena_2';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-matchmaking-test',
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
    // Vaga com 3 de 4 lugares ocupados.
    await setDoc(doc(db, 'arena_open_slots', 's_aberta'), {
      arena_id: ARENA, status: 'open', total_spots: 4, filled_spots: 3,
      participants: ['p1', 'p2', OUTRO],
    });
    // Vaga lotada, com o ATLETA dentro.
    await setDoc(doc(db, 'arena_open_slots', 's_cheia'), {
      arena_id: ARENA, status: 'full', total_spots: 2, filled_spots: 2,
      participants: ['p1', ATLETA],
    });
    await setDoc(doc(db, 'arena_open_slots', 's_cancelada'), {
      arena_id: ARENA, status: 'cancelled', total_spots: 4, filled_spots: 1, participants: ['p1'],
    });
    // Fila da vaga cheia: o ATLETA foi chamado; OUTRO espera.
    await setDoc(doc(db, 'arena_waitlist', `s_cheia_${OUTRO}`), {
      arena_id: ARENA, slot_id: 's_cheia', athlete_id: OUTRO, athlete_name: 'Outro', position: 1, status: 'waiting',
    });
    await setDoc(doc(db, 'arena_waitlist', 's_aberta_' + ATLETA), {
      arena_id: ARENA, slot_id: 's_aberta', athlete_id: ATLETA, athlete_name: 'Atleta', position: 1, status: 'notified',
    });
    await setDoc(doc(db, 'arena_referrals', `${ARENA}_${ATLETA}`), {
      arena_id: ARENA, referrer_id: ATLETA, referred_id: null, code: 'ABC123',
    });
    await setDoc(doc(db, 'arena_payments', 'pg1'), { arena_id: ARENA, sale_id: 'v1', payer_id: ATLETA });
    await setDoc(doc(db, 'arena_payments', 'pg2'), { arena_id: ARENA, sale_id: 'v1', payer_id: OUTRO });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

/* ------------------------------------------------------------------ */

describe('🐞 o atleta ENTRA e SAI do jogo aberto (antes: nunca funcionou)', () => {
  it('⭐ entra — e com o último lugar, a vaga vira "lotada"', async () => {
    await assertSucceeds(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_aberta'), {
      participants: arrayUnion(ATLETA), filled_spots: 4, status: 'full', updated_at: serverTimestamp(),
    }));
  });

  it('⭐ sai — e a vaga lotada volta a ter lugar', async () => {
    await assertSucceeds(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_cheia'), {
      participants: arrayRemove(ATLETA), filled_spots: 1, status: 'open', updated_at: serverTimestamp(),
    }));
  });

  it('não entra em vaga lotada', async () => {
    await assertFails(updateDoc(doc(como(OUTRO), 'arena_open_slots', 's_cheia'), {
      participants: arrayUnion(OUTRO), filled_spots: 3, status: 'full', updated_at: serverTimestamp(),
    }));
  });

  it('não entra em vaga cancelada', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_cancelada'), {
      participants: arrayUnion(ATLETA), filled_spots: 2, status: 'open', updated_at: serverTimestamp(),
    }));
  });

  it('não põe OUTRA pessoa na vaga', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_aberta'), {
      participants: arrayUnion('terceiro'), filled_spots: 4, status: 'full', updated_at: serverTimestamp(),
    }));
  });

  it('não TIRA outra pessoa da vaga', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_aberta'), {
      participants: arrayRemove(OUTRO), filled_spots: 2, status: 'open', updated_at: serverTimestamp(),
    }));
  });

  it('a contagem tem de bater com a lista, e "lotada" só quando lotou', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_aberta'), {
      participants: arrayUnion(ATLETA), filled_spots: 1, status: 'full', updated_at: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_aberta'), {
      participants: arrayUnion(ATLETA), filled_spots: 4, status: 'open', updated_at: serverTimestamp(),
    }));
  });

  it('não muda mais nada da vaga junto (preço, nível, horário)', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_open_slots', 's_aberta'), {
      participants: arrayUnion(ATLETA), filled_spots: 4, status: 'full', total_spots: 10, updated_at: serverTimestamp(),
    }));
  });

  it('a arena continua editando a vaga', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_open_slots', 's_aberta'), { total_spots: 6, arena_id: ARENA }));
  });
});

describe('🐞 a FILA DE ESPERA (antes: entrar nunca funcionou)', () => {
  it('⭐ o atleta LÊ a fila da vaga (para saber a posição)', async () => {
    await assertSucceeds(getDocs(query(collection(como(ATLETA), 'arena_waitlist'), where('slot_id', '==', 's_cheia'))));
  });

  it('sem conta, não lê', async () => {
    await assertFails(getDocs(query(collection(testEnv.unauthenticatedContext().firestore(), 'arena_waitlist'), where('slot_id', '==', 's_cheia'))));
  });

  it('⭐ entra na fila, em nome próprio, esperando', async () => {
    await assertSucceeds(setDoc(doc(como('novo'), 'arena_waitlist', 's_cheia_novo'), {
      arena_id: ARENA, slot_id: 's_cheia', athlete_id: 'novo', athlete_name: 'Novo', position: 2, status: 'waiting',
    }));
  });

  it('não FURA a fila entrando já "chamado"', async () => {
    await assertFails(setDoc(doc(como('novo'), 'arena_waitlist', 's_cheia_novo'), {
      arena_id: ARENA, slot_id: 's_cheia', athlete_id: 'novo', position: 0, status: 'notified',
    }));
  });

  it('não põe outra pessoa na fila, nem com outro id', async () => {
    await assertFails(setDoc(doc(como('novo'), 'arena_waitlist', 's_cheia_x'), {
      arena_id: ARENA, slot_id: 's_cheia', athlete_id: 'x', position: 2, status: 'waiting',
    }));
    await assertFails(setDoc(doc(como('novo'), 'arena_waitlist', 'qualquer'), {
      arena_id: ARENA, slot_id: 's_cheia', athlete_id: 'novo', position: 2, status: 'waiting',
    }));
  });

  it('não planta a entrada na lista de OUTRA arena', async () => {
    await assertFails(setDoc(doc(como('novo'), 'arena_waitlist', 's_cheia_novo'), {
      arena_id: ARENA_2, slot_id: 's_cheia', athlete_id: 'novo', position: 2, status: 'waiting',
    }));
  });

  it('⭐ o chamado ACEITA ou RECUSA a própria chamada', async () => {
    await assertSucceeds(updateDoc(doc(como(ATLETA), 'arena_waitlist', 's_aberta_' + ATLETA), {
      status: 'accepted', accepted_at: serverTimestamp(), updated_at: serverTimestamp(),
    }));
  });

  it('quem só está esperando não se promove a "chamado"', async () => {
    await assertFails(updateDoc(doc(como(OUTRO), 'arena_waitlist', `s_cheia_${OUTRO}`), {
      status: 'accepted', updated_at: serverTimestamp(),
    }));
  });

  it('não mexe na posição, nem na entrada dos outros', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_waitlist', 's_aberta_' + ATLETA), {
      status: 'declined', position: 0, updated_at: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_waitlist', `s_cheia_${OUTRO}`), {
      position: 5, updated_at: serverTimestamp(),
    }));
  });

  it('o atleta sai da fila (apaga a própria entrada); não apaga a dos outros', async () => {
    await assertSucceeds(deleteDoc(doc(como(ATLETA), 'arena_waitlist', 's_aberta_' + ATLETA)));
    await assertFails(deleteDoc(doc(como(ATLETA), 'arena_waitlist', `s_cheia_${OUTRO}`)));
  });

  it('a arena continua mexendo na fila', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_waitlist', `s_cheia_${OUTRO}`), { position: 3 }));
  });
});

describe('🐞 a arena lê as indicações dela', () => {
  it('⭐ a arena procura o código (antes: recusado — o resgate nunca funcionou)', async () => {
    await assertSucceeds(getDocs(query(collection(como(GESTOR), 'arena_referrals'), where('arena_id', '==', ARENA))));
  });

  it('um estranho não lê as indicações da arena', async () => {
    await assertFails(getDocs(query(collection(como(OUTRO), 'arena_referrals'), where('arena_id', '==', ARENA))));
  });

  it('o indicador continua lendo o próprio código', async () => {
    await assertSucceeds(getDocs(query(collection(como(ATLETA), 'arena_referrals'), where('referrer_id', '==', ATLETA))));
  });
});

describe('🐞 confirmar pagamento (PDV)', () => {
  it('⭐ a arena lista os pagamentos da venda por arena_id + sale_id', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(GESTOR), 'arena_payments'), where('arena_id', '==', ARENA), where('sale_id', '==', 'v1'),
    )));
  });

  it('só por sale_id a regra recusa (era a consulta antiga — a venda nunca virava paga)', async () => {
    await assertFails(getDocs(query(collection(como(GESTOR), 'arena_payments'), where('sale_id', '==', 'v1'))));
  });
});
