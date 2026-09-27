/**
 * O MODO ESCURO no Tailwind — as cores por propriedade e o plugin.
 *
 * Só o `tailwind.config.js` importa este arquivo (ele roda no Node, na hora
 * do build). Nenhuma tela o importa — e há guarda travando isso: a tela
 * escreve as classes de sempre, e quem decide a cor é a paleta
 * (`palette.js`).
 *
 * O plugin faz três coisas:
 *
 *  1. declara os interruptores (`--k`, `--kf`) e os escopos: `:root` (claro),
 *     `.dark` (escuro, só na TELA — impresso é sempre claro) e `.tema-claro`
 *     (congela o visual claro num trecho: telão, totem, moldura do QR code);
 *  2. retuna as variáveis do shadcn (diálogos, menus, toasts) para a paleta
 *     ink/acid no escuro, e as sombras;
 *  3. ensina cada `bg-*` a dizer que SUPERFÍCIE ele é — de cor (o texto
 *     desenhado para ela volta a valer: `--kf: 0`) ou neutra (`--kf:
 *     var(--k)`) — e trata os véus translúcidos. Como é um `matchUtilities`
 *     com o MESMO prefixo `bg`, todas as variantes vêm de graça: `hover:`,
 *     `group-hover:`, `data-[state=active]:`, `sm:`, `/80`.
 */
import plugin from 'tailwindcss/plugin.js';
import {
  BRAND, DARK, SHADCN_DARK, SHADCN_LIGHT, SHADOWS, SHADOW_GEOMETRY, SURFACE, TINT_ALPHA_MAX, DARK_BODY_BACKGROUND,
  alphaPercent, colorExpression, surfaceKind, themeColors, tokenPairs, hexToRgb,
} from './palette.js';

/** As cores de cada propriedade, para `theme.extend`. */
export function themeExtension() {
  const bg = themeColors('bg');
  const fg = themeColors('fg');
  const line = themeColors('line');
  return {
    // Fundo: o próprio fundo, os degradês e o recuo do anel (que imita o fundo).
    backgroundColor: bg,
    gradientColorStops: bg,
    ringOffsetColor: bg,
    // Texto: o texto, o placeholder, os ícones (fill/stroke), o cursor.
    textColor: fg,
    placeholderColor: fg,
    fill: fg,
    stroke: fg,
    caretColor: fg,
    textDecorationColor: fg,
    accentColor: fg,
    // Linha: borda, divisória, contorno e anel de foco.
    borderColor: line,
    divideColor: line,
    outlineColor: line,
    ringColor: line,
    // As sombras da marca ficam mais fundas no escuro (uma sombra de 6% some).
    boxShadow: { ...SHADOW_GEOMETRY },
  };
}

/** A cor de um token num modo fixo (o claro), para a base e os escopos. */
const rgbLiteral = (hex, alpha = 1) => {
  const [r, g, b] = hexToRgb(hex);
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
};

/** A cor de um token que acompanha o interruptor (sem `<alpha-value>`). */
const exprSolida = (group, token, sw) => {
  const p = tokenPairs(group)[token];
  return colorExpression(p.light, p.dark, sw).replace(' / <alpha-value>', '');
};

/** As superfícies de cor CLARA, que pedem texto escuro no escuro também. */
const CLARAS_DE_COR = [
  'bg-acid', 'bg-acid-light', 'bg-acid-dark', 'bg-yellow-300', 'bg-yellow-400',
  'bg-amber-300', 'bg-amber-400', 'bg-lime-300', 'bg-lime-400',
];

/** Faixas de opacidade do `bg-ink/NN` (ver `inkVeil`). */
const INK_TINT_MAX = 20;

/**
 * `bg-ink/NN` translúcido é uma de duas coisas, e nenhuma é a "superfície de
 * destaque" do escuro:
 *  - até 15%: TINTA de hover sobre o cartão (`hover:bg-ink/5`). No escuro, ink
 *    escuro sobre escuro some — vira um clarão do texto principal;
 *  - de 20% em diante: VÉU (fundo de modal, sombra sobre foto). Continua o ink
 *    profundo nos dois modos: um véu tem de escurecer o que está atrás.
 */
function inkVeil(alpha) {
  const a = alpha / 100;
  if (alpha < INK_TINT_MAX) {
    const [lr, lg, lb] = hexToRgb(BRAND.ink.DEFAULT);
    const [dr, dg, db] = hexToRgb(DARK.text);
    const c = (l, d) => `calc(${l} + ${d - l} * var(--k))`;
    return `rgb(${c(lr, dr)} ${c(lg, dg)} ${c(lb, db)} / ${a})`;
  }
  return rgbLiteral(BRAND.ink.DEFAULT, a);
}

