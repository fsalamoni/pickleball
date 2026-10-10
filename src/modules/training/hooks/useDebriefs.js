/**
 * Balanço do jogo: o que está ligado, os balanços da pessoa, os jogos
 * recentes e o que ainda pede balanço. Tudo só consulta com a flag ligada E a
 * pessoa tendo ligado para si — desligado, nenhum destes hooks lê o banco
 * (fora o `training_meta`, que já é lido pelo treino).
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { debriefEnabledFor, debriefSince, pendingDebriefs } from '../domain/debrief.js';
import {
  deleteDebrief, listMyDebriefs, markDebriefApplied, saveDebrief, setDebriefEnabled, skipDebrief,
} from '../services/debriefService';
import { listRecentPlay } from '../services/recentPlayService';
import { trainingKeys } from './trainingKeys';
import { useTrainingMeta } from './useTrainingMeta';

/** A funcionalidade existe na plataforma (as duas flags). */
export function useGameDebriefAvailable() {
  const treino = useFeatureFlag(FEATURE_FLAG.TRAINING_CENTER);
  const balanco = useFeatureFlag(FEATURE_FLAG.GAME_DEBRIEF);
  return treino && balanco;
}

/** A plataforma oferece E a pessoa ligou. */
export function useDebriefSettings() {
  const { user } = useAuth();
  const uid = user?.uid;
  const available = useGameDebriefAvailable();
  const meta = useTrainingMeta(available ? uid : null);
  return {
    uid,
    available,
    enabled: available && debriefEnabledFor(meta.data),
    since: debriefSince(meta.data),
    isLoading: available && meta.isLoading,
    isError: available && meta.isError,
    refetch: meta.refetch,
  };
}

export function useMyDebriefs(uid, { enabled = true } = {}) {
  return useQuery({
    queryKey: trainingKeys.debriefs(uid),
    queryFn: () => listMyDebriefs(uid),
    enabled: !!uid && enabled,
  });
}

export function useRecentPlay(uid, { enabled = true } = {}) {
  return useQuery({
    queryKey: trainingKeys.recentPlay(uid),
    queryFn: () => listRecentPlay(uid),
    enabled: !!uid && enabled,
    staleTime: 10 * 60_000,
  });
}

/**
 * Os jogos que pedem balanço. `isError` só quando não deu para saber —
 * nesse caso quem mostra não afirma "nada pendente".
 */
export function usePendingDebriefs() {
  const s = useDebriefSettings();
  const on = s.enabled;
  const debriefs = useMyDebriefs(s.uid, { enabled: on });
  const recent = useRecentPlay(s.uid, { enabled: on });
  // O jogo só vira pendência depois de terminar: reavalia a cada minuto, senão
  // quem deixou o app aberto só o veria ao recarregar.
  const [minuto, setMinuto] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => setMinuto((m) => m + 1), 60000);
    return () => clearInterval(t);
  }, [on]);
  const pending = useMemo(
    () => (on && debriefs.data && recent.data
      ? pendingDebriefs({ events: recent.data.events, debriefs: debriefs.data, since: s.since })
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `minuto` só força a reavaliação do relógio
    [on, debriefs.data, recent.data, s.since, minuto],
  );
  return {
    on,
    pending,
    debriefs: debriefs.data || [],
    incompleto: recent.data?.incompleto || [],
    isLoading: on && (debriefs.isLoading || recent.isLoading),
    isError: on && (debriefs.isError || recent.isError),
    isSuccess: on && debriefs.isSuccess && recent.isSuccess,
    refetch: () => { debriefs.refetch(); recent.refetch(); },
  };
}

export function useDebriefActions(uid) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: trainingKeys.debriefs(uid) });
  return {
    save: useMutation({ mutationFn: ({ input, suggestion }) => saveDebrief(uid, input, { suggestion }), onSuccess: inv }),
    skip: useMutation({ mutationFn: (source) => skipDebrief(uid, source), onSuccess: inv }),
    applied: useMutation({ mutationFn: ({ id, ...rest }) => markDebriefApplied(id, rest), onSuccess: inv }),
    remove: useMutation({ mutationFn: deleteDebrief, onSuccess: inv }),
    setEnabled: useMutation({
      mutationFn: (on) => setDebriefEnabled(uid, on),
      onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.meta(uid) }),
    }),
  };
}
