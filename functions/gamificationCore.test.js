import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('./gamificationCore.js');

const ms = (iso) => new Date(iso).getTime();

describe('tempo (Brasília)', () => {
  it('a semana começa na segunda e o dia vira à meia-noite local', () => {
    expect(core.weekKey(ms('2026-10-02T15:00:00Z'))).toBe('2026-09-28');
    expect(core.weekKey(ms('2026-10-05T03:30:00Z'))).toBe('2026-10-05'); // segunda 00:30 BRT
    expect(core.weekKey(ms('2026-10-05T02:30:00Z'))).toBe('2026-09-28'); // domingo 23:30 BRT
    expect(new Date(core.dayStartMs('2026-10-02')).toISOString()).toBe('2026-10-02T03:00:00.000Z');
  });

  it('janelas de semana e mês', () => {
    const w = core.weekWindow('2026-09-28');
    expect(w.endMs - w.startMs).toBe(7 * 24 * 3600_000);
    const m = core.monthWindow('2026-12');
    expect(new Date(m.endMs).toISOString()).toBe('2027-01-01T03:00:00.000Z');
    expect(core.previousMonthKey('2026-01')).toBe('2025-12');
    expect(core.previousMonthKey('2026-10')).toBe('2026-09');
  });
});

describe('medidas de desafio', () => {
  const jogos = [
    { at: ms('2026-10-01T15:00:00Z'), won: true },
    { at: ms('2026-10-01T18:00:00Z'), won: false },
    { at: ms('2026-10-02T15:00:00Z'), won: true },
    { at: ms('2026-09-01T15:00:00Z'), won: true }, // fora
  ];
  const janela = { startMs: ms('2026-09-28T03:00:00Z'), endMs: ms('2026-10-05T03:00:00Z') };

  it('jogos, vitórias e dias ativos só da janela', () => {
    expect(core.metricValue('games_played', { games: jogos, ...janela })).toBe(3);
    expect(core.metricValue('games_won', { games: jogos, ...janela })).toBe(2);
    expect(core.metricValue('active_days', { games: jogos, ...janela })).toBe(2);
  });

  it('reservas e aulas vêm das datas', () => {
    const datas = [ms('2026-10-01T15:00:00Z'), ms('2026-08-01T15:00:00Z')];
    expect(core.metricValue('arena_bookings', { bookingDates: datas, ...janela })).toBe(1);
    expect(core.metricValue('coach_lessons', { lessonDates: datas, ...janela })).toBe(1);
    expect(core.metricValue('inexistente', { ...janela })).toBe(0);
  });

  it('gamesByUid separa os dois lados e a vitória', () => {
    const m = core.gamesByUid([{ side_a: ['a', 'b'], side_b: ['c', 'd'], winner: 'a', at: 5 }, { side_a: ['a'], side_b: ['c'], winner: 'b', at: 0 }]);
    expect(m.get('a')).toEqual([{ at: 5, won: true }]); // o jogo sem data foi ignorado
    expect(m.get('c')).toEqual([{ at: 5, won: false }]);
  });

  it('ranking: empate = mesma posição, inelegível fora', () => {
    const r = core.rankEntries([
      { subjectId: 'a', value: 5, joinedAt: 2 }, { subjectId: 'b', value: 5, joinedAt: 1 },
      { subjectId: 'c', value: 9 }, { subjectId: 'd', value: 99, eligible: false },
    ]);
    expect(r.map((e) => [e.subjectId, e.position])).toEqual([['c', 1], ['b', 2], ['a', 2]]);
  });
});

