import { describe, expect, it } from 'vitest';
import { CHAVE_ICONE_FIXADO, ICONE_APPLE, MANIFESTO, iniciarIconeDoApp, varianteDoIcone } from './iconeDoApp';

function janela({ escuro = false, standalone = false, fixada = null } = {}) {
  const links = {
    manifest: { href: '/manifest.webmanifest', setAttribute(_, v) { this.href = v; } },
    'apple-touch-icon': { href: '/apple-touch-icon.png', setAttribute(_, v) { this.href = v; } },
  };
  const store = new Map(fixada ? [[CHAVE_ICONE_FIXADO, fixada]] : []);
  const ouvintes = {};
  const tema = { matches: escuro, addEventListener: (_, f) => { tema.mudou = f; }, removeEventListener() {} };
  const win = {
    document: { querySelector: (sel) => links[/rel="([^"]+)"/.exec(sel)[1]] },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    matchMedia: (q) => (q.includes('color-scheme') ? tema : { matches: standalone }),
    navigator: {},
    addEventListener: (ev, f) => { ouvintes[ev] = f; },
    removeEventListener() {},
  };
  return { win, links, store, tema, ouvintes };
}

describe('varianteDoIcone', () => {
  it('segue o tema do aparelho até ser fixada', () => {
    expect(varianteDoIcone({ fixada: null, escuro: true })).toBe('escuro');
    expect(varianteDoIcone({ fixada: null, escuro: false })).toBe('claro');
    expect(varianteDoIcone({ fixada: 'claro', escuro: true })).toBe('claro');
    expect(varianteDoIcone({ fixada: 'lixo', escuro: true })).toBe('escuro');
  });
});

describe('iniciarIconeDoApp', () => {
  it('celular no escuro: manifesto e ícone do iOS na versão escura', () => {
    const { win, links } = janela({ escuro: true });
    iniciarIconeDoApp(win);
    expect(links.manifest.href).toBe(MANIFESTO.escuro);
    expect(links['apple-touch-icon'].href).toBe(ICONE_APPLE.escuro);
  });

  it('acompanha a troca de tema com a página aberta (antes de instalar)', () => {
    const { win, links, tema } = janela({ escuro: false });
    iniciarIconeDoApp(win);
    expect(links.manifest.href).toBe(MANIFESTO.claro);
    tema.matches = true;
    tema.mudou();
    expect(links.manifest.href).toBe(MANIFESTO.escuro);
  });

  it('ao instalar, fixa a versão: o ícone não troca a cada mudança de tema', () => {
    const { win, links, tema, store, ouvintes } = janela({ escuro: true });
    iniciarIconeDoApp(win);
    ouvintes.appinstalled();
    expect(store.get(CHAVE_ICONE_FIXADO)).toBe('escuro');
    tema.matches = false;
    tema.mudou();
    expect(links.manifest.href).toBe(MANIFESTO.escuro);
  });

  it('aberto como app sem versão fixada (instalado antes): fixa a de agora', () => {
    const { win, store } = janela({ escuro: false, standalone: true });
    iniciarIconeDoApp(win);
    expect(store.get(CHAVE_ICONE_FIXADO)).toBe('claro');
  });

  it('sem matchMedia (ambiente antigo) não quebra', () => {
    expect(() => iniciarIconeDoApp({ document: { querySelector: () => null } })).not.toThrow();
  });
});
