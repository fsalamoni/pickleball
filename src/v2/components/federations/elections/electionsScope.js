/**
 * O ESCOPO das eleições: a mesma tela serve a federação e o clube-associação (Bloco F2).
 *
 * Os componentes (assistente do edital, painel da comissão, cartão do associado, votação,
 * registro de chapa, aba pública) recebem uma "entidade" (`federation`): a federação como
 * ela é, ou o clube no mesmo formato (`clubElectionsEntity`, com `kind: 'club'`). Só mudam
 * poucas coisas, todas aqui: qual função do servidor é chamada, de onde vêm as leituras,
 * para onde os links apontam e o que a invalidação atinge.
 *
 * A federação lê as espécies direto do banco (cada consulta filtra pelo campo que a regra
 * confere). O clube lê UMA vez só, pela ação `overview` do servidor (`clubElections`), que
 * já recorta pelo que a pessoa pode ver — a cédula do voto secreto nem tem regra de
 * leitura —, e cada gancho abaixo deriva a sua lista dessa visão. Falha é `isError`.
 *
 * A régua da eleição é a MESMA (`functions/federationElectionsPolicy.js`); o clube só fixa
 * o colégio (um associado, um voto: `clubElectionsPolicy.js`). As telas dizem "associados"
 * e "clube" onde a federação diz "filiados" e "federação".
 */
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { electionAction } from '@/modules/federations/services/federationService';
import {
  useCandidacyInfo, useElectionCandidacies, useElectionVoters, useMyCandidacies, useMyCommissionElections, useMyElectionEndorsements, useMyElectionVoters, usePublicElections,
} from '@/modules/federations/hooks/useElections';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { docPublicPath } from '@/modules/federations/domain/acervo';
import { clubElectionsAction } from '@/modules/clubs/services/clubElectionsService';
import { useClubCandidacyInfo, useClubElectionsOverview } from '@/modules/clubs/hooks/useClubElections';
import { assocKeys } from '@/modules/clubs/hooks/useClubAssociation';
import { clubDocPath } from '@/modules/clubs/domain/docs';

export const isClubElections = (entity) => entity?.kind === 'club';

/** O clube no formato que as eleições leem. `publica`: a vitrine sem login (`/c/:id`). */
export const clubElectionsEntity = (club, { publica = false } = {}) => ({
  id: club?.id, kind: 'club', name: club?.name || '', acronym: club?.name || club?.id, slug: club?.id, modules: { elections: true, official_docs: true }, publica,
});

/** O que o colégio do clube pesa: um associado, um voto — o assistente esconde os pesos por categoria. */
export const hasCollegeWeights = (entity) => !isClubElections(entity);

/** O endereço da aba de eleições (a página do clube, ou a vitrine pública). */
export const electionsPathFor = (entity, query = '') => {
  const q = query ? `&${query}` : '';
  if (isClubElections(entity)) return entity.publica ? `/c/${encodeURIComponent(entity.id)}?tab=eleicoes${q}` : `/clubes/${encodeURIComponent(entity.id)}?tab=eleicoes${q}`;
  return `/federacoes/${encodeURIComponent(entity.id)}?aba=eleicoes${q}`;
};

