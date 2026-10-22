/**
 * Regras das COMPETIÇÕES da federação (Bloco 2, `docs/50` §31):
 *
 *  1. ⭐ o organizador pede a chancela, mas NÃO escreve o que o servidor
 *     confere (diretor verificado, taxa, conferência) — senão bastaria gravar
 *     `director_verified: true` ou `fee_paid_at_ms` para pular a federação;
 *  2. o relatório do torneio lê o diretor, quem organiza e a equipe de
 *     competições/admin — a consulta do diretor (por `director_uid`) é provável;
 *     ninguém grava pelo navegador;
 *  3. o convite da final lê o convidado e competições/admin; ninguém grava;
 *  4. competições lê a cobrança da TAXA DE CHANCELA (aprova depois do
 *     pagamento) — e só ela, nunca a anuidade de um filiado.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PRES = 'pres1';
const COMP = 'comp1';
const TES = 'tes1';
const ORG = 'org1';
const DIR = 'dir1';
const ANA = 'ana1';
const ZE = 'ze1';
const FED = 'fedA';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-competitions-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const pedido = (over = {}) => ({ status: 'pending', federation_acronym: 'FGP', tier: 'regional', requires_membership: false, requested_by: ORG, requested_at_ms: 1, director_code: 'DIR12345', ...over });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', FED), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, created_by: PRES, modules: { tournaments: true, ranking: true } });
    await setDoc(doc(db, 'federation_staff', `${FED}_${PRES}`), { federation_id: FED, user_id: PRES, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${COMP}`), { federation_id: FED, user_id: COMP, role: 'competitions' });
    await setDoc(doc(db, 'federation_staff', `${FED}_${TES}`), { federation_id: FED, user_id: TES, role: 'treasurer' });
    await setDoc(doc(db, 'tournaments', 't1'), { creator_uid: ORG, name: 'Open', status: 'open' });
    await setDoc(doc(db, 'federation_tournament_reports', 't2'), { federation_id: FED, tournament_id: 't2', director_uid: DIR, organizer_uid: ORG, checklist: null, report: null });
    await setDoc(doc(db, 'federation_final_invites', 't2_f_ana1'), { federation_id: FED, tournament_id: 't2', user_id: ANA, status: 'invited', expires_at_ms: 9e15 });
    await setDoc(doc(db, 'federation_charges', 'taxa'), { federation_id: FED, origin: 'sanction', payer_uid: ORG, amount_cents: 15000, status: 'open', tournament_id: 't1' });
    await setDoc(doc(db, 'federation_charges', 'anuidade'), { federation_id: FED, origin: 'membership', payer_uid: ANA, amount_cents: 9000, status: 'open' });
  });
});

describe('o pedido de chancela', () => {
  it('1. o organizador pede; com campo que o servidor confere, é recusado', async () => {
    const t = doc(como(ORG), 'tournaments', 't1');
    for (const campo of [{ director_verified: true }, { director_uid: DIR }, { checked_at_ms: 1 }, { fee_cents: 0 }, { fee_charge_id: 'x' }, { fee_paid_at_ms: 1 }, { fee_cancelled_at_ms: 1 }, { director_name: 'X' }, { days_ahead: 90 }]) {
      // eslint-disable-next-line no-await-in-loop
      await assertFails(updateDoc(t, { federation_id: FED, federation_sanction: pedido(campo) }));
    }
    await assertSucceeds(updateDoc(t, { federation_id: FED, federation_sanction: pedido({ prize: { female_cents: 100000, male_cents: 100000, note: '' } }) }));
    await assertFails(setDoc(doc(como(ORG), 'tournaments', 't9'), { creator_uid: ORG, name: 'T9', federation_id: FED, federation_sanction: pedido({ director_verified: true }) }));
    await assertSucceeds(setDoc(doc(como(ORG), 'tournaments', 't8'), { creator_uid: ORG, name: 'T8', federation_id: FED, federation_sanction: pedido() }));
  });

  it('1b. já conferido pelo servidor, o organizador segue editando o resto do torneio', async () => {
    await semRegras((db) => updateDoc(doc(db, 'tournaments', 't1'), { federation_id: FED, federation_sanction: pedido({ checked_at_ms: 1, director_uid: DIR, director_verified: true, fee_cents: 15000 }) }));
    await assertSucceeds(updateDoc(doc(como(ORG), 'tournaments', 't1'), { name: 'Open de Porto Alegre' }));
  });
});

describe('o relatório do torneio', () => {
  it('2. diretor, organizador e competições/admin leem; os outros não; ninguém grava', async () => {
    await assertSucceeds(getDoc(doc(como(DIR), 'federation_tournament_reports', 't2')));
    await assertSucceeds(getDocs(query(collection(como(DIR), 'federation_tournament_reports'), where('director_uid', '==', DIR))));
    await assertSucceeds(getDoc(doc(como(ORG), 'federation_tournament_reports', 't2')));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_tournament_reports'), where('federation_id', '==', FED))));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_tournament_reports', 't2')));
    await assertFails(getDoc(doc(como(TES), 'federation_tournament_reports', 't2')));
    await assertFails(getDoc(doc(como(ZE), 'federation_tournament_reports', 't2')));
    await assertFails(updateDoc(doc(como(DIR), 'federation_tournament_reports', 't2'), { report: { entrants: 1 } }));
    await assertFails(setDoc(doc(como(COMP), 'federation_tournament_reports', 't3'), { federation_id: FED, director_uid: COMP }));
  });
});

describe('o convite da final', () => {
  it('3. o convidado e competições/admin leem; ninguém grava (responder é do servidor)', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'federation_final_invites'), where('user_id', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_final_invites'), where('federation_id', '==', FED))));
    await assertSucceeds(getDoc(doc(como(PRES), 'federation_final_invites', 't2_f_ana1')));
    await assertFails(getDoc(doc(como(ZE), 'federation_final_invites', 't2_f_ana1')));
    await assertFails(getDoc(doc(como(TES), 'federation_final_invites', 't2_f_ana1')));
    await assertFails(updateDoc(doc(como(ANA), 'federation_final_invites', 't2_f_ana1'), { status: 'accepted' }));
  });
});

describe('a taxa de chancela', () => {
  it('4. competições lê a taxa (por id e na consulta por origem), não a anuidade', async () => {
    await assertSucceeds(getDoc(doc(como(COMP), 'federation_charges', 'taxa')));
    await assertSucceeds(getDocs(query(collection(como(COMP), 'federation_charges'), where('federation_id', '==', FED), where('origin', '==', 'sanction'))));
    await assertFails(getDoc(doc(como(COMP), 'federation_charges', 'anuidade')));
    await assertSucceeds(getDoc(doc(como(ORG), 'federation_charges', 'taxa')));
    await assertFails(getDoc(doc(como(ZE), 'federation_charges', 'taxa')));
  });
});
