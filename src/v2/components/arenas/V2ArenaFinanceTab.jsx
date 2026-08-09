/**
 * V2ArenaFinanceTab — Gestão financeira do mercado (flag arena_market_reports).
 *
 * Consolida ENTRADAS (compras) e SAÍDAS (vendas/consumo/perdas) em relatórios
 * por período (semanal ou mensal, à escolha do admin). O relatório ao vivo é
 * calculado a partir dos registros; ao FECHAR, vira um snapshot documentado que
 * fica aqui, na gestão financeira. O admin pode editar/excluir linhas do
 * snapshot — com aviso de que o automático reflete a integralidade do que foi
 * feito na plataforma. Editar o relatório NUNCA altera os registros de
 * entrada/saída nem remove produtos do mercado.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, TrendingDown, DollarSign, Boxes, ShieldCheck, AlertTriangle,
  Lock, RefreshCw, Pencil, Trash2, Download, Plus, Save, Info,
} from 'lucide-react';
import {
  useInventoryProducts, useInventoryEntries, useInventoryExits,
} from '@/modules/arenas/hooks/useArenas';
import { useArenaSettings, useUpdateArenaSettings } from '@/modules/arenas/hooks/useArenaV3';
import {
  useSavedReports, useSaveReportSnapshot, useSaveReportEdits, useDeleteSavedReport,
} from '@/modules/arenas/hooks/useMarketReports';
import {
  REPORT_PERIOD, listActivePeriods, buildAutoReport, computeReportTotals,
  reportDocId, normalizeReportLine,
} from '@/modules/arenas/domain/marketReports';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/core/lib/utils';
import {
  V2Badge, V2Button, V2StatCard, V2Surface, V2Skeleton,
} from '@/v2/ui/primitives';

export default function V2ArenaFinanceTab() {
  const { arenaId } = useParams();
  const { data: products = [] } = useInventoryProducts(arenaId);
  const { data: entries = [] } = useInventoryEntries(arenaId);
  const { data: exits = [], isLoading } = useInventoryExits(arenaId);
  const { data: settings } = useArenaSettings(arenaId, { createIfMissing: false });
  const updateSettings = useUpdateArenaSettings();
  const { data: saved = [] } = useSavedReports(arenaId);
  const saveSnapshot = useSaveReportSnapshot(arenaId);
  const saveEdits = useSaveReportEdits(arenaId);
  const deleteReport = useDeleteSavedReport(arenaId);

  const periodType = settings?.market?.report_period === REPORT_PERIOD.WEEKLY
    ? REPORT_PERIOD.WEEKLY : REPORT_PERIOD.MONTHLY;

  const periods = useMemo(
    () => listActivePeriods(entries, exits, periodType),
    [entries, exits, periodType],
  );
  const [periodKey, setPeriodKey] = useState('');
  useEffect(() => {
    // Seleciona o período atual (primeiro da lista) ao trocar cadência/dados.
    if (periods.length && !periods.some((p) => p.key === periodKey)) {
      setPeriodKey(periods[0].key);
    }
  }, [periods, periodKey]);

  const autoReport = useMemo(
    () => (periodKey ? buildAutoReport({ entries, exits, products, periodType, periodKey }) : null),
    [entries, exits, products, periodType, periodKey],
  );
  const savedForPeriod = useMemo(
    () => saved.find((r) => r.id === reportDocId(arenaId, periodType, periodKey)) || null,
    [saved, arenaId, periodType, periodKey],
  );

  // Relatório exibido: o salvo (se houver) ou o automático ao vivo.
  const report = savedForPeriod || autoReport;

  const [editMode, setEditMode] = useState(false);
  const [draftLines, setDraftLines] = useState([]);
  useEffect(() => { setEditMode(false); }, [periodKey, periodType]);

  async function setCadence(next) {
    if (next === periodType) return;
    try {
      await updateSettings.mutateAsync({ arenaId, updates: { market: { ...(settings?.market || {}), report_period: next } } });
      toast.success(next === REPORT_PERIOD.WEEKLY ? 'Relatórios agora são semanais.' : 'Relatórios agora são mensais.');
    } catch (err) { toast.error(err.message || 'Não foi possível alterar a periodicidade.'); }
  }

  async function handleClose() {
    if (!autoReport) return;
    try {
      await saveSnapshot.mutateAsync({ ...autoReport, status: 'closed' });
      toast.success('Relatório do período fechado e enviado ao financeiro.');
    } catch (err) { toast.error(err.message || 'Não foi possível fechar o relatório.'); }
  }

  async function handleRegenerate() {
    if (!autoReport) return;
    try {
      await saveSnapshot.mutateAsync({ ...autoReport, status: savedForPeriod?.status || 'closed' });
      toast.success('Relatório regerado a partir dos registros da plataforma.');
      setEditMode(false);
    } catch (err) { toast.error(err.message); }
  }

  function startEdit() {
    setDraftLines((report?.lines || []).map((l) => ({ ...l })));
    setEditMode(true);
  }

  async function handleSaveEdits() {
    try {
      let id = savedForPeriod?.id;
      if (!id) {
        // Precisa existir um snapshot para receber edições.
        await saveSnapshot.mutateAsync({ ...autoReport, status: 'closed' });
        id = reportDocId(arenaId, periodType, periodKey);
      }
      const clean = draftLines.map(normalizeReportLine);
      await saveEdits.mutateAsync({ id, lines: clean });
      toast.success('Ajustes salvos no relatório.');
      setEditMode(false);
    } catch (err) { toast.error(err.message || 'Não foi possível salvar os ajustes.'); }
  }

  function updateDraft(key, field, val) {
    setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  }
  function removeDraft(key) {
    setDraftLines((prev) => prev.filter((l) => l.key !== key));
  }
  function addManualLine() {
    setDraftLines((prev) => [...prev, normalizeReportLine({ name: 'Novo item', manual: true, key: `manual_${Date.now()}` })]);
  }

  function exportCsv() {
    if (!report) return;
    const rows = [['Produto', 'Marca', 'Categoria', 'Entrada (qtd)', 'Entrada (R$)', 'Vendas (qtd)', 'Vendas (R$)', 'Perdas', 'Consumo']];
    for (const l of report.lines) {
      rows.push([l.name, l.brand || '', l.category || '', l.entered_qty, l.entered_cost, l.sold_qty, l.sold_revenue, l.loss_qty, l.consumption_qty]);
    }
    const t = report.totals;
    rows.push([]);
    rows.push(['TOTAIS', '', '', t.entered_qty, t.entered_cost, t.sold_qty, t.sold_revenue, t.loss_qty, t.consumption_qty]);
    rows.push(['Resultado (vendas - compras)', '', '', '', '', '', t.result]);
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-mercado-${report.period_key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = editMode ? computeReportTotals(draftLines) : (report?.totals || {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Wallet className="h-5 w-5 text-green-700" />
        <h2 className="font-display text-xl font-bold text-ink">Financeiro — Relatórios do mercado</h2>
      </div>

      {/* Cadência (semanal/mensal) */}
      <V2Surface className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Periodicidade dos relatórios</p>
          <p className="text-xs text-gray-500">Escolha como consolidar as entradas e saídas do mercado.</p>
        </div>
        <div className="flex gap-1.5">
          {[[REPORT_PERIOD.MONTHLY, 'Mensal'], [REPORT_PERIOD.WEEKLY, 'Semanal']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setCadence(val)}
              disabled={updateSettings.isPending}
              className={cn(
                'btn-press rounded-full border px-4 py-2 text-sm font-bold transition-colors',
                periodType === val ? 'border-transparent bg-ink text-white' : 'border-gray-200 text-gray-600 hover:border-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </V2Surface>

      {isLoading ? (
        <V2Skeleton lines={6} />
      ) : !report ? (
        <V2Surface><p className="text-sm text-gray-500">Sem movimento de mercado ainda. Registre entradas e saídas na aba Mercado.</p></V2Surface>
      ) : (
        <>
          {/* Seletor de período */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm font-semibold"
            >
              {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            {savedForPeriod ? (
              <V2Badge tone="green"><Lock className="mr-1 h-3 w-3" /> Fechado</V2Badge>
            ) : (
              <V2Badge tone="neutral">Em aberto (ao vivo)</V2Badge>
            )}
            {savedForPeriod?.edited && <V2Badge tone="amber">Editado</V2Badge>}
            <div className="ml-auto flex flex-wrap gap-2">
              <V2Button size="sm" variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</V2Button>
              {!editMode && (
                savedForPeriod
                  ? <V2Button size="sm" variant="secondary" onClick={handleRegenerate} disabled={saveSnapshot.isPending}><RefreshCw className="h-4 w-4" /> Regerar</V2Button>
                  : <V2Button size="sm" onClick={handleClose} disabled={saveSnapshot.isPending}><Lock className="h-4 w-4" /> Fechar período</V2Button>
              )}
              {!editMode && <V2Button size="sm" variant="secondary" onClick={startEdit}><Pencil className="h-4 w-4" /> Editar</V2Button>}
            </div>
          </div>

          {/* Integridade / aviso de edição */}
          {savedForPeriod?.edited ? (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Este relatório foi <strong>editado manualmente</strong>. O relatório automático corresponde à
                <strong> integralidade</strong> do que foi realizado dentro da plataforma neste período. Use
                &quot;Regerar&quot; para voltar ao automático.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50/60 p-3 text-sm text-green-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Este relatório reflete <strong>integralmente</strong> as entradas e saídas registradas na plataforma neste período.</p>
            </div>
          )}

          {/* Totais */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <V2StatCard icon={TrendingDown} label="Compras (saída de caixa)" value={formatPrice(totals.entered_cost)} accent="ink" />
            <V2StatCard icon={TrendingUp} label="Vendas (entrada de caixa)" value={formatPrice(totals.sold_revenue)} accent="acid" />
            <V2StatCard icon={DollarSign} label="Resultado do período" value={formatPrice(totals.result)} accent={totals.result >= 0 ? 'acid' : 'ink'} />
            <V2StatCard icon={Boxes} label="Itens movimentados" value={String(totals.product_count ?? (editMode ? draftLines.length : report.lines.length))} accent="ink" />
          </div>

          {/* Linhas */}
          <V2Surface className="overflow-x-auto">
            {editMode ? (
              <EditTable
                lines={draftLines}
                onChange={updateDraft}
                onRemove={removeDraft}
                onAdd={addManualLine}
                onCancel={() => setEditMode(false)}
                onSave={handleSaveEdits}
                saving={saveEdits.isPending || saveSnapshot.isPending}
              />
            ) : (
              <ViewTable lines={report.lines} />
            )}
          </V2Surface>

          {/* Histórico de relatórios fechados */}
          {saved.length > 0 && (
            <V2Surface>
              <h3 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-ink">
                <Info className="h-4 w-4 text-gray-400" /> Histórico de relatórios
              </h3>
              <div className="space-y-1.5">
                {saved.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-paper p-2.5">
                    <button type="button" onClick={() => setPeriodKey(r.period_key)} className="min-w-0 flex-1 text-left">
                      <span className="text-sm font-semibold text-ink">{r.label}</span>
                      {r.edited && <V2Badge tone="amber" className="ml-2">Editado</V2Badge>}
                    </button>
                    <span className={cn('shrink-0 text-sm font-bold', (r.totals?.result || 0) >= 0 ? 'text-green-700' : 'text-red-600')}>
                      {formatPrice(r.totals?.result || 0)}
                    </span>
                    <ConfirmDialog
                      title="Excluir relatório salvo?"
                      description="Remove apenas o documento do relatório. As entradas e saídas registradas permanecem intactas e o relatório pode ser gerado de novo."
                      confirmLabel="Excluir"
                      onConfirm={() => deleteReport.mutateAsync(r.id).then(() => toast.success('Relatório excluído.')).catch((e) => toast.error(e.message))}
                      trigger={<button type="button" className="shrink-0 text-red-500 hover:text-red-700" aria-label="Excluir relatório"><Trash2 className="h-4 w-4" /></button>}
                    />
                  </div>
                ))}
              </div>
            </V2Surface>
          )}
        </>
      )}
    </div>
  );
}

function ViewTable({ lines }) {
  if (!lines.length) return <p className="text-sm text-gray-500">Nenhum movimento neste período.</p>;
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
          <th className="py-2 pr-2">Produto</th>
          <th className="px-2 text-right">Entrada</th>
          <th className="px-2 text-right">Compra (R$)</th>
          <th className="px-2 text-right">Vendas</th>
          <th className="px-2 text-right">Receita (R$)</th>
          <th className="px-2 text-right">Perdas</th>
          <th className="pl-2 text-right">Consumo</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key} className="border-b border-gray-50">
            <td className="py-2 pr-2">
              <span className="font-semibold text-ink">{l.name}</span>
              {l.manual && <V2Badge tone="amber" className="ml-2">manual</V2Badge>}
              {l.brand && <span className="block text-xs text-gray-400">{l.brand}</span>}
            </td>
            <td className="px-2 text-right">{l.entered_qty || '—'}</td>
            <td className="px-2 text-right">{l.entered_cost ? formatPrice(l.entered_cost) : '—'}</td>
            <td className="px-2 text-right">{l.sold_qty || '—'}</td>
            <td className="px-2 text-right font-semibold text-green-700">{l.sold_revenue ? formatPrice(l.sold_revenue) : '—'}</td>
            <td className="px-2 text-right">{l.loss_qty || '—'}</td>
            <td className="pl-2 text-right">{l.consumption_qty || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EditTable({ lines, onChange, onRemove, onAdd, onCancel, onSave, saving }) {
  const numInput = (l, field) => (
    <input
      type="number" min="0" step="0.01"
      value={l[field]}
      onChange={(e) => onChange(l.key, field, Number(e.target.value))}
      className="w-20 rounded-xl border border-gray-200 bg-paper px-2 py-1 text-right text-sm"
    />
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Ajuste os valores, exclua linhas ou adicione itens manuais. As alterações valem apenas para este
        relatório — os registros de entrada e saída não são afetados.
      </p>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
            <th className="py-2 pr-2">Produto</th>
            <th className="px-2">Ent.</th>
            <th className="px-2">Compra</th>
            <th className="px-2">Vendas</th>
            <th className="px-2">Receita</th>
            <th className="px-2">Perdas</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} className="border-b border-gray-50">
              <td className="py-2 pr-2">
                <input
                  value={l.name}
                  onChange={(e) => onChange(l.key, 'name', e.target.value)}
                  className="w-40 rounded-xl border border-gray-200 bg-paper px-2 py-1 text-sm"
                />
              </td>
              <td className="px-2">{numInput(l, 'entered_qty')}</td>
              <td className="px-2">{numInput(l, 'entered_cost')}</td>
              <td className="px-2">{numInput(l, 'sold_qty')}</td>
              <td className="px-2">{numInput(l, 'sold_revenue')}</td>
              <td className="px-2">{numInput(l, 'loss_qty')}</td>
              <td className="text-right">
                <button type="button" onClick={() => onRemove(l.key)} className="text-red-500 hover:text-red-700" aria-label="Remover linha">
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <V2Button type="button" size="sm" variant="secondary" onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar linha</V2Button>
        <div className="flex gap-2">
          <V2Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</V2Button>
          <V2Button type="button" size="sm" onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar ajustes'}
          </V2Button>
        </div>
      </div>
    </div>
  );
}
