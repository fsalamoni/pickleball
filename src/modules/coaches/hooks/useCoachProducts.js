/**
 * Hooks da loja do professor — flag coach_lessons.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCoachProducts, listPublicCoachProducts,
  createCoachProduct, updateCoachProduct, deleteCoachProduct,
} from '../services/coachProductService';

/**
 * Produtos do professor. `full` (dono/admin) lê tudo; caso contrário lê só os
 * públicos (seguro para visitantes, evita rejeição da query pelas regras).
 */
export function useCoachProducts(coachId, { full = false } = {}) {
  return useQuery({
    queryKey: ['coach-products', coachId, full ? 'full' : 'public'],
    queryFn: () => (full ? listCoachProducts(coachId) : listPublicCoachProducts(coachId)),
    enabled: !!coachId,
  });
}

function invalidate(qc, coachId) {
  qc.invalidateQueries({ queryKey: ['coach-products', coachId] });
}

export function useCreateCoachProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => createCoachProduct(coachId, input, user),
    onSuccess: (_, vars) => invalidate(qc, vars.coachId),
  });
}

export function useUpdateCoachProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ product, input }) => updateCoachProduct(product, input, user),
    onSuccess: (_, vars) => invalidate(qc, vars.product?.coach_id),
  });
}

export function useDeleteCoachProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ product }) => deleteCoachProduct(product, user),
    onSuccess: (_, vars) => invalidate(qc, vars.product?.coach_id),
  });
}
