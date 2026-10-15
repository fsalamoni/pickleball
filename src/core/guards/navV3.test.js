import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Navegação v3: nasceu atrás da flag `nav_v3` e virou código em 2026-10-11. O
// que não pode regredir: a barra inferior sai do domínio (bottomNavItems), o
// vocabulário sai de navRotulos, e nenhum ramo da flag volta.
const src = readFileSync(resolve(process.cwd(), 'src/v2/components/V2Layout.jsx'), 'utf8');

describe('navegação v3 (incorporada)', () => {
  it('a flag nav_v3 não existe mais no layout', () => {
    expect(src).not.toMatch(/navV3|NAV_V3|nav_v3|BOTTOM_NAV_ITEMS/);
  });

  it('a barra inferior sai de bottomNavItems, nunca de uma lista na tela', () => {
    expect(src).toMatch(/import \{ bottomNavItems \} from '@\/core\/domain\/bottomNav'/);
    expect(src).toMatch(/items=\{bottomItems\}/);
  });

  it('o cabeçalho do celular tem 56 px e respeita a área segura', () => {
    expect(src).toMatch(/'h-14 lg:h-20'/);
    expect(src).toMatch(/paddingTop: 'env\(safe-area-inset-top\)'/);
  });

  it('o cabeçalho cabe na tela: content-box com w-full soma o recuo à largura', () => {
    const header = src.slice(src.indexOf('<header'), src.indexOf('</header>'));
    expect(header).toMatch(/boxSizing: 'content-box'/);
    expect(header.slice(0, header.indexOf('style='))).not.toMatch(/\bw-full\b/);
  });

  it('as âncoras de dica do menu continuam no lugar', () => {
    for (const a of ['menu-principal', 'menu-celular', 'menu-arenas', 'menu-jogar']) {
      expect(src, a).toContain(a);
    }
  });

  it('o vocabulário do menu sai de navRotulos (§5.1), nunca de texto na tela', () => {
    expect(src).toMatch(/import \{ navRotulos \} from '@\/core\/domain\/navRotulos'/);
    for (const chave of ['abaDiaDeJogo', 'vagas', 'pessoas', 'reservar', 'gamificacao', 'meusTorneios']) {
      expect(src, chave).toContain(`rotulos.${chave}`);
    }
    expect(src).not.toMatch(/label: 'Procura-se jogo'|label: 'Encontrar jogadores'|label: 'Explorar quadras'|label: 'Procuro jogo'/);
    // "Pickleball" (regras, nivelamento) não volta ao 1º nível do menu.
    expect(src).not.toMatch(/id: 'aprender'/);
  });

  it('a paleta de comandos é lazy e abre por Ctrl/⌘+K, campo e ícone', () => {
    expect(src).toMatch(/const V2CommandPalette = lazy\(\(\) => import\('@\/v2\/components\/search\/V2CommandPalette'\)\)/);
    expect(src).toMatch(/\{paletaAberta && \(/);
    for (const origem of ['teclado', 'cabecalho', 'icone']) expect(src, origem).toContain(`abrirPaleta('${origem}')`);
    expect(src).toMatch(/recordEvent\('search_open'/);
    const paleta = readFileSync(resolve(process.cwd(), 'src/v2/components/search/V2CommandPalette.jsx'), 'utf8');
    expect(paleta).toMatch(/recordEvent\('search_pick'/);
    expect(paleta).toMatch(/commandIndex\(/);
    expect(paleta).toMatch(/role="combobox"/);
  });

  it('⭐ a barra lateral e a gaveta mostram os hubs ESCOLHIDOS (useSidebarNav); a busca indexa todos', () => {
    expect(src).toMatch(/import \{ useSidebarNav \} from '@\/core\/lib\/useSidebarNav'/);
    expect((src.match(/hubsVisiveis\.map\(/g) || []).length).toBe(2);
    expect(src).toMatch(/hubs=\{hubs\}/);
    expect(src).toMatch(/findActiveHub\(location\.pathname, hubs\)/);
    expect(src).toContain('/configuracoes#menu-lateral');
  });

  it('o toque na barra e nos hubs é medido (nav_bottom_click / nav_hub_click)', () => {
    expect(src).toMatch(/recordEvent\('nav_bottom_click'/);
    expect((src.match(/recordEvent\('nav_hub_click'/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
