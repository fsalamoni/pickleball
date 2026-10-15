/**
 * V2MarketGiftCards — os vales-presente da pessoa (`/mercado/vales`): resgatar
 * um código (também por `?codigo=`, o link que vem no cartão), os vales para
 * usar e os que ela comprou para dar — com o cartão para mandar a quem ganha.
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Gift, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { GIFT_CARD_STATUS, maskGiftCardCode, normalizeGiftCardCode } from '@/modules/marketplace/domain/promotions';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { giftCardAction } from '@/modules/marketplace/services/marketOrderService';
import { useMarketMutation, useMyGiftCards } from '@/modules/marketplace/hooks/useMarket';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Input, V2Page, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import MarketTabs from '@/v2/components/marketplace/MarketTabs';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { MarketGate } from '@/v2/components/marketplace/marketUi';
import ShareImageDialog from '@/v2/components/marketplace/promo/ShareImageDialog';
import { GiftCardArt } from '@/v2/components/marketplace/promo/GiftCards';
import { t, fmtData } from '@/core/i18n';

const vence = (ms) => (ms ? fmtData(ms, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

function situacao(c, now = Date.now()) {
  if (c.status === GIFT_CARD_STATUS.CANCELLED) return { label: t('Cancelado'), tone: 'red', usavel: false };
  if (c.expires_at_ms && now > c.expires_at_ms) return { label: t('Venceu'), tone: 'neutral', usavel: false };
  if (!(c.balance_cents > 0)) return { label: t('Usado'), tone: 'neutral', usavel: false };
  return { label: t('Para usar'), tone: 'green', usavel: true };
}

function Redeem({ initial }) {
  const [codigo, setCodigo] = useState(initial || '');
  const m = useMarketMutation(giftCardAction);
  const resgatar = (e) => {
    e?.preventDefault();
    if (!normalizeGiftCardCode(codigo)) { toast.error(t('Confira o código: PRK seguido de 12 letras e números.')); return; }
    m.mutate({ action: 'claim', code: codigo }, {
      onSuccess: (r) => { setCodigo(''); toast.success(r.already ? t('Este vale já está na sua conta.') : t('Vale de {valor} em {loja} na sua conta.', { valor: formatBRL(r.balance_cents), loja: r.seller_name })); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <V2Surface variant="compacto" as="section" aria-labelledby="resgatar-titulo" className="space-y-3 p-5">
      <h2 id="resgatar-titulo" className="font-display text-lg font-bold text-ink">{t('Ganhou um vale?')}</h2>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={resgatar}>
        <label htmlFor="codigo-vale" className="sr-only">{t('Código do vale')}</label>
        <V2Input id="codigo-vale" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder={t('PRK-XXXX-XXXX-XXXX')} autoCapitalize="characters" className="flex-1 font-display tracking-widest" />
        <V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Resgatando…') : t('Resgatar')}</V2Button>
      </form>
      <p className="text-xs text-gray-500">{t('O vale passa para a sua conta e aparece no carrinho na hora de pagar, na loja que o emitiu.')}</p>
    </V2Surface>
  );
}

function UseMyself({ code }) {
  const m = useMarketMutation(giftCardAction);
  return (
    <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ action: 'claim', code }, {
      onSuccess: () => toast.success(t('Vale na sua conta, pronto para usar.')), onError: (e) => toast.error(e.message),
    })}
    >{t('Usar eu mesmo')}</V2Button>
  );
}

function SendDialog({ card, onClose }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/mercado/vales?codigo=${encodeURIComponent(card.code)}` : '';
  return (
    <ShareImageDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('Mandar o vale-presente')}
      description={t('Quem receber resgata pelo link ou digitando o código. Mande só para quem vai ganhar: o código vale como dinheiro na loja.')}
      url={url}
      fileName={`vale-${card.seller_key}.png`}
      shareText={card.from_name
        ? t('{nome} te deu um vale-presente de {valor} em {loja} no Mercado PickleRush! Código: {codigo}', { nome: card.from_name, valor: formatBRL(card.initial_cents), loja: card.seller_name, codigo: card.code })
        : t('Você ganhou um vale-presente de {valor} em {loja} no Mercado PickleRush! Código: {codigo}', { valor: formatBRL(card.initial_cents), loja: card.seller_name, codigo: card.code })}
      renderCard={({ ref, qr }) => (
        <GiftCardArt ref={ref} storeName={card.seller_name} amountCents={card.initial_cents} recipient={card.recipient_name} from={card.from_name} message={card.message} code={card.code} qr={qr} />
      )}
    />
  );
}

function GiftPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const q = useMyGiftCards(user?.uid);
  const [mandar, setMandar] = useState(null);
  const [historico, setHistorico] = useState(false);
  const inicial = params.get('codigo') || '';
  useEffect(() => { if (inicial) window.scrollTo?.({ top: 0 }); }, [inicial]);

  let corpo;
  if (q.isError) corpo = <V2ErrorState onRetry={() => q.refetch()} />;
  else if (q.isLoading) corpo = <V2Skeleton lines={4} />;
  else {
    const todos = q.data || [];
    // O vale que comprei e ninguém resgatou é para DAR: não entra em "para usar"
    // (nem no carrinho) até eu resgatá-lo para mim.
    const paraDar = (c) => c.buyer_uid === user?.uid && !c.claimed_at_ms;
    const meus = todos.filter((c) => c.holder_uid === user?.uid && !paraDar(c));
    const usar = meus.filter((c) => situacao(c).usavel);
    const dados = todos.filter((c) => c.buyer_uid === user?.uid && (c.holder_uid !== user?.uid || !c.claimed_at_ms));
    const passados = meus.filter((c) => !situacao(c).usavel);
    corpo = (
      <div className="space-y-8">
        <section aria-labelledby="usar-titulo" className="space-y-3">
          <h2 id="usar-titulo" className="font-display text-xl font-bold text-ink">{t('Para usar')} {usar.length > 0 && <span className="text-gray-500">({usar.length})</span>}</h2>
          {!usar.length ? (
            <V2EmptyState icon={Gift} title={t('Nenhum vale para usar')} description={t('Quando você ganhar ou resgatar um vale, ele aparece aqui e no carrinho da loja.')} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {usar.map((c) => (
                <li key={c.id} className="space-y-2">
                  <GiftCardArt storeName={c.seller_name} amountCents={c.balance_cents} from={c.from_name} message={c.message} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600">{t('Saldo de {valor}', { valor: formatBRL(c.initial_cents) })}{c.expires_at_ms ? ` · ${t('vence {data}', { data: vence(c.expires_at_ms) })}` : ''}</span>
                    <V2Button asChild size="sm"><Link to={`/mercado/vendedor/${c.seller_key}`}>{t('Usar na loja')}</Link></V2Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {dados.length > 0 && (
          <section aria-labelledby="dar-titulo" className="space-y-3">
            <h2 id="dar-titulo" className="font-display text-xl font-bold text-ink">{t('Que você comprou para dar')}</h2>
            <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
              {dados.map((c) => {
                const entregue = c.holder_uid && c.holder_uid !== user?.uid;
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">{t('{valor} em {loja}', { valor: formatBRL(c.initial_cents), loja: c.seller_name })}</span>
                      <span className="block text-xs text-gray-500">{c.recipient_name ? `${t('Para {nome}', { nome: c.recipient_name })} · ` : ''}{entregue ? t('Já resgatado por quem ganhou') : `${t('Ainda não resgatado')} · ${maskGiftCardCode(c.code)}`}</span>
                    </span>
                    {entregue ? <V2Badge tone="green">{t('Entregue')}</V2Badge> : (
                      <span className="flex flex-wrap gap-2">
                        <CopyCodeButton code={c.code} size="sm" successMessage={t('Código copiado. Mande a quem vai ganhar.')} />
                        <V2Button type="button" size="sm" onClick={() => setMandar(c)}><Send className="h-4 w-4" /> {t('Mandar')}</V2Button>
                        <UseMyself code={c.code} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {passados.length > 0 && (
          <section className="space-y-2">
            <button type="button" onClick={() => setHistorico((h) => !h)} aria-expanded={historico} className="text-sm font-bold text-ink underline">
              {historico ? t('Esconder vales usados, vencidos e cancelados ({n})', { n: passados.length }) : t('Ver vales usados, vencidos e cancelados ({n})', { n: passados.length })}
            </button>
            {historico && (
              <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
                {passados.map((c) => {
                  const s = situacao(c);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                      <span>{t('{valor} em {loja}', { valor: formatBRL(c.initial_cents), loja: c.seller_name })} · {maskGiftCardCode(c.code)}</span>
                      <V2Badge tone={s.tone}>{s.label}</V2Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <V2Page className="space-y-6">
      <MarketHeader categorias={false} />
      <V2PageIntro title={t('Minhas compras')} subtitle={t('Vales-presente: os que você ganhou, os que você deu e o resgate de um código.')} />
      <MarketTabs grupo="compras" ativo="vales" />
      <Redeem initial={inicial} />
      {corpo}
      {mandar && <SendDialog card={mandar} onClose={() => setMandar(null)} />}
    </V2Page>
  );
}

export default function V2MarketGiftCards() {
  return <MarketGate><GiftPage /></MarketGate>;
}
