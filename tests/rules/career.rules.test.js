/**
 * Regras da MINHA CARREIRA (docs/54): `career_events/{uid}_{id}`.
 *
 * Prova, com contas que NÃO são admin, que:
 *  - o dono lê e escreve só o seu; outra conta não lê nem escreve;
 *  - com a flag `athlete_career` desligada, criar e editar são recusados,
 *    mas APAGAR o próprio dado continua valendo (LGPD);
 *  - id com o prefixo de outra pessoa e troca de `uid` são recusados.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const DONO = 'dono_uid';
const OUTRO = 'outro_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-carreira-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const flag = (on) => testEnv.withSecurityRulesDisabled((ctx) =>
  setDoc(doc(ctx.firestore(), 'platform_settings', 'global'), { feature_flags: { athlete_career: on } }));

beforeEach(async () => {
  await testEnv.clearFirestore();
  await flag(true);
  await testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'career_events', `${DONO}_a`), { uid: DONO, name: 'Open de Floripa', status: 'played', start_date: '2025-05-10' }));
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const evento = (uid, extra = {}) => ({ uid, name: 'Etapa 500', status: 'played', start_date: '2025-06-01', entries: [], ...extra });

describe('career_events', () => {
  it('⭐ o dono cria, lê, consulta por uid, edita e apaga o seu', async () => {
    await assertSucceeds(setDoc(doc(como(DONO), 'career_events', `${DONO}_b`), evento(DONO)));
    await assertSucceeds(getDoc(doc(como(DONO), 'career_events', `${DONO}_a`)));
    await assertSucceeds(getDocs(query(collection(como(DONO), 'career_events'), where('uid', '==', DONO))));
    await assertSucceeds(updateDoc(doc(como(DONO), 'career_events', `${DONO}_a`), { name: 'Open de Floripa 2025' }));
    await assertSucceeds(deleteDoc(doc(como(DONO), 'career_events', `${DONO}_a`)));
  });

  it('🔴 outra conta não lê, não consulta, não edita nem apaga', async () => {
    await assertFails(getDoc(doc(como(OUTRO), 'career_events', `${DONO}_a`)));
    await assertFails(getDocs(query(collection(como(OUTRO), 'career_events'), where('uid', '==', DONO))));
    await assertFails(updateDoc(doc(como(OUTRO), 'career_events', `${DONO}_a`), { name: 'x' }));
    await assertFails(deleteDoc(doc(como(OUTRO), 'career_events', `${DONO}_a`)));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'career_events', `${DONO}_a`)));
  });

  it('🔴 id com o prefixo de outra pessoa é recusado, mesmo com o próprio uid', async () => {
    await assertFails(setDoc(doc(como(OUTRO), 'career_events', `${DONO}_c`), evento(OUTRO)));
    await assertFails(setDoc(doc(como(OUTRO), 'career_events', `${DONO}_c`), evento(DONO)));
    await assertFails(setDoc(doc(como(DONO), 'career_events', 'semprefixo'), evento(DONO)));
  });

  it('🔴 o uid não muda', async () => {
    await assertFails(updateDoc(doc(como(DONO), 'career_events', `${DONO}_a`), { uid: OUTRO }));
  });

  it('⭐ flag desligada: recusa criar e editar, mas deixa apagar (LGPD)', async () => {
    await flag(false);
    await assertFails(setDoc(doc(como(DONO), 'career_events', `${DONO}_b`), evento(DONO)));
    await assertFails(updateDoc(doc(como(DONO), 'career_events', `${DONO}_a`), { name: 'outro' }));
    await assertSucceeds(getDoc(doc(como(DONO), 'career_events', `${DONO}_a`)));
    await assertSucceeds(deleteDoc(doc(como(DONO), 'career_events', `${DONO}_a`)));
  });

  it('flag ausente vale desligada', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'platform_settings', 'global')));
    await assertFails(setDoc(doc(como(DONO), 'career_events', `${DONO}_b`), evento(DONO)));
  });
});

/* ------------------------------------------------- career_partner -- */

const DUPLA = 'dupla_uid';
const MENOR = 'menor_uid';
const PEDIDO = `${DONO}_a__${DUPLA}`;
const pedido = (extra = {}) => ({
  owner_uid: DONO, partner_uid: DUPLA, event_id: `${DONO}_a`, status: 'confirmed',
  feedback: { strengths: ['dink'], improve: ['devolucao'], text_improve: 'Devolver mais fundo.' }, ...extra,
});

