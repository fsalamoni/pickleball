/**
 * V2FederationDetail — a página de uma federação dentro do app
 * (`/federacoes/:id`, flag `federations`): marca, selos, sobre, contato, os
 * planos de filiação e a SITUAÇÃO DA PESSOA ali (filiar-se, pagar, renovar,
 * carteirinha). Quem é da equipe vê o atalho para a Central. A página
 * pública (`/f/:slug`) é a mesma leitura sem conta.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftRight, ExternalLink, Globe, IdCard, Instagram, Landmark, Mail, Phone, Settings2, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFederation, useFederationMutation, useFederationPlans, useMyFederationCharges, useMyFederationRole, useMyMembership } from '@/modules/federations/hooks/useFederations';
import { membershipAction } from '@/modules/federations/services/federationService';
import { canRequestMembership, membershipState } from '@/modules/federations/domain/membership';
import { CHARGE_STATUS, FEDERATION_STATUS, MEMBER_STATUS } from '@/modules/federations/domain/constants';
import { V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Page, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { PAGE_TITLE } from '@/v2/ui/pageFrame';
import { FedBadges, FedLogo, FederationGate, MemberStatusBadge, fedManagePath, fedPublicPath, quando } from '@/v2/components/federations/federationUi';
import MemberCardDialog from '@/v2/components/federations/MemberCard';
import PixChargeBlock from '@/v2/components/federations/PixChargeBlock';
import PlansList from '@/v2/components/federations/PlansList';
import { FedAffiliatesSection, FedCoursesSection, FedCredentialsDirectory, FedOmbudsmanBlock, FedRankingBlock, FedSanctionedTournaments } from '@/v2/components/federations/FedPublicBlocks';
import { FedMemberDocuments, FedMySanctions, FedTransferDialog } from '@/v2/components/federations/FedMemberExtras';
import { FedGovernanceBlock, FedNewsSection, FedPromosSection, FedSponsorsStrip, FedStoreLink } from '@/v2/components/federations/FedCommsBlocks';
import { LIVE_MEMBER_STATUSES } from '@/modules/federations/domain/membership';
import { isDisciplineSuspended } from '@/modules/federations/domain/discipline';
import { t, tn } from '@/core/i18n';
import { safeHttpUrl } from '@/core/domain/externalUrl';
import { useHashScroll } from '@/v2/ui/useHashScroll';

/** A situação da pessoa nesta federação: filiar-se, pagar, renovar, carteirinha. */
function MinhaSituacao({ federation, plans }) {
  const { user } = useAuth();
  const mq = useMyMembership(federation.id);
  const cq = useMyFederationCharges();
  const [cartao, setCartao] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const renovar = useFederationMutation(() => membershipAction({ federationId: federation.id, action: 'renew' }));
  if (mq.isError || cq.isError) return <V2ErrorState inline title={t('Não carregou a sua situação nesta federação')} onRetry={() => { if (mq.isError) mq.refetch(); if (cq.isError) cq.refetch(); }} />;
  if (!mq.isSuccess || !cq.isSuccess) return <V2Skeleton lines={3} />;
  const m = mq.data;
  const st = membershipState(m);
  const cobrancas = (cq.data || []).filter((c) => c.federation_id === federation.id && [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status));
  const plano = (plans || []).find((p) => p.id === m?.plan_id) || null;
  const aberta = federation.status === FEDERATION_STATUS.APPROVED;

  if (canRequestMembership(m)) {
    return (
      <V2Surface className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-dica="federacao-filiar">
        <div>
          <p className="font-display text-lg font-bold text-ink">{t('Você ainda não é filiado')}</p>
          <p className="text-sm text-gray-600">{m?.status === MEMBER_STATUS.REJECTED ? t('O pedido anterior foi recusado: {motivo}.', { motivo: m.reject_reason || t('sem motivo informado') }) : t('Escolha um plano, pague por Pix e receba a carteirinha digital.')}</p>
        </div>
        {aberta ? (
          <div className="flex flex-wrap gap-2">
            <V2Button asChild><Link to={`/federacoes/${federation.id}/filiar`}><IdCard className="h-4 w-4" />{t('Filiar-se')}</Link></V2Button>
            <V2Button asChild variant="ghost"><Link to={`/federacoes/${federation.id}/filiar?dependente=1`}><Users className="h-4 w-4" />{t('Filiar um dependente')}</Link></V2Button>
          </div>
        ) : (
          // `disabled` num `<Link>` não desliga nada: o link abria a tela de filiar numa federação suspensa.
          <p className="text-sm text-gray-500">{t('A filiação abre quando a federação estiver aprovada e ativa.')}</p>
        )}
      </V2Surface>
    );
  }
  return (
    <V2Surface className="space-y-4" data-dica="federacao-minha-filiacao">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">{t('Sua filiação')}</p>
          <p className="text-sm text-gray-600">{m.plan_name}{m.member_number ? ` · ${t('nº {numero}', { numero: m.member_number })}` : ''}{st.validUntil ? ` · ${t('válida até {data}', { data: quando(st.validUntil) })}` : ''}</p>
        </div>
        <MemberStatusBadge status={st.status} label={st.label} />
      </div>
      {st.status === MEMBER_STATUS.PENDING && <p className="text-sm text-gray-600">{t('A secretaria da federação analisa o pedido e avisa pelo sino.')}</p>}
      {st.status === MEMBER_STATUS.SUSPENDED && <p className="text-sm text-red-600">{t('Filiação suspensa{motivo}.', { motivo: m.suspended_reason ? `: ${m.suspended_reason}` : '' })}</p>}
      {isDisciplineSuspended(m) && <p className="text-sm text-red-600">{t('Suspensão disciplinar até {data}: sem inscrição em torneio chancelado "só filiados" até lá.', { data: quando(m.discipline_until_ms) })}</p>}
      {cobrancas.map((c) => <PixChargeBlock key={c.id} charge={c} federation={federation} />)}
      <FedMemberDocuments member={m} plan={plano} />
      <FedMySanctions federationId={federation.id} />
      <div className="flex flex-wrap gap-2">
        {[MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(st.status) && m.card_code && (
          <V2Button type="button" onClick={() => setCartao(true)} data-dica="federacao-carteirinha"><IdCard className="h-4 w-4" />{t('Carteirinha digital')}</V2Button>
        )}
        {st.canRenew && cobrancas.length === 0 && (
          <V2Button type="button" variant="secondary" disabled={renovar.isPending} onClick={() => renovar.mutate(undefined, { onSuccess: () => toast.success(t('Renovação pedida. Pague a cobrança para seguir em dia.')), onError: (e) => toast.error(e.message) })}>
            {st.status === MEMBER_STATUS.EXPIRED ? t('Renovar a filiação') : t('Renovar antes de vencer')}
          </V2Button>
        )}
        {LIVE_MEMBER_STATUSES.includes(st.status) && st.status !== MEMBER_STATUS.PENDING && <V2Button type="button" variant="ghost" onClick={() => setTransferindo(true)} data-dica="federacao-transferencia"><ArrowLeftRight className="h-4 w-4" />{t('Transferência')}</V2Button>}
        <V2Button asChild variant="ghost"><Link to={`/federacoes/${federation.id}/filiar?dependente=1`}><Users className="h-4 w-4" />{t('Filiar um dependente')}</Link></V2Button>
        <V2Button asChild variant="ghost"><Link to="/perfil?secao=federacoes">{t('Minhas federações')}</Link></V2Button>
      </div>
      {cartao && <MemberCardDialog open onOpenChange={setCartao} member={{ ...m, user_name: m.user_name || user?.displayName }} federation={federation} plan={plano} />}
      {transferindo && <FedTransferDialog member={m} federation={federation} onClose={() => setTransferindo(false)} />}
    </V2Surface>
  );
}

function Detalhe() {
  const { federationId } = useParams();
  useHashScroll(); // o aviso leva a `#fed-cursos`, `#fed-ranking`… — a seção só aparece depois da consulta
  const { user } = useAuth();
  const fq = useFederation(federationId);
  const pq = useFederationPlans(federationId);
  const papel = useMyFederationRole(federationId);
  // Mesma consulta da "Sua filiação" (mesma chave): decide as notícias "só filiados".
  const minha = useMyMembership(federationId);
  const filiadoAtivo = membershipState(minha.data).status === MEMBER_STATUS.ACTIVE;
  const f = fq.data;
  const publica = useMemo(() => (f ? `${typeof window !== 'undefined' ? window.location.origin : ''}${fedPublicPath(f)}` : ''), [f]);

  if (fq.isError) return <V2Page><V2ErrorState title={t('Não carregou a federação')} description={t('Ela continua lá. Confira a conexão e tente de novo.')} onRetry={() => fq.refetch()} /></V2Page>;
  if (fq.isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-28" /><V2Skeleton className="h-64" /></V2Page>;
  if (!f) return <V2Page><V2EmptyState icon={Landmark} title={t('Federação não encontrada')} description={t('O endereço pode estar errado, ou a federação ainda não foi aprovada.')} action={<V2Button asChild variant="secondary"><Link to="/federacoes">{t('Ver as federações')}</Link></V2Button>} /></V2Page>;

  const contato = f.contact_public || {};
  return (
    <V2Page className="space-y-8">
      <V2BackLink to="/federacoes">{t('Federações')}</V2BackLink>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <FedLogo federation={f} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className={PAGE_TITLE}>{f.name}</h1>
          <p className="mt-1 text-gray-600">{[f.acronym, f.city, f.state].filter(Boolean).join(' · ')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FedBadges federation={f} />
            <span className="inline-flex items-center gap-1 text-sm text-gray-500"><Users className="h-4 w-4" aria-hidden="true" />{tn(f.member_count || 0, '{n} filiado', '{n} filiados')}</span>
          </div>
          {f.status !== FEDERATION_STATUS.APPROVED && <p className="mt-2 text-sm font-semibold text-amber-700">{f.status === FEDERATION_STATUS.PENDING ? t('Em análise pela equipe do PickleRush.') : f.status === FEDERATION_STATUS.SUSPENDED ? t('Suspensa pela plataforma.') : t('Pedido recusado.')}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {papel.isStaff && <V2Button asChild variant="secondary" data-dica="federacao-gerir"><Link to={fedManagePath(f)}><Settings2 className="h-4 w-4" />{t('Gerir')}</Link></V2Button>}
          {f.status === FEDERATION_STATUS.APPROVED && <V2Button asChild variant="ghost"><a href={publica} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('Página pública')}</a></V2Button>}
        </div>
      </header>

      {f.status === FEDERATION_STATUS.APPROVED && <MinhaSituacao federation={f} plans={pq.data} />}

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-8" aria-labelledby="fed-planos">
          <div>
            <h2 id="fed-planos" className="font-display text-xl font-bold text-ink">{t('Planos de filiação')}</h2>
            <p className="text-sm text-gray-500">{t('Mensalidade ou anuidade, por tipo de pessoa. O Pix vai direto para a federação.')}</p>
          </div>
          {pq.isError ? <V2ErrorState inline title={t('Não carregaram os planos')} onRetry={() => pq.refetch()} /> : pq.isLoading ? <V2Skeleton lines={4} /> : <PlansList plans={pq.data} federation={f} />}
          {f.about && (
            <section aria-labelledby="fed-sobre">
              <h2 id="fed-sobre" className="font-display text-xl font-bold text-ink">{t('Sobre')}</h2>
              <p className="mt-2 whitespace-pre-line text-gray-700">{f.about}</p>
            </section>
          )}
          {f.status === FEDERATION_STATUS.APPROVED && (
            <>
              <FedNewsSection federation={f} memberOf={filiadoAtivo} />
              <FedPromosSection federation={f} />
              <FedSanctionedTournaments federation={f} />
              <FedRankingBlock federation={f} meUid={user?.uid || null} />
              <FedCoursesSection federation={f} />
              <FedCredentialsDirectory federation={f} />
              <FedAffiliatesSection federation={f} />
              <FedOmbudsmanBlock federation={f} />
              <FedSponsorsStrip federation={f} />
              <FedGovernanceBlock federation={f} />
            </>
          )}
        </section>
        <aside className="space-y-3 lg:col-span-4">
          {f.status === FEDERATION_STATUS.APPROVED && <FedStoreLink federation={f} />}
          <V2Surface variant="compacto" className="space-y-2 p-4">
            <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Contato')}</p>
            {contato.email && <a href={`mailto:${contato.email}`} className="flex items-center gap-2 text-sm text-ink hover:underline"><Mail className="h-4 w-4" aria-hidden="true" />{contato.email}</a>}
            {contato.phone && <a href={`tel:${contato.phone}`} className="flex items-center gap-2 text-sm text-ink hover:underline"><Phone className="h-4 w-4" aria-hidden="true" />{contato.phone}</a>}
            {safeHttpUrl(f.site) && <a href={safeHttpUrl(f.site)} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-ink hover:underline"><Globe className="h-4 w-4" aria-hidden="true" />{f.site.replace(/^https?:\/\//, '')}</a>}
            {f.instagram && <a href={`https://instagram.com/${f.instagram}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-ink hover:underline"><Instagram className="h-4 w-4" aria-hidden="true" />@{f.instagram}</a>}
            {f.cnpj_masked && <p className="text-xs text-gray-500">{t('CNPJ {n}', { n: f.cnpj_masked })}</p>}
          </V2Surface>
        </aside>
      </div>
    </V2Page>
  );
}

export default function V2FederationDetail() {
  return <FederationGate><Detalhe /></FederationGate>;
}
