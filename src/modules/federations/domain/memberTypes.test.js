import { describe, it, expect } from 'vitest';
import {
  BUILTIN_MEMBER_TYPE_IDS, categoryFor, isOrgMember, memberTypeCatalog, memberTypeName, memberTypeOf, personTypeLabel, planTypeFields, suggestMemberTypeId, validateMemberTypes,
} from './memberTypes.js';

describe('catálogo de tipos de filiação', () => {
  it('sem configuração: os cinco prontos, ligados', () => {
    const cat = memberTypeCatalog(undefined);
    expect(cat.map((x) => x.id)).toEqual(BUILTIN_MEMBER_TYPE_IDS);
    expect(cat.every((x) => x.active && x.builtin)).toBe(true);
    expect(cat.find((x) => x.id === 'club').entity).toBe('club');
  });
  it('o admin renomeia e desliga os prontos, mas não muda a entidade nem o grupo', () => {
    const cat = memberTypeCatalog({ member_types: [{ id: 'club', label: 'Clube filiado', entity: 'person', category: 'athlete', active: false }] });
    const club = cat.find((x) => x.id === 'club');
    expect(club).toMatchObject({ label: 'Clube filiado', entity: 'club', category: 'club', active: false });
    expect(memberTypeName(club)).toBe('Clube filiado');
  });
  it('tipos criados: entidade e grupo válidos; id ruim some', () => {
    const cat = memberTypeCatalog({ member_types: [{ id: 'dirigente', label: 'Dirigente', category: 'xx' }, { id: 'escola', label: 'Escola', entity: 'club' }, { id: '1ruim', label: 'X' }] });
    expect(cat.find((x) => x.id === 'dirigente')).toMatchObject({ entity: 'person', category: 'none', builtin: false });
    expect(cat.find((x) => x.id === 'escola')).toMatchObject({ entity: 'club', category: 'club' });
    expect(cat.some((x) => x.id === '1ruim')).toBe(false);
  });
  it('tipo que saiu do catálogo vale pelo que o plano gravou', () => {
    const t = memberTypeOf(memberTypeCatalog(), { person_type: 'antigo', person_type_label: 'Antigo', entity: 'arena' });
    expect(t).toMatchObject({ id: 'antigo', label: 'Antigo', entity: 'arena', category: 'arena', active: false });
    expect(personTypeLabel({ person_type: 'antigo', person_type_label: 'Antigo' })).toBe('Antigo');
    expect(personTypeLabel({ person_type: 'coach' })).toBe('Professor(a)');
    expect(personTypeLabel({})).toBe('Atleta');
    // Com o catálogo, o nome atual do admin vence o gravado no plano.
    const catalogo = memberTypeCatalog({ member_types: [{ id: 'juiz_linha', label: 'Juiz(a) de linha', entity: 'person', category: 'referee' }] });
    expect(personTypeLabel({ person_type: 'juiz_linha', person_type_label: 'Juiz de linha' }, catalogo)).toBe('Juiz(a) de linha');
    expect(personTypeLabel({ person_type: 'antigo', person_type_label: 'Antigo' }, catalogo)).toBe('Antigo');
  });
  it('o plano grava o tipo resolvido', () => {
    expect(planTypeFields(memberTypeCatalog(), 'arena')).toEqual({ person_type: 'arena', entity: 'arena', person_category: 'arena', person_type_label: 'Arena' });
  });
  it('clube e arena contam como eles mesmos; pessoa só nos quatro grupos', () => {
    expect(categoryFor('club', 'athlete')).toBe('club');
    expect(categoryFor('person', 'coach')).toBe('coach');
    expect(categoryFor('person', 'club')).toBe('none');
    expect(isOrgMember({ org_kind: 'arena' })).toBe(true);
    expect(isOrgMember({ person_type: 'arena' })).toBe(false);
  });
});

describe('validateMemberTypes', () => {
  it('repõe os prontos que faltarem e recusa código repetido ou inválido', () => {
    const r = validateMemberTypes([{ id: 'dirigente', label: 'Dirigente', entity: 'person', category: 'none' }]);
    expect(r.ok).toBe(true);
    expect(r.value.map((x) => x.id)).toEqual(['dirigente', ...BUILTIN_MEMBER_TYPE_IDS]);
    expect(validateMemberTypes([{ id: 'a', label: 'Xx' }]).ok).toBe(false);
    expect(validateMemberTypes([{ id: 'abc', label: 'Xx' }, { id: 'abc', label: 'Yy' }]).ok).toBe(false);
    expect(validateMemberTypes([{ id: 'abc', label: '' }]).errors.label_0).toBeTruthy();
  });
  it('nome igual ao padrão não é gravado (segue traduzido)', () => {
    const r = validateMemberTypes([{ id: 'athlete', label: 'Atleta', active: false }]);
    expect(r.value.find((x) => x.id === 'athlete')).toMatchObject({ label: '', active: false, entity: 'person', category: 'athlete' });
  });
  it('sugere o código pelo nome', () => {
    expect(suggestMemberTypeId('Dirigente esportivo')).toBe('dirigente_esportivo');
    expect(suggestMemberTypeId('Árbitro', ['arbitro'])).toBe('arbitro_2');
    expect(suggestMemberTypeId('123')).toBe('tipo');
  });
});
