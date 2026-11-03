/**
 * TelaoLineTicker — o controle de linhas no TELÃO do dia de jogo:
 *
 * · uma faixa pequena e fixa com quantas câmeras estão analisando (e quais
 *   pararam), para quem joga saber se o controle está valendo;
 * · "Lance em revisão" enquanto o último lance espera a palavra de quem
 *   organiza;
 * · o último lance, grande, por alguns segundos, e some.
 *
 * Só com a flag `line_control` e o controle ligado naquele jogo; sem isso não
 * monta a escuta (nenhuma consulta). Falha da escuta não vira "nenhuma câmera":
 * o telão só não mostra nada do controle — ele é um extra, e o painel do dia
 * segue funcionando.
 */

import React from 'react';
import { Radio, Gavel } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useLineControlLive, useNow } from '@/modules/linecall/hooks/useLineControlLive';
import { layoutById, CAMERA_POSITIONS } from '@/modules/linecall/domain/cameraLayouts';
import { telaoLineStatus } from '@/modules/linecall/domain/fusion';
import { CALL_COLOR, callLabel, callDetail } from './callLabels';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useTournamentLineCourts } from '@/modules/linecall/hooks/useTournamentLineCourts';
import { tournamentLineHost } from '@/modules/linecall/domain/tournamentLine';
import { t } from '@/core/i18n';

/** Por quanto tempo o lance fica na tela (ms). */
const SHOW_MS = 12000;

/** O canto do telão onde os avisos empilham. */
const CANTO = 'pointer-events-none fixed bottom-6 right-6 z-40 flex max-w-md flex-col items-end gap-3';

/**
 * Os avisos de UM anfitrião (jogo do dia ou quadra do torneio), sem posição
 * própria: quem monta decide o canto. `label` (a quadra) entra antes do texto.
 */
function TickerBody({ host, label }) {
  const live = useLineControlLive(host.id);
  const now = useNow(1000);
  if (live.isError || live.isLoading) return null;
  const layout = layoutById(host.line_control_layout);
  const st = telaoLineStatus({ positions: layout.positions, cams: live.cams, lances: live.lances, nowMs: now });
  const l = live.lances[0];
  const mostrarLance = l && !st.inReview && now - l.t_ms <= SHOW_MS && now >= l.t_ms - 5000;
  const pre = label ? `${label} · ` : '';

  return (
    <>
      {st.inReview && (
        <div role="status" aria-live="assertive" className="rounded-3xl border-4 border-amber-400 bg-black/85 px-6 py-4 text-white shadow-2xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
            <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> {pre}{t('Controle de linhas')}
          </p>
          <p className="font-display text-4xl font-black text-amber-300">{t('Lance em revisão')}</p>
          <p className="mt-1 text-base text-white/70">{t('Quem organiza está olhando o replay. Aguarde a decisão.')}</p>
        </div>
      )}
      {mostrarLance && (
        <div role="status" aria-live="polite" className="rounded-3xl border-4 bg-black/85 px-6 py-4 text-white shadow-2xl" style={{ borderColor: CALL_COLOR[l.call] || '#fff' }}>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" /> {pre}{t('Controle de linhas')}
          </p>
          <p className="font-display text-5xl font-black" style={{ color: CALL_COLOR[l.call] || '#fff' }}>{callLabel(l)}</p>
          <p className="mt-1 text-base text-white/70">
            {l.decided ? t('Decidido por quem organiza.') : l.disagree ? t('As câmeras discordaram.') : callDetail(l.best)}
          </p>
        </div>
      )}
      <p
        role="status"
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${st.ready ? 'bg-black/70 text-green-300' : 'bg-black/80 text-amber-300'}`}
      >
        <Radio className="h-4 w-4" aria-hidden="true" />
        {pre}{st.ready
          ? t('Controle de linhas ativo · {n} câmera(s)', { n: st.total })
          : st.analyzing === 0
            ? t('Controle de linhas parado: nenhuma câmera analisando')
            : t('Controle de linhas: {n} de {m} câmeras · parada: {p}', {
              n: st.analyzing, m: st.total, p: st.down.map((p) => t(CAMERA_POSITIONS[p]?.label || p)).join(', '),
            })}
      </p>
    </>
  );
}

export default function TelaoLineTicker({ gameDay }) {
  const on = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  if (!on || gameDay?.line_control !== true) return null;
  return <div className={CANTO}><TickerBody host={gameDay} /></div>;
}

/**
 * O telão do TORNEIO (`/torneios/:id/telao`): um aviso por quadra com o
 * controle ligado (docs/53 §9). A leitura de `tournament_line_courts` pede
 * conta logada; sem conta, ou com a leitura falhando, não aparece nada — o
 * quadro dos jogos segue igual.
 */
export function TournamentTelaoLines({ tournamentId }) {
  const on = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  const { user } = useAuth();
  const q = useTournamentLineCourts(tournamentId, { enabled: on && Boolean(user?.uid), refetchInterval: 30_000 });
  const ligadas = (q.data || []).filter((d) => d.line_control === true);
  if (!on || !ligadas.length) return null;
  return (
    <div className={CANTO}>
      {ligadas.map((d) => (
        <TickerBody
          key={d.court_id}
          host={{ id: tournamentLineHost(tournamentId, d.court_id), line_control_layout: d.line_control_layout || null }}
          label={d.court_name || d.court_id}
        />
      ))}
    </div>
  );
}
