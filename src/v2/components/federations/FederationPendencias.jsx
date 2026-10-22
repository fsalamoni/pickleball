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

const dado = (q) => (q?.isSuccess ? q.data : undefined);

export default function FederationPendencias({ membersQ, chargesQ, affiliationsQ, tournamentsQ, transfersQ, documentsQ, sanctionsQ, reportsQ, perms, abas, onIrParaAba }) {
  const members = dado(membersQ);
  const charges = dado(chargesQ);
  const affiliations = dado(affiliationsQ);
  const tournaments = dado(tournamentsQ);
  const transfers = dado(transfersQ);
  const documents = dado(documentsQ);
  const sanctions = dado(sanctionsQ);
  const reports = dado(reportsQ);
  const itens = useMemo(() => federationPendingItems({ members, charges, affiliations, tournaments, transfers, documents, sanctions, reports }, perms), [members, charges, affiliations, tournaments, transfers, documents, sanctions, reports, perms]);
  // A consulta desligada guarda o dado em cache: a pendência de um módulo que
  // acabou de desligar (aba que não existe mais) não vira um botão morto.
  const visiveis = abas ? itens.filter((i) => abas.has(i.aba)) : itens;
  if (visiveis.length === 0) return null;
  return (
    <V2Surface as="section" variant="compacto" aria-label={t('Precisa de você')} data-dica="federacao-pendencias" className="p-4">
      <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Precisa de você')}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {visiveis.map((i) => (
          <li key={i.id}>
            <button type="button"
              onClick={() => onIrParaAba(i.aba, i.filtro)}
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
