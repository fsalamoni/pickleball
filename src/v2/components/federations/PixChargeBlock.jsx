/**
 * Uma COBRANÇA da federação para quem paga: valor, vencimento, o QR Pix
 * (`chargePixPayload`, o mesmo motor do torneio), o copia e cola e o botão
 * "Já paguei" (`declarePayment` — a única escrita do filiado na cobrança).
 * Quem confirma é o financeiro da federação; até lá o estado é "informado".
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, QrCode } from 'lucide-react';
import { CHARGE_STATUS, CHARGE_ORIGIN_LABELS } from '@/modules/federations/domain/constants';
import { canDeclarePayment, chargePixPayload, formatBrlCents, isChargeOverdue, usesGatewayPix } from '@/modules/federations/domain/charges';
import { declarePayment, federationPayments } from '@/modules/federations/services/federationService';
import { useChargeGatewayPix, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { V2Button, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ChargeProofButton, ChargeProofField, temComprovante } from './ChargeProof';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { t } from '@/core/i18n';
import { ChargeStatusBadge, quando, useQrDataUrl } from './federationUi';

export default function PixChargeBlock({ charge, federation, compact = false }) {
  const { user } = useAuth();
  // Bloco 6a: com o provedor da federação ligado, quem paga recebe o Pix DELE e a
  // baixa é automática; o provedor falhando, vale o Pix da chave de sempre.
  const automatico = !compact && usesGatewayPix(charge, federation, user?.uid);
  const gw = useChargeGatewayPix(charge.id, { enabled: automatico });
  const viaProvedor = automatico && gw.data?.mode === 'gateway';
  const gerando = automatico && gw.isLoading;
  const payload = viaProvedor ? gw.data.payload : (gerando ? null : chargePixPayload(charge, federation));
  const qr = useQrDataUrl(payload, { width: 280 });
  const conferir = useFederationMutation(() => federationPayments({ action: 'check', chargeId: charge.id }));
  const [nota, setNota] = useState('');
  const [arquivo, setArquivo] = useState(null);
  // Já informado sem comprovante: anexar depois mantém a observação que a pessoa deu.
  const declarado = charge.status === CHARGE_STATUS.DECLARED;
  const m = useFederationMutation(() => declarePayment(charge, { note: declarado ? charge.declared_note : nota, file: arquivo, uid: user?.uid }));
  const atrasada = isChargeOverdue(charge);
  const pago = charge.status === CHARGE_STATUS.PAID;
  const semPix = !payload && !gerando && !pago && charge.status !== CHARGE_STATUS.CANCELLED;
  // Do dependente: quem paga é o responsável, e a cobrança diz de quem é (senão parece a própria).
  const para = charge.member_name && charge.member_name !== charge.payer_name ? charge.member_name : '';
  const instrucoes = String(federation?.payment?.instructions || '').trim();

  return (
    <V2Surface variant="compacto" className="space-y-4 p-4" data-dica="federacao-cobranca">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold text-ink">{formatBrlCents(charge.amount_cents)}</p>
          <p className="text-sm text-gray-600">{[t(CHARGE_ORIGIN_LABELS[charge.origin] || CHARGE_ORIGIN_LABELS.membership), charge.plan_name, federation?.acronym || ''].filter(Boolean).join(' · ')}</p>
          {para && <p className="text-sm font-semibold text-ink">{t('Para {nome}', { nome: para })}</p>}
          <p className="text-xs text-gray-500">
            {pago ? t('Pago em {data}', { data: quando(charge.paid_at) }) : t('Vence em {data}', { data: quando(charge.due_date) })}
            {atrasada && <span className="ml-1 font-bold text-red-600">· {t('vencida')}</span>}
          </p>
        </div>
        <ChargeStatusBadge status={charge.status} />
      </div>

      {!compact && payload && !pago && charge.status !== CHARGE_STATUS.CANCELLED && (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          {/* No celular o QR vem DEPOIS do copia e cola: ninguém lê o QR com a câmera do próprio aparelho. */}
          {qr ? <img src={qr} alt={t('QR Pix da cobrança')} className="order-2 mx-auto h-44 w-44 rounded-2xl bg-white p-2 shadow-sm sm:order-1" /> : <span className="order-2 mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-paper sm:order-1"><QrCode className="h-8 w-8 text-gray-500" aria-hidden="true" /></span>}
          <div className="order-1 space-y-2 text-sm sm:order-2">
            <p className="text-gray-700">{t('Pague pelo app do seu banco: copie o código "Pix copia e cola" ou leia o QR. O valor já vai preenchido.')}</p>
            {viaProvedor && <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{t('Confirmação automática: pago o Pix, a cobrança fica paga sozinha.')}</p>}
            <CopyCodeButton code={payload} label={t('Copiar o código Pix copia e cola')} successMessage={t('Código Pix copiado. Cole no app do banco.')} className="max-w-full truncate" />
            <p className="text-xs text-gray-500">{t('Recebedor: {nome}', { nome: federation?.payment?.receiver_name || federation?.name })}</p>
          </div>
        </div>
      )}
      {instrucoes && !pago && charge.status !== CHARGE_STATUS.CANCELLED && (
        <div className="rounded-2xl bg-paper px-4 py-3 text-sm text-gray-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Instruções da federação')}</p>
          <p className="whitespace-pre-line">{instrucoes}</p>
        </div>
      )}
      {gerando && !pago && <p className="text-sm text-gray-500" role="status">{t('Gerando o Pix…')}</p>}
      {automatico && gw.data?.mode === 'paid' && <p className="text-sm text-green-700" role="status">{t('Recebemos o pagamento. A cobrança é atualizada em instantes.')}</p>}
      {semPix && <p className="text-sm text-amber-700">{t('A federação ainda não cadastrou a chave Pix. Fale com a secretaria para pagar.')}</p>}

      {viaProvedor && (
        <V2Button
          type="button" size="sm" variant="secondary" disabled={conferir.isPending}
          onClick={() => conferir.mutate(undefined, {
            onSuccess: (r) => (r?.paid ? toast.success(t('Pagamento confirmado. Obrigado!')) : toast.info(t('Ainda não recebemos o pagamento. Assim que o banco confirmar, a cobrança fica paga sozinha.'))),
            onError: (er) => toast.error(er.message),
          })}
        >
          <CheckCircle2 className="h-4 w-4" />{conferir.isPending ? t('Conferindo…') : t('Já paguei — conferir agora')}
        </V2Button>
      )}

      {!compact && !viaProvedor && !gerando && canDeclarePayment(charge) && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate(undefined, {
              onSuccess: () => { setArquivo(null); toast.success(declarado ? t('Comprovante anexado.') : t('Pagamento informado. O financeiro da federação confirma e a sua carteirinha é liberada.')); },
              onError: (er) => toast.error(er.message),
            });
          }}
        >
          {declarado ? (
            <>
              <p className="flex items-center gap-2 text-sm text-blue-700"><Clock className="h-4 w-4" aria-hidden="true" />{t('Você informou o pagamento em {data}. Falta o financeiro confirmar.', { data: quando(charge.declared_at) })}</p>
              {temComprovante(charge) ? <ChargeProofButton charge={charge} /> : (
                <>
                  <ChargeProofField file={arquivo} onChange={setArquivo} id={`comprovante-${charge.id}`} />
                  {arquivo && <V2Button type="submit" size="sm" disabled={m.isPending}>{m.isPending ? t('Enviando…') : t('Anexar comprovante')}</V2Button>}
                </>
              )}
            </>
          ) : (
            <>
              <V2Textarea rows={2} maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('Opcional: nome de quem pagou, se for diferente do seu, ou o horário.')} aria-label={t('Observação do pagamento')} />
              <ChargeProofField file={arquivo} onChange={setArquivo} id={`comprovante-${charge.id}`} />
              <V2Button type="submit" size="sm" disabled={m.isPending}><CheckCircle2 className="h-4 w-4" />{m.isPending ? t('Enviando…') : t('Já paguei')}</V2Button>
            </>
          )}
        </form>
      )}
    </V2Surface>
  );
}
