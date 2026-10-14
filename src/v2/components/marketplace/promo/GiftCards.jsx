/**
 * Vale-presente e cupons da loja, do lado de quem compra: a arte do vale (que
 * também vira imagem para mandar a quem ganha), o diálogo de dar um vale e a
 * lista de cupons divulgados de uma loja.
 */
import React, { forwardRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Gift, TicketPercent } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  GIFT_CARD_LIMITS, couponBenefitLabel, couponConditionsLabel, couponLive, giftCardAmountProblem, giftCardConfig,
} from '@/modules/marketplace/domain/promotions';
import { formatBRL, parseBRL } from '@/modules/marketplace/domain/money';
import { giftCardAction } from '@/modules/marketplace/services/marketOrderService';
import { findCoupon } from '@/modules/marketplace/services/marketService';
import { savePendingCoupon } from '@/modules/marketplace/services/pendingCoupon';
import { useMarketMutation, usePublicCoupons } from '@/modules/marketplace/hooks/useMarket';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { V2Button, V2Field, V2FilterChip, V2Input, V2Textarea } from '@/v2/ui/primitives';

/** A arte do vale. Com `code`, é o vale de verdade (para mandar a quem ganha). */
export const GiftCardArt = forwardRef(function GiftCardArt({ storeName, logoUrl, amountCents, recipient, from, message, code, qr, className = '' }, ref) {
  return (
    <div ref={ref} className={`tema-claro mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl bg-ink p-6 text-white ${className}`} style={{ aspectRatio: '8 / 5' }}>
      <div className="flex h-full flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-acid">Vale-presente</p>
            <p className="truncate font-display text-lg font-bold">{storeName || 'Mercado PickleRush'}</p>
          </div>
          {logoUrl
            ? <img src={logoUrl} alt="" crossOrigin="anonymous" className="h-11 w-11 shrink-0 rounded-full bg-white object-cover" />
            : <Gift className="h-9 w-9 shrink-0 text-acid" />}
        </div>
        <p className="font-display text-4xl font-bold">{formatBRL(amountCents)}</p>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 text-sm">
            {recipient && <p className="truncate">Para <span className="font-bold">{recipient}</span></p>}
            {from && <p className="truncate text-white/80">De {from}</p>}
            {message && <p className="line-clamp-2 text-xs italic text-white/80">“{message}”</p>}
            {code && <p className="mt-1 font-display text-sm font-bold tracking-widest text-acid">{code}</p>}
          </div>
          {qr && <img src={qr} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-white p-1" />}
        </div>
      </div>
    </div>
  );
});

/** Dar um vale-presente desta loja (vira um pedido: paga-se pelo Pix da loja). */
export function GiftCardBuyDialog({ open, onOpenChange, seller, onBought }) {
  const { userProfile } = useAuth();
  const cfg = giftCardConfig(seller);
  const [valor, setValor] = useState(cfg.amounts_cents[1] || cfg.amounts_cents[0]);
  const [outro, setOutro] = useState('');
  const [para, setPara] = useState('');
  const [de, setDe] = useState(userProfile?.platform_name || userProfile?.full_name || '');
  const [msg, setMsg] = useState('');
  const m = useMarketMutation(giftCardAction);
  const cents = outro ? parseBRL(outro) : valor;
  const problema = cents ? giftCardAmountProblem(cfg, cents) : 'Escolha o valor.';

  const comprar = () => {
    if (problema) { toast.error(problema); return; }
    m.mutate({ action: 'buy', seller_key: seller.seller_key || seller.id, amount_cents: cents, recipient_name: para, from_name: de, message: msg }, {
      onSuccess: (r) => { onOpenChange(false); onBought?.(r); },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" sheet>
        <DialogHeader>
          <DialogTitle>Dar um vale-presente</DialogTitle>
          <DialogDescription>Quem ganha escolhe o que quiser em {seller.display_name}. Vale {cfg.validity_months} meses.</DialogDescription>
        </DialogHeader>
        <GiftCardArt storeName={seller.display_name} logoUrl={seller.logo_url} amountCents={cents || 0} recipient={para} from={de} message={msg} />
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">Valor</legend>
          <div className="flex flex-wrap gap-2">
            {cfg.amounts_cents.map((v) => (
              <V2FilterChip key={v} active={!outro && valor === v} onClick={() => { setValor(v); setOutro(''); }}>{formatBRL(v)}</V2FilterChip>
            ))}
          </div>
          {cfg.allow_custom && (
            <V2Field label="Outro valor" htmlFor="vale-outro" hint={`De ${formatBRL(GIFT_CARD_LIMITS.minCents)} a ${formatBRL(GIFT_CARD_LIMITS.maxCents)}.`} className="mt-3">
              <V2Input id="vale-outro" inputMode="decimal" placeholder="0,00" value={outro} onChange={(e) => setOutro(e.target.value)} />
            </V2Field>
          )}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label="Para (opcional)" htmlFor="vale-para"><V2Input id="vale-para" maxLength={GIFT_CARD_LIMITS.name} value={para} onChange={(e) => setPara(e.target.value)} /></V2Field>
          <V2Field label="De" htmlFor="vale-de"><V2Input id="vale-de" maxLength={GIFT_CARD_LIMITS.name} value={de} onChange={(e) => setDe(e.target.value)} /></V2Field>
        </div>
        <V2Field label="Mensagem (opcional)" htmlFor="vale-msg">
          <V2Textarea id="vale-msg" rows={2} maxLength={GIFT_CARD_LIMITS.message} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Bom jogo!" className="min-h-0" />
        </V2Field>
        {cfg.note && <p className="text-xs text-gray-500">{cfg.note}</p>}
        <p className="text-xs text-gray-500">O pedido já sai aceito: você paga pelo Pix da loja e, quando ela confirmar, o vale aparece em <Link to="/mercado/vales" className="font-bold text-ink underline">Vales-presente</Link>, pronto para mandar.</p>
        <V2Button type="button" size="lg" className="w-full" disabled={m.isPending || !!problema} onClick={comprar}>
          {m.isPending ? 'Fazendo o pedido…' : `Comprar vale de ${formatBRL(cents || 0)}`}
        </V2Button>
      </DialogContent>
    </Dialog>
  );
}

/** O cupom que veio no link (`?cupom=`): dito no topo e guardado para o carrinho. */
function SharedCoupon({ sellerKey, code }) {
  const q = useQuery({ queryKey: ['market', 'coupon', sellerKey, code], queryFn: () => findCoupon(sellerKey, code), enabled: Boolean(sellerKey && code), staleTime: 60000 });
  const c = q.data;
  const vale = c && couponLive(c);
  useEffect(() => { if (vale) savePendingCoupon(sellerKey, c.code); }, [vale, sellerKey, c?.code]);
  if (!code || q.isLoading) return null;
  if (q.isError) return <p role="status" className="text-sm text-gray-600">Não deu para conferir o cupom {code} agora. Ele pode ser digitado no carrinho.</p>;
  if (!vale) return <p role="status" className="rounded-2xl bg-paper px-4 py-3 text-sm text-gray-600">O cupom {code} do link não vale mais nesta loja. Os produtos continuam à venda.</p>;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-ink bg-acid/20 px-4 py-3">
      <TicketPercent className="h-5 w-5 shrink-0 text-ink" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="block font-bold text-ink">{couponBenefitLabel(c)} com o cupom {c.code}</span>
        <span className="block text-gray-600">{couponConditionsLabel(c) ? `${couponConditionsLabel(c)} · ` : ''}Ele já entra aplicado no carrinho desta loja.</span>
      </p>
      <CopyCodeButton code={c.code} size="sm" successMessage="Cupom copiado." />
    </div>
  );
}

/** Os cupons divulgados de uma loja, para copiar. Some quando não há nenhum (nem cupom de link). */
export function StoreCoupons({ sellerKey, title = 'Cupons desta loja', compact = false, sharedCode = '' }) {
  const q = usePublicCoupons(sellerKey);
  const lista = (q.data || []).filter((c) => couponLive(c) && c.code !== sharedCode);
  if (!lista.length && !sharedCode) return null;
  return (
    <section aria-label={title} className="space-y-2">
      {sharedCode && <SharedCoupon sellerKey={sellerKey} code={sharedCode} />}
      {lista.length > 0 && (
        <>
          <h2 className={compact ? 'flex items-center gap-2 text-sm font-bold text-ink' : 'flex items-center gap-2 font-display text-lg font-bold text-ink'}>
            <TicketPercent className="h-4 w-4" /> {title}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {lista.slice(0, compact ? 2 : 6).map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-dashed border-ink bg-paper px-3 py-2">
                <span className="min-w-0 text-sm">
                  <span className="block font-bold text-ink">{couponBenefitLabel(c)}</span>
                  <span className="block text-xs text-gray-500">{c.description || couponConditionsLabel(c) || 'Use no carrinho'}</span>
                </span>
                <CopyCodeButton code={c.code} size="sm" successMessage="Cupom copiado. Cole no carrinho." />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
