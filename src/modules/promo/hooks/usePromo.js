/**
 * Hooks da DIVULGAÇÃO da plataforma e dos professores (Onda CG).
 *
 * As chaves de cache são fonte única (`promoKeys`): a vitrine, a tela inicial
 * e a gestão invalidam as mesmas chaves — chave escrita duas vezes diverge um
 * dia, e o sintoma não é erro, é a tela velha.
 */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useStudentCoaches } from '@/modules/coaches/hooks/useStudents';
import { coachIdsOfStudent, normalizeIssuer, promoSettingsId } from '../domain/promo.js';
import {
  createPromoCoupon, deletePromoCampaign, deletePromoCoupon, findCoachCouponByCode, findPromoCouponByCode, getPromoCampaign,
  getPromoSettings, listCoachPublicPromos, listHomePromoCampaigns, listHomePromoCoupons, listIssuerCampaigns,
  listIssuerCoupons, listPagePromoCampaigns, listPublicPromoCoupons, publishPromoCampaign, redeemPromoCoupon,
  savePromoBannerTemplates, savePromoCouponTemplates, setPromoCouponActive, setPromoCouponUnitCost,
  updatePromoCampaign, updatePromoCoupon,
} from '../services/promoService.js';

const dono = (issuer) => promoSettingsId(normalizeIssuer(issuer));

export const promoKeys = Object.freeze({
  all: ['promo'],
  cupons: (issuer) => ['promo', 'coupons', dono(issuer)],
  campanhas: (issuer) => ['promo', 'campaigns', dono(issuer)],
  config: (issuer) => ['promo', 'settings', dono(issuer)],
  campanha: (id) => ['promo', 'campaign', id],
  home: () => ['promo', 'home'],
  vitrine: () => ['promo', 'vitrine'],
  doProfessor: (coachId) => ['promo', 'coach-public', coachId],
});

/** Depois de qualquer escrita: tudo o que mostra divulgação fica velho. */
function invalidarTudo(qc) {
  qc.invalidateQueries({ queryKey: promoKeys.all });
}

/* ---------------------------- gestão ---------------------------- */

export function useIssuerCoupons(issuer, { enabled = true } = {}) {
  return useQuery({
    queryKey: promoKeys.cupons(issuer),
    queryFn: () => listIssuerCoupons(issuer),
    enabled: enabled && !!dono(issuer),
    staleTime: 60_000,
  });
}

export function useIssuerCampaigns(issuer, { enabled = true } = {}) {
  return useQuery({
    queryKey: promoKeys.campanhas(issuer),
    queryFn: () => listIssuerCampaigns(issuer),
    enabled: enabled && !!dono(issuer),
    staleTime: 60_000,
  });
}

export function usePromoSettings(issuer, { enabled = true } = {}) {
  return useQuery({
    queryKey: promoKeys.config(issuer),
    queryFn: () => getPromoSettings(issuer),
    enabled: enabled && !!dono(issuer),
    staleTime: 5 * 60_000,
  });
}

function useAcao(fn) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => fn(vars, user),
    onSuccess: () => invalidarTudo(qc),
  });
}

export const useCreatePromoCoupon = () => useAcao(({ issuer, input }, user) => createPromoCoupon(issuer, input, user));
export const useUpdatePromoCoupon = () => useAcao(({ issuer, couponId, input }, user) => updatePromoCoupon(issuer, couponId, input, user));
export const useSetPromoCouponActive = () => useAcao(({ issuer, couponId, active }, user) => setPromoCouponActive(issuer, couponId, active, user));
export const useDeletePromoCoupon = () => useAcao(({ issuer, couponId }, user) => deletePromoCoupon(issuer, couponId, user));
export const useRedeemPromoCoupon = () => useAcao(({ issuer, couponId, who }, user) => redeemPromoCoupon(issuer, couponId, who, user));
export const useSetPromoCouponUnitCost = () => useAcao(({ issuer, couponId, cost }, user) => setPromoCouponUnitCost(issuer, couponId, cost, user));
export const usePublishPromoCampaign = () => useAcao(({ issuer, input, recipients }, user) => publishPromoCampaign(issuer, input, recipients, user));
export const useUpdatePromoCampaign = () => useAcao(({ campaignId, patch }, user) => updatePromoCampaign(campaignId, patch, user));
export const useDeletePromoCampaign = () => useAcao(({ campaignId }, user) => deletePromoCampaign(campaignId, user));

