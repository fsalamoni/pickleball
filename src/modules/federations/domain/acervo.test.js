import { describe, it, expect } from 'vitest';
import {
  DOC_CATEGORIES, DOC_TYPES, docActions, docCode, docDisplayTitle, docPublicPath, docYears, filterDocs, fileFamilyOf, fileSizeLabel, isDocCurrent,
  sortDocs, transparencyChecklist, typesOfCategory, validateAcervoFile, validateDocInput, videoEmbed, acervoUploadPath,
} from './acervo.js';

const arq = { name: 'a.pdf', path: 'federacao-acervo/u1/abc.pdf', size: 1000, content_type: 'application/pdf' };

describe('acervo: catálogo', () => {
  it('todo tipo cai numa categoria existente e toda categoria tem tipo', () => {
    const cats = new Set(DOC_CATEGORIES.map((c) => c.id));
    DOC_TYPES.forEach((x) => expect(cats.has(x.category), x.id).toBe(true));
    DOC_CATEGORIES.forEach((c) => expect(typesOfCategory(c.id).length, c.id).toBeGreaterThan(0));
    expect(new Set(DOC_TYPES.map((x) => x.id)).size).toBe(DOC_TYPES.length);
  });
});

describe('acervo: arquivos', () => {
  it('aceita documento, imagem, áudio e vídeo dentro do teto; recusa o resto', () => {
    expect(validateAcervoFile({ type: 'application/pdf', size: 1000 }).ok).toBe(true);
    expect(validateAcervoFile({ type: 'application/pdf', size: 26 * 1024 * 1024 }).ok).toBe(false);
    expect(validateAcervoFile({ type: 'video/mp4', size: 90 * 1024 * 1024 }).ok).toBe(true);
    expect(validateAcervoFile({ type: 'application/zip', size: 10 }).ok).toBe(false);
    expect(validateAcervoFile({ type: 'image/png', size: 0 }).ok).toBe(false);
    expect(fileFamilyOf('audio/mpeg').id).toBe('audio');
  });

  it('o caminho do rascunho é a pasta de quem envia', () => {
    expect(acervoUploadPath('u1', 'abc', 'application/pdf')).toBe('federacao-acervo/u1/abc.pdf');
    expect(acervoUploadPath('u1', 'abc', 'video/quicktime')).toBe('federacao-acervo/u1/abc.mov');
  });

  it('tamanho legível', () => {
    expect(fileSizeLabel(2.5 * 1024 * 1024)).toBe('2,5 MB');
    expect(fileSizeLabel(300)).toBe('1 KB');
  });
});

describe('acervo: vídeo por link', () => {
  it('YouTube e Vimeo viram incorporação sem rastreio; outro site não', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10').embed).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ').provider).toBe('youtube');
    expect(videoEmbed('https://vimeo.com/123456789').embed).toBe('https://player.vimeo.com/video/123456789');
    expect(videoEmbed('https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbed('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
});

describe('acervo: rascunho', () => {
  it('categoria vem do tipo; palavras-chave sem repetição; visibilidade padrão pública', () => {
    const r = validateDocInput({ type: 'resolution', title: '  Calendário   2027 ', files: [arq], tags: 'Calendário, etapas, calendário' });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ category: 'acts', title: 'Calendário 2027', visibility: 'public', tags: ['calendário', 'etapas'] });
  });

  it('documento vazio, tipo inválido, título curto e data ruim são recusados', () => {
    const r = validateDocInput({ type: 'xx', title: 'ab', act_date: '2026-1-1' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['act_date', 'content', 'title', 'type']);
  });

  it('errata exige apontar o documento corrigido', () => {
    expect(validateDocInput({ type: 'errata', title: 'Errata', body: 'x' }).errors.relations).toBeTruthy();
    expect(validateDocInput({ type: 'errata', title: 'Errata', body: 'x', relations: [{ kind: 'errata', doc_id: 'abc' }] }).ok).toBe(true);
  });

  it('arquivo fora da pasta do acervo é recusado', () => {
    expect(validateDocInput({ type: 'minutes', title: 'Ata', files: [{ ...arq, path: 'uploads/u1/a.pdf' }] }).errors['files.0']).toBeTruthy();
  });

  it('link de vídeo que não é YouTube/Vimeo é recusado', () => {
    expect(validateDocInput({ type: 'video', title: 'AGO', media_links: [{ url: 'https://x.com/v' }] }).errors['media_links.0']).toBeTruthy();
  });
});

