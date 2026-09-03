/**
 * useUserSocialBonds — hooks pra rivais, crews, mentorias.
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  listRivalsFor,
  listCrewsForMember,
  listCrews,
  createCrew,
  joinCrew,
  leaveCrew,
  listMentorshipsFor,
  startMentorship,
  recordMentorLesson,
  endMentorship,
} from '@/modules/progression/services/socialBondService';

const RIVALS_KEY = (uid) => ['user-rivals', uid];
const CREWS_KEY = (uid) => ['user-crews', uid];
const PUBLIC_CREWS_KEY = () => ['public-crews'];
const MENTORSHIPS_KEY = (uid) => ['user-mentorships', uid];

// ===== RIVALS =====
export function useUserRivals(uid, enabled = true) {
  return useQuery({
    queryKey: RIVALS_KEY(uid),
    queryFn: async () => listRivalsFor(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
}

// ===== CREWS =====
export function useUserCrews(uid, enabled = true) {
  return useQuery({
    queryKey: CREWS_KEY(uid),
    queryFn: async () => listCrewsForMember(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
}

export function usePublicCrews(enabled = true) {
  return useQuery({
    queryKey: PUBLIC_CREWS_KEY(),
    queryFn: async () => listCrews({ isPublic: true }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCrewActions() {
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: async ({ createdBy, name, description, region }) => {
      const res = await createCrew({ createdBy, name, description, region });
      qc.invalidateQueries({ queryKey: ['user-crews', createdBy] });
      qc.invalidateQueries({ queryKey: PUBLIC_CREWS_KEY() });
      return res;
    },
  });
  const joinMut = useMutation({
    mutationFn: async ({ crewId, uid }) => {
      const res = await joinCrew({ crewId, uid });
      qc.invalidateQueries({ queryKey: ['user-crews', uid] });
      qc.invalidateQueries({ queryKey: PUBLIC_CREWS_KEY() });
      return res;
    },
  });
  const leaveMut = useMutation({
    mutationFn: async ({ crewId, uid }) => {
      await leaveCrew({ crewId, uid });
      qc.invalidateQueries({ queryKey: ['user-crews', uid] });
    },
  });
  return {
    create: createMut.mutate,
    join: joinMut.mutate,
    leave: leaveMut.mutate,
    isCreating: createMut.isPending,
    isJoining: joinMut.isPending,
    isLeaving: leaveMut.isPending,
  };
}

// ===== MENTORSHIPS =====
export function useUserMentorships(uid, enabled = true) {
  return useQuery({
    queryKey: MENTORSHIPS_KEY(uid),
    queryFn: async () => listMentorshipsFor(uid),
    enabled: !!uid && enabled,
    staleTime: 60_000,
  });
}

export function useMentorshipActions() {
  const qc = useQueryClient();
  const startMut = useMutation({
    mutationFn: async ({ mentorUid, apprenticeUid }) => {
      const res = await startMentorship({ mentorUid, apprenticeUid });
      qc.invalidateQueries({ queryKey: ['user-mentorships', mentorUid] });
      qc.invalidateQueries({ queryKey: ['user-mentorships', apprenticeUid] });
      return res;
    },
  });
  const recordMut = useMutation({
    mutationFn: async ({ pairKey }) => {
      const res = await recordMentorLesson(pairKey);
      qc.invalidateQueries({ queryKey: ['user-mentorships'] });
      return res;
    },
  });
  const endMut = useMutation({
    mutationFn: async ({ pairKey, status }) => {
      const res = await endMentorship(pairKey, status);
      qc.invalidateQueries({ queryKey: ['user-mentorships'] });
      return res;
    },
  });
  return {
    start: startMut.mutate,
    recordLesson: recordMut.mutate,
    end: endMut.mutate,
    isStarting: startMut.isPending,
    isRecording: recordMut.isPending,
    isEnding: endMut.isPending,
  };
}
