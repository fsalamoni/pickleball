import { useQuery } from '@tanstack/react-query';
import { listAthletes, listAllAthleteProfiles, getAthlete } from '../services/athleteService';

export function useAthletes() {
  return useQuery({ queryKey: ['athletes'], queryFn: listAthletes });
}

/** Todos os perfis da plataforma (para o admin escolher quem convidar). */
export function useAllAthletes() {
  return useQuery({ queryKey: ['athletes-all'], queryFn: listAllAthleteProfiles });
}

export function useAthlete(uid) {
  return useQuery({
    queryKey: ['athlete', uid],
    queryFn: () => getAthlete(uid),
    enabled: !!uid,
  });
}
