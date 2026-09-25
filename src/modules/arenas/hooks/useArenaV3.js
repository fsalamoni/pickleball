/**
 * Hooks React Query para Arena V3.
 *
 * - useArenaSettings(arenaId) — settings da arena
 * - useArenaModuleStates(arenaId) — mapa de module states
 * - useArenaModuleState(arenaId, moduleId) — estado de um módulo
 * - useCanArenaUseModule(arenaId, moduleId) — gate (true/false)
 * - useToggleArenaModule — mutation
 * - useUpdateArenaSettings — mutation
 */

import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArenaModuleOn } from './useArenaModules.js';
import { arenaKeys } from './arenaKeys.js';
import {
  getOrCreateArenaSettings,
  getArenaSettings,
  updateArenaSettings,
} from '../services/v3SettingsService.js';
import {
  setArenaModuleState,
  toggleArenaModule,
  getArenaModuleState,
} from '../services/moduleStateService.js';
import {
  listArenaOpenSlots,
  listOpenSlotsGlobal,
  getOpenSlot,
  createOpenSlot,
  updateOpenSlot,
  cancelOpenSlot,
  joinOpenSlot,
  leaveOpenSlot,
  deleteOpenSlot,
  listMyOpenSlots,
} from '../services/openMatchService.js';
import {
  joinWaitlist,
  leaveWaitlist,
  listSlotWaitlist,
  listUserWaitlist,
  listArenaWaitlist,
  getUserWaitlistEntry,
  notifyNextInLine,
  acceptWaitlistPromotion,
  declineWaitlistPromotion,
} from '../services/waitlistService.js';

/* ----------------------------- Settings ----------------------------- */

export function useArenaSettings(arenaId, { createIfMissing = false } = {}) {
  return useQuery({
    queryKey: ['arena-settings', arenaId],
    queryFn: () => createIfMissing ? getOrCreateArenaSettings(arenaId) : getArenaSettings(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useUpdateArenaSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, updates }) => updateArenaSettings(arenaId, updates, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-settings', arenaId] });
    },
  });
}

/* ------------------------- Module States --------------------------- */

// A consulta dos estados por arena tem UMA definição só, em `useArenaModules`.
// Duas definições com a mesma chave é o caminho conhecido para o cache deixar
// de se encontrar: a chave diverge um dia e o sintoma não é erro, é buscar de
// novo o que já estava em mãos. Aqui só reexportamos.
export { useArenaModuleStates } from './useArenaModules.js';

export function useArenaModuleState(arenaId, moduleId) {
  return useQuery({
    queryKey: ['arena-module-state', arenaId, moduleId],
    queryFn: () => getArenaModuleState(arenaId, moduleId),
    enabled: !!arenaId && !!moduleId,
    staleTime: 30_000,
  });
}

/**
 * Hook gate: a arena pode usar este módulo?
 *
 * Delega para `useArenaModules`, que resolve as TRÊS camadas de uma vez
 * (chave-mestra → liberação da plataforma → opt-in da arena, mais família e
 * dependências). Fica aqui só como atalho para as telas antigas — quem for
 * escrever tela nova use `useArenaModules` direto, ou `<ArenaModuleGuard>`.
 *
 * Custa as mesmas duas consultas de sempre: o React Query compartilha o cache
 * entre todas as chamadas da mesma arena.
 */
export function useCanArenaUseModule(arenaId, moduleId) {
  return useArenaModuleOn(arenaId, moduleId);
}

/* --------------------------- Mutations ----------------------------- */

export function useSetArenaModuleState() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, moduleId, enabled, config }) =>
      setArenaModuleState(arenaId, moduleId, enabled, config, user),
    onSuccess: (_d, { arenaId, moduleId }) => {
      qc.invalidateQueries({ queryKey: ['arena-module-states', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-module-state', arenaId, moduleId] });
    },
  });
}

export function useToggleArenaModule() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, moduleId }) => toggleArenaModule(arenaId, moduleId, user),
    onSuccess: (_d, { arenaId, moduleId }) => {
      qc.invalidateQueries({ queryKey: ['arena-module-states', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-module-state', arenaId, moduleId] });
    },
  });
}

/* ----------------------------- Open Match ----------------------------- */

export function useArenaOpenSlots(arenaId, filters = {}) {
  return useQuery({
    queryKey: ['arena-open-slots', arenaId, filters],
    queryFn: () => listArenaOpenSlots(arenaId, filters),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useGlobalOpenSlots(filters = {}) {
  return useQuery({
    queryKey: ['open-slots-global', filters],
    queryFn: () => listOpenSlotsGlobal(filters),
    staleTime: 30_000,
  });
}

export function useOpenSlot(slotId) {
  return useQuery({
    queryKey: ['open-slot', slotId],
    queryFn: () => getOpenSlot(slotId),
    enabled: !!slotId,
    staleTime: 15_000,
  });
}

/**
 * Uma vaga que muda mexe em mais coisa do que a lista de vagas: o CALENDÁRIO
 * deriva bloqueio dela (a vaga ocupa a quadra), e a fila de espera aponta para
 * ela. Invalidar por prefixo é o que mantém as três telas concordando.
 */
function invalidarVagas(qc) {
  qc.invalidateQueries({ queryKey: ['arena-open-slots'] });
  qc.invalidateQueries({ queryKey: ['open-slots-global'] });
  qc.invalidateQueries({ queryKey: ['slot-waitlist'] });
  qc.invalidateQueries({ queryKey: ['user-waitlist'] });
  qc.invalidateQueries({ queryKey: ['my-open-slots'] });
  qc.invalidateQueries({ queryKey: ['arena-waitlist'] });
}

/** Os jogos abertos em que eu estou, de todas as arenas (Minhas reservas). */
export function useMyOpenSlots() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-open-slots', user?.uid],
    queryFn: () => listMyOpenSlots(user?.uid),
    enabled: !!user?.uid,
    staleTime: 30_000,
  });
}

/**
 * Várias vagas pelo id — as das minhas entradas de fila, que não aparecem em
 * "meus jogos" (ainda não estou dentro). Mesma chave de `useOpenSlot`: a vaga
 * que outra tela já buscou não é buscada de novo.
 * @returns {{ slots: object[], isLoading: boolean }}
 */
