/**
 * Preferência de VISUALIZAÇÃO, por usuário, guardada no navegador.
 *
 * Irmã de `collapsePreference.js`, para as escolhas que não são booleanas:
 * quantos itens por página, qual recorte, qual ordenação — coisas que a pessoa
 * ajusta uma vez e espera encontrar do mesmo jeito na próxima visita.
 *
 * ## Por que por usuário
 *
 * O `localStorage` é por NAVEGADOR, não por conta. Num tablet de clube ou num
 * notebook compartilhado, duas pessoas usam o mesmo navegador — sem o uid na
 * chave, uma herdaria a preferência da outra. Quem não está autenticado usa o
 * escopo `anon`.
 *
 * ## Por que não no Firestore
 *
 * É conveniência de interface, não dado do produto. Não vale uma leitura de
 * banco a cada abertura de tela nem uma escrita a cada clique — e não há por
 * que uma escolha de visualização tocar o banco. **Nada aqui escreve no
 * Firestore.**
 *
 * ## Nunca lança
 *
 * Modo privado, storage bloqueado por política ou cota estourada fazem o
 * `localStorage` LANÇAR — inclusive na simples leitura de
 * `window.localStorage`. Toda função engole a exceção e devolve o neutro: a
 * tela abre no padrão e continua funcionando.
 */

const PREFIX = 'v2:view:';

/** Escopo de quem não está autenticado. */
export const ANON_SCOPE = 'anon';

/**
 * Chave de armazenamento de uma preferência para um usuário.
 * @param {string|null|undefined} uid
 * @param {string} prefId identificador ESTÁVEL da preferência
 *   (ex.: 'ranking:duplas:min-jogos'). Mudar o id apaga, de uma vez, a escolha
 *   já salva de todo mundo — trate como contrato.
 * @returns {string|null} `null` quando não há id — nada a guardar
 */
export function viewPreferenceKey(uid, prefId) {
  if (!prefId || typeof prefId !== 'string') return null;
  const scope = uid && typeof uid === 'string' ? uid : ANON_SCOPE;
  return `${PREFIX}${scope}:${prefId}`;
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
 * Lê a preferência salva, como texto.
 * @returns {string|null} `null` quando nunca foi salva (quem chama usa o
 *   próprio padrão) ou quando o storage não está disponível.
 */
export function readViewPreference(uid, prefId) {
  const key = viewPreferenceKey(uid, prefId);
  if (!key) return null;
  const store = storage();
  if (!store) return null;
  try {
    const value = store.getItem(key);
    return value === null || value === '' ? null : value;
  } catch {
    return null;
  }
}

/**
 * Salva a preferência. Valor `null`/vazio APAGA a escolha (volta ao padrão) —
 * assim "voltar ao padrão" não fica gravado como se fosse uma escolha.
 * @returns {boolean} `true` se realmente gravou. A interface ignora o retorno:
 *   falhar em guardar nunca pode travar um clique.
 */
export function writeViewPreference(uid, prefId, value) {
  const key = viewPreferenceKey(uid, prefId);
  if (!key) return false;
  const store = storage();
  if (!store) return false;
  try {
    if (value === null || value === undefined || value === '') store.removeItem(key);
    else store.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lê uma preferência NUMÉRICA já validada contra os valores permitidos.
 *
 * Existe porque todo chamador faria a mesma coisa: ler texto, converter,
 * conferir se é um dos valores oferecidos e cair no padrão quando não é. Uma
 * preferência antiga de uma versão que oferecia outras opções não pode
 * ressuscitar como um valor que a tela não sabe mais desenhar.
 *
 * @param {string|null|undefined} uid
 * @param {string} prefId
 * @param {number[]} allowed valores oferecidos hoje
 * @param {number} fallback padrão quando não há escolha válida
 * @returns {number}
 */
export function readNumericPreference(uid, prefId, allowed, fallback) {
  const raw = readViewPreference(uid, prefId);
  const n = Math.trunc(Number(raw));
  return Array.isArray(allowed) && allowed.includes(n) ? n : fallback;
}
