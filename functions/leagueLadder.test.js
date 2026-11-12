/**
 * ESCADA da liga no servidor, contra um Firestore falso: as quadras saem da
 * posição na escada; sessão sem placar é refeita, com placar só depois de
 * fechada; o 1º sobe e o último desce; quem falta fica no lugar; número de
 * presentes que não fecha é recusado; o pontos corridos não vale na escada.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { leagues } = require('./leagues.js');
const LD = require('./leagueLadder.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };

function banco() {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { leagues_athletes: true } },
    'users/ana': { platform_name: 'Ana Souza' },
    'users/bia': { platform_name: 'Bia Lima' },
  });
}

// O relógio anda a cada chamada: a inscrição e a sessão têm hora diferente.
function relogio() {
  let now = Date.UTC(2026, 10, 12, 15, 0, 0);
  return (db, actor, data) => {
    now += 1000;
    const Timestamp = { fromMillis: (ms) => ({ seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 }) };
    return leagues({ db, now, Timestamp, logger: { info() {}, warn() {} } }, actor, data);
  };
}
const docs = (db, prefixo) => [...db.store.docs.entries()].filter(([p]) => p.startsWith(prefixo) && !p.slice(prefixo.length).includes('/'));

const NOMES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

async function escada(format = 'ladder_individual', n = 8) {
  const db = banco();
  const chama = relogio();
  const { leagueId } = await chama(db, ANA, {
    action: 'create', organizer: { type: 'athlete' }, name: 'Escada de Quinta', format,
    season: { start_date: '2026-12-03' }, divisions: [{ name: 'Aberta' }],
  });
  await chama(db, ANA, { action: 'status', leagueId, to: 'open' });
  const [[divPath]] = docs(db, `leagues/${leagueId}/divisions/`);
  const divisionId = divPath.split('/').pop();
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    const players = format === 'ladder_pairs' ? [{ name: `${NOMES[i]}a` }, { name: `${NOMES[i]}b` }] : [{ name: NOMES[i] }];
    const r = await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players, name: NOMES[i] });
    ids.push(r.entryId);
  }
  return { db, chama, leagueId, divisionId, ids };
}

const jogos = (db, leagueId) => docs(db, `leagues/${leagueId}/matches/`).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));
const inscricoes = (db, leagueId) => docs(db, `leagues/${leagueId}/entries/`).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));

/** Lança todos os jogos da sessão: o lado com o "melhor" (menor índice em `forca`) vence. */
async function lancar(ctx, sessao, forca) {
  const { db, chama, leagueId } = ctx;
  for (const m of jogos(db, leagueId).filter((j) => j.session === sessao)) {
    const peso = (lado) => Math.min(...lado.map((id) => forca.indexOf(id)));
    const aVence = peso(m.team_a) < peso(m.team_b);
    await chama(db, ANA, { action: 'result', leagueId, matchId: m.id, games: [aVence ? { a: 11, b: 6 } : { a: 6, b: 11 }] });
  }
}

