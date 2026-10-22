/**
 * Peças de tela das CONTAS da federação, usadas na Central (Contas) e na
 * página pública (transparência): os totais, orçado × realizado (cartões no
 * celular, tabela a partir de `md`) e as barras do mês (CSS). As contas são
 * de `domain/accounts.js`; aqui só se desenha. Valor desconhecido é "—".
 */
import React from 'react';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import { t, tk, fmtData } from '@/core/i18n';

/** Centavos → "R$ 1.234,56"; desconhecido (null/undefined/NaN) → "—". */
export const reais = (c) => (Number.isFinite(Number(c)) && c !== null && c !== undefined ? formatBrlCents(Math.trunc(Number(c))) : '—');

/** Texto digitado em reais → texto para o campo (centavos → "1234,56"). */
export const reaisParaCampo = (c) => (Number.isFinite(Number(c)) && c ? (Number(c) / 100).toFixed(2).replace('.', ',') : '');

/** Receitas, despesas e resultado, em três blocos. */
export function TotalsTiles({ income, expense, balance, className = '' }) {
  const tiles = [
    { k: 'in', label: t('Receitas'), v: income, cls: 'text-green-700' },
    { k: 'out', label: t('Despesas'), v: expense, cls: 'text-red-600' },
    { k: 'bal', label: t('Resultado'), v: balance, cls: Number(balance) < 0 ? 'text-red-600' : 'text-ink' },
  ];
  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${className}`}>
      {tiles.map((x) => (
        <V2Surface key={x.k} variant="compacto" className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{x.label}</p>
          <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${x.cls}`}>{reais(x.v)}</p>
        </V2Surface>
      ))}
    </div>
  );
}

const ALERTA = {
  over: { tone: 'red', label: tk('Estourou') },
  near: { tone: 'amber', label: tk('Perto do limite') },
  unbudgeted: { tone: 'amber', label: tk('Sem orçamento') },
};

function AlertBadge({ alert }) {
  const a = ALERTA[alert];
  return a ? <V2Badge tone={a.tone}>{t(a.label)}</V2Badge> : null;
}

/** A barra do percentual realizado (até 100% cheia; passou, vermelha). */
function PctBar({ pct, kind }) {
  if (pct == null) return null;
  const cor = kind === 'expense' && pct > 100 ? 'bg-red-500' : kind === 'expense' && pct >= 90 ? 'bg-amber-500' : 'bg-ink/80';
  return <span className="block h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} /></span>;
}

/**
 * Orçado × realizado. `rows` vem de `budgetVsActual`; linhas sem orçado e sem
 * realizado já não vêm. `actualKnown=false` (fonte falhou) mostra "—".
 */
export function BudgetVsActualTable({ rows, caption, actualKnown = true }) {
  if (!rows.length) return <p className="text-sm text-gray-500">{t('Nenhuma categoria com valor orçado ou realizado.')}</p>;
  const grupos = [
    { kind: 'income', titulo: t('Receitas'), itens: rows.filter((r) => r.kind === 'income') },
    { kind: 'expense', titulo: t('Despesas'), itens: rows.filter((r) => r.kind === 'expense') },
  ].filter((g) => g.itens.length);
  return (
    <div className="space-y-4">
      {/* Celular: cartões */}
      <div className="space-y-4 md:hidden">
        {grupos.map((g) => (
          <div key={g.kind} className="space-y-2">
            <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{g.titulo}</p>
            <ul className="space-y-2">
              {g.itens.map((r) => (
                <li key={r.key} className="space-y-1.5 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-ink">{t(r.label)}</span><AlertBadge alert={r.alert} /></div>
                  <div className="flex justify-between text-gray-500"><span>{t('Orçado')}</span><span className="tabular-nums text-ink">{reais(r.budget)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>{t('Realizado')}</span><span className="tabular-nums text-ink">{actualKnown ? reais(r.actual) : '—'}</span></div>
                  {actualKnown && <PctBar pct={r.pct} kind={r.kind} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* A partir de md: tabela */}
      <table className="hidden w-full text-sm md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
            <th scope="col" className="py-2 pr-3 font-bold">{t('Categoria')}</th>
            <th scope="col" className="py-2 pr-3 text-right font-bold">{t('Orçado')}</th>
            <th scope="col" className="py-2 pr-3 text-right font-bold">{t('Realizado')}</th>
            <th scope="col" className="w-40 py-2 pr-3 font-bold">%</th>
            <th scope="col" className="py-2 font-bold"><span className="sr-only">{t('Alerta')}</span></th>
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.kind}>
            <tr><th scope="rowgroup" colSpan={5} className="pb-1 pt-3 text-left text-2xs font-bold uppercase tracking-widest text-gray-500">{g.titulo}</th></tr>
            {g.itens.map((r) => (
              <tr key={r.key} className="border-b border-gray-50">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">{t(r.label)}</th>
                <td className="py-2 pr-3 text-right tabular-nums">{reais(r.budget)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{actualKnown ? reais(r.actual) : '—'}</td>
                <td className="py-2 pr-3">{actualKnown && r.pct != null ? <span className="flex items-center gap-2"><span className="w-10 text-right text-xs tabular-nums text-gray-500">{r.pct}%</span><span className="flex-1"><PctBar pct={r.pct} kind={r.kind} /></span></span> : <span className="text-xs text-gray-500">—</span>}</td>
                <td className="py-2"><AlertBadge alert={r.alert} /></td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

const mesCurto = (m) => fmtData(new Date(`${m}-15T12:00:00`), { month: 'short' }).replace('.', '');
const mesLongo = (m) => fmtData(new Date(`${m}-15T12:00:00`), { month: 'long', year: 'numeric' });

/** Receitas e despesas mês a mês (duas colunas por mês), com tabela para leitor de tela. */
export function MonthlyBars({ titulo, serie }) {
  const max = Math.max(0, ...serie.flatMap((d) => [d.income, d.expense]));
  return (
    <V2Surface className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold text-ink">{titulo}</h3>
        <p className="flex items-center gap-3 text-xs text-gray-500" aria-hidden="true">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-green-600" />{t('Receitas')}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" />{t('Despesas')}</span>
        </p>
      </div>
      {max === 0 ? <p className="text-sm text-gray-500">{t('Nada lançado neste ano.')}</p> : (
        <>
          <div className="flex h-40 items-end gap-1" aria-hidden="true">
            {serie.map((d) => (
              <div key={d.month} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px" title={`${mesLongo(d.month)}: ${reais(d.income)} / ${reais(d.expense)}`}>
                <div className="w-1/2 max-w-4 rounded-t bg-green-600" style={{ height: `${d.income > 0 ? Math.max(2, (d.income / max) * 100) : 0}%` }} />
                <div className="w-1/2 max-w-4 rounded-t bg-red-500" style={{ height: `${d.expense > 0 ? Math.max(2, (d.expense / max) * 100) : 0}%` }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {serie.map((d) => <span key={d.month} className="min-w-0 flex-1 truncate text-center text-2xs text-gray-500">{mesCurto(d.month)}</span>)}
          </div>
        </>
      )}
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead><tr><th scope="col">{t('Mês')}</th><th scope="col">{t('Receitas')}</th><th scope="col">{t('Despesas')}</th></tr></thead>
        <tbody>{serie.map((d) => <tr key={d.month}><th scope="row">{mesLongo(d.month)}</th><td>{reais(d.income)}</td><td>{reais(d.expense)}</td></tr>)}</tbody>
      </table>
    </V2Surface>
  );
}