describe('career_partner (só o servidor grava)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'career_partner', PEDIDO), pedido());
      await setDoc(doc(ctx.firestore(), 'career_partner', `${DONO}_a__${MENOR}`), pedido({ partner_uid: MENOR, status: 'invited', feedback: null }));
    });
  });

  it('⭐ o dono e a dupla citada leem e consultam pelo próprio lado', async () => {
    await assertSucceeds(getDoc(doc(como(DONO), 'career_partner', PEDIDO)));
    await assertSucceeds(getDoc(doc(como(DUPLA), 'career_partner', PEDIDO)));
    await assertSucceeds(getDocs(query(collection(como(DONO), 'career_partner'), where('owner_uid', '==', DONO))));
    await assertSucceeds(getDocs(query(collection(como(DUPLA), 'career_partner'), where('partner_uid', '==', DUPLA))));
  });

  it('🔴 terceiro não lê nem consulta (a crítica fica entre os dois); sem conta também não', async () => {
    await assertFails(getDoc(doc(como(OUTRO), 'career_partner', PEDIDO)));
    await assertFails(getDocs(query(collection(como(OUTRO), 'career_partner'), where('owner_uid', '==', DONO))));
    await assertFails(getDocs(query(collection(como(DUPLA), 'career_partner'), where('owner_uid', '==', DONO))));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'career_partner', PEDIDO)));
  });

  it('🔴 ninguém grava pelo cliente: nem o dono, nem a dupla, nem o menor, nem um terceiro', async () => {
    await assertFails(updateDoc(doc(como(DUPLA), 'career_partner', PEDIDO), { status: 'declined', feedback: null }));
    await assertFails(updateDoc(doc(como(DONO), 'career_partner', PEDIDO), { owner_decision: 'use' }));
    await assertFails(deleteDoc(doc(como(DONO), 'career_partner', PEDIDO)));
    await assertFails(setDoc(doc(como(DONO), 'career_partner', `${DONO}_a__${OUTRO}`), pedido({ partner_uid: OUTRO })));
    await assertFails(setDoc(doc(como(OUTRO), 'career_partner', `${DONO}_a__${OUTRO}`), pedido({ partner_uid: OUTRO })));
    await assertFails(updateDoc(doc(como(MENOR), 'career_partner', `${DONO}_a__${MENOR}`), { status: 'confirmed' }));
  });

  it('o menor citado só lê o próprio pedido; o dos outros, não', async () => {
    await assertSucceeds(getDoc(doc(como(MENOR), 'career_partner', `${DONO}_a__${MENOR}`)));
    await assertFails(getDoc(doc(como(MENOR), 'career_partner', PEDIDO)));
  });

  it('⭐ o registro da dupla com `linked_event` é dela (a regra do evento vale igual); o do dono ela não lê', async () => {
    await assertSucceeds(setDoc(doc(como(DUPLA), 'career_events', `${DUPLA}_m`), evento(DUPLA, { linked_event: { uid: DONO, id: `${DONO}_a` } })));
    await assertFails(getDoc(doc(como(DUPLA), 'career_events', `${DONO}_a`)));
  });
});

/* ----------------------------------------- career_partner_reports -- */

describe('career_partner_reports (a denúncia fica fora do pedido)', () => {
  const REP = `${PEDIDO}__owner`;
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'career_partner_reports', REP), {
      doc_id: PEDIDO, owner_uid: DONO, partner_uid: DUPLA, reporter_uid: DONO, role: 'owner', reason: 'offensive', note: 'nota', open: true,
    }));
  });

  it('⭐ quem denunciou lê e consulta as próprias denúncias', async () => {
    await assertSucceeds(getDoc(doc(como(DONO), 'career_partner_reports', REP)));
    await assertSucceeds(getDocs(query(collection(como(DONO), 'career_partner_reports'), where('reporter_uid', '==', DONO))));
  });

  it('🔴 o denunciado e um terceiro não leem; ninguém grava pelo cliente', async () => {
    await assertFails(getDoc(doc(como(DUPLA), 'career_partner_reports', REP)));
    await assertFails(getDocs(query(collection(como(DUPLA), 'career_partner_reports'), where('partner_uid', '==', DUPLA))));
    await assertFails(getDoc(doc(como(OUTRO), 'career_partner_reports', REP)));
    await assertFails(updateDoc(doc(como(DONO), 'career_partner_reports', REP), { open: false }));
    await assertFails(deleteDoc(doc(como(DONO), 'career_partner_reports', REP)));
    await assertFails(setDoc(doc(como(DUPLA), 'career_partner_reports', `${PEDIDO}__partner`), { reporter_uid: DUPLA, open: true }));
  });
});
