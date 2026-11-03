/**
 * TelaoLineTicker — o último lance do controle de linhas no TELÃO do dia de
 * jogo: aparece no canto, grande, por alguns segundos depois do lance, e some.
 * Só com a flag `line_control` e o controle ligado naquele jogo; sem isso não
 * monta a escuta (nenhuma consulta).
 *
 * Falha da escuta não vira "nenhum lance": o telão só não mostra o cartão —
 * ele é um extra, e o painel do dia segue funcionando.
 */

import React from 'react';
import { Radio } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useLineControlLive, useNow } from '@/modules/linecall/hooks/useLineControlLive';
import { CALL_COLOR, callLabel, callDetail } from './callLabels';
import { t } from '@/core/i18n';

/** Por quanto tempo o lance fica na tela (ms). */
const SHOW_MS = 12000;

function Ticker({ gameDayId }) {
  const live = useLineControlLive(gameDayId);
  const now = useNow(1000);
  const l = live.lances[0];
  if (!l || now - l.t_ms > SHOW_MS || now < l.t_ms - 5000) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-40 max-w-md rounded-3xl border-4 bg-black/85 px-6 py-4 text-white shadow-2xl"
      style={{ borderColor: CALL_COLOR[l.call] || '#fff' }}
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60">
        <Radio className="h-3.5 w-3.5" aria-hidden="true" /> {t('Controle de linhas')}
      </p>
      <p className="font-display text-5xl font-black" style={{ color: CALL_COLOR[l.call] || '#fff' }}>{callLabel(l)}</p>
      <p className="mt-1 text-base text-white/70">
        {l.decided ? t('Decidido por quem organiza.') : l.disagree ? t('As câmeras discordaram.') : callDetail(l.best)}
      </p>
    </div>
  );
}

export default function TelaoLineTicker({ gameDay }) {
  const on = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  if (!on || gameDay?.line_control !== true) return null;
  return <Ticker gameDayId={gameDay.id} />;
}
