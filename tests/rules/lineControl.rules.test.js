/**
 * Regras do CONTROLE DE LINHAS no dia de jogo (docs/53): QUADRA POR QUADRA.
 * `game_days/{id}/line_courts/court-N` liga/desliga e guarda o arranjo de
 * cada quadra; embaixo, `line_cams` e `line_calls` daquela quadra.
 *
 * Prova, com contas que NÃO são admin, que:
 *  - quem organiza o dia (criador e administrador nomeado) liga e escolhe o
 *    arranjo de cada quadra; quem participa ou só vê, não;
 *  - quem participa (ou organiza) põe a SUA câmera no ar e grava marcações,
 *    só na quadra com o controle ligado;
 *  - quem só enxerga o dia (público) lê a central, mas não vira câmera;
 *  - ninguém grava em nome de outro, nem muda marcação; quem organiza decide
 *    e limpa;
 *  - o caminho antigo (câmeras no próprio dia) não grava mais.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDocs, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';

const DONO = 'dono_uid';
const ATLETA = 'atleta_uid';
const NOMEADO = 'nomeado_uid';
const ESTRANHO = 'estranho_uid';
const Q1 = 'game_days/dia/line_courts/court-1';
const Q2 = 'game_days/dia/line_courts/court-2';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-linhas-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'game_days', 'dia'), {
      visibility: 'public', created_by: DONO, member_uids: [DONO, ATLETA], admin_uids: [NOMEADO], format: 'play', title: 'Racha',
    });
    await setDoc(doc(db, Q1), { line_control: true, line_control_layout: 'fundo_rede', updated_by: DONO });
    await setDoc(doc(db, Q2), { line_control: false, updated_by: DONO });
    await setDoc(doc(db, `${Q1}/line_calls/c0`), { uid: ATLETA, position: 'fundo_a', kind: 'bounce', call: 'in', t_ms: 1 });
    await setDoc(doc(db, `${Q1}/line_calls/p0`), { uid: ATLETA, position: 'fundo_a', kind: 'serve_foot', call: 'review', t_ms: 1 });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const cfg = (uid, extra = {}) => ({ line_control: true, line_control_layout: 'fundos_redes', updated_by: uid, updated_at: serverTimestamp(), ...extra });
const cam = (uid, position = 'fundo_a') => ({ uid, name: 'X', position, layout: 'solo_fundo', calibrated: true, analyzing: false, fps: 60, seen_ms: 1 });
const call = (uid, extra = {}) => ({ uid, position: 'fundo_a', kind: 'bounce', call: 'out', reason: 'long', t_ms: 2, margin_m: -0.1, uncertainty_m: 0.03, x: 3, y: 13.5, ...extra });

describe('quem liga e configura cada quadra (pedido do dono, 2026-11-03)', () => {
  it('⭐ o criador e o administrador nomeado ligam a quadra e escolhem o arranjo dela', async () => {
    await assertSucceeds(setDoc(doc(como(DONO), 'game_days/dia/line_courts/court-3'), cfg(DONO)));
    await assertSucceeds(setDoc(doc(como(NOMEADO), Q2), cfg(NOMEADO, { line_control_layout: 'solo_rede' })));
    await assertSucceeds(updateDoc(doc(como(NOMEADO), Q1), { line_control: false, updated_by: NOMEADO }));
  });

  it('o participante e quem só vê o dia não ligam nem trocam o arranjo', async () => {
    await assertFails(setDoc(doc(como(ATLETA), Q2), cfg(ATLETA)));
    await assertFails(setDoc(doc(como(ESTRANHO), 'game_days/dia/line_courts/court-3'), cfg(ESTRANHO)));
    await assertFails(deleteDoc(doc(como(ATLETA), Q1)));
  });

  it('só o formato da quadra: id court-N, em nome próprio, sem chave a mais', async () => {
    await assertFails(setDoc(doc(como(DONO), 'game_days/dia/line_courts/quadra-1'), cfg(DONO)));
    await assertFails(setDoc(doc(como(DONO), Q2), cfg(NOMEADO)));
    await assertFails(setDoc(doc(como(DONO), Q2), cfg(DONO, { line_control: 'sim' })));
    await assertFails(setDoc(doc(como(DONO), Q2), cfg(DONO, { video: 'x' })));
  });

  it('quem enxerga o dia lê a configuração das quadras', async () => {
    await assertSucceeds(getDocs(collection(como(ESTRANHO), 'game_days/dia/line_courts')));
  });

  it('o caminho antigo, no próprio dia, não grava mais', async () => {
    await assertFails(updateDoc(doc(como(NOMEADO), 'game_days/dia'), { line_control: true }));
    await assertFails(setDoc(doc(como(ATLETA), 'game_days/dia/line_cams', `${ATLETA}_fundo_a`), cam(ATLETA)));
    await assertFails(addDoc(collection(como(ATLETA), 'game_days/dia/line_calls'), call(ATLETA)));
  });
});

describe('a câmera no ar', () => {
  it('⭐ quem participa põe a própria câmera na quadra ligada, com o id da posição', async () => {
    await assertSucceeds(setDoc(doc(como(ATLETA), `${Q1}/line_cams`, `${ATLETA}_fundo_a`), cam(ATLETA)));
    await assertSucceeds(setDoc(doc(como(DONO), `${Q1}/line_cams`, `${DONO}_rede_1`), cam(DONO, 'rede_1')));
    await assertSucceeds(setDoc(doc(como(NOMEADO), `${Q1}/line_cams`, `${NOMEADO}_topo`), cam(NOMEADO, 'topo')));
  });

  it('não na quadra desligada ou sem configuração, nem em nome de outro, nem com id trocado', async () => {
    await assertFails(setDoc(doc(como(ATLETA), `${Q2}/line_cams`, `${ATLETA}_fundo_a`), cam(ATLETA)));
    await assertFails(setDoc(doc(como(ATLETA), 'game_days/dia/line_courts/court-9/line_cams', `${ATLETA}_fundo_a`), cam(ATLETA)));
    await assertFails(setDoc(doc(como(ATLETA), `${Q1}/line_cams`, `${DONO}_fundo_a`), cam(DONO)));
    await assertFails(setDoc(doc(como(ATLETA), `${Q1}/line_cams`, `${ATLETA}_topo`), cam(ATLETA)));
    await assertFails(setDoc(doc(como(ATLETA), `${Q1}/line_cams`, `${ATLETA}_fundo_a`), { ...cam(ATLETA), video: 'x' }));
  });

  it('quem só enxerga o dia público lê, mas não vira câmera', async () => {
    await assertSucceeds(getDocs(collection(como(ESTRANHO), `${Q1}/line_cams`)));
    await assertFails(setDoc(doc(como(ESTRANHO), `${Q1}/line_cams`, `${ESTRANHO}_fundo_a`), cam(ESTRANHO)));
  });

  it('cada um tira a própria câmera; quem organiza tira qualquer uma', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${Q1}/line_cams`, `${ATLETA}_fundo_a`), cam(ATLETA));
    });
    await assertFails(deleteDoc(doc(como(ESTRANHO), `${Q1}/line_cams`, `${ATLETA}_fundo_a`)));
    await assertSucceeds(deleteDoc(doc(como(DONO), `${Q1}/line_cams`, `${ATLETA}_fundo_a`)));
  });

  it('a saúde da câmera entra', async () => {
    await assertSucceeds(setDoc(doc(como(ATLETA), `${Q1}/line_cams`, `${ATLETA}_fundo_a`),
      { ...cam(ATLETA), battery: 40, charging: false, check_cm: 2.1 }));
  });
});

describe('as marcações', () => {
  it('⭐ quem participa grava a própria marcação na quadra ligada; quem enxerga o dia lê', async () => {
    await assertSucceeds(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA)));
    await assertSucceeds(getDocs(collection(como(ESTRANHO), `${Q1}/line_calls`)));
  });

  it('⭐ todas as faltas de linha: pé no saque e dois quiques, com o motivo', async () => {
    await assertSucceeds(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA, { kind: 'serve_foot', call: 'fault', reason: 'centerline', serve: true })));
    await assertSucceeds(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA, { kind: 'two_bounce', call: 'fault', reason: 'return' })));
    await assertSucceeds(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA, { kind: 'volley', call: 'fault', reason: 'momentum', depth_m: 0.04 })));
  });

  it('não desligada, não em nome de outro, não estranho, não com tipo, veredito ou motivo inventado', async () => {
    await assertFails(addDoc(collection(como(ATLETA), `${Q2}/line_calls`), call(ATLETA)));
    await assertFails(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(DONO)));
    await assertFails(addDoc(collection(como(ESTRANHO), `${Q1}/line_calls`), call(ESTRANHO)));
    await assertFails(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA, { call: 'ponto' })));
    await assertFails(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA, { kind: 'golpe' })));
    await assertFails(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA, { reason: 'um motivo comprido demais' })));
    await assertFails(addDoc(collection(como(ATLETA), `${Q1}/line_calls`), call(ATLETA, { image: 'data:' })));
  });

  it('marcação não se edita; só quem organiza apaga', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), `${Q1}/line_calls/c0`), { call: 'out' }));
    await assertFails(deleteDoc(doc(como(ATLETA), `${Q1}/line_calls/c0`)));
    await assertSucceeds(deleteDoc(doc(como(DONO), `${Q1}/line_calls/c0`)));
  });

  it('⭐ quem organiza dá a palavra final num lance — só a decisão, em nome próprio', async () => {
    const dec = (uid, decision = 'out') => ({ decision, decided_by: uid, decided_ms: 5 });
    await assertSucceeds(updateDoc(doc(como(DONO), `${Q1}/line_calls/c0`), dec(DONO)));
    await assertSucceeds(updateDoc(doc(como(NOMEADO), `${Q1}/line_calls/p0`), dec(NOMEADO, 'fault')));
    // quem só participa não decide; ninguém decide em nome de outro
    await assertFails(updateDoc(doc(como(ATLETA), `${Q1}/line_calls/c0`), dec(ATLETA, 'in')));
    await assertFails(updateDoc(doc(como(DONO), `${Q1}/line_calls/c0`), dec(ATLETA)));
    // decisão que não cabe no tipo do lance, ou mexer no que a câmera marcou
    await assertFails(updateDoc(doc(como(DONO), `${Q1}/line_calls/c0`), dec(DONO, 'fault')));
    await assertFails(updateDoc(doc(como(DONO), `${Q1}/line_calls/p0`), dec(DONO, 'out')));
    await assertFails(updateDoc(doc(como(DONO), `${Q1}/line_calls/c0`), { ...dec(DONO, 'in'), call: 'out' }));
  });
});

describe('o convite da câmera sem conta (QR, docs/53 §5c)', () => {
  const H = 'a'.repeat(64);
  const inv = (extra = {}) => ({ position: 'fundo_a', exp_ms: Date.now() + 3600000, created_at: serverTimestamp(), ...extra });
  const ref = (uid, id = H) => doc(como(uid), `${Q1}/line_invites/${id}`);

  it('⭐ quem organiza (o nomeado também) gera, lê e apaga o convite', async () => {
    await assertSucceeds(setDoc(ref(NOMEADO), inv()));
    await assertSucceeds(getDocs(collection(como(DONO), `${Q1}/line_invites`)));
    await assertSucceeds(deleteDoc(ref(DONO)));
  });

  it('🔴 quem participa ou só vê não gera nem lê', async () => {
    await assertFails(setDoc(ref(ATLETA), inv()));
    await assertFails(getDocs(collection(como(ESTRANHO), `${Q1}/line_invites`)));
  });

  it('🔴 validade de no máximo 12 h, id de hash, sem chave a mais', async () => {
    await assertFails(setDoc(ref(DONO), inv({ exp_ms: Date.now() + 13 * 3600000 })));
    await assertFails(setDoc(ref(DONO), inv({ exp_ms: Date.now() - 1000 })));
    await assertFails(setDoc(ref(DONO, 'token-cru'), inv()));
    await assertFails(setDoc(ref(DONO), inv({ token: 'x' })));
  });
});
