/**
 * Uma COBRANÇA do clube para quem paga: valor, vencimento, o QR Pix (a chave
 * vem COPIADA na cobrança), o copia e cola e o "Já paguei" (`declare` — a
 * única escrita do associado na cobrança). Quem confirma é o financeiro do
 * clube; até lá o estado é "informado". O dinheiro vai direto à chave do clube.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, QrCode } from 'lucide-react';
import { CHARGE_STATUS, canDeclarePayment, clubChargePixPayload, formatBrlCents, isChargeOverdue } from '@/modules/clubs/domain/association';
import { useAssociationAction } from '@/modules/clubs/hooks/useClubAssociation';
import { V2Button, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { ChargeStatusBadge, quando, useQrDataUrl } from '@/v2/components/federations/federationUi';
import { t } from '@/core/i18n';

export default function ClubChargeBlock({ charge, club }) {
  const [nota, setNota] = useState('');
  const declarar = useAssociationAction(charge.club_id || club?.id);
  const payload = clubChargePixPayload(charge);
  const qr = useQrDataUrl(payload, { width: 280 });
  const pago = charge.status === CHARGE_STATUS.PAID;
  const cancelada = charge.status === CHARGE_STATUS.CANCELLED;
  const declarada = charge.status === CHARGE_STATUS.DECLARED;
  const atrasada = isChargeOverdue(charge);
  const aberta = !pago && !cancelada;
  const instrucoes = String(charge.payment?.instructions || '').trim();
  const origem = charge.origin === 'renewal' ? t('Renovação') : t('Filiação');

  return (
    <V2Surface variant="compacto" className="space-y-4 p-4" data-dica="clube-cobranca">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold text-ink">{formatBrlCents(charge.amount_cents)}</p>
          <p className="text-sm text-gray-600">{[origem, charge.plan_name, charge.club_name || club?.name].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-gray-500">
            {pago ? t('Pago em {data}', { data: quando(charge.paid_at) }) : t('Vence em {data}', { data: quando(charge.due_date) })}
            {atrasada && <span className="ml-1 font-bold text-red-600">· {t('vencida')}</span>}
          </p>
        </div>
        <ChargeStatusBadge status={charge.status} />
      </div>

      {aberta && payload && (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          {/* No celular o QR vem DEPOIS do copia e cola: ninguém lê o QR com a câmera do próprio aparelho. */}
          {qr
            ? <img src={qr} alt={t('QR Pix da cobrança')} className="order-2 mx-auto h-44 w-44 rounded-2xl bg-white p-2 shadow-sm sm:order-1" />
            : <span className="order-2 mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-paper sm:order-1"><QrCode className="h-8 w-8 text-gray-500" aria-hidden="true" /></span>}
          <div className="order-1 space-y-2 text-sm sm:order-2">
            <p className="text-gray-700">{t('Pague pelo app do seu banco: copie o código "Pix copia e cola" ou leia o QR. O valor já vai preenchido.')}</p>
            <CopyCodeButton code={payload} label={t('Copiar o código Pix copia e cola')} successMessage={t('Código Pix copiado. Cole no app do banco.')} className="max-w-full truncate" />
            <p className="text-xs text-gray-500">{t('Recebedor: {nome}', { nome: charge.payment?.receiver_name || charge.club_name || club?.name })}</p>
          </div>
        </div>
      )}
      {aberta && !payload && <p className="text-sm text-amber-700">{t('O clube ainda não cadastrou a chave Pix. Fale com a secretaria para pagar.')}</p>}
      {aberta && instrucoes && (
        <div className="rounded-2xl bg-paper px-4 py-3 text-sm text-gray-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Instruções do clube')}</p>
          <p className="whitespace-pre-line">{instrucoes}</p>
        </div>
      )}

      {canDeclarePayment(charge) && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            declarar.mutate({ action: 'declare', chargeId: charge.id, note: nota }, {
              onSuccess: () => toast.success(t('Pagamento informado. O financeiro do clube confirma e a sua carteirinha é liberada.')),
              onError: (er) => toast.error(er.message),
            });
          }}
        >
          {declarada ? (
            <p className="flex items-center gap-2 text-sm text-blue-700"><Clock className="h-4 w-4" aria-hidden="true" />{t('Você informou o pagamento em {data}. Falta o financeiro confirmar.', { data: quando(charge.declared_at) })}</p>
          ) : (
            <>
              <V2Textarea rows={2} maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('Opcional: nome de quem pagou, se for diferente do seu, ou o horário.')} aria-label={t('Observação do pagamento')} />
              <V2Button type="submit" size="sm" disabled={declarar.isPending}><CheckCircle2 className="h-4 w-4" />{declarar.isPending ? t('Enviando…') : t('Já paguei')}</V2Button>
            </>
          )}
        </form>
      )}
    </V2Surface>
  );
}