describe('duelos', () => {
  const c = (uid, level, state = 'PR') => ({ uid, level, state });

  it('emparelha vizinhos de nível, dentro do limite, sem repetir ninguém', () => {
    const pares = core.pairDuels([c('a', 3.0), c('b', 3.2), c('c', 5.0), c('d', 5.1), c('e', 7.9)], { maxLevelGap: 1 });
    expect(pares.map((p) => [p.a, p.b])).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('evita repetir o par da semana anterior e prefere o mesmo estado', () => {
    const ja = new Set(['a|b']);
    const pares = core.pairDuels([c('a', 3.0), c('b', 3.1), c('c', 3.4)], { maxLevelGap: 1, jaPareados: ja });
    expect(pares).toHaveLength(1);
    expect(pares[0]).toMatchObject({ a: 'a', b: 'c' });
    const estado = core.pairDuels([c('a', 3.0, 'PR'), c('b', 3.1, 'SP'), c('c', 3.4, 'PR')], { maxLevelGap: 1 });
    expect(estado[0]).toMatchObject({ a: 'a', b: 'c' }); // 0,4 no mesmo estado < 0,1 + 0,5
  });

  it('ignora quem não tem nível e o id é estável', () => {
    expect(core.pairDuels([c('a', null), c('b', 3)], {})).toEqual([]);
    expect(core.duelId('2026-09-28', 'z', 'a')).toBe('2026-09-28_a_z');
  });

  it('resultado: vitórias, desempate por jogos, empate e anulado', () => {
    expect(core.duelOutcome({ uid: 'a', wins: 3, games: 4 }, { uid: 'b', wins: 1, games: 5 })).toEqual({ outcome: 'a', winner: 'a' });
    expect(core.duelOutcome({ uid: 'a', wins: 2, games: 3 }, { uid: 'b', wins: 2, games: 5 })).toEqual({ outcome: 'b', winner: 'b' });
    expect(core.duelOutcome({ uid: 'a', wins: 2, games: 4 }, { uid: 'b', wins: 2, games: 4 }).outcome).toBe('tie');
    expect(core.duelOutcome({ uid: 'a', wins: 0, games: 0 }, { uid: 'b', wins: 0, games: 0 }).outcome).toBe('void');
  });
});

describe('reputação', () => {
  it('a nota só aparece com amostra; tag só com votos', () => {
    const r = core.aggregateReputation([
      { rating: 5, tags: ['pontual'] }, { rating: 5, tags: ['pontual'] }, { rating: 4, tags: ['pontual', 'justo'] },
      { rating: 5, tags: [] }, { rating: 4, tags: [] },
    ]);
    expect(r.average).toBe(4.6);
    expect(r.topTags).toEqual([{ tag: 'pontual', count: 3 }]);
    expect(core.aggregateReputation([{ rating: 5 }]).average).toBeNull();
    expect(core.aggregateReputation([{ rating: 9 }, null]).count).toBe(0);
  });

  it('vingança 1★ × 5★ é marcada uma vez', () => {
    const s = core.suspiciousReviewPairs([
      { matchKey: 'm', fromUid: 'a', toUid: 'b', rating: 1 }, { matchKey: 'm', fromUid: 'b', toUid: 'a', rating: 5 },
    ]);
    expect(s).toHaveLength(1);
  });
});

describe('antifarm', () => {
  const cfg = { xpJumpPerDay: 5000, unverifiedXpFactor: 3 };
  const agora = ms('2026-10-02T15:00:00Z');

  it('XP muito acima do que a atividade verificada sustenta é sinalizado', () => {
    const s = core.integritySignals({ xpTotal: 99999, grantsXp: 0, verified: { games: 10, wins: 5 }, now: agora }, cfg);
    expect(s.map((x) => x.type)).toEqual(['xp_unverified']);
    expect(s[0].detail.ceiling).toBe(core.verifiedActivityXp({ games: 10, wins: 5 }) * 3 + 3000);
  });

  it('atleta legítimo (muito jogo) e o XP concedido pelo servidor não disparam', () => {
    expect(core.integritySignals({ xpTotal: 9000, grantsXp: 0, verified: { games: 300, wins: 180 }, now: agora }, cfg)).toEqual([]);
    expect(core.integritySignals({ xpTotal: 8000, grantsXp: 7000, verified: { games: 0, wins: 0 }, now: agora }, cfg)).toEqual([]);
  });

  it('salto de XP em poucas horas', () => {
    const s = core.integritySignals({ xpTotal: 20000, grantsXp: 0, verified: { games: 500, wins: 300 }, previous: { xp: 2000, at: agora - 6 * 3600_000 }, now: agora }, cfg);
    expect(s.map((x) => x.type)).toContain('xp_jump');
    const lento = core.integritySignals({ xpTotal: 4000, grantsXp: 0, verified: { games: 500, wins: 300 }, previous: { xp: 2000, at: agora - 7 * 86_400_000 }, now: agora }, cfg);
    expect(lento).toEqual([]);
  });

  it('anel de kudos: só quando os dois lados passam do mínimo', () => {
    const k = (f, t, n) => Array.from({ length: n }, () => ({ fromUid: f, toUid: t }));
    expect(core.kudosRings([...k('a', 'b', 6), ...k('b', 'a', 5)], 5)).toEqual([{ a: 'a', b: 'b', ab: 6, ba: 5 }]);
    expect(core.kudosRings([...k('a', 'b', 9), ...k('b', 'a', 1)], 5)).toEqual([]);
  });
});

describe('prêmio da temporada', () => {
  const prizes = { prizeTop1: 1000, prizeTop10Percent: 500, prizeParticipation: 50 };
  it('faixas, e participação só com XP na temporada', () => {
    expect(core.seasonPrize(1, 300, 800, prizes)).toBe(1000);
    expect(core.seasonPrize(20, 300, 100, prizes)).toBe(500);
    expect(core.seasonPrize(200, 300, 10, prizes)).toBe(50);
    expect(core.seasonPrize(200, 300, 0, prizes)).toBe(0);
    expect(core.seasonPrize(1, 1, 5, prizes)).toBe(1000);
  });
});
