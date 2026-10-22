/**
 * Indicadores da federação (Central → Gerir → Indicadores): os últimos 12
 * meses de filiados e de dinheiro, para a diretoria e a prestação de contas.
 * As contas são de `domain/indicators.js`; aqui só se desenha. Cada bloco
 * depende da SUA fonte (filiados: permissão `members`; dinheiro: `finance`) —
 * fonte que falhou vira aviso com "Tentar de novo", nunca zero. Zero banco:
 * usa as mesmas leituras que a Central já faz.
 */
import React, { useMemo } from 'react';
import { BarChart3, Download, Receipt, RefreshCcw, Users, Wallet } from 'lucide-react';
import { federationIndicators, indicatorsCsv } from '@/modules/federations/domain/indicators';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { CHARGE_ORIGIN_LABELS, FED_PERMISSION, PLAN_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Button, V2ErrorState, V2Skeleton, V2StatCard, V2Surface } from '@/v2/ui/primitives';
import { t, fmtData, fmtNumero } from '@/core/i18n';
import { baixarCsv } from './naoSalvo';

const mesCurto = (m) => fmtData(new Date(`${m}-15T12:00:00`), { month: 'short' }).replace('.', '');
const mesLongo = (m) => fmtData(new Date(`${m}-15T12:00:00`), { month: 'long', year: 'numeric' });

/**
 * Colunas mês a mês, uma série só (o título a nomeia). O valor de cada mês
 * aparece ao passar o mouse/tocar (title) e numa tabela para leitor de tela;
 * só o maior mês e o atual levam o número escrito.
 */
