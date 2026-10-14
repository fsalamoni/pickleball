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
import { V2Button, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function HomeDebriefPrompt() {
  const { on, pending, isSuccess } = usePendingDebriefs();
  if (!on || !isSuccess || pending.length === 0) return null;
  const [primeiro] = pending;
  const outros = pending.length - 1;
  return (
    <V2Surface className="mb-8 flex flex-wrap items-center justify-between gap-3 p-5 sm:p-5" data-dica="inicio-balanco">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acid/20 text-ink" aria-hidden="true">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-ink">{t('Como foi o seu jogo?')}</p>
          <p className="truncate text-sm text-gray-500">
            {t(DEBRIEF_SOURCE_LABELS[primeiro.type])}: {primeiro.title}
            {outros > 0 ? t(' e mais {n}', { n: outros }) : ''}{t('. Um minuto, e a semana de treino sai sugerida.')}
          </p>
        </div>
      </div>
      <V2Button asChild size="sm">
        <Link to="/treino?aba=balanco">{t('Fazer o balanço')}</Link>
      </V2Button>
    </V2Surface>
  );
}
