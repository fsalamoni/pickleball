/**
 * Itens de treino: biblioteca, os meus, os dos meus professores, os
 * compartilhados comigo, um item, e criar/editar/excluir.
 * Falha ≠ vazio: cada consulta devolve `isError` e quem mostra decide.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createItem, deleteItem, getItem, listCoachItems, listMyItems, listPublicItems, listSharedWithMe, updateItem,
} from '../services/trainingItemService';
import { trainingKeys } from './trainingKeys';

export function usePublicTrainingItems({ enabled = true } = {}) {
  return useQuery({ queryKey: trainingKeys.publicItems, queryFn: listPublicItems, enabled, staleTime: 60_000 });
}

export function useMyTrainingItems(uid) {
  return useQuery({ queryKey: trainingKeys.myItems(uid), queryFn: () => listMyItems(uid), enabled: !!uid });
}

/** `data` = `{ items, incompleto }`. */
export function useCoachTrainingItems(coachIds = []) {
  return useQuery({
    queryKey: trainingKeys.coachItems(coachIds),
    queryFn: () => listCoachItems(coachIds),
    enabled: coachIds.length > 0,
  });
}

export function useSharedTrainingItems(uid) {
  return useQuery({ queryKey: trainingKeys.sharedItems(uid), queryFn: () => listSharedWithMe(uid), enabled: !!uid });
}

/** `data` = `{ item, reason }` (`reason: 'indisponivel'` quando não existe ou não é para você). */
export function useTrainingItem(id) {
  return useQuery({ queryKey: trainingKeys.item(id), queryFn: () => getItem(id), enabled: !!id });
}

/**
 * Tudo o que esta pessoa pode ver, num mapa por id — para montar treinos,
 * planos e o "Hoje". `incompleto` diz que alguma fonte falhou.
 */
export function useVisibleTrainingItems(identity) {
  const pub = usePublicTrainingItems();
  const mine = useMyTrainingItems(identity.uid);
  const coach = useCoachTrainingItems(identity.activeCoachIds);
  const shared = useSharedTrainingItems(identity.uid);
  return useMemo(() => {
    const fontes = [pub, mine, shared, ...(identity.activeCoachIds.length ? [coach] : [])];
    const byId = new Map();
    for (const it of [...(pub.data || []), ...(coach.data?.items || []), ...(shared.data || []), ...(mine.data || [])]) {
      byId.set(it.id, it);
    }
    return {
      items: [...byId.values()],
      byId: Object.fromEntries(byId),
      isLoading: fontes.some((f) => f.isLoading),
      isError: fontes.some((f) => f.isError),
      incompleto: fontes.some((f) => f.isError) || !!coach.data?.incompleto,
      refetch: () => fontes.forEach((f) => f.refetch()),
      sources: { pub, mine, coach, shared },
    };
  }, [pub, mine, coach, shared, identity.activeCoachIds.length]);
}

function useInvalidateItems() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: trainingKeys.items });
}

/** `mutate({ input, source?, aiAssisted?, asPlatform?, featured? })` → id. */
export function useCreateTrainingItem(identity, settings) {
  const inv = useInvalidateItems();
  return useMutation({
    mutationFn: ({ input, ...opts }) => createItem(input, { identity, settings, ...opts }),
    onSuccess: inv,
  });
}

/** `mutate({ item, input })` → `{ review }`. */
export function useUpdateTrainingItem(identity, settings) {
  const inv = useInvalidateItems();
  return useMutation({
    mutationFn: ({ item, input }) => updateItem(item, input, { identity, settings }),
    onSuccess: inv,
  });
}

/** `mutate(item)`. */
export function useDeleteTrainingItem(identity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item) => deleteItem(item, { identity }),
    onSuccess: (_, item) => {
      qc.invalidateQueries({ queryKey: trainingKeys.items });
      qc.invalidateQueries({ queryKey: trainingKeys.shares });
      // Item da biblioteca inicial: o `seed_removed` mudou (a prévia da instalação também).
      if (item?.seed_slug) {
        qc.invalidateQueries({ queryKey: trainingKeys.settings });
        qc.invalidateQueries({ queryKey: trainingKeys.seedPlan });
      }
    },
  });
}
