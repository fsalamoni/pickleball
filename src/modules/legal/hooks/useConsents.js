/**
 * Hooks de consentimento aos documentos legais (flag legal_center).
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listMyConsents, recordConsent, recordConsents } from '../services/consentService.js';
import { buildConsentMap } from '../domain/consent.js';

/** Consentimentos do usuário + mapa materializado (key → { version }). */
export function useMyConsents() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['legal-consents', user?.uid],
    queryFn: () => listMyConsents(user?.uid),
    enabled: !!user?.uid,
    staleTime: 60_000,
  });
  const consentMap = useMemo(() => buildConsentMap(q.data || []), [q.data]);
  return { ...q, consentMap };
}

export function useAcceptConsent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docMeta) => recordConsent(user, docMeta),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['legal-consents'] }),
  });
}

export function useAcceptConsents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docsMeta) => recordConsents(user, docsMeta),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['legal-consents'] }),
  });
}
