/**
 * Regras das VANTAGENS, COMUNICADOS e PATROCINADORES do clube-associação
 * (`club_x/{clube}/{benefits|bsec|news|sponsors}/{id}`, Bloco C):
 *
 *  1. a vitrine da vantagem e o patrocinador são públicos só quando o
 *     documento é `public` E o clube publicou a associação;
 *  2. o "como usar"/código (`bsec`) é só da equipe — o associado o recebe do
 *     servidor, nunca lendo direto;
 *  3. o comunicado "só associados" lê qualquer MEMBRO do clube, e a consulta
 *     por `status == published` é provável; o rascunho nunca sai;
 *  4. quem grava é a comunicação (`comms`) e a administração; a secretaria e
 *     o estranho não; sem a flag nada grava.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const CLUBE = 'clubA';
const PRES = 'pres1';
const COM = 'com1';
const SEC = 'sec1';
const MEMBRO = 'membro1';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-club-content-test',
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
    await Promise.all([COM, SEC, MEMBRO].map((u) => setDoc(doc(db, 'club_members', `${CLUBE}_${u}`), { club_id: CLUBE, user_id: u, role: 'member' })));
    await setDoc(x(db, 'staff', COM), { user_id: COM, perms: ['comms'], term_end_ms: 0 });
    await setDoc(x(db, 'staff', SEC), { user_id: SEC, perms: ['members'], term_end_ms: 0 });
    await setDoc(x(db, 'benefits', 'vitrine'), { club_id: CLUBE, title: 'Café com 10%', public: true, active: true, has_secret: true });
    await setDoc(x(db, 'benefits', 'interna'), { club_id: CLUBE, title: 'Só para quem paga', public: false, active: true });
    await setDoc(x(db, 'bsec', 'vitrine'), { how_to: 'Diga o código no caixa', code: 'CLUBE10' });
    await setDoc(x(db, 'news', 'pub'), { club_id: CLUBE, title: 'Aberto', status: 'published', audience: 'public', public: true });
    await setDoc(x(db, 'news', 'assoc'), { club_id: CLUBE, title: 'Só membros', status: 'published', audience: 'members', public: false });
    await setDoc(x(db, 'news', 'rascunho'), { club_id: CLUBE, title: 'Rascunho', status: 'draft', audience: 'members', public: false });
    await setDoc(x(db, 'sponsors', 's1'), { club_id: CLUBE, name: 'Loja Boa', public: true, active: true });
    await setDoc(x(db, 'sponsors', 's2'), { club_id: CLUBE, name: 'Interno', public: false, active: true });
  });
}

describe('leitura pública', () => {
  beforeEach(() => semear());

  it('1. a vitrine e o patrocinador públicos leem todos; o interno, não', async () => {
    await assertSucceeds(getDoc(x(como(ZE), 'benefits', 'vitrine')));
    await assertFails(getDoc(x(como(ZE), 'benefits', 'interna')));
    await assertSucceeds(getDocs(query(col(como(ZE), 'benefits'), where('public', '==', true))));
    await assertSucceeds(getDoc(x(como(ZE), 'sponsors', 's1')));
    await assertFails(getDoc(x(como(ZE), 'sponsors', 's2')));
    await assertFails(getDocs(col(como(ZE), 'sponsors')));
  });

  it('2. clube não publicado: o visitante não lê nada, a equipe sim', async () => {
    await semear({ publicado: false });
    await assertFails(getDoc(x(como(ZE), 'benefits', 'vitrine')));
    await assertFails(getDoc(x(como(ZE), 'news', 'pub')));
    await assertSucceeds(getDoc(x(como(COM), 'benefits', 'interna')));
  });

  it('3. ⭐ o "como usar" e o código não saem para o associado nem para o visitante', async () => {
    await assertFails(getDoc(x(como(ZE), 'bsec', 'vitrine')));
    await assertFails(getDoc(x(como(MEMBRO), 'bsec', 'vitrine')));
    await assertFails(getDoc(x(como(SEC), 'bsec', 'vitrine')));
    await assertSucceeds(getDoc(x(como(COM), 'bsec', 'vitrine')));
    await assertSucceeds(getDoc(x(como(PRES), 'bsec', 'vitrine')));
  });

  it('4. a secretaria enxerga todas as vantagens (para conferir), mas não o segredo', async () => {
    await assertSucceeds(getDocs(col(como(SEC), 'benefits')));
  });

  it('4b. a comunicação lê todos os planos (o formulário da vantagem escolhe entre eles), mas não os grava', async () => {
    await semRegras((db) => setDoc(x(db, 'plans', 'interno'), { club_id: CLUBE, name: 'Interno', price_cents: 0, public: false, active: true }));
    await assertSucceeds(getDocs(col(como(COM), 'plans')));
    await assertFails(getDocs(col(como(ZE), 'plans')));
    await assertFails(setDoc(x(como(COM), 'plans', 'novo'), { club_id: CLUBE, name: 'Novo', price_cents: 0 }));
  });
});

describe('comunicados', () => {
  beforeEach(() => semear());

  it('5. o público lê o publicado e público; o "só associados" exige ser membro do clube', async () => {
    await assertSucceeds(getDoc(x(como(ZE), 'news', 'pub')));
    await assertFails(getDoc(x(como(ZE), 'news', 'assoc')));
    await assertSucceeds(getDoc(x(como(MEMBRO), 'news', 'assoc')));
    await assertSucceeds(getDocs(query(col(como(ZE), 'news'), where('public', '==', true))));
  });

  it('6. o membro consulta pelo estado publicado; o rascunho nunca sai', async () => {
    await assertSucceeds(getDocs(query(col(como(MEMBRO), 'news'), where('status', '==', 'published'), where('audience', '==', 'members'))));
    await assertFails(getDocs(query(col(como(MEMBRO), 'news'), where('status', '==', 'published')))); // sem o público, a regra não prova
    await assertFails(getDoc(x(como(MEMBRO), 'news', 'rascunho')));
    await assertFails(getDocs(col(como(MEMBRO), 'news')));
    await assertSucceeds(getDoc(x(como(COM), 'news', 'rascunho')));
  });
});

describe('escrita', () => {
  beforeEach(() => semear());

  it('7. a comunicação e a administração gravam vantagem, segredo, comunicado e patrocinador', async () => {
    for (const quem of [COM, PRES]) {
      await assertSucceeds(setDoc(x(como(quem), 'benefits', `b-${quem}`), { club_id: CLUBE, title: 'Nova', public: true }));
      await assertSucceeds(setDoc(x(como(quem), 'bsec', `b-${quem}`), { code: 'X' }));
      await assertSucceeds(setDoc(x(como(quem), 'news', `n-${quem}`), { club_id: CLUBE, title: 'Aviso', status: 'draft' }));
      await assertSucceeds(setDoc(x(como(quem), 'sponsors', `s-${quem}`), { club_id: CLUBE, name: 'Apoio', public: true }));
    }
    await assertSucceeds(updateDoc(x(como(COM), 'benefits', 'vitrine'), { title: 'Café com 15%' }));
    await assertSucceeds(deleteDoc(x(como(COM), 'news', 'rascunho')));
    await assertSucceeds(deleteDoc(x(como(COM), 'sponsors', 's2')));
  });

  it('8. a secretaria, o associado e o estranho não gravam', async () => {
    for (const quem of [SEC, MEMBRO, ZE]) {
      await assertFails(setDoc(x(como(quem), 'benefits', `b-${quem}`), { club_id: CLUBE, title: 'Nova', public: true }));
      await assertFails(setDoc(x(como(quem), 'news', `n-${quem}`), { club_id: CLUBE, title: 'Aviso', status: 'published' }));
      await assertFails(setDoc(x(como(quem), 'sponsors', `s-${quem}`), { club_id: CLUBE, name: 'Apoio', public: true }));
    }
    await assertFails(updateDoc(x(como(SEC), 'benefits', 'vitrine'), { title: 'Trocado' }));
    await assertFails(deleteDoc(x(como(MEMBRO), 'sponsors', 's1')));
  });

  it('9. sem a flag ninguém grava, mas a leitura pública segue', async () => {
    await semear({ flag: false });
    await assertFails(setDoc(x(como(COM), 'benefits', 'novo'), { club_id: CLUBE, title: 'Nova' }));
    await assertFails(updateDoc(x(como(PRES), 'news', 'pub'), { title: 'Outro' }));
    await assertSucceeds(getDoc(x(como(ZE), 'benefits', 'vitrine')));
  });

  it('10. a notificação feita pelo servidor não é do navegador: `notified_at` só o Admin SDK escreve — a comunicação não consegue forjar outra espécie', async () => {
    // O navegador só grava as espécies da tabela: outra (ex.: cobrança) segue fechada.
    await assertFails(setDoc(x(como(COM), 'charges', 'c9'), { club_id: CLUBE, user_id: COM, status: 'paid' }));
    await assertFails(setDoc(x(como(COM), 'aff', COM), { club_id: CLUBE, user_id: COM, status: 'active' }));
  });
});
