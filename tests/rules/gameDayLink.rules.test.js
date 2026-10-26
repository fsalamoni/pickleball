/**
 * Regras do VÍNCULO do dia de jogo a clube/arena (`link_club_id`, `link_arena_id`).
 *
 * O vínculo é atribuição de estatísticas (ver `domain/gameDayLink.js`) e é ato
 * institucional: o dia entra na página e no ranking do clube/arena. Por isso:
 *  - o dia nunca NASCE vinculado (a criação recusa);
 *  - só o CRIADOR vincula, e só a clube que ADMINISTRA / arena que GERE;
 *  - membro comum do clube, e ninguém de fora, vincula;
 *  - manter ou remover o vínculo é sempre livre para o criador;
 *  - o vínculo não dá poder nenhum ao clube/arena sobre o dia;
 *  - a consulta dos dias vinculados (vínculo + público) passa para quem não é admin.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const CRIADOR = 'criador_uid';
const ADMIN_CLUBE = 'admin_clube_uid';
const MEMBRO = 'membro_uid';
const GESTOR = 'gestor_uid';
const OUTRO = 'outro_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-vinculo-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // O criador administra o clube C1, é só membro do C2 e gere a arena A1.
    await setDoc(doc(db, 'club_members', `C1_${CRIADOR}`), { club_id: 'C1', user_id: CRIADOR, role: 'admin' });
    await setDoc(doc(db, 'club_members', `C2_${CRIADOR}`), { club_id: 'C2', user_id: CRIADOR, role: 'member' });
    await setDoc(doc(db, 'club_members', `C1_${ADMIN_CLUBE}`), { club_id: 'C1', user_id: ADMIN_CLUBE, role: 'admin' });
    await setDoc(doc(db, 'club_members', `C1_${MEMBRO}`), { club_id: 'C1', user_id: MEMBRO, role: 'member' });
    await setDoc(doc(db, 'arena_managers', `A1_${CRIADOR}`), { arena_id: 'A1', user_id: CRIADOR, role: 'owner' });
    await setDoc(doc(db, 'arena_managers', `A2_${GESTOR}`), { arena_id: 'A2', user_id: GESTOR, role: 'owner' });
    await setDoc(doc(db, 'game_days', 'dia'), {
      created_by: CRIADOR, member_uids: [CRIADOR], visibility: 'public', status: 'active',
      format: 'americano', date: '2026-11-01', title: 'Racha',
    });
    await setDoc(doc(db, 'game_days', 'dia-privado'), {
      created_by: CRIADOR, member_uids: [CRIADOR], visibility: 'private', status: 'active',
      format: 'americano', date: '2026-11-01', title: 'Privado',
    });
    await setDoc(doc(db, 'game_days', 'vinculado'), {
      created_by: CRIADOR, member_uids: [CRIADOR], visibility: 'public', status: 'active',
      format: 'americano', date: '2026-11-02', title: 'Vinculado',
      link_club_id: 'C1', link_club_name: 'Clube 1', link_arena_id: 'A1', link_arena_name: 'Arena 1',
    });
    await setDoc(doc(db, 'game_days', 'vinculado-c2'), {
      created_by: CRIADOR, member_uids: [CRIADOR], visibility: 'public', status: 'active',
      format: 'americano', date: '2026-11-03', title: 'De outro clube',
      link_club_id: 'C2', link_club_name: 'Clube 2',
    });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const dia = (uid, id = 'dia') => doc(como(uid), 'game_days', id);

describe('criar', () => {
  const novo = (extra = {}) => ({
    created_by: CRIADOR, member_uids: [CRIADOR], visibility: 'public', status: 'active', title: 'Novo', ...extra,
  });

  it('o dia de sempre (sem vínculo) continua nascendo', async () => {
    await assertSucceeds(setDoc(doc(como(CRIADOR), 'game_days', 'n1'), novo()));
  });

  it('o dia não nasce já vinculado', async () => {
    await assertFails(setDoc(doc(como(CRIADOR), 'game_days', 'n2'), novo({ link_club_id: 'C1' })));
    await assertFails(setDoc(doc(como(CRIADOR), 'game_days', 'n3'), novo({ link_arena_id: 'A1' })));
  });
});

describe('vincular', () => {
  it('⭐ o criador vincula a clube que administra', async () => {
    await assertSucceeds(updateDoc(dia(CRIADOR), { link_club_id: 'C1', link_club_name: 'Clube 1' }));
  });

  it('⭐ o criador vincula a arena que gere', async () => {
    await assertSucceeds(updateDoc(dia(CRIADOR), { link_arena_id: 'A1', link_arena_name: 'Arena 1' }));
  });

  it('só membro (não admin) do clube NÃO vincula', async () => {
    await assertFails(updateDoc(dia(CRIADOR), { link_club_id: 'C2', link_club_name: 'Clube 2' }));
  });

  it('arena que o criador não gere NÃO vincula', async () => {
    await assertFails(updateDoc(dia(CRIADOR), { link_arena_id: 'A2', link_arena_name: 'Arena 2' }));
  });

  it('clube alheio (nem membro) NÃO vincula', async () => {
    await assertFails(updateDoc(dia(CRIADOR), { link_club_id: 'C9', link_club_name: 'Alheio' }));
  });

  it('quem não é o criador não vincula, nem sendo admin do clube', async () => {
    await assertFails(updateDoc(dia(ADMIN_CLUBE), { link_club_id: 'C1', link_club_name: 'Clube 1' }));
  });

  it('o gestor da arena vinculada não ganha poder sobre o dia', async () => {
    await assertFails(updateDoc(dia(GESTOR, 'vinculado'), { title: 'Mudei' }));
    await assertFails(updateDoc(dia(ADMIN_CLUBE, 'vinculado'), { title: 'Mudei' }));
  });
});

describe('manter, trocar e desfazer', () => {
  it('o criador desvincula (mesmo de um clube em que já não é admin)', async () => {
    await assertSucceeds(updateDoc(dia(CRIADOR, 'vinculado-c2'), { link_club_id: null, link_club_name: null }));
  });

  it('editar outro campo mantém o vínculo sem exigir admin de novo', async () => {
    await assertSucceeds(updateDoc(dia(CRIADOR, 'vinculado-c2'), { title: 'Novo nome' }));
  });

  it('trocar para um clube que NÃO administra é recusado', async () => {
    await assertFails(updateDoc(dia(CRIADOR, 'vinculado'), { link_club_id: 'C2', link_club_name: 'Clube 2' }));
  });

  it('trocar para um clube que administra passa', async () => {
    await assertSucceeds(updateDoc(dia(CRIADOR, 'vinculado'), {
      link_club_id: 'C1', link_club_name: 'Clube Um',
    }));
  });
});

describe('dia vinculado é aberto (nunca exclusivo de membros)', () => {
  it('qualquer conta entra num dia vinculado e sai dele', async () => {
    await assertSucceeds(updateDoc(dia(OUTRO, 'vinculado'), { member_uids: [CRIADOR, OUTRO] }));
    await assertSucceeds(updateDoc(dia(OUTRO, 'vinculado'), { member_uids: [CRIADOR] }));
  });

  it('o convidado não consegue mexer no vínculo ao entrar', async () => {
    await assertFails(updateDoc(dia(OUTRO, 'vinculado'), {
      member_uids: [CRIADOR, OUTRO], link_club_id: null,
    }));
  });
});

describe('a consulta dos dias vinculados', () => {
  it('⭐ uma conta qualquer lista os dias de um clube (vínculo + público)', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(OUTRO), 'game_days'),
      where('link_club_id', '==', 'C1'),
      where('visibility', '==', 'public'),
    )));
  });

  it('⭐ idem para a arena', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(OUTRO), 'game_days'),
      where('link_arena_id', '==', 'A1'),
      where('visibility', '==', 'public'),
    )));
  });

  it('sem o filtro de visibilidade a regra recusa (por isso ele é contrato)', async () => {
    await assertFails(getDocs(query(collection(como(OUTRO), 'game_days'), where('link_club_id', '==', 'C1'))));
  });
});

describe('o espelho do ranking troca de clube (apagar e recriar)', () => {
  const espelho = (clubId) => ({
    id: 'gd_dia_j1', event_id: 'dia', date_id: 'game_day', club_id: clubId, source: 'game_day',
    side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'], kind: 'doubles',
    score_a: 11, score_b: 7, winner_side: 'a', status: 'finished',
  });

  it('o clube do espelho não muda por update, mas apagar e recriar passa para o criador do dia', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'club_event_games', 'gd_dia_j1'), espelho(null));
    });
    const ref = doc(como(CRIADOR), 'club_event_games', 'gd_dia_j1');
    await assertFails(setDoc(ref, espelho('C1')));
    const { deleteDoc } = await import('firebase/firestore');
    await assertSucceeds(deleteDoc(ref));
    await assertSucceeds(setDoc(ref, espelho('C1')));
  });
});
