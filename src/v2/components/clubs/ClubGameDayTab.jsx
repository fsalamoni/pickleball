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
import { UserPlus, UserMinus, Users, Check, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { V2Button, V2Surface } from '@/v2/ui/primitives';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import GameDayModule, { GameDayModuleTools } from '@/v2/components/games/GameDayModule';
import GameDayOrganizer from '@/modules/clubs/components/GameDayOrganizer';
import { isModularEventDate } from '@/modules/games/domain/clubGameDay';
import { GD_PARTICIPANT_SOURCE } from '@/modules/games/domain/gameDay';
import {
  useGameDay, useGameDayParticipants, useAddGameDayParticipant,
  useRemoveGameDayParticipant, useGameDayGames, useUpdateGameDay,
} from '@/modules/games/hooks/useGameDays';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { RSVP_STATUS } from '@/modules/clubs/domain/constants';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS, DRAW_FORMATS, isCourtByCourtFormat,
} from '@/modules/clubs/domain/gameDayFormats';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

export default function ClubGameDayTab({ event, clubId, date, rsvps = [] }) {
  // Legado: a data anterior à Onda AS não tem `game_day_id` e continua no
  // organizador de antes, sem nada a converter.
  if (!isModularEventDate(date)) {
    return <GameDayOrganizer event={event} clubId={clubId} dateId={date.id} />;
  }
  return <ModularGameDay gameDayId={date.game_day_id} rsvps={rsvps} />;
}

function ModularGameDay({ gameDayId, rsvps }) {
  const { data: gameDay, isLoading } = useGameDay(gameDayId);
  const { data: participants = [] } = useGameDayParticipants(gameDayId);
  const { podeGerenciar, podeConfigurar } = useGameDayRoles(gameDay, participants);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
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

      {/* Corrigir o formato escolhido ao agendar a data. Editar o RESTO (título,
          horário, local) é na aba Participação, que é quem manda neles — dois
          lugares editando o mesmo campo divergem. */}
      {podeConfigurar && <FormatCard gameDay={gameDay} />}

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

/**
 * Trocar o formato do dia de jogo — **enquanto não houver partidas**.
 *
 * Depois da primeira partida a troca não é edição, é perda: o Play não guarda
 * placar, o Mexicano deriva as rodadas da classificação e o Rei da Quadra, do
 * resultado anterior. Em vez de apagar o que aconteceu, a tela explica.
 */
function FormatCard({ gameDay }) {
  const { data: games = [] } = useGameDayGames(gameDay.id);
  const update = useUpdateGameDay();
  const americanoLiveOn = useFeatureFlag(FEATURE_FLAG.GAMEDAY_AMERICANO_LIVE);

  const opcoes = useMemo(() => {
    const lista = [
      ...DRAW_FORMATS,
      GAME_DAY_FORMAT.PLAY,
      ...(americanoLiveOn ? [GAME_DAY_FORMAT.AMERICANO_LIVE] : []),
    ];
    // O formato que o dia JÁ TEM entra na lista mesmo com a flag desligada:
    // uma flag desligada tira a opção de ESCOLHER, nunca pode deixar o seletor
    // sem a opção correspondente ao que está gravado.
    return lista.includes(gameDay.format) ? lista : [gameDay.format, ...lista];
  }, [americanoLiveOn, gameDay.format]);

  const temPartidas = games.length > 0;

  const trocar = async (format) => {
    if (format === gameDay.format) return;
    try {
      await update.mutateAsync({ id: gameDay.id, patch: { format, play_courts: gameDay.play_courts || 1 } });
      toast.success('Formato alterado.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível alterar o formato.');
    }
  };

  const mudarQuadras = async (valor) => {
    const n = Math.max(1, Math.min(12, Number(valor) || 1));
    if (n === (gameDay.play_courts || 1)) return;
    try {
      await update.mutateAsync({ id: gameDay.id, patch: { play_courts: n } });
    } catch (err) {
      toast.error(err.message || 'Não foi possível alterar as quadras.');
    }
  };

  return (
    <V2Surface className="rounded-xl">
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`fmt-${gameDay.id}`}>Formato</Label>
          <select
            id={`fmt-${gameDay.id}`}
            className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-ink disabled:bg-paper disabled:text-gray-400"
            value={gameDay.format}
            disabled={temPartidas || update.isPending}
            onChange={(e) => trocar(e.target.value)}
          >
            {opcoes.map((v) => <option key={v} value={v}>{GAME_DAY_FORMAT_LABELS[v] || v}</option>)}
          </select>
          {temPartidas && (
            <p className="text-xs text-gray-500">
              O dia já tem partidas. Para trocar de formato, apague as partidas primeiro — cada
              formato deriva as rodadas de um jeito, e a troca perderia o que já aconteceu.
            </p>
          )}
        </div>
        {isCourtByCourtFormat(gameDay.format) && (
          <div className="space-y-1.5">
            <Label htmlFor={`qd-${gameDay.id}`}>Quadras</Label>
            <input
              id={`qd-${gameDay.id}`}
              type="number"
              min={1}
              max={12}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-ink"
              defaultValue={gameDay.play_courts || 1}
              disabled={update.isPending}
              onBlur={(e) => mudarQuadras(e.target.value)}
            />
            <p className="text-xs text-gray-500">Quantas quadras rodam ao mesmo tempo.</p>
          </div>
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
        // eslint-disable-next-line no-await-in-loop
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
