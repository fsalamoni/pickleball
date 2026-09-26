/**
 * "Aulas" (lado do ALUNO) na tela inicial — para quem procura professor.
 *
 * As aulas marcadas já estão na agenda; aqui fica a DESCOBERTA: professores
 * aceitando alunos, os que atendem a cidade da pessoa primeiro (o professor
 * informa as regiões em texto livre, então a comparação é por trecho, sem
 * acento), com a porta para "Minhas aulas".
 */
import React, { useMemo } from 'react';
import { GraduationCap, MapPin, Search } from 'lucide-react';
import { useCoaches } from '@/modules/coaches/hooks/useCoaches';
import { normalizeLocality } from '@/modules/arenas/domain/homeBanners';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

function atendeMinhaCidade(coach, cidade) {
  if (!cidade) return false;
  return (coach?.regions || []).some((r) => normalizeLocality(r).includes(cidade));
}

export default function HomeLessonsSection({ reason, perfil, uid }) {
  const professores = useCoaches();
  const cidade = normalizeLocality(perfil?.city);
  const lista = useMemo(() => (professores.data || [])
    .filter((c) => c.id !== uid)
    .map((c) => ({ c, perto: atendeMinhaCidade(c, cidade) }))
    .sort((a, b) => Number(b.perto) - Number(a.perto))
    .slice(0, 3), [professores.data, cidade, uid]);

  return (
    <HomeSection id="aulas" icon={GraduationCap} title="Aulas e professores" reason={reason} action={{ to: '/minhas-aulas', label: 'Minhas aulas' }}>
      {professores.isLoading ? (
        <V2Skeleton lines={3} />
      ) : professores.isError ? (
        <V2ErrorState inline title="Não carregou os professores" description="Tente de novo em instantes." onRetry={professores.refetch} />
      ) : lista.length === 0 ? (
        <HomeEmpty icon={Search} actions={<HomeAction to="/coaches" primary>Ver professores</HomeAction>}>
          Nenhum professor aceitando alunos no momento. Vale conferir de novo em breve.
        </HomeEmpty>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1">
            {lista.map(({ c, perto }) => (
              <li key={c.id}>
                <HomeRow
                  to={`/coaches/${c.id}`}
                  icon={perto ? MapPin : GraduationCap}
                  title={c.display_name || 'Professor'}
                  subtitle={[(c.modalities || []).slice(0, 2).join(', '), c.hourly_rate != null ? `R$ ${Number(c.hourly_rate).toFixed(0)}/h` : null].filter(Boolean).join(' · ')}
                  badge={perto ? 'Atende sua cidade' : null}
                  badgeTone="acid"
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <HomeAction to="/coaches"><Search className="h-3.5 w-3.5" aria-hidden="true" /> Encontrar professor</HomeAction>
          </div>
        </div>
      )}
    </HomeSection>
  );
}
