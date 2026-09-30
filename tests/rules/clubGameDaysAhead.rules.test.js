/**
 * Regras do "JOGAR" — os dias de jogo dos CLUBES da pessoa, e entrar e sair.
 *
 * O "Jogar" do início e o Procura-se jogo passaram a listar, para quem é
 * membro, os dias de jogo PRIVADOS do clube: uma consulta por clube,
 * `club_id == X` + `date IN [próximos dias]`. Nenhuma regra nova. Estas
 * asserções provam, com contas que NÃO são admin, que:
 *  - o membro do clube lista os dias do clube; quem não é do clube é recusado;
 *  - sem o filtro de clube, a consulta é recusada (o guarda de fonte existe
 *    por isso);
 *  - o membro entra e sai SOZINHO (só a si mesmo); quem não é do clube não;
 *  - quem agendou a data pode entrar para jogar;
 *  - 🐞 sair de um dia com ADMINISTRADOR NOMEADO: tirar só a si mesmo da lista
 *    passa; regravar a lista recontada (o caminho antigo) era recusado.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const ANA = 'ana_uid'; // membro do clube c1
const BIA = 'bia_uid'; // não é do clube
const ORG = 'org_uid'; // membro que agendou a data
const ADM = 'adm_uid'; // administrador nomeado de um dia público

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-jogar-clube-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'clubs', 'c1'), { name: 'Clube Ace', created_by: 'dono_uid' });
    await setDoc(doc(db, 'club_members', `c1_${ANA}`), { club_id: 'c1', user_id: ANA, role: 'member' });
    await setDoc(doc(db, 'club_members', `c1_${ORG}`), { club_id: 'c1', user_id: ORG, role: 'member' });
    await setDoc(doc(db, 'game_days', 'clube'), {
      club_id: 'c1', club_name: 'Clube Ace', visibility: 'private', created_by: ORG,
      member_uids: [ORG], invited_uids: [], admin_uids: [], status: 'active', format: 'americano',
      date: '2026-10-06', time: '19:00', title: 'Terça do clube', manage_mode: 'participants',
    });
    await setDoc(doc(db, 'game_days', 'publicoComAdmin'), {
      visibility: 'public', created_by: BIA, member_uids: [BIA, ADM, ANA], invited_uids: [],
      admin_uids: [ADM], status: 'active', format: 'americano', date: '2026-10-03', title: 'Racha',
    });
    await setDoc(doc(db, 'game_days', 'publicoComAdmin', 'participants', 'pAna'), { user_id: ANA, name: 'Ana' });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const dias = ['2026-10-05', '2026-10-06', '2026-10-07'];
const consultaDoClube = (db) => getDocs(query(
  collection(db, 'game_days'),
  where('club_id', '==', 'c1'),
  where('date', 'in', dias),
));

describe('a consulta dos dias do clube', () => {
  it('⭐ o membro do clube lista os dias de jogo do clube (privados)', async () => {
    await assertSucceeds(consultaDoClube(como(ANA)));
  });

  it('quem não é do clube é recusado — o dia do clube não vaza', async () => {
    await assertFails(consultaDoClube(como(BIA)));
  });

  it('sem o filtro de clube, a regra recusa (por isso ele é contrato)', async () => {
    await assertFails(getDocs(query(collection(como(ANA), 'game_days'), where('date', 'in', dias))));
  });
});

describe('entrar e sair do dia do clube', () => {
  it('⭐ o membro entra sozinho: a própria inscrição e a si mesmo na lista', async () => {
    const db = como(ANA);
    await assertSucceeds(setDoc(doc(db, 'game_days', 'clube', 'participants', 'pA'), { user_id: ANA, name: 'Ana', source: 'joined' }));
    await assertSucceeds(updateDoc(doc(db, 'game_days', 'clube'), { member_uids: arrayUnion(ANA) }));
  });

  it('e sai sozinho: apaga a própria inscrição e tira só a si mesmo', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'game_days', 'clube', 'participants', 'pA'), { user_id: ANA, name: 'Ana' });
      await updateDoc(doc(ctx.firestore(), 'game_days', 'clube'), { member_uids: [ORG, ANA] });
    });
    const db = como(ANA);
    await assertSucceeds(deleteDoc(doc(db, 'game_days', 'clube', 'participants', 'pA')));
    await assertSucceeds(updateDoc(doc(db, 'game_days', 'clube'), { member_uids: arrayRemove(ANA) }));
  });

  it('quem não é do clube não entra', async () => {
    const db = como(BIA);
    await assertFails(setDoc(doc(db, 'game_days', 'clube', 'participants', 'pB'), { user_id: BIA, name: 'Bia' }));
    await assertFails(updateDoc(doc(db, 'game_days', 'clube'), { member_uids: arrayUnion(BIA) }));
  });

  it('o membro não inscreve outra pessoa', async () => {
    await assertFails(setDoc(doc(como(ANA), 'game_days', 'clube', 'participants', 'pX'), { user_id: BIA, name: 'Bia' }));
  });

  it('quem agendou a data pode entrar para jogar', async () => {
    await assertSucceeds(setDoc(doc(como(ORG), 'game_days', 'clube', 'participants', 'pO'), { user_id: ORG, name: 'Org', source: 'joined' }));
  });
});

describe('🐞 sair de um dia com administrador nomeado', () => {
  it('⭐ tirar só a si mesmo da lista passa', async () => {
    const db = como(ANA);
    await assertSucceeds(deleteDoc(doc(db, 'game_days', 'publicoComAdmin', 'participants', 'pAna')));
    await assertSucceeds(updateDoc(doc(db, 'game_days', 'publicoComAdmin'), { member_uids: arrayRemove(ANA) }));
  });

  it('regravar a lista RECONTADA (criador + inscritos) derrubava o administrador — e a regra recusava', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'game_days', 'publicoComAdmin'), { member_uids: [BIA] }));
  });
});
