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

import React, { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { V2Surface } from '@/v2/ui/primitives';
import { useArenaGameDays } from '@/modules/games/hooks/useArenaGameDays';
import { isOpenMatchGameDay } from '@/modules/arenas/domain/openMatchGameDay';
import { gameDayEndsAt } from '@/modules/games/domain/playDiscovery';
import ArenaGameDaySignupCard from './ArenaGameDaySignupCard';

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ArenaGameDaysSection({ arenaId }) {
  const ligado = useFeatureFlag(FEATURE_FLAG.ARENA_GAME_DAY);
  // `null` desliga a consulta: com a flag desligada esta seção não deve custar
  // nem uma leitura na página pública da arena, que é das mais visitadas.
  const { data: dias = [] } = useArenaGameDays(ligado ? arenaId : null);
  const hoje = hojeISO();

  const proximos = useMemo(
    () => dias
      // O dia de jogo que nasceu de um JOGO ABERTO aparece em "Jogos abertos"
      // (com a faixa de nível, o valor e a fila). Mostrá-lo aqui também seria
      // oferecer o mesmo jogo duas vezes, com dois botões diferentes (Onda CA).
      .filter((g) => !isOpenMatchGameDay(g))
      .filter((g) => !g.date || g.date >= hoje)
      // Hoje, mas já terminou: não se oferece presença num jogo que acabou.
      .filter((g) => !g.date || g.date > hoje || !(gameDayEndsAt(g) <= Date.now()))
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
        {proximos.map((g) => <ArenaGameDaySignupCard key={g.id} gameDay={g} />)}
      </ul>
    </V2Surface>
  );
}
