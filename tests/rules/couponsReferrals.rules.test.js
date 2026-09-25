/**
 * Cupons, campanhas e indicações — as travas da Onda BX (2026-09-25).
 *
 * Três brechas fechadas, cada uma com a asserção do caminho legítimo ao lado:
 *
 *  1. 🐞 **O cupom (e a campanha) mudava de arena.** A regra de `update`
 *     conferia só a arena ANTIGA: o gestor de A trocava o `arena_id` para B e
 *     o cupom virava promoção na página de B e desconto nas reservas de B.
 *  2. 🐞 **O código de indicação podia ser sequestrado.** O id era livre: dava
 *     para criar `{arena}_{uid da vítima}` com o próprio uid como indicador —
 *     o "Meu código" da vítima mostrava o código do atacante, e toda indicação
 *     que ela fizesse creditava o atacante. E o código podia nascer com a
 *     contagem e o crédito já preenchidos (o que falsearia o controle de uso).
 *  3. **Só a arena escreve o resgate** — e sem trocar a arena, o dono ou o
 *     código. Antes o próprio indicador podia reescrever a contagem dele.
 *
 * E uma garantia que o controle de uso depende: o CUSTO que a arena paga por
 * um vale mora em `arena_settings`, que o atleta não lê.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment, arrayUnion } from 'firebase/firestore';

const GESTOR = 'gestorUid';
const GESTOR_B = 'gestorBUid';
const ATLETA = 'atletaUid';
const VITIMA = 'vitimaUid';
const ARENA = 'arenaA';
const ARENA_B = 'arenaB';

let testEnv;
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-coupons-referrals-test',
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
    await setDoc(doc(db, 'arena_coupons', 'cupomA'), {
      arena_id: ARENA, code: 'COCO', kind: 'drink', benefit: '1 água de coco', active: true, used_count: 0,
    });
    await setDoc(doc(db, 'arena_campaigns', 'campA'), { arena_id: ARENA, name: 'Volte' });
    await setDoc(doc(db, 'arena_referrals', `${ARENA}_${ATLETA}`), {
      id: `${ARENA}_${ATLETA}`, arena_id: ARENA, referrer_id: ATLETA, referred_id: null,
      code: 'ATLETA7XQ2', status: 'open', redeemed_count: 0,
    });
    await setDoc(doc(db, 'arena_settings', ARENA), { coupon_costs: { cupomA: 3.5 } });
  });
});

describe('1. o cupom e a campanha não mudam de arena', () => {
  it('a arena edita o próprio cupom (tipo, benefício, estado)', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_coupons', 'cupomA'), {
      benefit: '1 água de coco gelada', active: false,
    }));
  });

  it('a arena registra o uso de um vale na recepção', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_coupons', 'cupomA'), {
      used_count: increment(1), used_by: arrayUnion(ATLETA),
    }));
  });

  it('🐞 o gestor de A NÃO muda o cupom para a arena B', async () => {
    await assertFails(updateDoc(doc(como(GESTOR), 'arena_coupons', 'cupomA'), { arena_id: ARENA_B }));
  });

  it('🐞 o gestor de A NÃO muda a campanha para a arena B', async () => {
    await assertFails(updateDoc(doc(como(GESTOR), 'arena_campaigns', 'campA'), { arena_id: ARENA_B }));
  });

  it('a arena edita a própria campanha', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_campaigns', 'campA'), { name: 'Volte a jogar' }));
  });

  it('o gestor de B não edita o cupom de A; o atleta também não', async () => {
    await assertFails(updateDoc(doc(como(GESTOR_B), 'arena_coupons', 'cupomA'), { active: false }));
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_coupons', 'cupomA'), { used_count: 0 }));
  });
});

describe('2. o código de indicação é da própria pessoa', () => {
  it('⭐ o atleta cria o PRÓPRIO código, com o id dele', async () => {
    await assertSucceeds(setDoc(doc(como(VITIMA), 'arena_referrals', `${ARENA}_${VITIMA}`), {
      id: `${ARENA}_${VITIMA}`, arena_id: ARENA, referrer_id: VITIMA, referred_id: null,
      code: 'VITIMA9K3P', status: 'open', redeemed_count: 0,
    }));
  });

  it('🐞 NÃO cria o documento da vítima com o próprio uid como indicador (sequestro do código)', async () => {
    await assertFails(setDoc(doc(como(ATLETA), 'arena_referrals', `${ARENA}_${VITIMA}`), {
      arena_id: ARENA, referrer_id: ATLETA, referred_id: null, code: 'ATLETA7XQ2', status: 'open',
    }));
  });

  it('🐞 NÃO cria código com id livre', async () => {
    await assertFails(setDoc(doc(como(VITIMA), 'arena_referrals', 'qualquer'), {
      arena_id: ARENA, referrer_id: VITIMA, referred_id: null, code: 'VITIMA9K3P',
    }));
  });

  it('🐞 NÃO cria código com contagem, créditos ou resgatados já preenchidos', async () => {
    const base = { arena_id: ARENA, referrer_id: VITIMA, referred_id: null, code: 'VITIMA9K3P' };
    const ref = () => doc(como(VITIMA), 'arena_referrals', `${ARENA}_${VITIMA}`);
    await assertFails(setDoc(ref(), { ...base, redeemed_count: 5 }));
    await assertFails(setDoc(ref(), { ...base, redeemed_by: [ATLETA] }));
    await assertFails(setDoc(ref(), { ...base, reward_total: 999 }));
  });
});

describe('3. só a arena escreve o resgate', () => {
  it('⭐ a arena registra o resgate: contagem, quem, quanto', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_referrals', `${ARENA}_${ATLETA}`), {
      redeemed_count: increment(1), redeemed_by: arrayUnion(VITIMA), reward_total: increment(40), status: 'redeemed',
    }));
  });

  it('🐞 o indicador NÃO reescreve a própria contagem nem o próprio código', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_referrals', `${ARENA}_${ATLETA}`), { redeemed_count: 50 }));
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_referrals', `${ARENA}_${ATLETA}`), { code: 'VITIMA9K3P' }));
  });

  it('a arena NÃO troca o dono, o código nem a arena de um código', async () => {
    const ref = doc(como(GESTOR), 'arena_referrals', `${ARENA}_${ATLETA}`);
    await assertFails(updateDoc(ref, { referrer_id: GESTOR }));
    await assertFails(updateDoc(ref, { code: 'OUTRO12345' }));
    await assertFails(updateDoc(ref, { arena_id: ARENA_B }));
  });

  it('o gestor de OUTRA arena não registra resgate aqui', async () => {
    await assertFails(updateDoc(doc(como(GESTOR_B), 'arena_referrals', `${ARENA}_${ATLETA}`), {
      redeemed_count: increment(1),
    }));
  });

  it('o indicador continua lendo e podendo apagar o próprio código', async () => {
    await assertSucceeds(getDoc(doc(como(ATLETA), 'arena_referrals', `${ARENA}_${ATLETA}`)));
    await assertSucceeds(deleteDoc(doc(como(ATLETA), 'arena_referrals', `${ARENA}_${ATLETA}`)));
  });
});

describe('o custo interno do vale é só da arena', () => {
  it('⭐ a arena lê e grava o custo unitário dos vales', async () => {
    await assertSucceeds(getDoc(doc(como(GESTOR), 'arena_settings', ARENA)));
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_settings', ARENA), { 'coupon_costs.cupomA': 4 }));
  });

  it('🔒 o atleta NÃO lê o custo; outra arena também não', async () => {
    await assertFails(getDoc(doc(como(ATLETA), 'arena_settings', ARENA)));
    await assertFails(getDoc(doc(como(GESTOR_B), 'arena_settings', ARENA)));
  });

  it('o atleta continua lendo o cupom (confere o código, vê as promoções)', async () => {
    await assertSucceeds(getDoc(doc(como(ATLETA), 'arena_coupons', 'cupomA')));
  });
});
