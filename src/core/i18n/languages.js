/**
 * REGISTRO ÚNICO de idiomas da plataforma.
 *
 * Incluir um idioma novo (ex.: francês) é:
 *  1. uma linha aqui;
 *  2. copiar cada `locales/en.js` (núcleo e módulos) para `locales/fr.js` e
 *     traduzir os valores — as CHAVES (o texto em português) não mudam;
 *  3. `npx vitest run src/core/i18n` lista o que ainda falta.
 *
 * `codigo` é o nome do arquivo do catálogo. pt-BR não tem catálogo: o texto
 * escrito no código É o português.
 */
export const IDIOMA_PADRAO = 'pt-BR';

export const IDIOMAS = Object.freeze([
  { codigo: 'pt-BR', locale: 'pt-BR', nome: 'Português (Brasil)', nomeNativo: 'Português', dir: 'ltr' },
  { codigo: 'en', locale: 'en-US', nome: 'English', nomeNativo: 'English', dir: 'ltr' },
  { codigo: 'es', locale: 'es-419', nome: 'Spanish', nomeNativo: 'Español', dir: 'ltr' },
]);

export const CODIGOS_DE_IDIOMA = Object.freeze(IDIOMAS.map((i) => i.codigo));

/** O idioma pelo código; desconhecido vira o padrão. */
export function idiomaPorCodigo(codigo) {
  return IDIOMAS.find((i) => i.codigo === codigo) || IDIOMAS[0];
}

/** Aceita 'en', 'en-GB', 'pt', 'pt-PT', 'es-MX'… e devolve um código suportado, ou null. */
export function idiomaSuportado(tag) {
  if (typeof tag !== 'string' || !tag) return null;
  const exato = IDIOMAS.find((i) => i.codigo.toLowerCase() === tag.toLowerCase());
  if (exato) return exato.codigo;
  const base = tag.toLowerCase().split('-')[0];
  if (base === 'pt') return IDIOMA_PADRAO;
  return IDIOMAS.find((i) => i.codigo.toLowerCase() === base)?.codigo || null;
}
