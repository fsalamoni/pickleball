/**
 * O plugin do modo escuro, rodando o Tailwind DE VERDADE com a configuração
 * do projeto — o que protege:
 *
 *  1. ⭐ `bg-white` é o cartão (acompanha `--k`); `text-white` continua branco;
 *  2. ⭐ superfície de cor zera `--kf` (o texto desenhado para ela volta a
 *     valer) e superfície neutra o restabelece — com TODAS as variantes
 *     (hover, group-hover, estado, responsivo);
 *  3. véus: `bg-white/10` continua branco, `bg-ink/40` continua ink profundo,
 *     `bg-ink/5` (hover sutil) vira um clarão no escuro;
 *  4. ⭐ o escuro só vale na TELA (`@media screen`): impresso é claro;
 *  5. o `.tema-claro` redeclara o claro; o shadcn claro do plugin é CÓPIA
 *     exata do `:root` de `index.css` (se um mudar, o outro muda junto).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import config from '../../../tailwind.config.js';
import { SHADCN_LIGHT } from './palette.js';

const HTML = `<div class="bg-white text-white text-ink text-gray-500 border-gray-100 bg-ink bg-ink/5 bg-ink/40
  bg-white/10 bg-white/90 border-white/10 bg-acid bg-amber-50 bg-green-600 hover:bg-acid group-hover:bg-ink
  hover:bg-acid-light text-gray-400
  data-[state=active]:bg-ink sm:bg-paper-pure bg-paper shadow-organic bg-black/60 bg-acid/15 tema-claro"></div>`;

let css = '';
beforeAll(async () => {
  const r = await postcss([tailwind({ ...config, content: [{ raw: HTML }] })])
    .process('@tailwind base;\n@tailwind utilities;', { from: undefined });
  css = r.css;
}, 30000);

/** Todas as regras de um seletor exato, concatenadas. */
const regras = (seletor) => {
  const esc = seletor.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]).join('\n');
};

describe('⭐ cartão e texto', () => {
  it('bg-white acompanha --k; text-white é estático', () => {
    expect(regras('.bg-white')).toContain('var(--k)');
    expect(regras('.text-white')).toContain('rgb(255 255 255');
    expect(regras('.text-white')).not.toContain('var(--k');
  });

  it('texto e borda acompanham --kf', () => {
    expect(regras('.text-ink')).toContain('var(--kf)');
    expect(regras('.text-gray-500')).toContain('var(--kf)');
    expect(regras('.border-gray-100')).toContain('var(--kf)');
  });
});

describe('⭐ superfícies', () => {
  it('de cor zera --kf; neutra o restabelece', () => {
    expect(regras('.bg-ink')).toContain('--kf: 0');
    expect(regras('.bg-acid')).toContain('--kf: 0');
    expect(regras('.bg-green-600')).toContain('--kf: 0');
    expect(regras('.bg-white')).toContain('--kf: var(--k)');
    expect(regras('.bg-paper')).toContain('--kf: var(--k)');
    expect(regras('.bg-amber-50')).toContain('--kf: var(--k)');
  });

  it('as variantes vêm junto (hover, grupo, estado, responsivo)', () => {
    expect(regras('.hover\\:bg-acid:hover')).toContain('--kf: 0');
    expect(regras('.group:hover .group-hover\\:bg-ink')).toContain('--kf: 0');
    expect(regras('.data-\\[state\\=active\\]\\:bg-ink[data-state="active"]')).toContain('--kf: 0');
    expect(css).toMatch(/\.sm\\:bg-paper-pure\s*\{[^}]*--kf: var\(--k\)/);
  });

  it('tinta translúcida não redefine o texto (bg-acid/15)', () => {
    expect(regras('.bg-acid\\/15')).not.toContain('--kf');
  });
});

