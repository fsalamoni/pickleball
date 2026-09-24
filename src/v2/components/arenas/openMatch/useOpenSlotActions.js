/**
 * As ações do atleta num jogo aberto — entrar, sair, fila, aceitar, recusar —
 * com as mensagens de sempre. Uma cópia só para a página de jogos abertos, a
 * seção da página da arena, Minhas reservas e Procura-se jogo: mensagem que
 * diverge entre telas ensina a desconfiar das duas.
 */

import { toast } from 'sonner';
import {
  useJoinOpenSlot, useLeaveOpenSlot, useJoinWaitlist, useLeaveWaitlist, useAcceptWaitlist,
  useDeclineWaitlist,
} from '@/modules/arenas/hooks/useArenaV3';

export function useOpenSlotActions() {
  const entrar = useJoinOpenSlot();
  const sair = useLeaveOpenSlot();
  const fila = useJoinWaitlist();
  const sairDaFila = useLeaveWaitlist();
  const aceitar = useAcceptWaitlist();
  const recusar = useDeclineWaitlist();

  const ocupado = entrar.isPending || sair.isPending || fila.isPending
    || sairDaFila.isPending || aceitar.isPending || recusar.isPending;

  return {
    ocupado,
    onEntrar: (slot) => entrar.mutateAsync(slot.id)
      .then(() => toast.success('Pronto! Você está no jogo.'))
      .catch((e) => toast.error(e?.message || 'Não foi possível entrar.')),
    onSair: (slot) => sair.mutateAsync(slot.id)
      .then(() => toast.success('Você saiu do jogo. A vaga voltou para a lista.'))
      .catch((e) => toast.error(e?.message || 'Não foi possível sair.')),
    onFila: (slot) => fila.mutateAsync(slot.id)
      .then(() => toast.success('Você está na fila. Avisamos assim que vagar.'))
      .catch((e) => toast.error(e?.message || 'Não foi possível entrar na fila.')),
    onSairDaFila: (slotId) => sairDaFila.mutateAsync(slotId)
      .then(() => toast.success('Você saiu da fila de espera.'))
      .catch((e) => toast.error(e?.message || 'Não foi possível sair da fila.')),
    onAceitar: ({ slot_id: slotId }) => aceitar.mutateAsync(slotId)
      .then(() => toast.success('Vaga confirmada. Bom jogo!'))
      .catch((e) => toast.error(e?.message || 'Não foi possível confirmar.')),
    onRecusar: ({ slot_id: slotId }) => recusar.mutateAsync(slotId)
      .then(() => toast.success('Tudo bem — a vaga passou para o próximo.'))
      .catch((e) => toast.error(e?.message || 'Não foi possível recusar.')),
  };
}
