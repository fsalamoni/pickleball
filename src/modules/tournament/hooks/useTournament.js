import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTournament,
  listMyTournaments,
  listAllTournaments,
  listTournamentAdmins,
  isTournamentAdmin,
  createTournament,
  updateTournament,
  addTournamentAdmin,
  removeTournamentAdmin,
  setTournamentStatus,
  getTournamentByInviteCode,
} from '../services/tournamentService';
import {
  listModalities,
  createModality,
  updateModality,
  deleteModality,
} from '../services/modalityService';
import {
  listRegistrations,
  listRegistrationsByTournament,
  listMyRegistrations,
  createRegistration,
  confirmRegistrationPayment,
  cancelRegistration,
  deleteRegistration,
} from '../services/registrationService';
import {
  listMatches,
  listMatchesByTournament,
  recordMatchResult,
  scheduleMatch,
} from '../services/matchService';
import { runDraw } from '../services/drawService';
import { computeModalityRanking } from '../services/rankingService';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

/* ------------------------------ Tournaments ----------------------------- */

export function useMyTournaments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-tournaments', user?.uid],
    queryFn: () => (user?.uid ? listMyTournaments(user.uid) : Promise.resolve([])),
    enabled: !!user?.uid,
  });
}

export function useTournament(id) {
  return useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournament(id),
    enabled: !!id,
  });
}

export function useTournamentByInvite(code) {
  return useQuery({
    queryKey: ['tournament-by-invite', code],
    queryFn: () => getTournamentByInviteCode(code),
    enabled: !!code,
  });
}

export function useAllTournaments() {
  return useQuery({ queryKey: ['tournaments-all'], queryFn: listAllTournaments });
}

export function useCreateTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createTournament(user, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tournaments'] }),
  });
}

export function useUpdateTournament(id) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates) => updateTournament(id, updates, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament', id] });
      qc.invalidateQueries({ queryKey: ['my-tournaments'] });
    },
  });
}

export function useSetTournamentStatus(id) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status) => setTournamentStatus(id, status, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournament', id] }),
  });
}

/* ------------------------------ Admins ---------------------------------- */

export function useTournamentAdmins(tournamentId) {
  return useQuery({
    queryKey: ['tournament-admins', tournamentId],
    queryFn: () => listTournamentAdmins(tournamentId),
    enabled: !!tournamentId,
  });
}

export function useIsTournamentAdmin(tournamentId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-tournament-admin', tournamentId, user?.uid],
    queryFn: () => isTournamentAdmin(tournamentId, user?.uid),
    enabled: !!tournamentId && !!user?.uid,
  });
}

export function useAddTournamentAdmin(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target) => addTournamentAdmin(tournamentId, target, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournament-admins', tournamentId] }),
  });
}

export function useRemoveTournamentAdmin(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => removeTournamentAdmin(tournamentId, userId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tournament-admins', tournamentId] }),
  });
}

/* ------------------------------ Modalities ------------------------------ */

export function useModalities(tournamentId) {
  return useQuery({
    queryKey: ['modalities', tournamentId],
    queryFn: () => listModalities(tournamentId),
    enabled: !!tournamentId,
  });
}

export function useCreateModality(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createModality(tournamentId, data, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modalities', tournamentId] }),
  });
}

export function useUpdateModality(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) => updateModality(id, updates, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modalities', tournamentId] }),
  });
}

export function useDeleteModality(tournamentId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteModality(id, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modalities', tournamentId] }),
  });
}

/* ------------------------------ Registrations -------------------------- */

export function useRegistrations(modalityId) {
  return useQuery({
    queryKey: ['registrations', modalityId],
    queryFn: () => listRegistrations(modalityId),
    enabled: !!modalityId,
  });
}

export function useRegistrationsByTournament(tournamentId) {
  return useQuery({
    queryKey: ['registrations-tournament', tournamentId],
    queryFn: () => listRegistrationsByTournament(tournamentId),
    enabled: !!tournamentId,
  });
}

export function useMyRegistrations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-registrations', user?.uid],
    queryFn: () => (user?.uid ? listMyRegistrations(user.uid) : Promise.resolve([])),
    enabled: !!user?.uid,
  });
}

export function useCreateRegistration() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createRegistration(input, user),
    onSuccess: (_id, input) => {
      qc.invalidateQueries({ queryKey: ['registrations', input.modality_id] });
      qc.invalidateQueries({ queryKey: ['registrations-tournament', input.tournament_id] });
      qc.invalidateQueries({ queryKey: ['my-registrations'] });
    },
  });
}

export function useConfirmRegistrationPayment(modalityId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => confirmRegistrationPayment(id, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations', modalityId] }),
  });
}

export function useCancelRegistration(modalityId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => cancelRegistration(id, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations', modalityId] }),
  });
}

export function useDeleteRegistration(modalityId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteRegistration(id, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations', modalityId] }),
  });
}

/* ------------------------------ Matches & Draw ------------------------- */

export function useMatches(modalityId, stageIndex = 0) {
  return useQuery({
    queryKey: ['matches', modalityId, stageIndex],
    queryFn: () => listMatches(modalityId, stageIndex),
    enabled: !!modalityId,
  });
}

export function useMatchesByTournament(tournamentId) {
  return useQuery({
    queryKey: ['matches-tournament', tournamentId],
    queryFn: () => listMatchesByTournament(tournamentId),
    enabled: !!tournamentId,
  });
}

export function useRunDraw() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params) => runDraw(params, user),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: ['matches', params.modalityId] });
      qc.invalidateQueries({ queryKey: ['matches-tournament', params.tournamentId] });
      qc.invalidateQueries({ queryKey: ['ranking', params.modalityId] });
    },
  });
}

export function useRecordMatchResult(modalityId, scoringConfig) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, payload }) => recordMatchResult(matchId, payload, scoringConfig, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches', modalityId] });
      qc.invalidateQueries({ queryKey: ['ranking', modalityId] });
    },
  });
}

export function useScheduleMatch(modalityId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, schedule }) => scheduleMatch(matchId, schedule, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches', modalityId] }),
  });
}

/* ------------------------------ Ranking -------------------------------- */

export function useModalityRanking(modalityId, stageIndex) {
  return useQuery({
    queryKey: ['ranking', modalityId, stageIndex ?? 'all'],
    queryFn: () => computeModalityRanking(modalityId, stageIndex),
    enabled: !!modalityId,
  });
}
