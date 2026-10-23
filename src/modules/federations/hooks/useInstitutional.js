/**
 * CERTIDÕES e LEI DE INCENTIVO — ganchos do React Query, sob
 * `['federacoes', …]` para `useFederationMutation` invalidar tudo de uma vez.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/institutionalService';
import { fedKeys, useFederationMutation } from './useFederations';

export const instKeys = {
  certificates: (id) => [...fedKeys.all, 'federacao', id, 'certidoes'],
  projects: (id) => [...fedKeys.all, 'federacao', id, 'lei-incentivo'],
};

export const useCertificates = (id, { enabled = true } = {}) => useQuery({ queryKey: instKeys.certificates(id), queryFn: () => svc.listCertificates(id), enabled: !!id && enabled });
export const useIncentiveProjects = (id, { enabled = true } = {}) => useQuery({ queryKey: instKeys.projects(id), queryFn: () => svc.listIncentiveProjects(id), enabled: !!id && enabled });

/** `mutate({ action, ...payload })` numa federação. */
export const useInstitutionalAction = (federationId) => useFederationMutation(({ action, ...payload }) => svc.institutionalAction(federationId, action, payload));
