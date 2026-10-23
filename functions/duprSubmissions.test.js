/**
 * Envio automático ao DUPR: quais partidas viram candidatas, o que a política
 * decide, o ciclo do livro (retida → fila → enviada → atualizada/excluída), as
 * falhas com nova tentativa e as ações do admin.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sub = require('./duprSubmissions.js');
const { DuprError } = require('./duprClient.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const MIN = 60 * 1000;
const ADMIN = { uid: 'adm', name: 'Admin', isPlatformAdmin: true };
const COMUM = { uid: 'ana', isPlatformAdmin: false };
const POL_RULES = { mode: 'rules', audience: 'all', grace_minutes: 30 };
const LINK = (id) => ({ dupr_id: id, entitlements: ['BASIC_L1'] });

const torneio = { id: 't1', name: 'Aberto', visibility: 'public', status: 'in_progress', created_by: 'org', city: 'Porto Alegre', state: 'RS' };
const regs = new Map([
  ['r1', { format: 'doubles', player_a_user_id: 'u1', player_b_user_id: 'u2' }],
  ['r2', { format: 'doubles', player_a_user_id: 'u3', player_b_user_id: 'u4' }],
  ['r3', { format: 'doubles', player_a_user_id: 'u3', player_b_user_id: null }],
]);
const jogoTorneio = (extra = {}) => ({
  id: 'm1', tournament_id: 't1', modality_id: 'mod1', stage_index: 0, status: 'finished', winner_side: 'a',
  side_a_ids: ['r1'], side_b_ids: ['r2'], games: [{ a: 11, b: 7 }], result_recorded_at: NOW - 5 * MIN, ...extra,
});

describe('buildCandidates', () => {
  const base = { regById: regs, tournamentById: new Map([['t1', torneio]]), modalityById: new Map([['mod1', { name: 'Duplas 4.0', stages: [{ type: 'elimination' }] }]]) };

  it('jogo de torneio: identificador, faixa fixa, data de Brasília e local', () => {
    const [c] = sub.buildCandidates({ ...base, tournamentMatches: [jogoTorneio()] });
    expect(c).toMatchObject({
      identifier: 'pr:tm:m1', origin: 'tournament', bucket: 'tournament_fixed', sideA: ['u1', 'u2'], sideB: ['u3', 'u4'],
      semConta: false, date: '2026-10-23', event: 'Aberto', bracket: 'Duplas 4.0', location: 'Porto Alegre, RS', grace: true, organizer_uid: 'org',
    });
  });

  it('meia-noite UTC ainda é o dia anterior em Brasília', () => {
    const [c] = sub.buildCandidates({ ...base, tournamentMatches: [jogoTorneio({ result_recorded_at: Date.UTC(2026, 9, 24, 1, 0) })] });
    expect(c.date).toBe('2026-10-23');
  });

  it('fase Americano vira faixa de rodízio e respeita a escolha da modalidade', () => {
    const modalityById = new Map([['mod1', { stages: [{ type: 'americano' }], dupr_submit: true }]]);
    const [c] = sub.buildCandidates({ ...base, modalityById, tournamentMatches: [jogoTorneio()] });
    expect(c).toMatchObject({ bucket: 'tournament_rotation', creatorChoice: true });
  });

  it('fica de fora: W.O., sem vencedor, torneio fora do ranking e chancelado por federação', () => {
    const chancelado = { ...torneio, id: 't2', federation_id: 'f', federation_sanction: { status: 'approved' } };
    const rascunho = { ...torneio, id: 't3', status: 'draft' };
    const tournamentById = new Map([['t1', torneio], ['t2', chancelado], ['t3', rascunho]]);
    const out = sub.buildCandidates({
      ...base, tournamentById,
      tournamentMatches: [jogoTorneio({ status: 'walkover' }), jogoTorneio({ id: 'm2', winner_side: null }),
        jogoTorneio({ id: 'm3', tournament_id: 't2' }), jogoTorneio({ id: 'm4', tournament_id: 't3' })],
    });
    expect(out).toEqual([]);
  });

  it('jogador sem conta marca a partida (ela fica retida, não some)', () => {
    const [c] = sub.buildCandidates({ ...base, tournamentMatches: [jogoTorneio({ side_b_ids: ['r3'] })] });
    expect(c.semConta).toBe(true);
  });

  it('dia de jogo publicado: data do dia, formato, escolha de quem criou e sem carência', () => {
    const gameDayById = new Map([['gd1', { title: 'Quinta', date: '2026-10-22', format: 'americano', created_by: 'org2', dupr_submit: true }]]);
    const [c] = sub.buildCandidates({
      gameDayById,
      clubEventMatches: [{ id: 'gd_gd1_g1', source: 'athlete_game_day', event_id: 'gd1', status: 'finished', winner_side: 'b', side_a_ids: ['u1'], side_b_ids: ['u2'], set_scores: [{ a: 9, b: 11 }] }],
    });
    expect(c).toMatchObject({ identifier: 'pr:gd:gd_gd1_g1', origin: 'game_day', bucket: 'game_day_rotation', creatorChoice: true, date: '2026-10-22', grace: false, games: [{ a: 9, b: 11 }], playType: 'RECREATIONAL' });
  });

  it('Play vira a faixa do Play (que nunca vai) e confronto de equipe vira torneio por equipes', () => {
    const gameDayById = new Map([['gd1', { date: '2026-10-22', format: 'play' }]]);
    const out = sub.buildCandidates({
      gameDayById, tournamentById: new Map([['t1', torneio]]),
      clubEventMatches: [
        { id: 'a', source: 'athlete_game_day', event_id: 'gd1', winner_side: 'a', side_a_ids: ['u1'], side_b_ids: ['u2'], score_a: 11, score_b: 5 },
        { id: 'b', source: 'team_confrontation', tournament_id: 't1', winner_side: 'a', side_a_ids: ['u1'], side_b_ids: ['u2'], games: [{ a: 11, b: 5 }] },
      ],
    });
    expect(out.map((c) => c.bucket)).toEqual(['game_day_play', 'tournament_team']);
  });
});

describe('planEntry', () => {
  const c = sub.buildCandidates({ regById: regs, tournamentById: new Map([['t1', torneio]]), tournamentMatches: [jogoTorneio()] })[0];
  const links = { u1: LINK('A1'), u2: LINK('A2'), u3: LINK('B1'), u4: LINK('B2') };

  it('política desligada: não vai', () => {
    expect(sub.planEntry(c, links, { mode: 'off' })).toMatchObject({ kind: 'skip', reason: 'policy_off' });
  });

  it('todos com DUPR: corpo pronto com os IDs DUPR, a chave e a chave do placar', () => {
    const e = sub.planEntry(c, links, POL_RULES);
    expect(e.kind).toBe('ready');
    expect(e.payload).toMatchObject({ identifier: 'pr:tm:m1', matchDate: '2026-10-23', format: 'DOUBLES', matchPlayType: 'TOURNAMENT', teamA: { player1: 'A1', player2: 'A2', game1: 11 }, teamB: { player1: 'B1', player2: 'B2', game1: 7 } });
    expect(e.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('falta DUPR ou assinatura: retida, dizendo quem', () => {
    const e = sub.planEntry(c, { ...links, u2: undefined, u4: { dupr_id: 'X', entitlements: [] } }, POL_RULES);
    expect(e).toMatchObject({ kind: 'held', problems: ['no_dupr', 'no_entitlement'], missing: ['u2'], noEntitlement: ['u4'] });
  });

  it('game empatado não é válido para o DUPR', () => {
    const empate = { ...c, games: [{ a: 10, b: 10 }] };
    expect(sub.planEntry(empate, links, POL_RULES)).toMatchObject({ kind: 'skip', reason: 'tied_game' });
  });
});

describe('reconcile', () => {
  const c = sub.buildCandidates({ regById: regs, tournamentById: new Map([['t1', torneio]]), tournamentMatches: [jogoTorneio()] })[0];
  const links = { u1: LINK('A1'), u2: LINK('A2'), u3: LINK('B1'), u4: LINK('B2') };
  const pronto = sub.planEntry(c, links, POL_RULES);
  const opts = { now: NOW, graceMs: 30 * MIN };

  it('nova de torneio entra na fila com a carência, sem chamar o DUPR', () => {
    const r = sub.reconcile(null, c, pronto, opts);
    expect(r.action).toBe('none');
    expect(r.doc).toMatchObject({ status: 'queued', due_at_ms: NOW + 30 * MIN, uids: ['u1', 'u2', 'u3', 'u4'], organizer_uid: 'org' });
  });

  it('carência vencida: cria no DUPR', () => {
    const fila = sub.reconcile(null, c, pronto, opts).doc;
    const r = sub.reconcile(fila, c, pronto, { ...opts, now: NOW + 31 * MIN });
    expect(r.action).toBe('create');
    expect(r.payload.identifier).toBe('pr:tm:m1');
  });

  it('placar corrigido na fila: a carência recomeça', () => {
    const fila = sub.reconcile(null, c, pronto, opts).doc;
    const outro = sub.planEntry({ ...c, games: [{ a: 11, b: 9 }] }, links, POL_RULES);
    const r = sub.reconcile(fila, c, outro, { ...opts, now: NOW + 20 * MIN });
    expect(r.doc.due_at_ms).toBe(NOW + 50 * MIN);
  });

  it('enviada: igual não faz nada; placar mudou atualiza; resultado sumiu apaga', () => {
    const enviada = { ...sub.reconcile(null, c, pronto, opts).doc, status: 'sent', match_code: '123', sent_hash: pronto.hash };
    expect(sub.reconcile(enviada, c, pronto, opts)).toEqual({ doc: undefined, action: 'none' });
    const outro = sub.planEntry({ ...c, games: [{ a: 11, b: 9 }] }, links, POL_RULES);
    expect(sub.reconcile(enviada, c, outro, opts).action).toBe('update');
    const r = sub.reconcile(enviada, null, null, opts);
    expect(r.action).toBe('delete');
    expect(r.doc.reason).toBe('match_removed');
  });

  it('enviada não sai do DUPR por mudança de política nem por alguém desconectar', () => {
    const enviada = { status: 'sent', match_code: '123', sent_hash: pronto.hash };
    expect(sub.reconcile(enviada, c, sub.planEntry(c, links, { mode: 'off' }), opts).action).toBe('none');
    expect(sub.reconcile(enviada, c, sub.planEntry(c, {}, POL_RULES), opts)).toEqual({ doc: undefined, action: 'none' });
  });

  it('retida, e na fila assim que todos conectam', () => {
    const retida = sub.reconcile(null, c, sub.planEntry(c, {}, POL_RULES), opts).doc;
    expect(retida).toMatchObject({ status: 'held', missing_uids: ['u1', 'u2', 'u3', 'u4'] });
    expect(sub.reconcile(retida, c, pronto, opts).doc.status).toBe('queued');
  });

  it('modo manual: aguarda aprovação; aprovada segue para a fila', () => {
    const manual = sub.planEntry(c, links, { ...POL_RULES, mode: 'manual' });
    const r = sub.reconcile(null, c, manual, opts);
    expect(r.doc).toMatchObject({ status: 'awaiting_approval', approved: false });
    const aprovada = { ...r.doc, status: 'queued', approved: true, due_at_ms: NOW };
    expect(sub.reconcile(aprovada, c, manual, opts).action).toBe('create');
  });

  it('travada pelo admin: nada muda', () => {
    expect(sub.reconcile({ status: 'deleted', blocked: true }, c, pronto, opts)).toEqual({ doc: undefined, action: 'none' });
  });

  it('não enviada e excluída pela política: sai do livro', () => {
    const fila = sub.reconcile(null, c, pronto, opts).doc;
    expect(sub.reconcile(fila, c, sub.planEntry(c, links, { mode: 'off' }), opts).doc).toBeNull();
  });

  it('falhou: tenta de novo na hora marcada; falha numa atualização volta a atualizar', () => {
    const falhou = { status: 'failed', payload_hash: pronto.hash, next_try_ms: NOW - 1 };
    expect(sub.reconcile(falhou, c, pronto, opts).action).toBe('create');
    expect(sub.reconcile({ ...falhou, next_try_ms: NOW + MIN }, c, pronto, opts).action).toBe('none');
    expect(sub.reconcile({ ...falhou, match_code: '9' }, c, pronto, opts).action).toBe('update');
  });
});

describe('applyResult', () => {
  const doc = { identifier: 'pr:tm:m1', status: 'queued', payload_hash: 'h1' };
  it('sucesso guarda o matchCode e o hash enviado', () => {
    expect(sub.applyResult(doc, 'create', { ok: true, matchCode: '777' }, { now: NOW })).toMatchObject({ status: 'sent', match_code: '777', sent_hash: 'h1', sent_at_ms: NOW });
  });
  it('erro temporário: nova tentativa com espera crescente; recusa do DUPR: só o admin', () => {
    const f1 = sub.applyResult(doc, 'create', { ok: false, status: 503, message: 'x' }, { now: NOW });
    expect(f1).toMatchObject({ status: 'failed', attempts: 1, next_try_ms: NOW + 15 * MIN });
    const f2 = sub.applyResult(f1, 'create', { ok: false, status: 0, message: 'rede' }, { now: NOW });
    expect(f2.next_try_ms).toBe(NOW + 30 * MIN);
    expect(sub.applyResult(doc, 'create', { ok: false, status: 400, message: 'inválida' }, { now: NOW }).next_try_ms).toBeNull();
    expect(sub.applyResult({ ...doc, attempts: sub.MAX_TRIES - 1 }, 'create', { ok: false, status: 500, message: 'x' }, { now: NOW }).next_try_ms).toBeNull();
  });
});

/* -------------------------------------------------------------- de ponta */

