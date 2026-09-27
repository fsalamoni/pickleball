/**
 * Regras das AULAS do professor (`coach_lessons`) — revisão da Onda CG.
 *
 * O aluno escrevia qualquer campo da aula: criava já confirmada e podia gravar
 * um cupom "aplicado" com o desconto que quisesse. Estas asserções provam que:
 *
 *  1. ⭐ o aluno PEDE (solicitada, sem preço, cupom só PENDENTE) e CANCELA — e
 *     nada além;
 *  2. ⭐ o professor segue escrevendo a aula inteira: agenda já confirmada,
 *     confirma aplicando o cupom (preço com desconto) e devolve o uso ao
 *     cancelar;
 *  3. as consultas que o serviço faz na confirmação (as aulas do aluno com
 *     este professor; o vínculo de aluno) são aceitas para o professor;
 *  4. quem não é parte da aula não lê nem escreve.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const ADMIN = 'admin_uid';
const PROF = 'prof_uid';
const ANA = 'ana_uid';
const ESTRANHO = 'estranho_uid';

const cupomPendente = { coupon_id: 'cup1', code: 'AULA10', benefit: '10% de desconto na aula', kind: 'discount', status: 'pending' };

const pedido = (over = {}) => ({
  coach_id: PROF, student_id: ANA, student_name: 'Ana', requested_by: 'student',
  kind: 'single', format: 'private', status: 'requested', price: null,
  slots: [{ date: '2026-10-07', start: '18:00', end: '19:00' }],
  coupon: cupomPendente, created_by: ANA, ...over,
});

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-coach-lessons-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    for (const uid of [PROF, ANA, ESTRANHO]) await setDoc(doc(db, 'users', uid), { uid, role: 'user' });
    await setDoc(doc(db, 'coaches', PROF), { uid: PROF, display_name: 'Prof. Bia', hourly_rate: 100 });
    await setDoc(doc(db, 'coach_lessons', 'pedida'), pedido());
    await setDoc(doc(db, 'coach_lessons', 'confirmada'), pedido({
      status: 'confirmed', price: 90,
      coupon: { ...cupomPendente, status: 'applied', discount_value: 10, original_price: 100 },
    }));
    await setDoc(doc(db, 'coach_lessons', 'concluida'), pedido({ status: 'completed', coupon: null }));
    await setDoc(doc(db, 'coach_students', `${PROF}_${ANA}`), { coach_id: PROF, student_id: ANA, status: 'active' });
    await setDoc(doc(db, 'promo_coupons', 'cup1'), {
      issuer_type: 'coach', issuer_id: PROF, code: 'AULA10', kind: 'discount', type: 'percent', value: 10,
      active: true, used_count: 1, used_by: [ANA],
    });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('⭐ o aluno PEDE a aula', () => {
  it('pedido solicitado, sem preço, com cupom pendente (ou sem cupom)', async () => {
    const db = como(ANA);
    await assertSucceeds(setDoc(doc(db, 'coach_lessons', 'nova'), pedido()));
    await assertSucceeds(setDoc(doc(db, 'coach_lessons', 'sem_cupom'), (() => { const p = pedido(); delete p.coupon; return p; })()));
  });

  it('⭐ não nasce confirmada', async () => {
    await assertFails(setDoc(doc(como(ANA), 'coach_lessons', 'x'), pedido({ status: 'confirmed' })));
  });

  it('⭐ não grava preço', async () => {
    await assertFails(setDoc(doc(como(ANA), 'coach_lessons', 'x'), pedido({ price: 1 })));
  });

  it('⭐ não grava cupom aplicado, nem desconto', async () => {
    const db = como(ANA);
    await assertFails(setDoc(doc(db, 'coach_lessons', 'x'), pedido({ coupon: { ...cupomPendente, status: 'applied' } })));
    await assertFails(setDoc(doc(db, 'coach_lessons', 'y'), pedido({ coupon: { ...cupomPendente, discount_value: 100 } })));
  });

  it('não pede em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'coach_lessons', 'x'), pedido()));
  });
});

describe('⭐ o aluno CANCELA — e nada além', () => {
  it('cancela a aula pedida e a confirmada', async () => {
    const db = como(ANA);
    await assertSucceeds(updateDoc(doc(db, 'coach_lessons', 'pedida'), { status: 'cancelled', updated_at: 1 }));
    await assertSucceeds(updateDoc(doc(db, 'coach_lessons', 'confirmada'), { status: 'cancelled' }));
  });

  it('⭐ não confirma a própria aula, não mexe no cupom nem no preço', async () => {
    const db = como(ANA);
    await assertFails(updateDoc(doc(db, 'coach_lessons', 'pedida'), { status: 'confirmed' }));
    await assertFails(updateDoc(doc(db, 'coach_lessons', 'pedida'), { coupon: { ...cupomPendente, status: 'applied' } }));
    await assertFails(updateDoc(doc(db, 'coach_lessons', 'confirmada'), { price: 0 }));
    // Cancelar levando junto outro campo também não.
    await assertFails(updateDoc(doc(db, 'coach_lessons', 'confirmada'), { status: 'cancelled', price: 0 }));
  });

  it('não "cancela" o que já terminou', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'coach_lessons', 'concluida'), { status: 'cancelled' }));
  });

  it('⭐ não apaga a aula (o registro é do professor)', async () => {
    await assertFails(deleteDoc(doc(como(ANA), 'coach_lessons', 'pedida')));
  });
});

describe('⭐ o professor segue escrevendo a aula inteira', () => {
  it('agenda já confirmada, com preço', async () => {
    await assertSucceeds(setDoc(doc(como(PROF), 'coach_lessons', 'agendada'), pedido({
      requested_by: 'coach', status: 'confirmed', price: 100, coupon: null, created_by: PROF,
    })));
  });

  it('confirma aplicando o cupom, com o preço já descontado', async () => {
    await assertSucceeds(updateDoc(doc(como(PROF), 'coach_lessons', 'pedida'), {
      status: 'confirmed', price: 90,
      coupon: { ...cupomPendente, status: 'applied', discount_value: 10, original_price: 100 },
    }));
  });

  it('⭐ cancela e DEVOLVE o uso do cupom (aula + cupom num lote)', async () => {
    const db = como(PROF);
    await assertSucceeds(updateDoc(doc(db, 'coach_lessons', 'confirmada'), { status: 'cancelled' }));
    const lote = writeBatch(db);
    lote.update(doc(db, 'promo_coupons', 'cup1'), { used_count: 0, used_by: [] });
    lote.update(doc(db, 'coach_lessons', 'confirmada'), {
      coupon: { ...cupomPendente, status: 'applied', discount_value: 10, original_price: 100, returned: true, returned_at: 1 },
    });
    await assertSucceeds(lote.commit());
  });

  it('apaga a aula; o admin também', async () => {
    await assertSucceeds(deleteDoc(doc(como(PROF), 'coach_lessons', 'pedida')));
    await assertSucceeds(deleteDoc(doc(como(ADMIN), 'coach_lessons', 'confirmada')));
  });

  it('⭐ as consultas da confirmação: as aulas do aluno com ele e o vínculo de aluno', async () => {
    const db = como(PROF);
    await assertSucceeds(getDocs(query(collection(db, 'coach_lessons'), where('coach_id', '==', PROF), where('student_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(db, 'coach_students'), where('coach_id', '==', PROF), where('student_id', '==', ANA))));
  });

  it('o aluno lista as próprias aulas', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'coach_lessons'), where('student_id', '==', ANA))));
  });
});

describe('quem não é parte da aula', () => {
  it('não lê, não escreve, não apaga', async () => {
    const db = como(ESTRANHO);
    await assertFails(getDoc(doc(db, 'coach_lessons', 'pedida')));
    await assertFails(updateDoc(doc(db, 'coach_lessons', 'pedida'), { status: 'cancelled' }));
    await assertFails(deleteDoc(doc(db, 'coach_lessons', 'pedida')));
  });

  it('não devolve o uso do cupom do professor (só o emissor escreve o cupom)', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'promo_coupons', 'cup1'), { used_count: 0, used_by: [] }));
  });
});