export function useOpenSlotsByIds(ids = []) {
  const unicos = [...new Set((ids || []).filter(Boolean))];
  const results = useQueries({
    queries: unicos.map((id) => ({
      queryKey: ['open-slot', id],
      queryFn: () => getOpenSlot(id),
      staleTime: 30_000,
    })),
  });
  return {
    slots: results.map((r) => r.data).filter(Boolean),
    isLoading: results.some((r) => r.isLoading),
  };
}

/** A fila de todas as vagas de uma arena (Central). */
export function useArenaWaitlist(arenaId, enabled = true) {
  return useQuery({
    queryKey: ['arena-waitlist', arenaId],
    queryFn: () => listArenaWaitlist(arenaId),
    enabled: !!arenaId && enabled,
    staleTime: 30_000,
  });
}

export function useCreateOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createOpenSlot(arenaId, input, user),
    onSuccess: () => invalidarVagas(qc),
  });
}

export function useUpdateOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, updates }) => updateOpenSlot(slotId, updates, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-open-slots', arenaId] });
    },
  });
}

export function useCancelOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, reason }) => cancelOpenSlot(slotId, reason, user),
    // Invalida pelo PREFIXO: a arena nem sempre vem nas variáveis, e uma vaga
    // que muda mexe também no calendário (que deriva bloqueio dela).
    onSuccess: () => invalidarVagas(qc),
  });
}

export function useJoinOpenSlot() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => joinOpenSlot(slotId, user, userProfile),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['open-slot', slotId] });
      invalidarVagas(qc);
    },
  });
}

export function useLeaveOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => leaveOpenSlot(slotId, user?.uid),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['open-slot', slotId] });
      invalidarVagas(qc);
    },
  });
}

export function useDeleteOpenSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => deleteOpenSlot(slotId, user),
    onSuccess: () => invalidarVagas(qc),
  });
}

/* ------------------------------- Waitlist ----------------------------- */

export function useSlotWaitlist(slotId) {
  return useQuery({
    queryKey: ['slot-waitlist', slotId],
    queryFn: () => listSlotWaitlist(slotId),
    enabled: !!slotId,
    staleTime: 15_000,
  });
}

export function useUserWaitlistEntry(slotId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-waitlist-entry', slotId, user?.uid],
    queryFn: () => getUserWaitlistEntry(user?.uid, slotId),
    enabled: !!user?.uid && !!slotId,
    staleTime: 15_000,
  });
}

export function useUserWaitlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-waitlist', user?.uid],
    queryFn: () => listUserWaitlist(user?.uid),
    enabled: !!user?.uid,
    staleTime: 30_000,
  });
}

export function useJoinWaitlist() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => joinWaitlist(slotId, user, userProfile),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['user-waitlist-entry', slotId] });
      invalidarVagas(qc);
    },
  });
}

export function useLeaveWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => leaveWaitlist(slotId, user?.uid, user),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['user-waitlist-entry', slotId] });
      invalidarVagas(qc);
    },
  });
}

export function useAcceptWaitlist() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => acceptWaitlistPromotion(slotId, user, userProfile),
    onSuccess: (_d, slotId) => {
      qc.invalidateQueries({ queryKey: ['open-slot', slotId] });
      invalidarVagas(qc);
    },
  });
}

export function useDeclineWaitlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => declineWaitlistPromotion(slotId, user, user),
    onSuccess: () => invalidarVagas(qc),
  });
}

/* ------------------------ Members (sprint 2) ------------------------ */

import {
  listArenaMembers, getArenaMember, addArenaMember, removeArenaMember,
  addPointsToMember, listArenaPackages, createArenaPackage, updateArenaPackage,
  deleteArenaPackage, purchasePackage, getArenaWallet, creditWallet, applyCashback,
  requestPackagePurchase, sellPackageToMember, listArenaWallets,
  redeemMemberPoints,
  listArenaSubscriptions, getMemberSubscription, setMemberSubscription,
  setSubscriptionMonthPaid, cancelMemberSubscription,
  listMyArenaMemberships, listMyArenaWallets, listMyArenaSubscriptions,
} from '../services/membersService.js';
import { groupMyArenaPlans } from '../domain/myArenaPlans.js';
import { combinarConsultas } from '@/core/lib/queryState';

/**
 * O que é MEU em todas as arenas — membro, carteira e mensalidade — numa
 * linha por arena (`groupMyArenaPlans`). Três consultas por `user_id`, o campo
 * que a regra confere; nenhuma escrita.
 *
 * `data` só existe quando as TRÊS responderam: meia resposta mostraria, por
 * exemplo, o nível sem as horas — e a pessoa concluiria que o pacote sumiu.
 */
const PLANOS_VAZIOS = [];
export function useMyArenaPlans() {
  const { user } = useAuth();
  const uid = user?.uid;
  const opcoes = (tipo, fn) => ({
    queryKey: ['arena-plans-mine', tipo, uid],
    queryFn: () => fn(uid),
    enabled: !!uid,
    staleTime: 30_000,
  });
  const membros = useQuery(opcoes('membros', listMyArenaMemberships));
  const carteiras = useQuery(opcoes('carteiras', listMyArenaWallets));
  const mensalidades = useQuery(opcoes('mensalidades', listMyArenaSubscriptions));
  const estado = combinarConsultas([membros, carteiras, mensalidades]);
  const prontas = Boolean(membros.data && carteiras.data && mensalidades.data);
  const data = useMemo(() => (prontas
    ? groupMyArenaPlans({ members: membros.data, wallets: carteiras.data, subscriptions: mensalidades.data })
    : undefined), [prontas, membros.data, carteiras.data, mensalidades.data]);
  return {
    data: uid ? data : PLANOS_VAZIOS,
    isLoading: estado.carregando,
    isError: estado.falhou,
    refetch: estado.recarregar,
  };
}

export function useArenaMembers(arenaId) {
  return useQuery({
    queryKey: ['arena-members', arenaId],
    queryFn: () => listArenaMembers(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useArenaMember(arenaId, userId) {
  return useQuery({
    queryKey: ['arena-member', arenaId, userId],
    queryFn: () => getArenaMember(arenaId, userId),
    enabled: !!arenaId && !!userId,
    staleTime: 30_000,
  });
}

export function useAddArenaMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, target }) => addArenaMember(arenaId, target, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-members', arenaId] });
    },
  });
}

