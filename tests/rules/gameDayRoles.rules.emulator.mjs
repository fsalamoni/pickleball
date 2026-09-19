/**
 * Regras do Firestore do DIA DE JOGO: quem pode gerenciar o quê.
 *
 * NÃO roda no `npm test` (Vitest): precisa do emulador do Firestore. Rode antes
 * de mexer nas regras de `game_days`:
 *
 *   npx firebase-tools emulators:exec --only firestore --project demo-picklerush \
 *     "node tests/rules/gameDayRoles.rules.emulator.mjs"
 *
 * O que ele prova, nesta ordem de importância:
 *  1. o padrão RESTRITO não mudou nada para quem já existia;
 *  2. o administrador nomeado gerencia;
 *  3. o modo ABERTO deixa o participante gerenciar;
 *  4. e — o mais importante — ninguém consegue, por tabela, virar dono, se
 *     autonomear administrador ou reabrir a gestão do dia;
 *  5. o AMERICANO APRIMORADO (`americano_live`) entrou sem tocar em regra
 *     nenhuma: vale para ele exatamente o mesmo que já valia para a grade,
 *     e ele NÃO herda o atalho colaborativo do Play.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

const DONO = 'dono';       // criador do dia de jogo
const ADMIN = 'admin';     // nomeado organizador pelo criador
const JOGA = 'joga';       // participante inscrito, sem cargo
const FORA = 'fora';       // nem participa

const env = await initializeTestEnvironment({
  projectId: 'demo-picklerush',
  firestore: {
    rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

const como = (uid) => env.authenticatedContext(uid).firestore();

const resultados = [];
async function t(nome, fn) {
  try { await fn(); resultados.push(['ok', nome]); } catch (e) {
    resultados.push(['FALHOU', `${nome} → ${e.message}`]);
  }
}

/** Semeia um dia de jogo com o modo e os admins pedidos. */
async function semear(id, opcoes = {}) {
  const { manage_mode, admin_uids } = opcoes;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const payload = {
      id, created_by: DONO, title: 'Dia', format: opcoes.format || 'americano',
      visibility: 'private', status: 'active',
      member_uids: [DONO, ADMIN, JOGA], invited_uids: [],
    };
    if (manage_mode) payload.manage_mode = manage_mode;
    if (admin_uids) payload.admin_uids = admin_uids;
    await setDoc(doc(db, 'game_days', id), payload);
    await setDoc(doc(db, 'game_days', id, 'participants', 'p-joga'), { id: 'p-joga', user_id: JOGA, name: 'Joga' });
    await setDoc(doc(db, 'game_days', id, 'games', 'g1'), { id: 'g1', round: 1, side_a: [], side_b: [] });
  });
}

const jogo = (uid, id, gid) => doc(como(uid), 'game_days', id, 'games', gid);
const parte = (uid, id, pid) => doc(como(uid), 'game_days', id, 'participants', pid);
const dia = (uid, id) => doc(como(uid), 'game_days', id);

/* ---------------- 1. Padrão RESTRITO: nada mudou para quem já existia ------- */

await semear('restrito');

await t('restrito: o criador gerencia os jogos', () =>
  assertSucceeds(updateDoc(jogo(DONO, 'restrito', 'g1'), { score_a: 11 })));

await t('restrito: participante comum NÃO mexe nos jogos', () =>
  assertFails(updateDoc(jogo(JOGA, 'restrito', 'g1'), { score_a: 11 })));

await t('restrito: participante comum NÃO insere participante', () =>
  assertFails(setDoc(parte(JOGA, 'restrito', 'novo'), { id: 'novo', name: 'X' })));

await t('restrito: quem está fora não lê nem escreve', () =>
  assertFails(getDoc(jogo(FORA, 'restrito', 'g1'))));

await t('restrito: o atleta ainda pode remover a PRÓPRIA inscrição', () =>
  assertSucceeds(deleteDoc(parte(JOGA, 'restrito', 'p-joga'))));

/* ------------------------- 2. Administrador nomeado ------------------------ */

await semear('comadmin', { admin_uids: [ADMIN] });

await t('admin nomeado gerencia os jogos', () =>
  assertSucceeds(updateDoc(jogo(ADMIN, 'comadmin', 'g1'), { score_a: 11 })));

