/**
 * Regras das FEDERAÇÕES (flag `federations`). Coleções `federation_*`, aditivas.
 *
 *  1. ⭐ com a flag desligada ninguém abre federação, cria plano nem declara pagamento;
 *  2. ⭐ a federação nasce `pending` por qualquer conta; status, verificação e
 *     selo só o admin da plataforma;
 *  3. ⭐ a equipe tem papel; a regra pergunta pela permissão do papel;
 *     presidente só por presidente;
 *  4. ⭐ a filiação o navegador NÃO cria nem muda de estado; o próprio só mexe
 *     nas preferências; a lista NUNCA é pública;
 *  5. ⭐ a cobrança o navegador não cria; o pagador só declara;
 *  6. ⭐ o índice da carteirinha ninguém lê pelo cliente.
 *
 * Contas que NÃO são admin da plataforma de propósito (lição de `listArenaGameDays`).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const ADMIN = 'admin1';
const PRES = 'pres1';
const DIR = 'dir1';
const SEC = 'sec1';
const TES = 'tes1';
const ANA = 'ana1';
const BIA = 'bia1';
const FED = 'fedA';

const federacao = (over = {}) => ({
  name: 'Federação Gaúcha de Pickleball', acronym: 'FGP', slug: 'fgp', level: 'state', state: 'RS',
  status: 'approved', verified: false, official: false, created_by: PRES, modules: {}, payment: {}, ...over,
});
const staff = (uid, role) => ({ federation_id: FED, user_id: uid, role, user_name: uid });
const plano = (over = {}) => ({ federation_id: FED, name: 'Federado', price_cents: 12000, billing: 'annual', tier: 'federated', person_type: 'athlete', active: true, ...over });
const filiacao = (uid, over = {}) => ({ federation_id: FED, user_id: uid, user_name: uid, status: 'active', valid_until: '2027-01-01', card_code: 'ABCDEFGHJK', member_number: 'FGP-2026-000001', ...over });

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), federacao());
    await setDoc(doc(db, 'federations', FED, 'private', 'data'), { cnpj: '11222333000181', legal_name: 'FGP' });
    await setDoc(doc(db, 'federations', 'pend'), federacao({ status: 'pending', slug: 'pend', created_by: BIA }));
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), staff(PRES, 'president'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${DIR}`), staff(DIR, 'director'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${SEC}`), staff(SEC, 'secretary'));
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), staff(TES, 'treasurer'));
    await setDoc(doc(db, 'federation_plans', 'p1'), plano());
    await setDoc(doc(db, 'federation_members', `${FED}_${ANA}`), filiacao(ANA));
    await setDoc(doc(db, 'federation_charges', 'c1'), { federation_id: FED, payer_uid: ANA, status: 'open', amount_cents: 12000 });
    await setDoc(doc(db, 'federation_card_index', 'ABCDEFGHJK'), { member_id: `${FED}_${ANA}`, federation_id: FED });
  });
});

describe('⭐ a flag desligada fecha a porta', () => {
  it('sem a flag, ninguém abre federação, cria plano nem declara pagamento', async () => {
    await semRegras((db) => setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: {} }));
    await assertFails(setDoc(doc(como(BIA), 'federations', 'nova'), federacao({ status: 'pending', created_by: BIA, slug: 'nova' })));
    await assertFails(setDoc(doc(como(PRES), 'federation_plans', 'p2'), plano()));
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared' }));
    // Ler continua: o que está gravado não some.
    await assertSucceeds(getDoc(doc(como(BIA), 'federations', FED)));
  });
});

describe('⭐ a federação', () => {
  it('qualquer conta pede; nasce pendente, sem verificação nem selo', async () => {
    await assertSucceeds(setDoc(doc(como(BIA), 'federations', 'nova'), federacao({ status: 'pending', created_by: BIA, slug: 'nova' })));
    await assertFails(setDoc(doc(como(BIA), 'federations', 'n2'), federacao({ status: 'approved', created_by: BIA, slug: 'n2' })));
    await assertFails(setDoc(doc(como(BIA), 'federations', 'n3'), federacao({ status: 'pending', created_by: BIA, slug: 'n3', verified: true })));
    await assertFails(setDoc(doc(como(BIA), 'federations', 'n4'), federacao({ status: 'pending', created_by: ANA, slug: 'n4' })));
    await assertFails(setDoc(doc(como(BIA), 'federations', 'n5'), federacao({ status: 'pending', created_by: BIA, slug: 'Inválido' })));
  });
  it('aprovada é pública; pendente só quem pediu, o admin e ninguém mais', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'federations', FED)));
    await assertSucceeds(getDoc(doc(como(BIA), 'federations', 'pend')));
    await assertFails(getDoc(doc(como(ANA), 'federations', 'pend')));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'federations', 'pend')));
    await assertSucceeds(getDocs(query(collection(anonimo(), 'federations'), where('status', '==', 'approved'))));
    await assertSucceeds(getDocs(query(collection(como(BIA), 'federations'), where('created_by', '==', BIA))));
    await assertFails(getDocs(collection(como(BIA), 'federations')));
  });
  it('quem pede a abertura confere o endereço só entre as APROVADAS (sem o status a regra não prova a consulta)', async () => {
    await assertSucceeds(getDocs(query(collection(como(BIA), 'federations'), where('slug', '==', 'fgp'), where('status', '==', 'approved'))));
    await assertFails(getDocs(query(collection(como(BIA), 'federations'), where('slug', '==', 'fgp'))));
  });
  it('a equipe (admin) edita a página, nunca status, verificação ou selo', async () => {
    await assertSucceeds(updateDoc(doc(como(PRES), 'federations', FED), { about: 'Olá', payment: { pix_key: 'x@y.z' } }));
    await assertSucceeds(updateDoc(doc(como(DIR), 'federations', FED), { modules: { ranking: true } }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { verified: true }));
    await assertFails(updateDoc(doc(como(PRES), 'federations', FED), { status: 'suspended' }));
    await assertFails(updateDoc(doc(como(SEC), 'federations', FED), { about: 'Olá' }));
    await assertFails(updateDoc(doc(como(ANA), 'federations', FED), { about: 'Olá' }));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'federations', FED), { status: 'suspended', verified: true }));
  });
  it('CNPJ completo: quem pediu, a equipe (admin) e o admin da plataforma', async () => {
    await assertSucceeds(getDoc(doc(como(PRES), 'federations', FED, 'private', 'data')));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'federations', FED, 'private', 'data')));
    await assertFails(getDoc(doc(como(SEC), 'federations', FED, 'private', 'data')));
    await assertFails(getDoc(doc(como(ANA), 'federations', FED, 'private', 'data')));
    await assertSucceeds(setDoc(doc(como(BIA), 'federations', 'pend', 'private', 'data'), { cnpj: '1' }));
    await assertFails(setDoc(doc(como(ANA), 'federations', 'pend', 'private', 'data'), { cnpj: '1' }));
  });
});

describe('⭐ a equipe', () => {
  it('quem tem admin acrescenta papéis; presidente só por presidente', async () => {
    await assertSucceeds(setDoc(doc(como(PRES), 'federation_staff', `${FED}_${BIA}`), staff(BIA, 'communication')));
    await assertSucceeds(setDoc(doc(como(DIR), 'federation_staff', `${FED}_${ANA}`), staff(ANA, 'discipline')));
    await assertFails(setDoc(doc(como(DIR), 'federation_staff', `${FED}_x1`), staff('x1', 'president')));
    await assertSucceeds(setDoc(doc(como(PRES), 'federation_staff', `${FED}_x1`), staff('x1', 'president')));
    await assertFails(setDoc(doc(como(SEC), 'federation_staff', `${FED}_x2`), staff('x2', 'secretary')));
    await assertFails(setDoc(doc(como(PRES), 'federation_staff', `${FED}_x3`), staff('x3', 'king')));
    // id tem de bater com os campos.
    await assertFails(setDoc(doc(como(PRES), 'federation_staff', `${FED}_errado`), staff('x4', 'secretary')));
    // federação pendente não tem equipe ainda.
    await assertFails(setDoc(doc(como(BIA), 'federation_staff', `pend_${BIA}`), { federation_id: 'pend', user_id: BIA, role: 'president' }));
  });
  it('troca de papel: diretor não mexe no presidente; presidente não se rebaixa sozinho', async () => {
    await assertSucceeds(updateDoc(doc(como(DIR), 'federation_staff', `${FED}_${SEC}`), { role: 'treasurer' }));
    await assertFails(updateDoc(doc(como(DIR), 'federation_staff', `${FED}_${PRES}`), { role: 'director' }));
    await assertFails(updateDoc(doc(como(DIR), 'federation_staff', `${FED}_${SEC}`), { role: 'president' }));
    await assertFails(updateDoc(doc(como(PRES), 'federation_staff', `${FED}_${PRES}`), { role: 'director' }));
    await assertSucceeds(updateDoc(doc(como(PRES), 'federation_staff', `${FED}_${DIR}`), { role: 'president' }));
    await assertFails(updateDoc(doc(como(DIR), 'federation_staff', `${FED}_${SEC}`), { federation_id: 'outra' }));
  });
  it('sai da equipe quem quer (menos o presidente); quem tem admin tira os outros', async () => {
    await assertSucceeds(deleteDoc(doc(como(SEC), 'federation_staff', `${FED}_${SEC}`)));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_staff', `${FED}_${PRES}`)));
    await assertSucceeds(deleteDoc(doc(como(DIR), 'federation_staff', `${FED}_${TES}`)));
    await assertFails(deleteDoc(doc(como(ANA), 'federation_staff', `${FED}_${DIR}`)));
  });
  it('a equipe lê a equipe; a pessoa lê o próprio papel; conta logada lê a equipe de federação APROVADA; anônimo não', async () => {
    await assertSucceeds(getDocs(query(collection(como(SEC), 'federation_staff'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_staff'), where('user_id', '==', ANA))));
    // Revisão 2026-10-21: é assim que o clube, o organizador e o filiado avisam a equipe de um pedido.
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_staff'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(anonimo(), 'federation_staff'), where('federation_id', '==', FED))));
  });
});

describe('⭐ planos', () => {
  it('públicos; admin ou financeiro criam e editam; o navegador não apaga', async () => {
    await assertSucceeds(getDocs(query(collection(anonimo(), 'federation_plans'), where('federation_id', '==', FED))));
    await assertSucceeds(setDoc(doc(como(TES), 'federation_plans', 'p2'), plano({ name: 'Mensal', billing: 'monthly' })));
    await assertSucceeds(setDoc(doc(como(PRES), 'federation_plans', 'p3'), plano({ price_cents: 0, tier: 'registered' })));
    await assertFails(setDoc(doc(como(SEC), 'federation_plans', 'p4'), plano()));
    await assertFails(setDoc(doc(como(TES), 'federation_plans', 'p5'), plano({ price_cents: -1 })));
    await assertFails(setDoc(doc(como(TES), 'federation_plans', 'p6'), plano({ billing: 'weekly' })));
    await assertSucceeds(updateDoc(doc(como(TES), 'federation_plans', 'p1'), { active: false, price_cents: 13000 }));
    await assertFails(updateDoc(doc(como(TES), 'federation_plans', 'p1'), { federation_id: 'outra' }));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_plans', 'p1')));
  });
});

describe('⭐ filiados', () => {
  it('o navegador não cria filiação nem muda estado, número, validade ou código', async () => {
    await assertFails(setDoc(doc(como(BIA), 'federation_members', `${FED}_${BIA}`), filiacao(BIA, { status: 'pending' })));
    await assertFails(updateDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`), { status: 'active', valid_until: '2099-01-01' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`), { card_code: 'ZZZZZZZZZZ' }));
    await assertFails(updateDoc(doc(como(SEC), 'federation_members', `${FED}_${ANA}`), { status: 'suspended' }));
    await assertFails(deleteDoc(doc(como(PRES), 'federation_members', `${FED}_${ANA}`)));
  });
  it('o próprio muda só as preferências', async () => {
    await assertSucceeds(updateDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`), { public_badge: true, show_in_directory: false }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`), { public_badge: true, member_number: 'X' }));
    await assertFails(updateDoc(doc(como(BIA), 'federation_members', `${FED}_${ANA}`), { public_badge: true }));
  });
  it('⭐ a lista NUNCA é pública: o próprio, secretaria, financeiro, admin', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`)));
    await assertFails(getDoc(doc(como(BIA), 'federation_members', `${FED}_${ANA}`)));
    await assertFails(getDoc(doc(anonimo(), 'federation_members', `${FED}_${ANA}`)));
    await assertSucceeds(getDocs(query(collection(como(SEC), 'federation_members'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(TES), 'federation_members'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(PRES), 'federation_members'), where('federation_id', '==', FED))));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_members'), where('user_id', '==', ANA))));
    await assertFails(getDocs(query(collection(como(BIA), 'federation_members'), where('federation_id', '==', FED))));
    await assertFails(getDocs(collection(como(ANA), 'federation_members')));
  });
  it('a parte privada é lida pelo próprio e pela secretaria; só o servidor grava', async () => {
    // Revisão 2026-10-21: o navegador nunca gravou aqui (o CPF entra pelo pedido de filiação, no servidor).
    await assertFails(setDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`, 'private', 'data'), { cpf: '1' }));
    await semRegras((db) => setDoc(doc(db, 'federation_members', `${FED}_${ANA}`, 'private', 'data'), { cpf: '1' }));
    await assertSucceeds(getDoc(doc(como(ANA), 'federation_members', `${FED}_${ANA}`, 'private', 'data')));
    await assertSucceeds(getDoc(doc(como(SEC), 'federation_members', `${FED}_${ANA}`, 'private', 'data')));
    await assertFails(getDoc(doc(como(TES), 'federation_members', `${FED}_${ANA}`, 'private', 'data')));
    await assertFails(getDoc(doc(como(BIA), 'federation_members', `${FED}_${ANA}`, 'private', 'data')));
  });
});

describe('⭐ cobranças', () => {
  it('o navegador não cria; o pagador só declara; confirmar é do servidor', async () => {
    await assertFails(setDoc(doc(como(ANA), 'federation_charges', 'c2'), { federation_id: FED, payer_uid: ANA, status: 'paid', amount_cents: 1 }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', declared_note: 'Pix feito' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'paid' }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', amount_cents: 1 }));
    await assertFails(updateDoc(doc(como(BIA), 'federation_charges', 'c1'), { status: 'declared' }));
    await assertFails(updateDoc(doc(como(TES), 'federation_charges', 'c1'), { status: 'paid' }));
  });
  it('lê o pagador, o financeiro, a secretaria, o admin', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_charges'), where('payer_uid', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(TES), 'federation_charges'), where('federation_id', '==', FED))));
    await assertFails(getDocs(query(collection(como(BIA), 'federation_charges'), where('federation_id', '==', FED))));
  });
});

describe('⭐ o índice da carteirinha', () => {
  it('ninguém lê nem escreve pelo cliente — nem o admin', async () => {
    await assertFails(getDoc(doc(como(ANA), 'federation_card_index', 'ABCDEFGHJK')));
    await assertFails(getDoc(doc(como(ADMIN), 'federation_card_index', 'ABCDEFGHJK')));
    await assertFails(setDoc(doc(como(PRES), 'federation_card_index', 'NOVO'), { member_id: 'x' }));
  });
});

describe('aviso do tipo federation', () => {
  it('entra na lista branca da regra', async () => {
    await assertSucceeds(setDoc(doc(como(PRES), 'notifications', 'n1'), {
      user_id: ANA, title: 'Filiação', message: 'Aprovada', type: 'federation', link: '/federacoes', read: false, archived: false, created_at: new Date(), sent_by: PRES,
    }));
    await assertFails(setDoc(doc(como(PRES), 'notifications', 'n2'), {
      user_id: ANA, title: 'X', message: 'Y', type: 'federation_xpto', read: false, created_at: new Date(), sent_by: PRES,
    }));
  });
});
