import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Navegação v3 (flag nav_v3): o caminho ANTIGO precisa continuar intacto com a
// flag desligada, e o novo tem de sair do domínio (bottomNavItems), nunca de
// uma lista escrita na tela.
const src = readFileSync(resolve(process.cwd(), 'src/v2/components/V2Layout.jsx'), 'utf8');

describe('navegação v3 (nav_v3)', () => {
  it('a barra inferior v3 sai de bottomNavItems e a antiga segue como padrão', () => {
    expect(src).toMatch(/items=\{navV3 \? bottomItemsV3 : BOTTOM_NAV_ITEMS\}/);
    expect(src).toMatch(/import \{ bottomNavItems \} from '@\/core\/domain\/bottomNav'/);
    expect(src).toMatch(/items = BOTTOM_NAV_ITEMS/);
  });

  it('o cabeçalho só encolhe para 56 px com a flag ligada', () => {
    expect(src).toMatch(/navV3 \? 'h-14 lg:h-20' : 'h-20'/);
  });

  it('as âncoras de dica do menu continuam no lugar', () => {
    for (const a of ['botao-procuro-jogo', 'menu-principal', 'menu-celular', 'menu-arenas', 'menu-jogar']) {
      expect(src, a).toContain(`'${a}'`.replace(/'/g, '') );
    }
  });

  it('o toque na barra e nos hubs é medido (nav_bottom_click / nav_hub_click)', () => {
    expect(src).toMatch(/recordEvent\('nav_bottom_click'/);
    expect((src.match(/recordEvent\('nav_hub_click'/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
