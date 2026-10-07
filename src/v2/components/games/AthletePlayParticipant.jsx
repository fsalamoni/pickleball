import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  PlayCircle, Pause, Link2, Unlink, LogOut, UserCheck,
} from 'lucide-react';

import { V2Button } from '@/v2/ui/primitives';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { computePlayOrder, PLAY_STATUS } from '@/modules/games/domain/gamePlay';
import { buildPlayHistory } from '@/modules/games/domain/playRotation';
import { courtKindsFromGames } from '@/modules/games/domain/gameKind';
import { groupIdOf } from '@/modules/games/domain/playGroups';
import { buildGroupedPlayView } from '@/modules/games/domain/playGroupsDraw';
import { usePlayGroupsContext } from '@/modules/games/hooks/usePlayGroups';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import {
  useGameDayParticipants, useGameDayGames, useJoinPublicGameDay, useLeaveGameDay,
  useSetPlayParticipantSkip, useSetPlayParticipantPartner,
} from '@/modules/games/hooks/useGameDays';
import { useSetPlayParticipantGroup } from '@/modules/games/hooks/usePlayGroupMutations';
import { PlayGroupBadgeById } from '@/v2/components/games/playGroups/PlayGroupBadge';
import GroupSelect from '@/v2/components/games/playGroups/GroupSelect';
import {
  statusBadge, SkipDialog, PartnerDialog, PlayCourtsSection, PlayOrderSection,
} from '@/v2/components/games/AthletePlayOrganizer';
import { useJoinPanelApplies } from '@/modules/games/hooks/useGameDayJoin';

/**
 * Visão do PARTICIPANTE de um dia de jogo no formato Play (para quem não é o
 * organizador/criador). Mais simples: gerencia apenas a PRÓPRIA participação,
 * vê o quadro de quadras e jogos (somente leitura) e a ordem de participação.
 * Não tem a lista geral de participantes nem controles sobre os demais.
 */
export default function AthletePlayParticipant({ gameDay }) {
  const { user } = useAuth();
  const { data: participants = [] } = useGameDayParticipants(gameDay.id);
  const { data: games = [] } = useGameDayGames(gameDay.id);

  // GRUPOS (flag `play_groups`): a mesma visão do organizador, pelo mesmo lugar
  // — quem joga lê a posição que o organizador lê.
  const grupos = usePlayGroupsContext({ gameDay, participants, games });
  const rodizioEquilibrado = useFeatureFlag(FEATURE_FLAG.PLAY_SMART_ROTATION);
  const courtsDoDia = Math.max(1, Number(gameDay?.play_courts) || 1);
  const view = useMemo(() => {
    if (grupos.ativo) {
      return buildGroupedPlayView({
        participants: grupos.participants, games, courts: courtsDoDia, drawer: grupos.drawer,
        history: rodizioEquilibrado ? buildPlayHistory(games) : null,
        courtKinds: courtKindsFromGames(games, courtsDoDia),
      });
    }
    return computePlayOrder({ participants, games });
  }, [participants, games, grupos.ativo, grupos.participants, grupos.drawer, rodizioEquilibrado, courtsDoDia]);
  const me = useMemo(
    () => participants.find((p) => p.user_id && p.user_id === user?.uid) || null,
    [participants, user?.uid],
  );

  return (
    <div className="space-y-5">
      <MyParticipationCard gameDay={gameDay} participants={participants} view={view} me={me} grupos={grupos} />
      <PlayCourtsSection
        gameDay={gameDay}
        participants={grupos.participants}
        games={games}
        view={view}
        canManage={false}
        grupos={grupos}
      />
      <PlayOrderSection view={view} grupos={grupos} />
    </div>
  );
}

/**
 * "Seu grupo", com a troca por conta própria quando algum grupo é aberto. É um
 * componente à parte, montado só com os grupos ativos: a visão do jogador é
 * usada em todo Play e não depende dos hooks de grupos onde eles não existem.
 * O seletor lista os grupos abertos e o atual (mesmo fechado, para aparecer).
 */
