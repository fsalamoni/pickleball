/**
 * Os dados da linha do tempo pessoal de um torneio (docs/55): categorias,
 * inscrições e jogos do torneio inteiro — três consultas de leitura pública,
 * as mesmas chaves de cache que o resto da página já usa (os jogos se
 * atualizam sozinhos a cada 20 s). Nada é gravado.
 *
 * Falha não é vazio (docs/27): `isError` vale se QUALQUER das três falhar —
 * sem os jogos não dá para dizer "você não tem jogos", sem as inscrições não
 * dá para dizer quem está no torneio.
 */
import { useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useModalities, useRegistrationsByTournament, useMatchesByTournament } from './useTournament';
import { tournamentPeople } from '../domain/personalTimeline';

export function useTournamentTimelineData(tournamentId) {
  const mods = useModalities(tournamentId);
  const regs = useRegistrationsByTournament(tournamentId);
  const jogos = useMatchesByTournament(tournamentId);
  const modalities = mods.data;
  const registrations = regs.data;
  const people = useMemo(
    () => (registrations ? tournamentPeople(registrations, modalities || []) : []),
    [registrations, modalities],
  );
  return {
    modalities: modalities || [],
    registrations: registrations || [],
    matches: jogos.data || [],
    people,
    isLoading: mods.isLoading || regs.isLoading || jogos.isLoading,
    isError: mods.isError || regs.isError || jogos.isError,
    // Inscrições carregadas: basta para saber quem está no torneio.
    peopleReady: regs.isSuccess && mods.isSuccess,
    refetch: () => { mods.refetch(); regs.refetch(); jogos.refetch(); },
  };
}

/** "Eu" no torneio: a pessoa da lista com a minha conta (ou `null`). */
export function useMeInTournament(tournamentId) {
  const { user } = useAuth();
  const data = useTournamentTimelineData(tournamentId);
  const eu = useMemo(
    () => (user?.uid ? data.people.find((p) => p.user_id === user.uid) || null : null),
    [data.people, user?.uid],
  );
  return { ...data, eu };
}
