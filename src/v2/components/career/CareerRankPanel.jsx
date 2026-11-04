/**
 * A POSIÇÃO NO RANKING ao longo do tempo (Minha carreira, docs/54 §4.11): um
 * gráfico pequeno por ranking (uma série cada, sem legenda — o título nomeia),
 * eixo invertido (1º no alto). Duas origens que NUNCA se misturam na mesma
 * linha: a OFICIAL (derivada do ranking que o servidor grava para as
 * federações) e a DIGITADA (`career_rank`, só do dono). A tabela é a
 * alternativa ao gráfico. Carregado só na linha do tempo (lazy).
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { useCareerRanks, useDeleteCareerRank, useOfficialRanks, useSaveCareerRank } from '@/modules/career/hooks/useCareer';
import { CAREER_RANK_LIMITS, rankSeries, rankTrend } from '@/modules/career/domain/careerRank.js';
import { todayLocal } from '@/modules/training/domain/dates.js';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Skeleton } from '@/v2/ui/primitives';
import { careerDateLabel } from './careerUi';
import { fmtNumero, t } from '@/core/i18n';

const W = 320;
const H = 120;
const PAD = { l: 28, r: 12, t: 12, b: 20 };

/** Um gráfico de linha: posição (1º no alto) por data. */
function Grafico({ serie }) {
  const pts = serie.points;
  const xs = pts.map((p) => Date.parse(`${p.date}T12:00:00Z`));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const ys = pts.map((p) => p.position);
  const [melhor, pior] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x) => (x1 === x0 ? (W + PAD.l - PAD.r) / 2 : PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r));
  const sy = (y) => (pior === melhor ? (H - PAD.b + PAD.t) / 2 : PAD.t + ((y - melhor) / (pior - melhor)) * (H - PAD.t - PAD.b));
  const caminho = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(p.position).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Posição em {ranking}, do {inicio} ao {fim}', { ranking: serie.label, inicio: careerDateLabel(pts[0].date), fim: careerDateLabel(pts[pts.length - 1].date) })}>
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="stroke-gray-100" strokeWidth="1" />
      <text x={PAD.l - 6} y={sy(melhor) + 4} textAnchor="end" className="fill-gray-500 text-xs">{`${melhor}º`}</text>
      {pior !== melhor && <text x={PAD.l - 6} y={sy(pior) + 4} textAnchor="end" className="fill-gray-500 text-xs">{`${pior}º`}</text>}
      <path d={caminho} fill="none" className="stroke-ink" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={`${p.date}-${i}`}>
          {/* Alvo maior que o ponto: o toque acerta. */}
          <circle cx={sx(xs[i])} cy={sy(p.position)} r="12" className="fill-transparent">
            <title>{`${careerDateLabel(p.date)}: ${p.position}º`}</title>
          </circle>
          <circle cx={sx(xs[i])} cy={sy(p.position)} r="4" className="fill-ink stroke-paper-pure" strokeWidth="2" pointerEvents="none" />
        </g>
      ))}
    </svg>
  );
}

