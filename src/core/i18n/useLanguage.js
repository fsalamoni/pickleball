import { useEffect } from 'react';
import { useFeatureFlag, useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { idiomaAtivo } from './engine.js';
import { IDIOMA_PADRAO } from './languages.js';
import { gravarEscolha, idiomaDoNavegador, lerEscolha } from './loader.js';

const CHAVE_DETECTADO = 'picklerush:idioma-detectado';

/**
 * O idioma para as telas. A troca grava a escolha e RECARREGA a página: assim
 * nenhum texto calculado antes da troca fica no idioma antigo.
 */
export function useLanguage() {
  const disponivel = useFeatureFlag(FEATURE_FLAG.MULTI_LANGUAGE);
  const escolher = (codigo) => {
    if (codigo === idiomaAtivo()) return;
    gravarEscolha(codigo);
    window.location.reload();
  };
  return { disponivel, codigo: idiomaAtivo(), escolher };
}

/**
 * Montado uma vez, dentro das flags. Duas regras:
 *  - flag desligada e idioma diferente do padrão ⇒ volta ao português (a
 *    escolha antiga é apagada);
 *  - flag ligada, sem escolha ainda e navegador em en/es ⇒ adota o do
 *    navegador UMA vez (marcado em `picklerush:idioma-detectado`, para não
 *    insistir se a pessoa voltar ao português).
 */
export function IdiomaBridge() {
  const { isLoading } = useFeatureFlags();
  const ligada = useFeatureFlag(FEATURE_FLAG.MULTI_LANGUAGE);
  useEffect(() => {
    if (isLoading) return;
    if (!ligada) {
      if (idiomaAtivo() !== IDIOMA_PADRAO) {
        gravarEscolha(IDIOMA_PADRAO);
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
  }, [isLoading, ligada]);
  return null;
}
