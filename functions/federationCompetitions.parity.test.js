/**
 * PARIDADE cliente × servidor das competições: a tela avisa o mesmo prazo,
 * cobra a mesma taxa, valida o checklist e o relatório e escolhe os mesmos
 * convidados para a final que o servidor grava.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/competitions.js';

const require = createRequire(import.meta.url);
const s = require('./federationCompetitionsPolicy.js');

const HOJE = '2026-10-22';
const FED = { ranking_config: { tiers: [{ id: 'g1', code: 'A', points_by_place: { 1: 100 }, places: 1, participation: 0, active: true, sanction_fee_cents: 12345 }, { id: 'g2', code: 'B', points_by_place: { 1: 50 }, places: 1, participation: 0, active: true }] } };
const CATS = [
  { key: 'f|open|doubles', gender_category: 'female', rows: [{ uid: 'a', name: 'A', position: 2 }, { uid: 'b', name: 'B', position: 1 }, { uid: 'c', position: 3 }, { name: 'sem uid', position: 4 }] },
  { key: 'm|50+|singles', age_category: '50+', format: 'singles', rows: [{ uid: 'd', position: 1 }, { uid: 'e', position: 2 }] },
  { key: '', rows: [{ uid: 'z' }] },
];
const EXISTENTES = [{ category_key: 'f|open|doubles', user_id: 'b', status: 'declined' }, { category_key: 'm|50+|singles', user_id: 'd', status: 'accepted' }];

describe('paridade: competições', () => {
  it('os mesmos enums e tetos', () => {
    expect(s.CHECKLIST_ITEMS).toEqual(c.CHECKLIST_ITEMS);
    expect(s.FINAL_INVITE_STATUS).toEqual(c.FINAL_INVITE_STATUS);
    expect([s.REPORT_TEXT_MAX, s.REPORT_COUNT_MAX, s.FINAL_PER_CATEGORY_MAX, s.FINAL_ACCEPT_DAYS]).toEqual([c.REPORT_TEXT_MAX, c.REPORT_COUNT_MAX, c.FINAL_PER_CATEGORY_MAX, c.FINAL_ACCEPT_DAYS]);
  });

  it('o mesmo prazo de chancela', () => {
    const casos = [[{}, '2026-11-01'], [{ sanction_min_days: 30 }, '2026-11-01'], [{ sanction_min_days: 30 }, '2026-12-31'], [{ sanction_min_days: 5 }, ''], [{ sanction_min_days: 999 }, '2027-01-01'], [null, null]];
    casos.forEach(([r, d]) => expect(s.sanctionTiming(r, d, HOJE)).toEqual(c.sanctionTiming(r, d, HOJE)));
  });

  it('a mesma taxa e o mesmo código de diretor', () => {
    ['g1', 'g2', 'x', undefined].forEach((id) => expect(s.tierFeeCents(FED, id)).toBe(c.tierFeeCents(FED, id)));
    ['dir 1234-5', '', null, 'abc!@#defghijklmnopqrstu'].forEach((x) => expect(s.normalizeDirectorCode(x)).toBe(c.normalizeDirectorCode(x)));
  });

  it('o mesmo checklist e o mesmo relatório', () => {
    [{}, { items: { insurance: true, referees: 'sim' } }, { items: Object.fromEntries(c.CHECKLIST_ITEMS.map((i) => [i, true])), notes: ' ok ' }]
      .forEach((x) => expect(s.validateChecklist(x)).toEqual(c.validateChecklist(x)));
    [{}, { injuries: 2 }, { complaints: 1, complaints_text: 'Arbitragem atrasou.' }, { entrants: -3, walkovers: 1e9, notes: 'x'.repeat(3000) }]
      .forEach((x) => expect(s.validateEventReport(x)).toEqual(c.validateEventReport(x)));
  });

  it('as mesmas opções e os mesmos convidados para a final', () => {
    [{}, { season: null }, { season: '2026', per_category: 0, accept_days: 99, categories: ['a', 'a', '', 'b'] }, { season: 1999 }]
      .forEach((x) => expect(s.normalizeFinalOptions(x)).toEqual(c.normalizeFinalOptions(x)));
    [{ per_category: 2 }, { per_category: 1, categories: ['m|50+|singles'] }, {}].forEach((o) => {
      expect(s.finalInvitesToSend(CATS, EXISTENTES, o)).toEqual(c.finalInvitesToSend(CATS, EXISTENTES, o));
    });
    expect(s.finalInviteDocId('t1', 'f|open|doubles', 'u')).toBe(c.finalInviteDocId('t1', 'f|open|doubles', 'u'));
  });
});
