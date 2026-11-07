/**
 * Regras do controle de linhas nas QUADRAS de torneio (docs/53 §9):
 * `tournament_line_courts/{torneio}_{quadra}` + `line_cams`/`line_calls`.
 *
 * Prova, com contas que NÃO são admin, que só a equipe do torneio (criador,
 * administrador do torneio, gestor da arena sede) liga a quadra e vira câmera;
 * qualquer conta logada acompanha.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const CRIADOR = 'criador_uid';
const ADMIN_T = 'admin_torneio_uid';
const GESTOR = 'gestor_arena_uid';
const ATLETA = 'atleta_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-linhas-torneio-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'tournaments', 'T1'), { name: 'Aberto', creator_uid: CRIADOR, arena_id: 'A1' });
    await setDoc(doc(db, 'tournament_admins', `T1_${ADMIN_T}`), { tournament_id: 'T1', user_id: ADMIN_T });
    await setDoc(doc(db, 'arenas', 'A1'), { name: 'Arena', owner_uid: GESTOR, manager_uids: [GESTOR] });
    await setDoc(doc(db, 'tournament_line_courts', 'T1_court-2'), { tournament_id: 'T1', court_id: 'court-2', court_name: 'Quadra 2', line_control: true, updated_by: CRIADOR });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const quadra = (uid, court = 'court-1') => ({ tournament_id: 'T1', court_id: court, court_name: 'Quadra 1', line_control: true, updated_by: uid, updated_at: serverTimestamp() });
const cam = (uid) => ({ uid, name: 'X', position: 'fundo_a', layout: 'solo_fundo', calibrated: true, analyzing: false, fps: 60, seen_ms: 1 });

describe('a quadra do torneio', () => {
  it('⭐ o criador e o administrador do torneio ligam a quadra', async () => {
    await assertSucceeds(setDoc(doc(como(CRIADOR), 'tournament_line_courts', 'T1_court-1'), quadra(CRIADOR)));
    await assertSucceeds(updateDoc(doc(como(ADMIN_T), 'tournament_line_courts', 'T1_court-2'), { line_control: false, updated_by: ADMIN_T, updated_at: serverTimestamp() }));
  });

  it('quem joga não liga, e o id tem de casar com o torneio e a quadra', async () => {
    await assertFails(setDoc(doc(como(ATLETA), 'tournament_line_courts', 'T1_court-1'), quadra(ATLETA)));
    await assertFails(setDoc(doc(como(CRIADOR), 'tournament_line_courts', 'T1_court-9'), quadra(CRIADOR)));
    await assertFails(updateDoc(doc(como(CRIADOR), 'tournament_line_courts', 'T1_court-2'), { tournament_id: 'T2', updated_by: CRIADOR }));
  });

  it('qualquer conta logada lê as quadras', async () => {
    await assertSucceeds(getDocs(collection(como(ATLETA), 'tournament_line_courts')));
  });
});

describe('câmeras e marcações na quadra', () => {
  const camRef = (uid) => doc(como(uid), 'tournament_line_courts/T1_court-2/line_cams', `${uid}_fundo_a`);

  it('⭐ a equipe do torneio vira câmera e grava marcação', async () => {
    await assertSucceeds(setDoc(camRef(CRIADOR), cam(CRIADOR)));
    await assertSucceeds(setDoc(camRef(ADMIN_T), cam(ADMIN_T)));
    await assertSucceeds(addDoc(collection(como(ADMIN_T), 'tournament_line_courts/T1_court-2/line_calls'),
      { uid: ADMIN_T, position: 'fundo_a', kind: 'bounce', call: 'out', t_ms: 2, margin_m: -0.1, uncertainty_m: 0.03, x: 3, y: 13.5 }));
    // as outras faltas de linha, com o motivo
    await assertSucceeds(addDoc(collection(como(ADMIN_T), 'tournament_line_courts/T1_court-2/line_calls'),
      { uid: ADMIN_T, position: 'fundo_a', kind: 'serve_foot', call: 'fault', reason: 'baseline', serve: true, t_ms: 3, x: 3, y: -0.2 }));
  });

  it('quem joga acompanha, mas não vira câmera', async () => {
    await assertFails(setDoc(camRef(ATLETA), cam(ATLETA)));
    await assertSucceeds(getDocs(collection(como(ATLETA), 'tournament_line_courts/T1_court-2/line_calls')));
  });

  it('com a quadra desligada ninguém vira câmera', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'tournament_line_courts', 'T1_court-2'), { line_control: false });
    });
    await assertFails(setDoc(camRef(CRIADOR), cam(CRIADOR)));
  });
});

describe('o convite da câmera sem conta (QR, docs/53 §5c)', () => {
  const ref = (uid) => doc(como(uid), `tournament_line_courts/T1_court-2/line_invites/${'b'.repeat(64)}`);
  const inv = () => ({ position: 'rede_1', exp_ms: Date.now() + 3600000, created_at: serverTimestamp() });

  it('⭐ a equipe do torneio gera e lê o convite; quem joga, não', async () => {
    await assertSucceeds(setDoc(ref(CRIADOR), inv()));
    await assertSucceeds(getDocs(collection(como(ADMIN_T), 'tournament_line_courts/T1_court-2/line_invites')));
    await assertFails(setDoc(ref(ATLETA), inv()));
    await assertFails(getDocs(collection(como(ATLETA), 'tournament_line_courts/T1_court-2/line_invites')));
  });
});
