/**
 * A premiação por gênero do torneio e o aviso de isonomia (Lei 14.597/2023,
 * Lei Geral do Esporte): premiação diferente entre feminino e masculino é
 * dita na tela de quem pede e de quem aprova. Aviso, não trava — a decisão é
 * da federação.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { normalizePrize, prizeParity } from '@/modules/federations/domain/competitions';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { t } from '@/core/i18n';

export default function PrizeParityNote({ prize }) {
  const p = normalizePrize(prize);
  const par = prizeParity(p);
  if (!p) return null;
  const valores = p.female_cents == null && p.male_cents == null ? '' : t('Premiação: feminino {f} · masculino {m}', {
    f: p.female_cents == null ? '—' : formatBrlCents(p.female_cents), m: p.male_cents == null ? '—' : formatBrlCents(p.male_cents),
  });
  return (
    <div className="space-y-1 text-sm" data-dica="torneio-premiacao">
      {valores && <p className="text-gray-700">{valores}{p.note ? ` · ${p.note}` : ''}</p>}
      {!valores && p.note && <p className="text-gray-700">{p.note}</p>}
      {par.state === 'unequal' && (
        <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {par.lower === 'female'
            ? t('A premiação feminina é {diferenca} menor que a masculina. A Lei Geral do Esporte (Lei 14.597/2023) pede premiação igual entre gêneros.', { diferenca: formatBrlCents(par.gap_cents) })
            : t('A premiação masculina é {diferenca} menor que a feminina. A Lei Geral do Esporte (Lei 14.597/2023) pede premiação igual entre gêneros.', { diferenca: formatBrlCents(par.gap_cents) })}
        </p>
      )}
      {par.state === 'equal' && (
        <p className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="h-4 w-4" aria-hidden />{t('Premiação igual entre gêneros.')}</p>
      )}
    </div>
  );
}
