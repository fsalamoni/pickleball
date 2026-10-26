/**
 * "Torneio do clube" na criação do torneio (`/torneios/criar?clube=`). Quem administra o clube ou
 * está na diretoria esportiva cria o torneio em nome dele e ele sai com o selo "Realizado pelo
 * {clube}". Sem permissão, sem a associação ou clube que não carregou, a tela DIZ por quê e o
 * torneio é criado como um torneio comum (`onChange(null)`) — nunca falha calada.
 */
import React, { useEffect } from 'react';
import { Users } from 'lucide-react';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { useClub } from '@/modules/clubs/hooks/useClubs';
import { useMyClubRole } from '@/modules/clubs/hooks/useClubAssociation';
import { clubTournamentBlock, clubTournamentFields } from '@/modules/clubs/domain/clubTournaments';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function ClubTournamentOrigin({ clubId, onChange }) {
  const flagOn = useFeatureFlag(FEATURE_FLAG.CLUB_ASSOCIATION);
  const q = useClub(flagOn ? clubId : null);
  const papel = useMyClubRole(flagOn ? clubId : null);
  const club = q.data || null;
  const pronto = Boolean(flagOn && club && !papel.isLoading && !papel.isError && !clubTournamentBlock({ flagOn, club, perms: papel.perms }));

  useEffect(() => {
    onChange(pronto ? clubTournamentFields(club) : null);
  }, [pronto, club?.id, club?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!flagOn) return null;
  if (q.isLoading || papel.isLoading) return <V2Skeleton className="h-20" />;
  if (q.isError || papel.isError) return <V2ErrorState inline title={t('Não deu para carregar o clube')} onRetry={() => { q.refetch(); papel.refetch(); }} />;

  const motivo = clubTournamentBlock({ flagOn, club, perms: papel.perms });
  return (
    <section className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50 p-4" data-dica="clube-torneio-origem" aria-label={t('Torneio do clube')}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Users className="h-4 w-4" aria-hidden="true" /> {t('Torneio realizado pelo {clube}', { clube: club?.name || t('clube') })}
      </p>
      {motivo
        ? <p className="text-sm text-gray-600" role="status">{motivo}</p>
        : <p className="text-xs text-gray-600">{t('Ao criar, o torneio já sai com o selo "Realizado pelo {clube}", aparece na página do clube e a diretoria esportiva o acompanha na Central.', { clube: club.name })}</p>}
    </section>
  );
}
