/**
 * A aba "Organização de jogos" de uma DATA de evento de clube.
 *
 * Ela escolhe entre DUAS casas, e a escolha é uma pergunta só:
 *
 * · a data tem `game_day_id` → é um dia de jogo do MÓDULO (`game_days`), com
 *   tudo o que o atleta e a arena já tinham — Play, Americano aprimorado,
 *   Mexicano, Rei da Quadra, dupla vinculada, telão, tutorial, ranking do dia
 *   e publicação no ranking/rating;
 * · a data NÃO tem → é legado, e segue servida pelo organizador de sempre,
 *   lendo e escrevendo exatamente onde sempre leu e escreveu.
 *
 * Nada é migrado: um dia de jogo já publicado não é lido, reescrito nem movido.
 * A partir da Onda AS toda data NOVA nasce com `game_day_id`, então o legado
 * encolhe sozinho, sem que ninguém precise converter nada.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, UserMinus, Users, Check, Link as LinkIcon, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { V2Button, V2Surface, V2ErrorState } from '@/v2/ui/primitives';
import { Skeleton } from '@/components/ui/skeleton';
import GameDayModule, { GameDayModuleTools } from '@/v2/components/games/GameDayModule';
import GameDayOrganizer from '@/modules/clubs/components/GameDayOrganizer';
import { isModularEventDate, canUpgradeLegacyDate } from '@/modules/games/domain/clubGameDay';
import { useUpgradeEventDate } from '@/modules/games/hooks/useClubGameDay';
import { useClub, useEventParticipants, useEventGames } from '@/modules/clubs/hooks/useClubs';
import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GD_PARTICIPANT_SOURCE } from '@/modules/games/domain/gameDay';
import {
  useGameDay, useGameDayParticipants, useAddGameDayParticipant,
  useRemoveGameDayParticipant,
} from '@/modules/games/hooks/useGameDays';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { RSVP_STATUS } from '@/modules/clubs/domain/constants';

export default function ClubGameDayTab({ event, clubId, date, rsvps = [] }) {
  // Legado: a data anterior à Onda AS não tem `game_day_id` e continua no
  // organizador de antes, sem nada a converter.
  if (!isModularEventDate(date)) {
    return <LegacyGameDay event={event} clubId={clubId} date={date} />;
  }
  return <ModularGameDay gameDayId={date.game_day_id} rsvps={rsvps} />;
}

/**
 * A data LEGADA — o organizador de sempre, mais a porta de saída.
 *
 * ## Por que existe uma porta, e por que ela é estreita
 *
 * O legado não é migrado: as duas casas guardam em lugares diferentes
 * (`club_events/{id}/{participants,games}` contra `game_days/{id}/…`), e
 * converter uma data que JÁ TEM gente ou jogo esconderia esses documentos da
 * tela — eles seguiriam no banco, intactos, mas ninguém mais os veria. E um
 * dia de jogo já publicado costuma estar no ranking de quem jogou.
 *
 * Só que a data ainda **vazia** não tem nada para mover. Aí converter não é
 * migrar: é escolher a casa antes de entrar nela. É o que deixa uma data
 * agendada meses atrás receber Play, Americano aprimorado, telão, tutorial,
 * administradores nomeados e as configurações do dia.
 *
 * Quando não dá, a tela **diz o motivo** em vez de esconder o botão:
 * organizador que não entende por que a ferramenta dele é diferente da do
 * vizinho vira chamado de suporte.
 */
