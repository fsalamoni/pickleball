import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMeta, saveMeta, setFavorite, setMastery } from '../services/metaService';
import { trainingKeys } from './trainingKeys';

/** `data` = documento de `training_meta` ou `null` (nada salvo ainda — não é falha). */
export function useTrainingMeta(uid) {
  return useQuery({ queryKey: trainingKeys.meta(uid), queryFn: () => getMeta(uid), enabled: !!uid });
}

export function useMetaActions(uid) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: trainingKeys.meta(uid) });
  return {
    save: useMutation({ mutationFn: (patch) => saveMeta(uid, patch), onSuccess: inv }),
    favorite: useMutation({ mutationFn: ({ itemId, on }) => setFavorite(uid, itemId, on), onSuccess: inv }),
    mastery: useMutation({ mutationFn: ({ itemId, level }) => setMastery(uid, itemId, level), onSuccess: inv }),
  };
}