function cliente() {
  let n = 0;
  return {
    createMatch: vi.fn(async (m) => ({ status: 'SUCCESS', result: { identifier: m.identifier, matchCode: String(100 + (n += 1)) } })),
    updateMatch: vi.fn(async (m) => ({ status: 'SUCCESS', result: { identifier: m.identifier, matchCode: String(m.matchId) } })),
    deleteMatch: vi.fn(async () => ({ status: 'SUCCESS' })),
  };
}

function cenario({ politica = POL_RULES, flag = true, extra = {} } = {}) {
  const db = createFakeDb({
    'platform_settings/global': { feature_flags: { dupr_official_sync: flag } },
    'platform_settings/dupr_policy': politica,
    'tournaments/t1': torneio,
    'tournament_modalities/mod1': { stages: [{ type: 'elimination' }] },
    'tournament_registrations/r1': regs.get('r1'),
    'tournament_registrations/r2': regs.get('r2'),
    'tournament_matches/m1': jogoTorneio(),
    'game_days/gd1': { title: 'Quinta', date: '2026-10-22', format: 'americano', created_by: 'org2', dupr_submit: true },
    'club_event_games/gd_gd1_g1': { source: 'athlete_game_day', event_id: 'gd1', status: 'finished', winner_side: 'a', side_a_ids: ['u1'], side_b_ids: ['u3'], score_a: 11, score_b: 4 },
    'dupr_links/u1': LINK('A1'), 'dupr_links/u2': LINK('A2'), 'dupr_links/u3': LINK('B1'), 'dupr_links/u4': LINK('B2'),
    'users/u1': { role: 'platform_admin' },
    ...extra,
  });
  const client = cliente();
  const ctx = (now = NOW) => ({ db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { warn() {}, error() {} } });
  const getClient = vi.fn(async () => ({ client, secrets: { env: 'uat' } }));
  const doc = (id) => db.store.docs.get(`dupr_submissions/${id}`);
  return { db, client, ctx, getClient, doc };
}

