import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Lightbulb } from 'lucide-react';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { useGamificationGuide } from '@/modules/progression/hooks/useGamificationGuide';

/**
 * O "Como funciona" no topo de cada aba do hub: três ou quatro frases e os
 * termos que a aba usa, cada um levando ao glossário.
 *
 * Abre na PRIMEIRA visita (quem chega precisa disso) e lembra, por pessoa, se
 * foi recolhido — a mesma regra dos cartões recolhíveis do resto da
 * plataforma. Recolhido, o cabeçalho continua dizendo o que ele é.
 *
 * @param {{ tab: 'jornada'|'missoes'|'competir'|'social'|'recompensas' }} props
 */
export default function HowItWorks({ tab }) {
  const { guide, isModuleOn } = useGamificationGuide();
  const intro = guide.tabs[tab];
  if (!intro) return null;
  const termos = intro.terms
    .map((id) => guide.byId[id])
    .filter((t) => t && (!t.module || isModuleOn(t.module)));

  return (
    <V2CollapsibleCard
      icon={Lightbulb}
      title={intro.title}
      summary="Entenda em um minuto"
      sectionId={`gamification:como:${tab}`}
      dica="gamificacao-como-funciona"
      bodyClassName="space-y-3"
    >
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-gray-600" data-testid={`como-funciona-${tab}`}>
        {intro.bullets.map((b) => <li key={b}>{b}</li>)}
      </ul>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {termos.map((t) => (
          <Link
            key={t.id}
            to={`/gamification/como-funciona?termo=${t.id}`}
            className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink hover:bg-gray-100"
          >
            {t.title}
          </Link>
        ))}
        <Link to="/gamification/como-funciona" className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
          Guia completo <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </V2CollapsibleCard>
  );
}