export function useRemoveArenaMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId }) => removeArenaMember(arenaId, userId, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-members', arenaId] });
    },
  });
}

/**
 * O catálogo de pacotes da arena.
 *
 * `onlyActive` faz parte da CHAVE: a vitrine do atleta vê só os ativos e a
 * gestão vê todos, e as duas listas não podem se sobrepor no cache — senão a
 * arena abre a gestão e vê a lista do atleta (ou pior, o contrário).
 */
export function useArenaPackages(arenaId, { onlyActive = true } = {}) {
  return useQuery({
    queryKey: ['arena-packages', arenaId, onlyActive],
    queryFn: () => listArenaPackages(arenaId, { onlyActive }),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useCreatePackage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaPackage(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-packages', arenaId] }),
  });
}

export function useDeletePackage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pkgId }) => deleteArenaPackage(pkgId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-packages'] }),
  });
}

export function usePurchasePackage() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, pkgId }) => purchasePackage(arenaId, pkgId, user, userProfile),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-packages', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-wallet', arenaId, user?.uid] });
      qc.invalidateQueries({ queryKey: ['arena-member', arenaId, user?.uid] });
    },
  });
}

/** Todas as carteiras da arena (métricas). `null` = não consulta. */
export function useArenaWallets(arenaId) {
  return useQuery({
    queryKey: ['arena-wallets', arenaId],
    queryFn: () => listArenaWallets(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

/**
 * O atleta PEDE um pacote — a arena é avisada e confirma quando receber.
 *
 * Substitui `usePurchasePackage` nas telas do atleta: aquela gravava a
 * carteira pelo atleta, e a regra (com razão) recusa.
 */
export function useRequestPackage() {
  const { user, userProfile } = useAuth();
  return useMutation({
    mutationFn: ({ arenaId, pkgId }) => requestPackagePurchase(arenaId, pkgId, user, userProfile),
  });
}

/** A ARENA vende o pacote (pedido confirmado ou venda de balcão). */
export function useSellPackageToMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, pkgId, target }) => sellPackageToMember(arenaId, pkgId, target, user),
    onSuccess: (_d, { arenaId, target }) => {
      invalidarMembro(qc, arenaId, target?.user_id);
      qc.invalidateQueries({ queryKey: ['arena-packages', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-wallets', arenaId] });
    },
  });
}

/**
 * Ajusta os pontos de um membro (a arena corrige ou premia à mão).
 * Invalida a relação inteira: nível, pacotes e carteira andam juntos.
 */
export function useAddPointsToMember() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId, points }) => addPointsToMember(arenaId, userId, points, user),
    onSuccess: (_d, { arenaId, userId }) => invalidarMembro(qc, arenaId, userId),
  });
}

/** Credita saldo na carteira do membro (cortesia, estorno, prêmio). */
export function useCreditWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId, amount, source }) => creditWallet(arenaId, userId, amount, source, user),
    onSuccess: (_d, { arenaId, userId }) => invalidarMembro(qc, arenaId, userId),
  });
}

/**
 * Troca pontos do membro por crédito em carteira.
 *
 * A ação é da ARENA (a regra do Firestore só deixa o gestor escrever pontos e
 * carteira). Na tela do atleta o resgate aparece como valor, não como botão.
 */
export function useRedeemMemberPoints() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId, points, pointsPerReal }) => (
      redeemMemberPoints(arenaId, userId, points, { pointsPerReal }, user)
    ),
    onSuccess: (_d, { arenaId, userId }) => invalidarMembro(qc, arenaId, userId),
  });
}

/** Tudo o que muda quando a relação de um membro muda. */
function invalidarMembro(qc, arenaId, userId) {
  qc.invalidateQueries({ queryKey: ['arena-members', arenaId] });
  qc.invalidateQueries({ queryKey: ['arena-member', arenaId, userId] });
  qc.invalidateQueries({ queryKey: ['arena-wallet', arenaId, userId] });
}

/* ----------------------------- Mensalidade ---------------------------- */

/** Todas as mensalidades da arena (visão da gestão). */
export function useArenaSubscriptions(arenaId) {
  return useQuery({
    queryKey: ['arena-subscriptions', arenaId],
    queryFn: () => listArenaSubscriptions(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

/** A MINHA mensalidade nesta arena. */
export function useMemberSubscription(arenaId, userId) {
  return useQuery({
    queryKey: ['arena-subscription', arenaId, userId],
    queryFn: () => getMemberSubscription(arenaId, userId),
    enabled: !!arenaId && !!userId,
    staleTime: 60_000,
  });
}

function invalidarMensalidade(qc, arenaId, userId) {
  qc.invalidateQueries({ queryKey: ['arena-subscriptions', arenaId] });
  qc.invalidateQueries({ queryKey: ['arena-subscription', arenaId, userId] });
}

export function useSetMemberSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId, input }) => setMemberSubscription(arenaId, userId, input, user),
    onSuccess: (_d, { arenaId, userId }) => invalidarMensalidade(qc, arenaId, userId),
  });
}

export function useSetSubscriptionMonthPaid() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId, month, paid }) => setSubscriptionMonthPaid(arenaId, userId, month, paid, user),
    onSuccess: (_d, { arenaId, userId }) => invalidarMensalidade(qc, arenaId, userId),
  });
}

export function useCancelMemberSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, userId }) => cancelMemberSubscription(arenaId, userId, user),
    onSuccess: (_d, { arenaId, userId }) => invalidarMensalidade(qc, arenaId, userId),
  });
}

export function useArenaWallet(arenaId, userId) {
  return useQuery({
    queryKey: ['arena-wallet', arenaId, userId],
    queryFn: () => getArenaWallet(arenaId, userId),
    enabled: !!arenaId && !!userId,
    staleTime: 30_000,
  });
}

/* ---------------------- PDV (sprint 3) ---------------------- */

import {
  listShopProducts, syncShopStock,
  createSale, listArenaSales, listMyShopSales, listMyPayments,
  listArenaPayments, confirmPayment, receiveShareAtCounter,
  confirmSale, cancelSale, cancelMyOrder, payMyShare,
} from '../services/pdvService.js';

/**
 * A vitrine da loja do app — os produtos do MERCADO marcados "Vender pelo
 * app". Exige login (a regra só deixa conta autenticada ler o Mercado).
 */
