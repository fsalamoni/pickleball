/**
 * "Como foi o seu jogo?" na TELA INICIAL: aparece só para quem ligou o
 * balanço do jogo e tem jogo esperando balanço. É cortesia — o mesmo está na
 * aba Balanço do treino —, então falha de leitura não afirma nada: não mostra.
 *
 * Chega por `lazy` atrás das duas flags: quem não tem o balanço não baixa nada.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { usePendingDebriefs } from '@/modules/training/hooks/useDebriefs';
import { DEBRIEF_SOURCE_LABELS } from '@/modules/training/domain/debrief';
import { V2Button } from '@/v2/ui/primitives';

export default function HomeDebriefPrompt() {
  const { on, pending, isSuccess } = usePendingDebriefs();
  if (!on || !isSuccess || pending.length === 0) return null;
  const [primeiro] = pending;
  const outros = pending.length - 1;
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm" data-dica="inicio-balanco">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acid/20 text-ink" aria-hidden="true">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-ink">Como foi o seu jogo?</p>
          <p className="truncate text-sm text-gray-500">
            {DEBRIEF_SOURCE_LABELS[primeiro.type]}: {primeiro.title}
            {outros > 0 ? ` e mais ${outros}` : ''}. Um minuto, e a semana de treino sai sugerida.
          </p>
        </div>
      </div>
      <V2Button asChild size="sm">
        <Link to="/treino?aba=balanco">Fazer o balanço</Link>
      </V2Button>
    </div>
  );
}
