/**
 * TROCA DE PLANO (Bloco 6d, `docs/50` §46): quem está em dia passa para um
 * plano mais caro do mesmo período e tipo pagando só a DIFERENÇA. O servidor
 * confere o plano, calcula a diferença com os descontos da pessoa e gera a
 * cobrança; pago, o plano muda e a validade fica.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { membershipAction } from '@/modules/federations/services/federationService';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function FedChangePlan({ federation, member, current, targets }) {
  const [aberto, setAberto] = useState(false);
  const m = useFederationMutation((planId) => membershipAction({ federationId: federation.id, action: 'upgrade', memberId: member.id, planId }));
  const trocar = (p) => m.mutate(p.id, {
    onSuccess: (r) => { setAberto(false); toast.success(t('Troca pedida: pague {valor} para mudar de plano.', { valor: formatBrlCents(r?.amountCents) })); },
    onError: (e) => toast.error(e.message),
  });
  if (!targets.length) return null;
  return (
    <>
      <V2Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => setAberto(true)} data-dica="federacao-trocar-plano"><ArrowUpCircle className="h-4 w-4" />{t('Trocar de plano')}</V2Button>
      {aberto && (
        <Dialog open onOpenChange={setAberto}>
          <DialogContent sheet className="max-w-lg">
            <DialogTitle>{t('Trocar de plano')}</DialogTitle>
            <DialogDescription>{t('Você paga só a diferença entre o plano {atual} e o novo, com os seus descontos. A validade continua a mesma; para um plano mais barato, fale com a federação.', { atual: current?.name || member.plan_name })}</DialogDescription>
            <ul className="space-y-2">
              {targets.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-sm text-gray-500">{t('{valor} no plano; a diferença sai na cobrança', { valor: formatBrlCents(p.price_cents) })}</p>
                  </div>
                  <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => trocar(p)}>{t('Escolher')}</V2Button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
