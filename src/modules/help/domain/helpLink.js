/**
 * O endereço da central de ajuda A PARTIR de uma tela.
 *
 * Mora sozinho, longe do conteúdo, de propósito: quem chama isto é o layout —
 * presente em TODA tela — e `helpCenter.js` carrega 33 artigos de texto. Um
 * `import` do layout para lá arrastaria o manual inteiro para dentro do chunk
 * que todo mundo baixa, para usar uma função de três linhas. O conteúdo deve
 * continuar chegando só para quem abre `/ajuda`.
 *
 * (O `helpCenter.js` reexporta esta função, para quem já a importa de lá.)
 */

/**
 * @param {string} pathname caminho atual (`location.pathname`)
 * @returns {string} `/ajuda?de=<rota>`, ou `/ajuda` quando não há de onde vir
 *   (ou já se está nela). Quem lê do outro lado é `helpForRoute`.
 */
export function helpLinkFor(pathname) {
  const p = String(pathname || '');
  // Só caminho interno de UMA barra: `//host` é endereço de outro site, e o
  // valor volta pela URL — nada que venha de fora merece o benefício da
  // dúvida, mesmo que do outro lado só se compare contra uma tabela fixa.
  if (!p.startsWith('/') || p.startsWith('//')) return '/ajuda';
  if (p === '/ajuda' || p.startsWith('/ajuda/')) return '/ajuda';
  return `/ajuda?de=${encodeURIComponent(p)}`;
}