describe('⭐ o texto padrão das superfícies de cor clara', () => {
  it('é por atributo — o Tailwind não gera cópia com variante que venceria o text-*', () => {
    const tela = css.slice(css.indexOf('@media screen'));
    expect(tela).toContain('.dark :where([class~="bg-acid"], [class~="bg-acid-light"]');
    // Com `hover:bg-acid-light` no conteúdo, nenhuma cópia da regra aparece
    // (era o defeito: o botão ácido com `text-gray-400` saía com texto ink).
    expect(css).not.toMatch(/:where\([^)]*hover\\:bg-acid-light/);
    // E o `text-gray-400` vem DEPOIS dela (mesma especificidade: vence).
    expect(css.indexOf('.text-gray-400')).toBeGreaterThan(css.indexOf('[class~="bg-acid"]'));
  });
});

describe('véus', () => {
  it('bg-white/10 continua branco; bg-white/90 é cartão fosco', () => {
    expect(regras('.bg-white\\/10')).toContain('rgb(255 255 255 / 0.1)');
    expect(regras('.bg-white\\/90')).toContain('--kf: var(--k)');
  });

  it('bg-ink/40 é o véu profundo; bg-ink/5 vira clarão no escuro', () => {
    expect(regras('.bg-ink\\/40')).toContain('rgb(11 15 25 / 0.4)');
    expect(regras('.bg-ink\\/5')).toContain('calc(11 + 220 * var(--k))');
  });

  it('borda branca translúcida continua branca', () => {
    expect(regras('.border-white\\/10')).toContain('rgb(255 255 255 / 0.1)');
  });

  it('véu preto é véu (texto do design original)', () => {
    expect(regras('.bg-black\\/60')).toContain('--kf: 0');
  });
});

describe('⭐ escopos', () => {
  it('o escuro só na tela: .dark dentro de @media screen', () => {
    const tela = css.slice(css.indexOf('@media screen'));
    expect(css.indexOf('@media screen')).toBeGreaterThan(-1);
    expect(tela).toMatch(/:root\.dark,\s*\.dark\s*\{[^}]*--k: 1;[^}]*--kf: 1;[^}]*color-scheme: dark/);
    // E nenhum .dark fora da tela.
    const fora = css.slice(0, css.indexOf('@media screen'));
    expect(fora).not.toMatch(/(^|\n)\s*\.dark\s*\{/);
  });

  it('⭐ o shadcn escuro vence o :root claro de index.css (diálogos e menus escuros)', () => {
    // O `:root` de index.css vem DEPOIS e tem a mesma especificidade de `.dark`:
    // o escuro precisa de `:root.dark` para vencer no <html>.
    const tela = css.slice(css.indexOf('@media screen'));
    expect(tela).toMatch(/:root\.dark,\s*\.dark\s*\{[^}]*--background: /);
  });

  it('o claro é o padrão e o .tema-claro o redeclara', () => {
    expect(regras(':root')).toMatch(/--k: 0;[\s\S]*--kf: 0/);
    expect(regras('.tema-claro')).toMatch(/--k: 0;[\s\S]*--kf: 0;[\s\S]*color-scheme: light/);
    expect(regras('.tema-claro')).toContain('--background: 48 45% 97%');
  });

  it('as sombras da marca acompanham o modo', () => {
    expect(regras('.shadow-organic')).toContain('0 24px 48px -12px var(--sh-organic-cor)');
    expect(regras('.shadow-organic')).toContain('--tw-shadow-colored: 0 24px 48px -12px var(--tw-shadow-color)');
  });

  it('⭐ o shadcn CLARO do plugin é cópia exata do :root de index.css', () => {
    const indexCss = readFileSync('src/index.css', 'utf8');
    const root = /:root\s*\{([^}]*)\}/.exec(indexCss)[1];
    for (const [nome, valor] of Object.entries(SHADCN_LIGHT)) {
      expect(root, nome).toMatch(new RegExp(`${nome.replace(/-/g, '\\-')}:\\s*${valor.replace(/%/g, '\\%')};`));
    }
  });
});
