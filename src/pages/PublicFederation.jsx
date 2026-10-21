/**
 * PublicFederation — a página pública da federação (`/f/:slug`), sem login.
 *
 * Marca, selos, sobre, contato e os planos de filiação: a mesma leitura da
 * página dentro do app (`/federacoes/:id`). "Entrar para se filiar" leva ao
 * login e de lá à federação. Só federação APROVADA aparece (o serviço filtra);
 * flag desligada ⇒ início. Falha de rede não vira "não existe".
 */
import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Globe, Instagram, Landmark, Mail, Phone } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';
import { useFederationBySlug, useFederationPlans } from '@/modules/federations/hooks/useFederations';
import { FEDERATION_LEVEL_LABELS } from '@/modules/federations/domain/constants';
import { FedBadges, FedLogo, fedPath } from '@/v2/components/federations/federationUi';
import PlansList from '@/v2/components/federations/PlansList';
import { FedGovernanceBlock, FedNewsSection, FedSponsorsStrip, FedStoreLink } from '@/v2/components/federations/FedCommsBlocks';
import { FedAffiliatesSection, FedCoursesSection, FedCredentialsDirectory, FedOmbudsmanBlock, FedRankingBlock, FedSanctionedTournaments } from '@/v2/components/federations/FedPublicBlocks';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function PublicFederation() {
  const { slug } = useParams();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const { isAuthenticated } = useAuth();
  const ligada = Boolean(flags?.[FEATURE_FLAG.FEDERATIONS]);
  const fq = useFederationBySlug(ligada ? slug : null);
  const f = fq.data;
  const pq = useFederationPlans(f?.id);
  useDocumentMeta({ title: f?.name, description: f?.about || (f ? t('Federação de pickleball: filie-se e receba a carteirinha digital.') : '') }, Boolean(f));

  if (!flagsLoading && !ligada) return <Navigate to="/" replace />;
  const lugar = f ? [f.city, f.state].filter(Boolean).join(' / ') : '';
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[720px] space-y-6 px-4 py-10">
        {flagsLoading || fq.isLoading ? <V2Skeleton lines={6} /> : fq.isError ? (
          <V2ErrorState title={t('Não foi possível carregar a federação')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={() => fq.refetch()} />
        ) : !f ? (
          <div className="rounded-4xl border border-gray-100 bg-paper-pure p-8 text-center">
            <Landmark className="mx-auto h-10 w-10 text-gray-500" aria-hidden="true" />
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">{t('Federação não encontrada')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('O endereço pode estar errado, ou a federação ainda não foi aprovada pela plataforma.')}</p>
            <Link to="/" className="mt-4 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Ir para o PickleRush')}</Link>
          </div>
        ) : (
          <>
            <header className="overflow-hidden rounded-4xl bg-paper-pure p-8 shadow-organic">
              <div className="flex items-start gap-4">
                <FedLogo federation={f} size="xl" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t(FEDERATION_LEVEL_LABELS[f.level] || '')}{lugar ? ` · ${lugar}` : ''}</p>
                  <h1 className="font-display text-3xl font-bold text-ink">{f.name}</h1>
                  <div className="mt-2"><FedBadges federation={f} /></div>
                </div>
              </div>
              {f.about && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">{f.about}</p>}
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-gray-700">
                {f.contact_public?.email && <a href={`mailto:${f.contact_public.email}`} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{f.contact_public.email}</a>}
                {f.contact_public?.phone && <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{f.contact_public.phone}</span>}
                {f.site && <a href={f.site} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1"><Globe className="h-3.5 w-3.5" aria-hidden="true" />{t('Site')}</a>}
                {f.instagram && <a href={`https://instagram.com/${f.instagram}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1"><Instagram className="h-3.5 w-3.5" aria-hidden="true" />@{f.instagram}</a>}
              </div>
              <div className="mt-6">
                <V2Button asChild><Link to={isAuthenticated ? fedPath(f) : `/login?next=${encodeURIComponent(fedPath(f))}`}>{isAuthenticated ? t('Ver no app e filiar-se') : t('Entrar para se filiar')}</Link></V2Button>
              </div>
            </header>
            <section aria-labelledby="planos-titulo" className="space-y-3">
              <h2 id="planos-titulo" className="font-display text-xl font-bold text-ink">{t('Planos de filiação')}</h2>
              {pq.isError ? <V2ErrorState inline title={t('Não carregaram os planos')} onRetry={() => pq.refetch()} /> : pq.isLoading ? <V2Skeleton lines={3} /> : <PlansList plans={pq.data} federation={f} />}
            </section>
            <FedNewsSection federation={f} />
            <FedSanctionedTournaments federation={f} />
            <FedRankingBlock federation={f} />
            <FedCoursesSection federation={f} />
            <FedCredentialsDirectory federation={f} />
            <FedAffiliatesSection federation={f} />
            <FedOmbudsmanBlock federation={f} />
            <FedStoreLink federation={f} />
            <FedSponsorsStrip federation={f} />
            <FedGovernanceBlock federation={f} />
            <p className="text-center text-xs text-gray-500">{t('Carteirinha de filiado? Verifique pelo QR ou em {url}.', { url: 'picklerush.web.app/f/verificar' })}</p>
          </>
        )}
      </div>
    </div>
  );
}
