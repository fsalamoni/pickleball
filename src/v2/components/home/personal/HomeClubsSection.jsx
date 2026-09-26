/**
 * "Seus clubes" na tela inicial.
 *
 * Os clubes da pessoa (uma porta para cada) e os PRÓXIMOS eventos públicos
 * deles — só os que ainda vão acontecer. O evento a que ela já disse que vai
 * está na agenda; aqui fica o que ela ainda pode decidir ir.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Search, Users } from 'lucide-react';
import { useAvailableEvents, useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

const JA_RESPONDIDO = new Set(['going', 'not_going']);

export default function HomeClubsSection({ reason, hoje }) {
  const clubes = useMyClubs();
  const eventos = useAvailableEvents();
  const proximos = useMemo(() => (eventos.data || [])
    .filter((e) => {
      const dia = String(e.starts_at || '').slice(0, 10);
      return dia >= hoje && !JA_RESPONDIDO.has(e.my_invite_status);
    })
    .slice(0, 3), [eventos.data, hoje]);
  const nomeDoClube = useMemo(
    () => new Map((clubes.data || []).map((c) => [c.id, c.name])),
    [clubes.data],
  );

  return (
    <HomeSection id="clubes" icon={Users} title="Seus clubes" reason={reason} action={{ to: '/clubes', label: 'Clubes' }}>
      {clubes.isLoading ? (
        <V2Skeleton lines={3} />
      ) : clubes.isError ? (
        <V2ErrorState inline title="Não carregou os seus clubes" description="Os seus clubes continuam lá." onRetry={clubes.refetch} />
      ) : (clubes.data || []).length === 0 ? (
        <HomeEmpty icon={Search} actions={<HomeAction to="/clubes" primary>Encontrar um clube</HomeAction>}>
          Você ainda não faz parte de um clube. Clubes têm eventos, dias de jogo e ranking interno.
        </HomeEmpty>
      ) : (
        <div className="space-y-4">
          <ul className="flex flex-wrap gap-2">
            {(clubes.data || []).slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link
                  to={`/clubes/${c.id}`}
                  className="btn-press inline-flex items-center gap-2 rounded-full border border-gray-200 bg-paper-pure px-3.5 py-1.5 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
                >
                  {c.logo_url
                    ? <img src={c.logo_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                    : <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />}
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          {eventos.isError ? (
            <V2ErrorState inline title="Não carregou os eventos dos clubes" description="Pode haver evento marcado." onRetry={eventos.refetch} />
          ) : proximos.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Próximos eventos</p>
              <ul className="space-y-1">
                {proximos.map((e) => {
                  const [dia, hora] = String(e.starts_at || '').split('T');
                  return (
                    <li key={e.id}>
                      <HomeRow
                        to={`/clubes/${e.club_id}/eventos/${e.id}`}
                        icon={CalendarDays}
                        title={e.title || 'Evento'}
                        subtitle={[formatDateShortBR(dia, { hoje }), hora ? hora.slice(0, 5) : null, nomeDoClube.get(e.club_id)].filter(Boolean).join(' · ')}
                        badge={e.my_invite_status === 'invited' ? 'Convite' : null}
                        badgeTone="amber"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </HomeSection>
  );
}
