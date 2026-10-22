/**
 * As CONTAS na página da federação (aba Documentos, âncora `#fed-contas`,
 * módulo `accounts`): os orçamentos aprovados e publicados, as prestações de
 * contas publicadas (totais CONGELADOS no envio ao conselho fiscal, parecer,
 * assembleia e os atos do acervo) e a execução resumida do último ano —
 * nunca a conta ao vivo. Só o que tem `pub: true`; a regra confere.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, FileText } from 'lucide-react';
import { usePublicAccounts } from '@/modules/federations/hooks/useAccounts';
import { ASSEMBLY_RESULTS, OPINION_VERDICTS, budgetTotals, budgetVsActual, categoryLabel, isAnnualPeriod, periodLabel } from '@/modules/federations/domain/accounts';
import { docPublicPath } from '@/modules/federations/domain/acervo';
import { V2Badge, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import { BudgetVsActualTable, TotalsTiles, reais } from './accountsUi';

const rotulo = (lista, id) => { const x = lista.find((v) => v.id === id); return x ? t(x.label) : ''; };

function ReportItem({ federation, r }) {
  const s = r.snapshot || {};
  const verdict = rotulo(OPINION_VERDICTS, r.fiscal_opinion?.verdict);
  return (
    <li className="space-y-3 rounded-2xl border border-gray-100 bg-paper-pure p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{periodLabel(r.period)}</p>
        <span className="text-xs text-gray-500">{s.from && s.to ? `${quando(s.from)} – ${quando(s.to)}` : ''}</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-gray-500">{t('Receitas')}</dt><dd className="font-semibold tabular-nums text-ink">{reais(s.income_total)}</dd></div>
        <div><dt className="text-xs text-gray-500">{t('Despesas')}</dt><dd className="font-semibold tabular-nums text-ink">{reais(s.expense_total)}</dd></div>
        <div><dt className="text-xs text-gray-500">{t('Resultado')}</dt><dd className={`font-semibold tabular-nums ${Number(s.balance) < 0 ? 'text-red-600' : 'text-ink'}`}>{reais(s.balance)}</dd></div>
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {verdict && <V2Badge tone={r.fiscal_opinion.verdict === 'reject' ? 'red' : r.fiscal_opinion.verdict === 'approve' ? 'green' : 'amber'}>{t('Conselho fiscal: {parecer}', { parecer: verdict })}</V2Badge>}
        {r.assembly?.result && <V2Badge tone={r.assembly.result === 'approved' ? 'green' : 'red'}>{t('Assembleia de {data}: {resultado}', { data: quando(r.assembly.date), resultado: rotulo(ASSEMBLY_RESULTS, r.assembly.result) })}</V2Badge>}
      </div>
      {r.acervo?.statements_doc_id && (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to={docPublicPath(federation, r.acervo.statements_doc_id)} className="inline-flex min-h-11 items-center gap-1 font-bold text-ink underline"><FileText className="h-4 w-4" aria-hidden="true" />{t('Demonstrações')}{r.acervo.statements_code ? ` (${r.acervo.statements_code})` : ''}</Link>
          {r.acervo.opinion_doc_id && <Link to={docPublicPath(federation, r.acervo.opinion_doc_id)} className="inline-flex min-h-11 items-center gap-1 font-bold text-ink underline"><FileText className="h-4 w-4" aria-hidden="true" />{t('Parecer do conselho fiscal')}</Link>}
        </div>
      )}
    </li>
  );
}

function BudgetItem({ b }) {
  const p = b.published || {};
  const lines = p.lines || {};
  const tot = budgetTotals(lines);
  const linhas = Object.entries(lines).filter(([, v]) => v > 0);
  return (
    <li className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-ink">{t('Orçamento de {ano}', { ano: b.year })}</span>
          <span className="text-sm tabular-nums text-gray-500">{t('Receitas {r} · Despesas {d}', { r: reais(tot.income), d: reais(tot.expense) })}</span>
        </summary>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {linhas.map(([k, v]) => { const [kind, cat] = k.split('.'); return <li key={k} className="flex justify-between gap-2"><span className="text-gray-500">{kind === 'expense' ? t('Despesa') : t('Receita')} · {categoryLabel(kind, cat)}</span><span className="tabular-nums text-ink">{reais(v)}</span></li>; })}
        </ul>
        {p.approved_in?.date && <p className="mt-2 text-xs text-gray-500">{t('Aprovado em {data}', { data: quando(p.approved_in.date) })}{p.approved_in.event_title ? ` · ${p.approved_in.event_title}` : ''}</p>}
        {p.notes && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{p.notes}</p>}
      </details>
    </li>
  );
}

export default function FedAccountsPublic({ federation }) {
  const { on, budgets, reports } = usePublicAccounts(federation);
  const relatorios = useMemo(() => [...(reports.data || [])].sort((a, b) => String(b.period).localeCompare(String(a.period))), [reports.data]);
  const orcamentos = useMemo(() => [...(budgets.data || [])].filter((b) => b.published).sort((a, b) => b.year - a.year), [budgets.data]);
  // A execução resumida: a última prestação ANUAL publicada que levou o orçamento aprovado.
  const execucao = relatorios.find((r) => isAnnualPeriod(r.period) && r.snapshot?.budget_lines);
  if (!on) return null;
  const carregando = budgets.isLoading || reports.isLoading;
  return (
    <section id="fed-contas" aria-labelledby="fed-contas-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-contas">
      <h2 id="fed-contas-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Calculator className="h-5 w-5" aria-hidden="true" />{t('Orçamento e contas')}</h2>
      {carregando ? <V2Skeleton lines={3} /> : (
        <>
          {reports.isError && <V2ErrorState inline title={t('As prestações de contas não carregaram')} onRetry={reports.refetch} />}
          {budgets.isError && <V2ErrorState inline title={t('Os orçamentos não carregaram')} onRetry={budgets.refetch} />}
          {reports.isSuccess && budgets.isSuccess && relatorios.length === 0 && orcamentos.length === 0 && (
            <p className="text-sm text-gray-500">{t('A federação ainda não publicou orçamento nem prestação de contas por aqui.')}</p>
          )}
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
              <ul className="space-y-3">{relatorios.map((r) => <ReportItem key={r.id} federation={federation} r={r} />)}</ul>
            </div>
          )}
          {orcamentos.length > 0 && (
            <div className="space-y-2">
              <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Orçamentos aprovados')}</p>
              <ul className="space-y-3">{orcamentos.map((b) => <BudgetItem key={b.id} b={b} />)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
