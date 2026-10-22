import { describe, it, expect } from 'vitest';
import {
  CHECKLIST_ITEMS, directorStage, finalCategorySummary, finalInviteDocId, finalInviteOpen, finalInvitesToSend, normalizeDirectorCode,
  normalizeFinalOptions, normalizePrize, prizeParity, sanctionTiming, tierFeeCents, validateChecklist, validateEventReport,
} from './competitions.js';

const HOJE = '2026-10-22';

describe('prazo da chancela', () => {
  it('sem prazo: nunca atrasa, mas conta os dias quando há data', () => {
    expect(sanctionTiming({}, '2026-11-01', HOJE)).toMatchObject({ min_days: 0, days_ahead: 10, late: false, no_date: false });
    expect(sanctionTiming(undefined, '', HOJE)).toMatchObject({ days_ahead: null, late: false });
  });
  it('com prazo: atrasa abaixo do mínimo, exige a data e diz a data mais cedo possível', () => {
    expect(sanctionTiming({ sanction_min_days: 30 }, '2026-11-01', HOJE)).toMatchObject({ late: true, days_ahead: 10, earliest: '2026-11-21' });
    expect(sanctionTiming({ sanction_min_days: 30 }, '2026-11-21', HOJE).late).toBe(false);
    expect(sanctionTiming({ sanction_min_days: 30 }, '', HOJE)).toMatchObject({ no_date: true, late: false });
  });
});

describe('taxa, diretor e premiação', () => {
  it('a taxa vem da categoria; categoria sem taxa ou desconhecida = 0', () => {
    const fed = { ranking_config: { tiers: [{ id: 'g1', code: 'A', points_by_place: { 1: 100 }, places: 1, active: true, sanction_fee_cents: 20000 }] } };
    expect(tierFeeCents(fed, 'g1')).toBe(20000);
    expect(tierFeeCents(fed, 'x')).toBe(0);
    expect(tierFeeCents({}, 'regional')).toBe(0);
  });
  it('o código do diretor é limpo como a pessoa digita', () => {
    expect(normalizeDirectorCode(' ab 12-cd ')).toBe('AB12CD');
  });
  it('isonomia: igual, diferente (com quem recebe menos), sem dinheiro, não informada', () => {
    expect(prizeParity({ female_cents: 100000, male_cents: 100000 })).toMatchObject({ state: 'equal' });
    expect(prizeParity({ female_cents: 50000, male_cents: 100000 })).toEqual({ state: 'unequal', gap_cents: 50000, lower: 'female' });
    expect(prizeParity({ female_cents: 0, male_cents: 0 }).state).toBe('none');
    expect(prizeParity({ female_cents: 1000 }).state).toBe('unknown');
    expect(normalizePrize({ female_cents: '', male_cents: null, note: ' ' })).toBeNull();
    expect(normalizePrize({ female_cents: -5, male_cents: '300', note: 'troféus' })).toEqual({ female_cents: null, male_cents: 300, note: 'troféus' });
  });
});

describe('checklist e relatório', () => {
  it('o checklist só fica completo com tudo marcado (true de verdade)', () => {
    expect(validateChecklist({ items: { insurance: 'sim' } }).items.insurance).toBe(false);
    expect(validateChecklist({ items: Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i, true])) }).complete).toBe(true);
  });
  it('lesão ou reclamação contada pede descrição', () => {
    expect(validateEventReport({ injuries: 1 }).errors).toEqual({ injuries_text: 'describe' });
    expect(validateEventReport({ complaints: 2, complaints_text: 'Atraso na rodada.' }).ok).toBe(true);
    expect(validateEventReport({ entrants: -1 }).value.entrants).toBe(0);
  });
  it('a etapa do diretor: checklist antes do início, relatório a partir dele, entregue', () => {
    expect(directorStage({}, { starts_at: '2026-11-01' }, HOJE)).toBe('checklist');
    expect(directorStage({}, { starts_at: '2026-10-22' }, HOJE)).toBe('report');
    expect(directorStage({ report: { submitted_at_ms: 1 } }, { starts_at: '2026-10-01' }, HOJE)).toBe('done');
  });
});

describe('final do circuito', () => {
  const cats = [{ key: 'f', rows: [{ uid: 'a', position: 1 }, { uid: 'b', position: 2 }, { uid: 'c', position: 3 }] }];
  it('convida pela posição e completa as vagas com quem ainda não foi chamado', () => {
    expect(finalInvitesToSend(cats, [], { per_category: 2 }).map((x) => x.user_id)).toEqual(['a', 'b']);
    const ja = [{ category_key: 'f', user_id: 'a', status: 'declined' }, { category_key: 'f', user_id: 'b', status: 'accepted' }];
    const prox = finalInvitesToSend(cats, ja, { per_category: 2 });
    expect(prox).toHaveLength(1);
    expect(prox[0]).toMatchObject({ user_id: 'c', substitute: true });
  });
  it('as opções têm teto e ano opcional', () => {
    expect(normalizeFinalOptions({ season: null })).toMatchObject({ season: null, per_category: 8, accept_days: 7, categories: null });
    expect(normalizeFinalOptions({ season: 2026, per_category: 999 })).toMatchObject({ season: 2026, per_category: 64 });
  });
  it('id, resumo e convite aberto', () => {
    expect(finalInviteDocId('t1', 'f|open|doubles', 'u')).toBe('t1_f-open-doubles_u');
    expect(finalCategorySummary([{ status: 'accepted' }, { status: 'invited' }, { status: 'declined' }], 4)).toEqual({ per_category: 4, accepted: 1, invited: 1, declined: 1, expired: 0 });
    expect(finalInviteOpen({ status: 'invited', expires_at_ms: 2000 }, 1000)).toBe(true);
    expect(finalInviteOpen({ status: 'invited', expires_at_ms: 500 }, 1000)).toBe(false);
  });
});
