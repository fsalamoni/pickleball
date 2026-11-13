/**
 * Card "Ligas" do início (qualquer flag `leagues_*`, escolhido pela pessoa,
 * docs/31 + docs/57 §13): as minhas ligas em andamento ou com inscrição
 * aberta, com os placares que esperam a minha confirmação em destaque.
 * Falha ≠ vazio: com a lista falhando, o card não diz "nenhuma liga".
 */
import React from 'react';
import { ListOrdered } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyLeagues } from '@/modules/leagues/hooks/useLeagues';
import { homeLeagueRows } from '@/modules/leagues/domain/leaguePending';
import { LEAGUE_STATUS_LABELS } from '@/modules/leagues/domain/leagueFormats';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from '@/v2/components/home/personal/HomeSection';
import { shortDate } from './leagueUi';
import { t, tn } from '@/core/i18n';

const ligaLink = (id, aba) => `/ligas/${encodeURIComponent(id)}${aba ? `/${aba}` : ''}`;

export default function HomeLeaguesCard() {
  const { user } = useAuth();
  const q = useMyLeagues();
  const moldura = (conteudo) => (
    <HomeSection id="ligas" icon={ListOrdered} title={t('Ligas')} action={{ to: '/ligas', label: t('Ver as ligas') }}>{conteudo}</HomeSection>
  );
  if (q.isLoading) return moldura(<V2Skeleton lines={3} />);
  if (q.isError) return moldura(<V2ErrorState inline title={t('As suas ligas não carregaram')} onRetry={() => q.refetch()} />);
  const linhas = homeLeagueRows(q.data, user?.uid) || [];
  if (!linhas.length) {
    return moldura(
      <HomeEmpty icon={ListOrdered} actions={<HomeAction to="/ligas" primary>{t('Ver as ligas abertas')}</HomeAction>}>
        {t('Você não está em nenhuma liga em andamento. Veja as que estão com inscrição aberta.')}
      </HomeEmpty>,
    );
  }
  return moldura(
    <div className="space-y-1">
      {linhas.map((l) => (
        <HomeRow
          key={l.id}
          to={ligaLink(l.id, l.pending ? 'rodadas' : '')}
          icon={ListOrdered}
          title={l.name}
          subtitle={l.status === 'open' && l.startDate
            ? t('Inscrições abertas · começa em {data}', { data: shortDate(l.startDate) })
            : t(LEAGUE_STATUS_LABELS[l.status])}
          badge={l.pending ? tn(l.pending, '{n} placar para confirmar', '{n} placares para confirmar') : undefined}
          badgeTone="amber"
          highlight={l.pending > 0}
        />
      ))}
    </div>,
  );
}