describe('acervo: exibição', () => {
  const pub = (extra) => ({ status: 'published', visibility: 'public', ...extra });

  it('código e título', () => {
    expect(docCode({ type: 'resolution', number: 3, year: 2026 })).toBe('Resolução nº 3/2026');
    expect(docCode({ type: 'statute', number: 3, year: 2026 })).toBe('');
    expect(docDisplayTitle({ type: 'resolution', number: 3, year: 2026, title: 'Calendário' })).toBe('Resolução nº 3/2026 — Calendário');
  });

  it('em vigor: publicado e não revogado', () => {
    expect(isDocCurrent(pub())).toBe(true);
    expect(isDocCurrent(pub({ revoked_by: { doc_id: 'x' } }))).toBe(false);
    expect(isDocCurrent({ status: 'withdrawn' })).toBe(false);
  });

  it('ordena pela data do ato e filtra por busca sem acento, categoria, ano e vigência', () => {
    const docs = [
      pub({ id: 'a', type: 'resolution', category: 'acts', title: 'Calendário', act_date: '2025-03-01' }),
      pub({ id: 'b', type: 'statute', category: 'structure', title: 'Estatuto social', act_date: '2026-05-01', tags: ['governança'] }),
      pub({ id: 'c', type: 'resolution', category: 'acts', title: 'Taxas', act_date: '2026-01-10', revoked_by: { doc_id: 'x' } }),
    ];
    expect(sortDocs(docs).map((d) => d.id)).toEqual(['b', 'c', 'a']);
    expect(filterDocs(docs, { q: 'calendario' }).map((d) => d.id)).toEqual(['a']);
    expect(filterDocs(docs, { q: 'governanca' }).map((d) => d.id)).toEqual(['b']);
    expect(filterDocs(docs, { category: 'acts', onlyCurrent: true }).map((d) => d.id)).toEqual(['a']);
    expect(filterDocs(docs, { year: 2026 }).map((d) => d.id)).toEqual(['b', 'c']);
    expect(docYears(docs)).toEqual([2026, 2025]);
  });

  it('endereço público', () => {
    expect(docPublicPath({ slug: 'fpp' }, 'd1')).toBe('/f/fpp/acervo/d1');
  });

  it('ações: rascunho edita/publica/apaga; publicado retifica; só o admin retira', () => {
    expect(docActions({ status: 'draft' })).toMatchObject({ edit: true, publish: true, remove: true, rectify: false, withdraw: false });
    expect(docActions(pub())).toMatchObject({ edit: false, rectify: true, revoke: true, withdraw: false });
    expect(docActions(pub(), { isAdmin: true }).withdraw).toBe(true);
    expect(docActions(pub({ revoked_by: { doc_id: 'x' } }))).toMatchObject({ rectify: false, revoke: false, errata: true });
  });
});

describe('acervo: transparência', () => {
  const NOW = Date.UTC(2026, 9, 21);
  it('conta só público, em vigor e (quando pede) recente', () => {
    const docs = [
      { type: 'statute', status: 'published', visibility: 'public', act_date: '2019-01-01' },
      { type: 'financial_statements', status: 'published', visibility: 'public', act_date: '2023-04-01' },
      { type: 'minutes', status: 'published', visibility: 'members', act_date: '2026-04-01' },
      { type: 'ethics_code', status: 'published', visibility: 'public', act_date: '2024-01-01', revoked_by: { doc_id: 'x' } },
    ];
    const r = Object.fromEntries(transparencyChecklist(docs, { nowMs: NOW }).map((x) => [x.id, x.ok]));
    expect(r).toMatchObject({ statute: true, accounts: false, minutes: false, ethics: false });
  });
});
