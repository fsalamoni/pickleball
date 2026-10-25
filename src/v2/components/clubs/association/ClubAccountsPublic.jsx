/**
 * A TRANSPARÊNCIA das contas na página do clube (Bloco D1): as prestações de
 * contas publicadas (totais congelados no envio ao conselho fiscal, parecer e
 * assembleia), o orçamento aprovado e a execução resumida do último ano —
 * nunca a conta ao vivo. Só o que tem `pub: true` (a regra confere, e só com a
 * associação aberta ao público). Sem nada publicado, a seção não aparece;
 * consulta que falhou diz que não carregou.
 */
import React, { useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { usePublicClubAccounts } from '@/modules/clubs/hooks/useClubAccounts';
import { budgetVsActual, isAnnualPeriod } from '@/modules/federations/domain/accounts';
import { V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { BudgetVsActualTable, TotalsTiles } from '@/v2/components/federations/accounts/accountsUi';
import { BudgetItem, ReportItem } from '@/v2/components/federations/accounts/FedAccountsPublic';

export default function ClubAccountsPublic({ clubId, enabled = true }) {
  const { budgets, reports } = usePublicClubAccounts(clubId, { enabled });
  const relatorios = useMemo(() => [...(reports.data || [])].sort((a, b) => String(b.period).localeCompare(String(a.period))), [reports.data]);
  const orcamentos = useMemo(() => [...(budgets.data || [])].filter((b) => b.published).sort((a, b) => b.year - a.year), [budgets.data]);
  const execucao = relatorios.find((r) => isAnnualPeriod(r.period) && r.snapshot?.budget_lines);
  if (!enabled || budgets.isLoading || reports.isLoading) return enabled ? <V2Skeleton lines={2} /> : null;
  const falhou = budgets.isError || reports.isError;
  // Sem nada publicado (e sem falha) a seção não existe: não há o que mostrar nem convidar a procurar.
  if (!falhou && relatorios.length === 0 && orcamentos.length === 0) return null;
  return (
    <section id="clube-contas" aria-labelledby="clube-contas-titulo" className="scroll-mt-4 space-y-3" data-dica="clube-contas-publicas">
      <h2 id="clube-contas-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Calculator className="h-5 w-5" aria-hidden="true" />{t('Orçamento e contas')}</h2>
      {reports.isError && <V2ErrorState inline title={t('As prestações de contas não carregaram')} onRetry={() => reports.refetch()} />}
      {budgets.isError && <V2ErrorState inline title={t('Os orçamentos não carregaram')} onRetry={() => budgets.refetch()} />}
      {execucao && (
        <V2Surface variant="compacto" className="space-y-3 p-4">
          <h3 className="font-bold text-ink">{t('Execução do orçamento de {ano}', { ano: execucao.period })}</h3>
          <TotalsTiles income={execucao.snapshot.income_total} expense={execucao.snapshot.expense_total} balance={execucao.snapshot.balance} />
          <BudgetVsActualTable rows={budgetVsActual(execucao.snapshot.budget_lines, execucao.snapshot)} caption={t('Orçado × realizado em {ano}', { ano: execucao.period })} />
        </V2Surface>
      )}
      {relatorios.length > 0 && (
        <div className="space-y-2">
          <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Prestações de contas')}</p>
          <ul className="space-y-3">{relatorios.map((r) => <ReportItem key={r.id} federation={null} r={r} />)}</ul>
        </div>
      )}
      {orcamentos.length > 0 && (
        <div className="space-y-2">
          <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Orçamentos aprovados')}</p>
          <ul className="space-y-3">{orcamentos.map((b) => <BudgetItem key={b.id} b={b} />)}</ul>
        </div>
      )}
    </section>
  );
}
