/**
 * Configurações → **Página inicial**: escolher os cards do início e a ordem
 * deles (flag `home_cards`, sobre o início personalizado).
 *
 * As sugestões usam só o que já está em cache pela barra lateral (as arenas
 * que a pessoa gere e o perfil de professor) e os interesses do perfil — abrir
 * Configurações não dispara consulta nova por causa deste cartão.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { resolveHomeFoci } from '@/modules/home/domain/homeProfile';
import { homeCardsSummary } from '@/modules/home/domain/homeCards';
import { useHomeCards, useHomeCardsContext, useHomeCardsOn } from '@/modules/home/hooks/useHomeCards';
import { V2Surface } from '@/v2/ui/primitives';
import HomeCardsPicker from './HomeCardsPicker';

function Conteudo() {
  const { user, userProfile } = useAuth();
  const { arenas } = useMyArenaSummary();
  const coach = useCoach(user?.uid).data;
  const ehProfessor = !!coach && coach.active !== false;
  const { escolhidos } = useHomeCards();
  const ctx = useHomeCardsContext();
  const foci = useMemo(() => resolveHomeFoci({
    interests: userProfile?.interests,
    sinais: { arenasGeridas: arenas.length, ehProfessor },
  }), [userProfile?.interests, arenas.length, ehProfessor]);

  return (
    <V2Surface id="pagina-inicial" className="scroll-mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-ink" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-ink">Página inicial</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Escolha os cards que aparecem no seu início, e em que ordem. Hoje: {homeCardsSummary(escolhidos, ctx)}.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-full px-2 py-1 text-sm font-semibold text-gray-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        >
          Ver o início <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-5">
        <HomeCardsPicker foci={foci} />
      </div>
    </V2Surface>
  );
}

/** Some com o início sob medida desligado — nenhuma opção que não faz nada. */
export default function HomeCardsSettingsCard() {
  const on = useHomeCardsOn();
  if (!on) return null;
  return <Conteudo />;
}
