import { describe, it, expect } from 'vitest';
import { caminhoLimpo, casaAlgumaRota, casaRota, moldeNavegavel } from './dicasRota.js';

describe('casaRota', () => {
  it('sem curinga é EXATO — "/" é só a tela inicial', () => {
    expect(casaRota('/', '/')).toBe(true);
    expect(casaRota('/', '/torneios')).toBe(false);
    expect(casaRota('/dia-de-jogo', '/dia-de-jogo')).toBe(true);
    expect(casaRota('/dia-de-jogo', '/dia-de-jogo/abc')).toBe(false);
  });

  it('* vale por UM segmento', () => {
    expect(casaRota('/arenas/*', '/arenas/abc')).toBe(true);
    expect(casaRota('/arenas/*', '/arenas')).toBe(false);
    expect(casaRota('/arenas/*', '/arenas/abc/gerir')).toBe(false);
    expect(casaRota('/arenas/*/gerir', '/arenas/abc/gerir')).toBe(true);
  });

  it('** no fim vale pelo resto, inclusive nada', () => {
    expect(casaRota('/torneios/**', '/torneios')).toBe(true);
    expect(casaRota('/torneios/**', '/torneios/a/gerenciar')).toBe(true);
    expect(casaRota('/torneios/**', '/ranking')).toBe(false);
  });

  it('ignora consulta, âncora e barra final', () => {
    expect(casaRota('/arenas/*/gerir', '/arenas/x/gerir?aba=quadras')).toBe(true);
    expect(casaRota('/configuracoes', '/configuracoes#pagina-inicial')).toBe(true);
    expect(casaRota('/perfil', '/perfil/')).toBe(true);
    expect(caminhoLimpo('')).toBe('/');
  });

  it('molde inválido não casa com nada', () => {
    expect(casaRota(null, '/')).toBe(false);
    expect(casaRota('torneios', '/torneios')).toBe(false);
  });

  it('casaAlgumaRota e moldeNavegavel', () => {
    expect(casaAlgumaRota(['/ranking', '/ranking/duplas'], '/ranking/duplas')).toBe(true);
    expect(casaAlgumaRota('/ranking', '/ranking')).toBe(true);
    expect(casaAlgumaRota([], '/')).toBe(false);
    expect(moldeNavegavel('/dia-de-jogo')).toBe(true);
    expect(moldeNavegavel('/arenas/*')).toBe(false);
  });
});
