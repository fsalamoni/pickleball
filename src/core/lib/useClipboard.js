import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook utilitário: copia um texto para o clipboard e mantém estado
 * `copied` por ~2s. Mostra um toast com a mensagem desejada.
 *
 * Uso:
 *   const { copy, copied } = useClipboard();
 *   <Button onClick={() => copy(code, 'Código copiado!')}>...
 */
/** Cópia pelo caminho antigo (textarea + execCommand). `true` se deu certo. */
function copiarPeloCaminhoAntigo(texto) {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy') === true; } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

export function useClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);

  /**
   * @param {string} value
   * @param {string} [successMessage]
   * @param {string} [errorMessage] — quando nada funciona. Para um CÓDIGO,
   *   vale dizer o código na mensagem: é o que a pessoa vai anotar.
   */
  const copy = useCallback(
    async (value, successMessage = 'Copiado!', errorMessage = 'Não foi possível copiar. Tente manualmente.') => {
      if (!value) return false;
      const texto = String(value);
      let ok = false;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        // A API moderna pode recusar (página sem foco, permissão, http): aí o
        // caminho antigo ainda costuma funcionar — só então é falha.
        try { await navigator.clipboard.writeText(texto); ok = true; } catch { ok = false; }
      }
      if (!ok) ok = copiarPeloCaminhoAntigo(texto);
      if (!ok) {
        toast.error(errorMessage);
        return false;
      }
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), resetDelay);
      return true;
    },
    [resetDelay],
  );

  return { copy, copied };
}
