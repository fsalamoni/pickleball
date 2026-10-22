/**
 * PublicFederation — a página pública da federação (`/f/:slug`), sem login.
 *
 * É o MESMO rosto público da página no app: `FederationProfile` (capa e abas).
 * Aqui não existe área do filiado nem barra da equipe — quem tem conta segue
 * para o app ("Ver no app e filiar-se"). Só federação aprovada E publicada
 * aparece (a regra e o serviço filtram); flag desligada ⇒ início. Falha de rede
 * não vira "não existe".
 */
import React from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { IdCard, Landmark } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';
import { useFederationBySlug, useFederationPlans } from '@/modules/federations/hooks/useFederations';
import { fedPath } from '@/v2/components/federations/federationUi';
import FederationProfile, { FedShareButton } from '@/v2/components/federations/profile/FederationProfile';
import PublicFedTopBar from '@/v2/components/federations/profile/PublicFedTopBar';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function PublicFederation() {
  const { slug } = useParams();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const { isAuthenticated } = useAuth();
  const { search } = useLocation();
  const ligada = Boolean(flags?.[FEATURE_FLAG.FEDERATIONS]);
  const fq = useFederationBySlug(ligada ? slug : null);
  const f = fq.data;
  const pq = useFederationPlans(f?.id);
  useDocumentMeta({ title: f?.name, description: f?.about || (f ? t('Federação de pickleball: filie-se e receba a carteirinha digital.') : '') }, Boolean(f));

  if (!flagsLoading && !ligada) return <Navigate to="/" replace />;
  // A aba aberta (`?aba=`) vai junto: depois de entrar, a pessoa volta ao mesmo lugar, no app.
  const comLogin = (destino) => (isAuthenticated ? destino : `/login?next=${encodeURIComponent(destino)}`);
  const noApp = f ? comLogin(`${fedPath(f)}${search}`) : '/login';
  const planAction = f ? (p) => <V2Button asChild size="sm" variant="secondary" className="w-full"><Link to={comLogin(`/federacoes/${f.id}/filiar?plano=${encodeURIComponent(p.id)}`)}>{t('Filiar-se neste plano')}</Link></V2Button> : null;
  return (
    <div className="min-h-screen bg-paper">
      <PublicFedTopBar appPath={f ? `${fedPath(f)}${search}` : ''} />
      <main className="mx-auto max-w-[1200px] px-4 py-8">
        {flagsLoading || fq.isLoading ? <V2Skeleton lines={6} /> : fq.isError ? (
          <V2ErrorState title={t('Não foi possível carregar a federação')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={() => fq.refetch()} />
        ) : !f ? (
          <div className="mx-auto max-w-xl rounded-4xl border border-gray-100 bg-paper-pure p-8 text-center">
            <Landmark className="mx-auto h-10 w-10 text-gray-500" aria-hidden="true" />
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">{t('Federação não encontrada')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('O endereço pode estar errado, ou a federação ainda não está aberta ao público.')}</p>
            <Link to="/" className="mt-4 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Ir para o PickleRush')}</Link>
          </div>
        ) : (
          <FederationProfile
            federation={f}
            plansQ={pq}
            planAction={planAction}
            actions={(
              <>
                <V2Button asChild><Link to={noApp}><IdCard className="h-4 w-4" />{isAuthenticated ? t('Ver no app e filiar-se') : t('Entrar para se filiar')}</Link></V2Button>
                <FedShareButton federation={f} />
              </>
            )}
          />
        )}
      </main>
    </div>
  );
}