describe('runSubmissions', () => {
  it('flag ou política desligada: não lê partidas nem chama o DUPR', async () => {
    const a = cenario({ flag: false });
    expect(await sub.runSubmissions(a.ctx(), a.getClient)).toEqual({ skipped: 'flag_off' });
    const b = cenario({ politica: { mode: 'off' } });
    expect(await sub.runSubmissions(b.ctx(), b.getClient)).toEqual({ skipped: 'policy_off' });
    expect(b.getClient).not.toHaveBeenCalled();
  });

  it('dia de jogo vai na hora; torneio espera a carência e vai na passada seguinte', async () => {
    const s = cenario();
    const r1 = await sub.runSubmissions(s.ctx(), s.getClient);
    expect(r1).toMatchObject({ candidates: 2, created: 1 });
    expect(s.doc('pr:gd:gd_gd1_g1')).toMatchObject({ status: 'sent', match_code: '101' });
    expect(s.doc('pr:tm:m1')).toMatchObject({ status: 'queued', due_at_ms: NOW + 30 * MIN });
    await sub.runSubmissions(s.ctx(NOW + 31 * MIN), s.getClient);
    expect(s.doc('pr:tm:m1')).toMatchObject({ status: 'sent', match_code: '102' });
    expect(s.client.createMatch).toHaveBeenCalledTimes(2);
    expect([...s.db.store.docs.values()].filter((d) => d.action === 'dupr_submission_sent')).toHaveLength(2);
    expect(s.db.store.docs.get('platform_settings/dupr_submissions').last_result.by_status).toEqual({ sent: 2 });
  });

  it('dia despublicado depois de enviado: apaga no DUPR', async () => {
    const s = cenario();
    await sub.runSubmissions(s.ctx(), s.getClient);
    s.db.store.docs.delete('club_event_games/gd_gd1_g1');
    await sub.runSubmissions(s.ctx(NOW + MIN), s.getClient);
    expect(s.client.deleteMatch).toHaveBeenCalledWith('pr:gd:gd_gd1_g1', '101');
    expect(s.doc('pr:gd:gd_gd1_g1').status).toBe('deleted');
  });

  it('piloto da política: só partidas com algum admin da plataforma', async () => {
    const s = cenario({ politica: { ...POL_RULES, audience: 'admins' }, extra: { 'users/u1': { role: 'athlete' }, 'users/u3': { role: 'platform_admin' } } });
    s.db.store.docs.set('club_event_games/gd_gd1_g1', { ...s.db.store.docs.get('club_event_games/gd_gd1_g1'), side_b_ids: ['u4'] });
    const r = await sub.runSubmissions(s.ctx(), s.getClient);
    expect(r.candidates).toBe(1);
    expect(s.doc('pr:gd:gd_gd1_g1')).toBeUndefined();
  });

  it('outra passada rodando: não roda junto (não envia duas vezes)', async () => {
    const s = cenario({ extra: { 'platform_settings/dupr_submissions': { lease_until_ms: NOW + MIN } } });
    expect(await sub.runSubmissions(s.ctx(), s.getClient)).toEqual({ skipped: 'running' });
    expect(s.client.createMatch).not.toHaveBeenCalled();
    await sub.runSubmissions(s.ctx(NOW + 2 * MIN), s.getClient);
    expect(s.db.store.docs.get('platform_settings/dupr_submissions').lease_until_ms).toBe(0);
  });

  it('falha do DUPR fica registrada para nova tentativa', async () => {
    const s = cenario();
    s.client.createMatch.mockRejectedValueOnce(new DuprError('DUPR recusou (503): fora', { status: 503 }));
    const r = await sub.runSubmissions(s.ctx(), s.getClient);
    expect(r.failed).toBe(1);
    expect(s.doc('pr:gd:gd_gd1_g1')).toMatchObject({ status: 'failed', attempts: 1, next_try_ms: NOW + 15 * MIN });
  });
});

