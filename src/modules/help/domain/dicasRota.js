/**
 * Em que tela a pessoa está? — o casamento de ROTA das dicas.
 *
 * Um guia diz em que tela cada passo acontece, e um ponto de dica diz em que
 * tela ele aparece. Os dois usam o mesmo molde, com duas regras e nada mais:
 *
 *  - `*` vale por UM segmento: `/arenas/*` casa `/arenas/abc`, não `/arenas`
 *    nem `/arenas/abc/gerir`;
 *  - `**` no FIM vale pelo resto (inclusive nada): `/torneios/**` casa
 *    `/torneios`, `/torneios/abc` e `/torneios/abc/gerenciar`.
 *
 * Sem curinga, o molde é EXATO — `/` é só a tela inicial. (A central de ajuda
 * tem o seu próprio casamento, por prefixo, porque lá a pergunta é outra:
 * "de que ASSUNTO a pessoa veio?". Aqui a pergunta é "o botão X está NESTA
 * tela?", e prefixo diria que sim para telas em que ele não existe.)
 *
 * Consulta (`?aba=…`) e âncora (`#…`) não fazem parte do caminho.
 */

/** O caminho sem consulta, sem âncora e sem barra no fim. */
export function caminhoLimpo(caminho) {
  const p = String(caminho || '').split(/[?#]/)[0].replace(/\/+$/, '');
  return p || '/';
}

/**
 * O caminho casa com o molde?
 * @param {string} molde ex.: '/dia-de-jogo', '/arenas/*', '/torneios/**'
 * @param {string} caminho ex.: location.pathname
 */
export function casaRota(molde, caminho) {
  if (typeof molde !== 'string' || !molde.startsWith('/')) return false;
  const alvo = caminhoLimpo(caminho).split('/').filter(Boolean);
  const partes = caminhoLimpo(molde).split('/').filter(Boolean);
  const resto = partes[partes.length - 1] === '**';
  const fixas = resto ? partes.slice(0, -1) : partes;
  if (resto ? alvo.length < fixas.length : alvo.length !== fixas.length) return false;
  return fixas.every((seg, i) => seg === '*' || seg === alvo[i]);
}

/** Casa com ALGUM dos moldes? Lista vazia ou ausente não casa com nada. */
export function casaAlgumaRota(moldes, caminho) {
  const lista = Array.isArray(moldes) ? moldes : (moldes ? [moldes] : []);
  return lista.some((m) => casaRota(m, caminho));
}

/**
 * O molde vira um caminho de verdade? Só quando não tem curinga — é o que
 * permite ao guia LEVAR a pessoa até a tela (`/dia-de-jogo` sim, `/arenas/*`
 * não: qual arena?).
 */
export function moldeNavegavel(molde) {
  return typeof molde === 'string' && molde.startsWith('/') && !molde.includes('*');
}
