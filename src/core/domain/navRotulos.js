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
import { t, tk } from '@/core/i18n';
export const NAV_ROTULOS = Object.freeze({
  abaDiaDeJogo: tk('Hoje'),
  vagas: tk('Vagas'),
  pessoas: tk('Pessoas'),
  meusTorneios: tk('Meus torneios'),
  gamificacao: tk('Temporada e desafios'),
  reservar: tk('Reservar quadra'),
});

/** @returns {typeof NAV_ROTULOS} */
export function navRotulos() {
  return Object.fromEntries(Object.entries(NAV_ROTULOS).map(([k, v]) => [k, t(v)]));
}
