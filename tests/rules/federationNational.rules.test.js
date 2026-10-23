/**
 * Regras da CAMADA NACIONAL (Bloco 6, `docs/50` §35):
 *
 *  1. o vínculo lê qualquer cargo das duas federações (estadual e
 *     confederação); quem é de fora não; as consultas por `federation_id` e
 *     por `conf_id` são prováveis;
 *  2. a anuidade lê as contas das duas (financeiro, conselho fiscal, admin);
 *     a secretaria não;
 *  3. a confederação que homologa lê a transferência (consulta por
 *     `homologation_by`);
 *  4. ⭐ ninguém grava vínculo nem anuidade pelo navegador, e o admin da
 *     federação não se marca confederação nem escreve o espelho do vínculo;
 *  5. a lista pública das filiadas (`national_body.id` + publicada) é provável sem login.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const CB = 'cbpres';
const CBSEC = 'cbsec';
const GP = 'gppres';
const GPFIN = 'gpfin';
const GPSEC = 'gpsec';
const ZE = 'ze1';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-fed-national-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    await setDoc(doc(db, 'platform_settings', 'global'), { feature_flags: { federations: true } });
    await setDoc(doc(db, 'federations', 'cbp'), { name: 'Confederação Brasileira', acronym: 'CBP', slug: 'cbp', level: 'national', status: 'approved', published: true, confederation: true, created_by: CB });
    await setDoc(doc(db, 'federations', 'fgp'), { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', level: 'state', status: 'approved', published: true, created_by: GP, national_body: { id: 'cbp', acronym: 'CBP' } });
    await setDoc(doc(db, 'federation_staff', `cbp_${CB}`), { federation_id: 'cbp', user_id: CB, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `cbp_${CBSEC}`), { federation_id: 'cbp', user_id: CBSEC, role: 'custom', perms: ['members'] });
    await setDoc(doc(db, 'federation_staff', `fgp_${GP}`), { federation_id: 'fgp', user_id: GP, role: 'president' });
    await setDoc(doc(db, 'federation_staff', `fgp_${GPFIN}`), { federation_id: 'fgp', user_id: GPFIN, role: 'custom', perms: ['finance'] });
    await setDoc(doc(db, 'federation_staff', `fgp_${GPSEC}`), { federation_id: 'fgp', user_id: GPSEC, role: 'custom', perms: ['members'] });
    await setDoc(doc(db, 'federation_national_links', 'cbp_fgp'), { conf_id: 'cbp', federation_id: 'fgp', status: 'approved' });
    await setDoc(doc(db, 'federation_dues', 'cbp_fgp_2026'), { conf_id: 'cbp', federation_id: 'fgp', year: 2026, status: 'open', amount_cents: 1000 });
    await setDoc(doc(db, 'federation_transfers', 't1'), { federation_id: 'fpp', to_federation_id: 'fgx', member_id: 'fpp_ana', user_id: 'ana', status: 'homologation', homologation_by: 'cbp' });
  });
});

describe('vínculo', () => {
  it('1. qualquer cargo das duas lê; de fora não', async () => {
    for (const uid of [CB, CBSEC, GP, GPFIN, GPSEC]) await assertSucceeds(getDoc(doc(como(uid), 'federation_national_links', 'cbp_fgp')));
    await assertSucceeds(getDocs(query(collection(como(GPSEC), 'federation_national_links'), where('federation_id', '==', 'fgp'))));
    await assertSucceeds(getDocs(query(collection(como(CBSEC), 'federation_national_links'), where('conf_id', '==', 'cbp'))));
    await assertFails(getDoc(doc(como(ZE), 'federation_national_links', 'cbp_fgp')));
    await assertFails(getDocs(query(collection(como(ZE), 'federation_national_links'), where('conf_id', '==', 'cbp'))));
  });
});

describe('anuidade', () => {
  it('2. as contas das duas leem; a secretaria e quem é de fora não', async () => {
    await assertSucceeds(getDocs(query(collection(como(GPFIN), 'federation_dues'), where('federation_id', '==', 'fgp'))));
    await assertSucceeds(getDocs(query(collection(como(CB), 'federation_dues'), where('conf_id', '==', 'cbp'))));
    await assertFails(getDoc(doc(como(GPSEC), 'federation_dues', 'cbp_fgp_2026')));
    await assertFails(getDoc(doc(como(CBSEC), 'federation_dues', 'cbp_fgp_2026')));
    await assertFails(getDoc(doc(como(ZE), 'federation_dues', 'cbp_fgp_2026')));
  });
});

describe('homologação', () => {
  it('3. a confederação que homologa lê a transferência', async () => {
    await assertSucceeds(getDocs(query(collection(como(CBSEC), 'federation_transfers'), where('homologation_by', '==', 'cbp'))));
    await assertFails(getDoc(doc(como(GPFIN), 'federation_transfers', 't1')));
  });
});

describe('escrita', () => {
  it('4. ninguém grava vínculo ou anuidade; o admin não se marca confederação nem mexe no espelho', async () => {
    await assertFails(updateDoc(doc(como(CB), 'federation_national_links', 'cbp_fgp'), { status: 'removed' }));
    await assertFails(setDoc(doc(como(GP), 'federation_national_links', 'cbp_fgx'), { conf_id: 'cbp', federation_id: 'fgx', status: 'approved' }));
    await assertFails(updateDoc(doc(como(GPFIN), 'federation_dues', 'cbp_fgp_2026'), { status: 'paid' }));
    await assertFails(updateDoc(doc(como(GP), 'federations', 'fgp'), { confederation: true }));
    await assertFails(updateDoc(doc(como(GP), 'federations', 'fgp'), { national_body: null }));
    await assertFails(updateDoc(doc(como(CB), 'federations', 'cbp'), { national_config: { dues_fixed_cents: 1 } }));
    await assertSucceeds(updateDoc(doc(como(GP), 'federations', 'fgp'), { tagline: 'Pickleball no RS' }));
    await assertFails(setDoc(doc(como(ZE), 'federations', 'nova'), { name: 'Federação Nova', acronym: 'FN', slug: 'nova', level: 'national', status: 'pending', created_by: ZE, confederation: true }));
  });

  it('5. a lista pública das filiadas é provável sem login', async () => {
    await assertSucceeds(getDocs(query(collection(testEnv.unauthenticatedContext().firestore(), 'federations'), where('national_body.id', '==', 'cbp'), where('status', '==', 'approved'), where('published', '==', true))));
  });
});
