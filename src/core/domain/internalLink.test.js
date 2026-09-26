import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { INTERNAL_LINK_PATTERN, isRuleSafeLink, linkDeAviso } from './internalLink.js';

describe('linkDeAviso — o aviso pede só o que a regra aceita', () => {
  it('caminho interno comum segue igual', () => {
    expect(linkDeAviso('/arenas/abc/campanhas/x1')).toBe('/arenas/abc/campanhas/x1');
    expect(linkDeAviso('/clubes/abc?tab=forum')).toBe('/clubes/abc?tab=forum');
    expect(linkDeAviso('/')).toBe('/');
  });

  it('🐞 link com # perde só o fragmento (antes derrubava o lote inteiro)', () => {
    expect(isRuleSafeLink('/arenas/abc#arena-reservar')).toBe(false);
    expect(linkDeAviso('/arenas/abc#arena-reservar')).toBe('/arenas/abc');
    expect(linkDeAviso('/coaches/u1#professor-clinicas')).toBe('/coaches/u1');
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
