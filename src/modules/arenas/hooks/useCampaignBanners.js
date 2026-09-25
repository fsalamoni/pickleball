/**
 * Hooks das campanhas com BANNER (Onda CC).
 *
 * Arquivo próprio, fora do `useArenaV3`: as telas que mostram banner (página
 * da arena, tela inicial, página da campanha) importam só isto, e não o
 * arquivo inteiro dos módulos de arena.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  getArenaBannerTemplates, getCampaign, listArenaCampaignBanners, listHomeCampaignBanners,
  publishCampaign, saveArenaBannerTemplates, updateCampaignBanner,
} from '../services/campaignBannerService.js';

export const campaignKeys = Object.freeze({
  /** A lista da arena (Central) — a mesma chave de `useArenaCampaigns`. */
  daArena: (arenaId) => ['arena-campaigns', arenaId],
  /** Os banners no ar na página da arena. */
  bannersDaArena: (arenaId) => ['arena-campaign-banners', arenaId],
  /** Os banners da tela inicial. */
  bannersDaHome: () => ['arena-campaign-banners-home'],
  /** Uma campanha. */
  campanha: (id) => ['arena-campaign', id],
  /** Os modelos de banner da arena. */
  modelos: (arenaId) => ['arena-banner-templates', arenaId],
});

function invalidarCampanhas(qc, arenaId, campaignId = null) {
  qc.invalidateQueries({ queryKey: campaignKeys.daArena(arenaId) });
  qc.invalidateQueries({ queryKey: campaignKeys.bannersDaArena(arenaId) });
  qc.invalidateQueries({ queryKey: campaignKeys.bannersDaHome() });
  if (campaignId) qc.invalidateQueries({ queryKey: campaignKeys.campanha(campaignId) });
}

/** Os banners de campanha da página da arena (`null` = não consultar). */
export function useArenaCampaignBanners(arenaId) {
  return useQuery({
    queryKey: campaignKeys.bannersDaArena(arenaId),
    queryFn: () => listArenaCampaignBanners(arenaId),
    enabled: !!arenaId,
    staleTime: 2 * 60_000,
  });
}

/** Os banners de campanha da tela inicial (`enabled` = chave-mestra ligada). */
export function useHomeCampaignBanners({ enabled = true } = {}) {
  return useQuery({
    queryKey: campaignKeys.bannersDaHome(),
    queryFn: () => listHomeCampaignBanners(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Uma campanha (a página "saiba mais"). */
export function useCampaign(campaignId) {
  return useQuery({
    queryKey: campaignKeys.campanha(campaignId),
    queryFn: () => getCampaign(campaignId),
    enabled: !!campaignId,
    staleTime: 60_000,
  });
}

/** Publicar uma campanha (banner e/ou aviso). */
export function usePublishCampaign() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input, recipients }) => publishCampaign(arenaId, input, recipients, user),
    onSuccess: (_d, { arenaId }) => invalidarCampanhas(qc, arenaId),
  });
}

/** Editar, pausar ou retomar o banner de uma campanha. */
export function useUpdateCampaignBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, patch }) => updateCampaignBanner(campaignId, patch, user),
    onSuccess: (_d, { arenaId, campaignId }) => invalidarCampanhas(qc, arenaId, campaignId),
  });
}

/** Os modelos de banner da arena. */
export function useArenaBannerTemplates(arenaId) {
  return useQuery({
    queryKey: campaignKeys.modelos(arenaId),
    queryFn: () => getArenaBannerTemplates(arenaId),
    enabled: !!arenaId,
    staleTime: 5 * 60_000,
  });
}

/** Gravar a lista de modelos da arena. */
export function useSaveArenaBannerTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, list }) => saveArenaBannerTemplates(arenaId, list, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: campaignKeys.modelos(arenaId) }),
  });
}