/** Os valores do `bg`/`border` de que o plugin cuida (o nome do Tailwind → ele mesmo). */
function valoresDeSuperficie() {
  const out = {};
  for (const token of Object.keys(tokenPairs('bg'))) {
    if (surfaceKind(token)) out[token] = token;
  }
  return out;
}

/** Declarações de base: interruptores, escopos, shadcn, sombras, corpo. */
export function themeBaseStyles() {
  const corpoV2 = exprSolida('fg', 'ink-light', '--kf');
  return {
    ':root': { '--k': '0', '--kf': '0', ...SHADOWS.light },
    // Impresso é sempre claro: o escuro só vale na tela.
    '@media screen': {
      // `:root.dark` (e não só `.dark`): o `:root` de `index.css` declara o
      // shadcn claro com a MESMA especificidade e vem DEPOIS — com `.dark`
      // sozinho, os diálogos e menus sairiam claros no modo escuro. O `.dark`
      // continua valendo para um trecho (a miniatura em Configurações).
      ':root.dark, .dark': {
        '--k': '1',
        '--kf': '1',
        'color-scheme': 'dark',
        ...SHADCN_DARK,
        ...SHADOWS.dark,
      },
      '.dark body': { background: DARK_BODY_BACKGROUND },
      '.dark .glass': {
        background: 'rgba(15, 22, 36, 0.72)',
        'border-bottom-color': 'rgba(255, 255, 255, 0.06)',
      },
      // A seleção de texto do claro é texto escuro sobre verde translúcido —
      // no escuro, sumiria. Vira o ácido da marca, com o texto claro.
      '.dark ::selection': { background: 'rgb(212 248 46 / 0.3)', color: DARK.text },
      '.dark .tema-claro ::selection': { background: 'hsl(161 78% 28% / 0.18)', color: 'hsl(214 39% 16%)' },
      '.dark .v2-root ::-webkit-scrollbar-thumb': { background: '#2E3A55' },
      '.dark .v2-root ::-webkit-scrollbar-thumb:hover': { background: '#43506D' },
      // Superfície "clara de cor" (ácido, amarelo) sem classe de texto própria:
      // no claro ela herdava o texto escuro do corpo; no escuro herdaria o
      // texto CLARO. Especificidade baixa: qualquer text-* vence.
      // ⚠️ Por ATRIBUTO, nunca por classe: o Tailwind trata `.bg-acid-light`
      // numa regra de base como candidato e gera cópias com variante
      // (`hover:bg-acid-light`) DEPOIS dos utilitários — e aí esta regra
      // passaria a vencer o `text-*` do próprio botão.
      [`.dark :where(${CLARAS_DE_COR.map((c) => `[class~="${c}"]`).join(', ')})`]: {
        color: exprSolida('fg', 'ink-light', '--kf'),
      },
    },
    // Um trecho que fica CLARO mesmo no escuro — o telão e o totem (que já
    // são escuros de propósito, desenhados sobre os tokens claros), a moldura
    // de um QR code. Redeclara tudo o que o `.dark` mudou.
    '.tema-claro': {
      '--k': '0',
      '--kf': '0',
      'color-scheme': 'light',
      ...SHADCN_LIGHT,
      ...SHADOWS.light,
    },
    // O texto base do V2 acompanha o modo (era #1a2235 fixo).
    '.v2-root': { color: corpoV2 },
  };
}

export const themePlugin = plugin(({ addBase, matchUtilities }) => {
  addBase(themeBaseStyles());

  // Cada `bg-*` diz que superfície ele é para os filhos (e os véus).
  matchUtilities(
    {
      bg: (value, { modifier }) => {
        const alpha = alphaPercent(modifier);
        if (value === 'ink' && alpha < 100) {
          return { 'background-color': inkVeil(alpha), ...(alpha >= TINT_ALPHA_MAX ? { '--kf': '0' } : {}) };
        }
        if (alpha < TINT_ALPHA_MAX) {
          // Véu claro sobre painel escuro (`bg-white/10`): continua branco.
          if (value === 'white') return { 'background-color': rgbLiteral('#FFFFFF', alpha / 100) };
          return null;
        }
        const kind = surfaceKind(value);
        if (kind === SURFACE.NEUTRAL) return { '--kf': 'var(--k)' };
        if (kind === SURFACE.ON_COLOR) return { '--kf': '0' };
        return null;
      },
    },
    { values: valoresDeSuperficie(), type: ['color'], modifiers: 'any' },
  );

  // A borda branca translúcida (`border-white/10` num painel escuro) continua
  // branca; a sólida (o anel em volta do avatar) acompanha o cartão.
  matchUtilities(
    {
      border: (value, { modifier }) => {
        const alpha = alphaPercent(modifier);
        if (value === 'white' && alpha < TINT_ALPHA_MAX) {
          return { 'border-color': rgbLiteral('#FFFFFF', alpha / 100) };
        }
        return null;
      },
    },
    { values: { white: 'white' }, type: ['color'], modifiers: 'any' },
  );
});
