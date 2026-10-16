/**
 * O APP INSTALADO (PWA) — o que o celular lê e nenhuma tela mostra.
 *
 * Caminho de ícone errado não dá erro: o Hosting devolve o index.html no lugar
 * da imagem e o celular instala um ícone em branco (ou o Chrome recusa
 * instalar). Este guarda confere os dois manifestos, o index.html, o
 * iconeDoApp.js e os avisos de push contra os arquivos de `public/`.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICONE_APPLE, MANIFESTO } from '@/core/pwa/iconeDoApp';

const ler = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const publico = (url) => join(process.cwd(), 'public', url.replace(/^\//, ''));
const manifestos = Object.fromEntries(
  Object.entries(MANIFESTO).map(([v, url]) => [v, JSON.parse(readFileSync(publico(url), 'utf8'))]),
);

describe('PWA: manifestos claro e escuro', () => {
  it('⭐ os dois são o MESMO app (id, início, escopo, nome)', () => {
    const chaves = ['id', 'start_url', 'scope', 'name', 'short_name', 'display'];
    for (const k of chaves) expect(manifestos.escuro[k], k).toBe(manifestos.claro[k]);
  });

  it('⭐ cada um traz any 192/512, maskable 512 e monochrome — e os arquivos existem', () => {
    for (const [v, m] of Object.entries(manifestos)) {
      const tem = (purpose, sizes) => m.icons.some((i) => i.purpose === purpose && i.sizes === sizes);
      expect(tem('any', '192x192') && tem('any', '512x512') && tem('maskable', '512x512') && tem('monochrome', '512x512'), v).toBe(true);
      for (const i of m.icons) expect(existsSync(publico(i.src)), i.src).toBe(true);
      // Versão certa em cada manifesto (o monocromático é o mesmo nos dois).
      for (const i of m.icons.filter((x) => x.purpose !== 'monochrome')) expect(i.src).toContain(`-${v}-`);
    }
  });

  it('não trava a orientação (telão e tablet em paisagem)', () => {
    for (const m of Object.values(manifestos)) expect(m.orientation).toBeUndefined();
  });
});

describe('PWA: index.html, service worker e push', () => {
  const html = ler('index.html');

  it('⭐ o index.html aponta para arquivos que existem (manifesto, iOS, favicon)', () => {
    const urls = [...html.matchAll(/<link rel="(?:manifest|apple-touch-icon|icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const u of urls) expect(existsSync(publico(u)), u).toBe(true);
    for (const u of Object.values(ICONE_APPLE)) expect(existsSync(publico(u)), u).toBe(true);
    expect(html).toContain(`href="${MANIFESTO.claro}"`);
  });

  it('a barra do iPhone não é translúcida (relógio branco sumia no tema claro)', () => {
    expect(html).toMatch(/apple-mobile-web-app-status-bar-style" content="default"/);
  });

  it('⭐ o service worker não guarda o manifesto em cache', () => {
    const sw = ler('public/sw.js').replace(/\/\/.*$/gm, '');
    expect(sw).not.toMatch(/webmanifest/);
  });

  it('o ícone e o selo dos avisos de push existem', () => {
    const codigo = ['public/firebase-messaging-sw.js', 'functions/index.js', 'functions/messagingAdmin.js'].map(ler).join('\n');
    const urls = [...codigo.matchAll(/['"](\/(?:icones\/)?[\w-]+\.png)['"]/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const u of urls) expect(existsSync(publico(u)), u).toBe(true);
  });
});
