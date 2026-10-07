/**
 * As MUTAÇÕES dos grupos do Play (flag `play_groups`).
 *
 * Moram aqui, e não em `useGameDays.js`, de propósito: os grupos são uma camada
 * que se liga por cima do Play, e quem não os usa (o Americano aprimorado, um
 * dia sem grupos) não deve depender deles — nem na tela, nem nos testes que
 * simulam o módulo de hooks do dia de jogo por lista.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  setPlayGroups, setPlayParticipantGroup, assignPlayGroups,
} from '../services/gameDayService.js';

/**
 * Configurar os grupos mexe no DOC do dia (lista e política) e nos
 * participantes (quem estava num grupo removido). Invalida as listas, a
 * consulta do dia e o telão, que tem consultas próprias.
 */
function useGroupsInvalidate(gdId) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['game-days'] });
    qc.invalidateQueries({ queryKey: ['gameday-telao', gdId] });
  };
}

/** Salva os grupos e a política do dia (só quem configura o dia). */
export function useSetPlayGroups(gdId) {
  const { user } = useAuth();
  const invalidate = useGroupsInvalidate(gdId);
  return useMutation({
    mutationFn: (config) => setPlayGroups(gdId, config, user),
    onSuccess: invalidate,
  });
}

/** Muda o grupo de um participante (levando a dupla vinculada junto). */
export function useSetPlayParticipantGroup(gdId) {
  const { user } = useAuth();
  const invalidate = useGroupsInvalidate(gdId);
  return useMutation({
    mutationFn: ({ pid, groupId, self = false }) => setPlayParticipantGroup(gdId, pid, groupId, user, { self }),
    onSuccess: invalidate,
  });
}

/** Aplica a distribuição por nível, já conferida na prévia. */
export function useAssignPlayGroups(gdId) {
  const { user } = useAuth();
  const invalidate = useGroupsInvalidate(gdId);
  return useMutation({
    mutationFn: (assignments) => assignPlayGroups(gdId, assignments, user),
    onSuccess: invalidate,
  });
}