function Serie({ serie, onDelete }) {
  const [tabela, setTabela] = useState(false);
  const ultimo = serie.points[serie.points.length - 1];
  const tendencia = rankTrend(serie);
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{serie.label}</p>
        <div className="flex flex-wrap items-center gap-2">
          <V2Badge tone={serie.official ? 'blue' : 'neutral'}>{serie.official ? t('Oficial') : t('Declarado')}</V2Badge>
          <span className="text-sm font-semibold text-ink">{`${ultimo.position}º`}</span>
          {tendencia && <span className="text-sm text-gray-500">{tendencia.text}</span>}
        </div>
      </div>
      {serie.points.length > 1 && <Grafico serie={serie} />}
      <V2Button type="button" size="sm" variant="ghost" aria-expanded={tabela} onClick={() => setTabela((v) => !v)}>{tabela ? t('Esconder a tabela') : t('Ver em tabela')}</V2Button>
      {tabela && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="py-1 font-medium">{t('Data')}</th><th className="py-1 font-medium">{t('Posição')}</th><th className="py-1 font-medium">{t('Pontos')}</th><th className="sr-only">{t('Ações')}</th></tr></thead>
          <tbody>
            {serie.points.map((p, i) => (
              <tr key={`${p.date}-${i}`} className="border-t border-gray-100">
                <td className="py-1">{careerDateLabel(p.date)}</td>
                <td className="py-1">{`${p.position}º`}</td>
                <td className="py-1">{Number.isFinite(p.points_total) ? fmtNumero(p.points_total) : '—'}</td>
                <td className="py-1 text-right">
                  {!serie.official && p.id && (
                    <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar a posição de {data}', { data: careerDateLabel(p.date) })} onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4" /></V2Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}

function NovaPosicao({ onDone }) {
  const salvar = useSaveCareerRank();
  const [f, setF] = useState({ federation_name: '', ranking_label: '', date: todayLocal(), position: '', points_total: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const enviar = (e) => {
    e.preventDefault();
    salvar.mutate(f, {
      onSuccess: () => { toast.success(t('Posição guardada.')); onDone(); },
      onError: (err) => toast.error(err?.message || t('Não foi possível salvar. Tente de novo.')),
    });
  };
  return (
    <form onSubmit={enviar} className="grid gap-3 rounded-2xl bg-paper p-3 sm:grid-cols-2">
      <V2Field label={t('Federação ou circuito')} htmlFor="rank-fed">
        <V2Input id="rank-fed" value={f.federation_name} maxLength={CAREER_RANK_LIMITS.federation} onChange={(e) => set('federation_name', e.target.value)} />
      </V2Field>
      <V2Field label={t('Ranking')} htmlFor="rank-nome" required hint={t('Ex.: Duplas mistas 4.0')}>
        <V2Input id="rank-nome" value={f.ranking_label} maxLength={CAREER_RANK_LIMITS.label} onChange={(e) => set('ranking_label', e.target.value)} />
      </V2Field>
      <V2Field label={t('Data')} htmlFor="rank-data">
        <V2Input id="rank-data" type="date" max={todayLocal()} value={f.date} onChange={(e) => set('date', e.target.value)} />
      </V2Field>
      <div className="grid grid-cols-2 gap-3">
        <V2Field label={t('Posição')} htmlFor="rank-pos" required>
          <V2Input id="rank-pos" type="number" min={1} value={f.position} onChange={(e) => set('position', e.target.value)} />
        </V2Field>
        <V2Field label={t('Pontos')} htmlFor="rank-pts">
          <V2Input id="rank-pts" type="number" min={0} value={f.points_total} onChange={(e) => set('points_total', e.target.value)} />
        </V2Field>
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <V2Button type="submit" variant="primary" disabled={salvar.isPending || !f.ranking_label.trim()}>{salvar.isPending ? t('Salvando…') : t('Guardar posição')}</V2Button>
        <V2Button type="button" variant="ghost" onClick={onDone}>{t('Cancelar')}</V2Button>
      </div>
    </form>
  );
}

/** @param {{ federationPoints?: object[] }} props os lançamentos oficiais (indefinido = não carregaram) */
export default function CareerRankPanel({ federationPoints, onRetryPoints }) {
  const digitadas = useCareerRanks();
  const oficiais = useOfficialRanks(federationPoints);
  const apagar = useDeleteCareerRank();
  const [nova, setNova] = useState(false);
  const series = rankSeries(digitadas.data || [], oficiais.data?.points || []);
  const pendente = digitadas.isPending || (Array.isArray(federationPoints) && oficiais.isPending);
  return (
    <section className="space-y-3" data-dica="carreira-ranking">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><TrendingUp className="h-5 w-5" aria-hidden="true" /> {t('Posição no ranking')}</h2>
        {!nova && <V2Button type="button" size="sm" variant="secondary" onClick={() => setNova(true)}><Plus className="h-4 w-4" /> {t('Anotar posição')}</V2Button>}
      </div>
      <p className="text-xs text-gray-500">{t('A oficial vem do ranking das federações daqui. A anotada é a que você leu em outro ranking — só você vê, e não pontua em nada.')}</p>
      {nova && <NovaPosicao onDone={() => setNova(false)} />}
      {(digitadas.isError || oficiais.isError || oficiais.data?.incompleto || federationPoints === undefined) && (
        <V2ErrorState
          inline
          title={t('Parte das posições não carregou')}
          description={t('O que aparece está certo, mas pode faltar ranking.')}
          onRetry={() => { if (digitadas.isError) digitadas.refetch(); if (oficiais.isError || oficiais.data?.incompleto) oficiais.refetch(); if (federationPoints === undefined) onRetryPoints?.(); }}
        />
      )}
      {pendente ? <V2Skeleton lines={2} /> : series.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {series.map((s) => <Serie key={s.key} serie={s} onDelete={(id) => apagar.mutate(id)} />)}
        </ul>
      ) : !digitadas.isError && !oficiais.isError && (
        <p className="text-sm text-gray-500">{t('Nenhuma posição ainda. Anote a de um ranking de fora para ver a evolução.')}</p>
      )}
    </section>
  );
}
