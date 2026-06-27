/**
 * Catálogo de feature flags da plataforma.
 *
 * As flags são guardadas em um único documento do Firestore
 * (`platform_settings/global`, campo `feature_flags`) e podem ser ligadas/
 * desligadas em tempo de execução pelo admin master na página de Métricas.
 *
 * TODAS as flags nascem DESLIGADAS (`false`). Enquanto uma flag está desligada
 * a funcionalidade associada fica completamente invisível e inerte — nada do
 * comportamento já existente é alterado. Isso garante que estas implementações
 * sejam puramente aditivas.
 */

export const FEATURE_FLAG = Object.freeze({
  /**
   * Torneios em múltiplas fases: permite ao admin do torneio configurar uma
   * modalidade com várias fases encadeadas (grupos/americano/mata-mata/etc.),
   * com divisão em grupos equilibrados, qualificação de classificados e
   * progressão automática entre as fases. Inscrição segue em lista única.
   */
  MULTI_PHASE_TOURNAMENTS: 'multi_phase_tournaments',

  /**
   * Cards de compartilhamento (UGC): habilita o botão "Compartilhar" que gera
   * um card visual do torneio (com QR Code e link público) pronto para
   * WhatsApp/Stories, além do compartilhamento por link pré-preenchido. É
   * puramente aditivo — desligado, o botão some e nada muda no fluxo atual.
   */
  SHARE_CARDS: 'share_cards',

  /**
   * Página "Meu Desempenho": painel pessoal do atleta com torneios disputados,
   * vitórias/derrotas, aproveitamento, pódios e títulos, consolidados a partir
   * dos jogos já registrados. Aditivo — desligado, a rota e o menu somem.
   */
  PLAYER_PERFORMANCE: 'player_performance',

  /**
   * Diretório de treinadores: permite ao atleta se declarar treinador (bio,
   * valor e regiões de atuação) e ser encontrado no diretório por um filtro
   * dedicado, com contato pelo chat existente. Aditivo — desligado, a seção do
   * perfil e o filtro/badge do diretório ficam ocultos.
   */
  COACH_DIRECTORY: 'coach_directory',

  /**
   * Rating ELO próprio + Ranking nacional: calcula um rating por jogador a
   * partir dos jogos finalizados e exibe um ranking público (filtrável por
   * cidade/estado/nível). O recálculo é acionado pelo admin master. Aditivo —
   * desligado, a rota /ranking, o menu e o botão de recálculo ficam ocultos.
   */
  PLAYER_RATING: 'player_rating',

  /**
   * Matchmaking por nível: página "Encontrar jogadores" que sugere parceiros e
   * adversários com rating próximo (e, opcionalmente, da mesma cidade), com
   * atalho para conversar. Depende de `player_rating` (usa o rating calculado).
   * Aditivo — desligado, a rota e o item de menu ficam ocultos.
   */
  MATCHMAKING: 'matchmaking',
});

/** Metadados de exibição para o painel de flags (admin master). */
export const FEATURE_FLAG_META = Object.freeze({
  [FEATURE_FLAG.MULTI_PHASE_TOURNAMENTS]: {
    label: 'Torneios em múltiplas fases',
    description:
      'Habilita a configuração de modalidades com várias fases encadeadas '
      + '(grupos, americano, mata-mata, dupla eliminação, suíço), com divisão '
      + 'em grupos equilibrados por gênero e nível, sorteio ou seleção manual, '
      + 'qualificação de classificados e progressão automática entre fases. '
      + 'A inscrição continua em lista única por modalidade.',
  },
  [FEATURE_FLAG.SHARE_CARDS]: {
    label: 'Cards de compartilhamento (UGC)',
    description:
      'Habilita o botão "Compartilhar" na página pública do torneio, que gera '
      + 'um card visual com QR Code e link, otimizado para WhatsApp e Stories, '
      + 'e o compartilhamento por link/texto pré-preenchido. Ajuda na divulgação '
      + 'e aquisição orgânica. Desligado, o botão fica oculto e nada muda.',
  },
  [FEATURE_FLAG.PLAYER_PERFORMANCE]: {
    label: 'Meu Desempenho (estatísticas do atleta)',
    description:
      'Habilita a página pessoal "Meu Desempenho" com torneios disputados, '
      + 'vitórias/derrotas, aproveitamento, pódios e títulos por formato, '
      + 'consolidados dos jogos já registrados. Estimula a retenção e prepara '
      + 'recursos premium. Desligado, a rota e o item de menu ficam ocultos.',
  },
  [FEATURE_FLAG.COACH_DIRECTORY]: {
    label: 'Diretório de treinadores',
    description:
      'Permite que atletas se declarem treinadores (bio, valor e regiões de '
      + 'atuação) no perfil e sejam encontrados por um filtro dedicado no '
      + 'diretório de atletas, com contato pelo chat. Abre espaço para um novo '
      + 'público e parcerias. Desligado, a seção e o filtro ficam ocultos.',
  },
  [FEATURE_FLAG.PLAYER_RATING]: {
    label: 'Rating ELO + Ranking nacional',
    description:
      'Calcula um rating ELO por jogador a partir dos jogos finalizados e '
      + 'publica um ranking nacional (filtrável por cidade/estado/nível). O '
      + 'recálculo é feito sob demanda pelo admin na própria página de Métricas. '
      + 'Cria autoridade de marca e engajamento. Desligado, a rota /ranking, o '
      + 'item de menu e o botão de recálculo ficam ocultos.',
  },
  [FEATURE_FLAG.MATCHMAKING]: {
    label: 'Matchmaking por nível',
    description:
      'Página "Encontrar jogadores" que sugere parceiros e adversários com '
      + 'rating próximo (opcionalmente da mesma cidade), com atalho para o chat. '
      + 'Requer o "Rating ELO" ativado. Desligado, a rota e o menu ficam ocultos.',
  },
});

/** Valor padrão (todas as flags desligadas). */
export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(Object.values(FEATURE_FLAG).map((key) => [key, false])),
);

/**
 * Normaliza um mapa de flags vindo do Firestore, garantindo booleanos e
 * preenchendo as ausentes com `false`. Ignora chaves desconhecidas.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, boolean>}
 */
export function normalizeFeatureFlags(raw) {
  const out = { ...DEFAULT_FEATURE_FLAGS };
  if (raw && typeof raw === 'object') {
    Object.values(FEATURE_FLAG).forEach((key) => {
      if (typeof raw[key] === 'boolean') out[key] = raw[key];
    });
  }
  return out;
}
