import { describe, it, expect } from 'vitest';
import { commentThreads, commentsState, commentsStateLabel, endOfDayBr, validateCommentSettings, validateCommentText } from './comments';

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);

describe('comentários: texto', () => {
  it('limpa espaços e linhas em excesso e confere o tamanho', () => {
    expect(validateCommentText('  a\r\n\n\n\nb   c ')).toMatchObject({ ok: true, value: 'a\n\nb c' });
    expect(validateCommentText('oi').ok).toBe(false);
    expect(validateCommentText('x'.repeat(1001)).ok).toBe(false);
    expect(validateCommentText('x'.repeat(1000)).ok).toBe(true);
  });
});

describe('comentários: modo e consulta pública', () => {
  it('consulta pública vai até o fim do dia em Brasília e não começa no passado', () => {
    expect(endOfDayBr('2026-10-21')).toBe(Date.UTC(2026, 9, 22, 3, 0, 0) - 1);
    expect(validateCommentSettings({ mode: 'consultation', until_date: '2026-10-21' }, { nowMs: NOW })).toMatchObject({ ok: true, value: { until_ms: endOfDayBr('2026-10-21') } });
    expect(validateCommentSettings({ mode: 'consultation', until_date: '2026-10-20' }, { nowMs: NOW }).ok).toBe(false);
    expect(validateCommentSettings({ mode: 'consultation' }, { nowMs: NOW }).ok).toBe(false);
    expect(validateCommentSettings({ mode: 'closed', until_date: '2026-12-01' }, { nowMs: NOW }).value).toEqual({ mode: 'closed', until_date: null, until_ms: null });
    expect(validateCommentSettings({ mode: 'outro' }).ok).toBe(false);
  });

  it('diz por que não dá para comentar', () => {
    const pub = { status: 'published' };
    expect(commentsState(pub, { nowMs: NOW })).toMatchObject({ open: true, mode: 'open', why: null });
    expect(commentsState(pub, { rules: { comments: false }, nowMs: NOW }).why).toBe('disabled');
    expect(commentsState({ status: 'draft' }, { nowMs: NOW }).why).toBe('unpublished');
    expect(commentsState({ status: 'scheduled' }, { kind: 'event', nowMs: NOW }).open).toBe(true);
    expect(commentsState({ ...pub, comments: { mode: 'closed' } }, { nowMs: NOW }).why).toBe('closed');
    const consulta = { ...pub, comments: { mode: 'consultation', until_date: '2026-10-21', until_ms: endOfDayBr('2026-10-21') } };
    expect(commentsState(consulta, { nowMs: NOW })).toMatchObject({ open: true, until_date: '2026-10-21' });
    expect(commentsState(consulta, { nowMs: endOfDayBr('2026-10-21') + 1 }).why).toBe('ended');
    expect(commentsStateLabel(commentsState(consulta, { nowMs: NOW }))).toContain('21/10/2026');
    expect(commentsStateLabel(commentsState(pub, { nowMs: NOW }))).toBe('');
  });
});

describe('comentários: fios', () => {
  it('respostas logo abaixo do comentário; resposta órfã fica sozinha', () => {
    const fios = commentThreads([
      { id: 'r1', parent_id: 'c1', created_at_ms: 3 },
      { id: 'c2', created_at_ms: 2 },
      { id: 'c1', created_at_ms: 1 },
      { id: 'r9', parent_id: 'sumiu', created_at_ms: 4 },
    ]);
    expect(fios.map((x) => x.id)).toEqual(['c1', 'c2', 'r9']);
    expect(fios[0].replies.map((x) => x.id)).toEqual(['r1']);
  });
});
