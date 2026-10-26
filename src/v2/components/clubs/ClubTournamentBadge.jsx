/**
 * O selo "Realizado pelo {clube}" no torneio feito em nome de um clube (Bloco E3b). Lê só os campos
 * gravados no torneio (`club_id`, `club_name`) — nenhuma consulta, nenhuma flag: é um fato do
 * torneio. Sem `club_id`, não renderiza.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { V2Badge } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function ClubTournamentBadge({ tournament, link = true }) {
  // Sem importar o domínio do clube: o selo vive nas listas de torneio e não deve pesá-las.
  if (typeof tournament?.club_id !== 'string' || !tournament.club_id) return null;
  const nome = tournament.club_name || t('clube');
  const selo = <V2Badge tone="blue"><Users className="h-3 w-3" aria-hidden="true" /> {t('Realizado pelo {clube}', { clube: nome })}</V2Badge>;
  return link
    ? <Link to={`/clubes/${tournament.club_id}`} title={t('Ver o clube {clube}', { clube: nome })}>{selo}</Link>
    : selo;
}
