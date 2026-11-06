/**
 * PARIDADE cliente × servidor da DUPLA da Carreira: em quais
 * participações a pessoa foi citada, a impressão do que se confirma, a
 * maioridade, a visão normalizada e o link do aviso — a tela e o servidor
 * aplicam a mesma régua.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/career/domain/careerPartner.js';
import { CAREER_FORMAT, formatHasPartner } from '@/modules/career/domain/careerEvent.js';
import { GAME_ASPECTS } from '@/modules/training/domain/debrief.js';
import { INTERNAL_LINK_PATTERN } from '@/core/domain/internalLink.js';

const require = createRequire(import.meta.url);
const s = require('./careerPolicy.js');

const EVENTOS = [
  null,
  {},
  { start_date: '2026-05-01', entries: [{ format: 'doubles', gender: 'mixed', placement: 'champion', partner: { uid: 'bia123', name: 'Bia' } }] },
  { start_date: '2026-05-01', end_date: '2026-05-03', date_precision: 'year', entries: [
    { format: 'singles', partner: { uid: 'bia123', name: 'Bia' } },
    { format: 'doubles', gender: 'male', age: 'other', age_label: '40+', level_bracket: 'other', level_label: 'B+', placement: 'other', placement_n: 5, partner: { uid: 'bia123', name: 'Bia' } },
    { format: 'teams', partner: { uid: 'cau456', name: 'Cau' } },
    { format: 'americano', partner: { uid: 'cau456', name: 'Cau' } },
    { format: 'americano', partner: { name: 'Sem conta' } },
  ] },
];

describe('paridade: a dupla da Carreira', () => {
  it('os mesmos valores gravados e limites', () => {
    expect(s.PARTNER_STATUS).toEqual({ ...c.PARTNER_STATUS });
    expect(s.OWNER_DECISION).toEqual({ ...c.OWNER_DECISION });
    expect(s.PARTNER_REPORT_REASONS).toEqual([...c.PARTNER_REPORT_REASONS]);
    expect(s.PARTNER_LIMITS).toEqual({ ...c.PARTNER_LIMITS });
    expect(s.ADULT_AGE).toBe(c.ADULT_AGE);
    expect(s.partnerDocId('ev1', 'u2')).toBe(c.partnerDocId('ev1', 'u2'));
  });

  it('⭐ os formatos com dupla fixa: simples e americano não têm, nos dois lados', () => {
    for (const f of [...Object.values(CAREER_FORMAT), undefined, 'x']) expect(s.formatHasPartner(f)).toBe(formatHasPartner(f));
    expect(s.formatHasPartner('americano')).toBe(false);
    expect(s.citedEntryIndexes(EVENTOS[3], 'cau456')).toEqual([2]);
  });

  it('os aspectos são os do balanço (GAME_ASPECTS), nos dois lados', () => {
    expect(c.PARTNER_ASPECT_IDS).toEqual(GAME_ASPECTS.map((a) => a.id));
    expect(s.PARTNER_ASPECT_IDS).toEqual([...c.PARTNER_ASPECT_IDS]);
  });

  it('o mesmo link de aviso que a regra aceita', () => {
    expect(s.INTERNAL_LINK_PATTERN).toBe(INTERNAL_LINK_PATTERN);
    ['/carreira?dupla=a_b__c', '/carreira#x', 'https://x.com', '/carreira?evento=u1_abc'].forEach((l) => {
      expect(s.linkDeAviso(l) !== null).toBe(new RegExp(INTERNAL_LINK_PATTERN).test(l));
    });
  });

  it('as mesmas citações e a mesma impressão', () => {
    EVENTOS.forEach((ev) => ['bia123', 'cau456', 'x', null].forEach((uid) => {
      const idx = c.citedEntryIndexes(ev, uid);
      expect(s.citedEntryIndexes(ev, uid)).toEqual(idx);
      expect(s.careerFingerprint(ev, idx)).toBe(c.careerFingerprint(ev, idx));
    }));
  });

  it('a mesma maioridade (nascimento desconhecido = menor)', () => {
    [['2008-11-04', '2026-11-04'], ['2008-11-05', '2026-11-04'], ['', '2026-11-04'], [null, '2026-11-04'], ['1990-02-29', '2026-03-01'], ['xx', '2026-01-01']]
      .forEach(([b, h]) => {
        expect(s.ageOn(b, h)).toBe(c.ageOn(b, h));
        expect(s.isAdult(b, h)).toBe(c.isAdult(b, h));
      });
  });

  it('a mesma visão normalizada', () => {
    [
      {},
      { strengths: ['saque', 'saque', 'xx', 'dink', 'drive', 'mental'] },
      { improve: ['devolucao'], text_drill: '  drill   de   dink \n\n\n\n todo dia  ' },
      { text_strength: 'x'.repeat(400) },
      { strengths: 'saque' },
    ].forEach((raw) => {
      const a = c.normalizePartnerFeedback(raw);
      const b = s.normalizePartnerFeedback(raw);
      expect({ valid: b.valid, error: b.error, value: b.value }).toEqual({ valid: a.valid, error: a.error, value: a.value });
    });
  });

  it('a dupla sem conta (PR 6): a mesma validade, o mesmo token e as mesmas duplas digitadas', () => {
    expect(s.INVITE_TTL_DAYS).toBe(c.INVITE_TTL_DAYS);
    expect(s.INVITE_TOKEN_PATTERN).toBe(c.INVITE_TOKEN_PATTERN);
    ['Zé  Ninguém', ' JOÃO ', '', null, 'Ana Maria'].forEach((n) => expect(s.partnerNameKey(n)).toBe(c.partnerNameKey(n)));
    const sem = { entries: [
      { format: 'doubles', partner: { name: 'Zé Ninguém' } },
      { format: 'singles', partner: { name: 'Zé Ninguém' } },
      { format: 'teams', partner: { name: 'ze ninguem' } },
      { format: 'doubles', partner: { uid: 'bia123', name: 'Bia' } },
      { format: 'doubles', partner: { name: '  ' } },
    ] };
    [...EVENTOS, sem].forEach((ev) => expect(s.namedPartners(ev)).toEqual(c.namedPartners(ev)));
  });
});
