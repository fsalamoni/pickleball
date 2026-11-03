/**
 * GameDayLineControlCard — o CONTROLE DE LINHAS por câmera deste dia de jogo,
 * QUADRA POR QUADRA: cada quadra liga o seu e escolhe quantas câmeras e onde.
 * Montado dentro do `GameDayModule`, então vale igual no atleta, na arena e no
 * clube.
 *
 * Só existe com a flag `line_control` ligada pelo admin da plataforma. Quem
 * liga e configura é quem organiza o dia ou o administrador nomeado
 * (`podeConfigurarLinhas`; a regra de `line_courts` confere igual); para os
 * demais o cartão só aparece se alguma quadra estiver ligada, como aviso.
 *
 * Ligar vale para jogo em andamento: não depende de status nem de partida.
 */

import React from 'react';
import { toast } from 'sonner';
import { ScanLine, CopyCheck } from 'lucide-react';

import { V2Surface, V2Button, V2ErrorState } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useMyGameDays, useGameDayGames } from '@/modules/games/hooks/useGameDays';
import { useGameDayLineCourts, useSaveGameDayLineCourts } from '@/modules/linecall/hooks/useGameDayLineCourts';
import { canBeLineCamera, gameDayLineCourts, gameDayLinePage, lineCourtCopyPlan } from '@/modules/linecall/domain/gameDayLine';
import { todayISO } from '@/modules/arenas/domain/calendar';
import LineCourtsBoard from '@/v2/components/linecall/LineCourtsBoard';
import { t } from '@/core/i18n';

export default function GameDayLineControlCard({ gameDay }) {
  // Flag desligada: nem os hooks de baixo rodam (zero consulta).
  const ligada = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  if (!ligada || !gameDay?.id) return null;
  return <LineControlCard gameDay={gameDay} />;
}

function LineControlCard({ gameDay }) {
  const { user } = useAuth();
  const { podeConfigurarLinhas: podeConfigurar } = useGameDayRoles(gameDay);
  const quadras = useGameDayLineCourts(gameDay.id);
  const jogos = useGameDayGames(gameDay.id);
  const salvar = useSaveGameDayLineCourts();
  // Só quem configura precisa da lista dos próprios dias (para copiar).
  const meus = useMyGameDays({ enabled: podeConfigurar });
  const docs = Object.fromEntries((quadras.data || []).map((d) => [d.id, d]));
  const courts = gameDayLineCourts(gameDay, { games: jogos.data || [], docs: quadras.data || [] });
  const algumaLigada = courts.some((c) => docs[c.id]?.line_control === true);

  if (!podeConfigurar && !algumaLigada) return null;

  const gravar = (items, ok) => salvar.mutate(
    items.map((i) => ({ ...i, gameDayId: i.gameDayId || gameDay.id })),
    {
      onSuccess: (r) => {
        if (r.failed) toast.error(t('{n} quadra(s) não foram salvas. Tente de novo.', { n: r.failed }));
        else if (ok) ok(r);
      },
      onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')),
    },
  );

  const copiar = () => {
    const plano = lineCourtCopyPlan(gameDay, quadras.data || [], meus.data, user?.uid, todayISO());
    const items = plano.flatMap((p) => p.courts.map((c) => ({ gameDayId: p.gameDayId, courtId: c.id, patch: c.patch })));
    if (!items.length) {
      toast.info(t('Você não tem outros dias de jogo de hoje em diante.'));
      return;
    }
    gravar(items, () => toast.success(t('Controle de linhas copiado para {n} dia(s) de jogo.', { n: plano.length })));
  };

  return (
    <V2Surface className="space-y-3 p-4" data-dica="dia-linhas">
      <div className="flex items-start gap-3">
        <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t('Controle de linhas por câmera')}</p>
          <p className="text-xs leading-5 text-gray-500">
            {podeConfigurar
              ? t('Ligue em cada quadra que vai ter câmera e escolha quantas câmeras ela usa — cada quadra pode ter um número diferente. As câmeras marcam bola fora, saque fora da área ou na cozinha, pé na cozinha no voleio, pé no saque e dois quiques. Pode ligar com o jogo em andamento.')
              : t('As câmeras acompanham as linhas das quadras ligadas. Quem participa pode usar o próprio celular como uma delas. Na dúvida, a câmera diz "revisar" e a decisão volta para a quadra.')}
          </p>
        </div>
      </div>
      {quadras.isError ? (
        <V2ErrorState inline onRetry={quadras.refetch} />
      ) : quadras.isLoading ? null : (
        <LineCourtsBoard
          courts={courts}
          docs={docs}
          staff={podeConfigurar}
          camera={canBeLineCamera(gameDay, user?.uid, podeConfigurar)}
          pageFor={(id) => gameDayLinePage(gameDay.id, id)}
          onSave={(items) => gravar(items)}
          saving={salvar.isPending}
          newTab
        />
      )}
      {podeConfigurar && quadras.isSuccess && (
        <V2Button size="sm" variant="ghost" disabled={salvar.isPending || !meus.isSuccess} onClick={copiar}>
          <CopyCheck className="mr-1.5 h-4 w-4" /> {t('Copiar para os meus próximos dias de jogo')}
        </V2Button>
      )}
    </V2Surface>
  );
}