export function useShopProducts(arenaId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['shop-products', arenaId],
    queryFn: () => listShopProducts(arenaId),
    enabled: !!arenaId && !!user?.uid,
    staleTime: 60_000,
  });
}

/**
 * A arena acerta a cópia do estoque que a loja lê. Rede de segurança: cada
 * entrada e saída do Mercado já a atualiza.
 */
export function useSyncShopStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId }) => syncShopStock(arenaId),
    onSuccess: (acertados, { arenaId }) => {
      if (acertados > 0) {
        qc.invalidateQueries({ queryKey: ['shop-products', arenaId] });
        qc.invalidateQueries({ queryKey: ['inventory-products', arenaId] });
      }
    },
  });
}

export function useCreateSale() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, items, paymentMethod, splitWith }) =>
      createSale(arenaId, items, paymentMethod, splitWith, user, userProfile),
    onSuccess: (_d, { arenaId }) => invalidarLoja(qc, arenaId),
  });
}

export function useArenaSales(arenaId) {
  return useQuery({
    queryKey: ['arena-sales', arenaId],
    queryFn: () => listArenaSales(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useConfirmPayment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId }) => confirmPayment(paymentId, user),
    onSuccess: (_d, { arenaId }) => invalidarLoja(qc, arenaId),
  });
}

/** A arena recebe no balcão a parte de quem ainda não a registrou pelo app. */
export function useReceiveShareAtCounter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, payerId }) => receiveShareAtCounter(saleId, payerId, user),
    onSuccess: (_d, { arenaId }) => invalidarLoja(qc, arenaId),
  });
}

export function useArenaPayments(arenaId) {
  return useQuery({
    queryKey: ['arena-payments', arenaId],
    queryFn: () => listArenaPayments(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

/**
 * TODAS as minhas compras, em todas as arenas — as que fiz e as que dividem
 * a conta comigo.
 */
export function useMyShopSales() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-sales', 'minhas', user?.uid],
    queryFn: () => listMyShopSales(user?.uid),
    enabled: !!user?.uid,
    staleTime: 30_000,
  });
}

/** As MINHAS compras nesta arena (inclusive as divididas comigo). */
export function useMySales(arenaId) {
  const q = useMyShopSales();
  return { ...q, data: q.data ? q.data.filter((v) => v.arena_id === arenaId) : q.data };
}

/** Os meus pagamentos — para saber de que conta já registrei a minha parte. */
export function useMyPayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-payments', 'minhas', user?.uid],
    queryFn: () => listMyPayments(user?.uid),
    enabled: !!user?.uid,
    staleTime: 30_000,
  });
}

/**
 * A arena ENTREGA a compra — e é aqui que o estoque sai.
 *
 * Na compra o estoque não baixa: a regra do Firestore não deixa o atleta
 * escrever o estoque, e reservar o que ainda não foi entregue conta uma venda
 * que pode não acontecer. No pedido do app, a entrega vira saída do Mercado.
 */
export function useConfirmSale() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId }) => confirmSale(saleId, user),
    onSuccess: (_d, { arenaId }) => invalidarLoja(qc, arenaId),
  });
}

export function useCancelSale() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, motivo }) => cancelSale(saleId, motivo, user),
    onSuccess: (_d, { arenaId }) => invalidarLoja(qc, arenaId),
  });
}

/** Quem pediu desiste — enquanto não foi entregue e não é dividido. */
export function useCancelMyOrder() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId }) => cancelMyOrder(saleId, user, userProfile),
    onSuccess: (_d, { arenaId }) => invalidarLoja(qc, arenaId),
  });
}

/** Pago a MINHA parte de uma conta dividida — cada um grava o próprio. */
export function usePayMyShare() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId }) => payMyShare(saleId, user),
    onSuccess: (_d, { arenaId }) => invalidarLoja(qc, arenaId),
  });
}

/**
 * Tudo o que muda quando a loja se mexe — inclusive o MERCADO, porque a
 * entrega de um pedido do app vira saída de estoque lá.
 */
function invalidarLoja(qc, arenaId) {
  qc.invalidateQueries({ queryKey: ['shop-products', arenaId] });
  qc.invalidateQueries({ queryKey: ['arena-sales'] });
  qc.invalidateQueries({ queryKey: ['arena-payments'] });
  qc.invalidateQueries({ queryKey: ['inventory-products', arenaId] });
  qc.invalidateQueries({ queryKey: ['inventory-exits', arenaId] });
}

/* -------------------- Classes (sprint 4) -------------------- */

import {
  listArenaCoaches, createArenaCoach, deleteArenaCoach, updateArenaCoach,
  listArenaClasses, createArenaClass, bookClass,
  updateArenaClass, cancelArenaClass, deleteArenaClass, completeArenaClass,
  listClassBookings, listMyClassBookings, cancelClassBooking, setClassBookingPaid,
  listCoachProfiles, listCoachClasses, listCoachClassBookings, listArenaClassBookings,
  listMyClassEnrollments, listMyTaughtClasses,
} from '../services/classesService.js';

/**
 * Os professores da arena.
 *
 * `onlyActive: false` é o que a tela de GESTÃO precisa: sem isso o professor
 * desativado some da lista e a arena não consegue mais reativá-lo.
 */
export function useArenaCoaches(arenaId, { onlyActive = true } = {}) {
  return useQuery({
    queryKey: ['arena-coaches', arenaId, onlyActive],
    queryFn: () => listArenaCoaches(arenaId, { onlyActive }),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useCreateCoach() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaCoach(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-coaches', arenaId] });
      // Cadastro com conta vinculada faz daquela pessoa professora da arena.
      qc.invalidateQueries({ queryKey: ['my-coach-profiles'] });
    },
  });
}

export function useArenaClasses(arenaId, filters = {}) {
  return useQuery({
    queryKey: ['arena-classes', arenaId, filters],
    queryFn: () => listArenaClasses(arenaId, filters),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useCreateClass() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaClass(arenaId, input, user),
    // A aula OCUPA a quadra: invalidar só a lista de aulas deixaria o
    // calendário oferecendo o horário que acabou de ser tomado.
    onSuccess: (_d, { arenaId }) => invalidarAulas(qc, arenaId),
  });
}

/**
 * Matricula na aula.
 *
 * A divisão (comissão e se o professor é parceiro) é decidida pelo SERVIÇO,
 * com o que está no banco — a tela não manda mais esses números. Ela mandava
 * `partner: true` fixo, e o professor da casa pagava comissão à própria arena.
 */
