/**
 * "PARTICIPAR" dentro do dia de jogo (`/dia-de-jogo/:id`).
 *
 * O "Jogar" do início e o Procura-se jogo levam para DENTRO do dia de jogo —
 * é onde a pessoa vê o formato, as regras e quem vai. Então é aqui que ela
 * tem de poder entrar. Antes, quem chegava num dia público que não era dele
 * via o dia e não tinha botão nenhum: entrar só existia em outra tela (o
 * convite no Procura-se jogo; na arena, a página da arena).
 *
 * Um painel só, que decide pela origem:
 *  - dia de jogo da ARENA: o mesmo cartão da página da arena (vagas, a quadra
 *    quando a inscrição é por quadra, marcar e desmarcar presença), porque o
 *    teto e a quadra valem igual nos dois lugares;
 *  - dia de jogo PÚBLICO do atleta: entrar e sair, sem teto;
 *  - ⭐ dia de jogo do CLUBE, para quem é do clube: entrar e sair — inclusive
 *    quem organiza, porque quem agenda a data não vira jogador. É o mesmo
 *    painel na aba do evento do clube e aqui, no dia aberto pelo "Jogar".
 *
 * Não aparece para quem organiza o dia do atleta ou da arena (inserem e tiram
 * gente pela lista de participantes), no dia privado que não é de clube e no
 * do JOGO ABERTO (tem o painel próprio, com a faixa de nível e a fila). Quem
 * decide é `useJoinPanelApplies`. E o que já TERMINOU não oferece entrada.
 */
import React from 'react';
import { toast } from 'sonner';
import { Check, LogIn, LogOut, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useJoinPublicGameDay, useGameDayParticipants, useLeaveGameDay,
} from '@/modules/games/hooks/useGameDays';
import { useJoinPanelApplies } from '@/modules/games/hooks/useGameDayJoin';
import { isArenaGameDay } from '@/modules/games/domain/arenaGameDay';
import { isClubGameDay } from '@/modules/games/domain/clubGameDay';
import { gameDayEndsAt } from '@/modules/games/domain/playDiscovery';
import { V2Button, V2ErrorState, V2Surface } from '@/v2/ui/primitives';
import ArenaGameDaySignupCard from '@/v2/components/arenas/ArenaGameDaySignupCard';

function Cabecalho({ children }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <UserPlus className="h-5 w-5 text-acid-dark" aria-hidden="true" />
      <h2 className="font-display text-lg font-bold text-ink">{children}</h2>
    </div>
  );
}

/** O dia público do atleta e o do clube: entrar e sair. */
function EntrarNoDia({ gameDay, uid }) {
  const inscritosQ = useGameDayParticipants(gameDay.id);
  const entrar = useJoinPublicGameDay();
  const sair = useLeaveGameDay(); // tira só a PRÓPRIA inscrição, em qualquer origem
  const inscritos = inscritosQ.data || [];
  const jaEstou = inscritos.some((p) => p?.user_id === uid);

  if (inscritosQ.isError) {
    return (
      <V2ErrorState
        inline
        title="Não carregou quem vai"
        description="Sem a lista não dá para saber se você já está nela. Tente de novo."
        onRetry={() => inscritosQ.refetch()}
      />
    );
  }
  if (inscritosQ.isLoading) return null;

  const onEntrar = async () => {
    try {
      await entrar.mutateAsync(gameDay);
      toast.success('Você entrou no dia de jogo. Bom jogo!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível entrar.');
    }
  };
  const onSair = async () => {
    try {
      await sair.mutateAsync(gameDay.id);
      toast.success('Você saiu do dia de jogo.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível sair.');
    }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm text-gray-600">
        <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
        {inscritos.length === 0 ? 'Ninguém inscrito ainda — seja o primeiro.' : `${inscritos.length} ${inscritos.length === 1 ? 'pessoa inscrita' : 'pessoas inscritas'}.`}
      </p>
      {jaEstou ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" aria-hidden="true" /> Você está inscrito.
          </span>
          <V2Button variant="ghost" size="sm" onClick={onSair} disabled={sair.isPending}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> {sair.isPending ? 'Saindo…' : 'Sair do dia de jogo'}
          </V2Button>
        </div>
      ) : (
        <V2Button onClick={onEntrar} disabled={entrar.isPending}>
          <LogIn className="h-4 w-4" aria-hidden="true" /> {entrar.isPending ? 'Entrando…' : 'Participar do dia de jogo'}
        </V2Button>
      )}
    </div>
  );
}

export default function GameDayJoinPanel({ gameDay, podeConfigurar = false, agora = Date.now(), className }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const aparece = useJoinPanelApplies(gameDay, { podeConfigurar });
  if (!aparece) return null;

  const terminou = Number.isFinite(gameDayEndsAt(gameDay)) && gameDayEndsAt(gameDay) <= agora;
  if (terminou) {
    return (
      <V2Surface className={className}>
        <p className="text-sm text-gray-500">Este dia de jogo já aconteceu — a inscrição está encerrada.</p>
      </V2Surface>
    );
  }

  return (
    <V2Surface className={className} data-dica="dia-participar">
      <Cabecalho>{isClubGameDay(gameDay) ? 'Participar · dia de jogo do seu clube' : 'Participar'}</Cabecalho>
      {isArenaGameDay(gameDay)
        ? <ArenaGameDaySignupCard gameDay={gameDay} naPaginaDoDia as="div" />
        : <EntrarNoDia gameDay={gameDay} uid={uid} />}
    </V2Surface>
  );
}
