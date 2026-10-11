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
import SettingsSection from '@/v2/components/settings/SettingsSection';
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
    treino: ctx.treino,
    sinais: { arenasGeridas: arenas.length, ehProfessor },
  }), [userProfile?.interests, ctx.treino, arenas.length, ehProfessor]);

  const resumo = homeCardsSummary(escolhidos, ctx);
  const verInicio = (
    <Link
      to="/"
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-gray-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
    >
      Ver o início <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );

  return (
    <SettingsSection id="pagina-inicial" icon={LayoutGrid} title="Página inicial" summary={resumo} actions={verInicio}>
      <p className="text-sm text-gray-500">
        Escolha os cards que aparecem no seu início, e em que ordem. Hoje: {resumo}.
      </p>
      <div className="mt-5">
        <HomeCardsPicker foci={foci} />
      </div>
    </SettingsSection>
  );
}

/** Some com o início sob medida desligado — nenhuma opção que não faz nada. */
export default function HomeCardsSettingsCard() {
  const on = useHomeCardsOn();
  if (!on) return null;
  return <Conteudo />;
}
