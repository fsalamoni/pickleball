import { describe, it, expect } from 'vitest';
import { LEGAL_DOCUMENTS } from './legalDocuments.js';
import { legalDocTranslation, legalSourceHash } from './legalTranslation.js';
import en from '../i18n/documentos/en.js';
import es from '../i18n/documentos/es.js';
import { IDIOMAS, IDIOMA_PADRAO } from '@/core/i18n/languages.js';

const TRADUCOES = { en, es };

describe('tradução de cortesia dos documentos legais', () => {
  it('há tradução para todo idioma do registro', () => {
    const alvos = IDIOMAS.map((i) => i.codigo).filter((c) => c !== IDIOMA_PADRAO).sort();
    expect(Object.keys(TRADUCOES).sort()).toEqual(alvos);
  });

  it.each(Object.entries(TRADUCOES))('%s: todo documento traduzido, do texto em português ATUAL e com a mesma estrutura', (_c, mapa) => {
    const faltando = LEGAL_DOCUMENTS.filter((d) => !mapa[d.key]).map((d) => d.key);
    expect(faltando, 'documentos sem tradução').toEqual([]);
    const sobrando = Object.keys(mapa).filter((k) => !LEGAL_DOCUMENTS.some((d) => d.key === k));
    expect(sobrando, 'tradução de documento que não existe').toEqual([]);

    const desatualizados = LEGAL_DOCUMENTS
      .filter((d) => mapa[d.key].fonte !== legalSourceHash(d))
      .map((d) => `${d.key} (fonte ${mapa[d.key].fonte} ≠ ${legalSourceHash(d)})`);
    expect(desatualizados, 'o português mudou: atualize a tradução e a `fonte`').toEqual([]);

    for (const d of LEGAL_DOCUMENTS) {
      const tr = mapa[d.key];
      for (const campo of ['title', 'eyebrow', 'description']) {
        expect(typeof tr[campo] === 'string' && tr[campo].length > 0, `${d.key}.${campo}`).toBe(true);
      }
      expect(tr.sections.length, `${d.key}: número de seções`).toBe(d.sections.length);
      d.sections.forEach((s, i) => {
        const ts = tr.sections[i];
        expect(!!ts.title, `${d.key}[${i}].title`).toBe(true);
        expect(!!ts.description, `${d.key}[${i}].description`).toBe(!!s.description);
        expect((ts.paragraphs || []).length, `${d.key}[${i}].paragraphs`).toBe((s.paragraphs || []).length);
        expect((ts.bullets || []).length, `${d.key}[${i}].bullets`).toBe((s.bullets || []).length);
        expect(Object.keys(ts).filter((k) => !['title', 'description', 'paragraphs', 'bullets'].includes(k)), `${d.key}[${i}]`).toEqual([]);
      });
    }
  });

  it('a tradução nunca toca no que vale para o consentimento', () => {
    const d = LEGAL_DOCUMENTS[0];
    const tr = legalDocTranslation(d, en);
    expect(tr.title).not.toBe(d.title);
    for (const campo of ['key', 'route', 'version', 'effectiveDate', 'gate', 'marketGate', 'category', 'audience', 'flag']) {
      expect(tr[campo]).toBe(d[campo]);
    }
    expect(tr.sections.map((s) => s.icon)).toEqual(d.sections.map((s) => s.icon));
  });

  it('tradução de outro texto em português não é mostrada', () => {
    const d = LEGAL_DOCUMENTS[0];
    expect(legalDocTranslation({ ...d, title: `${d.title}.` }, en)).toBeNull();
    expect(legalDocTranslation(d, null)).toBeNull();
    expect(legalDocTranslation(d, {})).toBeNull();
  });
});
