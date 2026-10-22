/**
 * CONTAS da federação na Central (seção Contas, módulo `accounts`): Visão
 * geral · Orçamento · Lançamentos · Prestação de contas. O financeiro (ou o
 * admin) prepara; o conselho fiscal vê tudo em leitura e dá o parecer.
 *
 * As receitas das cobranças pagas entram sozinhas (`accountItems`); a
 * conta é a MESMA do servidor (`functions/federationAccountsPolicy.js`, com
 * paridade). Toda escrita é do servidor (`federationAccounts`). Fonte que
 * falhou vira aviso com "Tentar de novo" — nunca um zero.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Eye } from 'lucide-react';
import { useFederationCharges } from '@/modules/federations/hooks/useFederations';
import { useFederationBudgets, useFederationLedger } from '@/modules/federations/hooks/useAccounts';
import {
  ACCOUNT_REPORT_STATUS, ACCOUNT_REPORT_STATUS_LABELS, BUDGET_STATUS_LABELS, accountItems, budgetVsActual, canPrepareAccounts, dateBR, itemsInPeriod, legalDeadline, monthlySeries, totalsByCategory,
} from '@/modules/federations/domain/accounts';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { quando } from '../../federationUi';
import { BudgetVsActualTable, MonthlyBars, TotalsTiles } from '../../accounts/accountsUi';
import { YearSelect, accountYears } from './accountsForms';
import FedBudgetTab from './FedBudgetTab';
import FedLedgerTab from './FedLedgerTab';
import FedReportsTab from './FedReportsTab';

function Overview({ items, budgets, reports, hoje, onIrParaAba }) {
  const anoAtual = Number(hoje.slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const anos = useMemo(() => accountYears(items, budgets, anoAtual), [items, budgets, anoAtual]);
  const totais = useMemo(() => totalsByCategory(itemsInPeriod(items, String(ano))), [items, ano]);
  const serie = useMemo(() => monthlySeries(items, ano), [items, ano]);
  const budget = budgets.find((b) => Number(b.year) === ano);
  const linhas = budget ? budgetVsActual(budget.lines, totais) : [];
  const alertas = linhas.filter((r) => r.alert !== 'ok');
  const anterior = anoAtual - 1;
  const prestacao = reports.find((r) => r.period === String(anterior));
  const prazo = legalDeadline(anterior);
  const publicada = prestacao?.status === ACCOUNT_REPORT_STATUS.PUBLISHED;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <YearSelect id="ct-ano" value={ano} onChange={setAno} years={anos} />
        <V2Surface variant="compacto" className={`flex items-start gap-2 p-3 text-sm ${publicada ? '' : hoje > prazo ? 'border-red-200 bg-red-50' : ''}`}>
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
          <p>
            <span className="font-semibold text-ink">{t('Contas de {ano}', { ano: anterior })}: </span>
            {prestacao ? t(ACCOUNT_REPORT_STATUS_LABELS[prestacao.status] || prestacao.status) : t('não aberta')}
            {!publicada && <span className="text-gray-500"> · {t('prazo legal {data}', { data: quando(prazo) })}</span>}
          </p>
        </V2Surface>
      </div>
      <TotalsTiles income={totais.income_total} expense={totais.expense_total} balance={totais.balance} />
      <MonthlyBars titulo={t('Receitas e despesas em {ano}', { ano })} serie={serie} />
      <V2Surface className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ink">{t('Orçado × realizado')}</h3>
          {budget && <V2Badge tone={budget.status === 'published' || budget.status === 'approved' ? 'green' : 'neutral'}>{t(BUDGET_STATUS_LABELS[budget.status] || budget.status)}</V2Badge>}
        </div>
        {alertas.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {tn(alertas.length, '{n} categoria de despesa pede atenção: estourou, perto do limite ou sem orçamento.', '{n} categorias de despesa pedem atenção: estouraram, perto do limite ou sem orçamento.')}
          </p>
        )}
        {budget ? <BudgetVsActualTable rows={linhas} caption={t('Orçado × realizado em {ano}', { ano })} /> : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500">{t('Ainda não há orçamento para {ano}.', { ano })}</p>
            <V2Button type="button" variant="secondary" size="sm" onClick={() => onIrParaAba('orcamento-anual')}>{t('Abrir o orçamento')}</V2Button>
          </div>
        )}
      </V2Surface>
    </div>
  );
}

export default function FedAccountsPanel({ federation, perms, tab, reportsQ, onIrParaAba }) {
  const id = federation.id;
  const budgetsQ = useFederationBudgets(id);
  const ledgerQ = useFederationLedger(id);
  const chargesQ = useFederationCharges(id);
  const hoje = dateBR(Date.now());
  const qs = [budgetsQ, ledgerQ, chargesQ, reportsQ];
  const items = useMemo(() => accountItems({ ledger: ledgerQ.data, charges: chargesQ.data, extraExpenses: [] }), [ledgerQ.data, chargesQ.data]);
  if (qs.some((q) => q.isError)) return <V2ErrorState title={t('As contas não carregaram')} onRetry={() => qs.forEach((q) => { if (q.isError) q.refetch(); })} />;
  if (qs.some((q) => q.isLoading || !q.isSuccess)) return <V2Skeleton lines={6} />;
  const leitura = !canPrepareAccounts(perms);
  const comum = { federation, perms, items, budgets: budgetsQ.data, ledger: ledgerQ.data, reports: reportsQ.data, hoje };
  return (
    <section className="space-y-4" aria-label={t('Contas da federação')} data-dica="federacao-contas">
      {leitura && (
        <p className="flex items-start gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-3 text-sm text-gray-700">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('Você vê as contas em leitura (conselho fiscal). O parecer é dado em Prestação de contas, depois que o financeiro envia.')}
        </p>
      )}
      {tab === 'orcamento' && <Overview {...comum} onIrParaAba={onIrParaAba} />}
      {tab === 'orcamento-anual' && <FedBudgetTab {...comum} />}
      {tab === 'lancamentos' && <FedLedgerTab {...comum} charges={chargesQ.data} />}
      {tab === 'prestacao-contas' && <FedReportsTab {...comum} />}
    </section>
  );
}
