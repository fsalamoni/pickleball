/**
 * PARIDADE cliente × servidor do acervo oficial: a tela valida com a mesma
 * régua que o servidor aplica (tipos, categorias, numerados, tetos, arquivos,
 * links de vídeo), e o código do ato sai igual.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/acervo.js';

const require = createRequire(import.meta.url);
const s = require('./federationAcervoPolicy.js');

describe('paridade: acervo oficial', () => {
  it('os mesmos tetos e enums', () => {
    expect(s.TITLE_MAX).toBe(c.DOC_TITLE_MAX);
    expect(s.SUMMARY_MAX).toBe(c.DOC_SUMMARY_MAX);
    expect(s.BODY_MAX).toBe(c.DOC_BODY_MAX);
    expect(s.TAGS_MAX).toBe(c.DOC_TAGS_MAX);
    expect(s.RELATIONS_MAX).toBe(c.DOC_RELATIONS_MAX);
    expect(s.FILES_MAX).toBe(c.DOC_FILES_MAX);
    expect(s.LINKS_MAX).toBe(c.DOC_LINKS_MAX);
    expect(s.RESTRICTED_FILE_MAX).toBe(c.DOC_RESTRICTED_FILE_MAX);
    expect(s.REASON_MIN).toBe(c.DOC_REASON_MIN);
    expect(s.WITHDRAW_REASON_MIN).toBe(c.DOC_WITHDRAW_REASON_MIN);
    expect(Object.values(s.STATUS).sort()).toEqual(Object.values(c.DOC_STATUS).sort());
    expect([...s.VISIBILITY].sort()).toEqual(Object.values(c.DOC_VISIBILITY).sort());
    expect([...s.RELATION].sort()).toEqual(Object.values(c.DOC_RELATION).sort());
  });

  it('a mesma tabela de tipos (categoria e numeração)', () => {
    expect(Object.keys(s.TYPES).sort()).toEqual(c.DOC_TYPES.map((x) => x.id).sort());
    c.DOC_TYPES.forEach((x) => expect(s.TYPES[x.id], x.id).toMatchObject({ category: x.category, numbered: x.numbered }));
  });

  it('as mesmas famílias de arquivo', () => {
    const tipos = ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/gif', 'audio/mpeg', 'video/mp4', 'video/avi', 'application/zip', ''];
    tipos.forEach((ct) => expect(s.familyOf(ct)?.max ?? null, ct).toBe(c.fileFamilyOf(ct)?.max ?? null));
  });

  it('os mesmos links de vídeo', () => {
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://vimeo.com/123456789', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'http://youtu.be/dQw4w9WgXcQ']
      .forEach((u) => expect(s.videoEmbed(u)?.embed ?? null, u).toBe(c.videoEmbed(u)?.embed ?? null));
  });

  it('a mesma validação do rascunho', () => {
    const arq = { name: 'a.pdf', path: 'federacao-acervo/u1/abc.pdf', size: 100, content_type: 'application/pdf' };
    const casos = [
      { type: 'resolution', title: 'Calendário', files: [arq], tags: 'Calendário, Etapas, calendário' },
      { type: 'errata', title: 'Errata', body: 'x' },
      { type: 'errata', title: 'Errata', body: 'x', relations: [{ kind: 'errata', doc_id: 'abcdef123' }] },
      { type: 'nada', title: 'ab' },
      { type: 'video', title: 'Assembleia', media_links: [{ url: 'https://youtu.be/dQw4w9WgXcQ', title: 'AGO' }], visibility: 'members' },
      { type: 'minutes', title: 'Ata', files: [{ ...arq, path: 'uploads/u1/a.pdf' }] },
      { type: 'statute', title: 'Estatuto', act_date: '2026-13-01', body: 'x', signed_by: '  Ana   Presidente ' },
    ];
    casos.forEach((x) => {
      const a = c.validateDocInput(x);
      const b = s.validateDoc(x);
      expect(b.ok, JSON.stringify(x)).toBe(a.ok);
      expect(Object.keys(b.errors).sort()).toEqual(Object.keys(a.errors).sort());
      expect(b.value).toEqual(a.value);
    });
  });

  it('o código do ato', () => {
    expect(s.codeOf('resolution', 3, 2026)).toBe('Resolução nº 3/2026');
    expect(s.codeOf('statute', null, 2026)).toBe('');
    expect(c.docCode({ type: 'resolution', number: 3, year: 2026 })).toBe('Resolução nº 3/2026');
  });
});
