/**
 * Hooks do catálogo padrão de produtos (flag arena_product_catalog).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  listCatalogProducts, proposeCatalogProduct, adoptCatalogToArena, adoptManyCatalogToArena,
  createCatalogProductAdmin, updateCatalogProductSmart, deleteCatalogProductSmart,
  seedCatalog, checkCatalogDuplicates,
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

/** Admin (platform_admin): criar produto novo no catálogo. */
export function useCreateCatalogProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => createCatalogProductAdmin(input, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
}

/** Admin (platform_admin): editar produto do catálogo (semente ou Firestore). */
export function useUpdateCatalogProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ product, updates }) => updateCatalogProductSmart(product, updates, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
}

/** Admin (platform_admin): excluir produto do catálogo (semente ou Firestore). */
export function useDeleteCatalogProduct() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (product) => deleteCatalogProductSmart(product, user),
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
