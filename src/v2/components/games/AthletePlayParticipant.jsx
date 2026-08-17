import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  PlayCircle, Pause, Link2, Unlink, LogOut, UserCheck,
} from 'lucide-react';

import { V2Surface, V2Button } from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { computePlayOrder, PLAY_STATUS } from '@/modules/games/domain/gamePlay';
import {
  useGameDayParticipants, useGameDayGames, useJoinPublicGameDay,
  useSetPlayParticipantSkip, useSetPlayParticipantPartner, useRemoveGameDayParticipant,
} from '@/modules/games/hooks/useGameDays';
import {
  statusBadge, SkipDialog, PartnerDialog, PlayCourtsSection, PlayOrderSection,
} from '@/v2/components/games/AthletePlayOrganizer';

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

  const view = useMemo(() => computePlayOrder({ participants, games }), [participants, games]);
  const me = useMemo(
    () => participants.find((p) => p.user_id && p.user_id === user?.uid) || null,
    [participants, user?.uid],
  );

  return (
    <div className="space-y-5">
      <MyParticipationCard gameDay={gameDay} participants={participants} view={view} me={me} />
      <PlayCourtsSection
        gameDay={gameDay}
        participants={participants}
        games={games}
        view={view}
        canManage={false}
      />
      <PlayOrderSection view={view} />
    </div>
  );
}

function MyParticipationCard({ gameDay, participants, view, me }) {
  const join = useJoinPublicGameDay();
  const setSkip = useSetPlayParticipantSkip(gameDay.id);
  const setPartner = useSetPlayParticipantPartner(gameDay.id);
  const removeSelf = useRemoveGameDayParticipant(gameDay.id);
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
      await removeSelf.mutateAsync(me.id);
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
    return `Você está na fila, na posição #${myView.orderNo}. Fique por perto para entrar em quadra.`;
  };

  return (
    <V2Surface>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-green-600" />
          <h3 className="text-base font-semibold text-ink">Minha participação</h3>
        </div>

        {!me ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Você ainda não está participando deste Play. Ao iniciar, você entra na ordem de participação e
              pode ser chamado para as quadras.
            </p>
            <V2Button onClick={handleJoin} disabled={join.isPending}>
              <PlayCircle className="mr-1.5 h-4 w-4" /> {join.isPending ? 'Entrando…' : 'Iniciar minha participação'}
            </V2Button>
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
        loading={removeSelf.isPending}
        onConfirm={handleLeave}
      />
    </V2Surface>
  );
}
