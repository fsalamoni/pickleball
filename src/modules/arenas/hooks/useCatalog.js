/**
 * Hooks do catálogo padrão de produtos (flag arena_product_catalog).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCatalogProducts, proposeCatalogProduct, adoptCatalogToArena, adoptManyCatalogToArena,
  updateCatalogProduct, deleteCatalogProduct, seedCatalog, checkCatalogDuplicates,
} from '../services/catalogService.js';

const CATALOG_KEY = ['catalog-products'];

/** Catálogo completo (compartilhado). staleTime longo — muda pouco. */
export function useCatalogProducts({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: [...CATALOG_KEY, { includeInactive }],
    queryFn: () => listCatalogProducts({ includeInactive }),
    staleTime: 5 * 60 * 1000,
  });
}

/** Contribui um produto novo ao catálogo (com verificação de duplicidade). */
export function useProposeCatalogProduct(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, existing, force }) =>
      proposeCatalogProduct(input, user, { arenaId, existing, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
}

/** Puxa um produto do catálogo para o mercado da arena. */
export function useAdoptCatalogProduct(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ catalogProduct, arenaFields }) =>
      adoptCatalogToArena(arenaId, catalogProduct, arenaFields, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-products', arenaId] });
      qc.invalidateQueries({ queryKey: ['inventory-entries', arenaId] });
    },
  });
}

/** Adiciona vários produtos do catálogo ao mercado da arena de uma vez. */
export function useAdoptManyCatalogProducts(arenaId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (catalogProducts) => adoptManyCatalogToArena(arenaId, catalogProducts, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-products', arenaId] });
    },
  });
}

/** Moderação (platform_admin): atualizar produto do catálogo. */
export function useUpdateCatalogProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, updates }) => updateCatalogProduct(productId, updates, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
}

/** Moderação (platform_admin): remover produto do catálogo. */
export function useDeleteCatalogProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId) => deleteCatalogProduct(productId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
}

/** Popular catálogo com a semente padrão (platform_admin). */
export function useSeedCatalog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => seedCatalog(user),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
}

export { checkCatalogDuplicates };
