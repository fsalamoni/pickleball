/**
 * LineCentral — a CENTRAL das câmeras de um jogo: quem está no ar em cada
 * posição do arranjo (com bateria e conferência da calibração), o último lance
 * em letras grandes, a marca ampliada, e os lances anteriores, do mais
 * recente para trás. Serve para a mesa da organização, um tablet na beira da
 * quadra ou uma TV.
 *
 * Quem organiza dá a PALAVRA FINAL num lance (sobretudo nos "revisar"): a
 * decisão fica gravada ao lado do que as câmeras marcaram, que não muda. Dá
 * também para falar o lance em voz alta e baixar a planilha do jogo.
 */

import React, { useCallback, useState } from 'react';
import {
  Radio, Trash2, Users, Volume2, VolumeX, Download, Gavel, ChevronDown, BatteryLow, Target, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { V2Surface, V2Button, V2Badge, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { CAMERA_POSITIONS, layoutById } from '@/modules/linecall/domain/cameraLayouts';
import { positionOccupancy, DECISIONS } from '@/modules/linecall/domain/fusion';
import { nearestBoundary } from '@/modules/linecall/domain/court';
import { lanceSummary, lancesCsv } from '@/modules/linecall/domain/report';
import { readinessCheck, READINESS_TEXT } from '@/modules/linecall/domain/readiness';
import { useNow } from '@/modules/linecall/hooks/useLineControlLive';
import { useAnnounce, canSpeak } from '@/modules/linecall/hooks/useAnnounce';
import { clearLineCalls, decideLance } from '@/modules/linecall/services/lineCallSync';
import CourtDiagram from './CourtDiagram';
import CourtMark from './CourtMark';
import CameraInvite from './CameraInvite';
import { CALL_TEXT, CALL_TONE, CALL_LABEL, callLabel, callDetail, callSpoken } from './callLabels';
import { cn } from '@/core/lib/utils';
import { t, fmtData } from '@/core/i18n';

const hora = (ms) => fmtData(ms, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const nomes = (ids) => ids.map((p) => t(CAMERA_POSITIONS[p]?.label || p)).join(' · ');

/** A marca ampliada do lance, pela melhor câmera. */
function LanceMark({ l }) {
  const b = l.best || {};
  const bounce = l.kind === 'bounce';
  const margin = bounce ? b.margin_m : b.depth_m;
  if (!Number.isFinite(margin)) return null;
  const line = bounce && !l.serve && Number.isFinite(b.x) ? nearestBoundary({ x: b.x, y: b.y }).line : null;
  return <CourtMark kind={l.kind} call={l.call} marginM={margin} uncertaintyM={b.uncertainty_m} lineName={line} className="max-w-xs" />;
}

function Lance({ l, big = false }) {
  return (
    <div className={cn('space-y-1', big && 'text-center')}>
      <p className={cn(big ? 'text-5xl font-black sm:text-6xl' : 'text-base font-bold', CALL_TEXT[l.call])}>{callLabel(l)}</p>
      <p className={cn('text-gray-600', big ? 'text-base' : 'text-xs')}>
        {l.decided
          ? t('Decidido por quem organiza (as câmeras disseram: {m}).', { m: t(CALL_LABEL[l.kind]?.[l.machineCall] || '') })
          : l.disagree ? t('As câmeras discordaram: a decisão volta para a quadra.') : callDetail(l.best)}
      </p>
      <p className="text-xs text-gray-500">
        {t('{h} · visto por: {c}', { h: hora(l.t_ms), c: nomes(l.positions) })}
      </p>
    </div>
  );
}

/** Os botões da palavra final de quem organiza. */
function Decide({ l, gameDayId, uid }) {
  const [saving, setSaving] = useState(false);
  const decidir = async (decision) => {
    setSaving(true);
    try {
      await decideLance(gameDayId, l.decisionDocId, { decision, uid });
    } catch {
      toast.error(t('Não foi possível gravar a decisão.'));
    } finally { setSaving(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('Palavra final de quem organiza')}>
      <Gavel className="h-4 w-4 text-gray-500" aria-hidden="true" />
      {DECISIONS[l.kind].map((d) => (
        <V2Button key={d} size="sm" disabled={saving} variant={l.decided && l.call === d ? 'primary' : 'secondary'} onClick={() => decidir(d)}>
          {t(CALL_LABEL[l.kind][d])}
        </V2Button>
      ))}
    </div>
  );
}

/** O que cada câmera viu do lance. */
function PerCamera({ l }) {
  return (
    <ul className="space-y-1">
      {l.calls.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
          <V2Badge tone={CALL_TONE[c.call]}>{t(CALL_LABEL[l.kind]?.[c.call] || '')}</V2Badge>
          <span className="font-medium text-ink">{t(CAMERA_POSITIONS[c.position]?.label || c.position)}</span>
          <span className="text-gray-500">{callDetail(c)}</span>
        </li>
      ))}
    </ul>
  );
}

function baixar(nome, texto) {
  // A marca BOM no começo faz o Excel ler os acentos certos.
  const blob = new Blob([String.fromCharCode(0xfeff) + texto], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param {{ gameDay: object, live: ReturnType<import('@/modules/linecall/hooks/useLineControlLive').useLineControlLive>,
 *   podeLimpar?: boolean }} props  `podeLimpar`: quem organiza (limpa e decide)
 */
export default function LineCentral({ gameDay, live, podeLimpar = false }) {
  const { user } = useAuth();
  const now = useNow();
  const layout = layoutById(gameDay.line_control_layout);
  const occ = positionOccupancy(layout.positions, live.cams, now);
  const [confirmar, setConfirmar] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [ultimo, ...anteriores] = live.lances;
  const spoken = useCallback((l) => callSpoken(l), []);
  const [falar, setFalar] = useAnnounce(ultimo || null, spoken, 'linhas:voz:central');

  if (live.isError) return <V2ErrorState onRetry={live.retry} description={t('Não deu para ouvir as câmeras deste jogo.')} />;
  if (live.isLoading) return <V2Skeleton lines={4} />;

  const noAr = Object.values(occ).filter(Boolean).length;
  const resumo = lanceSummary(live.lances);
  const pronto = readinessCheck(layout.positions, occ);

  const limpar = async () => {
    setLimpando(true);
    try { await clearLineCalls(gameDay.id); } finally { setLimpando(false); setConfirmar(false); }
  };
  const exportar = () => baixar(`linhas-${gameDay.id}.csv`, lancesCsv(live.lances, {
    header: [t('Hora'), t('Lance'), t('Decidido'), t('Câmeras discordaram'), t('Margem (cm)'), t('Incerteza (cm)'), t('Câmeras')],
    time: hora,
    label: callLabel,
    positions: nomes,
  }));

  return (
    <div className="space-y-4">
      <V2Surface className="p-4" data-dica="linhas-central-cameras">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,140px)_1fr]">
          <CourtDiagram
            positions={layout.positions}
            taken={layout.positions.filter((p) => occ[p])}
            className="mx-auto w-full max-w-[140px] text-ink"
            label={t('As câmeras do arranjo no desenho da quadra')}
          />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{t(layout.label)}</p>
              <V2Badge tone={noAr === layout.positions.length ? 'green' : noAr ? 'amber' : 'neutral'}>
                {t('{n} de {m} câmeras no ar', { n: noAr, m: layout.positions.length })}
              </V2Badge>
            </div>
            <div
              role="status"
              data-dica="linhas-central-pronto"
              className={cn('rounded-lg px-3 py-2 text-sm', pronto.ready ? 'bg-green-50 text-green-800' : pronto.blocking ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900')}
            >
              <p className="flex items-center gap-2 font-semibold">
                {pronto.ready
                  ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                {pronto.ready
                  ? t('Pronto para começar: todas as câmeras analisando.')
                  : pronto.blocking
                    ? t('Ainda não está pronto: {n} posição(ões) sem julgar.', { n: pronto.blocking })
                    : t('Dá para começar, com {n} aviso(s).', { n: pronto.warnings })}
              </p>
              {!pronto.ready && (
                <ul className="mt-1 list-disc space-y-0.5 pl-6 text-xs">
                  {pronto.issues.map((i) => (
                    <li key={i.position + i.code}>{t(CAMERA_POSITIONS[i.position]?.label || i.position)}: {t(READINESS_TEXT[i.code])}</li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="space-y-2">
              {layout.positions.map((p, i) => {
                const c = occ[p];
                const bateriaBaixa = c && Number.isFinite(c.battery) && c.battery <= 20 && c.charging !== true;
                return (
                  <li key={p} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white" aria-hidden="true">{i + 1}</span>
                    <span className="font-medium text-ink">{t(CAMERA_POSITIONS[p].label)}</span>
                    {c ? (
                      <>
                        <V2Badge tone={c.analyzing ? 'green' : 'amber'}>
                          <Radio className="mr-1 inline h-3 w-3" aria-hidden="true" />
                          {c.analyzing ? t('Analisando') : c.calibrated ? t('Calibrada, em pausa') : t('Falta calibrar')}
                        </V2Badge>
                        {c.fps > 0 && <span className={cn('text-xs', c.fps < 24 ? 'text-amber-700' : 'text-gray-500')}>{t('{n} quadros/s', { n: c.fps })}</span>}
                        {Number.isFinite(c.check_cm) && (
                          <span className={cn('flex items-center gap-1 text-xs', c.check_cm > 6 ? 'text-red-600' : 'text-gray-500')}>
                            <Target className="h-3 w-3" aria-hidden="true" /> {t('erro {n} cm', { n: String(c.check_cm).replace('.', ',') })}
                          </span>
                        )}
                        {Number.isFinite(c.battery) && (
                          <span className={cn('flex items-center gap-1 text-xs', bateriaBaixa ? 'text-red-600' : 'text-gray-500')}>
                            {bateriaBaixa && <BatteryLow className="h-3 w-3" aria-hidden="true" />}
                            {c.charging ? t('{n}% · carregando', { n: c.battery }) : t('{n}%', { n: c.battery })}
                          </span>
                        )}
                        {c.name && <span className="text-xs text-gray-500">{c.name}</span>}
                      </>
                    ) : (
                      <>
                        <V2Badge tone="neutral">{t('Sem câmera')}</V2Badge>
                        <CameraInvite gameDayId={gameDay.id} position={p} positionLabel={t(CAMERA_POSITIONS[p].label)} />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </V2Surface>

      <V2Surface className="space-y-4 p-6" aria-live="polite" data-dica="linhas-central-lance">
        {ultimo ? (
          <>
            <Lance l={ultimo} big />
            <div className="flex justify-center"><LanceMark l={ultimo} /></div>
            {podeLimpar && (ultimo.call === 'review' || ultimo.decided || ultimo.disagree) && (
              <div className="flex justify-center"><Decide l={ultimo} gameDayId={gameDay.id} uid={user?.uid} /></div>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">
            {noAr
              ? t('As câmeras estão no ar. O primeiro quique ou voleio aparece aqui.')
              : t('Nenhuma câmera no ar ainda. Em cada aparelho, abra esta página e escolha "Usar este aparelho como câmera".')}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canSpeak() && (
            <V2Button size="sm" variant="ghost" onClick={() => setFalar(!falar)} aria-pressed={falar}>
              {falar ? <Volume2 className="mr-1.5 h-4 w-4" /> : <VolumeX className="mr-1.5 h-4 w-4" />}
              {falar ? t('Falando o lance') : t('Falar o lance em voz alta')}
            </V2Button>
          )}
          {resumo.total > 0 && (
            <V2Button size="sm" variant="ghost" onClick={exportar}>
              <Download className="mr-1.5 h-4 w-4" /> {t('Baixar planilha')}
            </V2Button>
          )}
        </div>
      </V2Surface>

      {resumo.total > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t('Resumo do jogo')}>
          <V2Badge tone="neutral">{t('{n} lances', { n: resumo.total })}</V2Badge>
          {resumo.in > 0 && <V2Badge tone="green">{t('{n} dentro', { n: resumo.in })}</V2Badge>}
          {resumo.out > 0 && <V2Badge tone="red">{t('{n} fora', { n: resumo.out })}</V2Badge>}
          {resumo.fault > 0 && <V2Badge tone="red">{t('{n} faltas na cozinha', { n: resumo.fault })}</V2Badge>}
          {resumo.review > 0 && <V2Badge tone="amber">{t('{n} para revisar', { n: resumo.review })}</V2Badge>}
          {resumo.decided > 0 && <V2Badge tone="neutral">{t('{n} decididos por quem organiza', { n: resumo.decided })}</V2Badge>}
        </div>
      )}

      {anteriores.length > 0 && (
        <V2Surface className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{t('Lances anteriores')}</p>
            {podeLimpar && (
              confirmar ? (
                <span className="flex gap-2">
                  <V2Button size="sm" variant="secondary" disabled={limpando} onClick={limpar}>{t('Apagar todas as marcações')}</V2Button>
                  <V2Button size="sm" variant="ghost" onClick={() => setConfirmar(false)}>{t('Cancelar')}</V2Button>
                </span>
              ) : (
                <V2Button size="sm" variant="ghost" onClick={() => setConfirmar(true)}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> {t('Limpar marcações')}
                </V2Button>
              )
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {anteriores.slice(0, 40).map((l) => {
              const open = aberto === l.id;
              return (
                <li key={l.id} className="space-y-3 py-2">
                  <button type="button"
                    onClick={() => setAberto(open ? null : l.id)}
                    aria-expanded={open}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <Lance l={l} />
                    <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500" title={t('Câmeras que viram o lance')}>
                      <Users className="h-3 w-3" aria-hidden="true" /> {l.positions.length}
                      <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-3 rounded-2xl bg-gray-50 p-3">
                      <LanceMark l={l} />
                      <PerCamera l={l} />
                      {podeLimpar && <Decide l={l} gameDayId={gameDay.id} uid={user?.uid} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </V2Surface>
      )}
    </div>
  );
}
