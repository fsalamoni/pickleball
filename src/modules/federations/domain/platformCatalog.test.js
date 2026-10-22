import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOC_KINDS, DEFAULT_TIER_TEMPLATES, applyTierTemplate, defaultModulesFrom, docKindsCatalog, docSuggestions,
  normalizeDefaultModules, suggestDocKindId, tierTemplatesCatalog, validateDocKinds, validateTierTemplates,
} from './platformCatalog.js';
import { normalizeOtherDocs } from './privateData.js';
import { validateTiers } from './officialRanking.js';

describe('documentos sugeridos', () => {
  it('sem nada gravado valem os padrão, todos ligados', () => {
    const c = docKindsCatalog({});
    expect(c).toHaveLength(DEFAULT_DOC_KINDS.length);
    expect(c.every((d) => d.active)).toBe(true);
  });

  it('lista gravada (mesmo vazia) é a escolha do admin', () => {
    expect(docKindsCatalog({ doc_kinds: [] })).toEqual([]);
    expect(docKindsCatalog({ doc_kinds: [{ id: 'x', label: 'Ruim' }, { id: 'laudo', label: 'Laudo', scope: 'zzz', active: false }] }))
      .toEqual([{ id: 'laudo', label: 'Laudo', scope: 'all', active: false }]);
  });

  it('sugere ao plano só os ligados, do público certo e que ele ainda não pede', () => {
    const c = docKindsCatalog({});
    const pessoa = docSuggestions(c, { atuais: [{ id: 'o_1', label: 'foto 3x4' }] });
    expect(pessoa.some((d) => d.label === 'Foto 3x4')).toBe(false);
    expect(pessoa.some((d) => d.label === 'Exame de vista')).toBe(true);
    expect(pessoa.some((d) => d.label === 'Estatuto social')).toBe(false);
    const org = docSuggestions(c, { entidade: true });
    expect(org.map((d) => d.label)).toContain('Estatuto social');
    expect(org.some((d) => d.label === 'Exame de vista')).toBe(false);
  });

  it('a sugestão cabe no formato do documento próprio do plano', () => {
    const longo = docKindsCatalog({ doc_kinds: [{ id: 'a'.repeat(21), label: 'Documento longo' }] });
    const s = docSuggestions(longo);
    expect(normalizeOtherDocs(s)).toEqual(s);
  });

  it('valida nome, código e repetição', () => {
    const r = validateDocKinds([{ id: 'laudo', label: 'Laudo' }, { id: 'laudo', label: 'laudo' }, { id: '1x', label: 'L' }]);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['id_1', 'id_2', 'label_1', 'label_2']);
    expect(validateDocKinds(DEFAULT_DOC_KINDS).ok).toBe(true);
  });

  it('o código sugerido não repete e passa na validação', () => {
    const id = suggestDocKindId('Exame de vista', ['exame_de_vista']);
    expect(id).toBe('exame_de_vista_2');
    expect(validateDocKinds([{ id: suggestDocKindId('1º documento'), label: 'Primeiro' }]).ok).toBe(true);
  });
});

describe('modelos de categorias', () => {
  it('os modelos padrão passam pela mesma régua das categorias da federação', () => {
    expect(validateTierTemplates(DEFAULT_TIER_TEMPLATES).ok).toBe(true);
    tierTemplatesCatalog({}).forEach((m) => expect(validateTiers(m.tiers).ok).toBe(true));
  });

  it('copiar troca {SIGLA} pela sigla da federação', () => {
    const [m] = tierTemplatesCatalog({});
    const tiers = applyTierTemplate(m, { acronym: 'FGP' });
    expect(tiers.map((x) => `${x.code} · ${x.group}`)).toEqual(['FGP 1000 · G1', 'FGP 500 · G2', 'FGP 250 · G3']);
    expect(tiers[0].points_by_place[1]).toBe(1000);
    expect(applyTierTemplate(m, {})[0].code).toBe('1000');
  });

  it('modelo com categoria inválida é recusado', () => {
    const r = validateTierTemplates([{ id: 'ruim', name: 'Ruim', tiers: [{ id: 'a', code: 'A', points_by_place: { 1: 10, 2: 20 } }] }]);
    expect(r.ok).toBe(false);
    expect(r.errors.tiers_0).toBeTruthy();
  });

  it('lista gravada vazia é a escolha do admin', () => {
    expect(tierTemplatesCatalog({ tournament_tier_templates: [] })).toEqual([]);
  });
});

describe('módulos iniciais', () => {
  it('ausente, nenhum nasce ligado', () => {
    expect(Object.values(defaultModulesFrom({})).some(Boolean)).toBe(false);
  });

  it('ranking leva torneios junto; chave desconhecida some', () => {
    const m = normalizeDefaultModules({ ranking: true, inventado: true });
    expect(m.ranking).toBe(true);
    expect(m.tournaments).toBe(true);
    expect('inventado' in m).toBe(false);
  });
});
