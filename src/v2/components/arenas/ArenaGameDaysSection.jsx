/**
 * ArenaGameDaysSection — os dias de jogo da arena, na visão do ATLETA.
 *
 * Fica na página pública da arena (flag `arena_game_day`). É o canal de
 * inscrição: a arena marca o dia no calendário, e é aqui que a pessoa
 * confirma presença.
 *
 * ## O que a tela precisa responder, nesta ordem
 *
 *  1. **quando e onde** — data, horário e quadras;
 *  2. **ainda cabe eu?** — vagas restantes, e por quadra quando for o caso;
 *  3. **entrei?** — quem já está inscrito vê isso antes de tudo, com o caminho
 *     para o dia de jogo e a saída;
 *  4. **por que não posso?** — quando a inscrição está fechada, a tela DIZ o
 *     motivo. Botão desabilitado sem explicação é a pior resposta possível.
 *
 * O que NÃO fica aqui: conduzir as partidas. Isso é o dia de jogo de sempre,
 * em `/dia-de-jogo/:id` — a mesma tela dos outros formatos, com os mesmos
 * poderes (se a arena abriu a gestão aos inscritos, o atleta a encontra lá).
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarClock, Users, LayoutGrid, Check, ArrowRight, Info,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import {
  useArenaGameDays, useSignUpToArenaGameDay, useLeaveArenaGameDay,
} from '@/modules/games/hooks/useArenaGameDays';
import { useGameDayParticipants } from '@/modules/games/hooks/useGameDays';
import {
  arenaGameDayWhenText, arenaGameDayVacancies, arenaGameDaySlots,
  arenaSignupMode, ARENA_SIGNUP_MODE, canSignUpToArenaGameDay, isSignedUp,
} from '@/modules/games/domain/arenaGameDay';
import { GAME_DAY_FORMAT_LABELS } from '@/modules/clubs/domain/gameDayFormats';
import { isGameDayOpenToParticipants } from '@/modules/games/domain/gameDayRoles';

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CartaoDeInscricao({ gameDay }) {
  const { user } = useAuth();
  const { data: participants = [] } = useGameDayParticipants(gameDay.id);
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
    <li className="rounded-3xl border border-gray-100 bg-paper-pure p-4">
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

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {arenaGameDaySlots(gameDay).map((s) => (
          <li key={`${s.court_id}-${s.start_time}`} className="rounded-full border border-gray-200 bg-paper px-2.5 py-1 text-xs font-semibold text-gray-600">
            <LayoutGrid className="mr-1 inline h-3 w-3 text-gray-400" />
            {s.court_name || 'Quadra'} · {s.start_time}–{s.end_time}
          </li>
        ))}
      </ul>

      {/* Vagas — o número que decide se vale a pena continuar lendo. */}
      <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
        <Users className="h-4 w-4 text-gray-400" />
        {porQuadra
          ? `${vagas.byCourt.reduce((a, c) => a + c.used, 0)} inscrito(s)`
          : (vagas.limit == null
            ? `${vagas.used} inscrito(s) · sem limite de vagas`
            : `${vagas.used} de ${vagas.limit} vagas preenchidas`)}
      </p>

      {/* Escolha da quadra — só quando a inscrição é por quadra, e só para
          quem ainda não entrou. */}
      {porQuadra && !jaEstou && (
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {jaEstou ? (
          <>
            <V2Button asChild size="sm">
              <Link to={`/dia-de-jogo/${gameDay.id}`}>
                Abrir dia de jogo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </V2Button>
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

      {/* O motivo, quando não dá. Dizer "não posso" sem dizer por quê é o que
          faz a pessoa clicar cinco vezes e desistir. */}
      {!jaEstou && !veredito.ok && veredito.message && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-gray-500">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>{veredito.message}</span>
        </p>
      )}
    </li>
  );
}

export default function ArenaGameDaysSection({ arenaId }) {
  const ligado = useFeatureFlag(FEATURE_FLAG.ARENA_GAME_DAY);
  // `null` desliga a consulta: com a flag desligada esta seção não deve custar
  // nem uma leitura na página pública da arena, que é das mais visitadas.
  const { data: dias = [] } = useArenaGameDays(ligado ? arenaId : null);
  const hoje = hojeISO();

  const proximos = useMemo(
    () => dias
      .filter((g) => !g.date || g.date >= hoje)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
    [dias, hoje],
  );

  // Desligada a flag, ou sem dia marcado, a seção não existe — uma seção vazia
  // na página da arena só ocupa espaço e sugere que falta alguma coisa.
  if (!ligado || proximos.length === 0) return null;

  return (
    <V2Surface className="mt-6">
      <div className="mb-3 flex items-start gap-3">
        <CalendarClock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-acid-dark" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Dias de jogo</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Rodadas organizadas pela arena. Marque presença e apareça para jogar.
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {proximos.map((g) => <CartaoDeInscricao key={g.id} gameDay={g} />)}
      </ul>
    </V2Surface>
  );
}
