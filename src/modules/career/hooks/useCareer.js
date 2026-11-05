/**
 * Carreira — os hooks (React Query). Só a aba aberta consulta: cada
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
import {
  getFederationRanking, listFederationEvents, listMyFederationPoints, listMyMemberships,
} from '@/modules/federations/services/federationService';
import { officialRankPoints } from '../domain/careerRank.js';
import { buildCareerTimeline } from '../domain/timeline.js';
import { newCareerEventId, normalizeCareerEvent } from '../domain/careerEvent.js';
import {
  CAREER_PENDING_PREF, addPending, parsePending, removePending, serializePending,
} from '../domain/draftQueue.js';
import {
  CareerError, careerAction, deleteCareerEvent, deleteCareerRank, listCareerEvents, listCareerPublic, listCareerRanks,
  listMyCareerPartnerDocs, listMyCareerPartnerInvites, listStudentCareerShares, saveCareerEvent, saveCareerEventsBatch, saveCareerRank,
  shareCareerWithCoach,
} from '../services/careerService.js';
import { partnerVoices } from '../domain/careerPartner.js';

export const careerKeys = Object.freeze({
  all: ['career'],
  events: (uid) => ['career', 'events', uid],
  partners: (uid) => ['career', 'partners', uid],
  invites: (uid) => ['career', 'invites', uid],
  publicOf: (uid) => ['career', 'public', uid],
  moderation: ['career', 'moderation'],
  // A MESMA chave de `fedKeys.myPoints` (useFederations): um cache só para os
  // pontos. Não importamos aquele arquivo para não puxar a federação inteira
  // para a estante de troféus.
  officialPoints: (uid) => ['federacoes', 'meus-pontos', uid],
  // A MESMA de `fedKeys.myMemberships` (cache compartilhado com o card do início).
  myMemberships: (uid) => ['federacoes', 'minhas-filiacoes', uid],
  ranks: (uid) => ['career', 'ranks', uid],
  officialRanks: (uid, pares) => ['career', 'official-ranks', uid, pares],
  studentShares: (coach, student) => ['career', 'student-shares', coach, student],
  fedAgenda: (ids) => ['career', 'fed-agenda', ids],
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

/** Os pedidos da dupla em que a pessoa está, dos dois lados (`career_partner`). */
function usePartnersOf(uid, enabled) {
  return useQuery({
    queryKey: careerKeys.partners(uid),
    queryFn: () => listMyCareerPartnerDocs(uid),
    enabled: Boolean(uid) && enabled,
    staleTime: 60_000,
  });
}

export function useCareerPartners({ enabled = true } = {}) {
  const { user } = useAuth();
  return usePartnersOf(user?.uid, enabled);
}

/** Os convites pelo WhatsApp que a pessoa mandou à dupla sem conta (PR 6). */
export function useCareerPartnerInvites({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery({
    queryKey: careerKeys.invites(uid),
    queryFn: () => listMyCareerPartnerInvites(uid),
    enabled: Boolean(uid) && enabled,
    staleTime: 60_000,
  });
}

/**
 * A voz da dupla para o foco do balanço (de `uid`): `[]` com a flag desligada
 * ou sem visões usadas; falha também vira `[]` — a voz SOMA ao foco, nunca o
 * afirma vazio (o balanço segue com o histórico da própria pessoa). `null`
 * enquanto a consulta ligada ainda não respondeu (a tela segura o salvar).
 */
export function useCareerPartnerVoices(uid, { enabled = true } = {}) {
  const q = usePartnersOf(uid, enabled);
  const ligada = Boolean(uid) && enabled;
  return useMemo(() => {
    if (q.isSuccess) return partnerVoices(q.data, uid);
    return ligada && !q.isError ? null : [];
  }, [q.isSuccess, q.isError, q.data, uid, ligada]);
}

/** Uma ação da dupla no servidor; invalida tudo da carreira. */
export function useCareerPartnerAction() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ action, ...payload }) => careerAction(action, payload),
    // Também na recusa: o servidor pode ter mudado o registro (a dupla aceitou o
    // link) e a tela segue oferecendo o que já não vale.
    onSettled: invalidar,
  });
}

