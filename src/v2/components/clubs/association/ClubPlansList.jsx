/**
 * Os planos de associação do clube, para quem ainda não é associado — o MESMO
 * bloco na página do clube dentro do app e na página pública (`/c/:clubId`).
 * `action(plano, preco)` desenha o botão de cada cartão (o app abre o pedido; a
 * página pública leva ao login).
 */
import React from 'react';
import { Check } from 'lucide-react';
import { benefitLines, formatBrlCents, isFreePlan, planPeriodLabelOf, planPriceFor, publicPlans } from '@/modules/clubs/domain/association';
import { V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function ClubPlansList({ plans, age = null, action, color = '' }) {
  const lista = publicPlans(plans || [], { age });
  if (!lista.length) return <p className="text-sm text-gray-500">{t('O clube ainda não publicou planos de associação.')}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-dica="clube-planos">
      {lista.map((p) => {
        const preco = planPriceFor(p, { age });
        const gratis = isFreePlan(p);
        return (
          <V2Surface as="li" key={p.id} variant="compacto" className="flex flex-col p-4" style={color ? { borderTop: `4px solid ${color}` } : undefined}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-ink">{p.name}</p>
                {p.category && <p className="text-xs uppercase tracking-widest text-gray-500">{p.category}</p>}
              </div>
              <p className="shrink-0 text-right">
                <span className="font-display text-xl font-bold text-ink">{gratis ? t('Gratuito') : formatBrlCents(preco.total)}</span>
                {!gratis && <span className="block text-xs text-gray-500">{planPeriodLabelOf(p)}</span>}
                {!gratis && preco.pct > 0 && <span className="block text-xs font-semibold text-green-700">{t('{pct}% de desconto para você', { pct: preco.pct })}</span>}
              </p>
            </div>
            {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
            {benefitLines(p).length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                {benefitLines(p).map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" /><span>{b}</span></li>)}
              </ul>
            )}
            {(p.age_min != null || p.age_max != null) && (
              <p className="mt-2 text-xs text-gray-500">
                {p.age_min != null && p.age_max != null ? t('De {min} a {max} anos', { min: p.age_min, max: p.age_max }) : p.age_min != null ? t('A partir de {min} anos', { min: p.age_min }) : t('Até {max} anos', { max: p.age_max })}
              </p>
            )}
            {!p.auto_approve && <p className="mt-2 text-xs text-gray-500">{t('A secretaria do clube analisa o pedido.')}</p>}
            {action && <div className="mt-auto pt-3">{action(p, preco)}</div>}
          </V2Surface>
        );
      })}
    </ul>
  );
}