function LegacyGameDay({ event, clubId, date }) {
  const { data: club = null } = useClub(clubId);
  // As duas consultas já estão no cache: o organizador legado abaixo as usa.
  const { data: participants = [], isError: falhouParticipantes } = useEventParticipants(event.id);
  const { data: games = [], isError: falhouJogos } = useEventGames(event.id);
  const converter = useUpgradeEventDate(event, club || { id: clubId });
  const [confirmar, setConfirmar] = useState(false);

  // ⚠️ FALHA não é "está vazio". Com a consulta caída as duas listas viriam
  // vazias e a tela ofereceria converter uma data que pode ter um dia inteiro
  // de jogo dentro. Estado desconhecido não habilita comando.
  const desconhecido = falhouParticipantes || falhouJogos;
  const veredito = canUpgradeLegacyDate({ dateId: date.id, participants, games });
  const podeConverter = veredito.ok && !desconhecido;

  const ativar = async () => {
    try {
      await converter.mutateAsync({ date, format: GAME_DAY_FORMAT.AMERICANO, play_courts: 1 });
      toast.success('Módulo completo ativado nesta data.');
      setConfirmar(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível ativar.');
    }
  };

  return (
    <div className="space-y-4">
      <V2Surface className="rounded-xl border-amber-200">
        <div className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-amber-600" />
            Esta data usa o organizador antigo
          </div>
          <p className="text-sm text-gray-600">
            Ela foi agendada antes do módulo único, então segue com a ferramenta de sempre — e o que
            já foi jogado aqui continua exatamente onde está. O módulo completo acrescenta{' '}
            <strong>Play</strong>, <strong>Americano aprimorado</strong>, <strong>telão</strong>,
            tutorial do formato, administradores nomeados e as configurações do dia (formato,
            quadras e quem organiza as partidas).
          </p>
          {podeConverter ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <V2Button size="sm" onClick={() => setConfirmar(true)} disabled={converter.isPending}>
                <Sparkles className="mr-1.5 h-4 w-4" /> Ativar o módulo completo
              </V2Button>
              <span className="text-xs text-gray-500">
                Esta data ainda está vazia, então nada é movido.
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              {desconhecido
                ? 'Não deu para conferir se esta data já tem atletas ou partidas, então a conversão fica indisponível por enquanto.'
                : `${veredito.motivo} As datas novas já nascem com o módulo completo.`}
            </p>
          )}
        </div>
      </V2Surface>

      <GameDayOrganizer event={event} clubId={clubId} dateId={date.id} />

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Ativar o módulo completo nesta data?"
        description="A data passa a usar o mesmo dia de jogo do atleta e da arena, com Play, Americano aprimorado, telão e as configurações do dia. Como ela ainda está vazia, nada é movido nem perdido."
        confirmLabel="Ativar"
        loading={converter.isPending}
        onConfirm={ativar}
      />
    </div>
  );
}