/** Achar um cupom do emissor pelo código (a recepção) — não grava nada. */
export function useFindPromoCoupon() {
  return useMutation({ mutationFn: ({ issuer, code }) => findPromoCouponByCode(issuer, code) });
}

/**
 * A fonte de MODELOS para os editores de banner e de cupom (o mesmo editor da
 * arena, com `templates`). `kind`: `'banner'` ou `'coupon'`.
 */
export function usePromoTemplatesSource(issuer, kind) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const config = usePromoSettings(issuer);
  const campo = kind === 'coupon' ? 'coupon_templates' : 'banner_templates';
  const salvar = useMutation({
    mutationFn: (list) => (kind === 'coupon'
      ? savePromoCouponTemplates(issuer, list, user)
      : savePromoBannerTemplates(issuer, list, user)),
    onSuccess: () => qc.invalidateQueries({ queryKey: promoKeys.config(issuer) }),
  });
  return {
    query: { ...config, data: config.data ? config.data[campo] : undefined },
    save: (list) => salvar.mutateAsync(list),
    saving: salvar.isPending,
  };
}

/* ---------------------------- vitrines ---------------------------- */

/** Cupons e banners marcados para a TELA INICIAL (`enabled` = alguma flag ligada). */
export function useHomePromos({ enabled = true } = {}) {
  return useQuery({
    queryKey: promoKeys.home(),
    queryFn: async () => {
      const [coupons, campaigns] = await Promise.all([listHomePromoCoupons(), listHomePromoCampaigns()]);
      return { coupons, campaigns };
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** A vitrine de promoções (`/promocoes`). */
export function usePromoShowcase({ enabled = true } = {}) {
  return useQuery({
    queryKey: promoKeys.vitrine(),
    queryFn: async () => {
      const [coupons, campaigns] = await Promise.all([listPublicPromoCoupons(), listPagePromoCampaigns()]);
      return { coupons, campaigns };
    },
    enabled,
    staleTime: 2 * 60_000,
  });
}

/** O que UM professor divulga (o perfil dele). */
export function useCoachPublicPromos(coachId, { enabled = true } = {}) {
  return useQuery({
    queryKey: promoKeys.doProfessor(coachId),
    queryFn: () => listCoachPublicPromos(coachId),
    enabled: enabled && !!coachId,
    staleTime: 2 * 60_000,
  });
}

/** Uma campanha (a página "saiba mais"). */
export function usePromoCampaign(campaignId) {
  return useQuery({
    queryKey: promoKeys.campanha(campaignId),
    queryFn: () => getPromoCampaign(campaignId),
    enabled: !!campaignId,
    staleTime: 60_000,
  });
}

/**
 * Quem está vendo — para o "só para os meus alunos". A leitura dos vínculos é
 * do próprio aluno (a regra deixa). `falhou`: não dá para saber de quem a
 * pessoa é aluna, e a tela avisa em vez de afirmar que não há nada.
 */
export function usePromoViewer({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const vinculos = useStudentCoaches(enabled ? uid : null);
  const coachIdsDoAluno = useMemo(() => coachIdsOfStudent(vinculos.data || []), [vinculos.data]);
  const { isError: falhou, refetch: recarregar } = vinculos;
  return useMemo(
    () => ({ uid, coachIdsDoAluno, falhou, recarregar }),
    [uid, coachIdsDoAluno, falhou, recarregar],
  );
}

/** Conferir um código de professor (pedido de aula) — não grava nada. */
export { findCoachCouponByCode };
