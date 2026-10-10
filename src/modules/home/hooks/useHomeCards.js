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
import { PERMANENT_FEATURE } from '@/core/featureFlags';
import {
  chosenHomeCards, isDefaultHomeCards, moveHomeCard, toggleHomeCard,
} from '../domain/homeCards.js';
import {
  homeCardsSnapshot, resetHomeCards, saveHomeCards, subscribeHomeCards,
} from '../services/homeCardsPreference.js';

/** O início sob medida está valendo? (as duas flags) */
export function useHomeCardsOn() {
  const personalizada = useFeatureFlag(PERMANENT_FEATURE.PERSONALIZED_HOME);
  const sobMedida = useFeatureFlag(PERMANENT_FEATURE.HOME_CARDS);
  return personalizada && sobMedida;
}

/** O que está ligado agora e muda o que cada card oferece. */
export function useHomeCardsContext() {
  const arenas = useFeatureFlag(PERMANENT_FEATURE.ARENA_MODULES);
  const plataforma = useFeatureFlag(PERMANENT_FEATURE.PLATFORM_MARKETING);
  const professores = useFeatureFlag(PERMANENT_FEATURE.COACH_MARKETING);
  const evolucao = useFeatureFlag(PERMANENT_FEATURE.ACTION_HOME);
  const treino = useFeatureFlag(PERMANENT_FEATURE.TRAINING_CENTER);
  return useMemo(() => ({
    promocoes: arenas || plataforma || professores,
    evolucao,
    treino,
  }), [arenas, plataforma, professores, evolucao, treino]);
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