function MeuGrupo({ gameDayId, me, config }) {
  const setGroup = useSetPlayParticipantGroup(gameDayId);
  const meuGrupoId = groupIdOf(me, config);
  const escolhiveis = config.groups.filter((g) => g.join === 'open' || g.id === meuGrupoId);
  const podeTrocar = config.groups.some((g) => g.join === 'open');
  const trocar = async (groupId) => {
    try {
      const r = await setGroup.mutateAsync({ pid: me.id, groupId, self: true });
      const nome = groupId ? config.groups.find((g) => g.id === groupId)?.name : null;
      toast.success(r.moved.length > 1
        ? `Você e a sua dupla foram para ${nome ? `o grupo ${nome}` : 'a fila de quem está sem grupo'}.`
        : (nome ? `Você agora é do grupo ${nome}.` : 'Você ficou sem grupo.'));
    } catch (err) {
      toast.error(err?.message || 'Não foi possível trocar de grupo.');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
      <span>Seu grupo:</span>
      <PlayGroupBadgeById groupId={meuGrupoId} config={config} mostrarSemGrupo />
      {podeTrocar && (
        <GroupSelect
          value={meuGrupoId}
          groups={escolhiveis}
          label="Trocar de grupo"
          disabled={setGroup.isPending}
          onChange={trocar}
        />
      )}
    </div>
  );
}

function MyParticipationCard({ gameDay, participants, view, me, grupos = null }) {
  const join = useJoinPublicGameDay();
  // Sair é o mesmo em toda origem (`leaveGameDay`): no dia de ARENA de um jogo
  // aberto também libera a vaga da vitrine e chama a fila.
  const sair = useLeaveGameDay();
  // Dia público de outra pessoa: quem entra usa o "Participar", no alto da
  // página — o mesmo em todo formato, e o que mostra as vagas e a quadra.
  // Repetir o botão aqui seria oferecer duas portas para a mesma sala.
  const entraPeloPainel = useJoinPanelApplies(gameDay);
  const setSkip = useSetPlayParticipantSkip(gameDay.id);
  const setPartner = useSetPlayParticipantPartner(gameDay.id);
  const [skipOpen, setSkipOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const myView = me ? (view.all.find((p) => p.id === me.id) || { ...me, status: PLAY_STATUS.AVAILABLE }) : null;
  const partnerName = me?.partner_id
    ? (participants.find((p) => p.id === me.partner_id)?.name || 'parceiro')
    : null;

  const handleJoin = async () => {
    try {
      await join.mutateAsync(gameDay);
      toast.success('Você entrou no Play! Já está na ordem de participação.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível iniciar sua participação.');
    }
  };

  const handleLeave = async () => {
    try {
      await sair.mutateAsync(gameDay.id);
      toast.success('Você saiu do Play.');
      setConfirmLeave(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível sair.');
    }
  };

  const statusText = () => {
    if (!myView) return '';
    if (myView.status === PLAY_STATUS.IN_COURT) return 'Você está em quadra agora. Bom jogo!';
    if (myView.status === PLAY_STATUS.UNAVAILABLE) {
      return `Você está pausado pelas próximas ${Number(me.skip_remaining) || 0} partida(s).`;
    }
    // Com grupos, a posição é a da fila DO GRUPO — a que o telão mostra.
    const onde = grupos?.ativo && myView.group_id
      ? ` do grupo ${grupos.config.groups.find((g) => g.id === myView.group_id)?.name}`
      : '';
    return `Você está na fila${onde}, na posição #${myView.groupNo ?? myView.orderNo}. Fique por perto para entrar em quadra.`;
  };



  return (
    <V2CollapsibleCard
      icon={UserCheck}
      title="Minha participação"
      sectionId={GAME_DAY_SECTION.PLAY_ME}
      summary={!me ? 'Você ainda não entrou neste Play' : statusText()}
    >
      <div className="space-y-4">
        {!me ? (
          <div className="space-y-3">
            {entraPeloPainel ? (
              <p className="text-sm text-gray-600">
                Você ainda não está participando deste Play. Para entrar, use{' '}
                <strong className="font-semibold text-ink">“Participar”</strong>, no alto da página — você vai para a
                ordem de participação e pode ser chamado para as quadras.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Você ainda não está participando deste Play. Ao iniciar, você entra na ordem de participação e
                pode ser chamado para as quadras.
              </p>
            )}
            {entraPeloPainel ? null : (
              <V2Button onClick={handleJoin} disabled={join.isPending}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> {join.isPending ? 'Entrando…' : 'Iniciar minha participação'}
              </V2Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(myView)}
              <span className="text-sm text-gray-600">{statusText()}</span>
            </div>
            {partnerName && (
              <p className="flex items-center gap-1.5 text-sm text-blue-600">
                <Link2 className="h-4 w-4" /> Você joga em dupla com {partnerName}.
              </p>
            )}
            {grupos?.ativo && <MeuGrupo gameDayId={gameDay.id} me={me} config={grupos.config} />}

            <div className="flex flex-wrap gap-2">
              {myView.status === PLAY_STATUS.UNAVAILABLE ? (
                <V2Button variant="secondary" onClick={() => setSkip.mutate({ pid: me.id, count: 0 })}>
                  <PlayCircle className="mr-1.5 h-4 w-4" /> Voltar a jogar
                </V2Button>
              ) : (
                <V2Button variant="ghost" onClick={() => setSkipOpen(true)}>
                  <Pause className="mr-1.5 h-4 w-4" /> Ficar indisponível por X jogos
                </V2Button>
              )}

              {me.partner_id ? (
                <V2Button variant="ghost" onClick={() => setPartner.mutate({ pid: me.id, partnerId: null })}>
                  <Unlink className="mr-1.5 h-4 w-4" /> Desfazer dupla
                </V2Button>
              ) : (
                <V2Button variant="ghost" onClick={() => setPartnerOpen(true)}>
                  <Link2 className="mr-1.5 h-4 w-4" /> Vincular dupla
                </V2Button>
              )}

              <V2Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmLeave(true)}>
                <LogOut className="mr-1.5 h-4 w-4" /> Sair do Play
              </V2Button>
            </div>
          </>
        )}
      </div>

      <SkipDialog
        participant={skipOpen ? me : null}
        onClose={() => setSkipOpen(false)}
        onConfirm={(count) => { setSkip.mutate({ pid: me.id, count }); setSkipOpen(false); }}
      />
      <PartnerDialog
        participant={partnerOpen ? me : null}
        participants={participants}
        view={view}
        onClose={() => setPartnerOpen(false)}
        onConfirm={(partnerId) => { setPartner.mutate({ pid: me.id, partnerId }); setPartnerOpen(false); }}
      />
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        destructive
        title="Sair do Play?"
        description="Você será removido da ordem de participação deste dia de jogo. Pode entrar de novo depois."
        confirmLabel="Sair"
        loading={sair.isPending}
        onConfirm={handleLeave}
      />
    </V2CollapsibleCard>
  );
}