/**
 * A VITRINE pública de `uid` (o perfil público e a própria ficha). A chave fica
 * sob `career`: publicar/tirar (`useCareerPartnerAction`) invalida junto.
 */
export function useCareerPublic(uid, { enabled = true } = {}) {
  return useQuery({
    queryKey: careerKeys.publicOf(uid),
    queryFn: () => listCareerPublic(uid),
    enabled: Boolean(uid) && enabled,
    staleTime: 60_000,
  });
}

/** A fila de moderação (só o admin; o servidor confere). */
export function useCareerModerationQueue({ enabled = true } = {}) {
  return useQuery({
    queryKey: careerKeys.moderation,
    queryFn: async () => (await careerAction('queue')).items || [],
    enabled,
    staleTime: 30_000,
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
  const partnersQ = useCareerPartners({ enabled });
  const qs = [careerQ, tournamentsQ, trophiesQ, gamesQ, pointsQ, partnersQ];
  const pending = qs.some((q) => q.isPending);
  const ok = (q) => (q.isSuccess ? q.data : undefined);
  const timeline = useMemo(() => (pending ? null : buildCareerTimeline({
    career: ok(careerQ),
    tournaments: ok(tournamentsQ),
    trophies: trophiesQ.isSuccess ? trophiesQ.data : undefined,
    gameDayGames: ok(gamesQ),
    federationPoints: ok(pointsQ),
    partners: ok(partnersQ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [pending, careerQ.data, careerQ.isSuccess, tournamentsQ.data, tournamentsQ.isSuccess, trophiesQ.data, trophiesQ.isSuccess, gamesQ.data, gamesQ.isSuccess, pointsQ.data, pointsQ.isSuccess, partnersQ.data, partnersQ.isSuccess]);
  const retry = () => qs.filter((q) => q.isError).forEach((q) => q.refetch());
  return {
    timeline,
    isPending: pending,
    // Tudo falhou: não há linha do tempo para mostrar.
    isError: !pending && qs.every((q) => q.isError),
    retry,
    events: careerQ.data,
    myTournaments: tournamentsQ.isSuccess ? tournamentsQ.data : undefined,
    // Os pódios da plataforma (com a dupla): a retrospectiva da temporada acha a melhor parceria.
    trophies: trophiesQ.isSuccess ? trophiesQ.data : undefined,
    partners: partnersQ.isSuccess ? partnersQ.data : undefined,
    // Os lançamentos oficiais: de que federações sair a posição oficial no ranking.
    federationPoints: pointsQ.isSuccess ? pointsQ.data : undefined,
    partnersError: partnersQ.isError,
    retryPartners: () => partnersQ.refetch(),
  };
}

/* ------------------------------------------- posição no ranking (PR 4) -- */

/** As posições digitadas (`career_rank`). */
export function useCareerRanks({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: careerKeys.ranks(user?.uid),
    queryFn: () => listCareerRanks(user?.uid),
    enabled: Boolean(user?.uid) && enabled,
    staleTime: 60_000,
  });
}

/**
 * As posições OFICIAIS, sem digitar: das federações e temporadas em que a
 * pessoa tem pontos lançados, lê o ranking que o servidor grava. Cada ranking
 * falha sozinho (`incompleto`). `points` indefinido = os lançamentos não
 * carregaram (a consulta nem sai).
 */
export function useOfficialRanks(points, { enabled = true } = {}) {
  const { user } = useAuth();
  const pares = useMemo(() => {
    const m = new Map();
    (points || []).filter((p) => p?.federation_id && p.status !== 'cancelled' && Number(p.season)).forEach((p) => {
      m.set(`${p.federation_id}_${p.season}`, { federation_id: p.federation_id, acronym: p.federation_acronym || '', season: Number(p.season) });
    });
    return [...m.values()].slice(0, 12);
  }, [points]);
  return useQuery({
    queryKey: careerKeys.officialRanks(user?.uid, pares.map((p) => `${p.federation_id}_${p.season}`).join(',')),
    queryFn: async () => {
      const res = await Promise.allSettled(pares.map(async (p) => ({ ...p, doc: await getFederationRanking(p.federation_id, p.season) })));
      return {
        points: officialRankPoints(res.filter((r) => r.status === 'fulfilled').map((r) => r.value), user?.uid),
        incompleto: res.some((r) => r.status === 'rejected'),
      };
    },
    enabled: Boolean(user?.uid) && enabled && Array.isArray(points),
    staleTime: 5 * 60_000,
  });
}

export function useSaveCareerRank() {
  const { user } = useAuth();
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (input) => saveCareerRank(user?.uid, input), onSuccess: invalidar });
}

export function useDeleteCareerRank() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (id) => deleteCareerRank(id), onSuccess: invalidar });
}

