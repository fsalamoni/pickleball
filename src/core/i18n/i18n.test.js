import { describe, it, expect, afterEach } from 'vitest';
import { definirIdioma, t, tn, idiomaAtivo } from './engine.js';
import { idiomaSuportado, IDIOMAS } from './languages.js';
import { carregarIdioma, arquivosDoIdioma } from './loader.js';
import { fmtNumero, fmtLista } from './format.js';

afterEach(() => definirIdioma('pt-BR', {}));

describe('motor', () => {
  it('sem catálogo devolve o próprio português, com variáveis', () => {
    expect(t('Olá')).toBe('Olá');
    expect(t('Você tem {n} XP', { n: 5 })).toBe('Você tem 5 XP');
    expect(t('Falta {x}', {})).toBe('Falta {x}');
  });
  it('usa o catálogo e cai no português se faltar a chave', () => {
    definirIdioma('en', { Olá: 'Hello' });
    expect(t('Olá')).toBe('Hello');
    expect(t('Outro')).toBe('Outro');
  });
  it('plural: português por n===1, en/es pelo Intl', () => {
    expect(tn(1, '{n} jogo', '{n} jogos')).toBe('1 jogo');
    expect(tn(0, '{n} jogo', '{n} jogos')).toBe('0 jogos');
    definirIdioma('en', { '{n} jogos': ['{n} game', '{n} games'] });
    expect(tn(1, '{n} jogo', '{n} jogos')).toBe('1 game');
    expect(tn(2, '{n} jogo', '{n} jogos')).toBe('2 games');
  });
  it('idioma desconhecido vira o padrão', () => {
    definirIdioma('xx', {});
    expect(idiomaAtivo()).toBe('pt-BR');
  });
});

describe('registro', () => {
  it('reconhece variantes regionais', () => {
    expect(idiomaSuportado('en-GB')).toBe('en');
    expect(idiomaSuportado('es-MX')).toBe('es');
    expect(idiomaSuportado('pt-PT')).toBe('pt-BR');
    expect(idiomaSuportado('fr')).toBeNull();
    expect(idiomaSuportado(null)).toBeNull();
  });
  it('todo idioma tem locale válido para o Intl', () => {
    IDIOMAS.forEach((i) => expect(() => new Intl.NumberFormat(i.locale)).not.toThrow());
  });
});

describe('carga sob demanda', () => {
  it('pt-BR não carrega catálogo nenhum', async () => {
    expect(await carregarIdioma('pt-BR')).toBe('pt-BR');
    expect(t('Idioma')).toBe('Idioma');
  });
  it('en e es carregam os catálogos do núcleo', async () => {
    expect(arquivosDoIdioma('en').length).toBeGreaterThan(0);
    await carregarIdioma('en');
    expect(t('Idioma')).toBe('Language');
    await carregarIdioma('es');
    expect(t('Idioma')).toBe('Idioma');
    expect(idiomaAtivo()).toBe('es');
  });
});

describe('formatação', () => {
  it('segue o idioma ativo', async () => {
    expect(fmtNumero(1234.5)).toBe((1234.5).toLocaleString('pt-BR'));
    definirIdioma('en', {});
    expect(fmtNumero(1234.5)).toBe('1,234.5');
    expect(fmtLista(['a', 'b', 'c'])).toBe('a, b, and c');
  });
});
