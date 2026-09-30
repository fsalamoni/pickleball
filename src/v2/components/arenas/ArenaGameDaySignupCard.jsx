/**
 * O cartão de INSCRIÇÃO num dia de jogo de arena — o mesmo na página da arena
 * ("Dias de jogo") e dentro do próprio dia de jogo (`/dia-de-jogo/:id`), para
 * onde o "Jogar" do início leva.
 *
 * Responde, nesta ordem: quando e onde · ainda cabe eu? · entrei? · por que
 * não posso? (a tela DIZ o motivo; botão desabilitado sem explicação é a pior
 * resposta possível).
 *
 * `naPaginaDoDia`: dentro do dia de jogo o título, a data e as observações já
 * estão no cabeçalho, e "Abrir dia de jogo" levaria para a mesma tela.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users, LayoutGrid, Check, ArrowRight, Info,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Badge, V2Button, V2ErrorState } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { useSignUpToArenaGameDay, useLeaveArenaGameDay } from '@/modules/games/hooks/useArenaGameDays';
import { useGameDayParticipants } from '@/modules/games/hooks/useGameDays';
import {
  arenaGameDayWhenText, arenaGameDayVacancies, arenaGameDaySlots,
  arenaSignupMode, ARENA_SIGNUP_MODE, canSignUpToArenaGameDay, isSignedUp,
} from '@/modules/games/domain/arenaGameDay';
import { GAME_DAY_FORMAT_LABELS } from '@/modules/clubs/domain/gameDayFormats';
import { isGameDayOpenToParticipants } from '@/modules/games/domain/gameDayRoles';

export default function ArenaGameDaySignupCard({ gameDay, naPaginaDoDia = false, as: Tag = 'li' }) {
  const { user } = useAuth();
  const inscritosQ = useGameDayParticipants(gameDay.id);
  const participants = inscritosQ.data || [];
  // Sem a lista, não se sabe quantas vagas sobram nem se a pessoa já entrou:
  // a tela não afirma nem oferece nada sobre estado desconhecido.
  const semLista = inscritosQ.isError || inscritosQ.isLoading;
  const inscrever = useSignUpToArenaGameDay();
  const sair = useLeaveArenaGameDay();
  const [quadraEscolhida, setQuadraEscolhida] = useState(null);

  const vagas = arenaGameDayVacancies(gameDay, participants);
  const porQuadra = arenaSignupMode(gameDay) === ARENA_SIGNUP_MODE.COURT;
  const jaEstou = isSignedUp(participants, user?.uid);

  const veredito = canSignUpToArenaGameDay({
    gameDay, participants, uid: user?.uid, courtId: porQuadra ? quadraEscolhida : null,
  });

  const marcar = async () => {
    try {
      await inscrever.mutateAsync({ gameDay, courtId: porQuadra ? quadraEscolhida : null });
      toast.success('Presença confirmada. Bom jogo!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível marcar presença.');
    }
  };

  const desmarcar = async () => {
    try {
      await sair.mutateAsync({ gameDayId: gameDay.id, uid: user?.uid, arenaId: gameDay.arena_id });
      toast.success('Presença desmarcada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível desmarcar.');
    }
  };

  return (
    <Tag className={cn(naPaginaDoDia ? '' : 'rounded-3xl border border-gray-100 bg-paper-pure p-4')}>
      {!naPaginaDoDia && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-ink">{gameDay.title}</h3>
              <p className="mt-0.5 text-sm text-gray-500">{arenaGameDayWhenText(gameDay)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <V2Badge tone="neutral">{GAME_DAY_FORMAT_LABELS[gameDay.format] || gameDay.format}</V2Badge>
              {jaEstou && <V2Badge tone="green"><Check className="mr-1 h-3 w-3" /> Inscrito</V2Badge>}
            </div>
          </div>
          {gameDay.notes && <p className="mt-2 text-sm text-gray-600">{gameDay.notes}</p>}
        </>
      )}
      {naPaginaDoDia && jaEstou && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <Check className="h-4 w-4" aria-hidden="true" /> Você está inscrito neste dia de jogo.
        </p>
      )}

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {arenaGameDaySlots(gameDay).map((s) => (
          <li key={`${s.court_id}-${s.start_time}`} className="rounded-full border border-gray-200 bg-paper px-2.5 py-1 text-xs font-semibold text-gray-600">
            <LayoutGrid className="mr-1 inline h-3 w-3 text-gray-400" />
            {s.court_name || 'Quadra'} · {s.start_time}–{s.end_time}
          </li>
        ))}
      </ul>

      {/* Vagas — o número que decide se vale a pena continuar lendo. */}
      {inscritosQ.isError ? (
        <div className="mt-3">
          <V2ErrorState
            inline
            title="Não carregou a lista de inscritos"
            description="Sem ela não dá para saber quantas vagas sobram."
            onRetry={() => inscritosQ.refetch()}
          />
        </div>
      ) : !inscritosQ.isLoading && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
          <Users className="h-4 w-4 text-gray-400" />
          {porQuadra
            ? `${vagas.byCourt.reduce((a, c) => a + c.used, 0)} inscrito(s)`
            : (vagas.limit == null
              ? `${vagas.used} inscrito(s) · sem limite de vagas`
              : `${vagas.used} de ${vagas.limit} vagas preenchidas`)}
        </p>
      )}

      {/* Escolha da quadra — só quando a inscrição é por quadra, e só para
          quem ainda não entrou. */}
      {porQuadra && !jaEstou && !semLista && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Escolha a quadra</p>
          <div className="flex flex-wrap gap-2">
            {vagas.byCourt.map((c) => (
              <button
                key={c.court_id}
                type="button"
                disabled={c.full}
                onClick={() => setQuadraEscolhida(c.court_id)}
                aria-pressed={quadraEscolhida === c.court_id}
                className={cn(
                  'rounded-2xl border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  quadraEscolhida === c.court_id ? 'border-ink bg-ink/5' : 'border-gray-200 hover:border-ink/40',
                )}
              >
                <span className="block font-bold text-ink">{c.court_name || 'Quadra'}</span>
                <span className="block text-gray-500">{c.start_time}–{c.end_time}</span>
                <span className="block text-gray-500">
                  {c.full ? 'lotada' : (c.limit == null ? `${c.used} inscrito(s)` : `${c.left} vaga(s)`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!semLista && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {jaEstou ? (
            <>
              {!naPaginaDoDia && (
                <V2Button asChild size="sm">
                  <Link to={`/dia-de-jogo/${gameDay.id}`}>
                    Abrir dia de jogo <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </V2Button>
              )}
              <V2Button variant="ghost" size="sm" onClick={desmarcar} disabled={sair.isPending}>
                {sair.isPending ? 'Saindo…' : 'Desmarcar presença'}
              </V2Button>
            </>
          ) : (
            <V2Button size="sm" onClick={marcar} disabled={!veredito.ok || inscrever.isPending}>
              {inscrever.isPending ? 'Confirmando…' : 'Marcar presença'}
            </V2Button>
          )}
          {isGameDayOpenToParticipants(gameDay) && (
            <span className="text-xs text-gray-500">Os inscritos também conduzem as partidas.</span>
          )}
        </div>
      )}

      {/* O motivo, quando não dá. Dizer "não posso" sem dizer por quê é o que
          faz a pessoa clicar cinco vezes e desistir. */}
      {!semLista && !jaEstou && !veredito.ok && veredito.message && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-gray-500">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>{veredito.message}</span>
        </p>
      )}
    </Tag>
  );
}

