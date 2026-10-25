/**
 * Loja do clube no Mercado (Bloco C3): o clube vende uniforme, material e
 * inscrições como vendedor próprio (`club_{id}`). Quem tem `finance` (ou
 * administra o clube) opera; o painel de vendas é o do Mercado, com o clube
 * escolhido em "Vendendo como". Aqui só o estado e o caminho até lá.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Store } from 'lucide-react';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { t } from '@/core/i18n';
import { isAssociationOpen } from '@/modules/clubs/domain/association';
import { useSeller } from '@/modules/marketplace/hooks/useMarket';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const AVISO = 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900';

export default function ClubStorePanel({ club }) {
  const mercadoOn = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  const chave = `club_${club.id}`;
  const vendedorQ = useSeller(chave);
  const aberta = isAssociationOpen(club);

  return (
    <section className="space-y-4" aria-label={t('Loja do clube no Mercado')} data-dica="clube-loja">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Loja do clube no Mercado')}</h2>
        <p className="text-sm text-gray-500">{t('O clube vende uniforme, material e inscrições pelo Mercado, como vendedor próprio. Quem administra o clube ou tem o cargo com "Financeiro" opera a loja. O Pix do pedido vai direto para a conta cadastrada na loja.')}</p>
      </div>
      {!mercadoOn ? (
        <p className={AVISO}>{t('O Mercado ainda não está aberto nesta plataforma. Assim que abrir, a loja do clube aparece aqui.')}</p>
      ) : !aberta ? (
        <p className={AVISO}>{t('A loja abre depois que a associação for publicada (Configurações → Associação do clube): os anúncios aparecem para todo mundo no Mercado.')}</p>
      ) : vendedorQ.isError ? (
        <V2ErrorState inline title={t('Não carregou a loja do clube')} onRetry={() => vendedorQ.refetch()} />
      ) : vendedorQ.isLoading ? (
        <V2Skeleton className="h-24" />
      ) : (
        <V2Surface className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-acid/30"><Store className="h-5 w-5 text-ink" aria-hidden="true" /></span>
            <p className="font-bold text-ink">{vendedorQ.data?.display_name || club.name}</p>
            <V2Badge tone={vendedorQ.data?.status === 'active' ? 'green' : 'neutral'}>{vendedorQ.data ? (vendedorQ.data.status === 'active' ? t('Loja no ar') : t('Loja pausada')) : t('Loja ainda não aberta')}</V2Badge>
          </div>
          <p className="text-sm text-gray-700">
            {vendedorQ.data
              ? t('Anúncios, pedidos, perguntas e o Pix ficam no painel do vendedor do Mercado, com o clube escolhido em "Vendendo como".')
              : t('Abra a loja no painel do Mercado: dê um nome, cadastre o Pix e publique o primeiro produto.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <V2Button asChild><Link to={`/mercado/vender?como=${chave}`}>{vendedorQ.data ? t('Abrir o painel da loja') : t('Abrir a loja do clube')}</Link></V2Button>
            {vendedorQ.data && <V2Button asChild variant="secondary"><Link to={`/mercado/vendedor/${chave}`}><ExternalLink className="h-4 w-4" />{t('Ver a vitrine')}</Link></V2Button>}
          </div>
        </V2Surface>
      )}
    </section>
  );
}