/* ------------------------------------------ "Mandar ao meu professor" -- */

export function useShareCareerWithCoach() {
  const invalidar = useInvalidar();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ event, coachId }) => shareCareerWithCoach(event, coachId),
    onSuccess: () => { invalidar(); qc.invalidateQueries({ queryKey: ['treino', 'balanco'] }); },
  });
}

/** O que UM aluno mandou ao professor (só quando o professor abre o aluno). */
export function useStudentCareerShares(coachUid, studentUid, { enabled = true } = {}) {
  return useQuery({
    queryKey: careerKeys.studentShares(coachUid, studentUid),
    queryFn: () => listStudentCareerShares(coachUid, studentUid),
    enabled: Boolean(coachUid && studentUid) && enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/* --------------------------------------------- a descoberta (PR 4) -- */

/**
 * A agenda pública das federações em que a pessoa é filiada (uma consulta
 * por federação, cada uma falha sozinha). `undefined` em `data.events`
 * quando as filiações não carregaram.
 */
export function useFederationAgendaForMe({ enabled = true } = {}) {
  const { user } = useAuth();
  const memb = useQuery({
    queryKey: careerKeys.myMemberships(user?.uid),
    queryFn: () => listMyMemberships(user?.uid),
    enabled: Boolean(user?.uid) && enabled,
    staleTime: 5 * 60_000,
  });
  const feds = useMemo(() => {
    const m = new Map();
    // Filiação cancelada ou recusada não é "a minha federação".
    (memb.data || []).forEach((x) => { if (x?.federation_id && !['cancelled', 'rejected'].includes(x.status)) m.set(x.federation_id, { name: x.federation_name || '', acronym: x.federation_acronym || '' }); });
    return m;
  }, [memb.data]);
  const ids = [...feds.keys()].slice(0, 10);
  const agenda = useQuery({
    queryKey: careerKeys.fedAgenda(ids.join(',')),
    queryFn: async () => {
      const res = await Promise.allSettled(ids.map((id) => listFederationEvents(id, 'public')));
      return { events: res.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value), incompleto: res.some((r) => r.status === 'rejected') };
    },
    enabled: Boolean(user?.uid) && enabled && memb.isSuccess && ids.length > 0,
    staleTime: 5 * 60_000,
  });
  const semFiliacao = memb.isSuccess && ids.length === 0;
  return {
    isPending: enabled && (memb.isPending || (!semFiliacao && agenda.isPending)),
    isError: memb.isError || agenda.isError,
    incompleto: Boolean(agenda.data?.incompleto),
    events: semFiliacao ? [] : (agenda.isSuccess ? agenda.data.events : undefined),
    federations: Object.fromEntries(feds),
    retry: () => { if (memb.isError) memb.refetch(); if (agenda.isError || agenda.data?.incompleto) agenda.refetch(); },
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