await t('admin nomeado insere participante', () =>
  assertSucceeds(setDoc(parte(ADMIN, 'comadmin', 'novo'), { id: 'novo', name: 'X', user_id: null })));

await t('admin nomeado remove participante', () =>
  assertSucceeds(deleteDoc(parte(ADMIN, 'comadmin', 'p-joga'))));

await t('admin nomeado atualiza a lista de membros (ao inserir atleta)', () =>
  assertSucceeds(updateDoc(dia(ADMIN, 'comadmin'), { member_uids: [DONO, ADMIN, JOGA, 'outro'] })));

await t('participante comum segue sem gerenciar num dia com admin', () =>
  assertFails(updateDoc(jogo(JOGA, 'comadmin', 'g1'), { score_a: 11 })));

/* --------------------------- 3. Modo ABERTO -------------------------------- */

await semear('aberto', { manage_mode: 'participants' });

await t('aberto: participante inscrito gerencia os jogos', () =>
  assertSucceeds(updateDoc(jogo(JOGA, 'aberto', 'g1'), { score_a: 11 })));

await t('aberto: participante inscrito insere participante', () =>
  assertSucceeds(setDoc(parte(JOGA, 'aberto', 'novo'), { id: 'novo', name: 'X', user_id: null })));

await t('aberto: participante inscrito remove participante', () =>
  assertSucceeds(deleteDoc(parte(JOGA, 'aberto', 'p-joga'))));

await t('aberto: quem NÃO participa continua de fora', () =>
  assertFails(updateDoc(jogo(FORA, 'aberto', 'g1'), { score_a: 11 })));

/* ------- 4. O que NINGUÉM além do criador pode fazer (o que mais importa) --- */

await semear('trava', { manage_mode: 'participants', admin_uids: [ADMIN] });

await t('participante NÃO se autonomeia administrador', () =>
  assertFails(updateDoc(dia(JOGA, 'trava'), { admin_uids: [ADMIN, JOGA] })));

await t('admin nomeado NÃO nomeia outro administrador', () =>
  assertFails(updateDoc(dia(ADMIN, 'trava'), { admin_uids: [ADMIN, JOGA] })));

await t('participante NÃO muda o modo de gestão', () =>
  assertFails(updateDoc(dia(JOGA, 'trava'), { manage_mode: 'owner_only' })));

await t('admin nomeado NÃO muda o modo de gestão', () =>
  assertFails(updateDoc(dia(ADMIN, 'trava'), { manage_mode: 'owner_only' })));

await t('participante NÃO vira dono', () =>
  assertFails(updateDoc(dia(JOGA, 'trava'), { created_by: JOGA })));

await t('participante NÃO renomeia o dia de jogo', () =>
  assertFails(updateDoc(dia(JOGA, 'trava'), { title: 'Meu agora' })));

await t('admin nomeado NÃO renomeia o dia de jogo', () =>
  assertFails(updateDoc(dia(ADMIN, 'trava'), { title: 'Meu agora' })));

await t('participante NÃO arquiva o dia de jogo', () =>
  assertFails(deleteDoc(dia(JOGA, 'trava'))));

await t('participante NÃO publica no ranking (espelho é amarrado ao criador)', () =>
  assertFails(setDoc(doc(como(JOGA), 'club_event_games', 'x'), {
    event_id: 'trava', club_id: null, kind: 'doubles',
    side_a_ids: ['a', 'b'], side_b_ids: ['c', 'd'], score_a: 11, score_b: 7,
  })));

await t('o CRIADOR nomeia administrador e muda o modo', async () => {
  await assertSucceeds(updateDoc(dia(DONO, 'trava'), { admin_uids: [ADMIN, JOGA] }));
  await assertSucceeds(updateDoc(dia(DONO, 'trava'), { manage_mode: 'owner_only' }));
});

/* ------- 5. Americano aprimorado: nem regra nova, nem atalho do Play ------- */

/*
 * Este formato grava PLACAR e alimenta o ranking do dia. Se ele herdasse o
 * atalho do Play (`isPlayGameDayMember`, confinado a `format == 'play'`),
 * qualquer inscrito poderia reescrever um resultado. Não herda — e é isto que
 * as três asserções abaixo prendem. O corolário é o que interessa: a
 * funcionalidade nasceu SEM UMA LINHA nova em `firestore.rules`.
 */
