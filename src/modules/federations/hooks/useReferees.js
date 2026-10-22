/**
 * ARBITRAGEM — ganchos do React Query. As chaves moram sob `['federacoes', …]`
 * para a mutação geral (`useFederationMutation`) invalidar tudo de uma vez.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import * as svc from '../services/refereesService';
import { listMyAssignments, listMyRefereeRosters } from '../services/federationService';
import { fedModuleOn } from '../domain/federation.js';
import { scalableEvents } from '../domain/referees.js';
import { useFederationEvents, useFederationTournaments } from './useFederations';

export const refKeys = {
  roster: (fedId) => ['federacoes', 'federacao', fedId, 'arbitragem', 'quadro'],
  assignments: (fedId) => ['federacoes', 'federacao', fedId, 'arbitragem', 'escalas'],
  notes: (fedId, uid) => ['federacoes', 'federacao', fedId, 'arbitragem', 'notas', uid],
  publico: (fedId, tournamentId) => ['federacoes', 'federacao', fedId, 'arbitragem', 'publico', tournamentId || 'tudo'],
  myRosters: (uid) => ['federacoes', 'arbitragem', 'meus-quadros', uid],
  myAssignments: (uid) => ['federacoes', 'arbitragem', 'minhas-escalas', uid],
};

export function useFederationReferees(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: refKeys.roster(fedId), queryFn: () => svc.listFederationReferees(fedId), enabled: !!fedId && enabled });
}

export function useFederationAssignments(fedId, { enabled = true } = {}) {
  return useQuery({ queryKey: refKeys.assignments(fedId), queryFn: () => svc.listFederationAssignments(fedId), enabled: !!fedId && enabled });
}

export function useRefereeNotes(fedId, uid, { enabled = true } = {}) {
  return useQuery({ queryKey: refKeys.notes(fedId, uid), queryFn: () => svc.getRefereeNotes(fedId, uid), enabled: !!fedId && !!uid && enabled });
}

/** O quadro público e quem apita — ou só o de um torneio. */
export function useRefereesPublic(fedId, { tournamentId, enabled = true } = {}) {
  return useQuery({ queryKey: refKeys.publico(fedId, tournamentId), queryFn: () => svc.refereesPublic({ federationId: fedId, ...(tournamentId ? { tournamentId } : {}) }), enabled: !!fedId && enabled, staleTime: 5 * 60_000, retry: 1 });
}

export function useMyRefereeRosters({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: refKeys.myRosters(user?.uid), queryFn: () => listMyRefereeRosters(user?.uid), enabled: !!user?.uid && enabled });
}

export function useMyAssignments({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: refKeys.myAssignments(user?.uid), queryFn: () => listMyAssignments(user?.uid), enabled: !!user?.uid && enabled });
}

/**
 * Os eventos que a equipe pode escalar: torneios chancelados por esta
 * federação e os eventos esportivos da agenda (todas as visibilidades — a
 * equipe lê). Cada fonte falha sozinha: `incompleto` diz que algo ficou de
 * fora; `events` é `undefined` enquanto nenhuma fonte respondeu.
 */
export function useScalableEvents(federation, { enabled = true } = {}) {
  const fedId = federation?.id;
  const agenda = enabled && fedModuleOn(federation, 'calendar');
  const tq = useFederationTournaments(fedId, { enabled });
  const pub = useFederationEvents(fedId, 'public', { enabled: agenda });
  const mem = useFederationEvents(fedId, 'members', { enabled: agenda });
  const eqp = useFederationEvents(fedId, 'staff', { enabled: agenda });
  return useMemo(() => {
    const fontes = agenda ? [tq, pub, mem, eqp] : [tq];
    const prontas = fontes.filter((q) => q.isSuccess);
    const events = prontas.length
      ? scalableEvents({ fedId, tournaments: tq.data || [], events: agenda ? [...(pub.data || []), ...(mem.data || []), ...(eqp.data || [])] : [] })
      : undefined;
    return {
      events,
      isLoading: !prontas.length && fontes.some((q) => q.isLoading),
      isError: !prontas.length && fontes.some((q) => q.isError),
      incompleto: prontas.length > 0 && fontes.some((q) => q.isError),
      refetch: () => fontes.forEach((q) => q.refetch()),
    };
  }, [agenda, fedId, tq, pub, mem, eqp]);
}