export function useBookClass() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId }) => bookClass(classId, user, userProfile),
    onSuccess: (_d, { arenaId }) => invalidarAulas(qc, arenaId),
  });
}

/* ------------- Aulas: o que faltava (matrícula, edição, professor) ------- */

/** Tudo o que muda quando uma aula ou uma matrícula muda. */
function invalidarAulas(qc, arenaId) {
  qc.invalidateQueries({ queryKey: ['arena-classes', arenaId] });
  qc.invalidateQueries({ queryKey: ['arena-class-bookings'] });
  qc.invalidateQueries({ queryKey: ['coach-classes'] });
  qc.invalidateQueries({ queryKey: ['my-class-enrollments'] });
  qc.invalidateQueries({ queryKey: ['my-taught-classes'] });
  // A aula OCUPA a quadra: sem isto o calendário segue oferecendo o horário.
  qc.invalidateQueries({ queryKey: arenaKeys.bloqueiosDaArena(arenaId) });
}

export function useUpdateArenaClass() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, input }) => updateArenaClass(classId, input, user),
    onSuccess: (_d, { arenaId }) => invalidarAulas(qc, arenaId),
  });
}

export function useCancelArenaClass() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, motivo }) => cancelArenaClass(classId, motivo, user),
    onSuccess: (_d, { arenaId }) => invalidarAulas(qc, arenaId),
  });
}

export function useDeleteArenaClass() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId }) => deleteArenaClass(classId, user),
    onSuccess: (_d, { arenaId }) => invalidarAulas(qc, arenaId),
  });
}

export function useCompleteArenaClass() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId }) => completeArenaClass(classId, user),
    onSuccess: (_d, { arenaId }) => invalidarAulas(qc, arenaId),
  });
}

export function useUpdateArenaCoach() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }) => updateArenaCoach(coachId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-coaches', arenaId] }),
  });
}

/**
 * As matrículas de uma aula — a leitura da ARENA.
 *
 * Precisa do `arenaId`: é por ele que a regra deixa a arena ler (ver
 * `listClassBookings`). O professor usa `useCoachClassBookings`.
 */
export function useClassBookings(classId, arenaId) {
  return useQuery({
    queryKey: ['arena-class-bookings', classId, arenaId],
    queryFn: () => listClassBookings(classId, arenaId),
    enabled: !!classId && !!arenaId,
    staleTime: 30_000,
  });
}

/** As MINHAS aulas nesta arena. */
export function useMyClassBookings(arenaId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-class-bookings', 'minhas', arenaId, user?.uid],
    queryFn: () => listMyClassBookings(arenaId, user?.uid),
    enabled: !!arenaId && !!user?.uid,
    staleTime: 30_000,
  });
}

export function useCancelClassBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId }) => cancelClassBooking(bookingId, user),
    onSuccess: (_d, { arenaId }) => invalidarAulas(qc, arenaId),
  });
}

export function useSetClassBookingPaid() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, paid }) => setClassBookingPaid(bookingId, paid, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-class-bookings'] }),
  });
}

/** Sou professor cadastrado em alguma arena? Em quais? */
export function useMyCoachProfiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-coach-profiles', user?.uid],
    queryFn: () => listCoachProfiles(user?.uid),
    enabled: !!user?.uid,
    staleTime: 5 * 60_000,
  });
}

/**
 * As matrículas das aulas de UM professor — é o que o professor consegue ler.
 *
 * Não use `useClassBookings` para o professor: aquela consulta filtra por
 * aula, e a regra só deixa o professor ler filtrando por `coach_id`.
 */
export function useCoachClassBookings(coachId) {
  return useQuery({
    queryKey: ['arena-class-bookings', 'professor', coachId],
    queryFn: () => listCoachClassBookings(coachId),
    enabled: !!coachId,
    staleTime: 30_000,
  });
}

/** Todas as matrículas da arena (métricas). `null` = não consulta. */
export function useArenaClassBookingsAll(arenaId) {
  return useQuery({
    queryKey: ['arena-class-bookings', 'arena', arenaId],
    queryFn: () => listArenaClassBookings(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

/** As minhas matrículas em aula, em todas as arenas ("Minhas aulas"). */
export function useMyClassEnrollments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-class-enrollments', user?.uid],
    queryFn: () => listMyClassEnrollments(user?.uid),
    enabled: !!user?.uid,
    staleTime: 60_000,
  });
}

/** As aulas que eu DOU, em todas as arenas (agenda do professor). */
export function useMyTaughtClasses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-taught-classes', user?.uid],
    queryFn: () => listMyTaughtClasses(user?.uid),
    enabled: !!user?.uid,
    staleTime: 60_000,
  });
}

/** A agenda de UM professor numa arena, incluindo as aulas passadas. */
export function useCoachClasses(arenaId, coachId) {
  return useQuery({
    queryKey: ['coach-classes', arenaId, coachId],
    queryFn: () => listCoachClasses(arenaId, coachId),
    enabled: !!arenaId && !!coachId,
    staleTime: 30_000,
  });
}

/* -------------------- Leagues (sprint 5) -------------------- */

import {
  listArenaTournaments, createInternalTournament, joinTournament, getLadder,
  leaveTournament, updateInternalTournament, cancelInternalTournament,
  deleteInternalTournament, startInternalTournament, finishInternalTournament,
  listMyInternalTournaments,
} from '../services/leaguesService.js';

/**
 * Os torneios DA CASA da arena (`arena_internal_tournaments`).
 *
 * Não confundir com `useArenaTournaments` de `tournament/hooks`, que lista os
 * torneios DA PLATAFORMA sediados na arena — outra coleção.
 */
export function useArenaInternalTournaments(arenaId, filters = {}) {
  return useQuery({
    queryKey: arenaKeys.torneiosDaCasa(arenaId, filters),
    queryFn: () => listArenaTournaments(arenaId, filters),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

/**
 * @deprecated Nome antigo — colide com `useArenaTournaments` de
 * `tournament/hooks` (torneios da PLATAFORMA). Use `useArenaInternalTournaments`.
 */
export const useArenaTournaments = useArenaInternalTournaments;

/** Os torneios da casa em que EU estou inscrito, em todas as arenas. */
export function useMyInternalTournaments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-internal-tournaments', user?.uid],
    queryFn: () => listMyInternalTournaments(user?.uid),
    enabled: !!user?.uid,
    staleTime: 60_000,
  });
}