function ModularGameDay({ gameDayId, rsvps }) {
  const { data: gameDay, isLoading, isError, refetch } = useGameDay(gameDayId);
  const { data: participants = [] } = useGameDayParticipants(gameDayId);
  const { podeGerenciar } = useGameDayRoles(gameDay, participants);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  // ⚠️ FALHA não é ausência: "pode ter sido arquivado" numa queda de rede
  // manda o organizador do clube procurar quem apagou o dia de jogo.
  if (isError) {
    return (
      <V2Surface className="rounded-xl">
        <div className="p-3">
          <V2ErrorState
            inline
            title="Não foi possível carregar o dia de jogo desta data"
            description="A conexão falhou. Ele continua lá."
            onRetry={refetch}
          />
        </div>
      </V2Surface>
    );
  }
  if (!gameDay) {
    return (
      <V2Surface className="rounded-xl">
        <div className="p-4 text-sm text-gray-500">
          Este dia de jogo não foi encontrado. Ele pode ter sido arquivado.
        </div>
      </V2Surface>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <V2Button asChild variant="ghost" size="sm">
          <Link to={`/dia-de-jogo/${gameDay.id}`}>
            <LinkIcon className="mr-1.5 h-4 w-4" /> Abrir em tela cheia
          </Link>
        </V2Button>
        <GameDayModuleTools gameDay={gameDay} podeGerenciar={podeGerenciar} />
      </div>

      {/* O membro do clube entra e sai sozinho — era o que ele já podia no
          evento legado, e sem isso ele dependeria de alguém lembrar de
          importá-lo depois de ele ter confirmado presença. */}
      <MyPresenceCard gameDay={gameDay} participants={participants} />

      {/* Formato, quadras e quem organiza NÃO estão mais aqui: são as
          configurações DO DIA DE JOGO, e moram no `GameDayModule`
          (`GameDaySettingsCard`), que é o que faz elas chegarem iguais ao
          atleta, à arena e ao clube. Editar o RESTO (título, horário, local) é
          na aba Participação, que é quem manda neles. */}

      {/* O que o LOCAL acrescenta: o clube já perguntou quem vem, e essa
          resposta não existe nas outras origens. Trazer a lista para dentro do
          dia de jogo com um toque é o atalho que o organizador tinha no
          formato antigo — sem ele, o módulo seria um retrocesso para quem usa
          RSVP. */}
      {podeGerenciar && (
        <RsvpImportCard gameDayId={gameDay.id} rsvps={rsvps} participants={participants} />
      )}

      <GameDayModule gameDay={gameDay} podeGerenciar={podeGerenciar} />
    </div>
  );
}

/** Entrar e sair do dia de jogo, para quem está olhando. */
function MyPresenceCard({ gameDay, participants }) {
  const { user, userProfile } = useAuth();
  const add = useAddGameDayParticipant(gameDay.id);
  const remove = useRemoveGameDayParticipant(gameDay.id);
  const uid = user?.uid || null;
  const minhaEntrada = (participants || []).find((p) => p.user_id && p.user_id === uid) || null;

  if (!uid) return null;

  const entrar = async () => {
    try {
      await add.mutateAsync({
        user_id: uid,
        name: userProfile?.platform_name || userProfile?.full_name || user.displayName || 'Atleta',
        photo_url: userProfile?.photo_url || user.photoURL || '',
        source: GD_PARTICIPANT_SOURCE.JOINED,
        play_level: userProfile?.level || userProfile?.leveling_level || null,
        play_gender: userProfile?.gender || null,
      });
      toast.success('Presença confirmada no dia de jogo.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível marcar presença.');
    }
  };

  const sair = async () => {
    try {
      await remove.mutateAsync(minhaEntrada.id);
      toast.success('Você saiu do dia de jogo.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível sair.');
    }
  };

  const ocupado = add.isPending || remove.isPending;

  return (
    <V2Surface className="rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <span className="text-sm text-gray-600">
          {minhaEntrada
            ? 'Você está neste dia de jogo.'
            : 'Você ainda não está neste dia de jogo.'}
        </span>
        {minhaEntrada ? (
          <V2Button size="sm" variant="ghost" disabled={ocupado} onClick={sair}>
            <UserMinus className="mr-1.5 h-4 w-4" /> Sair do dia de jogo
          </V2Button>
        ) : (
          <V2Button size="sm" disabled={ocupado} onClick={entrar}>
            <Check className="mr-1.5 h-4 w-4" /> Marcar presença
          </V2Button>
        )}
      </div>
    </V2Surface>
  );
}

/** Quem confirmou presença nesta data e ainda não está no dia de jogo. */
function RsvpImportCard({ gameDayId, rsvps, participants }) {
  const addParticipant = useAddGameDayParticipant(gameDayId);
  const [enviando, setEnviando] = useState(false);

  const jaNoDia = useMemo(
    () => new Set((participants || []).map((p) => p.user_id).filter(Boolean)),
    [participants],
  );
  const pendentes = useMemo(() => (
    (rsvps || [])
      .filter((r) => r.status === RSVP_STATUS.GOING && r.user_id && !jaNoDia.has(r.user_id))
      .map((r) => ({ user_id: r.user_id, name: r.user_name || 'Atleta', photo_url: r.user_photo || '' }))
  ), [rsvps, jaNoDia]);

  if (pendentes.length === 0) return null;

  const inserir = async (lista) => {
    setEnviando(true);
    let ok = 0;
    for (const entry of lista) {
      try {
        // Em série de propósito: cada inserção recalcula `member_uids` no
        // documento do dia de jogo, e um lote paralelo faria as escritas
        // competirem pelo mesmo campo.
        await addParticipant.mutateAsync({ ...entry, source: GD_PARTICIPANT_SOURCE.INVITED });
        ok += 1;
      } catch (err) {
        toast.error(err.message || `Não foi possível inserir ${entry.name}.`);
        break;
      }
    }
    setEnviando(false);
    if (ok > 0) toast.success(ok === 1 ? '1 atleta inserido.' : `${ok} atletas inseridos.`);
  };

  return (
    <V2Surface className="rounded-xl border-green-200">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-green-600" />
            Confirmaram presença e ainda não estão no dia de jogo
          </div>
          <V2Button size="sm" disabled={enviando} onClick={() => inserir(pendentes)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Inserir {pendentes.length === 1 ? 'o atleta' : `os ${pendentes.length}`}
          </V2Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {pendentes.map((p) => (
            <V2Button
              key={p.user_id}
              size="sm"
              variant="secondary"
              disabled={enviando}
              onClick={() => inserir([p])}
              className="rounded-full"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> {p.name}
            </V2Button>
          ))}
        </div>
      </div>
    </V2Surface>
  );
}
