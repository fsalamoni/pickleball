/**
 * PALETA DO PICKLERUSH — os tokens de cor do modo CLARO e do modo ESCURO.
 *
 * Fonte ÚNICA. O `tailwind.config.js` monta as cores de cada propriedade daqui
 * (`themeColors`) e o plugin (`tailwindTheme.js`) injeta a base daqui
 * (`themeBaseStyles`). Nenhuma tela importa este arquivo: a tela escreve
 * `bg-white`, `text-gray-500`, `border-gray-100` como sempre escreveu, e a cor
 * certa sai sozinha nos dois modos.
 *
 * ## A ideia em uma frase
 *
 * Cada cor que muda no escuro vira
 *
 *     rgb(calc(CLARO + (ESCURO − CLARO) × var(--k)) …)
 *
 * e `--k` é um interruptor: 0 no claro, 1 no escuro. Com `--k: 0` a conta dá
 * EXATAMENTE a cor de hoje — o modo claro não muda um pixel (há teste
 * conferindo token a token contra a paleta original).
 *
 * ## Por que por PROPRIEDADE
 *
 * A mesma palavra significa coisas diferentes conforme a propriedade:
 * `bg-white` é o CARTÃO (no escuro, a superfície escura), mas `text-white` é o
 * texto sobre um botão escuro (no escuro, continua branco). Por isso há três
 * grupos, cada um com os seus valores escuros:
 *
 *   bg    fundo (e degradês, e o recuo do anel)          → interruptor --k
 *   fg    texto (e placeholder, ícones, cursor)          → interruptor --kf
 *   line  borda (e divisória, contorno, anel de foco)    → interruptor --kf
 *
 * ## Por que dois interruptores
 *
 * Texto e linha dependem da SUPERFÍCIE em que estão, não só da página. Um
 * painel `bg-ink` (o cabeçalho escuro, o botão secundário) ou um selo
 * `bg-acid` foram desenhados com o texto certo para eles — branco, `ink`,
 * `gray-300` — e esse texto continua certo no escuro, porque a superfície
 * continua escura (ou verde-ácido). Então essas superfícies zeram `--kf` para
 * os filhos ("superfície de cor": o design original volta a valer lá dentro), e
 * as superfícies neutras (`bg-white`, `bg-paper`, `bg-gray-100`…) o
 * restabelecem (`--kf: var(--k)`), para um cartão dentro de um painel escuro
 * voltar a ser um cartão do modo em vigor. Quem decide o que é cada superfície
 * é `surfaceKind`.
 *
 * ## Escopos
 *
 *   :root          --k: 0; --kf: 0      (claro — o padrão)
 *   .dark          --k: 1; --kf: 1      (escuro — só na TELA: impresso é claro)
 *   .tema-claro    --k: 0; --kf: 0      (congela o visual claro num trecho:
 *                                        telão, totem, a moldura do QR code)
 *
 * Lógica pura e testada; o único import é a paleta padrão do Tailwind (para
 * o modo claro ser idêntico ao de sempre).
 */
import twColors from 'tailwindcss/colors.js';

/* ------------------------------------------------------------------ */
/*  A marca (idêntica ao tailwind.config.js de antes)                  */
/* ------------------------------------------------------------------ */

export const BRAND = Object.freeze({
  acid: Object.freeze({ DEFAULT: '#D4F82E', light: '#E5FA7A', dark: '#A6C61A' }),
  ink: Object.freeze({ DEFAULT: '#0B0F19', light: '#1A2235', lighter: '#2D3A54' }),
  paper: Object.freeze({ DEFAULT: '#F7F9FC', pure: '#FFFFFF', dark: '#E2E8F0' }),
});

/**
 * O modo ESCURO — a família `ink` da marca, em camadas. Da mais funda para a
 * mais alta: a página, o cartão, e três degraus de realce. O verde-ácido não
 * muda: sobre o escuro ele fica ainda mais vivo, e é ele que marca a ação.
 */
