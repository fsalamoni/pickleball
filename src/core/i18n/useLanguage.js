import { useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag, useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { idiomaAtivo } from './engine.js';
import { IDIOMA_PADRAO, idiomaSuportado } from './languages.js';
import { gravarEscolha, idiomaDoNavegador, lerEscolha } from './loader.js';

const CHAVE_DETECTADO = 'picklerush:idioma-detectado';

/**
 * O idioma para as telas. A troca grava a escolha e RECARREGA a página: assim
 * nenhum texto calculado antes da troca fica no idioma antigo.
 */
/**
 * Grava `users/{uid}.language` — é por ele que os avisos e o push chegam no
 * idioma da pessoa, e que a escolha a acompanha em outro aparelho. Best-effort:
 * falhar aqui não impede a troca na tela.
 */
export async function gravarIdiomaNaConta(uid, codigo) {
  if (!db || !uid || !idiomaSuportado(codigo)) return;
  try {
    await setDoc(doc(db, 'users', uid), { language: codigo }, { merge: true });
  } catch (err) {
    logger.warn('Idioma não gravado na conta:', err);
  }
}

export function useLanguage() {
  const disponivel = useFeatureFlag(FEATURE_FLAG.MULTI_LANGUAGE);
  const { user } = useAuth();
  const escolher = async (codigo) => {
    if (codigo === idiomaAtivo()) return;
    gravarEscolha(codigo);
    // Espera a gravação (com teto): recarregar antes cortaria a escrita.
    await Promise.race([gravarIdiomaNaConta(user?.uid, codigo), new Promise((r) => { setTimeout(r, 1500); })]);
    window.location.reload();
  };
  return { disponivel, codigo: idiomaAtivo(), escolher };
}

/**
 * Montado uma vez, dentro das flags. Duas regras:
 *  - flag desligada e idioma diferente do padrão ⇒ volta ao português (a
 *    escolha antiga é apagada);
 *  - flag ligada, sem escolha neste aparelho e a CONTA tem `language` ⇒
 *    adota o da conta (a escolha acompanha a pessoa);
 *  - flag ligada, sem escolha ainda e navegador em en/es ⇒ adota o do
 *    navegador UMA vez (marcado em `picklerush:idioma-detectado`, para não
 *    insistir se a pessoa voltar ao português);
 *  - escolha antiga que a conta ainda não tem ⇒ grava na conta (uma vez), para
 *    os avisos e o push saírem no idioma dela.
 */
export function IdiomaBridge() {
  const { isLoading } = useFeatureFlags();
  const ligada = useFeatureFlag(FEATURE_FLAG.MULTI_LANGUAGE);
  const { user, userProfile, isLoadingAuth } = useAuth();
  const daConta = idiomaSuportado(userProfile?.language);
  const sincronizado = useRef(null);
  useEffect(() => {
    if (isLoading || isLoadingAuth) return;
    if (ligada && user?.uid && userProfile && !daConta && idiomaAtivo() !== IDIOMA_PADRAO
      && sincronizado.current !== user.uid) {
      sincronizado.current = user.uid;
      gravarIdiomaNaConta(user.uid, idiomaAtivo());
    }
  }, [isLoading, isLoadingAuth, ligada, user?.uid, userProfile, daConta]);
  useEffect(() => {
    if (isLoading || isLoadingAuth) return;
    if (!ligada) {
      if (idiomaAtivo() !== IDIOMA_PADRAO) {
        gravarEscolha(IDIOMA_PADRAO);
        window.location.reload();
      }
      return;
    }
    if (daConta && !lerEscolha()) {
      if (daConta !== idiomaAtivo()) {
        gravarEscolha(daConta);
        window.location.reload();
      }
      return;
    }
    try {
      if (lerEscolha() || window.localStorage.getItem(CHAVE_DETECTADO)) return;
      window.localStorage.setItem(CHAVE_DETECTADO, '1');
    } catch {
      return;
    }
    const doNavegador = idiomaDoNavegador();
    if (doNavegador && doNavegador !== idiomaAtivo()) {
      gravarEscolha(doNavegador);
      window.location.reload();
    }
  }, [isLoading, isLoadingAuth, ligada, daConta]);
  return null;
}
