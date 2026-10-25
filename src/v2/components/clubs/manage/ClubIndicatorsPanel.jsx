/**
 * Indicadores do clube (Central → Gerir → Indicadores): os últimos 12 meses de
 * associados e de dinheiro, para a diretoria e a prestação de contas. As contas
 * são de `domain/indicators.js`; aqui só se desenha. Cada bloco depende da SUA
 * fonte (associados: permissão `members`; dinheiro: `finance`) — fonte que
 * falhou vira aviso com "Tentar de novo", nunca zero. Zero banco: usa as
 * mesmas leituras que a Central já faz.
 */
import React, { useMemo } from 'react';
import { BarChart3, Download, Receipt, RefreshCcw, Users, Wallet } from 'lucide-react';
import { CLUB_PERM, formatBrlCents } from '@/modules/clubs/domain/association';
import { clubIndicators, clubIndicatorsCsv } from '@/modules/clubs/domain/indicators';
import { CHARGE_ORIGIN_LABELS } from '@/modules/federations/domain/constants';
import { V2Button, V2ErrorState, V2Skeleton, V2StatCard } from '@/v2/ui/primitives';
import { BarList, MonthBars } from '@/v2/components/federations/manage/FedIndicatorsPanel';
import { baixarCsv } from '@/v2/components/federations/manage/naoSalvo';
import { t, fmtNumero } from '@/core/i18n';

export default function ClubIndicatorsPanel({ club, affiliationsQ, chargesQ, perms }) {
  const admin = perms.includes(CLUB_PERM.ADMIN);
  const veAssociados = admin || perms.includes(CLUB_PERM.MEMBERS);
  const veFinancas = admin || perms.includes(CLUB_PERM.FINANCE);
  const ind = useMemo(() => clubIndicators({
    affiliations: veAssociados && affiliationsQ.isSuccess ? affiliationsQ.data || [] : undefined,
    charges: veFinancas && chargesQ.isSuccess ? chargesQ.data || [] : undefined,
  }), [veAssociados, veFinancas, affiliationsQ.isSuccess, affiliationsQ.data, chargesQ.isSuccess, chargesQ.data]);
  const carregando = (veAssociados && affiliationsQ.isLoading) || (veFinancas && chargesQ.isLoading);
  const m = ind.members;
  const f = ind.finance;
  const brl = (v) => formatBrlCents(v);
  // A taxa precisa das DUAS fontes: sem uma, a tela diz o porquê em vez de um traço mudo.
  const taxaHint = !veAssociados || !veFinancas ? t('Precisa ver associados e financeiro.') : ind.renewalRate == null ? t('Ainda sem renovação para medir.') : t('Renovações pagas ÷ (renovadas + vencidas sem renovar), em 12 meses.');

  return (
    <section className="space-y-6" aria-label={t('Indicadores')} data-dica="clube-indicadores">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><BarChart3 className="h-5 w-5" aria-hidden="true" />{t('Indicadores')}</h2>
          <p className="text-sm text-gray-500">{t('Os últimos 12 meses, para a diretoria e a prestação de contas.')}</p>
        </div>
        <V2Button type="button" size="sm" variant="secondary" disabled={carregando || (!m && !f)} onClick={() => baixarCsv(clubIndicatorsCsv(ind), `indicadores-${String(club.name || 'clube').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clube'}.csv`)}><Download className="h-4 w-4" />{t('Baixar planilha (CSV)')}</V2Button>
      </div>

      {carregando && <V2Skeleton lines={6} />}
      {!veAssociados && !veFinancas && <p className="text-sm text-gray-500">{t('Os indicadores mostram associados e dinheiro. Para vê-los, peça a quem administra o clube a permissão de secretaria ou de financeiro.')}</p>}

      {veAssociados && (affiliationsQ.isError ? <V2ErrorState inline title={t('Não carregaram os associados')} onRetry={() => affiliationsQ.refetch()} /> : m && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold text-ink">{t('Associados')}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <V2StatCard icon={Users} label={t('Em dia')} value={fmtNumero(m.active)} />
            <V2StatCard icon={Users} label={t('Pedidos em 12 meses')} value={fmtNumero(m.requests12)} />
            <V2StatCard icon={RefreshCcw} label={t('Taxa de renovação')} value={ind.renewalRate == null ? '—' : `${ind.renewalRate}%`} hint={taxaHint} />
            <V2StatCard icon={Users} label={t('Venceram sem renovar')} value={fmtNumero(m.notRenewed12)} hint={t('Nos últimos 12 meses.')} />
          </div>
          <MonthBars titulo={t('Pedidos de associação por mês')} dados={m.requestsByMonth.map((x) => ({ m: x.month, v: x.n }))} formatar={(v) => fmtNumero(v)} />
          <div className="grid gap-4 lg:grid-cols-2">
            <BarList titulo={t('Em dia por plano')} itens={m.byPlan.map((x) => ({ k: x.key || '-', label: x.key || t('Sem plano'), v: x.n }))} />
            <BarList titulo={t('Em dia por categoria')} itens={(m.byCategory || []).map((x) => ({ k: x.key || '-', label: x.key || t('Sem categoria'), v: x.n }))} />
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
