/**
 * Os GRUPOS do Play, na tela (flag `play_groups`).
 *
 * Um hook só para as três telas que mostram o Play — o painel do organizador, a
 * visão do jogador e o telão — pedirem a mesma coisa e não montarem cada uma o
 * seu pedaço. É assim que a previsão e a ordem exibida continuam batendo com a
 * partida que o serviço cria: o serviço usa o mesmo sorteador, alimentado pelos
 * mesmos participantes com o mesmo nível.
 *
 * Nada aqui grava: só lê o dia, a flag e o nível unificado.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { isPlayFormat } from '@/modules/clubs/domain/gameDayFormats';
import { fetchUnifiedLevelsByParticipant } from '@/modules/rating/services/unifiedLevelService';
import {
  normalizePlayGroupsConfig, isPlayGroupsActive, withLevels,
} from '../domain/playGroups';
import { makeGroupsDrawer } from '../domain/playGroupsDraw';

const SEM_GRUPOS = Object.freeze({ groups: [], policy: 'queue' });

/**
 * O estado dos grupos DESTE dia.
 *
 * `configuravel`: a flag está ligada e o dia é um Play — a tela pode oferecer
 * criar grupos. `ativo`: além disso, há ao menos um grupo — o sorteio, a
 * previsão e a ordem passam a valer por grupo. Flag desligada: tudo `false` e a
 * configuração vazia, e o Play segue uma fila só.
 *
 * @param {object|null} gameDay
 */
export function usePlayGroups(gameDay) {
  const flag = useFeatureFlag(FEATURE_FLAG.PLAY_GROUPS);
  const lista = gameDay?.play_groups;
  const politica = gameDay?.play_groups_policy;
  const formato = gameDay?.format;
  return useMemo(() => {
    const dia = { format: formato, play_groups: lista, play_groups_policy: politica };
    const ehPlay = isPlayFormat(formato);
    const ativo = isPlayGroupsActive(dia, flag);
    return {
      flag,
      configuravel: flag && ehPlay,
      ativo,
      config: ativo ? normalizePlayGroupsConfig(dia) : SEM_GRUPOS,
    };
  }, [flag, lista, politica, formato]);
}

/**
 * O nível unificado de cada participante (id → nível), buscado SÓ quando
 * `enabled`. A leitura já é tolerante por dentro (`unifiedLevelService` nunca
 * lança: coleção fora do ar vira "nível desconhecido"), então o hook não
 * engole nada — e falhando, `data` fica indefinido e quem usa cai no nível
 * declarado, o mesmo que o serviço faz.
 */
export function useParticipantLevels(participants, { enabled = true } = {}) {
  const comConta = (participants || []).filter((p) => p?.id && p?.user_id);
  const chave = comConta.map((p) => `${p.id}:${p.user_id}`).sort().join('|');
  return useQuery({
    queryKey: ['game-days', 'participant-levels', chave],
    queryFn: () => fetchUnifiedLevelsByParticipant(comConta),
    enabled: enabled && comConta.length > 0,
    staleTime: 60_000,
  });
}

/**
 * Tudo o que uma tela do Play precisa para trabalhar COM grupos: se estão
 * ativos, a configuração, os participantes com o nível resolvido e o sorteador
 * (o mesmo objeto que a previsão e o serviço usam).
 *
 * Com os grupos inativos (flag desligada ou dia sem grupos) devolve os
 * participantes INTACTOS e `drawer: null` — o caminho do Play de sempre.
 *
 * @param {{ gameDay: object, participants: Array, games: Array,
 *           courtGroups?: Record<number,string> }} args
 */
export function usePlayGroupsContext({ gameDay, participants, games, courtGroups }) {
  const grupos = usePlayGroups(gameDay);
  const niveis = useParticipantLevels(participants, { enabled: grupos.ativo });
  const nivelData = niveis.data;
  const decorados = useMemo(
    () => (grupos.ativo ? withLevels(participants, nivelData) : participants),
    [grupos.ativo, participants, nivelData],
  );
  const drawer = useMemo(
    () => (grupos.ativo
      ? makeGroupsDrawer(grupos.config, { games, participants: decorados, courtGroups })
      : null),
    [grupos.ativo, grupos.config, games, decorados, courtGroups],
  );
  return { ...grupos, participants: decorados, drawer };
}
