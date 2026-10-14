/**
 * Cupom e vale-presente no fechamento, vendedor a vendedor. A conta mostrada
 * é a do domínio (`orderPricing`) — a mesma que o servidor refaz ao gravar o
 * pedido; se algo mudou no meio (o cupom acabou), o pedido daquele vendedor
 * volta com o motivo, nunca mais caro do que a tela mostrou.
 */
import React, { useState } from 'react';
import { Gift, TicketPercent, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { couponBenefitLabel, couponConditionsLabel, maskGiftCardCode, normalizeCouponCode } from '@/modules/marketplace/domain/promotions';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { findCoupon, getMyCouponUses } from '@/modules/marketplace/services/marketService';
import { V2Button, V2Input } from '@/v2/ui/primitives';

/**
 * @param {{ sellerKey: string, choice: object, patch: (p: object) => void,
 *   giftCards: object[], pricing: object, couponError: string|null,
 *   publicCoupons?: object[] }} props
 */
export default function CheckoutPromos({ sellerKey, choice, patch, giftCards = [], pricing, couponError, publicCoupons = [] }) {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const aplicado = choice.coupon;

  const aplicar = async (codigo) => {
    const code = normalizeCouponCode(codigo);
    if (code.length < 3) { toast.error('Digite o código do cupom.'); return; }
    setBusy(true);
    try {
      const c = await findCoupon(sellerKey, code);
      const uses = c ? await getMyCouponUses(c.id, user?.uid) : 0;
      patch({ couponCode: code, coupon: c || false, couponUses: uses });
      if (!c) toast.error('Não achamos este cupom nesta loja. Confira o código.');
      setTexto('');
    } catch {
      toast.error('Não foi possível conferir o cupom agora. Tente de novo.');
    } finally { setBusy(false); }
  };

  const giftIds = choice.giftIds || [];
  const toggleGift = (id) => patch({ giftIds: giftIds.includes(id) ? giftIds.filter((x) => x !== id) : [...giftIds, id].slice(0, 5) });
  const sugestoes = publicCoupons.filter((c) => c.code !== aplicado?.code).slice(0, 3);

  return (
    <div className="space-y-3 rounded-2xl bg-paper p-4">
      {aplicado ? (
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2 text-sm">
            <TicketPercent className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            <span className="min-w-0">
              <span className="font-bold text-ink">{aplicado.code}</span> · {couponBenefitLabel(aplicado)}
              {couponError
                ? <span role="alert" className="block text-xs font-medium text-red-600">{couponError}</span>
                : <span className="block text-xs text-green-700">Aplicado: −{formatBRL(pricing.discount_cents + pricing.shipping_discount_cents)}</span>}
              {couponConditionsLabel(aplicado) && <span className="block text-xs text-gray-500">{couponConditionsLabel(aplicado)}</span>}
            </span>
          </p>
          <button type="button" aria-label="Tirar o cupom" onClick={() => patch({ coupon: null, couponCode: '', couponUses: 0 })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); aplicar(texto); }}>
          <label htmlFor={`cupom-${sellerKey}`} className="sr-only">Cupom desta loja</label>
          <V2Input id={`cupom-${sellerKey}`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Tem cupom desta loja?" autoCapitalize="characters" className="flex-1 uppercase" />
          <V2Button type="submit" variant="ghost" disabled={busy}>{busy ? 'Conferindo…' : 'Aplicar'}</V2Button>
        </form>
      )}
      {aplicado === false && <p role="alert" className="text-xs font-medium text-red-600">Este código não vale nesta loja. Confira as letras.</p>}
      {!aplicado && sugestoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Cupons da loja:</span>
          {sugestoes.map((c) => (
            <button key={c.id} type="button" disabled={busy} onClick={() => aplicar(c.code)} className="min-h-9 rounded-full border border-dashed border-ink px-3 font-bold text-ink hover:bg-paper-pure">
              {c.code} · {couponBenefitLabel(c)}
            </button>
          ))}
        </div>
      )}
      {giftCards.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="flex items-center gap-2 text-sm font-bold text-ink"><Gift className="h-4 w-4" /> Usar vale-presente desta loja</legend>
          {giftCards.map((c) => (
            <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-ink" checked={giftIds.includes(c.id)} onChange={() => toggleGift(c.id)} />
              <span className="flex-1">Vale {maskGiftCardCode(c.code)} · saldo {formatBRL(c.balance_cents)}</span>
            </label>
          ))}
          {pricing.gift_card_cents > 0 && <p className="text-xs text-green-700">Vale-presente: −{formatBRL(pricing.gift_card_cents)}. O que sobrar fica no vale.</p>}
        </fieldset>
      )}
    </div>
  );
}
