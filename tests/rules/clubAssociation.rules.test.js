/**
 * Regras da ASSOCIAÇÃO DO CLUBE (`club_x/{clube}/{espécie}/{id}`):
 *
 *  1. planos e vantagens públicos só quando o clube PUBLICOU a associação;
 *  2. a filiação e a cobrança leem o titular e a equipe; ninguém grava pelo
 *     navegador (só o servidor), nem o administrador do clube;
 *  3. o administrador (e quem tem a permissão) grava planos, com validação;
 *     plano não se apaga; a configuração é do administrador;
 *  4. cargo com mandato vencido não dá poder; sem a flag, nada grava;
 *  5. o admin da plataforma lê tudo.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const TES = 'tes1';
const SEC = 'sec1';
const VENC = 'venc1';
const ANA = 'ana1';
const ZE = 'ze1';
const ADM = 'admin1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-assoc-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const x = (db, kind, id) => doc(db, 'club_x', CLUBE, kind, id);
const col = (db, kind) => collection(db, 'club_x', CLUBE, kind);

async function semear({ flag = true, publicado = true } = {}) {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { club_association: flag } });
    await setDoc(doc(db, 'clubs', CLUBE), { name: 'Clube A', association: { enabled: true, published: publicado } });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${PRES}`), { club_id: CLUBE, user_id: PRES, role: 'admin' });
    await setDoc(doc(db, 'club_members', `${CLUBE}_${ANA}`), { club_id: CLUBE, user_id: ANA, role: 'member' });
    await setDoc(doc(db, 'users', ADM), { role: 'platform_admin' });
    await setDoc(x(db, 'staff', TES), { user_id: TES, perms: ['finance'], term_end_ms: 0 });
    await setDoc(x(db, 'staff', SEC), { user_id: SEC, perms: ['members'], term_end_ms: 9e15 });
    await setDoc(x(db, 'staff', VENC), { user_id: VENC, perms: ['finance', 'members'], term_end_ms: 1 });
    await setDoc(x(db, 'plans', 'anual'), { club_id: CLUBE, name: 'Anual', price_cents: 12000, public: true, active: true });
    await setDoc(x(db, 'plans', 'oculto'), { club_id: CLUBE, name: 'Interno', price_cents: 0, public: false, active: true });
    await setDoc(x(db, 'aff', ANA), { club_id: CLUBE, user_id: ANA, status: 'active', plan_id: 'anual' });
    await setDoc(x(db, 'charges', 'c1'), { club_id: CLUBE, user_id: ANA, status: 'open', amount_cents: 12000 });
    await setDoc(x(db, 'cfg', 'pix'), { pix_key: 'chave@clube.com' });
  });
}

describe('leitura pública dos planos', () => {
  beforeEach(() => semear());

  it('1. qualquer um lê plano público de clube publicado; o interno, não', async () => {
    await assertSucceeds(getDoc(x(como(ZE), 'plans', 'anual')));
    await assertFails(getDoc(x(como(ZE), 'plans', 'oculto')));
    await assertSucceeds(getDocs(query(col(como(ZE), 'plans'), where('public', '==', true))));
    await assertFails(getDocs(col(como(ZE), 'plans')));
  });

  it('2. clube não publicado: o plano público some para o visitante, mas a presidência lê', async () => {
    await semear({ publicado: false });
    await assertFails(getDoc(x(como(ZE), 'plans', 'anual')));
    await assertSucceeds(getDoc(x(como(PRES), 'plans', 'oculto')));
  });
});

describe('filiação e cobrança', () => {
  beforeEach(() => semear());

  it('3. o titular lê a própria; outro associado não; a secretaria lê a filiação e o financeiro a cobrança', async () => {
    await assertSucceeds(getDoc(x(como(ANA), 'aff', ANA)));
    await assertSucceeds(getDoc(x(como(ANA), 'charges', 'c1')));
    await assertFails(getDoc(x(como(ZE), 'aff', ANA)));
    await assertFails(getDoc(x(como(ZE), 'charges', 'c1')));
    await assertSucceeds(getDoc(x(como(SEC), 'aff', ANA)));
    await assertSucceeds(getDoc(x(como(TES), 'charges', 'c1')));
    await assertSucceeds(getDoc(x(como(PRES), 'aff', ANA)));
  });

  it('4. consulta da própria cobrança é provável; consulta aberta do estranho, não', async () => {
    await assertSucceeds(getDocs(query(col(como(ANA), 'charges'), where('user_id', '==', ANA))));
    await assertFails(getDocs(col(como(ZE), 'charges')));
  });

  it('5. ⭐ ninguém grava filiação ou cobrança pelo navegador — nem o administrador', async () => {
    await assertFails(setDoc(x(como(ANA), 'aff', 'ze1'), { club_id: CLUBE, user_id: 'ze1', status: 'active' }));
    await assertFails(updateDoc(x(como(ANA), 'aff', ANA), { status: 'suspended' }));
    await assertFails(setDoc(x(como(PRES), 'aff', ZE), { club_id: CLUBE, user_id: ZE, status: 'active' }));
    await assertFails(updateDoc(x(como(PRES), 'charges', 'c1'), { status: 'paid' }));
    await assertFails(deleteDoc(x(como(PRES), 'charges', 'c1')));
    await assertFails(setDoc(x(como(PRES), 'staff', ZE), { user_id: ZE, perms: ['admin'] }));
  });

  it('6. a própria pessoa lê o seu cargo, os outros não', async () => {
    await assertSucceeds(getDoc(x(como(TES), 'staff', TES)));
    await assertFails(getDoc(x(como(ZE), 'staff', TES)));
  });
});

describe('planos e configuração', () => {
  beforeEach(() => semear());
  const plano = { club_id: CLUBE, name: 'Mensal', price_cents: 3000, public: true, active: true };

  it('7. o administrador cria e edita plano; o financeiro também; a secretaria e o estranho, não', async () => {
    await assertSucceeds(setDoc(x(como(PRES), 'plans', 'mensal'), plano));
    await assertSucceeds(updateDoc(x(como(PRES), 'plans', 'mensal'), { price_cents: 3500 }));
    await assertSucceeds(setDoc(x(como(TES), 'plans', 'mensal2'), plano));
    await assertFails(setDoc(x(como(SEC), 'plans', 'mensal3'), plano));
    await assertFails(setDoc(x(como(ZE), 'plans', 'mensal4'), plano));
  });

  it('8. o plano é validado: preço inteiro e não negativo, nome presente, clube igual', async () => {
    await assertFails(setDoc(x(como(PRES), 'plans', 'p1'), { ...plano, price_cents: -1 }));
    await assertFails(setDoc(x(como(PRES), 'plans', 'p2'), { ...plano, price_cents: 10.5 }));
    await assertFails(setDoc(x(como(PRES), 'plans', 'p3'), { ...plano, name: 'x'.repeat(81) }));
    await assertFails(setDoc(x(como(PRES), 'plans', 'p4'), { ...plano, club_id: 'outro' }));
  });

  it('9. plano não se apaga (desativa-se)', async () => {
    await assertFails(deleteDoc(x(como(PRES), 'plans', 'anual')));
  });

  it('10. o Pix e as regras: o financeiro lê, só o administrador grava', async () => {
    await assertSucceeds(getDoc(x(como(TES), 'cfg', 'pix')));
    await assertFails(getDoc(x(como(ZE), 'cfg', 'pix')));
    await assertSucceeds(setDoc(x(como(PRES), 'cfg', 'pix'), { pix_key: 'nova' }));
    await assertFails(setDoc(x(como(TES), 'cfg', 'pix'), { pix_key: 'nova' }));
  });
});

describe('mandato, flag e admin', () => {
  it('11. mandato vencido não dá poder', async () => {
    await semear();
    await assertFails(getDoc(x(como(VENC), 'charges', 'c1')));
    await assertFails(getDoc(x(como(VENC), 'aff', ANA)));
  });

  it('12. com a flag desligada ninguém grava, mas a leitura segue', async () => {
    await semear({ flag: false });
    await assertFails(setDoc(x(como(PRES), 'plans', 'novo'), { club_id: CLUBE, name: 'N', price_cents: 1, public: true }));
    await assertSucceeds(getDoc(x(como(PRES), 'plans', 'anual')));
  });

  it('13. o admin da plataforma lê tudo', async () => {
    await semear();
    await assertSucceeds(getDoc(x(como(ADM), 'aff', ANA)));
    await assertSucceeds(getDoc(x(como(ADM), 'cfg', 'pix')));
  });
});
