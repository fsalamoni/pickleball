/**
 * RELATÓRIO ANUAL DE PROTEÇÃO DA INFÂNCIA (Central → Proteção de menores →
 * Relatório anual, só quem tem a permissão `safeguarding`). A Lei Geral do
 * Esporte (art. 36, XIII, "h") pede que a entidade preste contas das medidas
 * de proteção de crianças e adolescentes. A folha sai SÓ COM NÚMEROS — nenhum
 * nome, nenhum relato —, contada por `safeguardingAnnualReport` com o que a
 * aba já leu. O quadro de quem trabalha com menores é a situação de hoje; as
 * denúncias são as recebidas no ano escolhido. Fonte que falhou é dita, nunca
 * vira zero.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Printer } from 'lucide-react';
import { safeguardingAnnualReport } from '@/modules/federations/domain/institutional';
import { SG_ROLE_LABELS } from '@/modules/federations/domain/safeguarding';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { V2Button, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import PrintSheet, { imprimirFolha } from './PrintSheet';

const Linha = ({ label, value }) => <div className="flex justify-between gap-4 border-b border-gray-100 py-1.5"><dt className="text-gray-600">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>;
const Falhou = ({ children }) => <p className="flex items-start gap-2 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{children}</p>;

export default function SafeguardingReport({ federation, overviewQ, minorReportsQ }) {
  const anoAtual = Number(isoDateBR().slice(0, 4));
  const anos = [anoAtual, anoAtual - 1, anoAtual - 2];
  const [ano, setAno] = useState(anoAtual);
  const r = useMemo(() => safeguardingAnnualReport({
    rows: overviewQ?.isSuccess ? overviewQ.data?.rows || [] : undefined,
    reports: minorReportsQ?.isSuccess ? minorReportsQ.data || [] : undefined,
    year: ano,
  }), [ano, overviewQ?.isSuccess, overviewQ?.data, minorReportsQ?.isSuccess, minorReportsQ?.data]);
  const carregando = overviewQ?.isLoading || minorReportsQ?.isLoading;
  const q = r.staff;
  const d = r.reports;
  return (
    <section className="space-y-4" aria-label={t('Relatório anual de proteção da infância')} data-dica="federacao-protecao-relatorio">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-gray-500">{t('A prestação de contas das medidas de proteção de crianças e adolescentes (Lei 14.597/2023, art. 36). Só números: nenhum nome e nenhum relato saem na folha. Imprima ou salve em PDF e publique no acervo.')}</p>
        <div className="flex shrink-0 gap-2">
          <V2Select aria-label={t('Ano')} className="h-10 w-28" value={ano} onChange={(e) => setAno(Number(e.target.value))} options={anos.map((a) => ({ value: a, label: String(a) }))} />
          <V2Button type="button" disabled={carregando} onClick={imprimirFolha}><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>
        </div>
      </div>
      {carregando ? <V2Skeleton lines={8} /> : (
        <PrintSheet federation={federation} title={t('Relatório de proteção da infância {ano}', { ano })}>
          <section className="space-y-2 break-inside-avoid">
            <h3 className="border-b border-gray-200 pb-1 font-display text-base font-bold">{t('Quem trabalha com menores (situação em {data})', { data: isoDateBR().split('-').reverse().join('/') })}</h3>
            {!q ? <Falhou>{t('Não deu para ler o quadro de quem trabalha com menores. Os números ficam de fora em vez de sair errados.')}</Falhou> : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <Linha label={t('Pessoas acompanhadas')} value={q.people} />
                <Linha label={t('Precisam estar em dia')} value={q.required} />
                <Linha label={t('Em dia (curso e certidão)')} value={q.cleared} />
                <Linha label={t('Com curso de proteção válido')} value={q.trainingOk} />
                <Linha label={t('Com certidão de antecedentes conferida')} value={q.backgroundOk} />
                <Linha label={t('Certidões esperando conferência')} value={q.pendingReview} />
                {Object.entries(q.byRole).map(([k, n]) => <Linha key={k} label={t(SG_ROLE_LABELS[k] || k)} value={n} />)}
              </dl>
            )}
          </section>
          <section className="space-y-2 break-inside-avoid">
            <h3 className="border-b border-gray-200 pb-1 font-display text-base font-bold">{t('Denúncias de proteção de menor recebidas em {ano}', { ano })}</h3>
            {!d ? <Falhou>{t('Não deu para ler as denúncias. Os números ficam de fora em vez de sair errados.')}</Falhou> : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <Linha label={t('Recebidas')} value={d.received} />
                <Linha label={t('Anônimas')} value={d.anonymous} />
                <Linha label={t('Ainda sem apuração')} value={d.open} />
                <Linha label={t('Em apuração')} value={d.inReview} />
                <Linha label={t('Concluídas')} value={d.closed} />
              </dl>
            )}
          </section>
          <p className="text-xs text-gray-500">{t('Exigências: curso de proteção válido e certidão de antecedentes conferida para quem a federação definiu nas regras. Havendo risco a criança ou adolescente, a federação aciona o Conselho Tutelar ou o Disque 100.')}</p>
        </PrintSheet>
      )}
    </section>
  );
}