function MonthBars({ titulo, dados, formatar }) {
  const max = Math.max(0, ...dados.map((d) => d.v));
  const ultimo = dados.length - 1;
  const iMax = dados.findIndex((d) => d.v === max);
  return (
    <V2Surface className="space-y-3">
      <h3 className="font-display text-base font-bold text-ink">{titulo}</h3>
      {max === 0 ? <p className="text-sm text-gray-500">{t('Nada nos últimos 12 meses.')}</p> : (
        <div className="flex h-40 items-end gap-1" aria-hidden="true">
          {dados.map((d, i) => (
            <div key={d.m} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${mesLongo(d.m)}: ${formatar(d.v)}`}>
              {(i === iMax || i === ultimo) && d.v > 0 && <span className="truncate text-2xs font-semibold tabular-nums text-gray-700">{formatar(d.v)}</span>}
              <div className="w-full max-w-8 rounded-t bg-ink/80" style={{ height: `${d.v > 0 ? Math.max(2, (d.v / max) * 100) : 0}%` }} />
            </div>
          ))}
        </div>
      )}
      {max > 0 && (
        <div className="flex gap-1" aria-hidden="true">
          {dados.map((d) => <span key={d.m} className="min-w-0 flex-1 truncate text-center text-2xs text-gray-500">{mesCurto(d.m)}</span>)}
        </div>
      )}
      <table className="sr-only">
        <caption>{titulo}</caption>
        <tbody>{dados.map((d) => <tr key={d.m}><th scope="row">{mesLongo(d.m)}</th><td>{formatar(d.v)}</td></tr>)}</tbody>
      </table>
    </V2Surface>
  );
}

/** Barras horizontais de uma divisão (rótulo, barra, número). */
function BarList({ titulo, itens, formatar = (v) => fmtNumero(v), vazio }) {
  const max = Math.max(0, ...itens.map((x) => x.v));
  return (
    <V2Surface className="space-y-3">
      <h3 className="font-display text-base font-bold text-ink">{titulo}</h3>
      {itens.length === 0 ? <p className="text-sm text-gray-500">{vazio || t('Ninguém em dia ainda.')}</p> : (
        <ul className="space-y-2">
          {itens.map((x) => (
            <li key={x.k} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-gray-700">{x.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><span className="block h-full rounded-full bg-ink/80" style={{ width: `${max > 0 ? Math.max(2, (x.v / max) * 100) : 0}%` }} /></span>
              <span className="font-semibold tabular-nums text-ink">{formatar(x.v)}</span>
            </li>
          ))}
        </ul>
      )}
    </V2Surface>
  );
}

export default function FedIndicatorsPanel({ federation, membersQ, chargesQ, perms }) {
  const veFiliados = perms.includes(FED_PERMISSION.MEMBERS);
  const veFinancas = perms.includes(FED_PERMISSION.FINANCE);
  const ind = useMemo(() => federationIndicators({
    members: veFiliados && membersQ.isSuccess ? membersQ.data || [] : undefined,
    charges: veFinancas && chargesQ.isSuccess ? chargesQ.data || [] : undefined,
  }), [veFiliados, veFinancas, membersQ.isSuccess, membersQ.data, chargesQ.isSuccess, chargesQ.data]);
  const carregando = (veFiliados && membersQ.isLoading) || (veFinancas && chargesQ.isLoading);
  const m = ind.members;
  const f = ind.finance;
  const brl = (v) => formatBrlCents(v);
  // A taxa precisa das DUAS fontes: sem uma, a tela diz o porquê em vez de um traço mudo.
  const taxaHint = !veFiliados || !veFinancas ? t('Precisa ver filiados e financeiro.') : ind.renewalRate == null ? t('Ainda sem renovação para medir.') : t('Renovações pagas ÷ (renovadas + vencidas sem renovar), em 12 meses.');

  return (
    <section className="space-y-6" aria-label={t('Indicadores')} data-dica="federacao-indicadores">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><BarChart3 className="h-5 w-5" aria-hidden="true" />{t('Indicadores')}</h2>
          <p className="text-sm text-gray-500">{t('Os últimos 12 meses, para a diretoria e a prestação de contas.')}</p>
        </div>
        <V2Button type="button" size="sm" variant="secondary" disabled={carregando || (!m && !f)} onClick={() => baixarCsv(indicatorsCsv(ind), `indicadores-${(federation.acronym || 'federacao').toLowerCase()}.csv`)}><Download className="h-4 w-4" />{t('Baixar planilha (CSV)')}</V2Button>
      </div>

      {carregando && <V2Skeleton lines={6} />}
      {!veFiliados && !veFinancas && <p className="text-sm text-gray-500">{t('Os indicadores mostram filiados e dinheiro. Para vê-los, peça a quem administra a federação a permissão de secretaria ou de financeiro.')}</p>}

      {veFiliados && (membersQ.isError ? <V2ErrorState inline title={t('Não carregaram os filiados')} onRetry={() => membersQ.refetch()} /> : m && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold text-ink">{t('Filiados')}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <V2StatCard icon={Users} label={t('Em dia')} value={fmtNumero(m.active)} hint={m.dependents ? t('{n} dependentes', { n: fmtNumero(m.dependents) }) : ''} />
            <V2StatCard icon={Users} label={t('Pedidos em 12 meses')} value={fmtNumero(m.requests12)} />
            <V2StatCard icon={RefreshCcw} label={t('Taxa de renovação')} value={ind.renewalRate == null ? '—' : `${ind.renewalRate}%`} hint={taxaHint} />
            <V2StatCard icon={Users} label={t('Venceram sem renovar')} value={fmtNumero(m.notRenewed12)} hint={t('Nos últimos 12 meses.')} />
          </div>
          <MonthBars titulo={t('Pedidos de filiação por mês')} dados={m.requestsByMonth.map((x) => ({ m: x.month, v: x.n }))} formatar={(v) => fmtNumero(v)} />
          <div className="grid gap-4 lg:grid-cols-3">
            <BarList titulo={t('Em dia por plano')} itens={m.byPlan.map((x) => ({ k: x.key || '-', label: x.key || t('Sem plano'), v: x.n }))} />
            <BarList titulo={t('Em dia por tipo')} itens={m.byPersonType.map((x) => ({ k: x.key, label: x.label || x.key, v: x.n }))} />
            <BarList titulo={t('Em dia por categoria')} itens={m.byTier.map((x) => ({ k: x.key, label: t(PLAN_TIER_LABELS[x.key] || PLAN_TIER_LABELS.federated), v: x.n }))} />
          </div>
        </div>
      ))}

      {veFinancas && (chargesQ.isError ? <V2ErrorState inline title={t('Não carregaram as cobranças')} onRetry={() => chargesQ.refetch()} /> : f && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold text-ink">{t('Dinheiro')}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2StatCard icon={Wallet} label={t('Recebido em 12 meses')} value={brl(f.paid12Cents)} />
            <V2StatCard icon={RefreshCcw} label={t('Renovações pagas')} value={fmtNumero(f.renewalsPaid12)} hint={t('Nos últimos 12 meses.')} />
            <V2StatCard icon={Receipt} label={t('Em atraso')} value={fmtNumero(f.overdue)} hint={f.overdue ? brl(f.overdueCents) : t('Cobranças abertas e vencidas.')} accent={f.overdue ? 'acid' : 'ink'} />
          </div>
          <MonthBars titulo={t('Recebido por mês')} dados={f.paidByMonth.map((x) => ({ m: x.month, v: x.cents }))} formatar={brl} />
          <BarList titulo={t('Recebido por origem')} itens={f.paidByOrigin.map((x) => ({ k: x.key, label: t(CHARGE_ORIGIN_LABELS[x.key] || x.key), v: x.cents }))} formatar={brl} vazio={t('Nada recebido nos últimos 12 meses.')} />
        </div>
      ))}
    </section>
  );
}
