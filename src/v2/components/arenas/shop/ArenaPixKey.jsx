/**
 * A chave Pix da arena, para pagar o pedido pelo celular (módulo
 * `pdv_pix_native`). Some quando a arena não configurou o Pix.
 */
import React from 'react';
import { toast } from 'sonner';
import { Copy, QrCode } from 'lucide-react';
import { isPixConfigured, PIX_KEY_TYPE_LABELS } from '@/modules/arenas/domain/pix_payment';
import { V2Badge, V2Button } from '@/v2/ui/primitives';

export default function ArenaPixKey({ arena, className = 'mt-3' }) {
  const payment = arena?.payment;
  if (!isPixConfigured(payment) || payment.active === false) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(payment.pix_key);
      toast.success('Chave Pix copiada.');
    } catch {
      toast.error(`Não foi possível copiar. A chave é: ${payment.pix_key}`);
    }
  };

  return (
    <div className={`${className} rounded-2xl border border-gray-100 bg-paper p-3`}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
        <QrCode className="h-3.5 w-3.5" /> Pague por Pix
      </p>
      {payment.pix_key && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="break-all rounded-xl bg-paper-pure px-3 py-1.5 text-sm text-ink">{payment.pix_key}</code>
          <V2Badge tone="neutral">
            {PIX_KEY_TYPE_LABELS[payment.pix_key_type] || payment.pix_key_type}
          </V2Badge>
          <V2Button size="sm" variant="ghost" onClick={copiar}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
          </V2Button>
        </div>
      )}
      {payment.receiver_name && (
        <p className="mt-1 text-xs text-gray-500">Recebedor: <strong className="text-ink">{payment.receiver_name}</strong></p>
      )}
      {payment.qr_code_url && (
        <img src={payment.qr_code_url} alt="QR Code Pix da arena"
          className="mt-2 h-40 w-40 rounded-xl border border-gray-100 object-contain" />
      )}
      <p className="mt-2 text-xs text-gray-500">
        Depois de pagar, a arena confirma o recebimento — o pedido aparece como pago.
      </p>
    </div>
  );
}
