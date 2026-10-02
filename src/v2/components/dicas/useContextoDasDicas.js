/**
 * O CONTEXTO que decide quais guias e pontos valem para a pessoa: as flags
 * ligadas, se ela gere uma arena (e qual), se dá aula e se administra a
 * plataforma.
 *
 * Uma fonte só para a camada das dicas e para os botões "Mostre na tela" —
 * cópia que diverge mostraria um guia num lugar e o esconderia noutro.
 * As duas consultas já estão em cache pela barra lateral: não custam leitura.
 */
import { useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';

export function useContextoDasDicas() {
  const { user, isPlatformAdmin } = useAuth();
  const { flags } = useFeatureFlags();
  const { arenas } = useMyArenaSummary();
  const coach = useCoach(user?.uid).data;
  return useMemo(() => ({
    flags: flags || {},
    gereArena: arenas.length > 0,
    minhaArena: arenas[0]?.id || null,
    ehProfessor: Boolean(coach) && coach.active !== false,
    ehAdmin: Boolean(isPlatformAdmin),
  }), [flags, arenas, coach, isPlatformAdmin]);
}
