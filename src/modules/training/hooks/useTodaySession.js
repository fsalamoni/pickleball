/**
 * O treino de HOJE, montado num lugar só: a aba Hoje e o card do início
 * perguntam aqui, para os dois nunca mostrarem treinos diferentes.
 *
 * Devolve as consultas junto (quem mostra decide o que fazer com a falha):
 * sem os planos não dá para saber o dia do plano.
 */
import { useMemo } from 'react';
import { useVisibleTrainingItems } from './useTrainingItems';
import { useMyTrainingPlans } from './useTrainingPlans';
import { useTrainingInbox } from './useTrainingShares';
import { useTrainingMeta } from './useTrainingMeta';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { todaySession } from '../domain/today';
import { PLAN_STATUS } from '../domain/plan';
import { todayLocal } from '../domain/dates';
import { pickItems, totalMinutes } from '../domain/treinar';

/**
 * @param {object} identity `useTrainingIdentity()`
 * @param {{ variacao?: number, forcar?: boolean }} [opcoes] "Outra sugestão" e "Treinar mesmo assim"
 */
export function useTodaySession(identity, { variacao = 0, forcar = false } = {}) {
  const hoje = todayLocal();
  const visiveis = useVisibleTrainingItems(identity);
  const planos = useMyTrainingPlans(identity.uid);
  const inbox = useTrainingInbox(identity.uid);
  const meta = useTrainingMeta(identity.uid);
  const { level } = useMyUnifiedLevel();

  const ativo = useMemo(() => (planos.data || []).find((p) => p.status === PLAN_STATUS.ATIVO) || null, [planos.data]);
  const routine = meta.data?.routine || null;

  const sessao = useMemo(() => todaySession({
    today: hoje,
    // A semente muda com "Outra sugestão"; o resto da conta é o mesmo.
    uid: variacao ? `${identity.uid}:${variacao}` : identity.uid,
    plan: ativo,
    inbox: inbox.data || [],
    items: visiveis.items,
    routine,
    level,
    force: forcar,
  }), [hoje, identity.uid, variacao, ativo, inbox.data, visiveis.items, routine, level, forcar]);

  const { items, missingIds } = pickItems(sessao.itemIds, visiveis.byId);

  return {
    hoje,
    sessao,
    items,
    missingIds,
    minutos: totalMinutes(sessao.minutes, items),
    ativo,
    routine,
    visiveis,
    planos,
    inbox,
    meta,
    isLoading: planos.isPending || meta.isPending || visiveis.isLoading,
  };
}
