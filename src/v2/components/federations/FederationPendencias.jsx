/**
 * "Precisa de você" da Central da federação (`federationPendingItems`): o que
 * espera a secretaria (pedidos, filiações vencendo, clubes e arenas pedindo
 * filiação), competições (chancelas) e o financeiro (pagamentos informados,
 * cobranças vencidas). Fonte que não carregou ou falhou é
 * `undefined` e o item some — nunca vira zero.
 */
import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { federationPendingItems } from '@/modules/federations/domain/federationPending';
import { V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function FederationPendencias({ membersQ, chargesQ, affiliationsQ, tournamentsQ, perms, onIrParaAba }) {
  const members = membersQ?.isSuccess ? membersQ.data : undefined;
  const charges = chargesQ?.isSuccess ? chargesQ.data : undefined;
  const affiliations = affiliationsQ?.isSuccess ? affiliationsQ.data : undefined;
  const tournaments = tournamentsQ?.isSuccess ? tournamentsQ.data : undefined;
  const itens = useMemo(() => federationPendingItems({ members, charges, affiliations, tournaments }, perms), [members, charges, affiliations, tournaments, perms]);
  if (itens.length === 0) return null;
  return (
    <V2Surface as="section" variant="compacto" aria-label={t('Precisa de você')} data-dica="federacao-pendencias" className="p-4">
      <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Precisa de você')}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {itens.map((i) => (
          <li key={i.id}>
            <button type="button"
              onClick={() => onIrParaAba(i.aba)}
              className="inline-flex items-center gap-2 rounded-full bg-acid/25 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-acid/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
            >
              <span className="font-display text-base">{i.count}</span> {t(i.label)}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </V2Surface>
  );
}
