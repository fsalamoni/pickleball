/**
 * Regras do Firestore da INTEGRAÇÃO COM O DUPR (flag `dupr_official_sync`).
 *
 *  1. ⭐ o selo `dupr_verified` é do servidor: o dono não o cria, não o liga
 *     num documento novo, não o liga/desliga depois;
 *  2. ⭐ com o selo, o ID e os ratings vêm do DUPR — o dono não os reescreve;
 *     sem o selo (ou depois de desvincular), edita como sempre;
 *  3. o cadastro de sempre segue livre (nome, cidade, o próprio ID sem selo);
 *  4. `dupr_links` o dono e o admin leem, ninguém escreve; os tokens do login
 *     e o mapa de IDs não abrem para o navegador.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

const ANA = 'ana_uid';
const BIA = 'bia_uid';
const ADMIN = 'admin_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-dupr-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { role: 'platform_admin' });
    // Ana: conta já vinculada ao DUPR (selo + ID + rating espelhados pelo servidor).
    await setDoc(doc(db, 'users', ANA), { full_name: 'Ana Souza', city: 'Porto Alegre', dupr_id: 'ABC123', dupr_rating: 3.875, dupr_verified: true });
    await setDoc(doc(db, 'athlete_profiles', ANA), { platform_name: 'Ana', dupr_id: 'ABC123', dupr_rating: 3.875, dupr_verified: true });
    // Bia: sem vínculo, com ID digitado à mão.
    await setDoc(doc(db, 'users', BIA), { full_name: 'Bia Lima', dupr_id: 'MANUAL1' });
    await setDoc(doc(db, 'athlete_profiles', BIA), { platform_name: 'Bia', dupr_id: 'MANUAL1' });
    await setDoc(doc(db, 'dupr_links', ANA), { user_id: ANA, dupr_id: 'ABC123' });
    await setDoc(doc(db, 'dupr_link_tokens', ANA), { access_token: 'x', refresh_token: 'y' });
    await setDoc(doc(db, 'dupr_ids', 'ABC123'), { user_id: ANA });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('selo dupr_verified — users', () => {
  it('o dono não liga o selo na própria conta nem em conta nova', async () => {
    await assertFails(updateDoc(doc(como(BIA), 'users', BIA), { dupr_verified: true }));
    await assertFails(updateDoc(doc(como(BIA), 'users', BIA), { dupr_verified_at_ms: 1 }));
    await assertFails(setDoc(doc(como('nova_uid'), 'users', 'nova_uid'), { full_name: 'Nova', dupr_verified: true }));
    await assertSucceeds(setDoc(doc(como('nova_uid'), 'users', 'nova_uid'), { full_name: 'Nova' }));
  });

  it('o dono não derruba o selo', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'users', ANA), { dupr_verified: false }));
  });

  it('com o selo, o dono não reescreve ID nem ratings', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'users', ANA), { dupr_id: 'FALSO99' }));
    await assertFails(updateDoc(doc(como(ANA), 'users', ANA), { dupr_rating: 7.5 }));
    await assertFails(updateDoc(doc(como(ANA), 'users', ANA), { dupr_rating_singles: 7.5 }));
  });

  it('com o selo, o resto do cadastro segue livre (e regravar o mesmo valor não conta)', async () => {
    await assertSucceeds(updateDoc(doc(como(ANA), 'users', ANA), { city: 'Gramado' }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'users', ANA), { dupr_id: 'ABC123', dupr_rating: 3.875, city: 'Canela' }));
  });

  it('sem o selo, o ID digitado à mão edita como sempre', async () => {
    await assertSucceeds(updateDoc(doc(como(BIA), 'users', BIA), { dupr_id: 'MANUAL2', dupr_rating: 3.2 }));
  });
});

describe('selo dupr_verified — espelho público', () => {
  it('o dono não liga nem derruba o selo, e não cria o documento já com ele', async () => {
    await assertFails(updateDoc(doc(como(BIA), 'athlete_profiles', BIA), { dupr_verified: true }));
    await assertFails(updateDoc(doc(como(ANA), 'athlete_profiles', ANA), { dupr_verified: false }));
    await assertFails(setDoc(doc(como('nova_uid'), 'athlete_profiles', 'nova_uid'), { platform_name: 'Nova', dupr_verified: true }));
  });

  it('com o selo, ID e rating do espelho não são reescritos pelo dono; o resto sim', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'athlete_profiles', ANA), { dupr_rating: 8 }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'athlete_profiles', ANA), { platform_name: 'Ana S.', dupr_id: 'ABC123' }));
  });

  it('a sincronização do perfil (merge com os mesmos valores) segue passando', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'athlete_profiles', ANA), { platform_name: 'Ana', dupr_id: 'ABC123', dupr_rating: 3.875 }, { merge: true }));
  });

  it('sem o selo, o espelho edita como sempre', async () => {
    await assertSucceeds(updateDoc(doc(como(BIA), 'athlete_profiles', BIA), { dupr_id: 'MANUAL2' }));
  });
});

describe('dupr_links, dupr_link_tokens e dupr_ids', () => {
  it('o dono e o admin leem o resumo; outra conta não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'dupr_links', ANA)));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'dupr_links', ANA)));
    await assertFails(getDoc(doc(como(BIA), 'dupr_links', ANA)));
  });

  it('ninguém escreve (nem o dono, nem o admin): só o servidor', async () => {
    await assertFails(setDoc(doc(como(BIA), 'dupr_links', BIA), { user_id: BIA, dupr_id: 'ABC123' }));
    await assertFails(updateDoc(doc(como(ANA), 'dupr_links', ANA), { dupr_id: 'OUTRO' }));
    await assertFails(deleteDoc(doc(como(ANA), 'dupr_links', ANA)));
    await assertFails(setDoc(doc(como(ADMIN), 'dupr_links', BIA), { user_id: BIA }));
  });

  it('os tokens do login e o mapa de IDs não abrem para o navegador', async () => {
    await assertFails(getDoc(doc(como(ANA), 'dupr_link_tokens', ANA)));
    await assertFails(getDoc(doc(como(ADMIN), 'dupr_link_tokens', ANA)));
    await assertFails(setDoc(doc(como(BIA), 'dupr_link_tokens', BIA), { access_token: 'x' }));
    await assertFails(getDoc(doc(como(ANA), 'dupr_ids', 'ABC123')));
    await assertFails(setDoc(doc(como(BIA), 'dupr_ids', 'ABC123'), { user_id: BIA }));
  });

  it('a regra das credenciais continua fechada', async () => {
    await assertFails(getDoc(doc(como(ADMIN), 'platform_secrets', 'dupr')));
    await assertFails(setDoc(doc(como(ADMIN), 'platform_secrets', 'dupr'), { client_key: 'x' }));
  });
});

describe('piloto do DUPR (dupr_pilot_players, dupr_pilot_matches)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dupr_pilot_players', 'p1'), { name: 'Piloto 1', dupr_id: 'PIL001' });
      await setDoc(doc(ctx.firestore(), 'dupr_pilot_matches', 'm1'), { status: 'sent' });
    });
  });

  it('só o admin lê; ninguém escreve (só o servidor)', async () => {
    for (const [col, id] of [['dupr_pilot_players', 'p1'], ['dupr_pilot_matches', 'm1']]) {
      await assertSucceeds(getDoc(doc(como(ADMIN), col, id)));
      await assertFails(getDoc(doc(como(ANA), col, id)));
      await assertFails(setDoc(doc(como(ADMIN), col, 'novo'), { name: 'x' }));
      await assertFails(deleteDoc(doc(como(ADMIN), col, id)));
    }
  });
});

describe('livro de envios ao DUPR (dupr_submissions)', () => {
  const ID = 'pr:tm:m1';
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dupr_submissions', ID), { status: 'held', uids: [ANA, 'outro'], organizer_uid: 'org_uid' });
    });
  });

  it('o admin, quem jogou e quem organizou leem; os outros não', async () => {
    await assertSucceeds(getDoc(doc(como(ADMIN), 'dupr_submissions', ID)));
    await assertSucceeds(getDoc(doc(como(ANA), 'dupr_submissions', ID)));
    await assertSucceeds(getDoc(doc(como('org_uid'), 'dupr_submissions', ID)));
    await assertFails(getDoc(doc(como(BIA), 'dupr_submissions', ID)));
  });

  it('a lista do jogador sai pela consulta dos próprios uids', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'dupr_submissions'), where('uids', 'array-contains', ANA))));
    await assertFails(getDocs(collection(como(ANA), 'dupr_submissions')));
  });

  it('ninguém escreve pelo navegador, nem o admin', async () => {
    await assertFails(updateDoc(doc(como(ADMIN), 'dupr_submissions', ID), { status: 'sent' }));
    await assertFails(setDoc(doc(como(ANA), 'dupr_submissions', 'pr:tm:x'), { status: 'queued', uids: [ANA] }));
    await assertFails(deleteDoc(doc(como(ADMIN), 'dupr_submissions', ID)));
  });
});
