import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Copy, Info } from 'lucide-react';
import { buildPixPayload, formatBrlCents } from '@/modules/tournament/domain/payment';
import { useDeclareRegistrationPayment } from '@/modules/tournament/hooks/useTournament';

/**
 * Instruções de pagamento por PIX de uma inscrição (flag payment_instructions).
 *
 * Mostra valor, QR Code e o código "copia e cola" gerados a partir da chave
 * PIX configurada no torneio. O inscrito pode declarar "já paguei" — a
 * confirmação continua manual, pelo admin, como hoje.
 */
export function PixPaymentContent({ tournament, modality, registrationId, paymentDeclared = false, onDone }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [declared, setDeclared] = useState(paymentDeclared);
  const declareMutation = useDeclareRegistrationPayment(modality?.id);

  const payload = useMemo(() => buildPixPayload({
    key: tournament?.payment_pix_key,
    merchantName: tournament?.payment_pix_name || tournament?.name,
    merchantCity: tournament?.payment_pix_city || tournament?.city,
    amountCents: modality?.entry_fee_cents,
  }), [tournament, modality]);

  useEffect(() => {
    let active = true;
    if (!payload) {
      setQrDataUrl(null);
      return undefined;
    }
    // Import dinâmico: mantém a lib de QR fora do bundle das páginas de
    // torneio enquanto o conteúdo de pagamento não é exibido.
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(payload, { width: 240, margin: 1 }))
      .then((url) => { if (active) setQrDataUrl(url); })
      .catch(() => { if (active) setQrDataUrl(null); });
    return () => { active = false; };
  }, [payload]);

  if (!payload) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Código PIX copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }

  async function handleDeclare() {
    try {
      await declareMutation.mutateAsync(registrationId);
      setDeclared(true);
      toast.success('Obrigado! O organizador foi avisado e vai confirmar o pagamento.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar. Tente novamente.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-paper p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Valor da inscrição</p>
        <p className="mt-1 text-3xl font-bold text-ink">{formatBrlCents(modality?.entry_fee_cents)}</p>
        <p className="mt-1 text-xs text-gray-500">{modality?.name}</p>
      </div>

      {qrDataUrl && (
        <div className="flex justify-center">
          <img src={qrDataUrl} alt="QR Code do PIX" className="h-56 w-56 rounded-xl border border-gray-100" />
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-gray-500">PIX copia e cola</p>
        <div className="flex items-start gap-2">
          <textarea
            readOnly
            value={payload}
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 bg-paper px-3 py-2 font-mono text-xs text-gray-600"
            onFocus={(e) => e.target.select()}
          />
          <Button type="button" variant="outline" size="icon" onClick={handleCopy} title="Copiar código PIX" aria-label="Copiar código PIX">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {tournament?.payment_instructions && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="whitespace-pre-line">{tournament.payment_instructions}</p>
        </div>
      )}

      {declared ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Pagamento informado — aguarde a confirmação do organizador.
        </div>
      ) : (
        <p className="text-xs leading-5 text-gray-500">
          Após pagar, toque em &quot;Já paguei&quot; para avisar o organizador. A inscrição é confirmada
          quando ele conferir o pagamento.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {!declared && registrationId && (
          <Button type="button" onClick={handleDeclare} disabled={declareMutation.isPending}>
            <CheckCircle2 className="h-4 w-4" />
            {declareMutation.isPending ? 'Enviando…' : 'Já paguei'}
          </Button>
        )}
        {onDone && (
          <Button type="button" variant="outline" onClick={onDone}>Fechar</Button>
        )}
      </div>
    </div>
  );
}

export default function PixPaymentDialog({ open, onClose, tournament, modality, registrationId, paymentDeclared }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento da inscrição</DialogTitle>
          <DialogDescription>
            Pague por PIX usando o QR Code ou o código abaixo.
          </DialogDescription>
        </DialogHeader>
        <PixPaymentContent
          tournament={tournament}
          modality={modality}
          registrationId={registrationId}
          paymentDeclared={paymentDeclared}
          onDone={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
