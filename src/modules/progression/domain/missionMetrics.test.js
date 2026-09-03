import { describe, it, expect } from 'vitest';
import {
  MEASURABLE_MISSION_METRICS,
  isMeasurableMetric,
  inScopeWindow,
  computeMissionMetrics,
  applyRealProgress,
} from './missionMetrics.js';
import { generateMissions } from './missions.js';

/** 2026-09-03 15:00 em Brasília (18:00Z) */
const AGORA = new Date('2026-09-03T18:00:00Z');
const hojeMs = (h) => new Date(`2026-09-03T${h}:00Z`).getTime();

describe('isMeasurableMetric', () => {
  it('reconhece métrica medível no escopo certo', () => {
    expect(isMeasurableMetric('game_played', 'daily')).toBe(true);
    expect(isMeasurableMetric('game_played', 'monthly')).toBe(true);
  });

  it('kudos só é medível no diário (o índice só guarda "hoje")', () => {
    expect(isMeasurableMetric('kudos_given', 'daily')).toBe(true);
    expect(isMeasurableMetric('kudos_given', 'weekly')).toBe(false);
    expect(isMeasurableMetric('kudos_given', 'monthly')).toBe(false);
  });

  it('indicação só é medível no mensal (o código guarda "este mês")', () => {
    expect(isMeasurableMetric('referral_signed_up', 'monthly')).toBe(true);
    expect(isMeasurableMetric('referral_signed_up', 'daily')).toBe(false);
  });

  it('métrica sem fonte não é medível', () => {
    expect(isMeasurableMetric('chat_message')).toBe(false);
    expect(isMeasurableMetric('forum_post')).toBe(false);
    expect(isMeasurableMetric('inexistente')).toBe(false);
  });
});

describe('generateMissions só sorteia missão mensurável', () => {
  it.each(['daily', 'weekly', 'monthly'])('escopo %s', (scope) => {
    const missoes = generateMissions({ uid: 'u1', scope, currentTier: 'Jogador', seed: 7 });
    expect(missoes.length).toBeGreaterThan(0);
    for (const m of missoes) {
      expect(
        isMeasurableMetric(m.metric, scope),
        `missão "${m.id}" usa métrica "${m.metric}", que ficaria parada em 0`,
      ).toBe(true);
    }
  });

  it('nenhuma missão gerada depende de auto-declaração do usuário', () => {
    const todas = ['daily', 'weekly', 'monthly']
      .flatMap((scope) => generateMissions({ uid: 'u1', scope, currentTier: null, seed: 1 })
        .map((m) => m.metric));
    for (const metric of todas) {
      expect(Object.keys(MEASURABLE_MISSION_METRICS)).toContain(metric);
    }
  });
});

describe('inScopeWindow', () => {
  it('diário usa o dia de Brasília', () => {
    const dentro = inScopeWindow('daily', AGORA);
    expect(dentro(hojeMs('12'))).toBe(true);
    // 2026-09-04T00:30Z = 03/09 21:30 em Brasília → ainda é hoje
    expect(dentro(new Date('2026-09-04T00:30:00Z').getTime())).toBe(true);
    // 2026-09-04T04:00Z = 04/09 01:00 em Brasília → já é amanhã
    expect(dentro(new Date('2026-09-04T04:00:00Z').getTime())).toBe(false);
  });

  it('semanal cobre os últimos 7 dias', () => {
    const dentro = inScopeWindow('weekly', AGORA);
    expect(dentro(AGORA.getTime() - 3 * 24 * 3600e3)).toBe(true);
    expect(dentro(AGORA.getTime() - 10 * 24 * 3600e3)).toBe(false);
  });

  it('mensal usa o mês de Brasília', () => {
    const dentro = inScopeWindow('monthly', AGORA);
    expect(dentro(new Date('2026-09-01T12:00:00Z').getTime())).toBe(true);
    expect(dentro(new Date('2026-08-31T12:00:00Z').getTime())).toBe(false);
  });

  it('ignora valores inválidos', () => {
    const dentro = inScopeWindow('daily', AGORA);
    expect(dentro(NaN)).toBe(false);
    expect(dentro(undefined)).toBe(false);
  });
});

describe('computeMissionMetrics', () => {
  it('conta só as partidas de hoje no escopo diário', () => {
    const m = computeMissionMetrics({
      matchDates: [
        hojeMs('12'), hojeMs('14'), hojeMs('16'),
        new Date('2026-09-01T12:00:00Z').getTime(), // anteontem
      ],
    }, { scope: 'daily', now: AGORA });
    expect(m.game_played).toBe(3);
  });

  it('a mesma atividade rende mais no escopo semanal', () => {
    const datas = [hojeMs('12'), AGORA.getTime() - 2 * 24 * 3600e3];
    expect(computeMissionMetrics({ matchDates: datas }, { scope: 'daily', now: AGORA }).game_played).toBe(1);
    expect(computeMissionMetrics({ matchDates: datas }, { scope: 'weekly', now: AGORA }).game_played).toBe(2);
  });

  it('lê kudos do índice apenas se o contador é de hoje', () => {
    const deHoje = { givenToday: 4, lastKudoDay: '2026-09-03' };
    const deOntem = { givenToday: 9, lastKudoDay: '2026-09-02' };
    expect(computeMissionMetrics({ kudoIndex: deHoje }, { scope: 'daily', now: AGORA }).kudos_given).toBe(4);
    // contador velho não vale: senão a missão de hoje já nasceria cumprida
    expect(computeMissionMetrics({ kudoIndex: deOntem }, { scope: 'daily', now: AGORA }).kudos_given).toBe(0);
  });

  it('lê indicações do código apenas no mês corrente', () => {
    const code = { monthlyCount: 2, monthKey: '2026-09' };
    expect(computeMissionMetrics({ referralCode: code }, { scope: 'monthly', now: AGORA }).referral_signed_up).toBe(2);
    expect(computeMissionMetrics({ referralCode: { monthlyCount: 5, monthKey: '2026-08' } }, { scope: 'monthly', now: AGORA }).referral_signed_up).toBe(0);
  });

  it('fonte ausente vira 0, nunca undefined', () => {
    const m = computeMissionMetrics({}, { scope: 'daily', now: AGORA });
    for (const v of Object.values(m)) expect(v).toBe(0);
  });
});

describe('applyRealProgress', () => {
  const missao = (over = {}) => ({ id: 'm1', metric: 'game_played', target: 3, current: 0, ...over });

  it('avança o progresso até o medido', () => {
    const { missions, changed } = applyRealProgress([missao()], { game_played: 2 });
    expect(missions[0].current).toBe(2);
    expect(changed).toBe(true);
  });

  it('nunca passa do alvo', () => {
    const { missions } = applyRealProgress([missao()], { game_played: 99 });
    expect(missions[0].current).toBe(3);
  });

  it('NÃO regride: missão concluída continua concluída', () => {
    const { missions, changed } = applyRealProgress([missao({ current: 3 })], { game_played: 0 });
    expect(missions[0].current).toBe(3);
    expect(changed).toBe(false);
  });

  it('sinaliza "sem mudança" para evitar escrita à toa', () => {
    expect(applyRealProgress([missao({ current: 2 })], { game_played: 2 }).changed).toBe(false);
  });

  it('ignora missão cuja métrica não foi medida', () => {
    const { missions, changed } = applyRealProgress([missao({ metric: 'chat_message' })], { game_played: 5 });
    expect(missions[0].current).toBe(0);
    expect(changed).toBe(false);
  });
});
