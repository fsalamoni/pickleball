/**
 * Preferência de "seção recolhida", por USUÁRIO, guardada no navegador.
 *
 * Serve às seções colapsáveis do dia de jogo: cada pessoa recolhe o que não
 * quer ver e, na próxima vez que abrir, encontra tudo do jeito que deixou.
 *
 * ## Por que por usuário
 *
 * O `localStorage` é por NAVEGADOR, não por conta. Num tablet de clube ou num
 * notebook compartilhado, duas pessoas usam o mesmo navegador — sem a chave
 * incluir o uid, uma herdaria a preferência da outra. Por isso a chave é
 * `v2:collapse:<uid>:<secao>`; quem não está autenticado usa o escopo `anon`.
 *
 * ## Por que não no Firestore
 *
 * É conveniência de interface, não dado do produto: não vale uma leitura de
 * banco a cada abertura de tela nem uma escrita a cada clique. Nada aqui toca
 * o Firestore.
 *
 * ## Nunca lança
 *
 * Modo privado, storage desabilitado por política ou cota estourada fazem o
 * `localStorage` LANÇAR — inclusive na simples leitura de `window.localStorage`.
 * Toda função aqui engole a exceção e devolve o neutro: a seção abre no padrão
 * e a tela continua funcionando.
 *
 * OBS.: `V2Surface collapsible` (em `v2/ui/primitives.jsx`) tem persistência
 * própria, mais antiga e sem escopo de usuário. Ela não foi migrada de
 * propósito: trocar o formato da chave apagaria, de uma vez, a preferência já
 * salva de todo mundo nas telas de torneio.
 */

const PREFIX = 'v2:collapse:';

/** Escopo de quem não está autenticado. */
export const ANON_SCOPE = 'anon';

/**
 * Chave de armazenamento de uma seção para um usuário.
 * @param {string|null|undefined} uid
 * @param {string} sectionId identificador ESTÁVEL da seção (ex.: 'gameday:games')
 * @returns {string|null} `null` quando não há seção — nada a guardar
 */
export function collapseStorageKey(uid, sectionId) {
  if (!sectionId || typeof sectionId !== 'string') return null;
  const scope = uid && typeof uid === 'string' ? uid : ANON_SCOPE;
  return `${PREFIX}${scope}:${sectionId}`;
}

/** Acesso defensivo ao localStorage: devolve `null` quando indisponível. */
function storage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch {
    return null;
  }
}

/**
 * Lê a preferência salva.
 * @returns {boolean|null} `true` recolhida, `false` aberta, `null` nunca salva
 *   (quem chama deve então usar o próprio padrão).
 */
export function readCollapsePreference(uid, sectionId) {
  const key = collapseStorageKey(uid, sectionId);
  if (!key) return null;
  const store = storage();
  if (!store) return null;
  try {
    const value = store.getItem(key);
    if (value === '1') return true;
    if (value === '0') return false;
    return null;
  } catch {
    return null;
  }
}

/**
 * Salva a preferência.
 * @returns {boolean} `true` se realmente gravou (útil em teste; a interface
 *   ignora o retorno — falhar em guardar nunca pode travar um clique).
 */
export function writeCollapsePreference(uid, sectionId, collapsed) {
  const key = collapseStorageKey(uid, sectionId);
  if (!key) return false;
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, collapsed ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}
