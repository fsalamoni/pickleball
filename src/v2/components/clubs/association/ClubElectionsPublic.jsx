/**
 * A aba ELEIÇÕES da página do clube (`?tab=eleicoes`), para quem é do clube: o edital, o
 * calendário, os cargos, as chapas aceitas, o resultado e a ata; para quem está logado,
 * "Sua participação" (votar, registrar chapa, defesa); para a comissão eleitoral, a área de
 * conduzir; e o pedido de apoio que chega pelo link da chapa. É a aba da federação com o clube
 * no lugar dela (`electionsScope.js`). As eleições só aparecem a quem é do clube: o servidor
 * devolve a visão vazia a quem não é, e a tela diz isso em vez de afirmar que não há eleição.
 */
import React, { useMemo } from 'react';
import { Vote } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClubElectionsOverview } from '@/modules/clubs/hooks/useClubElections';
import { V2EmptyState, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { clubElectionsEntity } from '../../federations/elections/electionsScope';
import ElectionsPublic from '../../federations/elections/ElectionsPublic';

export default function ClubElectionsPublic({ club, enabled = true }) {
  const { user } = useAuth();
  const entity = useMemo(() => clubElectionsEntity(club), [club]);
  const visao = useClubElectionsOverview(club?.id, { enabled: enabled && Boolean(user?.uid) });

  if (!user?.uid) return null;
  if (visao.isError) return <V2ErrorState title={t('Não carregaram as eleições')} onRetry={visao.refetch} />;
  if (visao.isLoading) return <V2Skeleton lines={5} />;
  if (visao.data && visao.data.member === false) {
    return <V2EmptyState icon={Vote} title={t('As eleições são dos associados')} description={t('Entre no clube para acompanhar o edital, as chapas e a votação.')} />;
  }
  return <ElectionsPublic federation={entity} meUid={user.uid} memberOf />;
}