export function useCreateTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createInternalTournament(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => invalidarTorneios(qc, arenaId),
  });
}

/**
 * Tudo o que muda quando um torneio muda.
 *
 * O torneio OCUPA a quadra: sem invalidar o calendário, a arena acabaria de
 * marcar um torneio e continuaria vendo o horário à venda.
 */
function invalidarTorneios(qc, arenaId) {
  qc.invalidateQueries({ queryKey: arenaKeys.torneiosDaCasaDaArena(arenaId) });
  qc.invalidateQueries({ queryKey: ['arena-ladder', arenaId] });
  qc.invalidateQueries({ queryKey: ['my-internal-tournaments'] });
  qc.invalidateQueries({ queryKey: arenaKeys.bloqueiosDaArena(arenaId) });
  qc.invalidateQueries({ queryKey: arenaKeys.reservas(arenaId) });
}

export function useJoinTournament() {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tid }) => joinTournament(tid, user, userProfile),
    onSuccess: (_d, { arenaId }) => invalidarTorneios(qc, arenaId),
  });
}

/** Sair do torneio — não existia: só dava para entrar. */
export function useLeaveTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tid }) => leaveTournament(tid, user),
    onSuccess: (_d, { arenaId }) => invalidarTorneios(qc, arenaId),
  });
}

export function useUpdateTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tid, input }) => updateInternalTournament(tid, input, user),
    onSuccess: (_d, { arenaId }) => invalidarTorneios(qc, arenaId),
  });
}

export function useCancelTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tid, motivo }) => cancelInternalTournament(tid, motivo, user),
    onSuccess: (_d, { arenaId }) => invalidarTorneios(qc, arenaId),
  });
}

export function useDeleteTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tid }) => deleteInternalTournament(tid, user),
    onSuccess: (_d, { arenaId }) => invalidarTorneios(qc, arenaId),
  });
}

/**
 * Começa o torneio: cria o dia de jogo da arena com os inscritos.
 *
 * É aqui que o torneio deixa de ser uma lista de nomes — a partir daí tudo o
 * que a plataforma já sabe fazer (sorteio equilibrado, Americano, placar,
 * ranking do dia, telão) passa a valer, sem código novo.
 */
export function useStartTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tournament, arena, courts }) => (
      startInternalTournament(tournament, { arena, courts }, user)
    ),
    onSuccess: (_d, { arenaId }) => {
      invalidarTorneios(qc, arenaId);
      qc.invalidateQueries({ queryKey: ['arena-game-days', arenaId] });
    },
  });
}

/** Encerra o torneio e soma o resultado ao ladder da arena. */
export function useFinishTournament() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tournament, classificacao, period }) => (
      finishInternalTournament(tournament, classificacao, { period }, user)
    ),
    onSuccess: (_d, { arenaId }) => invalidarTorneios(qc, arenaId),
  });
}

/** A classificação acumulada da casa. */
export function useArenaLadder(arenaId, period = 'geral') {
  return useQuery({
    queryKey: arenaKeys.ladder(arenaId, period),
    queryFn: () => getLadder(arenaId, period),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

/* -------------------- Marketing (sprint 6) -------------------- */

import { applyBookingReferral } from '../services/bookingReferralService.js';

import {
  listArenaCoupons, createArenaCoupon,
  listArenaCampaigns, createCampaign,
  submitNps, getArenaNpsResponses, getArenaNpsSummary,
  sendCampaign, listMyNpsAnswers, getOrCreateReferralCode, getMyReferralCode, redeemReferral,
  updateArenaCoupon, setCouponActive, deleteArenaCoupon,
  setCouponUnitCost, redeemVoucher, findArenaCouponByCode, listArenaReferrals, listMyReferralCodes,
} from '../services/marketingService.js';

export function useArenaCoupons(arenaId) {
  return useQuery({
    queryKey: ['arena-coupons', arenaId],
    queryFn: () => listArenaCoupons(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useCreateCoupon() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createArenaCoupon(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-coupons', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-settings', arenaId] });
    },
  });
}

/**
 * TODOS os cupons da arena, inclusive os desligados.
 *
 * A tela de gestão precisa ver o que está desligado — senão a arena "some" com
 * o cupom sem querer e não acha mais para religar.
 */
export function useArenaCouponsAll(arenaId) {
  return useQuery({
    queryKey: ['arena-coupons', arenaId, 'todos'],
    queryFn: () => listArenaCoupons(arenaId, { onlyActive: false }),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useUpdateCoupon() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, couponId, input }) => updateArenaCoupon(couponId, input, user, { arenaId }),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-coupons', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-settings', arenaId] });
    },
  });
}

export function useSetCouponActive() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ couponId, active }) => setCouponActive(couponId, active, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-coupons', arenaId] }),
  });
}

export function useDeleteCoupon() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, couponId }) => deleteArenaCoupon(couponId, user, { arenaId }),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-coupons', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-settings', arenaId] });
    },
  });
}

/**
 * A arena registra o uso de um VALE na recepção. Invalida os cupons (a
 * contagem mudou) — o controle de uso lê a mesma lista.
 */
export function useRedeemVoucher() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, couponId, userId, userName }) => redeemVoucher(arenaId, couponId, { userId, userName }, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-coupons', arenaId] }),
  });
}

/** Procura um cupom da arena pelo código — a recepção digita o que o cliente mostra. */
export function useFindArenaCoupon() {
  return useMutation({
    mutationFn: ({ arenaId, code }) => findArenaCouponByCode(arenaId, code),
  });
}

/** O custo unitário de um vale (mora em `arena_settings`, que só o gestor lê). */
export function useSetCouponUnitCost() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, couponId, cost }) => setCouponUnitCost(arenaId, couponId, cost, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-settings', arenaId] }),
  });
}

