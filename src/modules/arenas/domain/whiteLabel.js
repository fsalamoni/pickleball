/**
 * A marca da arena — cor, logo e assinatura.
 *
 * PURO, sem I/O.
 *
 * ## 🐞 A marca era gravada onde o atleta não pode ler
 *
 * `updateBranding` escrevia em `arena_settings.branding`, e a regra daquela
 * coleção é:
 *
 * ```
 * match /arena_settings/{arenaId} {
 *   allow read: if isAuthed() && (isArenaManager(arenaId) || isPlatformAdmin());
 * ```
 *
 * Ou seja: **só o gestor consegue ler**. A cor e o logo da arena nunca teriam
 * como chegar à página pública nem ao telão, por mais que alguém escrevesse o
 * código para exibi-los — e ninguém tinha escrito, então o campo era gravado e
 * nunca lido por nada.
 *
 * A marca agora mora em `arenas/{id}.branding`, campo opcional do documento da
 * arena, que é `allow read: if true`. O que é público tem de estar onde o
 * público lê.
 *
 * ## Contraste não é detalhe
 *
 * Uma arena escolhe amarelo-limão como cor da marca e o texto branco por cima
 * some. `readableInk` decide preto ou branco pela luminância relativa (a mesma
 * conta da WCAG), então a tela continua legível com qualquer cor que a arena
 * escolher — inclusive as que ela escolher errado.
 */

/** A cor da plataforma, quando a arena não escolheu nenhuma. */
export const BRAND_DEFAULT_COLOR = '#0B0B0C';

export const BRAND_TAGLINE_MAX = 60;

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** '#abc' → '#aabbcc'. Devolve `null` para o que não é cor. */
export function normalizeHex(value) {
  const v = String(value || '').trim();
  if (!HEX.test(v)) return null;
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  return v.toLowerCase();
}

/** Componente sRGB linearizado, como manda a fórmula de luminância da WCAG. */
function canal(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * A luminância relativa de uma cor (0 = preto, 1 = branco).
 * @param {string} hex
 * @returns {number}
 */
export function luminance(hex) {
  const h = normalizeHex(hex);
  if (!h) return 0;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/**
 * Que cor de texto fica legível em cima desta.
 *
 * O corte em 0.5 de luminância é o padrão prático: acima disso a cor é clara e
 * pede texto escuro. Sem isto, uma arena de cor clara teria o próprio nome
 * invisível na própria página.
 *
 * @param {string} hex
 * @returns {'#0B0B0C'|'#FFFFFF'}
 */
export function readableInk(hex) {
  return luminance(hex) > 0.5 ? '#0B0B0C' : '#FFFFFF';
}

/**
 * A marca normalizada.
 *
 * Cor inválida vira a cor da plataforma em vez de quebrar a tela — uma arena
 * que digita "azul" no lugar de um hex não pode ficar com a página sem cor
 * nenhuma.
 *
 * @param {object} input
 * @returns {{ valid: boolean, errors: object, value: object }}
 */
export function normalizeBranding(input = {}) {
  const errors = {};
  const cor = normalizeHex(input.primary_color);
  if (input.primary_color && !cor) errors.primary_color = 'Use uma cor em hexadecimal, como #1D4ED8.';

  const logo = String(input.logo_url || '').trim().slice(0, 500);
  if (logo && !/^https?:\/\//i.test(logo)) errors.logo_url = 'O endereço do logo precisa começar com https://';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      primary_color: cor || BRAND_DEFAULT_COLOR,
      logo_url: errors.logo_url ? '' : logo,
      tagline: String(input.tagline || '').trim().slice(0, BRAND_TAGLINE_MAX),
      /** Ligado é o padrão: quem preencheu a marca quer vê-la. */
      active: input.active !== false,
    },
  };
}

/**
 * A marca que uma tela deve usar.
 *
 * Aceita a arena inteira e devolve sempre um objeto utilizável — a tela nunca
 * precisa perguntar se existe. `on` diz se há marca própria, para a tela poder
 * escolher entre pintar e não pintar.
 *
 * @param {object|null} arena
 * @returns {{ on: boolean, color: string, ink: string, logo: string, tagline: string }}
 */
export function brandingOf(arena) {
  const b = arena?.branding;
  const cor = normalizeHex(b?.primary_color);
  const ligado = Boolean(b) && b.active !== false && Boolean(cor || b.logo_url);
  const color = cor || BRAND_DEFAULT_COLOR;
  return {
    on: ligado,
    color,
    ink: readableInk(color),
    logo: String(b?.logo_url || ''),
    tagline: String(b?.tagline || ''),
  };
}
