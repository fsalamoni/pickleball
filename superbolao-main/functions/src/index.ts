/**
 * Entry point das Cloud Functions do Bolão Copa 2026.
 *
 * Funções:
 *   - seedTournament (callable, admin) → popula coleções estáticas (teams, groups, stages, matches, tiers)
 *   - processMatchScoring (Firestore trigger) → recalcula pontos quando match.status vira 'finished'
 *   - processPoolMatchScoring (Firestore trigger) → recalcula pontos de jogos livres por bolão
 *   - revealBetsForStage (scheduled) → libera palpites para visualização ao bater bet_lock_at
 *   - notifyPendingBets (scheduled) → alerta D-1 aos usuários sem palpite completo
 *   - setSpecialBetResults (callable, admin) → registra Campeão e Artilheiro ao fim do torneio
 *   - syncFifaResults (callable, admin) → sincroniza placares finais da API pública da FIFA
 *   - importOfficialCompetitionToPool (callable, pool admin) → importa calendário e resultados oficiais para bolões livres
 */

import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();

setGlobalOptions({
  region: 'southamerica-east1',
  serviceAccount: 'firebase-adminsdk-fbsvc@hocapp-44760.iam.gserviceaccount.com',
});

export { seedTournament } from './seedTournament';
export { processMatchScoring } from './processMatchScoring';
export { processPoolMatchScoring } from './processPoolMatchScoring';
export { revealBetsForStage } from './revealBetsForStage';
export { notifyPendingBets } from './notifyPendingBets';
export { setSpecialBetResults } from './setSpecialBetResults';
export { syncFifaResults } from './syncFifaResults';
export { importOfficialCompetitionToPool } from './importOfficialCompetitionToPool';
