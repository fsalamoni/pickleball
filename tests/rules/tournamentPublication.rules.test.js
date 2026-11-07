/**
 * RASCUNHO, PUBLICAÇÃO E PRAZOS DO TORNEIO (2026-11-07):
 *
 *  1. o rascunho só o criador, o co-administrador e o admin da plataforma leem —
 *     nem pelo `get`, nem numa consulta (a consulta de fora filtra `status in`);
 *  2. consulta sem o filtro de status é recusada a quem não é o dono;
 *  3. a própria inscrição só com as inscrições abertas, pelo relógio do banco:
 *     publicado com a abertura vencida já aceita; encerramento vencido recusa;
 *     rascunho, encerrado e andamento recusam; o organizador inscreve sempre.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

const DONO = 'dono1';
const COADM = 'coadm1';
const ATL = 'atl1';
const VISIVEIS = ['published', 'registrations_open', 'registrations_closed', 'in_progress', 'finished', 'cancelled'];
const H = 3_600_000;

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-tournament-publication-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const semRegras = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();

const TORNEIOS = {
  rasc: { status: 'draft' },
  breve: { status: 'published', registration_opens_ms: Date.now() + 10 * H },
  venceu: { status: 'published', registration_opens_ms: Date.now() - H },
  aberto: { status: 'registrations_open' },
  fechou: { status: 'registrations_open', registration_closes_ms: Date.now() - H },
  encerrado: { status: 'registrations_closed' },
  jogando: { status: 'in_progress' },
};

beforeEach(async () => {
  await testEnv.clearFirestore();
  await semRegras(async (db) => {
    for (const [id, t] of Object.entries(TORNEIOS)) {
      await setDoc(doc(db, 'tournaments', id), { id, name: id, creator_uid: DONO, visibility: 'public', arena_id: 'arenaA', ...t });
      await setDoc(doc(db, 'tournament_modalities', `m_${id}`), { tournament_id: id, entry_fee_cents: 0 });
    }
    await setDoc(doc(db, 'tournament_admins', `rasc_${COADM}`), { tournament_id: 'rasc', user_id: COADM, role: 'admin' });
    await setDoc(doc(db, 'tournament_admins', `encerrado_${DONO}`), { tournament_id: 'encerrado', user_id: DONO, role: 'owner' });
  });
});

const inscricao = (tid, uid = ATL) => ({
  tournament_id: tid, modality_id: `m_${tid}`, created_by: uid, user_id: uid, player_a_user_id: uid, status: 'pending_payment',
});

describe('rascunho', () => {
  it('quem não é da equipe não lê o rascunho pelo get', async () => {
    await assertFails(getDoc(doc(anonimo(), 'tournaments', 'rasc')));
    await assertFails(getDoc(doc(como(ATL), 'tournaments', 'rasc')));
  });
  it('o criador e o co-administrador leem o rascunho', async () => {
    await assertSucceeds(getDoc(doc(como(DONO), 'tournaments', 'rasc')));
    await assertSucceeds(getDoc(doc(como(COADM), 'tournaments', 'rasc')));
  });
  it('o publicado qualquer um lê', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'tournaments', 'breve')));
  });
  it('consulta de fora com o filtro de status passa e não traz o rascunho', async () => {
    const s = await assertSucceeds(getDocs(query(collection(anonimo(), 'tournaments'),
      where('visibility', '==', 'public'), where('status', 'in', VISIVEIS))));
    if (s.docs.some((d) => d.id === 'rasc')) throw new Error('o rascunho vazou');
    await assertSucceeds(getDocs(query(collection(como(ATL), 'tournaments'),
      where('arena_id', '==', 'arenaA'), where('status', 'in', VISIVEIS))));
  });
  it('consulta sem o filtro de status é recusada a quem não é o dono', async () => {
    await assertFails(getDocs(query(collection(anonimo(), 'tournaments'), where('visibility', '==', 'public'))));
    await assertFails(getDocs(query(collection(como(ATL), 'tournaments'), where('arena_id', '==', 'arenaA'))));
  });
  it('o dono lista os próprios torneios, rascunhos inclusive', async () => {
    await assertSucceeds(getDocs(query(collection(como(DONO), 'tournaments'), where('creator_uid', '==', DONO))));
  });
});

describe('inscrição pelo próprio atleta', () => {
  it('aceita com as inscrições abertas, inclusive publicado com a abertura vencida', async () => {
    await assertSucceeds(setDoc(doc(como(ATL), 'tournament_registrations', 'r_aberto'), inscricao('aberto')));
    await assertSucceeds(setDoc(doc(como(ATL), 'tournament_registrations', 'r_venceu'), inscricao('venceu')));
  });
  it('recusa rascunho, antes de abrir, encerramento vencido, encerrado e andamento', async () => {
    for (const tid of ['rasc', 'breve', 'fechou', 'encerrado', 'jogando']) {
      await assertFails(setDoc(doc(como(ATL), 'tournament_registrations', `r_${tid}`), inscricao(tid)));
    }
  });
  it('o organizador inscreve fora do prazo', async () => {
    await assertSucceeds(setDoc(doc(como(DONO), 'tournament_registrations', 'r_org'), {
      ...inscricao('encerrado', DONO), created_by: DONO, status: 'confirmed',
    }));
  });
});
