/**
 * A escolha dos cards da tela inicial, para quem desenha: o que está em
 * vigor, se a pessoa já personalizou, e como mudar. Todo consumidor (a tela
 * inicial, o seletor, o cartão de Configurações) vê a mesma coisa ao mesmo
 * tempo — o armazém avisa todos.
 *
 * `useHomeCardsOn()` responde se a funcionalidade vale: precisa da tela
 * inicial personalizada E da flag `home_cards`.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';

import {
  chosenHomeCards, isDefaultHomeCards, moveHomeCard, toggleHomeCard,
} from '../domain/homeCards.js';
import {
  homeCardsSnapshot, resetHomeCards, saveHomeCards, subscribeHomeCards,
} from '../services/homeCardsPreference.js';

/** O início sob medida está valendo? (as duas flags) */
export function useHomeCardsOn() {
  const personalizada = true;
  const sobMedida = true;
  return personalizada && sobMedida;
}

/** O que está ligado agora e muda o que cada card oferece. */
export function useHomeCardsContext() {
  const evolucao = true;
  const treino = true;
  const mercado = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  return useMemo(() => ({ evolucao, treino, mercado }), [evolucao, treino, mercado]);
}

/**
 * @returns {{
 *   escolhidos: string[], personalizado: boolean, padrao: boolean,
 *   alternar: (id: string) => void, mover: (id: string, passo: number) => void,
 *   definir: (lista: string[]) => void, restaurar: () => void,
 * }}
 */
export function useHomeCards() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const retrato = useSyncExternalStore(
    subscribeHomeCards,
    () => homeCardsSnapshot(uid),
    () => homeCardsSnapshot(uid),
  );
  const escolhidos = useMemo(() => chosenHomeCards(retrato.salvo), [retrato]);
  const definir = useCallback((lista) => { saveHomeCards(uid, lista); }, [uid]);
  const alternar = useCallback((id) => definir(toggleHomeCard(escolhidos, id)), [definir, escolhidos]);
  const mover = useCallback((id, passo) => definir(moveHomeCard(escolhidos, id, passo)), [definir, escolhidos]);
  const restaurar = useCallback(() => { resetHomeCards(uid); }, [uid]);
  return {
    escolhidos,
    personalizado: retrato.salvo !== null,
    padrao: isDefaultHomeCards(escolhidos),
    alternar,
    mover,
    definir,
    restaurar,
  };
}
