/**
 * Documentos `{arena}_{uid}` que AINDA NÃO EXISTEM (2026-09-24).
 *
 * Membro, carteira, mensalidade e indicação têm id determinístico, e o código
 * pergunta "já existe?" com um `get` antes de criar. A regra de leitura dessas
 * coleções olha `resource.data` — e num documento que não existe `resource` é
 * nulo, então o `get` dava ERRO, para o atleta E para a arena:
 *
 *  - a arena não conseguia vender pacote nem creditar saldo a quem ainda não
 *    era membro (`sellPackageToMember` e `creditWallet` leem antes de gravar);
 *  - o código "Indique e ganhe" nunca era criado (`getOrCreateReferralCode`
 *    lê antes de criar), e a tela sumia sem aviso;
 *  - toda visita de não membro à página da arena gerava três leituras
 *    recusadas (membro, carteira, mensalidade), com as novas tentativas do
 *    React Query por cima.
 *
 * Metade das asserções prova o que passou a funcionar; a outra metade, que o
 * `allow get` novo NÃO abre documento existente de ninguém e não serve a
 * estranhos.
 *
 * ⚠️ Os ids de arena daqui não têm `_` — como os de produção, que são
 * automáticos. Um id de arena com `_` faz a regra NEGAR (nunca liberar).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, getDocs, collection, query, where, increment,
} from 'firebase/firestore';

const GESTOR = 'gestorUid';
const GESTOR_B = 'gestorBUid';
const ATLETA = 'atletaUid';
const NOVO = 'novoUid';
const OUTRO = 'outroUid';
const ARENA = 'arenaA';
const ARENA_B = 'arenaB';

const COLECOES = ['arena_members', 'arena_wallets', 'arena_subscriptions', 'arena_referrals'];

let testEnv;
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-arena-user-docs-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), { arena_id: ARENA, user_id: GESTOR });
    await setDoc(doc(db, 'arena_managers', `${ARENA_B}_${GESTOR_B}`), { arena_id: ARENA_B, user_id: GESTOR_B });
    // O ATLETA já é membro, com carteira, plano e código.
    await setDoc(doc(db, 'arena_members', `${ARENA}_${ATLETA}`), { arena_id: ARENA, user_id: ATLETA, points: 10 });
    await setDoc(doc(db, 'arena_wallets', `${ARENA}_${ATLETA}`), { arena_id: ARENA, user_id: ATLETA, balance: 50 });
    await setDoc(doc(db, 'arena_subscriptions', `${ARENA}_${ATLETA}`), { arena_id: ARENA, user_id: ATLETA, amount: 120 });
    await setDoc(doc(db, 'arena_referrals', `${ARENA}_${ATLETA}`), { arena_id: ARENA, referrer_id: ATLETA, referred_id: null, code: 'ABC123' });
  });
});

describe('o que passou a funcionar: ler o que ainda não existe', () => {
  for (const col of COLECOES) {
    it(`⭐ a pessoa lê o PRÓPRIO ${col} que ainda não existe`, async () => {
      await assertSucceeds(getDoc(doc(como(NOVO), col, `${ARENA}_${NOVO}`)));
    });
    it(`⭐ a arena lê o ${col} ainda inexistente de alguém, na arena DELA`, async () => {
      await assertSucceeds(getDoc(doc(como(GESTOR), col, `${ARENA}_${NOVO}`)));
    });
  }
});

describe('o que continua barrado', () => {
  for (const col of COLECOES) {
    it(`⭐ estranho não lê o ${col} inexistente de outra pessoa`, async () => {
      await assertFails(getDoc(doc(como(OUTRO), col, `${ARENA}_${NOVO}`)));
    });
    it(`⭐ gestor de OUTRA arena não lê o ${col} inexistente desta`, async () => {
      await assertFails(getDoc(doc(como(GESTOR_B), col, `${ARENA}_${NOVO}`)));
    });
    it(`⭐ o allow novo não abre o ${col} EXISTENTE de ninguém`, async () => {
      await assertFails(getDoc(doc(como(OUTRO), col, `${ARENA}_${ATLETA}`)));
      await assertFails(getDoc(doc(como(GESTOR_B), col, `${ARENA}_${ATLETA}`)));
    });
  }

  it('sem login, nada', async () => {
    const anonimo = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonimo, 'arena_wallets', `${ARENA}_${NOVO}`)));
  });

  it('a LISTA segue sendo só de quem a regra prova (o estranho não varre a arena)', async () => {
    await assertFails(getDocs(query(collection(como(OUTRO), 'arena_wallets'), where('arena_id', '==', ARENA))));
    await assertSucceeds(getDocs(query(collection(como(GESTOR), 'arena_wallets'), where('arena_id', '==', ARENA))));
  });

  it('id de arena com "_" faz a conta NEGAR, nunca liberar', async () => {
    // `arena_x_novoUid` → prefixo "arena": não bate com o uid nem com gestão.
    await assertFails(getDoc(doc(como(NOVO), 'arena_wallets', `arena_x_${NOVO}`)));
  });
});

describe('os fluxos que dependiam disso', () => {
  it('⭐ a arena credita a PRIMEIRA carteira de alguém (com arena_id, como o serviço grava agora)', async () => {
    const db = como(GESTOR);
    await assertSucceeds(getDoc(doc(db, 'arena_wallets', `${ARENA}_${NOVO}`)));
    await assertSucceeds(setDoc(doc(db, 'arena_wallets', `${ARENA}_${NOVO}`), {
      id: `${ARENA}_${NOVO}`, arena_id: ARENA, user_id: NOVO, balance: increment(20), points: 0,
    }, { merge: true }));
  });

  it('carteira nova SEM arena_id segue recusada — era o outro defeito do crédito', async () => {
    await assertFails(setDoc(doc(como(GESTOR), 'arena_wallets', `${ARENA}_${NOVO}`), {
      balance: increment(20),
    }, { merge: true }));
  });

  it('⭐ o atleta cria o próprio código de indicação depois de ver que não existe', async () => {
    const db = como(NOVO);
    await assertSucceeds(getDoc(doc(db, 'arena_referrals', `${ARENA}_${NOVO}`)));
    await assertSucceeds(setDoc(doc(db, 'arena_referrals', `${ARENA}_${NOVO}`), {
      id: `${ARENA}_${NOVO}`, arena_id: ARENA, referrer_id: NOVO, referred_id: null, code: 'NOVO42', status: 'open',
    }));
  });

  it('o atleta continua NÃO escrevendo a própria carteira', async () => {
    await assertFails(setDoc(doc(como(NOVO), 'arena_wallets', `${ARENA}_${NOVO}`), {
      arena_id: ARENA, user_id: NOVO, balance: 1000,
    }));
  });

  it('a arena torna membro quem ainda não era (lê, vê que não existe, cria)', async () => {
    const db = como(GESTOR);
    await assertSucceeds(getDoc(doc(db, 'arena_members', `${ARENA}_${NOVO}`)));
    await assertSucceeds(setDoc(doc(db, 'arena_members', `${ARENA}_${NOVO}`), {
      arena_id: ARENA, user_id: NOVO, points: 0,
    }));
  });
});
