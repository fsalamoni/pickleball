/**
 * Vocabulário da navegação (plano de UX §5.1), atrás da flag `nav_v3`.
 *
 * Os nomes antigos descreviam a TELA ("Procura-se jogo", "Encontrar
 * jogadores"); os novos dizem o que a pessoa procura (Vagas, Pessoas). A tela
 * interna do Dia de jogo continua se chamando "Dia de jogo" — é o nome do
 * OBJETO; "Hoje" é só o rótulo da aba do Jogar.
 *
 * Fonte ÚNICA: menu, títulos, atalhos do início e Minha área leem daqui. Com a
 * flag desligada, os rótulos são os de sempre, caractere a caractere.
 */
export const ROTULOS_ANTIGOS = Object.freeze({
  abaDiaDeJogo: 'Dia de jogo',
  vagas: 'Procura-se jogo',
  pessoas: 'Encontrar jogadores',
  meusTorneios: 'Torneios que organizo',
  gamificacao: 'Gamificação',
  reservar: 'Explorar quadras',
});

export const ROTULOS_V3 = Object.freeze({
  abaDiaDeJogo: 'Hoje',
  vagas: 'Vagas',
  pessoas: 'Pessoas',
  meusTorneios: 'Meus torneios',
  gamificacao: 'Temporada e desafios',
  reservar: 'Reservar quadra',
});

/** @param {boolean} navV3 @returns {typeof ROTULOS_ANTIGOS} */
export function navRotulos(navV3) {
  return navV3 ? ROTULOS_V3 : ROTULOS_ANTIGOS;
}
