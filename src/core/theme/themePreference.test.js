/**
 * A escolha do modo escuro — o que protege:
 *
 *  1. ⭐ o padrão é o CLARO, e quem não escolheu nada nunca vê o escuro;
 *  2. ⭐ sem flag ou sem login, o escuro NUNCA vale (e o espelho do aparelho é
 *     apagado — ninguém fica preso no escuro);
 *  3. o automático segue o aparelho, e o espelho guarda a ESCOLHA (não o
 *     efeito), para ser reavaliado a cada abertura;
 *  4. ⭐ duas pessoas no mesmo navegador não se misturam;
 *  5. as cópias (cor da barra, chave do espelho) batem com a paleta e com o
 *     script de `index.html`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  TEMA, TEMA_PADRAO, TEMA_PREF_ID, TEMA_DISPOSITIVO_KEY, COR_DA_BARRA, OPCOES_DE_TEMA, ROTA_SEMPRE_CLARA,
  normalizarTema, temaDisponivel, temaEfetivo, espelhoDoDispositivo,
  lerEscolhaDeTema, salvarEscolhaDeTema,
} from './themePreference.js';
import { META_THEME_COLOR } from './palette.js';

beforeEach(() => { window.localStorage.clear(); });

const ON = { ligado: true, autenticado: true };

describe('⭐ o padrão e quem pode ver o escuro', () => {
  it('o padrão é o claro — ninguém acorda com a plataforma diferente', () => {
    expect(TEMA_PADRAO).toBe(TEMA.CLARO);
    expect(temaEfetivo({ ...ON })).toBe('claro');
    expect(temaEfetivo({ ...ON, escolha: 'qualquer-coisa' })).toBe('claro');
  });

  it('⭐ flag desligada: claro, seja qual for a escolha', () => {
    for (const escolha of Object.values(TEMA)) {
      expect(temaEfetivo({ ligado: false, autenticado: true, escolha, sistemaEscuro: true })).toBe('claro');
    }
  });

  it('⭐ visitante (sem login): claro — a escolha é do usuário', () => {
    expect(temaEfetivo({ ligado: true, autenticado: false, escolha: 'escuro' })).toBe('claro');
    expect(temaDisponivel({ ligado: true, autenticado: false })).toBe(false);
    expect(temaDisponivel({})).toBe(false);
    expect(temaDisponivel(ON)).toBe(true);
  });

  it('escuro é escuro; automático segue o aparelho', () => {
    expect(temaEfetivo({ ...ON, escolha: 'escuro', sistemaEscuro: false })).toBe('escuro');
    expect(temaEfetivo({ ...ON, escolha: 'automatico', sistemaEscuro: true })).toBe('escuro');
    expect(temaEfetivo({ ...ON, escolha: 'automatico', sistemaEscuro: false })).toBe('claro');
    expect(temaEfetivo({ ...ON, escolha: 'claro', sistemaEscuro: true })).toBe('claro');
  });
});

describe('o espelho do aparelho', () => {
  it('guarda a ESCOLHA escura (o automático é reavaliado a cada abertura)', () => {
    expect(espelhoDoDispositivo({ ...ON, escolha: 'escuro' })).toBe('escuro');
    expect(espelhoDoDispositivo({ ...ON, escolha: 'automatico' })).toBe('automatico');
  });

  it('⭐ é apagado sempre que o escuro não pode valer', () => {
    expect(espelhoDoDispositivo({ ...ON, escolha: 'claro' })).toBeNull();
    expect(espelhoDoDispositivo({ ...ON })).toBeNull();
    expect(espelhoDoDispositivo({ ligado: false, autenticado: true, escolha: 'escuro' })).toBeNull();
    expect(espelhoDoDispositivo({ ligado: true, autenticado: false, escolha: 'escuro' })).toBeNull();
  });
});

describe('a escolha por usuário', () => {
  it('guarda e devolve, no escopo do uid', () => {
    expect(lerEscolhaDeTema('ana')).toBe('claro');
    expect(salvarEscolhaDeTema('ana', 'escuro')).toBe(true);
    expect(lerEscolhaDeTema('ana')).toBe('escuro');
    expect(window.localStorage.getItem(`v2:view:ana:${TEMA_PREF_ID}`)).toBe('escuro');
  });

  it('⭐ duas pessoas no MESMO navegador não se misturam', () => {
    salvarEscolhaDeTema('ana', 'escuro');
    salvarEscolhaDeTema('bia', 'automatico');
    expect(lerEscolhaDeTema('ana')).toBe('escuro');
    expect(lerEscolhaDeTema('bia')).toBe('automatico');
    expect(lerEscolhaDeTema('caio')).toBe('claro');
  });

  it('o claro escolhido é gravado (se o padrão mudar, quem escolheu fica)', () => {
    salvarEscolhaDeTema('ana', 'claro');
    expect(window.localStorage.getItem(`v2:view:ana:${TEMA_PREF_ID}`)).toBe('claro');
  });

  it('valor desconhecido não é gravado nem ressuscita', () => {
    expect(salvarEscolhaDeTema('ana', 'roxo')).toBe(false);
    expect(salvarEscolhaDeTema(null, 'escuro')).toBe(false);
    window.localStorage.setItem(`v2:view:ana:${TEMA_PREF_ID}`, 'sepia');
    expect(lerEscolhaDeTema('ana')).toBe('claro');
    expect(lerEscolhaDeTema(null)).toBe('claro');
    expect(normalizarTema(42)).toBeNull();
  });
});

describe('as opções e as cópias', () => {
  it('três opções, na ordem, com rótulo e descrição em pt-BR', () => {
    expect(OPCOES_DE_TEMA.map((o) => o.valor)).toEqual(['claro', 'escuro', 'automatico']);
    expect(OPCOES_DE_TEMA.map((o) => o.rotulo)).toEqual(['Claro', 'Escuro', 'Automático']);
    OPCOES_DE_TEMA.forEach((o) => expect(o.descricao.length).toBeGreaterThan(10));
  });

  it('⭐ a cor da barra é a mesma da paleta', () => {
    expect(COR_DA_BARRA.claro.toLowerCase()).toBe(META_THEME_COLOR.light.toLowerCase());
    expect(COR_DA_BARRA.escuro.toLowerCase()).toBe(META_THEME_COLOR.dark.toLowerCase());
  });

  it('⭐ o script de index.html lê a mesma chave e pinta a mesma cor', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`getItem('${TEMA_DISPOSITIVO_KEY}')`);
    expect(html).toContain(`'${COR_DA_BARRA.escuro}'`);
    expect(html).toContain(`content="${COR_DA_BARRA.claro}"`);
    expect(html).toContain(`t === '${TEMA.ESCURO}'`);
    expect(html).toContain(`t === '${TEMA.AUTOMATICO}'`);
    expect(html).toContain(`/${ROTA_SEMPRE_CLARA.source}/.test(window.location.pathname)`);
  });

  it('as rotas sempre claras: telões, totem e impressão — e só elas', () => {
    ['/dia-de-jogo/a/telao', '/torneios/b/telao', '/arenas/c/totem', '/torneios/b/imprimir', '/torneios/b/telao/']
      .forEach((r) => expect(ROTA_SEMPRE_CLARA.test(r), r).toBe(true));
    ['/', '/torneios/b', '/arenas/c', '/dia-de-jogo/a', '/telaoextra/x', '/totens']
      .forEach((r) => expect(ROTA_SEMPRE_CLARA.test(r), r).toBe(false));
  });
});
