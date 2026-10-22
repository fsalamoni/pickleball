/**
 * Arbitragem → DIÁRIAS (Central): quem atuou e tem diária a receber, as
 * pagas e o CSV. Marcar como paga avisa o árbitro e faz a diária virar
 * despesa nas contas da federação (`refereeFeesAsExpenses`); dá para desfazer.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, Download, Undo2, Wallet } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { refereesAction } from '@/modules/federations/services/refereesService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { amountOf, feesCsv, feesSummary, isoDateBR } from '@/modules/federations/domain/referees';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { baixarCsv } from '../manage/naoSalvo';
import { V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2StatCard, V2Surface } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { dataCurta, funcao, periodo } from './refUi';

function Linha({ a, marcado, onMarcar, onDesfazer, desfazendo }) {
  const pago = Boolean(a.paid_at_ms);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 md:grid md:grid-cols-[auto_2fr_2fr_1fr_auto] md:gap-4">
      {pago ? <span className="w-4" aria-hidden="true" /> : <input type="checkbox" className="h-4 w-4" checked={marcado} onChange={onMarcar} aria-label={t('Selecionar a diária de {nome}', { nome: a.referee_name })} />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{a.referee_name}</p>
        <p className="text-xs text-gray-500">{funcao(a.function)}</p>
      </div>
      <p className="min-w-0 text-xs text-gray-500 md:text-sm">{a.event?.name} · {periodo(a.event)}</p>
      <p className="font-display font-bold text-ink">{formatBrlCents(amountOf(a))}{a.travel_cents ? <span className="block text-2xs font-normal text-gray-500">{t('inclui {v} de deslocamento', { v: formatBrlCents(a.travel_cents) })}</span> : null}</p>
      {pago
        ? <V2Button type="button" size="sm" variant="ghost" disabled={desfazendo} onClick={onDesfazer}><Undo2 className="h-4 w-4" />{t('Desfazer ({data})', { data: dataCurta(isoDateBR(a.paid_at_ms)) })}</V2Button>
        : <span className="text-xs font-semibold text-amber-700">{t('A pagar')}</span>}
    </li>
  );
}

export default function RefFeesTab({ federation, assignmentsQ }) {
  const [sel, setSel] = useState([]);
  const [confirmar, setConfirmar] = useState(false);
  const resumo = useMemo(() => (assignmentsQ.data ? feesSummary(assignmentsQ.data) : null), [assignmentsQ.data]);
  const pagar = useFederationMutation((ids) => refereesAction({ federationId: federation.id, action: 'mark_paid', assignmentIds: ids, paid: true }));
  const desfazer = useFederationMutation((id) => refereesAction({ federationId: federation.id, action: 'mark_paid', assignmentIds: [id], paid: false }));
  const totalSel = resumo ? resumo.aPagar.filter((a) => sel.includes(a.id)).reduce((s, a) => s + amountOf(a), 0) : 0;
  return (
    <section className="space-y-4" aria-label={t('Diárias')} data-dica="federacao-arbitragem-diarias">
      {assignmentsQ.isError && <V2ErrorState inline title={t('Não carregou as diárias')} onRetry={() => assignmentsQ.refetch()} />}
      {assignmentsQ.isLoading && <V2Skeleton lines={4} />}
      {resumo && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2StatCard icon={Wallet} label={t('A pagar')} value={formatBrlCents(resumo.totalAPagar)} hint={tn(resumo.aPagar.length, '{n} diária', '{n} diárias')} />
            <V2StatCard icon={Banknote} label={t('Pago')} value={formatBrlCents(resumo.totalPago)} hint={tn(resumo.pagas.length, '{n} diária', '{n} diárias')} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <V2Button type="button" disabled={!sel.length || pagar.isPending} onClick={() => setConfirmar(true)}><Banknote className="h-4 w-4" />{sel.length ? t('Marcar {n} como pagas · {v}', { n: sel.length, v: formatBrlCents(totalSel) }) : t('Marcar como pagas')}</V2Button>
            <V2Button type="button" variant="ghost" disabled={!resumo.aPagar.length && !resumo.pagas.length} onClick={() => baixarCsv(feesCsv([...resumo.aPagar, ...resumo.pagas]), `diarias-arbitragem-${federation.acronym || federation.id}.csv`)}><Download className="h-4 w-4" />{t('Baixar CSV')}</V2Button>
          </div>
          {resumo.aPagar.length === 0 && resumo.pagas.length === 0 && (
            <V2EmptyState icon={Wallet} title={t('Nenhuma diária ainda')} description={t('A diária aparece aqui quando o evento é fechado e o árbitro consta como "Atuou".')} />
          )}
          {resumo.aPagar.length > 0 && (
            <V2Surface variant="compacto" className="space-y-2 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('A pagar')}</h3>
              <ul className="space-y-2">{resumo.aPagar.map((a) => <Linha key={a.id} a={a} marcado={sel.includes(a.id)} onMarcar={() => setSel((l) => (l.includes(a.id) ? l.filter((x) => x !== a.id) : [...l, a.id]))} />)}</ul>
            </V2Surface>
          )}
          {resumo.pagas.length > 0 && (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-xs font-bold uppercase tracking-wider text-gray-500">{t('Pagas ({n})', { n: resumo.pagas.length })}</summary>
              <ul className="mt-2 space-y-2">{resumo.pagas.map((a) => <Linha key={a.id} a={a} desfazendo={desfazer.isPending} onDesfazer={() => desfazer.mutate(a.id, { onSuccess: () => toast.success(t('Pagamento desfeito.')), onError: (e) => toast.error(e.message) })} />)}</ul>
            </details>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        loading={pagar.isPending}
        title={t('Registrar o pagamento de {n} diárias?', { n: sel.length })}
        description={t('Total de {v}. Cada árbitro é avisado e a diária entra como despesa nas contas da federação. Dá para desfazer.', { v: formatBrlCents(totalSel) })}
        confirmLabel={t('Registrar o pagamento')}
        cancelLabel={t('Voltar')}
        onConfirm={() => pagar.mutate(sel, { onSuccess: () => { toast.success(t('Pagamento registrado.')); setSel([]); setConfirmar(false); }, onError: (e) => toast.error(e.message) })}
      />
    </section>
  );
}
