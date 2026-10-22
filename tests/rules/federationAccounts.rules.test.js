/**
 * Regras do ORÇAMENTO E PRESTAÇÃO DE CONTAS da federação
 * (`federation_budgets`, `federation_ledger`, `federation_account_reports`):
 *
 *  1. ⭐ financeiro, conselho fiscal e admin leem tudo (rascunho inclusive);
 *     secretaria, filiado e estranho não;
 *  2. ⭐ publicado (`pub`) lê quem vê a federação, até sem conta — e só com o
 *     módulo ligado;
 *  3. ⭐ o lançamento é só da equipe das contas, mesmo depois de publicada a
 *     prestação;
 *  4. ⭐ as consultas da tela são prováveis (`federation_id`; e `pub == true`
 *     para o público);
 *  5. ⭐ ninguém grava pelo navegador — nem a presidência;
 *  6. ⭐ o conselho fiscal lê as cobranças (a receita derivada).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const TES = 'tes1';
const FIS = 'fis1';
const SEC = 'sec1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-accounts-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

async function base(modules = { accounts: true }) {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${FIS}`), { federation_id: FED, user_id: FIS, role: 'fiscal_council' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), { federation_id: FED, user_id: SEC, role: 'secretary' });
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, status: 'active' });
    await setDoc(doc(db, 'federation_budgets', `${FED}_2026`), { federation_id: FED, year: 2026, status: 'draft', lines: {} });
    await setDoc(doc(db, 'federation_budgets', `${FED}_2025`), { federation_id: FED, year: 2025, status: 'published', pub: true, lines: {} });
    await setDoc(doc(db, 'federation_account_reports', `${FED}_2025`), { federation_id: FED, period: '2025', status: 'published', pub: true });
    await setDoc(doc(db, 'federation_account_reports', `${FED}_2026-Q1`), { federation_id: FED, period: '2026-Q1', status: 'submitted' });
    await setDoc(doc(db, 'federation_ledger', 'l1'), { federation_id: FED, kind: 'expense', amount_cents: 100, status: 'posted' });
    await setDoc(doc(db, 'federation_charges', 'c1'), { federation_id: FED, payer_uid: ANA, status: 'paid', amount_cents: 100 });
  });
}

describe('contas: leitura', () => {
  beforeEach(() => base());

  it('1. financeiro, conselho fiscal e admin leem tudo; secretaria, filiado e estranho não', async () => {
    for (const uid of [PRES, TES, FIS]) {
      await assertSucceeds(getDoc(doc(como(uid), 'federation_budgets', `${FED}_2026`)));
      await assertSucceeds(getDoc(doc(como(uid), 'federation_account_reports', `${FED}_2026-Q1`)));
      await assertSucceeds(getDoc(doc(como(uid), 'federation_ledger', 'l1')));
      await assertSucceeds(getDocs(query(collection(como(uid), 'federation_ledger'), where('federation_id', '==', FED))));
      await assertSucceeds(getDocs(query(collection(como(uid), 'federation_account_reports'), where('federation_id', '==', FED))));
    }
    for (const uid of [SEC, ANA, ZE]) {
      await assertFails(getDoc(doc(como(uid), 'federation_budgets', `${FED}_2026`)));
      await assertFails(getDoc(doc(como(uid), 'federation_account_reports', `${FED}_2026-Q1`)));
      await assertFails(getDoc(doc(como(uid), 'federation_ledger', 'l1')));
    }
  });

  it('2. publicado: quem vê a federação, até sem conta', async () => {
    for (const db of [anonimo(), como(ZE), como(ANA)]) {
      await assertSucceeds(getDoc(doc(db, 'federation_budgets', `${FED}_2025`)));
      await assertSucceeds(getDoc(doc(db, 'federation_account_reports', `${FED}_2025`)));
      await assertSucceeds(getDocs(query(collection(db, 'federation_budgets'), where('federation_id', '==', FED), where('pub', '==', true))));
      await assertSucceeds(getDocs(query(collection(db, 'federation_account_reports'), where('federation_id', '==', FED), where('pub', '==', true))));
      await assertFails(getDocs(query(collection(db, 'federation_account_reports'), where('federation_id', '==', FED))));
    }
  });

  it('3. o lançamento nunca é público', async () => {
    await assertFails(getDoc(doc(anonimo(), 'federation_ledger', 'l1')));
    await assertFails(getDocs(query(collection(como(ANA), 'federation_ledger'), where('federation_id', '==', FED))));
  });

  it('6. o conselho fiscal lê as cobranças (a receita derivada); estranho não', async () => {
    await assertSucceeds(getDoc(doc(como(FIS), 'federation_charges', 'c1')));
    await assertSucceeds(getDocs(query(collection(como(FIS), 'federation_charges'), where('federation_id', '==', FED))));
    await assertFails(getDoc(doc(como(ZE), 'federation_charges', 'c1')));
  });

  it('5. ninguém grava pelo navegador', async () => {
    await assertFails(setDoc(doc(como(PRES), 'federation_ledger', 'novo'), { federation_id: FED, kind: 'income', amount_cents: 1, status: 'posted' }));
    await assertFails(updateDoc(doc(como(TES), 'federation_ledger', 'l1'), { status: 'void' }));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_ledger', 'l1')));
    await assertFails(updateDoc(doc(como(FIS), 'federation_account_reports', `${FED}_2026-Q1`), { status: 'opinion' }));
    await assertFails(setDoc(doc(como(TES), 'federation_budgets', `${FED}_2027`), { federation_id: FED, year: 2027, status: 'draft' }));
  });
});

describe('contas: módulo desligado', () => {
  beforeEach(() => base({}));

  it('2b. o publicado some do público; a equipe das contas segue lendo (desligar não apaga)', async () => {
    await assertFails(getDoc(doc(anonimo(), 'federation_budgets', `${FED}_2025`)));
    await assertFails(getDoc(doc(como(ANA), 'federation_account_reports', `${FED}_2025`)));
    await assertSucceeds(getDoc(doc(como(TES), 'federation_account_reports', `${FED}_2025`)));
  });
});
