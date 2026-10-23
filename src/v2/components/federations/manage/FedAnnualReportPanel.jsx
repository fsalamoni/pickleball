/**
 * Relatório anual de atividades (Central → Indicadores → Relatório anual, só
 * o admin da federação): o ano escolhido, montado por `annualReport` com o que
 * a Central já leu, na mesma folha da tela e do papel. Imprimir / PDF usa a
 * folha de impressão da plataforma (`cartao-folha-raiz recibo-folha`). Zero
 * banco: o ranking da temporada é a única leitura própria (documento público).
 */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileBarChart, Printer } from 'lucide-react';
import { annualReport, annualReportYears } from '@/modules/federations/domain/annualReport';
import { complianceChecklist } from '@/modules/federations/domain/compliance';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { useFederationRanking } from '@/modules/federations/hooks/useFederations';
import { V2Button, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { fmtData, t } from '@/core/i18n';

const dados = (q) => (q?.isSuccess ? q.data || [] : undefined);

/** A folha (tela e papel desenham a MESMA). */
function ReportSheet({ r }) {
  const f = r.federation;
  return (
    <article className="space-y-6 bg-white p-6 text-sm text-ink sm:p-8" aria-label={t('Relatório anual de atividades')}>
      <header className="flex items-center gap-4 border-b border-gray-200 pb-4">
        {f.logo ? <img src={f.logo} alt="" className="h-14 w-14 rounded-lg object-contain" /> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 font-display text-lg font-bold" aria-hidden="true">{(f.acronym || f.name).slice(0, 3)}</span>}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{f.name}</p>
          <p className="text-xs text-gray-600">{[f.acronym, f.cnpj ? t('CNPJ {n}', { n: f.cnpj }) : '', f.city].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      <h2 className="font-display text-xl font-bold">{t('Relatório anual de atividades {ano}', { ano: r.year })}</h2>
      {r.sections.map((s) => (
        <section key={s.id} className="space-y-2 break-inside-avoid">
          <h3 className="border-b border-gray-200 pb-1 font-display text-base font-bold">{t(s.title)}</h3>
          {s.missing.length > 0 && (
            <p className="flex items-start gap-2 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('Não deu para conferir: {lista}. O número fica de fora em vez de sair errado.', { lista: s.missing.join(', ') })}</p>
          )}
          {s.rows.length > 0 && (
            <dl className="grid gap-x-6 sm:grid-cols-2">
              {s.rows.map((x) => <div key={x.label} className="flex justify-between gap-4 border-b border-gray-100 py-1.5"><dt className="text-gray-600">{x.label}</dt><dd className="text-right font-semibold tabular-nums">{x.value}</dd></div>)}
            </dl>
          )}
          {s.list.length > 0 && (
            <div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t(s.listTitle)}</p>
              <ul className="mt-1 space-y-0.5">{s.list.map((x, i) => <li key={`${x.label}-${i}`} className="flex justify-between gap-4"><span>{x.label}</span><span className="text-right text-gray-700">{x.value}</span></li>)}</ul>
            </div>
          )}
          {s.note && <p className="text-xs text-gray-500">{s.note}</p>}
        </section>
      ))}
      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-600">
        {t('Gerado pela PickleRush em {data}, com os dados que a federação mantém na plataforma.', { data: fmtData(new Date()) })}
      </footer>
    </article>
  );
}

export default function FedAnnualReportPanel({ federation, membersQ, chargesQ, tournamentsQ, resultsQ, coursesQ, reportsQ, sanctionsQ, accountReportsQ, staffQ, docsQ, eventsQ, budgetsQ, electionsQ }) {
  const anos = useMemo(() => annualReportYears(), []);
  const [ano, setAno] = useState(anos[0]);
  const rankingQ = useFederationRanking(federation?.id, ano, { enabled: fedModuleOn(federation, 'ranking') });
  const fontes = [membersQ, chargesQ, tournamentsQ, resultsQ, coursesQ, reportsQ, sanctionsQ, accountReportsQ, staffQ, docsQ, eventsQ, budgetsQ, electionsQ, rankingQ];
  const carregando = fontes.some((q) => q?.isLoading);
  const r = useMemo(() => {
    const compliance = complianceChecklist({ federation, staff: dados(staffQ), docs: dados(docsQ), events: dados(eventsQ), budgets: dados(budgetsQ), accountReports: dados(accountReportsQ), elections: dados(electionsQ), tournaments: dados(tournamentsQ) });
    return annualReport({
      federation, year: ano, compliance,
      members: dados(membersQ), charges: dados(chargesQ), tournaments: dados(tournamentsQ), results: dados(resultsQ), courses: dados(coursesQ),
      reports: dados(reportsQ), sanctions: dados(sanctionsQ), accountReports: dados(accountReportsQ),
      ranking: rankingQ.isSuccess ? rankingQ.data || null : undefined,
    });
  }, [federation, ano, ...fontes.map((q) => q?.data), ...fontes.map((q) => q?.isSuccess)]); // eslint-disable-line react-hooks/exhaustive-deps

  function imprimir() {
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  }

  return (
    <section className="space-y-4" aria-label={t('Relatório anual')} data-dica="federacao-relatorio-anual">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><FileBarChart className="h-5 w-5" aria-hidden="true" />{t('Relatório anual de atividades')}</h2>
          <p className="text-sm text-gray-500">{t('Para a assembleia e para a transparência: o ano da federação montado com o que já está na plataforma. Imprima ou salve em PDF e publique no acervo.')}</p>
        </div>
        <div className="flex gap-2">
          <V2Select aria-label={t('Ano')} className="h-10 w-28" value={ano} onChange={(e) => setAno(Number(e.target.value))} options={anos.map((a) => ({ value: a, label: String(a) }))} />
          <V2Button type="button" disabled={carregando} onClick={imprimir} data-dica="federacao-relatorio-imprimir"><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>
        </div>
      </div>
      {carregando ? <V2Skeleton lines={8} /> : <div className="tema-claro overflow-hidden rounded-2xl border border-gray-200"><ReportSheet r={r} /></div>}
      {!carregando && createPortal(<div className="cartao-folha-raiz recibo-folha tema-claro hidden" aria-hidden="true"><ReportSheet r={r} /></div>, document.body)}
    </section>
  );
}