/** O link que a chapa compartilha para pedir apoio (no app: apoiar exige entrar). */
export const supportLinkFor = (entity, electionId, candidacyId) => {
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origem}${electionsPathFor({ ...entity, publica: false }, `eleicao=${encodeURIComponent(electionId)}&apoiar=${encodeURIComponent(candidacyId)}`)}`;
};

/** O endereço do edital ou da ata no acervo. */
export const noticeDocPathFor = (entity, docId) => (isClubElections(entity) ? clubDocPath(entity.id, docId, { publica: entity.publica }) : docPublicPath(entity, docId));

/** Uma consulta derivada da visão: o mesmo formato do React Query, e a falha continua falha. */
function useDerivada(q, fn, club) {
  const data = useMemo(() => (q.isSuccess ? fn(q.data) : undefined), [q.isSuccess, q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return club ? { data, isLoading: q.isLoading, isError: q.isError, isSuccess: q.isSuccess, error: q.error, refetch: q.refetch } : null;
}

const recentes = (xs) => [...xs].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));

/** A visão do clube (só se o escopo é o clube). */
function useVisao(entity, enabled = true) {
  return useClubElectionsOverview(entity?.id, { enabled: isClubElections(entity) && enabled });
}

/** As eleições publicadas (página pública e área do associado). */
export function useScopedPublicElections(entity, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const fed = usePublicElections(entity?.id, { enabled: !club && enabled });
  const v = useVisao(entity, enabled);
  return useDerivada(v, (d) => recentes((d.elections || []).filter((e) => e.public === true)), club) || fed;
}

/** Todas as eleições, rascunhos inclusive (a administração; no clube, o servidor já recorta). */
export function useScopedAllElections(entity, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const v = useVisao(entity, enabled);
  const d = useDerivada(v, (x) => recentes(x.elections || []), club);
  return d || { data: undefined, isLoading: false, isError: false, isSuccess: false, refetch: () => {} };
}

/** As eleições em que a pessoa está na comissão eleitoral. */
export function useScopedCommissionElections(entity, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const { user } = useAuth();
  const fed = useMyCommissionElections({ enabled: !club && enabled });
  const v = useVisao(entity, enabled && Boolean(user?.uid));
  return useDerivada(v, (d) => recentes((d.elections || []).filter((e) => (e.commission_uids || []).includes(user?.uid))), club) || fed;
}

/** As chapas de uma eleição: as aceitas para todos; `all` (comissão/administração) traz todas. */
export function useScopedCandidacies(entity, electionId, { all = false, enabled = true } = {}) {
  const club = isClubElections(entity);
  const fed = useElectionCandidacies(entity?.id, electionId, { all, enabled: !club && enabled });
  const v = useVisao(entity, enabled && Boolean(electionId));
  return useDerivada(v, (d) => (d.candidacies || [])
    .filter((c) => c.election_id === electionId && (all || c.public === true))
    .sort((a, b) => (a.submitted_at_ms || 0) - (b.submitted_at_ms || 0)), club) || fed;
}

/** O colégio congelado de uma eleição (só quem conduz recebe): quem votou, nunca em quem. */
export function useScopedVoters(entity, electionId, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const fed = useElectionVoters(entity?.id, electionId, { enabled: !club && enabled });
  const v = useVisao(entity, enabled && Boolean(electionId));
  return useDerivada(v, (d) => (d.voters || [])
    .filter((x) => x.election_id === electionId)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')), club) || fed;
}

/** Onde estou no colégio (meu peso, se já votei — nunca em quem). */
export function useScopedMyVoters(entity, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const fed = useMyElectionVoters({ enabled: !club && enabled });
  const v = useVisao(entity, enabled);
  return useDerivada(v, (d) => d.mine?.voters || [], club) || fed;
}

/** As chapas em que estou. */
export function useScopedMyCandidacies(entity, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const fed = useMyCandidacies({ enabled: !club && enabled });
  const v = useVisao(entity, enabled);
  return useDerivada(v, (d) => d.mine?.candidacies || [], club) || fed;
}

/** Os apoios que dei a chapas. */
export function useScopedMyEndorsements(entity, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const fed = useMyElectionEndorsements({ enabled: !club && enabled });
  const v = useVisao(entity, enabled);
  return useDerivada(v, (d) => d.mine?.endorsements || [], club) || fed;
}

/** A chapa do link de apoio. */
export function useScopedCandidacyInfo(entity, electionId, candidacyId, { enabled = true } = {}) {
  const club = isClubElections(entity);
  const fed = useCandidacyInfo(entity?.id, electionId, candidacyId, { enabled: !club && enabled });
  const cl = useClubCandidacyInfo(entity?.id, electionId, candidacyId, { enabled: club && enabled });
  return club ? cl : fed;
}

/**
 * Toda ação da eleição (pelo servidor). Os componentes mandam `federationId`; no clube ele
 * vira `clubId`. A federação invalida a árvore das federações; o clube, a árvore do clube.
 */
export function useScopedElectionAction(entity) {
  const qc = useQueryClient();
  const club = isClubElections(entity);
  return useFederationMutation(async ({ federationId, ...payload }) => {
    if (!club) return electionAction({ federationId: federationId || entity.id, ...payload });
    try {
      return await clubElectionsAction({ clubId: entity.id, ...payload });
    } finally {
      qc.invalidateQueries({ queryKey: assocKeys.all(entity.id) });
    }
  });
}
