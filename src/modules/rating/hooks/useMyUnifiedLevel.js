/**
 * O MEU nível na régua única (2.0–8.0).
 *
 * A régua é a mesma dos sorteios, do rating da casa e do DUPR — ver
 * `docs/13-NIVEL-UNIFICADO.md`. Toda tela que precisa comparar o nível de
 * alguém com uma faixa (a peneira de um jogo aberto, a sugestão de parceiro, o
 * filtro de um torneio interno) deve passar por aqui, e nunca por um campo
 * solto do perfil: `profile.level` não vive nessa escala, e comparar escalas
 * diferentes na mesma conta não filtra — filtra errado.
 *
 * Sem nível conhecido devolve `null`. **Nunca inventamos um número**: quem
 * consome trata "não sei" como "não barra".
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fetchUnifiedLevels } from '../services/unifiedLevelService.js';

/**
 * @param {{ side?: 'doubles'|'singles' }} [options]
 * @returns {{ level: number|null, source: string|null, isLoading: boolean }}
 */
export function useMyUnifiedLevel({ side = 'doubles' } = {}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const { data, isLoading } = useQuery({
    queryKey: ['unified-level', uid, side],
    enabled: Boolean(uid),
    // Muda pouco (só depois de jogos) e é lido em várias telas.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const mapa = await fetchUnifiedLevels([uid], { side });
      return mapa.get(uid) || null;
    },
  });

  const valor = Number(data?.value);
  return {
    level: Number.isFinite(valor) ? valor : null,
    source: data?.source || null,
    isLoading: Boolean(uid) && isLoading,
  };
}

export default useMyUnifiedLevel;

/**
 * Os níveis de VÁRIAS pessoas de uma vez, na régua única.
 *
 * Uma consulta para o lote inteiro — nunca um hook por pessoa dentro de um
 * `map`, que é o caminho conhecido para uma lista de 40 atletas virar 40
 * consultas. Quem não tem nível conhecido simplesmente não entra no mapa.
 *
 * @param {string[]} uids
 * @param {{ side?: 'doubles'|'singles', enabled?: boolean }} [options]
 * @returns {{ levels: Record<string, number>, isLoading: boolean }}
 */
export function useUnifiedLevels(uids = [], { side = 'doubles', enabled = true } = {}) {
  // Ordenado para a chave não mudar só porque a lista chegou noutra ordem.
  const ids = [...new Set((uids || []).filter(Boolean))].sort();
  const { data, isLoading } = useQuery({
    queryKey: ['unified-levels', side, ids.join(',')],
    enabled: enabled && ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const mapa = await fetchUnifiedLevels(ids, { side });
      const out = {};
      mapa.forEach((v, uid) => { out[uid] = v.value; });
      return out;
    },
  });
  return { levels: data || {}, isLoading: ids.length > 0 && isLoading };
}
