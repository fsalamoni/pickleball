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
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  chosenHomeCards, isDefaultHomeCards, moveHomeCard, toggleHomeCard,
} from '../domain/homeCards.js';
import {
  homeCardsSnapshot, resetHomeCards, saveHomeCards, subscribeHomeCards,
} from '../services/homeCardsPreference.js';

/** O início sob medida está valendo? (as duas flags) */
export function useHomeCardsOn() {
  const personalizada = useFeatureFlag(FEATURE_FLAG.PERSONALIZED_HOME);
  const sobMedida = useFeatureFlag(FEATURE_FLAG.HOME_CARDS);
  return personalizada && sobMedida;
}

/** O que está ligado agora e muda o que cada card oferece. */
export function useHomeCardsContext() {
  const arenas = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const plataforma = useFeatureFlag(FEATURE_FLAG.PLATFORM_MARKETING);
  const professores = useFeatureFlag(FEATURE_FLAG.COACH_MARKETING);
  const evolucao = useFeatureFlag(FEATURE_FLAG.ACTION_HOME);
  return useMemo(() => ({
    promocoes: arenas || plataforma || professores,
    evolucao,
  }), [arenas, plataforma, professores, evolucao]);
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
