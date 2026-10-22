/**
 * V2FederationDetail — a página de uma federação dentro do app
 * (`/federacoes/:id`, flag `federations`).
 *
 * Três rostos, cada um no seu lugar:
 *   • o PÚBLICO — `FederationProfile`, o mesmo componente da página sem conta
 *     (`/f/:slug`): capa e abas (visão geral, notícias, agenda, competições…);
 *   • a PESSOA — a faixa "Sua filiação" e a aba "Minha filiação"
 *     (`FedMemberArea`), marcadas "só você vê";
 *   • a EQUIPE — uma barra escura no topo (`FedStaffBar`) com a Central e a
 *     prévia "ver como visitante" (`?visao=publico`), que mostra a página sem a
 *     barra e sem a área do filiado.
 */
import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFederation, useFederationPlans, useMyFederationRole } from '@/modules/federations/hooks/useFederations';
import { membershipState } from '@/modules/federations/domain/membership';
import { FEDERATION_STATUS, MEMBER_STATUS } from '@/modules/federations/domain/constants';
import { isFederationPublic } from '@/modules/federations/domain/federation';
import { V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Page, V2Skeleton } from '@/v2/ui/primitives';
import { FederationGate } from '@/v2/components/federations/federationUi';
import FederationProfile, { FedShareButton } from '@/v2/components/federations/profile/FederationProfile';
import { FedPreviewBanner, FedStaffBar, PREVIEW_PARAM, PREVIEW_VALUE } from '@/v2/components/federations/profile/FedStaffBar';
import { FedJoinActions, FedMemberStrip, FedMyMembership, useMyFederationStanding } from '@/v2/components/federations/profile/FedMemberArea';
import { t, tk } from '@/core/i18n';

const STATUS_AVISO = {
  [FEDERATION_STATUS.PENDING]: tk('Em análise pela equipe do PickleRush.'),
  [FEDERATION_STATUS.SUSPENDED]: tk('Suspensa pela plataforma.'),
  [FEDERATION_STATUS.REJECTED]: tk('Pedido recusado.'),
};

function Detalhe() {
  const { federationId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const fq = useFederation(federationId);
  const pq = useFederationPlans(federationId);
  const papel = useMyFederationRole(federationId);
  const standing = useMyFederationStanding(federationId);
  const f = fq.data;

  if (fq.isError) return <V2Page><V2ErrorState title={t('Não carregou a federação')} description={t('Ela continua lá. Confira a conexão e tente de novo.')} onRetry={() => fq.refetch()} /></V2Page>;
  if (fq.isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-40" /><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  if (!f) return <V2Page><V2EmptyState icon={Landmark} title={t('Federação não encontrada')} description={t('O endereço pode estar errado, ou a federação ainda não está aberta ao público.')} action={<V2Button asChild variant="secondary"><Link to="/federacoes">{t('Ver as federações')}</Link></V2Button>} /></V2Page>;

  const equipe = papel.isStaff || papel.needsGrant;
  const previa = params.get(PREVIEW_PARAM) === PREVIEW_VALUE;
  const aprovada = f.status === FEDERATION_STATUS.APPROVED;
  const pessoal = aprovada && !previa; // a área do filiado é da pessoa: nunca na prévia
  const filiadoAtivo = pessoal && membershipState(standing.membro).status === MEMBER_STATUS.ACTIVE;

  // Cada plano leva direto ao pedido com ele escolhido — só para quem ainda pode pedir (sem filiação viva).
  const planAction = pessoal && standing.pronto && !standing.temFiliacao
    ? (p) => <V2Button asChild size="sm" variant="secondary" className="w-full"><Link to={`/federacoes/${f.id}/filiar?plano=${encodeURIComponent(p.id)}`}>{t('Filiar-se neste plano')}</Link></V2Button>
    : null;
  const acoes = (
    <>
      {pessoal ? <FedJoinActions federation={f} /> : previa && aprovada && <V2Button type="button" disabled>{t('Filiar-se')}</V2Button>}
      {isFederationPublic(f) && <FedShareButton federation={f} />}
    </>
  );
  const acima = ({ aba, irPara }) => (
    <>
      {!aprovada && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{t(STATUS_AVISO[f.status] || '')}</p>}
      {pessoal && <FedMemberStrip federation={f} plans={pq.data} aba={aba} irPara={irPara} />}
    </>
  );

  return (
    <V2Page className="space-y-6">
      <V2BackLink to="/federacoes">{t('Federações')}</V2BackLink>
      {previa ? <FedPreviewBanner federation={f} staff={equipe} /> : equipe && <FedStaffBar federation={f} papel={papel} />}
      <FederationProfile
        federation={f}
        plansQ={pq}
        actions={acoes}
        above={acima}
        mine={pessoal && standing.temFiliacao ? <FedMyMembership federation={f} plans={pq.data} /> : null}
        memberOf={filiadoAtivo}
        meUid={user?.uid || null}
        planAction={planAction}
      />
    </V2Page>
  );
}

export default function V2FederationDetail() {
  return <FederationGate><Detalhe /></FederationGate>;
}