describe('ações do admin', () => {
  it('só o admin', async () => {
    const s = cenario();
    const e = await sub.retry(s.ctx(), COMUM, { identifier: 'pr:tm:m1' }).catch((x) => x);
    expect(e.code).toBe('permission-denied');
  });

  it('aprovar, tentar de novo e apagar no DUPR (que trava o reenvio)', async () => {
    const s = cenario({ politica: { ...POL_RULES, mode: 'manual' } });
    await sub.runSubmissions(s.ctx(), s.getClient);
    expect(s.doc('pr:gd:gd_gd1_g1').status).toBe('awaiting_approval');
    await sub.approve(s.ctx(), ADMIN, { identifier: 'pr:gd:gd_gd1_g1' });
    await sub.runSubmissions(s.ctx(NOW + MIN), s.getClient);
    expect(s.doc('pr:gd:gd_gd1_g1').status).toBe('sent');

    const curto = await sub.remove(s.ctx(), ADMIN, { identifier: 'pr:gd:gd_gd1_g1', reason: 'x' }, s.getClient).catch((x) => x);
    expect(curto.code).toBe('invalid-argument');
    await sub.remove(s.ctx(), ADMIN, { identifier: 'pr:gd:gd_gd1_g1', reason: 'placar errado' }, s.getClient);
    expect(s.client.deleteMatch).toHaveBeenCalledWith('pr:gd:gd_gd1_g1', '101');
    expect(s.doc('pr:gd:gd_gd1_g1')).toMatchObject({ status: 'deleted', blocked: true, blocked_reason: 'placar errado' });
    await sub.runSubmissions(s.ctx(NOW + 2 * MIN), s.getClient);
    expect(s.client.createMatch).toHaveBeenCalledTimes(1);

    await sub.unblock(s.ctx(), ADMIN, { identifier: 'pr:gd:gd_gd1_g1' });
    expect(s.doc('pr:gd:gd_gd1_g1')).toBeUndefined();
  });

  it('tentar de novo só vale para a que falhou', async () => {
    const s = cenario({ extra: { 'dupr_submissions/pr:tm:m1': { identifier: 'pr:tm:m1', status: 'failed', attempts: 6, next_try_ms: null } } });
    await sub.retry(s.ctx(), ADMIN, { identifier: 'pr:tm:m1' });
    expect(s.doc('pr:tm:m1')).toMatchObject({ attempts: 0, next_try_ms: NOW });
    const e = await sub.approve(s.ctx(), ADMIN, { identifier: 'pr:tm:m1' }).catch((x) => x);
    expect(e.code).toBe('failed-precondition');
  });
});
