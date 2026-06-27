import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { createLink, updateLink, deleteLink, listAllLinks } from '../services/affiliateService.js';

/** Todos os links de afiliado/parceiro (filtro de ativos é feito na UI). */
export function useAffiliateLinks() {
  return useQuery({ queryKey: ['affiliate-links'], queryFn: listAllLinks, staleTime: 60_000 });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['affiliate-links'] });
}

export function useCreateAffiliateLink() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input) => createLink(input, user), onSuccess: invalidate });
}

export function useUpdateAffiliateLink() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, input }) => updateLink(id, input, user), onSuccess: invalidate });
}

export function useDeleteAffiliateLink() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id) => deleteLink(id, user), onSuccess: invalidate });
}
