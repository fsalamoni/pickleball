/**
 * PublicClub — vitrine pública do clube (flag club_public_page).
 *
 * Página sem login para clubes marcados como públicos: nome, local, descrição e
 * CTA "quero participar". Rota /c/:clubId. Se o clube não é público (ou a flag
 * está desligada), orienta a entrar na plataforma.
 */

import React, { lazy, Suspense } from 'react';
import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Mail, Phone, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { getClub } from '@/modules/clubs/services/clubService';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { isAssociationOpen, normalizeAssociation } from '@/modules/clubs/domain/association';
import { usePublicPlans } from '@/modules/clubs/hooks/useClubAssociation';
import ClubPlansList from '@/v2/components/clubs/association/ClubPlansList';
import { ClubBenefitsShowcase, ClubNewsSection, ClubSponsorsStrip } from '@/v2/components/clubs/association/ClubShowcase';
import { t } from '@/core/i18n';

// A transparência das contas carrega o motor de contas: só quando a página é aberta.
const ClubAccountsPublic = lazy(() => import('@/v2/components/clubs/association/ClubAccountsPublic'));
const ClubDocsPublic = lazy(() => import('@/v2/components/clubs/association/ClubDocsPublic'));
const ClubAgendaPublic = lazy(() => import('@/v2/components/clubs/association/ClubAgendaPublic'));

/** Os planos de associação na vitrine: quem chega pelo link vê o que ganha e entra para se associar. */
function PublicClubPlans({ club, isAuthenticated, docId, eventId, agendaInteira }) {
  const plansQ = usePublicPlans(club.id);
  const cfg = normalizeAssociation(club);
  const destino = isAuthenticated ? `/clubes/${club.id}` : '/login';
  return (
    <section className="mt-6 space-y-4 rounded-4xl border border-gray-100 bg-paper-pure p-6" aria-label={t('Associe-se')}>
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">{t('Associe-se ao {clube}', { clube: club.name })}</h2>
        {cfg.intro && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">{cfg.intro}</p>}
      </div>
      {plansQ.isLoading && <p className="text-sm text-gray-500">{t('Carregando…')}</p>}
      {plansQ.isError && (
        <p className="text-sm text-gray-700">
          {t('Não foi possível carregar os planos.')}{' '}
          <button type="button" onClick={() => plansQ.refetch()} className="font-semibold text-ink underline">{t('Tentar de novo')}</button>
        </p>
      )}
      {plansQ.isSuccess && (
        <ClubPlansList
          plans={plansQ.data}
          color={cfg.color}
          action={() => (
            <Link to={destino} className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">
              {isAuthenticated ? t('Associar-se') : t('Entre para se associar')}
            </Link>
          )}
        />
      )}
      <ClubBenefitsShowcase clubId={club.id} />
      <ClubNewsSection clubId={club.id} limite={3} />
      <ClubSponsorsStrip clubId={club.id} />
      <Suspense fallback={null}><ClubAgendaPublic club={club} publica eventId={eventId} compacto={!eventId && !agendaInteira} /></Suspense>
      <Suspense fallback={null}><ClubDocsPublic club={club} publica docId={docId} compacto={!docId} /></Suspense>
      <Suspense fallback={null}><ClubAccountsPublic clubId={club.id} /></Suspense>
    </section>
  );
}

export default function PublicClub() {
  const { clubId } = useParams();
  const [searchParams] = useSearchParams();
  const docId = searchParams.get('doc') || null;
  const eventId = searchParams.get('evento') || null;
  const agendaInteira = searchParams.get('agenda') === '1';
  const publicOn = true;
  const { isAuthenticated } = useAuth();
  const associationFlag = useFeatureFlag(FEATURE_FLAG.CLUB_ASSOCIATION);
  const { data: club, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-club', clubId],
    queryFn: () => getClub(clubId),
    enabled: publicOn && !!clubId,
  });

  useDocumentMeta({
    title: club?.name,
    description: club?.description || (club ? t('Clube de pickleball{v1}.', { v1: club.city ? t(' em {city}', { city: club.city }) : '' }) : ''),
  }, publicOn && !!club);

  if (!publicOn) return <Navigate to="/login" replace />;

  const location = club ? [club.city, club.state].filter(Boolean).join(' / ') : '';
  const isPublic = club && club.is_public === true;
  const associationOpen = associationFlag && isAssociationOpen(club);

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[720px] px-4 py-10">
        {isLoading ? (
          <p className="py-20 text-center text-gray-400">{t('Carregando…')}</p>
        ) : isError && !club ? (
          /* ⚠️ Sem esta ramificação, uma falha de rede virava uma AFIRMAÇÃO
             sobre a escolha do clube — "não disponível publicamente" — e
             empurrava quem chegou pelo link para criar uma conta que não
             resolveria nada. O clube pode ser público; quem falhou foi a
             consulta. */
          <div className="rounded-4xl border border-gray-100 bg-paper-pure p-8 text-center">
            <h1 className="font-display text-2xl font-bold text-ink">
              {t('Não foi possível carregar o clube')}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {t('A conexão falhou no meio do caminho. O link continua valendo.')}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white"
            >
              {t('Tentar de novo')}
            </button>
          </div>
        ) : !isPublic ? (
          <div className="rounded-4xl border border-gray-100 bg-paper-pure p-8 text-center">
            <h1 className="font-display text-2xl font-bold text-ink">{t('Clube não disponível publicamente')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('Entre na plataforma para ver os clubes.')}</p>
            <Link to="/login" className="mt-4 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Entrar')}</Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
            <div className="flex items-start gap-4">
              {club.logo_url
                ? <img src={club.logo_url} alt={club.name} className="h-16 w-16 rounded-2xl object-cover" />
                : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white"><Building2 className="h-7 w-7" /></span>}
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-bold text-white">{club.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-300">
                  {location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {location}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {club.member_count || 0} {t('membro(s)')}</span>
                </div>
              </div>
            </div>
            {club.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-200">{club.description}</p>}
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-gray-300">
              {club.home_venue && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1"><Building2 className="h-3.5 w-3.5" /> {club.home_venue}</span>}
              {club.contact_email && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1"><Mail className="h-3.5 w-3.5" /> {club.contact_email}</span>}
              {club.contact_phone && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1"><Phone className="h-3.5 w-3.5" /> {club.contact_phone}</span>}
            </div>
            <div className="mt-6">
              <Link to={isAuthenticated ? `/clubes/${club.id}` : '/login'}
                className="inline-flex rounded-full bg-acid px-6 py-3 text-sm font-bold text-ink">
                {isAuthenticated ? t('Ver clube e participar') : t('Entrar para participar')}
              </Link>
            </div>
          </div>
        )}
        {isPublic && associationOpen && <PublicClubPlans club={club} isAuthenticated={isAuthenticated} docId={docId} eventId={eventId} agendaInteira={agendaInteira} />}
      </div>
    </div>
  );
}
