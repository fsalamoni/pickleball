/**
 * PARIDADE cliente × servidor dos documentos do clube: a lista de tipos, as marcas
 * que a regra lê (`pub`/`members`) e a validação (a mesma da federação, só com os
 * tipos do clube) são as mesmas dos dois lados. Mexer em um lado só quebra aqui.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/clubs/domain/docs.js';
import { validateDocInput, DOC_TYPES } from '@/modules/federations/domain/acervo.js';

const require = createRequire(import.meta.url);
const p = require('./clubDocsPolicy.js');
const A = require('./federationAcervoPolicy.js');

describe('paridade dos documentos do clube', () => {
  it('os mesmos tipos, todos existentes no catálogo da federação', () => {
    expect([...p.CLUB_DOC_TYPES]).toEqual([...c.CLUB_DOC_TYPE_IDS]);
    const catalogo = new Set(DOC_TYPES.map((x) => x.id));
    c.CLUB_DOC_TYPE_IDS.forEach((id) => expect(catalogo.has(id), id).toBe(true));
    expect(c.clubDocTypes().map((x) => x.id)).toEqual(DOC_TYPES.map((x) => x.id).filter((id) => c.CLUB_DOC_TYPE_IDS.includes(id)));
  });

  it('as mesmas marcas de leitura para cada situação e visibilidade', () => {
    for (const status of ['draft', 'published', 'withdrawn']) {
      for (const visibility of ['public', 'members', 'staff']) {
        expect(p.readFlags(status, visibility), `${status}/${visibility}`).toEqual(c.readFlags(status, visibility));
      }
    }
    expect(c.readFlags('published', 'members')).toEqual({ pub: false, members: true });
    expect(c.readFlags('published', 'staff')).toEqual({ pub: false, members: false });
  });

  it('a mesma validação: tipo de fora do clube é recusado nos dois lados, o resto é igual', () => {
    const entradas = [
      { type: 'bylaws', title: 'Regimento', body: 'texto' },
      { type: 'referee_rules', title: 'Arbitragem', body: 'texto' },
      { type: 'minutes', title: '', body: 'texto' },
      { type: 'minutes', title: 'Ata', body: '' },
      { type: 'video', title: 'Vídeo', media_links: [{ url: 'https://www.youtube.com/watch?v=abc123xyz00', title: '' }] },
    ];
    for (const e of entradas) {
      const servidor = p.validateClubDoc(e);
      const cliente = validateDocInput(e, { allowedTypes: c.CLUB_DOC_TYPE_IDS });
      expect(servidor.ok, JSON.stringify(e)).toBe(cliente.ok);
      expect(Object.keys(servidor.errors).sort()).toEqual(Object.keys(cliente.errors).sort());
    }
  });

  it('o caminho de envio aceita a pasta do clube e recusa o resto, nos dois lados', () => {
    const arq = (path) => ({ type: 'bylaws', title: 'Regimento', files: [{ name: 'r.pdf', path, size: 11, content_type: 'application/pdf' }] });
    const casos = [
      ['clube-acervo/uid123/abc_def.pdf', true],
      ['federacao-acervo/uid123/abc_def.pdf', true],
      ['clube-acervo/uid123/../x.pdf', false],
      ['outra-pasta/uid123/abc.pdf', false],
    ];
    for (const [path, ok] of casos) {
      expect(A.validateDoc(arq(path)).ok, path).toBe(ok);
      expect(validateDocInput(arq(path)).ok, path).toBe(ok);
    }
  });

  it('a lista pública mostra só o publicado e o aviso respeita a versão', () => {
    const docs = [{ id: 'a', status: 'draft' }, { id: 'b', status: 'published', published_at_ms: 2 }, { id: 'c', status: 'withdrawn' }];
    expect(c.visibleClubDocs(docs).map((d) => d.id)).toEqual(['b']);
    expect(c.canNotifyDoc({ status: 'published', visibility: 'public', version: 1 })).toBe(true);
    expect(c.canNotifyDoc({ status: 'published', visibility: 'public', version: 1, notified_version: 1 })).toBe(false);
    expect(c.canNotifyDoc({ status: 'published', visibility: 'public', version: 2, notified_version: 1 })).toBe(true);
    expect(c.canNotifyDoc({ status: 'published', visibility: 'staff', version: 1 })).toBe(false);
    expect(c.canNotifyDoc({ status: 'draft', visibility: 'public' })).toBe(false);
  });

  it('o endereço do documento, no app e na vitrine', () => {
    expect(c.clubDocPath('c 1')).toBe('/clubes/c%201?tab=documentos');
    expect(c.clubDocPath('c1', 'd1')).toBe('/clubes/c1?tab=documentos&doc=d1');
    expect(c.clubDocPath('c1', 'd1', { publica: true })).toBe('/c/c1?doc=d1');
    expect(c.clubDocPath('c1', null, { publica: true })).toBe('/c/c1');
  });
});
