import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  createClub,
  getClub,
  listClubs,
  listMyClubs,
  updateClub,
  deleteClub,
  regenerateInviteCode,
  listClubMembers,
  getMembership,
  joinClubByCode,
  leaveClub,
  setMemberRole,
  removeMember,
  listClubEvents,
  createClubEvent,
  updateClubEvent,
  deleteClubEvent,
  listEventRsvps,
  setEventRsvp,
  listClubPosts,
  createClubPost,
  deleteClubPost,
} from '../services/clubService';

/* --------------------------------- Clubs -------------------------------- */

export function useClubs() {
  return useQuery({ queryKey: ['clubs'], queryFn: listClubs });
}

export function useMyClubs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-clubs', user?.uid],
    queryFn: () => (user?.uid ? listMyClubs(user.uid) : Promise.resolve([])),
    enabled: !!user?.uid,
  });
}

export function useClub(id) {
  return useQuery({ queryKey: ['club', id], queryFn: () => getClub(id), enabled: !!id });
}

export function useMyMembership(clubId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-membership', clubId, user?.uid],
    queryFn: () => getMembership(clubId, user?.uid),
    enabled: !!clubId && !!user?.uid,
  });
}

export function useCreateClub() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createClub(user, userProfile, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] });
      qc.invalidateQueries({ queryKey: ['my-clubs'] });
    },
  });
}

export function useUpdateClub(id) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates) => updateClub(id, updates, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club', id] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
      qc.invalidateQueries({ queryKey: ['my-clubs'] });
    },
  });
}

export function useRegenerateInviteCode(id) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateInviteCode(id, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club', id] }),
  });
}

export function useDeleteClub(id) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteClub(id, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] });
      qc.invalidateQueries({ queryKey: ['my-clubs'] });
    },
  });
}

/* -------------------------------- Members ------------------------------- */

export function useClubMembers(clubId) {
  return useQuery({
    queryKey: ['club-members', clubId],
    queryFn: () => listClubMembers(clubId),
    enabled: !!clubId,
  });
}

export function useJoinClub() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code) => joinClubByCode(code, user, userProfile),
    onSuccess: (club) => {
      qc.invalidateQueries({ queryKey: ['my-clubs'] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
      if (club?.id) {
        qc.invalidateQueries({ queryKey: ['club-members', club.id] });
        qc.invalidateQueries({ queryKey: ['club-membership', club.id] });
      }
    },
  });
}

export function useLeaveClub(clubId) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => leaveClub(clubId, user, userProfile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-clubs'] });
      qc.invalidateQueries({ queryKey: ['club-members', clubId] });
      qc.invalidateQueries({ queryKey: ['club-membership', clubId] });
    },
  });
}

export function useSetMemberRole(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ member, role }) => setMemberRole(clubId, member, role, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-members', clubId] }),
  });
}

export function useRemoveMember(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member) => removeMember(clubId, member, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-members', clubId] }),
  });
}

/* -------------------------------- Events -------------------------------- */

export function useClubEvents(clubId) {
  return useQuery({
    queryKey: ['club-events', clubId],
    queryFn: () => listClubEvents(clubId),
    enabled: !!clubId,
  });
}

export function useCreateClubEvent(clubId) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createClubEvent(clubId, { ...data, created_by_name: userProfile?.platform_name }, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-events', clubId] }),
  });
}

export function useUpdateClubEvent(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, updates }) => updateClubEvent(eventId, updates, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-events', clubId] }),
  });
}

export function useDeleteClubEvent(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId) => deleteClubEvent(eventId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-events', clubId] }),
  });
}

export function useEventRsvps(eventId) {
  return useQuery({
    queryKey: ['club-event-rsvps', eventId],
    queryFn: () => listEventRsvps(eventId),
    enabled: !!eventId,
  });
}

export function useSetEventRsvp(eventId) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ event, status }) => setEventRsvp(event, status, user, userProfile),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-event-rsvps', eventId] }),
  });
}

/* --------------------------------- Posts -------------------------------- */

export function useClubPosts(clubId) {
  return useQuery({
    queryKey: ['club-posts', clubId],
    queryFn: () => listClubPosts(clubId),
    enabled: !!clubId,
  });
}

export function useCreateClubPost(clubId) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createClubPost(clubId, input, user, userProfile),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-posts', clubId] }),
  });
}

export function useDeleteClubPost(clubId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId) => deleteClubPost(postId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-posts', clubId] }),
  });
}
