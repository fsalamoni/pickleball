/**
 * V2Promotions — a VITRINE de promoções da plataforma e dos professores
 * (Onda CG). Rota: `/promocoes`.
 *
 * Reúne o que está no ar agora: os banners de campanha que a plataforma e os
 * professores puseram na página, e os cupons divulgados — cada um com o
 * código para copiar e onde usar. Nada vencido: cupom desligado, esgotado ou
 * vencido e banner encerrado ou pausado não aparecem.
 *
 * "Só para os meus alunos" é respeitado: o aluno vê os do professor dele; os
 * outros não. Se não deu para saber de quem a pessoa é aluna, a tela avisa em
 * vez de afirmar que não há promoção.
 *
 * Falha não é vazio: "nenhuma promoção no ar" só com a leitura em mãos.
 */
import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { GraduationCap, Megaphone, Tag } from 'lucide-react';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  PROMO_ISSUER, isVisibleTo, livePromoBanners, livePromoCoupons, reachMatchesRegion,
} from '@/modules/promo/domain/promo';
import { BANNER_REGION, bannerRegionFromMyRegion } from '@/modules/arenas/domain/homeBanners';
import { useMyRegion } from '@/core/lib/useMyRegion';
import RegionBar from '@/v2/components/region/RegionBar';
import { usePromoShowcase, usePromoViewer } from '@/modules/promo/hooks/usePromo';
import {
  V2EmptyState, V2ErrorState, V2PageIntro, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import PromoCampaignBanner from '@/v2/components/promo/PromoCampaignBanner';
import PromoCouponCard from '@/v2/components/promo/PromoCouponCard';

export default function V2Promotions() {
  const { flags, isLoading: flagsCarregando } = useFeatureFlags();
  const plataformaOn = Boolean(flags?.[FEATURE_FLAG.PLATFORM_MARKETING]);
  const professoresOn = Boolean(flags?.[FEATURE_FLAG.COACH_MARKETING]);
  const ligado = plataformaOn || professoresOn;
  const q = usePromoShowcase({ enabled: ligado });
  const quem = usePromoViewer({ enabled: professoresOn });
  const today = todayISO();

  // Minha região: as promoções da região da pessoa (as nacionais sempre
  // entram). Sem saber onde ela está, a vitrine mostra tudo — ela é a página
  // de "ver todas".
  const minha = useMyRegion();
  const [verTodas, setVerTodas] = useState(false);
  const regiaoPromo = minha.ativa ? bannerRegionFromMyRegion(minha.region, minha.matcher) : null;
  const filtraRegiao = Boolean(regiaoPromo) && regiaoPromo.mode !== BANNER_REGION.UNKNOWN
    && regiaoPromo.mode !== BANNER_REGION.ALL && !verTodas;

  const { banners, cuponsPlataforma, cuponsProfessores, fora } = useMemo(() => {
    const emissorLigado = (d) => (d.issuer_type === PROMO_ISSUER.PLATFORM ? plataformaOn : professoresOn);
    const visivelSemRegiao = (d) => emissorLigado(d) && isVisibleTo(d, quem);
    const naRegiao = (d) => !filtraRegiao || reachMatchesRegion(d.reach, regiaoPromo);
    let foraDaRegiao = 0;
    const visivel = (d) => {
      if (!visivelSemRegiao(d)) return false;
      if (naRegiao(d)) return true;
      foraDaRegiao += 1;
      return false;
    };
    const cupons = livePromoCoupons(q.data?.coupons || []).filter(visivel);
    return {
      banners: livePromoBanners(q.data?.campaigns || [], { today, lugar: 'page' }).filter(visivel),
      cuponsPlataforma: cupons.filter((c) => c.issuer_type === PROMO_ISSUER.PLATFORM),
      cuponsProfessores: cupons.filter((c) => c.issuer_type === PROMO_ISSUER.COACH),
      fora: foraDaRegiao,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, quem, today, plataformaOn, professoresOn, filtraRegiao, minha.matcher, minha.region]);
  // A barra da região, no formato que ela espera.
  const regional = {
    ...minha,
    fora: filtraRegiao ? fora : 0,
    ampliado: verTodas,
    ampliadoCom: verTodas ? 1 : 0,
    ampliar: () => setVerTodas(true),
    recolher: () => setVerTodas(false),
    buscando: false,
  };

  if (!flagsCarregando && !ligado) return <Navigate to="/" replace />;

  const nada = banners.length + cuponsPlataforma.length + cuponsProfessores.length === 0;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <V2PageIntro
        title="Promoções"
        subtitle="Cupons e campanhas da plataforma e dos professores que estão valendo agora. Toque no código para copiar."
      />

      <RegionBar regional={regional} className="mb-6" nomeItens={['promoção', 'promoções']} />

      {flagsCarregando || q.isLoading ? (
        <div className="space-y-3">
          <div className="aspect-[16/9] animate-pulse rounded-3xl bg-gray-100 sm:aspect-[2/1]" />
          <V2Skeleton lines={3} />
        </div>
      ) : q.isError ? (
        <V2ErrorState
          title="Não foi possível carregar as promoções"
          description="A conexão falhou — isso não quer dizer que não haja promoção no ar. Tente de novo em instantes."
          onRetry={() => q.refetch()}
        />
      ) : (
        <>
          {quem.falhou && professoresOn && (
            <V2ErrorState
              inline
              title="Não deu para conferir de quem você é aluno"
              description="Promoções só para alunos podem não aparecer."
              onRetry={() => quem.recarregar()}
            />
          )}

          {nada && !quem.falhou && (
            <V2Surface>
              <V2EmptyState
                icon={Tag}
                title={fora > 0 && filtraRegiao ? `Nenhuma promoção ${minha.frase} agora` : 'Nenhuma promoção no ar agora'}
                description={fora > 0 && filtraRegiao
                  ? `Há ${fora} em outras regiões — toque em "Ver também", acima, para vê-las.`
                  : 'Quando a plataforma ou um professor lançar um cupom ou campanha, ele aparece aqui — e na sua tela inicial, se for da sua região.'}
              />
            </V2Surface>
          )}

          {banners.length > 0 && (
            <section aria-labelledby="promo-destaques" className="space-y-3">
              <h2 id="promo-destaques" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <Megaphone className="h-5 w-5" aria-hidden /> Em destaque
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {banners.map((c) => <PromoCampaignBanner key={c.id} campaign={c} />)}
              </div>
            </section>
          )}

          {cuponsPlataforma.length > 0 && (
            <section aria-labelledby="promo-plataforma" className="space-y-3">
              <h2 id="promo-plataforma" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <Tag className="h-5 w-5" aria-hidden /> Da plataforma
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {cuponsPlataforma.map((c) => <PromoCouponCard key={c.id} coupon={c} />)}
              </div>
            </section>
          )}

          {cuponsProfessores.length > 0 && (
            <section aria-labelledby="promo-professores" className="space-y-3">
              <h2 id="promo-professores" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <GraduationCap className="h-5 w-5" aria-hidden /> Dos professores
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {cuponsProfessores.map((c) => <PromoCouponCard key={c.id} coupon={c} />)}
              </div>
              <p className="text-xs text-gray-500">
                O desconto na aula entra quando você informa o código ao{' '}
                <Link to="/coaches" className="font-semibold text-ink underline">pedir a aula</Link>.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