await semear('aovivo', { format: 'americano_live' });

await t('americano aprimorado: o criador lança o resultado', () =>
  assertSucceeds(updateDoc(jogo(DONO, 'aovivo', 'g1'), { score_a: 11, score_b: 7 })));

await t('⭐ americano aprimorado: participante comum NÃO lança resultado (não é Play)', () =>
  assertFails(updateDoc(jogo(JOGA, 'aovivo', 'g1'), { score_a: 11, score_b: 7 })));

await t('⭐ americano aprimorado: participante comum NÃO mexe na fila (não é Play)', () =>
  assertFails(updateDoc(parte(JOGA, 'aovivo', 'p-joga'), { skip_remaining: 3 })));

await semear('aovivo-admin', { format: 'americano_live', admin_uids: [ADMIN] });

await t('americano aprimorado: o admin nomeado lança o resultado', () =>
  assertSucceeds(updateDoc(jogo(ADMIN, 'aovivo-admin', 'g1'), { score_a: 11, score_b: 7 })));

await semear('aovivo-aberto', { format: 'americano_live', manage_mode: 'participants' });

await t('americano aprimorado: com a gestão ABERTA, o participante lança o resultado', () =>
  assertSucceeds(updateDoc(jogo(JOGA, 'aovivo-aberto', 'g1'), { score_a: 11, score_b: 7 })));

await t('americano aprimorado: quem está fora não entra nem com a gestão aberta', () =>
  assertFails(updateDoc(jogo(FORA, 'aovivo-aberto', 'g1'), { score_a: 11 })));

/* ---------------- 6. DIA DE JOGO DA ARENA: quem manda é a arena ------------ */

/*
 * Um dia de jogo com `arena_id` pertence à ARENA. O que estas asserções
 * prendem:
 *  a) quem gerencia a arena administra o dia, mesmo sem tê-lo criado e mesmo
 *     estando fora da lista de participantes;
 *  b) gerenciar UMA arena não dá poder no dia de jogo de OUTRA — nem no
 *     rachão de um atleta qualquer;
 *  c) o atleta se inscreve sozinho (o dia é público) e sai sozinho, mas não
 *     vira dono nem se autonomeia administrador por tabela;
 *  d) o gestor da arena consegue APAGAR o bloqueio de calendário do dia de
 *     jogo — que era justamente o que a regra antiga impedia.
 */
const GESTOR = 'gestor-arena';
const GESTOR2 = 'gestor-outra-arena';
const ATLETA = 'atleta-livre';

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'arenas', 'arena1'), { id: 'arena1', name: 'Arena 1', owner_id: GESTOR });
  await setDoc(doc(db, 'arena_managers', `arena1_${GESTOR}`), { arena_id: 'arena1', user_id: GESTOR, role: 'owner' });
  await setDoc(doc(db, 'arenas', 'arena2'), { id: 'arena2', name: 'Arena 2', owner_id: GESTOR2 });
  await setDoc(doc(db, 'arena_managers', `arena2_${GESTOR2}`), { arena_id: 'arena2', user_id: GESTOR2, role: 'owner' });
  // O dia de jogo da arena 1 — criado por DONO, que nem é gestor.
  await setDoc(doc(db, 'game_days', 'gd-arena'), {
    id: 'gd-arena', arena_id: 'arena1', created_by: DONO, title: 'Sexta na Arena',
    visibility: 'public', status: 'active', format: 'americano',
    member_uids: [DONO], invited_uids: [], admin_uids: [],
    signup_mode: 'day', capacity: null,
    arena_slots: [{ court_id: 'c1', court_name: 'Quadra 1', start_time: '18:00', end_time: '22:00', capacity: null }],
  });
  await setDoc(doc(db, 'game_days', 'gd-arena', 'games', 'g1'), { id: 'g1', round: 1, side_a: [], side_b: [] });
  await setDoc(doc(db, 'arena_unavailabilities', 'blk1'), {
    arena_id: 'arena1', court_id: 'c1', date: '2026-10-02',
    start_time: '18:00', end_time: '22:00', source: 'game_day', game_day_id: 'gd-arena',
  });
});

await t('⭐ arena: o gestor da arena EDITA o dia de jogo que não criou', () =>
  assertSucceeds(updateDoc(dia(GESTOR, 'gd-arena'), { title: 'Sexta na Arena (nova)' })));

