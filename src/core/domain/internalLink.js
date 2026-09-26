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
 *  2. link com `#` (ou outra sobra) → vai SEM o fragmento: a página certa abre,
 *     só não rola até a seção;
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
  const semFragmento = t.split('#')[0];
  if (semFragmento && isRuleSafeLink(semFragmento)) return semFragmento;
  return null;
}
