/**
 * Vocabulário da navegação (plano de UX §5.1).
 *
 * Os nomes antigos descreviam a TELA ("Procura-se jogo", "Encontrar
 * jogadores"); os atuais dizem o que a pessoa procura (Vagas, Pessoas). A tela
 * interna do Dia de jogo continua se chamando "Dia de jogo" — é o nome do
 * OBJETO; "Hoje" é só o rótulo da aba do Jogar.
 *
 * Fonte ÚNICA: menu, títulos, atalhos do início e Minha área leem daqui.
 * Nasceu atrás da flag `nav_v3`; ligada para todos em 2026-10-11, virou código.
 */
export const NAV_ROTULOS = Object.freeze({
  abaDiaDeJogo: 'Hoje',
  vagas: 'Vagas',
  pessoas: 'Pessoas',
  meusTorneios: 'Meus torneios',
  gamificacao: 'Temporada e desafios',
  reservar: 'Reservar quadra',
});

/** @returns {typeof NAV_ROTULOS} */
export function navRotulos() {
  return NAV_ROTULOS;
}
