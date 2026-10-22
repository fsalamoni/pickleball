/**
 * Eleições da federação (Central → Eleições; admin, módulo `elections`).
 * A lista, "Nova eleição" (o assistente) e o painel de cada eleição. Quem
 * CONDUZ é a comissão eleitoral; sem comissão, o admin (com aviso). Tudo
 * passa pelo servidor (`federationElections`).
 */
import React, { useState } from 'react';
import { Plus, Vote } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { STATUS } from '@/modules/federations/domain/elections';
import { V2Button, V2EmptyState, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import FedElectionWizard from '../elections/FedElectionWizard';
import ElectionConductPanel from '../elections/ElectionConductPanel';
import { ElectionStatusBadge, hojeBr } from '../elections/electionsUi';
import { dataCurta } from '../agenda/agendaUi';

/** Quem conduz: a comissão; sem comissão, o admin. */
const conduzEleicao = (e, uid, isAdmin) => {
  const comissao = e?.commission_uids || [];
  return comissao.length ? comissao.includes(uid) : Boolean(isAdmin);
};

export default function FedElectionsPanel({ federation, electionsQ }) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(null); // 'nova' | eleição
  const [abertaId, setAbertaId] = useState(null);
  const hoje = hojeBr();

  if (editando) {
    return (
      <FedElectionWizard
        federation={federation}
        election={editando === 'nova' ? null : editando}
        onClose={(id) => { setEditando(null); if (id) setAbertaId(id); electionsQ?.refetch?.(); }}
      />
    );
  }
  if (electionsQ?.isError) return <V2ErrorState title={t('Não carregaram as eleições')} onRetry={electionsQ.refetch} />;
  if (!electionsQ || electionsQ.isLoading) return <V2Skeleton lines={4} />;
  const lista = [...(electionsQ.data || [])].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
  const aberta = lista.find((e) => e.id === abertaId);
  const emCurso = lista.some((e) => ![STATUS.CLOSED, STATUS.CANCELLED].includes(e.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500">{t('Edital, chapas, impugnações, votação secreta pelo aplicativo (com peso por categoria), apuração e ata. O acervo guarda o edital e a ata, e o resultado pode atualizar a governança.')}</p>
        <V2Button type="button" onClick={() => setEditando('nova')} data-dica="federacao-eleicao-nova"><Plus className="h-4 w-4" />{t('Nova eleição')}</V2Button>
      </div>
      {emCurso && lista.length > 1 && <p className="text-xs text-gray-500">{t('Mais de uma eleição em andamento ao mesmo tempo confunde os filiados: prefira uma de cada vez.')}</p>}
      {!lista.length ? (
        <V2EmptyState icon={Vote} title={t('Nenhuma eleição ainda')} description={t('Comece por "Nova eleição": o assistente monta os cargos, o calendário, o colégio eleitoral e a comissão, e publica o edital no acervo.')} />
      ) : (
        <ul className="space-y-2">
          {lista.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setAbertaId(abertaId === e.id ? null : e.id)} aria-expanded={abertaId === e.id} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left hover:border-ink">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{e.title}</span>
                  <span className="block text-xs text-gray-500">{e.calendar?.voting_from ? t('Votação em {data}', { data: dataCurta(e.calendar.voting_from) }) : t('Sem calendário')}</span>
                </span>
                <ElectionStatusBadge e={e} hoje={hoje} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberta && (
        <ElectionConductPanel
          federation={federation}
          election={aberta}
          isAdmin
          canConduct={conduzEleicao(aberta, user?.uid, true)}
          onEdit={(e) => setEditando(e)}
        />
      )}
    </div>
  );
}
