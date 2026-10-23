/**
 * SEGURO: TERMO E CERTIFICADO — ganchos do React Query, sob `['federacoes', …]`
 * para `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/insuranceService';
import { fedKeys, useFederationMutation } from './useFederations';

export const insuranceKeys = {
  list: (id) => [...fedKeys.all, 'federacao', id, 'certificados-seguro'],
  org: (kind, orgId) => [...fedKeys.all, 'certificados-seguro-org', kind, orgId],
};

export const useInsuranceCertificates = (id, { enabled = true } = {}) => useQuery({ queryKey: insuranceKeys.list(id), queryFn: () => svc.listInsuranceCertificates(id), enabled: !!id && enabled });
export const useOrgInsuranceCertificates = (kind, orgId, { enabled = true } = {}) => useQuery({ queryKey: insuranceKeys.org(kind, orgId), queryFn: () => svc.listOrgInsuranceCertificates(kind, orgId), enabled: !!kind && !!orgId && enabled });

/** `mutate({ action, ...payload })` numa federação. */
export const useInsuranceAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.insuranceAction(federationId, action, payload));
