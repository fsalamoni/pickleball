/**
 * Piloto do DUPR: só o admin entra, o ID DUPR é conferido no DUPR, a partida de
 * teste sai no formato do DUPR e só no UAT, e nada fora das coleções do piloto
 * (e da auditoria) é tocado.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const piloto = require('./duprPilot.js');
const { DuprError } = require('./duprClient.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const ADMIN = { uid: 'adm', name: 'Admin', isPlatformAdmin: true };
const COMUM = { uid: 'ana', name: 'Ana', isPlatformAdmin: false };

function clienteFalso(extra = {}) {
  return {
    getUser: vi.fn(async (id) => ({ result: { id: String(id).toUpperCase(), fullName: `Nome ${id}`, ratings: { singles: '3.100', doubles: 'NR' } } })),
    createMatch: vi.fn(async (m) => ({ status: 'SUCCESS', result: { identifier: m.identifier, matchCode: 'MC1', hashedMatchCode: 'h' } })),
    deleteMatch: vi.fn(async () => ({ status: 'SUCCESS' })),
    inviteUser: vi.fn(async () => ({ duprId: 'NEW123', identifier: 'x' })),
    ...extra,
  };
}

function cenario({ env = 'uat', seed = {}, client = clienteFalso() } = {}) {
  const db = createFakeDb(seed);
  const ctx = { db, now: NOW, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { warn() {}, error() {} } };
  const cliente = async () => ({ client, secrets: { env } });
  return { ctx, db, client, cliente };
}
const erro = (p) => p.then(() => null, (e) => e);
const caminhos = (db) => [...db.store.docs.keys()];

describe('duprPilot — jogadores', () => {
  it('só o admin da plataforma', async () => {
    const { ctx, cliente } = cenario();
    const e = await erro(piloto.savePlayer(ctx, COMUM, { name: 'Teste' }, cliente));
    expect(e.code).toBe('permission-denied');
  });

  it('sem ID DUPR: nasce aguardando conta, sem ir ao DUPR', async () => {
    const { ctx, client, cliente } = cenario();
    const p = await piloto.savePlayer(ctx, ADMIN, { name: 'Piloto 1', email: 'Teste+1@Gmail.com' }, cliente);
    expect(p).toMatchObject({ name: 'Piloto 1', email: 'teste+1@gmail.com', dupr_id: null, status: 'waiting' });
    expect(client.getUser).not.toHaveBeenCalled();
  });

  it('com ID: confere no DUPR e guarda o ID canônico, nome e ratings', async () => {
    const { ctx, cliente } = cenario();
    const p = await piloto.savePlayer(ctx, ADMIN, { name: 'Flavio', duprId: 'ab12cd' }, cliente);
    expect(p).toMatchObject({ dupr_id: 'AB12CD', dupr_name: 'Nome AB12CD', ratings: { singles: 3.1, doubles: null }, status: 'ready' });
  });

  it('o mesmo ID DUPR não entra em dois jogadores', async () => {
    const { ctx, cliente } = cenario({ seed: { 'dupr_pilot_players/p1': { name: 'X', dupr_id: 'AB12CD' } } });
    const e = await erro(piloto.savePlayer(ctx, ADMIN, { name: 'Yara', duprId: 'AB12CD' }, cliente));
    expect(e.code).toBe('already-exists');
  });

  it('ID que o DUPR não conhece: recusa dizendo isso', async () => {
    const client = clienteFalso({ getUser: vi.fn(async () => { throw new DuprError('DUPR recusou (404): x', { status: 404 }); }) });
    const { ctx, cliente } = cenario({ client });
    const e = await erro(piloto.savePlayer(ctx, ADMIN, { name: 'Yara', duprId: 'ZZZ999' }, cliente));
    expect(e.code).toBe('not-found');
  });

  it('convite sem a permissão do DUPR (403): explica o caminho manual', async () => {
    const client = clienteFalso({ inviteUser: vi.fn(async () => { throw new DuprError('DUPR recusou (403): no', { status: 403 }); }) });
    const { ctx, cliente } = cenario({ client, seed: { 'dupr_pilot_players/p1': { name: 'P', email: 'p@x.com', dupr_id: null } } });
    const e = await erro(piloto.invitePlayer(ctx, ADMIN, { id: 'p1' }, cliente));
    expect(e.code).toBe('permission-denied');
    expect(e.message).toContain('USER::INVITE');
  });

  it('convite aceito: o jogador ganha o ID gerado pelo DUPR', async () => {
    const { ctx, db, cliente } = cenario({ seed: { 'dupr_pilot_players/p1': { name: 'P', email: 'p@x.com', dupr_id: null } } });
    await piloto.invitePlayer(ctx, ADMIN, { id: 'p1' }, cliente);
    expect(db.store.docs.get('dupr_pilot_players/p1')).toMatchObject({ dupr_id: 'NEW123', status: 'ready' });
  });
});

const QUATRO = {
  'dupr_pilot_players/a1': { name: 'A1', dupr_id: 'AAA111' },
  'dupr_pilot_players/a2': { name: 'A2', dupr_id: 'AAA222' },
  'dupr_pilot_players/b1': { name: 'B1', dupr_id: 'BBB111' },
  'dupr_pilot_players/b2': { name: 'B2', dupr_id: 'BBB222' },
  'dupr_pilot_players/sem': { name: 'Sem conta', dupr_id: null },
};
const DUPLAS = { sideA: ['a1', 'a2'], sideB: ['b1', 'b2'], games: [{ a: 11, b: 7 }, { a: 9, b: 11 }, { a: 11, b: 5 }], date: '2026-10-23', event: 'Piloto' };

describe('duprPilot — partidas', () => {
  it('envia no formato do DUPR e guarda o matchCode; só toca o piloto e a auditoria', async () => {
    const { ctx, db, client, cliente } = cenario({ seed: QUATRO });
    const r = await piloto.sendMatch(ctx, ADMIN, DUPLAS, cliente);
    expect(r).toMatchObject({ status: 'sent', match_code: 'MC1' });
    const enviado = client.createMatch.mock.calls[0][0];
    expect(enviado).toMatchObject({
      identifier: `pr:pl:${r.id}`, format: 'DOUBLES', matchSource: 'PARTNER', matchDate: '2026-10-23', event: 'Piloto',
      teamA: { player1: 'AAA111', player2: 'AAA222', game1: 11, game2: 9, game3: 11 },
      teamB: { player1: 'BBB111', player2: 'BBB222', game1: 7, game2: 11, game3: 5 },
    });
    expect(enviado.clubId).toBeUndefined();
    expect(caminhos(db).every((p) => /^(dupr_pilot_|audit_logs\/)/.test(p))).toBe(true);
  });

  it('simples: um por lado, sem player2', async () => {
    const { ctx, client, cliente } = cenario({ seed: QUATRO });
    await piloto.sendMatch(ctx, ADMIN, { ...DUPLAS, sideA: ['a1'], sideB: ['b1'], games: [{ a: 11, b: 3 }] }, cliente);
    const m = client.createMatch.mock.calls[0][0];
    expect(m.format).toBe('SINGLES');
    expect(m.teamA.player2).toBeUndefined();
  });

  it('game empatado, jogador sem ID, data futura e produção: recusa antes de ir ao DUPR', async () => {
    const { ctx, client, cliente } = cenario({ seed: QUATRO });
    expect((await erro(piloto.sendMatch(ctx, ADMIN, { ...DUPLAS, games: [{ a: 10, b: 10 }] }, cliente))).message).toContain('empatado');
    expect((await erro(piloto.sendMatch(ctx, ADMIN, { ...DUPLAS, sideB: ['b1', 'sem'] }, cliente))).message).toContain('Sem conta');
    expect((await erro(piloto.sendMatch(ctx, ADMIN, { ...DUPLAS, date: '2026-10-30' }, cliente))).message).toContain('futuro');
    const prod = cenario({ env: 'prod', seed: QUATRO });
    expect((await erro(piloto.sendMatch(prod.ctx, ADMIN, DUPLAS, prod.cliente))).message).toContain('UAT');
    expect(client.createMatch).not.toHaveBeenCalled();
  });

  it('o DUPR recusa: a partida fica registrada como falha, com a mensagem dele', async () => {
    const client = clienteFalso({ createMatch: vi.fn(async () => { throw new DuprError('DUPR recusou (400): jogador sem assinatura', { status: 400 }); }) });
    const { ctx, db, cliente } = cenario({ seed: QUATRO, client });
    const r = await piloto.sendMatch(ctx, ADMIN, DUPLAS, cliente);
    expect(r.status).toBe('failed');
    expect(db.store.docs.get(`dupr_pilot_matches/${r.id}`)).toMatchObject({ status: 'failed', error: 'DUPR recusou (400): jogador sem assinatura' });
  });

  it('apagar: chama o DUPR com identifier + matchCode e marca como apagada', async () => {
    const { ctx, db, client, cliente } = cenario({ seed: QUATRO });
    const r = await piloto.sendMatch(ctx, ADMIN, DUPLAS, cliente);
    await piloto.deleteMatch(ctx, ADMIN, { id: r.id }, cliente);
    expect(client.deleteMatch).toHaveBeenCalledWith(`pr:pl:${r.id}`, 'MC1');
    expect(db.store.docs.get(`dupr_pilot_matches/${r.id}`).status).toBe('deleted');
  });
});
