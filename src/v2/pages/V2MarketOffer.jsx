/**
 * V2MarketOffer — uma negociação (`/mercado/ofertas/:offerId`), para quem
 * ofereceu e para quem vende. Os botões saem de `offerActionsFor` (a mesma
 * tabela do servidor); aceita, a oferta vira pedido e a tela leva até ele.
 */
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { offerActionsFor } from '@/modules/marketplace/domain/offers';
import { OFFER_STATUS_LABELS } from '@/modules/marketplace/domain/constants';
import { formatBRL, parseBRL } from '@/modules/marketplace/domain/money';
import { offerAction } from '@/modules/marketplace/services/marketOrderService';
import { useIsMarketOperator, useMarketMutation, useOffer } from '@/modules/marketplace/hooks/useMarket';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2BackLink, V2Skeleton, V2Surface, V2Page,
} from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { MarketGate, fulfillmentLabel } from '@/v2/components/marketplace/marketUi';
import { t, fmtData } from '@/core/i18n';

const dataHora = (ms) => (ms ? fmtData(ms, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function OfferPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const q = useOffer(offerId);
  const offer = q.data;
  const operador = useIsMarketOperator(offer?.seller_key);
  const role = offer && (offer.buyer_uid === user?.uid ? 'buyer' : operador ? 'seller' : null);
  const [valor, setValor] = useState('');
  const [contra, setContra] = useState(null);
  const [erro, setErro] = useState('');
  const m = useMarketMutation(offerAction);

  const agir = (id) => {
    const precisaValor = id === 'counter' || id === 'counter_back';
    if (precisaValor && contra !== id) { setContra(id); setErro(''); return; }
    const amount = precisaValor ? parseBRL(valor) : undefined;
    if (precisaValor && !(amount > 0)) { setErro(t('Diga o valor.')); return; }
    m.mutate({ action: id, offerId, ...(precisaValor ? { amount_cents: amount } : {}) }, {
      onSuccess: (r) => {
        setContra(null); setValor('');
        if (r?.orderId) {
          toast.success(t('Oferta aceita: o pedido foi criado.'));
          navigate(role === 'seller' ? `/mercado/vendas/${r.orderId}` : `/mercado/pedidos/${r.orderId}`);
        } else toast.success(t('Pronto. O outro lado foi avisado.'));
      },
      onError: (e) => setErro(e.message),
    });
  };

  let corpo;
  if (q.isError) corpo = <V2ErrorState onRetry={() => q.refetch()} />;
  else if (q.isLoading) corpo = <V2Skeleton className="h-72" />;
  else if (!offer || !role) {
    corpo = (
      <V2Surface className="text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('Oferta não disponível')}</h1>
        <p className="mt-2 text-gray-500">{t('Esta negociação não existe ou não é da sua conta.')}</p>
        <Link to="/mercado/pedidos?aba=ofertas" className="mt-4 inline-flex font-bold text-ink underline">{t('Ver minhas ofertas')}</Link>
      </V2Surface>
    );
  } else {
    const acoes = offerActionsFor(offer, role);
    const expirou = Number(offer.expires_at_ms) && Date.now() > Number(offer.expires_at_ms) && ['pending', 'countered'].includes(offer.status);
    const vez = offer.status === 'pending' ? 'seller' : offer.status === 'countered' ? 'buyer' : null;
    const valores = (offer.history || []).filter((h) => h.amount_cents);
    corpo = (
      <div className="grid gap-6 lg:grid-cols-12">
        <V2Surface className="space-y-5 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{role === 'seller' ? t('Oferta de {nome}', { nome: offer.buyer_name || t('um comprador') }) : t('Sua oferta')}</p>
              <Link to={`/mercado/anuncio/${offer.listing_id}`} className="font-display text-xl font-bold text-ink hover:underline">{offer.listing_title}</Link>
              <p className="text-sm text-gray-500">{t('Anunciado por {valor}', { valor: formatBRL(offer.list_price_cents) })} · {fulfillmentLabel(offer.fulfillment)}</p>
            </div>
            <V2Badge tone={offer.status === 'ordered' || offer.status === 'accepted' ? 'green' : vez ? 'amber' : 'neutral'}>{expirou ? t('Expirada') : OFFER_STATUS_LABELS[offer.status] ? t(OFFER_STATUS_LABELS[offer.status]) : offer.status}</V2Badge>
          </div>
          <div className="rounded-2xl bg-paper p-4">
            <p className="text-xs text-gray-500">{t('Valor em negociação')}</p>
            <p className="font-display text-3xl font-bold text-ink">{formatBRL(offer.amount_cents)}</p>
            {vez && !expirou && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3.5 w-3.5" />
                {vez === role
                  ? t('É a sua vez de responder até {data}', { data: dataHora(offer.expires_at_ms) })
                  : vez === 'seller'
                    ? t('Esperando o vendedor até {data}', { data: dataHora(offer.expires_at_ms) })
                    : t('Esperando o comprador até {data}', { data: dataHora(offer.expires_at_ms) })}
              </p>
            )}
          </div>
          {offer.message && <p className="rounded-2xl border border-gray-100 p-4 text-sm text-gray-700"><span className="block text-xs text-gray-500">{t('Recado do comprador')}</span>{offer.message}</p>}
          {offer.status === 'ordered' && offer.order_id && (
            <V2Button asChild><Link to={role === 'seller' ? `/mercado/vendas/${offer.order_id}` : `/mercado/pedidos/${offer.order_id}`}>{t('Ver o pedido')}</Link></V2Button>
          )}
          {acoes.length > 0 && !expirou && (
            <div className="space-y-3">
              {contra && (
                <V2Field label={contra === 'counter' ? t('Sua contraproposta') : t('Sua nova oferta')} htmlFor="contra-valor" hint={contra === 'counter' ? t('Entre a oferta e o preço anunciado.') : t('Maior que a sua oferta anterior e menor que a contraproposta.')}>
                  <V2Input id="contra-valor" inputMode="decimal" placeholder={t('R$ 0,00')} value={valor} onChange={(e) => { setValor(e.target.value); setErro(''); }} autoFocus />
                </V2Field>
              )}
              {erro && <p role="alert" className="text-sm font-medium text-red-500">{erro}</p>}
              <div className="flex flex-wrap gap-2">
                {acoes.map((a) => (
                  <V2Button
                    key={a.id}
                    type="button"
                    disabled={m.isPending}
                    variant={['decline', 'withdraw'].includes(a.id) ? 'danger' : a.id.startsWith('accept') ? 'primary' : 'secondary'}
                    onClick={() => agir(a.id)}
                  >
                    {contra === a.id ? t('Enviar') : a.label}
                  </V2Button>
                ))}
                {contra && <V2Button type="button" variant="ghost" onClick={() => { setContra(null); setErro(''); }}>{t('Voltar')}</V2Button>}
              </div>
            </div>
          )}
        </V2Surface>
        <aside className="lg:col-span-4">
          <V2Surface variant="compacto" as="section" aria-labelledby="neg-titulo" className="p-5">
            <h2 id="neg-titulo" className="mb-3 font-bold text-ink">{t('A negociação')}</h2>
            <ol className="space-y-3">
              {valores.map((h, i) => (
                <li key={`${h.at_ms}-${i}`} className={cn('flex items-center justify-between gap-2 text-sm', h.by === role && 'font-bold')}>
                  <span className="text-gray-600">{h.by === role ? t('Você') : h.by === 'seller' ? t('Vendedor') : t('Comprador')} · {dataHora(h.at_ms)}</span>
                  <span className="text-ink">{formatBRL(h.amount_cents)}</span>
                </li>
              ))}
            </ol>
          </V2Surface>
        </aside>
      </div>
    );
  }

  return (
    <V2Page className="space-y-6 pb-16">
      {role !== 'seller' && <MarketHeader categorias={false} />}
      {role === 'seller'
        ? <V2BackLink to="/mercado/vender?aba=ofertas">{t('Ofertas recebidas')}</V2BackLink>
        : <V2BackLink to="/mercado/pedidos?aba=ofertas">{t('Minhas ofertas')}</V2BackLink>}
      {corpo}
    </V2Page>
  );
}

export default function V2MarketOffer() {
  return <MarketGate><OfferPage /></MarketGate>;
}
