/**
 * Regras do Firestore dos GRUPOS DO PLAY (flag `play_groups`).
 *
 * Os grupos moram em campos opcionais do `game_days`, e a regra de sempre só
 * deixa o criador (e a arena/o clube donos) escrever esses campos. O
 * administrador NOMEADO precisa editar os grupos como o criador — e é só isso
 * que a cláusula nova da regra libera. Estas asserções provam:
 *
 *  1. ⭐ o nomeado edita `play_groups` e `play_groups_policy` num dia de Play;
 *  2. ⭐ e SÓ isso: nada de `created_by`, `admin_uids`, `manage_mode`, `title`
 *     ou `status` — nem escondido junto dos grupos;
 *  3. ⭐ quem não é nomeado não edita (participante de dia aberto, membro,
 *     estranho), e num dia que não é Play o nomeado não ganha nada;
 *  4. o nomeado não grava lixo (grupos fora de lista, mais de 10, política
 *     desconhecida);
 *  5. o que ele já fazia segue valendo (mover gente de grupo, mexer na lista
 *     de membros), e o criador segue livre.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const DONO = 'dono_uid';
const ADMIN = 'admin_uid';
const MEMBRO = 'membro_uid';
const FORA = 'fora_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-play-groups-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

const GRUPOS = [
  { id: 'a', name: 'Alfa', color: 'rose' },
  { id: 'b', name: 'Beta', color: 'sky' },
];

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const base = {
      created_by: DONO, title: 'Sábado', visibility: 'private', status: 'active',
      member_uids: [DONO, ADMIN, MEMBRO], invited_uids: [], manage_mode: 'owner_only',
    };
    // Play restrito, com um administrador nomeado e grupos já configurados.
    await setDoc(doc(db, 'game_days', 'play'), {
      ...base, id: 'play', format: 'play', admin_uids: [ADMIN], play_groups: GRUPOS, play_groups_policy: 'queue',
    });
    // Play com a gestão ABERTA a quem está inscrito (e o mesmo nomeado).
    await setDoc(doc(db, 'game_days', 'aberto'), {
      ...base, id: 'aberto', format: 'play', manage_mode: 'participants', admin_uids: [ADMIN],
    });
    // Play sem nenhum nomeado — o campo nem existe.
    await setDoc(doc(db, 'game_days', 'sem-admin'), { ...base, id: 'sem-admin', format: 'play' });
    // Americano com o mesmo nomeado: a cláusula é só do Play.
    await setDoc(doc(db, 'game_days', 'americano'), {
      ...base, id: 'americano', format: 'americano', admin_uids: [ADMIN],
    });
    await setDoc(doc(db, 'game_days', 'play', 'participants', 'p1'), {
      id: 'p1', user_id: MEMBRO, name: 'Membro', play_group_id: 'a',
    });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const dia = (db, id) => doc(db, 'game_days', id);

describe('⭐ o administrador nomeado edita os grupos do Play', () => {
  it('cria, edita e remove grupos', async () => {
    await assertSucceeds(updateDoc(dia(como(ADMIN), 'play'), {
      play_groups: [...GRUPOS, { id: 'c', name: 'Gama', color: 'amber' }], updated_at: new Date(),
    }));
    await assertSucceeds(updateDoc(dia(como(ADMIN), 'play'), { play_groups: [], updated_at: new Date() }));
  });

  it('muda a política entre os grupos', async () => {
    for (const politica of ['queue', 'rotate', 'priority']) {
      // eslint-disable-next-line no-await-in-loop
      await assertSucceeds(updateDoc(dia(como(ADMIN), 'play'), {
        play_groups_policy: politica, updated_at: new Date(),
      }));
    }
  });

  it('grava lista e política juntas — é o que o serviço faz', async () => {
    await assertSucceeds(updateDoc(dia(como(ADMIN), 'play'), {
      play_groups: GRUPOS, play_groups_policy: 'rotate', updated_at: new Date(),
    }));
  });

  it('configura os grupos de um dia que ainda não tinha nenhum', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'game_days', 'novo'), {
        id: 'novo', created_by: DONO, format: 'play', visibility: 'private', status: 'active',
        member_uids: [DONO, ADMIN], invited_uids: [], admin_uids: [ADMIN],
      });
    });
    await assertSucceeds(updateDoc(dia(como(ADMIN), 'novo'), {
      play_groups: GRUPOS, play_groups_policy: 'queue', updated_at: new Date(),
    }));
  });
});

describe('⭐ e SÓ os grupos: nada mais do dia', () => {
  it.each([
    ['o título', { title: 'Outro nome' }],
    ['o status (arquivar)', { status: 'archived' }],
    ['o modo de gestão', { manage_mode: 'participants' }],
    ['a lista de administradores', { admin_uids: [ADMIN, FORA] }],
    ['o dono', { created_by: ADMIN }],
    ['o formato', { format: 'americano' }],
    ['as quadras', { play_courts: 9 }],
    ['a visibilidade', { visibility: 'public' }],
  ])('não muda %s', async (_nome, patch) => {
    await assertFails(updateDoc(dia(como(ADMIN), 'play'), { ...patch, updated_at: new Date() }));
  });

  it('nem escondido junto dos grupos', async () => {
    await assertFails(updateDoc(dia(como(ADMIN), 'play'), {
      play_groups: GRUPOS, title: 'Outro nome', updated_at: new Date(),
    }));
    await assertFails(updateDoc(dia(como(ADMIN), 'play'), {
      play_groups_policy: 'rotate', admin_uids: [ADMIN, FORA], updated_at: new Date(),
    }));
  });
});

describe('⭐ quem não é nomeado não edita os grupos', () => {
  it('o participante de um dia ABERTO opera, mas não edita os grupos', async () => {
    await assertFails(updateDoc(dia(como(MEMBRO), 'aberto'), { play_groups: GRUPOS, updated_at: new Date() }));
  });

  it('membro de um dia restrito, estranho e anônimo não editam', async () => {
    await assertFails(updateDoc(dia(como(MEMBRO), 'play'), { play_groups: [], updated_at: new Date() }));
    await assertFails(updateDoc(dia(como(FORA), 'play'), { play_groups: [], updated_at: new Date() }));
    await assertFails(updateDoc(dia(testEnv.unauthenticatedContext().firestore(), 'play'), { play_groups: [] }));
  });

  it('dia sem `admin_uids`: ninguém além do criador', async () => {
    await assertFails(updateDoc(dia(como(ADMIN), 'sem-admin'), { play_groups: GRUPOS, updated_at: new Date() }));
    await assertFails(updateDoc(dia(como(MEMBRO), 'sem-admin'), { play_groups: GRUPOS, updated_at: new Date() }));
  });

  it('⭐ fora do Play o nomeado não ganha nada', async () => {
    await assertFails(updateDoc(dia(como(ADMIN), 'americano'), { play_groups: GRUPOS, updated_at: new Date() }));
  });
});

describe('o nomeado não grava lixo nos grupos', () => {
  it.each([
    ['grupos que não são uma lista', { play_groups: 'qualquer coisa' }],
    ['grupos em objeto', { play_groups: { a: 1 } }],
    ['mais de 10 grupos', {
      play_groups: Array.from({ length: 11 }, (_, i) => ({ id: `g${i}`, name: `G${i}` })),
    }],
    ['política desconhecida', { play_groups_policy: 'sortear-tudo' }],
    ['política que não é texto', { play_groups_policy: 3 }],
  ])('recusa %s', async (_nome, patch) => {
    await assertFails(updateDoc(dia(como(ADMIN), 'play'), { ...patch, updated_at: new Date() }));
  });

  it('10 grupos cabem (o limite é da tela também)', async () => {
    await assertSucceeds(updateDoc(dia(como(ADMIN), 'play'), {
      play_groups: Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, name: `G${i}` })), updated_at: new Date(),
    }));
  });
});

describe('o que já valia continua valendo', () => {
  it('o criador segue livre nos grupos e em todo o resto', async () => {
    await assertSucceeds(updateDoc(dia(como(DONO), 'play'), {
      play_groups: [], play_groups_policy: 'priority', title: 'Novo', updated_at: new Date(),
    }));
  });

  it('o nomeado move gente de grupo (participante) e mexe na lista de membros', async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'game_days', 'play', 'participants', 'p1'), {
      play_group_id: 'b', updated_at: new Date(),
    }));
    await assertSucceeds(updateDoc(dia(como(ADMIN), 'play'), {
      member_uids: [DONO, ADMIN, MEMBRO, FORA], updated_at: new Date(),
    }));
  });

  it('a lista de membros continua sendo a única outra coisa que o nomeado grava', async () => {
    await assertFails(updateDoc(dia(como(ADMIN), 'play'), {
      member_uids: [DONO, ADMIN, MEMBRO, FORA], title: 'x', updated_at: new Date(),
    }));
  });
});