await t('⭐ arena: o gestor da arena conduz as partidas', () =>
  assertSucceeds(updateDoc(jogo(GESTOR, 'gd-arena', 'g1'), { score_a: 11, score_b: 9 })));

await t('⭐ arena: o gestor da arena arquiva o dia', () =>
  assertSucceeds(updateDoc(dia(GESTOR, 'gd-arena'), { status: 'archived' })));

await t('⭐ arena: gestor de OUTRA arena não edita este dia de jogo', () =>
  assertFails(updateDoc(dia(GESTOR2, 'gd-arena'), { title: 'invadido' })));

await t('⭐ arena: gestor de OUTRA arena não conduz as partidas', () =>
  assertFails(updateDoc(jogo(GESTOR2, 'gd-arena', 'g1'), { score_a: 1 })));

await t('⭐ arena: gerenciar arena NÃO dá poder no dia de jogo de um atleta', () =>
  assertFails(updateDoc(dia(GESTOR, 'restrito'), { title: 'invadido' })));

await t('arena: atleta qualquer não edita o dia de jogo da arena', () =>
  assertFails(updateDoc(dia(ATLETA, 'gd-arena'), { title: 'invadido' })));

await t('arena: atleta qualquer não conduz as partidas', () =>
  assertFails(updateDoc(jogo(ATLETA, 'gd-arena', 'g1'), { score_a: 1 })));

await t('arena: o dia de jogo é público, então o atleta ENXERGA', () =>
  assertSucceeds(getDoc(dia(ATLETA, 'gd-arena'))));

await t('⭐ arena: o atleta marca a própria presença', () =>
  assertSucceeds(setDoc(parte(ATLETA, 'gd-arena', `p-${ATLETA}`), {
    id: `p-${ATLETA}`, user_id: ATLETA, name: 'Atleta', arena_court_id: 'c1',
  })));

await t('⭐ arena: o atleta NÃO inscreve outra pessoa', () =>
  assertFails(setDoc(parte(ATLETA, 'gd-arena', 'p-terceiro'), {
    id: 'p-terceiro', user_id: 'terceiro', name: 'Terceiro',
  })));

await t('arena: o atleta desmarca a própria presença', () =>
  assertSucceeds(deleteDoc(parte(ATLETA, 'gd-arena', `p-${ATLETA}`))));

await t('⭐ arena: o atleta não vira dono do dia de jogo', () =>
  assertFails(updateDoc(dia(ATLETA, 'gd-arena'), { created_by: ATLETA, member_uids: [ATLETA] })));

await t('⭐ arena: o atleta não se autonomeia administrador', () =>
  assertFails(updateDoc(dia(ATLETA, 'gd-arena'), { admin_uids: [ATLETA] })));

await t('⭐ arena: marcar presença também ENTRA na lista de membros', () =>
  assertSucceeds(updateDoc(dia(ATLETA, 'gd-arena'), {
    member_uids: [DONO, ATLETA],
  })));

await t('⭐ arena: sair devolve a lista SEM mim (era recusado antes)', () =>
  assertSucceeds(updateDoc(dia(ATLETA, 'gd-arena'), { member_uids: [DONO] })));

await env.withSecurityRulesDisabled(async (ctx) => {
  await updateDoc(doc(ctx.firestore(), 'game_days', 'gd-arena'), {
    member_uids: [DONO, ATLETA, 'terceiro'],
  });
});

await t('⭐ arena: sair NÃO é brecha para esvaziar a lista dos outros', () =>
  assertFails(updateDoc(dia(ATLETA, 'gd-arena'), { member_uids: [] })));

await t('⭐ arena: ninguém remove OUTRA pessoa pela lista de membros', () =>
  assertFails(updateDoc(dia(ATLETA, 'gd-arena'), { member_uids: [DONO, ATLETA] })));

await t('⭐ arena: entrar de novo é inofensivo (idempotente)', () =>
  assertSucceeds(updateDoc(dia(ATLETA, 'gd-arena'), { member_uids: [DONO, ATLETA, 'terceiro'] })));

await t('⭐ arena: ninguém INSERE terceiro pela lista de membros', () =>
  assertFails(updateDoc(dia(ATLETA, 'gd-arena'), { member_uids: [DONO, ATLETA, 'terceiro', 'penetra'] })));

