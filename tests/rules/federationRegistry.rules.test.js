/**
 * Regras das FEDERAÇÕES — Etapa 3 (2026-10-22): a PASTA do filiado na Central
 * e o comprovante do "Já paguei".
 *
 *  1. ⭐ o pagador anexa o comprovante: só arquivo da PRÓPRIA pasta, só com os
 *     campos do comprovante; de outra pasta ou com campo a mais, recusado;
 *  2. ⭐ as leituras da pasta são as consultas que a regra prova: cobranças
 *     por federação + filiação (secretaria e financeiro, não a arbitragem);
 *     sanções (disciplina, não a secretaria); cursos e credenciais (cursos);
 *     escalas e quadro de arbitragem por federação + pessoa (arbitragem);
 *     pontos (públicos); pessoas do clube e gestores da arena (conta logada).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const SEC = 'sec1';
const TES = 'tes1';
const REF = 'ref1';
const DISC = 'disc1';
const ANA = 'ana1';
const BIA = 'bia1';
const FED = 'fedA';
const MID = `${FED}_${ANA}`;

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fedregistry-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const consulta = (uid, col, ...filtros) => getDocs(query(collection(como(uid), col), ...filtros.map(([c, v]) => where(c, '==', v))));

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { courses: true, referees: true, discipline: true, ranking: true } });
    const equipe = { [PRES]: 'president', [SEC]: 'secretary', [TES]: 'treasurer', [REF]: 'referees', [DISC]: 'discipline' };
    await Promise.all(Object.entries(equipe).map(([uid, role]) => setDoc(doc(db, 'federation_staff', `${FED}_${uid}`), { federation_id: FED, user_id: uid, role })));
    await setDoc(doc(db, 'federation_members', MID), { federation_id: FED, user_id: ANA, user_name: 'Ana', status: 'active' });
    await setDoc(doc(db, 'federation_charges', 'c1'), { federation_id: FED, member_id: MID, payer_uid: ANA, status: 'open', amount_cents: 12000 });
    await setDoc(doc(db, 'federation_sanctions', 's1'), { federation_id: FED, member_id: MID, user_id: ANA, status: 'active' });
    await setDoc(doc(db, 'federation_course_enrollments', 'k1_ana1'), { federation_id: FED, course_id: 'k1', user_id: ANA, status: 'approved' });
    await setDoc(doc(db, 'federation_credentials', 'cr1'), { federation_id: FED, user_id: ANA, status: 'active', public: false });
    await setDoc(doc(db, 'federation_referees', `${FED}_${ANA}`), { federation_id: FED, user_id: ANA, level: 'regional' });
    await setDoc(doc(db, 'federation_assignments', 'a1'), { federation_id: FED, referee_uid: ANA, status: 'confirmed' });
    await setDoc(doc(db, 'federation_points', `r1_${ANA}`), { federation_id: FED, uid: ANA, season: 2026, points: 100 });
    await setDoc(doc(db, 'club_members', `c1_${ANA}`), { club_id: 'c1', user_id: ANA, user_name: 'Ana', role: 'member' });
    await setDoc(doc(db, 'arena_managers', `a1_${BIA}`), { arena_id: 'a1', user_id: BIA, user_name: 'Bia', role: 'owner' });
  });
});

describe('comprovante do "Já paguei"', () => {
  const prova = (uid, extra = {}) => ({ path: `federacao/${uid}/pix123.pdf`, name: 'pix.pdf', content_type: 'application/pdf', size: 1200, ...extra });
  it('o pagador anexa um arquivo da própria pasta', async () => {
    await assertSucceeds(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', declared_note: 'Pix feito', declared_proof: prova(ANA) }));
    // Informar de novo sem mexer no comprovante segue valendo.
    await assertSucceeds(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', declared_note: 'Pix às 10h' }));
  });
  it('arquivo de outra pasta, extensão estranha ou campo a mais é recusado', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', declared_proof: prova(BIA) }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', declared_proof: prova(ANA, { path: `federacao/${ANA}/pix.exe` }) }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', declared_proof: prova(ANA, { confirmed: true }) }));
    await assertFails(updateDoc(doc(como(ANA), 'federation_charges', 'c1'), { status: 'declared', declared_proof: 'federacao/ana1/x.pdf' }));
    await assertFails(updateDoc(doc(como(BIA), 'federation_charges', 'c1'), { status: 'declared', declared_proof: prova(BIA) }));
  });
});

describe('as leituras da pasta', () => {
  it('cobranças da filiação: secretaria e financeiro, não a arbitragem', async () => {
    await assertSucceeds(consulta(SEC, 'federation_charges', ['federation_id', FED], ['member_id', MID]));
    await assertSucceeds(consulta(TES, 'federation_charges', ['federation_id', FED], ['member_id', MID]));
    await assertFails(consulta(REF, 'federation_charges', ['federation_id', FED], ['member_id', MID]));
  });
  it('sanções: disciplina e admin, não a secretaria', async () => {
    await assertSucceeds(consulta(DISC, 'federation_sanctions', ['federation_id', FED], ['member_id', MID]));
    await assertSucceeds(consulta(PRES, 'federation_sanctions', ['federation_id', FED], ['member_id', MID]));
    await assertFails(consulta(SEC, 'federation_sanctions', ['federation_id', FED], ['member_id', MID]));
  });
  it('cursos, credenciais, quadro e escalas: a equipe de cursos/arbitragem', async () => {
    await assertSucceeds(consulta(REF, 'federation_course_enrollments', ['federation_id', FED], ['user_id', ANA]));
    await assertSucceeds(consulta(REF, 'federation_credentials', ['federation_id', FED], ['user_id', ANA]));
    await assertSucceeds(consulta(REF, 'federation_referees', ['federation_id', FED], ['user_id', ANA]));
    await assertSucceeds(consulta(REF, 'federation_assignments', ['federation_id', FED], ['referee_uid', ANA]));
    await assertFails(consulta(SEC, 'federation_credentials', ['federation_id', FED], ['user_id', ANA]));
    await assertFails(consulta(SEC, 'federation_assignments', ['federation_id', FED], ['referee_uid', ANA]));
  });
  it('pontos são públicos; pessoas do clube e gestores da arena, para a conta logada', async () => {
    await assertSucceeds(consulta(SEC, 'federation_points', ['federation_id', FED], ['uid', ANA]));
    await assertSucceeds(consulta(SEC, 'club_members', ['club_id', 'c1']));
    await assertSucceeds(consulta(SEC, 'arena_managers', ['arena_id', 'a1']));
  });
});