/** Os códigos de indicação desta arena — para o controle de uso. */
export function useArenaReferrals(arenaId) {
  return useQuery({
    queryKey: ['arena-referral', arenaId, 'todos'],
    queryFn: () => listArenaReferrals(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useArenaCampaigns(arenaId) {
  return useQuery({
    queryKey: ['arena-campaigns', arenaId],
    queryFn: () => listArenaCampaigns(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useCreateCampaign() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createCampaign(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-campaigns', arenaId] }),
  });
}

export function useArenaNps(arenaId) {
  return useQuery({
    queryKey: ['arena-nps', arenaId],
    queryFn: async () => {
      const responses = await getArenaNpsResponses(arenaId);
      return getArenaNpsSummary(responses);
    },
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useSubmitNps() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, score, comment }) => submitNps(arenaId, user?.uid, score, comment),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-nps', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-nps-mine', arenaId, user?.uid] });
    },
  });
}

/**
 * As respostas de NPS, uma a uma — com o COMENTÁRIO.
 *
 * A nota resumida diz que algo está errado; o comentário diz o quê. Sem esta
 * lista o painel seria um número sem ação possível.
 */
export function useArenaNpsResponses(arenaId) {
  return useQuery({
    queryKey: ['arena-nps-responses', arenaId],
    queryFn: () => getArenaNpsResponses(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

/** As MINHAS respostas de NPS nesta arena — para não perguntar de novo. */
export function useMyNpsAnswers(arenaId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-nps-mine', arenaId, user?.uid],
    queryFn: () => listMyNpsAnswers(arenaId, user?.uid),
    enabled: !!arenaId && !!user?.uid,
    staleTime: 5 * 60_000,
  });
}

/**
 * Envia a campanha DE VERDADE (cria a notificação de cada destinatário).
 * O `useCreateCampaign` antigo continua existindo e só grava o rascunho.
 */
export function useSendCampaign() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input, recipients }) => sendCampaign(arenaId, input, recipients, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-campaigns', arenaId] }),
  });
}

/** O meu código de indicação nesta arena (cria na primeira vez). */
/**
 * O MEU código de indicação nesta arena — só LÊ (`null` = ainda não pedi).
 * Passe `null` como arena para não consultar (módulo desligado).
 */
export function useMyReferralCode(arenaId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-referral', arenaId, user?.uid],
    queryFn: () => getMyReferralCode(arenaId, user.uid),
    enabled: !!arenaId && !!user?.uid,
    staleTime: 10 * 60_000,
  });
}

/** Cria o meu código nesta arena (ou devolve o que já existe). */
export function useCreateMyReferralCode() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId }) => getOrCreateReferralCode(arenaId, user),
    onSuccess: (codigo, { arenaId }) => {
      qc.setQueryData(['arena-referral', arenaId, user?.uid], codigo);
      // O perfil lista os meus códigos de todas as arenas.
      qc.invalidateQueries({ queryKey: ['arena-referral-mine', user?.uid] });
    },
  });
}

/**
 * A arena registra AGORA a indicação que veio com uma reserva — a reserva
 * instantânea (nasce confirmada, sem passar pela confirmação) e a que ficou
 * pendente porque as regras não carregaram. Mesma conferência da confirmação.
 */
export function useApplyBookingReferral() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ booking }) => applyBookingReferral(booking, {}, user),
    onSuccess: (_d, { booking }) => {
      qc.invalidateQueries({ queryKey: arenaKeys.reservas(booking.arena_id) });
      qc.invalidateQueries({ queryKey: ['arena-referral', booking.arena_id] });
      qc.invalidateQueries({ queryKey: ['arena-wallet', booking.arena_id] });
    },
  });
}

/** Os MEUS códigos de indicação, de todas as arenas (perfil do atleta). */
export function useMyReferralCodes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-referral-mine', user?.uid],
    queryFn: () => listMyReferralCodes(user.uid),
    enabled: !!user?.uid,
    staleTime: 5 * 60_000,
  });
}

/** A arena registra a indicação e credita os dois lados. */
export function useRedeemReferral() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      arenaId, code, referredId, referredName, reward, referrerReward, referredReward, program,
    }) => {
      const r = await redeemReferral(
        arenaId, { code, referredId, referredName, reward, referrerReward, referredReward, program }, user,
      );
      // Cada lado recebe o que as regras do programa dizem — que podem ser
      // valores diferentes (antes era sempre o mesmo para os dois).
      if (r.referrerReward > 0) {
        await creditWallet(arenaId, r.referrerId, r.referrerReward, `indicou ${referredName || 'um amigo'}`, user);
      }
      if (r.referredReward > 0) {
        await creditWallet(arenaId, referredId, r.referredReward, 'veio por indicação', user);
      }
      return r;
    },
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: ['arena-wallet', arenaId] });
      qc.invalidateQueries({ queryKey: ['arena-referral', arenaId] });
    },
  });
}

/* -------------------- Operations (sprint 7) -------------------- */

import {
  listArenaChecklists, createChecklist, toggleChecklistItem,
  listArenaMaintenance, createMaintenance, updateMaintenanceStatus,
  updateChecklist, deleteChecklist, rollChecklistDay,
  updateMaintenance, deleteMaintenance,
  getArenaStaff, saveArenaStaff,
} from '../services/operationsService.js';

export function useArenaChecklists(arenaId, filters = {}) {
  return useQuery({
    queryKey: ['arena-checklists', arenaId, filters],
    queryFn: () => listArenaChecklists(arenaId, filters),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useCreateChecklist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createChecklist(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-checklists', arenaId] }),
  });
}

export function useToggleChecklistItem() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ checklistId, itemIdx }) => toggleChecklistItem(checklistId, itemIdx, user?.uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-checklists'] }),
  });
}

export function useArenaMaintenance(arenaId) {
  return useQuery({
    queryKey: ['arena-maintenance', arenaId],
    queryFn: () => listArenaMaintenance(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useCreateMaintenance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createMaintenance(arenaId, input, user),
    // A ordem pode ter FECHADO a quadra: sem invalidar o calendário, a arena
    // acabou de bloquear um horário e continua vendo-o à venda.
    onSuccess: (_d, { arenaId }) => invalidarManutencao(qc, arenaId),
  });
}

export function useUpdateMaintenanceStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }) => updateMaintenanceStatus(orderId, status, user),
    // Concluir devolve a quadra à venda — o calendário precisa saber.
    onSuccess: (_d, { arenaId }) => invalidarManutencao(qc, arenaId),
  });
}

