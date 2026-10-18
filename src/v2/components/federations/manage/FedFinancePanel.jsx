/**
 * Financeiro da federação (permissão `finance`): as COBRANÇAS em aberto e
 * informadas (confirmar ativa a filiação; cancelar devolve o pedido) e os
 * RECEBIDOS (o que entrou, por mês, com CSV). Quem escreve é o servidor
 * (`chargeAction`); o Pix vai direto à conta da federação, a plataforma só
 * registra.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Download, Receipt, Wallet, XCircle } from 'lucide-react';
import { chargeAction } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { canConfirmCharge, chargesCsv, financeSummary, formatBrlCents, isChargeOverdue, sortChargesForStaff } from '@/modules/federations/domain/charges';
import { CHARGE_ORIGIN_LABELS, CHARGE_STATUS } from '@/modules/federations/domain/constants';
import { V2Button, V2EmptyState, V2ErrorState, V2Input, V2Skeleton, V2StatCard, V2Surface } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { ChargeStatusBadge, quando } from '../federationUi';

function ChargeRow({ charge: c }) {
  const [nota, setNota] = useState('');
  const m = useFederationMutation((action) => chargeAction({ chargeId: c.id, action, note: nota }));
  const agir = (action, msg) => m.mutate(action, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  const atrasada = isChargeOverdue(c);
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{c.payer_name}<ChargeStatusBadge status={c.status} />{atrasada && <span className="text-xs font-bold text-red-600">{t('vencida')}</span>}</p>
            <p className="text-xs text-gray-500">{t(CHARGE_ORIGIN_LABELS[c.origin] || CHARGE_ORIGIN_LABELS.membership)} · {c.plan_name} · {t('vence em {data}', { data: quando(c.due_date) })}{c.status === CHARGE_STATUS.DECLARED ? ` · ${t('informado em {data}', { data: quando(c.declared_at) })}` : ''}{c.status === CHARGE_STATUS.PAID ? ` · ${t('pago em {data}', { data: quando(c.paid_at) })}` : ''}</p>
            {c.declared_note && <p className="mt-1 text-sm text-gray-700">“{c.declared_note}”</p>}
            {c.confirm_note && <p className="mt-1 text-xs text-gray-500">{c.confirm_note}</p>}
          </div>
          <p className="font-display text-lg font-bold text-ink">{formatBrlCents(c.amount_cents)}</p>
        </div>
        {canConfirmCharge(c) && (
          <div className="flex flex-wrap items-center gap-2">
            <V2Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder={t('Observação (opcional)')} aria-label={t('Observação da confirmação')} className="sm:max-w-xs" />
            <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('confirm', t('Pagamento confirmado. A filiação está em dia e a pessoa foi avisada.'))}><CheckCircle2 className="h-4 w-4" />{t('Confirmar recebimento')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => agir('cancel', t('Cobrança cancelada.'))}><XCircle className="h-4 w-4" />{t('Cancelar cobrança')}</V2Button>
          </div>
        )}
      </V2Surface>
    </li>
  );
}

function baixarCsv(charges, acronym) {
  const blob = new Blob([`${chargesCsv(charges)}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cobrancas-${(acronym || 'federacao').toLowerCase()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function FedFinancePanel({ federation, chargesQ, tab }) {
  const todas = useMemo(() => sortChargesForStaff(chargesQ.data || []), [chargesQ.data]);
  const resumo = useMemo(() => financeSummary(todas), [todas]);
  if (chargesQ.isError) return <V2ErrorState title={t('Não carregaram as cobranças')} onRetry={() => chargesQ.refetch()} />;
  if (chargesQ.isLoading) return <V2Skeleton lines={6} />;

  if (tab === 'recebidos') {
    const pagas = todas.filter((c) => c.status === CHARGE_STATUS.PAID);
    return (
      <section className="space-y-4" aria-label={t('Recebidos')} data-dica="federacao-recebidos">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="font-display text-xl font-bold text-ink">{t('Recebidos')}</h2><p className="text-sm text-gray-500">{t('O que a federação já confirmou. O dinheiro entrou direto na conta do Pix.')}</p></div>
          {pagas.length > 0 && <V2Button type="button" size="sm" variant="secondary" onClick={() => baixarCsv(todas, federation.acronym)}><Download className="h-4 w-4" />{t('Baixar CSV')}</V2Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <V2StatCard icon={Wallet} label={t('Este mês')} value={formatBrlCents(resumo.paid_month_cents)} />
          <V2StatCard icon={Wallet} label={t('Mês passado')} value={formatBrlCents(resumo.paid_prev_month_cents)} />
          <V2StatCard icon={Receipt} label={t('Desde o início')} value={formatBrlCents(resumo.paid_total_cents)} hint={tn(pagas.length, '{n} pagamento', '{n} pagamentos')} />
        </div>
        {!pagas.length ? <V2EmptyState icon={Wallet} title={t('Nenhum pagamento confirmado ainda')} /> : <ul className="space-y-3">{pagas.map((c) => <ChargeRow key={c.id} charge={c} />)}</ul>}
      </section>
    );
  }

  const abertas = todas.filter((c) => [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status));
  return (
    <section className="space-y-4" aria-label={t('Cobranças')} data-dica="federacao-cobrancas">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Cobranças')}</h2><p className="text-sm text-gray-500">{t('Confira o Pix na conta da federação e confirme. Confirmar ativa (ou renova) a filiação e libera a carteirinha.')}</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2StatCard icon={Receipt} label={t('Informados para confirmar')} value={String(resumo.declared)} hint={formatBrlCents(resumo.declared_cents)} accent={resumo.declared ? 'acid' : 'ink'} />
        <V2StatCard icon={Receipt} label={t('Em aberto')} value={String(resumo.open)} hint={formatBrlCents(resumo.open_cents)} />
        <V2StatCard icon={Receipt} label={t('Vencidas')} value={String(resumo.overdue)} />
      </div>
      {!abertas.length ? <V2EmptyState icon={Receipt} title={t('Nenhuma cobrança em aberto')} description={t('Cada filiação ou renovação em plano pago gera uma cobrança aqui.')} /> : <ul className="space-y-3">{abertas.map((c) => <ChargeRow key={c.id} charge={c} />)}</ul>}
    </section>
  );
}
