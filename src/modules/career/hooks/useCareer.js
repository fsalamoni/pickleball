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
  CareerError, deleteCareerEvent, listCareerEvents, saveCareerEvent, saveCareerEventsBatch,
} from '../services/careerService.js';

export const careerKeys = Object.freeze({
  all: ['career'],
  events: (uid) => ['career', 'events', uid],
  // A MESMA chave de `fedKeys.myPoints` (useFederations): um cache só para os
  // pontos. Não importamos aquele arquivo para não puxar a federação inteira
  // para a estante de troféus.
  officialPoints: (uid) => ['federacoes', 'meus-pontos', uid],
});

/** Prazo para o servidor confirmar a gravação; passou, vale o rascunho no aparelho. */
const PRAZO_GRAVACAO_MS = 8000;
const PRAZO = Symbol('prazo');
/** O `setDoc` com sinal ruim (mas `navigator.onLine`) não falha: fica esperando. */
function comPrazo(promessa, ms = PRAZO_GRAVACAO_MS) {
  let timer;
  const prazo = new Promise((resolve) => { timer = setTimeout(() => resolve(PRAZO), ms); });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(timer));
}
/** Erro que não melhora com o tempo (regra recusou, dado inválido): o rascunho sai da fila. */
const erroDefinitivo = (err) => err?.code === 'permission-denied' || err instanceof CareerError;

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
  const tournamentsQ = useMyTournaments({ enabled });
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

/**
 * Apaga um torneio de fora (e as fotos dele). Também o tira da fila do
 * rascunho sem sinal — senão o próximo envio o recriaria. O que só existia na
 * fila não tem documento: a regra recusa apagar o inexistente, e isso não é erro.
 */
export function useDeleteCareerEvent() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (event) => {
      const fila = parsePending(readViewPreference(uid, CAREER_PENDING_PREF));
      const naFila = fila.some((x) => x.id === event?.id);
      if (naFila) writeViewPreference(uid, CAREER_PENDING_PREF, serializePending(removePending(fila, [event.id])));
      try {
        await deleteCareerEvent(event);
      } catch (err) {
        if (!(naFila && err?.code === 'permission-denied')) throw err;
      }
    },
    onSuccess: invalidar,
  });
}

/**
 * Salvar com o rascunho sem sinal: o evento ganha o id definitivo, vai para a
 * fila do navegador e é gravado; deu certo, sai da fila. Sem conexão (ou se o
 * servidor não confirmar em 8 s), fica guardado e é reenviado quando a
 * conexão volta. Erro definitivo (regra, dado inválido) tira da fila.
 * @returns {{ save: (input) => Promise<{ saved: boolean, event: object }>, pending: object[], flush: () => Promise<void>, refresh: () => void }}
 */
export function useCareerSaveWithDraft() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const online = useOnline();
  const invalidar = useInvalidar();
  const [pending, setPending] = useState(() => parsePending(readViewPreference(uid, CAREER_PENDING_PREF)));
  const enviando = useRef(false);

  const ler = useCallback(() => parsePending(readViewPreference(uid, CAREER_PENDING_PREF)), [uid]);
  const guardar = useCallback((fila) => {
    writeViewPreference(uid, CAREER_PENDING_PREF, serializePending(fila));
    setPending(fila);
  }, [uid]);
  /** Relê a fila (outra parte da tela — a exclusão — pode tê-la mudado). */
  const refresh = useCallback(() => setPending(ler()), [ler]);

  useEffect(() => { refresh(); }, [refresh]);

  const flush = useCallback(async () => {
    if (!uid || enviando.current) return;
    const fila = ler();
    if (!fila.length) return;
    enviando.current = true;
    const sair = [];
    try {
      for (const ev of fila) {
        try {
          if (await comPrazo(saveCareerEvent(uid, ev)) === PRAZO) break;
          sair.push(ev.id);
        } catch (err) {
          // Definitivo: não adianta reenviar, e travaria a fila inteira atrás dele.
          if (erroDefinitivo(err)) { sair.push(ev.id); continue; }
          break;
        }
      }
    } finally {
      enviando.current = false;
    }
    if (sair.length) {
      guardar(removePending(ler(), sair));
      invalidar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ler, guardar]);

  useEffect(() => { if (online) flush(); }, [online, flush]);

  const save = useCallback(async (input) => {
    const { valid, error } = normalizeCareerEvent(input, { uid });
    if (!valid) throw new Error(error);
    const event = { ...input, id: input.id || newCareerEventId(uid) };
    guardar(addPending(ler(), event));
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { saved: false, event };
    try {
      const gravado = await comPrazo(saveCareerEvent(uid, event));
      // Sinal ruim com `onLine`: o servidor não confirmou a tempo — fica na fila.
      if (gravado === PRAZO) return { saved: false, event };
      guardar(removePending(ler(), [event.id]));
      invalidar();
      return { saved: true, event: gravado };
    } catch (err) {
      // Erro de conexão: fica na fila. Erro de regra (flag desligada) não melhora com o tempo.
      if (erroDefinitivo(err)) {
        guardar(removePending(ler(), [event.id]));
        throw err;
      }
      return { saved: false, event };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ler, guardar]);

  return { save, pending, flush, refresh };
}
