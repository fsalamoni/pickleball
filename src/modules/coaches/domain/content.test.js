import { describe, it, expect } from 'vitest';
import {
  CONTENT_VISIBILITY,
  CONTENT_CATEGORY,
  sanitizeVideoUrl,
  normalizeContent,
  isContentVisibleTo,
  visibleContent,
  contentCategoryLabel,
  contentVisibilityLabel,
  sortContent,
} from './content.js';

describe('sanitizeVideoUrl', () => {
  it('aceita http(s)', () => {
    expect(sanitizeVideoUrl('https://youtu.be/abc')).toBe('https://youtu.be/abc');
  });
  it('rejeita esquemas inseguros e vazio', () => {
    expect(sanitizeVideoUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeVideoUrl('ftp://x')).toBe('');
    expect(sanitizeVideoUrl('')).toBe('');
  });
});

describe('normalizeContent', () => {
  const base = { coach_id: 'c1', title: 'Drink cross', body: 'Faça 20x' };
  it('valida com texto', () => {
    const r = normalizeContent(base);
    expect(r.valid).toBe(true);
    expect(r.value.category).toBe(CONTENT_CATEGORY.OTHER);
    expect(r.value.visibility).toBe(CONTENT_VISIBILITY.PUBLIC);
  });
  it('valida só com vídeo', () => {
    expect(normalizeContent({ coach_id: 'c1', title: 'Saque', video_url: 'https://x.com/v' }).valid).toBe(true);
  });
  it('exige coach_id e título', () => {
    expect(normalizeContent({ title: 'x', body: 'y' }).valid).toBe(false);
    expect(normalizeContent({ coach_id: 'c1', body: 'y' }).valid).toBe(false);
  });
  it('exige corpo ou vídeo', () => {
    expect(normalizeContent({ coach_id: 'c1', title: 'Vazio' }).valid).toBe(false);
  });
  it('normaliza categoria e visibilidade', () => {
    const r = normalizeContent({ ...base, category: 'DRILL', visibility: 'students' });
    expect(r.value.category).toBe(CONTENT_CATEGORY.DRILL);
    expect(r.value.visibility).toBe(CONTENT_VISIBILITY.STUDENTS);
  });
  it('descarta vídeo inseguro mas mantém se houver texto', () => {
    const r = normalizeContent({ ...base, video_url: 'javascript:1' });
    expect(r.valid).toBe(true);
    expect(r.value.video_url).toBe('');
  });
});

describe('isContentVisibleTo', () => {
  const pub = { visibility: 'public' };
  const priv = { visibility: 'students' };
  it('dono vê tudo', () => {
    expect(isContentVisibleTo(priv, { isOwner: true })).toBe(true);
  });
  it('público visível a todos', () => {
    expect(isContentVisibleTo(pub, {})).toBe(true);
  });
  it('só-alunos exige aluno', () => {
    expect(isContentVisibleTo(priv, { isStudent: true })).toBe(true);
    expect(isContentVisibleTo(priv, { isStudent: false })).toBe(false);
  });
});

describe('visibleContent', () => {
  it('filtra pela visibilidade do observador', () => {
    const list = [{ visibility: 'public' }, { visibility: 'students' }];
    expect(visibleContent(list, { isStudent: false })).toHaveLength(1);
    expect(visibleContent(list, { isStudent: true })).toHaveLength(2);
    expect(visibleContent(list, { isOwner: true })).toHaveLength(2);
  });
});

describe('labels', () => {
  it('categoria e visibilidade', () => {
    expect(contentCategoryLabel('drill')).toBe('Drill');
    expect(contentVisibilityLabel('students')).toBe('Só alunos');
  });
});

describe('sortContent', () => {
  it('ordena por created_at desc', () => {
    const list = [
      { id: 'a', created_at: { seconds: 100 } },
      { id: 'b', created_at: { seconds: 300 } },
      { id: 'c', created_at: { seconds: 200 } },
    ];
    expect(sortContent(list).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });
});
