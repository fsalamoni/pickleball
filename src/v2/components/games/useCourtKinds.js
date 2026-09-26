/**
 * useCourtKinds — o tipo (simples ou duplas) de cada quadra, na tela.
 *
 * O tipo que vale é o DERIVADO dos jogos (a quadra lembra o tipo do último
 * jogo criado nela — ver `courtKindsFromGames`) com a ESCOLHA que quem
 * organiza fez agora por cima. A escolha fica só nesta tela até virar jogo:
 * ao criar a partida, o tipo passa a morar no próprio jogo, e aí qualquer
 * aparelho — o painel de outra pessoa, o telão — enxerga o mesmo.
 *
 * Nada é gravado no dia de jogo: nenhum campo novo, nenhuma regra nova.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  courtKindsFromGames, mergeCourtKinds, normalizeGameKind,
} from '@/modules/games/domain/gameKind';

/**
 * @param {Array} games
 * @param {number} courts
 * @returns {{
 *   tipos: Record<number, string>,
 *   definir: (court: number, kind: string) => void,
 *   pedido: (court: number) => ({ kind: string } | {}),
 * }}
 *   `pedido(court)` é o que mandar ao serviço: o tipo só vai junto quando
 *   difere do que a quadra JÁ é — sem troca, o serviço chega ao mesmo tipo
 *   sozinho (o do último jogo da quadra), e a chamada fica idêntica à de antes.
 */
export function useCourtKinds(games, courts) {
  const [escolha, setEscolha] = useState({});
  const derivado = useMemo(() => courtKindsFromGames(games, courts), [games, courts]);
  const tipos = useMemo(() => mergeCourtKinds(derivado, escolha), [derivado, escolha]);
  const definir = useCallback((court, kind) => {
    setEscolha((atual) => ({ ...atual, [court]: normalizeGameKind(kind) }));
  }, []);
  const pedido = useCallback((court) => {
    const tipo = normalizeGameKind(tipos[court]);
    return tipo !== normalizeGameKind(derivado[court]) ? { kind: tipo } : {};
  }, [tipos, derivado]);
  return { tipos, definir, pedido };
}
