/**
 * A agenda da tela inicial — a leitura (hook).
 *
 * Junta as fontes que a plataforma já consulta em outras telas (mesmas chaves
 * de cache: abrir "Minhas reservas" depois da tela inicial não busca de novo)
 * e as traduz pela régua de `homeAgenda.js`.
 *
 * Cada fonte só consulta quando faz sentido para a pessoa: o jogo de torneio
 * só com torneio que vale (a busca lê os jogos de cada modalidade), as aulas
 * do professor só para quem é professor, o jogo aberto e a aula de arena só
 * com a chave dos módulos de arena, os eventos só para quem tem clube.
 *
 * ⚠️ Falha não é agenda vazia: `completa` só é verdadeiro com TODAS as fontes
 * ligadas carregadas sem erro. A tela não diz "agenda livre" sem isso, e diz
 * QUAL parte não carregou.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyGameDays } from '@/modules/games/hooks/useGameDays';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import { useStudentLessons, useCoachLessons } from '@/modules/coaches/hooks/useLessons';
import { useMyClassEnrollments, useMyOpenSlots } from '@/modules/arenas/hooks/useArenaV3';
import { useAvailableEvents } from '@/modules/clubs/hooks/useClubs';
import { getMyUpcomingMatches } from '@/modules/tournament/services/upcomingService';
import { enrollmentRows } from '@/modules/arenas/domain/classAgenda';
import {
  agendaFromArenaEnrollments, agendaFromBookings, agendaFromClubEvents, agendaFromGameDays,
  agendaFromLessons, agendaFromOpenSlots, agendaFromTournamentMatches, mergeAgenda,
} from '../domain/homeAgenda.js';
import { hojeLocal } from '../domain/freshness.js';

const porId = (lista = []) => new Map((lista || []).map((x) => [x.id, x]));

/**
 * @param {{
 *   agora: number,
 *   ehProfessor?: boolean,
 *   competindo?: boolean,
 *   arenaModulesOn?: boolean,
 *   comClubes?: boolean,
 * }} opts
 */
export function useHomeAgenda({
  agora, ehProfessor = false, competindo = false, arenaModulesOn = false, comClubes = false,
} = {}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const diasDeJogo = useMyGameDays();
  const reservas = useMyBookings();
  const aulasAluno = useStudentLessons(uid);
  const aulasProfessor = useCoachLessons(ehProfessor ? uid : null);
  const jogosTorneio = useQuery({
    // Mesma chave da tela inicial de sempre: o cache é compartilhado.
    queryKey: ['dashboard-upcoming', uid],
    queryFn: () => getMyUpcomingMatches(uid, { limit: 4 }),
    enabled: !!uid && competindo,
    staleTime: 30_000,
  });
  const matriculas = useMyClassEnrollments({ enabled: arenaModulesOn });
  const vagas = useMyOpenSlots({ enabled: arenaModulesOn });
  const eventos = useAvailableEvents({ enabled: comClubes });

  const fontes = useMemo(() => [
    { id: 'dias', label: 'dias de jogo', q: diasDeJogo, ligada: !!uid },
    { id: 'reservas', label: 'reservas', q: reservas, ligada: !!uid },
    { id: 'aulas', label: 'aulas', q: aulasAluno, ligada: !!uid },
    { id: 'aulas-professor', label: 'aulas que você dá', q: aulasProfessor, ligada: !!uid && ehProfessor },
    { id: 'torneios', label: 'jogos de torneio', q: jogosTorneio, ligada: !!uid && competindo },
    { id: 'aulas-arena', label: 'aulas nas arenas', q: matriculas, ligada: !!uid && arenaModulesOn },
    { id: 'jogos-abertos', label: 'jogos abertos', q: vagas, ligada: !!uid && arenaModulesOn },
    { id: 'clubes', label: 'eventos dos clubes', q: eventos, ligada: !!uid && comClubes },
  ], [uid, ehProfessor, competindo, arenaModulesOn, comClubes,
    diasDeJogo, reservas, aulasAluno, aulasProfessor, jogosTorneio, matriculas, vagas, eventos]);

  const itens = useMemo(() => {
    const ctx = { agora };
    const hoje = hojeLocal(new Date(agora));
    const dias = agendaFromGameDays(diasDeJogo.data || [], ctx);
    const idsDias = new Set(dias.map((d) => d.gameDayId));
    const mat = matriculas.data;
    return mergeAgenda([
      agendaFromTournamentMatches(competindo ? jogosTorneio.data || [] : [], ctx),
      dias,
      agendaFromBookings(reservas.data || [], ctx),
      agendaFromLessons(aulasAluno.data || [], { ...ctx, papel: 'aluno' }),
      agendaFromLessons(ehProfessor ? aulasProfessor.data || [] : [], { ...ctx, papel: 'professor' }),
      agendaFromArenaEnrollments(
        arenaModulesOn && mat ? enrollmentRows(mat.bookings || [], porId(mat.aulas), porId(mat.arenas), hoje) : [],
        ctx,
      ),
      agendaFromOpenSlots(arenaModulesOn ? vagas.data || [] : [], { ...ctx, gameDayIds: idsDias }),
      agendaFromClubEvents(comClubes ? eventos.data || [] : [], ctx),
    ]);
  }, [agora, competindo, ehProfessor, arenaModulesOn, comClubes,
    diasDeJogo.data, reservas.data, aulasAluno.data, aulasProfessor.data, jogosTorneio.data,
    matriculas.data, vagas.data, eventos.data]);

  // Sinais de ATIVIDADE para as frentes da tela (resolveHomeFoci). Memorizado:
  // um objeto novo a cada render refaria as frentes, os atalhos e as seções.
  const sinais = useMemo(() => ({
    temDiasDeJogo: itens.some((i) => i.kind === 'dia_de_jogo'),
    temReservas: itens.some((i) => i.kind === 'reserva'),
    temAulas: itens.some((i) => i.kind === 'aula' || i.kind === 'aula_arena'),
  }), [itens]);

  const ligadas = fontes.filter((f) => f.ligada);
  const carregando = ligadas.some((f) => f.q.isLoading);
  const falhas = ligadas.filter((f) => f.q.isError);
  const completa = !carregando && falhas.length === 0;

  return {
    itens,
    carregando,
    completa,
    falhas: falhas.map((f) => f.label),
    recarregar: () => falhas.forEach((f) => f.q.refetch?.()),
    sinais,
  };
}
