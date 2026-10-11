import { describe, it, expect } from 'vitest';
import { flagsQueMudam, resolveAdminTab, searchAdminTabs } from './consoleNav.js';

const S = [
  { id: 'community', label: 'Comunidade', tabs: [{ id: 'records', label: 'Cadastros', keywords: ['usuários', 'excluir conta'] }, { id: 'partners', label: 'Parceiros' }] },
  { id: 'features', label: 'Funcionalidades', tabs: [{ id: 'flags', label: 'Flags por assunto' }] },
  { id: 'training', label: 'Treino', tabs: [{ id: 'treino-biblioteca', label: 'Biblioteca inicial' }] },
];
const ALL = S.flatMap((s) => s.tabs);

describe('resolveAdminTab', () => {
  it('aba que existe abre; `profiles` (antiga) vira Cadastros; desconhecida cai em overview', () => {
    expect(resolveAdminTab('flags', ALL)).toBe('flags');
    expect(resolveAdminTab('profiles', ALL)).toBe('records');
    expect(resolveAdminTab('nada', ALL)).toBe('overview');
    expect(resolveAdminTab(null, ALL)).toBe('overview');
  });
});

describe('searchAdminTabs', () => {
  it('⭐ toda aba em até 3 letras: nome da aba, da seção ou palavra-chave, sem acento', () => {
    expect(searchAdminTabs(S, 'fla').map((r) => r.id)).toEqual(['flags']);
    expect(searchAdminTabs(S, 'cad').map((r) => r.id)).toEqual(['records']);
    expect(searchAdminTabs(S, 'bib').map((r) => r.id)).toEqual(['treino-biblioteca']);
    expect(searchAdminTabs(S, 'usu').map((r) => r.id)).toEqual(['records']);
    expect(searchAdminTabs(S, 'tre').map((r) => r.id)).toEqual(['treino-biblioteca']);
  });
  it('quem começa com o termo vem antes de quem só contém; vazio devolve nada', () => {
    expect(searchAdminTabs(S, 'par').map((r) => r.id)).toEqual(['partners']);
    expect(searchAdminTabs(S, 'parc').map((r) => r.id)).toEqual(['partners']);
    expect(searchAdminTabs(S, '  ')).toEqual([]);
    expect(searchAdminTabs(S, 'ini')[0]).toMatchObject({ id: 'treino-biblioteca', secao: 'Treino' });
  });
});

describe('flagsQueMudam', () => {
  it('só as que trocam de estado', () => {
    const flags = { a: true, b: false, c: true };
    expect(flagsQueMudam(['a', 'b', 'c'], flags, true)).toEqual(['b']);
    expect(flagsQueMudam(['a', 'b', 'c'], flags, false)).toEqual(['a', 'c']);
  });
});