export const DARK = Object.freeze({
  page: '#070B13', // o fundo da aplicação (bg-paper) — o recuo
  surface: '#0F1624', // o cartão (bg-white, bg-paper-pure)
  raised: '#141C2C', // realce leve (bg-gray-50, hover de lista)
  raised2: '#1A2336', // realce (bg-gray-100, esqueleto, campo)
  raised3: '#232E45', // realce forte (bg-gray-200)
  strong: '#26324B', // a superfície de destaque (bg-ink): aba ativa, botão secundário
  strongHover: '#303D5A', // bg-ink-light (o hover do botão secundário)
  text: '#E7ECF3', // o texto principal (text-ink)
  textSoft: '#D3DAE5', // text-ink-light (a cor base do corpo)
  textMuted: '#AEB8C8', // text-ink-lighter
  lineStrong: '#C7CFDB', // border-ink (contorno de seleção, hover forte)
});

/** O texto neutro no escuro — a escala cinza espelhada, calibrada por contraste. */
const DARK_NEUTRAL_FG = Object.freeze({
  50: '#1E2636', 100: '#2C3548', 200: '#3F4A60', 300: '#56627A', 400: '#8390A6',
  500: '#9CA7BA', 600: '#B6BFCD', 700: '#CDD4DF', 800: '#E1E6ED', 900: '#EEF1F6', 950: '#F6F8FB',
});

/** O fundo neutro no escuro — do cartão para cima. 500+ não muda (é chip escuro). */
const DARK_NEUTRAL_BG = Object.freeze({
  50: DARK.raised, 100: DARK.raised2, 200: DARK.raised3, 300: '#2E3A55', 400: '#43506D',
});

/** A borda neutra no escuro — linhas que separam sem gritar. */
const DARK_NEUTRAL_LINE = Object.freeze({
  50: '#141C2C', 100: '#1D2639', 200: '#28334B', 300: '#36435F', 400: '#4B5877',
});

