/**
 * "Eleição em andamento" na área do filiado: um aviso compacto que leva à
 * aba Eleições. Some sem eleição aberta (e com a consulta falhando, porque
 * a aba Eleições diz o que houve — aqui seria ruído).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Vote } from 'lucide-react';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { STATUS } from '@/modules/federations/domain/elections';
import { PROFILE_TAB } from '@/modules/federations/domain/profile';
import { t } from '@/core/i18n';
import { ElectionStatusBadge, hojeBr } from './electionsUi';
import { isClubElections, useScopedPublicElections } from './electionsScope';

const ABERTAS = [STATUS.PUBLISHED, STATUS.VOTING, STATUS.COUNTING];

export default function FedElectionNotice({ federation }) {
  const ligado = fedModuleOn(federation, 'elections');
  const q = useScopedPublicElections(federation, { enabled: ligado });
  const e = (q.data || []).find((x) => ABERTAS.includes(x.status));
  if (!ligado || !e) return null;
  return (
    <Link to={{ search: isClubElections(federation) ? '?tab=eleicoes' : `?aba=${PROFILE_TAB.ELECTIONS}` }} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-3 hover:border-ink" data-dica="federacao-eleicao-aviso">
      <span className="flex min-w-0 items-center gap-2">
        <Vote className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
        <span className="min-w-0 text-sm"><span className="font-semibold text-ink">{t('Eleição em andamento')}</span> <span className="text-gray-500">· {e.title}</span></span>
      </span>
      <span className="flex items-center gap-2"><ElectionStatusBadge e={e} hoje={hojeBr()} /><ChevronRight className="h-4 w-4 text-gray-500" aria-hidden="true" /></span>
    </Link>
  );
}
