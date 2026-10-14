/**
 * Ação destrutiva com "Desfazer" (Fase 4.2 do plano de UX).
 *
 * `agendar(id, mensagem, executar)` esconde o item na hora (o id entra em
 * `ocultos`, que a lista filtra), mostra um toast com "Desfazer" e só grava
 * depois da janela. Desfazer cancela e o item volta. Ao sair da página, o que
 * está pendente é gravado na hora — senão a ação se perderia em silêncio.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { JANELA_DESFAZER_MS, agendarDesfazivel } from '@/core/domain/desfazer';
import { t } from '@/core/i18n';

export function useDesfazivel() {
  const [ocultos, setOcultos] = useState(() => new Set());
  const pendentes = useRef(new Map());

  const mostrar = (id) => setOcultos((s) => { const n = new Set(s); n.delete(id); return n; });

  useEffect(() => {
    const flush = () => { for (const a of pendentes.current.values()) a.agora(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  const agendar = useCallback((id, mensagem, executar, { aoFalhar } = {}) => {
    setOcultos((s) => new Set(s).add(id));
    const agendado = agendarDesfazivel({
      ms: JANELA_DESFAZER_MS,
      executar: async () => {
        pendentes.current.delete(id);
        try { await executar(); } catch (err) { mostrar(id); aoFalhar?.(err); }
      },
    });
    pendentes.current.set(id, agendado);
    toast(mensagem, {
      duration: JANELA_DESFAZER_MS,
      action: {
        label: t('Desfazer'),
        onClick: () => { if (agendado.cancelar()) { pendentes.current.delete(id); mostrar(id); } },
      },
    });
    return agendado;
  }, []);

  return { ocultos, agendar };
}
