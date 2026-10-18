/**
 * A lista pública de planos de filiação — o MESMO bloco na página da
 * federação dentro do app (`/federacoes/:id`) e na pública (`/f/:slug`).
 */
import React from 'react';
import { isFreePlan, planPeriodLabel } from '@/modules/federations/domain/plans';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { PLAN_PERSON_TYPE_LABELS, PLAN_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

/** A lista pública de planos (o mesmo bloco da página pública). */
export default function PlansList({ plans, federation, action }) {
  const ativos = (plans || []).filter((p) => p.active !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.price_cents ?? 0) - (b.price_cents ?? 0));
  if (!ativos.length) return <p className="text-sm text-gray-500">{t('A federação ainda não publicou planos de filiação.')}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ativos.map((p) => (
        <V2Surface as="li" key={p.id} variant="compacto" className="flex flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg font-bold text-ink">{p.name}</p>
              <p className="text-xs uppercase tracking-widest text-gray-500">{t(PLAN_PERSON_TYPE_LABELS[p.person_type] || PLAN_PERSON_TYPE_LABELS.athlete)} · {t(PLAN_TIER_LABELS[p.tier] || PLAN_TIER_LABELS.federated)}</p>
            </div>
            <p className="text-right"><span className="font-display text-xl font-bold text-ink">{isFreePlan(p) ? t('Grátis') : formatBrlCents(p.price_cents)}</span>{!isFreePlan(p) && <span className="block text-xs text-gray-500">{planPeriodLabel(p)}</span>}</p>
          </div>
          {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
          {p.benefits && <ul className="mt-2 space-y-1 text-sm text-gray-700">{p.benefits.split('\n').filter(Boolean).map((b) => <li key={b} className="flex gap-2"><span aria-hidden="true">•</span>{b}</li>)}</ul>}
          {(p.age_min != null || p.age_max != null) && <p className="mt-2 text-xs text-gray-500">{p.age_min != null && p.age_max != null ? t('De {min} a {max} anos', { min: p.age_min, max: p.age_max }) : p.age_min != null ? t('A partir de {min} anos', { min: p.age_min }) : t('Até {max} anos', { max: p.age_max })}</p>}
          {action && <div className="mt-auto pt-3">{action(p)}</div>}
        </V2Surface>
      ))}
    </ul>
  );
}

