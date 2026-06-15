import { useQuery } from '@tanstack/react-query';
import { listAthletes, getAthlete } from '../services/athleteService';

export function useAthletes() {
  return useQuery({ queryKey: ['athletes'], queryFn: listAthletes });
}

export function useAthlete(uid) {
  return useQuery({
    queryKey: ['athlete', uid],
    queryFn: () => getAthlete(uid),
    enabled: !!uid,
  });
}
