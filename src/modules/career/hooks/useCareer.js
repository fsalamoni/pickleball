/**
 * Minha carreira — os hooks (React Query). Só a aba aberta consulta: cada
 * hook recebe `enabled`, e a linha do tempo junta as fontes sem esperar que
 * todas deem certo — a que falhou chega `undefined` e a tela diz o quê.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useOnline } from '@/core/lib/useOnline';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { useTrophies } from '@/modules/trophies/hooks/useTrophies';
import { usePublishedGameDayGames } from '@/modules/games/hooks/usePublishedGameDayGames';
import { listMyFederationPoints } from '@/modules/federations/services/federationService';
import { buildCareerTimeline } from '../domain/timeline.js';
import { newCareerEventId, normalizeCareerEvent } from '../domain/careerEvent.js';
import {
  CAREER_PENDING_PREF, addPending, parsePending, removePending, serializePending,
} from '../domain/draftQueue.js';
import {
  deleteCareerEvent, listCareerEvents, saveCareerEvent, saveCareerEventsBatch,
} from '../services/careerService.js';

export const careerKeys = Object.freeze({
  all: ['career'],
  events: (uid) => ['career', 'events', uid],
  officialPoints: (uid) => ['career', 'official-points', uid],
});

/** Os torneios de fora da pessoa logada. */
export function useCareerEvents({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery({
    queryKey: careerKeys.events(uid),
    queryFn: () => listCareerEvents(uid),
    enabled: Boolean(uid) && enabled,
    staleTime: 60_000,
  });
}

/** Os pontos lançados no ranking oficial das federações (leitura pública, `uid ==`). */
function useOfficialPoints(uid, enabled) {
  return useQuery({
    queryKey: careerKeys.officialPoints(uid),
    queryFn: () => listMyFederationPoints(uid),
    enabled: Boolean(uid) && enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * A linha do tempo. `isPending` enquanto alguma fonte ainda não respondeu;
 * depois, `timeline.faltou` lista as que falharam e `retry` tenta de novo só elas.
 */
export function useCareerTimeline({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  const careerQ = useCareerEvents({ enabled });
  // A mesma chave do início e da Minha área (cache compartilhado).
  const tournamentsQ = useMyTournaments();
  const trophiesQ = useTrophies(uid, { enabled });
  const gamesQ = usePublishedGameDayGames(uid, enabled);
  const pointsQ = useOfficialPoints(uid, enabled);
  const qs = [careerQ, tournamentsQ, trophiesQ, gamesQ, pointsQ];
  const pending = qs.some((q) => q.isPending);
  const ok = (q) => (q.isSuccess ? q.data : undefined);
  const timeline = useMemo(() => (pending ? null : buildCareerTimeline({
    career: ok(careerQ),
    tournaments: ok(tournamentsQ),
    trophies: trophiesQ.isSuccess ? trophiesQ.data : undefined,
    gameDayGames: ok(gamesQ),
    federationPoints: ok(pointsQ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [pending, careerQ.data, careerQ.isSuccess, tournamentsQ.data, tournamentsQ.isSuccess, trophiesQ.data, trophiesQ.isSuccess, gamesQ.data, gamesQ.isSuccess, pointsQ.data, pointsQ.isSuccess]);
  const retry = () => qs.filter((q) => q.isError).forEach((q) => q.refetch());
  return {
    timeline,
    isPending: pending,
    // Tudo falhou: não há linha do tempo para mostrar.
    isError: !pending && qs.every((q) => q.isError),
    retry,
    events: careerQ.data,
    myTournaments: tournamentsQ.isSuccess ? tournamentsQ.data : undefined,
  };
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: careerKeys.all });
}

/** Grava um torneio de fora (cria ou substitui). */
export function useSaveCareerEvent() {
  const { user } = useAuth();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (input) => saveCareerEvent(user?.uid, input),
    onSuccess: invalidar,
  });
}

/** Grava as linhas do modo lista de uma vez. */
export function useSaveCareerBatch() {
  const { user } = useAuth();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (events) => saveCareerEventsBatch(user?.uid, events),
    onSuccess: invalidar,
  });
}

/** Apaga um torneio de fora (e as fotos dele). */
export function useDeleteCareerEvent() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (event) => deleteCareerEvent(event), onSuccess: invalidar });
}

/**
 * Salvar com o rascunho sem sinal: o evento ganha o id definitivo, vai para a
 * fila do navegador e é gravado; deu certo, sai da fila. Sem conexão (ou se a
 * gravação falhar), fica guardado e é reenviado quando a conexão volta.
 * @returns {{ save: (input) => Promise<{ saved: boolean, event: object }>, pending: object[], flush: () => Promise<void> }}
 */
export function useCareerSaveWithDraft() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const online = useOnline();
  const invalidar = useInvalidar();
  const [pending, setPending] = useState(() => parsePending(readViewPreference(uid, CAREER_PENDING_PREF)));
  const enviando = useRef(false);

  const guardar = useCallback((fila) => {
    writeViewPreference(uid, CAREER_PENDING_PREF, serializePending(fila));
    setPending(fila);
  }, [uid]);

  useEffect(() => { setPending(parsePending(readViewPreference(uid, CAREER_PENDING_PREF))); }, [uid]);

  const flush = useCallback(async () => {
    if (!uid || enviando.current) return;
    const fila = parsePending(readViewPreference(uid, CAREER_PENDING_PREF));
    if (!fila.length) return;
    enviando.current = true;
    const feitos = [];
    try {
      for (const ev of fila) {
        try {
          await saveCareerEvent(uid, ev);
          feitos.push(ev.id);
        } catch {
          break;
        }
      }
    } finally {
      enviando.current = false;
    }
    if (feitos.length) {
      guardar(removePending(parsePending(readViewPreference(uid, CAREER_PENDING_PREF)), feitos));
      invalidar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, guardar]);

  useEffect(() => { if (online) flush(); }, [online, flush]);

  const save = useCallback(async (input) => {
    const { valid, error } = normalizeCareerEvent(input, { uid });
    if (!valid) throw new Error(error);
    const event = { ...input, id: input.id || newCareerEventId(uid) };
    guardar(addPending(parsePending(readViewPreference(uid, CAREER_PENDING_PREF)), event));
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { saved: false, event };
    try {
      const gravado = await saveCareerEvent(uid, event);
      guardar(removePending(parsePending(readViewPreference(uid, CAREER_PENDING_PREF)), [event.id]));
      invalidar();
      return { saved: true, event: gravado };
    } catch (err) {
      // Erro de conexão: fica na fila. Erro de regra (flag desligada) não melhora com o tempo.
      if (err?.code === 'permission-denied') {
        guardar(removePending(parsePending(readViewPreference(uid, CAREER_PENDING_PREF)), [event.id]));
        throw err;
      }
      return { saved: false, event };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, guardar]);

  return { save, pending, flush };
}
