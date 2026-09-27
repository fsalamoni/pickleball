/**
 * O link de um AVISO — com a mesma régua da regra do Firestore (lógica pura).
 *
 * 🐞 O defeito que isto corrige: a regra de `notifications` só aceita caminho
 * interno SEM `#` (`isInternalLink` no `firestore.rules`). A campanha da arena
 * monta links como `/arenas/X#arena-reservar` para rolar até a seção certa —
 * ótimos para um clique na tela, recusados pela regra. E como `notifyUsers`
 * grava em LOTE e engole o erro (avisar nunca derruba o fluxo), um link desses
 * derrubava o lote inteiro em silêncio: a campanha registrava "enviada para 40
 * pessoas" e ninguém recebia nada.
 *
 * A saída não é afrouxar a regra — ela é a defesa, e a mesma régua vale para
 * qualquer conta que crie um aviso. É o cliente parar de pedir o que a regra
 * recusa:
 *
 *  1. link que a regra aceita → segue igual;
 *  2. link com `#secao` → a âncora vira PARÂMETRO (`?ancora=secao`), que a
 *     regra aceita; ao abrir, o layout devolve o `#secao` à URL
 *     (`hashDaAncora`) e a página rola como sempre rolou. Âncora estranha
 *     (fora de letras, números, `-` e `_`) só é descartada: a página certa
 *     abre, sem rolar;
 *  3. nada disso serve → o aviso vai sem link. Um aviso sem link ainda é
 *     lido; um lote recusado não chega a ninguém.
 *
 * ⚠️ O padrão abaixo é CÓPIA do `isInternalLink` do `firestore.rules`. Há teste
 * lendo o arquivo de regras e exigindo que os dois sejam idênticos: se a regra
 * mudar, este arquivo tem de mudar junto.
 */

/** O mesmo padrão de `isInternalLink` (firestore.rules). */
export const INTERNAL_LINK_PATTERN = '^/([A-Za-z0-9_?=&%.:-][A-Za-z0-9/_?=&%.:-]*)?$';

const PADRAO = new RegExp(INTERNAL_LINK_PATTERN);

/** O limite do serviço (a regra aceita até 600; o serviço corta em 400). */
export const NOTIFICATION_LINK_MAX = 400;

/** A regra aceitaria este link? */
export function isRuleSafeLink(link) {
  return typeof link === 'string' && link.length <= NOTIFICATION_LINK_MAX && PADRAO.test(link);
}

/**
 * O link que pode ir num aviso — ou `null` quando nenhum serve.
 * @param {unknown} link
 * @returns {string|null}
 */
export function linkDeAviso(link) {
  if (typeof link !== 'string') return null;
  const t = link.trim();
  if (!t) return null;
  if (isRuleSafeLink(t)) return t;
  const i = t.indexOf('#');
  const caminho = i >= 0 ? t.slice(0, i) : t;
  if (!caminho || !isRuleSafeLink(caminho)) return null;
  const ancora = i >= 0 ? t.slice(i + 1) : '';
  if (ANCORA_VALIDA.test(ancora)) {
    const comAncora = `${caminho}${caminho.includes('?') ? '&' : '?'}${ANCORA_PARAM}=${ancora}`;
    if (isRuleSafeLink(comAncora)) return comAncora;
  }
  return caminho;
}

/** O parâmetro que leva a âncora de um aviso (a regra não aceita `#`). */
export const ANCORA_PARAM = 'ancora';

/** Âncora que atravessa: os ids das seções (`arena-planos`, `professor-clinicas`). */
const ANCORA_VALIDA = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;

/**
 * O caminho de volta: a URL aberta a partir de um aviso traz `?ancora=secao`;
 * isto devolve a URL com o `#secao` no lugar do parâmetro — ou `null` quando
 * não há o que trocar. Quem aplica é o layout (`useAncoraDoAviso`).
 *
 * @param {{ pathname: string, search: string }} local
 * @returns {{ pathname: string, search: string, hash: string }|null}
 */
export function hashDaAncora({ pathname, search } = {}) {
  const params = new URLSearchParams(search || '');
  const ancora = params.get(ANCORA_PARAM);
  if (ancora == null) return null;
  params.delete(ANCORA_PARAM);
  const resto = params.toString();
  return {
    pathname: pathname || '/',
    search: resto ? `?${resto}` : '',
    hash: ANCORA_VALIDA.test(ancora) ? `#${ancora}` : '',
  };
}
