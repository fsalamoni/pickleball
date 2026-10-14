/**
 * MERCADO — "Fazer oferta": o comprador propõe um valor; o vendedor aceita,
 * recusa ou contrapropõe. Aceita, vira pedido pelo valor combinado (no
 * servidor). A conferência do valor é a mesma do servidor (`validateOfferAmount`).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatBRL, parseBRL } from '@/modules/marketplace/domain/money';
import { validateOfferAmount, OFFER_RULES } from '@/modules/marketplace/domain/offers';
import { offerAction } from '@/modules/marketplace/services/marketOrderService';
import { useMarketMutation } from '@/modules/marketplace/hooks/useMarket';
import { V2Button, V2Field, V2Input, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { fulfillmentLabel } from './marketUi';

export default function OfferDialog({ listing, open, onOpenChange }) {
  const navigate = useNavigate();
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState('');
  const [entrega, setEntrega] = useState((listing.fulfillment || [])[0] || 'meetup');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(offerAction);

  const enviar = (e) => {
    e.preventDefault();
    const cents = parseBRL(valor);
    const err = validateOfferAmount(listing, cents);
    if (err) { setErro(err); return; }
    m.mutate({ action: 'create', listingId: listing.id, amount_cents: cents, fulfillment: entrega, message: msg }, {
      onSuccess: (r) => {
        toast.success('Oferta enviada. Você recebe um aviso quando o vendedor responder.');
        onOpenChange(false);
        navigate(`/mercado/ofertas/${r.id}`);
      },
      onError: (er) => setErro(er.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>Fazer uma oferta</DialogTitle>
        <DialogDescription>
          Preço anunciado: <strong className="text-ink">{formatBRL(listing.price_cents)}</strong>. O vendedor tem {OFFER_RULES.ttlHours} h para responder.
        </DialogDescription>
        <form onSubmit={enviar} className="space-y-4">
          <V2Field label="Quanto você oferece?" htmlFor="oferta-valor" error={erro}>
            <V2Input id="oferta-valor" inputMode="decimal" autoFocus placeholder="R$ 0,00" value={valor} onChange={(e) => { setValor(e.target.value); setErro(''); }} />
          </V2Field>
          {(listing.fulfillment || []).length > 1 && (
            <V2Field label="Como quer receber" htmlFor="oferta-entrega">
              <V2Select id="oferta-entrega" value={entrega} onChange={(e) => setEntrega(e.target.value)}>
                {listing.fulfillment.map((f) => <option key={f} value={f}>{fulfillmentLabel(f)}</option>)}
              </V2Select>
            </V2Field>
          )}
          <V2Field label="Mensagem (opcional)" htmlFor="oferta-msg" hint="Sem telefone nem Pix: o pagamento é combinado pelo pedido.">
            <V2Textarea id="oferta-msg" rows={2} maxLength={300} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{m.isPending ? 'Enviando…' : 'Enviar oferta'}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
