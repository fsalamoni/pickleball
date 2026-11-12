/**
 * Carreira — os hooks (React Query). Só a aba aberta consulta: cada
 * hook recebe `enabled`, e a linha do tempo junta as fontes sem esperar que
 * todas deem certo — a que falhou chega `undefined` e a tela diz o quê.
 *
 * Este arquivo é o LEVE: nada de torneios, pódios, dias de jogo nem do serviço
 * das federações por import estático (a estante de troféus e o balanço do jogo
 * importam daqui com a flag desligada). A linha do tempo mora em
 * `useCareerTimeline.js`; o serviço das federações entra por `import()` dentro
 * do `queryFn`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useOnline } from '@/core/lib/useOnline';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { t } from '@/core/i18n';
import { officialRankPoints } from '../domain/careerRank.js';
import { newCareerEventId, normalizeCareerEvent } from '../domain/careerEvent.js';
import {
  CAREER_PENDING_PREF, MAX_PENDING, addPending, parsePending, pendingFull, removePending, serializePending,
} from '../domain/draftQueue.js';
import {
  CareerError, careerAction, deleteCareerEvent, deleteCareerRank, listCareerEvents, listCareerPublic, listCareerRanks,
  listMyCareerPartnerDocs, listMyCareerPartnerInvites, listStudentCareerShares, saveCareerEvent, saveCareerEventsBatch, saveCareerRank,
  shareCareerWithCoach,
} from '../services/careerService.js';
import { partnerVoices } from '../domain/careerPartner.js';


/** O serviço das federações só desce quando uma consulta dele roda. */
const federacoes = () => import('@/modules/federations/services/federationService');
const semConexao = () => typeof navigator !== 'undefined' && navigator.onLine === false;

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
  // FORA do prefixo `career`: nada do que a pessoa grava na carreira muda o
  // ranking nem a agenda das federações, e cada salvar invalida `['career']`.
  officialRanks: (uid, pares) => ['federacoes', 'carreira-ranks', uid, pares],
  studentShares: (coach, student) => ['career', 'student-shares', coach, student],
  fedAgenda: (ids) => ['federacoes', 'carreira-agenda', ids],
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
      const { getFederationRanking } = await federacoes();
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
  const { user, userProfile } = useAuth();
  const invalidar = useInvalidar();
  const qc = useQueryClient();
  // Quem manda: o aviso ao professor leva o nome (como no diário de treino).
  const actor = user?.uid
    ? { uid: user.uid, name: userProfile?.platform_name || userProfile?.full_name || user.displayName || '' }
    : undefined;
  return useMutation({
    mutationFn: ({ event, coachId }) => shareCareerWithCoach(event, coachId, { actor }),
    // Também na falha: a tela relê o que de fato ficou gravado, em vez de supor.
    onSettled: () => { invalidar(); qc.invalidateQueries({ queryKey: ['treino', 'balanco'] }); },
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
    queryFn: async () => (await federacoes()).listMyMemberships(user?.uid),
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
      const { listFederationEvents } = await federacoes();
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

/**
 * Grava as linhas do modo lista de uma vez. Nunca fica em "Salvando…" para
 * sempre: sem conexão recusa na hora (nada é enviado), e se o servidor não
 * confirmar no prazo a mutação FALHA dizendo que o envio ainda pode chegar —
 * quando chegar, a lista é relida sozinha.
 */
export function useSaveCareerBatch() {
  const { user } = useAuth();
  const invalidar = useInvalidar();
  return useMutation({
    // `always`: sem isso o React Query PAUSA a mutação offline e o botão gira sem explicar.
    networkMode: 'always',
    mutationFn: async (events) => {
      if (semConexao()) throw new CareerError(t('Sem conexão. Tente de novo quando ela voltar.'));
      const envio = saveCareerEventsBatch(user?.uid, events);
      const gravados = await comPrazo(envio);
      if (gravados !== PRAZO) return gravados;
      envio.then(invalidar, () => {});
      throw new CareerError(t('A conexão está lenta e o envio ainda não foi confirmado. Confira a linha do tempo antes de salvar de novo.'));
    },
    onSuccess: invalidar,
  });
}

/**
 * Apaga um torneio de fora (e as fotos dele). Também o tira da fila do
 * rascunho sem sinal — senão o próximo envio o recriaria — e ANTES de qualquer
 * espera (`networkMode: 'always'`: offline o React Query pausaria a mutação e
 * o rascunho seguiria na fila). O que só existia na fila não tem documento: a
 * regra recusa apagar o inexistente, e isso não é erro; nem se espera o
 * servidor por ele. O `deleteDoc` sai sempre: o SDK o ordena depois de um
 * `setDoc` ainda pendente do mesmo aparelho.
 */
export function useDeleteCareerEvent() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const invalidar = useInvalidar();
  const qc = useQueryClient();
  // O balanço do torneio sai junto: o foco das semanas do treino não pode seguir citando-o.
  const reler = () => { invalidar(); qc.invalidateQueries({ queryKey: ['treino', 'balanco'] }); };
  return useMutation({
    networkMode: 'always',
    mutationFn: async (event) => {
      const fila = parsePending(readViewPreference(uid, CAREER_PENDING_PREF));
      const naFila = fila.some((x) => x.id === event?.id);
      // "Só local" é o registro que nunca chegou ao servidor. A fila também guarda EDIÇÃO de
      // torneio já gravado: esse precisa da confirmação do servidor para sumir de verdade.
      const soLocal = naFila && !(Number(event?.updated_at_ms) > 0);
      if (!soLocal && semConexao()) throw new CareerError(t('Sem conexão. Tente de novo quando ela voltar.'));
      if (naFila) writeViewPreference(uid, CAREER_PENDING_PREF, serializePending(removePending(fila, [event.id])));
      const apagar = deleteCareerEvent(event);
      // Chegou depois do prazo: a lista é relida quando chegar.
      apagar.then(reler, () => {});
      try {
        const fim = soLocal && semConexao() ? PRAZO : await comPrazo(apagar);
        if (fim === PRAZO && !soLocal) throw new CareerError(t('Sem conexão. Tente de novo quando ela voltar.'));
      } catch (err) {
        // Apagar o que já não existe (toque repetido, registro só local) é o estado desejado.
        if (err?.code !== 'permission-denied') throw err;
      }
    },
    onSuccess: reler,
  });
}

/**
 * Salvar com o rascunho sem sinal: o evento ganha o id definitivo, vai para a
 * fila do navegador e é gravado; deu certo, sai da fila. Sem conexão (ou se o
 * servidor não confirmar em 8 s), fica guardado e é reenviado quando a
 * conexão volta. Erro definitivo (regra, dado inválido) ao SALVAR tira da fila
 * e sobe (a ficha está aberta, a pessoa vê); no REENVIO o rascunho recusado
 * fica na fila marcado `refused: true` — sai do reenvio automático, mas o que
 * foi digitado não some calado: a pessoa abre, corrige ou descarta.
 *
 * `save` só devolve `saved: false` se o rascunho ficou MESMO guardado: com o
 * navegador recusando guardar (ou a fila cheia) e sem resposta do servidor, lança.
 * `flush` devolve o que aconteceu, para o botão "Enviar agora" dar retorno.
 * @returns {{ save: (input) => Promise<{ saved: boolean, event: object }>, pending: object[],
 *   flush: () => Promise<{ enviados: number, esperando: number, recusados: Array<{ id: string, name: string }> }>,
 *   flushing: boolean, refresh: () => void }}
 */
export function useCareerSaveWithDraft() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const online = useOnline();
  const invalidar = useInvalidar();
  const [pending, setPending] = useState(() => parsePending(readViewPreference(uid, CAREER_PENDING_PREF)));
  const enviando = useRef(false);
  const [flushing, setFlushing] = useState(false);

  const ler = useCallback(() => parsePending(readViewPreference(uid, CAREER_PENDING_PREF)), [uid]);
  /** @returns {boolean} se o navegador guardou MESMO (aba anônima, armazenamento cheio ⇒ `false`). */
  const guardar = useCallback((fila) => {
    const ok = writeViewPreference(uid, CAREER_PENDING_PREF, serializePending(fila));
    if (ok) setPending(fila);
    return ok;
  }, [uid]);
  /** Relê a fila (outra parte da tela — a exclusão — pode tê-la mudado). */
  const refresh = useCallback(() => setPending(ler()), [ler]);

  useEffect(() => { refresh(); }, [refresh]);

  const flush = useCallback(async () => {
    const aEnviar = (fila) => fila.filter((x) => !x.refused);
    if (!uid || enviando.current) return { enviados: 0, esperando: aEnviar(ler()).length, recusados: [] };
    const fila = aEnviar(ler());
    if (!fila.length) return { enviados: 0, esperando: 0, recusados: [] };
    enviando.current = true;
    setFlushing(true);
    const sair = [];
    const recusados = [];
    try {
      for (const ev of fila) {
        try {
          // `resend`: o primeiro envio pode ter chegado — relê antes de gravar por cima.
          if (await comPrazo(saveCareerEvent(uid, ev, { resend: true })) === PRAZO) break;
          sair.push(ev.id);
        } catch (err) {
          // Definitivo: não adianta reenviar, e travaria a fila inteira atrás dele.
          if (erroDefinitivo(err)) { recusados.push({ id: ev.id, name: ev.name || '' }); continue; }
          break;
        }
      }
    } finally {
      enviando.current = false;
      setFlushing(false);
    }
    if (sair.length || recusados.length) {
      const fora = new Set(recusados.map((r) => r.id));
      guardar(removePending(ler(), sair).map((x) => (fora.has(x.id) ? { ...x, refused: true } : x)));
    }
    if (sair.length) invalidar();
    return { enviados: sair.length, esperando: aEnviar(ler()).length, recusados };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ler, guardar]);

  useEffect(() => { if (online) flush(); }, [online, flush]);

  const save = useCallback(async (input) => {
    const { valid, error } = normalizeCareerEvent(input, { uid });
    if (!valid) throw new Error(error);
    const event = { ...input, id: input.id || newCareerEventId(uid) };
    delete event.refused; // rascunho recusado que a pessoa corrigiu: volta a valer
    const fila = ler();
    // Fila cheia: nunca se derruba um rascunho antigo para caber o novo.
    const cheia = pendingFull(fila.filter((x) => !x.refused), event);
    const guardou = !cheia && guardar(addPending(fila, event));
    // O erro leva o registro (com o id): a ficha o reaproveita e tentar de novo não duplica.
    const naoGuardou = () => Object.assign(new Error(cheia
      ? t('Você tem {n} registros esperando conexão neste aparelho. Envie-os antes de registrar outro.', { n: MAX_PENDING })
      : t('Sem conexão, e este navegador não deixou guardar o registro. Não feche a ficha e tente de novo quando a conexão voltar.')), { event });
    if (semConexao()) {
      // Só se afirma "guardado neste aparelho" quando guardou.
      if (!guardou) throw naoGuardou();
      return { saved: false, event };
    }
    const enviado = JSON.stringify(event);
    /** Tira da fila só se o rascunho guardado ainda é o MESMO que foi enviado. */
    const tirarSeMesmo = () => {
      const atual = ler().find((x) => x.id === event.id);
      if (atual && JSON.stringify(atual) === enviado) guardar(removePending(ler(), [event.id]));
    };
    const envio = saveCareerEvent(uid, event);
    try {
      const gravado = await comPrazo(envio);
      if (gravado === PRAZO) {
        // Sinal ruim com `onLine`: o servidor não confirmou a tempo — fica na fila.
        // O `setDoc` segue vivo no SDK: quando chegar, o rascunho sai da fila (senão o
        // próximo reenvio o regravaria por cima do que mudou depois) e a lista é relida.
        envio.then(() => { tirarSeMesmo(); invalidar(); }, (err) => { if (erroDefinitivo(err)) tirarSeMesmo(); });
        if (!guardou) throw naoGuardou();
        return { saved: false, event };
      }
      guardar(removePending(ler(), [event.id]));
      invalidar();
      return { saved: true, event: gravado };
    } catch (err) {
      // Erro de conexão: fica na fila. Erro de regra (flag desligada) não melhora com o tempo.
      if (erroDefinitivo(err)) {
        guardar(removePending(ler(), [event.id]));
        throw err;
      }
      if (!guardou) throw naoGuardou();
      return { saved: false, event };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ler, guardar]);

  return { save, pending, flush, flushing, refresh };
}
