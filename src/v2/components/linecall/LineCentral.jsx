/**
 * LineCentral — a CENTRAL das câmeras de um jogo: quem está no ar em cada
 * posição do arranjo e os lances já juntados (`fuseLineCalls`), do mais
 * recente para trás. Serve para a mesa da organização, um tablet na beira da
 * quadra ou uma TV.
 */

import React, { useState } from 'react';
import { Radio, Trash2, Users } from 'lucide-react';
import { V2Surface, V2Button, V2Badge, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { CAMERA_POSITIONS, layoutById } from '@/modules/linecall/domain/cameraLayouts';
import { positionOccupancy } from '@/modules/linecall/domain/fusion';
import { useNow } from '@/modules/linecall/hooks/useLineControlLive';
import { clearLineCalls } from '@/modules/linecall/services/lineCallSync';
import CourtDiagram from './CourtDiagram';
import { CALL_TEXT, callLabel, callDetail } from './callLabels';
import { cn } from '@/core/lib/utils';
import { t, fmtData } from '@/core/i18n';

const hora = (ms) => fmtData(ms, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const nomes = (ids) => ids.map((p) => t(CAMERA_POSITIONS[p]?.label || p)).join(' · ');

function Lance({ l, big = false }) {
  return (
    <div className={cn('space-y-1', big && 'text-center')}>
      <p className={cn(big ? 'text-5xl font-black sm:text-6xl' : 'text-base font-bold', CALL_TEXT[l.call])}>{callLabel(l)}</p>
      <p className={cn('text-gray-600', big ? 'text-base' : 'text-xs')}>
        {l.disagree ? t('As câmeras discordaram: a decisão volta para a quadra.') : callDetail(l.best)}
      </p>
      <p className="text-xs text-gray-500">
        {t('{h} · visto por: {c}', { h: hora(l.t_ms), c: nomes(l.positions) })}
      </p>
    </div>
  );
}

/**
 * @param {{ gameDay: object, live: ReturnType<import('@/modules/linecall/hooks/useLineControlLive').useLineControlLive>,
 *   podeLimpar?: boolean }} props
 */
export default function LineCentral({ gameDay, live, podeLimpar = false }) {
  const now = useNow();
  const layout = layoutById(gameDay.line_control_layout);
  const occ = positionOccupancy(layout.positions, live.cams, now);
  const [confirmar, setConfirmar] = useState(false);
  const [limpando, setLimpando] = useState(false);

  if (live.isError) return <V2ErrorState onRetry={live.retry} description={t('Não deu para ouvir as câmeras deste jogo.')} />;
  if (live.isLoading) return <V2Skeleton lines={4} />;

  const [ultimo, ...anteriores] = live.lances;
  const noAr = Object.values(occ).filter(Boolean).length;

  const limpar = async () => {
    setLimpando(true);
    try { await clearLineCalls(gameDay.id); } finally { setLimpando(false); setConfirmar(false); }
  };

  return (
    <div className="space-y-4">
      <V2Surface className="p-4">
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
            <ul className="space-y-2">
              {layout.positions.map((p, i) => {
                const c = occ[p];
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
                        {c.fps > 0 && <span className="text-xs text-gray-500">{t('{n} quadros/s', { n: c.fps })}</span>}
                        {c.name && <span className="text-xs text-gray-500">{c.name}</span>}
                      </>
                    ) : (
                      <V2Badge tone="neutral">{t('Sem câmera')}</V2Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </V2Surface>

      <V2Surface className="p-6" aria-live="polite">
        {ultimo ? <Lance l={ultimo} big /> : (
          <p className="text-center text-sm text-gray-500">
            {noAr
              ? t('As câmeras estão no ar. O primeiro quique ou voleio aparece aqui.')
              : t('Nenhuma câmera no ar ainda. Em cada aparelho, abra esta página e escolha "Usar este aparelho como câmera".')}
          </p>
        )}
      </V2Surface>

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
            {anteriores.slice(0, 40).map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                <Lance l={l} />
                <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500" title={t('Câmeras que viram o lance')}>
                  <Users className="h-3 w-3" aria-hidden="true" /> {l.positions.length}
                </span>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}
    </div>
  );
}
