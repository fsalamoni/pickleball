/**
 * "Associe-se": o pedido de associação a um plano, em um diálogo curto —
 * resumo do plano e do valor, observação opcional e o aviso do que acontece
 * depois (aprovação pela secretaria ou Pix na hora). O pedido vai ao SERVIDOR
 * (`clubAssociation`/`request`), que confere idade, plano e duplicidade.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { benefitLines, formatBrlCents, isFreePlan, planPeriodLabelOf } from '@/modules/clubs/domain/association';
import { useAssociationAction } from '@/modules/clubs/hooks/useClubAssociation';
import { V2Button, V2Field, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function ClubJoinDialog({ open, onOpenChange, club, plan, price, onDone }) {
  const [nota, setNota] = useState('');
  const [aparecer, setAparecer] = useState(true);
  const pedir = useAssociationAction(club?.id);
  if (!plan) return null;
  const gratis = isFreePlan(plan);

  function enviar(e) {
    e.preventDefault();
    pedir.mutate({ action: 'request', planId: plan.id, note: nota, publicBadge: aparecer }, {
      onSuccess: (r) => {
        toast.success(plan.auto_approve
          ? (gratis ? t('Pronto! Você já é associado.') : t('Pedido feito. Pague o Pix para liberar a sua carteirinha.'))
          : t('Pedido enviado. A secretaria do clube vai analisar.'));
        onOpenChange(false);
        setNota('');
        onDone?.(r);
      },
      onError: (er) => toast.error(er.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle>{t('Associar-se ao {clube}', { clube: club?.name || '' })}</DialogTitle>
          <DialogDescription>{t('Plano {plano}', { plano: plan.name })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="rounded-2xl bg-paper p-4">
            <p className="font-display text-2xl font-bold text-ink">{gratis ? t('Gratuito') : formatBrlCents(price?.total ?? plan.price_cents)}</p>
            {!gratis && <p className="text-xs text-gray-500">{planPeriodLabelOf(plan)}{price?.pct > 0 ? ` · ${t('{pct}% de desconto já aplicado', { pct: price.pct })}` : ''}</p>}
            {benefitLines(plan).length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                {benefitLines(plan).map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" /><span>{b}</span></li>)}
              </ul>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {plan.auto_approve
              ? (gratis ? t('A filiação é imediata: você recebe o número e a carteirinha digital agora.') : t('Ao confirmar, você recebe o Pix do clube. Pago o Pix, o financeiro confirma e a carteirinha é liberada.'))
              : t('A secretaria do clube analisa o pedido e avisa você. Se o plano for pago, o Pix aparece depois da aprovação.')}
          </p>
          <V2Field label={t('Algo que o clube deva saber? (opcional)')} htmlFor="club-join-note">
            <V2Textarea id="club-join-note" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
          </V2Field>
          <V2Toggle id="club-join-badge" checked={aparecer} onChange={setAparecer} label={t('Mostrar o selo de associado no meu perfil')} hint={t('Você pode mudar isso depois.')} />
          <div className="flex flex-wrap justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('Agora não')}</V2Button>
            <V2Button type="submit" disabled={pedir.isPending}>{pedir.isPending ? t('Enviando…') : t('Confirmar pedido')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
