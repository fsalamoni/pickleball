/**
 * PARIDADE cliente × servidor da política de envio ao DUPR: o painel mostra o
 * que vai ou não vai ao DUPR com a mesma régua que o servidor aplica ao enviar.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/rating/domain/duprPolicy.js';

const require = createRequire(import.meta.url);
const s = require('./duprPolicy.js');

const POLITICAS = [
  null, {}, { mode: 'off' }, { mode: 'rules' }, { mode: 'manual' },
  { mode: 'rules', optional_default_on: true, audience: 'all', grace_minutes: 0 },
  { mode: 'rules', rules: { game_day_rotation: 'required', tournament_team: 'excluded', tournament_rotation: 'x' } },
  { mode: 'rules', grace_minutes: 'abc', rules: { tournament_fixed: 'optional' } },
  { mode: 'zzz', audience: 'zzz', grace_minutes: 99999 },
];

describe('paridade: política do DUPR', () => {
  it('as mesmas constantes', () => {
    expect(s.DUPR_MODE).toEqual(c.DUPR_MODE);
    expect(s.DUPR_AUDIENCE).toEqual(c.DUPR_AUDIENCE);
    expect(s.DUPR_LEVEL).toEqual(c.DUPR_LEVEL);
    expect(s.DUPR_BUCKET).toEqual(c.DUPR_BUCKET);
    expect(s.DUPR_CONFIGURABLE_BUCKETS).toEqual(c.DUPR_CONFIGURABLE_BUCKETS);
    expect(s.DEFAULT_DUPR_POLICY).toEqual(c.DEFAULT_DUPR_POLICY);
    expect(s.DUPR_MATCH_PROBLEM).toEqual(c.DUPR_MATCH_PROBLEM);
    expect(s.DUPR_ID_KIND).toEqual(c.DUPR_ID_KIND);
    expect(s.DUPR_REQUIRED_ENTITLEMENT).toBe(c.DUPR_REQUIRED_ENTITLEMENT);
  });

  it('a mesma política normalizada', () => {
    POLITICAS.forEach((p) => expect(s.normalizeDuprPolicy(p)).toEqual(c.normalizeDuprPolicy(p)));
  });

  it('o mesmo grupo para cada partida', () => {
    const origens = ['tournament', 'game_day', undefined];
    const stages = ['round_robin', 'groups', 'knockout', 'swiss', 'americano', 'mexicano', 'americano_etapas', undefined];
    const formats = ['americano', 'play', 'americano_live', 'mexicano', 'king_of_court', undefined];
    origens.forEach((origin) => stages.forEach((stageType) => formats.forEach((gameDayFormat) => [true, false].forEach((teamConfrontation) => {
      const p = { origin, stageType, gameDayFormat, teamConfrontation };
      expect(s.duprBucket(p)).toBe(c.duprBucket(p));
    }))));
  });

  it('a mesma decisão para todo grupo, política e escolha', () => {
    const buckets = [...Object.values(c.DUPR_BUCKET), 'qualquer'];
    POLITICAS.forEach((p) => buckets.forEach((bucket) => [true, false, null, undefined].forEach((creatorChoice) => {
      expect(s.duprSubmissionDecision({ bucket, creatorChoice }, p)).toEqual(c.duprSubmissionDecision({ bucket, creatorChoice }, p));
    })));
  });

  it('a mesma elegibilidade da partida', () => {
    const casos = [
      { side_a: ['a', 'b'], side_b: ['c', 'd'], games: [{ a: 11, b: 4 }], winner: 'a' },
      { side_a: ['a'], side_b: ['c'], games: [{ a: 11, b: 11 }], winner: 'a' },
      { side_a: ['a', 'b'], side_b: ['b', 'd'], games: [], winner: null },
      { side_a: [], side_b: ['c'], games: [{ a: 0, b: 0 }] },
      { side_a: ['a', 'b', 'e'], side_b: ['c', 'd', 'f'], games: [{ a: 3, b: 11 }, { a: 11, b: 2 }], winner: 'b' },
      null, {},
    ];
    casos.forEach((m) => expect(s.duprMatchEligibility(m)).toEqual(c.duprMatchEligibility(m)));
  });

  it('a mesma prontidão das contas e o mesmo identificador', () => {
    const links = { u1: { dupr_id: '1', entitlements: ['BASIC_L1'] }, u3: { dupr_id: '3', entitlements: ['x'] } };
    [[['u1']], [['u1', 'u3', 'u9']], [[]], [null]].forEach(([uids]) => {
      expect(s.duprReadiness(uids, links)).toEqual(c.duprReadiness(uids, links));
    });
    [['tm', 'x1'], ['gd', 'a/b'], ['zz', 'x'], ['tm', '']].forEach(([k, id]) => {
      expect(s.duprIdentifier(k, id)).toBe(c.duprIdentifier(k, id));
    });
  });
});
