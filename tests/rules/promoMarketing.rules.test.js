/**
 * Regras da DIVULGAÇÃO da plataforma e dos professores (Onda CG).
 *
 * Três coleções novas (`promo_coupons`, `promo_campaigns`, `promo_settings`),
 * aditivas. Estas asserções provam que:
 *
 *  1. ⭐ a plataforma cria e edita pelo admin — e só por ele;
 *  2. ⭐ o professor cria e edita os DELE, só com perfil de professor, e não
 *     cria em nome de outro nem troca o emissor no update;
 *  3. ⭐ qualquer conta logada LÊ cupom e campanha (é para ser visto), sem
 *     poder mexer; quem não está logado não lê;
 *  4. ⭐ as configurações (custo do vale, modelos) são privadas do emissor;
 *  5. o admin pode pausar/apagar o de um professor (moderação), mas não cria
 *     em nome dele;
 *  6. nenhuma regra antiga mudou: o cupom da ARENA segue igual.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const ADMIN = 'admin_uid';
const PROF = 'prof_uid';
const PROF_B = 'prof_b_uid';
const ANA = 'ana_uid';
const SEM_PERFIL = 'sem_perfil_uid';

const cupomPlataforma = (over = {}) => ({
  issuer_type: 'platform', issuer_id: 'platform', issuer_name: 'PickleRush',
  kind: 'discount', code: 'OPEN10', type: 'percent', value: 10,
  active: true, show_public: true, show_home: true, used_count: 0, used_by: [],
  reach: { mode: 'brasil', state: '', city: '' }, visibility: 'todos', ...over,
});
const cupomProf = (over = {}) => cupomPlataforma({
  issuer_type: 'coach', issuer_id: PROF, issuer_name: 'Prof. Ana', code: 'AULA10', ...over,
});
const campanha = (over = {}) => ({
  issuer_type: 'coach', issuer_id: PROF, issuer_name: 'Prof. Ana',
  title: 'Clínica de voleio', message: 'Sábado às 9h', audience: 'alunos_ativos',
  status: 'sent', recipients_count: 3, banner: null, ...over,
});

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-promo-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    for (const uid of [PROF, PROF_B, ANA, SEM_PERFIL]) {
      await setDoc(doc(db, 'users', uid), { uid, role: 'user' });
    }
    await setDoc(doc(db, 'coaches', PROF), { uid: PROF, name: 'Prof. Ana', active: true });
    await setDoc(doc(db, 'coaches', PROF_B), { uid: PROF_B, name: 'Prof. Bia', active: true });
    await setDoc(doc(db, 'promo_coupons', 'da_plataforma'), cupomPlataforma());
    await setDoc(doc(db, 'promo_coupons', 'do_prof'), cupomProf());
    await setDoc(doc(db, 'promo_campaigns', 'camp_prof'), campanha());
    await setDoc(doc(db, 'promo_campaigns', 'camp_plat'), campanha({ issuer_type: 'platform', issuer_id: 'platform', issuer_name: 'PickleRush', audience: 'todos' }));
    await setDoc(doc(db, 'promo_settings', 'platform'), { coupon_costs: { da_plataforma: 12 } });
    await setDoc(doc(db, 'promo_settings', PROF), { coupon_costs: { do_prof: 8 } });
    await setDoc(doc(db, 'arena_managers', `arena_1_${PROF}`), { arena_id: 'arena_1', user_id: PROF });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

describe('⭐ plataforma: só o admin', () => {
  it('o admin cria, edita e apaga cupom e campanha da plataforma', async () => {
    const db = como(ADMIN);
    await assertSucceeds(setDoc(doc(db, 'promo_coupons', 'novo'), cupomPlataforma({ code: 'NOVO' })));
    await assertSucceeds(updateDoc(doc(db, 'promo_coupons', 'da_plataforma'), { active: false }));
    await assertSucceeds(setDoc(doc(db, 'promo_campaigns', 'nova'), campanha({ issuer_type: 'platform', issuer_id: 'platform' })));
    await assertSucceeds(deleteDoc(doc(db, 'promo_coupons', 'da_plataforma')));
  });

  it('professor e atleta não criam em nome da plataforma', async () => {
    await assertFails(setDoc(doc(como(PROF), 'promo_coupons', 'x'), cupomPlataforma()));
    await assertFails(setDoc(doc(como(ANA), 'promo_campaigns', 'x'), campanha({ issuer_type: 'platform', issuer_id: 'platform' })));
  });

  it('"platform" com outro id não é a plataforma', async () => {
    await assertFails(setDoc(doc(como(ADMIN), 'promo_coupons', 'x'), cupomPlataforma({ issuer_id: ADMIN })));
  });

  it('ninguém além do admin mexe no cupom da plataforma', async () => {
    await assertFails(updateDoc(doc(como(PROF), 'promo_coupons', 'da_plataforma'), { used_count: 1 }));
    await assertFails(deleteDoc(doc(como(ANA), 'promo_coupons', 'da_plataforma')));
  });
});

describe('⭐ professor: os dele, com perfil', () => {
  it('cria, edita (uso, pausa) e apaga os próprios', async () => {
    const db = como(PROF);
    await assertSucceeds(setDoc(doc(db, 'promo_coupons', 'meu'), cupomProf({ code: 'MEU' })));
    await assertSucceeds(updateDoc(doc(db, 'promo_coupons', 'do_prof'), { used_count: 1, used_by: [ANA] }));
    await assertSucceeds(setDoc(doc(db, 'promo_campaigns', 'minha'), campanha()));
    await assertSucceeds(updateDoc(doc(db, 'promo_campaigns', 'camp_prof'), { banner_active: false }));
    await assertSucceeds(deleteDoc(doc(db, 'promo_campaigns', 'camp_prof')));
  });

  it('⭐ sem perfil de professor, não divulga', async () => {
    await assertFails(setDoc(doc(como(SEM_PERFIL), 'promo_coupons', 'x'), cupomProf({ issuer_id: SEM_PERFIL })));
    await assertFails(setDoc(doc(como(SEM_PERFIL), 'promo_campaigns', 'x'), campanha({ issuer_id: SEM_PERFIL })));
  });

  it('⭐ não cria em nome de outro professor', async () => {
    await assertFails(setDoc(doc(como(PROF_B), 'promo_coupons', 'x'), cupomProf()));
  });

  it('⭐ outro professor não mexe no cupom dele', async () => {
    await assertFails(updateDoc(doc(como(PROF_B), 'promo_coupons', 'do_prof'), { active: false }));
    await assertFails(deleteDoc(doc(como(PROF_B), 'promo_campaigns', 'camp_prof')));
  });

  it('⭐ o emissor não muda no update', async () => {
    await assertFails(updateDoc(doc(como(PROF), 'promo_coupons', 'do_prof'), { issuer_id: PROF_B }));
    await assertFails(updateDoc(doc(como(PROF), 'promo_campaigns', 'camp_prof'), { issuer_type: 'platform', issuer_id: 'platform' }));
  });

  it('gerir uma arena não dá poder de divulgar como plataforma', async () => {
    await assertFails(setDoc(doc(como(PROF), 'promo_campaigns', 'x'), campanha({ issuer_type: 'platform', issuer_id: 'platform' })));
  });
});

describe('⭐ leitura: toda conta logada lê, ninguém de fora', () => {
  it('o atleta lê cupom e campanha', async () => {
    const db = como(ANA);
    await assertSucceeds(getDoc(doc(db, 'promo_coupons', 'do_prof')));
    await assertSucceeds(getDoc(doc(db, 'promo_campaigns', 'camp_plat')));
  });

  it('as consultas da tela inicial (só igualdades) e do perfil do professor', async () => {
    const db = como(ANA);
    await assertSucceeds(getDocs(query(collection(db, 'promo_coupons'), where('show_home', '==', true), where('active', '==', true))));
    await assertSucceeds(getDocs(query(collection(db, 'promo_campaigns'), where('show_home', '==', true), where('banner_active', '==', true))));
    await assertSucceeds(getDocs(query(collection(db, 'promo_coupons'), where('issuer_type', '==', 'coach'), where('issuer_id', '==', PROF))));
  });

  it('o atleta não mexe em nada', async () => {
    const db = como(ANA);
    await assertFails(updateDoc(doc(db, 'promo_coupons', 'do_prof'), { used_count: 99 }));
    await assertFails(setDoc(doc(db, 'promo_coupons', 'x'), cupomProf({ issuer_id: ANA })));
    await assertFails(deleteDoc(doc(db, 'promo_campaigns', 'camp_plat')));
  });

  it('sem login, não lê', async () => {
    await assertFails(getDoc(doc(anonimo(), 'promo_coupons', 'da_plataforma')));
    await assertFails(getDocs(collection(anonimo(), 'promo_campaigns')));
  });
});

describe('⭐ configurações privadas do emissor', () => {
  it('o professor lê e grava as dele', async () => {
    const db = como(PROF);
    await assertSucceeds(getDoc(doc(db, 'promo_settings', PROF)));
    await assertSucceeds(setDoc(doc(db, 'promo_settings', PROF), { coupon_costs: { do_prof: 9 } }, { merge: true }));
  });

  it('⭐ ninguém mais lê o custo do vale', async () => {
    await assertFails(getDoc(doc(como(ANA), 'promo_settings', PROF)));
    await assertFails(getDoc(doc(como(PROF_B), 'promo_settings', PROF)));
    await assertFails(getDoc(doc(como(PROF), 'promo_settings', 'platform')));
    await assertFails(setDoc(doc(como(PROF_B), 'promo_settings', PROF), { coupon_costs: {} }));
  });

  it('sem perfil de professor, nem as próprias', async () => {
    await assertFails(setDoc(doc(como(SEM_PERFIL), 'promo_settings', SEM_PERFIL), { banner_templates: [] }));
  });

  it('o admin lê e grava as da plataforma', async () => {
    const db = como(ADMIN);
    await assertSucceeds(getDoc(doc(db, 'promo_settings', 'platform')));
    await assertSucceeds(setDoc(doc(db, 'promo_settings', 'platform'), { banner_templates: [] }, { merge: true }));
  });
});

describe('moderação e compatibilidade', () => {
  it('o admin pausa e apaga o cupom de um professor', async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'promo_coupons', 'do_prof'), { active: false }));
    await assertSucceeds(deleteDoc(doc(como(ADMIN), 'promo_campaigns', 'camp_prof')));
  });

  it('o admin não cria em nome de um professor', async () => {
    await assertFails(setDoc(doc(como(ADMIN), 'promo_coupons', 'x'), cupomProf()));
  });

  it('o cupom da ARENA segue a regra de sempre', async () => {
    await assertSucceeds(setDoc(doc(como(PROF), 'arena_coupons', 'c1'), {
      arena_id: 'arena_1', code: 'X', kind: 'discount', type: 'percent', value: 10, active: true,
    }));
    await assertFails(setDoc(doc(como(ANA), 'arena_coupons', 'c2'), { arena_id: 'arena_1', code: 'Y' }));
  });
});
