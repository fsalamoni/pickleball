import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  INTERNAL_LINK_PATTERN, destinoDeAviso, hashDaAncora, isRuleSafeLink, linkDeAviso,
} from './internalLink.js';

describe('linkDeAviso — o aviso pede só o que a regra aceita', () => {
  it('caminho interno comum segue igual', () => {
    expect(linkDeAviso('/arenas/abc/campanhas/x1')).toBe('/arenas/abc/campanhas/x1');
    expect(linkDeAviso('/clubes/abc?tab=forum')).toBe('/clubes/abc?tab=forum');
    expect(linkDeAviso('/')).toBe('/');
  });

  it('🐞 link com # não derruba mais o lote: a âncora vira ?ancora= (que a regra aceita)', () => {
    expect(isRuleSafeLink('/arenas/abc#arena-reservar')).toBe(false);
    expect(linkDeAviso('/arenas/abc#arena-reservar')).toBe('/arenas/abc?ancora=arena-reservar');
    expect(linkDeAviso('/coaches/u1#professor-clinicas')).toBe('/coaches/u1?ancora=professor-clinicas');
    expect(linkDeAviso('/arenas/abc?aba=planos#arena-planos')).toBe('/arenas/abc?aba=planos&ancora=arena-planos');
    for (const l of ['/arenas/abc#arena-reservar', '/arenas/abc?aba=planos#arena-planos']) {
      expect(isRuleSafeLink(linkDeAviso(l))).toBe(true);
    }
  });

  it('âncora estranha é descartada — a página certa abre, sem rolar', () => {
    expect(linkDeAviso('/arenas/abc#<script>')).toBe('/arenas/abc');
    expect(linkDeAviso('/arenas/abc#')).toBe('/arenas/abc');
    expect(linkDeAviso('/arenas/abc#a b')).toBe('/arenas/abc');
  });

  it('⭐ o caminho de volta: ?ancora=secao vira #secao, sem perder os outros parâmetros', () => {
    expect(hashDaAncora({ pathname: '/arenas/abc', search: '?ancora=arena-planos' }))
      .toEqual({ pathname: '/arenas/abc', search: '', hash: '#arena-planos' });
    expect(hashDaAncora({ pathname: '/arenas/abc', search: '?aba=planos&ancora=arena-planos' }))
      .toEqual({ pathname: '/arenas/abc', search: '?aba=planos', hash: '#arena-planos' });
    expect(hashDaAncora({ pathname: '/x', search: '?aba=1' })).toBeNull();
    expect(hashDaAncora({ pathname: '/x', search: '?ancora=%3Cb%3E' })).toEqual({ pathname: '/x', search: '', hash: '' });
    // Ida e volta.
    const ida = linkDeAviso('/coaches/u1#professor-clinicas');
    const [pathname, query] = ida.split('?');
    expect(hashDaAncora({ pathname, search: `?${query}` }).hash).toBe('#professor-clinicas');
  });

  it('nada que saia do domínio passa', () => {
    expect(linkDeAviso('https://site.com')).toBeNull();
    expect(linkDeAviso('//site-falso.com')).toBeNull();
    expect(linkDeAviso('javascript:alert(1)')).toBeNull();
    expect(linkDeAviso('#topo')).toBeNull();
  });

  it('vazio e não-texto viram null', () => {
    expect(linkDeAviso('')).toBeNull();
    expect(linkDeAviso('   ')).toBeNull();
    expect(linkDeAviso(null)).toBeNull();
    expect(linkDeAviso(42)).toBeNull();
  });

  it('⭐ o padrão é o MESMO da regra do Firestore (se a regra mudar, isto muda junto)', () => {
    const regras = readFileSync('firestore.rules', 'utf8');
    const m = regras.match(/function isInternalLink[\s\S]*?l\.matches\('([^']+)'\)/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe(INTERNAL_LINK_PATTERN);
  });
});

describe('destinoDeAviso — para onde a tela pode navegar', () => {
  it('aceita caminho interno, com busca e âncora', () => {
    expect(destinoDeAviso('/torneios/abc')).toBe('/torneios/abc');
    expect(destinoDeAviso('/arenas/x?aba=membros&ancora=arena-planos')).toBe('/arenas/x?aba=membros&ancora=arena-planos');
    expect(destinoDeAviso('/arenas/x#arena-reservar')).toBe('/arenas/x#arena-reservar');
    expect(destinoDeAviso('  /perfil  ')).toBe('/perfil');
  });

  it('recusa o que sai do site', () => {
    expect(destinoDeAviso('https://evil.com')).toBeNull();
    expect(destinoDeAviso('//evil.com')).toBeNull();
    expect(destinoDeAviso('/\\evil.com')).toBeNull();
    expect(destinoDeAviso('\\\\evil.com')).toBeNull();
    expect(destinoDeAviso('javascript:alert(1)')).toBeNull();
    expect(destinoDeAviso('/ok\u0000')).toBeNull();
    expect(destinoDeAviso('/a\nb')).toBeNull();
  });

  it('recusa o que não é texto', () => {
    expect(destinoDeAviso(null)).toBeNull();
    expect(destinoDeAviso(undefined)).toBeNull();
    expect(destinoDeAviso(42)).toBeNull();
    expect(destinoDeAviso('')).toBeNull();
    expect(destinoDeAviso(`/${'a'.repeat(2001)}`)).toBeNull();
  });
});
