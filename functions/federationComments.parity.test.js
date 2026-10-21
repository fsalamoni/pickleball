/**
 * PARIDADE cliente × servidor dos comentários: a tela valida texto, modo e
 * prazo da consulta e diz se dá para comentar com a mesma régua que o
 * servidor aplica.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/comments.js';

const require = createRequire(import.meta.url);
const s = require('./federationCommentsPolicy.js');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);
const TEXTOS = ['ok', '  oi  ', 'abc', 'a\r\n\n\n\nb  c\t\td', 'x'.repeat(1000), 'x'.repeat(1001), null, undefined, 12345];
const MODOS = [
  { mode: 'open' }, { mode: 'closed' }, { mode: 'xx' }, null,
  { mode: 'consultation' }, { mode: 'consultation', until_date: '2026-10-21' }, { mode: 'consultation', until_date: '2026-10-20' },
  { mode: 'consultation', until_date: '2026-13-40' }, { mode: 'consultation', until_date: '2027-01-31' },
];
const ALVOS = [
  [{ status: 'published' }, {}],
  [{ status: 'draft' }, {}],
  [{ status: 'published', comments: { mode: 'closed' } }, {}],
  [{ status: 'published', comments: { mode: 'consultation', until_date: '2026-10-21', until_ms: s.endOfDayBr('2026-10-21') } }, {}],
  [{ status: 'published', comments: { mode: 'consultation', until_date: '2026-10-20', until_ms: s.endOfDayBr('2026-10-20') } }, {}],
  [{ status: 'published' }, { rules: { comments: false } }],
  [{ status: 'scheduled' }, { kind: 'event' }],
  [null, {}],
];

describe('paridade: comentários', () => {
  it('os mesmos tetos e listas', () => {
    ['COMMENT_TEXT_MIN', 'COMMENT_TEXT_MAX', 'COMMENT_REASON_MIN', 'COMMENT_REPORTS_TO_HIDE', 'COMMENT_INTERVAL_MS', 'COMMENT_DAILY_MAX', 'COMMENT_LIST_MAX']
      .forEach((k) => expect(s[k], k).toBe(c[k]));
    expect(s.COMMENT_TARGETS).toEqual([...c.COMMENT_TARGETS]);
    expect(s.MODE_IDS).toEqual(c.COMMENT_MODES.map((m) => m.id));
    expect(s.REPORT_REASON_IDS).toEqual(c.COMMENT_REPORT_REASONS.map((m) => m.id));
    expect(s.endOfDayBr('2026-10-21')).toBe(c.endOfDayBr('2026-10-21'));
  });

  it('o mesmo texto aceito e recusado', () => {
    TEXTOS.forEach((x) => {
      const a = c.validateCommentText(x);
      const b = s.validateCommentText(x);
      expect({ ok: b.ok, value: b.value }).toEqual({ ok: a.ok, value: a.value });
    });
  });

  it('o mesmo modo e prazo', () => {
    MODOS.forEach((x) => {
      const a = c.validateCommentSettings(x, { nowMs: NOW });
      const b = s.validateCommentSettings(x, { nowMs: NOW });
      expect({ ok: b.ok, value: b.value }).toEqual({ ok: a.ok, value: a.value });
    });
  });

  it('o mesmo "dá para comentar agora"', () => {
    ALVOS.forEach(([alvo, opts]) => expect(s.commentsState(alvo, { ...opts, nowMs: NOW })).toEqual(c.commentsState(alvo, { ...opts, nowMs: NOW })));
  });
});
