/**
 * Regressões de escalação em vínculos administrativos.
 *
 * Um documento em `arena_managers` ou `tournament_admins` é poder: as regras
 * `isArenaManager` e `isTournamentAdmin` passam a autorizar muitas outras
 * escritas. Por isso o usuário NÃO pode criar o próprio vínculo em recurso
 * alheio. A criação inicial segue permitida apenas para o dono/criador gravado
 * no documento pai, inclusive no lote usado pelo fluxo real de torneio.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';

const DONO = 'dono_uid';
const GESTOR = 'gestor_uid';
const ORG = 'org_uid';
const ADMIN_TORNEIO = 'admin_torneio_uid';
const INVASOR = 'invasor_uid';
const ARENA = 'arena_1';
const TORNEIO = 'torneio_1';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-access-escalation-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', DONO), { uid: DONO, role: 'user' });
    await setDoc(doc(db, 'users', GESTOR), { uid: GESTOR, role: 'user' });
    await setDoc(doc(db, 'users', ORG), { uid: ORG, role: 'user' });
    await setDoc(doc(db, 'users', ADMIN_TORNEIO), { uid: ADMIN_TORNEIO, role: 'user' });
    await setDoc(doc(db, 'users', INVASOR), { uid: INVASOR, role: 'user' });
    await setDoc(doc(db, 'arenas', ARENA), { id: ARENA, owner_id: DONO, name: 'Arena' });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), {
      id: `${ARENA}_${GESTOR}`, arena_id: ARENA, user_id: GESTOR, role: 'manager',
    });
    await setDoc(doc(db, 'tournaments', TORNEIO), {
      id: TORNEIO, creator_uid: ORG, name: 'Torneio', archived: false,
    });
    await setDoc(doc(db, 'tournament_admins', `${TORNEIO}_${ADMIN_TORNEIO}`), {
      tournament_id: TORNEIO, user_id: ADMIN_TORNEIO, role: 'manager',
    });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('arena_managers', () => {
  it('🔴 usuário comum não cria o próprio vínculo em arena alheia', async () => {
    await assertFails(setDoc(doc(como(INVASOR), 'arena_managers', `${ARENA}_${INVASOR}`), {
      id: `${ARENA}_${INVASOR}`, arena_id: ARENA, user_id: INVASOR, role: 'manager',
      created_at: serverTimestamp(),
    }));
  });

  it('o dono gravado na arena cria o vínculo inicial dele como owner', async () => {
    const db = como(DONO);
    await assertSucceeds(setDoc(doc(db, 'arena_managers', `${ARENA}_${DONO}`), {
      id: `${ARENA}_${DONO}`, arena_id: ARENA, user_id: DONO, role: 'owner',
      created_at: serverTimestamp(),
    }));
  });

  it('um gestor existente adiciona outro gestor, com id determinístico', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_managers', `${ARENA}_${INVASOR}`), {
      id: `${ARENA}_${INVASOR}`, arena_id: ARENA, user_id: INVASOR, role: 'manager',
      created_at: serverTimestamp(),
    }));
  });

  it('não aceita docId que não corresponde a arena_id + user_id', async () => {
    await assertFails(setDoc(doc(como(GESTOR), 'arena_managers', 'atalho'), {
      id: 'atalho', arena_id: ARENA, user_id: INVASOR, role: 'manager',
      created_at: serverTimestamp(),
    }));
  });

  it('o invasor continua sem poder editar a arena', async () => {
    await assertFails(updateDoc(doc(como(INVASOR), 'arenas', ARENA), { name: 'Invadida' }));
  });
});

describe('tournament_admins', () => {
  it('🔴 usuário comum não cria o próprio admin em torneio alheio', async () => {
    await assertFails(setDoc(doc(como(INVASOR), 'tournament_admins', `${TORNEIO}_${INVASOR}`), {
      tournament_id: TORNEIO, user_id: INVASOR, role: 'manager',
      created_at: serverTimestamp(),
    }));
  });

  it('o criador cria torneio + owner admin no mesmo lote do fluxo real', async () => {
    const db = como(ORG);
    const b = writeBatch(db);
    b.set(doc(db, 'tournaments', 'torneio_novo'), {
      id: 'torneio_novo', creator_uid: ORG, name: 'Novo', archived: false,
      created_at: serverTimestamp(),
    });
    b.set(doc(db, 'tournament_admins', `torneio_novo_${ORG}`), {
      tournament_id: 'torneio_novo', user_id: ORG, role: 'owner',
      created_at: serverTimestamp(),
    });
    await assertSucceeds(b.commit());
  });

  it('um admin existente adiciona outro admin, com id determinístico', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN_TORNEIO), 'tournament_admins', `${TORNEIO}_${INVASOR}`), {
      tournament_id: TORNEIO, user_id: INVASOR, role: 'manager',
      created_at: serverTimestamp(),
    }));
  });

  it('não aceita docId que não corresponde a tournament_id + user_id', async () => {
    await assertFails(setDoc(doc(como(ADMIN_TORNEIO), 'tournament_admins', 'atalho'), {
      tournament_id: TORNEIO, user_id: INVASOR, role: 'manager',
      created_at: serverTimestamp(),
    }));
  });

  it('o invasor continua sem poder editar o torneio', async () => {
    await assertFails(updateDoc(doc(como(INVASOR), 'tournaments', TORNEIO), { name: 'Invadido' }));
  });
});
