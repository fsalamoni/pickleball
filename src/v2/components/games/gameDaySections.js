/**
 * Identificadores das seções colapsáveis do dia de jogo.
 *
 * São a CHAVE da preferência de recolhido/aberto de cada pessoa
 * (`core/lib/collapsePreference`), então precisam ser estáveis: mudar um valor
 * daqui faz todo mundo perder o que tinha guardado para aquela seção.
 *
 * De propósito NÃO carregam o id do dia de jogo: a preferência é do TIPO de
 * seção. Quem recolhe "Participantes" quer encontrá-lo recolhido no próximo dia
 * de jogo também, e não recolher de novo a cada dia.
 */
export const GAME_DAY_SECTION = Object.freeze({
  /* Dia de jogo do atleta — grade (Americano, Mexicano, Rei da Quadra) */
  PARTICIPANTS: 'gameday:participants',
  GAMES: 'gameday:games',
  DAILY_RANKING: 'gameday:daily-ranking',
  PLATFORM_RANKING: 'gameday:platform-ranking',
  ADMINS: 'gameday:admins',

  /* Dia de jogo do atleta — formato Play (open play) */
  PLAY_PARTICIPANTS: 'gameday:play:participants',
  PLAY_COURTS: 'gameday:play:courts',
  PLAY_ORDER: 'gameday:play:order',
  PLAY_ME: 'gameday:play:me',

  /* Dia de jogo do atleta — AMERICANO APRIMORADO (partida a partida, com placar) */
  AL_PARTICIPANTS: 'gameday:al:participants',
  AL_COURTS: 'gameday:al:courts',
  AL_ORDER: 'gameday:al:order',
  AL_COMPLETED: 'gameday:al:completed',
  AL_PROGRESS: 'gameday:al:progress',

  /* Dia de jogo do clube (data de evento) */
  CLUB_PARTICIPANTS: 'club-gameday:participants',
  CLUB_GAMES: 'club-gameday:games',
  CLUB_DAILY_RANKING: 'club-gameday:daily-ranking',
});