describe('escada individual (King of the Court)', () => {
  it('8 presentes = 2 quadras de 4 num Americano (3 jogos cada); começa a temporada', async () => {
    const ctx = await escada();
    const r = await ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId, start: true });
    expect(r).toMatchObject({ session: 1, groups: 2, matches: 6, redo: false });
    const ms = jogos(ctx.db, ctx.leagueId);
    expect(ms).toHaveLength(6);
    expect(ms.every((m) => m.phase === 'ladder' && m.team_a.length === 2 && m.team_b.length === 2)).toBe(true);
    // A quadra 1 é a de cima: os 4 primeiros inscritos (ninguém tem DUPR).
    const q1 = new Set(ms.filter((m) => m.group === 0).flatMap((m) => [...m.team_a, ...m.team_b]));
    expect([...q1].sort()).toEqual(ctx.ids.slice(0, 4).sort());
    ctx.ids.forEach((id) => expect(ms.filter((m) => [...m.team_a, ...m.team_b].includes(id))).toHaveLength(3));
    expect(ctx.db.store.docs.get(`leagues/${ctx.leagueId}`).status).toBe('running');
  });

  it('sem placar a sessão é refeita; com um placar, só depois de fechada', async () => {
    const ctx = await escada();
    const pedir = (present) => ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId, present });
    await pedir(ctx.ids);
    const r = await pedir(ctx.ids.slice(0, 5));
    expect(r).toMatchObject({ session: 1, groups: 1, matches: 5, redo: true });
    expect(jogos(ctx.db, ctx.leagueId)).toHaveLength(5);
    const [m] = jogos(ctx.db, ctx.leagueId);
    await ctx.chama(ctx.db, ANA, { action: 'result', leagueId: ctx.leagueId, matchId: m.id, games: [{ a: 11, b: 2 }] });
    await expect(pedir(ctx.ids)).rejects.toThrow(/Lance todos os placares da sessão 1/);
  });

  it('número de presentes que não fecha as quadras é recusado', async () => {
    const ctx = await escada();
    await expect(ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId, present: ctx.ids.slice(0, 6) }))
      .rejects.toThrow(/não fecham/);
    await expect(ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId, present: ctx.ids.slice(0, 3) }))
      .rejects.toThrow(/Poucos presentes/);
  });

  it('fechada a sessão, o último da quadra 1 desce e o 1º da quadra 2 sobe', async () => {
    const ctx = await escada();
    await ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId });
    // Força invertida: quem joga com P4 (quadra 1) ou com P8 (quadra 2) vence.
    // P4 e P8 ganham os 3; os outros ganham 1 cada, empatados em tudo — e o
    // empate fica com quem estava acima, então o último da quadra 1 é P3.
    const forca = ctx.ids.slice().reverse();
    await lancar(ctx, 1, forca);
    const antes = LD.computeLadder(inscricoes(ctx.db, ctx.leagueId), jogos(ctx.db, ctx.leagueId));
    expect(antes.pending).toBeNull();
    const [q1, q2] = antes.sessions[0].groups;
    expect(q1.ranking).toEqual([ctx.ids[3], ctx.ids[0], ctx.ids[1], ctx.ids[2]]);
    expect(q1.down).toBe(ctx.ids[2]);
    expect(q2.up).toBe(ctx.ids[7]);
    expect(antes.order.indexOf(ctx.ids[7])).toBe(3);
    expect(antes.order.indexOf(ctx.ids[2])).toBe(4);
    const r = await ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId });
    expect(r.session).toBe(2);
    const novaQ1 = new Set(jogos(ctx.db, ctx.leagueId).filter((m) => m.session === 2 && m.group === 0).flatMap((m) => [...m.team_a, ...m.team_b]));
    expect(novaQ1.has(ctx.ids[7])).toBe(true);
    expect(novaQ1.has(ctx.ids[2])).toBe(false);
  });

  it('quem falta fica no lugar; os presentes se rearrumam nos lugares deles', async () => {
    const ctx = await escada('ladder_individual', 9);
    // P5 falta: 8 presentes, quadras P1-P4 e P6-P9.
    const presentes = ctx.ids.filter((_, i) => i !== 4);
    await ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId, present: presentes });
    await lancar(ctx, 1, ctx.ids.slice().reverse());
    const { order } = LD.computeLadder(inscricoes(ctx.db, ctx.leagueId), jogos(ctx.db, ctx.leagueId));
    expect(order[4]).toBe(ctx.ids[4]);
    expect(order[3]).toBe(ctx.ids[8]); // P9 subiu para o lugar de P1 na divisa
  });

  it('o pontos corridos não vale na escada e o desistente com jogo fica marcado', async () => {
    const ctx = await escada();
    await expect(ctx.chama(ctx.db, ANA, { action: 'schedule', leagueId: ctx.leagueId, divisionId: ctx.divisionId })).rejects.toThrow(/sessão a sessão/);
    await ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId });
    const r = await ctx.chama(ctx.db, ANA, { action: 'withdraw', leagueId: ctx.leagueId, entryId: ctx.ids[0] });
    expect(r.kept).toBe(true);
  });

  it('só a organização gera a sessão; liga que não é escada recusa', async () => {
    const ctx = await escada();
    await expect(ctx.chama(ctx.db, BIA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId })).rejects.toThrow(/Só quem organiza/);
  });
});

describe('escada de duplas', () => {
  it('7 duplas = um grupo de 4 e um de 3, cada dupla contra as outras do grupo', async () => {
    const ctx = await escada('ladder_pairs', 7);
    const r = await ctx.chama(ctx.db, ANA, { action: 'session', leagueId: ctx.leagueId, divisionId: ctx.divisionId });
    expect(r).toMatchObject({ groups: 2, matches: 6 + 3 });
    const ms = jogos(ctx.db, ctx.leagueId);
    expect(ms.every((m) => m.team_a.length === 1 && m.team_b.length === 1)).toBe(true);
  });
});
