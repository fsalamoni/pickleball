/**
 * Carga SOB DEMANDA dos catálogos: só do idioma ativo. Quem usa pt-BR não
 * baixa nada. Os catálogos moram ao lado do código, por módulo:
 * `src/<área>/i18n/locales/<codigo>.js` (export default { "texto pt": "text" }).
 */
import { IDIOMA_PADRAO, idiomaSuportado } from './languages.js';
import { definirIdioma } from './engine.js';

export const CHAVE_DO_IDIOMA = 'picklerush:idioma';

// Só os caminhos; o conteúdo é importado quando o idioma é escolhido.
const ARQUIVOS = import.meta.glob('/src/**/i18n/locales/*.js');

export function lerEscolha() {
  try {
    return idiomaSuportado(window.localStorage.getItem(CHAVE_DO_IDIOMA));
  } catch {
    return null;
  }
}

export function gravarEscolha(codigo) {
  try {
    if (codigo === IDIOMA_PADRAO) window.localStorage.removeItem(CHAVE_DO_IDIOMA);
    else window.localStorage.setItem(CHAVE_DO_IDIOMA, codigo);
  } catch { /* storage bloqueado: vale só nesta visita */ }
}

/** O idioma do navegador, se for um dos nossos (senão null). */
export function idiomaDoNavegador() {
  try {
    const lista = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of lista) {
      const c = idiomaSuportado(tag);
      if (c) return c;
    }
  } catch { /* sem navigator */ }
  return null;
}

/** Os caminhos dos catálogos de um idioma. */
export const arquivosDoIdioma = (codigo) => (
  Object.keys(ARQUIVOS).filter((p) => p.endsWith(`/i18n/locales/${codigo}.js`))
);

/** Carrega e ativa o idioma. Falhou? Fica no português — nunca derruba o app. */
export async function carregarIdioma(codigo) {
  const alvo = idiomaSuportado(codigo) || IDIOMA_PADRAO;
  if (alvo === IDIOMA_PADRAO) {
    definirIdioma(IDIOMA_PADRAO, {});
    aplicarNoDocumento(IDIOMA_PADRAO);
    return IDIOMA_PADRAO;
  }
  try {
    const modulos = await Promise.all(arquivosDoIdioma(alvo).map((p) => ARQUIVOS[p]()));
    definirIdioma(alvo, Object.assign({}, ...modulos.map((m) => m.default)));
    aplicarNoDocumento(alvo);
    return alvo;
  } catch {
    definirIdioma(IDIOMA_PADRAO, {});
    aplicarNoDocumento(IDIOMA_PADRAO);
    return IDIOMA_PADRAO;
  }
}

function aplicarNoDocumento(codigo) {
  try {
    document.documentElement.lang = codigo;
  } catch { /* sem document */ }
}

/** Boot: carrega o idioma escolhido antes de montar o React. */
export const iniciarIdiomas = () => carregarIdioma(lerEscolha() || IDIOMA_PADRAO);
