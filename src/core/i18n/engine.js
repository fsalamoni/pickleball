/**
 * O MOTOR de tradução: puro, sem React, sem Firebase.
 *
 * O texto em PORTUGUÊS é a chave: `t('Entrar num jogo')`. Sem catálogo (pt-BR,
 * ou texto ainda não traduzido) a própria chave é o resultado — o português
 * nunca quebra. Variáveis entre chaves: `t('Você tem {n} XP', { n })`.
 *
 * ⚠️ Não chame `t()` no NÍVEL DO MÓDULO (constante calculada ao importar): o
 * catálogo só chega depois dos imports. Use função ou chame dentro do render.
 */
import { IDIOMA_PADRAO, idiomaPorCodigo } from './languages.js';

let codigoAtivo = IDIOMA_PADRAO;
let catalogo = {};
let regrasDePlural = null;

/** Troca o idioma ativo e o catálogo (usado pelo carregador e pelos testes). */
export function definirIdioma(codigo, novoCatalogo = {}) {
  codigoAtivo = idiomaPorCodigo(codigo).codigo;
  catalogo = novoCatalogo || {};
  try {
    regrasDePlural = new Intl.PluralRules(idiomaPorCodigo(codigoAtivo).locale);
  } catch {
    regrasDePlural = null;
  }
}

export const idiomaAtivo = () => codigoAtivo;
/** O locale do `Intl` do idioma ativo (ex.: 'en-US'). */
export const localeAtivo = () => idiomaPorCodigo(codigoAtivo).locale;

function interpolar(texto, params) {
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome) => (params[nome] === undefined ? inteiro : String(params[nome])));
}

/** Traduz. `chave` é o texto em português. */
export function t(chave, params) {
  const valor = catalogo[chave];
  return interpolar(typeof valor === 'string' ? valor : chave, params);
}

/**
 * MARCA uma chave sem traduzir: para textos guardados em constantes do nível
 * do módulo (listas de rótulos, opções). A tela traduz ao desenhar:
 *   const OPCOES = [{ rotulo: tk('Duplas') }];  …  {t(op.rotulo)}
 * Assim a guarda de catálogos enxerga a chave.
 */
export const tk = (chave) => chave;

/**
 * Plural. `singular` e `plural` são os textos em português; o catálogo guarda
 * `[forma_singular, forma_plural]` na chave do PLURAL. `{n}` entra sozinho.
 *   tn(n, '{n} jogo', '{n} jogos')
 */
export function tn(n, singular, plural, params) {
  const valor = catalogo[plural];
  let texto;
  if (Array.isArray(valor)) {
    const um = regrasDePlural ? regrasDePlural.select(n) === 'one' : n === 1;
    texto = um ? valor[0] : valor[1];
  } else {
    texto = n === 1 ? singular : plural;
  }
  return interpolar(texto, { n, ...params });
}
