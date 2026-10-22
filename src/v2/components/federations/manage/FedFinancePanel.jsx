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
import { V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Skeleton, V2StatCard, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { t, tn } from '@/core/i18n';
import { ChargeStatusBadge, quando } from '../federationUi';
import { BuscaLista, MostrarMais, useBuscaLista, useFiltroNaUrl } from './listTools';
import { baixarCsv } from './naoSalvo';

function ChargeRow({ charge: c }) {
  const [nota, setNota] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const m = useFederationMutation(({ action, note }) => chargeAction({ chargeId: c.id, action, note }));
  const agir = (action, msg, note = nota) => m.mutate({ action, note }, { onSuccess: () => { setCancelando(false); toast.success(msg); }, onError: (e) => toast.error(e.message) });
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
            <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => { setMotivo(''); setCancelando(true); }}><XCircle className="h-4 w-4" />{t('Cancelar cobrança')}</V2Button>
          </div>
        )}
        <ConfirmDialog
          open={cancelando}
          onOpenChange={setCancelando}
          destructive
          loading={m.isPending}
          title={t('Cancelar a cobrança de {nome}?', { nome: c.payer_name || '' })}
          description={`${{
            membership: t('O pedido de filiação volta para a secretaria decidir de novo.'),
            course: t('A inscrição no curso é cancelada e a vaga volta.'),
          }[c.origin] || ''} ${t('A pessoa recebe um aviso com o motivo.')}`.trim()}
          confirmLabel={t('Cancelar cobrança')}
          cancelLabel={t('Voltar')}
          onConfirm={() => agir('cancel', t('Cobrança cancelada. A pessoa foi avisada.'), motivo.trim())}
        >
          <V2Field label={t('Motivo (opcional)')} htmlFor={`cob-cancel-${c.id}`}>
            <V2Textarea id={`cob-cancel-${c.id}`} rows={2} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t('ex.: pagamento feito em dinheiro na secretaria')} />
          </V2Field>
        </ConfirmDialog>
      </V2Surface>
    </li>
  );
}

const FILTROS = [
  { id: 'todas', label: () => t('Todas'), ok: () => true },
  { id: 'informadas', label: () => t('Informadas'), ok: (c) => c.status === CHARGE_STATUS.DECLARED },
  { id: 'vencidas', label: () => t('Vencidas'), ok: (c) => isChargeOverdue(c) },
];
const BUSCA = (c) => `${c.payer_name} ${c.plan_name}`;

export default function FedFinancePanel({ federation, chargesQ, tab }) {
  const todas = useMemo(() => sortChargesForStaff(chargesQ.data || []), [chargesQ.data]);
  const resumo = useMemo(() => financeSummary(todas), [todas]);
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'todas', FILTROS.map((f) => f.id));
  const recebidos = tab === 'recebidos';
  const pagas = useMemo(() => todas.filter((c) => c.status === CHARGE_STATUS.PAID), [todas]);
  const abertas = useMemo(() => todas.filter((c) => [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status)), [todas]);
  const doFiltro = useMemo(() => (recebidos ? pagas : abertas.filter((FILTROS.find((f) => f.id === filtro) || FILTROS[0]).ok)), [recebidos, pagas, abertas, filtro]);
  const busca = useBuscaLista(doFiltro, BUSCA);
  if (chargesQ.isError) return <V2ErrorState title={t('Não carregaram as cobranças')} onRetry={() => chargesQ.refetch()} />;
  if (chargesQ.isLoading) return <V2Skeleton lines={6} />;

  const lista = (
    <>
      <ul className="space-y-3">{busca.visiveis.map((c) => <ChargeRow key={c.id} charge={c} />)}</ul>
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
    </>
  );
  const semAchados = <V2EmptyState icon={Receipt} title={t('Nenhuma cobrança com "{termo}"', { termo: busca.termo.trim() })} description={t('Confira a grafia ou limpe a busca.')} />;

  if (recebidos) {
    return (
      <section className="space-y-4" aria-label={t('Recebidos')} data-dica="federacao-recebidos">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="font-display text-xl font-bold text-ink">{t('Recebidos')}</h2><p className="text-sm text-gray-500">{t('O que a federação já confirmou. O dinheiro entrou direto na conta do Pix.')}</p></div>
          {pagas.length > 0 && <V2Button type="button" size="sm" variant="secondary" onClick={() => baixarCsv(chargesCsv(todas), `cobrancas-${(federation.acronym || 'federacao').toLowerCase()}.csv`)}><Download className="h-4 w-4" />{t('Baixar planilha (CSV)')}</V2Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <V2StatCard icon={Wallet} label={t('Este mês')} value={formatBrlCents(resumo.paid_month_cents)} />
          <V2StatCard icon={Wallet} label={t('Mês passado')} value={formatBrlCents(resumo.paid_prev_month_cents)} />
          <V2StatCard icon={Receipt} label={t('Desde o início')} value={formatBrlCents(resumo.paid_total_cents)} hint={tn(pagas.length, '{n} pagamento', '{n} pagamentos')} />
        </div>
        {pagas.length > 0 && <BuscaLista id="fed-recebidos-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por nome ou plano')} total={pagas.length} achados={busca.filtrados.length} className="sm:max-w-sm" />}
        {!pagas.length ? <V2EmptyState icon={Wallet} title={t('Nenhum pagamento confirmado ainda')} description={t('Quando você confirmar um pagamento em Cobranças, ele aparece aqui.')} />
          : !busca.filtrados.length ? semAchados : lista}
      </section>
    );
  }

  const contas = Object.fromEntries(FILTROS.map((f) => [f.id, abertas.filter(f.ok).length]));
  return (
    <section className="space-y-4" aria-label={t('Cobranças')} data-dica="federacao-cobrancas">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Cobranças')}</h2><p className="text-sm text-gray-500">{t('Confira o Pix na conta da federação e confirme. Confirmar ativa (ou renova) a filiação e libera a carteirinha.')}</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2StatCard icon={Receipt} label={t('Informados para confirmar')} value={String(resumo.declared)} hint={formatBrlCents(resumo.declared_cents)} accent={resumo.declared ? 'acid' : 'ink'} />
        <V2StatCard icon={Receipt} label={t('Em aberto')} value={String(resumo.open)} hint={formatBrlCents(resumo.open_cents)} />
        <V2StatCard icon={Receipt} label={t('Vencidas')} value={String(resumo.overdue)} />
      </div>
      {abertas.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filtro')}>
            {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{`${f.label()} (${contas[f.id]})`}</V2FilterChip>)}
          </div>
          <BuscaLista id="fed-cobrancas-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por nome ou plano')} total={doFiltro.length} achados={busca.filtrados.length} className="sm:w-72" />
        </div>
      )}
      {!abertas.length ? <V2EmptyState icon={Receipt} title={t('Nenhuma cobrança em aberto')} description={t('Cada filiação ou renovação em plano pago gera uma cobrança aqui.')} />
        : !doFiltro.length ? <V2EmptyState icon={Receipt} title={filtro === 'informadas' ? t('Nenhum pagamento informado para confirmar') : t('Nenhuma cobrança vencida')} description={t('Veja todas as cobranças em aberto no filtro "Todas".')} />
          : !busca.filtrados.length ? semAchados : lista}
    </section>
  );
}
