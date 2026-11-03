/**
 * Regras do CONTROLE DE LINHAS com várias câmeras (docs/53): as subcoleções
 * `line_cams` e `line_calls` do dia de jogo.
 *
 * Prova, com contas que NÃO são admin, que:
 *  - quem participa do jogo (ou organiza) põe a SUA câmera no ar e grava
 *    marcações, só com o controle ligado naquele jogo;
 *  - quem só enxerga o dia (público) lê a central, mas não vira câmera;
 *  - ninguém grava em nome de outro, nem muda marcação; quem organiza limpa.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDocs, setDoc, updateDoc,
} from 'firebase/firestore';

const DONO = 'dono_uid';
const ATLETA = 'atleta_uid';
const ESTRANHO = 'estranho_uid';

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
    const base = { visibility: 'public', created_by: DONO, member_uids: [DONO, ATLETA], format: 'play', title: 'Racha' };
    await setDoc(doc(db, 'game_days', 'ligado'), { ...base, line_control: true });
    await setDoc(doc(db, 'game_days', 'desligado'), base);
    await setDoc(doc(db, 'game_days', 'ligado', 'line_calls', 'c0'), { uid: ATLETA, position: 'fundo_a', kind: 'bounce', call: 'in', t_ms: 1 });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const cam = (uid, position = 'fundo_a') => ({ uid, name: 'X', position, layout: 'solo_fundo', calibrated: true, analyzing: false, fps: 60, seen_ms: 1 });
const call = (uid) => ({ uid, position: 'fundo_a', kind: 'bounce', call: 'out', t_ms: 2, margin_m: -0.1, uncertainty_m: 0.03, x: 3, y: 13.5 });

describe('a câmera no ar', () => {
  it('⭐ quem participa põe a própria câmera, com o id da posição', async () => {
    await assertSucceeds(setDoc(doc(como(ATLETA), 'game_days/ligado/line_cams', `${ATLETA}_fundo_a`), cam(ATLETA)));
    await assertSucceeds(setDoc(doc(como(DONO), 'game_days/ligado/line_cams', `${DONO}_rede_1`), cam(DONO, 'rede_1')));
  });

  it('não com o controle desligado, nem em nome de outro, nem com id trocado', async () => {
    await assertFails(setDoc(doc(como(ATLETA), 'game_days/desligado/line_cams', `${ATLETA}_fundo_a`), cam(ATLETA)));
    await assertFails(setDoc(doc(como(ATLETA), 'game_days/ligado/line_cams', `${DONO}_fundo_a`), cam(DONO)));
    await assertFails(setDoc(doc(como(ATLETA), 'game_days/ligado/line_cams', `${ATLETA}_topo`), cam(ATLETA)));
    await assertFails(setDoc(doc(como(ATLETA), 'game_days/ligado/line_cams', `${ATLETA}_fundo_a`), { ...cam(ATLETA), video: 'x' }));
  });

  it('quem só enxerga o dia público lê, mas não vira câmera', async () => {
    await assertSucceeds(getDocs(collection(como(ESTRANHO), 'game_days/ligado/line_cams')));
    await assertFails(setDoc(doc(como(ESTRANHO), 'game_days/ligado/line_cams', `${ESTRANHO}_fundo_a`), cam(ESTRANHO)));
  });

  it('cada um tira a própria câmera; quem organiza tira qualquer uma', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'game_days/ligado/line_cams', `${ATLETA}_fundo_a`), cam(ATLETA));
    });
    await assertFails(deleteDoc(doc(como(ESTRANHO), 'game_days/ligado/line_cams', `${ATLETA}_fundo_a`)));
    await assertSucceeds(deleteDoc(doc(como(DONO), 'game_days/ligado/line_cams', `${ATLETA}_fundo_a`)));
  });
});

describe('as marcações', () => {
  it('⭐ quem participa grava a própria marcação; quem enxerga o dia lê', async () => {
    await assertSucceeds(addDoc(collection(como(ATLETA), 'game_days/ligado/line_calls'), call(ATLETA)));
    await assertSucceeds(getDocs(collection(como(ESTRANHO), 'game_days/ligado/line_calls')));
  });

  it('não desligado, não em nome de outro, não estranho, não com veredito inventado', async () => {
    await assertFails(addDoc(collection(como(ATLETA), 'game_days/desligado/line_calls'), call(ATLETA)));
    await assertFails(addDoc(collection(como(ATLETA), 'game_days/ligado/line_calls'), call(DONO)));
    await assertFails(addDoc(collection(como(ESTRANHO), 'game_days/ligado/line_calls'), call(ESTRANHO)));
    await assertFails(addDoc(collection(como(ATLETA), 'game_days/ligado/line_calls'), { ...call(ATLETA), call: 'ponto' }));
  });

  it('marcação não se edita; só quem organiza apaga', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'game_days/ligado/line_calls/c0'), { call: 'out' }));
    await assertFails(deleteDoc(doc(como(ATLETA), 'game_days/ligado/line_calls/c0')));
    await assertSucceeds(deleteDoc(doc(como(DONO), 'game_days/ligado/line_calls/c0')));
  });
});
