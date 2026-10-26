/**
 * TORNEIOS DO CLUBE (Bloco E3b) — lógica pura.
 *
 * O torneio do clube é o torneio da plataforma, com as mesmas regras, marcado com dois campos
 * opcionais: `club_id` (o que a regra confere) e `club_name` (cópia para exibir sem ler o clube).
 * Quem pode marcar: a administração do clube e a diretoria esportiva (`sports`), com a flag
 * `club_association` ligada — a mesma conta que `tournamentClubOk()` faz em `firestore.rules`.
 * Não há chancela, ranking oficial nem coleção nova: isso é da federação.
 */
import { CLUB_PERM } from './association.js';
import { discoverTournaments } from '@/modules/tournament/domain/tournamentDiscovery';
import { t } from '@/core/i18n';

/** Os campos que o torneio recebe ao ser criado em nome do clube. */
export function clubTournamentFields(club) {
  if (!club?.id) return {};
  return { club_id: club.id, club_name: String(club.name || '').trim().slice(0, 120) };
}

/** O torneio é do clube? (lê só os campos gravados, sem consulta). */
export const isClubTournament = (tournament) => typeof tournament?.club_id === 'string' && tournament.club_id !== '';

/** A pessoa pode criar torneio em nome do clube? */
export function canRunClubTournament(perms = []) {
  return perms.includes(CLUB_PERM.ADMIN) || perms.includes(CLUB_PERM.SPORTS);
}

/**
 * Por que o torneio NÃO sai em nome do clube agora (ou `''`). Nunca bloqueia a criação: o torneio
 * sai comum e a tela diz o motivo, como na federação.
 */
export function clubTournamentBlock({ flagOn, club, perms }) {
  if (!flagOn) return t('O clube ainda não usa a associação. O torneio será criado como um torneio comum.');
  if (!club) return t('Clube não encontrado. O torneio será criado como um torneio comum.');
  if (!canRunClubTournament(perms)) return t('Só a administração e a diretoria esportiva criam torneios em nome do clube. O torneio será criado como um torneio comum.');
  return '';
}

/** Os torneios do clube prontos para a tela: sem arquivados, e atuais × encerrados (a régua da lista de torneios). */
export function groupClubTournaments(lista = [], hoje, { somentePublicos = false } = {}) {
  const base = (lista || []).filter((x) => x && x.archived !== true && (!somentePublicos || x.visibility === 'public'));
  const { atuais, encerrados, rascunhos } = discoverTournaments(base, hoje);
  // Para a diretoria o rascunho é trabalho (aparece); para o público não é vitrine.
  return { atuais, encerrados, rascunhos: somentePublicos ? [] : rascunhos };
}