export const NEUTRAL_FAMILIES = Object.freeze(['slate', 'gray', 'zinc', 'neutral', 'stone']);
export const COLOR_FAMILIES = Object.freeze([
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]);
export const SHADES = Object.freeze(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']);

/* ------------------------------------------------------------------ */
/*  Aritmética de cor                                                  */
/* ------------------------------------------------------------------ */

/** '#abc' / '#aabbcc' → [r, g, b] (inteiros 0–255). */
export function hexToRgb(hex) {
  const h = String(hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Cor inválida: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** [r, g, b] → '#rrggbb'. */
export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Mistura `cor` sobre `fundo` com opacidade `a` — o resultado sólido. */
export function mix(cor, fundo, a) {
  const c = hexToRgb(cor);
  const f = hexToRgb(fundo);
  return rgbToHex(c.map((v, i) => f[i] + (v - f[i]) * a));
}

/** Luminância relativa (WCAG 2.x). */
export function luminance(hex) {
  const lin = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Razão de contraste WCAG entre duas cores (1–21). */
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* ------------------------------------------------------------------ */
/*  Os valores do escuro, token a token                                */
/* ------------------------------------------------------------------ */

const lightOf = (family, shade) => twColors[family][shade];

/**
 * Tinta de fundo no escuro: a cor de meio (500) diluída sobre o cartão. É o
 * "selo verde clarinho" do claro virando um selo verde-escuro, discreto — o
 * texto colorido por cima é que se acende (ver `darkColorFg`).
 */
const TINT_BG = Object.freeze({ 50: 0.1, 100: 0.16, 200: 0.24 });
const TINT_LINE = Object.freeze({ 50: 0.14, 100: 0.22, 200: 0.3, 300: 0.42 });

/** Texto colorido no escuro: o tom espelhado (700 → 300), nunca abaixo de 400. */
const COLOR_FG_MIRROR = Object.freeze({ 500: '400', 600: '400', 700: '300', 800: '200', 900: '100', 950: '50' });

function darkColorBg(family, shade) {
  return TINT_BG[shade] != null ? mix(lightOf(family, '500'), DARK.surface, TINT_BG[shade]) : null;
}
function darkColorFg(family, shade) {
  return COLOR_FG_MIRROR[shade] ? lightOf(family, COLOR_FG_MIRROR[shade]) : null;
}
function darkColorLine(family, shade) {
  return TINT_LINE[shade] != null ? mix(lightOf(family, '500'), DARK.surface, TINT_LINE[shade]) : null;
}

/**
 * Todos os tokens de um grupo, com o valor claro e o escuro (`dark: null` =
 * igual ao claro, não muda). As chaves são as do Tailwind: 'white', 'ink',
 * 'ink-light', 'paper-pure', 'gray-500', 'amber-50'…
 *
 * @param {'bg'|'fg'|'line'} group
 * @returns {Record<string, { light: string, dark: string|null }>}
 */
export function tokenPairs(group) {
  const out = {};
  const put = (token, light, dark) => {
    out[token] = { light, dark: dark && dark.toLowerCase() !== light.toLowerCase() ? dark : null };
  };

  // Branco e preto.
  put('white', '#FFFFFF', group === 'bg' || group === 'line' ? DARK.surface : null);
  put('black', '#000000', null);

  // A marca.
  const ink = BRAND.ink;
  if (group === 'bg') {
    put('ink', ink.DEFAULT, DARK.strong);
    put('ink-light', ink.light, DARK.strongHover);
    put('ink-lighter', ink.lighter, '#3A4868');
    put('paper', BRAND.paper.DEFAULT, DARK.page);
    put('paper-pure', BRAND.paper.pure, DARK.surface);
    put('paper-dark', BRAND.paper.dark, DARK.raised2);
  } else if (group === 'fg') {
    put('ink', ink.DEFAULT, DARK.text);
    put('ink-light', ink.light, DARK.textSoft);
    put('ink-lighter', ink.lighter, DARK.textMuted);
    put('paper', BRAND.paper.DEFAULT, null);
    put('paper-pure', BRAND.paper.pure, null);
    put('paper-dark', BRAND.paper.dark, null);
  } else {
    put('ink', ink.DEFAULT, DARK.lineStrong);
    put('ink-light', ink.light, DARK.textSoft);
    put('ink-lighter', ink.lighter, DARK.textMuted);
    put('paper', BRAND.paper.DEFAULT, DARK.page);
    put('paper-pure', BRAND.paper.pure, DARK.surface);
    put('paper-dark', BRAND.paper.dark, DARK_NEUTRAL_LINE[200]);
  }
  put('acid', BRAND.acid.DEFAULT, null);
  put('acid-light', BRAND.acid.light, null);
  put('acid-dark', BRAND.acid.dark, null);

  // Neutros: as cinco famílias cinza convergem no escuro (a nuance de matiz
  // some sobre o fundo escuro), mas cada uma mantém o seu valor CLARO.
  for (const family of NEUTRAL_FAMILIES) {
    for (const shade of SHADES) {
      const light = lightOf(family, shade);
      let dark = null;
      if (group === 'bg') dark = DARK_NEUTRAL_BG[shade] || null;
      else if (group === 'fg') dark = DARK_NEUTRAL_FG[shade];
      else dark = DARK_NEUTRAL_LINE[shade] || null;
      put(`${family}-${shade}`, light, dark);
    }
  }

  // Cores.
  for (const family of COLOR_FAMILIES) {
    for (const shade of SHADES) {
      const light = lightOf(family, shade);
      const dark = group === 'bg' ? darkColorBg(family, shade)
        : group === 'fg' ? darkColorFg(family, shade)
          : darkColorLine(family, shade);
      put(`${family}-${shade}`, light, dark);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  A expressão de cor (o que o Tailwind escreve no CSS)               */
/* ------------------------------------------------------------------ */

/** O interruptor de cada grupo. */
export const SWITCH_VAR = Object.freeze({ bg: '--k', fg: '--kf', line: '--kf' });

/**
 * A cor como o Tailwind a usa, com `<alpha-value>` para `/50` funcionar.
 * Estática quando não muda; senão a interpolação pelo interruptor.
 */
export function colorExpression(light, dark, switchVar = '--k') {
  const [lr, lg, lb] = hexToRgb(light);
  if (!dark) return `rgb(${lr} ${lg} ${lb} / <alpha-value>)`;
  const [dr, dg, db] = hexToRgb(dark);
  const canal = (l, d) => (l === d ? `${l}` : `calc(${l} + ${d - l} * var(${switchVar}))`);
  return `rgb(${canal(lr, dr)} ${canal(lg, dg)} ${canal(lb, db)} / <alpha-value>)`;
}

/**
 * Avalia uma expressão de `colorExpression` num modo — para os testes
 * provarem que o claro é idêntico ao de sempre e medirem o contraste do escuro.
 */
export function evaluateExpression(expr, k) {
  const m = /^rgb\((.+) \/ <alpha-value>\)$/.exec(expr);
  if (!m) throw new Error(`Expressão inesperada: ${expr}`);
  const canais = m[1].match(/calc\([^)]*\)\)|\d+/g).map((c) => {
    if (/^\d+$/.test(c)) return Number(c);
    const [, base, delta] = /calc\((\d+) \+ (-?\d+) \* var/.exec(c);
    return Number(base) + Number(delta) * k;
  });
  return rgbToHex(canais);
}

/**
 * As cores de UM grupo no formato do tema do Tailwind: `{ white, ink: { DEFAULT,
 * light, lighter }, gray: { 50…950 }, … }`. Os tokens que não estão aqui
 * (transparent, current, as cores do shadcn) seguem vindo de `colors`.
 */
export function themeColors(group) {
  const pares = tokenPairs(group);
  const sw = SWITCH_VAR[group];
  const out = {};
  const expr = (token) => colorExpression(pares[token].light, pares[token].dark, sw);
  out.white = expr('white');
  out.black = expr('black');
  out.ink = { DEFAULT: expr('ink'), light: expr('ink-light'), lighter: expr('ink-lighter') };
  out.paper = { DEFAULT: expr('paper'), pure: expr('paper-pure'), dark: expr('paper-dark') };
  out.acid = { DEFAULT: expr('acid'), light: expr('acid-light'), dark: expr('acid-dark') };
  for (const family of [...NEUTRAL_FAMILIES, ...COLOR_FAMILIES]) {
    out[family] = {};
    for (const shade of SHADES) out[family][shade] = expr(`${family}-${shade}`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Superfícies: quem redefine o texto dos filhos                       */
/* ------------------------------------------------------------------ */

export const SURFACE = Object.freeze({ NEUTRAL: 'neutral', ON_COLOR: 'onColor' });

/**
 * O que uma classe `bg-<token>` é, para o texto dos filhos:
 *  - NEUTRAL: um cartão/fundo do modo em vigor (`--kf: var(--k)`);
 *  - ON_COLOR: uma superfície de cor que continua de cor no escuro — o texto
 *    desenhado para ela volta a valer (`--kf: 0`);
 *  - null: não mexe (transparente, tintas translúcidas…).
 *
 * @param {string} token ex.: 'white', 'ink', 'gray-100', 'green-600'
 */
export function surfaceKind(token) {
  if (['white', 'paper', 'paper-pure', 'paper-dark'].includes(token)) return SURFACE.NEUTRAL;
  if (['ink', 'ink-light', 'ink-lighter', 'black', 'acid', 'acid-light', 'acid-dark'].includes(token)) return SURFACE.ON_COLOR;
  const m = /^([a-z]+)-(\d+)$/.exec(token);
  if (!m) return null;
  const [, family, shade] = m;
  const n = Number(shade);
  if (NEUTRAL_FAMILIES.includes(family)) return n <= 400 ? SURFACE.NEUTRAL : SURFACE.ON_COLOR;
  if (COLOR_FAMILIES.includes(family)) return n <= 200 ? SURFACE.NEUTRAL : SURFACE.ON_COLOR;
  return null;
}

/**
 * Opacidade abaixo da qual a classe é uma TINTA (um véu sobre o que está
 * atrás), não uma superfície: `bg-white/10` num painel escuro, `bg-ink/5` num
 * hover. Tinta não redefine o texto dos filhos.
 */
export const TINT_ALPHA_MAX = 50;

/** O modificador do Tailwind ('10', '[.15]', null) em percentual 0–100. */
export function alphaPercent(modifier) {
  if (modifier == null || modifier === '') return 100;
  const s = String(modifier);
  const arb = /^\[(.+)\]$/.exec(s);
  const n = Number(arb ? arb[1] : s);
  if (!Number.isFinite(n)) return 100;
  return arb && n <= 1 ? n * 100 : n;
}

/* ------------------------------------------------------------------ */
/*  A base: interruptores, escopos, shadcn, sombras                     */
/* ------------------------------------------------------------------ */

/** '#rrggbb' → 'H S% L%' (o formato das variáveis do shadcn). */
export function hexToHslTriplet(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * As variáveis do shadcn (diálogos, menus, toasts, campos do V1) no escuro —
 * retunadas para a paleta ink/acid. O claro fica como está em `index.css`.
 */
export const SHADCN_DARK = Object.freeze({
  '--background': hexToHslTriplet(DARK.surface),
  '--foreground': hexToHslTriplet(DARK.text),
  '--card': hexToHslTriplet(DARK.surface),
  '--card-foreground': hexToHslTriplet(DARK.text),
  '--popover': hexToHslTriplet(DARK.raised),
  '--popover-foreground': hexToHslTriplet(DARK.text),
  '--primary': '155 72% 50%',
  '--primary-foreground': '205 52% 12%',
  '--secondary': hexToHslTriplet(DARK.raised2),
  '--secondary-foreground': hexToHslTriplet(DARK.text),
  '--muted': hexToHslTriplet(DARK.raised2),
  '--muted-foreground': hexToHslTriplet(DARK_NEUTRAL_FG[500]),
  '--accent': hexToHslTriplet(DARK.raised2),
  '--accent-foreground': hexToHslTriplet(DARK.text),
  '--destructive': '0 72% 51%',
  '--destructive-foreground': '0 0% 100%',
  '--border': hexToHslTriplet(DARK_NEUTRAL_LINE[200]),
  '--input': hexToHslTriplet(DARK_NEUTRAL_LINE[200]),
  '--ring': '155 72% 50%',
  '--sidebar-background': hexToHslTriplet(DARK.surface),
  '--sidebar-foreground': hexToHslTriplet(DARK.text),
  '--sidebar-primary': '155 72% 50%',
  '--sidebar-primary-foreground': '205 52% 12%',
  '--sidebar-accent': hexToHslTriplet(DARK.raised2),
  '--sidebar-accent-foreground': hexToHslTriplet(DARK.text),
  '--sidebar-border': hexToHslTriplet(DARK_NEUTRAL_LINE[200]),
  '--sidebar-ring': '155 72% 50%',
});

/** As variáveis do shadcn no CLARO — cópia exata do `:root` de `index.css`. */
export const SHADCN_LIGHT = Object.freeze({
  '--background': '48 45% 97%',
  '--foreground': '214 39% 16%',
  '--card': '0 0% 100%',
  '--card-foreground': '214 39% 16%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '214 39% 16%',
  '--primary': '161 78% 28%',
  '--primary-foreground': '54 100% 97%',
  '--secondary': '50 85% 91%',
  '--secondary-foreground': '191 52% 19%',
  '--muted': '154 24% 91%',
  '--muted-foreground': '214 18% 38%',
  '--accent': '152 59% 91%',
  '--accent-foreground': '164 78% 18%',
  '--destructive': '4 79% 57%',
  '--destructive-foreground': '0 0% 100%',
  '--border': '156 16% 82%',
  '--input': '156 16% 82%',
  '--ring': '161 78% 28%',
  '--sidebar-background': '205 52% 12%',
  '--sidebar-foreground': '148 36% 93%',
  '--sidebar-primary': '155 72% 50%',
  '--sidebar-primary-foreground': '205 52% 12%',
  '--sidebar-accent': '198 46% 18%',
  '--sidebar-accent-foreground': '152 36% 95%',
  '--sidebar-border': '194 33% 22%',
  '--sidebar-ring': '155 72% 50%',
});

/**
 * As sombras da marca: só a COR é variável (no escuro, mais funda — uma
 * sombra de 6% some no preto). A geometria fica no Tailwind, o que mantém o
 * `shadow-organic shadow-acid/20` (sombra recolorida) funcionando.
 */
export const SHADOW_GEOMETRY = Object.freeze({
  organic: '0 24px 48px -12px var(--sh-organic-cor)',
  'organic-sm': '0 12px 24px -8px var(--sh-organic-sm-cor)',
});
export const SHADOWS = Object.freeze({
  light: Object.freeze({
    '--sh-organic-cor': 'rgba(11, 15, 25, 0.06)',
    '--sh-organic-sm-cor': 'rgba(11, 15, 25, 0.04)',
  }),
  dark: Object.freeze({
    '--sh-organic-cor': 'rgba(0, 0, 0, 0.55)',
    '--sh-organic-sm-cor': 'rgba(0, 0, 0, 0.45)',
  }),
});

/** A cor do topo do navegador/app instalado em cada modo (meta theme-color). */
export const META_THEME_COLOR = Object.freeze({ light: '#065f46', dark: DARK.page });

/** O fundo do corpo (fora do V2: landing, login, páginas públicas) no escuro. */
export const DARK_BODY_BACKGROUND = [
  'radial-gradient(circle at top left, rgba(212, 248, 46, 0.07), transparent 30%)',
  'radial-gradient(circle at top right, rgba(56, 132, 255, 0.06), transparent 26%)',
  `linear-gradient(180deg, ${DARK.page}, #0A0F1A)`,
].join(', ');
