/**
 * A aba "Associação" da página do clube (e a faixa "Associe-se" de quem ainda
 * não é membro): a apresentação do clube, os planos e — para quem já tem
 * filiação — a situação, a carteirinha e o Pix. Só existe com a flag
 * `club_association` ligada e a associação aberta ao público (`isAssociationOpen`).
 */
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { calculateAge } from '@/core/lib/profileValidation';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isAssociationOpen, myAssociationView, normalizeAssociation } from '@/modules/clubs/domain/association';
import { useMyAffiliation, useMyClubCharges, usePublicPlans } from '@/modules/clubs/hooks/useClubAssociation';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import ClubPlansList from './ClubPlansList';
import ClubJoinDialog from './ClubJoinDialog';
import MyAssociationPanel from './MyAssociationPanel';
import { ClubBenefitsShowcase, ClubPromosSection, ClubSponsorsStrip, ClubStoreCard } from './ClubShowcase';
import { t } from '@/core/i18n';

const ClubOmbudsman = lazy(() => import('./ClubOmbudsman'));
const ClubMyProtection = lazy(() => import('./ClubMyProtection'));
const ClubMyCallups = lazy(() => import('./ClubMyCallups'));

export default function ClubAssociationTab({ club }) {
  const { isAuthenticated, userProfile } = useAuth();
  const plansQ = usePublicPlans(club.id, { enabled: isAssociationOpen(club) });
  const mine = useMyAffiliation(club.id, { enabled: isAssociationOpen(club) });
  const charges = useMyClubCharges(club.id, { enabled: Boolean(mine.data) });
  const [escolhido, setEscolhido] = useState(null);
  const cfg = normalizeAssociation(club);
  const age = useMemo(() => calculateAge(userProfile?.birth_date), [userProfile?.birth_date]);
  const view = useMemo(() => (mine.data ? myAssociationView(mine.data, charges.data || []) : null), [mine.data, charges.data]);
  const podePedir = !mine.data || view?.canRequest;

  return (
    <section className="space-y-5" aria-label={t('Associação')}>
      {cfg.intro && <V2Surface><p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{cfg.intro}</p></V2Surface>}

      {isAuthenticated && <MyAssociationPanel club={club} plan={(plansQ.data || []).find((p) => p.id === mine.data?.plan_id) || null} />}
      {isAuthenticated && <Suspense fallback={null}><ClubMyCallups clubId={club.id} /></Suspense>}
      {isAuthenticated && <Suspense fallback={null}><ClubMyProtection clubId={club.id} /></Suspense>}

      {podePedir && (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold text-ink">{t('Escolha o seu plano')}</h3>
          {plansQ.isLoading && <V2Skeleton className="h-40 rounded-3xl" />}
          {plansQ.isError && <V2ErrorState inline title={t('Não carregaram os planos')} onRetry={() => plansQ.refetch()} />}
          {plansQ.isSuccess && (
            <ClubPlansList
              plans={plansQ.data}
              age={age}
              color={cfg.color}
              action={(plano, preco) => (isAuthenticated
                ? <V2Button type="button" size="sm" onClick={() => setEscolhido({ plano, preco })} data-dica="clube-associar">{t('Associar-se')}</V2Button>
                : <V2Button asChild size="sm"><Link to="/login">{t('Entre para se associar')}</Link></V2Button>)}
            />
          )}
        </div>
      )}
      {/* O convite para se associar: o que o associado ganha e quem apoia o clube (a vitrine pública). */}
      <ClubBenefitsShowcase clubId={club.id} enabled={isAssociationOpen(club)} />
      <ClubPromosSection clubId={club.id} enabled={isAssociationOpen(club)} />
      <ClubStoreCard clubId={club.id} enabled={isAssociationOpen(club)} />
      <ClubSponsorsStrip clubId={club.id} enabled={isAssociationOpen(club)} />
      <Suspense fallback={null}><ClubOmbudsman club={club} /></Suspense>
      <ClubJoinDialog open={Boolean(escolhido)} onOpenChange={(o) => { if (!o) setEscolhido(null); }} club={club} plan={escolhido?.plano} price={escolhido?.preco} />
    </section>
  );
}
