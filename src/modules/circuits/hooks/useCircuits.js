/**
 * Hooks do módulo Circuitos (Sprint 4 ORG-20).
 * Usa react-query + FirebaseAuthContext.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCircuits, listMyCircuits, getCircuit, createCircuit, updateCircuit,
  addTournamentToCircuit, removeTournamentFromCircuit, listCircuitTournaments,
  recordCircuitResult, recordCircuitResultsBatch, listCircuitResults,
} from '../services/circuitService';
import { computeCircuitRanking } from '../domain/circuit.js';

export function useCircuits(opts = {}) {
  return useQuery({
    queryKey: ['circuits', 'list', opts],
    queryFn: () => listCircuits(opts),
  });
}

export function useMyCircuits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['circuits', 'mine', user?.uid],
    queryFn: () => listMyCircuits(user?.uid),
    enabled: !!user?.uid,
  });
}

export function useCircuit(circuitId) {
  return useQuery({
    queryKey: ['circuits', 'detail', circuitId],
    queryFn: () => getCircuit(circuitId),
    enabled: !!circuitId,
  });
}

export function useCircuitTournaments(circuitId) {
  return useQuery({
    queryKey: ['circuits', 'tournaments', circuitId],
    queryFn: () => listCircuitTournaments(circuitId),
    enabled: !!circuitId,
  });
}

export function useCircuitRanking(circuitId) {
  const { data: circuit } = useCircuit(circuitId);
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['circuits', 'results', circuitId],
    queryFn: () => listCircuitResults(circuitId),
    enabled: !!circuitId,
  });
  const ranking = computeCircuitRanking(results, circuit?.points_table);
  return { data: ranking, isLoading, pointsTable: circuit?.points_table };
}

export function useCreateCircuit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createCircuit(input, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circuits'] }),
  });
}

export function useUpdateCircuit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateCircuit(id, updates, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['circuits'] });
      qc.invalidateQueries({ queryKey: ['circuits', 'detail', vars.id] });
    },
  });
}

export function useAddTournamentToCircuit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ circuitId, tournamentId }) => addTournamentToCircuit(circuitId, tournamentId, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['circuits', 'tournaments', vars.circuitId] });
    },
  });
}

export function useRemoveTournamentFromCircuit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ circuitId, tournamentId }) => removeTournamentFromCircuit(circuitId, tournamentId, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['circuits', 'tournaments', vars.circuitId] });
    },
  });
}

export function useRecordCircuitResults() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ circuitId, tournamentId, results }) =>
      recordCircuitResultsBatch(circuitId, tournamentId, results, user),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['circuits', 'results', vars.circuitId] });
      qc.invalidateQueries({ queryKey: ['circuits', 'ranking', vars.circuitId] });
    },
  });
}