await t('⭐ arena: sair não vem junto com outra mudança escondida', () =>
  assertFails(updateDoc(dia(ATLETA, 'gd-arena'), {
    member_uids: [DONO, 'terceiro'], title: 'renomeado de tabela',
  })));

await t('⭐ bloqueio de calendário: o gestor da arena APAGA o dele (a regra antiga impedia)', () =>
  assertSucceeds(deleteDoc(doc(como(GESTOR), 'arena_unavailabilities', 'blk1'))));

await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'arena_unavailabilities', 'blk2'), {
    arena_id: 'arena1', court_id: 'c1', date: '2026-10-09',
    start_time: '18:00', end_time: '22:00', source: 'game_day', game_day_id: 'gd-arena',
  });
});

await t('⭐ bloqueio de calendário: gestor de OUTRA arena não apaga', () =>
  assertFails(deleteDoc(doc(como(GESTOR2), 'arena_unavailabilities', 'blk2'))));

await t('bloqueio de calendário: atleta qualquer não apaga', () =>
  assertFails(deleteDoc(doc(como(ATLETA), 'arena_unavailabilities', 'blk2'))));

await t('bloqueio de calendário: o gestor cria o da sua arena', () =>
  assertSucceeds(setDoc(doc(como(GESTOR), 'arena_unavailabilities', 'blk3'), {
    arena_id: 'arena1', court_id: 'c1', date: '2026-10-16', start_time: '08:00', end_time: '10:00',
  })));

await t('⭐ bloqueio de calendário: ninguém cria bloqueio na arena dos outros', () =>
  assertFails(setDoc(doc(como(GESTOR2), 'arena_unavailabilities', 'blk4'), {
    arena_id: 'arena1', court_id: 'c1', date: '2026-10-16', start_time: '08:00', end_time: '10:00',
  })));

await t('⭐ bloqueio de calendário: não dá para mudar um bloqueio de arena', () =>
  assertFails(updateDoc(doc(como(GESTOR), 'arena_unavailabilities', 'blk2'), { arena_id: 'arena2' })));

/* ------- 7. DIA DE JOGO DO CLUBE: quem manda é o clube (Onda AS) ----------- */

/*
 * Um dia de jogo com `club_id` pertence ao CLUBE, como o de arena pertence à
 * arena. O que estas asserções prendem:
 *  a) quem ADMINISTRA o clube administra o dia, mesmo sem tê-lo criado e mesmo
 *     estando fora da lista de participantes — senão o dia ficaria órfão
 *     quando quem agendou a data saísse do clube;
 *  b) administrar OUTRO clube não dá poder nenhum aqui, e administrar um clube
 *     qualquer não dá poder no rachão de um atleta;
 *  c) o MEMBRO comum do clube LÊ o dia (era o que ele já podia no evento
 *     legado), mas não conduz as partidas nem configura nada;
 *  d) quem não é do clube não lê — o dia é `private`, e não vira público por
 *     ser de clube;
 *  e) o administrador do clube PUBLICA no ranking, porque a regra de
 *     `club_event_games` já conferia `isClubAdmin(club_id)` e o espelho passou
 *     a gravar o clube dono.
 */
const CADM = 'admin-do-clube';    // administrador do clube 1
const CMEMBRO = 'membro-do-clube'; // membro comum do clube 1
const CADM2 = 'admin-outro-clube'; // administrador do clube 2

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'clubs', 'clube1'), { id: 'clube1', name: 'Clube 1', created_by: CADM });
  await setDoc(doc(db, 'club_members', `clube1_${CADM}`), { club_id: 'clube1', user_id: CADM, role: 'admin' });
  await setDoc(doc(db, 'club_members', `clube1_${CMEMBRO}`), { club_id: 'clube1', user_id: CMEMBRO, role: 'member' });
  await setDoc(doc(db, 'clubs', 'clube2'), { id: 'clube2', name: 'Clube 2', created_by: CADM2 });
  await setDoc(doc(db, 'club_members', `clube2_${CADM2}`), { club_id: 'clube2', user_id: CADM2, role: 'admin' });
  // O dia de jogo do clube 1 — criado por DONO, que nem é do clube.
  await setDoc(doc(db, 'game_days', 'gd-clube'), {
    id: 'gd-clube', club_id: 'clube1', club_name: 'Clube 1', club_event_id: 'ev1',
    created_by: DONO, title: 'Rachão de quinta — 25/09',
    visibility: 'private', status: 'active', format: 'americano',
    member_uids: [DONO], invited_uids: [], admin_uids: [], manage_mode: 'participants',
  });
  await setDoc(doc(db, 'game_days', 'gd-clube', 'games', 'g1'), { id: 'g1', round: 1, side_a: [], side_b: [] });
  await setDoc(doc(db, 'game_days', 'gd-clube', 'participants', 'p-membro'), {
    id: 'p-membro', user_id: CMEMBRO, name: 'Membro',
  });
});

