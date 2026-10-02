/**
 * Ranking sazonal: a montagem das linhas é pura, então dá para testar toda a
 * regra sem Firestore. O que importa aqui é que a temporada seja de verdade
 * uma temporada — e não uma cópia do ranking de vida inteira.
 */
import { describe, it, expect } from 'vitest';
import { buildSeasonRows, prizeForPosition, currentSeasonId } from './seasonRanking.js';

const prog = (uid, xpTotal, tier = 'Jogador') => ({ uid, xpTotal, tier });

describe('currentSeasonId', () => {
  it('é YYYY-MM no fuso de Brasília', () => {
    // 2026-10-01T01:00Z = 30/09 22:00 em Brasília → ainda é setembro.
    // Rodando de madrugada em UTC, o mês virava antes da hora.
    expect(currentSeasonId(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09');
    expect(currentSeasonId(new Date('2026-10-01T05:00:00Z'))).toBe('2026-10');
  });
});

describe('prizeForPosition', () => {
  it('top 1% leva o prêmio maior', () => {
    expect(prizeForPosition(1, 100)).toBe(1000);
  });
  it('top 10% leva o prêmio intermediário', () => {
    expect(prizeForPosition(5, 100)).toBe(500);
  });
  it('demais participantes levam o de participação', () => {
    expect(prizeForPosition(50, 100)).toBe(50);
  });
  it('entrada inválida não premia', () => {
    expect(prizeForPosition(0, 100)).toBe(0);
    expect(prizeForPosition(1, 0)).toBe(0);
  });
});

describe('buildSeasonRows · XP da TEMPORADA, não de vida inteira', () => {
  it('na estreia, todo mundo começa a temporada zerado', () => {
    const linhas = buildSeasonRows(
      [prog('veterano', 90000), prog('novato', 100)],
      new Map(),
    );
    // o veterano tem 90k de vida, mas 0 nesta temporada
    for (const l of linhas) expect(l.xp).toBe(0);
    expect(linhas.find((l) => l.uid === 'veterano').baselineXp).toBe(90000);
    expect(linhas.find((l) => l.uid === 'novato').baselineXp).toBe(100);
  });

  it('quem jogou mais NA TEMPORADA fica na frente, mesmo com menos XP de vida', () => {
    const existentes = new Map([
      ['veterano', { baselineXp: 90000 }],
      ['novato', { baselineXp: 100 }],
    ]);
    const linhas = buildSeasonRows(
      [prog('veterano', 90100), prog('novato', 1100)], // +100 vs +1000
      existentes,
    );
    expect(linhas[0].uid).toBe('novato');
    expect(linhas[0].xp).toBe(1000);
    expect(linhas[1].uid).toBe('veterano');
    expect(linhas[1].xp).toBe(100);
  });

  it('o baseline é preservado entre execuções', () => {
    const existentes = new Map([['a', { baselineXp: 500 }]]);
    const linhas = buildSeasonRows([prog('a', 800)], existentes);
    expect(linhas[0].baselineXp).toBe(500);
    expect(linhas[0].xp).toBe(300);
  });

  it('posições são 1-based e sequenciais', () => {
    const linhas = buildSeasonRows(
      [prog('a', 300), prog('b', 200), prog('c', 100)],
      new Map([['a', { baselineXp: 0 }], ['b', { baselineXp: 0 }], ['c', { baselineXp: 0 }]]),
    );
    expect(linhas.map((l) => l.position)).toEqual([1, 2, 3]);
    expect(linhas.map((l) => l.uid)).toEqual(['a', 'b', 'c']);
  });

  it('deltaPosition é positivo para quem subiu', () => {
    const existentes = new Map([
      ['a', { baselineXp: 0, position: 3 }],
      ['b', { baselineXp: 0, position: 1 }],
    ]);
    const linhas = buildSeasonRows([prog('a', 500), prog('b', 100)], existentes);
    expect(linhas.find((l) => l.uid === 'a')).toMatchObject({ position: 1, deltaPosition: 2 });
    expect(linhas.find((l) => l.uid === 'b')).toMatchObject({ position: 2, deltaPosition: -1 });
  });

  it('estreante tem delta 0 (não havia de onde subir)', () => {
    const linhas = buildSeasonRows([prog('novo', 100)], new Map());
    expect(linhas[0].deltaPosition).toBe(0);
  });

  it('empate tem desempate estável — a ordem não oscila entre execuções', () => {
    const existentes = new Map([['a', { baselineXp: 0 }], ['b', { baselineXp: 0 }]]);
    const um = buildSeasonRows([prog('b', 100), prog('a', 100)], existentes);
    const dois = buildSeasonRows([prog('a', 100), prog('b', 100)], existentes);
    expect(um.map((l) => l.uid)).toEqual(dois.map((l) => l.uid));
  });

  it('XP nunca fica negativo, mesmo se o total cair', () => {
    const existentes = new Map([['a', { baselineXp: 900 }]]);
    const linhas = buildSeasonRows([prog('a', 500)], existentes);
    expect(linhas[0].xp).toBe(0);
  });

  it('grava o shape que o schema do cliente espera', () => {
    const linhas = buildSeasonRows([prog('a', 100)], new Map(), 1234);
    expect(linhas[0]).toMatchObject({
      uid: 'a', schemaVersion: 2, tier: 'Jogador', position: 1, updatedAt: 1234,
    });
    expect(typeof linhas[0].xp).toBe('number');
    expect(typeof linhas[0].prizeXp).toBe('number');
  });

  it('lista vazia devolve lista vazia', () => {
    expect(buildSeasonRows([], new Map())).toEqual([]);
  });
});

describe('contrato com o cliente', () => {
  it('as linhas gravadas passam pelo schema que o app usa para ler', async () => {
    const { SeasonRankingSchema } = await import('@/modules/progression/domain/gamificationV2Schema2.js');
    const linhas = buildSeasonRows(
      [prog('a', 900), prog('b', 400, 'Imortal')],
      new Map([['a', { baselineXp: 100, position: 2 }]]),
    );
    for (const linha of linhas) {
      // a função grava `seasonId` no momento do batch
      const doc = { ...linha, seasonId: '2026-09' };
      const parsed = SeasonRankingSchema.safeParse(doc);
      expect(parsed.success, `linha recusada: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------------- *
 * Privacidade, prêmio concedido e Hall da Fama
 * ------------------------------------------------------------------------- */
import { createRequire } from 'node:module';
import { buildRankingRows, finalizarTemporada, recomputeSeasonRanking } from './seasonRanking.js';

const requerer = createRequire(import.meta.url);
const { createRichFakeDb } = requerer('../tests/fakes/fakeFirestoreRico.cjs');
const logger = { info() {}, error() {}, warn() {}, debug() {} };
const CONFIG = {
  season: { prizeTop1: 1000, prizeTop10Percent: 500, prizeParticipation: 50, publicMinTier: 'Jogador' },
};
const perfil = (nome, extra = {}) => ({ platform_name: nome, photo_url: `${nome}.jpg`, state: 'PR', city: 'Curitiba', ...extra });

describe('buildRankingRows · quem aparece no placar público', () => {
  const progs = [
    { uid: 'a', xpTotal: 5000, tier: 'Expert', level: 12, achievementsUnlocked: 4 },
    { uid: 'b', xpTotal: 4000, tier: 'Veterano', level: 10, achievementsUnlocked: 2 },
    { uid: 'c', xpTotal: 3000, tier: 'Jogador', level: 8, achievementsUnlocked: 1 },
    { uid: 'd', xpTotal: 2000, tier: 'Aprendiz', level: 4, achievementsUnlocked: 0 },
    { uid: 'e', xpTotal: 1000, tier: 'Calouro', level: 2, achievementsUnlocked: 0 },
  ];
  const perfis = new Map(['a', 'b', 'c', 'd', 'e'].map((u) => [u, perfil(u.toUpperCase())]));

  it('quem desligou o placar ranqueia, mas não é público nem leva nome ou foto', () => {
    const prefs = new Map([['b', { privacy: { showInHallOfFame: false } }]]);
    const { temporada, hall } = buildRankingRows({ progressoes: progs, perfis, prefs, config: CONFIG, now: 1 });
    const b = temporada.find((r) => r.uid === 'b');
    expect(b).toMatchObject({ public: false, publicPosition: null, displayName: null, photoUrl: null, state: null });
    expect(hall.map((h) => h.uid)).toEqual(['a', 'c']);
    // as posições públicas são renumeradas (sem buraco na lista)
    expect(temporada.filter((r) => r.public).map((r) => [r.uid, r.publicPosition])).toEqual([['a', 1], ['c', 2]]);
    expect(hall.map((h) => h.position)).toEqual([1, 2]);
  });

  it('tier mínimo, perfil escondido, conta excluída e retida pela revisão', () => {
    const { temporada, hall } = buildRankingRows({
      progressoes: progs,
      perfis: new Map([...perfis, ['c', perfil('C', { hidden: true })]]),
      moderacao: new Map([['a', { excluded: true }]]),
      retidos: new Set(['b']),
      config: CONFIG, now: 1,
    });
    expect(temporada.find((r) => r.uid === 'a')).toBeUndefined(); // excluída: fora de tudo
    expect(hall).toEqual([]);
    expect(temporada.find((r) => r.uid === 'd').public).toBe(false); // abaixo de Jogador
    expect(temporada.find((r) => r.uid === 'b').public).toBe(false); // retido
    expect(temporada.find((r) => r.uid === 'c').public).toBe(false); // perfil escondido
  });

  it('grava em que fatia do ranking a pessoa está (para os critérios "estar entre os X%")', () => {
    const { temporada } = buildRankingRows({ progressoes: progs, perfis, config: CONFIG, now: 1 });
    expect(temporada.map((r) => r.percent)).toEqual([20, 40, 60, 80, 100]);
  });

  it('sem perfil no diretório não é público', () => {
    const { hall } = buildRankingRows({ progressoes: [progs[0]], perfis: new Map(), config: CONFIG, now: 1 });
    expect(hall).toEqual([]);
  });

  it('o XP concedido pelo servidor não conta como XP da temporada', () => {
    const existentes = new Map([['a', { baselineXp: 4000 }]]);
    const { temporada } = buildRankingRows({
      progressoes: [{ uid: 'a', xpTotal: 5500, grantsXp: 1000, tier: 'Expert' }], existentes, perfis, config: CONFIG, now: 1,
    });
    // (5500 − 1000) − 4000 = 500: o prêmio de 1000 não infla o mês seguinte
    expect(temporada[0].xp).toBe(500);
  });

  it('na estreia a linha de partida já desconta o que foi concedido', () => {
    const { temporada } = buildRankingRows({
      progressoes: [{ uid: 'a', xpTotal: 5500, grantsXp: 1000, tier: 'Expert' }], perfis, config: CONFIG, now: 1,
    });
    expect(temporada[0].baselineXp).toBe(4500);
    expect(temporada[0].xp).toBe(0);
  });

  it('o prêmio vem da configuração do admin, e participação exige XP no mês', () => {
    const cfg = { season: { ...CONFIG.season, prizeTop1: 123, prizeParticipation: 7 } };
    const existentes = new Map(progs.map((p) => [p.uid, { baselineXp: p.xpTotal - 100 }]));
    const { temporada } = buildRankingRows({ progressoes: progs, existentes, perfis, config: cfg, now: 1 });
    expect(temporada[0].prizeXp).toBe(123);
    const zerados = buildRankingRows({ progressoes: progs, perfis, config: cfg, now: 1 });
    zerados.temporada.forEach((r) => expect(r.prizeXp).toBe(0));
  });
});

describe('recomputeSeasonRanking de ponta a ponta', () => {
  const NOW = new Date('2026-10-02T06:00:00Z');
  const base = () => ({
    'platform_settings/global': { feature_flags: { gamification_v2: true } },
    'user_progression_v2/a': { uid: 'a', xpTotal: 5200, grantsXp: 0, tier: 'Expert', level: 12, achievementsUnlocked: 3 },
    'user_progression_v2/b': { uid: 'b', xpTotal: 4100, grantsXp: 0, tier: 'Veterano', level: 10, achievementsUnlocked: 1 },
    'athlete_profiles/a': perfil('Ana'), 'athlete_profiles/b': perfil('Bia'),
    'season_rankings/2026-10_a': { seasonId: '2026-10', uid: 'a', baselineXp: 5000, position: 1 },
    'season_rankings/2026-10_b': { seasonId: '2026-10', uid: 'b', baselineXp: 4000, position: 2 },
  });

  it('desligada a flag, não grava nada', async () => {
    const db = createRichFakeDb({ ...base(), 'platform_settings/global': { feature_flags: {} } });
    const r = await recomputeSeasonRanking({ now: NOW, logger, db });
    expect(r.skipped).toBe('flag_desligada');
    expect(db.dump('hall_of_fame')).toEqual({});
  });

  it('grava temporada e Hall com nome, e tira do Hall quem passou a esconder o perfil', async () => {
    const db = createRichFakeDb({ ...base(), 'hall_of_fame/b': { uid: 'b', xp: 1 } });
    await db.collection('user_gamification_prefs').doc('b').set({ privacy: { showInHallOfFame: false } });
    const r = await recomputeSeasonRanking({ now: NOW, logger, db });
    expect(r.ranked).toBe(2);
    expect(db.dump('season_rankings')['2026-10_a']).toMatchObject({ xp: 200, public: true, displayName: 'Ana', position: 1 });
    expect(db.dump('season_rankings')['2026-10_b']).toMatchObject({ public: false, displayName: null });
    expect(Object.keys(db.dump('hall_of_fame'))).toEqual(['a']); // b foi removido na hora
  });

  it('fecha o mês anterior: concede o prêmio uma vez só e marca como final', async () => {
    const db = createRichFakeDb({
      ...base(),
      'season_rankings/2026-09_a': { seasonId: '2026-09', uid: 'a', position: 1, prizeXp: 1000, finalized: false },
      'season_rankings/2026-09_b': { seasonId: '2026-09', uid: 'b', position: 2, prizeXp: 500, finalized: false, heldForReview: true },
    });
    await recomputeSeasonRanking({ now: NOW, logger, db });
    const grants = db.dump('user_xp_grants');
    expect(grants['a_season_2026-09']).toMatchObject({ kind: 'season', xp: 1000, uid: 'a' });
    expect(grants['b_season_2026-09']).toBeUndefined(); // retido para revisão: sem prêmio até o veredito
    expect(db.dump('season_rankings')['2026-09_a'].finalized).toBe(true);
    // segunda passada: nada de prêmio em dobro
    await recomputeSeasonRanking({ now: new Date(NOW.getTime() + 3600_000), logger, db });
    expect(Object.keys(db.dump('user_xp_grants'))).toEqual(['a_season_2026-09']);
  });

  it('finalizarTemporada sem linhas abertas não faz nada', async () => {
    const db = createRichFakeDb({});
    expect(await finalizarTemporada(db, '2026-09', CONFIG, logger)).toBe(0);
  });
});
