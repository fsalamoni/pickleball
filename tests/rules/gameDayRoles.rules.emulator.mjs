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

/* ------------------------------- relatório -------------------------------- */

await env.cleanup();
const falhas = resultados.filter(([s]) => s !== 'ok');
resultados.forEach(([s, n]) => console.log(`${s === 'ok' ? '  ok ' : '  XX '} ${n}`));
console.log(`\n${resultados.length - falhas.length}/${resultados.length} asserções passaram.`);
if (falhas.length) process.exit(1);