/**
 * Começa o dia dos checklists recorrentes.
 *
 * A tela chama isto ao abrir. É o que faz o checkmark de ontem parar de valer
 * hoje — sem esta virada o checklist é uma lista de compras antiga, e a arena
 * não consegue responder "hoje a abertura foi feita?".
 *
 * Idempotente: chamar duas vezes no mesmo dia não apaga o que já foi marcado.
 */
export function useRollChecklistDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ arenaId, checklists, todayISO }) => {
      const viradas = [];
      for (const c of checklists || []) {
        // Em série de propósito: são poucos documentos e o paralelo aqui só
        // aumentaria a chance de bater no limite de escrita sem ganho nenhum.
        // eslint-disable-next-line no-await-in-loop
        if (await rollChecklistDay(c, todayISO)) viradas.push(c.id);
      }
      return { arenaId, viradas };
    },
    onSuccess: ({ arenaId, viradas }) => {
      if (viradas.length > 0) qc.invalidateQueries({ queryKey: ['arena-checklists', arenaId] });
    },
  });
}

export function useUpdateChecklist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ checklistId, input }) => updateChecklist(checklistId, input, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-checklists'] }),
  });
}

export function useDeleteChecklist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ checklistId }) => deleteChecklist(checklistId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arena-checklists'] }),
  });
}

/**
 * Editar e apagar ordem de manutenção **derrubam os bloqueios de calendário
 * junto** — por isso invalidam também as consultas da agenda: uma quadra que
 * voltou a ficar livre e continua cinza na tela é a mesma mentira de antes,
 * ao contrário.
 */
function invalidarManutencao(qc, arenaId) {
  qc.invalidateQueries({ queryKey: ['arena-maintenance'] });
  qc.invalidateQueries({ queryKey: arenaKeys.bloqueiosDaArena(arenaId) });
  qc.invalidateQueries({ queryKey: arenaKeys.reservas(arenaId) });
}

export function useUpdateMaintenance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }) => updateMaintenance(orderId, input, user),
    onSuccess: (_d, { arenaId }) => invalidarManutencao(qc, arenaId),
  });
}

export function useDeleteMaintenance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId }) => deleteMaintenance(orderId, user),
    onSuccess: (_d, { arenaId }) => invalidarManutencao(qc, arenaId),
  });
}

/* --------------------------- Equipe --------------------------- */

export function useArenaStaff(arenaId) {
  return useQuery({
    queryKey: ['arena-staff', arenaId],
    queryFn: () => getArenaStaff(arenaId),
    enabled: !!arenaId,
    staleTime: 5 * 60_000,
  });
}

export function useSaveArenaStaff() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, staff }) => saveArenaStaff(arenaId, staff, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-staff', arenaId] }),
  });
}

/* -------------------- Advanced (sprints 8-11) -------------------- */

import {
  listArenaDevices, createDevice, updateDeviceStatus,
  listMyNetworks, getArenaNetwork, createNetwork, addArenaToNetwork,
  removeArenaFromNetwork, updateBranding, getLegacyBranding,
  getHistoricalBookings,
} from '../services/advancedService.js';

export function useArenaDevices(arenaId) {
  return useQuery({
    queryKey: ['arena-devices', arenaId],
    queryFn: () => listArenaDevices(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

export function useCreateDevice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, input }) => createDevice(arenaId, input, user),
    onSuccess: (_d, { arenaId }) => qc.invalidateQueries({ queryKey: ['arena-devices', arenaId] }),
  });
}

/**
 * As MINHAS redes.
 *
 * 🐞 `useNetworks()` listava TODAS as redes da plataforma para qualquer conta.
 * Numa tela de gestão isso mostra o negócio dos outros e não ajuda quem só
 * quer ver a rede dele.
 */
export function useMyNetworks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['arena-networks', 'minhas', user?.uid],
    queryFn: () => listMyNetworks(user?.uid),
    enabled: !!user?.uid,
    staleTime: 60_000,
  });
}

/** A rede de que ESTA arena faz parte. */
export function useArenaNetwork(arenaId) {
  return useQuery({
    queryKey: ['arena-network', arenaId],
    queryFn: () => getArenaNetwork(arenaId),
    enabled: !!arenaId,
    staleTime: 60_000,
  });
}

function invalidarRede(qc, arenaId) {
  qc.invalidateQueries({ queryKey: ['arena-networks'] });
  qc.invalidateQueries({ queryKey: ['arena-network', arenaId] });
}

export function useCreateNetwork() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, arenaId }) => createNetwork(name, arenaId, user),
    onSuccess: (_d, { arenaId }) => invalidarRede(qc, arenaId),
  });
}

export function useAddArenaToNetwork() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ networkId, arenaId }) => addArenaToNetwork(networkId, arenaId, user),
    onSuccess: (_d, { arenaId }) => invalidarRede(qc, arenaId),
  });
}

export function useRemoveArenaFromNetwork() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ networkId, arenaId }) => removeArenaFromNetwork(networkId, arenaId, user),
    onSuccess: (_d, { arenaId }) => invalidarRede(qc, arenaId),
  });
}

/**
 * Grava a marca da arena.
 *
 * Invalida a ARENA, não `arena_settings`: a marca passou a morar em
 * `arenas/{id}.branding`, que é o único lugar onde o atleta consegue lê-la.
 */
export function useUpdateBranding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arenaId, branding }) => updateBranding(arenaId, branding, user),
    onSuccess: (_d, { arenaId }) => {
      qc.invalidateQueries({ queryKey: arenaKeys.arena(arenaId) });
      qc.invalidateQueries({ queryKey: arenaKeys.lista() });
    },
  });
}

/** A marca que ficou no lugar antigo, só para pré-preencher o formulário. */
export function useLegacyBranding(arenaId) {
  return useQuery({
    queryKey: ['arena-branding-legado', arenaId],
    queryFn: () => getLegacyBranding(arenaId),
    enabled: !!arenaId,
    staleTime: Infinity,
  });
}

/**
 * O histórico de movimento da arena, para a previsão.
 *
 * 🐞 A função de serviço devolvia `[]` com o comentário "só para satisfazer a
 * interface": a previsão era calculada sobre lista vazia e dava sempre zero.
 */
export function useArenaHistory(arenaId, days = 30) {
  return useQuery({
    queryKey: ['arena-history', arenaId, days],
    queryFn: () => getHistoricalBookings(arenaId, days),
    enabled: !!arenaId,
    staleTime: 5 * 60_000,
  });
}