await t('⭐ clube: o administrador do clube EDITA o dia de jogo que não criou', () =>
  assertSucceeds(updateDoc(dia(CADM, 'gd-clube'), { title: 'Rachão de quinta (nova)' })));

await t('⭐ clube: o administrador do clube conduz as partidas', () =>
  assertSucceeds(updateDoc(jogo(CADM, 'gd-clube', 'g1'), { score_a: 11, score_b: 9 })));

await t('⭐ clube: o administrador do clube insere participante', () =>
  assertSucceeds(setDoc(parte(CADM, 'gd-clube', 'novo'), { id: 'novo', name: 'X', user_id: null })));

await t('⭐ clube: administrador de OUTRO clube não edita este dia de jogo', () =>
  assertFails(updateDoc(dia(CADM2, 'gd-clube'), { title: 'invadido' })));

await t('⭐ clube: administrador de OUTRO clube não conduz as partidas', () =>
  assertFails(updateDoc(jogo(CADM2, 'gd-clube', 'g1'), { score_a: 1 })));

await t('⭐ clube: administrar clube NÃO dá poder no dia de jogo de um atleta', () =>
  assertFails(updateDoc(dia(CADM, 'restrito'), { title: 'invadido' })));

await t('⭐ clube: o MEMBRO do clube LÊ o dia de jogo (é privado, e ele não é membro do dia)', () =>
  assertSucceeds(getDoc(dia(CMEMBRO, 'gd-clube'))));

await t('⭐ clube: o MEMBRO do clube lê as partidas', () =>
  assertSucceeds(getDoc(jogo(CMEMBRO, 'gd-clube', 'g1'))));

await t('⭐ clube: quem NÃO é do clube não lê o dia de jogo', () =>
  assertFails(getDoc(dia(FORA, 'gd-clube'))));

await t('⭐ clube: quem NÃO é do clube não lê as partidas', () =>
  assertFails(getDoc(jogo(FORA, 'gd-clube', 'g1'))));

