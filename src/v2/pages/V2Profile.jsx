import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Award, MapPin, Medal, Pencil, User } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { genderLabel } from '@/modules/athletes/domain/constants';
import { V2Avatar, V2Button } from '@/v2/ui/primitives';

function memberSince(profile) {
  const ts = profile?.created_at;
  const date = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}

export default function V2Profile() {
  const { user, userProfile } = useAuth();
  const { data: ranking = [] } = useNationalRanking();

  const me = useMemo(
    () => ranking.find((p) => p.id === user?.uid || p.uid === user?.uid) || null,
    [ranking, user?.uid],
  );

  const name = userProfile?.platform_name || user?.displayName || 'Atleta';
  const photo = userProfile?.photo_url || user?.photoURL || '';
  const location = [userProfile?.city, userProfile?.state].filter(Boolean).join(', ');
  const year = memberSince(userProfile);

  const chips = [
    me ? { icon: Medal, label: `Rating ${me.rating}`, tone: 'acid' } : (userProfile?.level ? { icon: Award, label: userProfile.level } : null),
    genderLabel(userProfile?.gender) ? { icon: User, label: genderLabel(userProfile.gender) } : null,
    location ? { icon: MapPin, label: location } : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="overflow-hidden rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm">
        <div className="relative h-56 bg-mesh">
          <div className="absolute inset-0 bg-gradient-to-t from-paper-pure to-transparent" />
        </div>

        <div className="relative px-6 pb-8 sm:px-8">
          <div className="-mt-16 mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="rounded-full border-8 border-paper-pure bg-paper-pure shadow-md">
              <V2Avatar name={name} photoUrl={photo} size="xl" className="h-32 w-32 text-4xl" />
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <V2Button asChild variant="subtle" className="flex-1 sm:flex-none">
                <Link to="/perfil"><Pencil className="h-4 w-4" /> Editar perfil</Link>
              </V2Button>
              {me && (
                <V2Button asChild className="flex-1 sm:flex-none">
                  <Link to="/ranking">Ver no ranking</Link>
                </V2Button>
              )}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{name}</h1>
            <p className="mt-1 font-medium text-gray-500">
              {[location, year ? `Membro desde ${year}` : null].filter(Boolean).join(' • ') || 'Complete seu perfil para aparecer no diretório'}
            </p>

            {chips.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
                {chips.map((chip, i) => {
                  const Icon = chip.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold ${
                        chip.tone === 'acid' ? 'border-acid/40 bg-acid/15 text-ink' : 'border-gray-100 bg-paper text-gray-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {chip.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {me && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label="Posição" value={`${me.position}º`} />
          <MiniStat label="Rating" value={me.rating} />
          <MiniStat label="Vitórias" value={me.wins} />
          <MiniStat label="Jogos" value={me.games} />
        </div>
      )}

      <div className="mt-8 rounded-4xl border border-dashed border-gray-200 bg-paper p-6 text-sm text-gray-500">
        A edição completa do perfil, nivelamento e privacidade continua no app atual.{' '}
        <Link to="/perfil" className="font-bold text-ink underline">Abrir editor completo</Link>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-paper-pure p-5 text-center shadow-organic-sm">
      <p className="font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
