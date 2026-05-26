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
export function useClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (value, successMessage = 'Copiado!') => {
      if (!value) return false;
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(String(value));
        } else if (typeof document !== 'undefined') {
          // Fallback para ambientes sem Clipboard API.
          const ta = document.createElement('textarea');
          ta.value = String(value);
          ta.setAttribute('readonly', '');
          ta.style.position = 'absolute';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopied(true);
        toast.success(successMessage);
        setTimeout(() => setCopied(false), resetDelay);
        return true;
      } catch (err) {
        toast.error('Não foi possível copiar. Tente manualmente.');
        return false;
      }
    },
    [resetDelay],
  );

  return { copy, copied };
}
