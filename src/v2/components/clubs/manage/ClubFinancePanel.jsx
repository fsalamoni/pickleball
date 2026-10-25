/**
 * "Financeiro" do clube: as cobranças de filiação. O dinheiro vai direto à
 * chave Pix do clube; aqui o financeiro CONFIRMA o que o associado informou
 * (ou o que caiu na conta) e a filiação é ativada pelo servidor. Informadas
 * primeiro, depois abertas, depois pagas.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CircleDollarSign, Clock, Receipt } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CHARGE_STATUS, financeSummary, formatBrlCents, isChargeOverdue, sortChargesForStaff } from '@/modules/clubs/domain/association';
import { useAssociationAction } from '@/modules/clubs/hooks/useClubAssociation';
import { V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Skeleton, V2StatCard, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { ChargeStatusBadge, quando } from '@/v2/components/federations/federationUi';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import { t, tk } from '@/core/i18n';

const FILTROS = [
  { id: 'todas', label: tk('Todas') },
  { id: 'declared', label: tk('Informadas') },
  { id: 'open', label: tk('Em aberto') },
  { id: 'paid', label: tk('Pagas') },
  { id: 'cancelled', label: tk('Canceladas') },
];

export default function ClubFinancePanel({ club, chargesQ }) {
  const agir = useAssociationAction(club.id);
  const [filtro, setFiltro] = useState('todas');
  const [pergunta, setPergunta] = useState(null); // { decisao: 'confirm' | 'cancel', charge }
  const [nota, setNota] = useState('');
  const resumo = useMemo(() => (chargesQ.isSuccess ? financeSummary(chargesQ.data || []) : null), [chargesQ.isSuccess, chargesQ.data]);
  const lista = useMemo(() => (chargesQ.isSuccess ? sortChargesForStaff(chargesQ.data || []) : []), [chargesQ.isSuccess, chargesQ.data]);
  const visiveis = lista.filter((c) => filtro === 'todas' || c.status === filtro);

  function decidir() {
    const { decisao, charge } = pergunta;
    agir.mutate({ action: 'charge_confirm', chargeId: charge.id, decision: decisao, note: nota }, {
      onSuccess: () => { toast.success(decisao === 'confirm' ? t('Pagamento confirmado. A associação foi ativada.') : t('Cobrança cancelada.')); setPergunta(null); setNota(''); },
      onError: (er) => toast.error(er.message),
    });
  }

  return (
    <section className="space-y-5" aria-label={t('Financeiro')} data-dica="clube-financeiro">
      {resumo && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <V2StatCard icon={Clock} label={t('Aguardando confirmação')} value={String(resumo.declared)} hint={formatBrlCents(resumo.declared_cents)} accent={resumo.declared ? 'acid' : 'ink'} />
          <V2StatCard icon={Receipt} label={t('Em aberto')} value={String(resumo.open)} hint={resumo.overdue ? t('{n} vencida(s)', { n: resumo.overdue }) : formatBrlCents(resumo.open_cents)} />
          <V2StatCard icon={CircleDollarSign} label={t('Recebido no mês')} value={formatBrlCents(resumo.paid_month_cents)} />
          <V2StatCard icon={CircleDollarSign} label={t('Recebido no total')} value={formatBrlCents(resumo.paid_total_cents)} />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Filtrar cobranças')}>
        {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{t(f.label)}</V2FilterChip>)}
      </div>

      {chargesQ.isLoading && <V2Skeleton lines={5} />}
      {chargesQ.isError && <V2ErrorState title={t('Não carregaram as cobranças')} onRetry={() => chargesQ.refetch()} />}
      {chargesQ.isSuccess && podeAfirmarVazio(chargesQ) && lista.length === 0 && (
        <V2Surface><V2EmptyState icon={Receipt} title={t('Nenhuma cobrança ainda')} description={t('As cobranças nascem quando alguém pede um plano pago ou renova. Cadastre a chave Pix em Planos → Pix do clube.')} /></V2Surface>
      )}
      {chargesQ.isSuccess && lista.length > 0 && (
        visiveis.length === 0 ? <p className="text-sm text-gray-500">{t('Nenhuma cobrança nesse filtro.')}</p> : (
          <ul className="space-y-2">
            {visiveis.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{c.payer_name || t('Associado')} <span className="font-normal text-gray-500">· {c.plan_name}</span></p>
                  <p className="text-xs text-gray-500">
                    {formatBrlCents(c.amount_cents)} · {c.status === CHARGE_STATUS.PAID ? t('pago em {data}', { data: quando(c.paid_at) }) : t('vence em {data}', { data: quando(c.due_date) })}
                    {isChargeOverdue(c) && <span className="ml-1 font-bold text-red-600">· {t('vencida')}</span>}
                    {c.declared_note && ` · “${c.declared_note}”`}
                  </p>
                </div>
                <ChargeStatusBadge status={c.status} />
                {[CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status) && (
                  <div className="flex gap-1.5">
                    <V2Button type="button" size="sm" onClick={() => { setNota(''); setPergunta({ decisao: 'confirm', charge: c }); }}><CheckCircle2 className="h-4 w-4" />{t('Confirmar pagamento')}</V2Button>
                    <V2Button type="button" size="sm" variant="ghost" onClick={() => { setNota(''); setPergunta({ decisao: 'cancel', charge: c }); }}>{t('Cancelar')}</V2Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      <ConfirmDialog
        open={Boolean(pergunta)}
        onOpenChange={(o) => { if (!o) setPergunta(null); }}
        destructive={pergunta?.decisao === 'cancel'}
        title={pergunta?.decisao === 'confirm' ? t('Confirmar o pagamento?') : t('Cancelar a cobrança?')}
        description={pergunta?.decisao === 'confirm'
          ? t('Confira no extrato do banco. Ao confirmar, a associação é ativada (ou renovada) e a pessoa é avisada.')
          : t('A cobrança é cancelada e a pessoa é avisada. Se era a primeira, o pedido volta para "Aguardando aprovação".')}
        confirmLabel={pergunta?.decisao === 'confirm' ? t('Confirmar pagamento') : t('Cancelar cobrança')}
        cancelLabel={t('Voltar')}
        loading={agir.isPending}
        confirmDisabled={pergunta?.decisao === 'cancel' && nota.trim().length < 3}
        onConfirm={decidir}
      >
        <V2Field label={pergunta?.decisao === 'cancel' ? t('Motivo (a pessoa lê)') : t('Observação (opcional)')} htmlFor="club-fin-nota">
          <V2Textarea id="club-fin-nota" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </V2Field>
      </ConfirmDialog>
    </section>
  );
}
