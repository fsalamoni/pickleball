import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { careerHabitCounts, isCompleteCareerRecord, isCareerDebriefDone } from './careerHabits.js';
import { CAREER_STATUS, PLACEMENT } from './careerEvent.js';
import { CAREER_DEBRIEF_TYPE, CAREER_DEBRIEF_DONE } from './careerDebrief.js';
import { GOAL_KIND, GOAL_STATUS } from '@/modules/progression/domain/progression.js';

const requerer = createRequire(import.meta.url);
const servidor = requerer('../../../../functions/careerXp.js');

const HOJE = '2026-11-04';
const ev = (extra = {}) => ({
  id: 'u1_e1', uid: 'u1', status: 'played', start_date: '2026-10-10',
  entries: [{ format: 'doubles', placement: 'champion' }], photos: [{ path: 'carreira/u1/p.jpg' }], ...extra,
});
const bal = (extra = {}) => ({ uid: 'u1', status: 'respondido', source: { type: 'externo', ref_id: 'u1_e1' }, ...extra });

describe('os literais são os da carreira, do balanço e das metas', () => {
  it('cópias com paridade', () => {
    expect(CAREER_STATUS.PLAYED).toBe('played');
    expect(CAREER_DEBRIEF_TYPE).toBe('externo');
    expect(CAREER_DEBRIEF_DONE).toBe('respondido');
    expect(GOAL_KIND.PROCESS).toBe('process');
    expect(GOAL_STATUS.DONE).toBe('done');
  });
});

describe('ficha completa: a mesma régua no cliente e no servidor', () => {
  const CASOS = [
    [ev(), bal()],
    [ev({ photos: [] }), bal()],
    [ev({ photos: undefined }), bal()],
    [ev({ photos: [{}] }), bal()],
    [ev({ photos: [{ path: 'carreira/u2/x.jpg' }] }), bal()],
    [ev({ photos: [{}, { path: 'carreira/u1/y.jpg' }] }), bal()],
    [ev(), null],
    [ev(), bal({ status: 'agora_nao' })],
    [ev(), bal({ source: { type: 'game', ref_id: 'u1_e1' } })],
    [ev(), bal({ source: { type: 'externo', ref_id: 'outro' } })],
    [ev(), bal({ uid: 'u2' })],
    [ev({ entries: [] }), bal()],
    [ev({ entries: [{ placement: 'champion' }, { placement: '' }] }), bal()],
    [ev({ status: 'planned' }), bal()],
    [ev({ status: 'cancelled' }), bal()],
    [ev({ start_date: '2026-12-01' }), bal()],
    [ev({ start_date: '10/10/2026' }), bal()],
    [ev({ platform_tournament_id: 't1' }), bal()],
    [null, bal()],
  ];
  it.each(CASOS.map((c, i) => [i, ...c]))('caso %i', (_i, e, b) => {
    expect(servidor.fichaCompleta(e, b, HOJE)).toBe(isCompleteCareerRecord(e, b, HOJE));
    expect(servidor.balancoFeito(b, 'u1_e1', 'u1')).toBe(isCareerDebriefDone(b, 'u1_e1', 'u1'));
  });

  it('o VALOR da colocação nunca muda a resposta (o resultado declarado rende 0)', () => {
    Object.values(PLACEMENT).forEach((p) => {
      const e = ev({ entries: [{ format: 'doubles', placement: p, placement_n: 7 }] });
      expect(isCompleteCareerRecord(e, bal(), HOJE)).toBe(true);
      expect(servidor.fichaCompleta(e, bal(), HOJE)).toBe(true);
    });
  });

  it('o torneio da plataforma conta como ficha completa, mas não paga XP', () => {
    const e = ev({ platform_tournament_id: 't1' });
    expect(servidor.fichaCompleta(e, bal(), HOJE)).toBe(true);
    expect(servidor.fichaPaga(e, bal(), HOJE)).toBe(false);
  });

  it('o id do grant é o `grantId` do cliente', async () => {
    const { grantId, XP_GRANT_KIND } = await import('@/modules/progression/domain/xpGrants.js');
    expect(servidor.grantDocId('u1', 'u1_e:1')).toBe(grantId('u1', XP_GRANT_KIND.CAREER, 'u1_e:1'));
  });
});

describe('careerHabitCounts', () => {
  it('conta registros jogados, fichas completas, balanços e metas de processo cumpridas', () => {
    const c = careerHabitCounts({
      hoje: HOJE,
      events: [ev(), ev({ id: 'u1_e2', photos: [] }), ev({ id: 'u1_e3', status: 'planned' })],
      debriefs: [bal(), bal({ source: { type: 'externo', ref_id: 'u1_e2' } }), bal({ source: { type: 'game', ref_id: 'g' } })],
      goals: [
        { kind: 'process', status: 'done' }, { kind: 'process', progress_manual: 100 },
        { kind: 'process', progress_manual: 40 }, { kind: 'outcome', status: 'done' },
      ],
    });
    expect(c).toEqual({ records: 2, completeRecords: 1, debriefs: 2, processGoalsDone: 2 });
  });

  it('a colocação declarada não muda nenhuma contagem', () => {
    const base = (placement) => careerHabitCounts({ hoje: HOJE, events: [ev({ entries: [{ placement }] })], debriefs: [bal()] });
    expect(base('champion')).toEqual(base('groups'));
  });
});
