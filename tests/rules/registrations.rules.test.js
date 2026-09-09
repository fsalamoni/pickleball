/**
 * Regras de `tournament_registrations` — achado P0-02 (e-mail público).
 *
 * O documento da inscrição é lido SEM LOGIN de propósito: o quadro do torneio,
 * a impressão de grupos e o telão são páginas públicas. Isso não muda. O que
 * muda é o e-mail sair de dentro dele:
 *
 *   tournament_registrations/{rid}                 ← público, SEM e-mail
 *   tournament_registrations/{rid}/private/contact ← só quem tem relação
 *   provisional_claims/{rid}_a|b                   ← só o dono do e-mail
 *
 * Metade destes testes é dedicada ao que NÃO pode ter mudado: o quadro segue
 * público, e o `claim` das inscrições ANTIGAS (que ainda têm o e-mail no
 * documento) segue funcionando. Uma correção de privacidade que derruba a
 * inscrição de quem já estava inscrito não é correção.
 *
 * Fluxos reais mapeados no código:
 *  - registrationService.js:110  criação da inscrição
 *  - registrationService.js:249  claimProvisionalRegistrationsForUser (login)
 *  - FirebaseAuthContext.jsx:143 chamada do claim em todo login
 *  - registrations_csv.js        exportação usada pelo organizador
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, collection, where,
  serverTimestamp,
} from 'firebase/firestore';

const OWNER_EMAIL = 'fsalamoni@gmail.com';
const ADMIN_UID = 'admin_uid';       // platform_admin
const ORG_UID = 'org_uid';           // admin DO torneio
const A_UID = 'jogador_a_uid';       // player_a já vinculado
const B_UID = 'jogador_b_uid';       // player_b já vinculado
const ESTRANHO_UID = 'estranho_uid'; // sem relação nenhuma
const CONVIDADO_UID = 'convidado_uid'; // criou conta e vai reivindicar

const TID = 'torneio1';
const RID_NOVO = 'insc_nova';     // modelo NOVO: sem e-mail no doc público
const RID_LEGADO = 'insc_legada'; // modelo ANTIGO: e-mail no doc público

const EMAIL_CONVIDADO = 'convidado@x.com';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-registrations-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv?.cleanup(); });

const perfil = (uid, email, role = 'user') => ({
  uid, email, role, can_create_pools: false, directory_listed: true,
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN_UID), perfil(ADMIN_UID, OWNER_EMAIL, 'platform_admin'));
    await setDoc(doc(db, 'users', ORG_UID), perfil(ORG_UID, 'org@x.com'));
    await setDoc(doc(db, 'users', A_UID), perfil(A_UID, 'a@x.com'));
    await setDoc(doc(db, 'users', B_UID), perfil(B_UID, 'b@x.com'));
    await setDoc(doc(db, 'users', ESTRANHO_UID), perfil(ESTRANHO_UID, 'estranho@x.com'));
    await setDoc(doc(db, 'users', CONVIDADO_UID), perfil(CONVIDADO_UID, EMAIL_CONVIDADO));

    await setDoc(doc(db, 'tournaments', TID), { id: TID, creator_uid: ORG_UID, archived: false });
    await setDoc(doc(db, 'tournament_admins', `${TID}_${ORG_UID}`), { tournament_id: TID, user_id: ORG_UID });

    // NOVA: sem e-mail no documento público. O slot B está provisório.
    await setDoc(doc(db, 'tournament_registrations', RID_NOVO), {
      id: RID_NOVO, tournament_id: TID, modality_id: 'm1', format: 'doubles',
      created_by: ORG_UID, created_by_role: 'admin',
      user_id: A_UID, player_a_user_id: A_UID, player_a_name: 'Jogador A',
      player_b_user_id: null, player_b_name: 'Convidado', player_b_provisional: true,
      is_provisional: true, status: 'confirmed',
    });
    await setDoc(doc(db, 'tournament_registrations', RID_NOVO, 'private', 'contact'), {
      player_a_email: 'a@x.com', player_a_email_lc: 'a@x.com',
      player_b_email: EMAIL_CONVIDADO, player_b_email_lc: EMAIL_CONVIDADO,
    });
    await setDoc(doc(db, 'provisional_claims', `${RID_NOVO}_b`), {
      email_lc: EMAIL_CONVIDADO, registration_id: RID_NOVO, tournament_id: TID,
      slot: 'b', claimed: false, claimed_by: null,
    });

    // LEGADA: e-mail ainda dentro do documento público (o que existe hoje).
    await setDoc(doc(db, 'tournament_registrations', RID_LEGADO), {
      id: RID_LEGADO, tournament_id: TID, modality_id: 'm1', format: 'doubles',
      created_by: ORG_UID, created_by_role: 'admin',
      user_id: null, player_a_user_id: null, player_a_name: 'Convidado',
      player_a_email: EMAIL_CONVIDADO, player_a_email_lc: EMAIL_CONVIDADO,
      player_a_provisional: true,
      player_b_user_id: B_UID, player_b_name: 'Jogador B',
      player_b_email: 'b@x.com', player_b_email_lc: 'b@x.com',
      is_provisional: true, status: 'confirmed',
    });
  });
});

const como = (uid, email) => testEnv.authenticatedContext(uid, { email }).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
const semEmail = () => testEnv.authenticatedContext('tel_uid', {}).firestore(); // login por telefone

// ---------------------------------------------------------------------------

describe('P0-02 · o quadro público NÃO pode ter mudado', () => {
  it('1. anônimo continua lendo o documento da inscrição (quadro/impressão/telão)', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'tournament_registrations', RID_NOVO)));
  });
  it('2. anônimo continua listando as inscrições de uma modalidade', async () => {
    await assertSucceeds(getDocs(query(
      collection(anon(), 'tournament_registrations'), where('modality_id', '==', 'm1'),
    )));
  });
  it('3. o organizador continua podendo editar a inscrição', async () => {
    await assertSucceeds(updateDoc(
      doc(como(ORG_UID, 'org@x.com'), 'tournament_registrations', RID_NOVO), { seed: 3 },
    ));
  });
});

describe('P0-02 · o contato NÃO é público', () => {
  it('4. ⭐ anônimo NÃO lê o contato', async () => {
    await assertFails(getDoc(doc(anon(), 'tournament_registrations', RID_NOVO, 'private', 'contact')));
  });
  it('5. ⭐ usuário logado SEM relação com a inscrição NÃO lê o contato', async () => {
    await assertFails(getDoc(doc(
      como(ESTRANHO_UID, 'estranho@x.com'), 'tournament_registrations', RID_NOVO, 'private', 'contact',
    )));
  });
  it('6. o próprio inscrito (player_a) lê o contato', async () => {
    await assertSucceeds(getDoc(doc(
      como(A_UID, 'a@x.com'), 'tournament_registrations', RID_NOVO, 'private', 'contact',
    )));
  });
  it('7. o organizador do torneio lê o contato (precisa, para contatar)', async () => {
    await assertSucceeds(getDoc(doc(
      como(ORG_UID, 'org@x.com'), 'tournament_registrations', RID_NOVO, 'private', 'contact',
    )));
  });
  it('8. o platform_admin lê o contato', async () => {
    await assertSucceeds(getDoc(doc(
      como(ADMIN_UID, OWNER_EMAIL), 'tournament_registrations', RID_NOVO, 'private', 'contact',
    )));
  });
  it('9. quem criou a inscrição escreve o contato (inscrição pelo organizador)', async () => {
    await assertSucceeds(setDoc(doc(
      como(ORG_UID, 'org@x.com'), 'tournament_registrations', RID_NOVO, 'private', 'contact',
    ), { player_a_email_lc: 'a@x.com' }));
  });
  it('10. ⭐ estranho NÃO escreve o contato', async () => {
    await assertFails(setDoc(doc(
      como(ESTRANHO_UID, 'estranho@x.com'), 'tournament_registrations', RID_NOVO, 'private', 'contact',
    ), { player_a_email_lc: 'invadido@x.com' }));
  });
});

describe('P0-02 · provisional_claims só mostra o do próprio e-mail', () => {
  it('11. ⭐ anônimo não lê nada', async () => {
    await assertFails(getDoc(doc(anon(), 'provisional_claims', `${RID_NOVO}_b`)));
  });
  it('12. ⭐ outro usuário logado NÃO lê a entrada de e-mail alheio', async () => {
    await assertFails(getDoc(doc(
      como(ESTRANHO_UID, 'estranho@x.com'), 'provisional_claims', `${RID_NOVO}_b`,
    )));
  });
  it('13. o dono do e-mail lê a própria entrada', async () => {
    await assertSucceeds(getDoc(doc(
      como(CONVIDADO_UID, EMAIL_CONVIDADO), 'provisional_claims', `${RID_NOVO}_b`,
    )));
  });
  it('14. o dono do e-mail consulta pelo PRÓPRIO e-mail (é como o login procura)', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'provisional_claims'),
      where('email_lc', '==', EMAIL_CONVIDADO),
    )));
  });
  it('15. ⭐ NÃO dá para varrer a coleção inteira', async () => {
    await assertFails(getDocs(collection(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'provisional_claims')));
  });
  it('16. ⭐ NÃO dá para consultar pelo e-mail de outra pessoa', async () => {
    await assertFails(getDocs(query(
      collection(como(ESTRANHO_UID, 'estranho@x.com'), 'provisional_claims'),
      where('email_lc', '==', EMAIL_CONVIDADO),
    )));
  });
  it('17. o e-mail é comparado em MINÚSCULAS (token com maiúsculas casa)', async () => {
    await assertSucceeds(getDoc(doc(
      como(CONVIDADO_UID, 'Convidado@X.com'), 'provisional_claims', `${RID_NOVO}_b`,
    )));
  });
  it('18. login SEM e-mail (telefone) não lê nem quebra a regra', async () => {
    await assertFails(getDoc(doc(semEmail(), 'provisional_claims', `${RID_NOVO}_b`)));
  });
});

describe('P0-02 · reivindicar a inscrição (o claim do login)', () => {
  it('19. ⭐ o convidado vincula a inscrição NOVA a si, provando por provisional_claims', async () => {
    await assertSucceeds(updateDoc(
      doc(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'tournament_registrations', RID_NOVO),
      {
        player_b_user_id: CONVIDADO_UID,
        player_b_name: 'Convidado Real',
        player_b_provisional: false,
        is_provisional: false,
        label: 'Jogador A / Convidado Real',
        updated_at: serverTimestamp(),
      },
    ));
  });
  it('20. ⭐ NÃO dá para vincular a inscrição de outra pessoa a si', async () => {
    await assertFails(updateDoc(
      doc(como(ESTRANHO_UID, 'estranho@x.com'), 'tournament_registrations', RID_NOVO),
      { player_b_user_id: ESTRANHO_UID, player_b_provisional: false },
    ));
  });
  it('21. ⭐ nem com o e-mail certo dá para vincular a inscrição a OUTRO uid', async () => {
    await assertFails(updateDoc(
      doc(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'tournament_registrations', RID_NOVO),
      { player_b_user_id: ESTRANHO_UID, player_b_provisional: false },
    ));
  });
  it('22. o claim não serve de brecha para mudar o resto da inscrição', async () => {
    await assertFails(updateDoc(
      doc(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'tournament_registrations', RID_NOVO),
      { player_b_user_id: CONVIDADO_UID, status: 'confirmed', seed: 1, modality_id: 'outra' },
    ));
  });
  it('23. ⭐ COMPAT: o claim da inscrição LEGADA (e-mail no doc público) segue valendo', async () => {
    await assertSucceeds(updateDoc(
      doc(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'tournament_registrations', RID_LEGADO),
      {
        user_id: CONVIDADO_UID,
        player_a_user_id: CONVIDADO_UID,
        player_a_name: 'Convidado Real',
        player_a_email: EMAIL_CONVIDADO,
        player_a_email_lc: EMAIL_CONVIDADO,
        player_a_provisional: false,
        is_provisional: false,
        label: 'Convidado Real / Jogador B',
        updated_at: serverTimestamp(),
      },
    ));
  });
  it('24. o titular MARCA a entrada como reivindicada', async () => {
    await assertSucceeds(updateDoc(
      doc(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'provisional_claims', `${RID_NOVO}_b`),
      { claimed: true, claimed_by: CONVIDADO_UID, claimed_at: serverTimestamp() },
    ));
  });
  it('25. ⭐ ao marcar, NÃO pode reescrever o e-mail nem apontar para outra inscrição', async () => {
    const db = como(CONVIDADO_UID, EMAIL_CONVIDADO);
    await assertFails(updateDoc(doc(db, 'provisional_claims', `${RID_NOVO}_b`), {
      claimed: true, claimed_by: CONVIDADO_UID, email_lc: 'outro@x.com',
    }));
    await assertFails(updateDoc(doc(db, 'provisional_claims', `${RID_NOVO}_b`), {
      claimed: true, claimed_by: CONVIDADO_UID, registration_id: RID_LEGADO,
    }));
  });
  it('26. ⭐ NÃO pode marcar como reivindicada em nome de outro uid', async () => {
    await assertFails(updateDoc(
      doc(como(CONVIDADO_UID, EMAIL_CONVIDADO), 'provisional_claims', `${RID_NOVO}_b`),
      { claimed: true, claimed_by: ESTRANHO_UID },
    ));
  });
  it('27. o organizador cria a entrada ao inscrever alguém sem conta', async () => {
    await assertSucceeds(setDoc(
      doc(como(ORG_UID, 'org@x.com'), 'provisional_claims', `${RID_NOVO}_a`),
      {
        email_lc: 'novo@x.com', registration_id: RID_NOVO, tournament_id: TID,
        slot: 'a', claimed: false, claimed_by: null,
      },
    ));
  });
  it('28. ⭐ estranho NÃO cria entrada apontando para inscrição alheia', async () => {
    await assertFails(setDoc(
      doc(como(ESTRANHO_UID, 'estranho@x.com'), 'provisional_claims', 'forjada_a'),
      {
        email_lc: 'estranho@x.com', registration_id: RID_NOVO, tournament_id: TID,
        slot: 'a', claimed: false, claimed_by: null,
      },
    ));
  });
  it('29. só admin/organizador remove a entrada', async () => {
    await assertFails(deleteDoc(doc(
      como(CONVIDADO_UID, EMAIL_CONVIDADO), 'provisional_claims', `${RID_NOVO}_b`,
    )));
    await assertSucceeds(deleteDoc(doc(
      como(ORG_UID, 'org@x.com'), 'provisional_claims', `${RID_NOVO}_b`,
    )));
  });
});
