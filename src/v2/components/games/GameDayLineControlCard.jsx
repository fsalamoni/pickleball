/**
 * GameDayLineControlCard — liga o CONTROLE DE LINHAS por câmera neste jogo
 * (ou em todos os meus) e leva à tela da câmera. Montado dentro do
 * `GameDayModule`, então vale igual no atleta, na arena e no clube.
 *
 * Só existe com a flag `line_control` ligada pelo admin da plataforma. Quem
 * pode ligar é quem CONFIGURA o dia (`podeConfigurar`); para os demais o
 * cartão só aparece se o controle estiver ligado, como aviso.
 *
 * Ligar vale para jogo em andamento: não depende de status nem de partida.
 */

import React from 'react';
import { toast } from 'sonner';
import { ScanLine, Camera } from 'lucide-react';

import { V2Surface, V2Button, V2Toggle } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useMyGameDays, useUpdateGameDay, useSetGameDaysLineControl } from '@/modules/games/hooks/useGameDays';
import { lineControlTargets } from '@/modules/linecall/domain/lineControlTargets';
import { todayISO } from '@/modules/arenas/domain/calendar';
import { t } from '@/core/i18n';

export default function GameDayLineControlCard({ gameDay }) {
  // Flag desligada: nem os hooks de baixo rodam (zero consulta).
  const ligada = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  if (!ligada || !gameDay?.id) return null;
  return <LineControlCard gameDay={gameDay} />;
}

function LineControlCard({ gameDay }) {
  const { user } = useAuth();
  const { podeConfigurar } = useGameDayRoles(gameDay);
  const update = useUpdateGameDay();
  const setMany = useSetGameDaysLineControl();
  // Só quem pode ligar precisa da lista dos próprios dias (para "todos").
  const meus = useMyGameDays({ enabled: podeConfigurar });
  const on = gameDay.line_control === true;

  if (!podeConfigurar && !on) return null;

  const abrir = () => window.open(`/dia-de-jogo/${gameDay.id}/linhas`, '_blank', 'noopener,noreferrer');

  const alternar = (valor) => update.mutate(
    { id: gameDay.id, patch: { line_control: valor } },
    { onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')) },
  );

  const todos = (valor) => {
    const ids = lineControlTargets(meus.data, user?.uid, valor, todayISO());
    if (!ids.length) {
      toast.info(t('Seus próximos dias de jogo já estão assim.'));
      return;
    }
    setMany.mutate({ ids, on: valor }, {
      onSuccess: (n) => toast.success(t('Controle de linhas atualizado em {n} dia(s) de jogo.', { n })),
      onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')),
    });
  };

  return (
    <V2Surface className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
        <div className="min-w-0 flex-1">
          {podeConfigurar ? (
            <V2Toggle
              id={`linhas-${gameDay.id}`}
              checked={on}
              disabled={update.isPending}
              onChange={alternar}
              label={t('Controle de linhas por câmera')}
              hint={t('A câmera marca se a bola quicou dentro ou fora e se houve pé na cozinha no voleio. Pode ligar com o jogo em andamento.')}
            />
          ) : (
            <>
              <p className="text-sm font-semibold text-ink">{t('Controle de linhas ligado')}</p>
              <p className="text-xs leading-5 text-gray-500">{t('Uma câmera acompanha as linhas deste jogo. Na dúvida, ela diz "revisar" e a decisão volta para a quadra.')}</p>
            </>
          )}
        </div>
      </div>
      {podeConfigurar && (
        <div className="flex flex-wrap gap-2">
          {on && (
            <V2Button size="sm" onClick={abrir}>
              <Camera className="mr-1.5 h-4 w-4" /> {t('Abrir câmera')}
            </V2Button>
          )}
          <V2Button size="sm" variant="secondary" disabled={setMany.isPending || !meus.isSuccess} onClick={() => todos(true)}>
            {t('Ligar em todos os meus jogos')}
          </V2Button>
          <V2Button size="sm" variant="ghost" disabled={setMany.isPending || !meus.isSuccess} onClick={() => todos(false)}>
            {t('Desligar em todos')}
          </V2Button>
        </div>
      )}
    </V2Surface>
  );
}
