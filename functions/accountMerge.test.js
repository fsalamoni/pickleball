/**
 * Unificar o histórico de uma conta EXCLUÍDA — contra um Firestore falso.
 *
 * O que estes testes protegem (é aqui que um erro muda o resultado de outras
 * pessoas):
 *
 *  1. só conta EXCLUÍDA vira origem — conta viva nunca perde a história;
 *  2. conflito (as duas contas na mesma partida/inscrição) BLOQUEIA tudo;
 *  3. só o que é da conta antiga muda — adversários e parceiros ficam iguais;
 *  4. o nome "Atleta removido" volta a ser o da conta que fica;
 *  5. a prévia só LÊ; rodar de novo não acha mais nada;
 *  6. auditoria com os caminhos alterados e pedido de recálculo do ranking.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  analyzeMerge, executeMerge, validateMergeRequest,
  mergeMirrorGame, mergeGameSides, mergeRegistration, trocarNaLista, mergeLadder, mergeLeagueEntry, mergeLeagueLineups,
  REMOVED_ATHLETE,
} = require('./accountMerge.js');
const { createFakeDb, createFakeAuth, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const ADMIN = { uid: 'admin', name: 'Dono', email: 'dono@x.com' };
const ANTIGA = 'leo_velho';
const NOVA = 'leo_novo';

function cenario(extra = {}) {
  const db = createFakeDb({
    // a conta que fica
    [`users/${NOVA}`]: { uid: NOVA, full_name: 'Leonardo Silva', platform_name: 'Leonardo Silva', email: 'leo@x.com' },
    [`athlete_profiles/${NOVA}`]: { platform_name: 'Leonardo Silva', photo_url: 'http://foto' },
    // a auditoria da exclusão (a única prova de quem era)
    'audit_logs/a1': { action: 'admin_account_deleted', user_id: ANTIGA, user_name: 'Leonardo S.', user_email: 'leo.antigo@x.com', created_at_ms: 1 },
    // jogo publicado (o que o ranking lê)
    'club_event_games/gd_d1_g1': {
      source: 'athlete_game_day', event_id: 'd1', status: 'finished', winner_side: 'a',
      side_a_ids: [ANTIGA, 'u2'], side_b_ids: ['u3', 'u4'], side_a: `${ANTIGA}+u2`, side_b: 'u3+u4',
    },
    // jogo publicado de outras pessoas — não pode mudar
    'club_event_games/gd_d1_g2': {
      source: 'athlete_game_day', event_id: 'd1', side_a_ids: ['u2', 'u5'], side_b_ids: ['u3', 'u4'],
    },
    // o dia de jogo e a fonte
    'game_days/d1': { title: 'Sábado', created_by: 'u2', member_uids: ['u2', ANTIGA, 'u3'] },
    'game_days/d1/participants/p1': { user_id: ANTIGA, name: REMOVED_ATHLETE, photo_url: null },
    'game_days/d1/participants/p2': { user_id: 'u2', name: 'Bia' },
    'game_days/d1/games/g1': {
      side_a: [{ id: 'p1', name: REMOVED_ATHLETE, user_id: ANTIGA }, { id: 'p2', name: 'Bia' }],
      side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Duda' }],
      score_a: 11, score_b: 5,
    },
    'game_days/d1/games/g2': {
      side_a: [{ id: 'p2', name: 'Bia' }, { id: 'p5', name: 'Eva' }],
      side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Duda' }],
    },
    // inscrição em torneio: dupla com outra pessoa
    'tournament_registrations/r1': {
      tournament_id: 't1', format: 'doubles', label: `${REMOVED_ATHLETE} / Gui`,
      player_a_user_id: ANTIGA, player_a_name: REMOVED_ATHLETE, player_b_user_id: 'u9', player_b_name: 'Gui',
    },
    'tournament_groups/gr1': { tournament_id: 't1', entrants: [{ id: 'r1', label: `${REMOVED_ATHLETE} / Gui` }, { id: 'r2', label: 'X / Y' }] },
    ...extra,
  });
  const auth = createFakeAuth([NOVA, 'u2']);
  return { db, auth, ctx: { db, auth } };
}

describe('o pedido', () => {
  it('exige as duas contas diferentes, motivo e a palavra de confirmação', () => {
    expect(validateMergeRequest({}).error).toBeTruthy();
    expect(validateMergeRequest({ fromUid: 'a', intoUid: 'a' }).error).toMatch(/mesma/);
    expect(validateMergeRequest({ fromUid: 'a', intoUid: 'b' })).toMatchObject({ mode: 'preview' });
    expect(validateMergeRequest({ mode: 'execute', fromUid: 'a', intoUid: 'b', reason: 'segunda conta' }).error).toMatch(/UNIFICAR/);
    expect(validateMergeRequest({ mode: 'execute', fromUid: 'a', intoUid: 'b', reason: 'segunda conta', confirm: 'unificar' }))
      .toMatchObject({ mode: 'execute' });
  });
});

describe('trocas puras', () => {
  it('lista de uids: troca sem duplicar', () => {
    expect(trocarNaLista(['a', 'x', 'b'], 'x', 'y')).toEqual(['a', 'y', 'b']);
    expect(trocarNaLista(['a', 'x', 'y'], 'x', 'y')).toEqual(['a', 'y']);
    expect(trocarNaLista(['a'], 'x', 'y')).toBeNull();
  });

  it('jogo publicado com as DUAS contas é conflito', () => {
    expect(mergeMirrorGame({ side_a_ids: ['x'], side_b_ids: ['y'] }, 'x', 'y').conflict).toBeTruthy();
  });

  it('jogo: o slot é achado também pelo id de participante, e o nome volta', () => {
    const { patch } = mergeGameSides(
      { side_a: [{ id: 'p1', name: REMOVED_ATHLETE }], side_b: [{ id: 'p9', name: 'Zé' }] },
      'x', 'y', { name: 'Leo', photo: null }, { fromPids: new Set(['p1']) },
    );
    expect(patch.side_a).toEqual([{ id: 'p1', name: 'Leo', user_id: 'y' }]);
    expect(patch.side_b).toBeUndefined();
  });

  it('inscrição com as duas contas como dupla é conflito', () => {
    const r = mergeRegistration({ format: 'doubles', player_a_user_id: 'x', player_b_user_id: 'y' }, 'x', 'y', { name: 'Leo' });
    expect(r.conflict).toBeTruthy();
  });

  it('nome que NÃO é o pseudônimo é mantido', () => {
    const { patch } = mergeRegistration({ format: 'singles', player_a_user_id: 'x', player_a_name: 'Leonardo', label: 'Leonardo' }, 'x', 'y', { name: 'Outro' });
    expect(patch.player_a_name).toBeUndefined();
    expect(patch.player_a_user_id).toBe('y');
  });

  it('ladder com as duas contas soma os pontos numa linha só', () => {
    const p = mergeLadder({ rankings: [{ user_id: 'x', points: 30 }, { user_id: 'y', points: 70 }, { user_id: 'z', points: 5 }] }, 'x', 'y', { name: 'Leo' });
    expect(p.rankings).toEqual([{ user_id: 'y', points: 100 }, { user_id: 'z', points: 5 }]);
  });
});

describe('a prévia', () => {
  it('⭐ só LÊ, diz quem era a conta excluída e o que vai mudar', async () => {
    const { db, ctx } = cenario();
    const antes = JSON.stringify([...db.store.docs]);
    const { report } = await analyzeMerge(ctx, ANTIGA, NOVA);
    expect(JSON.stringify([...db.store.docs])).toBe(antes);
    expect(report.excluida).toMatchObject({ name: 'Leonardo S.', email: 'leo.antigo@x.com' });
    expect(report.destino).toMatchObject({ name: 'Leonardo Silva', email: 'leo@x.com' });
    expect(report.podeUnificar).toBe(true);
    const porItem = Object.fromEntries(report.itens.map((i) => [i.label, i.count]));
    expect(porItem['Jogos publicados no ranking']).toBe(1);
    expect(porItem['Jogos de dia de jogo']).toBe(1);
    expect(porItem['Participações em dia de jogo']).toBe(1);
    expect(porItem['Inscrições em torneio']).toBe(1);
    expect(porItem['Nomes nos grupos de torneio']).toBe(1);
  });

  it('⭐ conta VIVA nunca é origem', async () => {
    const { ctx } = cenario({ [`users/${ANTIGA}`]: { uid: ANTIGA } });
    const { report } = await analyzeMerge(ctx, ANTIGA, NOVA);
    expect(report.podeUnificar).toBe(false);
    expect(report.bloqueios.join(' ')).toMatch(/ainda EXISTE/);
  });

  it('conta de origem com login ativo também bloqueia', async () => {
    const { db } = cenario();
    const auth = createFakeAuth([NOVA, ANTIGA]);
    const { report } = await analyzeMerge({ db, auth }, ANTIGA, NOVA);
    expect(report.bloqueios.join(' ')).toMatch(/login ativo/);
  });

  it('⭐ as duas contas na mesma partida BLOQUEIAM — e nada é gravado', async () => {
    const { ctx, db } = cenario({
      'club_event_games/x': { side_a_ids: [ANTIGA], side_b_ids: [NOVA], winner_side: 'a' },
    });
    const res = await executeMerge(ctx, { fromUid: ANTIGA, intoUid: NOVA, reason: 'r', actor: ADMIN, FieldValue: FakeFieldValue });
    expect(res.status).toBe('blocked');
    expect(res.report.conflitosTotal).toBe(1);
    expect(db.store.log.filter(([t]) => t === 'update')).toHaveLength(0);
  });
});

describe('a execução', () => {
  it('⭐ transfere só o que é da conta antiga, devolve o nome e pede o recálculo', async () => {
    const { db, ctx } = cenario();
    const recalcular = vi.fn(async () => ({ ran: true }));
    const res = await executeMerge(ctx, {
      fromUid: ANTIGA, intoUid: NOVA, reason: 'segunda conta do Leonardo', actor: ADMIN,
      FieldValue: FakeFieldValue, requestRankingRecompute: recalcular,
    });
    expect(res.status).toBe('merged');
    const doc = (p) => db.store.docs.get(p);

    expect(doc('club_event_games/gd_d1_g1').side_a_ids).toEqual([NOVA, 'u2']);
    expect(doc('club_event_games/gd_d1_g1').side_a).toBe(`${NOVA}+u2`);
    expect(doc('club_event_games/gd_d1_g1').side_b_ids).toEqual(['u3', 'u4']);
    // o jogo dos outros ficou intacto
    expect(doc('club_event_games/gd_d1_g2').side_a_ids).toEqual(['u2', 'u5']);

    expect(doc('game_days/d1').member_uids).toEqual(['u2', NOVA, 'u3']);
    expect(doc('game_days/d1').created_by).toBe('u2'); // posse não muda
    expect(doc('game_days/d1/participants/p1')).toMatchObject({ user_id: NOVA, name: 'Leonardo Silva', photo_url: 'http://foto' });
    expect(doc('game_days/d1/participants/p2')).toEqual({ user_id: 'u2', name: 'Bia' });
    expect(doc('game_days/d1/games/g1').side_a[0]).toMatchObject({ id: 'p1', user_id: NOVA, name: 'Leonardo Silva' });
    expect(doc('game_days/d1/games/g1').side_a[1]).toEqual({ id: 'p2', name: 'Bia' });

    expect(doc('tournament_registrations/r1')).toMatchObject({
      player_a_user_id: NOVA, player_a_name: 'Leonardo Silva', player_b_user_id: 'u9', label: 'Leonardo Silva / Gui',
    });
    expect(doc('tournament_groups/gr1').entrants).toEqual([{ id: 'r1', label: 'Leonardo Silva / Gui' }, { id: 'r2', label: 'X / Y' }]);

    const audit = [...db.store.docs.values()].find((d) => d.action === 'admin_account_history_merged');
    expect(audit.details).toMatchObject({ from_uid: ANTIGA, into_uid: NOVA, reason: 'segunda conta do Leonardo', deleted_account_name: 'Leonardo S.' });
    expect(audit.details.caminhos).toContain('club_event_games/gd_d1_g1');
    expect(recalcular).toHaveBeenCalledWith(db, 'unificacao-de-conta', expect.anything());
  });

  it('⭐ rodar de novo não acha mais nada (idempotente)', async () => {
    const { ctx } = cenario();
    await executeMerge(ctx, { fromUid: ANTIGA, intoUid: NOVA, reason: 'r1234', actor: ADMIN, FieldValue: FakeFieldValue });
    const { report } = await analyzeMerge(ctx, ANTIGA, NOVA);
    expect(report.total).toBe(0);
    expect(report.podeUnificar).toBe(false);
  });
});

describe('ligas', () => {
  // Como a exclusão deixa: fora das listas da liga, com o uid nas inscrições.
  const liga = (extra = {}) => ({
    'leagues/l1': { name: 'Liga de Inverno', status: 'running', format: 'team_milp', admins: ['org'], member_uids: ['org', 'u2'], ever_uids: ['org', 'u2'] },
    'leagues/l1/entries/e1': {
      division_id: 'dv1', status: 'active', auto_name: true, name: `${REMOVED_ATHLETE} / Bia / Caio / Duda`,
      player_uids: [ANTIGA, 'u2', 'u3', 'u4'],
      players: [{ uid: ANTIGA, name: REMOVED_ATHLETE, gender: null }, { uid: 'u2', name: 'Bia Lima', gender: 'female' }, { uid: 'u3', name: 'Caio Reis', gender: 'male' }, { uid: 'u4', name: 'Duda Paz', gender: 'female' }],
    },
    'leagues/l1/entries/e2': { division_id: 'dv1', status: 'active', name: 'Rivais', player_uids: ['u5', 'u6', 'u7', 'u8'], players: [] },
    'leagues/l1/matches/m1': {
      division_id: 'dv1', side_a: 'e1', side_b: 'e2', status: 'done',
      lineups: [{ a: [ANTIGA, 'u2'], b: ['u5', 'u6'] }, null, { a: ['u3', 'u4'], b: ['u7', 'u8'] }, null],
    },
    'leagues/l2': { name: 'Outra liga', status: 'running', member_uids: ['x'], ever_uids: ['x'] },
    'leagues/l2/entries/e9': { division_id: 'dv9', status: 'active', player_uids: ['x', 'y'], players: [] },
    ...extra,
  });

  it('⭐ a inscrição, a escalação e a lista da liga passam à conta que fica', async () => {
    const { db, ctx } = cenario({ ...liga(), [`users/${NOVA}`]: { uid: NOVA, platform_name: 'Leonardo Silva', email: 'leo@x.com', competition_gender: 'masculina' } });
    const res = await executeMerge(ctx, { fromUid: ANTIGA, intoUid: NOVA, reason: 'segunda conta', actor: ADMIN, FieldValue: FakeFieldValue });
    expect(res.status).toBe('merged');
    const doc = (p) => db.store.docs.get(p);
    expect(doc('leagues/l1/entries/e1').player_uids).toEqual([NOVA, 'u2', 'u3', 'u4']);
    expect(doc('leagues/l1/entries/e1').players[0]).toEqual({ uid: NOVA, name: 'Leonardo Silva', gender: 'male' });
    expect(doc('leagues/l1/entries/e1').name).toBe('Leonardo / Bia / Caio / Duda');
    expect(doc('leagues/l1/matches/m1').lineups).toEqual([{ a: [NOVA, 'u2'], b: ['u5', 'u6'] }, null, { a: ['u3', 'u4'], b: ['u7', 'u8'] }, null]);
    expect(doc('leagues/l1').member_uids).toEqual(['org', 'u2', NOVA]);
    expect(doc('leagues/l1').ever_uids).toEqual(['org', 'u2', NOVA]);
    expect(doc('leagues/l1').admins).toEqual(['org']); // organizar não é transferido
    // a inscrição adversária e a outra liga ficaram intactas
    expect(doc('leagues/l1/entries/e2').player_uids).toEqual(['u5', 'u6', 'u7', 'u8']);
    expect(doc('leagues/l2').ever_uids).toEqual(['x']);
    const porItem = Object.fromEntries(res.report.itens.map((i) => [i.label, i.count]));
    expect(porItem).toMatchObject({ 'Inscrições em liga': 1, 'Escalações em liga': 1, 'Ligas (quem participa)': 1 });
    // idempotente
    expect((await analyzeMerge(ctx, ANTIGA, NOVA)).report.total).toBe(0);
  });

  it('⭐ as duas contas na mesma divisão BLOQUEIAM', async () => {
    const { db, ctx } = cenario(liga({
      'leagues/l1/entries/e3': { division_id: 'dv1', status: 'active', player_uids: [NOVA, 'z1', 'z2', 'z3'], players: [] },
    }));
    const antes = JSON.stringify([...db.store.docs]);
    const res = await executeMerge(ctx, { fromUid: ANTIGA, intoUid: NOVA, reason: 'segunda conta', actor: ADMIN, FieldValue: FakeFieldValue });
    expect(res.status).toBe('blocked');
    expect(res.report.conflitos.map((c) => c.path)).toContain('leagues/l1/entries/e1');
    expect(JSON.stringify([...db.store.docs])).toBe(antes);
  });

  it('quem já tinha desistido volta ao histórico; nome que não é o pseudônimo fica', () => {
    const { patch, conflict } = mergeLeagueEntry({ status: 'withdrawn', player_uids: [ANTIGA], players: [{ uid: ANTIGA, name: 'Leo Antigo' }], name: 'Leo', auto_name: false }, ANTIGA, NOVA, { name: 'Leonardo Silva' });
    expect(conflict).toBeNull();
    expect(patch).toEqual({ player_uids: [NOVA], players: [{ uid: NOVA, name: 'Leo Antigo' }] });
    expect(mergeLeagueLineups({ lineups: [{ a: ['u1', 'u2'], b: ['u3', 'u4'] }] }, ANTIGA, NOVA)).toBeNull();
    expect(mergeLeagueEntry({ player_uids: [ANTIGA, NOVA], players: [] }, ANTIGA, NOVA, {}).conflict).toMatch(/mesma inscrição/);
  });
});
