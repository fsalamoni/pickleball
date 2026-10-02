import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';

/** O atalho de Configurações para as preferências da gamificação (privacidade, avisos, exibição). */
export default function GamificationSettingsCard() {
  return (
    <V2Surface id="gamificacao" className="scroll-mt-6">
      <Link to="/gamification/configuracoes" className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acid/30 text-ink"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold text-ink">Gamificação</span>
          <span className="block text-sm text-gray-500">Apareço no placar? Quem pode me avaliar? Quais avisos eu quero? Você decide.</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      </Link>
    </V2Surface>
  );
}
