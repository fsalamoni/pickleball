import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

/** O atalho de Configurações para as preferências da gamificação (privacidade, avisos, exibição). */
export default function GamificationSettingsCard() {
  return (
    <V2Surface id="gamificacao" variant="compacto" className="scroll-mt-4">
      <Link to="/gamification/configuracoes" className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-ink">{t('Gamificação')}</span>
          <span className="block text-xs text-gray-500">{t('Placar, quem pode avaliar você e os avisos — numa página própria.')}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      </Link>
    </V2Surface>
  );
}
