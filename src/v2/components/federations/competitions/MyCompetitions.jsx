/**
 * Competições na Minha área → Federações (Bloco 2): os convites para finais
 * de circuito (aceitar ou recusar no prazo) e os torneios chancelados que a
 * pessoa dirige (checklist e relatório).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FINAL_INVITE_STATUS_LABELS, directorStage, finalInviteOpen } from '@/modules/federations/domain/competitions';
import { isoDate } from '@/modules/federations/domain/membership';
import { competitionAction } from '@/modules/federations/services/competitionsService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { V2Badge, V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { classeLabel } from '../FedPublicBlocks';
import { quando } from '../federationUi';
import DirectorReportForm from './DirectorReportForm';

function ConviteFinal({ inv }) {
  const [recusando, setRecusando] = useState(false);
  const m = useFederationMutation((accept) => competitionAction(inv.federation_id, 'final_answer', { inviteId: inv.id, accept }));
  const aberto = finalInviteOpen(inv);
  return (
    <li className="rounded-2xl border border-gray-100 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
        <Link to={`/torneios/${inv.tournament_id}`} className="hover:underline">{inv.tournament_name}</Link>
        <V2Badge tone={aberto ? 'amber' : inv.status === 'accepted' ? 'green' : 'neutral'}>{t(FINAL_INVITE_STATUS_LABELS[inv.status] || inv.status)}</V2Badge>
      </p>
      <p className="text-xs text-gray-500">
        {[inv.federation_acronym, classeLabel(inv), inv.position ? t('{n}º no ranking {ano}', { n: inv.position, ano: inv.season }) : '', inv.starts_at ? quando(inv.starts_at) : ''].filter(Boolean).join(' · ')}
      </p>
      {aberto && (
        <>
          <p className="mt-1 text-xs text-gray-600">{t('Responda até {data}. Sem resposta, a vaga vai para o próximo do ranking.', { data: quando(inv.expires_at_ms) })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => m.mutate(true, { onSuccess: () => toast.success(t('Presença confirmada na final.')), onError: (e) => toast.error(e.message) })}>{t('Confirmar presença')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => setRecusando(true)}>{t('Recusar')}</V2Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={recusando}
        onOpenChange={setRecusando}
        destructive
        loading={m.isPending}
        title={t('Recusar o convite para a final?')}
        description={t('A vaga vai para o próximo do ranking e não volta para você.')}
        confirmLabel={t('Recusar convite')}
        cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate(false, { onSuccess: () => { setRecusando(false); toast.success(t('Convite recusado.')); }, onError: (e) => toast.error(e.message) })}
      />
    </li>
  );
}

export function MyFinalInvites({ invites }) {
  return <ul className="space-y-2">{invites.map((inv) => <ConviteFinal key={inv.id} inv={inv} />)}</ul>;
}

function TorneioDirigido({ report }) {
  const etapa = directorStage(report, report, isoDate());
  const [aberto, setAberto] = useState(etapa !== 'done');
  const rotulo = { checklist: t('Checklist antes do evento'), report: t('Relatório pendente'), done: t('Relatório entregue') }[etapa];
  return (
    <li className="rounded-2xl border border-gray-100 p-3 text-sm">
      <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <span className="font-bold text-ink">{report.tournament_name}</span>
        <span className="flex items-center gap-2">
          <V2Badge tone={etapa === 'done' ? 'green' : 'amber'}>{rotulo}</V2Badge>
          {aberto ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </span>
      </button>
      {report.starts_at && <p className="text-xs text-gray-500">{quando(report.starts_at)}</p>}
      {aberto && <div className="mt-3"><DirectorReportForm report={report} /></div>}
    </li>
  );
}

export function MyDirectedTournaments({ reports }) {
  return <ul className="space-y-2">{reports.map((r) => <TorneioDirigido key={r.id} report={r} />)}</ul>;
}
