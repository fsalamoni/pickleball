/**
 * "Comunidade" na tela inicial — gente para jogar, perto da pessoa.
 *
 * Atletas do diretório (só quem escolheu aparecer: `directory_listed`) da
 * mesma cidade primeiro, e as portas para as novidades e as mensagens.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Users, Zap } from 'lucide-react';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { proximidade } from '@/modules/home/domain/homeTournaments';
import { V2Avatar, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeSection } from './HomeSection';

export default function HomeCommunitySection({ reason, perfil, uid }) {
  const atletas = useAthletes(true);
  const perto = useMemo(() => (atletas.data || [])
    .filter((a) => a && (a.uid || a.id) !== uid)
    .map((a) => ({ a, p: proximidade(a, perfil) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p)
    .slice(0, 6), [atletas.data, perfil, uid]);

  return (
    <HomeSection id="comunidade" icon={Users} title="Comunidade" reason={reason} action={{ to: '/atletas', label: 'Atletas' }}>
      <div className="space-y-4">
        {atletas.isLoading ? (
          <V2Skeleton className="h-16 rounded-3xl" />
        ) : atletas.isError ? (
          <V2ErrorState inline title="Não carregou os atletas" description="Tente de novo em instantes." onRetry={atletas.refetch} />
        ) : perto.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              Atletas {perto[0].p === 2 ? 'da sua cidade' : 'do seu estado'}
            </p>
            <ul className="flex flex-wrap gap-3">
              {perto.map(({ a }) => (
                <li key={a.uid || a.id}>
                  <Link
                    to={`/atleta/${a.uid || a.id}`}
                    className="flex w-20 flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center hover:bg-paper focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
                  >
                    <V2Avatar name={a.platform_name} photoUrl={a.photo_url} size="lg" />
                    <span className="line-clamp-2 text-xs font-semibold text-ink">{a.platform_name || 'Atleta'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <HomeAction to="/novidades"><Zap className="h-3.5 w-3.5" aria-hidden="true" /> Novidades</HomeAction>
          <HomeAction to="/chat"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Mensagens</HomeAction>
          <HomeAction to="/encontrar-jogadores"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Encontrar jogadores</HomeAction>
        </div>
      </div>
    </HomeSection>
  );
}