await t('⭐ clube: membro comum NÃO renomeia o dia de jogo', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube'), { title: 'meu agora' })));

await t('⭐ clube: membro comum NÃO se autonomeia administrador', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube'), { admin_uids: [CMEMBRO] })));

await t('⭐ clube: membro comum NÃO vira dono', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube'), { created_by: CMEMBRO })));

await t('⭐ clube: o administrador do clube PUBLICA no ranking', () =>
  assertSucceeds(setDoc(doc(como(CADM), 'club_event_games', 'gd_gd-clube_g1'), {
    event_id: 'gd-clube', date_id: '_', club_id: 'clube1', kind: 'doubles',
    side_a_ids: ['a', 'b'], side_b_ids: ['c', 'd'], score_a: 11, score_b: 7,
    winner_side: 'a', status: 'finished',
  })));

await t('⭐ clube: membro comum NÃO publica no ranking', () =>
  assertFails(setDoc(doc(como(CMEMBRO), 'club_event_games', 'gd_gd-clube_g2'), {
    event_id: 'gd-clube', date_id: '_', club_id: 'clube1', kind: 'doubles',
    side_a_ids: ['a', 'b'], side_b_ids: ['c', 'd'], score_a: 11, score_b: 7,
    winner_side: 'a', status: 'finished',
  })));

await t('⭐ clube: administrador de OUTRO clube não publica em nome deste', () =>
  assertFails(setDoc(doc(como(CADM2), 'club_event_games', 'gd_gd-clube_g3'), {
    event_id: 'gd-clube', date_id: '_', club_id: 'clube1', kind: 'doubles',
    side_a_ids: ['a', 'b'], side_b_ids: ['c', 'd'], score_a: 11, score_b: 7,
    winner_side: 'a', status: 'finished',
  })));

await t('⭐ clube: o MEMBRO marca a própria presença', () =>
  assertSucceeds(setDoc(parte(CMEMBRO, 'gd-clube', `p-${CMEMBRO}-2`), {
    id: `p-${CMEMBRO}-2`, user_id: CMEMBRO, name: 'Membro',
  })));

await t('⭐ clube: o MEMBRO não inscreve TERCEIRO', () =>
  assertFails(setDoc(parte(CMEMBRO, 'gd-clube', 'p-terceiro'), {
    id: 'p-terceiro', user_id: 'terceiro', name: 'Terceiro',
  })));

await t('⭐ clube: quem NÃO é do clube não se inscreve', () =>
  assertFails(setDoc(parte(FORA, 'gd-clube', `p-${FORA}`), {
    id: `p-${FORA}`, user_id: FORA, name: 'Fora',
  })));

/*
 * Entrar e sair mexendo SÓ na lista de membros. Testado num dia de jogo de
 * clube com a gestão RESTRITA de propósito: no modo aberto qualquer membro já
 * gerencia a lista (é o que lhe permite inserir e remover participantes), e aí
 * as travas abaixo não seriam a condição exercitada. Aqui elas são o único
 * caminho — que é exatamente a situação do membro que quer entrar sozinho.
 */
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'game_days', 'gd-clube-restrito'), {
    id: 'gd-clube-restrito', club_id: 'clube1', club_event_id: 'ev1',
    created_by: DONO, title: 'Quinta do clube',
    visibility: 'private', status: 'active', format: 'americano',
    member_uids: [DONO, 'terceiro'], invited_uids: [], admin_uids: [],
    manage_mode: 'owner_only',
  });
});

await t('⭐ clube restrito: o MEMBRO entra acrescentando SÓ a si mesmo', () =>
  assertSucceeds(updateDoc(dia(CMEMBRO, 'gd-clube-restrito'), { member_uids: [DONO, 'terceiro', CMEMBRO] })));

await t('⭐ clube restrito: entrar NÃO é brecha para inserir terceiro', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube-restrito'), { member_uids: [DONO, 'terceiro', CMEMBRO, 'penetra'] })));

await t('⭐ clube restrito: sair devolve a lista SEM mim', () =>
  assertSucceeds(updateDoc(dia(CMEMBRO, 'gd-clube-restrito'), { member_uids: [DONO, 'terceiro'] })));

await env.withSecurityRulesDisabled(async (ctx) => {
  await updateDoc(doc(ctx.firestore(), 'game_days', 'gd-clube-restrito'), {
    member_uids: [DONO, CMEMBRO, 'terceiro'],
  });
});

await t('⭐ clube restrito: sair NÃO é brecha para esvaziar a lista dos outros', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube-restrito'), { member_uids: [] })));

await t('⭐ clube restrito: ninguém remove OUTRA pessoa pela lista de membros', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube-restrito'), { member_uids: [DONO, CMEMBRO] })));

await t('⭐ clube restrito: entrar não vem junto com outra mudança escondida', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube-restrito'), {
    member_uids: [DONO, CMEMBRO, 'terceiro'], title: 'renomeado de tabela',
  })));

await t('⭐ clube restrito: membro comum NÃO conduz as partidas (a gestão é do criador)', () =>
  assertFails(updateDoc(dia(CMEMBRO, 'gd-clube-restrito'), { title: 'meu agora' })));

await t('⭐ clube: quem NÃO é do clube não entra na lista de membros', () =>
  assertFails(updateDoc(dia(FORA, 'gd-clube-restrito'), { member_uids: [DONO, CMEMBRO, 'terceiro', FORA] })));

await t('⭐ clube: o administrador do clube arquiva o dia', () =>
  assertSucceeds(updateDoc(dia(CADM, 'gd-clube'), { status: 'archived' })));

/* ------------------------------- relatório -------------------------------- */

await env.cleanup();
const falhas = resultados.filter(([s]) => s !== 'ok');
resultados.forEach(([s, n]) => console.log(`${s === 'ok' ? '  ok ' : '  XX '} ${n}`));
console.log(`\n${resultados.length - falhas.length}/${resultados.length} asserções passaram.`);
if (falhas.length) process.exit(1);
